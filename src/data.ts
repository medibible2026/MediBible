// Bible text + cross-reference data model, reference parsing and graph helpers.

export interface BookInfo {
  osis: string;
  name: string;
  chapters: number[]; // verse count per chapter
}

export interface Bible {
  translation: string;
  books: BookInfo[];
  texts: string[];
  chapterStart: number[][]; // [book][chapter-1] -> first verse id
  vBook: Uint8Array;
  vChap: Uint16Array;
  vNum: Uint16Array;
  osisIndex: Map<string, number>;
}

export interface XrefEntry {
  target: number; // first verse id of the linked passage
  span: number; // extra verses in the passage (0 = single verse)
  votes: number;
  link: number; // index of the underlying link (into data / link kinds)
}

export interface Xrefs {
  attribution: string;
  offsets: Int32Array;
  data: Int32Array; // triples: target, span, votes
  inOffsets: Int32Array;
  inData: Int32Array; // triples: from, votes, link index
  links: Links | null;
}

// ---------- Link evidence (from scripts/build-links.mjs) ----------

export type LinkKind = 'P' | 'Q' | 'W' | 'L' | 'E' | 'T';
export const LINK_KINDS: LinkKind[] = ['P', 'Q', 'W', 'L', 'E', 'T'];

export const KIND_INFO: Record<LinkKind, { label: string; short: string; help: string }> = {
  P: { label: 'Parallel passage', short: 'Parallel', help: 'Same language and most content words shared, e.g. Kings and Chronicles, or the Synoptic Gospels.' },
  Q: { label: 'Same wording', short: 'Wording', help: 'A run of five or more identical KJV words: a quotation, citation or repeated formula.' },
  W: { label: 'Shared Hebrew/Greek word', short: 'Word', help: 'Both passages use the same uncommon Hebrew (or Greek) dictionary word.' },
  L: { label: 'Hebrew–Greek word link', short: 'Heb↔Grk', help: 'Old↔New Testament: a Greek word that translates a Hebrew word in the other passage (via the Septuagint notes in Abbott-Smith, or a shared STEPBible gloss).' },
  E: { label: 'English echo', short: 'English', help: 'Only an uncommon English word is shared in the KJV; there is no tagged Hebrew/Greek match.' },
  T: { label: 'Thematic', short: 'Thematic', help: 'No shared wording found. The link rests on the Treasury of Scripture Knowledge editors’ judgment about subject or theology.' },
};

export interface Lemma {
  strong: string;
  lemma: string;
  translit: string;
  gloss: string;
  freq: number; // verses in its testament that use it
}

export interface Evidence {
  w?: number[]; // shared lemmas
  l?: [number, number, number][]; // [greek lemma, hebrew lemma, source 0=LXX note 1=gloss]
  p?: string; // shared KJV phrase
  e?: string[]; // shared uncommon English words
}

export interface Links {
  attribution: string;
  kinds: string;
  evidence: Record<string, Evidence>;
  lemmas: Lemma[];
}

export const linkKind = (x: Xrefs, link: number): LinkKind | null => (x.links ? (x.links.kinds[link] as LinkKind) : null);
export const linkEvidence = (x: Xrefs, link: number): Evidence | null => x.links?.evidence[link] ?? null;

export const OT_BOOKS = 39;

// ---------- Interlinear, lexicon, concordance (from scripts/build-interlinear.mjs; loaded on demand) ----------

/** [form, transliteration, gloss in context, dStrong, grammar code, flags: 1 NA, 2 TR, 4 qere] */
export type IWord = [string, string, string, string, string, number];
export type LexEntry = [string, string, string, string]; // lemma, transliteration, gloss, part of speech

