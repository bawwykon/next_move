import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Thin AppState wrapper (S4-03): fires `onActive` once per transition back to
 * 'active'. The callback lives in a ref, so callers never need to memoize.
 */
export function useAppForeground(onActive: () => void): void {
  const callbackRef = useRef(onActive);

  useEffect(() => {
    callbackRef.current = onActive;
  }, [onActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        callbackRef.current();
      }
    });
    return () => subscription.remove();
  }, []);
}
