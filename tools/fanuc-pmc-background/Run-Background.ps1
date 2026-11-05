$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Background-Common.ps1')
$lock=$null;$child=$null
$stopFile=Join-Path $PSScriptRoot 'background.stop'
$logFolder=Join-Path $PSScriptRoot 'logs'
$null=New-Item -ItemType Directory -Path $logFolder -Force
try {
    if(Test-Path -LiteralPath $stopFile){exit 0}
    try{$lock=[IO.File]::Open((Join-Path $PSScriptRoot '.background.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{exit 0}
    $config=Get-Content (Join-Path $PSScriptRoot 'pmc-config.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($config.machineId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$'){throw 'Invalid test ID'}
    $retry=30
    while(-not (Test-Path -LiteralPath $stopFile)){
        foreach($name in @('pmc-output.log','pmc-errors.log')){
            $path=Join-Path $logFolder $name
            if((Test-Path -LiteralPath $path) -and (Get-Item -LiteralPath $path).Length -gt 2097152){Move-Item -LiteralPath $path -Destination ($path+'.previous') -Force}
        }
        $out=Join-Path $logFolder 'pmc-output.log';$err=Join-Path $logFolder 'pmc-errors.log'
        $launchArguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+(Join-Path $PSScriptRoot 'Read-PmcBackground.ps1')+'"'
        $started=[DateTime]::UtcNow
        $child=Start-Process -FilePath (Get-LtdPowerShell) -ArgumentList $launchArguments -WindowStyle Hidden -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
        @{supervisorPid=$PID;childPid=$child.Id;startedUtc=$started.ToString('o');state='Running'}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'background-state.json') -Encoding UTF8
        $stopping=$null
        while(-not $child.HasExited){
            if(Test-Path -LiteralPath $stopFile){
                if($null -eq $stopping){$stopping=[DateTime]::UtcNow}
                if(([DateTime]::UtcNow-$stopping).TotalSeconds -gt 90){$child.Kill();break}
            }
            Start-Sleep -Milliseconds 500
        }
        $child.WaitForExit();$code=$child.ExitCode;$child.Dispose();$child=$null
        @{supervisorPid=$PID;state='Waiting';exitCode=$code;updatedUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'background-state.json') -Encoding UTF8
        if(Test-Path -LiteralPath $stopFile){break}
        if(([DateTime]::UtcNow-$started).TotalSeconds -gt 300){$retry=30}
        # Persist a bounded summary; request errors are already sanitized by the bridge.
        $summary=Join-Path $logFolder 'restart.log'
        if((Test-Path $summary) -and (Get-Item $summary).Length -gt 262144){Move-Item $summary ($summary+'.previous') -Force}
        ('{0} | worker exited {1}; retry in {2}s' -f [DateTime]::UtcNow.ToString('o'),$code,$retry)|Add-Content $summary -Encoding UTF8
        for($i=0;$i -lt $retry -and -not (Test-Path $stopFile);$i++){Start-Sleep -Seconds 1}
        $retry=[Math]::Min(300,$retry*2)
    }
} catch {
    # Do not print raw process arguments or credential objects to logs.
    'Background runner stopped. Use the status shortcut or run setup again.'|Set-Content (Join-Path $logFolder 'runner-error.log') -Encoding UTF8
} finally {
    if($child -and -not $child.HasExited){$null=New-Item -ItemType File -Path $stopFile -Force;$null=$child.WaitForExit(90000);if(-not $child.HasExited){$child.Kill()}}
    if($child){$child.Dispose()}
    if($lock){@{state='Stopped';updatedUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'background-state.json') -Encoding UTF8;$lock.Dispose()}
}
