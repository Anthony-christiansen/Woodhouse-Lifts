// v1.17.1 (audit D3): real-Postgres concurrency checks for the early light week. PGlite (db.test.mjs) is one
// connection, so it can't show what happens when two requests overlap. This starts a throwaway PostgreSQL 14+
// cluster, applies every migration, and races two connections:
//   1. the same request twice at once (double tap / retry)        → exactly one change, the other refused, no partial rows
//   2. a set logged on a later day while the light week is set up → the set is kept (day hidden, not deleted)
//   3. a day finished in another tab while the light week is set up → the light week moves after it
//   4. a refused request (stale revision) inside a transaction      → every row unchanged
// Usage: node test/pg.concurrency.mjs   (needs PostgreSQL server binaries: initdb/pg_ctl; set PG_BIN to their folder)
// In CI REQUIRE_PG=1 makes a missing PostgreSQL a failure instead of a skip.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { SHIM } from './dbkit.mjs';

const binDir = process.env.PG_BIN || ['/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin'].find(d => existsSync(join(d, 'initdb')));
if (!binDir) {
  console.log('PG CONCURRENCY: SKIPPED (no PostgreSQL server binaries found; set PG_BIN)');
  process.exit(process.env.REQUIRE_PG ? 1 : 0);
}
const asRoot = process.getuid?.() === 0;
const run = (cmd, args) => asRoot ? execFileSync('su', ['postgres', '-s', '/bin/sh', '-c', [join(binDir, cmd), ...args].map(a => `'${a}'`).join(' ')], { stdio: 'pipe' })
  : execFileSync(join(binDir, cmd), args, { stdio: 'pipe' });
