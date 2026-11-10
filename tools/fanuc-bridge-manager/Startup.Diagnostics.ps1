# Startup errors contain messages and source location only, never credentials or runtime samples.
function Save-ManagerStartupFailure($Failure,[string]$Folder=''){
 $details=if($Failure.Exception){$Failure.Exception.Message}else{[string]$Failure}
 if($Failure.InvocationInfo){$details+="`r`nFile: $($Failure.InvocationInfo.ScriptName)`r`nDòng: $($Failure.InvocationInfo.ScriptLineNumber)"}
 $details="LTD Bridge Manager — Lỗi khởi động`r`nBuild 20261110-nc-directory`r`n`r`n"+$details
 $logPath=$null
 try{if(-not $Folder){$Folder=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LTD/CncBridgeManager'};$null=New-Item -ItemType Directory -Path $Folder -Force;$logPath=Join-Path $Folder 'manager-startup-error.log';[IO.File]::WriteAllText($logPath,$details,[Text.UTF8Encoding]::new($true))}catch{}
 return [pscustomobject]@{Details=$details;LogPath=$logPath}
}
function Show-ManagerStartupFailure($Failure){
 $saved=Save-ManagerStartupFailure $Failure;$details=$saved.Details;$logPath=$saved.LogPath
 try{
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $errorForm=New-Object Windows.Forms.Form;$errorForm.Text='LTD — Chi tiết lỗi khởi động';$errorForm.Size=New-Object Drawing.Size(820,480);$errorForm.MinimumSize=New-Object Drawing.Size(650,380);$errorForm.StartPosition='CenterScreen'
  $box=New-Object Windows.Forms.TextBox;$box.Multiline=$true;$box.ReadOnly=$true;$box.ScrollBars='Both';$box.WordWrap=$false;$box.Dock='Fill';$box.Font=New-Object Drawing.Font('Consolas',10);$box.Text=$details+"`r`n`r`nNhật ký: $logPath`r`nCó thể chọn nội dung và nhấn Ctrl+C để gửi phần lỗi.";$errorForm.Controls.Add($box)
  $close=New-Object Windows.Forms.Button;$close.Text='Đóng';$close.Dock='Bottom';$close.Height=38;$close.Add_Click({$errorForm.Close()});$errorForm.Controls.Add($close);[void]$errorForm.ShowDialog();$errorForm.Dispose()
 }catch{Write-Host $details -ForegroundColor Red;Write-Host ('Nhật ký: '+$logPath);[void](Read-Host 'Nhấn Enter để đóng')}
}
