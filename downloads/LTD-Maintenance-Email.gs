/* Pure logic shared by the Apps Script runner and isolated tests. No credentials. */
var LtdReminder = (function () {
  'use strict';
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }
  function email(value) {
    var text = String(value || '').trim().toLowerCase();
    if (text.length > 254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(text)) return '';
    return text;
  }
  function plan(id, job, today, start) {
    if (!job || job.emailReminderEnabled !== true || !day(job.nextDate) || !day(today) || !day(start)) return null;
    if (job.nextDate < start || job.nextDate > today || job.completed === true || job.status === 'completed' || job.status === 'cancelled') return null;
    var to = email(job.ownerEmail), cc = job.reminderCc ? email(job.reminderCc) : '';
    if (!to || (job.reminderCc && !cc)) return null;
    if (cc === to) cc = '';
    return {jobId: id, dueDate: job.nextDate, to: to, cc: cc, recipients: cc ? 2 : 1,
      jobName: String(job.jobName || 'Bảo trì thiết bị'), machineName: String(job.machineName || 'Chưa đặt tên máy'),
      owner: String(job.owner || ''), description: String(job.desc || '').slice(0, 12000)};
  }
  function same(a, b) { return !!a && !!b && a.jobId === b.jobId && a.dueDate === b.dueDate && a.to === b.to && a.cc === b.cc && a.jobName === b.jobName && a.machineName === b.machineName && a.owner === b.owner && a.description === b.description; }
  function esc(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function message(p, site) {
    var link = site + '#maintenanceJob=' + encodeURIComponent(p.jobId);
    var subject = ('[LTD] Đến hạn bảo trì: ' + p.machineName + ' — ' + p.jobName).replace(/[\r\n]/g, ' ').slice(0, 180);
    var text = 'LTD VIỆT NAM — NHẮC BẢO TRÌ\n\nMáy: ' + p.machineName + '\nCông việc: ' + p.jobName + '\nNgười phụ trách: ' + p.owner + '\nHạn thực hiện: ' + p.dueDate + '\n\n' + p.description + '\n\nMở nhiệm vụ: ' + link + '\n\nMỗi nhiệm vụ được nhắc một lần trong mỗi kỳ bảo trì.';
    return {to: p.to, cc: p.cc || undefined, name: 'LTD · Nhắc bảo trì', subject: subject, body: text,
      htmlBody: '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17302a"><div style="background:#105846;padding:20px;color:white"><b>LTD VIỆT NAM</b><h2>ĐẾN HẠN BẢO TRÌ</h2></div><div style="padding:24px;border:1px solid #dce6e2"><p><b>Máy:</b> ' + esc(p.machineName) + '</p><p><b>Công việc:</b> ' + esc(p.jobName) + '</p><p><b>Phụ trách:</b> ' + esc(p.owner) + '</p><p><b>Hạn:</b> ' + esc(p.dueDate) + '</p><div style="white-space:pre-wrap">' + esc(p.description) + '</div><p><a href="' + esc(link) + '" style="display:inline-block;background:#105846;padding:12px 18px;color:white;text-decoration:none">Mở nhiệm vụ bảo trì</a></p><small>Mỗi nhiệm vụ được nhắc một lần trong mỗi kỳ bảo trì.</small></div></div>'};
  }
  // Dependencies are injected. The real runner supplies authenticated Firebase + MailApp.
  function deliver(p, deps) {
    if (deps.quota() < p.recipients) return 'quota';
    var claim = deps.claim(p); // Persistent conditional claim BEFORE any email side effect.
    if (!claim) return 'duplicate';
    var latest;
    try { latest = deps.latest(p.jobId); } catch (e) { deps.finish(p, claim, 'cancelled'); return 'cancelled'; }
    if (!same(p, latest)) { deps.finish(p, claim, 'cancelled'); return 'cancelled'; }
    try { deps.send(p); } catch (e) { deps.finish(p, claim, 'uncertain'); return 'uncertain'; }
    // A send/ack crash cannot be safely retried automatically: keep the reservation.
    try { deps.finish(p, claim, 'sent'); } catch (e) { return 'uncertain'; }
    return 'sent';
  }
  return {day: day, email: email, plan: plan, same: same, message: message, deliver: deliver};
})();


