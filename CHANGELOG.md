# Woodhouse Lifts — Changelog

Every released version of the app, newest first. Each entry lists what changed for people using the app, what changed underneath (database, logic), and any one-time data operations.

- Live app: https://anthony-christiansen.github.io/Woodhouse-Lifts/
- Code: https://github.com/Anthony-christiansen/Woodhouse-Lifts

Versions follow **MAJOR.MINOR.PATCH**:
- MAJOR: a change in how the training engine or the data works that people will notice.
- MINOR: new features.
- PATCH: fixes.

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
