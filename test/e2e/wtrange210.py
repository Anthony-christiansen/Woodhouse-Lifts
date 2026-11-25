# v1.21.0 (owner request) — each weighted exercise with history shows a small recommended weight range for today:
# one step below last week … the automatic-increase limit (≤ +5 lb). Suggestions, reps and sets are unchanged.
import os, re
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8828'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        errs=[]
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); await pg.add_init_script('window.__FB = []'); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1200)
        card=pg.locator('.card[data-we="w1"]')
        txt=(await card.locator('.wt-range').inner_text()).strip() if await card.locator('.wt-range').count() else ''
        m=re.search(r'Range today ([\d.]+)–([\d.]+) lb', txt)
        ok('card shows "Range today X–Y lb"', bool(m), txt)
        pos=await card.evaluate("c => { const r = c.querySelector('.wt-range'), sets = c.querySelector('.sets'), add = c.querySelector('[data-addset]'); return !!r && !!(sets.compareDocumentPosition(r) & 4) && !!(r.compareDocumentPosition(add) & 4) && r.getBoundingClientRect().height < 30 && r.scrollWidth <= r.clientWidth; }")
        ok('sits under the last set, above + set / − set, on one line, not cut off', pos)
        last=70.0   # mock: last week 70×11, 70×10
        if m:
            lo, hi = float(m.group(1)), float(m.group(2))
            sug = await card.locator('.set').nth(2).locator('[data-f="weight"]').input_value()   # set 3 has no logged value: shows the suggestion
            s = float(sug or last)
            ok('suggested weight is inside the range', lo <= s <= hi, (lo, s, hi))
            ok('top is at most +5 lb over last week', hi - last <= 5, hi)
            ok('bottom is below last week (a lighter day is fine)', lo < last, lo)
        ok('says reps adjust', 'reps adjust' in txt)
        ok('no range on an exercise with no history yet', await pg.locator('.card[data-we="w2"] .wt-range').count()==0)
        # changing the weight inside the range still re-targets reps (existing behaviour, unchanged)
        w=card.locator('.set').nth(2).locator('[data-f="weight"]'); r=card.locator('.set').nth(2).locator('[data-f="reps"]')
        before=await r.get_attribute('placeholder'); await w.fill('65'); await w.dispatch_event('input'); await pg.wait_for_timeout(300)
        after=await r.get_attribute('placeholder')
        ok('lighter weight → suggested reps go up (unchanged behaviour)', before != after, (before, after))
        if SHOTS:
            await card.scroll_into_view_if_needed(); await card.screenshot(path=os.path.join(SHOTS,'card.png'))
        ok('no page errors', not errs, errs[:3])
        await br.close()
    srv.terminate()
    fails=[x for x in R if x[0]=='FAIL']
    for x in R: print(*x)
    print(f'WTRANGE210 {"PASSED" if not fails else "FAILED"} ({len(R)-len(fails)}/{len(R)})')
    sys.exit(1 if fails else 0)
asyncio.run(main())
