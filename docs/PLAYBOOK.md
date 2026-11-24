# Woodhouse Lifts — Release & Rollback Playbook

How every change gets to the live app, how we check it, and how we undo it. Follow it for every release, every database change and every one-off data fix. If something here and a chat instruction disagree, stop and ask the owner.

- Live app: https://anthony-christiansen.github.io/Woodhouse-Lifts/ (GitHub Pages, deploys from `main`)
- Code: `Anthony-christiansen/Woodhouse-Lifts` · Database: Supabase project `dnknmtzcmmdepwheagmq`
- Companion docs: *Start Here (handoff)* · *Training Logic* · *Changelog* (Drive folder **Woodhouse Lifts**, repo `docs/` + `CHANGELOG.md`)

---

## 1. Principles

1. **Every change can be undone in under 15 minutes.** If a change can't, it doesn't ship until it can.
2. **Small releases.** One idea per release. A release that touches both the engine and the database is two releases.
3. **Prove it before production.** All test suites pass locally; database changes are proven on a throwaway database (PGlite) built from every migration.
4. **Check it after production.** A release isn't done until the live app shows the new version and the smoke test passes.
5. **Roll back first, debug second.** If logging sets or saving data is broken, revert, *then* find the cause.
6. **The database only grows.** Migrations add tables, columns and functions. Nothing is dropped or renamed in the same release as the code that stops using it (expand → release → contract later). This is what makes an app rollback safe: the old app still works against the newer database.
7. **No surprise data changes.** Real users' data is never changed without a snapshot first and a written way back.
8. **Nothing personal in the public repo.** The repo is public (it hosts the live app). No names, emails, account names, health notes, locations, user/set ids or anyone's training logs, in code, docs, tests, screenshots, commit messages or PR text. Use "the owner", "a second user", `@example.com` and made-up data. Personal context goes only in the private Drive copies. `node test/privacy.check.mjs` guards emails and ids; names and details are on you.

## 2. Who approves what

| Change | Needs | Notes |
|---|---|---|
| App code (frontend) release | The owner says to merge the PR | Deploys automatically when merged. |
| Database migration | The owner's explicit **"approved"** for that migration | Plus a pre-migration snapshot and a written `down` script. |
| One-off data fix on production (delete typos, re-import) | The owner's explicit OK for that fix | Snapshot first; keep the inverse SQL. |
| Rollback of a bad app release | Pre-approved: do it, then tell the owner | Reverting is always allowed. |
| Restoring data from a snapshot | The owner's OK, except to undo a data fix we just made | Preview first. |
| Secrets / service-role keys | Never | Never shown, typed or committed. |

## 3. Risk tiers

| Tier | What | Examples | Extra steps |
|---|---|---|---|
| **A** | App code only, no data written differently | wording, layout, engine suggestions | Standard checklist. |
| **B** | App code that writes data differently, or an additive migration | new column, optional rating, new table | Pre-release snapshot; check that the *previous* app still works with the new data (§6.4). |
| **C** | Anything that changes existing rows | data fixes, imports, backfills | Snapshot; preview query; `returning` output saved; inverse SQL written *before* running. |

## 4. Release checklist (every release)

**Before merging**
1. Branch off `main` (`feature/…`, `progression/…`, `design/…`). One PR per release.
2. Tests added for the change. For engine changes: a regression test per bug and the longitudinal simulation still passing.
3. Run **every** suite and paste the results in the PR:
   - `node test/logic.test.mjs` (engine + 6-week simulation)
   - `node test/db.test.mjs` (fresh database from all migrations; needs `npm i @electric-sql/pglite` in `test/`)
   - `node test/restore.drill.mjs` (rollback drill, §6.3)
   - `node test/privacy.check.mjs` (no real emails or ids in the public repo, §1.8)
   - `for f in test/e2e/*.py; do python3 "$f" | tail -1; done` (real Chromium against a mocked Supabase)
