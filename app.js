import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as L from './logic.js?v=7';

// Public by design: access is enforced by row-level security in the database.
const sb = createClient('https://dnknmtzcmmdepwheagmq.supabase.co', 'sb_publishable_UANLQGHztac0fMLcBeUg4g_sFeKc88g',
  { auth: { persistSession: true, autoRefreshToken: true } });
const DOC_URL = 'https://docs.google.com/document/d/1Jxhk6bIeWpApGCHCpMIe96r7JE9-GjRW_tZOZUMuisg';

const app = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const tabs = document.getElementById('tabs');
const gearBtn = document.getElementById('gearBtn');
const sheet = document.getElementById('sheet');
let session = null, profile = null, exCache = null;

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = sel => app.querySelector(sel);
const $$ = sel => [...app.querySelectorAll(sel)];
const go = h => { location.hash = h; };
const unit = () => profile?.unit || 'lb';
const fmt = n => (n == null ? '–' : Number(n) % 1 ? Number(n).toFixed(1) : String(Number(n)));
const today = () => new Date().toISOString().slice(0, 10);
const dayName = d => d.label || 'Day ' + d.day_index;
const order = d => d.week * 100 + d.day_index;
function toast(msg, err = false) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), err ? 4500 : 1800);
}
function check(res) { if (res.error) { console.error(res.error); toast(res.error.message, true); throw res.error; } return res.data; }
function setHeader(title, back, tab) {
  titleEl.textContent = title;
  backBtn.hidden = !back; backBtn.onclick = () => go(back);
  tabs.hidden = !session;
  gearBtn.hidden = !session || tab !== 'home'; gearBtn.onclick = () => go('#/settings');
  tabs.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
function openSheet(html, wire, locked = false) {
  sheet.innerHTML = `<div class="panel">${html}</div>`; sheet.hidden = false;
  if (locked) sheet.dataset.lock = '1'; else delete sheet.dataset.lock;
  sheet.onclick = e => { if (e.target === sheet && !sheet.dataset.lock) closeSheet(); };
  wire?.(sheet.querySelector('.panel'));
}
function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; delete sheet.dataset.lock; }
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const isoDay = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const RATINGS = {
  pump: { label: 'Pump', opts: ['None', 'Mild', 'Good', 'Huge'] },
  workload: { label: 'Workload', opts: ['Easy', 'Pretty good', 'Pushed my limit', 'Too much'] },
  joint_pain: { label: 'Joint pain', opts: ['None', 'Low', 'Moderate', 'A lot'] },
  soreness: { label: 'Recovery', opts: ['Never got sore', 'Healed a while ago', 'Healed just in time', 'Still sore'] },
  breathing: { label: 'Breathing (talk test)', opts: ['Could sing', 'Talked easily', 'Short phrases', "Couldn't talk"] },
};
const rateKeys = m => m === 'Cardio' ? ['breathing', 'workload', 'joint_pain'] : ['pump', 'workload', 'joint_pain'];
const segHtml = (key, val, attrs = '') => `<div class="seg">${RATINGS[key].opts.map((o, i) =>
  `<button type="button" ${attrs} data-k="${key}" data-v="${i}" class="${val === i ? 'on' : ''}">${o}</button>`).join('')}</div>`;

async function loadExercises(force = false) {
  if (!exCache || force) exCache = check(await sb.from('exercises').select('*').order('muscle_group').order('name'));
  return exCache;
}

