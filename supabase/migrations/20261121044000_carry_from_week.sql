-- "Run it again" from a chosen week (doc §5.6): the new meso's week 1 starts from the weights and reps
-- you logged in week N of the source meso, instead of the previous meso's last working week.
alter table public.mesocycles add column if not exists carry_meso_id uuid references public.mesocycles(id) on delete set null;
alter table public.mesocycles add column if not exists carry_week int check (carry_week is null or carry_week >= 1);

create or replace function public.create_mesocycle(p jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); mid uuid; d jsonb; did uuid; key uuid := nullif(p->>'client_key', '')::uuid;
  wanted int; visible int; cmeso uuid := nullif(p->>'carry_meso_id', '')::uuid; cweek int := nullif(p->>'carry_week', '')::int;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if key is not null then
    select id into mid from public.mesocycles where user_id = uid and client_key = key;
    if mid is not null then return mid; end if;           -- retry of a create that already succeeded
  end if;
  -- the carry-from meso must be one of yours (otherwise ignored)
  if cmeso is not null and not exists (select 1 from public.mesocycles where id = cmeso and user_id = uid) then cmeso := null; cweek := null; end if;
  if cmeso is null then cweek := null; end if;
  select count(distinct (x->>'exercise_id')) into wanted
    from jsonb_array_elements(p->'days') dd, jsonb_array_elements(dd->'exercises') x;
  select count(*) into visible from public.exercises e
    where e.id in (select (x->>'exercise_id')::uuid from jsonb_array_elements(p->'days') dd, jsonb_array_elements(dd->'exercises') x);
  if wanted = 0 then raise exception 'A mesocycle needs at least one exercise' using errcode = '22023'; end if;
  if visible <> wanted then raise exception 'Unknown exercise in plan' using errcode = '22023'; end if;

  insert into public.mesocycles (user_id, name, weeks, days_per_week, focus, goal, priorities, started_on, client_key, carry_meso_id, carry_week)
  values (uid, nullif(trim(p->>'name'), ''), (p->>'weeks')::int, (p->>'days_per_week')::int, p->>'focus',
          coalesce(nullif(p->>'goal', ''), 'hypertrophy'), coalesce(p->'priorities', '{}'::jsonb), (p->>'started_on')::date, key, cmeso, cweek)
  returning id into mid;
  for d in select * from jsonb_array_elements(p->'days') loop
    insert into public.workout_days (user_id, mesocycle_id, week, day_index, label)
    values (uid, mid, (d->>'week')::int, (d->>'day_index')::int, d->>'label') returning id into did;
    insert into public.workout_exercises (user_id, workout_day_id, exercise_id, position, target_sets, target_rir)
    select uid, did, (x->>'exercise_id')::uuid, t.ord::int, (x->>'target_sets')::int, (x->>'target_rir')::int
    from jsonb_array_elements(d->'exercises') with ordinality as t(x, ord);
  end loop;
  return mid;
end $$;
revoke all on function public.create_mesocycle(jsonb) from public, anon;
grant execute on function public.create_mesocycle(jsonb) to authenticated;
