// v1.12.1: supabase-js is pinned to one reviewed release (outside audit, finding 4) — see net.js.
import * as L from './logic.js?v=65';
import * as LEARN from './learn.js?v=65';
import * as MD from './md.js?v=65';
import { ICONS, ic } from './icons.js?v=65';
import { esc, fmtNum, fmt, today, dayName, order, weekStart, isoDay } from './format.js?v=65';
import { toast, linkLabels, openSheet, closeSheet } from './ui.js?v=65';
import { profile, exCache, builder, setProfile, setExCache, setBuilder } from './state.js?v=65';
import { renderExplore, renderFeedback, renderHome, renderStats, renderSummary } from './screens/home.js?v=65';
import { renderHistory, renderLearn, renderLibrary, renderLogic, renderProgress, renderSettings, renderVolume } from './screens/library.js?v=65';
import { renderBuilder, renderMeso, renderMesos } from './screens/mesos.js?v=65';
import { renderCardio, renderWorkout } from './screens/workout.js?v=65';
import { sb, session, setSession, OKEY, QKEY, durableWrite, flushOps, flushQueue, flushing, inOrder, isNetErr, isPermanentErr, lastSent, loadIncrements, lsGet, lsSet, memStore, newVer, oKey, oLoad, oStore, opFailed, opQuery, opsFlushing, overlayDays, pendingOps, qAddFailed, qFailed, qFailedKey, qKey, qLoad, qLoadFor, qMigrateLegacy, qStore, qStoreFor, riskWarned, sameVersion, saveSet, sendQueued, setChains, setKey, storageAtRisk, stripLocal, syncAll, syncBadge, verSeq, warnAtRisk } from './net.js?v=65';

