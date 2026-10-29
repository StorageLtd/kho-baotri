$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/ReportCollector.ps1')
function Assert-True($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('cnc-cycle-test-'+[guid]::NewGuid().ToString('N'))
$config=[pscustomobject]@{partCounterVerified=$false;partsPerCount=1}
function Sample([int]$Second,[int]$Run,[int]$Count,[int]$Alarm=0,[string]$Program='O0002') {
 return [pscustomobject]@{timestampUtc=('2026-10-29T08:00:00Z'|Get-Date).ToUniversalTime().AddSeconds($Second).ToString('o');rawStatus=[pscustomobject]@{run=$Run;aut=1;alarm=$Alarm;emergency=0};partCounter=$Count;cycleTimeMs=$Second*1000;runTimeMs=$Second*1000;mainProgram=$Program}
}
try{
 Initialize-CncReports $folder 'neway-1260s' 'owner' $config
 Add-CncReportSample (Sample 0 0 10)
 Add-CncReportSample (Sample 5 3 10)
 Add-CncReportSample (Sample 10 2 10)
 Add-CncReportSample (Sample 15 3 10)
 Add-CncReportSample (Sample 20 3 10 1)
 Add-CncReportSample (Sample 25 3 10)
 Add-CncReportSample (Sample 30 0 11)
 $cycles=@($script:ReportDays['2026-10-29'].cycles.Values)
 Assert-True ($cycles.Count -eq 1) 'HOLD/resume created a second cycle'
 $cycle=$cycles[0]
 Assert-True ($cycle.runMs -eq 15000 -and $cycle.holdMs -eq 5000 -and $cycle.alarmMs -eq 5000 -and $cycle.wallMs -eq 25000) 'Cycle durations incorrect'
 Assert-True ($cycle.partCountDelta -eq 1 -and $cycle.partCountEnd -eq 11) 'Cycle part count incorrect'
 Assert-True (-not $cycle.m30Confirmed -and $cycle.status -match 'FOCAS') 'STOP falsely claimed M30 confirmation'
 Add-CncReportSample (Sample 35 3 11)
 Add-CncReportSample (Sample 40 0 12)
 Assert-True ($script:ReportDays['2026-10-29'].cycles.Count -eq 2) 'Next observed START did not create another row'
 Add-CncReportSample (Sample 45 3 12)
 Break-CncReportObservation
 $broken=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object status -match 'dữ liệu')
 Assert-True ($broken.Count -eq 1 -and $null -eq $broken[0].endMs -and $null -eq $broken[0].partCountDelta) 'Gap fabricated an end or completed production'
 Add-CncReportSample (Sample 70 3 12)
 Add-CncReportSample (Sample 75 3 12 0 'O0003')
 Add-CncReportSample (Sample 80 0 13 0 'O0003')
 $partial=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object {$_.program -eq 'O0003'})[0]
 Assert-True ($null -eq $partial.startMs -and $null -eq $partial.partCountDelta) 'Mid-run program switch fabricated a START/count'
 Add-CncReportSample (Sample 85 3 13 0 'O0003')
 Add-CncReportSample (Sample 90 1 14 0 'O0003')
 $stopped=@($script:ReportDays['2026-10-29'].cycles.Values|Where-Object {$_.program -eq 'O0003' -and $null -ne $_.startMs -and $null -ne $_.endMs})
 Assert-True ($stopped.Count -eq 1 -and $stopped[0].wallMs -eq 5000) 'STOP=1 did not close the observed interval'
 Add-CncReportSample (Sample 95 3 14 0 'O0003')
 Assert-True ($null -ne $script:ActiveCycle.startMs) 'START after STOP did not create a new row'
 Write-Output 'PASS: cycle rows; HOLD/resume kept together; RUN/alarm/HOLD durations; part deltas; no false M30; gaps and mid-run startup remain incomplete.'
}finally{Close-CncReports;if(Test-Path $folder){Remove-Item $folder -Recurse -Force}}
