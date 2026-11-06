import assert from 'node:assert/strict';import test from 'node:test';import {readFile} from 'node:fs/promises';
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const status=uri(await readFile(new URL('../assets/js/cnc-status.js',import.meta.url),'utf8'));
const source=(await readFile(new URL('../assets/js/cnc-live-charts.js',import.meta.url),'utf8')).replace('./cnc-status.js?v=20261029-web-sync',status);
const {CncTraceStore,chartSeries,fleetCounts}=await import(uri(source));
const t=Date.parse('2026-11-06T03:00:00Z');
const cnc=(at,extra={})=>({id:'m1',name:'Neway',source:'focas',connected:true,lastSeen:at,rawStatus:{run:3,alarm:0,emergency:0},spindleSpeed:250,feedrate:100,feedrateUnit:'mm/min',partCounter:20,...extra});
test('store records only new true samples; preserves measured zero and absolute PART COUNT',()=>{
 const store=new CncTraceStore();store.capture([cnc(t)],t);store.capture([cnc(t,{partCounter:99})],t+5000);
 assert.equal(store.get('m1').length,1);assert.equal(store.get('m1')[0].parts,20);
 store.capture([cnc(t+5000,{spindleSpeed:0,feedrate:0,partCounter:21})],t+5000);
 assert.equal(store.get('m1')[1].spindle,0);assert.equal(store.get('m1')[1].parts,21);
 assert.equal(chartSeries(store.get('m1'),'parts',t,t+5000,'')[0][1].value,21);
});
test('disconnects create a gap without invented zero; reconnect does not bridge missing intervals',()=>{
 const store=new CncTraceStore();store.capture([cnc(t)],t);
 store.capture([cnc(t,{connected:false})],t+10000);
 assert.equal(store.get('m1')[1].gap,true);assert.equal(store.get('m1')[1].spindle,undefined);
 store.capture([cnc(t+14000)],t+14000);
 const series=chartSeries(store.get('m1'),'spindle',t,t+14000,'RPM');assert.equal(series.length,2);
 const long=chartSeries([{at:t,spindle:100},{at:t+20000,spindle:200}],'spindle',t,t+20000,'RPM');assert.equal(long.length,2);
});
test('feed unit changes split lines and old/future points never create a false current graph',()=>{
 const trace=[{at:t,feed:10,feedUnit:'mm/min'},{at:t+5000,feed:1,feedUnit:'inch/min'},{at:t+10000,feed:20,feedUnit:'mm/min'}];
 const series=chartSeries(trace,'feed',t,t+10000,'mm/min');assert.equal(series.length,2);assert.deepEqual(series.map(g=>g[0].value),[10,20]);
 assert.equal(chartSeries([{at:t-1000,spindle:250}],'spindle',t,t+1000,'RPM').length,0);
 assert.equal(chartSeries([{at:t+2000,spindle:250}],'spindle',t,t+1000,'RPM').length,0);
});
test('memory is bounded, removed machines are discarded, clock calibration does not retain future data',()=>{
 const store=new CncTraceStore();for(let i=0;i<1500;i++)store.capture([cnc(t+i*1000)],t+i*1000);
 assert.ok(store.get('m1').length<=1200);
 store.capture([cnc(t)],t);assert.equal(store.get('m1').length,1);
 store.capture([],t);assert.equal(store.traces.size,0);
 const other=new CncTraceStore();other.capture([cnc(t,{source:'demo'})],t);assert.equal(other.get('m1').length,0);
});
test('fleet distribution is a current device count, never a runtime percentage',()=>{
 const list=[cnc(t),cnc(t,{id:'hold',rawStatus:{run:2,alarm:0,emergency:0}}),cnc(t,{id:'alarm',rawStatus:{run:3,alarm:1,emergency:0}}),cnc(t-31000,{id:'offline'}),cnc(t,{id:'demo',source:'demo'})];
 const counts=fleetCounts(list,t);assert.deepEqual(counts,{running:1,hold:1,idle:0,alarm:1,offline:1,unknown:1});
});
