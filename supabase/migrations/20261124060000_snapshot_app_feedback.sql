-- v1.19.1: snapshots (and so the weekly Drive backups) now include app_feedback (added in 1.15.0).
-- Same function, one more table. Columns added since (workout_days.superseded_at, mesocycles.revision /
-- light_week_undo) were already captured, because each row is stored whole (to_jsonb). No data changes.
create or replace function backup.take_snapshot(keep interval default interval '35 days')
returns int language plpgsql security definer set search_path = '' as $$
declare
  t text; ts timestamptz := now(); n int := 0;
  tables text[] := array['profiles','exercises','templates','mesocycles','workout_days','workout_exercises','sets','muscle_feedback','exercise_feedback','exercise_prefs','cardio_sessions','app_feedback'];
begin
  foreach t in array tables loop
    execute format('insert into backup.snapshot (taken_at, tbl, row_count, data)
                    select $1, %L, count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t, t) using ts;
    n := n + 1;
  end loop;
  delete from backup.snapshot where taken_at < now() - keep;
  return n;
end $$;
revoke all on function backup.take_snapshot(interval) from public, anon, authenticated;
