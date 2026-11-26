import { useEffect, useMemo, useState } from 'react';
import {
  Bible, Filters, KIND_INFO, LINK_KINDS, LinkKind, Xrefs, XrefEntry, applyFilters, inCount, incoming, linkKind, osisOf, outCount,
  outgoing, refLabel,
} from '../data';
import { Evidence } from './Evidence';
import { Passage } from '../text';
import { NetworkGraph } from './NetworkGraph';
import { CanonArcs } from './CanonArcs';

type View = 'list' | 'network' | 'arcs';
const VIEW_KEY = 'medibible.xrefView';

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  selected: number;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onGo: (id: number) => void;
  onAdd: (id: number, span: number) => void;
  onLemma: (strong: string) => void;
  activeChainTitle: string | null;
  note: string;
  setNote: (text: string) => void;
}

const VOTE_STEPS = [-100, 0, 1, 5, 10, 25, 50];
const PAGE = 40;

export function XrefPanel({ bible, xrefs, selected, filters, setFilters, onGo, onAdd, onLemma, activeChainTitle, note, setNote }: Props) {
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState(note);
  const [view, setViewState] = useState<View>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as View) || 'list'; } catch { return 'list'; }
  });
  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience only */ }
  };
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  useEffect(() => { setLimit(PAGE); }, [selected, filters]);
  useEffect(() => { setDraft(note); }, [note, selected]);

  const linkKinds = xrefs.links?.kinds;
  const { list, kindCounts } = useMemo(() => {
    const raw = filters.direction === 'out' ? outgoing(xrefs, selected) : incoming(xrefs, selected);
    const allKinds = applyFilters(bible, selected, raw, { ...filters, kinds: LINK_KINDS.join('') });
    const kindCounts: Partial<Record<LinkKind, number>> = {};
    if (linkKinds) for (const e of allKinds) { const k = linkKinds[e.link] as LinkKind; kindCounts[k] = (kindCounts[k] || 0) + 1; }
    return { list: applyFilters(bible, selected, raw, filters, linkKinds), kindCounts };
  }, [bible, xrefs, selected, filters, linkKinds]);

  const toggleKind = (k: LinkKind) => {
    const all = filters.kinds.length === LINK_KINDS.length;
    let next = all ? k : filters.kinds.includes(k) ? filters.kinds.replace(k, '') : filters.kinds + k;
    if (!next) next = LINK_KINDS.join('');
    setFilters({ ...filters, kinds: LINK_KINDS.filter((x) => next.includes(x)).join('') });
  };

  const total = filters.direction === 'out' ? outCount(xrefs, selected) : inCount(xrefs, selected);
  const addLabel = activeChainTitle ? `Add to “${activeChainTitle}”` : 'Add to a new chain';

  return (
    <section className={`panel xrefs${expanded ? ' expanded' : ''}`} aria-label="Cross-references">
      <div className="scroll flush">
      <div className="focus">
        <div className="focus-head">
          <h2>{refLabel(bible, selected)}</h2>
          <button className="btn small" onClick={() => onAdd(selected, 0)} title={addLabel}>+ Chain</button>
        </div>
        <p className="focus-text"><Passage bible={bible} id={selected} /></p>
        <textarea
          className="note"
          placeholder={`Your note on ${refLabel(bible, selected)}…`}
          value={draft}
          rows={draft ? 3 : 1}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== note && setNote(draft)}
        />
      </div>

      <div className="filters" role="group" aria-label="Filters">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={filters.direction === 'out'} onClick={() => setFilters({ ...filters, direction: 'out' })}>
            Points to <span className="count">{outCount(xrefs, selected)}</span>
          </button>
          <button role="tab" aria-selected={filters.direction === 'in'} onClick={() => setFilters({ ...filters, direction: 'in' })}>
            Referenced by <span className="count">{inCount(xrefs, selected)}</span>
          </button>
        </div>
        <label>
          Scope
          <select value={filters.scope} onChange={(e) => setFilters({ ...filters, scope: e.target.value as Filters['scope'] })}>
            <option value="all">Whole Bible</option>
            <option value="ot">Old Testament</option>
            <option value="nt">New Testament</option>
            <option value="cross">Other testament</option>
          </select>
        </label>
        <label>
          Book
          <select value={filters.book} onChange={(e) => setFilters({ ...filters, book: Number(e.target.value) })}>
            <option value={-1}>Any</option>
            {bible.books.map((b, i) => <option key={b.osis} value={i}>{b.name}</option>)}
          </select>
        </label>
        <label title="Community votes on openbible.info; higher means more widely agreed">
          Min. votes
          <select value={filters.minVotes} onChange={(e) => setFilters({ ...filters, minVotes: Number(e.target.value) })}>
            {VOTE_STEPS.map((v) => <option key={v} value={v}>{v <= -100 ? 'All' : `≥ ${v}`}</option>)}
          </select>
        </label>
      </div>

      <div className="list-wrap">
        <div className="view-row">
          <div className="seg" role="tablist" aria-label="View">
            {(['list', 'network', 'arcs'] as View[]).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                {{ list: 'List', network: 'Network', arcs: 'Whole Bible' }[v]}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="btn ghost small" onClick={() => setExpanded(!expanded)} title={expanded ? 'Back to the normal layout (Esc)' : 'Fill the window'}>
            {expanded ? '✕ Close' : '⤢ Expand'}
          </button>
        </div>
        {linkKinds && (
          <div className="kind-bar" role="group" aria-label="Filter by link type">
            {LINK_KINDS.map((k) => (
              <button key={k} className={`kind-chip k-${k}`} aria-pressed={filters.kinds.length < LINK_KINDS.length && filters.kinds.includes(k)}
                disabled={!kindCounts[k]} onClick={() => toggleKind(k)} title={`${KIND_INFO[k].label}: ${KIND_INFO[k].help}`}>
                {KIND_INFO[k].short} <span className="count">{kindCounts[k] || 0}</span>
              </button>
            ))}
            {filters.kinds.length < LINK_KINDS.length && (
              <button className="btn ghost small" onClick={() => setFilters({ ...filters, kinds: LINK_KINDS.join('') })}>Show all</button>
            )}
          </div>
        )}
        {linkKinds && (
          <details className="legend">
            <summary>How are links labelled?</summary>
            <dl>
              {LINK_KINDS.map((k) => (
                <div key={k}><dt><span className={`kind k-${k}`}>{KIND_INFO[k].short}</span> {KIND_INFO[k].label}</dt><dd>{KIND_INFO[k].help}</dd></div>
              ))}
            </dl>
            <p className="muted small-note">Labels are computed automatically from STEPBible’s tagged Hebrew and Greek (TAHOT/TAGNT) and the KJV. They show evidence, not interpretation. Check them before you rely on them.</p>
          </details>
        )}
        {view === 'network' && <NetworkGraph bible={bible} xrefs={xrefs} center={selected} entries={list} filters={filters} onGo={onGo} />}
        {view === 'arcs' && <CanonArcs bible={bible} xrefs={xrefs} center={selected} entries={list} onGo={onGo} tall={expanded} />}
        {view === 'list' && (
          <>
            <p className="muted list-meta">
              Showing {Math.min(limit, list.length)} of {list.length}
              {list.length !== total ? ` (${total} before filters)` : ''} · ranked by votes
            </p>
            {list.length === 0 && <p className="empty">No cross-references match these filters.</p>}
            <ul className="xref-list">
              {list.slice(0, limit).map((e) => (
                <XrefRow key={`${e.target}-${e.span}`} bible={bible} xrefs={xrefs} entry={e} root={selected} parent={selected}
                  filters={filters} depth={0} onGo={onGo} onAdd={onAdd} onLemma={onLemma} />
              ))}
            </ul>
            {list.length > limit && (
              <button className="btn ghost wide" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more</button>
            )}
          </>
        )}
      </div>
      </div>
    </section>
  );
}

