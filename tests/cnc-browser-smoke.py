"""Browser smoke test using isolated fixtures. Never contacts Firebase or CNC."""
import asyncio
import functools
import http.server
from pathlib import Path
import threading
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
AUTH_FIXTURE = '''
export const initializeSession = async () => {};
export const onSessionChanged = cb => cb(null);
export const signIn = async () => ({});
export const signOutUser = async () => {};
export const sendVerification = async () => {};
export const registerAccount = async () => {};
export const getToken = async () => 'fixture-token';
export const getUser = () => ({uid:'fixture',emailVerified:true});
export const loadProfile = async () => ({});
export const role = () => 'admin';
export const canEdit = () => true;
export const displayName = () => 'Fixture';
'''
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

async def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            page = await browser.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            await page.clock.install()
            await page.route('**/assets/js/auth.js*', lambda route: route.fulfill(status=200, content_type='text/javascript', body=AUTH_FIXTURE))
            # Exercise network-failure freshness independently of an available Firebase server.
            await page.route('https://*.firebasedatabase.app/**', lambda route: route.fulfill(status=503, content_type='application/json', body='{}'))
            source = (ROOT/'assets/js/app.js').read_text(encoding='utf-8-sig')
            hook = '''
window.renderInventoryFixture = records => {items=records;render();switchPage('inventoryPage');document.body.classList.remove('locked')};
window.renderMaintenanceFixture = pageId => {machines=[{id:'fixture-machine',name:'Neway 1260S',model:'VMC',serial:'000123'}];maintenanceJobs=[{id:'fixture-job',machineId:'fixture-machine',machineName:'Neway 1260S',jobName:'Tra dầu',recurrence:'weekly',nextDate:'2026-11-05',owner:'Fixture',desc:'Kiểm tra dầu'}];repairHistory=[{id:'fixture-history',machine:'Neway 1260S',faultTime:'2026-11-05',staff:'Fixture',fault:'Dầu thấp',fix:'Đã bổ sung dầu'}];render();switchPage(pageId);document.body.classList.remove('locked')};
window.exportVoucherFixture = type => {stockMovements=[{id:'voucher-fixture',type,at:'2026-11-05T02:30:00Z',sku:'000123',itemName:'Cảm biến',amount:3,beforeQuantity:10,afterQuantity:type==='in'?13:7,actor:'Fixture',note:'Sửa máy'}];return exportMovementVoucher('voucher-fixture')};
window.renderAlarmFixture = records => {cncAlarmHistory=records;renderCncAlarmsOnly()};
window.renderFixture = (records) => {
  cncs=records; render(); switchPage('cncMonitoringPage');
  document.body.classList.remove('locked');
};
window.startFixturePolling = startCncRealtimeSync;
window.restoreFixtureClock = () => setCncClockOffset(0);
'''
            await page.route('**/assets/js/app.js*', lambda route: route.fulfill(status=200, content_type='text/javascript', body=source+hook))
            await page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
            await page.wait_for_function("typeof window.renderFixture === 'function'")
            await page.evaluate("""renderInventoryFixture([{id:'inventory-fixture',name:'Cảm biến tiệm cận',sku:'000123',category:'Điện',specs:'M18 24VDC',quantity:1,min:2,price:220000,location:'A-01',supplier:'Máy CNC'}])""")
            async with page.expect_download() as inventory_info:
                await page.get_by_role('button',name='Xuất Excel linh kiện',exact=True).click()
            inventory_download=await inventory_info.value
            assert inventory_download.suggested_filename.endswith('.xlsx')
            await inventory_download.save_as('/tmp/inventory-browser.xlsx')
            for kind in ['in','out']:
                async with page.expect_download() as voucher_info:
                    await page.evaluate('(kind)=>exportVoucherFixture(kind)',kind)
                voucher_download=await voucher_info.value
                assert voucher_download.suggested_filename.startswith('LTD-PN001' if kind=='in' else 'LTD-PX001')
                assert voucher_download.suggested_filename.endswith('.xlsx')
                await voucher_download.save_as(f'/tmp/voucher-browser-{kind}.xlsx')
            for section,label,path in [('maintenanceJobsPage','Xuất Excel lịch bảo trì','/tmp/maintenance-browser.xlsx'),('historyPage','Xuất Excel lịch sử','/tmp/history-browser.xlsx')]:
                await page.evaluate('(section)=>renderMaintenanceFixture(section)',section)
                async with page.expect_download() as maintenance_info:
                    await page.get_by_role('button',name=label,exact=True).click()
                maintenance_download=await maintenance_info.value
                assert maintenance_download.suggested_filename.endswith('.xlsx')
                await maintenance_download.save_as(path)
            await page.evaluate('''renderFixture([
              {id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'169.254.85.99',port:8193,model:'FANUC 0i-MF Plus'},
              {id:'old',name:'Old demo data',status:'running',spindleSpeed:1200,ip:'192.168.1.101',port:8193}
            ])''')
            card = page.locator('#card-neway-1260s')
            assert 'Dữ liệu thật' in await card.inner_text()
            assert 'ĐANG CHẠY (START)' in await card.inner_text()
            assert '— RPM' in await card.inner_text()
            assert 'Chưa đọc' in await card.inner_text()
            assert 'PART COUNT:' in await card.inner_text()
            assert 'Vị trí nhà xưởng' not in await card.inner_text()
            assert 'RUN TIME:' in await card.inner_text()
            assert 'CYCLE TIME:' in await card.inner_text()
            assert await card.locator('.cnc-state-light.running').count()==1
            assert 'Chẩn đoán tín hiệu chu kỳ' not in await card.inner_text()
            assert 'Các nhóm mã lỗi liên kết kho' not in await page.locator('#cncMonitoringPage').inner_text()
            assert await card.get_by_text('Xử lý xong (Clear)').count() == 0
            assert await page.locator('#statCncRunning').inner_text() == '1'
            assert await page.locator('#cncConnectionReady').inner_text() == '1 / 2'
            await card.get_by_role('button',name='Sửa IP Neway 1260S',exact=True).click()
            assert await page.locator('#cncDialog').is_visible()
            await page.locator('#cncDialog').evaluate('e=>e.close()')
            await card.get_by_role('button',name='Alarm của máy').click()
            assert await page.locator('#cncAlarmHistoryDialog').is_visible()
            await page.locator('#cncAlarmHistoryDialog').evaluate('e=>e.close()')
            assert 'CHƯA CÓ TÍN HIỆU THẬT' in await page.locator('#card-old').inner_text()
            await page.evaluate("""renderAlarmFixture([{id:'alarm-fixture',cncId:'neway-1260s',cncName:'Neway 1260S',timestamp:'2026-11-05T02:00:00Z',alarmCode:'0500',alarmType:4,axis:1,description:'(X)+ OVERTRAVEL (SOFT 1). Kiểm tra hành trình trục X theo thông báo của CNC. Nội dung mô tả được hiển thị đầy đủ, không rút gọn bằng dấu ba chấm.',source:'focas'}])""")
            assert await page.locator('#cncSearchInput').count()==0
            assert 'Bảng điều khiển & Giám sát CNC (Thời gian thực)' not in await page.locator('#cncMonitoringPage').inner_text()
            description=page.locator('#cncAlarmHistoryBody .cnc-alarm-description')
            assert 'không rút gọn bằng dấu ba chấm' in await description.inner_text()
            assert await description.evaluate("e=>getComputedStyle(e).whiteSpace")=='pre-wrap'
            async with page.expect_download() as alarm_info:
                await page.get_by_role('button',name='Xuất Excel Alarm',exact=True).click()
            alarm_download=await alarm_info.value
            assert alarm_download.suggested_filename.endswith('.xlsx')
            await alarm_download.save_as('/tmp/alarm-browser.xlsx')
            await page.evaluate('''renderFixture([{id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'192.168.1.1',port:8193,model:'FANUC 0i-MF Plus',spindleSpeed:1800,feedrate:12.5,feedrateUnit:'inch/min',activeProgram:'O12345678',mainProgram:'O0001'}])''')
            assert '1800 RPM' in await card.inner_text()
            assert '12.5 inch/min' in await card.inner_text()
            assert 'O12345678' in await card.inner_text()
            assert 'O0001' not in await card.inner_text()
            assert 'Chương trình chính:' not in await card.inner_text()
            assert 'Dòng lệnh hiện tại:' not in await card.inner_text()
            assert '/ — RPM' not in await card.inner_text()
            await page.evaluate("""renderFixture([{id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:0,alarm:1,emergency:0,aut:5},alarm:'Có tín hiệu Alarm',alarmDetailsRead:true,alarmDetails:[{number:1234,type:2,axis:1,message:'TEST <script>unsafe</script>'},{number:5678,type:3,axis:0,message:'SECOND ALARM'}]}])""")
            assert 'Alarm 1234' in await card.inner_text()
            assert 'SECOND ALARM' in await card.inner_text()
            assert 'TEST <script>unsafe</script>' in await card.inner_text()
            assert await card.locator('script').count() == 0
            await page.evaluate('startFixturePolling()')
            await page.clock.fast_forward(35000)
            await page.wait_for_function("document.querySelector('#card-neway-1260s').textContent.includes('MẤT KẾT NỐI')")
            assert await page.locator('#statCncRunning').inner_text() == '0'
            assert await page.locator('#cncConnectionReady').inner_text() == '0 / 1'
            # Live CNC reads must succeed even when alarm-history/presence endpoints fail.
            import json
            at=await page.evaluate('Date.now()')
            live={'neway-1260s':{'id':'neway-1260s','name':'Neway 1260S','source':'focas','connected':True,'lastSeen':at,'rawStatus':{'run':3,'alarm':0,'emergency':0,'aut':1},'ip':'192.168.1.1','port':8193,'spindleSpeed':250,'feedrate':100,'feedrateUnit':'inch/min'}}
            await page.route('**/cncs.json?*',lambda route: route.fulfill(status=200,content_type='application/json',body=json.dumps(live)))
            await page.clock.fast_forward(5000)
            await page.wait_for_function("document.querySelector('#card-neway-1260s').textContent.includes('250 RPM')")
            assert await page.locator('#statCncRunning').inner_text()=='1'
            assert 'Web đã nhận Firebase' in await page.locator('#cncSyncStatus').inner_text()
            # Reproduce a Windows clock 11 minutes ahead of Firebase's server clock.
            live['neway-1260s']['lastSeen']=await page.evaluate('Date.now()')-660000
            async def presence_reply(route):
                clock=await page.evaluate('Date.now()')
                await route.fulfill(status=200,content_type='application/json',body=json.dumps({'uid':'fixture','timestamp':clock-660000}))
            await page.route('**/online_users/**',presence_reply)
            await page.clock.fast_forward(15000)
            await page.wait_for_function("document.querySelector('#cncSyncStatus').textContent.includes('11 phút')")
            assert await page.locator('#statCncRunning').inner_text()=='1'
            assert '250 RPM' in await card.inner_text()
            await page.route('**/online_users/**',lambda route:route.fulfill(status=403,content_type='application/json',body='{}'))
            await page.route('**/cncs.json?*',lambda route:route.fulfill(status=503,content_type='application/json',body='{}'))
            await page.evaluate('restoreFixtureClock()')

            await page.evaluate('''renderFixture([{id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:0,alarm:1,emergency:0,aut:0},alarm:'CNC flag only',ip:'169.254.85.99',port:8193,model:'FANUC 0i-MF Plus'}])''')
            assert 'CÓ TÍN HIỆU ALARM' in await card.inner_text()
            assert await card.get_by_text('Xử lý xong (Clear)').count() == 0
            assert await card.locator('.cnc-parts-link').count() == 0
            await page.set_viewport_size({'width':390,'height':844})
            assert await card.is_visible()
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            # Report creation/export uses daily session fixtures, never the production database.
            import datetime, json
            report_start=int(datetime.datetime(2026,10,28,tzinfo=datetime.timezone(datetime.timedelta(hours=7))).timestamp()*1000)
            history={'2026-10-28':{'fixture':{'schemaVersion':1,'source':'focas','machineId':'neway-1260s','sessionId':'fixture','date':'2026-10-28','firstMs':report_start,'lastMs':report_start+3600000,'observedMs':3600000,'partCountStart':20,'partCountEnd':32,'runningMs':1800000,'idleMs':600000,'holdMs':600000,'alarmMs':600000,'unknownStateMs':0,'counterDelta':12,'counterObservedMs':3600000,'counterResets':0,'counterVerified':True,'partsPerCount':2}}}
            history['2026-10-28']['fixture']['cycles']={'one':{'id':'cycle1','program':'O0002','observedFromMs':report_start+1000,'observedToMs':report_start+26000,'startMs':report_start+1000,'endMs':report_start+26000,'runMs':15000,'holdMs':5000,'alarmMs':5000,'waitMs':0,'wallMs':25000,'cncCycleTimeMs':25000,'partCountStart':20,'partCountDelta':1,'partCountEnd':21,'status':'Dừng/RESET quan sát; chưa xác nhận M30','days':{'2026-10-28':{'runMs':15000,'holdMs':5000,'alarmMs':5000}}}}
            await page.route('**/cncReports/**',lambda route: route.fulfill(status=200,content_type='application/json',body=json.dumps(history)))
            await page.locator('#exportCncBtn').click()
            report=page.locator('#cncReportDialog')
            await report.locator('[name=anchor]').fill('2026-10-28')
            await report.get_by_role('button',name='Xem báo cáo').click()
            await page.wait_for_function("document.querySelector('#cncReportDialog .cr-report').textContent.includes('Tổng quan')")
            assert 'Neway 1260S' in await report.inner_text()
            assert '32' in await report.locator('.cr-kpis').inner_text()
            assert '30 phút 0 giây' in await report.locator('.cr-kpis').inner_text()
            assert '15 giây' in await report.locator('table').nth(1).inner_text()
            assert '2026-10-28 00:00:01' in await report.locator('table').nth(1).inner_text()
            assert await report.locator('table').nth(1).locator('tbody tr').count()==1
            assert 'O0002' in await report.locator('table').nth(1).inner_text()
            assert 'Đã kết thúc' in await report.locator('table').nth(1).inner_text()
            async with page.expect_download() as download_info:
                await report.get_by_role('button',name='Xuất Excel (.xlsx)').click()
            download=await download_info.value
            assert download.suggested_filename.endswith('.xlsx')
            await download.save_as('/tmp/cnc-browser-report.xlsx')
            # Long reports must remain reachable in the dialog, not only in print.
            template=history['2026-10-28']['fixture']['cycles']['one']
            long_cycles={}
            for i in range(60):
                cycle=json.loads(json.dumps(template))
                cycle.update(id=f'long-{i}',program=f'O{i+1:04d}',observedFromMs=report_start+1000+i*30000,observedToMs=report_start+26000+i*30000,startMs=report_start+1000+i*30000,endMs=report_start+26000+i*30000)
                long_cycles[str(i)]=cycle
            history['2026-10-28']['fixture']['cycles']=long_cycles
            for width,height in [(1280,720),(390,844)]:
                await page.set_viewport_size({'width':width,'height':height})
                await report.get_by_role('button',name='Xem báo cáo').click()
                await page.wait_for_function("document.querySelectorAll('#cncReportDialog table:first-child tbody tr').length>=60")
                assert await report.locator('.cr-notice').count()==0
                assert 'không đọc PMC' not in await report.inner_text()
                assert await report.evaluate("e=>getComputedStyle(e).overflowY")=='auto'
                await report.evaluate('e=>e.scrollTop=0')
                await report.hover()
                await page.mouse.wheel(0,1600)
                await page.wait_for_function("document.querySelector('#cncReportDialog').scrollTop>0")
                last_row=report.locator('table').nth(1).locator('tbody tr').last
                await last_row.scroll_into_view_if_needed()
                assert await report.evaluate('e=>e.scrollTop')>1000
                row_box=await last_row.bounding_box();dialog_box=await report.bounding_box()
                assert row_box['y']+row_box['height']<=dialog_box['y']+dialog_box['height']+2
                assert row_box['y']>=dialog_box['y']
            del history['2026-10-28']['fixture']['cycles']
            await report.get_by_role('button',name='Xem báo cáo').click()
            await page.wait_for_function("document.querySelector('#cncReportDialog .cr-report').textContent.includes('Tổng hợp ngày')")
            assert '30 phút 0 giây' in await report.locator('table').nth(1).inner_text()
            assert 'Chưa ghi nhận' in await report.locator('table').nth(1).inner_text()
            assert 'quan sát' not in await report.locator('table').nth(1).locator('thead').inner_text()
            # An empty period is explicitly unavailable, never a fabricated zero-production report.
            await page.route('**/cncReports/**',lambda route: route.fulfill(status=200,content_type='application/json',body='null'))
            await report.get_by_role('button',name='Xem báo cáo').click()
            await page.wait_for_function("document.querySelector('#cncReportDialog .cr-status').textContent.includes('Chưa có lịch sử')")
            assert await report.get_by_role('button',name='Xuất Excel (.xlsx)').is_disabled()
            await page.route('**/cncReports/**',lambda route: route.fulfill(status=403,content_type='application/json',body='{}'))
            await report.get_by_role('button',name='Xem báo cáo').click()
            await page.wait_for_function("document.querySelector('#cncReportDialog .cr-status').textContent.includes('Rules cncReports')")
            assert not errors, errors
            await browser.close()
            print('PASS: live telemetry, unit-aware display, freshness, mobile; report summary/verified production, real XLSX download, empty period, and Firebase permission errors; no page errors.')
    finally:
        server.shutdown()
        server.server_close()

asyncio.run(run())
