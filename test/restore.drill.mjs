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
// Off-project copy (Playbook §6.5): export the snapshot in the Drive backup format, load it with --full into a fresh database.
const { gzipSync } = await import('node:zlib'); const { writeFileSync, rmSync } = await import('node:fs');
const { readBackup, fullSql, snapshotSql } = await import('../supabase/ops/load_backup_file.mjs');
const snap = (await db.query(`select tbl, row_count, data from backup.snapshot where taken_at = $1`, [ts])).rows;
const file = `/tmp/wl-drill-backup-${process.pid}.json.gz`;
writeFileSync(file, gzipSync(JSON.stringify({ format: 'woodhouse-lifts-backup/1', taken_at: ts, tables: Object.fromEntries(snap.map(r => [r.tbl, { row_count: r.row_count, rows: r.data }])) })));
const bk = readBackup(file); rmSync(file);
const db2 = await freshDb();
for (const r of (await db.query('select id, email from auth.users')).rows) await db2.query('insert into auth.users (id, email) values ($1, $2)', [r.id, r.email]);
await db2.exec(fullSql(bk));
for (const t of T) { const a = (await db2.query(`select to_jsonb(x) j from public.${t} x`)).rows.map(r => JSON.stringify(r.j)).sort();
  const want = (bk.tables[t]?.rows || []).map(r => JSON.stringify(r)).sort(); assert.deepEqual(a.length, want.length, `full load ${t} row count`); }
await assert.rejects(db2.exec(fullSql(bk)), /not empty/, '--full refuses a database that already has data');
await db2.exec('rollback');
await db2.exec(snapshotSql(bk)); assert.equal((await db2.query('select count(*)::int n from backup.snapshot where taken_at = $1', [ts])).rows[0].n, Object.keys(bk.tables).length);
console.log(`RESTORE DRILL PASSED (${T.length} tables, overwrite + missing modes, other user untouched; Drive backup file → fresh database)`);
