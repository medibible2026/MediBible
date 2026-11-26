// Workbench state (notes + study chains), saved in this browser's localStorage.
import { useCallback, useEffect, useState } from 'react';

export interface ChainStep {
  id: string;
  start: string; // OSIS, e.g. "John.3.16"
  end: string;
  note: string;
}

export interface Chain {
  id: string;
  title: string;
  description: string;
  steps: ChainStep[];
  created: number;
  updated: number;
}

export interface Note {
  text: string;
  updated: number;
}

export interface Workbench {
  version: 1;
  notes: Record<string, Note>; // key: OSIS verse
  chains: Chain[];
  activeChainId: string | null;
}

const KEY = 'medibible.workbench.v1';
const EMPTY: Workbench = { version: 1, notes: {}, chains: [], activeChainId: null };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function load(): Workbench {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return validate(JSON.parse(raw)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function validate(v: unknown): Workbench | null {
  if (!v || typeof v !== 'object') return null;
  const w = v as Partial<Workbench>;
  if (typeof w.notes !== 'object' || !Array.isArray(w.chains)) return null;
  return { version: 1, notes: w.notes ?? {}, chains: w.chains, activeChainId: w.activeChainId ?? null };
}

export function useWorkbench() {
  const [wb, setWb] = useState<Workbench>(load);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(wb));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [wb]);

  const updateChain = useCallback((id: string, fn: (c: Chain) => Chain) => {
    setWb((w) => ({ ...w, chains: w.chains.map((c) => (c.id === id ? { ...fn(c), updated: Date.now() } : c)) }));
  }, []);

  const actions = {
    setNote: (osis: string, text: string) =>
      setWb((w) => {
        const notes = { ...w.notes };
        if (text.trim()) notes[osis] = { text, updated: Date.now() };
        else delete notes[osis];
        return { ...w, notes };
      }),
    createChain: (title: string): string => {
      const id = uid();
      const now = Date.now();
      setWb((w) => ({
        ...w,
        chains: [{ id, title: title || 'Untitled chain', description: '', steps: [], created: now, updated: now }, ...w.chains],
        activeChainId: id,
      }));
      return id;
    },
    createChainWithSteps: (title: string, steps: Omit<ChainStep, 'id'>[]) => {
      const id = uid();
      const now = Date.now();
      setWb((w) => ({
        ...w,
        chains: [{ id, title, description: '', steps: steps.map((s) => ({ ...s, id: uid() })), created: now, updated: now }, ...w.chains],
        activeChainId: id,
      }));
    },
    deleteChain: (id: string) =>
      setWb((w) => ({ ...w, chains: w.chains.filter((c) => c.id !== id), activeChainId: w.activeChainId === id ? null : w.activeChainId })),
    setActive: (id: string | null) => setWb((w) => ({ ...w, activeChainId: id })),
    renameChain: (id: string, title: string) => updateChain(id, (c) => ({ ...c, title })),
    describeChain: (id: string, description: string) => updateChain(id, (c) => ({ ...c, description })),
    addStep: (id: string, start: string, end: string) =>
      updateChain(id, (c) => ({ ...c, steps: [...c.steps, { id: uid(), start, end, note: '' }] })),
    setStepNote: (id: string, stepId: string, note: string) =>
      updateChain(id, (c) => ({ ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, note } : s)) })),
    removeStep: (id: string, stepId: string) => updateChain(id, (c) => ({ ...c, steps: c.steps.filter((s) => s.id !== stepId) })),
    moveStep: (id: string, stepId: string, delta: number) =>
      updateChain(id, (c) => {
        const i = c.steps.findIndex((s) => s.id === stepId);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= c.steps.length) return c;
        const steps = c.steps.slice();
        [steps[i], steps[j]] = [steps[j], steps[i]];
        return { ...c, steps };
      }),
    replaceAll: (next: Workbench) => setWb(next),
  };

  return { wb, actions, saveError };
}

export type WorkbenchActions = ReturnType<typeof useWorkbench>['actions'];
