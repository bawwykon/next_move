/**
 * DoD-6 — population simulation harness. 100 simulated users each run a
 * seeded 30-day loop against the LIVE local stack through the authoritative
 * `complete_quest` RPC (the exact client write path — never a direct table
 * write for progression data). After each user's stream the script recomputes
 * the expected state from its raw events (a faithful mirror of 0020: quest
 * XP, daily +75 first-of-day, weekly +500 on the 3rd of a Mon–Sun window,
 * streak ladder rungs 3/7/30/100, mastery +10/+5 per touch, level curve
 * 50·L·(L−1)) and asserts ZERO drift against server.profiles/mastery.
 *
 *   npm run population:sim           # 100 users × 30 days
 *   SIM_USERS=200 npm run population:sim
 *
 * Deterministic per seed. Exits non-zero on drift. Local-stack only (ED-6).
 */
import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SIM_USERS = Number(process.env.SIM_USERS ?? 100);
const DAYS = 30;
const SEED = 20260809;

const LOCAL_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(
  '10.0.2.2',
  '127.0.0.1',
);
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Local-dev service role: env override, else live from `supabase status`.
function serviceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  const status = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(status) as { SERVICE_ROLE_KEY?: string };
  const key = parsed.SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('supabase status gave no SERVICE_ROLE_KEY');
  }
  return key;
}

const SERVICE_ROLE_KEY = serviceRoleKey();

const EPOC = '2026-07-06'; // Monday — weekly windows align with 0020's isodow
const DAY_MS = 86_400_000;
const DAILY_XP = 75;
const WEEKLY_XP = 500;
const MILESTONES: readonly { days: number; xp: number }[] = [
  { days: 3, xp: 50 },
  { days: 7, xp: 150 },
  { days: 30, xp: 500 },
  { days: 100, xp: 1500 },
];
const LEVEL_XP_FOR = (level: number): number => 50 * level * (level - 1);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

