// Evaluate the shipped boolean rule predicates against representative snapshots.
// This is not the Firebase Rules emulator or a production permission test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const rules=JSON.parse(readFileSync(new URL('../firebase/database.rules.json',import.meta.url))).rules;
const snapshot=value=>({val:()=>value??null,exists:()=>value!==undefined&&value!==null,child:key=>snapshot(value?.[key]),hasChildren:keys=>keys.every(k=>value?.[k]!==undefined),isString:()=>typeof value==='string',isBoolean:()=>typeof value==='boolean',isNumber:()=>typeof value==='number'});
function allows(expression,{role='technician',verified=true,disabled=false,user='u1',data,newData,uid='u1'}={}){
 return vm.runInNewContext(expression,{auth:user?{uid:user,token:{email:'user@example.com',email_verified:verified}}:null,root:snapshot({users:{u1:{role,disabled}}}),data:snapshot(data),newData:snapshot(newData),$uid:uid,$sessionId:'session'});
}
test('company data requires verified approved active membership, even for reads',()=>{
 for(const node of ['items','machines','maintenanceJobs','cncs','cncAlarms','repairHistory','activities','stockMovements','cncReports','online_users']){
  for(const ctx of [{user:null},{role:'pending'},{role:'unknown'},{role:'admin',verified:false},{role:'admin',disabled:true}])assert.equal(allows(rules[node]['.read'],ctx),false,node+JSON.stringify(ctx));
  for(const role of ['viewer','technician','manager','admin'])assert.equal(allows(rules[node]['.read'],{role}),true,node+role);
 }
});
test('viewers cannot write operational data; approved verified operators can',()=>{
 for(const node of ['items','machines','maintenanceJobs','cncs','cncAlarms','activities']){
  for(const ctx of [{role:'pending'},{role:'viewer'},{verified:false},{disabled:true},{user:null}])assert.equal(allows(rules[node]['.write'],ctx),false,node);
  for(const role of ['technician','manager','admin'])assert.equal(allows(rules[node]['.write'],{role}),true,node);
 }
});
test('self registration cannot grant any approved role or alter an existing profile',()=>{
 const expr=rules.users.$uid['.write'];
 for(const role of ['viewer','technician','manager','admin'])assert.equal(allows(expr,{role:'pending',newData:{role,email:'user@example.com'}}),false,role);
 assert.equal(allows(expr,{role:'pending',newData:{role:'pending',email:'user@example.com'}}),true);
 assert.equal(allows(expr,{role:'pending',data:{role:'pending'},newData:{role:'admin',email:'user@example.com'}}),false);
 assert.equal(allows(expr,{role:'pending',uid:'other',newData:{role:'pending',email:'user@example.com'}}),false);
 assert.equal(allows(expr,{role:'admin',data:{role:'pending'},newData:{role:'viewer'}}),true);
 assert.equal(allows(expr,{role:'admin',verified:false,data:{role:'pending'},newData:{role:'viewer'}}),false);
 assert.equal(allows(expr,{role:'admin',disabled:true,data:{role:'pending'},newData:{role:'viewer'}}),false);
});
test('personal account history cannot be overwritten or deleted',()=>{
 const expr=rules.accountHistory.$uid.$entryId['.write'];const value={uid:'u1'};
 assert.equal(allows(expr,{newData:value}),true);
 assert.equal(allows(expr,{data:value,newData:value}),false);
 assert.equal(allows(expr,{data:value}),false);
 assert.equal(allows(expr,{uid:'other',newData:value}),false);
});
test('UI uses inert data attributes and CSP forbids inline scripts',()=>{
 const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const auth=readFileSync(new URL('../assets/js/auth.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/onclick="|onerror="/);assert.doesNotMatch(html,/onsubmit=/);
 assert.match(html,/Content-Security-Policy/);const policy=html.match(/Content-Security-Policy" content="([^"]+)/)[1];assert.doesNotMatch(policy.split('script-src')[1].split(';')[0],/unsafe-inline|unsafe-eval/);
 assert.match(html,/name="referrer" content="no-referrer"/);assert.match(auth,/browserSessionPersistence/);assert.doesNotMatch(auth,/role: "technician"/);assert.match(auth,/currentProfile.disabled === true/);
});

test('merged deployed rules retain admin-only audit access and per-entry protection',()=>{
 for(const node of ['accountHistory','deviceHistory']){
  for(const role of ['viewer','technician','manager','pending'])assert.equal(allows(rules[node]['.read'],{role}),false,node+role);
  assert.equal(allows(rules[node]['.read'],{role:'admin'}),true);
  assert.equal(allows(rules[node]['.read'],{role:'admin',verified:false}),false);
 }
 assert.equal(rules.stockMovements['.write'],undefined,'Parent write would override append-only children');
 assert.equal(rules.repairHistory['.write'],undefined,'Parent write would override admin-only changes');
 for(const role of ['admin','manager','technician']){
  assert.equal(allows(rules.stockMovements.$entryId['.write'],{role,newData:{id:'new'}}),true);
  assert.equal(allows(rules.stockMovements.$entryId['.write'],{role,data:{id:'old'},newData:{id:'old'}}),false);
  assert.equal(allows(rules.stockMovements.$entryId['.write'],{role,data:{id:'old'}}),false);
  assert.equal(allows(rules.repairHistory.$entryId['.write'],{role,newData:{id:'new'}}),true);
  assert.equal(allows(rules.repairHistory.$entryId['.write'],{role,data:{id:'old'},newData:{id:'old'}}),role==='admin');
  assert.equal(allows(rules.repairHistory.$entryId['.write'],{role,data:{id:'old'}}),role==='admin');
 }
 for(const node of ['stockMovements','repairHistory']){
  for(const ctx of [{role:'viewer'},{role:'pending'},{role:'admin',verified:false},{role:'admin',disabled:true},{user:null}])assert.equal(allows(rules[node].$entryId['.write'],{...ctx,newData:{id:'new'}}),false,node);
 }
 assert.match(rules.stockMovements.$entryId['.validate'],/afterQuantity/);
 assert.match(rules.repairHistory.$entryId['.validate'],/faultTime/);
 assert.equal(readFileSync(new URL('../downloads/LTD-Firebase-Rules-20261111.json',import.meta.url),'utf8'),readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8'));
});
