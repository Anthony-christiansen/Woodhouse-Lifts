// Woodhouse Lifts — home (dashboard), explore, post-workout summary (v1.19.0, audit U5), feedback (v1.15.0), Home drill-downs (#/stats/<kind>/<arg>) (moved out of app.js in 1.20.3, code unchanged).
import * as L from '../logic.js?v=56';
import { ic } from '../icons.js?v=56';
import { esc, fmt, dayName, weekStart, isoDay } from '../format.js?v=56';
import { toast, openSheet, closeSheet } from '../ui.js?v=56';
import { profile } from '../state.js?v=56';
import { sb } from '../net.js?v=56';
import { $, $$, APP_VERSION, STATUS_ORDER, W, activeMeso, app, cardioItems, cardioSince, check, effortText, fatigueFor, fatigueKey, fetchAll, go, lastScreen, lateCard, lateSets, liftInsights, mesoDays, openDays, pendingHere, setHeader, slipFor, startLightWeek, statusPill, wireLate, workoutCardioSince } from '../app.js?v=56';

// ---------- home (dashboard) ----------
export async function renderHome() {
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

// ---------- explore ----------
export function renderExplore() {
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
export function renderSummary() {
  let S = null; try { S = JSON.parse(sessionStorage.getItem('wl_summary') || 'null'); } catch {}
  if (!S) return go('#/');
  setHeader('Workout done', '#/', 'home');
  const done = S.lifts.reduce((a, l) => a + l.done, 0), planned = S.lifts.reduce((a, l) => a + l.planned, 0);
  const fmt = x => x ? (Number(x.w) ? `${+x.w}×${x.r}` : `${x.r} reps`) : '—';
  // v1.20.5: "on plan" when the estimate held because you did what the plan asked (e.g. +1 rep at one rep closer to failure).
  const onPlan = l => l.trend === 0 && !!l.change;
  const arrow = l => l.trend === 1 ? '<span class="trend up" role="img" aria-label="beat the plan">▲</span>'
    : onPlan(l) ? '<span class="trend plan" role="img" aria-label="on plan">●</span>'
    : l.trend === 0 ? '<span class="trend flat" role="img" aria-label="same as last time">▬</span>'
    : l.trend === -1 ? '<span class="trend down" role="img" aria-label="below last time">▼</span>' : '<span class="trend na" role="img" aria-label="no fair comparison yet">·</span>';
  const note = l => l.trend === 1 ? '<div class="sum-note up tiny">Beat the plan</div>' : onPlan(l) ? `<div class="sum-note plan tiny">On plan · ${esc(l.change)}</div>`
    : l.trend === -1 ? '<div class="sum-note down tiny">An off day happens — next week starts from here</div>' : '';
  // A muscle that held steady because its lifts were on plan reads as on plan, not "about the same".
  const perfWord = x => x.perf === 1 ? 'up' : x.perf === -1 ? 'below last time' : x.perf == null ? 'no comparison yet'
    : S.lifts.some(l => l.muscle === x.m && onPlan(l)) ? 'on plan' : 'holding steady';
  const good = S.lifts.filter(l => l.trend === 1 || onPlan(l)).length;
  const waiting = pendingHere() > 0;
  app.innerHTML = `
    <div class="card"><div class="muted small">${esc(S.mesoName)}</div><h3 class="sum-title">${esc(S.title)} ${ic('check', 'accent')}</h3>
      <div class="sum-stats"><div><b>${done}</b><span class="muted tiny">of ${planned} sets</span></div>
        <div><b>${S.lifts.filter(l => l.done).length}</b><span class="muted tiny">exercises</span></div>
        <div><b>${good}</b><span class="muted tiny">on plan or better</span></div></div>
      <div class="small ${waiting ? 'warn-text' : 'muted'}" id="sumSync">${waiting ? `${ic('alert')} Saved on this phone — it syncs when you’re back online. Keep the app open until it does.` : `${ic('check')} Saved and synced.`}</div></div>
    <div class="card"><h3>Your lifts</h3>
      ${S.lifts.map(l => `<div class="sum-row"><div class="grow"><b>${esc(l.name)}</b><div class="muted tiny">${l.done}/${l.planned} sets${l.done < l.planned ? ' · fewer than planned' : ''}</div></div>
        <div class="sum-best small">${l.best ? `${arrow(l)} ${fmt(l.best)}` : ''}<div class="muted tiny">${l.last ? `last time ${fmt(l.last)}` : l.done ? 'first time' : 'not done'}</div>${note(l)}</div></div>`).join('')}
      ${S.cardio.map(c => `<div class="sum-row"><div class="grow"><b>${esc(c.name)}</b></div><div class="small">${c.min} min</div></div>`).join('')}
      <div class="muted tiny mt6">▲ beat the plan · ● on plan (one more rep or a little more weight, as planned) · ▬ same as last time · ▼ below last time. Compared by estimated strength — an estimate, and only when the reps are similar (· = no fair comparison yet).</div></div>
    <div class="card"><h3>What happens next</h3>
      <div class="small">Ratings saved. Performance: ${S.muscles.map(x => `${esc(x.m)} ${perfWord(x)}`).join(' · ') || '—'}.</div>
      <div class="muted tiny mt6">Next time you train these you’ll be asked how they recovered — that sets next week’s sets. One session never changes them on its own.</div>
      ${S.next ? `<button class="primary block mt10" data-go="#/">Next up: ${esc(S.next.title)}</button>` : `<button class="primary block mt10" data-go="#/meso/${esc(S.mesoId)}">Meso finished — see it and run it again</button>`}
      <button class="ghost block mt6" data-go="#/history">See history</button></div>`;
  $$('[data-go]').forEach(b => b.onclick = () => { try { sessionStorage.removeItem('wl_summary'); } catch {} go(b.dataset.go); });
}

// ---------- feedback (v1.15.0) ----------
// A star rating and/or a note, kept private to you; the app owner reads them in the database. Insert-only.
export async function renderFeedback() {
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
export async function renderStats(kind, arg) {
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

