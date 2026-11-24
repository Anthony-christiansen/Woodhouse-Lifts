# v1.20.5 — the post-workout summary says "On plan" (with what changed) when a lift's estimate held because you did
# what the plan asked, counts it as "on plan or better", and calls the muscle "on plan" — never "about the same".
import os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8822'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        # 1) real flow (finished with no signal, so the edits on the phone are what counts): last week 70×11, 70×10 → today 71×10, 71×9, 71×9 (estimate within 1%) → On plan
        pg=await newpage()
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        card=pg.locator('.card[data-we="w1"]')
        for i,(w,r) in enumerate([(71,10),(71,9),(71,9)]):
            row=card.locator('.set').nth(i)
            await row.locator('[data-f="weight"]').fill(str(w)); await row.locator('[data-f="reps"]').fill(str(r))
            if await row.evaluate("e => e.classList.contains('done')"): await row.locator('[data-f="reps"]').dispatch_event('change')
            else: await row.locator('.check').click()
            await pg.wait_for_timeout(350)
        for _ in range(4):
            if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
        # the mock server doesn't keep edited sets, so finish from what's on the phone (the app's no-signal path)
        await pg.evaluate("window.__OFFLINE = true")
        for _ in range(4):
            await pg.click('#finish'); await pg.wait_for_timeout(900)
            if '#/summary' in pg.url: break
            if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
        ok('Finish opens the summary', '#/summary' in pg.url, pg.url)
        t=await pg.inner_text('main')
        ok('planned sets counted when finishing with no signal (was "3 of 0")', '3/3 sets' in t and 'of 0 sets' not in t and '0/0' not in t, t[:200])
        ok('lift says On plan with what changed', 'On plan · +1 lb, −1 rep/set' in t, t[:600])
        ok('green ● mark labelled on plan', await pg.locator('.trend.plan[aria-label="on plan"]').count()==1)
        ok('counted as on plan or better', 'on plan or better' in t and 'beat last time' not in t)
        ok('muscle reads on plan, not about the same', 'Chest on plan' in t and 'about the same' not in t, t[t.find('Performance'):][:120])
        ok('legend explains ● and keeps "an estimate"', '● on plan' in t and 'an estimate' in t)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'summary-onplan.png'), full_page=True)
        await pg.context.close()
        # 2) every mark, from a stored summary
        pg=await newpage()
        await pg.goto(B+'#/'); await pg.wait_for_timeout(900)
        S={'at':0,'dayId':'d21','mesoId':'m1','title':'Week 2 · Full body A','queued':False,'next':None,'mesoName':'Meso A',
           'lifts':[{'name':'Up lift','muscle':'Back','done':3,'planned':3,'best':{'w':100,'r':10},'last':{'w':100,'r':9},'trend':1,'change':None},
                    {'name':'Plan lift','muscle':'Quads','done':3,'planned':3,'best':{'w':22.5,'r':15},'last':{'w':22.5,'r':14},'trend':0,'change':'+1 rep/set'},
                    {'name':'Same lift','muscle':'Calves','done':2,'planned':2,'best':{'w':50,'r':10},'last':{'w':50,'r':10},'trend':0,'change':''},
                    {'name':'Down lift','muscle':'Biceps','done':2,'planned':2,'best':{'w':30,'r':8},'last':{'w':30,'r':10},'trend':-1,'change':None},
                    {'name':'New lift','muscle':'Abs','done':2,'planned':2,'best':{'w':40,'r':12},'last':None,'trend':None,'change':None}],
           'cardio':[],'muscles':[{'m':'Back','perf':1},{'m':'Quads','perf':0},{'m':'Calves','perf':0},{'m':'Biceps','perf':-1},{'m':'Abs','perf':None}]}
        await pg.evaluate("s => sessionStorage.setItem('wl_summary', s)", json.dumps(S))
        await pg.goto(B+'#/summary'); await pg.wait_for_timeout(700)
        t=await pg.inner_text('main')
        marks=await pg.eval_on_selector_all('.sum-best .trend','els => els.map(e => e.className.split(" ")[1])')
        ok('marks: up, plan, flat, down, none', marks==['up','plan','flat','down','na'], marks)
        ok('beat the plan note', 'Beat the plan' in t)
        ok('below last time gets a kind note, not just ▼', 'An off day happens' in t)
        ok('2 on plan or better (up + on plan; same is not counted)', '2\non plan or better' in t or '2 on plan or better' in t.replace('\n',' '), t[:300])
        ok('muscle words', all(x in t for x in ['Back up','Quads on plan','Calves holding steady','Biceps below last time','Abs no comparison yet']), t[t.find('Performance'):][:200])
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'summary-marks.png'), full_page=True)
        await pg.context.close()
        # the mock returns every column, so check the real query asks for the planned sets (shipped without it in 1.19.0)
        src=open(os.path.join(ROOT,'screens','workout.js')).read()
        ok('finish query asks the server for target_sets', "select('id, exercise_id, target_sets, target_rir, exercises(*), sets(*)')" in src)
        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'SUMMARY205 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
