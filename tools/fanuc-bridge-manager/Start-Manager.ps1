$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Startup.Diagnostics.ps1')
$singleton=$null;$notify=$null;$timer=$null;$script:ExitManager=$false
try {
 if(-not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell.'}
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 . (Join-Path $PSScriptRoot 'Manager.Core.ps1')
 . (Join-Path $PSScriptRoot 'Manager.Transfer.ps1')
 $homeFolder=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD/CncBridgeManager/machines'
 Initialize-Manager $homeFolder $PSScriptRoot
 try{$singleton=[IO.File]::Open((Join-Path (Split-Path $homeFolder -Parent) '.manager.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'Một Manager vẫn đang chạy. Nút X chỉ ẩn cửa sổ. Để cập nhật, nhấp phải biểu tượng LTD ở khay hệ thống, chọn Thoát quản lý rồi mở lại START-MANAGER.cmd.'}
 Add-Type -Path (Join-Path $PSScriptRoot 'bridge/FanucReader.cs')
 [Windows.Forms.Application]::EnableVisualStyles()
 $script:Loading=$false;$script:SelectedId='';$script:ExpectedHash='';$script:CurrentConfig=$null
 $templates=Get-MachineTemplates
 $form=New-Object Windows.Forms.Form;$form.Text='LTD CNC Bridge Manager';$form.Size=New-Object Drawing.Size(1260,720);$form.MinimumSize=New-Object Drawing.Size(1120,680);$form.StartPosition='CenterScreen';$form.Font=New-Object Drawing.Font('Segoe UI',10);$form.BackColor=[Drawing.Color]::FromArgb(237,242,248);$form.AutoScaleMode='Dpi'
 $header=New-Object Windows.Forms.Panel;$header.Dock='Top';$header.Height=85;$header.BackColor=[Drawing.Color]::FromArgb(16,42,64);$form.Controls.Add($header)
 $brand=New-Object Windows.Forms.Label;$brand.Text='LTD  |  CNC BRIDGE MANAGER';$brand.ForeColor=[Drawing.Color]::White;$brand.Font=New-Object Drawing.Font('Segoe UI',18,[Drawing.FontStyle]::Bold);$brand.SetBounds(145,14,850,32);$header.Controls.Add($brand)
 $sub=New-Object Windows.Forms.Label;$sub.Text='Thư viện máy · Cấu hình kết nối · Build 20261110-manager-transfer';$sub.ForeColor=[Drawing.Color]::FromArgb(165,205,224);$sub.SetBounds(148,50,900,22);$header.Controls.Add($sub)
 $logo=New-Object Windows.Forms.PictureBox;$logo.SetBounds(18,15,108,55);$logo.SizeMode='Zoom';$logo.Image=[Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'logo.jpg'));$header.Controls.Add($logo)
 $bar=New-Object Windows.Forms.FlowLayoutPanel;$bar.Dock='Top';$bar.Height=88;$bar.WrapContents=$true;$bar.Padding=New-Object Windows.Forms.Padding(10,7,10,3);$bar.BackColor=[Drawing.Color]::White;$form.Controls.Add($bar);$bar.BringToFront()
 function New-ToolbarButton([string]$Text,[int]$Width=125){$b=New-Object Windows.Forms.Button;$b.Text=$Text;$b.Width=$Width;$b.Height=33;$b.FlatStyle='Flat';$b.BackColor=[Drawing.Color]::White;$b.FlatAppearance.BorderColor=[Drawing.Color]::FromArgb(193,209,224);[void]$bar.Controls.Add($b);return $b}
 $new=New-ToolbarButton '+ Thêm máy' 115;$import=New-ToolbarButton 'Nhập cấu hình cũ' 145;$export=New-ToolbarButton 'Xuất cấu hình' 115;$save=New-ToolbarButton 'Lưu cấu hình' 125;$test=New-ToolbarButton 'Kiểm tra FOCAS' 140;$run=New-ToolbarButton 'Chạy cầu nối' 130;$stop=New-ToolbarButton 'Dừng cầu nối' 130
 $transferButton=New-ToolbarButton 'Truyền trên web' 145;$remove=New-ToolbarButton 'Gỡ cấu hình' 120;$trayButton=New-ToolbarButton 'Chạy ở khay hệ thống' 175
 $run.BackColor=[Drawing.Color]::FromArgb(10,126,111);$run.ForeColor=[Drawing.Color]::White
 $status=New-Object Windows.Forms.StatusStrip;$statusLabel=New-Object Windows.Forms.ToolStripStatusLabel;$statusLabel.Spring=$true;$statusLabel.TextAlign='MiddleLeft';$statusLabel.Text='Sẵn sàng. Cấu hình lưu trên laptop; chưa kết nối CNC.';[void]$status.Items.Add($statusLabel);$form.Controls.Add($status)
 $split=New-Object Windows.Forms.SplitContainer;$split.Size=New-Object Drawing.Size(1100,600);$split.Dock='Fill';$split.SplitterDistance=245;$split.FixedPanel='Panel1';$split.Panel1.BackColor=[Drawing.Color]::FromArgb(22,44,64);$split.Panel2.Padding=New-Object Windows.Forms.Padding(12);$form.Controls.Add($split);$split.BringToFront()
 $tree=New-Object Windows.Forms.TreeView;$tree.Dock='Fill';$tree.BorderStyle='None';$tree.BackColor=$split.Panel1.BackColor;$tree.ForeColor=[Drawing.Color]::FromArgb(220,234,245);$tree.LineColor=[Drawing.Color]::FromArgb(64,93,116);$tree.FullRowSelect=$true;$tree.ShowLines=$false;$tree.HideSelection=$false;$tree.ItemHeight=31;$split.Panel1.Controls.Add($tree)
 $tabs=New-Object Windows.Forms.TabControl;$tabs.Dock='Fill';$split.Panel2.Controls.Add($tabs)
 $settings=New-Object Windows.Forms.TabPage;$settings.Text='Thiết lập máy';$settings.BackColor=[Drawing.Color]::White;$settings.AutoScroll=$true;[void]$tabs.TabPages.Add($settings)
 $libraryTab=New-Object Windows.Forms.TabPage;$libraryTab.Text='Thư viện mẫu';$libraryTab.BackColor=[Drawing.Color]::White;[void]$tabs.TabPages.Add($libraryTab)
 $connectionTab=New-Object Windows.Forms.TabPage;$connectionTab.Text='Kết nối và dữ liệu';$connectionTab.BackColor=[Drawing.Color]::White;[void]$tabs.TabPages.Add($connectionTab)
 $loginTab=New-Object Windows.Forms.TabPage;$loginTab.Text='Đăng nhập CMMS';$loginTab.BackColor=[Drawing.Color]::White;$loginTab.AutoScroll=$true;[void]$tabs.TabPages.Add($loginTab)
 $loginTitle=New-Object Windows.Forms.Label;$loginTitle.Text='ĐĂNG NHẬP VÀ KẾT NỐI';$loginTitle.SetBounds(25,23,630,32);$loginTitle.Font=New-Object Drawing.Font('Segoe UI',16,[Drawing.FontStyle]::Bold);$loginTab.Controls.Add($loginTitle)
 $loginMachine=New-Object Windows.Forms.Label;$loginMachine.Text='Chọn máy đã lưu ở danh sách bên trái.';$loginMachine.SetBounds(25,66,650,45);$loginMachine.AutoEllipsis=$true;$loginTab.Controls.Add($loginMachine)
 $emailLabel=New-Object Windows.Forms.Label;$emailLabel.Text='Email tài khoản trên website CMMS';$emailLabel.SetBounds(25,121,550,24);$loginTab.Controls.Add($emailLabel)
 $loginEmail=New-Object Windows.Forms.TextBox;$loginEmail.SetBounds(25,151,490,30);$loginEmail.AccessibleName='Email CMMS';$loginTab.Controls.Add($loginEmail)
 $passwordLabel=New-Object Windows.Forms.Label;$passwordLabel.Text='Mật khẩu';$passwordLabel.SetBounds(25,199,490,24);$loginTab.Controls.Add($passwordLabel)
 $loginPassword=New-Object Windows.Forms.TextBox;$loginPassword.UseSystemPasswordChar=$true;$loginPassword.SetBounds(25,229,490,30);$loginPassword.AccessibleName='Mật khẩu CMMS';$loginTab.Controls.Add($loginPassword)
 $loginSubmit=New-Object Windows.Forms.Button;$loginSubmit.Text='Đăng nhập và kết nối';$loginSubmit.SetBounds(25,288,280,42);$loginSubmit.BackColor=[Drawing.Color]::FromArgb(10,126,111);$loginSubmit.ForeColor=[Drawing.Color]::White;$loginSubmit.FlatStyle='Flat';$loginSubmit.Enabled=$false;$loginTab.Controls.Add($loginSubmit)
 $loginCancel=New-Object Windows.Forms.Button;$loginCancel.Text='Hủy';$loginCancel.SetBounds(320,288,120,42);$loginTab.Controls.Add($loginCancel)
 $loginHint=New-Object Windows.Forms.Label;$loginHint.Text='Mật khẩu chỉ dùng cho phiên này, không lưu. Sau khi đăng nhập, cầu nối chạy nền; có thể thu Manager xuống khay hệ thống.';$loginHint.SetBounds(25,351,650,65);$loginHint.ForeColor=[Drawing.Color]::FromArgb(64,91,113);$loginTab.Controls.Add($loginHint)
 $script:LoginMachineId=''
 $grid=New-Object Windows.Forms.TableLayoutPanel;$grid.Dock='Top';$grid.AutoSize=$true;$grid.ColumnCount=4;$grid.Padding=New-Object Windows.Forms.Padding(15);[void]$grid.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Absolute',170)));[void]$grid.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)));[void]$grid.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Absolute',170)));[void]$grid.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)));$settings.Controls.Add($grid)
 $script:FieldIndex=0
 function Add-Field([string]$Label,$Control){$row=[int][Math]::Floor($script:FieldIndex/2);$column=($script:FieldIndex%2)*2;$script:FieldIndex++;$grid.RowCount=[Math]::Max($grid.RowCount,$row+1);$l=New-Object Windows.Forms.Label;$l.Text=$Label;$l.AutoSize=$true;$l.MaximumSize=New-Object Drawing.Size(155,0);$l.ForeColor=[Drawing.Color]::FromArgb(58,82,105);$l.Margin=New-Object Windows.Forms.Padding(0,9,8,10);$Control.Dock='Fill';if($Control -is [Windows.Forms.Label] -or $Control -is [Windows.Forms.CheckBox]){$Control.MaximumSize=New-Object Drawing.Size(280,0)};$Control.Margin=New-Object Windows.Forms.Padding(0,4,16,8);$grid.Controls.Add($l,$column,$row);$grid.Controls.Add($Control,$column+1,$row)}
 function New-Text{$t=New-Object Windows.Forms.TextBox;return $t}
 function New-Choice($Values){$c=New-Object Windows.Forms.ComboBox;$c.DropDownStyle='DropDownList';$c.DropDownWidth=450;foreach($v in $Values){[void]$c.Items.Add([string]$v)};$c.SelectedIndex=0;return $c}
 $preset=New-Choice @($templates|ForEach-Object {$_.name});Add-Field 'Mẫu máy / Template' $preset
 $name=New-Text;Add-Field 'Tên máy' $name
 $id=New-Text;$id.MaxLength=64;Add-Field 'ID đồng bộ (máy đã có giữ nguyên)' $id
 $ip=New-Text;$ip.Text='192.168.1.1';Add-Field 'Địa chỉ IP CNC' $ip
 $port=New-Object Windows.Forms.NumericUpDown;$port.Minimum=1;$port.Maximum=65535;$port.Value=8193;Add-Field 'Cổng FOCAS' $port
 $interval=New-Object Windows.Forms.NumericUpDown;$interval.Minimum=3;$interval.Maximum=10;$interval.Value=5;Add-Field 'Chu kỳ đọc (giây)' $interval
 $controller=New-Choice @('Chưa xác định','FANUC 0i-MF Plus','Fanuc 0i-F','Fanuc 0i-TF','Fanuc 0i-D','Fanuc 30i','Fanuc 31i-B');$controller.DropDownStyle='DropDown';Add-Field 'Bộ điều khiển / Model' $controller
 $kinds=@('unknown','mill-3axis','mill-multiaxis','lathe','other');$kind=New-Choice @('Chưa xác định','Phay XYZ 3 trục','Phay nhiều trục','Máy tiện','Loại khác');Add-Field 'Loại máy' $kind
 $orientations=@('unknown','vertical','horizontal');$orientation=New-Choice @('Chưa xác định','Vertical · Đứng','Horizontal · Ngang');Add-Field 'Kiểu bố trí' $orientation
 $axes=New-Text;Add-Field 'Tên trục (ví dụ X,Y,Z)' $axes
 $spindles=New-Object Windows.Forms.NumericUpDown;$spindles.Minimum=0;$spindles.Maximum=8;Add-Field 'Số trục chính khai báo' $spindles
 $pathNote=New-Object Windows.Forms.Label;$pathNote.Text='Path 1 / trục chính mặc định. Khai báo nhiều trục không tự bật thu thập đa kênh.';$pathNote.AutoSize=$true;Add-Field 'Kênh thu thập' $pathNote
 $tables=@('unverified','m-a','m-b','m-c','m-ab','turning','other');$offset=New-Choice @('Chưa xác định','Phay Memory A · Giá trị chung','Phay Memory B · Geometry/Wear','Phay Memory C · H/D Geometry/Wear','A/B cũ · Cần chọn chính xác','Tiện · X/Z, mũi dao','Bảng khác');Add-Field 'Bảng offset' $offset
 $verified=New-Object Windows.Forms.CheckBox;$verified.Text='Đã đối chiếu loại máy, bảng offset và đơn vị trên CNC';$verified.AutoSize=$true;Add-Field 'Xác nhận hồ sơ đọc offset' $verified
 $hint=New-Object Windows.Forms.Label;$hint.AutoSize=$true;$hint.MaximumSize=New-Object Drawing.Size(600,0);$hint.ForeColor=[Drawing.Color]::FromArgb(70,94,119);Add-Field 'Phạm vi hỗ trợ' $hint
 $libraryFlow=New-Object Windows.Forms.FlowLayoutPanel;$libraryFlow.Dock='Fill';$libraryFlow.AutoScroll=$true;$libraryFlow.Padding=New-Object Windows.Forms.Padding(15);$libraryTab.Controls.Add($libraryFlow)
 $connectionInfo=New-Object Windows.Forms.TextBox;$connectionInfo.Multiline=$true;$connectionInfo.ReadOnly=$true;$connectionInfo.Dock='Fill';$connectionInfo.BackColor=[Drawing.Color]::FromArgb(245,248,252);$connectionInfo.BorderStyle='None';$connectionInfo.Font=New-Object Drawing.Font('Consolas',10);$connectionTab.Padding=New-Object Windows.Forms.Padding(18);$connectionTab.Controls.Add($connectionInfo)
 $folderButton=New-Object Windows.Forms.Button;$folderButton.Text='Mở thư mục dữ liệu của máy';$folderButton.Dock='Bottom';$folderButton.Height=35;$connectionTab.Controls.Add($folderButton)
 function Update-Hint{
  $supported=$kinds[$kind.SelectedIndex] -eq 'mill-3axis' -and $tables[$offset.SelectedIndex] -in @('m-a','m-b','m-c') -and (($axes.Text.ToUpperInvariant() -replace '\s','') -eq 'X,Y,Z')
  $verified.Enabled=$supported;if(-not $supported){$verified.Checked=$false}
  $axisCount=@($axes.Text.Split(',')|Where-Object {$_.Trim()}).Count
  $hint.Text=('Khai báo {0} trục / {1} trục chính. ' -f $axisCount,$spindles.Value)+$(if($supported){'Chỉ bật khi đã đối chiếu trực tiếp. Cầu nối chỉ đọc; không sửa offset CNC.'}else{'Đọc trạng thái và HD.T / NX.T nếu CNC hỗ trợ. Gốc/offset chưa xác minh sẽ để trống; hiện diễn giải phay XYZ 3 trục / Memory A, B, C đã xác nhận.'})
 }
 function Get-FormFingerprint {return (@($name.Text,$id.Text,$ip.Text,[string]$port.Value,[string]$interval.Value,$controller.Text,[string]$preset.SelectedIndex,[string]$kind.SelectedIndex,[string]$orientation.SelectedIndex,$axes.Text,[string]$spindles.Value,[string]$offset.SelectedIndex,[string]$verified.Checked)|ConvertTo-Json -Compress)}
 function Confirm-Discard {
  if($script:InitialFormState -and (Get-FormFingerprint) -cne $script:InitialFormState){return [Windows.Forms.MessageBox]::Show('Có thay đổi chưa lưu. Bỏ các thay đổi này?','Cấu hình chưa lưu','YesNo','Question') -eq 'Yes'}
  return $true
 }
 function Refresh-Tree{
  $script:Loading=$true;$tree.BeginUpdate();$tree.Nodes.Clear();$groups=@{}
  foreach($group in @('Mill / Máy phay','Lathe / Máy tiện','Other / Chưa phân loại')){$groups[$group]=$tree.Nodes.Add($group)}
  foreach($c in @(Get-ManagerMachines)){$g=if($c.machineKind -eq 'lathe'){'Lathe / Máy tiện'}elseif($c.machineKind -like 'mill-*'){'Mill / Máy phay'}else{'Other / Chưa phân loại'};$n=$groups[$g].Nodes.Add($c.machineName);$n.Tag=$c.machineId;if(Get-ManagerProcess $c.machineId){$n.ForeColor=[Drawing.Color]::FromArgb(76,228,163);$n.Text='● '+$c.machineName};if($c.machineId -eq $script:SelectedId){$tree.SelectedNode=$n}}
  $tree.ExpandAll();$tree.EndUpdate();$script:Loading=$false
 }
 function Set-Form($c,[bool]$Saved){
  $script:Loading=$true;$script:CurrentConfig=$c;$script:SelectedId=if($Saved){$c.machineId}else{''};$script:ExpectedHash=if($Saved){(Get-FileHash -LiteralPath (Get-MachineConfigPath $c.machineId) -Algorithm SHA256).Hash}else{''}
  $name.Text=[string]$c.machineName;$id.Text=[string]$c.machineId;$id.ReadOnly=$Saved;$ip.Text=[string]$c.cncIp;$port.Value=[decimal]$c.port;$interval.Value=[decimal]$c.intervalSeconds;$controller.Text=[string]$c.model
  $kind.SelectedIndex=[Math]::Max(0,[Array]::IndexOf($kinds,[string]$c.machineKind));$orientation.SelectedIndex=[Math]::Max(0,[Array]::IndexOf($orientations,[string]$c.orientation));$axes.Text=[string]$c.axisNames;$spindles.Value=[decimal]$c.spindleCount;$offset.SelectedIndex=[Math]::Max(0,[Array]::IndexOf($tables,[string]$c.offsetTable));$verified.Checked=($c.offsetProfileConfirmed -eq $true)
  $index=0;for($i=0;$i -lt $templates.Count;$i++){if($templates[$i].id -eq $c.machineTemplate){$index=$i;break}};$preset.SelectedIndex=$index
  $script:Loading=$false;Update-Hint
  $script:InitialFormState=Get-FormFingerprint
  $loginPassword.Clear();$script:LoginMachineId=if($Saved){$c.machineId}else{''};$loginMachine.Text=if($Saved){$c.machineName+'  |  '+$c.cncIp+':'+$c.port}else{'Lưu cấu hình máy trước khi đăng nhập.'}
  $running=$Saved -and ($null -ne (Get-ManagerProcess $c.machineId));$run.Enabled=$Saved -and -not $running;$stop.Enabled=$running;$save.Enabled=-not $running;$remove.Enabled=$Saved -and -not $running;$loginSubmit.Enabled=$Saved -and -not $running
  $connectionInfo.Text="Cấu hình: $($c.machineName)`r`nCNC: $($c.cncIp):$($c.port)`r`n`r`nKiểm tra FOCAS: chỉ đọc, không gửi Firebase.`r`nChạy cầu nối: nhập tài khoản trong tab Đăng nhập CMMS; sau đó chạy nền và gửi dữ liệu về web công ty.`r`nDừng cầu nối không dừng máy CNC.`r`n`r`nThư mục dữ liệu: $script:ManagerHome`r`nNút X thu nhỏ vào khay hệ thống. Laptop phải bật và không Sleep. Dừng cầu nối chỉ ngắt thu thập."
 }
 function New-Form{
  Set-Form ([pscustomobject]@{machineId='';machineName='';cncIp='192.168.1.1';port=8193;intervalSeconds=5;model='Chưa xác định';machineKind='unknown';orientation='unknown';machineTemplate='custom';axisNames='';spindleCount=0;offsetTable='unverified';offsetProfileConfirmed=$false;partsPerCount=1;partCounterVerified=$false}) $false
  $script:Loading=$true;$tree.SelectedNode=$null;$script:Loading=$false
  $tabs.SelectedTab=$libraryTab;$statusLabel.Text='Chọn mẫu máy hoặc khai báo loại khác. Chưa lưu, chưa kết nối.'
 }
 function Get-FormConfig{
  if(-not $id.Text.Trim()){$id.Text=New-MachineId $name.Text}
  $parts=if($script:CurrentConfig.partsPerCount){$script:CurrentConfig.partsPerCount}else{1}
  return ConvertTo-MachineConfig ([pscustomobject]@{machineId=$id.Text.Trim();machineName=$name.Text;cncIp=$ip.Text;port=[int]$port.Value;intervalSeconds=[int]$interval.Value;model=$controller.Text;machineKind=$kinds[$kind.SelectedIndex];orientation=$orientations[$orientation.SelectedIndex];machineTemplate=$templates[$preset.SelectedIndex].id;axisNames=$axes.Text;spindleCount=[int]$spindles.Value;offsetTable=$tables[$offset.SelectedIndex];offsetProfileConfirmed=[bool]$verified.Checked;partsPerCount=$parts;partCounterVerified=($script:CurrentConfig.partCounterVerified -eq $true)})
 }
 function Apply-Preset([int]$Index){
  $t=$templates[$Index];$script:Loading=$true;$preset.SelectedIndex=$Index;$kind.SelectedIndex=[Math]::Max(0,[Array]::IndexOf($kinds,$t.machineKind));$orientation.SelectedIndex=[Math]::Max(0,[Array]::IndexOf($orientations,$t.orientation));$axes.Text=$t.axisNames;$spindles.Value=[decimal]$t.spindleCount;$offset.SelectedIndex=0;$verified.Checked=$false;$script:Loading=$false;Update-Hint;$tabs.SelectedTab=$settings;$statusLabel.Text=$t.description
 }
 for($i=0;$i -lt $templates.Count;$i++){$b=New-Object Windows.Forms.Button;$b.Size=New-Object Drawing.Size(300,125);$b.Tag=$i;$b.Text=$templates[$i].name+"`r`n`r`n"+$templates[$i].axisNames+"   |   Trục chính: "+$templates[$i].spindleCount;$b.FlatStyle='Flat';$b.BackColor=[Drawing.Color]::FromArgb(238,246,252);$b.TextAlign='MiddleLeft';$b.Padding=New-Object Windows.Forms.Padding(12);$b.Add_Click({Apply-Preset ([int]$this.Tag)});$libraryFlow.Controls.Add($b)}
 $tree.Add_AfterSelect({if($script:Loading -or -not $this.SelectedNode.Tag){return};if(-not (Confirm-Discard)){$script:Loading=$true;$restore=$null;foreach($parent in $tree.Nodes){foreach($node in $parent.Nodes){if($node.Tag -eq $script:SelectedId){$restore=$node}}};$tree.SelectedNode=$restore;$script:Loading=$false;return};try{$path=Get-MachineConfigPath ([string]$this.SelectedNode.Tag);Set-Form (Get-Content -LiteralPath $path -Raw -Encoding UTF8|ConvertFrom-Json) $true;$tabs.SelectedTab=$settings;$statusLabel.Text='Đã chọn máy. Thay đổi áp dụng khi lưu và chạy lại cầu nối.'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)}})
 $preset.Add_SelectedIndexChanged({if(-not $script:Loading){Apply-Preset $preset.SelectedIndex}})
 foreach($control in @($kind,$orientation,$offset)){$control.Add_SelectedIndexChanged({if(-not $script:Loading){$verified.Checked=$false;Update-Hint}})}
 $spindles.Add_ValueChanged({if(-not $script:Loading){Update-Hint}})
 $axes.Add_TextChanged({if(-not $script:Loading){$verified.Checked=$false;Update-Hint}})
 $new.Add_Click({if(Confirm-Discard){New-Form}})
 $import.Add_Click({if(-not (Confirm-Discard)){return};$d=New-Object Windows.Forms.OpenFileDialog;$d.Filter='Bridge configuration (*.json)|*.json';if($d.ShowDialog() -ne 'OK'){return};try{if((Get-Item -LiteralPath $d.FileName).Length -gt 65536){throw 'File cấu hình quá lớn.'};$raw=Get-Content -LiteralPath $d.FileName -Raw -Encoding UTF8|ConvertFrom-Json;if(-not $raw.machineKind){$raw|Add-Member -NotePropertyName machineKind -NotePropertyValue 'unknown' -Force};$c=ConvertTo-MachineConfig $raw;$existing=Test-Path -LiteralPath (Get-MachineConfigPath $c.machineId);Set-Form $c $existing;Refresh-Tree;$tabs.SelectedTab=$settings;$statusLabel.Text='Đã đọc file cũ. ID được giữ nguyên. Kiểm tra thông tin rồi bấm Lưu; file gốc không thay đổi.'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Không nhập được cấu hình')}})
 $export.Add_Click({try{$c=Get-FormConfig;$d=New-Object Windows.Forms.SaveFileDialog;$d.Filter='Bridge configuration (*.json)|*.json';$d.FileName=$c.machineId+'-bridge-config.json';if($d.ShowDialog() -eq 'OK'){$c|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $d.FileName -Encoding UTF8;$statusLabel.Text='Đã xuất cấu hình. Không chứa mật khẩu hoặc token đăng nhập.'}}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)}})
 $save.Add_Click({try{if($script:ManagerTransferTarget -and $script:ManagerTransferTarget.id -eq $script:SelectedId){throw 'Dừng phiên truyền trước khi sửa cấu hình máy này.'};$c=Get-FormConfig;$saved=Save-MachineConfig $c $script:ExpectedHash;Set-Form $saved $true;Refresh-Tree;$statusLabel.Text='Đã lưu cấu hình và bản sao .bak. Không gửi dữ liệu ra ngoài.'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Không lưu được')}})
 $test.Add_Click({try{$c=Get-FormConfig;$form.UseWaitCursor=$true;$statusLabel.Text='Đang kiểm tra FOCAS chỉ đọc, có thể mất khoảng 10 giây...';$form.Refresh();$sample=[FanucReader]::Read($c.cncIp,[uint16]$c.port,(Join-Path $PSScriptRoot 'lib'));$connectionInfo.Text="KẾT NỐI FOCAS THÀNH CÔNG`r`nIP: $($sample.ip):$($sample.port)`r`nLoại CNC: $($sample.machineType)`r`nSeries / Version: $($sample.series) / $($sample.version)`r`nSố trục CNC trả về: $($sample.axes)`r`nRUN: $($sample.rawStatus.run) | ALARM: $($sample.rawStatus.alarm)`r`nPART COUNT: $($sample.partCounter)`r`n`r`nChỉ đọc. Không truy cập PMC, không ghi CNC và không gửi Firebase.";$tabs.SelectedTab=$connectionTab;$statusLabel.Text='Kiểm tra thành công. Kết nối kiểm tra đã được giải phóng.'}catch{$connectionInfo.Text=$_.Exception.GetBaseException().Message;$tabs.SelectedTab=$connectionTab;$statusLabel.Text='Kiểm tra thất bại; xem chi tiết trong tab Kết nối.'}finally{$form.UseWaitCursor=$false}})
 $run.Add_Click({try{if(-not $script:SelectedId){throw 'Bấm Lưu cấu hình trước.'};$current=Get-FormConfig;$stored=Get-Content -LiteralPath (Get-MachineConfigPath $script:SelectedId) -Raw -Encoding UTF8|ConvertFrom-Json;if(($current|ConvertTo-Json -Compress) -ne ((ConvertTo-MachineConfig $stored)|ConvertTo-Json -Compress)){throw 'Có thay đổi chưa lưu. Lưu cấu hình trước khi chạy.'};$script:LoginMachineId=$script:SelectedId;$loginMachine.Text=$stored.machineName+'  |  '+$stored.cncIp+':'+$stored.port;$loginPassword.Clear();$tabs.SelectedTab=$loginTab;$loginSubmit.Enabled=$true;if($loginEmail.Text){$loginPassword.Focus()}else{$loginEmail.Focus()};$statusLabel.Text='Nhập email và mật khẩu ngay trong tab Đăng nhập CMMS, rồi bấm Đăng nhập và kết nối.'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Chưa chạy được cầu nối')}})
 $loginSubmit.Add_Click({
  $credential=$null;$secret=$null
  try{
   if(-not $script:SelectedId -or $script:LoginMachineId -cne $script:SelectedId){throw 'Chọn máy đã lưu và bấm Chạy cầu nối trước.'}
   if(-not $loginEmail.Text.Trim() -or -not $loginPassword.Text){throw 'Nhập email và mật khẩu CMMS.'}
   $current=Get-FormConfig;$stored=Get-Content -LiteralPath (Get-MachineConfigPath $script:SelectedId) -Raw -Encoding UTF8|ConvertFrom-Json
   if(($current|ConvertTo-Json -Compress) -ne ((ConvertTo-MachineConfig $stored)|ConvertTo-Json -Compress)){throw 'Lưu cấu hình máy trước khi kết nối.'}
   $secret=ConvertTo-SecureString $loginPassword.Text -AsPlainText -Force
   $credential=New-Object Management.Automation.PSCredential($loginEmail.Text.Trim(),$secret)
   $loginPassword.Clear();$loginSubmit.Enabled=$false
   $null=Start-ManagerBridge $script:SelectedId $credential
   $statusLabel.Text='Đã chuyển tài khoản trong bộ nhớ. Đang xác thực CMMS rồi kết nối CNC.'
   $tabs.SelectedTab=$connectionTab;Refresh-Tree
  }catch{[void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'Chưa khởi động được cầu nối');$loginSubmit.Enabled=$true}
  finally{$loginPassword.Clear();if($secret){$secret.Dispose()};$credential=$null;$secret=$null}
 })
 $loginCancel.Add_Click({$loginPassword.Clear();$tabs.SelectedTab=$settings})
 $loginPassword.Add_KeyDown({param($sender,$eventArgs);if($eventArgs.KeyCode -eq 'Enter' -and $loginSubmit.Enabled){$eventArgs.SuppressKeyPress=$true;$loginSubmit.PerformClick()}})
 $stop.Add_Click({try{if(-not $script:SelectedId){return};$marker=Join-Path (Get-MachineFolder $script:SelectedId) 'stop-request';if((Test-Path -LiteralPath $marker) -and ([DateTime]::UtcNow-(Get-Item -LiteralPath $marker).LastWriteTimeUtc).TotalSeconds -ge 15){if([Windows.Forms.MessageBox]::Show('Cầu nối chưa thoát sau yêu cầu dừng. Đóng đúng tiến trình cầu nối của máy đang chọn? Chỉ đóng phần mềm trên laptop, không gửi lệnh tới CNC. Dữ liệu chưa lưu trong bộ nhớ có thể mất.','Đóng cầu nối bị kẹt','YesNo','Warning') -eq 'Yes'){Stop-StuckManagerBridge $script:SelectedId;$statusLabel.Text='Đã đóng cầu nối bị kẹt. Có thể bấm Chạy cầu nối lại.'}}elseif(Test-Path -LiteralPath $marker){$statusLabel.Text='Đang chờ cầu nối dừng. Sau 15 giây có thể đóng tiến trình nếu vẫn bị kẹt.'}else{Stop-ManagerBridge $script:SelectedId;$statusLabel.Text='Đã yêu cầu dừng cầu nối, không dừng CNC. Chờ 15 giây nếu tiến trình bị kẹt.'}}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)}})
 $folderButton.Add_Click({try{if(-not $script:SelectedId){throw 'Chọn máy đã lưu trước.'};Start-Process explorer.exe -ArgumentList ('"'+(Get-MachineFolder $script:SelectedId)+'"')}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)}})
 $remove.Add_Click({try{if(-not $script:SelectedId){return};if($script:ManagerTransferTarget -and $script:ManagerTransferTarget.id -eq $script:SelectedId){throw 'Dừng phiên truyền trước khi gỡ máy này.'};if([Windows.Forms.MessageBox]::Show('Gỡ cấu hình máy khỏi Manager? Dữ liệu và báo cáo được chuyển vào thư mục archive để giữ lại. Bản ghi trên web không bị xóa.','Gỡ cấu hình máy','YesNo','Question') -ne 'Yes'){return};$target=Remove-ManagerMachine $script:SelectedId $script:ExpectedHash;New-Form;Refresh-Tree;$statusLabel.Text='Đã gỡ cấu hình. Bản lưu: '+$target}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)}})
 $logTab=New-Object Windows.Forms.TabPage;$logTab.Text='Nhật ký cầu nối';$logTab.Padding=New-Object Windows.Forms.Padding(12);[void]$tabs.TabPages.Add($logTab)
 $log=New-Object Windows.Forms.TextBox;$log.Multiline=$true;$log.ReadOnly=$true;$log.Dock='Fill';$log.ScrollBars='Both';$log.WordWrap=$false;$log.Font=New-Object Drawing.Font('Consolas',10);$log.BackColor=[Drawing.Color]::FromArgb(17,35,51);$log.ForeColor=[Drawing.Color]::FromArgb(188,224,220);$logTab.Controls.Add($log)
 $transferTab=New-Object Windows.Forms.TabPage;$transferTab.Text='Truyền chương trình trên web';$transferTab.BackColor=[Drawing.Color]::White;$transferTab.AutoScroll=$true;[void]$tabs.TabPages.Add($transferTab)
 $transferTitle=New-Object Windows.Forms.Label;$transferTitle.Text='TRUYỀN CHƯƠNG TRÌNH VÀO BỘ NHỚ CNC';$transferTitle.Font=New-Object Drawing.Font('Segoe UI',15,[Drawing.FontStyle]::Bold);$transferTitle.SetBounds(24,22,760,35);$transferTab.Controls.Add($transferTitle)
 $transferTarget=New-Object Windows.Forms.Label;$transferTarget.SetBounds(24,66,760,45);$transferTarget.Font=New-Object Drawing.Font('Segoe UI',11,[Drawing.FontStyle]::Bold);$transferTarget.Text='Chọn máy đã lưu ở danh sách bên trái.';$transferTab.Controls.Add($transferTarget)
 $transferEnable=New-Object Windows.Forms.Button;$transferEnable.Text='Bật cho máy đang chọn';$transferEnable.SetBounds(24,120,240,38);$transferEnable.BackColor=[Drawing.Color]::FromArgb(10,126,111);$transferEnable.ForeColor=[Drawing.Color]::White;$transferEnable.FlatStyle='Flat';$transferTab.Controls.Add($transferEnable)
 $transferDisable=New-Object Windows.Forms.Button;$transferDisable.Text='Dừng phiên truyền';$transferDisable.SetBounds(280,120,180,38);$transferDisable.Enabled=$false;$transferTab.Controls.Add($transferDisable)
 $transferCodeLabel=New-Object Windows.Forms.Label;$transferCodeLabel.Text='Mã ghép phiên — dán vào mục Truyền chương trình trên web';$transferCodeLabel.SetBounds(24,185,740,27);$transferTab.Controls.Add($transferCodeLabel)
 $transferCode=New-Object Windows.Forms.TextBox;$transferCode.ReadOnly=$true;$transferCode.UseSystemPasswordChar=$true;$transferCode.Font=New-Object Drawing.Font('Consolas',11);$transferCode.SetBounds(24,218,740,30);$transferTab.Controls.Add($transferCode)
 $transferCopy=New-Object Windows.Forms.Button;$transferCopy.Text='Sao chép mã';$transferCopy.SetBounds(24,265,180,35);$transferCopy.Enabled=$false;$transferTab.Controls.Add($transferCopy)
 $transferOpen=New-Object Windows.Forms.Button;$transferOpen.Text='Mở web công ty';$transferOpen.SetBounds(220,265,180,35);$transferTab.Controls.Add($transferOpen)
 $transferInfo=New-Object Windows.Forms.TextBox;$transferInfo.Multiline=$true;$transferInfo.ReadOnly=$true;$transferInfo.ScrollBars='Vertical';$transferInfo.SetBounds(24,320,740,170);$transferInfo.BackColor=[Drawing.Color]::FromArgb(240,247,251);$transferInfo.Text="Chưa bật truyền chương trình.`r`n`r`nDùng chung bộ DLL và cấu hình máy trong Manager. Không mở START-WEB-TRANSFER riêng.`r`nMở web trên laptop này → chọn đúng máy → Truyền chương trình → dán mã ghép.`r`nTruyền vào bộ nhớ CNC cần máy dừng ở EDIT và xác nhận trên web. Không tự chạy, không ghi đè.`r`nNút X chỉ thu nhỏ; phiên truyền vẫn hoạt động ở khay hệ thống.";$transferTab.Controls.Add($transferInfo)
 function Refresh-ManagerTransferUi {
  $enabled=$null -ne $script:ManagerTransferServer;$transferDisable.Enabled=$enabled;$transferEnable.Enabled=-not $enabled -and [bool]$script:SelectedId;$transferCopy.Enabled=$enabled
  if($enabled){$target=$script:ManagerTransferTarget;$transferTarget.Text='ĐANG BẬT: '+$target.name+' | '+$target.ip+':'+$target.port;$transferCode.Text=$script:ManagerTransferServer.SessionCode;$message=if($script:ManagerTransferServer.Busy){'Đang xử lý yêu cầu với CNC. Không đóng Manager hoặc rút cáp.'}else{$script:ManagerTransferServer.LastMessage};if($transferInfo.Text -ne $message){$transferInfo.Text=$message}}
  else{$transferCode.Clear();$transferTarget.Text=if($script:SelectedId){$script:CurrentConfig.machineName+' | '+$script:CurrentConfig.cncIp+':'+$script:CurrentConfig.port}else{'Chọn máy đã lưu ở danh sách bên trái.'}}
 }
 $transferEnable.Add_Click({try{
  if((Get-FormFingerprint) -cne $script:InitialFormState){throw 'Có cấu hình chưa lưu. Lưu hoặc chọn lại máy trước khi bật truyền.'}
  $null=Start-ManagerTransfer $script:SelectedId $script:ExpectedHash;Refresh-ManagerTransferUi;$transferInfo.Text='Đã bật truyền cho máy đã chọn. Bấm Sao chép mã và dán vào mục Truyền chương trình trên web.'
 }catch{$transferInfo.Text=$_.Exception.Message+"`r`n`r`nCầu nối giám sát không bị dừng. Nếu cổng 8766 đang được dùng, đóng tiện ích truyền cũ rồi thử lại.";$statusLabel.Text='Chưa bật được truyền chương trình; xem chi tiết trong tab Truyền.'}})
 $transferDisable.Add_Click({if(Stop-ManagerTransfer){Refresh-ManagerTransferUi;$transferInfo.Text='Đã dừng phiên truyền. Mã cũ không còn hiệu lực. Cầu nối giám sát vẫn chạy.'}else{$transferInfo.Text='Có thao tác CNC đang diễn ra. Chờ hoàn tất trước khi dừng phiên.'}})
 $transferCopy.Add_Click({if($script:ManagerTransferServer){[Windows.Forms.Clipboard]::SetText($script:ManagerTransferServer.SessionCode);$transferInfo.Text='Đã sao chép mã. Trên web: mở đúng máy → Truyền chương trình → dán mã và bấm Ghép kết nối.'}})
 $transferOpen.Add_Click({Start-Process 'https://storageltd.github.io/kho-baotri/'})
 $transferButton.Add_Click({$tabs.SelectedTab=$transferTab;Refresh-ManagerTransferUi})
 $notify=New-Object Windows.Forms.NotifyIcon;$notify.Icon=[Drawing.SystemIcons]::Application;$form.Icon=$notify.Icon;$notify.Text='LTD CNC Bridge Manager';$notify.Visible=$true
 $trayMenu=New-Object Windows.Forms.ContextMenuStrip
 $restore=New-Object Windows.Forms.ToolStripMenuItem('Mở LTD Bridge Manager');$restore.Add_Click({$form.Show();$form.WindowState='Normal';$form.Activate()});[void]$trayMenu.Items.Add($restore)
 $exit=New-Object Windows.Forms.ToolStripMenuItem('Thoát quản lý · Dừng tiện ích truyền');$exit.Add_Click({if(Confirm-Discard){$script:ExitManager=$true;$form.Close()}});[void]$trayMenu.Items.Add($exit)
 $notify.ContextMenuStrip=$trayMenu;$notify.Add_DoubleClick({$form.Show();$form.WindowState='Normal';$form.Activate()})
 $trayButton.Add_Click({$loginPassword.Clear();$form.Hide();$notify.ShowBalloonTip(2500,'LTD CNC','Cầu nối tiếp tục chạy. Nhấp biểu tượng ở khay hệ thống để mở lại.','Info')})
 $timer=New-Object Windows.Forms.Timer;$timer.Interval=3000;$timer.Add_Tick({
  Refresh-ManagerTransferUi
  if($script:SelectedId){
   $running=$null -ne (Get-ManagerProcess $script:SelectedId);$run.Enabled=-not $running;$stop.Enabled=$running;$save.Enabled=-not $running;$remove.Enabled=-not $running;$loginSubmit.Enabled=-not $running
   $marker=Join-Path (Get-MachineFolder $script:SelectedId) 'stop-request';$stop.Text=if($running -and (Test-Path -LiteralPath $marker) -and ([DateTime]::UtcNow-(Get-Item -LiteralPath $marker).LastWriteTimeUtc).TotalSeconds -ge 15){'Đóng tiến trình'}else{'Dừng cầu nối'}
   $beat=Get-ManagerHeartbeat $script:SelectedId
   $statusLabel.Text=if(-not $running){if($tabs.SelectedTab -eq $loginTab){'Nhập email và mật khẩu, rồi bấm Đăng nhập và kết nối.'}elseif($beat.phase -eq 'failed'){'Cầu nối dừng vì lỗi · Mở Nhật ký cầu nối xem nguyên nhân.'}else{'Cầu nối máy đang chọn đã dừng.'}}elseif(-not $beat){'Đang khởi động cầu nối. Nếu chưa có hộp đăng nhập, xem Nhật ký cầu nối.'}elseif($beat.phase -and $beat.phase -ne 'active'){$phases=@{'starting'='Đang khởi động cầu nối nền';'receiving-account'='Đang nhận tài khoản từ Manager';'login'='Chờ tài khoản CMMS';'loading-reader'='Đã nhập tài khoản · Đang nạp bộ đọc';'authenticating'='Đang xác thực tài khoản CMMS';'checking-account'='Đang kiểm tra quyền và bản ghi máy';'reading-cnc'='Đã đăng nhập · Đang đọc dữ liệu CNC';'retrying-cnc'='Đã đăng nhập · Đang thử kết nối lại CNC';'failed'='Cầu nối lỗi · Xem Nhật ký cầu nối';'stopped'='Cầu nối đã dừng'};$text=$phases[[string]$beat.phase];if($text){$text}else{'Đang khởi động cầu nối'}}else{$age=([DateTime]::UtcNow-[DateTime]::Parse($beat.at).ToUniversalTime()).TotalSeconds;if($age -gt 30){'Tiến trình đang chạy · Chưa có dữ liệu mới hơn 30 giây. Xem Nhật ký.'}elseif($beat.uploaded){'ĐANG GỬI DỮ LIỆU | '+$script:SelectedId+' | RUN '+$beat.run+' | ALARM '+$beat.alarm+' | '+$beat.program}else{'Đọc CNC được nhưng chưa gửi web thành công. Xem Nhật ký.'}}
   if($tabs.SelectedTab -eq $logTab){$logPaths=Get-ManagerLogPaths $script:SelectedId;$logPath=$logPaths.session;if(Test-Path -LiteralPath $logPath){$content=(Get-Content -LiteralPath $logPath -Tail 120 -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`r`n";if($log.Text -ne $content){$log.Text=$content;$log.SelectionStart=$log.TextLength;$log.ScrollToCaret()}}else{$log.Text='Chưa có nhật ký thu thập. Trạng thái: '+$statusLabel.Text};$bootstrap=$logPaths.startup;if(Test-Path -LiteralPath $bootstrap){$startup=(Get-Content -LiteralPath $bootstrap -Tail 30 -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`r`n";if($startup){$log.Text+="`r`n`r`nLỖI KHỞI ĐỘNG:`r`n"+$startup}}}
  }else{$run.Enabled=$false;$stop.Enabled=$false;$save.Enabled=$true;$remove.Enabled=$false;$loginSubmit.Enabled=$false}
 });$timer.Start()
 $form.Add_FormClosing({param($sender,$eventArgs);if($script:ExitManager -and -not (Stop-ManagerTransfer)){$eventArgs.Cancel=$true;$script:ExitManager=$false;$form.Show();$tabs.SelectedTab=$transferTab;$transferInfo.Text='Đang có thao tác CNC. Chờ hoàn tất trước khi thoát Manager.';return};if(-not $script:ExitManager){$eventArgs.Cancel=$true;$loginPassword.Clear();$form.Hide();$notify.ShowBalloonTip(2000,'LTD CNC','Đã thu nhỏ vào khay hệ thống. Cầu nối tiếp tục chạy.','Info')}})
 Refresh-Tree;New-Form
 [Windows.Forms.Application]::Run($form)
}catch{Show-ManagerStartupFailure $_}
finally{if($script:ManagerTransferServer){[void](Stop-ManagerTransfer)};if($timer){$timer.Stop();$timer.Dispose()};if($notify){$notify.Visible=$false;$notify.Dispose()};if($singleton){$singleton.Dispose()}}
