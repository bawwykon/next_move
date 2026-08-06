/** Sanity sum for the preview footer — segments should total the quest duration. */
export function segmentsTotal(segments: readonly { durationSec: number }[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationSec, 0);
}
