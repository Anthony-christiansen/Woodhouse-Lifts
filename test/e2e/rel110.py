import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8783','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8783/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
CLOSE="(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML=''; delete s.dataset.lock;}})()"
async def mk(br, mock):
    ctx=await br.new_context(viewport={'width':390,'height':900},is_mobile=True,has_touch=True)
    await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=mock))
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); return ctx,pg,errs
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        # a) finishing an exercise asks for ITS rating first, then the muscle's (no muscle rating saved yet today)
        m0=MOCK.replace("muscle_feedback: [{ muscle_group: 'Chest', soreness: 3, workload: 3, joint_pain: 2, workout_days: { week: 1, day_index: 1 } }],","muscle_feedback: [],")
        ctx,pg,errs=await mk(br, m0)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000); await pg.evaluate(CLOSE)
        ok('exercise rating line on lift cards', await pg.locator('.card[data-we="w1"] [data-exrate]').count()==1)
        ok('no exercise rating on cardio', await pg.locator('.card[data-we="w5"] [data-exrate]').count()==0)
        rows=pg.locator('.card[data-we="w1"] .set')
        for i in range(await rows.count()):
            r=rows.nth(i)
            if 'done' in (await r.get_attribute('class') or ''): continue
            await r.locator('[data-f=weight]').fill('70'); await r.locator('[data-f=reps]').fill('10'); await r.locator('.check').click(); await pg.wait_for_timeout(400)
        t=await pg.inner_text('#sheet'); ok('exercise sheet opens first', 'how was this exercise' in t and 'Pump' not in t, t[:160])
        await pg.click('#sheet [data-k="workload"][data-v="1"]'); await pg.click('#sheet [data-k="joint_pain"][data-v="0"]')
        await pg.click('#saveExRate'); await pg.wait_for_timeout(500)
        w=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='exercise_feedback']
        ok('exercise rating saved', w and w[-1][1].get('workout_exercise_id')=='w1' and w[-1][1].get('workload')==1 and w[-1][1].get('joint_pain')==0, w)
        t=await pg.inner_text('#sheet'); ok('then the muscle sheet', 'Chest' in t and 'Pump' in t and 'as a whole' in t, t[:200])
        pre=await pg.evaluate("[...document.querySelectorAll('#sheet [data-k].on')].map(b=>b.dataset.k+':'+b.dataset.v)")
        ok('single exercise: workload/joints start from its rating', 'workload:1' in pre and 'joint_pain:0' in pre, pre)
        ok('no JS errors (a)', not errs, errs); await ctx.close()
        # b) finish is blocked until the exercise is rated
        ctx,pg,errs=await mk(br, MOCK)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000); await pg.evaluate(CLOSE)
        rows=pg.locator('.card[data-we="w1"] .set')
        for i in range(await rows.count()):
            r=rows.nth(i)
            if 'done' in (await r.get_attribute('class') or ''): continue
            await r.locator('[data-f=weight]').fill('70'); await r.locator('[data-f=reps]').fill('10'); await r.locator('.check').click(); await pg.wait_for_timeout(400)
        await pg.evaluate(CLOSE); await pg.click('#finish'); await pg.wait_for_timeout(400)
        t=await pg.inner_text('#sheet'); ok('finish asks for the exercise rating', 'how was this exercise' in t, t[:120])
        ok('no JS errors (b)', not errs, errs); await ctx.close()
        # c) last week's exercise joint pain holds THAT lift
        m2=MOCK.replace("exercise_prefs: [],","exercise_prefs: [], exercise_feedback: [{ workout_exercise_id: 'w1', workload: 1, joint_pain: 2 }],")
        ctx,pg,errs=await mk(br, m2)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000); await pg.evaluate(CLOSE)
        n=await pg.inner_text('.card[data-we="w1"] .prog-note') if await pg.locator('.card[data-we="w1"] .prog-note').count() else ''
        ok('exercise joint pain → holding this lift', 'Holding' in n and 'this exercise' in n, n)
        ok('rated line shows', '✓ Exercise' in await pg.inner_text('.card[data-we="w1"] [data-exrate]'))
        ok('no JS errors (c)', not errs, errs); await ctx.close()
        # d) without the table (older database) the app keeps working with muscle ratings only
        m3=MOCK.replace("let data = fixtures[table] || [];","let data = fixtures[table] || []; if (table === 'exercise_feedback') return Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'not found' } }).then(res, rej);")
        ctx,pg,errs=await mk(br, m3)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000); await pg.evaluate(CLOSE)
        ok('no exercise rating lines when table missing', await pg.locator('[data-exrate]').count()==0)
        ok('no JS errors (d)', not errs, errs); await ctx.close()
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:240] for x in r])
    print('RELEASE 1.10 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
