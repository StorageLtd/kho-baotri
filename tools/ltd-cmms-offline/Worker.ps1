[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Folder,[Parameter(Mandatory=$true)][string]$Library,[int]$ParentPid=0,[long]$ParentStartTicks=0)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Offline.Core.ps1')
. (Join-Path $PSScriptRoot 'ReportCollector.ps1')
. (Join-Path $PSScriptRoot 'Telemetry.ps1')
$lock=$null
try {
 $lock=[IO.File]::Open((Join-Path $Folder '.worker.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $config=Read-OfflineJson (Join-Path $Folder 'machine.json')
 foreach($dll in @('Fwlib64.dll','fwlibe64.dll','fwlib30i64.dll')){if(-not [IO.File]::Exists((Join-Path $Library $dll))){throw ('Missing licensed DLL: '+$dll)}}
 Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs')
 if([FanucReader]::AccessMode -ne 'FOCAS_STATUS_ONLY_V1'){throw 'Wrong reader mode'}
 $reports=Join-Path $Folder 'reports';Initialize-CncReports $reports $config.machineId 'offline' $config
 Initialize-BridgeAlarmHistory $Folder $config.machineId 'offline'
 $verified=$config.machineKind -eq 'mill-3axis' -and $config.offsetTable -in @('m-a','m-b','m-c') -and $config.offsetProfileConfirmed -eq $true
 while(-not (Test-Path -LiteralPath (Join-Path $Folder 'stop'))){
  if($ParentPid){try{$parent=[Diagnostics.Process]::GetProcessById($ParentPid);if($parent.StartTime.ToUniversalTime().Ticks -ne $ParentStartTicks){break}}catch{break}}
  try{
   $sample=[FanucReader]::ReadWithContext([string]$config.cncIp,[UInt16]$config.port,$Library,[bool]$verified,[string]$config.offsetTable)
   $payload=New-BridgePayload $sample
   try{Add-CncReportSample $sample;Add-BridgeAlarmSample $config $sample}catch{$payload.storageWarning='Local history not fully saved: '+$_.Exception.Message}
   Write-OfflineJson (Join-Path $Folder 'latest.json') $payload
  }catch{
   Break-CncReportObservation
   Write-OfflineJson (Join-Path $Folder 'latest.json') @{source='focas';connected=$false;readerMode='focas-status-only';pmcEnabled=$false;readErrors=@{connection=$_.Exception.GetBaseException().Message};sampledAt=[DateTime]::UtcNow.ToString('o')}
  }
  Start-Sleep -Seconds ([int]$config.pollSeconds)
 }
}catch{try{Write-OfflineJson (Join-Path $Folder 'latest.json') @{source='focas';connected=$false;readErrors=@{startup=$_.Exception.GetBaseException().Message}}}catch{}}
finally{try{Close-CncReports}catch{};if($lock){$lock.Dispose()}}
