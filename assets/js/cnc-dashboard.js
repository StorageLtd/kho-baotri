// Shared status-module URL keeps the dashboard on the same calibrated Firebase clock as app.js.
import {cncDisplayState,cncIsFresh,cncMeasurement,cncMode,cncDuration} from './cnc-status.js?v=20261029-web-sync';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const machineIcon='<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 8h30v32H7zM12 13h17v22H12zM21 13v22M15 18h3M33 15h1M33 20h1M33 25h1M4 40h38M37 12h6v22h-6M40 17h1M40 22h1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const settingsIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5 1.8-1 2.2 2.2-1 1.8.6 1.5 2 .6v3.1l-2 .6-.6 1.5 1 1.8-2.2 2.2-1.8-1-1.5.6-.6 2H9.3l-.6-2-1.5-.6-1.8 1-2.2-2.2 1-1.8-.6-1.5-2-.6v-3.1l2-.6.6-1.5-1-1.8 2.2-2.2 1.8 1 1.5-.6.6-2h3.1l.6 2 1.5.6Z" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="11.6" r="3" stroke="currentColor" stroke-width="1.3"/></svg>';
const deleteIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
function metric(label,value,unit='',extra=''){
 return `<div class="cnc-metric ${extra}"><span>${label}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong></div>`;
}
export function renderCncMachineCard(c,{errorsOpen=false}={}){
 const signal=cncDisplayState(c),fresh=cncIsFresh(c),visible=fresh||c.source==='demo',real=c.source==='focas';
 const source=real?'Dữ liệu thật · FOCAS':c.source==='demo'?'Dữ liệu mô phỏng':'Chưa xác minh nguồn';
 const measurement=value=>visible?cncMeasurement(value):'—';
 const date=new Date(c.lastSeen),last=c.lastSeen&&Number.isFinite(+date)?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date):'Chờ tín hiệu đầu tiên';
 const alarms=visible&&real&&Array.isArray(c.alarmDetails)?c.alarmDetails:[];
 const alarmPanel=alarms.length?`<div class="cnc-live-alarm">${alarms.map(a=>`<div><strong>Alarm ${esc(a.number)}${a.axis>0?` · Trục ${esc(a.axis)}`:''}</strong><p>${esc(a.message||'CNC không trả nội dung lỗi')}</p></div>`).join('')}${c.alarmsMayBeTruncated?'<small>Có thể còn Alarm khác trên CNC.</small>':''}</div>`:signal.status==='alarm'?`<div class="cnc-live-alarm"><strong>${c.rawStatus?.emergency?'Tín hiệu Emergency':'Có tín hiệu Alarm'}</strong><p>${esc(real?'Chưa có nội dung lỗi chi tiết.':c.alarm||'')}</p></div>`:'';
 const readErrors=visible&&c.readErrors?Object.values(c.readErrors).filter(Boolean):[];
 return `<article class="cnc-card cnc-machine-panel is-${esc(signal.css)}" id="card-${esc(c.id)}" data-machine-id="${esc(c.id)}">
  <header class="cnc-machine-heading">
   <div class="cnc-machine-identity"><span class="cnc-machine-symbol">${machineIcon}</span><div><span class="cnc-controller">${esc(c.model||'CNC Controller')}</span><h3>${esc(c.name)}</h3></div></div>
   <span class="cnc-status ${esc(signal.css)}"><span class="cnc-state-light ${esc(signal.css)}" aria-hidden="true"></span>${esc(signal.label)}</span>
  </header>
  <div class="cnc-machine-content">
   <div class="cnc-program-line"><div><span>Chương trình hiện tại:</span><strong>${esc(visible?c.activeProgram||'Chưa đọc':'—')}</strong></div><div class="cnc-operating-mode"><span>Chế độ</span><strong>${real&&visible?esc(cncMode(c.rawStatus?.aut)):'—'}</strong></div></div>
   <div class="cnc-speed-grid">${metric('Vòng quay trục chính',measurement(c.spindleSpeed),'RPM','cnc-spindle')}${metric('Tốc độ ăn dao',measurement(c.feedrate),real?c.feedrateUnit||'':'mm/min','cnc-feed')}</div>
   <div class="cnc-production-grid">${metric('PART COUNT:',real?measurement(c.partCounter):'—','','cnc-parts')}${metric('RUN TIME:',real&&visible?cncDuration(c.runTimeMs):'—')}${metric('CYCLE TIME:',real&&visible?cncDuration(c.cycleTimeMs):'—')}</div>
   ${alarmPanel}
   ${!visible?'<div class="cnc-unavailable">Chưa có tín hiệu mới · Thông số tạm thời không khả dụng.</div>':''}
   ${readErrors.length?`<details class="cnc-read-errors"${errorsOpen?' open':''}><summary>Một số mục chưa đọc được</summary><p>${esc(readErrors.join('; '))}</p></details>`:''}
  </div>
  <footer class="cnc-machine-footer"><div class="cnc-connection-meta"><span>${esc(source)}</span><span>${esc(c.ip||'—')}:${esc(c.port??'—')}</span><time>${esc(last)}</time></div>
   <div class="cnc-machine-actions"><button class="btn cnc-history-btn" type="button" data-cnc-action="history" data-cnc-id="${esc(c.id)}">Alarm của máy <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="cnc-icon-action" type="button" data-cnc-action="edit" data-cnc-id="${esc(c.id)}" title="Sửa IP" aria-label="Sửa IP ${esc(c.name)}">${settingsIcon}</button><button class="cnc-icon-action cnc-delete-action" type="button" data-cnc-action="delete" data-cnc-id="${esc(c.id)}" title="Xóa máy" aria-label="Xóa máy ${esc(c.name)}">${deleteIcon}</button></div>
  </footer>
 </article>`;
}
