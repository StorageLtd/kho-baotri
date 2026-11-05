$ErrorActionPreference='Stop'
function Assert($ok,$message){if(-not $ok){throw $message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('pmc-runner-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
$source=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-pmc-background/Run-Background.ps1'
$path=Join-Path $folder 'Run-Background.ps1';Copy-Item $source $path
"function Get-LtdPowerShell {'mock-engine'}"|Set-Content (Join-Path $folder 'Background-Common.ps1')
@{machineId='test-machine'}|ConvertTo-Json|Set-Content (Join-Path $folder 'pmc-config.json')
Add-Type -TypeDefinition @'
using System;
public class BackgroundFakeProcess : IDisposable {
 public int Id {get{return 12345;}}public bool HasExited {get{return true;}}public int ExitCode {get{return 1;}}
 public void WaitForExit(){}public bool WaitForExit(int milliseconds){return true;}public void Kill(){throw new Exception("Unexpected kill");}public void Dispose(){}
}
'@
$global:RunnerStarts=0;$global:WorkerArgs='';$global:TestRoot=$folder
function Start-Process {
 param($FilePath,$ArgumentList,$WindowStyle,$WorkingDirectory,$RedirectStandardOutput,$RedirectStandardError,[switch]$PassThru)
 $global:RunnerStarts++;$global:WorkerArgs=$ArgumentList
 return (New-Object BackgroundFakeProcess)
}
function Start-Sleep {param($Seconds,$Milliseconds);$null=New-Item -ItemType File -Path (Join-Path $global:TestRoot 'background.stop') -Force}
try{
 & $path
 Assert ($global:RunnerStarts -eq 1 -and $global:WorkerArgs -match 'Read-PmcBackground.ps1' -and $global:WorkerArgs -notmatch 'Credential|Firebase|FanucBridge') 'Runner launched wrong/extra worker'
 Assert ((Get-Content (Join-Path $folder 'background-state.json') -Raw|ConvertFrom-Json).state -eq 'Stopped') 'Runner did not stop during retry wait'
 Assert ((Get-Content (Join-Path $folder 'logs/restart.log') -Raw) -match 'retry in 30s') 'Retry interval wrong'
 Remove-Item (Join-Path $folder 'background.stop')
 $lock=[IO.File]::Open((Join-Path $folder '.background.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{& $path;Assert ($global:RunnerStarts -eq 1) 'Duplicate runner launched another worker'}finally{$lock.Dispose()}
 Write-Output 'PASS: mocked runner, correct isolated worker, hidden launch, bounded retry, stop during retry and duplicate-run suppression.'
}finally{Remove-Item $folder -Recurse -Force}
