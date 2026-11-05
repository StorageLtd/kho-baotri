$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
public static class PmcReadOnlyProbe {
 public static string AccessMode {get{return "FIXED_PMC_READ_ONLY_X10_R423_V1";}}
 public static int Opens,Reads,Frees;public static bool Fail;
 public static Session Open(string ip,ushort port,string directory){Opens++;Reads=0;return new Session();}
 public sealed class Snapshot {public string startedUtc,xReadUtc,rReadUtc,finishedUtc;public byte x10Byte,r423Byte;public bool x10Bit1,r423Bit6;}
 public sealed class Session : IDisposable {
 public Snapshot Read(){Reads++;if(Fail)throw new InvalidOperationException("Fixture FOCAS -16");var t=DateTime.UtcNow.ToString("o");return new Snapshot{startedUtc=t,xReadUtc=t,rReadUtc=t,finishedUtc=t,x10Byte=2,r423Byte=64,x10Bit1=true,r423Bit6=true};}
 public void Dispose(){Frees++;}
 }
}
'@
function Assert($ok,$message){if(-not $ok){throw $message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('pmc-worker-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
$source=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-pmc-background/Read-PmcBackground.ps1'
$path=Join-Path $folder 'Read-PmcBackground.ps1';Copy-Item $source $path
@{machineId='test-machine';cncIp='192.168.1.2';port=8193;intervalMs=500}|ConvertTo-Json|Set-Content (Join-Path $folder 'pmc-config.json')
try{
 & $path -Once
 $state=Get-Content (Join-Path $folder 'pmc-status.json') -Raw|ConvertFrom-Json
 Assert ($state.state -eq 'Connected' -and $state.sample.x10Bit1 -and $state.sample.r423Bit6) ('Live state not saved: '+$state.message)
 Assert ([PmcReadOnlyProbe]::Opens -eq 1 -and [PmcReadOnlyProbe]::Frees -eq 1) 'Probe was not released'
 $csv=Join-Path $folder 'logs/pmc-current.csv'
 $rows=@(Import-Csv $csv)
 Assert ($rows.Count -eq 1 -and $rows[0].xRiseObserved -eq 'False') 'Initial ON invented a button press'
 [PmcReadOnlyProbe]::Fail=$true
 & $path -Once
 $state=Get-Content (Join-Path $folder 'pmc-status.json') -Raw|ConvertFrom-Json
 Assert ($state.state -eq 'Waiting' -and -not $state.sample -and $state.message -match 'FOCAS -16') 'Read failure invented signal values'
 Assert ([PmcReadOnlyProbe]::Frees -eq 2) 'Read failure leaked probe connection'
 Assert (@(Import-Csv $csv).Count -eq 1) 'Failed read appended fake zeros'
 [PmcReadOnlyProbe]::Fail=$false
 & $path -Once
 Assert (@(Import-Csv $csv).Count -eq 2) 'Reconnection did not resume local logging'
 # Log rotation must bound disk usage without dropping the current successful sample.
 [IO.File]::AppendAllText($csv,(' '*2097152))
 & $path -Once
 Assert (Test-Path (Join-Path $folder 'logs/pmc-previous.csv')) 'Log did not rotate'
 Assert (@(Import-Csv $csv).Count -eq 1) 'Current log after rotation lost its header/sample'
 $null=New-Item -ItemType File (Join-Path $folder 'background.stop')
 & $path -Once
 Assert ([PmcReadOnlyProbe]::Opens -eq 4) 'Stopped worker opened a new CNC connection'
 Write-Output 'PASS: mocked worker reads, local CSV/state, no invented first edge, failure state without zeros, cleanup, reconnect and persistent stop.'
}finally{Remove-Item $folder -Recurse -Force}
