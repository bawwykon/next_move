/** FR-BOARD-2 — quest duration in friendly minutes ("8 min" / "10 min"). */
export function formatDuration(sec: number): string {
  const minutes = Math.max(0, Math.round(sec / 60));
  return `${minutes} min`;
}
