$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -Path (Join-Path $root 'tools/fanuc-bridge/FanucReader.cs')
function Assert($ok,$message){if(-not $ok){throw $message}}
foreach($case in @(@([FanucReader+MacroReading],12),@([FanucReader+ModalTool],12),@([FanucReader+OffsetReading],8),@([FanucReader+OffsetInfo],4))){Assert ([Runtime.InteropServices.Marshal]::SizeOf([type]$case[0]) -eq $case[1]) 'Invalid context structure'}
$m=New-Object FanucReader+MacroReading;$m.value=-123456;$m.decimals=3
Assert ([FanucReader]::MacroValue($m) -eq -123.456) 'Negative XYZ macro value wrong'
$m.value=0;Assert ([FanucReader]::MacroValue($m) -eq 0) 'Actual zero lost'
$m.decimals=-1;Assert ($null -eq [FanucReader]::MacroValue($m)) 'Undefined macro fabricated value'
$m.decimals=100;Assert ($null -eq [FanucReader]::MacroValue($m)) 'Invalid precision accepted'
$snapshot=New-Object FanucReader+Snapshot;$snapshot.machineType='M';$snapshot.axes='03'
Assert ([FanucReader]::SupportsContextProfile($snapshot,$true)) 'Verified 3-axis M profile rejected'
Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$false)) 'Unverified profile accepted'
$snapshot.machineType='T';Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$true)) 'Lathe accepted as mill'
$snapshot.machineType='M';$snapshot.axes='05';Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$true)) 'Five-axis machine accepted as 3-axis'
Write-Output 'PASS: macro/modal/offset native layouts and signed decimal, zero, undefined macro handling.'

foreach($axisCount in @('03','3',' 3')){
 $snapshot.machineType=' M';$snapshot.axes=$axisCount
 Assert ([FanucReader]::SupportsContextProfile($snapshot,$true)) 'Valid fixed-width FANUC M/3 identification rejected'
 Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$false)) 'Normalization bypassed explicit profile confirmation'
}
$snapshot.machineType=' T';$snapshot.axes='03';Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$true)) 'Padded lathe identifier accepted as mill'
Assert ([FanucReader]::NormalizeCncText([Text.Encoding]::ASCII.GetBytes(" M`0 ")) -eq 'M') 'Leading/trailing SDK padding not normalized'
Assert ([FanucReader]::NormalizeCncText([Text.Encoding]::ASCII.GetBytes(' 3')) -eq '3') 'Axis count padding not normalized'
Write-Output 'PASS: real fixed-width FANUC identifiers preserve family/axis validation and operator confirmation.'

foreach($invalid in @('+3','-3','3.0','3X','04')){$snapshot.machineType=' M';$snapshot.axes=$invalid;Assert (-not [FanucReader]::SupportsContextProfile($snapshot,$true)) 'Invalid or non-three axis count accepted'}
