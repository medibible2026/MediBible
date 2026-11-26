import { applyUpdate, useOfflineState } from '../offline';

/** Thin notices: a new version is ready, or the device is offline. */
export function StatusBar({ onOpenOffline }: { onOpenOffline: () => void }) {
  const { updateReady, online, controlled } = useOfflineState();
  if (updateReady) {
    return (
      <div className="status-bar" role="status">
        A new version of MediBible is ready.
        <button className="btn small" onClick={applyUpdate}>Update now</button>
      </div>
    );
  }
  if (!online) {
    return (
      <div className="status-bar offline" role="status">
        You’re offline.{' '}
        {controlled ? 'Saved parts of MediBible keep working.' : 'Offline use starts after your first visit online.'}
        <button className="linklike" onClick={onOpenOffline}>What’s saved?</button>
      </div>
    );
  }
  return null;
}
