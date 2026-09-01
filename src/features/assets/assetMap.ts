/**
 * AT-01D â€” centralized slug â†’ asset mapping (single source of truth for the
 * normalized delivery). Every map is keyed by the database slug (kebab-case);
 * callers fall back to their previous code-drawn rendering when a key is
 * absent (null), so a missing file can never crash a screen.
 */

// --- Exercise guide illustrations (assets/exercises/, one per exercise slug) ---
export const EXERCISE_ART: Record<string, number> = {
  'wall-push-up': require('@/assets/exercises/wall_push_up.png'),
  'glute-bridge': require('@/assets/exercises/glute_bridge.png'),
  'bird-dog': require('@/assets/exercises/bird_dog.png'),
  'seated-leg-raise': require('@/assets/exercises/seated_leg_raise.png'),
  'wall-sit': require('@/assets/exercises/wall_sit.png'),
  'march-in-place': require('@/assets/exercises/march_in_place.png'),
  'step-touch': require('@/assets/exercises/step_touch.png'),
  'gentle-hops': require('@/assets/exercises/gentle_hops.png'),
  'seated-march': require('@/assets/exercises/seated_march.png'),
  'neck-shoulder-rolls': require('@/assets/exercises/neck_shoulder_rolls.png'),
  'cat-cow': require('@/assets/exercises/cat_cow.png'),
  'seated-hamstring-stretch': require('@/assets/exercises/seated_hamstring_stretch.png'),
  'standing-quad-stretch': require('@/assets/exercises/standing_quad_stretch.png'),
  squat: require('@/assets/exercises/squat.png'),
  'push-up': require('@/assets/exercises/push_up.png'),
  lunges: require('@/assets/exercises/lunges.png'),
  plank: require('@/assets/exercises/plank.png'),
  'bicycle-crunch': require('@/assets/exercises/bicycle_crunch.png'),
  'mountain-climber': require('@/assets/exercises/mountain_climber.png'),
  burpees: require('@/assets/exercises/burpees.png'),
};

export function exerciseArt(slug: string | null | undefined): number | null {
  return slug ? (EXERCISE_ART[slug] ?? null) : null;
}

// --- Achievement badges (assets/badges/, keyed by achievements.slug) ---
export const ACHIEVEMENT_ART: Record<string, number> = {
  'first-quest': require('@/assets/badges/badge_first_quest.png'),
  'first-level': require('@/assets/badges/badge_first_level.png'),
  'first-week': require('@/assets/badges/badge_first_week.png'),
  'workouts-50': require('@/assets/badges/badge_workouts_50.png'),
  'workouts-100': require('@/assets/badges/badge_workouts_100.png'),
  'workouts-250': require('@/assets/badges/badge_workouts_250.png'),
  'streak-7': require('@/assets/badges/badge_streak_7.png'),
  'streak-30': require('@/assets/badges/badge_streak_30.png'),
  'streak-100': require('@/assets/badges/badge_streak_100.png'),
  phoenix: require('@/assets/badges/badge_phoenix.png'),
  'early-bird': require('@/assets/badges/badge_early_bird.png'),
  'night-owl': require('@/assets/badges/badge_night_owl.png'),
  'master-adventurer': require('@/assets/badges/badge_master_adventurer.png'),
  'founders-emblem': require('@/assets/badges/premium_badge.png'),
  premium_badge: require('@/assets/badges/premium_badge.png'),
};

export function achievementArt(slug: string | null | undefined): number | null {
  return slug ? (ACHIEVEMENT_ART[slug] ?? null) : null;
}

// --- Journey emblems (assets/journey/, keyed by chapter id 1..7) ---
const CHAPTER_ART: Record<number, number> = {
  1: require('@/assets/journey/journey_chapter_1.png'),
  2: require('@/assets/journey/journey_chapter_2.png'),
  3: require('@/assets/journey/journey_chapter_3.png'),
  4: require('@/assets/journey/journey_chapter_4.png'),
  5: require('@/assets/journey/journey_chapter_5.png'),
  6: require('@/assets/journey/journey_chapter_6.png'),
  7: require('@/assets/journey/journey_chapter_7.png'),
};

export function chapterArt(chapterId: number): number | null {
  return CHAPTER_ART[chapterId] ?? null;
}

