-- Woodhouse Lifts: initial schema
-- Every row belongs to one user. Child rows carry user_id and a composite
-- foreign key (parent_id, user_id) so a row can never point at another
-- user's data. Row-level security limits every table to the signed-in user.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit text not null default 'lb' check (unit in ('lb', 'kg')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- exercises ----------
-- owner_id null = shared library (seeded); otherwise a user's custom exercise.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  muscle_group text not null,
  equipment text,
  notes text,
  created_at timestamptz not null default now()
);
create index exercises_owner_idx on public.exercises (owner_id);
create unique index exercises_name_per_owner on public.exercises (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ---------- mesocycles ----------
create table public.mesocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  weeks smallint not null check (weeks between 1 and 12),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  start_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'abandoned')),
  source text not null default 'app' check (source in ('app', 'rp_import')),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index mesocycles_user_idx on public.mesocycles (user_id);

-- ---------- workout_days ----------
create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  mesocycle_id uuid not null,
  week smallint not null check (week >= 1),
  day_index smallint not null check (day_index >= 1),
  label text,
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  bodyweight numeric(5,1),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (mesocycle_id, week, day_index),
  foreign key (mesocycle_id, user_id) references public.mesocycles (id, user_id) on delete cascade
);
create index workout_days_user_idx on public.workout_days (user_id);
create index workout_days_meso_idx on public.workout_days (mesocycle_id, user_id);

-- ---------- workout_exercises ----------
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_day_id uuid not null,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null default 1,
  target_sets smallint check (target_sets between 0 and 15),
  target_rir smallint check (target_rir between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_day_id, user_id) references public.workout_days (id, user_id) on delete cascade
);
create index workout_exercises_user_idx on public.workout_exercises (user_id);
create index workout_exercises_day_idx on public.workout_exercises (workout_day_id, user_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

-- ---------- sets ----------
create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_exercise_id uuid not null,
  set_index smallint not null check (set_index >= 1),
  weight numeric(6,2) check (weight >= 0),
  reps smallint check (reps between 0 and 100),
  rir smallint check (rir between 0 and 10),
  set_type text not null default 'straight' check (set_type in ('straight', 'myorep', 'drop', 'warmup')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_index),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);
create index sets_user_idx on public.sets (user_id);
create index sets_we_idx on public.sets (workout_exercise_id, user_id);

-- ---------- muscle_feedback ----------
-- 0-3 scales, asked after training a muscle in a session.
create table public.muscle_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_day_id uuid not null,
  muscle_group text not null,
  pump smallint check (pump between 0 and 3),
  soreness smallint check (soreness between 0 and 3),
  workload smallint check (workload between 0 and 3),
  joint_pain smallint check (joint_pain between 0 and 3),
  created_at timestamptz not null default now(),
  unique (workout_day_id, muscle_group),
  foreign key (workout_day_id, user_id) references public.workout_days (id, user_id) on delete cascade
);
create index muscle_feedback_user_idx on public.muscle_feedback (user_id);
create index muscle_feedback_day_idx on public.muscle_feedback (workout_day_id, user_id);

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.mesocycles enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.muscle_feedback enable row level security;

create policy "own profile: read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "exercises: read shared or own" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own rows" on public.mesocycles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_days
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_exercises
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.sets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.muscle_feedback
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
