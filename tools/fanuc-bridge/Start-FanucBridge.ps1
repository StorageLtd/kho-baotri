param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'bridge-config.json'),
    [switch]$Once,
    [switch]$LocalOnly
)
$ErrorActionPreference = 'Stop'
# All credentials/tokens stay in process memory. Never print HTTP exceptions/URLs.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$script:Auth = $null
$script:BridgeFailed = $false
$machineRegistered = $false
$reportingStarted = $false
. (Join-Path $PSScriptRoot "ReportCollector.ps1")
function Invoke-BridgeHttp {
    param([string]$Uri, [string]$Method, $Body, [string]$Operation, [string]$ContentType = 'application/json')
    $parameters = @{ Uri = $Uri; Method = $Method; TimeoutSec = 20; ErrorAction = 'Stop'; Verbose = $false; Debug = $false }
    if ($null -ne $Body) {
        $parameters.Body = if ($ContentType -eq 'application/json') { $Body | ConvertTo-Json -Depth 8 -Compress } else { $Body }
        $parameters.ContentType = if ($ContentType -eq 'application/json') { 'application/json; charset=utf-8' } else { $ContentType }
    }
    try {
        $response = Invoke-RestMethod @parameters
        # Windows PowerShell may leave a top-level JSON scalar as a string.
        # Firebase returns JSON null for a machine that has never been created.
        if ($response -is [string]) { return (ConvertFrom-Json -InputObject $response -ErrorAction Stop) }
        return $response
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        throw "$Operation failed (HTTP $status). Check Internet, account permissions or Firebase configuration."
    }
}
function Connect-BridgeAccount {
    param($Config, [string]$Email, [Security.SecureString]$Password)
    $credential = New-Object System.Net.NetworkCredential('', $Password)
    $body = @{ email = $Email; password = $credential.Password; returnSecureToken = $true }
    try {
        $login = Invoke-BridgeHttp "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Config.firebaseApiKey)" 'POST' $body 'Sign in'
    } finally {
        $body.password = $null
        $credential = $null
    }
    $script:Auth = @{ idToken = $login.idToken; refreshToken = $login.refreshToken; uid = $login.localId; expires = [DateTime]::UtcNow.AddSeconds([int]$login.expiresIn - 120) }
    $account = Invoke-BridgeHttp "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=$($Config.firebaseApiKey)" 'POST' @{ idToken = $script:Auth.idToken } 'Account verification'
    if (-not $account.users -or $account.users[0].emailVerified -ne $true) { throw 'Email is not verified. Verify it before starting the bridge.' }
    $profile = Invoke-BridgeHttp "$($Config.databaseUrl)/users/$($script:Auth.uid).json?auth=$($script:Auth.idToken)" 'GET' $null 'Read CMMS permissions'
    if ($profile.role -notin @('admin', 'manager', 'technician')) { throw 'This account does not have permission to send CMMS telemetry.' }
    Write-Host 'Verified CMMS account accepted. Password is not saved.'
}
function Update-BridgeToken {
    param($Config)
    if ([DateTime]::UtcNow -lt $script:Auth.expires) { return }
    $body = @{ grant_type = 'refresh_token'; refresh_token = $script:Auth.refreshToken }
    $renewed = Invoke-BridgeHttp "https://securetoken.googleapis.com/v1/token?key=$($Config.firebaseApiKey)" 'POST' $body 'Token refresh' 'application/x-www-form-urlencoded'
    $script:Auth.idToken = $renewed.id_token
    $script:Auth.refreshToken = $renewed.refresh_token
    $script:Auth.expires = [DateTime]::UtcNow.AddSeconds([int]$renewed.expires_in - 120)
}
function Send-BridgePatch {
    param($Config, $Payload)
    Update-BridgeToken $Config
    # Patch one machine only; never replace /cncs or touch other CMMS data.
    $uri = "$($Config.databaseUrl)/cncs/$($Config.machineId).json?auth=$($script:Auth.idToken)"
    $null = Invoke-BridgeHttp $uri 'PATCH' $Payload 'Send telemetry'
}
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
            description=[string]$detail.message;source='focas';uid=$script:AlarmUid;observedBy='cnc_rdalmmsg2'}
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
function Send-PendingBridgeAlarms {
    param($Config)
    if (-not $script:AlarmPending.Count) { return }
    Update-BridgeToken $Config
    $sent=0
    foreach($id in @($script:AlarmPending.Keys)) {
        $uri="$($Config.databaseUrl)/cncAlarms/$id.json?auth=$($script:Auth.idToken)"
        $null=Invoke-BridgeHttp $uri 'PATCH' $script:AlarmPending[$id] 'Save CNC alarm history'
        $script:AlarmPending.Remove($id)
        Save-BridgeAlarmHistory
        Write-Host ('ALARM HISTORY SAVED: '+$id)
        $sent++; if($sent -ge 10){break}
    }
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
        source = 'focas'; connected = $true; status = $state; lastSeen = @{ '.sv' = 'timestamp' }
        sampledAt = $Snapshot.timestampUtc; rawStatus = $Snapshot.rawStatus
        controllerInfo = @{ cncType = $Snapshot.cncType; series = $Snapshot.series; version = $Snapshot.version; axes = $Snapshot.axes }
        alarm = $alarm
        alarmDetails = $Snapshot.alarmDetails; alarmDetailsRead = ($Snapshot.alarmDetailsRead -eq $true); alarmsMayBeTruncated = ($Snapshot.alarmsMayBeTruncated -eq $true)
        activeProgram = $Snapshot.activeProgram; mainProgram = $Snapshot.mainProgram
        spindleSpeed = $Snapshot.spindleSpeed; spindleUnit = $Snapshot.spindleUnit
        feedrate = $Snapshot.feedrate; feedrateUnit = $Snapshot.feedrateUnit
        readErrors = $Snapshot.readErrors; partCounter = $Snapshot.partCounter
        reportingVersion = 2; runTimeMs = $Snapshot.runTimeMs; cycleTimeMs = $Snapshot.cycleTimeMs; timerSource = $Snapshot.timerSource; readerMode = 'focas-status-only'; pmcEnabled = $false; cycleStartBit = $null; m30Bit = $null; pmcStatus = $null
        # Setpoints, override and current NC block are not read by this bridge.
        currentBlock = $null; targetSpindleSpeed = $null; targetFeedrate = $null; override = $null
    }
}
try {
    if (-not [Environment]::Is64BitProcess) { throw 'Use 64-bit Windows PowerShell, not PowerShell (x86).' }
    $config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $config.PSObject.Properties['partsPerCount']){$config|Add-Member -NotePropertyName partsPerCount -NotePropertyValue 1}
    if(-not $config.PSObject.Properties['partCounterVerified']){$config|Add-Member -NotePropertyName partCounterVerified -NotePropertyValue $false}
    if ($config.machineId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'Invalid machineId.' }
    $ip = $null
    if (-not [Net.IPAddress]::TryParse([string]$config.cncIp, [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Invalid CNC IPv4 address.' }
    if ([int]$config.port -lt 1 -or [int]$config.port -gt 65535) { throw 'Invalid CNC port.' }
    if ([int]$config.intervalSeconds -lt 3 -or [int]$config.intervalSeconds -gt 10) { throw 'Choose an interval between 3 and 10 seconds.' }
    # Pin credential and telemetry destinations to this CMMS Firebase project.
    if ($config.databaseUrl -cne 'https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app') { throw 'Unexpected database URL. No credentials will be sent.' }
    if ($config.firebaseApiKey -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid Firebase Web API key.' }
    if (-not ('FanucReader' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs') }
    if (-not ([FanucReader].GetProperty('AccessMode')) -or [FanucReader]::AccessMode -ne 'FOCAS_STATUS_ONLY_V1') { throw 'Old reader loaded. CLOSE this PowerShell window and open a new one. The new bridge refuses to reuse the previous reader.' }
    Write-Host "Bridge build: 20261030-alarm-history"
    Write-Host "Machine: $($config.machineName) | CNC $($config.cncIp):$($config.port)"
    Write-Host 'Read-only CNC access. Reading status, actual spindle/feed and current/main O-number. Reading alarm messages with cnc_rdalmmsg2; no PMC access or CNC writes.'
    # Test a real FOCAS read before requesting any credentials or creating the cloud record.
    $sample = [FanucReader]::Read([string]$config.cncIp, [uint16]$config.port, (Join-Path $PSScriptRoot 'lib'))
    if (-not $LocalOnly) {
        $email = Read-Host 'CMMS email (the same verified account used on the website)'
        $password = Read-Host 'CMMS password (hidden; never saved)' -AsSecureString
        try { Connect-BridgeAccount $config $email $password } finally { if ($password) { $password.Dispose(); $password = $null } }
        Update-BridgeToken $config
        $existing = Invoke-BridgeHttp "$($config.databaseUrl)/cncs/$($config.machineId).json?auth=$($script:Auth.idToken)" 'GET' $null 'Check machine identity'
        if ($null -ne $existing) {
            if (($existing -isnot [pscustomobject] -and $existing -isnot [Collections.IDictionary]) -or
                $existing.id -ne $config.machineId -or $existing.name -ne $config.machineName) {
                Write-Host ('Existing machine: id={0}; name={1}; source={2}' -f $existing.id, $existing.name, $existing.source)
                throw 'Machine identity differs from bridge-config.json. Nothing was overwritten. Send only the Existing machine line for diagnosis.'
            }
        }
        if($config.partsPerCount -lt 1 -or $config.partsPerCount -gt 1000 -or [double]$config.partsPerCount -ne [Math]::Truncate([double]$config.partsPerCount)){throw 'partsPerCount must be an integer from 1 to 1000.'}
        Initialize-CncReports (Join-Path $PSScriptRoot 'report-outbox') $config.machineId $script:Auth.uid $config
        Initialize-BridgeAlarmHistory (Join-Path $PSScriptRoot 'report-outbox') $config.machineId $script:Auth.uid
        $reportingStarted = $true
        Send-BridgePatch $config @{ id = $config.machineId; name = $config.machineName; ip = $config.cncIp; port = [int]$config.port; model = $config.model; source = 'focas'; connected = $false; status = 'offline' }
        $machineRegistered = $true
        $sample = $null # Authentication may take minutes; never upload that old initial sample.
    }
    Write-Host 'Bridge active. Keep this window open. Ctrl+C stops it.'
    do {
        if ($null -eq $sample) {
            try { $sample = [FanucReader]::Read([string]$config.cncIp, [uint16]$config.port, (Join-Path $PSScriptRoot 'lib')) }
            catch {
                if($reportingStarted){Break-CncReportObservation}
                Write-Warning ('CNC read failed: ' + $_.Exception.GetBaseException().Message)
                if (-not $LocalOnly) { try { Send-BridgePatch $config @{ source = 'focas'; connected = $false; status = 'offline' } } catch { Write-Warning $_.Exception.Message } }
                if ($Once) { throw 'CNC sample was not obtained.' }
            }
        }
        if ($null -ne $sample) {
            if($reportingStarted){
                Add-CncReportSample $sample
                try { Add-BridgeAlarmSample $config $sample } catch { Write-Warning ('Alarm local save failed: '+$_.Exception.Message) }
                try { Send-PendingBridgeAlarms $config } catch { Write-Warning ('Alarm history upload failed; retained locally: '+$_.Exception.Message) }
            }
            $payload = New-BridgePayload $sample
            $uploaded = $false
            if (-not $LocalOnly) {
                try { Send-BridgePatch $config $payload; $uploaded = $true }
                catch { Write-Warning $_.Exception.Message; if ($Once) { throw } }
            }
            $sample | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'last-result.json') -Encoding UTF8
            if ($sample.readErrors -and $sample.readErrors.Count -gt 0) {
                foreach ($item in $sample.readErrors.GetEnumerator()) { Write-Warning ("Telemetry {0}: {1}" -f $item.Key, $item.Value) }
            }
            $destination = if ($LocalOnly) { 'LOCAL ONLY - not uploaded' } elseif ($uploaded) { 'FIREBASE UPDATED' } else { 'UPLOAD FAILED - will retry' }
            Write-Host ("{0} | {1} | RUN={2} ALARM={3} EMERGENCY={4}" -f (Get-Date -Format 'HH:mm:ss'), $destination, $sample.rawStatus.run, $sample.rawStatus.alarm, $sample.rawStatus.emergency)
            Write-Host ("Spindle={0} {1} | Feed={2} {3} | Program={4} | Main={5}" -f $sample.spindleSpeed, $sample.spindleUnit, $sample.feedrate, $sample.feedrateUnit, $sample.activeProgram, $sample.mainProgram)
        }
        if($reportingStarted){try{Send-PendingCncReports $config -Force:$Once}catch{Write-Warning ('Report upload failed; saved locally. '+$_.Exception.Message)}}
        $sample = $null
        if (-not $Once) { Start-Sleep -Seconds ([int]$config.intervalSeconds) }
    } while (-not $Once)
} catch {
    [Console]::Error.WriteLine('BRIDGE STOPPED: ' + $_.Exception.GetBaseException().Message)
    $script:BridgeFailed = $true
} finally {
    # On an orderly stop try to publish offline; forced closure is covered by the web's 30s expiry.
    if ($script:Auth -and $machineRegistered -and -not $LocalOnly) {
        try { Send-BridgePatch $config @{ connected = $false; status = 'offline' } } catch { }
    }
    if($reportingStarted){Finish-CncCycle 'Dừng cầu nối; chưa biết kết thúc' $null;try{Send-PendingCncReports $config -Force}catch{ };Close-CncReports}
    $script:Auth = $null
}
if ($script:BridgeFailed) { exit 1 }
