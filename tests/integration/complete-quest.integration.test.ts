/**
 * S5-01 live-DB proof for the server-authoritative complete_quest RPC.
 * Run explicitly (excluded from CI like board-proof):
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 *
 * A dedicated throwaway user (created here) drives every RPC call; a
 * service-role client prepares/cleans fixtures only. The demo user's seeded
 * progression is left untouched so the S3 board-proof suite can run in the
 * same invocation without interference.
 *
 * Calendar note: the RPC does all day/week math on the client-supplied day_key
 * ('YYYY-MM-DD', local per Ref 05 tz), never on server time, so tests use fixed
 * day keys. 2026-07-06 is a Monday (Mon-Sun weekly windows).
 */
import { installNativeFetch } from './setup-native-fetch';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TEST_EMAIL = 'rpc-tester@nextmove.app';
const TEST_PASSWORD = 'rpc-test-pass-123';

const LOCAL_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://10.0.2.2:54321').replace(
  '10.0.2.2',
  '127.0.0.1',
);
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Local-dev-only service role key (never shipped; the RPC itself is always
// called with the signed-in user's session).
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
  achievements: {
    id: string;
    slug: string;
    title: string;
    category: string;
    unlocked_at: string;
  }[];
  cosmetics: {
    id: string;
    slug: string;
    type: string;
    name: string;
    unlocked_at: string;
  }[];
};

