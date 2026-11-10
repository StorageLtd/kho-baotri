@echo off
setlocal
set "LTD_WEB_TRANSFER_HOME=%~dp0"
set "LTD_WEB_TRANSFER_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "LTD_WEB_TRANSFER_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
start "" "%LTD_WEB_TRANSFER_PS%" -WindowStyle Hidden -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -Command "$root=$env:LTD_WEB_TRANSFER_HOME; @('Start-WebTransfer.ps1','ProgramTransfer.cs','WebTransferServer.cs') | ForEach-Object {Unblock-File -LiteralPath (Join-Path $root $_)}; & (Join-Path $root 'Start-WebTransfer.ps1')"
endlocal
