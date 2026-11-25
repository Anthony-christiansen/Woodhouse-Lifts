// Woodhouse Lifts — Supabase client and the offline-safe sync queue (moved out of app.js in 1.20.2, unchanged).
// Owns the signed-in session the queue keys on; app.js sets it with setSession() and reads it (live binding).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm';
import * as L from './logic.js?v=64';
import { toast } from './ui.js?v=64';

// Public by design: access is enforced by row-level security in the database.
export const sb = createClient('https://dnknmtzcmmdepwheagmq.supabase.co', 'sb_publishable_UANLQGHztac0fMLcBeUg4g_sFeKc88g',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
export let session = null;
export const setSession = s => { session = s; };

// ---------- reliable set saving ----------
// Every set save is an idempotent upsert keyed by (workout_exercise_id, set_index), so the database can never
// hold a duplicate set. If the network drops (gym basements), the save is kept on the phone and retried
// automatically — when the connection returns, when the app comes back to the foreground, and every 20 s.
// The queue is per account (review #2): switching accounts on the same phone can't send one person's sets as another's.
// v1.15.1 (audit S1): if the phone refuses to store the offline copy (storage full, blocked, private mode), the copy
// is kept in memory for this session instead and the app says plainly that closing it would lose those changes —
// it never claims "saved on your phone" when it isn't.
export const memStore = new Map(); export let storageAtRisk = false;
export const lsGet = k => memStore.has(k) ? memStore.get(k) : localStorage.getItem(k);
export function lsSet(k, v) {
  try { localStorage.setItem(k, v); memStore.delete(k); return true; }
  catch { memStore.set(k, v); if (!storageAtRisk) { storageAtRisk = true; setTimeout(syncBadge); } return false; }
}
export const QKEY = 'wl_pending_sets_v1';
export const qKey = () => session?.user?.id ? `${QKEY}:${session.user.id}` : null;
export const qLoad = () => { const k = qKey(); if (!k) return {}; try { return JSON.parse(lsGet(k) || '{}'); } catch { return {}; } };
export const qStore = q => { const k = qKey(); if (!k) return; lsSet(k, JSON.stringify(q)); };
// Sets the server rejected for good (not a network problem) are kept here instead of being thrown away.
export const qFailedKey = () => session?.user?.id ? `${QKEY}:failed:${session.user.id}` : null;
export const qFailed = () => { const k = qFailedKey(); try { return k ? JSON.parse(lsGet(k) || '[]') : []; } catch { return []; } };
// v1.20.8: a refused set is listed once (its latest values) — a set refused on change and again on ✓ isn't two problems.
export const qAddFailed = (p, msg) => { const k = qFailedKey(); if (!k) return;
  const same = f => !p.op && !f.op && f.workout_exercise_id === p.workout_exercise_id && f.set_index === p.set_index;
  lsSet(k, JSON.stringify([...qFailed().filter(f => !same(f)), { ...p, _error: msg, _at: new Date().toISOString() }].slice(-50))); };
// One-time move of the old shared queue (before 1.8.0) into the signed-in account's queue; the database's row-level
// security rejects anything that isn't this user's, and those land in the failed list rather than being lost.
export function qMigrateLegacy() {
  try { const old = localStorage.getItem(QKEY); if (!old || !qKey()) return;
    const q = { ...JSON.parse(old), ...qLoad() }; qStore(q); localStorage.removeItem(QKEY); } catch {}
}
// Smallest weight jumps per equipment (doc §4.6) — kept on this phone; defaults are 2.5 lb / 1.25 kg, dumbbells 5 lb / 2 kg.
export const loadIncrements = () => { try { return JSON.parse(localStorage.getItem('wl_increments') || '{}'); } catch { return {}; } };
L.setIncrements(loadIncrements());
// Permanent = the database refused the row (constraint, permission); anything else (network, 5xx, timeouts) is retried.
export const isPermanentErr = e => /^(22|23|42)/.test(e?.code || '') || e?.code === 'PGRST116';
export const isNetErr = e => !navigator.onLine || /failed to fetch|network|load failed|timeout|fetch/i.test(e?.message || '');
export const setKey = p => p.workout_exercise_id + ':' + p.set_index;
// v1.12.1 (outside audit, finding 2): no stale writes.
//  - Write-ahead: every edit is stored on the phone (with a version) BEFORE it is sent, so closing the app mid-save
//    loses nothing.
//  - One write at a time per set: saves and offline retries for the same set go out in order, so an older value can
//    never land on the server after a newer one.
//  - A save only clears the phone copy if that copy is still the version it sent; a newer edit made meanwhile stays
//    queued and is sent next.
//  - The account is fixed per write: if you switch accounts mid-save, the other account's queue is never touched.
export let verSeq = 0;
export const newVer = () => `${Date.now().toString(36)}.${(++verSeq).toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
export const stripLocal = p => { const { _v, _queued, ...row } = p; return row; };
export const sameVersion = (a, b) => !!a && !!b && (a._v ?? JSON.stringify(a)) === (b._v ?? JSON.stringify(b));
export const qLoadFor = k => { try { return k ? JSON.parse(lsGet(k) || '{}') : {}; } catch { return {}; } };
export const qStoreFor = (k, q) => { if (!k) return true; return lsSet(k, JSON.stringify(q)); };
export const setChains = new Map();
export function inOrder(key, fn) {           // runs fn after every earlier write for this set has finished
  const next = (setChains.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  setChains.set(key, next);
  next.finally(() => { if (setChains.get(key) === next) setChains.delete(key); }).catch(() => {});
  return next;
}
// v1.20.9 (audit 1.20.4 finding 2): a removed set must stay removed.
//  - deleteSet runs in the SAME per-set chain as saves, so it always lands after any save already on its way
//    (a sync after reconnecting used to be able to re-create the set right after "− set").
//  - It leaves a tombstone on the phone (shared by every tab of the app, per account). Any copy of that set edited
//    BEFORE the delete is dropped instead of sent; editing the set again afterwards (newer version) is sent as normal.
//  Not covered (needs a server-side guard, see the session log): a stale offline copy on ANOTHER phone.
const tombKey = () => session?.user?.id ? `wl_set_tombstones_v1:${session.user.id}` : null;
const verTime = v => parseInt(String(v || '').split('.')[0], 36) || 0;   // newVer() starts with Date.now() in base 36
export const tombstones = () => { const k = tombKey(); if (!k) return {}; try { return JSON.parse(lsGet(k) || '{}'); } catch { return {}; } };
const setTomb = (key, at) => { const k = tombKey(); if (!k) return; const t = tombstones(), now = Date.now();
  for (const [x, ts] of Object.entries(t)) if (now - ts > 14 * 864e5) delete t[x];   // old ones expire after 2 weeks
  if (at == null) delete t[key]; else t[key] = at; lsSet(k, JSON.stringify(t)); };
export function deleteSet(workoutExerciseId, setIndex) {
  const qk = qKey(), k = workoutExerciseId + ':' + setIndex;
  return inOrder(qk + '|' + k, async () => {
    const q = qLoadFor(qk), queued = q[k]; delete q[k]; qStoreFor(qk, q); lastSent.delete(k);
    const at = Date.now(); setTomb(k, at);
    const { error } = await sb.from('sets').delete().eq('workout_exercise_id', workoutExerciseId).eq('set_index', setIndex);
    if (error) {   // not deleted: put back what was waiting and lift the tombstone
      setTomb(k, null);
      if (queued) { const q2 = qLoadFor(qk); if (!q2[k]) { q2[k] = queued; qStoreFor(qk, q2); } }
    }
    syncBadge();
    return error || null;
  });
}
// Sends the phone copy of one set (whatever is newest when its turn comes). Result: 'saved' | 'queued' | 'failed' | 'gone'.
export function sendQueued(k, qk, uid) {
  return inOrder(qk + '|' + k, async () => {
    const cur = qLoadFor(qk)[k];
    if (!cur) return 'gone';                                         // removed meanwhile (set deleted)
    const dead = tombstones()[k];
    if (dead && verTime(cur._v) <= dead) {                           // edited before it was removed (another tab): drop it
      const q = qLoadFor(qk); if (sameVersion(q[k], cur)) { delete q[k]; qStoreFor(qk, q); } return 'gone';
    }
    if (session?.user?.id !== uid) return 'queued';                  // account switched: leave it for its owner
    const { error } = await sb.from('sets').upsert(stripLocal(cur), { onConflict: 'workout_exercise_id,set_index' });
    if (session?.user?.id !== uid) return 'queued';
    if (!error) { const q = qLoadFor(qk); if (sameVersion(q[k], cur)) { delete q[k]; qStoreFor(qk, q); } return 'saved'; }
    if (!isPermanentErr(error)) return 'queued';                     // network or server hiccup → keep & retry
    const q = qLoadFor(qk); if (sameVersion(q[k], cur)) { delete q[k]; qStoreFor(qk, q); qAddFailed(stripLocal(cur), error.message); }
    return Object.assign(new String('failed'), { message: error.message });
  });
}
export const lastSent = new Map();   // newest value of every set edited in this app session (for finishing with no signal)
export async function saveSet(payload) {
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
export let flushing = false;
export async function flushQueue() {
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
export function syncBadge() {
  const qk = qKey(), sets = Object.keys(qLoad()).filter(k => !setChains.has(qk + '|' + k)).length;   // in-flight saves aren't "waiting"
  const ops = opsFlushing ? 0 : oLoad().length, n = sets + ops;
  let b = document.getElementById('syncBadge');
  document.body.classList.toggle('has-sync', !!n);   // v1.12.3: room at the bottom so the badge never covers a button
  if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('button'); b.id = 'syncBadge'; b.className = 'sync-badge'; b.onclick = () => syncAll(); document.body.appendChild(b); }
  const memory = saveState().state === 'memory';   // v1.20.8: the same answer the summary gives
  b.textContent = `⟳ ${[sets ? `${sets} set${sets > 1 ? 's' : ''}` : '', ops ? `${ops} change${ops > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ')} waiting to sync${memory ? ' — NOT saved on this phone, keep the app open' : ''} — tap to retry`;
  b.classList.toggle('risk', memory);
  b.setAttribute('aria-live', 'polite');
}
// v1.20.8 (audit 1.20.4 finding 1): ONE answer to "is my workout safe?", used by the summary, the sync badge and
// Settings, so they can never disagree. States, most urgent first:
//   refused  — the server refused something since `since` (kept aside; Settings → Sync problems lists it)
//   memory   — waiting to sync AND this phone wouldn't store the copy: closing the app loses it
//   saving   — a save is on its way right now (not yet confirmed)
//   device   — waiting to sync, stored on this phone; it goes out by itself
//   synced   — nothing waiting, nothing in flight
export function saveState({ since = null } = {}) {
  const qk = qKey(), ok = oKey();
  const setKeys = Object.keys(qLoad()), ops = oLoad().length;
  const inFlight = setKeys.filter(k => setChains.has(qk + '|' + k)).length + (opsFlushing ? 1 : 0);
  const waiting = setKeys.length + ops;
  const inMemory = waiting > 0 && ((qk && memStore.has(qk) && setKeys.length > 0) || (ok && memStore.has(ok) && ops > 0));
  const refused = since ? qFailed().filter(f => f._at >= since).length : 0;
  const state = refused ? 'refused' : inMemory ? 'memory' : inFlight ? 'saving' : waiting ? 'device' : 'synced';
  return { state, sets: setKeys.length, ops, waiting, inFlight, refused };
}
export const clearFailed = () => { const k = qFailedKey(); if (k) lsSet(k, '[]'); };
// ---------- durable writes for ratings and finishing a workout (v1.12.3, outside audit finding 3) ----------
// Each change is kept on the phone (in order) before it is sent, then sent one at a time, oldest first, after any
// waiting sets. Every change is idempotent (an upsert on its natural key, or an update to fixed values), so a retry
// after a dropped connection can never apply it twice. With no signal, a workout can be rated and finished; it all
// syncs by itself when the connection is back. Refused changes are kept aside, never silently dropped.
export const OKEY = 'wl_pending_ops_v1';
export const oKey = () => session?.user?.id ? `${OKEY}:${session.user.id}` : null;
export const oLoad = (k = oKey()) => { try { return k ? JSON.parse(lsGet(k) || '[]') : []; } catch { return []; } };
export const oStore = (k, a) => { if (!k) return true; return lsSet(k, JSON.stringify(a)); };
export const opFailed = new Set();
export function opQuery(op) {
  if (op.kind === 'upsert') return sb.from(op.table).upsert(op.values, { onConflict: op.onConflict });
  let q = sb.from(op.table).update(op.values);
  for (const [c, v] of Object.entries(op.eq || {})) q = q.eq(c, v);
  // v1.20.10 (audit 1.20.8, F01): ask for the updated row back. An UPDATE that matches nothing (the workout was deleted,
  // or isn't this account's) still returns "no error", so without this a queued finish could be counted as saved.
  return q.select('id');
}
// An update that matched no row: a conflict, not a hiccup — retrying can't fix it, so it's kept aside with a reason.
export const missedTarget = (op, data) => op.kind === 'update' && Array.isArray(data) && data.length === 0;
export let opsFlushing = null;
export function flushOps() {
  if (opsFlushing) return opsFlushing;
  opsFlushing = (async () => {
    const k = oKey(), uid = session?.user?.id; if (!k) return 'none';
    for (;;) {
      const op = oLoad(k)[0]; if (!op) return 'done';
      if (session?.user?.id !== uid) return 'queued';
      const { data, error } = await opQuery(op);
      if (session?.user?.id !== uid) return 'queued';
      if (!error && missedTarget(op, data)) {
        oStore(k, oLoad(k).filter(x => x.id !== op.id)); opFailed.add(op.id);
        qAddFailed({ op }, `nothing to update — that ${op.table === 'workout_days' ? 'workout' : op.table === 'mesocycles' ? 'meso' : 'item'} no longer exists or isn’t on this account`);
        toast('A change saved on your phone couldn’t be applied — what it was for no longer exists. It’s kept in Settings → Sync problems.', true);
        continue;
      }
      if (!error) { oStore(k, oLoad(k).filter(x => x.id !== op.id)); continue; }
      if (!isPermanentErr(error)) return 'queued';               // no signal: keep everything, in order
      oStore(k, oLoad(k).filter(x => x.id !== op.id)); opFailed.add(op.id); qAddFailed({ op }, error.message);
      toast(`A change saved on your phone was refused by the server and kept aside: ${error.message}`, true);
    }
  })().finally(() => { opsFlushing = null; syncBadge(); });
  return opsFlushing;
}
export async function syncAll() { await flushQueue(); return flushOps(); }
export let riskWarned = 0;
export function warnAtRisk() {   // at most once a minute
  if (Date.now() - riskWarned < 60000) return; riskWarned = Date.now();
  toast('No signal, and this phone won’t let the app keep an offline copy. Keep the app open until it syncs, or the unsynced changes are lost.', true, 8000);
}
// Returns 'saved' (on the server), 'queued' (kept on the phone, will sync) or 'failed' (refused; kept aside).
export async function durableWrite(op) {
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
export const pendingOps = (table, match) => oLoad().filter(o => o.table === table && match(o));
export function overlayDays(days) {
  for (const d of days) for (const o of pendingOps('workout_days', o => o.eq?.id === d.id)) Object.assign(d, o.values);
  return days;
}
window.addEventListener('online', () => syncAll());
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAll(); });
setInterval(() => { if (Object.keys(qLoad()).length || oLoad().length) syncAll(); }, 20000);

