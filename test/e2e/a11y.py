# Automated accessibility check (axe-core, WCAG 2.1 A/AA rules) on every main screen, in dark and light themes.
# Fails on any "serious" or "critical" violation. Needs `npm install --no-save axe-core` in test/ (CI does this).
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
AXE=os.path.join(HERE,'..','node_modules','axe-core','axe.min.js')
if not os.path.exists(AXE): print('a11y.py: axe-core not installed — FAIL'); sys.exit(1)
PORT=int(os.environ.get('PORT','8807'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
SCREENS=['#/','#/workout/d21','#/mesos','#/meso/m1','#/new','#/templates','#/exercises','#/progress','#/progress/e5','#/explore','#/settings','#/learn','#/logic','#/cardio','#/volume','#/history','#/feedback']
R=[]
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        for scheme in ('dark','light'):
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,color_scheme=scheme,bypass_csp=True)   # only so the checker can be injected
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            pg=await ctx.new_page()
            for s in SCREENS:
                await pg.goto(B+s); await pg.wait_for_timeout(900)
                await pg.evaluate("(()=>{const x=document.getElementById('sheet'); if(x){x.hidden=true;x.innerHTML='';}})()")
                await pg.add_script_tag(path=AXE)
                res=await pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r => r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, eg: v.nodes.slice(0,2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary||'').split('\\n').slice(1,2).join(''))})))")
                bad=[v for v in res if v['impact'] in ('serious','critical')]
                R.append(('PASS' if not bad else 'FAIL', f'{scheme} {s}', json.dumps(bad)[:900] if bad else ''))
            await ctx.close()
        await br.close()
    srv.kill()
    for r in R: print(*r)
    print('A11Y TESTS:', 'ALL PASSED' if all(r[0]=='PASS' for r in R) else 'FAILURES')
asyncio.run(main())
