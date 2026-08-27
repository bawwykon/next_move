/**
 * BADGE-01 — progress rings. Pure derivation for milestone badges.
 * Only these slugs have meaningful progress; others return null (no ring).
 */

export interface BadgeProgress {
  current: number;
  target: number;
  fraction: number; // 0..1 clamped
}

export function badgeProgress(
  slug: string,
  ctx: {
    questCount: number;
    streak: number;
    level: number;
    distinctDays: number;
    earlyBirdCount: number;
    nightOwlCount: number;
    gapDays: number | null;
  },
): BadgeProgress | null {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  switch (slug) {
    case 'first-quest':
      return {
        current: Math.min(ctx.questCount, 1),
        target: 1,
        fraction: clamp(ctx.questCount / 1),
      };
    case 'first-level':
      return {
        current: Math.min(ctx.level, 2),
        target: 2,
        fraction: clamp(ctx.level >= 2 ? 1 : 0),
      };
    case 'first-week':
      return {
        current: Math.min(ctx.distinctDays, 7),
        target: 7,
        fraction: clamp(ctx.distinctDays / 7),
      };
    case 'workouts-50':
      return {
        current: Math.min(ctx.questCount, 50),
        target: 50,
        fraction: clamp(ctx.questCount / 50),
      };
    case 'workouts-100':
      return {
        current: Math.min(ctx.questCount, 100),
        target: 100,
        fraction: clamp(ctx.questCount / 100),
      };
    case 'workouts-250':
      return {
        current: Math.min(ctx.questCount, 250),
        target: 250,
        fraction: clamp(ctx.questCount / 250),
      };
    case 'streak-7':
      return { current: Math.min(ctx.streak, 7), target: 7, fraction: clamp(ctx.streak / 7) };
    case 'streak-30':
      return { current: Math.min(ctx.streak, 30), target: 30, fraction: clamp(ctx.streak / 30) };
    case 'streak-100':
      return { current: Math.min(ctx.streak, 100), target: 100, fraction: clamp(ctx.streak / 100) };
    case 'master-adventurer':
      return { current: Math.min(ctx.level, 100), target: 100, fraction: clamp(ctx.level / 100) };
    default:
      return null;
  }
}
