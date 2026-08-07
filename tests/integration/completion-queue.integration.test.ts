/**
 * S5-05 live-DB proof for the offline completion outbox → complete_quest sync.
 * Run explicitly (excluded from CI like the other integration suites):
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 *
 * A dedicated throwaway user drives the queue (enqueue → flush through the
 * real AsyncStorage-backed outbox and the real RPC); service role prepares and
 * clears fixtures. The three specs cover the issued ACs:
 *   - golden: enqueue → flush → outbox empty, state == authoritative payload;
 *   - ack-loss replay: an event already committed server-side still syncs as
 *     an identical-payload no-op with NO double unlock (exactly-once);
 *   - failure retention: a quest_invalid event stays (attempts++), a later
 *     valid event still flushes + unlocks once, the bad row is preserved.
 *
 * Calendar note: the RPC does all day/week math on the client-supplied day_key,
 * never server time. 2026-07-06 is a Monday.
 */
import { installNativeFetch } from './setup-native-fetch';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { enqueueCompletion, flushOutbox, readOutbox } from '@/data/completionQueue';
import { submitCompletion } from '@/data/repositories/completion';
import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const state = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => state.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        state.delete(key);
      }),
      mergeItem: jest.fn(async () => {}),
      clear: jest.fn(async () => {
        state.clear();
      }),
      getAllKeys: jest.fn(async () => Array.from(state.keys())),
      multiGet: jest.fn(async () => []),
      multiSet: jest.fn(async () => {}),
      multiRemove: jest.fn(async () => {}),
      multiMerge: jest.fn(async () => {}),
      flushGetRequests: jest.fn(),
    },
  } as unknown as typeof AsyncStorage;
});

const TEST_EMAIL = 'outbox-queue@nextmove.app';
const TEST_PASSWORD = 'outbox-q-pass-123';

