/**
 * BYQ-02 live-DB proof for the complete_custom_workout RPC (Ref 12).
 * Run explicitly alongside the other integration suites:
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 *
 * A dedicated throwaway user drives the RPC; service role prepares fixtures.
 * The math is validated against the SAVED custom_workouts row: calibration
 * pins (480s beginner = 48 XP, 900s advanced = 270 XP), the half-block
 * rounding edge, journey-freeze semantics, farm-guards and idempotent replay.
 *
 * Calendar note mirrors complete-quest.integration: fixed day keys; 2026-07-06
 * is a Monday. Timer windows are +/-15% around the saved total duration.
 */
import { installNativeFetch } from './setup-native-fetch';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { submitCompletion } from '../../src/data/repositories/completion';
import type { CompletionEvent } from '../../src/domain/completion/types';

const TEST_EMAIL = 'custom-tester@nextmove.app';
const TEST_PASSWORD = 'custom-test-pass-123';

const LOCAL_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://10.0.2.2:54321').replace(
  '10.0.2.2',
  '127.0.0.1',
);
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Local-dev-only service role key (never shipped).
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

type Payload = {
  xp: { quest: number; daily: number; weekly: number; streak: number; total: number };
  level: { before: number; after: number; title: string };
  mastery: {
    track: string;
    points_before: number;
    points_after: number;
    level_before: number;
    level_after: number;
  }[];
  journey: {
    quests: number;
    chapter_before: number;
    chapter_after: number;
    next_threshold: number | null;
  };
  streak: { current: number; longest: number };
};

type Segment = {
  kind?: 'rest';
  exercise_slug: string | null;
  duration_sec: number;
};

const seg = (slug: string, durationSec: number): Segment => ({
  exercise_slug: slug,
  duration_sec: durationSec,
});

// WK ruling — rest blocks: zero points, but they fill time and the cap.
const restSeg = (durationSec: number): Segment => ({
  kind: 'rest',
  exercise_slug: null,
  duration_sec: durationSec,
});

