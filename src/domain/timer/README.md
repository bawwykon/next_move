# Timer domain

Spec owner: `D:\ai\references\08-economy-spec.md` §9 (Timer engine), plus
FR-TIMER-1..9 / NFR-1/2 / EC-2 from the PRD.

## `workoutEngine.ts`

Pure, deterministic, zero-import (no React, no DB, no clock). `nowMs` is
always injected, so every function is a pure function of `(workout, nowMs)`.

Key semantics:

- `buildWorkout(segments, startedAtEpochMs)` validates (non-empty; positive
  whole-second durations; known kinds; positive epoch) and returns the total
  as the segment sum.
- `segmentIndexAt` walks cumulative durations; exactly-on-boundary goes to the
  next segment; at/after the workout end it is `null` (that boundary is
  "complete", never an overflow index).
- `isComplete` is boundary-inclusive (`nowMs >= startedAt + total`), so
  foregrounding after a gap completes immediately (EC-2) — resume is pure
  arithmetic and backgrounding is free (NFR-2).
- `countdownMs` (FR-TIMER-3): 3-2-1 during the opening
  `COUNTDOWN_DURATION_MS` of the first segment and of any segment following a
  rest; `null` past the window or for work→rest / work→cooldown transitions.
  The countdown overlays the segment's own window — the schedule never shifts.
- Progress is a clamped 0..1 whole-workout fraction; totals count down from
  the full workout, not from zero.
