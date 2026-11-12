# Native desktop application model. Calls the same authenticated local core in-process.
# No browser, localhost HTTP service, cloud SDK or additional CNC permissions.
function Invoke-DesktopApi([string]$Path,[string]$Method='GET',$Data=$null){
 $request=New-Object OfflineRequest;$request.Target=$Path;$request.Method=$Method;$request.Cookie=$script:DesktopCookie;$request.Csrf=$script:DesktopCsrf
 if($null -ne $Data){$request.Body=ConvertTo-Json -InputObject $Data -Depth 100 -Compress}
 Invoke-OfflineRequest $request
 $result=Convert-OfflineValue (ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($request.Result)))
 if($request.Status -ge 400){throw ([string]$result.error)}
 if($request.SetCookie){$script:DesktopCookie=$request.SetCookie.Split(';')[0]}
 if($result -is [Collections.IDictionary] -and $result.Contains('csrf')){$script:DesktopCsrf=$result.csrf;$script:DesktopUser=$result.user}
 return $result
}
function Test-DesktopEdit {return $script:DesktopUser -and $script:DesktopUser.role -in @('admin','manager','technician')}
function Get-DesktopDay {return [DateTime]::UtcNow.AddHours(7).ToString('yyyy-MM-dd')}
function Get-DesktopTime($Value){
 try{if($Value -is [long] -or $Value -is [int] -or $Value -is [double]){$date=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$Value)}else{$date=[DateTimeOffset]::Parse([string]$Value)};return $date.UtcDateTime.AddHours(7).ToString('dd/MM/yyyy HH:mm:ss')}catch{return '-'}
}
function Get-DesktopEpoch($Value){try{if($Value -is [long] -or $Value -is [int] -or $Value -is [double]){return [long]$Value};return [DateTimeOffset]::Parse([string]$Value).ToUnixTimeMilliseconds()}catch{return 0L}}
function Get-DesktopDuration($Ms){if($null -eq $Ms -or [double]$Ms -lt 0){return '-'};$seconds=[long][Math]::Floor([double]$Ms/1000);return ('{0}:{1:00}:{2:00}' -f [Math]::Floor($seconds/3600),([int][Math]::Floor($seconds/60)%60),($seconds%60))}
function Get-DesktopCncState($Machine){
 $live=$false
 try{$age=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-[DateTimeOffset]::Parse([string]$Machine.sampledAt).ToUnixTimeMilliseconds();$live=$Machine.source -eq 'focas' -and $Machine.connected -eq $true -and $age -ge -5000 -and $age -le 30000}catch{}
 if(-not $live){return @{name='Mất kết nối';color='#8191A5';live=$false}}
 if($Machine.rawStatus -isnot [Collections.IDictionary] -or -not $Machine.rawStatus.Contains('run') -or -not $Machine.rawStatus.Contains('alarm') -or -not $Machine.rawStatus.Contains('emergency')){return @{name='Chưa đọc trạng thái';color='#8191A5';live=$false}}
 if($Machine.rawStatus.alarm -ne 0 -or $Machine.rawStatus.emergency -ne 0){return @{name='ALARM';color='#BD4255';live=$true}}
 if($Machine.rawStatus.run -eq 3){return @{name='Đang chạy';color='#188565';live=$true}}
 if($Machine.rawStatus.run -eq 2){return @{name='HOLD';color='#C99127';live=$true}}
 return @{name='Dừng / chờ';color='#C99127';live=$true}
}
function Get-DesktopRecurrence($Job){
 if($Job.recurrence -in @('daily','weekly','monthly','quarterly','semiannual','yearly')){return [string]$Job.recurrence}
 switch([int]$Job.period){3{return 'quarterly'}6{return 'semiannual'}12{return 'yearly'}default{return 'monthly'}}
}
function Get-DesktopDefinitions([string]$Page){
 switch($Page){
  'inventory' {return @(@('Tên linh kiện','Name',34),@('Mã SKU','Sku',18),@('Nhóm','Category',23),@('Tồn kho','Quantity',13),@('Tồn tối thiểu','Min',15),@('Trạng thái','State',17),@('Vị trí kệ','Location',18),@('Thiết bị áp dụng','Supplier',25),@('Thông số','Specs',35))}
  'machines' {return @(@('Tên máy','Name',32),@('Model','Model',23),@('Số serial','Serial',24),@('Ngày lắp','Setup',16),@('Bảo hành','Warranty',16),@('Nhà cung cấp','Vendor',25),@('Điện thoại','Phone',20))}
  'jobs' {return @(@('Máy','Machine',27),@('Công việc','Name',36),@('Chu kỳ','Frequency',18),@('Kỳ kế tiếp','Due',18),@('Tình trạng','State',18),@('Phụ trách','Owner',24),@('Thời lượng','Estimated',20),@('Checklist','Description',48))}
  'history' {return @(@('Ngày sửa chữa','Date',20),@('Máy','Machine',28),@('Thực hiện','Staff',24),@('Mô tả lỗi','Fault',50),@('Khắc phục','Fix',55))}
  'movements' {return @(@('Thời gian','Date',25),@('Giao dịch','Type',18),@('Linh kiện','Name',32),@('SKU','Sku',19),@('Số lượng','Amount',14),@('Trước','Before',14),@('Sau','After',14),@('Người thực hiện','Actor',26),@('Ghi chú','Note',45))}
  'accounts' {return @(@('Họ và tên','Name',32),@('Tài khoản','Email',38),@('Quyền','Role',22),@('Trạng thái','State',24))}
  'alarms' {return @(@('Phát hiện','Date',25),@('Mã alarm','Code',18),@('Loại','Type',12),@('Trục','Axis',12),@('Mô tả','Description',65),@('Trạng thái','State',25),@('Kết thúc','End',25),@('Chương trình','Program',18))}
  'reports' {return @(@('Ngày','Date',18),@('Máy','Machine',28),@('RUN','Run',20),@('Dừng','Idle',20),@('HOLD','Hold',20),@('Alarm','Alarm',20),@('Part đầu','CounterStart',15),@('Part cuối','CounterEnd',15),@('Tăng bộ đếm','CounterDelta',18),@('Thời gian có dữ liệu','Observed',25))}
  default {return @(@('Nhóm','Group',24),@('Máy / linh kiện','Name',35),@('Nội dung','Description',58),@('Phụ trách / trạng thái','State',30))}
 }
}
function Get-DesktopRows([string]$Page,[string]$Term='',[string]$MachineId=''){
 $rows=@();$today=Get-DesktopDay
 switch($Page){
  'inventory' {foreach($r in $script:Database.items.Values){$rows+= [pscustomobject]@{Id=$r.id;Name=$r.name;Sku=$r.sku;Category=$r.category;Quantity=$r.quantity;Min=$r.min;State=$(if([double]$r.quantity -le 0){'Hết hàng'}elseif([double]$r.quantity -le [double]$r.min){'Cần bổ sung'}else{'Đủ tồn'});Location=$r.location;Supplier=$r.supplier;Specs=$r.specs}}}
  'machines' {foreach($r in $script:Database.machines.Values){$rows+=[pscustomobject]@{Id=$r.id;Name=$r.name;Model=$r.model;Serial=$r.serial;Setup=$r.setupDate;Warranty=$r.warranty;Vendor=$r.vendor;Phone=$r.phone}}}
  'jobs' {foreach($r in $script:Database.maintenanceJobs.Values){$labels=@{daily='Hằng ngày';weekly='Hằng tuần';monthly='Hằng tháng';quarterly='Hằng quý';semiannual='6 tháng';yearly='Hằng năm'};$rows+=[pscustomobject]@{Id=$r.id;Machine=$r.machineName;Name=$r.jobName;Frequency=$labels[(Get-DesktopRecurrence $r)];Due=$r.nextDate;State=$(if($r.nextDate -and $r.nextDate -lt $today){'Quá hạn'}elseif($r.nextDate -eq $today){'Đến hạn hôm nay'}else{'Đã lên lịch'});Owner=$r.owner;Estimated=$r.estimatedTime;Description=$r.desc}};$rows=@($rows|Sort-Object Due,Machine)}
  'history' {foreach($r in $script:Database.repairHistory.Values){$rows+=[pscustomobject]@{Id=$r.id;Date=$r.faultTime;Machine=$r.machine;Staff=$r.staff;Fault=$r.fault;Fix=$r.fix}};$rows=@($rows|Sort-Object Date -Descending)}
  'movements' {foreach($r in @($script:Database.stockMovements.Values|Sort-Object @{Expression={Get-DesktopEpoch $_.at};Descending=$true})){$rows+=[pscustomobject]@{Id=$r.id;Date=(Get-DesktopTime $r.at);Type=$(if($r.type -eq 'in'){'Nhập kho'}else{'Xuất kho'});Name=$r.itemName;Sku=$r.sku;Amount=$r.amount;Before=$r.beforeQuantity;After=$r.afterQuantity;Actor=$r.actor;Note=$r.note}}}
  'accounts' {if($script:DesktopUser.role -ne 'admin'){return @()};foreach($r in $script:Accounts.Values){$rows+=[pscustomobject]@{Id=$r.uid;Name=$r.displayName;Email=$r.email;Role=$r.role;State=$(if($r.disabled){'Đã khóa'}else{'Đang hoạt động'})}}}
  'alarms' {foreach($r in @($script:Database.cncAlarms.Values|Sort-Object @{Expression={Get-DesktopEpoch $_.timestamp};Descending=$true})){if($r.cncId -ne $MachineId){continue};$rows+=[pscustomobject]@{Id=$r.id;Date=(Get-DesktopTime $r.timestamp);Code=[string]$r.alarmCode;Type=$r.alarmType;Axis=$r.axis;Description=$r.description;State=$(if($r.resolvedAt){'Đã hết tín hiệu'}else{'Chưa ghi nhận kết thúc'});End=$(if($r.resolvedAt){Get-DesktopTime $r.resolvedAt}else{''});Program=$r.activeProgram}}}
  'reports' {foreach($id in $script:Database.cncReports.Keys){if($MachineId -and $id -ne $MachineId){continue};foreach($day in $script:Database.cncReports[$id].Keys){$sessions=$script:Database.cncReports[$id][$day];foreach($r in $sessions.Values){$rows+=[pscustomobject]@{Id=$r.sessionId;Date=$day;Machine=$(if($script:Database.cncs[$id]){$script:Database.cncs[$id].name}else{$id});Run=(Get-DesktopDuration $r.runningMs);Idle=(Get-DesktopDuration $r.idleMs);Hold=(Get-DesktopDuration $r.holdMs);Alarm=(Get-DesktopDuration $r.alarmMs);CounterStart=$r.partCountStart;CounterEnd=$r.partCountEnd;CounterDelta=$r.counterDelta;Observed=(Get-DesktopDuration $r.observedMs)}}}};$rows=@($rows|Sort-Object Date -Descending)}
  default {
   foreach($r in $script:Database.maintenanceJobs.Values){if($r.nextDate -and $r.nextDate -le $today){$rows+=[pscustomobject]@{Id=$r.id;Group='Bảo trì đến hạn';Name=$r.machineName;Description=$r.jobName;State=$r.owner}}}
   foreach($r in $script:Database.items.Values){if([double]$r.quantity -le [double]$r.min){$rows+=[pscustomobject]@{Id=$r.id;Group='Cần bổ sung kho';Name=$r.name;Description=('Tồn '+$r.quantity+' / Tối thiểu '+$r.min);State=$r.location}}}
  }
 }
 if($Term){$rows=@($rows|Where-Object {($_.PSObject.Properties.Value -join ' ').IndexOf($Term,[StringComparison]::OrdinalIgnoreCase) -ge 0})}
 return ,$rows
}
function Save-DesktopRecord([string]$Node,$Record){
 if(-not (Test-DesktopEdit)){throw 'Tài khoản chỉ có quyền xem.'}
 if(-not $Record.id){$Record.id=[Guid]::NewGuid().ToString('N')}
 $null=Invoke-DesktopApi ('/api/database/'+$Node+'/'+[Uri]::EscapeDataString($Record.id)+'.json') 'PUT' $Record
 return $Record.id
}
function Add-DesktopMovement([string]$ItemId,[string]$Type,[double]$Amount,[string]$Note){
 if(-not (Test-DesktopEdit)){throw 'Tài khoản chỉ có quyền xem.'}
 $item=$script:Database.items[$ItemId];if(-not $item -or $Type -notin @('in','out') -or $Amount -le 0 -or [double]::IsNaN($Amount) -or [double]::IsInfinity($Amount)){throw 'Số lượng hoặc linh kiện không hợp lệ.'}
 $before=[double]$item.quantity;$after=if($Type -eq 'in'){$before+$Amount}else{$before-$Amount};if($after -lt 0){throw 'Số lượng xuất vượt tồn kho.'}
 # One atomic local database replacement commits inventory + immutable movement together.
 $check=Invoke-DesktopApi '/api/session';if($check.user.role -notin @('admin','manager','technician')){throw 'Không có quyền nhập/xuất.'}
 $candidate=Convert-OfflineValue $script:Database;$candidate.items[$ItemId].quantity=$after;$id=[Guid]::NewGuid().ToString('N')
 $candidate.stockMovements[$id]=@{id=$id;itemId=$ItemId;itemName=$item.name;sku=$item.sku;type=$Type;amount=$Amount;beforeQuantity=$before;afterQuantity=$after;note=$Note;actor=$check.user.displayName;at=[DateTime]::UtcNow.ToString('o')}
 Write-OfflineJson $script:DatabasePath $candidate;$script:Database=$candidate
 return $id
}
function Complete-DesktopJob([string]$Id){
 $check=Invoke-DesktopApi '/api/session';if($check.user.role -notin @('admin','manager','technician')){throw 'Không có quyền hoàn tất bảo trì.'}
 $job=$script:Database.maintenanceJobs[$Id];if(-not $job){throw 'Không có job này.'}
 $date=[DateTime]::ParseExact([string]$job.nextDate,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture);$schedule=Get-DesktopRecurrence $job
 if(-not $schedule){$schedule='monthly'}
 $next=switch($schedule){'daily'{$date.AddDays(1)}'weekly'{$date.AddDays(7)}'quarterly'{$date.AddMonths(3)}'semiannual'{$date.AddMonths(6)}'yearly'{$date.AddYears(1)}default{$date.AddMonths(1)}}
 $candidate=Convert-OfflineValue $script:Database;$candidate.maintenanceJobs[$Id].nextDate=$next.ToString('yyyy-MM-dd');$historyId=[Guid]::NewGuid().ToString('N')
 $candidate.repairHistory[$historyId]=@{id=$historyId;machine=$job.machineName;faultTime=(Get-DesktopDay);staff=$check.user.displayName;fault=('Bảo trì định kỳ: '+$job.jobName);fix=('Đã hoàn tất: '+$job.desc)}
 Write-OfflineJson $script:DatabasePath $candidate;$script:Database=$candidate
}