const iso = (dayKey: string, hour: number, minute = 0) =>
  `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;

describe('complete_quest RPC (live local supabase)', () => {
  let user: SupabaseClient;
  let admin: SupabaseClient;
  let profileId: string;

  let questMorning: { id: string; xp_reward: number; duration_sec: number };
  let questStrength: { id: string; xp_reward: number; duration_sec: number };

  const day = (offset: number): string => {
    const date = new Date(Date.UTC(2026, 6, 6 + offset));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
      date.getUTCDate(),
    ).padStart(2, '0')}`;
  };

  // Deterministic UUID from a short idempotency label (stable across runs, so
  // replay/cleanup tests can re-assert on the same key).
  const idemUuid = (label: string): string => {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) {
      hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    }
    const hex = hash.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };

  const event = (
    questId: string,
    dayKey: string,
    idempotencyKey: string,
    startIso: string,
    endIso: string,
  ) => ({
    quest_id: questId,
    idempotency_key: idemUuid(idempotencyKey),
    started_at: startIso,
    completed_at: endIso,
    day_key: dayKey,
  });

  const easyEvent = (dayKey: string, idem: string, hour: number, minute = 0) =>
    event(questMorning.id, dayKey, idem, iso(dayKey, hour), iso(dayKey, hour, minute + 8));
  const hardEvent = (dayKey: string, idem: string, hour: number, minute = 0) =>
    event(questStrength.id, dayKey, idem, iso(dayKey, hour), iso(dayKey, hour, minute + 15));

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

  const seedSameDayCompletion = async (dayKey: string) => {
    await admin.from('quest_completions').insert({
      profile_id: profileId,
      quest_id: questMorning.id,
      idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      started_at: iso(dayKey, 6),
      completed_at: iso(dayKey, 6, 8),
      duration_sec: 480,
      xp_awarded: 50,
      bonus_breakdown: {},
      mastered: ['mobility', 'discipline'],
      day_key: dayKey,
    });
    const { error } = await admin
      .from('profiles')
      .update({ current_streak: 1, last_completed_day: dayKey })
      .eq('id', profileId);
    if (error) throw new Error(`seed profile failed: ${error.message}`);
  };

  const call = async (ev: Record<string, string>) => {
    const { data, error } = await user.rpc('complete_quest', { ev });
    if (error) return { payload: null as Payload | null, error };
    return { payload: data as unknown as Payload, error: null };
  };

  const callOk = async (ev: Record<string, string>): Promise<Payload> => {
    const result = await call(ev);
    expect(result.error).toBeNull();
    return result.payload as Payload;
  };

  const profileRow = async () => {
    const { data, error } = await admin
      .from('profiles')
      .select(
        'total_xp, level, current_streak, longest_streak, last_completed_day, journey_quests, current_chapter',
      )
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
    // The admin API must never leave a session on the service-role client,
    // otherwise admin writes would run as the rpc-tester (authenticated) role
    // and be blocked by the progression guard.
    expect(await admin.auth.getSession()).toMatchObject({ data: { session: null } });
    const { data: signin, error: signinError } = await user.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(signinError).toBeNull();
    profileId = signin.user!.id;
    await admin.auth.admin.updateUserById(profileId, { email_confirm: true });

    const { data, error: qerr } = await admin
      .from('quests')
      .select('slug, id, xp_reward, duration_sec')
      .in('slug', ['morning-stretch', 'strength-builder']);
    expect(qerr).toBeNull();
    const list = (data ?? []) as {
      slug: string;
      id: string;
      xp_reward: number;
      duration_sec: number;
    }[];
    const morning = list.find((q) => q.slug === 'morning-stretch')!;
    const strength = list.find((q) => q.slug === 'strength-builder')!;
    questMorning = {
      id: morning.id,
      xp_reward: morning.xp_reward,
      duration_sec: morning.duration_sec,
    };
    questStrength = {
      id: strength.id,
      xp_reward: strength.xp_reward,
      duration_sec: strength.duration_sec,
    };
    expect(strength.xp_reward).toBe(200);
  });

  it('golden: fresh progression, first-of-day excluded -> 50/50 xp, mastery +10/+5', async () => {
    await resetProgression();
    const d = day(0); // Monday 2026-07-06
    await seedSameDayCompletion(d); // makes this not the first completion of that day

    const result = await call(easyEvent(d, 'golden-0001', 7));
    expect(result.error).toBeNull();
    const payload = result.payload!;
    console.log('GOLDEN payload:', JSON.stringify(payload));

    expect(payload.xp).toEqual({ quest: 50, daily: 0, weekly: 0, streak: 0, total: 50 });
    expect(payload.level).toEqual({ before: 1, after: 1, title: 'Beginner' });
    expect(payload.journey).toEqual({
      quests: 1,
      chapter_before: 1,
      chapter_after: 1,
      next_threshold: 10,
    });
    expect(payload.streak).toEqual({ current: 1, longest: 1 });
    // S5-02: the first completion unlocks first-quest and, chained to it, the
    // title-adventurer cosmetic — exactly once.
    expect(payload.achievements).toHaveLength(1);
    expect(payload.achievements[0]).toMatchObject({
      slug: 'first-quest',
      title: 'First Quest',
      category: 'beginner',
    });
    expect(typeof payload.achievements[0]!.unlocked_at).toBe('string');
    expect(payload.cosmetics).toHaveLength(1);
    expect(payload.cosmetics[0]).toMatchObject({
      slug: 'title-adventurer',
      type: 'title',
      name: 'Adventurer',
    });

    const mobility = payload.mastery.find((m) => m.track === 'mobility');
    const discipline = payload.mastery.find((m) => m.track === 'discipline');
    expect(mobility).toMatchObject({
      points_before: 0,
      points_after: 10,
      level_before: 1,
      level_after: 1,
    });
    expect(discipline).toMatchObject({
      points_before: 0,
      points_after: 5,
      level_before: 1,
      level_after: 1,
    });

    const { data: completions } = await admin
      .from('quest_completions')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });
    const golden = completions![completions!.length - 1];
    expect(completions!.length).toBe(2); // the seed + this completion
    expect(golden.day_key).toBe(d);
    expect(golden.xp_awarded).toBe(50);
    expect((golden.bonus_breakdown as { xp: { total: number } }).xp.total).toBe(50);
    expect(golden.mastered).toEqual(['mobility', 'discipline']);

    const { data: mastery } = await admin
      .from('mastery')
      .select('track, points')
      .eq('profile_id', profileId);
    const byTrack = Object.fromEntries(
      (mastery ?? []).map((m: { track: string; points: number }) => [m.track, m.points]),
    );
    expect(byTrack).toEqual({ mobility: 10, discipline: 5 });

    const profile = await profileRow();
    expect(profile.total_xp).toBe(50);
    expect(profile.level).toBe(1);
    expect(profile.journey_quests).toBe(1);
    expect(profile.current_chapter).toBe(1);
    expect(profile.last_completed_day).toBe(d);
  });

  it('replay: same idempotency_key -> single stored row and identical payload', async () => {
    await resetProgression();
    const d = day(10);
    const ev = event(questMorning.id, d, 'replay-0001', iso(d, 8), iso(d, 8, 8));
    const first = await call(ev);
    const second = await call(ev);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(JSON.stringify(second.payload)).toBe(JSON.stringify(first.payload));

    const { data: rows } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('replay-0001'));
    expect(rows!.length).toBe(1);
  });

  it('daily bonus: +75 on the first completion of a day, 0 on the second, +75 again the next day', async () => {
    await resetProgression();
    const d1 = day(12);
    const d2 = day(13);
    const one = await callOk(easyEvent(d1, 'daily-1', 8));
    const two = await callOk(easyEvent(d1, 'daily-2', 9));
    const three = await callOk(easyEvent(d2, 'daily-3', 8));
    expect(one.xp.daily).toBe(75);
    expect(two.xp.daily).toBe(0);
    expect(three.xp.daily).toBe(75);
    expect(two.xp.quest).toBe(50);
    expect(one.xp.total).toBe(125);
    console.log('DAILY:', JSON.stringify([one.xp, two.xp, three.xp]));
  });

  it('weekly bonus: +500 exactly on the 3rd completion within a Mon-Sun week', async () => {
    await resetProgression();
    const mon = day(7); // 2026-07-13 (Monday)
    const tue = day(8);
    const wed = day(9);
    const thu = day(10);
    const c1 = await callOk(easyEvent(mon, 'week-1', 8));
    const c2 = await callOk(easyEvent(tue, 'week-2', 8));
    const c3 = await callOk(easyEvent(wed, 'week-3', 8));
    const c4 = await callOk(easyEvent(thu, 'week-4', 8));
    expect([c1, c2, c3, c4].map((c) => c.xp.weekly)).toEqual([0, 0, 500, 0]);
    console.log('WEEKLY:', [c1, c2, c3, c4].map((c) => c.xp.weekly).join(','));
  });

  it('streak: climbs 1,2,3 (milestone day 3 = +50, rewards row), a gap resets with longest preserved', async () => {
    await resetProgression();
    const days = [day(20), day(21), day(22)];
    const results: Payload[] = [];
    for (let i = 0; i < days.length; i += 1) {
      const d = days[i]!;
      results.push(await callOk(easyEvent(d, `str-${i}`, 8)));
    }
    expect(results[0]!.streak).toEqual({ current: 1, longest: 1 });
    expect(results[1]!.streak).toEqual({ current: 2, longest: 2 });
    expect(results[2]!.streak).toEqual({ current: 3, longest: 3 });
    expect(results[2]!.xp.streak).toBe(50);

    const { data: rewards } = await admin
      .from('streaks_rewards')
      .select('reward_day')
      .eq('profile_id', profileId)
      .order('reward_day', { ascending: true });
    expect((rewards ?? []).map((r: { reward_day: number }) => r.reward_day)).toEqual([3]);

    // a gap of 3 days resets the current streak but longest stays 3
    const gapDay = day(26);
    const gap = await callOk(easyEvent(gapDay, 'str-gap', 8));
    expect(gap.streak).toEqual({ current: 1, longest: 3 });
    console.log(
      'STREAK:',
      JSON.stringify(results.map((r) => r.streak)),
      'gap->',
      JSON.stringify(gap.streak),
    );
  });

  it('level curve: crossing 100 XP lands on level 2 with title Beginner and exact totals', async () => {
    await resetProgression();
    const d = day(30);
    const r = await callOk(hardEvent(d, 'lvl-1', 8));
    expect(r.level.after).toBe(2);
    expect(r.level.title).toBe('Beginner');
    expect(r.level.before).toBe(1);
    expect(r.xp.quest).toBe(200);
    expect(r.xp.total).toBe(200 + r.xp.daily);
    console.log('LEVEL:', JSON.stringify(r.level), 'total', r.xp.total);

    const profile = await profileRow();
    expect(profile.total_xp).toBe(r.xp.total);
    expect(profile.level).toBe(2);
  });

  it('sum across three hard quests in one week reproduces the running total exactly', async () => {
    await resetProgression();
    const daysArr = [day(24), day(25), day(26)];
    const xpParts: { quest: number; daily: number; weekly: number; streak: number }[] = [];
    for (let i = 0; i < daysArr.length; i += 1) {
      const d = daysArr[i]!;
      const r = await call(hardEvent(d, `comb-${i}`, 8));
      expect(r.error).toBeNull();
      xpParts.push(r.payload!.xp);
    }
    const finalTotal = xpParts.reduce((sum, p) => sum + p.quest + p.daily + p.weekly + p.streak, 0);
    const profile = await profileRow();
    expect(profile.total_xp).toBe(finalTotal);
    expect(profile.journey_quests).toBe(3);
    console.log(
      'PARTS:',
      JSON.stringify(xpParts),
      'derived_total',
      finalTotal,
      'stored',
      profile.total_xp,
    );
  });

  it('timer_mismatch: a fabricated out-of-tolerance duration is rejected with no write', async () => {
    await resetProgression();
    const d = day(30);
    // completed "10 minutes" after a 480s quest = 600s vs 480s (over the +15% band)
    const ev = event(questMorning.id, d, 'tm-1', iso(d, 8), iso(d, 8, 10));
    const result = await call(ev);
    expect(result.error).not.toBeNull();
    expect(String(result.error!.message)).toContain('timer_mismatch');

    const { data: rows } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('idempotency_key', idemUuid('tm-1'));
    expect(rows!.length).toBe(0);
  });

  it('quest_invalid: an inactive quest is rejected', async () => {
    await resetProgression();
    // Dedicated inactive quest row so the shared active content is untouched
    // (the board-proof suite may be reading it concurrently).
    const { data: inactive, error: insertErr } = await admin
      .from('quests')
      .insert({
        slug: `rpc-test-inactive-${Date.now().toString(36)}`,
        title: 'RPC test inactive',
        difficulty: 'easy',
        xp_reward: 50,
        duration_sec: 480,
        categories: ['mobility'],
        active: false,
      })
      .select('id')
      .single();
    expect(insertErr).toBeNull();
    if (insertErr || !inactive?.id) throw new Error('failed to create inactive quest fixture');
    try {
      const d = day(33);
      const result = await call(
        event(inactive.id as string, d, 'inactive-1', iso(d, 8), iso(d, 8, 8)),
      );
      expect(result.error).not.toBeNull();
      expect(String(result.error!.message)).toMatch(/quest_invalid/);
    } finally {
      await admin.from('quests').delete().eq('id', inactive.id);
    }
    const { data: rows } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId);
    expect(rows!.length).toBe(0);
  });

  it('auth: anon cannot call the RPC and clients have no insert paths to progression tables', async () => {
    const anon = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } });
    const result = await anon.rpc('complete_quest', {});
    expect(result.error).not.toBeNull();

    await resetProgression();
    const direct = await user.from('quest_completions').insert({
      profile_id: profileId,
      quest_id: questMorning.id,
      idempotency_key: 'x',
    });
    expect(direct.error).not.toBeNull();
    const masteryInsert = await user
      .from('mastery')
      .insert({ profile_id: profileId, track: 'strength', points: 1 });
    expect(masteryInsert.error).not.toBeNull();
    const rewardsInsert = await user
      .from('streaks_rewards')
      .insert({ profile_id: profileId, reward_day: 3 });
    expect(rewardsInsert.error).not.toBeNull();
  });

  it('guard: the signed-in user cannot tamper with progression columns directly', async () => {
    await resetProgression();
    const tamper = await user
      .from('profiles')
      .update({ total_xp: 999999, level: 99 })
      .eq('id', profileId);
    expect(tamper.error).not.toBeNull();
    const row = await profileRow();
    expect(row.total_xp).toBe(0);
    expect(row.level).toBe(1);
    console.log('TAMPER blocked, profile intact:', JSON.stringify(row));
  });

  // FR-JOURNEY-4 / FR-MAS-3 / FR-XP-3 boundary proofs. The pure SQL helpers are
  // called through PostgREST (live DB), and the journey/title transitions are
  // driven end-to-end through the RPC by seeding progression via the trusted
  // service role (the RPC math then runs on top of those fixtures).
  const sqlFn = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const raw = admin as unknown as {
      rpc: (
        name: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await raw.rpc(fn, args);
    if (error) throw new Error(`${fn} failed: ${error.message}`);
    return data;
  };

  it('journey chapters: chapter_for_quests flips at 10/30/60/100/200/365 (end-to-end via RPC)', async () => {
    await resetProgression();
    const bounds = [
      { below: 9, at: 10, before: 1, after: 2 },
      { below: 29, at: 30, before: 2, after: 3 },
      { below: 59, at: 60, before: 3, after: 4 },
      { below: 99, at: 100, before: 4, after: 5 },
      { below: 199, at: 200, before: 5, after: 6 },
      { below: 364, at: 365, before: 6, after: 7 },
    ];
    for (let i = 0; i < bounds.length; i += 1) {
      const b = bounds[i]!;
      const set = await admin
        .from('profiles')
        .update({ journey_quests: b.below })
        .eq('id', profileId);
      expect(set.error).toBeNull();
      const d = day(40 + i);
      const r = await callOk(easyEvent(d, `ch-${b.below}`, 8));
      expect(r.journey.quests).toBe(b.at);
      expect(r.journey.chapter_before).toBe(b.before);
      expect(r.journey.chapter_after).toBe(b.after);
      expect(await sqlFn('chapter_for_quests', { quests: b.below })).toBe(b.before);
      expect(await sqlFn('chapter_for_quests', { quests: b.at })).toBe(b.after);
    }
    expect(await sqlFn('chapter_for_quests', { quests: 0 })).toBe(1);
  });

  it('mastery levels: mastery_level_for_points at 0/250/500 (and cap 10)', async () => {
    const cases = [
      { points: 0, level: 1 },
      { points: 249, level: 1 },
      { points: 250, level: 2 },
      { points: 499, level: 2 },
      { points: 500, level: 3 },
      { points: 2499, level: 10 },
      { points: 2500, level: 10 },
    ];
    for (const c of cases) {
      expect(await sqlFn('mastery_level_for_points', { points: c.points })).toBe(c.level);
    }

    await resetProgression();
    // End-to-end: 240 seeded mobility points +10 from a completed quest -> 250 -> level 2.
    const seedPts = await admin
      .from('mastery')
      .insert({ profile_id: profileId, track: 'mobility', points: 240 });
    expect(seedPts.error).toBeNull();
    const d = day(47);
    const r = await callOk(easyEvent(d, 'mas-240', 8));
    const mobility = r.mastery.find((m) => m.track === 'mobility')!;
    expect(mobility.points_before).toBe(240);
    expect(mobility.points_after).toBe(250);
    expect(mobility.level_before).toBe(1);
    expect(mobility.level_after).toBe(2);
  });

  it('titles: level_title matches FR-XP-3 at 5/10/25/50/100 (end-to-end via RPC)', async () => {
    const cases = [
      { level: 4, title: 'Beginner' },
      { level: 5, title: 'Apprentice' },
      { level: 9, title: 'Apprentice' },
      { level: 10, title: 'Adventurer' },
      { level: 24, title: 'Adventurer' },
      { level: 25, title: 'Warrior' },
      { level: 49, title: 'Warrior' },
      { level: 50, title: 'Champion' },
      { level: 99, title: 'Champion' },
      { level: 100, title: 'Legend' },
    ];
    for (const c of cases) {
      expect(await sqlFn('level_title', { level: c.level })).toBe(c.title);
    }

    await resetProgression();
    // End-to-end: seed total_xp so the completed quest lands the level exactly
    // on a title boundary (level 5 = 1000 XP; hard quest grants 200 XP). The
    // profile level column must also be the level for the seeded XP so the
    // RPC's 'before' reflects the pre-completion state.
    const setXp = await admin
      .from('profiles')
      .update({ total_xp: 800, level: 4 })
      .eq('id', profileId);
    expect(setXp.error).toBeNull();
    const d = day(48);
    await seedSameDayCompletion(d); // avoid the first-of-day bonus skewing the total
    const r = await callOk(hardEvent(d, 'ttl-5', 8));
    expect(r.xp.quest).toBe(200);
    expect(r.xp.daily).toBe(0);
    expect(r.level.before).toBe(4);
    expect(r.level.after).toBe(5);
    expect(r.level.title).toBe('Apprentice');
    const profile = await profileRow();
    expect(profile.total_xp).toBe(1000);
    expect(profile.level).toBe(5);
  });

  // S5-02: achievements + cosmetics unlocks (ED-21). Each spec proves exactly-once:
  // the unlock appears in the payload the moment it happens, a replay of the same
  // event returns the stored payload untouched, and a later event never re-lists it.

  const ownedByAchievementRows = async (slug: string) => {
    const { data, error } = await admin
      .from('profile_achievements')
      .select('achievement_id')
      .eq('profile_id', profileId);
    if (error) throw new Error(`profile_achievements fetch failed: ${error.message}`);
    const ids = (data ?? []).map((r: { achievement_id: string }) => r.achievement_id);
    if (ids.length === 0) return [];
    const { data: defs, error: defsErr } = await admin
      .from('achievements')
      .select('id, slug')
      .in('id', ids);
    if (defsErr) throw new Error(`achievements fetch failed: ${defsErr.message}`);
    return (defs ?? []).filter((a: { slug: string }) => a.slug === slug);
  };

  it('first-quest: unlocks on completion #1, never again (replay + follow-up)', async () => {
    await resetProgression();
    const d = day(80);
    await seedSameDayCompletion(d); // keep the payoff to 50/50 so first-quest is the only unlock
    const ev = event(questMorning.id, d, 's52-fq-1', iso(d, 7), iso(d, 7, 8));
    const first = await callOk(ev);
    expect(first.achievements.map((a) => a.slug)).toContain('first-quest');
    expect(first.cosmetics.map((c) => c.slug)).toContain('title-adventurer');

    // replay of the same event -> identical stored payload, no new unlock
    const replay = await callOk(ev);
    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));
    expect(await ownedByAchievementRows('first-quest')).toHaveLength(1);

    // a brand-new completion does NOT re-list first-quest (already owned)
    const d2 = day(51);
    const next = await callOk(easyEvent(d2, 'first52-fq-2', 7));
    expect(next.achievements.map((a) => a.slug)).not.toContain('first-quest');
    expect(await ownedByAchievementRows('first-quest')).toHaveLength(1);
  }, 30000);

  it('first-level: crossing level 2 unlocks first-level exactly once', async () => {
    await resetProgression();
    const d = day(52);
    const r = await callOk(hardEvent(d, 'first-level-1', 8));
    expect(r.level.before).toBe(1);
    expect(r.level.after).toBe(2);
    expect(r.achievements.map((a) => a.slug)).toContain('first-level');
    expect(await ownedByAchievementRows('first-level')).toHaveLength(1);
    const d2 = day(53);
    const next = await callOk(hardEvent(d2, 'first-level-2', 8));
    expect(next.achievements.map((a) => a.slug)).not.toContain('first-level');
  }, 30000);

  it('streak-7: seven consecutive days unlock streak-7 exactly once', async () => {
    await resetProgression();
    const slugs: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = day(60 + i);
      const r = await callOk(easyEvent(d, `streak7-${i}`, 8));
      slugs.push(...r.achievements.map((a) => a.slug));
    }
    expect(slugs).toContain('streak-7');
    expect(await ownedByAchievementRows('streak-7')).toHaveLength(1);
    const d8 = day(67);
    const next = await callOk(easyEvent(d8, 'streak7-8', 8));
    expect(next.achievements.map((a) => a.slug)).not.toContain('streak-7');
  }, 60000);

  it('first-week: 7 distinct completion days unlock first-week', async () => {
    await resetProgression();
    // Seed six distinct days via the trusted role, then complete a 7th via RPC.
    const seeds = [...Array(6)].map((_, i) => ({
      profile_id: profileId,
      quest_id: questMorning.id,
      idempotency_key: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      started_at: iso(day(70 + i), 6),
      completed_at: iso(day(70 + i), 6, 8),
      duration_sec: 480,
      xp_awarded: 50,
      bonus_breakdown: {},
      mastered: ['mobility', 'discipline'],
      day_key: day(70 + i),
    }));
    const ins = await admin.from('quest_completions').insert(seeds);
    expect(ins.error).toBeNull();
    const d = day(76);
    const r = await callOk(easyEvent(d, 'first-week-1', 8));
    expect(r.achievements.map((a) => a.slug)).toContain('first-week');
    expect(await ownedByAchievementRows('first-week')).toHaveLength(1);
  }, 30000);

  it('phoenix: an 8-day gap return unlocks phoenix + portrait-phoenix', async () => {
    await resetProgression();
    // Day -1 then a completion 9 days later => v_day - v_last_day = 9 >= 8.
    const d0 = day(85);
    await callOk(easyEvent(d0, 'phoenix-before', 8));
    const d1 = day(94);
    const r = await callOk(easyEvent(d1, 'phoenix-return', 8));
    expect(r.achievements.map((a) => a.slug)).toContain('phoenix');
    expect(r.cosmetics.map((c) => c.slug)).toContain('portrait-phoenix');
    expect(await ownedByAchievementRows('phoenix')).toHaveLength(1);
  }, 30000);

  it('master-adventurer: reaching level 100 unlocks it + frame-le-100 + portrait-master', async () => {
    await resetProgression();
    // Level 100 needs 50*100*99 = 495000 XP; hard quest grants 200 on top.
    const setProfile = await admin
      .from('profiles')
      .update({ total_xp: 495000 - 200, level: 99, journey_quests: 0 })
      .eq('id', profileId);
    expect(setProfile.error).toBeNull();
    const d = day(105);
    await seedSameDayCompletion(d); // avoid first-of-day bonus so the total is exact
    const r = await callOk(hardEvent(d, 'master-1', 8));
    expect(r.level.after).toBe(100);
    expect(r.achievements.map((a) => a.slug)).toContain('master-adventurer');
    expect(r.cosmetics.map((c) => c.slug)).toContain('frame-level-100');
    expect(r.cosmetics.map((c) => c.slug)).toContain('portrait-master');
    expect(await ownedByAchievementRows('master-adventurer')).toHaveLength(1);
  }, 30000);

  it('frame-level-05: reaching level 5 unlocks the frame + title cosmetics', async () => {
    await resetProgression();
    const adminUpdate = await admin
      .from('profiles')
      .update({ total_xp: 800, level: 4 })
      .eq('id', profileId);
    expect(adminUpdate.error).toBeNull();
    const d = day(108);
    await seedSameDayCompletion(d); // 800 + 200 = 1000 -> level 5 exactly
    const r = await callOk(hardEvent(d, 'frame-5', 8));
    expect(r.level.after).toBe(5);
    expect(r.cosmetics.map((c) => c.slug)).toContain('frame-level-05');
    expect(r.cosmetics.map((c) => c.slug)).toContain('title-level-05');
  }, 30000);

  it('early-bird: the 100th pre-10:00 UTC completion unlocks early-bird, night-owl stays locked', async () => {
    await resetProgression();
    // Seed 99 pre-10:00 (UTC) completions; hour = 9 < 10.
    const seeds = [...Array(99)].map((_, i) => ({
      profile_id: profileId,
      quest_id: questMorning.id,
      idempotency_key: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      started_at: `${day(110 + i)}T09:00:00.000Z`,
      completed_at: `${day(110 + i)}T09:08:00.000Z`,
      duration_sec: 480,
      xp_awarded: 50,
      bonus_breakdown: {},
      mastered: [],
      day_key: day(110 + i),
    }));
    const ins = await admin.from('quest_completions').insert(seeds);
    expect(ins.error).toBeNull();
    const d = day(209);
    // The 100th completion, started BEFORE 10:00 UTC (hour 8).
    const r = await callOk(easyEvent(d, 'early-100', 8));
    expect(r.achievements.map((a) => a.slug)).toContain('early-bird');
    expect(r.achievements.map((a) => a.slug)).not.toContain('night-owl');
    expect(await ownedByAchievementRows('early-bird')).toHaveLength(1);
  }, 60000);

  it('night-owl: the 100th at/after 20:00 UTC completion unlocks night-owl', async () => {
    await resetProgression();
    const seeds = [...Array(99)].map((_, i) => ({
      profile_id: profileId,
      quest_id: questMorning.id,
      idempotency_key: `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      started_at: `${day(220 + i)}T21:00:00.000Z`,
      completed_at: `${day(220 + i)}T21:08:00.000Z`,
      duration_sec: 480,
      xp_awarded: 50,
      bonus_breakdown: {},
      mastered: [],
      day_key: day(220 + i),
    }));
    const ins = await admin.from('quest_completions').insert(seeds);
    expect(ins.error).toBeNull();
    const d = day(319);
    const r = await callOk(easyEvent(d, 'owl-100', 21));
    expect(r.achievements.map((a) => a.slug)).toContain('night-owl');
    expect(r.achievements.map((a) => a.slug)).not.toContain('early-bird');
    expect(await ownedByAchievementRows('night-owl')).toHaveLength(1);
  }, 60000);
});
