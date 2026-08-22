import { supabase } from '@/data/supabase';
import type { ExerciseDifficulty } from '@/domain/exercises/difficulty';
import {
  DEFAULT_WORKOUT_NAME,
  NAME_MAX_CHARS,
  type CustomSegment,
} from '@/domain/customWorkout/model';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

/** BYQ-03 — catalog entry for the builder picker (server-authoritative). */
export interface CatalogExercise {
  slug: string;
  name: string;
  difficulty: ExerciseDifficulty;
  /** WK-01 — how-to copy shown on the paused overlay. */
  instruction: string | null;
  /** WK-01 — safety note shown on the paused overlay. */
  safetyNote: string | null;
}

/** A saved custom workout as rendered by board/detail/builder edit mode. */
export interface SavedCustomWorkout {
  id: string;
  name: string;
  segments: CustomSegment[];
  createdAtMs: number;
}

function isExerciseDifficulty(value: string): value is ExerciseDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

/**
 * The full exercise catalog for the picker, alphabetical. Difficulty comes
 * from exercise_library.difficulty (0027) — the same column the completion
 * RPC weights XP by, so the projection can never drift from the server.
 */
export async function fetchExerciseCatalog(): Promise<RepoResult<CatalogExercise[]>> {
  const { data, error } = await supabase
    .from('exercise_library')
    .select('slug, name, difficulty, instruction, safety_note')
    .order('name', { ascending: true });

  if (error) {
    return fail(`Could not load exercises: ${error.message}`);
  }

  const catalog: CatalogExercise[] = [];
  for (const row of data ?? []) {
    if (!isExerciseDifficulty(row.difficulty)) {
      continue;
    }
    catalog.push({
      slug: row.slug,
      name: row.name,
      difficulty: row.difficulty,
      instruction: row.instruction ?? null,
      safetyNote: row.safety_note ?? null,
    });
  }
  return ok(catalog);
}

function parseSegments(raw: unknown): CustomSegment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const segments: CustomSegment[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const slug = record['exercise_slug'];
    const duration = record['duration_sec'];
    if (typeof slug === 'string' && typeof duration === 'number' && Number.isFinite(duration)) {
      segments.push({ exerciseSlug: slug, durationSec: duration });
    }
  }
  return segments;
}

/** Saved customs for the signed-in player (RLS scopes the read), newest first. */
export async function fetchCustomWorkouts(): Promise<RepoResult<SavedCustomWorkout[]>> {
  const { data, error } = await supabase
    .from('custom_workouts')
    .select('id, name, segments, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return fail(`Could not load your quests: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      segments: parseSegments(row.segments),
      createdAtMs: new Date(row.created_at).getTime(),
    })),
  );
}

export async function fetchCustomWorkout(
  workoutId: string,
): Promise<RepoResult<SavedCustomWorkout>> {
  const { data, error } = await supabase
    .from('custom_workouts')
    .select('id, name, segments, created_at')
    .eq('id', workoutId)
    .maybeSingle();

  if (error) {
    return fail(`Could not load the quest: ${error.message}`);
  }
  if (!data) {
    return fail('Quest not found.');
  }
  return ok({
    id: data.id,
    name: data.name,
    segments: parseSegments(data.segments),
    createdAtMs: new Date(data.created_at).getTime(),
  });
}

/**
 * Insert or update (edit semantics, Ref 12: editing rewrites the definition;
 * already-recorded completions keep their stored payload forever). Returns
 * the row id so Start-after-save can route straight into the workout.
 */
export async function saveCustomWorkout(draft: {
  id?: string;
  name: string;
  segments: CustomSegment[];
}): Promise<RepoResult<string>> {
  // profile_id has no DB default and RLS checks it against auth.uid() —
  // resolve it from the session like the completion RPC does.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return fail('You need to be signed in to save.');
  }
  const base = {
    name: (draft.name.trim() || DEFAULT_WORKOUT_NAME).slice(0, NAME_MAX_CHARS),
    segments: draft.segments.map((segment) => ({
      exercise_slug: segment.exerciseSlug,
      duration_sec: segment.durationSec,
    })),
  };

  if (draft.id) {
    const { error } = await supabase.from('custom_workouts').update(base).eq('id', draft.id);
    if (error) {
      return fail(`Could not save: ${error.message}`);
    }
    return ok(draft.id);
  }

  const { data, error } = await supabase
    .from('custom_workouts')
    .insert({ ...base, profile_id: userId })
    .select('id')
    .single();
  if (error || !data) {
    return fail(`Could not save: ${error?.message ?? 'no row returned'}`);
  }
  return ok(data.id as string);
}

export async function deleteCustomWorkout(workoutId: string): Promise<RepoResult<null>> {
  const { error } = await supabase.from('custom_workouts').delete().eq('id', workoutId);
  if (error) {
    return fail(`Could not delete: ${error.message}`);
  }
  return ok(null);
}
