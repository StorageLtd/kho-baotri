@echo off
setlocal
cd /d "%~dp0"
powershell.exe -STA -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command "Get-ChildItem -LiteralPath . -Recurse -File | Unblock-File; & './Start-Offline.ps1'"
if errorlevel 1 pause
endlocal
