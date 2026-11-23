import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys, os, json
from playwright.async_api import async_playwright
ROOT=ROOT
srv=subprocess.Popen([sys.executable,'-m','http.server','8765','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read()
DEVICES={'iPhoneSE_320':(320,568),'Galaxy_360':(360,780),'iPhone15_393':(393,852),'Pixel_412':(412,915)}
PAGES=['#/progress/e5/all','#/learn','#/learn/hypertrophy','#/learn/strength','#/learn/muscles','#/learn/reps','#/learn/cardio','#/','#/workout','#/mesos','#/meso/m1','#/workout/d21','#/library','#/templates','#/new','#/new#step2','#/cardio','#/explore','#/volume','#/progress','#/progress/e5','#/settings','#/history']
async def main():
    os.makedirs(HERE+'/shots',exist_ok=True); problems=[]
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        for dev,(w,h) in DEVICES.items():
            ctx=await br.new_context(viewport={'width':w,'height':h},device_scale_factor=2,is_mobile=True,has_touch=True,
                user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            page=await ctx.new_page(); errs=[]
            page.on('pageerror', lambda e: errs.append(str(e)))
            for pg in PAGES:
                step2 = pg.endswith('#step2'); url='http://localhost:8765/'+(pg.replace('#step2',''))
                await page.goto(url); await page.wait_for_timeout(500)
                if step2:
                    await page.fill('#name','Test'); await page.click('#next'); await page.wait_for_timeout(300)
                r=await page.evaluate('''() => {
                  const vw = innerWidth, over = [];
                  document.querySelectorAll('main *, nav *').forEach(el => { const b = el.getBoundingClientRect();
                    if (b.width && (b.right > vw + 1 || b.left < -1) && !el.closest('.weeks-scroll')) over.push(el.tagName + '.' + el.className + ' ' + Math.round(b.right)); });
                  const smallInputs = [...document.querySelectorAll('input,select,textarea')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).length;
                  const tinyTargets = [...document.querySelectorAll('main button, nav a')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 36; }).map(e => e.textContent.trim().slice(0,20));
                  return { err: document.querySelector('main').innerText.includes('Something went wrong') ? document.querySelector('main').innerText.slice(0,200) : '', scrollW: document.documentElement.scrollWidth, vw, over: over.slice(0,5), smallInputs, tinyTargets: tinyTargets.slice(0,6), text: document.querySelector('main').innerText.slice(0,60) };
                }''')
                name=f"{dev}_{pg.replace('#/','').replace('/','-').replace('#','') or 'home'}"
                await page.screenshot(path=HERE+f'/shots/{name}.png', full_page=True)
                bad = r['err'] or r['scrollW']>r['vw'] or r['over'] or r['smallInputs'] or r['tinyTargets']
                if bad: problems.append((name,r))
            if errs: problems.append((dev+' JS errors',errs[:3]))
            await ctx.close()
        await br.close()
    srv.terminate()
    print(json.dumps(problems,indent=1)[:6000] if problems else 'NO LAYOUT PROBLEMS')
    return problems
import sys as _sys
_sys.exit(1 if asyncio.run(main()) else 0)   # v1.15.1: CI goes by the exit code
