# Woodhouse Lifts — Start Here (handoff for a new chat)

**Current version: 1.11.1 (2026-11-22).** If you are a new chat picking this up: read this page first, then *Woodhouse Lifts — Training Logic* (the full rules and evidence) and *Woodhouse Lifts — Changelog* (what changed, version by version). All three live in the Google Drive folder **Woodhouse Lifts**; older copies are in its **Archive — earlier versions** subfolder. The repo holds the same files under `docs/` and `CHANGELOG.md`, and the repo copy is the one that changes first.

---

## 0. Status (2026-11-22)

Live: **1.11.0**. Open PRs: **#2** (1.11.1, engine fixes + this playbook) and **#1** (1.12.0, design foundations; rebase after #2, `?v=32`). Release order, one at a time with a smoke test between: 1.11.1 → 1.12.0 → body-area protection (uses `profiles.avoid_tags`, no migration) → workout screen → home/library/mesos → install/offline/service worker (rehearse the kill switch first) → onboarding → code quality (module split, CI, linter, one version number, pinned supabase-js). Every release follows `docs/PLAYBOOK.md`. User-specific status (accounts, pending data fixes) lives only in the private Drive copy of this page, never in this public repo.

## 1. What it is

An RP-style (Renaissance Periodization-style) hypertrophy app for Anthony and Haylee. It plans mesocycles, suggests weights and reps each week, asks how each muscle felt, and adjusts sets and loads from that feedback. It is an original app: it does not copy RP content.

| Thing | Where |
|---|---|
| Live app | https://anthony-christiansen.github.io/Woodhouse-Lifts/ (GitHub Pages, deploys on push to `main`) |
| Code | https://github.com/Anthony-christiansen/Woodhouse-Lifts (public) |
| Database | Supabase project `dnknmtzcmmdepwheagmq` (free plan) |
| Docs | Google Drive folder "Woodhouse Lifts" (`1ncR6y_wFl5mtZrEhrEzvzD6ojTJ8If9N`), archive subfolder `1qnq-llvi5s__4jfQAZNqXvISdonS3Tv5` |
| Raw history | In that Drive folder: `rp_all_mesocycles_history.csv` (all RP history) and `RP export — Whole Body Split AC VI & VII (2026-11-20).csv` |
| Account | GitHub **Anthony-christiansen**, Google **anthonymchristiansen90@gmail.com**. Never the Trucordia / Anthony90MC accounts. |

## 2. Ground rules for any change (Anthony's standing instructions)

1. **No production data changes or deploys without Anthony's approval.** Code deploys (push to `main`) have been approved for this project; **database migrations still need an explicit "approved"** in chat before being applied to prod.
2. Never expose the service-role key or any other secret. Never create, view or type passwords.
3. **Keep old documents.** When a Drive doc is replaced, move the old one to *Archive — earlier versions* with its version in the title. Never trash.
4. **No calendar dates in meso tracking.** Weeks only (Mon–Sun is just "a week"). Run-it-again picks a meso *week*, never a date.
5. **Weight increases: less is more.** Automatic raises are 2.5 or 5 lb, never more than +5 lb (2.5 kg) a week, unless the last workload was Easy **and** the muscle never got sore (then up to +10 lb). Manual bumps are always allowed and only warn.
6. Lumbar history: avoiding spinal (axial) loading is **Anthony's personal preference**, set per user (`profiles.avoid_tags`), not a global rule. The app makes no medical decisions.
7. Live logic adjusts **week over week within the current meso**. Historical bests are a *notice only* ("📌 18% below your all-time best — for reference"), never the target.
8. Evidence first: rules should line up with research (PubMed sources in the Training Logic doc §7); where a number is a judgement call, the doc says so.

## 3. How the code is laid out

No build step. Plain ES modules served by GitHub Pages.

