import { useRef, useState } from 'react';
import { Bible, Xrefs, findPaths, fromOsis, osisOf, parseRef, passageText, refLabel } from '../data';
import { Chain, Workbench as WB, WorkbenchActions, validate } from '../store';

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  wb: WB;
  actions: WorkbenchActions;
  selected: number;
  onGo: (id: number) => void;
  saveError: boolean;
}

type Tab = 'chains' | 'connect' | 'notes' | 'data';

export function Workbench({ bible, xrefs, wb, actions, selected, onGo, saveError }: Props) {
  const [tab, setTab] = useState<Tab>('chains');
  return (
    <section className="panel workbench" aria-label="Study workbench">
      <div className="seg tabs" role="tablist">
        {(['chains', 'connect', 'notes', 'data'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {{ chains: 'Chains', connect: 'Connect', notes: 'Notes', data: 'Backup' }[t]}
            {t === 'chains' && wb.chains.length > 0 && <span className="count">{wb.chains.length}</span>}
            {t === 'notes' && Object.keys(wb.notes).length > 0 && <span className="count">{Object.keys(wb.notes).length}</span>}
          </button>
        ))}
      </div>
      {saveError && <p className="warn">This browser is not saving your work. Use Backup to export it.</p>}
      <div className="scroll">
        {tab === 'chains' && <Chains bible={bible} wb={wb} actions={actions} onGo={onGo} />}
        {tab === 'connect' && <Connect bible={bible} xrefs={xrefs} actions={actions} selected={selected} onGo={onGo} onSaved={() => setTab('chains')} />}
        {tab === 'notes' && <Notes bible={bible} wb={wb} onGo={onGo} />}
        {tab === 'data' && <Backup wb={wb} actions={actions} />}
      </div>
    </section>
  );
}

// ---------- Chains ----------

