/**
 * S7-02 live-DB proof: the achievement catalogue is fetched by the repo (13
 * rows, unlock_rule excluded — defense in depth), the demo profile has the
 * seeded unlock with a sane unlocked_at, and RLS silently filters other
 * users' rows. Run explicitly (excluded from CI):
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
const OTHER_USER_ID = 'ffffffff-0000-4000-8000-000000000000';

describe('achievements data path (live local supabase)', () => {
  let achievementsRepo: typeof import('../../src/data/repositories/achievements');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  beforeAll(async () => {
    installNativeFetch();
    achievementsRepo = jest.requireActual('../../src/data/repositories/achievements');
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

  it('fetches the full catalogue: 13 rows, non-empty copy fields, unique slugs', async () => {
    const result = await achievementsRepo.fetchAchievementCatalog();
    expect(result.error).toBeNull();
    const catalog = result.data!;
    expect(catalog).toHaveLength(13);
    for (const row of catalog) {
      expect(row.slug).toBeTruthy();
      expect(row.title).toBeTruthy();
      expect(row.description).toBeTruthy();
      expect(row.hint).toBeTruthy();
      expect(['beginner', 'progress', 'consistency', 'special']).toContain(row.category);
    }
    expect(new Set(catalog.map((row) => row.slug)).size).toBe(13);
    console.log('catalog:', catalog.map((row) => row.slug).join(' | '));
  });

  it('excludes the machine-readable unlock_rule from every fetched row (no client leak)', async () => {
    const result = await achievementsRepo.fetchAchievementCatalog();
    expect(result.error).toBeNull();
    for (const row of result.data!) {
      const keys = Object.keys(row);
      expect(keys).not.toContain('unlock_rule');
      expect(keys).not.toContain('kind');
      expect(keys).not.toContain('count');
    }
  });

  it('lists the demo unlocks (N ≥ 1) with unlocked_at ascending; locked = 13 − N', async () => {
    const catalog = (await achievementsRepo.fetchAchievementCatalog()).data!;
    const unlocks = (await achievementsRepo.fetchProfileAchievements(profileId)).data!;
    expect(unlocks.length).toBeGreaterThanOrEqual(1);

    const ascending = unlocks.every(
      (unlock, index, all) => index === 0 || all[index - 1]!.unlockedAt <= unlock.unlockedAt,
    );
    expect(ascending).toBe(true);

    const slugs = new Set(unlocks.map((unlock) => unlock.slug));
    expect(slugs.size).toBe(unlocks.length); // no dupes in the join
    for (const unlock of unlocks) {
      expect(catalog.some((row) => row.slug === unlock.slug)).toBe(true);
    }

    const locked = catalog.filter((row) => !slugs.has(row.slug)).length;
    expect(locked).toBe(13 - unlocks.length);
    console.log(
      `demo: unlocked=${unlocks.length} locked=${locked} -> ${unlocks.map((u) => u.slug).join(' | ')}`,
    );
  });

  it('RLS: querying another user id yields no rows, not an error', async () => {
    const result = await achievementsRepo.fetchProfileAchievements(OTHER_USER_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
