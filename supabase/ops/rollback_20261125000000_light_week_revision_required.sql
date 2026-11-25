-- Rollback for 20261125000000_light_week_revision_required: put back the 20261124010000 definitions
-- (revision optional). Run as one transaction. Data is untouched either way.
begin;
drop function if exists public.start_light_week(uuid, integer);
drop function if exists public.undo_light_week(uuid, integer);
create or replace function public.start_light_week(p_meso uuid, p_revision integer default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); m record; t smallint; targets jsonb; n int;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select id, weeks, status, revision into m from public.mesocycles where id = p_meso and user_id = uid for update;
  if not found then raise exception 'Mesocycle not found' using errcode = 'P0002'; end if;
  if p_revision is not null and p_revision <> m.revision then
    raise exception 'This meso changed since the preview (another device or tab?) — nothing was changed' using errcode = '40001';
  end if;
  if m.status not in ('active', 'planned') then raise exception 'This mesocycle is not running' using errcode = '22023'; end if;
  -- lock the meso's days too, so a day can't be started or finished between the check and the change
  perform 1 from public.workout_days d where d.mesocycle_id = p_meso and d.superseded_at is null for update;
  select coalesce(max(d.week), 0) + 1 into t from public.workout_days d
   where d.mesocycle_id = p_meso and d.superseded_at is null
     and (d.completed_at is not null or d.started_at is not null or d.skipped_at is not null
          or exists (select 1 from public.workout_exercises we join public.sets s on s.workout_exercise_id = we.id where we.workout_day_id = d.id));
  if t >= m.weeks then raise exception 'The light week is already next' using errcode = '22023'; end if;
  if t < 3 then raise exception 'A light week can start from week 3' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', we.id, 'sets', we.target_sets, 'rir', we.target_rir)), '[]'::jsonb) into targets
    from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id
   where d.mesocycle_id = p_meso and d.week = t and d.superseded_at is null;
  update public.workout_exercises we set target_sets = greatest(1, ceil(coalesce(we.target_sets, 0) / 2.0))::smallint, target_rir = 4
    from public.workout_days d where we.workout_day_id = d.id and d.mesocycle_id = p_meso and d.week = t and d.superseded_at is null;
  update public.workout_days d set superseded_at = now() where d.mesocycle_id = p_meso and d.week > t and d.superseded_at is null;
  get diagnostics n = row_count;
  update public.mesocycles set weeks = t, revision = revision + 1,
    light_week_undo = jsonb_build_object('weeks', m.weeks, 'week', t, 'targets', targets, 'at', now())
   where id = p_meso;
  return jsonb_build_object('week', t, 'revision', m.revision + 1, 'superseded', n, 'old_weeks', m.weeks);
end $$;

create or replace function public.undo_light_week(p_meso uuid, p_revision integer default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); m record; u jsonb; c jsonb;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select id, weeks, revision, light_week_undo into m from public.mesocycles where id = p_meso and user_id = uid for update;
  if not found then raise exception 'Mesocycle not found' using errcode = 'P0002'; end if;
  if p_revision is not null and p_revision <> m.revision then
    raise exception 'This meso changed since you opened it — nothing was changed' using errcode = '40001';
  end if;
  u := m.light_week_undo;
  if u is null then raise exception 'There is no early light week to undo' using errcode = '22023'; end if;
  if exists (select 1 from public.workout_days d join public.workout_exercises we on we.workout_day_id = d.id join public.sets s on s.workout_exercise_id = we.id
              where d.mesocycle_id = p_meso and d.week = (u->>'week')::int and d.superseded_at is null) then
    raise exception 'You''ve already logged sets in the light week, so it can''t be undone' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(u->'targets') loop
    update public.workout_exercises we set target_sets = (c->>'sets')::smallint, target_rir = (c->>'rir')::smallint
      from public.workout_days d where we.id = (c->>'id')::uuid and we.workout_day_id = d.id and d.mesocycle_id = p_meso;
  end loop;
  update public.workout_days d set superseded_at = null where d.mesocycle_id = p_meso and d.superseded_at is not null;
  update public.mesocycles set weeks = (u->>'weeks')::smallint, revision = revision + 1, light_week_undo = null where id = p_meso;
  return jsonb_build_object('weeks', (u->>'weeks')::int, 'revision', m.revision + 1);
end $$;

revoke all on function public.start_light_week(uuid, integer) from public, anon;
revoke all on function public.undo_light_week(uuid, integer) from public, anon;
grant execute on function public.start_light_week(uuid, integer) to authenticated;
grant execute on function public.undo_light_week(uuid, integer) to authenticated;
commit;
