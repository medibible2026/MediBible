import { createContext, useContext } from 'react';
import { ALT_TRANSLATION, Bible, Translation, passageText } from './data';

/** Which text(s) to show for every verse in the app. */
export type TextMode = 'kjv' | 'alt' | 'both';

export interface TextPrefs {
  mode: TextMode;
  setMode: (m: TextMode) => void;
  alt: Translation | null; // loaded on first use
  altError: string | null;
}

export const TextContext = createContext<TextPrefs>({ mode: 'kjv', setMode: () => {}, alt: null, altError: null });
export const useTextPrefs = () => useContext(TextContext);

/** Texts in display order for the current mode: [label, texts, lang] (KJV until the translation has loaded). */
export function useDisplayTexts(bible: Bible): { label: string; texts: string[]; lang: string }[] {
  const { mode, alt } = useTextPrefs();
  const kjv = { label: 'KJV', texts: bible.texts, lang: 'en' };
  if (!alt || mode === 'kjv') return [kjv];
  const other = { label: alt.short, texts: alt.texts, lang: alt.lang };
  return mode === 'alt' ? [other] : [kjv, other];
}

/** A verse or passage in the chosen translation(s), stacked when more than one is shown. */
export function Passage({ bible, id, span = 0, max = 6, className = '' }: { bible: Bible; id: number; span?: number; max?: number; className?: string }) {
  const shown = useDisplayTexts(bible);
  if (shown.length === 1 && shown[0].lang === 'en') return <span className={`scripture ${className}`}>{passageText(bible, id, span, max)}</span>;
  return (
    <span className={`passage ${className}`}>
      {shown.map((t) => (
        <span key={t.label} lang={t.lang} className={`scripture lang-${t.lang}`}>{passageText(bible, id, span, max, t.texts) || '—'}</span>
      ))}
    </span>
  );
}

/** Translation picker. */
export function TextModeSelect() {
  const { mode, setMode, alt, altError } = useTextPrefs();
  const loading = mode !== 'kjv' && !alt && !altError;
  return (
    <select aria-label="Translation" value={mode} onChange={(e) => setMode(e.target.value as TextMode)}
      title={altError ?? (loading ? `Loading ${ALT_TRANSLATION.short}…` : 'Translation shown for every verse')}>
      <option value="kjv">KJV</option>
      <option value="alt">{ALT_TRANSLATION.short}{loading ? ' …' : ''}</option>
      <option value="both">KJV + {ALT_TRANSLATION.short}</option>
    </select>
  );
}
