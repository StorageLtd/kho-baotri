import {reportPeriod,buildCncReport,reportSheets,hours,vnDate} from './cnc-reports.js?v=20261029-reports';
import {createCncWorkbook} from './cnc-xlsx.js?v=20261029-reports';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const n=v=>v===null||v===undefined?'—':Number(v).toLocaleString('vi-VN',{maximumFractionDigits:2});
const pct=v=>v===null?'—':n(v*100)+'%';
let dialog,options,result,revision=0;
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
async function loadMachine(id,period,token){
 const query=new URLSearchParams({auth:token,orderBy:JSON.stringify('$key'),startAt:JSON.stringify(period.startDate),endAt:JSON.stringify(period.endDate)});
 const response=await fetch(`${options.databaseUrl}/cncReports/${encodeURIComponent(id)}.json?${query}`,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(response.status===401||response.status===403?'Chưa có quyền đọc thống kê. Quản trị viên cần Publish nhánh Rules cncReports trong Firebase; không mở quyền công khai.':`Không tải được báo cáo (HTTP ${response.status}).`);
 return await response.json()||{};
}
function renderReport(report){
 const rows=report.summary,observed=rows.reduce((s,r)=>s+r.observedMs,0),windowMs=rows.reduce((s,r)=>s+r.windowMs,0),run=rows.reduce((s,r)=>s+r.runningMs,0),allParts=rows.length>0&&rows.every(r=>r.production!==null);
 const totalsByDay=new Map();for(const r of report.daily){if(!totalsByDay.has(r.day))totalsByDay.set(r.day,{day:r.day,windowMs:0,runningMs:0,idleMs:0,holdMs:0,alarmMs:0,unknownStateMs:0,missingMs:0});const day=totalsByDay.get(r.day);for(const key of Object.keys(day))if(key!=='day')day[key]+=r[key]}
 const bars=[...totalsByDay.values()].map(r=>`<div class="cr-bar-row"><span>${esc(r.day.slice(5))}</span><div class="cr-bar" role="img" aria-label="${esc(r.day)}: chạy ${n(hours(r.runningMs))} giờ, mất dữ liệu ${n(hours(r.missingMs))} giờ">${['runningMs','idleMs','holdMs','alarmMs','unknownStateMs','missingMs'].map(key=>`<i class="cr-${key}" style="width:${r.windowMs?r[key]/r.windowMs*100:0}%" title="${esc(key)}: ${n(hours(r[key]))} h"></i>`).join('')}</div><strong>${n(hours(r.runningMs))} h RUN</strong></div>`).join('');
 return `<header class="cr-heading"><span>LTD VIET NAM · OPERATIONS REPORT</span><h2>Báo cáo vận hành CNC</h2><p>${esc(report.period.startDate)} — ${esc(report.period.endDate)} · Giờ Việt Nam</p><small>Dữ liệu tới ${esc(new Date(report.period.through).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))} · ${rows.length} máy</small></header>
 <div class="cr-kpis"><article><span>Thời gian RUN</span><strong>${n(hours(run))} <small>giờ</small></strong></article><article><span>Độ phủ dữ liệu theo lịch</span><strong>${pct(windowMs?observed/windowMs:0)}</strong></article><article><span>RUN / thời gian có dữ liệu</span><strong>${pct(observed?run/observed:null)}</strong></article><article><span>Sản lượng đã xác nhận</span><strong>${allParts?n(rows.reduce((s,r)=>s+r.production,0)):'Chưa xác nhận'}</strong></article></div>
 <p class="cr-notice">Không có dữ liệu không đồng nghĩa máy dừng. Chưa thu thập giờ setup hoặc lịch ca; tỷ lệ trên không phải OEE. Sản lượng chỉ là phần tăng bộ đếm đã quan sát, có thể thiếu khi mất kết nối/reset.</p>
 <h3>Thời gian vận hành theo ngày</h3><div class="cr-legend"><span class="cr-runningMs">RUN</span><span class="cr-idleMs">Dừng/chờ</span><span class="cr-holdMs">HOLD</span><span class="cr-alarmMs">Alarm</span><span class="cr-unknownStateMs">Không rõ trạng thái</span><span class="cr-missingMs">Mất dữ liệu</span></div><div class="cr-chart">${bars}</div>
 <h3>Tổng hợp theo máy</h3><div class="cr-scroll"><table><thead><tr><th>Máy</th><th>RUN (h)</th><th>Dừng/chờ (h)</th><th>HOLD (h)</th><th>Alarm (h)</th><th>Chưa rõ (h)</th><th>Mất dữ liệu (h)</th><th>Độ phủ</th><th>Tăng bộ đếm CNC</th><th>Sản lượng xác nhận</th><th>Chất lượng</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td>${['runningMs','idleMs','holdMs','alarmMs','unknownStateMs','missingMs'].map(k=>`<td>${n(hours(r[k]))}</td>`).join('')}<td>${pct(r.coverage)}</td><td>${n(r.rawCount)}</td><td>${n(r.production)}</td><td>${esc(r.quality)}${r.counterResets?` · ${n(r.counterResets)} lần reset`:''}</td></tr>`).join('')}</tbody></table></div>
 <details><summary>Chi tiết theo ngày (${report.daily.length} dòng)</summary><div class="cr-scroll"><table><thead><tr><th>Ngày</th><th>Máy</th><th>RUN (h)</th><th>Dừng/chờ (h)</th><th>HOLD (h)</th><th>Alarm (h)</th><th>Mất dữ liệu (h)</th><th>Tăng bộ đếm</th></tr></thead><tbody>${report.daily.map(r=>`<tr><td>${esc(r.day)}</td><td>${esc(r.name)}</td>${['runningMs','idleMs','holdMs','alarmMs','missingMs'].map(k=>`<td>${n(hours(r[k]))}</td>`).join('')}<td>${n(r.rawCounterMs>0?r.counterDelta:null)}</td></tr>`).join('')}</tbody></table></div></details>
 <details><summary>Nguồn dữ liệu và quy tắc tính</summary><ul>${reportSheets(report)[3].rows.slice(5).map(r=>`<li><strong>${esc(r[0])}:</strong> ${esc(r[1])}</li>`).join('')}</ul></details>`;
}
function ensureDialog(){
 if(dialog)return;
 dialog=document.createElement('dialog');dialog.id='cncReportDialog';dialog.className='cr-dialog';
 dialog.innerHTML=`<div class="cr-toolbar"><h2>Báo cáo vận hành CNC</h2><button type="button" class="btn" data-action="close">Đóng</button></div><form class="cr-filters"><label>Máy<select name="machine"></select></label><label>Kỳ báo cáo<select name="period"><option value="week">Tuần (thứ Hai — Chủ nhật)</option><option value="month" selected>Tháng</option><option value="quarter">Quý</option></select></label><label>Ngày thuộc kỳ<input class="input" name="anchor" type="date" required></label><button class="btn primary" type="submit">Xem báo cáo</button></form><p class="cr-status" role="status"></p><div class="cr-actions"><button class="btn primary" type="button" data-action="xlsx" disabled>Xuất Excel (.xlsx)</button><button class="btn" type="button" data-action="csv" disabled>CSV chi tiết</button><button class="btn" type="button" data-action="print" disabled>In / Lưu PDF</button></div><section class="cr-report"></section>`;
 document.body.append(dialog);
 dialog.querySelector('[data-action=close]').onclick=()=>{revision++;dialog.close()};
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const request=++revision;const form=event.currentTarget,status=dialog.querySelector('.cr-status'),button=form.querySelector('button'),content=dialog.querySelector('.cr-report');
  result=null;dialog.querySelectorAll('.cr-actions button').forEach(b=>b.disabled=true);button.disabled=true;status.textContent='Đang tải lịch sử và kiểm tra chất lượng dữ liệu…';content.innerHTML='';
  try{
   const kind=form.elements.period.value,anchor=form.elements.anchor.value,period=reportPeriod(kind,anchor),machines=options.getMachines().filter(c=>form.elements.machine.value==='all'||c.id===form.elements.machine.value);
   if(!machines.length)throw new Error('Chưa có máy để lập báo cáo. Chạy cầu nối và gửi dữ liệu trước.');
   const token=await options.getToken();if(!token)throw new Error('Vui lòng đăng nhập lại.');
   const history={};for(let i=0;i<machines.length;i+=3)await Promise.all(machines.slice(i,i+3).map(async c=>history[c.id]=await loadMachine(c.id,period,token)));
   if(request!==revision)return;
   const finalPeriod=reportPeriod(kind,anchor);
   result=buildCncReport(machines,history,finalPeriod);content.innerHTML=renderReport(result);
   const hasData=result.summary.some(r=>r.sessions>0);
   status.textContent=hasData?'Báo cáo được tính từ các phiên FOCAS đã lưu. Hãy xem độ phủ và mục chất lượng trước khi chốt số liệu.':'Chưa có lịch sử trong kỳ. Bản cầu nối mới chỉ tích lũy từ khi được bật; không thể lấy lại số giờ từ trạng thái hiện tại.';
   dialog.querySelectorAll('.cr-actions button').forEach(b=>b.disabled=!hasData);
  }catch(error){if(request===revision)status.textContent=error.message}finally{if(request===revision)button.disabled=false}
 };
 dialog.querySelector('[data-action=xlsx]').onclick=()=>{if(result)download(createCncWorkbook(reportSheets(result)),`LTD-CNC-${result.period.kind}-${result.period.startDate}.xlsx`)};
 dialog.querySelector('[data-action=csv]').onclick=()=>{
  if(!result)return;const sheet=reportSheets(result)[1];
  const csv=sheet.rows.slice(sheet.header).map(row=>row.map(v=>{let text=String(v??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
  download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),`LTD-CNC-chi-tiet-${result.period.startDate}.csv`);
 };
 dialog.querySelector('[data-action=print]').onclick=()=>{
  if(!result)return;const popup=window.open('','_blank');if(!popup){dialog.querySelector('.cr-status').textContent='Trình duyệt đang chặn cửa sổ in.';return}
  popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="UTF-8"><title>LTD CNC Report</title><link rel="stylesheet" href="${new URL('assets/css/cnc-report.css',document.baseURI)}"></head><body class="cr-print">${renderReport(result)}</body></html>`);popup.document.close();popup.onload=()=>{popup.document.querySelectorAll('details').forEach(d=>d.open=true);popup.print()};
 };
}
export function openCncReports(config){
 options=config;ensureDialog();revision++;result=null;dialog.querySelector('form button').disabled=false;dialog.querySelector('.cr-report').innerHTML='';dialog.querySelector('.cr-status').textContent='Chọn kỳ và máy để xem báo cáo từ dữ liệu thật đã lưu.';dialog.querySelectorAll('.cr-actions button').forEach(b=>b.disabled=true);
 const form=dialog.querySelector('form');form.elements.machine.innerHTML='<option value="all">Tất cả máy</option>'+options.getMachines().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 form.elements.anchor.value=vnDate(Date.now());form.elements.anchor.max=vnDate(Date.now());dialog.showModal();
}
