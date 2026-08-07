import { create } from 'zustand';

import { enqueueCompletion, flushOutbox, readOutbox, type OutboxRow } from '@/data/completionQueue';
import { submitCompletion } from '@/data/repositories/completion';
import { supabase } from '@/data/supabase';
import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';

export interface StoredCompletion {
  questId: string;
  result: CompletionResult;
  completedAtMs: number;
}

/**
 * S5-05 — offline completion queue state. The only writer of progression is
 * complete_quest; this store surfaces the authoritative payload it returned
 * (S6's victory screen consumes lastCompletion) and the outbox depth that
 * powers the board's "Syncing…" marker. No client-side XP/streak guesses.
 */
interface CompletionStore {
  /** Most recent server-confirmed completion payload (null before any sync). */
  lastCompletion: StoredCompletion | null;
  /** Number of undelivered events in the outbox. */
  pendingCount: number;
  /** Load the persisted outbox depth into memory (board marker, resume). */
  hydrate: () => Promise<void>;
  /** Persist a fresh event to the outbox and reflect it in pendingCount. */
  enqueue: (event: CompletionEvent) => Promise<void>;
  /** Deliver everything queued (single-in-flight, retry-safe, exactly-once). */
  flush: () => Promise<void>;
  reset: () => void;
}

export const useCompletionStore = create<CompletionStore>()((set) => ({
  lastCompletion: null,
  pendingCount: 0,

  hydrate: async () => {
    const rows = await readOutbox();
    set({ pendingCount: rows.length });
  },

  enqueue: async (event) => {
    await enqueueCompletion(event);
    set((state) => ({ pendingCount: state.pendingCount + 1 }));
  },

  flush: async () => {
    await flushOutbox({
      submit: (event) => submitCompletion(supabase, event),
      onSuccess: async (row: OutboxRow, result: CompletionResult) => {
        set({
          lastCompletion: { questId: row.event.quest_id, result, completedAtMs: row.createdAtMs },
        });
      },
    });
    const rows = await readOutbox();
    set({ pendingCount: rows.length });
  },

  reset: () => {
    set({ lastCompletion: null, pendingCount: 0 });
  },
}));
