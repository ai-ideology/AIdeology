/** Persisted session state + scoring result, with localStorage fallback. */
import { emptyAnswers, type ResultPackage, type SessionAnswers } from '../scoring/engine';

export type TestStep = 'core' | 'adaptive' | 'hidden';

export interface SessionState {
  answers: SessionAnswers;
  step: TestStep;
  coreIndex: number;
  adaptivePlan: string[];
  adaptiveIndex: number;
  hiddenPlan: string[];
  hiddenIndex: number;
  result: ResultPackage | null;
  resultId: string | null;
  startedAt: number | null;
}

const KEY = 'aideology.v2';

export function freshState(): SessionState {
  return {
    answers: emptyAnswers(),
    step: 'core',
    coreIndex: 0,
    adaptivePlan: [],
    adaptiveIndex: 0,
    hiddenPlan: [],
    hiddenIndex: 0,
    result: null,
    resultId: null,
    startedAt: null,
  };
}

function readStorage(): string | null {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}

export function loadState(): SessionState {
  const raw = readStorage();
  if (!raw) return freshState();
  try {
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    const base = freshState();
    return {
      ...base,
      ...parsed,
      answers: { core: {}, adaptive: {}, hidden: {}, ...(parsed.answers ?? {}) },
    };
  } catch {
    return freshState();
  }
}

export function saveState(state: SessionState): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* in-memory run */ }
}

export function clearState(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

let current = loadState();

export function getState(): SessionState {
  return current;
}

export function setState(patch: Partial<SessionState>): SessionState {
  current = { ...current, ...patch };
  saveState(current);
  return current;
}

export function resetState(): SessionState {
  current = freshState();
  saveState(current);
  return current;
}
