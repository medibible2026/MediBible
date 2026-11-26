// Word-by-word Hebrew/Greek data for the interlinear reader, plus lexicon and concordance.
//   Input:  public/data/bible.json; data/raw/stepbible/* (STEPBible.org, CC BY 4.0)
//   Output: public/data/interlinear/<OSIS>.json  { verses: { [verseId]: Word[] } }
//             Word = [form, translit, gloss, dStrong, morph, flags]
//             flags: 1 = in NA27/28, 2 = in TR (underlies KJV), 4 = Hebrew qere (read) form
//           public/data/lexicon.json   { [dStrong]: [lemma, translit, gloss, pos] }
//           public/data/defs-H.json, defs-G.json   { [dStrong]: short definition }
//           public/data/concordance.json   { [Strong's base number]: [verseId, ...] }
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseOf, forEachWord, loadBibleIndex, loadLexicon, outDir, wordTags } from './lib/stepbible.mjs';

const index = loadBibleIndex();
const { bible, vBook } = index;
const { lexicon } = loadLexicon();

const byBook = bible.books.map(() => ({}));
const concordance = new Map(); // base strong -> Set<verse>
const used = new Set();
let words = 0, skipped = 0;

const clean = (s) => (s || '').replace(/[/\\]/g, '').trim();

forEachWord(index, (w) => {
  let form, translit, gloss, strong, morph, flags = 0;
  if (w.isGreek) {
    // The editions column lists where the word is printed. NA28 prints bracketed passages
    // (Mark 16:9-20, John 7:53-8:11) whose type code omits "N", so prefer this column.
    const eds = w.cols[5] || '';
    if (eds) {
      if (/\bNA2[78]\b/.test(eds)) flags |= 1;
      if (/\bTR\b/.test(eds)) flags |= 2;
    } else {
      const t = w.type.replace(/[()]/g, '');
      if (/n/i.test(t)) flags |= 1;
      if (/k/i.test(t)) flags |= 2;
    }
    if (!flags) { skipped++; return; } // only in other editions
    const m = (w.cols[1] || '').match(/^(.*?)\s*\((.*)\)\s*$/);
    form = m ? m[1] : w.cols[1];
    translit = m ? m[2] : '';
    gloss = (w.cols[2] || '').trim();
    [strong, morph = ''] = (w.cols[3] || '').split('=');
  } else {
    if (w.type.includes('L')) flags = 0;
    else if (w.type.startsWith('Q')) flags = 4;
    else { skipped++; return; } // readings from other manuscripts
    form = clean(w.cols[1]);
    translit = clean(w.cols[2]).replace(/\./g, '').toLowerCase();
    gloss = (w.cols[3] || '').replace(/\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
    strong = wordTags(w)[0] || '';
    morph = (w.cols[5] || '').trim();
  }
  const verses = byBook[vBook[w.id]];
  (verses[w.id] ||= []).push([form, translit, gloss, strong, morph, flags]);
  words++;
  for (const t of wordTags(w)) {
    if (!/^[HG]\d{4}/.test(t)) continue;
    used.add(t);
    const b = baseOf(t);
    if (!concordance.has(b)) concordance.set(b, new Set());
    concordance.get(b).add(w.id);
  }
});

mkdirSync(join(outDir, 'interlinear'), { recursive: true });
bible.books.forEach((b, i) => {
  writeFileSync(join(outDir, 'interlinear', `${b.osis}.json`), JSON.stringify({ book: b.osis, verses: byBook[i] }));
});

// Lexicon: every entry (tags can fall back to their base number), definitions split by language.
const lex = {};
const defs = { H: {}, G: {} };
const stripHtml = (s) => s
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/__/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
for (const [d, e] of lexicon) {
  lex[d] = [e.lemma, e.translit, e.gloss, e.pos];
  const def = stripHtml(e.def);
  if (def) defs[d[0]][d] = def.length > 900 ? `${def.slice(0, 900).replace(/\s\S*$/, '')} …` : def;
}
writeFileSync(join(outDir, 'lexicon.json'), JSON.stringify(lex));
writeFileSync(join(outDir, 'defs-H.json'), JSON.stringify(defs.H));
writeFileSync(join(outDir, 'defs-G.json'), JSON.stringify(defs.G));

const conc = {};
for (const [b, set] of concordance) conc[b] = [...set].sort((x, y) => x - y);
writeFileSync(join(outDir, 'concordance.json'), JSON.stringify(conc));

const missingLex = [...used].filter((d) => !lexicon.has(d) && !lexicon.has(baseOf(d)));
console.log(`words=${words} skipped=${skipped} lexicon=${Object.keys(lex).length} concordance=${concordance.size} missingLexicon=${missingLex.length} ${missingLex.slice(0, 8).join(' ')}`);
