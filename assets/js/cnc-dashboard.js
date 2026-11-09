// Shared status-module URL keeps the dashboard on the same calibrated Firebase clock as app.js.
import {cncDisplayState,cncIsFresh,cncMeasurement,cncMode,cncDuration,cncServerNow} from './cnc-status.js?v=20261029-web-sync';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function dailyCharts(day,instruments){
 const r=day?.row||{sessions:0,counterStart:null,counterEnd:null,observedMs:0,runningMs:0,holdMs:0,alarmMs:0},known=r.sessions>0,number=v=>Number.isSafeInteger(v)?v.toLocaleString('vi-VN'):'—';
 const date=day?.date||new Date(cncServerNow()+7*3600000).toISOString().slice(0,10);
 const total=r.observedMs,run=total?r.runningMs/total*100:0,hold=total?r.holdMs/total*100:0,alarm=total?r.alarmMs/total*100:0;
 const comparable=Number.isSafeInteger(r.counterStart)&&Number.isSafeInteger(r.counterEnd)&&r.counterEnd>=r.counterStart&&!r.counterResets;
 const baseline=comparable&&r.counterEnd>0?r.counterStart/r.counterEnd*100:100;
 const increase=comparable?r.counterEnd-r.counterStart:null;
 return `<section class="cnc-day-charts"><div class="cnc-day-title">THÔNG SỐ VẬN HÀNH <span class="cnc-day-date${!known?' is-pending':''}" title="${esc(day?.error||(!known?'Chưa có dữ liệu thống kê ngày':r.conflicts?'Thống kê đã loại phiên trùng':'Thống kê trong ngày'))}">${esc(date.split('-').reverse().join('/'))}</span></div>
 <div class="cnc-four-gauges"><div class="cnc-day-parts"><span class="cnc-day-label">PART COUNT</span><div class="cnc-day-ring cnc-part-ring${!comparable||r.counterEnd===0?' is-neutral':''}" style="--baseline:${baseline}%" title="${esc(`Đầu ngày: ${number(r.counterStart)} · Hiện tại: ${number(r.counterEnd)}`)}"><div><strong>${number(r.counterEnd)}</strong><small>Bộ đếm CNC</small></div></div><div class="cnc-count-comparison"><label>Đầu ngày <b>${number(r.counterStart)}</b></label><label>Hiện tại <b>${number(r.counterEnd)}</b></label></div>${increase!==null?`<small class="cnc-part-increase">+${number(increase)} trong ngày</small>`:r.counterResets?'<small class="cnc-part-increase">Bộ đếm đã reset</small>':'<small class="cnc-part-increase is-pending">—</small>'}</div>
 <div class="cnc-day-runtime"><span class="cnc-day-label">CHẠY TRONG NGÀY</span><div class="cnc-day-ring" title="${esc(`Chạy: ${cncDuration(r.runningMs)} · Hold: ${cncDuration(r.holdMs)} · Alarm: ${cncDuration(r.alarmMs)}`)}" style="--run:${run}%;--hold:${run+hold}%;--alarm:${run+hold+alarm}%"><div><strong>${known?esc(cncDuration(r.runningMs)):'—'}</strong><small>giờ : phút : giây</small></div></div><div class="cnc-day-legend"><span>● Chạy</span><span>● Tạm dừng</span><span>● Lỗi</span><span>● Dừng / khác</span></div></div>${instruments}</div>
</section>`;
}
const stateSeries=[['runningMs','Chạy','run'],['stoppedMs','Dừng / Hold','stop'],['alarmMs','Lỗi','alarm'],['unknownStateMs','Chưa xác định','unknown']];
function stateValues(row){return {runningMs:row?.runningMs||0,stoppedMs:(row?.idleMs||0)+(row?.holdMs||0),alarmMs:row?.alarmMs||0,unknownStateMs:row?.unknownStateMs||0};}
function stateChart(title,rows,{weekly=false,error='',date=''}={}){
 const totals=rows.reduce((sum,row)=>{const values=stateValues(row);for(const [key] of stateSeries)sum[key]=(sum[key]||0)+values[key];return sum;},{});
 const total=Object.values(totals).reduce((a,b)=>a+b,0),percent=total?Math.round((totals.runningMs||0)/total*100):null;
 const legend=stateSeries.map(([key,label,css])=>`<li><i class="state-${css}"></i><span>${label}</span><b>${total?cncDuration(totals[key]||0):'—'}</b></li>`).join('');
 let chart;
 if(weekly){
  chart=`<div class="cnc-week-bars" role="img" aria-label="Thời gian chạy, dừng và lỗi theo ngày trong tuần">${rows.map(row=>{const values=stateValues(row),observed=Object.values(values).reduce((a,b)=>a+b,0),scale=86400000;return `<div class="cnc-week-day"><div class="cnc-week-column" title="${esc(row.day)} · ${stateSeries.map(([key,label])=>`${label}: ${cncDuration(values[key])}`).join(' · ')}">${stateSeries.map(([key,,css])=>`<span class="state-${css}" style="height:${values[key]/scale*100}%"></span>`).join('')}</div><b>${esc(row.day?.slice(8)||'—')}</b><small>${observed?Math.round(values.runningMs/observed*100)+'%':'—'}</small></div>`}).join('')}</div>`;
 }else{
  let end=0;const stops=stateSeries.map(([key,,css])=>{const start=end;end+=total?(totals[key]||0)/total*100:0;return `var(--state-${css}) ${start}% ${end}%`;}).join(',');
  chart=`<div class="cnc-state-donut" style="--state-fill:${total?`conic-gradient(${stops})`:'#405369'}" role="img" aria-label="Tỷ lệ chạy ${percent??'chưa có dữ liệu'}${percent===null?'':' phần trăm'}"><div><strong>${percent===null?'—':percent+'%'}</strong><small>Thời gian chạy</small></div></div>`;
 }
 return `<section class="cnc-state-chart" data-state-period="${weekly?'week':'day'}"><h4>${title}</h4><span class="cnc-state-period">${esc(date)}</span>${chart}${weekly?'<small class="cnc-state-scale">24 giờ / ngày</small>':''}<ul>${legend}</ul>${error?`<p class="cnc-state-note">${esc(error)}</p>`:!total?'<p class="cnc-state-note">Chưa có dữ liệu</p>':'<p class="cnc-state-note">Tỷ lệ trên thời gian có dữ liệu</p>'}</section>`;
}
function productivityCharts(daily){
 const date=daily?.date||new Date(cncServerNow()+7*3600000).toISOString().slice(0,10),today=+new Date(date+'T00:00:00+07:00'),start=today-((new Date(today+7*3600000).getUTCDay()+6)%7)*86400000;
 const week=Array.from({length:7},(_,i)=>{const day=new Date(start+i*86400000+7*3600000).toISOString().slice(0,10);return daily?.week?.find(row=>row.day===day)||{day};});
 return stateChart('TRONG NGÀY',daily?.row?[daily.row]:[],{date:date.split('-').reverse().join('/'),error:daily?.error})+stateChart('TRONG TUẦN',week,{weekly:true,date:daily?.weekStart?daily.weekStart.split('-').reverse().join('/')+' – '+date.split('-').reverse().join('/'):'Thứ Hai – Chủ Nhật',error:daily?.error});
}
function instrument(label,value,unit,kind,active){
 const content=String(value);
 return `<div class="cnc-instrument ${kind}${active?' is-active':''}${content.length>6?' has-long-value':''}"><div class="cnc-instrument-face"><svg viewBox="0 0 140 140" fill="none" aria-hidden="true"><circle cx="70" cy="70" r="60" class="cnc-dial-track"/><circle cx="70" cy="70" r="60" class="cnc-dial-ticks"/><circle cx="70" cy="70" r="49" class="cnc-dial-inner"/><path d="M23 107a60 60 0 0 1 0-74" class="cnc-dial-accent"/></svg><div class="cnc-instrument-reading"><span class="cnc-instrument-symbol" aria-hidden="true">${kind==='spindle'?'S':'F'}</span><strong>${esc(value)}${unit?` <small>${esc(unit)}</small>`:''}</strong></div></div><span class="cnc-instrument-label">${label}</span></div>`;
}
const settingsIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14.5 5 1.8-1 2.2 2.2-1 1.8.6 1.5 2 .6v3.1l-2 .6-.6 1.5 1 1.8-2.2 2.2-1.8-1-1.5.6-.6 2H9.3l-.6-2-1.5-.6-1.8 1-2.2-2.2 1-1.8-.6-1.5-2-.6v-3.1l2-.6.6-1.5-1-1.8 2.2-2.2 1.8 1 1.5-.6.6-2h3.1l.6 2 1.5.6Z" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="11.6" r="3" stroke="currentColor" stroke-width="1.3"/></svg>';
const deleteIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
export function renderCncMachineCard(c,{errorsOpen=false,daily=null,statistics=false}={}){
 const signal=cncDisplayState(c),fresh=cncIsFresh(c),visible=fresh||c.source==='demo',real=c.source==='focas';
 const source=real?'Dữ liệu thật · FOCAS':c.source==='demo'?'Dữ liệu mô phỏng':'Chưa xác minh nguồn';
 const measurement=value=>visible?cncMeasurement(value):'—';
 const date=new Date(c.lastSeen),last=c.lastSeen&&Number.isFinite(+date)?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date):'Chờ tín hiệu đầu tiên';
 const alarms=visible&&real&&Array.isArray(c.alarmDetails)?c.alarmDetails:[];
 const alarmPanel=alarms.length?`<div class="cnc-live-alarm">${alarms.map(a=>`<div><strong>Alarm ${esc(a.number)}${Number.isInteger(c.machiningContext?.toolNumber)?` · T${c.machiningContext.toolNumber}`:''}${a.axis>0?` · Trục ${esc(a.axis)}`:''}</strong><p>${esc(a.message||'CNC không trả nội dung lỗi')}</p></div>`).join('')}${c.alarmsMayBeTruncated?'<small>Có thể còn Alarm khác trên CNC.</small>':''}</div>`:signal.status==='alarm'?`<div class="cnc-live-alarm"><strong>${c.rawStatus?.emergency?'Tín hiệu Emergency':'Có tín hiệu Alarm'}</strong><p>${esc(real?'Chưa có nội dung lỗi chi tiết.':c.alarm||'')}</p></div>`:'';
 const context=c.machiningContext;
 const tool=real&&visible&&context?.spindleToolConfirmed===true&&Number.isInteger(context?.spindleToolNumber)?'T'+context.spindleToolNumber:'—';
 const readErrors=visible&&c.readErrors?Object.values(c.readErrors).filter(Boolean):[];
 return `<article class="cnc-card cnc-machine-panel is-${esc(signal.css)}" id="card-${esc(c.id)}" data-machine-id="${esc(c.id)}">
  <header class="cnc-machine-heading">
   <div class="cnc-machine-identity"><div><span class="cnc-controller">${esc(c.model||'CNC Controller')}</span><h3>${esc(c.name)}</h3></div></div>
   <span class="cnc-status ${esc(signal.css)}"><span class="cnc-state-light ${esc(signal.css)}" aria-hidden="true"></span>${esc(signal.status==='offline'&&real?'MẤT KẾT NỐI':signal.label)}</span>
  </header>
  <div class="cnc-machine-content">
   <div class="cnc-program-line cnc-operation-strip"><div class="cnc-operating-mode"><span>Chế độ</span><strong>${real&&visible?esc(cncMode(c.rawStatus?.aut)):'—'}</strong></div><div><span>Chương trình</span><strong>${esc(visible?c.activeProgram||'Chưa đọc':'—')}</strong></div><div class="cnc-tool-number" title="${esc(context?.toolSource||'Mã T do CNC trả về; chưa xác nhận dao vật lý trên trục chính')}"><span>Dao trục chính</span><strong>${esc(tool)}</strong></div><div><span>CYCLE TIME:</span><strong>${real&&visible?cncDuration(c.cycleTimeMs):'—'}</strong></div><div><span>RUN TIME:</span><strong>${real&&visible?cncDuration(c.runTimeMs):'—'}</strong></div><div><span>PART COUNT:</span><strong>${real?measurement(c.partCounter):'—'}</strong></div></div>
   ${statistics?`<div class="cnc-productivity-grid">${productivityCharts(daily)}</div>`:dailyCharts(daily,instrument('TỐC ĐỘ TRỤC CHÍNH',measurement(c.spindleSpeed),'RPM','spindle',visible&&Number(c.spindleSpeed)>0)+instrument('TỐC ĐỘ ĂN DAO',measurement(c.feedrate),real?c.feedrateUnit||'':'mm/min','feed',visible&&Number(c.feedrate)>0))}
   ${alarmPanel}
   ${readErrors.length?`<details class="cnc-read-errors"${errorsOpen?' open':''}><summary>Một số mục chưa đọc được</summary><p>${esc(readErrors.join('; '))}</p></details>`:''}
  </div>
  <footer class="cnc-machine-footer"><div class="cnc-connection-meta"><span>${esc(source)}</span><span>${esc(c.ip||'—')}:${esc(c.port??'—')}</span><time>${esc(last)}</time></div>
   <div class="cnc-machine-actions"><button class="btn cnc-history-btn" type="button" data-cnc-action="history" data-cnc-id="${esc(c.id)}">Alarm của máy <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="cnc-icon-action" type="button" data-cnc-action="edit" data-cnc-id="${esc(c.id)}" title="Cài đặt máy" aria-label="Cài đặt máy ${esc(c.name)}">${settingsIcon}</button><button class="cnc-icon-action cnc-delete-action" type="button" data-cnc-action="delete" data-cnc-id="${esc(c.id)}" title="Xóa máy" aria-label="Xóa máy ${esc(c.name)}">${deleteIcon}</button></div>
  </footer>
 </article>`;
}
