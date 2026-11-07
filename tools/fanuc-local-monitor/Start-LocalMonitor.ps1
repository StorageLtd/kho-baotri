[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$server=$null
try {
    if ([IntPtr]::Size -ne 8) { throw 'Please use 64-bit Windows PowerShell.' }
    $configPath=Join-Path $PSScriptRoot 'local-config.json'
    $config=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    Write-Host 'FANUC LOCAL MONITOR - build 20261107-local-only' -ForegroundColor Cyan
    Write-Host 'Local laptop only. No Firebase, no sign-in, no uploads. No PMC access or CNC writes.'
    $entered=Read-Host "CNC IP [$($config.cncIp)] (Enter = keep)"
    if (-not [string]::IsNullOrWhiteSpace($entered)) { $config.cncIp=$entered.Trim() }
    $address=$null
    if (-not [Net.IPAddress]::TryParse([string]$config.cncIp,[ref]$address) -or $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'CNC IP must be an IPv4 address.' }
    $cncPort=[int]$config.cncPort; $webPort=[int]$config.webPort; $interval=[int]$config.pollSeconds
    if ($cncPort -lt 1 -or $cncPort -gt 65535 -or $webPort -lt 1024 -or $webPort -gt 65535 -or $interval -lt 1 -or $interval -gt 60) { throw 'Invalid port or pollSeconds (1-60).' }
    $lib=Join-Path $PSScriptRoot 'lib'
    foreach ($file in @('Fwlib64.dll','fwlibe64.dll','fwlib30i64.dll')) {
        $path=Join-Path $lib $file
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing lib\$file. Copy your existing 64-bit FOCAS DLLs into lib first." }
    }
    Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs')
    Add-Type -Path (Join-Path $PSScriptRoot 'LocalServer.cs')
    $server=New-Object FanucLocalServer -ArgumentList $webPort,(Join-Path $PSScriptRoot 'index.html')
    try { $server.Start() } catch { throw "Cannot open local port $webPort. Close another local monitor, or change webPort in local-config.json. $($_.Exception.Message)" }
    $config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    $url="http://localhost:$webPort/"
    Write-Host "Machine: $($config.machineName) | CNC $($config.cncIp):$cncPort"
    Write-Host "OPEN: $url" -ForegroundColor Green
    Write-Host 'Keep this window open. Ctrl+C stops the local monitor.'
    try { Start-Process $url } catch { Write-Host "Open this address manually in your browser: $url" -ForegroundColor Yellow }
    while ($true) {
        $snapshot=$null; $problem=$null
        try { $snapshot=[FanucReader]::Read([string]$config.cncIp,[UInt16]$cncPort,$lib) }
        catch { $problem=$_.Exception.GetBaseException().Message }
        $payload=[ordered]@{machineName=[string]$config.machineName;ip=[string]$config.cncIp;port=$cncPort;connected=($null -ne $snapshot);checkedAtUtc=[DateTime]::UtcNow.ToString('o');error=$problem;snapshot=$snapshot}
        $json=ConvertTo-Json -InputObject $payload -Depth 12 -Compress
        $server.Update($json)
        # Only a local snapshot is saved; no reports or credentials are uploaded.
        $temp=Join-Path $PSScriptRoot 'last-result.json.tmp'
        $json | Set-Content -LiteralPath $temp -Encoding UTF8
        Move-Item -LiteralPath $temp -Destination (Join-Path $PSScriptRoot 'last-result.json') -Force
        if ($problem) { Write-Host "$(Get-Date -Format HH:mm:ss) | READ FAILED: $problem" -ForegroundColor Yellow }
        else { Write-Host "$(Get-Date -Format HH:mm:ss) | LOCAL OK | RUN=$($snapshot.rawStatus.run) ALARM=$($snapshot.rawStatus.alarm) | Spindle=$($snapshot.spindleSpeed) | Part=$($snapshot.partCounter)" -ForegroundColor Green }
        Start-Sleep -Seconds $interval
    }
}
catch { Write-Host "LOCAL MONITOR STOPPED: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
finally { if ($null -ne $server) { $server.Dispose() } }
