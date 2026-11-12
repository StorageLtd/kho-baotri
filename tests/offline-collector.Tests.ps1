$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/ltd-cmms-offline'
. (Join-Path $root 'Offline.Core.ps1')
. (Join-Path $root 'Telemetry.ps1')
. (Join-Path $root 'ReportCollector.ps1')
function Assert($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('offline-collector-'+[Guid]::NewGuid().ToString('N'));$null=New-Item -ItemType Directory -Path $folder
try {
 $config=@{machineId='machine';machineName='Offline Fixture';partCounterVerified=$false;partsPerCount=1}
 Initialize-BridgeAlarmHistory $folder 'machine' 'offline'
 Initialize-CncReports (Join-Path $folder 'reports') 'machine' 'offline' $config
 function Sample($Time,$Run,$Counter,$Alarms){return [pscustomobject]@{timestampUtc=$Time;rawStatus=@{run=$Run;alarm=0;emergency=0};partCounter=$Counter;alarmDetailsRead=$true;alarmDetails=$Alarms;alarmsMayBeTruncated=$false;fullProgram=$null;readErrors=@{}}}
 $detail=@{type=15;number=1163;axis=0;message='STARTING THE OIL COOLER'}
 $a=Sample '2026-11-11T23:59:58+07:00' 3 20 @($detail)
 $b=Sample '2026-11-12T00:00:03+07:00' 2 21 @($detail)
 $c=Sample '2026-11-12T00:00:08+07:00' 0 21 @()
 Add-CncReportSample $a;Add-CncReportSample $b;Add-CncReportSample $c
 Assert ($script:ReportDays['2026-11-11'].runningMs -eq 2000) 'Vietnam midnight split failed'
 Assert ($script:ReportDays['2026-11-12'].runningMs -eq 3000 -and $script:ReportDays['2026-11-12'].holdMs -eq 5000) 'Daily durations failed'
 Add-BridgeAlarmSample $config $a;Add-BridgeAlarmSample $config $b;Assert ($script:AlarmPending.Count -eq 1) 'Repeated alarm created duplicate event'
 Add-BridgeAlarmSample $config $c;Assert ($script:AlarmPending.Count -eq 1 -and $script:AlarmActive.Count -eq 0) 'Alarm closure lost event'
 $state=Read-OfflineJson (Join-Path $folder 'alarms-machine-offline.json');$entry=@($state.pending.Values)[0]
 Assert ($entry.alarmType -eq 15 -and [DateTimeOffset]::Parse($entry.resolvedAt) -eq [DateTimeOffset]::Parse($c.timestampUtc)) 'Stored alarm metadata/closure wrong'
 $payload=New-BridgePayload $b;Assert ($payload.source -eq 'focas' -and $payload.pmcEnabled -eq $false -and $payload.connected -eq $true) 'Offline telemetry mapping wrong'
 Assert ($payload.lastSeen -is [long]) 'Local timestamps not resolved'
 foreach($name in @('ReportCollector.ps1','Telemetry.ps1','Offline.Core.ps1','Worker.ps1')){
  $text=[IO.File]::ReadAllText((Join-Path $root $name));Assert ($text -notmatch 'Invoke-RestMethod|Invoke-WebRequest|https://|FirebaseApiKey|databaseUrl|Update-BridgeToken') ('Unexpected cloud transport in '+$name)
 }
 Assert ([IO.File]::ReadAllText((Join-Path $root 'FanucReader.cs')) -ceq [IO.File]::ReadAllText((Join-Path (Split-Path $root -Parent) 'fanuc-bridge/FanucReader.cs'))) 'Canonical read-only reader changed'
 Write-Output 'PASS: offline collector persists daily reports and alarm lifecycle, no cloud sender, canonical CNC read-only source unchanged; no native calls.'
}finally{Close-CncReports;if(Test-Path -LiteralPath $folder){Remove-Item -LiteralPath $folder -Recurse -Force}}
