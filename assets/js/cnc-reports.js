const DAY = 86400000;
const ZONE = 7 * 3600000;
export const vnDate = ms => new Date(ms + ZONE).toISOString().slice(0, 10);
export function reportPeriod(kind, anchor, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new Error('Ngày không hợp lệ.');
  const date = new Date(anchor + 'T00:00:00+07:00');
  if (!Number.isFinite(+date) || vnDate(+date) !== anchor) throw new Error('Ngày không hợp lệ.');
  const y = Number(anchor.slice(0,4)), m = Number(anchor.slice(5,7));
  let from, until;
  if (kind === 'week') { from = +date - ((new Date(+date + ZONE).getUTCDay() + 6) % 7) * DAY; until = from + 7 * DAY; }
  else if (kind === 'month') { from = Date.UTC(y,m-1,1)-ZONE; until = Date.UTC(y,m,1)-ZONE; }
  else if (kind === 'quarter') { const q = Math.floor((m-1)/3)*3; from = Date.UTC(y,q,1)-ZONE; until = Date.UTC(y,q+3,1)-ZONE; }
  else throw new Error('Kỳ báo cáo không hợp lệ.');
  if (from >= now) throw new Error('Kỳ đã chọn chưa bắt đầu.');
  return {kind, from, until, through:Math.min(until, now), startDate:vnDate(from), endDate:vnDate(until-1), timeZone:'Asia/Ho_Chi_Minh'};
}
const fields = ['runningMs','idleMs','holdMs','alarmMs','unknownStateMs','observedMs','counterDelta','counterObservedMs','counterResets'];
function empty(machine, day, windowMs) {
  return {machineId:machine.id, name:machine.name, day, windowMs, ...Object.fromEntries(fields.map(f=>[f,0])), sessions:0, conflicts:0, invalid:0, verifiedParts:0, verifiedCounterMs:0, rawCounterMs:0, firstMs:null, lastMs:null};
}
function valid(s, machine, day, from, until) {
  return s?.schemaVersion === 1 && s.source === 'focas' && s.machineId === machine.id && s.date === day &&
    typeof s.sessionId === 'string' && fields.every(f=>Number.isFinite(s[f]) && s[f]>=0) &&
    [s.firstMs,s.lastMs].every(Number.isFinite) && s.firstMs >= from && s.lastMs <= until && s.lastMs >= s.firstMs &&
    s.observedMs === s.runningMs+s.idleMs+s.holdMs+s.alarmMs+s.unknownStateMs && s.observedMs <= s.lastMs-s.firstMs &&
    s.counterObservedMs <= s.observedMs && Number.isSafeInteger(s.counterDelta) && Number.isSafeInteger(s.counterResets);
}
export function buildCncReport(machines, history, period) {
  const daily=[],cycles=[];
  for (const machine of machines) for (let start=period.from; start<period.through; start+=DAY) {
    const end=Math.min(start+DAY,period.through), day=vnDate(start), row=empty(machine,day,end-start);
    const candidates=Object.values(history[machine.id]?.[day] || {}), accepted=[];
    for (const s of candidates) { if(valid(s,machine,day,start,end)) accepted.push(s); else row.invalid++; }
    // Concurrent collectors cannot safely be added: exclude overlapping session windows, do not double-count.
    const conflict=new Set();
    for(let i=0;i<accepted.length;i++) for(let j=i+1;j<accepted.length;j++) {
      if(Math.max(accepted[i].firstMs,accepted[j].firstMs)<Math.min(accepted[i].lastMs,accepted[j].lastMs)) { conflict.add(i);conflict.add(j); }
    }
    row.conflicts=conflict.size;
    accepted.forEach((s,i)=>{
      if(conflict.has(i)) return;
      for(const f of fields) row[f]+=s[f];
      row.sessions++;
      for(const cycle of Object.values(s.cycles||{})) {
        if(typeof cycle?.id!=='string'||!Number.isFinite(cycle.observedFromMs)||vnDate(cycle.observedFromMs)!==day) continue;
        if(!['runMs','holdMs','alarmMs','waitMs'].every(k=>Number.isFinite(cycle[k])&&cycle[k]>=0)) continue;
        if(cycle.startMs!==null && (!Number.isFinite(cycle.startMs)||cycle.startMs!==cycle.observedFromMs))continue;
        if(cycle.endMs!==null && (!Number.isFinite(cycle.endMs)||cycle.endMs<cycle.observedFromMs))continue;
        cycles.push({...cycle,machineId:machine.id,name:machine.name,day});
      }
      row.firstMs = row.firstMs===null?s.firstMs:Math.min(row.firstMs,s.firstMs);
      row.lastMs = row.lastMs===null?s.lastMs:Math.max(row.lastMs,s.lastMs);
      row.rawCounterMs+=s.counterObservedMs;
      if(s.counterVerified===true && Number.isInteger(s.partsPerCount) && s.partsPerCount>=1 && s.partsPerCount<=1000) {
        row.verifiedParts+=s.counterDelta*s.partsPerCount;row.verifiedCounterMs+=s.counterObservedMs;
      }
    });
    row.missingMs=Math.max(0,row.windowMs-row.observedMs);
    daily.push(row);
  }
  const summary=machines.map(machine=>{
    const rows=daily.filter(r=>r.machineId===machine.id), total=empty(machine,'Tổng kỳ',0);
    for(const r of rows) for(const f of [...fields,'windowMs','missingMs','sessions','conflicts','invalid','verifiedParts','verifiedCounterMs','rawCounterMs']) total[f]=(total[f]||0)+r[f];
    total.coverage=total.windowMs?total.observedMs/total.windowMs:0;
    total.runRatio=total.observedMs?total.runningMs/total.observedMs:null;
    total.production=total.verifiedCounterMs>0?total.verifiedParts:null;
    total.rawCount=total.rawCounterMs>0?total.counterDelta:null;
    total.quality=total.conflicts?'Xung đột phiên':total.invalid?'Có dữ liệu bị loại':!total.observedMs?'Chưa có dữ liệu':total.coverage<0.99?'Chưa đủ kỳ':'Đủ thời gian quan sát';
    return total;
  });
  cycles.sort((a,b)=>a.observedFromMs-b.observedFromMs||a.name.localeCompare(b.name));
  const groups=new Map();
  for(const c of cycles){
    const key=c.machineId+'|'+(c.program||'Chưa đọc');
    if(!groups.has(key))groups.set(key,{name:c.name,program:c.program||'Chưa đọc',cycles:0,runMs:0,holdMs:0,alarmMs:0,partCountDelta:0,knownCounts:0,incomplete:0,m30Observed:0});
    const g=groups.get(key);g.cycles++;if(c.m30Confirmed===true)g.m30Observed++;
    for(const [day,times] of Object.entries(c.days||{})) if(day>=period.startDate&&day<=period.endDate)for(const f of ['runMs','holdMs','alarmMs'])g[f]+=Number.isFinite(times[f])?times[f]:0;
    if(Number.isSafeInteger(c.partCountDelta)&&c.partCountDelta>=0){g.partCountDelta+=c.partCountDelta;g.knownCounts++}
    if(c.startMs===null||c.endMs===null)g.incomplete++;
  }
  return {period,summary,daily,cycles,programs:[...groups.values()],generatedAt:Date.now()};
}
export const hours = ms => ms / 3600000;
export function cycleClock(ms){return Number.isFinite(ms)?new Date(ms).toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}):''}
export function cycleDuration(ms){if(!Number.isFinite(ms)||ms<0)return '';const sec=Math.floor(ms/1000);return `${Math.floor(sec/3600)}:${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
export function reportSheets(report) {
  const p=report.period,meta=[['LTD VIET NAM · BÁO CÁO CNC'],[`Kỳ: ${p.startDate} → ${p.endDate} · Giờ Việt Nam`],['Mốc giờ là thời điểm quan sát FOCAS/PMC. M30 chỉ xác nhận khi bắt được xung R423.6; ô trống: chưa đủ dữ liệu.'],[]];
  const overview=[['Máy','Chương trình','Chu kỳ quan sát','Tổng RUN (h)','Alarm (h)','HOLD (h)','PART COUNT tăng','Ghi chú']];
  for(const g of report.programs)overview.push([g.name,g.program,g.cycles,hours(g.runMs),hours(g.alarmMs),hours(g.holdMs),g.knownCounts?g.partCountDelta:null,`${g.m30Observed}/${g.cycles} hàng bắt được M30${g.incomplete?`; ${g.incomplete} thiếu đầu/cuối`:''}`]);
  // Preserve historical day totals without inventing cycle rows for old data.
  if(!report.programs.length)for(const r of report.summary)overview.push([r.name,'Tổng hợp ngày (chưa có nhật ký chu kỳ)',null,hours(r.runningMs),hours(r.alarmMs),hours(r.holdMs),r.rawCount,r.quality]);
  const detail=[['Ngày','Máy','Chương trình','Start (quan sát)','Dừng (quan sát)','Tổng RUN (h)','Start → dừng (h)','CYCLE TIME CNC (quan sát)','Alarm (h)','HOLD (h)','PART COUNT tăng','PART COUNT cuối','Ghi chú kết thúc']];
  for(const c of report.cycles)detail.push([c.day,c.name,c.program||'',cycleClock(c.startMs),cycleClock(c.endMs),hours(c.runMs),Number.isFinite(c.wallMs)?hours(c.wallMs):null,cycleDuration(c.cncCycleTimeMs),hours(c.alarmMs),hours(c.holdMs),Number.isSafeInteger(c.partCountDelta)?c.partCountDelta:null,c.partCountEnd??null,c.status||'Chưa biết']);
  return [{name:'Tổng quan',rows:[...meta,...overview],header:4},{name:'Theo ngày',rows:[...meta,...detail],header:4}];
}
