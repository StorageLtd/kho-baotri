# Local storage and authorization only. No cloud SDK, HTTP client or CNC writes.
function Convert-OfflineValue($Value,[int]$Depth=0) {
 if($Depth -gt 80){throw 'JSON_TOO_DEEP'}
 if($null -eq $Value){return $null}
 if($Value -is [DateTime]){return $Value.ToString('o')}
 if($Value -is [Collections.IDictionary]){$out=@{};foreach($key in $Value.Keys){$out[[string]$key]=Convert-OfflineValue $Value[$key] ($Depth+1)};return $out}
 if($Value -is [Management.Automation.PSCustomObject]){$out=@{};foreach($p in $Value.PSObject.Properties){$out[$p.Name]=Convert-OfflineValue $p.Value ($Depth+1)};return $out}
 if($Value -is [Array]){$out=@();foreach($v in $Value){$out+=,(Convert-OfflineValue $v ($Depth+1))};return ,$out}
 return $Value
}
function Read-OfflineJson([string]$Path){
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete));$reader=New-Object IO.StreamReader($stream,[Text.Encoding]::UTF8)
 try{return Convert-OfflineValue (ConvertFrom-Json -InputObject $reader.ReadToEnd())}finally{$reader.Dispose()}
}
function Write-OfflineJson([string]$Path,$Value){
 $temp=$Path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
 try{[IO.File]::WriteAllText($temp,(ConvertTo-Json -InputObject $Value -Depth 100 -Compress),[Text.UTF8Encoding]::new($false));if([IO.File]::Exists($Path)){[IO.File]::Replace($temp,$Path,$Path+'.bak')}else{[IO.File]::Move($temp,$Path)}}finally{if([IO.File]::Exists($temp)){[IO.File]::Delete($temp)}}
}
function Initialize-OfflineStore([string]$Folder){
 $script:OfflineFolder=$Folder;$null=New-Item -ItemType Directory -Path $Folder -Force
 $script:DatabasePath=Join-Path $Folder 'database.json';$script:AccountsPath=Join-Path $Folder 'accounts.json'
 $script:Database=if(Test-Path -LiteralPath $script:DatabasePath){Read-OfflineJson $script:DatabasePath}else{@{}}
 $script:Accounts=if(Test-Path -LiteralPath $script:AccountsPath){Read-OfflineJson $script:AccountsPath}else{@{}}
 $script:Sessions=@{};$script:LoginFailures=0;$script:LoginBlockedUntil=[DateTime]::MinValue
 foreach($node in @('items','machines','maintenanceJobs','stockMovements','repairHistory','activities','cncs','cncAlarms','cncReports','accountHistory','deviceHistory','online_users')){if(-not $script:Database.ContainsKey($node)){$script:Database[$node]=@{}}}
 foreach($machine in $script:Database.cncs.Values){$machine.connected=$false}
}
function New-OfflineAccount([string]$Email,[string]$Name,[string]$Password,[string]$Role='pending'){
 $Email=$Email.Trim().ToLowerInvariant()
 if($Email -notmatch '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' -or $Email.Length -gt 254 -or -not $Name.Trim() -or $Name.Length -gt 120 -or $Password.Length -lt 12 -or $Password.Length -gt 128 -or $Role -notin @('pending','viewer','technician','manager','admin')){throw 'INVALID_ACCOUNT'}
 foreach($a in $script:Accounts.Values){if($a.email -eq $Email){throw 'ACCOUNT_EXISTS'}}
 $id=[Guid]::NewGuid().ToString('N');$candidate=Convert-OfflineValue $script:Accounts;$candidate[$id]=@{uid=$id;email=$Email;displayName=$Name;role=$Role;passwordHash=[OfflineCrypto]::Hash($Password);disabled=$false}
 Write-OfflineJson $script:AccountsPath $candidate;$script:Accounts=$candidate;return $script:Accounts[$id]
}
function Get-OfflineProfile($Account){return @{uid=$Account.uid;email=$Account.email;displayName=$Account.displayName;role=$Account.role;emailVerified=$true;disabled=($Account.disabled -eq $true)}}
function Get-OfflineNode($Root,[string[]]$Parts){$value=$Root;foreach($part in $Parts){if($value -isnot [Collections.IDictionary] -or -not $value.Contains($part)){return $null};$value=$value[$part]};return $value}
function Set-OfflineNode($Root,[string[]]$Parts,$Value){
 if(-not $Parts.Count){throw 'INVALID_PATH'};$parent=$Root
 for($i=0;$i -lt $Parts.Count-1;$i++){if(-not $parent.Contains($Parts[$i]) -or $parent[$Parts[$i]] -isnot [Collections.IDictionary]){$parent[$Parts[$i]]=@{}};$parent=$parent[$Parts[$i]]}
 if($null -eq $Value){$parent.Remove($Parts[-1])}else{$parent[$Parts[-1]]=$Value}
}
function Get-OfflineSession($Request){
 if(-not $Request.Cookie){return $null};$match=[regex]::Match($Request.Cookie,'(?:^|;\s*)ltd_offline=([A-Za-z0-9_-]{43})(?:;|$)');if(-not $match.Success){return $null}
 $token=$match.Groups[1].Value;$session=$script:Sessions[$token]
 if(-not $session -or $session.expires -lt [DateTime]::UtcNow){$script:Sessions.Remove($token);return $null}
 $account=$script:Accounts[$session.uid];if(-not $account -or $account.disabled -or $account.role -eq 'pending'){return $null}
 return @{token=$token;csrf=$session.csrf;account=$account}
}
function Reply-Offline($Request,[int]$Status,$Value,[string]$Cookie=$null){$Request.Respond($Status,(ConvertTo-Json -InputObject $Value -Depth 100 -Compress),$Cookie)}
function Test-OfflineWrite($Account,[string[]]$Parts,$Existing,$NewValue){
 if($Account.role -notin @('admin','manager','technician')){return $false}
 if($Parts[0] -in @('users','cncReports')){return $false}
 if($Parts[0] -eq 'deviceHistory'){return $Parts.Count -eq 2 -and $null -eq $Existing -and $null -ne $NewValue -and $NewValue.uid -eq $Account.uid}
 if($Parts[0] -eq 'stockMovements'){return $Parts.Count -eq 2 -and $null -eq $Existing -and $null -ne $NewValue -and $NewValue.id -eq $Parts[1] -and $NewValue.type -in @('in','out') -and $NewValue.Contains('amount')}
 if($Parts[0] -eq 'repairHistory'){return $Parts.Count -eq 2 -and (($null -eq $Existing -and $null -ne $NewValue) -or $Account.role -eq 'admin')}
 return $true
}
function Resolve-OfflineTimes($Value){
 if($Value -is [Collections.IDictionary]){
  if($Value.Count -eq 1 -and $Value['.sv'] -eq 'timestamp'){return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
  $out=@{};foreach($k in $Value.Keys){$out[$k]=Resolve-OfflineTimes $Value[$k]};return $out
 }
 if($Value -is [Array]){$out=@();foreach($v in $Value){$out+=,(Resolve-OfflineTimes $v)};return ,$out};return $Value
}
function Invoke-OfflineRequest($Request){
 try{
  $url=[Uri]('http://localhost'+$Request.Target);$path=$url.AbsolutePath;$query=@{}
  foreach($pair in $url.Query.TrimStart('?').Split('&')){if(-not $pair){continue};$p=$pair.Split('=',2);$query[[Uri]::UnescapeDataString($p[0])]=if($p.Count -gt 1){[Uri]::UnescapeDataString($p[1])}else{''}}
  $body=if($Request.Body){Convert-OfflineValue (ConvertFrom-Json -InputObject $Request.Body)}else{$null}
  if($path -eq '/api/login' -and $Request.Method -eq 'POST'){
   if([DateTime]::UtcNow -lt $script:LoginBlockedUntil){Reply-Offline $Request 429 @{error='Chờ 60 giây rồi thử lại.'};return}
   $found=$null;foreach($a in $script:Accounts.Values){if($a.email -eq ([string]$body.email).Trim().ToLowerInvariant()){$found=$a;break}}
   $valid=$found -and ([string]$body.password).Length -le 128 -and [OfflineCrypto]::Verify([string]$body.password,$found.passwordHash)
   if(-not $valid -or $found.disabled -or $found.role -eq 'pending'){$script:LoginFailures++;if($script:LoginFailures -ge 5){$script:LoginBlockedUntil=[DateTime]::UtcNow.AddSeconds(60);$script:LoginFailures=0};Reply-Offline $Request 401 @{error='Sai tài khoản/mật khẩu, tài khoản bị khóa hoặc chưa được duyệt.'};return}
   $script:LoginFailures=0;$token=[OfflineCrypto]::Token();$csrf=[OfflineCrypto]::Token();$script:Sessions[$token]=@{uid=$found.uid;csrf=$csrf;expires=[DateTime]::UtcNow.AddHours(8)}
   Reply-Offline $Request 200 @{user=(Get-OfflineProfile $found);csrf=$csrf} ('ltd_offline='+$token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');return
  }
  if($path -eq '/api/register' -and $Request.Method -eq 'POST'){
   # Registration is administrative: local users are created inside the admin settings panel.
   Reply-Offline $Request 403 @{error='Nhờ quản trị viên tạo tài khoản nội bộ trong mục Tài khoản.'};return
  }
  $session=Get-OfflineSession $Request
  if(-not $session){Reply-Offline $Request 401 @{error='Cần đăng nhập tài khoản nội bộ.'};return}
  $account=$session.account
  if($Request.Method -ne 'GET' -and -not [OfflineCrypto]::Equal($Request.Csrf,$session.csrf)){Reply-Offline $Request 403 @{error='Phiên bảo mật không hợp lệ. Đăng nhập lại.'};return}
  if($path -eq '/api/session' -and $Request.Method -eq 'GET'){Reply-Offline $Request 200 @{user=(Get-OfflineProfile $account);csrf=$session.csrf};return}
  if($path -eq '/api/logout' -and $Request.Method -eq 'POST'){$script:Sessions.Remove($session.token);Reply-Offline $Request 200 @{ok=$true} 'ltd_offline=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';return}
  if($path -eq '/api/accounts'){
   if($account.role -ne 'admin'){Reply-Offline $Request 403 @{error='Chỉ admin quản lý tài khoản.'};return}
   if($Request.Method -eq 'GET'){$profiles=@($script:Accounts.Values|ForEach-Object {Get-OfflineProfile $_});Reply-Offline $Request 200 $profiles;return}
   if($Request.Method -eq 'POST'){
    if($body.uid){
     $target=$script:Accounts[[string]$body.uid];if(-not $target -or $body.role -notin @('pending','viewer','technician','manager','admin')){throw 'INVALID_ACCOUNT'}
     $others=@($script:Accounts.Values|Where-Object {$_.uid -ne $target.uid -and $_.role -eq 'admin' -and -not $_.disabled})
     if($target.role -eq 'admin' -and (-not $others.Count) -and ($body.role -ne 'admin' -or $body.disabled -eq $true)){throw 'LAST_ADMIN'}
     $updated=Convert-OfflineValue $target
     $updated.role=$body.role;$updated.disabled=($body.disabled -eq $true)
     if($body.password){if(([string]$body.password).Length -lt 12 -or ([string]$body.password).Length -gt 128){throw 'INVALID_PASSWORD'};$updated.passwordHash=[OfflineCrypto]::Hash([string]$body.password)}
     $candidate=Convert-OfflineValue $script:Accounts;$candidate[$target.uid]=$updated
     Write-OfflineJson $script:AccountsPath $candidate;$script:Accounts=$candidate
     foreach($token in @($script:Sessions.Keys)){if($script:Sessions[$token].uid -eq $target.uid){$script:Sessions.Remove($token)}}
    }else{$null=New-OfflineAccount ([string]$body.email) ([string]$body.displayName) ([string]$body.password) ([string]$body.role)}
    Reply-Offline $Request 200 @{ok=$true};return
   }
  }
  if($path -in @('/api/backup','/api/restore')){
   if($account.role -ne 'admin'){Reply-Offline $Request 403 @{error='Chỉ admin sao lưu/khôi phục.'};return}
   if($path -eq '/api/backup' -and $Request.Method -eq 'GET'){Reply-Offline $Request 200 @{format='LTD-CMMS-OFFLINE';version=1;createdAt=[DateTime]::UtcNow.ToString('o');data=$script:Database};return}
   if($path -eq '/api/restore' -and $Request.Method -eq 'POST'){
    $incoming=if($body.format -eq 'LTD-CMMS-OFFLINE'){$body.data}else{$body}
    if($incoming -isnot [Collections.IDictionary]){throw 'INVALID_BACKUP'}
    $next=@{};foreach($key in $script:Database.Keys){$next[$key]=$script:Database[$key]}
    $imported=0;foreach($node in @('items','machines','maintenanceJobs','stockMovements','repairHistory','activities','cncs','cncAlarms','cncReports')){if($incoming.Contains($node)){if($incoming[$node] -isnot [Collections.IDictionary] -and $null -ne $incoming[$node]){throw 'INVALID_BACKUP'};$next[$node]=if($null -eq $incoming[$node]){@{}}else{$incoming[$node]};$imported++}}
    if(-not $imported){throw 'INVALID_BACKUP'}
    $backup=Join-Path $script:OfflineFolder ('before-import-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N')+'.json');Write-OfflineJson $backup $script:Database
    foreach($machine in $next.cncs.Values){$machine.connected=$false}
    Write-OfflineJson $script:DatabasePath $next;$script:Database=$next;Reply-Offline $Request 200 @{ok=$true;importedNodes=$imported};return
   }
  }
  if($path -notmatch '^/api/database/(.+)\.json$'){Reply-Offline $Request 404 @{error='Không có đường dẫn này.'};return}
  $parts=@($Matches[1].Split('/')|ForEach-Object {[Uri]::UnescapeDataString($_)})
  foreach($part in $parts){if(-not $part -or $part -match '[./\\#$\[\]\x00-\x1f]' -or $part.Length -gt 200){throw 'INVALID_PATH'}}
  if($parts[0] -eq 'users'){
   if($Request.Method -ne 'GET' -or $parts.Count -ne 2 -or ($parts[1] -ne $account.uid -and $account.role -ne 'admin')){Reply-Offline $Request 403 @{error='Không có quyền xem hồ sơ.'};return}
   $a=$script:Accounts[$parts[1]];Reply-Offline $Request 200 $(if($a){Get-OfflineProfile $a}else{$null});return
  }
  if(-not $script:Database.Contains($parts[0])){Reply-Offline $Request 404 @{error='Nhánh dữ liệu không tồn tại.'};return}
  if($Request.Method -eq 'GET' -and $parts[0] -in @('deviceHistory','accountHistory') -and $account.role -ne 'admin' -and -not ($parts[0] -eq 'accountHistory' -and $parts.Count -ge 2 -and $parts[1] -eq $account.uid)){Reply-Offline $Request 403 @{error='Chỉ admin xem lịch sử quản trị.'};return}
  $existing=Get-OfflineNode $script:Database $parts
  if($Request.Method -eq 'GET'){
   $result=$existing
   if($query.Contains('orderBy')){
    if($query.orderBy -ne '"$key"' -or $result -isnot [Collections.IDictionary]){Reply-Offline $Request 200 $result;return}
    $start=if($query.Contains('startAt')){ConvertFrom-Json -InputObject $query.startAt}else{''};$end=if($query.Contains('endAt')){ConvertFrom-Json -InputObject $query.endAt}else{[string][char]65535}
    $result=@{};foreach($key in $existing.Keys){if([string]::CompareOrdinal($key,$start) -ge 0 -and [string]::CompareOrdinal($key,$end) -le 0){$result[$key]=$existing[$key]}}
   }
   Reply-Offline $Request 200 $result;return
  }
  if($Request.Method -notin @('PUT','PATCH','DELETE')){Reply-Offline $Request 405 @{error='Unsupported method'};return}
  $value=if($Request.Method -eq 'DELETE'){$null}else{Resolve-OfflineTimes $body}
  if($parts[0] -eq 'online_users'){
   $allowed=$parts.Count -eq 2 -and (($null -eq $value -and $existing.uid -eq $account.uid) -or ($value.uid -eq $account.uid -and ($null -eq $existing -or $existing.uid -eq $account.uid)))
  }elseif($parts[0] -eq 'accountHistory'){$allowed=$parts.Count -eq 3 -and $parts[1] -eq $account.uid -and $null -eq $existing -and $value.uid -eq $account.uid}
  else{$allowed=Test-OfflineWrite $account $parts $existing $value}
  if(-not $allowed){Reply-Offline $Request 403 @{error='Tài khoản không có quyền thay đổi dữ liệu này.'};return}
  $candidate=Convert-OfflineValue (ConvertFrom-Json -InputObject (ConvertTo-Json -InputObject $script:Database -Depth 100 -Compress))
  if($Request.Method -eq 'PATCH'){
   if($value -isnot [Collections.IDictionary]){throw 'INVALID_PATCH'}
   if($parts[0] -eq 'stockMovements'){Reply-Offline $Request 403 @{error='Không sửa phiếu đã ghi.'};return}
   foreach($key in $value.Keys){if($key -match '[./\\#$\[\]\x00-\x1f]'){throw 'INVALID_PATH'};Set-OfflineNode $candidate ($parts+@([string]$key)) $value[$key]}
  }else{Set-OfflineNode $candidate $parts $value}
  Write-OfflineJson $script:DatabasePath $candidate;$script:Database=$candidate;Reply-Offline $Request 200 $value
 }catch{Reply-Offline $Request 400 @{error=('Không hoàn tất thao tác nội bộ: '+$_.Exception.Message)}}
}
