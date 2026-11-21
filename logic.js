// Woodhouse Lifts training logic. Every rule here is documented, with its
// evidence, in "Woodhouse Lifts — Training Logic & Evidence" (Google Drive).
// Pure functions only, so they can be tested without a browser.

export const MUSCLES = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Calves', 'Traps', 'Abs', 'Forearms'];
export const UPPER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
export const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
export const MINOR = ['Traps', 'Abs', 'Forearms'];
const LARGE = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes'];
const sizeOf = m => LARGE.includes(m) ? 'large' : MINOR.includes(m) ? 'minor' : 'small';

// Doc §2.1 step 1 — starting weekly sets (low end of the productive range; feedback grows them).
const TARGETS = {
  focus:    { large: 10, small: 8, minor: 6 },
  whole:    { large: 8,  small: 6, minor: 3 },
  maintain: { large: 4,  small: 4, minor: 3 },
  skip:     { large: 0,  small: 0, minor: 0 },
};
export const PRIORITIES = ['focus', 'maintain', 'skip'];

// Doc §2.0 — weekly split: which muscles each training day is allowed to hold. Separate from the emphasis
// templates below (which muscles get extra volume). null = any muscle may go on that day.
const PUSH = ['Chest', 'Shoulders', 'Triceps'], PULL = ['Back', 'Biceps', 'Traps', 'Forearms'], LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'];
const UPPER_DAY = [...UPPER, 'Traps', 'Forearms'], LOWER_DAY = [...LOWER, 'Abs'];
const D = { full: { label: 'Full body', m: null }, push: { label: 'Push', m: PUSH }, pull: { label: 'Pull', m: PULL }, legs: { label: 'Legs', m: LEGS },
  upper: { label: 'Upper', m: UPPER_DAY }, lower: { label: 'Lower', m: LOWER_DAY } };
export const SPLITS = {
  full_body_split: { name: 'Full-body split', blurb: 'Every day trains part of the body; each muscle 2× a week on different days (like an RP whole-body split).',
    days: [2, 3, 4, 5, 6], recommend: [3, 4, 5, 6], layout: n => Array.from({ length: n }, (_, i) => ({ ...D.full, label: `Full body ${'ABCDEF'[i]}` })), every: false },
  full_body: { name: 'Full body', blurb: 'Every muscle, every session — fewer sets per muscle each day.',
    days: [2, 3, 4], recommend: [2], layout: n => Array.from({ length: n }, () => ({ ...D.full })), every: true },
  upper_lower: { name: 'Upper / Lower', blurb: 'Alternate upper-body and lower-body days.',
    days: [2, 4, 6], recommend: [4], layout: n => Array.from({ length: n }, (_, i) => ({ ...(i % 2 ? D.lower : D.upper) })), every: false },
  ppl: { name: 'Push / Pull / Legs', blurb: 'Push (chest, shoulders, triceps), Pull (back, biceps), Legs. 6 days hits everything twice.',
    days: [3, 6], recommend: [6], layout: n => Array.from({ length: n }, (_, i) => ({ ...[D.push, D.pull, D.legs][i % 3] })), every: false },
  ppl_ul: { name: 'PPL + Upper/Lower', blurb: 'Push, Pull, Legs, then Upper and Lower — everything twice in 5 days.',
    days: [5], recommend: [5], layout: () => [D.push, D.pull, D.legs, D.upper, D.lower].map(x => ({ ...x })), every: false },
};
export const splitsFor = days => Object.entries(SPLITS).filter(([, x]) => x.days.includes(days)).map(([k, x]) => ({ id: k, ...x, recommended: x.recommend.includes(days) }));
export const defaultSplit = days => splitsFor(days).find(x => x.recommended)?.id || 'full_body_split';
export const splitLayout = (split, days) => (SPLITS[split] && SPLITS[split].days.includes(days) ? SPLITS[split] : SPLITS.full_body_split).layout(days);

export const TEMPLATES = {
  upper:  { name: 'Upper focus', blurb: 'Grow chest, back, shoulders and arms; hold legs.' },
  lower:  { name: 'Lower focus', blurb: 'Grow quads, hamstrings, glutes and calves; hold upper body.' },
  whole:  { name: 'Balanced', blurb: 'Grow everything evenly, every muscle 2×+ a week.' },
  custom: { name: 'Custom', blurb: 'Start from whole body and set each muscle yourself.' },
};

export function templatePriorities(focus) {
  const p = {};
  for (const m of MUSCLES) {
    if (MINOR.includes(m)) p[m] = 'maintain';
    else if (focus === 'upper') p[m] = UPPER.includes(m) ? 'focus' : 'maintain';
    else if (focus === 'lower') p[m] = LOWER.includes(m) ? 'focus' : 'maintain';
    else p[m] = 'focus';
  }
  return p;
}

export function weeklyTarget(muscle, priority, focus, goal) {
  const table = priority === 'focus' && (focus === 'whole' || focus === 'custom') ? TARGETS.whole : TARGETS[priority] || TARGETS.skip;
  const base = table[sizeOf(muscle)], v = GOALS[goalOf(goal)].volume;
  return v === 1 || !base ? base : Math.max(2, Math.round(base * v)); // hypertrophy: unchanged
}

export function weeklyTargets(priorities, focus, goal) {
  const t = {};
  for (const m of MUSCLES) t[m] = weeklyTarget(m, priorities[m] || 'skip', focus, goal);
  return t;
}

// Doc §2.1 step 2 — how many days a week a muscle is trained.
export function frequency(sets, priority, days) {
  if (!sets || !days) return 0;
  if (priority === 'maintain') return Math.min(days, sets > 4 ? 2 : 1);
  return Math.max(1, Math.min(days, Math.max(2, Math.ceil(sets / 5))));
}

// Doc §2.1 step 5.
export function exercisesForSets(sets) { return sets <= 4 ? 1 : sets <= 8 ? 2 : 3; }

