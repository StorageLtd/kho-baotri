import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const core=readFileSync(new URL('../tools/maintenance-email/ReminderCore.gs',import.meta.url),'utf8');
const runner=readFileSync(new URL('../tools/maintenance-email/Code.gs',import.meta.url),'utf8');
const coreContext=vm.createContext({});vm.runInContext(core,coreContext);const api=coreContext.LtdReminder;
const job={jobName:'Thay dầu',machineName:'Neway',owner:'Nhân viên A',ownerEmail:'A@example.com',reminderCc:'boss@example.com',emailReminderEnabled:true,nextDate:'2026-11-12',desc:'Kiểm tra mức dầu'};
test('only enabled due jobs with valid dates and addresses enter the plan',()=>{
 assert.equal(api.plan('job',job,'2026-11-12','2026-11-12').recipients,2);
 for(const change of [{emailReminderEnabled:false},{nextDate:'2026-11-13'},{nextDate:'2026-11-11'},{nextDate:'2026-02-30'},{ownerEmail:''},{ownerEmail:'victim@example.com\nBcc:other@example.com'},{reminderCc:'bad'},{completed:true},{status:'cancelled'}])assert.equal(api.plan('job',{...job,...change},'2026-11-12','2026-11-12'),null,JSON.stringify(change));
 assert.ok(api.plan('job',job,'2026-11-13','2026-11-12'),'Missed trigger catches up once');
 assert.equal(api.plan('job',{...job,reminderCc:'a@example.com'},'2026-11-12','2026-11-12').recipients,1);
});
test('message safely escapes database text and links to the specific job',()=>{
 const p=api.plan('id/a',{...job,jobName:'Bad\nSubject',desc:'<img src=x onerror=alert(1)>'},'2026-11-12','2026-11-12');
 const mail=api.message(p,'https://storageltd.github.io/kho-baotri/');
 assert.doesNotMatch(mail.subject,/\n/);assert.doesNotMatch(mail.htmlBody,/<img/);assert.match(mail.htmlBody,/&lt;img/);assert.match(mail.body,/#maintenanceJob=id%2Fa/);
});
function scriptFixture(options={}){
 const properties=new Map(Object.entries({FIREBASE_API_KEY:'fixture-key',FIREBASE_DATABASE_URL:'https://fixture-default-rtdb.asia-southeast1.firebasedatabase.app',FIREBASE_EMAIL:'notifier@example.com',FIREBASE_PASSWORD:'fixture-password',START_DATE:'2026-11-12',ENABLED:'true'}));
 const state={jobs:{job:{...job}},ledger:{},mails:[],logs:[],writes:0,quota:100,hour:9,today:'2026-11-12',failFinish:false,throwSend:false,claimRace:false,changeBeforeSend:false,triggers:[],...options};
 const response=(status,value,headers={})=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(value),getAllHeaders:()=>headers});
 const context=vm.createContext({console:{log:text=>state.logs.push(text)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},Utilities:{formatDate:(_d,_z,format)=>format==='H'?String(state.hour):state.today,getUuid:()=> 'fixture-claim-'+state.writes},LockService:{getScriptLock:()=>({tryLock:()=>!state.busy,releaseLock:()=>{}})},MailApp:{getRemainingDailyQuota:()=>state.quota,sendEmail:mail=>{if(state.throwSend)throw Error('ambiguous mail error');state.mails.push(mail);state.quota-=mail.cc?2:1;}},ScriptApp:{getProjectTriggers:()=>state.triggers,deleteTrigger:t=>state.triggers.splice(state.triggers.indexOf(t),1),newTrigger:handler=>({timeBased:()=>({everyHours:hours=>({create:()=>state.triggers.push({getHandlerFunction:()=>handler,hours})})})})},UrlFetchApp:{fetch:(address,options)=>{
  const url=new URL(address);if(url.hostname==='identitytoolkit.googleapis.com'){assert.equal(JSON.parse(options.payload).password,'fixture-password');return response(200,{idToken:'fixture-token',localId:'notifier-id'});}
  assert.equal(url.searchParams.get('auth'),'fixture-token');
  const path=url.pathname.slice(1,-5).split('/').map(decodeURIComponent);const method=(options.method||'get').toLowerCase();
  if(path[0]==='users')return response(200,{role:'notifier'});
  if(path[0]==='maintenanceJobs'){
   assert.equal(method,'get','Notifier must never change jobs');
   if(path.length===2&&state.changeBeforeSend)return response(200,{...state.jobs[path[1]],nextDate:'2026-11-13'});
   return response(200,path.length===1?state.jobs:state.jobs[path[1]]??null);
  }
  assert.equal(path[0],'maintenanceMailDeliveries');const key=path.slice(1).join('/');
  if(method==='get')return response(200,state.ledger[key]??null,{eTAG:state.ledger[key]?'"existing"':'"null"'});
  assert.equal(method,'put');const record=JSON.parse(options.payload);state.writes++;
  if(options.headers?.['if-match']){
   if(state.claimRace)return response(412,{});
   if(state.ledger[key]&&state.ledger[key].status!=='cancelled')return response(412,{});
  }else if(state.failFinish)return response(500,{});
  state.ledger[key]=record;return response(200,record);
 }}});
 vm.runInContext(core+'\n'+runner,context);return {context,state,properties};
}
test('real Apps Script runner sends once per job/date and only when due; next period can send again',()=>{
 const f=scriptFixture();f.context.runMaintenanceReminders();f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,1);assert.equal(f.state.ledger['job/2026-11-12'].status,'sent');
 f.state.jobs.job.nextDate='2026-11-13';f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,1);
 f.state.today='2026-11-13';f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,2);
 assert.ok(!f.state.logs.join('').includes('fixture-password')&&!f.state.logs.join('').includes('fixture-token'));
});
test('disabled scheduler, before 08:00, old jobs, opt-out and low quota send nothing',()=>{
 for(const options of [{hour:7},{jobs:{job:{...job,nextDate:'2026-11-11'}}},{jobs:{job:{...job,emailReminderEnabled:false}}},{quota:1},{busy:true}]){
  const f=scriptFixture(options);f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,0);assert.equal(f.state.writes,0);
 }
 const f=scriptFixture();f.properties.set('ENABLED','false');f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,0);
});
test('changed job and cross-project ETag conflict prevent a send',()=>{
 const f=scriptFixture({changeBeforeSend:true});f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,0);assert.equal(f.state.ledger['job/2026-11-12'].status,'cancelled');
 f.state.changeBeforeSend=false;f.context.runMaintenanceReminders();assert.equal(f.state.mails.length,1,'Cancelled before send may retry safely');
 const race=scriptFixture({claimRace:true});race.context.runMaintenanceReminders();assert.equal(race.state.mails.length,0);
});
test('ambiguous send or failed acknowledgement never causes automatic duplicate email',()=>{
 const uncertain=scriptFixture({throwSend:true});uncertain.context.runMaintenanceReminders();assert.equal(uncertain.state.ledger['job/2026-11-12'].status,'uncertain');uncertain.state.throwSend=false;uncertain.context.runMaintenanceReminders();assert.equal(uncertain.state.mails.length,0);
 const ack=scriptFixture({failFinish:true});ack.context.runMaintenanceReminders();assert.equal(ack.state.mails.length,1);assert.equal(ack.state.ledger['job/2026-11-12'].status,'reserved');ack.state.failFinish=false;ack.context.runMaintenanceReminders();assert.equal(ack.state.mails.length,1);
});
test('preview/install/stop do not send email; installation is idempotent and preserves history',()=>{
 const f=scriptFixture();f.properties.delete('START_DATE');f.context.previewMaintenanceReminders();assert.equal(f.state.writes,0);assert.equal(f.state.mails.length,0);
 f.context.installMaintenanceReminder();f.context.installMaintenanceReminder();assert.equal(f.state.triggers.length,1);assert.equal(f.properties.get('START_DATE'),'2026-11-12');assert.equal(f.state.mails.length,0);
 f.context.stopMaintenanceReminder();assert.equal(f.properties.get('ENABLED'),'false');assert.equal(f.state.triggers.length,0);assert.equal(f.state.writes,0);
});
