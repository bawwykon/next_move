/**
 * Big-3 NEXT-MILESTONE — the Quest Board anchor card. Pure derivation of the
 * single closest reward from the server-authoritative snapshot (journey
 * quests, total XP + level, current streak). Nothing here awards anything;
 * thresholds mirror the server (chapters, 100×L level curve, streak ladder).
 *
 * Priority (nearest expiry wins):
 *  1. streak rung 1–2 days away (expires daily — most urgent),
 *  2. level-up < 100 XP away (today-ish),
 *  3. next chapter unlock (the steady default anchor).
 * Past Mastery Peak the chapter leg is gone, so the card falls back to the
 * level leg (always defined) — the card never renders empty.
 */
import { chapterForQuests } from '@/domain/journey/chapter';
import { STREAK_MILESTONE_DAYS } from '@/domain/streak/milestone';
import { levelXpBounds } from '@/domain/xp/level';

export type MilestoneKind = 'streak' | 'level' | 'chapter';

export interface NextMilestone {
  kind: MilestoneKind;
  /** Progress already banked in this leg's own unit. */
  done: number;
  /** Target in the same unit. */
  target: number;
  /** target − done (>= 0). */
  remaining: number;
  /** done / target, clamped to [0, 1]. */
  fraction: number;
  /** Streak rung days | target player level | chapter id. */
  ref: number;
}

/** A streak rung this many days out (or fewer) beats every other leg. */
export const STREAK_CLOSE_DAYS = 2;
/** A level-up this much XP out (strictly less) beats the chapter leg. */
export const LEVEL_CLOSE_XP = 100;

export interface MilestoneInput {
  journeyQuests: number;
  totalXp: number;
  level: number;
  streak: number;
}

function clampedFraction(done: number, target: number): number {
  if (target <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, done / target));
}

export function nextMilestone(input: MilestoneInput): NextMilestone {
  const quests = Math.max(0, Math.floor(input.journeyQuests));
  const totalXp = Math.max(0, Math.floor(input.totalXp));
  const level = Math.max(1, Math.floor(input.level));
  const streak = Math.max(0, Math.floor(input.streak));

  // Leg 1 — the next unearned streak rung (rungs pay on first touch, so a
  // standing streak exactly on a rung already earned it: look strictly above).
  const rung = STREAK_MILESTONE_DAYS.find((days) => days > streak) ?? null;
  if (rung !== null && rung - streak <= STREAK_CLOSE_DAYS) {
    return {
      kind: 'streak',
      done: streak,
      target: rung,
      remaining: rung - streak,
      fraction: clampedFraction(streak, rung),
      ref: rung,
    };
  }

  // Leg 2 — the level-up line (100×L curve; the profile level column can lag
  // the XP total after offline completions, so clamp remaining at 0 — a
  // banked level-up still renders as the milestone).
  const bounds = levelXpBounds(level);
  const remainingXp = Math.max(0, bounds.end - totalXp);
  const intoXp = Math.min(bounds.span, Math.max(0, totalXp - bounds.start));
  if (remainingXp < LEVEL_CLOSE_XP) {
    return {
      kind: 'level',
      done: intoXp,
      target: bounds.span,
      remaining: remainingXp,
      fraction: clampedFraction(intoXp, bounds.span),
      ref: level + 1,
    };
  }

  // Leg 3 — the next chapter unlock (default anchor).
  const progress = chapterForQuests(quests);
  if (progress.next) {
    const span = progress.next.threshold - progress.current.threshold;
    return {
      kind: 'chapter',
      done: progress.questsSinceChapterStart,
      target: span,
      remaining: span - progress.questsSinceChapterStart,
      fraction: clampedFraction(progress.questsSinceChapterStart, span),
      ref: progress.next.id,
    };
  }

  // Past Mastery Peak: anchor on the level leg whatever the distance.
  return {
    kind: 'level',
    done: intoXp,
    target: bounds.span,
    remaining: remainingXp,
    fraction: clampedFraction(intoXp, bounds.span),
    ref: level + 1,
  };
}
