$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/ltd-cmms-offline';$desktop=Join-Path $root 'desktop'
Add-Type -Path (Join-Path $desktop 'Desktop.Primitives.cs')
. (Join-Path $root 'Offline.Core.ps1');. (Join-Path $desktop 'Desktop.Core.ps1');. (Join-Path $desktop 'Desktop.Export.ps1');. (Join-Path $desktop 'Desktop.Views.ps1')
function Assert($Value,$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('ltd-desktop-test-'+[Guid]::NewGuid().ToString('N'))
try{
 Initialize-OfflineStore $folder
 $admin=New-OfflineAccount 'admin@fixture.local' 'Fixture Admin' 'fixture-password-123' 'admin'
 $viewer=New-OfflineAccount 'viewer@fixture.local' 'Fixture Viewer' 'viewer-fixture-pass' 'viewer'
 $script:DesktopCookie='';$script:DesktopCsrf='';$script:DesktopUser=$null
 $null=Invoke-DesktopApi '/api/login' 'POST' @{email='admin@fixture.local';password='fixture-password-123'}
 Assert (Test-DesktopEdit) 'Admin not recognized'
 $null=Save-DesktopRecord 'items' @{id='item';name='Cảm biến';sku='000123';quantity=10;min=2;category='Điện';specs='=1+2';note='=not a formula'}
 $null=Add-DesktopMovement 'item' 'in' 3 'Nhập thử';Assert ($script:Database.items.item.quantity -eq 13) 'Inventory/movement not atomic'
 $null=Add-DesktopMovement 'item' 'out' 2 'Xuất thử';Assert ($script:Database.items.item.quantity -eq 11 -and $script:Database.stockMovements.Count -eq 2) 'Stock after movement wrong'
 $failed=$false;try{$null=Add-DesktopMovement 'item' 'out' 100 'too much'}catch{$failed=$true};Assert $failed 'Negative stock allowed';Assert ($script:Database.items.item.quantity -eq 11) 'Failed movement mutated stock'
 $null=Save-DesktopRecord 'machines' @{id='machine';name='Máy fixture'}
 $null=Save-DesktopRecord 'maintenanceJobs' @{id='job';machineId='machine';machineName='Máy fixture';jobName='Thay dầu';nextDate='2026-01-31';recurrence='monthly';owner='Fixture';desc='Checklist'}
 Complete-DesktopJob 'job';Assert ($script:Database.maintenanceJobs.job.nextDate -eq '2026-02-28') 'Calendar renewal wrong';Assert ($script:Database.repairHistory.Count -eq 1) 'Completion history not saved'
 $choices=Get-DesktopChoices 'machine';Assert ($choices[0][0] -eq 'machine' -and $choices[0][1] -eq 'Máy fixture') 'Machine choices flattened or lost IDs'
 Assert ((Get-DesktopRecurrence @{period=3}) -eq 'quarterly') 'Legacy recurrence lost'
 $rows=Get-DesktopRows 'inventory';Assert ($rows.Count -eq 1 -and $rows[0].Sku -ceq '000123') 'Rows lost SKU or array shape'
 $path=Join-Path ([IO.Path]::GetTempPath()) 'ltd-desktop-native.xlsx'
 Write-DesktopWorkbook $path 'TỒN KHO LINH KIỆN' (Get-DesktopDefinitions 'inventory') $rows (Join-Path (Split-Path (Split-Path $root -Parent) -Parent) 'logo.jpg') 'Fixture'
 Assert (Test-Path -LiteralPath $path) 'No native XLSX file'
 Write-DesktopWorkbook (Join-Path ([IO.Path]::GetTempPath()) 'ltd-desktop-empty.xlsx') 'BẢNG TRỐNG' (Get-DesktopDefinitions 'inventory') @() '' 'Fixture'
 $null=Invoke-DesktopApi '/api/login' 'POST' @{email='viewer@fixture.local';password='viewer-fixture-pass'}
 Assert (-not (Test-DesktopEdit)) 'Viewer can edit'
 $script:Database.stockMovements.future=@{id='future';at='2027-01-01T00:00:00Z';type='in'};$script:Database.stockMovements.december=@{id='december';at='2026-12-31T00:00:00Z';type='in'}
 $moves=Get-DesktopRows 'movements';Assert ($moves[0].Id -eq 'future') 'Movement sort uses formatted dates rather than timestamps'
 $before=ConvertTo-Json -InputObject $script:Database -Depth 100 -Compress
 foreach($action in @({Save-DesktopRecord 'items' @{id='bad'}},{Add-DesktopMovement 'item' 'in' 1 ''},{Complete-DesktopJob 'job'})){$failed=$false;try{& $action}catch{$failed=$true};Assert $failed 'Viewer mutation not rejected'}
 Assert ($before -ceq (ConvertTo-Json -InputObject $script:Database -Depth 100 -Compress)) 'Viewer changed database'
 $null=Invoke-DesktopApi '/api/logout' 'POST' @{}
 $failed=$false;try{$null=Invoke-DesktopApi '/api/session'}catch{$failed=$true};Assert $failed 'Session survived logout'
 foreach($file in Get-ChildItem -LiteralPath $desktop -Filter '*.ps1'){$errors=$null;$tokens=$null;[void][Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors);Assert (-not $errors.Count) ('PS syntax error '+$file.Name+': '+($errors|Out-String))}
 [xml]$xaml=[IO.File]::ReadAllText((Join-Path $desktop 'Desktop.xaml'));$names=@{};foreach($node in $xaml.GetElementsByTagName('*')){$name=$node.GetAttribute('Name','http://schemas.microsoft.com/winfx/2006/xaml');if($name){Assert (-not $names.ContainsKey($name)) 'Duplicate XAML name';$names[$name]=$true}}
 $main=[IO.File]::ReadAllText((Join-Path $desktop 'Desktop.Main.ps1'));foreach($match in [regex]::Matches($main,'DesktopUi\.([A-Za-z][A-Za-z0-9]*)')){Assert $names.ContainsKey($match.Groups[1].Value) ('Missing XAML control '+$match.Groups[1].Value)}
 Assert ($main -notmatch 'OfflineHost|TcpListener|localhost|Start-Process.*http') 'Desktop starts a browser/HTTP host'
 Write-Output 'PASS: native desktop business/storage/session/permissions, atomic stock and maintenance renewal, XLSX generation, XAML control references and script syntax. No WPF GUI or CNC execution.'
}finally{if(Test-Path -LiteralPath $folder){Remove-Item -LiteralPath $folder -Recurse -Force}}
