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

export function weeklyTarget(muscle, priority, focus) {
  const table = priority === 'focus' && (focus === 'whole' || focus === 'custom') ? TARGETS.whole : TARGETS[priority] || TARGETS.skip;
  return table[sizeOf(muscle)];
}

export function weeklyTargets(priorities, focus) {
  const t = {};
  for (const m of MUSCLES) t[m] = weeklyTarget(m, priorities[m] || 'skip', focus);
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

export function candidatesFor(muscle, library) {
  const pool = library.filter(e => e.muscle_group === muscle);
  const pref = (PREFERRED[muscle] || []).map(n => pool.find(e => e.name === n)).filter(Boolean);
  const rest = pool.filter(e => !pref.includes(e))
    .sort((a, b) => (a.kind === 'compound' ? 0 : 1) - (b.kind === 'compound' ? 0 : 1) || (a.owner_id ? 0 : 1) - (b.owner_id ? 0 : 1) || a.name.localeCompare(b.name));
  return [...pref, ...rest];
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
export function autofill({ plan, priorities, focus, library, mode }) {
  const nDays = plan.length;
  const lib = new Map(library.map(e => [e.id, e]));
  const days = mode === 'all'
    ? plan.map(d => ({ label: d.label, slots: [] }))
    : plan.map(d => ({ label: d.label, slots: d.slots.map(s => ({ ...s })) }));
  const targets = weeklyTargets(priorities, focus);
  const used = {}; // muscle -> Set of exercise ids already in the week
  const take = (m, avoid) => {
    const cands = candidatesFor(m, library);
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
  for (const d of plan) for (const s of d.slots) if (s.muscle) t[s.muscle] += Number(s.sets) || 0;
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
