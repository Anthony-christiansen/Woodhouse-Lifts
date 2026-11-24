# v1.17.1 (audit D1–D3, U1) — the early light week in the browser: server preview on the confirm screen, the
# preview's revision is sent, a stale/changed meso is refused without claiming success, a timeout after commit is
# recognised, Cancel/Escape send nothing, Undo, the late-set card, hidden days open read-only, and two separate
# browser contexts (one offline) — device B's queued set still syncs after device A starts the light week.
# NOTE: this runs against the mock Supabase client (UI behaviour only). The database guarantees (nothing deleted,
# atomic, stale/duplicate refused, late sets kept) are proven against real PostgreSQL in test/pg.concurrency.mjs
# and against PGlite in test/db.test.mjs.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8819'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage(init=''):
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            await ctx.add_init_script("window.__DONE_THROUGH = 2;" + init)
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        rpcs="fn => (window.__rpcs||[]).filter(r=>r.fn===fn)"
        toasts="[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')"
        # --- preview sheet content + revision sent
        pg=await newpage("window.__RPC_ERR = null;")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(1000)
        await pg.click('#lightNow'); await pg.wait_for_timeout(600)
        sh=await pg.inner_text('#sheet')
        for label, txt in [('original → new length', '5 → 3 weeks'), ('light week sessions', '4 workouts'), ('hidden, not deleted', 'hidden (not deleted'),
                           ('earlier weeks summary', '7 done, 1 skipped'), ('other devices warning', 'Other phones or tabs'), ('own-queue limit stated', 'can only check its own unsynced changes')]:
            ok('preview shows ' + label, txt in sh, sh[:400])
        ok('preview from the server, before anything changes', len(await pg.evaluate(rpcs, 'light_week_preview'))==1 and not await pg.evaluate(rpcs, 'start_light_week'))
        if SHOTS: await pg.locator('#sheet .panel').screenshot(path=os.path.join(SHOTS,'light-preview.png'))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok('Escape sends nothing', not await pg.evaluate(rpcs, 'start_light_week'))
        await pg.click('#lightNow'); await pg.wait_for_timeout(500); await pg.click('#lwGo'); await pg.wait_for_timeout(600)
        st=await pg.evaluate(rpcs, 'start_light_week')
        ok('sends the preview revision', len(st)==1 and st[0]['args']=={'p_meso':'m1','p_revision':0}, st)
        await pg.context.close()
        # --- unfinished earlier workouts → "ends the meso early" warning
        pg=await newpage("window.__PREVIEW_SEQ = [{ revision: 0, weeks: 5, light_week: 3, status: 'active', ok: true, done: 5, skipped: 0, started_unfinished: 1, not_done: 2, light_sessions: 4, removed_sessions: 8 }];")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#lightNow'); await pg.wait_for_timeout(500)
        sh=await pg.inner_text('#sheet')
        ok('unfinished earlier workouts: says it ends the meso early', '3 earlier workouts aren’t finished' in sh and 'ends the meso early' in sh and '2 not done' in sh, sh[:500])
        await pg.context.close()
        # --- changed elsewhere (stale revision) → refused, no success claimed
        pg=await newpage("window.__RPC_ERR = { start_light_week: { code: '40001', message: 'This meso changed since the preview (another device or tab?) — nothing was changed' } };")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#lightNow'); await pg.wait_for_timeout(500); await pg.click('#lwGo'); await pg.wait_for_timeout(500)
        t=await pg.evaluate(toasts)
        ok('stale: says it changed elsewhere, nothing changed', 'changed on another device or tab' in t and 'is now your light week' not in t, t)
        await pg.context.close()
        # --- signal lost after the server committed → re-checks with the server and says it went through
        pg=await newpage("window.__RPC_ERR = { start_light_week: { message: 'TypeError: Failed to fetch' } }; window.__PREVIEW_SEQ = [{ revision: 0, weeks: 5, light_week: 3, status: 'active', ok: true, done: 5, skipped: 0, started_unfinished: 0, not_done: 0, light_sessions: 4, removed_sessions: 8 }, { revision: 1, weeks: 5, light_week: 3, status: 'active', ok: true, done: 5, skipped: 0, started_unfinished: 1, not_done: 2, light_sessions: 4, removed_sessions: 8 }];")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#lightNow'); await pg.wait_for_timeout(500); await pg.click('#lwGo'); await pg.wait_for_timeout(600)
        t=await pg.evaluate(toasts)
        ok('timeout after commit: re-checks and says it went through', 'went through' in t and len(await pg.evaluate(rpcs, 'light_week_preview'))==2, t)
        await pg.context.close()
        pg=await newpage("window.__RPC_ERR = { start_light_week: { message: 'TypeError: Failed to fetch' } }; window.__PREVIEW_SEQ = [{ revision: 0, weeks: 5, light_week: 3, status: 'active', ok: true, done: 5, skipped: 0, started_unfinished: 1, not_done: 2, light_sessions: 4, removed_sessions: 8 }, { revision: 0, weeks: 5, light_week: 3, status: 'active', ok: true, done: 5, skipped: 0, started_unfinished: 1, not_done: 2, light_sessions: 4, removed_sessions: 8 }];")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#lightNow'); await pg.wait_for_timeout(500); await pg.click('#lwGo'); await pg.wait_for_timeout(600)
        t=await pg.evaluate(toasts)
        ok('timeout before commit: says nothing changed yet, sheet stays to retry', 'nothing changed yet' in t and not await pg.evaluate("document.getElementById('sheet').hidden"), t)
        await pg.context.close()
        # --- not available yet (migration not applied) → clear message
        pg=await newpage("window.__RPC_ERR = { light_week_preview: { message: 'Could not find the function public.light_week_preview' } };")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#lightNow'); await pg.wait_for_timeout(500)
        ok('missing function: asks for the update, sends nothing', 'small database update' in await pg.evaluate(toasts) and not await pg.evaluate(rpcs, 'start_light_week'))
        await pg.context.close()
        # --- after an early light week: Undo, hidden days, late-set card
        undo="window.__SUP_AFTER = 3; window.__MESO_PATCH = { weeks: 3, revision: 1, light_week_undo: { weeks: 5, week: 3, targets: [] } };"
        pg=await newpage(undo)
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(900)
        ok('hidden weeks are not listed', 'Week 4' not in await pg.inner_text('main') and 'Week 5' not in await pg.inner_text('main'))
        ok('Undo offered', await pg.locator('#lightUndo').count()==1 and 'back to 5 weeks' in await pg.inner_text('#lightUndo'))
        pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('#lightUndo'); await pg.wait_for_timeout(500)
        u=await pg.evaluate(rpcs, 'undo_light_week')
        ok('Undo sends the meso revision', len(u)==1 and u[0]['args']=={'p_meso':'m1','p_revision':1}, u)
        await pg.goto(B+'#/workout/d41'); await pg.wait_for_timeout(900)
        ok('a hidden day opens read-only with an explanation', 'replaced by the light week' in await pg.evaluate(toasts) and await pg.locator('#addEx').count()==0)
        await pg.context.close()
        pg=await newpage(undo + "window.__LATE_ROWS = [{ id: 'd41', workout_exercises: [{ sets: [{ id: 'x1' }, { id: 'x2' }] }] }];")
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1100)
        card=pg.locator('#lateCard')
        ok('late sets: card says they are kept and offers both choices', await card.count()==1 and '2 sets were logged' in await card.inner_text() and await pg.locator('#lateRestore').count()==1 and await pg.locator('#lateKeep').count()==1)
        if SHOTS: await card.screenshot(path=os.path.join(SHOTS,'late-card.png'))
        await pg.click('#lateKeep'); await pg.wait_for_timeout(200)
        await pg.goto(B+'#/mesos'); await pg.goto(B+'#/'); await pg.wait_for_timeout(900)
        ok('Keep: card stays dismissed for this revision', await pg.locator('#lateCard').count()==0)
        await pg.context.close()
        # --- two isolated devices: B offline queues a set on a later-week workout; A starts the light week; B reconnects
        a=await newpage(); b=await newpage()
        await b.goto(B+'#/workout/d21'); await b.wait_for_timeout(1000)
        await b.evaluate("document.getElementById('sheet').hidden=true; window.__FAIL_NET = true")
        wt=b.locator('.set').nth(1).locator('[data-f="weight"]'); await wt.fill('73'); await wt.dispatch_event('change'); await b.wait_for_timeout(500)
        queued=await b.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('wl_pending_sets')).map(k=>Object.keys(JSON.parse(localStorage[k])).length).reduce((x,y)=>x+y,0)")
        ok('device B: set queued offline', queued>=1, queued)
        await a.goto(B+'#/meso/m1'); await a.wait_for_timeout(900)
        await a.click('#lightNow'); await a.wait_for_timeout(500); await a.click('#lwGo'); await a.wait_for_timeout(500)
        ok('device A: light week requested', len(await a.evaluate(rpcs, 'start_light_week'))==1)
        ok('device A: its own queue is separate (B’s set is not visible to A)', await a.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('wl_pending_sets')).length")==0)
        await b.evaluate("window.__FAIL_NET = false")
        if await b.locator('#syncBadge').count(): await b.click('#syncBadge')
        await b.evaluate("window.dispatchEvent(new Event('online'))"); await b.wait_for_timeout(1500)
        landed=await b.evaluate("(window.__landed||[]).filter(x=>x[0]==='sets').map(x=>x[1].weight)")
        failed=await b.evaluate("Object.keys(localStorage).filter(k=>k.includes('failed')).map(k=>localStorage[k]).join('')")
        ok('device B: queued set syncs after reconnect (not dropped, not failed)', 73 in landed and '73' not in failed, [landed, failed])
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.17.1 LIGHT-WEEK INTEGRITY UI TESTS (mock server)', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
