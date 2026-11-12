function Initialize-BridgeAlarmHistory {
    param([string]$Folder, [string]$MachineId, [string]$Uid)
    $script:AlarmStatePath = Join-Path $Folder ('alarms-' + $MachineId + '-' + $Uid + '.json')
    $script:AlarmActive = @{}; $script:AlarmPending = @{}
    if (Test-Path -LiteralPath $script:AlarmStatePath) {
        $saved = Get-Content -LiteralPath $script:AlarmStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($saved.machineId -ne $MachineId -or $saved.uid -ne $Uid) { throw 'Alarm outbox identity mismatch.' }
        foreach ($entry in $saved.active.PSObject.Properties) { $script:AlarmActive[$entry.Name] = $entry.Value }
        foreach ($entry in $saved.pending.PSObject.Properties) { $script:AlarmPending[$entry.Name] = $entry.Value }
    }
    $script:AlarmMachineId=$MachineId; $script:AlarmUid=$Uid
}
function Save-BridgeAlarmHistory {
    $state=@{machineId=$script:AlarmMachineId;uid=$script:AlarmUid;active=$script:AlarmActive;pending=$script:AlarmPending}
    $temporary=$script:AlarmStatePath+'.tmp'
    $state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $script:AlarmStatePath -Force
}
function Add-BridgeAlarmSample {
    param($Config, $Snapshot)
    # Failed/partial reads must never close an alarm or invent a cleared state.
    if ($Snapshot.alarmDetailsRead -ne $true) { return }
    $seen=@{}; $changed=$false
    foreach ($detail in $Snapshot.alarmDetails) {
        $key='{0}_{1}_{2}' -f $detail.type,$detail.number,$detail.axis
        $seen[$key]=$true
        if ($script:AlarmActive.ContainsKey($key)) { continue }
        $id='focas-'+[Guid]::NewGuid().ToString('N')
        $record=@{id=$id;cncId=$Config.machineId;cncName=$Config.machineName;timestamp=$Snapshot.timestampUtc;
            alarmCode=[string]$detail.number;alarmType=[int]$detail.type;axis=[int]$detail.axis;
            description=[string]$detail.message;activeProgram=$Snapshot.activeProgram;mainProgram=$Snapshot.mainProgram;machiningContext=$Snapshot.machiningContext;source='focas';uid=$script:AlarmUid;observedBy='cnc_rdalmmsg2'}
        $script:AlarmActive[$key]=$record; $script:AlarmPending[$id]=$record; $changed=$true
    }
    if ($Snapshot.alarmsMayBeTruncated -ne $true) {
        foreach ($key in @($script:AlarmActive.Keys)) {
            if ($seen.ContainsKey($key)) { continue }
            $active=$script:AlarmActive[$key]; $closed=@{}
            if ($active -is [Collections.IDictionary]) { foreach($name in $active.Keys){$closed[$name]=$active[$name]} }
            else { foreach($field in $active.PSObject.Properties){$closed[$field.Name]=$field.Value} }
            $closed.resolvedAt=$Snapshot.timestampUtc
            $closed.resolutionSource='Alarm no longer returned by a successful CNC read; repair not confirmed'
            $script:AlarmPending[$closed.id]=$closed; $script:AlarmActive.Remove($key); $changed=$true
        }
    }
    if ($changed) { Save-BridgeAlarmHistory }
}

function New-BridgePayload {
    param($Snapshot)
    $state = 'unknown'
    if ($Snapshot.rawStatus.emergency -ne 0 -or $Snapshot.rawStatus.alarm -ne 0) { $state = 'alarm' }
    elseif ($Snapshot.rawStatus.run -eq 3) { $state = 'running' }
    elseif ($Snapshot.rawStatus.run -eq 2) { $state = 'hold' }
    elseif ($Snapshot.rawStatus.run -in @(0, 1, 4)) { $state = 'idle' }
    $alarm = if ($Snapshot.rawStatus.alarm -ne 0 -or $Snapshot.rawStatus.emergency -ne 0) { 'Có tín hiệu Alarm/Emergency; xem chi tiết nếu CNC hỗ trợ.' } else { '' }
    return @{
        source = 'focas'; connected = $true; status = $state; lastSeen = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        sampledAt = $Snapshot.timestampUtc; rawStatus = $Snapshot.rawStatus
        controllerInfo = @{ machineType=$Snapshot.machineType;cncType = $Snapshot.cncType; series = $Snapshot.series; version = $Snapshot.version; axes = $Snapshot.axes }
        alarm = $alarm
        alarmDetails = $Snapshot.alarmDetails; alarmDetailsRead = ($Snapshot.alarmDetailsRead -eq $true); alarmsMayBeTruncated = ($Snapshot.alarmsMayBeTruncated -eq $true)
        activeProgram = $Snapshot.activeProgram; mainProgram = $Snapshot.mainProgram; machiningContext = $Snapshot.machiningContext
        spindleLoad=$Snapshot.spindleLoad;spindleLoadName=$Snapshot.spindleLoadName;spindleSpeed = $Snapshot.spindleSpeed; spindleUnit = $Snapshot.spindleUnit
        feedrate = $Snapshot.feedrate; feedrateUnit = $Snapshot.feedrateUnit
        fullProgram=$Snapshot.fullProgram;fullProgramVerifiedAt=$Snapshot.fullProgram.sampledAtUtc
        modalGcodes=$Snapshot.modalGcodes;modalGcodesComplete=($Snapshot.modalGcodesComplete -eq $true);workCoordinates=$Snapshot.workCoordinates;toolOffsets=$Snapshot.toolOffsets
        positions=$Snapshot.positions;servoLoads=$Snapshot.servoLoads;sequenceNumber=$Snapshot.sequenceNumber;programText=$Snapshot.programText;programBufferBlock=$Snapshot.programBufferBlock;programTextLimited=($Snapshot.programTextLimited -eq $true)
        readErrors = $Snapshot.readErrors; partCounter = $Snapshot.partCounter
        reportingVersion = 2; runTimeMs = $Snapshot.runTimeMs; cycleTimeMs = $Snapshot.cycleTimeMs; timerSource = $Snapshot.timerSource; readerMode = 'focas-status-only'; pmcEnabled = $false; cycleStartBit = $null; m30Bit = $null; pmcStatus = $null
        # Setpoints, override and current NC block are not read by this bridge.
        currentBlock = $null; targetSpindleSpeed = $null; targetFeedrate = $null; override = $null
    }
}