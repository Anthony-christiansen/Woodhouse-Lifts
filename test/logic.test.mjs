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
assert.deepEqual(L.suggestSet({ prev: { weight: 185, reps: 12, rir: null }, ex: bench, targetRir: 2, prevTargetRir: 3, unit: 'lb' }), { weight: 187.5, reps: 11 });
assert.equal(L.suggestSet({ prev: { weight: 185, reps: 10 }, ex: bench, targetRir: 2, prevTargetRir: 3, jointHold: true, unit: 'lb' }).weight, 185);
assert.equal(L.suggestSet({ prev: null, ex: bench, targetRir: 2 }), null);
const assisted = { load_type: 'assisted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
assert.equal(L.suggestSet({ prev: { weight: 50, reps: 15 }, ex: assisted, targetRir: 1, prevTargetRir: 2, unit: 'lb' }).weight, 47.5);

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
  assert.ok(wr.light < 200 && wr.heavy > 200 && wr.heavy % 2.5 === 0 && wr.light % 2.5 === 0);
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
  assert.deepEqual([a.weight, a.reps], [72.5, 15], '70×30 rehab set → 72.5×15 (re-solved, then the +5% weekly cap), not 75×26');
  const b = L.suggestSet({ prev: { weight: 200, reps: 3, rir: 1 }, ex, targetRir: 2, unit: 'lb' });
  assert.equal(b.reps, 8); assert.ok(b.weight < 200);
  const c = L.suggestSet({ prev: { weight: 70, reps: 11, rir: 1 }, ex: { ...ex, rep_min: 6, rep_max: 20 }, targetRir: 0, unit: 'lb' });
  assert.deepEqual([c.weight, c.reps], [70, 12], 'normal week unchanged');
  const d = L.suggestSet({ prev: { weight: 100, reps: 17, rir: 2 }, ex, targetRir: 1, unit: 'lb' });
  assert.ok(!d.note, 'small overshoot still uses the one-step rule');
  console.log('RE-SOLVE TESTS PASSED');
}

// --- Meso-aware lift status (doc §6.1 v1.4): hitting the RP plan must never read as "stalled" ---
{
  const ex = { load_type: 'weighted' };
  const mk = (meso, rows) => rows.map(([week, w, r, rir], i) => ({ meso, mesoName: meso, week, date: `2026-${meso === 'VI' ? '09' : '10'}-${String(10 + i * 5).padStart(2, '0')}`,
    e: L.e1rm({ weight: w, reps: r, rir }, ex), raw: L.e1rm({ weight: w, reps: r, rir: 0 }, ex), top: { weight: w, reps: r } }));
  // A real logged bent-over row: +1 rep a week as RIR drops 3→0, both mesos
  const row = [...mk('VI', [[1, 65, 11, 3], [2, 65, 12, 2], [3, 70, 10, 1], [4, 70, 11, 0]]), ...mk('VII', [[1, 70, 9, 3], [2, 70, 10, 2], [3, 70, 11, 1], [4, 70, 12, 0]])];
  const old = L.liftStatus(row.filter(x => x.meso === 'VII').map(x => ({ e: x.e, date: x.date })), null);
  assert.equal(old.status, 'stalled', 'the OLD rule called this stalled — the bug');
  const st = L.mesoStatus(row, null, { name: 'Row' });
  assert.equal(st.status, 'progressing', 'hitting +1 rep/week as RIR drops = On track');
  assert.equal(st.vs.text, 'vs VI week 4: +1 rep at the same weight.');
  // genuinely flat for 2 weeks while RIR dropped → stalled
  assert.equal(L.mesoStatus(mk('X', [[1, 100, 10, 3], [2, 100, 10, 2], [3, 100, 10, 1]])).status, 'stalled');
  // one flat week → Held; one bad week → Dipped (no flag)
  assert.equal(L.mesoStatus(mk('X', [[1, 100, 10, 3], [2, 100, 10, 2]])).status, 'steady');
  assert.equal(L.mesoStatus(mk('X', [[1, 100, 10, 3], [2, 105, 10, 2], [3, 105, 8, 1]])).status, 'dip');
  // two weeks well below the meso's best → Down
  assert.equal(L.mesoStatus(mk('X', [[1, 100, 12, 3], [2, 100, 10, 2], [3, 100, 10, 1]])).status, 'regressing');
  // first week of a new meso → New, with the comparison to last meso
  const nw = L.mesoStatus([...mk('VI', [[1, 65, 11, 3], [4, 70, 11, 0]]), ...mk('VII', [[1, 70, 8, 3]])]);
  assert.equal(nw.status, 'new'); assert.ok(nw.vs && nw.vs.week === 1);
  // PRs counted inside one meso on the RIR-adjusted estimate
  assert.equal(L.prsInMeso(row, null, 'VII').count, 1, 'Meso B week 1 (70×9 @3) beat Meso A best (70×11 @0) on the RIR-adjusted estimate');
  assert.equal(L.prsInMeso([...row, ...mk('VII', [[5, 80, 12, 0]])], null, 'VII').count, 2);
  console.log('MESO STATUS TESTS PASSED');
}

