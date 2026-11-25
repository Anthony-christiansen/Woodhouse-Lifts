// Woodhouse Lifts — mesocycles, mesocycle builder, mesocycle detail (moved out of app.js in 1.20.3, code unchanged).
import * as L from '../logic.js?v=62';
import { ic } from '../icons.js?v=62';
import { esc, today, dayName } from '../format.js?v=62';
import { toast, openSheet, closeSheet } from '../ui.js?v=62';
import { profile, builder, setBuilder } from '../state.js?v=62';
import { sb } from '../net.js?v=62';
import { $, $$, app, check, effortShort, go, lateCard, lateSets, lightWeekFrom, loadExercises, loadPrefs, mesoDays, openDays, setHeader, slipFor, startLightWeek, undoLightWeek, warnList, wireLate } from '../app.js?v=62';
import { areaGrid, clearAreas, myAreas, setAllowed, toggleArea } from '../screens/library.js?v=62';

// ---------- mesocycles ----------
export async function renderMesos() {
  setHeader('Mesocycles', null, 'mesos');
  const mesos = check(await sb.from('mesocycles').select('*').order('created_at', { ascending: false }));
  const by = s => mesos.filter(m => s.includes(m.status));
  const item = m => `<button class="list-btn" data-meso="${m.id}"><div class="grow"><b>${esc(m.name)}</b>
      <div class="muted small">${m.source === 'rp_import' ? 'RP import · ' : ''}${esc(L.TEMPLATES[m.focus]?.name || '')} · ${m.weeks} wks · ${m.days_per_week} days/wk</div></div>
      <span class="pill ${m.status === 'active' ? 'on' : ''}">${esc(m.status)}</span></button>`;
  app.innerHTML = `<div class="muted small mb10">A mesocycle is a training block of 4–8 weeks: effort builds week by week, then a light week lets you recover.</div>
    <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">From a template</button></div>
    ${by(['active', 'planned']).length ? '<h2>Current</h2>' + by(['active', 'planned']).map(item).join('') : ''}
    <h2>Past</h2>${by(['completed', 'abandoned']).map(item).join('') || '<p class="muted">None yet.</p>'}`;
  $$('[data-meso]').forEach(b => b.onclick = () => go('#/meso/' + b.dataset.meso));
  $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') setBuilder(null); go(b.dataset.go); });
}

