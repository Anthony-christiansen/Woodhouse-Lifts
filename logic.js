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

export const TEMPLATES = {
  upper:  { name: 'Upper focus', blurb: 'Grow chest, back, shoulders and arms; hold legs.' },
  lower:  { name: 'Lower focus', blurb: 'Grow quads, hamstrings, glutes and calves; hold upper body.' },
  whole:  { name: 'Whole body', blurb: 'Grow everything evenly, every muscle 2×+ a week.' },
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
export function autofill({ plan, priorities, focus, library, mode, goal, favorites = null }) {
  const nDays = plan.length;
  const lib = new Map(library.map(e => [e.id, e]));
  const days = mode === 'all'
    ? plan.map(d => ({ label: d.label, slots: [] }))
    : plan.map(d => ({ label: d.label, slots: d.slots.map(s => ({ ...s })) }));
  const targets = weeklyTargets(priorities, focus, goal);
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
    const avail = [...Array(nDays).keys()].filter(i => !onDay[m].has(i));
    if (!avail.length) { // every day already has this muscle: top up the lightest one
      const i = [...onDay[m]].sort((a, b) => load[a] - load[b])[0];
      const slot = days[i].slots.filter(s => s.muscle === m).pop(); slot.sets += remaining; load[i] += remaining; continue;
    }
    const want = Math.max(1, frequency(targets[m], priorities[m], nDays) - onDay[m].size);
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
export function suggestSet({ prev, ex, targetRir, prevTargetRir, deload, jointHold, unit }) {
  if (!prev || prev.reps == null) return null;
  const weight = prev.weight == null ? (ex?.load_type === 'weighted' ? null : 0) : Number(prev.weight);
  const loggedRir = prev.rir != null ? Number(prev.rir) : (prevTargetRir ?? targetRir);
  const min = ex?.rep_min ?? 5, max = ex?.rep_max ?? 30;
  if (jointHold) return { weight, reps: Number(prev.reps), note: 'Holding — joint pain last time' };
  let reps = Number(prev.reps) + (loggedRir - targetRir);
  if (deload) return { weight, reps: Math.max(1, Math.min(reps, Number(prev.reps))), note: 'Deload' };
  const inc = increment(ex, unit);
  let w = weight;
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
