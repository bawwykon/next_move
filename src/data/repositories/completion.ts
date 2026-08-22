import type { SupabaseClient } from '@supabase/supabase-js';

import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';
import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';
import { isCompletionResult } from '@/domain/completion/types';
import type { Database, Json } from '@/types/database';

/**
 * Server-side completion error codes (S5-01 complete_quest errcodes F0001-03;
 * BYQ-04 adds complete_custom_workout's workout_invalid). `error` on RepoResult
 * carries exactly one of these so the store can decide retry vs drop without
 * string-guessing.
 */
export type CompletionSubmitError =
  'quest_invalid' | 'workout_invalid' | 'timer_mismatch' | 'unknown';

/**
 * Submit one completion event to the server-authoritative RPC. Catalog quests
 * route to complete_quest; custom workouts (event carries workout_id, BYQ-04)
 * route to complete_custom_workout, which recomputes everything from the SAVED
 * definition. The client is injected so integration tests drive a real session
 * while the app passes the shared singleton (data/supabase). Returns the
 * authoritative payload exactly as the server computed it — never a client
 * estimate.
 */
export async function submitCompletion(
  client: SupabaseClient<Database>,
  event: CompletionEvent,
): Promise<RepoResult<CompletionResult>> {
  const workoutId = event.workout_id ?? null;
  const { data, error } = workoutId
    ? await client.rpc('complete_custom_workout', {
        p_workout_id: workoutId,
        ev: event as unknown as Json,
      })
    : await client.rpc('complete_quest', {
        ev: event as unknown as Json,
      });
  if (error) {
    return fail(mapRpcError(error.message));
  }
  const payload: unknown = data;
  if (!isCompletionResult(payload)) {
    return fail('unknown');
  }
  return ok(payload);
}

function mapRpcError(message: string): CompletionSubmitError {
  if (message.includes('quest_invalid')) {
    return 'quest_invalid';
  }
  if (message.includes('workout_invalid')) {
    return 'workout_invalid';
  }
  if (message.includes('timer_mismatch')) {
    return 'timer_mismatch';
  }
  return 'unknown';
}
