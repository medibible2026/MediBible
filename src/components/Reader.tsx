import { useEffect, useRef } from 'react';
import { Bible, Xrefs, osisOf, outCount, refLabel } from '../data';

export interface View {
  book: number;
  chapter: number;
}

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  view: View;
  setView: (v: View) => void;
  selected: number;
  onSelect: (id: number) => void;
  noteKeys: Set<string>;
  search: { query: string; results: number[]; total: number } | null;
  onCloseSearch: () => void;
}

export function Reader({ bible, xrefs, view, setView, selected, onSelect, noteKeys, search, onCloseSearch }: Props) {
  const selRef = useRef<HTMLButtonElement | null>(null);
  const book = bible.books[view.book];
  const first = bible.chapterStart[view.book][view.chapter - 1];
  const count = book.chapters[view.chapter - 1];

  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected, view.book, view.chapter]);

  const step = (d: number) => {
    let b = view.book, c = view.chapter + d;
    if (c < 1) { b = Math.max(0, b - 1); c = b === view.book ? 1 : bible.books[b].chapters.length; }
    else if (c > book.chapters.length) { b = Math.min(bible.books.length - 1, b + 1); c = b === view.book ? book.chapters.length : 1; }
    setView({ book: b, chapter: c });
  };

  if (search) {
    return (
      <section className="panel reader" aria-label="Search results">
        <div className="panel-head">
          <h2>“{search.query.replace(/"/g, '')}”</h2>
          <span className="muted">{search.total.toLocaleString()} verses{search.total > search.results.length ? ` (first ${search.results.length})` : ''}</span>
          <button className="btn ghost" onClick={onCloseSearch}>Back to reading</button>
        </div>
        <div className="scroll">
          {search.results.length === 0 && <p className="empty">No verses match. Try fewer words, or a reference like “Isa 53:5”.</p>}
          <ol className="results">
            {search.results.map((id) => (
              <li key={id}>
                <button className="result" onClick={() => onSelect(id)}>
                  <span className="ref">{refLabel(bible, id)}</span>
                  <span className="scripture">{highlight(bible.texts[id], search.query)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="panel reader" aria-label="Bible reader">
      <div className="panel-head">
        <select aria-label="Book" value={view.book} onChange={(e) => setView({ book: Number(e.target.value), chapter: 1 })}>
          {bible.books.map((b, i) => (
            <option key={b.osis} value={i}>{b.name}</option>
          ))}
        </select>
        <select aria-label="Chapter" value={view.chapter} onChange={(e) => setView({ book: view.book, chapter: Number(e.target.value) })}>
          {book.chapters.map((_, i) => (
            <option key={i} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn ghost icon" aria-label="Previous chapter" onClick={() => step(-1)}>‹</button>
        <button className="btn ghost icon" aria-label="Next chapter" onClick={() => step(1)}>›</button>
      </div>
      <div className="scroll">
        <h3 className="chapter-title">{book.name} {view.chapter}</h3>
        <div className="verses">
          {Array.from({ length: count }, (_, i) => {
            const id = first + i;
            const n = outCount(xrefs, id);
            const isSel = id === selected;
            return (
              <button
                key={id}
                ref={isSel ? selRef : undefined}
                className={`verse${isSel ? ' selected' : ''}`}
                onClick={() => onSelect(id)}
                aria-pressed={isSel}
              >
                <sup className="vnum">{i + 1}</sup>
                <span className="scripture">{bible.texts[id]}</span>
                <span className="vmeta">
                  {noteKeys.has(osisOf(bible, id)) && <span className="dot" title="Has a note" />}
                  {n > 0 && <span className="badge" title={`${n} cross-references`}>{n}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function highlight(text: string, query: string) {
  const isPhrase = query.trim().startsWith('"');
  const clean = query.replace(/"/g, '').trim();
  const terms = isPhrase ? [clean] : clean.split(/\s+/).filter((t) => t.length > 2);
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
