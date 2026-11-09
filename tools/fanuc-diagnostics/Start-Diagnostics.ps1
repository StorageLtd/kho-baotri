$ErrorActionPreference='Stop'
$script:Task=$null;$script:Automatic=$false;$script:NextRead=[DateTime]::MaxValue;$script:Closing=$false
try{
 if(-not [Environment]::Is64BitProcess){throw 'Cần Windows PowerShell 64-bit.'}
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticReader.cs')
 [Windows.Forms.Application]::EnableVisualStyles()
 $form=New-Object Windows.Forms.Form;$form.Text='LTD | CNC Diagnostic & Status — READ ONLY';$form.Size=New-Object Drawing.Size(1080,800);$form.MinimumSize=New-Object Drawing.Size(960,720);$form.StartPosition='CenterScreen';$form.Font=New-Object Drawing.Font('Segoe UI',10);$form.BackColor=[Drawing.Color]::FromArgb(237,243,249);$form.AutoScaleMode='Dpi'
 $layout=New-Object Windows.Forms.TableLayoutPanel;$layout.Dock='Fill';$layout.ColumnCount=1;$layout.RowCount=6;$layout.Padding=New-Object Windows.Forms.Padding(16)
 foreach($height in @(80,125,100,45)){[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Absolute',$height)))}
 [void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Percent',100)));[void]$layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Absolute',65)));$form.Controls.Add($layout)
 $header=New-Object Windows.Forms.Label;$header.Dock='Fill';$header.BackColor=[Drawing.Color]::FromArgb(17,43,64);$header.ForeColor=[Drawing.Color]::White;$header.Padding=New-Object Windows.Forms.Padding(16,10,0,0);$header.Font=New-Object Drawing.Font('Segoe UI',16,[Drawing.FontStyle]::Bold);$header.Text="LTD | CNC DIAGNOSTIC & STATUS`r`nBản thử riêng · Chỉ đọc · 20261109-diagnostics-readonly";$layout.Controls.Add($header,0,0)
 function New-Flow([int]$Row){$p=New-Object Windows.Forms.FlowLayoutPanel;$p.Dock='Fill';$p.WrapContents=$true;$p.Padding=New-Object Windows.Forms.Padding(0,10,0,0);$layout.Controls.Add($p,0,$Row);return $p}
 function Add-Label($Parent,[string]$Text){$c=New-Object Windows.Forms.Label;$c.Text=$Text;$c.AutoSize=$true;$c.Margin=New-Object Windows.Forms.Padding(4,7,4,0);[void]$Parent.Controls.Add($c)}
 function Add-Number($Parent,[int]$Min,[int]$Max,[int]$Value,[int]$Width=85){$c=New-Object Windows.Forms.NumericUpDown;$c.Minimum=$Min;$c.Maximum=$Max;$c.Value=$Value;$c.Width=$Width;[void]$Parent.Controls.Add($c);return $c}
 function Add-Button($Parent,[string]$Text,[int]$Width=130){$c=New-Object Windows.Forms.Button;$c.Text=$Text;$c.Width=$Width;$c.Height=32;$c.FlatStyle='Flat';$c.BackColor=[Drawing.Color]::White;[void]$Parent.Controls.Add($c);return $c}
 $connection=New-Flow 1;Add-Label $connection 'IP CNC';$ip=New-Object Windows.Forms.TextBox;$ip.Text='192.168.1.1';$ip.Width=145;$connection.Controls.Add($ip);Add-Label $connection 'Cổng';$port=Add-Number $connection 1 65535 8193
 $import=Add-Button $connection 'Nhập cấu hình máy' 165;Add-Label $connection 'Chu kỳ (giây)';$interval=Add-Number $connection 1 60 5 60
 $dgnProfile=New-Object Windows.Forms.CheckBox;$dgnProfile.Text='DGN: xác nhận bộ điều khiển FANUC 30i / 0i-D/F (gồm 0i-MF Plus) / PMi-A';$dgnProfile.AutoSize=$true;$dgnProfile.Margin=New-Object Windows.Forms.Padding(4,12,4,0);$connection.SetFlowBreak($interval,$true);$connection.Controls.Add($dgnProfile)
 $select=New-Flow 2;$dgnOn=New-Object Windows.Forms.CheckBox;$dgnOn.Text='Đọc DGN';$dgnOn.AutoSize=$true;$select.Controls.Add($dgnOn);Add-Label $select 'Số';$dgn=Add-Number $select 0 32767 0;Add-Label $select 'Trục (0 = không trục)';$axis=Add-Number $select 0 32 0 60
 $pmcOn=New-Object Windows.Forms.CheckBox;$pmcOn.Text='Đọc PMC';$pmcOn.AutoSize=$true;$pmcOn.Margin=New-Object Windows.Forms.Padding(20,4,4,0);$select.Controls.Add($pmcOn)
 $pmc=New-Object Windows.Forms.TextBox;$pmc.Text='X10.1';$pmc.Width=110;$select.Controls.Add($pmc)
 $note=New-Object Windows.Forms.Label;$note.Text='PMC: X / Y / R / G / F, ví dụ X10.1 hoặc R423.6. Mỗi lần đọc 1 byte; bit hiển thị từ 7 → 0.';$note.AutoSize=$true;$note.Margin=New-Object Windows.Forms.Padding(4,10,4,0);$select.SetFlowBreak($pmc,$true);$select.Controls.Add($note)
 $actions=New-Flow 3;$read=Add-Button $actions 'Đọc một lần';$auto=Add-Button $actions 'Theo dõi';$stop=Add-Button $actions 'Dừng đọc';$read.BackColor=[Drawing.Color]::FromArgb(13,123,111);$read.ForeColor=[Drawing.Color]::White
 $grid=New-Object Windows.Forms.DataGridView;$grid.Dock='Fill';$grid.ReadOnly=$true;$grid.AllowUserToAddRows=$false;$grid.AllowUserToDeleteRows=$false;$grid.RowHeadersVisible=$false;$grid.AutoSizeColumnsMode='Fill';$grid.AutoSizeRowsMode='AllCells';$grid.BackgroundColor=[Drawing.Color]::White;$grid.BorderStyle='None';$grid.EnableHeadersVisualStyles=$false;$grid.ColumnHeadersDefaultCellStyle.BackColor=[Drawing.Color]::FromArgb(28,59,81);$grid.ColumnHeadersDefaultCellStyle.ForeColor=[Drawing.Color]::White;$grid.DefaultCellStyle.WrapMode='True';$grid.SelectionMode='FullRowSelect'
 foreach($title in @('Mục','Địa chỉ / Kiểu','Giá trị / Trạng thái')){[void]$grid.Columns.Add($title,$title)};$grid.Columns[0].FillWeight=25;$grid.Columns[1].FillWeight=30;$grid.Columns[2].FillWeight=65;$layout.Controls.Add($grid,0,4)
 $status=New-Object Windows.Forms.Label;$status.Dock='Fill';$status.Padding=New-Object Windows.Forms.Padding(4,8,4,0);$status.Text="Chưa đọc CNC. Không cần đăng nhập web.`r`nKhông ghi/force bit, không sửa ladder/tham số. Xung ngắn có thể bị bỏ lỡ.";$layout.Controls.Add($status,0,5)
 $inputs=@($ip,$port,$import,$dgnProfile,$dgnOn,$dgn,$axis,$pmcOn,$pmc,$interval)
 function Set-Busy([bool]$Busy){foreach($control in $inputs){$control.Enabled=-not $Busy};$read.Enabled=-not $Busy;$auto.Enabled=-not $Busy}
 function Add-Row([string]$Name,[string]$Address,[string]$Value){$n=$grid.Rows.Add($Name,$Address,$Value);return $grid.Rows[$n]}
 function Clear-Readings {$grid.Rows.Clear()}
 function Start-Read{
  if($script:Task){return}
  try{
   $address=$null;if(-not [Net.IPAddress]::TryParse($ip.Text.Trim(),[ref]$address) -or $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Nhập IP IPv4 hợp lệ.'}
   if($dgnOn.Checked -and -not $dgnProfile.Checked){throw 'Chỉ bật DGN sau khi xác nhận đúng dòng điều khiển hỗ trợ.'}
   $area='X';$byteAddress=-1;$script:SelectedBit=-1
   if($pmcOn.Checked){$text=$pmc.Text.Trim().ToUpperInvariant();if($text -notmatch '^([XYRGF])(\d{1,5})(?:\.([0-7]))?$'){throw 'Địa chỉ PMC không hợp lệ. Ví dụ X10.1, R423.6.'};$area=$Matches[1];$byteAddress=[int]$Matches[2];if($byteAddress -gt 65535){throw 'Địa chỉ PMC vượt giới hạn.'};if($Matches[3]){$script:SelectedBit=[int]$Matches[3]}}
   [LtdDiagnosticReader]::Load((Join-Path $PSScriptRoot 'lib'))
   $number=if($dgnOn.Checked){[int]$dgn.Value}else{-1}
   Clear-Readings;$status.Text='Đang đọc… Các giá trị cũ đã được xóa.';Set-Busy $true
   $script:Task=[LtdDiagnosticReader]::ReadAsync($ip.Text.Trim(),[uint16]$port.Value,$number,[int]$axis.Value,$area,$byteAddress)
  }catch{$script:Automatic=$false;Set-Busy $false;Clear-Readings;$status.Text=$_.Exception.Message}
 }
 function Show-Snapshot($Sample){
  Clear-Readings
  [void](Add-Row 'Controller' 'CNC / M-T / Series / Version' $Sample.controller)
  if($Sample.statusKnown){
   $s=$Sample.status;$modes=@{0='MDI';1='MEM / AUTO';3='EDIT';4='HANDLE';5='JOG';6='TEACH JOG';7='TEACH HANDLE';8='INC';9='REFERENCE';10='REMOTE'};$runs=@{0='RESET';1='STOP';2='HOLD';3='START';4='MSTR'}
   [void](Add-Row 'Chế độ' ('aut = '+$s.aut) $(if($modes.ContainsKey([int]$s.aut)){$modes[[int]$s.aut]}else{'Mã '+$s.aut}))
   [void](Add-Row 'Vận hành' ('run = '+$s.run) $(if($runs.ContainsKey([int]$s.run)){$runs[[int]$s.run]}else{'Mã '+$s.run}))
   foreach($name in @('alarm','emergency','motion','mstb','edit','hdck','tmmode')){[void](Add-Row 'STATUS' $name ([string]$s.$name))}
  }
  if($null -ne $Sample.dgnNumber){[void](Add-Row ('DGN '+$Sample.dgnNumber) ('Trục '+$Sample.dgnAxis+' / '+$Sample.dgnType) $(if($Sample.dgnError){'KHÔNG ĐỌC ĐƯỢC: '+$Sample.dgnError}else{$Sample.dgnValue}))}
  if($Sample.pmcAddress){
   [void](Add-Row 'PMC BYTE' $Sample.pmcAddress $(if($null -ne $Sample.pmcValue){'0x'+([byte]$Sample.pmcValue).ToString('X2')+' / '+[Convert]::ToString([byte]$Sample.pmcValue,2).PadLeft(8,'0')}else{'KHÔNG ĐỌC ĐƯỢC: '+$Sample.pmcError}))
   if($null -ne $Sample.pmcValue){for($i=7;$i -ge 0;$i--){$on=(([int]$Sample.pmcValue -band (1 -shl $i)) -ne 0);$row=Add-Row $(if($i -eq $script:SelectedBit){'PMC • Đã chọn'}else{'PMC BIT'}) ($Sample.pmcAddress+'.'+$i) $(if($on){'ON · 1'}else{'OFF · 0'});$row.Cells[2].Style.BackColor=if($on){[Drawing.Color]::FromArgb(191,241,218)}else{[Drawing.Color]::FromArgb(232,238,245)}}}
  }
  if($Sample.connectionError){$script:Automatic=$false;$status.Text='Lỗi: '+$Sample.connectionError+' · Đã dừng theo dõi.'}else{$status.Text='Lần đọc: '+([DateTime]::Parse($Sample.timeUtc).ToLocalTime().ToString('dd/MM/yyyy HH:mm:ss'))+$(if($script:Automatic){' · Đang theo dõi'}else{' · Đã dừng / đọc một lần'})+"`r`nCác mục được đọc tuần tự. ON/OFF không đồng nghĩa sự kiện Cycle Start/M30 được bắt đầy đủ."}
 }
 $read.Add_Click({$script:Automatic=$false;Start-Read})
 $auto.Add_Click({$script:Automatic=$true;Start-Read})
 $stop.Add_Click({$script:Automatic=$false;$status.Text=if($script:Task){'Đã tắt theo dõi; chờ lần đọc hiện tại kết thúc.'}else{'Đã dừng đọc.'};if(-not $script:Task){Set-Busy $false}})
 $import.Add_Click({$dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Filter='Bridge configuration (*.json)|*.json';$dialog.InitialDirectory=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD/CncBridgeManager/machines';try{if($dialog.ShowDialog($form) -eq 'OK'){$c=Get-Content -LiteralPath $dialog.FileName -Raw -Encoding UTF8|ConvertFrom-Json;$candidate=$null;if(-not [Net.IPAddress]::TryParse([string]$c.cncIp,[ref]$candidate) -or $candidate.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or [int]$c.port -lt 1 -or [int]$c.port -gt 65535){throw 'Cấu hình thiếu IP/cổng hợp lệ.'};$ip.Text=[string]$c.cncIp;$port.Value=[int]$c.port;$status.Text='Đã nhập IP/cổng. Không thay đổi file cấu hình gốc.'}}catch{$status.Text=$_.Exception.Message}finally{$dialog.Dispose()}})
 $timer=New-Object Windows.Forms.Timer;$timer.Interval=150
 $timer.Add_Tick({
  if($script:Task -and $script:Task.IsCompleted){try{$sample=$script:Task.GetAwaiter().GetResult();Show-Snapshot $sample}catch{$script:Automatic=$false;Clear-Readings;$status.Text=$_.Exception.Message}finally{$script:Task=$null;$script:NextRead=[DateTime]::UtcNow.AddSeconds([double]$interval.Value);Set-Busy $script:Automatic};if($script:Closing){$form.Close();return}}
  if($script:Automatic -and -not $script:Task -and [DateTime]::UtcNow -ge $script:NextRead){Start-Read}
 })
 $form.Add_FormClosing({param($sender,$e) $script:Automatic=$false;if($script:Task){$script:Closing=$true;$e.Cancel=$true;$status.Text='Đang đóng: chờ lần đọc hiện tại giải phóng kết nối CNC.'}})
 $form.Add_FormClosed({$timer.Stop();$timer.Dispose()});$timer.Start();[Windows.Forms.Application]::Run($form)
}catch{try{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'LTD Diagnostics')|Out-Null}catch{Write-Error $_};exit 1}
