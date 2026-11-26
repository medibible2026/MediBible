// Classifies every cross-reference by the evidence behind it, using STEPBible's tagged
// Hebrew (TAHOT) and Greek (TAGNT) texts plus the KJV wording.
//   Input:  public/data/bible.json, public/data/xrefs.json (from build-data.mjs)
//           data/raw/stepbible/{tahot1-4,tagnt1-2,tbesh,tbesg}.txt (STEPBible.org, CC BY 4.0)
//   Output: public/data/links.json
//
// Link kinds, in priority order:
//   P  Parallel passage  – same language, most content words shared (e.g. Kings // Chronicles, Synoptics)
//   Q  Same wording      – a run of 5+ identical KJV words with 2+ content words (quotations, refrains)
//   W  Shared word       – same language, shares an uncommon Hebrew/Greek dictionary word
//   L  LXX word link     – OT↔NT: a Greek word whose Septuagint equivalent is a Hebrew word in the other verse
//   E  English echo      – shares an uncommon KJV word only
//   T  Thematic          – no shared wording found; the link rests on the TSK editors' judgment
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const step = join(root, 'data', 'raw', 'stepbible');
const outDir = join(root, 'public', 'data');

const bible = JSON.parse(readFileSync(join(outDir, 'bible.json'), 'utf8'));
const xrefs = JSON.parse(readFileSync(join(outDir, 'xrefs.json'), 'utf8'));
const N = bible.texts.length;
const OT_BOOKS = 39;

const chapterStart = [];
const vBook = new Uint8Array(N);
{
  let id = 0;
  bible.books.forEach((b, bi) => {
    const s = [];
    b.chapters.forEach((n) => { s.push(id); for (let v = 0; v < n; v++) vBook[id++] = bi; });
    chapterStart.push(s);
  });
}
const isOT = (id) => vBook[id] < OT_BOOKS;
const verseId = (book, c, v) => {
  const ch = chapterStart[book]?.[c - 1];
  if (ch === undefined || v < 1 || v > bible.books[book].chapters[c - 1]) return -1;
  return ch + v - 1;
};

// ---------- Lexicons ----------
const lexicon = new Map(); // dStrong -> { lemma, translit, gloss }
for (const f of ['tbesh.txt', 'tbesg.txt']) {
  for (const line of readFileSync(join(step, f), 'utf8').split(/\r?\n/)) {
    const c = line.split('\t');
    if (!/^[HG]\d{4}/.test(c[0] || '') || !c[1]) continue;
    const d = c[1].split(/\s/)[0];
    if (!/^[HG]\d{4}[A-Za-z]?$/.test(d) || lexicon.has(d)) continue;
    lexicon.set(d, { lemma: c[3], translit: c[4], pos: c[5] || '', gloss: c[6], def: c[7] || '' });
  }
}
const baseOf = (d) => d.replace(/[A-Za-z]$/, '');
const lex = (d) => lexicon.get(d) || lexicon.get(baseOf(d));
// Pronouns, prepositions, conjunctions, particles, articles: never evidence of a link.
const FUNCTION_POS = /^(H:(Prep|Conj|Intg|DemP|Cond|Neg|Part|RelP|PerP|Intj)|G:(PREP|CONJ|PRT|COND|INJ|D|P|R|C|X|Q|F|K|I|S)(-|$))/;
const isFunctionWord = (d) => FUNCTION_POS.test(lex(d)?.pos || '');

// ---------- Tagged texts -> lemma sets per verse ----------
const lemmaIndex = new Map(); // dStrong -> idx
const lemmaKeys = [];
const idxOf = (d) => {
  let i = lemmaIndex.get(d);
  if (i === undefined) { i = lemmaKeys.length; lemmaIndex.set(d, i); lemmaKeys.push(d); }
  return i;
};
const verseLemmas = Array.from({ length: N }, () => new Set());
const bookCodes = new Map(); // STEP book code -> book index (by order of appearance)
let unmapped = 0;

