# v1.12.1 — set saving can't go stale: an offline retry of an older value never lands after a newer edit; every edit is
# on the phone before it is sent; offline edits sync once back online; an in-flight save doesn't show "waiting to sync".
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8801'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',os.environ.get('APPROOT',ROOT)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
QK='wl_pending_sets_v1:u1'
OLD={'workout_exercise_id':'w1','set_index':1,'weight':70,'reps':11,'rir':2,'completed_at':'2026-11-20T10:00:00Z'}
last_for = "k => (window.__landed||[]).filter(([t,p])=>t==='sets' && p.workout_exercise_id+':'+p.set_index===k).map(x=>x[1]).pop() || null"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        # A) an old offline copy is being retried (slow) while you edit the same set (fast): the edit must win.
        await ctx.add_init_script(f"""if (!sessionStorage.getItem('seeded')) {{ sessionStorage.setItem('seeded','1');
          localStorage.setItem('{QK}', JSON.stringify({{'w1:1': {json.dumps(OLD)}}})); }}
          window.__DELAY = (t, p) => t === 'sets' && p.weight === 70 && p.set_index === 1 ? 900 : (t === 'sets' && p.weight === 77 ? 1200 : 20);""")
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('CSP: '+m.text) if 'Content Security Policy' in m.text else None)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(300)
        w=pg.locator('.set').first.locator('[data-f="weight"]')
        await w.wait_for(); await w.fill('75'); await w.dispatch_event('change')
        await pg.wait_for_timeout(1800)
        last=await pg.evaluate(f"({last_for})('w1:1')")
        ok('A: newer edit lands last (75, not the old 70)', last and last['weight']==75, last)
        ok('A: nothing left waiting', await pg.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('{QK}')||'{{}}')).length")==0)
        ok('A: no local-only fields sent', not any('_v' in x[1] or '_queued' in x[1] for x in await pg.evaluate("window.__writes||[]")))
        # B) write-ahead: during a slow save the value is already on the phone, and it isn't shown as "waiting"
        await w.fill('77'); await w.dispatch_event('change'); await pg.wait_for_timeout(250)
        q=await pg.evaluate(f"JSON.parse(localStorage.getItem('{QK}')||'{{}}')")
        ok('B: edit is on the phone before the server answers', q.get('w1:1',{}).get('weight')==77 and q['w1:1'].get('_v'), q)
        ok('B: in-flight save is not shown as waiting to sync', await pg.locator('#syncBadge').count()==0)
        await pg.wait_for_timeout(1300)
        ok('B: cleared once saved', await pg.evaluate(f"Object.keys(JSON.parse(localStorage.getItem('{QK}')||'{{}}')).length")==0)
        # C) offline edit → queued + badge; back online → synced, badge gone
        await pg.evaluate("window.__FAIL_NET = true")
        w2=pg.locator('.set').nth(1).locator('[data-f="weight"]')
        await w2.fill('72'); await w2.dispatch_event('change'); await pg.wait_for_timeout(300)
        ok('C: offline edit kept and badge shown', await pg.locator('#syncBadge').count()==1)
        await pg.evaluate("window.__FAIL_NET = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(600)
        last2=await pg.evaluate(f"({last_for})('w1:2')")
        ok('C: synced when back online', last2 and last2['weight']==72 and await pg.locator('#syncBadge').count()==0, last2)
        # D) two quick edits while offline then online: only the newest survives on the server
        await pg.evaluate("window.__FAIL_NET = true")
        for v in ['73','74']: await w2.fill(v); await w2.dispatch_event('change'); await pg.wait_for_timeout(150)
        await pg.evaluate("window.__FAIL_NET = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(700)
        last3=await pg.evaluate(f"({last_for})('w1:2')")
        ok('D: newest offline value wins', last3 and last3['weight']==74, last3)
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('SYNC 1.12.1 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
