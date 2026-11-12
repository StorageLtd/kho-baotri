"""Full offline CMMS: real local API/storage/browser, simulated data only, no CNC/cloud."""
import http.cookiejar,json,os,socket,subprocess,tempfile,time,urllib.request,urllib.error,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PWSH='/tmp/pwsh-validation/runtime/pwsh'
subprocess.run(['python',str(ROOT/'tools/ltd-cmms-offline/build.py')],check=True,capture_output=True)
PACKAGE=Path('/tmp/ltd-cmms-offline-build/LTD-CMMS-Offline')
with tempfile.TemporaryDirectory(prefix='ltd-offline-test-') as tmp:
 tmp=Path(tmp);store=tmp/'data';seed=tmp/'seed.ps1'
 seed.write_text('''$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $env:OFFLINE_PACKAGE 'LocalHost.cs')
. (Join-Path $env:OFFLINE_PACKAGE 'Offline.Core.ps1')
Initialize-OfflineStore $env:OFFLINE_DATA
$null=New-OfflineAccount 'admin@fixture.local' 'Fixture Admin' 'fixture-password-123' 'admin'
$script:Database.items.sensor=@{id='sensor';name='Cảm biến fixture';sku='S001';category='Điện';quantity=10;min=1}
$script:Database.machines.machine=@{id='machine';name='Máy fixture';model='Fixture'}
$script:Database.maintenanceJobs.job=@{id='job';machineId='machine';machineName='Máy fixture';jobName='Thay dầu fixture';recurrence='monthly';nextDate='2026-11-12';owner='Fixture';desc='Chỉ kiểm thử'}
$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$day=[DateTime]::UtcNow.AddHours(7).ToString('yyyy-MM-dd')
$script:Database.cncReports['cnc-fixture']=@{};$script:Database.cncReports['cnc-fixture'][$day]=@{fixture=@{schemaVersion=1;source='focas';machineId='cnc-fixture';sessionId='fixture';ownerUid='offline';date=$day;firstMs=($now-2000);lastMs=$now;observedMs=2000;runningMs=2000;idleMs=0;holdMs=0;alarmMs=0;unknownStateMs=0;counterDelta=1;counterObservedMs=2000;counterResets=0;counterVerified=$false;partsPerCount=1;partCountStart=20;partCountEnd=21;sampleCount=2;gapCount=0}}
Write-OfflineJson $script:DatabasePath $script:Database
Get-ChildItem -LiteralPath $env:OFFLINE_PACKAGE -Filter '*.ps1' | ForEach-Object {$errors=$null;$tokens=$null;[void][Management.Automation.Language.Parser]::ParseFile($_.FullName,[ref]$tokens,[ref]$errors);if($errors){throw ($errors|Out-String)}}
''',encoding='utf-8-sig')
 env={**os.environ,'OFFLINE_PACKAGE':str(PACKAGE),'OFFLINE_DATA':str(store),'XDG_CACHE_HOME':str(tmp/'cache'),'XDG_CONFIG_HOME':str(tmp/'config'),'XDG_DATA_HOME':str(tmp/'xdg')}
 subprocess.run([PWSH,'-NoProfile','-File',str(seed)],env=env,check=True,capture_output=True,text=True)
 probe=socket.socket();probe.bind(('127.0.0.1',0));port=probe.getsockname()[1];probe.close();base=f'http://localhost:{port}'
 def launch():
  p=subprocess.Popen([PWSH,'-NoProfile','-File',str(PACKAGE/'Start-Offline.ps1'),'-Port',str(port),'-DataRoot',str(store),'-Headless','-NoBrowser','-NoCollectors'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  line=p.stdout.readline().strip();assert line=='READY '+base+'/',line+(p.stderr.read() if p.poll() is not None else '')
  return p
 class Client:
  def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.csrf=None
  def request(self,path,method='GET',data=None,headers=None):
   h={'Origin':base,**(headers or {})};body=None
   if method!='GET':h['Content-Type']='application/json';body=json.dumps(data if data is not None else {}).encode()
   if self.csrf:h['X-LTD-CSRF']=self.csrf
   req=urllib.request.Request(base+path,headers=h,data=body,method=method)
   try:r=self.opener.open(req,timeout=25)
   except urllib.error.HTTPError as e:r=e
   raw=r.read();value=json.loads(raw) if raw and 'json' in r.headers.get('Content-Type','') else raw
   return r.code,value,r.headers
  def login(self,email='admin@fixture.local',password='fixture-password-123'):
   code,data,headers=self.request('/api/login','POST',{'email':email,'password':password});assert code==200,(code,data);self.csrf=data['csrf'];assert 'HttpOnly' in headers['Set-Cookie'] and 'SameSite=Strict' in headers['Set-Cookie'];return data
 process=launch()
 try:
  admin=Client();assert admin.request('/api/database/items.json')[0]==401
  assert admin.request('/api/login','POST',{'email':'admin@fixture.local','password':'wrong'})[0]==401
  admin.login()
  assert admin.request('/accounts.json')[0]==404
  assert admin.request('/../Offline.Core.ps1')[0]==404
  assert admin.request('/api/backup',headers={'Origin':'https://evil.example'})[0]==403
  assert admin.request('/api/backup',headers={'Host':'evil.example:'+str(port)})[0]==403
  token=admin.csrf;admin.csrf=None;assert admin.request('/api/database/items/new.json','PUT',{'id':'new'})[0]==403;admin.csrf=token
  code,data,_=admin.request('/api/database/items.json');assert code==200 and data['sensor']['quantity']==10,(code,data)
  assert admin.request('/api/accounts','POST',{'email':'viewer@fixture.local','displayName':'Viewer','password':'viewer-fixture-password','role':'viewer'})[0]==200
  viewer=Client();viewer.login('viewer@fixture.local','viewer-fixture-password')
  assert viewer.request('/api/database/items.json')[0]==200
  assert viewer.request('/api/database/items/sensor.json','PUT',{'id':'sensor','quantity':99})[0]==403
  assert viewer.request('/api/backup')[0]==403
  assert admin.request('/api/database/stockMovements/move.json','PUT',{'id':'move','type':'in','amount':1})[0]==200
  assert admin.request('/api/database/stockMovements/move.json','DELETE')[0]==403
  assert admin.request('/api/database/stockMovements.json','PUT',{})[0]==403
  assert admin.request('/api/database/cncReports.json','PUT',{})[0]==403
  profiles=admin.request('/api/accounts')[1]
  assert all('passwordHash' not in p for p in profiles)
  admin_id=next(p['uid'] for p in profiles if p['role']=='admin')
  assert admin.request('/api/accounts','POST',{'uid':admin_id,'role':'viewer','disabled':False})[0]==400
  assert admin.request('/api/session')[1]['user']['role']=='admin'
  assert admin.request('/api/accounts','POST',{'uid':admin_id,'role':'admin','password':'short'})[0]==400
  assert admin.request('/api/session')[1]['user']['role']=='admin'
  assert admin.request('/api/register','POST',{'email':'intruder@fixture.local','password':'fixture-password','role':'admin'})[0]==403
  from playwright.sync_api import sync_playwright,expect
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
   page.goto(base+'/',wait_until='networkidle')
   page.locator('#emailInput').fill('admin@fixture.local');page.locator('#passwordInput').fill('fixture-password-123');page.locator('#submitLoginBtn').click()
   expect(page.locator('body')).not_to_have_class('locked',timeout=15000)
   page.locator('[data-page="inventoryPage"]').click();expect(page.locator('#inventoryBody')).to_contain_text('Cảm biến fixture',timeout=15000)
   page.locator('[data-cmms-action="openItemDialog"]').click();page.locator('#nameInput').fill('Cảm biến sửa offline');page.locator('#supplierInput').fill('Máy fixture');page.locator('#locationInput').fill('A1');page.locator('#itemForm [type=submit]').click();expect(page.locator('#itemDialog')).not_to_be_visible()
   expect(page.locator('#inventoryBody')).to_contain_text('Cảm biến sửa offline')
   # Wait for the actual local persistence, not just optimistic DOM rendering.
   for _ in range(50):
    if admin.request('/api/database/items/sensor.json')[1]['name']=='Cảm biến sửa offline':break
    time.sleep(.1)
   else:raise AssertionError('Inventory did not persist')
   with page.expect_download() as info:page.locator('#exportBtn').click()
   download=info.value;assert download.suggested_filename.endswith('.xlsx');download.save_as(str(tmp/'inventory.xlsx'))
   with zipfile.ZipFile(tmp/'inventory.xlsx') as z:assert 'xl/worksheets/sheet1.xml' in z.namelist()
   page.locator('[data-page="maintenanceJobsPage"]').click();expect(page.locator('#maintenanceScheduleBoard')).to_contain_text('Thay dầu fixture')
   page.locator('[data-cmms-action="toggleMaintenanceMachine"]').click();page.locator('[data-cmms-action="openJobDialog"]').click();page.locator('#jNameInput').fill('Thay dầu sửa offline');page.locator('#jobForm [type=submit]').click();expect(page.locator('#jobDialog')).not_to_be_visible()
   for _ in range(50):
    if admin.request('/api/database/maintenanceJobs/job.json')[1]['jobName']=='Thay dầu sửa offline':break
    time.sleep(.1)
   else:raise AssertionError('Maintenance job did not persist')
   # Simulated CNC records only; the host is explicitly started without collectors.
   import datetime
   now=datetime.datetime.now(datetime.timezone.utc).isoformat()
   cnc={'id':'cnc-fixture','name':'CNC Offline Fixture','ip':'192.168.1.99','port':8193,'source':'focas','connected':True,'lastSeen':now,'sampledAt':now,'machineKind':'mill-3axis','orientation':'vertical','model':'FANUC fixture','rawStatus':{'run':3,'aut':1,'alarm':0,'emergency':0},'spindleSpeed':250,'feedrate':100,'feedrateUnit':'mm/min','activeProgram':'O0002','partCounter':21,'runTimeMs':3600000,'cycleTimeMs':60000}
   assert admin.request('/api/database/cncs/cnc-fixture.json','PUT',cnc)[0]==200
   alarm={'id':'alarm-fixture','cncId':'cnc-fixture','cncName':'CNC Offline Fixture','timestamp':now,'alarmCode':'1163','alarmType':15,'axis':0,'description':'OFFLINE ALARM FIXTURE','source':'focas'}
   assert admin.request('/api/database/cncAlarms/alarm-fixture.json','PUT',alarm)[0]==200
   page.locator('[data-page="cncMonitoringPage"]').click();expect(page.locator('#model-cnc-fixture')).to_contain_text('ĐANG CHẠY',timeout=15000)
   page.get_by_role('button',name='Xem máy CNC Offline Fixture',exact=True).click();expect(page.locator('#cncMachineDetailsDialog')).to_contain_text('O0002')
   page.locator('#cncMachineDetailsDialog [data-cnc-action=history]').click();expect(page.locator('#cncMachineAlarmHistoryBody')).to_contain_text('OFFLINE ALARM FIXTURE',timeout=20000)
   with page.expect_download() as info:page.locator('#exportCncMachineAlarmBtn').click()
   assert info.value.suggested_filename.endswith('.xlsx')
   page.locator('#closeCncAlarmHistoryFootBtn').click();page.locator('#cncMachineDetailsDialog [data-close-details]').click()
   page.locator('#exportCncBtn').click();report=page.locator('#cncReportDialog');report.get_by_role('button',name='Xem báo cáo',exact=True).click();expect(report.locator('.cr-report')).to_contain_text('CNC Offline Fixture',timeout=15000)
   with page.expect_download() as info:report.get_by_role('button',name='Xuất Excel (.xlsx)',exact=True).click()
   assert info.value.suggested_filename.endswith('.xlsx')
   report.locator('[data-action=close]').click()
   with page.expect_download() as info:page.locator('.offline-tools [data-backup]').click()
   info.value.save_as(str(tmp/'backup.json'));backup=json.loads((tmp/'backup.json').read_text());assert backup['format']=='LTD-CMMS-OFFLINE';assert 'passwordHash' not in json.dumps(backup)
   assert all(url.startswith(base+'/') for url in requests),requests
   assert not errors,errors
   other=browser.new_context();readonly=other.new_page();readonly.goto(base+'/',wait_until='networkidle');readonly.locator('#emailInput').fill('viewer@fixture.local');readonly.locator('#passwordInput').fill('viewer-fixture-password');readonly.locator('#submitLoginBtn').click();expect(readonly.locator('body')).not_to_have_class('locked',timeout=15000);readonly.locator('[data-page="inventoryPage"]').click();expect(readonly.locator('#addBtn')).to_be_disabled();expect(readonly.locator('[data-cmms-action="openItemDialog"]')).to_be_disabled();expect(readonly.locator('#exportBtn')).to_be_enabled();other.close()
   page.screenshot(path='/tmp/ltd-offline-cmms.png',full_page=True)
   browser.close()
  # Backup/import never imports cloud users or changes local credentials.
  code,backup,_=admin.request('/api/backup');assert code==200
  backup['data']['users']={'attacker':{'role':'admin'}}
  code,result,_=admin.request('/api/restore','POST',backup);assert code==200,(code,result)
  assert admin.request('/api/accounts')[1][0].get('passwordHash') is None
  assert list(store.glob('before-import-*.json'))
  process.terminate();process.wait(timeout=10);time.sleep(.2);process=launch()
  admin=Client();admin.login();assert admin.request('/api/database/items/sensor.json')[1]['name']=='Cảm biến sửa offline'
  print('PASS: real offline API/storage + browser inventory/maintenance/XLSX/backup, restart persistence, local roles/CSRF/origin, no Internet or CNC contacted.')
 finally:
  process.terminate()
  try:process.wait(timeout=10)
  except subprocess.TimeoutExpired:process.kill()
