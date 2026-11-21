import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8779','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read()
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':360,'height':900},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8779/#/workout/d21'); await pg.wait_for_timeout(900)
        try: await pg.click('#warmOk', timeout=1000)
        except: pass
        await pg.evaluate("(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML='';}})()")
        # find an exercise card with a previous-week value on reps
        info=await pg.evaluate("""(()=>{const rows=[...document.querySelectorAll('.set[data-idx]')].filter(r=>r.querySelector('[data-f=reps]')&&!r.classList.contains('done'));return rows.length})()""")
        ok('rows exist', info>=2, info)
        toasts=[]
        card=pg.locator('.card[data-we="w1"]')
        for idx in ['3','1']:
            row=card.locator(f'.set[data-idx="{idx}"]')
            if 'done' in (await row.get_attribute('class') or ''):
                await row.locator('.check').click(); await pg.wait_for_timeout(400)
                await pg.evaluate("(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML='';}})()")
            await row.locator('[data-f=reps]').fill('1'); await row.locator('[data-f=reps]').dispatch_event('input')
            cls=await row.locator('[data-dir=reps]').get_attribute('class')
            await row.locator('.check').click(); await pg.wait_for_timeout(500)
            t=await pg.evaluate("[...document.querySelectorAll('.toast')].map(x=>x.innerText).join('|')")
            await pg.evaluate("(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML='';}})()")
            toasts.append((idx,cls,t))
        ok('orange notice on 1st and 2nd orange set', all('back' in (c or '') and f'Set {i}:' in t for i,c,t in toasts), toasts)
        ok('only one toast at a time', await pg.evaluate("document.querySelectorAll('.toast').length")<=1)
        el=pg.locator('.dir.back').first
        if await el.count():
            await el.click(); await pg.wait_for_timeout(200)
            ok('tap arrow explains', 'vs' in await pg.evaluate("document.querySelector('.toast')?.innerText||''"))
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:250] for x in r])
    print('ORANGE TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
