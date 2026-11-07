@echo off
setlocal
set "FANUC_LOCAL_HOME=%~dp0"
set "FANUC_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "FANUC_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%FANUC_PS%" -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command "$root=$env:FANUC_LOCAL_HOME; @('Start-LocalMonitor.ps1','FanucReader.cs','LocalServer.cs','index.html') | ForEach-Object { Unblock-File -LiteralPath (Join-Path $root $_) }; & (Join-Path $root 'Start-LocalMonitor.ps1')"
echo.
echo Local monitor stopped. Press any key to close.
pause >nul
endlocal
