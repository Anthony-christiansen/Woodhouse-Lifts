# v1.19.0 (audit U5) — after Finish: a summary of what you did vs the plan, best sets vs last time (as an estimate,
# like-with-like only), ratings acknowledged, honest sync status, and one next step.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8820'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def finish(pg):
    third=pg.locator('.card[data-we]').first.locator('.set').nth(2)
    await third.locator('[data-f="reps"]').fill('10'); await third.locator('.check').click(); await pg.wait_for_timeout(500)
    for _ in range(4):
        if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
    for _ in range(4):
        await pg.click('#finish'); await pg.wait_for_timeout(900)
        if '#/summary' in pg.url: return
        if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        pg=await newpage()
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await finish(pg)
        ok('Finish opens the summary', '#/summary' in pg.url, pg.url)
        t=await pg.inner_text('main')
        ok('sets done vs planned', 'of 13 sets' in t or 'of ' in t and 'sets' in t, t[:200])
        ok('lists each lift with last time', 'Incline Dumbbell Press' in t and 'last time' in t)
        ok('best set shown', '70×11' in t or '70×10' in t, t[:400])
        ok('says the comparison is an estimate', 'an estimate' in t)
        ok('ratings acknowledged + what happens next', 'Ratings saved' in t and 'One session never changes them' in t)
        ok('one next step', await pg.locator('button.primary', has_text='Next up').count()==1)
        ok('sync status: saved and synced', 'Saved and synced' in t)
        ok('trend marks have text for screen readers', await pg.locator('.trend[aria-label]').count() >= 1)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'summary.png'), full_page=True)
        await pg.click('button.primary'); await pg.wait_for_timeout(600)
        ok('next step goes home and clears the summary', pg.url.endswith('#/') and await pg.evaluate("sessionStorage.getItem('wl_summary')") is None)
        await pg.goto(B+'#/summary'); await pg.wait_for_timeout(500)
        ok('opening the summary again without data goes home', pg.url.endswith('#/'))
        await pg.context.close()
        # offline finish → summary says it's on the phone, not synced
        pg=await newpage()
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await pg.evaluate("window.__FAIL_NET = true; sessionStorage.setItem('failnet', '1')")
        await finish(pg)
        await pg.wait_for_timeout(1500)   # 1.20.8: the line updates itself once the retry on opening the page settles
        t=await pg.inner_text('main') if '#/summary' in pg.url else ''
        ok('offline: summary is honest about sync', 'Saved on this phone' in t and 'Saved and synced' not in t, t[:300])
        # --- Home: sets card follows the meso week (lines up with workouts); no redraw on token refresh / refocus
        pg=await newpage()
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1200)
        t=await pg.inner_text('main')
        ok('Home: both cards name the same training week', 'Workouts · week 2' in t and 'Sets · week 2' in t, t[:400])
        ok('Home: sets card is done/planned for that week', await pg.locator('button.stat', has_text='Sets · week 2').locator('.big').inner_text() in ('2/12','3/12','2/13'), await pg.locator('button.stat', has_text='Sets · week 2').inner_text())
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('sheet').hidden=true; window.scrollTo(0, 400); document.querySelector('[data-f=\"reps\"]').setAttribute('data-mark','x')")
        for evt in ['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_IN']: await pg.evaluate(f"window.__authEmit('{evt}')"); await pg.wait_for_timeout(300)
        ok('same user signed in again: the screen is not redrawn', await pg.locator('[data-mark="x"]').count()==1)
        await pg.evaluate("window.__authEmit('SIGNED_IN', 'u2')"); await pg.wait_for_timeout(600)
        ok('a different user: the app redraws', await pg.locator('[data-mark="x"]').count()==0)
        await pg.context.close()
        # --- U3: first run + experience
        pg=await newpage(); await pg.evaluate("1")
        await pg.add_init_script("window.__MESOS = [];")
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1100)
        w=pg.locator('#welcome')
        ok('first run: a welcome card with three steps and one button', await w.count()==1 and await w.locator('li').count()==3 and await w.locator('button', has_text='Build my first plan').count()==1)
        if SHOTS: await w.screenshot(path=os.path.join(SHOTS,'welcome.png'))
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(900)
        ok('experience question with full names for screen readers', await pg.locator('[data-exp]').count()==3 and await pg.get_attribute('[data-exp="new"]','aria-label')=='New to lifting')
        ok('effort is tucked under Advanced (closed) until needed', await pg.evaluate("!document.getElementById('advEffort').open"))
        await pg.click('[data-exp="new"]'); await pg.wait_for_timeout(200)
        sm=await pg.text_content('#advEffort summary'); ok('New → starts Conservative', 'now Conservative' in sm, sm)
        await pg.click('[data-exp="experienced"]'); await pg.wait_for_timeout(200)
        ok('Experienced → Standard, Advanced shown open', 'now Standard' in await pg.text_content('#advEffort summary') and await pg.evaluate("document.getElementById('advEffort').open"))
        await pg.click('[data-effort="main1"]'); await pg.click('[data-exp="new"]'); await pg.wait_for_timeout(200)
        ok('an effort you picked yourself wins over experience', 'now Main lifts ≥1' in await pg.text_content('#advEffort summary'))
        ok('equipment shown with a link to change it', 'Equipment:' in await pg.inner_text('main') and await pg.locator('a[href="#/settings"]').count()>=1)
        if SHOTS:
            await pg.evaluate("localStorage.removeItem('wl_effort_mode')"); await pg.goto(B+'#/'); await pg.goto(B+'#/new'); await pg.wait_for_timeout(800)
            await pg.locator('.card').nth(0).screenshot(path=os.path.join(SHOTS,'experience.png'))
        await pg.context.close()
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.19.0 SUMMARY TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
