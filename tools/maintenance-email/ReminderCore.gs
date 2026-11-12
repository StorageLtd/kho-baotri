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
