function Initialize-OfflineCollectors { $script:Workers=@{};$script:ImportedFiles=@{};$script:CollectorWarnings=@{} }
function Get-OfflineMachineKey([string]$Id){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Id)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Stop-OfflineWorker($Entry){
 try{[IO.File]::WriteAllText((Join-Path $Entry.folder 'stop'),'stop')}catch{}
 try{if(-not $Entry.process.HasExited){$Entry.process.Kill();$Entry.process.WaitForExit(2000)}}catch{}
}
function Sync-OfflineCollectors {
 $changed=$false
 foreach($id in @($script:Workers.Keys)){
  if(-not $script:Database.cncs.Contains($id)){Stop-OfflineWorker $script:Workers[$id];$script:Workers.Remove($id);continue}
 }
 foreach($id in @($script:Database.cncs.Keys)){
  $machine=$script:Database.cncs[$id]
  if($machine -isnot [Collections.IDictionary]){continue}
  $ip=$null;$valid=[Net.IPAddress]::TryParse([string]$machine.ip,[ref]$ip)
  if(-not $valid -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or -not ([string]$machine.ip -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)')){continue}
  $port=8193;if($machine.port -and -not [int]::TryParse([string]$machine.port,[ref]$port)){continue};if($port -lt 1 -or $port -gt 65535){continue}
  $config=@{machineId=$id;machineName=[string]$machine.name;cncIp=[string]$machine.ip;port=$port;pollSeconds=3;machineKind=$machine.machineKind;offsetTable=$machine.offsetTable;offsetProfileConfirmed=($machine.offsetProfileConfirmed -is [bool] -and $machine.offsetProfileConfirmed -eq $true);partCounterVerified=($machine.partCounterVerified -is [bool] -and $machine.partCounterVerified -eq $true);partsPerCount=1}
  $key=Get-OfflineMachineKey $id;$folder=Join-Path (Join-Path $script:OfflineFolder 'machines') $key;$signature=ConvertTo-Json -InputObject $config -Compress
  $entry=$script:Workers[$id]
  if($entry -and $entry.signature -ne $signature){Stop-OfflineWorker $entry;$script:Workers.Remove($id);$entry=$null}
  if($entry -and $entry.process.HasExited -and ([DateTime]::UtcNow-$entry.started).TotalSeconds -ge 30){$script:Workers.Remove($id);$entry=$null}
  if(-not $entry){
   $null=New-Item -ItemType Directory -Path $folder -Force;Write-OfflineJson (Join-Path $folder 'machine.json') $config
   if(Test-Path -LiteralPath (Join-Path $folder 'stop')){Remove-Item -LiteralPath (Join-Path $folder 'stop') -Force}
   Write-OfflineJson (Join-Path $folder 'latest.json') @{source='focas';connected=$false;readErrors=@{connection='Đang chờ lần đọc mới từ CNC.'}}
   $exe=Join-Path $PSHOME 'powershell.exe';$workerArguments='-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+(Join-Path $PSScriptRoot 'Worker.ps1')+'" -Folder "'+$folder+'" -Library "'+(Join-Path $PSScriptRoot 'lib')+'" -ParentPid '+$PID+' -ParentStartTicks '+([Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks)
   $process=Start-Process -FilePath $exe -ArgumentList $workerArguments -WindowStyle Hidden -PassThru
   $entry=@{process=$process;folder=$folder;signature=$signature;started=[DateTime]::UtcNow};$script:Workers[$id]=$entry
  }
  try{
   $latest=Join-Path $folder 'latest.json'
   if(Test-Path -LiteralPath $latest){
    $stamp=(Get-Item -LiteralPath $latest).LastWriteTimeUtc.Ticks
    if($script:ImportedFiles[$latest] -ne $stamp){$payload=Read-OfflineJson $latest;foreach($k in $payload.Keys){$machine[$k]=$payload[$k]};$script:ImportedFiles[$latest]=$stamp;$changed=$true}
   }
   $alarms=Join-Path $folder ('alarms-'+$id+'-offline.json')
   if(Test-Path -LiteralPath $alarms){
    $stamp=(Get-Item -LiteralPath $alarms).LastWriteTimeUtc.Ticks
    if($script:ImportedFiles[$alarms] -ne $stamp){$state=Read-OfflineJson $alarms;foreach($alarmId in $state.pending.Keys){$script:Database.cncAlarms[$alarmId]=$state.pending[$alarmId]};$script:ImportedFiles[$alarms]=$stamp;$changed=$true}
   }
   $reportFolder=Join-Path $folder 'reports'
   if(Test-Path -LiteralPath $reportFolder){foreach($file in Get-ChildItem -LiteralPath $reportFolder -Filter '*.json' -File){
    if($script:ImportedFiles[$file.FullName] -eq $file.LastWriteTimeUtc.Ticks){continue}
    $row=Read-OfflineJson $file.FullName
    if($row.machineId -ne $id -or $row.source -ne 'focas'){continue}
    Set-OfflineNode $script:Database @('cncReports',$id,[string]$row.date,[string]$row.sessionId) $row
    $script:ImportedFiles[$file.FullName]=$file.LastWriteTimeUtc.Ticks;$changed=$true
   }}
  }catch{$script:CollectorWarnings[$id]=$_.Exception.Message}
 }
 if($changed){Write-OfflineJson $script:DatabasePath $script:Database}
}
function Close-OfflineCollectors {foreach($entry in $script:Workers.Values){Stop-OfflineWorker $entry}}
