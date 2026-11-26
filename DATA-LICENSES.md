# Data sources and licences

MediBible's **code** is MIT-licensed (see `LICENSE`). The **data** it shows comes from the sources below. Each keeps its own licence. The build scripts download each source and transform it into the files under `public/data/`. Those files are adaptations, distributed under the same licence as their source.

| Data | Source | Licence | Changes made by MediBible | Files |
|---|---|---|---|---|
| King James Version (1769) | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Public domain (see note) | Whitespace normalised; repackaged as one verse array | `bible.json` |
| Cross-references (≈345,000, with votes) | [OpenBible.info](https://www.openbible.info/labs/cross-references/), derived from the *Treasury of Scripture Knowledge* | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Re-indexed to KJV verses; 5 links to verses the KJV does not number were dropped; sorted by votes | `xrefs.json` |
| Tagged Hebrew OT (TAHOT), tagged Greek NT (TAGNT), brief lexicons (TBESH, TBESG) | [STEPBible.org](https://github.com/STEPBible/STEPBible-Data), Tyndale House, Cambridge | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Mapped to KJV versification; split per book; transliterations simplified; definitions stripped of markup and shortened; concordance compiled; every cross-reference **automatically classified** into link types from shared words (MediBible's own analysis, not STEPBible's) | `interlinear/*.json`, `lexicon.json`, `defs-*.json`, `concordance.json`, `links.json` |
| Tamil Indian Revised Version (தமிழ் IRV) | [eBible.org](https://ebible.org/details.php?id=tam2017), © 2017, 2019 Bridge Connectivity Solutions Pvt. Ltd. | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Aligned to KJV verse numbering; 3 John 1:15 appended to 1:14 | `tam2017.json` |

**Share-alike.** `tam2017.json`, and anything else built from the Tamil IRV text, must be shared under CC BY-SA 4.0.

**KJV note.** The King James Version is in the public domain in most of the world. In the United Kingdom, rights in the Authorized Version are vested in the Crown and administered by Cambridge University Press under letters patent.

**Not included.** The Tamil Old Version (TAOVBSI) is © The Bible Society of India, with all rights reserved. It is not part of MediBible.

**Link types and graphs** are generated automatically from the data above. They show evidence (shared words or wording), not interpretation, and they are not endorsed by any of the sources.

**Third-party code** bundled in the web app (React, d3-force and their dependencies) is listed with its licences in `THIRD_PARTY_NOTICES.txt`, which is generated at build time.
