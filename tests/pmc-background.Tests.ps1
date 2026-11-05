$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/fanuc-pmc-background'
function Assert($ok,$message){if(-not $ok){throw $message}}
foreach($file in Get-ChildItem $root -Filter '*.ps1'){
 $errors=$null;$tokens=$null;$null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors)
 Assert ($errors.Count -eq 0) ('Syntax error: '+$file.Name)
 $source=Get-Content $file.FullName -Raw
 Assert (-not ($source -match 'Invoke-RestMethod|Invoke-WebRequest|firebaseApiKey|refresh_token|idToken|ExecutionPolicy\s+Bypass|ExecutionPolicy\s+Unrestricted')) ('Unexpected web/auth/policy-bypass code: '+$file.Name)
}
Add-Type -Path (Join-Path $root 'PmcReadOnlyProbe.cs')
$imports=@()
foreach($method in [PmcReadOnlyProbe].GetMethods([Reflection.BindingFlags]'NonPublic,Static')){
 foreach($attribute in $method.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute],$false)){if($attribute.Value -eq 'Fwlib64.dll'){$imports+=$method.Name}}
}
Assert (($imports|Sort-Object) -join ',' -eq 'cnc_allclibhndl3,cnc_freelibhndl,pmc_rdpmcrng') 'Unexpected native function'
$original=Join-Path (Split-Path $root -Parent) 'fanuc-pmc-readonly-test/PmcReadOnlyProbe.cs'
Assert ((Get-FileHash $original).Hash -eq (Get-FileHash (Join-Path $root 'PmcReadOnlyProbe.cs')).Hash) 'Reader differs from tested fixed-address probe'
. (Join-Path $root 'Background-Common.ps1')
$folder=Join-Path ([IO.Path]::GetTempPath()) ('pmc-lock-test-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
try{
 Assert (-not (Test-LtdBackgroundRunning $folder)) 'New folder considered running'
 $lock=[IO.File]::Open((Join-Path $folder '.background.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 try{Assert (Test-LtdBackgroundRunning $folder) 'Running reader lock not detected'}finally{$lock.Dispose()}
 Assert (-not (Test-LtdBackgroundRunning $folder)) 'Stopped lock file considered active'
 Stop-LtdBackground $folder
 Assert (Test-Path (Join-Path $folder 'background.stop')) 'Stop marker not persisted'
}finally{Remove-Item $folder -Recurse -Force}
Write-Output 'PASS: all PS scripts parse; no web/auth/policy-bypass APIs; unchanged fixed-address native allowlist; duplicate-run lock and persistent stop marker.'
