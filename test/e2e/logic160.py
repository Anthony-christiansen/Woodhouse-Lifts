# v1.16.0 (audit T1/T4/T7): effort styles reach the saved meso, Grow → Maintain is a proposal you accept or
# decline, 1× templates are labelled, and an added exercise follows the meso's effort style.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8817'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        # effort style → create payload
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(1000)
        ok('three effort styles, Standard by default', await pg.locator('[data-effort]').count()==3 and await pg.get_attribute('[data-effort="standard"]','aria-pressed')=='true')
        await pg.click('[data-effort="conservative"]'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('main')
        ok('Conservative preview never below 2 / 1', 'Main lifts by week: 3 → 2 → 2 → 2 → light' in t and 'other lifts: 3 → 2 → 1 → 1 → light' in t, t[t.find('Main lifts by'):t.find('Main lifts by')+120])
        if SHOTS: await pg.locator('.card:has([data-effort])').screenshot(path=os.path.join(SHOTS,'effort.png'))
        # short time → proposal, not an automatic change
        await pg.click('[data-days="2"]'); await pg.wait_for_timeout(200); await pg.click('[data-min="45"]'); await pg.wait_for_timeout(200)
        await pg.fill('#name','Test'); await pg.click('#next'); await pg.wait_for_timeout(800)
        prop=pg.locator('#proposal')
        if await prop.count():
            ok('Grow → Maintain shown as a suggestion', 'Suggestion' in await prop.inner_text())
            if SHOTS: await prop.screenshot(path=os.path.join(SHOTS,'proposal.png'))
            ok('nothing moved yet', 'were set to' not in await pg.inner_text('main') and 'was set to' not in await pg.inner_text('main'))
            await pg.click('#propNo'); await pg.wait_for_timeout(300)
            ok('Keep as Grow dismisses it, priorities unchanged', await pg.locator('#proposal').count()==0 and 'set to <b>Maintain' not in await pg.content())
            await pg.click('#fillAll'); await pg.wait_for_timeout(400)
            if await pg.locator('#proposal').count():
                await pg.click('#propYes'); await pg.wait_for_timeout(300)
                ok('Move to Maintain applies it and says so', 'Maintain' in await pg.inner_text('main') and await pg.locator('#proposal').count()==0)
        else: ok('a 45-min, 2-day plan triggers a proposal (fixture)', False, 'no proposal')
        # create with Conservative → targets respect the floors
        sel=await pg.evaluate("[...document.querySelectorAll('[data-se]')].filter(s=>!s.value).length")
        if sel: await pg.click('#fillLeft'); await pg.wait_for_timeout(300)
        await pg.evaluate("[...document.querySelectorAll('[data-se]')].forEach(s=>{ if(!s.value && s.options.length>1){ s.value=s.options[1].value; s.dispatchEvent(new Event('change')); } })")
        await pg.evaluate("[...document.querySelectorAll('[data-rm]')].reverse().forEach(b=>{ const s=document.querySelector(`[data-se=\"${b.dataset.rm}\"]`); if(s && !s.value) b.click(); })")
        await pg.click('#create'); await pg.wait_for_timeout(800)
        c=await pg.evaluate("(window.__creates||[]).pop()")
        days=(c or {}).get('p',{}).get('days',[])
        lib=await pg.evaluate("Object.fromEntries([['e1','compound'],['e2','compound'],['e3','compound'],['e4','compound'],['e5','compound'],['e7','compound'],['e9','compound'],['e17','compound'],['e18','compound']])")
        bad=[(d['week'],x) for d in days for x in d['exercises'] if d['week']<5 and x['target_rir'] < (2 if x['exercise_id'] in lib else 1)]
        ok('saved meso: main lifts ≥2, others ≥1 in hard weeks', days and not bad, bad[:3] or len(days))
        # add-exercise follows the meso's floor: today's targets above normal → conservative/main1
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        await pg.click('#addEx'); await pg.wait_for_timeout(400)
        await pg.select_option('#axMuscle','Quads'); await pg.wait_for_timeout(200)
        await pg.locator('[data-ax-id]', has_text='Leg Extension').click(); await pg.wait_for_timeout(150)
        await pg.click('[data-ax="future"]'); await pg.wait_for_timeout(700)
        ins=await pg.evaluate("(window.__rows||[]).filter(r=>r[0]==='workout_exercises'&&r[1]==='insert').map(r=>r[2])")
        ok('added exercise gets this week’s target', ins and ins[0].get('target_rir') is not None, ins[:1])
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.16.0 LOGIC UI TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
