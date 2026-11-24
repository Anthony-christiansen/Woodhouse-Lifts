// v1.12.1: pinned to one reviewed release, so the code users get only changes with a commit here (outside audit, finding 4).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm';
import * as L from './logic.js?v=51';
import * as LEARN from './learn.js?v=51';
import * as MD from './md.js?v=51';

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
export const APP_VERSION = '1.20.0'; // keep in sync with CHANGELOG.md
const CHANGELOG_URL = 'https://github.com/Anthony-christiansen/Woodhouse-Lifts/blob/main/CHANGELOG.md';
// v1.11.4: the training rules are a page inside the app (#/logic), built from this repo's docs/training-logic.md.
// The app never links to anyone's Google Drive.

// ---------- icons (v1.12) ----------
// One line-icon set (24px grid, 1.75 stroke, round caps) replacing emoji used as icons. ic(name) → inline SVG,
// decorative (aria-hidden); the button or text next to it carries the accessible name.
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 7.5 6z"/>',
  bars: '<path d="M3 20h18M6 20v-6M11 20V8M16 20v-9M21 20V5" />',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4.5-3.5-6.5-4.5-10-1.5 2-2 3-3.5 3.8C10.5 7 10 5 10.5 2.5 7 5.5 5 9.5 5 15a7 7 0 0 0 7 7z"/>',
  pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  party: '<path d="M4 20 8.5 8l7.5 7.5z"/><path d="M14 4.5 14.5 6M19.5 9.5l-1.5.5M17.5 6.5 19 5M11 8.5 10 4M15.5 13l4.5 1"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7.5V12l3 2"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  pin: '<path d="M12 17v5M9 3h6M10 3v7l-3 4h10l-3-4V3"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  arrowUp: '<path d="M12 20V5M5.5 11.5 12 5l6.5 6.5"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  person: '<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M8 22l4-7 4 7M6.5 11h11"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  share: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
};
// Theme: 'system' (default) follows the phone; 'dark' / 'light' pin it. Applied early by index.html too (no flash).
const themePref = () => { try { return localStorage.getItem('wl_theme') || 'system'; } catch { return 'system'; } };
function applyTheme(t = themePref()) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  const light = t === 'light' || (t === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f4f6' : '#0d0f13');
}
// v1.13.1: one-tap Dark ↔ Normal (light) switch in the header on every screen. It pins the choice on this phone;
// Settings → Appearance can set it back to "Match phone".
const isDark = () => { const t = themePref(); return t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches); };
function syncThemeBtn() {
  const b = document.getElementById('themeBtn'); if (!b) return;
  const dark = isDark();
  b.innerHTML = ic(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Switch to normal (light) mode' : 'Switch to dark mode');
  b.title = dark ? 'Normal mode' : 'Dark mode';
}
function setTheme(t) {
  try { localStorage.setItem('wl_theme', t); } catch {}
  applyTheme(t); syncThemeBtn();
  document.querySelectorAll('[data-theme-pick]').forEach(x => { const on = x.dataset.themePick === t; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { applyTheme(); syncThemeBtn(); });
// Small haptic tick on set completion where supported (Android). Never required for anything.
const haptic = () => { try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(12); } catch {} };
const ic = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

const app = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const tabs = document.getElementById('tabs');
const gearBtn = document.getElementById('gearBtn');
const themeBtn = document.getElementById('themeBtn');
themeBtn.onclick = () => setTheme(isDark() ? 'light' : 'dark');
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
// Local calendar date (not UTC — an evening workout behind UTC must not land on tomorrow).
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
  // Home shows the brand (logomark + wordmark); other screens show their own title.
  if (tab === 'home' && !back) titleEl.innerHTML = '<span class="brand"><img class="brand-mark" src="icons/logo.svg" alt="" width="26" height="26">Woodhouse Lifts</span>';
  else titleEl.textContent = title;
  backBtn.hidden = !back; backBtn.onclick = () => go(back);
  tabs.hidden = !session;
  gearBtn.hidden = !session || tab !== 'home'; gearBtn.onclick = () => go('#/settings');
  themeBtn.hidden = false; syncThemeBtn();
  tabs.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
// v1.13.1 (accessibility): a <label> written just before its field is linked to it (for/id), on every screen and sheet,
// so screen readers announce each field's name and tapping the label focuses the field.
let labelSeq = 0;
function linkLabels(root) {
  root?.querySelectorAll('.switch input[type=checkbox]:not([role])').forEach(i => i.setAttribute('role', 'switch'));   // announced as on/off
  root?.querySelectorAll('label:not([for])').forEach(l => {
    if (l.querySelector('input, select, textarea')) return;              // already wraps its field
    const c = l.nextElementSibling;
    if (!c || !/^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName)) return;
    if (!c.id) c.id = `fld-${++labelSeq}`;
    l.htmlFor = c.id;
  });
}
new MutationObserver(() => { linkLabels(app); linkLabels(sheet); }).observe(document.body, { childList: true, subtree: true });
// v1.15.1 (audit S4/S5): the sheet is a real modal dialog — labelled by its heading, the page behind it is inert,
// focus moves into it, Tab stays inside it, Escape closes it (unless it's a required step), and focus returns to
// whatever opened it.
let sheetReturn = null;
const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function openSheet(html, wire, locked = false) {
  const wasOpen = !sheet.hidden;
  if (!wasOpen) sheetReturn = document.activeElement;
  sheet.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; sheet.hidden = false;
  const panel = sheet.querySelector('.panel'), h = panel.querySelector('h2, h3');
  if (h) { h.id = h.id || 'sheetTitle'; panel.setAttribute('aria-labelledby', h.id); } else panel.setAttribute('aria-label', 'Dialog');
  for (const id of ['app', 'tabs']) document.getElementById(id)?.setAttribute('inert', '');
  document.querySelector('header')?.setAttribute('inert', '');
  if (locked) sheet.dataset.lock = '1'; else delete sheet.dataset.lock;
  sheet.onclick = e => { if (e.target === sheet && !sheet.dataset.lock) closeSheet(); };
  wire?.(panel);
  if (!panel.contains(document.activeElement)) {
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } else panel.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
  }
}
function closeSheet() {
  const wasOpen = !sheet.hidden;
  sheet.hidden = true; sheet.innerHTML = ''; delete sheet.dataset.lock;
  for (const id of ['app', 'tabs']) document.getElementById(id)?.removeAttribute('inert');
  document.querySelector('header')?.removeAttribute('inert');
  if (wasOpen && sheetReturn?.isConnected) sheetReturn.focus({ preventScroll: true });
  sheetReturn = null;
}
// However the sheet gets hidden, the page behind it never stays inert.
new MutationObserver(() => { if (sheet.hidden) { for (const id of ['app', 'tabs']) document.getElementById(id)?.removeAttribute('inert'); document.querySelector('header')?.removeAttribute('inert'); } })
  .observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('keydown', e => {
  if (sheet.hidden) return;
  if (e.key === 'Escape') {
    if (sheet.dataset.lock) { toast('Answer this first — it sets up today’s workout'); return; }
    e.preventDefault(); return closeSheet();
  }
  if (e.key !== 'Tab') return;
  const items = [...sheet.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
  if (!items.length) return e.preventDefault();
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
});
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
// v1.11.1 (audit D): pump is optional — skipping it saves "not rated", never a made-up value. The engine treats a
// missing pump as no evidence (it can't unlock the +2 sets rule).
const needKeys = m => rateKeys(m).filter(k => k !== 'pump');
const OPTIONAL = { pump: true };
const segHtml = (key, val, attrs = '') => `<div class="seg">${RATINGS[key].opts.map((o, i) =>
  `<button type="button" ${attrs} data-k="${key}" data-v="${i}" class="${val === i ? 'on' : ''}">${o}</button>`).join('')}</div>`;

// ---------- reliable set saving ----------
// Every set save is an idempotent upsert keyed by (workout_exercise_id, set_index), so the database can never
// hold a duplicate set. If the network drops (gym basements), the save is kept on the phone and retried
// automatically — when the connection returns, when the app comes back to the foreground, and every 20 s.
// The queue is per account (review #2): switching accounts on the same phone can't send one person's sets as another's.
// v1.15.1 (audit S1): if the phone refuses to store the offline copy (storage full, blocked, private mode), the copy
// is kept in memory for this session instead and the app says plainly that closing it would lose those changes —
// it never claims "saved on your phone" when it isn't.
const memStore = new Map(); let storageAtRisk = false;
const lsGet = k => memStore.has(k) ? memStore.get(k) : localStorage.getItem(k);
function lsSet(k, v) {
  try { localStorage.setItem(k, v); memStore.delete(k); return true; }
  catch { memStore.set(k, v); if (!storageAtRisk) { storageAtRisk = true; setTimeout(syncBadge); } return false; }
}
const QKEY = 'wl_pending_sets_v1';
const qKey = () => session?.user?.id ? `${QKEY}:${session.user.id}` : null;
const qLoad = () => { const k = qKey(); if (!k) return {}; try { return JSON.parse(lsGet(k) || '{}'); } catch { return {}; } };
const qStore = q => { const k = qKey(); if (!k) return; lsSet(k, JSON.stringify(q)); };
// Sets the server rejected for good (not a network problem) are kept here instead of being thrown away.
const qFailedKey = () => session?.user?.id ? `${QKEY}:failed:${session.user.id}` : null;
const qFailed = () => { const k = qFailedKey(); try { return k ? JSON.parse(lsGet(k) || '[]') : []; } catch { return []; } };
const qAddFailed = (p, msg) => { const k = qFailedKey(); if (!k) return; lsSet(k, JSON.stringify([...qFailed(), { ...p, _error: msg, _at: new Date().toISOString() }].slice(-50))); };
// One-time move of the old shared queue (before 1.8.0) into the signed-in account's queue; the database's row-level
// security rejects anything that isn't this user's, and those land in the failed list rather than being lost.
function qMigrateLegacy() {
  try { const old = localStorage.getItem(QKEY); if (!old || !qKey()) return;
    const q = { ...JSON.parse(old), ...qLoad() }; qStore(q); localStorage.removeItem(QKEY); } catch {}
}
// Smallest weight jumps per equipment (doc §4.6) — kept on this phone; defaults are 2.5 lb / 1.25 kg, dumbbells 5 lb / 2 kg.
const loadIncrements = () => { try { return JSON.parse(localStorage.getItem('wl_increments') || '{}'); } catch { return {}; } };
L.setIncrements(loadIncrements());
// Permanent = the database refused the row (constraint, permission); anything else (network, 5xx, timeouts) is retried.
const isPermanentErr = e => /^(22|23|42)/.test(e?.code || '') || e?.code === 'PGRST116';
const isNetErr = e => !navigator.onLine || /failed to fetch|network|load failed|timeout|fetch/i.test(e?.message || '');
const setKey = p => p.workout_exercise_id + ':' + p.set_index;
// v1.12.1 (outside audit, finding 2): no stale writes.
//  - Write-ahead: every edit is stored on the phone (with a version) BEFORE it is sent, so closing the app mid-save
//    loses nothing.
//  - One write at a time per set: saves and offline retries for the same set go out in order, so an older value can
//    never land on the server after a newer one.
//  - A save only clears the phone copy if that copy is still the version it sent; a newer edit made meanwhile stays
//    queued and is sent next.
//  - The account is fixed per write: if you switch accounts mid-save, the other account's queue is never touched.
let verSeq = 0;
const newVer = () => `${Date.now().toString(36)}.${(++verSeq).toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
const stripLocal = p => { const { _v, _queued, ...row } = p; return row; };
const sameVersion = (a, b) => !!a && !!b && (a._v ?? JSON.stringify(a)) === (b._v ?? JSON.stringify(b));
const qLoadFor = k => { try { return k ? JSON.parse(lsGet(k) || '{}') : {}; } catch { return {}; } };
const qStoreFor = (k, q) => { if (!k) return true; return lsSet(k, JSON.stringify(q)); };
const setChains = new Map();
function inOrder(key, fn) {           // runs fn after every earlier write for this set has finished
  const next = (setChains.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  setChains.set(key, next);
  next.finally(() => { if (setChains.get(key) === next) setChains.delete(key); }).catch(() => {});
  return next;
}
// Sends the phone copy of one set (whatever is newest when its turn comes). Result: 'saved' | 'queued' | 'failed' | 'gone'.
function sendQueued(k, qk, uid) {
  return inOrder(qk + '|' + k, async () => {
    const cur = qLoadFor(qk)[k];
    if (!cur) return 'gone';                                         // removed meanwhile (set deleted)
    if (session?.user?.id !== uid) return 'queued';                  // account switched: leave it for its owner
    const { error } = await sb.from('sets').upsert(stripLocal(cur), { onConflict: 'workout_exercise_id,set_index' });
    if (session?.user?.id !== uid) return 'queued';
    if (!error) { const q = qLoadFor(qk); if (sameVersion(q[k], cur)) { delete q[k]; qStoreFor(qk, q); } return 'saved'; }
    if (!isPermanentErr(error)) return 'queued';                     // network or server hiccup → keep & retry
    const q = qLoadFor(qk); if (sameVersion(q[k], cur)) { delete q[k]; qStoreFor(qk, q); qAddFailed(stripLocal(cur), error.message); }
    return Object.assign(new String('failed'), { message: error.message });
  });
}
const lastSent = new Map();   // newest value of every set edited in this app session (for finishing with no signal)
async function saveSet(payload) {
  const qk = qKey(), uid = session?.user?.id, k = setKey(payload);
  lastSent.set(k, { ...payload });
  if (!qk) return 'failed';
  const q = qLoadFor(qk); q[k] = { ...payload, _v: newVer() }; qStoreFor(qk, q);   // on the phone first
  const res = await sendQueued(k, qk, uid);
  syncBadge();
  if (String(res) === 'failed') { toast(`Couldn’t save that set: ${res.message}`, true); return 'failed'; }
  if (res === 'queued' && storageAtRisk) warnAtRisk();
  return res === 'queued' ? 'queued' : 'saved';
}
let flushing = false;
async function flushQueue() {
  if (flushing || !session) return;
  flushing = true;
  const qk = qKey(), uid = session.user.id;
  try {
    for (const k of Object.keys(qLoadFor(qk))) {
      const res = await sendQueued(k, qk, uid);
      if (String(res) === 'failed') toast(`A saved-offline set was refused by the server and kept aside: ${res.message}`, true);
      if (res === 'queued') break;                                   // still offline: try again later
    }
  } finally { flushing = false; syncBadge(); }
  const left = Object.keys(qLoad()).length;
  document.querySelectorAll('.set.queued').forEach(r => { if (!qLoad()[r.dataset.key]) { r.classList.remove('queued'); r.classList.add('saved-flash'); } });
  return left;
}
function syncBadge() {
  const qk = qKey(), sets = Object.keys(qLoad()).filter(k => !setChains.has(qk + '|' + k)).length;   // in-flight saves aren't "waiting"
  const ops = opsFlushing ? 0 : oLoad().length, n = sets + ops;
  let b = document.getElementById('syncBadge');
  document.body.classList.toggle('has-sync', !!n);   // v1.12.3: room at the bottom so the badge never covers a button
  if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('button'); b.id = 'syncBadge'; b.className = 'sync-badge'; b.onclick = () => syncAll(); document.body.appendChild(b); }
  b.textContent = `⟳ ${[sets ? `${sets} set${sets > 1 ? 's' : ''}` : '', ops ? `${ops} change${ops > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ')} waiting to sync${storageAtRisk ? ' — NOT saved on this phone, keep the app open' : ''} — tap to retry`;
  b.classList.toggle('risk', storageAtRisk);
  b.setAttribute('aria-live', 'polite');
}
// ---------- durable writes for ratings and finishing a workout (v1.12.3, outside audit finding 3) ----------
// Each change is kept on the phone (in order) before it is sent, then sent one at a time, oldest first, after any
// waiting sets. Every change is idempotent (an upsert on its natural key, or an update to fixed values), so a retry
// after a dropped connection can never apply it twice. With no signal, a workout can be rated and finished; it all
// syncs by itself when the connection is back. Refused changes are kept aside, never silently dropped.
const OKEY = 'wl_pending_ops_v1';
const oKey = () => session?.user?.id ? `${OKEY}:${session.user.id}` : null;
const oLoad = (k = oKey()) => { try { return k ? JSON.parse(lsGet(k) || '[]') : []; } catch { return []; } };
const oStore = (k, a) => { if (!k) return true; return lsSet(k, JSON.stringify(a)); };
const opFailed = new Set();
function opQuery(op) {
  if (op.kind === 'upsert') return sb.from(op.table).upsert(op.values, { onConflict: op.onConflict });
  let q = sb.from(op.table).update(op.values);
  for (const [c, v] of Object.entries(op.eq || {})) q = q.eq(c, v);
  return q;
}
let opsFlushing = null;
function flushOps() {
  if (opsFlushing) return opsFlushing;
  opsFlushing = (async () => {
    const k = oKey(), uid = session?.user?.id; if (!k) return 'none';
    for (;;) {
      const op = oLoad(k)[0]; if (!op) return 'done';
      if (session?.user?.id !== uid) return 'queued';
      const { error } = await opQuery(op);
      if (session?.user?.id !== uid) return 'queued';
      if (!error) { oStore(k, oLoad(k).filter(x => x.id !== op.id)); continue; }
      if (!isPermanentErr(error)) return 'queued';               // no signal: keep everything, in order
      oStore(k, oLoad(k).filter(x => x.id !== op.id)); opFailed.add(op.id); qAddFailed({ op }, error.message);
      toast(`A change saved on your phone was refused by the server and kept aside: ${error.message}`, true);
    }
  })().finally(() => { opsFlushing = null; syncBadge(); });
  return opsFlushing;
}
async function syncAll() { await flushQueue(); return flushOps(); }
let riskWarned = 0;
function warnAtRisk() {   // at most once a minute
  if (Date.now() - riskWarned < 60000) return; riskWarned = Date.now();
  toast('No signal, and this phone won’t let the app keep an offline copy. Keep the app open until it syncs, or the unsynced changes are lost.', true, 8000);
}
// Returns 'saved' (on the server), 'queued' (kept on the phone, will sync) or 'failed' (refused; kept aside).
async function durableWrite(op) {
  const k = oKey(); if (!k) return 'failed';
  op = { id: newVer(), at: new Date().toISOString(), ...op };
  oStore(k, [...oLoad(k), op]);
  if (!Object.keys(qLoad()).length || await flushQueue() === 0) await flushOps();
  if (opFailed.has(op.id)) return 'failed';
  const left = oLoad(k).some(x => x.id === op.id);
  if (left && storageAtRisk) warnAtRisk();
  return left ? 'queued' : 'saved';
}
// Pending changes overlay what the server returned, so a page loaded before they sync still shows them.
const pendingOps = (table, match) => oLoad().filter(o => o.table === table && match(o));
function overlayDays(days) {
  for (const d of days) for (const o of pendingOps('workout_days', o => o.eq?.id === d.id)) Object.assign(d, o.values);
  return days;
}
window.addEventListener('online', () => syncAll());
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAll(); });
setInterval(() => { if (Object.keys(qLoad()).length || oLoad().length) syncAll(); }, 20000);

