-- S3-01: content tables were RLS-enabled with no select policies, so client
-- reads (quest board) returned empty. Content is not user-specific.
create policy "Content readable by all"
  on public.quests for select
  using (true);

create policy "Content readable by all"
  on public.quest_segments for select
  using (true);

create policy "Content readable by all"
  on public.exercise_library for select
  using (true);

create policy "Content readable by all"
  on public.achievements for select
  using (true);

create policy "Content readable by all"
  on public.cosmetics for select
  using (true);
