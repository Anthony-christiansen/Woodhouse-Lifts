import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as L from './logic.js?v=23';
import * as LEARN from './learn.js?v=23';

// Public by design: access is enforced by row-level security in the database.
const sb = createClient('https://dnknmtzcmmdepwheagmq.supabase.co', 'sb_publishable_UANLQGHztac0fMLcBeUg4g_sFeKc88g',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
// Where confirmation emails send people back to (must be in Supabase Auth → URL Configuration → Redirect URLs).
const SITE_URL = 'https://anthony-christiansen.github.io/Woodhouse-Lifts/';
// Capture what the confirmation link put in the URL before the router or supabase-js touch it.
// Implicit flow (not PKCE) on purpose: the link then works even when opened on a different device than sign-up.
let authReturn = (() => {
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, '')), q = new URLSearchParams(location.search);
  const get = k => h.get(k) || q.get(k);
  if (get('access_token')) return { ok: true, type: get('type') };
  if (get('error') || get('error_code')) return { ok: false, code: get('error_code') || get('error'), desc: get('error_description') };
  return null;
})();
let awaitingNewPassword = authReturn?.ok && authReturn.type === 'recovery'; // stay on 'new password' until it's saved
export const APP_VERSION = '1.6.0'; // keep in sync with CHANGELOG.md
const CHANGELOG_URL = 'https://github.com/Anthony-christiansen/Woodhouse-Lifts/blob/main/CHANGELOG.md';
const DOC_URL = 'https://docs.google.com/document/d/1lVTXsfzhUqOJ4bQRp0rp8nKUJsZa62Uasf7cR_FITlE';

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
// Weights are stored in lb; W() shows them in the user's unit, toLb() converts what they type back.
const W = v => L.toUnit(v, unit()), toLb = v => L.fromUnit(v, unit());
const fmtNum = n => (Math.round(n * 100) / 100).toString();
const bwD = () => W(profile?.bodyweight); // bodyweight in display units
const fmt = n => (n == null ? '–' : Number(n) % 1 ? Number(n).toFixed(1) : String(Number(n)));
// Local calendar date (not UTC — an evening workout in Utah must not land on tomorrow).
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dayName = d => d.label || 'Day ' + d.day_index;
const order = d => d.week * 100 + d.day_index;
// One toast at a time: a new message replaces the one showing (stacked toasts sat exactly on top of each other,
// so a second notice could be hidden or vanish early with the first one's timer).
function toast(msg, err = false, ms = null) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), ms ?? (err ? 4500 : 1800));
}
function check(res) { if (res.error) { console.error(res.error); toast(res.error.message, true); throw res.error; } return res.data; }
// Supabase returns at most 1,000 rows per request; page through everything. build() must return a fresh, fully ordered query.
async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const rows = check(await build().range(from, from + page - 1));
    out.push(...rows); if (rows.length < page) return out;
  }
}
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

// ---------- reliable set saving ----------
// Every set save is an idempotent upsert keyed by (workout_exercise_id, set_index), so the database can never
// hold a duplicate set. If the network drops (gym basements), the save is kept on the phone and retried
// automatically — when the connection returns, when the app comes back to the foreground, and every 20 s.
const QKEY = 'wl_pending_sets_v1';
const qLoad = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '{}'); } catch { return {}; } };
const qStore = q => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* private mode: retry still works this session */ } };
const isNetErr = e => !navigator.onLine || /failed to fetch|network|load failed|timeout|fetch/i.test(e?.message || '');
const setKey = p => p.workout_exercise_id + ':' + p.set_index;
async function saveSet(payload) {
  const { error } = await sb.from('sets').upsert(payload, { onConflict: 'workout_exercise_id,set_index' });
  const q = qLoad();
  if (!error) { delete q[setKey(payload)]; qStore(q); syncBadge(); return 'saved'; }    // newest value is on the server
  if (isNetErr(error)) { q[setKey(payload)] = payload; qStore(q); syncBadge(); return 'queued'; }
  toast(`Couldn’t save that set: ${error.message}`, true); return 'failed';
}
let flushing = false;
async function flushQueue() {
  if (flushing || !session) return; flushing = true;
  try {
    const q = qLoad();
    for (const [k, p] of Object.entries(q)) {
      const { error } = await sb.from('sets').upsert(p, { onConflict: 'workout_exercise_id,set_index' });
      if (!error) { const cur = qLoad(); if (JSON.stringify(cur[k]) === JSON.stringify(p)) delete cur[k]; qStore(cur); }
      else if (isNetErr(error)) break;
      else { const cur = qLoad(); delete cur[k]; qStore(cur); toast(`A saved-offline set couldn’t be stored: ${error.message}`, true); }
    }
  } finally { flushing = false; syncBadge(); }
  const left = Object.keys(qLoad()).length;
  document.querySelectorAll('.set.queued').forEach(r => { if (!qLoad()[r.dataset.key]) { r.classList.remove('queued'); r.classList.add('saved-flash'); } });
  return left;
}
function syncBadge() {
  const n = Object.keys(qLoad()).length;
  let b = document.getElementById('syncBadge');
  if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('button'); b.id = 'syncBadge'; b.className = 'sync-badge'; b.onclick = () => flushQueue(); document.body.appendChild(b); }
  b.textContent = `⟳ ${n} set${n > 1 ? 's' : ''} waiting to sync — tap to retry`;
  b.setAttribute('aria-live', 'polite');
}
window.addEventListener('online', () => flushQueue());
document.addEventListener('visibilitychange', () => { if (!document.hidden) flushQueue(); });
setInterval(() => { if (Object.keys(qLoad()).length) flushQueue(); }, 20000);

// ---------- per-lift insights (doc §6.1) ----------
// For a list of exercise ids: recent sessions + earlier best (lift_recent), tagged with meso and meso week, then the
// training engine's status. Within a meso the target RIR drops each week, so lifts are judged on PERFORMANCE
// (load × reps) week over week, and against the same week of the previous meso — never on a RIR-adjusted number
// that stays flat when you hit the plan exactly (L.mesoStatus).
const STATUS_ORDER = { regressing: 0, stalled: 1, dip: 2, pr: 3, progressing: 4, steady: 5, new: 6 };
const statusPill = st => `<span class="pill st-${st.status}">${st.label}${st.pct != null && st.status !== 'new' ? ` ${st.pct > 0 ? '+' : ''}${st.pct.toFixed(1)}%` : ''}</span>`;
async function liftInsights(ids, { excludeSessions = [], meso = null, rirFor = {} } = {}) {
  if (!ids.length) return {};
  const rows = check(await sb.rpc('lift_recent', { p_ids: ids, p_n: 30, p_days: 182 })).filter(r => !excludeSessions.includes(r.session_id));
  // meso + week + load type for every session (chunked: long id lists don't fit in one URL)
  const meta = {}; const sids = [...new Set(rows.map(r => r.session_id))];
  for (let i = 0; i < sids.length; i += 80) check(await sb.from('workout_exercises').select('id, exercises(load_type), workout_days(week, mesocycle_id, mesocycles(name, weeks))').in('id', sids.slice(i, i + 80)))
    .forEach(w => meta[w.id] = w);
  const by = {};
  for (const r of rows) {
    const m = meta[r.session_id], d = m?.workout_days;
    const x = by[r.exercise_id] = by[r.exercise_id] || { id: r.exercise_id, name: r.name, prior: r.prior_best == null ? null : Number(r.prior_best), sessions: [] };
    const top = { weight: r.top_weight, reps: r.top_reps };
    x.sessions.push({ e: Number(r.best_e1rm), raw: L.e1rm({ ...top, rir: 0 }, m?.exercises || { load_type: 'weighted' }, profile?.bodyweight), date: r.done_at.slice(0, 10),
      meso: d?.mesocycle_id || null, mesoName: d?.mesocycles?.name || '', week: d?.week ?? null, deload: d ? L.rirForWeek(d.week, d.mesocycles?.weeks || 99).deload : false, top });
  }
  for (const x of Object.values(by)) {
    // one entry per meso week (its best session by performance); deload weeks don't count
    const ent = new Map();
    for (const s of x.sessions) { if (s.deload || !s.meso) continue; const k = s.meso + '|' + s.week, c = ent.get(k); if (!c || s.raw > c.raw) ent.set(k, s); }
    x.entries = [...ent.values()].sort((p, q) => p.date.localeCompare(q.date));
    x.status = L.mesoStatus(x.entries, x.prior, { name: x.name, rir: rirFor[x.id] ?? null });
    x.prs = meso ? L.prsInMeso(x.entries, x.prior, meso) : { count: 0, last: null };
  }
  return by;
}

let prefsCache = null;
async function loadPrefs(force = false) {
  if (!prefsCache || force) prefsCache = check(await sb.from('exercise_prefs').select('exercise_id, pref, substitute_id'));
  return prefsCache;
}
async function setPref(exerciseId, pref, substituteId = null) {
  const r = pref ? await sb.from('exercise_prefs').upsert({ exercise_id: exerciseId, pref, substitute_id: pref === 'exclude' ? substituteId : null, updated_at: new Date().toISOString() })
    : await sb.from('exercise_prefs').delete().eq('exercise_id', exerciseId);
  check(r); prefsCache = null;
}
async function loadExercises(force = false) {
  if (!exCache || force) exCache = check(await sb.from('exercises').select('*').order('muscle_group').order('name'));
  return exCache;
}

// ---------- router ----------
const routes = {
  '': renderHome, mesos: renderMesos, train: renderMesos, new: renderBuilder, meso: renderMeso, workout: renderWorkout,
  explore: renderExplore, history: renderHistory, progress: renderProgress, volume: renderVolume,
  cardio: renderCardio, library: renderLibrary, exercises: () => renderLibrary('exercises'), templates: () => renderLibrary('templates'),
  settings: renderSettings, learn: renderLearn, stats: renderStats,
};
async function route() {
  closeSheet();
  const { data } = await sb.auth.getSession(); session = data.session; // waits for supabase-js to read the link's tokens
  if (authReturn) {
    const r = authReturn; authReturn = null;
    history.replaceState(null, '', location.pathname + '#/'); // drop tokens/errors from the address bar
    if (r.ok && session) toast(r.type === 'signup' ? 'Email confirmed — welcome to Woodhouse Lifts!' : 'Signed in');
    else if (!session) { tabs.hidden = true; return renderAuth('signin', linkProblem(r)); }
  }
  if (!session) { tabs.hidden = true; return renderAuth(); }
  if (awaitingNewPassword) return renderNewPassword(true);
  if (Object.keys(qLoad()).length) { syncBadge(); flushQueue(); }
  if (!profile) profile = (await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()).data;
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo(0, 0);
  // Show a loading state only if the screen takes a moment (no flash on fast loads); errors offer a retry.
  const slow = setTimeout(() => { app.setAttribute('aria-busy', 'true'); app.innerHTML = '<div class="loading" role="status">Loading…</div>'; }, 250);
  try { await (routes[name] || renderHome)(...args); }
  catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card warn" role="alert"><b>${isNetErr(e) ? 'No connection' : 'Something went wrong'}</b>
      <p class="muted small">${isNetErr(e) ? 'Check your signal and try again. Sets you logged are kept on this phone and sync when you’re back online.' : esc(e.message)}</p>
      <button class="primary block" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => route();
  } finally { clearTimeout(slow); app.removeAttribute('aria-busy'); }
}
window.addEventListener('hashchange', route);
sb.auth.onAuthStateChange(evt => {
  if (evt === 'PASSWORD_RECOVERY') awaitingNewPassword = true;
  if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'PASSWORD_RECOVERY') { profile = null; route(); }
});