const jsonCache = new Map<string, Promise<unknown>>();
function getJson<T>(name: string): Promise<T> {
  if (!jsonCache.has(name)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${name}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${name} (${r.status}). Run "npm run data" first.`);
        return r.json();
      })
      .catch((e) => { jsonCache.delete(name); throw e; });
    jsonCache.set(name, p);
  }
  return jsonCache.get(name) as Promise<T>;
}

/** A further translation aligned verse-for-verse with the KJV (scripts/build-translations.mjs). */
export interface Translation {
  id: string;
  short: string;
  name: string;
  lang: string;
  license: string;
  source: string;
  texts: string[];
}
export const ALT_TRANSLATION = { id: 'tam2017', short: 'தமிழ் IRV', lang: 'ta' };
export const loadTranslation = (id: string) => getJson<Translation>(`${id}.json`);

export const loadInterlinear = (osis: string) => getJson<{ verses: Record<string, IWord[]> }>(`interlinear/${osis}.json`);
export const loadLexicon = () => getJson<Record<string, LexEntry>>('lexicon.json');
export const loadDefinitions = (lang: 'H' | 'G') => getJson<Record<string, string>>(`defs-${lang}.json`);
export const loadConcordance = () => getJson<Record<string, number[]>>('concordance.json');
export const strongBase = (d: string) => d.replace(/[A-Za-z]$/, '');
export const lexEntry = (lex: Record<string, LexEntry>, d: string): LexEntry | null => lex[d] ?? lex[strongBase(d)] ?? null;

export async function loadData(): Promise<{ bible: Bible; xrefs: Xrefs }> {
  const base = import.meta.env.BASE_URL;
  const get = async (name: string) => {
    const r = await fetch(`${base}data/${name}`);
    if (!r.ok) throw new Error(`Could not load ${name} (${r.status}). Run "npm run data" first.`);
    return r.json();
  };
  // Link evidence is optional: the explorer still works without the STEPBible build.
  const [b, x, l] = await Promise.all([get('bible.json'), get('xrefs.json'), get('links.json').catch(() => null)]);
  const bible = buildBible(b);
  const xrefs = buildXrefs(x, bible.texts.length);
  if (l) {
    xrefs.links = {
      attribution: l.attribution,
      kinds: l.kinds,
      evidence: l.evidence,
      lemmas: (l.lemmas as [string, string, string, string, number][]).map(([strong, lemma, translit, gloss, freq]) => ({ strong, lemma, translit, gloss, freq })),
    };
  }
  return { bible, xrefs };
}

function buildBible(raw: { translation: string; books: BookInfo[]; texts: string[] }): Bible {
  const n = raw.texts.length;
  const vBook = new Uint8Array(n);
  const vChap = new Uint16Array(n);
  const vNum = new Uint16Array(n);
  const chapterStart: number[][] = [];
  const osisIndex = new Map<string, number>();
  let id = 0;
  raw.books.forEach((bk, bi) => {
    const starts: number[] = [];
    bk.chapters.forEach((count, ci) => {
      starts.push(id);
      for (let v = 1; v <= count; v++) {
        vBook[id] = bi;
        vChap[id] = ci + 1;
        vNum[id] = v;
        osisIndex.set(`${bk.osis}.${ci + 1}.${v}`, id);
        id++;
      }
    });
    chapterStart.push(starts);
  });
  return { translation: raw.translation, books: raw.books, texts: raw.texts, chapterStart, vBook, vChap, vNum, osisIndex };
}

function buildXrefs(raw: { attribution: string; offsets: number[]; data: number[] }, n: number): Xrefs {
  const offsets = Int32Array.from(raw.offsets);
  const data = Int32Array.from(raw.data);
  // Reverse index: every verse inside a linked passage points back to the source verse.
  const counts = new Int32Array(n + 1);
  for (let i = 0; i < data.length; i += 3) {
    for (let t = data[i]; t <= data[i] + data[i + 1]; t++) counts[t + 1]++;
  }
  for (let i = 1; i <= n; i++) counts[i] += counts[i - 1];
  const inOffsets = counts.slice();
  const fill = counts.slice(0, n);
  const inData = new Int32Array(inOffsets[n] * 3);
  for (let from = 0; from < n; from++) {
    for (let k = offsets[from]; k < offsets[from + 1]; k++) {
      const t0 = data[k * 3], span = data[k * 3 + 1], votes = data[k * 3 + 2];
      for (let t = t0; t <= t0 + span; t++) {
        const p = fill[t]++;
        inData[p * 3] = from;
        inData[p * 3 + 1] = votes;
        inData[p * 3 + 2] = k;
      }
    }
  }
  // Sort each incoming list by votes (desc).
  for (let v = 0; v < n; v++) {
    const a = inOffsets[v], b = inOffsets[v + 1];
    if (b - a < 2) continue;
    const rows: [number, number, number][] = [];
    for (let p = a; p < b; p++) rows.push([inData[p * 3], inData[p * 3 + 1], inData[p * 3 + 2]]);
    rows.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
    rows.forEach((r, i) => inData.set(r, (a + i) * 3));
  }
  return { attribution: raw.attribution, offsets, data, inOffsets, inData, links: null };
}

export function outgoing(x: Xrefs, id: number): XrefEntry[] {
  const res: XrefEntry[] = [];
  for (let k = x.offsets[id]; k < x.offsets[id + 1]; k++) {
    res.push({ target: x.data[k * 3], span: x.data[k * 3 + 1], votes: x.data[k * 3 + 2], link: k });
  }
  return res;
}

export function incoming(x: Xrefs, id: number): XrefEntry[] {
  const res: XrefEntry[] = [];
  for (let p = x.inOffsets[id]; p < x.inOffsets[id + 1]; p++) {
    res.push({ target: x.inData[p * 3], span: 0, votes: x.inData[p * 3 + 1], link: x.inData[p * 3 + 2] });
  }
  return res;
}

export const outCount = (x: Xrefs, id: number) => x.offsets[id + 1] - x.offsets[id];
export const inCount = (x: Xrefs, id: number) => x.inOffsets[id + 1] - x.inOffsets[id];

export type Scope = 'all' | 'ot' | 'nt' | 'cross';
export type Direction = 'out' | 'in';

export interface Filters {
  minVotes: number;
  scope: Scope;
  direction: Direction;
  book: number; // -1 = any book
  kinds: string; // link kinds to show, e.g. "PQWLET"
}

export const DEFAULT_FILTERS: Filters = { minVotes: 0, scope: 'all', direction: 'out', book: -1, kinds: LINK_KINDS.join('') };

export function applyFilters(bible: Bible, from: number, list: XrefEntry[], f: Filters, linkKinds?: string): XrefEntry[] {
  const fromOT = bible.vBook[from] < OT_BOOKS;
  const kindFilter = linkKinds && f.kinds && f.kinds.length < LINK_KINDS.length;
  return list.filter((e) => {
    if (e.votes < f.minVotes) return false;
    if (kindFilter && !f.kinds.includes(linkKinds[e.link])) return false;
    const b = bible.vBook[e.target];
    const isOT = b < OT_BOOKS;
    if (f.scope === 'ot' && !isOT) return false;
    if (f.scope === 'nt' && isOT) return false;
    if (f.scope === 'cross' && isOT === fromOT) return false;
    if (f.book >= 0 && b !== f.book) return false;
    return true;
  });
}

// ---------- Reference labels ----------

export function refLabel(bible: Bible, id: number, span = 0): string {
  const b = bible.books[bible.vBook[id]];
  const c = bible.vChap[id], v = bible.vNum[id];
  if (span <= 0) return `${b.name} ${c}:${v}`;
  const e = id + span;
  if (bible.vBook[e] !== bible.vBook[id]) return `${b.name} ${c}:${v} – ${refLabel(bible, e)}`;
  if (bible.vChap[e] !== c) return `${b.name} ${c}:${v}–${bible.vChap[e]}:${bible.vNum[e]}`;
  return `${b.name} ${c}:${v}–${bible.vNum[e]}`;
}

/** Compact label for graphs, e.g. "John 1:29" -> "John 1:29", "1 Corinthians 13:4" -> "1Cor 13:4". */
export function refShort(bible: Bible, id: number, span = 0): string {
  const b = bible.books[bible.vBook[id]].osis;
  const base = `${b} ${bible.vChap[id]}:${bible.vNum[id]}`;
  if (span <= 0) return base;
  const e = id + span;
  return bible.vChap[e] === bible.vChap[id] && bible.vBook[e] === bible.vBook[id] ? `${base}–${bible.vNum[e]}` : `${base}ff`;
}

export function osisOf(bible: Bible, id: number): string {
  return `${bible.books[bible.vBook[id]].osis}.${bible.vChap[id]}.${bible.vNum[id]}`;
}

export function passageText(bible: Bible, id: number, span = 0, max = 6, texts: string[] = bible.texts): string {
  if (span <= 0) return texts[id];
  const parts: string[] = [];
  const last = Math.min(id + span, id + max - 1);
  for (let v = id; v <= last; v++) parts.push(`${bible.vNum[v]} ${texts[v]}`);
  if (id + span > last) parts.push('…');
  return parts.join(' ');
}

// ---------- Reference parsing ----------

const ALIASES: Record<string, string> = {
  gn: 'Gen', ge: 'Gen', ex: 'Exod', exo: 'Exod', lv: 'Lev', nm: 'Num', dt: 'Deut', jos: 'Josh', jdg: 'Judg', jg: 'Judg',
  rt: 'Ruth', ps: 'Ps', psa: 'Ps', psalm: 'Ps', pss: 'Ps', pr: 'Prov', prv: 'Prov', ec: 'Eccl', qoh: 'Eccl',
  so: 'Song', sos: 'Song', songofsongs: 'Song', canticles: 'Song', is: 'Isa', jr: 'Jer', la: 'Lam', ezk: 'Ezek',
  dn: 'Dan', ho: 'Hos', jl: 'Joel', am: 'Amos', ob: 'Obad', jnh: 'Jonah', mi: 'Mic', na: 'Nah', hb: 'Hab',
  zp: 'Zeph', hg: 'Hag', zc: 'Zech', ml: 'Mal', mt: 'Matt', mk: 'Mark', mr: 'Mark', lk: 'Luke', jn: 'John',
  jhn: 'John', ac: 'Acts', rm: 'Rom', ga: 'Gal', ep: 'Eph', php: 'Phil', pp: 'Phil', cl: 'Col', ti: 'Titus',
  tit: 'Titus', phm: 'Phlm', philem: 'Phlm', hb2: 'Heb', jas: 'Jas', jm: 'Jas', jud: 'Jude', jd: 'Jude',
  re: 'Rev', rv: 'Rev', apocalypse: 'Rev', revelations: 'Rev',
  '1jn': '1John', '2jn': '2John', '3jn': '3John', '1jo': '1John', '2jo': '2John', '3jo': '3John',
  '1co': '1Cor', '2co': '2Cor', '1th': '1Thess', '2th': '2Thess', '1ti': '1Tim', '2ti': '2Tim',
  '1pe': '1Pet', '2pe': '2Pet', '1pt': '1Pet', '2pt': '2Pet', '1sa': '1Sam', '2sa': '2Sam', '1ki': '1Kgs', '2ki': '2Kgs',
  '1ch': '1Chr', '2ch': '2Chr',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findBook(bible: Bible, input: string): number {
  let s = input.trim().toLowerCase().replace(/^(iii|ii|i)\s+/, (m) => String(m.trim().length) + ' ').replace(/^(first|second|third)\s+/, (m) =>
    ({ first: '1', second: '2', third: '3' } as Record<string, string>)[m.trim()] + ' ');
  s = norm(s);
  if (!s) return -1;
  const alias = ALIASES[s];
  if (alias) return bible.books.findIndex((b) => b.osis === alias);
  let idx = bible.books.findIndex((b) => norm(b.osis) === s || norm(b.name) === s);
  if (idx >= 0) return idx;
  idx = bible.books.findIndex((b) => norm(b.name).startsWith(s) || norm(b.osis).startsWith(s));
  return idx;
}

export interface ParsedRef {
  start: number;
  end: number;
  wholeChapter: boolean;
}

/** Parses "John 3:16", "1 cor 13:4-7", "Ps 23", "Gen.1.1". Returns null if not a reference. */
export function parseRef(bible: Bible, input: string): ParsedRef | null {
  const s = input.trim().replace(/[–—]/g, '-');
  const m = s.match(/^((?:[123]|i{1,3})?\s*[a-z][a-z .]*?)\.?\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*-\s*(?:(\d+)\s*[:.]\s*)?(\d+))?)?$/i);
  if (!m) return null;
  const b = findBook(bible, m[1]);
  if (b < 0) return null;
  const chapters = bible.books[b].chapters;
  const c = Number(m[2]);
  if (c < 1 || c > chapters.length) return null;
  const first = bible.chapterStart[b][c - 1];
  if (!m[3]) return { start: first, end: first + chapters[c - 1] - 1, wholeChapter: true };
  const v = Math.min(Math.max(Number(m[3]), 1), chapters[c - 1]);
  const start = first + v - 1;
  let end = start;
  if (m[5]) {
    const c2 = m[4] ? Number(m[4]) : c;
    if (c2 >= c && c2 <= chapters.length) {
      const v2 = Math.min(Number(m[5]), chapters[c2 - 1]);
      end = Math.max(start, bible.chapterStart[b][c2 - 1] + v2 - 1);
    }
  }
  return { start, end, wholeChapter: false };
}

export function fromOsis(bible: Bible, osis: string): number {
  return bible.osisIndex.get(osis) ?? -1;
}

// ---------- Text search ----------

const lowerCaches = new WeakMap<string[], string[]>();

/** True when the text contains Tamil script (search then runs over the Tamil translation). */
export const hasTamil = (s: string) => /[஀-௿]/.test(s);

export function searchText(bible: Bible, query: string, limit = 300, texts: string[] = bible.texts): { results: number[]; total: number } {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return { results: [], total: 0 };
  let lowerCache = lowerCaches.get(texts);
  if (!lowerCache) { lowerCache = texts.map((t) => t.toLowerCase()); lowerCaches.set(texts, lowerCache); }
  const phrase = query.trim().startsWith('"') ? query.toLowerCase().replace(/"/g, '').trim() : null;
  const results: number[] = [];
  let total = 0;
  for (let i = 0; i < lowerCache.length; i++) {
    const t = lowerCache[i];
    const hit = phrase ? t.includes(phrase) : terms.every((w) => t.includes(w));
    if (hit) {
      total++;
      if (results.length < limit) results.push(i);
    }
  }
  return { results, total };
}

// ---------- Path finding ----------

/**
 * Shortest chain of cross-references linking two verses (links followed in either direction).
 * Neighbours are tried in vote order, so ties resolve toward better-attested links.
 */
export function findPath(x: Xrefs, from: number, to: number, minVotes: number, banned: Set<number>, maxDepth = 6, skipDirect = false): number[] | null {
  if (from === to) return [from];
  const n = x.offsets.length - 1;
  const prev = new Int32Array(n).fill(-1);
  const depth = new Int8Array(n).fill(-1);
  depth[from] = 0;
  let frontier = [from];
  while (frontier.length) {
    const next: number[] = [];
    for (const v of frontier) {
      if (depth[v] >= maxDepth) continue;
      const visit = (u: number) => {
        if (depth[u] !== -1 || (banned.has(u) && u !== to)) return false;
        if (skipDirect && v === from && u === to) return false;
        depth[u] = depth[v] + 1;
        prev[u] = v;
        if (u === to) return true;
        next.push(u);
        return false;
      };
      for (let k = x.offsets[v]; k < x.offsets[v + 1]; k++) {
        if (x.data[k * 3 + 2] < minVotes) continue;
        const t0 = x.data[k * 3], span = x.data[k * 3 + 1];
        for (let t = t0; t <= t0 + span; t++) if (visit(t)) return trace(prev, to);
      }
      for (let p = x.inOffsets[v]; p < x.inOffsets[v + 1]; p++) {
        if (x.inData[p * 3 + 1] < minVotes) continue;
        if (visit(x.inData[p * 3])) return trace(prev, to);
      }
    }
    frontier = next;
  }
  return null;
}

function trace(prev: Int32Array, to: number): number[] {
  const path = [to];
  let v = to;
  while (prev[v] !== -1) {
    v = prev[v];
    path.push(v);
  }
  return path.reverse();
}

/**
 * Up to `count` alternative paths, each avoiding the intermediate verses of earlier ones.
 * A direct link is reported once; later searches then look for routes through other passages.
 */
export function findPaths(x: Xrefs, from: number, to: number, minVotes: number, count = 3): number[][] {
  const banned = new Set<number>();
  const paths: number[][] = [];
  let skipDirect = false;
  for (let i = 0; i < count; i++) {
    const p = findPath(x, from, to, minVotes, banned, 6, skipDirect);
    if (!p) break;
    paths.push(p);
    p.slice(1, -1).forEach((v) => banned.add(v));
    if (p.length === 2) skipDirect = true;
  }
  return paths;
}
