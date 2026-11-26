// Shared readers for the app's KJV index and STEPBible's tagged texts and lexicons.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const stepDir = join(root, 'data', 'raw', 'stepbible');
export const outDir = join(root, 'public', 'data');
export const OT_BOOKS = 39;

/** KJV verse index built from public/data/bible.json. */
export function loadBibleIndex() {
  const bible = JSON.parse(readFileSync(join(outDir, 'bible.json'), 'utf8'));
  const N = bible.texts.length;
  const chapterStart = [];
  const vBook = new Uint8Array(N);
  let id = 0;
  bible.books.forEach((b, bi) => {
    const s = [];
    b.chapters.forEach((n) => { s.push(id); for (let v = 0; v < n; v++) vBook[id++] = bi; });
    chapterStart.push(s);
  });
  const verseId = (book, c, v) => {
    const ch = chapterStart[book]?.[c - 1];
    if (ch === undefined || v < 1 || v > bible.books[book].chapters[c - 1]) return -1;
    return ch + v - 1;
  };
  return { bible, N, chapterStart, vBook, verseId, isOT: (i) => vBook[i] < OT_BOOKS };
}

export const baseOf = (d) => d.replace(/[A-Za-z]$/, '');

/** TBESH + TBESG: dStrong -> { lemma, translit, pos, gloss, def }. */
export function loadLexicon() {
  const lexicon = new Map();
  for (const f of ['tbesh.txt', 'tbesg.txt']) {
    for (const line of readFileSync(join(stepDir, f), 'utf8').split(/\r?\n/)) {
      const c = line.split('\t');
      if (!/^[HG]\d{4}/.test(c[0] || '') || !c[1]) continue;
      const d = c[1].split(/\s/)[0];
      if (!/^[HG]\d{4}[A-Za-z]?$/.test(d) || lexicon.has(d)) continue;
      lexicon.set(d, { lemma: c[3], translit: c[4], pos: c[5] || '', gloss: c[6], def: c[7] || '' });
    }
  }
  const lex = (d) => lexicon.get(d) || lexicon.get(baseOf(d));
  // Pronouns, prepositions, conjunctions, particles, articles: never evidence of a link.
  const FUNCTION_POS = /^(H:(Prep|Conj|Intg|DemP|Cond|Neg|Part|RelP|PerP|Intj)|G:(PREP|CONJ|PRT|COND|INJ|D|P|R|C|X|Q|F|K|I|S)(-|$))/;
  const isFunctionWord = (d) => FUNCTION_POS.test(lex(d)?.pos || '');
  return { lexicon, lex, isFunctionWord };
}

export const TAHOT_FILES = ['tahot1.txt', 'tahot2.txt', 'tahot3.txt', 'tahot4.txt'];
export const TAGNT_FILES = ['tagnt1.txt', 'tagnt2.txt'];

/**
 * Calls fn({ id, isGreek, cols, type }) for every tagged word, mapped to a KJV verse id.
 * TAGNT gives the KJV reference in [brackets] where it differs; TAHOT lists the English ref first.
 * Returns { unmapped, bookCodes }.
 */
export function forEachWord(index, fn) {
  const bookCodes = new Map(); // STEP book code -> book index (by order of appearance)
  let unmapped = 0;
  const read = (file, isGreek) => {
    for (const line of readFileSync(join(stepDir, file), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)(\[(\d+)\.(\d+)\]|\((\d+)\.(\d+)\))?#\d+=([^\t]*)/);
      if (!m) continue;
      if (!bookCodes.has(m[1])) bookCodes.set(m[1], bookCodes.size);
      const book = bookCodes.get(m[1]);
      const [c, v] = isGreek && m[5] ? [Number(m[5]), Number(m[6])] : [Number(m[2]), Number(m[3])];
      const id = index.verseId(book, c, v);
      if (id < 0) { unmapped++; continue; }
      fn({ id, isGreek, cols: line.split('\t'), type: m[9] });
    }
  };
  TAHOT_FILES.forEach((f) => read(f, false));
  TAGNT_FILES.forEach((f) => read(f, true));
  if (bookCodes.size !== 66) throw new Error(`Expected 66 STEP book codes, got ${bookCodes.size}`);
  return { unmapped, bookCodes };
}

/** Content-word Strong's tags of one tagged word (Hebrew: the braced main word, without prefixes/suffixes). */
export function wordTags(w) {
  if (w.isGreek) return [(w.cols[3] || '').split('=')[0]];
  const braced = [...(w.cols[4] || '').matchAll(/\{(H\d{4}[A-Za-z]?)\}/g)].map((x) => x[1]);
  return braced.length ? braced : [...(w.cols[4] || '').matchAll(/H\d{4}[A-Za-z]?/g)].map((x) => x[0]);
}
