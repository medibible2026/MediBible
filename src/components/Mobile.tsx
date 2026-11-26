// Phone-only pieces: the bottom tab bar and the verse action sheet.
import { useState } from 'react';
import { Bible, osisOf, passageText, refLabel } from '../data';
import { useDisplayTexts } from '../text';

export type MobileTab = 'read' | 'links' | 'study';

const ICONS: Record<MobileTab, JSX.Element> = {
  read: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5V19c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z" /><path d="M12 6v13.5" /></svg>
  ),
  links: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.2" /><circle cx="18.5" cy="5.5" r="2.2" /><circle cx="18.5" cy="18.5" r="2.2" /><path d="M7 11l9.5-4.6M7 13l9.5 4.6" /></svg>
  ),
  study: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M8 8h7M8 12h7M8 16h4" /></svg>
  ),
};
const LABELS: Record<MobileTab, string> = { read: 'Read', links: 'Cross-refs', study: 'Study' };

export function BottomTabs({ tab, setTab, linkCount }: { tab: MobileTab; setTab: (t: MobileTab) => void; linkCount: number }) {
  return (
    <nav className="bottom-tabs" role="tablist" aria-label="Sections">
      {(['read', 'links', 'study'] as MobileTab[]).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
          {ICONS[t]}
          <span>{LABELS[t]}{t === 'links' && linkCount > 0 && <span className="tab-count">{linkCount}</span>}</span>
        </button>
      ))}
    </nav>
  );
}

interface SheetProps {
  bible: Bible;
  id: number;
  linkCount: number;
  hasNote: boolean;
  onCrossRefs: () => void;
  onAddChain: () => void;
  onNote: () => void;
  onClose: () => void;
}

/** Actions for the verse just tapped in the reader (phones), instead of jumping straight to cross-references. */
export function VerseSheet({ bible, id, linkCount, hasNote, onCrossRefs, onAddChain, onNote, onClose }: SheetProps) {
  const shown = useDisplayTexts(bible);
  const [done, setDone] = useState<string | null>(null);
  const label = refLabel(bible, id);
  const link = `${location.origin}${location.pathname}#/${osisOf(bible, id)}`;
  const text = `${label}\n${shown.map((t) => passageText(bible, id, 0, 1, t.texts)).join('\n')}`;
  const flash = (msg: string) => { setDone(msg); setTimeout(() => setDone(null), 1500); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${text}\n${link}`); flash('Copied'); } catch { flash('Copy not allowed'); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: label, text, url: link }); } catch { /* cancelled */ }
    } else {
      copy();
    }
  };

  return (
    <div className="verse-sheet" role="dialog" aria-label={`Actions for ${label}`}>
      <div className="row">
        <b>{label}</b>
        {done && <span className="muted small-note">{done}</span>}
        <div className="spacer" />
        <button className="btn ghost icon" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="sheet-actions">
        <button className="btn" onClick={onCrossRefs}>Cross-refs{linkCount ? ` (${linkCount})` : ''}</button>
        <button className="btn ghost" onClick={onAddChain}>+ Chain</button>
        <button className="btn ghost" onClick={onNote}>{hasNote ? 'Note ●' : 'Note'}</button>
        <button className="btn ghost" onClick={copy}>Copy</button>
        <button className="btn ghost" onClick={share}>Share</button>
      </div>
    </div>
  );
}
