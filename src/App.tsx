import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALT_TRANSLATION, Bible, DEFAULT_FILTERS, Filters, Translation, Xrefs, fromOsis, hasTamil, lexEntry, loadConcordance, loadData, loadLexicon, loadLinks, outCount,
  loadTranslation, osisOf, parseRef, searchText, strongBase,
} from './data';
import { TextContext, TextMode } from './text';
import { useWorkbench } from './store';
import { Reader, SearchState, View } from './components/Reader';
import { XrefPanel } from './components/XrefPanel';
import { Workbench } from './components/Workbench';
import { BottomTabs, MobileTab, VerseSheet } from './components/Mobile';
import { About } from './components/About';
import { StatusBar } from './components/StatusBar';

export default function App() {
  const [data, setData] = useState<{ bible: Bible; xrefs: Xrefs } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadData()
      .then((d) => {
        if (!live) return;
        setData(d);
        // Link types are not needed to show the first screen: fetch them afterwards.
        loadLinks()
          .then((links) => live && setData((cur) => (cur ? { ...cur, xrefs: { ...cur.xrefs, links } } : cur)))
          .catch((e) => console.warn('Link types unavailable:', e));
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
  }, []);
  if (error) return <div className="splash"><h1>MediBible</h1><p className="warn">{error}</p></div>;
  if (!data) return <div className="splash"><h1>MediBible</h1><p className="muted">Loading 31,102 verses and 344,794 cross-references…</p></div>;
  return <Main bible={data.bible} xrefs={data.xrefs} />;
}

const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

function idFromHash(bible: Bible): number {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (!h) return -1;
  const id = fromOsis(bible, h);
  if (id >= 0) return id;
  return parseRef(bible, h)?.start ?? -1;
}

