function Initialize-OfflineAdminGui {
  Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
  $setup=New-Object Windows.Forms.Form;$setup.Text='LTD Offline · Tạo quản trị viên · Build 20261112-account-setup';$setup.Size=New-Object Drawing.Size(550,475);$setup.StartPosition='CenterScreen';$setup.FormBorderStyle='FixedDialog';$setup.MaximizeBox=$false;$setup.Font=New-Object Drawing.Font('Segoe UI',10)
  $label=New-Object Windows.Forms.Label;$label.Text='Tạo tài khoản riêng trên máy tính này. Có thể dùng địa chỉ email của anh, nhưng tự đặt mật khẩu nội bộ; không cần mật khẩu Gmail.';$label.SetBounds(20,15,490,55);$setup.Controls.Add($label)
  $emailLabel=New-Object Windows.Forms.Label;$emailLabel.Text='Tên đăng nhập (dạng email)';$emailLabel.SetBounds(20,75,490,23);$setup.Controls.Add($emailLabel)
  $email=New-Object Windows.Forms.TextBox;$email.Name='OfflineAdminEmail';$email.Text='admin@ltd.local';$email.MaxLength=254;$email.SetBounds(20,100,490,30);$setup.Controls.Add($email)
  $hint=New-Object Windows.Forms.Label;$hint.Text='Mật khẩu mới: từ 12 đến 128 ký tự';$hint.SetBounds(20,142,490,25);$setup.Controls.Add($hint)
  $password=New-Object Windows.Forms.TextBox;$password.Name='OfflineAdminPassword';$password.UseSystemPasswordChar=$true;$password.MaxLength=128;$password.SetBounds(20,170,490,30);$setup.Controls.Add($password)
  $confirmLabel=New-Object Windows.Forms.Label;$confirmLabel.Text='Nhập lại mật khẩu';$confirmLabel.SetBounds(20,210,490,25);$setup.Controls.Add($confirmLabel)
  $confirm=New-Object Windows.Forms.TextBox;$confirm.Name='OfflineAdminConfirm';$confirm.UseSystemPasswordChar=$true;$confirm.MaxLength=128;$confirm.SetBounds(20,238,490,30);$setup.Controls.Add($confirm)
  $show=New-Object Windows.Forms.CheckBox;$show.Text='Hiện mật khẩu trên màn hình này';$show.SetBounds(20,280,490,27);$setup.Controls.Add($show)
  $show.Add_CheckedChanged({param($sender,$eventArgs);$dialog=$sender.FindForm();$dialog.Controls['OfflineAdminPassword'].UseSystemPasswordChar=-not $sender.Checked;$dialog.Controls['OfflineAdminConfirm'].UseSystemPasswordChar=-not $sender.Checked})
  $status=New-Object Windows.Forms.Label;$status.Name='OfflineSetupStatus';$status.ForeColor=[Drawing.Color]::Firebrick;$status.SetBounds(20,314,490,48);$setup.Controls.Add($status)
  $submit=New-Object Windows.Forms.Button;$submit.Text='Tạo tài khoản nội bộ';$submit.SetBounds(285,370,225,38);$setup.Controls.Add($submit);$setup.AcceptButton=$submit
  # Validate UI only in the event. Persist in the original script scope AFTER ShowDialog.
  $submit.Add_Click({param($sender,$eventArgs)
    $dialog=$sender.FindForm();$inputEmail=$dialog.Controls['OfflineAdminEmail'].Text.Trim();$inputPassword=$dialog.Controls['OfflineAdminPassword'].Text
    $message=''
    if($inputEmail -notmatch '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$'){$message='Tên đăng nhập phải là địa chỉ email hợp lệ.'}
    elseif($inputPassword.Length -lt 12 -or $inputPassword.Length -gt 128){$message='Mật khẩu cần từ 12 đến 128 ký tự. Hiện có '+$inputPassword.Length+' ký tự.'}
    elseif($inputPassword -cne $dialog.Controls['OfflineAdminConfirm'].Text){$message='Hai ô mật khẩu chưa giống nhau. Nhập lại để kiểm tra.'}
    if($message){$dialog.Controls['OfflineSetupStatus'].Text=$message;return}
    $dialog.DialogResult=[Windows.Forms.DialogResult]::OK
  })
  try {
    while($true){
      if($setup.ShowDialog() -ne 'OK'){throw 'Setup cancelled'}
      try {
        $null=New-OfflineAccount -Email $email.Text -Name 'Quản trị viên nội bộ' -Password $password.Text -Role 'admin'
        return
      }catch{
        $message=Get-OfflineAccountError $_ $password.Text
        $status.Text=$message
        $setup.DialogResult=[Windows.Forms.DialogResult]::None
      }
    }
  }finally{$password.Clear();$confirm.Clear();$setup.Dispose()}
}
function Show-OfflineManager([string]$url,[string]$DataRoot) {
  Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
  $form=New-Object Windows.Forms.Form;$form.Text='LTD CMMS OFFLINE · 20261112-account-setup';$form.Size=New-Object Drawing.Size(640,280);$form.StartPosition='CenterScreen'
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
