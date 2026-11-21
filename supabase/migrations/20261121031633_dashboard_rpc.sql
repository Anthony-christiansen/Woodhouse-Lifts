-- Server-side dashboard math so the app downloads a few KB instead of a user's whole set history.
-- Both functions are SECURITY INVOKER: row-level security still applies, and every query is also
-- pinned to auth.uid(), so a user only ever sees their own numbers.

-- One row per (exercise, session): best estimated strength, same model as logic.js e1rm():
--   load × (1 + (reps + RIR)/30); bodyweight lifts add bodyweight, assisted subtract assistance;
--   no load → reps + RIR. Like-for-like only: no cardio, no myo-rep mini-sets, no deload (target RIR ≥ 4).
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
      and e.load_type <> 'cardio' and coalesce(st.set_type, 'straight') <> 'myorep' and coalesce(we.target_rir, 0) < 4
      and (p_exercise_id is null or we.exercise_id = p_exercise_id)),
  v as (select s.*, case when s.load > 0 then s.load * (1 + s.rr / 30.0) else s.rr::numeric end as e1 from s)
  select distinct on (v.sid) v.exercise_id, v.name, v.muscle_group, v.sid,
    max(v.completed_at) over (partition by v.sid), round(max(v.e1) over (partition by v.sid), 2),
    v.weight, v.reps, (count(*) over (partition by v.sid))::int
  from v order by v.sid, v.e1 desc;
$$;

-- Everything the home dashboard needs, in one small JSON object.
create or replace function public.dashboard_stats(p_tz text default 'UTC')
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  result jsonb;
begin
  with lift as (
    select st.completed_at
    from public.sets st
    join public.workout_exercises we on we.id = st.workout_exercise_id
    join public.exercises e on e.id = we.exercise_id
    where st.user_id = auth.uid() and st.completed_at is not null and st.duration_min is null and e.load_type <> 'cardio'),
  weeks as (
    select (date_trunc('week', completed_at at time zone tz))::date as wk, count(*) as n
    from lift where completed_at > now() - interval '10 weeks' group by 1),
  ls as (select * from public.lift_sessions()),
  ranked as (
    select ls.*, row_number() over (partition by ls.exercise_id order by ls.done_at desc, ls.session_id) as rn_desc,
      count(*) over (partition by ls.exercise_id) as n_sess
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
    'workouts', (select count(distinct (completed_at at time zone tz)::date) from lift),
    'sets', (select count(*) from lift),
    'prs', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'pct', pct, 'date', done_at) order by pct desc) from prs), '[]'::jsonb),
    'movers', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'pct', pct) order by pct desc) from movers), '[]'::jsonb))
  into result;
  return result;
end $$;

revoke all on function public.lift_sessions(uuid) from public, anon;
revoke all on function public.dashboard_stats(text) from public, anon;
grant execute on function public.lift_sessions(uuid) to authenticated;
grant execute on function public.dashboard_stats(text) to authenticated;

