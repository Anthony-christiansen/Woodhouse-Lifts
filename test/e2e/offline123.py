# v1.12.3 — rating and finishing a workout work with no signal: changes are kept on the phone in order, shown as
# waiting, survive a reload, and sync by themselves (sets first) when the connection is back.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8803'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',os.environ.get('APPROOT',ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
OK_='wl_pending_ops_v1:u1'; QK='wl_pending_sets_v1:u1'
ops="JSON.parse(localStorage.getItem('%s')||'[]')" % OK_
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        await ctx.add_init_script("window.__FAIL_NET = sessionStorage.getItem('failnet') === '1';")
        errs=[]
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        # A) rate an exercise with no signal → kept on the phone, rating shown, badge
        await pg.evaluate("window.__FAIL_NET = true; sessionStorage.setItem('failnet', '1')")
        third=pg.locator('.card[data-we]').first.locator('.set').nth(2)
        await third.locator('[data-f="reps"]').fill('10'); await third.locator('.check').click(); await pg.wait_for_timeout(500)
        await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(500)
        q=await pg.evaluate(ops)
        ok('A: exercise rating kept on the phone', [o['table'] for o in q]==['exercise_feedback'] and q[0]['values']['workout_exercise_id']=='w1', q)
        ok('A: sheet closed (rating accepted)', await pg.evaluate("document.querySelector('#sheet').hidden"))
        badge=await pg.inner_text('#syncBadge') if await pg.locator('#syncBadge').count() else ''
        ok('A: badge counts the waiting changes', 'change' in badge and 'set' in badge, badge)
        # B) reload while still offline for writes: the rating survives (overlay), so it isn't asked again
        await pg.reload(); await pg.wait_for_timeout(1200)
        ok('B: after reload the rating is still there (not asked again)', await pg.evaluate("document.querySelector('#sheet').hidden") and len(await pg.evaluate(ops))==1, await pg.evaluate(ops))
        # C) finish with no signal at all
        await pg.evaluate("window.__OFFLINE = true")
        await pg.click('#finish'); await pg.wait_for_timeout(1500)
        q=await pg.evaluate(ops)
        kinds=[(o['table'], o['kind']) for o in q]
        ok('C: performance + completion kept on the phone, in order', ('workout_days','update') in kinds and kinds.index(('workout_days','update')) > max(i for i,k in enumerate(kinds) if k[0]=='muscle_feedback'), kinds)
        done=[o for o in q if o['table']=='workout_days'][0]
        ok('C: completion targets this workout', done['eq']=={'id':'d21'} and done['values'].get('completed_at'), done)
        # D) back online → everything syncs, sets first, nothing left
        await pg.evaluate("window.__OFFLINE = false; window.__FAIL_NET = false; sessionStorage.removeItem('failnet'); window.__writes = []; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(1500)
        w=await pg.evaluate("(window.__writes||[]).map(x => x[0])")
        ok('D: synced, sets before ratings and completion', 'sets' in w and 'workout_days' in w and w.index('sets') < w.index('exercise_feedback') < w.index('workout_days'), w)
        left=await pg.evaluate(f"[{ops}.length, Object.keys(JSON.parse(localStorage.getItem('{QK}')||'{{}}')).length]")
        ok('D: nothing left waiting', left==[0,0], left)
        ok('D: badge gone', await pg.locator('#syncBadge').count()==0)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('OFFLINE 1.12.3 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