// ---------- per-lift insights (doc §6.1) ----------
// For a list of exercise ids: recent sessions + earlier best (lift_recent), tagged with meso and meso week, then the
// training engine's status. Within a meso the target RIR drops each week, so lifts are judged on PERFORMANCE
// (load × reps) week over week, and against the same week of the previous meso — never on a RIR-adjusted number
// that stays flat when you hit the plan exactly (L.mesoStatus).
const STATUS_ORDER = { regressing: 0, stalled: 1, dip: 2, pr: 3, progressing: 4, steady: 5, new: 6 };
const PILL_LABEL = { stalled: 'Flat 2 wks', regressing: 'Down' };   // v1.11: calmer words; "Flat" shows no 0.0%
const statusPill = st => `<span class="pill st-${st.status}">${PILL_LABEL[st.status] || st.label}${st.pct != null && !['new', 'stalled'].includes(st.status) ? ` ${st.pct > 0 ? '+' : ''}${st.pct.toFixed(1)}%` : ''}</span>`;
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
let lastScreen = '';
const routes = {
  '': renderHome, mesos: renderMesos, train: renderMesos, new: renderBuilder, meso: renderMeso, workout: renderWorkout,
  explore: renderExplore, history: renderHistory, progress: renderProgress, volume: renderVolume,
  cardio: renderCardio, library: renderLibrary, exercises: () => renderLibrary('exercises'), templates: () => renderLibrary('templates'),
  settings: renderSettings, learn: renderLearn, stats: renderStats, logic: renderLogic, feedback: renderFeedback, summary: renderSummary,
};
async function route() {
  closeSheet(); document.body.classList.remove('has-next');
  const { data } = await sb.auth.getSession(); session = data.session; // waits for supabase-js to read the link's tokens
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
  if (!profile) profile = (await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()).data;
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
let routedUid = undefined;
sb.auth.onAuthStateChange((evt, sess) => {
  if (evt === 'PASSWORD_RECOVERY') { awaitingNewPassword = true; profile = null; return route(); }
  const uid = sess?.user?.id ?? null;
  if (evt === 'SIGNED_OUT' || (evt === 'SIGNED_IN' && uid !== routedUid)) { routedUid = uid; profile = null; route(); }
  else if (sess) session = sess;   // token refresh / same user: keep the fresh session, leave the screen alone
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
  // v1.17.1: days an early light week replaced are hidden (kept in the database, never deleted).
  const q = () => sb.from('workout_days').select('id, week, day_index, label, started_at, completed_at, skipped_at, mesocycle_id, superseded_at').eq('mesocycle_id', mesoId).order('week').order('day_index');
  let r = await q();
  if (r.error && /superseded_at/.test(r.error.message)) r = await sb.from('workout_days').select('id, week, day_index, label, started_at, completed_at, skipped_at, mesocycle_id').eq('mesocycle_id', mesoId).order('week').order('day_index');
  return overlayDays(check(r).filter(d => !d.superseded_at));
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
// v1.17.0 (audit T4): should the light week come early? Suggests only — you decide (startLightWeek).
async function fatigueFor(meso, week) {
  if (!meso || !week || meso.weeks < 4) return { suggest: false };
  const r = await sb.from('muscle_feedback').select('muscle_group, soreness, joint_pain, performance, workout_days!inner(week, mesocycle_id)').eq('workout_days.mesocycle_id', meso.id);
  if (r.error) return { suggest: false };
  return L.fatigueCheck(r.data.map(f => ({ week: f.workout_days.week, muscle: f.muscle_group, recovery: f.soreness, joint_pain: f.joint_pain, performance: f.performance })), { week, weeks: meso.weeks });
}
const fatigueKey = (meso, week) => `wl_fatigue_dismiss:${meso.id}:${week}`;
// The first week from which nothing is started, finished, skipped or logged — that week becomes the light week.
const lightWeekFrom = days => Math.max(0, ...days.filter(d => d.started_at || d.completed_at || d.skipped_at).map(d => d.week)) + 1;
const rpcMissing = e => /function|does not exist|schema cache|Could not find/i.test(e?.message || '');
const pendingHere = () => Object.keys(qLoad()).length + oLoad().length;
/**
 * v1.17.1 (audit D1–D3, U1): the early light week is previewed by the server, confirmed on a screen that says exactly
 * what changes, and sent with the preview's revision — if anything changed in between (another device or tab, a
 * retry), the server refuses and nothing changes. Later weeks are hidden, not deleted, and it can be undone.
 * Resolves true when the light week was set.
 */
async function startLightWeek(meso) {
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
async function undoLightWeek(meso) {
  if (!confirm(`Undo the early light week?\n\nThe meso goes back to ${meso.light_week_undo.weeks} weeks, the hidden workouts come back, and this week's targets return to what they were.`)) return false;
  const r = await sb.rpc('undo_light_week', { p_meso: meso.id, p_revision: meso.revision });
  if (r.error) { toast(r.error.code === '40001' ? 'This meso changed on another device or tab — have another look' : isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return r.error.code === '40001'; }
  toast(`Back to ${r.data.weeks} weeks`); return true;
}
// Sets that landed on hidden days (logged on another device before it synced) — kept; you choose what to do.
async function lateSets(meso) {
  if (meso.light_week_undo == null) return 0;
  const r = await sb.from('workout_days').select('id, workout_exercises(sets(id))').eq('mesocycle_id', meso.id).not('superseded_at', 'is', null);
  if (r.error) return 0;
  return r.data.reduce((a, d) => a + d.workout_exercises.reduce((b, w) => b + w.sets.length, 0), 0);
}
const lateKey = meso => `wl_late_ok:${meso.id}:${meso.revision}`;
const lateCard = (meso, n) => n && !(() => { try { return localStorage.getItem(lateKey(meso)); } catch { return null; } })()
  ? `<div class="card warn" id="lateCard"><b>${n} set${n > 1 ? 's were' : ' was'} logged on workouts the light week replaced</b> — probably from another phone that synced late. ${n > 1 ? 'They’re' : 'It’s'} kept.
     <div class="row mt6">${meso.light_week_undo ? '<button class="sm primary" id="lateRestore">Restore the full meso</button>' : ''}<button class="sm" id="lateKeep">Keep the light week</button></div></div>` : '';
function wireLate(meso, rerender) {
  const k = $('#lateKeep'), r = $('#lateRestore');
  if (k) k.onclick = () => { try { localStorage.setItem(lateKey(meso), '1'); } catch {} $('#lateCard').remove(); };
  if (r) r.onclick = async () => { if (await undoLightWeek(meso)) rerender(); };
}
// Plain-language effort target (v1.11): "RIR" (reps in reserve) only appears in the ⓘ and Learn pages.
const effortText = r => r == null ? '' : r <= 0 ? 'last set to failure' : r === 1 ? 'stop 1 rep short of failure' : `stop ${r} reps short of failure`;
const effortShort = r => r == null ? '' : r <= 0 ? 'to failure' : `${r} rep${r === 1 ? '' : 's'} short`;
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
  // v1.19.0: "Sets this week" follows the same training week as "Workouts this week" when a meso is running
  // (it used to count the calendar week, so the two cards could describe different weeks).
  const wkSetsQ = meso && wk.length ? sb.from('workout_exercises').select('target_sets, exercises(load_type), sets(completed_at, set_type)').in('workout_day_id', wk.map(d => d.id)) : null;
  const [cSess, cSets, stats, warnings, mesoCount, insights, fatigue, late, wkSets] = await Promise.all([
    cardioSince(isoDay(eightAgo)), workoutCardioSince(eightAgo.toISOString()),
    sb.rpc('dashboard_stats', { p_tz: tz }).then(check),
    meso ? slipFor(meso) : Promise.resolve([]),
    sb.from('mesocycles').select('id', { count: 'exact', head: true }).then(x => x.count || 0),
    liftInsights(liftIds, { meso: meso?.id || null }),
    fatigueFor(meso, curWeek),
    meso ? lateSets(meso) : 0,
    wkSetsQ ? wkSetsQ.then(r => r.error ? null : r.data) : null,
  ]);
  const wkLifts = wkSets?.filter(x => x.exercises?.load_type !== 'cardio') || [];
  const wkDone = wkLifts.reduce((a, x) => a + x.sets.filter(z => z.completed_at && z.set_type !== 'warmup').length, 0);
  const wkPlanned = wkLifts.reduce((a, x) => a + (x.target_sets || 0), 0);
  const showFatigue = fatigue.suggest && !live && !(() => { try { return localStorage.getItem(fatigueKey(meso, curWeek)); } catch { return null; } })();
  const lifts = Object.values(insights).sort((a, b) => STATUS_ORDER[a.status.status] - STATUS_ORDER[b.status.status] || a.name.localeCompare(b.name));
  const mesoPrs = lifts.filter(x => x.prs.count).map(x => ({ id: x.id, name: x.name, pct: x.prs.last.pct, week: x.prs.last.week, n: x.prs.count }))
    .sort((a, b) => b.week - a.week || b.pct - a.pct);
  const prCount = meso ? lifts.reduce((a, x) => a + x.prs.count, 0) : (stats.prs || []).length;
  const bw = profile?.bodyweight;
  const cardio = cardioItems(cSess, cSets);
  const inWeek = (dstr, s) => { const d = new Date(dstr + 'T12:00'); const e = new Date(s); e.setDate(e.getDate() + 7); return d >= s && d < e; };
  const thisCardio = cardio.filter(c => inWeek(c.date, ws));
  const mins = c => Number(c.minutes) || 0;   // a session logged without minutes counts as 0, not NaN (NaN blanked the whole chart)
  const cMin = thisCardio.reduce((a, c) => a + mins(c), 0), cLoad = thisCardio.reduce((a, c) => a + (Number(L.cardioLoad(c)) || 0), 0);
  // Weekly hard sets (8 weeks) + this week's sets.
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = new Date(ws); s.setDate(s.getDate() - (7 - i) * 7); return s; });
  const setsPerWeek = weeks.map(s => Number(stats.weeks?.[isoDay(s)] || 0));
  const cardioPerWeek = weeks.map(s => cardio.filter(c => inWeek(c.date, s)).reduce((a, c) => a + mins(c), 0));
  const prs = stats.prs || [], movers = stats.movers || [];
  const totalWorkouts = stats.workouts || 0, totalSets = stats.sets || 0;
  const doneDays = days.filter(d => d.completed_at || d.skipped_at).length;
  const maxSets = Math.max(1, ...setsPerWeek), maxC = Math.max(1, ...cardioPerWeek);
  const bars = (vals, max, color, kind) => `<svg class="chart h110" viewBox="0 0 320 110">${vals.map((v, i) => { const h = Math.round(v / max * 74);   // 74 + label room: the tallest bar's number is never clipped
    return `<g class="bar-hit" data-go="#/stats/${kind}/${isoDay(weeks[i])}" role="button" tabindex="0" aria-label="Week of ${weeks[i].getMonth() + 1}/${weeks[i].getDate()}: ${Math.round(v)}, open details"><rect x="${i * 40 + 2}" y="0" width="36" height="110" fill="transparent"></rect><rect class="cbar${i === 7 ? ' now' + (kind === 'cardio' ? ' cardio' : '') : ''}" x="${i * 40 + 6}" y="${92 - h}" width="28" height="${h}" rx="4"></rect></g>
      <text aria-hidden="true" x="${i * 40 + 20}" y="${88 - h}" font-size="10" text-anchor="middle">${v ? Math.round(v) : ''}</text>
      <text aria-hidden="true" x="${i * 40 + 20}" y="106" font-size="9" text-anchor="middle">${weeks[i].getMonth() + 1}/${weeks[i].getDate()}</text>`; }).join('')}</svg>`;   // numbers sit outside each bar's tap target (v1.13.1), so its name is just its aria-label

  app.innerHTML = `
    <div class="muted small">Hi ${esc(profile?.display_name || '')} ${ic('smile', 'accent')}</div><div class="spacer"></div>
    ${live ? `<div class="card warn"><div class="small">Workout in progress</div><h3>Week ${live.week} · ${esc(dayName(live))}</h3>
        <div class="spacer"></div><button class="primary block" data-go="#/workout">Resume workout</button></div>`
      : next ? `<div class="card"><div class="muted small">Next workout · ${esc(meso.name)}</div>
        <h3>Week ${next.week} · ${esc(dayName(next))}</h3>
        <div class="muted small">${r.deload ? 'Light (deload) week — half the sets, easy effort' : `This week: ${effortText(r.rir)}`}</div>
        <div class="spacer"></div><button class="primary block" data-go="#/workout">Start workout</button>
        ${wk.filter(d => !d.completed_at && !d.skipped_at).length > 1 ? `<button class="ghost block mt6" id="pickDay">Do a different day this week ›</button>` : ''}</div>`
      : !meso && !mesoCount ? `<div class="card info" id="welcome"><h3>Welcome ${ic('smile', 'accent')}</h3>
        <div class="small">Your first plan takes about a minute: how many days you train, how long, your goal and experience, and any sore spots. The app suggests a plan — you can change anything before you start.</div>
        <ol class="small welcome-steps"><li>Build a mesocycle (a 3–8 week block)</li><li>Do the workouts — log weight and reps</li><li>Rate how each muscle felt — the plan adjusts week to week</li></ol>
        <button class="primary block" data-go="#/new">Build my first plan</button></div>`
      : `<div class="card"><h3>${meso ? `Mesocycle finished ${ic('party', 'accent')}` : 'No active mesocycle'}</h3>
        <p class="muted">Start from a base template or one of your saved ones.</p>
        <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">Templates</button></div></div>`}
    ${meso ? lateCard(meso, late) : ''}
    ${showFatigue ? `<div class="card warn" id="fatigueCard"><h3>${ic('alert')} Signs of fatigue — light week now?</h3>
        <div class="small">${esc(fatigue.why)}</div>
        <div class="muted tiny mt6">A light week (half the sets, easy effort) usually lets recovery catch up. This is a rule of thumb from your ratings, not a diagnosis — your call.</div>
        ${fatigue.local?.joint?.length ? `<div class="muted tiny mt6">Joint discomfort (${esc(fatigue.local.joint.join(', '))}) isn’t counted here — it’s handled on that exercise (swap or lighten it).${fatigue.local.severeJoint?.length ? ' Sharp or lasting pain is worth getting checked.' : ''}</div>` : ''}
        <div class="row mt6"><button class="primary sm" id="fatigueYes">Take the light week now</button><button class="sm" id="fatigueNo">Not now</button></div></div>` : ''}
    ${meso ? `<div class="card drill" tabindex="0" role="link" data-go="#/meso/${meso.id}"><div class="row"><div class="grow"><div class="muted small">Mesocycle</div><b>${esc(meso.name)}</b></div>
        <span class="pill ${r?.deload ? 'warn' : 'on'}">${r ? (r.deload ? 'Light week' : `Week ${curWeek}`) : ''}</span></div>
        <div class="prog"><i style="width:${Math.round(doneDays / Math.max(1, days.length) * 100)}%"></i></div>
        <div class="muted tiny mt4">${doneDays}/${days.length} workouts · week ${curWeek} of ${meso.weeks}</div>
        ${warnings.length ? `<div class="meso-note">${ic('alert')} ${warnings.length} thing${warnings.length > 1 ? 's' : ''} to check on this meso ›</div>` : doneDays ? `<div class="meso-note ok">${ic('check')} Reps, sets and recovery on track</div>` : ''}</div>` : ''}
    <div class="grid2 stat-grid">
      <button class="card stat drill" data-go="${meso ? `#/stats/workouts/${curWeek}` : '#/history'}"><span class="muted small">${meso ? `Workouts · week ${curWeek}` : 'Workouts this week'}</span><span class="big">${wk.filter(d => d.completed_at).length}/${wk.length || 0}</span><span class="chev">›</span></button>
      ${meso && wkSets ? `<button class="card stat drill" data-go="#/stats/workouts/${curWeek}"><span class="muted small">Sets · week ${curWeek}</span><span class="big">${wkDone}/${wkPlanned}</span><span class="chev">›</span></button>`
        : `<button class="card stat drill" data-go="#/stats/sets/${isoDay(ws)}"><span class="muted small">Sets this week</span><span class="big">${setsPerWeek[7]}</span><span class="chev">›</span></button>`}
      <button class="card stat drill" data-go="#/stats/cardio/${isoDay(ws)}"><span class="muted small">Cardio this week</span><span class="big">${fmt(cMin)}<span class="muted small"> min</span></span><span class="muted tiny">load ${fmt(cLoad)}</span><span class="chev">›</span></button>
      <button class="card stat drill" data-go="#/stats/prs"><span class="muted small">${meso ? 'PRs this meso' : 'PRs (14 days)'}</span><span class="big">${prCount}</span><span class="chev">›</span></button>
    </div>
    ${(() => { const chart = (title, vals, max, color, kind, empty) => { const n = vals.filter(v => v > 0).length;
        return `<div class="card"><div class="row"><b class="grow">${title}</b>${n ? '<span class="muted tiny">tap a week</span>' : ''}</div>
          ${n ? bars(vals, max, color, kind) : `<div class="empty-chart">${empty}</div>`}${n === 1 ? '<div class="muted tiny">Builds up week by week as you train.</div>' : ''}</div>`; };
      return chart('Working sets per week', setsPerWeek, maxSets, 'var(--accent)', 'sets', 'Your weekly set totals show up here once you log a workout.')
        + chart('Cardio minutes per week', cardioPerWeek, maxC, 'var(--info)', 'cardio', 'No cardio in the last 8 weeks. Log it inside a workout or with “Log cardio” below.'); })()}
    ${meso && lifts.length ? `<div class="card"><div class="row"><b class="grow">This meso’s lifts</b><span class="muted tiny">tap a lift for its chart</span></div>
        ${lifts.filter(x => ['regressing', 'stalled'].includes(x.status.status)).length ? `<div class="muted small my4-2">${lifts.filter(x => ['regressing', 'stalled'].includes(x.status.status)).length} need attention — you’ll see what to do on that lift in your next workout.</div>` : ''}
        ${lifts.map((x, i) => `<button class="mover lift-row ${i >= 8 ? 'more' : ''}" data-go="#/progress/${x.id}" ${i >= 8 ? 'hidden' : ''}><span>${esc(x.name)}</span>${statusPill(x.status)}<span class="chev">›</span></button>`).join('')}
        ${lifts.length > 8 ? `<button class="ghost sm" id="moreLifts">Show all ${lifts.length}</button>` : ''}</div>` : ''}
    ${mesoPrs.length ? `<div class="card"><b>PRs this meso ${ic('trophy', 'pr')}</b>${mesoPrs.slice(0, 5).map(p => `<button class="mover lift-row" data-go="#/progress/${p.id}"><span>${esc(p.name)}${p.n > 1 ? ` <span class="muted tiny">×${p.n}</span>` : ''}</span><span class="pill on">+${p.pct.toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    ${!meso && prs.length ? `<div class="card"><b>Recent PRs ${ic('trophy', 'pr')}</b>${prs.slice(0, 5).map(p => `<button class="mover lift-row" data-go="#/stats/prs"><span>${esc(p.name)}</span><span class="pill on">+${Number(p.pct).toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}</div>` : ''}
    ${!meso && movers.length ? `<div class="card"><b>Strength trend · last 8 weeks</b>
        ${[...movers.slice(0, 3), ...movers.slice(-2).filter(m => m.pct < 0 && !movers.slice(0, 3).includes(m))].map(m => `<button class="mover lift-row" data-go="#/progress"><span>${esc(m.name)}</span>
          <span class="pill ${m.pct > 0 ? 'on' : m.pct < 0 ? 'bad' : ''}">${m.pct > 0 ? '+' : ''}${Number(m.pct).toFixed(1)}%</span><span class="chev">›</span></button>`).join('')}
        <button class="ghost sm" data-go="#/progress">All exercises ›</button></div>` : ''}
    <h2>All time</h2>
    <div class="grid3 keep">
      <button class="card stat center drill" data-go="#/stats/totals"><span class="big">${totalWorkouts}</span><span class="muted tiny">workouts</span><span class="chev">›</span></button>
      <button class="card stat center drill" data-go="#/stats/totals"><span class="big">${totalSets}</span><span class="muted tiny">sets</span><span class="chev">›</span></button>
      <button class="card stat center drill" data-go="#/mesos"><span class="big">${mesoCount}</span><span class="muted tiny">mesocycles</span><span class="chev">›</span></button>
    </div>
    <h2>Quick actions</h2>
    <div class="grid2">
      <button class="tile" data-go="#/cardio"><span class="ico">${ic('heart')}</span><b>Log cardio</b><span class="muted small">Time + intensity</span></button>
      <button class="tile" data-go="#/volume"><span class="ico">${ic('bars')}</span><b>Volume</b><span class="muted small">Sets per muscle</span></button>
      <button class="tile" data-go="#/learn"><span class="ico">${ic('cap')}</span><b>Learn</b><span class="muted small">Sets, reps &amp; why</span></button>
      <button class="tile" data-go="#/progress"><span class="ico">${ic('trendUp')}</span><b>Progress</b><span class="muted small">Strength per lift</span></button>
    </div>`;
  $$('[data-go]').forEach(b => { b.onclick = e => { e.stopPropagation(); go(b.dataset.go); };
    if (b.tagName === 'g' || b.classList.contains('drill')) b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(b.dataset.go); } }; });
  // Pick any open day in the current week (e.g. legs today instead of back) — doc §5.3.
  if (meso) wireLate(meso, renderHome);
  if ($('#fatigueYes')) {
    $('#fatigueYes').onclick = async e => { e.target.disabled = true; if (await startLightWeek(meso)) renderHome(); else e.target.disabled = false; };
    $('#fatigueNo').onclick = () => { try { localStorage.setItem(fatigueKey(meso, curWeek), '1'); } catch {} $('#fatigueCard').remove(); toast('OK — it’ll ask again next week if the signs continue'); };
  }
  $('#pickDay') && ($('#pickDay').onclick = e => { e.stopPropagation();
    const opts = wk.filter(d => !d.completed_at && !d.skipped_at);
    openSheet(`<h3>Week ${curWeek} — which day today?</h3><p class="muted small">Any order is fine inside a week; each day still progresses from the same day last week.</p>
      ${opts.map(d => `<button class="list-btn" data-day="${d.id}"><div class="grow"><b>${esc(dayName(d))}</b>${d.id === next.id ? ' <span class="pill on tiny-pill">next in order</span>' : ''}</div>›</button>`).join('')}
      <button class="ghost block" data-meso="${meso.id}">See every day of the meso</button>`,
      panel => { panel.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { closeSheet(); go('#/workout/' + b.dataset.day); });
        panel.querySelector('[data-meso]').onclick = () => { closeSheet(); go('#/meso/' + meso.id); }; }); });
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
  app.innerHTML = `<div class="muted small mb10">A mesocycle is a training block of 4–8 weeks: effort builds week by week, then a light week lets you recover.</div>
    <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">From a template</button></div>
    ${by(['active', 'planned']).length ? '<h2>Current</h2>' + by(['active', 'planned']).map(item).join('') : ''}
    <h2>Past</h2>${by(['completed', 'abandoned']).map(item).join('') || '<p class="muted">None yet.</p>'}`;
  $$('[data-meso]').forEach(b => b.onclick = () => go('#/meso/' + b.dataset.meso));
  $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') builder = null; go(b.dataset.go); });
}

// v1.16.0 (audit T1): templates that train a growing muscle once a week are offered, ranked after the 2× ones, and say so.
const onceNote = t => t.once?.length ? `<div class="tiny warn-text">Once a week: ${esc(t.once.join(', '))}. Works at the same weekly sets; splitting them over two days is the usual default.</div>` : '';
// v1.19.0 (audit U3): starting effort = what you last picked, else what your experience suggests, else Standard.
const lsGet0 = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet0 = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const startEffort = () => lsGet0('wl_effort_mode') ? L.effortOf(lsGet0('wl_effort_mode')) : L.EXPERIENCE[L.experienceOf(lsGet0('wl_experience'))]?.effort || 'standard';
const equipText = () => profile?.equipment?.length ? profile.equipment.join(', ') : 'a full gym';
// ---------- mesocycle builder ----------
let builder = null;
function freshBuilder() {
  return { step: 1, name: '', weeks: 5, days: 4, focus: 'whole', preset: 'balanced', start: 'suggested', goal: 'hypertrophy', priorities: L.templatePriorities('whole'), plan: [],
    minutes: Number(localStorage.getItem('wl_session_minutes')) || 75, effort: startEffort(), exp: L.experienceOf(lsGet0('wl_experience')), lastMeso: undefined };
}
function builderFromTemplate(t) {
  const b = { step: 2, start: 'scratch', nameTouched: true, weeksTouched: true, name: t.name.replace(/ \(from .*\)$/, ''), weeks: t.weeks, days: t.days_per_week, focus: t.focus, goal: L.goalOf(t.goal),
    priorities: Object.keys(t.priorities || {}).length ? Object.fromEntries(Object.entries(t.priorities).map(([m, p]) => [m, L.normPriority(p, t.focus)])) : L.templatePriorities(t.focus),
    minutes: Number(localStorage.getItem('wl_session_minutes')) || 75, effort: startEffort(), exp: L.experienceOf(lsGet0('wl_experience')),
    plan: t.plan.map(d => ({ label: d.label, slots: d.slots.map(x => ({ ...x })) })) };
  b.preset = L.matchPreset(b.priorities) || L.presetOfFocus(b.focus); b.adjusted = !L.matchPreset(b.priorities) && !!b.preset;
  return b;
}
async function renderBuilder() {
  setHeader('New mesocycle', '#/mesos', 'mesos');
  const lib = await loadExercises();
  // Personal preferences (favorites, exclusions + substitutes, equipment, avoided tags) shape what autofill picks.
  const prefsB = await loadPrefs();
  let P = L.applyPreferences(lib, { prefs: prefsB, equipment: profile?.equipment, avoidTags: profile?.avoid_tags || [] });
  const recomputeP = () => { P = L.applyPreferences(lib, { prefs: prefsB, equipment: profile?.equipment, avoidTags: profile?.avoid_tags || [] }); };
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
    builder = null; toast('Mesocycle created'); go('#/meso/' + mesoId);
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
async function renderMeso(id) {
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
      builder = builderFromTemplate({ name: meso.name + ' (again)', weeks: meso.weeks, days_per_week: meso.days_per_week, focus: meso.focus, goal: meso.goal, priorities: meso.priorities, plan });
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

// ---------- recovery follow-ups (doc §3, §5) ----------
async function pendingRecovery(day, muscles) {
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

async function applyAdjustment(fb, R, meso) {
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
async function renderWorkout(dayId, mode) {
  const preview = mode === 'view';
  if (!dayId) {
    setHeader('Workout', null, 'workout');
    const m = await activeMeso(); const ds = m ? await mesoDays(m.id) : [];
    const cur = ds.find(d => d.started_at && !d.completed_at && !d.skipped_at) || openDays(ds)[0];
    if (cur) return renderWorkout(cur.id);
    app.innerHTML = `<div class="card"><h3>No workout queued</h3><p class="muted">${m ? 'This mesocycle is finished.' : 'Start a mesocycle to get your next workout here.'}</p>
      <div class="grid2"><button class="primary" data-go="#/new">+ New mesocycle</button><button data-go="#/templates">Templates</button></div></div>
      <button class="list-btn" data-go="#/cardio"><span class="list-ico">${ic('heart')}</span><div class="grow"><b>Just cardio today?</b><div class="muted small">Log time and intensity</div></div>›</button>`;
    return $$('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.go === '#/new') builder = null; go(b.dataset.go); });
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
  const loadedRaw = wes.map(w => ({ id: w.id, exercise_id: w.exercise_id, target_rir: w.target_rir, exercises: w.exercises, sets: w.sets.map(x => ({ ...x })) }));
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
          return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}"><div class="n">${i + 1}</div>
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
            return `<div class="set ${s.completed_at ? 'done' : ''} ${s._queued ? 'queued' : ''}" data-idx="${i + 1}" data-key="${we.id}:${i + 1}" data-at="${s.completed_at || ''}">
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
      ${required ? '' : '<button class="ghost block" id="later">Cancel</button>'}`, panel => {
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
      const later = panel.querySelector('#later'); if (later) later.onclick = closeSheet;
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
      ${required ? '' : '<button class="ghost block" id="later">Cancel</button>'}`, panel => {
      panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        f[b.dataset.k] = +b.dataset.v;
        panel.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle('on', x === b));
      });
      const later = panel.querySelector('#later'); if (later) later.onclick = closeSheet;
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
  function enforceRatings() {
    if (!sheet.hidden) return;
    const we = wes.find(w => exComplete(w) && !exRated(w));
    if (we) return openExRating(we, true);
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
        completed_at: done ? (row.dataset.at || new Date().toISOString()) : null };
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
        weight: null, reps: null, completed_at: done ? (row.dataset.at || new Date().toISOString()) : null };
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
      if (last.dataset.busy) return toast('That set is still saving — try again in a second', true);
      // Drop any queued offline save for this set FIRST, so a later sync can't bring it back.
      const q = qLoad(); const queued = q[key]; delete q[key]; qStore(q); syncBadge(); lastSent.delete(key);
      const { error } = await sb.from('sets').delete().eq('workout_exercise_id', we.id).eq('set_index', +last.dataset.idx);
      if (error) {   // keep the row (and its queued save) if the server didn't delete it
        if (queued) { const q2 = qLoad(); q2[key] = queued; qStore(q2); syncBadge(); }
        return toast(isNetErr(error) ? 'No signal — can’t remove a set offline. Try again when you’re connected.' : `Couldn’t remove that set: ${error.message}`, true);
      }
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
    const r = await sb.from('workout_exercises').select('id, exercise_id, target_rir, exercises(*), sets(*)').eq('workout_day_id', dayId);
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
    const summary = { at: Date.now(), dayId, mesoId: meso.id, title: `Week ${day.week} · ${dayName(day)}`, queued: done === 'queued',
      next: next ? { id: next.id, title: `Week ${next.week} · ${dayName(next)}` } : null, mesoName: meso.name,
      lifts: fresh.filter(w => !isCardio(w)).map(w => {
        const ss = fill(w.sets.filter(x => x.completed_at), w.target_rir), p = prev[w.exercise_id];
        const cur = pick(ss, w.exercises), old = p ? pick(fill(p.sets, p.rir), w.exercises) : null;
        return { name: w.exercises.name, done: ss.length, planned: w.target_sets || 0,
          best: cur ? { w: cur.x.weight, r: cur.x.reps } : null, last: old ? { w: old.x.weight, r: old.x.reps } : null,
          trend: p ? L.comparableTrend(ss, fill(p.sets, p.rir), w.exercises, bw) : null };
      }),
      cardio: fresh.filter(w => isCardio(w)).map(w => ({ name: w.exercises.name, min: w.sets.filter(x => x.completed_at).reduce((a, x) => a + (Number(x.duration_min) || 0), 0) })).filter(c => c.min),
      muscles: muscles.map(m => ({ m, perf: perfByMuscle[m] ?? null })) };
    try { sessionStorage.setItem('wl_summary', JSON.stringify(summary)); } catch {}
    go('#/summary');
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

// ---------- explore ----------
function renderExplore() {
  setHeader('More', null, 'explore');   // v1.11: "More" = learn, stats and settings; exercises/templates live in Library, mesos in Mesos
  const items = [
    ['#/learn', 'cap', 'Learn', 'Sets, reps and effort for size, strength, athleticism and cardio — with the research'],
    ['#/history', 'history', 'History', 'Every workout and cardio session'],
    ['#/progress', 'trendUp', 'Exercise progress', 'How each lift is trending over time'],
    ['#/volume', 'bars', 'Muscle volume', 'Weekly sets per muscle vs. the range that builds muscle'],
    ['#/cardio', 'heart', 'Cardio', 'Minutes, intensity and load by week'],
    ['#/settings', 'sliders', 'Settings', 'Injuries & sore spots, equipment, theme, units, bodyweight, sign out'],
    ['#/feedback', 'star', 'Send feedback', 'Rate the app, report a bug or suggest an idea'],
  ];
  app.innerHTML = items.map(([h, i, t, d]) => `<button class="list-btn" data-go="${h}"><span class="list-ico">${ic(i)}</span>
    <div class="grow"><b>${t}</b><div class="muted small">${d}</div></div>›</button>`).join('') +
    `<div class="card small muted">How the app decides weights, sets and RIR: <a href="#/logic">How it works — training logic &amp; evidence</a></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

// ---------- post-workout summary (v1.19.0, audit U5) ----------
function renderSummary() {
  let S = null; try { S = JSON.parse(sessionStorage.getItem('wl_summary') || 'null'); } catch {}
  if (!S) return go('#/');
  setHeader('Workout done', '#/', 'home');
  const done = S.lifts.reduce((a, l) => a + l.done, 0), planned = S.lifts.reduce((a, l) => a + l.planned, 0);
  const fmt = x => x ? (Number(x.w) ? `${+x.w}×${x.r}` : `${x.r} reps`) : '—';
  const arrow = t => t === 1 ? '<span class="trend up" role="img" aria-label="better than last time">▲</span>' : t === 0 ? '<span class="trend flat" role="img" aria-label="about the same as last time">▬</span>'
    : t === -1 ? '<span class="trend down" role="img" aria-label="below last time">▼</span>' : '<span class="trend na" role="img" aria-label="no fair comparison yet">·</span>';
  const perfWord = v => v === 1 ? 'up' : v === 0 ? 'about the same' : v === -1 ? 'down' : 'no comparison yet';
  const waiting = pendingHere() > 0;
  app.innerHTML = `
    <div class="card"><div class="muted small">${esc(S.mesoName)}</div><h3 class="sum-title">${esc(S.title)} ${ic('check', 'accent')}</h3>
      <div class="sum-stats"><div><b>${done}</b><span class="muted tiny">of ${planned} sets</span></div>
        <div><b>${S.lifts.filter(l => l.done).length}</b><span class="muted tiny">exercises</span></div>
        <div><b>${S.lifts.filter(l => l.trend === 1).length}</b><span class="muted tiny">beat last time</span></div></div>
      <div class="small ${waiting ? 'warn-text' : 'muted'}" id="sumSync">${waiting ? `${ic('alert')} Saved on this phone — it syncs when you’re back online. Keep the app open until it does.` : `${ic('check')} Saved and synced.`}</div></div>
    <div class="card"><h3>Your lifts</h3>
      ${S.lifts.map(l => `<div class="sum-row"><div class="grow"><b>${esc(l.name)}</b><div class="muted tiny">${l.done}/${l.planned} sets${l.done < l.planned ? ' · fewer than planned' : ''}</div></div>
        <div class="sum-best small">${l.best ? `${arrow(l.trend)} ${fmt(l.best)}` : ''}<div class="muted tiny">${l.last ? `last time ${fmt(l.last)}` : l.done ? 'first time' : 'not done'}</div></div></div>`).join('')}
      ${S.cardio.map(c => `<div class="sum-row"><div class="grow"><b>${esc(c.name)}</b></div><div class="small">${c.min} min</div></div>`).join('')}
      <div class="muted tiny mt6">▲ ▬ ▼ compare your best set with last time’s by estimated strength — an estimate, and only when the reps are similar (· = no fair comparison yet).</div></div>
    <div class="card"><h3>What happens next</h3>
      <div class="small">Ratings saved. Performance: ${S.muscles.map(x => `${esc(x.m)} ${perfWord(x.perf)}`).join(' · ') || '—'}.</div>
      <div class="muted tiny mt6">Next time you train these you’ll be asked how they recovered — that sets next week’s sets. One session never changes them on its own.</div>
      ${S.next ? `<button class="primary block mt10" data-go="#/">Next up: ${esc(S.next.title)}</button>` : `<button class="primary block mt10" data-go="#/meso/${esc(S.mesoId)}">Meso finished — see it and run it again</button>`}
      <button class="ghost block mt6" data-go="#/history">See history</button></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => { try { sessionStorage.removeItem('wl_summary'); } catch {} go(b.dataset.go); });
}

// ---------- feedback (v1.15.0) ----------
// A star rating and/or a note, kept private to you; the app owner reads them in the database. Insert-only.
async function renderFeedback() {
  setHeader('Send feedback', '#/explore', 'explore');
  let rating = null, kind = 'idea';
  const KINDS = [['idea', 'Idea'], ['bug', 'Something’s wrong'], ['praise', 'Praise'], ['other', 'Other']];
  const past = await sb.from('app_feedback').select('rating, kind, message, app_version, created_at').order('created_at', { ascending: false }).limit(10);
  const ready = !past.error;
  app.innerHTML = `<div class="card">
      <h3>How’s the app working for you?</h3>
      <div class="stars" role="group" aria-label="Rating, 1 to 5 stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-pressed="false" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      <div class="lbl">What’s it about?</div>
      <div class="seg c2" id="fbKind" role="group" aria-label="What it's about">${KINDS.map(([k, t]) => `<button type="button" data-kind="${k}" aria-pressed="${k === kind}" class="${k === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label for="fbMsg" class="mt6">Tell us more <span class="muted tiny">(optional if you picked stars)</span></label>
      <textarea id="fbMsg" rows="5" maxlength="2000" placeholder="What happened, what you expected, or what you'd like…"></textarea>
      <div class="muted tiny" id="fbCount">0 / 2000</div>
      <button class="primary block mt6" id="fbSend" disabled>Send</button>
      <p class="muted tiny">Goes to the app owner with the app version and the screen you came from. No health notes needed — keep it about the app.</p>
    </div>
    ${ready ? (past.data.length ? `<div class="card"><h3>What you’ve sent</h3>${past.data.map(f => `<div class="fb-item"><div class="small"><b>${f.rating ? '★'.repeat(f.rating) : ''}</b> <span class="pill tiny-pill">${esc((KINDS.find(k => k[0] === f.kind) || [, f.kind])[1])}</span> <span class="muted tiny">${new Date(f.created_at).toLocaleDateString()}${f.app_version ? ' · v' + esc(f.app_version) : ''}</span></div>${f.message ? `<div class="small">${esc(f.message)}</div>` : ''}</div>`).join('')}</div>` : '')
      : '<div class="card warn small">Feedback isn’t switched on yet — check back after the next update.</div>'}`;
  const send = $('#fbSend'), msg = $('#fbMsg');
  const sync = () => { send.disabled = !ready || !(rating || msg.value.trim()); $('#fbCount').textContent = `${msg.value.length} / 2000`; };
  $$('[data-star]').forEach(b => b.onclick = () => { const n = Number(b.dataset.star); rating = rating === n ? null : n;
    $$('[data-star]').forEach(x => x.setAttribute('aria-pressed', String(rating != null && Number(x.dataset.star) <= rating))); sync(); });
  $$('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind;
    $$('[data-kind]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); });
  msg.oninput = sync; sync();
  send.onclick = async () => {
    send.disabled = true;
    const r = await sb.from('app_feedback').insert({ rating, kind, message: msg.value.trim() || null, app_version: APP_VERSION, screen: (lastScreen || '').slice(0, 80) || null });
    if (r.error) { sync(); return toast(navigator.onLine ? 'Couldn’t send — try again' : 'You’re offline — send it when you’re back online', true); }
    toast('Thanks — feedback sent'); renderFeedback();
  };
}

// ---------- Home drill-downs (#/stats/<kind>/<arg>) ----------
async function renderStats(kind, arg) {
  const wkNav = (base, startIso) => { const d = new Date(startIso + 'T12:00'); const p = new Date(d), n = new Date(d); p.setDate(p.getDate() - 7); n.setDate(n.getDate() + 7);
    const cur = isoDay(weekStart()); return `<div class="row wk-nav"><button class="ghost sm" data-go="${base}/${isoDay(p)}">‹ Prev week</button><b class="grow center">Week of ${d.getMonth() + 1}/${d.getDate()}${startIso === cur ? ' (this week)' : ''}</b>${isoDay(n) <= cur ? `<button class="ghost sm" data-go="${base}/${isoDay(n)}">Next week ›</button>` : '<span class="w84"></span>'}</div>`; };
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
    setHeader('Working sets', '#/', 'home');
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
      ${prs.length ? `<div class="card"><b>Lifts with PRs ${ic('trophy', 'pr')}</b>${prs.map(x => `<button class="mover lift-row" data-go="#/progress/${x.id}/meso"><span>${esc(x.name)} <span class="muted tiny">${x.prs.count}× · latest +${x.prs.last.pct.toFixed(1)}% in wk ${x.prs.last.week}</span></span>${statusPill(x.status)}<span class="chev">›</span></button>`).join('')}</div>` : ''}
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
// v1.11.4 — "How it works": the full training rules and evidence, rendered from docs/training-logic.md (same origin,
// public-safe content). md.js escapes everything before formatting, so the page can't inject markup.
async function renderLogic() {
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

async function renderHistory() {
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

async function renderProgress(exId, rangeArg, metricArg) {
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
async function renderLibrary(tab = 'exercises') {
  setHeader('Library', null, 'library');
  const head = `<div class="tabs2"><button data-lt="exercises" class="${tab === 'exercises' ? 'on' : ''}">Exercises</button><button data-lt="templates" class="${tab === 'templates' ? 'on' : ''}">Templates</button></div>`;
  const wireTabs = () => $$('[data-lt]').forEach(b => b.onclick = () => go('#/' + b.dataset.lt));
  if (tab === 'templates') return renderTemplates(head, wireTabs);
  return renderExercises('', head, wireTabs);
}
let tplView = { days: null, focus: '' };
async function renderTemplates(head, wireTabs) {
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
      const t = L.templateById(b.dataset.tpl); builder = freshBuilder();
      Object.assign(builder, { start: 'template', tpl: t.id, tplFocus: tplView.focus || null, days: t.days, daysTouched: true, split: t.split, scrollTpl: true,
        priorities: L.presetPriorities(t.preset), preset: t.preset, focus: t.focus });
      go('#/new'); });
    $$('[data-use]').forEach(b => b.onclick = () => { builder = builderFromTemplate(mine.find(t => t.id === b.dataset.use)); go('#/new'); });
    $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this template?')) return; check(await sb.from('templates').delete().eq('id', b.dataset.del)); renderLibrary('templates'); });
  };
  draw();
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

// ---------- injuries & sore spots (shared by Settings and the meso builder) ----------
const myAreas = () => L.avoidedAreas(profile?.avoid_tags || []);
function areaGrid(lib) {
  const areas = myAreas(), count = a => lib.filter(e => L.exerciseAreas(e).has(a)).length;
  return `<div class="area-grid" role="group" aria-label="Areas to go easy on">${Object.entries(L.BODY_AREAS).map(([k, a]) => { const on = areas.includes(k), n = on ? count(k) : 0;
    return `<button type="button" class="area ${on ? 'on' : ''}" data-area="${k}" aria-pressed="${on}"><span class="area-top"><b>${esc(a.name)}</b><span class="tick" aria-hidden="true">${on ? ic('check') : ''}</span></span>
      <span class="tiny muted">${on ? `Leaving out ${n} exercise${n === 1 ? '' : 's'}` : 'Off'}</span></button>`; }).join('')}</div>`;
}
// Saves at once (the same setting everywhere), keeping any other avoid tags the account has. Returns true if saved.
async function toggleArea(key, btn) {
  const tag = L.BODY_AREAS[key].tag, cur = profile?.avoid_tags || [];
  const next = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag];
  if (btn) btn.disabled = true;
  const r = await sb.from('profiles').update({ avoid_tags: next }).eq('id', session.user.id).select().single();
  if (r.error) { if (btn) btn.disabled = false; toast(isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return false; }
  profile = { ...profile, ...r.data };
  toast(next.includes(tag) ? `${L.BODY_AREAS[key].name}: going easy — the exercises that load it most are left out` : `${L.BODY_AREAS[key].name}: back to normal`);
  return true;
}
// v1.15.1: OK (or take back) one exercise despite an area you're going easy on — saved as "allow:<id>".
async function setAllowed(id, on) {
  const tag = 'allow:' + id, cur = profile?.avoid_tags || [];
  const next = on ? [...new Set([...cur, tag])] : cur.filter(t => t !== tag);
  const r = await sb.from('profiles').update({ avoid_tags: next }).eq('id', session.user.id).select().single();
  if (r.error) { toast(isNetErr(r.error) ? 'No signal — try again when you’re back online' : r.error.message, true); return false; }
  profile = { ...profile, ...r.data, avoid_tags: next }; return true;
}
async function clearAreas() {
  const keep = (profile?.avoid_tags || []).filter(t => !Object.values(L.BODY_AREAS).some(a => a.tag === t));
  const r = await sb.from('profiles').update({ avoid_tags: keep }).eq('id', session.user.id).select().single();
  if (r.error) { toast(r.error.message, true); return false; }
  profile = { ...profile, ...r.data }; return true;
}

// ---------- settings ----------
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith Machine', 'Kettlebell', 'Band'];
async function renderSettings() {
  setHeader('Settings', '#/explore', 'explore');
  const lib = await loadExercises();
  const eq = profile?.equipment; // null = everything
  const areas = myAreas();
  app.innerHTML = `<div class="card">
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
  $('#save').onclick = async () => {
    const bw = $('#bw').value;
    // The bodyweight box is in the unit shown when the page opened; convert with that unit, then switch.
    const bwLb = bw === '' ? null : bw === $('#bw').defaultValue ? profile?.bodyweight : Math.round(toLb(bw) * 10) / 10; // unchanged → keep exact stored value
    profile = { ...profile, ...check(await sb.from('profiles').update({ display_name: $('#name').value.trim(), unit: $('#unit').value, bodyweight: bwLb })
      .eq('id', session.user.id).select().single()) };
    toast('Saved'); renderSettings();
  };
  $('#savePrefs').onclick = async () => {
    const picked = $$('input[name=eq]:checked').map(i => i.value);
    profile = { ...profile, ...check(await sb.from('profiles').update({ equipment: picked.length === EQUIPMENT.length ? null : picked })
      .eq('id', session.user.id).select().single()) };
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

route();
