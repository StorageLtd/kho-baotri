$ErrorActionPreference='Stop';$script:Server=$null;$script:Closing=$false
try{
 if(-not [Environment]::Is64BitProcess){throw 'Cần Windows PowerShell 64-bit.'}
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 Add-Type -Path @((Join-Path $PSScriptRoot 'ProgramTransfer.cs'),(Join-Path $PSScriptRoot 'WebTransferServer.cs')) -ReferencedAssemblies @('System.dll','System.Core.dll','System.Runtime.Serialization.dll')
 [Windows.Forms.Application]::EnableVisualStyles()
 $form=New-Object Windows.Forms.Form;$form.Text='LTD | Web Program Transfer';$form.Size=New-Object Drawing.Size(820,530);$form.MinimumSize=$form.Size;$form.StartPosition='CenterScreen';$form.BackColor=[Drawing.Color]::FromArgb(237,243,248);$form.Font=New-Object Drawing.Font('Segoe UI',10);$form.AutoScaleMode='Dpi'
 $heading=New-Object Windows.Forms.Label;$heading.Text="LTD | WEB PROGRAM TRANSFER`r`nLưu chương trình vào bộ nhớ CNC · Build 20261110-transfer-tool";$heading.SetBounds(0,0,820,90);$heading.Padding=New-Object Windows.Forms.Padding(22,14,0,0);$heading.BackColor=[Drawing.Color]::FromArgb(17,50,74);$heading.ForeColor=[Drawing.Color]::White;$heading.Font=New-Object Drawing.Font('Segoe UI',15,[Drawing.FontStyle]::Bold);$heading.Anchor='Top,Left,Right';$form.Controls.Add($heading)
 function Label([string]$Text,[int]$X,[int]$Y,[int]$Width=200){$c=New-Object Windows.Forms.Label;$c.Text=$Text;$c.SetBounds($X,$Y,$Width,24);$form.Controls.Add($c)}
 Label 'IP máy CNC' 22 110;Label 'Cổng FOCAS' 240 110
 $ip=New-Object Windows.Forms.TextBox;$ip.Text='192.168.1.1';$ip.SetBounds(22,138,200,30);$form.Controls.Add($ip)
 $port=New-Object Windows.Forms.NumericUpDown;$port.Minimum=1;$port.Maximum=65535;$port.Value=8193;$port.SetBounds(240,138,110,30);$form.Controls.Add($port)
 function Button([string]$Text,[int]$X,[int]$Y,[int]$Width=160){$b=New-Object Windows.Forms.Button;$b.Text=$Text;$b.SetBounds($X,$Y,$Width,34);$b.FlatStyle='Flat';$b.BackColor=[Drawing.Color]::White;$form.Controls.Add($b);return $b}
 $import=Button 'Nhập cấu hình máy' 380 135 180;$start=Button 'Bật kết nối web' 22 190 180;$stop=Button 'Dừng tiện ích' 220 190 160;$stop.Enabled=$false;$start.BackColor=[Drawing.Color]::FromArgb(10,123,111);$start.ForeColor=[Drawing.Color]::White
 Label 'Mã ghép phiên — dán vào mục Truyền chương trình trên web' 22 250 740
 $code=New-Object Windows.Forms.TextBox;$code.ReadOnly=$true;$code.Font=New-Object Drawing.Font('Consolas',11);$code.SetBounds(22,280,740,30);$code.Anchor='Top,Left,Right';$form.Controls.Add($code)
 $copy=Button 'Sao chép mã' 22 325;$copy.Enabled=$false;$open=Button 'Mở web công ty' 200 325 170
 $status=New-Object Windows.Forms.Label;$status.Text="Chưa bật kết nối. Chọn đúng máy trước khi bật.`r`nChỉ lắng nghe tại 127.0.0.1:8766 trên laptop; không mở cổng router.";$status.SetBounds(22,380,740,80);$status.Anchor='Top,Left,Right,Bottom';$form.Controls.Add($status)
 $library=Join-Path $PSScriptRoot 'lib'
 function Set-Running([bool]$Running){$ip.Enabled=-not $Running;$port.Enabled=-not $Running;$import.Enabled=-not $Running;$start.Enabled=-not $Running;$stop.Enabled=$Running;$copy.Enabled=$Running}
 function Stop-Server{
  if(-not $script:Server){return $true}
  if(-not $script:Server.TryStop()){$status.Text='Đang có yêu cầu truyền/nhận. Chờ hoàn tất trước khi dừng hoặc đóng tiện ích.';return $false}
  $script:Server.Dispose();$script:Server=$null;$code.Text='';Set-Running $false;$status.Text='Đã dừng kết nối web. Mã ghép cũ không còn hiệu lực.';return $true
 }
 $start.Add_Click({try{[FanucProgramTransfer]::LoadLibrary($library);$server=New-Object LtdWebTransferServer($ip.Text.Trim(),[uint16]$port.Value,$library,8766);$server.Start();$script:Server=$server;$code.Text=$server.SessionCode;Set-Running $true;$status.Text='Đã bật. Trên web: mở máy có IP '+$ip.Text.Trim()+' → Truyền chương trình → dán mã ghép. Nếu trình duyệt hỏi quyền mạng cục bộ, chọn cho phép.'}catch{if($server){$server.Dispose()};$status.Text=$_.Exception.GetBaseException().Message}})
 $stop.Add_Click({[void](Stop-Server)});$copy.Add_Click({if($code.Text){[Windows.Forms.Clipboard]::SetText($code.Text)}})
 $open.Add_Click({Start-Process 'https://storageltd.github.io/kho-baotri/'})
 $import.Add_Click({$dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Filter='Bridge config (*.json)|*.json';$dialog.InitialDirectory=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD/CncBridgeManager/machines';try{if($dialog.ShowDialog($form) -eq 'OK'){$config=Get-Content -LiteralPath $dialog.FileName -Raw -Encoding UTF8|ConvertFrom-Json;[FanucProgramTransfer]::ValidateTarget([string]$config.cncIp,[uint16]$config.port);$ip.Text=$config.cncIp;$port.Value=[int]$config.port}}catch{$status.Text=$_.Exception.GetBaseException().Message}finally{$dialog.Dispose()}})
 $timer=New-Object Windows.Forms.Timer;$timer.Interval=350;$timer.Add_Tick({if($script:Server){$status.Text=if($script:Server.Busy){'Đang xử lý yêu cầu với CNC. Không đóng tiện ích hoặc rút cáp.'}else{$script:Server.LastMessage}};if($script:Closing -and (-not $script:Server -or -not $script:Server.Busy)){$form.Close()}});$timer.Start()
 $form.Add_FormClosing({param($sender,$e) if(-not (Stop-Server)){$script:Closing=$true;$e.Cancel=$true;$status.Text='Chờ thao tác CNC hoàn tất trước khi đóng.'}})
 $form.Add_FormClosed({$timer.Stop();$timer.Dispose()});[Windows.Forms.Application]::Run($form)
}catch{try{[Windows.Forms.MessageBox]::Show($_.Exception.GetBaseException().Message,'LTD Web Transfer')|Out-Null}catch{Write-Error $_};exit 1}
