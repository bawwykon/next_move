/**
 * S7-01 live-DB proof: the journey columns exposed by fetchProfile agree with
 * the pure chapter math, journey_quests counts every stored completion, and
 * the snapshot values are stable across re-fetches (FR-JOURNEY-3 permanence).
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

describe('journey data path (live local supabase)', () => {
  let board: typeof import('../../src/data/repositories/board');
  let journey: typeof import('../../src/domain/journey/chapter');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  beforeAll(async () => {
    installNativeFetch();
    board = jest.requireActual('../../src/data/repositories/board');
    journey = jest.requireActual('../../src/domain/journey/chapter');
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

  it('exposes the server-authoritative journey columns on the profile row', async () => {
    const result = await board.fetchProfile(profileId);
    expect(result.error).toBeNull();
    const profile = result.data!;
    expect(Number.isInteger(profile.journeyQuestCount)).toBe(true);
    expect(profile.journeyQuestCount).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(profile.currentChapter)).toBe(true);
    expect(profile.currentChapter).toBeGreaterThanOrEqual(1);
    expect(profile.currentChapter).toBeLessThanOrEqual(7);
    console.log(
      `profile journey: quests=${profile.journeyQuestCount} chapter=${profile.currentChapter}`,
    );
  });

  it('the client chapter math agrees with the server current_chapter', async () => {
    const profile = (await board.fetchProfile(profileId)).data!;
    const { currentIndex } = journey.chapterForQuests(profile.journeyQuestCount);
    expect(currentIndex + 1).toBe(profile.currentChapter);
    expect(journey.CHAPTERS[currentIndex]!.id).toBe(profile.currentChapter);
    console.log(
      `chapterForQuests(${profile.journeyQuestCount}) → chapter ${currentIndex + 1} (${journey.CHAPTERS[currentIndex]!.name}), server says ${profile.currentChapter}`,
    );
  });

  it('journey_quests is exactly the quest-completion count (permanent)', async () => {
    const { data: rows } = await supabase
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId);
    expect(rows).not.toBeNull();
    const count = rows!.length;
    const profile = (await board.fetchProfile(profileId)).data!;
    expect(profile.journeyQuestCount).toBe(count);
    expect(profile.journeyQuestCount).toBeGreaterThan(0); // demo fixture has completions
    console.log(`journey_quests=${profile.journeyQuestCount} completions=${count}`);
  });

  it('the snapshot is stable across re-fetches (nothing lost, never decreases)', async () => {
    const first = (await board.fetchProfile(profileId)).data!;
    const second = (await board.fetchProfile(profileId)).data!;
    expect(second.journeyQuestCount).toBe(first.journeyQuestCount);
    expect(second.currentChapter).toBe(first.currentChapter);
  });
});
