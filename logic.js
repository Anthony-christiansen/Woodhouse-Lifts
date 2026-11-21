// Woodhouse Lifts training logic. Every rule here is documented, with its
// evidence, in "Woodhouse Lifts — Training Logic & Evidence" (Google Drive).
// Pure functions only, so they can be tested without a browser.

export const MUSCLES = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Calves', 'Traps', 'Abs', 'Forearms'];
export const UPPER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
export const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
export const MINOR = ['Traps', 'Abs', 'Forearms'];
const LARGE = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes'];
const sizeOf = m => LARGE.includes(m) ? 'large' : MINOR.includes(m) ? 'minor' : 'small';

// Doc §2.1 step 1 — starting weekly sets per priority (start conservatively; feedback grows them, doc §5).
//   Emphasize: grow this muscle hard, adding sets when recovery allows.   Grow: build it, nearer the minimum
//   effective volume — sets only go up when progress needs it.   Maintain: keep it with little recovery cost.
const TARGETS = {
  emphasize: { large: 10, small: 8, minor: 6 },
  grow:      { large: 8,  small: 6, minor: 4 },
  maintain:  { large: 4,  small: 4, minor: 3 },
  skip:      { large: 0,  small: 0, minor: 0 },
};
export const PRIORITIES = ['emphasize', 'grow', 'maintain', 'skip'];
export const PRIORITY_INFO = {
  emphasize: 'Grow this muscle aggressively — sets rise when recovery is good.',
  grow: 'Build muscle with conservative volume — sets rise only when progress needs it.',
  maintain: 'Keep what you have with low volume, saving recovery for the rest.',
  skip: 'Leave this muscle out of this meso.',
};
export const MAX_EMPHASIZE = 3;   // RP-style: emphasize a few muscles at a time; recovery is shared
// Mesos made before v1.9 stored 'focus' (and the Balanced template used a lower table for it).
export function normPriority(p, focus) {
  if (p === 'focus') return focus === 'whole' || focus === 'custom' ? 'grow' : 'emphasize';
  return PRIORITIES.includes(p) ? p : 'skip';
}

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
    else if (focus === 'upper') p[m] = UPPER.includes(m) ? 'emphasize' : 'maintain';
    else if (focus === 'lower') p[m] = LOWER.includes(m) ? 'emphasize' : 'maintain';
    else p[m] = 'grow';
  }
  return p;
}

