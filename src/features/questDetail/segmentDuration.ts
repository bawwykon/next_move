/** FR-TIMER-1 — segment durations: "45s" under a minute, "1 min 30s" above. */
export function formatSegmentDuration(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  if (safe < 60) {
    return `${safe}s`;
  }
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest > 0 ? `${minutes} min ${rest}s` : `${minutes} min`;
}
