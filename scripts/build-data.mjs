// Builds compact app data from the raw downloads in data/raw.
//   Input:  data/raw/KJV.json (scrollmapper/bible_databases, public domain)
//           data/raw/xref/cross_references.txt (openbible.info, CC BY)
//   Output: public/data/bible.json, public/data/xrefs.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeXrefs } from './lib/xrefs-format.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = join(root, 'data', 'raw');
const out = join(root, 'public', 'data');
mkdirSync(out, { recursive: true });

// Canonical order; OSIS codes match the OpenBible file.
const BOOKS = [
  ['Gen', 'Genesis'], ['Exod', 'Exodus'], ['Lev', 'Leviticus'], ['Num', 'Numbers'], ['Deut', 'Deuteronomy'],
  ['Josh', 'Joshua'], ['Judg', 'Judges'], ['Ruth', 'Ruth'], ['1Sam', '1 Samuel'], ['2Sam', '2 Samuel'],
  ['1Kgs', '1 Kings'], ['2Kgs', '2 Kings'], ['1Chr', '1 Chronicles'], ['2Chr', '2 Chronicles'], ['Ezra', 'Ezra'],
  ['Neh', 'Nehemiah'], ['Esth', 'Esther'], ['Job', 'Job'], ['Ps', 'Psalms'], ['Prov', 'Proverbs'],
  ['Eccl', 'Ecclesiastes'], ['Song', 'Song of Solomon'], ['Isa', 'Isaiah'], ['Jer', 'Jeremiah'], ['Lam', 'Lamentations'],
  ['Ezek', 'Ezekiel'], ['Dan', 'Daniel'], ['Hos', 'Hosea'], ['Joel', 'Joel'], ['Amos', 'Amos'],
  ['Obad', 'Obadiah'], ['Jonah', 'Jonah'], ['Mic', 'Micah'], ['Nah', 'Nahum'], ['Hab', 'Habakkuk'],
  ['Zeph', 'Zephaniah'], ['Hag', 'Haggai'], ['Zech', 'Zechariah'], ['Mal', 'Malachi'],
  ['Matt', 'Matthew'], ['Mark', 'Mark'], ['Luke', 'Luke'], ['John', 'John'], ['Acts', 'Acts'],
  ['Rom', 'Romans'], ['1Cor', '1 Corinthians'], ['2Cor', '2 Corinthians'], ['Gal', 'Galatians'], ['Eph', 'Ephesians'],
  ['Phil', 'Philippians'], ['Col', 'Colossians'], ['1Thess', '1 Thessalonians'], ['2Thess', '2 Thessalonians'],
  ['1Tim', '1 Timothy'], ['2Tim', '2 Timothy'], ['Titus', 'Titus'], ['Phlm', 'Philemon'], ['Heb', 'Hebrews'],
  ['Jas', 'James'], ['1Pet', '1 Peter'], ['2Pet', '2 Peter'], ['1John', '1 John'], ['2John', '2 John'],
  ['3John', '3 John'], ['Jude', 'Jude'], ['Rev', 'Revelation'],
];

const kjv = JSON.parse(readFileSync(join(raw, 'KJV.json'), 'utf8'));
if (kjv.books.length !== 66) throw new Error('Expected 66 books in KJV.json');

const texts = [];
const books = [];
const idOf = new Map(); // "Gen.1.1" -> verse index
kjv.books.forEach((b, bi) => {
  const [osis, name] = BOOKS[bi];
  const chapters = [];
  b.chapters.forEach((c, ci) => {
    if (c.chapter !== ci + 1) throw new Error(`Chapter order ${name} ${c.chapter}`);
    chapters.push(c.verses.length);
    c.verses.forEach((v, vi) => {
      if (v.verse !== vi + 1) throw new Error(`Verse order ${name} ${c.chapter}:${v.verse}`);
      idOf.set(`${osis}.${c.chapter}.${v.verse}`, texts.length);
      texts.push(v.text.replace(/\s+/g, ' ').trim());
    });
  });
  books.push({ osis, name, chapters });
});

const lines = readFileSync(join(raw, 'xref', 'cross_references.txt'), 'utf8').split(/\r?\n/);
const header = lines.shift();
const attribution = (header.match(/#(.*)$/) || [, 'www.openbible.info CC-BY'])[1].trim();

const byFrom = Array.from({ length: texts.length }, () => []);
let skipped = 0;
for (const line of lines) {
  if (!line) continue;
  const [from, to, votesStr] = line.split('\t');
  const [toStart, toEnd = toStart] = to.split('-');
  const f = idOf.get(from), a = idOf.get(toStart), z = idOf.get(toEnd);
  if (f === undefined || a === undefined || z === undefined || z < a) { skipped++; continue; }
  byFrom[f].push([a, z - a, Number(votesStr)]);
}

writeFileSync(join(out, 'bible.json'), JSON.stringify({
  translation: 'KJV', source: 'King James Version (1769), public domain', books, texts,
}));
// Compact v2 format (see scripts/lib/xrefs-format.mjs): canonical order by source, then target.
const xrefs = encodeXrefs(byFrom, attribution);
writeFileSync(join(out, 'xrefs.json'), JSON.stringify(xrefs));
console.log(`verses=${texts.length} xrefs=${xrefs.dt.length} skipped=${skipped}`);
