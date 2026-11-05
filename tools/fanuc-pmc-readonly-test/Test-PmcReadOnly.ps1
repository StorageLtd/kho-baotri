param(
    [string]$CncIp='192.168.1.1',
    [ValidateRange(1,65535)][int]$Port=8193,
    [ValidateRange(1,120)][int]$Samples=1,
    [ValidateRange(500,5000)][int]$IntervalMs=500,
    [string]$OutputDirectory=$PSScriptRoot
)
$ErrorActionPreference='Stop'
$probe=$null
$rows=New-Object 'System.Collections.Generic.List[object]'
$failed=$false
try {
    if(-not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell.'}
    $address=$null
    if(-not [Net.IPAddress]::TryParse($CncIp,[ref]$address) -or $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Invalid CNC IPv4 address.'}
    if(-not ('PmcReadOnlyProbe' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'PmcReadOnlyProbe.cs')}
    if([PmcReadOnlyProbe]::AccessMode -ne 'FIXED_PMC_READ_ONLY_X10_R423_V1'){throw 'Unexpected probe version. Close PowerShell and open a new window.'}
    Write-Host 'PMC TEST: READ ONLY X10.1 / R423.6. No writes, bit forcing, ladder changes or cloud upload.'
    Write-Host 'Fixed addresses supplied by the user; their machine-specific meaning must be checked against the CNC.'
    Write-Host 'Short pulses may be missed. Two byte reads are sequential, not an atomic snapshot.'
    $null=New-Item -ItemType Directory -Path $OutputDirectory -Force
    $outputPath=Join-Path $OutputDirectory ('pmc-readonly-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')+'.csv')
    $probe=[PmcReadOnlyProbe]::Open($CncIp,[uint16]$Port,(Join-Path $PSScriptRoot 'lib'))
    $clock=[Diagnostics.Stopwatch]::StartNew()
    $previous=$null
    for($i=0;$i -lt $Samples -and $clock.Elapsed.TotalSeconds -lt 30;$i++){
        $sample=$probe.Read()
        $row=[pscustomobject]@{
            startedUtc=$sample.startedUtc;finishedUtc=$sample.finishedUtc;xReadUtc=$sample.xReadUtc;rReadUtc=$sample.rReadUtc
            x10Byte=$sample.x10Byte;r423Byte=$sample.r423Byte;x10Bit1=$sample.x10Bit1;r423Bit6=$sample.r423Bit6
            xRiseObserved=($null -ne $previous -and -not $previous.x10Bit1 -and $sample.x10Bit1)
            rRiseObserved=($null -ne $previous -and -not $previous.r423Bit6 -and $sample.r423Bit6)
        }
        $rows.Add($row)
        # Persist every successful sample, including when the test is subsequently interrupted.
        if($i -eq 0){$row|Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding UTF8}
        else{$row|Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding UTF8 -Append}
        Write-Host ('{0} | X10.1={1} (X10=0x{2:X2}) | R423.6={3} (R423=0x{4:X2})' -f (Get-Date -Format 'HH:mm:ss.fff'),[int]$sample.x10Bit1,[int]$sample.x10Byte,[int]$sample.r423Bit6,[int]$sample.r423Byte)
        $previous=$sample
        if($i+1 -lt $Samples){$delay=[int][Math]::Min($IntervalMs,[Math]::Max(0,30000-$clock.ElapsedMilliseconds));if($delay -gt 0){Start-Sleep -Milliseconds $delay}}
    }
    Write-Host ('Completed {0} samples; observed X rises={1}, R rises={2}. These are NOT guaranteed cycle counts.' -f $rows.Count,@($rows|Where-Object xRiseObserved).Count,@($rows|Where-Object rRiseObserved).Count)
    Write-Host ('Local log: '+$outputPath)
} catch {
    $failed=$true
    [Console]::Error.WriteLine('PMC TEST STOPPED: '+$_.Exception.GetBaseException().Message)
} finally {
    if($null -ne $probe){$probe.Dispose();Write-Host 'FOCAS test connection released.'}
}
if($failed){exit 1}
