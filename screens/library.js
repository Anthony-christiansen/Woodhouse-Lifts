// Woodhouse Lifts — Learn, exercise library, injuries & sore spots (shared by Settings and the meso builder), settings (moved out of app.js in 1.20.3, code unchanged).
import * as L from '../logic.js?v=59';
import * as LEARN from '../learn.js?v=59';
import * as MD from '../md.js?v=59';
import { ic } from '../icons.js?v=59';
import { esc, fmt, dayName, isoDay } from '../format.js?v=59';
import { toast } from '../ui.js?v=59';
import { profile, builder, setProfile, setExCache, setBuilder } from '../state.js?v=59';
import { sb, session, isNetErr, loadIncrements, qFailed, clearFailed } from '../net.js?v=59';
import { $, $$, APP_VERSION, CHANGELOG_URL, W, activeMeso, app, bwD, check, fetchAll, go, liftInsights, loadExercises, loadPrefs, mesoDays, openDays, renderNewPassword, setHeader, setPref, setTheme, statusPill, themePref, toLb, unit } from '../app.js?v=59';
import { builderFromTemplate, freshBuilder, onceNote } from '../screens/mesos.js?v=59';

// ---------- Learn ----------
// v1.11.4 — "How it works": the full training rules and evidence, rendered from docs/training-logic.md (same origin,
// public-safe content). md.js escapes everything before formatting, so the page can't inject markup.
export async function renderLogic() {
  setHeader('How it works', '#/learn', 'explore');
  const res = await fetch(`./docs/training-logic.md?v=${APP_VERSION}`);
  if (!res.ok) throw new Error('Couldn’t load the training logic page');
  const { html, toc } = MD.mdToHtml(await res.text());
  app.innerHTML = `<div class="card small"><b>Contents</b><ul class="tight">${toc.map(t => `<li><a href="#" data-jump="${t.id}">${t.html}</a></li>`).join('')}</ul></div>
    <article class="card md">${html}</article>`;
  app.querySelectorAll('[data-jump]').forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: 'smooth' }); });
  // In-doc "#section" anchors would clash with the hash router: scroll instead of navigating.
  app.querySelectorAll('article.md a[href^="#"]:not([href^="#/"])').forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth' }); });
}

export function renderLearn(sub) {
  const srcLinks = ids => `<div class="srcs">${ids.map(k => { const s = LEARN.SOURCES[k];
    return `<a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">${esc(s.t)}</a>`; }).join('')}</div>`;
  const goal = LEARN.GOALS.find(g => g.id === sub), art = LEARN.ARTICLES.find(a => a.id === sub);
  if (goal) {
    setHeader(goal.name, '#/learn', 'explore');
    const rows = [['Sets / muscle / week', goal.weekly], ['Per session', goal.session], ['Reps & load', goal.reps], ['Effort', goal.effort], ['Rest', goal.rest], ['Frequency', goal.freq]];
    app.innerHTML = `<div class="card"><div class="kv">${rows.map(([k, v]) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`).join('')}</div></div>
      <div class="card"><b>Why</b><p>${esc(goal.why)}</p></div>
      <h2>Research</h2>${srcLinks(goal.src)}`;
  } else if (art) {
    setHeader(art.title, '#/learn', 'explore');
    app.innerHTML = `<div class="card prose">${art.body.map(p => `<p>${esc(p)}</p>`).join('')}
      ${art.example ? `<div class="example"><b>Example</b><p>${esc(art.example)}</p></div>` : ''}</div>
      <h2>Research</h2>${srcLinks(art.src)}`;
  } else if (sub === 'muscles') {
    setHeader('Per muscle', '#/learn', 'explore');
    const d = LEARN.APP_DEFAULTS;
    app.innerHTML = `<div class="card small muted">Hypertrophy ranges for most people: <b>10–20 hard sets per muscle per week</b>, 2–8 per session, each muscle 2×/week.
        The app starts lower (numbers below) and adds sets only when your recovery feedback says you can handle them — up to 12 per session and 22 per week.</div>
      ${LEARN.MUSCLE_GUIDE.map(g => `<div class="card"><div class="row"><b class="grow">${g.m}</b>
          <span class="pill">start ${d[g.size].emphasize} emphasize · ${d[g.size].grow} grow · ${d[g.size].maintain} maintain</span></div>
        <div class="kv small"><div class="k">Reps</div><div class="v">${esc(g.reps)}</div><div class="k">Go-to exercises</div><div class="v">${esc(g.ex)}</div></div>
        <div class="muted small">${esc(g.note)}</div></div>`).join('')}
      <div class="card small muted">“start” = weekly sets in week 1 of a new mesocycle by the muscle's priority: <b>Emphasize</b> (grow hard, sets rise when recovery is good), <b>Grow</b> (conservative, sets rise only if progress needs it), <b>Maintain</b> (low volume).</div>`;
  } else {
    setHeader('Learn', '#/explore', 'explore');
    app.innerHTML = `<div class="card small muted">Short, plain-language guides to what the research says — and how the app uses it. Every page links its sources.</div>
      <h2>By goal</h2>
      <div class="card"><table class="goals"><thead><tr><th>Goal</th><th>Sets/muscle/wk</th><th>Reps</th><th>Effort</th></tr></thead><tbody>
        ${LEARN.GOALS.map(g => `<tr data-go="#/learn/${g.id}"><td><b>${ic(g.ico)} ${esc(g.name.split(' (')[0])}</b></td><td>${esc(g.weekly.replace(' per muscle', ''))}</td>
          <td>${esc(g.reps.split(';')[0].split(' at ')[0])}</td><td>${esc(g.effort.split(' — ')[0].split(' (')[0])}</td></tr>`).join('')}
      </tbody></table><div class="muted tiny mt6">Tap a row for sessions, rest, frequency and the why.</div></div>
      <button class="list-btn" data-go="#/learn/muscles"><span class="list-ico">${ic('person')}</span><div class="grow"><b>Per muscle</b><div class="muted small">Sets, reps and go-to exercises for each muscle</div></div>›</button>
      <h2>Read</h2>
      ${LEARN.ARTICLES.map(a => `<button class="list-btn" data-go="#/learn/${a.id}"><div class="grow"><b>${esc(a.title)}</b><div class="muted small">${esc(a.body[0].slice(0, 90))}…</div></div>›</button>`).join('')}
      <div class="card small muted">The full rules the app follows: <a href="#/logic">How it works — training logic &amp; evidence</a></div>`;
  }
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

