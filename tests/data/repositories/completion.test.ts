import type { SupabaseClient } from '@supabase/supabase-js';

import { submitCompletion, type CompletionSubmitError } from '@/data/repositories/completion';
import type { Database } from '@/types/database';
import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';

const event: CompletionEvent = {
  quest_id: 'quest-1',
  idempotency_key: '11111111-2222-4333-8444-555555555555',
  started_at: '2026-07-06T07:00:00.000Z',
  completed_at: '2026-07-06T07:08:00.000Z',
  day_key: '2026-07-06',
};

const rpc = jest.fn();
const client = { rpc } as unknown as SupabaseClient<Database>;

const payload = (): CompletionResult => ({
  xp: { quest: 50, daily: 75, weekly: 0, streak: 0, total: 125 },
  level: { before: 1, after: 1, title: 'Beginner' },
  mastery: [
    {
      track: 'mobility',
      points_before: 0,
      points_after: 10,
      level_before: 1,
      level_after: 1,
    },
  ],
  journey: { quests: 1, chapter_before: 1, chapter_after: 1, next_threshold: 10 },
  streak: { current: 1, longest: 1 },
  achievements: [
    {
      id: 'a',
      slug: 'first-quest',
      title: 'First Quest',
      category: 'beginner',
      unlocked_at: '2026-07-06T07:08:00.000Z',
    },
  ],
  cosmetics: [
    {
      id: 'c',
      slug: 'title-adventurer',
      type: 'title',
      name: 'Adventurer',
      unlocked_at: '2026-07-06T07:08:00.000Z',
    },
  ],
});

beforeEach(() => {
  rpc.mockReset();
});

describe('submitCompletion', () => {
  it('forwards the event to complete_quest and returns the authoritative payload', async () => {
    rpc.mockResolvedValueOnce({ data: payload(), error: null });
    const result = await submitCompletion(client, event);

    expect(rpc).toHaveBeenCalledWith('complete_quest', { ev: event });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(payload());
  });

  it('rejects a malformed payload as unknown (never stores a guess)', async () => {
    rpc.mockResolvedValueOnce({ data: { xp: { quest: 'fifty' } }, error: null });
    const result = await submitCompletion(client, event);
    expect(result).toEqual({ data: null, error: 'unknown' });
  });

  it.each<[string, CompletionSubmitError]>([
    ['complete_quest.quest_invalid (PGRST no rows)', 'quest_invalid'],
    ['complete_quest.timer_mismatch', 'timer_mismatch'],
    ['complete_quest.unknown', 'unknown'],
    ['network: fetch failed', 'unknown'],
  ])('maps RPC failure "%s" to the typed code "%s"', async (message, code) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message } });
    const result = await submitCompletion(client, event);
    expect(result).toEqual({ data: null, error: code });
  });
});