// --- Load vs rep progression (doc §4.0), from a real logged meso ---
{
  const sled = { name: 'Sled push', load_type: 'weighted', equipment: 'Barbell', rep_min: 5, rep_max: 30 };
  const m = L.progressionMode([{ weight: 305, reps: 27 }, { weight: 315, reps: 27 }], sled, 'lb');
  assert.deepEqual(m, { mode: 'load', step: 5 }, 'his jump was +10, but steps are ~2.5% and never over 5 lb');
  const a = L.suggestSet({ prev: { weight: 315, reps: 27, rir: 1 }, ex: sled, targetRir: 0, unit: 'lb', mode: m });
  assert.deepEqual([a.weight, a.reps], [320, 27], 'sled: 315×27 → 320×27 (+5 lb, range 27–28)');
  const row = { name: 'Barbell Bent Over Row', load_type: 'weighted', equipment: 'Barbell', rep_min: 6, rep_max: 20 };
  const r = L.suggestSet({ prev: { weight: 70, reps: 11, rir: 1 }, ex: row, targetRir: 0, unit: 'lb', mode: L.progressionMode([{ weight: 70, reps: 10 }, { weight: 70, reps: 11 }], row, 'lb') });
  assert.deepEqual([r.weight, r.reps], [70, 12], 'row keeps adding reps');
  const pd = { name: 'Pec Dec Flye', load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
  const p = L.suggestSet({ prev: { weight: 185, reps: 8, rir: 1 }, ex: pd, targetRir: 0, unit: 'lb', mode: L.progressionMode([{ weight: 180, reps: 8 }, { weight: 185, reps: 8 }], pd, 'lb') });
  assert.deepEqual([p.weight, p.reps], [187.5, 8], 'pec dec: 185×8 → 187.5×8 (2.5% of 185 rounds down to 2.5 lb)');
  // several changes: majority decides; reps at the top of the range force weight; tiny loads use reps
  assert.equal(L.progressionMode([{ weight: 100, reps: 8 }, { weight: 105, reps: 8 }, { weight: 105, reps: 9 }, { weight: 110, reps: 9 }], pd, 'lb').mode, 'load');
  assert.equal(L.progressionMode([{ weight: 100, reps: 13 }, { weight: 100, reps: 15 }], pd, 'lb').mode, 'load', 'at rep max → add weight');
  assert.equal(L.progressionMode([{ weight: 20, reps: 10 }, { weight: 22.5, reps: 10 }], pd, 'lb').mode, 'reps', '2.5 lb is >5% of 22.5 lb → reps');
  assert.equal(L.loadStep(315, sled, 'lb'), 5); assert.equal(L.loadStep(100, pd, 'lb'), 2.5); assert.equal(L.loadStep(100, pd, 'kg'), 2.5);
  assert.equal(L.loadStep(400, pd, 'lb', 2.5), 2.5, 'never more than his usual jump');
  assert.equal(L.progressionMode([], pd, 'lb').mode, 'load'); assert.equal(L.progressionMode([], row, 'lb').mode, 'reps');
  const d = L.suggestSet({ prev: { weight: 315, reps: 27, rir: 0 }, ex: sled, targetRir: 4, deload: true, unit: 'lb', mode: m });
  assert.equal(d.weight, 315, 'deload never adds weight');
  console.log('PROGRESSION MODE TESTS PASSED');
}

// --- Feedback sets the progression speed (doc §4.3) ---
{
  const sled = { name: 'Sled push', load_type: 'weighted', equipment: 'Barbell', rep_min: 5, rep_max: 30 };
  const m = { mode: 'load', step: 5 }, prev = { weight: 315, reps: 27, rir: 1 }, base = { prev, ex: sled, targetRir: 0, unit: 'lb', mode: m };
  const S = fb => L.progressionSpeed(fb);
  assert.equal(S(null).speed, 'normal'); assert.equal(S({ workload: 1, pump: 2 }).speed, 'normal');
  assert.equal(S({ workload: 0, pump: 0, soreness: 0 }).speed, 'fast'); assert.equal(S({ workload: 2 }).speed, 'slow');
  assert.equal(S({ workload: 3 }).speed, 'hold'); assert.equal(S({ workload: 0, joint_pain: 2 }).speed, 'hold');
  const n = L.suggestSet({ ...base, speed: S({ workload: 1 }) }), f = L.suggestSet({ ...base, speed: S({ workload: 0, pump: 0, soreness: 0 }) });
  const sl = L.suggestSet({ ...base, speed: S({ workload: 2 }) }), h = L.suggestSet({ ...base, speed: S({ workload: 3 }) });
  assert.deepEqual([n.weight, n.reps], [320, 27], 'normal: +5 lb');
  assert.deepEqual([f.weight, f.reps], [320, 27], 'easy but a 0-RIR week: no faster jump (guardrail)');
  const f1 = L.suggestSet({ ...base, prev: { weight: 315, reps: 27, rir: 2 }, targetRir: 1, speed: S({ workload: 0, pump: 0, soreness: 0 }) });
  assert.deepEqual([f1.weight, f1.reps], [325, 27], 'easy at 1 RIR: +10 lb (two steps, inside the 5% weekly cap)');
  assert.deepEqual([sl.weight, sl.reps], [315, 28], 'pushed limit: same weight, +1 rep');
  assert.deepEqual([h.weight, h.reps], [315, 27], 'too much: hold');
  const row = { name: 'Row', load_type: 'weighted', equipment: 'Barbell', rep_min: 6, rep_max: 20 }, rb = { prev: { weight: 70, reps: 11, rir: 1 }, ex: row, targetRir: 0, unit: 'lb', mode: { mode: 'reps', step: 5 } };
  assert.equal(L.suggestSet({ ...rb, speed: S({ workload: 1 }) }).reps, 12);
  assert.equal(L.suggestSet({ ...rb, speed: S({ workload: 0 }) }).reps, 12, 'easy but 0 RIR week: normal +1');
  assert.equal(L.suggestSet({ ...rb, prev: { weight: 70, reps: 11, rir: 2 }, targetRir: 1, speed: S({ workload: 0, soreness: 0 }) }).reps, 13, 'easy at 1 RIR: +2 reps');
  assert.equal(L.suggestSet({ ...rb, speed: S({ workload: 2 }) }).reps, 11, 'pushed limit: match last week');
  const small = L.suggestSet({ prev: { weight: 50, reps: 10, rir: 2 }, ex: { load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 }, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 2.5 }, speed: S({ workload: 0, soreness: 0 }) });
  assert.equal(small.weight, 52.5, 'fast never jumps more than ~5% (50 → 52.5, not 55)');
  assert.equal(L.suggestSet({ ...base, deload: true, targetRir: 4, speed: S({ workload: 0 }) }).weight, 315, 'deload unaffected');
  // v1.9.1: faster only when too easy AND never sore; every automatic raise ≤ 5 lb (10 lb on a faster week)
  assert.equal(S({ workload: 0, pump: 0 }).speed, 'normal', 'easy but soreness unknown → normal');
  assert.equal(S({ workload: 0, soreness: 1 }).speed, 'normal', 'easy but got sore → normal');
  assert.equal(S({ workload: 0, soreness: 0, joint_pain: 0 }).speed, 'fast');
  const heavy = { name: 'Leg press', load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
  const drop2 = L.suggestSet({ prev: { weight: 400, reps: 10, rir: 3 }, ex: heavy, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 5 } });
  assert.ok(drop2.weight - 400 <= 5, 'two-RIR drop still adds at most 5 lb, got ' + drop2.weight);
  const big10 = L.suggestSet({ prev: { weight: 400, reps: 10, rir: 3 }, ex: heavy, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 10 } });
  assert.ok(big10.weight - 400 <= 5, 'a big observed step is still capped at +5 lb');
  const fastHeavy = L.suggestSet({ prev: { weight: 400, reps: 10, rir: 3 }, ex: heavy, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 5 }, speed: S({ workload: 0, soreness: 0 }) });
  assert.ok(fastHeavy.weight - 400 <= 10, 'faster week: at most +10 lb');
  const over = L.suggestSet({ prev: { weight: 400, reps: 25, rir: 1 }, ex: heavy, targetRir: 0, unit: 'lb', mode: { mode: 'reps', step: 5 } });
  assert.ok(over.weight - 400 <= 5, 'far above the rep range: still ≤ +5 lb, got ' + over.weight);
  const kg = L.suggestSet({ prev: { weight: 180, reps: 10, rir: 3 }, ex: heavy, targetRir: 1, unit: 'kg', mode: { mode: 'load', step: 5 } });
  assert.ok(kg.weight - 180 <= 2.5, 'kg: at most +2.5 kg');
  console.log('PROGRESSION SPEED TESTS PASSED');
}

