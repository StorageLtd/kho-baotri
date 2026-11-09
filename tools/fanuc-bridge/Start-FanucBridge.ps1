param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'bridge-config.json'),
    [switch]$Once,
    [switch]$LocalOnly,
    [switch]$BackgroundAfterLogin,
    [switch]$CredentialFromStdin,
    [string]$SessionId='',
    [string]$LibraryDirectory = (Join-Path $PSScriptRoot 'lib'),
    [string]$DataDirectory = $PSScriptRoot,
    [string]$StopRequestPath = ''
)
$ErrorActionPreference = 'Stop'
# All credentials/tokens stay in process memory. Never print HTTP exceptions/URLs.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$script:Auth = $null
$script:BridgeFailed = $false
$machineRegistered = $false
$reportingStarted = $false
. (Join-Path $PSScriptRoot "ReportCollector.ps1")
. (Join-Path $PSScriptRoot "Bridge.State.ps1")
function Invoke-BridgeHttp {
    param([string]$Uri, [string]$Method, $Body, [string]$Operation, [string]$ContentType = 'application/json')
    $parameters = @{ Uri = $Uri; Method = $Method; TimeoutSec = 20; ErrorAction = 'Stop'; Verbose = $false; Debug = $false }
    if ($null -ne $Body) {
        $parameters.Body = if ($ContentType -eq 'application/json') { $Body | ConvertTo-Json -Depth 8 -Compress } else { $Body }
        $parameters.ContentType = if ($ContentType -eq 'application/json') { 'application/json; charset=utf-8' } else { $ContentType }
    }
    try {
        $response = Invoke-RestMethod @parameters
        # Windows PowerShell may leave a top-level JSON scalar as a string.
        # Firebase returns JSON null for a machine that has never been created.
        if ($response -is [string]) { return (ConvertFrom-Json -InputObject $response -ErrorAction Stop) }
        return $response
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        $safeCode=''
        try{
            $details=$_.ErrorDetails.Message|ConvertFrom-Json -ErrorAction Stop
            $code=([string]$details.error.message).Split(':')[0].Trim()
            if($code -in @('INVALID_LOGIN_CREDENTIALS','INVALID_PASSWORD','EMAIL_NOT_FOUND','INVALID_EMAIL','USER_DISABLED','TOO_MANY_ATTEMPTS_TRY_LATER','OPERATION_NOT_ALLOWED','API_KEY_INVALID','INVALID_API_KEY','PROJECT_NOT_FOUND')){$safeCode='; '+$code}
        }catch{}
        throw "$Operation failed (HTTP $status$safeCode). Check Internet, account permissions or Firebase configuration."
    }
}
function Connect-BridgeAccount {
    param($Config, [string]$Email, [Security.SecureString]$Password)
    $credential = New-Object System.Net.NetworkCredential('', $Password)
    $body = @{ email = $Email; password = $credential.Password; returnSecureToken = $true }
    try {
        $login = Invoke-BridgeHttp "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$($Config.firebaseApiKey)" 'POST' $body 'Sign in'
    } finally {
        $body.password = $null
        $credential = $null
    }
    $script:Auth = @{ idToken = $login.idToken; refreshToken = $login.refreshToken; uid = $login.localId; expires = [DateTime]::UtcNow.AddSeconds([int]$login.expiresIn - 120) }
    $account = Invoke-BridgeHttp "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=$($Config.firebaseApiKey)" 'POST' @{ idToken = $script:Auth.idToken } 'Account verification'
    if (-not $account.users -or $account.users[0].emailVerified -ne $true) { throw 'Email is not verified. Verify it before starting the bridge.' }
    $profile = Invoke-BridgeHttp "$($Config.databaseUrl)/users/$($script:Auth.uid).json?auth=$($script:Auth.idToken)" 'GET' $null 'Read CMMS permissions'
    if ($profile.role -notin @('admin', 'manager', 'technician')) { throw 'This account does not have permission to send CMMS telemetry.' }
    Write-Host 'Verified CMMS account accepted. Password is not saved.'
}
function Update-BridgeToken {
    param($Config)
    if ([DateTime]::UtcNow -lt $script:Auth.expires) { return }
    $body = @{ grant_type = 'refresh_token'; refresh_token = $script:Auth.refreshToken }
    $renewed = Invoke-BridgeHttp "https://securetoken.googleapis.com/v1/token?key=$($Config.firebaseApiKey)" 'POST' $body 'Token refresh' 'application/x-www-form-urlencoded'
    $script:Auth.idToken = $renewed.id_token
    $script:Auth.refreshToken = $renewed.refresh_token
    $script:Auth.expires = [DateTime]::UtcNow.AddSeconds([int]$renewed.expires_in - 120)
}
function Send-BridgePatch {
    param($Config, $Payload)
    Update-BridgeToken $Config
    # Patch one machine only; never replace /cncs or touch other CMMS data.
    $uri = "$($Config.databaseUrl)/cncs/$($Config.machineId).json?auth=$($script:Auth.idToken)"
    $null = Invoke-BridgeHttp $uri 'PATCH' $Payload 'Send telemetry'
}
function Initialize-BridgeAlarmHistory {
    param([string]$Folder, [string]$MachineId, [string]$Uid)
    $script:AlarmStatePath = Join-Path $Folder ('alarms-' + $MachineId + '-' + $Uid + '.json')
    $script:AlarmActive = @{}; $script:AlarmPending = @{}
    if (Test-Path -LiteralPath $script:AlarmStatePath) {
        $saved = Get-Content -LiteralPath $script:AlarmStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($saved.machineId -ne $MachineId -or $saved.uid -ne $Uid) { throw 'Alarm outbox identity mismatch.' }
        foreach ($entry in $saved.active.PSObject.Properties) { $script:AlarmActive[$entry.Name] = $entry.Value }
        foreach ($entry in $saved.pending.PSObject.Properties) { $script:AlarmPending[$entry.Name] = $entry.Value }
    }
    $script:AlarmMachineId=$MachineId; $script:AlarmUid=$Uid
}
function Save-BridgeAlarmHistory {
    $state=@{machineId=$script:AlarmMachineId;uid=$script:AlarmUid;active=$script:AlarmActive;pending=$script:AlarmPending}
    $temporary=$script:AlarmStatePath+'.tmp'
    $state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $script:AlarmStatePath -Force
}
function Add-BridgeAlarmSample {
    param($Config, $Snapshot)
    # Failed/partial reads must never close an alarm or invent a cleared state.
    if ($Snapshot.alarmDetailsRead -ne $true) { return }
    $seen=@{}; $changed=$false
    foreach ($detail in $Snapshot.alarmDetails) {
        $key='{0}_{1}_{2}' -f $detail.type,$detail.number,$detail.axis
        $seen[$key]=$true
        if ($script:AlarmActive.ContainsKey($key)) { continue }
        $id='focas-'+[Guid]::NewGuid().ToString('N')
        $record=@{id=$id;cncId=$Config.machineId;cncName=$Config.machineName;timestamp=$Snapshot.timestampUtc;
            alarmCode=[string]$detail.number;alarmType=[int]$detail.type;axis=[int]$detail.axis;
            description=[string]$detail.message;activeProgram=$Snapshot.activeProgram;mainProgram=$Snapshot.mainProgram;machiningContext=$Snapshot.machiningContext;source='focas';uid=$script:AlarmUid;observedBy='cnc_rdalmmsg2'}
        $script:AlarmActive[$key]=$record; $script:AlarmPending[$id]=$record; $changed=$true
    }
    if ($Snapshot.alarmsMayBeTruncated -ne $true) {
        foreach ($key in @($script:AlarmActive.Keys)) {
            if ($seen.ContainsKey($key)) { continue }
            $active=$script:AlarmActive[$key]; $closed=@{}
            if ($active -is [Collections.IDictionary]) { foreach($name in $active.Keys){$closed[$name]=$active[$name]} }
            else { foreach($field in $active.PSObject.Properties){$closed[$field.Name]=$field.Value} }
            $closed.resolvedAt=$Snapshot.timestampUtc
            $closed.resolutionSource='Alarm no longer returned by a successful CNC read; repair not confirmed'
            $script:AlarmPending[$closed.id]=$closed; $script:AlarmActive.Remove($key); $changed=$true
        }
    }
    if ($changed) { Save-BridgeAlarmHistory }
}
function Send-PendingBridgeAlarms {
    param($Config)
    if (-not $script:AlarmPending.Count) { return }
    Update-BridgeToken $Config
    $sent=0
    foreach($id in @($script:AlarmPending.Keys)) {
        $uri="$($Config.databaseUrl)/cncAlarms/$id.json?auth=$($script:Auth.idToken)"
        $null=Invoke-BridgeHttp $uri 'PATCH' $script:AlarmPending[$id] 'Save CNC alarm history'
        $script:AlarmPending.Remove($id)
        Save-BridgeAlarmHistory
        Write-Host ('ALARM HISTORY SAVED: '+$id)
        $sent++; if($sent -ge 10){break}
    }
}
function Apply-BridgeMachiningProfile {
    param($Config,$Record)
    $profile='unverified'
    if($null -ne $Record -and $Record.machineKind -eq 'mill-3axis' -and $Record.offsetTable -in @('m-a','m-b','m-c') -and $Record.offsetProfileConfirmed -is [bool] -and $Record.offsetProfileConfirmed){$profile='verified-fanuc-m-3axis-memory-'+$Record.offsetTable.Substring(2)}
    if(-not $Config.PSObject.Properties['machiningContextProfile']){$Config|Add-Member -NotePropertyName machiningContextProfile -NotePropertyValue $profile}
    else{$Config.machiningContextProfile=$profile}
    $table=if($profile -ne 'unverified'){$Record.offsetTable}else{'unverified'}
    if(-not $Config.PSObject.Properties['offsetTable']){$Config|Add-Member -NotePropertyName offsetTable -NotePropertyValue $table}else{$Config.offsetTable=$table}
}
function Set-BridgePhase([string]$Phase){
    if(-not $BackgroundAfterLogin){return}
    [void](Write-BridgeStateFile (Join-Path $DataDirectory 'bridge-state.json') @{at=[DateTime]::UtcNow.ToString('o');phase=$Phase;uploaded=$false;sessionId=$SessionId})
}
function Read-BridgeStdinCredential([string]$ExpectedMachineId){
 $line=$null;$json=$null;$entry=$null
 try{
  $line=[Console]::In.ReadLine()
  if(-not $line -or $line.Length -gt 65536){throw 'Không nhận được tài khoản từ Manager. Mở tab Đăng nhập CMMS và chạy lại.'}
  try{$json=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line));$entry=$json|ConvertFrom-Json -ErrorAction Stop}catch{throw 'Gói tài khoản từ Manager không hợp lệ.'}
  if($entry.version -ne 1 -or $entry.machineId -cne $ExpectedMachineId -or -not ([string]$entry.email).Trim() -or ([string]$entry.email).Length -gt 254 -or -not $entry.password -or ([string]$entry.password).Length -gt 2048){throw 'Tài khoản từ Manager không đúng máy hoặc thiếu thông tin.'}
  $secure=ConvertTo-SecureString ([string]$entry.password) -AsPlainText -Force
  return New-Object Management.Automation.PSCredential(([string]$entry.email).Trim(),$secure)
 }finally{if($entry){$entry.password=$null};$entry=$null;$json=$null;$line=$null}
}
function Read-BridgeGuiCredential([string]$MachineName){
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $dialog=New-Object Windows.Forms.Form;$dialog.Text='LTD · Đăng nhập cầu nối';$dialog.Size=New-Object Drawing.Size(460,335);$dialog.StartPosition='CenterScreen';$dialog.FormBorderStyle='FixedDialog';$dialog.MaximizeBox=$false;$dialog.MinimizeBox=$false;$dialog.ShowInTaskbar=$true;$dialog.TopMost=$true;$dialog.Font=New-Object Drawing.Font('Segoe UI',10)
    $title=New-Object Windows.Forms.Label;$title.Text=$MachineName;$title.AutoEllipsis=$true;$title.SetBounds(20,18,410,30);$title.Font=New-Object Drawing.Font('Segoe UI',14,[Drawing.FontStyle]::Bold);$dialog.Controls.Add($title)
    $label=New-Object Windows.Forms.Label;$label.Text='Tài khoản CMMS trên website · Mật khẩu không lưu';$label.SetBounds(20,53,410,25);$dialog.Controls.Add($label)
    $emailLabel=New-Object Windows.Forms.Label;$emailLabel.Text='Email CMMS';$emailLabel.SetBounds(20,81,405,23);$dialog.Controls.Add($emailLabel)
    $passwordLabel=New-Object Windows.Forms.Label;$passwordLabel.Text='Mật khẩu';$passwordLabel.SetBounds(20,150,405,23);$dialog.Controls.Add($passwordLabel)
    $email=New-Object Windows.Forms.TextBox;$email.Name='BridgeEmail';$email.SetBounds(20,105,405,30);$dialog.Controls.Add($email)
    $password=New-Object Windows.Forms.TextBox;$password.UseSystemPasswordChar=$true;$password.SetBounds(20,174,405,30);$dialog.Controls.Add($password)
    $submit=New-Object Windows.Forms.Button;$submit.Text='Đăng nhập và kết nối';$submit.SetBounds(200,238,225,37);$submit.DialogResult='OK';$dialog.Controls.Add($submit);$dialog.AcceptButton=$submit
    $dialog.AccessibleDescription='Ô đầu là email CMMS. Ô thứ hai là mật khẩu.';$email.AccessibleName='Email CMMS';$password.AccessibleName='Mật khẩu'
    $dialog.Tag=$StopRequestPath
    $dialog.Add_Shown({param($sender,$eventArgs);$sender.Activate();$sender.Controls['BridgeEmail'].Focus()})
    $cancelTimer=New-Object Windows.Forms.Timer;$cancelTimer.Interval=500;$cancelTimer.Add_Tick({if($dialog.Tag -and (Test-Path -LiteralPath $dialog.Tag)){$dialog.Close()}}.GetNewClosure());$cancelTimer.Start()
    try{if($dialog.ShowDialog() -ne 'OK'){throw [OperationCanceledException]::new('Đã hủy đăng nhập.')};if(-not $email.Text.Trim() -or -not $password.Text){throw 'Nhập email và mật khẩu CMMS.'};$secure=ConvertTo-SecureString $password.Text -AsPlainText -Force;$user=$email.Text.Trim();$password.Clear();return New-Object Management.Automation.PSCredential($user,$secure)}finally{$cancelTimer.Stop();$cancelTimer.Dispose();$password.Clear();$dialog.Dispose()}
}
function New-BridgePayload {
    param($Snapshot)
    $state = 'unknown'
    if ($Snapshot.rawStatus.emergency -ne 0 -or $Snapshot.rawStatus.alarm -ne 0) { $state = 'alarm' }
    elseif ($Snapshot.rawStatus.run -eq 3) { $state = 'running' }
    elseif ($Snapshot.rawStatus.run -eq 2) { $state = 'hold' }
    elseif ($Snapshot.rawStatus.run -in @(0, 1, 4)) { $state = 'idle' }
    $alarm = if ($Snapshot.rawStatus.alarm -ne 0 -or $Snapshot.rawStatus.emergency -ne 0) { 'Có tín hiệu Alarm/Emergency; xem chi tiết nếu CNC hỗ trợ.' } else { '' }
    return @{
        source = 'focas'; connected = $true; status = $state; lastSeen = @{ '.sv' = 'timestamp' }
        sampledAt = $Snapshot.timestampUtc; rawStatus = $Snapshot.rawStatus
        controllerInfo = @{ machineType=$Snapshot.machineType;cncType = $Snapshot.cncType; series = $Snapshot.series; version = $Snapshot.version; axes = $Snapshot.axes }
        alarm = $alarm
        alarmDetails = $Snapshot.alarmDetails; alarmDetailsRead = ($Snapshot.alarmDetailsRead -eq $true); alarmsMayBeTruncated = ($Snapshot.alarmsMayBeTruncated -eq $true)
        activeProgram = $Snapshot.activeProgram; mainProgram = $Snapshot.mainProgram; machiningContext = $Snapshot.machiningContext
        spindleLoad=$Snapshot.spindleLoad;spindleLoadName=$Snapshot.spindleLoadName;spindleSpeed = $Snapshot.spindleSpeed; spindleUnit = $Snapshot.spindleUnit
        feedrate = $Snapshot.feedrate; feedrateUnit = $Snapshot.feedrateUnit
        fullProgram=$Snapshot.fullProgram;fullProgramVerifiedAt=$Snapshot.fullProgram.sampledAtUtc
        modalGcodes=$Snapshot.modalGcodes;modalGcodesComplete=($Snapshot.modalGcodesComplete -eq $true);workCoordinates=$Snapshot.workCoordinates;toolOffsets=$Snapshot.toolOffsets
        positions=$Snapshot.positions;servoLoads=$Snapshot.servoLoads;sequenceNumber=$Snapshot.sequenceNumber;programText=$Snapshot.programText;programBufferBlock=$Snapshot.programBufferBlock;programTextLimited=($Snapshot.programTextLimited -eq $true)
        readErrors = $Snapshot.readErrors; partCounter = $Snapshot.partCounter
        reportingVersion = 2; runTimeMs = $Snapshot.runTimeMs; cycleTimeMs = $Snapshot.cycleTimeMs; timerSource = $Snapshot.timerSource; readerMode = 'focas-status-only'; pmcEnabled = $false; cycleStartBit = $null; m30Bit = $null; pmcStatus = $null
        # Setpoints, override and current NC block are not read by this bridge.
        currentBlock = $null; targetSpindleSpeed = $null; targetFeedrate = $null; override = $null
    }
}
try {
    if($CredentialFromStdin){$BackgroundAfterLogin=$true}
    if (-not [Environment]::Is64BitProcess) { throw 'Use 64-bit Windows PowerShell, not PowerShell (x86).' }
    $null=New-Item -ItemType Directory -Path $DataDirectory -Force
    if(-not $SessionId){$SessionId=[Guid]::NewGuid().ToString('N')}
    if($SessionId -cnotmatch '^[a-f0-9]{32}$'){throw 'Invalid local bridge session ID.'}
    $script:SessionLogPath=Join-Path $DataDirectory ('bridge-session-'+$SessionId+'.log')
    $script:StartupLogPath=Join-Path $DataDirectory ('bridge-startup-error-'+$SessionId+'.log')
    $config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $config.PSObject.Properties['partsPerCount']){$config|Add-Member -NotePropertyName partsPerCount -NotePropertyValue 1}
    if(-not $config.PSObject.Properties['partCounterVerified']){$config|Add-Member -NotePropertyName partCounterVerified -NotePropertyValue $false}
    if ($config.machineId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'Invalid machineId.' }
    $ip = $null
    if (-not [Net.IPAddress]::TryParse([string]$config.cncIp, [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Invalid CNC IPv4 address.' }
    if ([int]$config.port -lt 1 -or [int]$config.port -gt 65535) { throw 'Invalid CNC port.' }
    if ([int]$config.intervalSeconds -lt 3 -or [int]$config.intervalSeconds -gt 10) { throw 'Choose an interval between 3 and 10 seconds.' }
    # Pin credential and telemetry destinations to this CMMS Firebase project.
    if ($config.databaseUrl -cne 'https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app') { throw 'Unexpected database URL. No credentials will be sent.' }
    if ($config.firebaseApiKey -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid Firebase Web API key.' }
    # Show credentials before loading native DLLs or waiting on ANY CNC read.
    if($BackgroundAfterLogin -and -not $LocalOnly){
        if($CredentialFromStdin){Set-BridgePhase 'receiving-account';$credential=Read-BridgeStdinCredential $config.machineId}else{Set-BridgePhase 'login';$credential=Read-BridgeGuiCredential $config.machineName}
        $email=$credential.UserName;$password=$credential.Password
        Set-BridgePhase 'loading-reader'
    }
    if (-not ('FanucReader' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'FanucReader.cs') }
    if (-not ([FanucReader].GetProperty('ReaderBuild')) -or [FanucReader]::ReaderBuild -ne '20261109-spindle-meters' -or -not ([FanucReader].GetProperty('AccessMode')) -or [FanucReader]::AccessMode -ne 'FOCAS_STATUS_ONLY_V1' -or -not ([FanucReader].GetMethods()|Where-Object {$_.Name -eq 'ReadWithContext' -and $_.GetParameters().Count -eq 5})) { throw 'Old reader loaded. CLOSE this PowerShell window and open a new one. The new bridge refuses to reuse the previous reader.' }
    Write-Host "Bridge build: 20261109-state-io"
    Write-Host "Machine: $($config.machineName) | CNC $($config.cncIp):$($config.port)"
    Write-Host 'Read-only CNC access. Reading status, actual spindle/feed and current/main O-number. Reading alarm messages with cnc_rdalmmsg2; no PMC access or CNC writes.'
    Write-Host 'HD.T / NX.T via cnc_rdhdnxt. Read-only G modal, work coordinates and confirmed offset tables; no PMC.'
    # Manual mode retains its initial CNC check. Manager mode prompts first and reads in the loop after auth.
    $sample=$null
    if(-not $BackgroundAfterLogin){$sample = [FanucReader]::ReadWithContext([string]$config.cncIp, [uint16]$config.port, $LibraryDirectory,($config.machiningContextProfile -match '^verified-fanuc-m-3axis-memory-[abc]$'),([string]$config.offsetTable))}
    if (-not $LocalOnly) {
        if(-not $BackgroundAfterLogin){
        $email = Read-Host 'CMMS email (the same verified account used on the website)'
        $password = Read-Host 'CMMS password (hidden; never saved)' -AsSecureString
        }
        Set-BridgePhase 'authenticating'
        try { Connect-BridgeAccount $config $email $password } finally { if ($password) { $password.Dispose(); $password = $null } }
        Set-BridgePhase 'checking-account'
        Update-BridgeToken $config
        $existing = Invoke-BridgeHttp "$($config.databaseUrl)/cncs/$($config.machineId).json?auth=$($script:Auth.idToken)" 'GET' $null 'Check machine identity'
        if ($null -ne $existing) {
            if (($existing -isnot [pscustomobject] -and $existing -isnot [Collections.IDictionary]) -or
                $existing.id -ne $config.machineId -or $existing.name -ne $config.machineName) {
                Write-Host ('Existing machine: id={0}; name={1}; source={2}' -f $existing.id, $existing.name, $existing.source)
                throw 'Machine identity differs from bridge-config.json. Nothing was overwritten. Send only the Existing machine line for diagnosis.'
            }
        }
        if($config.configurationSource -eq 'bridge-manager'){
            $metadata=@{machineKind=$config.machineKind;orientation=$config.orientation;machineTemplate=$config.machineTemplate;axisNames=$config.axisNames;declaredAxisCount=$config.declaredAxisCount;spindleCount=$config.spindleCount;offsetTable=$config.offsetTable;offsetProfileConfirmed=($config.offsetProfileConfirmed -is [bool] -and $config.offsetProfileConfirmed);configurationSource='bridge-manager'}
            Send-BridgePatch $config $metadata
            Apply-BridgeMachiningProfile $config $config
        } else {Apply-BridgeMachiningProfile $config $existing}
        $script:ProfileCheckedAt=[DateTime]::UtcNow
        if($config.partsPerCount -lt 1 -or $config.partsPerCount -gt 1000 -or [double]$config.partsPerCount -ne [Math]::Truncate([double]$config.partsPerCount)){throw 'partsPerCount must be an integer from 1 to 1000.'}
        Initialize-CncReports (Join-Path $DataDirectory 'report-outbox') $config.machineId $script:Auth.uid $config
        Initialize-BridgeAlarmHistory (Join-Path $DataDirectory 'report-outbox') $config.machineId $script:Auth.uid
        $reportingStarted = $true
        Send-BridgePatch $config @{ id = $config.machineId; name = $config.machineName; ip = $config.cncIp; port = [int]$config.port; model = $config.model; source = 'focas'; connected = $false; status = 'offline' }
        $machineRegistered = $true
        $sample = $null # Authentication may take minutes; never upload that old initial sample.
    }
    if($BackgroundAfterLogin){$logPath=$script:SessionLogPath;if((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 5MB){Move-Item -LiteralPath $logPath -Destination ($logPath+'.previous') -Force};$null=Start-Transcript -LiteralPath $script:SessionLogPath -Append; $script:BridgeTranscript=$true}
    Write-Host 'Bridge active. Use Manager to stop background bridge, or Ctrl+C in manual mode.'
    do {
        if($BackgroundAfterLogin -and $script:BridgeTranscript -and (Get-Item -LiteralPath $script:SessionLogPath).Length -gt 5MB){Stop-Transcript|Out-Null;$logPath=$script:SessionLogPath;Move-Item -LiteralPath $logPath -Destination ($logPath+'.previous') -Force;$null=Start-Transcript -LiteralPath $logPath}
        if($StopRequestPath -and (Test-Path -LiteralPath $StopRequestPath)){Write-Host 'Bridge stop requested by manager.';break}
        if ($null -eq $sample) {
            if(-not $LocalOnly -and ([DateTime]::UtcNow-$script:ProfileCheckedAt).TotalSeconds -ge 60){
                try{Update-BridgeToken $config;$record=Invoke-BridgeHttp "$($config.databaseUrl)/cncs/$($config.machineId).json?auth=$($script:Auth.idToken)" 'GET' $null 'Refresh machine profile';Apply-BridgeMachiningProfile $config $record}
                catch{Apply-BridgeMachiningProfile $config $null}
                $script:ProfileCheckedAt=[DateTime]::UtcNow
            }
            Set-BridgePhase 'reading-cnc'
            try { $sample = [FanucReader]::ReadWithContext([string]$config.cncIp, [uint16]$config.port, $LibraryDirectory,($config.machiningContextProfile -match '^verified-fanuc-m-3axis-memory-[abc]$'),([string]$config.offsetTable)) }
            catch {
                if($reportingStarted){Break-CncReportObservation}
                Set-BridgePhase 'retrying-cnc'
                Write-Warning ('CNC read failed: ' + $_.Exception.GetBaseException().Message)
                if (-not $LocalOnly) { try { Send-BridgePatch $config @{ source = 'focas'; connected = $false; status = 'offline' } } catch { Write-Warning $_.Exception.Message } }
                if ($Once) { throw 'CNC sample was not obtained.' }
            }
        }
        if ($null -ne $sample) {
            if($reportingStarted){
                Add-CncReportSample $sample
                try { Add-BridgeAlarmSample $config $sample } catch { Write-Warning ('Alarm local save failed: '+$_.Exception.Message) }
                try { Send-PendingBridgeAlarms $config } catch { Write-Warning ('Alarm history upload failed; retained locally: '+$_.Exception.Message) }
            }
            $payload = New-BridgePayload $sample
            # A cached complete file is large: patch its content only when the content hash/program changes.
            $programKey=if($sample.fullProgram){$sample.fullProgram.program+':'+$sample.fullProgram.sha256}else{''}
            if($script:UploadedProgramKey -and $script:UploadedProgramKey -ceq $programKey){$payload.Remove('fullProgram')}

            $uploaded = $false
            if (-not $LocalOnly) {
                try { Send-BridgePatch $config $payload; $uploaded = $true;$script:UploadedProgramKey=$programKey }
                catch { Write-Warning $_.Exception.Message; if ($Once) { throw } }
            }
            $sample | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $DataDirectory 'last-result.json') -Encoding UTF8
            if ($sample.readErrors -and $sample.readErrors.Count -gt 0) {
                foreach ($item in $sample.readErrors.GetEnumerator()) { Write-Warning ("Telemetry {0}: {1}" -f $item.Key, $item.Value) }
            }
            if($BackgroundAfterLogin){[void](Write-BridgeStateFile (Join-Path $DataDirectory 'bridge-state.json') @{at=[DateTime]::UtcNow.ToString('o');phase='active';uploaded=$uploaded;run=$sample.rawStatus.run;alarm=$sample.rawStatus.alarm;program=$sample.activeProgram;sessionId=$SessionId})}
            $destination = if ($LocalOnly) { 'LOCAL ONLY - not uploaded' } elseif ($uploaded) { 'FIREBASE UPDATED' } else { 'UPLOAD FAILED - will retry' }
            Write-Host ("{0} | {1} | RUN={2} ALARM={3} EMERGENCY={4}" -f (Get-Date -Format 'HH:mm:ss'), $destination, $sample.rawStatus.run, $sample.rawStatus.alarm, $sample.rawStatus.emergency)
            Write-Host ("Spindle={0} {1} | Feed={2} {3} | Program={4} | Main={5}" -f $sample.spindleSpeed, $sample.spindleUnit, $sample.feedrate, $sample.feedrateUnit, $sample.activeProgram, $sample.mainProgram)
        }
        if($reportingStarted){try{Send-PendingCncReports $config -Force:$Once}catch{Write-Warning ('Report upload failed; saved locally. '+$_.Exception.Message)}}
        $sample = $null
        if (-not $Once) { Start-Sleep -Seconds ([int]$config.intervalSeconds) }
    } while (-not $Once)
 } catch {
    $failure=$_.Exception.GetBaseException()
    if($failure -is [OperationCanceledException]){
        $script:BridgeFailed=$false
        Write-Host 'Đã hủy đăng nhập. Cầu nối chưa kết nối CNC.'
    }else{
        try{[IO.File]::WriteAllText($script:StartupLogPath,('BRIDGE STOPPED: '+$failure.Message),[Text.UTF8Encoding]::new($false))}catch{}
        try{[Console]::Error.WriteLine('BRIDGE STOPPED: ' + $failure.Message)}catch{}
        $script:BridgeFailed=$true
        try{Set-BridgePhase 'failed'}catch{}
        if($BackgroundAfterLogin -and -not $CredentialFromStdin){try{Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show($failure.Message,'LTD · Cầu nối đã dừng','OK','Error')}catch{}}
    }
} finally {
    # On an orderly stop try to publish offline; forced closure is covered by the web's 30s expiry.
    if ($script:Auth -and $machineRegistered -and -not $LocalOnly) {
        try { Send-BridgePatch $config @{ connected = $false; status = 'offline' } } catch { }
    }
    if($reportingStarted){Finish-CncCycle 'Dừng cầu nối; chưa biết kết thúc' $null;try{Send-PendingCncReports $config -Force}catch{ };Close-CncReports}
    if($password){$password.Dispose();$password=$null}
    if(-not $script:BridgeFailed){try{Set-BridgePhase 'stopped'}catch{}}
    $script:Auth = $null
    if($script:BridgeTranscript){try{Stop-Transcript|Out-Null}catch{}}
}
if ($script:BridgeFailed) { exit 1 }
