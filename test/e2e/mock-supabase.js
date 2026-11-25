const meso = { id: 'm1', name: 'Whole Body Meso A', weeks: 5, days_per_week: 4, status: 'active', focus: 'whole', priorities: {} };
const ex = (id, name, mg, lt = 'weighted', kind = 'compound') => ({ id, name, muscle_group: mg, equipment: 'Machine', kind, load_type: lt, rep_min: 8, rep_max: 15, secondary: ['Triceps'], owner_id: null });
const libRaw = [ex('e1','Incline Dumbbell Press','Chest'), ex('e2','Machine Chest Press','Chest'), ex('e3','Lat Pulldown','Back'), ex('e4','Pull-Up','Back','bodyweight'),
  ex('e5','Hack Squat','Quads'), ex('e6','Leg Extension','Quads','weighted','isolation'), ex('e7','Romanian Deadlift','Hamstrings'), ex('e8','Lying Leg Curl','Hamstrings','weighted','isolation'),
  ex('e9','Hip Thrust','Glutes'), ex('e10','Dumbbell Lateral Raise','Shoulders','weighted','isolation'), ex('e11','Incline Dumbbell Curl','Biceps','weighted','isolation'),
  ex('e12','Overhead Cable Extension','Triceps','weighted','isolation'), ex('e13','Standing Calf Raise','Calves','weighted','isolation'), ex('e14','Dumbbell Shrug','Traps','weighted','isolation'),
  ex('e15','Cable Crunch','Abs','weighted','isolation'), ex('e16','Wrist Curl','Forearms','weighted','isolation'), ex('e17','Assisted Pull-Up','Back','assisted'), ex('e18','Back Squat','Quads')];
const lib = libRaw.map(e => ({ ...e, tags: e.name === 'Back Squat' || e.name === 'Hack Squat' ? ['axial'] : [] }));
const days = []; for (let w = 1; w <= 5; w++) for (let d = 1; d <= 4; d++) days.push({ id: `d${w}${d}`, week: w, day_index: d, label: 'Full Body ' + 'ABCD'[d-1], mesocycle_id: 'm1',
  started_at: w === 1 ? '2026-11-10' : null, completed_at: w === 1 ? '2026-11-10T18:00:00Z' : null, skipped_at: null });
const now = new Date().toISOString();
const wes = [
  { id: 'w1', exercise_id: 'e1', target_sets: 3, target_rir: 2, position: 1, flag: null, exercises: lib[0], sets: [{ set_index: 1, weight: 70, reps: 11, rir: 2, completed_at: now }, { set_index: 2, weight: 70, reps: 10, rir: 2, completed_at: now }] },
  { id: 'w2', exercise_id: 'e4', target_sets: 3, target_rir: 2, position: 2, flag: 'Joint pain — consider swapping this exercise', exercises: lib[3], sets: [] },
  { id: 'w3', exercise_id: 'e5', target_sets: 4, target_rir: 2, position: 3, flag: null, exercises: lib[4], sets: [] },
  { id: 'w4', exercise_id: 'e17', target_sets: 2, target_rir: 2, position: 4, flag: null, exercises: lib[16], sets: [] },
  { id: 'w5', exercise_id: 'c1', target_sets: 1, target_rir: 2, position: 5, flag: null, exercises: { id: 'c1', name: 'Assault Bike', muscle_group: 'Cardio', load_type: 'cardio', rep_min: 1, rep_max: 60 }, sets: [] },
];
const cardio = [{ id: 'c1', activity: 'Incline walk', performed_on: now.slice(0,10), minutes: 35, rpe: 4, distance: 1.8, distance_unit: 'mi' },
  { id: 'c2', activity: 'Bike', performed_on: '2026-11-12', minutes: 25, rpe: 6 }];
