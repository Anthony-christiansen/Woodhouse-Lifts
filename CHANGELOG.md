# Woodhouse Lifts — Changelog

Every released version of the app, newest first. Each entry lists what changed for people using the app, what changed underneath (database, logic), and any one-time data operations.

- Live app: https://anthony-christiansen.github.io/Woodhouse-Lifts/
- Code: https://github.com/Anthony-christiansen/Woodhouse-Lifts

Versions follow **MAJOR.MINOR.PATCH**:
- MAJOR: a change in how the training engine or the data works that people will notice.
- MINOR: new features.
- PATCH: fixes.

---

## 1.21.1 — 2026-11-25 · Look at any day of the week without switching (owner request)

The owner: "When I want to look at the week workouts and exercises it makes me switch. It shouldn't make you switch but you can only log exercises for one workout at a time."

**For people using the app**
- With a workout in progress, opening another day of the week now **opens it straight away to look at**: its exercises, sets, weights and the new weight range. Before, a "Workout in progress" card was in the way.
- A banner explains: **"Just looking — Full Body A is in progress, so new sets go there. Finish or skip it to log this day."** It has **Back to Full Body A**.
- Logging stays with the one workout in progress. If nothing is logged there yet, the banner also offers **Start Full Body B instead**, as your choice, never forced.
- Looking never starts or changes anything.

**Underneath:** `renderWorkout(dayId, 'view', { live, loggedAny })` replaces the gate card. The mock gained `__DAYS_PATCH` and `__LIVE_SETS` hooks. New `lookweek211.py` (11 checks): it opens directly, logging is off, nothing is started, Back works, and Start-instead works. Rollback: `release/v1.21.0`.

## 1.21.0 — 2026-11-25 · A recommended weight range on every lift (owner request)

The owner: "I like the functionality of the weight and rep manual increases but can we add a small recommended range for weights … and then the volume functionality stays the same", then "it could squeeze in right above the set plus and minus buttons below the last set".

**For people using the app**
- Each weighted exercise with history shows one line under its last set, above **+ set / − set**: **"Range today 67.5–72.5 lb · reps adjust"**.
- **Bottom:** one normal weight step below last week. A lighter day is fine, and the suggested reps go up to match.
- **Top:** the app's own automatic-increase limit: never more than **+5 lb / +2.5 kg**, and about **+5%** a week.
- Both ends stay inside the weights where your rep range still works, and today's suggested weight is always inside the range.
- Examples: 100 lb last week → 97.5–105 lb; a 22.5 lb cable lift → 20–25 lb.
- Not shown on light (deload) weeks, finished workouts, bodyweight, assisted or cardio exercises, or a lift's first time.
- **Nothing else changes:** suggested weights, reps re-targeting when you change the weight, manual bumps, and set counts (volume) work exactly as before.

**Underneath**
- `logic.js`: `recommendedRange({ prevWeight, suggested, window, ex, unit })`, built from the existing `loadStep`, `safeMax` and `weightRange`.
- `screens/workout.js`: `rangeLine()`.
- Tests:
  - engine block V1.21.0: the owner's triceps cable 22.5 → 20–25; the top is never more than +5 lb and stays within `safeMax` across loads and equipment; kg; the suggestion is always inside;
  - new `wtrange210.py` (9 checks), including its position, one line, and nothing cut off on a 390 px phone;
  - render snapshot: the only diff is the new line (re-baselined).
- Rollback: `release/v1.20.11`.

## 1.20.11 — 2026-11-25 · Fix: rating pop-ups didn't appear when the workout was opened from the Workout tab (owner report)

**What happened:** "Feedback stopped showing up to do."
- The 1.20.7 fix for the stuck pop-up allowed rating pop-ups only when the address named the workout (`#/workout/<id>`).
- The **Workout tab** opens the workout in progress at `#/workout`, with no id, so from the tab no rating pop-up ever opened.
- The owner's Week 4 · Day 4 workout had 8 sets logged and 0 ratings.

**Fixed:**
- `#/workout` counts as being on that workout.
- The other 1.20.7 protections stay: no pop-ups on other screens, a muscle with no sets on screen isn't "finished", and "Not now" still works.
- Ratings missed earlier aren't lost: reopening the workout asks for finished exercises, and Finish asks for anything left.

**Tests:** `stuck207.py` now also opens the workout from the Workout tab (11 checks), which fails on 1.20.10. The browser tests had always opened workouts by id, which is how this was missed. Rollback: `release/v1.20.10`.

## Ops — 2026-11-25 · Light-week requests must carry the meso's revision (audit 1.20.4, finding 3)

- `start_light_week` and `undo_light_week` accepted a missing revision and then skipped the "did this meso change since the preview?" check. The app always sends the revision (since 1.17.1), so app users were never affected, but a direct call or an old copy of the code could skip the check.
- Now the revision is required: it has no default, and null is refused ("revision is required"). Nothing else in the functions changed.
- Migration `20261125000000_light_week_revision_required`: drop and re-create both functions in one transaction, with the same grants. **Applied to production 2026-11-25 15:3x UTC with the owner's explicit approval**, after a fresh backup snapshot. Verified: both signatures require the revision, `authenticated` can execute and `anon` can't, and a rolled-back test call refuses a null revision (22023). App unchanged.
- Tests:
  - DB: leaving the revision out fails; null is refused for start and undo; every earlier light-week check still passes.
  - Real PostgreSQL: the 4 races still pass.
  - New `test/rollback.lw.check.mjs` (in CI): migrate → rollback → re-apply on a fresh database, with grants checked each time.
- **Rollback:** `supabase/ops/rollback_20261125000000_light_week_revision_required.sql`.

## 1.20.10 — 2026-11-24 · A change that couldn't be applied is never counted as saved (audit 1.20.8, F01)

**What could go wrong (reproduced on 1.20.8):**
- Finishing or skipping a workout goes through the phone's queue as an UPDATE.
- If the workout no longer existed, or wasn't on this account, the server answered "no error, 0 rows changed". The app took that as success, removed it from the queue, and the summary said **"Saved and synced."**

**Fixed:**
- Each queued update now asks for the changed row back.
- If no row changed, it's a conflict, not a network hiccup, so it isn't retried forever. It's kept in **Settings → Sync problems** with the reason ("that workout no longer exists or isn't on this account").
- The summary shows the problem instead of "synced". Online, Finish stays on the workout and says so.
- A normal finish is unchanged.

**Underneath:**
- `net.js`: `opQuery` adds `.select('id')` to updates; `missedTarget()`; `flushOps` handles 0 rows.
- The mock gained a `__MISSING` hook.
- New `opmissing2010.py` (10 checks), 5 of which fail on 1.20.8.
- Rollback: `release/v1.20.9`. No database change.

## 1.20.9 — 2026-11-24 · A removed set stays removed (audit 1.20.4, finding 2)

**What could go wrong (reproduced on 1.20.8):**
- **During a sync:** right after reconnecting, the app sends sets that were saved on the phone. If you tapped **− set** on one of them while it was still being sent, the delete could reach the server first, and the save landing after it brought the set back.
- **With a second tab:** if another tab of the app still held an older copy of that set, its next sync re-created the set.

**Fixed:**
- **− set** now waits for any save of that set that's already on its way, then deletes it.
- The phone remembers the removal for two weeks, per account and shared by every tab. An older copy of that set is dropped instead of sent.
- Adding the set again afterwards saves normally. Removing with no signal is still refused and keeps the row and its waiting copy, which syncs later.
- **Not covered yet:** a stale offline copy on a *different phone*. Closing that needs a small server-side guard (a database change), proposed in the session log for the owner's approval.

**Underneath:**
- `net.js`: `deleteSet()` runs in the same per-set chain as saves (`inOrder`). `sendQueued` drops copies edited before a tombstone (`wl_set_tombstones_v1:<user>`).
- The mock server logs what reaches it in order (`__ops`).
- The render snapshot ignores MM-DD dates (it failed after midnight UTC).
- New `setdelete209.py` (12 checks). Three of them fail on 1.20.8: the delete lands before the pending save, the set ends up re-created, and another tab's stale copy gets sent.
- Rollback: `release/v1.20.8`. No database change.

## 1.20.8 — 2026-11-24 · One honest answer to "is my workout saved?" (audit 1.20.4, finding 1)

**For people using the app**
- **The summary's save line now has five honest states**, and it updates by itself while you look at it:
  - **Saved and synced.**
  - **Saving… a copy is already on this phone.**
  - **Saved on this phone:** it syncs by itself when you're back online.
  - **Not saved on this phone yet:** the phone wouldn't keep an offline copy (storage full or blocked). Keep the app open until it says synced.
  - **Refused by the server:** kept aside on this phone, not lost, with a link to fix it.
- Before, it said "Saved on this phone" even when the copy was only in memory, and it never mentioned refused saves.
- **The sync badge gives the same answer** as the summary, because both come from one place.
- **Settings → Sync problems** (shown only when there are some) lists each refused change with the server's reason. It tells you to re-enter anything that matters, and has **Clear the list**. Before, refused saves went to a hidden list nothing showed.
- A set refused twice (on change and on ✓) is listed once, with its latest values.
- Long pop-up messages wrap in a rounded box instead of a tall oval.

