import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8777','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read().replace("completed_at: w === 1 ? '2026-11-10T18:00:00Z' : null","completed_at: w <= 3 ? '2026-11-10T18:00:00Z' : null")
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':360,'height':900})
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8777/#/meso/m1'); await pg.wait_for_timeout(800)
        await pg.click('#again'); await pg.wait_for_timeout(400)
        st=await pg.inner_text('#sheet'); ok('week picker shown', 'Start the new meso from which week' in st and 'last before deload' in st and '2 weeks back' in st, st[:300])
        dis=await pg.evaluate("[...document.querySelectorAll('#sheet [data-week]')].map(b=>b.dataset.week+':'+b.disabled)"); ok('choices = last working week and 2 back; unlogged disabled', dis==['4:true','3:false','2:false','0:false'], dis)
        await pg.screenshot(path=HERE+'/shots/again_sheet.png')
        await pg.click('#sheet [data-week="2"]'); await pg.wait_for_timeout(500)
        t=await pg.inner_text('main'); ok('builder shows carry', 'start from' in t and 'week 2' in t, t[:200])
        await pg.click('#fillAll'); await pg.wait_for_timeout(300); await pg.click('#create'); await pg.wait_for_timeout(600)
        rpc=await pg.evaluate("JSON.stringify(window.__creates||null)")
        print('URL',pg.url, await pg.evaluate("[...document.querySelectorAll('.toast')].map(x=>x.innerText)"))
        ok('create sends carry', '"carry_meso_id":"m1"' in rpc and '"carry_week":2' in rpc, rpc[:300] if rpc else rpc)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*r)
    print('AGAIN TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
