import { useEffect, useRef } from 'react';

import { dayWindow } from '@/domain/board/window';
import { dayKey } from '@/domain/streak/dayKey';
import { useAppForeground } from '@/hooks/useAppForeground';

// The timer is only a hint — a sleeping device may drift past the nominal
// midnight, so the day key computed at fire time is the source of truth.
const MIN_ARM_DELAY_MS = 1_000;
const DRIFT_BUFFER_MS = 1_000;

/**
 * S6-02 — local-midnight rollover (FR-BOARD-7). Re-arms a timer to the next
 * local midnight and, on fire or on returning to the foreground, calls
 * `onDayChange` exactly once when the local day key has actually flipped.
 * Pure of rendering: the callback invokes `characterStore.refresh()` at the
 * root, which re-derives "done today", the weekly window, and the daily
 * recommendation with the new day.
 */
export function useDayChange(onDayChange: () => void): void {
  const callbackRef = useRef(onDayChange);
  const lastDayKeyRef = useRef(dayKey(new Date()));

  useEffect(() => {
    callbackRef.current = onDayChange;
  }, [onDayChange]);

  const checkRef = useRef(() => {
    const key = dayKey(new Date());
    if (key !== lastDayKeyRef.current) {
      lastDayKeyRef.current = key;
      callbackRef.current();
    }
  });

  useAppForeground(() => {
    checkRef.current();
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = (): void => {
      const now = new Date();
      const endMs = dayWindow(now).endMs;
      const delay = Math.max(endMs - now.getTime() + DRIFT_BUFFER_MS, MIN_ARM_DELAY_MS);
      timer = setTimeout(() => {
        timer = null;
        checkRef.current();
        arm();
      }, delay);
    };

    arm();
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, []);
}
