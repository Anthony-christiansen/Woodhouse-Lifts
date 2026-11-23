// Rollback drill (docs/PLAYBOOK.md §5): snapshot → damage one user's data → restore with supabase/ops/
// restore_user_from_snapshot.sql → every row matches the snapshot again, and the other user is untouched.
// Runs on a throwaway PGlite database, never production. Run: node test/restore.drill.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshDb } from './dbkit.mjs';
import { runChecks } from './db.checks.mjs';
const db = await freshDb(); await runChecks(db);
const T = ['profiles','exercises','templates','mesocycles','workout_days','workout_exercises','sets','muscle_feedback','exercise_feedback','exercise_prefs','cardio_sessions'];
const own = t => t === 'profiles' ? 'id' : t === 'exercises' ? 'owner_id' : 'user_id';
const dump = async uid => { const o = {}; for (const t of T) o[t] = (await db.query(`select to_jsonb(x) j from public.${t} x where ${own(t)} = $1 order by 1::text`, [uid])).rows.map(r => JSON.stringify(r.j)).sort(); return o; };
const users = (await db.query('select id from public.profiles order by id')).rows.map(r => r.id);
const [A, B] = users;
const before = await dump(A), beforeB = await dump(B);
assert.ok(before.sets.length > 0 && before.muscle_feedback.length > 0, 'drill needs data');
await db.query('select backup.take_snapshot()');
const ts = (await db.query('select max(taken_at)::text t from backup.snapshot')).rows[0].t;
// Damage 1: a bad release edits values. Damage 2: a bad data op deletes the whole meso (cascades to days/sets/feedback).
await db.query(`update public.sets set reps = reps + 1, weight = weight + 5 where user_id = $1`, [A]);
await db.query(`delete from public.mesocycles where user_id = $1`, [A]);
await db.query(`update public.profiles set unit = 'kg' where id = $1`, [A]);
const mid = await dump(A);
assert.equal(mid.sets.length, 0, 'damage applied');
const tpl = readFileSync(new URL('../supabase/ops/restore_user_from_snapshot.sql', import.meta.url), 'utf8');
const fill = mode => tpl.replaceAll('__USER__', A).replaceAll('__TAKEN_AT__', ts).replaceAll('__MODE__', mode);
await db.exec(fill('overwrite'));
const after = await dump(A), afterB = await dump(B);
for (const t of T) assert.deepEqual(after[t], before[t], `user A ${t} restored exactly`);
for (const t of T) assert.deepEqual(afterB[t], beforeB[t], `user B ${t} untouched`);
// 'missing' mode puts deleted rows back but leaves edits alone
await db.query(`delete from public.sets where user_id = $1`, [A]);
await db.query(`update public.profiles set unit = 'kg' where id = $1`, [A]);
await db.exec(fill('missing'));
const m = await dump(A);
assert.deepEqual(m.sets, before.sets, 'missing mode: deleted sets back');
assert.equal(JSON.parse(m.profiles[0]).unit, 'kg', 'missing mode: existing edits left alone');
console.log(`RESTORE DRILL PASSED (${T.length} tables, overwrite + missing modes, other user untouched)`);
