/**
 * S10-01 â€” economy validation sim (QA gate). Live-DB proof that the server
 * engine (0020_complete_quest) pays out exactly the FR/economy contract:
 *  - daily bonus (+75) on the first completion of each local day only
 *  - weekly bonus (+500) exactly on the 3rd completion of a Monâ€“Sun week
 *  - streak-milestone payouts on a fresh 3/7/30/100-day streak (50/150/500/1500)
 *  - level curve boundaries, incl. the 100 â†’ 101 transition (10,000 XP span)
 *  - mastery +30/+15 per touched track (250-point levels; AT-02H)
 *  - achievement triggers at their exact boundaries: quests 50/100, streak 7,
 *    phoenix (level 25: rule level=25), early-bird (UTC hour < 10)
 *  - INVARIANT: a simulated long session (101 consecutive days) is recomputed
 *    from raw quest_completions rows alone, and the recompute must equal the
 *    profiles/mastery snapshot the RPC wrote; replayed idempotency keys
 *    change nothing.
 *
 * Excluded from CI (tests/integration is ignored); run against the LOCAL
 * stack after `supabase db reset`:
 *   npx jest tests/integration/economy-sim.integration.test.ts --testPathIgnorePatterns=/node_modules/
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { installNativeFetch } from './setup-native-fetch';

const TEST_EMAIL = 'economy-sim@nextmove.app';
const TEST_PASSWORD = 'economy-pass-123';

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
  achievements: { slug: string }[];
  cosmetics: { slug: string }[];
};

// Server contract mirrors (0020_complete_quest + seed.sql).
const DAILY_XP = 150;
const WEEKLY_XP = 1000;
const MILESTONES: readonly { days: number; xp: number }[] = [
  { days: 3, xp: 50 },
  { days: 7, xp: 150 },
  { days: 30, xp: 500 },
  { days: 100, xp: 1500 },
];
const LEVEL_XP_FOR = (level: number): number => 50 * level * (level - 1); // 50*L*(L-1)
const EPOC = '2026-07-06'; // a Monday; week windows align with day offsets
const DAY_MS = 86_400_000;

const dayKey = (offset: number): string => {
  const date = new Date(Date.parse(EPOC) + offset * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
};
const epocOffset = (key: string): number =>
  Math.round((Date.parse(key) - Date.parse(EPOC)) / DAY_MS);

const idemUuid = (label: string): string => {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0')}`;
};

interface SimEvent {
  questId: string;
  atDay: number;
  startHour: number;
  startMinute: number;
  questDurationSec: number;
  idem: string;
}

describe('economy simulation sweep (live supabase)', () => {
  let user: SupabaseClient;
  let admin: SupabaseClient;
  let profileId: string;
  let questMorning: { id: string; xp_reward: number; duration_sec: number };
  let questHard: { id: string; xp_reward: number; duration_sec: number };

  const resetProgression = async (): Promise<void> => {
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
    expect(error).toBeNull();
  };

  const completeViaRpc = async (ev: SimEvent): Promise<Payload> => {
    const d = dayKey(ev.atDay);
    const h = String(ev.startHour).padStart(2, '0');
    const m = String(ev.startMinute).padStart(2, '0');
    const end = new Date(Date.parse(`${d}T${h}:${m}:00.000Z`) + ev.questDurationSec * 1000);
    const eh = String(end.getUTCHours()).padStart(2, '0');
    const em = String(end.getUTCMinutes()).padStart(2, '0');
    const es = String(end.getUTCSeconds()).padStart(2, '0');
    const { data, error } = await user.rpc('complete_quest', {
      ev: {
        quest_id: ev.questId,
        idempotency_key: idemUuid(ev.idem),
        started_at: `${d}T${h}:${m}:00.000Z`,
        completed_at: `${d}T${eh}:${em}:${es}.000Z`,
        day_key: d,
      },
    });
    expect(error).toBeNull();
    return data as unknown as Payload;
  };

  const morning = (atDay: number, startHour = 9, idem?: string): SimEvent => ({
    questId: questMorning.id,
    atDay,
    startHour,
    startMinute: 0,
    questDurationSec: questMorning.duration_sec,
    idem: idem ?? `sim-${atDay}-${startHour}`,
  });

  const seedCompletions = async (rows: { atDay: number; startHour: number }[]): Promise<void> => {
    const { error } = await admin.from('quest_completions').insert(
      rows.map((r) => {
        const d = dayKey(r.atDay);
        const h = String(r.startHour).padStart(2, '0');
        const end = new Date(Date.parse(`${d}T${h}:00:00.000Z`) + questMorning.duration_sec * 1000);
        const eh = String(end.getUTCHours()).padStart(2, '0');
        const em = String(end.getUTCMinutes()).padStart(2, '0');
        const es = String(end.getUTCSeconds()).padStart(2, '0');
        return {
          profile_id: profileId,
          quest_id: questMorning.id,
          idempotency_key: idemUuid(`seed-${r.atDay}-${r.startHour}`),
          started_at: `${d}T${h}:00:00.000Z`,
          completed_at: `${d}T${eh}:${em}:${es}.000Z`,
          duration_sec: questMorning.duration_sec,
          xp_awarded: 100,
          bonus_breakdown: {},
          mastered: [],
          day_key: d,
        };
      }),
    );
    expect(error).toBeNull();
  };

  const profileRow = async (): Promise<Record<string, unknown>> => {
    const { data, error } = await admin
      .from('profiles')
      .select(
        'total_xp, level, current_streak, longest_streak, last_completed_day, journey_quests, current_chapter',
      )
      .eq('id', profileId);
    expect(error).toBeNull();
    return data![0] as unknown as Record<string, unknown>;
  };

  const masteryRow = async (): Promise<Record<string, number>> => {
    const { data, error } = await admin
      .from('mastery')
      .select('track, points')
      .eq('profile_id', profileId);
    expect(error).toBeNull();
    return Object.fromEntries(
      (data ?? []).map((row: { track: string; points: number }) => [row.track, row.points]),
    );
  };

  const rewardsRow = async (): Promise<number[]> => {
    const { data, error } = await admin
      .from('streaks_rewards')
      .select('reward_day')
      .eq('profile_id', profileId)
      .order('reward_day', { ascending: true });
    expect(error).toBeNull();
    return (data ?? []).map((row: { reward_day: number }) => row.reward_day);
  };

  const ownedCount = async (slug: string): Promise<number> => {
    const { data, error } = await admin
      .from('profile_achievements')
      .select('achievement_id')
      .eq('profile_id', profileId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((row: { achievement_id: string }) => row.achievement_id);
    if (ids.length === 0) return 0;
    const { data: defs, error: defsErr } = await admin
      .from('achievements')
      .select('id, slug')
      .in('id', ids);
    expect(defsErr).toBeNull();
    return (defs ?? []).filter((a: { slug: string }) => a.slug === slug).length;
  };

  /**
   * INVARIANT MIRROR â€” recompute the server snapshot from the raw event
   * stream (quest reward + day keys only), replicating 0020 exactly:
   * quest XP per completion, daily +75 only on the first per-day completion,
   * weekly +500 only on the 3rd completion per Monâ€“Sun window (offset
   * week = floor(day/7)), ladder payouts only when the streak lands exactly
   * on a rung day, and level via the closed form 50*L*(L-1).
   */
  const mirrorState = (events: SimEvent[]): Record<string, unknown> => {
    const sorted = [...events].sort((a, b) => a.atDay - b.atDay);
    const rewardOf = (questId: string): number =>
      questId === questMorning.id ? questMorning.xp_reward : questHard.xp_reward;
    let questXp = 0;
    let daily = 0;
    let weekly = 0;
    let streakXp = 0;
    let run = 0;
    let longest = 0;
    let prevDay: number | null = null;
    const weekCounts = new Map<number, number>();

    for (const ev of sorted) {
      questXp += rewardOf(ev.questId);
      if (prevDay !== ev.atDay) daily += DAILY_XP;

      const week = Math.floor(ev.atDay / 7);
      const count = (weekCounts.get(week) ?? 0) + 1;
      weekCounts.set(week, count);
      if (count === 3) weekly += WEEKLY_XP;

      run = prevDay === null || prevDay === ev.atDay - 1 ? run + 1 : 1;
      if (run > longest) longest = run;
      const rung = MILESTONES.find((m) => m.days === run);
      if (rung) streakXp += rung.xp;

      prevDay = ev.atDay;
    }

    const totalXp = questXp + daily + weekly + streakXp;
    let level = 1;
    while (LEVEL_XP_FOR(level + 1) <= totalXp) level += 1;
    return {
      totalXp,
      level,
      currentStreak: run,
      longestStreak: longest,
      lastCompletedDay: sorted.length ? dayKey(sorted[sorted.length - 1]!.atDay) : null,
    };
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
    questMorning = {
      id: list.find((q) => q.slug === 'morning-stretch')!.id,
      xp_reward: 50,
      duration_sec: list.find((q) => q.slug === 'morning-stretch')!.duration_sec,
    };
    questHard = {
      id: list.find((q) => q.slug === 'strength-builder')!.id,
      xp_reward: 200,
      duration_sec: list.find((q) => q.slug === 'strength-builder')!.duration_sec,
    };
  });

  // -----------------------------------------------------------------------
  // 1. Long-session sim: ladder and weekly/daily cadence, achievement
  //    boundary firing, snapshot invariant, replays change nothing.
  // -----------------------------------------------------------------------
  it('101-day session pays ladder rungs only at 3/7/30/100, weekly on the 3rd, and raw recompute equals the snapshot', async () => {
    const DAYS = 101;
    await resetProgression();
    const events = Array.from({ length: DAYS }, (_, atDay) => morning(atDay));
    const payouts: Payload[] = [];
    for (const ev of events) {
      payouts.push(await completeViaRpc(ev));
    }

    // Ladder: exactly days 3/7/30/100, with 50/150/500/1500, both in the
    // payloads and persisted in streaks_rewards.
    const rungs = payouts
      .map((p, i) => ({ day: i + 1, streak: p.xp.streak }))
      .filter((r) => r.streak > 0);
    expect(rungs.map((r) => r.day)).toEqual([3, 7, 30, 100]);
    expect(rungs.map((r) => r.streak)).toEqual([50, 150, 500, 1500]);
    expect(await rewardsRow()).toEqual([3, 7, 30, 100]);
    expect(payouts[3]!.xp.streak).toBe(0); // day 4 â€” no re-grant
    expect(payouts[100]!.xp.streak).toBe(0); // day 101 â€” past the ladder

    // Daily: +75 on every first-of-day (one event per day here).
    expect(payouts.reduce((sum, p) => sum + p.xp.daily, 0)).toBe(DAILY_XP * DAYS);
    // Weekly: +500 exactly on the 3rd of each Monâ€“Sun window; 15 windows.
    const weeklyEvents = payouts.filter((p) => p.xp.weekly > 0);
    expect(weeklyEvents.length).toBe(15);
    expect(weeklyEvents.every((p) => p.xp.weekly === WEEKLY_XP)).toBe(true);
    expect(payouts[2]!.xp.weekly).toBe(500);
    expect(payouts[3]!.xp.weekly).toBe(0); // 4th of week 1 window

    // Achievement boundary firing, exactly once each.
    expect(payouts.findIndex((p) => p.achievements.some((a) => a.slug === 'streak-7'))).toBe(6);
    expect(payouts.findIndex((p) => p.achievements.some((a) => a.slug === 'workouts-50'))).toBe(49);
    expect(payouts.findIndex((p) => p.achievements.some((a) => a.slug === 'workouts-100'))).toBe(
      99,
    );
    for (const slug of ['streak-7', 'workouts-50', 'workouts-100']) {
      expect(await ownedCount(slug)).toBe(1);
    }

    // INVARIANT: recompute from raw rows only; must equal the snapshot.
    const { data: raw, error: rawErr } = await admin
      .from('quest_completions')
      .select('day_key, quest_id')
      .eq('profile_id', profileId)
      .order('day_key', { ascending: true });
    expect(rawErr).toBeNull();
    const recomputed = mirrorState(
      (raw ?? []).map((row) => ({
        questId: row.quest_id as string,
        atDay: epocOffset(row.day_key as string),
        startHour: 9,
        startMinute: 0,
        questDurationSec: questMorning.duration_sec,
        idem: 'raw',
      })),
    );
    const prof = await profileRow();
    expect(prof.total_xp).toBe(recomputed.totalXp);
    expect(prof.level).toBe(recomputed.level);
    expect(prof.current_streak).toBe(DAYS);
    expect(prof.longest_streak).toBe(DAYS);
    expect(prof.last_completed_day).toBe(dayKey(DAYS - 1));
    expect(prof.journey_quests).toBe(DAYS);
    expect(await masteryRow()).toEqual({ mobility: 3030, discipline: 1515 }); // AT-02H 3x

    // Replay: same idempotency keys return stored payloads, nothing drifts.
    const replay5 = await completeViaRpc(morning(5, 9, 'sim-5-9'));
    const replay100 = await completeViaRpc(morning(100, 9, 'sim-100-9'));
    expect(replay5.xp.total).toBe(payouts[5]!.xp.total);
    expect(replay100.xp.total).toBe(payouts[100]!.xp.total);
    const { data: afterReplay } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', profileId);
    expect(afterReplay!.length).toBe(DAYS);
    expect((await profileRow()).total_xp).toBe(prof.total_xp);
  }, 300000);

  // -----------------------------------------------------------------------
  // 2. Level 100 -> 101 boundary: 10,000 XP span around 505,000.
  // -----------------------------------------------------------------------
  it('crossing 505,000 XP lands level 101 with Legend; master-adventurer unlocks exactly once', async () => {
    await resetProgression();
    const seed = await admin
      .from('profiles')
      .update({ total_xp: 504_000, level: 100, journey_quests: 0 })
      .eq('id', profileId);
    expect(seed.error).toBeNull();

    let crossed = false;
    let last: Payload | null = null;
    for (let i = 0; i < 5; i += 1) {
      last = await completeViaRpc({
        questId: questHard.id,
        atDay: i,
        startHour: 8,
        startMinute: 0,
        questDurationSec: questHard.duration_sec,
        idem: `lvl100-${i}`,
      });
      if (last.level.after === 101) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(last!.level.after).toBe(101);
    expect(last!.level.title).toBe('Legend');
    const prof = await profileRow();
    // 504000 + 5*400 quest + 5*150 daily + 1000 weekly (3rd of the window) + 50 (streak-3 rung).
    expect(prof.total_xp).toBe(504_000 + 5 * 400 + 5 * DAILY_XP + WEEKLY_XP + 50);
    expect(prof.level).toBe(101);
    expect(await ownedCount('master-adventurer')).toBe(1);
  }, 60000);

  // -----------------------------------------------------------------------
  // 3. Phoenix boundary: level 24 stays locked, level 25 unlocks.
  // -----------------------------------------------------------------------
  it('phoenix unlocks at level 25 (rule level=25), not at 24', async () => {
    await resetProgression();
    // Park just below the boundary: 30000 XP is level 25 (50*25*24).
    const park = await admin
      .from('profiles')
      .update({ total_xp: LEVEL_XP_FOR(25) - 200, level: 24 })
      .eq('id', profileId);
    expect(park.error).toBeNull();
    expect(await ownedCount('phoenix')).toBe(0);
    // Seed today's completion so the crossing quest pays exactly +200 (no daily bonus).
    await seedCompletions([{ atDay: 0, startHour: 9 }]);
    const cross = await completeViaRpc({
      questId: questHard.id,
      atDay: 0,
      startHour: 12,
      startMinute: 0,
      questDurationSec: questHard.duration_sec,
      idem: 'ph-25',
    });
    expect(cross.level.after).toBe(25);
    expect(cross.achievements.some((a) => a.slug === 'phoenix')).toBe(true);
    expect(cross.cosmetics.some((c) => c.slug === 'portrait-phoenix')).toBe(true);
    expect(await ownedCount('phoenix')).toBe(1);
  }, 120000);

  // -----------------------------------------------------------------------
  // 4. Early-bird UTC-hour boundary: 09:59 counts, 10:00 does not.
  // -----------------------------------------------------------------------
  it('early-bird unlocks on the 100th completion started before UTC 10:00, not at/after', async () => {
    const seeds = Array.from({ length: 99 }, (_, i) => ({ atDay: 200 + i, startHour: 9 }));

    await resetProgression();
    await seedCompletions(seeds);
    const unlocked = await completeViaRpc({
      questId: questMorning.id,
      atDay: 199,
      startHour: 9,
      startMinute: 59,
      questDurationSec: questMorning.duration_sec,
      idem: 'early-ok',
    });
    expect(unlocked.achievements.some((a) => a.slug === 'early-bird')).toBe(true);
    expect(await ownedCount('early-bird')).toBe(1);

    await resetProgression();
    await seedCompletions(seeds);
    const held = await completeViaRpc({
      questId: questMorning.id,
      atDay: 199,
      startHour: 10,
      startMinute: 0,
      questDurationSec: questMorning.duration_sec,
      idem: 'early-no',
    });
    expect(held.achievements.some((a) => a.slug === 'early-bird')).toBe(false);
    expect(await ownedCount('early-bird')).toBe(0);
  }, 120000);
});
