-- Per-user exercise preferences: favorites, exclusions (with an optional preferred substitute),
-- available equipment, and opt-in tag filters such as "avoid heavy spinal (axial) loading".
-- These are personal choices only: nothing is banned globally, and every exercise stays in the library.

alter table public.exercises add column if not exists tags text[] not null default '{}';

-- 'axial' = substantial load through the spine: bar on the back/shoulders, shoulder-pad machines,
-- heavy barbell hinges and rows, standing barbell overhead press, heavy barbell shrugs/lunges.
-- Applies to shared and user-made exercises with these names; anyone can still favorite one to keep it.
update public.exercises set tags = array_append(tags, 'axial')
where not ('axial' = any(tags)) and (
  name ~* '^(back squat|front squat|smith machine squat|hack squat|pendulum squat|good morning|deadlift|sumo deadlift|romanian deadlift|stiff-leg deadlift|barbell row|pendlay row|t-bar row|overhead press|barbell shrug)$'
  or name ~* '(barbell squat|smith machine squat|hack squat|stiff-legged deadlift|deadlift \(sumo|^deadlift|barbell bent over row|walking lunges \([^)]*barbell)'
);

alter table public.profiles add column if not exists equipment text[];            -- null = everything available
alter table public.profiles add column if not exists avoid_tags text[] not null default '{}';

create table if not exists public.exercise_prefs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  pref text not null check (pref in ('favorite', 'exclude')),
  substitute_id uuid references public.exercises (id) on delete set null,   -- for 'exclude': use this instead
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id),
  check (substitute_id is null or (pref = 'exclude' and substitute_id <> exercise_id))
);
create index if not exists exercise_prefs_sub_idx on public.exercise_prefs (substitute_id);
alter table public.exercise_prefs enable row level security;
create policy "own rows" on public.exercise_prefs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.exercise_prefs from anon;
grant select, insert, update, delete on public.exercise_prefs to authenticated;
