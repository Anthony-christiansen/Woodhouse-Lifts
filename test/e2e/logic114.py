# v1.11.4 — "How it works" is an in-app page (#/logic) rendered from docs/training-logic.md; no Google Drive links anywhere.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8796','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8796/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':900},is_mobile=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        for h in ['#/learn','#/settings','#/explore']:
            await pg.goto(B+h); await pg.wait_for_timeout(700)
            n=await pg.evaluate("[...document.querySelectorAll('a')].filter(a=>/google\\.com/.test(a.href)).length")
            ok(f'{h}: no Google Drive/Docs links', n==0, n)
        await pg.goto(B+'#/learn'); await pg.wait_for_timeout(700)
        await pg.click('a[href="#/logic"]'); await pg.wait_for_timeout(1200)
        ok('link opens in-app page', '#/logic' in pg.url, pg.url)
        t=await pg.inner_text('main')
        ok('page shows the training rules', 'Contents' in t and 'What the research says' in t and 'Set (volume) adjustment' in t, t[:300])
        ok('tables render', await pg.locator('article.md table').count() > 3)
        ok('no script tags from content', await pg.locator('article.md script').count()==0)
        await pg.locator('[data-jump]').nth(1).click(); await pg.wait_for_timeout(500)
        ok('contents jump keeps the route', '#/logic' in pg.url, pg.url)
        ok('no JS errors', not errs, errs)
        await pg.screenshot(path=HERE+'/shots/logic_page.png')
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('LOGIC PAGE 1.11.4 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
