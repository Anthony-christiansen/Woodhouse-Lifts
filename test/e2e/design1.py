"""PR 1 (design foundations) regression checks: icons, type floor, tap targets, themes, chart/tile/library fixes."""
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, re
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8797','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B='http://localhost:8797/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
CLOSE="(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true;s.innerHTML='';}})()"
EMOJI=re.compile('[\U0001F300-\U0001FAFF⚙⚠★☆✕ⓘ⇄⤴⏸↗⬆♥⦸✎]')
SCREENS=['#/','#/workout/d21','#/meso/m1','#/exercises','#/progress/e5','#/new','#/explore','#/settings','#/learn','#/history','#/cardio','#/volume']
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        for h in SCREENS:
            await pg.goto(B+h); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
            txt=await pg.evaluate("document.body.innerText")
            em=EMOJI.findall(txt); ok(f'{h}: no emoji used as icons', not em, em[:5])
            small=await pg.evaluate("""[...document.querySelectorAll('body *')].filter(el=>{const t=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
              if(!t||!el.offsetParent) return false; return parseFloat(getComputedStyle(el).fontSize)<12.5}).map(el=>el.tagName+':'+el.textContent.trim().slice(0,20)).slice(0,5)""")
            ok(f'{h}: no text under 13px', not small, small)
            unlabeled=await pg.evaluate("""[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&!b.innerText.trim()&&!b.getAttribute('aria-label')&&!b.title).map(b=>b.outerHTML.slice(0,80)).slice(0,3)""")
            ok(f'{h}: icon-only buttons have labels', not unlabeled, unlabeled)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900); await pg.evaluate(CLOSE)
        sizes=await pg.evaluate("[...document.querySelectorAll('[data-info],[data-replace]')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
        ok('info/swap tap targets ≥ 44px', sizes and all(w>=44 and h>=44 for w,h in sizes), sizes[:4])
        # home: chart labels inside the SVG, no NaN bars, equal stat tiles
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1000)
        ys=await pg.evaluate("[...document.querySelectorAll('svg.chart text')].filter(t=>t.textContent.trim()&&!t.textContent.includes('/')).map(t=>+t.getAttribute('y'))")
        ok('chart value labels never clipped (y ≥ 10)', ys and min(ys)>=10, ys)
        nan=await pg.evaluate("[...document.querySelectorAll('svg.chart rect.cbar')].some(r=>/NaN/.test(r.getAttribute('height')+r.getAttribute('y')))")
        ok('no NaN chart bars', not nan)
        hs=await pg.evaluate("[...document.querySelectorAll('.stat-grid > .card.stat')].map(b=>Math.round(b.getBoundingClientRect().height))")
        ok('4 equal-height stat tiles', len(hs)==4 and len(set(hs))==1, hs)
        ok('brand mark in home header', await pg.locator('header .brand-mark').count()==1)
        # library: every row inside its card
        await pg.goto(B+'#/exercises'); await pg.wait_for_timeout(900)
        a=await pg.evaluate("document.querySelectorAll('.exrow').length"); b=await pg.evaluate("document.querySelectorAll('.card .exrow').length")
        ok('library: all rows inside the card', a>0 and a==b, (a,b))
        # theme picker
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(900)
        await pg.click('[data-theme-pick="light"]'); await pg.wait_for_timeout(150)
        ok('theme: light applied', await pg.evaluate("document.documentElement.dataset.theme")=='light')
        bg=await pg.evaluate("getComputedStyle(document.body).backgroundColor"); ok('theme: light background', bg=='rgb(243, 244, 246)', bg)
        await pg.reload(); await pg.wait_for_timeout(900)
        ok('theme: remembered after reload', await pg.evaluate("document.documentElement.dataset.theme")=='light')
        await pg.click('[data-theme-pick="system"]'); await pg.wait_for_timeout(100)
        ok('theme: back to phone setting', await pg.evaluate("!document.documentElement.dataset.theme"))
        # v1.13.1: one-tap Dark <-> Normal switch in the header, on any screen, and it stays after a reload
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(900)
        ok('header switch shown on a workout', await pg.is_visible('#themeBtn'))
        before=await pg.evaluate("document.documentElement.dataset.theme || 'system'")
        await pg.click('#themeBtn'); await pg.wait_for_timeout(150)
        t1=await pg.evaluate("document.documentElement.dataset.theme")
        await pg.click('#themeBtn'); await pg.wait_for_timeout(150)
        t2=await pg.evaluate("document.documentElement.dataset.theme")
        ok('header switch flips Dark <-> Normal', {t1,t2}=={'dark','light'}, (before,t1,t2))
        lbl=await pg.get_attribute('#themeBtn','aria-label')
        ok('switch says what it will do', ('dark' in lbl) if t2=='light' else ('normal' in lbl), lbl)
        await pg.reload(); await pg.wait_for_timeout(900)
        ok('switch choice remembered', await pg.evaluate("document.documentElement.dataset.theme")==t2)
        await pg.goto(B+'#/settings'); await pg.wait_for_timeout(700)
        ok('Settings shows Normal, selected to match', await pg.inner_text(f'[data-theme-pick="{t2}"]') in ('Dark','Normal') and await pg.get_attribute(f'[data-theme-pick="{t2}"]','aria-checked')=='true')
        ok('no JS errors', not errs, errs)
        await br.close()
    srv.terminate()
    for r in R: print(*[str(x)[:220] for x in r])
    print('DESIGN PR1 TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
import sys as _sys
_sys.exit(0 if R and all(r[0]=='PASS' for r in R) else 1)   # v1.15.1: CI goes by the exit code