function Chains({ bible, wb, actions, onGo }: { bible: Bible; wb: WB; actions: WorkbenchActions; onGo: (id: number) => void }) {
  const active = wb.chains.find((c) => c.id === wb.activeChainId) ?? null;
  const [newTitle, setNewTitle] = useState('');

  if (active) return <ChainEditor bible={bible} chain={active} actions={actions} onGo={onGo} />;

  return (
    <div className="stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); actions.createChain(newTitle.trim()); setNewTitle(''); }}>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New chain, e.g. “The Passover Lamb”" aria-label="New chain title" />
        <button className="btn" type="submit">Create</button>
      </form>
      {wb.chains.length === 0 && (
        <p className="empty">
          A chain is an ordered study path through Scripture, such as a theme from Genesis to Revelation.
          Use <b>＋</b> on any verse or cross-reference to add it, or let <b>Connect</b> find a path between two passages.
        </p>
      )}
      <ul className="chain-list">
        {wb.chains.map((c) => (
          <li key={c.id}>
            <button className="chain-card" onClick={() => actions.setActive(c.id)}>
              <span className="chain-title">{c.title}</span>
              <span className="muted">{c.steps.length} passages · {new Date(c.updated).toLocaleDateString()}</span>
              {c.steps.length > 0 && (
                <span className="muted small-note">
                  {c.steps.slice(0, 4).map((s) => label(bible, s.start, s.end)).join(' → ')}{c.steps.length > 4 ? ' → …' : ''}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function label(bible: Bible, start: string, end: string) {
  const a = fromOsis(bible, start), b = fromOsis(bible, end);
  if (a < 0) return start;
  return refLabel(bible, a, b > a ? b - a : 0);
}

function ChainEditor({ bible, chain, actions, onGo }: { bible: Bible; chain: Chain; actions: WorkbenchActions; onGo: (id: number) => void }) {
  const [copied, setCopied] = useState(false);
  const md = () => chainMarkdown(bible, chain);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      download(`${slug(chain.title)}.md`, md(), 'text/markdown');
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <button className="btn ghost small" onClick={() => actions.setActive(null)}>‹ All chains</button>
        <div className="spacer" />
        <button className="btn ghost small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy Markdown'}</button>
        <button className="btn ghost small" onClick={() => download(`${slug(chain.title)}.md`, md(), 'text/markdown')}>Download .md</button>
      </div>
      <input className="title-input" value={chain.title} onChange={(e) => actions.renameChain(chain.id, e.target.value)} aria-label="Chain title" />
      <textarea className="note" rows={2} placeholder="What does this chain trace? (thesis, method, sources)" value={chain.description}
        onChange={(e) => actions.describeChain(chain.id, e.target.value)} />
      <p className="muted small-note">This chain is active: <b>＋</b> buttons add passages to it.</p>
      {chain.steps.length === 0 && <p className="empty">No passages yet. Select a verse and press <b>+ Chain</b>, or <b>＋</b> on a cross-reference.</p>}
      <ol className="steps">
        {chain.steps.map((s, i) => {
          const a = fromOsis(bible, s.start), b = fromOsis(bible, s.end);
          const span = b > a ? b - a : 0;
          return (
            <li key={s.id} className="step">
              <div className="row">
                <span className="step-n">{i + 1}</span>
                {a >= 0 ? <button className="xref-ref" onClick={() => onGo(a)}>{refLabel(bible, a, span)}</button> : <span>{s.start}</span>}
                <div className="spacer" />
                <button className="btn ghost icon small" aria-label="Move up" disabled={i === 0} onClick={() => actions.moveStep(chain.id, s.id, -1)}>↑</button>
                <button className="btn ghost icon small" aria-label="Move down" disabled={i === chain.steps.length - 1} onClick={() => actions.moveStep(chain.id, s.id, 1)}>↓</button>
                <button className="btn ghost icon small" aria-label="Remove" onClick={() => actions.removeStep(chain.id, s.id)}>✕</button>
              </div>
              {a >= 0 && <p className="scripture xref-text">{passageText(bible, a, span, 4)}</p>}
              <textarea className="note" rows={1} placeholder="Why this link? (verbal parallel, type, fulfilment…)" value={s.note}
                onChange={(e) => actions.setStepNote(chain.id, s.id, e.target.value)} />
            </li>
          );
        })}
      </ol>
      <button className="btn danger ghost small" onClick={() => { if (confirm(`Delete the chain “${chain.title}”? This cannot be undone.`)) actions.deleteChain(chain.id); }}>
        Delete chain
      </button>
    </div>
  );
}

function chainMarkdown(bible: Bible, chain: Chain): string {
  const lines = [`# ${chain.title}`, ''];
  if (chain.description.trim()) lines.push(chain.description.trim(), '');
  chain.steps.forEach((s, i) => {
    const a = fromOsis(bible, s.start), b = fromOsis(bible, s.end);
    const span = b > a ? b - a : 0;
    lines.push(`## ${i + 1}. ${a >= 0 ? refLabel(bible, a, span) : s.start}`, '');
    if (a >= 0) lines.push(`> ${passageText(bible, a, span, 999)}`, '');
    if (s.note.trim()) lines.push(s.note.trim(), '');
  });
  lines.push('---', `Scripture: ${bible.translation} (public domain). Cross-references: openbible.info (CC BY).`);
  return lines.join('\n');
}

// ---------- Connect (path finder) ----------

function Connect({ bible, xrefs, actions, selected, onGo, onSaved }: {
  bible: Bible; xrefs: Xrefs; actions: WorkbenchActions; selected: number; onGo: (id: number) => void; onSaved: () => void;
}) {
  const [from, setFrom] = useState(refLabel(bible, selected));
  const [to, setTo] = useState('');
  const [minVotes, setMinVotes] = useState(5);
  const [result, setResult] = useState<{ paths: number[][]; error?: string; a?: number; b?: number } | null>(null);

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const pa = parseRef(bible, from), pb = parseRef(bible, to);
    if (!pa || !pb) return setResult({ paths: [], error: `Could not read ${!pa ? `“${from}”` : `“${to}”`} as a reference.` });
    const paths = findPaths(xrefs, pa.start, pb.start, minVotes, 3);
    setResult({ paths, a: pa.start, b: pb.start, error: paths.length ? undefined : 'No chain within 6 steps at this vote level. Try a lower minimum.' });
  };

  return (
    <div className="stack">
      <p className="muted small-note">Find the shortest chains of cross-references linking two passages, preferring well-attested links.</p>
      <form className="stack" onSubmit={run}>
        <div className="row">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From, e.g. Gen 3:15" aria-label="From passage" />
          <button type="button" className="btn ghost small" onClick={() => setFrom(refLabel(bible, selected))} title="Use the selected verse">◎</button>
        </div>
        <div className="row">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To, e.g. Rev 12:9" aria-label="To passage" />
          <button type="button" className="btn ghost small" onClick={() => setTo(refLabel(bible, selected))} title="Use the selected verse">◎</button>
        </div>
        <div className="row">
          <label className="inline">
            Links with ≥
            <select value={minVotes} onChange={(e) => setMinVotes(Number(e.target.value))}>
              {[0, 1, 5, 10, 25].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            votes
          </label>
          <div className="spacer" />
          <button className="btn" type="submit">Find chains</button>
        </div>
      </form>
      {result?.error && <p className="warn">{result.error}</p>}
      {result?.paths.map((p, i) => (
        <div key={i} className="path">
          <div className="row">
            <b>Chain {i + 1}</b>
            <span className="muted">{p.length - 1} link{p.length === 2 ? '' : 's'}</span>
            <div className="spacer" />
            <button className="btn ghost small" onClick={() => {
              actions.createChainWithSteps(`${refLabel(bible, p[0])} → ${refLabel(bible, p[p.length - 1])}`,
                p.map((v) => ({ start: osisOf(bible, v), end: osisOf(bible, v), note: '' })));
              onSaved();
            }}>Save as chain</button>
          </div>
          <ol className="path-steps">
            {p.map((v) => (
              <li key={v}>
                <button className="xref-ref" onClick={() => onGo(v)}>{refLabel(bible, v)}</button>
                <span className="scripture small-note">{bible.texts[v]}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ---------- Notes ----------

function Notes({ bible, wb, onGo }: { bible: Bible; wb: WB; onGo: (id: number) => void }) {
  const entries = Object.entries(wb.notes).sort((a, b) => b[1].updated - a[1].updated);
  if (!entries.length) return <p className="empty">Notes you write on a verse appear here.</p>;
  return (
    <ul className="notes-list">
      {entries.map(([osis, n]) => {
        const id = fromOsis(bible, osis);
        return (
          <li key={osis}>
            <button className="chain-card" onClick={() => id >= 0 && onGo(id)}>
              <span className="chain-title">{id >= 0 ? refLabel(bible, id) : osis}</span>
              <span className="note-text">{n.text}</span>
              <span className="muted small-note">{new Date(n.updated).toLocaleString()}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Backup ----------

function Backup({ wb, actions }: { wb: WB; actions: WorkbenchActions }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const onFile = async (f: File) => {
    try {
      const next = validate(JSON.parse(await f.text()));
      if (!next) throw new Error('bad');
      if (confirm(`Replace your current ${wb.chains.length} chains and ${Object.keys(wb.notes).length} notes with this backup (${next.chains.length} chains, ${Object.keys(next.notes).length} notes)?`)) {
        actions.replaceAll(next);
        setMsg('Backup restored.');
      }
    } catch {
      setMsg('That file is not a MediBible backup.');
    }
  };
  return (
    <div className="stack">
      <p className="muted small-note">Your chains and notes are stored only in this browser. Export a backup to keep them safe or move them to another device.</p>
      <button className="btn" onClick={() => download(`medibible-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(wb, null, 2), 'application/json')}>
        Export backup (.json)
      </button>
      <button className="btn ghost" onClick={() => fileRef.current?.click()}>Import backup…</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}

// ---------- helpers ----------

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chain';