// ---------- router ----------
const routes = {
  '': renderHome, mesos: renderMesos, train: renderMesos, new: renderBuilder, meso: renderMeso, workout: renderWorkout,
  explore: renderExplore, history: renderHistory, progress: renderProgress, volume: renderVolume,
  cardio: renderCardio, library: renderLibrary, exercises: () => renderLibrary('exercises'), templates: () => renderLibrary('templates'),
  settings: renderSettings,
};
async function route() {
  closeSheet();
  const { data } = await sb.auth.getSession(); session = data.session;
  if (!session) { tabs.hidden = true; return renderAuth(); }
  if (!profile) profile = (await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()).data;
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  try { await (routes[name] || renderHome)(...args); }
  catch (e) { console.error(e); app.innerHTML = `<div class="card">Something went wrong: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);
sb.auth.onAuthStateChange(evt => { if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') { profile = null; route(); } });

// ---------- auth ----------
function renderAuth(mode = 'signin') {
  setHeader('Woodhouse Lifts');
  app.innerHTML = `
    <div class="card"><h3>${mode === 'signin' ? 'Sign in' : 'Create account'}</h3>
      <form id="f">
        ${mode === 'signup' ? '<label>Name</label><input name="name" autocomplete="given-name" required>' : ''}
        <label>Email</label><input name="email" type="email" autocomplete="email" required>
        <label>Password</label><input name="password" type="password" minlength="8" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required>
        <div class="spacer"></div><button class="primary block" type="submit">${mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form><div class="spacer"></div>
      <button class="ghost block" id="swap">${mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
    </div>`;
  $('#swap').onclick = () => renderAuth(mode === 'signin' ? 'signup' : 'signin');
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const btn = e.target.querySelector('button'); btn.disabled = true;
    const email = fd.get('email').trim(), password = fd.get('password');
    if (mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) toast(error.message, true);
    } else {
      const { data, error } = await sb.auth.signUp({ email, password,
        options: { data: { display_name: fd.get('name').trim() }, emailRedirectTo: location.origin + location.pathname } });
      if (error) toast(error.message, true);
      else if (!data.session) app.innerHTML = `<div class="card"><h3>Check your email</h3><p class="muted">Tap the confirmation link sent to ${esc(email)}, then come back and sign in.</p></div>`;
    }
    btn.disabled = false;
  };
}

// ---------- shared queries ----------
async function activeMeso() {
  const m = check(await sb.from('mesocycles').select('*').in('status', ['active', 'planned']).order('created_at', { ascending: false }).limit(1));
  return m[0] || null;
}
async function mesoDays(mesoId) {
  return check(await sb.from('workout_days').select('id, week, day_index, label, started_at, completed_at, skipped_at, mesocycle_id')
    .eq('mesocycle_id', mesoId).order('week').order('day_index'));
}
const openDays = days => days.filter(d => !d.completed_at && !d.skipped_at);
async function cardioSince(fromIso) {
  return check(await sb.from('cardio_sessions').select('*').gte('performed_on', fromIso).order('performed_on', { ascending: false }));
}

// ---------- shared analytics ----------
async function workoutCardioSince(fromIso) {
  return check(await sb.from('sets').select('duration_min, rpe, completed_at, workout_exercises!inner(exercises!inner(name, load_type))')
    .not('duration_min', 'is', null).not('completed_at', 'is', null).gte('completed_at', fromIso));
}
const cardioItems = (sessions, wsets) => [
  ...sessions.map(c => ({ date: c.performed_on, minutes: Number(c.minutes), rpe: c.rpe, name: c.activity })),
  ...wsets.map(s => ({ date: s.completed_at.slice(0, 10), minutes: Number(s.duration_min), rpe: s.rpe ?? 0, name: s.workout_exercises.exercises.name })),
];
async function slipFor(meso) {
  const rows = check(await sb.from('workout_exercises')
    .select('exercise_id, target_sets, target_rir, exercises(name, muscle_group, load_type), sets(weight, reps, rir, completed_at), workout_days!inner(id, week, day_index, completed_at, mesocycle_id)')
    .eq('workout_days.mesocycle_id', meso.id));
  const groups = {};
  for (const r of rows) {
    const d = r.workout_days; if (!d.completed_at || r.exercises.load_type === 'cardio') continue;
    if (L.rirForWeek(d.week, meso.weeks).deload) continue;
    const k = d.day_index + ':' + r.exercise_id;
    (groups[k] = groups[k] || { name: r.exercises.name, muscle: r.exercises.muscle_group, weeks: [] }).weeks.push({
      week: d.week, targetSets: r.target_sets, ex: r.exercises,
      sets: r.sets.filter(s => s.completed_at).map(s => ({ ...s, rir: s.rir ?? r.target_rir })) });
  }
  Object.values(groups).forEach(g => g.weeks.sort((a, b) => a.week - b.week));
  const fb = check(await sb.from('muscle_feedback').select('muscle_group, soreness, workload, joint_pain, workout_days!inner(week, day_index, mesocycle_id)')
    .eq('workout_days.mesocycle_id', meso.id))
    .map(f => ({ muscle: f.muscle_group, week: f.workout_days.week, day: f.workout_days.day_index, soreness: f.soreness, workload: f.workload, joint_pain: f.joint_pain }))
    .sort((a, b) => a.week * 100 + a.day - (b.week * 100 + b.day));
  return L.slipWarnings({ exercises: Object.values(groups), feedback: fb, bodyweight: profile?.bodyweight });
}
const warnList = (ws, max = 99) => `<ul class="warn-list">${ws.slice(0, max).map(w => `<li><span class="dot ${w.level}"></span><span>${esc(w.msg)}</span></li>`).join('')}</ul>`;

// ---------- home (dashboard) ----------
async function renderHome() {
  setHeader('Woodhouse Lifts', null, 'home');
  const meso = await activeMeso();
  const days = meso ? await mesoDays(meso.id) : [];
  const live = days.find(d => d.started_at && !d.completed_at && !d.skipped_at);
  const next = openDays(days)[0];
  const curWeek = next?.week || (days.length ? days[days.length - 1].week : null);
  const wk = days.filter(d => d.week === curWeek);
  const r = meso && curWeek ? L.rirForWeek(curWeek, meso.weeks) : null;
  const ws = weekStart(); const eightAgo = new Date(ws); eightAgo.setDate(eightAgo.getDate() - 7 * 7);
  const [cSess, cSets, allSets, warnings, mesoCount] = await Promise.all([
    cardioSince(isoDay(eightAgo)), workoutCardioSince(eightAgo.toISOString()),
    sb.from('sets').select('weight, reps, rir, completed_at, workout_exercises!inner(id, exercise_id, target_rir, exercises(id, name, muscle_group, load_type))')
      .not('completed_at', 'is', null).is('duration_min', null).order('completed_at').limit(10000).then(check),
    meso ? slipFor(meso) : Promise.resolve([]),
    sb.from('mesocycles').select('id', { count: 'exact', head: true }).then(x => x.count || 0),
  ]);
  const bw = profile?.bodyweight;
  const cardio = cardioItems(cSess, cSets);
  const inWeek = (dstr, s) => { const d = new Date(dstr + 'T12:00'); const e = new Date(s); e.setDate(e.getDate() + 7); return d >= s && d < e; };
  const thisCardio = cardio.filter(c => inWeek(c.date, ws));
  const cMin = thisCardio.reduce((a, c) => a + c.minutes, 0), cLoad = thisCardio.reduce((a, c) => a + L.cardioLoad(c), 0);
  // Weekly hard sets (8 weeks) + this week's sets.
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = new Date(ws); s.setDate(s.getDate() - (7 - i) * 7); return s; });
  const lift = allSets.filter(s => s.workout_exercises.exercises.load_type !== 'cardio');
  const setsPerWeek = weeks.map(s => lift.filter(x => inWeek(x.completed_at.slice(0, 10), s)).length);
  const cardioPerWeek = weeks.map(s => cardio.filter(c => inWeek(c.date, s)).reduce((a, c) => a + c.minutes, 0));
  // Strength movers & PRs by exercise (best e1RM per session).
  const byEx = {};
  for (const x of lift) {
    const ex = x.workout_exercises.exercises, sid = x.workout_exercises.id;
    const e = byEx[ex.id] = byEx[ex.id] || { ex, sessions: new Map() };
    const s = e.sessions.get(sid) || { date: x.completed_at, sets: [] };
    s.sets.push({ ...x, rir: x.rir ?? x.workout_exercises.target_rir }); e.sessions.set(sid, s);
  }
  const twoWeeksAgo = Date.now() - 14 * 864e5, eightWeeksAgo = Date.now() - 56 * 864e5;
  const prs = [], movers = [];
  for (const { ex, sessions } of Object.values(byEx)) {
    const ss = [...sessions.values()].map(s => ({ date: s.date, e: L.bestE1rm(s.sets, ex, bw) })).filter(s => s.e).sort((a, b) => a.date.localeCompare(b.date));
    if (ss.length < 2) continue;
    const last = ss[ss.length - 1], prevBest = Math.max(...ss.slice(0, -1).map(s => s.e));
    if (new Date(last.date) > twoWeeksAgo && last.e > prevBest) prs.push({ name: ex.name, pct: (last.e - prevBest) / prevBest * 100, date: last.date });
    const base = ss.find(s => new Date(s.date) > eightWeeksAgo) || ss[0];
    if (base !== last) movers.push({ name: ex.name, pct: (last.e - base.e) / base.e * 100 });
  }
  movers.sort((a, b) => b.pct - a.pct);
  const totalWorkouts = new Set(allSets.map(x => x.completed_at.slice(0, 10))).size;
  const doneDays = days.filter(d => d.completed_at || d.skipped_at).length;
  const maxSets = Math.max(1, ...setsPerWeek), maxC = Math.max(1, ...cardioPerWeek);
  const bars = (vals, max, color) => `<svg class="chart" viewBox="0 0 320 110" style="height:110px">${vals.map((v, i) => { const h = Math.round(v / max * 88);
    return `<rect x="${i * 40 + 6}" y="${92 - h}" width="28" height="${h}" rx="4" fill="${i === 7 ? color : '#3a4150'}"></rect>
      <text x="${i * 40 + 20}" y="${88 - h}" font-size="9" fill="#8b93a3" text-anchor="middle">${v ? Math.round(v) : ''}</text>
      <text x="${i * 40 + 20}" y="106" font-size="8" fill="#8b93a3" text-anchor="middle">${weeks[i].getMonth() + 1}/${weeks[i].getDate()}</text>`; }).join('')}</svg>`;

  app.innerHTML = `
    <div class="muted small">Hi ${esc(profile?.display_name || '')} 👋</div><div class="spacer"></div>
    ${live ? `<div class="card warn"><div class="small">Workout in progress</div><h3>Week ${live.week} · ${esc(dayName(live))}</h3>
        <div class="spacer"></div><button class="primary block" data-go="#/workout">Resume workout</button></div>`
      : next ? `<div class="card"><div class="muted small">Next workout · ${esc(meso.name)}</div>
        <h3>Week ${next.week} · ${esc(dayName(next))}</h3>
        <div class="muted small">${r.deload ? 'Deload week — half sets, easy effort' : `Target ${r.rir} RIR this week`}</div>
        <div class="spacer"></div><button class="primary block" data-go="#/workout">Start workout</button></div>`
      : `<div class="card"><h3>${meso ? 'Mesocycle finished 🎉' : 'No active mesocycle'}</h3>
        <p class="muted">Start from a base template or one of your saved ones.</p>
        <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">Templates</button></div></div>`}
    ${warnings.length ? `<div class="card warn"><div class="row"><b class="grow">Watch list</b><span class="pill warn">${warnings.length}</span></div>
        ${warnList(warnings, 4)}${warnings.length > 4 ? `<button class="ghost sm" data-go="#/meso/${meso.id}">See all ${warnings.length}</button>` : ''}</div>`
      : meso && doneDays ? '<div class="card good small">✓ No slip signals — reps, sets and recovery are on track.</div>' : ''}
    ${meso ? `<div class="card"><div class="row"><div class="grow"><div class="muted small">Mesocycle</div><b>${esc(meso.name)}</b></div>
        <span class="pill ${r?.deload ? 'warn' : 'on'}">${r ? (r.deload ? 'Deload' : `Wk ${curWeek} · ${r.rir} RIR`) : ''}</span></div>
        <div class="prog"><i style="width:${Math.round(doneDays / Math.max(1, days.length) * 100)}%"></i></div>
        <div class="muted tiny" style="margin-top:4px">${doneDays}/${days.length} workouts · week ${curWeek} of ${meso.weeks}</div></div>` : ''}
    <div class="grid2">
      <div class="card stat"><span class="muted small">Workouts this week</span><span class="big">${wk.filter(d => d.completed_at).length}/${wk.length || 0}</span></div>
      <div class="card stat"><span class="muted small">Sets this week</span><span class="big">${setsPerWeek[7]}</span></div>
      <div class="card stat"><span class="muted small">Cardio this week</span><span class="big">${fmt(cMin)}<span class="muted small"> min</span></span><span class="muted tiny">load ${fmt(cLoad)}</span></div>
      <div class="card stat"><span class="muted small">PRs (14 days)</span><span class="big">${prs.length}</span></div>
    </div>
    <div class="card"><b>Hard sets per week</b>${bars(setsPerWeek, maxSets, 'var(--accent)')}</div>
    <div class="card"><b>Cardio minutes per week</b> <span class="muted tiny">sessions + in-workout</span>${bars(cardioPerWeek, maxC, 'var(--info)')}</div>
    ${prs.length ? `<div class="card"><b>Recent PRs 🏆</b>${prs.sort((a, b) => b.pct - a.pct).slice(0, 5).map(p => `<div class="mover"><span>${esc(p.name)}</span><span class="pill on">+${p.pct.toFixed(1)}%</span></div>`).join('')}</div>` : ''}
    ${movers.length ? `<div class="card"><b>Strength trend · last 8 weeks</b>
        ${[...movers.slice(0, 3), ...movers.slice(-2).filter(m => m.pct < 0 && !movers.slice(0, 3).includes(m))].map(m => `<div class="mover"><span>${esc(m.name)}</span>
          <span class="pill ${m.pct > 0 ? 'on' : m.pct < 0 ? 'bad' : ''}">${m.pct > 0 ? '+' : ''}${m.pct.toFixed(1)}%</span></div>`).join('')}
        <button class="ghost sm" data-go="#/progress">All exercises ›</button></div>` : ''}
    <div class="grid3 keep">
      <div class="card stat center"><span class="big">${totalWorkouts}</span><span class="muted tiny">workouts</span></div>
      <div class="card stat center"><span class="big">${lift.length}</span><span class="muted tiny">sets logged</span></div>
      <div class="card stat center"><span class="big">${mesoCount}</span><span class="muted tiny">mesocycles</span></div>
    </div>
    <h2>Quick actions</h2>
    <div class="grid2">
      <button class="tile" data-go="#/cardio"><span class="ico">♥︎</span><b>Log cardio</b><span class="muted small">Time + intensity</span></button>
      <button class="tile" data-go="#/volume"><span class="ico">📊</span><b>Volume</b><span class="muted small">Sets per muscle</span></button>
    </div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

// ---------- mesocycles ----------
async function renderMesos() {
  setHeader('Mesocycles', null, 'mesos');
  const mesos = check(await sb.from('mesocycles').select('*').order('created_at', { ascending: false }));
  const by = s => mesos.filter(m => s.includes(m.status));
  const item = m => `<button class="list-btn" data-meso="${m.id}"><div class="grow"><b>${esc(m.name)}</b>
      <div class="muted small">${m.source === 'rp_import' ? 'RP import · ' : ''}${esc(L.TEMPLATES[m.focus]?.name || '')} · ${m.weeks} wks · ${m.days_per_week} days/wk</div></div>
      <span class="pill ${m.status === 'active' ? 'on' : ''}">${esc(m.status)}</span></button>`;
  app.innerHTML = `<div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">From a template</button></div>
    ${by(['active', 'planned']).length ? '<h2>Current</h2>' + by(['active', 'planned']).map(item).join('') : ''}
    <h2>Past</h2>${by(['completed', 'abandoned']).map(item).join('') || '<p class="muted">None yet.</p>'}`;
  $$('[data-meso]').forEach(b => b.onclick = () => go('#/meso/' + b.dataset.meso));
  $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') builder = null; go(b.dataset.go); });
}

// ---------- mesocycle builder ----------
let builder = null;
function freshBuilder() {
  return { step: 1, name: '', weeks: 5, days: 4, focus: 'whole', priorities: L.templatePriorities('whole'), plan: [] };
}
function builderFromTemplate(t) {
  return { step: 2, name: t.name.replace(/ \(from .*\)$/, ''), weeks: t.weeks, days: t.days_per_week, focus: t.focus,
    priorities: Object.keys(t.priorities || {}).length ? t.priorities : L.templatePriorities(t.focus),
    plan: t.plan.map(d => ({ label: d.label, slots: d.slots.map(x => ({ ...x })) })) };
}
async function renderBuilder() {
  setHeader('New mesocycle', '#/mesos', 'mesos');
  const lib = await loadExercises();
  if (!builder) builder = freshBuilder();
  const S = builder;
  const syncPlan = () => {
    while (S.plan.length < S.days) S.plan.push({ label: 'Day ' + (S.plan.length + 1), slots: [] });
    S.plan.length = S.days;
  };
  const exById = new Map(lib.map(e => [e.id, e]));
  const exOptions = (muscle, sel) => `<option value="">— pick —</option>` +
    L.candidatesFor(muscle, lib).map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('');

  const step1 = () => {
    app.innerHTML = `
      <div class="card"><div class="muted small">Step 1 of 2 · Base template</div>
        <div class="spacer"></div>
        ${Object.entries(L.TEMPLATES).map(([k, t]) => `<button class="list-btn" data-focus="${k}" style="${S.focus === k ? 'border-color:var(--accent)' : ''}">
          <div class="grow"><b>${t.name}</b><div class="muted small">${t.blurb}</div></div>${S.focus === k ? '<span class="pill on">✓</span>' : ''}</button>`).join('')}
      </div>
      <div class="card">
        <label>Name</label><input id="name" value="${esc(S.name)}" placeholder="e.g. Whole Body AC VI">
        <div class="row"><div class="grow"><label>Weeks (last is deload)</label>
          <select id="weeks">${[3, 4, 5, 6, 7, 8].map(n => `<option ${n === S.weeks ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="grow"><label>Training days / week</label>
          <select id="days">${[2, 3, 4, 5, 6].map(n => `<option ${n === S.days ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <p class="muted small">RIR is set for you: ${Array.from({ length: S.weeks }, (_, i) => { const r = L.rirForWeek(i + 1, S.weeks); return r.deload ? 'deload' : r.rir; }).join(' → ')}. It holds steady for any muscle whose feedback says recovery is behind.</p>
      </div>
      <div class="card"><b>Muscle priorities</b><div class="muted small">Focus = grow (≥2×/week). Maintain = hold size with low volume. Weekly start sets shown.</div>
        ${L.MUSCLES.map(m => `<div class="prio"><div>${m} <span class="muted small">${L.weeklyTarget(m, S.priorities[m], S.focus)} sets</span></div>
          <div class="seg c3">${L.PRIORITIES.map(p => `<button type="button" data-m="${m}" data-p="${p}" class="${S.priorities[m] === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>`).join('')}
      </div>
      <button class="primary block" id="next">Next: build the days ›</button>`;
    $$('[data-focus]').forEach(b => b.onclick = () => { S.focus = b.dataset.focus; S.priorities = L.templatePriorities(S.focus); step1(); });
    $('#name').oninput = e => S.name = e.target.value;
    $('#weeks').onchange = e => { S.weeks = +e.target.value; step1(); };
    $('#days').onchange = e => { S.days = +e.target.value; };
    $$('[data-p]').forEach(b => b.onclick = () => {
      S.priorities[b.dataset.m] = b.dataset.p;
      step1();
    });
    $('#next').onclick = () => {
      if (!S.name.trim()) return toast('Give it a name', true);
      S.days = +$('#days').value; syncPlan(); S.step = 2;
      if (!S.plan.some(d => d.slots.length)) S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, library: lib, mode: 'all' });
      step2();
    };
  };

  const step2 = () => {
    const targets = L.weeklyTargets(S.priorities, S.focus), placed = L.placedSets(S.plan);
    const dayTotals = S.plan.map(d => d.slots.reduce((a, s) => a + (Number(s.sets) || 0), 0));
    app.innerHTML = `
      <div class="card"><div class="muted small">Step 2 of 2 · ${esc(L.TEMPLATES[S.focus].name)} · ${S.days} days</div>
        <div class="spacer"></div>
        <div class="grid3">
          <button class="sm primary" id="fillAll">Autofill all</button>
          <button class="sm" id="fillLeft">Fill what's left</button>
          <button class="sm" id="clear">Clear (manual)</button>
        </div>
        <h2>Weekly sets: placed / target</h2>
        <div class="chips">${L.MUSCLES.filter(m => targets[m] || placed[m]).map(m => {
          const p = placed[m], t = targets[m]; const cls = p < t ? 'under' : p > t * 1.25 + 1 ? 'over' : 'ok';
          return `<span class="chip ${cls}">${m} ${p}/${t}</span>`; }).join('')}</div>
      </div>
      ${S.plan.map((d, di) => `<div class="card">
        <div class="row"><input data-label="${di}" value="${esc(d.label)}" style="flex:1">
          <span class="pill ${dayTotals[di] > 25 ? 'warn' : ''}">${dayTotals[di]} sets</span></div>
        ${dayTotals[di] > 25 ? '<div class="muted small" style="color:var(--warn);margin-top:6px">Over ~25 sets — consider another training day or moving a muscle to Maintain.</div>' : ''}
        ${d.slots.map((s, si) => `<div class="slot">
          <select data-sm="${di}.${si}">${[...L.MUSCLES, 'Cardio'].map(m => `<option ${m === s.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select data-se="${di}.${si}">${exOptions(s.muscle, s.exerciseId)}</select>
          <input type="number" inputmode="numeric" min="1" max="10" value="${s.sets}" data-ss="${di}.${si}">
          <button class="ghost danger sm" data-rm="${di}.${si}">✕</button></div>`).join('')}
        <div class="spacer"></div><button class="sm block" data-add="${di}">+ Add exercise slot</button>
      </div>`).join('')}
      <div class="row"><button id="back1" class="grow">‹ Template</button><button class="primary grow" id="create">Create mesocycle</button></div>
      <div class="spacer"></div><button class="ghost block" id="saveTpl">☆ Save this plan as a template</button>`;
    const at = s => s.split('.').map(Number);
    $('#fillAll').onclick = () => { S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, library: lib, mode: 'all' }); step2(); };
    $('#fillLeft').onclick = () => { S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, library: lib, mode: 'fill' }); step2(); };
    $('#clear').onclick = () => { S.plan = S.plan.map(d => ({ label: d.label, slots: [] })); step2(); };
    $('#back1').onclick = () => { S.step = 1; step1(); };
    $$('[data-label]').forEach(i => i.oninput = e => S.plan[+i.dataset.label].label = e.target.value);
    $$('[data-sm]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.sm); S.plan[d].slots[x].muscle = e.target.value; S.plan[d].slots[x].exerciseId = null; step2(); });
    $$('[data-se]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.se); S.plan[d].slots[x].exerciseId = e.target.value || null; });
    $$('[data-ss]').forEach(s => s.onchange = e => { const [d, x] = at(s.dataset.ss); S.plan[d].slots[x].sets = Math.max(1, Math.min(10, +e.target.value || 1)); step2(); });
    $$('[data-rm]').forEach(b => b.onclick = () => { const [d, x] = at(b.dataset.rm); S.plan[d].slots.splice(x, 1); step2(); });
    $$('[data-add]').forEach(b => b.onclick = () => {
      const t = L.weeklyTargets(S.priorities, S.focus), p = L.placedSets(S.plan);
      const m = L.MUSCLES.find(x => p[x] < t[x]) || 'Chest';
      S.plan[+b.dataset.add].slots.push({ muscle: m, exerciseId: null, sets: 3 }); step2();
    });
    $('#create').onclick = create;
    $('#saveTpl').onclick = async () => {
      if (S.plan.some(d => d.slots.some(s => !s.exerciseId))) return toast('Pick an exercise for every slot first', true);
      const name = prompt('Template name', S.name || 'My template'); if (!name) return;
      check(await sb.from('templates').insert({ name, focus: S.focus, priorities: S.priorities, weeks: S.weeks, days_per_week: S.days, plan: S.plan }));
      toast('Template saved');
    };
  };

  async function create() {
    if (S.plan.some(d => !d.slots.length)) return toast('Every day needs at least one exercise', true);
    if (S.plan.some(d => d.slots.some(s => !s.exerciseId))) return toast('Pick an exercise for every slot (or tap Fill what\'s left)', true);
    $('#create').disabled = true;
    try {
      const meso = check(await sb.from('mesocycles').insert({ name: S.name.trim(), weeks: S.weeks, days_per_week: S.days,
        focus: S.focus, priorities: S.priorities, started_on: today() }).select().single());
      const rows = [];
      for (let w = 1; w <= S.weeks; w++) S.plan.forEach((d, i) => rows.push({ mesocycle_id: meso.id, week: w, day_index: i + 1, label: d.label }));
      const days = check(await sb.from('workout_days').insert(rows).select('id, week, day_index'));
      const exRows = [];
      for (const d of days) {
        const { rir, deload } = L.rirForWeek(d.week, S.weeks);
        S.plan[d.day_index - 1].slots.forEach((s, pos) => exRows.push({ workout_day_id: d.id, exercise_id: s.exerciseId, position: pos + 1,
          target_sets: deload ? L.deloadSets(s.sets) : Number(s.sets), target_rir: rir }));
      }
      check(await sb.from('workout_exercises').insert(exRows));
      builder = null; toast('Mesocycle created'); go('#/meso/' + meso.id);
    } catch { $('#create').disabled = false; }
  }
  S.step === 2 ? (syncPlan(), step2()) : step1();
}

// ---------- mesocycle detail ----------
async function renderMeso(id) {
  const meso = check(await sb.from('mesocycles').select('*').eq('id', id).single());
  setHeader(meso.name, '#/mesos', 'mesos');
  const [days, warnings] = await Promise.all([mesoDays(id), slipFor(meso)]);
  const next = openDays(days)[0];
  const weeks = [...new Set(days.map(d => d.week))];
  app.innerHTML = `
    <div class="card"><div class="row"><div class="grow muted small">${meso.source === 'rp_import' ? 'Imported from RP · ' : ''}${esc(L.TEMPLATES[meso.focus]?.name || '')} · ${meso.weeks} weeks · ${meso.days_per_week} days/week</div>
      <span class="pill ${meso.status === 'active' ? 'on' : ''}">${esc(meso.status)}</span></div></div>
    ${warnings.length ? `<div class="card warn"><b>Watch list</b>${warnList(warnings)}</div>` : ''}
    <div class="weeks-scroll"><div class="weeks" style="--days:${meso.days_per_week}">
      ${weeks.map(w => { const r = L.rirForWeek(w, meso.weeks); return `<div class="week">
        <div class="muted small">Wk ${w}<br><span class="${r.deload ? 'pill warn' : 'tiny'}">${r.deload ? 'deload' : r.rir + ' RIR'}</span></div>
        ${days.filter(d => d.week === w).map(d => `<button class="day ${d.completed_at ? 'done' : ''} ${d.skipped_at ? 'skipped' : ''} ${d.started_at && !d.completed_at && !d.skipped_at ? 'live' : ''} ${next && d.id === next.id ? 'next' : ''}" data-day="${d.id}">${esc(dayName(d))}</button>`).join('')}
      </div>`; }).join('')}
    </div></div><div class="spacer"></div>
    ${next ? '<button class="primary block" id="go">Go to next workout</button>' : '<p class="muted center">All workouts done 🎉</p>'}
    <div class="spacer"></div>
    <div class="grid2"><button data-go="#/volume/${id}">📊 Volume</button><button data-go="#/history">🗂 History</button>
      <button id="again">↻ Run it again</button><button id="tpl">☆ Save as template</button></div>
    <div class="spacer"></div>
    <div class="row">${meso.status !== 'completed' ? '<button class="grow" id="complete">Mark complete</button>' : ''}<button class="grow danger" id="del">Delete</button></div>`;
  $$('[data-day]').forEach(b => b.onclick = () => go('#/workout/' + b.dataset.day));
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  if (next) $('#go').onclick = () => go('#/workout/' + next.id);
  const planFromMeso = async () => {
    const d1 = days.filter(d => d.week === 1);
    const wes = check(await sb.from('workout_exercises').select('workout_day_id, exercise_id, target_sets, position, exercises(muscle_group, name)')
      .in('workout_day_id', d1.map(d => d.id)).order('position'));
    return d1.map(d => ({ label: d.label, slots: wes.filter(w => w.workout_day_id === d.id)
      .map(w => ({ muscle: w.exercises.muscle_group, exerciseId: w.exercise_id, sets: Math.max(1, w.target_sets) })) }));
  };
  $('#again').onclick = async () => {
    builder = builderFromTemplate({ name: meso.name + ' (again)', weeks: meso.weeks, days_per_week: meso.days_per_week, focus: meso.focus, priorities: meso.priorities, plan: await planFromMeso() });
    go('#/new');
  };
  $('#tpl').onclick = async () => {
    const name = prompt('Template name', meso.name); if (!name) return;
    check(await sb.from('templates').insert({ name, focus: meso.focus, priorities: meso.priorities, weeks: meso.weeks, days_per_week: meso.days_per_week, plan: await planFromMeso() }));
    toast('Saved to Library › Templates');
  };
  const c = $('#complete'); if (c) c.onclick = async () => { check(await sb.from('mesocycles').update({ status: 'completed' }).eq('id', id)); renderMeso(id); };
  $('#del').onclick = async () => {
    if (!confirm('Delete this mesocycle and every workout, set and rating in it? This can’t be undone.')) return;
    check(await sb.from('mesocycles').delete().eq('id', id)); go('#/mesos');
  };
}

// ---------- recovery follow-ups (doc §3, §5) ----------
async function pendingRecovery(day, muscles) {
  if (!muscles.length) return [];
  const rows = check(await sb.from('muscle_feedback')
    .select('*, workout_days!inner(id, week, day_index, label, mesocycle_id, completed_at)')
    .eq('workout_days.mesocycle_id', day.mesocycle_id).is('soreness', null).in('muscle_group', muscles));
  const best = {};
  for (const r of rows) {
    const src = r.workout_days;
    if (!src.completed_at || order(src) >= order(day) || src.id === day.id) continue;
    if (!best[r.muscle_group] || order(src) > order(best[r.muscle_group].workout_days)) best[r.muscle_group] = r;
  }
  return Object.values(best);
}

async function applyAdjustment(fb, R, meso) {
  const src = fb.workout_days;
  const update = { soreness: R, recovery_at: new Date().toISOString() };
  const srcDeload = L.rirForWeek(src.week, meso.weeks).deload;
  const target = !srcDeload && check(await sb.from('workout_days').select('id, week, completed_at')
    .eq('mesocycle_id', meso.id).eq('week', src.week + 1).eq('day_index', src.day_index).maybeSingle());
  if (fb.muscle_group !== 'Cardio' && target && !target.completed_at && !L.rirForWeek(target.week, meso.weeks).deload && !fb.adjusted) {
    const adj = L.setAdjustment({ R, L: fb.workload, J: fb.joint_pain, P: fb.pump, F: fb.performance });
    const weekWes = check(await sb.from('workout_exercises').select('id, workout_day_id, exercise_id, target_sets, target_rir, position, exercises!inner(muscle_group), workout_days!inner(week, mesocycle_id)')
      .eq('workout_days.mesocycle_id', meso.id).eq('workout_days.week', target.week).eq('exercises.muscle_group', fb.muscle_group));
    const sess = weekWes.filter(w => w.workout_day_id === target.id).sort((a, b) => a.position - b.position);
    const changes = L.distributeDelta(sess, adj.delta, {
      sessionTotal: sess.reduce((a, w) => a + w.target_sets, 0), weeklyTotal: weekWes.reduce((a, w) => a + w.target_sets, 0) });
    for (const c of changes) check(await sb.from('workout_exercises').update({ target_sets: c.target_sets }).eq('id', c.id));
    const srcWes = check(await sb.from('workout_exercises').select('target_rir, exercises!inner(muscle_group)').eq('workout_day_id', src.id).eq('exercises.muscle_group', fb.muscle_group));
    const srcRir = srcWes[0]?.target_rir;
    for (const w of sess) {
      const patch = { flag: adj.flag || null };
      if (adj.holdRir && srcRir != null && srcRir > w.target_rir) patch.target_rir = srcRir;
      check(await sb.from('workout_exercises').update(patch).eq('id', w.id));
    }
    // Deload volume follows the last accumulation week (doc §1.8).
    if (target.week === meso.weeks - 1 && meso.weeks >= 3) {
      const dl = check(await sb.from('workout_days').select('id').eq('mesocycle_id', meso.id).eq('week', meso.weeks).eq('day_index', src.day_index).maybeSingle());
      if (dl) for (const w of sess) {
        const sets = changes.find(c => c.id === w.id)?.target_sets ?? w.target_sets;
        check(await sb.from('workout_exercises').update({ target_sets: L.deloadSets(sets) }).eq('workout_day_id', dl.id).eq('exercise_id', w.exercise_id));
      }
    }
    update.adjusted = true;
    const msg = adj.delta > 0 ? `+${adj.delta} set${adj.delta > 1 ? 's' : ''}` : adj.delta < 0 ? `${adj.delta} set` : 'sets held';
    toast(`${fb.muscle_group}: ${changes.length || adj.delta === 0 ? msg : 'at cap, held'} next week${adj.holdRir ? ', RIR held' : ''}`);
  }
  check(await sb.from('muscle_feedback').update(update).eq('id', fb.id));
}

// ---------- workout logger ----------
async function renderWorkout(dayId) {
  if (!dayId) {
    setHeader('Workout', null, 'workout');
    const m = await activeMeso(); const ds = m ? await mesoDays(m.id) : [];
    const cur = ds.find(d => d.started_at && !d.completed_at && !d.skipped_at) || openDays(ds)[0];
    if (cur) return renderWorkout(cur.id);
    app.innerHTML = `<div class="card"><h3>No workout queued</h3><p class="muted">${m ? 'This mesocycle is finished.' : 'Start a mesocycle to get your next workout here.'}</p>
      <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">Templates</button></div></div>
      <button class="list-btn" data-go="#/cardio"><span>♥︎</span><div class="grow"><b>Just cardio today?</b><div class="muted small">Log time and intensity</div></div>›</button>`;
    return $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') builder = null; go(b.dataset.go); });
  }
  const day = check(await sb.from('workout_days').select('*, mesocycles(*)').eq('id', dayId).single());
  const meso = day.mesocycles;
  setHeader(`Wk ${day.week} · ${dayName(day)}`, '#/meso/' + meso.id, 'workout');
  const all = await mesoDays(meso.id);

  // Guards (in progress elsewhere / earlier day not done).
  if (!day.completed_at && !day.skipped_at) {
    const live = all.find(d => d.started_at && !d.completed_at && !d.skipped_at && d.id !== day.id);
    const earlier = all.filter(d => order(d) < order(day) && !d.completed_at && !d.skipped_at);
    if (live) {
      app.innerHTML = `<div class="card warn"><h3>Workout in progress</h3>
        <p class="small">Week ${live.week} · ${esc(dayName(live))} is still open. Finish it (or skip it) before starting another day.</p>
        <button class="primary block" data-go="#/workout/${live.id}">Resume Week ${live.week} · ${esc(dayName(live))}</button></div>`;
      $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); return;
    }
    if (earlier.length) {
      const e = earlier[0];
      app.innerHTML = `<div class="card warn"><h3>You haven't reached this day yet</h3>
        <p class="small">Week ${e.week} · ${esc(dayName(e))} comes first${earlier.length > 1 ? ` (and ${earlier.length - 1} more)` : ''}. Log it or skip it to move on.</p>
        <div class="grid2"><button class="primary" data-go="#/workout/${e.id}">Go to it</button><button id="skip">Skip it</button></div></div>`;
      $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
      $('#skip').onclick = async () => {
        if (!confirm(`Skip Week ${e.week} · ${dayName(e)}? You can still open it later.`)) return;
        check(await sb.from('workout_days').update({ skipped_at: new Date().toISOString() }).eq('id', e.id));
        renderWorkout(dayId);
      }; return;
    }
  }

  const wes = check(await sb.from('workout_exercises').select('*, exercises(*), sets(*)').eq('workout_day_id', dayId).order('position'));
  wes.forEach(w => w.sets.sort((a, b) => a.set_index - b.set_index));
  const isCardio = w => w.exercises.load_type === 'cardio';
  const muscles = [...new Set(wes.filter(w => !isCardio(w)).map(w => w.exercises.muscle_group))];
  const groups = wes.some(isCardio) ? [...muscles, 'Cardio'] : muscles; // everything that gets rated
  const { deload } = L.rirForWeek(day.week, meso.weeks);

  // Recovery questions about last time come first (asked before you start).
  if (!day.completed_at) {
    const pending = await pendingRecovery(day, groups);
    if (pending.length) return renderRecoveryGate(day, meso, pending);
  }

  // Last week's same session → auto-matched weights and rep targets.
  const prev = {}; let prevFb = {};
  if (day.week > 1) {
    const pd = check(await sb.from('workout_days').select('id').eq('mesocycle_id', meso.id).eq('week', day.week - 1).eq('day_index', day.day_index).maybeSingle());
    if (pd) {
      check(await sb.from('workout_exercises').select('exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe)').eq('workout_day_id', pd.id))
        .forEach(x => prev[x.exercise_id] = { rir: x.target_rir, sets: x.sets.sort((a, b) => a.set_index - b.set_index) });
      check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', pd.id)).forEach(f => prevFb[f.muscle_group] = f);
    }
  } else {
    // Week 1 carries over from your last finished mesocycle: its final working week for the same exercise.
    const ids = [...new Set(wes.map(w => w.exercise_id))];
    const hist = ids.length ? check(await sb.from('workout_exercises')
      .select('exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe), workout_days!inner(week, completed_at, mesocycle_id, mesocycles(weeks))')
      .in('exercise_id', ids).neq('workout_days.mesocycle_id', meso.id).not('workout_days.completed_at', 'is', null)) : [];
    for (const h of hist) {
      const d = h.workout_days; if (!h.sets.length || L.rirForWeek(d.week, d.mesocycles?.weeks || 99).deload) continue;
      const cur = prev[h.exercise_id];
      if (!cur || d.completed_at > cur.at) prev[h.exercise_id] = { rir: h.target_rir, at: d.completed_at, carried: true, sets: h.sets.sort((a, b) => a.set_index - b.set_index) };
    }
  }
  const feedback = {};
  check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', dayId)).forEach(f => feedback[f.muscle_group] = f);
  if (!day.started_at && !day.completed_at) {
    await sb.from('workout_days').update({ started_at: new Date().toISOString() }).eq('id', dayId);
    if (meso.status === 'planned') await sb.from('mesocycles').update({ status: 'active' }).eq('id', meso.id);
  }

  const wLabel = ex => ex.load_type === 'bodyweight' ? `+${unit()}` : ex.load_type === 'assisted' ? `assist ${unit()}` : unit();
  const suggestionFor = (we, i) => {
    const p = prev[we.exercise_id]; if (!p?.sets.length) return null;
    const base = p.sets[i] || p.sets[p.sets.length - 1];
    return L.suggestSet({ prev: base, ex: we.exercises, targetRir: we.target_rir, prevTargetRir: p.rir, deload,
      jointHold: (prevFb[we.exercises.muscle_group]?.joint_pain ?? 0) >= 2, unit: unit() });
  };
  const lastOfMuscle = {}; wes.filter(w => !isCardio(w)).forEach(w => lastOfMuscle[w.exercises.muscle_group] = w.id);
  const todayWarn = day.completed_at ? [] : (await slipFor(meso)).filter(w => !w.muscle || muscles.includes(w.muscle));
  const cardioCard = we => {
    const n = Math.max(we.sets.length, we.target_sets || 0, 1);
    return `<div class="card" data-we="${we.id}" data-muscle="Cardio">
      <div class="row"><div class="grow"><h3>♥︎ ${esc(we.exercises.name)} <span class="trend" data-trend="${we.id}"></span></h3>
        <div class="muted small">Cardio · minutes + intensity (RPE 0 easy → 10 max)</div></div>
        <button class="ghost sm" data-edit="Cardio" aria-label="Edit ratings" title="Edit ratings">✎</button></div>
      <div class="sets"><div class="set-head"><div>#</div><div>min</div><div>RPE</div><div></div></div>
        ${Array.from({ length: n }, (_, i) => { const s = we.sets.find(x => x.set_index === i + 1) || {};
          return `<div class="set ${s.completed_at ? 'done' : ''}" data-idx="${i + 1}"><div class="n">${i + 1}</div>
            <input type="number" inputmode="decimal" step="any" data-f="duration" value="${s.duration_min ?? ''}" placeholder="min">
            <input type="number" inputmode="numeric" min="0" max="10" data-f="rpe" value="${s.rpe ?? ''}" placeholder="0–10">
            <button class="check">✓</button></div>`; }).join('')}
      </div>
      <div class="row" style="margin-top:8px"><button class="ghost sm" data-addset>+ bout</button><button class="ghost sm" data-rmset>− bout</button></div></div>`;
  };

  app.innerHTML = `
    ${day.completed_at ? '<div class="card good small">Finished ✓ — you can still edit sets and ratings.</div>' : ''}
    ${deload ? '<div class="card info small"><b>Deload week.</b> Same weights as last week, half the sets, stop well short of failure (≈4 RIR).</div>' : ''}
    ${todayWarn.length ? `<div class="card warn"><b>Heads up for today</b>${warnList(todayWarn, 5)}</div>` : ''}
    ${wes.map(we => {
      if (isCardio(we)) return cardioCard(we);
      const ex = we.exercises; const n = Math.max(we.sets.length, we.target_sets || 0, 1);
      const p = prev[we.exercise_id];
      return `<div class="card" data-we="${we.id}" data-muscle="${esc(ex.muscle_group)}">
        <div class="row"><div class="grow"><h3>${esc(ex.name)} <span class="trend" data-trend="${we.id}"></span></h3>
          <div class="muted small">${esc(ex.muscle_group)} · ${we.target_sets} sets · ${deload ? 'deload' : `${we.target_rir} RIR`} · ${ex.rep_min}–${ex.rep_max} reps</div></div>
          <button class="ghost sm" data-edit="${esc(ex.muscle_group)}" aria-label="Edit ratings" title="Edit ratings">✎</button></div>
        ${we.flag ? `<div class="pill bad" style="margin-top:6px">${esc(we.flag)}</div>` : ''}
        <div class="sets"><div class="set-head"><div>#</div><div>${wLabel(ex)}</div><div>reps</div><div></div></div>
          ${Array.from({ length: n }, (_, i) => {
            const s = we.sets.find(x => x.set_index === i + 1) || {}; const sg = suggestionFor(we, i);
            const wVal = s.weight ?? sg?.weight ?? (ex.load_type !== 'weighted' && s.reps == null ? '' : '');
            return `<div class="set ${s.completed_at ? 'done' : ''}" data-idx="${i + 1}">
              <div class="n">${i + 1}</div>
              <input type="number" inputmode="decimal" step="any" data-f="weight" value="${wVal ?? ''}" class="${s.weight == null && sg?.weight != null ? 'sug' : ''}" placeholder="${ex.load_type === 'weighted' ? unit() : '0'}">
              <input type="number" inputmode="numeric" data-f="reps" value="${s.reps ?? ''}" placeholder="${sg?.reps ?? ex.rep_min + '–' + ex.rep_max}" data-sug="${sg?.reps ?? ''}">
              <button class="check">✓</button></div>`;
          }).join('')}
        </div>
        <div class="row" style="margin-top:8px"><button class="ghost sm" data-addset>+ set</button><button class="ghost sm" data-rmset>− set</button>
          <span class="grow muted tiny right">${p?.sets.length ? (p.carried ? 'last meso: ' : 'last wk: ') + p.sets.map(s => `${fmt(s.weight)}×${s.reps ?? '–'}`).join(', ') : 'first week — pick weights for ' + (deload ? '' : `${we.target_rir} RIR`)}</span></div>
        ${lastOfMuscle[ex.muscle_group] === we.id ? `<div data-rate="${esc(ex.muscle_group)}" style="margin-top:8px">${rateLine(ex.muscle_group, feedback[ex.muscle_group])}</div>` : ''}
      </div>`;
    }).join('')}
    <button class="primary block" id="finish">${day.completed_at ? 'Done' : 'Finish workout'}</button>
    ${!day.completed_at ? '<div class="spacer"></div><button class="ghost block" id="skipDay">Skip this workout</button>' : ''}`;

  function rateLine(m, f) {
    const done = f && f.pump != null && f.workload != null && f.joint_pain != null;
    return done ? `<button class="ghost sm" data-open="${esc(m)}">✓ ${esc(m)} rated · pump ${RATINGS.pump.opts[f.pump]}, ${RATINGS.workload.opts[f.workload].toLowerCase()}, joints ${RATINGS.joint_pain.opts[f.joint_pain].toLowerCase()}</button>`
      : `<button class="sm block" data-open="${esc(m)}">Rate ${esc(m)} (pump · workload · joints)</button>`;
  }
  const wireRate = () => $$('[data-open]').forEach(b => b.onclick = () => openRating(b.dataset.open, !isRated(b.dataset.open) && muscleComplete(b.dataset.open)));
  wireRate();

  const muscleComplete = m => $$(`[data-muscle="${CSS.escape(m)}"] .set`).every(r => r.classList.contains('done'));
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
    const a = L.bestE1rm(cur, we.exercises, profile?.bodyweight), b = L.bestE1rm(p.sets.map(x => ({ ...x, rir: x.rir ?? p.rir })), we.exercises, profile?.bodyweight);
    if (a == null || b == null) return null;
    return { t: L.performanceTrend(a, b), pct: (a - b) / b * 100, vs: p.carried ? 'last meso' : 'last week' };
  }
  const trendHtml = tr => !tr ? '' : `<span class="pill ${tr.t > 0 ? 'on' : tr.t < 0 ? 'bad' : ''}" title="vs ${tr.vs}">${tr.t > 0 ? '▲' : tr.t < 0 ? '▼' : '●'} ${tr.pct > 0 ? '+' : ''}${tr.pct.toFixed(1)}%</span>`;
  const exComplete = we => { const c = app.querySelector(`[data-we="${we.id}"]`); return !!c && [...c.querySelectorAll('.set')].every(r => r.classList.contains('done')); };
  function refreshTrend(we) { const el = app.querySelector(`[data-trend="${we.id}"]`); if (el) el.innerHTML = exComplete(we) ? trendHtml(exerciseTrend(we)) : ''; }
  const isRated = m => !!feedback[m] && rateKeys(m).every(k => feedback[m][k] != null);

  // required = locked: can't dismiss or move on until all three are answered. Editing later via ✎ is not locked.
  function openRating(m, required = true) {
    const f = { ...(feedback[m] || {}) };
    const exs = m === 'Cardio' ? wes.filter(isCardio) : wes.filter(w => !isCardio(w) && w.exercises.muscle_group === m);
    openSheet(`<h3>${esc(m)} — how was that?</h3>
      <div class="muted small">${required ? 'Required before you continue.' : 'Adjust your ratings.'}</div>
      <div class="card" style="margin:10px 0 4px;padding:10px"><div class="muted tiny">Progression</div>
        ${exs.map(w => { const tr = exComplete(w) ? exerciseTrend(w) : null;
          return `<div class="mover"><span>${esc(w.exercises.name)}</span>${tr ? trendHtml(tr) : `<span class="muted tiny">${exComplete(w) ? 'no history yet' : 'not finished'}</span>`}</div>`; }).join('')}</div>
      ${rateKeys(m).map(k => `<div class="fb-row"><label>${RATINGS[k].label}</label>${segHtml(k, f[k])}</div>`).join('')}
      <div class="spacer"></div><button class="primary block" id="saveRate">Save</button>
      ${required ? '' : '<button class="ghost block" id="later">Cancel</button>'}`, panel => {
      panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        f[b.dataset.k] = +b.dataset.v;
        panel.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b));
      });
      const later = panel.querySelector('#later'); if (later) later.onclick = closeSheet;
      panel.querySelector('#saveRate').onclick = async () => {
        if (rateKeys(m).some(k => f[k] == null)) return toast('Pick one for each', true);
        const payload = { workout_day_id: dayId, muscle_group: m }; rateKeys(m).forEach(k => payload[k] = f[k]);
        const row = check(await sb.from('muscle_feedback').upsert(payload,
          { onConflict: 'workout_day_id,muscle_group' }).select().single());
        feedback[m] = row; closeSheet();
        const slot = app.querySelector(`[data-rate="${CSS.escape(m)}"]`); if (slot) { slot.innerHTML = rateLine(m, row); wireRate(); }
        enforceRatings();
      };
    }, required);
  }
  // Any muscle whose sets are all done but isn't rated gets the locked prompt.
  function enforceRatings() {
    if (!sheet.hidden) return;
    const m = groups.find(x => muscleComplete(x) && !isRated(x));
    if (m) openRating(m, true);
  }

  function wireSet(we, row) {
    if (isCardio(we)) return wireCardio(we, row);
    const save = async markDone => {
      const wIn = row.querySelector('[data-f="weight"]'), rIn = row.querySelector('[data-f="reps"]');
      if (markDone && rIn.value === '' && rIn.dataset.sug) rIn.value = rIn.dataset.sug;
      const weight = wIn.value === '' ? null : Number(wIn.value), reps = rIn.value === '' ? null : Number(rIn.value);
      const done = markDone ? !row.classList.contains('done') : row.classList.contains('done');
      if (markDone && done && reps == null) return toast('Enter reps first', true);
      if (markDone && done && weight == null && we.exercises.load_type === 'weighted') return toast('Enter the weight first', true);
      if (!markDone && weight == null && reps == null) return;
      const payload = { workout_exercise_id: we.id, set_index: +row.dataset.idx, weight: weight ?? (we.exercises.load_type === 'weighted' ? null : 0),
        reps, rir: we.target_rir, completed_at: done ? (row.dataset.at || new Date().toISOString()) : null };
      const { error } = await sb.from('sets').upsert(payload, { onConflict: 'workout_exercise_id,set_index' });
      if (error) return toast(error.message, true);
      row.dataset.at = payload.completed_at || ''; wIn.classList.remove('sug');
      row.classList.toggle('done', done);
      const m = we.exercises.muscle_group;
      refreshTrend(we);
      if (markDone && done && exComplete(we)) { const tr = exerciseTrend(we); if (tr && !muscleComplete(m)) toast(`${we.exercises.name}: ${tr.t > 0 ? '▲ up' : tr.t < 0 ? '▼ down' : '● same'} ${tr.pct > 0 ? '+' : ''}${tr.pct.toFixed(1)}% vs ${tr.vs}`); }
      if (markDone && done) enforceRatings();
    };
    row.querySelector('.check').onclick = () => save(true);
    row.querySelectorAll('input').forEach(i => { i.oninput = () => i.classList.remove('sug'); i.onchange = () => save(false); });
  }
  function wireCardio(we, row) {
    const save = async markDone => {
      const dIn = row.querySelector('[data-f="duration"]'), rIn = row.querySelector('[data-f="rpe"]');
      const duration = dIn.value === '' ? null : Number(dIn.value), rpe = rIn.value === '' ? null : Math.max(0, Math.min(10, Math.round(Number(rIn.value))));
      const done = markDone ? !row.classList.contains('done') : row.classList.contains('done');
      if (markDone && done && (!duration || rpe == null)) return toast('Enter minutes and RPE', true);
      if (!markDone && duration == null && rpe == null) return;
      const { error } = await sb.from('sets').upsert({ workout_exercise_id: we.id, set_index: +row.dataset.idx, duration_min: duration, rpe,
        weight: null, reps: null, completed_at: done ? new Date().toISOString() : null }, { onConflict: 'workout_exercise_id,set_index' });
      if (error) return toast(error.message, true);
      row.classList.toggle('done', done);
      refreshTrend(we);
      if (markDone && done) enforceRatings();
    };
    row.querySelector('.check').onclick = () => save(true);
    row.querySelectorAll('input').forEach(i => i.onchange = () => save(false));
  }
  $$('[data-we]').forEach(card => {
    const we = wes.find(w => w.id === card.dataset.we);
    card.querySelectorAll('.set').forEach(r => wireSet(we, r));
    card.querySelector('[data-addset]').onclick = () => {
      const setsEl = card.querySelector('.sets'); const last = setsEl.querySelector('.set:last-child');
      const row = last.cloneNode(true); const idx = +last.dataset.idx + 1;
      row.dataset.idx = idx; row.dataset.at = ''; row.classList.remove('done'); row.querySelector('.n').textContent = idx;
      row.querySelectorAll('input').forEach(i => { if (i.dataset.f !== 'weight') i.value = ''; i.classList.remove('sug'); });
      setsEl.appendChild(row); wireSet(we, row);
    };
    card.querySelector('[data-rmset]').onclick = async () => {
      const rows = card.querySelectorAll('.set'); if (rows.length <= 1) return;
      const last = rows[rows.length - 1];
      await sb.from('sets').delete().eq('workout_exercise_id', we.id).eq('set_index', +last.dataset.idx); last.remove();
    };
  });

  $$('[data-edit]').forEach(b => b.onclick = () => {
    const m = b.dataset.edit;
    if (!isRated(m) && !muscleComplete(m)) return toast(`Finish ${m}'s sets first — ratings open automatically`);
    openRating(m, !isRated(m));
  });
  wes.forEach(refreshTrend);
  if (!day.completed_at) enforceRatings();
  const sk = $('#skipDay'); if (sk) sk.onclick = async () => {
    if (!confirm('Skip this workout? Logged sets are kept.')) return;
    check(await sb.from('workout_days').update({ skipped_at: new Date().toISOString() }).eq('id', dayId)); go('#/meso/' + meso.id);
  };
  $('#finish').onclick = async () => {
    if (day.completed_at) return go('#/meso/' + meso.id);
    const unrated = groups.filter(m => muscleComplete(m) && !isRated(m));
    if (unrated.length) { toast(`Rate ${unrated[0]} first`); return openRating(unrated[0]); }
    const open = $$('.set:not(.done)').length;
    if (open && !confirm(`${open} set${open > 1 ? 's are' : ' is'} not checked off. Finish anyway?`)) return;
    // Performance trend per muscle vs. last week (doc §1.7), computed from what's saved.
    const fresh = check(await sb.from('workout_exercises').select('exercise_id, target_rir, exercises(*), sets(*)').eq('workout_day_id', dayId));
    const bw = profile?.bodyweight;
    for (const m of muscles) {
      const trends = fresh.filter(w => w.exercises.muscle_group === m).map(w => {
        const cur = L.bestE1rm(w.sets.filter(s => s.completed_at).map(s => ({ ...s, rir: s.rir ?? w.target_rir })), w.exercises, bw);
        const p = prev[w.exercise_id];
        const old = p ? L.bestE1rm(p.sets.map(s => ({ ...s, rir: s.rir ?? p.rir })), w.exercises, bw) : null;
        return L.performanceTrend(cur, old);
      });
      const perf = L.combineTrends(trends);
      check(await sb.from('muscle_feedback').upsert({ workout_day_id: dayId, muscle_group: m, performance: perf }, { onConflict: 'workout_day_id,muscle_group' }));
    }
    check(await sb.from('workout_days').update({ completed_at: new Date().toISOString() }).eq('id', dayId));
    const left = openDays(all).filter(d => d.id !== dayId);
    if (!left.length) await sb.from('mesocycles').update({ status: 'completed' }).eq('id', meso.id);
    toast('Workout saved 💪'); go(left.length ? '#/' : '#/meso/' + meso.id);
  };
}

function renderRecoveryGate(day, meso, pending) {
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
const ACTIVITIES = ['Run', 'Walk', 'Incline walk', 'Bike', 'Row', 'Elliptical', 'Stairmaster', 'Swim', 'HIIT', 'Hike', 'Sport', 'Other'];
const RPE_WORDS = ['Rest', 'Very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Hard+', 'Very hard', 'Very hard+', 'Near max', 'Max'];
async function renderCardio() {
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
          <div style="width:140px"><label>Date</label><input type="date" name="date" value="${today()}"></div></div>
        <div class="row"><div class="grow"><label>Minutes</label><input name="minutes" type="number" inputmode="decimal" step="any" required></div>
          <div class="grow"><label>Avg HR (optional)</label><input name="hr" type="number" inputmode="numeric"></div></div>
        <label>Intensity (session RPE): <b id="rpeLbl">5 · ${RPE_WORDS[5]}</b></label>
        <div class="seg c11">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-rpe="${i}" class="${i === 5 ? 'on' : ''}">${i}</button>`).join('')}</div>
        <div class="row"><div class="grow"><label>Distance (optional)</label><input name="dist" type="number" inputmode="decimal" step="any"></div>
          <div style="width:90px"><label>Unit</label><select name="du"><option>mi</option><option>km</option><option>m</option></select></div></div>
        <label>Notes</label><input name="notes">
        <div class="spacer"></div><button class="primary block">Save cardio</button>
      </form></div>
    <div class="grid2"><div class="card"><div class="muted small">This week</div><div class="big">${fmt(cur.min)}<span class="muted small"> min</span></div><div class="muted small">load ${fmt(cur.load)}</div></div>
      <div class="card"><div class="muted small">3-wk avg load</div><div class="big">${fmt(Math.round(avg))}</div><div class="muted small">load = RPE × minutes</div></div></div>
    ${spike ? '<div class="card warn small">Cardio load is up more than 50% vs your recent weeks. If leg recovery dips, ease off or swap running for cycling (doc §1.9).</div>' : ''}
    <div class="card"><b>Weekly load (8 weeks)</b>
      <svg class="chart" viewBox="0 0 320 120">${byWeek.map((w, i) => { const h = Math.round(w.load / maxLoad * 100);
        return `<rect x="${i * 40 + 6}" y="${110 - h}" width="28" height="${h}" rx="4" fill="${i === 7 ? 'var(--accent)' : '#3a4150'}"></rect>
          <text x="${i * 40 + 20}" y="119" font-size="8" fill="#8b93a3" text-anchor="middle">${w.s.getMonth() + 1}/${w.s.getDate()}</text>`; }).join('')}</svg></div>
    <h2>Recent</h2>
    ${list.length ? `<div class="card"><table><tr><th>Date</th><th>Activity</th><th>Min</th><th>RPE</th><th>Load</th><th></th></tr>
      ${list.slice(0, 30).map(c => `<tr><td>${c.performed_on.slice(5)}</td><td>${esc(c.activity)}${c.distance ? ` <span class="muted tiny">${fmt(c.distance)}${c.distance_unit}</span>` : ''}</td>
        <td>${fmt(c.minutes)}</td><td>${c.rpe}</td><td>${fmt(L.cardioLoad(c))}</td><td><button class="ghost sm danger" data-del="${c.id}">✕</button></td></tr>`).join('')}</table></div>` : '<p class="muted">No cardio logged yet.</p>'}`;
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

// ---------- explore ----------
function renderExplore() {
  setHeader('Explore', null, 'explore');
  const items = [
    ['#/history', '🗂', 'History', 'Every workout and cardio session'],
    ['#/progress', '📈', 'Exercise progress', 'Estimated strength per exercise over time'],
    ['#/volume', '📊', 'Muscle volume', 'Weekly sets per muscle vs. productive range'],
    ['#/cardio', '♥︎', 'Cardio', 'Minutes, intensity and load by week'],
    ['#/exercises', '📚', 'Exercise library', 'All exercises; add your own'],
    ['#/templates', '☆', 'Templates', 'Base templates and your saved plans'],
    ['#/mesos', '🗓', 'Mesocycles', 'Current and past programs'],
    ['#/settings', '⚙︎', 'Settings', 'Name, units, bodyweight, sign out'],
  ];
  app.innerHTML = items.map(([h, i, t, d]) => `<button class="list-btn" data-go="${h}"><span style="font-size:22px">${i}</span>
    <div class="grow"><b>${t}</b><div class="muted small">${d}</div></div>›</button>`).join('') +
    `<div class="card small muted">How the app decides weights, sets and RIR: <a href="${DOC_URL}" target="_blank" rel="noopener">Training Logic & Evidence</a></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

async function renderHistory() {
  setHeader('History', '#/explore', 'explore');
  const days = check(await sb.from('workout_days').select('id, week, day_index, label, completed_at, mesocycles(name), workout_exercises(id, sets(id, completed_at))')
    .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(100));
  const cardio = check(await sb.from('cardio_sessions').select('*').order('performed_on', { ascending: false }).limit(100));
  const items = [...days.filter(d => d.completed_at).map(d => ({ t: d.completed_at, kind: 'lift', d })), ...cardio.map(c => ({ t: c.performed_on + 'T12:00:00', kind: 'cardio', c }))]
    .sort((a, b) => b.t.localeCompare(a.t));
  app.innerHTML = items.length ? items.map(it => it.kind === 'lift'
    ? `<button class="list-btn" data-go="#/workout/${it.d.id}"><span>🏋︎</span><div class="grow"><b>${esc(it.d.mesocycles?.name)} · Wk ${it.d.week} ${esc(dayName(it.d))}</b>
        <div class="muted small">${new Date(it.t).toLocaleDateString()} · ${it.d.workout_exercises.reduce((a, w) => a + w.sets.filter(s => s.completed_at).length, 0)} sets</div></div>›</button>`
    : `<div class="list-btn"><span>♥︎</span><div class="grow"><b>${esc(it.c.activity)}</b>
        <div class="muted small">${it.c.performed_on} · ${fmt(it.c.minutes)} min · RPE ${it.c.rpe} · load ${fmt(L.cardioLoad(it.c))}</div></div></div>`).join('')
    : '<p class="muted">Nothing logged yet.</p>';
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

async function renderProgress(exId) {
  setHeader('Exercise progress', exId ? '#/progress' : '#/explore', 'explore');
  const rows = check(await sb.from('sets').select('weight, reps, rir, completed_at, workout_exercises!inner(id, exercise_id, exercises(*))')
    .not('completed_at', 'is', null).order('completed_at').limit(5000));
  const bw = profile?.bodyweight;
  const byEx = {};
  for (const r of rows) {
    const ex = r.workout_exercises.exercises; if (ex.load_type === 'cardio' || r.reps == null) continue; (byEx[ex.id] = byEx[ex.id] || { ex, sessions: {} });
    const sid = r.workout_exercises.id; const s = (byEx[ex.id].sessions[sid] = byEx[ex.id].sessions[sid] || { date: r.completed_at, sets: [] });
    s.sets.push(r);
  }
  if (!exId) {
    const list = Object.values(byEx).sort((a, b) => a.ex.muscle_group.localeCompare(b.ex.muscle_group) || a.ex.name.localeCompare(b.ex.name));
    app.innerHTML = list.length ? list.map(({ ex, sessions }) => {
      const ss = Object.values(sessions); const first = L.bestE1rm(ss[0].sets, ex, bw), last = L.bestE1rm(ss[ss.length - 1].sets, ex, bw);
      const ch = first ? Math.round((last - first) / first * 100) : 0;
      return `<button class="list-btn" data-go="#/progress/${ex.id}"><div class="grow"><b>${esc(ex.name)}</b>
        <div class="muted small">${esc(ex.muscle_group)} · ${ss.length} session${ss.length > 1 ? 's' : ''}</div></div>
        <span class="pill ${ch > 0 ? 'on' : ch < 0 ? 'bad' : ''}">${ch > 0 ? '+' : ''}${ch}%</span></button>`; }).join('')
      : '<p class="muted">Log some sets and your progress shows up here.</p>';
    return $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  const data = byEx[exId]; if (!data) { app.innerHTML = '<p class="muted">No sets for this exercise yet.</p>'; return; }
  const ss = Object.values(data.sessions).map(s => ({ ...s, e: L.bestE1rm(s.sets, data.ex, bw),
    top: s.sets.reduce((b, x) => (L.e1rm(x, data.ex, bw) ?? 0) > (L.e1rm(b, data.ex, bw) ?? 0) ? x : b, s.sets[0]) }));
  const vals = ss.map(s => s.e), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = ss.map((s, i) => `${ss.length === 1 ? 160 : 10 + i * 300 / (ss.length - 1)},${110 - (s.e - min) / span * 95}`).join(' ');
  setHeader(data.ex.name, '#/progress', 'explore');
  app.innerHTML = `<div class="card"><div class="muted small">Best estimated strength per session · weight × (1 + (reps + RIR)/30)</div>
      <svg class="chart" viewBox="0 0 320 120"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
      ${pts.split(' ').map(p => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="var(--accent)"/>`).join('')}</svg>
      <div class="row muted tiny"><span class="grow">${fmt(Math.round(min))}</span><span>${fmt(Math.round(max))}</span></div></div>
    <div class="card"><table><tr><th>Date</th><th>Top set</th><th>Sets</th><th class="right">Est.</th></tr>
      ${ss.slice().reverse().map(s => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${fmt(s.top.weight)} × ${s.top.reps}</td><td>${s.sets.length}</td><td class="right">${fmt(Math.round(s.e))}</td></tr>`).join('')}</table></div>`;
}

async function renderVolume(mesoId) {
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
      <select id="wk" style="width:120px">${[...new Set(days.map(d => d.week))].map(w => `<option value="${w}" ${w === wk ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></div>
      <div class="muted small" style="margin-top:6px">Planned sets per muscle (direct + ½ indirect). Productive range ≈ 10–20; under 4 is below maintenance (doc §1.1).</div></div>
    <div class="card">${L.MUSCLES.filter(m => plan[m] || ind[m]).map(m => { const tot = plan[m] + ind[m], band = L.volumeBand(tot);
      return `<div style="margin:10px 0"><div class="row small"><span class="grow">${m}</span><span class="muted tiny">${done[m]}/${plan[m]} done${ind[m] ? ` · +${fmt(ind[m])} indirect` : ''}</span>
        <span class="pill ${bandCls[band]}">${fmt(tot)}</span></div>
        <div class="bar"><i style="width:${Math.min(100, tot / 24 * 100)}%;background:${band === 'productive' ? 'var(--accent)' : band === 'maintain' ? 'var(--info)' : 'var(--warn)'}"></i>
          <b style="left:${10 / 24 * 100}%"></b><b style="left:${20 / 24 * 100}%"></b></div></div>`; }).join('')}</div>`;
  $('#wk').onchange = e => { sessionStorage.volWeek = e.target.value; sessionStorage.volMeso = meso.id; renderVolume(meso.id); };
}

// ---------- exercise library ----------
async function renderLibrary(tab = 'exercises') {
  setHeader('Library', null, 'library');
  const head = `<div class="tabs2"><button data-lt="exercises" class="${tab === 'exercises' ? 'on' : ''}">Exercises</button><button data-lt="templates" class="${tab === 'templates' ? 'on' : ''}">Templates</button></div>`;
  const wireTabs = () => $$('[data-lt]').forEach(b => b.onclick = () => go('#/' + b.dataset.lt));
  if (tab === 'templates') return renderTemplates(head, wireTabs);
  return renderExercises('', head, wireTabs);
}
async function renderTemplates(head, wireTabs) {
  const mine = check(await sb.from('templates').select('*').order('created_at', { ascending: false }));
  const lib = await loadExercises(); const byId = new Map(lib.map(e => [e.id, e]));
  app.innerHTML = head + `
    <h2>Base templates · evidence-based</h2>
    ${Object.entries(L.TEMPLATES).map(([k, t]) => `<button class="list-btn" data-base="${k}"><div class="grow"><b>${t.name}</b><div class="muted small">${t.blurb}</div></div>›</button>`).join('')}
    <h2>Your templates</h2>
    ${mine.length ? mine.map(t => `<div class="card"><div class="row"><div class="grow"><b>${esc(t.name)}</b>
        <div class="muted small">${t.weeks} wks · ${t.days_per_week} days/wk · ${t.plan.reduce((a, d) => a + d.slots.length, 0)} exercises</div></div></div>
        ${t.notes ? `<div class="muted tiny" style="margin-top:4px">${esc(t.notes)}</div>` : ''}
        <details style="margin-top:8px"><summary class="muted small">Preview</summary>
          ${t.plan.map(d => `<div class="small" style="margin-top:6px"><b>${esc(d.label)}</b><div class="muted tiny">${d.slots.map(x => `${esc(byId.get(x.exerciseId)?.name || x.muscle)} ×${x.sets}`).join(' · ')}</div></div>`).join('')}
        </details>
        <div class="grid2" style="margin-top:10px"><button class="primary sm" data-use="${t.id}">Use template</button><button class="sm danger" data-del="${t.id}">Delete</button></div></div>`).join('')
      : '<p class="muted">Save a plan from the builder or a mesocycle and it shows up here.</p>'}`;
  wireTabs();
  $$('[data-base]').forEach(b => b.onclick = () => { builder = null; builder = freshBuilder(); builder.focus = b.dataset.base; builder.priorities = L.templatePriorities(b.dataset.base); go('#/new'); });
  $$('[data-use]').forEach(b => b.onclick = () => { builder = builderFromTemplate(mine.find(t => t.id === b.dataset.use)); go('#/new'); });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this template?')) return; check(await sb.from('templates').delete().eq('id', b.dataset.del)); renderLibrary('templates'); });
}
async function renderExercises(filter = '', head = '', wireTabs = () => {}) {
  const list = await loadExercises(true);
  let mf = decodeURIComponent(filter || ''), q = '';
  const draw = () => {
    const shown = list.filter(e => (!mf || e.muscle_group === mf) && (!q || e.name.toLowerCase().includes(q)));
    app.innerHTML = head + `
      <input id="q" placeholder="Search ${list.length} exercises" value="${esc(q)}"><div class="spacer"></div>
      <div class="chips">${['', ...L.MUSCLES, 'Cardio'].map(m => `<button class="chip ${m === mf ? 'sel' : ''}" data-mf="${m}">${m || 'All'}</button>`).join('')}</div>
      <div class="spacer"></div>
      <div class="card">${shown.map(e => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)"><div class="grow">${esc(e.name)}
        <div class="muted tiny">${esc(e.muscle_group)} · ${esc(e.equipment || '')} · ${e.kind} · ${e.load_type} · ${e.rep_min}–${e.rep_max} reps${e.secondary?.length ? ' · also ' + e.secondary.join(', ') : ''}</div></div>
        ${e.owner_id ? `<span class="pill">mine</span><button class="ghost sm danger" data-del="${e.id}">✕</button>` : ''}</div>`).join('') || '<p class="muted">No matches.</p>'}</div>
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
      toast('Added'); exCache = null; renderLibrary('exercises');
    };
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this exercise?')) return;
      const r = await sb.from('exercises').delete().eq('id', b.dataset.del);
      if (r.error) toast('In use by a workout — can’t delete', true); else { exCache = null; renderLibrary('exercises'); }
    });
  };
  draw();
}

// ---------- settings ----------
function renderSettings() {
  setHeader('Settings', '#/explore', 'explore');
  app.innerHTML = `<div class="card">
      <div class="muted small">Signed in as</div><div>${esc(session.user.email)}</div>
      <label>Name</label><input id="name" value="${esc(profile?.display_name || '')}">
      <div class="row"><div class="grow"><label>Units</label><select id="unit"><option ${unit() === 'lb' ? 'selected' : ''}>lb</option><option ${unit() === 'kg' ? 'selected' : ''}>kg</option></select></div>
        <div class="grow"><label>Bodyweight (${unit()})</label><input id="bw" type="number" inputmode="decimal" step="any" value="${profile?.bodyweight ?? ''}"></div></div>
      <div class="muted tiny" style="margin-top:6px">Bodyweight lets pull-ups, dips and push-ups count toward strength trends.</div>
      <div class="spacer"></div><button class="primary block" id="save">Save</button></div>
    <div class="card small"><a href="${DOC_URL}" target="_blank" rel="noopener">Training Logic & Evidence</a> <span class="muted">— why the app sets your weights, sets and RIR the way it does.</span></div>
    <button class="block" id="out">Sign out</button>
    <p class="muted small center">Install: Safari → Share → Add to Home Screen.</p>`;
  $('#save').onclick = async () => {
    const bw = $('#bw').value;
    profile = check(await sb.from('profiles').update({ display_name: $('#name').value.trim(), unit: $('#unit').value, bodyweight: bw === '' ? null : Number(bw) })
      .eq('id', session.user.id).select().single());
    toast('Saved');
  };
  $('#out').onclick = async () => { await sb.auth.signOut(); go('#/'); };
}

route();
