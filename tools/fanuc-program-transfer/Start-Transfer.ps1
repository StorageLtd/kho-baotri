$ErrorActionPreference='Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Add-Type -Path @((Join-Path $PSScriptRoot 'FanucReader.cs'),(Join-Path $PSScriptRoot 'ProgramTransfer.cs'))
    $form=New-Object Windows.Forms.Form
    $form.Text='FANUC - Program transfer trial (writes CNC program memory)';$form.Size=New-Object Drawing.Size(760,650);$form.StartPosition='CenterScreen'
    $note=New-Object Windows.Forms.Label;$note.Text='BAN THU TRUYEN CHUONG TRINH - CO GHI VAO BO NHO CNC. Khong ghi de, khong tu chay.';$note.SetBounds(18,15,700,35);$form.Controls.Add($note)
    $ip=New-Object Windows.Forms.TextBox;$ip.Text='192.168.1.1';$ip.SetBounds(18,58,180,27);$form.Controls.Add($ip)
    $port=New-Object Windows.Forms.NumericUpDown;$port.Minimum=1;$port.Maximum=65535;$port.Value=8193;$port.SetBounds(210,58,90,27);$form.Controls.Add($port)
    $choose=New-Object Windows.Forms.Button;$choose.Text='1. Chon file NC';$choose.SetBounds(320,56,150,30);$form.Controls.Add($choose)
    $inspect=New-Object Windows.Forms.Button;$inspect.Text='2. Kiem tra CNC';$inspect.SetBounds(480,56,190,30);$inspect.Enabled=$false;$form.Controls.Add($inspect)
    $preview=New-Object Windows.Forms.TextBox;$preview.Multiline=$true;$preview.ReadOnly=$true;$preview.ScrollBars='Both';$preview.WordWrap=$false;$preview.SetBounds(18,100,700,300);$preview.Font=New-Object Drawing.Font('Consolas',10);$form.Controls.Add($preview)
    $details=New-Object Windows.Forms.Label;$details.SetBounds(18,410,700,60);$form.Controls.Add($details)
    $prompt=New-Object Windows.Forms.Label;$prompt.Text='Nhap TRUYEN Oxxxx de xac nhan. CNC phai dung, EDIT, khong alarm.';$prompt.SetBounds(18,480,700,25);$form.Controls.Add($prompt)
    $confirm=New-Object Windows.Forms.TextBox;$confirm.SetBounds(18,510,260,28);$form.Controls.Add($confirm)
    $send=New-Object Windows.Forms.Button;$send.Text='3. Xac nhan va truyen';$send.SetBounds(300,507,220,33);$send.Enabled=$false;$form.Controls.Add($send)
    $status=New-Object Windows.Forms.Label;$status.SetBounds(18,550,700,45);$status.Text='Khong Firebase / web. Thao tac tai laptop, doi chieu dung may truoc khi truyen.';$form.Controls.Add($status)
    $script:selected=$null;$script:approvedIp=$null
    $library=Join-Path $PSScriptRoot 'lib'
    $choose.Add_Click({
        $dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Filter='NC files (*.nc;*.txt;*.tap)|*.nc;*.txt;*.tap|All files (*.*)|*.*'
        if($dialog.ShowDialog() -eq 'OK'){
            $send.Enabled=$false;$inspect.Enabled=$false
            try{$script:selected=[FanucProgramTransfer]::ValidateFile($dialog.FileName);$preview.Text=$script:selected.Preview;$details.Text="$($script:selected.FilePath)`n$($script:selected.Program) | $($script:selected.Bytes.Length) bytes | SHA256 $($script:selected.Hash)";$inspect.Enabled=$true;$status.Text='File hop le ve dinh dang; chua kiem tra an toan gia cong.'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.GetBaseException().Message,'File rejected')}
        }
    })
    $ip.Add_TextChanged({$send.Enabled=$false});$port.Add_ValueChanged({$send.Enabled=$false})
    $inspect.Add_Click({
        try{$form.UseWaitCursor=$true;$status.Text='Dang kiem tra may...';$form.Refresh();$status.Text=[FanucProgramTransfer]::Inspect($ip.Text.Trim(),[uint16]$port.Value,$library,$script:selected.FilePath);$script:approvedIp=$ip.Text.Trim();$script:approvedPort=[uint16]$port.Value;$send.Enabled=$true}
        catch{$send.Enabled=$false;[Windows.Forms.MessageBox]::Show($_.Exception.GetBaseException().Message,'Inspection failed')}
        finally{$form.UseWaitCursor=$false}
    })
    $send.Add_Click({
        if($ip.Text.Trim() -ne $script:approvedIp -or [uint16]$port.Value -ne $script:approvedPort){$send.Enabled=$false;return}
        if($confirm.Text -cne "TRUYEN $($script:selected.Program)"){[Windows.Forms.MessageBox]::Show("Nhap dung: TRUYEN $($script:selected.Program)");return}
        $answer=[Windows.Forms.MessageBox]::Show("GHI $($script:selected.Program) vao CNC $($script:approvedIp):$($script:approvedPort)?`nDa doi chieu dung may, file va O-number chua?",'CONFIRM CNC WRITE','YesNo','Warning')
        if($answer -ne 'Yes'){return}
        try{$form.UseWaitCursor=$true;$send.Enabled=$false;$status.Text='Dang truyen. Khong dong cua so hoac rut cap. Co the mat toi 90 giay.';$form.Refresh();$message=[FanucProgramTransfer]::Send($script:approvedIp,$script:approvedPort,$library,$script:selected.FilePath,$script:selected.Hash,$confirm.Text);$status.Text=$message;[Windows.Forms.MessageBox]::Show($message,'Transfer result')}
        catch{$status.Text='Transfer stopped - inspect CNC program memory.';[Windows.Forms.MessageBox]::Show($_.Exception.GetBaseException().Message,'Transfer stopped')}
        finally{$form.UseWaitCursor=$false;$send.Enabled=$false}
    })
    [void]$form.ShowDialog()
} catch {Write-Host $_.Exception.GetBaseException().Message -ForegroundColor Red;Read-Host 'Enter to close'}
