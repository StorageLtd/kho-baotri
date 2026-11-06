// Shared status-module URL keeps the dashboard on the same calibrated Firebase clock as app.js.
import {cncDisplayState,cncIsFresh,cncMeasurement,cncMode,cncDuration} from './cnc-status.js?v=20261029-web-sync';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function machineIllustration(id){
 const token='cnc-'+Array.from(String(id)).reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619),2166136261).toString(36).replace('-','n');
 return `<svg class="cnc-machine-art" viewBox="0 0 360 240" role="img" aria-label="Hình minh họa máy CNC">
 <defs><linearGradient id="${token}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfdff"/><stop offset="1" stop-color="#b9c9d9"/></linearGradient><linearGradient id="${token}-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#758da6"/><stop offset="1" stop-color="#314961"/></linearGradient><linearGradient id="${token}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#162f48"/><stop offset="1" stop-color="#355a77"/></linearGradient></defs>
 <ellipse cx="176" cy="218" rx="136" ry="11" fill="#203b55" opacity=".10"/>
 <path d="m44 56 37-24h223l-37 24Z" fill="#d8e2ec"/><path d="m267 56 37-24v161l-37 23Z" fill="url(#${token}-side)"/>
 <rect x="44" y="56" width="223" height="152" rx="5" fill="url(#${token}-metal)" stroke="#a7bace"/>
 <path d="M44 61q0-5 5-5h213q5 0 5 5v15H44Z" fill="#344b65"/><path d="m267 56 37-24v20l-37 24Z" fill="#243b53"/>
 <rect x="55" y="86" width="130" height="82" rx="3" fill="#6d879e"/><rect x="60" y="91" width="120" height="72" rx="2" fill="url(#${token}-glass)"/>
 <path d="M65 107h110M65 123h110M65 146h110M84 96v62M149 96v62" stroke="#8ac4db" stroke-width=".7" opacity=".17"/>
 <path d="M117 94h13v18h-13z" fill="#9cb8cc"/><path d="M121 111h5v21h-5z" fill="#73cde5"/><path d="m120 132 3.5 7 3.5-7" fill="#b3ecf4"/>
 <g class="cnc-tool-rotor"><circle cx="123.5" cy="122" r="11" fill="none" stroke="#61d0e8" stroke-width="1.2" opacity=".6"/><path d="M123.5 114v5m0 6v5m-8-8h5m6 0h5" stroke="#a2e7f1" stroke-width="1.2"/></g>
 <path d="M88 146h73v6H88zM93 153h62v6H93z" fill="#90afc5"/><path d="M121 86v82" stroke="#a9bdcd" stroke-width="3"/><path d="M172 119v24" stroke="#d3e0e9" stroke-width="3" stroke-linecap="round"/>
 <path d="m64 93 43 0-43 54Z" fill="#c2e4f2" opacity=".07"/>
 <rect x="198" y="85" width="55" height="83" rx="3" fill="#344b65"/><rect x="206" y="94" width="39" height="29" rx="2" fill="#11293f"/><path d="M211 102h17m-17 5h28m-28 5h12" stroke="#74a8c7" stroke-width="2" stroke-linecap="round"/>
 <g fill="#a2b6c9"><rect x="207" y="132" width="7" height="5" rx="1"/><rect x="220" y="132" width="7" height="5" rx="1"/><rect x="233" y="132" width="7" height="5" rx="1"/><rect x="207" y="143" width="7" height="5" rx="1"/><rect x="220" y="143" width="7" height="5" rx="1"/><rect x="233" y="143" width="7" height="5" rx="1"/></g><circle cx="225" cy="158" r="4" fill="#728fa9"/>
 <rect x="55" y="178" width="198" height="18" rx="2" fill="#bdcddc"/><path d="M163 181h79m-79 4h79m-79 4h79" stroke="#a0b4c6"/><text x="66" y="190" fill="#4d657d" font-family="Arial,sans-serif" font-size="10" font-weight="800" letter-spacing="2">LTD · CNC</text>
 <path d="M53 208h28v7H53zm177 0h28v7h-28z" fill="#536e88"/>
 <path d="M282 35v18" stroke="#7d92a7" stroke-width="4"/>
 <rect x="274" y="4" width="16" height="31" rx="4" fill="#2c445d"/><rect class="cnc-tower-red" x="277" y="7" width="10" height="6" rx="2"/><rect class="cnc-tower-amber" x="277" y="17" width="10" height="6" rx="2"/><rect class="cnc-tower-green" x="277" y="27" width="10" height="5" rx="2"/>
 <path d="m274 78 22-14v114l-22 14Z" fill="#0e2235" opacity=".2"/>
 </svg>`;
}
function instrument(label,value,unit,kind,active){
 const content=String(value);
 return `<div class="cnc-instrument ${kind}${active?' is-active':''}${content.length>6?' has-long-value':''}"><div class="cnc-instrument-face"><svg viewBox="0 0 140 140" fill="none" aria-hidden="true"><circle cx="70" cy="70" r="60" class="cnc-dial-track"/><circle cx="70" cy="70" r="60" class="cnc-dial-ticks"/><circle cx="70" cy="70" r="49" class="cnc-dial-inner"/><path d="M23 107a60 60 0 0 1 0-74" class="cnc-dial-accent"/></svg><div class="cnc-instrument-reading"><span class="cnc-instrument-symbol" aria-hidden="true">${kind==='spindle'?'S':'F'}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong></div></div><span class="cnc-instrument-label">${label}</span></div>`;
}
const productionIcons={parts:'<path d="m3 6 9-4 9 4-9 4-9-4Zm0 0v11l9 5 9-5V6M12 10v12"/>',run:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',cycle:'<path d="M17 3h4v4M21 7a9 9 0 1 0 0 10M12 6v6l-3 2"/>'};
const settingsIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5 1.8-1 2.2 2.2-1 1.8.6 1.5 2 .6v3.1l-2 .6-.6 1.5 1 1.8-2.2 2.2-1.8-1-1.5.6-.6 2H9.3l-.6-2-1.5-.6-1.8 1-2.2-2.2 1-1.8-.6-1.5-2-.6v-3.1l2-.6.6-1.5-1-1.8 2.2-2.2 1.8 1 1.5-.6.6-2h3.1l.6 2 1.5.6Z" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="11.6" r="3" stroke="currentColor" stroke-width="1.3"/></svg>';
const deleteIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
function metric(label,value,unit='',extra='',icon=''){
 return `<div class="cnc-metric ${extra}">${icon?`<svg class="cnc-production-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${productionIcons[icon]}</svg>`:''}<span>${label}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong></div>`;
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
   <div class="cnc-machine-identity"><div><span class="cnc-controller">${esc(c.model||'CNC Controller')}</span><h3>${esc(c.name)}</h3></div></div>
   <span class="cnc-status ${esc(signal.css)}"><span class="cnc-state-light ${esc(signal.css)}" aria-hidden="true"></span>${esc(signal.label)}</span>
  </header>
  <div class="cnc-machine-content">
   <div class="cnc-machine-visual"><div class="cnc-art-stage${visible&&Number(c.spindleSpeed)>0?' is-spinning':''}">${machineIllustration(c.id)}<span>Minh họa CNC</span></div>
   <div class="cnc-program-line"><div><span>Chương trình hiện tại:</span><strong>${esc(visible?c.activeProgram||'Chưa đọc':'—')}</strong></div><div class="cnc-operating-mode"><span>Chế độ</span><strong>${real&&visible?esc(cncMode(c.rawStatus?.aut)):'—'}</strong></div></div>
   </div><div class="cnc-instrument-grid">${instrument('Vòng quay trục chính',measurement(c.spindleSpeed),'RPM','spindle',visible&&Number(c.spindleSpeed)>0)}${instrument('Tốc độ ăn dao',measurement(c.feedrate),real?c.feedrateUnit||'':'mm/min','feed',visible&&Number(c.feedrate)>0)}</div>
   <div class="cnc-production-grid">${metric('PART COUNT:',real?measurement(c.partCounter):'—','','cnc-parts','parts')}${metric('RUN TIME:',real&&visible?cncDuration(c.runTimeMs):'—','','','run')}${metric('CYCLE TIME:',real&&visible?cncDuration(c.cycleTimeMs):'—','','','cycle')}</div>
   ${alarmPanel}
   ${!visible?'<div class="cnc-unavailable">Chưa có tín hiệu mới · Thông số tạm thời không khả dụng.</div>':''}
   ${readErrors.length?`<details class="cnc-read-errors"${errorsOpen?' open':''}><summary>Một số mục chưa đọc được</summary><p>${esc(readErrors.join('; '))}</p></details>`:''}
  </div>
  <footer class="cnc-machine-footer"><div class="cnc-connection-meta"><span>${esc(source)}</span><span>${esc(c.ip||'—')}:${esc(c.port??'—')}</span><time>${esc(last)}</time></div>
   <div class="cnc-machine-actions"><button class="btn cnc-history-btn" type="button" data-cnc-action="history" data-cnc-id="${esc(c.id)}">Alarm của máy <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="cnc-icon-action" type="button" data-cnc-action="edit" data-cnc-id="${esc(c.id)}" title="Sửa IP" aria-label="Sửa IP ${esc(c.name)}">${settingsIcon}</button><button class="cnc-icon-action cnc-delete-action" type="button" data-cnc-action="delete" data-cnc-id="${esc(c.id)}" title="Xóa máy" aria-label="Xóa máy ${esc(c.name)}">${deleteIcon}</button></div>
  </footer>
 </article>`;
}
