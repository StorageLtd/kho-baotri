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
function Update-ManagerTransferMachines {
 if(-not $script:ManagerTransferServer){return}
 $machines=@(Get-ManagerMachines);$json=ConvertTo-Json -InputObject @($machines|Select-Object machineId,machineName,cncIp,port) -Depth 6 -Compress
 if($json -cne $script:ManagerTransferRegistryJson -and $script:ManagerTransferServer.TrySetMachines($json)){$script:ManagerTransferRegistryJson=$json}
 $script:ManagerTransferTarget=[pscustomobject]@{count=$script:ManagerTransferServer.MachineCount}
}
function Start-ManagerTransfer([string]$Id='',[string]$ExpectedHash=''){
 if($script:ManagerTransferServer){Update-ManagerTransferMachines;return $script:ManagerTransferServer}
 if($Id){$path=Get-MachineConfigPath $Id;if(-not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $ExpectedHash){throw 'Cấu hình đã thay đổi. Chọn lại máy đã lưu.'}}
 $machines=@(Get-ManagerMachines);if(-not $machines.Count){throw 'Lưu ít nhất một máy trong Manager trước.'}
 $saved=$machines[0]
 Initialize-ManagerTransfer
 [FanucProgramTransfer]::LoadLibrary((Join-Path $script:ManagerPackage 'lib'))
 $server=New-Object LtdWebTransferServer([string]$saved.cncIp,[uint16]$saved.port,(Join-Path $script:ManagerPackage 'lib'),8766,(Get-ManagerTransferPasswordPath))
 $json=ConvertTo-Json -InputObject @($machines|Select-Object machineId,machineName,cncIp,port) -Depth 6 -Compress
 try{if(-not $server.TrySetMachines($json)){throw 'Chưa cập nhật được danh sách máy.'};$server.Start()}catch{$server.Dispose();throw}
 $script:ManagerTransferServer=$server;$script:ManagerTransferRegistryJson=$json
 $script:ManagerTransferTarget=[pscustomobject]@{count=$machines.Count}
 return $server
}
function Stop-ManagerTransfer {
 if(-not $script:ManagerTransferServer){return $true}
 if(-not $script:ManagerTransferServer.TryStop()){return $false}
 $script:ManagerTransferServer.Dispose();$script:ManagerTransferServer=$null;$script:ManagerTransferTarget=$null;$script:ManagerTransferRegistryJson=''
 return $true
}
