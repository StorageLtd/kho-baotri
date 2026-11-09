$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'tools/fanuc-bridge-manager/Manager.Core.ps1')
function Assert($ok,$message){if(-not $ok){throw $message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('manager-'+[Guid]::NewGuid().ToString('N'))
try{
 Initialize-Manager $folder (Join-Path $root 'tools/fanuc-bridge-manager')
 $templates=Get-MachineTemplates;Assert ($templates.Count -eq 6) 'Template library missing'
 Assert (@($templates|Where-Object orientation -eq 'horizontal').Count -ge 1 -and @($templates|Where-Object machineKind -eq 'lathe').Count -ge 1) 'Horizontal / lathe presets missing'
 $newId=New-MachineId 'Máy phay đứng 01';Assert ($newId -eq 'may-phay-dung-01') 'Vietnamese machine ID conversion failed'
 $machineInput=[pscustomobject]@{machineId=$newId;machineName='Máy phay đứng 01';cncIp='192.168.1.11';port=8193;intervalSeconds=5;model='FANUC 0i-MF Plus';machineKind='mill-3axis';orientation='vertical';machineTemplate='vertical-3';axisNames='X,Y,Z';spindleCount=1;offsetTable='m-c';offsetProfileConfirmed=$false;password='must-not-persist';partsPerCount=2;partCounterVerified=$true}
 $saved=Save-MachineConfig $machineInput
 $path=Get-MachineConfigPath $newId;Assert (Test-Path $path) 'Configuration not saved'
 $raw=Get-Content -LiteralPath $path -Raw -Encoding UTF8;Assert ($raw -notlike '*must-not-persist*') 'Unrecognized secret persisted'
 Assert ($saved.partsPerCount -eq 2 -and $saved.partCounterVerified) 'Part counter conversion lost'
 Assert ($saved.machiningContextProfile -eq 'unverified') 'Profile auto-enabled by template'
 $machineInput.offsetProfileConfirmed=$true;$normalized=ConvertTo-MachineConfig $machineInput;Assert ($normalized.machiningContextProfile -eq 'verified-fanuc-m-3axis-memory-c') 'Confirmed compatible profile not mapped'
 $machineInput.machineKind='lathe';$rejected=$false;try{$null=ConvertTo-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Lathe accepted with verified milling profile'
 $machineInput.machineKind='mill-3axis';$machineInput.offsetProfileConfirmed=$false
 $rejected=$false;try{$null=Save-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Existing config overwritten without expected hash'
 $hash=(Get-FileHash -LiteralPath $path).Hash;$machineInput.machineName='Máy đứng 01';$null=Save-MachineConfig $machineInput $hash;Assert (Test-Path ($path+'.bak')) 'Backup not created'
 $rejected=$false;try{$null=Save-MachineConfig $machineInput $hash}catch{$rejected=$true};Assert $rejected 'Stale edit overwrote changed config'
 $machineInput.machineId='cnc-2';$rejected=$false;try{$null=Save-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Duplicate endpoint accepted'
 $machineInput.cncIp='192.168.1.12';$null=Save-MachineConfig $machineInput
 Assert (@(Get-ManagerMachines).Count -eq 2) 'Multiple machines not retained'
 Assert ((Get-MachineFolder $newId) -ne (Get-MachineFolder 'cnc-2')) 'Machine data folders collide'
 foreach($bad in @('../escape','UPPER','machine/1')){$rejected=$false;try{Get-MachineFolder $bad}catch{$rejected=$true};Assert $rejected 'Unsafe ID allowed'}
 $process=Get-Process -Id $PID
 [pscustomobject]@{pid=$process.Id;startedTicks=$process.StartTime.ToUniversalTime().Ticks}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path (Get-MachineFolder 'cnc-2') 'runtime.json')
 Assert ($null -ne (Get-ManagerProcess 'cnc-2')) 'Running bridge identity not recognized'
 $rejected=$false;try{$null=Save-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Running machine config was overwritten'
 Stop-ManagerBridge 'cnc-2'
 Assert (Test-Path (Join-Path (Get-MachineFolder 'cnc-2') 'stop-request')) 'Graceful stop signal missing'
 Assert (-not (Get-Process -Id $PID).HasExited) 'Stop signal terminated process instead of asking bridge to stop'
 $blocked=$false;try{Stop-StuckManagerBridge 'cnc-2'}catch{$blocked=$true};Assert $blocked 'Premature forced stop allowed'
 function Stop-Process {param($Id,$ErrorAction);$global:ManagerTestClosedPid=$Id}
 [IO.File]::SetLastWriteTimeUtc((Join-Path (Get-MachineFolder 'cnc-2') 'stop-request'),[DateTime]::UtcNow.AddSeconds(-20))
 Stop-StuckManagerBridge 'cnc-2'
 Assert ($global:ManagerTestClosedPid -eq $PID) 'Stuck bridge fallback targeted wrong process'
 Remove-Item Function:Stop-Process
 Remove-Item -LiteralPath (Join-Path (Get-MachineFolder 'cnc-2') 'runtime.json')
 $machineInput.axisNames='X,X,Z';$rejected=$false;try{$null=ConvertTo-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Duplicate axes allowed'
 $machineInput.axisNames='X,Y,Z';$machineInput.port=70000;$rejected=$false;try{$null=ConvertTo-MachineConfig $machineInput}catch{$rejected=$true};Assert $rejected 'Invalid port allowed'
 $machineInput.port=8193
 foreach($table in @('m-a','m-b','m-c')){$machineInput.offsetTable=$table;$machineInput.offsetProfileConfirmed=$true;$normalized=ConvertTo-MachineConfig $machineInput;Assert ($normalized.machiningContextProfile -eq ('verified-fanuc-m-3axis-memory-'+$table.Substring(2))) 'A/B/C selection not preserved'}
 $archiveSource=Get-MachineFolder 'cnc-2';[IO.File]::WriteAllText((Join-Path $archiveSource 'keep-report.txt'),'report data')
 $archive=Remove-ManagerMachine 'cnc-2' (Get-FileHash -LiteralPath (Get-MachineConfigPath 'cnc-2')).Hash
 Assert (-not (Test-Path -LiteralPath (Get-MachineConfigPath 'cnc-2'))) 'Removed machine still listed'
 Assert ((Get-Content -LiteralPath (Join-Path $archive 'keep-report.txt') -Raw) -eq 'report data') 'Archiving discarded reports'
 Remove-Item -LiteralPath $archive -Recurse -Force
 $info=New-ManagerLaunchInfo 'powershell.exe' '-NoProfile -NonInteractive -File bridge.ps1 -CredentialFromStdin'
 Assert ($info.CreateNoWindow -and -not $info.UseShellExecute -and $info.RedirectStandardInput) 'Private stdin process launch not configured'
 $credential=New-Object Management.Automation.PSCredential('fixture@example.invalid',(ConvertTo-SecureString 'fixture-unicode-試験' -AsPlainText -Force))
 $writer=New-Object IO.StringWriter
 Send-ManagerCredential $writer $credential 'cnc-test'
 $encoded=$writer.ToString().Trim();$decoded=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))|ConvertFrom-Json
 Assert ($decoded.version -eq 1 -and $decoded.machineId -eq 'cnc-test' -and $decoded.password -eq 'fixture-unicode-試験') 'Credential pipe Unicode/identity framing corrupted'
 Assert ($info.Arguments -notlike '*fixture*' -and $info.EnvironmentVariables.Count -gt 0) 'Credential included in argv'
 $consumer=Join-Path $folder 'stdin-consumer.ps1';$proof=Join-Path $folder 'stdin-proof.json'
 @'
param($BridgeSource,$Proof)
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($BridgeSource,[ref]$tokens,[ref]$errors)
$fn=$ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-BridgeStdinCredential'},$false)[0]
. ([scriptblock]::Create($fn.Extent.Text))
$credential=Read-BridgeStdinCredential 'cnc-test'
try{@{emailMatches=$credential.UserName -eq 'fixture@example.invalid';passwordMatches=$credential.GetNetworkCredential().Password -eq 'fixture-unicode-試験'}|ConvertTo-Json|Set-Content -LiteralPath $Proof -Encoding UTF8}finally{$credential.Password.Dispose()}
'@ |Set-Content -LiteralPath $consumer -Encoding UTF8
 $child=New-Object Diagnostics.Process
 $hostShell=(Get-Process -Id $PID).Path
 $args='-NoProfile -NonInteractive -File "'+$consumer+'" -BridgeSource "'+(Join-Path $root 'tools/fanuc-bridge/Start-FanucBridge.ps1')+'" -Proof "'+$proof+'"'
 $child.StartInfo=New-ManagerLaunchInfo $hostShell $args
 Assert ($child.Start()) 'Private stdin consumer did not start'
 try{Send-ManagerCredential $child.StandardInput $credential 'cnc-test'}finally{$child.StandardInput.Close()}
 if(-not $child.WaitForExit(15000)){$child.Kill();throw 'Private stdin consumer timed out'}
 Assert ($child.ExitCode -eq 0) 'Private stdin child process failed'
 $result=Get-Content -LiteralPath $proof -Raw -Encoding UTF8|ConvertFrom-Json
 Assert ($result.emailMatches -and $result.passwordMatches) 'Credential did not survive real private stdin transfer'
 $child.Dispose()
 Write-Output 'PASS: real background child process receives Unicode credentials over private stdin, without a GUI or credential file.'
 $credential.Password.Dispose();$writer.Dispose();$decoded=$null;$encoded=$null
 $e=$null;$t=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'tools/fanuc-bridge-manager/Start-Manager.ps1'),[ref]$t,[ref]$e);Assert ($e.Count -eq 0) 'GUI PowerShell syntax error'
 Write-Output 'PASS: templates, Vietnamese IDs, secure config projection, multi-machine save, backup, stale-edit/duplicate endpoint/path guards, profile confirmation and GUI syntax. No CNC/cloud calls.'
}finally{if(Test-Path $folder){Remove-Item -LiteralPath $folder -Recurse -Force}}
