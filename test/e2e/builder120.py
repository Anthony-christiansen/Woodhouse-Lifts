# v1.12.0 — builder: Suggested is the one-tap default; templates are a filtered library with an obvious pick;
# From scratch shows splits + muscles; the Templates page opens the builder with the template already chosen.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8798','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8798/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def shot(pg,name):
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,name), full_page=True)
async def fresh(ctx, errs, url='#/new'):
    pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('CSP: '+m.text) if 'Content Security Policy' in m.text else None)
    await pg.goto(B+url); await pg.wait_for_timeout(900); return pg
pressed = "[...document.querySelectorAll('[data-start]')].filter(b=>b.getAttribute('aria-checked')=='true').map(b=>b.dataset.start)"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        # 1) Suggested is the default and is one tap away from the day review
        pg=await fresh(ctx, errs); t=await pg.inner_text('main')
        ok('Suggested chosen by default', await pg.evaluate(pressed)==['suggested'])
        ok('suggestion carries on from the last meso', 'Carries on from your last meso (Whole Body Meso A)' in t, t[:500])
        ok('days default to the last meso (4)', await pg.get_attribute('[data-days="4"]','aria-checked')=='true')
        ok('name filled in for you', (await pg.input_value('#name'))=='Balanced · 4 days')
        ok('the chosen tile is filled and ticked', await pg.evaluate("(()=>{const on=document.querySelector('.choice.start.on'),off=document.querySelector('.choice.start:not(.on)');return !!on.querySelector('.tick') && !off.querySelector('.tick') && getComputedStyle(on).backgroundColor!==getComputedStyle(off).backgroundColor})()"))
        ok('only the chosen start shows its options', await pg.locator('[data-tpl]').count()==0 and await pg.locator('[data-split]').count()==0)
        await shot(pg,'after_builder_suggested.png')
        await pg.click('[data-fresh="1"]'); await pg.wait_for_timeout(150)
        ok('Start fresh → Balanced, no carry-on text', 'Carries on' not in await pg.inner_text('main'))
        await pg.click('#next'); await pg.wait_for_timeout(600); t=await pg.inner_text('main')
        ok('one tap to the day review', 'Step 2 of 2' in t and 'Balanced' in t and 'Full-body split' in t, t[:200])
        ok('days were built', await pg.locator('[data-label]').count()==4)
        await pg.click('#back1'); await pg.wait_for_timeout(300)
        ok('Back keeps your choices', await pg.evaluate(pressed)==['suggested'])
        # 2) Templates: Next waits for a pick; a pick is ticked; focus chips filter; days keep the same focus
        await pg.click('[data-start="template"]'); await pg.wait_for_timeout(200)
        n4=await pg.locator('[data-tpl]').count(); ok('4 days → 21 templates', n4==21, n4)
        ok('Next waits for a template', await pg.is_disabled('#next'))
        await pg.click('[data-tf="arms"]'); await pg.wait_for_timeout(150)
        names=await pg.evaluate("[...document.querySelectorAll('[data-tpl] b')].map(b=>b.innerText)")
        ok('Arms filter shows only Arms', names and set(names)=={'Arms'}, names)
        await pg.click('[data-tpl="arms.upper_lower.4"]'); await pg.wait_for_timeout(150)
        ok('picked template is ticked', await pg.locator('.choice.tpl.on .tick').count()==1)
        ok('name follows the template', (await pg.input_value('#name'))=='Arms · 4 days')
        await shot(pg,'after_builder_templates.png')
        await pg.click('[data-days="6"]'); await pg.wait_for_timeout(150)
        ok('changing days keeps the same template where it fits', await pg.locator('[data-tpl="arms.upper_lower.6"].on').count()==1)
        await pg.click('[data-days="5"]'); await pg.wait_for_timeout(150)
        ok('…and clears it when it does not', await pg.locator('.choice.tpl.on').count()==0 and await pg.is_disabled('#next'))
        await pg.click('[data-tpl="arms.ppl_ul.5"]'); await pg.click('#next'); await pg.wait_for_timeout(600); t=await pg.inner_text('main')
        ok('template carried into the review', 'Arms' in t and 'PPL + Upper/Lower' in t and '5 days' in t, t[:200])
        await pg.close()
        # 3) Adjusting a muscle says "(adjusted)"; From scratch shows splits and opens the muscles
        pg=await fresh(ctx, errs)
        await pg.click('#prioBox summary'); await pg.click('[data-m="Chest"][data-p="emphasize"]'); await pg.wait_for_timeout(150)
        ok('an edit is labelled (adjusted)', '(adjusted)' in await pg.inner_text('#prioBox summary'))
        await pg.click('[data-start="scratch"]'); await pg.wait_for_timeout(150)
        ok('scratch shows splits', await pg.locator('[data-split]').count()>=2)
        ok('scratch keeps your edits', await pg.get_attribute('[data-m="Chest"][data-p="emphasize"]','aria-pressed')=='true')
        ok('scratch opens Adjust muscles', await pg.evaluate("document.querySelector('#prioBox').open"))
        await pg.close()
        # 4) Templates page: library filtered by days; tapping one opens the builder with it chosen
        pg=await fresh(ctx, errs, '#/templates')
        ok('Templates page lists the library', await pg.locator('[data-tpl]').count()==21)
        await pg.click('[data-td="3"]'); await pg.wait_for_timeout(150)
        ok('days filter on the page', await pg.locator('[data-tpl]').count()==14)
        await shot(pg,'after_templates_page.png')
        await pg.click('[data-tpl="lower.full_body_split.3"]'); await pg.wait_for_timeout(900)
        ok('opens the builder on that template', await pg.evaluate(pressed)==['template'] and await pg.locator('[data-tpl="lower.full_body_split.3"].on').count()==1
           and await pg.get_attribute('[data-days="3"]','aria-checked')=='true')
        # 6) v1.12.2: Suggested carries on from the RUNNING meso even when many imported mesos share one created_at
        pg2=await ctx.new_page(); pg2.on('pageerror', lambda e: errs.append(str(e)))
        await pg2.add_init_script("""window.__MESOS = [...Array.from({length: 12}, (_, i) => ({ id: 'old'+i, name: 'Old Leg Meso '+i, status: 'completed', focus: 'lower', priorities: {}, weeks: 6, days_per_week: 4, created_at: '2026-11-21T00:00:00Z' })),
          { id: 'cur', name: 'Current Upper Meso', status: 'active', focus: 'upper', priorities: {}, weeks: 5, days_per_week: 5, created_at: '2026-11-21T00:00:00Z' }];""")
        await pg2.goto(B+'#/new'); await pg2.wait_for_timeout(900); t=await pg2.inner_text('main')
        ok('suggestion follows the running meso, not the newest import', 'Carries on from your last meso (Current Upper Meso)' in t and 'Upper body' in t, t[t.find('Carries'):t.find('Carries')+120])
        ok('days follow the running meso (5)', await pg2.get_attribute('[data-days="5"]','aria-checked')=='true')
        await pg2.close()
        # 5) layout: nothing wider than the phone
        over=await pg.evaluate("[...document.querySelectorAll('main *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+1}).length")
        ok('fits a 390px phone', over==0, over)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('BUILDER 1.12.0 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
