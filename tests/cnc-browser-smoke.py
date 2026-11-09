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
window.seedDayFixture = () => {cncDayOwner=getUser().uid;cncDayStats.set('neway-1260s',{date:vnDate(cncServerNow()),row:{sessions:1,counterStart:20,counterEnd:21,counterResets:0,observedMs:7200000,runningMs:3600000,holdMs:1800000,alarmMs:900000,firstMs:cncServerNow()-7200000,lastMs:cncServerNow(),conflicts:0}});renderCncGridOnly()};
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
              {id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),machiningContext:{toolNumber:7,spindleToolNumber:7,nextToolNumber:4,spindleToolConfirmed:true},rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'169.254.85.99',port:8193,model:'FANUC 0i-MF Plus'},
              {id:'old',name:'Old demo data',status:'running',spindleSpeed:1200,ip:'192.168.1.101',port:8193}
            ])''')
            assert not await page.locator('.topbar .page-title').is_visible()
            assert await page.locator('#pageHeading').text_content()==''
            await page.get_by_role('button',name='Cài đặt máy Neway 1260S',exact=True).click()
            profile=page.locator('#cncDialog')
            assert await profile.locator('#cncKindInput').input_value()=='unknown'
            await profile.locator('#cncKindInput').select_option('mill-3axis')
            await profile.locator('#cncOffsetTableInput').select_option('m-c')
            await profile.locator('#cncOffsetConfirmedInput').check()
            await profile.locator('#cncKindInput').select_option('lathe')
            assert not await profile.locator('#cncOffsetConfirmedInput').is_checked()
            assert await profile.locator('#cncOffsetConfirmedInput').is_disabled()
            await profile.evaluate('e=>e.close()')

            assert await page.get_by_role('button',name='Báo cáo vận hành CNC',exact=True).is_visible()
            assert await page.locator('.cnc-model-tile').count()==2
            await page.get_by_role('button',name='Xem máy Neway 1260S',exact=True).click()
            assert await page.locator('#cncMachineDetailsDialog').is_visible()
            assert await page.locator('.operator-position').count()==4
            assert 'Chưa đọc tọa độ' in await page.locator('.operator-screen').inner_text()
            await page.evaluate('''renderFixture([{id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),machiningContext:{toolNumber:7,spindleToolNumber:7,nextToolNumber:4,spindleToolConfirmed:true},rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'192.168.1.1',port:8193,model:'FANUC 0i-MF Plus',positions:['X','Y','Z'].map((axis,i)=>({axis,absolute:{value:[-125.25,10,80][i],unit:'mm',decimals:3},relative:{value:0,unit:'mm',decimals:3},machine:{value:[-800,-50,-200][i],unit:'mm',decimals:3},distance:{value:0,unit:'mm',decimals:3}})),servoLoads:[{axis:'X',percent:23},{axis:'Y',percent:17},{axis:'Z',percent:35}],sequenceNumber:20,programText:'N10 G0 X0\\nN20 G1 X10 F100\\nM30'}])''')
            assert '-125.250' in await page.locator('.operator-screen').inner_text()
            assert await page.locator('.operator-load meter').count()==3
            assert 'N20 G1' in await page.locator('.operator-program .active-line').inner_text()
            await page.set_viewport_size({'width':1440,'height':1000})
            await page.screenshot(path='/tmp/cnc-operator-screen.png',full_page=True)
            await page.evaluate('''window.operatorFixture={id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),sampledAt:new Date().toISOString(),activeProgram:'O7020',machiningContext:{toolNumber:1,spindleToolNumber:1,nextToolNumber:4,commandedToolNumber:99,spindleToolConfirmed:true,workCoordinate:'G54'},rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'192.168.1.1',port:8193,positions:['X','Y','Z'].map(axis=>({axis,absolute:{value:-21.5024,unit:'inch',decimals:4},relative:{value:0,unit:'inch',decimals:4},machine:{value:-24.5393,unit:'inch',decimals:4},distance:{value:0,unit:'inch',decimals:4}})),modalGcodes:Array.from({length:40},(_,group)=>({group,code:['G00','G17','G90','G54','G40','G49','G80','G98'][group%8]})),modalGcodesComplete:true,fullProgram:{program:'O7020',text:'%\\nO7020\\n'+Array.from({length:200},(_,i)=>'N'+i+' G1 X'+i+' F100').join('\\n')+'\\nM30\\n%',complete:true},fullProgramVerifiedAt:new Date().toISOString(),workCoordinates:[{name:'G54',unit:'inch',x:-21.5024,y:-12.2112,z:-11.39}],toolOffsets:{memory:'C',unit:'inch',decimals:4,sampledAtUtc:new Date().toISOString(),rows:Array.from({length:32},(_,i)=>({number:i+1,lengthGeometry:i+0.125,lengthWear:0,radiusGeometry:-0.5,radiusWear:0}))}};renderFixture([operatorFixture])''')
            await page.set_viewport_size({'width':1366,'height':768})
            assert await page.locator('#cncMachineDetailsDialog').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
            assert await page.locator('.operator-position').evaluate_all('els=>els.every(e=>e.scrollHeight<=e.clientHeight+1)')
            assert 'T1' in await page.locator('.operator-modal').inner_text()
            assert 'T4' in await page.locator('.operator-modal').inner_text()
            assert 'T99' not in await page.locator('.operator-modal').inner_text()
            await page.screenshot(path='/tmp/cnc-compact-desktop.png',full_page=True)
            await page.get_by_role('button',name='PROGRAM / WORK',exact=True).click()
            assert 'N199 G1 X199' in await page.locator('.operator-full-program').inner_text()
            assert '-21.5024' in await page.locator('.operator-work').inner_text()
            assert await page.locator('.operator-work .operator-table-scroll').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            program=page.locator('.operator-full-program pre')
            await program.evaluate('e=>e.scrollTop=200')
            await page.evaluate('renderFixture([operatorFixture])')
            assert await program.evaluate('e=>e.scrollTop')==200
            await page.screenshot(path='/tmp/cnc-program-work.png',full_page=True)
            await page.evaluate('renderFixture([{...operatorFixture,fullProgram:null,programText:"O7020\\nN100 G20\\nN110 G0"}])')
            assert 'N100 G20' in await page.locator('.operator-full-program pre').inner_text()
            assert 'Chưa đọc đủ file O' in await page.locator('.operator-full-program').inner_text()
            assert await page.locator('.operator-full-program').get_attribute('data-program-complete')=='false'
            await page.get_by_role('button',name='OFFSET',exact=True).click()
            assert '001' in await page.locator('.operator-offset').inner_text()
            await page.screenshot(path='/tmp/cnc-offset-sizing.png',full_page=True)
            assert await page.locator('.operator-offset .operator-table-scroll').evaluate('e=>e.scrollHeight<=e.clientHeight+1'), await page.locator('.operator-offset .operator-table-scroll').evaluate('e=>({height:e.clientHeight,scroll:e.scrollHeight,table:e.firstElementChild.getBoundingClientRect().height,cell:getComputedStyle(e.querySelector("td")).cssText})')
            await page.get_by_role('button',name='Sau ›',exact=True).click()
            assert '17–32 / 32' in await page.locator('.operator-pagination').inner_text()
            assert '017' in await page.locator('.operator-offset tbody').inner_text()
            assert '001' not in await page.locator('.operator-offset tbody').inner_text()
            await page.screenshot(path='/tmp/cnc-offset.png',full_page=True)
            await page.get_by_role('button',name='ALARM',exact=True).click()
            assert await page.locator('.operator-metrics').count()==0
            assert await page.locator('.operator-modal').count()==0
            assert await page.get_by_role('button',name='Xóa máy Neway 1260S',exact=True).count()>=1
            await page.get_by_role('button',name='POSITION',exact=True).click()
            await page.set_viewport_size({'width':390,'height':844})
            assert await page.locator('#cncMachineDetailsDialog').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            await page.set_viewport_size({'width':1280,'height':900})
            await page.evaluate('''renderFixture([{id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),machiningContext:{toolNumber:7,spindleToolNumber:7,nextToolNumber:4,spindleToolConfirmed:true},rawStatus:{run:3,alarm:0,emergency:0,aut:1},ip:'169.254.85.99',port:8193,model:'FANUC 0i-MF Plus'},{id:'old',name:'Old demo data',status:'running',spindleSpeed:1200,ip:'192.168.1.101',port:8193}])''')
            await page.get_by_role('button',name='THỐNG KÊ',exact=True).click()
            card = page.locator('#card-neway-1260s')
            assert 'Dữ liệu thật' in await card.inner_text()
            assert 'ĐANG CHẠY (START)' in await card.inner_text()
            assert '— RPM' in await card.inner_text()
            assert 'Chưa đọc' in await card.inner_text()
            assert 'T7' in await card.locator('.cnc-tool-number').inner_text()
            assert 'PART COUNT:' in await card.inner_text()
            assert 'Vị trí nhà xưởng' not in await card.inner_text()
            assert 'RUN TIME:' in await card.inner_text()
            assert 'CYCLE TIME:' in await card.inner_text()
            assert await card.locator('.cnc-state-light.running').count()==1
            assert 'Chẩn đoán tín hiệu chu kỳ' not in await card.inner_text()
            assert 'Các nhóm mã lỗi liên kết kho' not in await page.locator('#cncMonitoringPage').inner_text()
            assert await page.locator('#cncLiveCharts').count()==0
            assert await card.locator('.cnc-machine-art').count()==0
            assert await card.locator('.cnc-day-charts').count()==1
            assert await card.locator('.cnc-four-gauges > div').count()==4
            assert await card.locator('.cnc-four-gauges .cnc-instrument').count()==2
            assert await card.locator('.cnc-day-foot').count()==0
            assert await card.locator('.cnc-operation-strip > div > span').all_text_contents()==['Chế độ','Chương trình','Dao trục chính','CYCLE TIME:','RUN TIME:','PART COUNT:']
            assert await card.locator('.cnc-production-grid').count()==0
            assert await card.locator('.cnc-machine-content').evaluate("el=>el.firstElementChild.classList.contains('cnc-program-line')")
            await page.evaluate('seedDayFixture()')
            assert await card.locator('.cnc-part-ring strong').inner_text()=='21'
            assert '+1 trong ngày' in await card.locator('.cnc-day-parts').inner_text()
            assert await card.locator('.cnc-count-comparison label b').all_text_contents()==['20','21']
            assert '1:00:00' in await card.locator('.cnc-day-runtime').inner_text()
            assert await card.locator('.cnc-day-runtime .cnc-day-ring').evaluate("el=>el.style.getPropertyValue('--run')")=='50%'

            assert await card.get_by_text('Xử lý xong (Clear)').count() == 0
            assert await page.locator('#statCncRunning').inner_text() == '1'
            assert await page.locator('#cncConnectionReady').inner_text() == '1 / 2'
            await card.get_by_role('button',name='Cài đặt máy Neway 1260S',exact=True).click()
            assert await page.locator('#cncDialog').is_visible()
            await page.locator('#cncDialog').evaluate('e=>e.close()')
            await card.get_by_role('button',name='Alarm của máy').click()
            assert await page.locator('#cncAlarmHistoryDialog').is_visible()
            await page.locator('#cncAlarmHistoryDialog').evaluate('e=>e.close()')
            assert 'CHƯA CÓ TÍN HIỆU THẬT' in await page.locator('#model-old').inner_text()
            await page.locator('#cncMachineDetailsDialog [data-close-details]').click()
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
            await page.get_by_role('button',name='Xem máy Neway 1260S',exact=True).click()
            await page.get_by_role('button',name='THỐNG KÊ',exact=True).click()
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
            await page.locator('#cncMachineDetailsDialog [data-close-details]').click()
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
            assert await report.locator('.cr-machine-chart').count()==1
            assert '50%' in await report.locator('.cr-machine-chart').inner_text()
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
            await report.get_by_role('button',name='Đóng',exact=True).click()
            # Three-column layout must keep missing-day and alarm cards aligned.
            await page.evaluate("""renderFixture([
              {id:'neway-1260s',name:'Neway 1260S',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:3,alarm:0,emergency:0,aut:1},partCounter:21,spindleSpeed:250,feedrate:100,feedrateUnit:'inch/min',ip:'192.168.1.1',port:8193},
              {id:'alarm-machine',name:'Neway 1260SL',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run:0,alarm:1,emergency:0,aut:5},alarmDetails:[{number:500,axis:1,message:'(X)+ OVERTRAVEL (SOFT 1)'}],ip:'192.168.1.2',port:8193},
              {id:'missing-day',name:'CNC 03',source:'focas',connected:false,lastSeen:Date.now()-86400000,ip:'192.168.1.3',port:8193}
            ]);seedDayFixture()""")
            assert await page.locator('.cnc-day-note').count()==0
            assert 'Chưa có thống kê ngày' not in await page.locator('#cncListGrid').inner_text()
            for width in [1920,1600,1280]:
                await page.set_viewport_size({'width':width,'height':1000})
                sizes=await page.locator('#cncListGrid > article').evaluate_all('(nodes)=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,height:r.height}})')
                assert len(sizes)==3
                assert max(r['top'] for r in sizes)-min(r['top'] for r in sizes)<1
                assert max(r['height'] for r in sizes)-min(r['height'] for r in sizes)<1
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            for width in [1024,700,390]:
                await page.set_viewport_size({'width':width,'height':844})
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            await page.get_by_role('button',name='Xem máy CNC 03',exact=True).click()
            await page.get_by_role('button',name='THỐNG KÊ',exact=True).click()
            assert await page.locator('#card-missing-day .cnc-day-runtime .cnc-day-ring strong').inner_text()=='—'
            assert not errors, errors
            await browser.close()
            print('PASS: live telemetry, unit-aware display, freshness, mobile; report summary/verified production, real XLSX download, empty period, and Firebase permission errors; no page errors.')
    finally:
        server.shutdown()
        server.server_close()

asyncio.run(run())