function addWords(file, isGreek) {
  for (const line of readFileSync(join(step, file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)(\[(\d+)\.(\d+)\]|\((\d+)\.(\d+)\))?#\d+=/);
    if (!m) continue;
    if (!bookCodes.has(m[1])) bookCodes.set(m[1], bookCodes.size);
    const book = bookCodes.get(m[1]);
    // TAGNT gives the KJV reference in [brackets] where it differs; TAHOT lists the English ref first.
    const [c, v] = isGreek && m[5] ? [Number(m[5]), Number(m[6])] : [Number(m[2]), Number(m[3])];
    const id = verseId(book, c, v);
    if (id < 0) { unmapped++; continue; }
    const cols = line.split('\t');
    let tags;
    if (isGreek) {
      tags = [(cols[3] || '').split('=')[0]];
    } else {
      const braced = [...(cols[4] || '').matchAll(/\{(H\d{4}[A-Za-z]?)\}/g)].map((x) => x[1]);
      tags = braced.length ? braced : [...(cols[4] || '').matchAll(/H\d{4}[A-Za-z]?/g)].map((x) => x[0]);
    }
    for (const t of tags) {
      if (!/^[HG]\d{4}/.test(t)) continue;
      if (/^H9\d{3}/.test(t)) continue; // prefixes, suffixes, particles
      if (isFunctionWord(t)) continue;
      verseLemmas[id].add(idxOf(t));
    }
  }
}
['tahot1.txt', 'tahot2.txt', 'tahot3.txt', 'tahot4.txt'].forEach((f) => addWords(f, false));
['tagnt1.txt', 'tagnt2.txt'].forEach((f) => addWords(f, true));
if (bookCodes.size !== 66) throw new Error(`Expected 66 STEP book codes, got ${bookCodes.size}`);

// Document frequency per lemma (within its testament); rare = carries evidential weight.
// STEPBible splits common words into meaning variants (H7200G/H7200H); rarity is judged on the
// whole word, so counts are pooled across variants of the same Strong's number.
const df = new Int32Array(lemmaKeys.length);
{
  const raw = new Int32Array(lemmaKeys.length);
  for (const s of verseLemmas) for (const l of s) raw[l]++;
  const pooled = new Map();
  lemmaKeys.forEach((d, i) => pooled.set(baseOf(d), (pooled.get(baseOf(d)) || 0) + raw[i]));
  lemmaKeys.forEach((d, i) => { df[i] = pooled.get(baseOf(d)); });
}
const N_OT = chapterStart[OT_BOOKS][0], N_NT = N - N_OT;
const isRare = (l) => df[l] <= (lemmaKeys[l][0] === 'H' ? N_OT : N_NT) * 0.04;

// ---------- Greek -> Hebrew bridge from the LXX notes in Abbott-Smith (TBESG) ----------
const stripHeb = (s) => s.replace(/[֑-ׇ]/g, '').replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]);
const hebByForm = new Map(); // consonantal form -> [lemma idx]
lemmaKeys.forEach((d, i) => {
  if (d[0] !== 'H') return;
  const e = lex(d);
  if (!e?.lemma) return;
  const k = stripHeb(e.lemma).trim();
  if (!hebByForm.has(k)) hebByForm.set(k, []);
  hebByForm.get(k).push(i);
});
// Second bridge: Greek and Hebrew words whose STEPBible glosses share a meaning ("beginning").
// Abbott-Smith's LXX notes often end in "etc.", so this fills gaps; pairs are tagged by source.
const glossParts = (g) => (g || '').toLowerCase().split(/[:;,/»|]/)
  .map((s) => s.replace(/[^a-z ]/g, '').trim().replace(/^(to be|to|be)\s+/, '').replace(/\s+(in|on|to|with|from|out|up|of|upon)$/, ''))
  // "be blessed" should meet "to bless": also index the -ed form without its ending.
  .flatMap((s) => (s.length > 5 && s.endsWith('ed') ? [s, s.slice(0, -2)] : [s])).filter((s) => s.length >= 3);
const hebByGloss = new Map();
lemmaKeys.forEach((d, i) => {
  if (d[0] !== 'H') return;
  for (const p of glossParts(lex(d)?.gloss)) {
    if (!hebByGloss.has(p)) hebByGloss.set(p, []);
    hebByGloss.get(p).push(i);
  }
});
const greekToHebGloss = new Map();
lemmaKeys.forEach((d, i) => {
  if (d[0] !== 'G') return;
  const hs = new Set(glossParts(lex(d)?.gloss).flatMap((p) => hebByGloss.get(p) || []));
  if (hs.size) greekToHebGloss.set(i, hs);
});
// The bridge is fuzzier than a same-language match, so it demands rarer words on both sides.
const isBridgeRare = (l) => df[l] <= (lemmaKeys[l][0] === 'H' ? N_OT : N_NT) * 0.02;
const greekToHeb = new Map(); // greek lemma idx -> Set<hebrew lemma idx>
for (const [d, e] of lexicon) {
  if (d[0] !== 'G') continue;
  const seg = e.def.match(/\[in LXX[^\]]*\]/);
  if (!seg) continue;
  const heb = new Set();
  for (const w of seg[0].match(/[א-ת][א-ת֑-ׇ]*/g) || []) {
    for (const h of hebByForm.get(stripHeb(w)) || []) heb.add(h);
  }
  if (!heb.size) continue;
  for (const key of [d, ...[...lemmaIndex.keys()].filter((k) => k[0] === 'G' && baseOf(k) === d)]) {
    const gi = lemmaIndex.get(key);
    if (gi !== undefined) greekToHeb.set(gi, heb);
  }
}

// ---------- KJV wording ----------
const STOP = new Set(('a an and the of to in that for unto with is be it his he him they them their thou thee thy thine ye you your i me my mine we us our ' +
  'not shall will was were are am art hath have had which who whom what this these those there then when as by from on at or but all so ' +
  'upon into out up do did doth said saith say also if no nor neither one any every even let may might now o lord god').split(' '));
