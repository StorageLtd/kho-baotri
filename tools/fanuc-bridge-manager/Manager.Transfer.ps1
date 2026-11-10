# Optional transfer companion. Monitoring remains available if this feature fails to load.
$script:ManagerTransferServer=$null;$script:ManagerTransferTarget=$null;$script:ManagerTransferReady=$false
function Initialize-ManagerTransfer {
 if($script:ManagerTransferReady){return}
 if(-not ('LtdWebTransferServer' -as [type])){
  Add-Type -Path @((Join-Path $PSScriptRoot 'transfer/ProgramTransfer.cs'),(Join-Path $PSScriptRoot 'transfer/WebTransferServer.cs'),(Join-Path $PSScriptRoot 'transfer/TransferPasswordStore.cs')) -ReferencedAssemblies @('System.dll','System.Core.dll','System.Runtime.Serialization.dll','System.Xml.dll')
 }
 $script:ManagerTransferReady=$true
}
function Get-ManagerTransferPasswordPath {return Join-Path $script:ManagerHome 'transfer-auth.json'}
function Set-ManagerTransferPassword([string]$Password){
 if($script:ManagerTransferServer){throw 'Dừng truy cập truyền trên web trước khi đổi mật khẩu.'}
 Initialize-ManagerTransfer
 [TransferPasswordStore]::Save((Get-ManagerTransferPasswordPath),$Password)
}
function Start-ManagerTransfer([string]$Id,[string]$ExpectedHash){
 if($script:ManagerTransferServer){throw 'Đang bật truyền cho một máy. Dừng phiên cũ trước khi chọn máy khác.'}
 if(-not $Id){throw 'Chọn và lưu máy trước khi bật truyền.'}
 $path=Get-MachineConfigPath $Id
 if(-not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $ExpectedHash){throw 'Cấu hình đã thay đổi. Chọn lại máy đã lưu.'}
 $saved=Get-Content -LiteralPath $path -Raw -Encoding UTF8|ConvertFrom-Json
 Initialize-ManagerTransfer
 [FanucProgramTransfer]::LoadLibrary((Join-Path $script:ManagerPackage 'lib'))
 $server=New-Object LtdWebTransferServer([string]$saved.cncIp,[uint16]$saved.port,(Join-Path $script:ManagerPackage 'lib'),8766,(Get-ManagerTransferPasswordPath))
 try{$server.Start()}catch{$server.Dispose();throw}
 $script:ManagerTransferServer=$server
 $script:ManagerTransferTarget=[pscustomobject]@{id=$saved.machineId;name=$saved.machineName;ip=$saved.cncIp;port=$saved.port}
 return $server
}
function Stop-ManagerTransfer {
 if(-not $script:ManagerTransferServer){return $true}
 if(-not $script:ManagerTransferServer.TryStop()){return $false}
 $script:ManagerTransferServer.Dispose();$script:ManagerTransferServer=$null;$script:ManagerTransferTarget=$null
 return $true
}
