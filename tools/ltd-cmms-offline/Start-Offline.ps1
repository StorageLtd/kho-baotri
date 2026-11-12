[CmdletBinding()]
param([int]$Port=8088,[string]$DataRoot='', [switch]$NoBrowser,[switch]$NoCollectors,[switch]$Headless)
$ErrorActionPreference='Stop'
$server=$null;$storeLock=$null
try {
 if([IntPtr]::Size -ne 8){throw 'Use 64-bit Windows PowerShell.'}
 if($Port -lt 1024 -or $Port -gt 65535){throw 'Invalid local port'}
 Add-Type -Path (Join-Path $PSScriptRoot 'LocalHost.cs')
 . (Join-Path $PSScriptRoot 'Offline.Core.ps1')
 . (Join-Path $PSScriptRoot 'Collectors.ps1')
 if(-not $Headless){. (Join-Path $PSScriptRoot 'Windows.Gui.ps1')}
 if(-not $DataRoot){$DataRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD\CmmsOffline'}
 $DataRoot=[IO.Path]::GetFullPath($DataRoot);$null=New-Item -ItemType Directory -Path $DataRoot -Force
 try{$storeLock=[IO.File]::Open((Join-Path $DataRoot '.server.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'Không mở được dữ liệu nội bộ. Kiểm tra chương trình LTD ở khay hệ thống; không chạy hai bản cùng lúc. Nếu chưa chạy, kiểm tra quyền truy cập thư mục dữ liệu.'}
 Initialize-OfflineStore $DataRoot;Initialize-OfflineCollectors
 if(-not $script:Accounts.Count){
  if($Headless){throw 'Initialize a local admin account before headless startup.'}
  Initialize-OfflineAdminGui
 }
 Write-OfflineJson $script:DatabasePath $script:Database
 $server=New-Object OfflineHost -ArgumentList $Port,(Join-Path $PSScriptRoot 'web');try{$server.Start()}catch{throw ('Không mở được cổng nội bộ '+$Port+'. Đóng bản đang chạy hoặc dùng một cổng khác. Dữ liệu chưa bị xóa.')}
 $url="http://localhost:$Port/";Write-Output ('READY '+$url)
 $script:LastCollectorCheck=[DateTime]::MinValue
 function Invoke-OfflineTick {
  $request=$null;$count=0
  while($count -lt 20 -and $server.TryTake([ref]$request)){Invoke-OfflineRequest $request;$count++}
  if(-not $NoCollectors -and ([DateTime]::UtcNow-$script:LastCollectorCheck).TotalSeconds -ge 2){$script:LastCollectorCheck=[DateTime]::UtcNow;try{Sync-OfflineCollectors}catch{Write-Warning 'Local collector/storage update failed; check available disk space and local data folder.'}}
 }
 if(-not $NoBrowser){try{Start-Process $url}catch{}}
 if($Headless){while($true){Invoke-OfflineTick;Start-Sleep -Milliseconds 40}}
 else {
  Show-OfflineManager $url $DataRoot
 }
}catch{
 Write-Host ('OFFLINE STOPPED: '+$_.Exception.Message) -ForegroundColor Red
 if(-not $Headless){try{Show-OfflineError $_.Exception.Message}catch{}}
 exit 1
}finally{try{Close-OfflineCollectors}catch{};if($server){$server.Dispose()};if($storeLock){$storeLock.Dispose()}}
