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

---

## 2. Mesocycle templates

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

---

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
- **As soon as every set for a muscle is checked off:** pump, workload and joint pain for that muscle pop up automatically. You can also open them from the "Rate" button.
- **When you tap Finish:** the app calculates performance trend per muscle and saves it.

### 5.3 Order of days

You can't start a day while an earlier day in the mesocycle is still open. The app tells you which day comes first and lets you go to it or skip it. If a workout is already in progress, the app sends you back to resume it.

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

### 5.6 Carry-over between mesocycles

In week 1 of a new mesocycle, each exercise's weight is auto-matched from your last finished mesocycle's final working week for that same exercise. The reps are set back to the new week-1 RIR target (3 RIR). This is how your imported RP history (AC IV, AC V) feeds your next block.

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
