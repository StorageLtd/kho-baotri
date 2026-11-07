@echo off
setlocal
set "LTD_MANAGER_HOME=%~dp0"
set "LTD_MANAGER_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "LTD_MANAGER_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%LTD_MANAGER_PS%" -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -Command "$root=$env:LTD_MANAGER_HOME; @('Start-Manager.ps1','Manager.Core.ps1','bridge/Start-FanucBridge.ps1','bridge/ReportCollector.ps1','bridge/FanucReader.cs') | ForEach-Object {Unblock-File -LiteralPath (Join-Path $root $_)}; & (Join-Path $root 'Start-Manager.ps1')"
endlocal