interface RowProps {
  bible: Bible;
  xrefs: Xrefs;
  entry: XrefEntry;
  root: number;
  parent: number;
  filters: Filters;
  depth: number;
  onGo: (id: number) => void;
  onAdd: (id: number, span: number) => void;
  onLemma: (strong: string) => void;
}

const MAX_DEPTH = 3;
const CHILDREN = 6;

function XrefRow({ bible, xrefs, entry, root, parent, filters, depth, onGo, onAdd, onLemma }: RowProps) {
  const [open, setOpen] = useState(false);
  const children = useMemo(() => {
    if (!open) return [];
    // Follow onward links from the linked passage, skipping links back to where we came from.
    return applyFilters(bible, entry.target, outgoing(xrefs, entry.target), { ...filters, book: -1, scope: 'all', kinds: LINK_KINDS.join('') })
      .filter((c) => c.target !== root && c.target !== parent && !(root >= c.target && root <= c.target + c.span))
      .slice(0, CHILDREN);
  }, [open, bible, xrefs, entry.target, filters, root, parent]);
  const canExpand = depth < MAX_DEPTH && outCount(xrefs, entry.target) > 0;
  const kind = linkKind(xrefs, entry.link);

  return (
    <li className={`xref depth-${depth}`}>
      <div className="xref-main">
        <button className="xref-ref" onClick={() => onGo(entry.target)} title="Open this passage">
          {refLabel(bible, entry.target, entry.span)}
        </button>
        <span className={`votes${entry.votes >= 25 ? ' strong' : entry.votes < 1 ? ' weak' : ''}`} title="Community votes">
          {entry.votes}
        </span>
        {kind && <span className={`kind k-${kind}`} title={`${KIND_INFO[kind].label}: ${KIND_INFO[kind].help}`}>{KIND_INFO[kind].short}</span>}
        <div className="spacer" />
        {canExpand && (
          <button className="btn ghost small" aria-expanded={open} onClick={() => setOpen(!open)} title="Follow the chain onward">
            {open ? '− Chain' : '+ Follow'}
          </button>
        )}
        <button className="btn ghost small" onClick={() => onAdd(entry.target, entry.span)} title="Add to study chain">＋</button>
      </div>
      <p className="xref-text"><Passage bible={bible} id={entry.target} span={entry.span} /></p>
      <Evidence xrefs={xrefs} link={entry.link} onLemma={onLemma} />
      {open && (
        <ul className="xref-children" aria-label={`Onward from ${osisOf(bible, entry.target)}`}>
          {children.length === 0 && <li className="muted small-note">No further links at this vote level.</li>}
          {children.map((c) => (
            <XrefRow key={`${c.target}-${c.span}`} bible={bible} xrefs={xrefs} entry={c} root={root} parent={entry.target}
              filters={filters} depth={depth + 1} onGo={onGo} onAdd={onAdd} onLemma={onLemma} />
          ))}
        </ul>
      )}
    </li>
  );
}
