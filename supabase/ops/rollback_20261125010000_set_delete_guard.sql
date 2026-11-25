-- Rollback for 20261125010000_set_delete_guard. Removes the guard; set data is untouched
-- (sets.based_on is dropped — it only ever held the id a save was based on).
begin;
drop trigger if exists sets_skip_deleted on public.sets;
drop trigger if exists sets_remember_delete on public.sets;
drop function if exists public.sets_skip_deleted();
drop function if exists public.sets_remember_delete();
drop table if exists public.set_tombstones;
alter table public.sets drop column if exists based_on;
commit;
