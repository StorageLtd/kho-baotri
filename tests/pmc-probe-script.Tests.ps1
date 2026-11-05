$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
public static class PmcReadOnlyProbe {
 public static string AccessMode { get { return "FIXED_PMC_READ_ONLY_X10_R423_V1"; } }
 public static int OpenCalls,FreeCalls,Reads,FailAt;
 public static Session Open(string ip,ushort port,string directory){OpenCalls++;Reads=0;return new Session();}
 public sealed class Snapshot {public string startedUtc,xReadUtc,rReadUtc,finishedUtc;public byte x10Byte,r423Byte;public bool x10Bit1,r423Bit6;}
 public sealed class Session : IDisposable {
  public Snapshot Read(){Reads++;if(FailAt==Reads)throw new InvalidOperationException("Fixture native read error");string t=DateTime.UtcNow.ToString("o");return new Snapshot{startedUtc=t,xReadUtc=t,rReadUtc=t,finishedUtc=t,x10Byte=(byte)(Reads%2==1?2:0),r423Byte=(byte)(Reads==2?64:0),x10Bit1=Reads%2==1,r423Bit6=Reads==2};}
  public void Dispose(){FreeCalls++;}
 }
}
'@
function Assert($value,$message){if(-not $value){throw $message}}
$scriptPath=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-pmc-readonly-test/Test-PmcReadOnly.ps1'
$folder=Join-Path ([IO.Path]::GetTempPath()) ('pmc-script-test-'+[guid]::NewGuid().ToString('N'))
try{
 & $scriptPath -Samples 3 -IntervalMs 500 -OutputDirectory (Join-Path $folder 'success')
 Assert ([PmcReadOnlyProbe]::OpenCalls -eq 1 -and [PmcReadOnlyProbe]::FreeCalls -eq 1 -and [PmcReadOnlyProbe]::Reads -eq 3) 'Probe did not open/read/release exactly once'
 $file=Get-ChildItem (Join-Path $folder 'success') -Filter '*.csv'
 $rows=@(Import-Csv $file.FullName)
 Assert ($rows.Count -eq 3 -and $rows[0].xRiseObserved -eq 'False' -and $rows[2].xRiseObserved -eq 'True') 'First sample invented a rising edge or transition was lost'
 Assert ($rows[1].r423Bit6 -eq 'True' -and $rows[1].rRiseObserved -eq 'True') 'R signal transition wrong'
 [PmcReadOnlyProbe]::FailAt=2
 & $scriptPath -Samples 3 -IntervalMs 500 -OutputDirectory (Join-Path $folder 'failure')
 Assert ([PmcReadOnlyProbe]::FreeCalls -eq 2 -and [PmcReadOnlyProbe]::Reads -eq 2) 'Failed read did not stop/release'
 $retained=@(Import-Csv (Get-ChildItem (Join-Path $folder 'failure') -Filter '*.csv').FullName)
 Assert ($retained.Count -eq 1) 'Failed read invented zero values or lost a previous valid sample'
 Write-Output 'PASS: mocked full script; bounded sample count, one shared connection, local CSV, transition semantics, error stop, retained valid sample and connection cleanup.'
}finally{if(Test-Path $folder){Remove-Item $folder -Recurse -Force}}