const setsRows = [1,2,3].map(i => ({ weight: 180 + i*5, reps: 10, rir: 2, completed_at: `2026-11-0${i}T10:00:00Z`, workout_exercises: { id: 'x'+i, exercise_id: 'e5', exercises: lib[4] } }));
const wkKey = (() => { const x = new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return new Date(x.getTime() - x.getTimezoneOffset()*60000).toISOString().slice(0,10); })();
const mk = (id, name, vals) => vals.map((e, i) => ({ exercise_id: id, name, session_id: id + 's' + i, done_at: new Date(Date.UTC(2026, 8, 28 + i * 7, 18)).toISOString(), best_e1rm: e, top_weight: Math.round(e / 1.4), top_reps: 10, n_sets: 3, rn: vals.length - i, prior_best: null }));
const fixtures = {
  'rpc:lift_recent': [...mk('e5', 'Hack Squat', [300, 310, 311, 309, 310.5]), ...mk('e1', 'Incline Dumbbell Press', [100, 110, 105, 106])],
  exercise_prefs: [], app_feedback: [],
  'rpc:create_mesocycle': 'm1',
  'rpc:start_light_week': { week: 3, revision: 1, superseded: 8, old_weeks: 5 },
  'rpc:light_week_preview': { revision: 0, weeks: 5, light_week: 3, status: 'active', can_undo: false, ok: true, reason: null, done: 7, skipped: 1, started_unfinished: 0, not_done: 0, light_sessions: 4, removed_sessions: 8 },
  'rpc:undo_light_week': { weeks: 5, revision: 2 },
  'rpc:dashboard_stats': { tz: 'UTC', weeks: { [wkKey]: 42 }, workouts: 3, sets: 9, prs: [{ name: 'Hack Squat', pct: 2.4, date: now }], movers: [{ name: 'Hack Squat', pct: 5.4 }, { name: 'Leg Extension', pct: -1.2 }] },
  'rpc:strength_summary': [{ exercise_id: 'e5', name: 'Hack Squat', muscle_group: 'Quads', sessions: 3, first_e1rm: 245, last_e1rm: 258, last_at: now }],
  'rpc:lift_sessions': [1,2,3,4,5].map(i => ({ exercise_id: 'e5', name: 'Hack Squat', muscle_group: 'Quads', session_id: 'x'+i, done_at: `2026-11-0${i}T10:00:00Z`, best_e1rm: 240+i*5, top_weight: 180+i*5, top_reps: 10, n_sets: 3 })),
  muscle_feedback: [{ muscle_group: 'Chest', soreness: 3, workload: 3, joint_pain: 2, workout_days: { week: 1, day_index: 1 } }],
  profiles: [{ id: 'u1', display_name: 'Alex', unit: 'lb', bodyweight: 200, equipment: null, avoid_tags: [] }],
  mesocycles: [meso], exercises: lib, cardio_sessions: cardio, sets: setsRows,
  workout_days: days.map(d => ({ ...d, mesocycles: meso, workout_exercises: wes })),
  workout_exercises: wes.map(w => ({ ...w, workout_days: { id: 'd11', week: 1, day_index: 1, completed_at: '2026-11-10T18:00:00Z', mesocycle_id: 'm1' } })),
  templates: [{ id: 't1', name: 'Whole Body Split B (from A)', focus: 'whole', priorities: {}, weeks: 6, days_per_week: 2, notes: 'Same structure as A with the skull crusher swap.',
    plan: [{ label: 'Workout 1', slots: [{ muscle: 'Quads', exerciseId: 'e5', sets: 2 }, { muscle: 'Cardio', exerciseId: 'c1', sets: 1 }] }, { label: 'Workout 2', slots: [{ muscle: 'Chest', exerciseId: 'e1', sets: 2 }] }] }],
};
function builder(table) {
  let single = false, maybe = false, payload = null, inIds = null, statusIn = null, lim = null, del = false, eqs = [], notSup = false;
  const b = new Proxy({}, { get(_, k) {
    if (k === 'then') return (res, rej) => {
      let data = fixtures[table] || [];
      if (table === 'mesocycles' && window.__MESOS) data = window.__MESOS;   // test hook
      if (table === 'profiles' && window.__PROFILE) data = data.map(x => ({ ...x, ...window.__PROFILE }));   // test hook
      if (table === 'muscle_feedback' && window.__FB) data = window.__FB;   // test hook
      if (table === 'workout_days' && window.__DONE_THROUGH) data = data.map(d => d.week <= window.__DONE_THROUGH ? { ...d, started_at: '2026-11-10', completed_at: '2026-11-10T18:00:00Z' } : d);   // test hook
      if (table === 'workout_days' && window.__SUP_AFTER) data = data.map(d => d.week > window.__SUP_AFTER ? { ...d, superseded_at: '2026-11-24T00:00:00Z' } : d);   // test hook
      if (table === 'workout_days' && notSup) data = window.__LATE_ROWS || [];   // test hook: sets on hidden days
      if (table === 'mesocycles' && window.__MESO_PATCH) data = data.map(m => ({ ...m, ...window.__MESO_PATCH }));   // test hook
      if (table === 'workout_days' && window.__MESO_PATCH) data = data.map(d => d.mesocycles ? { ...d, mesocycles: { ...d.mesocycles, ...window.__MESO_PATCH } } : d);
      if (table === 'mesocycles' && statusIn) data = data.filter(m => statusIn.includes(m.status));
      if (table === 'mesocycles' && lim) data = data.slice(0, lim);
      if (table === 'workout_exercises' && inIds && inIds.some(id => /s\d+$/.test(id))) data = inIds.map(id => ({ id, exercises: { load_type: 'weighted' }, workout_days: { week: +id.match(/s(\d+)$/)[1] + 1, mesocycle_id: 'm0', mesocycles: { name: 'Test Meso', weeks: 8 } } }));
      if (window.__OFFLINE) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } }).then(res, rej);   // test hook: no signal at all
      if (payload && window.__FAIL_NET) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } }).then(res, rej);
      if (payload && window.__REFUSE && window.__REFUSE(table, payload)) return Promise.resolve({ data: null, error: { code: '23514', message: 'new row violates check constraint "sets_reps_check"' } }).then(res, rej);   // test hook: server refuses (permanent)
      if (del) { if (window.__OFFLINE) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } }).then(res, rej);
        (window.__deletes = window.__deletes || []).push([table, eqs]); (window.__ops = window.__ops || []).push(['delete', table, eqs]); return Promise.resolve({ data: null, error: null }).then(res, rej); }   // __ops: what reached the 'server', in order
      if (table === 'app_feedback' && window.__NO_FEEDBACK) return Promise.resolve({ data: null, error: { message: 'relation "public.app_feedback" does not exist' } }).then(res, rej);
      if (payload) { (window.__writes = window.__writes || []).push([table, payload]);
        const ms = window.__DELAY ? window.__DELAY(table, payload) : 0;   // test hook: slow / out-of-order responses
        const land = () => { (window.__landed = window.__landed || []).push([table, payload]); (window.__ops = window.__ops || []).push(['write', table, payload]); return { data: payload, error: null }; };
        return (ms ? new Promise(r => setTimeout(r, ms)).then(land) : Promise.resolve().then(land)).then(res, rej); }
      if (table === 'workout_days' && single) data = data.find(d => d.id === (location.hash.split('/')[2] || 'd21')) || data[4];
      else if (single || maybe) data = data[0] ?? null;
      return Promise.resolve({ data, error: null }).then(res, rej);
    };
    if (k === 'single') return () => { single = true; return b; };
    if (k === 'upsert' || k === 'insert' || k === 'update') return (p) => { payload = Array.isArray(p) ? p[0] : p; (window.__rows = window.__rows || []).push([table, k, p]); return b; };
    if (k === 'delete') return () => { del = true; return b; };
    if (k === 'eq') return (col, v) => { eqs.push([col, v]); return b; };
    if (k === 'limit') return n => { lim = n; return b; };
    if (k === 'not') return (col) => { if (col === 'superseded_at') notSup = true; return b; };
    if (k === 'maybeSingle') return () => { maybe = true; return b; };
    if (k === 'in') return (col, vals) => { if (col === 'id') inIds = vals; if (col === 'status') statusIn = vals; return b; };
    return () => b;
  } });
  return b;
}
export function createClient() {
  return { from: builder, rpc: (fn, args) => { window.__lastRpc = { fn, args }; (window.__rpcs = window.__rpcs || []).push({ fn, args }); if (fn === 'create_mesocycle') (window.__creates = window.__creates || []).push(args); if (fn === 'light_week_preview' && window.__PREVIEW_SEQ?.length) return Promise.resolve({ data: window.__PREVIEW_SEQ.shift(), error: null }); const err = window.__RPC_ERR?.[fn]; if (err) return Promise.resolve({ data: null, error: err }); return builder('rpc:' + fn); }, auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'alex@example.com' } } } }),
    onAuthStateChange(cb) { window.__authEmit = (evt, uid = 'u1') => cb(evt, uid ? { user: { id: uid, email: 'alex@example.com' } } : null); }, signOut: async () => {} } };
}
