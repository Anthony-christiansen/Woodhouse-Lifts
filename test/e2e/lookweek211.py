# v1.21.1 (owner request) — with a workout in progress, opening another day of the week opens it to LOOK at, no switch
# needed. Logging stays with the workout in progress; if nothing is logged there yet, you can start this day instead.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8829'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
# d21 (week 2, day 1) is in progress — until something clears its started_at
LIVE="""() => { window.__FB = []; window.__DAYS_PATCH = d => d.id === 'd21' && !(window.__writes || []).some(w => w[0] === 'workout_days' && w[1].started_at === null)
  ? { ...d, started_at: '2026-11-25T18:00:00Z' } : d; }"""
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage(live_sets):
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); await pg.add_init_script(f"({LIVE})(); window.__LIVE_SETS = {live_sets};")
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        # 1) day 1 has sets logged → day 2 opens straight away to look at; logging is off; back button
        pg=await newpage(3); await pg.goto(B+'#/workout/d22'); await pg.wait_for_timeout(1300)
        t=await pg.inner_text('main')
        ok('opens day 2 directly (no "Workout in progress" gate)', 'Workout in progress' not in t and await pg.locator('.card[data-we]').count()>0, t[:150])
        ok('banner says just looking, and why', 'Just looking' in t and 'new sets go there' in t, t[:200])
        ok('exercises and sets are visible', await pg.locator('.card[data-we] .set').count()>0)
        ok('logging is off on day 2', await pg.locator('.card[data-we] input:not([disabled])').count()==0 and not await pg.locator('#finish').is_visible())
        ok('no "start instead" while day 1 has sets', await pg.locator('#startInstead').count()==0)
        started=await pg.evaluate("(window.__writes||[]).filter(w => w[0]==='workout_days').map(w => w[1])")
        ok('looking does not start or switch anything', not any('started_at' in (x or {}) for x in started), started)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'look-logged.png'))
        await pg.click('#lookBanner [data-go="#/workout/d21"]'); await pg.wait_for_timeout(1200)
        ok('"Back to" returns to the workout in progress, ready to log', pg.url.endswith('#/workout/d21') and await pg.locator('.card[data-we] input:not([disabled])').count()>0, pg.url)
        await pg.context.close()
        # 2) day 1 has nothing logged → day 2 opens to look at, with "Start day 2 instead" (your choice)
        pg=await newpage(0); await pg.goto(B+'#/workout/d22'); await pg.wait_for_timeout(1300)
        t=await pg.inner_text('main')
        ok('nothing logged: still opens to look (no forced switch)', 'Just looking' in t and 'nothing is logged there yet' in t, t[:200])
        ok('offers Start this day instead', await pg.locator('#startInstead').count()==1)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'look-empty.png'))
        await pg.click('#startInstead'); await pg.wait_for_timeout(1500)
        w=await pg.evaluate("(window.__writes||[]).filter(w => w[0]==='workout_days').map(w => w[1])")
        ok('start instead: day 1 un-started, day 2 open for logging', any(x.get('started_at') is None and 'started_at' in x for x in w) and await pg.locator('.card[data-we] input:not([disabled])').count()>0, w)
        await pg.context.close()
        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[x for x in R if x[0]=='FAIL']
    for x in R: print(*x)
    print(f'LOOKWEEK211 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