// --- Injury guardrails (doc §4.5) ---
{
  const m = { load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 };
  const S = fb => L.progressionSpeed(fb);
  // weekly cap: +5% (or one step on light loads)
  const big = L.suggestSet({ prev: { weight: 100, reps: 10, rir: 3 }, ex: m, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 10 } });
  assert.equal(big.weight, 105, '+20 lb planned on 100 → capped at 105'); assert.match(big.note, /^\+5 lb.*a week/);
  const light = L.suggestSet({ prev: { weight: 20, reps: 10, rir: 1 }, ex: m, targetRir: 0, unit: 'lb', mode: { mode: 'load', step: 2.5 } });
  assert.equal(light.weight, 22.5, 'one step allowed even when it is >5% of a light load');
  // meso ceiling: +20% over week 1, then reps instead
  const ce = L.suggestSet({ prev: { weight: 120, reps: 10, rir: 1 }, ex: m, targetRir: 0, unit: 'lb', mode: { mode: 'load', step: 2.5 }, mesoStart: 100 });
  assert.deepEqual([ce.weight, ce.reps], [120, 11], 'at the +20% ceiling → reps instead'); assert.match(ce.note, /ceiling/);
  // no faster jumps on spinal-loading lifts or with any joint pain
  const ax = L.suggestSet({ prev: { weight: 200, reps: 8, rir: 2 }, ex: { ...m, tags: ['axial'] }, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 5 }, speed: S({ workload: 0, soreness: 0 }) });
  assert.equal(ax.weight, 205, 'axial lift: normal step only');
  assert.equal(S({ workload: 0, joint_pain: 1 }).speed, 'normal', 'any joint pain → no faster jumps');
  // rep jump never more than +2 at the same or heavier weight
  const r = L.suggestSet({ prev: { weight: 50, reps: 8, rir: 3 }, ex: { ...m, equipment: 'Dumbbell' }, targetRir: 0, unit: 'lb' });
  assert.equal(r.reps, 10, '+3 RIR drop would be +3 reps → capped at +2');
  console.log('INJURY GUARDRAIL TESTS PASSED');
}

