import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
BAD=[]
def say(*a):
    print(*a)
    for i,x in enumerate(a):
        if x is False or (isinstance(x,list) and x and i and str(a[i-1]).startswith('errs')): BAD.append(a)
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8769','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-auth.js').read(); BASE='http://localhost:8769/'
async def mk(br):
    ctx=await br.new_context(viewport={'width':320,'height':700},is_mobile=True,has_touch=True)
    await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    await ctx.add_init_script('window.__AUTH={}')
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); return ctx,pg,errs
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx,pg,errs=await mk(br)
        await pg.goto(BASE); await pg.wait_for_timeout(400)
        await pg.fill('input[name=email]','x@example.com'); await pg.click('#forgot'); await pg.wait_for_timeout(150)
        say('prefill', await pg.input_value('input[name=email]'))
        await pg.click('button[type=submit]'); await pg.wait_for_timeout(200)
        say('sent:', 'Check your email' in await pg.inner_text('main'), (await pg.evaluate('window.__calls'))[-1])
        await pg.screenshot(path=HERE+'/shots/reset_sent.png'); say('errs',errs); await ctx.close()
        ctx,pg,errs=await mk(br)
        await pg.goto(BASE+'#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery'); await pg.wait_for_timeout(700)
        t=await pg.inner_text('main'); say('recovery screen:', 'Choose a new password' in t, pg.url, 'tabs hidden', await pg.evaluate('document.getElementById("tabs").hidden'))
        await pg.fill('input[name=p1]','newpassword1'); await pg.fill('input[name=p2]','nope12345'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(150)
        say('mismatch blocked:', not any(c[0]=='update' for c in await pg.evaluate('window.__calls')))
        await pg.fill('input[name=p2]','newpassword1'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(500)
        say('updated:', (await pg.evaluate('window.__calls'))[-1], 'now on:', (await pg.inner_text('main'))[:40].replace('\n',' '))
        await pg.screenshot(path=HERE+'/shots/reset_after.png'); say('errs',errs); await ctx.close()
        await br.close()
    srv.terminate()
asyncio.run(main())
import sys as _sys
print('RESET SMOKE:', 'FAILURES '+str(BAD) if BAD else 'ALL PASSED')
_sys.exit(1 if BAD else 0)   # v1.15.1: CI goes by the exit code
