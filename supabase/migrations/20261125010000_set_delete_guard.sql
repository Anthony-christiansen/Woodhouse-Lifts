-- Audit 1.20.8, F02 (other-device part; approved 2026-11-25): a set removed on one phone could be re-created by a
-- stale offline copy of it on another phone, when that phone syncs later.
-- Clock-free guard: every save says which server row it was edited from (sets.based_on). Deleting a set remembers that
-- row's id (set_tombstones, 30 days). A save based on a deleted row is skipped by the server (no error, no row back),
-- and the app lists it under Settings → Sync problems. A save that starts fresh (re-adding the set) has no based_on
-- or a different one, so it goes through. Older app copies send no based_on and behave exactly as before.
-- Rollback: supabase/ops/rollback_20261125010000_set_delete_guard.sql

alter table public.sets add column if not exists based_on uuid;
comment on column public.sets.based_on is 'Server row id the client edited this set from (null = new / older app). Used only by the delete guard.';

create table if not exists public.set_tombstones (
  row_id uuid primary key,                       -- the deleted sets.id
  user_id uuid not null default auth.uid(),
  workout_exercise_id uuid not null,
  set_index smallint not null,
  deleted_at timestamptz not null default now()
);
-- no foreign key on purpose: deleting a workout cascades to its sets, and their tombstones must not block that
create index if not exists set_tombstones_user_idx on public.set_tombstones (user_id, deleted_at);
alter table public.set_tombstones enable row level security;
create policy "own tombstones" on public.set_tombstones for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.set_tombstones from anon;

create or replace function public.sets_remember_delete() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.set_tombstones (row_id, user_id, workout_exercise_id, set_index)
  values (old.id, old.user_id, old.workout_exercise_id, old.set_index)
  on conflict (row_id) do update set deleted_at = now();
  delete from public.set_tombstones where user_id = old.user_id and deleted_at < now() - interval '30 days';
  return old;
end $$;

create or replace function public.sets_skip_deleted() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- new.id = new.based_on means the deleted row itself is being put back (a restore from backup): always allowed.
  -- Accepted rows only ever have based_on = null or their own id, so a client save never matches that by accident.
  if new.based_on is not null and new.based_on <> new.id and exists (select 1 from public.set_tombstones t where t.row_id = new.based_on) then
    return null;   -- edited from a row that has since been deleted: skip it (the app shows it as a sync problem)
  end if;
  return new;
end $$;

drop trigger if exists sets_remember_delete on public.sets;
create trigger sets_remember_delete after delete on public.sets for each row execute function public.sets_remember_delete();
drop trigger if exists sets_skip_deleted on public.sets;
create trigger sets_skip_deleted before insert or update on public.sets for each row execute function public.sets_skip_deleted();
revoke all on function public.sets_remember_delete() from public, anon;
revoke all on function public.sets_skip_deleted() from public, anon;
