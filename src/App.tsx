import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ALT_TRANSLATION, Bible, DEFAULT_FILTERS, Filters, Translation, Xrefs, fromOsis, hasTamil, lexEntry, loadConcordance, loadData, loadLexicon,
  loadTranslation, osisOf, parseRef, searchText, strongBase,
} from './data';
import { TextContext, TextMode } from './text';
import { useWorkbench } from './store';
import { Reader, SearchState, View } from './components/Reader';
import { XrefPanel } from './components/XrefPanel';
import { Workbench } from './components/Workbench';
import { About } from './components/About';

export default function App() {
  const [data, setData] = useState<{ bible: Bible; xrefs: Xrefs } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadData().then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error) return <div className="splash"><h1>MediBible</h1><p className="warn">{error}</p></div>;
  if (!data) return <div className="splash"><h1>MediBible</h1><p className="muted">Loading 31,102 verses and 344,794 cross-references…</p></div>;
  return <Main bible={data.bible} xrefs={data.xrefs} />;
}

type MobileTab = 'read' | 'links' | 'study';
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
  const [tab, setTab] = useState<MobileTab>('read');
  const [aboutOpen, setAboutOpen] = useState(false);
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference (Isa 53:5), words (“lamb of God”) or தமிழ்" aria-label="Search" />
          <button className="btn" type="submit">Go</button>
        </form>
        <button className="btn ghost" onClick={back} disabled={!history.length} title="Back to previous verse">‹ Back</button>
        <button className="btn ghost about-btn" onClick={() => setAboutOpen(true)} title="About, sources and licences">About</button>
      </header>

      <nav className="mobile-tabs seg" role="tablist">
        {(['read', 'links', 'study'] as MobileTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {{ read: 'Read', links: 'Cross-refs', study: 'Study' }[t]}
          </button>
        ))}
      </nav>

      <main className="columns">
        <div className="col col-read">
          <Reader bible={bible} xrefs={xrefs} view={view} setView={setView} selected={selected}
            onSelect={(id) => go(id, { tab: 'links' })} noteKeys={noteKeys} search={search} onCloseSearch={() => setSearch(null)}
            onConcordance={showConcordance} onFocusVerse={(id) => go(id)} />
        </div>
        <div className="col col-links">
          <XrefPanel bible={bible} xrefs={xrefs} selected={selected} filters={filters} setFilters={setFilters}
            onGo={(id) => go(id)} onLemma={showConcordance} onAdd={addToChain} activeChainTitle={activeChain?.title ?? null}
            note={wb.notes[selOsis]?.text ?? ''} setNote={(t) => actions.setNote(selOsis, t)} />
        </div>
        <div className="col col-study">
          <Workbench bible={bible} xrefs={xrefs} wb={wb} actions={actions} selected={selected}
            onGo={(id) => go(id, { tab: 'links' })} saveError={saveError} />
        </div>
      </main>

      <footer className="credits">
        Scripture: KJV (public domain)
        {alt && textMode !== 'kjv' && <> · <a href={alt.source} target="_blank" rel="noreferrer">{alt.short}</a> © Bridge Connectivity Solutions, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>}
        {' · '}Cross-references: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">OpenBible.info</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
        {xrefs.links && <> · Hebrew/Greek: <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">STEPBible.org</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></>}
        {' · '}Data adapted by MediBible · <button className="linklike" onClick={() => setAboutOpen(true)}>About &amp; licences</button>
      </footer>
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
    </div>
    </TextContext.Provider>
  );
}
