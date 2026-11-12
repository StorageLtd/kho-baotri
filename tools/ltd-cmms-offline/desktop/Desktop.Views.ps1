function New-DesktopWindow([string]$Title,[int]$Width=820,[int]$Height=700){
 $w=New-Object Windows.Window;$w.Title=$Title;$w.Width=$Width;$w.Height=$Height;$w.MaxHeight=[Windows.SystemParameters]::WorkArea.Height-40;$w.WindowStartupLocation='CenterOwner';$w.Owner=$script:DesktopWindow;$w.FontFamily='Segoe UI';$w.FontSize=13;$w.Background='#F3F6FA';$w.Resources.MergedDictionaries.Add($script:DesktopWindow.Resources);return $w
}
function Show-DesktopMessage([string]$Text){[void][Windows.MessageBox]::Show($script:DesktopWindow,$Text,'LTD CMMS Desktop','OK','Information')}
function Set-DesktopColumns($Grid,$Definitions){
 $Grid.Columns.Clear()
 foreach($definition in $Definitions){$column=New-Object Windows.Controls.DataGridTextColumn;$column.Header=$definition[0];$column.Binding=New-Object Windows.Data.Binding($definition[1]);$column.Width=New-Object Windows.Controls.DataGridLength(([double]$definition[2]*6));$column.MinWidth=70;$Grid.Columns.Add($column)}
}
function Get-DesktopFields([string]$Page){
 switch($Page){
  'inventory'{return @(@('name','Tên linh kiện','text',$true),@('sku','Mã SKU','text',$true),@('category','Nhóm linh kiện','text',$true),@('supplier','Thiết bị áp dụng','text',$false),@('quantity','Tồn kho','number',$true),@('min','Tồn tối thiểu','number',$true),@('location','Vị trí kệ','text',$false),@('specs','Thông số kỹ thuật','text',$false),@('note','Ghi chú','memo',$false),@('image','Hình ảnh','image',$false))}
  'machines'{return @(@('name','Tên máy','text',$true),@('model','Model','text',$false),@('serial','Số serial','text',$false),@('setupDate','Ngày lắp','date',$false),@('warranty','Hạn bảo hành','date',$false),@('vendor','Nhà cung cấp','text',$false),@('phone','Điện thoại','text',$false))}
  'jobs'{return @(@('machineId','Máy bảo trì','machine',$true),@('jobName','Tên công việc','text',$true),@('recurrence','Chu kỳ','frequency',$true),@('nextDate','Kỳ kế tiếp','date',$true),@('owner','Người phụ trách','text',$true),@('estimatedTime','Thời lượng dự kiến','text',$false),@('desc','Công việc / checklist','memo',$false))}
  'history'{return @(@('machine','Tên máy','text',$true),@('faultTime','Ngày sửa chữa','date',$true),@('staff','Người thực hiện','text',$true),@('fault','Mô tả lỗi','memo',$true),@('fix','Phương án xử lý','memo',$true))}
  'cnc'{return @(@('name','Tên máy CNC','text',$true),@('ip','Địa chỉ IP CNC','text',$true),@('port','Cổng FOCAS','number',$true),@('model','Bộ điều khiển / model','text',$true),@('machineKind','Loại máy','kind',$true),@('orientation','Bố trí','orientation',$true),@('offsetTable','Kiểu bảng offset','offset',$true),@('offsetProfileConfirmed','Đã đối chiếu loại máy, bảng offset và đơn vị','check',$false))}
  'accounts'{return @(@('displayName','Họ và tên','text',$true),@('email','Tài khoản dạng email','text',$true),@('role','Quyền truy cập','role',$true),@('disabled','Khóa tài khoản','check',$false),@('password','Mật khẩu mới (12–128 ký tự)','password',$false))}
  'movement'{return @(@('type','Loại giao dịch','movement',$true),@('amount','Số lượng','number',$true),@('note','Lý do / ghi chú','memo',$false))}
 }
}
function Get-DesktopChoices([string]$Kind){
 switch($Kind){
  'machine'{return ,@($script:Database.machines.Values|ForEach-Object {,@([string]$_.id,[string]$_.name)})}
  'frequency'{return ,@(@('daily','Hằng ngày'),@('weekly','Hằng tuần'),@('monthly','Hằng tháng'),@('quarterly','Hằng quý'),@('semiannual','6 tháng'),@('yearly','Hằng năm'))}
  'kind'{return ,@(@('unknown','Chưa xác nhận'),@('mill-3axis','Máy phay XYZ 3 trục'),@('lathe','Máy tiện'),@('mill','Máy phay khác'),@('other','Loại khác'))}
  'orientation'{return ,@(@('vertical','Vertical / Đứng'),@('horizontal','Horizontal / Ngang'))}
  'offset'{return ,@(@('unverified','Chưa xác nhận'),@('m-a','Mill Memory A'),@('m-b','Mill Memory B'),@('m-c','Mill Memory C'))}
  'role'{return ,@(@('viewer','Chỉ xem'),@('technician','Kỹ thuật viên'),@('manager','Quản lý'),@('admin','Quản trị viên'),@('pending','Chờ duyệt'))}
  'movement'{return ,@(@('in','Nhập kho'),@('out','Xuất kho'))}
 }
}
function Show-DesktopEditor([string]$Page,[string]$Id=''){
 if(-not (Test-DesktopEdit)){Show-DesktopMessage 'Tài khoản chỉ có quyền xem.';return}
 if($Page -in @('accounts','history') -and $script:DesktopUser.role -ne 'admin'){Show-DesktopMessage 'Chức năng này dành cho admin.';return}
 if($Page -eq 'jobs' -and -not $script:Database.machines.Count){Show-DesktopMessage 'Thêm máy trong Danh sách máy trước khi tạo job.';return}
 $nodes=@{inventory='items';machines='machines';jobs='maintenanceJobs';history='repairHistory';cnc='cncs'};$node=$nodes[$Page]
 $record=if($Page -eq 'accounts' -and $Id){Convert-OfflineValue $script:Accounts[$Id]}elseif($node -and $Id){Convert-OfflineValue $script:Database[$node][$Id]}else{@{}}
 if(-not $record){$record=@{}};if($Page -eq 'cnc' -and -not $Id){$record=@{port=8193;machineKind='unknown';offsetTable='unverified';orientation='vertical';model='FANUC';source='pending';connected=$false}}
 if($Page -eq 'jobs' -and -not $Id){$record=@{recurrence='monthly';nextDate=(Get-DesktopDay)}}
 if($Page -eq 'jobs'){$record.recurrence=Get-DesktopRecurrence $record}
 if($Page -eq 'accounts' -and -not $Id){$record=@{role='viewer';disabled=$false}}
 if($Page -eq 'movement'){$record=@{type='in';amount=1;note=''}}
 $window=New-DesktopWindow $(if($Id){'LTD · Chỉnh sửa / nghiệp vụ'}else{'LTD · Thêm mới'})
 $dock=New-Object Windows.Controls.DockPanel;$dock.Margin='22';$window.Content=$dock
 $footer=New-Object Windows.Controls.StackPanel;$footer.Orientation='Horizontal';$footer.HorizontalAlignment='Right';$footer.Margin='0,14,0,0';[Windows.Controls.DockPanel]::SetDock($footer,'Bottom');$dock.Children.Add($footer)|Out-Null
 $cancel=New-Object Windows.Controls.Button;$cancel.Content='Hủy';$cancel.Add_Click({param($sender,$eventArgs);[Windows.Window]::GetWindow($sender).Close()});$footer.Children.Add($cancel)|Out-Null
 $save=New-Object Windows.Controls.Button;$save.Content='Lưu thông tin';$save.SetResourceReference([Windows.Controls.Control]::StyleProperty,'Primary');$footer.Children.Add($save)|Out-Null
 $scroll=New-Object Windows.Controls.ScrollViewer;$scroll.VerticalScrollBarVisibility='Auto';$dock.Children.Add($scroll)|Out-Null
 $grid=New-Object Windows.Controls.Grid;$scroll.Content=$grid;for($i=0;$i -lt 2;$i++){$col=New-Object Windows.Controls.ColumnDefinition;$col.Width='*';$grid.ColumnDefinitions.Add($col)}
 $state=@{window=$window;page=$Page;id=$Id;node=$node;record=$record;fields=@{};saved=$false};$definitions=Get-DesktopFields $Page;$index=0
 foreach($definition in $definitions){
  $key=$definition[0];$label=$definition[1];$kind=$definition[2];$row=[Math]::Floor($index/2);$column=$index%2
  if($column -eq 0){$grid.RowDefinitions.Add((New-Object Windows.Controls.RowDefinition))}
  $panel=New-Object Windows.Controls.StackPanel;$panel.Margin='8,8,12,12';[Windows.Controls.Grid]::SetRow($panel,[int]$row);[Windows.Controls.Grid]::SetColumn($panel,$column);$grid.Children.Add($panel)|Out-Null
  $text=New-Object Windows.Controls.TextBlock;$text.Text=$label+$(if($definition[3]){' *'}else{''});$text.Foreground='#516B82';$text.Margin='0,0,0,8';$text.TextWrapping='Wrap';$panel.Children.Add($text)|Out-Null
  if($kind -eq 'image'){
   $image=New-Object Windows.Controls.TextBlock;$image.Text=$(if($record.image){'Đã có ảnh được lưu'}else{'Chưa có ảnh'});$panel.Children.Add($image)|Out-Null
   $pick=New-Object Windows.Controls.Button;$pick.Content='Chọn ảnh PNG / JPG';$pick.Tag=@{state=$state;label=$image};$pick.Add_Click({param($sender,$eventArgs);$dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Filter='Hình ảnh|*.png;*.jpg;*.jpeg;*.bmp';if($dialog.ShowDialog()){$bytes=[IO.File]::ReadAllBytes($dialog.FileName);if($bytes.Length -gt 2097152){Show-DesktopMessage 'Ảnh tối đa 2 MiB.';return};$mime=if([IO.Path]::GetExtension($dialog.FileName) -match 'png'){'image/png'}elseif([IO.Path]::GetExtension($dialog.FileName) -match 'bmp'){'image/bmp'}else{'image/jpeg'};$sender.Tag.state.record.image='data:'+$mime+';base64,'+[Convert]::ToBase64String($bytes);$sender.Tag.label.Text='Đã chọn: '+[IO.Path]::GetFileName($dialog.FileName)}});$panel.Children.Add($pick)|Out-Null
   $remove=New-Object Windows.Controls.Button;$remove.Content='Xóa ảnh';$remove.Tag=@{state=$state;label=$image};$remove.Add_Click({param($sender,$eventArgs);$sender.Tag.state.record.image='';$sender.Tag.label.Text='Ảnh sẽ được xóa khi lưu'});$panel.Children.Add($remove)|Out-Null;$index++;continue
  }
  if($kind -eq 'check'){$control=New-Object Windows.Controls.CheckBox;$control.Content='Xác nhận';$control.IsChecked=$record[$key] -is [bool] -and $record[$key] -eq $true;if($Page -eq 'accounts' -and -not $Id){$control.IsEnabled=$false}}
  elseif($kind -eq 'password'){$control=New-Object Windows.Controls.PasswordBox;$control.Padding='10';$control.MaxLength=128}
  elseif($kind -eq 'date'){$control=New-Object Windows.Controls.DatePicker;if($record[$key]){try{$control.SelectedDate=[DateTime]::ParseExact([string]$record[$key],'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)}catch{}}}
  elseif($kind -in @('machine','frequency','kind','orientation','offset','role','movement')){
   $control=New-Object Windows.Controls.ComboBox;$control.DisplayMemberPath='Label';$control.SelectedValuePath='Value';$control.Padding='8'
   $choices=Get-DesktopChoices $kind;foreach($choice in $choices){$control.Items.Add([pscustomobject]@{Value=$choice[0];Label=$choice[1]})|Out-Null};$control.SelectedValue=[string]$record[$key];if($control.SelectedIndex -lt 0 -and $control.Items.Count){$control.SelectedIndex=0}
  }else{$control=New-Object Windows.Controls.TextBox;$control.Text=[string]$record[$key];if($kind -eq 'memo'){$control.AcceptsReturn=$true;$control.TextWrapping='Wrap';$control.Height=120;$control.VerticalScrollBarVisibility='Auto'}else{$control.MinHeight=36};if($Page -eq 'accounts' -and $Id -and $key -in @('email','displayName')){$control.IsReadOnly=$true}}
  $panel.Children.Add($control)|Out-Null;$state.fields[$key]=@{control=$control;kind=$kind;required=$definition[3];label=$label};$index++
 }
 $save.Tag=$state;$save.Add_Click({param($sender,$eventArgs);Save-DesktopEditor $sender.Tag})
 [void]$window.ShowDialog();if($state.saved){Refresh-DesktopView}
}
function Save-DesktopEditor($State){
 try{
  $record=Convert-OfflineValue $State.record
  foreach($key in $State.fields.Keys){$field=$State.fields[$key];$control=$field.control;$value=switch($field.kind){
   'check'{[bool]$control.IsChecked}
   'password'{$control.Password}
   'date'{if($control.SelectedDate){([DateTime]$control.SelectedDate).ToString('yyyy-MM-dd')}else{''}}
   {$_ -in @('machine','frequency','kind','orientation','offset','role','movement')} {[string]$control.SelectedValue}
   default{$control.Text.Trim()}
  }
  if($field.required -and [string]::IsNullOrWhiteSpace([string]$value)){throw ('Chưa nhập '+$field.label)}
  if($field.kind -eq 'number'){$number=0.0;if(-not [double]::TryParse([string]$value,[ref]$number) -or $number -lt 0 -or [double]::IsNaN($number) -or [double]::IsInfinity($number)){throw ('Giá trị không hợp lệ: '+$field.label)};$value=$number}
  $record[$key]=$value
  }
  if($State.page -eq 'accounts'){
   if(-not $State.id -and ([string]$record.password).Length -lt 12){throw 'Mật khẩu cần ít nhất 12 ký tự.'}
   $payload=@{email=$record.email;displayName=$record.displayName;role=$record.role;password=$record.password;disabled=$record.disabled};if($State.id){$payload.uid=$State.id};$null=Invoke-DesktopApi '/api/accounts' 'POST' $payload
  }elseif($State.page -eq 'movement'){$null=Add-DesktopMovement $State.id $record.type $record.amount $record.note}
  else{
   if($State.page -eq 'jobs'){$record.machineName=$script:Database.machines[$record.machineId].name;$record.period=switch($record.recurrence){'quarterly'{3}'semiannual'{6}'yearly'{12}default{1}};if(-not $record.createdBy){$record.createdBy=$script:DesktopUser.displayName}}
   if($State.page -eq 'cnc'){$ip=$null;if($record.ip -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)' -or -not [Net.IPAddress]::TryParse($record.ip,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $record.port -lt 1 -or $record.port -gt 65535 -or $record.port -ne [int]$record.port){throw 'IP IPv4 hoặc cổng CNC không hợp lệ.'};$record.port=[int]$record.port}
   $null=Save-DesktopRecord $State.node $record
  }
  $State.saved=$true;$State.window.Close()
 }catch{Show-DesktopMessage $_.Exception.Message}
}
function Show-DesktopTable([string]$Title,$Definitions,$Rows){
 $window=New-DesktopWindow $Title 1120 660;$dock=New-Object Windows.Controls.DockPanel;$dock.Margin='20';$window.Content=$dock
 $footer=New-Object Windows.Controls.StackPanel;$footer.Orientation='Horizontal';$footer.HorizontalAlignment='Right';$footer.Margin='0,14,0,0';[Windows.Controls.DockPanel]::SetDock($footer,'Bottom');$dock.Children.Add($footer)|Out-Null
 $export=New-Object Windows.Controls.Button;$export.Content='Xuất Excel';$export.Tag=@{title=$Title;definitions=$Definitions;rows=$Rows};$export.Add_Click({param($sender,$eventArgs);Export-DesktopTable $sender.Tag.title $sender.Tag.definitions $sender.Tag.rows});$footer.Children.Add($export)|Out-Null
 $close=New-Object Windows.Controls.Button;$close.Content='Đóng';$close.Add_Click({param($sender,$eventArgs);[Windows.Window]::GetWindow($sender).Close()});$footer.Children.Add($close)|Out-Null
 $grid=New-Object Windows.Controls.DataGrid;Set-DesktopColumns $grid $Definitions;$grid.ItemsSource=[object[]]$Rows;$dock.Children.Add($grid)|Out-Null
 [void]$window.ShowDialog()
}
function Export-DesktopTable([string]$Title,$Definitions,$Rows){
 try{$dialog=New-Object Microsoft.Win32.SaveFileDialog;$dialog.Filter='Excel Workbook|*.xlsx';$dialog.FileName='LTD-'+($Title -replace '[\\/:*?"<>|]','-')+'-'+(Get-DesktopDay)+'.xlsx';if($dialog.ShowDialog()){
  Write-DesktopWorkbook $dialog.FileName $Title $Definitions $Rows (Join-Path $PSScriptRoot 'logo.jpg') $script:DesktopUser.displayName
  Show-DesktopMessage 'Đã xuất Excel có logo LTD và bảng dữ liệu.'
 }}catch{Show-DesktopMessage ('Không xuất được: '+$_.Exception.Message)}
}

function Show-DesktopRecordDetails([string]$Page,$Selected){
 $window=New-DesktopWindow 'LTD · Chi tiết bản ghi' 860 680;$grid=New-Object Windows.Controls.Grid;$grid.Margin='24';$window.Content=$grid
 $grid.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition));$grid.ColumnDefinitions.Add((New-Object Windows.Controls.ColumnDefinition));$grid.ColumnDefinitions[0].Width='240';$grid.ColumnDefinitions[1].Width='*'
 $image=New-Object Windows.Controls.Image;$image.MaxHeight=300;$image.Margin='0,0,20,0';$image.VerticalAlignment='Top';$grid.Children.Add($image)|Out-Null
 $text=New-Object Windows.Controls.TextBox;$text.IsReadOnly=$true;$text.AcceptsReturn=$true;$text.TextWrapping='Wrap';$text.VerticalScrollBarVisibility='Auto';[Windows.Controls.Grid]::SetColumn($text,1);$grid.Children.Add($text)|Out-Null
 $text.Text=((Get-DesktopDefinitions $Page)|ForEach-Object {$key=$_[1];$_[0]+': '+$Selected.$key}) -join "`r`n`r`n"
 if($Page -eq 'inventory'){
  $r=$script:Database.items[$Selected.Id];$text.Text+="`r`n`r`nGhi chú: "+$r.note
  if($r.image -match '^data:image/(?:png|jpeg|jpg|bmp);base64,(.+)$'){
   try{$bytes=[Convert]::FromBase64String($Matches[1]);$stream=New-Object IO.MemoryStream(,$bytes);$bitmap=New-Object Windows.Media.Imaging.BitmapImage;$bitmap.BeginInit();$bitmap.CacheOption=[Windows.Media.Imaging.BitmapCacheOption]::OnLoad;$bitmap.StreamSource=$stream;$bitmap.EndInit();$bitmap.Freeze();$stream.Dispose();$image.Source=$bitmap}catch{}
  }
 }
 if(-not $image.Source){$grid.ColumnDefinitions[0].Width='0'}
 [void]$window.ShowDialog()
}
