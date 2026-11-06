// Browser-session history only. No fabricated samples, inferred production, or Firebase writes.
import {cncDisplayState,cncIsFresh,cncServerNow} from './cnc-status.js?v=20261029-web-sync';
const WINDOW=30*60*1000,GAP=15000,MAX_POINTS=1200;
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const clock=(ms,seconds=false)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{}),hourCycle:'h23'}).format(ms);
const number=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:9}).format(value);
export const CHART_STATES=[['running','Đang chạy','#20a77a'],['hold','Tạm dừng','#e0b13e'],['idle','Dừng / chờ','#7d93b0'],['alarm','Alarm','#dc5c69'],['offline','Mất kết nối','#aab4c1'],['unknown','Chưa xác minh','#d8dfe8']];
export class CncTraceStore{
 constructor(){this.traces=new Map()}
 capture(machines,now){
  const ids=new Set(machines.map(c=>c.id));for(const id of this.traces.keys())if(!ids.has(id))this.traces.delete(id);
  for(const c of machines){
   let trace=this.traces.get(c.id)||[];
   if(trace.length&&trace[trace.length-1].at>now+5000)trace=[]; // Clock calibration/rollback: never keep future samples.
   trace=trace.filter(p=>p.at>=now-WINDOW-GAP);
   const at=new Date(c.lastSeen).getTime();
   if(cncIsFresh(c,now)&&Number.isFinite(at)){
    const previous=trace[trace.length-1];
    if(!previous||at>previous.at)trace.push({at,state:cncDisplayState(c,now).status,spindle:numeric(c.spindleSpeed)?c.spindleSpeed:null,feed:numeric(c.feedrate)?c.feedrate:null,feedUnit:String(c.feedrateUnit||''),parts:numeric(c.partCounter)?c.partCounter:null});
   }else if(trace.length&&!trace[trace.length-1].gap&&now>trace[trace.length-1].at)trace.push({at:now,gap:true});
   this.traces.set(c.id,trace.slice(-MAX_POINTS));
  }
 }
 get(id){return this.traces.get(id)||[]}
}
export function chartSeries(trace,metric,from,until,unit){
 const segments=[];let current=[],previous=null;
 for(const point of trace){
  if(point.at<from-GAP||point.at>until)continue;
  const value=point[metric],valid=!point.gap&&numeric(value)&&(metric!=='feed'||point.feedUnit===unit);
  if(!valid){if(current.length)segments.push(current);current=[];previous=null;continue}
  if(previous&&point.at-previous.at>GAP){if(current.length)segments.push(current);current=[]}
  current.push({at:point.at,value});previous=point;
 }
 if(current.length)segments.push(current);
 return segments.filter(group=>group.some(point=>point.at>=from));
}
function scaleMaximum(segments){
 let max=0;for(const group of segments)for(const p of group)max=Math.max(max,p.value);
 if(max===0)return {max:4,step:1};
 const rough=max/4,base=10**Math.floor(Math.log10(rough)),factor=rough/base;
 const step=(factor<=1?1:factor<=2?2:factor<=5?5:10)*base;
 return {max:Math.ceil(max/step)*step,step};
}
export function fleetCounts(machines,now){
 const counts=Object.fromEntries(CHART_STATES.map(([key])=>[key,0]));
 for(const machine of machines){const key=cncDisplayState(machine,now).status;counts[key in counts?key:'unknown']++}
 return counts;
}
function donut(counts){
 const total=Object.values(counts).reduce((a,b)=>a+b,0),circumference=2*Math.PI*56;let offset=0;
 const arcs=CHART_STATES.map(([key,label,color])=>{
  const length=total?counts[key]/total*circumference:0;
  const path=length?`<circle class="cnc-donut-arc" cx="78" cy="78" r="56" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 78 78)"><title>${label}: ${counts[key]} máy</title></circle>`:'';offset+=length;return path;
 }).join('');
 return `<svg class="cnc-donut" viewBox="0 0 156 156" role="img" aria-label="Phân bố trạng thái ${total} máy"><circle cx="78" cy="78" r="56" fill="none" stroke="#edf1f6" stroke-width="14"/>${arcs}<text x="78" y="79" text-anchor="middle" class="cnc-donut-number">${total}</text><text x="78" y="98" text-anchor="middle" class="cnc-donut-label">THIẾT BỊ</text></svg>`;
}
function metricInfo(metric,machine){return metric==='feed'?['Tốc độ ăn dao',machine?.feedrateUnit||'']:metric==='parts'?['PART COUNT','']:['Tốc độ trục chính','RPM']}
function trendSvg(trace,metric,from,until,unit,width){
 const height=205,left=48,right=14,top=18,bottom=31,w=width-left-right,h=height-top-bottom;
 const x=at=>left+Math.max(0,Math.min(1,(at-from)/(until-from)))*w;
 const segments=chartSeries(trace,metric,from,until,unit),scale=scaleMaximum(segments),max=scale.max,y=value=>top+h-value/max*h;
 const grid=Array.from({length:Math.round(max/scale.step)+1},(_,i)=>{const value=scale.step*i,at=y(value);return `<path d="M${left} ${at}H${width-right}" class="cnc-chart-grid"/><text x="${left-8}" y="${at+3}" text-anchor="end">${esc(number(value))}</text>`}).join('');
 const times=Array.from({length:4},(_,i)=>{const at=from+(until-from)*i/3;return `<text x="${x(at)}" y="${height-8}" text-anchor="${i===0?'start':i===3?'end':'middle'}">${clock(at,until-from<120000)}</text>`}).join('');
 const lines=segments.map(points=>{
  const coordinates=points.map(p=>`${x(p.at).toFixed(2)} ${y(p.value).toFixed(2)}`),path=metric==='parts'?'M'+coordinates[0]+points.slice(1).map(p=>`H${x(p.at).toFixed(2)}V${y(p.value).toFixed(2)}`).join(''):'M'+coordinates.join('L');
  const area=points.length>1?`<path d="${path}L${x(points[points.length-1].at)} ${top+h}L${x(points[0].at)} ${top+h}Z" fill="url(#cncTrendFill)"/>`:'';
  return `${area}${points.length>1?`<path d="${path}" class="cnc-trend-path"/>`:''}${points.map((p,i)=>`<circle cx="${x(p.at)}" cy="${y(p.value)}" r="${i===points.length-1?3:2}" class="cnc-trend-point${i===points.length-1?' is-tail':''}"><title>${clock(p.at,true)} · ${number(p.value)} ${esc(unit)}</title></circle>`).join('')}`;
 }).join('');
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ ${esc(metricInfo(metric)[0])} theo thời gian"><defs><linearGradient id="cncTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3d8de2" stop-opacity=".18"/><stop offset="100%" stop-color="#3d8de2" stop-opacity=".01"/></linearGradient></defs>${grid}${times}${lines}${segments.length?'':`<text x="${left+w/2}" y="${top+h/2}" text-anchor="middle" class="cnc-chart-empty">Đang chờ dữ liệu thực</text>`}</svg>`;
}
function timeline(trace,from,until){
 const blocks=[];
 for(let i=0;i<trace.length;i++){
  const p=trace[i],next=trace[i+1],end=next?next.at:until;
  if(p.gap||end<=from||p.at>=until||end-p.at>GAP)continue;
  const a=Math.max(p.at,from),b=Math.min(end,until),state=CHART_STATES.find(([key])=>key===p.state)||CHART_STATES[5];
  if(b>a)blocks.push(`<span title="${esc(state[1])} · ${clock(a,true)} – ${clock(b,true)}" style="left:${(a-from)/(until-from)*100}%;width:${(b-a)/(until-from)*100}%;background:${state[2]}"></span>`);
 }
 return blocks.join('');
}
export class CncLiveCharts{
 constructor(root){
  this.root=root;this.store=new CncTraceStore();this.machineId='';this.metric='spindle';this.windowMs=15*60*1000;this.machines=[];
  if(!root)return;
  root.innerHTML=`<article class="cnc-composition-panel"><header><div><span class="cnc-chart-eyebrow">FLEET STATUS</span><h3>Phân bố trạng thái</h3></div><span class="cnc-chart-live">HIỆN TẠI</span></header><div class="cnc-composition-body"><div class="cnc-donut-slot"></div><div class="cnc-state-legend"></div></div></article><article class="cnc-trend-panel"><header><div><span class="cnc-chart-eyebrow">LIVE TREND</span><h3>Diễn biến vận hành</h3></div><div class="cnc-chart-controls"><select data-chart-control="machine" aria-label="Máy trên biểu đồ"></select><select data-chart-control="metric" aria-label="Thông số biểu đồ"><option value="spindle">Trục chính</option><option value="feed">Ăn dao</option><option value="parts">PART COUNT</option></select><select data-chart-control="window" aria-label="Khoảng thời gian biểu đồ"><option value="15">15 phút</option><option value="30">30 phút</option></select></div></header><div class="cnc-trend-caption"><span class="cnc-trend-title"></span><strong class="cnc-trend-value"></strong><span class="cnc-trend-status"></span></div><div class="cnc-trend-plot"></div><div class="cnc-state-history"><span>TÍN HIỆU TRẠNG THÁI</span><div class="cnc-state-track"></div><small>Dữ liệu trong phiên xem · Khoảng trống: chưa có tín hiệu</small></div></article>`;
  root.addEventListener('change',event=>{
   const key=event.target.dataset.chartControl;if(!key)return;
   if(key==='machine')this.machineId=event.target.value;
   if(key==='metric')this.metric=event.target.value;
   if(key==='window')this.windowMs=Number(event.target.value)*60000;
   this.render();
  });
  if(typeof ResizeObserver!=='undefined'){
   this.observer=new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width&&width!==this.lastWidth){this.lastWidth=width;this.render()}});this.observer.observe(root.querySelector('.cnc-trend-plot'));
  }
 }
 update(machines,now=cncServerNow()){
  this.machines=machines;this.store.capture(machines,now);if(this.root)this.render(now);
 }
 render(now=cncServerNow()){
  if(!this.root)return;
  const counts=fleetCounts(this.machines,now);
  this.root.querySelector('.cnc-donut-slot').innerHTML=donut(counts);
  this.root.querySelector('.cnc-state-legend').innerHTML=CHART_STATES.filter(([key])=>key!=='unknown'||counts.unknown).map(([key,label,color])=>`<div><i style="background:${color}"></i><span>${label}</span><strong>${counts[key]}</strong></div>`).join('');
  const signature=JSON.stringify(this.machines.map(c=>[c.id,c.name])),select=this.root.querySelector('[data-chart-control="machine"]');
  if(signature!==this.signature){
   if(!this.machines.some(c=>c.id===this.machineId))this.machineId=this.machines.find(c=>cncIsFresh(c,now))?.id||this.machines[0]?.id||'';
   select.innerHTML=this.machines.length?this.machines.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''):'<option>Chưa có máy</option>';select.value=this.machineId;select.disabled=!this.machines.length;this.signature=signature;
  }
  const machine=this.machines.find(c=>c.id===this.machineId),trace=this.store.get(this.machineId),[title,unit]=metricInfo(this.metric,machine),fresh=machine&&cncIsFresh(machine,now);
  const value=machine&&({spindle:machine.spindleSpeed,feed:machine.feedrate,parts:machine.partCounter})[this.metric];
  this.root.querySelector('.cnc-trend-title').textContent=title;
  this.root.querySelector('.cnc-trend-value').textContent=(fresh&&numeric(value)?number(value):'—')+(unit?' '+unit:'');
  this.root.querySelector('.cnc-trend-status').textContent=fresh?'● Đang cập nhật':'Chưa có tín hiệu mới';
  this.root.querySelector('.cnc-trend-status').classList.toggle('is-live',!!fresh);
  const plot=this.root.querySelector('.cnc-trend-plot'),width=Math.max(280,Math.min(1000,plot.clientWidth||640));
  // Start with the real observed span (at least 30s), expanding up to the selected window.
  const earliest=trace.find(point=>!point.gap)?.at;
  const from=Math.max(now-this.windowMs,Number.isFinite(earliest)?Math.min(earliest,now-30000):now-this.windowMs);
  plot.innerHTML=trendSvg(trace,this.metric,from,now,unit,width);
  this.root.querySelector('.cnc-state-track').innerHTML=timeline(trace,from,now);
 }
}
