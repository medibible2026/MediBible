#!/usr/bin/env bash
# Downloads the raw data sources into data/raw (about 120 MB). Run before `npm run data`.
# Licences: see DATA-LICENSES.md.
#   CHECK=1 scripts/fetch-sources.sh   only checks that every URL is reachable
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=data/raw
STEP="https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master"

get() { # url dest
  if [ "${CHECK:-}" = 1 ]; then
    code=$(curl -sIL -o /dev/null -w '%{http_code}' "$1")
    echo "$code  $2"
    [ "$code" = 200 ] || { echo "unreachable: $1" >&2; exit 1; }
    return
  fi
  mkdir -p "$(dirname "$2")"
  echo "downloading $2"
  curl -sSL --fail --retry 3 -o "$2" "$1"
}
enc() { printf '%s' "$1" | sed 's/ /%20/g; s/+/%2B/g'; }

get https://a.openbible.info/data/cross-references.zip "$RAW/cross-references.zip"
get https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json "$RAW/KJV.json"

TA="Translators Amalgamated OT+NT"
get "$STEP/$(enc "$TA/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt")" "$RAW/stepbible/tahot1.txt"
get "$STEP/$(enc "$TA/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt")" "$RAW/stepbible/tahot2.txt"
get "$STEP/$(enc "$TA/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt")" "$RAW/stepbible/tahot3.txt"
get "$STEP/$(enc "$TA/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt")" "$RAW/stepbible/tahot4.txt"
get "$STEP/$(enc "$TA/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt")" "$RAW/stepbible/tagnt1.txt"
get "$STEP/$(enc "$TA/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt")" "$RAW/stepbible/tagnt2.txt"
get "$STEP/$(enc "Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt")" "$RAW/stepbible/tbesh.txt"
get "$STEP/$(enc "Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt")" "$RAW/stepbible/tbesg.txt"

get https://ebible.org/Scriptures/tam2017_vpl.zip "$RAW/tam2017/tam2017_vpl.zip"

if [ "${CHECK:-}" != 1 ]; then
  unzip -o -q "$RAW/cross-references.zip" -d "$RAW/xref"
  unzip -o -q "$RAW/tam2017/tam2017_vpl.zip" -d "$RAW/tam2017/vpl"
  echo "done: sources in $RAW"
fi