const dir = mkdtempSync(join(tmpdir(), 'wl-pg-')); chmodSync(dir, 0o777);
const data = join(dir, 'data'), port = String(54000 + Math.floor(Math.random() * 900));
run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8']);
run('pg_ctl', ['-D', data, '-l', join(dir, 'pg.log'), '-o', `-p ${port} -k ${dir} -c listen_addresses=''`, '-w', 'start']);
const cfg = { host: dir, port: Number(port), user: 'postgres', database: 'postgres' };
const A = '11111111-1111-1111-1111-111111111111';
let fail = null;
try {
  const admin = new pg.Client(cfg); await admin.connect();
  await admin.query(SHIM);
  const mig = new URL('../supabase/migrations/', import.meta.url);
  for (const f of readdirSync(mig).filter(f => f.endsWith('.sql')).sort())
    await admin.query(readFileSync(new URL(f, mig), 'utf8').replace(/create extension if not exists pg_cron;?/gi, '-- pg_cron: shimmed'));
  await admin.query(`insert into auth.users (id, email) values ('${A}', 'a@example.com')`);
  const ex = (await admin.query(`insert into public.exercises (owner_id, name, muscle_group, load_type, kind) values (null, 'Race Press', 'Chest', 'weighted', 'compound') returning id`)).rows[0].id;
  const conn = async () => { const c = new pg.Client(cfg); await c.connect();
    await c.query(`set statement_timeout = '20s'; set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false)`); return c; };
  const c1 = await conn(), c2 = await conn();
  const newMeso = async () => {
    const plan = { client_key: crypto.randomUUID(), name: 'Race', weeks: 6, days_per_week: 2, focus: 'whole', priorities: {}, started_on: '2026-11-20',
      days: [1, 2, 3, 4, 5, 6].flatMap(w => [1, 2].map(di => ({ week: w, day_index: di, label: 'D' + di, exercises: [{ exercise_id: ex, target_sets: 4, target_rir: 2 }] }))) };
    const m = (await c1.query('select public.create_mesocycle($1) id', [plan])).rows[0].id;
    await c1.query('update public.workout_days set completed_at = now(), started_at = now() where mesocycle_id = $1 and week <= 3', [m]);
    return m;
  };
  const dayId = async (m, w, di) => (await c1.query('select id from public.workout_days where mesocycle_id = $1 and week = $2 and day_index = $3', [m, w, di])).rows[0].id;
  const weId = async (m, w, di) => (await c1.query('select we.id from public.workout_exercises we where we.workout_day_id = $1', [await dayId(m, w, di)])).rows[0].id;
  const state = async m => (await c1.query(`select (select weeks || '/' || revision from public.mesocycles where id = $1) meso,
    (select count(*) from public.workout_days where mesocycle_id = $1)::int days,
    (select count(*) from public.workout_days where mesocycle_id = $1 and superseded_at is not null)::int hidden,
    (select count(*) from public.sets s join public.workout_exercises we on we.id = s.workout_exercise_id join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1)::int sets,
    (select string_agg(we.target_sets || ':' || we.target_rir, ',' order by d.week, d.day_index) from public.workout_exercises we join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1) targets`, [m])).rows[0];

  // 1. two identical requests at the same moment
  { const m = await newMeso();
    const res = await Promise.allSettled([c1.query('select public.start_light_week($1, 0) r', [m]), c2.query('select public.start_light_week($1, 0) r', [m])]);
    const ok = res.filter(r => r.status === 'fulfilled'), bad = res.filter(r => r.status === 'rejected');
    assert.equal(ok.length, 1, 'exactly one request applies'); assert.match(bad[0].reason.message, /changed since the preview/);
    const s = await state(m);
    assert.equal(s.meso, '4/1'); assert.equal(s.hidden, 4); assert.equal(s.days, 12, 'nothing deleted');
    console.log('race 1 (double request): one applied, one refused, nothing deleted'); }

  // 2. a set logged on a later day while the light week is being set up (open transaction on c1)
  { const m = await newMeso(); const we5 = await weId(m, 5, 1);
    await c1.query('begin'); await c1.query('select public.start_light_week($1, 0)', [m]);
    // the insert may wait for the light-week transaction (a trigger touches the day row); it must then go through
    const ins = c2.query(`insert into public.sets (workout_exercise_id, set_index, weight, reps, rir, completed_at) values ($1, 1, 100, 8, 2, now())`, [we5]);
    await new Promise(r => setTimeout(r, 300));
    await c1.query('commit'); await ins;
    const s = await state(m);
    assert.equal(s.sets, 1, 'the late set is kept'); assert.equal(s.hidden, 4);
    assert.equal((await c1.query(`select d.superseded_at is not null h from public.sets s join public.workout_exercises we on we.id = s.workout_exercise_id join public.workout_days d on d.id = we.workout_day_id where d.mesocycle_id = $1`, [m])).rows[0].h, true, 'on a hidden day the app can offer to restore');
    console.log('race 2 (set on a later day): set kept on the hidden day'); }

  // 3. another tab finishes a week-4 day first (uncommitted when the light week starts)
  { const m = await newMeso(); const d4 = await dayId(m, 4, 1);
    await c2.query('begin'); await c2.query('update public.workout_days set started_at = now(), completed_at = now() where id = $1', [d4]);
    const p = c1.query('select public.start_light_week($1, 0) r', [m]);   // waits on the day lock
    await new Promise(r => setTimeout(r, 300));
    await c2.query('commit');
    const r = (await p).rows[0].r;
    assert.equal(r.week, 5, 'the light week moves after the day finished in the other tab');
    const s = await state(m); assert.equal(s.meso, '5/1');
    assert.equal((await c1.query('select completed_at is not null c from public.workout_days where id = $1', [d4])).rows[0].c, true, 'finished day untouched');
    console.log('race 3 (day finished elsewhere): light week moved to week 5, finished day kept'); }

  // 4. refused inside a transaction → nothing changed
  { const m = await newMeso(); const before = await state(m);
    await c1.query('begin'); await assert.rejects(c1.query('select public.start_light_week($1, 9)', [m]), /changed/); await c1.query('rollback');
    assert.deepEqual(await state(m), before, 'refused request: every row unchanged');
    console.log('race 4 (stale revision): refused, every row unchanged'); }

  await c1.end(); await c2.end(); await admin.end();
  console.log('PG CONCURRENCY TESTS PASSED (real PostgreSQL ' + binDir.match(/\d+/)?.[0] + ', 2 connections)');
} catch (e) { fail = e; }
finally {
  try { run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
if (fail) { console.error(fail); process.exit(1); }