const LOCAL_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://10.0.2.2:54321').replace(
  '10.0.2.2',
  '127.0.0.1',
);
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const iso = (dayKey: string, hour: number, minute = 0) =>
  `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

describe('outbox → complete_quest sync (live local supabase)', () => {
  let user: SupabaseClient;
  let admin: SupabaseClient;
  let profileId: string;
  let questMorning: { id: string; duration_sec: number };

  const day = (offset: number): string => {
    const date = new Date(Date.UTC(2026, 6, 8 + offset));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
      date.getUTCDate(),
    ).padStart(2, '0')}`;
  };

  const idemUuid = (label: string): string => {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) {
      hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    }
    const hex = hash.toString(16).padStart(12, '0');
    return `00000100-0000-4000-8000-${hex}`;
  };

  const eventFor = (dayKey: string, idem: string): CompletionEvent => ({
    quest_id: questMorning.id,
    idempotency_key: idemUuid(idem),
    started_at: iso(dayKey, 7),
    completed_at: iso(dayKey, 7, 8),
    day_key: dayKey,
  });

  const resetProgression = async () => {
    await admin.from('quest_completions').delete().eq('profile_id', profileId);
    await admin.from('mastery').delete().eq('profile_id', profileId);
    await admin.from('streaks_rewards').delete().eq('profile_id', profileId);
    await admin.from('profile_achievements').delete().eq('profile_id', profileId);
    await admin.from('profile_cosmetics').delete().eq('profile_id', profileId);
    const { error } = await admin
      .from('profiles')
      .update({
        total_xp: 0,
        level: 1,
        current_streak: 0,
        longest_streak: 0,
        last_completed_day: null,
        journey_quests: 0,
        current_chapter: 1,
      })
      .eq('id', profileId);
    if (error) throw new Error(`reset failed: ${error.message}`);
    await AsyncStorage.clear();
  };

  // Runs the real flushOutbox against the real RPC; collects every stored
  // authoritative result (the store's onSuccess shape from S5-05).
  const runQueueSync = async (events: CompletionEvent[]) => {
    for (const event of events) {
      await enqueueCompletion(event);
    }
    const synced: { questId: string; result: CompletionResult }[] = [];
    await flushOutbox({
      submit: (ev) => submitCompletion(user, ev),
      onSuccess: (row, result) => {
        synced.push({ questId: row.event.quest_id, result });
      },
    });
    return synced;
  };

  const storedPayload = async (idem: string) => {
    const { data } = await admin
      .from('quest_completions')
      .select('bonus_breakdown')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid(idem))
      .maybeSingle();
    return data?.bonus_breakdown ?? null;
  };

  const profileRow = async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('total_xp, level, journey_quests, current_streak, longest_streak')
      .eq('id', profileId);
    if (error) throw new Error(`profile fetch failed: ${error.message}`);
    return data[0] as Record<string, unknown>;
  };

  beforeAll(async () => {
    installNativeFetch();
    user = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } });
    admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error: createError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    // Re-running the suite hits "user already registered" — that is fine.
    if (createError && !/[a]lready( been)? registered/.test(String(createError.message))) {
      throw new Error(`creating test user failed: ${createError.message}`);
    }
    expect(await admin.auth.getSession()).toMatchObject({ data: { session: null } });
    const { data: signin, error: signinError } = await user.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(signinError).toBeNull();
    profileId = signin.user!.id;

    const { data, error: qerr } = await admin
      .from('quests')
      .select('slug, id, duration_sec')
      .in('slug', ['morning-stretch'])
      .maybeSingle();
    expect(qerr).toBeNull();
    questMorning = {
      id: (data as { id: string }).id,
      duration_sec: (data as { duration_sec: number }).duration_sec,
    };
  });

  it('golden: enqueue → flush → outbox empty and state holds the authoritative payload', async () => {
    await resetProgression();
    const d = day(0);

    const synced = await runQueueSync([eventFor(d, 'g-1')]);

    expect(await readOutbox()).toEqual([]); // delivered, outbox empty
    expect(synced).toHaveLength(1);
    const payload = synced[0]!.result;
    expect(synced[0]!.questId).toBe(questMorning.id);

    // State == authoritative payload: byte-identical to what the server stored.
    expect(JSON.stringify(payload)).toBe(JSON.stringify(await storedPayload('g-1')));

    const profile = await profileRow();
    expect(profile.total_xp).toBe(payload.xp.total);
    expect(profile.journey_quests).toBe(payload.journey.quests);
    expect(payload.xp.quest).toBe(50); // seeded morning-stretch
  });

  it('exactly-once: an ack-lost commit still syncs as a no-op without double unlock', async () => {
    await resetProgression();
    const d = day(2);
    const ev = eventFor(d, 'ack-1');

    // Simulate an in-flight deliver that committed server-side but whose ack
    // never reached the device: call the RPC directly first.
    const direct = await user.rpc('complete_quest', { ev });
    expect(direct.error).toBeNull();

    // Now the outbox plays back the SAME event (same idempotency key).
    const synced = await runQueueSync([ev]);
    expect(await readOutbox()).toEqual([]);
    expect(synced).toHaveLength(1);
    expect(JSON.stringify(synced[0]!.result)).toBe(JSON.stringify(direct.data));

    // Single stored row for the key; totals counted exactly once.
    const { data: rows } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('ack-1'));
    expect(rows!.length).toBe(1);

    const profile = await profileRow();
    const total = (direct.data as unknown as { xp: { total: number } }).xp.total;
    expect(profile.total_xp).toBe(total);
    expect(profile.journey_quests).toBe(1);
  });

  it('failure retention: quest_invalid keeps the row (attempts++), a valid event still flushes without double-unlock', async () => {
    await resetProgression();
    const d = day(4);

    // Dedicated inactive quest fixture so shared content is untouched.
    const { data: inactive, error: insertErr } = await admin
      .from('quests')
      .insert({
        slug: `queue-test-inactive-${Date.now().toString(36)}`,
        title: 'Queue test inactive',
        difficulty: 'easy',
        xp_reward: 50,
        duration_sec: 480,
        categories: ['mobility'],
        active: false,
      })
      .select('id')
      .single();
    expect(insertErr).toBeNull();
    const inactiveId = (inactive as { id: string }).id;

    try {
      const invalidEvent: CompletionEvent = {
        quest_id: inactiveId,
        idempotency_key: idemUuid('off-inactive'),
        started_at: iso(d, 7),
        completed_at: iso(d, 7, 8),
        day_key: d,
      };
      let synced = await runQueueSync([invalidEvent]);

      // The failed event stays queued with attempts 1; nothing was stored.
      expect(synced).toHaveLength(0);
      let rows = await readOutbox();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.event.idempotency_key).toBe(idemUuid('off-inactive'));
      expect(rows[0]!.attempts).toBe(1);
      expect((await profileRow()).journey_quests).toBe(0);

      // A valid event behind it flushes fine; the bad row is still retained.
      const validEvent = eventFor(d, 'recovery-1');
      synced = await runQueueSync([validEvent]);
      expect(synced).toHaveLength(1);
      expect(synced[0]!.result.journey.quests).toBe(1);

      rows = await readOutbox();
      expect(rows).toHaveLength(1); // only the invalid event remains
      expect(rows[0]!.event.idempotency_key).toBe(idemUuid('off-inactive'));
      expect(rows[0]!.attempts).toBe(2);

      // The valid event unlocked exactly once (its own row, not a duplicate).
      const validRows = await admin
        .from('quest_completions')
        .select('id')
        .eq('profile_id', profileId)
        .eq('idempotency_key', idemUuid('recovery-1'));
      expect((validRows.data ?? []).length).toBe(1);
    } finally {
      await admin.from('quests').delete().eq('id', inactiveId);
    }
  });
});
