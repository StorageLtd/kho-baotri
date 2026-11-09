$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'tools/fanuc-bridge/Bridge.State.ps1')
function Assert($value,$message){if(-not $value){throw $message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('bridge-state-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $folder
try{
 $path=Join-Path $folder 'bridge-state.json'
 Assert (Write-BridgeStateFile $path @{phase='active';run=0}) 'Initial state not written'
 $held=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
 try{
  Assert (Write-BridgeStateFile $path @{phase='active';run=3}) 'Shared reader blocked atomic writer'
  $current=Read-BridgeStateFile $path;Assert ($current.run -eq 3) 'New reader did not see complete new state'
  $reader=New-Object IO.StreamReader($held,[Text.Encoding]::UTF8)
  try{$old=$reader.ReadToEnd()|ConvertFrom-Json;Assert ($old.run -eq 0) 'Open reader saw a partial replacement'}finally{$reader.Dispose()}
 }finally{$held.Dispose()}
 for($i=0;$i -lt 50;$i++){Assert (Write-BridgeStateFile $path @{sequence=$i;phase='active'}) 'Repeated atomic write failed';Assert ((Read-BridgeStateFile $path).sequence -eq $i) 'Corrupt or partial JSON observed'}
 $directory=Join-Path $folder 'not-a-file';$null=New-Item -ItemType Directory -Path $directory
 Assert (-not (Write-BridgeStateFile $directory @{phase='active'})) 'Non-file target should fail nonfatally'
 Assert (@(Get-ChildItem -LiteralPath $folder -Filter '*.tmp').Count -eq 0) 'State temporary files leaked'
 if([Environment]::OSVersion.Platform -eq 'Win32NT'){
  $denyDelete=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{Assert (-not (Write-BridgeStateFile $path @{phase='blocked'})) 'Windows deny-delete lock not handled'}finally{$denyDelete.Dispose()}
 }
 Write-Output 'PASS: shared read/delete handles, complete atomic snapshots, nonfatal I/O failure and temp cleanup. Windows deny-delete case runs on Windows.'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
