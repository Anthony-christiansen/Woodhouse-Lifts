// Proves the rollback script for 20261125000000_light_week_revision_required works both ways on a fresh database:
// after rollback a null revision is accepted again (old behaviour); re-applying the migration refuses it again.
import { readFileSync } from 'node:fs';
import { freshDb } from './dbkit.mjs';
const db = await freshDb();
const sig = async () => (await db.query(`select pg_get_function_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_light_week'`)).rows.map(r => r.a);
const grants = async () => (await db.query(`select has_function_privilege('authenticated', 'public.start_light_week(uuid, integer)', 'execute') a,
  has_function_privilege('anon', 'public.start_light_week(uuid, integer)', 'execute') b`)).rows[0];
const must = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
let s = await sig(); must(s.length === 1 && s[0] === 'p_meso uuid, p_revision integer', 'migrated: revision required ' + s);
await db.exec(readFileSync(new URL('../supabase/ops/rollback_20261125000000_light_week_revision_required.sql', import.meta.url), 'utf8'));
s = await sig(); must(s.length === 1 && /p_revision integer DEFAULT NULL/i.test(s[0]), 'rolled back: optional again ' + s);
let g = await grants(); must(g.a && !g.b, 'rolled back: grants as before');
await db.exec(readFileSync(new URL('../supabase/migrations/20261125000000_light_week_revision_required.sql', import.meta.url), 'utf8'));
s = await sig(); must(s.length === 1 && s[0] === 'p_meso uuid, p_revision integer', 're-applied: required again ' + s);
g = await grants(); must(g.a && !g.b, 're-applied: grants as before');
console.log('LIGHT-WEEK REVISION ROLLBACK CHECK PASSED (migrate → rollback → re-apply, grants kept)');
