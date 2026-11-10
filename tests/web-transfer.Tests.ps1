$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -Path @((Join-Path $root 'tools/fanuc-program-transfer/ProgramTransfer.cs'),(Join-Path $root 'tools/fanuc-program-transfer/WebTransferServer.cs'),(Join-Path $root 'tools/fanuc-program-transfer/TransferPasswordStore.cs'))
function Assert($Value,[string]$Message){if(-not $Value){throw $Message}}
$flags=[Reflection.BindingFlags]'NonPublic,Static'
[FanucProgramTransfer].GetField('loadedDirectory',$flags).SetValue($null,'fixture')
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class TxFixture {
 [DllImport("Fwlib64.dll")]public static extern void tx_reset(int m);
 [DllImport("Fwlib64.dll")]public static extern int tx_opened();
 [DllImport("Fwlib64.dll")]public static extern System.IntPtr tx_last_ip();
 [DllImport("Fwlib64.dll")]public static extern int tx_freed();
 [DllImport("Fwlib64.dll")]public static extern int tx_starts();
 [DllImport("Fwlib64.dll")]public static extern int tx_ends();
 [DllImport("Fwlib64.dll")]public static extern int tx_upends();
 [DllImport("Fwlib64.dll",CharSet=CharSet.Ansi)]public static extern int tx_matches(string value);
}
'@
$folder=Join-Path ([IO.Path]::GetTempPath()) ('ltd-tx-'+[Guid]::NewGuid().ToString('N'));$null=New-Item -ItemType Directory $folder;$server=$null
try{
 $file=Join-Path $folder 'send.nc';$content="%`nO2000 (TEST)`nG90 G54`nM30`n%`n";[IO.File]::WriteAllText($file,$content,[Text.Encoding]::ASCII);$selected=[FanucProgramTransfer]::ValidateFile($file)
 [TxFixture]::tx_reset(0);$list=[FanucProgramTransfer]::ListPrograms('192.168.1.1',8193,'fixture');Assert ($list.Count -eq 2 -and $list[0].Number -eq 1234 -and $list[0].Modified -eq '10/11/2026 09:30') 'Directory PRGDIR3 ABI'
 [TxFixture]::tx_reset(0);$null=[FanucProgramTransfer]::Send('192.168.1.1',8193,'fixture',$file,$selected.Hash,'TRUYEN O2000');Assert ([TxFixture]::tx_matches($content) -eq 1 -and [TxFixture]::tx_ends() -eq 1 -and [FanucProgramTransfer]::Progress -eq 100) 'Partial chunk handling, EW_BUFFER or transmitted bytes'
 foreach($mode in @(1,2,3,5,8)){
  [TxFixture]::tx_reset($mode);$failed=$false;try{$null=[FanucProgramTransfer]::Send('192.168.1.1',8193,'fixture',$file,$selected.Hash,'TRUYEN O2000')}catch{$failed=$true};Assert $failed ('Unsafe send accepted '+$mode);Assert ([TxFixture]::tx_opened() -eq [TxFixture]::tx_freed()) 'Send handle leak';if($mode -in @(1,2,3)){Assert ([TxFixture]::tx_starts() -eq 0) 'Write started before gates'}else{Assert ([TxFixture]::tx_ends() -eq 1) 'End retried or missing cleanup'}
 }
 [TxFixture]::tx_reset(0);$bytes=[FanucProgramTransfer]::Receive('192.168.1.1',8193,'fixture',1234);Assert ([Text.Encoding]::ASCII.GetString($bytes) -match 'M99' -and [TxFixture]::tx_upends() -eq 1) 'Receive must support subprograms and complete upload'
 $save=Join-Path $folder 'received.nc';[FanucProgramTransfer]::SaveReceived($save,$bytes,1234);$failed=$false;try{[FanucProgramTransfer]::SaveReceived($save,$bytes,1234)}catch{$failed=$true};Assert ($failed -and [IO.File]::ReadAllBytes($save).Length -eq $bytes.Length) 'Local overwrite not blocked'
 foreach($mode in @(4,6,7)){
  [TxFixture]::tx_reset($mode);$failed=$false;try{$null=[FanucProgramTransfer]::Receive('192.168.1.1',8193,'fixture',1234)}catch{$failed=$true};Assert $failed 'Protected, wrong or partial receive accepted';Assert ([TxFixture]::tx_upends() -eq 1 -and [TxFixture]::tx_freed() -eq 1) 'Receive cleanup missing'
 }
 foreach($script in @('Start-WebTransfer.ps1','Start-Transfer.ps1')){$errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root "tools/fanuc-program-transfer/$script"),[ref]$tokens,[ref]$errors);Assert ($errors.Count -eq 0) ('GUI syntax: '+$script)}
 $socket=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0);$socket.Start();$localPort=([Net.IPEndPoint]$socket.LocalEndpoint).Port;$socket.Stop()
 $passwordPath=Join-Path $folder 'transfer-auth.json';[TransferPasswordStore]::Save($passwordPath,'fixture-transfer-pass');$passwords=New-Object TransferPasswordStore($passwordPath);Assert ($passwords.Verify('fixture-transfer-pass') -and -not $passwords.Verify('wrong-password')) 'Password verification failed';Assert (-not [IO.File]::ReadAllText($passwordPath).Contains('fixture-transfer-pass')) 'Plaintext password saved';$server=New-Object LtdWebTransferServer('192.168.1.1',8193,'fixture',$localPort,$passwordPath);$machines='[{"machineId":"a","machineName":"CNC A","cncIp":"192.168.1.1","port":8193},{"machineId":"b","machineName":"CNC B","cncIp":"192.168.1.2","port":8193}]';Assert ($server.TrySetMachines($machines)) 'Machine registry setup failed';$server.Start();$token=''
 $client=New-Object Net.Http.HttpClient;$client.Timeout=[TimeSpan]::FromSeconds(10)
 function Request([string]$Action,[hashtable]$Extra=@{},[string]$Origin='https://storageltd.github.io',[string]$Token=$token){
  $request=New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Post,"http://127.0.0.1:$localPort/transfer");$null=$request.Headers.TryAddWithoutValidation('Origin',$Origin);$null=$request.Headers.TryAddWithoutValidation('X-LTD-Token',$Token)
  $body=@{action=$Action;ip='192.168.1.1';port=8193};foreach($key in $Extra.Keys){$body[$key]=$Extra[$key]}
  $request.Content=New-Object Net.Http.StringContent(($body|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
  try{$r=$client.SendAsync($request).GetAwaiter().GetResult();$json=$r.Content.ReadAsStringAsync().GetAwaiter().GetResult();return @{code=[int]$r.StatusCode;data=($json|ConvertFrom-Json);cors=$r.Headers.Contains('Access-Control-Allow-Origin')}}finally{$request.Dispose()}
 }
 [TxFixture]::tx_reset(0);$r=Request connect;Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Unauthenticated request reached CNC';$r=Request login @{password='wrong-password'};Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Wrong password reached CNC';$r=Request login @{password='fixture-transfer-pass'};Assert ($r.code -eq 200 -and $r.data.token.Length -eq 64) 'Password login failed';$token=$r.data.token;$r=Request connect;Assert ($r.code -eq 200 -and $r.data.ok -and $r.data.ip -eq '192.168.1.1') 'Pairing or serialization'
 $r=Request list @{} 'https://evil.example';Assert ($r.code -eq 403 -and -not $r.cors -and [TxFixture]::tx_opened() -eq 0) 'Untrusted origin reached CNC'
 $r=Request list @{} 'https://storageltd.github.io' 'bad';Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Invalid token reached CNC'
 $r=Request list @{ip='192.168.1.99'};Assert ($r.code -eq 400 -and [TxFixture]::tx_opened() -eq 0) 'Different CNC reached'
 [TxFixture]::tx_reset(0);$r=Request list @{ip='192.168.1.2'};Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Machine A session crossed into B'
 $loginB=Request login @{ip='192.168.1.2';password='fixture-transfer-pass'};Assert ($loginB.code -eq 200 -and $loginB.data.ip -eq '192.168.1.2') 'Password login for B failed';$tokenB=$loginB.data.token
 $r=Request list @{ip='192.168.1.2'} 'https://storageltd.github.io' $tokenB;Assert ($r.code -eq 200 -and [Runtime.InteropServices.Marshal]::PtrToStringAnsi([TxFixture]::tx_last_ip()) -eq '192.168.1.2') 'Registry sent B read to wrong CNC IP'
 [TxFixture]::tx_reset(0);$r=Request list @{} 'https://storageltd.github.io' $tokenB;Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Machine B session crossed into A'
 $checkB=Request inspect @{ip='192.168.1.2';content=$content} 'https://storageltd.github.io' $tokenB
 $r=Request send @{content=$content;hash=$checkB.data.hash;ticket=$checkB.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq 0) 'Machine B ticket wrote on A'
 $checkB=Request inspect @{ip='192.168.1.2';content=$content} 'https://storageltd.github.io' $tokenB
 $r=Request send @{ip='192.168.1.2';content=$content;hash=$checkB.data.hash;ticket=$checkB.data.ticket;confirmation='TRUYEN O2000'} 'https://storageltd.github.io' $tokenB;Assert ($r.code -eq 200 -and [Runtime.InteropServices.Marshal]::PtrToStringAnsi([TxFixture]::tx_last_ip()) -eq '192.168.1.2') 'Registered B send reached wrong CNC'
 Assert ($server.TrySetMachines('[{"machineId":"a","cncIp":"192.168.1.1","port":8193}]')) 'Remove B from registry failed'
 [TxFixture]::tx_reset(0);$r=Request list @{ip='192.168.1.2'} 'https://storageltd.github.io' $tokenB;Assert ($r.code -eq 400 -and [TxFixture]::tx_opened() -eq 0) 'Removed CNC still reached native API'
 Assert ($server.TrySetMachines($machines)) 'Registry refresh failed';$r=Request list @{ip='192.168.1.2'} 'https://storageltd.github.io' $tokenB;Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Removed/re-added CNC retained stale session'
 $r=Request list;Assert ($r.code -eq 200 -and $r.data.programs.Count -eq 2) 'Web list ABI'
 $r=Request send @{content=$content;hash=$selected.Hash;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq 0) 'No-ticket send reached CNC'
 $check=Request inspect @{content=$content};Assert ($check.code -eq 200 -and $check.data.ticket.Length -eq 64) 'Inspection grant missing'
 $r=Request send @{content=$content;hash=$check.data.hash;ticket=$check.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 200 -and [TxFixture]::tx_matches($content) -eq 1) 'Confirmed send failed'
 $started=[TxFixture]::tx_starts();$r=Request send @{content=$content;hash=$check.data.hash;ticket=$check.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq $started) 'Ticket replay accepted'
 [TxFixture]::tx_reset(0);$check=Request inspect @{content=$content};$r=Request send @{content=$content.Replace('G90','G91');hash=$check.data.hash;ticket=$check.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq 0) 'Changed content accepted'
 [TxFixture]::tx_reset(0);$check=Request inspect @{content=$content};[TxFixture]::tx_reset(1);$r=Request send @{content=$content;hash=$check.data.hash;ticket=$check.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq 0) 'Newly occupied O-number after inspect was overwritten'
 [TxFixture]::tx_reset(0);$check=Request inspect @{content=$content};[LtdWebTransferServer].GetField('ticketExpiry',[Reflection.BindingFlags]'NonPublic,Instance').SetValue($server,[DateTime]::UtcNow.AddMinutes(-1));$r=Request send @{content=$content;hash=$check.data.hash;ticket=$check.data.ticket;confirmation='TRUYEN O2000'};Assert ($r.code -eq 400 -and [TxFixture]::tx_starts() -eq 0) 'Expired inspection accepted'
 $preflight=New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Options,"http://127.0.0.1:$localPort/transfer");$null=$preflight.Headers.TryAddWithoutValidation('Origin','https://storageltd.github.io');$null=$preflight.Headers.TryAddWithoutValidation('Access-Control-Request-Private-Network','true');$r=$client.SendAsync($preflight).GetAwaiter().GetResult();Assert ([int]$r.StatusCode -eq 200 -and $r.Headers.Contains('Access-Control-Allow-Private-Network')) 'Loopback preflight failed';$preflight.Dispose()
 [TxFixture]::tx_reset(0);$r=Request receive @{number=1234};Assert ($r.code -eq 200 -and $r.data.text -match 'O1234' -and [TxFixture]::tx_starts() -eq 0) 'Receive triggered download'
 [TxFixture]::tx_reset(0);$other=Request login @{password='fixture-transfer-pass'};$otherToken=$other.data.token;$r=Request logout @{} 'https://storageltd.github.io' $otherToken;Assert ($r.code -eq 200) 'Logout failed';$r=Request connect @{} 'https://storageltd.github.io' $otherToken;Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Revoked session reached CNC'
 $oldHash=[IO.File]::ReadAllText($passwordPath);[TransferPasswordStore]::Save($passwordPath,'fixture-transfer-pass');Assert ([IO.File]::ReadAllText($passwordPath) -cne $oldHash) 'Password salt was reused'
 $r=Request connect;Assert ($r.code -eq 401 -and [TxFixture]::tx_opened() -eq 0) 'Password change did not revoke existing sessions'
 $r=Request login @{password='fixture-transfer-pass'};Assert ($r.code -eq 200) 'Login after password rotation failed';$token=$r.data.token
 for($i=0;$i -lt 5;$i++){$r=Request login @{password='wrong-password'};Assert ($r.code -eq 401) 'Wrong password accepted'}
 $r=Request login @{password='fixture-transfer-pass'};Assert ($r.code -eq 429 -and [TxFixture]::tx_opened() -eq 0) 'Login throttling failed'
 [TxFixture]::tx_reset(11)
 $pendingRequest=New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Post,"http://127.0.0.1:$localPort/transfer");$null=$pendingRequest.Headers.TryAddWithoutValidation('Origin','https://storageltd.github.io');$null=$pendingRequest.Headers.TryAddWithoutValidation('X-LTD-Token',$token);$pendingRequest.Content=New-Object Net.Http.StringContent((@{action='inspect';ip='192.168.1.1';port=8193;content=$content}|ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
 $pending=$client.SendAsync($pendingRequest);$wait=[Diagnostics.Stopwatch]::StartNew();while(-not $server.Busy -and -not $pending.IsCompleted -and $wait.ElapsedMilliseconds -lt 3000){Start-Sleep -Milliseconds 5}
 Assert (-not $server.TrySetMachines('[]') -and $server.MachineCount -eq 2) 'Registry changed during native operation'
 Assert ($server.Busy -and -not $server.TryStop()) 'Active CNC operation was interrupted by stop'
 $null=$pending.GetAwaiter().GetResult();$pendingRequest.Dispose();Assert ($server.TryStop()) 'Completed companion could not stop'
 Write-Host 'PASS: directory/native transfer ABI, partial writes/EW_BUFFER, no-overwrite/EDIT/path gates, delayed errors, complete receive/save; loopback origin/token/pinned target, one-use ticket and changed-content rejection. No CNC or Firebase contacted.'
}finally{if($server){$server.Dispose()};if($client){$client.Dispose()};Remove-Item $folder -Recurse -Force}
