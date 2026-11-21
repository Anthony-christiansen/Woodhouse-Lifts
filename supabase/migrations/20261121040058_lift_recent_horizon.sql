-- Per-lift insights compare against the last ~6 months only (years-old bests from different programs
-- would flag lifts as "down" for no current reason). Returns up to p_n recent sessions per lift.
drop function if exists public.lift_recent(uuid[], int);
create or replace function public.lift_recent(p_ids uuid[], p_n int default 30, p_days int default 182)
returns table (exercise_id uuid, name text, session_id uuid, done_at timestamptz, best_e1rm numeric,
               top_weight numeric, top_reps int, n_sets int, rn int, prior_best numeric)
language sql stable security invoker set search_path = '' as $$
  with ls as (select * from public.lift_sessions() l
              where l.exercise_id = any(p_ids) and l.done_at > now() - make_interval(days => greatest(p_days, 7))),
  r as (select ls.*, row_number() over (partition by ls.exercise_id order by ls.done_at desc, ls.session_id desc) as rn from ls),
  pb as (select r.exercise_id, max(r.best_e1rm) as best from r where r.rn > greatest(p_n, 1) group by r.exercise_id)
  select r.exercise_id, r.name, r.session_id, r.done_at, r.best_e1rm, r.top_weight, r.top_reps, r.n_sets, r.rn::int, pb.best
  from r left join pb using (exercise_id)
  where r.rn <= greatest(p_n, 1)
  order by r.exercise_id, r.done_at;
$$;
revoke all on function public.lift_recent(uuid[], int, int) from public, anon;
grant execute on function public.lift_recent(uuid[], int, int) to authenticated;
