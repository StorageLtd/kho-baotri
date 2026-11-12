"""Build a fully self-contained offline CMMS from the reviewed web UI. No downloads."""
import argparse,re,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SRC=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/ltd-cmms-offline-build');parser.add_argument('--zip',default=str(ROOT/'downloads/LTD-CMMS-Offline-20261112.zip'));args=parser.parse_args()
package=Path(args.output)/'LTD-CMMS-Offline';package.mkdir(parents=True,exist_ok=True)
for p in SRC.rglob('*'):
 if p.is_file() and '__pycache__' not in p.parts and 'desktop' not in p.relative_to(SRC).parts and p.name!='build.py':
  dest=package/p.relative_to(SRC);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
web=package/'web';web.mkdir(exist_ok=True);shutil.copytree(ROOT/'assets',web/'assets',dirs_exist_ok=True);shutil.copyfile(ROOT/'logo.jpg',web/'logo.jpg')
for name in ['auth.js','offline-tools.js'] :shutil.copyfile(SRC/name,web/'assets/js'/name)
shutil.copyfile(SRC/'offline.css',web/'assets/css/offline.css')
(web/'assets/js/firebase-config.js').write_text("// Local adapter. No Firebase credentials or SDK.\nexport const firebaseConfig={databaseURL:'/api/database'};\n")
s=(ROOT/'assets/js/app.js').read_text(encoding='utf-8-sig')
s=re.sub(r'^import \{openCncTransfer,clearCncTransferSessions\}[^\n]+',"const clearCncTransferSessions=()=>{}; const openCncTransfer=()=>{throw Error('Bản nội bộ hiện chỉ giám sát CNC.');};",s,count=1,flags=re.M)
s=re.sub(r'(from "\./auth\.js)\?v=[^\"]+',r'\1?v=offline-20261112',s)
s=s.replace('import { initializeSession,','import { offlineFetch, initializeSession,')
s=s.replace('    const DB_URL = firebaseConfig.databaseURL;','    const fetch=offlineFetch;\n    const DB_URL = firebaseConfig.databaseURL;')
s=s.replace('      clearCncTransferSessions();', '      appStarted=false;\n      clearCncTransferSessions();')
s=s.replace('Tài khoản chưa được cấp quyền CMMS. Vui lòng liên hệ quản trị viên.','Tài khoản nội bộ không có quyền truy cập. Liên hệ quản trị viên máy tính này.')
s=s.replace('dữ liệu đám mây','dữ liệu nội bộ').replace('dữ liệu trực tuyến','dữ liệu nội bộ').replace('Lỗi đám mây','Lỗi dữ liệu nội bộ').replace('Firebase Rules','quyền tài khoản nội bộ').replace('Firebase','máy chủ nội bộ')
(web/'assets/js/app.js').write_text(s,encoding='utf-8')
p=web/'assets/js/cnc-report-ui.js';p.write_text(p.read_text().replace('Quản trị viên cần Publish nhánh Rules cncReports trong Firebase; không mở quyền công khai.','Liên hệ quản trị viên nội bộ để kiểm tra quyền đọc báo cáo.'))
s=(ROOT/'index.html').read_text(encoding='utf-8-sig');s=re.sub(r'  <meta http-equiv="Content-Security-Policy"[^\n]+\n','',s)
s=s.replace('<title>LTD VIET NAM - Cloud Maintenance System</title>','<title>LTD CMMS · Nội bộ Offline</title>')
s=s.replace('Hệ Thống Quản Lý Kho & Bảo Trì Thiết Bị','Hệ thống nội bộ · Kho & Bảo trì thiết bị').replace('Email cá nhân','Tài khoản nội bộ').replace('tenban@congty.com','admin@ltd.local')
s=s.replace('● Đám mây (Firebase) đã kết nối','● Dữ liệu lưu trên máy tính').replace('Cập nhật theo dữ liệu đám mây LTD','Cập nhật từ dữ liệu nội bộ LTD')
s=s.replace('</head>','<link rel="stylesheet" href="assets/css/offline.css">\n</head>').replace('</body>','<script type="module" src="assets/js/offline-tools.js"></script>\n</body>')
(web/'index.html').write_text(s,encoding='utf-8')
Path(args.zip).parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.zip,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(package.rglob('*')):
  if p.is_file():z.write(p,'LTD-CMMS-Offline/'+str(p.relative_to(package)))
print(package)
print(args.zip)
