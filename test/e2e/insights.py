import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8773','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8773/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':360,'height':900},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(800)
        t=await pg.inner_text('main')
        ok('home: meso lifts card', 'This meso’s lifts' in t)
        rows=await pg.evaluate("[...document.querySelectorAll('.lift-row')].map(b=>b.innerText.replace(/\\n/g,' '))")
        # v1.20.6: wins first; the two lifts to watch are still listed (last), with forward-looking labels
        ok('home: lifts to watch listed after the wins', rows and any('Recover first' in r for r in rows[-3:]) and any('Ready for +1 rep' in r for r in rows[-3:]) and not rows[0].startswith('Incline Dumbbell Press'), rows)
        ok('home: no Down / Dipped / Flat wording', not any(w in ' '.join(rows) for w in ['Down ', 'Dipped', 'Flat 2 wks']), rows)
        ok('home: attention note, encouraging', 'ready for a little attention' in t and 'need attention' not in t)
        await pg.screenshot(path=HERE+'/shots/home_lifts.png', full_page=True)
        await pg.locator('.lift-row', has_text='Hack Squat').first.click(); await pg.wait_for_timeout(600)
        ok('tap → chart page', '#/progress/e5' in pg.url, pg.url)
        t=await pg.inner_text('main'); ok('chart: status + rec', 'Where this lift stands' in t, t[:120])
        await pg.screenshot(path=HERE+'/shots/progress_detail.png', full_page=True)
        await pg.click('[data-go^="#/progress/e5/all"]'); await pg.wait_for_timeout(400)
        ok('chart: range switch', '#/progress/e5/all' in pg.url)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(800)
        f=await pg.evaluate("[...document.querySelectorAll('.lift-flag')].map(b=>b.innerText.replace(/\\n/g,' '))")
        ok('workout: one coach note on stalled + down lifts', len(f)==2 and any('Same as the last 2 weeks' in x for x in f) and any('under 2 weeks ago' in x for x in f), f)
        await pg.click('[data-flag="w3"]'); await pg.wait_for_timeout(200)
        st=await pg.inner_text('#sheet'); ok('flag → recommendation sheet', '+1 rep' in st, st[:200])
        await pg.screenshot(path=HERE+'/shots/workout_flag.png')
        await pg.click('#toChart'); await pg.wait_for_timeout(400); ok('sheet → chart', '#/progress/e5' in pg.url)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*r)
    print('INSIGHT TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
