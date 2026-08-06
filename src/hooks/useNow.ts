import { useSyncExternalStore } from 'react';

// Ref 03 rule 6 — one shared render clock for the whole app. The interval is a
// module singleton: it starts with the first subscriber and stops with the
// last, so during a workout exactly one interval exists app-wide and every
// engine read goes through the same `nowMs` snapshot.
let nowMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  nowMs = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId === null) {
    nowMs = Date.now();
    intervalId = setInterval(tick, 200);
    if (__DEV__) {
      console.log('[useNow] interval started');
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      if (__DEV__) {
        console.log('[useNow] interval stopped');
      }
    }
  };
}

function getSnapshot(): number {
  return nowMs;
}

/** Shared monotonic render clock — the only timer source in the app (Ref 03 rule 6). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
