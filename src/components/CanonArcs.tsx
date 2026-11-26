import { useEffect, useMemo, useRef, useState } from 'react';
import { Bible, OT_BOOKS, Xrefs, XrefEntry, linkKind, refLabel, refShort } from '../data';
import { GraphLegend } from './NetworkGraph';

interface Props {
  bible: Bible;
  xrefs: Xrefs;
  center: number;
  entries: XrefEntry[];
  onGo: (id: number) => void;
  tall?: boolean;
}

const BG_LEVELS = [0, 200, 100, 50, 25];
const PAD = 10;

/** The whole Bible as a line; arcs join linked passages (after Harrison & Römhild's chart). */
export function CanonArcs({ bible, xrefs, center, entries, onGo, tall }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);
  const [bgMin, setBgMin] = useState(50);
  const [hover, setHover] = useState<{ x: number; id: number; snapped: boolean } | null>(null);
  // The tallest arc (Genesis to Revelation) is a half-circle, so height follows width.
  const height = Math.min(tall ? 520 : 320, Math.round((width - PAD * 2) / 2) + 48);
  const base = height - 40;
  const N = bible.texts.length;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const background = useMemo(() => {
    if (!bgMin) return new Int32Array(0);
    const out: number[] = [];
    for (let from = 0; from < N; from++) {
      for (let k = xrefs.offsets[from]; k < xrefs.offsets[from + 1]; k++) {
        if (xrefs.data[k * 3 + 2] >= bgMin && xrefs.data[k * 3] > from) out.push(from, xrefs.data[k * 3]);
      }
    }
    return Int32Array.from(out);
  }, [xrefs, bgMin, N]);

  const xOf = (id: number) => PAD + (id / N) * (width - PAD * 2);
  const idOf = (x: number) => Math.max(0, Math.min(N - 1, Math.round(((x - PAD) / (width - PAD * 2)) * N)));
  const ends = useMemo(() => entries.map((e) => ({ id: e.target, mid: e.target + e.span / 2, kind: linkKind(xrefs, e.link) })), [entries, xrefs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const k = Math.min(1, (base - 8) / ((width - PAD * 2) / 2));
    const arc = (a: number, b: number) => {
      const x1 = xOf(a), x2 = xOf(b);
      const rx = Math.abs(x2 - x1) / 2;
      if (rx < 0.3) return;
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, base, rx, rx * k, 0, Math.PI, 2 * Math.PI);
      ctx.stroke();
    };

    // Book bands
    bible.books.forEach((b, bi) => {
      const s = bible.chapterStart[bi][0];
      const e = bi + 1 < bible.books.length ? bible.chapterStart[bi + 1][0] : N;
      const x1 = xOf(s), x2 = xOf(e);
      ctx.fillStyle = bi < OT_BOOKS ? (bi % 2 ? v('--ot-a') : v('--ot-b')) : bi % 2 ? v('--nt-a') : v('--nt-b');
      ctx.fillRect(x1, base + 2, Math.max(1, x2 - x1), 10);
      if (x2 - x1 > 26) {
        ctx.fillStyle = v('--muted');
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.osis, (x1 + x2) / 2, base + 24);
      }
    });

    // Background: the best-attested links in the whole Bible
    ctx.strokeStyle = v('--muted');
    ctx.globalAlpha = Math.max(0.025, Math.min(0.12, 400 / Math.max(1, background.length / 2)));
    ctx.lineWidth = 0.6;
    for (let i = 0; i < background.length; i += 2) arc(background[i], background[i + 1]);

    // Foreground: the selected verse's links, coloured by link type
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.4;
    for (const e of ends) {
      ctx.strokeStyle = e.kind ? v(`--k-${e.kind}-fg`) : v('--accent');
      arc(center, e.mid);
    }

    // Selected verse marker
    ctx.globalAlpha = 1;
    ctx.fillStyle = v('--accent');
    const cx = xOf(center);
    ctx.beginPath();
    ctx.moveTo(cx, base - 2);
    ctx.lineTo(cx - 5, base - 10);
    ctx.lineTo(cx + 5, base - 10);
    ctx.fill();

    if (hover) {
      ctx.strokeStyle = v('--text');
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hover.x, 0);
      ctx.lineTo(hover.x, base + 12);
      ctx.stroke();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bible, width, height, background, ends, center, hover]);

  const onMove = (ev: React.MouseEvent) => {
    const x = ev.clientX - (ev.currentTarget as HTMLElement).getBoundingClientRect().left;
    // Snap to a highlighted link end when close; otherwise the chapter under the pointer.
    let best: { id: number; d: number } | null = null;
    for (const e of ends) {
      const d = Math.abs(xOf(e.mid) - x);
      if (d < 7 && (!best || d < best.d)) best = { id: e.id, d };
    }
    if (best) return setHover({ x: xOf(best.id), id: best.id, snapped: true });
    const id = idOf(x);
    const chapterStart = bible.chapterStart[bible.vBook[id]][bible.vChap[id] - 1];
    setHover({ x, id: chapterStart, snapped: false });
  };

  return (
    <div className="graph-wrap">
      <div className="graph-controls">
        <label className="inline">
          Background
          <select value={bgMin} onChange={(e) => setBgMin(Number(e.target.value))}>
            {BG_LEVELS.map((l) => <option key={l} value={l}>{l ? `links ≥ ${l} votes` : 'off'}</option>)}
          </select>
        </label>
        <span className="muted small-note">
          {(background.length / 2).toLocaleString()} background arcs · {entries.length} from {refShort(bible, center)}
        </span>
      </div>
      <div className="graph-stage arcs" ref={wrapRef}>
        <canvas ref={canvasRef} style={{ width: '100%', height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          onClick={() => hover && onGo(hover.id)} role="img"
          aria-label={`Arc diagram of the whole Bible highlighting ${entries.length} cross-references from ${refLabel(bible, center)}`} />
        {hover && (
          <div className="graph-tip arcs-tip" style={{ left: Math.min(Math.max(hover.x - 90, 4), width - 184) }}>
            <b>{hover.snapped ? refLabel(bible, hover.id) : `${bible.books[bible.vBook[hover.id]].name} ${bible.vChap[hover.id]}`}</b>
            <span className="muted small-note">{hover.snapped ? 'Linked passage · click to open' : 'Click to open this chapter'}</span>
          </div>
        )}
      </div>
      <GraphLegend arcs />
    </div>
  );
}