4. Version bumped: `APP_VERSION` in `app.js`, `?v=` on **every** import in every file: `sed -i 's/?v=OLD/?v=NEW/g' index.html *.js screens/*.js`. Everything uses one number. **This matters more since 1.20.3:** the screens import `../app.js?v=N`, so if one file carries a different number the browser loads a *second copy* of app.js and the app breaks in odd ways. After the bump, `grep -rho '?v=[0-9]*' index.html *.js screens/*.js | sort -u` must print exactly one value.
5. Static name check: `sh test/names.check.sh` passes (CI runs it too).
5. Docs: `CHANGELOG.md` entry **with a "Rollback" line** (§7), `docs/training-logic.md` for rule changes, `docs/HANDOFF.md` version/status.
6. PR description: why, what changed, before/after screenshots for visible changes, regression checklist, rollback plan.
7. Tier B/C: rollback rehearsed (`git revert` on a scratch branch builds and passes e2e; data steps proven in PGlite).

**Merging and deploying**
8. Mark the rollback point *before* merging: push a release branch at the current live commit, `git push origin origin/main:refs/heads/release/vA.B.C` (A.B.C = the version live now), or confirm it exists. *(Release branches instead of git tags: the build environment's proxy refuses tag pushes. A branch marks a commit just as well.)*
9. Tier B: take a snapshot: `select backup.take_snapshot();` (record the `taken_at`: `select max(taken_at) from backup.snapshot;`).
10. Merge the PR (merge commit, not squash, so one `git revert -m 1` undoes it). Apply an approved migration *after* the snapshot and *before* or with the merge, as the PR says.
11. Mark the release: `git push origin <merge sha>:refs/heads/release/vX.Y.Z`.

**After deploying (about 1–2 minutes for Pages)**
12. Smoke test on the live site (§5). If it fails → §6.
13. Drive (private handoff only, owner-only sharing): copy the current docs into **Archive — earlier versions** with the version in the title, then update the current docs. The app never links to Drive; its "How it works" page is served from `docs/training-logic.md` in this repo, so rule changes go live with the release.
14. Post the result (version live, smoke test passed, snapshot time if any) on the PR and to the owner.

## 5. Smoke test (live site, 5 minutes)

1. Open the live app in a fresh tab (or hard-refresh). the version line at the bottom of Settings ("Woodhouse Lifts X.Y.Z · What's new") shows the new version (or open `app.js?v=N` and read `APP_VERSION`); the page source shows the new `?v=`.
2. No errors in the browser console on Home, a workout, the builder and Settings.
3. Open today's workout: suggestions appear, the first set is visible, a weight can be typed.
4. On a preview or test meso only: tick a set, open the rating sheet, use **All normal**, then undo or delete the test set. *Never log test sets into a real user's training.*
5. For engine releases, compare one known lift's suggestion with the expected value from the PR (the PR lists the lift and the expected numbers).
6. Supabase: `get_advisors` (security) shows nothing new.

## 6. Rollback

### 6.1 Decide (within 15 minutes of noticing)

**Roll back immediately when:** sets or ratings can't be saved; data is saved wrong; the app doesn't load or a main screen errors; suggestions are clearly unsafe (big weight jumps).
**Fix forward when:** wording, layout or a small visual issue, with saving and suggestions unaffected. If unsure, roll back.

### 6.2 App (frontend) rollback: about 2 minutes

```bash
git checkout main && git pull
git revert -m 1 <merge-sha>          # undoes the whole release as one new commit
# bump APP_VERSION patch + every ?v= to a NEW number (never reuse a number, so phones fetch fresh files)
git commit -am "Roll back X.Y.Z: <reason>" && git push
git push origin HEAD:refs/heads/release/vX.Y.Z-rolled-back
```
- Pages redeploys in about a minute. Run the smoke test (§5) against the old behavior.
- Alternative when several releases must go: `git checkout vA.B.C -- .` (restore the files of a known-good release branch, e.g. `git checkout origin/release/v1.11.0 -- .`), bump `?v=`, commit, push.
- **Phones:** the `?v=` bump makes browsers load the new files. *When a service worker ships (planned PR 4) it must be network-first with an update banner and a kill switch* (a `sw.js` that unregisters itself), so a rollback always reaches installed apps.
- Re-apply later by reverting the revert, after the fix.

### 6.3 Database rollback

- **Migrations are additive** (§1.6), so an app rollback never needs a database rollback.
- Every migration PR includes `supabase/rollbacks/<migration>.down.sql` that undoes it (drop the new table/column/function, restore the previous function body). It's tested in PGlite: apply → down → the full DB suite still passes.
- Before applying any migration: `select backup.take_snapshot();`
- A `down` script that drops a table loses that table's rows written since the release. Snapshot those rows first (they're in the pre-release snapshot plus anything newer, so take another snapshot right before running `down`).

