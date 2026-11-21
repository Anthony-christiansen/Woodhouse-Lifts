-- Priority 1 reliability fixes.

-- 1) Atomic, idempotent mesocycle creation.
--    The builder used to make 3 separate requests (meso → days → exercises); a dropped connection could
--    leave a half-built meso and a retry could create a duplicate. Now one call does it all inside a
--    single transaction, and a client-generated key makes retries return the meso already created.
alter table public.mesocycles add column if not exists client_key uuid;
-- Training goal per mesocycle (doc §1.10). Existing mesocycles are hypertrophy, which is what they were built as.
alter table public.mesocycles add column if not exists goal text not null default 'hypertrophy'
  check (goal in ('hypertrophy', 'strength', 'athletic'));
alter table public.templates add column if not exists goal text not null default 'hypertrophy'
  check (goal in ('hypertrophy', 'strength', 'athletic'));
create unique index if not exists mesocycles_client_key_uniq on public.mesocycles (user_id, client_key) where client_key is not null;

-- p = { client_key, name, weeks, days_per_week, focus, goal, priorities, started_on,
--       days: [{ week, day_index, label, exercises: [{ exercise_id, target_sets, target_rir }] }] }
-- Targets (sets, RIR) are computed by the app's training engine (logic.js) and passed in unchanged.
create or replace function public.create_mesocycle(p jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); mid uuid; d jsonb; did uuid; key uuid := nullif(p->>'client_key', '')::uuid;
  wanted int; visible int;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if key is not null then
    select id into mid from public.mesocycles where user_id = uid and client_key = key;
    if mid is not null then return mid; end if;           -- retry of a create that already succeeded
  end if;
  -- every exercise must be one this user can see (shared library or their own)
  select count(distinct (x->>'exercise_id')) into wanted
    from jsonb_array_elements(p->'days') dd, jsonb_array_elements(dd->'exercises') x;
  select count(*) into visible from public.exercises e
    where e.id in (select (x->>'exercise_id')::uuid from jsonb_array_elements(p->'days') dd, jsonb_array_elements(dd->'exercises') x);
  if wanted = 0 then raise exception 'A mesocycle needs at least one exercise' using errcode = '22023'; end if;
  if visible <> wanted then raise exception 'Unknown exercise in plan' using errcode = '22023'; end if;

  insert into public.mesocycles (user_id, name, weeks, days_per_week, focus, goal, priorities, started_on, client_key)
  values (uid, nullif(trim(p->>'name'), ''), (p->>'weeks')::int, (p->>'days_per_week')::int, p->>'focus',
          coalesce(nullif(p->>'goal', ''), 'hypertrophy'), coalesce(p->'priorities', '{}'::jsonb), (p->>'started_on')::date, key)
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

-- 2) Dashboard accuracy: warm-up sets are not hard sets; "workouts" = finished workouts, separate from
--    distinct training dates.
create or replace function public.lift_sessions(p_exercise_id uuid default null)
returns table (exercise_id uuid, name text, muscle_group text, session_id uuid, done_at timestamptz,
               best_e1rm numeric, top_weight numeric, top_reps int, n_sets int)
language sql stable security invoker set search_path = '' as $$
  with bw as (select coalesce((select p.bodyweight from public.profiles p where p.id = auth.uid()), 0) as bw),
  s as (
    select we.exercise_id, e.name, e.muscle_group, we.id as sid, st.completed_at, st.weight, st.reps,
      case e.load_type
        when 'bodyweight' then (select bw from bw) + coalesce(st.weight, 0)
        when 'assisted' then greatest(0, (select bw from bw) - coalesce(st.weight, 0))
        else coalesce(st.weight, 0) end as load,
      st.reps + coalesce(st.rir, we.target_rir, 0) as rr
    from public.sets st
    join public.workout_exercises we on we.id = st.workout_exercise_id
    join public.exercises e on e.id = we.exercise_id
    where st.user_id = auth.uid() and st.completed_at is not null and st.reps is not null and st.duration_min is null
      and e.load_type <> 'cardio' and coalesce(st.set_type, 'straight') not in ('myorep', 'warmup')
      and coalesce(we.target_rir, 0) < 4
      and (p_exercise_id is null or we.exercise_id = p_exercise_id)),
  v as (select s.*, case when s.load > 0 then s.load * (1 + s.rr / 30.0) else s.rr::numeric end as e1 from s)
  select distinct on (v.sid) v.exercise_id, v.name, v.muscle_group, v.sid,
    max(v.completed_at) over (partition by v.sid), round(max(v.e1) over (partition by v.sid), 2),
    v.weight, v.reps, (count(*) over (partition by v.sid))::int
  from v order by v.sid, v.e1 desc;
$$;

create or replace function public.dashboard_stats(p_tz text default 'UTC')
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  result jsonb;
begin
  with lift as (   -- hard sets: completed, lifting (not cardio), not warm-ups
    select st.completed_at
    from public.sets st
    join public.workout_exercises we on we.id = st.workout_exercise_id
    join public.exercises e on e.id = we.exercise_id
    where st.user_id = auth.uid() and st.completed_at is not null and st.duration_min is null
      and e.load_type <> 'cardio' and coalesce(st.set_type, 'straight') <> 'warmup'),
  weeks as (
    select (date_trunc('week', completed_at at time zone tz))::date as wk, count(*) as n
    from lift where completed_at > now() - interval '10 weeks' group by 1),
  ls as (select * from public.lift_sessions()),
  ranked as (
    select ls.*, row_number() over (partition by ls.exercise_id order by ls.done_at desc, ls.session_id) as rn_desc
    from ls),
  last as (select * from ranked where rn_desc = 1),
  prev_best as (
    select r.exercise_id, max(r.best_e1rm) as best from ranked r where r.rn_desc > 1 group by r.exercise_id),
  base as (
    select distinct on (ls.exercise_id) ls.exercise_id, ls.session_id, ls.best_e1rm
    from ls where ls.done_at > now() - interval '56 days' order by ls.exercise_id, ls.done_at, ls.session_id),
  prs as (
    select l.name, round((l.best_e1rm - p.best) / p.best * 100, 1) as pct, l.done_at
    from last l join prev_best p using (exercise_id)
    where l.done_at > now() - interval '14 days' and p.best > 0 and l.best_e1rm > p.best),
  movers as (
    select l.name, round((l.best_e1rm - b.best_e1rm) / b.best_e1rm * 100, 1) as pct
    from last l join base b using (exercise_id)
    where b.session_id <> l.session_id and b.best_e1rm > 0)
  select jsonb_build_object(
    'tz', tz,
    'weeks', coalesce((select jsonb_object_agg(wk::text, n) from weeks), '{}'::jsonb),
    'workouts', (select count(*) from public.workout_days d where d.user_id = auth.uid() and d.completed_at is not null and d.skipped_at is null),
    'training_days', (select count(distinct (completed_at at time zone tz)::date) from lift),
    'sets', (select count(*) from lift),
    'prs', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'pct', pct, 'date', done_at) order by pct desc) from prs), '[]'::jsonb),
    'movers', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'pct', pct) order by pct desc) from movers), '[]'::jsonb))
  into result;
  return result;
end $$;