export async function renderHistory() {
  setHeader('History', '#/explore', 'explore');
  const days = check(await sb.from('workout_days').select('id, week, day_index, label, completed_at, mesocycles(name), workout_exercises(id, sets(id, completed_at))')
    .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(100));
  const cardio = check(await sb.from('cardio_sessions').select('*').order('performed_on', { ascending: false }).limit(100));
  const items = [...days.filter(d => d.completed_at).map(d => ({ t: d.completed_at, kind: 'lift', d })), ...cardio.map(c => ({ t: c.performed_on + 'T12:00:00', kind: 'cardio', c }))]
    .sort((a, b) => b.t.localeCompare(a.t));
  app.innerHTML = items.length ? items.map(it => it.kind === 'lift'
    ? `<button class="list-btn" data-go="#/workout/${it.d.id}"><span class="list-ico">${ic('dumbbell')}</span><div class="grow"><b>${esc(it.d.mesocycles?.name)} · Wk ${it.d.week} ${esc(dayName(it.d))}</b>
        <div class="muted small">${new Date(it.t).toLocaleDateString()} · ${it.d.workout_exercises.reduce((a, w) => a + w.sets.filter(s => s.completed_at).length, 0)} sets</div></div>›</button>`
    : `<div class="list-btn"><span class="list-ico">${ic('heart')}</span><div class="grow"><b>${esc(it.c.activity)}</b>
        <div class="muted small">${it.c.performed_on} · ${fmt(it.c.minutes)} min · RPE ${it.c.rpe} · load ${fmt(L.cardioLoad(it.c))}</div></div></div>`).join('')
    : '<p class="muted">Nothing logged yet.</p>';
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

export async function renderProgress(exId, rangeArg, metricArg) {
  setHeader('Exercise progress', exId ? '#/progress' : '#/explore', 'explore');
  // Per-session strength is computed in the database (lift_sessions / strength_summary): deload weeks,
  // myo-rep mini-sets and cardio are excluded so sessions compare like for like.
  // v1.11.2: two views. "This meso" (default) = lifts in the current meso, % = week 1 → latest week of THIS meso, on what
  // you actually lifted. "All time" = every lift with when you last did it — no +/- %, because first-session-ever vs
  // latest (the old list) made a lift you haven't done in months look "+37%".
  if (!exId || exId === 'all') {
    const allTime = exId === 'all', meso = await activeMeso();
    const tabsHtml = `<div class="seg c2" role="tablist" aria-label="Progress view">${[['', 'This meso'], ['all', 'All time']].map(([k, v]) =>
      `<button role="tab" aria-selected="${(k === 'all') === allTime}" class="${(k === 'all') === allTime ? 'on' : ''}" data-go="#/progress${k ? '/' + k : ''}">${v}</button>`).join('')}</div>`;
    if (!allTime) {
      const rows = meso ? check(await sb.from('workout_exercises').select('exercise_id, exercises!inner(name, muscle_group, load_type), workout_days!inner(mesocycle_id)')
        .eq('workout_days.mesocycle_id', meso.id)) : [];
      const lifts = {}; rows.filter(r => r.exercises.load_type !== 'cardio').forEach(r => lifts[r.exercise_id] = r.exercises);
      const ins = await liftInsights(Object.keys(lifts), { meso: meso?.id || null });
      const list = Object.entries(lifts).map(([id, e]) => ({ id, ...e, ch: L.mesoChange(ins[id]?.entries, meso?.id) }))
        .sort((a, b) => a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name));
      const pill = ch => !ch ? '<span class="muted tiny">not done yet</span>' : ch.pct == null ? `<span class="muted tiny">wk ${ch.toWeek} only</span>`
        : `<span class="pill ${ch.pct > 0.5 ? 'on' : ch.pct < -0.5 ? 'bad' : ''}">${ch.pct > 0 ? '+' : ''}${ch.pct.toFixed(1)}%</span>`;
      app.innerHTML = tabsHtml + (meso ? `<p class="muted small">${esc(meso.name)} — change in what you lifted from week 1 to your latest week of this meso (light weeks left out).</p>
        ${list.map(x => `<button class="list-btn" data-go="#/progress/${x.id}"><div class="grow"><b>${esc(x.name)}</b>
          <div class="muted small">${esc(x.muscle_group)}${x.ch?.pct != null ? ` · wk ${x.ch.fromWeek} → wk ${x.ch.toWeek}` : ''}</div></div>${pill(x.ch)}</button>`).join('')}`
        : '<p class="muted">No active mesocycle. Switch to <b>All time</b> to see every lift you’ve trained.</p>');
    } else {
      const list = await fetchAll(() => sb.rpc('strength_summary').order('muscle_group').order('name'));
      const mo = d => new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      app.innerHTML = tabsHtml + (list.length ? `<p class="muted small">Every lift you’ve logged and when you last did it. No percentages here — tap a lift for its full history. Greyed = not trained in the last 8 weeks.</p>
        ${list.map(x => { const stale = L.isStale(x.last_at);
          return `<button class="list-btn ${stale ? 'stale' : ''}" data-go="#/progress/${x.exercise_id}"><div class="grow"><b>${esc(x.name)}</b>
          <div class="muted small">${esc(x.muscle_group)} · ${x.sessions} session${x.sessions > 1 ? 's' : ''}</div></div>
          <span class="muted tiny">last ${mo(x.last_at)}</span></button>`; }).join('')}`
        : '<p class="muted">Log some sets and your progress shows up here.</p>');
    }
    return $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  const [all, meso, exRow] = await Promise.all([
    fetchAll(() => sb.rpc('lift_sessions', { p_exercise_id: exId }).order('done_at').order('session_id')),
    activeMeso(), sb.from('exercises').select('load_type').eq('id', exId).maybeSingle().then(r => r.data)]);
  if (!all.length) { app.innerHTML = '<p class="muted">No sets for this exercise yet.</p>'; return; }
  // Two views: Performance = load × reps with no RIR credit (what you actually lifted; rises through a meso as RIR drops),
  // Strength estimate = with RIR credit (comparable across different effort levels).
  const metric = metricArg === 'est' ? 'est' : 'perf';
  const series = all.map(s => ({ date: s.done_at.slice(0, 10), at: s.done_at, est: W(s.best_e1rm),
    raw: W(L.e1rm({ weight: s.top_weight, reps: s.top_reps, rir: 0 }, exRow || { load_type: 'weighted' }, profile?.bodyweight)),
    top: { weight: W(s.top_weight), reps: s.top_reps }, n: s.n_sets })).map(x => ({ ...x, e: metric === 'est' ? x.est : x.raw }));
  // Status: same rule and same data as the home screen and the workout flag (doc §6.1).
  const status = ((await liftInsights([exId]))[exId] || {}).status || { status: 'new', label: 'New', pct: null, rec: 'Log a couple of weeks and trends show up here.' };
  const mesoStart = meso?.started_on || null;
  // v1.11.2: a lift you haven't done this meso gets no current-sounding badge or % — just when you last did it.
  // Same rule as Home's "This meso's lifts": the lift is planned in the current meso (start dates can be missing on imports).
  const inMeso = !!meso && check(await sb.from('workout_exercises').select('exercise_id, workout_days!inner(mesocycle_id)')
    .eq('workout_days.mesocycle_id', meso.id)).some(x => x.exercise_id === exId);
  const lastDone = new Date(all[all.length - 1].done_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const ranges = { meso: 'This meso', '3m': '3 months', all: 'All' };
  const range = ranges[rangeArg] ? rangeArg : (mesoStart && series.some(x => x.date >= mesoStart) ? 'meso' : 'all');
  const from = range === 'meso' ? mesoStart : range === '3m' ? isoDay(new Date(Date.now() - 91 * 864e5)) : null;
  const ss = series.filter(x => !from || x.date >= from);
  // PR markers: sessions that beat every earlier session (whole history) by >1%.
  let run = 0; const prDates = new Set(); for (const x of series) { if (run && x.est > run * 1.01) prDates.add(x.at); run = Math.max(run, x.est); }
  const vals = ss.map(s => s.e), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const X = i => ss.length === 1 ? 160 : 10 + i * 300 / (ss.length - 1), Y = e => 110 - (e - min) / span * 95;
  const pts = ss.map((s, i) => `${X(i)},${Y(s.e)}`).join(' ');
  const mesoIdx = mesoStart && range !== 'meso' ? ss.findIndex(x => x.date >= mesoStart) : -1;
  const first = ss[0], last = ss[ss.length - 1], change = first.e ? (last.e - first.e) / first.e * 100 : 0;
  setHeader(all[0].name, '#/progress', 'explore');
  app.innerHTML = `${inMeso ? `<div class="card insight st-${status.status}"><div class="row"><b class="grow">${status.status === 'new' ? 'Getting started' : 'Where this lift stands'}</b>${statusPill(status)}</div>
      <p class="small mt6-only">${esc(status.rec)}</p>${status.vs ? `<p class="small muted mt6-only">${esc(status.vs.text)}</p>` : ''}</div>`
      : `<div class="card"><b>Not in this meso</b><p class="small muted mt6-only">Last done ${lastDone}. The chart and table below are its history — add it to a meso to get weekly targets and trends again.</p></div>`}
    <div class="seg c3" role="tablist" aria-label="Chart range">${Object.entries(ranges).map(([k, v]) => `<button role="tab" aria-selected="${k === range}" class="${k === range ? 'on' : ''}" data-go="#/progress/${exId}/${k}/${metric}" ${k === 'meso' && !mesoStart ? 'disabled' : ''}>${v}</button>`).join('')}</div>
    <div class="seg c2 mt8" role="tablist" aria-label="Chart measure">${[['perf', 'Performance'], ['est', 'Strength estimate']].map(([k, v]) => `<button role="tab" aria-selected="${k === metric}" class="${k === metric ? 'on' : ''}" data-go="#/progress/${exId}/${range}/${k}">${v}</button>`).join('')}</div>
    <div class="card"><div class="muted small">${metric === 'perf' ? `Performance per session (${unit()}) · weight × (1 + reps/30), no RIR credit — rises through a meso as you add reps or weight, resets a bit at each new meso's easier week 1`
      : `Estimated strength per session (${unit()}) · weight × (1 + (reps + RIR)/30) — gives credit for reps left in the tank, so hitting the plan each week looks flat; real gains show meso to meso`}</div>
      <svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Estimated strength from ${fmt(Math.round(first.e))} to ${fmt(Math.round(last.e))} ${unit()}">
      ${mesoIdx > 0 ? `<line x1="${X(mesoIdx)}" y1="8" x2="${X(mesoIdx)}" y2="114" class="guide" stroke-dasharray="3 3"/><text x="${X(mesoIdx) + 3}" y="14" font-size="9">meso start</text>` : ''}
      <polyline class="line" points="${pts}" fill="none" stroke-width="2.5"/>
      ${ss.map((s, i) => `<circle cx="${X(i)}" cy="${Y(s.e)}" r="${prDates.has(s.at) ? 4.5 : 3}" class="${prDates.has(s.at) ? 'dot-pr' : 'dot'}"/>`).join('')}</svg>
      <div class="row muted tiny"><span class="grow">${fmt(Math.round(min))}</span><span>${fmt(Math.round(max))}</span></div>
      <div class="grid3 keep mt8">
        <div class="stat center"><span class="big">${ss.length}</span><span class="muted tiny">sessions</span></div>
        ${inMeso ? `<div class="stat center"><span class="big">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span><span class="muted tiny">change</span></div>`
          : `<div class="stat center"><span class="big">${new Date(all[all.length - 1].done_at).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span><span class="muted tiny">last done</span></div>`}
        <div class="stat center"><span class="big">${[...prDates].filter(d => ss.some(x => x.at === d)).length}</span><span class="muted tiny">PRs <span class="warn-text">●</span></span></div></div></div>
    <div class="card"><table><tr><th>Date</th><th>Top set</th><th>Sets</th><th class="right">${metric === 'perf' ? 'Perf.' : 'Est.'}</th></tr>
      ${ss.slice().reverse().map(s => `<tr><td>${new Date(s.at).toLocaleDateString()}${prDates.has(s.at) ? ' ' + ic('trophy', 'pr') : ''}</td><td>${fmt(s.top.weight)} × ${s.top.reps}</td><td>${s.n}</td><td class="right">${fmt(Math.round(s.e))}</td></tr>`).join('')}</table></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

export async function renderVolume(mesoId) {
  setHeader('Muscle volume', '#/explore', 'explore');
  const meso = mesoId ? check(await sb.from('mesocycles').select('*').eq('id', mesoId).single()) : await activeMeso();
  if (!meso) { app.innerHTML = '<p class="muted">No active mesocycle.</p>'; return; }
  const days = await mesoDays(meso.id);
  const curWeek = (openDays(days)[0] || days[days.length - 1]).week;
  const wk = Number(sessionStorage.volWeek && sessionStorage.volMeso === meso.id ? sessionStorage.volWeek : curWeek);
  const wes = check(await sb.from('workout_exercises').select('target_sets, exercises(muscle_group, secondary), sets(completed_at), workout_days!inner(week, mesocycle_id)')
    .eq('workout_days.mesocycle_id', meso.id).eq('workout_days.week', wk));
  const plan = {}, done = {}, ind = {};
  for (const m of L.MUSCLES) { plan[m] = 0; done[m] = 0; ind[m] = 0; }
  for (const w of wes) {
    const m = w.exercises.muscle_group, d = w.sets.filter(s => s.completed_at).length;
    if (!(m in plan)) continue;
    plan[m] += w.target_sets; done[m] += d;
    for (const s of w.exercises.secondary || []) if (s in ind) ind[s] += 0.5 * w.target_sets;
  }
  const bandCls = { low: 'bad', maintain: 'info', productive: 'on', high: 'warn', over: 'bad' };
  app.innerHTML = `<div class="card"><div class="row"><div class="grow"><b>${esc(meso.name)}</b></div>
      <select class="w120" id="wk" aria-label="Week">${[...new Set(days.map(d => d.week))].map(w => `<option value="${w}" ${w === wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></div>
      <div class="muted small mt6">Planned sets per muscle (direct + ½ indirect). Productive range ≈ 10–20; under 4 is below maintenance (doc §1.1).</div></div>
    <div class="card">${L.MUSCLES.filter(m => plan[m] || ind[m]).map(m => { const tot = plan[m] + ind[m], band = L.volumeBand(tot);
      return `<div class="my10"><div class="row small"><span class="grow">${m}</span><span class="muted tiny">${done[m]}/${plan[m]} done${ind[m] ? ` · +${fmt(ind[m])} indirect` : ''}</span>
        <span class="pill ${bandCls[band]}">${fmt(tot)}</span></div>
        <div class="bar"><i style="width:${Math.min(100, tot / 24 * 100)}%;background:${band === 'productive' ? 'var(--accent)' : band === 'maintain' ? 'var(--info)' : 'var(--warn)'}"></i>
          <b style="left:${10 / 24 * 100}%"></b><b style="left:${20 / 24 * 100}%"></b></div></div>`; }).join('')}</div>`;
  $('#wk').onchange = e => { sessionStorage.volWeek = e.target.value; sessionStorage.volMeso = meso.id; renderVolume(meso.id); };
}

// ---------- exercise library ----------
export async function renderLibrary(tab = 'exercises') {
  setHeader('Library', null, 'library');
  const head = `<div class="tabs2"><button data-lt="exercises" class="${tab === 'exercises' ? 'on' : ''}">Exercises</button><button data-lt="templates" class="${tab === 'templates' ? 'on' : ''}">Templates</button></div>`;
  const wireTabs = () => $$('[data-lt]').forEach(b => b.onclick = () => go('#/' + b.dataset.lt));
  if (tab === 'templates') return renderTemplates(head, wireTabs);
  return renderExercises('', head, wireTabs);
}
export let tplView = { days: null, focus: '' };
export async function renderTemplates(head, wireTabs) {
  const mine = check(await sb.from('templates').select('*').order('created_at', { ascending: false }));
  const lib = await loadExercises(); const byId = new Map(lib.map(e => [e.id, e]));
  if (!tplView.days) tplView.days = builder?.days || 4;
  const draw = () => {
    const cat = L.templateCatalog(tplView.days).filter(t => !tplView.focus || t.preset === tplView.focus);
    app.innerHTML = head + `
    <h2>Templates</h2>
    <div class="muted small">Each template sets the split and which muscles get the most work. Pick your days to see the ones that fit.</div>
    <label id="lTd">Training days a week</label>
    <div class="seg c5" role="radiogroup" aria-labelledby="lTd">${[2, 3, 4, 5, 6].map(n => `<button type="button" role="radio" aria-checked="${tplView.days === n}" data-td="${n}" class="${tplView.days === n ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="chips" style="margin:10px 0" role="radiogroup" aria-label="Focus">${[['', 'All'], ...Object.entries(L.FOCI).map(([k, f]) => [k, f.name])].map(([k, n]) =>
      `<button type="button" class="chip ${tplView.focus === k ? 'sel' : ''}" data-tf="${k}" aria-pressed="${tplView.focus === k}">${esc(n)}</button>`).join('')}</div>
    ${cat.map(t => `<button type="button" class="choice tpl" data-tpl="${t.id}"><div class="grow"><b>${esc(t.name)}</b> <span class="muted small">· ${esc(t.splitName)}</span>${t.recommended ? ' <span class="pill tiny-pill">fits best</span>' : ''}
      <div class="muted small">${esc(t.blurb)}</div><div class="tiny muted">${esc(t.week.join(' · '))}</div>${onceNote(t)}</div>›</button>`).join('')}
    <h2>Your templates</h2>
    ${mine.length ? mine.map(t => `<div class="card"><div class="row"><div class="grow"><b>${esc(t.name)}</b>
        <div class="muted small">${t.weeks} wks · ${t.days_per_week} days/wk · ${t.plan.reduce((a, d) => a + d.slots.length, 0)} exercises</div></div></div>
        ${t.notes ? `<div class="muted tiny mt4">${esc(t.notes)}</div>` : ''}
        <details class="mt8"><summary class="muted small">Preview</summary>
          ${t.plan.map(d => `<div class="small mt6"><b>${esc(d.label)}</b><div class="muted tiny">${d.slots.map(x => `${esc(byId.get(x.exerciseId)?.name || x.muscle)} ×${x.sets}`).join(' · ')}</div></div>`).join('')}
        </details>
        <div class="grid2 mt10"><button class="primary sm" data-use="${t.id}">Use template</button><button class="sm danger" data-del="${t.id}">Delete</button></div></div>`).join('')
      : '<p class="muted">Save a plan from the builder or a mesocycle and it shows up here.</p>'}`;
    wireTabs();
    $$('[data-td]').forEach(b => b.onclick = () => { tplView.days = +b.dataset.td; draw(); });
    $$('[data-tf]').forEach(b => b.onclick = () => { tplView.focus = b.dataset.tf; draw(); });
    $$('[data-tpl]').forEach(b => b.onclick = () => {
      const t = L.templateById(b.dataset.tpl); setBuilder(freshBuilder());
      Object.assign(builder, { start: 'template', tpl: t.id, tplFocus: tplView.focus || null, days: t.days, daysTouched: true, split: t.split, scrollTpl: true,
        priorities: L.presetPriorities(t.preset), preset: t.preset, focus: t.focus });
      go('#/new'); });
    $$('[data-use]').forEach(b => b.onclick = () => { setBuilder(builderFromTemplate(mine.find(t => t.id === b.dataset.use))); go('#/new'); });
    $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this template?')) return; check(await sb.from('templates').delete().eq('id', b.dataset.del)); renderLibrary('templates'); });
  };
  draw();
}
export async function renderExercises(filter = '', head = '', wireTabs = () => {}) {
  const [list, prefList] = await Promise.all([loadExercises(true), loadPrefs(true)]);
  const prefs = new Map(prefList.map(p => [p.exercise_id, p]));
  let mf = decodeURIComponent(filter || ''), q = '';
  const draw = () => {
    const shown = list.filter(e => (!mf || e.muscle_group === mf) && (!q || e.name.toLowerCase().includes(q)));
    app.innerHTML = head + `
      <input id="q" placeholder="Search ${list.length} exercises" value="${esc(q)}"><div class="spacer"></div>
      <div class="chips">${['', ...L.MUSCLES, 'Cardio'].map(m => `<button class="chip ${m === mf ? 'sel' : ''}" data-mf="${m}">${m || 'All'}</button>`).join('')}</div>
      <div class="spacer"></div>
      <div class="muted tiny">${ic('star')} <b>Favorite</b> = the builder picks it first · ${ic('ban')} <b>Never</b> = the builder and swaps never pick it (you choose what to use instead). Tap again to undo. Your choices only.</div>
      <div class="card">${shown.map(e => { const pf = prefs.get(e.id); return `<div class="row exrow"><div class="grow">${esc(e.name)}${(() => { const mine = L.avoidedAreas(profile?.avoid_tags || []), hit = [...L.exerciseAreas(e)].filter(a => mine.includes(a));
          return hit.length ? ` <span class="pill warn" title="Loads an area you're protecting (Settings → Injuries & sore spots)">${esc(hit.map(a => L.BODY_AREAS[a].name).join(', '))}</span>` : ''; })()}
        <div class="muted tiny">${esc(e.muscle_group)} · ${esc(e.equipment || '')} · ${e.kind} · ${e.load_type} · ${e.rep_min}–${e.rep_max} reps${e.secondary?.length ? ' · also ' + e.secondary.join(', ') : ''}</div>
        ${pf?.pref === 'exclude' ? `<div class="sub"><label for="sub-${e.id}" class="tiny">Use instead</label><select id="sub-${e.id}" data-sub="${e.id}"><option value="">— autofill decides —</option>${list.filter(x => x.muscle_group === e.muscle_group && x.id !== e.id).map(x => `<option value="${x.id}" ${pf.substitute_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}</div>
        <button class="ghost sm pref ${pf?.pref === 'favorite' ? 'on' : ''}" data-fav="${e.id}" aria-pressed="${pf?.pref === 'favorite'}" aria-label="${pf?.pref === 'favorite' ? 'Remove from favorites' : 'Mark as favorite'}: ${esc(e.name)}">${ic('star', pf?.pref === 'favorite' ? 'fill' : '')}<span class="pref-lbl" aria-hidden="true">Favorite</span></button>
        <button class="ghost sm pref ${pf?.pref === 'exclude' ? 'bad' : ''}" data-excl="${e.id}" aria-pressed="${pf?.pref === 'exclude'}" aria-label="${pf?.pref === 'exclude' ? 'Allow again' : 'Never pick'}: ${esc(e.name)}">${ic('ban')}<span class="pref-lbl" aria-hidden="true">Never</span></button>
        ${e.owner_id ? `<button class="ghost sm danger" data-del="${e.id}" aria-label="Delete ${esc(e.name)}">${ic('x')}</button>` : ''}</div>`; }).join('') || '<p class="muted">No matches.</p>'}</div>
      <div class="card"><h3>Add your own</h3><form id="f">
        <label>Name</label><input name="name" required>
        <div class="row"><div class="grow"><label>Muscle</label><select name="mg">${[...L.MUSCLES, 'Cardio'].map(m => `<option ${m === mf ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div class="grow"><label>Equipment</label><select name="eq">${['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith Machine', 'Bodyweight', 'Band', 'Kettlebell', 'Other'].map(x => `<option>${x}</option>`).join('')}</select></div></div>
        <div class="row"><div class="grow"><label>Type</label><select name="kind"><option value="compound">Compound</option><option value="isolation">Isolation</option></select></div>
          <div class="grow"><label>Load</label><select name="lt"><option value="weighted">Weighted</option><option value="bodyweight">Bodyweight (+added)</option><option value="assisted">Assisted</option><option value="cardio">Cardio (minutes + RPE)</option></select></div></div>
        <div class="row"><div class="grow"><label>Rep min</label><input name="rmin" type="number" value="8"></div><div class="grow"><label>Rep max</label><input name="rmax" type="number" value="15"></div></div>
        <div class="spacer"></div><button class="primary block">Add exercise</button></form></div>`;
    wireTabs();
    const qi = $('#q'); qi.oninput = e => { q = e.target.value.toLowerCase(); const pos = qi.selectionStart; draw(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $$('[data-mf]').forEach(b => b.onclick = () => { mf = b.dataset.mf; draw(); });
    $('#f').onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(e.target);
      const rmin = Math.max(1, +fd.get('rmin') || 8), rmax = Math.max(rmin, +fd.get('rmax') || 15);
      check(await sb.from('exercises').insert({ name: fd.get('name').trim(), muscle_group: fd.get('mg'), equipment: fd.get('eq'),
        kind: fd.get('kind'), load_type: fd.get('lt'), rep_min: rmin, rep_max: rmax }));
      toast('Added'); setExCache(null); renderLibrary('exercises');
    };
    const refresh = async () => { prefList.length = 0; prefList.push(...await loadPrefs(true)); prefs.clear(); prefList.forEach(p => prefs.set(p.exercise_id, p)); draw(); };
    $$('[data-fav]').forEach(b => b.onclick = async () => { const id = b.dataset.fav; await setPref(id, prefs.get(id)?.pref === 'favorite' ? null : 'favorite'); refresh(); });
    $$('[data-excl]').forEach(b => b.onclick = async () => { const id = b.dataset.excl; await setPref(id, prefs.get(id)?.pref === 'exclude' ? null : 'exclude'); refresh(); });
    $$('[data-sub]').forEach(sel => sel.onchange = async () => { await setPref(sel.dataset.sub, 'exclude', sel.value || null); toast('Saved'); refresh(); });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this exercise?')) return;
      const r = await sb.from('exercises').delete().eq('id', b.dataset.del);
      if (r.error) toast('In use by a workout — can’t delete', true); else { setExCache(null); renderLibrary('exercises'); }
    });
  };
  draw();
}

// ---------- injuries & sore spots (shared by Settings and the meso builder) ----------
export const myAreas = () => L.avoidedAreas(profile?.avoid_tags || []);
export function areaGrid(lib) {
  const areas = myAreas(), count = a => lib.filter(e => L.exerciseAreas(e).has(a)).length;
  return `<div class="area-grid" role="group" aria-label="Areas to go easy on">${Object.entries(L.BODY_AREAS).map(([k, a]) => { const on = areas.includes(k), n = on ? count(k) : 0;
    return `<button type="button" class="area ${on ? 'on' : ''}" data-area="${k}" aria-pressed="${on}"><span class="area-top"><b>${esc(a.name)}</b><span class="tick" aria-hidden="true">${on ? ic('check') : ''}</span></span>
      <span class="tiny muted">${on ? `Leaving out ${n} exercise${n === 1 ? '' : 's'}` : 'Off'}</span></button>`; }).join('')}</div>`;
}
// Saves at once (the same setting everywhere), keeping any other avoid tags the account has. Returns true if saved.
export async function toggleArea(key, btn) {
  const tag = L.BODY_AREAS[key].tag, cur = profile?.avoid_tags || [];
  const next = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag];
  if (btn) btn.disabled = true;
  const r = await sb.from('profiles').update({ avoid_tags: next }).eq('id', session.user.id).select().single();
  if (r.error) { if (btn) btn.disabled = false; toast(isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return false; }
  setProfile({ ...profile, ...r.data });
  toast(next.includes(tag) ? `${L.BODY_AREAS[key].name}: going easy — the exercises that load it most are left out` : `${L.BODY_AREAS[key].name}: back to normal`);
  return true;
}
// v1.15.1: OK (or take back) one exercise despite an area you're going easy on — saved as "allow:<id>".
export async function setAllowed(id, on) {
  const tag = 'allow:' + id, cur = profile?.avoid_tags || [];
  const next = on ? [...new Set([...cur, tag])] : cur.filter(t => t !== tag);
  const r = await sb.from('profiles').update({ avoid_tags: next }).eq('id', session.user.id).select().single();
  if (r.error) { toast(isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return false; }
  setProfile({ ...profile, ...r.data, avoid_tags: next }); return true;
}
export async function clearAreas() {
  const keep = (profile?.avoid_tags || []).filter(t => !Object.values(L.BODY_AREAS).some(a => a.tag === t));
  const r = await sb.from('profiles').update({ avoid_tags: keep }).eq('id', session.user.id).select().single();
  if (r.error) { toast(r.error.message, true); return false; }
  setProfile({ ...profile, ...r.data }); return true;
}

// ---------- settings ----------
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith Machine', 'Kettlebell', 'Band'];
export async function renderSettings() {
  setHeader('Settings', '#/explore', 'explore');
  const lib = await loadExercises();
  const eq = profile?.equipment; // null = everything
  const areas = myAreas();
  // v1.20.8 (audit finding 1): saves the server refused are kept aside on this phone — show them, with what to do.
  const refused = qFailed();
  const refusedHtml = !refused.length ? '' : `<div class="card warn" id="syncProblems"><h3>${ic('alert')} Sync problems</h3>
      <p class="small">${refused.length} change${refused.length === 1 ? ' was' : 's were'} refused by the server, so ${refused.length === 1 ? 'it isn’t' : 'they aren’t'} in your history. ${refused.length === 1 ? 'It’s' : 'They’re'} kept here so nothing is lost silently. If ${refused.length === 1 ? 'it matters' : 'one matters'}, re-enter it in that workout, then clear the list.</p>
      <ul class="small">${refused.slice().reverse().map(f => `<li>${f.op ? `A ${f.op.table === 'workout_days' ? 'finish / skip' : f.op.table === 'muscle_feedback' || f.op.table === 'exercise_feedback' ? 'rating' : 'change'}` : `Set ${f.set_index ?? '?'}${f.reps != null ? `: ${f.weight != null ? `${fmt(W(f.weight))} ${unit()} × ` : ''}${f.reps} reps` : ''}`}
        <span class="muted tiny">· ${esc(String(f._at || '').slice(0, 10))} · ${esc(f._error || 'refused')}</span></li>`).join('')}</ul>
      <button class="block" id="clearFailed">Clear the list</button></div>`;
  app.innerHTML = `${refusedHtml}<div class="card">
      <div class="muted small">Signed in as</div><div>${esc(session.user.email)}</div>
      <label for="name">Name</label><input id="name" autocomplete="name" value="${esc(profile?.display_name || '')}">
      <div class="row"><div class="grow"><label for="unit">Units</label><select id="unit"><option ${unit() === 'lb' ? 'selected' : ''}>lb</option><option ${unit() === 'kg' ? 'selected' : ''}>kg</option></select></div>
        <div class="grow"><label for="bw">Bodyweight (${unit()})</label><input id="bw" type="number" inputmode="decimal" step="any" value="${profile?.bodyweight == null ? '' : Math.round(bwD() * 10) / 10}"></div></div>
      <div class="muted tiny mt6">Bodyweight lets pull-ups, dips and push-ups count toward strength trends. Switching units only changes how weights are shown — your history stays the same.</div>
      <div class="spacer"></div><button class="primary block" id="save">Save</button></div>
    <div class="card" id="areasCard"><h3>Injuries &amp; sore spots</h3>
      <div class="muted small">Pick any area you want to go easy on. When the app builds a meso or suggests a swap, it leaves out the exercises that load that area the most and keeps gentler ones. Tap again to turn it off. This is your preference, not medical advice, and the matching is by exercise name, so check anything new.</div>
      ${areaGrid(lib)}
      ${(() => { const ok = [...L.allowedIds(profile?.avoid_tags || [])].map(id => lib.find(e => e.id === id)).filter(Boolean);
        return ok.length ? `<div class="small mt8"><b>OK’d anyway</b> <span class="muted tiny">(you chose these when a muscle had nothing else)</span>${ok.map(e => `<div class="row mt6"><span class="grow">${esc(e.name)}</span><button class="sm ghost" data-unallow="${e.id}">Take back</button></div>`).join('')}</div>` : ''; })()}
      ${areas.length ? `<details class="small mt8"><summary class="muted">What's left out (${areas.map(a => L.BODY_AREAS[a].name).join(', ')})</summary>
        ${areas.map(a => `<div class="mt6"><b>${esc(L.BODY_AREAS[a].name)}</b> <span class="muted tiny">— ${esc(L.BODY_AREAS[a].blurb)}</span><div class="muted tiny">${lib.filter(e => L.exerciseAreas(e).has(a)).map(e => esc(e.name)).join(' · ') || 'none in your library'}</div></div>`).join('')}
        <div class="muted tiny mt6">Starring one doesn’t bring it back. If a muscle has nothing left, the meso builder asks which one to OK.</div></details>` : ''}
      <div class="muted tiny mt6">Saved to your account as soon as you tap. New mesos and swap suggestions use it; meso days already built aren't changed.</div></div>
    <div class="card"><h3>Appearance</h3>
      <div class="seg c3 theme-seg" role="radiogroup" aria-label="Theme">${[['system', 'Match phone'], ['dark', 'Dark'], ['light', 'Normal']].map(([v, l]) =>
        `<button type="button" role="radio" data-theme-pick="${v}" aria-checked="${themePref() === v}" class="${themePref() === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="muted tiny mt6">Saved on this phone. The sun / moon button at the top of every screen switches between Dark and Normal in one tap.</div></div>
    <div class="card"><h3>Training preferences</h3>
      <div class="muted small">Used when the app builds a mesocycle for you. These are your choices; you can still add any exercise by hand.</div>
      <fieldset class="plain"><legend class="small">Equipment I have</legend>
        <div class="chips">${EQUIPMENT.map(x => `<label class="chip check"><input type="checkbox" name="eq" value="${x}" ${!eq || eq.includes(x) ? 'checked' : ''}> ${x}</label>`).join('')}</div>
        <div class="muted tiny">Bodyweight moves are always included.</div></fieldset>
      <div class="spacer"></div><button class="block" id="savePrefs">Save preferences</button>
      <button class="ghost block sm" data-go="#/exercises">Favorites &amp; exclusions → Exercise library</button></div>
    <div class="card"><h3>Smallest weight jumps</h3>
      <div class="muted small">What your gym can actually load (microplates, dumbbell pairs, pin stacks). Suggestions round to these and add about 2.5% at a time — never more than 5 lb / 2.5 kg in one step.</div>
      ${['Machine', 'Cable', 'Barbell', 'Dumbbell'].map(k => { const v = L.increment({ equipment: k }, unit()); const opts = unit() === 'kg' ? [0.5, 1, 1.25, 2, 2.5, 5] : [1, 2.5, 5, 10];
        return `<div class="row inc-row"><label class="grow" for="inc-${k}">${k === 'Machine' ? 'Machines (pin / plate)' : k === 'Cable' ? 'Cables' : k === 'Barbell' ? 'Barbell & sled (per jump, both sides)' : 'Dumbbells (next pair up)'}</label>
          <select id="inc-${k}" data-inc="${k}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select><span class="muted small">${unit()}</span></div>`; }).join('')}
      <button class="block" id="saveInc">Save weight jumps</button></div>
    <div class="card small"><a href="#/logic">How it works — training logic &amp; evidence</a> <span class="muted">— why the app sets your weights, sets and RIR the way it does.</span></div>
    <button class="block" id="pw">Change password</button><div class="spacer"></div>
    <button class="block" id="out">Sign out</button>
    <p class="muted small center">Install: Safari → Share → Add to Home Screen.</p>
    <p class="muted tiny center">Woodhouse Lifts ${APP_VERSION} · <a href="${CHANGELOG_URL}" target="_blank" rel="noopener">What’s new</a></p>`;
  $('#clearFailed') && ($('#clearFailed').onclick = () => { if (!confirm('Clear the list of refused changes? Re-enter anything you still need first.')) return; clearFailed(); renderSettings(); });
  $('#save').onclick = async () => {
    const bw = $('#bw').value;
    // The bodyweight box is in the unit shown when the page opened; convert with that unit, then switch.
    const bwLb = bw === '' ? null : bw === $('#bw').defaultValue ? profile?.bodyweight : Math.round(toLb(bw) * 10) / 10; // unchanged → keep exact stored value
    setProfile({ ...profile, ...check(await sb.from('profiles').update({ display_name: $('#name').value.trim(), unit: $('#unit').value, bodyweight: bwLb })
      .eq('id', session.user.id).select().single()) });
    toast('Saved'); renderSettings();
  };
  $('#savePrefs').onclick = async () => {
    const picked = $$('input[name=eq]:checked').map(i => i.value);
    setProfile({ ...profile, ...check(await sb.from('profiles').update({ equipment: picked.length === EQUIPMENT.length ? null : picked })
      .eq('id', session.user.id).select().single()) });
    toast('Preferences saved — new mesocycles will use them');
  };
  $('#saveInc').onclick = () => {
    const cur = loadIncrements(); cur[unit()] = Object.fromEntries($$('[data-inc]').map(x => [x.dataset.inc, Number(x.value)]));
    try { localStorage.setItem('wl_increments', JSON.stringify(cur)); } catch {}
    L.setIncrements(cur); toast('Saved — suggestions now use these jumps');
  };
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#out').onclick = async () => { await sb.auth.signOut(); go('#/'); };
  $$('[data-theme-pick]').forEach(b => b.onclick = () => setTheme(b.dataset.themePick));
  // v1.14.0: tapping an area saves at once (no separate Save), keeping any other avoid tags the account has.
  $$('[data-area]').forEach(b => b.onclick = async () => { if (await toggleArea(b.dataset.area, b)) { const y = window.scrollY; await renderSettings(); window.scrollTo(0, y); } });
  $$('[data-unallow]').forEach(b => b.onclick = async () => { b.disabled = true; if (await setAllowed(b.dataset.unallow, false)) { toast('Taken back'); const y = window.scrollY; await renderSettings(); window.scrollTo(0, y); } else b.disabled = false; });
  $('#pw').onclick = () => renderNewPassword(false);
}

