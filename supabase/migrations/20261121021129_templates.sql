create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  focus text not null default 'custom' check (focus in ('upper', 'lower', 'whole', 'custom')),
  priorities jsonb not null default '{}'::jsonb,
  weeks smallint not null default 5 check (weeks between 3 and 12),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  plan jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);
create index templates_user_idx on public.templates (user_id);
alter table public.templates enable row level security;
create policy "own rows" on public.templates
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
