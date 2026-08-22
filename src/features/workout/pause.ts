/**
 * WK-01 — pause math. The timer engine stays pure over instants; pausing is
 * a screen-level freeze: every engine read clamps "now" to the instant pause
 * was pressed, and resuming shifts the run's start forward by the pause
 * duration so no segment time is consumed while frozen. The same math holds
 * for a kill-during-pause: the persisted `pausedAtEpochMs` re-freezes the
 * screen on relaunch, and resume shifts past the whole gap (app closed time
 * included) because a paused run is not running.
 */

/** The clock every engine read sees: frozen at the pause instant while paused. */
export function pausedNow(nowMs: number, pausedAtEpochMs: number | null): number {
  return pausedAtEpochMs !== null ? Math.min(nowMs, pausedAtEpochMs) : nowMs;
}

/**
 * New start instant after resuming: shifted forward by exactly the pause
 * length (never negative), so remaining time resumes where it froze.
 */
export function shiftStartForResume(
  startedAtEpochMs: number,
  pausedAtEpochMs: number,
  resumedAtMs: number,
): number {
  const pausedFor = Math.max(0, resumedAtMs - pausedAtEpochMs);
  return startedAtEpochMs + pausedFor;
}
