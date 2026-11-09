# Run on Linux with the compiled test double in LD_LIBRARY_PATH. Never uses a real FANUC DLL.
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-bridge/FanucReader.cs')
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class FixtureNative {
 [DllImport("Fwlib64.dll")] public static extern void fixture_memory(int value);
 [DllImport("Fwlib64.dll")] public static extern void fixture_bad_column(int value);
 [DllImport("Fwlib64.dll")] public static extern int fixture_ends();
}
'@
function Assert($ok,$message){if(-not $ok){throw $message}}
function Read-Private($name,$arguments){$nativeArgs=New-Object 'object[]' $arguments.Count;for($i=0;$i -lt $arguments.Count;$i++){$nativeArgs[$i]=$arguments[$i].PSObject.BaseObject};[FanucReader].GetMethod($name,[Reflection.BindingFlags]'NonPublic,Static').Invoke($null,$nativeArgs)|Out-Null}
foreach($memory in @(0,1,2)){
 [FixtureNative]::fixture_memory($memory)
 $snapshot=New-Object FanucReader+Snapshot;$snapshot.machineType='M';$snapshot.axes='03'
 Read-Private 'ReadMachiningContext' @([uint16]42,$snapshot,$true,[int]$memory)
 $c=$snapshot.machiningContext
 Assert ($c.spindleToolNumber -eq 1 -and $c.nextToolNumber -eq 4 -and $c.commandedToolNumber -eq 99 -and $c.toolNumber -eq 1 -and $c.spindleToolConfirmed) 'Actual HD.T incorrectly replaced with modal T'
 Assert ($snapshot.toolOffsets.rows.Length -eq 32) 'Native offset table decoding failed'
 Assert ($snapshot.toolOffsets.memory -eq ([char]([int][char]'A'+$memory)).ToString()) 'Wrong memory table type'
 if($memory -eq 0){Assert ($snapshot.toolOffsets.rows[0].value -eq -1) 'Memory A scaling incorrect'}
 if($memory -eq 1){Assert ($snapshot.toolOffsets.rows[0].geometry -eq -1 -and $snapshot.toolOffsets.rows[0].wear -eq -1.0001) 'Memory B column decoding incorrect'}
 if($memory -eq 2){Assert ($snapshot.toolOffsets.rows[0].radiusWear -eq -1.0003) 'Memory C radius wear decoding incorrect';Assert ($c.lengthGeometry -eq 1.0003 -and $c.lengthWear -eq 1.0002 -and $c.radiusGeometry -eq 4.0001 -and $c.radiusWear -eq 4) 'Single-value offset API incorrectly used range API column types'}
}
$snapshot=New-Object FanucReader+Snapshot;$snapshot.machineType='M';$snapshot.axes='03'
Read-Private 'ReadMachiningContext' @([uint16]42,$snapshot,$true,[int]0)
Assert ($null -eq $snapshot.toolOffsets) 'Mismatched declared/native offset table accepted'
Read-Private 'ReadGcodes' @([uint16]42,$snapshot)
Assert ($snapshot.modalGcodes.Length -eq 3 -and $snapshot.modalGcodes[1].code -eq 'G54.1') 'Native modal G-code array decoded incorrectly'
Read-Private 'ReadWorkCoordinates' @([uint16]42,$snapshot)
Assert ($snapshot.workCoordinates.Length -eq 7 -and $snapshot.workCoordinates[1].name -eq 'G54' -and $snapshot.workCoordinates[1].x -eq -21.5024 -and $snapshot.workCoordinates[1].unit -eq 'inch') 'Work table mapping or scaling incorrect'
$snapshot.activeProgram='O7020';Read-Private 'ReadFullProgram' @([uint16]42,$snapshot)
Assert ($snapshot.fullProgram.complete -and $snapshot.fullProgram.text.Contains('O07020') -and $snapshot.fullProgram.sha256.Length -eq 64) 'Full program buffering/retry failed'
Assert ([FixtureNative]::fixture_ends() -eq 1) 'Read transfer session not released'
$snapshot=New-Object FanucReader+Snapshot;$snapshot.activeProgram='O7021';Read-Private 'ReadFullProgram' @([uint16]42,$snapshot)
Assert ($null -eq $snapshot.fullProgram -and [FixtureNative]::fixture_ends() -eq 2) 'Wrong O file accepted or failed session not released'
$snapshot=New-Object FanucReader+Snapshot;$snapshot.activeProgram='O7022';Read-Private 'ReadFullProgram' @([uint16]42,$snapshot)
Assert ($null -eq $snapshot.fullProgram -and [FixtureNative]::fixture_ends() -eq 3) 'Partial file accepted or failed session not released'
Write-Output 'PASS: native ABI fixture for HD.T/NX.T, separate commanded T, A/B/C table arrays, G-code groups, signed XYZ, complete file transfer/retry and failure cleanup. No CNC connected.'
