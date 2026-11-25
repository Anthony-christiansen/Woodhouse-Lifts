# v1.20.8 (audit 1.20.4 finding 1) — the summary, the sync badge and Settings give ONE honest answer about saving:
# memory-only (phone refused the offline copy) · saving (in flight) · on this phone · synced · refused (with a fix path).
import os, json
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8823'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
SUMMARY={'at':0,'since':'2000-01-01T00:00:00Z','dayId':'d21','mesoId':'m1','title':'Week 2 · Full body A','queued':False,'next':None,'mesoName':'Meso A',
  'lifts':[{'name':'Incline Dumbbell Press','muscle':'Chest','done':3,'planned':3,'best':{'w':70,'r':11},'last':{'w':70,'r':10},'trend':1,'change':None}],'cardio':[],'muscles':[{'m':'Chest','perf':1}]}
async def log_set(pg, idx, w, r):
    row=pg.locator('.card[data-we="w1"] .set').nth(idx)
    await row.locator('[data-f="weight"]').fill(str(w)); await row.locator('[data-f="reps"]').fill(str(r))
    if await row.evaluate("e => e.classList.contains('done')"): await row.locator('[data-f="reps"]').dispatch_event('change')
    else: await row.locator('.check').click()
async def sync_text(pg): return (await pg.inner_text('#sumSync')).strip() if await pg.locator('#sumSync').count() else ''
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        async def newpage():
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        async def to_summary(pg):
            await pg.evaluate("s => sessionStorage.setItem('wl_summary', s)", json.dumps(SUMMARY))
            await pg.evaluate("location.hash = '#/summary'"); await pg.wait_for_timeout(500)

        # 1) synced: nothing waiting, nothing in flight
        pg=await newpage(); await pg.goto(B+'#/'); await pg.wait_for_timeout(900)
        await to_summary(pg)
        ok('synced: says so', (await sync_text(pg)).endswith('Saved and synced.'), await sync_text(pg))
        await pg.context.close()

        # 2) saving: a set save is still on its way → "Saving…", then "Saved and synced." once it lands
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await pg.evaluate("window.__DELAY = (t) => t === 'sets' ? 4000 : 0")
        await log_set(pg, 2, 70, 10); await pg.wait_for_timeout(200)
        await to_summary(pg)
        t1=await sync_text(pg)
        ok('in flight: says Saving… (copy on the phone), never synced', 'Saving' in t1 and 'a copy is already on this phone' in t1 and 'synced' not in t1, t1)
        await pg.wait_for_timeout(4800)
        t2=await sync_text(pg)
        ok('after it lands: updates by itself to synced', t2.endswith('Saved and synced.'), t2)
        await pg.context.close()

        # 3) offline, stored on the phone → "Saved on this phone"
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await pg.evaluate("window.__OFFLINE = true")
        await log_set(pg, 2, 70, 10); await pg.wait_for_timeout(500)
        await to_summary(pg); await pg.wait_for_timeout(1500)   # the retry on opening a page settles; the line updates itself
        t=await sync_text(pg)
        ok('offline + stored: "Saved on this phone"', 'Saved on this phone' in t and 'Not saved' not in t, t)
        await pg.context.close()

        # 4) offline AND the phone refuses storage (QuotaExceededError) → NOT saved on this phone, keep the app open
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await pg.evaluate("""() => { window.__OFFLINE = true;
          const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (this === localStorage) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); }; return 1; }""")
        await log_set(pg, 2, 70, 10); await pg.wait_for_timeout(600)
        await to_summary(pg)
        t=await sync_text(pg)
        ok('memory only: says NOT saved on this phone + keep it open', 'Not saved on this phone yet' in t and 'Keep it open' in t and 'Saved on this phone —' not in t, t)
        badge=await pg.inner_text('#syncBadge') if await pg.locator('#syncBadge').count() else ''
        ok('badge gives the same answer', 'NOT saved on this phone' in badge, badge)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'summary-memory.png'))
        # back online: it syncs and the line says so (the copy was in memory the whole time)
        await pg.evaluate("window.__OFFLINE = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(2500)
        t=await sync_text(pg)
        ok('memory only → back online: synced', t.endswith('Saved and synced.'), t)
        await pg.context.close()

        # 5) refused by the server → summary says so with a link; Settings lists it; Clear empties it
        pg=await newpage(); await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1100)
        await pg.evaluate("window.__REFUSE = (t) => t === 'sets'")
        await log_set(pg, 2, 70, 10); await pg.wait_for_timeout(700)
        await to_summary(pg)
        t=await sync_text(pg)
        ok('refused: summary says refused + kept aside, not lost (once per set)', '1 change was refused by the server' in t and 'not lost' in t, t)
        ok('refused: has a fix link', await pg.locator('#sumFix').count()==1)
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'summary-refused.png'))
        await pg.click('#sumFix'); await pg.wait_for_timeout(900)
        st=await pg.inner_text('main')
        ok('Settings: Sync problems card lists the set', 'Sync problems' in st and 'Set 3' in st and '70 lb × 10 reps' in st and 'sets_reps_check' in st, st[:400])
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,'settings-sync-problems.png'))
        await pg.click('#clearFailed'); await pg.wait_for_timeout(700)
        ok('Clear the list removes the card', 'Sync problems' not in await pg.inner_text('main'))
        # an old refusal (before this workout) doesn't colour today's summary
        await pg.evaluate("window.__REFUSE = null")
        await pg.context.close()

        # 6) refusals from before this workout don't make today's summary say refused
        pg=await newpage(); await pg.goto(B+'#/'); await pg.wait_for_timeout(900)
        await pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('wl_pending_sets_v1:failed:')).forEach(k => localStorage.removeItem(k))")
        await pg.evaluate("localStorage.setItem('wl_pending_sets_v1:failed:u1', JSON.stringify([{set_index: 1, reps: 5, _error: 'old', _at: '1999-01-01T00:00:00Z'}]))")
        await to_summary(pg)
        t=await sync_text(pg)
        ok('old refusals: summary not marked refused', 'refused' not in t, t)
        await pg.context.close()

        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[r for r in R if r[0]=='FAIL']
    for r in R: print(*r)
    print(f'SAVESTATE208 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
