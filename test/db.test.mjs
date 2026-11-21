// Fresh-database test. Run: node test/db.test.mjs
// Builds a brand-new Postgres (PGlite) from every migration in filename order, then runs the checks.
import { freshDb } from './dbkit.mjs';
import { runChecks } from './db.checks.mjs';
const db = await freshDb();
console.log('MIGRATIONS OK (fresh database, filename order)');
await runChecks(db);
