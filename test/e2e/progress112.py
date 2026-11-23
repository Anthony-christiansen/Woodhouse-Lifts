# v1.11.2 — Progress: "This meso" (week 1 → latest of this meso) vs "All time" (no %, last-done date, stale greyed);
# a lift not in the current meso shows "Not in this meso" instead of a status badge and % headline.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, re
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8795','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8795/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
# one stale lift (last done in July) next to the fresh Hack Squat
STALE=MOCK.replace("'rpc:strength_summary': [", "'rpc:strength_summary': [{ exercise_id: 'e9', name: 'Old Lift', muscle_group: 'Chest', sessions: 4, first_e1rm: 100, last_e1rm: 137, last_at: '2026-07-01T10:00:00Z' }, ",1)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':900},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=STALE))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/progress'); await pg.wait_for_timeout(1200)
        t=await pg.inner_text('main')
        ok('default view is This meso', 'This meso' in t and 'week 1 to your latest week' in t, t[:300])
        ok('old lift not on This meso', 'Old Lift' not in t, t[:400])
        await pg.goto(B+'#/progress/all'); await pg.wait_for_timeout(1000)
        t=await pg.inner_text('main')
        ok('All time lists every lift', 'Old Lift' in t and 'Hack Squat' in t, t[:400])
        ok('All time has no percentages', not re.search(r'[+-]?\d+(\.\d)?%', t), t[:400])
        ok('All time shows last done', 'last Jul 2026' in t, t[:400])
        ok('stale lift greyed', await pg.locator('.list-btn.stale').count()==1)
        await pg.goto(B+'#/progress/e9'); await pg.wait_for_timeout(1000)
        t=await pg.inner_text('main')
        ok('lift not in meso: no status badge', 'Not in this meso' in t and 'Where this lift stands' not in t, t[:200])
        ok('lift not in meso: last done instead of % change', 'last done' in t and 'change' not in t, t[:600])
        await pg.goto(B+'#/progress/e5'); await pg.wait_for_timeout(1000)
        t=await pg.inner_text('main')
        ok('lift in meso: status + % change kept', 'Where this lift stands' in t and 'change' in t, t[:300])
        ok('no JS errors', not errs, errs)
        # sessions in the CURRENT meso → week 1 → latest % shows (mock e5: 300 → 310.5 performance)
        ctx2=await br.new_context(viewport={'width':390,'height':900},is_mobile=True)
        await ctx2.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=STALE.replace("mesocycle_id: 'm0'","mesocycle_id: 'm1'")))
        pg2=await ctx2.new_page(); e2=[]; pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.goto(B+'#/progress'); await pg2.wait_for_timeout(1200)
        t=await pg2.inner_text('main')
        ok('This meso: % since week 1 for lifts done this meso', re.search(r'Hack Squat\s+Quads · wk 1 → wk 5\s+\+3\.7%', t), t[:500])
        ok('no JS errors (2)', not e2, e2)
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('PROGRESS 1.11.2 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
