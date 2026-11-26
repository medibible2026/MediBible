import { useMemo, useState } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import {
  Bible, Filters, KIND_INFO, LINK_KINDS, LinkKind, OT_BOOKS, Xrefs, XrefEntry, applyFilters, linkKind, outgoing, refLabel, refShort,
} from '../data';
import { Passage } from '../text';

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  center: number;
  entries: XrefEntry[]; // already filtered, ranked
  filters: Filters;
  onGo: (id: number) => void;
}

interface GNode extends SimulationNodeDatum {
  id: number; // verse id (passage start)
  span: number;
  ring: 0 | 1 | 2;
  degree: number;
}

interface GEdge extends SimulationLinkDatum<GNode> {
  source: GNode;
  target: GNode;
  kind: LinkKind | null;
  votes: number;
  ring: 1 | 2 | 3; // 1 = from centre, 2 = onward, 3 = between neighbours
}

const SIZES = [10, 20, 30, 45];

export function NetworkGraph({ bible, xrefs, center, entries, filters, onGo }: Props) {
  const [size, setSize] = useState(20);
  const [onward, setOnward] = useState(false);
  const [hover, setHover] = useState<GNode | null>(null);

  const graph = useMemo(() => {
    const nodes = new Map<number, GNode>();
    const add = (id: number, span: number, ring: 0 | 1 | 2) => {
      if (!nodes.has(id)) nodes.set(id, { id, span, ring, degree: 0 });
      return nodes.get(id)!;
    };
    const root = add(center, 0, 0);
    root.fx = 0;
    root.fy = 0;
    const edges: GEdge[] = [];
    const seen = new Set<string>();
    const link = (a: GNode, b: GNode, kind: LinkKind | null, votes: number, ring: 1 | 2 | 3) => {
      const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (a === b || seen.has(key)) return;
      seen.add(key);
      a.degree++;
      b.degree++;
      edges.push({ source: a, target: b, kind, votes, ring });
    };

    const first = entries.slice(0, size);
    for (const e of first) link(root, add(e.target, e.span, 1), linkKind(xrefs, e.link), e.votes, 1);

    const all = { ...filters, book: -1, scope: 'all' as const, kinds: LINK_KINDS.join('') };
    if (onward) {
      for (const e of first) {
        const from = nodes.get(e.target)!;
        const next = applyFilters(bible, e.target, outgoing(xrefs, e.target), all)
          .filter((n) => !nodes.has(n.target)).slice(0, 2);
        for (const n of next) link(from, add(n.target, n.span, 2), linkKind(xrefs, n.link), n.votes, 2);
      }
    }

    // Links among the neighbours themselves reveal clusters.
    const list = [...nodes.values()];
    const starts = list.map((n) => n.id).sort((a, b) => a - b);
    const findNode = (t0: number, span: number) => {
      for (const s of starts) if (s >= t0 && s <= t0 + span) return nodes.get(s)!;
      return null;
    };
    for (const a of list) {
      if (a.ring === 0) continue;
      for (const e of outgoing(xrefs, a.id)) {
        if (e.votes < filters.minVotes) continue;
        const b = findNode(e.target, e.span);
        if (b && b.ring !== 0) link(a, b, linkKind(xrefs, e.link), e.votes, 3);
      }
    }

    const sim = forceSimulation<GNode>(list)
      .force('link', forceLink<GNode, GEdge>(edges).distance((e) => (e.ring === 1 ? 110 : e.ring === 2 ? 60 : 90)).strength((e) => (e.ring === 3 ? 0.15 : 0.6)))
      .force('charge', forceManyBody().strength(-260))
      .force('collide', forceCollide<GNode>(30))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.06))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();

    const xs = list.map((n) => n.x!), ys = list.map((n) => n.y!);
    const pad = 50;
    const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    return { nodes: list, edges, box, between: edges.filter((e) => e.ring === 3).length };
  }, [bible, xrefs, center, entries, filters, size, onward]);

  const hoverEdges = useMemo(() => {
    if (!hover) return null;
    return new Set(graph.edges.filter((e) => e.source === hover || e.target === hover));
  }, [hover, graph]);

  if (!entries.length) return <p className="empty">No cross-references match these filters.</p>;

  const width = (e: GEdge) => Math.min(5, 0.8 + Math.log10(Math.max(1, e.votes + 1)) * 1.4);
  const radius = (n: GNode) => (n.ring === 0 ? 16 : Math.min(13, 6 + Math.sqrt(n.degree) * 1.6));

  return (
    <div className="graph-wrap">
      <div className="graph-controls">
        <label className="inline">
          Show
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((s) => <option key={s} value={s}>top {s}</option>)}
          </select>
        </label>
        <label className="inline check">
          <input type="checkbox" checked={onward} onChange={(e) => setOnward(e.target.checked)} /> onward links
        </label>
        <span className="muted small-note">{graph.nodes.length} passages · {graph.between} links between neighbours</span>
      </div>
      <div className="graph-stage">
        <svg viewBox={`${graph.box.x} ${graph.box.y} ${graph.box.w} ${graph.box.h}`} role="img"
          aria-label={`Network of cross-references around ${refLabel(bible, center)}`} onMouseLeave={() => setHover(null)}>
          <g>
            {graph.edges.map((e, i) => {
              const dim = hoverEdges && !hoverEdges.has(e);
              return (
                <line key={i} x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y}
                  className={`edge ${e.kind ? `ek-${e.kind}` : ''} ring-${e.ring}`} strokeWidth={width(e)}
                  opacity={dim ? 0.08 : e.ring === 3 ? 0.45 : 0.8}>
                  <title>{`${refShort(bible, e.source.id)} – ${refShort(bible, e.target.id)} · ${e.kind ? KIND_INFO[e.kind].label : ''} · ${e.votes} votes`}</title>
                </line>
              );
            })}
          </g>
          <g>
            {graph.nodes.map((n) => {
              const dim = hover && hover !== n && !graph.edges.some((e) => hoverEdges?.has(e) && (e.source === n || e.target === n));
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} className={`node ring${n.ring}${bible.vBook[n.id] < OT_BOOKS ? ' ot' : ' nt'}`}
                  opacity={dim ? 0.25 : 1} onMouseEnter={() => setHover(n)} onClick={() => onGo(n.id)} tabIndex={0} role="button"
                  aria-label={`Open ${refLabel(bible, n.id, n.span)}`} onKeyDown={(e) => { if (e.key === 'Enter') onGo(n.id); }}>
                  <circle r={radius(n)} />
                  <text y={radius(n) + 12} textAnchor="middle">{refShort(bible, n.id, n.span)}</text>
                </g>
              );
            })}
          </g>
        </svg>
        {hover && (
          <div className="graph-tip">
            <b>{refLabel(bible, hover.id, hover.span)}</b>
            <Passage bible={bible} id={hover.id} span={hover.span} max={3} />
            {hover.ring !== 0 && <span className="muted small-note">Click to open</span>}
          </div>
        )}
      </div>
      <GraphLegend />
    </div>
  );
}

export function GraphLegend({ arcs = false }: { arcs?: boolean }) {
  return (
    <div className="graph-legend">
      <span><i className="swatch ot" /> Old Testament</span>
      <span><i className="swatch nt" /> New Testament</span>
      {LINK_KINDS.map((k) => (
        <span key={k} title={KIND_INFO[k].help}><i className={`line ek-${k}`} /> {KIND_INFO[k].short}</span>
      ))}
      <span className="muted">{arcs ? 'Faint arcs: the most-voted links in the whole Bible' : 'Line width: votes · faint lines: links between neighbours'}</span>
    </div>
  );
}
