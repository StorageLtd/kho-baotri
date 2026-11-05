$ErrorActionPreference='Stop'
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows 11.'}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'Background-Common.ps1')
[Windows.Forms.Application]::EnableVisualStyles()
function Set-LtdPrivateFolder([string]$Path){
    $null=New-Item -ItemType Directory -Path $Path -Force
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl=New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
    foreach($principal in @($sid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))){
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Test-LtdX64Dll([string]$Path){
    if(-not (Test-Path -LiteralPath $Path)){throw ('Thiếu DLL: '+[IO.Path]::GetFileName($Path)+'. Chép 3 DLL x64 đang dùng vào lib trước.')}
    $stream=[IO.File]::OpenRead($Path)
    try{
        $reader=New-Object IO.BinaryReader($stream)
        if($reader.ReadUInt16() -ne 0x5a4d -or $stream.Length -lt 64){throw 'Invalid library'}
        $stream.Position=0x3c;$offset=$reader.ReadInt32()
        if($offset -lt 64 -or $offset+6 -gt $stream.Length){throw 'Invalid library'}
        $stream.Position=$offset
        if($reader.ReadUInt32() -ne 0x4550 -or $reader.ReadUInt16() -ne 0x8664){throw 'Not an x64 DLL'}
    }catch{throw ('DLL không phải bộ Windows x64 hợp lệ: '+[IO.Path]::GetFileName($Path))}finally{$stream.Dispose()}
}
$configPath=Join-Path $PSScriptRoot 'pmc-config.json'
$config=Get-Content $configPath -Raw -Encoding UTF8|ConvertFrom-Json
$form=New-Object Windows.Forms.Form;$form.Text='LTD — Cài bản thử PMC chạy nền';$form.Size=New-Object Drawing.Size(580,430);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false
$layout=New-Object Windows.Forms.TableLayoutPanel;$layout.Dock='Fill';$layout.Padding=New-Object Windows.Forms.Padding(16);$layout.ColumnCount=2;$layout.RowCount=9
$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Absolute',150)))|Out-Null
$layout.ColumnStyles.Add((New-Object Windows.Forms.ColumnStyle('Percent',100)))|Out-Null
$fields=@{}
$definitions=@(@('machineId','Mã máy thử'),@('machineName','Tên máy'),@('cncIp','IP CNC'),@('port','Cổng FOCAS'),@('intervalMs','Nhịp đọc (ms)'))
for($i=0;$i -lt $definitions.Count;$i++){
    $label=New-Object Windows.Forms.Label;$label.Text=$definitions[$i][1];$label.AutoSize=$true;$label.Anchor='Left'
    $box=New-Object Windows.Forms.TextBox;$box.Text=[string]$config.($definitions[$i][0]);$box.Dock='Fill'
    $layout.Controls.Add($label,0,$i);$layout.Controls.Add($box,1,$i);$fields[$definitions[$i][0]]=$box
    $layout.RowStyles.Add((New-Object Windows.Forms.RowStyle('Absolute',36)))|Out-Null
}
$auto=New-Object Windows.Forms.CheckBox;$auto.Text='Tự chạy khi đăng nhập Windows';$auto.Checked=$true;$auto.AutoSize=$true
$layout.Controls.Add($auto,0,5);$layout.SetColumnSpan($auto,2)
$notice=New-Object Windows.Forms.Label;$notice.Text='Chỉ đọc X10.1 / R423.6, không ghi/ép bit, không gửi lên web. Không cần mật khẩu web. Xung ngắn có thể bị bỏ sót.';$notice.AutoSize=$true;$notice.MaximumSize=New-Object Drawing.Size(510,70)
$layout.Controls.Add($notice,0,6);$layout.SetColumnSpan($notice,2)
$status=New-Object Windows.Forms.Label;$status.Text='Dừng bản cầu nối/thử PMC cũ trước khi cài.';$status.AutoSize=$true;$status.MaximumSize=New-Object Drawing.Size(510,50)
$layout.Controls.Add($status,0,7);$layout.SetColumnSpan($status,2)
$button=New-Object Windows.Forms.Button;$button.Text='Cài đặt và chạy thử';$button.AutoSize=$true;$button.Height=34
$layout.Controls.Add($button,1,8)
$button.Add_Click({
    $button.Enabled=$false
    try {
        $id=$fields.machineId.Text.Trim();$name=$fields.machineName.Text.Trim();$ipText=$fields.cncIp.Text.Trim();$ip=$null;$port=0;$interval=0
        if($id -notmatch '^[a-z0-9][a-z0-9-]{0,63}$'){throw 'Mã máy chỉ dùng chữ thường, số và dấu gạch ngang; tối đa 64 ký tự.'}
        if(-not $name){throw 'Nhập tên máy.'}
        if(-not [Net.IPAddress]::TryParse($ipText,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'IP CNC phải là địa chỉ IPv4 hợp lệ.'}
        if(-not [int]::TryParse($fields.port.Text,[ref]$port) -or $port -lt 1 -or $port -gt 65535){throw 'Cổng FOCAS phải từ 1 đến 65535.'}
        if(-not [int]::TryParse($fields.intervalMs.Text,[ref]$interval) -or $interval -lt 500 -or $interval -gt 5000){throw 'Nhịp đọc từ 500 đến 5000 ms.'}
        foreach($dll in @('Fwlib64.dll','fwlibe64.dll','fwlib30i64.dll')){Test-LtdX64Dll (Join-Path $PSScriptRoot ('lib\'+$dll))}
        $base=Join-Path $env:LOCALAPPDATA 'LTD-PMC-Trial';$target=Join-Path $base $id
        if(Test-Path $base){foreach($directory in Get-ChildItem -LiteralPath $base -Directory){
            $otherPath=Join-Path $directory.FullName 'pmc-config.json'
            if($directory.Name -ne $id -and (Test-Path $otherPath)){
                $other=Get-Content $otherPath -Raw -Encoding UTF8|ConvertFrom-Json
                if($other.cncIp -eq $ipText -and [int]$other.port -eq $port -and (Test-LtdBackgroundRunning $directory.FullName)){throw 'Đã có bản thử PMC chạy nền cho IP này. Dừng bản đó trước.'}
            }
        }}
        $status.Text='Đang cài. Nếu đang chạy, chờ tiến trình cũ dừng...';$form.Refresh()
        if(Test-Path $target){Stop-LtdBackground $target}
        Set-LtdPrivateFolder $target
        $null=New-Item -ItemType Directory -Path (Join-Path $target 'lib') -Force
        $null=New-Item -ItemType Directory -Path (Join-Path $target 'logs') -Force
        $files=@('Background-Common.ps1','Run-Background.ps1','Read-PmcBackground.ps1','Manage-Background.ps1','Setup-Background.ps1','PmcReadOnlyProbe.cs','CAI-DAT.cmd','README-VI.txt')
        foreach($file in $files){
            $from=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $file));$to=[IO.Path]::GetFullPath((Join-Path $target $file))
            if($from -ine $to){Copy-Item -LiteralPath $from -Destination $to -Force}
        }
        foreach($dll in @('Fwlib64.dll','fwlibe64.dll','fwlib30i64.dll')){
            $from=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('lib\'+$dll)));$to=[IO.Path]::GetFullPath((Join-Path $target ('lib\'+$dll)))
            if($from -ine $to){Copy-Item -LiteralPath $from -Destination $to -Force}
        }
        @{machineId=$id;machineName=$name;cncIp=$ipText;port=$port;intervalMs=$interval}|ConvertTo-Json|Set-Content (Join-Path $target 'pmc-config.json') -Encoding UTF8
        $paths=Get-LtdShortcutPaths $id
        if($auto.Checked){New-LtdShortcut $paths.Startup $target 'Run-Background.ps1'}else{Remove-Item -LiteralPath $paths.Startup -Force -ErrorAction SilentlyContinue}
        foreach($pair in @(@('Bat','Start'),@('Dung','Stop'),@('Trang-thai','Status'),@('Go-cai-dat','Remove'))){New-LtdShortcut (Join-Path $paths.Desktop ('LTD-PMC-'+$id+'-'+$pair[0]+'.lnk')) $target 'Manage-Background.ps1' ('-Action '+$pair[1])}
        New-LtdShortcut (Join-Path $paths.Desktop ('LTD-PMC-'+$id+'-Cau-hinh.lnk')) $target 'Setup-Background.ps1'
        Start-LtdBackground $target
        $status.Text='Đã cài. Mở lối tắt Trang-thai ngoài Desktop để xem tín hiệu.'
        [Windows.Forms.MessageBox]::Show("Đã cài vào:`r`n$target`r`n`r`nCNC chưa có mạng thì chương trình tự chờ kết nối. Không thay đổi website.",'LTD PMC')|Out-Null
    }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'LTD PMC — chưa cài xong')|Out-Null}
    finally{$button.Enabled=$true}
})
$form.Controls.Add($layout)
try{$null=$form.ShowDialog()}finally{$form.Dispose()}
