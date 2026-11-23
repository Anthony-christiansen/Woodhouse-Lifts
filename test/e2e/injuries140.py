# v1.14.0 — Settings → Injuries & sore spots (7 areas, saved on tap), the old spinal-loading choice carried over as
# Lower back, switches and checkboxes visibly show on/off, and the builder says which areas it's going easy on.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8814'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(1000)
        ok('11 areas offered', await pg.locator('[data-area]').count()==11)
        ok('old spinal switch replaced', await pg.locator('#avoidAxial').count()==0)
        await pg.click('[data-area="lower_back"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('Lower back saves as the old axial tag', w and w.get('avoid_tags')==['axial'], w)
        ok('Lower back shows on', await pg.get_attribute('[data-area="lower_back"]','aria-pressed')=='true')
        n=await pg.inner_text('[data-area="lower_back"]')
        ok('says how many it leaves out', 'Leaving out' in n, n)
        await pg.click('[data-area="knees"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('Knees adds to the list', w and sorted(w.get('avoid_tags'))==['area:knees','axial'], w)
        if SHOTS: await pg.locator('#areasCard').screenshot(path=os.path.join(SHOTS,'injuries-card.png'))
        await pg.click('[data-area="knees"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('tap again turns it off', w and w.get('avoid_tags')==['axial'], w)
        # equipment checkboxes visibly change
        cb=pg.locator('input[name=eq]').first
        a=await cb.evaluate("e => getComputedStyle(e.closest('.chip')).backgroundColor"); await cb.click(); await pg.wait_for_timeout(100)
        b=await cb.evaluate("e => getComputedStyle(e.closest('.chip')).backgroundColor")
        ok('equipment chip shows on/off', a!=b and (await cb.evaluate("e => getComputedStyle(e).appearance"))!='none', (a,b))
        # builder: asks about injuries (open, since Lower back is on), switch shows on/off, and the areas note
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(1000)
        ok('builder asks about injuries, Yes when some are saved', await pg.get_attribute('[data-inj="yes"]','aria-checked')=='true' and await pg.locator('#injCard [data-area="lower_back"][aria-pressed="true"]').count()==1)
        await pg.click('#injCard [data-area="knees"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('picking in the builder saves the same setting', w and sorted(w.get('avoid_tags'))==['area:knees','axial'], w)
        if SHOTS: await pg.locator('#injCard').screenshot(path=os.path.join(SHOTS,'builder-injuries.png'))
        pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('[data-inj="no"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('No (after confirming) clears them', w and w.get('avoid_tags')==[] and await pg.locator('#injCard [data-area]').count()==0, w)
        await pg.click('[data-inj="yes"]'); await pg.wait_for_timeout(200); await pg.click('#injCard [data-area="lower_back"]'); await pg.wait_for_timeout(500)
        sw=pg.locator('#minRir')
        a=await sw.evaluate("e => getComputedStyle(e).backgroundColor"); await sw.click(); await pg.wait_for_timeout(200)
        b=await sw.evaluate("e => getComputedStyle(e).backgroundColor")
        ok('builder switch visibly turns on', a!=b and await sw.is_checked() and await sw.get_attribute('role')=='switch', (a,b))
        if SHOTS: await pg.locator('label.switch:has(#minRir)').screenshot(path=os.path.join(SHOTS,'switch-on.png'))
        await pg.click('#next'); await pg.wait_for_timeout(700)
        t=await pg.inner_text('main')
        ok('builder notes the protected area', 'Going easy on Lower back' in t, t[:300])
        await pg.goto(B+'#/exercises'); await pg.wait_for_timeout(900)
        ok('library marks exercises that load a protected area', await pg.locator('.exrow .pill.warn:has-text("Lower back")').count()>=1)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('INJURIES 1.14.0 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
