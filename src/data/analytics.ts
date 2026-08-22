/**
 * NFR-9 (DoD-7) — privacy-lean analytics. The full MVP event surface is
 * exactly the six product events from PRD §8: app_opened,
 * onboarding_completed, quest_started, quest_completed, achievement_unlocked,
 * level_up. Nothing else is tracked (no behavioral/usage telemetry).
 *
 * Implementation note (S10-02): in MVP the log is device-local only — a
 * capped, append-only JSON list in AsyncStorage — so the events "fire" and
 * are measurable/exportable without shipping any third-party SDK. A hosted
 * analytics sink can be swapped in at this single chokepoint (`track`), and
 * only then is a privacy-policy disclosure needed. This is the S10-02 DoD-7
 * decision until the owner chooses an SDK (ED-27 gate).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AnalyticsEvent =
  | 'app_opened'
  | 'onboarding_completed'
  | 'quest_started'
  | 'quest_completed'
  | 'achievement_unlocked'
  | 'level_up'
  // Phase 2 / BYQ-03 — builder surface (planner UI spec 2026-08-22:
  // "analytics tracks add/remove/save/start").
  | 'custom_segment_added'
  | 'custom_segment_removed'
  | 'custom_workout_saved'
  | 'custom_quest_started';

export type AnalyticsProps = Record<string, string | number>;

interface LoggedEvent {
  event: AnalyticsEvent;
  props: AnalyticsProps;
  at: string;
}

export const ANALYTICS_KEY = 'analytics.events.v1';
export const ANALYTICS_MAX_EVENTS = 500;

export async function track(event: AnalyticsEvent, props: AnalyticsProps = {}): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    const events: LoggedEvent[] = raw ? (JSON.parse(raw) as LoggedEvent[]) : [];
    events.push({ event, props, at: new Date().toISOString() });
    while (events.length > ANALYTICS_MAX_EVENTS) events.shift();
    await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  } catch {
    // Analytics is fire-and-forget: a failed write must never surface to a
    // product flow (same rule as the completion outbox).
  }
}