| File | What's in it |
|---|---|
| `index.html` | Shell. Loads `styles.css?v=N` and `app.js?v=N` — **bump `?v=` on every release** (now `v=31`; one number for every file). |
| `app.js` (~1,900 lines) | UI + data access. Hash router (`#/`, `#/workout/<dayId>`, `#/workout/<id>/view`, `#/meso/<id>`, `#/new`, `#/templates`, `#/cardio`, settings…). Supabase client, offline save queue, workout logger, recovery gate, builder, home dashboard and drill-downs. `APP_VERSION` constant at the top (now `'1.11.1'`) must match the changelog. |
| `logic.js` (~850 lines) | **Pure training engine, no I/O.** Everything testable lives here (see §5). |
| `learn.js` | In-app "Learn" explanations and app defaults. |
| `styles.css` | Styling; phone-first (inputs ≥16 px font, ≥44 px tap targets, small text ≥13 px). Accent colour `--accent` = lime `#9be33c` (v1.11). |
| `supabase/migrations/` | Every schema change, in order (§4). `supabase/seed/` = exercise library. |
| `docs/training-logic.md` | The rules and evidence (master of the Drive "Training Logic" doc). |
| `docs/HANDOFF.md` | This page. |
| `docs/PLAYBOOK.md` | Release & rollback playbook: approvals, risk tiers, checklist, smoke test, app/DB/data rollback. |
| `supabase/ops/restore_user_from_snapshot.sql` | Tested script that restores one user's data from `backup.snapshot` (preview + `missing`/`overwrite` modes). |
| `CHANGELOG.md` | Every release. |
| `test/` | `logic.test.mjs` (engine), `db.test.mjs` + `db.checks.mjs` + `dbkit.mjs` (fresh DB from all migrations in PGlite), `e2e/*.py` (real Chromium against a mocked Supabase), `restore.drill.mjs` (rollback drill on a throwaway DB). |

### Release checklist (summary; the full version with rollback is `docs/PLAYBOOK.md`, Drive: *Woodhouse Lifts — Release & Rollback Playbook*)
1. Branch off `main`.
2. Change `logic.js` / `app.js`; add tests.
3. Run **all** suites: `node test/logic.test.mjs`; `node test/db.test.mjs` (needs `npm i @electric-sql/pglite` in `test/`); serve the folder on port 8765 and `for f in test/e2e/*.py; do python3 "$f" | tail -1; done`.
4. Update `docs/training-logic.md`, `CHANGELOG.md`, `APP_VERSION`, and `?v=` in `index.html`.
5. Merge to `main` and push → GitHub Pages deploys in about a minute.
6. If a migration is needed: write it in `supabase/migrations/`, test it in PGlite, **get Anthony's approval**, apply to prod, then verify with a rolled-back test (a `DO` block that ends in `raise exception`) so no prod data changes.
7. Drive: move the old docs to the archive folder, upload the new ones.

## 4. Database (Supabase)

Row Level Security is on for every table ("own rows" policies keyed on `user_id`; exercises are readable if shared or your own). Functions are `SECURITY INVOKER` with `search_path = ''`. **All weights are stored in pounds**; kg is display only (`W()` / `toLb()` in app.js; 100 kg ↔ 220.46 lb round-trips exactly).

| Table | Holds |
|---|---|
| `profiles` | One per user (made by `handle_new_user` trigger). `unit` (lb or kg), `equipment` (null = everything), `avoid_tags` (e.g. `axial`). |
| `exercises` | Library: name, muscle_group, load_type (weighted / bodyweight / assisted / cardio), equipment, rep_min/rep_max, `tags` (e.g. axial, compound). Shared rows + per-user rows. |
| `exercise_prefs` | Per-user likes / avoid / substitutions used by autofill. |
| `templates` | Saved meso plans (with `goal`). |
| `mesocycles` | A meso: weeks, split, goal (hypertrophy / strength / athletic), priorities per muscle, `client_key` (idempotent create), `carry_meso_id` + `carry_week` (run-it-again source). |
| `workout_days` | One per day per week: week, day_index, label, `started_at`, `completed_at`, `skipped_at`. |
| `workout_exercises` | Exercises on a day with planned sets and `target_rir`, `flag`. |
| `sets` | Logged sets: set_index, weight (lb), reps, rir (optional actual RIR), duration_min / rpe for cardio, `completed_at`. |
| `exercise_feedback` | (v1.10) Per workout exercise: workload, joint_pain. One row per exercise per session. |
| `muscle_feedback` | Per day per muscle: pump, workload, joint_pain, performance, `soreness` (rated at the *next* session for that muscle), breathing (cardio), `adjusted` flag. |
| `cardio_sessions` | Stand-alone cardio. |
| `backup.snapshot` | Weekly snapshots (`backup.take_snapshot`). |

**RPCs:** `create_mesocycle` (atomic, idempotent by client_key), `dashboard_stats`, `strength_summary`, `lift_recent` / `lift_sessions` (history with horizon), `apply_feedback_adjustment(p_feedback_id, p_soreness, p_changes jsonb, p_deload jsonb) → boolean` (applies a set adjustment exactly once — locks the feedback row and checks `adjusted`; the app falls back to plain updates if the RPC is missing, error PGRST202).

