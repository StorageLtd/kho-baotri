@echo off
setlocal
set "FANUC_TRANSFER_HOME=%~dp0"
set "TRANSFER_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "TRANSFER_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%TRANSFER_PS%" -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -Command "$root=$env:FANUC_TRANSFER_HOME; @('Start-Transfer.ps1','FanucReader.cs','ProgramTransfer.cs') | ForEach-Object {Unblock-File -LiteralPath (Join-Path $root $_)}; & (Join-Path $root 'Start-Transfer.ps1')"
pause
endlocal
