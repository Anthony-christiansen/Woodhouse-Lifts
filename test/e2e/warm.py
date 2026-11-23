import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
BAD=[]
def say(*a):
    print(*a)
    for i,x in enumerate(a):
        if x is False or (isinstance(x,list) and x and i and str(a[i-1]).startswith('errs')): BAD.append(a)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8772','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read()
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':320,'height':800},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8772/#/workout/d21'); await pg.wait_for_timeout(700)
        say('notice:', await pg.is_visible('#warmNote'))
        await pg.locator('[data-we="w3"] .set').first.locator('[data-f="weight"]').fill('225')
        await pg.click('[data-info="w3"]'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('#sheet'); say('sheet:', '115' in t and '160' in t and '190' in t, '|', t[:160].replace('\n',' | '))
        await pg.screenshot(path=HERE+'/shots/warm_sheet.png')
        await pg.click('#closeInfo'); await pg.click('#warmOk'); await pg.wait_for_timeout(100)
        say('collapsed:', not await pg.is_visible('#warmNote'), await pg.is_visible('.warm-line'))
        await pg.reload(); await pg.wait_for_timeout(600)
        say('stays collapsed:', not await pg.is_visible('#warmNote'))
        await pg.goto('http://localhost:8772/#/learn/warmup'); await pg.wait_for_timeout(400)
        say('learn:', 'Warming up' in await pg.inner_text('body'), 'errs', errs)
        await br.close()
    srv.terminate()
asyncio.run(main())
import sys as _sys
print('WARM SMOKE:', 'FAILURES '+str(BAD) if BAD else 'ALL PASSED')
_sys.exit(1 if BAD else 0)   # v1.15.1: CI goes by the exit code
