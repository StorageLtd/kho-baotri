# Daily, per-session cumulative snapshots. PUT retries are idempotent; no per-sample cloud log growth.
function Initialize-CncReports {
    param([string]$Folder, [string]$MachineId, [string]$OwnerUid, $Config)
    $null = New-Item -ItemType Directory -Path $Folder -Force
    $script:ReportLock = [IO.File]::Open((Join-Path $Folder '.collector.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $script:ReportFolder=$Folder; $script:ReportMachine=$MachineId; $script:ReportOwner=$OwnerUid
    $script:ReportSession=[guid]::NewGuid().ToString('N'); $script:ReportDays=@{}
    $script:PreviousReportSample=$null; $script:ReportHighWater=[long]::MinValue; $script:LastReportSend=[DateTime]::MinValue
    $script:CounterVerified=($Config.partCounterVerified -is [bool] -and $Config.partCounterVerified -eq $true)
    $script:PartsPerCount=if($Config.partsPerCount){[int]$Config.partsPerCount}else{1}
}
function Get-CncReportDay {
    param([long]$TimeMs)
    return [DateTimeOffset]::FromUnixTimeMilliseconds($TimeMs).UtcDateTime.AddHours(7).ToString('yyyy-MM-dd')
}
function Get-OrCreateCncReportDay {
    param([long]$TimeMs)
    $day=Get-CncReportDay $TimeMs
    if(-not $script:ReportDays.ContainsKey($day)) {
        $script:ReportDays[$day]=@{
            schemaVersion=1; source='focas'; timeZone='Asia/Ho_Chi_Minh'; machineId=$script:ReportMachine
            sessionId=$script:ReportSession; ownerUid=$script:ReportOwner; date=$day
            firstMs=$TimeMs; lastMs=$TimeMs; observedMs=0L
            runningMs=0L; idleMs=0L; holdMs=0L; alarmMs=0L; unknownStateMs=0L
            counterDelta=0L; counterObservedMs=0L; counterComparisons=0L; counterResets=0L
            counterParameter=6711; counterVerified=$script:CounterVerified; partsPerCount=$script:PartsPerCount
            sampleCount=0L; gapCount=0L
        }
    }
    return $script:ReportDays[$day]
}
function Save-CncReportDay {
    param($Day)
    $path=Join-Path $script:ReportFolder ($script:ReportMachine+'_'+$Day.date+'_'+$script:ReportSession+'.json')
    $temp=$path+'.tmp'
    [IO.File]::WriteAllText($temp,($Day|ConvertTo-Json -Depth 5 -Compress),[Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $path -Force
}
function Add-CncReportSample {
    param($Sample)
    $time=[DateTimeOffset]::Parse($Sample.timestampUtc).ToUnixTimeMilliseconds()
    if($time -le $script:ReportHighWater){$script:PreviousReportSample=$null;return}
    $script:ReportHighWater=$time
    $day=Get-OrCreateCncReportDay $time
    $day.sampleCount++; $day.lastMs=[Math]::Max([long]$day.lastMs,$time)
    $previous=$script:PreviousReportSample
    if($null -ne $previous) {
        $from=[long]$previous.time; $elapsed=$time-$from
        if($elapsed -gt 0 -and $elapsed -le 15000) {
            $state='unknownStateMs'
            if($previous.raw.alarm -ne 0 -or $previous.raw.emergency -ne 0){$state='alarmMs'}
            elseif($previous.raw.run -eq 3){$state='runningMs'}
            elseif($previous.raw.run -eq 2){$state='holdMs'}
            elseif($previous.raw.run -in @(0,1,4)){$state='idleMs'}
            # Split exactly at Vietnam midnight. Each interval uses the preceding observed state.
            $counterValid=($null -ne $previous.counter -and $null -ne $Sample.partCounter -and [long]$Sample.partCounter -ge [long]$previous.counter)
            $cursor=$from
            while($cursor -lt $time) {
                $key=Get-CncReportDay $cursor
                $midnight=[DateTimeOffset]::Parse($key+'T00:00:00+07:00').AddDays(1).ToUnixTimeMilliseconds()
                $end=[Math]::Min($time,$midnight)
                $bucket=Get-OrCreateCncReportDay $cursor
                $duration=$end-$cursor
                $bucket[$state]+=$duration; $bucket.observedMs+=$duration
                if($counterValid){$bucket.counterObservedMs+=$duration}
                $bucket.firstMs=[Math]::Min([long]$bucket.firstMs,$cursor);$bucket.lastMs=[Math]::Max([long]$bucket.lastMs,$end)
                Save-CncReportDay $bucket
                $cursor=$end
            }
            # Counter increases are assigned to the sample that observes them, not smeared across dates.
            if($null -ne $previous.counter -and $null -ne $Sample.partCounter) {
                if([long]$Sample.partCounter -ge [long]$previous.counter) {
                    $day.counterDelta+=([long]$Sample.partCounter-[long]$previous.counter)
                    $day.counterComparisons++
                } else { $day.counterResets++ }
            }
        } else { $day.gapCount++ }
    }
    Save-CncReportDay $day
    $script:PreviousReportSample=@{time=$time;raw=$Sample.rawStatus;counter=$Sample.partCounter}
}
function Break-CncReportObservation { $script:PreviousReportSample=$null }
function Send-PendingCncReports {
    param($Config,[switch]$Force)
    if(-not $Force -and ([DateTime]::UtcNow-$script:LastReportSend).TotalSeconds -lt 30){return}
    $script:LastReportSend=[DateTime]::UtcNow
    Update-BridgeToken $Config
    $files=@(Get-ChildItem -LiteralPath $script:ReportFolder -Filter '*.json' | Sort-Object LastWriteTime | Select-Object -First 10)
    foreach($file in $files) {
        $report=Get-Content -LiteralPath $file.FullName -Raw|ConvertFrom-Json
        if($report.ownerUid -ne $script:Auth.uid){Write-Warning 'A buffered report belongs to another account; keep that file and use its original account.';continue}
        if($report.machineId -ne $Config.machineId -or $report.sessionId -notmatch '^[a-f0-9]{32}$' -or $report.date -notmatch '^\d{4}-\d{2}-\d{2}$'){throw 'Invalid local report metadata; nothing uploaded.'}
        $uri="$($Config.databaseUrl)/cncReports/$($report.machineId)/$($report.date)/$($report.sessionId).json?auth=$($script:Auth.idToken)"
        $null=Invoke-BridgeHttp $uri 'PUT' $report 'Send daily CNC report'
        Remove-Item -LiteralPath $file.FullName
    }
    if($files.Count){Write-Host 'REPORTS UPDATED (daily snapshots; pending files retained on failure).'}
}
function Close-CncReports {
    $script:PreviousReportSample=$null
    if($script:ReportLock){$script:ReportLock.Dispose();$script:ReportLock=$null}
}
