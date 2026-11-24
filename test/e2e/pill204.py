# v1.20.4 — the per-exercise pill says "On plan" (with what changed) instead of "0.0%" when the strength estimate
# is flat because you did what the plan asked; ▲/▼ keep the % for beating or missing it. Mock last week (same day):
# 70×11, 70×10 at the same planned effort.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8821'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def log(pg, sets):
    card=pg.locator('.card[data-we="w1"]')
    for i,(w,r) in enumerate(sets):
        row=card.locator('.set').nth(i)
        await row.locator('[data-f="weight"]').fill(str(w)); await row.locator('[data-f="reps"]').fill(str(r))
        if await row.evaluate("e => e.classList.contains('done')"):
            await row.locator('[data-f="reps"]').dispatch_event('change')
        else: await row.locator('.check').click()
        await pg.wait_for_timeout(350)
    pill=card.locator('[data-trend="w1"] .pill')
    return (await pill.inner_text()).strip() if await pill.count() else '', (await pill.get_attribute('class') or '') if await pill.count() else ''
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        cases=[
            ('on plan: estimate flat, numbers changed', [(71,10),(71,9),(71,9)], lambda t,c: t.startswith('●') and 'On plan' in t and '+1 lb' in t and '−1 rep/set' in t and 'plan' in c.split() and '%' not in t),
            ('same numbers: says so, no 0.0%', [(70,11),(70,10),(70,9)], lambda t,c: t=='● Same as last time' and 'plan' not in c.split()),
            ('beat the plan: ▲ with %', [(70,12),(70,11),(70,10)], lambda t,c: t.startswith('▲') and '+2.3%' in t and 'on' in c.split()),
            ('fell short: ▼ with %', [(70,9),(70,8),(70,8)], lambda t,c: t.startswith('▼') and '%' in t and 'bad' in c.split()),
        ]
        for name, sets, check in cases:
            pg=await newpage()
            await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
            t,c=await log(pg, sets)
            ok(name, check(t,c), repr((t,c)))
            if name.startswith('on plan'):
                title=await pg.locator('[data-trend="w1"] .pill').get_attribute('title')
                ok('on plan: the estimate is still in the tooltip', 'strength estimate' in (title or '') and 'last week' in (title or ''), title)
                sheet=await pg.inner_text('#sheet') if await pg.locator('#sheet:not([hidden])').count() else ''
                ok('rating sheet shows the same words', 'On plan · +1 lb, −1 rep/set' in sheet, sheet[:200])
                if SHOTS:
                    await pg.screenshot(path=os.path.join(SHOTS,'pill-sheet.png'))
                    if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
                    await pg.locator('.card[data-we="w1"]').scroll_into_view_if_needed()
                    await pg.locator('.card[data-we="w1"]').screenshot(path=os.path.join(SHOTS,'pill-card.png'))
            await pg.context.close()
        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'PILL204 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
