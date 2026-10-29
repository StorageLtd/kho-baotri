$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$path=Join-Path $root 'tools/fanuc-bridge/FanucReader.cs'
$source=Get-Content $path -Raw
if($source -match 'pmc_rd|StartPmc|MonitorPmc|System.Threading|Task.Run'){throw 'Unexpected PMC/background reader code'}
Add-Type -Path $path
if([FanucReader]::AccessMode -ne 'FOCAS_STATUS_ONLY_V1'){throw 'Wrong reader version'}
$allowed=@('cnc_allclibhndl3','cnc_sysinfo','cnc_statinfo','cnc_freelibhndl','cnc_rdspeed','cnc_rdprgnumo8','cnc_rdprgnum','cnc_rdparam','cnc_rdtimer')
foreach($method in [FanucReader].GetMethods([Reflection.BindingFlags]'NonPublic,Static')){
 $attribute=$method.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute],$false)
 if($attribute.Count -and $attribute[0].Value -eq 'Fwlib64.dll' -and $method.Name -notin $allowed){throw ('Unexpected native API: '+$method.Name)}
}
Write-Output 'PASS: current native reader has only allowed CNC read/connect/disconnect APIs; no PMC imports, monitor methods or background threads.'