// --- Cosmetics (assets/{frames,titles,portraits,backgrounds}/, keyed by cosmetics.slug) ---
export const COSMETIC_ART: Record<string, number> = {
  'frame-default': require('@/assets/frames/frame_default.png'),
  'frame-level-05': require('@/assets/frames/frame_level_05.png'),
  'frame-level-10': require('@/assets/frames/frame_level_10.png'),
  'frame-level-25': require('@/assets/frames/frame_level_25.png'),
  'frame-level-50': require('@/assets/frames/frame_level_50.png'),
  'frame-level-75': require('@/assets/frames/frame_level_75.png'),
  'frame-level-100': require('@/assets/frames/frame_level_100.png'),
  premium_frame: require('@/assets/frames/premium_frame.png'),
  'title-adventurer': require('@/assets/titles/title_adventurer.png'),
  'title-level-05': require('@/assets/titles/title_explorer.png'),
  'title-level-10': require('@/assets/titles/title_trailblazer.png'),
  'title-level-25': require('@/assets/titles/title_voyager.png'),
  'title-level-50': require('@/assets/titles/title_champion.png'),
  'title-level-75': require('@/assets/titles/title_vanguard.png'),
  'title-level-100': require('@/assets/titles/title_legend.png'),
  'portrait-default': require('@/assets/portraits/portrait_default.png'),
  'portrait-phoenix': require('@/assets/portraits/portrait_phoenix.png'),
  'portrait-master': require('@/assets/portraits/portrait_master.png'),
  'portrait-pathfinder': require('@/assets/portraits/portrait_pathfinder.png'),
  'portrait-warden': require('@/assets/portraits/portrait_warden.png'),
  premium_portrait: require('@/assets/portraits/premium_portrait.png'),
  'bg-chapter-02': require('@/assets/backgrounds/bg_chapter_02.jpg'),
  'bg-chapter-04': require('@/assets/backgrounds/bg_chapter_04.jpg'),
  'bg-chapter-06': require('@/assets/backgrounds/bg_chapter_06.jpg'),
};

// --- Nameplate cosmetics (assets/nameplates/) ---
export const NAMEPLATE_ART: Record<string, number> = {
  'nameplate-default': require('@/assets/nameplates/nameplate_default.png'),
  'nameplate-level-05': require('@/assets/nameplates/nameplate_level_05.png'),
  'nameplate-level-10': require('@/assets/nameplates/nameplate_level_10.png'),
  'nameplate-level-25': require('@/assets/nameplates/nameplate_level_25.png'),
  'nameplate-level-50': require('@/assets/nameplates/nameplate_level_50.png'),
  'nameplate-level-75': require('@/assets/nameplates/nameplate_level_75.png'),
  'nameplate-level-100': require('@/assets/nameplates/nameplate_level_100.png'),
  'premium-nameplate': require('@/assets/nameplates/premium_nameplate.png'),
  premium_nameplate: require('@/assets/nameplates/premium_nameplate.png'),
};

export function nameplateArt(slug: string | null | undefined): number | null {
  return slug ? (NAMEPLATE_ART[slug] ?? null) : null;
}

export const NAMEPLATE_ASPECT: Record<string, number> = {
  'nameplate-default': 2.801,
  'nameplate-level-05': 2.75,
  'nameplate-level-10': 2.801,
  'nameplate-level-25': 2.598,
  'nameplate-level-50': 2.75,
  'nameplate-level-75': 2.801,
  'nameplate-level-100': 2.695,
  'premium-nameplate': 3.0,
  premium_nameplate: 3.0,
};

export function nameplateAspect(slug: string | null | undefined): number {
  return slug ? (NAMEPLATE_ASPECT[slug] ?? 2.8) : 2.8;
}

export function cosmeticArt(slug: string | null | undefined): number | null {
  return slug ? (COSMETIC_ART[slug] ?? null) : null;
}

// --- Board icons (assets/icons/) ---
export const DIFFICULTY_ART: Record<string, number> = {
  easy: require('@/assets/icons/difficulty_easy.png'),
  normal: require('@/assets/icons/difficulty_normal.png'),
  hard: require('@/assets/icons/difficulty_hard.png'),
};

export function difficultyArt(difficulty: string): number | null {
  return DIFFICULTY_ART[difficulty] ?? null;
}

export const DAILY_QUEST_ART = require('@/assets/icons/icon_daily_quest.png') as number;
export const WEEKLY_CHALLENGE_ART = require('@/assets/icons/icon_weekly_challenge.png') as number;

export const MASTERY_ART: Record<string, number> = {
  strength: require('@/assets/icons/mastery_strength.png'),
  endurance: require('@/assets/icons/mastery_endurance.png'),
  mobility: require('@/assets/icons/mastery_mobility.png'),
  discipline: require('@/assets/icons/mastery_discipline.png'),
};

export function masteryArt(track: string): number | null {
  return MASTERY_ART[track] ?? null;
}

// --- Onboarding heroes (assets/onboarding/, 1..5 by step order) ---
const ONBOARDING_ART: Record<number, number> = {
  1: require('@/assets/onboarding/onboarding_1.png'),
  2: require('@/assets/onboarding/onboarding_2.png'),
  3: require('@/assets/onboarding/onboarding_3.png'),
  4: require('@/assets/onboarding/onboarding_4.png'),
  5: require('@/assets/onboarding/step5_name.png'),
};

export const STEP5_NAME_ART = require('@/assets/onboarding/step5_name.png') as number;

export function onboardingArt(step: number): number | null {
  return ONBOARDING_ART[step] ?? null;
}

// --- Rest assets (assets/rest/) ---
export const REST_ART: Record<string, number> = {
  rest_detailed: require('@/assets/rest/rest_detailed.png'),
  rest_simple: require('@/assets/rest/rest_simple.png'),
};

export const REST_DETAILED_ART = require('@/assets/rest/rest_detailed.png') as number;
export const REST_SIMPLE_ART = require('@/assets/rest/rest_simple.png') as number;

export function restArt(key: string | null | undefined): number | null {
  return key ? (REST_ART[key] ?? null) : null;
}
