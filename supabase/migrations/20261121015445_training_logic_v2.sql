-- Training logic v2: exercise metadata, meso focus, performance, cardio, bodyweight.

alter table public.exercises
  add column kind text not null default 'compound' check (kind in ('compound', 'isolation')),
  add column load_type text not null default 'weighted' check (load_type in ('weighted', 'bodyweight', 'assisted')),
  add column rep_min smallint not null default 8 check (rep_min between 1 and 50),
  add column rep_max smallint not null default 15 check (rep_max between 1 and 60),
  add column secondary text[] not null default '{}';

alter table public.mesocycles
  add column focus text not null default 'custom' check (focus in ('upper', 'lower', 'whole', 'custom')),
  add column priorities jsonb not null default '{}'::jsonb;

alter table public.workout_exercises
  add column flag text;

alter table public.muscle_feedback
  add column performance smallint check (performance between -1 and 1),
  add column recovery_at timestamptz,
  add column adjusted boolean not null default false;
comment on column public.muscle_feedback.soreness is
  'Recovery rating, asked at the next session that trains this muscle: 0 never sore, 1 healed early, 2 healed just in time, 3 still sore';

alter table public.profiles
  add column bodyweight numeric(5,1);

create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  performed_on date not null default current_date,
  activity text not null,
  minutes numeric(5,1) not null check (minutes > 0 and minutes <= 600),
  rpe smallint not null check (rpe between 0 and 10),
  distance numeric(7,2) check (distance >= 0),
  distance_unit text check (distance_unit in ('mi', 'km', 'm')),
  avg_hr smallint check (avg_hr between 30 and 230),
  notes text,
  created_at timestamptz not null default now()
);
create index cardio_sessions_user_idx on public.cardio_sessions (user_id, performed_on desc);
alter table public.cardio_sessions enable row level security;
create policy "own rows" on public.cardio_sessions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
