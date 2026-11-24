-- v1.17.0 (audit T4): take the light (deload) week early, when the app's fatigue check suggests it and you agree.
-- One transaction: the first week with nothing logged becomes the meso's last week, its targets become a light week
-- (half the sets rounded up, at least 1; 4 reps short of failure), and the planned-but-untouched weeks after it are
-- removed. Logged work is never touched. Only the owner can do it (security invoker + RLS + explicit owner checks).
create or replace function public.start_light_week(p_meso uuid)
returns smallint language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); n_weeks smallint; st text; t smallint;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select m.weeks, m.status into n_weeks, st from public.mesocycles m where m.id = p_meso and m.user_id = uid for update;
  if not found then raise exception 'Mesocycle not found' using errcode = 'P0002'; end if;
  if st not in ('active', 'planned') then raise exception 'This mesocycle is not running' using errcode = '22023'; end if;
  -- the first week from which nothing has been started, finished, skipped or logged
  select coalesce(max(d.week), 0) + 1 into t from public.workout_days d
   where d.mesocycle_id = p_meso and d.user_id = uid
     and (d.completed_at is not null or d.started_at is not null or d.skipped_at is not null
          or exists (select 1 from public.workout_exercises we join public.sets s on s.workout_exercise_id = we.id where we.workout_day_id = d.id));
  if t >= n_weeks then raise exception 'The light week is already next' using errcode = '22023'; end if;
  if t < 3 then raise exception 'A light week can start from week 3' using errcode = '22023'; end if;
  update public.workout_exercises we set target_sets = greatest(1, ceil(coalesce(we.target_sets, 0) / 2.0))::smallint, target_rir = 4
    from public.workout_days d where we.workout_day_id = d.id and d.mesocycle_id = p_meso and d.user_id = uid and d.week = t;
  delete from public.workout_days d where d.mesocycle_id = p_meso and d.user_id = uid and d.week > t;
  update public.mesocycles set weeks = t where id = p_meso and user_id = uid;
  return t;
end $$;
revoke all on function public.start_light_week(uuid) from public, anon;
grant execute on function public.start_light_week(uuid) to authenticated;
