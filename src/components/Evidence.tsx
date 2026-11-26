import { Lemma, Xrefs, linkEvidence, linkKind } from '../data';

/** The evidence behind one cross-reference: shared phrase, shared Hebrew/Greek words, LXX pairs, English echoes. */
export function Evidence({ xrefs, link }: { xrefs: Xrefs; link: number }) {
  const ev = linkEvidence(xrefs, link);
  const lemmas = xrefs.links?.lemmas;
  if (!ev || !lemmas) return null;
  // English echoes add little next to a shared phrase, but often name the key word ("lamb") otherwise.
  const showEnglish = ev.e && (!ev.p || linkKind(xrefs, link) === 'E');
  if (!ev.p && !ev.w && !ev.l && !showEnglish) return null;

  return (
    <div className="evidence">
      {ev.p && <span className="ev-phrase" title="Identical KJV wording">“{ev.p}”</span>}
      {ev.w?.map((i) => <LemmaChip key={i} l={lemmas[i]} />)}
      {ev.l?.map(([g, h, src]) => (
        <span key={`${g}-${h}`} className="ev-pair">
          <LemmaChip l={lemmas[g]} />
          <span className="ev-arrow" aria-label="corresponds to">↔</span>
          <LemmaChip l={lemmas[h]} />
          <span className="ev-src" title={src === 0 ? 'Abbott-Smith lists this Hebrew word among those the Septuagint renders with the Greek word' : 'The STEPBible glosses of both words share a meaning'}>
            {src === 0 ? 'LXX' : 'gloss'}
          </span>
        </span>
      ))}
      {showEnglish && <span className="ev-eng" title="Shared uncommon KJV word(s)">KJV: {ev.e!.join(', ')}</span>}
    </div>
  );
}

function LemmaChip({ l }: { l: Lemma }) {
  const hebrew = l.strong.startsWith('H');
  return (
    <span className="lemma" title={`${l.strong} · ${l.gloss} · in ${l.freq} ${hebrew ? 'Old' : 'New'} Testament verses`}>
      <bdi lang={hebrew ? 'he' : 'grc'} className={`orig ${hebrew ? 'heb' : 'grk'}`}>{l.lemma || l.strong}</bdi>
      {l.translit && <i className="translit">{l.translit}</i>}
      <span className="gloss">{l.gloss}</span>
    </span>
  );
}
