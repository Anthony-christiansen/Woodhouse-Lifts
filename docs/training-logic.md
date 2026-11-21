# Woodhouse Lifts — Training Logic & Evidence

Last updated: November 20, 2026. This doc explains how the Woodhouse Lifts app builds mesocycles, collects feedback, and adjusts weight and volume. Every rule is tied to the research behind it. All research was retrieved from PubMed, and each citation links to its DOI.

**An honest caveat up front:** the research sets the boundaries: how much volume, how close to failure, how often to train, whether to deload. The week-to-week adjustment rules in Section 5 are a practical decision system built inside those boundaries. No study has tested this exact algorithm, and none has tested RP's either. Treat the rules as reasonable defaults to refine with your own data, not as proven settings.

---

## 1. What the research says

### 1.1 Volume (weekly hard sets per muscle) is the main lever

- **More weekly sets → more growth, with diminishing returns.** A 2017 meta-analysis of 15 studies found a graded dose-response. Each extra weekly set was associated with roughly 0.37% more muscle gain, and 10+ sets per muscle per week trended best. Schoenfeld et al., 2017, *J Sports Sci*. [doi:10.1080/02640414.2016.1210197](https://doi.org/10.1080/02640414.2016.1210197)
- **The 2026 update confirms it and adds nuance.** Pelland et al. pooled 67 studies and 2,058 participants. There was a 100% posterior probability that hypertrophy rises with volume, with diminishing returns. Counting "indirect" sets as half a set fit the data best. For example, a bench press counts as 0.5 of a triceps set. *Sports Med* 2026. [doi:10.1007/s40279-025-02344-w](https://doi.org/10.1007/s40279-025-02344-w)
- **Maintenance needs far less.** In young adults, cutting training to one-third, or even one-ninth, of the prior dose kept the size gained. Older adults needed more to hold their gains. Bickel et al., 2011, *Med Sci Sports Exerc*. [doi:10.1249/MSS.0b013e318207c15d](https://doi.org/10.1249/MSS.0b013e318207c15d)

**App rules:**
- Muscles you're focusing on start at **~10 sets a week** and can grow from there.
- Muscles you're only maintaining sit at **~4 sets a week**.
- Volume tracking counts indirect work at **0.5×**.
- The app stops adding sets past **~22 a week** per muscle, because returns diminish and recovery cost keeps rising.

### 1.2 Proximity to failure (RIR)

- **For growth, closer to failure is better. For strength it matters much less.** Robinson et al. ran a series of meta-regressions. Hypertrophy rose as sets ended closer to failure, while strength gains were similar across a wide range of RIR. *Sports Med* 2024. [doi:10.1007/s40279-024-02069-2](https://doi.org/10.1007/s40279-024-02069-2)
- **You don't need actual failure on every set.** In trained lifters, 1–2 RIR produced quadriceps growth equal to training to failure, with less fatigue. Refalo et al., 2024, *J Sports Sci*. [doi:10.1080/02640414.2024.2321021](https://doi.org/10.1080/02640414.2024.2321021)
- **Failure may help a little when volume is very low.** With single-set routines, failure tended to favor some hypertrophy measures, though the differences were modest. Hermann et al., 2025, *Med Sci Sports Exerc*. [doi:10.1249/MSS.0000000000003728](https://doi.org/10.1249/MSS.0000000000003728)
- **Trained lifters estimate RIR well.** On the bench press, predictions of 1 and 3 RIR were accurate within about ±1 rep, with a slight tendency to underpredict. Refalo et al., 2024, *J Strength Cond Res*. [doi:10.1519/JSC.0000000000004653](https://doi.org/10.1519/JSC.0000000000004653)
- **Reporting caveats.** RIR definitions and how "failure" is measured vary a lot between studies. Pelland et al., 2022, *Sports Med*. [doi:10.1007/s40279-022-01667-2](https://doi.org/10.1007/s40279-022-01667-2)

**App rule:** RIR is set by the program, not chosen by you. Week 1 starts at 3 RIR and steps down to 0 by the last accumulation week, spaced to fit the mesocycle length. For example, a 5-week block (4 working weeks + deload) runs 3 → 2 → 1 → 0 → deload at 4 RIR. Most working weeks therefore land at 0–2 RIR, the zone the evidence favors for growth. Your feedback can hold a muscle's RIR steady for a week (see 5.1). You don't log RIR. Each set is assumed to be taken to that week's target, which keeps the math consistent.

### 1.3 Load and rep range

- **Growth is similar across a wide range of loads, as long as sets are taken hard.** Heavier loads win for 1-rep-max strength. Schoenfeld et al., 2017, *J Strength Cond Res* (21 studies). [doi:10.1519/JSC.0000000000002200](https://doi.org/10.1519/JSC.0000000000002200)

**App rule:** Each exercise has a working rep range: barbell compounds 5–12, other weighted lifts 8–15, and bodyweight lifts and some isolations up to 20–30. Weight goes up when you pass the top of the range at your target RIR, so you're always progressing either reps or load.

### 1.4 Frequency

- **When weekly sets are equal, frequency has little effect on growth.** You can pick a frequency based on schedule. Schoenfeld et al., 2019, *J Sports Sci*. [doi:10.1080/02640414.2018.1555906](https://doi.org/10.1080/02640414.2018.1555906)
- **Twice a week beat once a week** in an earlier analysis, which is the practical floor for muscles you're focusing on. Schoenfeld et al., 2016, *Sports Med*. [doi:10.1007/s40279-016-0543-8](https://doi.org/10.1007/s40279-016-0543-8)
- **Pelland 2026** found frequency's effect on hypertrophy was compatible with negligible, while it clearly helped strength (see 1.1).

**App rule:** Templates hit focused muscles **at least 2× a week**. Splitting volume across days also keeps the sets per muscle per session manageable.

### 1.5 Exercise selection and variation

- **Systematic variation can help regional growth. Excessive, random rotation can hurt.** Kassiano et al., 2022, *J Strength Cond Res*. [doi:10.1519/JSC.0000000000004258](https://doi.org/10.1519/JSC.0000000000004258)

**App rule:** Autofill uses **different exercises for the same muscle on different days of the week** (for example, an incline press on Day 1 and a machine press on Day 3). It keeps those exercises **fixed for the whole mesocycle** so progress can be measured. Swap exercises between mesocycles, not within one.

### 1.6 Soreness, pump, and muscle damage: what they do and don't tell you

- **Muscle damage is not what drives growth.** Early in training, muscle protein synthesis goes mostly to repairing damage. It only lines up with growth once damage has faded. Damas et al., 2016, *J Physiol*. [doi:10.1113/JP272472](https://doi.org/10.1113/JP272472)
- **The pump (cell swelling) and metabolic stress aren't supported as meaningful drivers of growth.** Mechanical tension is the primary stimulus. Van Every et al., 2025, *J Sport Health Sci*. [doi:10.1016/j.jshs.2025.101104](https://doi.org/10.1016/j.jshs.2025.101104)
- **DOMS is a mild injury that typically peaks 48–72 hours after training** and reduces force capacity in the meantime. Hotfiel et al., 2018. [doi:10.1055/a-0753-1884](https://doi.org/10.1055/a-0753-1884)

**What this means for the app:**
- **Soreness and recovery are recovery signals, not growth signals.** If a muscle is still sore when you train it again, recovery is behind, and adding sets would just add damage. That's a reason to hold or cut volume, never a reason to add it.
- **Pump carries the least weight of any rating.** It only breaks ties when every other signal says you have room to add volume.

### 1.7 Autoregulation and the "one more factor": performance

- **Performance-based progression is practical and reliable.** That means adjusting load from your own reps and RIR rather than fixed percentages, and it shows early benefits. In-session performance and RIR-based ratings track training readiness strongly. Helms et al., 2020, *J Hum Kinet*. [doi:10.2478/hukin-2020-0011](https://doi.org/10.2478/hukin-2020-0011)

**App rule:** The extra factor you asked about is **performance trend**, and the app works it out on its own with no extra question. For each muscle it compares this session's best set against the same day last week, using estimated strength:

> weight × (1 + (reps + RIR) / 30)

The result is scored as **Up** (more than +1%), **Same** (within ±1%) or **Down** (less than −1%). This is the most objective signal the app has, because it's what you actually lifted rather than how you felt.

### 1.8 Deloads

- **A mid-program deload week didn't hurt growth**, though it slightly blunted strength. Coleman et al., 2024, *PeerJ*. [doi:10.7717/peerj.16777](https://doi.org/10.7717/peerj.16777)
- **Cutting volume and frequency at the midpoint and end** of an 8-week program didn't hinder growth (untrained men). Pancar et al., 2026, *Sci Rep*. [doi:10.1038/s41598-026-40612-5](https://doi.org/10.1038/s41598-026-40612-5)
- **Coaches' practice:** most cut volume during deloads, commonly by up to 25%. De Marco et al., 2024, *J Strength Cond Res*. [doi:10.1519/JSC.0000000000004932](https://doi.org/10.1519/JSC.0000000000004932)

**App rule:** The last week of every mesocycle is a deload. Sets are **half of your final working week's sets, after all feedback adjustments**, rounded up. Target RIR is 4, and loads are held at the last accumulation week's weight. The research says a deload won't cost you size, and it clears accumulated fatigue before the next block. No feedback adjustments are made during the deload.

### 1.9 Cardio alongside lifting

- **Concurrent training doesn't reduce whole-muscle hypertrophy** compared with lifting alone, and it improves aerobic capacity. Lifting before cardio may slightly favor strength and size. Held et al., 2026 umbrella review, *Sports Med*. [doi:10.1007/s40279-026-02401-y](https://doi.org/10.1007/s40279-026-02401-y)
- **At the fiber level there may be a small interference effect, more with running than with cycling.** Lundberg et al., 2022, *Sports Med*. [doi:10.1007/s40279-022-01688-x](https://doi.org/10.1007/s40279-022-01688-x)
- **Session-RPE is a valid, reliable way to track training load:** RPE (0–10) × minutes. Haddad et al., 2017, *Front Neurosci*. [doi:10.3389/fnins.2017.00612](https://doi.org/10.3389/fnins.2017.00612)

**App rule:** Cardio is logged by **type, minutes and intensity (session RPE 0–10)**, plus optional distance and heart rate. The app calculates **training load = RPE × minutes** and shows weekly totals. Cardio doesn't change the lifting adjustments. The home screen does note when cardio load spikes, and the app suggests doing cardio after lifting, or cycling over running on leg days.

### 1.10 Training goal: hypertrophy, strength or athleticism

Each mesocycle has a goal. **Hypertrophy is the original engine and is unchanged.** Strength and athleticism use the same machinery: double progression, set changes from your feedback, and deloads. They change only three inputs:

| | Hypertrophy | Strength | Athleticism |
|---|---|---|---|
| Rep range (main / compound lifts) | the exercise's own (e.g. 8–15) | **3–6** (≈ ≥80% 1RM) | **3–5**, moved as fast as possible |
| Rep range (accessories) | the exercise's own | 6–12 | 8–12 |
| RIR schedule | 3 → 0, deload | 3 → **1 floor**, deload (never to failure) | main lifts **held at 3** (stop when speed drops); accessories floor 2 |
| Starting weekly sets | as §2.1 | **×0.75** | **×0.6** (low-volume power work) |

Why:
- Strength improves most with heavy loads (≥80% 1RM) across 2–3+ sets, done early in the session, 2+ times a week (ACSM 2026). Going closer to failure doesn't add strength (Robinson 2024).
- Power improves with moderate loads lifted explosively and with low-to-moderate volume (≤24 reps × sets) (ACSM 2026). Plyometrics help jump, sprint and change of direction (Oliver 2024; Zheng 2025).
- Narrower rep ranges make double progression add load sooner. That is what strength and power training need.

---

## 2. Mesocycle templates

### 2.0 Splits: how the week is laid out

Building a meso is four steps: **Goal** (§1.10) → **Days & split** → **Emphasis** (the table below) → name. The split decides which muscles go on which day. The emphasis decides how many sets each muscle gets.

| Split | Days allowed | Default for | Week layout (example) |
|---|---|---|---|
| Full-body split | 2–6 | 3, 4, 5, 6 days | Full body A · B · C … — each day trains part of the body; each muscle on about 2 days a week |
| Full body | 2–4 | 2 days | 3 days: Full body · Full body · Full body (every muscle every day, fewer sets each day) |
| Upper / Lower | 2, 4, 6 | — | Upper · Lower · Upper · Lower |
| Push / Pull / Legs | 3, 6 | — | Push · Pull · Legs · Push · Pull · Legs |
| PPL + Upper/Lower | 5 | — | Push · Pull · Legs · Upper · Lower |

- Push = chest, shoulders, triceps. Pull = back, biceps, traps, forearms. Legs = quads, hamstrings, glutes, calves, abs. Upper days add traps and forearms; Lower days add abs.
- Only splits that fit the chosen day count are offered; changing days resets to the default split (marked "recommended").
- Why the full-body split is the default for 3+ days: frequency of 2×/week per muscle is enough when weekly sets are equal (§1.4), and spreading muscles across days keeps each session shorter than doing everything every day.
- 3-day PPL trains each muscle once a week. That's allowed (volume matters more than frequency, §1.4), but the full-body split gets 2× for the same days.

| Template | Focused muscles (≈10 sets/wk start, ≥2×/wk) | Maintained (≈4 sets/wk) |
|---|---|---|
| Upper focus | Chest, Back, Shoulders, Biceps, Triceps | Quads, Hamstrings, Glutes, Calves |
| Lower focus | Quads, Hamstrings, Glutes, Calves | Chest, Back, Shoulders, Biceps, Triceps |
| Whole body | All major muscles at ≈8–10 sets/wk, spread across every day | — |
| Custom | You pick each muscle's priority: Focus / Maintain / Skip | — |

Abs, Traps and Forearms default to **Maintain** in every template. You can change any of them.

### 2.1 How autofill decides what goes on each day

Autofill works backward from the whole week, so Day 1 is built knowing what Days 2–N will cover:

1. **Weekly set target per muscle**, set by its priority:

   | Priority | Large muscles (Chest, Back, Quads, Hamstrings, Glutes) | Smaller muscles (Shoulders, Biceps, Triceps, Calves) | Abs / Traps / Forearms |
   |---|---|---|---|
   | Focus | 10 | 8 | 6 |
   | Whole body (everything) | 8 | 6 | 3 |
   | Maintain | 4 | 4 | 3 |
   | Skip | 0 | 0 | 0 |

   These are starting points at the low end of the productive range (1.1). The feedback rules in Section 5 grow them week by week.
2. **How many days a week each muscle is trained:**
   - Focused muscles: 2× at minimum (1.4), and more often if needed to keep each session at **5 sets or fewer per muscle**. Frequency = weekly sets ÷ 5, rounded up, between 2 and the number of training days.
   - Maintained muscles: 1× a week, or 2× if their target is above 4 sets.
3. **Which days.** Muscles with the most weekly sets are placed first. Each muscle's sessions are spread evenly across the week (for example, Days 1 and 3 of 4) for recovery. The starting day is whichever day has the fewest sets so far, so the days come out balanced.
4. **Sets per session.** Weekly sets are split as evenly as possible across that muscle's days. For example, 10 sets over 2 days is 5 + 5, and 8 over 3 is 3 + 3 + 2.
5. **Exercises per muscle per session:**
   - 1–4 sets → 1 exercise
   - 5–8 sets → 2 exercises
   - 9+ sets → 3 exercises

   Sets are split across those exercises, with the first exercise getting any extra set.
6. **Picking exercises.** Compound lifts come before isolations. Each time a muscle appears in the week, it gets the next exercise in its list, so the same muscle uses different exercises on different days (1.5). The exercises then stay fixed for the whole mesocycle.
7. **Order within a day.** Large muscles first, then smaller ones, then abs, traps and forearms. Within each muscle, compounds come first.
8. **Day size check.** If a day goes over about 25 total sets, the app warns you so you can add a training day or drop a muscle to Maintain.

"Fill what's left" runs the same steps but subtracts the sets you've already placed. If you already put 4 chest sets on Day 1, autofill places only the remaining 6 chest sets elsewhere.

**Autofill options when building a mesocycle:**
- **Autofill everything.** The app builds every day from the template: it picks muscles and exercises, spreads sets across days, and varies exercises across the week.
- **Fill what's left.** The app keeps anything you've already picked and only fills empty days and empty exercise slots.
- **Start blank.** You build it all yourself.

### 2.2 Personal exercise preferences

Before autofill picks anything, it applies the person's own preferences (Settings → Training preferences, and the ★ / ⦸ buttons in the Exercise library):

- **Exclude** a lift and autofill never picks it. You can name a substitute, and it's used in its place.
- **Favorites** are always allowed and are picked first for their muscle.
- **Equipment I have:** lifts that need equipment you don't have are skipped. Bodyweight and cardio are always allowed.
- **Avoid heavy spinal loading** is opt-in. It skips exercises tagged `axial`:
  - the bar on your back or shoulders, and shoulder-pad squat machines
  - heavy barbell hinges and rows
  - the standing barbell overhead press
  - heavy barbell shrugs and lunges

  The tagged list is shown in Settings. Starring a tagged lift keeps it.

These are personal choices, not medical rules. Nothing is removed from the library, and anything can still be added by hand. With no preferences set, autofill output is identical to before.

---

## 3. What you rate, and when

| When | Rating | Scale | What it measures |
|---|---|---|---|
| Right after the last set for a muscle in a session | Pump | 0 None · 1 Mild · 2 Good · 3 Huge | Lowest weight. Only a tiebreaker. |
| | Workload (load rating) | 0 Easy · 1 Pretty good · 2 Pushed my limit · 3 Too much | How hard the volume felt overall |
| | Joint pain | 0 None · 1 Low · 2 Moderate · 3 A lot | A safety signal, which overrides everything else |
| At the start of your next session that trains that muscle | Recovery / soreness | 0 Never got sore · 1 Healed a while ago · 2 Healed just in time · 3 Still sore | Whether recovery kept up with the volume |
| Calculated automatically | Performance trend | Up / Same / Down vs. last week | What you actually lifted |

The recovery question comes later on purpose. You can only judge recovery once the next session for that muscle arrives. The app asks it at that point and applies the result to **next week's version of the session you're rating.**

---

## 4. Weight (load) progression, per exercise

The app uses double progression anchored to RIR. It works from last week's same set:

1. **Weight auto-matches.** Each set opens with last week's weight already filled in for the same set, adjusted by the rules below. You can type over it. **Expected reps at that weight** = last reps + (last week's target RIR − this week's target RIR).
   - Example: 185 × 10 at 3 RIR last week, target 2 RIR this week → aim for **185 × 11**.
2. If those reps **exceed the top of the exercise's rep range**, the app adds weight and drops 2 reps.
   - Example: 185 × 13 would pass a 12-rep cap, so it suggests **190 × 11**.
3. **Increments:**
   - Barbell / machine / cable: 5 lb (2.5 kg)
   - Dumbbells: 5 lb per pair (2 kg)
   - Bodyweight: add reps first. Once you pass the cap, add load with a belt or vest (+5 lb). Assisted lifts reduce the assistance by 5 lb.
4. **Joint pain of 2 or more on that muscle** → the app suggests the **same weight and reps** as last week, with no increase.
5. **Deload week** → the same weight as the last accumulation week, half the sets, 4 RIR.

The weight is prefilled in grey and the target reps show as the placeholder. Tapping ✓ accepts both.

### 4.0 Two ways a lift progresses: by weight or by reps

Each week the target RIR drops by one, so each week asks for one rep's worth more effort. RP-style programs take that in one of two ways, per lift — and your imported mesos show both:

| Style | What changes week to week | Examples from AC VII |
|---|---|---|
| **By weight** | +1 load step, **same reps** | Pec dec 175×8 → 180×8 → 185×8 → 190×8 · Sled push 305×27 → 315×27 → 325 · Leg press 290 → 295 → 300 |
| **By reps** | **+1 rep**, same weight | Bent-over row 70×9 → 70×10 → 70×11 → 70×12 · Preacher curl 35×7 → 35×8 → 35×9 → 35×10 |

**How the app picks the style:** it looks at how *this lift* moved in the most recent week-to-week change of the meso.
- The weight went up → by weight, and the step is the jump you actually took (sled: +10 lb; pec dec: +5 lb).
- Same weight and the reps went up → by reps.
- No history yet (week 1 with nothing to carry) → machines, cables and sleds start by weight; barbells, dumbbells and bodyweight start by reps. Week 1 of a new meso uses the previous meso's pattern.

**By weight:** suggestion = last week's weight + step × (RIR drop), same reps; the reps box shows **reps to reps + 1** so the top of the range is the stretch goal. Example (Nov 2026): sled push 315×27 at 1 RIR → week 4 at 0 RIR → **325 × 27–28** (RP had 325×28). Before this change the app always added a rep (→ 315×28).

The exercise line shows the style, e.g. "progresses +10 lb" or "progresses by reps". Change the weight yourself and the reps re-target as in §4.1. Deloads and joint-pain holds never add weight.

### 4.2 Warm-ups (never logged, never counted)

Warm-up sets are not hard sets. The app doesn't log them, and they never count toward weekly sets, PRs or strength trends.

1. **General warm-up:** about 5 minutes of easy cardio plus dynamic moves.
2. **Specific warm-up:** done on the **first exercise for each muscle** that day. Tap ⓘ on the exercise to see ramp-up sets worked out from today's working weight:
   - Compound lifts: 50% × 8, 70% × 4, 85% × 2.
   - Isolation lifts: 50% × 10, 75% × 4.
   - Weights are rounded to the load increment and never go below the empty bar (45 lb / 20 kg).
   - Later exercises for an already-warm muscle get one optional light set.
   - Example: 225 lb working weight → 115 × 8, 160 × 4, 190 × 2.

Keep warm-ups light: a thorough general warm-up does most of the work, and adding fatigue before working sets costs reps (Xu 2025). Dynamic and ramp-up warm-ups support movement quality and sprint and jump performance (Kłobuchowski 2026).

**Units.** All weights are stored in pounds. Choosing kg only changes how weights are shown and typed. 100 kg is stored as 220.46 lb and always shows back as 100 kg, so switching units never changes your history. Load increments follow the unit you see: 5 lb, or 2.5 kg (2 kg for dumbbells).

### 4.1 Choosing a different weight: equivalent-effort reps and the weight window

If you type a weight other than the suggestion, the app re-targets the reps so the effort still matches last time. It uses the same strength estimate as §1.7, e1RM = load × (1 + (reps + RIR) / 30), from last week's same set, and solves for reps at your new load and this week's target RIR.

- The reps box shows a range **lo–hi**: lo matches last time's estimated strength, hi beats it by one rep. Tapping ✓ with the box empty logs lo.
- Later sets that are still on the suggested weight take the new weight too, and are re-targeted the same way.
- The small ▲ / = / ▼ next to weight and reps compares each to the same set last time. Green means progress, amber means backed off. For assisted lifts, less assistance counts as progress.
- Tap an arrow to see the comparison (e.g. "Reps down vs last week (6 → 4)"). Every time you tick ✓ on an amber set you get a short notice — one set under last week is normal; rest a little longer and aim to match it on the next set.
- Example: last week 200 lb × 15 at 2 RIR (e1RM ≈ 313). This week, same 2 RIR, you pick 180 lb → **20–21 reps**. Pick 220 lb → **11–12 reps**.

**Weight window.** Under each weighted exercise the app shows the span of weights for which those matched reps stay inside the exercise's rep range. The heaviest end lands at the rep minimum, the lightest at the rep maximum, both rounded to the load increment. If you go outside it, you get a warning:
- **Too heavy** turns a hypertrophy set into a low-rep strength set.
- **Too light** needs so many reps that the set becomes an endurance grind and RIR is hard to judge.

**Guardrails against bad weights.**
- **Typo check.** If the weight you type is **≥ 1.5×** or **≤ 0.5×** the same set last time, the box turns amber and a note asks if it's a typo. Example: 70 lb last time, 700 typed → flagged. 70 → 90 is not flagged (1.29×). The app **never blocks** the weight: big real changes happen (new variation, coming back from time off, an injury).
- **Empty-bar floor.** Suggestions for barbell lifts never go below 45 lb (20 kg).
- There is no fixed upper limit: strength varies too much between people for one number to be safe.

Light and heavy loads build similar muscle when sets end near failure (Schoenfeld 2017, ACSM 2026), so any weight in the window is a valid choice. The window just keeps the effort comparable week to week. Deload weeks skip re-targeting.

---

### 4.3 Progression speed from your feedback (autoregulation)

The ratings you give after each muscle now set **how big next week's jump is** for that muscle's lifts. This is autoregulation: the effort you report adjusts the next load. Rating-based (RPE/RIR) and performance-based (APRE) autoregulation have produced equal or better strength gains than fixed week-to-week increases [34, 35, 36, 16].

| Last session's rating for the muscle | Speed | By-weight lift (e.g. sled 315×27, step +10) | By-reps lift (e.g. row 70×11) |
|---|---|---|---|
| Workload **Easy** | **Faster** — one extra step | **335 × 27** (+20 lb, never more than ~10% of the load) | **70 × 13** (+2 reps) |
| Workload **Pretty good**, or no rating | Normal | 325 × 27 | 70 × 12 |
| Workload **Pushed my limit** | **Slower** — smaller jump | **315 × 28** (same weight, +1 rep) | **70 × 11** (match last week) |
| Workload **Too much**, or joint pain 2+ | **Hold** | 315 × 27 | 70 × 11 |

- The reason shows on the exercise, e.g. "⤴︎ This week: +20 lb, same reps — faster: last time felt easy with little pump" or "⏸︎ This week: Holding — you rated last time "Too much"".
- **Pump does not change the load.** Pump and cell swelling are not supported as drivers of muscle growth [14], so pump only feeds the set (volume) rules in §5, together with soreness and workload. It appears in the note as context only.
- The "Fast" cap: a weight jump is at most about 10% of the load (50 lb → 55, not 60), so a good day on a light lift can't produce a big leap.
- Deload weeks are never affected.

### 4.5 Injury guardrails on increases and speed

Getting stronger needs progressive load, but most non-contact soft-tissue injuries are linked to **excessive, rapid increases** in training load [38]. The ACSM recommends **2–10% load increases**, and only once you can beat the target by 1–2 reps [37]. Every suggestion passes these checks *after* the progression and speed rules (§4.0, §4.3):

| Guardrail | Rule | Example |
|---|---|---|
| **Weekly load cap** | At most **+10%** over last week's weight for that set. On light loads where one step is already more than 10%, one step is allowed. | Planned 100 → 120 → capped at **110**. 20 lb cable → 25 is allowed (one step). |
| **Meso ceiling** | At most **+20%** over that lift's week-1 weight in this meso; past it, the weight holds and **+1 rep** is suggested instead. | Week 1 = 100 lb, now 120 → stays **120 × 11**, not 125. |
| **No faster jumps at failure** | "Faster" (§4.3) is switched off in 0-RIR weeks. | Easy rating in week 4 → normal step only. |
| **No faster jumps on spinal-loading lifts** | Lifts tagged *axial* (squats, deadlifts, good mornings…) only ever take the normal step. | Easy on hack squat → +10, not +20. |
| **No faster jumps with any joint pain** | Even a joint-pain rating of 1 cancels "faster"; 2+ holds the lift. | Easy + joint pain 1 → normal. |
| **Rep jumps** | Never more than **+2 reps** a week at the same or heavier weight. | 50×8 at 3 RIR → 0 RIR = 50×10, not 50×11. |
| **Your own big jumps** | Typing a weight more than ~10% (and more than one step) over last week shows a warning with the safer max. Over 1.5× asks if it's a typo. Neither blocks you. | 70 → 88: "Big jump: +26% … about 75 is the safer max". |

When a guardrail trims a suggestion, the exercise note says so (e.g. "capped at about +10% a week" or "at this meso's +20% ceiling — adding reps instead"). Deload weeks are never affected. The 10% and 20% limits are deliberately conservative defaults built on the ACSM range; no trial has tested these exact caps.

### 4.4 How this logic lines up with the research

| Rule in the app | Evidence | Strength of evidence |
|---|---|---|
| 10–20 hard sets per muscle per week, more ≈ more growth with diminishing returns (§1.1) | Dose–response meta-analyses [1, 2, 26] | Strong |
| Sets taken close to failure (0–3 RIR) | Proximity-to-failure meta-regression and RCTs [4, 5, 6] | Strong for "close to failure works"; moderate on the exact best RIR |
| Wide rep range (about 5–30) grows muscle when close to failure | Load meta-analyses [9, 25] | Strong |
| Each muscle trained about 2×/week | Frequency meta-analyses [10, 11] | Moderate (volume matters more than frequency) |
| Progressive overload week to week (add reps or load) | ACSM position stand [25] | Strong as a principle |
| RIR stepping down across a meso (3 → 0) then a deload | Common periodization practice; deload studies are mixed [17, 18, 19] | Moderate–limited; practice-based |
| Adjusting load from reported effort (§4.3) | Autoregulation reviews and network meta-analysis [16, 34, 35, 36] | Moderate (mostly strength outcomes; few hypertrophy trials) |
| By-weight vs by-reps progression (§4.0) | Both are forms of double progression [36]; no trial shows one beats the other for growth | Practice-based |
| Injury guardrails (§4.5) | ACSM 2–10% increments [37]; rapid load spikes linked to soft-tissue injury [38] | Moderate (guideline + sports-injury research); exact caps are conservative defaults |
| Pump / soreness as signals | Not reliable indicators of growth [13, 14, 15] | Used only for volume nudges, never for load |
| Lift status uses performance, not RIR-credited estimates (§6.1) | RIR self-ratings are imprecise, especially far from failure [7, 8] | Design choice to avoid false "stalled" flags |

Honest limits: most autoregulation studies measure strength, not muscle size, and the exact sizes of the steps (+1 step for Easy, smaller for Pushed) are sensible defaults, not values tested in a trial. They're kept small on purpose and can be tuned.

## 5. Set (volume) adjustment, per muscle per session

Inputs:
- **R** = recovery (0–3)
- **L** = workload (0–3)
- **J** = joint pain (0–3)
- **P** = pump (0–3)
- **F** = performance (Up +1 / Same 0 / Down −1)

The rules are checked in order, and the first one that matches wins:

| # | Condition | Change to next week's sets for that muscle in that session | Why |
|---|---|---|---|
| 1 | J = 3 | −1 set, and the app flags "consider swapping this exercise" | Safety beats volume |
| 2 | R = 3 (still sore) | −1 set | Recovery is behind, so more volume adds damage without adding growth (1.6) |
| 3 | F = Down and R ≥ 2 | −1 set | Performance is dropping while recovery is only barely keeping up, which points to accumulated fatigue (1.7) |
| 4 | J = 2 | No change | Joint stress present, so hold |
| 5 | L = 3 (too much) | No change | Already at your limit |
| 6 | R ≤ 1 and L ≤ 1 and F ≥ Same | +1 set, or +2 if R = 0, L = 0 and P ≤ 1 | Recovered with room to spare and performance is holding, so add volume, the main growth lever (1.1) |
| 7 | Everything else (e.g., healed just in time) | No change | You're near your productive limit, so hold and let the RIR drop do the work |

### 5.1 RIR adjustment from feedback

When rule 1, 2, 3 or 5 fires (joint pain 3, still sore, performance down with slow recovery, or workload "too much"), that muscle's session **keeps this week's RIR next week** instead of stepping closer to failure. Going closer to failure adds fatigue, and these signals say recovery is already the bottleneck (1.2, 1.6). The normal step-down resumes the week after.

### 5.2 When the questions appear

- **Before you start a session:** recovery questions for any muscle in today's session whose last session hasn't been rated yet. You must answer these first, because they set next week's volume for that earlier session.
- **As soon as every set for a muscle is checked off:** pump, workload and joint pain for that muscle open in a **locked** sheet. It shows each of that muscle's exercises with its progression indicator (▲ up / ● same / ▼ down vs. last week, by estimated strength), and you can't dismiss it or continue until all three are answered. Every exercise also shows its progression badge as soon as its last set is checked. Tap ✎ on any exercise to adjust ratings afterward.
- **When you tap Finish:** the app calculates performance trend per muscle and saves it.

### 5.3 Order of days

**Inside a week, do the days in any order.** Want legs today instead of back? Home → "Do a different day this week", or tap the day on the meso page. Each day still progresses from the **same day last week** (legs from last week's legs), so the order you do them in doesn't change the numbers. Recovery questions ("how sore are you?") are about the session you **finished most recently** for that muscle.

**Weeks go in order.** A day in a later week can't be started while an earlier week still has open days — you can log those or skip them. You can still **look** at any later day: "Just look at…" opens a read-only preview (nothing can be logged and the day isn't started).

**One workout at a time.** If another day is in progress with nothing logged yet, you can switch to the day you want instead; if sets are already logged there, finish or skip it first (or preview the other day).

### 5.4 Slip warnings (week over week)

The app watches for early signs that training is slipping and shows them on Home, on the mesocycle page, and at the top of any workout that trains an affected muscle:

| Signal | Level | Meaning |
|---|---|---|
| Fewer sets done than planned in an exercise's latest session | Warn (Bad if half or fewer) | Sets aren't getting hit |
| Estimated strength down vs. last week (doc 1.7) | Warn | Reps or load slipped |
| Estimated strength down two weeks in a row | Bad | A real downward trend, not one rough day |
| "Still sore" at the last session (two in a row = Bad) | Warn / Bad | Recovery isn't keeping up (1.6) |
| Joint pain moderate or worse | Warn / Bad | Safety signal |
| Workload "too much" twice in a row | Warn | Volume is above what you can recover from |
| 3+ muscles slipping in the same week | Bad | Accumulated, systemic fatigue. Consider deloading early (1.8) |

Deload weeks and cardio are excluded from these checks.

### 5.5 Cardio inside workouts

Cardio can be added as an exercise in any workout (muscle group "Cardio"), logged as minutes + session RPE per bout. It can also be logged on its own from the Cardio page. Both count toward the dashboard's weekly cardio minutes and load (1.9). Cardio is never used in strength trends, volume or set adjustments.

**Cardio ratings are different from lifting ratings.** When every bout of cardio in a workout is checked off, a locked sheet asks:

| Rating | Scale | Why |
|---|---|---|
| **Breathing (talk test)** — replaces pump | 0 Could sing · 1 Talked easily · 2 Short phrases · 3 Couldn't talk | Comfortable speech is possible below the ventilatory/lactate threshold and not above it, so it works as a valid, practical intensity check across walking, jogging, cycling, elliptical and stairs. It's less practical for HIIT. Reed & Pipe 2014, *Curr Opin Cardiol* [doi:10.1097/HCO.0000000000000097](https://doi.org/10.1097/HCO.0000000000000097); Foster et al. 2008, *J Cardiopulm Rehabil Prev* [doi:10.1097/01.HCR.0000311504.41775.78](https://doi.org/10.1097/01.HCR.0000311504.41775.78) |
| Workload | Same 0–3 scale as lifting | |
| Joint pain | Same 0–3 scale as lifting | |
| Recovery / soreness | Asked at your next session with cardio | |

The cardio **progression indicator** compares session load (minutes × RPE) with last time. Cardio ratings are recorded and feed the watch list. They don't change lifting sets.

### 5.6 Carry-over between mesocycles

**Progression always comes from the meso before.**
- **Weeks 2+** progress week over week inside the current meso: each set's target comes from the same set last week (§4).
- **Week 1** of a new meso progresses from your **previous meso** only — the one you trained most recently, finished or not — using its last working (non-deload) week for that exercise. The reps are set back to the new week-1 RIR target. Example: AC VII ends with bent-over row 70 × 12 at 0 RIR → AC VIII week 1 starts from that.
- **Run it again from a chosen week.** On a meso's page, "↻ Run it again" copies the plan and asks which week to start from: the last working week before the deload, or up to two weeks before it (weeks with nothing logged can't be picked). The new meso's week 1 then starts from **that week's** logged weights and reps and progresses week over week from there. Example: a 7-week meso (week 7 = deload) where weeks 5–6 went badly → pick **week 4**. If week 4 was 70 × 12 at 1 RIR, the new week 1 (3 RIR) starts at 70 lb for about 10 reps, then builds back past where you stalled. "Don't carry weights" leaves week 1 for you to fill in.
- **An exercise that wasn't in the previous meso gets no auto weight.** If a meso changes completely there is no reliable way to translate one exercise into another, so you pick the weight. Older history for that exact exercise is shown for reference only, e.g. "No (bending, twisting…) wk 3 (70×30, 70×30) — not in your last meso, so not used". Mesos are labelled by name and week, never calendar dates.
- **Historical notice.** If last week's strength estimate is more than 5% below your all-time best for that lift, the exercise shows "📌 N% below your all-time best estimate — for reference only". It never changes the targets. Example: Incline press last week ≈106, all-time best ≈130 → "18% below".

- **Far outside the rep range.** If the carried-over reps are more than 3 outside the exercise's range (e.g. 30 reps on an 8–15 lift), adding one weight step isn't enough. The app re-solves the weight so the reps land at the edge of the range, using the strength estimate from §1.7 with reps + RIR capped at 20, because that formula overstates strength from very high-rep sets. Example: 70 × 30 → **75 × 15** at 3 RIR (not 75 × 26). It errs light; your first session's feedback corrects it.

**Limits on changes:**
- At most **12 sets per muscle in one session**.
- At most **22 sets per muscle per week** (diminishing returns, 1.1).
- Every exercise keeps **at least 1 set**.
- Added sets go to the **last exercise for that muscle** in the session. Removed sets come off the last exercise that still has more than one set.
- **No adjustments during the deload week.**

---

## 6. Things the app tracks for you to review

- **Home:** next workout, this week's progress, recovery questions waiting for an answer, weekly cardio load.
- **History:** every finished session, with sets, ratings and cardio.
- **Exercise progress:** each exercise's best estimated strength per session over time.
- **Muscle volume:** sets per muscle per week (direct + 0.5× indirect), compared with the target bands. Under 4 is maintenance or below, 10–20 is the productive range, over 22 gets flagged.
- **Cardio:** sessions, minutes, RPE and load per week.

---

### 6.0 Home drill-downs

Every number on Home opens the data behind it, counted the same way as the tile:
- **Hard sets** = completed lifting sets, not warm-ups and not cardio, grouped by Mon–Sun week.
- **Workouts** = finished workout days, skipped days not counted.
- **Cardio minutes** = cardio sessions plus cardio done inside workouts; load = RPE × minutes.
- **PRs this meso** = the §6.1 rule (a week's best strength estimate beats every earlier one by more than 1%).

Example: Home shows "Sets this week 42" → tap → Quads 12, Back 10, … → tap Quads → Hack Squat 4 sets, best 230×10 → tap → its chart.

### 6.1 Lift status flags (home screen, chart, and in the workout)

**Why this changed in 1.4.0.** In a mesocycle the target RIR drops every week (3 → 2 → 1 → 0). Following the plan exactly means adding about one rep, or a little weight, each week. The strength estimate in §1.7 gives credit for reps left in the tank, so +1 rep at 1 less RIR comes out **flat**. The old rule read that as "Stalled" — it was flagging people for doing exactly what the program asked.

Example from real data (bent-over row, AC VII): 70×9 @3 → 70×10 @2 → 70×11 @1 → 70×12 @0. Estimate = 70 × (1 + 12/30) = 98 every week → old rule: **Stalled**. New rule: performance 91 → 93 → 96 → 98 → **On track**, and vs AC VI week 4 (70×11 @0): **+1 rep at the same weight**.

**How a lift is judged now:**
- **Inside the current meso**, by meso week (not calendar dates): **performance** = weight × (1 + reps/30), with no RIR credit. That rises when you add reps or weight. Each meso week uses its best session. Deload weeks, warm-ups and myo-rep mini-sets are left out.
- **Against the previous meso**: the same meso week, so the same target RIR (AC VII week 4 vs AC VI week 4). This is where real strength gains show. It's shown under the status, e.g. "vs AC VI week 4: +1 rep at the same weight".
- **PRs** still use the RIR-credited estimate (§1.7): a true strength record that beats every earlier one by more than 1%.

Rules, checked in this order:

| Status | Rule | What the app tells you to do |
|---|---|---|
| 🏆 PR | Latest week's strength estimate beats every earlier one by more than 1% | Keep the plan — add a rep or a small weight jump as RIR drops. |
| 📉 Down | The last 2 meso weeks are both more than 3% below your best week earlier in this meso | Usually fatigue. Keep the weight, match last week's reps, rate recovery honestly so the set rules (§5) can trim volume; if it drops again, take the deload early. |
| ⚠️ Stalled | 3+ meso weeks and **no gain two weeks in a row** (each week within 1% of the one before, while the target got harder) | Keep the weight, go for +1 rep on the first set. Still flat? The deload is the fix — then start the next meso a week or two back ("Run it again", §5.6). |
| Dipped | Latest week more than 1% below last week (one week only) | One week isn't a trend. Last week's weight, match its reps. No flag in the workout. |
| On track | Latest week beat last week (any added rep or weight) | Keep going. |
| Held / New | Same as last week, or first week of the meso | Aim for +1 rep. Week 1 shows the comparison to the last meso. |

**AC VII check (Nov 21, 2026).** Under the old rule 6 lifts read Stalled (bent-over row, overhead triceps extension, lying curl, preacher curl, Pallof press, pec dec) — all of them were +1 rep/week exactly on plan. Under the new rule they're On track, and each is ahead of AC VI's same week (e.g. preacher curl 35×10 vs 35×9, Pallof 25×24 vs 25×23). Leg extension (200×8 → 205×5) and machine lateral raise (105×7 → 105×5) show **Dipped** for week 4.

**Chart page** has two views: **Performance** (default; what you lifted, rises through each meso and resets a little at each easier week 1) and **Strength estimate** (with RIR credit; flat when you hit the plan, steps up meso to meso).

**Where it shows:**
- **Home:** "This meso's lifts", with lifts that need attention listed first, and "PRs this meso". Tap any lift to open its chart.
- **Chart page:** the status and recommendation at the top; a This meso / 3 months / All range; 🏆 PR markers; and a dashed line where the meso started.
- **Workout:** a flag on the lift itself for Stalled, Down or last-time PR. Tap it for the full recommendation and a link to the chart. Today's unfinished session is left out, so the flag is about how the lift went in earlier sessions.

## 7. Sources (all retrieved from PubMed)

1. Schoenfeld BJ et al. Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci* 2017. https://doi.org/10.1080/02640414.2016.1210197
2. Pelland JC et al. The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency. *Sports Med* 2026. https://doi.org/10.1007/s40279-025-02344-w
3. Bickel CS et al. Exercise dosing to retain resistance training adaptations in young and older adults. *Med Sci Sports Exerc* 2011. https://doi.org/10.1249/MSS.0b013e318207c15d
4. Robinson ZP et al. Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy. *Sports Med* 2024. https://doi.org/10.1007/s40279-024-02069-2
5. Refalo MC et al. Similar muscle hypertrophy following eight weeks of resistance training to momentary muscular failure or with repetitions-in-reserve. *J Sports Sci* 2024. https://doi.org/10.1080/02640414.2024.2321021
6. Hermann et al. Without Fail: Muscular Adaptations in Single-Set Resistance Training Performed to Failure or with Repetitions-in-Reserve. *Med Sci Sports Exerc* 2025. https://doi.org/10.1249/MSS.0000000000003728
7. Refalo MC et al. Accuracy of Intraset Repetitions-in-Reserve Predictions During the Bench Press. *J Strength Cond Res* 2024. https://doi.org/10.1519/JSC.0000000000004653
8. Pelland JC et al. Methods for Controlling and Reporting Resistance Training Proximity to Failure. *Sports Med* 2022. https://doi.org/10.1007/s40279-022-01667-2
9. Schoenfeld BJ et al. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training. *J Strength Cond Res* 2017. https://doi.org/10.1519/JSC.0000000000002200
10. Schoenfeld BJ et al. How many times per week should a muscle be trained to maximize muscle hypertrophy? *J Sports Sci* 2019. https://doi.org/10.1080/02640414.2018.1555906
11. Schoenfeld BJ et al. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy. *Sports Med* 2016. https://doi.org/10.1007/s40279-016-0543-8
12. Kassiano W et al. Does Varying Resistance Exercises Promote Superior Muscle Hypertrophy and Strength Gains? *J Strength Cond Res* 2022. https://doi.org/10.1519/JSC.0000000000004258
13. Damas et al. Resistance training-induced changes in integrated myofibrillar protein synthesis are related to hypertrophy only after attenuation of muscle damage. *J Physiol* 2016. https://doi.org/10.1113/JP272472
14. Van Every et al. Load-induced human skeletal muscle hypertrophy: Mechanisms, myths, and misconceptions. *J Sport Health Sci* 2025. https://doi.org/10.1016/j.jshs.2025.101104
15. Hotfiel et al. Advances in Delayed-Onset Muscle Soreness (DOMS): Part I. *Sportverletz Sportschaden* 2018. https://doi.org/10.1055/a-0753-1884
16. Helms ER et al. Methods for Regulating and Monitoring Resistance Training. *J Hum Kinet* 2020. https://doi.org/10.2478/hukin-2020-0011
17. Coleman et al. Gaining more from doing less? The effects of a one-week deload period during supervised resistance training. *PeerJ* 2024. https://doi.org/10.7717/peerj.16777
18. Pancar et al. Effects of deload periods in resistance training on muscle hypertrophy and strength endurance in untrained young men. *Sci Rep* 2026. https://doi.org/10.1038/s41598-026-40612-5
19. De Marco et al. Resistance Training Prescription During Planned Deloading Periods: A Survey of Strength and Conditioning Coaches. *J Strength Cond Res* 2024. https://doi.org/10.1519/JSC.0000000000004932
20. Held S et al. Maximizing Adaptations in Concurrent Training: An Umbrella Review of Meta-analyses. *Sports Med* 2026. https://doi.org/10.1007/s40279-026-02401-y
21. Lundberg TR et al. The Effects of Concurrent Aerobic and Strength Training on Muscle Fiber Hypertrophy. *Sports Med* 2022. https://doi.org/10.1007/s40279-022-01688-x
22. Haddad M et al. Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors. *Front Neurosci* 2017. https://doi.org/10.3389/fnins.2017.00612

23. Reed JL, Pipe AL. The talk test: a useful tool for prescribing and monitoring exercise intensity. *Curr Opin Cardiol* 2014. https://doi.org/10.1097/HCO.0000000000000097
24. Foster C et al. The talk test as a marker of exercise training intensity. *J Cardiopulm Rehabil Prev* 2008. https://doi.org/10.1097/01.HCR.0000311504.41775.78
25. Currier BS et al. American College of Sports Medicine Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults. *Med Sci Sports Exerc* 2026. https://doi.org/10.1249/MSS.0000000000003897
26. Ralston GW et al. The Effect of Weekly Set Volume on Strength Gain: A Meta-Analysis. *Sports Med* 2017. https://doi.org/10.1007/s40279-017-0762-7
27. Schoenfeld BJ et al. Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. *J Strength Cond Res* 2016. https://doi.org/10.1519/JSC.0000000000001272
28. Bull FC et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med* 2020. https://doi.org/10.1136/bjsports-2020-102955
29. Milanović Z et al. Effectiveness of High-Intensity Interval Training (HIT) and Continuous Endurance Training for VO2max Improvements. *Sports Med* 2015. https://doi.org/10.1007/s40279-015-0365-0
30. Oliver JL et al. The Effects of Strength, Plyometric and Combined Training on Strength, Power and Speed Characteristics in High-Level Male Youth Soccer Players. *Sports Med* 2024. https://doi.org/10.1007/s40279-023-01944-8
31. Zheng T et al. Effects of plyometric training on jump, sprint, and change of direction performance in adolescent soccer players. *PLoS One* 2025. https://doi.org/10.1371/journal.pone.0319548

Sources 25–31 back the in-app **Learn** pages (goal guides for strength, athleticism, maintenance and cardio).
32. Kłobuchowski W et al. Exercise-Based Strategies from Warm-Up to Training: A Systematic Review of Performance Enhancement and Injury Prevention. *Sports (Basel)* 2026. https://doi.org/10.3390/sports14050187
33. Xu K et al. Optimizing Post-activation Performance Enhancement in Athletic Tasks: A Systematic Review with Meta-analysis. *Sports Med* 2025. https://doi.org/10.1007/s40279-024-02170-6
34. Huang Z et al. Autoregulated resistance training for maximal strength enhancement: A systematic review and network meta-analysis. *J Exerc Sci Fit* 2025. https://doi.org/10.1016/j.jesf.2025.07.006
35. Mann JB et al. The effect of autoregulatory progressive resistance exercise vs. linear periodization on strength improvement in college athletes. *J Strength Cond Res* 2010. https://doi.org/10.1519/JSC.0b013e3181def4a6
36. Suchomel TJ et al. Training for Muscular Strength: Methods for Monitoring and Adjusting Training Intensity. *Sports Med* 2021. https://doi.org/10.1007/s40279-021-01488-9
37. American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 2009. https://doi.org/10.1249/MSS.0b013e3181915670
38. Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? *Br J Sports Med* 2016. https://doi.org/10.1136/bjsports-2015-095788
