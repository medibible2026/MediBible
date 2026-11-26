import { useEffect, useRef, useState } from 'react';
import { Bible, IWord, OT_BOOKS, Xrefs, loadInterlinear, osisOf, outCount, refLabel } from '../data';
import { WordPanel } from './WordPanel';
import { Passage, TextModeSelect, useTextPrefs } from '../text';

export interface View {
  book: number;
  chapter: number;
}

export interface SearchState {
  query: string;
  results: number[];
  total: number;
  kind?: 'text' | 'lemma';
  lang?: 'en' | 'ta'; // which translation was searched
}

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  view: View;
  setView: (v: View) => void;
  selected: number;
  onSelect: (id: number) => void;
  noteKeys: Set<string>;
  search: SearchState | null;
  onCloseSearch: () => void;
  onConcordance: (strong: string) => void;
  onFocusVerse: (id: number) => void; // select without leaving the reader (phones)
}

type Mode = 'text' | 'interlinear';
type GreekText = 'tr' | 'na';

// Per-viewer display preferences; the page works without storage.
const pref = <T extends string>(key: string, fallback: T): T => {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
};
const savePref = (key: string, v: string) => {
  try { localStorage.setItem(key, v); } catch { /* ignore */ }
};

export function Reader({ bible, xrefs, view, setView, selected, onSelect, noteKeys, search, onCloseSearch, onConcordance, onFocusVerse }: Props) {
  const selRef = useRef<HTMLElement | null>(null);
  const [mode, setModeState] = useState<Mode>(() => pref<Mode>('medibible.readerMode', 'text'));
  const [greekText, setGreekState] = useState<GreekText>(() => pref<GreekText>('medibible.greekText', 'tr'));
  const setMode = (m: Mode) => { setModeState(m); savePref('medibible.readerMode', m); };
  const setGreek = (g: GreekText) => { setGreekState(g); savePref('medibible.greekText', g); };
  const [inter, setInter] = useState<{ osis: string; verses: Record<string, IWord[]> } | null>(null);
  const [interError, setInterError] = useState<string | null>(null);
  const [word, setWord] = useState<{ verse: number; index: number; w: IWord } | null>(null);

  const { alt } = useTextPrefs();
  const book = bible.books[view.book];
  const first = bible.chapterStart[view.book][view.chapter - 1];
  const count = book.chapters[view.chapter - 1];
  const isHebrew = view.book < OT_BOOKS;

  useEffect(() => {
    if (mode !== 'interlinear' || inter?.osis === book.osis) return;
    let live = true;
    setInterError(null);
    loadInterlinear(book.osis)
      .then((d) => live && setInter({ osis: book.osis, verses: d.verses }))
      .catch((e) => live && setInterError(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, [mode, book.osis, inter?.osis]);

  useEffect(() => { setWord(null); }, [view.book, view.chapter, mode]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastChapter = useRef('');
  useEffect(() => {
    // Keep the selected verse in view: centred on load or a new chapter, minimal movement within one.
    // (Instant, so a later adjustment, e.g. when the phone's verse sheet opens, is not overridden.)
    // A chapter without the selected verse starts at the top.
    const key = `${view.book}.${view.chapter}`;
    const sameChapter = lastChapter.current === key;
    lastChapter.current = key;
    if (selRef.current) selRef.current.scrollIntoView({ block: sameChapter ? 'nearest' : 'center' });
    else scrollRef.current?.scrollTo({ top: 0 });
  }, [selected, view.book, view.chapter]);

  // Swipe left/right on the text to change chapter (phones and tablets).
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x, dy = p.clientY - start.y;
    if (Date.now() - start.t < 700 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.5) step(dx < 0 ? 1 : -1);
  };

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
          <h2>{search.kind === 'lemma' ? search.query : `“${search.query.replace(/"/g, '')}”`}</h2>
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
                  {search.lang === 'ta' && alt
                    ? <span className="scripture lang-ta" lang="ta">{highlight(alt.texts[id], search.query)}</span>
                    : search.kind === 'lemma' ? <Passage bible={bible} id={id} /> : <span className="scripture">{highlight(bible.texts[id], search.query)}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const interReady = mode === 'interlinear' && inter?.osis === book.osis;
  const showWords = (ws: IWord[]) => (isHebrew ? ws : ws.filter((w) => w[5] & (greekText === 'tr' ? 2 : 1)));

  return (
    <section className="panel reader" aria-label="Bible reader">
      <div className="panel-head reader-head">
        <div className="head-row">
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
        <span className="nav-arrows">
          <button className="btn ghost icon" aria-label="Previous chapter" onClick={() => step(-1)}>‹</button>
          <button className="btn ghost icon" aria-label="Next chapter" onClick={() => step(1)}>›</button>
        </span>
        </div>
        <div className="head-row head-modes">
        <div className="seg" role="tablist" aria-label="Reading mode">
          <button role="tab" aria-selected={mode === 'text'} onClick={() => setMode('text')}>Text</button>
          <button role="tab" aria-selected={mode === 'interlinear'} onClick={() => setMode('interlinear')}>Interlinear</button>
        </div>
        <TextModeSelect />
        {mode === 'interlinear' && !isHebrew && (
          <select aria-label="Greek text" value={greekText} onChange={(e) => setGreek(e.target.value as GreekText)}
            title="TR: the Textus Receptus behind the KJV. NA: the modern critical text (Nestle-Aland 27/28).">
            <option value="tr">Greek: TR</option>
            <option value="na">Greek: NA28</option>
          </select>
        )}
        </div>
      </div>
      <div className="scroll" ref={scrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <h3 className="chapter-title">{book.name} {view.chapter}</h3>
        {mode === 'interlinear' && !interReady && (
          interError ? <p className="warn">{interError}</p> : <p className="muted">Loading {isHebrew ? 'Hebrew' : 'Greek'} text for {book.name}…</p>
        )}
        <div className={`verses${interReady ? ' interlinear' : ''}`}>
          {Array.from({ length: count }, (_, i) => {
            const id = first + i;
            const n = outCount(xrefs, id);
            const isSel = id === selected;
            const meta = (
              <span className="vmeta">
                {noteKeys.has(osisOf(bible, id)) && <span className="dot" title="Has a note" />}
                {n > 0 && <span className="badge" title={`${n} cross-references`}>{n}</span>}
              </span>
            );
            if (!interReady) {
              return (
                <button key={id} ref={isSel ? (el) => { selRef.current = el; } : undefined}
                  className={`verse${isSel ? ' selected' : ''}`} onClick={() => onSelect(id)} aria-pressed={isSel}>
                  <sup className="vnum">{i + 1}</sup>
                  <Passage bible={bible} id={id} />
                  {meta}
                </button>
              );
            }
            const words = showWords(inter!.verses[id] ?? []);
            return (
              <div key={id} ref={isSel ? (el) => { selRef.current = el; } : undefined} className={`iverse${isSel ? ' selected' : ''}`}>
                <button className="verse" onClick={() => onSelect(id)} aria-pressed={isSel}>
                  <sup className="vnum">{i + 1}</sup>
                  <Passage bible={bible} id={id} className="kjv-line" />
                  {meta}
                </button>
                <div className={`words ${isHebrew ? 'heb' : 'grk'}`} dir={isHebrew ? 'rtl' : 'ltr'}>
                  {words.length === 0 && <span className="muted small-note">No tagged words for this verse.</span>}
                  {words.map((w, k) => {
                    const active = word?.verse === id && word.index === k;
                    return (
                      <button key={k} className={`word${active ? ' active' : ''}${w[5] & 4 ? ' qere' : ''}`}
                        onClick={() => { setWord({ verse: id, index: k, w }); if (!isSel) onFocusVerse(id); }}
                        aria-label={`${w[0]}, ${w[1]}, “${w[2]}”`}>
                        <bdi lang={isHebrew ? 'he' : 'grc'} className={`w-orig orig ${isHebrew ? 'heb' : 'grk'}`}>{w[0]}</bdi>
                        <span className="w-translit">{w[1]}</span>
                        <span className="w-gloss" dir="ltr">{w[2]}</span>
                        <span className="w-strong" dir="ltr">{w[3]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {interReady && (
          <p className="muted small-note credits-inline">
            {isHebrew ? 'Hebrew: Leningrad Codex via STEPBible TAHOT.' : `Greek: ${greekText === 'tr' ? 'Textus Receptus words' : 'NA27/28 words'} via STEPBible TAGNT.`} CC BY 4.0. Click a word for its grammar, definition and every verse that uses it.
          </p>
        )}
      </div>
      {word && (
        <WordPanel word={word.w} where={`${refLabel(bible, word.verse)}, word ${word.index + 1}`} onClose={() => setWord(null)}
          onConcordance={onConcordance} />
      )}
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
