$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -Path @((Join-Path $root 'tools/fanuc-program-transfer/FanucReader.cs'),(Join-Path $root 'tools/fanuc-program-transfer/ProgramTransfer.cs'))
function Assert($ok,$message){if(-not $ok){throw $message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('transfer-test-'+[Guid]::NewGuid().ToString('N'));$null=New-Item -ItemType Directory $folder
try{
 $file=Join-Path $folder 'one.nc'
 [IO.File]::WriteAllText($file,"%`nO1234 (TEST)`nG90 G54`nM30`n%`n",[Text.Encoding]::ASCII)
 $valid=[FanucProgramTransfer]::ValidateFile($file)
 Assert ($valid.Program -eq 'O1234' -and $valid.Hash.Length -eq 64 -and $valid.Bytes.Length -gt 0) 'Valid file not recognized'
 foreach($bad in @("%`nO9000`nM30`n%","%`nO1234`nM30`nO1235`nM30`n%","O1234`nM30","%`nO1234 (bad`nM30`n%","%`nO1234`nM99`n%","%`nG90`nO1234`nM30`n%","%`nO1234`nN10 O1235`nM30`n%")){
  [IO.File]::WriteAllText($file,$bad,[Text.Encoding]::ASCII);$rejected=$false;try{$null=[FanucProgramTransfer]::ValidateFile($file)}catch{$rejected=$true};Assert $rejected 'Unsafe / unsupported file accepted'
 }
 [IO.File]::WriteAllText($file,"%`nO1234`nM30`n%",[Text.Encoding]::ASCII)
 $valid=[FanucProgramTransfer]::ValidateFile($file)
 foreach($confirmation in @('','TRUYEN O0001','truyen O1234')){
  $rejected=$false;try{$null=[FanucProgramTransfer]::Send('192.168.1.1',8193,'missing',$file,$valid.Hash,$confirmation)}catch{$rejected=$_.Exception.GetBaseException().Message -like '*Type exactly*'};Assert $rejected 'Confirmation gate did not block before native access'
 }
 $rejected=$false;try{$null=[FanucProgramTransfer]::Send('192.168.1.1',8193,'missing',$file,'wrong','TRUYEN O1234')}catch{$rejected=$_.Exception.GetBaseException().Message -like '*File changed*'};Assert $rejected 'File hash gate failed'
 foreach($ip in @('8.8.8.8','127.0.0.1','224.1.2.3')){$rejected=$false;try{[FanucProgramTransfer]::ValidateTarget($ip,8193)}catch{$rejected=$true};Assert $rejected 'Public / invalid transfer target allowed'}
 [FanucProgramTransfer]::ValidateTarget('192.168.1.2',8193)
 foreach($case in @(@(1,3,0,0),@(3,3,0,0),@(3,0,1,0),@(3,0,0,1))){$rejected=$false;try{[FanucProgramTransfer]::ValidateMachineState($case[0],$case[1],$case[2],$case[3])}catch{$rejected=$true};Assert $rejected 'Stopped EDIT / no-alarm gate failed'}
 [FanucProgramTransfer]::ValidateMachineState(3,0,0,0)
 [FanucProgramTransfer]::ValidatePath(1,1)
 $rejected=$false;try{[FanucProgramTransfer]::ValidatePath(1,2)}catch{$rejected=$true};Assert $rejected 'Ambiguous CNC channel allowed'
 foreach($case in @(@(1,1234),@(1,1233),@(2,0))){$rejected=$false;try{[FanucProgramTransfer]::ValidateDirectory($case[0],$case[1],1234)}catch{$rejected=$true};Assert $rejected 'Duplicate / ambiguous directory gate failed'}
 [FanucProgramTransfer]::ValidateDirectory(0,0,1234)
 [FanucProgramTransfer]::ValidateDirectory(1,1235,1234)
 $source=Get-Content (Join-Path $root 'tools/fanuc-program-transfer/ProgramTransfer.cs') -Raw
 Assert ($source -notmatch 'cnc_(delete|start\(|search|wr|set|pmc)') 'Unexpected control/write API beyond download'
 Write-Output 'PASS: separate transfer file/ASCII/O-number limits, duplicate/reserved rejection, hash and exact confirmation gates before native calls; private target validation; no start/delete/offset/PMC APIs. No CNC was contacted.'
} finally {Remove-Item $folder -Recurse -Force}
