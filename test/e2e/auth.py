import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
os.makedirs(HERE+'/shots', exist_ok=True)
import asyncio, subprocess, sys, json
from playwright.async_api import async_playwright
ROOT=ROOT
srv=subprocess.Popen([sys.executable,'-m','http.server','8766','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
MOCK=open(HERE+'/mock-auth.js').read()
BASE='http://localhost:8766/'
out=[]
async def ctxpage(br, auth, w=360):
    ctx=await br.new_context(viewport={'width':w,'height':780},is_mobile=True,has_touch=True)
    await ctx.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    await ctx.add_init_script('window.__AUTH='+json.dumps(auth))
    page=await ctx.new_page(); errs=[]; page.on('pageerror', lambda e: errs.append(str(e)))
    return ctx,page,errs
async def text(page): return (await page.inner_text('main'))
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--no-sandbox'])
        # 1+2: sign-up -> check email screen, redirect URL, not logged in
        ctx,page,errs=await ctxpage(br,{}, 320)
        await page.goto(BASE); await page.wait_for_timeout(400)
        await page.click('#swap'); await page.fill('input[name=name]','Test'); await page.fill('input[name=email]','new@example.com'); await page.fill('input[name=password]','longpassword')
        await page.click('button[type=submit]'); await page.wait_for_timeout(300)
        t=await text(page); calls=await page.evaluate('window.__calls'); tabs=await page.evaluate('document.getElementById("tabs").hidden')
        out.append(('signup', 'Check your email to confirm your account' in t, calls[0][1]['options']['emailRedirectTo'], 'tabs hidden', tabs))
        await page.screenshot(path=HERE+'/shots/auth_checkemail_320.png', full_page=True)
        await page.click('#resend'); await page.wait_for_timeout(200)
        calls=await page.evaluate('window.__calls'); out.append(('resend', calls[-1], await page.inner_text('#resend')))
        await page.click('#toSignin'); await page.wait_for_timeout(200)
        out.append(('back prefilled', await page.input_value('input[name=email]')))
        out.append(('errs1',errs)); await ctx.close()
        # 4: sign-in unconfirmed
        ctx,page,errs=await ctxpage(br,{'signIn':{'data':{},'error':{'code':'email_not_confirmed','message':'Email not confirmed','status':400}}})
        await page.goto(BASE); await page.wait_for_timeout(400)
        await page.fill('input[name=email]','new@example.com'); await page.fill('input[name=password]','longpassword')
        await page.click('button[type=submit]'); await page.wait_for_timeout(300)
        t=await text(page); out.append(('unconfirmed', 'Confirm your email first' in t, await page.input_value('input[name=email]')))
        await page.screenshot(path=HERE+'/shots/auth_unconfirmed.png', full_page=True)
        await page.click('#resend'); await page.wait_for_timeout(200); out.append(('resend2', (await page.evaluate('window.__calls'))[-1]))
        # wrong password
        await page.evaluate("window.__AUTH.signIn={data:{},error:{code:'invalid_credentials',message:'Invalid login credentials'}}")
        out.append(('errs4',errs)); await ctx.close()
        # 3: redirect back with session
        ctx,page,errs=await ctxpage(br,{})
        await page.goto(BASE+'#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=signup'); await page.wait_for_timeout(600)
        out.append(('redirect', page.url, await page.evaluate('document.getElementById("tabs").hidden'), await page.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")))
        out.append(('errs3',errs)); await ctx.close()
        # expired link
        ctx,page,errs=await ctxpage(br,{})
        await page.goto(BASE+'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); await page.wait_for_timeout(500)
        t=await text(page); out.append(('expired', 'expired' in t, page.url, '#resend' and await page.is_visible('#resend')))
        await page.screenshot(path=HERE+'/shots/auth_expired.png', full_page=True)
        out.append(('errs5',errs)); await ctx.close()
        await br.close()
    srv.terminate()
    for o in out: print(o)
    bad=[o for o in out if (str(o[0]).startswith('errs') and o[1]) or (o[0]=='expired' and not o[1])]
    print('AUTH TESTS:', 'FAILURES '+str(bad) if bad else 'ALL PASSED'); return bad
import sys as _sys
_sys.exit(1 if asyncio.run(main()) else 0)   # v1.15.1: CI goes by the exit code
