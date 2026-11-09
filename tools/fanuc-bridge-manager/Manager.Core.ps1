# Configuration operations only. No native CNC calls and no cloud writes in this module.
. (Join-Path $PSScriptRoot 'bridge/Bridge.State.ps1')
$script:ManagerHome=$null;$script:ManagerPackage=$null;$script:ManagerBase=$null
function Initialize-Manager([string]$DataHome,[string]$PackageRoot){
 $script:ManagerHome=[IO.Path]::GetFullPath($DataHome);$script:ManagerPackage=[IO.Path]::GetFullPath($PackageRoot)
 $null=New-Item -ItemType Directory -Path $script:ManagerHome -Force
 $script:ManagerBase=Get-Content -LiteralPath (Join-Path $script:ManagerPackage 'bridge/bridge-config.json') -Raw -Encoding UTF8|ConvertFrom-Json
}
function Get-MachineTemplates {return @(Get-Content -LiteralPath (Join-Path $script:ManagerPackage 'templates.json') -Raw -Encoding UTF8|ConvertFrom-Json)}
function Assert-MachineId([string]$Id){if($Id -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}$'){throw 'ID máy chỉ gồm chữ thường, số và dấu -, tối đa 64 ký tự.'}}
function Get-MachineFolder([string]$Id){Assert-MachineId $Id;return Join-Path $script:ManagerHome $Id}
function Get-MachineConfigPath([string]$Id){return Join-Path (Get-MachineFolder $Id) 'bridge-config.json'}
function New-MachineId([string]$Name){
 $text=$Name.Normalize([Text.NormalizationForm]::FormD);$sb=New-Object Text.StringBuilder
 foreach($c in $text.ToCharArray()){if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark){[void]$sb.Append($c)}}
 $slug=($sb.ToString().ToLowerInvariant().Replace('đ','d') -replace '[^a-z0-9]+','-').Trim('-')
 if(-not $slug){$slug='cnc'};if($slug.Length -gt 48){$slug=$slug.Substring(0,48).TrimEnd('-')}
 if(Test-Path -LiteralPath (Get-MachineConfigPath $slug)){$slug+='-'+[Guid]::NewGuid().ToString('N').Substring(0,6)}
 return $slug
}
function ConvertTo-MachineConfig($InputConfig){
 $id=[string]$InputConfig.machineId;Assert-MachineId $id
 $name=([string]$InputConfig.machineName).Trim();if(-not $name -or $name.Length -gt 80 -or $name -match '[\x00-\x1f]'){throw 'Nhập tên máy từ 1 đến 80 ký tự.'}
 $ip=$null;$ipText=([string]$InputConfig.cncIp).Trim()
 if(-not [Net.IPAddress]::TryParse($ipText,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Nhập địa chỉ IPv4 của CNC.'}
 $a=$ip.GetAddressBytes();if($a[0] -eq 0 -or $a[0] -eq 127 -or $a[0] -ge 224){throw 'Địa chỉ CNC phải là IPv4 unicast trong mạng LAN/VPN.'}
 $port=[int]$InputConfig.port;$interval=[int]$InputConfig.intervalSeconds
 if($port -lt 1 -or $port -gt 65535){throw 'Cổng FOCAS phải từ 1 đến 65535.'}
 if($interval -lt 3 -or $interval -gt 10){throw 'Chu kỳ đọc phải từ 3 đến 10 giây.'}
 $kind=[string]$InputConfig.machineKind;if($kind -notin @('unknown','mill-3axis','mill-multiaxis','lathe','other')){$kind='unknown'}
 $orientation=[string]$InputConfig.orientation;if($orientation -notin @('unknown','vertical','horizontal')){$orientation='unknown'}
 $table=[string]$InputConfig.offsetTable;if($table -notin @('unverified','m-a','m-b','m-c','m-ab','turning','other')){$table='unverified'}
 $axes=(([string]$InputConfig.axisNames).ToUpperInvariant() -replace '\s','');$names=@($axes.Split(',')|Where-Object {$_})
 if($names.Count -gt 32 -or @($names|Where-Object {$_ -notmatch '^[A-Z][0-9]?$'}).Count -or @($names|Select-Object -Unique).Count -ne $names.Count){throw 'Tên trục phải khác nhau, dạng X,Y,Z hoặc X,Z,C; tối đa 32 trục.'}
 $spindles=[int]$InputConfig.spindleCount;if($spindles -lt 0 -or $spindles -gt 8){throw 'Số trục chính khai báo phải từ 0 đến 8.'}
 $confirmed=($InputConfig.offsetProfileConfirmed -is [bool] -and $InputConfig.offsetProfileConfirmed)
 if($confirmed -and ($kind -ne 'mill-3axis' -or $axes -ne 'X,Y,Z' -or $table -notin @('m-a','m-b','m-c'))){throw 'Chỉ hồ sơ phay XYZ 3 trục / Memory A, B hoặc C đã đối chiếu được bật diễn giải offset.'}
 foreach($key in @('databaseUrl','firebaseApiKey')){if($InputConfig.$key -and $InputConfig.$key -cne $script:ManagerBase.$key){throw 'Cấu hình nhập thuộc dự án Firebase khác. Không thay đổi máy chủ trong giao diện này.'}}
 $model=([string]$InputConfig.model).Trim();if(-not $model){$model='Chưa xác định'};if($model.Length -gt 80 -or $model -match '[\x00-\x1f]'){throw 'Tên bộ điều khiển quá dài.'}
 $templateId=if(@((Get-MachineTemplates)|Where-Object id -eq ([string]$InputConfig.machineTemplate)).Count){[string]$InputConfig.machineTemplate}else{'custom'}
 $parts=if($InputConfig.partsPerCount){[int]$InputConfig.partsPerCount}else{1};if($parts -lt 1 -or $parts -gt 1000){throw 'Sản phẩm mỗi lần đếm phải từ 1 đến 1000.'}
 return [pscustomobject][ordered]@{machineId=$id;machineName=$name;cncIp=$ip.ToString();port=$port;intervalSeconds=$interval;model=$model;firebaseApiKey=$script:ManagerBase.firebaseApiKey;databaseUrl=$script:ManagerBase.databaseUrl;partCounterVerified=($InputConfig.partCounterVerified -is [bool] -and $InputConfig.partCounterVerified);partsPerCount=$parts;machineKind=$kind;orientation=$orientation;machineTemplate=$templateId;axisNames=$axes;declaredAxisCount=$names.Count;spindleCount=$spindles;pathNumber=1;offsetTable=$table;offsetProfileConfirmed=$confirmed;machiningContextProfile=if($confirmed){'verified-fanuc-m-3axis-memory-'+$table.Substring(2)}else{'unverified'};configurationSource='bridge-manager'}
}
function Get-ManagerMachines {
 $list=@();foreach($folder in @(Get-ChildItem -LiteralPath $script:ManagerHome -Directory)){
  if($folder.Name -cnotmatch '^[a-z0-9][a-z0-9-]{0,63}$'){continue};$path=Join-Path $folder.FullName 'bridge-config.json'
  if(Test-Path -LiteralPath $path){try{$c=Get-Content -LiteralPath $path -Raw -Encoding UTF8|ConvertFrom-Json;if($c.machineId -eq $folder.Name){$list+=,$c}}catch{}}
 };return @($list|Sort-Object machineName)
}
function Get-ManagerProcess([string]$Id){
 $path=Join-Path (Get-MachineFolder $Id) 'runtime.json';if(-not (Test-Path -LiteralPath $path)){return $null}
 try{$r=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json;$p=Get-Process -Id ([int]$r.pid) -ErrorAction Stop;if($p.StartTime.ToUniversalTime().Ticks -eq [long]$r.startedTicks -and $p.ProcessName -in @('powershell','pwsh')){return $p}}catch{}
 return $null
}
function Save-MachineConfig($InputConfig,[string]$ExpectedHash=''){
 $config=ConvertTo-MachineConfig $InputConfig;$path=Get-MachineConfigPath $config.machineId
 if(Get-ManagerProcess $config.machineId){throw 'Cầu nối máy đang chạy. Dừng cầu nối trước khi sửa cấu hình.'}
 if(Test-Path -LiteralPath $path){$hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;if(-not $ExpectedHash -or $hash -cne $ExpectedHash){throw 'Cấu hình đã thay đổi hoặc ID đã tồn tại. Chọn lại máy trước khi lưu.'}}
 foreach($other in @(Get-ManagerMachines)){if($other.machineId -ne $config.machineId -and $other.cncIp -eq $config.cncIp -and [int]$other.port -eq $config.port){throw 'IP và cổng này đã được khai báo cho một máy khác.'}}
 $folder=Get-MachineFolder $config.machineId;$null=New-Item -ItemType Directory -Path $folder -Force
 if(Test-Path -LiteralPath $path){Copy-Item -LiteralPath $path -Destination ($path+'.bak') -Force}
 $temporary=$path+'.tmp';$config|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $temporary -Encoding UTF8
 Move-Item -LiteralPath $temporary -Destination $path -Force;return $config
}
function New-ManagerLaunchInfo([string]$Shell,[string]$Arguments){
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=$Shell;$info.Arguments=$Arguments;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true
 return $info
}
function Send-ManagerCredential([IO.TextWriter]$Writer,[Management.Automation.PSCredential]$Credential,[string]$MachineId){
 Assert-MachineId $MachineId
 if(-not $Credential -or -not $Credential.UserName.Trim() -or $Credential.UserName.Length -gt 254){throw 'Nhập email CMMS hợp lệ.'}
 $pointer=[IntPtr]::Zero;$plain=$null;$json=$null;$encoded=$null
 try{
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Credential.Password)
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if(-not $plain -or $plain.Length -gt 2048){throw 'Mật khẩu phải từ 1 đến 2048 ký tự.'}
  $json=@{version=1;machineId=$MachineId;email=$Credential.UserName.Trim();password=$plain}|ConvertTo-Json -Compress
  # Base64 is transport framing for Unicode, NOT encryption. The channel is a private inherited stdin pipe.
  $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $Writer.WriteLine($encoded);$Writer.Flush()
 }finally{if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)};$plain=$null;$json=$null;$encoded=$null}
}
function Start-ManagerBridge([string]$Id,[Management.Automation.PSCredential]$Credential){
 if(-not $Credential){throw 'Nhập tài khoản ở tab Đăng nhập CMMS trước.'}
 if(Get-ManagerProcess $Id){throw 'Cầu nối máy này đã chạy.'};$path=Get-MachineConfigPath $Id;if(-not (Test-Path -LiteralPath $path)){throw 'Lưu cấu hình trước khi chạy.'}
 foreach($name in @('Fwlib64.dll','fwlibe64.dll','fwlib30i64.dll')){if(-not (Test-Path -LiteralPath (Join-Path $script:ManagerPackage ('lib/'+$name)))){throw "Thiếu lib\$name. Chép 3 DLL chung vào lib trước."}}
 $folder=Get-MachineFolder $Id;$stop=Join-Path $folder 'stop-request';Remove-Item -LiteralPath $stop -Force -ErrorAction SilentlyContinue
 $sessionId=[Guid]::NewGuid().ToString('N')
 [void](Write-BridgeStateFile (Join-Path $folder 'bridge-state.json') @{at=[DateTime]::UtcNow.ToString('o');phase='starting';uploaded=$false;sessionId=$sessionId})
 $shell=Join-Path ([Environment]::SystemDirectory) 'WindowsPowerShell/v1.0/powershell.exe'
 $bridge=Join-Path $script:ManagerPackage 'bridge/Start-FanucBridge.ps1';$lib=Join-Path $script:ManagerPackage 'lib'
 foreach($value in @($bridge,$path,$lib,$folder,$stop)){if($value.Contains('"')){throw 'Đường dẫn không hợp lệ.'}}
 # Only local paths/flags are in process arguments. Credentials never go to argv, files or environment.
 $arguments='-NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy RemoteSigned -File "'+$bridge+'" -ConfigPath "'+$path+'" -LibraryDirectory "'+$lib+'" -DataDirectory "'+$folder+'" -StopRequestPath "'+$stop+'" -CredentialFromStdin -SessionId '+$sessionId
 $process=New-Object Diagnostics.Process;$process.StartInfo=New-ManagerLaunchInfo $shell $arguments
 if(-not $process.Start()){throw 'Không khởi động được tiến trình cầu nối.'}
 $ticks=$process.StartTime.ToUniversalTime().Ticks
 try{if(-not (Write-BridgeStateFile (Join-Path $folder 'runtime.json') @{pid=$process.Id;startedTicks=$ticks;sessionId=$sessionId})){throw 'Không lưu được thông tin tiến trình cầu nối.'};Send-ManagerCredential $process.StandardInput $Credential $Id}finally{$process.StandardInput.Close()}
 return $process
}
function Stop-ManagerBridge([string]$Id){
 if(-not (Get-ManagerProcess $Id)){return};[IO.File]::WriteAllText((Join-Path (Get-MachineFolder $Id) 'stop-request'),'stop bridge only')
}

