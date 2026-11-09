@echo off
setlocal
set "LTD_DIAG_HOME=%~dp0"
set "LTD_DIAG_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "LTD_DIAG_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
start "" "%LTD_DIAG_PS%" -WindowStyle Hidden -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -Command "$root=$env:LTD_DIAG_HOME; @('Start-Diagnostics.ps1','DiagnosticReader.cs') | ForEach-Object {Unblock-File -LiteralPath (Join-Path $root $_)}; & (Join-Path $root 'Start-Diagnostics.ps1')"
endlocal
