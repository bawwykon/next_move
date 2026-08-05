export type QuestDifficulty = 'easy' | 'normal' | 'hard' | 'elite';

export type QuestCategory = 'strength' | 'endurance' | 'mobility' | 'discipline';

/** Shape mirrors the S2-02 onboarding payload (completedAnswers). */
export interface OnboardingAnswers {
  activity_level: number;
  experience: number;
  goals: string[];
  workout_time: string;
}

export interface MasterySummary {
  points: Record<QuestCategory, number>;
}

export interface CompletionRecord {
  questId: string;
  category: QuestCategory;
  completedAt: string;
  dayKey: string;
}

export interface QuestCatalogEntry {
  id: string;
  slug: string;
  difficulty: QuestDifficulty;
  durationSec: number;
  categories: QuestCategory[];
}