// --- Review #2: low joint pain limits volume increases ---
{
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 0, P: 0, F: 1 }).delta, 2, 'everything great → +2');
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 1, P: 0, F: 1 }).delta, 1, 'any joint pain → at most +1');
  console.log('JOINT PAIN VOLUME TESTS PASSED');
}

// --- v1.9 training engine: priorities, time fitting, weekly volume cap, explanations, step sizes ---
{
  // priorities
  assert.deepEqual(L.PRIORITIES, ['emphasize', 'grow', 'maintain', 'skip']);
  assert.equal(L.normPriority('focus', 'upper'), 'emphasize'); assert.equal(L.normPriority('focus', 'whole'), 'grow');
  assert.equal(L.weeklyTarget('Chest', 'emphasize', 'custom', 'hypertrophy'), 10);
  assert.equal(L.weeklyTarget('Chest', 'grow', 'custom', 'hypertrophy'), 8);
  assert.equal(L.weeklyTarget('Chest', 'maintain', 'custom', 'hypertrophy'), 4);
  // volume rules by priority
  const good = { R: 0, L: 1, J: 0, P: 2, F: 0 };
  assert.equal(L.setAdjustment({ ...good, priority: 'emphasize' }).delta, 1);
  assert.equal(L.setAdjustment({ ...good, priority: 'grow' }).delta, 1, 'grow: performance flat → +1');
  const g = L.setAdjustment({ ...good, F: 1, priority: 'grow' });
  assert.equal(g.delta, 0, 'grow: performance up → hold'); assert.match(g.why, /no extra volume is needed yet/);
  assert.equal(L.setAdjustment({ ...good, priority: 'maintain' }).delta, 0);
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 0, P: 0, F: 0, priority: 'grow' }).delta, 1, 'grow never jumps +2');
  assert.ok(L.setAdjustment({ R: 3 }).why.length > 10, 'every rule explains itself');
  // weekly cap: two sessions can't add 4 sets in one week
  const ex = [{ id: 'a', target_sets: 3 }];
  assert.deepEqual(L.distributeDelta(ex, 2, { sessionTotal: 3, weeklyTotal: 10, prevWeeklyTotal: 8 }), [], 'already +2 this week → nothing more');
  assert.equal(L.distributeDelta(ex, 2, { sessionTotal: 3, weeklyTotal: 9, prevWeeklyTotal: 8 })[0].target_sets, 4, 'room for +1 only');
  // time fitting on every split, 2–6 days, 60/75/90 minutes
  const lib = []; let k = 0;
  for (const m of L.MUSCLES) for (const kind of ['compound', 'isolation', 'isolation']) lib.push({ id: 'x' + k++, name: m + k, muscle_group: m, kind, load_type: 'weighted' });
  for (const days of [2, 3, 4, 5, 6]) for (const sp of L.splitsFor(days)) for (const focus of ['whole', 'upper', 'lower']) for (const minutes of [60, 75, 90]) {
    const pr = L.templatePriorities(focus);
    const raw = L.autofill({ plan: Array.from({ length: days }, (_, i) => ({ label: 'Day ' + (i + 1), slots: [] })), priorities: pr, focus, library: lib, mode: 'all', goal: 'hypertrophy', split: sp.id });
    const f = L.fitToTime(raw, { minutes, priorities: pr, focus, library: lib });
    for (const [i, d] of f.days.entries()) {
      assert.ok(f.minutes[i] <= minutes + 2, `${days}d ${sp.id} ${focus} ${minutes}min: day ${i + 1} is ${f.minutes[i]} min`);
      const per = {}; for (const s of d.slots) per[s.muscle] = (per[s.muscle] || 0) + s.sets;
      assert.ok(Object.values(per).every(n => n <= L.SESSION_MUSCLE_CAP), 'no muscle over 10 sets in a session');
    }
  }
  // lowest priority is trimmed first
  const pr = { ...L.templatePriorities('upper') };
  const raw = L.autofill({ plan: [{ label: 'A', slots: [] }, { label: 'B', slots: [] }], priorities: pr, focus: 'upper', library: lib, mode: 'all', goal: 'hypertrophy', split: 'full_body' });
  const f = L.fitToTime(raw, { minutes: 75, priorities: pr, focus: 'upper', library: lib });
  const placedBefore = L.placedSets(raw), placedAfter = L.placedSets(f.days);
  assert.equal(placedAfter.Chest, placedBefore.Chest, 'emphasized chest untouched while maintain muscles can be cut');
  assert.ok(Object.keys(f.trimmed).every(m => L.normPriority(pr[m], 'upper') !== 'emphasize'));
  console.log('V1.9 ENGINE TESTS PASSED');
}

