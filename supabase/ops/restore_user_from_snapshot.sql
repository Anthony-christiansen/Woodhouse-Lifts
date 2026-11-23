-- Woodhouse Lifts — restore ONE user's data from a backup.snapshot (see docs/PLAYBOOK.md §5).
-- Replace the two placeholders, run the PREVIEW first, then the RESTORE.
--   __USER__      the user's uuid            e.g. 00000000-0000-0000-0000-000000000000
--   __TAKEN_AT__  the snapshot's taken_at    e.g. 2026-11-23 03:00:00.123+00   (select distinct taken_at from backup.snapshot order by 1 desc)
--   __MODE__      'missing'   = put back rows that were deleted, leave everything else alone (default, safest)
--                 'overwrite' = also set rows that still exist back to their snapshot values
-- Rows created AFTER the snapshot are never touched. Parents are restored before children (FK order).

-- PREVIEW: rows in the snapshot vs. rows now, per table, for this user.
-- select s.tbl, (select count(*) from jsonb_array_elements(s.data) e
--          where coalesce(e->>'user_id', e->>'owner_id', case when s.tbl='profiles' then e->>'id' end) = '__USER__') as in_snapshot
--   from backup.snapshot s where s.taken_at = '__TAKEN_AT__' order by s.tbl;

-- RESTORE
do $$
declare
  uid uuid := '__USER__'; ts timestamptz := '__TAKEN_AT__'; mode text := '__MODE__';
  t text; owner text; pk text; cols text; upd text; n int; total int := 0;
  tables text[] := array['profiles','exercises','templates','mesocycles','workout_days','workout_exercises','sets',
                         'muscle_feedback','exercise_feedback','exercise_prefs','cardio_sessions'];
begin
  if mode not in ('missing', 'overwrite') then raise exception 'mode must be missing or overwrite'; end if;
  if not exists (select 1 from backup.snapshot where taken_at = ts) then raise exception 'no snapshot at %', ts; end if;
  foreach t in array tables loop
    continue when not exists (select 1 from backup.snapshot where taken_at = ts and tbl = t);
    owner := case t when 'profiles' then 'id' when 'exercises' then 'owner_id' else 'user_id' end;
    select string_agg(quote_ident(a.attname), ',' order by a.attnum) into pk
      from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = format('public.%I', t)::regclass and i.indisprimary;
    select string_agg(quote_ident(column_name), ',' order by ordinal_position) into cols
      from information_schema.columns where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
    select string_agg(format('%1$I = excluded.%1$I', column_name), ',') into upd
      from information_schema.columns where table_schema = 'public' and table_name = t and is_generated = 'NEVER';
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I,
         (select data from backup.snapshot where taken_at = $1 and tbl = %1$L)) r where r.%3$I = $2
       on conflict (%4$s) do %5$s', t, cols, owner, pk,
      case when mode = 'overwrite' then 'update set ' || upd else 'nothing' end) using ts, uid;
    get diagnostics n = row_count; total := total + n;
    raise notice '% : % rows restored', t, n;
  end loop;
  raise notice 'total: % rows', total;
end $$;
