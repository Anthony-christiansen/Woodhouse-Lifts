// Off-project backup → database (Playbook §6.4). Reads a Woodhouse Lifts backup file (the weekly
// "woodhouse-lifts-backup-<time>.json.gz" kept in the owner's private Drive folder) and either:
//   --snapshot  prints SQL that puts it back into backup.snapshot (then use restore_user_from_snapshot.sql for one
//               user, exactly as for an in-database snapshot), or
//   --full      prints SQL that loads every table into an EMPTY project after all migrations (disaster recovery:
//               the Supabase project itself is gone). Users must sign up again with the same emails first, or
//               auth.users rows must exist with the same ids; the SQL checks this before loading.
// Usage: node supabase/ops/load_backup_file.mjs <file.json.gz> --snapshot|--full > restore.sql
// Never commit a backup file to this public repo.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

export const ORDER = ['profiles', 'exercises', 'templates', 'mesocycles', 'workout_days', 'workout_exercises', 'sets',
  'muscle_feedback', 'exercise_feedback', 'exercise_prefs', 'cardio_sessions'];
const q = s => `'${String(s).replaceAll("'", "''")}'`;

export function readBackup(path) {
  const b = JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
  if (b.format !== 'woodhouse-lifts-backup/1') throw new Error('Not a Woodhouse Lifts backup file');
  for (const [t, v] of Object.entries(b.tables)) if (!Array.isArray(v.rows) || v.rows.length !== v.row_count) throw new Error(`${t}: row count mismatch`);
  return b;
}
export function snapshotSql(b) {
  return ['begin;', `delete from backup.snapshot where taken_at = ${q(b.taken_at)}::timestamptz;`,
    ...Object.entries(b.tables).map(([t, v]) => `insert into backup.snapshot (taken_at, tbl, row_count, data) values (${q(b.taken_at)}::timestamptz, ${q(t)}, ${v.row_count}, ${q(JSON.stringify(v.rows))}::jsonb);`),
    'commit;'].join('\n');
}
export function fullSql(b) {
  const out = ['begin;',
    `do $$ begin if exists (select 1 from public.mesocycles) or exists (select 1 from public.sets) then raise exception 'Target is not empty: --full only loads into an empty project'; end if; end $$;`,
    // the sign-up trigger made a profile for each auth user; the backup's profiles replace them
    `delete from public.profiles;`,
    // migrations seed the shared exercise library with fresh ids; the backup's copy (same names, the ids your workouts use) replaces it
    `delete from public.exercises;`];
  for (const t of ORDER) {
    const v = b.tables[t]; if (!v || !v.rows.length) continue;
    out.push(`insert into public.${t} select * from jsonb_populate_recordset(null::public.${t}, ${q(JSON.stringify(v.rows))}::jsonb);`);
  }
  out.push(...ORDER.filter(t => b.tables[t]).map(t => `do $$ begin if (select count(*) from public.${t}) <> ${b.tables[t].row_count} then raise exception '${t}: wrong row count after load'; end if; end $$;`));
  out.push('commit;');
  return out.join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, mode] = process.argv.slice(2);
  const b = readBackup(file);
  process.stdout.write(mode === '--full' ? fullSql(b) : snapshotSql(b));
}