**Migrations applied to prod, in order:** initial_schema → lock_rls_auto_enable → training_logic_v2 → workout_day_skip → cardio_exercises_and_import → templates → cardio_breathing_rating → dashboard_rpc → strength_summary_rpc → weekly_snapshots → p1_reliability → exercise_preferences → lift_recent → lift_recent_horizon → carry_from_week → atomic_feedback_adjustment → exercise_feedback (latest).

**Offline queue:** unsaved sets are kept per account in localStorage `wl_pending_sets_v1:<user id>` and retried; saves the database permanently refuses (SQLSTATE classes 22/23/42) move to a "failed" list instead of retrying forever. Other phone-only settings: `wl_increments` (smallest weight jumps), `wl_session_minutes`.

## 5. The training engine as it stands (1.11.1)

Full rules, examples and sources: *Training Logic* doc. Quick map of `logic.js`:

| Area | Current rule | Key functions / constants |
|---|---|---|
| RIR by week | Ramps toward 0 RIR across the meso; last week is a deload. | `rirForWeek`, `targetRir` |
| Plan building | Split by days (2–6), muscle priorities **Emphasize / Grow / Maintain / Skip** (max 3 emphasized), equipment and preferences, then **fit to time** (60/75/90 min; trims lowest priority first; ≤10 sets per muscle per session). | `autofill`, `applyPreferences`, `fitToTime`, `SET_MIN`, `SESSION_MUSCLE_CAP` |
| Load vs reps | Each lift progresses either by weight or by reps, decided from the meso's own pattern, room in the rep range, and load size (light loads where one step >5% go by reps). | `progressionMode` |
| Step size | ≈2.5% of the load, rounded down to the gym increment, ≥1 increment, **≤5 lb / 2.5 kg**, ≤ your usual jump. Increments default 2.5 lb (dumbbells 5 lb), settable. | `loadStep`, `STEP_MAX`, `setIncrements`, `increment` |
| Speed from feedback | Each lift: its **own exercise rating** (workload, joint pain) capped by the **muscle rating**. Hold (Too much or joint pain ≥2 on the exercise; muscle Too much) · Slow (Pushed my limit; muscle joint pain from another lift) · Normal · **Fast only if exercise and muscle were Easy + never got sore + no joint pain**, never at 0 RIR or on axial lifts. Older sessions without exercise ratings use the muscle rating alone. | `liftSpeed`, `progressionSpeed` |
| Guardrails | Every automatic raise ≤ `safeMax` = smaller of +1 step (≤5 lb / 2.5 kg; 2 steps on a Fast week) and +5%; meso ceiling +20% over week 1 (then reps); ≤+2 reps a week; deloads untouched. Manual entries above `safeMax` save and show a "Manual bump" note; >1.5× asks "typo?". | `suggestSet`, `safeMax`, `GUARD`, `weightSanity` |
| Equivalent reps | Changing the weight re-targets reps by e1RM (`w × (1 + (reps+RIR)/30)`), capped at 20 reps+RIR. | `repsAtLoad`, `weightRange`, `e1rm` |
| Sets per muscle | From pump, workload, joint pain, soreness, performance and priority: Emphasize adds when recovered, Grow adds only on a measured stall (no comparison yet = hold), Maintain never adds; missing pump/performance never unlocks +2; ≤+2 sets per muscle per week; every change explains itself. | `setAdjustment`, `distributeDelta`, `WEEKLY_STEP_CAP` |
| Lift status | PR / progressing / steady / dip / stalled / regressing judged on raw performance by meso week (not RIR-credited e1RM), plus same-week-last-meso comparison. Orange notice on every set below last week. | `mesoStatus`, `vsLastMeso`, `prsInMeso`, `slipWarnings` |
| Warm-ups | Never logged; rounded to 5 lb / 2.5 kg plates, never below the empty bar. | `warmupPlan` |
| Carry-over | New meso / run-it-again starts from a chosen week of the last meso (up to 2 weeks before the deload), weeks not dates. | `carry_week` in DB |

## 6. Logic that was tried and replaced (and why)

Useful so a future change doesn't reintroduce an old problem.

