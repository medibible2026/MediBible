// Additional Bible translations from eBible.org verse-per-line (VPL) files, aligned to the KJV verse index.
//   Input:  public/data/bible.json; data/raw/<id>/vpl/<id>_vpl.txt
//   Output: public/data/<id>.json  { id, short, name, lang, license, source, texts: string[] }
// Verses the KJV numbers differently (e.g. 3 John 1:15, which the KJV includes in 1:14) are appended
// to the last KJV verse of the same chapter, so nothing is dropped.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBibleIndex, outDir, root } from './lib/stepbible.mjs';

const TRANSLATIONS = [
  {
    id: 'tam2017',
    short: 'தமிழ் IRV',
    name: 'இண்டியன் ரிவைஸ்டு வெர்ஸன் (IRV) – Tamil Indian Revised Version',
    lang: 'ta',
    license: '© 2017, 2019 Bridge Connectivity Solutions Pvt. Ltd. CC BY-SA 4.0',
    source: 'https://ebible.org/details.php?id=tam2017',
  },
];

const { bible, chapterStart, verseId } = loadBibleIndex();

for (const t of TRANSLATIONS) {
  const file = join(root, 'data', 'raw', t.id, 'vpl', `${t.id}_vpl.txt`);
  if (!existsSync(file)) { console.log(`skip ${t.id}: ${file} not found`); continue; }
  const texts = new Array(bible.texts.length).fill('');
  const codes = [];
  let extra = 0, bad = 0;
  for (const line of readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(\S+) (\d+):(\d+) (.*)$/);
    if (!m) { bad++; continue; }
    if (!codes.includes(m[1])) codes.push(m[1]); // books appear in canonical order
    const book = codes.indexOf(m[1]);
    const c = Number(m[2]), v = Number(m[3]);
    let id = verseId(book, c, v);
    if (id < 0) {
      // Not a KJV verse: attach to the chapter's last KJV verse.
      const counts = bible.books[book]?.chapters;
      if (!counts || c > counts.length) { bad++; continue; }
      id = chapterStart[book][c - 1] + counts[c - 1] - 1;
      extra++;
    }
    texts[id] = texts[id] ? `${texts[id]} ${m[4].trim()}` : m[4].trim();
  }
  if (codes.length !== 66) throw new Error(`${t.id}: expected 66 books, found ${codes.length}`);
  const empty = texts.filter((x) => !x).length;
  writeFileSync(join(outDir, `${t.id}.json`), JSON.stringify({ ...t, texts }));
  console.log(`${t.id}: verses=${texts.length - empty} empty=${empty} merged=${extra} unreadable=${bad}`);
}
