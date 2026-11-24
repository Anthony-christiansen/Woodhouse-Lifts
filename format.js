// Woodhouse Lifts — small formatting helpers (moved out of app.js in 1.20.1, unchanged). Pure: no state, no I/O.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtNum = n => (Math.round(n * 100) / 100).toString();
export const fmt = n => (n == null ? '–' : Number(n) % 1 ? Number(n).toFixed(1) : String(Number(n)));
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const dayName = d => d.label || 'Day ' + d.day_index;
export const order = d => d.week * 100 + d.day_index;
export function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export const isoDay = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
