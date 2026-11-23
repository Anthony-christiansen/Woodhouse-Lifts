# Woodhouse Lifts — Changelog

Every released version of the app, newest first. Each entry lists what changed for people using the app, what changed underneath (database, logic), and any one-time data operations.

- Live app: https://anthony-christiansen.github.io/Woodhouse-Lifts/
- Code: https://github.com/Anthony-christiansen/Woodhouse-Lifts

Versions follow **MAJOR.MINOR.PATCH**:
- MAJOR: a change in how the training engine or the data works that people will notice.
- MINOR: new features.
- PATCH: fixes.

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

## 1.8.0 — 2026-11-21 (00:30 MT) · "Pick your day + reliability"

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

## 1.7.0 — 2026-11-20 (23:55 MT) · "Injury guardrails"

**New — limits on how fast weight goes up, applied to every suggestion:**
- **Weekly cap:** at most +10% over last week (ACSM recommends 2–10% increases); one step is still allowed on light loads.
- **Meso ceiling:** at most +20% over a lift's week-1 weight in the meso; after that the app adds reps instead.
- **"Faster" progression is switched off** in 0-RIR weeks, on spinal-loading (axial) lifts, and with any joint pain.
- **Reps** never jump more than +2 in a week.
- **Your own big jumps:** typing more than ~10% over last week shows "Big jump … about X is the safer max" (doesn't block).
- When a guardrail trims a suggestion, the note on the exercise says which one.

Docs: Training Logic §4.5, with 2 new sources (ACSM 2009 progression models; Gabbett 2016 on load spikes and injury).

---

## 1.6.0 — 2026-11-20 (23:40 MT) · "Feedback sets the pace"

**New — your ratings now change how fast a lift progresses (autoregulation).**
- Workload **Easy** → faster: one extra step (by-weight lifts: e.g. sled 315×27 → **335×27**, capped at ~10% of the load; by-reps lifts: row 70×11 → **70×13**).
- **Pretty good** / no rating → normal (325×27; 70×12).
- **Pushed my limit** → slower: by-weight lifts keep the weight and add a rep (315×28); by-reps lifts match last week (70×11).
- **Too much** or joint pain 2+ → hold (same as last week).
- **Pump doesn't change the load** (research doesn't support pump as a growth signal); it stays in the set/volume rules.
- Each exercise shows why, e.g. "⤴︎ This week: +20 lb, same reps — faster: last time felt easy with little pump".

**Docs:** Training Logic §4.3 (speed rules) and new §4.4 — every rule in the app graded against the research (strong / moderate / practice-based), with 3 new sources on autoregulation (Huang 2025, Mann 2010, Suchomel 2021).

---

## 1.5.0 — 2026-11-20 (23:15 MT) · "Weight or reps, like RP"

**Fixed — suggestions always added a rep, even on lifts that progress by weight.**
- Found on sled push: last week 315×27 at 1 RIR. RP had 325×28 for week 4; the app had 315 (+1 rep).
- RP-style programs move some lifts by **weight** at the same reps (machines, cables, sleds — pec dec 180×8 → 185×8) and others by **reps** at the same weight (row 70×10 → 70×11). The app now learns which one each lift uses from its last week-to-week change in the meso, and the size of the weight jump you actually took.
- Sled push week 4 now suggests **325 × 27–28** (+10 lb, same reps, one extra rep as the stretch). Row still suggests 70×12; pec dec 190×8; leg press 300×10 — matching what you did.
- With no history (week 1, nothing to carry): machines, cables and sleds start by weight; barbells, dumbbells and bodyweight by reps.
- Each exercise shows its style under the name ("progresses +10 lb" / "progresses by reps").

Docs: Training Logic §4.0.

---

## 1.4.1 — 2026-11-20 (22:55 MT) · "Orange notice every time"

**Fixed**
- **The "under last week" notice now shows on every orange set, not just the first.** When you tick ✓ on a set where reps or weight is below the same set last week (orange ▼), you get a notice each time. Example: "Set 2: Reps down vs last week (6 → 4). One set under last week is fine — rest a little longer and aim to match it next set."
- On the last set of an exercise, the set notice and the exercise summary show together (e.g. "Set 3: Reps down vs last week (6 → 5). Standing Knee Drive: ▲ up +1.2% vs last week").
- **Tap any ▲ / = / ▼ arrow** to see what it's comparing (e.g. "Reps down vs last week (6 → 4)").
- Notices no longer stack on top of each other: a new one replaces the one on screen, so a second notice can't be hidden behind the first or vanish early.

