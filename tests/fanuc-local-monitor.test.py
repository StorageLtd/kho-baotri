"""Local-only server and browser checks; never load native DLLs or connect to a CNC."""
import json, os, socket, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PACKAGE=ROOT/'tools/fanuc-local-monitor'
PWSH=os.environ.get('PWSH','/tmp/pwsh-validation/runtime/pwsh')

def request(port,path='/',headers=None,method='GET'):
    req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',headers=headers or {},method=method)
    try: return urllib.request.urlopen(req,timeout=4)
    except urllib.error.HTTPError as error: return error

with tempfile.TemporaryDirectory(prefix='cnc-local-check-') as tmp:
    tmp=Path(tmp)
    probe=socket.socket();probe.bind(('127.0.0.1',0));port=probe.getsockname()[1];probe.close()
    payload=tmp/'payload.json'
    def data(connected=True):
        import datetime
        return {'machineName':'CNC test <script>unsafe</script>','ip':'192.168.1.99','port':8193,'connected':connected,'error':None if connected else 'Test disconnected','snapshot':{'timestampUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rawStatus':{'run':3,'aut':1,'alarm':0,'emergency':0},'spindleSpeed':250,'feedrate':100,'feedrateUnit':'mm/min','partCounter':24,'runTimeMs':3600000,'cycleTimeMs':65000,'activeProgram':'O0002','readErrors':{},'alarmDetails':[]}}
    payload.write_text(json.dumps(data()))
    runner=tmp/'server.ps1'
    runner.write_text('''$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $env:LOCAL_PACKAGE 'LocalServer.cs')
Add-Type -Path (Join-Path $env:LOCAL_PACKAGE 'FanucReader.cs')
$parseErrors=$null;$tokens=$null
[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $env:LOCAL_PACKAGE 'Start-LocalMonitor.ps1'),[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'PowerShell syntax errors'}
$s=[FanucLocalServer]::new([int]$env:LOCAL_PORT,(Join-Path $env:LOCAL_PACKAGE 'index.html'))
$s.Start();Write-Output 'READY'
try { while($true){$s.Update([IO.File]::ReadAllText($env:LOCAL_PAYLOAD));Start-Sleep -Milliseconds 100} } finally {$s.Dispose()}
''')
    env={**os.environ,'LOCAL_PACKAGE':str(PACKAGE),'LOCAL_PORT':str(port),'LOCAL_PAYLOAD':str(payload),'XDG_CACHE_HOME':str(tmp/'cache'),'XDG_CONFIG_HOME':str(tmp/'config'),'XDG_DATA_HOME':str(tmp/'data')}
    process=subprocess.Popen([PWSH,'-NoLogo','-NoProfile','-File',str(runner)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        assert process.stdout.readline().strip()=='READY',process.stderr.read() if process.poll() is not None else 'No server start'
        time.sleep(.2)
        with request(port,'/api/status') as response:
            assert response.status==200
            assert json.load(response)['snapshot']['partCounter']==24
            assert response.headers['Cache-Control']=='no-store'
            assert response.headers.get('Access-Control-Allow-Origin') is None
        assert request(port,headers={'Host':f'attacker.example:{port}'}).status==403
        assert request(port,'/api/status',{'Origin':'https://example.com'}).status==403
        assert request(port,'/api/status',{'Sec-Fetch-Site':'cross-site'}).status==403
        assert request(port,'/api/status',method='POST').status==405
        assert request(port,'/local-config.json').status==404
        assert request(port,'/../FanucReader.cs').status==404
        with request(port) as response:
            assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']
            assert 'LOCAL CNC MONITOR' in response.read().decode()
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1280,'height':900})
            errors=[];urls=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:urls.append(r.url))
            page.goto(f'http://localhost:{port}/',wait_until='networkidle')
            expect(page.locator('#parts')).to_have_text('24')
            assert page.locator('#spindle').inner_text()=='250'
            assert page.locator('#program').inner_text()=='O0002'
            assert page.locator('#runTime').inner_text()=='1:00:00'
            assert page.locator('#cycleTime').inner_text()=='0:01:05'
            assert '<script>unsafe</script>' in page.locator('#name').inner_text()
            assert page.locator('#name script').count()==0
            with page.expect_download() as download:
                page.locator('#download').click()
            assert download.value.suggested_filename=='cnc-local-result.json'
            page.screenshot(path='/tmp/cnc-local-desktop.png',full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path='/tmp/cnc-local-mobile.png',full_page=True)
            temp=payload.with_suffix('.tmp');temp.write_text(json.dumps(data(False)));temp.replace(payload)
            expect(page.locator('#state')).to_have_text('MẤT KẾT NỐI',timeout=10000)
            assert page.locator('#parts').inner_text()=='—'
            assert 'Test disconnected' in page.locator('#error').inner_text()
            assert all(url.startswith(f'http://localhost:{port}/') for url in urls),urls
            assert not errors,errors
            browser.close()
        reader=(PACKAGE/'FanucReader.cs').read_text()
        assert 'pmc_rd' not in reader and 'cnc_download' not in reader and 'cnc_wr' not in reader
        print('PASS: native reader unchanged; PowerShell syntax; loopback HTTP; Host/Origin/method/path guards; local UI telemetry, safe text, disconnect, mobile, JSON download; no external browser requests.')
    finally:
        process.terminate()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired: process.kill();process.wait()
