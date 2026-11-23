# v1.11.5 — builder at 3 days: 60 min Balanced moves small Grow muscles to Maintain (with a plain note) so big muscles
# keep growing; 90 min needs no change; raising the time restores the moved muscles; 45 min says plainly what can't grow.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, re
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8797','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8797/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
PAGES=[]
async def build(ctx, errs, minutes):
    pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); PAGES.append(pg)
    await pg.goto(B+'#/new'); await pg.wait_for_timeout(900)
    await pg.click('[data-goal="hypertrophy"]'); await pg.wait_for_timeout(100)
    await pg.click('[data-days="3"]'); await pg.wait_for_timeout(150)
    await pg.click(f'[data-min="{minutes}"]'); await pg.wait_for_timeout(100)
    await pg.fill('#name','T'); await pg.click('#next'); await pg.wait_for_timeout(600)
    return pg, await pg.inner_text('main')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':900},is_mobile=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        pg,t=await build(ctx, errs, 90)
        ok('90 min: nothing moved to Maintain', 'set to Maintain' not in t and 'Not enough time to grow' not in t, t[:400])
        pg,t=await build(ctx, errs, 60)
        ok('60 min: no "not enough time" for the usual 3-day setup', 'Not enough time to grow' not in t, t[:600])
        n60=t.count('set to Maintain')
        chips=await pg.evaluate("[...document.querySelectorAll('.chip')].map(c=>c.innerText)")
        big=[c for c in chips if re.match(r'(Chest|Back|Quads|Hamstrings|Glutes) ',c)]
        ok('60 min: big muscles keep 6+ weekly sets', big and all(int(re.search(r' (\d+)/',c).group(1))>=6 for c in big), chips)
        ok('60 min: no Maintain muscle at 0', not any(re.search(r' 0/\d',c) for c in chips), chips)
        await pg.click('#fillAll'); await pg.wait_for_timeout(400)   # rebuilding again doesn't stack more moves
        t2=await pg.inner_text('main'); ok('rebuild is stable', t2.count('set to Maintain')==n60, t2[:300])
        pg,t=await build(ctx, errs, 45)
        ok('45 min: says plainly what cannot grow', 'Not enough time to grow' in t or 'set to Maintain' in t, t[:600])
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('BUILDER 1.11.5 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
