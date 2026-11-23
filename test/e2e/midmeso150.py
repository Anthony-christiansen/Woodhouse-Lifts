# v1.15.0 — add an exercise during a meso (today / today + later weeks), remove an unlogged one,
# the RIR dropdown's number no longer sits on its arrow, and More → Send feedback.
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8815'))
srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-supabase.js').read(); B=f'http://localhost:{PORT}/'
R=[]
def ok(n,c,x=''): R.append(('PASS' if c else 'FAIL',n,x))
SHOTS=os.environ.get('SHOTS')
ROWS="(t,k)=>(window.__rows||[]).filter(r=>r[0]===t&&r[1]===k).map(r=>r[2])"
async def close_sheets(pg):
    for _ in range(4):
        if await pg.locator('.sheet:not([hidden]) [data-skip], .sheet:not([hidden]) .sheet-x').count()==0: break
        await pg.locator('.sheet:not([hidden]) [data-skip], .sheet:not([hidden]) .sheet-x').first.click(); await pg.wait_for_timeout(200)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
        errs=[]
        pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1200)
        await pg.evaluate("window.closeSheet ? closeSheet() : document.getElementById('sheet').hidden=true")
        # RIR dropdown: text and arrow don't overlap (text box ends before the arrow starts)
        sel=pg.locator('[data-rir1]').first
        geo=await sel.evaluate("""e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect();
          const pr = parseFloat(cs.paddingRight); const pos = cs.backgroundPosition.split(',').map(x => x.trim());
          const m = pos[0].match(/calc\\(100% - (\\d+(?:\\.\\d+)?)px\\)/); const arrowLeftFromRight = m ? parseFloat(m[1]) + 5 : 0;
          return { pr, arrowLeftFromRight, w: r.width }; }""")
        ok('RIR dropdown text stops before the arrow', geo['pr'] >= geo['arrowLeftFromRight'] + 3, geo)
        if SHOTS: await sel.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200); await pg.locator('.rir1').first.screenshot(path=os.path.join(SHOTS,'rir-dropdown.png'))
        # Add exercise
        ok('Add an exercise button shown', await pg.locator('#addEx').count()==1)
        await pg.click('#addEx'); await pg.wait_for_timeout(500)
        await pg.select_option('#axMuscle','Quads'); await pg.wait_for_timeout(200)
        names=await pg.locator('[data-ax-id]').all_inner_texts()
        ok('already-in-today exercises not offered', not any('Hack Squat' in n for n in names) and any('Leg Extension' in n for n in names), names)
        await pg.locator('[data-ax-id]', has_text='Leg Extension').click(); await pg.wait_for_timeout(200)
        await pg.select_option('#axSets','2')
        if SHOTS: await pg.locator('#sheet .panel').screenshot(path=os.path.join(SHOTS,'add-exercise.png'))
        await pg.click('[data-ax="future"]'); await pg.wait_for_timeout(800)
        ins=await pg.evaluate(f"({ROWS})('workout_exercises','insert')")
        today=ins[0] if ins else {}
        ok('adds today with the chosen sets', today.get('workout_day_id')=='d21' and today.get('exercise_id')=='e6' and today.get('target_sets')==2 and today.get('position')==6, today)
        ok('target effort follows this week', today.get('target_rir') is not None, today)
        later=ins[1] if len(ins)>1 else []
        ok('adds to every later week of this day', isinstance(later,list) and sorted(r['workout_day_id'] for r in later)==['d31','d41','d51'], later)
        ok('light week gets half the sets', any(r['workout_day_id']=='d51' and r['target_sets']==1 for r in later), later)
        # Remove an unlogged exercise (Pull-Up has no sets)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        await pg.click('[data-replace="w2"]'); await pg.wait_for_timeout(400)
        ok('remove offered when nothing logged', await pg.locator('#rpRemove').count()==1)
        pg.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.click('#rpRemove'); await pg.wait_for_timeout(500)
        dels=await pg.evaluate("(window.__deletes||[]).filter(d=>d[0]==='workout_exercises')")
        ok('removes just that exercise from today', dels and ['id','w2'] in dels[-1][1], dels)
        await pg.evaluate("document.getElementById('sheet').hidden=true")
        await pg.click('[data-replace="w1"]'); await pg.wait_for_timeout(400)
        ok('no remove when sets are logged', await pg.locator('#rpRemove').count()==0)
        # Feedback
        await pg.goto(B+'#/explore'); await pg.wait_for_timeout(500)
        ok('More lists Send feedback', await pg.locator('[data-go="#/feedback"]').count()==1)
        await pg.goto(B+'#/workout/d21'); await pg.wait_for_timeout(500); await pg.goto(B+'#/feedback'); await pg.wait_for_timeout(700)
        ok('Send is off until a rating or note', await pg.is_disabled('#fbSend'))
        await pg.click('[data-star="4"]'); await pg.click('[data-kind="bug"]'); await pg.fill('#fbMsg','RIR arrow overlaps')
        ok('stars show 4 picked', await pg.locator('[data-star][aria-pressed="true"]').count()==4)
        if SHOTS: await pg.locator('main .card').first.screenshot(path=os.path.join(SHOTS,'feedback.png'))
        await pg.click('#fbSend'); await pg.wait_for_timeout(500)
        fb=(await pg.evaluate(f"({ROWS})('app_feedback','insert')") or [{}])[-1]
        ok('sends rating, kind, note, version, screen', fb.get('rating')==4 and fb.get('kind')=='bug' and fb.get('message')=='RIR arrow overlaps' and fb.get('app_version') and fb.get('screen')=='workout', fb)
        await pg.evaluate("window.__NO_FEEDBACK = true"); await pg.goto(B+'#/explore'); await pg.goto(B+'#/feedback'); await pg.wait_for_timeout(500)
        ok('before the table exists: says so, Send stays off', 'isn’t switched on yet' in await pg.inner_text('main') and await pg.is_disabled('#fbSend'))
        ok('no page errors', not errs, errs)
        await br.close()
try: asyncio.run(main())
finally: srv.terminate()
for r in R: print(*r)
bad=[r for r in R if r[0]=='FAIL']
print('V1.15.0 MID-MESO + FEEDBACK TESTS', 'FAILED' if bad else 'PASSED', f'({len(R)-len(bad)}/{len(R)})')
sys.exit(1 if bad else 0)
