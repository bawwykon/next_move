import type { TFunction } from 'i18next';

/** FR-TIMER-1 — segment durations: "45s" under a minute, "1 min 30s" above. */
export function formatSegmentDuration(sec: number, t: TFunction): string {
  const safe = Math.max(0, Math.round(sec));
  if (safe < 60) {
    return t('quest.seconds', { count: safe });
  }
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  const head = t('board.minutes', { count: minutes });
  return rest > 0 ? `${head} ${t('quest.seconds', { count: rest })}` : head;
}