function Remove-ManagerMachine([string]$Id,[string]$ExpectedHash){
 $path=Get-MachineConfigPath $Id
 if(Get-ManagerProcess $Id){throw 'Dừng cầu nối trước khi gỡ cấu hình máy.'}
 if(-not (Test-Path -LiteralPath $path)){throw 'Cấu hình không còn tồn tại.'}
 if(-not $ExpectedHash -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $ExpectedHash){throw 'Cấu hình đã thay đổi. Chọn lại máy trước khi gỡ.'}
 $archive=Join-Path (Split-Path $script:ManagerHome -Parent) 'archive';$null=New-Item -ItemType Directory -Path $archive -Force
 $target=Join-Path $archive ($Id+'-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,6))
 Move-Item -LiteralPath (Get-MachineFolder $Id) -Destination $target
 return $target
}
function Get-ManagerLogPaths([string]$Id){
 $folder=Get-MachineFolder $Id;$runtime=Read-BridgeStateFile (Join-Path $folder 'runtime.json')
 $suffix=if($runtime.sessionId -cmatch '^[a-f0-9]{32}$'){'-'+$runtime.sessionId}else{''}
 return @{session=Join-Path $folder ('bridge-session'+$suffix+'.log');startup=Join-Path $folder ('bridge-startup-error'+$suffix+'.log')}
}
function Get-ManagerHeartbeat([string]$Id){
 $folder=Get-MachineFolder $Id;$state=Read-BridgeStateFile (Join-Path $folder 'bridge-state.json')
 $runtime=Read-BridgeStateFile (Join-Path $folder 'runtime.json')
 if($runtime.sessionId -and $state.sessionId -cne $runtime.sessionId){return $null}
 return $state
}

function Stop-StuckManagerBridge([string]$Id){
 # Explicit UI-confirmed fallback. Close only the exact recorded local bridge process; never send a CNC command.
 $process=Get-ManagerProcess $Id;if(-not $process){return}
 $marker=Join-Path (Get-MachineFolder $Id) 'stop-request'
 if(-not (Test-Path -LiteralPath $marker) -or ([DateTime]::UtcNow-(Get-Item -LiteralPath $marker).LastWriteTimeUtc).TotalSeconds -lt 15){throw 'Yêu cầu Dừng cầu nối trước, chờ ít nhất 15 giây.'}
 $identity=Get-ManagerProcess $Id;if(-not $identity -or $identity.Id -ne $process.Id -or $identity.StartTime.ToUniversalTime().Ticks -ne $process.StartTime.ToUniversalTime().Ticks){throw 'Tiến trình đã thay đổi. Chọn lại máy.'}
 Stop-Process -Id $identity.Id -ErrorAction Stop
}