const dayKey = (offset: number): string => {
  const date = new Date(Date.parse(EPOC) + offset * DAY_MS);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

const idemFor = (user: number, day: number, slot: number): string => {
  const label = `pop-${user}-${day}-${slot}-${(user * 7919 + day * 104729 + slot * 65537) % 2147483647}`;
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0')}`;
};

interface Quest {
  xpReward: number;
  durationSec: number;
  categories: string[];
}

interface SimEvent {
  questId: string;
  dayOffset: number;
  startHour: number;
  slot: number;
}

interface Mirror {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  journey: number;
  mastery: Record<string, number>;
  parts: { questXp: number; daily: number; weekly: number; streakXp: number };
  timeline: { day: number; run: number; streakPay: number }[];
}

function runMirror(events: SimEvent[], quests: Map<string, Quest>): Mirror {
  const sorted = [...events].sort((a, b) => a.dayOffset - b.dayOffset);
  let total = 0;
  let daily = 0;
  let weekly = 0;
  let streakXp = 0;
  let run = 0;
  let longest = 0;
  let prevDay: number | null = null;
  const mastery: Record<string, number> = {};
  const weekCounts = new Map<number, number>();
  const paidRungs = new Set<number>(); // rungs are once-per-tier per profile
  const timeline: { day: number; run: number; streakPay: number }[] = [];

  for (const ev of sorted) {
    const quest = quests.get(ev.questId);
    if (!quest) {
      throw new Error(`catalog drift: unknown quest ${ev.questId}`);
    }
    total += quest.xpReward;
    // Mastery (FR-MAS-2): +10 only for the server's fixed track list
    // (strength/endurance/mobility); 'discipline' as a quest category earns
    // no +10 — the +5 discipline grant is unconditional per completion.
    for (const cat of ['strength', 'endurance', 'mobility']) {
      if (quest.categories.includes(cat)) {
        mastery[cat] = (mastery[cat] ?? 0) + 10;
      }
    }
    mastery['discipline'] = (mastery['discipline'] ?? 0) + 5;

    if (prevDay !== ev.dayOffset) {
      daily += DAILY_XP;
    }
    const week = Math.floor(ev.dayOffset / 7);
    const count = (weekCounts.get(week) ?? 0) + 1;
    weekCounts.set(week, count);
    if (count === 3) {
      weekly += WEEKLY_XP;
    }

    const runBefore = run;
    run = prevDay === ev.dayOffset ? run : prevDay === ev.dayOffset - 1 ? run + 1 : 1; // same day keeps, next day climbs, a gap restarts (mirrors 0020)
    if (run > longest) {
      longest = run;
    }
    // Ladder pays only on the FIRST fresh climb onto the rung: the server's
    // (profile_id, reward_day) unique gate makes each tier once-per-profile
    // (`on conflict do nothing`) — a later streak the same length pays none.
    const rung = MILESTONES.find((m) => m.days === run);
    let streakPay = 0;
    if (rung && run > runBefore && !paidRungs.has(rung.days)) {
      paidRungs.add(rung.days);
      streakXp += rung.xp;
      streakPay = rung.xp;
    }
    timeline.push({ day: ev.dayOffset, run, streakPay });

    prevDay = ev.dayOffset;
  }

  const totalXp = total + daily + weekly + streakXp;
  let level = 1;
  while (LEVEL_XP_FOR(level + 1) <= totalXp) {
    level += 1;
  }
  return {
    totalXp,
    level,
    currentStreak: run,
    longestStreak: longest,
    journey: events.length,
    mastery,
    parts: { questXp: total, daily, weekly, streakXp },
    timeline,
  };
}

async function wipeProgression(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from('quest_completions').delete().eq('profile_id', userId);
  await admin.from('mastery').delete().eq('profile_id', userId);
  await admin.from('streaks_rewards').delete().eq('profile_id', userId);
  await admin.from('profile_achievements').delete().eq('profile_id', userId);
  await admin.from('profile_cosmetics').delete().eq('profile_id', userId);
  await admin
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
    .eq('id', userId);
}

async function main(): Promise<void> {
  const admin = createClient(LOCAL_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anon = createClient(LOCAL_URL, ANON_KEY, { auth: { persistSession: false } });

  // Catalog: quest categories come straight from quests.categories — the same
  // column 0020 reads (no exercise-join needed for the mastery mirror).
  const { data: questRows, error: questErr } = await admin
    .from('quests')
    .select('id, xp_reward, duration_sec, categories');
  if (questErr) {
    throw new Error(`quests: ${questErr.message}`);
  }
  const quests: Map<string, Quest> = new Map();
  for (const q of questRows ?? []) {
    quests.set(q.id as string, {
      xpReward: q.xp_reward as number,
      durationSec: q.duration_sec as number,
      categories: (q.categories as string[]) ?? [],
    });
  }
  const questIds = Array.from(quests.keys());
  if (questIds.length === 0) {
    throw new Error('catalog empty — is the DB seeded?');
  }

  const rand = mulberry32(SEED);
  const drift: string[] = [];
  let totalEvents = 0;

  for (let userIndex = 0; userIndex < SIM_USERS; userIndex += 1) {
    const email = `simd-${SEED}-${userIndex}@nextmove.app`;
    const password = 'password-pass-123';

    // Create or revalidate the simulated user (wipe covers old runs; the
    // fixed email keeps the population bounded across reruns of the same
    // seed).
    let userId: string | null = null;
    {
      const { data: found } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const hit = found?.users.find((u) => u.email === email);
      if (!hit) {
        const { data: created } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        userId = created?.user?.id ?? null;
      } else {
        userId = hit.id;
        await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      }
    }
    if (!userId) {
      throw new Error(`no user id for ${email}`);
    }
    await wipeProgression(admin, userId);

    // Deterministic 30-day stream: ~25% missed days, 1-3 quests per active
    // day, start hours 8-22.
    const events: SimEvent[] = [];
    for (let day = 0; day < DAYS; day += 1) {
      if (rand() < 0.25) {
        continue;
      }
      const roll = rand();
      const slots = roll < 0.7 ? 1 : roll < 0.9 ? 2 : 3;
      for (let slot = 0; slot < slots; slot += 1) {
        const questId = questIds[Math.floor(rand() * questIds.length)]!;
        events.push({
          questId,
          dayOffset: day,
          startHour: 8 + Math.floor(rand() * 15),
          slot,
        });
      }
    }

    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signIn.session) {
      throw new Error(`sign in ${email}: ${signInErr?.message}`);
    }
    const actor = createClient(LOCAL_URL, signIn.session.access_token, {
      auth: { persistSession: false },
    });

    for (const ev of events) {
      const d = dayKey(ev.dayOffset);
      const h = pad2(ev.startHour);
      const startedAt = `${d}T${h}:00:00.000Z`;
      const quest = quests.get(ev.questId)!;
      const end = new Date(Date.parse(startedAt) + quest.durationSec * 1000);
      const completedAt = `${d}T${pad2(end.getUTCHours())}:${pad2(
        end.getUTCMinutes(),
      )}:${pad2(end.getUTCSeconds())}.000Z`;
      const { error: rpcErr } = await actor.rpc('complete_quest', {
        ev: {
          quest_id: ev.questId,
          idempotency_key: idemFor(userIndex, ev.dayOffset, ev.slot),
          started_at: startedAt,
          completed_at: completedAt,
          day_key: d,
        },
      });
      if (rpcErr) {
        throw new Error(`rpc failed for user ${userIndex}: ${rpcErr.message}`);
      }
    }

    const mirror = runMirror(events, quests);
    const { data: prof } = await admin
      .from('profiles')
      .select('total_xp, level, current_streak, longest_streak, journey_quests')
      .eq('id', userId)
      .single();
    const { data: masteryRows } = await admin
      .from('mastery')
      .select('track, points')
      .eq('profile_id', userId);
    const { data: completionRows } = await admin
      .from('quest_completions')
      .select('id')
      .eq('profile_id', userId);

    const masteryLive: Record<string, number> = {};
    for (const m of masteryRows ?? []) {
      masteryLive[m.track as string] = m.points as number;
    }
    // Key-order-insensitive comparison (DB row order is arbitrary).
    const norm = (m: Record<string, number>): string =>
      Object.entries(m)
        .sort()
        .map(([k, p]) => `${k}:${p}`)
        .join(',');

    const diffs: string[] = [];
    if (!prof) {
      diffs.push('profile row missing');
    } else {
      if (prof.total_xp !== mirror.totalXp) diffs.push('xp');
      if (prof.level !== mirror.level) diffs.push('level');
      if (prof.current_streak !== mirror.currentStreak) diffs.push('current_streak');
      if (prof.longest_streak !== mirror.longestStreak) diffs.push('longest_streak');
      if (prof.journey_quests !== mirror.journey) diffs.push('journey_quests');
    }
    if ((completionRows ?? []).length !== events.length) {
      diffs.push('completion rows');
    }
    if (norm(masteryLive) !== norm(mirror.mastery)) {
      diffs.push('mastery');
    }

    totalEvents += events.length;
    if (diffs.length > 0) {
      drift.push(`user ${userIndex} (${email}): ${diffs.join(', ')}`);
      if (prof) {
        console.log(
          `  debug user ${userIndex}: server=${JSON.stringify(prof)} mirrorXp=${mirror.parts.questXp}+${mirror.parts.daily}+${mirror.parts.weekly}+${mirror.parts.streakXp}=${mirror.totalXp}`,
        );
        console.log(
          `  debug streak timeline: ${mirror.timeline
            .filter((t) => t.streakPay > 0)
            .map((t) => `${t.day}(run${t.run})${t.streakPay}`)
            .join(' -> ')}`,
        );
      }
    }
  }

  console.log(
    `DOD-6 POPULATION SIM — users=${SIM_USERS} days=${DAYS} events=${totalEvents} drifted=${drift.length}`,
  );
  if (drift.length > 0) {
    console.log(drift.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('ALL USERS MATCH THEIR MIRRORS — zero drift.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
