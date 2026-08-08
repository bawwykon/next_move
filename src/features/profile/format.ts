/**
 * S8-01 — pure display formatting for the Profile character page (FR-PROF-1/2,
 * FR-XP-2/3, FR-MAS-4, FR-STR-2). Host-agnostic: every function here takes
 * plain data and returns plain strings/rows; nothing reads state, fetches, or
 * renders. The level/mastery numbers are mirrors of the server curves
 * (src/domain/xp/level.ts) over server-authoritative columns — display only.
 */
import { masteryProgress, masteryLevelForPoints, xpProgress } from '@/domain/xp/level';
import { masteryLevelTitle, masteryTrackLabel } from '@/features/victory/format';

/** Thousands-grouped, locale-independent (tests pin the exact grouping). */
export function formatXp(xp: number): string {
  const digits = String(Math.max(0, Math.floor(xp)));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface XpBar {
  intoXp: number;
  neededXp: number;
  totalXp: number;
  fraction: number;
}

export function xpBar(totalXp: number, level: number): XpBar {
  const progress = xpProgress(totalXp, level);
  return {
    intoXp: progress.into,
    neededXp: progress.needed,
    totalXp: Math.max(0, totalXp),
    fraction: progress.fraction,
  };
}

export function levelLine(level: number): string {
  return `Level ${Math.max(1, level)} · ${levelTitleFor(level)}`;
}

/**
 * FR-XP-3 level title string (Beginner → Legend ladder, mirrors the server's
 * `level_title`). Kept here as the single display-side source; `level_title` in
 * the victory payload comes from the server itself (FR-XP-7).
 */
export function levelTitleFor(level: number): string {
  if (level >= 100) return 'Legend';
  if (level >= 50) return 'Champion';
  if (level >= 25) return 'Warrior';
  if (level >= 10) return 'Adventurer';
  if (level >= 5) return 'Apprentice';
  return 'Beginner';
}

export interface StreakCopy {
  /** FR-STR-2 — always encouraging; active vs resting copy. */
  primary: string;
  /** Longest streak, shown only when > 0. */
  longest: string | null;
}

export function streakCopy(current: number, longest: number): StreakCopy {
  if (current > 0) {
    return {
      primary: `${current} ${current === 1 ? 'day' : 'days'} strong`,
      longest: longest > current ? `Best: ${longest}` : null,
    };
  }
  return {
    primary: 'Your adventure is waiting. Your next quest is ready.',
    longest: longest > 0 ? `Best: ${longest} days` : null,
  };
}

export interface MasteryDisplayRow {
  track: string;
  label: string;
  points: number;
  level: number;
  levelTitle: string;
  fraction: number;
  into: number;
  needed: number;
}

const TRACK_ORDER: readonly ('strength' | 'endurance' | 'mobility' | 'discipline')[] = [
  'strength',
  'endurance',
  'mobility',
  'discipline',
];

/**
 * FR-MAS-4 — the four mastery bars in a fixed order, each a pure derivation
 * of `mastery.points` via the server curve (floor(points/250)+1, cap 10).
 */
export function masteryRows(
  rows: readonly { track: string; points: number }[],
): MasteryDisplayRow[] {
  const byTrack = new Map(rows.map((row) => [row.track, Math.max(0, row.points)]));
  return TRACK_ORDER.map((track) => {
    const points = byTrack.get(track) ?? 0;
    const level = masteryLevelForPoints(points);
    const progress = masteryProgress(points);
    return {
      track,
      label: masteryTrackLabel(track),
      points,
      level,
      levelTitle: masteryLevelTitle(level),
      fraction: progress.fraction,
      into: progress.into,
      needed: progress.needed,
    };
  });
}

export interface LoadoutSlot {
  slot: 'Frame' | 'Title' | 'Background' | 'Portrait';
  /** Display name of the currently equipped item, or null when none. */
  name: string | null;
}

/** Cosmetic catalogue row shape the loadout resolver needs (id → name). */
export interface CosmeticRef {
  id: string;
  slug: string;
  name: string;
}

/**
 * FR-PROF-2 — the equipped loadout is display-only. Resolves the four
 * `equipped_*` profile uuids against the catalogue; an unset slot falls back
 * to the seeded defaults ('frame-default', 'portrait-default'); the others
 * render as empty.
 */
export function loadoutSlots(
  equipped: {
    frame: string | null;
    title: string | null;
    background: string | null;
    portrait: string | null;
  },
  catalog: readonly CosmeticRef[],
): LoadoutSlot[] {
  const byId = new Map(catalog.map((row) => [row.id, row]));
  const bySlug = new Map(catalog.map((row) => [row.slug, row.name]));
  const resolve = (id: string | null, fallbackSlug: string | null): string | null => {
    if (id && byId.has(id)) {
      return byId.get(id)?.name ?? null;
    }
    if (!id && fallbackSlug && bySlug.has(fallbackSlug)) {
      return bySlug.get(fallbackSlug) ?? null;
    }
    return null;
  };
  return [
    { slot: 'Frame', name: resolve(equipped.frame, 'frame-default') },
    { slot: 'Title', name: resolve(equipped.title, null) },
    { slot: 'Background', name: resolve(equipped.background, null) },
    { slot: 'Portrait', name: resolve(equipped.portrait, 'portrait-default') },
  ];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Calendar-day label, deterministic on plain YYYY-MM-DD keys (the day the
 * completion happened in the PROFILE light) — Today / Yesterday / "Aug 6".
 */
export function dayLabel(dayKey: string | null, todayKey: string): string {
  if (!dayKey) {
    return '—';
  }
  if (dayKey === todayKey) {
    return 'Today';
  }
  const yesterday = new Date(`${todayKey}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dayKey === yesterday.toISOString().slice(0, 10)) {
    return 'Yesterday';
  }
  const parts = dayKey.split('-');
  const month = Number(parts[1]);
  return `${MONTHS[month - 1] ?? ''} ${Number(parts[2])}`;
}

export interface HistoryItem {
  questTitle: string | null;
  dayLabel: string;
  xp: number;
}

/**
 * Quest-history display lines. Skips nothing: every fetched completion maps
 * to a row (title may be null only when the join missed — never dropped).
 */
export function historyLines(
  rows: readonly { questTitle: string | null; dayKey: string | null; xp: number }[],
  todayKey: string,
): HistoryItem[] {
  return rows.map((row) => ({
    questTitle: row.questTitle,
    dayLabel: dayLabel(row.dayKey, todayKey),
    xp: row.xp,
  }));
}

/** Paging is exhausted once a page returns fewer rows than its limit. */
export function historyExhausted(rowsCount: number, pageSize: number): boolean {
  return rowsCount < pageSize;
}

export function achievementsEntry(count: number): string {
  return `${count} ${count === 1 ? 'unlock' : 'unlocks'} earned`;
}