// Where confirmation emails send people back to (must be in Supabase Auth → URL Configuration → Redirect URLs).
export const SITE_URL = 'https://anthony-christiansen.github.io/Woodhouse-Lifts/';
// Capture what the confirmation link put in the URL before the router or supabase-js touch it.
// Implicit flow (not PKCE) on purpose: the link then works even when opened on a different device than sign-up.
export let authReturn = (() => {
  const h = new URLSearchParams(location.hash.replace(/^#\/?/, '')), q = new URLSearchParams(location.search);
  const get = k => h.get(k) || q.get(k);
  if (get('access_token')) return { ok: true, type: get('type') };
  if (get('error') || get('error_code')) return { ok: false, code: get('error_code') || get('error'), desc: get('error_description') };
  return null;
})();
export let awaitingNewPassword = authReturn?.ok && authReturn.type === 'recovery'; // stay on 'new password' until it's saved
export const APP_VERSION = '1.21.2'; // keep in sync with CHANGELOG.md
export const CHANGELOG_URL = 'https://github.com/Anthony-christiansen/Woodhouse-Lifts/blob/main/CHANGELOG.md';
// v1.11.4: the training rules are a page inside the app (#/logic), built from this repo's docs/training-logic.md.
// The app never links to anyone's Google Drive.

// Theme: 'system' (default) follows the phone; 'dark' / 'light' pin it. Applied early by index.html too (no flash).
export const themePref = () => { try { return localStorage.getItem('wl_theme') || 'system'; } catch { return 'system'; } };
export function applyTheme(t = themePref()) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  const light = t === 'light' || (t === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f4f6' : '#0d0f13');
}
// v1.13.1: one-tap Dark ↔ Normal (light) switch in the header on every screen. It pins the choice on this phone;
// Settings → Appearance can set it back to "Match phone".
export const isDark = () => { const t = themePref(); return t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches); };
export function syncThemeBtn() {
  const b = document.getElementById('themeBtn'); if (!b) return;
  const dark = isDark();
  b.innerHTML = ic(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Switch to normal (light) mode' : 'Switch to dark mode');
  b.title = dark ? 'Normal mode' : 'Dark mode';
}
export function setTheme(t) {
  try { localStorage.setItem('wl_theme', t); } catch {}
  applyTheme(t); syncThemeBtn();
  document.querySelectorAll('[data-theme-pick]').forEach(x => { const on = x.dataset.themePick === t; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { applyTheme(); syncThemeBtn(); });
// Small haptic tick on set completion where supported (Android). Never required for anything.
export const haptic = () => { try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(12); } catch {} };

export const app = document.getElementById('app');
export const titleEl = document.getElementById('title');
export const backBtn = document.getElementById('backBtn');
export const tabs = document.getElementById('tabs');
export const gearBtn = document.getElementById('gearBtn');
export const themeBtn = document.getElementById('themeBtn');
themeBtn.onclick = () => setTheme(isDark() ? 'light' : 'dark');
export const sheet = document.getElementById('sheet');
// profile, exCache and builder live in state.js (setProfile / setExCache / setBuilder); session in net.js (setSession)

// ---------- helpers ----------
export const $ = sel => app.querySelector(sel);
export const $$ = sel => [...app.querySelectorAll(sel)];
export const go = h => { location.hash = h; };
export const unit = () => profile?.unit || 'lb';
// Weights are stored in lb; W() shows them in the user's unit, toLb() converts what they type back.
export const W = v => L.toUnit(v, unit()), toLb = v => L.fromUnit(v, unit());
export const bwD = () => W(profile?.bodyweight); // bodyweight in display units
// Local calendar date (not UTC — an evening workout behind UTC must not land on tomorrow).
export function check(res) { if (res.error) { console.error(res.error); toast(res.error.message, true); throw res.error; } return res.data; }
// Supabase returns at most 1,000 rows per request; page through everything. build() must return a fresh, fully ordered query.
export async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const rows = check(await build().range(from, from + page - 1));
    out.push(...rows); if (rows.length < page) return out;
  }
}
export function setHeader(title, back, tab) {
  // Home shows the brand (logomark + wordmark); other screens show their own title.
  if (tab === 'home' && !back) titleEl.innerHTML = '<span class="brand"><img class="brand-mark" src="icons/logo.svg" alt="" width="26" height="26">Woodhouse Lifts</span>';
  else titleEl.textContent = title;
  backBtn.hidden = !back; backBtn.onclick = () => go(back);
  tabs.hidden = !session;
  gearBtn.hidden = !session || tab !== 'home'; gearBtn.onclick = () => go('#/settings');
  themeBtn.hidden = false; syncThemeBtn();
  tabs.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}

export const RATINGS = {
  pump: { label: 'Pump', opts: ['None', 'Mild', 'Good', 'Huge'] },
  workload: { label: 'Workload', opts: ['Easy', 'Pretty good', 'Pushed my limit', 'Too much'] },
  joint_pain: { label: 'Joint pain', opts: ['None', 'Low', 'Moderate', 'A lot'] },
  soreness: { label: 'Recovery', opts: ['Never got sore', 'Healed a while ago', 'Healed just in time', 'Still sore'] },
  breathing: { label: 'Breathing (talk test)', opts: ['Could sing', 'Talked easily', 'Short phrases', "Couldn't talk"] },
};
export const rateKeys = m => m === 'Cardio' ? ['breathing', 'workload', 'joint_pain'] : ['pump', 'workload', 'joint_pain'];
// v1.11.1 (audit D): pump is optional — skipping it saves "not rated", never a made-up value. The engine treats a
// missing pump as no evidence (it can't unlock the +2 sets rule).
export const needKeys = m => rateKeys(m).filter(k => k !== 'pump');
export const OPTIONAL = { pump: true };
export const segHtml = (key, val, attrs = '') => `<div class="seg">${RATINGS[key].opts.map((o, i) =>
  `<button type="button" ${attrs} data-k="${key}" data-v="${i}" class="${val === i ? 'on' : ''}">${o}</button>`).join('')}</div>`;

// ---------- per-lift insights (doc §6.1) ----------
// For a list of exercise ids: recent sessions + earlier best (lift_recent), tagged with meso and meso week, then the
// training engine's status. Within a meso the target RIR drops each week, so lifts are judged on PERFORMANCE
// (load × reps) week over week, and against the same week of the previous meso — never on a RIR-adjusted number
// that stays flat when you hit the plan exactly (L.mesoStatus).
// v1.20.6: wins first (PRs, on track, holding), then the lifts to keep an eye on — everything is still listed.
export const STATUS_ORDER = { pr: 0, progressing: 1, steady: 2, dip: 3, stalled: 4, regressing: 5, new: 6 };
// v1.11: calmer words ("Flat" shows no 0.0%). v1.20.6: say what to do next, still with the honest % where there is one.
export const PILL_LABEL = { stalled: 'Ready for +1 rep', regressing: 'Recover first', dip: 'Off week', steady: 'Holding' };
export const statusPill = st => `<span class="pill st-${st.status}">${PILL_LABEL[st.status] || st.label}${st.pct != null && !['new', 'stalled'].includes(st.status) ? ` ${st.pct > 0 ? '+' : ''}${st.pct.toFixed(1)}%` : ''}</span>`;
export async function liftInsights(ids, { excludeSessions = [], meso = null, rirFor = {} } = {}) {
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

export let prefsCache = null;
export async function loadPrefs(force = false) {
  if (!prefsCache || force) prefsCache = check(await sb.from('exercise_prefs').select('exercise_id, pref, substitute_id'));
  return prefsCache;
}
export async function setPref(exerciseId, pref, substituteId = null) {
  const r = pref ? await sb.from('exercise_prefs').upsert({ exercise_id: exerciseId, pref, substitute_id: pref === 'exclude' ? substituteId : null, updated_at: new Date().toISOString() })
    : await sb.from('exercise_prefs').delete().eq('exercise_id', exerciseId);
  check(r); prefsCache = null;
}
export async function loadExercises(force = false) {
  if (!exCache || force) setExCache(check(await sb.from('exercises').select('*').order('muscle_group').order('name')));
  return exCache;
}

// ---------- router ----------
export let lastScreen = '';
export const routes = {
  '': renderHome, mesos: renderMesos, train: renderMesos, new: renderBuilder, meso: renderMeso, workout: renderWorkout,
  explore: renderExplore, history: renderHistory, progress: renderProgress, volume: renderVolume,
  cardio: renderCardio, library: renderLibrary, exercises: () => renderLibrary('exercises'), templates: () => renderLibrary('templates'),
  settings: renderSettings, learn: renderLearn, stats: renderStats, logic: renderLogic, feedback: renderFeedback, summary: renderSummary,
};
export async function route() {
  closeSheet(); document.body.classList.remove('has-next');
  const { data } = await sb.auth.getSession(); setSession(data.session); // waits for supabase-js to read the link's tokens
  routedUid = session?.user?.id ?? null;
  if (authReturn) {
    const r = authReturn; authReturn = null;
    history.replaceState(null, '', location.pathname + '#/'); // drop tokens/errors from the address bar
    if (r.ok && session) toast(r.type === 'signup' ? 'Email confirmed — welcome to Woodhouse Lifts!' : 'Signed in');
    else if (!session) { tabs.hidden = true; return renderAuth('signin', linkProblem(r)); }
  }
  if (!session) { tabs.hidden = true; return renderAuth(); }
  if (awaitingNewPassword) return renderNewPassword(true);
  qMigrateLegacy();
  if (Object.keys(qLoad()).length || oLoad().length) { syncBadge(); syncAll(); }
  if (!profile) setProfile((await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()).data);
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  if (name !== 'feedback') lastScreen = name || 'home';
  window.scrollTo(0, 0);
  // Show a loading state only if the screen takes a moment (no flash on fast loads); errors offer a retry.
  const slow = setTimeout(() => { app.setAttribute('aria-busy', 'true'); app.innerHTML = '<div class="loading" role="status">Loading…</div>'; }, 250);
  try { await (routes[name] || renderHome)(...args); app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); }
  catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card warn" role="alert"><b>${isNetErr(e) ? 'No connection' : 'Something went wrong'}</b>
      <p class="muted small">${isNetErr(e) ? (storageAtRisk ? 'Check your signal and try again. Keep the app open: this phone isn’t keeping an offline copy of unsynced sets.' : 'Check your signal and try again. Sets you logged are kept on this phone and sync when you’re back online.') : esc(e.message)}</p>
      <button class="primary block" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => route();
  } finally { clearTimeout(slow); app.removeAttribute('aria-busy'); }
}
window.addEventListener('hashchange', route);
// v1.19.0: supabase-js also reports SIGNED_IN when the app comes back into view or refreshes its session. Redraw
// only when who is signed in actually changes — redrawing on every one of those reloaded the screen mid-workout.
export let routedUid = undefined;
sb.auth.onAuthStateChange((evt, sess) => {
  if (evt === 'PASSWORD_RECOVERY') { awaitingNewPassword = true; setProfile(null); return route(); }
  const uid = sess?.user?.id ?? null;
  if (evt === 'SIGNED_OUT' || (evt === 'SIGNED_IN' && uid !== routedUid)) { routedUid = uid; setProfile(null); route(); }
  else if (sess) setSession(sess);   // token refresh / same user: keep the fresh session, leave the screen alone
});

