"""Package native WPF CMMS. Browser web assets and HTTP listener are excluded."""
import argparse,os,subprocess,zipfile
from pathlib import Path
SRC=Path(__file__).resolve().parent
BASE=SRC.parent
ROOT=BASE.parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/ltd-cmms-desktop-build');p.add_argument('--references',default='/tmp/net48-reference/build/.NETFramework/v4.8');p.add_argument('--pwsh',default='/tmp/pwsh-validation/runtime/pwsh');p.add_argument('--zip',default=str(ROOT/'downloads/LTD-CMMS-Desktop-20261112.zip'));args=p.parse_args()
folder=Path(args.output)/'LTD-CMMS-Desktop';folder.mkdir(parents=True,exist_ok=True)
files={}
for name in ['Offline.Core.ps1','Collectors.ps1','Worker.ps1','Telemetry.ps1','ReportCollector.ps1','FanucReader.cs']:
 files[name]=(BASE/name).read_bytes()
for name in ['Desktop.xaml','Desktop.Main.ps1','Desktop.Core.ps1','Desktop.Views.ps1','Desktop.Export.ps1','Desktop.Cnc.ps1','Desktop.Primitives.cs','Launcher.cs','HUONG-DAN-DESKTOP.md']:
 files[name]=(SRC/name).read_bytes()
files['logo.jpg']=(ROOT/'logo.jpg').read_bytes();files['lib/COPY-DLL-HERE.txt']=(BASE/'lib/COPY-DLL-HERE.txt').read_bytes()
files['LTD-CMMS.exe.config']=b'<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>'
files['START-CMMS-CONSOLE.cmd']=b'@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -STA -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command "Get-ChildItem -LiteralPath . -Recurse -File | Unblock-File; & \'./Desktop.Main.ps1\'"\r\nif errorlevel 1 pause\r\n'
files['START-CMMS.cmd']=b'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0LTD-CMMS.exe"\r\n'
for name,data in files.items():
 dest=folder/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
env={**os.environ,'XDG_CACHE_HOME':'/tmp/pwsh-validation/cache','XDG_CONFIG_HOME':'/tmp/pwsh-validation/config','XDG_DATA_HOME':'/tmp/pwsh-validation/data'}
subprocess.run([args.pwsh,'-NoProfile','-File',str(SRC/'Compile-Launcher.ps1'),'-ReferenceDirectory',args.references,'-OutputPath',str(folder/'LTD-CMMS.exe')],check=True,env=env)
files['LTD-CMMS.exe']=(folder/'LTD-CMMS.exe').read_bytes()
with zipfile.ZipFile(args.zip,'w',zipfile.ZIP_DEFLATED) as z:
 for name,data in sorted(files.items()):z.writestr('LTD-CMMS-Desktop/'+name,data)
print(folder);print(args.zip)