// --- v1.10: per-exercise feedback combined with the muscle rating (doc §4.3) ---
{
  const S = L.liftSpeed, sp = (e, m) => S(e, m).speed;
  const mOk = { workload: 1, joint_pain: 0, soreness: 1 }, mEasy = { workload: 0, joint_pain: 0, soreness: 0 };
  assert.equal(sp(null, mOk), 'normal', 'no exercise rating → muscle only');
  assert.equal(sp(null, { workload: 0, joint_pain: 0, soreness: 0 }), 'fast', 'old data: muscle-only fast still works');
  assert.equal(sp({ workload: 1, joint_pain: 0 }, mOk), 'normal');
  assert.equal(sp({ workload: 2, joint_pain: 0 }, mOk), 'slow', 'pushed on this exercise → slower');
  assert.equal(sp({ workload: 3, joint_pain: 0 }, mOk), 'hold', 'too much on this exercise → hold');
  assert.equal(sp({ workload: 1, joint_pain: 2 }, mOk), 'hold', 'joint pain on this exercise → hold');
  assert.match(S({ workload: 1, joint_pain: 2 }, mOk).why, /this exercise/);
  // muscle joint pain that belonged to another lift: this pain-free lift slows, it doesn't hold
  assert.equal(sp({ workload: 1, joint_pain: 0 }, { workload: 1, joint_pain: 2 }), 'slow');
  assert.equal(sp({ workload: 1, joint_pain: 2 }, { workload: 1, joint_pain: 2 }), 'hold', 'the lift that hurt holds');
  assert.equal(sp({ workload: 1, joint_pain: 0 }, { workload: 3, joint_pain: 0 }), 'hold', 'muscle "Too much" holds every lift');
  assert.equal(sp({ workload: 0, joint_pain: 0 }, { workload: 2, joint_pain: 0 }), 'slow', 'muscle pushed caps an easy exercise');
  // faster needs both easy + never sore + no pain anywhere
  assert.equal(sp({ workload: 0, joint_pain: 0 }, mEasy), 'fast');
  assert.equal(sp({ workload: 0, joint_pain: 0 }, mOk), 'normal', 'exercise easy, muscle not → normal');
  assert.equal(sp({ workload: 1, joint_pain: 0 }, mEasy), 'normal', 'muscle easy, exercise not → normal');
  assert.equal(sp({ workload: 0, joint_pain: 1 }, mEasy), 'normal', 'any exercise joint pain → no faster');
  assert.equal(sp({ workload: 0, joint_pain: 0 }, { ...mEasy, soreness: 2 }), 'normal', 'got sore → no faster');
  // plugs into suggestSet
  const sled = { name: 'Sled push', load_type: 'weighted', equipment: 'Barbell', rep_min: 5, rep_max: 30 };
  const base = { prev: { weight: 315, reps: 27, rir: 2 }, ex: sled, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 5 } };
  assert.equal(L.suggestSet({ ...base, speed: S({ workload: 0, joint_pain: 0 }, mEasy) }).weight, 325, 'both easy + never sore → +10');
  assert.equal(L.suggestSet({ ...base, speed: S({ workload: 1, joint_pain: 0 }, mEasy) }).weight, 320, 'normal → +5');
  assert.equal(L.suggestSet({ ...base, speed: S({ workload: 1, joint_pain: 2 }, mOk) }).weight, 315, 'exercise joint pain → hold');
  console.log('EXERCISE FEEDBACK TESTS PASSED');
}