| Version | What it did | Why it changed | Replaced by |
|---|---|---|---|
| ≤1.3 | "Stalled" = e1RM (with RIR credit) not rising for 2+ weeks. | Flagged normal RP-plan progress as stalled, because RIR dropping each week makes credited e1RM flat. Felt discouraging. | 1.4.0 `mesoStatus`: raw performance by meso week. |
| ≤1.4 | Orange notice only on the first below-last-week set. | Didn't show again on later sets or re-tap (standing knee drive). | 1.4.1: every below-last-week set. |
| ≤1.4 | Load lifts copied the RIR drop as +1 rep at same weight. | Sled 315×27 vs RP's 325×28 — didn't match how weighted lifts progress. | 1.5.0 load-vs-reps modes. |
| 1.5–1.8 | Step = your last observed jump (sled +10 lb). Weekly cap +10%. | History (2,376 changes) showed jumps >4% kept reps only 27–39% of the time vs 94–97% at ≤4%. | 1.9.0: ~2.5% step, ≤5 lb, +5% cap. |
| 1.6–1.9.0 | "Faster" on workload Easy alone (+2 steps, e.g. sled +10). Two-RIR drop = 2 × step. | Anthony: never more than 2.5 or 5 lb unless manual, or the work was insufficient **and** never sore. | 1.9.1: `safeMax`, Fast needs never-sore. |
| ≤1.10 | Separate exercise and muscle pop-ups; jargon (RIR) on every screen; the same warnings on Home, meso and workout. | Usability review as a first-time user: ~15 pop-ups per full-body day, alarm fatigue, first set 1.5 screens down. | 1.11.0 combined sheet + All normal, plain language, one place per warning. |
| ≤1.11.0 | Capped re-set kept low reps (95×12 → 97.5×8); light-load steps kept reps (45×12 → 50×12); Grow added sets with no performance data; templates emphasized 4–5 muscles; All normal still needed pump. | Set-by-set comparison with RP on Haylee's week 3 + outside audit + new 6-week simulation. | 1.11.1 re-solves reps after caps and steps, missing data never adds volume, ≤3 emphasized, pump optional. |
| ≤1.9.1 | Feedback only per muscle; joint pain on one exercise held every lift for that muscle. | Anthony wanted each exercise rated, plus the muscle. | 1.10.0 `exercise_feedback` + `liftSpeed`. |
| ≤1.8 | "Focus" muscles (on/off). | Too coarse; couldn't say "keep it" vs "grow it". | 1.9.0 Emphasize / Grow / Maintain / Skip (old "focus" reads as Emphasize). |
| ≤1.8 | Fixed set counts regardless of time. | 2-day full body came out at 35–38 sets. | 1.9.0 fit-to-time builder. |
| ≤1.7 | Days in fixed order; recovery asked about "the previous day". | Wanted legs today instead of back. | 1.8.0 any order within a week, read-only preview of later weeks, recovery uses the most recently finished session. |
| ≤1.1 | Run-it-again from calendar dates. | Dates aren't tracked meaningfully. | 1.2.0 pick a meso week. |
| ≤1.7 | Single shared offline queue; retried refused saves forever. | Could mix accounts; stuck retries. | 1.8.0 per-account queue + failed list. |

## 6a. UI conventions (v1.11 usability pass)

Keep these when adding screens, so the app stays usable for someone who didn't build it:
- **Plain words on screen; jargon in ⓘ / Learn.** Use `effortText(rir)` / `effortShort(rir)` ("stop 2 reps short of failure" / "2 reps short") instead of "RIR".
- **Each warning in one place.** Lift trends → the lift's coach note; muscle recovery → the workout's one-line Heads up; everything else → "Things to check" on the meso page. Home only links to it.
- **One pop-up per finished exercise**, with the muscle questions folded in when it's the muscle's last exercise; always offer **✓ All normal**.
- **First set within about one screen**: details go in ⓘ, not on the card.
- Tabs: Home · Workout · Mesos · Library (exercises, templates) · More (learn, stats, settings). Don't duplicate tab destinations inside More.

## 7. Open ideas (not started)

From the second outside review: rest timers, a session summary screen, the option to move the deload earlier, myo-reps. Ask Anthony before starting any of them.

## 8. Where to look when something seems off

- **A suggested weight looks wrong:** `suggestionFor` in app.js gathers last week's same-day sets (`prev`), the meso trail, last week's feedback (`prevFb`) and calls `L.suggestSet`. The exercise note shows which rule fired (e.g. "auto increases stop at +5 lb a week").
- **Set counts changed unexpectedly:** `applyAdjustment` in app.js → `L.setAdjustment` / `L.distributeDelta`; the toast explains the rule.
- **Data question:** query Supabase read-only (`select` only) and compare against the Drive CSVs. Never update prod rows without approval.
