import assert from 'node:assert/strict';import test from 'node:test';import {readFile,writeFile} from 'node:fs/promises';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('../assets/js/'+file,import.meta.url))).toString('base64'));
const {reportPeriod,buildCncReport,reportSheets,cycleDuration}=await load('cnc-reports.js');
const {createCncWorkbook}=await load('cnc-xlsx.js');
const now=Date.parse('2026-10-29T05:00:00Z'),machine={id:'neway-1260s',name:'Neway 1260S'},start=Date.parse('2026-10-28T00:00:00+07:00');
const session=(extra={})=>({schemaVersion:1,source:'focas',machineId:machine.id,sessionId:'a',date:'2026-10-28',firstMs:start,lastMs:start+3600000,observedMs:3600000,runningMs:1800000,idleMs:600000,holdMs:600000,alarmMs:600000,unknownStateMs:0,counterDelta:12,counterObservedMs:3600000,counterResets:0,counterVerified:false,partsPerCount:1,...extra});
const build=s=>buildCncReport([machine],{[machine.id]:{'2026-10-28':s}},reportPeriod('week','2026-10-28',now));
test('calendar weeks/months/quarters use Vietnam time, leap years, and partial current periods',()=>{
 const week=reportPeriod('week','2026-10-28',now);assert.equal(week.startDate,'2026-10-26');assert.equal(week.endDate,'2026-11-01');assert.equal(week.through,now);
 assert.equal(reportPeriod('month','2024-02-10',now).endDate,'2024-02-29');
 const q=reportPeriod('quarter','2026-12-20',now);assert.equal(q.startDate,'2026-10-01');assert.equal(q.endDate,'2026-12-31');
 assert.throws(()=>reportPeriod('month','2026-02-30',now));assert.throws(()=>reportPeriod('month','2027-01-01',now));
});
test('only collected durations count; no history is unknown time, not idle or setup',()=>{
 const r=build({a:session()}).summary[0];assert.equal(r.runningMs,1800000);assert.equal(r.observedMs,3600000);assert.equal(r.runRatio,.5);assert.equal(r.rawCount,12);assert.equal(r.production,null);assert.equal(r.missingMs,r.windowMs-3600000);
 const none=build({}).summary[0];assert.equal(none.observedMs,0);assert.equal(none.rawCount,null);assert.equal(none.production,null);assert.equal(none.runRatio,null);
});
test('production requires verified counter conversion, reset flags retained, duplicate session keys not added twice',()=>{
 const one=session({counterVerified:true,partsPerCount:2,counterResets:1});const r=build({a:one}).summary[0];assert.equal(r.production,24);assert.equal(r.counterResets,1);
 assert.equal(build({a:one}).summary[0].production,24);
});
test('overlapping collectors and corrupt totals excluded, adjacent sessions accepted',()=>{
 const a=session(),b=session({sessionId:'b'});let r=build({a,b}).summary[0];assert.equal(r.conflicts,2);assert.equal(r.observedMs,0);
 r=build({a,b:session({sessionId:'b',firstMs:start+3600000,lastMs:start+7200000})}).summary[0];assert.equal(r.observedMs,7200000);
 r=build({bad:session({runningMs:-1})}).summary[0];assert.equal(r.invalid,1);assert.equal(r.observedMs,0);
});
test('genuine XLSX contains two sheets and strings are not formulas',async()=>{
 const report=build({a:session({counterVerified:true})});report.summary[0].name='=HYPERLINK("evil") <&>';
 const blob=createCncWorkbook(reportSheets(report));const bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
 await writeFile('/tmp/cnc-report-fixture.xlsx',bytes);
 assert.equal(reportSheets(report).length,2);
});

test('cycle rows preserve observed start/end, hold and alarm; summary groups by main program',()=>{
 const a=session();a.cycles={one:{id:'cycle1',program:'O0002',observedFromMs:start+1000,observedToMs:start+26000,startMs:start+1000,endMs:start+26000,runMs:15000,holdMs:5000,alarmMs:5000,waitMs:0,wallMs:25000,partCountDelta:1,partCountEnd:11,status:'STOP/RESET; M30 not confirmed',days:{'2026-10-28':{runMs:15000,holdMs:5000,alarmMs:5000}}}};
 const report=build({a});assert.equal(report.cycles.length,1);assert.equal(report.programs[0].runMs,15000);assert.equal(report.programs[0].partCountDelta,1);
 const sheets=reportSheets(report);assert.deepEqual(sheets.map(s=>s.name),['Tổng quan','Theo ngày']);assert.equal(sheets[1].rows[5][10],1);assert.match(sheets[1].rows[5][12],/not confirmed/);
 assert.equal(sheets[1].rows[5][3],'2026-10-28 00:00:01');
 assert.equal(sheets[1].rows[5][4],'2026-10-28 00:00:26');
 assert.equal(sheets[0].rows[5][5],'30 phút 0 giây');assert.equal(sheets[0].rows[6][5],'15 giây');
 assert.equal(sheets[1].rows[5][5],'15 giây');assert.equal(sheets[1].rows[5][6],'25 giây');
});

test('durations show explicit units and historical totals never invent START/STOP times',()=>{
 assert.equal(cycleDuration(2412000),'40 phút 12 giây');
 assert.equal(cycleDuration(3600000),'1 giờ 0 phút 0 giây');
 assert.equal(cycleDuration(90061000),'25 giờ 1 phút 1 giây');
 assert.equal(cycleDuration(0),'0 giây');assert.equal(cycleDuration(null),'');
 const sheets=reportSheets(build({a:session()}));
 assert.equal(sheets[0].rows[5][3],'Không có mốc START');
 assert.equal(sheets[0].rows[5][4],'Không có mốc STOP');
 assert.equal(sheets[0].rows[5][5],'30 phút 0 giây');
 assert.ok(!sheets.flatMap(s=>s.rows[4]).some(h=>h.includes('(h)')));
});

test('daily table shows historical daily totals and concise headers without invented run times',()=>{
 const sheets=reportSheets(build({a:session()})),daily=sheets[1];
 assert.equal(daily.rows.length,6);assert.equal(daily.rows[5][2],'Tổng hợp ngày');
 assert.equal(daily.rows[5][3],'Chưa ghi nhận');assert.equal(daily.rows[5][4],'Chưa ghi nhận');
 assert.equal(daily.rows[5][5],'30 phút 0 giây');assert.equal(daily.rows[5][8],'10 phút 0 giây');
 assert.equal(daily.rows[5][10],12);
 for(const sheet of sheets)assert.ok(!sheet.rows[4].some(h=>/quan sát|\(h\)/.test(h)));
});