// ---------- auth ----------
// notice: { tone: 'warn'|'ok', title, text, resendEmail? } shown above the form.
function authNotice(n) {
  if (!n) return '';
  return `<div class="card notice ${n.tone || 'warn'}" role="status"><h3>${esc(n.title)}</h3><p class="muted">${esc(n.text)}</p>
    ${n.resend ? `<button class="ghost block" id="resend" type="button">Resend confirmation email</button>` : ''}</div>`;
}
function linkProblem(r) {
  const expired = /expired|invalid/i.test(`${r.code} ${r.desc}`);
  return { title: expired ? 'That link has expired or was already used' : 'We couldn’t confirm that link',
    text: expired ? 'If you already confirmed, just sign in below. If not, enter your email below and tap Resend for a fresh link.'
      : 'Try signing in below. If your email isn’t confirmed yet, enter it below and tap Resend for a new link.', resend: true };
}
function friendlyAuthError(err) {
  const code = err?.code || '', msg = err?.message || '';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'unconfirmed';
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return 'That email and password don’t match. Check for typos and try again.';
  if (code === 'weak_password' || /password/i.test(msg) && /least|weak|short/i.test(msg)) return 'Choose a stronger password — at least 8 characters.';
  if (code === 'over_email_send_rate_limit' || err?.status === 429 || /rate limit|security purposes/i.test(msg)) return 'Too many emails requested. Wait a minute and try again.';
  if (code === 'signup_disabled') return 'New sign-ups are turned off right now.';
  if (code === 'email_address_invalid' || /invalid.*email/i.test(msg)) return 'That email address doesn’t look right.';
  return msg || 'Something went wrong. Please try again.';
}
function wireResend(getEmail) {
  const b = $('#resend'); if (!b) return;
  b.onclick = async () => {
    const email = typeof getEmail === 'function' ? getEmail() : getEmail;
    if (!email) return toast('Enter your email below first', true);
    b.disabled = true;
    const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: SITE_URL } });
    if (error) { toast(friendlyAuthError(error), true); b.disabled = false; return; }
    toast('Confirmation email sent');
    let s = 60; b.textContent = `Resend available in ${s}s`;
    const t = setInterval(() => { s--; if (s <= 0 || !b.isConnected) { clearInterval(t); b.disabled = false; b.textContent = 'Resend confirmation email'; } else b.textContent = `Resend available in ${s}s`; }, 1000);
  };
}
function renderCheckEmail(email) {
  setHeader('Woodhouse Lifts'); tabs.hidden = true;
  app.innerHTML = `<div class="card notice ok" role="status"><h3>Check your email to confirm your account</h3>
      <p>We sent a confirmation link to <b>${esc(email)}</b> from <b>Woodhouse Lifts</b>.</p>
      <p class="muted">Open it and tap the link — it brings you right back here, signed in. No code to type. Can’t find it? Check spam or promotions; it can take a minute.</p>
      <p class="muted small">Already have an account with this email? Sign in instead.</p>
      <button class="ghost block" id="resend" type="button">Resend confirmation email</button>
      <div class="spacer"></div><button class="primary block" id="toSignin" type="button">Back to sign in</button></div>`;
  wireResend(email);
  $('#toSignin').onclick = () => renderAuth('signin', null, email);
}

function renderAuth(mode = 'signin', notice = null, prefill = '') {
  setHeader('Woodhouse Lifts');
  app.innerHTML = `<div class="hero"><div class="tagline">Track your workouts. Measure your progress. Get stronger.</div>
      <p class="muted small">Plans your training week by week from proven hypertrophy, strength and athletic research — then adjusts weights, reps and sets from how you actually performed and recovered.</p></div>
    ${authNotice(notice)}
    <div class="card"><h2 class="h3">${mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
      <form id="f" novalidate>
        ${mode === 'signup' ? '<label for="a-name">Name</label><input id="a-name" name="name" autocomplete="given-name" required>' : ''}
        <label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" inputmode="email" value="${esc(prefill)}" required>
        <label for="a-pw">Password</label><input id="a-pw" name="password" type="password" minlength="8" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required ${mode === 'signup' ? 'aria-describedby="pw-rules"' : ''}>
        ${mode === 'signup' ? '<div id="pw-rules" class="muted tiny">At least 8 characters. We’ll email you a link to confirm your account.</div>' : ''}
        <label class="switch tiny"><input type="checkbox" id="showpw"> <span>Show password</span></label>
        <div class="spacer"></div><button class="primary block" type="submit">${mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>${mode === 'signin' ? '<button class="ghost block sm" id="forgot" type="button">Forgot password?</button>' : '<div class="spacer"></div>'}
      <button class="ghost block" id="swap">${mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
    </div>`;
  const emailVal = () => app.querySelector('input[name=email]')?.value.trim() || prefill;
  wireResend(emailVal);
  $('#swap').onclick = () => renderAuth(mode === 'signin' ? 'signup' : 'signin', null, emailVal());
  $('#showpw').onchange = e => { $('#a-pw').type = e.target.checked ? 'text' : 'password'; };
  if ($('#forgot')) $('#forgot').onclick = () => renderForgot(emailVal());
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const btn = e.target.querySelector('button[type=submit]');
    const email = fd.get('email').trim(), password = fd.get('password');
    const bad = (sel, msg) => { const el = $(sel); el.setAttribute('aria-invalid', 'true'); el.focus(); toast(msg, true); };
    if (mode === 'signup' && !fd.get('name')?.trim()) return bad('#a-name', 'Enter your name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('#a-email', 'Enter a valid email address');
    if (!password || (mode === 'signup' && password.length < 8)) return bad('#a-pw', mode === 'signup' ? 'Password must be at least 8 characters' : 'Enter your password');
    btn.disabled = true; btn.textContent = mode === 'signin' ? 'Signing in…' : 'Creating account…';
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          const f = friendlyAuthError(error);
          if (f === 'unconfirmed') return renderAuth('signin', { title: 'Confirm your email first',
            text: `Your account exists, but ${email} hasn’t been confirmed yet. Open the email from Woodhouse Lifts and tap the link — check spam too. Need a new one?`, resend: true }, email);
          toast(f, true);
        }
        // success: onAuthStateChange('SIGNED_IN') routes into the app
      } else {
        const { data, error } = await sb.auth.signUp({ email, password,
          options: { data: { display_name: fd.get('name').trim() }, emailRedirectTo: SITE_URL } });
        if (error) toast(friendlyAuthError(error) === 'unconfirmed' ? 'Check your email to confirm your account.' : friendlyAuthError(error), true);
        else if (!data.session) return renderCheckEmail(email); // never treat an unconfirmed sign-up as logged in
      }
    } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = mode === 'signin' ? 'Sign in' : 'Create account'; } }
  };
}