export function weeklyTarget(muscle, priority, focus, goal) {
  const table = TARGETS[normPriority(priority, focus)] || TARGETS.skip;
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
    const want = everyDay && normPriority(priorities[m], focus) !== 'maintain' ? avail.length
      : Math.max(1, frequency(targets[m], normPriority(priorities[m], focus), allowed ? allowed.size : nDays) - onDay[m].size);
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

/**
 * Doc §2.3 — fit each workout into the time you have. Estimate per working set INCLUDING rest:
 * compound 3 min, isolation 2 min; plus 6 min to warm up and 1 min per exercise for setup.
 * A muscle never gets more than 10 sets in one session. If a day runs long, sets come off the LOWEST
 * priority muscle first (Skip → Maintain → Grow → Emphasize), then from the muscle with the most sets that day.
 * Floors per session: Emphasize keeps at least 2 sets, Grow 1; Maintain can be dropped from that day.
 * Returns { days, trimmed: { muscle: setsRemoved }, minutes: [per-day estimate] }.
 */
export const SESSION_MUSCLE_CAP = 10;
export const SET_MIN = { compound: 3, isolation: 2 }, SESSION_OVERHEAD = 6, EXERCISE_SETUP = 1;
export function sessionMinutes(day, lib) {
  const get = id => (lib instanceof Map ? lib.get(id) : lib?.find?.(e => e.id === id));
  let m = SESSION_OVERHEAD;
  for (const s of day.slots || []) { if (!s.sets) continue; const k = get(s.exerciseId)?.kind === 'compound' ? 'compound' : 'isolation'; m += EXERCISE_SETUP + s.sets * SET_MIN[k]; }
  return Math.round(m);
}
const PRI_RANK = { skip: 0, maintain: 1, grow: 2, emphasize: 3 };
export function fitToTime(plan, { minutes, priorities = {}, focus = null, library = [] } = {}) {
  const lib = new Map(library.map(e => [e.id, e]));
  const days = plan.map(d => ({ ...d, slots: d.slots.map(x => ({ ...x })) }));
  const trimmed = {};
  const cut = (d, s) => { s.sets--; trimmed[s.muscle] = (trimmed[s.muscle] || 0) + 1; if (s.sets <= 0) d.slots.splice(d.slots.indexOf(s), 1); };
  for (const d of days) {
    // per-muscle session cap
    for (const m of new Set(d.slots.map(x => x.muscle))) {
      let tot = d.slots.filter(x => x.muscle === m).reduce((a, x) => a + (x.sets || 0), 0);
      while (tot > SESSION_MUSCLE_CAP) { const s = d.slots.filter(x => x.muscle === m).sort((a, b) => b.sets - a.sets)[0]; cut(d, s); tot--; }
    }
    if (!minutes) continue;
    let guard = 200;
    while (sessionMinutes(d, lib) > minutes && guard--) {
      const perMuscle = {}; for (const x of d.slots) perMuscle[x.muscle] = (perMuscle[x.muscle] || 0) + (x.sets || 0);
      // floors per session: Emphasize keeps ≥ 2 sets, Grow ≥ 1; Maintain/Skip can be dropped from a day entirely
      const floor = m => ({ emphasize: 2, grow: 1 })[normPriority(priorities[m], focus)] ?? 0;
      const cands = d.slots.filter(x => x.sets > 0 && perMuscle[x.muscle] > floor(x.muscle));
      if (!cands.length) break;
      cands.sort((a, b) => PRI_RANK[normPriority(priorities[a.muscle], focus)] - PRI_RANK[normPriority(priorities[b.muscle], focus)]
        || perMuscle[b.muscle] - perMuscle[a.muscle] || b.sets - a.sets);
      cut(d, cands[0]);
    }
  }
  return { days, trimmed, minutes: days.map(d => sessionMinutes(d, lib)) };
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
  const inc = Math.max(increment(ex, unit), unit === 'kg' ? 2.5 : 5);   // warm-ups: round to easy plate jumps
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
/**
 * Doc §4.6 — smallest weight jump per equipment. Defaults are the small end (2.5 lb / 1.25 kg; dumbbells come in
 * 5 lb / 2 kg pairs). Users can change these in Settings to match their gym (setIncrements).
 */
const INC_DEFAULT = { lb: { Dumbbell: 5, other: 2.5 }, kg: { Dumbbell: 2, other: 1.25 } };
let INC = JSON.parse(JSON.stringify(INC_DEFAULT));
export function setIncrements(custom) {
  INC = JSON.parse(JSON.stringify(INC_DEFAULT));
  for (const u of ['lb', 'kg']) for (const [k, v] of Object.entries(custom?.[u] || {})) if (Number(v) > 0) INC[u][k] = Number(v);
}
export const incrementDefaults = () => JSON.parse(JSON.stringify(INC_DEFAULT));
export function increment(ex, unit) {
  const t = INC[unit === 'kg' ? 'kg' : 'lb'];
  return t[ex?.equipment] ?? t.other;
}
/**
 * Doc §4.6 — how much weight to add in one progression step. From Anthony's logged history (2,376 week-to-week
 * changes, 2023–2026): when the weight went up by ≤ 4% he kept his reps 94–97% of the time; above 4% he kept
 * them only 27–39% of the time. So a step is about 2.5% of the load, rounded DOWN to the gym's increment, at least
 * one increment, never more than 5 lb (2.5 kg), and never more than the lifter's own usual jump for that lift.
 */
export const STEP_PCT = 0.025, STEP_MAX = { lb: 5, kg: 2.5 };   // "less is more": one step is never more than 5 lb / 2.5 kg
export function loadStep(weight, ex, unit, observed = null) {
  const inc = increment(ex, unit), w = Number(weight) || 0, cap = Math.max(inc, STEP_MAX[unit === 'kg' ? 'kg' : 'lb']);
  let step = Math.min(cap, Math.max(inc, Math.floor(w * STEP_PCT / inc) * inc));
  if (observed > 0) step = Math.max(inc, Math.min(step, Math.floor(observed / inc) * inc || inc));
  return step;
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
  // Doc §4.0 (v1.9) — decided from several signals, not one past change:
  //  1. how this lift has moved across the meso so far (majority of week-to-week changes; latest breaks a tie),
  //  2. room in the rep range: at the top → add weight; well below the top → reps are fine,
  //  3. light loads: if one weight step is more than ~5% of the load (e.g. 5 lb on a 40 lb dumbbell), add reps.
  const inc = increment(ex, unit);
  const t = (trail || []).filter(x => x && x.weight != null && x.reps != null);
  let load = 0, reps = 0, latest = null, steps = [];
  for (let i = 1; i < t.length; i++) {
    const dw = Number(t[i].weight) - Number(t[i - 1].weight), dr = Number(t[i].reps) - Number(t[i - 1].reps);
    if (dw > 0) { load++; latest = 'load'; steps.push(dw); } else if (dw === 0 && dr > 0) { reps++; latest = 'reps'; }
  }
  const last = t[t.length - 1], w = last ? Number(last.weight) : 0, r = last ? Number(last.reps) : null;
  const max = ex?.rep_max ?? 30;
  const observed = steps.length ? steps.sort((a, b) => a - b)[Math.floor((steps.length - 1) / 2)] : null;   // median jump
  const step = loadStep(w, ex, unit, observed);
  let mode = load > reps ? 'load' : reps > load ? 'reps' : latest;
  if (!mode) mode = ex?.load_type === 'weighted' && (['Machine', 'Cable'].includes(ex?.equipment) || /sled/i.test(ex?.name || '')) ? 'load' : 'reps';
  if (r != null && r >= max) mode = 'load';                                        // no more room for reps
  if (mode === 'load' && w > 0 && inc / w > 0.05 && r != null && r < max - 1) mode = 'reps';   // jump too big for the load
  return { mode, step };
}
/**
 * Doc §4.3 — how fast to progress this week, from last session's feedback for that muscle (autoregulation: the
 * effort you reported adjusts the next load, as in RPE/RIR and APRE methods). Workload drives it; pump does not
 * change the load (pump isn't a reliable hypertrophy signal) — pump and soreness adjust SETS instead (§5).
 *   joint pain ≥ 2 or workload "Too much"   → hold   (same weight & reps)
 *   workload "Pushed my limit"              → slow   (smaller jump)
 *   workload "Easy" + never got sore + no joint pain → fast (one extra step)
 *   otherwise / no feedback                 → normal
 */
export function progressionSpeed(fb) {
  if (!fb) return { speed: 'normal', why: null };
  if ((fb.joint_pain ?? 0) >= 2) return { speed: 'hold', why: 'joint pain last time' };
  if (fb.workload === 3) return { speed: 'hold', why: 'you rated last time "Too much"' };
  if (fb.workload === 2) return { speed: 'slow', why: 'you pushed your limit last time' };
  // Faster (a bigger-than-normal weight jump) only when the workload was too easy AND the muscle never got sore
  // and no joint pain at all — otherwise one normal step (v1.9.1, Anthony's rule).
  if (fb.workload === 0 && (fb.joint_pain ?? 0) === 0 && fb.soreness === 0) return { speed: 'fast', why: 'last time felt easy and you never got sore' };
  return { speed: 'normal', why: null };
}
/**
 * Doc §4.5 — injury guardrails, applied to every suggestion after the progression rules:
 *  - Weekly load cap: at most +5% over last week's weight for that set (ACSM allows 2–10%; Anthony's own history
 *    shows reps hold at ≤4% jumps and fall apart above it), or one load step when a single step is bigger (light lifts).
 *  - Meso ceiling: at most +20% over the lift's week-1 weight in this meso; past that, reps go up instead.
 *  - "Faster" is switched off at 0 RIR (failure weeks), on spinal-loading (axial) lifts, and with any joint pain.
 *  - Reps never jump more than +2 in a week.
 */
const SPEED_ORDER = { hold: 0, slow: 1, normal: 2, fast: 3 };
/**
 * Progression speed for ONE lift from its own rating (exercise_feedback: workload, joint_pain) and the muscle's
 * rating (muscle_feedback) — v1.10. Without an exercise rating (older data) it is the muscle rating alone.
 *  - The exercise rating decides that lift: joint pain 2+ or "Too much" → hold; "Pushed my limit" → slower.
 *  - The muscle rating caps it: muscle "Too much" holds every lift for that muscle; muscle "Pushed" → slower.
 *    Muscle joint pain 2+ while THIS exercise was pain-free → slower (not hold): the pain belonged to another lift.
 *  - Faster only when BOTH felt easy, the muscle never got sore, and no joint pain anywhere.
 */
export function liftSpeed(exFb, muscleFb) {
  const m = progressionSpeed(muscleFb);
  if (!exFb || exFb.workload == null) return m;
  const ej = exFb.joint_pain ?? 0;
  let e;
  if (ej >= 2) e = { speed: 'hold', why: 'joint pain on this exercise last time — ⇄ swaps it if it keeps hurting' };
  else if (exFb.workload === 3) e = { speed: 'hold', why: 'you rated this exercise "Too much" last time' };
  else if (exFb.workload === 2) e = { speed: 'slow', why: 'you pushed your limit on this exercise last time' };
  else if (exFb.workload === 0 && ej === 0) e = { speed: 'fast', why: null };
  else e = { speed: 'normal', why: null };
  let cap = m;
  if (m.speed === 'hold' && (muscleFb?.joint_pain ?? 0) >= 2 && muscleFb?.workload !== 3 && ej === 0)
    cap = { speed: 'slow', why: 'joint pain in this muscle last time (not on this exercise)' };
  if (e.speed === 'fast') return cap.speed === 'fast' ? { speed: 'fast', why: 'this exercise and the muscle felt easy and you never got sore' } : cap;
  if (cap.speed === 'fast') return e;   // muscle easy but this exercise wasn't → this exercise's own speed
  return SPEED_ORDER[cap.speed] < SPEED_ORDER[e.speed] ? cap : e;
}
export const GUARD = { weeklyPct: 0.05, mesoPct: 0.20, maxRepJump: 2 };
/** Biggest automatic weekly raise from w0: one step (≤ 5 lb / 2.5 kg, two on a "faster" week) and never past ~+5%. */
export function safeMax(w0, ex, unit, fast = false) {
  const inc = increment(ex, unit), stepMax = Math.max(inc, STEP_MAX[unit === 'kg' ? 'kg' : 'lb']);
  return Math.min(w0 + (fast ? 2 : 1) * stepMax, Math.max(w0 + inc, Math.floor(w0 * (1 + GUARD.weeklyPct) / inc) * inc));
}
export function suggestSet(args) {
  const { prev, ex, unit, targetRir, deload } = args;
  let speed = args.speed;
  const axial = (ex?.tags || []).includes('axial');
  if (speed?.speed === 'fast' && (targetRir <= 0 || axial)) speed = { speed: 'normal', why: null };
  const r = suggestSetCore({ ...args, speed });
  if (!r || deload || !prev || prev.weight == null || r.weight == null || ex?.load_type !== 'weighted') return r;
  const inc = increment(ex, unit), w0 = Number(prev.weight), notes = [];
  // Automatic increases are small for EVERY exercise: one step of at most 5 lb (2.5 kg) a week — or two steps
  // (≤ 10 lb / 5 kg) only on a "faster" week (too easy + never sore). Bigger jumps are yours to make by hand.
  const absCap = w0 + (speed?.speed === 'fast' ? 2 : 1) * Math.max(inc, STEP_MAX[unit === 'kg' ? 'kg' : 'lb']);
  const weekCap = safeMax(w0, ex, unit, speed?.speed === 'fast');
  if (r.weight > weekCap) {
    const u = unit || 'lb', add = Math.round((weekCap - w0) * 100) / 100;
    r.weight = weekCap;
    if (r.note) r.note = r.note.replace(/^\+[\d.]+ (lb|kg)/, `+${add} ${u}`);
    notes.push(weekCap === absCap ? `auto increases stop at +${add} ${u} a week — go heavier by hand if you want` : 'capped at about +5% a week');
  }
  if (args.mesoStart > 0) {
    const ceil = Math.floor(args.mesoStart * (1 + GUARD.mesoPct) / inc) * inc;
    if (r.weight > Math.max(ceil, w0)) { r.weight = Math.max(ceil, w0); r.reps = Math.min((ex?.rep_max ?? 30), Number(prev.reps) + 1); notes.push('at this meso\'s +20% ceiling — adding reps instead'); }
  }
  if (prev.reps != null && r.weight >= w0 && r.reps > Number(prev.reps) + GUARD.maxRepJump) r.reps = Number(prev.reps) + GUARD.maxRepJump;
  if (notes.length) r.note = `${r.note ? r.note + ' · ' : ''}${notes.join(' · ')}`;
  return r;
}
function suggestSetCore({ prev, ex, targetRir, prevTargetRir, deload, jointHold, unit, mode = null, speed = null }) {
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
      if (sp === 'fast') add = step * (drop + 1);   // suggestSet's cap keeps every auto raise ≤ 5 lb (10 lb on a faster week)
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
export function setAdjustment({ R, L, J, P, F, priority = 'emphasize' }) {
  const n = v => (v == null ? null : Number(v));
  R = n(R); L = n(L); J = n(J); P = n(P); F = n(F);
  // holdRir: next week keeps this week's RIR for this muscle instead of stepping closer to failure (doc §5.1).
  if (J === 3) return { delta: -1, holdRir: true, flag: 'Joint pain — consider swapping this exercise', rule: 1, why: 'joint pain was high — one set fewer, and the exercise is flagged to swap' };
  if (R === 3) return { delta: -1, holdRir: true, rule: 2, why: 'you were still beat up from last time — one set fewer' };
  if (F === -1 && R != null && R >= 2) return { delta: -1, holdRir: true, rule: 3, why: 'performance dropped and recovery was poor — one set fewer' };
  if (J === 2) return { delta: 0, rule: 4, why: 'joint discomfort — sets held' };
  if (L === 3) return { delta: 0, holdRir: true, rule: 5, why: 'the workload was too much — sets held' };
  if (R != null && R <= 1 && L != null && L <= 1 && (F == null || F >= 0)) {
    // Doc §5.5 — what a "ready for more" signal means depends on the muscle's priority.
    if (priority === 'maintain' || priority === 'skip') return { delta: 0, rule: 8, why: 'maintain muscle — volume stays low on purpose' };
    if (priority === 'grow') {
      if (F === 1) return { delta: 0, rule: 9, why: 'performance improved and recovery was good, so no extra volume is needed yet' };
      return { delta: 1, rule: 10, why: 'recovery was good but performance didn\'t move — one set added' };
    }
    // +2 only with no joint discomfort at all; any joint pain (even "Low") limits the increase to +1 (review #2)
    const two = R === 0 && L === 0 && (P == null || P <= 1) && !(J >= 1);
    return { delta: two ? 2 : 1, rule: 6, why: two ? 'recovered fully with an easy workload and low pump — two sets added' : 'recovery and workload were good — one set added' };
  }
  return { delta: 0, rule: 7, why: 'recovery and workload were in the normal range — sets held' };
}

/** Deload sets = half of the final accumulation week's (already adjusted) sets, rounded up (doc §1.8). */
export const deloadSets = lastWeekSets => Math.max(1, Math.ceil((lastWeekSets || 0) / 2));
export const SESSION_CAP = 12, WEEKLY_CAP = 22;

/** Apply a delta to one muscle's exercises in a session; returns [{id, target_sets}] changes. */
// Doc §5.5 — at most +2 sets per muscle per week in total, however many sessions train it (so two sessions can't
// each add +2 and jump the week by 4). prevWeeklyTotal = that muscle's sets this week.
export const WEEKLY_STEP_CAP = 2;
export function distributeDelta(exs, delta, { sessionTotal, weeklyTotal, prevWeeklyTotal = null }) {
  if (delta > 0) delta = Math.max(0, Math.min(delta, SESSION_CAP - sessionTotal, WEEKLY_CAP - weeklyTotal,
    prevWeeklyTotal == null ? Infinity : prevWeeklyTotal + WEEKLY_STEP_CAP - weeklyTotal));
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
