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
  let windowDomain: typeof import('../../src/domain/board/window');
  let completedToday: typeof import('../../src/features/questBoard/completedToday');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  beforeAll(async () => {
    installNativeFetch();
    board = jest.requireActual('../../src/data/repositories/board');
    questsRepo = jest.requireActual('../../src/data/repositories/quests');
    streakDomain = jest.requireActual('../../src/domain/streak/streak');
    dayKeyDomain = jest.requireActual('../../src/domain/streak/dayKey');
    windowDomain = jest.requireActual('../../src/domain/board/window');
    completedToday = jest.requireActual('../../src/features/questBoard/completedToday');
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

  // Seed rows store day_key computed from now() in the Postgres UTC calendar,
  // while dayKeyDomain.dayKey uses local host time. Compute the expected
  // today/yesterday keys in the seed's UTC frame so these assertions hold on
  // any host zone.
  const utcDayKey = (ms: number): string => {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const utcToday = () => utcDayKey(Date.now());
  const utcYesterday = () => utcDayKey(Date.now() - 86_400_000);

  it('fetches the recent completions with day_key for the demo user', async () => {
    const result = await board.fetchRecentCompletions(profileId);
    expect(result.error).toBeNull();
    const completions = result.data!;
    expect(completions.length).toBeGreaterThanOrEqual(3);
    const today = utcToday();
    const yesterday = utcYesterday();
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
      utcToday(),
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

  // S6-02 — local-day rollover against the live seed. The demo user's seed
  // completes only today/yesterday (UTC-frame now()), so any new local day past
  // that is guaranteed completion-free: "done today" must clear, and a brand-new
  // weekly window must start pending (no stale card). All instants are built in
  // the host's local calendar so the specs hold in any timezone.
  it('local-day rollover (fake clock): prior done-today cleared, no stale weekly card', async () => {
    const completions = (await board.fetchRecentCompletions(profileId)).data!;
    const quests = (await questsRepo.fetchActiveQuests()).data!;

    // Two days from now, in local calendar terms — past any seeded completion
    // (today + yesterday) on every host.
    const now = new Date();
    const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 12, 0, 0, 0);
    const futureKey = dayKeyDomain.dayKey(future);
    expect(futureKey).not.toBe(dayKeyDomain.dayKey(now));

    // Frame bounds are literal local midnights: the day ends exactly at the next
    // local midnight and the week runs Monday 00:00 → next Monday 00:00 − 1ms
    // (both DST-safe); `challengeState` on a zero-completion week is never stale.
    const day = windowDomain.dayWindow(future);
    expect(day.endMs).toBe(
      new Date(future.getFullYear(), future.getMonth(), future.getDate() + 1).getTime(),
    );
    const fresh = windowDomain.weeklyWindow(future, 0);
    expect(fresh.startMs).toBe(
      new Date(
        future.getFullYear(),
        future.getMonth(),
        future.getDate() - ((future.getDay() + 6) % 7),
      ).getTime(),
    );
    expect(new Date(fresh.startMs).getDay()).toBe(1); // literal Monday, local frame
    expect(fresh.endMs).toBe(fresh.rollsOverOn - 1);
    expect(fresh.challengeState).toBe('pending'); // new week, not stale

    // FR-BOARD-7 — "done today" re-derives from the new key: false for every
    // quest on the board, even ones completed today.
    for (const quest of quests) {
      expect(completedToday.isCompletedToday(completions, quest.id, futureKey)).toBe(false);
    }
    console.log(
      `rollover ${now.toISOString()} → ${futureKey}: fresh=${fresh.challengeState} done-this-week=${fresh.completionsInWindow}`,
    );
  });

  it('weekly card keeps counting its real in-window completions (never stale-empty)', async () => {
    const completions = (await board.fetchRecentCompletions(profileId)).data!;
    const doneThisWeek = completions.filter((c) => c.dayKey !== null).length;
    const current = windowDomain.weeklyWindow(new Date(), doneThisWeek);
    expect(current.completionsInWindow).toBe(doneThisWeek);
    expect(current.challengeState).not.toBe('pending'); // seed has ≥ 1 in-window
    console.log(
      `current ${current.challengeState} (${current.completionsInWindow}/${windowDomain.WEEKLY_TARGET})`,
    );
  });
});