export function splitEven(total, parts) {
  const base = Math.floor(total / parts), extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

// Autofill picks from this order first (compounds and stable machines lead), then the rest of the library.
const PREFERRED = {
  Chest: ['Incline Dumbbell Press', 'Machine Chest Press', 'Barbell Bench Press', 'Incline Machine Press', 'Cable Fly', 'Pec Deck'],
  Back: ['Lat Pulldown', 'Chest-Supported Row', 'Pull-Up', 'Seated Cable Row', 'Single-Arm Dumbbell Row', 'Straight-Arm Pulldown'],
  Quads: ['Hack Squat', 'Leg Press', 'Back Squat', 'Leg Extension', 'Bulgarian Split Squat', 'Pendulum Squat'],
  Hamstrings: ['Romanian Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Stiff-Leg Deadlift'],
  Glutes: ['Hip Thrust', 'Machine Hip Thrust', 'Hip Abduction', 'Glute Kickback'],
  Shoulders: ['Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Machine Shoulder Press', 'Rear Delt Fly', 'Seated Dumbbell Press'],
  Biceps: ['Incline Dumbbell Curl', 'Cable Curl', 'Barbell Curl', 'Hammer Curl', 'Preacher Curl'],
  Triceps: ['Overhead Cable Extension', 'Triceps Pushdown', 'Skull Crusher', 'Close-Grip Bench Press'],
  Calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise'],
  Traps: ['Dumbbell Shrug', 'Barbell Shrug', 'Cable Shrug'],
  Abs: ['Cable Crunch', 'Hanging Leg Raise', 'Ab Wheel Rollout'],
  Forearms: ['Wrist Curl', 'Reverse Curl', 'Reverse Wrist Curl'],
};

export function candidatesFor(muscle, library, favorites = null) {
  const pool = library.filter(e => e.muscle_group === muscle);
  const fav = favorites ? pool.filter(e => favorites.has(e.id)) : [];   // the user's favorites first
  const pref = (PREFERRED[muscle] || []).map(n => pool.find(e => e.name === n)).filter(e => e && !fav.includes(e));
  const rest = pool.filter(e => !pref.includes(e) && !fav.includes(e))
    .sort((a, b) => (a.kind === 'compound' ? 0 : 1) - (b.kind === 'compound' ? 0 : 1) || (a.owner_id ? 0 : 1) - (b.owner_id ? 0 : 1) || a.name.localeCompare(b.name));
  return [...fav, ...pref, ...rest];
}

/**
 * Doc §2.2 — personal exercise preferences, applied before autofill picks anything.
 * prefs: [{ exercise_id, pref: 'favorite'|'exclude', substitute_id }], equipment: available list (null = all),
 * avoidTags: e.g. ['axial']. Excluded, tag-matched and unavailable-equipment exercises drop out; favorites and
 * chosen substitutes are always kept and ranked first. Cardio is never filtered by equipment.
 * Returns { library, favorites:Set, removed:[exercise] } — removed lets the UI say what was skipped and why.
 */
export function applyPreferences(library, { prefs = [], equipment = null, avoidTags = [] } = {}) {
  const favorites = new Set(prefs.filter(p => p.pref === 'favorite').map(p => p.exercise_id));
  for (const p of prefs) if (p.pref === 'exclude' && p.substitute_id) favorites.add(p.substitute_id);
  const excluded = new Set(prefs.filter(p => p.pref === 'exclude').map(p => p.exercise_id));
  const eq = equipment?.length ? new Set([...equipment, 'Bodyweight']) : null;
  const keep = [], removed = [];
  for (const e of library) {
    const why = favorites.has(e.id) ? null
      : excluded.has(e.id) ? 'excluded'
      : (e.tags || []).some(t => avoidTags.includes(t)) ? 'avoided'
      : eq && e.load_type !== 'cardio' && e.equipment && !eq.has(e.equipment) ? 'equipment' : null;
    (why ? removed : keep).push(why ? { ...e, why } : e);
  }
  return { library: keep, favorites, removed };
}

const slotOrder = (lib) => (a, b) => {
  const ma = MUSCLES.indexOf(a.muscle), mb = MUSCLES.indexOf(b.muscle);
  if (ma !== mb) return ma - mb;
  const ka = lib.get(a.exerciseId)?.kind === 'compound' ? 0 : 1, kb = lib.get(b.exerciseId)?.kind === 'compound' ? 0 : 1;
  return ka - kb;
};

/**
 * Doc §2.1 — build or complete a week of training days.
 * plan: [{ label, slots: [{ muscle, exerciseId|null, sets }] }]
 * mode: 'all' (rebuild from scratch) | 'fill' (keep what's there, place only what's missing)
 */
export function autofill({ plan, priorities, focus, library, mode, goal, favorites = null, split = null }) {
  const nDays = plan.length;
  const lib = new Map(library.map(e => [e.id, e]));
  const days = mode === 'all'
    ? plan.map(d => ({ label: d.label, slots: [] }))
    : plan.map(d => ({ label: d.label, slots: d.slots.map(s => ({ ...s })) }));
  const targets = weeklyTargets(priorities, focus, goal);
  // Split (doc §2.0): which days each muscle may go on. A muscle the split never schedules falls back to any day.
  const layout = split ? splitLayout(split, nDays) : null;
  if (layout && mode === 'all') days.forEach((d, i) => { if (!d.label || /^Day \d+$/.test(d.label)) d.label = layout[i].label; });
  const allowedDays = m => { if (!layout) return null; const ok = layout.map((d, i) => (!d.m || d.m.includes(m) ? i : -1)).filter(i => i >= 0); return ok.length ? new Set(ok) : null; };
  const everyDay = split && SPLITS[split]?.every;
  const used = {}; // muscle -> Set of exercise ids already in the week
  const take = (m, avoid) => {
    const cands = candidatesFor(m, library, favorites);
    if (!cands.length) return null;
    used[m] = used[m] || new Set();
    const pick = cands.find(e => !used[m].has(e.id) && !avoid.has(e.id)) || cands.find(e => !avoid.has(e.id)) || cands[0];
    used[m].add(pick.id); return pick.id;
  };
  for (const d of days) for (const s of d.slots) if (s.exerciseId) (used[s.muscle] = used[s.muscle] || new Set()).add(s.exerciseId);

  // Fill empty exercise slots the user left blank.
  for (const d of days) for (const s of d.slots) if (!s.exerciseId && s.muscle) {
    s.exerciseId = take(s.muscle, new Set(d.slots.map(x => x.exerciseId).filter(Boolean)));
    if (!s.sets) s.sets = 3;
  }

  const placed = {}; const onDay = {};
  for (const m of MUSCLES) { placed[m] = 0; onDay[m] = new Set(); }
  days.forEach((d, i) => d.slots.forEach(s => { placed[s.muscle] = (placed[s.muscle] || 0) + (s.sets || 0); (onDay[s.muscle] = onDay[s.muscle] || new Set()).add(i); }));
  const load = days.map(d => d.slots.reduce((a, s) => a + (s.sets || 0), 0));

  const order = MUSCLES.filter(m => targets[m] - placed[m] > 0).sort((a, b) => (targets[b] - placed[b]) - (targets[a] - placed[a]));
  for (const m of order) {
    const remaining = targets[m] - placed[m];
    const allowed = allowedDays(m);
    const avail = [...Array(nDays).keys()].filter(i => !onDay[m].has(i) && (!allowed || allowed.has(i)));
    if (!avail.length) { // every day already has this muscle: top up the lightest one
      const i = [...onDay[m]].sort((a, b) => load[a] - load[b])[0];
      const slot = days[i].slots.filter(s => s.muscle === m).pop(); slot.sets += remaining; load[i] += remaining; continue;
    }
    const want = everyDay && priorities[m] !== 'maintain' ? avail.length
      : Math.max(1, frequency(targets[m], priorities[m], allowed ? allowed.size : nDays) - onDay[m].size);
    const f = Math.min(want, avail.length);
    // Spread evenly from the lightest available day (doc §2.1 step 3).
    const start = avail.slice().sort((a, b) => load[a] - load[b] || a - b)[0];
    const chosen = [];
    for (let k = 0; k < f; k++) {
      const ideal = (start + Math.round(k * nDays / f)) % nDays;
      const pick = avail.filter(i => !chosen.includes(i))
        .sort((a, b) => Math.min(Math.abs(a - ideal), nDays - Math.abs(a - ideal)) - Math.min(Math.abs(b - ideal), nDays - Math.abs(b - ideal)) || load[a] - load[b])[0];
      chosen.push(pick);
    }
    chosen.sort((a, b) => a - b);
    splitEven(remaining, f).forEach((sets, k) => {
      if (!sets) return;
      const i = chosen[k];
      const avoid = new Set(days[i].slots.map(s => s.exerciseId).filter(Boolean));
      splitEven(sets, exercisesForSets(sets)).forEach(n => {
        const id = take(m, avoid); avoid.add(id);
        days[i].slots.push({ muscle: m, exerciseId: id, sets: n });
      });
      load[i] += sets; onDay[m].add(i);
    });
  }
  for (const d of days) d.slots.sort(slotOrder(lib));
  return days;
}

export function placedSets(plan) {
  const t = {}; for (const m of MUSCLES) t[m] = 0;
  for (const d of plan) for (const s of d.slots) if (s.muscle in t) t[s.muscle] += Number(s.sets) || 0;
  return t;
}

// Doc §1.2 — target RIR 3 → 0 across accumulation weeks; final week deload at 4 RIR.
export function rirForWeek(week, weeks) {
  const deload = weeks >= 3 && week === weeks;
  if (deload) return { rir: 4, deload: true };
  const n = weeks >= 3 ? weeks - 1 : weeks;
  if (n <= 1) return { rir: 2, deload: false };
  return { rir: Math.max(0, 3 - Math.round((week - 1) * 3 / (n - 1))), deload: false };
}

// Doc §1.10 — training goal per mesocycle. Hypertrophy IS the original engine and is returned unchanged;
// strength and athleticism only change rep ranges, the RIR schedule and starting volume. Progression
// (double progression, set adjustment from feedback, deloads) is the same machinery for all three.
//   Strength: heavy main lifts (≥80% 1RM ≈ 3–6 reps), never to failure (RIR floor 1), ~25% fewer sets.
//   Athleticism: explosive main lifts 3–5 reps held far from failure (3 RIR, stop when speed drops),
//                accessories 8–12 at ≥2 RIR, ~40% fewer sets (low-volume power work, ACSM 2026).
export const GOALS = {
  hypertrophy: { name: 'Hypertrophy', blurb: 'Build muscle size. Moderate reps, effort rises to near failure, most sets.', volume: 1 },
  strength: { name: 'Strength', blurb: 'Lift heavier. Main lifts 3–6 reps, accessories 6–12, never to failure, fewer sets.', volume: 0.75,
    reps: { compound: [3, 6], isolation: [6, 12] }, rirFloor: { compound: 1, isolation: 1 } },
  athletic: { name: 'Athleticism', blurb: 'Power & speed. Explosive main lifts 3–5 reps far from failure, accessories 8–12, least volume.', volume: 0.6,
    reps: { compound: [3, 5], isolation: [8, 12] }, rirFixed: { compound: 3 }, rirFloor: { isolation: 2 } },
};
export const goalOf = g => (GOALS[g] ? g : 'hypertrophy');

/** Target RIR for one exercise in one week. kind = 'compound' | 'isolation'. Hypertrophy → rirForWeek(). */
export function targetRir(week, weeks, goal, kind) {
  const base = rirForWeek(week, weeks), G = GOALS[goalOf(goal)];
  if (base.deload) return base;
  const k = kind === 'compound' ? 'compound' : 'isolation';
  if (G.rirFixed?.[k] != null) return { rir: G.rirFixed[k], deload: false };
  return { rir: Math.max(base.rir, G.rirFloor?.[k] ?? 0), deload: false };
}

/** Rep range for an exercise under a goal. Hypertrophy (and cardio) keep the exercise's own range. */
export function repRange(ex, goal) {
  const G = GOALS[goalOf(goal)];
  if (!G.reps || ex?.load_type === 'cardio') return { rep_min: ex?.rep_min ?? 5, rep_max: ex?.rep_max ?? 30 };
  const [rep_min, rep_max] = G.reps[ex?.kind === 'compound' ? 'compound' : 'isolation'];
  return { rep_min, rep_max };
}

// Doc §4.2 — warm-up guidance (never logged, never counted as hard sets).
// General warm-up first (5 min easy cardio + dynamic moves), then ramp-up sets on the FIRST exercise for a
// muscle that day. Ramp sets are light and short so they prime the pattern without adding fatigue.
// workWeight is in the display unit; returns [{ weight, reps, note }] rounded to real plate/dumbbell jumps.
export function warmupPlan({ ex, workWeight, firstForMuscle = true, unit = 'lb' }) {
  const lt = ex?.load_type;
  if (lt === 'cardio') return [{ weight: null, reps: null, note: 'Start easy for 3–5 min, then build to working pace.' }];
  if (!firstForMuscle) return [{ weight: null, reps: null, note: 'Muscle already warm — optional: 1 light set of 5–6 at about half your working weight.' }];
  if (lt === 'bodyweight' || lt === 'assisted' || !workWeight) {
    return [{ weight: null, reps: 8, note: lt === 'assisted' ? 'Extra assistance, easy' : 'Easy, smooth reps' },
            { weight: null, reps: 4, note: lt === 'assisted' ? 'Close to working assistance' : 'A little harder' }];
  }
  const inc = increment(ex, unit);
  const bar = ex?.equipment === 'Barbell' ? (unit === 'kg' ? 20 : 45) : 0;
  const round = w => Math.max(bar, Math.round(w / inc) * inc);
  const steps = ex?.kind === 'compound' ? [[0.5, 8], [0.7, 4], [0.85, 2]] : [[0.5, 10], [0.75, 4]];
  const out = []; let last = -1;
  for (const [pct, reps] of steps) {
    const w = round(workWeight * pct);
    if (w >= workWeight || w === last) continue;   // never warm up at or above the working weight; no repeats
    out.push({ weight: w, reps, note: `${Math.round(pct * 100)}%` }); last = w;
  }
  return out.length ? out : [{ weight: null, reps: 8, note: 'One easy set of 8 with a light weight' }];
}

// Doc §6.1 — per-lift status. Callers pass WEEKLY bests (weeklyBest) from the last ~6 months; deloads,
// myo-reps and warm-ups are already excluded. sessions: [{ e (e1RM), date }] oldest → newest.
// priorBest: best e1RM from older (but still recent) weeks not in the list.
// Statuses, checked in this order (±1% is treated as "the same", matching §1.7):
//   new         fewer than 2 sessions
//   pr          latest beats every earlier session by >1%
//   regressing  the last 2 weeks are both >3% below the best of the 4 weeks before them
//   stalled     4+ weeks and the best of the last 3 is within ±1% of the best of the 6 weeks before them
//   progressing latest is >1% above the oldest session in the window
//   steady      anything else
export function liftStatus(sessions, priorBest = null, { name = 'this lift', rir = null } = {}) {
  const s = (sessions || []).filter(x => x.e > 0);
  const pct = (a, b) => (a - b) / b * 100;
  if (s.length < 2) return { status: 'new', label: 'New', pct: null, rec: 'Log a couple of sessions and trends show up here.' };
  const last = s[s.length - 1].e;
  const before = Math.max(priorBest || 0, ...s.slice(0, -1).map(x => x.e));
  if (last > before * 1.01) {
    return { status: 'pr', label: 'PR', pct: pct(last, before),
      rec: `New best on ${name} (+${pct(last, before).toFixed(1)}%). Keep the same plan — add a rep or a small jump in weight when you beat the top of the rep range.` };
  }
  if (s.length >= 3) {
    // "Down" = a RECENT drop: last 2 weeks vs the best of the 4 weeks before them (one odd week months ago can't trigger it)
    const a = s[s.length - 1].e, b = s[s.length - 2].e;
    const earlierBest = Math.max(...s.slice(-6, -2).map(x => x.e));
    if (a < earlierBest * 0.97 && b < earlierBest * 0.97) {
      return { status: 'regressing', label: 'Down', pct: pct(a, earlierBest),
        rec: `Down ${Math.abs(pct(a, earlierBest)).toFixed(1)}% for 2 weeks — usually fatigue, not lost strength. Today: keep the weight, aim to match last time's reps${rir != null ? ` at ${rir} RIR` : ''}, and rate recovery honestly so the app can trim sets. If it drops again next week, take an early deload or lighter week.` };
    }
  }
  if (s.length >= 4) {
    // "Stalled" = no new best for 3 weeks vs your recent peak (the 6 weeks before them)
    const recent = Math.max(...s.slice(-3).map(x => x.e));
    const earlier = Math.max(...s.slice(-9, -3).map(x => x.e));
    if (recent <= earlier * 1.01 && recent >= earlier * 0.99) {
      return { status: 'stalled', label: 'Stalled', pct: pct(recent, earlier),
        rec: `No progress for 3 weeks. Today: keep the weight and add 1 rep to your first set only (double progression — reps before load). Still stuck next week? Drop the weight 5–10% and build back up over 2–3 weeks, or swap to a close variation next mesocycle.` };
    }
  }
  const first = s[0].e;
  if (last > first * 1.01) return { status: 'progressing', label: 'Up', pct: pct(last, first), rec: `Up ${pct(last, first).toFixed(1)}% over ${s.length} weeks — keep going.` };
  return { status: 'steady', label: 'Steady', pct: pct(last, first), rec: 'Holding steady — keep chasing an extra rep at the same weight.' };
}

/**
 * Doc §6.1 (v1.4) — lift status judged the way the program is run.
 * In an RP-style meso the target RIR drops each week (3 → 2 → 1 → 0), so adding a rep or a little weight every week
 * IS the plan. A strength estimate that includes RIR stays flat when you do exactly that, so it must not be used to
 * call a lift "stalled". Instead:
 *   - Within the current meso: compare PERFORMANCE (load × reps, no RIR credit) week over week, by meso week.
 *   - Across mesos: compare the same meso week (same target RIR), e.g. AC VII week 4 vs AC VI week 4.
 *   - PR: the RIR-adjusted estimate beats every earlier one by > 1% (a true strength record).
 * entries: [{ meso, mesoName, week, e (RIR-adjusted), raw (no RIR), top: { weight, reps } }] in time order, one per
 * meso week (best by raw), deload weeks already removed.
 */
export function mesoStatus(entries, priorBest = null, { name = 'this lift', rir = null } = {}) {
  const pct = (a, b) => (a - b) / b * 100;
  const es = (entries || []).filter(x => x.raw > 0);
  if (!es.length) return { status: 'new', label: 'New', pct: null, rec: 'Log a couple of weeks and trends show up here.', vs: null };
  const last = es[es.length - 1];
  const cur = es.filter(x => x.meso === last.meso);
  const vs = vsLastMeso(es);
  const before = Math.max(priorBest || 0, ...es.slice(0, -1).map(x => x.e));
  if (before > 0 && last.e > before * 1.01) {
    return { status: 'pr', label: 'PR', pct: pct(last.e, before), vs,
      rec: `New best on ${name} (+${pct(last.e, before).toFixed(1)}% estimated strength). Keep the same plan — add a rep or a small jump in weight as RIR drops.` };
  }
  if (cur.length < 2) return { status: 'new', label: 'New', pct: null, vs, rec: vs ? `First week of this meso. ${vs.text}` : 'First week of this meso — trends show from week 2.' };
  const a = cur[cur.length - 1].raw, b = cur[cur.length - 2].raw;
  if (cur.length >= 3) {
    const best = Math.max(...cur.slice(0, -2).map(x => x.raw));
    if (a < best * 0.97 && b < best * 0.97) {
      return { status: 'regressing', label: 'Down', pct: pct(a, best), vs,
        rec: `Down ${Math.abs(pct(a, best)).toFixed(1)}% from your best week this meso, two weeks running — usually fatigue, not lost strength. Today: keep the weight, aim to match last week's reps${rir != null ? ` at ${rir} RIR` : ''}, and rate recovery honestly so the app can trim sets. If it drops again, take the deload early.` };
    }
    const c = cur[cur.length - 3].raw;
    if (a <= b * 1.01 && b <= c * 1.01) {
      return { status: 'stalled', label: 'Stalled', pct: pct(a, c), vs,
        rec: `No gain for 2 weeks in a row, even as the target got harder. Today: keep the weight and go for +1 rep on your first set. Still flat next week? The deload is the fix — then start the next meso a week or two back ("Run it again").` };
    }
  }
  if (a > b * 1.005) return { status: 'progressing', label: 'On track', pct: pct(a, b), vs, rec: `Beat last week (+${pct(a, b).toFixed(1)}%). Keep going — next week add a rep or a small weight jump.` };
  if (a < b * 0.99) return { status: 'dip', label: 'Dipped', pct: pct(a, b), vs, rec: `Below last week (${pct(a, b).toFixed(1)}%). One week isn't a trend — sleep, food and stress all show up here. Today: last week's weight, aim to match its reps.` };
  return { status: 'steady', label: 'Held', pct: pct(a, b), vs, rec: 'Same as last week — fine for one week. Aim for +1 rep on your first set.' };
}
/** Same meso week in the previous meso that has this lift (falls back to its closest week). */
export function vsLastMeso(entries) {
  const es = entries || []; if (!es.length) return null;
  const last = es[es.length - 1];
  const prev = es.filter(x => x.meso !== last.meso); if (!prev.length) return null;
  const pm = prev[prev.length - 1].meso, pw = prev.filter(x => x.meso === pm);
  const m = pw.find(x => x.week === last.week) || pw.reduce((p, q) => Math.abs(q.week - last.week) < Math.abs(p.week - last.week) ? q : p);
  const d = (last.raw - m.raw) / m.raw * 100;
  const t = last.top, u = m.top;
  const how = t && u && Number(t.weight) === Number(u.weight) && t.reps !== u.reps ? `${t.reps > u.reps ? '+' : ''}${t.reps - u.reps} rep${Math.abs(t.reps - u.reps) === 1 ? '' : 's'} at the same weight`
    : `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
  return { mesoName: m.mesoName, week: m.week, pct: d, text: `vs ${m.mesoName} week ${m.week}: ${how}.` };
}
/** PRs within one meso: entries of that meso whose RIR-adjusted estimate beats everything before it by > 1%. */
export function prsInMeso(entries, priorBest, meso) {
  let best = priorBest || 0, n = 0, top = null;
  for (const x of entries || []) {
    if (!(x.e > 0)) continue;
    if (x.meso === meso && best > 0 && x.e > best * 1.01) { n++; top = { pct: (x.e - best) / best * 100, week: x.week }; }
    best = Math.max(best, x.e);
  }
  return { count: n, last: top };
}

/**
 * Doc §6.1 — collapse sessions to the best session per calendar week (Mon–Sun). Many programs train a lift on a
 * heavier and a lighter day; comparing those to each other would look like constant ups and downs.
 * If the latest (current) week is still below the week before, it's dropped — an unfinished week can only ever
 * show improvement, never a false "down".
 */
export function weeklyBest(sessions, today = new Date()) {
  const wk = d => { const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const by = new Map();
  for (const x of sessions || []) { const k = wk(x.date); const cur = by.get(k); if (!cur || x.e > cur.e) by.set(k, { ...x, date: k }); }
  const out = [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = wk(today.toISOString?.() ? today.toISOString().slice(0, 10) : today);
  if (out.length >= 2 && out[out.length - 1].date === thisWeek && out[out.length - 1].e < out[out.length - 2].e) out.pop();
  return out;
}

/** PRs set on or after `since` (ISO date): sessions that beat every earlier session (and priorBest) by >1%. */
export function prsSince(sessions, priorBest, since) {
  let best = priorBest || 0, n = 0, top = null;
  for (const x of sessions || []) {
    if (!(x.e > 0)) continue;
    if (best > 0 && x.e > best * 1.01 && (!since || String(x.date) >= since)) { n++; top = { pct: (x.e - best) / best * 100, date: x.date }; }
    best = Math.max(best, x.e);
  }
  return { count: n, last: top };
}

// Units: every weight is STORED in pounds (canonical). These convert at the screen boundary only,
// so switching lb ↔ kg never changes the physical weight on record. 2-decimal rounding matches the
// database (numeric(6,2)) and round-trips exactly: fromUnit(toUnit(x)) === x for any 0.01 kg value.
export const LB_PER_KG = 2.2046226218;
export const toUnit = (lb, unit) => (lb == null || lb === '') ? null
  : unit === 'kg' ? Math.round(Number(lb) / LB_PER_KG * 100) / 100 : Number(lb);
export const fromUnit = (v, unit) => (v == null || v === '') ? null
  : unit === 'kg' ? Math.round(Number(v) * LB_PER_KG * 100) / 100 : Number(v);

// Doc §1.7 — estimated strength from a set.
export function effectiveLoad(weight, loadType, bodyweight) {
  const w = Number(weight) || 0, bw = Number(bodyweight) || 0;
  if (loadType === 'bodyweight') return bw + w;
  if (loadType === 'assisted') return Math.max(0, bw - w);
  return w;
}
export function e1rm(set, ex, bodyweight) {
  if (set?.reps == null) return null;
  const load = effectiveLoad(set.weight, ex?.load_type, bodyweight);
  const reps = Number(set.reps) + (Number(set.rir) || 0);
  if (load <= 0) return reps; // bodyweight without a known bodyweight: compare reps-to-failure
  return load * (1 + reps / 30);
}
export function bestE1rm(sets, ex, bodyweight) {
  const v = (sets || []).map(s => e1rm(s, ex, bodyweight)).filter(x => x != null);
  return v.length ? Math.max(...v) : null;
}
// Doc §1.7 — Up (+1) / Same (0) / Down (−1) at a ±1% band.
export function performanceTrend(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  const r = (cur - prev) / prev;
  return r > 0.01 ? 1 : r < -0.01 ? -1 : 0;
}
export function combineTrends(trends) {
  const t = trends.filter(x => x != null);
  if (!t.length) return null;
  const s = t.reduce((a, b) => a + b, 0);
  return s > 0 ? 1 : s < 0 ? -1 : 0;
}

// Doc §4 — load increments.
export function increment(ex, unit) {
  if (unit === 'kg') return ex?.equipment === 'Dumbbell' ? 2 : 2.5;
  return 5;
}

/**
 * Doc §4 — suggestion for this week's set from last week's matching set.
 * prev: { weight, reps, rir }, prevTargetRir used when RIR wasn't logged.
 * Returns { weight, reps } or null when there's no history.
 */
/**
 * Doc §4.0 — how a lift progresses week to week. RP-style programs move some lifts by adding WEIGHT at the same reps
 * (machines, cables, sleds: pec dec 175×8 → 180×8 → 185×8) and others by adding REPS at the same weight (dumbbells,
 * barbells: row 70×9 → 70×10 → 70×11). Learned from this lift's own last week-to-week change in the meso; with no
 * history yet, machines and cables default to weight, everything else to reps.
 * trail: [{ weight, reps }] top sets by meso week, oldest first. Returns { mode: 'load'|'reps', step }.
 */
export function progressionMode(trail, ex, unit) {
  const inc = increment(ex, unit);
  const t = (trail || []).filter(x => x && x.weight != null && x.reps != null);
  for (let i = t.length - 1; i > 0; i--) {
    const dw = Number(t[i].weight) - Number(t[i - 1].weight), dr = Number(t[i].reps) - Number(t[i - 1].reps);
    if (dw > 0) return { mode: 'load', step: dw };
    if (dw === 0 && dr > 0) return { mode: 'reps', step: inc };
  }
  const byEquip = ['Machine', 'Cable'].includes(ex?.equipment) || /sled/i.test(ex?.name || '');
  return { mode: ex?.load_type === 'weighted' && byEquip ? 'load' : 'reps', step: inc };
}
/**
 * Doc §4.3 — how fast to progress this week, from last session's feedback for that muscle (autoregulation: the
 * effort you reported adjusts the next load, as in RPE/RIR and APRE methods). Workload drives it; pump does not
 * change the load (pump isn't a reliable hypertrophy signal) — pump and soreness adjust SETS instead (§5).
 *   joint pain ≥ 2 or workload "Too much"   → hold   (same weight & reps)
 *   workload "Pushed my limit"              → slow   (smaller jump)
 *   workload "Easy"                         → fast   (one extra step)
 *   otherwise / no feedback                 → normal
 */
export function progressionSpeed(fb) {
  if (!fb) return { speed: 'normal', why: null };
  if ((fb.joint_pain ?? 0) >= 2) return { speed: 'hold', why: 'joint pain last time' };
  if (fb.workload === 3) return { speed: 'hold', why: 'you rated last time "Too much"' };
  if (fb.workload === 2) return { speed: 'slow', why: 'you pushed your limit last time' };
  if (fb.workload === 0) return { speed: 'fast', why: (fb.pump ?? 1) <= 1 ? 'last time felt easy with little pump' : 'last time felt easy' };
  return { speed: 'normal', why: null };
}
export function suggestSet({ prev, ex, targetRir, prevTargetRir, deload, jointHold, unit, mode = null, speed = null }) {
  const sp = speed?.speed || 'normal';
  if (sp === 'hold' && prev && prev.reps != null && !deload) jointHold = true;
  // Load progression: the week's RIR drop is taken as more weight at the same reps (RP style), not +1 rep.
  if (mode?.mode === 'load' && prev && prev.reps != null && prev.weight != null && !deload && !jointHold && ex?.load_type === 'weighted') {
    const loggedRir = prev.rir != null ? Number(prev.rir) : (prevTargetRir ?? targetRir);
    const drop = loggedRir - targetRir, min = ex?.rep_min ?? 5, max = ex?.rep_max ?? 30;
    if (drop > 0 && Number(prev.reps) >= min && Number(prev.reps) <= max) {
      const step = mode.step > 0 ? mode.step : increment(ex, unit), w0 = Number(prev.weight), u = unit || 'lb';
      if (sp === 'slow') return { weight: w0, reps: Number(prev.reps) + drop, note: `Same weight, +${drop} rep — ${speed.why}` };
      let add = step * drop;
      if (sp === 'fast') { const inc = increment(ex, unit); add = Math.min(step * (drop + 1), Math.max(step * drop, Math.round(w0 * 0.10 / inc) * inc)); }
      return { weight: Math.max(barFloor(ex, unit), w0 + add), reps: Number(prev.reps), note: `+${add} ${u}, same reps${sp === 'fast' && add > step * drop ? ` — faster: ${speed.why}` : ''}` };
    }
  }
  const r = suggestSetRaw({ prev, ex, targetRir, prevTargetRir, deload, jointHold, unit, extraReps: sp === 'fast' ? 1 : sp === 'slow' ? -1 : 0 });
  if (r && sp !== 'normal' && !deload && r.note == null && speed?.why) r.note = sp === 'fast' ? `+1 extra rep — ${speed.why}` : `Smaller jump — ${speed.why}`;
  if (r && sp === 'hold' && !deload && speed?.why) r.note = `Holding — ${speed.why}`;
  return r && r.weight != null ? { ...r, weight: Math.max(barFloor(ex, unit), r.weight) } : r;
}
// Guardrail: barbell suggestions never go below the empty bar.
export const barFloor = (ex, unit) => (ex?.equipment === 'Barbell' && ex?.load_type === 'weighted' ? (unit === 'kg' ? 20 : 45) : 0);
/**
 * Guardrail: likely typo when a typed weight is 1.5× or more, or half or less, of the same set last time
 * (e.g. 2250 for 225). Returns null when it looks fine.
 */
export function weightSanity(prevWeight, newWeight) {
  const a = Number(prevWeight), b = Number(newWeight);
  if (!(a > 0) || !(b > 0)) return null;
  if (b >= a * 1.5) return { kind: 'high', ratio: b / a };
  if (b <= a * 0.5) return { kind: 'low', ratio: b / a };
  return null;
}
function suggestSetRaw({ prev, ex, targetRir, prevTargetRir, deload, jointHold, unit, extraReps = 0 }) {
  if (!prev || prev.reps == null) return null;
  const weight = prev.weight == null ? (ex?.load_type === 'weighted' ? null : 0) : Number(prev.weight);
  const loggedRir = prev.rir != null ? Number(prev.rir) : (prevTargetRir ?? targetRir);
  const min = ex?.rep_min ?? 5, max = ex?.rep_max ?? 30;
  if (jointHold) return { weight, reps: Number(prev.reps), note: 'Holding — joint pain last time' };
  // reps mode: +1 rep per RIR dropped; fast adds one more, slow adds one fewer (never below last week's reps)
  let reps = Number(prev.reps) + Math.max(0, (loggedRir - targetRir) + (deload ? 0 : extraReps));
  if (loggedRir - targetRir < 0) reps = Number(prev.reps) + (loggedRir - targetRir);
  if (deload) return { weight, reps: Math.max(1, Math.min(reps, Number(prev.reps))), note: 'Deload' };
  const inc = increment(ex, unit);
  let w = weight;
  // Far outside the rep range (e.g. a light rehab block at 70 × 30 on an 8–15 lift): one small weight step can't fix it.
  // Re-solve the load so the reps land in range. High-rep sets overstate strength with this formula, so the reps+RIR
  // used for the estimate are capped at 20 — this errs light, and the next session's feedback corrects it.
  if (w != null && w > 0 && ex?.load_type === 'weighted' && (reps > max + 3 || reps < min - 3)) {
    const bench = w * (1 + Math.min(20, Number(prev.reps) + loggedRir) / 30);
    const goal = reps > max ? max : min;
    const nw = Math.max(inc, Math.round(bench / (1 + (goal + targetRir) / 30) / inc) * inc);
    return { weight: nw, reps: goal, note: 'Re-set into the rep range' };
  }
  if (reps > max && w != null) {
    w = ex?.load_type === 'assisted' ? Math.max(0, w - inc) : w + inc;
    reps = Math.max(min, reps - 2);
  } else if (reps < min && w != null && w > 0 && ex?.load_type !== 'bodyweight') {
    w = ex?.load_type === 'assisted' ? w + inc : Math.max(0, w - inc);
    reps = Math.min(max, reps + 2);
  }
  return { weight: w, reps: Math.max(1, reps) };
}

/**
 * Doc §4.1 — equivalent-effort reps when you pick a different weight than suggested.
 * Uses last time's set as the strength benchmark (same e1RM model as §1.7: load × (1 + (reps + RIR)/30))
 * and solves for the reps at the new load and this week's target RIR.
 * Returns { lo, hi, outside } — lo = match last time, hi = beat it by one rep;
 * outside = 'heavy' | 'light' when the matching reps fall outside the exercise's effective rep range.
 */
export function repsAtLoad({ prev, ex, weight, targetRir, prevTargetRir, bodyweight }) {
  if (!prev || prev.reps == null || weight == null || weight === '') return null;
  const bench = e1rm({ ...prev, rir: prev.rir ?? prevTargetRir ?? targetRir }, ex, bodyweight);
  const load = effectiveLoad(weight, ex?.load_type, bodyweight);
  if (!bench || load <= 0) return null;
  const reps = 30 * (bench / load - 1) - (targetRir ?? 0);
  const lo = Math.max(1, Math.round(reps)), hi = lo + 1;
  const min = ex?.rep_min ?? 5, max = ex?.rep_max ?? 30;
  return { lo, hi, outside: lo < min ? 'heavy' : lo > max ? 'light' : null };
}

/**
 * Doc §4.1 — the weight window that keeps the matching reps inside the exercise's rep range
 * (heaviest = rep_min, lightest = rep_max), rounded to the load increment. Weighted lifts only.
 */
export function weightRange({ prev, ex, targetRir, prevTargetRir, bodyweight, unit }) {
  if (!prev || prev.reps == null || ex?.load_type !== 'weighted') return null;
  const bench = e1rm({ ...prev, rir: prev.rir ?? prevTargetRir ?? targetRir }, ex, bodyweight);
  if (!bench) return null;
  const inc = increment(ex, unit), min = ex?.rep_min ?? 5, max = ex?.rep_max ?? 30, t = targetRir ?? 0;
  const heavy = Math.floor(bench / (1 + (min + t) / 30) / inc) * inc;
  const light = Math.ceil(bench / (1 + (max + t) / 30) / inc) * inc;
  return light <= heavy ? { light, heavy } : null;
}

/**
 * Doc §5 — next week's set change for one muscle in one session.
 * R recovery, L workload, J joint pain, P pump (0–3), F performance (−1/0/1). Missing → treated as neutral.
 */
export function setAdjustment({ R, L, J, P, F }) {
  const n = v => (v == null ? null : Number(v));
  R = n(R); L = n(L); J = n(J); P = n(P); F = n(F);
  // holdRir: next week keeps this week's RIR for this muscle instead of stepping closer to failure (doc §5.1).
  if (J === 3) return { delta: -1, holdRir: true, flag: 'Joint pain — consider swapping this exercise', rule: 1 };
  if (R === 3) return { delta: -1, holdRir: true, rule: 2 };
  if (F === -1 && R != null && R >= 2) return { delta: -1, holdRir: true, rule: 3 };
  if (J === 2) return { delta: 0, rule: 4 };
  if (L === 3) return { delta: 0, holdRir: true, rule: 5 };
  if (R != null && R <= 1 && L != null && L <= 1 && (F == null || F >= 0)) {
    return { delta: R === 0 && L === 0 && (P == null || P <= 1) ? 2 : 1, rule: 6 };
  }
  return { delta: 0, rule: 7 };
}

/** Deload sets = half of the final accumulation week's (already adjusted) sets, rounded up (doc §1.8). */
export const deloadSets = lastWeekSets => Math.max(1, Math.ceil((lastWeekSets || 0) / 2));
export const SESSION_CAP = 12, WEEKLY_CAP = 22;

/** Apply a delta to one muscle's exercises in a session; returns [{id, target_sets}] changes. */
export function distributeDelta(exs, delta, { sessionTotal, weeklyTotal }) {
  if (delta > 0) delta = Math.max(0, Math.min(delta, SESSION_CAP - sessionTotal, WEEKLY_CAP - weeklyTotal));
  if (!delta || !exs.length) return [];
  const list = exs.map(e => ({ id: e.id, target_sets: e.target_sets || 0 }));
  if (delta > 0) { list[list.length - 1].target_sets += delta; return [list[list.length - 1]]; }
  const changed = new Set();
  for (let left = -delta; left > 0; left--) {
    const t = [...list].reverse().find(e => e.target_sets > 1);
    if (!t) break; t.target_sets--; changed.add(t);
  }
  return [...changed];
}

// Doc §1.9 — cardio session load.
export const cardioLoad = c => (Number(c.rpe) || 0) * (Number(c.minutes) || 0);

// Volume bands (doc §6).
export function volumeBand(sets) {
  if (sets < 4) return 'low';
  if (sets < 10) return 'maintain';
  if (sets <= 20) return 'productive';
  if (sets <= 22) return 'high';
  return 'over';
}

/**
 * Week-over-week slip warnings (doc §5.4). Inputs are completed, non-deload sessions.
 * exercises: [{ key, name, muscle, weeks: [{ week, targetSets, sets: [{weight,reps,rir}], ex }] }] sorted by week
 * feedback:  [{ muscle, week, day, soreness, workload, joint_pain }] sorted oldest → newest
 */
export function slipWarnings({ exercises = [], feedback = [], bodyweight } = {}) {
  const out = [];
  const downNow = new Set();
  for (const e of exercises) {
    const w = e.weeks.filter(x => x.sets.length || x.targetSets);
    if (!w.length) continue;
    const last = w[w.length - 1];
    const done = last.sets.length;
    if (last.targetSets && done < last.targetSets) {
      out.push({ level: done <= last.targetSets / 2 ? 'bad' : 'warn', muscle: e.muscle, kind: 'missed-sets',
        msg: `${e.name}: ${done} of ${last.targetSets} sets done in week ${last.week}` });
    }
    const trends = [];
    for (let i = 1; i < w.length; i++) {
      trends.push(performanceTrend(bestE1rm(w[i].sets, w[i].ex, bodyweight), bestE1rm(w[i - 1].sets, w[i - 1].ex, bodyweight)));
    }
    const t1 = trends[trends.length - 1], t2 = trends[trends.length - 2];
    if (t1 === -1) downNow.add(e.muscle);
    if (t1 === -1 && t2 === -1) out.push({ level: 'bad', muscle: e.muscle, kind: 'strength-2wk', msg: `${e.name}: strength down two weeks in a row` });
    else if (t1 === -1) out.push({ level: 'warn', muscle: e.muscle, kind: 'strength-1wk', msg: `${e.name}: reps/load slipped vs last week` });
  }
  const byMuscle = {};
  for (const f of feedback) (byMuscle[f.muscle] = byMuscle[f.muscle] || []).push(f);
  for (const [m, list] of Object.entries(byMuscle)) {
    const recent = list.slice(-2), last = list[list.length - 1];
    if (recent.length === 2 && recent.every(f => f.soreness === 3)) out.push({ level: 'bad', muscle: m, kind: 'recovery', msg: `${m}: still sore two sessions running — recovery is lagging` });
    else if (last.soreness === 3) out.push({ level: 'warn', muscle: m, kind: 'recovery', msg: `${m}: still sore at the last session` });
    if (last.joint_pain >= 2) out.push({ level: last.joint_pain === 3 ? 'bad' : 'warn', muscle: m, kind: 'joints', msg: `${m}: joint pain reported (${last.joint_pain === 3 ? 'a lot' : 'moderate'})` });
    if (recent.length === 2 && recent.every(f => f.workload === 3)) out.push({ level: 'warn', muscle: m, kind: 'workload', msg: `${m}: workload rated "too much" twice in a row` });
  }
  if (downNow.size >= 3) out.unshift({ level: 'bad', muscle: null, kind: 'systemic',
    msg: `${downNow.size} muscles slipped this week (${[...downNow].join(', ')}) — signs of accumulated fatigue; consider deloading early` });
  const rank = { bad: 0, warn: 1 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
