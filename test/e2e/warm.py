import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
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
        print('notice:', await pg.is_visible('#warmNote'))
        await pg.locator('[data-we="w3"] .set').first.locator('[data-f="weight"]').fill('225')
        await pg.click('[data-info="w3"]'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('#sheet'); print('sheet:', '115' in t and '160' in t and '190' in t, '|', t[:160].replace('\n',' | '))
        await pg.screenshot(path=HERE+'/shots/warm_sheet.png')
        await pg.click('#closeInfo'); await pg.click('#warmOk'); await pg.wait_for_timeout(100)
        print('collapsed:', not await pg.is_visible('#warmNote'), await pg.is_visible('.warm-line'))
        await pg.reload(); await pg.wait_for_timeout(600)
        print('stays collapsed:', not await pg.is_visible('#warmNote'))
        await pg.goto('http://localhost:8772/#/learn/warmup'); await pg.wait_for_timeout(400)
        print('learn:', 'Warming up' in await pg.inner_text('body'), 'errs', errs)
        await br.close()
    srv.terminate()
asyncio.run(main())
