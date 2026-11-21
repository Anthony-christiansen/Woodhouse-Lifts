import assert from 'node:assert/strict';
import * as L from '../logic.js';

let id = 0;
const lib = [];
const add = (name, m, kind = 'compound', load_type = 'weighted', equipment = 'Machine', rep_min = 8, rep_max = 15) =>
  lib.push({ id: 'e' + (++id), name, muscle_group: m, kind, load_type, equipment, rep_min, rep_max, owner_id: null });
for (const m of L.MUSCLES) for (let i = 1; i <= 5; i++) add(`${m} ${i}`, m, i <= 2 ? 'compound' : 'isolation');
add('Incline Dumbbell Press', 'Chest', 'compound', 'weighted', 'Dumbbell', 6, 15);

// RIR schedule
assert.deepEqual([1, 2, 3, 4, 5].map(w => L.rirForWeek(w, 5).rir), [3, 2, 1, 0, 4]);
assert.equal(L.rirForWeek(5, 5).deload, true);
assert.deepEqual([1, 2, 3, 4].map(w => L.rirForWeek(w, 4).rir), [3, 1, 0, 4]);

// Templates & autofill
for (const focus of ['upper', 'lower', 'whole']) {
  for (const days of [3, 4, 5, 6]) {
    const pr = L.templatePriorities(focus);
    const plan = Array.from({ length: days }, (_, i) => ({ label: 'Day ' + (i + 1), slots: [] }));
    const out = L.autofill({ plan, priorities: pr, focus, library: lib, mode: 'all' });
    const placed = L.placedSets(out), tg = L.weeklyTargets(pr, focus);
    for (const m of L.MUSCLES) assert.equal(placed[m], tg[m], `${focus}/${days} ${m} placed ${placed[m]} vs ${tg[m]}`);
    for (const m of L.MUSCLES) {
      const daysWith = out.filter(d => d.slots.some(s => s.muscle === m)).length;
      if (pr[m] === 'focus') assert.ok(daysWith >= 2, `${focus}/${days} ${m} only ${daysWith}x`);
      for (const d of out) {
        const s = d.slots.filter(x => x.muscle === m).reduce((a, x) => a + x.sets, 0);
        assert.ok(s <= 6, `${focus}/${days} ${m} ${s} sets in one day`);
      }
    }
    for (const d of out) {
      const ids = d.slots.map(s => s.exerciseId);
      assert.equal(new Set(ids).size, ids.length, 'duplicate exercise in a day');
      assert.ok(ids.every(Boolean));
    }
    const loads = out.map(d => d.slots.reduce((a, s) => a + s.sets, 0));
    console.log(focus, days, 'day sets', loads.join('/'));
  }
}
// Fill what's left keeps user picks and only adds the remainder
{
  const pr = L.templatePriorities('upper');
  const plan = [{ label: 'D1', slots: [{ muscle: 'Chest', exerciseId: 'e1', sets: 4 }, { muscle: 'Back', exerciseId: null, sets: 3 }] },
    { label: 'D2', slots: [] }, { label: 'D3', slots: [] }, { label: 'D4', slots: [] }];
  const out = L.autofill({ plan, priorities: pr, focus: 'upper', library: lib, mode: 'fill' });
  assert.ok(out[0].slots.some(s => s.exerciseId === 'e1' && s.sets === 4));
  assert.ok(out[0].slots.find(s => s.muscle === 'Back').exerciseId);
  assert.equal(L.placedSets(out).Chest, 10);
}

