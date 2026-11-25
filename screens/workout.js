// Woodhouse Lifts — recovery follow-ups (doc §3, §5), workout logger, cardio (moved out of app.js in 1.20.3, code unchanged).
import * as L from '../logic.js?v=63';
import { ic } from '../icons.js?v=63';
import { esc, fmtNum, fmt, today, dayName, weekStart, isoDay } from '../format.js?v=63';
import { toast, openSheet, closeSheet } from '../ui.js?v=63';
import { profile, setBuilder } from '../state.js?v=63';
import { sb, deleteSet, durableWrite, flushQueue, isNetErr, lastSent, overlayDays, pendingOps, qLoad, qStore, saveSet, setKey, storageAtRisk, syncBadge } from '../net.js?v=63';
import { $, $$, OPTIONAL, RATINGS, W, activeMeso, app, bwD, cardioItems, cardioSince, check, effortShort, effortText, fetchAll, go, haptic, liftInsights, loadExercises, loadPrefs, mesoDays, needKeys, openDays, rateKeys, segHtml, setHeader, sheet, slipFor, statusPill, toLb, unit, warnList, workoutCardioSince } from '../app.js?v=63';

// ---------- recovery follow-ups (doc §3, §5) ----------
export async function pendingRecovery(day, muscles) {
  if (!muscles.length) return [];
  const rows = check(await sb.from('muscle_feedback')
    .select('*, workout_days!inner(id, week, day_index, label, mesocycle_id, completed_at)')
    .eq('workout_days.mesocycle_id', day.mesocycle_id).is('soreness', null).in('muscle_group', muscles));
  const best = {};
  for (const r of rows) {
    const src = r.workout_days;
    // days can be done in any order inside a week, so "last time" = the most recently FINISHED session for that muscle
    if (!src.completed_at || src.id === day.id || src.week > day.week) continue;
    if (!best[r.muscle_group] || src.completed_at > best[r.muscle_group].workout_days.completed_at) best[r.muscle_group] = r;
  }
  return Object.values(best);
}

export async function applyAdjustment(fb, R, meso) {
  const src = fb.workout_days;
  const update = { soreness: R, recovery_at: new Date().toISOString() };
  const srcDeload = L.rirForWeek(src.week, meso.weeks).deload;
  const target = !srcDeload && check(await sb.from('workout_days').select('id, week, completed_at, skipped_at')
    .eq('mesocycle_id', meso.id).eq('week', src.week + 1).eq('day_index', src.day_index).maybeSingle());
  if (fb.muscle_group !== 'Cardio' && target && !target.completed_at && !target.skipped_at && !L.rirForWeek(target.week, meso.weeks).deload && !fb.adjusted) {
    // Mesos imported from RP (or made before v1.9) have no stored priorities: keep their original behaviour (Emphasize rules).
    const rawP = meso.priorities?.[fb.muscle_group];
    const priority = rawP ? L.normPriority(rawP, meso.focus) : 'emphasize';
    const bothWeeks = check(await sb.from('workout_exercises').select('id, workout_day_id, exercise_id, target_sets, target_rir, position, exercises!inner(muscle_group), workout_days!inner(week, mesocycle_id)')
      .eq('workout_days.mesocycle_id', meso.id).in('workout_days.week', [src.week - 1, src.week, target.week]).eq('exercises.muscle_group', fb.muscle_group));
    // v1.16.0 (audit T3) / v1.18.0 (audit T1): how many of this muscle's sessions in a row — on any day, in the order
    // you did them — had flat or lower comparable performance; and whether sets were just added. One flat session
    // isn't a plateau, an improvement on any day resets the run, and an increase gets a week to show.
    const hist = check(await sb.from('muscle_feedback').select('id, performance, workout_days!inner(week, completed_at, mesocycle_id)')
      .eq('muscle_group', fb.muscle_group).eq('workout_days.mesocycle_id', meso.id).not('workout_days.completed_at', 'is', null));
    const sessions = hist.filter(h => h.workout_days.completed_at <= (src.completed_at || new Date().toISOString()) || h.id === fb.id)
      .map(h => ({ at: h.id === fb.id ? (src.completed_at || new Date().toISOString()) : h.workout_days.completed_at, performance: h.id === fb.id ? fb.performance : h.performance, deload: L.rirForWeek(h.workout_days.week, meso.weeks).deload }));
    if (!hist.some(h => h.id === fb.id)) sessions.push({ at: src.completed_at || new Date().toISOString(), performance: fb.performance, deload: false });
    const stalls = L.stallRun(sessions);
    const wkTotal = w => bothWeeks.filter(x => x.workout_days.week === w).reduce((a, x) => a + (x.target_sets || 0), 0);
    const justAdded = src.week > 1 && wkTotal(src.week) > wkTotal(src.week - 1);
    const adj = L.setAdjustment({ R, L: fb.workload, J: fb.joint_pain, P: fb.pump, F: fb.performance, priority, stalls, justAdded });
    const weekWes = bothWeeks.filter(w => w.workout_days.week === target.week);
    const prevWeeklyTotal = bothWeeks.filter(w => w.workout_days.week === src.week).reduce((a, w) => a + (w.target_sets || 0), 0);
    const sess = weekWes.filter(w => w.workout_day_id === target.id).sort((a, b) => a.position - b.position);
    const weeklyTotal = weekWes.reduce((a, w) => a + w.target_sets, 0);
    const changes = L.distributeDelta(sess, adj.delta, { sessionTotal: sess.reduce((a, w) => a + w.target_sets, 0), weeklyTotal, prevWeeklyTotal });
    const srcWes = check(await sb.from('workout_exercises').select('target_rir, exercises!inner(muscle_group)').eq('workout_day_id', src.id).eq('exercises.muscle_group', fb.muscle_group));
    const srcRir = srcWes[0]?.target_rir;
    // Everything below goes to the database as ONE call that runs at most once per feedback entry
    // (apply_feedback_adjustment) — a retry after a dropped connection can't add the sets twice.
    const pChanges = sess.map(w => { const c = changes.find(x => x.id === w.id), patch = { id: w.id, flag: adj.flag || '' };
      if (c) patch.target_sets = c.target_sets;
      if (adj.holdRir && srcRir != null && srcRir > w.target_rir) patch.target_rir = srcRir;
      return patch; });
    let pDeload = [];
    if (target.week === meso.weeks - 1 && meso.weeks >= 3) {   // deload volume follows the last accumulation week (doc §1.8)
      const dl = check(await sb.from('workout_days').select('id').eq('mesocycle_id', meso.id).eq('week', meso.weeks).eq('day_index', src.day_index).maybeSingle());
      if (dl) pDeload = sess.map(w => ({ workout_day_id: dl.id, exercise_id: w.exercise_id, target_sets: L.deloadSets(changes.find(c => c.id === w.id)?.target_sets ?? w.target_sets) }));
    }
    let applied;
    const rr = await sb.rpc('apply_feedback_adjustment', { p_feedback_id: fb.id, p_soreness: R, p_changes: pChanges, p_deload: pDeload });
    if (rr.error && /PGRST202|could not find the function/i.test((rr.error.code || '') + ' ' + rr.error.message)) {
      // Database not upgraded yet (migration 20261121070000 pending): fall back to the old step-by-step writes.
      for (const c of pChanges) check(await sb.from('workout_exercises').update({ ...(c.target_sets != null ? { target_sets: c.target_sets } : {}), ...(c.target_rir != null ? { target_rir: c.target_rir } : {}), flag: c.flag || null }).eq('id', c.id));
      for (const d of pDeload) check(await sb.from('workout_exercises').update({ target_sets: d.target_sets }).eq('workout_day_id', d.workout_day_id).eq('exercise_id', d.exercise_id));
      check(await sb.from('muscle_feedback').update({ ...update, adjusted: true }).eq('id', fb.id)); applied = true;
    } else applied = check(rr);
    // Explain the decision like a coach (review #2): what changed, and why.
    const applied_delta = changes.reduce((a, c) => a + c.target_sets - (sess.find(w => w.id === c.id)?.target_sets || 0), 0);
    const after = weeklyTotal + applied_delta;
    const why = adj.delta > 0 && applied_delta < adj.delta ? `${adj.why.replace(/ — (one|two) sets? added$/, '')}, but it's at the weekly limit for this muscle — ${applied_delta > 0 ? `+${applied_delta} only` : 'held'}` : adj.why;
    if (applied) toast(`${fb.muscle_group}: ${applied_delta ? `${weeklyTotal} → ${after}` : `kept at ${weeklyTotal}`} weekly sets — ${why}${adj.holdRir ? '; RIR held' : ''}.`, false, 5000);
    return;
  }
  check(await sb.from('muscle_feedback').update(update).eq('id', fb.id));
}

