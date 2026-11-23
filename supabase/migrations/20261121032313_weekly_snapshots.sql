-- Free-plan safety net: a weekly copy of every user-data table, kept 5 weeks, inside the database.
-- Protects against accidental deletes, bad imports and broken migrations. It does NOT protect against
-- losing the whole project — that needs Supabase Pro backups or an off-site export.
-- The backup schema is not exposed through the API (only public is), and app users have no access.

create extension if not exists pg_cron;

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.snapshot (
  taken_at timestamptz not null default now(),
  tbl text not null,
  row_count int not null,
  data jsonb not null,
  primary key (taken_at, tbl)
);
revoke all on backup.snapshot from public, anon, authenticated;

create or replace function backup.take_snapshot(keep interval default interval '35 days')
returns int language plpgsql security definer set search_path = '' as $$
declare
  t text; ts timestamptz := now(); n int := 0;
  tables text[] := array['profiles','exercises','templates','mesocycles','workout_days','workout_exercises','sets','muscle_feedback','cardio_sessions'];
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

-- Sundays 09:15 UTC (early Sunday morning in US time zones).
select cron.unschedule(jobid) from cron.job where jobname = 'weekly-snapshot';
select cron.schedule('weekly-snapshot', '15 9 * * 0', $$select backup.take_snapshot()$$);

-- How to restore one user's mesocycle from a snapshot (run by hand in the SQL editor), e.g.:
--   select x.* from backup.snapshot s, jsonb_populate_recordset(null::public.sets, s.data) x
--   where s.tbl = 'sets' and s.taken_at = '<snapshot time>' and x.user_id = '<user id>';
