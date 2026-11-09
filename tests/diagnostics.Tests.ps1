$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -Path (Join-Path $root 'tools/fanuc-diagnostics/DiagnosticReader.cs')
function Assert($Value,[string]$Message){if(-not $Value){throw $Message}}
$source=Get-Content (Join-Path $root 'tools/fanuc-diagnostics/DiagnosticReader.cs') -Raw
$imports=[regex]::Matches($source,'extern\s+\w+\s+(\w+)\(')|ForEach-Object {$_.Groups[1].Value}
$allowed=@('LoadLibraryEx','cnc_allclibhndl3','cnc_sysinfo','cnc_statinfo','cnc_rddiaginfo','cnc_diagnoss','pmc_rdpmcrng','cnc_freelibhndl')
Assert (($imports|Where-Object {$_ -notin $allowed}).Count -eq 0) 'Unexpected native operation'
Assert ($imports.Count -eq $allowed.Count) 'Native allowlist changed'
$errors=$null;$tokens=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'tools/fanuc-diagnostics/Start-Diagnostics.ps1'),[ref]$tokens,[ref]$errors)
Assert ($errors.Count -eq 0) ('GUI syntax: '+($errors|Out-String))
foreach($bad in @('Invoke-RestMethod','Invoke-WebRequest','Start-Process','Set-Content','Export-Csv')){Assert (-not $ast.Find({param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq $bad},$true)) ('Unexpected GUI operation: '+$bad)}
Assert ([LtdDiagnosticReader]::PmcArea('X') -eq 3 -and [LtdDiagnosticReader]::PmcArea('R') -eq 5) 'PMC area mapping'
try{[LtdDiagnosticReader]::PmcArea('K');throw 'K accepted'}catch{Assert ($_.Exception.Message -notmatch '^K accepted$') 'Unexpected area accepted'}
[byte[]]$pmc=3,0,0,0,10,0,10,0,66
Assert ([LtdDiagnosticReader]::DecodePmc($pmc,3,10) -eq 66) 'PMC byte decode'
$pmc[4]=11;try{[LtdDiagnosticReader]::DecodePmc($pmc,3,10);throw 'Mismatch accepted'}catch{Assert ($_.Exception.Message -notmatch '^Mismatch accepted$') 'Wrong PMC address accepted'}
function DgnBytes([int16]$Number,[int16]$Axis,[byte[]]$Value){return [byte[]]([BitConverter]::GetBytes($Number)+[BitConverter]::GetBytes($Axis)+$Value)}
Assert (([LtdDiagnosticReader]::DecodeDgn((DgnBytes 300 1 ([BitConverter]::GetBytes([int16]-1234))),300,1,134)).value -eq '-1234') 'Signed word'
Assert (([LtdDiagnosticReader]::DecodeDgn((DgnBytes 1 0 ([BitConverter]::GetBytes([uint32]4294967295))),1,0,3)).value -eq '4294967295') 'Unsigned 32-bit'
Assert (([LtdDiagnosticReader]::DecodeDgn((DgnBytes 1 0 ([byte[]](66))),1,0,0)).value -eq '0x42 / 01000010') 'Bit order'
[byte[]]$real=[BitConverter]::GetBytes([int32]-12345)+[BitConverter]::GetBytes([int32]3)
Assert (([LtdDiagnosticReader]::DecodeDgn((DgnBytes 1 0 $real),1,0,4099)).value -eq '-12.345') 'Real decimal'
try{[LtdDiagnosticReader]::DataSize(256);throw 'Spindle accepted'}catch{Assert ($_.Exception.Message -notmatch '^Spindle accepted$') 'Unsupported spindle DGN guessed'}
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class DiagFixture {
 [DllImport("Fwlib64.dll")] public static extern void fixture_reset(int value);
 [DllImport("Fwlib64.dll")] public static extern int fixture_opened();
 [DllImport("Fwlib64.dll")] public static extern int fixture_freed();
 [DllImport("Fwlib64.dll")] public static extern int fixture_calls();
}
'@
[DiagFixture]::fixture_reset(0)
$r=[LtdDiagnosticReader]::ReadAsync('192.168.1.1',8193,300,1,'X',10).GetAwaiter().GetResult()
Assert ($r.statusKnown -and $r.status.run -eq 3 -and $r.dgnValue -eq '-1234' -and $r.pmcValue -eq 66 -and -not $r.connectionError) 'Native status/DGN/PMC ABI'
Assert ([DiagFixture]::fixture_opened() -eq 1 -and [DiagFixture]::fixture_freed() -eq 1) 'Handle leaked'
[DiagFixture]::fixture_reset(2);$r=[LtdDiagnosticReader]::Read('192.168.1.1',8193,300,1,'R',423)
Assert ($r.dgnError -and -not $r.dgnValue -and $r.pmcValue -eq 66 -and [DiagFixture]::fixture_calls() -eq 2) 'Adjacent DGN substituted or error stopped PMC'
[DiagFixture]::fixture_reset(3);$r=[LtdDiagnosticReader]::Read('192.168.1.1',8193,-1,0,'X',10)
Assert ($r.pmcError -match 'FOCAS 3' -and $null -eq $r.pmcValue -and $r.statusKnown) 'PMC error shown as false zero'
[DiagFixture]::fixture_reset(4);$r=[LtdDiagnosticReader]::Read('192.168.1.1',8193,-1,0,'X',-1)
Assert ($r.connectionError -and -not $r.statusKnown -and [DiagFixture]::fixture_freed() -eq 1) 'Connection failure cleanup'
[DiagFixture]::fixture_reset(0);$r=[LtdDiagnosticReader]::Read('192.168.1.1',8193,-1,0,'X',-1)
Assert ([DiagFixture]::fixture_calls() -eq 0 -and $r.statusKnown) 'Optional reads issued without opt-in'
Assert ([LtdDiagnosticReader]::ModernDgnProfile(' 0',1538) -and -not [LtdDiagnosticReader]::ModernDgnProfile(' 0',0) -and -not [LtdDiagnosticReader]::ModernDgnProfile('15',0)) 'Wrong controller metadata profile accepted'
[DiagFixture]::fixture_reset(5);$r=[LtdDiagnosticReader]::Read('192.168.1.1',8193,300,1,'X',10)
Assert ($r.dgnError -match 'not validated' -and [DiagFixture]::fixture_calls() -eq 1 -and $r.pmcValue -eq 66) 'Unsupported DGN profile read or blocked independent PMC'
Write-Host 'PASS: read-only native allowlist, GUI syntax, byte/word/real DGN metadata, exact PMC byte/bit ordering, async native ABI, failure isolation and handle release. No CNC/cloud calls.'