// Load progression (doc §4 examples)
const bench = { load_type: 'weighted', equipment: 'Barbell', rep_min: 5, rep_max: 12 };
assert.deepEqual(L.suggestSet({ prev: { weight: 185, reps: 10, rir: 3 }, ex: bench, targetRir: 2, unit: 'lb' }), { weight: 185, reps: 11 });
assert.deepEqual(L.suggestSet({ prev: { weight: 185, reps: 12, rir: null }, ex: bench, targetRir: 2, prevTargetRir: 3, unit: 'lb' }), { weight: 190, reps: 11 });
assert.equal(L.suggestSet({ prev: { weight: 185, reps: 10 }, ex: bench, targetRir: 2, prevTargetRir: 3, jointHold: true, unit: 'lb' }).weight, 185);
assert.equal(L.suggestSet({ prev: null, ex: bench, targetRir: 2 }), null);
const assisted = { load_type: 'assisted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
assert.equal(L.suggestSet({ prev: { weight: 50, reps: 15 }, ex: assisted, targetRir: 1, prevTargetRir: 2, unit: 'lb' }).weight, 45);

// Set adjustment (doc §5)
assert.deepEqual(L.setAdjustment({ R: 0, L: 0, J: 0, P: 1, F: 1 }).delta, 2);
assert.equal(L.setAdjustment({ R: 1, L: 1, J: 0, P: 3, F: 0 }).delta, 1);
assert.equal(L.setAdjustment({ R: 3, L: 0, J: 0 }).delta, -1);
assert.equal(L.setAdjustment({ R: 2, L: 1, J: 0, F: -1 }).delta, -1);
assert.equal(L.setAdjustment({ R: 0, L: 0, J: 3 }).flag != null, true);
assert.equal(L.setAdjustment({ R: 0, L: 0, J: 2 }).delta, 0);
assert.equal(L.setAdjustment({ R: 2, L: 1, J: 0, F: 1 }).delta, 0);
assert.equal(L.setAdjustment({ R: 1, L: 3, J: 0 }).holdRir, true);

// Distribute with caps
assert.deepEqual(L.distributeDelta([{ id: 'a', target_sets: 3 }, { id: 'b', target_sets: 2 }], 1, { sessionTotal: 5, weeklyTotal: 10 }), [{ id: 'b', target_sets: 3 }]);
assert.deepEqual(L.distributeDelta([{ id: 'a', target_sets: 3 }, { id: 'b', target_sets: 1 }], -1, { sessionTotal: 4, weeklyTotal: 10 }), [{ id: 'a', target_sets: 2 }]);
assert.deepEqual(L.distributeDelta([{ id: 'a', target_sets: 6 }], 2, { sessionTotal: 11, weeklyTotal: 15 }), [{ id: 'a', target_sets: 7 }]);
assert.deepEqual(L.distributeDelta([{ id: 'a', target_sets: 6 }], 2, { sessionTotal: 6, weeklyTotal: 22 }), []);
assert.equal(L.deloadSets(5), 3);

// Performance
const ex = { load_type: 'weighted' };
assert.equal(L.performanceTrend(L.bestE1rm([{ weight: 195, reps: 10, rir: 1 }], ex), L.bestE1rm([{ weight: 185, reps: 10, rir: 2 }], ex)), 1);
assert.equal(L.performanceTrend(100, 100.5), 0);
assert.equal(L.combineTrends([1, -1, -1]), -1);
console.log('ALL LOGIC TESTS PASSED');

// Slip warnings
{
  const ex = { load_type: 'weighted' };
  const wk = (week, w, r, target = 3, n = 3) => ({ week, targetSets: target, ex, sets: Array.from({ length: n }, () => ({ weight: w, reps: r, rir: 2 })) });
  const warns = L.slipWarnings({
    exercises: [
      { name: 'Bench', muscle: 'Chest', weeks: [wk(1, 100, 10), wk(2, 100, 9), wk(3, 100, 8)] },
      { name: 'Row', muscle: 'Back', weeks: [wk(1, 100, 10), wk(2, 100, 11, 3, 1)] },
      { name: 'Curl', muscle: 'Biceps', weeks: [wk(1, 30, 10), wk(2, 30, 9)] },
      { name: 'Squat', muscle: 'Quads', weeks: [wk(1, 200, 10), wk(2, 200, 8)] },
    ],
    feedback: [{ muscle: 'Chest', soreness: 3 }, { muscle: 'Chest', soreness: 3, joint_pain: 2 }],
  });
  const kinds = warns.map(w => w.kind);
  assert.ok(kinds.includes('strength-2wk')); assert.ok(kinds.includes('missed-sets'));
  assert.ok(kinds.includes('recovery')); assert.ok(kinds.includes('joints')); assert.equal(kinds[0], 'systemic');
  assert.deepEqual(L.slipWarnings({ exercises: [{ name: 'A', muscle: 'Chest', weeks: [wk(1, 100, 10), wk(2, 100, 11)] }] }), []);
}
console.log('SLIP TESTS PASSED');

// Equivalent-effort reps when the weight changes (doc §4.1)
{
  const ex = { load_type: 'weighted', rep_min: 8, rep_max: 30 };
  const prev = { weight: 200, reps: 15, rir: 2 };              // e1RM ≈ 313
  const same = L.repsAtLoad({ prev, ex, weight: 200, targetRir: 2 });
  assert.deepEqual([same.lo, same.hi], [15, 16]);              // same load, same RIR → match 15, aim 16
  const drop = L.repsAtLoad({ prev, ex, weight: 180, targetRir: 2 });
  assert.ok(drop.lo >= 19 && drop.lo <= 21 && !drop.outside);  // lighter → more reps
  const closer = L.repsAtLoad({ prev, ex, weight: 200, targetRir: 1 });
  assert.equal(closer.lo, 16);                                 // 1 RIR closer to failure → +1 rep
  assert.equal(L.repsAtLoad({ prev, ex, weight: 290, targetRir: 2 }).outside, 'heavy');
  assert.equal(L.repsAtLoad({ prev, ex, weight: 100, targetRir: 2 }).outside, 'light');
  const wr = L.weightRange({ prev, ex, targetRir: 2, unit: 'lb' });
  assert.ok(wr.light < 200 && wr.heavy > 200 && wr.heavy % 5 === 0 && wr.light % 5 === 0);
  // round-trip: the ends of the window land inside the rep range
  assert.ok(L.repsAtLoad({ prev, ex, weight: wr.heavy, targetRir: 2 }).lo >= 8);
  assert.ok(L.repsAtLoad({ prev, ex, weight: wr.light, targetRir: 2 }).lo <= 30);
  assert.equal(L.weightRange({ prev, ex: { load_type: 'bodyweight' }, targetRir: 2 }), null);
}
console.log('RANGE TESTS PASSED');

// Units: canonical pounds, lossless round trips, repeated switching never drifts
{
  for (let kg = 0; kg <= 300; kg += 0.25) assert.equal(L.toUnit(L.fromUnit(kg, 'kg'), 'kg'), Math.round(kg * 100) / 100);
  for (let lb = 0; lb <= 700; lb += 2.5) assert.equal(L.fromUnit(L.toUnit(lb, 'lb'), 'lb'), lb);
  assert.equal(L.fromUnit(100, 'kg'), 220.46);
  assert.equal(L.toUnit(220.46, 'kg'), 100);
  // switch lb → kg → lb → kg 10× : stored value untouched, displays stable
  let stored = 225; for (let i = 0; i < 10; i++) { const kg = L.toUnit(stored, 'kg'); stored = L.fromUnit(kg, 'kg'); }
  assert.ok(Math.abs(stored - 225) < 0.01);
  assert.equal(L.toUnit(null, 'kg'), null); assert.equal(L.fromUnit('', 'kg'), null);
}
console.log('UNIT TESTS PASSED');

// Goals (doc §1.10): hypertrophy unchanged; strength/athletic change reps, RIR and volume only
{
  for (let weeks = 3; weeks <= 8; weeks++) for (let w = 1; w <= weeks; w++) for (const kind of ['compound', 'isolation']) {
    assert.deepEqual(L.targetRir(w, weeks, 'hypertrophy', kind), L.rirForWeek(w, weeks), 'hypertrophy RIR identical');
    assert.deepEqual(L.targetRir(w, weeks, undefined, kind), L.rirForWeek(w, weeks), 'missing goal = hypertrophy');
    const s = L.targetRir(w, weeks, 'strength', kind), a = L.targetRir(w, weeks, 'athletic', kind);
    if (w === weeks) { assert.ok(s.deload && a.deload); continue; }
    assert.ok(s.rir >= 1, 'strength never to failure');
    assert.equal(L.targetRir(w, weeks, 'athletic', 'compound').rir, 3, 'power lifts held at 3 RIR');
    assert.ok(L.targetRir(w, weeks, 'athletic', 'isolation').rir >= 2);
  }
  const press = { kind: 'compound', load_type: 'weighted', rep_min: 8, rep_max: 15 }, curl = { kind: 'isolation', load_type: 'weighted', rep_min: 10, rep_max: 20 };
  assert.deepEqual(L.repRange(press, 'hypertrophy'), { rep_min: 8, rep_max: 15 });
  assert.deepEqual(L.repRange(press, 'strength'), { rep_min: 3, rep_max: 6 });
  assert.deepEqual(L.repRange(curl, 'strength'), { rep_min: 6, rep_max: 12 });
  assert.deepEqual(L.repRange(press, 'athletic'), { rep_min: 3, rep_max: 5 });
  assert.deepEqual(L.repRange({ load_type: 'cardio', rep_min: 1, rep_max: 60 }, 'strength'), { rep_min: 1, rep_max: 60 });
  for (const m of L.MUSCLES) for (const pr of ['focus', 'maintain', 'skip']) for (const f of ['upper', 'lower', 'whole']) {
    const h = L.weeklyTarget(m, pr, f, 'hypertrophy');
    assert.equal(h, L.weeklyTarget(m, pr, f), 'hypertrophy volume identical');
    if (h) { assert.ok(L.weeklyTarget(m, pr, f, 'strength') <= h && L.weeklyTarget(m, pr, f, 'athletic') <= L.weeklyTarget(m, pr, f, 'strength')); }
  }
  assert.equal(L.weeklyTarget('Chest', 'focus', 'upper', 'strength'), 8); // 10 × 0.75
  // strength progression: 3–6 range → weight goes up once reps pass 6
  const sg = L.suggestSet({ prev: { weight: 300, reps: 6, rir: 2 }, ex: { ...press, ...L.repRange(press, 'strength'), equipment: 'Barbell' }, targetRir: 1, prevTargetRir: 2, unit: 'lb' });
  assert.ok(sg.weight > 300 && sg.reps <= 6, 'strength adds load instead of chasing reps');
}
console.log('GOAL TESTS PASSED');

// Preferences (doc §2.2): exclusions, axial avoidance, equipment, favorites/substitutes ranked first
{
  const lib = [
    { id: 'sq', name: 'Back Squat', muscle_group: 'Quads', kind: 'compound', equipment: 'Barbell', load_type: 'weighted', tags: ['axial'] },
    { id: 'hk', name: 'Hack Squat', muscle_group: 'Quads', kind: 'compound', equipment: 'Machine', load_type: 'weighted', tags: ['axial'] },
    { id: 'lp', name: 'Leg Press', muscle_group: 'Quads', kind: 'compound', equipment: 'Machine', load_type: 'weighted', tags: [] },
    { id: 'le', name: 'Leg Extension', muscle_group: 'Quads', kind: 'isolation', equipment: 'Machine', load_type: 'weighted', tags: [] },
    { id: 'bs', name: 'Bulgarian Split Squat', muscle_group: 'Quads', kind: 'compound', equipment: 'Dumbbell', load_type: 'weighted', tags: [] },
    { id: 'rdl', name: 'Romanian Deadlift', muscle_group: 'Hamstrings', kind: 'compound', equipment: 'Barbell', load_type: 'weighted', tags: ['axial'] },
    { id: 'lc', name: 'Lying Leg Curl', muscle_group: 'Hamstrings', kind: 'isolation', equipment: 'Machine', load_type: 'weighted', tags: [] },
    { id: 'bk', name: 'Bike', muscle_group: 'Cardio', kind: 'isolation', equipment: 'Bike', load_type: 'cardio', tags: [] },
  ];
  const none = L.applyPreferences(lib);
  assert.equal(none.library.length, lib.length, 'no prefs → nothing removed');
  const ax = L.applyPreferences(lib, { avoidTags: ['axial'] });
  assert.deepEqual(ax.library.map(e => e.id).sort(), ['bk', 'bs', 'lc', 'le', 'lp']);
  assert.ok(ax.removed.every(e => e.why === 'avoided'));
  const keepHack = L.applyPreferences(lib, { avoidTags: ['axial'], prefs: [{ exercise_id: 'hk', pref: 'favorite' }] });
  assert.ok(keepHack.library.some(e => e.id === 'hk'), 'a favorite overrides a tag filter');
  assert.equal(L.candidatesFor('Quads', keepHack.library, keepHack.favorites)[0].id, 'hk', 'favorites rank first');
  const sub = L.applyPreferences(lib, { prefs: [{ exercise_id: 'lp', pref: 'exclude', substitute_id: 'bs' }] });
  assert.ok(!sub.library.some(e => e.id === 'lp') && L.candidatesFor('Quads', sub.library, sub.favorites)[0].id === 'bs', 'substitute replaces excluded lift');
  const eq = L.applyPreferences(lib, { equipment: ['Machine'] });
  assert.ok(eq.library.some(e => e.id === 'bk'), 'cardio never equipment-filtered');
  assert.ok(!eq.library.some(e => e.equipment === 'Barbell' || e.equipment === 'Dumbbell'));
  // autofill with axial avoidance never schedules a tagged lift, and still covers the muscles
  const plan = [{ label: 'A', slots: [] }, { label: 'B', slots: [] }];
  const pr = Object.fromEntries(L.MUSCLES.map(m => [m, ['Quads', 'Hamstrings'].includes(m) ? 'focus' : 'skip']));
  const out = L.autofill({ plan, priorities: pr, focus: 'lower', library: ax.library, favorites: ax.favorites, mode: 'all' });
  const ids = out.flatMap(d => d.slots.map(s => s.exerciseId));
  assert.ok(ids.length && !ids.some(id => ['sq', 'hk', 'rdl'].includes(id)), 'no axial lifts generated');
  assert.ok(out.some(d => d.slots.some(s => s.muscle === 'Quads')) && out.some(d => d.slots.some(s => s.muscle === 'Hamstrings')), 'coverage kept');
  // hypertrophy autofill unchanged when no prefs are given
  const a1 = L.autofill({ plan, priorities: pr, focus: 'lower', library: lib, mode: 'all' });
  const a2 = L.autofill({ plan, priorities: pr, focus: 'lower', library: none.library, favorites: none.favorites, mode: 'all' });
  assert.deepEqual(a1, a2, 'empty preferences change nothing');
}
console.log('PREFERENCE TESTS PASSED');

// Warm-ups (doc §4.2): ramp below working weight, rounded to plate jumps, short for isolation, none counted
{
  const squat = { kind: 'compound', load_type: 'weighted', equipment: 'Barbell' };
  const w = L.warmupPlan({ ex: squat, workWeight: 225, unit: 'lb' });
  assert.deepEqual(w.map(x => [x.weight, x.reps]), [[115, 8], [160, 4], [190, 2]]);
  assert.ok(w.every(x => x.weight < 225 && x.weight % 5 === 0));
  assert.ok(L.warmupPlan({ ex: squat, workWeight: 60, unit: 'lb' }).every(x => x.weight >= 45), 'never below the empty bar');
  const curl = { kind: 'isolation', load_type: 'weighted', equipment: 'Dumbbell' };
  assert.equal(L.warmupPlan({ ex: curl, workWeight: 30 }).length, 2);
  assert.equal(L.warmupPlan({ ex: curl, workWeight: 30, firstForMuscle: false })[0].weight, null);
  const kg = L.warmupPlan({ ex: squat, workWeight: 100, unit: 'kg' });
  assert.ok(kg.every(x => x.weight % 2.5 === 0 && x.weight >= 20 && x.weight < 100));
  assert.equal(L.warmupPlan({ ex: { load_type: 'bodyweight' }, workWeight: 0 })[0].reps, 8);
  assert.equal(L.warmupPlan({ ex: { load_type: 'cardio' } })[0].weight, null);
}
console.log('WARM-UP TESTS PASSED');

// Lift status (doc §6.1)
{
  const ser = (...v) => v.map((e, i) => ({ e, date: `2026-10-${10 + i}` }));
  assert.equal(L.liftStatus(ser(100)).status, 'new');
  assert.equal(L.liftStatus(ser(100, 102, 104, 106.5)).status, 'pr');
  assert.equal(L.liftStatus(ser(100, 110, 105, 106)).status, 'regressing');          // 105, 106 both >3% under 110
  assert.equal(L.liftStatus(ser(100, 105, 105.4, 104.8, 105.2)).status, 'stalled');   // best of last 3 within 1% of earlier best
  assert.equal(L.liftStatus(ser(100, 103, 102.5)).status, 'progressing');             // not a PR (103 > 102.5), up vs first
  assert.equal(L.liftStatus(ser(100, 100.5)).status, 'steady');
  // older history counts: a "PR" in the window that doesn't beat the all-time best isn't a PR
  assert.notEqual(L.liftStatus(ser(100, 102, 104), 120).status, 'pr');
  assert.notEqual(L.liftStatus(ser(100, 102, 104), 120).status, 'regressing', 'an old peak alone is not a recent drop');
  // one odd high week long ago doesn't make a steady lift "down" (Pallof Press case)
  assert.notEqual(L.liftStatus(ser(47, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45)).status, 'regressing');
  assert.equal(L.liftStatus(ser(47, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45)).status, 'stalled');
  const st = L.liftStatus(ser(100, 105, 105, 105, 105), null, { name: 'Leg Extension', rir: 2 });
  assert.ok(st.rec.includes('add 1 rep'), 'stalled recommendation is concrete');
  assert.ok(L.liftStatus(ser(100, 110, 105, 106), null, { rir: 1 }).rec.includes('1 RIR'));
}
console.log('LIFT STATUS TESTS PASSED');
{
  const ser = (...v) => v.map((e, i) => ({ e, date: `2026-10-${10 + i}` }));
  assert.equal(L.prsSince(ser(100, 105, 104, 110), null, '2026-10-11').count, 2);   // 105 and 110
  assert.equal(L.prsSince(ser(100, 105, 104, 110), 120, '2026-10-01').count, 0);    // older best of 120 not beaten
  assert.equal(L.prsSince(ser(100, 105, 104, 110), null, '2026-10-13').count, 1);   // only 110 is inside the meso
}
console.log('PR COUNT TESTS PASSED');

// Weekly bests (doc §6.1): heavy/light days don't read as ups and downs; an unfinished light week is ignored
{
  const S = (d, e) => ({ date: d, e });
  const alt = [S('2026-10-05', 256), S('2026-10-08', 233), S('2026-10-12', 256), S('2026-10-15', 238), S('2026-10-19', 263), S('2026-10-22', 244),
               S('2026-10-26', 263), S('2026-10-29', 240), S('2026-11-02', 260), S('2026-11-05', 239)];
  const wb = L.weeklyBest(alt, new Date('2026-11-20T12:00:00'));
  assert.deepEqual(wb.map(x => x.e), [256, 256, 263, 263, 260]);
  assert.ok(!['regressing', 'stalled'].includes(L.liftStatus(wb).status), 'alternating days never read as down');
  const wb2 = L.weeklyBest([...alt, S('2026-11-09', 262), S('2026-11-12', 240)], new Date('2026-11-20T12:00:00'));
  assert.equal(L.liftStatus(wb2).status, 'stalled', 'three flat weeks after the best → stalled');
  const partial = [S('2026-11-09', 260), S('2026-11-17', 230)];   // this week only the light day so far
  assert.deepEqual(L.weeklyBest(partial, new Date('2026-11-18T12:00:00')).map(x => x.e), [260], 'light current week dropped');
  const better = [S('2026-11-09', 260), S('2026-11-17', 270)];
  assert.equal(L.weeklyBest(better, new Date('2026-11-18T12:00:00')).length, 2, 'current week kept when it is already better');
}
console.log('WEEKLY BEST TESTS PASSED');

// Splits (doc §2.0)
{
  const lib = L.MUSCLES.flatMap(m => [0, 1, 2].map(k => ({ id: m + k, name: m + ' ' + k, muscle_group: m, kind: k ? 'isolation' : 'compound', load_type: 'weighted', equipment: 'Machine' })));
  const pr = L.templatePriorities('whole');
  const mk = (split, n) => L.autofill({ plan: Array.from({ length: n }, (_, i) => ({ label: 'Day ' + (i + 1), slots: [] })), priorities: pr, focus: 'whole', library: lib, mode: 'all', split });
  const musclesOn = d => new Set(d.slots.map(s => s.muscle));
  // PPL x6: push days hold only push muscles, etc.; every muscle trained 2×
  const ppl = mk('ppl', 6);
  assert.deepEqual(ppl.map(d => d.label), ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']);
  for (const d of ppl) for (const m of musclesOn(d)) assert.ok(({ Push: ['Chest', 'Shoulders', 'Triceps'], Pull: ['Back', 'Biceps', 'Traps', 'Forearms'], Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs'] })[d.label].includes(m), `${m} on ${d.label}`);
  for (const m of ['Chest', 'Back', 'Quads']) assert.equal(ppl.filter(d => musclesOn(d).has(m)).length, 2, `${m} 2×/week on PPL`);
  // Upper/Lower x4
  const ul = mk('upper_lower', 4);
  assert.deepEqual(ul.map(d => d.label), ['Upper', 'Lower', 'Upper', 'Lower']);
  assert.ok(!musclesOn(ul[0]).has('Quads') && !musclesOn(ul[1]).has('Chest'));
  // Full body: every focus muscle on every day
  const fb = mk('full_body', 3);
  for (const d of fb) for (const m of ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders']) assert.ok(musclesOn(d).has(m), `${m} every day on full body`);
  // Full-body split (default): days differ, big muscles 2×
  const fbs = mk('full_body_split', 4);
  assert.ok(fbs.some(d => !musclesOn(d).has('Chest')), 'not every muscle every day');
  for (const m of ['Chest', 'Back', 'Quads']) assert.ok(fbs.filter(d => musclesOn(d).has(m)).length >= 2);
  // weekly volume identical across splits for the same plan
  const tot = days => days.reduce((a, d) => a + d.slots.reduce((b, s) => b + s.sets, 0), 0);
  assert.equal(tot(mk('ppl', 6)), tot(mk('full_body_split', 6)));
  // recommendations by days available
  assert.equal(L.defaultSplit(6), 'full_body_split'); assert.equal(L.defaultSplit(4), 'full_body_split'); assert.equal(L.defaultSplit(2), 'full_body');
  assert.ok(L.splitsFor(5).some(x => x.id === 'ppl_ul') && !L.splitsFor(5).some(x => x.id === 'ppl'));
  // no split param → original behaviour
  assert.deepEqual(L.autofill({ plan: [{ label: 'Day 1', slots: [] }, { label: 'Day 2', slots: [] }], priorities: pr, focus: 'whole', library: lib, mode: 'all' }).map(d => d.label), ['Day 1', 'Day 2']);
}
console.log('SPLIT TESTS PASSED');

// Weight guardrails
{
  assert.equal(L.weightSanity(225, 2250).kind, 'high'); assert.equal(L.weightSanity(225, 22.5).kind, 'low');
  assert.equal(L.weightSanity(225, 245), null); assert.equal(L.weightSanity(null, 100), null);
  const bb = { kind: 'compound', load_type: 'weighted', equipment: 'Barbell', rep_min: 8, rep_max: 12 };
  const sg = L.suggestSet({ prev: { weight: 45, reps: 3, rir: 0 }, ex: bb, targetRir: 3, prevTargetRir: 3, unit: 'lb' });
  assert.ok(sg.weight >= 45, 'never below the empty bar');
}
console.log('GUARDRAIL TESTS PASSED');

// --- Far-outside-range carry-over re-solves the load (doc §4) ---
{
  const ex = { load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
  const a = L.suggestSet({ prev: { weight: 70, reps: 30, rir: null }, ex, targetRir: 3, prevTargetRir: 1, unit: 'lb' });
  assert.deepEqual([a.weight, a.reps], [75, 15], '70×30 rehab set → 75×15, not 75×26');
  const b = L.suggestSet({ prev: { weight: 200, reps: 3, rir: 1 }, ex, targetRir: 2, unit: 'lb' });
  assert.equal(b.reps, 8); assert.ok(b.weight < 200);
  const c = L.suggestSet({ prev: { weight: 70, reps: 11, rir: 1 }, ex: { ...ex, rep_min: 6, rep_max: 20 }, targetRir: 0, unit: 'lb' });
  assert.deepEqual([c.weight, c.reps], [70, 12], 'normal week unchanged');
  const d = L.suggestSet({ prev: { weight: 100, reps: 17, rir: 2 }, ex, targetRir: 1, unit: 'lb' });
  assert.ok(!d.note, 'small overshoot still uses the one-step rule');
  console.log('RE-SOLVE TESTS PASSED');
}
