# Daily, per-session cumulative snapshots. PUT retries are idempotent; no per-sample cloud log growth.
function Initialize-CncReports {
    param([string]$Folder, [string]$MachineId, [string]$OwnerUid, $Config)
    $null = New-Item -ItemType Directory -Path $Folder -Force
    $script:ReportLock = [IO.File]::Open((Join-Path $Folder '.collector.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $script:ReportFolder=$Folder; $script:ReportMachine=$MachineId; $script:ReportOwner=$OwnerUid
    $script:ReportSession=[guid]::NewGuid().ToString('N'); $script:ReportDays=@{}
    $script:PreviousReportSample=$null; $script:ReportHighWater=[long]::MinValue; $script:LastReportSend=[DateTime]::MinValue
    $script:CounterVerified=($Config.partCounterVerified -is [bool] -and $Config.partCounterVerified -eq $true)
    $script:ActiveCycle=$null;$script:CyclePrevious=$null;$script:CycleIndex=0
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
    if($time -le $script:ReportHighWater){Break-CncReportObservation;return}
    $script:ReportHighWater=$time
    Add-CncCycleSample $Sample $time
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
function Break-CncReportObservation { Finish-CncCycle 'Mất dữ liệu; chưa biết kết thúc' $null; $script:PreviousReportSample=$null;$script:CyclePrevious=$null }
function Send-PendingCncReports {
    param($Config,[switch]$Force)
    if(-not $Force -and ([DateTime]::UtcNow-$script:LastReportSend).TotalSeconds -lt 30){return}
    $script:LastReportSend=[DateTime]::UtcNow
    Update-BridgeToken $Config
    $files=@(Get-ChildItem -LiteralPath $script:ReportFolder -Filter '*.json' | Where-Object { $_.Name -match '^.+_\d{4}-\d{2}-\d{2}_[a-f0-9]{32}\.json$' } | Sort-Object LastWriteTime | Select-Object -First 10)
    foreach($file in $files) {
        $report=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8|ConvertFrom-Json
        if($report.ownerUid -ne $script:Auth.uid){Write-Warning 'A buffered report belongs to another account; keep that file and use its original account.';continue}
        if($report.machineId -ne $Config.machineId -or $report.sessionId -notmatch '^[a-f0-9]{32}$' -or $report.date -notmatch '^\d{4}-\d{2}-\d{2}$'){throw 'Invalid local report metadata; nothing uploaded.'}
        $uri="$($Config.databaseUrl)/cncReports/$($report.machineId)/$($report.date)/$($report.sessionId).json?auth=$($script:Auth.idToken)"
        $null=Invoke-BridgeHttp $uri 'PUT' $report 'Send daily CNC report'
        Remove-Item -LiteralPath $file.FullName
    }
    if($files.Count){Write-Host 'REPORTS UPDATED (daily snapshots; pending files retained on failure).'}
}
function Close-CncReports {
    Finish-CncCycle 'Dừng cầu nối; chưa biết kết thúc' $null
    $script:PreviousReportSample=$null;$script:CyclePrevious=$null
    if($script:ReportLock){$script:ReportLock.Dispose();$script:ReportLock=$null}
}

# Cycle boundaries below are observed state changes, NOT physical button or program-end confirmation.
function Get-CncCycleState($Raw) {
    if($Raw.alarm -ne 0 -or $Raw.emergency -ne 0){return 'alarmMs'}
    if($Raw.run -eq 3){return 'runMs'}
    if($Raw.run -eq 2){return 'holdMs'}
    return 'waitMs'
}
function Save-CncCycle {
    if($null -eq $script:ActiveCycle){return}
    $cycle=$script:ActiveCycle
    $bucket=Get-OrCreateCncReportDay ([long]$cycle.observedFromMs)
    if(-not $bucket.ContainsKey('cycles')){$bucket.cycles=@{}}
    $bucket.cycles[$cycle.id]=$cycle.Clone()
    Save-CncReportDay $bucket
}
function Finish-CncCycle([string]$Reason,$EndMs) {
    if($null -eq $script:ActiveCycle){return}
    $cycle=$script:ActiveCycle
    $cycle.status=$Reason; $cycle.endMs=$EndMs
    $cycle.wallMs=if($null -ne $cycle.startMs -and $null -ne $EndMs){[long]$EndMs-[long]$cycle.startMs}else{$null}
    $cycle.partCountDelta=if($cycle.counterComplete -and $null -ne $cycle.startMs -and $null -ne $EndMs){$cycle.observedCountDelta}else{$null}
    Save-CncCycle
    $script:ActiveCycle=$null
}
function Add-CncCycleSample($Sample,[long]$TimeMs) {
    $previous=$script:CyclePrevious
    $program=if($Sample.mainProgram){[string]$Sample.mainProgram}else{[string]$Sample.activeProgram}
    $automatic=$Sample.rawStatus.aut -in @(1,10)
    if($null -ne $previous -and $null -ne $script:ActiveCycle) {
        $elapsed=$TimeMs-[long]$previous.time
        if($elapsed -le 0 -or $elapsed -gt 15000){Finish-CncCycle 'Mất dữ liệu; chưa biết kết thúc' $null}
        elseif(-not $automatic -or ($program -and $script:ActiveCycle.program -and $program -ne $script:ActiveCycle.program)) {Finish-CncCycle 'Đổi chương trình/chế độ; chưa biết kết thúc' $null}
        else {
            $cycle=$script:ActiveCycle
            $field=Get-CncCycleState $previous.raw
            $cycle[$field]+=$elapsed; $cycle.observedToMs=$TimeMs
            $cursor=[long]$previous.time
            while($cursor -lt $TimeMs){
                $day=Get-CncReportDay $cursor
                $midnight=[DateTimeOffset]::Parse($day+'T00:00:00+07:00').AddDays(1).ToUnixTimeMilliseconds()
                $until=[Math]::Min($TimeMs,$midnight)
                if(-not $cycle.days.ContainsKey($day)){$cycle.days[$day]=@{runMs=0L;holdMs=0L;alarmMs=0L;waitMs=0L}}
                $cycle.days[$day][$field]+=($until-$cursor);$cursor=$until
            }
            if($null -ne $previous.counter -and $null -ne $Sample.partCounter -and [long]$Sample.partCounter -ge [long]$previous.counter) {$cycle.observedCountDelta+=([long]$Sample.partCounter-[long]$previous.counter)}
            else {$cycle.counterComplete=$false}
            $cycle.partCountEnd=$Sample.partCounter
            if($null -ne $Sample.cycleTimeMs -and ($null -eq $cycle.cncCycleTimeMs -or $Sample.cycleTimeMs -gt $cycle.cncCycleTimeMs)){$cycle.cncCycleTimeMs=$Sample.cycleTimeMs}
            if($null -ne $cycle.cncRunStartMs -and $null -ne $Sample.runTimeMs -and $Sample.runTimeMs -ge $cycle.cncRunStartMs){$cycle.cncRunDeltaMs=[long]$Sample.runTimeMs-[long]$cycle.cncRunStartMs}else{$cycle.cncRunDeltaMs=$null}
            if($Sample.rawStatus.run -in @(0,1)){Finish-CncCycle 'STOP/RESET quan sát qua FOCAS' $TimeMs}
            else{Save-CncCycle}
        }
    }
    if($null -eq $script:ActiveCycle -and $automatic -and $Sample.rawStatus.run -eq 3) {
        $knownStart=$null -ne $previous -and ($TimeMs-[long]$previous.time) -gt 0 -and ($TimeMs-[long]$previous.time) -le 15000 -and $previous.raw.run -in @(0,1) -and $previous.raw.aut -in @(1,10)
        $script:CycleIndex++
        $script:ActiveCycle=@{
            id=($script:ReportSession+'-'+$script:CycleIndex.ToString('D6')); program=$program
            observedFromMs=$TimeMs;observedToMs=$TimeMs;startMs=if($knownStart){$TimeMs}else{$null};endMs=$null
            runMs=0L;holdMs=0L;alarmMs=0L;waitMs=0L;wallMs=$null
            partCountStart=$Sample.partCounter;partCountEnd=$Sample.partCounter;partCountDelta=$null;observedCountDelta=0L
            counterComplete=($null -ne $Sample.partCounter);cncCycleTimeMs=$Sample.cycleTimeMs;cncRunStartMs=$Sample.runTimeMs;cncRunDeltaMs=$null
            m30Confirmed=$false;boundarySource='sampled-status';status=if($knownStart){'Đang quan sát'}else{'Đang quan sát; thiếu thời điểm bắt đầu'};days=@{}
        }
        Save-CncCycle
    }
    $script:CyclePrevious=@{time=$TimeMs;raw=$Sample.rawStatus;counter=$Sample.partCounter;timer=$Sample.cycleTimeMs}
}
