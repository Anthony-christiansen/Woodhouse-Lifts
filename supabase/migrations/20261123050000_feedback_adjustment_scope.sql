-- v1.12.1 (outside audit, 2026-11-22, finding 1): apply_feedback_adjustment only changes the rows that feedback
-- entry is allowed to change. Before, it accepted any of the caller's own workout_exercises rows; a modified client
-- could have changed unrelated workouts in the same account (never another account's: RLS + user_id checks).
-- Now, for feedback on muscle M from day D (meso X, week W, day_index I):
--   p_changes may only touch exercises for muscle M on the day (X, W+1, I), and only while that day isn't completed
--   or skipped and isn't the deload week;
--   p_deload may only touch exercises for muscle M on the deload day (X, last week, I), and only when W+1 is the
--   last accumulation week;
--   only the known keys are accepted, with values inside the table's limits; anything else rejects the whole call
--   (errcode 22023, nothing is changed).
-- Same signature, same once-only behaviour, so the app needs no change.
create or replace function public.apply_feedback_adjustment(p_feedback_id uuid, p_soreness int, p_changes jsonb, p_deload jsonb default '[]'::jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); done boolean; c jsonb; k text;
  f_muscle text; src_day uuid; meso uuid; src_week int; src_idx int; weeks int;
  tgt_day uuid; tgt_done boolean; dl_day uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select f.adjusted, f.muscle_group, f.workout_day_id into done, f_muscle, src_day
    from public.muscle_feedback f where f.id = p_feedback_id and f.user_id = uid for update;
  if not found then raise exception 'Feedback not found' using errcode = 'P0002'; end if;
  if p_soreness is not null and p_soreness not between 0 and 3 then raise exception 'Invalid soreness' using errcode = '22023'; end if;
  if done then
    update public.muscle_feedback set soreness = coalesce(soreness, p_soreness), recovery_at = coalesce(recovery_at, now()) where id = p_feedback_id;
    return false;                                   -- already applied once: never twice
  end if;
  if jsonb_typeof(coalesce(p_changes, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_deload, '[]'::jsonb)) <> 'array' then
    raise exception 'Changes must be lists' using errcode = '22023';
  end if;

  select d.mesocycle_id, d.week, d.day_index, m.weeks into meso, src_week, src_idx, weeks
    from public.workout_days d join public.mesocycles m on m.id = d.mesocycle_id
    where d.id = src_day and d.user_id = uid;
  select d.id, (d.completed_at is not null or d.skipped_at is not null) into tgt_day, tgt_done
    from public.workout_days d where d.mesocycle_id = meso and d.week = src_week + 1 and d.day_index = src_idx and d.user_id = uid;

  if jsonb_array_length(coalesce(p_changes, '[]'::jsonb)) > 0 then
    if tgt_day is null or tgt_done or src_week + 1 >= weeks then
      raise exception 'No open workout next week to adjust' using errcode = '22023';
    end if;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    if jsonb_typeof(c) <> 'object' then raise exception 'Bad change' using errcode = '22023'; end if;
    for k in select jsonb_object_keys(c) loop
      if k not in ('id', 'target_sets', 'target_rir', 'flag') then raise exception 'Unexpected field %', k using errcode = '22023'; end if;
    end loop;
    if (c ? 'target_sets' and jsonb_typeof(c->'target_sets') <> 'null' and ((c->>'target_sets')::numeric not between 0 and 15 or (c->>'target_sets')::numeric % 1 <> 0))
      or (c ? 'target_rir' and jsonb_typeof(c->'target_rir') <> 'null' and ((c->>'target_rir')::numeric not between 0 and 10 or (c->>'target_rir')::numeric % 1 <> 0))
      or (c ? 'flag' and jsonb_typeof(c->'flag') not in ('string', 'null'))
      or length(coalesce(c->>'flag', '')) > 300 then
      raise exception 'Value out of range' using errcode = '22023';
    end if;
    if not exists (select 1 from public.workout_exercises w join public.exercises e on e.id = w.exercise_id
                   where w.id = (c->>'id')::uuid and w.user_id = uid and w.workout_day_id = tgt_day and e.muscle_group = f_muscle) then
      raise exception 'That exercise is not part of this adjustment' using errcode = '22023';
    end if;
    update public.workout_exercises set
      target_sets = coalesce((c->>'target_sets')::smallint, target_sets),
      target_rir  = coalesce((c->>'target_rir')::smallint, target_rir),
      flag        = case when c ? 'flag' then nullif(c->>'flag', '') else flag end
    where id = (c->>'id')::uuid and user_id = uid;
  end loop;

  if jsonb_array_length(coalesce(p_deload, '[]'::jsonb)) > 0 then
    if weeks < 3 or src_week + 1 <> weeks - 1 then raise exception 'Deload only follows the last hard week' using errcode = '22023'; end if;
    select d.id into dl_day from public.workout_days d where d.mesocycle_id = meso and d.week = weeks and d.day_index = src_idx and d.user_id = uid;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_deload, '[]'::jsonb)) loop
    if jsonb_typeof(c) <> 'object' then raise exception 'Bad change' using errcode = '22023'; end if;
    for k in select jsonb_object_keys(c) loop
      if k not in ('workout_day_id', 'exercise_id', 'target_sets') then raise exception 'Unexpected field %', k using errcode = '22023'; end if;
    end loop;
    if jsonb_typeof(c->'target_sets') <> 'number' or (c->>'target_sets')::numeric not between 0 and 15 or (c->>'target_sets')::numeric % 1 <> 0 then
      raise exception 'Value out of range' using errcode = '22023';
    end if;
    if dl_day is null or (c->>'workout_day_id')::uuid is distinct from dl_day
       or not exists (select 1 from public.exercises e where e.id = (c->>'exercise_id')::uuid and e.muscle_group = f_muscle) then
      raise exception 'That exercise is not part of this adjustment' using errcode = '22023';
    end if;
    update public.workout_exercises set target_sets = (c->>'target_sets')::smallint
    where workout_day_id = dl_day and exercise_id = (c->>'exercise_id')::uuid and user_id = uid;
  end loop;
  update public.muscle_feedback set soreness = p_soreness, recovery_at = now(), adjusted = true where id = p_feedback_id;
  return true;
end $$;
revoke all on function public.apply_feedback_adjustment(uuid, int, jsonb, jsonb) from public, anon;
grant execute on function public.apply_feedback_adjustment(uuid, int, jsonb, jsonb) to authenticated;
