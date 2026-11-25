# v1.20.9 (audit 1.20.4 finding 2) — a set removed with "− set" stays removed: it waits for a save of that set already on
# its way, and a stale copy edited before the delete (this tab or another tab) is dropped instead of re-creating it.
import os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8825'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
# "server" state for one set, replayed from what reached the mock server in order (write = upsert, delete = delete)
EXISTS = """(k) => { const [we, idx] = k.split(':'); let on = null;
  for (const [op, table, x] of (window.__ops || [])) { if (table !== 'sets') continue;
    if (op === 'write' && x.workout_exercise_id === we && String(x.set_index) === idx) on = true;
    if (op === 'delete') { const e = Object.fromEntries((Array.isArray(x) ? x : Object.entries(x)).map(p => Array.isArray(p) ? p : [p.col ?? p[0], p.val ?? p[1]]));
      if (e.workout_exercise_id === we && String(e.set_index) === idx) on = false; } }
  return on; }"""
QKEY="wl_pending_sets_v1:u1"
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newctx():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            return ctx
        async def newpage(ctx):
            pg=await ctx.new_page(); await pg.add_init_script('window.__FB = []')
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100); return pg
        async def edit3(pg, reps):
            row=pg.locator('.card[data-we="w1"] .set[data-idx="3"]')
            await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill(str(reps)); await row.locator('[data-f="reps"]').dispatch_event('change')
        rm = lambda pg: pg.locator('.card[data-we="w1"] [data-rmset]').click()
        exists = lambda pg: pg.evaluate(EXISTS, 'w1:3')
        queued = lambda pg: pg.evaluate(f"() => Object.keys(JSON.parse(localStorage.getItem('{QKEY}') || '{{}}'))")
        nrows = lambda pg: pg.locator('.card[data-we="w1"] .set').count()

        # 1) delete while a sync after reconnecting is still sending that set → the delete waits; the set stays deleted
        ctx=await newctx(); pg=await newpage(ctx)
        await pg.evaluate("window.__OFFLINE = true"); await edit3(pg, 9); await pg.wait_for_timeout(500)
        ok('offline edit is waiting on the phone', 'w1:3' in await queued(pg))
        await pg.evaluate("window.__OFFLINE = false; window.__DELAY = (t) => t === 'sets' ? 1500 : 0; window.dispatchEvent(new Event('online'))")
        await pg.wait_for_timeout(250)        # the sync's upsert is on its way
        await rm(pg); await pg.wait_for_timeout(2600)
        ops=await pg.evaluate("(window.__ops || []).filter(o => o[1] === 'sets').map(o => o[0])")
        ok('in flight: the delete reaches the server AFTER the pending save', ops[-2:]==['write','delete'], ops)
        ok('in flight: the set ends up deleted (not brought back)', await exists(pg) is False, await exists(pg))
        ok('in flight: row removed, nothing left waiting', await nrows(pg)==2 and 'w1:3' not in await queued(pg))
        await ctx.close()

        # 2) another tab still holds an older offline copy of that set → after the delete it is dropped, not sent
        ctx=await newctx(); a=await newpage(ctx); b=await newpage(ctx)
        await b.evaluate("window.__OFFLINE = true"); await edit3(b, 11); await b.wait_for_timeout(500)   # tab B: stale copy
        ok('two tabs: tab B has a copy waiting', 'w1:3' in await queued(b))
        await a.evaluate("""() => { const q = JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1') || '{}'); window.__bcopy = q['w1:3']; }""")
        await rm(a); await a.wait_for_timeout(800)                                      # tab A removes set 3
        # tab A's delete cleared the shared queue; tab B's in-memory edit lives on as the stale copy it would re-send
        await b.evaluate("""(c) => { const q = JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1') || '{}'); q['w1:3'] = c; localStorage.setItem('wl_pending_sets_v1:u1', JSON.stringify(q)); }""", await a.evaluate("window.__bcopy"))
        before=len(await b.evaluate("(window.__ops || []).filter(o => o[1] === 'sets')"))
        await b.evaluate("window.__OFFLINE = false; window.dispatchEvent(new Event('online'))"); await b.wait_for_timeout(1500)
        sent=await b.evaluate("(window.__ops || []).filter(o => o[1] === 'sets' && o[0] === 'write' && o[2].set_index == 3).length")
        ok('two tabs: the stale copy is dropped, not sent', sent==0, sent)
        ok('two tabs: nothing left waiting in tab B', 'w1:3' not in await queued(b))
        await ctx.close()

        # 3) re-adding the set after deleting it works normally (a newer edit isn't blocked by the delete)
        ctx=await newctx(); pg=await newpage(ctx)
        await rm(pg); await pg.wait_for_timeout(600)
        await pg.locator('.card[data-we="w1"] [data-addset]').click(); await pg.wait_for_timeout(300)
        row=pg.locator('.card[data-we="w1"] .set[data-idx="3"]')
        await row.locator('[data-f="weight"]').fill('70'); await row.locator('[data-f="reps"]').fill('10'); await row.locator('.check').click()
        await pg.wait_for_timeout(1200)
        ok('re-added set is saved', await exists(pg) is True, await pg.evaluate("(window.__ops||[]).filter(o=>o[1]==='sets').map(o=>o[0])"))
        await ctx.close()

        # 4) no signal: removing is refused, the row and its waiting copy are kept, and it still syncs later
        ctx=await newctx(); pg=await newpage(ctx)
        await pg.evaluate("window.__OFFLINE = true"); await edit3(pg, 12); await pg.wait_for_timeout(500)
        await rm(pg); await pg.wait_for_timeout(700)
        ok('offline remove: refused, row kept', await nrows(pg)==3)
        ok('offline remove: waiting copy kept', 'w1:3' in await queued(pg))
        await pg.evaluate("window.__OFFLINE = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(1500)
        ok('offline remove: the kept copy syncs once back online (tombstone lifted)', await exists(pg) is True)
        await ctx.close()

        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'SETDELETE209 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
