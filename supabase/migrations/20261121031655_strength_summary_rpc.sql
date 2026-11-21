-- Progress list: one row per exercise (first vs latest session strength).
create or replace function public.strength_summary()
returns table (exercise_id uuid, name text, muscle_group text, sessions int, first_e1rm numeric, last_e1rm numeric, last_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select ls.exercise_id, min(ls.name), min(ls.muscle_group), count(*)::int,
    (array_agg(ls.best_e1rm order by ls.done_at, ls.session_id))[1],
    (array_agg(ls.best_e1rm order by ls.done_at desc, ls.session_id))[1],
    max(ls.done_at)
  from public.lift_sessions() ls group by ls.exercise_id;
$$;
revoke all on function public.strength_summary() from public, anon;
grant execute on function public.strength_summary() to authenticated;
