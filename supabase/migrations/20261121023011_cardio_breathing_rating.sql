-- Cardio rating: talk test instead of pump.
alter table public.muscle_feedback add column breathing smallint check (breathing between 0 and 3);
