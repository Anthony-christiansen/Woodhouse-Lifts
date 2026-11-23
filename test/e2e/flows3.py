import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8771','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); BASE='http://localhost:8771/'
R=[]
def ok(name, cond, extra=''): R.append(('PASS' if cond else 'FAIL', name, extra))
async def mk(br, mock=MOCK, w=360):
    ctx=await br.new_context(viewport={'width':w,'height':900},is_mobile=True,has_touch=True)
    await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=mock))
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); return ctx,pg,errs
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        # --- offline save queue
        ctx,pg,errs=await mk(br)
        await pg.goto(BASE+'#/workout/d21'); await pg.wait_for_timeout(700)
        card=pg.locator('[data-we="w3"]'); row=card.locator('.set').first
        await row.locator('[data-f="weight"]').fill('200'); await row.locator('[data-f="reps"]').fill('8')
        await pg.evaluate('window.__FAIL_NET = true')
        await row.locator('.check').click(); await pg.wait_for_timeout(300)
        cls=await row.get_attribute('class'); q=await pg.evaluate("JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1')||'{}')")
        ok('offline: row marked queued + done', 'queued' in cls and 'done' in cls, cls)
        ok('offline: set kept on phone', len(q)==1 and list(q.values())[0]['weight']==200, json.dumps(q))
        ok('offline: sync badge shown', await pg.is_visible('#syncBadge'))
        await ctx.add_init_script("window.__FAIL_NET = sessionStorage.getItem('failnet') === '1'")
        await pg.evaluate("sessionStorage.setItem('failnet','1')")
        await pg.reload(); await pg.wait_for_timeout(700)
        row=pg.locator('[data-we="w3"] .set').first
        v=await row.locator('[data-f="weight"]').input_value(); c=await row.get_attribute('class')
        ok('offline: survives reload (still offline)', v=='200' and 'queued' in c and 'done' in c, (v,c))
        await pg.evaluate("sessionStorage.removeItem('failnet'); window.__FAIL_NET = false; window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(600)
        q=await pg.evaluate("JSON.parse(localStorage.getItem('wl_pending_sets_v1:u1')||'{}')")
        ok('online: queue flushed + badge gone', q=={} and not await pg.is_visible('#syncBadge'))
        # unchanged re-save is skipped
        n0=len(await pg.evaluate('window.__writes||[]'))
        await row.locator('[data-f="reps"]').dispatch_event('change'); await pg.wait_for_timeout(200)
        ok('no request when nothing changed', len(await pg.evaluate('window.__writes||[]'))==n0)
        ok('no JS errors (workout)', not errs, errs)
        await ctx.close()
        # --- kg display + conversion on save
        ctx,pg,errs=await mk(br, MOCK.replace("unit: 'lb', bodyweight: 200","unit: 'kg', bodyweight: 200"))
        await pg.goto(BASE+'#/workout/d21'); await pg.wait_for_timeout(700)
        w=await pg.locator('[data-we="w1"] .set').first.locator('[data-f="weight"]').input_value()
        ok('kg: 70 lb shown as 31.75 kg', w=='31.75', w)
        r2=pg.locator('[data-we="w3"] .set').first
        await r2.locator('[data-f="weight"]').fill('100'); await r2.locator('[data-f="reps"]').fill('8'); await r2.locator('.check').click(); await pg.wait_for_timeout(300)
        wr=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='sets']
        ok('kg: 100 kg stored as 220.46 lb', wr and wr[-1][1]['weight']==220.46, wr[-1] if wr else None)
        await pg.goto(BASE+'#/settings'); await pg.wait_for_timeout(500)
        ok('kg: bodyweight 200 lb shown as 90.7 kg', await pg.input_value('#bw')=='90.7')
        await pg.click('#save'); await pg.wait_for_timeout(300)
        pw=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='profiles']
        ok('unchanged bodyweight keeps exact stored value', pw and pw[-1][1]['bodyweight']==200, pw[-1] if pw else None)
        ok('no JS errors (kg)', not errs, errs); await ctx.close()
        # --- builder: goal + preferences + atomic create
        ctx,pg,errs=await mk(br, MOCK.replace("equipment: null, avoid_tags: []","equipment: null, avoid_tags: ['axial']"))
        await pg.goto(BASE+'#/new'); await pg.wait_for_timeout(600)
        await pg.click('[data-goal="strength"]'); await pg.wait_for_timeout(100)
        t=await pg.inner_text('main')
        ok('builder: strength effort schedule never 0', 'Effort (main lifts) by week, as reps short of failure: 3 → 2 → 1 → 1 → light' in t, t[t.find('Effort'):t.find('Effort')+110])
        await pg.fill('#name','Test strength'); await pg.click('#next'); await pg.wait_for_timeout(400)
        t=await pg.inner_text('main')
        ok('builder: preference note shown', 'skipping' in t)
        opts=await pg.evaluate("[...document.querySelectorAll('select option')].map(o=>o.textContent)")
        ok('builder: axial lifts not offered', not any('Back Squat' in o or 'Hack Squat' in o for o in opts))
        await pg.click('#create'); await pg.wait_for_timeout(500)
        rpc=await pg.evaluate("window.__lastRpc||null")
        ok('create: goes to meso page', '#/meso/m1' in pg.url, pg.url)
        ok('no JS errors (builder)', not errs, errs); await ctx.close()
        # --- settings prefs + library
        ctx,pg,errs=await mk(br)
        await pg.goto(BASE+'#/settings'); await pg.wait_for_timeout(500)
        await pg.check('#avoidAxial'); await pg.uncheck('input[name=eq][value="Barbell"]'); await pg.click('#savePrefs'); await pg.wait_for_timeout(300)
        pw=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='profiles']
        ok('prefs saved', pw and pw[-1][1]['avoid_tags']==['axial'] and 'Barbell' not in pw[-1][1]['equipment'], pw[-1] if pw else None)
        await pg.goto(BASE+'#/exercises'); await pg.wait_for_timeout(500)
        ok('library: spinal-load tag visible', 'spinal load' in await pg.inner_text('main'))
        await pg.locator('[data-fav]').first.click(); await pg.wait_for_timeout(300)
        pw=[x for x in await pg.evaluate('window.__writes||[]') if x[0]=='exercise_prefs']
        ok('library: favorite saved', pw and pw[-1][1]['pref']=='favorite', pw[-1] if pw else None)
        ok('no JS errors (prefs)', not errs, errs); await ctx.close()
        # --- auth a11y
        ctx,pg,errs=await mk(br, open(HERE+'/mock-auth.js').read())
        await pg.goto(BASE); await pg.wait_for_timeout(500)
        lab=await pg.evaluate("[...document.querySelectorAll('main label[for]')].every(l=>document.getElementById(l.htmlFor))")
        ok('auth: labels bound to inputs', lab)
        ok('auth: tagline', 'Track your workouts. Measure your progress. Get stronger.' in await pg.inner_text('main'))
        await pg.click('#swap'); await pg.wait_for_timeout(150)
        ok('auth: password rules shown on sign-up', 'At least 8 characters' in await pg.inner_text('main'))
        await pg.fill('#a-name','X'); await pg.fill('#a-email','bad'); await pg.fill('#a-pw','short'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(150)
        ok('auth: invalid email flagged', await pg.get_attribute('#a-email','aria-invalid')=='true')
        ok('no JS errors (auth)', not errs, errs); await ctx.close()
        await br.close()
    srv.terminate()
    for r in R: print(*r)
    print('FLOW TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