### 6.4 Data restore from a snapshot

Snapshots: `backup.snapshot` (all 11 user tables as JSON). Weekly automatic (Sunday 09:15 UTC, kept 35 days) plus on-demand before every tier-B/C release.

1. Find the snapshot: `select distinct taken_at from backup.snapshot order by 1 desc;`
2. Open `supabase/ops/restore_user_from_snapshot.sql`, fill in `__USER__`, `__TAKEN_AT__`, `__MODE__`.
3. Run the **PREVIEW** query (rows in the snapshot per table for that user) and compare with now.
4. Run the **RESTORE** block:
   - `missing` (default): puts back deleted rows; leaves current rows alone.
   - `overwrite`: also sets existing rows back to their snapshot values.
   - Rows created after the snapshot are never touched. Parents are restored before children.
5. Re-run the preview and spot-check the user's latest workout in the app.

**Proven by** `node test/restore.drill.mjs`: snapshot → bad edits + a whole meso deleted (cascading to days, sets, ratings) → restore → every row identical in all 11 tables, the other user untouched; and `missing` mode leaves later edits alone. Runs on a throwaway database in every release.

### 6.5 Off-project backups (owner's private Drive)

In-database snapshots don't survive losing the whole Supabase project. So a copy also goes to the owner's private Google Drive, in a **Backups** folder inside the private *Woodhouse Lifts* folder:
- It's shared with nobody. The app has no link to it and never reads it.
- Each copy is a snapshot, exported, with every table's row count checked, then gzipped and uploaded as `woodhouse-lifts-backup-<UTC time>.json.gz` (about 1 MB). Every copy is kept.
- **Schedule:** weekly, Sundays 02:41 America/Denver, by a scheduled task the owner approved on 2026-11-23. It sends a push notification with the result. Also taken by hand before risky data operations. The first copy was taken 2026-11-23.
- Also taken by hand before risky data operations.
- **Never commit a backup file to this repo.**

To restore from a Drive copy, download the file, then:
- **One user, or a few rows:** `node supabase/ops/load_backup_file.mjs <file> --snapshot > restore.sql`. Run it to put the snapshot back into `backup.snapshot`, then follow §6.4.
- **The whole project is gone:**
  1. Create a new project.
  2. Run every migration in order.
  3. Have users sign up again with the same emails, or recreate `auth.users` with the same ids.
  4. Run `--full` output. It refuses a non-empty database, replaces the seeded exercise library with the backup's copy (same ids as your workouts), and checks every table's row count.

  The SQL is several MB; run it with `psql`, or split it per table for the dashboard SQL editor.

**Proven by** `node test/restore.drill.mjs`: synthetic backup file → `--full` into a fresh database → every row identical. The first real backup (2026-11-23, 23,104 rows) was also loaded in full into a fresh database built from every migration, outside the repo.

**Compatibility check for tier B:** if the new app writes something the previous app never wrote (e.g. 1.11.1 saves pump as *not rated*), confirm the previous app handles it after a rollback. Write the result in the Changelog's Rollback line.

## 7. Data operations (tier C)

For any change to existing rows on production (typo removal, imports, backfills):
1. Write the exact SQL in the PR or chat, with a **preview** `select` that shows exactly the rows affected (ids + values).
2. Get The owner's OK for that SQL.
3. `select backup.take_snapshot();`
4. Run it with `returning *` and keep the output. That output is the inverse: re-insert it to undo.
5. Verify with the preview `select` (now empty or changed as intended), and update counts in the docs if they're quoted.

