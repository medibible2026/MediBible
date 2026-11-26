// Offline support: service worker registration, update prompt, and saving optional data for offline use.
// The worker itself is generated at build time by scripts/build-sw.mjs (production builds only).
import { useEffect, useState, useSyncExternalStore } from 'react';

interface OfflineFile { path: string; hash: string; bytes: number; gzip: number }
interface OfflineManifest { version: string; dataCache: string; core: string[]; optional: OfflineFile[] }

interface State {
  supported: boolean; // production build in a browser with service workers
  controlled: boolean; // this page is served by the worker (core app available offline)
  updateReady: boolean;
  online: boolean;
}

let state: State = {
  supported: import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  controlled: typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
  updateReady: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
let waiting: ServiceWorker | null = null;
let reloading = false;

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  if (!state.supported) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const watch = (w: ServiceWorker | null) => {
        if (!w) return;
        const check = () => {
          // A new version is installed while an older one still controls the page: offer to switch.
          if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; set({ updateReady: true }); }
        };
        check();
        w.addEventListener('statechange', check);
      };
      watch(reg.waiting);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        set({ controlled: true });
        if (waiting && !reloading) { reloading = true; window.location.reload(); }
      });
      // Check for a new version now and then while the app stays open.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (e) {
      console.warn('Offline support unavailable:', e);
    }
  });
}

export function applyUpdate() {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export function useOfflineState(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// ---------- Saving optional data ----------

async function manifest(): Promise<OfflineManifest> {
  const r = await fetch('./offline.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('offline.json not found');
  return r.json();
}

const keyFor = (_m: OfflineManifest, f: OfflineFile) => `${new URL(f.path, document.baseURI).href}?v=${f.hash}`;

export interface SavedStatus { saved: number; total: number; savedBytes: number; totalBytes: number }

export async function savedStatus(): Promise<SavedStatus> {
  const m = await manifest();
  const cache = await caches.open(m.dataCache);
  let saved = 0, savedBytes = 0;
  for (const f of m.optional) {
    if (await cache.match(keyFor(m, f))) { saved++; savedBytes += f.gzip; }
  }
  return { saved, total: m.optional.length, savedBytes, totalBytes: m.optional.reduce((s, f) => s + f.gzip, 0) };
}

/** Downloads every optional data file through the worker (which stores them), reporting progress. */
export async function saveEverything(onProgress: (s: SavedStatus) => void, signal: { cancelled: boolean }) {
  // Ask the browser not to clear this storage when space runs low.
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  const m = await manifest();
  const cache = await caches.open(m.dataCache);
  const status = await savedStatus();
  const todo: OfflineFile[] = [];
  for (const f of m.optional) if (!(await cache.match(keyFor(m, f)))) todo.push(f);
  let i = 0;
  const worker = async () => {
    while (i < todo.length && !signal.cancelled) {
      const f = todo[i++];
      const r = await fetch(`./${f.path}`);
      if (!r.ok) throw new Error(`Could not download ${f.path}`);
      await r.arrayBuffer(); // the worker stores it as it passes through
      status.saved++;
      status.savedBytes += f.gzip;
      onProgress({ ...status });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return status;
}

export async function removeSaved() {
  const m = await manifest();
  const cache = await caches.open(m.dataCache);
  for (const f of m.optional) await cache.delete(keyFor(m, f));
}

/** Saved-data status, refreshed when asked. */
export function useSavedStatus(enabled: boolean) {
  const [status, setStatus] = useState<SavedStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    if (!enabled) return;
    savedStatus().then((s) => { setStatus(s); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(refresh, [enabled]);
  return { status, setStatus, error, refresh };
}
