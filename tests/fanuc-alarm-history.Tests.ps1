$ErrorActionPreference='Stop'
$path=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/Start-FanucBridge.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$null,[ref]$null)
foreach($f in $ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($f.Extent.Text))}
function Assert($ok,$message){if(-not $ok){throw $message}}
function Update-BridgeToken($Config){}
$script:Writes=@();$script:FailUpload=$false
function Invoke-BridgeHttp($Uri,$Method,$Body,$Operation){if($script:FailUpload){throw 'HTTP 401'};$script:Writes+=@{uri=$Uri;method=$Method;body=($Body|ConvertTo-Json -Depth 10|ConvertFrom-Json)}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('alarm-test-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
try {
$config=@{machineId='neway-1260s';machineName='Neway 1260S';databaseUrl='https://fixture.invalid'}
$script:Auth=@{idToken='fixture';uid='user1'}
Initialize-BridgeAlarmHistory $folder $config.machineId 'user1'
$sample=[pscustomobject]@{timestampUtc='2026-10-30T02:00:00Z';alarmDetailsRead=$true;alarmsMayBeTruncated=$false;alarmDetails=@([pscustomobject]@{number=500;type=4;axis=1;message='OVERTRAVEL'})}
Add-BridgeAlarmSample $config $sample
Assert ($script:AlarmPending.Count -eq 1) 'Alarm not saved immediately'
$firstId=@($script:AlarmPending.Keys)[0]
$script:FailUpload=$true
try{Send-PendingBridgeAlarms $config}catch{}
Assert ($script:AlarmPending.Count -eq 1) 'Failed upload lost alarm'
Initialize-BridgeAlarmHistory $folder $config.machineId 'user1'
Assert ($script:AlarmPending.ContainsKey($firstId)) 'Restart lost stable event ID'
$script:FailUpload=$false
Send-PendingBridgeAlarms $config
Add-BridgeAlarmSample $config $sample
Assert ($script:AlarmPending.Count -eq 0 -and $script:Writes.Count -eq 1) 'Repeated sample duplicated alarm'
$sample.alarmDetailsRead=$false;$sample.alarmDetails=@()
Add-BridgeAlarmSample $config $sample
Assert ($script:AlarmActive.Count -eq 1) 'Failed read incorrectly cleared alarm'
$sample.alarmDetailsRead=$true;$sample.alarmsMayBeTruncated=$true
Add-BridgeAlarmSample $config $sample
Assert ($script:AlarmActive.Count -eq 1) 'Partial list incorrectly cleared alarm'
$sample.alarmsMayBeTruncated=$false;$sample.timestampUtc='2026-10-30T02:01:00Z'
Add-BridgeAlarmSample $config $sample
Send-PendingBridgeAlarms $config
Assert ($script:AlarmActive.Count -eq 0 -and $script:Writes[1].body.id -eq $firstId -and $script:Writes[1].body.resolvedAt -eq $sample.timestampUtc) 'Alarm closure failed'
$sample.alarmDetails=@([pscustomobject]@{number=500;type=4;axis=1;message='OVERTRAVEL'},[pscustomobject]@{number=501;type=4;axis=2;message='SECOND'})
Add-BridgeAlarmSample $config $sample
Assert ($script:AlarmPending.Count -eq 2 -and -not $script:AlarmPending.ContainsKey($firstId)) 'Recurrence/multiple alarms not separated'
foreach($write in $script:Writes){Assert ($write.uri -like 'https://fixture.invalid/cncAlarms/focas-*.json?auth=*' -and $write.method -eq 'PATCH') 'Unexpected cloud destination or root replacement'}
Assert (-not ((Get-Content $script:AlarmStatePath -Raw).Contains('fixture'))) 'Credential persisted'
Write-Output 'PASS: immediate durable capture, no duplicates, restart/retry stable IDs, failed/partial reads preserve alarms, closure, recurrence and multiple alarms; only per-event cloud writes.'
} finally {Remove-Item $folder -Recurse -Force}