Example: removing two mistyped sets: preview by set id → snapshot → `delete from public.sets where id in (…) returning *` → keep the two rows.

## 8. Changelog "Rollback" line

Each release entry ends with one line, e.g.:
> **Rollback:** revert merge `abc1234` (tier A, no DB changes). Data written by this version stays valid in 1.11.0 (pump *not rated* rows make 1.11.0 ask for pump again; nothing breaks).

## 9. Drills and upkeep

- Every release: `test/restore.drill.mjs` runs with the suites.
- Before the first service worker release (PR 4): rehearse an app rollback on a scratch branch with the service worker installed, including the kill switch.
- Monthly: confirm the weekly snapshot ran (`select max(taken_at) from backup.snapshot;` is less than 8 days old).
- When adding a table: add it to `backup.take_snapshot`, to the restore script's table list (parents first), and to the drill.

## 10. Release log

| Version | Released | Merge | Rollback point | Pre-release snapshot | Smoke test |
|---|---|---|---|---|---|
| 1.12.1 | 2026-11-23 05:30 UTC | `037e29a` (PR #8) | `release/v1.12.0` = `aea334a` | 05:30:37 UTC (11 tables) | Migration `feedback_adjustment_scope` applied after the client deploy. Verified on prod with a rolled-back test: wrong-muscle change refused, correct call OK, total sets unchanged. Live app loads real data under the new CSP and pinned supabase-js. This check found the 1.12.2 bug. |
| 1.12.1 – 1.20.7 | 2026-11-23 → 24 | PRs #8 – #34 | each `release/vX.Y.Z` | before every migration | Listed release by release in the private Drive doc *Start Here* §0 and in `CHANGELOG.md`. |
| 1.12.0 | 2026-11-23 05:15 UTC | `aea334a` (PR #7) | `release/v1.11.5` = `5dbe0bc` | 05:15:10 UTC | Live files 1.12.0, `?v=36`. Note: requesting `app.js?v=36` before Pages finished deploying cached the old file under the new URL for up to ~10 min, harmless because the old files still work together. **Don't fetch the next `?v=` URL before the deploy lands; check with an extra query string.** |
| 1.11.5 | 2026-11-23 04:48 UTC | `5dbe0bc` (PR #6) | `release/v1.11.4` = `33682ce` | 04:47 UTC (taken for the data fix below) | Live files 1.11.5, `?v=35`, `fitPlan` served; app loads with no errors. |
| 1.11.4 | 2026-11-23 04:13 UTC | `33682ce` (PR #5) | `release/v1.11.3` = `75691c0` | not needed (tier A) | Live files 1.11.4, `?v=34`; no Google links in app code; rules page served; app loads. |
| 1.11.3 | 2026-11-23 03:49 UTC | `75691c0` (PR #4) | `release/v1.11.2` = `fcfda31` | not needed (tier A) | Live files 1.11.3, `?v=33`; app loads with no errors. |
| 1.11.2 | 2026-11-23 03:43 UTC | `fcfda31` (PR #3) | `release/v1.11.1` = `936ef4b` | not needed (tier A) | Live files 1.11.2, `?v=32`, new doc link; app loads with no errors. |
| 1.11.1 | 2026-11-23 03:25 UTC | `936ef4b` (PR #2) | `release/v1.11.0` = `d7e3e11` | 2026-11-23 03:24:06 UTC (11 tables, 14,286 sets) | Live files 1.11.1, `?v=31`, new doc link; app loads with no errors; security advisors unchanged. Signed-in steps 3–5: the owner to check on their phone. |

### Data operations log (tier C)

| When | What | Rows | Snapshot before | Undo |
|---|---|---|---|---|
| 2026-11-23 04:47 UTC | Removed two mistyped imported sets from one user's history (owner-approved) | 2 sets (`returning` output kept) | 04:47:43 UTC | Inverse insert kept privately, outside this repo |
