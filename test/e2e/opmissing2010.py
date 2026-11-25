# v1.20.10 (audit 1.20.8, F01) — a queued UPDATE that matches no row (workout deleted, or not this account's) is a
# visible conflict, never counted as saved: kept in Settings → Sync problems, summary/badge never say "synced" for it.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8826'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
MISSING_DAY="window.__MISSING = (t, eqs, p) => t === 'workout_days' && p && 'completed_at' in p"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); await pg.add_init_script('window.__FB = []')
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100); return pg
        async def finish(pg):
            row=pg.locator('.card[data-we="w1"] .set').nth(2)
            await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill('10'); await row.locator('.check').click()
            await pg.wait_for_timeout(700)
            for _ in range(5):
                if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
            for _ in range(5):
                await pg.click('#finish'); await pg.wait_for_timeout(1000)
                if '#/summary' in pg.url: return
                if await pg.locator('#sheet #allNormal').count(): await pg.click('#sheet #allNormal'); await pg.wait_for_timeout(400)
                elif not await pg.locator('#finish:not([disabled])').count(): await pg.wait_for_timeout(500)
                else: return
        problems = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('wl_pending_sets_v1:failed:u1') || '[]')")
        waiting_ops = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('wl_pending_ops_v1:u1') || '[]').length")

        # 1) online: the workout's row is gone → Finish doesn't pretend; the change is kept aside with a reason
        pg=await newpage(); await pg.evaluate(MISSING_DAY)
        await finish(pg)
        ok('online, missing row: not taken to the summary as if finished', '#/summary' not in pg.url, pg.url)
        pr=await problems(pg)
        ok('kept aside with a reason (no longer exists)', any(f.get('op',{}).get('table')=='workout_days' and 'no longer exists' in f.get('_error','') for f in pr), pr[-1:] if pr else pr)
        ok('not left retrying forever in the queue', await waiting_ops(pg)==0, await waiting_ops(pg))
        await pg.evaluate("location.hash = '#/settings'"); await pg.wait_for_timeout(900)
        st=await pg.inner_text('main')
        ok('Settings → Sync problems lists it as a finish', 'Sync problems' in st and 'A finish / skip' in st and 'no longer exists' in st, st[:300])
        await pg.context.close()

        # 2) offline finish, then the row turns out to be gone when it syncs → the summary line changes to the problem
        pg=await newpage()
        await pg.evaluate("window.__OFFLINE = true")
        await finish(pg)
        ok('offline finish reaches the summary', '#/summary' in pg.url, pg.url)
        await pg.evaluate(MISSING_DAY + "; window.__OFFLINE = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(2500)
        line=(await pg.inner_text('#sumSync')).strip() if await pg.locator('#sumSync').count() else ''
        ok('after sync: summary does NOT say synced', 'synced' not in line.lower() and 'refused' in line, line)
        badge=await pg.locator('#syncBadge').count()
        ok('nothing left pretending to wait (badge gone, problem listed instead)', badge==0 and len(await problems(pg))>=1)
        await pg.context.close()

        # 3) normal finish (row exists) is unchanged: synced, nothing kept aside
        pg=await newpage()
        await finish(pg)
        line=(await pg.inner_text('#sumSync')).strip() if await pg.locator('#sumSync').count() else ''
        ok('row exists: finish works and says synced', '#/summary' in pg.url and line.endswith('Saved and synced.'), line)
        ok('row exists: no sync problems', len(await problems(pg))==0)
        await pg.context.close()

        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'OPMISSING2010 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
