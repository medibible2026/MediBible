# MediBible

A study tool for theologians built on 344,794 Bible cross-references (Treasury of Scripture Knowledge, ranked by openbible.info community votes) and the KJV text.

## Run it

```
npm install
npm run dev        # http://localhost:5173
```

`public/data/` is generated from the raw downloads in `data/raw/` (not committed):

```
npm run data
```

Raw sources:
- `data/raw/xref/cross_references.txt` from https://a.openbible.info/data/cross-references.zip (CC BY)
- `data/raw/KJV.json` from https://github.com/scrollmapper/bible_databases (`formats/json/KJV.json`, public domain)
- `data/raw/stepbible/` from https://github.com/STEPBible/STEPBible-Data (CC BY 4.0): `tahot1-4.txt` (TAHOT Gen-Deu, Jos-Est, Job-Sng, Isa-Mal), `tagnt1-2.txt` (TAGNT Mat-Jhn, Act-Rev), `tbesh.txt`, `tbesg.txt`

## Features (MVP)

- **Reader**: book/chapter navigation; each verse shows how many cross-references it has. Search by reference (`Isa 53:5`, `1 cor 13:4-7`, `Ps 23`) or by words (`"lamb of god"` for an exact phrase).
- **Cross-references**: "Points to" and "Referenced by" lists, ranked by votes, filtered by scope (OT/NT/other testament), book, and minimum votes. **+ Follow** expands links onward, up to 3 levels.
- **Link types with evidence**: each cross-reference is labelled by what the two passages share, filterable by chips:
  - *Parallel*: same language, most content words shared (Kings and Chronicles, the Synoptic Gospels)
  - *Wording*: 5+ identical KJV words (quotations, formulas)
  - *Word*: a shared uncommon Hebrew or Greek dictionary word, shown with transliteration and gloss
  - *Heb↔Grk*: Old↔New Testament links where a Greek word renders a Hebrew word in the other passage. Pairs are marked `LXX` (from Abbott-Smith's Septuagint notes) or `gloss` (shared STEPBible meaning)
  - *English*: only an uncommon KJV word is shared
  - *Thematic*: no shared wording; the link rests on the TSK editors' judgment
  Rarity is judged per testament (a word counts if it appears in no more than 4% of verses; 2% for Heb↔Grk). Pronouns, particles, prepositions and conjunctions are ignored.
- **Graph views** (List / Network / Whole Bible toggle on the cross-reference panel, with **⤢ Expand** to fill the window). Both views follow the current filters.
  - *Network*: the selected verse and its top 10–45 links, colored by link type, plus dashed links between the neighbours to show clusters. An "onward links" option adds a second ring. Click a passage to recenter on it.
  - *Whole Bible*: an arc diagram of the canon, in the style of Harrison & Römhild. The selected verse's links are drawn in color over a faint background of the most-voted links. Click anywhere to open that chapter or linked passage.
- **Chains**: ordered study paths with a note on each step. Export as Markdown.
- **Connect**: finds the shortest chains of cross-references between two passages (e.g. Gen 3:15 → Rev 12:9).
- **Notes** on any verse, and a JSON **backup**/restore. Everything is stored in this browser only.

## Code map

- `scripts/build-data.mjs`: raw data → compact JSON
- `scripts/build-links.mjs`: classifies every link from the STEPBible tagging (→ `public/data/links.json`)
- `src/data.ts`: data model, reference parser, search, path finder
- `src/store.ts`: notes and chains (localStorage)
- `src/components/`: Reader, XrefPanel, Evidence, Workbench
