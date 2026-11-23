// Privacy guard for this PUBLIC repo (docs/PLAYBOOK.md §1.8): fails if a real email address or a real user/set id
// appears in any tracked text file. Example addresses (@example.com) and the all-zero placeholder uuid are allowed.
// Names and personal details can't be pattern-matched reliably — the rule for those is in the playbook.
// Run: node test/privacy.check.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n')
  .filter(f => f && !f.startsWith('test/node_modules') && /\.(md|js|mjs|py|sql|html|json|css|txt)$/.test(f));
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;   // random (v4-style) ids only
const ok = e => /@example\.(com|org)$/i.test(e) || /^noreply@anthropic\.com$/i.test(e) || /@electric-sql|@supabase|@\d/.test(e);
const bad = [];
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.match(EMAIL) || []) if (!ok(m)) bad.push(`${f}: email ${m}`);
  for (const m of s.match(UUID) || []) bad.push(`${f}: id ${m}`);
}
if (bad.length) { console.error(bad.join('\n')); console.error('PRIVACY CHECK FAILED'); process.exit(1); }
console.log(`PRIVACY CHECK PASSED (${files.length} files)`);
