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
srv=subprocess.Popen([sys.executable,'-m','http.server','8776','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read().replace("rn: vals.length - i, prior_best: null","rn: vals.length - i, prior_best: id==='e1' ? 130 : null")
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':360,'height':900})
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8776/#/workout/d12'); await pg.wait_for_timeout(900)
        t=await pg.inner_text('main'); say('w1 rendered', 'set' in t, 'errs', errs)
        await pg.goto('http://localhost:8776/#/'); await pg.wait_for_timeout(300); await pg.goto('http://localhost:8776/#/workout/d21'); await pg.wait_for_timeout(900)
        n=await pg.evaluate("[...document.querySelectorAll('.hist-note')].map(x=>x.innerText)"); say('notes', n, 'errs', errs)
        await br.close()
    srv.terminate()
asyncio.run(main())
import sys as _sys
print('W1 SMOKE:', 'FAILURES '+str(BAD) if BAD else 'ALL PASSED')
_sys.exit(1 if BAD else 0)   # v1.15.1: CI goes by the exit code