// Password reset: email a link (no codes); the link signs them in and lands on "set a new password".
function renderForgot(prefill = '') {
  setHeader('Woodhouse Lifts'); tabs.hidden = true;
  app.innerHTML = `<div class="card"><h3>Reset your password</h3>
      <p class="muted small">Enter the email you signed up with. We’ll email you a link — tap it to choose a new password. No code to type.</p>
      <form id="f"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" value="${esc(prefill)}" required>
        <div class="spacer"></div><button class="primary block" type="submit">Email me a reset link</button></form>
      <div class="spacer"></div><button class="ghost block" id="back" type="button">Back to sign in</button></div>`;
  $('#back').onclick = () => renderAuth('signin', null, app.querySelector('input[name=email]').value.trim());
  $('#f').onsubmit = async e => {
    e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    const email = new FormData(e.target).get('email').trim();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    if (error) { toast(friendlyAuthError(error), true); btn.disabled = false; return; }
    // Same message whether or not the account exists, so the form can't be used to look up who has an account.
    app.innerHTML = `<div class="card notice ok" role="status"><h3>Check your email</h3>
        <p>If <b>${esc(email)}</b> has an account, a password reset link from <b>Woodhouse Lifts</b> is on its way.</p>
        <p class="muted">Open it and tap the link to choose a new password. Can’t find it? Check spam; it can take a minute. Links expire after a while — just request another.</p>
        <button class="primary block" id="back" type="button">Back to sign in</button></div>`;
    $('#back').onclick = () => renderAuth('signin', null, email);
  };
}
function renderNewPassword(fromEmail = false) {
  setHeader(fromEmail ? 'Choose a new password' : 'Change password', fromEmail ? null : '#/settings', fromEmail ? null : 'explore');
  if (fromEmail) tabs.hidden = true;
  app.innerHTML = `<div class="card"><h3>${fromEmail ? 'Choose a new password' : 'Change password'}</h3>
      ${fromEmail ? `<p class="muted small">You’re signed in from your reset link as <b>${esc(session?.user?.email || '')}</b>.</p>` : ''}
      <form id="f">
        <label for="np1">New password</label><input id="np1" name="p1" type="password" minlength="8" autocomplete="new-password" required aria-describedby="np-rules">
        <div id="np-rules" class="muted tiny">At least 8 characters.</div>
        <label for="np2">Confirm new password</label><input id="np2" name="p2" type="password" minlength="8" autocomplete="new-password" required>
        <div class="spacer"></div><button class="primary block" type="submit">Save new password</button></form></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), btn = e.target.querySelector('button'); 
    if (fd.get('p1') !== fd.get('p2')) return toast('Passwords don’t match', true);
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: fd.get('p1') });
    if (error) { toast(/different from the old/i.test(error.message) ? 'Pick a password you haven’t used here before.' : friendlyAuthError(error), true); btn.disabled = false; return; }
    awaitingNewPassword = false; toast('Password updated'); go('#/'); route();
  };
}

// ---------- shared queries ----------
// The current program: an active meso always wins; a planned one is shown only when nothing is active,
// so building a future program never replaces the one you're running.
async function activeMeso() {
  const m = check(await sb.from('mesocycles').select('*').in('status', ['active', 'planned']).order('created_at', { ascending: false }));
  return m.find(x => x.status === 'active') || m.find(x => x.status === 'planned') || null;
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
  const r = meso && curWeek ? L.targetRir(curWeek, meso.weeks, meso.goal, 'compound') : null;
  const ws = weekStart(); const eightAgo = new Date(ws); eightAgo.setDate(eightAgo.getDate() - 7 * 7);
  // Lifting totals, weekly sets, PRs and strength trend are computed in the database (dashboard_stats) — a few KB, not the whole history.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // Home stats follow the CURRENT mesocycle's lifts (falls back to all lifts when there's no meso).
  const mesoLifts = meso ? check(await sb.from('workout_exercises').select('exercise_id, exercises!inner(name, load_type), workout_days!inner(mesocycle_id)')
    .eq('workout_days.mesocycle_id', meso.id)) : [];
  const liftIds = [...new Set(mesoLifts.filter(x => x.exercises.load_type !== 'cardio').map(x => x.exercise_id))];
  const [cSess, cSets, stats, warnings, mesoCount, insights] = await Promise.all([
    cardioSince(isoDay(eightAgo)), workoutCardioSince(eightAgo.toISOString()),
    sb.rpc('dashboard_stats', { p_tz: tz }).then(check),
    meso ? slipFor(meso) : Promise.resolve([]),
    sb.from('mesocycles').select('id', { count: 'exact', head: true }).then(x => x.count || 0),
    liftInsights(liftIds, { meso: meso?.id || null }),
  ]);
  const lifts = Object.values(insights).sort((a, b) => STATUS_ORDER[a.status.status] - STATUS_ORDER[b.status.status] || a.name.localeCompare(b.name));
  const mesoPrs = lifts.filter(x => x.prs.count).map(x => ({ id: x.id, name: x.name, pct: x.prs.last.pct, week: x.prs.last.week, n: x.prs.count }))
    .sort((a, b) => b.week - a.week || b.pct - a.pct);
  const prCount = meso ? lifts.reduce((a, x) => a + x.prs.count, 0) : (stats.prs || []).length;
  const bw = profile?.bodyweight;
  const cardio = cardioItems(cSess, cSets);
  const inWeek = (dstr, s) => { const d = new Date(dstr + 'T12:00'); const e = new Date(s); e.setDate(e.getDate() + 7); return d >= s && d < e; };
  const thisCardio = cardio.filter(c => inWeek(c.date, ws));
  const cMin = thisCardio.reduce((a, c) => a + c.minutes, 0), cLoad = thisCardio.reduce((a, c) => a + L.cardioLoad(c), 0);
  // Weekly hard sets (8 weeks) + this week's sets.
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = new Date(ws); s.setDate(s.getDate() - (7 - i) * 7); return s; });
  const setsPerWeek = weeks.map(s => Number(stats.weeks?.[isoDay(s)] || 0));
  const cardioPerWeek = weeks.map(s => cardio.filter(c => inWeek(c.date, s)).reduce((a, c) => a + c.minutes, 0));
  const prs = stats.prs || [], movers = stats.movers || [];
  const totalWorkouts = stats.workouts || 0, totalSets = stats.sets || 0;
  const doneDays = days.filter(d => d.completed_at || d.skipped_at).length;
  const maxSets = Math.max(1, ...setsPerWeek), maxC = Math.max(1, ...cardioPerWeek);
  const bars = (vals, max, color, kind) => `<svg class="chart" viewBox="0 0 320 110" style="height:110px">${vals.map((v, i) => { const h = Math.round(v / max * 88);
    return `<g class="bar-hit" data-go="#/stats/${kind}/${isoDay(weeks[i])}" role="button" tabindex="0" aria-label="Week of ${weeks[i].getMonth() + 1}/${weeks[i].getDate()}: ${Math.round(v)}"><rect x="${i * 40 + 2}" y="0" width="36" height="110" fill="transparent"></rect><rect x="${i * 40 + 6}" y="${92 - h}" width="28" height="${h}" rx="4" fill="${i === 7 ? color : '#3a4150'}"></rect>
      <text x="${i * 40 + 20}" y="${88 - h}" font-size="9" fill="#8b93a3" text-anchor="middle">${v ? Math.round(v) : ''}</text>
      <text x="${i * 40 + 20}" y="106" font-size="8" fill="#8b93a3" text-anchor="middle">${weeks[i].getMonth() + 1}/${weeks[i].getDate()}</text></g>`; }).join('')}</svg>`;

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
    ${warnings.length ? `<div class="card warn drill" tabindex="0" role="link" data-go="#/meso/${meso.id}"><div class="row"><b class="grow">Watch list</b><span class="pill warn">${warnings.length}</span><span class="chev">›</span></div>
        ${warnList(warnings, 4)}${warnings.length > 4 ? `<button class="ghost sm" data-go="#/meso/${meso.id}">See all ${warnings.length}</button>` : ''}</div>`
      : meso && doneDays ? '<div class="card good small">✓ No slip signals — reps, sets and recovery are on track.</div>' : ''}
    ${meso ? `<div class="card drill" tabindex="0" role="link" data-go="#/meso/${meso.id}"><div class="row"><div class="grow"><div class="muted small">Mesocycle</div><b>${esc(meso.name)}</b></div>
        <span class="pill ${r?.deload ? 'warn' : 'on'}">${r ? (r.deload ? 'Deload' : `Wk ${curWeek} · ${r.rir} RIR`) : ''}</span></div>
        <div class="prog"><i style="width:${Math.round(doneDays / Math.max(1, days.length) * 100)}%"></i></div>
        <div class="muted tiny" style="margin-top:4px">${doneDays}/${days.length} workouts · week ${curWeek} of ${meso.weeks}</div></div>` : ''}
    <div class="grid2">
      <button class="card stat drill" data-go="${meso ? `#/stats/workouts/${curWeek}` : '#/history'}"><span class="muted small">Workouts this week</span><span class="big">${wk.filter(d => d.completed_at).length}/${wk.length || 0}</span><span class="chev">›</span></button>
      <button class="card stat drill" data-go="#/stats/sets/${isoDay(ws)}"><span class="muted small">Sets this week</span><span class="big">${setsPerWeek[7]}</span><span class="chev">›</span></button>
      <button class="card stat drill" data-go="#/stats/cardio/${isoDay(ws)}"><span class="muted small">Cardio this week</span><span class="big">${fmt(cMin)}<span class="muted small"> min</span></span><span class="muted tiny">load ${fmt(cLoad)}</span><span class="chev">›</span></button>
      <button class="card stat drill" data-go="#/stats/prs"><span class="muted small">${meso ? 'PRs this meso' : 'PRs (14 days)'}</span><span class="big">${prCount}</span><span class="chev">›</span></button>
    </div>
    <div class="card"><div class="row"><b class="grow">Hard sets per week</b><span class="muted tiny">tap a week</span></div>${bars(setsPerWeek, maxSets, 'var(--accent)', 'sets')}</div>
    <div class="card"><div class="row"><b class="grow">Cardio minutes per week</b><span class="muted tiny">tap a week</span></div>${bars(cardioPerWeek, maxC, 'var(--info)', 'cardio')}</div>
    ${meso && lifts.length ? `<div class="card"><div class="row"><b class="grow">This meso’s lifts</b><span class="muted tiny">tap a lift for its chart</span></div>
        ${lifts.filter(x => ['regressing', 'stalled'].includes(x.status.status)).length ? `<div class="muted small" style="margin:4px 0 2px">${lifts.filter(x => ['regressing', 'stalled'].includes(x.status.status)).length} need attention — you’ll see what to do on that lift in your next workout.</div>` : ''}
        ${lifts.map((x, i) => `<button class="mover lift-row ${i >= 8 ? 'more' : ''}" data-go="#/progress/${x.id}" ${i >= 8 ? 'hidden' : ''}><span>${esc(x.name)}</span>${statusPill(x.status)}<span class="chev">›</span></button>`).join('')}
        ${lifts.length > 8 ? `<button class="ghost sm" id="moreLifts">Show all ${lifts.length}</button>` : ''}</div>` : ''}
    ${mesoPrs.length ? `<div class="card"><b>PRs this meso 🏆</b>${mesoPrs.slice(0, 5).map(p => `<button class="mover lift-row" data-go="#/progress/${p.id}"><span>${esc(p.name)}${p.n > 1 ? ` <span class="muted tiny">×${p.n}</span>` : ''}</span><span class="pill on">+${p.pct.toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    ${!meso && prs.length ? `<div class="card"><b>Recent PRs 🏆</b>${prs.slice(0, 5).map(p => `<button class="mover lift-row" data-go="#/stats/prs"><span>${esc(p.name)}</span><span class="pill on">+${Number(p.pct).toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    ${!meso && movers.length ? `<div class="card"><b>Strength trend · last 8 weeks</b>
        ${[...movers.slice(0, 3), ...movers.slice(-2).filter(m => m.pct < 0 && !movers.slice(0, 3).includes(m))].map(m => `<button class="mover lift-row" data-go="#/progress"><span>${esc(m.name)}</span>
          <span class="pill ${m.pct > 0 ? 'on' : m.pct < 0 ? 'bad' : ''}">${m.pct > 0 ? '+' : ''}${Number(m.pct).toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}
        <button class="ghost sm" data-go="#/progress">All exercises ›</button></div>` : ''}
    <div class="grid3 keep">
      <button class="card stat center drill" data-go="#/stats/totals"><span class="big">${totalWorkouts}</span><span class="muted tiny">workouts finished</span><span class="chev">›</span></button>
      <button class="card stat center drill" data-go="#/stats/totals"><span class="big">${totalSets}</span><span class="muted tiny">sets logged</span><span class="chev">›</span></button>
      <button class="card stat center drill" data-go="#/mesos"><span class="big">${mesoCount}</span><span class="muted tiny">mesocycles</span><span class="chev">›</span></button>
    </div>
    <h2>Quick actions</h2>
    <div class="grid2">
      <button class="tile" data-go="#/cardio"><span class="ico">♥︎</span><b>Log cardio</b><span class="muted small">Time + intensity</span></button>
      <button class="tile" data-go="#/volume"><span class="ico">📊</span><b>Volume</b><span class="muted small">Sets per muscle</span></button>
      <button class="tile" data-go="#/learn"><span class="ico">🎓</span><b>Learn</b><span class="muted small">Sets, reps &amp; why</span></button>
      <button class="tile" data-go="#/progress"><span class="ico">📈</span><b>Progress</b><span class="muted small">Strength per lift</span></button>
    </div>`;
  $$('[data-go]').forEach(b => { b.onclick = e => { e.stopPropagation(); go(b.dataset.go); };
    if (b.tagName === 'g' || b.classList.contains('drill')) b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(b.dataset.go); } }; });
  $('#moreLifts') && ($('#moreLifts').onclick = e => { e.stopPropagation(); $$('.lift-row.more').forEach(r => r.hidden = false); e.target.remove(); });
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
  return { step: 1, name: '', weeks: 5, days: 4, focus: 'whole', goal: 'hypertrophy', priorities: L.templatePriorities('whole'), plan: [] };
}
function builderFromTemplate(t) {
  return { step: 2, name: t.name.replace(/ \(from .*\)$/, ''), weeks: t.weeks, days: t.days_per_week, focus: t.focus, goal: L.goalOf(t.goal),
    priorities: Object.keys(t.priorities || {}).length ? t.priorities : L.templatePriorities(t.focus),
    plan: t.plan.map(d => ({ label: d.label, slots: d.slots.map(x => ({ ...x })) })) };
}
async function renderBuilder() {
  setHeader('New mesocycle', '#/mesos', 'mesos');
  const lib = await loadExercises();
  // Personal preferences (favorites, exclusions + substitutes, equipment, avoided tags) shape what autofill picks.
  const P = L.applyPreferences(lib, { prefs: await loadPrefs(), equipment: profile?.equipment, avoidTags: profile?.avoid_tags || [] });
  if (!builder) builder = freshBuilder();
  const S = builder;
  const syncPlan = () => {
    while (S.plan.length < S.days) S.plan.push({ label: 'Day ' + (S.plan.length + 1), slots: [] });
    S.plan.length = S.days;
  };
  const exById = new Map(lib.map(e => [e.id, e]));
  const exOptions = (muscle, sel) => `<option value="">— pick —</option>` +
    [...L.candidatesFor(muscle, P.library, P.favorites), ...(sel && !P.library.some(e => e.id === sel) && exById.get(sel) ? [exById.get(sel)] : [])]
      .map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${P.favorites.has(e.id) ? '★ ' : ''}${esc(e.name)}</option>`).join('');

  const step1 = () => {
    if (!S.split || !L.SPLITS[S.split]?.days.includes(S.days)) S.split = L.defaultSplit(S.days);
    const splits = L.splitsFor(S.days);
    const preview = L.splitLayout(S.split, S.days).map(d => d.label).join(' · ');
    app.innerHTML = `
      <div class="card"><div class="step-h"><span class="step-n">1</span><b>Goal</b></div>
        <div class="goal-tiles" role="radiogroup" aria-label="Training goal">${Object.entries(L.GOALS).map(([k, g]) => `<button type="button" role="radio" aria-checked="${S.goal === k}" data-goal="${k}" class="goal-tile ${S.goal === k ? 'on' : ''}"><b>${g.name}</b><span class="tiny">${esc(g.blurb)}</span></button>`).join('')}</div>
        <a class="small" href="#/learn/${S.goal}">How ${L.GOALS[L.goalOf(S.goal)].name.toLowerCase()} training works ›</a>
      </div>
      <div class="card"><div class="step-h"><span class="step-n">2</span><b>Days & split</b></div>
        <div class="row"><div class="grow"><label for="days">Training days / week</label>
          <select id="days">${[2, 3, 4, 5, 6].map(n => `<option ${n === S.days ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="grow"><label for="weeks">Weeks (last is deload)</label>
          <select id="weeks">${[3, 4, 5, 6, 7, 8].map(n => `<option ${n === S.weeks ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <div class="spacer"></div>
        ${splits.map(x => `<button class="list-btn" data-split="${x.id}" aria-pressed="${S.split === x.id}" style="${S.split === x.id ? 'border-color:var(--accent)' : ''}">
          <div class="grow"><b>${x.name}</b>${x.id === L.defaultSplit(S.days) ? ' <span class="pill on tiny-pill">recommended</span>' : ''}<div class="muted small">${esc(x.blurb)}</div></div>${S.split === x.id ? '<span class="pill on">✓</span>' : ''}</button>`).join('')}
        <div class="muted small">Your week: <b>${esc(preview)}</b></div>
      </div>
      <div class="card"><div class="step-h"><span class="step-n">3</span><b>Emphasis</b></div>
        ${Object.entries(L.TEMPLATES).map(([k, t]) => `<button class="list-btn" data-focus="${k}" style="${S.focus === k ? 'border-color:var(--accent)' : ''}">
          <div class="grow"><b>${t.name}</b><div class="muted small">${t.blurb}</div></div>${S.focus === k ? '<span class="pill on">✓</span>' : ''}</button>`).join('')}
      </div>
      <div class="card"><div class="step-h"><span class="step-n">4</span><b>Name & details</b></div>
        <label for="name">Name</label><input id="name" value="${esc(S.name)}" placeholder="e.g. Whole Body AC VIII">
        <p class="muted small">RIR is set for you${S.goal === 'hypertrophy' ? '' : ' (main lifts)'}: ${Array.from({ length: S.weeks }, (_, i) => { const r = L.targetRir(i + 1, S.weeks, S.goal, 'compound'); return r.deload ? 'deload' : r.rir; }).join(' → ')}. It holds steady for any muscle whose feedback says recovery is behind.</p>
      </div>
      <div class="card"><b>Muscle priorities</b><div class="muted small">Focus = grow (≥2×/week). Maintain = hold size with low volume. Weekly start sets shown.</div>
        ${L.MUSCLES.map(m => `<div class="prio"><div>${m} <span class="muted small">${L.weeklyTarget(m, S.priorities[m], S.focus, S.goal)} sets</span></div>
          <div class="seg c3">${L.PRIORITIES.map(p => `<button type="button" data-m="${m}" data-p="${p}" class="${S.priorities[m] === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>`).join('')}
      </div>
      <button class="primary block" id="next">Next: build the days ›</button>`;
    $$('[data-focus]').forEach(b => b.onclick = () => { S.focus = b.dataset.focus; S.priorities = L.templatePriorities(S.focus); step1(); });
    $$('[data-goal]').forEach(b => b.onclick = () => { S.goal = b.dataset.goal; step1(); });
    $$('[data-split]').forEach(b => b.onclick = () => { S.split = b.dataset.split; S.plan = []; step1(); });
    $('#name').oninput = e => S.name = e.target.value;
    $('#weeks').onchange = e => { S.weeks = +e.target.value; step1(); };
    $('#days').onchange = e => { S.days = +e.target.value; S.split = null; S.plan = []; step1(); };
    $$('[data-p]').forEach(b => b.onclick = () => {
      S.priorities[b.dataset.m] = b.dataset.p;
      step1();
    });
    $('#next').onclick = () => {
      if (!S.name.trim()) return toast('Give it a name', true);
      S.days = +$('#days').value; syncPlan(); S.step = 2;
      if (!S.plan.some(d => d.slots.length)) S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, goal: S.goal, split: S.split, library: P.library, favorites: P.favorites, mode: 'all' });
      step2();
    };
  };

  const step2 = () => {
    const targets = L.weeklyTargets(S.priorities, S.focus, S.goal), placed = L.placedSets(S.plan);
    const dayTotals = S.plan.map(d => d.slots.reduce((a, s) => a + (Number(s.sets) || 0), 0));
    app.innerHTML = `
      ${P.removed.length ? `<div class="card small muted">Autofill is skipping ${P.removed.length} exercise${P.removed.length > 1 ? 's' : ''} because of your preferences${P.favorites.size ? ` and putting your ${P.favorites.size} favorite${P.favorites.size > 1 ? 's' : ''} first` : ''}. <a href="#/settings">Change</a></div>` : ''}
      ${S.carry ? `<div class="card small">Week 1 weights &amp; reps start from <b>${esc(S.carry.from)} · week ${S.carry.week}</b>. <button class="ghost sm" id="noCarry">Don't carry</button></div>` : ''}
      <div class="card"><div class="muted small">Step 2 of 2 · ${L.GOALS[L.goalOf(S.goal)].name} · ${esc(L.SPLITS[S.split]?.name || '')} · ${esc(L.TEMPLATES[S.focus].name)} emphasis · ${S.days} days</div>
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
    { const nc = $('#noCarry'); if (nc) nc.onclick = () => { S.carry = null; step2(); }; }
    $('#fillAll').onclick = () => { S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, goal: S.goal, split: S.split, library: P.library, favorites: P.favorites, mode: 'all' }); step2(); };
    $('#fillLeft').onclick = () => { S.plan = L.autofill({ plan: S.plan, priorities: S.priorities, focus: S.focus, goal: S.goal, split: S.split, library: P.library, favorites: P.favorites, mode: 'fill' }); step2(); };
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
        exercises: d.slots.map(s => { const { rir, deload } = L.targetRir(w, S.weeks, S.goal, libById.get(s.exerciseId)?.kind);
          return { exercise_id: s.exerciseId, target_sets: deload ? L.deloadSets(s.sets) : Number(s.sets), target_rir: rir }; }) }));
    }
    const { data: mesoId, error } = await sb.rpc('create_mesocycle', { p: { client_key: S.clientKey, name: S.name.trim(), weeks: S.weeks,
      days_per_week: S.days, focus: S.focus, goal: L.goalOf(S.goal), priorities: S.priorities, started_on: today(), days,
      carry_meso_id: S.carry?.meso || null, carry_week: S.carry?.week || null } });
    if (error) {
      btn.disabled = false; btn.textContent = 'Create mesocycle';
      return toast(/fetch|network|failed to fetch/i.test(error.message) ? 'No connection — nothing was saved. Tap Create again when you’re back online.' : `Couldn’t create the mesocycle: ${error.message}`, true);
    }
    builder = null; toast('Mesocycle created'); go('#/meso/' + mesoId);
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
    <div class="card"><div class="row"><div class="grow muted small">${meso.source === 'rp_import' ? 'Imported from RP · ' : ''}${L.GOALS[L.goalOf(meso.goal)].name} · ${esc(L.TEMPLATES[meso.focus]?.name || '')} · ${meso.weeks} weeks · ${meso.days_per_week} days/week</div>
      <span class="pill ${meso.status === 'active' ? 'on' : ''}">${esc(meso.status)}</span></div></div>
    ${warnings.length ? `<div class="card warn"><b>Watch list</b>${warnList(warnings)}</div>` : ''}
    <div class="weeks-scroll"><div class="weeks" style="--days:${meso.days_per_week}">
      ${weeks.map(w => { const r = L.targetRir(w, meso.weeks, meso.goal, 'compound'); return `<div class="week">
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
      builder = builderFromTemplate({ name: meso.name + ' (again)', weeks: meso.weeks, days_per_week: meso.days_per_week, focus: meso.focus, goal: meso.goal, priorities: meso.priorities, plan });
      builder.carry = w ? { meso: meso.id, week: w, from: meso.name } : null;
      closeSheet(); go('#/new');
    };
    if (!logged.length) return start(null);
    openSheet(`<h3>Start the new meso from which week?</h3>
      <p class="muted small">Week 1 of the new meso starts from the weights and reps you logged that week, then progresses week over week. Go back up to two weeks before the last one to back off and build up again.</p>
      ${choices.slice().reverse().map(w => { const r = L.targetRir(w, meso.weeks, meso.goal, 'compound'), n = doneIn(w);
        return `<button class="list-btn" data-week="${w}" ${n ? '' : 'disabled'}><div class="grow"><b>Week ${w}</b>${w === lastWorking ? ' <span class="pill on tiny-pill">last before deload</span>' : ` <span class="tiny muted">${lastWorking - w} week${lastWorking - w > 1 ? 's' : ''} back</span>`}<div class="muted small">${r.rir} RIR · ${n}/${total(w)} workouts logged</div></div>›</button>`; }).join('')}
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
  // Sets saved on the phone but not yet synced win over the server copy, so nothing typed offline disappears.
  const pending = qLoad();
  wes.forEach(w => Object.values(pending).filter(p => p.workout_exercise_id === w.id).forEach(p => {
    const i = w.sets.findIndex(x => x.set_index === p.set_index); const row = { ...(w.sets[i] || {}), ...p, _queued: true };
    if (i >= 0) w.sets[i] = row; else w.sets.push(row); }));
  wes.forEach(w => { w.sets.sort((a, b) => a.set_index - b.set_index); w.sets.forEach(x => { x.weight = W(x.weight); }); });
  // The meso's goal sets each exercise's rep range (hypertrophy keeps the exercise's own range).
  const goal = L.goalOf(meso.goal);
  wes.forEach(w => { w.exercises = { ...w.exercises, ...L.repRange(w.exercises, goal) }; });
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
  const prev = {}, staleCarry = {}; let prevFb = {};
  const trail = {};   // exercise_id → [{ week, weight, reps }] first working set per earlier meso week (doc §4.0)
  const addTrail = (id, week, sets) => { const f = (sets || []).filter(z => z.reps != null && z.duration_min == null).sort((a, b) => a.set_index - b.set_index)[0];
    if (!f) return; const t = trail[id] = trail[id] || []; if (!t.some(x => x.week === week)) t.push({ week, weight: Number(f.weight), reps: Number(f.reps) }); };
  if (day.week > 1) {
    const ids0 = [...new Set(wes.map(w => w.exercise_id))];
    if (ids0.length) check(await sb.from('workout_exercises').select('exercise_id, sets(set_index, weight, reps, duration_min), workout_days!inner(week, mesocycle_id)')
      .in('exercise_id', ids0).eq('workout_days.mesocycle_id', meso.id).lt('workout_days.week', day.week).order('id'))
      .forEach(x => addTrail(x.exercise_id, x.workout_days.week, x.sets));
    const pd = check(await sb.from('workout_days').select('id').eq('mesocycle_id', meso.id).eq('week', day.week - 1).eq('day_index', day.day_index).maybeSingle());
    if (pd) {
      check(await sb.from('workout_exercises').select('exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe)').eq('workout_day_id', pd.id))
        .forEach(x => prev[x.exercise_id] = { rir: x.target_rir, sets: x.sets.sort((a, b) => a.set_index - b.set_index).map(z => ({ ...z, weight: W(z.weight) })) });
      check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', pd.id)).forEach(f => prevFb[f.muscle_group] = f);
    }
  } else {
    // Week 1 carries over from your last finished mesocycle: its final working week for the same exercise.
    const ids = [...new Set(wes.map(w => w.exercise_id))];
    const hist = ids.length ? await fetchAll(() => sb.from('workout_exercises')
      .select('exercise_id, target_rir, sets(set_index, weight, reps, rir, duration_min, rpe), workout_days!inner(week, completed_at, mesocycle_id, mesocycles(weeks, name))')
      .in('exercise_id', ids).neq('workout_days.mesocycle_id', meso.id).not('workout_days.completed_at', 'is', null).order('id')) : [];
    // Week 1 progresses from your PREVIOUS meso only (the one you trained most recently, finished or not) — doc §5.6.
    // An exercise that wasn't in it gets no auto weight: older history (e.g. a 2025 rehab block) can't be translated,
    // so it's shown for reference only.
    // "Run it again from week N" pins the source meso and week instead.
    const last = meso.carry_meso_id ? null : check(await sb.from('workout_days').select('mesocycle_id, completed_at').neq('mesocycle_id', meso.id)
      .not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle());
    const prevMesoId = meso.carry_meso_id || last?.mesocycle_id || null;
    for (const h of hist) {
      const d = h.workout_days; if (!h.sets.length || L.rirForWeek(d.week, d.mesocycles?.weeks || 99).deload) continue;
      if (meso.carry_week && d.mesocycle_id === meso.carry_meso_id && d.week !== meso.carry_week) continue;
      if (d.mesocycle_id === prevMesoId) addTrail(h.exercise_id, d.week, h.sets);
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
    return `<div class="muted tiny hist-note">📌 ${Math.round((1 - lastE / best) * 100)}% below your all-time best estimate — for reference only; today's targets come from last week.</div>`; };
  const FLAG = { stalled: '⚠️', regressing: '📉', pr: '🏆' };
  const liftFlag = we => { const x = insights[we.exercise_id]; if (!x || !FLAG[x.status.status] || day.completed_at) return '';
    const st = x.status, head = st.status === 'pr' ? `New best last time (+${st.pct.toFixed(1)}%)` : st.status === 'stalled' ? 'Stalled — no gain 2 weeks running' : `Down ${Math.abs(st.pct).toFixed(1)}% for 2 weeks`;
    return `<button class="lift-flag st-${st.status}" data-flag="${we.id}" aria-label="${esc(head)}: show recommendation"><span>${FLAG[st.status]}</span><span><b>${head}.</b> ${esc(st.rec.split('. ').slice(1, 2).join('') || '')}${st.status === 'pr' ? '' : ' <u>More</u>'}</span></button>`; };
  const feedback = {};
  check(await sb.from('muscle_feedback').select('*').eq('workout_day_id', dayId)).forEach(f => feedback[f.muscle_group] = f);
  if (!day.started_at && !day.completed_at) {
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
      jointHold: (prevFb[we.exercises.muscle_group]?.joint_pain ?? 0) >= 2, unit: unit(), mode: modeFor(we),
      speed: L.progressionSpeed(prevFb[we.exercises.muscle_group]) });
  };
  const lastOfMuscle = {}; wes.filter(w => !isCardio(w)).forEach(w => lastOfMuscle[w.exercises.muscle_group] = w.id);
  const firstOfMuscle = {}; wes.filter(w => !isCardio(w)).forEach(w => { firstOfMuscle[w.exercises.muscle_group] ??= w.id; });
  const infoBtn = we => `<button class="ghost sm" data-info="${we.id}" aria-label="Warm-up and tips for ${esc(we.exercises.name)}" title="Warm-up & tips">ⓘ</button>`;
  const todayWarn = day.completed_at ? [] : (await slipFor(meso)).filter(w => !w.muscle || muscles.includes(w.muscle));
  const cardioCard = we => {
    const n = Math.max(we.sets.length, we.target_sets || 0, 1);
    return `<div class="card" data-we="${we.id}" data-muscle="Cardio">
      <div class="row"><div class="grow"><h3>♥︎ ${esc(we.exercises.name)} <span class="trend" data-trend="${we.id}"></span></h3>
        <div class="muted small">Cardio · minutes + intensity (RPE 0 easy → 10 max)</div></div>
        ${infoBtn(we)}<button class="ghost sm" data-edit="Cardio" aria-label="Edit ratings" title="Edit ratings">✎</button></div>
      <div class="sets"><div class="set-head"><div>#</div><div>min</div><div>RPE</div><div></div></div>
        ${Array.from({ length: n }, (_, i) => { const s = we.sets.find(x => x.set_index === i + 1) || {};
          return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}"><div class="n">${i + 1}</div>
            <input type="number" inputmode="decimal" step="any" data-f="duration" value="${s.duration_min ?? ''}" placeholder="min">
            <input type="number" inputmode="numeric" min="0" max="10" data-f="rpe" value="${s.rpe ?? ''}" placeholder="0–10">
            <button class="check">✓</button></div>`; }).join('')}
      </div>
      <div class="row" style="margin-top:8px"><button class="ghost sm" data-addset>+ bout</button><button class="ghost sm" data-rmset>− bout</button></div></div>`;
  };

  app.innerHTML = `
    ${day.completed_at ? '<div class="card good small">Finished ✓ — you can still edit sets and ratings.</div>' : ''}
    ${day.completed_at ? '' : (() => { let seen = false; try { seen = localStorage.getItem('wl_warmup_seen') === '1'; } catch {}
      return seen ? '<div class="muted small warm-line">🔥 Warm up first — tap ⓘ on each muscle’s first exercise for ramp-up sets. Warm-ups aren’t logged.</div>'
        : `<div class="card info small" id="warmNote"><b>🔥 Warm up before your first set</b>
          <ol class="tight"><li>5 min easy cardio + a few dynamic moves (leg swings, arm circles, bodyweight squats).</li>
          <li>On the <b>first exercise for each muscle</b>, tap <b>ⓘ</b> for 2–3 light ramp-up sets worked out from today’s weight.</li>
          <li>Warm-up sets are <b>not logged</b> and never count toward your sets or progress — only log working sets.</li></ol>
          <button class="ghost sm" id="warmOk">Got it</button></div>`; })()}
    ${deload ? '<div class="card info small"><b>Deload week.</b> Same weights as last week, half the sets, stop well short of failure (≈4 RIR).</div>' : ''}
    ${!deload && goal === 'athletic' ? '<div class="card info small"><b>Athleticism.</b> Move every rep of the main lifts as fast as you can with good form, and end the set when the speed drops — even if reps are left.</div>' : ''}
    ${!deload && goal === 'strength' ? '<div class="card info small"><b>Strength.</b> Heavy main lifts first while you’re fresh; rest 3–5 min between them. Never grind to failure.</div>' : ''}
    ${todayWarn.length ? `<div class="card warn"><b>Heads up for today</b>${warnList(todayWarn, 5)}</div>` : ''}
    ${wes.map(we => {
      if (isCardio(we)) return cardioCard(we);
      const ex = we.exercises; const n = Math.max(we.sets.length, we.target_sets || 0, 1);
      const p = prev[we.exercise_id];
      return `<div class="card" data-we="${we.id}" data-muscle="${esc(ex.muscle_group)}">
        <div class="row"><div class="grow"><h3>${esc(ex.name)} <span class="trend" data-trend="${we.id}"></span></h3>
          <div class="muted small">${esc(ex.muscle_group)} · ${we.target_sets} sets · ${deload ? 'deload' : `${we.target_rir} RIR`} · ${ex.rep_min}–${ex.rep_max} reps${!deload && !isCardio(we) && prev[we.exercise_id]?.sets.length && ex.load_type === 'weighted' ? (m => ` · <span class="prog-mode" title="How this lift progresses week to week">${m.mode === 'load' ? `progresses +${fmt(m.step)} ${unit()}` : 'progresses by reps'}</span>`)(modeFor(we)) : ''}</div>
          ${(w => w ? `<div class="muted tiny range">Weight window ${fmt(w.light)}–${fmt(w.heavy)} ${unit()} · change the weight and the reps re-target to match last time</div>` : '')(windowFor(we))}</div>
          ${infoBtn(we)}<button class="ghost sm" data-edit="${esc(ex.muscle_group)}" aria-label="Edit ratings" title="Edit ratings">✎</button></div>
        ${(n => n && n !== 'Deload' && !day.completed_at ? `<div class="muted tiny prog-note">${/faster|extra rep/i.test(n) ? '⤴︎' : /holding|smaller|same weight/i.test(n) ? '⏸︎' : '↗︎'} This week: ${esc(n)}</div>` : '')(isCardio(we) ? null : suggestionFor(we, 0)?.note)}
        ${we.flag ? `<div class="pill bad" style="margin-top:6px">${esc(we.flag)}</div>` : ''}
        ${liftFlag(we)}${histNote(we)}
        <div class="sets"><div class="set-head"><div>#</div><div>${wLabel(ex)}</div><div>reps</div><div></div></div>
          ${Array.from({ length: n }, (_, i) => {
            const s = we.sets.find(x => x.set_index === i + 1) || {}; const sg = suggestionFor(we, i);
            const wVal = s.weight ?? sg?.weight ?? (ex.load_type !== 'weighted' && s.reps == null ? '' : '');
            return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}" data-at="${s.completed_at || ''}">
              <div class="n">${i + 1}</div>
              <div class="fld"><input type="number" inputmode="decimal" step="any" data-f="weight" aria-label="Set ${i + 1} weight (${wLabel(ex)})" value="${wVal ?? ''}" class="${s.weight == null && sg?.weight != null ? 'sug' : ''}" placeholder="${ex.load_type === 'weighted' ? unit() : '0'}"><span class="dir" data-dir="weight"></span></div>
              <div class="fld"><input type="number" inputmode="numeric" data-f="reps" aria-label="Set ${i + 1} reps" value="${s.reps ?? ''}" placeholder="${sg?.reps != null ? (sg.note?.includes('same reps') ? `${sg.reps}–${sg.reps + 1}` : sg.reps) : ex.rep_min + '–' + ex.rep_max}" data-sug="${sg?.reps ?? ''}"><span class="dir" data-dir="reps"></span></div>
              <button class="check" aria-label="Set ${i + 1} done">✓</button></div>`;
          }).join('')}
        </div>
        <div class="row" style="margin-top:8px"><button class="ghost sm" data-addset>+ set</button><button class="ghost sm" data-rmset>− set</button>
          <span class="grow muted tiny right">${p?.sets.length ? (p.carried ? `last meso wk ${p.wk}: ` : 'last wk: ') + p.sets.map(s => `${fmt(s.weight)}×${s.reps ?? '–'}`).join(', ')
            : staleCarry[we.exercise_id] ? `${esc(staleCarry[we.exercise_id].mname)} wk ${staleCarry[we.exercise_id].wk} (${staleCarry[we.exercise_id].sets.map(s => `${fmt(s.weight)}×${s.reps ?? '–'}`).join(', ')}) — not in your last meso, so not used. Pick a fresh weight for ${deload ? 'deload' : `${we.target_rir} RIR`}`
            : 'first week — pick weights for ' + (deload ? '' : `${we.target_rir} RIR`)}</span></div>
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
    const a = L.bestE1rm(cur, we.exercises, bwD()), b = L.bestE1rm(p.sets.map(x => ({ ...x, rir: x.rir ?? p.rir })), we.exercises, bwD());
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
      el.className = `dir ${good}`; el.textContent = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '=';
      el.title = `${f === 'weight' ? 'Weight' : 'Reps'} ${dir === 'level' ? 'same as' : dir + ' vs'} ${vs} (${fmt(was)} → ${fmt(raw)})`;
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
        reps, rir: we.target_rir, completed_at: done ? (row.dataset.at || new Date().toISOString()) : null };
    };
    if (row.classList.contains('done')) row.dataset.saved = JSON.stringify(payloadFor(true)); // what the server already has
    const save = async markDone => {
      const wIn = row.querySelector('[data-f="weight"]'), rIn = row.querySelector('[data-f="reps"]');
      if (markDone && rIn.value === '' && rIn.dataset.sug) rIn.value = rIn.dataset.sug;
      const weight = wIn.value === '' ? null : Number(wIn.value), reps = rIn.value === '' ? null : Number(rIn.value);
      const done = markDone ? !row.classList.contains('done') : row.classList.contains('done');
      if (markDone && done && reps == null) return toast('Enter reps first', true);
      if (markDone && done && weight == null && we.exercises.load_type === 'weighted') return toast('Enter the weight first', true);
      if (!markDone && weight == null && reps == null) return;
      const payload = payloadFor(done);
      const sig = JSON.stringify(payload);
      if (!markDone && sig === row.dataset.saved) return;          // nothing changed → no request
      if (row.dataset.busy) { row.dataset.again = '1'; return; }    // a save is in flight; send the latest once it lands
      row.dataset.busy = '1'; row.dataset.key = setKey(payload); row.classList.remove('failed', 'queued'); row.classList.add('saving');
      const res = await saveSet(payload);
      delete row.dataset.busy; row.classList.remove('saving');
      if (res === 'failed') { row.classList.add('failed'); return; }
      if (res === 'queued') { row.classList.add('queued'); if (markDone && done) toast('No signal — saved on your phone, will sync automatically'); }
      row.dataset.saved = sig;
      if (row.dataset.again) { delete row.dataset.again; save(false); }
      row.dataset.at = payload.completed_at || ''; wIn.classList.remove('sug');
      row.classList.toggle('done', done);
      updateDirs(we, row);
      const m = we.exercises.muscle_group;
      refreshTrend(we);
      // Notice every time a finished set is under last week (orange ▼) — not just the first time.
      const behind = markDone && done ? [...row.querySelectorAll('.dir.back')].map(el => el.title).filter(Boolean) : [];
      const setNote = behind.length ? `Set ${row.dataset.idx}: ${behind.join(' · ')}.` : '';
      if (markDone && done && exComplete(we)) { const tr = exerciseTrend(we);
        const exNote = tr ? `${we.exercises.name}: ${tr.t > 0 ? '▲ up' : tr.t < 0 ? '▼ down' : '● same'} ${tr.pct > 0 ? '+' : ''}${tr.pct.toFixed(1)}% vs ${tr.vs}` : '';
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
      const last = baseFor(we, +row.dataset.idx - 1), lastW = last?.weight != null ? W(last.weight) : null;
      const odd = L.weightSanity(lastW, wIn.value);
      wIn.classList.toggle('odd', !!odd);
      if (odd) toast(`${fmtNum(+wIn.value)} ${unit()} is ${odd.kind === 'high' ? 'way more' : 'way less'} than last time (${fmtNum(lastW)} ${unit()}) — typo? It still saves if it's right.`, true);
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
      if (row.dataset.busy) return;
      row.dataset.busy = '1'; row.classList.remove('failed', 'queued'); row.classList.add('saving');
      const payload = { workout_exercise_id: we.id, set_index: +row.dataset.idx, duration_min: duration, rpe,
        weight: null, reps: null, completed_at: done ? new Date().toISOString() : null };
      row.dataset.key = setKey(payload);
      const res = await saveSet(payload);
      delete row.dataset.busy; row.classList.remove('saving');
      if (res === 'failed') { row.classList.add('failed'); return; }
      if (res === 'queued') row.classList.add('queued');
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
      row.dataset.idx = idx; row.dataset.at = ''; delete row.dataset.saved; delete row.dataset.busy; row.dataset.key = we.id + ':' + idx;
      row.classList.remove('done', 'queued', 'failed', 'saving'); row.querySelector('.n').textContent = idx;
      row.querySelectorAll('input').forEach(i => { if (i.dataset.f !== 'weight') i.value = ''; i.classList.remove('sug'); });
      setsEl.appendChild(row); wireSet(we, row);
    };
    card.querySelector('[data-rmset]').onclick = async () => {
      const rows = card.querySelectorAll('.set'); if (rows.length <= 1) return;
      const last = rows[rows.length - 1];
      await sb.from('sets').delete().eq('workout_exercise_id', we.id).eq('set_index', +last.dataset.idx); last.remove();
    };
  });

  $('#warmOk') && ($('#warmOk').onclick = () => { try { localStorage.setItem('wl_warmup_seen', '1'); } catch {} $('#warmNote').outerHTML = '<div class="muted small warm-line">🔥 Warm up first — tap ⓘ on each muscle’s first exercise for ramp-up sets. Warm-ups aren’t logged.</div>'; });
  const trendSheet = we => { const x = insights[we.exercise_id]; if (!x) return;
    openSheet(`<h3>${esc(we.exercises.name)}</h3><div class="row" style="margin:6px 0">${statusPill(x.status)}<span class="muted small">by meso week · reps × load</span></div>
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
      <div class="muted small">${isCardio(we) ? 'Cardio' : `${esc(ex.muscle_group)} · ${we.target_rir} RIR · ${ex.rep_min}–${ex.rep_max} reps`}</div>
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
    fresh.forEach(w => w.sets.forEach(x => { x.weight = W(x.weight); }));
    const bw = bwD();
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
    ['#/learn', '🎓', 'Learn', 'Sets, reps and effort for size, strength, athleticism and cardio — with the research'],
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

// ---------- Home drill-downs (#/stats/<kind>/<arg>) ----------
async function renderStats(kind, arg) {
  const wkNav = (base, startIso) => { const d = new Date(startIso + 'T12:00'); const p = new Date(d), n = new Date(d); p.setDate(p.getDate() - 7); n.setDate(n.getDate() + 7);
    const cur = isoDay(weekStart()); return `<div class="row wk-nav"><button class="ghost sm" data-go="${base}/${isoDay(p)}">‹ Prev week</button><b class="grow center">Week of ${d.getMonth() + 1}/${d.getDate()}${startIso === cur ? ' (this week)' : ''}</b>${isoDay(n) <= cur ? `<button class="ghost sm" data-go="${base}/${isoDay(n)}">Next week ›</button>` : '<span style="width:84px"></span>'}</div>`; };
  const wire = () => $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const range = iso => { const a = new Date(iso + 'T00:00'); const b = new Date(a); b.setDate(b.getDate() + 7); return [a, b]; };
  const isIso = x => /^\d{4}-\d{2}-\d{2}$/.test(x || '');

  if (kind === 'workouts') {
    const meso = await activeMeso(); if (!meso) return go('#/history');
    const days = await mesoDays(meso.id); const weeksAll = [...new Set(days.map(d => d.week))];
    const w = Number(arg) || (openDays(days)[0]?.week ?? weeksAll.at(-1));
    setHeader(`Week ${w} workouts`, '#/', 'home');
    const wd = days.filter(d => d.week === w);
    const wes = wd.length ? check(await sb.from('workout_exercises').select('workout_day_id, target_sets, exercises(name, muscle_group, load_type), sets(completed_at, duration_min, set_type)').in('workout_day_id', wd.map(d => d.id))) : [];
    const r = L.targetRir(w, meso.weeks, meso.goal, 'compound');
    const st = d => d.completed_at ? ['done', 'on', 'Done'] : d.skipped_at ? ['skipped', '', 'Skipped'] : d.started_at ? ['live', 'warn', 'In progress'] : ['open', '', 'Not started'];
    app.innerHTML = `<div class="row wk-nav">${w > 1 ? `<button class="ghost sm" data-go="#/stats/workouts/${w - 1}">‹ Week ${w - 1}</button>` : '<span></span>'}
        <b class="grow center">${esc(meso.name)} · ${r.deload ? 'deload' : r.rir + ' RIR'}</b>${w < meso.weeks ? `<button class="ghost sm" data-go="#/stats/workouts/${w + 1}">Week ${w + 1} ›</button>` : '<span></span>'}</div>
      <div class="card"><div class="big">${wd.filter(d => d.completed_at).length}/${wd.length}</div><div class="muted small">workouts finished in week ${w}${wd.some(d => d.skipped_at) ? ` · ${wd.filter(d => d.skipped_at).length} skipped` : ''}</div></div>
      ${wd.map(d => { const [cls, pill, txt] = st(d); const ex = wes.filter(x => x.workout_day_id === d.id);
        const lifts = ex.filter(x => x.exercises?.load_type !== 'cardio');
        const done = lifts.reduce((a, x) => a + x.sets.filter(z => z.completed_at && z.set_type !== 'warmup').length, 0), planned = lifts.reduce((a, x) => a + (x.target_sets || 0), 0);
        const muscles = [...new Set(lifts.map(x => x.exercises?.muscle_group).filter(Boolean))];
        return `<button class="list-btn" data-go="#/workout/${d.id}"><div class="grow"><b>${esc(dayName(d))}</b> <span class="pill ${pill}">${txt}</span>
          <div class="muted small">${done}/${planned} sets · ${ex.length} exercises${muscles.length ? ' · ' + esc(muscles.join(', ')) : ''}</div></div>›</button>`; }).join('')}
      <button class="ghost block" data-go="#/meso/${meso.id}">Whole meso ›</button>`;
    return wire();
  }

  if (kind === 'sets') {
    const iso = isIso(arg) ? arg : isoDay(weekStart()); const [a, b] = range(iso);
    setHeader('Hard sets', '#/', 'home');
    const rows = await fetchAll(() => sb.from('sets').select('id, weight, reps, rir, set_type, completed_at, workout_exercises!inner(id, exercise_id, exercises!inner(name, muscle_group, load_type), workout_days(id, week, label, day_index, mesocycles(name)))')
      .not('completed_at', 'is', null).is('duration_min', null).gte('completed_at', a.toISOString()).lt('completed_at', b.toISOString()).order('id'));
    const hard = rows.filter(x => x.workout_exercises.exercises.load_type !== 'cardio' && x.set_type !== 'warmup');
    const byM = {}; for (const x of hard) { const m = x.workout_exercises.exercises.muscle_group; const e = x.workout_exercises.exercises.name;
      (byM[m] = byM[m] || { n: 0, ex: {} }).n++; const q = byM[m].ex[e] = byM[m].ex[e] || { n: 0, id: x.workout_exercises.exercise_id, top: null };
      q.n++; if (!q.top || L.e1rm(x, x.workout_exercises.exercises, profile?.bodyweight) > L.e1rm(q.top, x.workout_exercises.exercises, profile?.bodyweight)) q.top = x; }
    const muscles = Object.entries(byM).sort((p, q) => q[1].n - p[1].n), max = Math.max(1, ...muscles.map(m => m[1].n));
    const byDay = {}; for (const x of hard) { const d = x.workout_exercises.workout_days; if (!d) continue; (byDay[d.id] = byDay[d.id] || { d, n: 0 }).n++; }
    app.innerHTML = wkNav('#/stats/sets', iso) + `
      <div class="card"><div class="big">${hard.length}</div><div class="muted small">hard sets (warm-ups and cardio not counted)</div></div>
      ${muscles.length ? `<div class="card"><b>By muscle</b><div class="muted tiny">tap a muscle for its exercises</div>
        ${muscles.map(([m, v]) => `<details class="drill-m"><summary><span class="mname">${esc(m)}</span><span class="hbar"><i style="width:${Math.round(v.n / max * 100)}%"></i></span><b>${v.n}</b></summary>
          ${Object.entries(v.ex).map(([e, q]) => `<button class="mover lift-row" data-go="#/progress/${q.id}"><span>${esc(e)} <span class="muted tiny">${q.n} set${q.n > 1 ? 's' : ''} · best ${fmt(W(q.top.weight))}×${q.top.reps}</span></span><span class="chev">›</span></button>`).join('')}</details>`).join('')}</div>` : '<p class="muted center">No hard sets this week.</p>'}
      ${Object.keys(byDay).length ? `<div class="card"><b>By workout</b>${Object.values(byDay).map(({ d, n }) => `<button class="mover lift-row" data-go="#/workout/${d.id}"><span>${esc(d.mesocycles?.name || '')} · wk ${d.week} · ${esc(dayName(d))}</span><span class="pill">${n} sets</span><span class="chev">›</span></button>`).join('')}</div>` : ''}
      <button class="ghost block" data-go="#/volume">Sets per muscle vs targets (Volume) ›</button>`;
    return wire();
  }

  if (kind === 'cardio') {
    const iso = isIso(arg) ? arg : isoDay(weekStart()); const [a, b] = range(iso);
    setHeader('Cardio', '#/', 'home');
    const [cs, ws] = await Promise.all([cardioSince(iso), workoutCardioSince(a.toISOString())]);
    const items = cardioItems(cs, ws).filter(c => c.date >= iso && c.date < isoDay(b)).sort((p, q) => q.date.localeCompare(p.date));
    const mins = items.reduce((t, c) => t + c.minutes, 0), load = items.reduce((t, c) => t + L.cardioLoad(c), 0);
    const byA = {}; for (const c of items) { const k = c.name; (byA[k] = byA[k] || { n: 0, min: 0 }); byA[k].n++; byA[k].min += c.minutes; }
    app.innerHTML = wkNav('#/stats/cardio', iso) + `
      <div class="grid2"><div class="card stat"><span class="muted small">Minutes</span><span class="big">${fmt(mins)}</span></div><div class="card stat"><span class="muted small">Load (RPE × min)</span><span class="big">${fmt(load)}</span></div></div>
      ${items.length ? `<div class="card"><b>By activity</b>${Object.entries(byA).map(([k, v]) => `<div class="mover"><span>${esc(k)}</span><span class="muted small">${v.n}× · ${fmt(v.min)} min</span></div>`).join('')}</div>
      <div class="card"><b>Sessions</b>${items.map(c => `<div class="mover"><span>${esc(c.name)} <span class="muted tiny">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(new Date(c.date + 'T12:00').getDay() + 6) % 7]}</span></span><span class="muted small">${fmt(c.minutes)} min${c.rpe ? ` · RPE ${c.rpe}` : ''}</span></div>`).join('')}</div>` : '<p class="muted center">No cardio this week.</p>'}
      <button class="ghost block" data-go="#/cardio">Log cardio / all cardio ›</button>`;
    return wire();
  }

  if (kind === 'prs') {
    setHeader('PRs', '#/', 'home');
    const meso = await activeMeso();
    if (!meso) { const st = await sb.rpc('dashboard_stats', { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }).then(check);
      app.innerHTML = `<div class="card"><b>PRs in the last 14 days</b>${(st.prs || []).map(p => `<div class="mover"><span>${esc(p.name)}</span><span class="pill on">+${Number(p.pct).toFixed(1)}%</span></div>`).join('') || '<p class="muted">None yet.</p>'}</div><button class="ghost block" data-go="#/progress">All exercises ›</button>`;
      return wire(); }
    const ids = [...new Set(check(await sb.from('workout_exercises').select('exercise_id, exercises!inner(load_type), workout_days!inner(mesocycle_id)').eq('workout_days.mesocycle_id', meso.id))
      .filter(x => x.exercises.load_type !== 'cardio').map(x => x.exercise_id))];
    const ins = Object.values(await liftInsights(ids, { meso: meso.id }));
    const prs = ins.filter(x => x.prs.count).sort((p, q) => q.prs.count - p.prs.count || q.prs.last.pct - p.prs.last.pct);
    const none = ins.filter(x => !x.prs.count).sort((p, q) => p.name.localeCompare(q.name));
    app.innerHTML = `<div class="card"><div class="big">${prs.reduce((t, x) => t + x.prs.count, 0)}</div><div class="muted small">PRs this meso across ${prs.length} lift${prs.length === 1 ? '' : 's'} · a PR = best weekly strength estimate beats every earlier one by more than 1%</div></div>
      ${prs.length ? `<div class="card"><b>Lifts with PRs 🏆</b>${prs.map(x => `<button class="mover lift-row" data-go="#/progress/${x.id}/meso"><span>${esc(x.name)} <span class="muted tiny">${x.prs.count}× · latest +${x.prs.last.pct.toFixed(1)}% in wk ${x.prs.last.week}</span></span>${statusPill(x.status)}<span class="chev">›</span></button>`).join('')}</div>` : ''}
      ${none.length ? `<div class="card"><b>No PR yet this meso</b>${none.map(x => `<button class="mover lift-row" data-go="#/progress/${x.id}/meso"><span>${esc(x.name)}</span>${statusPill(x.status)}<span class="chev">›</span></button>`).join('')}</div>` : ''}`;
    return wire();
  }

  if (kind === 'totals') {
    setHeader('All-time totals', '#/', 'home');
    const [mesos, days, sets] = await Promise.all([
      sb.from('mesocycles').select('id, name, status, weeks, created_at').order('created_at', { ascending: false }).then(check),
      fetchAll(() => sb.from('workout_days').select('id, mesocycle_id, completed_at, skipped_at').not('completed_at', 'is', null).order('id')),
      fetchAll(() => sb.from('sets').select('id, set_type, workout_exercises!inner(exercises!inner(load_type), workout_days!inner(mesocycle_id))')
        .not('completed_at', 'is', null).is('duration_min', null).order('id')),
    ]);
    const per = {}; for (const m of mesos) per[m.id] = { m, w: 0, s: 0 };
    for (const d of days) if (!d.skipped_at && per[d.mesocycle_id]) per[d.mesocycle_id].w++;
    for (const x of sets) { if (x.set_type === 'warmup' || x.workout_exercises.exercises.load_type === 'cardio') continue; const k = x.workout_exercises.workout_days?.mesocycle_id; if (per[k]) per[k].s++; }
    const list = Object.values(per).filter(x => x.w || x.s);
    app.innerHTML = `<div class="grid2"><div class="card stat"><span class="muted small">Workouts finished</span><span class="big">${list.reduce((t, x) => t + x.w, 0)}</span></div>
        <div class="card stat"><span class="muted small">Hard sets logged</span><span class="big">${list.reduce((t, x) => t + x.s, 0)}</span></div></div>
      <div class="card"><b>By mesocycle</b><div class="muted tiny">newest first · tap to open</div>
        ${list.map(x => `<button class="mover lift-row" data-go="#/meso/${x.m.id}"><span>${esc(x.m.name)} <span class="muted tiny">${x.m.weeks} wks</span></span><span class="muted small">${x.w} workouts · ${x.s} sets</span><span class="chev">›</span></button>`).join('')}</div>
      <button class="ghost block" data-go="#/history">Workout history ›</button>`;
    return wire();
  }
  go('#/');
}

// ---------- Learn ----------
function renderLearn(sub) {
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
          <span class="pill">start ${d[g.size].focus} focus · ${d[g.size].whole} whole · ${d[g.size].maintain} hold</span></div>
        <div class="kv small"><div class="k">Reps</div><div class="v">${esc(g.reps)}</div><div class="k">Go-to exercises</div><div class="v">${esc(g.ex)}</div></div>
        <div class="muted small">${esc(g.note)}</div></div>`).join('')}
      <div class="card small muted">“start” = weekly sets in week 1 of a new mesocycle: <b>focus</b> on an upper/lower focus plan, <b>whole</b> on a whole-body plan, <b>hold</b> for maintained muscles.</div>`;
  } else {
    setHeader('Learn', '#/explore', 'explore');
    app.innerHTML = `<div class="card small muted">Short, plain-language guides to what the research says — and how the app uses it. Every page links its sources.</div>
      <h2>By goal</h2>
      <div class="card"><table class="goals"><thead><tr><th>Goal</th><th>Sets/muscle/wk</th><th>Reps</th><th>Effort</th></tr></thead><tbody>
        ${LEARN.GOALS.map(g => `<tr data-go="#/learn/${g.id}"><td><b>${g.ico} ${esc(g.name.split(' (')[0])}</b></td><td>${esc(g.weekly.replace(' per muscle', ''))}</td>
          <td>${esc(g.reps.split(';')[0].split(' at ')[0])}</td><td>${esc(g.effort.split(' — ')[0].split(' (')[0])}</td></tr>`).join('')}
      </tbody></table><div class="muted tiny" style="margin-top:6px">Tap a row for sessions, rest, frequency and the why.</div></div>
      <button class="list-btn" data-go="#/learn/muscles"><span style="font-size:22px">🧍</span><div class="grow"><b>Per muscle</b><div class="muted small">Sets, reps and go-to exercises for each muscle</div></div>›</button>
      <h2>Read</h2>
      ${LEARN.ARTICLES.map(a => `<button class="list-btn" data-go="#/learn/${a.id}"><div class="grow"><b>${esc(a.title)}</b><div class="muted small">${esc(a.body[0].slice(0, 90))}…</div></div>›</button>`).join('')}
      <div class="card small muted">The full rules the app follows: <a href="${DOC_URL}" target="_blank" rel="noopener">Training Logic &amp; Evidence</a></div>`;
  }
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

async function renderProgress(exId, rangeArg, metricArg) {
  setHeader('Exercise progress', exId ? '#/progress' : '#/explore', 'explore');
  // Per-session strength is computed in the database (lift_sessions / strength_summary): deload weeks,
  // myo-rep mini-sets and cardio are excluded so sessions compare like for like.
  if (!exId) {
    const list = (await fetchAll(() => sb.rpc('strength_summary').order('muscle_group').order('name')));
    app.innerHTML = list.length ? list.map(x => {
      const ch = x.first_e1rm ? Math.round((x.last_e1rm - x.first_e1rm) / x.first_e1rm * 100) : 0;
      return `<button class="list-btn" data-go="#/progress/${x.exercise_id}"><div class="grow"><b>${esc(x.name)}</b>
        <div class="muted small">${esc(x.muscle_group)} · ${x.sessions} session${x.sessions > 1 ? 's' : ''}</div></div>
        <span class="pill ${ch > 0 ? 'on' : ch < 0 ? 'bad' : ''}">${ch > 0 ? '+' : ''}${ch}%</span></button>`; }).join('')
      : '<p class="muted">Log some sets and your progress shows up here.</p>';
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
  app.innerHTML = `<div class="card insight st-${status.status}"><div class="row"><b class="grow">${status.status === 'new' ? 'Getting started' : 'Where this lift stands'}</b>${statusPill(status)}</div>
      <p class="small" style="margin:6px 0 0">${esc(status.rec)}</p>${status.vs ? `<p class="small muted" style="margin:6px 0 0">${esc(status.vs.text)}</p>` : ''}</div>
    <div class="seg c3" role="tablist" aria-label="Chart range">${Object.entries(ranges).map(([k, v]) => `<button role="tab" aria-selected="${k === range}" class="${k === range ? 'on' : ''}" data-go="#/progress/${exId}/${k}/${metric}" ${k === 'meso' && !mesoStart ? 'disabled' : ''}>${v}</button>`).join('')}</div>
    <div class="seg c2" role="tablist" aria-label="Chart measure" style="margin-top:8px">${[['perf', 'Performance'], ['est', 'Strength estimate']].map(([k, v]) => `<button role="tab" aria-selected="${k === metric}" class="${k === metric ? 'on' : ''}" data-go="#/progress/${exId}/${range}/${k}">${v}</button>`).join('')}</div>
    <div class="card"><div class="muted small">${metric === 'perf' ? `Performance per session (${unit()}) · weight × (1 + reps/30), no RIR credit — rises through a meso as you add reps or weight, resets a bit at each new meso's easier week 1`
      : `Estimated strength per session (${unit()}) · weight × (1 + (reps + RIR)/30) — gives credit for reps left in the tank, so hitting the plan each week looks flat; real gains show meso to meso`}</div>
      <svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Estimated strength from ${fmt(Math.round(first.e))} to ${fmt(Math.round(last.e))} ${unit()}">
      ${mesoIdx > 0 ? `<line x1="${X(mesoIdx)}" y1="8" x2="${X(mesoIdx)}" y2="114" stroke="#3a4150" stroke-dasharray="3 3"/><text x="${X(mesoIdx) + 3}" y="14" font-size="8" fill="#8b93a3">meso start</text>` : ''}
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
      ${ss.map((s, i) => `<circle cx="${X(i)}" cy="${Y(s.e)}" r="${prDates.has(s.at) ? 4.5 : 3}" fill="${prDates.has(s.at) ? 'var(--warn)' : 'var(--accent)'}"/>`).join('')}</svg>
      <div class="row muted tiny"><span class="grow">${fmt(Math.round(min))}</span><span>${fmt(Math.round(max))}</span></div>
      <div class="grid3 keep" style="margin-top:8px">
        <div class="stat center"><span class="big">${ss.length}</span><span class="muted tiny">sessions</span></div>
        <div class="stat center"><span class="big">${change > 0 ? '+' : ''}${change.toFixed(1)}%</span><span class="muted tiny">change</span></div>
        <div class="stat center"><span class="big">${[...prDates].filter(d => ss.some(x => x.at === d)).length}</span><span class="muted tiny">PRs <span style="color:var(--warn)">●</span></span></div></div></div>
    <div class="card"><table><tr><th>Date</th><th>Top set</th><th>Sets</th><th class="right">${metric === 'perf' ? 'Perf.' : 'Est.'}</th></tr>
      ${ss.slice().reverse().map(s => `<tr><td>${new Date(s.at).toLocaleDateString()}${prDates.has(s.at) ? ' 🏆' : ''}</td><td>${fmt(s.top.weight)} × ${s.top.reps}</td><td>${s.n}</td><td class="right">${fmt(Math.round(s.e))}</td></tr>`).join('')}</table></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
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
  const [list, prefList] = await Promise.all([loadExercises(true), loadPrefs(true)]);
  const prefs = new Map(prefList.map(p => [p.exercise_id, p]));
  let mf = decodeURIComponent(filter || ''), q = '';
  const draw = () => {
    const shown = list.filter(e => (!mf || e.muscle_group === mf) && (!q || e.name.toLowerCase().includes(q)));
    app.innerHTML = head + `
      <input id="q" placeholder="Search ${list.length} exercises" value="${esc(q)}"><div class="spacer"></div>
      <div class="chips">${['', ...L.MUSCLES, 'Cardio'].map(m => `<button class="chip ${m === mf ? 'sel' : ''}" data-mf="${m}">${m || 'All'}</button>`).join('')}</div>
      <div class="spacer"></div>
      <div class="muted tiny">★ favorite = autofill picks it first · ⦸ exclude = autofill never picks it (choose what to use instead). Your choices only.</div>
      <div class="card">${shown.map(e => { const pf = prefs.get(e.id); return `<div class="row exrow" style="padding:7px 0;border-bottom:1px solid var(--line)"><div class="grow">${esc(e.name)}${(e.tags || []).includes('axial') ? ' <span class="pill warn" title="Heavy spinal loading">spinal load</span>' : ''}
        <div class="muted tiny">${esc(e.muscle_group)} · ${esc(e.equipment || '')} · ${e.kind} · ${e.load_type} · ${e.rep_min}–${e.rep_max} reps${e.secondary?.length ? ' · also ' + e.secondary.join(', ') : ''}</div></div>
        ${pf?.pref === 'exclude' ? `<div class="sub"><label for="sub-${e.id}" class="tiny">Use instead</label><select id="sub-${e.id}" data-sub="${e.id}"><option value="">— autofill decides —</option>${list.filter(x => x.muscle_group === e.muscle_group && x.id !== e.id).map(x => `<option value="${x.id}" ${pf.substitute_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}</div>
        <button class="ghost sm pref ${pf?.pref === 'favorite' ? 'on' : ''}" data-fav="${e.id}" aria-pressed="${pf?.pref === 'favorite'}" aria-label="${pf?.pref === 'favorite' ? 'Remove from favorites' : 'Mark as favorite'}: ${esc(e.name)}">${pf?.pref === 'favorite' ? '★' : '☆'}</button>
        <button class="ghost sm pref ${pf?.pref === 'exclude' ? 'bad' : ''}" data-excl="${e.id}" aria-pressed="${pf?.pref === 'exclude'}" aria-label="${pf?.pref === 'exclude' ? 'Stop excluding' : 'Exclude'}: ${esc(e.name)}">⦸</button>
        ${e.owner_id ? `<button class="ghost sm danger" data-del="${e.id}" aria-label="Delete ${esc(e.name)}">✕</button>` : ''}</div>`; }).join('') || '<p class="muted">No matches.</p>'}</div>
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
    const refresh = async () => { prefList.length = 0; prefList.push(...await loadPrefs(true)); prefs.clear(); prefList.forEach(p => prefs.set(p.exercise_id, p)); draw(); };
    $$('[data-fav]').forEach(b => b.onclick = async () => { const id = b.dataset.fav; await setPref(id, prefs.get(id)?.pref === 'favorite' ? null : 'favorite'); refresh(); });
    $$('[data-excl]').forEach(b => b.onclick = async () => { const id = b.dataset.excl; await setPref(id, prefs.get(id)?.pref === 'exclude' ? null : 'exclude'); refresh(); });
    $$('[data-sub]').forEach(sel => sel.onchange = async () => { await setPref(sel.dataset.sub, 'exclude', sel.value || null); toast('Saved'); refresh(); });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this exercise?')) return;
      const r = await sb.from('exercises').delete().eq('id', b.dataset.del);
      if (r.error) toast('In use by a workout — can’t delete', true); else { exCache = null; renderLibrary('exercises'); }
    });
  };
  draw();
}

// ---------- settings ----------
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith Machine', 'Kettlebell', 'Band'];
async function renderSettings() {
  setHeader('Settings', '#/explore', 'explore');
  const lib = await loadExercises();
  const axial = lib.filter(e => (e.tags || []).includes('axial'));
  const eq = profile?.equipment; // null = everything
  const avoidAxial = (profile?.avoid_tags || []).includes('axial');
  app.innerHTML = `<div class="card">
      <div class="muted small">Signed in as</div><div>${esc(session.user.email)}</div>
      <label for="name">Name</label><input id="name" autocomplete="name" value="${esc(profile?.display_name || '')}">
      <div class="row"><div class="grow"><label for="unit">Units</label><select id="unit"><option ${unit() === 'lb' ? 'selected' : ''}>lb</option><option ${unit() === 'kg' ? 'selected' : ''}>kg</option></select></div>
        <div class="grow"><label for="bw">Bodyweight (${unit()})</label><input id="bw" type="number" inputmode="decimal" step="any" value="${profile?.bodyweight == null ? '' : Math.round(bwD() * 10) / 10}"></div></div>
      <div class="muted tiny" style="margin-top:6px">Bodyweight lets pull-ups, dips and push-ups count toward strength trends. Switching units only changes how weights are shown — your history stays the same.</div>
      <div class="spacer"></div><button class="primary block" id="save">Save</button></div>
    <div class="card"><h3>Training preferences</h3>
      <div class="muted small">Used when the app builds a mesocycle for you. These are your choices; you can still add any exercise by hand.</div>
      <fieldset class="plain"><legend class="small">Equipment I have</legend>
        <div class="chips">${EQUIPMENT.map(x => `<label class="chip check"><input type="checkbox" name="eq" value="${x}" ${!eq || eq.includes(x) ? 'checked' : ''}> ${x}</label>`).join('')}</div>
        <div class="muted tiny">Bodyweight moves are always included.</div></fieldset>
      <label class="switch"><input type="checkbox" id="avoidAxial" ${avoidAxial ? 'checked' : ''}> <span>Avoid heavy spinal loading</span></label>
      <details class="small"><summary class="muted">${axial.length} exercises are tagged (bar on the back, shoulder-pad machines, heavy barbell hinges/rows, standing overhead press)</summary>
        <div class="muted tiny" style="margin-top:6px">${axial.map(e => esc(e.name)).join(' · ')}</div>
        <div class="muted tiny" style="margin-top:6px">Want to keep one of these? Star it in the Exercise library — favorites are always allowed.</div></details>
      <div class="spacer"></div><button class="block" id="savePrefs">Save preferences</button>
      <button class="ghost block sm" data-go="#/exercises">Favorites &amp; exclusions → Exercise library</button></div>
    <div class="card small"><a href="${DOC_URL}" target="_blank" rel="noopener">Training Logic & Evidence</a> <span class="muted">— why the app sets your weights, sets and RIR the way it does.</span></div>
    <button class="block" id="pw">Change password</button><div class="spacer"></div>
    <button class="block" id="out">Sign out</button>
    <p class="muted small center">Install: Safari → Share → Add to Home Screen.</p>
    <p class="muted tiny center">Woodhouse Lifts ${APP_VERSION} · <a href="${CHANGELOG_URL}" target="_blank" rel="noopener">What’s new</a></p>`;
  $('#save').onclick = async () => {
    const bw = $('#bw').value;
    // The bodyweight box is in the unit shown when the page opened; convert with that unit, then switch.
    const bwLb = bw === '' ? null : bw === $('#bw').defaultValue ? profile?.bodyweight : Math.round(toLb(bw) * 10) / 10; // unchanged → keep exact stored value
    profile = check(await sb.from('profiles').update({ display_name: $('#name').value.trim(), unit: $('#unit').value, bodyweight: bwLb })
      .eq('id', session.user.id).select().single());
    toast('Saved'); renderSettings();
  };
  $('#savePrefs').onclick = async () => {
    const picked = $$('input[name=eq]:checked').map(i => i.value);
    const tags = (profile?.avoid_tags || []).filter(t => t !== 'axial'); if ($('#avoidAxial').checked) tags.push('axial');
    profile = check(await sb.from('profiles').update({ equipment: picked.length === EQUIPMENT.length ? null : picked, avoid_tags: tags })
      .eq('id', session.user.id).select().single());
    toast('Preferences saved — new mesocycles will use them');
  };
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#out').onclick = async () => { await sb.auth.signOut(); go('#/'); };
  $('#pw').onclick = () => renderNewPassword(false);
}

route();
