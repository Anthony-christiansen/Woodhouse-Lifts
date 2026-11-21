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
