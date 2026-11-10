$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'tools/fanuc-bridge-manager/Manager.Core.ps1')
. (Join-Path $root 'tools/fanuc-bridge-manager/Manager.Transfer.ps1')
. (Join-Path $root 'tools/fanuc-bridge-manager/Startup.Diagnostics.ps1')
function Assert($ok,[string]$Message){if(-not $ok){throw $Message}}
# Fake only the optional companion boundary. No DLL loading or CNC network operations.
Add-Type -TypeDefinition @'
using System;
public static class FanucProgramTransfer {public static int Loads;public static string Library;public static void LoadLibrary(string library){Loads++;Library=library;}}
public static class TransferPasswordStore {public static string SavedPath;public static void Save(string path,string password){SavedPath=path;}}
public sealed class LtdWebTransferServer:IDisposable {
 public string Ip,Library,PasswordPath;public ushort Port;public bool Busy,Started,Disposed;public int WebPort;
 public LtdWebTransferServer(string ip,ushort port,string library,int webPort,string passwordPath){Ip=ip;Port=port;Library=library;WebPort=webPort;PasswordPath=passwordPath;}
 public void Start(){Started=true;}public bool TryStop(){return !Busy;}public void Dispose(){Disposed=true;}
}
'@
$folder=Join-Path ([IO.Path]::GetTempPath()) ('manager-transfer-'+[Guid]::NewGuid().ToString('N'))
try{
 Initialize-Manager $folder (Join-Path $root 'tools/fanuc-bridge-manager')
 Assert ($null -eq $script:ManagerTransferServer -and [FanucProgramTransfer]::Loads -eq 0) 'Transfer automatically armed on Manager startup'
 $machine=[pscustomobject]@{machineId='test';machineName='Máy thử';cncIp='192.168.1.11';port=8193;intervalSeconds=5;model='0i-MF';machineKind='unknown';orientation='unknown';machineTemplate='custom';axisNames='X,Y,Z';spindleCount=1;offsetTable='unverified';offsetProfileConfirmed=$false;partsPerCount=1;partCounterVerified=$false}
 $saved=Save-MachineConfig $machine;$path=Get-MachineConfigPath 'test';$before=[IO.File]::ReadAllText($path);$hash=(Get-FileHash $path).Hash
 foreach($case in @(@('',''),@('test','stale'))){$failed=$false;try{$null=Start-ManagerTransfer $case[0] $case[1]}catch{$failed=$true};Assert ($failed -and [FanucProgramTransfer]::Loads -eq 0) 'Missing/stale configuration reached transfer loader'}
 Set-ManagerTransferPassword 'fixture-transfer-pass';Assert ([TransferPasswordStore]::SavedPath -eq (Get-ManagerTransferPasswordPath)) 'Password configuration outside Manager data folder'
 $server=Start-ManagerTransfer 'test' $hash
 Assert ($server.Started -and $server.Ip -eq $saved.cncIp -and $server.Port -eq 8193 -and $server.WebPort -eq 8766) 'Transfer did not use stored selected machine'
 Assert ($server.Library -eq (Join-Path $script:ManagerPackage 'lib')) 'Separate DLL folder incorrectly required'
 Assert ($script:ManagerTransferTarget.id -eq 'test' -and $script:ManagerTransferServer.PasswordPath -eq (Get-ManagerTransferPasswordPath)) 'Selected target or pairing code lost'
 $failed=$false;try{$null=Start-ManagerTransfer 'test' $hash}catch{$failed=$true};Assert ($failed -and [FanucProgramTransfer]::Loads -eq 1) 'Active companion retargeted or duplicated'
 $server.Busy=$true;Assert (-not (Stop-ManagerTransfer) -and -not $server.Disposed -and $null -ne $script:ManagerTransferTarget) 'Active CNC transfer interrupted'
 $server.Busy=$false;Assert ((Stop-ManagerTransfer) -and $server.Disposed -and $null -eq $script:ManagerTransferServer -and $null -eq $script:ManagerTransferTarget) 'Stop did not revoke companion'
 Assert ([IO.File]::ReadAllText($path) -ceq $before) 'Pairing changed original machine config'
 Assert ((Stop-ManagerTransfer)) 'Idempotent stop failed'
 foreach($name in @('Start-Manager.ps1','Manager.Transfer.ps1','Startup.Diagnostics.ps1')){
  $errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root "tools/fanuc-bridge-manager/$name"),[ref]$tokens,[ref]$errors);Assert ($errors.Count -eq 0) ('GUI/optional module parser: '+$name)
 }
 $failure=New-Object Management.Automation.ErrorRecord([InvalidOperationException]::new('Missing System.Xml reference'),'startup-test',[Management.Automation.ErrorCategory]::InvalidOperation,$null)
 $diagnostic=Save-ManagerStartupFailure $failure (Join-Path $folder 'startup-log');Assert ((Test-Path $diagnostic.LogPath) -and ([IO.File]::ReadAllText($diagnostic.LogPath) -match 'Missing System.Xml reference')) 'Startup details not retained after dialog closes'
 Write-Host 'PASS: opt-in integrated transfer, selected saved target/hash, shared DLL folder, duplicate prevention, busy stop/exit guard and pairing revocation; config preserved; GUI/startup parser. No CNC/cloud calls.'
}finally{Remove-Item $folder -Recurse -Force -ErrorAction SilentlyContinue}
