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
