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
  const daily=[];
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
  return {period,summary,daily,generatedAt:Date.now()};
}
export const hours = ms => ms / 3600000;
export function reportSheets(report) {
  const p=report.period, meta=[['LTD VIET NAM · BÁO CÁO VẬN HÀNH CNC'],[`Kỳ: ${p.startDate} → ${p.endDate} · Giờ Việt Nam (UTC+7)`],[`Dữ liệu tới: ${new Date(p.through).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}`],[]];
  const summary=[['Máy','Chạy (h)','Dừng/chờ (h)','HOLD (h)','Alarm (h)','Trạng thái chưa rõ (h)','Mất dữ liệu (h)','Phủ dữ liệu (%)','Tỷ lệ RUN trên dữ liệu (%)','Sản lượng đã xác nhận','Tăng bộ đếm CNC','Chất lượng']];
  for(const r of report.summary) summary.push([r.name,hours(r.runningMs),hours(r.idleMs),hours(r.holdMs),hours(r.alarmMs),hours(r.unknownStateMs),hours(r.missingMs),r.coverage,r.runRatio,r.production,r.rawCount,r.quality]);
  const daily=[['Ngày','Máy','Chạy (h)','Dừng/chờ (h)','HOLD (h)','Alarm (h)','Không rõ (h)','Mất dữ liệu (h)','Tăng bộ đếm CNC','Sản lượng đã xác nhận','Reset bộ đếm','Phiên xung đột']];
  for(const r of report.daily) daily.push([r.day,r.name,hours(r.runningMs),hours(r.idleMs),hours(r.holdMs),hours(r.alarmMs),hours(r.unknownStateMs),hours(r.missingMs),r.rawCounterMs>0?r.counterDelta:null,r.verifiedCounterMs>0?r.verifiedParts:null,r.counterResets,r.conflicts]);
  const quality=[['Máy','Giờ có dữ liệu','Giờ cần quan sát','Giờ đọc được bộ đếm','Giờ bộ đếm đã xác nhận','Số lần reset','Phiên xung đột bị loại','Bản ghi không hợp lệ bị loại']];
  for(const r of report.summary) quality.push([r.name,hours(r.observedMs),hours(r.windowMs),hours(r.rawCounterMs),hours(r.verifiedCounterMs),r.counterResets,r.conflicts,r.invalid]);
  const notes=[['Hạng mục','Quy tắc / giới hạn'],
    ['Nguồn','Chỉ báo cáo các phiên do cầu nối FOCAS lưu; không suy diễn dữ liệu từ bản ghi hiện tại hoặc demo.'],
    ['Thời gian','Trạng thái trước đó áp dụng tới lần đọc kế tiếp, chỉ nếu cách nhau không quá 15 giây. Sai số chuyển trạng thái khoảng một chu kỳ đọc. RUN là trạng thái START, không phải riêng thời gian cắt gọt.'],
    ['Phạm vi','Tuần từ thứ Hai; tháng và quý theo lịch Việt Nam. Kỳ hiện tại chỉ tính tới thời điểm tạo báo cáo. Không có lịch ca nên đây không phải OEE hoặc tỷ lệ sử dụng theo kế hoạch.'],
    ['Mất dữ liệu','Thời gian trong kỳ chưa được quan sát, kể cả trước khi lắp cầu nối. Không coi là dừng máy hay setup.'],
    ['Setup','Chưa thu thập tín hiệu setup; không suy ra từ chế độ JOG/MDI hoặc trạng thái dừng.'],
    ['Sản lượng','Dựa trên mức tăng tham số 6711 khi đọc được liên tiếp. Chỉ quy đổi thành sản phẩm khi partCounterVerified=true và đã đối chiếu partsPerCount. Không đồng nghĩa số sản phẩm đạt.'],
    ['Reset / gián đoạn','Không cộng chênh lệch qua reset hoặc khoảng mất dữ liệu. Sản lượng có thể chỉ là phần đã quan sát; xem chất lượng và giờ phủ bộ đếm.'],
    ['Ngày ghi sản lượng','Mức tăng bộ đếm được ghi vào ngày của lần đọc phát hiện tăng.'],
    ['Phiên trùng','Loại các phiên có cửa sổ thời gian chồng nhau để tránh cộng đôi. Chỉ chạy một cầu nối cho mỗi máy.'],
    ['Lưu trữ','Tổng hợp tích lũy theo ngày và phiên; gửi lại cùng phiên không cộng đôi. Không phải nhật ký từng phím thao tác.'],
    ['Thiếu dữ liệu','Ô trống nghĩa là chưa đọc/chưa xác nhận, không phải số 0. Không khôi phục được lịch sử trước khi bật bản cầu nối thống kê.']];
  return [{name:'Tổng quan',rows:[...meta,...summary],header:4,percent:[7,8]}, {name:'Theo ngày',rows:[...meta,...daily],header:4}, {name:'Chất lượng dữ liệu',rows:[...meta,...quality],header:4}, {name:'Quy ước',rows:[...meta,...notes],header:4}];
}
