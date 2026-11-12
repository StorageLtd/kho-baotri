[CmdletBinding()]
param([string]$DataRoot='',[switch]$NoCollectors)
$ErrorActionPreference='Stop'
$lock=$null;$timer=$null
try {
 if([IntPtr]::Size -ne 8){throw 'Cần Windows 64-bit.'}
 Add-Type -AssemblyName PresentationFramework;Add-Type -AssemblyName PresentationCore;Add-Type -AssemblyName WindowsBase
 Add-Type -Path (Join-Path $PSScriptRoot 'Desktop.Primitives.cs')
 foreach($file in @('Offline.Core.ps1','Collectors.ps1','Desktop.Core.ps1','Desktop.Export.ps1','Desktop.Views.ps1','Desktop.Cnc.ps1')){. (Join-Path $PSScriptRoot $file)}
 if(-not $DataRoot){$DataRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD\CmmsOffline'}
 $null=New-Item -ItemType Directory -Path $DataRoot -Force
 try{$lock=[IO.File]::Open((Join-Path $DataRoot '.server.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'Bản offline cũ hoặc Desktop đang chạy. Đóng hẳn bản đó trước; không xóa thư mục dữ liệu.'}
 Initialize-OfflineStore $DataRoot;Initialize-OfflineCollectors
 $script:DesktopCookie='';$script:DesktopCsrf='';$script:DesktopUser=$null;$script:DesktopPage='overview';$script:DesktopDetails=@{};$script:DesktopLastCollect=[DateTime]::MinValue;$script:DesktopLastRefresh=[DateTime]::MinValue
 [xml]$xaml=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Desktop.xaml'));$reader=New-Object Xml.XmlNodeReader $xaml;$script:DesktopWindow=[Windows.Markup.XamlReader]::Load($reader);$script:DesktopWindow.Title='LTD CMMS Desktop · 20261112-native';$script:DesktopWindow.Width=[Math]::Min(1440,[Windows.SystemParameters]::WorkArea.Width-40);$script:DesktopWindow.Height=[Math]::Min(900,[Windows.SystemParameters]::WorkArea.Height-40);$script:DesktopWindow.MinWidth=[Math]::Min(1180,[Windows.SystemParameters]::WorkArea.Width-40);$script:DesktopWindow.MinHeight=[Math]::Min(700,[Windows.SystemParameters]::WorkArea.Height-40)
 $script:DesktopUi=@{}
 foreach($node in $xaml.GetElementsByTagName('*')){$name=$node.GetAttribute('Name','http://schemas.microsoft.com/winfx/2006/xaml');if($name){$script:DesktopUi[$name]=$script:DesktopWindow.FindName($name)}}
 $script:DesktopUi.Logo.Source=New-Object Windows.Media.Imaging.BitmapImage([Uri](Join-Path $PSScriptRoot 'logo.jpg'))
 function Set-DesktopLogin {
  $script:DesktopUser=$null;$script:DesktopUi.Shell.Visibility='Collapsed';$script:DesktopUi.LoginOverlay.Visibility='Visible';$script:DesktopUi.LoginPassword.Clear();$script:DesktopUi.LoginConfirm.Clear()
  foreach($child in @($script:DesktopWindow.OwnedWindows)){$child.Close()}
  if(-not $script:Accounts.Count){$script:DesktopUi.LoginTitle.Text='Tạo quản trị viên';$script:DesktopUi.LoginHint.Text='Tài khoản riêng trên máy tính này. Tự đặt mật khẩu 12–128 ký tự; không dùng mật khẩu Gmail.';$script:DesktopUi.ConfirmLabel.Visibility='Visible';$script:DesktopUi.LoginConfirm.Visibility='Visible';$script:DesktopUi.LoginSubmit.Content='Tạo tài khoản và bắt đầu'}else{$script:DesktopUi.LoginTitle.Text='Đăng nhập nội bộ';$script:DesktopUi.LoginHint.Text='Dữ liệu lưu trên máy tính này.';$script:DesktopUi.ConfirmLabel.Visibility='Collapsed';$script:DesktopUi.LoginConfirm.Visibility='Collapsed';$script:DesktopUi.LoginSubmit.Content='Đăng nhập'}
 }
 function Invoke-DesktopLogin {
  $script:DesktopUi.LoginError.Text='';$script:DesktopUi.LoginSubmit.IsEnabled=$false
  try{
   $email=$script:DesktopUi.LoginEmail.Text;$password=$script:DesktopUi.LoginPassword.Password
   if(-not $script:Accounts.Count){if($password -cne $script:DesktopUi.LoginConfirm.Password){throw 'Hai ô mật khẩu chưa giống nhau.'};$null=New-OfflineAccount -Email $email -Name 'Quản trị viên nội bộ' -Password $password -Role 'admin'}
   $null=Invoke-DesktopApi '/api/login' 'POST' @{email=$email;password=$password}
   $script:DesktopUi.LoginPassword.Clear();$script:DesktopUi.LoginConfirm.Clear();$script:DesktopUi.LoginOverlay.Visibility='Collapsed';$script:DesktopUi.Shell.Visibility='Visible';Refresh-DesktopView
  }catch{$script:DesktopUi.LoginError.Text=$_.Exception.Message}finally{$script:DesktopUi.LoginSubmit.IsEnabled=$true}
 }
 function Switch-DesktopPage([string]$Page){$script:DesktopPage=$Page;$script:DesktopUi.Search.Text='';Refresh-DesktopView}
 function Refresh-DesktopView {
  if(-not $script:DesktopUser){return}
  $probe=New-Object OfflineRequest;$probe.Cookie=$script:DesktopCookie;$session=Get-OfflineSession $probe
  if(-not $session){Set-DesktopLogin;return};$script:DesktopUser=Get-OfflineProfile $session.account
  $page=$script:DesktopPage;if($page -eq 'accounts' -and $script:DesktopUser.role -ne 'admin'){$page='overview';$script:DesktopPage=$page}
  $titles=@{overview='Tổng quan';inventory='Kho linh kiện';machines='Danh sách máy';jobs='Kế hoạch bảo trì';history='Lịch sử sửa chữa';cnc='Giám sát CNC';movements='Lịch sử nhập / xuất';accounts='Tài khoản nội bộ'}
  $subtitles=@{overview='Công việc đến hạn và tình trạng vật tư';inventory='Tồn kho · linh kiện · hình ảnh · nhập / xuất';machines='Hồ sơ thiết bị trong nhà máy';jobs='Lịch định kỳ · người phụ trách · công việc';history='Nhật ký sửa chữa và khắc phục sự cố';cnc='Dữ liệu FOCAS trực tiếp · Chỉ đọc';movements='Phiếu giao dịch được lưu độc lập';accounts='Tài khoản riêng trên máy tính này'}
  $ui=$script:DesktopUi;$ui.PageTitle.Text=$titles[$page];$ui.PageSubtitle.Text=$subtitles[$page];$ui.Identity.Text=$script:DesktopUser.displayName+' · '+$script:DesktopUser.role.ToUpperInvariant()
  $can=Test-DesktopEdit;$admin=$script:DesktopUser.role -eq 'admin'
  $ui.Metric1.Text=[string]$script:Database.items.Count;$ui.Metric2.Text=[string]$script:Database.machines.Count
  $today=Get-DesktopDay;$ui.Metric3.Text=[string]@($script:Database.maintenanceJobs.Values|Where-Object {$_.nextDate -and $_.nextDate -le $today}).Count
  $connected=@($script:Database.cncs.Values|Where-Object {(Get-DesktopCncState $_).live}).Count;$ui.Metric4.Text=([string]$connected+' / '+$script:Database.cncs.Count)
  $ui.Backup.Visibility=$(if($admin){'Visible'}else{'Collapsed'});$ui.Restore.Visibility=$ui.Backup.Visibility;$ui.NavAccounts.Visibility=$ui.Backup.Visibility
  foreach($nav in @('NavOverview','NavInventory','NavMachines','NavJobs','NavHistory','NavCnc','NavMovements','NavAccounts')){$ui[$nav].Background=$(if($ui[$nav].Tag -eq $page){'#264762'}else{'Transparent'})}
  foreach($key in @('Add','Edit','Delete','Stock','Complete','Details')){$ui[$key].Visibility='Collapsed';$ui[$key].IsEnabled=$can}
  if($page -in @('inventory','machines','jobs','cnc','accounts','history')){$ui.Add.Visibility='Visible';$ui.Add.IsEnabled=$can -and ($page -notin @('accounts','history') -or $admin)}
  if($page -in @('inventory','machines','jobs','accounts','history')){$ui.Edit.Visibility='Visible';$ui.Edit.IsEnabled=$can -and ($page -notin @('accounts','history') -or $admin)}
  if($page -in @('inventory','machines','jobs','history')){$ui.Delete.Visibility='Visible';$ui.Delete.IsEnabled=$can -and ($page -ne 'history' -or $admin)}
  if($page -eq 'inventory'){$ui.Stock.Visibility='Visible'};if($page -eq 'jobs'){$ui.Complete.Visibility='Visible'}
  if($page -eq 'cnc'){$ui.CncScroll.Visibility='Visible';$ui.Records.Visibility='Collapsed';$ui.Export.Content='Báo cáo vận hành';Render-DesktopCncTiles}
  else{
   $ui.CncScroll.Visibility='Collapsed';$ui.Records.Visibility='Visible';$ui.Export.Content='Xuất Excel';$ui.Details.Visibility='Visible';$ui.Details.IsEnabled=$true
   $selected=if($ui.Records.SelectedItem){$ui.Records.SelectedItem.Id}else{''}
   $definitions=Get-DesktopDefinitions $page
   $newRows=Get-DesktopRows $page $ui.Search.Text;$signature=ConvertTo-Json -InputObject $newRows -Depth 6 -Compress
   if($ui.Records.Tag -ne $page -or $script:DesktopRowsSignature -cne $signature){
    if($ui.Records.Tag -ne $page){Set-DesktopColumns $ui.Records $definitions;$ui.Records.Tag=$page}
    $script:DesktopRows=$newRows;$ui.Records.ItemsSource=[object[]]$script:DesktopRows;$script:DesktopRowsSignature=$signature
    if($selected){$ui.Records.SelectedItem=@($script:DesktopRows|Where-Object Id -eq $selected)|Select-Object -First 1}
   }
   $ui.Notice.Text=([string]$script:DesktopRows.Count+' bản ghi · Nhấp đúp để xem chi tiết')
  }
  $ui.Clock.Text=[DateTime]::Now.ToString('dd/MM/yyyy HH:mm:ss');$ui.SideStatus.Text=$connected.ToString()+' CNC có tín hiệu · Không Internet'
  foreach($id in @($script:DesktopDetails.Keys)){Update-DesktopCncDetails $id}
 }
 function Invoke-DesktopAction([string]$Action){
  try{
   $page=$script:DesktopPage;$selected=$script:DesktopUi.Records.SelectedItem;$id=if($selected){[string]$selected.Id}else{''}
   switch($Action){
    'Add'{Show-DesktopEditor $page}
    'Edit'{if($id){Show-DesktopEditor $page $id}}
    'Stock'{if($id){Show-DesktopEditor 'movement' $id}}
    'Complete'{if($id -and [Windows.MessageBox]::Show($script:DesktopWindow,'Xác nhận đã hoàn tất kỳ bảo trì này?','LTD','YesNo') -eq 'Yes'){Complete-DesktopJob $id;Refresh-DesktopView}}
    'Delete'{if($id -and [Windows.MessageBox]::Show($script:DesktopWindow,'Xóa bản ghi này? Xóa máy quản lý cũng xóa các job liên quan.','LTD','YesNo') -eq 'Yes'){
      $node=@{inventory='items';machines='machines';jobs='maintenanceJobs';history='repairHistory'}[$page]
      if($page -eq 'machines'){
       $check=Invoke-DesktopApi '/api/session';if($check.user.role -notin @('admin','manager','technician')){throw 'Không có quyền xóa.'}
       $candidate=Convert-OfflineValue $script:Database;$candidate.machines.Remove($id);foreach($jobId in @($candidate.maintenanceJobs.Keys)){if($candidate.maintenanceJobs[$jobId].machineId -eq $id){$candidate.maintenanceJobs.Remove($jobId)}};Write-OfflineJson $script:DatabasePath $candidate;$script:Database=$candidate
      }else{$null=Invoke-DesktopApi ('/api/database/'+$node+'/'+$id+'.json') 'DELETE'}
      Refresh-DesktopView
     }}
    'Details'{if($selected){Show-DesktopRecordDetails $page $selected}}
    'Export'{if($page -eq 'cnc'){Show-DesktopTable 'Báo cáo vận hành CNC · Theo ngày và phiên' (Get-DesktopDefinitions 'reports') (Get-DesktopRows 'reports')}else{Export-DesktopTable $script:DesktopUi.PageTitle.Text (Get-DesktopDefinitions $page) $script:DesktopRows}}
    'Refresh'{Refresh-DesktopView}
   }
  }catch{Show-DesktopMessage $_.Exception.Message}
 }
 foreach($key in @('NavOverview','NavInventory','NavMachines','NavJobs','NavHistory','NavCnc','NavMovements','NavAccounts')){$script:DesktopUi[$key].Add_Click({param($sender,$eventArgs);Switch-DesktopPage ([string]$sender.Tag)})}
 foreach($key in @('Add','Edit','Delete','Stock','Complete','Details','Export','Refresh')){$script:DesktopUi[$key].Tag=$key;$script:DesktopUi[$key].Add_Click({param($sender,$eventArgs);Invoke-DesktopAction ([string]$sender.Tag)})}
 $script:DesktopUi.LoginSubmit.Add_Click({Invoke-DesktopLogin});$script:DesktopUi.Search.Add_TextChanged({Refresh-DesktopView});$script:DesktopUi.Records.Add_MouseDoubleClick({Invoke-DesktopAction 'Details'})
 $script:DesktopUi.Logout.Add_Click({try{$null=Invoke-DesktopApi '/api/logout' 'POST' @{}}catch{};Set-DesktopLogin})
 $script:DesktopUi.Backup.Add_Click({try{$dialog=New-Object Microsoft.Win32.SaveFileDialog;$dialog.Filter='Sao lưu JSON|*.json';$dialog.FileName='LTD-Desktop-Backup-'+(Get-DesktopDay)+'.json';if($dialog.ShowDialog()){$backup=Invoke-DesktopApi '/api/backup';[IO.File]::WriteAllText($dialog.FileName,(ConvertTo-Json -InputObject $backup -Depth 100),[Text.UTF8Encoding]::new($false));Show-DesktopMessage 'Đã sao lưu dữ liệu nghiệp vụ.'}}catch{Show-DesktopMessage $_.Exception.Message}})
 $script:DesktopUi.Restore.Add_Click({try{$dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Filter='Dữ liệu JSON|*.json';if($dialog.ShowDialog()){
   if((Get-Item -LiteralPath $dialog.FileName).Length -gt 33554432){throw 'File nhập tối đa 32 MiB.'}
   if([Windows.MessageBox]::Show($script:DesktopWindow,'Nhập thay các mục dữ liệu có trong file? Bản trước được sao lưu tự động; tài khoản giữ nguyên.','LTD','YesNo') -eq 'Yes'){$data=Read-OfflineJson $dialog.FileName;$null=Invoke-DesktopApi '/api/restore' 'POST' $data;Refresh-DesktopView}
  }}catch{Show-DesktopMessage $_.Exception.Message}})
 $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromSeconds(1)
 $timer.Add_Tick({
  if(-not $NoCollectors -and ([DateTime]::UtcNow-$script:DesktopLastCollect).TotalSeconds -ge 3){$script:DesktopLastCollect=[DateTime]::UtcNow;try{Sync-OfflineCollectors}catch{$script:DesktopUi.Notice.Text='Chưa lưu được dữ liệu thu thập. Kiểm tra ổ đĩa và cấu hình máy.'}}
  if(([DateTime]::UtcNow-$script:DesktopLastRefresh).TotalSeconds -ge 3){$script:DesktopLastRefresh=[DateTime]::UtcNow;try{Refresh-DesktopView}catch{$script:DesktopUi.Notice.Text='Không làm mới được giao diện: '+$_.Exception.Message}}
 })
 $script:DesktopWindow.Add_Closing({param($sender,$eventArgs);if([Windows.MessageBox]::Show($sender,'Thoát phần mềm và ngừng thu thập dữ liệu? Không dừng máy CNC.','LTD','YesNo') -ne 'Yes'){$eventArgs.Cancel=$true}})
 Set-DesktopLogin;$timer.Start();[void]$script:DesktopWindow.ShowDialog()
}catch{try{[void][Windows.MessageBox]::Show($_.Exception.Message,'LTD Desktop - Lỗi khởi động')}catch{Write-Host $_.Exception.Message};exit 1}
finally{if($timer){$timer.Stop()};try{Close-OfflineCollectors}catch{};if($lock){$lock.Dispose()}}
