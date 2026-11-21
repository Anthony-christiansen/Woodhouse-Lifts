-- Recent sessions for a set of lifts (the current mesocycle's, or today's workout), for per-lift status flags.
-- Returns the last p_n sessions per exercise plus prior_best = best e1RM from that exercise's older sessions,
-- so the app can tell a real PR or stall from a short window without downloading the full history.
create or replace function public.lift_recent(p_ids uuid[], p_n int default 12)
returns table (exercise_id uuid, name text, session_id uuid, done_at timestamptz, best_e1rm numeric,
               top_weight numeric, top_reps int, n_sets int, rn int, prior_best numeric)
language sql stable security invoker set search_path = '' as $$
  with ls as (select * from public.lift_sessions() l where l.exercise_id = any(p_ids)),
  r as (select ls.*, row_number() over (partition by ls.exercise_id order by ls.done_at desc, ls.session_id desc) as rn from ls),
  pb as (select r.exercise_id, max(r.best_e1rm) as best from r where r.rn > greatest(p_n, 1) group by r.exercise_id)
  select r.exercise_id, r.name, r.session_id, r.done_at, r.best_e1rm, r.top_weight, r.top_reps, r.n_sets, r.rn::int, pb.best
  from r left join pb using (exercise_id)
  where r.rn <= greatest(p_n, 1)
  order by r.exercise_id, r.done_at;
$$;
revoke all on function public.lift_recent(uuid[], int) from public, anon;
grant execute on function public.lift_recent(uuid[], int) to authenticated;
