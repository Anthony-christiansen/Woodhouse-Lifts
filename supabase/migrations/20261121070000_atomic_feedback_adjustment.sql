-- Recovery-based set adjustments in ONE transaction, at most once per feedback entry (review #2, 2026-11-21).
-- The app works out the changes (training engine, logic.js) and sends them here. The feedback row is locked;
-- if it was already adjusted (e.g. a retry after a dropped connection), nothing is changed again.
-- p_changes:  [{ id, target_sets?, target_rir?, flag? }]           — next week's workout_exercises rows
-- p_deload:   [{ workout_day_id, exercise_id, target_sets }]       — deload week follows the last accumulation week
create or replace function public.apply_feedback_adjustment(p_feedback_id uuid, p_soreness int, p_changes jsonb, p_deload jsonb default '[]'::jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); done boolean; c jsonb;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select adjusted into done from public.muscle_feedback where id = p_feedback_id and user_id = uid for update;
  if not found then raise exception 'Feedback not found' using errcode = 'P0002'; end if;
  if done then
    update public.muscle_feedback set soreness = coalesce(soreness, p_soreness), recovery_at = coalesce(recovery_at, now()) where id = p_feedback_id;
    return false;                                   -- already applied once: never twice
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    update public.workout_exercises set
      target_sets = coalesce((c->>'target_sets')::smallint, target_sets),
      target_rir  = coalesce((c->>'target_rir')::smallint, target_rir),
      flag        = case when c ? 'flag' then nullif(c->>'flag', '') else flag end
    where id = (c->>'id')::uuid and user_id = uid;
  end loop;
  for c in select * from jsonb_array_elements(coalesce(p_deload, '[]'::jsonb)) loop
    update public.workout_exercises set target_sets = (c->>'target_sets')::smallint
    where workout_day_id = (c->>'workout_day_id')::uuid and exercise_id = (c->>'exercise_id')::uuid and user_id = uid;
  end loop;
  update public.muscle_feedback set soreness = p_soreness, recovery_at = now(), adjusted = true where id = p_feedback_id;
  return true;
end $$;
revoke all on function public.apply_feedback_adjustment(uuid, int, jsonb, jsonb) from public, anon;
grant execute on function public.apply_feedback_adjustment(uuid, int, jsonb, jsonb) to authenticated;
