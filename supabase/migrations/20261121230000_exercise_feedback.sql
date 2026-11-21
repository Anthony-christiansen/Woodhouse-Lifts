-- v1.10: feedback per exercise, alongside the existing per-muscle feedback.
-- After the last set of each exercise you rate that exercise's workload and joint pain (0-3, same scales as
-- muscle_feedback). The muscle-group rating (pump, workload, joint pain, then next-session soreness) is unchanged.
-- Progression uses both: the exercise's own rating decides that lift's speed, the muscle rating caps it (doc §4.3).

create table if not exists public.exercise_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_exercise_id uuid not null,
  workload smallint check (workload between 0 and 3),
  joint_pain smallint check (joint_pain between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_exercise_id),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);
create index if not exists exercise_feedback_user_idx on public.exercise_feedback (user_id);

alter table public.exercise_feedback enable row level security;
drop policy if exists "own rows" on public.exercise_feedback;
create policy "own rows" on public.exercise_feedback
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.exercise_feedback from anon;

-- Include the new table in the weekly safety-net snapshot.
create or replace function backup.take_snapshot(keep interval default interval '35 days')
returns int language plpgsql security definer set search_path = '' as $$
declare
  t text; ts timestamptz := now(); n int := 0;
  tables text[] := array['profiles','exercises','templates','mesocycles','workout_days','workout_exercises','sets','muscle_feedback','exercise_feedback','exercise_prefs','cardio_sessions'];
begin
  foreach t in array tables loop
    execute format('insert into backup.snapshot (taken_at, tbl, row_count, data)
                    select $1, %L, count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t, t) using ts;
    n := n + 1;
  end loop;
  delete from backup.snapshot where taken_at < now() - keep;
  return n;
end $$;
revoke all on function backup.take_snapshot(interval) from public, anon, authenticated;
