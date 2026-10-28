// A cloud record alone does not establish a live connection to the CNC.
export const CNC_SIGNAL_MAX_AGE_MS = 30000;
export function cncIsFresh(cnc, now = Date.now()) {
  if (cnc.source !== 'focas' || cnc.connected !== true || !cnc.lastSeen) return false;
  const age = now - new Date(cnc.lastSeen).getTime();
  return Number.isFinite(age) && age >= -5000 && age <= CNC_SIGNAL_MAX_AGE_MS;
}
export function cncDisplayState(cnc, now = Date.now()) {
  if (cnc.source === 'demo') return { status: 'demo', label: 'MÔ PHỎNG · ' + (cnc.status || 'Chưa rõ'), css: 'offline' };
  if (cnc.source !== 'focas') return { status: 'offline', label: 'CHƯA CÓ TÍN HIỆU THẬT', css: 'offline' };
  if (!cncIsFresh(cnc, now)) return { status: 'offline', label: 'MẤT KẾT NỐI / TÍN HIỆU QUÁ HẠN', css: 'offline' };
  const raw = cnc.rawStatus;
  if (!raw || !Number.isInteger(raw.run) || !Number.isInteger(raw.alarm) || !Number.isInteger(raw.emergency)) {
    return { status: 'unknown', label: 'CHƯA ĐỌC ĐƯỢC TRẠNG THÁI', css: 'offline' };
  }
  if (raw.emergency !== 0) return { status: 'alarm', label: 'TÍN HIỆU EMERGENCY: ' + raw.emergency, css: 'alarm' };
  if (raw.alarm !== 0) return { status: 'alarm', label: 'CÓ TÍN HIỆU ALARM', css: 'alarm' };
  const states = {
    0: { status: 'idle', label: 'DỪNG / RESET', css: 'hold' },
    1: { status: 'idle', label: 'DỪNG (STOP)', css: 'hold' },
    2: { status: 'hold', label: 'TẠM DỪNG (HOLD)', css: 'hold' },
    3: { status: 'running', label: 'ĐANG CHẠY (START)', css: 'running' },
    4: { status: 'idle', label: 'MSTR · CHỜ THAO TÁC', css: 'hold' }
  };
  return states[raw.run] || { status: 'unknown', label: 'RUN (MÃ GỐC): ' + raw.run, css: 'offline' };
}
export function cncMeasurement(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
}
