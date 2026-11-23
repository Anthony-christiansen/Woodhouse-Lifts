# v1.15.1 (audit S1/S4/S5/T8): a muscle emptied by an injury area is never refilled on its own (the builder asks);
# an OK is saved and can be taken back; storage failures are never shown as "saved on your phone"; the sheet is a
# real modal (focus in, Tab trapped, Escape, focus returned, locked steps can't be dismissed).
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8816'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        async def newctx(init=''):
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            if init: await ctx.add_init_script(init)
            return ctx
        errs=[]
        # --- protected areas: Abs emptied by "Abs" → builder asks, nothing restored on its own
        ctx=await newctx("window.__PROFILE = { avoid_tags: ['area:abs'] };")
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(1000)
        await pg.fill('#name','Test'); await pg.click('#next'); await pg.wait_for_timeout(700)
        await pg.click('#fillAll'); await pg.wait_for_timeout(500)
        abs_sel=await pg.evaluate("[...document.querySelectorAll('[data-sm]')].filter(s=>s.value==='Abs').map(s=>document.querySelector(`[data-se=\"${s.dataset.sm}\"]`).value)")
        ok('Abs slot not filled with Cable Crunch on its own', all(v!='e15' for v in abs_sel), abs_sel)
        card=pg.locator('[data-blocked="Abs"]')
        ok('builder asks what to do about Abs', await card.count()==1 and 'Cable Crunch' in await card.inner_text())
        if SHOTS: await card.screenshot(path=os.path.join(SHOTS,'blocked-abs.png'))
        await pg.click('[data-allow="e15"]'); await pg.wait_for_timeout(600)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('OK is saved as allow:<id>', w and 'allow:e15' in w.get('avoid_tags',[]) and 'area:abs' in w['avoid_tags'], w)
        ok('card goes away after the OK', await pg.locator('[data-blocked="Abs"]').count()==0)
        await pg.close(); await ctx.close()
        ctx=await newctx("window.__PROFILE = { avoid_tags: ['area:abs'] };")
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(1000)
        await pg.fill('#name','Test'); await pg.click('#next'); await pg.wait_for_timeout(700)
        await pg.click('[data-leaveout="Abs"]'); await pg.wait_for_timeout(400)
        n=await pg.evaluate("[...document.querySelectorAll('[data-sm]')].filter(s=>s.value==='Abs').length")
        ok('Leave out removes Abs slots and the card', n==0 and await pg.locator('[data-blocked]').count()==0, n)
        await pg.close(); await ctx.close()
        ctx=await newctx("window.__PROFILE = { avoid_tags: ['area:abs','allow:e15'] };")
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(900)
        ok('Settings lists the OK with Take back', await pg.locator('[data-unallow="e15"]').count()==1)
        await pg.click('[data-unallow="e15"]'); await pg.wait_for_timeout(500)
        w=await pg.evaluate("(window.__writes||[]).filter(x=>x[0]==='profiles').map(x=>x[1]).pop()")
        ok('Take back removes it', w and w.get('avoid_tags')==['area:abs'], w)
        await pg.close(); await ctx.close()
        # --- storage refused + no signal: never claims it's on the phone
        ctx=await newctx("""const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('wl_pending')) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); };""")
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('sheet').hidden=true; window.__FAIL_NET = true")
        wt=pg.locator('.set').nth(1).locator('[data-f="weight"]'); await wt.fill('72'); await wt.dispatch_event('change'); await pg.wait_for_timeout(500)
        badge=await pg.locator('#syncBadge').inner_text() if await pg.locator('#syncBadge').count() else ''
        ok('badge says it is NOT saved on this phone', 'NOT saved on this phone' in badge, badge)
        toasts=await pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')")
        ok('warns to keep the app open, no "saved on your phone"', 'Keep the app open' in toasts and 'saved on your phone' not in toasts, toasts)
        await pg.evaluate("window.__FAIL_NET = false"); await pg.click('#syncBadge'); await pg.wait_for_timeout(700)
        ok('still syncs from memory when signal returns', await pg.locator('#syncBadge').count()==0 and any(x[0]=='sets' and x[1].get('weight')==72 for x in await pg.evaluate("window.__landed||[]")))
        await pg.close(); await ctx.close()
        # --- accessible sheet
        ctx=await newctx(); pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        await pg.focus('#addEx'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        a=await pg.evaluate("""(() => { const p = document.querySelector('#sheet .panel'); return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'),
          label: document.getElementById(p.getAttribute('aria-labelledby'))?.textContent, inside: p.contains(document.activeElement), inert: document.getElementById('app').inert }; })()""")
        ok('dialog role, modal, labelled by its heading', a['role']=='dialog' and a['modal']=='true' and a['label']=='Add an exercise', a)
        ok('focus moves into it; page behind is inert', a['inside'] and a['inert'], a)
        for _ in range(12): await pg.keyboard.press('Tab')
        ok('Tab stays inside', await pg.evaluate("document.querySelector('#sheet .panel').contains(document.activeElement)"))
        for _ in range(5): await pg.keyboard.press('Shift+Tab')
        ok('Shift+Tab stays inside', await pg.evaluate("document.querySelector('#sheet .panel').contains(document.activeElement)"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok('Escape closes and focus returns', await pg.evaluate("document.getElementById('sheet').hidden && document.activeElement.id==='addEx' && !document.getElementById('app').inert"))
        await pg.evaluate("import('./app.js?v=' + (document.querySelector('script[src*=app]').src.split('v=')[1])).catch(()=>{})")
        # locked sheet (rating after the last set of a muscle): Escape does not dismiss it
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        row=pg.locator('[data-we="w1"] .set').nth(2)
        await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill('10')
        await row.locator('button.check').click(); await pg.wait_for_timeout(900)
        locked=await pg.evaluate("!document.getElementById('sheet').hidden && !!document.getElementById('sheet').dataset.lock")
        ok('finishing a muscle opens a required (locked) rating', locked)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok('Escape does not dismiss a required rating', await pg.evaluate("!document.getElementById('sheet').hidden"))
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.15.1 SAFETY TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