// v1.16.0 (audit T1): templates that train a growing muscle once a week are offered, ranked after the 2× ones, and say so.
export const onceNote = t => t.once?.length ? `<div class="tiny warn-text">Once a week: ${esc(t.once.join(', '))}. Works at the same weekly sets; splitting them over two days is the usual default.</div>` : '';
// v1.19.0 (audit U3): starting effort = what you last picked, else what your experience suggests, else Standard.
export const lsGet0 = k => { try { return localStorage.getItem(k); } catch { return null; } };
export const lsSet0 = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
export const startEffort = () => lsGet0('wl_effort_mode') ? L.effortOf(lsGet0('wl_effort_mode')) : L.EXPERIENCE[L.experienceOf(lsGet0('wl_experience'))]?.effort || 'standard';
export const equipText = () => profile?.equipment?.length ? profile.equipment.join(', ') : 'a full gym';
// ---------- mesocycle builder ----------
// builder (the in-progress meso) lives in state.js — setBuilder()
export function freshBuilder() {
  return { step: 1, name: '', weeks: 5, days: 4, focus: 'whole', preset: 'balanced', start: 'suggested', goal: 'hypertrophy', priorities: L.templatePriorities('whole'), plan: [],
    minutes: Number(localStorage.getItem('wl_session_minutes')) || 75, effort: startEffort(), exp: L.experienceOf(lsGet0('wl_experience')), lastMeso: undefined };
}
export function builderFromTemplate(t) {
  const b = { step: 2, start: 'scratch', nameTouched: true, weeksTouched: true, name: t.name.replace(/ \(from .*\)$/, ''), weeks: t.weeks, days: t.days_per_week, focus: t.focus, goal: L.goalOf(t.goal),
    priorities: Object.keys(t.priorities || {}).length ? Object.fromEntries(Object.entries(t.priorities).map(([m, p]) => [m, L.normPriority(p, t.focus)])) : L.templatePriorities(t.focus),
    minutes: Number(localStorage.getItem('wl_session_minutes')) || 75, effort: startEffort(), exp: L.experienceOf(lsGet0('wl_experience')),
    plan: t.plan.map(d => ({ label: d.label, slots: d.slots.map(x => ({ ...x })) })) };
  b.preset = L.matchPreset(b.priorities) || L.presetOfFocus(b.focus); b.adjusted = !L.matchPreset(b.priorities) && !!b.preset;
  return b;
}
export async function renderBuilder() {
  setHeader('New mesocycle', '#/mesos', 'mesos');
  const lib = await loadExercises();
  // Personal preferences (favorites, exclusions + substitutes, equipment, avoided tags) shape what autofill picks.
  const prefsB = await loadPrefs();
  let P = L.applyPreferences(lib, { prefs: prefsB, equipment: profile?.equipment, avoidTags: profile?.avoid_tags || [] });
  const recomputeP = () => { P = L.applyPreferences(lib, { prefs: prefsB, equipment: profile?.equipment, avoidTags: profile?.avoid_tags || [] }); };
  if (!builder) setBuilder(freshBuilder());
  const S = builder;
  const syncPlan = () => {
    while (S.plan.length < S.days) S.plan.push({ label: 'Day ' + (S.plan.length + 1), slots: [] });
    S.plan.length = S.days;
  };
  const exById = new Map(lib.map(e => [e.id, e]));
  const exOptions = (muscle, sel) => `<option value="">— pick —</option>` +
    [...L.candidatesFor(muscle, P.library, P.favorites), ...(sel && !P.library.some(e => e.id === sel) && exById.get(sel) ? [exById.get(sel)] : [])]
      .map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${P.favorites.has(e.id) ? '★ ' : ''}${esc(e.name)}</option>`).join('');

  // v1.12.0 — step 1: your week (days, time, goal) → start from Suggested / a template / scratch → name & length.
  // Every pick is a filled tile with a ✓ so it's obvious what is chosen; only the chosen start's options are shown.
  const presetName = () => S.preset ? L.FOCI[S.preset].name + (S.adjusted ? ' (adjusted)' : '') : 'Custom';
  const autoName = () => `${S.preset ? L.FOCI[S.preset].name : 'Custom'} · ${S.days} days`;
  const applyPriorities = (pr, preset) => { S.priorities = { ...pr }; S.preset = preset; S.focus = preset ? L.FOCI[preset].db : 'custom'; S.adjusted = false; S.autoMaintain = []; S.plan = []; };
  const applySuggestion = () => {
    const sg = L.suggestPlan({ days: S.days, last: S.lastMeso, fresh: S.fresh });
    S.split = sg.split; applyPriorities(sg.priorities, sg.preset); if (!sg.preset) S.focus = sg.focus;
    if (!S.weeksTouched) S.weeks = sg.weeks; S.sugg = sg;
  };
  const applyTemplate = t => { S.tpl = t.id; S.split = t.split; applyPriorities(L.presetPriorities(t.preset), t.preset); };
  const tick = on => on ? `<span class="tick" aria-hidden="true">${ic('check')}</span>` : '';
  const step1 = () => {
    if (!S.split || !L.SPLITS[S.split]?.days.includes(S.days)) S.split = L.defaultSplit(S.days);
    if (!S.nameTouched) S.name = autoName();
    const splits = L.splitsFor(S.days), cat = L.templateCatalog(S.days);
    const shownCat = cat.filter(t => !S.tplFocus || t.preset === S.tplFocus);
    const preview = L.splitLayout(S.split, S.days).map(d => d.label).join(' · ');
    const G = L.GOALS[L.goalOf(S.goal)];
    const startBody = S.start === 'suggested' ? `
        <div class="sugg">
          <div class="row"><b class="grow">${esc(presetName())} · ${esc(L.SPLITS[S.split].name)}</b><span class="pill">${S.weeks} weeks</span></div>
          <div class="muted small">Your week: ${esc(preview)}</div>
          <ul class="tight small">${(S.sugg?.reasons || []).map(r => `<li>${esc(r)}</li>`).join('')}
            <li>Fitted to ${S.minutes} min a workout on the next screen; it tells you if anything had to change.</li></ul>
          ${S.lastMeso ? `<div class="seg c2 mini" role="radiogroup" aria-label="Suggestion based on">
            <button type="button" role="radio" aria-checked="${!S.fresh}" data-fresh="0" class="${!S.fresh ? 'on' : ''}">Carry on from last meso</button>
            <button type="button" role="radio" aria-checked="${!!S.fresh}" data-fresh="1" class="${S.fresh ? 'on' : ''}">Start fresh (Balanced)</button></div>` : ''}
        </div>` : S.start === 'template' ? `
        <div class="muted small">${cat.length} templates fit ${S.days} days a week. Each sets the split and which muscles get the most work.</div>
        <div class="chips" style="margin:8px 0" role="radiogroup" aria-label="Focus">${[['', 'All'], ...Object.entries(L.FOCI).map(([k, f]) => [k, f.name])].map(([k, n]) =>
          `<button type="button" class="chip ${S.tplFocus === k || (!S.tplFocus && !k) ? 'sel' : ''}" data-tf="${k}" aria-pressed="${S.tplFocus === k || (!S.tplFocus && !k)}">${esc(n)}</button>`).join('')}</div>
        ${shownCat.map(t => `<button type="button" class="choice tpl ${S.tpl === t.id ? 'on' : ''}" data-tpl="${t.id}" aria-pressed="${S.tpl === t.id}">
          <div class="grow"><b>${esc(t.name)}</b> <span class="muted small">· ${esc(t.splitName)}</span>${t.recommended ? ' <span class="pill tiny-pill">fits best</span>' : ''}
            <div class="muted small">${esc(t.blurb)}</div>
            <div class="tiny muted">${esc(t.week.join(' · '))}</div>${onceNote(t)}</div>${tick(S.tpl === t.id)}</button>`).join('')}` : `
        <div class="muted small">Pick a split, then set each muscle under “Adjust muscles” below.</div>
        ${splits.map(x => `<button type="button" class="choice ${S.split === x.id ? 'on' : ''}" data-split="${x.id}" aria-pressed="${S.split === x.id}">
          <div class="grow"><b>${x.name}</b>${x.id === L.defaultSplit(S.days) ? ' <span class="pill tiny-pill">fits best</span>' : ''}<div class="muted small">${esc(x.blurb)}</div></div>${tick(S.split === x.id)}</button>`).join('')}
        <div class="muted small">Your week: <b>${esc(preview)}</b></div>`;
    app.innerHTML = `
      <div class="muted small" style="margin-bottom:8px">Step 1 of 2 · set up the meso</div>
      <div class="card"><div class="step-h"><span class="step-n">1</span><b>Your week</b></div>
        <label id="lDays">Training days a week</label>
        <div class="seg c5" role="radiogroup" aria-labelledby="lDays">${[2, 3, 4, 5, 6].map(n => `<button type="button" role="radio" aria-checked="${S.days === n}" data-days="${n}" class="${S.days === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label id="lMin">Time per workout</label>
        <div class="seg c5" role="radiogroup" aria-labelledby="lMin">${[45, 60, 75, 90, 120].map(n => `<button type="button" role="radio" aria-checked="${S.minutes === n}" data-min="${n}" class="${S.minutes === n ? 'on' : ''}">${n}<span class="tiny"> min</span></button>`).join('')}</div>
        <label id="lGoal">Goal</label>
        <div class="seg c3" role="radiogroup" aria-labelledby="lGoal">${Object.entries(L.GOALS).map(([k, g]) => `<button type="button" role="radio" aria-checked="${S.goal === k}" data-goal="${k}" class="${S.goal === k ? 'on' : ''}" aria-label="${esc(g.name)}">${esc(g.short || g.name)}</button>`).join('')}</div>
        <div class="muted tiny" style="margin-top:6px">${esc(G.blurb)} <a href="#/learn/${L.goalOf(S.goal)}">More ›</a></div>
        <label id="lExp">Experience</label>
        <div class="seg c3" role="radiogroup" aria-labelledby="lExp">${Object.entries(L.EXPERIENCE).map(([k, x]) => `<button type="button" role="radio" aria-checked="${S.exp === k}" data-exp="${k}" class="${S.exp === k ? 'on' : ''}" aria-label="${esc(x.name)}">${esc(x.short)}</button>`).join('')}</div>
        ${S.exp ? `<div class="muted tiny" style="margin-top:6px">${esc(L.EXPERIENCE[S.exp].blurb)}</div>` : '<div class="muted tiny" style="margin-top:6px">Sets how hard the plan starts. Change it any time.</div>'}
        <div class="muted tiny mt8">Equipment: <b>${esc(equipText())}</b> · <a href="#/settings">change in Settings</a></div>
      </div>
      <div class="card" id="injCard"><div class="row"><b class="grow" id="lInj">Any injuries or sore spots?</b></div>
        <div class="seg c2 mini mt8" role="radiogroup" aria-labelledby="lInj">
          <button type="button" role="radio" data-inj="no" aria-checked="${!S.injOpen}" class="${!S.injOpen ? 'on' : ''}">No</button>
          <button type="button" role="radio" data-inj="yes" aria-checked="${!!S.injOpen}" class="${S.injOpen ? 'on' : ''}">Yes${myAreas().length ? ` · ${myAreas().length}` : ''}</button></div>
        ${S.injOpen ? `<div class="muted tiny mt8">Pick what to go easy on. The exercises that load it most are left out and gentler ones kept. Saved to your account, so it's also in Settings, where you can change it any time.</div>${areaGrid(S.lib || [])}` : '<div class="muted tiny mt6">Nothing to adjust. You can add some later in Settings.</div>'}
      </div>
      <div class="card"><div class="step-h"><span class="step-n">2</span><b>Start from</b></div>
        <div class="start-tiles" role="radiogroup" aria-label="Start from">
          ${[['suggested', ic('star'), 'Suggested', 'One tap'], ['template', ic('calendar'), 'Templates', `${cat.length} to pick from`], ['scratch', ic('pencil'), 'From scratch', 'Set it all yourself']].map(([k, ico, n, sub]) =>
            `<button type="button" role="radio" aria-checked="${S.start === k}" data-start="${k}" class="choice start ${S.start === k ? 'on' : ''}"><span class="ico">${ico}</span><b>${n}</b><span class="tiny muted">${sub}</span>${tick(S.start === k)}</button>`).join('')}
        </div>
        <div class="spacer"></div>${startBody}
      </div>
      <div class="card"><div class="step-h"><span class="step-n">3</span><b>Name &amp; length</b></div>
        <div class="row"><div class="grow" style="flex:2"><label for="name">Name</label><input id="name" value="${esc(S.name)}" placeholder="e.g. Whole Body Meso 3"></div>
          <div class="grow"><label for="weeks">Weeks</label><select id="weeks">${[3, 4, 5, 6, 7, 8].map(n => `<option ${n === S.weeks ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <details class="adv mt8" id="advEffort" ${S.exp === 'experienced' || S.effortOpen ? 'open' : ''}><summary class="small"><b>Advanced:</b> how hard — now <b>${esc(L.EFFORT_MODES[S.effort].name)}</b></summary>
        <div class="lbl">How hard (reps short of failure)</div>
        <div class="seg c3" role="group" aria-label="How hard">${Object.entries(L.EFFORT_MODES).map(([k, m]) => `<button type="button" data-effort="${k}" aria-pressed="${S.effort === k}" class="${S.effort === k ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div>
        <div class="muted tiny mt6">${esc(L.EFFORT_MODES[S.effort].blurb)} Main lifts by week: <b>${Array.from({ length: S.weeks }, (_, i) => { const r = L.effortRir(i + 1, S.weeks, S.goal, 'compound', S.effort); return r.deload ? 'light' : r.rir; }).join(' → ')}</b>; other lifts: <b>${Array.from({ length: S.weeks }, (_, i) => { const r = L.effortRir(i + 1, S.weeks, S.goal, 'isolation', S.effort); return r.deload ? 'light' : r.rir; }).join(' → ')}</b>. The last week is a light week.</div></details>
      </div>
      <details class="card prio-box" id="prioBox" ${S.prioOpen || S.start === 'scratch' ? 'open' : ''}><summary><b>Adjust muscles</b>&nbsp; <span class="muted small">${S.start === 'scratch' ? 'set each muscle' : `optional · now: ${esc(presetName())}`}</span></summary>
        <ul class="tight small prio-key"><li><b>Emphasize</b> — your top priority: most sets, adds more when you recover well (pick up to ${L.MAX_EMPHASIZE}).</li>
          <li><b>Grow</b> — steady growth with moderate sets.</li><li><b>Maintain</b> — keep what you have with a few sets.</li><li><b>Skip</b> — leave it out.</li></ul>
        <div class="muted tiny">Number = weekly starting sets.</div>
        ${(() => { const n = L.MUSCLES.filter(m => L.normPriority(S.priorities[m], S.focus) === 'emphasize').length;
          return n > L.MAX_EMPHASIZE ? `<div class="card warn small my8">You're emphasizing ${n} muscles. Recovery is shared — emphasizing ${L.MAX_EMPHASIZE} or fewer at a time usually grows them faster. Consider moving some to Grow.</div>` : ''; })()}
        ${L.MUSCLES.map(m => { const pr = L.normPriority(S.priorities[m], S.focus); return `<div class="prio"><div>${m} <span class="muted small">${L.weeklyTarget(m, pr, S.focus, S.goal)} sets</span></div>
          <div class="seg c4">${L.PRIORITIES.map(p => `<button type="button" data-m="${m}" data-p="${p}" class="${pr === p ? 'on' : ''}" aria-pressed="${pr === p}" title="${esc(L.PRIORITY_INFO[p])}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>`; }).join('')}
      </details>
      <button class="primary block" id="next" ${S.start === 'template' && !S.tpl ? 'disabled' : ''}>${S.start === 'template' && !S.tpl ? 'Pick a template above' : 'Next: review the days ›'}</button>`;
    $$('[data-days]').forEach(b => b.onclick = () => { S.days = +b.dataset.days; S.daysTouched = true; S.plan = [];
      if (S.start === 'suggested') applySuggestion();
      else if (S.start === 'template') { const t = S.tpl && L.templateById(S.tpl.replace(/\.\d+$/, '.' + S.days)); if (t) applyTemplate(t); else { S.tpl = null; S.split = null; } }
      else S.split = null;
      step1(); });
    $$('[data-min]').forEach(b => b.onclick = () => { S.minutes = +b.dataset.min; try { localStorage.setItem('wl_session_minutes', S.minutes); } catch {} S.plan = []; step1(); });
    $$('[data-goal]').forEach(b => b.onclick = () => { S.goal = b.dataset.goal; step1(); });
    $$('[data-inj]').forEach(b => b.onclick = async () => {
      if (b.dataset.inj === 'yes') { S.injOpen = true; return step1(); }
      if (myAreas().length && !confirm(`Turn off going easy on ${myAreas().map(a => L.BODY_AREAS[a].name).join(', ')}? (Also changes Settings.)`)) return;
      if (myAreas().length && !(await clearAreas())) return;
      S.injOpen = false; S.plan = []; step1();
    });
    $$('#injCard [data-area]').forEach(b => b.onclick = async () => { if (await toggleArea(b.dataset.area, b)) { S.plan = []; step1(); } });
    $$('[data-start]').forEach(b => b.onclick = () => { if (S.start === b.dataset.start) return; S.start = b.dataset.start;
      if (S.start === 'suggested') applySuggestion();
      if (S.start === 'scratch' && !S.preset && !S.adjusted) applyPriorities(L.presetPriorities('balanced'), 'balanced');
      step1(); });
    $$('[data-fresh]').forEach(b => b.onclick = () => { S.fresh = b.dataset.fresh === '1'; applySuggestion(); step1(); });
    $$('[data-tf]').forEach(b => b.onclick = () => { S.tplFocus = b.dataset.tf || null; step1(); });
    $$('[data-tpl]').forEach(b => b.onclick = () => { applyTemplate(L.templateById(b.dataset.tpl)); step1(); });
    $$('[data-split]').forEach(b => b.onclick = () => { S.split = b.dataset.split; S.plan = []; step1(); });
    $('#name').oninput = e => { S.name = e.target.value; S.nameTouched = true; };
    $('#weeks').onchange = e => { S.weeks = +e.target.value; S.weeksTouched = true; step1(); };
    $$('[data-effort]').forEach(b => b.onclick = () => { S.effort = b.dataset.effort; S.effortOpen = true; lsSet0('wl_effort_mode', S.effort); step1(); });
    $$('[data-exp]').forEach(b => b.onclick = () => { S.exp = b.dataset.exp; lsSet0('wl_experience', S.exp);
      if (!lsGet0('wl_effort_mode')) S.effort = L.EXPERIENCE[S.exp].effort;   // an effort you picked yourself always wins
      step1(); });
    { const d = $('#advEffort'); if (d) d.ontoggle = () => { S.effortOpen = d.open; }; }
    $('#prioBox').ontoggle = e => { S.prioOpen = e.target.open; };
    $$('[data-p]').forEach(b => b.onclick = () => {
      S.priorities = { ...S.priorities, [b.dataset.m]: b.dataset.p };
      S.autoMaintain = (S.autoMaintain || []).filter(m => m !== b.dataset.m);   // your choice wins over the automatic one
      const same = L.matchPreset(S.priorities); if (same) { S.preset = same; S.focus = L.FOCI[same].db; S.adjusted = false; } else { S.adjusted = !!S.preset; if (!S.preset) S.focus = 'custom'; }
      S.plan = []; step1();
    });
    $('#next').onclick = () => {
      if (S.start === 'template' && !S.tpl) return toast('Pick a template first', true);
      if (!S.name.trim()) return toast('Give it a name', true);
      syncPlan(); S.step = 2;
      if (!S.plan.some(d => d.slots.length)) S.plan = buildFit('all');
      step2();
    };
    const sel = $('.choice.tpl.on'); if (sel && S.scrollTpl) { sel.scrollIntoView({ block: 'center' }); S.scrollTpl = false; }
  };

  // Doc §2.3 — autofill, then fit each day into the time available; remember what had to be trimmed.
  // v1.11.5: a full rebuild may move small Grow muscles to Maintain so the rest still get a growing amount of work.
  const buildFit = mode => {
    // Muscles the builder moved to Maintain last time go back to Grow first, so more time (or another day) restores them.
    if (mode === 'all' && S.autoMaintain?.length) { S.priorities = { ...S.priorities }; S.autoMaintain.forEach(m => { S.priorities[m] = 'grow'; }); S.autoMaintain = []; }
    // v1.16.0 (audit T7): moving Grow → Maintain is a proposal you accept, never done for you.
    const args = { plan: S.plan, priorities: S.priorities, focus: S.focus, goal: S.goal, split: S.split, library: P.library, favorites: P.favorites, mode, minutes: S.minutes };
    const f = L.fitPlan({ ...args, demote: false });
    const alt = mode === 'all' && f.under.length ? L.fitPlan(args) : null;
    S.proposal = alt?.demoted.length ? { demoted: alt.demoted, priorities: alt.priorities, days: alt.days, trimmed: alt.trimmed, under: alt.under } : null;
    S.trimmed = f.trimmed; S.demoted = []; S.under = f.under; return f.days;
  };
  const step2 = () => {
    const targets = L.weeklyTargets(S.priorities, S.focus, S.goal), placed = L.placedSets(S.plan);
    // v1.17.0 (audit T9): direct sets stay the plan's numbers; indirect work is an optional, labelled estimate.
    const showInd = (() => { try { return localStorage.getItem('wl_show_indirect') === '1'; } catch { return false; } })();
    const brk = L.setBreakdown(S.plan, new Map(lib.map(e => [e.id, e])));
    const libMap = new Map(P.library.map(e => [e.id, e])), mins = S.plan.map(d => L.sessionMinutes(d, libMap));
    const trimmedTxt = Object.entries(S.trimmed || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} −${n}`).join(', ');
    const dayTotals = S.plan.map(d => d.slots.reduce((a, s) => a + (Number(s.sets) || 0), 0));
    app.innerHTML = `
      ${P.removed.length ? `<div class="card small muted">Autofill is skipping ${P.removed.length} exercise${P.removed.length > 1 ? 's' : ''} because of your preferences${P.favorites.size ? ` and putting your ${P.favorites.size} favorite${P.favorites.size > 1 ? 's' : ''} first` : ''}. <a href="#/settings">Change</a></div>` : ''}
      ${S.carry ? `<div class="card small">Week 1 weights &amp; reps start from <b>${esc(S.carry.from)} · week ${S.carry.week}</b>. <button class="ghost sm" id="noCarry">Don't carry</button></div>` : ''}
      <div class="card"><div class="muted small">Step 2 of 2 · ${L.GOALS[L.goalOf(S.goal)].name} · ${esc(L.SPLITS[S.split]?.name || '')} · ${esc(presetName())} · ${S.days} days · ${S.minutes} min</div>
        <div class="spacer"></div>
        <div class="grid3">
          <button class="sm primary" id="fillAll">Autofill all</button>
          <button class="sm" id="fillLeft">Fill what's left</button>
          <button class="sm" id="clear">Clear (manual)</button>
        </div>
        ${(() => { const ar = L.avoidedAreas(profile?.avoid_tags || []); return ar.length ? `<div class="card small mt10-only">${ic('alert')} Going easy on <b>${esc(ar.map(a => L.BODY_AREAS[a].name).join(', '))}</b>: exercises that load ${ar.length > 1 ? 'these areas' : 'it'} the most were left out. <a href="#/settings">Change in Settings</a>.</div>` : ''; })()}
        ${(() => { const need = P.blocked.filter(b => targets[b.muscle] > 0 || S.plan.some(d => d.slots.some(x => x.muscle === b.muscle)));
          return need.map(b => { const ar = [...new Set(b.options.flatMap(e => e.areas || []))].map(a => L.BODY_AREAS[a]?.name).filter(Boolean);
            return `<div class="card warn small mt10-only" data-blocked="${esc(b.muscle)}"><b>${esc(b.muscle)}: every option loads ${esc(ar.join(' or ') || 'an area')}, which you’re going easy on.</b>
              Nothing was put back on its own. OK one to use anyway, or leave ${esc(b.muscle)} out of this meso.
              <div class="chips mt6">${b.options.slice(0, 4).map(e => `<button class="sm" data-allow="${e.id}">OK ${esc(e.name)}</button>`).join('')}</div>
              <button class="sm ghost mt6" data-leaveout="${esc(b.muscle)}">Leave ${esc(b.muscle)} out</button>
              <div class="muted tiny mt6">An OK is saved to your account and shown in Settings, where you can take it back.</div></div>`; }).join(''); })()}
        ${S.proposal ? `<div class="card small mt10-only" id="proposal"><b>Suggestion:</b> in ~${S.minutes} min there isn’t room to grow everything. Moving <b>${esc(S.proposal.demoted.join(', '))}</b> to <b>Maintain</b> (still trained, and ${S.proposal.demoted.length > 1 ? 'they get' : 'it gets'} work from the big lifts) frees sets for the rest.
          <div class="row mt6"><button class="sm primary" id="propYes">Move to Maintain</button><button class="sm" id="propNo">Keep as Grow</button></div></div>` : ''}
        ${S.demoted?.length ? `<div class="card small mt10-only">To keep your bigger muscles growing in ~${S.minutes} min, <b>${esc(S.demoted.join(', '))}</b> ${S.demoted.length > 1 ? 'were' : 'was'} set to <b>Maintain</b> (still trained; ${S.demoted.length > 1 ? 'they also get' : 'it also gets'} work from the big lifts). Growing a few muscles properly beats spreading too little across all of them. Change it under “Adjust muscles”.</div>` : ''}
        ${S.under?.length ? `<div class="card warn small mt10-only"><b>Not enough time to grow ${esc(S.under.map(u => u.muscle).join(', '))}</b> — ${esc(S.under.map(u => `${u.muscle} ${u.sets} sets/week`).join(', '))}, which maintains rather than grows (about ${S.under[0].floor}+ a week is the growth range here). Allow more time per workout, add a day, or set fewer muscles to Grow.</div>` : ''}
        ${trimmedTxt ? `<div class="card warn small mt10-only">To fit ~${S.minutes} min a workout, these weekly sets were trimmed (lowest priority first): <b>${esc(trimmedTxt)}</b>. Want them back? Add a day, allow more time, or set fewer muscles to Emphasize/Grow.</div>` : ''}
        <h2>Weekly sets: placed / target</h2>
        <div class="chips">${L.MUSCLES.filter(m => targets[m] || placed[m] || (showInd && brk[m].indirect)).map(m => {
          const p = placed[m], t = targets[m]; const cls = p < t ? 'under' : p > t * 1.25 + 1 ? 'over' : 'ok';
          return `<span class="chip ${cls}">${m} ${p}/${t}${showInd && brk[m].indirect ? ` <span class="ind">+${brk[m].indirect}</span>` : ''}</span>`; }).join('')}</div>
        <label class="chk tiny mt6"><input type="checkbox" id="showInd" ${showInd ? 'checked' : ''}> Show estimated indirect sets (+½ set to the helpers of each compound lift: bench → triceps &amp; shoulders, rows/pulldowns → biceps, squats/deadlifts → glutes)</label>
        ${showInd ? '<div class="muted tiny">An estimate to help you judge overlap — not a measured dose. Targets and colours use your direct sets only.</div>' : ''}
      </div>
      ${S.plan.map((d, di) => `<div class="card">
        <div class="row"><input class="flex1" data-label="${di}" value="${esc(d.label)}">
          <span class="pill ${mins[di] > S.minutes + 2 ? 'warn' : ''}">${dayTotals[di]} sets · ~${mins[di]} min</span></div>
        ${mins[di] > S.minutes + 2 ? `<div class="muted small warn-text mt6">About ${mins[di]} min — longer than your ${S.minutes} min. Remove a slot, add a day, or move a muscle to Maintain.</div>` : ''}
        ${d.slots.map((s, si) => `<div class="slot">
          <select data-sm="${di}.${si}">${[...L.MUSCLES, 'Cardio'].map(m => `<option ${m === s.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select data-se="${di}.${si}">${exOptions(s.muscle, s.exerciseId)}</select>
          <input type="number" inputmode="numeric" min="1" max="10" value="${s.sets}" data-ss="${di}.${si}">
          <button class="ghost danger sm icon-btn" data-rm="${di}.${si}" aria-label="Remove this exercise">${ic('x')}</button></div>`).join('')}
        <div class="spacer"></div><button class="sm block" data-add="${di}">+ Add exercise slot</button>
      </div>`).join('')}
      <div class="row"><button id="back1" class="grow">‹ Back</button><button class="primary grow" id="create">Create mesocycle</button></div>
      <div class="spacer"></div><button class="ghost block" id="saveTpl">${ic('star')} Save this plan as a template</button>`;
    const at = s => s.split('.').map(Number);
    { const nc = $('#noCarry'); if (nc) nc.onclick = () => { S.carry = null; step2(); }; }
    $('#fillAll').onclick = () => { S.plan = buildFit('all'); step2(); };
    $('#fillLeft').onclick = () => { S.plan = buildFit('fill'); step2(); };
    $('#clear').onclick = () => { S.plan = S.plan.map(d => ({ label: d.label, slots: [] })); step2(); };
    $('#back1').onclick = () => { S.step = 1; step1(); };
    $$('[data-label]').forEach(i => i.oninput = e => S.plan[+i.dataset.label].label = e.target.value);
    $$('[data-sm]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.sm); S.plan[d].slots[x].muscle = e.target.value; S.plan[d].slots[x].exerciseId = null; step2(); });
    $$('[data-se]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.se); S.plan[d].slots[x].exerciseId = e.target.value || null; });
    $$('[data-ss]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.ss); S.plan[d].slots[x].sets = Math.max(1, Math.min(10, +e.target.value || 1)); step2(); });
    $$('[data-rm]').forEach(b => b.onclick = () => { const [d, x] = at(b.dataset.rm); S.plan[d].slots.splice(x, 1); step2(); });
    $$('[data-add]').forEach(b => b.onclick = () => {
      const t = L.weeklyTargets(S.priorities, S.focus, S.goal), p = L.placedSets(S.plan);
      const m = L.MUSCLES.find(x => p[x] < t[x]) || 'Chest';
      S.plan[+b.dataset.add].slots.push({ muscle: m, exerciseId: null, sets: 3 }); step2();
    });
    { const y = $('#propYes'), n = $('#propNo');
      if (y) y.onclick = () => { const pp = S.proposal; S.priorities = pp.priorities; S.autoMaintain = pp.demoted; S.plan = pp.days; S.trimmed = pp.trimmed; S.under = pp.under; S.demoted = pp.demoted; S.proposal = null; step2(); };
      if (n) n.onclick = () => { S.proposal = null; step2(); }; }
    $$('[data-allow]').forEach(b => b.onclick = async () => { b.disabled = true;
      if (!await setAllowed(b.dataset.allow, true)) { b.disabled = false; return; }
      recomputeP(); S.plan = buildFit('fill'); step2(); });
    $$('[data-leaveout]').forEach(b => b.onclick = () => { const m = b.dataset.leaveout;
      S.priorities = { ...S.priorities, [m]: 'skip' }; S.plan = S.plan.map(d => ({ ...d, slots: d.slots.filter(x => x.muscle !== m) }));
      toast(`${m} left out of this meso`); step2(); });
    $('#showInd').onchange = e => { try { localStorage.setItem('wl_show_indirect', e.target.checked ? '1' : '0'); } catch {} step2(); };
    $('#create').onclick = create;
    $('#saveTpl').onclick = async () => {
      if (S.plan.some(d => d.slots.some(s => !s.exerciseId))) return toast('Pick an exercise for every slot first', true);
      const name = prompt('Template name', S.name || 'My template'); if (!name) return;
      check(await sb.from('templates').insert({ name, focus: S.focus, goal: S.goal, priorities: S.priorities, weeks: S.weeks, days_per_week: S.days, plan: S.plan }));
      toast('Template saved');
    };
  };

  async function create() {
    if (S.plan.some(d => !d.slots.length)) return toast('Every day needs at least one exercise', true);
    if (S.plan.some(d => d.slots.some(s => !s.exerciseId))) return toast('Pick an exercise for every slot (or tap Fill what\'s left)', true);
    const btn = $('#create'); btn.disabled = true; btn.textContent = 'Creating…';
    // One all-or-nothing call (create_mesocycle). The key stays the same across retries, so a retry after a
    // dropped connection returns the meso that was already created instead of making a duplicate.
    S.clientKey = S.clientKey || crypto.randomUUID();
    const days = [];
    const libById = new Map(lib.map(e => [e.id, e]));
    for (let w = 1; w <= S.weeks; w++) {
      S.plan.forEach((d, i) => days.push({ week: w, day_index: i + 1, label: d.label,
        exercises: d.slots.map(s => { const kind = libById.get(s.exerciseId)?.kind;
          // v1.16.0 (audit T4): the chosen effort style sets the floor (Standard / Main lifts ≥1 / Conservative).
          const { rir, deload } = L.effortRir(w, S.weeks, S.goal, kind, S.effort);
          return { exercise_id: s.exerciseId, target_sets: deload ? L.deloadSets(s.sets) : Number(s.sets), target_rir: rir }; }) }));
    }
    const { data: mesoId, error } = await sb.rpc('create_mesocycle', { p: { client_key: S.clientKey, name: S.name.trim(), weeks: S.weeks,
      days_per_week: S.days, focus: S.focus, goal: L.goalOf(S.goal), priorities: Object.fromEntries(L.MUSCLES.map(m => [m, L.normPriority(S.priorities[m], S.focus)])), started_on: today(), days,
      carry_meso_id: S.carry?.meso || null, carry_week: S.carry?.week || null } });
    if (error) {
      btn.disabled = false; btn.textContent = 'Create mesocycle';
      return toast(/fetch|network|failed to fetch/i.test(error.message) ? 'No connection — nothing was saved. Tap Create again when you’re back online.' : `Couldn’t create the mesocycle: ${error.message}`, true);
    }
    setBuilder(null); toast('Mesocycle created'); go('#/meso/' + mesoId);
  }
  // v1.14.1: the injuries question starts open when areas are already saved, and needs the library for its counts.
  if (S.injOpen === undefined) S.injOpen = myAreas().length > 0;
  if (!S.lib) S.lib = await loadExercises();
  // v1.12.0 — the suggestion carries on from your current (or most recent) meso, so read it once per new builder.
  if (S.lastMeso === undefined) {
    // v1.12.2: the running meso first (asked for directly — imported mesos share one created_at, so a "newest 10" list could miss it).
    const cols = 'id, name, focus, priorities, weeks, days_per_week, goal, status, created_at';
    const cur = (await sb.from('mesocycles').select(cols).in('status', ['active', 'planned']).order('created_at', { ascending: false })).data;
    const recent = Array.isArray(cur) && cur.length ? [] : (await sb.from('mesocycles').select(cols).neq('status', 'abandoned').order('created_at', { ascending: false }).limit(10)).data;
    S.lastMeso = L.lastMesoFor([...(Array.isArray(cur) ? cur : []), ...(Array.isArray(recent) ? recent : [])]);
    if (S.lastMeso && S.start === 'suggested' && !S.daysTouched) {
      if ([2, 3, 4, 5, 6].includes(S.lastMeso.days_per_week)) S.days = S.lastMeso.days_per_week;
      S.goal = L.goalOf(S.lastMeso.goal);
    }
    if (S.start === 'suggested') applySuggestion();
  }
  S.step === 2 ? (syncPlan(), step2()) : step1();
}

// ---------- mesocycle detail ----------
export async function renderMeso(id) {
  const meso = check(await sb.from('mesocycles').select('*').eq('id', id).single());
  setHeader(meso.name, '#/mesos', 'mesos');
  const [days, warnings, late] = await Promise.all([mesoDays(id), slipFor(meso), lateSets(meso)]);
  const next = openDays(days)[0];
  const weeks = [...new Set(days.map(d => d.week))];
  app.innerHTML = `
    <div class="card"><div class="row"><div class="grow muted small">${meso.source === 'rp_import' ? 'Imported from RP · ' : ''}${L.GOALS[L.goalOf(meso.goal)].name} · ${esc(L.TEMPLATES[meso.focus]?.name || '')} · ${meso.weeks} weeks · ${meso.days_per_week} days/week</div>
      <span class="pill ${meso.status === 'active' ? 'on' : ''}">${esc(meso.status)}</span></div></div>
    ${lateCard(meso, late)}
    ${warnings.length ? `<div class="card warn"><b>Things to check</b><div class="muted tiny">Everything worth a look on this meso, in one place.</div>${warnList(warnings)}</div>` : ''}
    <div class="weeks-scroll"><div class="weeks" style="--days:${meso.days_per_week}">
      ${weeks.map(w => { const r = L.targetRir(w, meso.weeks, meso.goal, 'compound'); return `<div class="week">
        <div class="muted small">Wk ${w}<br><span class="${r.deload ? 'pill warn' : 'tiny'}">${r.deload ? 'light' : effortShort(r.rir)}</span></div>
        ${days.filter(d => d.week === w).map(d => `<button class="day ${d.completed_at ? 'done' : ''} ${d.skipped_at ? 'skipped' : ''} ${d.started_at && !d.completed_at && !d.skipped_at ? 'live' : ''} ${next && d.id === next.id ? 'next' : ''}" data-day="${d.id}">${esc(dayName(d))}</button>`).join('')}
      </div>`; }).join('')}
    </div></div><div class="spacer"></div>
    ${next ? '<button class="primary block" id="go">Go to next workout</button>' : `<p class="muted center">All workouts done ${ic('party', 'accent')}</p>`}
    ${(() => { const t = lightWeekFrom(days); return ['active', 'planned'].includes(meso.status) && meso.weeks >= 4 && t >= 3 && t < meso.weeks
      ? `<button class="ghost block mt6" id="lightNow">Take the light week early (week ${t})</button>` : ''; })()}
    ${meso.light_week_undo && !days.some(d => d.week === meso.weeks && (d.started_at || d.completed_at)) ? `<button class="ghost block mt6" id="lightUndo">Undo the early light week (back to ${meso.light_week_undo.weeks} weeks)</button>` : ''}
    <div class="spacer"></div>
    <div class="grid2"><button data-go="#/volume/${id}">${ic('bars')} Volume</button><button data-go="#/history">${ic('history')} History</button>
      <button id="again">${ic('refresh')} Run it again</button><button id="tpl">${ic('star')} Save as template</button></div>
    <div class="spacer"></div>
    ${meso.status !== 'completed' ? '<button class="block" id="complete">Mark complete</button>' : ''}
    <div class="danger-zone"><button class="link-danger" id="del">Delete this mesocycle…</button></div>`;
  $$('[data-day]').forEach(b => b.onclick = () => go('#/workout/' + b.dataset.day));
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  if (next) $('#go').onclick = () => go('#/workout/' + next.id);
  if ($('#lightNow')) $('#lightNow').onclick = async e => { e.target.disabled = true; if (await startLightWeek(meso)) renderMeso(id); else e.target.disabled = false; };
  if ($('#lightUndo')) $('#lightUndo').onclick = async e => { e.target.disabled = true; if (await undoLightWeek(meso)) renderMeso(id); else e.target.disabled = false; };
  wireLate(meso, () => renderMeso(id));
  const planFromMeso = async () => {
    const d1 = days.filter(d => d.week === 1);
    const wes = check(await sb.from('workout_exercises').select('workout_day_id, exercise_id, target_sets, position, exercises(muscle_group, name)')
      .in('workout_day_id', d1.map(d => d.id)).order('position'));
    return d1.map(d => ({ label: d.label, slots: wes.filter(w => w.workout_day_id === d.id)
      .map(w => ({ muscle: w.exercises.muscle_group, exerciseId: w.exercise_id, sets: Math.max(1, w.target_sets) })) }));
  };
  // Run it again: same plan, and pick which week's logged weights & reps the new week 1 starts from (doc §5.6).
  $('#again').onclick = async () => {
    const plan = await planFromMeso();
    const working = weeks.filter(w => !L.targetRir(w, meso.weeks, meso.goal, 'compound').deload);
    const doneIn = w => days.filter(d => d.week === w && d.completed_at).length, total = w => days.filter(d => d.week === w).length;
    // Choices: the last working week before the deload, or go back up to two weeks from it (e.g. deload 7 → weeks 6, 5, 4).
    const lastWorking = working.at(-1) ?? 0;
    const choices = working.filter(w => w >= lastWorking - 2);
    const logged = choices.filter(w => doneIn(w) > 0);
    const def = logged.at(-1) ?? null;
    const start = w => {
      setBuilder(builderFromTemplate({ name: meso.name + ' (again)', weeks: meso.weeks, days_per_week: meso.days_per_week, focus: meso.focus, goal: meso.goal, priorities: meso.priorities, plan }));
      builder.carry = w ? { meso: meso.id, week: w, from: meso.name } : null;
      closeSheet(); go('#/new');
    };
    if (!logged.length) return start(null);
    openSheet(`<h3>Start the new meso from which week?</h3>
      <p class="muted small">Week 1 of the new meso starts from the weights and reps you logged that week, then progresses week over week. Go back up to two weeks before the last one to back off and build up again.</p>
      ${choices.slice().reverse().map(w => { const r = L.targetRir(w, meso.weeks, meso.goal, 'compound'), n = doneIn(w);
        return `<button class="list-btn" data-week="${w}" ${n ? '' : 'disabled'}><div class="grow"><b>Week ${w}</b>${w === lastWorking ? ' <span class="pill on tiny-pill">last before deload</span>' : ` <span class="tiny muted">${lastWorking - w} week${lastWorking - w > 1 ? 's' : ''} back</span>`}<div class="muted small">${effortShort(r.rir)} · ${n}/${total(w)} workouts logged</div></div>›</button>`; }).join('')}
      <button class="ghost block" data-week="0">Don't carry weights — I'll pick them</button>`,
      panel => panel.querySelectorAll('[data-week]').forEach(b => b.onclick = () => start(+b.dataset.week || null)));
  };
  $('#tpl').onclick = async () => {
    const name = prompt('Template name', meso.name); if (!name) return;
    check(await sb.from('templates').insert({ name, focus: meso.focus, goal: L.goalOf(meso.goal), priorities: meso.priorities, weeks: meso.weeks, days_per_week: meso.days_per_week, plan: await planFromMeso() }));
    toast('Saved to Library › Templates');
  };
  const c = $('#complete'); if (c) c.onclick = async () => { check(await sb.from('mesocycles').update({ status: 'completed' }).eq('id', id)); renderMeso(id); };
  $('#del').onclick = async () => {
    if (!confirm('Delete this mesocycle and every workout, set and rating in it? This can’t be undone.')) return;
    check(await sb.from('mesocycles').delete().eq('id', id)); go('#/mesos');
  };
}

