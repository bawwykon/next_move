alter table public.profiles
  drop column if exists age_range,
  drop column if exists activity_level,
  drop column if exists weekly_workouts,
  drop column if exists goal,
  drop column if exists target_steps;