**Underneath**
- `net.js`: `saveState({ since })` gives refused › memory › saving › device › synced from the per-account queues, the in-flight chains and the refused list. Also `clearFailed()`. `qAddFailed` keeps one entry per set.
- The summary stores `since` (the workout's start), so an old refusal doesn't colour today's summary.
- Tests: `savestate208.py` (13 checks) covers synced, in flight then landed, offline on the phone, a quota-blocked phone offline (summary and badge) then back online, refused with Settings and clear, and old refusals ignored. The mock gained a `__REFUSE` hook.
- Rollback: `release/v1.20.7`. No database change.

## 1.20.7 — 2026-11-24 · Fix: a rating pop-up could get stuck (owner report)

**What happened:** "when providing feedback live the feedback pop-up got stuck — I had to exit and reopen the app."
- If a set's save finished after you'd left the workout screen (a tab, Home, Go to), the workout ran its "rate the muscles you've finished" check against a screen with no sets on it.
- With no sets to look at, every unrated muscle counted as finished. So it opened locked rating pop-ups for them one after another, even muscles you hadn't trained yet. A locked pop-up had no way out, and the Cardio one needs a breathing answer that "All normal" doesn't fill.
- In the owner's workout, Shoulders, Forearms and Abs were rated "All normal" at 1:50 pm, before the wrist curls (2:10) and abs (2:14) were done.

**Fixed**
- Rating pop-ups only open while that workout is the screen you're on.
- A muscle with no sets on screen never counts as finished.
- Every rating pop-up now has **Not now**. It won't ask again after every set, and Finish still asks for anything left unrated, so no rating is skipped by accident.

**Underneath:** `screens/workout.js` gets `onThisWorkout()`, a non-empty `muscleComplete`, and a `notNow` set. New test `stuck207.py` (9 checks) fails on 1.20.6: the pop-up appears on Home and there's no way out. Rollback: `release/v1.20.6`. No database change.

## 1.20.6 — 2026-11-24 · Home leads with your wins; lifts to watch say what to do next

The owner: "we want to report stuff but we want to keep people excited to see the progress."

**For people using the app**
- **This meso's lifts** now lists new bests and on-track lifts first, then the ones to keep an eye on. Every lift is still listed.
- A line at the top counts the good news: "🏆 7 at a new best · 9 on track · 3 holding".
- Lifts to watch use words that say what to do next. Each keeps its honest percentage where it has one.

| Was | Now |
|---|---|
| Dipped −6.0% | **Off week −6.0%** |
| Flat 2 wks | **Ready for +1 rep** |
| Down −3.8% (red) | **Recover first −3.8%** (amber) |
| Held | **Holding** |

- "2 need attention" became "2 are ready for a little attention — your next workout shows exactly what to do."
- The same labels appear on each lift's page and in the workout's trend sheet.

**Underneath**
- Display only: `PILL_LABEL`, `STATUS_ORDER` (Home sort) and pill colours. The engine's statuses, thresholds and advice are unchanged.
- Tests: `insights.py` updated. The render snapshot was re-baselined for exactly two screens (Home, the lift page), and the diff was reviewed: wording and order only.
- Rollback: `release/v1.20.5`.

## 1.20.5 — 2026-11-24 · The workout summary says "On plan" too, and counts your sets right

**For people using the app**
- **After Finish, a lift you did exactly as planned shows a green ● and "On plan · +1 rep/set"** (or "+2.5 lb", etc.) instead of ▬ "about the same". A lift that beat the plan says **Beat the plan**. A lift below last time keeps its ▼ and adds "An off day happens — next week starts from here".
- The third number at the top is now **on plan or better** (lifts that beat the plan or hit it), instead of only "beat last time".
- Muscles under "What happens next" read **on plan** when their lifts were on plan, **holding steady** when nothing changed, and **below last time** instead of "down".
- **Fixed: the summary said "3 of 0 sets" and "0/0 sets".** Finishing never loaded each exercise's planned set count: the server query didn't ask for it, and neither did the copy kept for finishing with no signal. Nobody had finished a workout since the summary shipped (1.19.0), so no one saw it.

**Underneath**
- `screens/workout.js`: the summary keeps each lift's muscle and `change` (from `rawChange` / `changeLabel`, 1.20.4); the finish query and the offline copy include `target_sets`.
- `screens/home.js`: summary marks, notes, the count and the muscle words. Scoring is unchanged: muscle performance saved to the database is the same as before.
- Tests: `summary205.py` (14 checks: a real finish with no signal, every mark, the count, the muscle words, and that the finish query asks for `target_sets`; the mock server returns every column, so that last one checks the code itself).
- Rollback: `release/v1.20.4`.

## 1.20.4 — 2026-11-24 · "On plan" instead of 0.0% on the exercise pill

**For people using the app**
- The pill next to each finished exercise (and in its rating sheet) used to say **● 0.0%** when you did exactly what the plan asked, for example one more rep per set at one rep closer to failure. It now says **● On plan · +1 rep/set**: what actually changed, set by set ("+2.5 lb", "+2.5 lb, −1 rep/set", or "+3 reps" when sets changed by different amounts). With no change at all it says **● Same as last time**. Beating the plan still shows **▲ +x%**, and falling short shows **▼ −x%**.
- Long pills now move to their own line under the exercise name instead of running off the card.

**Underneath**
- `logic.js`: `rawChange(cur, prev)` and `changeLabel(change, unit)` (pure). The scoring (`performanceTrend`, ±1%) and everything that uses it (set adjustments, stalls) are unchanged. The estimate is still in the pill's tooltip.
- `styles.css`: `.pill.plan`; the exercise header's trend slot is no longer a fixed 1.1em box.
- Tests: engine block V1.20.4 (the owner's Cable Overhead Triceps Extension week 3 → 4: 22.5 × 14/10/10 at 1 RIR → 22.5 × 15/11/11 at 0 RIR = flat estimate, "+1 rep/set"); browser test `pill204.py` (on plan, same, ▲, ▼, tooltip, rating sheet).
- Rollback: `release/v1.20.3`.

## 1.20.3 — 2026-11-24 · Code tidy-up, part 3 — screens in their own files (audit PR-D, done)

No change to anything you see or do.
- `app.js` went from 2,580 to **480 lines**. It now holds only the core: the router, sign-in, shared helpers and queries.
- The screens moved, code unchanged, into `screens/home.js` (Home, More, summary, feedback, stats), `screens/mesos.js` (meso list, builder, meso page), `screens/workout.js` (workout logger, recovery questions, cardio) and `screens/library.js` (Learn, exercise library, injuries, Settings).
- `state.js` holds the three things several screens change: your profile, the exercise list and the in-progress meso builder.
- **How we know nothing changed:**
  - All 2,516 non-blank lines of the old file appear exactly once in the new files. Nothing was added or lost; the only edits are `export`/`import` lines and the 18 places that now call a setter.
  - The render snapshot shows all 19 screens identical, and every browser suite passes.
  - **New permanent check: `test/names.check.sh`** (in CI). It proves every name the app uses exists and every import is really exported, including in code paths no test clicks through. It was proven by planting mistakes, and it fails the build on each one.
- Test tools: TypeScript 6.0.2 pinned in `test/package.json`, used only as this checker.

**Rollback:** app → `release/v1.20.2`.

---

## 1.20.2 — 2026-11-24 · Code tidy-up, part 2 (audit PR-D)

No change to anything you see or do.
- `net.js` now holds the Supabase connection and the whole offline-safe sync queue:
  - saving sets with versions, in order;
  - ratings and finishing a workout with no signal;
  - the sync badge;
  - the storage-failure fallback.
- `net.js` owns the signed-in session, so the queue always keys on the right account. `app.js` sets it in its two places with `setSession()`.
- `app.js` is 173 lines shorter (2,581).
- The render snapshot caught one mistake during the move (a value not exported), which was fixed before anything shipped. All 19 screens are identical, and the offline, sync, storage-failure and light-week suites pass unchanged.
- **Still in app.js:** the screens. Moving them needs `profile` and the exercise cache to move into a shared module the same way. That's the next tidy-up step.

**Rollback:** app → `release/v1.20.1`.

---

## 1.20.1 — 2026-11-24 · Code tidy-up, part 1 (audit PR-D)

No change to anything you see or do. This only moves code between files, so it's easier to maintain.
- `icons.js` holds the icon set; `format.js` the small formatting helpers (dates, numbers, text escaping); `ui.js` the toast, label linking and the accessible pop-up sheet. `app.js` imports them, and is 116 lines shorter.
- **New safety net:** `test/e2e/render_snapshot.py` records the exact HTML of 19 screens (mock data) and fails on any difference. It passed byte for byte after the move, and it now runs in CI with every other suite.
- **Next part (planned):** move the screens (workout, builder, home, stats, settings) and the sync queue into their own files. They share the signed-in user's state, so that needs a small state module first. Same rules: one move at a time, snapshot identical, full suite green.

**Rollback:** app → `release/v1.20.0`.

---

## 1.20.0 — 2026-11-24 · Less scrolling while you log (audit U4)

- **Finished exercises fold to one line** once you move on to the next exercise: "✓ 3/3 sets · best 70×11 · Show sets". The one you just finished stays open, so you can still fix a set. Your exercise and muscle ratings stay visible on the folded card. **Show sets** opens it again, and a card you've opened stays open. Finished exercises are also folded when you reopen a workout.
- **Next set bar** above the tabs shows the next unfinished set (exercise, set number, weight × reps):
  - **✓ Log** logs it through that set's own ✓, so it uses the same save path, rules and offline queue;
  - **Go to** scrolls to the set and puts the cursor on its weight.
  - It moves on as you go, and it never shows on a preview or a finished day.
  - The page leaves room for it, so Finish is never hidden.
- Display only: no change to data, rules or the database.
- Tests: `workout200.py` (19 checks); every existing workout, offline, rating and accessibility suite passes unchanged.

**Rollback:** app → `release/v1.19.0`.
## Ops — 2026-11-24 · Backups include app feedback

- `backup.take_snapshot()` (so the weekly Drive backups too) now includes `app_feedback`; the restore scripts (`restore_user_from_snapshot.sql`, `load_backup_file.mjs`) know the table.
- The restore drill now also proves the early-light-week columns (`superseded_at`, `revision`, `light_week_undo`) and app feedback come back exactly.
- Migration `20261124060000_snapshot_app_feedback` (function only, no data change). **Applied to production 2026-11-24 05:55 UTC with the owner's approval**; the first snapshot after it has 12 tables. App unchanged.

**Rollback:** re-run the previous definition from `20261121230000_exercise_feedback.sql` (snapshots then skip `app_feedback`).

---

## 1.19.0 — 2026-11-24 · Workout summary, easier first setup, and two fixes (week numbers, reloading)

- **After Finish, a summary (U5)** shows:
  - sets done vs planned, exercises, and how many lifts beat last time;
  - each lift's best set next to last time's, with ▲ ▬ ▼ (an estimate, compared only when reps are similar; "·" when there's no fair comparison);
  - per-muscle performance, and what happens next: you rate recovery next time, and nothing changes from one session alone;
  - an honest sync line ("Saved and synced", or "Saved on this phone — keep the app open");
  - one next step: the next workout, or the finished meso.
- **First setup (U3).**
  - A new user's Home shows a welcome card: what a meso is, the three-step loop, and **Build my first plan**.
  - The builder asks **Experience** (New / Some / Experienced). It only picks the starting effort style (Conservative / Main lifts ≥1 / Standard), and an effort style you picked yourself always wins.
  - Effort is tucked under **Advanced** unless you're experienced or have changed it.
  - The builder shows your equipment, with a link to change it.
- **Fixed: Home's "Sets this week" didn't line up with "Workouts this week".** Workouts counted the meso's training week; sets counted the calendar week (Mon–Sun). With a meso running, both cards now read **· week N** for the same training week, and sets show done/planned (tap → that week's workouts). Without a meso, the calendar week is used as before.
- **Fixed: the app redrew ("reloaded") a lot.** The sign-in library re-announces "signed in" when the app comes back into view and when it refreshes its session, and every one redrew the whole screen, mid-workout included. Now it redraws only when the signed-in person actually changes.
- Tests: `ux190.py` (24 checks); the builder tests open Advanced where they test effort; `design1.py` ignores buttons in closed sections.

**Rollback:** app → `release/v1.18.0`. No database change.

---

## 1.18.0 — 2026-11-24 · Smarter stall detection and fatigue signals (audit PR-B: T1–T5)

- **Stalls follow the muscle, in the order you trained (T1).** "Twice in a row" now means this muscle's last two sessions on *any* day, not the same weekday slot. An improvement on any day resets the count.
- **Like-with-like comparisons only (T3).**
  - A lift's performance is compared only with the same lift's last session when the best sets are within 5 reps. Otherwise it's "no comparison", which never counts as a stall.
  - One lift up and another down gives the muscle no rating (mixed signals); before, it counted as flat.
- **Joint pain isn't fatigue (T2).** The early-light-week suggestion now needs *widespread* signs (very sore, or lifting less with slow recovery, across muscles, two weeks running).
  - Joint pain stays with that exercise (swap or lighten it), and the card mentions it separately. Pain rated "a lot" adds that it's worth getting checked; no diagnosis is made.
  - One very sore muscle is left to that muscle's own set reduction.
- **Indirect estimates (T4):** unknown or mismatched exercise names give no credit ("unknown"). Tests confirm estimates at any fraction never change the plan.
- **Simulation (T5):** 10 lifter profiles × 3 priorities × 8 weeks run through the set rules. There's no add without a repeated stall and good recovery, no add for an improving lifter, at most one add every other week, and none for Maintain.
- Docs: training-logic §5 explains the progression unit, comparability, the fatigue split, and which numbers are heuristics.

**Rollback:** app → `release/v1.17.1`. No database change.

---

## 1.17.1 — 2026-11-24 · Early light week: preview, nothing deleted, undo (audit D1–D3)

From the OpenAI v1.17.0 delta audit's top findings.
- **Preview before anything changes:** the confirm screen is built by the server and shows:
  - the meso length before → after, and the light week's workouts;
  - the later workouts that will be hidden;
  - the done/skipped/unfinished count for earlier weeks;
  - a warning to let other phones or tabs sync first (this phone can only check its own).
  If earlier workouts aren't finished, it says this ends the meso early rather than adding a recovery week.
- **Nothing is deleted any more.** Later planned workouts are hidden, so a set logged on another phone before it synced still lands and is kept. Home and the meso page then say so: **Restore the full meso** or **Keep the light week**.
- **Undo:** the meso page has **Undo the early light week** until you log in the light week. It restores the exact length, workouts and targets.
- **Stale requests are refused, not guessed.** The request carries the preview's revision; a double tap, a second tab or a retry after a timeout gets "changed — nothing was changed".
- **Timeouts:** if the signal drops after the server applied it, the app re-checks and says it went through.
- **Hidden workouts:** opened from an old link, they're read-only, with an explanation.
- **Database:** migration `20261124010000_light_week_revisions` (expand-only: two columns, one flag column, three functions; `start_light_week` no longer deletes). Rollback script: `supabase/ops/rollback_20261124010000_light_week_revisions.sql`.
- **Tests:**
  - `test/pg.concurrency.mjs` races two connections on **real PostgreSQL** (double request, set on a hidden day, a day finished in another tab, a refused request), and now runs in CI.
  - DB: preview counts, stale/duplicate refused with every row unchanged, nothing deleted, late sets kept, exact undo.
  - `integrity171.py` (25 checks, mock server, including two isolated browser contexts with one offline).

**Rollback:** run the rollback script's step 1 (undo any early light weeks), then app → `release/v1.17.0`.

---

## 1.17.0 — 2026-11-23 · The three remaining audit items

- **Light week early, when your ratings suggest it (T4).**
  - From week 3, if two or more muscles show fatigue (still sore, joint pain, or performance down with slow recovery) and it also showed the week before, Home asks **"Signs of fatigue — light week now?"** with the reason. Your choices are **Take the light week now** and **Not now**.
  - The meso page also has **Take the light week early (week N)**.
  - Taking it makes the first untouched week a light week (half the sets, easy effort) and ends the meso after it. Later unstarted weeks are removed; logged work is never touched.
  - Needs migration `20261124000000_start_light_week` (one owner-only function). Until it's applied, the button says a small update is needed.
- **Estimated indirect sets (T9).** Builder step 2 has **Show estimated indirect sets** (off by default), showing "+N" next to each muscle: ½ a set from each compound lift that also works it. It's labelled as an estimate, and targets and colours still use direct sets only.
- **Goals (T10).**
  - Strength is now **General strength**, and athletic is **Athleticism (experimental)**, with an explanation (shown as "Athletic*" on the button).
  - In week 1 of a new meso, if your last sets were in a clearly different rep range, suggestions stay inside the new range and the note says what weight would match your last effort. Automatic increases are still capped at +5 lb.
- Tests: engine (fatigue cases, indirect fixtures and fractions, goal checks and transitions), DB (`start_light_week`: owner only, first untouched week, half sets, logged work kept), and `audit170.py` (15 checks).

**Rollback:** app → `release/v1.16.0`. The function can stay; older versions never call it.

---

## 1.16.0 — 2026-11-23 · Training logic: audit changes (approved by the owner)

From the OpenAI audit's training-engine findings. **Mesos already running keep their sets, RIR and exercises.** What changes: how they adjust from now on (sets), and new mesos (templates, effort style, the Maintain suggestion).
- **Sets are added only after a repeated stall (T3).**
  - One flat session no longer adds a set. Performance must be flat or down two sessions in a row, with good recovery and workload.
  - +2 (Emphasize only) needs three in a row.
  - Sets are held while you're improving, when there's nothing to compare, and for a week after an increase.
  - Zero soreness or a low pump never adds sets on their own.
- **Once-a-week templates are back (T1).** Twice a week is still ranked first and is "fits best"; 1× set-ups (e.g. 3-day Push/Pull/Legs) are listed after, labelled "Once a week: …". The template list grows from 84 to 98.
- **Effort style (T4).** The builder's "keep main lifts ≥1" switch becomes three choices:
  - **Standard**: the RP-style ramp.
  - **Main lifts ≥1**: what the old switch did.
  - **Conservative**: main lifts ≥2 reps short, everything else ≥1.
  - The preview shows both schedules. Your choice is remembered on this phone. Added exercises follow the meso's style.
- **Grow → Maintain is now a suggestion you accept (T7)**, with **Move to Maintain** / **Keep as Grow**. Before, it was done for you.
- **Docs:** training-logic §2.5 (effort styles, the Maintain suggestion) and §2.6 (which numbers are evidence vs product rules). The §5 table now has the stall rules. "+5%" is described as "up to ~5%, except one unavoidable step" (T5). Estimated strength is described as a noisy performance proxy (T6).
- Not changed (yet): the final light week is still planned every meso (making it trend-triggered needs a schema change), and there's no fractional indirect-set accounting (T9). Strength and athletic goals keep their current rules (T10).
- Tests: engine (stalls, cooldown, simulated 6-week run with no oscillation, 1× ranking, effort floors, demotion off by default in the builder) and `logic160.py` (9 checks).

**Rollback:** app → `release/v1.15.1`. Nothing in the database changes.

---

## 1.15.1 — 2026-11-23 · Audit safety & reliability fixes

From the OpenAI audit of 1.14.0: the four "fix first" items. Training numbers are unchanged.
- **Injury areas are never quietly overridden (audit S1/T8).**
  - If your areas remove every exercise for a muscle, the builder now asks: **OK** one (machines and cables first) or **leave the muscle out**. Before, it put the machine and cable options back on its own.
  - An area now beats a starred favorite. Only an explicit OK lets one through.
  - OKs are saved to your account and listed in Settings → Injuries & sore spots under **OK'd anyway**, each with **Take back**.
- **Offline saves can't look safe when they aren't (audit S1, storage).**
  - If the phone refuses to keep the offline copy (storage full, blocked, private mode), the app keeps it in memory for this session.
  - It then says plainly to keep the app open until it syncs. The sync badge turns amber and reads "NOT saved on this phone".
  - It no longer shows "saved on your phone" in that case. Everything still syncs when the signal returns.
- **Popups work with a keyboard and screen readers (audit S4/S5).**
  - Every sheet is now a labelled modal dialog and the page behind it can't be reached.
  - Focus moves into the sheet and Tab stays inside it. Escape closes it, and focus goes back to the button that opened it.
  - Required questions, like the rating after a muscle's last set, can't be dismissed with Escape.
- **CI can't show a false green (audit S3/S4).**
  - Every browser test now exits non-zero on failure, and the workflow goes by exit codes rather than the last line of output.
  - Logs are kept as a build artifact for 14 days.
  - Test tools are pinned: `test/package.json` + `package-lock.json` (`npm ci`) and `test/requirements.txt`.
  - Checked with a deliberately failing test, which fails the run.
- New test: `safety151.py` (18 checks). The engine tests now cover "no restricted exercise without an OK".

**Rollback:** app → `release/v1.15.0`. OK tags (`allow:…`) are ignored by older versions.

---

## 1.15.0 — 2026-11-23 · Add an exercise mid-meso, send feedback, RIR dropdown fix

- **Add an exercise during a meso.** Every open workout now has **+ Add an exercise** above Finish.
  - Pick a muscle and an exercise, then choose the sets (1–5).
  - Choose where it goes: **Just today**, or **Today and every later week** of the same day.
  - The list skips exercises already in today's workout, ones you've excluded, ones that don't fit your equipment, and ones for injury areas you've turned on.
  - Effort follows the meso's week, including the "main lifts ≥1 rep short of failure" choice. Light weeks get half the sets.
  - It starts fresh: you pick the weight the first time, then it progresses like the rest.
- **Remove an exercise from today.** The Replace sheet now has **Remove … from today**, shown only when that exercise has no logged sets. Later weeks keep the exercise.
- **Send feedback** (More → Send feedback):
  - A 1–5 star rating and/or a note, tagged Idea, Something's wrong, Praise or Other.
  - Saved privately with the app version and the screen you came from. You see your own past notes; the owner reads them in the database.
  - This needs the new `app_feedback` table (migration `20261123220000_app_feedback`). Until it's applied, the screen says feedback isn't switched on yet.
- **RIR dropdown:** the "Set 1 reps left" number no longer sits on top of the dropdown arrow.

**Rollback:** app → `release/v1.14.1`. The `app_feedback` table can stay; 1.14.1 never reads it.

---

## 1.14.1 — 2026-11-23 · Injuries in the meso builder; chest, arms, legs and abs

- **The builder asks "Any injuries or sore spots?"**
  - **No** is the default and skips it.
  - **Yes** shows the areas right there. Picks are saved to your account, so Settings matches and you can change them any time. The plan adjusts straight away.
  - If areas are already saved, the question starts on **Yes** and shows them.
  - Tapping **No** while areas are on asks before turning them all off.
- **Four broader areas:** **Chest, Arms, Legs, Abs**, for a strained muscle rather than a sore joint. That's **11 areas**, listed head to toe:
  - Chest drops barbell bench, dips, deep dumbbell flyes and deficit push-ups; machines and cables stay.
  - Arms drops heavy barbell and preacher curls, chin-ups, skull crushers, close-grip bench and dips.
  - Legs drops heavy free-weight leg work (barbell squats, deadlifts, lunges, split squats, step-ups, jumps, sprints); leg machines stay.
  - Abs drops sit-ups, hanging raises, ab wheel and loaded crunches; planks, dead bugs and Pallof presses stay.
- **Easier to find:** Injuries & sore spots is now near the top of Settings, and More → Settings mentions it.
- The same rules still apply: gentler options stay, no muscle is left empty, and favorites are always kept.

**Rollback:** app → `release/v1.14.0`. The new tags (`area:chest|arms|legs|abs`) are ignored by 1.14.0.

---

## 1.14.0 — 2026-11-23 · Injuries & sore spots

**Settings → Injuries & sore spots**
- **7 general areas, saved the moment you tap:** neck, shoulders, elbows & wrists, upper back, lower back, hips and knees.
- New mesos and swap suggestions **leave out the exercises that load a picked area the most** and keep gentler ones. For example, Knees drops squats, lunges and jumps but keeps leg press and leg extension.
- A muscle is never left with nothing; machine and cable options are kept if needed.
- Favorites always stay, and you can still add anything by hand.
- Each area shows how many exercises it leaves out, with a list. The builder says which areas it's going easy on, and the library marks exercises that load an area you picked.
- **"Avoid heavy spinal loading" is now Lower back.** It's stored the same way, so the old setting carries over.

**Fixes**
- **"Can't click Avoid heavy spinal loading":** it did change, but since 1.13.0 every checkbox and switch looked the same on and off. Switches now look like switches (green when on), checkboxes show their tick, and equipment chips highlight when picked. Screen readers announce switches as on/off.
- Library: the ⊘ button now says **Never** and the star says **Favorite**. The icon alone read as an "x".
- Saving profile details or equipment kept the rest of your profile in the app (before, a save could briefly drop other settings until the next reload).

**Underneath:** `BODY_AREAS`, `exerciseAreas`, `avoidedAreas` and area-aware `applyPreferences` in logic.js. Engine tests cover 7 areas × 13 muscles on the shared library, plus favorites, the "never empty" rule and a full build. New browser test `injuries140.py`. No database change.

**Rollback:** app → `release/v1.13.1`. Area tags left in `avoid_tags` are ignored by older versions, except `axial`, which they already understood.

---

## 1.13.1 — 2026-11-23 · Dark ↔ Normal in one tap, accessibility pass

**Dark / Normal switch**
- A sun or moon button at the top of **every screen** switches between **Dark** and **Normal** (light) in one tap. The choice is saved on this phone and stays after closing the app.
- Settings → Appearance still has all three: **Match phone**, **Dark**, **Normal** ("Light" is now called Normal).

**Accessibility** (outside audit; automated axe-core WCAG 2.1 AA checks on 16 screens, in dark and light)
- Every form field has its label linked. This covers Library → new exercise, Log cardio and the Volume week picker: screen readers say the field's name, and tapping a label focuses its field.
- Chart bars are named for what they open ("Week of 11/23: 42, open details"). The numbers drawn on the chart no longer clash with that name.
- A lift's trend tip says what tapping it does ("Show the tip for …") and includes the text you see.
- Wide tables on the "How it works" page can be scrolled with a keyboard.
- No colour-contrast problems were found in either theme.
- The new test `a11y.py` fails on any serious or critical issue. CI installs axe-core, and the checker is injected only in tests (the app's security policy blocks it, as it should).

**Rollback:** app → `release/v1.13.0`. No database change.

---

## 1.13.0 — 2026-11-23 · "Foundations" (design PR 1)

*Built 2026-11-22 as 1.12.0, then rebuilt on top of 1.12.3 so every 1.12.x change is kept:*
- *the new builder now uses the design tokens;*
- *the theme-before-first-paint script moved from inline to `theme.js`, because the Content-Security-Policy blocks inline scripts;*
- *screenshots now use the de-personalised test account and live on the `pr-assets` branch, not in this public repo.*

The look-and-feel foundation for the App-Store-quality pass. No training logic, data, routes or storage keys changed.

**Brand**
- New logomark (a "W" over a barbell) and wordmark in the Home header; tagline "Lift smarter, week by week."
- New icons: 192/512 "any", 192/512 maskable (safe-zone padded), 180 Apple touch icon, SVG + 32px favicon. Branded launch screen while the app loads. Manifest gets description, categories and new colours.

**Design system** (styles.css is now layered: tokens → components)
- Every colour is a token. The 43 hard-coded hex values are gone, and so are the hex fills in SVG charts (now classes). The 46 inline `style=""` attributes are down to 6 that carry data (bar widths, grid column count).
- Semantic tokens (`--surface-1/2/3`, `--border`, `--focus`, `--pr`, `--dip`, `--on-track`, status colours), a spacing scale (4/8/12/16/24/32), a radius scale and two elevation levels (cards have a subtle shadow and inner highlight).
- Type: 12 different sizes became a 6-step scale (13/14/16/18/22/28). Nothing is under 13px, and every number uses tabular figures; key numbers are bold. System font (SF Pro on iPhone), no webfont.
- **Light theme** (ADDITIVE): follows the phone by default. Settings → Appearance → Match phone / Dark / Light, saved on this phone (`wl_theme`), applied before first paint so there's no flash.

**Icons**
- About 60 emoji used as icons became one consistent line-icon set (24px, 1.75 stroke), including the 👋 greeting, 🏆 PRs, ⓘ, ⇄, ★/☆/⦸, the 🔥 warm-up and the tab bar. Icon-only buttons have labels and ≥44px tap areas.

**Motion** (ADDITIVE; switched off when the phone asks for reduced motion)
- 150–250ms: screens fade/rise in, sheets slide up, buttons press, the set check pops, PR badges glow once.
- Haptic tick on set completion where the phone supports it (Android; iPhone Safari has no vibration API).

**Bugs fixed**
- Home charts: the tallest bar's number was clipped. A cardio session saved without minutes made the whole cardio chart blank (NaN).
- Home stat tiles had uneven heights and misaligned labels.
- Library: a misplaced closing tag put only the first exercise inside the card. Every other row fell outside it with its buttons wrapped underneath.
- *(This PR's `?v=` fix already shipped in 1.11.1.)*

**Tests**
- New `test/e2e/design1.py`, run on 12 screens: no emoji icons, no text under 13px, every icon-only button labelled, 44px tap targets, chart labels not clipped and no NaN bars, equal stat tiles, every library row inside its card, theme picker applies and is remembered.
- `test/e2e/shots.py` captures 5 screens × phone/desktop × dark/light for before/after reviews (kept on the `pr-assets` branch, never in `main`).

---

**Rollback:** app → `release/v1.12.3`. Nothing changed in the database. The only new phone setting is `wl_theme`, which older versions ignore.

---

## 1.12.3 — 2026-11-23 · Finish a workout with no signal (outside audit, finding 3)

*(This entry was added in 1.13.0; it was left out of the 1.12.3 commit by mistake.)*

**What changed for you**
- **Rating with no signal:** exercise and muscle ratings, including ✓ All normal, are saved on your phone and show as rated straight away. You're not asked again after a reload.
- **Finishing with no signal:** finishing works from what's on your phone:
  - the sets as loaded;
  - every edit made since;
  - anything still waiting.

  It says "Workout saved on your phone — it syncs when you're back online". Home and the meso already treat that workout as done.
- **Syncing by itself:** everything goes out when the signal is back, in order, sets first, then ratings, then the finish. The badge shows what's waiting ("1 set + 2 changes waiting to sync").
- **Fix:** the sync badge could cover the **Finish workout** button. The page now leaves room under it.

**Underneath**
- A second phone queue (`wl_pending_ops_v1:<user>`) holds ratings and finish changes in order, each one written before it's sent. Every change is idempotent (an upsert on its natural key, or an update to fixed values), so a retry can't apply it twice.
- The account is fixed per change. Refused changes are kept aside with a message, never silently dropped.
- Still online-only: the recovery questions at the *start* of the next workout, because they change next week's sets on the server.
- Tests: `offline123.py` covers rating with no signal, a reload, finishing with no signal, sync order, and nothing left waiting. It fails on 1.12.2.
- No database change.

**Rollback:** app → `release/v1.12.2`.

---

## 1.12.2 — 2026-11-23 · Suggested follows your running meso

- **Fix (found checking 1.12.1 live):** Suggested could carry on from an older imported meso instead of the one you're running. Imported mesos share one creation time, so the running one could fall outside the 10 newest the app looked at.
- Now the running (or planned) meso is read directly. Only when there isn't one does it fall back to the most recent meso that wasn't abandoned.
- **Test:** `builder120.py` adds 12 imports with the same time plus the running meso. It fails on 1.12.1 and passes now. The test mock now honours status filters and limits for mesos.

**Rollback:** app → `release/v1.12.1`. No database change.

---

## 1.12.1 — 2026-11-23 · "Harder to break" (security fixes from the outside audit)

**Set saving can't go stale** (audit finding 2)
- **The bug:** if an old offline copy of a set was being retried while you edited the same set, the old value could reach the server last and overwrite your edit. A browser test reproduces it on 1.12.0: the server ended with 70 lb after an edit to 75.
- **Now:**
  - every edit is stored on the phone, with a version, before it is sent;
  - saves for the same set go out one at a time, in order;
  - a save only clears the phone copy if no newer edit came in meanwhile.
- Switching accounts mid-save never touches the other account's queue.
- A set the server refuses for good is kept aside instead of being dropped.
- The "waiting to sync" badge no longer flashes during normal saves.

**Feedback adjustments only change what they're allowed to** (audit finding 1; database migration `20261123050000_feedback_adjustment_scope`)
- `apply_feedback_adjustment` now checks every row it is asked to change:
  - only the same muscle's exercises, on next week's same day, while that day is open;
  - the deload day only right after the last hard week;
  - known fields only, within the table's limits.
- Anything else rejects the whole call and changes nothing. It could never reach another account before; now it can't touch unrelated workouts in your own account either.
- The app no longer asks to adjust a next-week day you skipped.

**Browser security** (audit findings 4 and 6)
- The Supabase library is pinned to one reviewed release (2.119.2) instead of "latest 2.x".
- A Content-Security-Policy allows only:
  - this site;
  - jsDelivr (for that library);
  - this app's Supabase project.
- A focused check of every HTML template found no unescaped user text.

**Tests**
- `sync121.py`: slow and out-of-order responses, offline then online, two quick offline edits. It fails on 1.12.0 and passes now.
- Database: 9 refused-change cases plus the deload, finished-day and skipped-day cases; refused calls change nothing.
- Builder and workout browser tests fail on any security-policy violation.

**Rollback:** app → `release/v1.12.0` (Playbook §6). Database: re-run the previous function definition from `20261121070000_atomic_feedback_adjustment.sql`. Its signature is unchanged and no data is migrated.

---

## 1.12.0 — 2026-11-23 · "Building a meso, made clear"

**New mesocycle screen**
- **Three short steps.**
  1. *Your week*: days, time and goal, as big buttons instead of drop-downs.
  2. *Start from*: Suggested, Templates or From scratch.
  3. *Name & length.*

  Only the options for the start you picked are shown, so the screen is much shorter.
- **It's obvious what you picked.** A chosen option is filled in and carries a ✓; the others stay plain.
- **Suggested (the default, one tap).** It uses the best-fitting split for your days and carries on from your current or last meso: the same muscle choices, or the same focus for imported mesos. It explains why in plain words. "Start fresh (Balanced)" ignores the last meso. Time per workout is still applied on the next screen, with the usual notes.
- **A template library: 84 set-ups.** Seven focuses × every split that fits your days, so 14–21 show for any number of days.
  - The focuses: Balanced, Upper body, Lower body, Glutes & hamstrings, Chest & back, Shoulders and Arms.
  - Filter by focus. Each card shows what it emphasizes and your week, day by day.
  - Set-ups that would train a growing muscle only once a week are left out; they are still available From scratch.
- **Changing days keeps your template** when the same focus fits the new days, and clears it, with the Next button waiting, when it doesn't.
- **Name filled in for you** (e.g. "Arms · 4 days"); type over it if you like.
- **Adjusting a muscle** labels the plan "(adjusted)", so you can tell it's no longer the plain template.
- **Library → Templates** shows the same library, filtered by days. Tapping one opens the builder with it already chosen. Your saved templates are unchanged.

**Underneath**
- logic.js: `FOCI`, `presetPriorities`, `matchPreset`, `templateCatalog`, `templateById`, `suggestPlan`, `lastMesoFor`, `daysForMuscle`. The old template ids (`whole`, `upper`, `lower`, `custom`) give exactly the same priorities as before.
- No database change: the meso's saved focus stays one of the four allowed values. The per-muscle choices are saved as before.
- Tests:
  - logic: every template × goal × time (756 builds). Growing muscles are trained 2× a week, Maintain is never 0, and emphasized muscles are never moved.
  - New browser test: `builder120.py`. Older builder tests updated for the new buttons.
- `?v=36`.

**Rollback:** point main back to `release/v1.11.5` (Playbook §6). There is nothing to undo in the database.

---

## 1.11.5 — 2026-11-23 · "3 days a week, maximized"

**Building a meso when time is short**
- Checked every builder setup from 2 to 6 days, for each goal, template and workout length (630 combinations). Muscles you grow were already trained 2× a week, but short workouts spread volume too thin. Example, 3 days × 60 min, Balanced hypertrophy: chest and back got **4 of 8** weekly sets, and abs, traps and forearms got **none**.
- **Now the builder concentrates instead of spreading.** If a muscle you grow would fall below a growth level (large 6+, smaller 4+ sets a week), the smallest Grow muscles (calves, then biceps, triceps, shoulders) move to Maintain. A note explains why, and you can change it.
  - **Example result:** the same 3 × 60 min plan now gives the big muscles 6–7 sets a week.
  - Emphasize and large muscles are never moved automatically.
- **Maintain never means zero:** at least 1 set a week, even when time is short.
- **Fairer trimming:** sets come off the muscle with the most room above its growth level, smaller muscles first.
- **Plain warning** when something still can't grow in the time (e.g. 45-minute workouts, or legs once a week on 3-day Push/Pull/Legs).
- Raising the time or adding a day and rebuilding puts moved muscles back to Grow. Your own priority choices always win.

**Underneath**
- `logic.js`: `fitPlan`, `GROW_FLOOR`, `MAINTAIN_WEEK_MIN`; `fitToTime` keeps the Maintain floor and trims fairly.
- Tests: all 630 builder combinations checked for 2×/week, Maintain ≥ 1, Emphasize untouched, only small Grow muscles moved, and no shortfall for the usual 3-day setup at 60–90 min. New e2e `builder115.py`.
- No database changes. Existing mesos are untouched; this only affects building a new meso. `?v=35`.

**Rollback:** tier A (affects only new plans being built) — `git revert -m 1` the merge, bump `?v=`.

---

## 1.11.4 — 2026-11-23 · "How it works, inside the app"

- **The training rules and evidence are now a page inside the app** (Learn → "How it works", also from More and Settings). It's built from this repo's `docs/training-logic.md`, with contents links that jump to each section.
- **The app no longer links to Google Drive.** The three "Training Logic & Evidence" links used to open a private Google Doc. The page is now served by the app itself, from content that holds no personal information (1.11.3).
- Underneath: new `md.js`, a small Markdown renderer that escapes every character before formatting, so the page can't inject markup. Links are allowed only to web addresses, in-app routes and section anchors (no `javascript:` or `data:` links). `test/privacy.check.mjs` now also fails if any app file links to Google Drive/Docs. New e2e `logic114.py`; renderer safety tests in `logic.test.mjs`.
- No database changes. `?v=34`.

**Rollback:** tier A (display only) — `git revert -m 1` the merge, bump `?v=`.

---

## 1.11.3 — 2026-11-23 · "Nothing personal in the public repo"

The code repository is public (it hosts the live app), so it now holds **no personal information**: no names of the people using the app or anyone else, no email addresses or account names, no health notes, no locations, and no personal training logs attributed to anyone. All of that lives only in the private Google Drive folder.

- Docs (Start Here, Training Logic, Playbook, this changelog): people's names → "the owner" / "a second user"; account and email line, health preference line and raw-export file names removed (kept in the private Drive copy); real meso names → "Meso A / B"; times of day and local time zone removed.
- Code comments, the new-meso name placeholder and test data: neutral names (`Alex`, `alex@example.com`, "Whole Body Meso A").
- New `test/privacy.check.mjs`: fails if any real email address or random user/set id appears in a tracked file. Runs with every release (Playbook §4).
- Playbook §1.8: the public-repo rule.
- No behavior change. `?v=33`.

**Rollback:** tier A (text only) — `git revert -m 1` the merge, bump `?v=`.

**Note:** this cleans the current files. Earlier versions of these files are still in the repository's git history; see the Start Here doc for the options.

---

## 1.11.2 — 2026-11-23 · "Percentages only where they mean something"

**Progress screen (More → Progress)**
- Two views. **This meso** (default) lists only lifts in your current meso, with the change from **week 1 to your latest week of this meso**, measured on what you actually lifted (the same measure as the workout screen and the status badges). Light weeks are left out; a lift done only one week says so instead of showing a number.
- **All time** lists every lift with how many sessions you've logged and **when you last did it**. It has **no +/− percentages**, and lifts not trained in 8+ weeks are greyed.
- **Before:** one list with a percentage per lift = latest session vs. the very first session ever logged, with no time limit and a different measure (estimated strength with reps-in-reserve credit). A lift last done months ago could show "+37%" as if it were current.

**One lift's page**
- A lift **not in your current meso** shows "Not in this meso · last done <date>" instead of a status badge (which could be months old), and the chart's headline shows **last done** instead of a % change. Lifts in your meso are unchanged.

**Underneath**
- `logic.js`: `mesoChange(entries, mesoId)`, `isStale(lastAt)` (8 weeks, `STALE_DAYS`). "In this meso" uses the same rule as Home's "This meso's lifts" (the lift is planned in the meso), not start dates.
- Tests: logic tests for both helpers; new e2e `progress112.py` (both views, no % on All time, greyed stale lift, "Not in this meso" page, % since week 1).
- No database changes. `?v=32`.

**Rollback:** tier A (display only, writes nothing) — `git revert -m 1` the merge, bump `?v=`.

---

## 1.11.1 — 2026-11-22 · "Checked against RP"

A second user's week 3 (their current meso) run through our engine and compared set by set with what RP recommends for the same sets, plus the progression findings from the outside audit. RP's numbers were used only to find our bugs — nothing of RP's is copied.

**What the comparison showed (39 sets)**
- 23 sets: identical weight and reps.
- Machines/cables (hip abduction, row, calf raise): we add one small step (+2.5 lb) at the same reps; RP shows a window around last week's weight. Same effort either way (+2.5 lb ≈ one rep in reserve) — kept.
- Leg press, pulldown: RP held reps where we add one. RP's call almost certainly uses the user's in-app soreness/pump ratings, which aren't in the export; with no ratings ours progresses normally — kept.
- Deadlift and light lifts: **real bugs on our side**, fixed below.

**Fixes**
- **Capped weight now gets matching reps.** Deadlift 95×12 → was 97.5×**8** (a re-set toward the 3–8 range, capped, kept the low reps — much easier than last week) → now **97.5×12**.
- **Light loads don't get a too-big step at the same reps.** Dumbbell row 45×12 → was 50×12 (+11% load and a lower RIR) → now **50×9**. Rounding noise keeps the reps (60×7, not 60×6).
- **Weight window includes the reps you actually work at** (deadlift for 12: 95–122.5, not 107.5–122.5). Single-weight windows ("5–5 lb") are hidden.
- **Missing data is not a plateau** (audit A). Grow muscles hold sets until there's a performance comparison; +2 sets needs a rated pump and a performance comparison.
- **Templates respect the 3-muscle emphasis limit** (audit B). Upper focus: emphasize chest, back, shoulders; arms grow. Lower focus: emphasize quads, hamstrings, glutes; calves grow. Existing mesos keep their stored priorities.
- **All normal is one tap** (audit D). Pump is optional and saved as *not rated* if skipped — never a made-up value.

**Underneath**
- `suggestSet` re-solves reps after a cap; the load-step and over-range paths check reps with `repsAtLoad` (now also returns `raw`); `weightRange` widens to last week's reps; `setAdjustment` rule 11; `TEMPLATE_EMPHASIS`.
- New tests: regression tests for each fix, and a **longitudinal simulation** — 10 lifter profiles × 5 lifts × 6 weeks, 1,200 invariant checks (weekly cap, meso ceiling, rep jump ≤ 2, weekly demand ≤ +8%, heavier-with-fewer-reps only when equivalent, holds never add weight, deload never heavier).
- No database changes. `?v=31`.
- New: `docs/PLAYBOOK.md` (release & rollback playbook), `supabase/ops/restore_user_from_snapshot.sql`, `test/restore.drill.mjs` (rollback drill, passes).

**Rollback:** tier B (writes pump as *not rated*; pre-release snapshot taken) — `git revert -m 1` the merge, bump `?v=`. No database changes. Ratings saved by 1.11.1 with pump *not rated* stay valid; 1.11.0 would simply ask for pump again on those muscles (it treats a missing pump as unrated, not an error).

---

## 1.11.0 — 2026-11-22 · "Easier for anyone"

A usability pass from looking at every main screen as a first-time user, plus a more lime green.

**Fewer interruptions**
- **One rating sheet per exercise.** When an exercise is the last one for its muscle, the muscle questions are on the same sheet — a muscle trained with one exercise is now one pop-up instead of two.
- **✓ All normal**: one tap = Pretty good + no joint pain. Exercise-only sheets save immediately; combined sheets just need pump.
- Rating buttons no longer sit on every card; after you rate, a small "✓ … ✎" line shows what you picked and lets you change it. The header ✎ is gone.

**Plain language**
- "RIR" is gone from the workout, home, meso and builder screens: "2 reps short", "stop 2 reps short of failure", "to failure". The ⓘ sheet still shows "2 RIR = reps in reserve" for anyone who wants the term.
- "Deload" → "light (deload) week"; "Hard sets" → "Working sets"; set-1 picker reads "Set 1 reps left: as planned (2)"; "First time — pick a weight for 8–15 reps, stop 2 reps short of failure".
- Lift status pills: "Stalled 0.0%" → "Flat 2 wks" (neutral grey); "Down" is amber, not red.
- Mesos page explains what a mesocycle is.

**Each warning once, in one place**
- Home no longer shows the Watch list; the meso card has one line ("⚠ 6 things to check on this meso ›"). The full list ("Things to check") is only on the meso page.
- Workout "Heads up" shows only how today's muscles recovered (soreness, joint pain, workload), collapsed to one line you can tap open. Missed sets from earlier weeks are no longer repeated there.
- Each lift has **one coach note**: this week's plan, plus a trend line only when it needs attention (tap for the tip). The 📌 all-time-best reference moved into ⓘ.

**First set sooner, easier to read**
- Exercise card header is one line: "Chest · 3 × 8–15 reps · 2 reps short". How the lift progresses and the weight window moved into ⓘ.
- Last week's numbers / first-time hint get their own line under the set buttons (no more squeezed column).
- Small text is larger (13–14 px) and lighter grey for gym lighting. Empty weight boxes say "weight", not "lb".

**Builder, navigation, small things**
- "Adjust muscles" (Emphasize / Grow / Maintain / Skip) is collapsed and optional, with a plain explanation of each; it opens automatically for Custom.
- Home charts explain themselves when empty; the all-time numbers have an "All time" heading.
- Tab bar uses matching line icons; **Explore is now "More"** (Learn, History, Progress, Volume, Cardio, Settings) — Library and Mesos are no longer duplicated there.
- "Delete this mesocycle…" moved away from "Mark complete" to the bottom of the page.
- Accent green is now a brighter lime (#9be33c).

---

## 1.10.0 — 2026-11-21 · "Rate each exercise"

**Per-exercise feedback, plus the muscle rating**
- After the last set of **each exercise**, rate that exercise's **workload** and **joint pain**. After the last exercise for a muscle, rate the **muscle as a whole** (pump, workload, joint pain) as before; recovery is still asked at the next session.
- **Each lift's progression now uses its own rating, capped by the muscle's:**
  - joint pain or "Too much" on an exercise holds **that lift only**, with a note suggesting a swap;
  - "Pushed my limit" on an exercise slows that lift;
  - muscle "Too much" still holds every lift for that muscle; muscle joint pain that came from a *different* exercise now slows the pain-free lifts instead of holding them;
  - faster (+10 lb max) only when the exercise **and** the muscle were Easy, the muscle never got sore, and there was no joint pain.
- Set counts still come from the muscle rating.
- The muscle sheet shows each exercise's rating next to its progression badge; with one exercise, workload and joints start pre-filled from it.
- Finish asks for any missing exercise rating first. Replacing an exercise clears its rating along with its sets.
- Sessions from before 1.10 (no exercise ratings) keep using the muscle rating alone.

**Underneath**
- New table `exercise_feedback` (one row per workout exercise; RLS own rows; deleted with the exercise) and added to the weekly backup snapshot (with `exercise_prefs`, which was missing). Migration `20261121230000_exercise_feedback`.
- New `liftSpeed(exerciseFb, muscleFb)` in logic.js. If the table isn't there, the app hides exercise ratings and works as 1.9.1.

---

## 1.9.1 — 2026-11-21 · "Small steps, always"

- **Every automatic weight increase is at most +5 lb (2.5 kg) a week, for every exercise** — usually 2.5 or 5 lb. This now covers every path that could add weight: a two-RIR drop in one week (was 2 × step), far-above-range re-solves, and passing the top of the rep range.
- **Faster progression needs two signals:** workload **Easy** *and* recovery **Never got sore** (plus no joint pain). Only then may a raise be +10 lb (5 kg), still inside +5%. "Easy" alone now gives a normal step.
- **Manual bumps are fine:** typing more than the automatic limit saves normally and shows a "Manual bump" note with where auto increases stop (replaces the "Big jump" toast).
- Exercise notes say when a raise was trimmed ("auto increases stop at +5 lb a week — go heavier by hand if you want").
- Logic: new `safeMax()` shared by suggestions and the warning; `progressionSpeed` checks `soreness === 0`. No database changes.

---

## 1.9.0 — 2026-11-21 · "Training engine"

**Weight steps — "less is more", from your history**
- Analysed 2,376 week-to-week changes in your logs: weight jumps of **≤4% kept your reps 94–97%** of the time; **above 4% only 27–39%**.
- A progression step is now **about 2.5% of the load, rounded down, at most 5 lb (2.5 kg)** and never more than your usual jump. Sled 315 → **320** (was 325); pec dec 185 → **187.5**; leg press 295 → 300.
- Default smallest jumps **2.5 lb** (1.25 kg); dumbbells 5 lb (2 kg). **Settings → Smallest weight jumps** lets you match your gym.
- Weekly cap tightened from +10% to **+5%**. Light loads (one step > ~5%) progress by reps first.
- Weight-vs-reps is decided from several signals (the meso's pattern, room in the rep range, load size), not one past change.

**Muscle priorities: Emphasize / Grow / Maintain / Skip** (replaces Focus)
- Emphasize grows sets when recovery is good; **Grow** holds sets when performance is improving and adds one only when it stalls; Maintain never adds. Warning when more than 3 muscles are emphasized.
- **Weekly per-muscle limit:** at most +2 sets per muscle per week across all sessions.
- **Every set change explains itself** ("Chest: kept at 10 weekly sets — performance improved and recovery was good, so no extra volume is needed yet").

**Workouts fit your time**
- Builder asks **time per workout**; each day shows estimated minutes; long days are trimmed lowest-priority first and the builder lists what was trimmed. No muscle over 10 sets in a session. (A 2-day full-body plan went from 38/35 sets to ~17/18 at 60 min.)

**Replace an exercise mid-meso** — ⇄ on any exercise: **just today**, or **today and every later week** of that day.

**Optional actual RIR** — "set 1 RIR" under each exercise; left on target, the app treats it as assumed, not measured.

**Builder option: keep compounds at least 1 RIR** from failure.

**Database:** the one-time, all-or-nothing recovery adjustment (`apply_feedback_adjustment`) is now live (approved 2026-11-21; verified on the live database with a rolled-back test: applied once, retry ignored).

**Tests:** every split 2–6 days × 3 templates × 60/75/90 min fits its time and caps; priority rules; weekly cap; step sizes from history; browser test for replace, RIR and the time builder.

---

## 1.8.0 — 2026-11-21 · "Pick your day + reliability"

**New**
- **Do the days of a week in any order.** Home → "Do a different day this week" lists the open days; e.g. legs today instead of back. Each day still progresses from the same day last week.
- **Preview any day.** Days in a later week open as a read-only preview ("Just look at…") — see the exercises and targets without starting it.
- **Switch days** if you opened one by mistake and haven't logged anything yet.

**Fixed (from the second external review)**
- **kg users:** the big-jump/typo warnings converted last week's weight to kg twice (e.g. compared 45 kg against ~20 kg). Fixed.
- **Finishing offline:** before scoring the workout, the app now waits for in-flight saves, syncs anything saved offline, and includes sets still waiting on the phone — feedback no longer misses logged sets.
- **Progression history:** only **finished** sets count, and when a lift appears twice a week the same day is compared (like with like).
- **Recovery set changes are now one database transaction that can only run once per rating** — a dropped connection + retry can no longer add the sets twice. *(Database update `20261121070000_atomic_feedback_adjustment` applied 2026-11-21 in 1.9.0.)*
- **Offline queue is per account** (switching accounts on one phone can't mix up sets) and sets the server refuses are kept aside instead of being dropped; network/server hiccups keep retrying.
- **Removing a set** first drops its queued offline save (it can't come back later), and keeps the row if the server didn't delete it.
- **Cardio:** a tap while a save is in progress is no longer lost.
- **Volume:** any joint pain (even "Low") limits next week's increase to +1 set (it could be +2).
- **Arrows:** fewer reps at a heavier weight shows grey, not orange, when overall performance held or improved.

**Tests:** new DB test (adjustment applied exactly once across 3 retries; partial failure rolls back; other users can't touch it) and browser tests (pick a day, preview, legacy queue migration, removing a queued set, kg warnings).

---

## 1.7.0 — 2026-11-20 · "Injury guardrails"

**New — limits on how fast weight goes up, applied to every suggestion:**
- **Weekly cap:** at most +10% over last week (ACSM recommends 2–10% increases); one step is still allowed on light loads.
- **Meso ceiling:** at most +20% over a lift's week-1 weight in the meso; after that the app adds reps instead.
- **"Faster" progression is switched off** in 0-RIR weeks, on spinal-loading (axial) lifts, and with any joint pain.
- **Reps** never jump more than +2 in a week.
- **Your own big jumps:** typing more than ~10% over last week shows "Big jump … about X is the safer max" (doesn't block).
- When a guardrail trims a suggestion, the note on the exercise says which one.

Docs: Training Logic §4.5, with 2 new sources (ACSM 2009 progression models; Gabbett 2016 on load spikes and injury).

---

## 1.6.0 — 2026-11-20 · "Feedback sets the pace"

**New — your ratings now change how fast a lift progresses (autoregulation).**
- Workload **Easy** → faster: one extra step (by-weight lifts: e.g. sled 315×27 → **335×27**, capped at ~10% of the load; by-reps lifts: row 70×11 → **70×13**).
- **Pretty good** / no rating → normal (325×27; 70×12).
- **Pushed my limit** → slower: by-weight lifts keep the weight and add a rep (315×28); by-reps lifts match last week (70×11).
- **Too much** or joint pain 2+ → hold (same as last week).
- **Pump doesn't change the load** (research doesn't support pump as a growth signal); it stays in the set/volume rules.
- Each exercise shows why, e.g. "⤴︎ This week: +20 lb, same reps — faster: last time felt easy with little pump".

**Docs:** Training Logic §4.3 (speed rules) and new §4.4 — every rule in the app graded against the research (strong / moderate / practice-based), with 3 new sources on autoregulation (Huang 2025, Mann 2010, Suchomel 2021).

---

## 1.5.0 — 2026-11-20 · "Weight or reps, like RP"

**Fixed — suggestions always added a rep, even on lifts that progress by weight.**
- Found on sled push: last week 315×27 at 1 RIR. RP had 325×28 for week 4; the app had 315 (+1 rep).
- RP-style programs move some lifts by **weight** at the same reps (machines, cables, sleds — pec dec 180×8 → 185×8) and others by **reps** at the same weight (row 70×10 → 70×11). The app now learns which one each lift uses from its last week-to-week change in the meso, and the size of the weight jump you actually took.
- Sled push week 4 now suggests **325 × 27–28** (+10 lb, same reps, one extra rep as the stretch). Row still suggests 70×12; pec dec 190×8; leg press 300×10 — matching what you did.
- With no history (week 1, nothing to carry): machines, cables and sleds start by weight; barbells, dumbbells and bodyweight by reps.
- Each exercise shows its style under the name ("progresses +10 lb" / "progresses by reps").

Docs: Training Logic §4.0.

---

## 1.4.1 — 2026-11-20 · "Orange notice every time"

**Fixed**
- **The "under last week" notice now shows on every orange set, not just the first.** When you tick ✓ on a set where reps or weight is below the same set last week (orange ▼), you get a notice each time. Example: "Set 2: Reps down vs last week (6 → 4). One set under last week is fine — rest a little longer and aim to match it next set."
- On the last set of an exercise, the set notice and the exercise summary show together (e.g. "Set 3: Reps down vs last week (6 → 5). Standing Knee Drive: ▲ up +1.2% vs last week").
- **Tap any ▲ / = / ▼ arrow** to see what it's comparing (e.g. "Reps down vs last week (6 → 4)").
- Notices no longer stack on top of each other: a new one replaces the one on screen, so a second notice can't be hidden behind the first or vanish early.

---

## 1.4.0 — 2026-11-20 · "Stalled means stalled"

**Fixed — lifts were flagged Stalled for hitting the plan.**
- In a meso the target RIR drops each week, so the plan is +1 rep (or a bit of weight) every week. The old status used a strength estimate that credits reps left in the tank, so +1 rep at 1 less RIR scored **flat** → "Stalled". On Meso B that wrongly flagged 6 lifts that were exactly on plan (bent-over row, overhead triceps extension, lying curl, preacher curl, Pallof press, pec dec).
- **Now:** inside a meso, each meso week is compared on **performance** (weight × reps, no RIR credit). Across mesos, the same meso week is compared (Meso B week 4 vs Meso A week 4). PRs still use the RIR-credited estimate.
- **Stalled** now means no gain two weeks in a row while the target got harder. **Down** = two weeks more than 3% under this meso's best. New **Dipped** = one off week (no flag). New **On track** = beat last week.
- Every status shows the comparison to last meso, e.g. "vs Meso A week 4: +1 rep at the same weight".
- Chart page: new **Performance / Strength estimate** switch (Performance is the default).
- Statuses are the same on Home, the chart page and the workout flag (one shared rule).

---

## 1.3.0 — 2026-11-20 · "Tap anything on Home"

**New — every number and chart on Home opens a drill-down:**
- **Workouts this week (e.g. 3/5)** → that meso week's workouts: each day's status (Done / In progress / Not started / Skipped), sets done vs planned, and the muscles trained. Tap a day to open it; ‹ › moves between meso weeks.
- **Sets this week** → hard sets for the Mon–Sun week, by muscle (tap a muscle to see its exercises, set count and best set; tap an exercise for its chart) and by workout. ‹ › moves between weeks.
- **Hard sets per week chart** → tap any bar to open that week the same way.
- **Cardio this week** and **each bar of the cardio chart** → minutes, load, totals by activity, and every session with day, minutes and RPE.
- **PRs this meso** → every lift with a PR this meso (how many, latest %), then the lifts without one yet, each with its status; tap for the chart.
- **Mesocycle card** and **Watch list** → the meso page.
- **Workouts finished / sets logged** → all-time totals by mesocycle (workouts and hard sets each); tap a meso to open it. **Mesocycles** → the meso list.
- Without an active meso: Recent PRs and Strength trend rows open the PR list and Progress.

---

## 1.2.0 — 2026-11-20 · "Run it again from an earlier week"

**New**
- **"↻ Run it again" lets you pick which week to restart from.** It copies the meso's plan, then asks which week's logged weights and reps the new week 1 should start from: the last working week before the deload, or up to two weeks back. Example: 7-week meso, deload in week 7 → choose week 6, 5 or 4; pick week 4 and progress again from there. "Don't carry weights" is also an option.
- The builder shows "Week 1 weights & reps start from <meso> · week N", with a button to turn it off.
- In the workout, carried weights are labelled with their source week, e.g. "last meso wk 4: 70×12, 70×12".

- Older history under an exercise is labelled by meso name and week, not a calendar date.

**Under the hood**
- Two new optional columns on mesocycles (`carry_meso_id`, `carry_week`) and an updated `create_mesocycle` that only accepts a source meso you own. Existing data unchanged. Docs: Training Logic §5.6.

---

## 1.1.2 — 2026-11-20 · "Progress from the meso before"

**Changed**
- **Week 1 of a new meso now progresses only from your previous meso** (the one you trained most recently), not from any older meso. This replaces 1.1.1's 6-month rule. Weeks 2+ were already week-over-week and are unchanged.
- **Exercises that weren't in the previous meso get no auto weight.** You pick it; older history shows for reference only.
- **New: historical notice.** When last week is more than 5% below your all-time best for a lift, a small 📌 note says so. It's information only and never changes today's targets.

---

## 1.1.1 — 2026-11-20 · "Carry-over fix"

**Fixed**
- **Week-1 weights no longer come from very old or rehab sessions.** A new meso's first-week weights only carried over from the last 6 months (replaced in 1.1.2 by "previous meso only"). Found because a chest-supported row suggestion showed 70 × 30 — the numbers from the Sept 2025 post-surgery block.
- **Suggestions far outside the rep range are re-solved.** If last time was way above or below the exercise's rep range (e.g. 30 reps on an 8–15 lift), the app now picks a weight that puts you back in range (70 × 30 → 75 × 15) instead of one small weight bump (which gave 75 × 26).

**Docs**
- Training Logic §5.6. Earlier versions of the Drive docs are now kept in the Drive folder "Archive — earlier versions" instead of being trashed.

---

## 1.1.0 — 2026-11-20 · "Lift insights, splits and weight guardrails"

**New**
- **Home stats follow your current mesocycle.**
  - **"This meso's lifts"** lists every lift in the meso with a status: 🏆 PR, Up, Steady, ⚠️ Stalled or 📉 Down. Lifts that need attention come first.
  - **"PRs this meso"** replaces "PRs (14 days)".
  - With no active meso, home falls back to the all-lifts view.
- **Tap any lift on home to open its chart.** The chart page now has:
  - the lift's status and a recommendation at the top
  - a **This meso / 3 months / All** range switch
  - 🏆 PR markers, and a dashed "meso start" line
  - session count, % change and PR count for the range
- **Flags on the lift in your workout.** When a lift is stalled or down (or hit a PR last time), a flag shows right on it with what to do today. Example: "Stalled — no progress in 3 weeks. Today: keep the weight and add 1 rep to your first set only." Tap it for the full recommendation and a link to the chart. The ⓘ sheet shows the trend too.

- **Create meso is now 4 clear steps: Goal → Days & split → Emphasis → Name.**
  - Goal is a big tile at the top (Hypertrophy / Strength / Athleticism), so it can't be missed.
  - **Splits.** Pick days per week, then pick how the week is laid out. Options depend on the day count:
    - **Full-body split** (2–6 days, the default for 3–6): each day trains part of the body; each muscle about 2× a week on different days. This is the layout of the current RP-style mesos.
    - **Full body** (2–4 days, the default for 2): every muscle every session, fewer sets per muscle each day.
    - **Upper / Lower** (2, 4 or 6 days).
    - **Push / Pull / Legs** (3 or 6 days).
    - **PPL + Upper/Lower** (5 days).
  - The card shows your week before you build it, e.g. "Push · Pull · Legs · Push · Pull · Legs". Autofill names the days and only puts each muscle on its days.
  - **Emphasis** (Upper focus / Lower focus / Balanced / Custom) is now separate from the split. "Whole body" was renamed "Balanced", since it is about which muscles grow, not the day layout.
- **Weight guardrails.**
  - **Typo check:** a weight 1.5× or more, or half or less, of the same set last time turns the box amber and asks "typo?". Example: 700 lb where you did 70 lb. It still saves if it's right — the app never blocks a real jump (e.g. after an injury or a new variation).
  - **Empty-bar floor:** suggestions for barbell lifts never go below the bar (45 lb / 20 kg).
  - The existing weight window (§4.1) still warns when a weight puts the reps outside the exercise's range.

**Under the hood**
- New `lift_recent` database function: the last 12 sessions per lift plus the earlier best, in one small request (doesn't let users see each other's data).
- `liftStatus` / `prsSince` / `weeklyBest` in the training engine, with tests. Docs: Training Logic §6.1.
- `SPLITS`, `splitsFor`, `defaultSplit`, `splitLayout`, `weightSanity`, `barFloor` in the training engine, with tests. Autofill takes a `split`. Docs: Training Logic §2.0 and §4.1.
- Database migrations applied to production during this release: `lift_recent` and `lift_recent_horizon` (read-only functions; no data changed).

---

## 1.0.0 — 2026-11-20 · "Reliable, personal, goal-aware"

The first version built for a group: fixes from an external code review, plus training goals, preferences and warm-ups.

**New**
- **Training goal per mesocycle: Hypertrophy, Strength or Athleticism.** Hypertrophy is the original engine, unchanged; a test proves its output is identical.
  - **Strength:** main lifts 3–6 reps, accessories 6–12, RIR goes 3 → 1 and never reaches failure, about 25% fewer starting sets.
  - **Athleticism:** explosive main lifts 3–5 reps held at 3 RIR, accessories 8–12 at 2 RIR or more, about 40% fewer starting sets.
  - Progression is the same for all goals: add reps, then add weight, with sets adjusted from feedback, plus deloads.
- **Exercise preferences**, set in Settings and the Exercise library:
  - ★ favorites are picked first.
  - ⦸ exclude a lift, optionally with a substitute to use instead.
  - "Equipment I have" filters out lifts you can't do.
  - Opt-in **"Avoid heavy spinal loading."** 22 exercises are tagged (barbell/Smith/hack/pendulum squats, deadlift variants, barbell/Pendlay/T-bar rows, standing overhead press, barbell shrugs and lunges). It's off by default, and starring a tagged lift keeps it.
- **Warm-ups:**
  - A warm-up notice at the top of each workout.
  - An **ⓘ button** on every exercise with ramp-up sets worked out from today's weight. Example: 225 lb → 115 × 8, 160 × 4, 190 × 2.
  - Rep, RIR and rest tips.
  - Warm-up sets are never logged or counted.
- **Saving with no signal:**
  - Sets save on the phone and sync automatically when the connection returns.
  - An amber outline and a "⟳ N sets waiting to sync" badge show what's waiting; a red outline means a save failed.
  - Nothing typed offline is lost on reload.
- **Login screen:**
  - The tagline "Track your workouts. Measure your progress. Get stronger." and a short description.
  - Password rules shown before signing up, and a show-password option.
  - Mistakes are flagged next to the field, and labels are linked to their inputs for screen readers.
- Loading spinner on slow screens, and a "No connection — Try again" screen.
- Learn: a new "Warming up" article.

**Fixed**
- **lb ↔ kg:** weights were saved in whatever unit was selected, so switching units changed the meaning of your history. Everything is now stored in pounds and converted only for display (100 kg ↔ 220.46 lb, lossless).
- **Creating a mesocycle** is now a single all-or-nothing step. A dropped connection can't leave half a meso, and a retry can't make a duplicate.
- **Dashboard:**
  - Warm-up sets never count as hard sets.
  - "Workouts" now counts finished workouts; training days are counted separately.
- **Current program:** an active mesocycle always wins over a planned one, so building a future program no longer replaces the one you're running.
- **Dates:** "today" uses your local date. Cardio logged in the evening (in time zones behind UTC) was being dated tomorrow.
- A finished set kept its finish time after a reload (editing it used to reset the time to "now").
- "+ set" no longer copies the previous row's save state.

**Under the hood**
- Database:
  - New `create_mesocycle` function.
  - New columns: `mesocycles.goal`, `templates.goal`, `mesocycles.client_key`, `exercises.tags`, `profiles.equipment`, `profiles.avoid_tags`.
  - New `exercise_prefs` table with per-user data protection.
  - Dashboard functions updated.
- Migration files renamed to match the versions production recorded, so a fresh database applies them in the right order. The `rls_auto_enable` lock is now conditional.
- New tests:
  - `test/db.test.mjs` builds a brand-new database from every migration in order. It then checks meso creation (all-or-nothing, no duplicates), the dashboard math, that the database's strength formula matches the app's, preferences, and that users can't see or write each other's data.
  - Logic tests added for units, goals, preferences and warm-ups.
  - Browser flow tests added.
- Docs: Training Logic §1.10 Goals, §2.2 Preferences, §4.2 Warm-ups, and the units note; sources 25–33.

---

## 0.7.0 — 2026-11-20 (20:18–20:23)

**New**
- "Forgot password?" emails a reset link with no code to type. The link opens a "Choose a new password" screen. Settings has a "Change password" button.
- **Weekly backups:** every Sunday at 2:15 AM Mountain, a copy of every table is saved inside the database. The last 5 weeks are kept, and app users can't access them.

**Changed**
- The home dashboard and Exercise progress are now worked out in the database: about 2 KB per load instead of about 3.5 MB of history.

**Data operations**
- A second user's RP mesocycle loaded into their account: week 1 logged, later weeks planned.

---

## 0.6.0 — 2026-11-20 (20:02)

**New**
- **Weight window:** change the weight and the rep target adjusts to match last time's effort (lower weight → more reps). Each exercise shows its acceptable weight range, and you're warned outside it.
- **Learn section:** goal guides (size, strength, athleticism, maintenance, cardio), a per-muscle guide and short articles, all with PubMed links.

**Fixed**
- **Dashboard:** it only ever read the first 1,000 sets (your 2023 data). Sets per week, PRs and cardio charts were empty, and triceps and calves showed negative trends. The trend now compares like for like: no deload or myo-rep sets.

**Data operations**
- Imported RP cardio got minutes filled in, using the units from your own RP notes:
  - Assault Bike: seconds per interval × intervals.
  - Sprints: intervals × 40 s.
  - Steady state: the logged time.
  - Zone 2: reps counted as minutes.

---

## 0.5.0 — 2026-11-20 (19:50–19:53)

**New**
- Email-confirmation sign-up: "Check your email to confirm your account", a Resend button, handling of the confirmation link, and a friendly message when signing in before confirming.
- Small ▲ / = / ▼ icon on each set's weight and reps, compared with the same set last time.

**Setup**
- Gmail SMTP for sign-up emails, sender "Woodhouse Lifts", with a 100 emails/hour limit.

---

## 0.4.0 — 2026-11-20 (19:29–19:31)

**New**
- The pump, workload and joint pain ratings are required and can't be skipped. ✎ edits them later.
- Strength trend indicator per exercise.
- Cardio ratings use the talk test ("breathing") in place of pump.

---

## 0.3.0 — 2026-11-20 (19:18–19:25)

**New**
- Tabs: Home, Workout, Mesos, Library, Explore.
- Home dashboard.
- Templates.
- Week-over-week slip warnings.
- Cardio inside workouts.
- Week 1 of a new meso carries weights over from the last one.

**Data operations**
- RP history imported for the owner (logged sets only). Other people's mesos in the export were excluded, and RP's notes and recommendations were not copied.
- Personal RP export files were kept out of the public repo.

---

## 0.2.0 — 2026-11-20 (19:04–19:07)

**New**
- Base templates (upper, lower, whole, custom) with "autofill everything" or "fill what's left".
- RIR set by the program, stepping down each week, with a deload.
- Weight and sets adjusted from feedback.
- Cardio tracking.
- Explore pages.
- A bigger exercise library.

**Mobile**
- No zooming in on inputs on iPhone.
- Layouts for small phones and the notch/safe areas.
- Consistent form controls across browsers.

---

## 0.1.0 — 2026-11-20 (18:33–18:46)

**New**
- Supabase database: mesocycles, workouts, sets and feedback, each user's data visible only to them.
- Starter app: sign-in, mesocycle builder, workout logger, and muscle feedback.
