import assert from 'node:assert/strict';
import * as L from '../logic.js';
import { as } from './dbkit.mjs';

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const uuid = () => crypto.randomUUID();

export async function runChecks(db) {
  // users (the signup trigger creates profiles), shared exercises
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');
                 update public.profiles set bodyweight = 180 where id = '${A}';`);
  const ex = {
    press: { id: uuid(), name: 'Test Press', muscle_group: 'Chest', load_type: 'weighted' },
    pull: { id: uuid(), name: 'Test Pull-Up', muscle_group: 'Back', load_type: 'bodyweight' },
  };
  for (const e of Object.values(ex))
    await db.query(`insert into public.exercises (id, owner_id, name, muscle_group, load_type, kind) values ($1, null, $2, $3, $4, 'compound')`,
      [e.id, e.name, e.muscle_group, e.load_type]);
  const privEx = uuid(); // B's private exercise — A must not be able to use it
  await db.query(`insert into public.exercises (id, owner_id, name, muscle_group, load_type, kind) values ($1, $2, 'B Secret Curl', 'Biceps', 'weighted', 'isolation')`, [privEx, B]);

  const plan = (key, exId = ex.press.id) => ({
    client_key: key, name: 'Test meso', weeks: 2, days_per_week: 1, focus: 'whole', priorities: {}, started_on: '2026-11-20',
    days: [1, 2].map(w => ({ week: w, day_index: 1, label: 'Day 1',
      exercises: [{ exercise_id: exId, target_sets: 3, target_rir: 3 - w }, { exercise_id: ex.pull.id, target_sets: 2, target_rir: 3 - w }] })),
  });
  const count = async (uid, t) => (await as(db, uid, `select count(*)::int n from public.${t}`))[0].n;

  // ---- atomic + idempotent create
  const key = uuid();
  const [{ create_mesocycle: m1 }] = await as(db, A, 'select public.create_mesocycle($1)', [plan(key)]);
  const [{ create_mesocycle: m2 }] = await as(db, A, 'select public.create_mesocycle($1)', [plan(key)]);
  assert.equal(m1, m2, 'retry with same key returns the same meso');
  assert.equal(await count(A, 'mesocycles'), 1, 'no duplicate meso');
  assert.equal(await count(A, 'workout_days'), 2);
  assert.equal(await count(A, 'workout_exercises'), 4);
  // failure part-way (another user's private exercise) leaves nothing behind
  await assert.rejects(as(db, A, 'select public.create_mesocycle($1)', [plan(uuid(), privEx)]), /Unknown exercise/);
  assert.equal(await count(A, 'mesocycles'), 1, 'failed create left no partial meso');
  assert.equal(await count(A, 'workout_days'), 2);
  await assert.rejects(as(db, A, 'select public.create_mesocycle($1)', [{ ...plan(uuid()), weeks: 99 }]), /check/i);
  assert.equal(await count(A, 'mesocycles'), 1, 'constraint failure rolled back');
  assert.equal((await as(db, A, 'select goal from public.mesocycles'))[0].goal, 'hypertrophy', 'goal defaults to hypertrophy');
  const [{ create_mesocycle: mS }] = await as(db, A, 'select public.create_mesocycle($1)', [{ ...plan(uuid()), goal: 'strength' }]);
  assert.equal((await as(db, A, 'select goal from public.mesocycles where id = $1', [mS]))[0].goal, 'strength');
  await assert.rejects(as(db, A, 'select public.create_mesocycle($1)', [{ ...plan(uuid()), goal: 'powerlifting' }]), /check/i);
  // carry-from-week: stored for your own meso, ignored for someone else's
  const [{ create_mesocycle: mC }] = await as(db, A, 'select public.create_mesocycle($1)', [{ ...plan(uuid()), carry_meso_id: m1, carry_week: 2 }]);
  assert.deepEqual(Object.values((await as(db, A, 'select carry_meso_id, carry_week from public.mesocycles where id = $1', [mC]))[0]), [m1, 2]);
  const [{ create_mesocycle: mX }] = await as(db, B, 'select public.create_mesocycle($1)', [{ ...plan(uuid()), carry_meso_id: m1, carry_week: 2 }]);
  assert.deepEqual(Object.values((await as(db, B, 'select carry_meso_id, carry_week from public.mesocycles where id = $1', [mX]))[0]), [null, null], 'cannot point at another user\'s meso');
  await as(db, A, 'delete from public.mesocycles where id = any($1)', [[mS, mC]]); await as(db, B, 'delete from public.mesocycles where id = $1', [mX]);
  console.log('CREATE_MESOCYCLE: atomic + idempotent + goal OK');

  // ---- log sets for A: week 1 day (press 100×10, 100×10, warm-up 45×10; pull-up +0×8)
  const [d1] = await as(db, A, `select d.id from public.workout_days d where d.week = 1`);
  const wes = await as(db, A, `select id, exercise_id from public.workout_exercises where workout_day_id = $1`, [d1.id]);
  const wePress = wes.find(w => w.exercise_id === ex.press.id).id, wePull = wes.find(w => w.exercise_id === ex.pull.id).id;
  const at = new Date(Date.now() - 2 * 864e5).toISOString();
  const ins = (we, i, w, r, type = 'straight') => as(db, A,
    `insert into public.sets (workout_exercise_id, set_index, weight, reps, rir, set_type, completed_at) values ($1,$2,$3,$4,null,$5,$6)`, [we, i, w, r, type, at]);
  await ins(wePress, 1, 100, 10); await ins(wePress, 2, 100, 10); await ins(wePress, 3, 45, 10, 'warmup'); await ins(wePull, 1, 0, 8);
  await as(db, A, `update public.workout_days set completed_at = $2 where id = $1`, [d1.id, at]);
  // duplicate set submission is rejected by the unique key, not double-counted
  await assert.rejects(ins(wePress, 1, 100, 10), /duplicate|unique/i);

  const [{ dashboard_stats: st }] = await as(db, A, `select public.dashboard_stats('America/Denver')`);
  assert.equal(st.sets, 3, 'warm-up set excluded from hard sets');
  assert.equal(st.workouts, 1, 'workouts = finished workouts');
  assert.equal(st.training_days, 1);
  assert.equal(Object.values(st.weeks).reduce((a, b) => a + b, 0), 3);

  // ---- e1RM parity with the app's engine (logic.js)
  const ls = await as(db, A, `select exercise_id, best_e1rm from public.lift_sessions()`);
  const press = ls.find(x => x.exercise_id === ex.press.id), pull = ls.find(x => x.exercise_id === ex.pull.id);
  const exp = (sets, e, bw) => Math.round(L.bestE1rm(sets, e, bw) * 100) / 100;
  assert.equal(Number(press.best_e1rm), exp([{ weight: 100, reps: 10, rir: 2 }], ex.press, 180), 'weighted e1RM matches logic.js');
  assert.equal(Number(pull.best_e1rm), exp([{ weight: 0, reps: 8, rir: 2 }], ex.pull, 180), 'bodyweight e1RM matches logic.js');
  console.log('DASHBOARD_STATS: warm-ups excluded, workouts counted, e1RM matches app engine OK');

  // ---- isolation: B sees none of A's data, and can't write into A's meso
  assert.equal(await count(B, 'mesocycles'), 0); assert.equal(await count(B, 'sets'), 0);
  const [{ dashboard_stats: sb }] = await as(db, B, `select public.dashboard_stats('UTC')`);
  assert.equal(sb.sets, 0); assert.equal(sb.workouts, 0);
  await assert.rejects(as(db, B, `insert into public.workout_days (mesocycle_id, week, day_index) values ($1, 3, 1)`, [m1]), /violates|policy|foreign/i);
  console.log('ISOLATION: users cannot see or write each other\'s data OK');
  // ---- preferences: own rows only; axial tag applied to the right shared exercises
  await as(db, A, `insert into public.exercise_prefs (exercise_id, pref) values ($1, 'exclude')`, [ex.press.id]);
  assert.equal(await count(A, 'exercise_prefs'), 1); assert.equal(await count(B, 'exercise_prefs'), 0);
  await assert.rejects(as(db, B, `insert into public.exercise_prefs (user_id, exercise_id, pref) values ($1, $2, 'favorite')`, [A, ex.pull.id]), /policy|violates/i);
  await assert.rejects(as(db, A, `insert into public.exercise_prefs (exercise_id, pref, substitute_id) values ($1, 'favorite', $2)`, [ex.pull.id, ex.press.id]), /check/i);
  for (const [name, axial] of [['Back Squat', true], ['Romanian Deadlift', true], ['Overhead Press', true], ['Barbell Squat (High Bar)', true],
    ['Leg Press', false], ['Belt Squat', false], ['Goblet Squat', false], ['Hip Thrust', false], ['Seated Dumbbell Press', false], ['Bulgarian Split Squat', false]]) {
    await db.query(`insert into public.exercises (owner_id, name, muscle_group, load_type, kind) values (null, $1, 'Quads', 'weighted', 'compound') on conflict do nothing`, [name]);
  }
  // re-run the tagging statement from the migration (new rows were inserted after it ran)
  const mig = (await import('node:fs')).readFileSync(new URL('../supabase/migrations/20261121034755_exercise_preferences.sql', import.meta.url), 'utf8');
  await db.exec(mig.slice(mig.indexOf('update public.exercises set tags'), mig.indexOf(');', mig.indexOf('update public.exercises set tags')) + 2));
  const tagged = Object.fromEntries((await db.query(`select name, 'axial' = any(tags) a from public.exercises where owner_id is null`)).rows.map(r => [r.name, r.a]));
  for (const [n, v] of [['Back Squat', true], ['Romanian Deadlift', true], ['Overhead Press', true], ['Barbell Squat (High Bar)', true],
    ['Leg Press', false], ['Belt Squat', false], ['Goblet Squat', false], ['Hip Thrust', false], ['Seated Dumbbell Press', false], ['Bulgarian Split Squat', false]])
    assert.equal(tagged[n], v, `axial tag on ${n}`);
  console.log('PREFERENCES: RLS + axial tagging OK');
  // ---- lift_recent: window + prior best, own data only
  const lr = await as(db, A, `select * from public.lift_recent($1, 1)`, [[ex.press.id, ex.pull.id]]);
  assert.equal(lr.length, 2, 'one session per lift with p_n = 1');
  assert.ok(lr.every(r => r.prior_best === null), 'no older sessions yet');
  assert.equal((await as(db, B, `select * from public.lift_recent($1, 12)`, [[ex.press.id]])).length, 0, 'B sees none of A\'s sessions');
  console.log('LIFT_RECENT OK');
  // ---- apply_feedback_adjustment: one transaction, at most once per feedback entry (retries can't double it)
  const [{ id: dF }] = await as(db, A, `select id from public.workout_days where mesocycle_id = $1 and week = 1 limit 1`, [m1]);
  const [{ id: we2, target_sets: ts0 }] = await as(db, A, `select we.id, we.target_sets from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1 and d.week = 2 limit 1`, [m1]);
  const [{ id: fb }] = await as(db, A, `insert into public.muscle_feedback (workout_day_id, muscle_group, pump, workload, joint_pain) values ($1, 'Chest', 1, 1, 0) returning id`, [dF]);
  const ch = JSON.stringify([{ id: we2, target_sets: ts0 + 1, flag: '' }]);
  const r1 = await as(db, A, `select public.apply_feedback_adjustment($1, 1, $2::jsonb) ok`, [fb, ch]);
  const r2 = await as(db, A, `select public.apply_feedback_adjustment($1, 1, $2::jsonb) ok`, [fb, JSON.stringify([{ id: we2, target_sets: ts0 + 2 }])]);
  const r3 = await as(db, A, `select public.apply_feedback_adjustment($1, 1, $2::jsonb) ok`, [fb, JSON.stringify([{ id: we2, target_sets: ts0 + 3 }])]);
  assert.deepEqual([r1[0].ok, r2[0].ok, r3[0].ok], [true, false, false], 'applies once, retries are no-ops');
  assert.equal((await as(db, A, `select target_sets from public.workout_exercises where id = $1`, [we2]))[0].target_sets, ts0 + 1, 'set added exactly once');
  const [{ adjusted, soreness }] = await as(db, A, `select adjusted, soreness from public.muscle_feedback where id = $1`, [fb]);
  assert.equal(adjusted, true); assert.equal(soreness, 1);
  await assert.rejects(as(db, B, `select public.apply_feedback_adjustment($1, 1, $2::jsonb)`, [fb, ch]), /not found/i, 'other users cannot touch it');
  // a failure part-way rolls back everything (bad target_sets violates the check constraint)
  const [{ id: fb2 }] = await as(db, A, `insert into public.muscle_feedback (workout_day_id, muscle_group) values ($1, 'Back') returning id`, [dF]);
  await assert.rejects(as(db, A, `select public.apply_feedback_adjustment($1, 1, $2::jsonb)`, [fb2, JSON.stringify([{ id: we2, target_sets: 99 }])]), /check/i);
  assert.equal((await as(db, A, `select adjusted from public.muscle_feedback where id = $1`, [fb2]))[0].adjusted, false, 'rolled back: not marked adjusted');
  console.log('FEEDBACK ADJUSTMENT: atomic + once only OK');
  // ---- exercise_feedback (v1.10): one rating per exercise per session, own rows only, cleaned up with the exercise
  await as(db, A, `insert into public.exercise_feedback (workout_exercise_id, workload, joint_pain) values ($1, 1, 0)`, [we2]);
  await as(db, A, `insert into public.exercise_feedback (workout_exercise_id, workload, joint_pain) values ($1, 2, 1)
    on conflict (workout_exercise_id) do update set workload = excluded.workload, joint_pain = excluded.joint_pain`, [we2]);
  const efA = await as(db, A, `select workload, joint_pain from public.exercise_feedback where workout_exercise_id = $1`, [we2]);
  assert.deepEqual([efA.length, efA[0].workload, efA[0].joint_pain], [1, 2, 1], 'upsert keeps one row per exercise');
  assert.equal((await as(db, B, `select * from public.exercise_feedback`)).length, 0, 'B sees none of A\'s exercise ratings');
  await assert.rejects(as(db, B, `insert into public.exercise_feedback (workout_exercise_id, workload, joint_pain) values ($1, 0, 0)`, [we2]), /violates|foreign key|row-level/i, 'B cannot rate A\'s exercise');
  await assert.rejects(as(db, A, `insert into public.exercise_feedback (workout_exercise_id, workload) values ($1, 7)`, [we2]), /check|duplicate|unique/i);
  console.log('EXERCISE FEEDBACK: RLS + one per exercise OK');
  console.log('ALL DB TESTS PASSED');
}
