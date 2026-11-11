"""Security rendering/CSP test in Chromium, no CSP bypass and no external services."""
import asyncio,functools,http.server,threading
from pathlib import Path
from playwright.async_api import async_playwright
from importlib.util import spec_from_file_location,module_from_spec
ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('fixtures',ROOT/'tests/cnc-browser-smoke.py');fixture=module_from_spec(spec);spec.loader.exec_module(fixture)
async def run():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(fixture.QuietHandler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=await browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else r.abort())
   await page.route('**/assets/js/auth.js*',lambda r:r.fulfill(content_type='text/javascript',body=fixture.AUTH_FIXTURE))
   source=(ROOT/'assets/js/app.js').read_text(encoding='utf-8-sig')
   hook="""
   globalThis.securityFixture=record=>{appStarted=true;items=[record];render();switchPage('inventoryPage');document.body.classList.remove('locked');};
   document.body.dataset.testReady='1';
   """
   await page.route('**/assets/js/app.js*',lambda r:r.fulfill(content_type='text/javascript',body=source+hook))
   await page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
   await page.locator('body[data-test-ready="1"]').wait_for(state='attached')
   badid="bad');globalThis.injected=1;//\" autofocus onfocus=\"globalThis.injected=2"
   badname='<img src="x" onerror="globalThis.injected=3">'
   await page.evaluate('(record)=>securityFixture(record)',{'id':badid,'name':badname,'sku':'safe','category':'test','quantity':1,'min':0})
   button=page.locator('[data-cmms-action="openItemDialog"]');assert await button.get_attribute('data-cmms-id')==badid
   assert await page.locator('[onclick],[onerror],[onfocus]').count()==0
   assert await page.locator('#inventoryBody img').count()==0
   await button.click();assert await page.locator('#itemDialog').is_visible();assert await page.locator('#nameInput').input_value()==badname
   assert await page.evaluate('()=>globalThis.injected===undefined')
   # Dynamically inserted inline scripts must be blocked by the real shipped CSP.
   await page.evaluate("()=>{let s=document.createElement('script');s.textContent='globalThis.inlineExecuted=true';document.head.append(s)}")
   assert await page.evaluate('()=>globalThis.inlineExecuted===undefined')
   assert not errors,errors
   await browser.close()
   print('PASS: malicious database identifiers/text remain inert, delegated edit action works, inline scripts blocked by shipped CSP; no external services contacted.')
 finally:server.shutdown()
asyncio.run(run())
