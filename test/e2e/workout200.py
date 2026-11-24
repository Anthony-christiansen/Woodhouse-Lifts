# v1.20.0 (audit U4) — less scrolling while logging: finished exercises fold to one line (ratings stay visible,
# "Show sets" reopens), and a "Next set" bar logs the next set through that set's own ✓ (same save path).
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8821'))
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
            await ctx.add_init_script("localStorage.setItem('wl_warmup_seen','1');" + init)
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        pg=await newpage()
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        bar=pg.locator('#nextBar')
        ok('Next set bar shows the first unfinished set', await bar.is_visible() and 'Incline Dumbbell Press' in await bar.inner_text() and 'set 3' in await bar.inner_text(), await bar.inner_text())
        ok('bar names its region for screen readers', await bar.get_attribute('aria-label')=='Next set')
        ok('page leaves room for the bar (Finish never hidden)', await pg.evaluate("document.body.classList.contains('has-next')"))
        ok('unfinished exercise is not folded', not await pg.evaluate("document.querySelector('[data-we=\"w1\"]').classList.contains('folded')"))
        await pg.click('#nbGo'); await pg.wait_for_timeout(500)
        ok('Go to focuses that set', await pg.evaluate("document.activeElement?.closest('.set')?.dataset.key")=='w1:3')
        await pg.click('#nbLog'); await pg.wait_for_timeout(900)
        sets=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='sets').map(x=>x[1])")
        ok('✓ Log saves through the set’s own ✓ (same save path)', any(s.get('set_index')==3 for s in sets), sets[-2:])
        for _ in range(3):
            if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1000)
        w1=pg.locator('[data-we="w1"]')
        ok('just finished: stays open so you can still fix a set', not await pg.evaluate("document.querySelector('[data-we=\"w1\"]').classList.contains('folded')"))
        ok('bar moves on to the next exercise', 'Pull-Up' in await bar.inner_text() and 'set 1' in await bar.inner_text(), await bar.inner_text())
        p1=pg.locator('[data-we="w2"] .set').nth(0)
        await p1.locator('[data-f="reps"]').fill('10'); await p1.locator('.check').click(); await pg.wait_for_timeout(800)
        for _ in range(3):
            if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
        ok('finished exercise folds to one line once you move on', await pg.evaluate("document.querySelector('[data-we=\"w1\"]').classList.contains('folded')"))
        fl=await w1.locator('.fold-line').inner_text()
        ok('fold line: sets done and best set', '3/3 sets' in fl and 'best 70×11' in fl, fl)
        ok('folded: set rows hidden, ratings still shown', not await w1.locator('.sets').is_visible() and await w1.locator('[data-rate]').is_visible())
        ok('folded line says it can be opened', await w1.locator('.fold-line').get_attribute('aria-expanded')=='false')
        ok('bar follows along (Pull-Up set 2)', 'Pull-Up' in await bar.inner_text() and 'set 2' in await bar.inner_text(), await bar.inner_text())
        if SHOTS: await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(200); await pg.screenshot(path=os.path.join(SHOTS,'workout-after.png'))
        await w1.locator('.fold-line').click(); await pg.wait_for_timeout(200)
        ok('Show sets reopens it', await w1.locator('.sets').is_visible() and await w1.locator('.fold-line').get_attribute('aria-expanded')=='true')
        p2=pg.locator('[data-we="w2"] .set').nth(1)
        await p2.locator('[data-f="reps"]').fill('10'); await p2.locator('.check').click(); await pg.wait_for_timeout(800)
        ok('a card you opened stays open while you log elsewhere', await w1.locator('.sets').is_visible())
        await pg.goto(B+'#/'); await pg.wait_for_timeout(700)
        ok('leaving the workout removes the bar and its spacing', await pg.locator('#nextBar').count()==0 and not await pg.evaluate("document.body.classList.contains('has-next')"))
        await pg.context.close()
        # read-only views never show the bar
        pg=await newpage()
        await pg.goto(B+'#/workout/d31'); await pg.wait_for_timeout(1000)
        ok('preview (not started): no Next set bar', await pg.locator('#nextBar').count()==0)
        await pg.goto(B+'#/workout/d11'); await pg.wait_for_timeout(1000)
        ok('finished day: no Next set bar', await pg.locator('#nextBar').count()==0)
        await pg.context.close()
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.20.0 WORKOUT SCREEN TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