// ---------- auth ----------
// notice: { tone: 'warn'|'ok', title, text, resendEmail? } shown above the form.
export function authNotice(n) {
  if (!n) return '';
  return `<div class="card notice ${n.tone || 'warn'}" role="status"><h3>${esc(n.title)}</h3><p class="muted">${esc(n.text)}</p>
    ${n.resend ? `<button class="ghost block" id="resend" type="button">Resend confirmation email</button>` : ''}</div>`;
}
export function linkProblem(r) {
  const expired = /expired|invalid/i.test(`${r.code} ${r.desc}`);
  return { title: expired ? 'That link has expired or was already used' : 'We couldn’t confirm that link',
    text: expired ? 'If you already confirmed, just sign in below. If not, enter your email below and tap Resend for a fresh link.'
      : 'Try signing in below. If your email isn’t confirmed yet, enter it below and tap Resend for a new link.', resend: true };
}
export function friendlyAuthError(err) {
  const code = err?.code || '', msg = err?.message || '';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'unconfirmed';
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return 'That email and password don’t match. Check for typos and try again.';
  if (code === 'weak_password' || /password/i.test(msg) && /least|weak|short/i.test(msg)) return 'Choose a stronger password — at least 8 characters.';
  if (code === 'over_email_send_rate_limit' || err?.status === 429 || /rate limit|security purposes/i.test(msg)) return 'Too many emails requested. Wait a minute and try again.';
  if (code === 'signup_disabled') return 'New sign-ups are turned off right now.';
  if (code === 'email_address_invalid' || /invalid.*email/i.test(msg)) return 'That email address doesn’t look right.';
  return msg || 'Something went wrong. Please try again.';
}
export function wireResend(getEmail) {
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
export function renderCheckEmail(email) {
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

export function renderAuth(mode = 'signin', notice = null, prefill = '') {
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
export function renderForgot(prefill = '') {
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
export function renderNewPassword(fromEmail = false) {
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
export async function activeMeso() {
  const m = check(await sb.from('mesocycles').select('*').in('status', ['active', 'planned']).order('created_at', { ascending: false }));
  return m.find(x => x.status === 'active') || m.find(x => x.status === 'planned') || null;
}
export async function mesoDays(mesoId) {
  // v1.17.1: days an early light week replaced are hidden (kept in the database, never deleted).
  const q = () => sb.from('workout_days').select('id, week, day_index, label, started_at, completed_at, skipped_at, mesocycle_id, superseded_at').eq('mesocycle_id', mesoId).order('week').order('day_index');
  let r = await q();
  if (r.error && /superseded_at/.test(r.error.message)) r = await sb.from('workout_days').select('id, week, day_index, label, started_at, completed_at, skipped_at, mesocycle_id').eq('mesocycle_id', mesoId).order('week').order('day_index');
  return overlayDays(check(r).filter(d => !d.superseded_at));
}
export const openDays = days => days.filter(d => !d.completed_at && !d.skipped_at);
export async function cardioSince(fromIso) {
  return check(await sb.from('cardio_sessions').select('*').gte('performed_on', fromIso).order('performed_on', { ascending: false }));
}

// ---------- shared analytics ----------
export async function workoutCardioSince(fromIso) {
  return check(await sb.from('sets').select('duration_min, rpe, completed_at, workout_exercises!inner(exercises!inner(name, load_type))')
    .not('duration_min', 'is', null).not('completed_at', 'is', null).gte('completed_at', fromIso));
}
export const cardioItems = (sessions, wsets) => [
  ...sessions.map(c => ({ date: c.performed_on, minutes: Number(c.minutes), rpe: c.rpe, name: c.activity })),
  ...wsets.map(s => ({ date: s.completed_at.slice(0, 10), minutes: Number(s.duration_min), rpe: s.rpe ?? 0, name: s.workout_exercises.exercises.name })),
];
export async function slipFor(meso) {
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
// v1.17.0 (audit T4): should the light week come early? Suggests only — you decide (startLightWeek).
export async function fatigueFor(meso, week) {
  if (!meso || !week || meso.weeks < 4) return { suggest: false };
  const r = await sb.from('muscle_feedback').select('muscle_group, soreness, joint_pain, performance, workout_days!inner(week, mesocycle_id)').eq('workout_days.mesocycle_id', meso.id);
  if (r.error) return { suggest: false };
  return L.fatigueCheck(r.data.map(f => ({ week: f.workout_days.week, muscle: f.muscle_group, recovery: f.soreness, joint_pain: f.joint_pain, performance: f.performance })), { week, weeks: meso.weeks });
}
export const fatigueKey = (meso, week) => `wl_fatigue_dismiss:${meso.id}:${week}`;
// The first week from which nothing is started, finished, skipped or logged — that week becomes the light week.
export const lightWeekFrom = days => Math.max(0, ...days.filter(d => d.started_at || d.completed_at || d.skipped_at).map(d => d.week)) + 1;
export const rpcMissing = e => /function|does not exist|schema cache|Could not find/i.test(e?.message || '');
export const pendingHere = () => Object.keys(qLoad()).length + oLoad().length;
/**
 * v1.17.1 (audit D1–D3, U1): the early light week is previewed by the server, confirmed on a screen that says exactly
 * what changes, and sent with the preview's revision — if anything changed in between (another device or tab, a
 * retry), the server refuses and nothing changes. Later weeks are hidden, not deleted, and it can be undone.
 * Resolves true when the light week was set.
 */
export async function startLightWeek(meso) {
  if (pendingHere()) { await syncAll(); if (pendingHere()) { toast('Some changes on this phone are still waiting to sync — try again once they have', true); return false; } }
  const pv = await sb.rpc('light_week_preview', { p_meso: meso.id });
  if (pv.error) { toast(rpcMissing(pv.error) ? 'This needs a small database update first — ask the app owner' : isNetErr(pv.error) ? 'No signal — try again when you’re back online' : pv.error.message, true); return false; }
  const p = pv.data;
  if (!p.ok) { toast(p.reason === 'before week 3' ? 'A light week can start from week 3' : p.reason === 'light week already next' ? 'The light week is already next' : 'This meso isn’t running'); return false; }
  const behind = p.not_done + p.started_unfinished;
  return new Promise(resolve => {
    let settled = false; const done = v => { if (!settled) { settled = true; resolve(v); } };
    openSheet(`<h3>Take the light week now?</h3>
      <div class="lw-sum"><div><span class="muted tiny">Meso length</span><b>${p.weeks} → ${p.light_week} weeks</b></div><div><span class="muted tiny">Light week</span><b>Week ${p.light_week}</b></div></div>
      <ul class="small lw-list">
        <li>Week ${p.light_week}: <b>${p.light_sessions} workout${p.light_sessions === 1 ? '' : 's'}</b> become light — half the sets, easy effort. The meso ends after it.</li>
        <li>Weeks ${p.light_week + 1}–${p.weeks}: <b>${p.removed_sessions} planned workout${p.removed_sessions === 1 ? '' : 's'}</b> are hidden (not deleted — <b>Undo</b> on the meso page brings them back until you log in the light week).</li>
        <li>Weeks 1–${p.light_week - 1}: ${p.done} done${p.skipped ? `, ${p.skipped} skipped` : ''}${p.started_unfinished ? `, ${p.started_unfinished} started but not finished` : ''}${p.not_done ? `, <b>${p.not_done} not done</b>` : ''}. Nothing you’ve logged changes.</li>
      </ul>
      ${behind ? `<div class="card warn small">${behind} earlier workout${behind > 1 ? 's aren’t' : ' isn’t'} finished, so this ends the meso early rather than adding a recovery week after full training. That’s fine if it’s what you want.</div>` : ''}
      <div class="card small"><b>Other phones or tabs:</b> if you’ve logged anything there that hasn’t synced, open the app there and let it sync first. This phone can only check its own unsynced changes${pendingHere() ? '' : ' (none waiting here)'}. If something syncs late, it’s kept and the app offers to restore the full meso.</div>
      <button class="primary block" id="lwGo">Start the light week</button><button class="block mt6" id="lwNo">Cancel</button>`,
      panel => {
        panel.querySelector('#lwNo').onclick = () => { closeSheet(); done(false); };
        panel.querySelector('#lwGo').onclick = async e => {
          e.target.disabled = true;
          const r = await sb.rpc('start_light_week', { p_meso: meso.id, p_revision: p.revision });
          if (!r.error) { closeSheet(); toast(`Week ${r.data.week} is now your light week`); return done(true); }
          if (r.error.code === '40001' || /changed since/.test(r.error.message)) { closeSheet(); toast('This meso changed on another device or tab — nothing was changed. Have another look.', true); return done(true); }
          if (isNetErr(r.error)) {   // the request may have gone through before the signal dropped
            const again = await sb.rpc('light_week_preview', { p_meso: meso.id });
            if (!again.error && again.data.revision > p.revision) { closeSheet(); toast('It went through — the light week is set'); return done(true); }
            e.target.disabled = false; return toast('No signal — nothing changed yet. Try again when you’re back online.', true);
          }
          e.target.disabled = false; toast(r.error.message, true);
        };
      });
    const obs = new MutationObserver(() => { if (sheet.hidden) { obs.disconnect(); done(false); } }); obs.observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  });
}
export async function undoLightWeek(meso) {
  if (!confirm(`Undo the early light week?\n\nThe meso goes back to ${meso.light_week_undo.weeks} weeks, the hidden workouts come back, and this week's targets return to what they were.`)) return false;
  const r = await sb.rpc('undo_light_week', { p_meso: meso.id, p_revision: meso.revision });
  if (r.error) { toast(r.error.code === '40001' ? 'This meso changed on another device or tab — have another look' : isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return r.error.code === '40001'; }
  toast(`Back to ${r.data.weeks} weeks`); return true;
}
// Sets that landed on hidden days (logged on another device before it synced) — kept; you choose what to do.
export async function lateSets(meso) {
  if (meso.light_week_undo == null) return 0;
  const r = await sb.from('workout_days').select('id, workout_exercises(sets(id))').eq('mesocycle_id', meso.id).not('superseded_at', 'is', null);
  if (r.error) return 0;
  return r.data.reduce((a, d) => a + d.workout_exercises.reduce((b, w) => b + w.sets.length, 0), 0);
}
export const lateKey = meso => `wl_late_ok:${meso.id}:${meso.revision}`;
export const lateCard = (meso, n) => n && !(() => { try { return localStorage.getItem(lateKey(meso)); } catch { return null; } })()
  ? `<div class="card warn" id="lateCard"><b>${n} set${n > 1 ? 's were' : ' was'} logged on workouts the light week replaced</b> — probably from another phone that synced late. ${n > 1 ? 'They’re' : 'It’s'} kept.
     <div class="row mt6">${meso.light_week_undo ? '<button class="sm primary" id="lateRestore">Restore the full meso</button>' : ''}<button class="sm" id="lateKeep">Keep the light week</button></div></div>` : '';
export function wireLate(meso, rerender) {
  const k = $('#lateKeep'), r = $('#lateRestore');
  if (k) k.onclick = () => { try { localStorage.setItem(lateKey(meso), '1'); } catch {} $('#lateCard').remove(); };
  if (r) r.onclick = async () => { if (await undoLightWeek(meso)) rerender(); };
}
// Plain-language effort target (v1.11): "RIR" (reps in reserve) only appears in the ⓘ and Learn pages.
export const effortText = r => r == null ? '' : r <= 0 ? 'last set to failure' : r === 1 ? 'stop 1 rep short of failure' : `stop ${r} reps short of failure`;
export const effortShort = r => r == null ? '' : r <= 0 ? 'to failure' : `${r} rep${r === 1 ? '' : 's'} short`;
export const warnList = (ws, max = 99) => `<ul class="warn-list">${ws.slice(0, max).map(w => `<li><span class="dot ${w.level}"></span><span>${esc(w.msg)}</span></li>`).join('')}</ul>`;

route();
