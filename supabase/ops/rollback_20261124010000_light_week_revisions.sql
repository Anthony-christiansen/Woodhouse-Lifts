-- Rollback for 20261124010000_light_week_revisions (run by hand, only with the owner's approval).
-- 1) Put back any meso that took an early light week under 1.17.1 (restores length, targets, hidden days):
--      select public.undo_light_week(id) from public.mesocycles where light_week_undo is not null;   -- as each owner
--    or, as the database owner, review first:  select id, user_id, light_week_undo from public.mesocycles where light_week_undo is not null;
-- 2) Remove the 1.17.1 functions. The columns stay (expand-only; harmless to older app versions).
drop function if exists public.undo_light_week(uuid, integer);
drop function if exists public.start_light_week(uuid, integer);
drop function if exists public.light_week_preview(uuid);
-- 3) Only if the 1.17.0 app must be restored with its button working, re-create the 1.17.0 function from
--    supabase/migrations/20261124000000_start_light_week.sql (it deletes later planned weeks; see audit D1).
