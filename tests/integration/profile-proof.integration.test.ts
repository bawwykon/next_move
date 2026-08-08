/**
 * S8-01 live-DB proof (FR-PROF-1/2): the full profile row exposes every
 * server-authoritative progression column; the cosmetic catalogue is exactly
 * 18 rows with no leaks; the completion history is a 30-day DESC-sorted,
 * quest-joined window; progress/level/streak mirrors agree; the loadout
 * resolver returns the seeded defaults for an unequipped profile.
 * Run explicitly (excluded from CI):
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 */
import { installNativeFetch } from './setup-native-fetch';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

const DEMO_EMAIL = 'demo@nextmove.app';
const DEMO_PASSWORD = 'demo-pass-123';

describe('profile data path (live local supabase)', () => {
  let board: typeof import('../../src/data/repositories/board');
  let cosmeticsRepo: typeof import('../../src/data/repositories/cosmetics');
  let historyRepo: typeof import('../../src/data/repositories/history');
  let achievementsRepo: typeof import('../../src/data/repositories/achievements');
  let level: typeof import('../../src/domain/xp/level');
  let format: typeof import('../../src/features/profile/format');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  beforeAll(async () => {
    installNativeFetch();
    board = jest.requireActual('../../src/data/repositories/board');
    cosmeticsRepo = jest.requireActual('../../src/data/repositories/cosmetics');
    historyRepo = jest.requireActual('../../src/data/repositories/history');
    achievementsRepo = jest.requireActual('../../src/data/repositories/achievements');
    level = jest.requireActual('../../src/domain/xp/level');
    format = jest.requireActual('../../src/features/profile/format');
    supabase = jest.requireActual('../../src/data/supabase').supabase;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (error || !data.user) {
      throw new Error(`sign in failed: ${error?.message}`);
    }
    profileId = data.user.id;
  });

  it('loads the full profile row (level, XP, streaks, equipped)', async () => {
    const result = await board.fetchProfile(profileId);
    expect(result.error).toBeNull();
    const profile = result.data!;

    expect(Number.isInteger(profile.totalXp)).toBe(true);
    expect(profile.totalXp).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(profile.level)).toBe(true);
    expect(profile.level).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(profile.currentStreak)).toBe(true);
    expect(profile.currentStreak).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(profile.longestStreak)).toBe(true);
    expect(profile.longestStreak).toBeGreaterThanOrEqual(profile.currentStreak);
    expect(typeof profile.lastCompletedDay).toBe('string');
    for (const slot of ['frame', 'title', 'background', 'portrait'] as const) {
      expect(profile.equipped[slot] === null || typeof profile.equipped[slot] === 'string').toBe(
        true,
      );
    }

    // The demo profile is unequipped — loadout resolution must fall back to the
    // seeded defaults (FR-PROF-2 display-only resolution).
    const catalog = (await cosmeticsRepo.fetchCosmeticCatalog()).data ?? [];
    const slots = format.loadoutSlots(profile.equipped, catalog);
    expect(slots[0]?.name).toBe('Classic Frame');
    expect(slots[3]?.name).toBe('Classic Portrait');
    console.log(
      `profile: level=${profile.level} xp=${profile.totalXp} streak=${profile.currentStreak}/${profile.longestStreak} last=${profile.lastCompletedDay}`,
    );
  });

  it('the client level curve agrees with the level column', async () => {
    const profile = (await board.fetchProfile(profileId)).data!;
    const { start } = level.levelXpBounds(profile.level);
    expect(profile.totalXp).toBeGreaterThanOrEqual(start);
    // Sanity: the level the server computed must be the one the curve implies.
    const next = level.levelXpBounds(profile.level + 1);
    expect(profile.totalXp).toBeLessThan(next.start);
    console.log(`level ${profile.level} holds ${start}…<${next.start} (total ${profile.totalXp})`);
  });

  it('the cosmetic catalogue is exactly 18 items with only id/kind/name/slug', async () => {
    const result = await cosmeticsRepo.fetchCosmeticCatalog();
    expect(result.error).toBeNull();
    const catalog = result.data ?? [];
    expect(catalog).toHaveLength(18);
    const slugs = new Set(catalog.map((row) => row.slug));
    expect(slugs.size).toBe(18);
    for (const row of catalog) {
      expect(Object.keys(row).sort()).toEqual(['id', 'kind', 'name', 'slug']);
    }
    expect(catalog.some((row) => row.slug === 'frame-default')).toBe(true);
    expect(catalog.some((row) => row.slug === 'portrait-default')).toBe(true);
    console.log(`catalog: ${catalog.map((row) => row.slug).join(' | ')}`);
  });

  it('completion history is windowed, newest-first, quest-joined', async () => {
    const result = await historyRepo.fetchCompletionHistory(profileId, {
      limit: 20,
      offset: 0,
    });
    expect(result.error).toBeNull();
    const rows = result.data ?? [];
    expect(rows.length).toBeGreaterThan(0);

    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let previous: string | null = null;
    for (const row of rows) {
      expect(row.completedAt >= cutoff).toBe(true);
      expect(row.questTitle).not.toBeNull();
      expect(row.questSlug).not.toBeNull();
      if (previous !== null) {
        expect(row.completedAt <= previous).toBe(true);
      }
      previous = row.completedAt;
    }

    // Page semantics: a full page is not exhausted yet (pure helper).
    expect(format.historyExhausted(rows.length, 20)).toBe(rows.length < 20);
    console.log(`history: ${rows.length} rows (≤30d, desc)`);
  });

  it('the recorded achievements unlock count matches the badge entry', async () => {
    const unlocks = (await achievementsRepo.fetchProfileAchievements(profileId)).data ?? [];
    expect(unlocks.length).toBeGreaterThanOrEqual(1);
    const entry = format.achievementsEntry(unlocks.length);
    expect(entry).toContain(`${unlocks.length}`);
    console.log(`unlocked achievements: ${unlocks.length} → "${entry}"`);
  });

  it('foreign profile ids yield empty rows, not errors', async () => {
    const foreignId = '00000000-0000-4000-8000-000000000000';
    const history = await historyRepo.fetchCompletionHistory(foreignId, { limit: 20, offset: 0 });
    expect(history.error).toBeNull();
    expect(history.data ?? []).toEqual([]);
  });
});