function Main({ bible, xrefs }: { bible: Bible; xrefs: Xrefs }) {
  const { wb, actions, saveError } = useWorkbench();
  const [selected, setSelected] = useState(() => {
    const h = idFromHash(bible);
    return h >= 0 ? h : fromOsis(bible, 'John.1.1');
  });
  const [view, setView] = useState<View>({ book: bible.vBook[selected], chapter: bible.vChap[selected] });
  const [history, setHistory] = useState<number[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState | null>(null);
  const [tab, setTabState] = useState<MobileTab>('read');
  const [sheetOpen, setSheetOpen] = useState(false); // phone: actions for the tapped verse
  const [noteSignal, setNoteSignal] = useState(0); // phone: open the note editor on the Cross-refs tab
  const setTab = (t: MobileTab) => { setSheetOpen(false); setTabState(t); };
  const [aboutOpen, setAboutOpen] = useState<false | 'top' | 'offline'>(false);
  const [textMode, setTextModeState] = useState<TextMode>(() => {
    try { return (localStorage.getItem('medibible.textMode') as TextMode) || 'kjv'; } catch { return 'kjv'; }
  });
  const setTextMode = (m: TextMode) => {
    setTextModeState(m);
    try { localStorage.setItem('medibible.textMode', m); } catch { /* per-viewer preference only */ }
  };
  const [alt, setAlt] = useState<Translation | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const ensureAlt = useCallback(async () => {
    try {
      const t = await loadTranslation(ALT_TRANSLATION.id);
      setAlt(t);
      setAltError(null);
      return t;
    } catch (e) {
      setAltError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, []);
  useEffect(() => { if (textMode !== 'kjv' && !alt) ensureAlt(); }, [textMode, alt, ensureAlt]);
  const textPrefs = useMemo(() => ({ mode: textMode, setMode: setTextMode, alt, altError }), [textMode, alt, altError]);

  const go = useCallback((id: number, opts: { push?: boolean; tab?: MobileTab } = {}) => {
    setSelected((cur) => {
      if (opts.push !== false && cur !== id) setHistory((h) => [...h.slice(-99), cur]);
      return id;
    });
    setView({ book: bible.vBook[id], chapter: bible.vChap[id] });
    setSearch(null);
    if (opts.tab && isNarrow()) setTab(opts.tab);
  }, [bible]);

  useEffect(() => {
    try { window.history.replaceState(null, '', `#/${osisOf(bible, selected)}`); } catch { /* sandboxed */ }
    document.title = `MediBible`;
  }, [bible, selected]);

  useEffect(() => {
    const onHash = () => { const id = idFromHash(bible); if (id >= 0) go(id); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [bible, go]);

  const back = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    go(prev, { push: false });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const ref = parseRef(bible, q);
    if (ref) {
      go(ref.start, { tab: ref.wholeChapter ? 'read' : 'links' });
      return;
    }
    if (hasTamil(q)) {
      // Tamil script: search the Tamil translation and make sure it is shown.
      if (textMode === 'kjv') setTextMode('both');
      const t = alt ?? (await ensureAlt());
      if (!t) return;
      setSearch({ query: q, kind: 'text', lang: 'ta', ...searchText(bible, q, 300, t.texts) });
    } else {
      setSearch({ query: q, kind: 'text', lang: 'en', ...searchText(bible, q) });
    }
    if (isNarrow()) setTab('read');
  };

  // Every verse that uses a Hebrew/Greek word (by Strong's number), shown in the reader's results list.
  const showConcordance = async (strong: string) => {
    try {
      const [conc, lex] = await Promise.all([loadConcordance(), loadLexicon()]);
      const base = strongBase(strong);
      const ids = conc[base] ?? [];
      const e = lexEntry(lex, strong);
      setSearch({ query: e ? `${base} ${e[0]} (${e[1]}) “${e[2]}”` : base, kind: 'lemma', results: ids.slice(0, 600), total: ids.length });
      if (isNarrow()) setTab('read');
    } catch {
      setSearch({ query: `${strong}: concordance data is missing. Run "npm run data".`, kind: 'lemma', results: [], total: 0 });
    }
  };

  const activeChain = wb.chains.find((c) => c.id === wb.activeChainId) ?? null;
  const addToChain = (id: number, span: number) => {
    const chainId = activeChain?.id ?? actions.createChain('New chain');
    actions.addStep(chainId, osisOf(bible, id), osisOf(bible, id + span));
  };

  const noteKeys = useMemo(() => new Set(Object.keys(wb.notes)), [wb.notes]);
  const selOsis = osisOf(bible, selected);

  return (
    <TextContext.Provider value={textPrefs}>
    <div className="app" data-tab={tab}>
      <header className="topbar">
        <h1 className="brand">Medi<span>Bible</span></h1>
        <form className="search" onSubmit={submit} role="search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Isa 53:5, “lamb of God” or தமிழ்" aria-label="Search" />
          <button className="btn" type="submit">Go</button>
        </form>
        <button className="btn ghost back-btn" onClick={back} disabled={!history.length} title="Back to previous verse" aria-label="Back to previous verse">‹<span className="btn-label"> Back</span></button>
        <button className="btn ghost about-btn" onClick={() => setAboutOpen('top')} title="About, offline use, sources and licences" aria-label="About, offline use, sources and licences"><span className="btn-label">About</span><span className="btn-icon" aria-hidden="true">i</span></button>
      </header>

      <main className="columns">
        <div className="col col-read">
          <Reader bible={bible} xrefs={xrefs} view={view} setView={setView} selected={selected}
            onSelect={(id) => {
              go(id);
              if (isNarrow()) {
                setSheetOpen(true);
                // The sheet takes room from the reader: keep the tapped verse visible.
                requestAnimationFrame(() => requestAnimationFrame(() =>
                  document.querySelector('.col-read .verse.selected, .col-read .iverse.selected')?.scrollIntoView({ block: 'nearest' })));
              }
            }} noteKeys={noteKeys} search={search} onCloseSearch={() => setSearch(null)}
            onConcordance={showConcordance} onFocusVerse={(id) => go(id)} />
        </div>
        <div className="col col-links">
          <XrefPanel bible={bible} xrefs={xrefs} selected={selected} filters={filters} setFilters={setFilters}
            onGo={(id) => go(id)} onLemma={showConcordance} onAdd={addToChain} activeChainTitle={activeChain?.title ?? null}
            note={wb.notes[selOsis]?.text ?? ''} setNote={(t) => actions.setNote(selOsis, t)} openNoteSignal={noteSignal} />
        </div>
        <div className="col col-study">
          <Workbench bible={bible} xrefs={xrefs} wb={wb} actions={actions} selected={selected}
            onGo={(id) => go(id, { tab: 'links' })} saveError={saveError} />
        </div>
      </main>

      <StatusBar onOpenOffline={() => setAboutOpen('offline')} />
      {sheetOpen && tab === 'read' && !search && (
        <VerseSheet bible={bible} id={selected} linkCount={outCount(xrefs, selected)} hasNote={!!wb.notes[selOsis]}
          onCrossRefs={() => setTab('links')} onAddChain={() => { addToChain(selected, 0); setSheetOpen(false); }}
          onNote={() => { setTab('links'); setNoteSignal((n) => n + 1); }} onClose={() => setSheetOpen(false)} />
      )}
      <footer className="credits">
        Scripture: KJV (public domain)
        {alt && textMode !== 'kjv' && <> · <a href={alt.source} target="_blank" rel="noreferrer">{alt.short}</a> © Bridge Connectivity Solutions, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>}
        {' · '}Cross-references: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
        {xrefs.links && <> · Hebrew/Greek: <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">STEPBible.org</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></>}
        {' · '}Data adapted by MediBible · <button className="linklike" onClick={() => setAboutOpen('top')}>About &amp; licences</button>
      </footer>
      <BottomTabs tab={tab} setTab={setTab} linkCount={outCount(xrefs, selected)} />
      {aboutOpen && <About onClose={() => setAboutOpen(false)} focusOffline={aboutOpen === 'offline'} />}
    </div>
    </TextContext.Provider>
  );
}
