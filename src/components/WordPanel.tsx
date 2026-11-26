import { useEffect, useState } from 'react';
import { IWord, LexEntry, lexEntry, loadConcordance, loadDefinitions, loadLexicon, strongBase } from '../data';
import { describeMorph } from '../morph';

interface Props {
  word: IWord;
  where: string; // e.g. "Genesis 1:1, word 1"
  onClose: () => void;
  onConcordance: (strong: string) => void;
}

/** Details for one Hebrew/Greek word: dictionary form, grammar, definition, occurrences. */
export function WordPanel({ word, where, onClose, onConcordance }: Props) {
  const [form, translit, gloss, strong, morph, flags] = word;
  const hebrew = strong.startsWith('H');
  const [entry, setEntry] = useState<LexEntry | null>(null);
  const [def, setDef] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setEntry(null); setDef(null); setCount(null); setError(false);
    loadLexicon().then((lex) => live && setEntry(lexEntry(lex, strong))).catch(() => live && setError(true));
    loadDefinitions(hebrew ? 'H' : 'G').then((d) => live && setDef(d[strong] ?? d[strongBase(strong)] ?? '')).catch(() => live && setError(true));
    loadConcordance().then((c) => live && setCount(c[strongBase(strong)]?.length ?? 0)).catch(() => live && setError(true));
    return () => { live = false; };
  }, [strong, hebrew]);

  const edition = !hebrew && flags !== 3 ? (flags === 1 ? 'Only in the critical text (NA27/28), not in the TR behind the KJV.' : 'Only in the Textus Receptus (behind the KJV), not in NA27/28.') : null;

  return (
    <aside className="word-panel" aria-label="Word details">
      <div className="row">
        <bdi lang={hebrew ? 'he' : 'grc'} className={`wp-form orig ${hebrew ? 'heb' : 'grk'}`}>{form}</bdi>
        <span className="wp-translit">{translit}</span>
        <div className="spacer" />
        <button className="btn ghost icon small" onClick={onClose} aria-label="Close word details">✕</button>
      </div>
      <p className="muted small-note">{where} · translated here as <b>“{gloss}”</b></p>
      {flags & 4 ? <p className="muted small-note">Qere: the form read aloud in place of the written (ketiv) form.</p> : null}
      {edition && <p className="warn small-note">{edition}</p>}

      <dl className="wp-facts">
        <dt>Dictionary form</dt>
        <dd>
          {entry ? (
            <><bdi lang={hebrew ? 'he' : 'grc'} className={`orig ${hebrew ? 'heb' : 'grk'}`}>{entry[0]}</bdi> <i>{entry[1]}</i> “{entry[2]}”</>
          ) : error ? '—' : '…'}
        </dd>
        <dt>Strong’s</dt>
        <dd>{strong}{strong !== strongBase(strong) && <span className="muted"> (meaning variant of {strongBase(strong)})</span>}</dd>
        <dt>Grammar</dt>
        <dd>{describeMorph(morph) || '—'} <span className="muted small-note">{morph}</span></dd>
      </dl>

      <button className="btn wide-btn" disabled={!count} onClick={() => onConcordance(strong)}>
        {count === null ? 'Counting occurrences…' : `All ${count.toLocaleString()} verses with ${strongBase(strong)}`}
      </button>

      {def === null && !error && <p className="muted small-note">Loading definition…</p>}
      {def && (
        <details className="wp-def" open>
          <summary>Definition</summary>
          <p>{def}</p>
          <p className="muted small-note">{hebrew ? 'STEPBible TBESH (brief lexicon of extended Strong’s for Hebrew)' : 'STEPBible TBESG, based on Abbott-Smith’s Manual Greek Lexicon'} · CC BY 4.0</p>
        </details>
      )}
      {error && <p className="warn small-note">Lexicon data is missing. Run “npm run data”.</p>}
    </aside>
  );
}
