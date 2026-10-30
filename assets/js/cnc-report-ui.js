import {reportPeriod,buildCncReport,reportSheets,cycleDuration,vnDate} from './cnc-reports.js?v=20261030-daily-table';
import {createCncWorkbook} from './cnc-xlsx.js?v=20261029-status-only';
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
 const rows=report.summary,run=rows.reduce((s,r)=>s+r.runningMs,0),hold=rows.reduce((s,r)=>s+r.holdMs,0),alarm=rows.reduce((s,r)=>s+r.alarmMs,0);
 const count=rows.every(r=>r.rawCount!==null)?rows.reduce((s,r)=>s+r.rawCount,0):null;
 const sheets=reportSheets(report);
 const table=sheet=>`<div class="cr-scroll"><table><thead><tr>${sheet.rows[sheet.header].map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${sheet.rows.slice(sheet.header+1).map(row=>`<tr>${row.map(v=>`<td>${typeof v==='number'?n(v):esc(v??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return `<header class="cr-heading"><h2>Báo cáo CNC</h2><p>${esc(report.period.startDate)} — ${esc(report.period.endDate)} · Giờ Việt Nam</p></header>
 <div class="cr-kpis"><article><span>RUN</span><strong>${cycleDuration(run)}</strong></article><article><span>Alarm</span><strong>${cycleDuration(alarm)}</strong></article><article><span>HOLD</span><strong>${cycleDuration(hold)}</strong></article><article><span>PART COUNT tăng</span><strong>${n(count)}</strong></article></div>
 <p class="cr-notice">Bắt đầu khi quan sát START; kết thúc khi quan sát STOP/RESET. Chỉ đọc trạng thái CNC qua FOCAS, không đọc PMC. Không xác nhận lệnh M30. Thời gian chạy (RUN) không gồm Alarm/HOLD; thời gian từ bắt đầu đến kết thúc bao gồm các khoảng đó. Không tính thời gian mất dữ liệu thành giờ dừng. Các mốc có sai số theo nhịp đọc cầu nối, thường khoảng 5 giây cộng thời gian kết nối. HOLD rồi chạy tiếp vẫn cùng một chu kỳ.</p>
 <h3>Tổng quan</h3>${table(sheets[0])}<h3>Theo ngày</h3>${table(sheets[1])}`;
}
function ensureDialog(){
 if(dialog)return;
 dialog=document.createElement('dialog');dialog.id='cncReportDialog';dialog.className='cr-dialog';
 dialog.innerHTML=`<div class="cr-toolbar"><h2>Báo cáo vận hành CNC</h2><button type="button" class="btn" data-action="close">Đóng</button></div><form class="cr-filters"><label>Máy<select name="machine"></select></label><label>Kỳ báo cáo<select name="period"><option value="week">Tuần (thứ Hai — Chủ nhật)</option><option value="month" selected>Tháng</option><option value="quarter">Quý</option></select></label><label>Ngày thuộc kỳ<input class="input" name="anchor" type="date" required></label><button class="btn primary" type="submit">Xem báo cáo</button></form><p class="cr-status" role="status"></p><div class="cr-actions"><button class="btn primary" type="button" data-action="xlsx" disabled>Xuất Excel (.xlsx)</button><button class="btn" type="button" data-action="print" disabled>In / Lưu PDF</button></div><section class="cr-report"></section>`;
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