// ---------- v1.11.1: RP comparison + audit fixes ----------
{
  // Audit B: templates never emphasize more than MAX_EMPHASIZE muscles.
  for (const f of ['upper', 'lower', 'whole', 'custom']) {
    const n = Object.values(L.templatePriorities(f)).filter(p => p === 'emphasize').length;
    assert.ok(n <= L.MAX_EMPHASIZE, `${f} emphasizes ${n}`);
  }
  assert.equal(L.templatePriorities('upper').Biceps, 'grow');
  assert.equal(L.templatePriorities('upper').Quads, 'maintain');
  assert.equal(L.templatePriorities('lower').Calves, 'grow');

  // Audit A: missing performance is not a plateau.
  assert.equal(L.setAdjustment({ R: 0, L: 1, J: 0, P: 2, F: null, priority: 'grow' }).delta, 0, 'grow + no F → hold');
  assert.equal(L.setAdjustment({ R: 0, L: 1, J: 0, P: 2, F: 0, priority: 'grow' }).delta, 1, 'grow + flat F → +1');
  // +2 needs a rated low pump and a performance comparison; a skipped pump is not "low stimulus".
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 0, P: null, F: 0 }).delta, 1, 'pump not rated → +1 max');
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 0, P: 1, F: null }).delta, 1, 'no performance → +1 max');
  assert.equal(L.setAdjustment({ R: 0, L: 0, J: 0, P: 1, F: 0 }).delta, 2);

  // RP comparison (a real meso's wk 3, deadlift): a capped "re-set" must re-solve reps for the capped weight.
  const dl = { name: 'Deadlift', load_type: 'weighted', equipment: 'Barbell', kind: 'compound', rep_min: 3, rep_max: 8, tags: ['axial'] };
  const s = L.suggestSet({ prev: { weight: 95, reps: 12, rir: 1 }, ex: dl, targetRir: 0, prevTargetRir: 1, unit: 'lb',
    mode: L.progressionMode([{ weight: 105, reps: 7 }, { weight: 95, reps: 12 }], dl, 'lb'), speed: { speed: 'normal' }, mesoStart: 105 });
  assert.equal(s.weight, 97.5); assert.ok(s.reps >= 12, `reps ${s.reps} must not drop below last week at a heavier weight`);
  assert.ok(!/Re-set/.test(s.note), 'no contradictory "re-set" note once capped');
  // the window includes the reps you actually work at
  const w = L.weightRange({ prev: { weight: 95, reps: 12, rir: 1 }, ex: dl, targetRir: 0, unit: 'lb' });
  assert.ok(w.light <= 97.5 && w.heavy >= 97.5, JSON.stringify(w));
  // a load step on a light dumbbell re-targets reps; a small step (rounding noise) keeps them
  const row = { name: 'DB row', load_type: 'weighted', equipment: 'Dumbbell', kind: 'compound', rep_min: 6, rep_max: 12, tags: [] };
  const r1 = L.suggestSet({ prev: { weight: 45, reps: 12, rir: 2 }, ex: row, targetRir: 1, unit: 'lb', mode: { mode: 'load', step: 5 }, speed: { speed: 'normal' } });
  assert.deepEqual([r1.weight, r1.reps], [50, 9], '45×12 → 50×9, not 50×12');
  const cr = { name: 'Rope crunch', load_type: 'weighted', equipment: 'Cable', kind: 'isolation', rep_min: 6, rep_max: 20, tags: [] };
  const r2 = L.suggestSet({ prev: { weight: 57.5, reps: 7, rir: 1 }, ex: cr, targetRir: 0, unit: 'lb', mode: { mode: 'load', step: 2.5 }, speed: { speed: 'normal' } });
  assert.deepEqual([r2.weight, r2.reps], [60, 7]);
  console.log('V1.11.1 FIX TESTS PASSED');
}

