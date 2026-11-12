$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/ltd-cmms-offline'
Add-Type -Path (Join-Path $root 'LocalHost.cs')
. (Join-Path $root 'Offline.Core.ps1')
function Assert($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('offline-account-'+[Guid]::NewGuid().ToString('N'))
try{
 Initialize-OfflineStore $folder
 foreach($length in @(12,13,32,128)){
  $secret=('x'*($length-2))+'9!';$account=New-OfflineAccount -Email ('fixture'+$length+'@example.com') -Name 'Fixture' -Password $secret -Role 'admin'
  Assert ([OfflineCrypto]::Verify($secret,$account.passwordHash)) ('Password length rejected: '+$length)
  Assert (-not ([IO.File]::ReadAllText($script:AccountsPath)).Contains($secret)) 'Plaintext password persisted'
 }
 $before=$script:Accounts.Count
 foreach($length in @(0,11,129)){
  $failed=$false;try{$null=New-OfflineAccount -Email 'invalid-length@example.com' -Name 'Fixture' -Password ('x'*$length) -Role 'admin'}catch{$failed=$true;Assert ($_.Exception.Message -eq 'INVALID_PASSWORD') 'Wrong password validation message'}
  Assert $failed 'Invalid password accepted';Assert ($script:Accounts.Count -eq $before) 'Invalid setup mutated account store'
 }
 $errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'Windows.Gui.ps1'),[ref]$tokens,[ref]$errors);Assert (-not $errors.Count) 'Invalid GUI syntax'
 $gui=[IO.File]::ReadAllText((Join-Path $root 'Windows.Gui.ps1'))
 Assert ($gui.Contains('OfflineAdminConfirm') -and $gui.Contains('ShowDialog()') -and $gui.Contains('Get-OfflineAccountError')) 'Setup form lacks confirmation/error handling'
 $sensitive='fixture-secret-never-log'
 try{throw [IO.IOException]::new('Simulated storage failure '+$sensitive)}catch{$message=Get-OfflineAccountError $_ $sensitive}
 Assert ($message -match 'Không lưu được') 'Storage error mislabeled password error'
 Assert (-not ([IO.File]::ReadAllText((Join-Path $folder 'account-setup-error.log'))).Contains($sensitive)) 'Password appeared in diagnostics'
 Write-Output 'PASS: first-account passwords 12/13/32/128, invalid lengths rejected, hashes verified, no plaintext persistence/logging, setup confirmation and PS syntax. No Windows GUI execution.'
}finally{if(Test-Path -LiteralPath $folder){Remove-Item -LiteralPath $folder -Recurse -Force}}
