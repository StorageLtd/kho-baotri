param([ValidateSet('Start','Stop','Status','Remove')][string]$Action='Status')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
. (Join-Path $PSScriptRoot 'Background-Common.ps1')
try {
    $config=Get-Content (Join-Path $PSScriptRoot 'pmc-config.json') -Raw -Encoding UTF8|ConvertFrom-Json
    switch($Action){
        'Start' {Start-LtdBackground $PSScriptRoot;[Windows.Forms.MessageBox]::Show('Đã bật thử đọc PMC chạy nền. Chọn “Trạng thái” để xem kết quả.','LTD PMC')|Out-Null}
        'Stop' {Stop-LtdBackground $PSScriptRoot;[Windows.Forms.MessageBox]::Show('Đã dừng. Dùng “Bật kết nối” khi muốn thử lại.','LTD PMC')|Out-Null}
        'Remove' {
            if([Windows.Forms.MessageBox]::Show('Gỡ tự khởi động và các lối tắt? Nhật ký cục bộ vẫn được giữ lại.','LTD PMC','YesNo','Question') -ne 'Yes'){return}
            Stop-LtdBackground $PSScriptRoot
            $paths=Get-LtdShortcutPaths $config.machineId
            Remove-Item -LiteralPath $paths.Startup -Force -ErrorAction SilentlyContinue
            foreach($name in @('Bat','Dung','Trang-thai','Cau-hinh','Go-cai-dat')){Remove-Item -LiteralPath (Join-Path $paths.Desktop ('LTD-PMC-'+$config.machineId+'-'+$name+'.lnk')) -Force -ErrorAction SilentlyContinue}
            [Windows.Forms.MessageBox]::Show('Đã gỡ tự khởi động. Nhật ký còn trong thư mục cài đặt.','LTD PMC')|Out-Null
        }
        'Status' {
            $form=New-Object Windows.Forms.Form;$form.Text='LTD PMC — '+$config.machineName;$form.Size=New-Object Drawing.Size(650,420);$form.StartPosition='CenterScreen'
            $text=New-Object Windows.Forms.TextBox;$text.Multiline=$true;$text.ReadOnly=$true;$text.ScrollBars='Vertical';$text.Dock='Fill';$text.Font=New-Object Drawing.Font('Segoe UI',11)
            $panel=New-Object Windows.Forms.FlowLayoutPanel;$panel.Dock='Bottom';$panel.Height=46
            $open=New-Object Windows.Forms.Button;$open.Text='Mở nhật ký';$open.AutoSize=$true;$panel.Controls.Add($open)
            $open.Add_Click({Start-Process -FilePath explorer.exe -ArgumentList ('"'+(Join-Path $PSScriptRoot 'logs')+'"')})
            $form.Controls.Add($text);$form.Controls.Add($panel)
            $timer=New-Object Windows.Forms.Timer;$timer.Interval=1000
            $update={
                $running=Test-LtdBackgroundRunning $PSScriptRoot
                $lines=@($config.machineName,('CNC: '+$config.cncIp+':'+$config.port),'CHỈ ĐỌC CỤC BỘ — không gửi web, không ghi/ép bit PMC.','')
                $path=Join-Path $PSScriptRoot 'pmc-status.json'
                try {
                    $state=Get-Content $path -Raw -Encoding UTF8|ConvertFrom-Json
                    $age=([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($state.updatedUtc)).TotalSeconds
                    $fresh=$running -and $state.state -eq 'Connected' -and $age -ge -5 -and $age -le 15
                    $lines+=if($fresh){'Đang đọc tín hiệu'}elseif($running){'Đang chờ kết nối / chưa có dữ liệu mới'}else{'Đã dừng'}
                    if($fresh){$lines+=('X10.1 — Cycle Start: '+[int]$state.sample.x10Bit1);$lines+=('R423.6 — M30: '+[int]$state.sample.r423Bit6)}else{$lines+='X10.1: —';$lines+='R423.6: —'}
                    $lines+=('Cập nhật: '+([DateTimeOffset]::Parse($state.updatedUtc)).ToLocalTime().ToString('dd/MM/yyyy HH:mm:ss'))
                    if($state.state -eq 'Waiting'){$lines+=('Chi tiết: '+$state.message)}
                }catch{$lines+=if($running){'Đang khởi động / chờ CNC'}else{'Chưa chạy'}}
                $lines+='';$lines+='1 = ON, 0 = OFF. Có thể bỏ sót xung ngắn.';$lines+='Địa chỉ tín hiệu phải được đối chiếu đúng từng máy.'
                $text.Text=$lines -join "`r`n"
            }
            $timer.Add_Tick($update);& $update;$timer.Start()
            try{$null=$form.ShowDialog()}finally{$timer.Stop();$timer.Dispose();$form.Dispose()}
        }
    }
}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'LTD PMC — lỗi')|Out-Null;exit 1}
