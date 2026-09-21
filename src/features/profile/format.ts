/**
 * S8-01 — pure display formatting for the Profile character page (FR-PROF-1/2,
 * FR-XP-2/3, FR-MAS-4, FR-STR-2). Host-agnostic: every function here takes
 * plain data and returns plain strings/rows; nothing reads state, fetches, or
 * renders. The level/mastery numbers are mirrors of the server curves
 * (src/domain/xp/level.ts) over server-authoritative columns — display only.
 */
import type { TFunction } from 'i18next';

import { masteryProgress, masteryLevelForPoints, xpProgress } from '@/domain/xp/level';
import { COSMETIC_SLOTS, resolveEquipped, type CosmeticSlot } from '@/domain/cosmetics/loadout';
import { nextStreakMilestone } from '@/domain/streak/milestone';
import { cosmeticName, questTitle } from '@/features/catalog/copy';
import { masteryLevelTitle, masteryTrackLabel } from '@/features/victory/format';

/** Thousands-grouped, locale-independent (tests pin the exact grouping). */
export function formatXp(xp: number): string {
  const digits = String(Math.max(0, Math.floor(xp)));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * CUSTOM-AVATAR — display precedence for the profile avatar circle: the
 * uploaded photo URL wins, otherwise the equipped RPG portrait art renders.
 * The `bust` nonce is appended only after a fresh upload/remove so expo-image
 * refetches exactly once (a stable URL keeps its cache across restarts).
 */
export function avatarDisplayUrl(url: string | null, bust: number): string | null {
  if (!url) {
    return null;
  }
  return bust > 0 ? `${url}?t=${bust}` : url;
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

export function levelLine(level: number, t: TFunction): string {
  const lv = Math.max(1, level);
  return t('profile.levelLine', { n: lv, title: levelTitleFor(lv, t) });
}

/**
 * FR-XP-3 level title string (Beginner → Legend ladder, mirrors the server's
 * `level_title`). Kept here as the single display-side source; `level_title` in
 * the victory payload comes from the server itself (FR-XP-7).
 * Copy comes from the locale tables via `t` (I18N-01).
 */
export function levelTitleFor(level: number, t: TFunction): string {
  if (level >= 100) return t('profile.levelTitles.legend');
  if (level >= 50) return t('profile.levelTitles.champion');
  if (level >= 25) return t('profile.levelTitles.warrior');
  if (level >= 10) return t('profile.levelTitles.adventurer');
  if (level >= 5) return t('profile.levelTitles.apprentice');
  return t('profile.levelTitles.beginner');
}

export interface StreakCopy {
  /** FR-STR-2 — always encouraging; active vs resting copy. */
  primary: string;
  /** Longest streak, shown only when > 0. */
  longest: string | null;
}

export function streakCopy(current: number, longest: number, t: TFunction): StreakCopy {
  if (current > 0) {
    return {
      primary: t('board.streakActive', { count: current }),
      longest: longest > current ? t('profile.bestSingle', { n: longest }) : null,
    };
  }
  return {
    primary: t('board.streakIdle'),
    longest: longest > 0 ? t('profile.bestDays', { n: longest }) : null,
  };
}

/**
 * S9-02 — the streak-milestone countdown line, shared by the Profile streak
 * row and the board pill. Uses the S9-01 domain mirror of the server ladder
 * (0011/0020): whole days until the next paid milestone, null once the top
 * (100-day) rung is passed. Encouragement-only phrasing (FR-STR-2).
 * Copy comes from the locale tables via `t` (I18N-01).
 *
 * I18N-AR — pass locale='ar' to use the explicit-suffix Arabic path: Hermes
 * lacks full Intl.PluralRules so the resolver can't be trusted with Arabic's
 * six plural forms, and the stock template can't inflect its embedded
 * {{days}}. At streak 0 (daysTo === days) Arabic uses a dedicated
 * non-redundant phrasing instead of "N على مكافأة N".
 */
export function streakMilestoneLine(
  current: number,
  t: TFunction,
  locale: string = 'en',
): string | null {
  const next = nextStreakMilestone(current);
  if (!next) {
    return null;
  }
  if (locale === 'ar') {
    const a = arabicDayWord(next.daysTo, t);
    const b = arabicDayWord(next.days, t);
    if (next.daysTo === next.days) {
      return t('board.streakMilestoneSame', { b });
    }
    return t('board.streakMilestoneAr', { a, b });
  }
  return t('board.streakMilestone', { count: next.daysTo, days: next.days });
}

/** Explicit CLDR-faithful Arabic day-word (no resolver dependence). */
function arabicDayWord(n: number, t: TFunction): string {
  const count = Math.max(0, Math.floor(n));
  const mod100 = count % 100;
  const suffix =
    count === 0
      ? 'zero'
      : count === 1
        ? 'one'
        : count === 2
          ? 'two'
          : mod100 >= 3 && mod100 <= 10
            ? 'few'
            : mod100 >= 11 && mod100 <= 99
              ? 'many'
              : 'other';
  return t(`board.dayLength_${suffix}`, { count });
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
 * of `mastery.points` via the server rank ladder (1..20, 0047).
 */
export function masteryRows(
  rows: readonly { track: string; points: number }[],
  t: TFunction,
): MasteryDisplayRow[] {
  const byTrack = new Map(rows.map((row) => [row.track, Math.max(0, row.points)]));
  return TRACK_ORDER.map((track) => {
    const points = byTrack.get(track) ?? 0;
    const level = masteryLevelForPoints(points);
    const progress = masteryProgress(points);
    return {
      track,
      label: masteryTrackLabel(track, t),
      points,
      level,
      levelTitle: masteryLevelTitle(level, t),
      fraction: progress.fraction,
      into: progress.into,
      needed: progress.needed,
    };
  });
}

export interface LoadoutSlot {
  slot: 'Frame' | 'Nameplate' | 'Portrait';
  /** Display name of the currently equipped item, or null when none. */
  name: string | null;
}

/** Cosmetic catalogue row shape the loadout resolver needs (id → name). */
export interface CosmeticRef {
  id: string;
  slug: string;
  name: string;
}

const SLOT_LABELS: Record<CosmeticSlot, LoadoutSlot['slot']> = {
  frame: 'Frame',
  nameplate: 'Nameplate',
  portrait: 'Portrait',
};

/**
 * FR-PROF-2 — the equipped loadout (display-only). Resolves the three
 * `equipped_*` profile uuids against the catalogue; an unset slot falls back
 * to the seeded defaults ('frame-default', 'portrait-default'); the others
 * render as empty. Delegates to the S8-02 domain resolver (single source).
 */
export function loadoutSlots(
  equipped: {
    frame: string | null;
    nameplate: string | null;
    portrait: string | null;
  },
  catalog: readonly CosmeticRef[],
): LoadoutSlot[] {
  const resolved = resolveEquipped(equipped, catalog);
  return COSMETIC_SLOTS.map((slot) => ({
    slot: SLOT_LABELS[slot]!,
    // A broken equipped id (no catalogue match) renders as empty rather than
    // claiming the default look; only a truly unset slot falls back.
    name:
      resolved[slot].equippedName ??
      (resolved[slot].usingDefault ? resolved[slot].defaultName : null) ??
      null,
  }));
}

/** S8-02 — locked picker rows show a "?" emblem (like achievements), never a rule. */
export const LOCKED_PICKER_EMBLEM = '?';

/**
 * The exact strings a picker row renders. Owned items show just their name;
 * unowned items show the emblem + name. This is the leak-guard surface: the
 * rules that DERIVED ownership live server-side and are never projected, so
 * this output can carry nothing but names and the "?" mark.
 * Names resolve through the catalog tables when a slug + `t` are provided
 * (CATALOG-01); otherwise the given name renders as-is.
 */
export function pickerRowStrings(
  item: { owned: boolean; name: string; slug?: string },
  t?: TFunction,
): readonly string[] {
  const name = item.slug && t ? (cosmeticName(item.slug, item.name, t) ?? item.name) : item.name;
  return item.owned ? [name] : [LOCKED_PICKER_EMBLEM, name];
}

/**
 * Calendar-day label, deterministic on plain YYYY-MM-DD keys (the day the
 * completion happened in the PROFILE light) — Today / Yesterday / "Aug 6".
 * Month names and order come from the locale tables via `t` (I18N-01).
 */
export function dayLabel(dayKey: string | null, todayKey: string, t: TFunction): string {
  if (!dayKey) {
    return '—';
  }
  if (dayKey === todayKey) {
    return t('profile.today');
  }
  const yesterday = new Date(`${todayKey}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dayKey === yesterday.toISOString().slice(0, 10)) {
    return t('profile.yesterday');
  }
  const parts = dayKey.split('-');
  const month = Number(parts[1]);
  const months = t('profile.months', { returnObjects: true }) as unknown as string[];
  const mon = months[month - 1] ?? '';
  return t('profile.dateShort', { mon, d: Number(parts[2]) });
}

export interface HistoryItem {
  questTitle: string | null;
  dayLabel: string;
  xp: number;
}

/**
 * Quest-history display lines. Skips nothing: every fetched completion maps
 * to a row (title may be null only when the join missed — never dropped).
 * Titles resolve through the catalog tables via `t` (CATALOG-01); rows
 * without a slug keep the DB title as-is.
 */
export function historyLines(
  rows: readonly {
    questTitle: string | null;
    questSlug?: string | null;
    dayKey: string | null;
    xp: number;
  }[],
  todayKey: string,
  t: TFunction,
): HistoryItem[] {
  return rows.map((row) => ({
    questTitle:
      row.questSlug != null
        ? (questTitle(row.questSlug, row.questTitle, t) ?? row.questTitle)
        : row.questTitle,
    dayLabel: dayLabel(row.dayKey, todayKey, t),
    xp: row.xp,
  }));
}

/** Paging is exhausted once a page returns fewer rows than its limit. */
export function historyExhausted(rowsCount: number, pageSize: number): boolean {
  return rowsCount < pageSize;
}

export function achievementsEntry(count: number, t: TFunction): string {
  return t('profile.unlocksEarned', { count });
}
