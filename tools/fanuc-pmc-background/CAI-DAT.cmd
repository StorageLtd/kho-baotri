@echo off
setlocal
set "LTD_PMC_SOURCE=%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -Command "$root=$env:LTD_PMC_SOURCE; @('Background-Common.ps1','Run-Background.ps1','Read-PmcBackground.ps1','Manage-Background.ps1','Setup-Background.ps1','PmcReadOnlyProbe.cs') | ForEach-Object { Unblock-File -LiteralPath (Join-Path $root $_) }; & (Join-Path $root 'Setup-Background.ps1')"
if errorlevel 1 pause
endlocal
