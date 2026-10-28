param(
    [string]$CncIp = '192.168.1.1',
    [ValidateRange(1, 65535)][int]$Port = 8193
)
$ErrorActionPreference = 'Stop'
try {
    if (-not [Environment]::Is64BitProcess) { throw 'Please open 64-bit Windows PowerShell, not PowerShell (x86).' }
    $parsedIp = $null
    if (-not [Net.IPAddress]::TryParse($CncIp, [ref]$parsedIp) -or $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
        throw 'Enter a valid IPv4 address for the CNC.'
    }
    Write-Host 'FANUC READ-ONLY TEST - no CNC write/control commands, no cloud upload.'
    Write-Host "Connecting to ${CncIp}:$Port (10 second FOCAS timeout)..."
    Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs')
    $snapshot = [FanucReader]::Read($CncIp, [uint16]$Port, (Join-Path $PSScriptRoot 'lib'))
    $json = $snapshot | ConvertTo-Json -Depth 4
    Write-Host 'SUCCESS: CNC system information and raw status read; connection released.' -ForegroundColor Green
    Write-Output $json
    $outputPath = Join-Path $PSScriptRoot 'last-result.json'
    $json | Set-Content -LiteralPath $outputPath -Encoding UTF8
    Write-Host "Saved locally: $outputPath"
    Write-Host 'Send the result or screenshot for interpretation. Raw status numbers are not alarm codes.'
    exit 0
} catch {
    [Console]::Error.WriteLine('TEST FAILED: ' + $_.Exception.GetBaseException().Message)
    exit 1
}
