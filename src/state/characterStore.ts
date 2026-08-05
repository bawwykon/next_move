import { create } from 'zustand';

import {
  fetchMastery,
  fetchProfile,
  fetchRecentCompletions,
  type CharacterProfile,
  type CompletionRow,
  type MasteryRow,
} from '@/data/repositories/board';
import { supabase } from '@/data/supabase';
import { dayKey } from '@/domain/streak/dayKey';
import { currentStreak, type Streak } from '@/domain/streak/streak';

export type CharacterStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Ref 03 — one fetched snapshot, cached. Streak display derives from the
 * completions snapshot via pure domain functions (never cached separately),
 * and no economy math lives here.
 */
interface CharacterStore {
  profile: CharacterProfile | null;
  mastery: MasteryRow[] | null;
  streak: Streak | null;
  completions: CompletionRow[] | null;
  fetchedAt: string | null;
  status: CharacterStatus;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useCharacterStore = create<CharacterStore>()((set) => ({
  profile: null,
  mastery: null,
  streak: null,
  completions: null,
  fetchedAt: null,
  status: 'idle',

  refresh: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ status: 'error' });
      return;
    }
    set({ status: 'loading' });

    const [profileResult, completionsResult, masteryResult] = await Promise.all([
      fetchProfile(user.id),
      fetchRecentCompletions(user.id),
      fetchMastery(user.id),
    ]);

    const firstError = [profileResult, completionsResult, masteryResult].find(
      (result) => result.error,
    );
    if (firstError) {
      set({ status: 'error' });
      return;
    }

    const completions = completionsResult.data ?? [];
    const streak = currentStreak(
      completions
        .map((completion) => completion.dayKey)
        .filter((key): key is string => key !== null),
      dayKey(new Date()),
    );

    set({
      profile: profileResult.data,
      completions,
      mastery: masteryResult.data,
      streak,
      fetchedAt: new Date().toISOString(),
      status: 'ready',
    });
  },

  reset: () =>
    set({
      profile: null,
      mastery: null,
      streak: null,
      completions: null,
      fetchedAt: null,
      status: 'idle',
    }),
}));
