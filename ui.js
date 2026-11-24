// Woodhouse Lifts — toast, label linking and the modal sheet (moved out of app.js in 1.20.1, unchanged).
const app = document.getElementById('app');
const sheet = document.getElementById('sheet');
// One toast at a time: a new message replaces the one showing (stacked toasts sat exactly on top of each other,
// so a second notice could be hidden or vanish early with the first one's timer).
export function toast(msg, err = false, ms = null) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), ms ?? (err ? 4500 : 1800));
}
// v1.13.1 (accessibility): a <label> written just before its field is linked to it (for/id), on every screen and sheet,
// so screen readers announce each field's name and tapping the label focuses the field.
let labelSeq = 0;
export function linkLabels(root) {
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
export function openSheet(html, wire, locked = false) {
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
export function closeSheet() {
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
