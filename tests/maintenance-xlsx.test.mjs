import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const zip=uri(await readFile(new URL('../assets/js/cnc-xlsx.js',import.meta.url),'utf8'));
const source=(await readFile(new URL('../assets/js/maintenance-xlsx.js',import.meta.url),'utf8')).replace('./cnc-xlsx.js?v=20261105-maintenance',zip);
const {maintenancePlan,repairHistoryForm,alarmHistoryForm,createMaintenanceWorkbook}=await import(uri(source));
const generatedAt=new Date('2026-11-05T03:00:00Z'),logoBytes=new Uint8Array(await readFile(new URL('../logo.jpg',import.meta.url)));
const machines=[{id:'m1',name:'Neway 1260S',model:'VMC',serial:'000123'}];
const jobs=[{machineId:'m1',jobName:'Tra dầu',nextDate:'2026-11-08',owner:'Nhân viên A',desc:'Kiểm tra mức dầu\nBổ sung dầu theo quy định'}, {machineId:'m1',jobName:'Kiểm tra lọc',nextDate:'2026-11-03',estimatedTime:'30 phút'}, {machineId:'m1',jobName:'Kiểm tra điện',nextDate:'2026-11-05'}, {machineId:'m1',jobName:'Chưa có lịch',nextDate:'2026-02-30'}];
test('maintenance plan sorts due dates, marks overdue/today with Vietnam dates, retains serial/checklist and original records',async()=>{
 const before=JSON.stringify(jobs),layout=maintenancePlan(jobs,machines,{generatedAt,recurrenceLabel:()=> 'Hằng tuần'});
 assert.deepEqual(layout.data.map(r=>r[6]),['Kiểm tra lọc','Kiểm tra điện','Tra dầu','Chưa có lịch']);
 assert.deepEqual(layout.data.map(r=>r[2]),['Quá hạn','Đến hạn hôm nay','Đã lên lịch','Chưa có ngày']);
 assert.deepEqual(layout.summary.map(r=>r[1]),[4,1,1]);assert.equal(layout.data[0][5],'000123');
 assert.match(layout.data[2][11],/\n/);assert.equal(JSON.stringify(jobs),before);
 await writeFile('/tmp/ltd-maintenance-plan.xlsx',new Uint8Array(await createMaintenanceWorkbook(layout,{logoBytes,generatedAt,actor:'Fixture'}).arrayBuffer()));
});
test('repair history sorts newest first, preserves multiline details and never creates formulas',async()=>{
 const records=[{faultTime:'2026-11-01',machine:'Neway',staff:'A',fault:'Dầu thấp',fix:'Kiểm tra\nBổ sung dầu'}, {faultTime:'2026-11-05T20:00:00Z',machine:'Neway',fault:'=HYPERLINK("unsafe")',fix:'<Đã xử lý>'}, {faultTime:'invalid',machine:'Máy B'}];
 const before=JSON.stringify(records),layout=repairHistoryForm(records);
 assert.equal(layout.data[0][1],'06/11/2026');assert.equal(layout.data[2][1],'Chưa có ngày');
 assert.deepEqual(layout.summary.map(r=>r[1]),[3,2,'06/11/2026']);assert.equal(JSON.stringify(records),before);
 const bytes=new Uint8Array(await createMaintenanceWorkbook(layout,{logoBytes,generatedAt}).arrayBuffer()),text=new TextDecoder().decode(bytes);
 assert.ok(!text.includes('<f>'));assert.ok(text.includes('=HYPERLINK(&quot;unsafe&quot;)'));assert.ok(text.includes('&lt;Đã xử lý&gt;'));
 await writeFile('/tmp/ltd-repair-history.xlsx',bytes);
});
test('empty forms remain exportable and missing logo fails clearly',()=>{
 const plan=maintenancePlan([],[],{generatedAt});assert.equal(plan.data.length,0);
 assert.ok(createMaintenanceWorkbook(plan,{logoBytes,generatedAt}).size>logoBytes.length);
 assert.ok(createMaintenanceWorkbook(repairHistoryForm([]),{logoBytes,generatedAt}).size>logoBytes.length);
 assert.throws(()=>createMaintenanceWorkbook(plan),/logo LTD/);
});

test('CNC alarm form orders newest first, retains raw codes/type/axis, timestamps and accurate closure status',async()=>{
 const records=[
  {cncId:'n1',cncName:'Neway 1260S',timestamp:'2026-11-05T02:00:00Z',alarmCode:'OT0500',alarmType:4,axis:1,description:'(X)+ OVERTRAVEL\nSOFT 1',source:'focas'},
  {cncId:'n1',cncName:'Neway 1260S',timestamp:Date.parse('2026-11-05T03:00:00Z'),alarmCode:'0501',alarmType:4,axis:2,description:'Y OVERTRAVEL',source:'focas',resolvedAt:'2026-11-05T03:05:00Z'},
  {cncId:'n2',cncName:'Máy B',timestamp:'invalid',alarmCode:'SP0004',description:'Lỗi đã xử lý',resolvedAt:'2026-11-01T03:00:00Z'}
 ];
 const before=JSON.stringify(records),layout=alarmHistoryForm(records);
 assert.deepEqual(layout.summary.map(r=>r[1]),[3,1,2]);assert.equal(layout.data[0][3],'0501');
 assert.match(layout.data[0][1],/10:00:00/);assert.equal(layout.data[0][7],'Hết tín hiệu lỗi');
 assert.equal(layout.data[1][7],'Chưa ghi nhận kết thúc');assert.match(layout.data[1][6],/\n/);
 assert.equal(layout.data[2][7],'Đã xử lý');assert.equal(JSON.stringify(records),before);
 await writeFile('/tmp/ltd-alarm-history.xlsx',new Uint8Array(await createMaintenanceWorkbook(layout,{logoBytes,generatedAt}).arrayBuffer()));
});
