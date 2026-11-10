$ErrorActionPreference='Stop'
$entry=Join-Path $PSScriptRoot 'Start-Manager.ps1'
if(-not (Test-Path -LiteralPath $entry)){$entry=Join-Path $PSScriptRoot '../fanuc-bridge-manager/Start-Manager.ps1'}
if(-not (Test-Path -LiteralPath $entry)){throw 'Tải gói Bridge Manager tích hợp rồi mở START-MANAGER.cmd.'}
& $entry