// ---------- Longitudinal simulation (audit §6): 10 profiles × 6 weeks ----------
// A simulated lifter does exactly what's suggested and reports a feedback profile. Invariants:
//  - an automatic weekly raise is ≤ 5 lb (≤ 10 lb only on a "faster" week), ≤ +20% over week 1
//  - reps never jump more than +2 at a weight that isn't lighter
//  - the demand (e1RM needed to hit the suggestion at target RIR) never rises more than ~8% in a week
//  - a weight increase never comes with fewer reps unless the effort model says it's equivalent or easier
//  - joint pain / "too much" never gets a heavier weight; the deload is never heavier or longer than last week
{
  const e1 = (w, r, rir) => w * (1 + (r + rir) / 30);
  const exs = [
    { name: 'Pec deck', load_type: 'weighted', equipment: 'Machine', kind: 'isolation', rep_min: 8, rep_max: 15, tags: [] },
    { name: 'Row', load_type: 'weighted', equipment: 'Dumbbell', kind: 'compound', rep_min: 6, rep_max: 12, tags: [] },
    { name: 'Squat', load_type: 'weighted', equipment: 'Barbell', kind: 'compound', rep_min: 5, rep_max: 10, tags: ['axial'] },
    { name: 'Lateral raise', load_type: 'weighted', equipment: 'Dumbbell', kind: 'isolation', rep_min: 10, rep_max: 20, tags: [] },
    { name: 'Deadlift (worked high)', load_type: 'weighted', equipment: 'Barbell', kind: 'compound', rep_min: 3, rep_max: 8, tags: ['axial'] },
  ];
  const profiles = [
    { name: 'beginner, easy', start: [100, 10], fb: () => ({ workload: 0, joint_pain: 0, soreness: 0 }) },
    { name: 'normal', start: [135, 8], fb: () => ({ workload: 1, joint_pain: 0, soreness: 1 }) },
    { name: 'pushed', start: [60, 12], fb: () => ({ workload: 2, joint_pain: 0, soreness: 1 }) },
    { name: 'too much', start: [200, 6], fb: () => ({ workload: 3, joint_pain: 0, soreness: 2 }) },
    { name: 'joint pain wk3+', start: [80, 9], fb: wk => ({ workload: 1, joint_pain: wk >= 3 ? 2 : 0, soreness: 1 }) },
    { name: 'no feedback', start: [45, 11], fb: () => null },
    { name: 'light dumbbell', start: [15, 12], fb: () => ({ workload: 1, joint_pain: 0, soreness: 1 }) },
    { name: 'high reps', start: [95, 12], fb: () => ({ workload: 1, joint_pain: 0, soreness: 1 }) },
    { name: 'heavy', start: [315, 5], fb: () => ({ workload: 1, joint_pain: 0, soreness: 1 }) },
    { name: 'mixed', start: [120, 9], fb: wk => (wk % 2 ? { workload: 0, joint_pain: 0, soreness: 0 } : { workload: 2, joint_pain: 1, soreness: 2 }) },
  ];
  let checks = 0;
  for (const P of profiles) for (const ex of exs) {
    if (ex.equipment === 'Barbell' && P.start[0] < 45) continue;   // no barbell is lighter than the bar
    const weeks = 6, trail = [];
    let prev = { weight: P.start[0], reps: P.start[1], rir: L.rirForWeek(1, weeks).rir };
    trail.push({ weight: prev.weight, reps: prev.reps });
    for (let wk = 2; wk <= weeks; wk++) {
      const t = L.rirForWeek(wk, weeks), fb = P.fb(wk - 1);
      const speed = L.liftSpeed(fb, fb);
      const s = L.suggestSet({ prev, ex, targetRir: t.rir, prevTargetRir: prev.rir, deload: t.deload, unit: 'lb',
        mode: L.progressionMode(trail, ex, 'lb'), speed, mesoStart: trail[0].weight });
      const tag = `${P.name} / ${ex.name} wk${wk}: ${prev.weight}×${prev.reps} → ${s.weight}×${s.reps}`;
      assert.ok(s && s.weight != null && s.reps >= 1, tag);
      if (t.deload) { assert.ok(s.weight <= prev.weight && s.reps <= prev.reps, 'deload ' + tag); checks++; break; }
      const up = s.weight - prev.weight;
      assert.ok(up <= (speed.speed === 'fast' ? 10 : 5) + 1e-9, 'weekly cap ' + tag);
      assert.ok(s.weight <= Math.max(prev.weight, trail[0].weight * 1.2) + 1e-9, 'meso ceiling ' + tag);
      if (s.weight >= prev.weight) assert.ok(s.reps <= prev.reps + L.GUARD.maxRepJump, 'rep jump ' + tag);
      const demand = e1(s.weight, s.reps, t.rir) / e1(prev.weight, prev.reps, prev.rir);
      assert.ok(demand <= 1.08, `demand +${((demand - 1) * 100).toFixed(1)}% ` + tag);
      if (up > 0 && s.reps < prev.reps) assert.ok(demand <= 1.06, 'heavier + fewer reps must be near-equivalent ' + tag);
      if (speed.speed === 'hold') assert.ok(s.weight <= prev.weight, 'hold never adds weight ' + tag);
      checks += 6;
      prev = { weight: s.weight, reps: s.reps, rir: t.rir };
      trail.push({ weight: s.weight, reps: s.reps });
    }
  }
  console.log(`LONGITUDINAL SIM PASSED (${profiles.length} profiles × ${exs.length} lifts, ${checks} checks)`);
}

// ---------- v1.11.2: Progress views ----------
{
  const es = [{ meso: 'old', week: 1, raw: 50 }, { meso: 'm', week: 1, raw: 100 }, { meso: 'm', week: 2, raw: 102 }, { meso: 'm', week: 3, raw: 104 }];
  assert.deepEqual(L.mesoChange(es, 'm'), { weeks: 3, fromWeek: 1, toWeek: 3, pct: 4 }, 'week 1 → latest of THIS meso only (old meso ignored)');
  assert.equal(L.mesoChange([{ meso: 'm', week: 2, raw: 100 }], 'm').pct, null, 'one week: no % yet');
  assert.equal(L.mesoChange(es, 'none'), null);
  const now = new Date('2026-11-22T12:00:00Z');
  assert.equal(L.isStale('2026-07-01', now), true, 'months ago → not current');
  assert.equal(L.isStale('2026-11-01', now), false);
  assert.equal(L.isStale(null, now), true);
  console.log('V1.11.2 PROGRESS TESTS PASSED');
}