// ---------- workout logger ----------
export async function renderWorkout(dayId, mode) {
  const preview = mode === 'view';
  if (!dayId) {
    setHeader('Workout', null, 'workout');
    const m = await activeMeso(); const ds = m ? await mesoDays(m.id) : [];
    const cur = ds.find(d => d.started_at && !d.completed_at && !d.skipped_at) || openDays(ds)[0];
    if (cur) return renderWorkout(cur.id);
    app.innerHTML = `<div class="card"><h3>No workout queued</h3><p class="muted">${m ? 'This mesocycle is finished.' : 'Start a mesocycle to get your next workout here.'}</p>
      <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">Templates</button></div></div>
      <button class="list-btn" data-go="#/cardio"><span class="list-ico">${ic('heart')}</span><div class="grow"><b>Just cardio today?</b><div class="muted small">Log time and intensity</div></div>›</button>`;
    return $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') setBuilder(null); go(b.dataset.go); });
  }
  const day = overlayDays([check(await sb.from('workout_days').select('*, mesocycles(*)').eq('id', dayId).single())])[0];
  const meso = day.mesocycles;
  if (day.superseded_at && mode !== 'view') {   // v1.17.1: replaced by an early light week
    toast(`Week ${day.week} was replaced by the light week — showing it read-only. Anything already logged here is kept.`, false, 5000);
    return renderWorkout(dayId, 'view');
  }
  setHeader(`Wk ${day.week} · ${dayName(day)}`, '#/meso/' + meso.id, 'workout');
  const all = await mesoDays(meso.id);

  // Guards (in progress elsewhere / an earlier WEEK not done). Days inside a week can be done in any order —
  // legs today instead of back is fine; each day still progresses from the same day last week (doc §5.3).
  if (!day.completed_at && !day.skipped_at && !preview) {
    const live = all.find(d => d.started_at && !d.completed_at && !d.skipped_at && d.id !== day.id);
    const earlier = all.filter(d => d.week < day.week && !d.completed_at && !d.skipped_at);
    if (live) {
      const cr = await sb.from('sets').select('id, workout_exercises!inner(workout_day_id)', { count: 'exact', head: true })
        .eq('workout_exercises.workout_day_id', live.id).not('completed_at', 'is', null);
      const liveSets = cr.error ? 1 : (cr.count ?? 0);   // unsure → treat as logged (don't offer a switch)
      const loggedAny = Object.values(qLoad()).some(p => p.completed_at) || liveSets > 0;
      app.innerHTML = `<div class="card warn"><h3>Workout in progress</h3>
        <p class="small">Week ${live.week} · ${esc(dayName(live))} is open${loggedAny ? ' with sets logged. Finish it (or skip it) before starting another day.' : ', but nothing is logged yet — you can switch.'}</p>
        <div class="grid2"><button class="primary" data-go="#/workout/${live.id}">Resume ${esc(dayName(live))}</button>
        ${loggedAny ? `<button data-go="#/workout/${day.id}/view">Just look at ${esc(dayName(day))}</button>` : `<button id="switchDay">Switch to ${esc(dayName(day))}</button>`}</div></div>`;
      $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
      $('#switchDay') && ($('#switchDay').onclick = async () => { check(await sb.from('workout_days').update({ started_at: null }).eq('id', live.id)); renderWorkout(dayId); });
      return;
    }
    if (earlier.length) {
      const e = earlier[0];
      app.innerHTML = `<div class="card warn"><h3>Week ${e.week} isn't finished</h3>
        <p class="small">Week ${e.week} · ${esc(dayName(e))} is still open${earlier.length > 1 ? ` (and ${earlier.length - 1} more)` : ''}. Weeks go in order so each one can progress from the last — but you can look at this day now.</p>
        <div class="grid2"><button class="primary" data-go="#/workout/${e.id}">Go to it</button><button id="skip">Skip it</button></div>
        <button class="ghost block" data-go="#/workout/${day.id}/view">Just look at Week ${day.week} · ${esc(dayName(day))}</button></div>`;
      $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
      $('#skip').onclick = async () => {
        if (!confirm(`Skip Week ${e.week} · ${dayName(e)}? You can still open it later.`)) return;
        check(await sb.from('workout_days').update({ skipped_at: new Date().toISOString() }).eq('id', e.id));
        renderWorkout(dayId);
      }; return;
    }
  }

  const wes = check(await sb.from('workout_exercises').select('*, exercises(*), sets(*)').eq('workout_day_id', dayId).order('position'));
  // Sets saved on the phone but not yet synced win over the server copy, so nothing typed offline disappears.
  const pending = qLoad();
  wes.forEach(w => Object.values(pending).filter(p => p.workout_exercise_id === w.id).forEach(p => {
    const i = w.sets.findIndex(x => x.set_index === p.set_index); const row = { ...(w.sets[i] || {}), ...p, _queued: true };
    if (i >= 0) w.sets[i] = row; else w.sets.push(row); }));
  wes.forEach(w => w.sets.sort((a, b) => a.set_index - b.set_index));
  // v1.12.3: a copy in stored units (lb), used if you finish with no signal.
  const loadedRaw = wes.map(w => ({ id: w.id, exercise_id: w.exercise_id, target_sets: w.target_sets, target_rir: w.target_rir, exercises: w.exercises, sets: w.sets.map(x => ({ ...x })) }));
  wes.forEach(w => w.sets.forEach(x => { x.weight = W(x.weight); }));
  // The meso's goal sets each exercise's rep range (hypertrophy keeps the exercise's own range).
  const goal = L.goalOf(meso.goal);
  wes.forEach(w => { w.exercises = { ...w.exercises, ...L.repRange(w.exercises, goal) }; });
  const isCardio = w => w.exercises.load_type === 'cardio';
  const muscles = [...new Set(wes.filter(w => !isCardio(w)).map(w => w.exercises.muscle_group))];
  const groups = wes.some(isCardio) ? [...muscles, 'Cardio'] : muscles; // everything that gets rated
  const { deload } = L.rirForWeek(day.week, meso.weeks);

  // Recovery questions about last time come first (asked before you start).
  if (!day.completed_at && !preview) {
    const pending = await pendingRecovery(day, groups);
    if (pending.length) return renderRecoveryGate(day, meso, pending);
  }

  // Last week's same session → auto-matched weights and rep targets.
  const prev = {}, staleCarry = {}; let prevFb = {}; const prevExFb = {};   // exercise_id → last week's exercise rating (v1.10)
  const trail = {};   // exercise_id → [{ week, weight, reps }] first working set per earlier meso week (doc §4.0)
  // Only FINISHED sets count, and when a lift appears on more than one day a week, the same day (day_index) as
  // today wins — so the trend compares like with like (review #2).
  const addTrail = (id, week, sets, dayIndex) => { const f = (sets || []).filter(z => z.reps != null && z.duration_min == null && z.completed_at).sort((a, b) => a.set_index - b.set_index)[0];
    if (!f) return; const t = trail[id] = trail[id] || []; const same = dayIndex === day.day_index, i = t.findIndex(x => x.week === week);
    const e = { week, weight: Number(f.weight), reps: Number(f.reps), same };
    if (i < 0) t.push(e); else if (same && !t[i].same) t[i] = e; };
  if (day.week > 1) {
    const ids0 = [...new Set(wes.map(w => w.exercise_id))];
    if (ids0.length) check(await sb.from('workout_exercises').select('exercise_id, sets(set_index, weight, reps, duration_min, completed_at), workout_days!inner(week, day_index, mesocycle_id)')
      .in('exercise_id', ids0).eq('workout_days.mesocycle_id', meso.id).lt('workout_days.week', day.week).order('id'))
      .forEach(x => addTrail(x.exercise_id, x.workout_days.week, x.sets, x.workout_days.day_index));
    const pd = check(await sb.from('workout_days').select('id').eq('mesocycle_id', meso.id).eq('week', day.week - 1).eq('day_index', day.day_index).maybeSingle());
    if (pd) {
      const pwes = check(await sb.from('workout_exercises').select('id, exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe, completed_at)').eq('workout_day_id', pd.id));
      pwes.forEach(x => { const done = x.sets.filter(z => z.completed_at); if (done.length) prev[x.exercise_id] = { rir: x.target_rir, sets: done.sort((a, b) => a.set_index - b.set_index).map(z => ({ ...z, weight: W(z.weight) })) }; });
      if (pwes.length) { const r = await sb.from('exercise_feedback').select('workout_exercise_id, workload, joint_pain').in('workout_exercise_id', pwes.map(x => x.id));
        if (!r.error) r.data.forEach(f => { const x = pwes.find(w => w.id === f.workout_exercise_id); if (x) prevExFb[x.exercise_id] = f; }); }
      check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', pd.id)).forEach(f => prevFb[f.muscle_group] = f);
    }
  } else {
    // Week 1 carries over from your last finished mesocycle: its final working week for the same exercise.
    const ids = [...new Set(wes.map(w => w.exercise_id))];
    const hist = ids.length ? await fetchAll(() => sb.from('workout_exercises')
      .select('exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe, completed_at), workout_days!inner(week, day_index, completed_at, mesocycle_id, mesocycles(weeks, name))')
      .in('exercise_id', ids).neq('workout_days.mesocycle_id', meso.id).not('workout_days.completed_at', 'is', null).order('id')) : [];
    // Week 1 progresses from your PREVIOUS meso only (the one you trained most recently, finished or not) — doc §5.6.
    // An exercise that wasn't in it gets no auto weight: older history (e.g. a 2025 rehab block) can't be translated,
    // so it's shown for reference only.
    // "Run it again from week N" pins the source meso and week instead.
    const last = meso.carry_meso_id ? null : check(await sb.from('workout_days').select('mesocycle_id, completed_at').neq('mesocycle_id', meso.id)
      .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle());
    const prevMesoId = meso.carry_meso_id || last?.mesocycle_id || null;
    for (const h of hist) {
      h.sets = (h.sets || []).filter(z => z.completed_at);   // unfinished sets never set next week's numbers
      const d = h.workout_days; if (!h.sets.length || L.rirForWeek(d.week, d.mesocycles?.weeks || 99).deload) continue;
      if (meso.carry_week && d.mesocycle_id === meso.carry_meso_id && d.week !== meso.carry_week) continue;
      if (d.mesocycle_id === prevMesoId) addTrail(h.exercise_id, d.week, h.sets, d.day_index);
      const into = d.mesocycle_id === prevMesoId ? prev : staleCarry;
      const cur = into[h.exercise_id];
      if (!cur || d.completed_at > cur.at) into[h.exercise_id] = { rir: h.target_rir, at: d.completed_at, carried: true, wk: d.week, mname: d.mesocycles?.name || 'earlier meso', sets: h.sets.sort((a, b) => a.set_index - b.set_index).map(z => ({ ...z, weight: W(z.weight) })) };
    }
    for (const id of Object.keys(staleCarry)) if (prev[id]) delete staleCarry[id];
  }
  // Per-lift status from earlier sessions (today excluded) → flag + recommendation on the lift (doc §6.1).
  const liftIdsToday = [...new Set(wes.filter(w => !isCardio(w)).map(w => w.exercise_id))];
  const insights = await liftInsights(liftIdsToday, { excludeSessions: wes.map(w => w.id),
    rirFor: Object.fromEntries(wes.map(w => [w.exercise_id, w.target_rir])) }).catch(() => ({}));
  // Reference only: how last week compares with your all-time best. Never changes today's targets (those come from last week).
  const histNote = we => { const x = insights[we.exercise_id]; if (!x || deload || day.completed_at) return '';
    const lastE = x.entries.at(-1)?.e, best = Math.max(x.prior || 0, ...x.entries.map(w => w.e));
    if (!lastE || !(best > lastE * 1.05)) return '';
    return `<span class="hist-note">${ic('pin')} ${Math.round((1 - lastE / best) * 100)}% below your all-time best estimate — for reference only; today's targets come from last week.</span>`; };
  const FLAG = { stalled: 'minus', regressing: 'trendDown', pr: 'trophy' };
  // One coach note per lift (v1.11): this week's plan, plus last weeks' trend if it needs attention. Tap → what to do.
  const coachLine = we => {
    if (day.completed_at || isCardio(we)) return we.flag && !day.completed_at ? `<div class="coach-flag">${esc(we.flag)}</div>` : '';
    const n = suggestionFor(we, 0)?.note, x = insights[we.exercise_id], st = x && FLAG[x.status.status] ? x.status : null;
    const plan = n && n !== 'Deload' ? `${ic(/faster|extra rep/i.test(n) ? 'trendUp' : /holding|smaller|same weight/i.test(n) ? 'pause' : 'arrowUpRight')} <span class="prog-note">This week: ${esc(n)}</span>` : '';
    const trend = !st ? '' : st.status === 'pr' ? `${ic('trophy', 'pr')} New best last time (+${st.pct.toFixed(1)}%)`
      : st.status === 'stalled' ? `${ic('minus')} Same as the last 2 weeks — tap for a tip` : `${ic('trendDown')} ${Math.abs(st.pct).toFixed(1)}% under 2 weeks ago — tap for a tip`;
    const flag = we.flag ? `<div class="coach-flag">${esc(we.flag)}</div>` : '';
    if (!plan && !trend) return flag;
    const inner = `${plan ? `<div>${plan}</div>` : ''}${trend ? `<div class="coach-trend">${trend}</div>` : ''}`;
    return (st ? `<button class="coach lift-flag st-${st.status}" data-flag="${we.id}">${inner}<span class="sr-only"> Show the tip for ${esc(we.exercises.name)}.</span></button>` : `<div class="coach">${inner}</div>`) + flag;
  };
  const feedback = {};
  check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', dayId)).forEach(f => feedback[f.muscle_group] = f);
  for (const o of pendingOps('muscle_feedback', o => o.values?.workout_day_id === dayId)) feedback[o.values.muscle_group] = { ...(feedback[o.values.muscle_group] || {}), ...o.values, _queued: true };
  const exFb = {}; let exFbOn = true;   // workout_exercise_id → this session's exercise rating (v1.10)
  { const liftIds = wes.filter(w => !isCardio(w)).map(w => w.id);
    const r = liftIds.length ? await sb.from('exercise_feedback').select('*').in('workout_exercise_id', liftIds) : { data: [] };
    if (r.error) exFbOn = false; else r.data.forEach(f => exFb[f.workout_exercise_id] = f);
    for (const o of pendingOps('exercise_feedback', o => liftIds.includes(o.values?.workout_exercise_id))) exFb[o.values.workout_exercise_id] = { ...(exFb[o.values.workout_exercise_id] || {}), ...o.values, _queued: true }; }
  if (!day.started_at && !day.completed_at && !preview) {
    await sb.from('workout_days').update({ started_at: new Date().toISOString() }).eq('id', dayId);
    if (meso.status === 'planned') await sb.from('mesocycles').update({ status: 'active' }).eq('id', meso.id);
  }

  const wLabel = ex => ex.load_type === 'bodyweight' ? `+${unit()}` : ex.load_type === 'assisted' ? `assist ${unit()}` : unit();
  const baseFor = (we, i) => { const p = prev[we.exercise_id]; return p?.sets.length ? (p.sets[i] || p.sets[p.sets.length - 1]) : null; };
  // Doc §4.1: if you pick a different weight, re-target reps to match (lo) or beat (hi) last time's effort.
  const repsFor = (we, i, weight) => deload ? null : L.repsAtLoad({ prev: baseFor(we, i), ex: we.exercises, weight,
    targetRir: we.target_rir, prevTargetRir: prev[we.exercise_id]?.rir, bodyweight: bwD() });
  const windowFor = we => deload ? null : L.weightRange({ prev: baseFor(we, 0), ex: we.exercises, targetRir: we.target_rir,
    prevTargetRir: prev[we.exercise_id]?.rir, bodyweight: bwD(), unit: unit() });
  Object.values(trail).forEach(t => t.sort((a, b) => a.week - b.week));
  const modeFor = we => L.progressionMode((trail[we.exercise_id] || []).map(x => ({ ...x, weight: W(x.weight) })), we.exercises, unit());
  const suggestionFor = (we, i) => {
    const p = prev[we.exercise_id]; if (!p?.sets.length) return null;
    const base = baseFor(we, i);
    return L.suggestSet({ prev: base, ex: we.exercises, targetRir: we.target_rir, prevTargetRir: p.rir, deload,
      unit: unit(), mode: modeFor(we),
      speed: L.liftSpeed(prevExFb[we.exercise_id], prevFb[we.exercises.muscle_group]),
      mesoStart: day.week > 1 && trail[we.exercise_id]?.[0] ? W(trail[we.exercise_id][0].weight) : null, firstWeek: day.week === 1 });
  };
  const lastOfMuscle = {}; wes.forEach(w => lastOfMuscle[isCardio(w) ? 'Cardio' : w.exercises.muscle_group] = w.id);
  const firstOfMuscle = {}; wes.filter(w => !isCardio(w)).forEach(w => { firstOfMuscle[w.exercises.muscle_group] ??= w.id; });
  const infoBtn = we => `<button class="ghost sm" data-info="${we.id}" aria-label="Warm-up and tips for ${esc(we.exercises.name)}" title="Warm-up & tips">${ic('info')}</button>`;
  // v1.11: only how today's muscles recovered; missed sets and lift trends live on the meso page / each lift's note.
  const todayWarn = day.completed_at ? [] : (await slipFor(meso)).filter(w => ['recovery', 'joints', 'workload'].includes(w.kind) && muscles.includes(w.muscle));
  const cardioCard = we => {
    const n = Math.max(we.sets.length, we.target_sets || 0, 1);
    return `<div class="card" data-we="${we.id}" data-muscle="Cardio">
      <div class="row"><div class="grow"><h3>${ic('heart')} ${esc(we.exercises.name)} <span class="trend" data-trend="${we.id}"></span></h3>
        <div class="muted small">Cardio · minutes + intensity (RPE 0 easy → 10 max)</div></div>
        ${infoBtn(we)}</div>
      <div class="sets"><div class="set-head"><div>#</div><div>min</div><div>RPE</div><div></div></div>
        ${Array.from({ length: n }, (_, i) => { const s = we.sets.find(x => x.set_index === i + 1) || {};
          return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}" data-sid="${esc(s.id || '')}"><div class="n">${i + 1}</div>
            <input type="number" inputmode="decimal" step="any" data-f="duration" value="${s.duration_min ?? ''}" placeholder="min">
            <input type="number" inputmode="numeric" min="0" max="10" data-f="rpe" value="${s.rpe ?? ''}" placeholder="0–10">
            <button class="check">✓</button></div>`; }).join('')}
      </div>
      <div class="row mt8"><button class="ghost sm" data-addset>+ bout</button><button class="ghost sm" data-rmset>− bout</button></div>
      ${lastOfMuscle.Cardio === we.id ? `<div data-rate="Cardio">${rateLine('Cardio', feedback.Cardio)}</div>` : ''}</div>`;
  };

  app.innerHTML = `
    ${preview ? `<div class="card info small preview-banner"><b>${ic('eye')} Preview</b> — not started, nothing can be logged here.
      <div class="grid2 mt8"><button class="primary sm" data-go="#/workout/${day.id}">Start this day</button><button class="sm" data-go="#/meso/${meso.id}">All days</button></div></div>` : ''}
    ${day.completed_at ? '<div class="card good small">Finished ✓ — you can still edit sets and ratings.</div>' : ''}
    ${day.completed_at ? '' : (() => { let seen = false; try { seen = localStorage.getItem('wl_warmup_seen') === '1'; } catch {}
      return seen ? `<div class="muted small warm-line">${ic('flame')} Warm up first — tap ${ic('info')} on each muscle’s first exercise for ramp-up sets. Warm-ups aren’t logged.</div>`
        : `<div class="card info small" id="warmNote"><b>${ic('flame')} Warm up before your first set</b>
          <ol class="tight"><li>5 min easy cardio + a few dynamic moves (leg swings, arm circles, bodyweight squats).</li>
          <li>On the <b>first exercise for each muscle</b>, tap <b>${ic('info')}</b> for 2–3 light ramp-up sets worked out from today’s weight.</li>
          <li>Warm-up sets are <b>not logged</b> and never count toward your sets or progress — only log working sets.</li></ol>
          <button class="ghost sm" id="warmOk">Got it</button></div>`; })()}
    ${deload ? '<div class="card info small"><b>Light (deload) week.</b> Same weights as last week, half the sets, stop about 4 reps short of failure.</div>' : ''}
    ${!deload && goal === 'athletic' ? '<div class="card info small"><b>Athleticism (experimental).</b> Move every rep of the main lifts as fast as you can with good form, and end the set when the speed drops — even if reps are left.</div>' : ''}
    ${!deload && goal === 'strength' ? '<div class="card info small"><b>Strength.</b> Heavy main lifts first while you’re fresh; rest 3–5 min between them. Never grind to failure.</div>' : ''}
    ${todayWarn.length ? `<details class="heads-up"><summary>${ic('alert')} ${esc(todayWarn[0].msg)}${todayWarn.length > 1 ? `&nbsp;·&nbsp;<span class="muted">+${todayWarn.length - 1} more</span>` : ''}</summary>${warnList(todayWarn)}</details>` : ''}
    ${wes.map(we => {
      if (isCardio(we)) return cardioCard(we);
      const ex = we.exercises; const n = Math.max(we.sets.length, we.target_sets || 0, 1);
      const p = prev[we.exercise_id];
      return `<div class="card" data-we="${we.id}" data-muscle="${esc(ex.muscle_group)}">
        <div class="row"><div class="grow"><h3>${esc(ex.name)} <span class="trend" data-trend="${we.id}"></span></h3>
          <div class="meta">${esc(ex.muscle_group)} · ${we.target_sets} × ${ex.rep_min}–${ex.rep_max} reps · ${deload ? 'light week' : effortShort(we.target_rir)}</div></div>
          ${infoBtn(we)}${!day.completed_at && !preview ? `<button class="ghost sm" data-replace="${we.id}" aria-label="Replace ${esc(ex.name)}" title="Replace exercise">${ic('swap')}</button>` : ''}</div>
        <button type="button" class="fold-line" data-unfold="${we.id}" aria-expanded="false"></button>
        ${coachLine(we)}
        <div class="sets"><div class="set-head"><div>#</div><div>${wLabel(ex)}</div><div>reps</div><div></div></div>
          ${Array.from({ length: n }, (_, i) => {
            const s = we.sets.find(x => x.set_index === i + 1) || {}; const sg = suggestionFor(we, i);
            const wVal = s.weight ?? sg?.weight ?? (ex.load_type !== 'weighted' && s.reps == null ? '' : '');
            return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}" data-sid="${esc(s.id || '')}" data-at="${s.completed_at || ''}">
              <div class="n">${i + 1}</div>
              <div class="fld"><input type="number" inputmode="decimal" step="any" data-f="weight" aria-label="Set ${i + 1} weight (${wLabel(ex)})" value="${wVal ?? ''}" class="${s.weight == null && sg?.weight != null ? 'sug' : ''}" placeholder="${ex.load_type === 'weighted' ? 'weight' : '0'}"><span class="dir" data-dir="weight"></span></div>
              <div class="fld"><input type="number" inputmode="numeric" data-f="reps" aria-label="Set ${i + 1} reps" value="${s.reps ?? ''}" placeholder="${sg?.reps != null ? (sg.note?.includes('same reps') ? `${sg.reps}–${sg.reps + 1}` : sg.reps) : ex.rep_min + '–' + ex.rep_max}" data-sug="${sg?.reps ?? ''}"><span class="dir" data-dir="reps"></span></div>
              <button class="check" aria-label="Set ${i + 1} done">✓</button></div>`;
          }).join('')}
        </div>
        <div class="row mt8"><button class="ghost sm" data-addset>+ set</button><button class="ghost sm" data-rmset>− set</button>
          ${!deload && ex.load_type !== 'cardio' ? (r1 => `<label class="rir1 tiny" title="Optional: how many reps you really had left on set 1. Left on “as planned”, the app assumes you stopped ${we.target_rir} short.">Set 1 reps left <select data-rir1 aria-label="Reps you had left on set 1">
            <option value="">as planned (${we.target_rir})</option>${[0, 1, 2, 3, 4, 5].map(v => `<option value="${v}" ${r1 != null && r1 !== we.target_rir && r1 === v ? 'selected' : ''}>${v}${v === 5 ? '+' : ''}</option>`).join('')}</select></label>`)(we.sets.find(x => x.set_index === 1)?.rir) : ''}
          </div>
        <div class="muted tiny last-wk">${p?.sets.length ? (p.carried ? `last meso wk ${p.wk}: ` : 'last wk: ') + p.sets.map(s => `${fmt(s.weight)}×${s.reps ?? '–'}`).join(', ')
            : staleCarry[we.exercise_id] ? `${esc(staleCarry[we.exercise_id].mname)} wk ${staleCarry[we.exercise_id].wk} (${staleCarry[we.exercise_id].sets.map(s => `${fmt(s.weight)}×${s.reps ?? '–'}`).join(', ')}) — not in your last meso, so not used. Pick a fresh weight.`
            : `First time — pick a weight for ${ex.rep_min}–${ex.rep_max} reps${deload ? '' : `, ${effortText(we.target_rir)}`}`}</div>
        ${exFbOn ? `<div data-exrate="${we.id}">${exRateLine(we, exFb[we.id])}</div>` : ''}
        ${lastOfMuscle[ex.muscle_group] === we.id ? `<div data-rate="${esc(ex.muscle_group)}">${rateLine(ex.muscle_group, feedback[ex.muscle_group])}</div>` : ''}
      </div>`;
    }).join('')}
    ${!day.completed_at && !preview ? `<button class="block add-ex" id="addEx">${ic('plus')} Add an exercise</button>` : ''}
    <button class="primary block" id="finish">${day.completed_at ? 'Done' : 'Finish workout'}</button>
    ${!day.completed_at ? '<div class="spacer"></div><button class="ghost block" id="skipDay">Skip this workout</button>' : ''}`;

  // Rated lines only (v1.11): the rating sheets open on their own when the sets are done, so unrated = nothing to show.
  function rateLine(m, f) {
    if (!f || needKeys(m).some(k => f[k] == null)) return '';
    const first = m === 'Cardio' ? `breathing ${RATINGS.breathing.opts[f.breathing].toLowerCase()}, ` : f.pump != null ? `pump ${RATINGS.pump.opts[f.pump].toLowerCase()}, ` : '';
    return `<button class="rated-line" data-open="${esc(m)}"><span>${ic('check')} ${esc(m)} overall · ${first}${RATINGS.workload.opts[f.workload].toLowerCase()}, joints ${RATINGS.joint_pain.opts[f.joint_pain].toLowerCase()}</span><span class="edit">${ic('pencil')}</span></button>`;
  }
  function exRated(we) { return !exFbOn || isCardio(we) || (exFb[we.id]?.workload != null && exFb[we.id]?.joint_pain != null); }
  function exRateLine(we, f) {
    if (isCardio(we) || f?.workload == null || f?.joint_pain == null) return '';
    return `<button class="rated-line" data-exopen="${we.id}"><span>${ic('check')} This exercise · ${RATINGS.workload.opts[f.workload].toLowerCase()}, joints ${RATINGS.joint_pain.opts[f.joint_pain].toLowerCase()}</span><span class="edit">${ic('pencil')}</span></button>`;
  }
  const wireRate = () => {
    $$('[data-open]').forEach(b => b.onclick = () => openRating(b.dataset.open, !isRated(b.dataset.open) && muscleComplete(b.dataset.open)));
    $$('[data-exopen]').forEach(b => b.onclick = () => { const we = wes.find(w => w.id === b.dataset.exopen);
      if (!exRated(we) && !exComplete(we)) return toast('Finish this exercise’s sets first — the rating opens automatically');
      openExRating(we, !exRated(we)); });
  };
  wireRate();

  // v1.20.7 (owner report: a rating pop-up got stuck): a muscle with no sets on screen is never "complete" — before,
  // an empty list counted as all done, so a save landing after you left the workout asked you to rate every muscle.
  const muscleComplete = m => { const rows = $$(`[data-muscle="${CSS.escape(m)}"] .set`); return rows.length > 0 && rows.every(r => r.classList.contains('done')); };
  // ...and rating pop-ups only open while THIS workout is the screen you're on.
  // v1.20.11 hotfix: the Workout tab opens the workout in progress at "#/workout" (no id) — that counts too. 1.20.7 only
  // accepted "#/workout/<id>", so opened from the tab, rating pop-ups never appeared (owner report 2026-11-25).
  const onThisWorkout = () => { const [, page, id] = location.hash.split('/');
    return page === 'workout' && (!id || id === String(dayId)) && wes.some(w => app.querySelector(`[data-we="${w.id}"]`)); };
  // Progression indicator per exercise: best estimated strength today vs last time (doc §1.7).
  function exerciseTrend(we) {
    const card = app.querySelector(`[data-we="${we.id}"]`); if (!card) return null;
    if (isCardio(we)) { // cardio progression = session load (minutes × RPE) vs last time
      const cur = [...card.querySelectorAll('.set.done')].reduce((a, r) => a + L.cardioLoad({ minutes: r.querySelector('[data-f="duration"]').value, rpe: r.querySelector('[data-f="rpe"]').value }), 0);
      const p = prev[we.exercise_id]; const old = p ? p.sets.reduce((a, x) => a + L.cardioLoad({ minutes: x.duration_min, rpe: x.rpe }), 0) : 0;
      if (!cur || !old) return null;
      return { t: L.performanceTrend(cur, old), pct: (cur - old) / old * 100, vs: p.carried ? 'last meso' : 'last week' };
    }
    const cur = [...card.querySelectorAll('.set.done')].map(r => ({ weight: Number(r.querySelector('[data-f="weight"]').value) || 0,
      reps: Number(r.querySelector('[data-f="reps"]').value), rir: we.target_rir })).filter(x => x.reps);
    const p = prev[we.exercise_id]; if (!cur.length || !p?.sets.length) return null;
    const a = L.bestE1rm(cur, we.exercises, bwD()), b = L.bestE1rm(p.sets.map(x => ({ ...x, rir: x.rir ?? p.rir })), we.exercises, bwD());
    if (a == null || b == null) return null;
    // v1.20.4: a flat estimate usually means you did exactly the plan (one more rep, one rep closer to failure) — say so.
    const ch = L.rawChange(cur, p.sets);
    return { t: L.performanceTrend(a, b), pct: (a - b) / b * 100, vs: p.carried ? 'last meso' : 'last week', change: L.changeLabel(ch, unit()) };
  }
  // ▲ beat the plan · ▼ fell short · ● on plan (estimate within ±1%): shows what changed instead of "0.0%".
  const trendText = tr => tr.t === 0 && tr.change != null ? (tr.change ? `On plan · ${tr.change}` : 'Same as last time')
    : `${tr.pct > 0 ? '+' : ''}${tr.pct.toFixed(1)}%`;
  const trendHtml = tr => !tr ? '' : `<span class="pill ${tr.t > 0 ? 'on' : tr.t < 0 ? 'bad' : tr.change ? 'plan' : ''}" title="vs ${tr.vs}${tr.t === 0 && tr.change != null ? ` · strength estimate ${tr.pct > 0 ? '+' : ''}${tr.pct.toFixed(1)}%` : ''}">${tr.t > 0 ? '▲' : tr.t < 0 ? '▼' : '●'} ${trendText(tr)}</span>`;
  const exComplete = we => { const c = app.querySelector(`[data-we="${we.id}"]`); return !!c && [...c.querySelectorAll('.set')].every(r => r.classList.contains('done')); };
  function refreshTrend(we) { const el = app.querySelector(`[data-trend="${we.id}"]`); if (el) el.innerHTML = exComplete(we) ? trendHtml(exerciseTrend(we)) : ''; }
  const isRated = m => !!feedback[m] && needKeys(m).every(k => feedback[m][k] != null);
  const exsOf = m => wes.filter(w => !isCardio(w) && w.exercises.muscle_group === m);

  // Per-exercise rating (v1.10): workload + joint pain for THIS exercise, asked after its last set.
  // One sheet per finished exercise (v1.11). When it was the last exercise for its muscle, the muscle-as-a-whole
  // questions are on the same sheet, so a muscle with one exercise is one pop-up, not two.
  // "All normal" = Pretty good + no joint pain, saved in one tap. Pump stays whatever you picked (or not rated).
  function openExRating(we, required = true, withMuscle = null) {
    const m = we.exercises.muscle_group;
    if (withMuscle == null) withMuscle = required && muscleComplete(m) && !isRated(m) && exsOf(m).every(w => w.id === we.id || exRated(w));
    const f = { ...(exFb[we.id] || {}) }, g = { ...(feedback[m] || {}) }, touched = {};
    const solo = exsOf(m).length === 1;                 // one exercise: the muscle answers follow the exercise's
    const tr = exComplete(we) ? exerciseTrend(we) : null;
    const others = exsOf(m).filter(w => w.id !== we.id);
    openSheet(`<h3>${esc(we.exercises.name)}</h3>
      ${tr ? `<div class="mover rate-trend"><span>vs ${tr.vs}</span>${trendHtml(tr)}</div>` : ''}
      <button type="button" class="allnormal" id="allNormal">✓ All normal <span>pretty good, no joint pain</span></button>
      <div class="rate-h">This exercise</div>
      ${['workload', 'joint_pain'].map(k => `<div class="fb-row"><label>${RATINGS[k].label}</label>${segHtml(k, f[k], 'data-s="e"')}</div>`).join('')}
      ${withMuscle ? `<div class="rate-h">${esc(m)} overall today</div>
        <div class="muted small">All of today's ${esc(m)} work together — sets next week come from this.${others.length ? ` Also today: ${others.map(w => esc(w.exercises.name)).join(', ')}.` : ''}</div>
        ${rateKeys(m).map(k => `<div class="fb-row" data-row="${k}"><label>${RATINGS[k].label}${OPTIONAL[k] ? ' <span class="muted tiny">(optional)</span>' : ''}</label>${segHtml(k, g[k], 'data-s="m"')}</div>`).join('')}` : ''}
      <div class="spacer"></div><button class="primary block" id="saveExRate">Save</button>
      ${required ? '<button class="ghost block" id="later">Not now</button>' : '<button class="ghost block" id="later">Cancel</button>'}`, panel => {
      const pick = (sec, k, v) => {
        (sec === 'e' ? f : g)[k] = v;
        panel.querySelectorAll(`[data-s="${sec}"][data-k="${k}"]`).forEach(x => x.classList.toggle('on', +x.dataset.v === v));
      };
      panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const sec = b.dataset.s, k = b.dataset.k, v = +b.dataset.v; pick(sec, k, v);
        if (sec === 'm') touched[k] = true;
        else if (withMuscle && solo && !touched[k] && (k === 'workload' || k === 'joint_pain')) pick('m', k, v);
      });
      const save = async () => {
        if (f.workload == null || f.joint_pain == null) return toast('Pick workload and joint pain for this exercise', true);
        if (withMuscle && needKeys(m).some(k => g[k] == null)) {
          const miss = needKeys(m).find(k => g[k] == null), row = panel.querySelector(`[data-row="${miss}"]`);
          if (row) { row.classList.add('need'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
          return toast(`Pick ${RATINGS[miss].label.toLowerCase()} for ${m} to finish`, true);
        }
        const exVals = { workout_exercise_id: we.id, workload: f.workload, joint_pain: f.joint_pain, updated_at: new Date().toISOString() };
        const r1 = await durableWrite({ kind: 'upsert', table: 'exercise_feedback', values: exVals, onConflict: 'workout_exercise_id' });
        if (r1 === 'failed') return;
        const row = { ...(exFb[we.id] || {}), ...exVals, _queued: r1 === 'queued' };
        exFb[we.id] = row;
        if (withMuscle) {
          const payload = { workout_day_id: dayId, muscle_group: m }; rateKeys(m).forEach(k => payload[k] = g[k]);
          const r2 = await durableWrite({ kind: 'upsert', table: 'muscle_feedback', values: payload, onConflict: 'workout_day_id,muscle_group' });
          if (r2 === 'failed') return;
          feedback[m] = { ...(feedback[m] || {}), ...payload, _queued: r2 === 'queued' };
          if ((r1 === 'queued' || r2 === 'queued') && !storageAtRisk) toast('No signal — rating saved on your phone, it will sync automatically');
          const ms = app.querySelector(`[data-rate="${CSS.escape(m)}"]`); if (ms) ms.innerHTML = rateLine(m, feedback[m]);
        }
        closeSheet();
        const slot = app.querySelector(`[data-exrate="${we.id}"]`); if (slot) slot.innerHTML = exRateLine(we, row);
        wireRate(); enforceRatings();
      };
      panel.querySelector('#allNormal').onclick = () => {
        pick('e', 'workload', 1); pick('e', 'joint_pain', 0);
        if (withMuscle) { pick('m', 'workload', 1); pick('m', 'joint_pain', 0); }
        save();
      };
      const later = panel.querySelector('#later'); if (later) later.onclick = () => { if (required) { notNow.add('ex:' + we.id); if (withMuscle) notNow.add('m:' + m); } closeSheet(); };
      panel.querySelector('#saveExRate').onclick = save;
    }, required);
  }

  // required = locked: can't dismiss or move on until all three are answered. Editing later via ✎ is not locked.
  function openRating(m, required = true) {
    const f = { ...(feedback[m] || {}) };
    if (!feedback[m] && m !== 'Cardio' && exsOf(m).length === 1 && exFb[exsOf(m)[0].id]) {   // one exercise: start from its rating
      const e1 = exFb[exsOf(m)[0].id]; f.workload ??= e1.workload; f.joint_pain ??= e1.joint_pain; }
    const exs = m === 'Cardio' ? wes.filter(isCardio) : wes.filter(w => !isCardio(w) && w.exercises.muscle_group === m);
    openSheet(`<h3>${esc(m)} overall today</h3>
      <div class="muted small">${required ? 'All of today’s ' + esc(m) + ' work together — sets next week come from this.' : 'Adjust your ratings.'}</div>
      <button type="button" class="allnormal" id="allNormal">✓ All normal <span>pretty good, no joint pain</span></button>
      <div class="card box-tight"><div class="muted tiny">Progression</div>
        ${exs.map(w => { const tr = exComplete(w) ? exerciseTrend(w) : null;
          const ef = exFb[w.id], er = ef?.workload != null ? ` <span class="muted tiny">· ${RATINGS.workload.opts[ef.workload].toLowerCase()}, joints ${RATINGS.joint_pain.opts[ef.joint_pain].toLowerCase()}</span>` : '';
          return `<div class="mover"><span>${esc(w.exercises.name)}${er}</span>${tr ? trendHtml(tr) : `<span class="muted tiny">${exComplete(w) ? 'no history yet' : 'not finished'}</span>`}</div>`; }).join('')}</div>
      ${rateKeys(m).map(k => `<div class="fb-row" data-row="${k}"><label>${RATINGS[k].label}${OPTIONAL[k] ? ' <span class="muted tiny">(optional)</span>' : ''}</label>${segHtml(k, f[k])}</div>`).join('')}
      <div class="spacer"></div><button class="primary block" id="saveRate">Save</button>
      ${required ? '<button class="ghost block" id="later">Not now</button>' : '<button class="ghost block" id="later">Cancel</button>'}`, panel => {
      panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        f[b.dataset.k] = +b.dataset.v;
        panel.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b));
      });
      const later = panel.querySelector('#later'); if (later) later.onclick = () => { if (required) notNow.add('m:' + m); closeSheet(); };
      panel.querySelector('#allNormal').onclick = () => {
        [['workload', 1], ['joint_pain', 0]].forEach(([k, v]) => { f[k] = v; panel.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.classList.toggle('on', +x.dataset.v === v)); });
        panel.querySelector('#saveRate').click();
      };
      panel.querySelector('#saveRate').onclick = async () => {
        const miss = needKeys(m).find(k => f[k] == null);
        if (miss) { const r = panel.querySelector(`[data-row="${miss}"]`); if (r) { r.classList.add('need'); r.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
          return toast(`Pick ${RATINGS[miss].label.toLowerCase()} to finish`, true); }
        const payload = { workout_day_id: dayId, muscle_group: m }; rateKeys(m).forEach(k => payload[k] = f[k]);
        const res = await durableWrite({ kind: 'upsert', table: 'muscle_feedback', values: payload, onConflict: 'workout_day_id,muscle_group' });
        if (res === 'failed') return;
        const row = feedback[m] = { ...(feedback[m] || {}), ...payload, _queued: res === 'queued' }; closeSheet();
        if (res === 'queued' && !storageAtRisk) toast('No signal — rating saved on your phone, it will sync automatically');
        const slot = app.querySelector(`[data-rate="${CSS.escape(m)}"]`); if (slot) slot.innerHTML = rateLine(m, row);
        wireRate();
        enforceRatings();
      };
    }, required);
  }
  // Any muscle whose sets are all done but isn't rated gets the locked prompt.
  // "Not now" on a rating pop-up: don't ask again after every set — Finish still asks for anything left unrated.
  const notNow = new Set();
  function enforceRatings() {
    if (!sheet.hidden || !onThisWorkout()) return;
    const we = wes.find(w => exComplete(w) && !exRated(w) && !notNow.has('ex:' + w.id));
    if (we) return openExRating(we, true);
    const m = groups.find(x => muscleComplete(x) && !isRated(x) && !notNow.has('m:' + x));
    if (m) openRating(m, true);
  }

  // Small ▲ / = / ▼ next to weight and reps: this set vs the same set last time (last week, or last meso in week 1).
  // Uses what's typed, or the suggestion if nothing is typed yet. Green = progress, amber = backed off
  // (assisted lifts: less assistance is progress).
  function updateDirs(we, row) {
    const p = prev[we.exercise_id], ex = we.exercises;
    const old = p?.sets.length ? (p.sets[+row.dataset.idx - 1] || p.sets[p.sets.length - 1]) : null;
    const vs = p?.carried ? 'last meso' : 'last week';
    [['weight', ex.load_type === 'assisted'], ['reps', false]].forEach(([f, invert]) => {
      const el = row.querySelector(`[data-dir="${f}"]`), inp = row.querySelector(`[data-f="${f}"]`); if (!el) return;
      const raw = inp.value !== '' ? inp.value : f === 'reps' ? inp.dataset.sug : '';
      const was = old ? (f === 'weight' ? (old.weight ?? (ex.load_type === 'weighted' ? null : 0)) : old.reps) : null;
      if (raw === '' || raw == null || was == null) { el.className = 'dir'; el.textContent = ''; el.removeAttribute('title'); return; }
      const d = Number(raw) - Number(was);
      const dir = Math.abs(d) < 1e-9 ? 'level' : d > 0 ? 'up' : 'down';
      const good = dir === 'level' ? 'level' : (dir === 'up') !== invert ? 'good' : 'back';
      let cls = good, note = '';
      // Fewer reps at a heavier weight isn't a step back if overall performance (load × reps) held or improved.
      if (f === 'reps' && dir === 'down' && ex.load_type === 'weighted' && old?.weight != null) {
        const wNow = Number(row.querySelector('[data-f="weight"]').value || old.weight);
        if (wNow > Number(old.weight)) {
          const perf = (w, r) => w * (1 + r / 30), now = perf(wNow, Number(raw)), then = perf(Number(old.weight), Number(old.reps));
          if (now >= then * 0.99) { cls = 'level'; note = ` — heavier weight, so overall performance is ${now >= then * 1.005 ? 'up' : 'the same'}`; }
        }
      }
      el.className = `dir ${cls}`; el.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '=';
      el.title = `${f === 'weight' ? 'Weight' : 'Reps'} ${dir === 'level' ? 'same as' : dir + ' vs'} ${vs} (${fmt(was)} → ${fmt(raw)})${note}`;
      el.setAttribute('aria-label', el.title);
    });
  }

  function wireSet(we, row) {
    if (isCardio(we)) return wireCardio(we, row);
    updateDirs(we, row);
    const payloadFor = done => {
      const wIn = row.querySelector('[data-f="weight"]'), rIn = row.querySelector('[data-f="reps"]');
      const weight = wIn.value === '' ? null : Number(wIn.value), reps = rIn.value === '' ? null : Number(rIn.value);
      return { workout_exercise_id: we.id, set_index: +row.dataset.idx, weight: weight == null ? (we.exercises.load_type === 'weighted' ? null : 0) : toLb(weight),
        // Actual RIR is recorded only when you give it (set 1, optional). Otherwise null = "assumed on target",
        // and every calculation falls back to the prescribed RIR (review #2: don't present the target as measured).
        reps, rir: +row.dataset.idx === 1 && row.closest('[data-we]')?.querySelector('[data-rir1]')?.value !== '' && row.closest('[data-we]')?.querySelector('[data-rir1]') ? Number(row.closest('[data-we]').querySelector('[data-rir1]').value) : null,
        completed_at: done ? (row.dataset.at || new Date().toISOString()) : null, based_on: row.dataset.sid || null };   // v1.20.12: the server row this edit came from
    };
    const sigOf = p => JSON.stringify({ ...p, based_on: undefined });   // v1.20.12: learning the row id isn't a change
    if (row.classList.contains('done')) row.dataset.saved = sigOf(payloadFor(true)); // what the server already has
    const save = async markDone => {
      const wIn = row.querySelector('[data-f="weight"]'), rIn = row.querySelector('[data-f="reps"]');
      if (markDone && rIn.value === '' && rIn.dataset.sug) rIn.value = rIn.dataset.sug;
      const weight = wIn.value === '' ? null : Number(wIn.value), reps = rIn.value === '' ? null : Number(rIn.value);
      const done = markDone ? !row.classList.contains('done') : row.classList.contains('done');
      if (markDone && done && reps == null) return toast('Enter reps first', true);
      if (markDone && done && weight == null && we.exercises.load_type === 'weighted') return toast('Enter the weight first', true);
      if (!markDone && weight == null && reps == null) return;
      const payload = payloadFor(done);
      const sig = sigOf(payload);
      if (!markDone && sig === row.dataset.saved) return;          // nothing changed → no request
      if (row.dataset.busy) { row.dataset.again = '1'; return; }    // a save is in flight; send the latest once it lands
      row.dataset.busy = '1'; row.dataset.key = setKey(payload); row.classList.remove('failed', 'queued'); row.classList.add('saving');
      const res = await saveSet(payload);
      delete row.dataset.busy; row.classList.remove('saving');
      if (res === 'failed') { row.classList.add('failed'); return; }
      if (res === 'queued') { row.classList.add('queued'); if (markDone && done && !storageAtRisk) toast('No signal — saved on your phone, will sync automatically'); }
      row.dataset.saved = sig;
      if (row.dataset.again) { delete row.dataset.again; save(false); }
      row.dataset.at = payload.completed_at || ''; wIn.classList.remove('sug');
      row.classList.toggle('done', done);
      if (markDone && done) haptic();
      updateDirs(we, row);
      const m = we.exercises.muscle_group;
      refreshTrend(we);
      // Notice every time a finished set is under last week (orange ▼) — not just the first time.
      const behind = markDone && done ? [...row.querySelectorAll('.dir.back')].map(el => el.title).filter(Boolean) : [];
      const setNote = behind.length ? `Set ${row.dataset.idx}: ${behind.join(' · ')}.` : '';
      if (markDone && done && exComplete(we)) { const tr = exerciseTrend(we);
        const exNote = tr ? `${we.exercises.name}: ${tr.t > 0 ? '▲ up' : tr.t < 0 ? '▼ down' : '●'} ${trendText(tr)} vs ${tr.vs}` : '';
        if ((setNote || exNote) && !muscleComplete(m)) toast([setNote, exNote].filter(Boolean).join(' '), false, setNote ? 4000 : 1800);
        else if (setNote) toast(setNote, false, 4000); }
      else if (setNote) toast(`${setNote} One set under last week is fine — rest a little longer and aim to match it next set.`, false, 4000);
      if (markDone && done) enforceRatings();
    };
    row.querySelector('.check').onclick = () => save(true);
    row.querySelectorAll('.dir').forEach(el => el.onclick = e => { if (!el.title) return; e.preventDefault(); e.stopPropagation(); toast(el.title, false, 3000); });
    row.querySelectorAll('input').forEach(i => { i.oninput = () => { i.classList.remove('sug'); if (i.dataset.f === 'weight') retarget(we, row); updateDirs(we, row); }; i.onchange = () => save(false); });
    row.querySelector('[data-f="weight"]').addEventListener('change', () => {
      const wIn = row.querySelector('[data-f="weight"]'), r = repsFor(we, +row.dataset.idx - 1, wIn.value);
      const last = baseFor(we, +row.dataset.idx - 1), lastW = last?.weight != null ? Number(last.weight) : null;   // already in display units
      const odd = L.weightSanity(lastW, wIn.value);
      wIn.classList.toggle('odd', !!odd);
      const jump = !odd && lastW > 0 && we.exercises.load_type === 'weighted' ? (+wIn.value - lastW) / lastW : 0;
      if (odd) toast(`${fmtNum(+wIn.value)} ${unit()} is ${odd.kind === 'high' ? 'way more' : 'way less'} than last time (${fmtNum(lastW)} ${unit()}) — typo? It still saves if it's right.`, true);
      else if (jump > 0 && +wIn.value > L.safeMax(lastW, we.exercises, unit()) + 1e-9)
        toast(`Manual bump: +${fmtNum(+wIn.value - lastW)} ${unit()} over last week (${fmtNum(lastW)} → ${fmtNum(+wIn.value)} ${unit()}). Auto increases stop at ${fmtNum(L.safeMax(lastW, we.exercises, unit()))} — bigger jumps cost reps and raise injury risk. It still saves if you go for it.`, true);
      else if (r?.outside) toast(r.outside === 'heavy' ? `Heavy for this lift — matching last time needs only ~${r.lo} reps (range ${we.exercises.rep_min}–${we.exercises.rep_max})`
        : `Light for this lift — you'd need ~${r.lo} reps to match last time (range ${we.exercises.rep_min}–${we.exercises.rep_max})`, true);
      // carry the new weight to later sets that are still on the suggested weight
      let n = row.nextElementSibling;
      for (; n; n = n.nextElementSibling) { const nw = n.querySelector('[data-f="weight"]');
        if (!n.classList.contains('done') && nw?.classList.contains('sug')) { nw.value = wIn.value; retarget(we, n); updateDirs(we, n); } }
    });
  }
  // New weight → new reps target ("lo–hi") in the reps box placeholder; the ✓ button fills in lo if left empty.
  function retarget(we, row) {
    const wIn = row.querySelector('[data-f="weight"]'), rIn = row.querySelector('[data-f="reps"]');
    if (row.classList.contains('done') || wIn.value === '') return;
    const r = repsFor(we, +row.dataset.idx - 1, wIn.value); if (!r) return;
    rIn.placeholder = `${r.lo}–${r.hi}`; rIn.dataset.sug = r.lo;
  }
  function wireCardio(we, row) {
    const save = async markDone => {
      const dIn = row.querySelector('[data-f="duration"]'), rIn = row.querySelector('[data-f="rpe"]');
      const duration = dIn.value === '' ? null : Number(dIn.value), rpe = rIn.value === '' ? null : Math.max(0, Math.min(10, Math.round(Number(rIn.value))));
      const done = markDone ? !row.classList.contains('done') : row.classList.contains('done');
      if (markDone && done && (!duration || rpe == null)) return toast('Enter minutes and RPE', true);
      if (!markDone && duration == null && rpe == null) return;
      // A tap while a save is in flight is remembered and sent once the first save lands (same as lifting sets).
      if (row.dataset.busy) { row.dataset.again = markDone ? 'done' : '1'; return; }
      row.dataset.busy = '1'; row.classList.remove('failed', 'queued'); row.classList.add('saving');
      const payload = { workout_exercise_id: we.id, set_index: +row.dataset.idx, duration_min: duration, rpe,
        weight: null, reps: null, completed_at: done ? (row.dataset.at || new Date().toISOString()) : null, based_on: row.dataset.sid || null };
      row.dataset.key = setKey(payload);
      const res = await saveSet(payload);
      delete row.dataset.busy; row.classList.remove('saving');
      if (res === 'failed') { row.classList.add('failed'); return; }
      if (res === 'queued') row.classList.add('queued');
      row.dataset.at = payload.completed_at || '';
      row.classList.toggle('done', done);
      if (row.dataset.again) { const again = row.dataset.again; delete row.dataset.again; return save(again === 'done'); }
      refreshTrend(we);
      if (markDone && done) enforceRatings();
    };
    row.querySelector('.check').onclick = () => save(true);
    row.querySelectorAll('input').forEach(i => i.onchange = () => save(false));
  }
  $$('[data-we]').forEach(card => {
    const we = wes.find(w => w.id === card.dataset.we);
    card.querySelectorAll('.set').forEach(r => wireSet(we, r));
    const r1 = card.querySelector('[data-rir1]');
    if (r1) r1.onchange = () => { const row1 = card.querySelector('.set[data-idx="1"]'); if (row1?.classList.contains('done')) row1.querySelector('[data-f="reps"]').dispatchEvent(new Event('change'));
      toast(r1.value === '' ? 'Set 1 will use the target RIR' : `Logged: ${r1.value} reps left on set 1 — next week's targets use it`); };
    card.querySelector('[data-addset]').onclick = () => {
      const setsEl = card.querySelector('.sets'); const last = setsEl.querySelector('.set:last-child');
      const row = last.cloneNode(true); const idx = +last.dataset.idx + 1;
      row.dataset.idx = idx; row.dataset.at = ''; delete row.dataset.saved; delete row.dataset.busy; row.dataset.key = we.id + ':' + idx;
      row.classList.remove('done', 'queued', 'failed', 'saving'); row.querySelector('.n').textContent = idx;
      row.querySelectorAll('input').forEach(i => { if (i.dataset.f !== 'weight') i.value = ''; i.classList.remove('sug'); });
      setsEl.appendChild(row); wireSet(we, row);
    };
    card.querySelector('[data-rmset]').onclick = async () => {
      const rows = card.querySelectorAll('.set'); if (rows.length <= 1) return;
      const last = rows[rows.length - 1], key = we.id + ':' + last.dataset.idx;
      // v1.20.9 (audit finding 2): deleteSet waits for any save of this set already on its way (including a sync after
      // reconnecting), then removes the phone copy and deletes on the server; it can't be brought back by a stale copy.
      last.dataset.busy = '1';
      const error = await deleteSet(we.id, +last.dataset.idx);
      delete last.dataset.busy;
      if (error) return toast(isNetErr(error) ? 'No signal — can’t remove a set offline. Try again when you’re connected.' : `Couldn’t remove that set: ${error.message}`, true);
      last.remove();
    };
  });

  $('#warmOk') && ($('#warmOk').onclick = () => { try { localStorage.setItem('wl_warmup_seen', '1'); } catch {} $('#warmNote').outerHTML = `<div class="muted small warm-line">${ic('flame')} Warm up first — tap ${ic('info')} on each muscle’s first exercise for ramp-up sets. Warm-ups aren’t logged.</div>`; });
  const trendSheet = we => { const x = insights[we.exercise_id]; if (!x) return;
    openSheet(`<h3>${esc(we.exercises.name)}</h3><div class="row my6">${statusPill(x.status)}<span class="muted small">by meso week · reps × load</span></div>
      <p>${esc(x.status.rec)}</p>${x.status.vs ? `<p class="small">${esc(x.status.vs.text)}</p>` : ''}
      <div class="muted small">Last time: ${(t => t ? `${fmt(W(t.weight))} ${unit()} × ${t.reps}` : '—')(x.sessions[x.sessions.length - 1]?.top)}</div>
      <div class="spacer"></div><button class="block" id="toChart">See the chart ›</button><div class="spacer"></div><button class="primary block" id="closeFlag">Got it</button>`,
      panel => { panel.querySelector('#closeFlag').onclick = closeSheet; panel.querySelector('#toChart').onclick = () => { closeSheet(); go('#/progress/' + we.exercise_id); }; }); };
  $$('[data-flag]').forEach(b => b.onclick = () => trendSheet(wes.find(w => w.id === b.dataset.flag)));
  $$('[data-info]').forEach(b => b.onclick = () => {
    const we = wes.find(w => w.id === b.dataset.info), ex = we.exercises;
    const first = isCardio(we) || firstOfMuscle[ex.muscle_group] === we.id;
    const card = app.querySelector(`[data-we="${we.id}"]`);
    const ww = Number(card?.querySelector('.set [data-f="weight"]')?.value) || null; // today's working weight (shown unit)
    const plan = L.warmupPlan({ ex, workWeight: ww, firstForMuscle: first, unit: unit() });
    const rows = plan.map((x, i) => `<tr><td>${i + 1}</td><td>${x.weight != null ? `${fmt(x.weight)} ${unit()}` : '—'}</td><td>${x.reps ?? '—'}</td><td class="muted">${esc(x.note || '')}</td></tr>`).join('');
    openSheet(`<h3>${esc(ex.name)}</h3>
      <div class="muted small">${isCardio(we) ? 'Cardio' : `${esc(ex.muscle_group)} · ${we.target_sets} sets of ${ex.rep_min}–${ex.rep_max} reps · ${deload ? 'light week' : `${effortText(we.target_rir)} (${we.target_rir} RIR = reps in reserve)`}`}</div>
      ${!isCardio(we) ? (() => { const w = windowFor(we), m = !deload && prev[we.exercise_id]?.sets.length && ex.load_type === 'weighted' ? modeFor(we) : null, h = histNote(we);
        return (m || w || h) ? `<h2>This lift</h2><ul class="tight small">
          ${m ? `<li>Progresses ${m.mode === 'load' ? `by weight — about +${fmt(m.step)} ${unit()} when you're ready` : 'by reps at the same weight'}.</li>` : ''}
          ${w && w.light < w.heavy ? `<li>Weight window ${fmt(w.light)}–${fmt(w.heavy)} ${unit()}: change the weight and the suggested reps adjust to match last week.</li>` : ''}
          ${h ? `<li>${h}</li>` : ''}</ul>` : ''; })() : ''}
      <h2>Warm-up${first ? '' : ' (optional)'}</h2>
      ${plan[0].weight == null && plan.length === 1 ? `<p>${esc(plan[0].note)}</p>` : `<table class="warm"><thead><tr><th>#</th><th>Weight</th><th>Reps</th><th></th></tr></thead><tbody>${rows}</tbody></table>`}
      <p class="muted small">${ww || isCardio(we) || ex.load_type !== 'weighted' ? '' : 'Enter today’s working weight in set 1 to get exact ramp-up weights. '}Rest about a minute between warm-up sets, then start your first working set. Don’t log warm-ups — they don’t count toward your sets or progress.</p>
      <h2>Tips</h2><ul class="tight small">
        ${isCardio(we) ? '<li>Breathing scale: talk in full sentences = easy; a few words = hard.</li>'
          : `<li>Work sets end with about <b>${we.target_rir} rep${we.target_rir === 1 ? '' : 's'} left in the tank</b>${we.target_rir === 0 ? ' (to failure, with good form)' : ''}.</li>
             <li>Full range of motion; control the lowering.</li>
             ${goal === 'athletic' && ex.kind === 'compound' ? '<li>Move each rep as fast as you can; end the set when speed drops.</li>' : ''}
             ${goal === 'strength' && ex.kind === 'compound' ? '<li>Rest 3–5 min between heavy sets.</li>' : '<li>Rest 1.5–3 min between work sets.</li>'}`}
      </ul>${insights[we.exercise_id] && !isCardio(we) ? `<h2>Trend</h2><div class="row">${statusPill(insights[we.exercise_id].status)}<a class="small" href="#/progress/${we.exercise_id}">chart ›</a></div><p class="small">${esc(insights[we.exercise_id].status.rec)}</p>` : ''}
      <a class="small" href="#/learn/warmup">Why warm up this way?</a>
      <div class="spacer"></div><button class="primary block" id="closeInfo">Done</button>`,
      panel => { panel.querySelector('#closeInfo').onclick = closeSheet; panel.querySelector('a').onclick = () => closeSheet(); });
  });
  $$('[data-edit]').forEach(b => b.onclick = () => {
    const m = b.dataset.edit;
    if (!isRated(m) && !muscleComplete(m)) return toast(`Finish ${m}'s sets first — ratings open automatically`);
    openRating(m, !isRated(m));
  });
  // Replace an exercise — just today, or today and every later week of this meso (same day). Doc §5.7.
  $$('[data-replace]').forEach(b => b.onclick = async () => {
    const we = wes.find(w => w.id === b.dataset.replace), m = we.exercises.muscle_group;
    const [lib, prefs] = await Promise.all([loadExercises(), loadPrefs()]);
    const P2 = L.applyPreferences(lib, { prefs, equipment: profile?.equipment || null, avoidTags: profile?.avoid_tags || [] });
    const ok = L.candidatesFor(m, P2.library, P2.favorites).filter(e => e.id !== we.exercise_id && e.load_type !== 'cardio');
    const logged = we.sets.filter(x => x.completed_at).length;
    let pick = null;
    openSheet(`<h3>Replace ${esc(we.exercises.name)}</h3>
      <p class="muted small">Same muscle (${esc(m)}), favorites first; exercises you've excluded or that don't fit your equipment are hidden.</p>
      <input id="rpSearch" placeholder="Search ${esc(m)} exercises" autocomplete="off">
      <div id="rpList" class="rp-list">${ok.map(e => `<button class="list-btn" data-rp="${e.id}"><div class="grow"><b>${esc(e.name)}</b> <span class="muted tiny">${esc(e.equipment || '')}${P2.favorites.has(e.id) ? ' · ★' : ''}</span></div></button>`).join('') || '<p class="muted">No other exercises for this muscle.</p>'}</div>
      <div id="rpScope" hidden>
        <p class="small">Replace with <b id="rpName"></b>:</p>
        ${logged ? `<p class="small warn-text">${logged} logged set${logged > 1 ? 's' : ''} of ${esc(we.exercises.name)} will be removed from today.</p>` : ''}
        <button class="primary block" data-scope="today">Just today</button>
        <button class="block mt6" data-scope="future">Today and every later week (this day)</button>
        <p class="muted tiny">The new exercise starts fresh: no history means you pick the weight the first time, then it progresses normally.</p></div>
      ${!logged && wes.length > 1 ? `<div class="sheet-foot"><button class="ghost block danger-text" id="rpRemove">Remove ${esc(we.exercises.name)} from today</button></div>` : ''}`,
      panel => {
        const list = panel.querySelector('#rpList');
        panel.querySelector('#rpSearch').oninput = e => { const q = e.target.value.toLowerCase(); list.querySelectorAll('[data-rp]').forEach(x => x.hidden = !x.textContent.toLowerCase().includes(q)); };
        list.querySelectorAll('[data-rp]').forEach(x => x.onclick = () => { pick = ok.find(e => e.id === x.dataset.rp);
          list.querySelectorAll('[data-rp]').forEach(y => y.classList.toggle('on', y === x)); panel.querySelector('#rpName').textContent = pick.name; panel.querySelector('#rpScope').hidden = false; });
        const rm = panel.querySelector('#rpRemove'); if (rm) rm.onclick = async () => {
          if (!confirm(`Remove ${we.exercises.name} from today? Later weeks keep it.`)) return;
          const q = qLoad(); Object.keys(q).filter(k => k.startsWith(we.id + ':')).forEach(k => delete q[k]); qStore(q); syncBadge();
          check(await sb.from('workout_exercises').delete().eq('id', we.id));
          closeSheet(); toast(`Removed ${we.exercises.name} from today`); renderWorkout(dayId);
        };
        panel.querySelectorAll('[data-scope]').forEach(x => x.onclick = async () => {
          if (!pick) return;
          if (logged) check(await sb.from('sets').delete().eq('workout_exercise_id', we.id));
          if (exFbOn && exFb[we.id]) await sb.from('exercise_feedback').delete().eq('workout_exercise_id', we.id);
          const q = qLoad(); Object.keys(q).filter(k => k.startsWith(we.id + ':')).forEach(k => delete q[k]); qStore(q); syncBadge();
          check(await sb.from('workout_exercises').update({ exercise_id: pick.id, flag: null }).eq('id', we.id));
          let n = 0;
          if (x.dataset.scope === 'future') {
            const later = check(await sb.from('workout_exercises').select('id, workout_days!inner(id, week, day_index, mesocycle_id, completed_at)')
              .eq('exercise_id', we.exercise_id).eq('workout_days.mesocycle_id', meso.id).eq('workout_days.day_index', day.day_index).gt('workout_days.week', day.week));
            const ids = later.filter(w => !w.workout_days.completed_at).map(w => w.id);
            if (ids.length) check(await sb.from('workout_exercises').update({ exercise_id: pick.id }).in('id', ids));
            n = ids.length;
          }
          closeSheet(); toast(`${we.exercises.name} → ${pick.name}${x.dataset.scope === 'future' ? ` today + ${n} later week${n === 1 ? '' : 's'}` : ' for today'}`, false, 3500);
          renderWorkout(dayId);
        });
      });
  });
  // v1.15.0: add an exercise in the middle of a meso — just today, or today and every later week of this day.
  // Same filters as Replace (excluded, equipment, injured areas). Target effort follows the meso's week.
  const addBtn = $('#addEx'); if (addBtn) addBtn.onclick = async () => {
    const [lib, prefs] = await Promise.all([loadExercises(), loadPrefs()]);
    const P2 = L.applyPreferences(lib, { prefs, equipment: profile?.equipment || null, avoidTags: profile?.avoid_tags || [] });
    const have = new Set(wes.map(w => w.exercise_id));
    const groupsAll = [...L.MUSCLES, 'Cardio'];
    let muscle = wes.find(w => !isCardio(w))?.exercises.muscle_group || 'Chest', pick = null, sets = 3;
    const listFor = m => (m === 'Cardio' ? P2.library.filter(e => e.load_type === 'cardio') : L.candidatesFor(m, P2.library, P2.favorites).filter(e => e.load_type !== 'cardio'))
      .filter(e => !have.has(e.id));
    openSheet(`<h3>Add an exercise</h3>
      <p class="muted small">Hidden: exercises you've excluded, ones that don't fit your equipment, and ones for areas you're going easy on.</p>
      <label for="axMuscle">Muscle</label><select id="axMuscle">${groupsAll.map(m => `<option ${m === muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input id="axSearch" class="mt6" placeholder="Search" aria-label="Search exercises" autocomplete="off">
      <div id="axList" class="rp-list"></div>
      <div id="axScope" hidden>
        <p class="small">Add <b id="axName"></b>:</p>
        <div class="row inc-row"><label for="axSets">Sets</label><select id="axSets">${[1, 2, 3, 4, 5].map(n => `<option ${n === sets ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <button class="primary block" data-ax="today">Just today</button>
        <button class="block mt6" data-ax="future">Today and every later week (this day)</button>
        <p class="muted tiny">It starts fresh: you pick the weight the first time, then it progresses like the rest. Light weeks get half the sets.</p></div>`,
      panel => {
        const list = panel.querySelector('#axList'), search = panel.querySelector('#axSearch');
        const draw = () => { const q = search.value.toLowerCase(), opts = listFor(muscle);
          list.innerHTML = opts.map(e => `<button class="list-btn${pick?.id === e.id ? ' on' : ''}" data-ax-id="${e.id}" ${e.name.toLowerCase().includes(q) ? '' : 'hidden'}><div class="grow"><b>${esc(e.name)}</b> <span class="muted tiny">${esc(e.equipment || '')}${P2.favorites.has(e.id) ? ' · ★' : ''}</span></div></button>`).join('')
            || `<p class="muted">No ${esc(muscle)} exercises left to add.</p>`;
          list.querySelectorAll('[data-ax-id]').forEach(x => x.onclick = () => { pick = opts.find(e => e.id === x.dataset.axId);
            list.querySelectorAll('[data-ax-id]').forEach(y => y.classList.toggle('on', y === x));
            panel.querySelector('#axName').textContent = pick.name; panel.querySelector('#axScope').hidden = false; }); };
        panel.querySelector('#axMuscle').onchange = e => { muscle = e.target.value; pick = null; panel.querySelector('#axScope').hidden = true; draw(); };
        search.oninput = draw;
        panel.querySelector('#axSets').onchange = e => { sets = Number(e.target.value); };
        draw();
        panel.querySelectorAll('[data-ax]').forEach(x => x.onclick = async () => {
          if (!pick) return; x.disabled = true;
          const kind = pick.kind, goalName = meso.goal;
          // Follow the meso's effort style (v1.16.0): read it back from today's targets — any lift above this week's
          // normal target shows a floor (main lifts ≥1, or Conservative).
          const above = k => wes.filter(z => (z.exercises.kind === 'compound') === (k === 'compound') && z.target_rir != null && z.target_rir > L.targetRir(day.week, meso.weeks, goalName, k).rir).map(z => z.target_rir);
          const mode = above('isolation').length || above('compound').some(r => r >= 2) ? 'conservative' : above('compound').length ? 'main1' : 'standard';
          const rirAt = w => L.effortRir(w, meso.weeks, goalName, kind, mode);
          const row = (dId, w, pos) => { const r = rirAt(w); return { workout_day_id: dId, exercise_id: pick.id, position: pos, target_sets: r.deload ? L.deloadSets(sets) : sets, target_rir: r.rir }; };
          const pos = Math.max(0, ...wes.map(w => w.position || 0)) + 1;
          try {
            check(await sb.from('workout_exercises').insert(row(day.id, day.week, pos)));
            let n = 0;
            if (x.dataset.ax === 'future') {
              const later = all.filter(d => d.week > day.week && d.day_index === day.day_index && !d.completed_at && !d.skipped_at);
              if (later.length) {
                const cur = check(await sb.from('workout_exercises').select('workout_day_id, exercise_id, position').in('workout_day_id', later.map(d => d.id)));
                const rows = later.filter(d => !cur.some(c => c.workout_day_id === d.id && c.exercise_id === pick.id))
                  .map(d => row(d.id, d.week, Math.max(0, ...cur.filter(c => c.workout_day_id === d.id).map(c => c.position || 0)) + 1));
                if (rows.length) check(await sb.from('workout_exercises').insert(rows));
                n = rows.length;
              }
            }
            closeSheet(); toast(`Added ${pick.name}${x.dataset.ax === 'future' ? ` today + ${n} later week${n === 1 ? '' : 's'}` : ' for today'}`, false, 3500);
            renderWorkout(dayId);
          } catch (e) { x.disabled = false; toast(navigator.onLine ? 'Couldn’t add it — try again' : 'You’re offline — adding an exercise needs a connection', true); }
        });
      });
  };
  wes.forEach(refreshTrend);
  // v1.20.0 (audit U4): less scrolling while you log.
  //  - An exercise whose sets are all done folds to one line ("✓ 3/3 sets · best 70×11 · Show sets"); its ratings stay visible.
  //  - A "Next set" bar above the tabs shows the next unfinished set (exercise, set, weight × reps) with ✓ Log and Go to.
  // Display only: logging still goes through each set's own ✓ button, so data, rules and the offline queue are unchanged.
  const canLog = !preview && !day.completed_at;
  const fmtSet = r => { const w = r.querySelector('[data-f="weight"]'), n = r.querySelector('[data-f="reps"]');
    const wv = w?.value || w?.placeholder || '', nv = n?.value || n?.placeholder || '';
    return `${wv && wv !== '0' ? `${wv} ${unit()} × ` : ''}${nv}${/^\d+(–\d+)?$/.test(nv) ? ' reps' : ''}`; };
  const foldInfo = card => { const rows = [...card.querySelectorAll('.set')], done = rows.filter(r => r.classList.contains('done'));
    const best = done.reduce((b, r) => { const w = Number(r.querySelector('[data-f="weight"]')?.value) || 0, n = Number(r.querySelector('[data-f="reps"]')?.value) || 0;
      const e = (w || 1) * (1 + n / 30); return !b || e > b.e ? { e, w, n } : b; }, null);
    return { complete: rows.length > 0 && done.length === rows.length, done: done.length, total: rows.length, best }; };
  const setFold = (card, on) => { card.classList.toggle('folded', on); const b = card.querySelector('.fold-line'); if (!b) return;
    const f = foldInfo(card); b.setAttribute('aria-expanded', String(!on));
    b.innerHTML = on ? `${ic('check', 'accent')} ${f.done}/${f.total} sets${f.best ? ` · best ${f.best.w ? `${f.best.w}×` : ''}${f.best.n}` : ''} <span class="fold-show">Show sets</span>` : `<span class="fold-show">Hide sets</span>`;
    b.hidden = !on && !card.dataset.wasFolded; if (on) card.dataset.wasFolded = '1'; };
  const nextRow = () => [...app.querySelectorAll('.card[data-we]:not([data-muscle="Cardio"]) .set:not(.done)')].find(r => !r.closest('.folded'));
  const bar = document.createElement('div'); bar.id = 'nextBar'; bar.className = 'next-bar'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Next set');
  bar.innerHTML = '<div class="grow nb-text"><div class="nb-name"></div><div class="nb-what small"></div></div><button type="button" class="ghost sm" id="nbGo">Go to</button><button type="button" class="primary sm" id="nbLog">✓ Log</button>';
  if (canLog) app.appendChild(bar);
  const refreshNext = () => { if (!canLog) return; const r = nextRow(); bar.hidden = !r; document.body.classList.toggle('has-next', !!r); if (!r) return;
    const card = r.closest('.card[data-we]'), name = card.querySelector('h3')?.childNodes[0]?.textContent.trim() || '';
    bar.querySelector('.nb-name').textContent = name; bar.querySelector('.nb-what').textContent = `Next: set ${r.dataset.idx} · ${fmtSet(r)}`; bar._row = r; };
  bar.querySelector('#nbGo').onclick = () => { const r = bar._row; if (!r) return; r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.querySelector('[data-f="weight"]')?.focus({ preventScroll: true }); };
  bar.querySelector('#nbLog').onclick = () => { const r = bar._row; if (!r) return; r.scrollIntoView({ block: 'center' }); r.querySelector('.check')?.click(); };
  app.querySelectorAll('.card[data-we]:not([data-muscle="Cardio"])').forEach(card => {
    if (foldInfo(card).complete && !preview) setFold(card, true); else { const b = card.querySelector('.fold-line'); if (b) b.hidden = true; }
    card.querySelector('.fold-line')?.addEventListener('click', () => setFold(card, !card.classList.contains('folded')));
  });
  // after a set is logged (or edited), refresh the bar and fold an exercise that just finished
  const watch = new MutationObserver(muts => {
    if (!app.contains(bar) && canLog) return watch.disconnect();
    // fold a finished exercise only once you've moved on — when a set of a *different* exercise is logged — so
    // fixing a set right after finishing never means reopening the card
    for (const m of muts) if (m.type === 'attributes' && m.target.classList?.contains('set') && m.target.classList.contains('done')) {
      const here = m.target.closest('.card[data-we]');
      app.querySelectorAll('.card[data-we]:not([data-muscle="Cardio"]):not(.folded)').forEach(c => {
        if (c !== here && !c.dataset.userOpened && foldInfo(c).complete) setFold(c, true); });
    }
    refreshNext();
  });
  watch.observe(app, { subtree: true, attributes: true, attributeFilter: ['class'] });
  app.addEventListener('input', e => { if (e.target.matches?.('[data-f]')) refreshNext(); });
  app.querySelectorAll('.fold-line').forEach(b => b.addEventListener('click', () => { const c = b.closest('.card'); if (!c.classList.contains('folded')) c.dataset.userOpened = '1'; }));
  refreshNext();
  if (preview) {   // look, don't touch: nothing can be logged until the day is started
    $$('.card[data-we] input, .card[data-we] button:not([data-info]):not(.lift-flag), #finish, #skipDay, [data-edit]').forEach(el => { el.disabled = true; });
    $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    $('#finish') && ($('#finish').hidden = true);
    return;
  }
  if (!day.completed_at) enforceRatings();
  const sk = $('#skipDay'); if (sk) sk.onclick = async () => {
    if (!confirm('Skip this workout? Logged sets are kept.')) return;
    check(await sb.from('workout_days').update({ skipped_at: new Date().toISOString() }).eq('id', dayId)); go('#/meso/' + meso.id);
  };
  $('#finish').onclick = async () => {
    if (day.completed_at) return go('#/meso/' + meso.id);
    const exUn = wes.find(w => exComplete(w) && !exRated(w));
    if (exUn) { toast(`Rate ${exUn.exercises.name} first`); return openExRating(exUn); }
    const unrated = groups.filter(m => muscleComplete(m) && !isRated(m));
    if (unrated.length) { toast(`Rate ${unrated[0]} first`); return openRating(unrated[0]); }
    const open = $$('.set:not(.done)').length;
    if (open && !confirm(`${open} set${open > 1 ? 's are' : ' is'} not checked off. Finish anyway?`)) return;
    // Performance trend per muscle vs. last week (doc §1.7). First let in-flight saves land and push anything
    // saved offline; sets still waiting (no signal) are merged in, so the feedback never misses a logged set.
    for (let i = 0; i < 30 && document.querySelector('.set[data-busy]'); i++) await new Promise(r => setTimeout(r, 100));
    $('#finish').disabled = true;
    await flushQueue();
    // v1.12.3: with no signal, finish from what is on the phone (sets as loaded + every edit since + anything waiting).
    let fresh, offline = false;
    const r = await sb.from('workout_exercises').select('id, exercise_id, target_sets, target_rir, exercises(*), sets(*)').eq('workout_day_id', dayId);   // target_sets: the summary's "of N sets" (v1.20.5)
    if (!r.error) fresh = r.data;
    else if (isNetErr(r.error)) { offline = true; fresh = loadedRaw.map(w => ({ ...w, sets: w.sets.map(x => ({ ...x })) })); }
    else { $('#finish').disabled = false; return check(r); }
    const waiting = [...Object.values(qLoad()), ...(offline ? [...lastSent.values()] : [])];
    fresh.forEach(w => waiting.filter(p => p.workout_exercise_id === w.id).forEach(p => {
      const i = w.sets.findIndex(x => x.set_index === p.set_index); if (i >= 0) w.sets[i] = { ...w.sets[i], ...p }; else w.sets.push({ ...p }); }));
    if (offline || waiting.some(p => fresh.some(w => w.id === p.workout_exercise_id))) toast('No signal — finishing with what’s saved on your phone; it all syncs automatically.');
    fresh.forEach(w => w.sets.forEach(x => { x.weight = W(x.weight); }));
    const bw = bwD(), perfByMuscle = {};
    for (const m of muscles) {
      // v1.18.0 (audit T3): only like-with-like counts (same lift, best sets within 5 reps); otherwise "no comparison".
      const trends = fresh.filter(w => w.exercises.muscle_group === m).map(w => {
        const p = prev[w.exercise_id];
        return p ? L.comparableTrend(w.sets.filter(s => s.completed_at).map(s => ({ ...s, rir: s.rir ?? w.target_rir })), p.sets.map(s => ({ ...s, rir: s.rir ?? p.rir })), w.exercises, bw) : null;
      });
      const perf = L.combineTrends(trends);
      perfByMuscle[m] = perf;
      if (await durableWrite({ kind: 'upsert', table: 'muscle_feedback', values: { workout_day_id: dayId, muscle_group: m, performance: perf }, onConflict: 'workout_day_id,muscle_group' }) === 'failed') { $('#finish').disabled = false; return; }
    }
    const done = await durableWrite({ kind: 'update', table: 'workout_days', values: { completed_at: new Date().toISOString() }, eq: { id: dayId } });
    if (done === 'failed') { $('#finish').disabled = false; return; }
    const left = openDays(all).filter(d => d.id !== dayId);
    if (!left.length) await durableWrite({ kind: 'update', table: 'mesocycles', values: { status: 'completed' }, eq: { id: meso.id } });
    // v1.19.0 (audit U5): a short summary — what you did vs the plan, best sets vs last time, ratings, sync, next step.
    const next = [...left].sort((a, b) => a.week - b.week || a.day_index - b.day_index)[0];
    const fill = (ss, r) => ss.map(x => ({ ...x, rir: x.rir ?? r }));
    const pick = (arr, ex) => arr.reduce((b, x) => { const e = L.e1rm(x, ex, bw); return e != null && (!b || e > b.e) ? { x, e } : b; }, null);
    const summary = { at: Date.now(), since: day.started_at || new Date(Date.now() - 4 * 3600e3).toISOString(), dayId, mesoId: meso.id, title: `Week ${day.week} · ${dayName(day)}`, queued: done === 'queued',
      next: next ? { id: next.id, title: `Week ${next.week} · ${dayName(next)}` } : null, mesoName: meso.name,
      lifts: fresh.filter(w => !isCardio(w)).map(w => {
        const ss = fill(w.sets.filter(x => x.completed_at), w.target_rir), p = prev[w.exercise_id];
        const cur = pick(ss, w.exercises), old = p ? pick(fill(p.sets, p.rir), w.exercises) : null;
        const trend = p ? L.comparableTrend(ss, fill(p.sets, p.rir), w.exercises, bw) : null;
        // v1.20.5: a flat estimate usually means you did exactly the plan — keep what changed so the summary can say so.
        const bySet = a => [...a].sort((x, y) => x.set_index - y.set_index);
        const change = trend === 0 ? L.changeLabel(L.rawChange(bySet(ss), bySet(p.sets)), unit()) : null;
        return { name: w.exercises.name, muscle: w.exercises.muscle_group, done: ss.length, planned: w.target_sets || 0,
          best: cur ? { w: cur.x.weight, r: cur.x.reps } : null, last: old ? { w: old.x.weight, r: old.x.reps } : null,
          trend, change };
      }),
      cardio: fresh.filter(w => isCardio(w)).map(w => ({ name: w.exercises.name, min: w.sets.filter(x => x.completed_at).reduce((a, x) => a + (Number(x.duration_min) || 0), 0) })).filter(c => c.min),
      muscles: muscles.map(m => ({ m, perf: perfByMuscle[m] ?? null })) };
    try { sessionStorage.setItem('wl_summary', JSON.stringify(summary)); } catch {}
    go('#/summary');
  };
}

export function renderRecoveryGate(day, meso, pending) {
  const ans = {};
  app.innerHTML = `<div class="card info"><h3>Before you start</h3>
      <div class="small">How did you recover since you last trained these? This sets next week's volume.</div></div>
    ${pending.map(p => `<div class="card"><b>${esc(p.muscle_group)}</b>
      <div class="muted small">since Week ${p.workout_days.week} · ${esc(dayName(p.workout_days))}</div>
      <div class="fb-row">${segHtml('soreness', null, `data-m="${esc(p.muscle_group)}"`)}</div></div>`).join('')}
    <button class="primary block" id="go">Start workout</button>`;
  $$('[data-k]').forEach(b => b.onclick = () => {
    ans[b.dataset.m] = +b.dataset.v;
    $$(`[data-m="${CSS.escape(b.dataset.m)}"]`).forEach(x => x.classList.toggle('on', x === b));
  });
  $('#go').onclick = async () => {
    const missing = pending.find(p => ans[p.muscle_group] == null);
    if (missing) return toast(`Rate ${missing.muscle_group}`, true);
    $('#go').disabled = true;
    try { for (const p of pending) await applyAdjustment(p, ans[p.muscle_group], meso); }
    finally { renderWorkout(day.id); }
  };
}

// ---------- cardio ----------
export const ACTIVITIES = ['Run', 'Walk', 'Incline walk', 'Bike', 'Row', 'Elliptical', 'Stairmaster', 'Swim', 'HIIT', 'Hike', 'Sport', 'Other'];
export const RPE_WORDS = ['Rest', 'Very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Hard+', 'Very hard', 'Very hard+', 'Near max', 'Max'];
export async function renderCardio() {
  setHeader('Cardio', '#/explore', 'explore');
  const since = new Date(); since.setDate(since.getDate() - 8 * 7);
  const from = weekStart(since);
  const [list, wsets] = await Promise.all([cardioSince(isoDay(from)), workoutCardioSince(from.toISOString())]);
  const all = cardioItems(list, wsets);
  const ws = weekStart();
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = new Date(ws); s.setDate(s.getDate() - (7 - i) * 7); return s; });
  const byWeek = weeks.map(s => { const e = new Date(s); e.setDate(e.getDate() + 7);
    const items = all.filter(c => { const d = new Date(c.date + 'T12:00'); return d >= s && d < e; });
    return { s, min: items.reduce((a, c) => a + Number(c.minutes), 0), load: items.reduce((a, c) => a + L.cardioLoad(c), 0) }; });
  const cur = byWeek[7], prior = byWeek.slice(4, 7), avg = prior.reduce((a, w) => a + w.load, 0) / 3;
  const spike = avg > 0 && cur.load > avg * 1.5;
  const maxLoad = Math.max(1, ...byWeek.map(w => w.load));
  let rpe = 5;
  app.innerHTML = `
    <div class="card"><h3>Log cardio</h3>
      <form id="f">
        <div class="row"><div class="grow"><label>Activity</label><select name="activity">${ACTIVITIES.map(a => `<option>${a}</option>`).join('')}</select></div>
          <div class="w140"><label>Date</label><input type="date" name="date" value="${today()}"></div></div>
        <div class="row"><div class="grow"><label>Minutes</label><input name="minutes" type="number" inputmode="decimal" step="any" required></div>
          <div class="grow"><label>Avg HR (optional)</label><input name="hr" type="number" inputmode="numeric"></div></div>
        <label>Intensity (session RPE): <b id="rpeLbl">5 · ${RPE_WORDS[5]}</b></label>
        <div class="seg c11">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-rpe="${i}" class="${i === 5 ? 'on' : ''}">${i}</button>`).join('')}</div>
        <div class="row"><div class="grow"><label>Distance (optional)</label><input name="dist" type="number" inputmode="decimal" step="any"></div>
          <div class="w90"><label>Unit</label><select name="du"><option>mi</option><option>km</option><option>m</option></select></div></div>
        <label>Notes</label><input name="notes">
        <div class="spacer"></div><button class="primary block">Save cardio</button>
      </form></div>
    <div class="grid2"><div class="card"><div class="muted small">This week</div><div class="big">${fmt(cur.min)}<span class="muted small"> min</span></div><div class="muted small">load ${fmt(cur.load)}</div></div>
      <div class="card"><div class="muted small">3-wk avg load</div><div class="big">${fmt(Math.round(avg))}</div><div class="muted small">load = RPE × minutes</div></div></div>
    ${spike ? '<div class="card warn small">Cardio load is up more than 50% vs your recent weeks. If leg recovery dips, ease off or swap running for cycling (doc §1.9).</div>' : ''}
    <div class="card"><b>Weekly load (8 weeks)</b>
      <svg class="chart" viewBox="0 0 320 120">${byWeek.map((w, i) => { const h = Math.round(w.load / maxLoad * 100);
        return `<rect class="cbar${i === 7 ? ' now' : ''}" x="${i * 40 + 6}" y="${110 - h}" width="28" height="${h}" rx="4"></rect>
          <text x="${i * 40 + 20}" y="119" font-size="9" text-anchor="middle">${w.s.getMonth() + 1}/${w.s.getDate()}</text>`; }).join('')}</svg></div>
    <h2>Recent</h2>
    ${list.length ? `<div class="card"><table><tr><th>Date</th><th>Activity</th><th>Min</th><th>RPE</th><th>Load</th><th></th></tr>
      ${list.slice(0, 30).map(c => `<tr><td>${c.performed_on.slice(5)}</td><td>${esc(c.activity)}${c.distance ? ` <span class="muted tiny">${fmt(c.distance)}${c.distance_unit}</span>` : ''}</td>
        <td>${fmt(c.minutes)}</td><td>${c.rpe}</td><td>${fmt(L.cardioLoad(c))}</td><td><button class="ghost sm danger" data-del="${c.id}" aria-label="Delete this cardio session">${ic('x')}</button></td></tr>`).join('')}</table></div>` : '<p class="muted">No cardio logged yet.</p>'}`;
  $$('[data-rpe]').forEach(b => b.onclick = () => { rpe = +b.dataset.rpe; $$('[data-rpe]').forEach(x => x.classList.toggle('on', x === b)); $('#rpeLbl').textContent = `${rpe} · ${RPE_WORDS[rpe]}`; });
  $('#f').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    check(await sb.from('cardio_sessions').insert({ activity: fd.get('activity'), performed_on: fd.get('date') || today(), minutes: Number(fd.get('minutes')), rpe,
      avg_hr: fd.get('hr') ? Number(fd.get('hr')) : null, distance: fd.get('dist') ? Number(fd.get('dist')) : null,
      distance_unit: fd.get('dist') ? fd.get('du') : null, notes: fd.get('notes') || null }));
    toast('Cardio saved'); renderCardio();
  };
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this cardio entry?')) return; check(await sb.from('cardio_sessions').delete().eq('id', b.dataset.del)); renderCardio(); });
}

