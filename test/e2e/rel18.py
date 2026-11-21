import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8781','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8781/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
async def mk(br, mock=MOCK, init=None):
    ctx=await br.new_context(viewport={'width':360,'height':900},is_mobile=True,has_touch=True)
    await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=mock))
    if init: await ctx.add_init_script(init)
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); return ctx,pg,errs
CLOSE="(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true; s.innerHTML='';}})()"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        # a) pick a different day this week
        ctx,pg,errs=await mk(br)
        await pg.goto(B); await pg.wait_for_timeout(800)
        ok('home: different-day button', await pg.locator('#pickDay').count()==1)
        await pg.click('#pickDay'); await pg.wait_for_timeout(200)
        days=await pg.evaluate("[...document.querySelectorAll('#sheet [data-day]')].map(b=>b.dataset.day)")
        ok('picker lists open days of the week', len(days)>=2, days)
        await pg.click(f'#sheet [data-day="{days[2]}"]'); await pg.wait_for_timeout(900)
        t=await pg.inner_text('main')
        ok('opens that day with no gate', f'#/workout/{days[2]}' in pg.url and "isn't finished" not in t and 'Workout in progress' not in t, (pg.url, t[:120]))
        ok('no JS errors (a)', not errs, errs); await ctx.close()
        # b) future week: gate offers preview; preview is read-only and does not start the day
        ctx,pg,errs=await mk(br)
        await pg.goto(B+'#/workout/d31'); await pg.wait_for_timeout(800)
        t=await pg.inner_text('main'); ok('future week gate', "isn't finished" in t and 'Just look' in t, t[:160])
        await pg.click('text=Just look'); await pg.wait_for_timeout(900)
        ok('preview url', pg.url.endswith('/view'), pg.url)
        t=await pg.inner_text('main'); ok('preview banner', 'Preview' in t, t[:80])
        dis=await pg.evaluate("[...document.querySelectorAll('.card[data-we] input')].every(i=>i.disabled)")
        ok('preview inputs disabled', dis)
        w=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='workout_days']
        ok('preview does not start the day', not any('started_at' in (x[1] or {}) for x in w), w)
        ok('no JS errors (b)', not errs, errs); await ctx.close()
        # c) legacy shared queue moves into this account's queue
        ctx,pg,errs=await mk(br, init="if(!sessionStorage.__x){sessionStorage.__x=1; localStorage.setItem('wl_pending_sets_v1', JSON.stringify({'zz:1':{workout_exercise_id:'zz',set_index:1,weight:1,reps:1,completed_at:'2026-11-20T00:00:00Z'}}));}")
        await pg.goto(B); await pg.wait_for_timeout(800)
        st=await pg.evaluate("[localStorage.getItem('wl_pending_sets_v1'), localStorage.getItem('wl_pending_sets_v1:u1')]")
        ok('legacy queue migrated to account key', st[0] is None, st)
        ok('no JS errors (c)', not errs, errs); await ctx.close()
        # d) removing a set drops its queued offline save first
        ctx,pg,errs=await mk(br)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
        n0=await pg.evaluate("document.querySelectorAll('.card[data-we=\"w2\"] .set').length")
        await pg.evaluate("localStorage.setItem('wl_pending_sets_v1:u1', JSON.stringify({['w2:'+document.querySelectorAll('.card[data-we=\"w2\"] .set').length]:{workout_exercise_id:'w2',set_index:document.querySelectorAll('.card[data-we=\"w2\"] .set').length,weight:5,reps:5}}))")
        await pg.click('.card[data-we="w2"] [data-rmset]'); await pg.wait_for_timeout(400)
        n1=await pg.evaluate("document.querySelectorAll('.card[data-we=\"w2\"] .set').length")
        q=await pg.evaluate("JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1')||'{}')")
        ok('set removed and its queued save dropped', n1==n0-1 and not q, (n0,n1,q))
        ok('no JS errors (d)', not errs, errs); await ctx.close()
        # e) kg: no double conversion in jump warnings
        ctx,pg,errs=await mk(br, MOCK.replace("unit: 'lb'","unit: 'kg'"))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
        w=pg.locator('.card[data-we="w1"] [data-f="weight"]').last; v=float(await w.input_value() or 0)
        await w.fill(str(round(v+1.25,2))); await w.dispatch_event('change'); await pg.wait_for_timeout(200)
        t=await pg.evaluate("[...document.querySelectorAll('.toast')].map(x=>x.innerText).join('|')")
        ok('kg: one step gives no typo / big-jump warning', 'typo' not in t and 'Manual bump' not in t, (v,t))
        ok('no JS errors (e)', not errs, errs); await ctx.close()
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:220] for x in r])
    print('RELEASE 1.8 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
