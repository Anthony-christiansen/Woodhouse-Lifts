// Rollback round trip for 20261125010000_set_delete_guard on a fresh database: migrated → rollback → re-applied.
import { readFileSync } from 'node:fs';
import { freshDb } from './dbkit.mjs';
const db = await freshDb();
const state = async () => (await db.query(`select
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='sets' and column_name='based_on') col,
  (select count(*)::int from information_schema.tables where table_schema='public' and table_name='set_tombstones') tbl,
  (select count(*)::int from pg_trigger where tgname in ('sets_remember_delete','sets_skip_deleted')) trg,
  (select relrowsecurity from pg_class where oid = to_regclass('public.set_tombstones')) rls`)).rows[0];
const must = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
let s = await state(); must(s.col === 1 && s.tbl === 1 && s.trg === 2 && s.rls === true, 'migrated ' + JSON.stringify(s));
await db.exec(readFileSync(new URL('../supabase/ops/rollback_20261125010000_set_delete_guard.sql', import.meta.url), 'utf8'));
s = await state(); must(s.col === 0 && s.tbl === 0 && s.trg === 0, 'rolled back ' + JSON.stringify(s));
await db.exec(readFileSync(new URL('../supabase/migrations/20261125010000_set_delete_guard.sql', import.meta.url), 'utf8'));
s = await state(); must(s.col === 1 && s.tbl === 1 && s.trg === 2 && s.rls === true, 're-applied ' + JSON.stringify(s));
console.log('SET DELETE GUARD ROLLBACK CHECK PASSED (migrate → rollback → re-apply, RLS on)');
