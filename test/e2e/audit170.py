# v1.17.0 — the three remaining audit items: early light week (suggested from ratings, your call), estimated
# indirect sets in the builder (optional, labelled), and goal labels/transition notes (athletic = experimental).
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8818'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
FB="""window.__DONE_THROUGH = 2; window.__FB = [
  { muscle_group: 'Quads', soreness: 3, joint_pain: 0, performance: 0, workout_days: { week: 1, mesocycle_id: 'm1' } },
  { muscle_group: 'Chest', soreness: 3, joint_pain: 0, performance: -1, workout_days: { week: 2, mesocycle_id: 'm1' } },
  { muscle_group: 'Back', soreness: 2, joint_pain: 0, performance: -1, workout_days: { week: 2, mesocycle_id: 'm1' } },
  { muscle_group: 'Quads', soreness: 1, joint_pain: 0, performance: 1, workout_days: { week: 2, mesocycle_id: 'm1' } }];"""
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        async def newpage(init=''):
            ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
            await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
            if init: await ctx.add_init_script(init)
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        errs=[]
        # no fatigue signs → no card
        pg=await newpage("window.__DONE_THROUGH = 2; window.__FB = [];")
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1200)
        ok('no card without fatigue signs', await pg.locator('#fatigueCard').count()==0)
        await pg.context.close()
        # signs in weeks 2 and 3 → card; Not now hides it for this week
        pg=await newpage(FB)
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1200)
        card=pg.locator('#fatigueCard')
        ok('fatigue card shows, with the reason', await card.count()==1 and 'Chest' in await card.inner_text() and 'week 2' in await card.inner_text() and 'Chest and Back' in await card.inner_text())
        ok('says it is a rule of thumb, not a diagnosis', 'not a diagnosis' in await card.inner_text())
        if SHOTS: await card.screenshot(path=os.path.join(SHOTS,'fatigue-card.png'))
        await pg.click('#fatigueNo'); await pg.wait_for_timeout(300)
        await pg.goto(B+'#/mesos'); await pg.goto(B+'#/'); await pg.wait_for_timeout(1000)
        ok('Not now: hidden for this week', await pg.locator('#fatigueCard').count()==0)
        await pg.context.close()
        # Take it now → confirm → start_light_week RPC
        pg=await newpage(FB)
        await pg.goto(B+'#/'); await pg.wait_for_timeout(1200)
        await pg.click('#fatigueYes'); await pg.wait_for_timeout(800)
        sh=await pg.inner_text('#sheet')
        ok('confirm explains what changes (v1.17.1 preview sheet)', 'Take the light week now?' in sh and '5 → 3 weeks' in sh and '8 planned workouts' in sh, sh[:300])
        await pg.click('#lwGo'); await pg.wait_for_timeout(600)
        rpc=await pg.evaluate("(window.__rpcs||[]).filter(r=>r.fn==='start_light_week')")
        ok('calls start_light_week once for this meso, with the preview revision', len(rpc)==1 and rpc[0]['args']=={'p_meso':'m1','p_revision':0}, rpc)
        await pg.context.close()
        # meso page: manual option; declining the confirm changes nothing
        pg=await newpage("window.__DONE_THROUGH = 2;")
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(1000)
        ok('meso page offers it from week 3', 'Take the light week early (week 3)' in await pg.inner_text('main'))
        await pg.click('#lightNow'); await pg.wait_for_timeout(600)
        await pg.click('#lwNo'); await pg.wait_for_timeout(200)
        ok('Cancel changes nothing', not await pg.evaluate("(window.__rpcs||[]).some(r=>r.fn==='start_light_week')"))
        await pg.context.close()
        pg=await newpage()
        await pg.goto(B+'#/meso/m1'); await pg.wait_for_timeout(1000)
        ok('not offered before week 3', await pg.locator('#lightNow').count()==0)
        # builder: goals and indirect sets
        await pg.goto(B+'#/new'); await pg.wait_for_timeout(1000)
        labels=await pg.locator('[data-goal]').all_inner_texts()
        ok('goal buttons: Hypertrophy / Strength / Athletic*', labels==['Hypertrophy','Strength','Athletic*'], labels)
        ok('full names for screen readers', await pg.get_attribute('[data-goal="athletic"]','aria-label')=='Athleticism (experimental)')
        await pg.click('[data-goal="athletic"]'); await pg.wait_for_timeout(200)
        ok('athletic explains it is experimental', 'Experimental' in await pg.inner_text('main'))
        await pg.click('[data-goal="hypertrophy"]')
        await pg.fill('#name','Test'); await pg.click('#next'); await pg.wait_for_timeout(800)
        before=await pg.locator('.chip .ind').count()
        await pg.check('#showInd'); await pg.wait_for_timeout(300)
        inds=await pg.locator('.chip .ind').all_inner_texts()
        ok('indirect estimate is off by default, then shown on helpers', before==0 and len(inds)>0, inds)
        ok('labelled as an estimate', 'not a measured dose' in await pg.inner_text('main'))
        if SHOTS: await pg.locator('.card:has(#showInd)').screenshot(path=os.path.join(SHOTS,'indirect.png'))
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.17.0 AUDIT UI TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
