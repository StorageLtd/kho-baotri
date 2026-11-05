param([switch]$Once)
$ErrorActionPreference='Stop'
$probe=$null;$lock=$null;$failed=$false;$previous=$null
$stopFile=Join-Path $PSScriptRoot 'background.stop'
$logs=Join-Path $PSScriptRoot 'logs'
$samplePath=Join-Path $PSScriptRoot 'pmc-status.json'
function Save-PmcStatus($Value){
    $temp=$samplePath+'.tmp'
    [IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 4 -Compress),[Text.UTF8Encoding]::new($false))
    if(Test-Path $samplePath){[IO.File]::Replace($temp,$samplePath,[NullString]::Value)}else{[IO.File]::Move($temp,$samplePath)}
}
try {
    if(-not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell.'}
    if(Test-Path $stopFile){exit 0}
    try{$lock=[IO.File]::Open((Join-Path $PSScriptRoot '.reader.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'A PMC reader is already running in this folder.'}
    $config=Get-Content (Join-Path $PSScriptRoot 'pmc-config.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($config.machineId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$'){throw 'Invalid machine test ID.'}
    if([int]$config.port -lt 1 -or [int]$config.port -gt 65535){throw 'Invalid TCP port.'}
    if([int]$config.intervalMs -lt 500 -or [int]$config.intervalMs -gt 5000){throw 'Read interval must be 500-5000 ms.'}
    $null=New-Item -ItemType Directory -Path $logs -Force
    if(-not ('PmcReadOnlyProbe' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'PmcReadOnlyProbe.cs')}
    if([PmcReadOnlyProbe]::AccessMode -ne 'FIXED_PMC_READ_ONLY_X10_R423_V1'){throw 'Unexpected PMC test reader. Run setup again.'}
    Save-PmcStatus @{state='Connecting';updatedUtc=[DateTime]::UtcNow.ToString('o');machineId=$config.machineId;message='Connecting to the configured CNC; local read-only trial.'}
    $probe=[PmcReadOnlyProbe]::Open([string]$config.cncIp,[uint16]$config.port,(Join-Path $PSScriptRoot 'lib'))
    do {
        if(Test-Path $stopFile){break}
        $sample=$probe.Read()
        $row=[pscustomobject]@{
            startedUtc=$sample.startedUtc;finishedUtc=$sample.finishedUtc;xReadUtc=$sample.xReadUtc;rReadUtc=$sample.rReadUtc
            x10Byte=$sample.x10Byte;r423Byte=$sample.r423Byte;x10Bit1=$sample.x10Bit1;r423Bit6=$sample.r423Bit6
            xRiseObserved=($null -ne $previous -and -not $previous.x10Bit1 -and $sample.x10Bit1)
            rRiseObserved=($null -ne $previous -and -not $previous.r423Bit6 -and $sample.r423Bit6)
        }
        $csv=Join-Path $logs 'pmc-current.csv'
        if((Test-Path $csv) -and (Get-Item $csv).Length -ge 2097152){Move-Item -LiteralPath $csv -Destination (Join-Path $logs 'pmc-previous.csv') -Force}
        if(Test-Path $csv){$row|Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8 -Append}else{$row|Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8}
        Save-PmcStatus @{state='Connected';updatedUtc=$sample.finishedUtc;machineId=$config.machineId;sample=$row;message='Local read only; short pulses may be missed.'}
        $previous=$sample
        if(-not $Once){Start-Sleep -Milliseconds ([int]$config.intervalMs)}
    }while(-not $Once)
} catch {
    $failed=$true
    try{Save-PmcStatus @{state='Waiting';updatedUtc=[DateTime]::UtcNow.ToString('o');message=$_.Exception.GetBaseException().Message}}catch{}
    [Console]::Error.WriteLine('PMC read unavailable. Open the status shortcut for details; no signal value was invented.')
} finally {
    if($probe){$probe.Dispose()}
    if($lock){
        if(-not $failed -and -not $Once){try{Save-PmcStatus @{state='Stopped';updatedUtc=[DateTime]::UtcNow.ToString('o');message='Stopped by user.'}}catch{}}
        $lock.Dispose()
    }
}
if($failed){exit 1}
