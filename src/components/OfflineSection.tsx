import { useRef, useState } from 'react';
import { removeSaved, saveEverything, useOfflineState, useSavedStatus } from '../offline';

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

/** About → Offline: what works without a connection, and saving the optional data. */
export function OfflineSection() {
  const { supported, controlled, online } = useOfflineState();
  const { status, setStatus, error, refresh } = useSavedStatus(supported && controlled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cancel = useRef({ cancelled: false });

  if (!supported) {
    return <p className="small-note muted">Offline use is available in the published app (not in this development preview).</p>;
  }
  if (!controlled) {
    return <p className="small-note">Offline use is being set up. It is ready after this first visit; reload the page once to finish.</p>;
  }

  const complete = status && status.saved === status.total;
  const start = async () => {
    cancel.current = { cancelled: false };
    setBusy(true);
    setMessage(null);
    try {
      const s = await saveEverything(setStatus, cancel.current);
      setMessage(cancel.current.cancelled ? 'Stopped. What was downloaded stays saved.' : s.saved === s.total ? 'Everything is saved for offline use.' : null);
    } catch (e) {
      setMessage(`${e instanceof Error ? e.message : String(e)}. Try again when you have a connection.`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="offline-section">
      <p className="small-note">
        ✓ <b>The reader, search, cross-references, link types, graphs, chains and notes work offline</b> on this device.
        The interlinear, word details, concordance and Tamil text work offline once saved. They are saved as you use them, or all at once:
      </p>
      {status && (
        <div className="offline-progress">
          <progress max={status.totalBytes} value={status.savedBytes} aria-label="Saved for offline" />
          <span className="small-note muted">
            {status.saved} of {status.total} files · {mb(status.savedBytes)} of {mb(status.totalBytes)}
          </span>
        </div>
      )}
      {error && <p className="warn small-note">{error}</p>}
      <div className="row">
        {!busy && !complete && (
          <button className="btn small" onClick={start} disabled={!online}>
            Save everything{status ? ` (${mb(status.totalBytes - status.savedBytes)})` : ''}
          </button>
        )}
        {busy && <button className="btn ghost small" onClick={() => { cancel.current.cancelled = true; }}>Stop</button>}
        {!busy && status && status.saved > 0 && (
          <button className="btn ghost small" onClick={async () => { await removeSaved(); setMessage('Saved Hebrew/Greek and Tamil data removed.'); refresh(); }}>
            Remove saved data
          </button>
        )}
      </div>
      {!online && !complete && <p className="small-note muted">Connect to the internet to save the rest.</p>}
      {message && <p className="small-note">{message}</p>}
    </div>
  );
}