---

## 1.4.0 — 2026-11-20 (22:45 MT) · "Stalled means stalled"

**Fixed — lifts were flagged Stalled for hitting the plan.**
- In a meso the target RIR drops each week, so the plan is +1 rep (or a bit of weight) every week. The old status used a strength estimate that credits reps left in the tank, so +1 rep at 1 less RIR scored **flat** → "Stalled". On AC VII that wrongly flagged 6 lifts that were exactly on plan (bent-over row, overhead triceps extension, lying curl, preacher curl, Pallof press, pec dec).
- **Now:** inside a meso, each meso week is compared on **performance** (weight × reps, no RIR credit). Across mesos, the same meso week is compared (AC VII week 4 vs AC VI week 4). PRs still use the RIR-credited estimate.
- **Stalled** now means no gain two weeks in a row while the target got harder. **Down** = two weeks more than 3% under this meso's best. New **Dipped** = one off week (no flag). New **On track** = beat last week.
- Every status shows the comparison to last meso, e.g. "vs AC VI week 4: +1 rep at the same weight".
- Chart page: new **Performance / Strength estimate** switch (Performance is the default).
- Statuses are the same on Home, the chart page and the workout flag (one shared rule).

---

## 1.3.0 — 2026-11-20 (22:10 MT) · "Tap anything on Home"

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

## 1.2.0 — 2026-11-20 (21:55 MT) · "Run it again from an earlier week"

**New**
- **"↻ Run it again" lets you pick which week to restart from.** It copies the meso's plan, then asks which week's logged weights and reps the new week 1 should start from: the last working week before the deload, or up to two weeks back. Example: 7-week meso, deload in week 7 → choose week 6, 5 or 4; pick week 4 and progress again from there. "Don't carry weights" is also an option.
- The builder shows "Week 1 weights & reps start from <meso> · week N", with a button to turn it off.
- In the workout, carried weights are labelled with their source week, e.g. "last meso wk 4: 70×12, 70×12".

- Older history under an exercise is labelled by meso name and week, not a calendar date.

**Under the hood**
- Two new optional columns on mesocycles (`carry_meso_id`, `carry_week`) and an updated `create_mesocycle` that only accepts a source meso you own. Existing data unchanged. Docs: Training Logic §5.6.

---

## 1.1.2 — 2026-11-20 (21:45 MT) · "Progress from the meso before"

**Changed**
- **Week 1 of a new meso now progresses only from your previous meso** (the one you trained most recently), not from any older meso. This replaces 1.1.1's 6-month rule. Weeks 2+ were already week-over-week and are unchanged.
- **Exercises that weren't in the previous meso get no auto weight.** You pick it; older history shows for reference only.
- **New: historical notice.** When last week is more than 5% below your all-time best for a lift, a small 📌 note says so. It's information only and never changes today's targets.

---

## 1.1.1 — 2026-11-20 (21:25 MT) · "Carry-over fix"

**Fixed**
- **Week-1 weights no longer come from very old or rehab sessions.** A new meso's first-week weights only carried over from the last 6 months (replaced in 1.1.2 by "previous meso only"). Found because a chest-supported row suggestion showed 70 × 30 — the numbers from the Sept 2025 post-surgery block.
- **Suggestions far outside the rep range are re-solved.** If last time was way above or below the exercise's rep range (e.g. 30 reps on an 8–15 lift), the app now picks a weight that puts you back in range (70 × 30 → 75 × 15) instead of one small weight bump (which gave 75 × 26).

**Docs**
- Training Logic §5.6. Earlier versions of the Drive docs are now kept in the Drive folder "Archive — earlier versions" instead of being trashed.

---

## 1.1.0 — 2026-11-20 (22:00 MT) · "Lift insights, splits and weight guardrails"

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

## 1.0.0 — 2026-11-20 (21:00 MT) · "Reliable, personal, goal-aware"

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
- **Dates:** "today" uses your local date. Cardio logged after 5 PM in Utah was being dated tomorrow.
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
- Jayd's RP mesocycle "Jayd's new new" loaded into his account: week 1 logged (70 sets), weeks 2–5 planned. Bodyweight set to 198 lb from his RP data.

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
- RP history imported for Anthony: 25 mesocycles from Jun 2023 onward, about 8,180 sets. Kari's, Jayd's, Dakari's and Alexiya's mesos were excluded, and RP's notes and recommendations were not copied.
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
