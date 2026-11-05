function Get-LtdPowerShell { Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe' }
function Get-LtdShortcutPaths([string]$MachineId) {
    $shell=New-Object -ComObject WScript.Shell
    return @{
        Startup=Join-Path ($shell.SpecialFolders.Item('Startup')) ('LTD-PMC-Trial-'+$MachineId+'.lnk')
        Desktop=$shell.SpecialFolders.Item('Desktop')
    }
}
function New-LtdShortcut([string]$Path,[string]$Root,[string]$Script,[string]$Extra=''){
    $shell=New-Object -ComObject WScript.Shell
    $shortcut=$shell.CreateShortcut($Path)
    $shortcut.TargetPath=Get-LtdPowerShell
    $shortcut.Arguments='-NoLogo -NoProfile -STA -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+(Join-Path $Root $Script)+'" '+$Extra
    $shortcut.WorkingDirectory=$Root
    $shortcut.Description='LTD PMC local read-only trial'
    $shortcut.Save()
}
function Test-LtdBackgroundRunning([string]$Root){
    $path=Join-Path $Root '.background.lock'
    if(-not (Test-Path -LiteralPath $path)){return $false}
    try{$file=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$file.Dispose();return $false}catch{return $true}
}
function Stop-LtdBackground([string]$Root){
    $null=New-Item -ItemType File -Path (Join-Path $Root 'background.stop') -Force
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while(Test-LtdBackgroundRunning $Root){if($timer.Elapsed.TotalSeconds -gt 115){throw 'Background is still stopping. Please wait and try again; do not start a second bridge.'};Start-Sleep -Milliseconds 500}
}
function Start-LtdBackground([string]$Root){
    Remove-Item -LiteralPath (Join-Path $Root 'background.stop') -Force -ErrorAction SilentlyContinue
    $launchArguments='-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+(Join-Path $Root 'Run-Background.ps1')+'"'
    $null=Start-Process -FilePath (Get-LtdPowerShell) -ArgumentList $launchArguments -WindowStyle Hidden -WorkingDirectory $Root -PassThru
}
