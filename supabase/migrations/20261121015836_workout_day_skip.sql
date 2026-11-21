-- Lets a workout day be skipped so the next one can start.
alter table public.workout_days add column skipped_at timestamptz;
