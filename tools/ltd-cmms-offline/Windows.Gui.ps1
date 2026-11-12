function Initialize-OfflineAdminGui {
  Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
  $setup=New-Object Windows.Forms.Form;$setup.Text='LTD Offline - Tạo quản trị viên nội bộ';$setup.Size=New-Object Drawing.Size(510,330);$setup.StartPosition='CenterScreen';$setup.FormBorderStyle='FixedDialog';$setup.MaximizeBox=$false
  $label=New-Object Windows.Forms.Label;$label.Text='Tài khoản chỉ dùng trên máy tính này. Không phải Firebase/Gmail.';$label.SetBounds(20,20,455,45);$setup.Controls.Add($label)
  $email=New-Object Windows.Forms.TextBox;$email.Text='admin@ltd.local';$email.SetBounds(20,75,455,30);$setup.Controls.Add($email)
  $hint=New-Object Windows.Forms.Label;$hint.Text='Mật khẩu mới (ít nhất 12 ký tự):';$hint.SetBounds(20,115,455,25);$setup.Controls.Add($hint)
  $password=New-Object Windows.Forms.TextBox;$password.UseSystemPasswordChar=$true;$password.SetBounds(20,145,455,30);$setup.Controls.Add($password)
  $submit=New-Object Windows.Forms.Button;$submit.Text='Tạo tài khoản';$submit.SetBounds(300,205,175,40);$setup.Controls.Add($submit);$setup.AcceptButton=$submit
  $submit.Add_Click(({try{$null=New-OfflineAccount $email.Text 'Quản trị viên nội bộ' $password.Text 'admin';$password.Clear();$setup.DialogResult='OK';$setup.Close()}catch{[void][Windows.Forms.MessageBox]::Show('Email không hợp lệ hoặc mật khẩu chưa đủ 12 ký tự.')}}).GetNewClosure())
  if($setup.ShowDialog() -ne 'OK'){throw 'Setup cancelled'};$setup.Dispose()
}
function Show-OfflineManager([string]$url,[string]$DataRoot) {
  Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
  $form=New-Object Windows.Forms.Form;$form.Text='LTD CMMS OFFLINE · 20261112';$form.Size=New-Object Drawing.Size(640,280);$form.StartPosition='CenterScreen'
  $status=New-Object Windows.Forms.Label;$status.Text="Đang phục vụ: $url`r`nDữ liệu: $DataRoot`r`nChỉ máy tính này · Không Internet / Firebase · CNC chỉ đọc";$status.SetBounds(20,20,585,110);$form.Controls.Add($status)
  $open=New-Object Windows.Forms.Button;$open.Text='Mở phần mềm';$open.SetBounds(20,150,175,40);$open.Add_Click(({Start-Process $url}).GetNewClosure());$form.Controls.Add($open)
  $hide=New-Object Windows.Forms.Button;$hide.Text='Thu nhỏ vào khay';$hide.SetBounds(205,150,180,40);$hide.Add_Click(({$form.Hide()}).GetNewClosure());$form.Controls.Add($hide)
  $exit=New-Object Windows.Forms.Button;$exit.Text='Dừng và thoát';$exit.SetBounds(395,150,180,40);$form.Controls.Add($exit)
  $tray=New-Object Windows.Forms.NotifyIcon;$tray.Icon=[Drawing.SystemIcons]::Application;$tray.Text='LTD CMMS Offline';$tray.Visible=$true;$tray.Add_DoubleClick(({$form.Show();$form.Activate()}).GetNewClosure())
  $menu=New-Object Windows.Forms.ContextMenuStrip;$showItem=$menu.Items.Add('Mở quản lý');$showItem.Add_Click(({$form.Show();$form.Activate()}).GetNewClosure());$exitItem=$menu.Items.Add('Dừng và thoát');$tray.ContextMenuStrip=$menu
  $form.Tag=$false;$stop={if([Windows.Forms.MessageBox]::Show('Dừng phần mềm và thu thập dữ liệu? Không dừng máy CNC.','LTD Offline','YesNo') -eq 'Yes'){$form.Tag=$true;$form.Close()}}
  $stop=$stop.GetNewClosure();$exit.Add_Click($stop);$exitItem.Add_Click($stop)
  $form.Add_FormClosing({param($sender,$eventArgs);if(-not $sender.Tag){$eventArgs.Cancel=$true;$sender.Hide()}})
  $timer=New-Object Windows.Forms.Timer;$timer.Interval=100;$timer.Add_Tick({Invoke-OfflineTick});$timer.Start()
  try{[Windows.Forms.Application]::Run($form)}finally{$timer.Stop();$timer.Dispose();$tray.Visible=$false;$tray.Dispose();$form.Dispose()}
}
function Show-OfflineError([string]$Message){Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show($Message,'LTD Offline - Lỗi khởi động')}
