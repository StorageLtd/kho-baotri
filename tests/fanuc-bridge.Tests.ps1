$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $root 'tools/fanuc-bridge/Start-FanucBridge.ps1'
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($function in $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
    . ([scriptblock]::Create($function.Extent.Text))
}
function Assert-True($Value, $Message) { if (-not $Value) { throw $Message } }
$config = Get-Content (Join-Path $root 'tools/fanuc-bridge/bridge-config.json') -Raw | ConvertFrom-Json
$sample = [pscustomobject]@{ timestampUtc = '2026-10-28T08:29:50Z'; cncType = '0'; series = 'D4G5'; version = '05.0'; axes = '03'; rawStatus = [pscustomobject]@{run=0;alarm=0;emergency=0;aut=0} }
foreach ($case in @(@(0,'idle'),@(1,'idle'),@(2,'hold'),@(3,'running'),@(4,'idle'),@(99,'unknown'))) {
    $sample.rawStatus.run = $case[0]; $payload = New-BridgePayload $sample
    Assert-True ($payload.status -eq $case[1]) 'Incorrect RUN mapping'
    Assert-True ($payload.lastSeen['.sv'] -eq 'timestamp') 'Heartbeat must use Firebase server time'
    Assert-True ($null -eq $payload.spindleSpeed -and $null -eq $payload.activeProgram) 'Unmeasured telemetry must not be fabricated'
}
$sample.rawStatus.alarm = 1; Assert-True ((New-BridgePayload $sample).status -eq 'alarm') 'Alarm flag ignored'
$sample.rawStatus.alarm = 0; $sample.rawStatus.emergency = 1; Assert-True ((New-BridgePayload $sample).status -eq 'alarm') 'Emergency flag ignored'
$global:BridgeTest_existingResponse = $null
$global:BridgeTest_collision = $false
$global:BridgeTest_calls = @(); $global:BridgeTest_verified = $true; $global:BridgeTest_role = 'technician'; $global:BridgeTest_failHttp = $false
function Invoke-RestMethod {
    param($Uri,$Method,$Body,$ContentType,$TimeoutSec,$ErrorAction,$Verbose,$Debug)
    if ($global:BridgeTest_failHttp) { throw ('sensitive URL ' + $Uri) }
    $global:BridgeTest_calls += [pscustomobject]@{ Uri=$Uri; Method=$Method; Body=$Body; ContentType=$ContentType }
    if ($Uri -like '*signInWithPassword*') {
        $decoded=$Body|ConvertFrom-Json
        Assert-True ($decoded.password -eq 'fixture-password') 'SecureString credential conversion failed'
        return [pscustomobject]@{idToken='fixture-id-token';refreshToken='fixture-refresh';localId='fixture-uid';expiresIn='3600'}
    }
    if ($Uri -like '*accounts:lookup*') { return [pscustomobject]@{users=@([pscustomobject]@{emailVerified=$global:BridgeTest_verified})} }
    if ($Uri -like '*/users/*') { return [pscustomobject]@{role=$global:BridgeTest_role} }
    if ($Uri -like '*securetoken.googleapis.com*') { return [pscustomobject]@{id_token='renewed-id';refresh_token='renewed-refresh';expires_in='3600'} }
    if ($Uri -like '*/cncs/*' -and $Method -eq 'GET') { if($global:BridgeTest_collision){return [pscustomobject]@{id='someone-else';name='Another machine'}}; return $global:BridgeTest_existingResponse }
    return [pscustomobject]@{ok=$true}
}
# Reproduce the Windows PowerShell scalar response that previously caused a false collision.
foreach ($raw in @('null', '  null  ')) {
    $global:BridgeTest_existingResponse=$raw
    $empty=Invoke-BridgeHttp 'https://example.invalid/cncs/neway-1260s.json' 'GET' $null 'Fixture'
    Assert-True ($null -eq $empty) 'JSON null string must represent an absent record'
}
$global:BridgeTest_existingResponse='{"id":"neway-1260s","name":"Neway 1260S"}'
$decoded=Invoke-BridgeHttp 'https://example.invalid/cncs/neway-1260s.json' 'GET' $null 'Fixture'
Assert-True ($decoded.id -eq 'neway-1260s') 'JSON object string was not decoded'
$global:BridgeTest_existingResponse=$null
$password=ConvertTo-SecureString 'fixture-password' -AsPlainText -Force
Connect-BridgeAccount $config 'fixture@example.invalid' $password
Assert-True ($script:Auth.uid -eq 'fixture-uid') 'Account initialization failed'
Send-BridgePatch $config (New-BridgePayload $sample)
$last=$global:BridgeTest_calls[-1]
Assert-True ($last.Method -eq 'PATCH' -and $last.Uri -like '*/cncs/neway-1260s.json?auth=*') 'Must patch only the selected machine'
Assert-True ($last.Body -notmatch 'fixture-password|fixture-refresh|fixture-id-token') 'Credentials leaked into telemetry'
$script:Auth.expires=[DateTime]::UtcNow.AddSeconds(-1)
Send-BridgePatch $config @{connected=$false;status='offline'}
Assert-True ($script:Auth.idToken -eq 'renewed-id') 'Token did not refresh'
Assert-True ($global:BridgeTest_calls[-1].Uri -like '*auth=renewed-id') 'Patch did not use renewed token'
$global:BridgeTest_verified=$false;$denied=$false
try { Connect-BridgeAccount $config 'fixture@example.invalid' $password } catch { $denied=$true }
Assert-True $denied 'Unverified email accepted'
$global:BridgeTest_verified=$true;$global:BridgeTest_role='viewer';$denied=$false
try { Connect-BridgeAccount $config 'fixture@example.invalid' $password } catch { $denied=$true }
Assert-True $denied 'Viewer allowed to send telemetry'
$global:BridgeTest_failHttp=$true;$safe=$false
try { Invoke-BridgeHttp 'https://example.invalid/?auth=TOP_SECRET' 'GET' $null 'Read' } catch { $safe=$_.Exception.Message -notmatch 'TOP_SECRET|example.invalid' }
Assert-True $safe 'HTTP errors disclosed credentials or URL'
$password.Dispose()
Write-Output 'PASS: PowerShell syntax, secure credential conversion, raw-state mapping, verified email/role checks, per-machine PATCH, server timestamps, token refresh, no secret leakage in payload/errors.'
# Exercise the complete script with a fake native reader and fake HTTPS transport.
# No DLL, CNC, Firebase account, or production cloud data is used by these tests.
Add-Type -TypeDefinition @'
using System;
public class FixtureRaw { public int run=3, alarm=0, emergency=0, aut=1; }
public class FixtureSnapshot {
 public string timestampUtc=DateTime.UtcNow.ToString("o"),cncType="0",series="D4G5",version="05.0",axes="03";
 public FixtureRaw rawStatus=new FixtureRaw();
}
public static class FanucReader { public static int Calls; public static FixtureSnapshot Read(string ip,ushort port,string folder) { Calls++;return new FixtureSnapshot(); } }
'@
$fixtureDirectory=Join-Path ([IO.Path]::GetTempPath()) ('fanuc-bridge-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $fixtureDirectory
try {
    Copy-Item $scriptPath (Join-Path $fixtureDirectory 'Start-FanucBridge.ps1')
    Copy-Item (Join-Path $root 'tools/fanuc-bridge/bridge-config.json') (Join-Path $fixtureDirectory 'bridge-config.json')
    $global:BridgeTest_failHttp=$false;$global:BridgeTest_role='technician';$global:BridgeTest_verified=$true;$global:BridgeTest_calls=@()
    function Read-Host { param($Prompt,[switch]$AsSecureString); if($AsSecureString){return (ConvertTo-SecureString 'fixture-password' -AsPlainText -Force)};return 'fixture@example.invalid' }
    $before=[FanucReader]::Calls
    & (Join-Path $fixtureDirectory 'Start-FanucBridge.ps1') -Once -LocalOnly
    Assert-True ([FanucReader]::Calls -eq $before+1) 'Local-only mode did not read exactly once'
    Assert-True ($global:BridgeTest_calls.Count -eq 0) 'Local-only mode unexpectedly accessed the network'
    Assert-True (Test-Path (Join-Path $fixtureDirectory 'last-result.json')) 'Local result was not saved'
    $global:BridgeTest_existingResponse='null'
    $before=[FanucReader]::Calls
    & (Join-Path $fixtureDirectory 'Start-FanucBridge.ps1') -Once
    Assert-True ([FanucReader]::Calls -eq $before+2) 'Must discard sample taken before authentication and obtain a fresh one'
    $patches=@($global:BridgeTest_calls | Where-Object Method -eq 'PATCH')
    Assert-True ($patches.Count -eq 3) 'Expected metadata registration, live sample, and orderly offline patches'
    $telemetry=$patches[1].Body|ConvertFrom-Json
    Assert-True ($telemetry.status -eq 'running' -and $telemetry.connected -eq $true) 'Full bridge did not send measured telemetry'
    $metadata=$patches[0].Body|ConvertFrom-Json
    Assert-True ($metadata.name -eq 'Neway 1260S' -and $metadata.id -eq 'neway-1260s') 'Wrong machine registered'
    $offline=$patches[-1].Body|ConvertFrom-Json
    Assert-True ($offline.connected -eq $false) 'Orderly stop did not mark disconnected'
    # Auth lives in the child script scope and is explicitly cleared in its finally block.
    Write-Output 'PASS: complete local/cloud bridge execution with mocked native API and HTTPS, first-sample refresh, Neway registration, live upload, and orderly offline cleanup.'
    $global:BridgeTest_calls=@();$global:BridgeTest_collision=$true
    & (Join-Path $fixtureDirectory 'Start-FanucBridge.ps1') -Once
    Assert-True (@($global:BridgeTest_calls | Where-Object Method -eq 'PATCH').Count -eq 0) 'Collision failure or cleanup unexpectedly modified a different machine'
    Write-Output 'PASS: machine identity collision is rejected without any cloud writes, including cleanup.'

} finally {
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force
}

exit 0