const words = bible.texts.map((t) => t.toLowerCase().replace(/[^a-z\s']/g, ' ').replace(/'s\b/g, '').split(/\s+/).filter(Boolean));
const stem = (w) => (w.length > 5 ? w.replace(/(eth|est|ing|ed|es|s)$/, '') : w);
const engDf = new Map();
words.forEach((ws) => new Set(ws.map(stem)).forEach((w) => engDf.set(w, (engDf.get(w) || 0) + 1)));
const engRare = (w) => w.length >= 4 && !STOP.has(w) && (engDf.get(w) || 0) <= N * 0.004;

function sharedRun(a, b) {
  // Longest run of identical consecutive words, if 5+ words with 2+ content words.
  const pos = new Map();
  b.forEach((w, i) => { if (!pos.has(w)) pos.set(w, []); pos.get(w).push(i); });
  let best = null;
  for (let i = 0; i < a.length; i++) {
    for (const j of pos.get(a[i]) || []) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k >= 5 && (!best || k > best.length)) best = a.slice(i, i + k);
    }
  }
  if (!best || best.filter((w) => !STOP.has(w)).length < 2) return null;
  return best.join(' ');
}

// ---------- Classify ----------
const kinds = [];
const evidence = {}; // link index -> evidence
const usedLemmas = new Map(); // lemma idx -> output idx
const outLemma = (l) => {
  let o = usedLemmas.get(l);
  if (o === undefined) { o = usedLemmas.size; usedLemmas.set(l, o); }
  return o;
};
const byRarity = (a, b) => df[a] - df[b];
const counts = {};

const { offsets, data } = xrefs;
for (let from = 0; from < N; from++) {
  const A = verseLemmas[from];
  const aWords = words[from];
  for (let k = offsets[from]; k < offsets[from + 1]; k++) {
    const t0 = data[k * 3], span = data[k * 3 + 1];
    const B = new Set();
    let bWords = [];
    for (let t = t0; t <= t0 + span; t++) {
      verseLemmas[t].forEach((l) => B.add(l));
      bWords = bWords.concat(words[t]);
    }
    // Evidence: w = shared lemmas, l = [greek, hebrew] LXX pairs, p = shared KJV phrase, e = shared rare English words.
    const ev = {};
    const run = sharedRun(aWords, bWords);
    if (run) ev.p = run;
    let kind = 'T';
    if (isOT(from) === isOT(t0)) {
      const shared = [...A].filter((l) => B.has(l));
      const rare = shared.filter(isRare).sort(byRarity);
      const coverage = shared.length / Math.max(1, Math.min(A.size, B.size));
      if (rare.length) ev.w = rare.slice(0, 4).map(outLemma);
      if (coverage >= 0.6 && Math.min(A.size, B.size) >= 5) kind = 'P';
      else if (run) kind = 'Q';
      else if (rare.length) kind = 'W';
    } else {
      const [G, H] = isOT(from) ? [B, A] : [A, B];
      const pairs = [];
      // Each pair: [greek, hebrew, source] where source 0 = LXX note in Abbott-Smith, 1 = shared gloss.
      for (const g of [...G].filter(isBridgeRare).sort(byRarity)) {
        let found;
        for (const [src, table] of [[0, greekToHeb], [1, greekToHebGloss]]) {
          const h = [...(table.get(g) || [])].filter((x) => H.has(x) && isBridgeRare(x)).sort(byRarity)[0];
          if (h !== undefined) { found = [outLemma(g), outLemma(h), src]; break; }
        }
        if (found) pairs.push(found);
        if (pairs.length >= 3) break;
      }
      if (pairs.length) ev.l = pairs;
      if (run) kind = 'Q';
      else if (pairs.length) kind = 'L';
    }
    if (kind !== 'P') {
      const aSet = new Set(aWords.map(stem).filter(engRare));
      const shared = [...new Set(bWords.map(stem))].filter((w) => aSet.has(w));
      // Show each word as it appears in the source verse.
      if (shared.length) ev.e = shared.slice(0, 3).map((s) => aWords.find((w) => stem(w) === s) || s);
      if (kind === 'T' && shared.length) kind = 'E';
    }
    kinds.push(kind);
    if (Object.keys(ev).length) evidence[k] = ev;
    counts[kind] = (counts[kind] || 0) + 1;
  }
}

const lemmas = [];
for (const [l, o] of usedLemmas) {
  const d = lemmaKeys[l];
  const e = lex(d) || {};
  lemmas[o] = [d, e.lemma || '', e.translit || '', e.gloss || '', df[l]];
}

writeFileSync(join(outDir, 'links.json'), JSON.stringify({
  attribution: 'Hebrew/Greek tagging: STEPBible.org TAHOT, TAGNT, TBESH, TBESG (CC BY 4.0)',
  kinds: kinds.join(''), evidence, lemmas,
}));
console.log(`links=${kinds.length} unmappedWords=${unmapped} lexicon=${lexicon.size} lemmas=${lemmaKeys.length} greekToHeb=${greekToHeb.size}`);
console.log(counts);