// ---------- v1.11.4: in-app "How it works" page renderer (md.js) ----------
{
  const MD = await import('../md.js');
  const { html } = MD.mdToHtml('# T\n\nHi <script>alert(1)</script> **b** [x](javascript:alert(1)) [ok](https://pubmed.ncbi.nlm.nih.gov/1/) `<i>`\n\n| a | b |\n|---|---|\n| 1 | <img src=x onerror=alert(1)> |\n\n- one\n  - two\n');
  assert.ok(!/<script|<img|onerror=|javascript:/i.test(html.replace(/&lt;[^]*?&gt;/g, '')), 'no live markup or js links: ' + html);
  assert.ok(html.includes('&lt;script&gt;') && html.includes('&lt;img'), 'escaped, shown as text');
  assert.ok(html.includes('<a href="https://pubmed.ncbi.nlm.nih.gov/1/" target="_blank" rel="noopener noreferrer">ok</a>'), html);
  assert.ok(html.includes('<b>b</b>') && html.includes('<code>&lt;i&gt;</code>') && html.includes('<table>') && html.replace(/\n/g, '').includes('<ul><li>one<ul><li>two'), html);
  const doc = MD.mdToHtml((await import('node:fs')).readFileSync(new URL('../docs/training-logic.md', import.meta.url), 'utf8'));
  assert.ok(doc.toc.length >= 7 && /<table>/.test(doc.html), 'the real doc renders with contents and tables');
  console.log('V1.11.4 MD RENDER TESTS PASSED');
}

// ---------- v1.11.5: the builder is maximized for the days and time you have ----------
{
  let n = 0; const lib2 = [];
  for (const m of L.MUSCLES) for (let i = 1; i <= 5; i++) lib2.push({ id: 'b' + (++n), name: `${m} ${i}`, muscle_group: m, kind: i <= 2 ? 'compound' : 'isolation', load_type: 'weighted', equipment: 'Machine', rep_min: 8, rep_max: 15 });
  let checked = 0;
  for (const days of [2, 3, 4, 5, 6]) for (const split of L.splitsFor(days).map(x => x.id)) for (const goal of ['hypertrophy', 'strength', 'athletic'])
    for (const focus of ['whole', 'upper', 'lower']) for (const minutes of [45, 60, 75, 90, null]) {
      const pr = L.templatePriorities(focus), tag = `${days}d ${split} ${goal} ${focus} ${minutes}`;
      const r = L.fitPlan({ plan: Array.from({ length: days }, () => ({ label: 'Day', slots: [] })), priorities: pr, focus, goal, split, library: lib2, minutes });
      const got = L.placedSets(r.days);
      for (const m of L.MUSCLES) {
        const p = L.normPriority(r.priorities[m], focus), f = r.days.filter(d => d.slots.some(s => s.muscle === m)).length;
        if (p === 'maintain') assert.ok(got[m] >= L.MAINTAIN_WEEK_MIN, `${tag}: Maintain ${m} must never be 0`);
        // muscles you grow are trained 2×/week (PPL and 2-day Upper/Lower train each muscle once by design)
        if ((p === 'grow' || p === 'emphasize') && !(split === 'ppl' && days === 3) && !(split === 'upper_lower' && days === 2)) assert.ok(f >= 2, `${tag}: ${m} only ${f}×/week`);
        if (L.normPriority(pr[m], focus) === 'emphasize') assert.equal(L.normPriority(r.priorities[m], focus), 'emphasize', `${tag}: Emphasize is never moved`);
      }
      for (const m of r.demoted) assert.ok(['Calves', 'Biceps', 'Triceps', 'Shoulders'].includes(m) && L.normPriority(pr[m], focus) === 'grow', `${tag}: only small Grow muscles move to Maintain (${m})`);
      // the usual 3-day setup grows everything it says it grows
      if (days === 3 && split === 'full_body_split' && [60, 75, 90].includes(minutes)) assert.deepEqual(r.under, [], `${tag}: ${JSON.stringify(r.under)}`);
      checked++;
    }
  // 3 days × 60 min, Balanced hypertrophy: big muscles at a growth level, not 4/8 as before
  const r = L.fitPlan({ plan: [1, 2, 3].map(() => ({ label: 'D', slots: [] })), priorities: L.templatePriorities('whole'), focus: 'whole', goal: 'hypertrophy', split: 'full_body_split', library: lib2, minutes: 60 });
  const got = L.placedSets(r.days);
  for (const m of ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes']) assert.ok(got[m] >= 6, `${m} ${got[m]}`);
  console.log(`V1.11.5 BUILDER TESTS PASSED (${checked} day/split/goal/template/time combinations)`);
}
