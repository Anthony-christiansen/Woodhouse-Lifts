# PR-D safety net: the HTML every main screen renders (mock data) must not change when code is only moved between
# files. First run writes test/e2e/snapshots/*.html (baseline, committed); later runs compare byte for byte after
# normalising things that legitimately vary (today's date, generated label ids, the cache-buster number).
# Usage: python3 test/e2e/render_snapshot.py            → compare (exit 1 on any difference)
#        python3 test/e2e/render_snapshot.py --update   → rewrite the baseline (only when a change is intended)
import os, re, sys, asyncio, subprocess, difflib
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8822'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
SNAP=os.path.join(HERE,'snapshots'); UPDATE='--update' in sys.argv
SCREENS=['#/','#/workout/d21','#/workout/d31','#/workout/d11','#/mesos','#/meso/m1','#/new','#/templates','#/exercises','#/progress','#/progress/e5',
         '#/explore','#/settings','#/learn','#/cardio','#/volume','#/history','#/feedback','#/stats/workouts/2']
def norm(h):
    h=re.sub(r'lbl\d+', 'lblN', h)                      # generated label ids
    h=re.sub(r'\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?', 'DATE', h)
    h=re.sub(r'\b\d{1,2}/\d{1,2}(/\d{2,4})?\b', 'M/D', h)
    h=re.sub(r'<td>\d{2}-\d{2}</td>', '<td>MM-DD</td>', h)   # cardio history dates (made the snapshot fail after midnight UTC)
    h=re.sub(r'\?v=\d+', '?v=N', h)
    h=re.sub(r'Woodhouse Lifts \d+\.\d+\.\d+', 'Woodhouse Lifts X.Y.Z', h)   # the version shown in Settings
    return h
bad=[]
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1,timezone_id='America/Denver')
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        await ctx.add_init_script("localStorage.setItem('wl_warmup_seen','1'); Date.now = (n => () => n)(Date.parse('2026-11-24T18:00:00Z'));")
        for h in SCREENS:
            pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(B+h); await pg.wait_for_timeout(1300)
            html=norm(await pg.evaluate("document.getElementById('app').innerHTML + '\\n<!--title-->' + document.getElementById('title').textContent"))
            name=re.sub(r'[^a-z0-9]+','_',h.lower()).strip('_') or 'home'
            f=os.path.join(SNAP, name+'.html')
            if errs: bad.append((h, 'page errors: '+'; '.join(errs)))
            if UPDATE or not os.path.exists(f): open(f,'w').write(html)
            else:
                old=open(f).read()
                if old!=html: bad.append((h, ''.join(list(difflib.unified_diff(old.splitlines(1), html.splitlines(1), 'baseline', 'now', n=1))[:40])))
            await pg.close()
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for h,d in bad: print('DIFF', h, '\n', d)
print('RENDER SNAPSHOT', 'UPDATED' if UPDATE else ('FAILED' if bad else 'PASSED'), f'({len(SCREENS)} screens)')
sys.exit(1 if bad and not UPDATE else 0)
