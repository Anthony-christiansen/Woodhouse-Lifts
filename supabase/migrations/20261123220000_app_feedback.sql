-- v1.15.0: in-app feedback ("Send feedback" in More). A star rating and/or a short note: bug, idea, praise, other.
-- Each person sees and adds only their own; nobody can edit or delete through the app. The owner reads them in
-- the Supabase dashboard (or asks Claude). No new access for anyone else.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  kind text not null default 'other' check (kind in ('bug', 'idea', 'praise', 'other')),
  message text check (char_length(message) <= 2000),
  app_version text check (char_length(app_version) <= 20),
  screen text check (char_length(screen) <= 80),
  created_at timestamptz not null default now(),
  check (rating is not null or char_length(coalesce(btrim(message), '')) > 0)
);
create index if not exists app_feedback_user_idx on public.app_feedback (user_id, created_at desc);

alter table public.app_feedback enable row level security;
drop policy if exists "read own" on public.app_feedback;
drop policy if exists "add own" on public.app_feedback;
create policy "read own" on public.app_feedback for select to authenticated using (user_id = (select auth.uid()));
create policy "add own" on public.app_feedback for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.app_feedback from anon;
revoke update, delete on public.app_feedback from authenticated;
