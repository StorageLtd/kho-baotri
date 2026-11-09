$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/FanucReader.cs')
function Assert($ok,$message){if(-not $ok){throw $message}}
foreach($case in @(@([FanucReader+PositionElement],12),@([FanucReader+PositionReading],48),@([FanucReader+LoadElement],12),@([FanucReader+SequenceReading],8))){Assert ([Runtime.InteropServices.Marshal]::SizeOf([type]$case[0]) -eq $case[1]) 'Operator native structure mismatch'}
$p=New-Object FanucReader+PositionElement;$p.name=88;$p.dec=3;$p.unit=0;$p.data=-123456
Assert ([FanucReader]::DecodePosition($p).value -eq -123.456) 'Signed position incorrect'
$p.data=0;Assert ([FanucReader]::DecodePosition($p).value -eq 0) 'Actual zero lost'
$p.unit=1;Assert ([FanucReader]::DecodePosition($p).unit -eq 'inch') 'Inch unit lost'
$p.unit=2;Assert ([FanucReader]::DecodePosition($p).unit -eq 'deg') 'Rotary unit lost'
$p.unit=7;Assert ($null -eq [FanucReader]::DecodePosition($p)) 'Unknown unit accepted'
$p.unit=0;$p.dec=20;Assert ($null -eq [FanucReader]::DecodePosition($p)) 'Invalid precision accepted'
$l=New-Object FanucReader+LoadElement;$l.name=88;$l.data=2300;$l.dec=1
Assert ([FanucReader]::DecodeServo($l).percent -eq 230) 'Actual servo overload clipped'
$l.data=-1;Assert ($null -eq [FanucReader]::DecodeServo($l)) 'Invalid servo value accepted'
Write-Output 'PASS: SDK layouts, signed/zero/rotary positions and servo scaling; no CNC contacted.'
$g=New-Object FanucReader+GcodeReading;$g.group=14;$g.code=[Text.Encoding]::ASCII.GetBytes("G54.1`0`0`0")
Assert ([Runtime.InteropServices.Marshal]::SizeOf([type][FanucReader+GcodeReading]) -eq 12) 'G-code structure incorrect'
Assert ([FanucReader]::DecodeGcode($g).code -eq 'G54.1') 'Decimal G-code lost'
$g.code=[Text.Encoding]::ASCII.GetBytes("BAD`0`0`0`0`0");Assert ($null -eq [FanucReader]::DecodeGcode($g)) 'Invalid G-code accepted'
foreach($memory in @(0,1,2)){
 $fields=if($memory -eq 0){1}elseif($memory -eq 1){2}else{4};$columns=New-Object 'int[][]' $fields;$columns[0]=[int[]]@(-125,0);if($memory -ge 1){$columns[1]=[int[]]@(12,0)};if($memory -eq 2){$columns[2]=[int[]]@(230,0);$columns[3]=[int[]]@(-4,0)}
 $rows=[FanucReader]::DecodeOffsetColumns(2,$memory,3,$columns)
 Assert ($rows.Length -eq 2 -and $rows[0].number -eq 1 -and $rows[1].number -eq 2) 'Offset rows lost'
 if($memory -eq 0){Assert ($rows[0].value -eq -0.125 -and $rows[1].value -eq 0) 'Memory A value/zero incorrect'}
 if($memory -eq 1){Assert ($rows[0].geometry -eq -0.125 -and $rows[0].wear -eq 0.012 -and $null -eq $rows[0].lengthGeometry) 'Memory B mislabeled as C'}
 if($memory -eq 2){Assert ($rows[0].lengthGeometry -eq -0.125 -and $rows[0].radiusGeometry -eq 0.230 -and $rows[0].radiusWear -eq -0.004) 'Memory C columns incorrect'}
}
Assert ([FanucReader]::IsCompleteProgram("%`nO07020`nG0X0`nM30`n%",7020)) 'Complete file rejected'
Assert ([FanucReader]::IsCompleteProgram("O7020`nM30`n%",7020)) 'File without opening marker rejected'
Assert (-not [FanucReader]::IsCompleteProgram("%`nO07020`nG0X0",7020)) 'Partial file accepted'
Assert (-not [FanucReader]::IsCompleteProgram("%`nO07021`nM30`n%",7020)) 'Wrong O-number accepted'
Assert (-not [FanucReader]::IsCompleteProgram("%`nO07020`nM30`nO7021`nM30`n%",7020)) 'Multiple file upload accepted'
Write-Output 'PASS: decimal G-code, distinct A/B/C layouts, complete/partial/wrong-program validation.'

Assert ([FanucReader]::IsCompleteProgram("%`n`r`rO07020`n`r`rM30`n`r`r%",7020)) 'Documented LF CR CR program format rejected'
