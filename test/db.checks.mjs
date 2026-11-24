import assert from 'node:assert/strict';
import * as L from '../logic.js';
import { as } from './dbkit.mjs';

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const uuid = () => crypto.randomUUID();

export async function runChecks(db) {
  // users (the signup trigger creates profiles), shared exercises
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');
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
  // v1.12.1: and only the rows that feedback entry may change (next week's same day, same muscle; the deload day).
  const plan4 = key => ({ client_key: key, name: 'RPC meso', weeks: 4, days_per_week: 1, focus: 'whole', priorities: {}, started_on: '2026-11-20',
    days: [1, 2, 3, 4].map(w => ({ week: w, day_index: 1, label: 'Day 1',
      exercises: [{ exercise_id: ex.press.id, target_sets: 3, target_rir: 2 }, { exercise_id: ex.pull.id, target_sets: 2, target_rir: 2 }] })) });
  const [{ create_mesocycle: mR }] = await as(db, A, 'select public.create_mesocycle($1)', [plan4(uuid())]);
  const dayOf = async w => (await as(db, A, `select id from public.workout_days where mesocycle_id = $1 and week = $2`, [mR, w]))[0].id;
  const weOf = async (w, exId) => (await as(db, A, `select we.id, we.target_sets from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id
    where d.mesocycle_id = $1 and d.week = $2 and we.exercise_id = $3`, [mR, w, exId]))[0];
  const newFb = async (w, muscle) => (await as(db, A, `insert into public.muscle_feedback (workout_day_id, muscle_group, pump, workload, joint_pain) values ($1, $2, 1, 1, 0) returning id`, [await dayOf(w), muscle]))[0].id;
  const rpc = (uid, fbId, changes, deload = []) => as(db, uid, `select public.apply_feedback_adjustment($1, 1, $2::jsonb, $3::jsonb) ok`, [fbId, JSON.stringify(changes), JSON.stringify(deload)]);
  const isAdjusted = async fbId => (await as(db, A, `select adjusted from public.muscle_feedback where id = $1`, [fbId]))[0].adjusted;
  const { id: we2 } = await weOf(2, ex.press.id), { id: wePull2, target_sets: ts0 } = await weOf(2, ex.pull.id);
  const fb = await newFb(1, 'Back');
  const r1 = await rpc(A, fb, [{ id: wePull2, target_sets: ts0 + 1, flag: '' }]);
  const r2 = await rpc(A, fb, [{ id: wePull2, target_sets: ts0 + 2 }]);
  const r3 = await rpc(A, fb, [{ id: wePull2, target_sets: ts0 + 3 }]);
  assert.deepEqual([r1[0].ok, r2[0].ok, r3[0].ok], [true, false, false], 'applies once, retries are no-ops');
  assert.equal((await weOf(2, ex.pull.id)).target_sets, ts0 + 1, 'set added exactly once');
  const [{ adjusted, soreness }] = await as(db, A, `select adjusted, soreness from public.muscle_feedback where id = $1`, [fb]);
  assert.equal(adjusted, true); assert.equal(soreness, 1);
  await assert.rejects(rpc(B, fb, [{ id: wePull2, target_sets: ts0 }]), /not found/i, 'other users cannot touch it');
  // Each of these is refused as a whole: nothing changes and the feedback stays un-applied.
  const before = JSON.stringify(await as(db, A, `select id, target_sets, target_rir, flag from public.workout_exercises order by id`));
  const fbBad = await newFb(1, 'Chest');
  const { id: wePress3 } = await weOf(3, ex.press.id), { id: wePress1 } = await weOf(1, ex.press.id);
  const refused = [
    ['another muscle (Back) on the right day', [{ id: wePull2, target_sets: 5 }]],
    ['the right muscle in a later week', [{ id: wePress3, target_sets: 5 }]],
    ['the right muscle in an earlier week', [{ id: wePress1, target_sets: 5 }]],
    ['an unexpected field', [{ id: we2, target_sets: 4, user_id: B }]],
    ['too many sets', [{ id: we2, target_sets: 99 }]],
    ['a fraction', [{ id: we2, target_sets: 3.5 }]],
    ['RIR out of range', [{ id: we2, target_rir: 11 }]],
    ['a non-text flag', [{ id: we2, flag: { x: 1 } }]],
    ['a row that does not exist', [{ id: uuid(), target_sets: 3 }]],
  ];
  for (const [why, ch] of refused) await assert.rejects(rpc(A, fbBad, ch), /adjustment|Unexpected field|out of range|Bad change/i, `refused: ${why}`);
  await assert.rejects(rpc(A, fbBad, [], [{ workout_day_id: await dayOf(4), exercise_id: ex.press.id, target_sets: 1 }]), /Deload only/i, 'deload only after the last hard week');
  assert.equal(JSON.stringify(await as(db, A, `select id, target_sets, target_rir, flag from public.workout_exercises order by id`)), before, 'refused calls changed nothing');
  assert.equal(await isAdjusted(fbBad), false, 'refused calls leave the feedback un-applied');
  // Feedback from week 2 → week 3 is the last hard week, so the deload day (week 4) may follow — same muscle only.
  const fb2 = await newFb(2, 'Chest'), { id: we3 } = await weOf(3, ex.press.id), dl = await dayOf(4);
  await assert.rejects(rpc(A, fb2, [{ id: we3, target_sets: 4 }], [{ workout_day_id: dl, exercise_id: ex.pull.id, target_sets: 1 }]), /adjustment/i, 'deload: other muscle refused');
  await assert.rejects(rpc(A, fb2, [{ id: we3, target_sets: 4 }], [{ workout_day_id: await dayOf(3), exercise_id: ex.press.id, target_sets: 1 }]), /adjustment/i, 'deload: wrong day refused');
  assert.equal(await isAdjusted(fb2), false);
  assert.equal((await rpc(A, fb2, [{ id: we3, target_sets: 4 }], [{ workout_day_id: dl, exercise_id: ex.press.id, target_sets: 2 }]))[0].ok, true, 'a correct adjustment with deload works');
  assert.deepEqual([(await weOf(3, ex.press.id)).target_sets, (await weOf(4, ex.press.id)).target_sets, (await weOf(4, ex.pull.id)).target_sets], [4, 2, 2]);
  // Feedback from the last hard week has nothing to adjust (next week is the deload).
  await assert.rejects(rpc(A, await newFb(3, 'Chest'), [{ id: (await weOf(4, ex.press.id)).id, target_sets: 3 }]), /No open workout/i, 'never adjusts the deload week');
  // A finished (or skipped) next-week workout is never changed.
  await as(db, A, `update public.workout_days set completed_at = now() where id = $1`, [await dayOf(2)]);
  await assert.rejects(rpc(A, await newFb(1, 'Triceps'), [{ id: wePull2, target_sets: 3 }]), /No open workout/i, 'completed day refused');
  // Soreness-only calls (no changes) still work, and bad soreness is refused.
  assert.equal((await rpc(A, await newFb(1, 'Shoulders'), []))[0].ok, true, 'no changes: just records recovery');
  await assert.rejects(as(db, A, `select public.apply_feedback_adjustment($1, 7, '[]'::jsonb)`, [await newFb(1, 'Biceps')]), /soreness/i);
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
  // ---- start_light_week (v1.17.0): early light week, owner only, never touches logged work
  {
    const plan6 = k => ({ client_key: k, name: 'Light meso', weeks: 6, days_per_week: 2, focus: 'whole', priorities: {}, started_on: '2026-11-20',
      days: [1, 2, 3, 4, 5, 6].flatMap(w => [1, 2].map(di => ({ week: w, day_index: di, label: 'Day ' + di,
        exercises: [{ exercise_id: ex.press.id, target_sets: w === 6 ? 2 : 5, target_rir: w === 6 ? 4 : 3 }, { exercise_id: ex.pull.id, target_sets: 3, target_rir: 2 }] }))) });
    const [{ create_mesocycle: mL }] = await as(db, A, 'select public.create_mesocycle($1)', [plan6(uuid())]);
    const day = async (w, di) => (await as(db, A, 'select id from public.workout_days where mesocycle_id = $1 and week = $2 and day_index = $3', [mL, w, di]))[0].id;
    // only week 1 done → week 2 would be the light week: too early
    await as(db, A, 'update public.workout_days set completed_at = now() where mesocycle_id = $1 and week = 1', [mL]);
    await assert.rejects(as(db, A, 'select public.start_light_week($1)', [mL]), /week 3/, 'not before week 3');
    // weeks 1–2 done, week 3 day 1 has a logged set → light week is week 4
    await as(db, A, 'update public.workout_days set completed_at = now() where mesocycle_id = $1 and week = 2', [mL]);
    const we31 = (await as(db, A, 'select id from public.workout_exercises where workout_day_id = $1 and exercise_id = $2', [await day(3, 1), ex.press.id]))[0].id;
    await as(db, A, `insert into public.sets (workout_exercise_id, set_index, weight, reps, rir, completed_at) values ($1, 1, 100, 10, 2, now())`, [we31]);
    await assert.rejects(as(db, B, 'select public.start_light_week($1)', [mL]), /not found/i, 'B cannot touch A\'s meso');
    await db.exec(`set role anon`);
    try { await assert.rejects(db.query('select public.start_light_week($1)', [mL]), /permission/i, 'anon refused'); } finally { await db.exec('reset role'); }
    const [{ start_light_week: t }] = await as(db, A, 'select public.start_light_week($1)', [mL]);
    assert.equal(t, 4, 'first untouched week becomes the light week');
    assert.equal((await as(db, A, 'select weeks from public.mesocycles where id = $1', [mL]))[0].weeks, 4, 'meso now ends at week 4');
    assert.equal((await as(db, A, 'select count(*)::int n from public.workout_days where mesocycle_id = $1 and week > 4', [mL]))[0].n, 0, 'later planned weeks removed');
    const w4 = await as(db, A, `select we.target_sets, we.target_rir, we.exercise_id from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1 and d.week = 4`, [mL]);
    assert.ok(w4.length === 4 && w4.every(x => x.target_rir === 4), 'light week effort');
    assert.ok(w4.filter(x => x.exercise_id === ex.press.id).every(x => x.target_sets === 3) && w4.filter(x => x.exercise_id === ex.pull.id).every(x => x.target_sets === 2), 'half the sets, rounded up');
    const w3 = await as(db, A, `select we.target_sets from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1 and d.week = 3 and we.exercise_id = $2`, [mL, ex.press.id]);
    assert.ok(w3.every(x => x.target_sets === 5), 'earlier weeks untouched');
    assert.equal((await as(db, A, 'select count(*)::int n from public.sets where workout_exercise_id = $1', [we31]))[0].n, 1, 'logged set kept');
    await assert.rejects(as(db, A, 'select public.start_light_week($1)', [mL]), /already next/, 'can\'t do it twice');
    await as(db, A, 'delete from public.mesocycles where id = $1', [mL]);
    console.log('START_LIGHT_WEEK: owner only, first untouched week, half sets, later weeks removed, logged work kept');
  }
  // ---- app_feedback (v1.15.0): add + read own only; no edits/deletes; needs a rating or a note
  await as(db, A, `insert into public.app_feedback (rating, kind, message, app_version) values (5, 'praise', 'nice', '1.15.0')`);
  await as(db, A, `insert into public.app_feedback (kind, message) values ('bug', 'rir arrow')`);
  assert.equal((await as(db, A, `select * from public.app_feedback`)).length, 2, 'A sees own feedback');
  assert.equal((await as(db, B, `select * from public.app_feedback`)).length, 0, 'B sees none of A\'s feedback');
  await assert.rejects(as(db, A, `insert into public.app_feedback (kind) values ('idea')`), /check/i, 'empty feedback refused');
  await assert.rejects(as(db, A, `insert into public.app_feedback (rating) values (9)`), /check/i, 'rating 1-5');
  await assert.rejects(as(db, A, `insert into public.app_feedback (rating, kind) values (3, 'spam')`), /check/i, 'kind list');
  const ida = (await as(db, A, `select id from public.app_feedback limit 1`))[0].id;
  await assert.rejects(as(db, A, `update public.app_feedback set rating = 1 where id = $1`, [ida]), /permission|denied/i, 'no edits');
  await assert.rejects(as(db, A, `delete from public.app_feedback where id = $1`, [ida]), /permission|denied/i, 'no deletes');
  await assert.rejects(as(db, B, `insert into public.app_feedback (user_id, rating) values ($1, 1)`, [A]), /row-level|violates/i, 'B cannot post as A');
  console.log('APP FEEDBACK: own rows, insert-only OK');
  console.log('ALL DB TESTS PASSED');
}
