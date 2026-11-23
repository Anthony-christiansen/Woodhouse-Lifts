import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8778','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read()
B='http://localhost:8778/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':360,'height':900},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B); await pg.wait_for_timeout(900)
        await pg.screenshot(path=HERE+'/shots/home_drill.png', full_page=True)
        gos=await pg.evaluate("[...document.querySelectorAll('main [data-go]')].map(b=>b.dataset.go)")
        ok('home has drill targets', all(any(g.startswith(x) for g in gos) for x in ['#/stats/workouts','#/stats/sets/','#/stats/cardio/','#/stats/prs','#/stats/totals','#/mesos','#/meso/']), gos)
        bars=await pg.evaluate("document.querySelectorAll('g.bar-hit').length"); ok('16 tappable bars', bars==16, bars)
        async def visit(sel, expect, name):
            await pg.goto(B); await pg.wait_for_timeout(700)
            await pg.locator(sel).first.click(); await pg.wait_for_timeout(700)
            t=await pg.inner_text('main'); ok(name, expect in t, (pg.url, t[:160]))
            await pg.screenshot(path=HERE+f'/shots/drill_{name.split()[0]}.png', full_page=True)
        await visit('[data-go^="#/stats/workouts"]', 'workouts finished in week', 'workouts drill')
        await visit('[data-go^="#/stats/sets/"]', 'hard sets', 'sets drill')
        await visit('[data-go^="#/stats/cardio/"]', 'Minutes', 'cardio drill')
        await visit('[data-go="#/stats/prs"]', 'PRs this meso', 'prs drill')
        await visit('[data-go="#/stats/totals"]', 'By mesocycle', 'totals drill')
        await visit('g.bar-hit >> nth=2', 'Week of', 'bar drill')
        # week nav
        await pg.click('text=‹ Prev week'); await pg.wait_for_timeout(500); ok('week nav works', '#/stats/' in pg.url, pg.url)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:220] for x in r])
    print('DRILL TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
