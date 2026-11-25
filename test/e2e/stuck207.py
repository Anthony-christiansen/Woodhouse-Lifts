# v1.20.7 — owner report: "the feedback pop-up got stuck, I had to exit and reopen the app".
# Cause: a set save that landed after you left the workout ran the "rate finished muscles" check against a screen
# with no sets on it — every unrated muscle looked finished — and opened locked rating pop-ups on Home, one after another.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8824'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); await pg.add_init_script('window.__FB = []')   # nothing rated yet today
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        async def finish_last_set(pg, slow=False):
            row=pg.locator('.card[data-we="w1"] .set').nth(2)
            await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill('10'); await row.locator('[data-f="reps"]').dispatch_event('change')
            await pg.wait_for_timeout(800)
            if slow: await pg.evaluate("window.__DELAY = (t) => t === 'sets' ? 2500 : 0")
            await row.locator('.check').click()
        sheet_open = lambda pg: pg.locator('#sheet:not([hidden])').count()

        # 1) the report: the last set's save lands after you've gone to Home → no pop-up there
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await finish_last_set(pg, slow=True); await pg.wait_for_timeout(150)
        await pg.evaluate("location.hash = '#/'"); await pg.wait_for_timeout(3500)
        ok('save lands after leaving: no rating pop-up on Home', await sheet_open(pg)==0)
        ok('…and Home is usable (tabs reachable)', await pg.locator('nav a[data-tab="mesos"]').is_visible())
        await pg.context.close()

        # 2) on the workout: the pop-up still opens when an exercise is finished, and now has "Not now"
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await finish_last_set(pg); await pg.wait_for_timeout(900)
        ok('finishing an exercise still asks for its rating', await sheet_open(pg)==1)
        has_out = await pg.locator('#sheet #later').count() == 1
        ok('the rating pop-up has a way out ("Not now")', has_out and await pg.locator('#sheet #later').inner_text()=='Not now')
        if not has_out: await pg.keyboard.press('Escape')
        else: await pg.click('#sheet #later')
        await pg.wait_for_timeout(400)
        ok('"Not now" closes it', await sheet_open(pg)==0)
        # logging another set doesn't nag with the same pop-up
        row=pg.locator('.card[data-we="w2"] .set').nth(0)
        await row.locator('[data-f="weight"]').fill('100'); await row.locator('[data-f="reps"]').fill('8'); await row.locator('.check').click()
        await pg.wait_for_timeout(900)
        txt=await pg.inner_text('#sheet') if await sheet_open(pg) else ''
        ok('after "Not now", the next set doesn\'t reopen the same pop-up', 'Incline Dumbbell Press' not in txt, txt[:80])
        if await sheet_open(pg) and await pg.locator('#sheet #later').count(): await pg.click('#sheet #later'); await pg.wait_for_timeout(300)
        # Finish still asks for anything left unrated
        await pg.click('#finish'); await pg.wait_for_timeout(900)
        txt=await pg.inner_text('#sheet') if await sheet_open(pg) else ''
        ok('Finish still asks for the skipped rating', await sheet_open(pg)==1 and 'Incline Dumbbell Press' in txt, txt[:80])
        ok('workout not finished while a rating is missing', '#/summary' not in pg.url)
        await pg.context.close()

        # 3) v1.20.11 hotfix: opened from the Workout tab ("#/workout", no id), the rating pop-up still opens
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); await pg.add_init_script('window.__FB = []'); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/workout'); await pg.wait_for_timeout(1300)
        await finish_last_set(pg); await pg.wait_for_timeout(900)
        ok('opened from the Workout tab: finishing an exercise asks for its rating', await sheet_open(pg)==1, pg.url)
        # and a muscle's rating after its last exercise, from the tab too
        if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(500)
        ok('from the tab: the rating saves and the pop-up closes', await sheet_open(pg)==0)
        await ctx.close()

        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'STUCK207 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
