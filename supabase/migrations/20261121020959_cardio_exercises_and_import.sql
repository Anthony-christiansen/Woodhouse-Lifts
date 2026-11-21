-- Cardio as an exercise type (minutes + RPE per bout), mesocycle start date.
alter table public.exercises drop constraint exercises_load_type_check;
alter table public.exercises add constraint exercises_load_type_check check (load_type in ('weighted', 'bodyweight', 'assisted', 'cardio'));
alter table public.sets
  add column duration_min numeric(5,1) check (duration_min > 0 and duration_min <= 600),
  add column rpe smallint check (rpe between 0 and 10);
alter table public.mesocycles add column started_on date;
alter table public.workout_exercises drop constraint workout_exercises_target_sets_check;
alter table public.workout_exercises add constraint workout_exercises_target_sets_check check (target_sets between 0 and 15);
insert into public.exercises (owner_id, name, muscle_group, equipment, kind, load_type, rep_min, rep_max) values
 (null,'Treadmill Run','Cardio','Treadmill','compound','cardio',1,60), (null,'Incline Treadmill Walk','Cardio','Treadmill','compound','cardio',1,60),
 (null,'Stationary Bike','Cardio','Bike','compound','cardio',1,60), (null,'Assault Bike','Cardio','Bike','compound','cardio',1,60),
 (null,'Rower','Cardio','Rower','compound','cardio',1,60), (null,'Stairmaster','Cardio','Machine','compound','cardio',1,60),
 (null,'Elliptical','Cardio','Machine','compound','cardio',1,60), (null,'Sprints','Cardio','Bodyweight','compound','cardio',1,60),
 (null,'Zone 2 Cardio','Cardio','Machine','compound','cardio',1,60), (null,'Jump Rope','Cardio','Bodyweight','compound','cardio',1,60)
on conflict (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) do update set muscle_group = 'Cardio', load_type = 'cardio';
