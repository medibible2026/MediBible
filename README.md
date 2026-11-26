# MediBible

A study tool for theologians built on 344,794 Bible cross-references (Treasury of Scripture Knowledge, ranked by openbible.info community votes) and the KJV text.

## Run it

```
npm install
npm run dev        # http://localhost:5173
```

`public/data/` is generated from the raw downloads in `data/raw/`. Neither is committed. To get the sources and build the data:

```
bash scripts/fetch-sources.sh   # about 120 MB; CHECK=1 only tests the URLs
npm run data
```

Raw sources:
- `data/raw/xref/cross_references.txt` from https://a.openbible.info/data/cross-references.zip (CC BY)
- `data/raw/KJV.json` from https://github.com/scrollmapper/bible_databases (`formats/json/KJV.json`, public domain)
- `data/raw/stepbible/` from https://github.com/STEPBible/STEPBible-Data (CC BY 4.0): `tahot1-4.txt` (TAHOT Gen-Deu, Jos-Est, Job-Sng, Isa-Mal), `tagnt1-2.txt` (TAGNT Mat-Jhn, Act-Rev), `tbesh.txt`, `tbesg.txt`
- `data/raw/tam2017/vpl/tam2017_vpl.txt` from https://ebible.org/Scriptures/tam2017_vpl.zip: Tamil Indian Revised Version (IRV), © 2017, 2019 Bridge Connectivity Solutions, CC BY-SA 4.0

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
- **Interlinear reader** (KJV / Interlinear toggle in the reader): every Hebrew (Leningrad Codex) and Greek word under the KJV verse, with transliteration, gloss and Strong's number. Hebrew reads right to left. For the NT you can switch the Greek text between the **TR** (behind the KJV) and **NA28**; the edition flags come from TAGNT's editions column, so bracketed passages such as Mark 16:9–20 appear in both.
  - Click a word for its dictionary form, grammar in plain English (e.g. "verb, Qal, sequential imperfect (wayyiqtol), 3rd person masculine singular"), the STEPBible definition, and **every verse that uses it** (a concordance by Strong's number).
  - The Hebrew/Greek word chips on cross-references open the same concordance.
- **Tamil**: a translation picker (KJV / தமிழ் IRV / KJV + தமிழ் IRV) applies everywhere verses appear: reader, interlinear, cross-references, graph tooltips, chains and Markdown export. Typing Tamil in search searches the Tamil text. The Tamil IRV is CC BY-SA 4.0, so material shared from it must carry the same license. The Tamil Old Version (TAOVBSI) is not included: it is © Bible Society of India and needs their written permission for full-text use.
- **Chains**: ordered study paths with a note on each step. Export as Markdown.
- **Connect**: finds the shortest chains of cross-references between two passages (e.g. Gen 3:15 → Rev 12:9).
- **Notes** on any verse, and a JSON **backup**/restore. Everything is stored in this browser only.

## Code map

- `scripts/build-data.mjs`: raw data → compact JSON
- `scripts/build-links.mjs`: classifies every link from the STEPBible tagging (→ `public/data/links.json`)
- `scripts/build-interlinear.mjs`: per-book word data, lexicon, definitions and concordance (→ `public/data/interlinear/`, `lexicon.json`, `defs-*.json`, `concordance.json`)
- `scripts/build-translations.mjs`: eBible.org verse-per-line translations aligned to the KJV verse index (→ `public/data/tam2017.json`)
- `src/text.tsx`: translation setting shared across the app (`Passage`, `TextModeSelect`)
- `scripts/lib/xrefs-format.mjs`, `scripts/lib/links-format.mjs`: compact column formats for cross-references and link evidence (decoded in `src/data.ts`). A link's id is its position in canonical order (by source, then target verse).
- `scripts/lib/stepbible.mjs`: shared STEPBible readers and KJV versification mapping
- `src/morph.ts`: Hebrew (OSHB) and Greek (Robinson) grammar codes to plain English
- `src/data.ts`: data model, reference parser, search, path finder
- `src/store.ts`: notes and chains (localStorage)
- `src/components/`: Reader, WordPanel, XrefPanel, Evidence, NetworkGraph, CanonArcs, Workbench

## Publishing (free hosting on GitHub Pages)

`.github/workflows/deploy.yml` runs on every push to `main`. It downloads the sources (cached between runs), runs `npm run data` and `npm run build`, and publishes `dist/` (about 63 MB) to GitHub Pages.

One-time setup: in the repository on GitHub, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. The site is then served at `https://<owner>.github.io/MediBible/`.

## Licence

- **Code:** MIT. See [LICENSE](LICENSE).
- **Data:** each source keeps its own licence: KJV public domain, OpenBible.info and STEPBible CC BY 4.0, Tamil IRV CC BY-SA 4.0. [DATA-LICENSES.md](DATA-LICENSES.md) lists the sources, licence links and the changes MediBible makes. The app shows the same information under **About**.
- **Bundled libraries:** `npm run build` writes their licences to `THIRD_PARTY_NOTICES.txt`.

