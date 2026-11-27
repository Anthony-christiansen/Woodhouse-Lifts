# v1.21.2 (audit 1.20.8 F02, other-device part) — each set save says which server row it was edited from (based_on);
# a save the server's delete guard skips (the set was removed on another phone) is shown in Settings → Sync problems,
# never silently lost or retried; and the app still saves normally against a database without the new column.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8827'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
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
        async def edit(pg, idx, reps, check=False):
            row=pg.locator(f'.card[data-we="w1"] .set[data-idx="{idx}"]')
            await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill(str(reps))
            if check: await row.locator('.check').click()
            else: await row.locator('[data-f="reps"]').dispatch_event('change')
            await pg.wait_for_timeout(700)
        last_set_write = lambda pg, idx: pg.evaluate(f"(window.__writes||[]).filter(w => w[0]==='sets' && w[1].set_index=={idx}).map(w => w[1]).at(-1) || null")
        problems = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('wl_pending_sets_v1:failed:u1') || '[]')")
        queued = lambda pg: pg.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1') || '{}'))")

        # 1) saves say what they were edited from; a new set learns its server id
        pg=await newpage()
        await edit(pg, 2, 9)
        w=await last_set_write(pg, 2)
        ok('editing a loaded set sends based_on = its server row', w and w.get('based_on')=='s2', w)
        await edit(pg, 3, 10, check=True)
        w=await pg.evaluate("(window.__writes||[]).filter(w => w[0]==='sets' && w[1].set_index==3).map(w => w[1])[0] || null")
        ok('a brand-new set is first sent with no based_on', w and w.get('based_on') is None, w)
        sid=await pg.locator('.card[data-we="w1"] .set[data-idx="3"]').get_attribute('data-sid')
        ok('after saving, the row learns its server id', sid=='new-3', sid)
        await edit(pg, 3, 11)
        w=await last_set_write(pg, 3)
        ok('the next edit of that set is based on it', w and w.get('based_on')=='new-3', w)
        await pg.context.close()

        # 2) the server skips a copy edited from a set removed on another phone → shown, not lost, not retried
        pg=await newpage()
        await pg.evaluate("() => { window.__GUARD = (p) => p.based_on === 's2'; }")
        await edit(pg, 2, 12)
        ops=await pg.evaluate("(window.__ops||[]).filter(o => o[1]==='sets').map(o => o[0])")
        ok('server skipped it (no write)', ops[-1:]==['noop'], ops)
        pr=await problems(pg)
        ok('listed as a sync problem with the reason', any(f.get('set_index')==2 and 'removed on another phone' in f.get('_error','') for f in pr), pr)
        ok('not left waiting to retry', 'w1:2' not in await queued(pg))
        toast=await pg.locator('.toast').all_inner_texts()
        ok('a message says why', any('removed on another phone' in t for t in toast), toast)
        await pg.context.close()

        # 3) same, but the stale copy was made offline and only reaches the server when back online
        pg=await newpage()
        await pg.evaluate("window.__OFFLINE = true"); await edit(pg, 1, 13)
        ok('offline copy waiting', 'w1:1' in await queued(pg))
        await pg.evaluate("() => { window.__GUARD = (p) => p.based_on === 's1'; window.__OFFLINE = false; window.dispatchEvent(new Event('online')); }"); await pg.wait_for_timeout(1500)
        pr=await problems(pg)
        ok('at sync: skipped and listed, nothing left waiting', any(f.get('set_index')==1 for f in pr) and 'w1:1' not in await queued(pg), pr)
        await pg.context.close()

        # 4) a database without the new column (migration not applied yet): saves still go through
        pg=await newpage()
        await pg.evaluate("window.__NOCOL = true")
        await edit(pg, 2, 14)
        w=await last_set_write(pg, 2)
        ok('no based_on column yet: saved without it', w and w.get('based_on') is None and w.get('reps')==14 and 'w1:2' not in await queued(pg), w)
        ok('…and no sync problem', len(await problems(pg))==0)
        await pg.context.close()

        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'SETGUARD212 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
