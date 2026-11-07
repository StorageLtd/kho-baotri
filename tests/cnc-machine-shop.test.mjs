import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/js/cnc-status.js',import.meta.url),'utf8');
const statusUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const shopSource=(await readFile(new URL('../assets/js/cnc-machine-shop.js',import.meta.url),'utf8')).replace('./cnc-status.js?v=20261029-web-sync',statusUrl);
const {renderMachineModel,machineModelKind}=await import('data:text/javascript;base64,'+Buffer.from(shopSource).toString('base64'));
const sample=(run,alarm=0)=>({id:'test',name:'CNC test',source:'focas',connected:true,lastSeen:Date.now(),rawStatus:{run,alarm,emergency:0,aut:1},spindleSpeed:1200});
test('model color is based on run/alarm/freshness, not spindle speed',()=>{
 assert.match(renderMachineModel(sample(3)),/cnc-model-tile is-running/);
 for(const run of [0,1,2,4])assert.match(renderMachineModel(sample(run)),/cnc-model-tile is-stopped/);
 assert.match(renderMachineModel(sample(3,1)),/cnc-model-tile is-alarm/);
 assert.match(renderMachineModel({...sample(3),lastSeen:Date.now()-40000}),/cnc-model-tile is-offline/);
 assert.match(renderMachineModel({...sample(3),source:'pending'}),/CHƯA CÓ TÍN HIỆU THẬT/);
});
test('declared mill/lathe/orientation selects a model without guessing unknown equipment',()=>{
 assert.equal(machineModelKind({machineKind:'lathe',orientation:'horizontal'}),'lathe');
 assert.equal(machineModelKind({machineKind:'mill-multiaxis',orientation:'horizontal'}),'horizontal');
 assert.equal(machineModelKind({machineKind:'mill-3axis',orientation:'vertical'}),'vertical');
 assert.equal(machineModelKind({orientation:'horizontal'}),'generic');
 assert.equal(machineModelKind({machineKind:'mill-3axis'}),'generic');
});
test('machine names and IDs remain text and detail/settings actions are accessible',()=>{
 const html=renderMachineModel({...sample(3),name:'<script>unsafe</script>',id:'x" onclick="bad'});
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
 assert.ok(html.includes('data-cnc-action="details"'));
 assert.ok(html.includes('data-cnc-action="edit"'));
 assert.ok(!html.includes(' onclick="bad'));
});
