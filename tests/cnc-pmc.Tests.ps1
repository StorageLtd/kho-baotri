$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/ReportCollector.ps1')
function Assert-True($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('cnc-pmc-test-'+[guid]::NewGuid().ToString('N'))
$config=[pscustomobject]@{partCounterVerified=$false;partsPerCount=1}
function E([string]$Kind,[double]$Seconds,[int]$Run,[int]$Count){return [pscustomobject]@{kind=$Kind;atUtc=[DateTimeOffset]::Parse('2026-10-29T08:00:00Z').AddMilliseconds([long][Math]::Round($Seconds*1000)).ToString('o');sample=[pscustomobject]@{rawStatus=[pscustomobject]@{aut=1;run=$Run;alarm=0;emergency=0};mainProgram='O0002';partCounter=$Count;cycleTimeMs=[long]($Seconds*1000);runTimeMs=[long]($Seconds*1000)}}}
try{
 Initialize-CncReports $folder 'neway-1260s' 'owner' $config
 Add-CncPmcEvents @((E state 0 0 10),(E start 1 0 10),(E state 1.1 3 10),(E state 2 3 10),(E state 3 2 10),(E start 4 2 10),(E state 4.1 3 10),(E state 5 3 10),(E state 6 0 11),(E end 6.1 0 11))
 $cycles=@($script:ReportDays['2026-10-29'].cycles.Values)
 Assert-True ($cycles.Count -eq 1) 'Resume button or pending RESET created duplicate rows'
 $c=$cycles[0]
 Assert-True ($c.m30Confirmed -eq $true -and $c.partCountDelta -eq 1) 'Observed M30/count were not recorded'
 Assert-True ($c.wallMs -eq 5100 -and $c.runMs -eq 3800 -and $c.holdMs -eq 1100 -and $c.waitMs -eq 200) 'PMC event timing attribution wrong'
 Add-CncPmcEvents @((E start 10 3 11),(E state 11 0 12),(E state 13 0 12))
 $unconfirmed=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object {$_.status -match 'không bắt'})[0]
 Assert-True ($unconfirmed.m30Confirmed -eq $false -and $unconfirmed.wallMs -eq 1000) 'Missing M30 pulse falsely confirmed or added post-stop time'
 Add-CncPmcEvents @((E start 20 3 12),[pscustomobject]@{kind='gap';atUtc='2026-10-29T08:00:21Z';sample=$null})
 $gap=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object {$_.status -match 'tín hiệu PMC'})[0]
 Assert-True ($null -eq $gap.endMs -and $null -eq $gap.partCountDelta) 'PMC gap invented completion'
 Add-CncPmcEvents @((E state 23 3 12),(E end 24 0 13))
 $partial=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object {$_.m30Confirmed -and $null -eq $_.startMs})[0]
 Assert-True ($null -ne $partial -and $null -eq $partial.partCountDelta) 'Missed start was fabricated from M30'
 Write-Output 'PASS: observed X10.1/M30 boundaries, HOLD resume, pending RESET, missed short pulse marked unconfirmed, PMC outage and missing START remain incomplete.'
}finally{Close-CncReports;if(Test-Path $folder){Remove-Item $folder -Recurse -Force}}
