$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/ReportCollector.ps1')
function Assert-True($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('cnc-report-test-'+[guid]::NewGuid().ToString('N'))
$config=[pscustomobject]@{machineId='neway-1260s';databaseUrl='https://example.invalid';partCounterVerified=$false;partsPerCount=1}
$script:Auth=@{uid='test-owner';idToken='fixture-token'}
function Update-BridgeToken($Config){}
$global:TestReportFail=$true;$global:TestReportStore=@{}
function Invoke-BridgeHttp($Uri,$Method,$Body,$Operation){if($global:TestReportFail){throw 'Fixture network offline'};$global:TestReportStore[$Uri]=$Body}
function Sample([string]$Time,[int]$Run,$Counter){return [pscustomobject]@{timestampUtc=$Time;rawStatus=[pscustomobject]@{run=$Run;alarm=0;emergency=0};partCounter=$Counter}}
try{
 Initialize-CncReports $folder $config.machineId 'test-owner' $config
 Add-CncReportSample (Sample '2026-10-28T23:59:58+07:00' 3 100)
 Add-CncReportSample (Sample '2026-10-29T00:00:03+07:00' 2 101)
 Add-CncReportSample (Sample '2026-10-29T00:00:08+07:00' 0 102)
 Add-CncReportSample (Sample '2026-10-29T00:00:13+07:00' 0 0)
 Add-CncReportSample (Sample '2026-10-29T00:00:18+07:00' 3 1)
 Add-CncReportSample (Sample '2026-10-29T00:00:48+07:00' 3 20)
 Break-CncReportObservation
 Add-CncReportSample (Sample '2026-10-29T00:00:53+07:00' 3 21)
 $a=$script:ReportDays['2026-10-28'];$b=$script:ReportDays['2026-10-29']
 Assert-True ($a.runningMs -eq 2000 -and $b.runningMs -eq 3000) 'Midnight split or preceding-state assignment wrong'
 Assert-True ($b.holdMs -eq 5000 -and $b.idleMs -eq 10000) 'HOLD/idle time wrong'
 Assert-True ($b.observedMs -eq 18000 -and $b.gapCount -eq 1) 'Long gap incorrectly counted'
 Assert-True ($a.counterObservedMs -eq 2000 -and $b.counterObservedMs -eq 13000) 'Counter observation coverage not split or reset excluded'
 Assert-True ($b.counterDelta -eq 3 -and $b.counterResets -eq 1) 'Counter reset/gap produced incorrect production'
 Add-CncReportSample (Sample '2026-10-29T00:00:05+07:00' 3 999)
 Assert-True ($b.observedMs -eq 18000 -and $b.counterDelta -eq 3) 'Clock rollback double-counted a previously observed interval'
 Assert-True (@(Get-ChildItem $folder -Filter '*.json').Count -eq 2) 'Daily outbox snapshots not saved'
 try{Send-PendingCncReports $config -Force}catch{}
 Assert-True (@(Get-ChildItem $folder -Filter '*.json').Count -eq 2) 'Network failure lost pending reports'
 $global:TestReportFail=$false;Send-PendingCncReports $config -Force
 Assert-True (@(Get-ChildItem $folder -Filter '*.json').Count -eq 0) 'Successful upload not acknowledged'
 Assert-True ($global:TestReportStore.Count -eq 2) 'Wrong number of per-session daily records'
 $alarmFile=Join-Path $folder 'alarms-neway-1260s-test-owner.json'
 '{"uid":"test-owner","active":{},"pending":{}}' | Set-Content $alarmFile
 Save-CncReportDay $b;Send-PendingCncReports $config -Force
 Assert-True (Test-Path $alarmFile) 'Report sender removed alarm state'
 Assert-True ($global:TestReportStore.Count -eq 2) 'Alarm state mistaken for daily report'
 Assert-True ($global:TestReportStore.Count -eq 2) 'Retry did not use deterministic cloud key'
 foreach($record in $global:TestReportStore.Values){Assert-True ($record.observedMs -eq $record.runningMs+$record.idleMs+$record.holdMs+$record.alarmMs+$record.unknownStateMs) 'Time totals inconsistent'}
 Write-Output 'PASS: local daily collection, Vietnam midnight split, running/HOLD/idle, reset and gaps, offline persistence, idempotent retry, consistent totals.'
}finally{Close-CncReports;if(Test-Path $folder){Remove-Item $folder -Recurse -Force}}
