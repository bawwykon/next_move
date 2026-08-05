/**
 * S3-01 live-DB proof: exercises the real repositories against the local
 * Supabase stack. Run explicitly (excluded from CI):
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 * Repos are imported dynamically so the native fetch shim is installed first.
 */
import { installNativeFetch } from './setup-native-fetch';

/**
 * jest-expo automocks expo-secure-store (getItemAsync → undefined), which
 * breaks supabase's session persistence (getSession reads storage). Install a
 * working in-memory implementation for the live-DB test.
 */
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

describe('board data path (local supabase)', () => {
  let board: typeof import('../../src/data/repositories/board');
  let questsRepo: typeof import('../../src/data/repositories/quests');
  let streakDomain: typeof import('../../src/domain/streak/streak');
  let dayKeyDomain: typeof import('../../src/domain/streak/dayKey');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  beforeAll(async () => {
    installNativeFetch();
    board = jest.requireActual('../../src/data/repositories/board');
    questsRepo = jest.requireActual('../../src/data/repositories/quests');
    streakDomain = jest.requireActual('../../src/domain/streak/streak');
    dayKeyDomain = jest.requireActual('../../src/domain/streak/dayKey');
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

  it('returns 10 active quests sorted by difficulty then slug, with segment counts', async () => {
    const result = await questsRepo.fetchActiveQuests();
    expect(result.error).toBeNull();
    const quests = result.data!;
    expect(quests).toHaveLength(10);

    expect(quests.map((quest) => quest.difficulty)).toEqual([
      'easy',
      'easy',
      'easy',
      'easy',
      'easy',
      'normal',
      'normal',
      'normal',
      'hard',
      'hard',
    ]);
    const slugs = quests.map((quest) => quest.slug);
    expect(slugs.slice(0, 5)).toEqual(slugs.slice(0, 5).sort());
    expect(slugs.slice(5, 8)).toEqual(slugs.slice(5, 8).sort());
    expect(slugs.slice(8)).toEqual(slugs.slice(8).sort());

    const morningStretch = quests.find((quest) => quest.slug === 'morning-stretch')!;
    expect(morningStretch.segmentCount).toBe(5);
    expect(morningStretch.totalDurationSec).toBe(480);
    for (const quest of quests) {
      expect(quest.segmentCount).toBeGreaterThan(0);
      expect(quest.totalDurationSec).toBeGreaterThan(0);
    }
  });

  it('fetches the recent completions with day_key for the demo user', async () => {
    const result = await board.fetchRecentCompletions(profileId);
    expect(result.error).toBeNull();
    const completions = result.data!;
    expect(completions.length).toBeGreaterThanOrEqual(3);
    const today = dayKeyDomain.dayKey(new Date());
    const yesterday = dayKeyDomain.dayKey(new Date(Date.now() - 86_400_000));
    expect(completions.some((completion) => completion.dayKey === today)).toBe(true);
    expect(completions.some((completion) => completion.dayKey === yesterday)).toBe(true);
    for (const completion of completions) {
      expect(completion.completedAt).toBeTruthy();
      expect(completion.xpAwarded).toBe(50);
    }
    console.log(
      'completions:',
      completions
        .map(
          (completion) =>
            `${completion.questId.slice(0, 8)} day=${completion.dayKey} xp=${completion.xpAwarded}`,
        )
        .join(' | '),
    );
  });

  it('derives streak 2/2 from the local completions snapshot', async () => {
    const completions = (await board.fetchRecentCompletions(profileId)).data!;
    const streak = streakDomain.currentStreak(
      completions
        .map((completion) => completion.dayKey)
        .filter((key): key is string => key !== null),
      dayKeyDomain.dayKey(new Date()),
    );
    expect(streak).toEqual({ current: 2, longest: 2 });
    console.log(
      `streak(today=${dayKeyDomain.dayKey(new Date())}): current=${streak.current} longest=${streak.longest}`,
    );
  });

  it('fetches the four mastery rows for the demo user', async () => {
    const result = await board.fetchMastery(profileId);
    expect(result.error).toBeNull();
    const rows = result.data!;
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.track).sort()).toEqual([
      'discipline',
      'endurance',
      'mobility',
      'strength',
    ]);
    console.log('mastery:', rows.map((row) => `${row.track}=${row.points}`).join(' | '));
  });

  it('fetches the demo profile', async () => {
    const result = await board.fetchProfile(profileId);
    expect(result.error).toBeNull();
    expect(result.data!.displayName).toBe('Adventurer');
    expect(result.data!.onboarded).toBe(true);
    console.log(`profile: ${result.data!.displayName} onboarded=${result.data!.onboarded}`);
  });
});
