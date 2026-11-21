import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8782','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8782/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
CLOSE="(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML='';}})()"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':900},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        # replace exercise
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
        n=await pg.locator('[data-replace]').count(); ok('replace buttons', n>0, n)
        await pg.locator('[data-replace]').first.click(); await pg.wait_for_timeout(400)
        t=await pg.inner_text('#sheet'); ok('replace sheet', 'Replace' in t and 'Same muscle' in t, t[:120])
        cands=await pg.locator('#sheet [data-rp]').count(); ok('same-muscle options', cands>=1, cands)
        if cands:
            await pg.locator('#sheet [data-rp]').first.click(); await pg.wait_for_timeout(100)
            await pg.click('#sheet [data-scope="future"]'); await pg.wait_for_timeout(700)
            w=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='workout_exercises']
            ok('replace writes exercise_id', any('exercise_id' in json.dumps(x) for x in w), w[-3:])
        # RIR picker
        await pg.goto(B+'#/'); await pg.wait_for_timeout(300); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
        ok('set-1 RIR picker', await pg.locator('[data-rir1]').count()>0)
        sel=pg.locator('.card[data-we="w1"] [data-rir1]')
        if await sel.count():
            await sel.select_option('0'); await pg.wait_for_timeout(200)
            row=pg.locator('.card[data-we="w1"] .set[data-idx="1"]')
            if 'done' not in (await row.get_attribute('class') or ''):
                await row.locator('[data-f=reps]').fill('8'); await row.locator('.check').click(); await pg.wait_for_timeout(500)
            else:
                await pg.wait_for_timeout(500)
            sets=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='sets']
            last=sets[-1][1] if sets else {}
            if isinstance(last,list): last=last[0]
            ok('actual RIR saved on set 1', last.get('rir')==0, last)
        # builder: time per workout + 4 priorities + trimmed report
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(700)
        ok('time selector', await pg.locator('#minutes').count()==1)
        segs=await pg.evaluate("[...document.querySelector('.prio .seg').querySelectorAll('button')].map(b=>b.dataset.p)")
        ok('Emphasize/Grow/Maintain/Skip', segs==['emphasize','grow','maintain','skip'], segs)
        await pg.select_option('#days','2'); await pg.wait_for_timeout(150)
        await pg.select_option('#minutes','60'); await pg.fill('#name','T'); await pg.click('#next'); await pg.wait_for_timeout(500)
        t=await pg.inner_text('main'); ok('time fit report + minutes per day', 'min' in t and ('trimmed' in t or 'longer than' in t), t[:300])
        await pg.screenshot(path=HERE+'/shots/builder_time.png', full_page=True)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:240] for x in r])
    print('RELEASE 1.9 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
