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
function Invoke-BridgeHttp {
    param([string]$Uri, [string]$Method, $Body, [string]$Operation, [string]$ContentType = 'application/json')
    $parameters = @{ Uri = $Uri; Method = $Method; TimeoutSec = 20; ErrorAction = 'Stop'; Verbose = $false; Debug = $false }
    if ($null -ne $Body) {
        $parameters.Body = if ($ContentType -eq 'application/json') { $Body | ConvertTo-Json -Depth 8 -Compress } else { $Body }
        $parameters.ContentType = if ($ContentType -eq 'application/json') { 'application/json; charset=utf-8' } else { $ContentType }
    }
    try { return Invoke-RestMethod @parameters }
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
function New-BridgePayload {
    param($Snapshot)
    $state = 'unknown'
    if ($Snapshot.rawStatus.emergency -ne 0 -or $Snapshot.rawStatus.alarm -ne 0) { $state = 'alarm' }
    elseif ($Snapshot.rawStatus.run -eq 3) { $state = 'running' }
    elseif ($Snapshot.rawStatus.run -eq 2) { $state = 'hold' }
    elseif ($Snapshot.rawStatus.run -in @(0, 1, 4)) { $state = 'idle' }
    $alarm = if ($Snapshot.rawStatus.alarm -ne 0 -or $Snapshot.rawStatus.emergency -ne 0) { 'CNC status flags present; detailed alarm codes have not been read.' } else { '' }
    return @{
        source = 'focas'; connected = $true; status = $state; lastSeen = @{ '.sv' = 'timestamp' }
        sampledAt = $Snapshot.timestampUtc; rawStatus = $Snapshot.rawStatus
        controllerInfo = @{ cncType = $Snapshot.cncType; series = $Snapshot.series; version = $Snapshot.version; axes = $Snapshot.axes }
        alarm = $alarm
        # Not measured yet: explicitly remove stale/demo readings rather than display fabricated values.
        activeProgram = $null; currentBlock = $null; spindleSpeed = $null; targetSpindleSpeed = $null
        feedrate = $null; targetFeedrate = $null; override = $null
    }
}
try {
    if (-not [Environment]::Is64BitProcess) { throw 'Use 64-bit Windows PowerShell, not PowerShell (x86).' }
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($config.machineId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'Invalid machineId.' }
    $ip = $null
    if (-not [Net.IPAddress]::TryParse([string]$config.cncIp, [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Invalid CNC IPv4 address.' }
    if ([int]$config.port -lt 1 -or [int]$config.port -gt 65535) { throw 'Invalid CNC port.' }
    if ([int]$config.intervalSeconds -lt 3 -or [int]$config.intervalSeconds -gt 10) { throw 'Choose an interval between 3 and 10 seconds.' }
    # Pin credential and telemetry destinations to this CMMS Firebase project.
    if ($config.databaseUrl -cne 'https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app') { throw 'Unexpected database URL. No credentials will be sent.' }
    if ($config.firebaseApiKey -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid Firebase Web API key.' }
    if (-not ('FanucReader' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs') }
    Write-Host "Machine: $($config.machineName) | CNC $($config.cncIp):$($config.port)"
    Write-Host 'Read-only CNC access. Status only; spindle/program/alarm detail are NOT measured yet.'
    # Test a real FOCAS read before requesting any credentials or creating the cloud record.
    $sample = [FanucReader]::Read([string]$config.cncIp, [uint16]$config.port, (Join-Path $PSScriptRoot 'lib'))
    if (-not $LocalOnly) {
        $email = Read-Host 'CMMS email (the same verified account used on the website)'
        $password = Read-Host 'CMMS password (hidden; never saved)' -AsSecureString
        try { Connect-BridgeAccount $config $email $password } finally { if ($password) { $password.Dispose(); $password = $null } }
        Update-BridgeToken $config
        $existing = Invoke-BridgeHttp "$($config.databaseUrl)/cncs/$($config.machineId).json?auth=$($script:Auth.idToken)" 'GET' $null 'Check machine identity'
        if ($existing -and ($existing.id -ne $config.machineId -or $existing.name -ne $config.machineName)) { throw 'Machine ID is already assigned to another record. Nothing was overwritten.' }
        Send-BridgePatch $config @{ id = $config.machineId; name = $config.machineName; ip = $config.cncIp; port = [int]$config.port; model = $config.model; source = 'focas'; connected = $false; status = 'offline' }
        $machineRegistered = $true
        $sample = $null # Authentication may take minutes; never upload that old initial sample.
    }
    Write-Host 'Bridge active. Keep this window open. Ctrl+C stops it.'
    do {
        if ($null -eq $sample) {
            try { $sample = [FanucReader]::Read([string]$config.cncIp, [uint16]$config.port, (Join-Path $PSScriptRoot 'lib')) }
            catch {
                Write-Warning ('CNC read failed: ' + $_.Exception.GetBaseException().Message)
                if (-not $LocalOnly) { try { Send-BridgePatch $config @{ source = 'focas'; connected = $false; status = 'offline' } } catch { Write-Warning $_.Exception.Message } }
                if ($Once) { throw 'CNC sample was not obtained.' }
            }
        }
        if ($null -ne $sample) {
            $payload = New-BridgePayload $sample
            $uploaded = $false
            if (-not $LocalOnly) {
                try { Send-BridgePatch $config $payload; $uploaded = $true }
                catch { Write-Warning $_.Exception.Message; if ($Once) { throw } }
            }
            $sample | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'last-result.json') -Encoding UTF8
            $destination = if ($LocalOnly) { 'LOCAL ONLY - not uploaded' } elseif ($uploaded) { 'FIREBASE UPDATED' } else { 'UPLOAD FAILED - will retry' }
            Write-Host ("{0} | {1} | RUN={2} ALARM={3} EMERGENCY={4}" -f (Get-Date -Format 'HH:mm:ss'), $destination, $sample.rawStatus.run, $sample.rawStatus.alarm, $sample.rawStatus.emergency)
        }
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
    $script:Auth = $null
}
if ($script:BridgeFailed) { exit 1 }
