$ErrorActionPreference='Stop'
$path=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-pmc-readonly-test/PmcReadOnlyProbe.cs'
Add-Type -Path $path
function Assert($value,$message){if(-not $value){throw $message}}
Assert ([PmcReadOnlyProbe]::AccessMode -eq 'FIXED_PMC_READ_ONLY_X10_R423_V1') 'Unexpected mode'
$imports=@()
foreach($method in [PmcReadOnlyProbe].GetMethods([Reflection.BindingFlags]'NonPublic,Static')){
 foreach($attribute in $method.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute],$false)){
  if($attribute.Value -eq 'Fwlib64.dll'){$imports+=$method.Name}
 }
}
Assert (($imports|Sort-Object) -join ',' -eq 'cnc_allclibhndl3,cnc_freelibhndl,pmc_rdpmcrng') 'Unexpected FOCAS imports'
$source=Get-Content $path -Raw
Assert (-not ($source -match 'pmc_wr|cnc_wr|cnc_start|cnc_reset|System.Threading|Task.Run')) 'Unexpected write/control/background code'
function Packet([int16]$Area,[uint16]$Address,[byte]$Value){
 $buffer=New-Object byte[] 9
 [BitConverter]::GetBytes($Area).CopyTo($buffer,0)
 [BitConverter]::GetBytes($Address).CopyTo($buffer,4)
 [BitConverter]::GetBytes($Address).CopyTo($buffer,6)
 $buffer[8]=$Value
 return ,$buffer
}
Assert ([PmcReadOnlyProbe]::DecodeByte((Packet 3 10 2),3,10) -eq 2) 'X10 byte decoding failed'
Assert ([PmcReadOnlyProbe]::DecodeByte((Packet 5 423 64),5,423) -eq 64) 'R423 byte decoding failed'
Assert ([PmcReadOnlyProbe]::DecodeByte((Packet 3 10 0),3,10) -eq 0) 'Valid zero rejected'
foreach($case in @(@((Packet 3 10 2),3,11),@((Packet 5 423 64),3,10),@((New-Object byte[] 8),3,10))){
 $rejected=$false
 try{$null=[PmcReadOnlyProbe]::DecodeByte($case[0],$case[1],$case[2])}catch{$rejected=$true}
 Assert $rejected 'Out-of-scope address or invalid reply accepted'
}
$bits=Get-Content $path -Raw
Assert ($bits.Contains('sample.x10Byte & 0x02') -and $bits.Contains('sample.r423Byte & 0x40')) 'Wrong signal bits'
$scriptPath=Join-Path (Split-Path $path -Parent) 'Test-PmcReadOnly.ps1'
$tokens=$null;$errors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$errors)
Assert ($errors.Count -eq 0) 'PowerShell syntax error'
Assert (-not ((Get-Content $scriptPath -Raw) -match 'Invoke-RestMethod|Invoke-WebRequest|Firebase|idToken')) 'Unexpected network/cloud authentication code'
Write-Output 'PASS: C# compilation, exact native read/connect/release allowlist, fixed-address/header validation, bit masks, PS syntax and no cloud code.'
