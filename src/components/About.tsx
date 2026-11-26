import { useEffect, useRef } from 'react';
import { OfflineSection } from './OfflineSection';

const REPO = 'https://github.com/medibible2026/MediBible';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';

const SOURCES: { name: string; by: string; href: string; licence: string; licenceHref?: string; changes: string }[] = [
  {
    name: 'King James Version (1769)',
    by: 'scrollmapper/bible_databases',
    href: 'https://github.com/scrollmapper/bible_databases',
    licence: 'Public domain*',
    changes: 'Whitespace normalised; repackaged as one verse list.',
  },
  {
    name: 'Cross-references with community votes',
    by: 'OpenBible.info, from the Treasury of Scripture Knowledge',
    href: 'https://www.openbible.info/labs/cross-references/',
    licence: 'CC BY 4.0',
    licenceHref: CC_BY,
    changes: 'Re-indexed to KJV verses; 5 links to verses the KJV does not number dropped; sorted by votes.',
  },
  {
    name: 'Tagged Hebrew & Greek (TAHOT, TAGNT) and lexicons (TBESH, TBESG)',
    by: 'STEPBible.org, Tyndale House, Cambridge',
    href: 'https://github.com/STEPBible/STEPBible-Data',
    licence: 'CC BY 4.0',
    licenceHref: CC_BY,
    changes: 'Mapped to KJV verse numbers; split by book; definitions shortened; concordance compiled; cross-references automatically classified into link types (MediBible’s own analysis).',
  },
  {
    name: 'தமிழ் Indian Revised Version (IRV)',
    by: '© 2017, 2019 Bridge Connectivity Solutions Pvt. Ltd., via eBible.org',
    href: 'https://ebible.org/details.php?id=tam2017',
    licence: 'CC BY-SA 4.0',
    licenceHref: CC_BY_SA,
    changes: 'Aligned to KJV verse numbers; 3 John 1:15 joined to 1:14. Shared under the same licence.',
  },
];

export function About({ onClose, focusOffline = false }: { onClose: () => void; focusOffline?: boolean }) {
  const offlineRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    if (focusOffline) offlineRef.current?.scrollIntoView({ block: 'start' });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, focusOffline]);

  return (
    <div className="about-backdrop" onClick={onClose}>
      <div className="about" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 id="about-title">About MediBible</h2>
          <div className="spacer" />
          <button ref={closeRef} className="btn ghost icon small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p>
          A free study tool for exploring the Bible’s cross-references, the Hebrew and Greek behind them, and the paths that connect passages.
          It is free for everyone. The source code is open under the <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT licence</a>.
        </p>

        <h3 ref={offlineRef}>Offline</h3>
        <OfflineSection />

        <h3>Sources and licences</h3>
        <ul className="about-sources">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <b>{s.name}</b>: <a href={s.href} target="_blank" rel="noreferrer">{s.by}</a>
              {' · '}
              {s.licenceHref ? <a href={s.licenceHref} target="_blank" rel="noreferrer">{s.licence}</a> : s.licence}
              <br />
              <span className="muted small-note">Changes: {s.changes}</span>
            </li>
          ))}
        </ul>
        <p className="muted small-note">
          * The KJV is public domain in most of the world. In the United Kingdom, rights in the Authorized Version are vested in the Crown and
          administered by Cambridge University Press. The Tamil Old Version (TAOVBSI) is © The Bible Society of India and is not included.
          Full details: <a href={`${REPO}/blob/main/DATA-LICENSES.md`} target="_blank" rel="noreferrer">DATA-LICENSES.md</a>.
        </p>

        <h3>How to read the link labels</h3>
        <p className="small-note">
          Link types (Parallel, Wording, Word, Heb↔Grk, English, Thematic) and the graphs are computed automatically from shared words and wording.
          They show evidence, not interpretation, and are not endorsed by any of the sources above. Please check them before you rely on them.
        </p>

        <h3>Privacy</h3>
        <p className="small-note">
          No accounts, no tracking, no ads. Your notes and study chains are stored only in this browser, so use <b>Backup</b> to keep a copy.
          Data saved for offline use is also stored only on this device.
          The website host may keep standard server logs.
        </p>

        <p className="muted small-note">
          Open-source code bundled in this app: <a href="./THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">third-party notices</a>
          {' · '}<a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
        </p>
      </div>
    </div>
  );
}