/* LTD maintenance reminders. Apps Script V8. No web-app endpoint or embedded secrets. */
function reminderConfig_() {
  var p = PropertiesService.getScriptProperties();
  var config = {key:p.getProperty('FIREBASE_API_KEY'), database:p.getProperty('FIREBASE_DATABASE_URL'), email:p.getProperty('FIREBASE_EMAIL'), password:p.getProperty('FIREBASE_PASSWORD'), site:p.getProperty('SITE_URL') || 'https://storageltd.github.io/kho-baotri/'};
  if (!config.key || !config.email || !config.password || !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:firebasedatabase\.app|firebaseio\.com)\/?$/.test(config.database || '')) throw new Error('Thiếu hoặc sai Script Properties Firebase. Không ghi mật khẩu vào mã nguồn.');
  if (!/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9_./-]*)?\/$/i.test(config.site)) throw new Error('SITE_URL phải là URL HTTPS của web, kết thúc bằng dấu /.');
  config.database = config.database.replace(/\/$/, '');
  return config;
}
function safeFetch_(url, options) {
  options = Object.assign({muteHttpExceptions:true,followRedirects:false}, options || {});
  try { return UrlFetchApp.fetch(url, options); } catch(e) { throw new Error('Không kết nối được dịch vụ gửi nhắc. Kiểm tra mạng/cấu hình; không gửi token hay mật khẩu vào nhật ký.'); }
}
function jsonResponse_(response, operation) {
  if (response.getResponseCode() !== 200) throw new Error(operation + ': HTTP ' + response.getResponseCode() + '. Kiểm tra tài khoản, Rules và cấu hình.');
  try { return JSON.parse(response.getContentText()); } catch(e) { throw new Error(operation + ': phản hồi không hợp lệ.'); }
}
function notifierConnection_() {
  var config = reminderConfig_();
  var login = jsonResponse_(safeFetch_('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(config.key), {method:'post',contentType:'application/json',payload:JSON.stringify({email:config.email,password:config.password,returnSecureToken:true})}), 'Đăng nhập tài khoản nhắc lịch');
  if (!login.idToken || !login.localId) throw new Error('Phản hồi đăng nhập thiếu thông tin xác thực.');
  function url(path) { return config.database + '/' + path.map(encodeURIComponent).join('/') + '.json?auth=' + encodeURIComponent(login.idToken); }
  function get(path) { return jsonResponse_(safeFetch_(url(path)), 'Đọc Firebase'); }
  var profile = get(['users',login.localId]);
  if (!profile || profile.role !== 'notifier' || profile.disabled === true) throw new Error('Tài khoản tự động phải được quản trị viên cấp role notifier, không dùng tài khoản cá nhân.');
  return {config:config,uid:login.localId,get:get,url:url};
}
function reminderToday_() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }
function previewMaintenanceReminders() {
  var connection = notifierConnection_(), props = PropertiesService.getScriptProperties();
  var today=reminderToday_(), start=props.getProperty('START_DATE') || today;
  if (!LtdReminder.day(start)) throw new Error('START_DATE phải có dạng yyyy-MM-dd.');
  connection.get(['maintenanceMailDeliveries','_configuration','1970-01-01']); // Read-only check that notifier Rules are installed.
  var jobs=connection.get(['maintenanceJobs']) || {}, count=0;
  Object.keys(jobs).forEach(function(id){if(LtdReminder.plan(id,jobs[id],today,start))count++;});
  var result={today:today,startDate:start,dueJobs:count,remainingRecipients:MailApp.getRemainingDailyQuota(),enabled:props.getProperty('ENABLED')==='true'};
  console.log(JSON.stringify(result));return result; // Never sends email or writes a delivery record.
}
function installMaintenanceReminder() {
  previewMaintenanceReminders(); // Validate credentials/Rules before installing or enabling.
  var props=PropertiesService.getScriptProperties();
  if (!props.getProperty('START_DATE')) props.setProperty('START_DATE',reminderToday_());
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='runMaintenanceReminders')ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('runMaintenanceReminders').timeBased().everyHours(1).create();
  props.setProperty('ENABLED','true');
  console.log('Đã bật kiểm tra mỗi giờ. Chỉ gửi từ 08:00 giờ Việt Nam khi có job đến hạn, không gửi email mỗi ngày nếu không có job.');
}
function stopMaintenanceReminder() {
  PropertiesService.getScriptProperties().setProperty('ENABLED','false');
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='runMaintenanceReminders')ScriptApp.deleteTrigger(t);});
  console.log('Đã tắt nhắc email. Không xóa job hoặc nhật ký gửi.');
}
function runMaintenanceReminders() {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('ENABLED')!=='true')return {disabled:true};
  if(Number(Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','H'))<8)return {beforeSendHour:true};
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
  try {
    var connection=notifierConnection_(),today=reminderToday_(),start=props.getProperty('START_DATE');
    if(!LtdReminder.day(start))throw new Error('Thiếu START_DATE hợp lệ. Chạy installMaintenanceReminder trước.');
    var jobs=connection.get(['maintenanceJobs']) || {}, stats={sent:0,duplicate:0,quota:0,cancelled:0,uncertain:0}, deadline=Date.now()+240000;
    var keys=Object.keys(jobs).sort(function(a,b){return String(jobs[a].nextDate).localeCompare(String(jobs[b].nextDate));});
    for(var i=0;i<keys.length&&Date.now()<deadline;i++){
      var id=keys[i],p=LtdReminder.plan(id,jobs[id],today,start);if(!p)continue;
      var path=['maintenanceMailDeliveries',id,p.dueDate];
      var result=LtdReminder.deliver(p,{
        quota:function(){return MailApp.getRemainingDailyQuota();},
        claim:function(plan){
          var response=safeFetch_(connection.url(path),{headers:{'X-Firebase-ETag':'true'}});
          var existing=jsonResponse_(response,'Đọc nhật ký nhắc lịch');if(existing && existing.status!=='cancelled')return null;
          var headers=response.getAllHeaders(),etag=null;Object.keys(headers).forEach(function(k){if(k.toLowerCase()==='etag')etag=headers[k];});
          if(!etag)throw new Error('Firebase không trả ETag; chưa gửi email.');
          var record={jobId:plan.jobId,dueDate:plan.dueDate,ownerUid:connection.uid,status:'reserved',claimId:Utilities.getUuid(),claimedAt:new Date().toISOString(),to:plan.to,cc:plan.cc};
          var saved=safeFetch_(connection.url(path),{method:'put',contentType:'application/json',headers:{'if-match':etag},payload:JSON.stringify(record)});
          if(saved.getResponseCode()===412)return null;
          jsonResponse_(saved,'Đặt chỗ nhắc lịch');return record;
        },
        latest:function(jobId){return LtdReminder.plan(jobId,connection.get(['maintenanceJobs',jobId]),today,start);},
        send:function(plan){MailApp.sendEmail(LtdReminder.message(plan,connection.config.site));},
        finish:function(plan,claim,state){
          var record=Object.assign({},claim,{status:state,finishedAt:new Date().toISOString()});
          jsonResponse_(safeFetch_(connection.url(path),{method:'put',contentType:'application/json',payload:JSON.stringify(record)}),'Ghi kết quả nhắc lịch');
        }
      });
      stats[result]++;if(result==='quota')break;
    }
    console.log(JSON.stringify(stats));return stats;
  } finally { lock.releaseLock(); }
}