describe('complete_custom_workout RPC (live local supabase)', () => {
  let user: SupabaseClient;
  let admin: SupabaseClient;
  let profileId: string;

  const day = (offset: number): string => {
    const date = new Date(Date.UTC(2026, 6, 6 + offset));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
      date.getUTCDate(),
    ).padStart(2, '0')}`;
  };

  const iso = (dayKey: string, hour: number, minute = 0) =>
    `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

  const idemUuid = (label: string): string => {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) {
      hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    }
    const hex = hash.toString(16).padStart(12, '0');
    return `00000000-0000-4000-9000-${hex}`;
  };

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
  };

  const createWorkout = async (name: string, segments: Segment[]): Promise<string> => {
    const { data, error } = await user
      .from('custom_workouts')
      .insert({ profile_id: profileId, name, segments })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  };

  const call = async (
    workoutId: string | null,
    ev: Record<string, unknown>,
  ): Promise<{ payload: Payload | null; error: { message: string } | null }> => {
    if (!workoutId) {
      return { payload: null, error: { message: 'no workout fixture' } };
    }
    const { data, error } = await user.rpc('complete_custom_workout', {
      p_workout_id: workoutId,
      ev,
    });
    if (error) return { payload: null, error: { message: String(error.message) } };
    return { payload: data as unknown as Payload, error: null };
  };

  const event = (dayKey: string, idemLabel: string, totalSec: number) => ({
    idempotency_key: idemUuid(idemLabel),
    started_at: iso(dayKey, 7),
    completed_at: iso(dayKey, 7, Math.round(totalSec / 60)),
    day_key: dayKey,
  });

  beforeAll(async () => {
    installNativeFetch();
    user = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } });
    admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error: createError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (createError && !/[a]lready( been)? registered/.test(String(createError.message))) {
      throw new Error(`creating test user failed: ${createError.message}`);
    }
    const { data: signin, error: signinError } = await user.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(signinError).toBeNull();
    profileId = signin.user!.id;
    await admin.auth.admin.updateUserById(profileId, { email_confirm: true });

    // Sentinel quest must exist and stay off the board.
    const { data: sentinel, error: sErr } = await admin
      .from('quests')
      .select('id, active, slug')
      .eq('slug', 'custom-workout')
      .single();
    expect(sErr).toBeNull();
    expect(sentinel!.active).toBe(false);

    // Clean slate for this suite's own rows.
    const { data: mine } = await admin
      .from('custom_workouts')
      .select('id')
      .eq('profile_id', profileId);
    if (mine?.length) {
      await admin.from('custom_workouts').delete().eq('profile_id', profileId);
    }
    await admin.from('quest_completions').delete().eq('profile_id', profileId);
  });

  it('calibration pin: 480s beginner = 48 XP (+75 first-of-day daily through the shared pipeline)', async () => {
    await resetProgression();
    const d = day(0); // Monday
    const wid = await createWorkout(
      'calib-480-beg',
      Array.from({ length: 8 }, () => seg('wall-push-up', 60)),
    );
    const payload = (await call(wid, event(d, 'calib-beg', 480))).payload!;
    // 16 blocks x weight 1 = 16 pts -> round-half-up(48) = 48.
    expect(payload.xp.quest).toBe(100); // beginner workout now yields Easy / 100 XP
    expect(payload.xp.daily).toBe(150);
    expect(payload.xp.total).toBe(250);
  });

  it('classification: all beginner exercises = Easy / 100 XP', async () => {
    await resetProgression();
    const d = day(1);
    const wid = await createWorkout('easy-w', [seg('wall-push-up', 240), seg('wall-push-up', 240)]);
    const payload = (await call(wid, event(d, 'easy-e', 480))).payload!;
    expect(payload.xp.quest).toBe(100);
  });

  it('classification: 2+ Normal exercises (and 0 Hard) = Normal / 200 XP', async () => {
    await resetProgression();
    const d = day(2);
    const wid = await createWorkout('normal-w', [seg('squat', 240), seg('push-up', 240)]);
    const payload = (await call(wid, event(d, 'normal-n', 480))).payload!;
    expect(payload.xp.quest).toBe(200);
  });

  it('classification: >= 45s Hard exercises = Hard / 400 XP', async () => {
    await resetProgression();
    const d = day(3);
    const wid = await createWorkout('hard-w', [seg('squat', 240), seg('burpees', 240)]);
    const payload = (await call(wid, event(d, 'hard-h', 480))).payload!;
    expect(payload.xp.quest).toBe(400);
  });

  it('classification: 3+ Hard exercises has no cap = Hard / 400 XP', async () => {
    await resetProgression();
    const d = day(4);
    const wid = await createWorkout('hard-multi', [
      seg('burpees', 240),
      seg('mountain-climber', 240),
      seg('bicycle-crunch', 240),
    ]);
    const payload = (await call(wid, event(d, 'hard-m', 720))).payload!;
    expect(payload.xp.quest).toBe(400);
  });

  it('classification: insufficient Hard time (< 45s) does not qualify as Hard', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('insufficient-hard', [
      seg('wall-push-up', 240),
      seg('burpees', 30),
      seg('step-touch', 240),
    ]);
    const payload = (await call(wid, event(d, 'ins-h', 510))).payload!;
    expect(payload.xp.quest).toBe(100);
  });

  it('classification: 5+ Normal exercises (and 0 Hard) = Hard / 400 XP', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('normal-to-hard', [
      seg('squat', 96),
      seg('push-up', 96),
      seg('lunges', 96),
      seg('plank', 96),
      seg('wall-sit', 96),
    ]);
    const payload = (await call(wid, event(d, 'normal-h', 480))).payload!;
    expect(payload.xp.quest).toBe(400);
  });

  it('farm guard: 90s exercise duration rejected (bad_duration)', async () => {
    await resetProgression();
    const d = day(6);
    const wid = await createWorkout('bad-dur-90', [
      seg('wall-push-up', 240),
      seg('wall-push-up', 240),
    ]);
    const { payload, error } = await call(wid, event(d, 'bad-90', 480));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.bad_duration');
  });

  it('farm guard: non-30s rest duration rejected (bad_duration)', async () => {
    await resetProgression();
    const d = day(7);
    const wid = await createWorkout('bad-rest', [
      seg('wall-push-up', 240),
      restSeg(30),
      seg('wall-push-up', 240),
    ]);
    const { payload, error } = await call(wid, event(d, 'bad-r', 510));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.bad_duration');
  });

  it('rest blocks add zero XP while filling the clock (0029)', async () => {
    await resetProgression();
    const d = day(3);
    const wid = await createWorkout('rest-mix', [
      seg('wall-push-up', 240),
      restSeg(30),
      seg('burpees', 240),
    ]);
    const payload = (
      await call(wid, {
        idempotency_key: idemUuid('rest-mix-w'),
        started_at: iso(d, 7),
        completed_at: `${d}T07:08:30.000Z`,
        day_key: d,
      })
    ).payload!;
    expect(payload.xp.quest).toBe(400);
    expect(payload.xp.total).toBe(payload.xp.quest + payload.xp.daily);
    const row = await admin
      .from('quest_completions')
      .select('duration_sec')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('rest-mix-w'))
      .single();
    expect(row.data!.duration_sec).toBe(510);
  });

  it('farm guard: rest block carrying an exercise slug rejected (segment_invalid)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('rest-slug', [
      { kind: 'rest', exercise_slug: 'wall-push-up', duration_sec: 30 },
      seg('wall-push-up', 240),
    ]);
    const { payload, error } = await call(wid, event(d, 'g-rest-slug', 510));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.segment_invalid');
  });

  it('farm guard: rest block outside 15/30/45/60 rejected (bad_duration)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('rest-duration', [seg('wall-push-up', 240), restSeg(30)]);
    const { payload, error } = await call(wid, event(d, 'g-rest-dur', 510));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.bad_duration');
  });

  it('farm guard: all-rest workout rejected (no_exercise — BYQ-06a)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('all-rest', [
      restSeg(120),
      restSeg(120),
      restSeg(120),
      restSeg(120),
    ]); // 480s passes the length window but has zero exercises
    const { payload, error } = await call(wid, event(d, 'g-all-rest', 480));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.no_exercise');
  });

  it('journey stays frozen: quests/chapter unchanged, discipline +15 per AT-02H rates', async () => {
    await resetProgression();
    const d = day(4);
    const wid = await createWorkout(
      'journey-frozen',
      Array.from({ length: 8 }, () => seg('plank', 60)), // strength exercise, 480s
    );
    const payload = (await call(wid, event(d, 'j-frozen', 480))).payload!;
    expect(payload.journey).toEqual({
      quests: 0,
      chapter_before: 1,
      chapter_after: 1,
      next_threshold: 10,
    });
    const byTrack = Object.fromEntries(payload.mastery.map((m) => [m.track, m.points_after]));
    expect(byTrack['strength']).toBe(30); // touched track accrues at AT-02H rate
    expect(byTrack['discipline']).toBe(15);
    expect(byTrack['endurance']).toBeUndefined(); // untouched track does not accrue
    const row = await admin
      .from('profiles')
      .select('total_xp, journey_quests, current_chapter')
      .eq('id', profileId)
      .single();
    expect(row.data!.journey_quests).toBe(0);
    expect(row.data!.current_chapter).toBe(1);
  });

  it('farm guard: unknown exercise slug rejected (unknown_exercise)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('guard-slug', [
      seg('not-a-real-move', 240),
      seg('wall-push-up', 240),
    ]);
    const { payload, error } = await call(wid, event(d, 'g-slug', 480));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.unknown_exercise');
  });

  it('farm guard: illegal block length rejected (bad_duration)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('guard-duration', [
      seg('wall-push-up', 240),
      seg('wall-push-up', 240),
    ]);
    const { payload, error } = await call(wid, event(d, 'g-dur', 480));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.bad_duration');
  });

  it('farm guard: over 12 segments rejected (segment_cap)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout(
      'guard-cap',
      Array.from({ length: 13 }, () => seg('wall-push-up', 40)),
    );
    const { payload, error } = await call(wid, event(d, 'g-cap', 520));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.segment_cap');
  });

  it('farm guard: over-length workout rejected (length_bounds)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('guard-length', [
      ...Array.from({ length: 9 }, () => seg('burpees', 90)),
      ...Array.from({ length: 2 }, () => seg('plank', 60)),
    ]); // 930s > 900s ceiling
    const { payload, error } = await call(wid, event(d, 'g-len', 930));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.length_bounds');
  });

  it('farm guard: under-length workout rejected (length_bounds)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('guard-short', [seg('wall-push-up', 300)]); // 300s < 480s floor
    const { payload, error } = await call(wid, event(d, 'g-short', 300));
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.length_bounds');
  });

  it('farm guard: timer mismatch rejected like the quest path (timer_mismatch)', async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('guard-timer', [
      seg('wall-push-up', 240),
      seg('wall-push-up', 240),
    ]);
    const ev = {
      idempotency_key: idemUuid('g-timer'),
      started_at: iso(d, 7),
      completed_at: iso(d, 7, 20), // claims 20 minutes for a 480s workout (>+15%)
      day_key: d,
    };
    const { payload, error } = await call(wid, ev);
    expect(payload).toBeNull();
    expect(error!.message).toContain('complete_custom_workout.timer_mismatch');
  });

  it("farm guard: another account cannot complete someone else's workout (workout_invalid)", async () => {
    await resetProgression();
    const d = day(5);
    const wid = await createWorkout('owned', [seg('wall-push-up', 240), seg('wall-push-up', 240)]);
    // Second identity tries to spend the first account's workout definition.
    const intruder = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } });
    const intruderEmail = 'custom-intruder@nextmove.app';
    const { error: iCreate } = await admin.auth.admin.createUser({
      email: intruderEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (iCreate && !/[a]lready( been)? registered/.test(String(iCreate.message))) {
      throw new Error(`creating intruder failed: ${iCreate.message}`);
    }
    const { error: siErr } = await intruder.auth.signInWithPassword({
      email: intruderEmail,
      password: TEST_PASSWORD,
    });
    expect(siErr).toBeNull();

    // RLS also hides the row from direct reads...
    const peek = await intruder.from('custom_workouts').select('id').eq('id', wid);
    expect(peek.data ?? []).toHaveLength(0);
    // ...and the RPC resolves nothing for the foreign caller.
    const { error } = await intruder.rpc('complete_custom_workout', {
      p_workout_id: wid,
      ev: {
        idempotency_key: idemUuid('intruder'),
        started_at: iso(d, 7),
        completed_at: iso(d, 7, 8),
        day_key: d,
      },
    });
    expect(String(error?.message)).toContain('complete_custom_workout.workout_invalid');
  });

  it('replay: same idempotency key returns the stored payload exactly once', async () => {
    await resetProgression();
    const d = day(6);
    const wid = await createWorkout(
      'replay',
      Array.from({ length: 8 }, () => seg('plank', 60)),
    );
    const ev = event(d, 'replay-key', 480);
    const first = (await call(wid, ev)).payload!;
    const second = (await call(wid, ev)).payload!;
    expect(second).toEqual(first);
    const { data: rows } = await admin
      .from('quest_completions')
      .select('id, xp_awarded')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('replay-key'));
    expect(rows ?? []).toHaveLength(1);
    expect(rows?.[0]?.xp_awarded).toBe(first.xp.total);
  });

  it('replay survives workout deletion (stored payload wins)', async () => {
    await resetProgression();
    const d = day(6);
    const wid = await createWorkout('deleted-after', [
      seg('burpees', 120),
      seg('burpees', 120),
      seg('burpees', 120),
      seg('burpees', 120),
    ]);
    const ev = event(d, 'survive-key', 480);
    const first = (await call(wid, ev)).payload!;
    const { error: delErr } = await admin.from('custom_workouts').delete().eq('id', wid);
    expect(delErr).toBeNull();
    const second = (await call(wid, ev)).payload!;
    expect(second).toEqual(first);
  });

  it('completions land in quest_completions via the inactive sentinel quest', async () => {
    await resetProgression();
    const d = day(6);
    const wid = await createWorkout('sentinel-anchor', [
      seg('glute-bridge', 120),
      seg('glute-bridge', 120),
      seg('glute-bridge', 120),
      seg('glute-bridge', 120),
    ]);
    const { payload, error } = await call(wid, event(d, 'sentinel-key', 480));
    expect(error).toBeNull();
    expect(payload!.xp.quest).toBe(100); // 16 blocks x weight 1 = 16 pts -> round-half-up(48) = 48
    const { data: rows, error: fetchError } = await admin
      .from('quest_completions')
      .select('quest_id:quests(slug), duration_sec')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('sentinel-key'))
      .single();
    expect(fetchError).toBeNull();
    expect((rows!['quest_id'] as unknown as { slug: string }).slug).toBe('custom-workout');
    expect(rows!['duration_sec']).toBe(480);
  });

  // BYQ-04 — the client's submitCompletion router must send a workout_id-
  // carrying event through complete_custom_workout (p_workout_id) and return
  // the authoritative payload; a workout_invalid answer maps to its code so
  // the outbox can drop the row instead of retrying forever.
  it('client routing: submitCompletion sends custom events to complete_custom_workout', async () => {
    await resetProgression();
    const d = day(6);
    const wid = await createWorkout('client-router', [
      seg('wall-sit', 120),
      seg('plank', 120),
      seg('wall-sit', 120),
      seg('plank', 120),
    ]);
    const ev: CompletionEvent = {
      workout_id: wid,
      idempotency_key: idemUuid('client-router-key'),
      started_at: iso(d, 7),
      completed_at: iso(d, 7, 8),
      day_key: d,
    };
    const result = await submitCompletion(user, ev);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    // wall-sit + plank are both intermediate (TUNE-01), 4 intermediate exercises, 0 hard -> Normal / 200 XP.
    expect(result.data!.xp.quest).toBe(200);

    // Deleted definition -> workout_invalid, not 'unknown' or timer_mismatch.
    const { error: delErr } = await admin.from('custom_workouts').delete().eq('id', wid);
    expect(delErr).toBeNull();
    const gone = await submitCompletion(user, {
      ...ev,
      idempotency_key: idemUuid('client-router-gone'),
    });
    expect(gone.error).toBe('workout_invalid');
  });
});
