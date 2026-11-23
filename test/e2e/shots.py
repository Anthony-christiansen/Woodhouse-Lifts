"""Before/after screenshots for design PRs: 5 screens × (390px, 1280px) × (dark, light). Usage: python3 shots.py <outdir> [port]"""
import os, sys, asyncio, subprocess
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[1]; PORT = sys.argv[2] if len(sys.argv) > 2 else '8790'
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
MOCK = open(HERE + '/mock-supabase.js').read()
SCREENS = [('home', '#/'), ('workout', '#/workout/d21'), ('mesos', '#/meso/m1'), ('library', '#/exercises'), ('progress', '#/progress/e5'), ('builder', '#/new'), ('templates', '#/templates')]
CLOSE = "(()=>{const s=document.getElementById('sheet'); if(s){s.hidden=true;s.innerHTML='';}})()"
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-sandbox'])
        for scheme in ('dark', 'light'):
            for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'desktop')):
                ctx = await br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, color_scheme=scheme)
                await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
                pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
                for name, hsh in SCREENS:
                    await pg.goto(f'http://localhost:{PORT}/{hsh}'); await pg.wait_for_timeout(1100); await pg.evaluate(CLOSE)
                    await pg.screenshot(path=f'{OUT}/{name}-{tag}-{scheme}.png', full_page=(tag == 'phone'))
                print(scheme, tag, 'errors:', errs)
                await ctx.close()
        await br.close()
    srv.terminate()
asyncio.run(main())
