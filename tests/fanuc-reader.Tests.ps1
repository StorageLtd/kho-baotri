$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/FanucReader.cs')
function Assert-True($Value,$Message) { if(-not $Value) { throw $Message } }
foreach($pair in @(@([FanucReader+TimerReading],8),@([FanucReader+CounterParameter],8),@([FanucReader+SysInfo],18),@([FanucReader+Status],18),@([FanucReader+SpeedElement],12),@([FanucReader+SpeedReading],24),@([FanucReader+ProgramReading],8),@([FanucReader+ProgramReading8],12))) {
 Assert-True ([Runtime.InteropServices.Marshal]::SizeOf([type]$pair[0]) -eq $pair[1]) ('Invalid layout: '+$pair[0])
}
$reading=New-Object FanucReader+SpeedReading
$spindle=New-Object FanucReader+SpeedElement
$spindle.data=18000;$spindle.dec=1;$spindle.unit=2;$spindle.name=[byte][char]'S'
$feed=New-Object FanucReader+SpeedElement
$feed.data=125;$feed.dec=1;$feed.unit=1;$feed.name=[byte][char]'F'
$reading.acts=$spindle;$reading.actf=$feed
$sample=New-Object FanucReader+Snapshot
[FanucReader]::ApplySpeed(0,$reading,$sample)
Assert-True ($sample.spindleSpeed -eq 1800 -and $sample.spindleUnit -eq 'rpm') 'Spindle decimal scaling incorrect'
Assert-True ($sample.feedrate -eq 12.5 -and $sample.feedrateUnit -eq 'inch/min') 'Feed scaling/unit incorrect'
$reading.actf=$feed;$feed.unit=3;$reading.actf=$feed
[FanucReader]::ApplySpeed(0,$reading,$sample)
Assert-True ($sample.feedrateUnit -eq 'mm/rev') 'Per-revolution feed incorrectly relabeled'
$spindle.data=0;$reading.acts=$spindle
[FanucReader]::ApplySpeed(0,$reading,$sample)
Assert-True ($sample.spindleSpeed -eq 0) 'Measured zero must remain a valid measurement'
[FanucReader]::ApplySpeed(6,$reading,$sample)
Assert-True ($null -eq $sample.spindleSpeed -and $null -eq $sample.feedrate -and $sample.readErrors.speed -match 'FOCAS 6') 'Failed API retained stale readings'
$spindle.unit=99;$reading.acts=$spindle
[FanucReader]::ApplySpeed(0,$reading,$sample)
Assert-True ($null -eq $sample.spindleSpeed) 'Invalid unit accepted'
Assert-True ([FanucReader]::ProgramNumber(12345678) -eq 'O12345678') 'Eight-digit O-number truncated'
Assert-True ([FanucReader]::ProgramNumber(12) -eq 'O0012') 'Four-digit program formatting incorrect'
Assert-True ($null -eq [FanucReader]::ProgramNumber(0)) 'No selected program must not be fabricated'
Assert-True ($null -eq [FanucReader]::ProgramNumber(100000000)) 'Out-of-range program accepted'
$timer=New-Object FanucReader+TimerReading;$timer.minute=123;$timer.msec=4567
Assert-True ([FanucReader]::TimerMilliseconds($timer) -eq 7384567) 'Timer minutes/milliseconds conversion wrong'
$timer.msec=60000;Assert-True ($null -eq [FanucReader]::TimerMilliseconds($timer)) 'Invalid timer accepted'
Write-Output 'PASS: C# compilation, native structure sizes, decimal scaling, actual zero, feed units, failed/invalid API data, 4/8-digit program formatting.'
$alarm=New-Object FanucReader+AlarmReading
Assert-True ([Runtime.InteropServices.Marshal]::SizeOf([type][FanucReader+AlarmReading]) -eq 76) 'Alarm layout mismatch'
Assert-True ([Runtime.InteropServices.Marshal]::OffsetOf([type][FanucReader+AlarmReading],'message').ToInt32() -eq 12) 'Alarm message offset mismatch'
$alarm.number=1234;$alarm.type=2;$alarm.axis=1;$alarm.message=[Text.Encoding]::ASCII.GetBytes(('TEST ALARM'+(' '*54)));$alarm.messageLength=10
$detail=[FanucReader]::DecodeAlarm($alarm)
Assert-True ($detail.number -eq 1234 -and $detail.type -eq 2 -and $detail.axis -eq 1 -and $detail.message -eq 'TEST ALARM') 'Alarm data changed during decoding'
$alarm.messageLength=65;$rejected=$false
try{[FanucReader]::DecodeAlarm($alarm)}catch{$rejected=$true}
Assert-True $rejected 'Invalid alarm message length accepted'
Write-Output 'PASS: uploaded alarm structure size/offset, message decoding and invalid-length rejection.'
