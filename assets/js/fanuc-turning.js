import { arcPoints, profileFromStl, profileFromImage, findSketchSnap, nearestSketchEdge, profileFromDxf } from "./fanuc-sketch.js?v=4";

const clearance = 3;
const profileOperations = ['profile', 'rough', 'roughLinear'];
const operationNotes = {
  rough: 'FANUC G71 hai dòng, Type I (X tăng dần hoặc giữ nguyên về phía Z âm). Mô phỏng chu trình xấp xỉ.',
  roughFace: 'FANUC G72 hai dòng cho mặt phẳng Z0. Phôi thô bắt đầu tại Z dương. Mô phỏng chu trình xấp xỉ.',
  grind: 'G01 Traverse Grinding, G98 Feed per Minute. G04 Spark-out Dwell ở cuối lượt mài cuối. X là đường kính tại điểm tiếp xúc đá đã so dao.',
  grindPlunge: 'G01 Plunge Grinding, G98 Feed per Minute. Z giữ cố định. G04 Spark-out Dwell ở đường kính cuối. Kiểm tra đá và bề rộng tiếp xúc.',
  drillCycle: 'G74 hai dòng, khoan tâm theo Z. Q là chiều sâu mỗi nhát theo P/Q Input Increment của máy.',
  grooveCycle: 'G75 hai dòng, một rãnh ngoài tại Z cố định. P là bước ăn dao theo bán kính. Chiều rộng rãnh theo lưỡi dao thực tế.',
  roughLinear: 'Tiện theo lớp G00/G01. Biên dạng phải có đường kính tăng dần hoặc giữ nguyên khi đi về phía mâm cặp.',
  groove: 'Một rãnh theo bề rộng thực tế của lưỡi dao. Tọa độ Z tham chiếu mũi dao đã khai báo trên máy.',
  part: 'Mô phỏng cắt đứt đến tâm. Gá kẹp và đỡ chi tiết sau khi cắt cần được kiểm tra trên máy.',
  thread: 'Ren ngoài bước cố định từ phía trước Z0. Cần rãnh thoát ren tại điểm cuối và dao phù hợp. Nhập đường kính đỉnh ren vào ô đường kính phôi.',
  drill: 'Khoan theo từng nhát G00/G01, rút về phía trước mặt phôi sau mỗi nhát.',
};
const unitsToMm = { mm: 1, inch: 25.4 };

function readProfile(text) {
  const rows = text.trim() ? text.trim().split(/\r?\n/) : [];
  if (rows.length > 200) throw new Error('Biên dạng hỗ trợ tối đa 200 điểm.');
  return rows.map((row, index) => {
    const gap = row.trim().startsWith('|');
    const values = row.trim().replace(/^\|\s*/, '').split(/\s+/);
    if (values.length !== 2 || values.some(value => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))) {
      throw new Error(`Dòng ${index + 1} cần hai số X và Z, dùng dấu chấm cho phần thập phân.`);
    }
    return { x: Number(values[0]), z: Number(values[1]), breakBefore: gap };
  });
}

const writeProfile = points => points.map(({ x, z, breakBefore }) => `${breakBefore ? '| ' : ''}${x} ${z}`).join('\n');

export function generateTurningProgram(settings) {
  const { operation, units, diameter, length, tool, offset, rpm, feed, profile } = settings;
  const scale = unitsToMm[units];
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (!inRange(diameter, 0.1, 10000) || !inRange(length, 0.1, 10000)) {
    throw new Error('Kích thước phôi phải trong khoảng 0.1–10000 mm.');
  }
  const machine = settings.machine ?? 'fanuc';
  if (!['fanuc', 'pl800gb'].includes(machine)) throw new Error('Chọn kiểu máy hợp lệ.');
  const grinding = ['grind', 'grindPlunge'].includes(operation);
  if (grinding && machine !== 'pl800gb') throw new Error('Chọn PL800GB để khai báo đầu mài.');
  if (![tool, offset, rpm].every(Number.isInteger) || !inRange(tool, 1, 99) ||
      !inRange(offset, 1, 99) || !inRange(rpm, 1, 99999) || (!grinding && !inRange(feed, 0.001, 100))) {
    throw new Error('Kiểm tra số dao, số offset, tốc độ trục chính và lượng chạy dao.');
  }
  if (!scale || ![...profileOperations, 'face', 'groove', 'part', 'drill', 'thread', 'roughFace', 'grind', 'grindPlunge', 'drillCycle', 'grooveCycle'].includes(operation)) throw new Error('Chọn đơn vị và nguyên công hợp lệ.');
  const precision = units === 'inch' ? 5 : 3;
  const coordinate = value => {
    const formatted = (value / scale).toFixed(precision);
    return Number(formatted) === 0 ? (0).toFixed(precision) : formatted;
  };
  const outside = diameter + clearance * 2;
  const rapid = point => `G00 X${coordinate(point.x)} Z${coordinate(point.z)}`;
  const cut = point => `G01 X${coordinate(point.x)} Z${coordinate(point.z)}`;
  const start = { x: outside, z: clearance };
  const lines = [
    '%', 'O0100', '(PREVIEW ONLY - UNVERIFIED ON MACHINE)',
    `G18 G40 G80 G${grinding ? '98' : '99'} G${units === 'inch' ? '20' : '21'}`,
    'G54', `T${String(tool).padStart(2, '0')}${String(offset).padStart(2, '0')}`,
    `G97 S${rpm} M03`, rapid(start),
  ];
  const coolant = settings.coolant;
  if (coolant !== undefined && !['off', 'flood'].includes(coolant)) throw new Error('Chọn Coolant hợp lệ.');
  if (coolant) lines.push(coolant === 'flood' ? 'M08 (COOLANT ON)' : 'M09 (COOLANT OFF)');
  const compensation = settings.compensation ?? 'off';
  if (compensation !== 'off' && (operation !== 'profile' || !['G41', 'G42'].includes(compensation))) {
    throw new Error('Tool Nose Compensation chỉ áp dụng cho Profile Finishing.');
  }
  const feedWord = ` F${(feed / scale).toFixed(units === 'inch' ? 6 : 4)}`;
  const passCount = (distance, step) => {
    if (!inRange(step, 0.001, 10000)) throw new Error('Bước cắt phải lớn hơn hoặc bằng 0,001 mm.');
    const count = Math.ceil(distance / step - 1e-9);
    if (count > 300) throw new Error('Thông số tạo hơn 300 lượt cắt. Hãy tăng bước cắt.');
    return count;
  };
  const normalizedM = raw => {
    const match = /^M?(\d{1,3})$/i.exec(String(raw ?? '').trim());
    const code = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(code) || code < 10 || [19, 30, 98, 99, 198].includes(code)) return null;
    return `M${String(code).padStart(2, '0')}`;
  };
  const cycle = (g, depthAxis, depth, stockFace, allowanceX, allowanceZ, contour) => {
    const retract = settings.cycleRetract;
    if (!inRange(depth, 0.001, 10000) || !inRange(retract, 0.001, 1000)) throw new Error('Kiểm tra bước cắt và khoảng lùi R.');
    const end = 100 + 10 * (contour.length - 1);
    lines.push(
      `(PREVIEW STOCK X${coordinate(diameter)} Z${coordinate(stockFace)})`,
      rapid({ x: outside, z: stockFace + clearance }),
      `${g} ${depthAxis}${coordinate(depth)} R${coordinate(retract)}`,
      `${g} P100 Q${end} U${coordinate(allowanceX)} W${coordinate(allowanceZ)}${feedWord}`,
      ...contour.map((block, i) => `N${100 + i * 10} ${block}${i === contour.length - 1 ? feedWord : ''}`),
    );
    if (settings.finishCycle) lines.push(`G70 P100 Q${end}`);
    lines.push(rapid({ x: outside, z: stockFace + clearance }));
  };
  const peckCycle = (depthAxis, incrementAxis, peck, entry, target) => {
    const retract = settings.cycleRetract;
    const increment = settings.peckIncrement === 'standard' ? (units === 'inch' ? 0.0001 : 0.001)
      : settings.peckIncrement === 'fine' ? (units === 'inch' ? 0.00001 : 0.0001) : null;
    if (!increment || !inRange(retract, 0.001, peck)) throw new Error('Kiểm tra P/Q Input Increment và Retract R. R phải nhỏ hơn bước cắt.');
    const pulses = Math.round(peck / scale / increment);
    if (!Number.isSafeInteger(pulses) || pulses < 1 || Math.abs(pulses * increment * scale - peck) > 1e-7 ||
        retract >= peck || Number(coordinate(retract)) >= pulses * increment) {
      throw new Error('Bước cắt phải biểu diễn đúng bằng P/Q Input Increment, và Retract R phải nhỏ hơn bước cắt.');
    }
    const axial = depthAxis === 'Z';
    const g = axial ? 'G74' : 'G75';
    passCount(axial ? entry.z - target : (entry.x - target) / 2, peck);
    lines.push(rapid(entry), `(PREVIEW PQ INCREMENT ${increment.toFixed(6)})`, `${g} R${coordinate(retract)}`,
      `${g} ${depthAxis}${coordinate(target)} ${incrementAxis}${pulses}${feedWord}`, rapid(start));
  };
  if (grinding) {
    const { grindDiameter, grindStart, grindEnd, stepDepth, grindFeed, grindConfirmed } = settings;
    const dwell = settings.grindDwell ?? 0;
    const traverse = operation === 'grind';
    const on = normalizedM(settings.grindOn);
    const off = normalizedM(settings.grindOff);
    if (!grindConfirmed || !on || !off || on === off) throw new Error('Nhập hai mã M phụ khác nhau và xác nhận đã đối chiếu bảng M-code của máy.');
    if (!inRange(grindDiameter, 0.001, diameter - 0.001) || !inRange(grindStart, -length, 0) ||
        (traverse && !inRange(grindEnd, -length, grindStart - 0.001)) || !inRange(grindFeed, 0.001, 10000) || !inRange(dwell, 0, 60)) {
      throw new Error('Kiểm tra đường kính sau mài, hai đầu hành trình Z và lượng chạy dao mài.');
    }
    const count = passCount((diameter - grindDiameter) / 2, stepDepth);
    const approach = { x: outside, z: grindStart };
    const grindFeedWord = ` F${(grindFeed / scale).toFixed(6)}`;
    const endZ = traverse ? grindEnd : grindStart;
    lines.push(`(PL800GB OD ${traverse ? 'TRAVERSE' : 'PLUNGE'} GRIND)`, `${on} (GRIND HEAD ON)`, rapid(approach));
    for (let pass = 1; pass <= count; pass++) {
      const x = Math.max(grindDiameter, diameter - 2 * stepDepth * pass);
      lines.push(cut({ x, z: grindStart }) + grindFeedWord);
      if (traverse) lines.push(cut({ x, z: endZ }));
      if (pass === count && dwell > 0) lines.push(`G04 X${dwell.toFixed(3)} (SPARK-OUT DWELL)`);
      lines.push(rapid({ x: outside, z: endZ }), rapid(approach));
    }
    lines.push(rapid(start), `${off} (GRIND HEAD OFF)`);
  } else if (operation === 'roughFace') {
    const { faceStock, faceStep, faceAllowance } = settings;
    if (!inRange(faceStock, 0.001, 1000) || !inRange(faceAllowance, 0, faceStock - 0.001)) {
      throw new Error('Z mặt phôi thô phải dương và lớn hơn lượng dư dọc Z.');
    }
    passCount(faceStock - faceAllowance, faceStep);
    cycle('G72', 'W', faceStep, faceStock, 0, faceAllowance, [`G00 Z${coordinate(0)}`, `G01 X${coordinate(0)}`]);
  } else if (operation === 'thread') {
    const { threadEndZ, pitch, stepDepth, rootDiameter } = settings;
    if (!inRange(threadEndZ, -length, -0.001) || !inRange(pitch, 0.001, 100) ||
        !inRange(rootDiameter, 0.001, diameter - 0.001)) {
      throw new Error('Kiểm tra vị trí cuối ren, bước ren và đường kính đáy ren.');
    }
    const count = passCount((diameter - rootDiameter) / 2, stepDepth);
    const startZ = Math.max(clearance, pitch * 2);
    const entry = { x: outside, z: startZ };
    if (startZ !== clearance) lines.push(rapid(entry));
    for (let pass = 1; pass <= count; pass++) {
      const x = Math.max(rootDiameter, diameter - 2 * pass * stepDepth);
      lines.push(rapid({ x, z: startZ }),
        `G32 X${coordinate(x)} Z${coordinate(threadEndZ)} F${(pitch / scale).toFixed(6)}`,
        rapid({ x: outside, z: threadEndZ }), rapid(entry));
    }
  } else if (operation === 'drillCycle') {
    const { drillDepth, peck } = settings;
    if (!inRange(drillDepth, 0.001, length)) throw new Error('Kiểm tra Drill Depth trong phạm vi phôi.');
    peckCycle('Z', 'Q', peck, { x: 0, z: clearance }, -drillDepth);
  } else if (operation === 'grooveCycle') {
    const { cutZ, rootDiameter, stepDepth } = settings;
    if (!inRange(cutZ, -length, -0.001) || !inRange(rootDiameter, 0, diameter - 0.001)) {
      throw new Error('Kiểm tra Groove Z và Root Diameter trong phạm vi phôi.');
    }
    peckCycle('X', 'P', stepDepth, { x: outside, z: cutZ }, rootDiameter);
  } else if (operation === 'drill') {
    const { drillDepth, peck } = settings;
    if (!inRange(drillDepth, 0.001, length)) throw new Error('Chiều sâu khoan phải nằm trong chiều dài phôi.');
    const count = passCount(drillDepth, peck);
    const center = { x: 0, z: clearance };
    lines.push(rapid(center));
    for (let pass = 1; pass <= count; pass++) {
      if (pass > 1) lines.push(rapid({ x: 0, z: -Math.max(0, (pass - 1) * peck - 0.5) }));
      lines.push(cut({ x: 0, z: -Math.min(drillDepth, pass * peck) }) + feedWord, rapid(center));
    }
    lines.push(rapid(start));
  } else if (operation === 'groove' || operation === 'part') {
    const { cutZ, stepDepth } = settings;
    const target = operation === 'part' ? 0 : settings.rootDiameter;
    if (!inRange(cutZ, -length, -0.001) || !inRange(target, 0, diameter - 0.001)) {
      throw new Error('Vị trí Z và đường kính đáy phải nằm trong phôi.');
    }
    const count = passCount((diameter - target) / 2, stepDepth);
    const entry = { x: outside, z: cutZ };
    lines.push(rapid(entry));
    for (let pass = 1; pass <= count; pass++) {
      if (pass > 1) lines.push(rapid({ x: diameter - 2 * (pass - 1) * stepDepth + 1, z: cutZ }));
      lines.push(cut({ x: Math.max(target, diameter - 2 * pass * stepDepth), z: cutZ }) + feedWord, rapid(entry));
    }
    lines.push(rapid(start));
  } else if (operation === 'face') {
    lines.push(rapid({ x: outside, z: 0 }), cut({ x: 0, z: 0 }) + feedWord,
      rapid({ x: 0, z: clearance }), rapid(start));
  } else {
    const points = readProfile(profile);
    if (points.some(point => point.breakBefore)) throw new Error('Biên dạng có khoảng hở. Nối lại đường bao trước khi tạo mã NC.');
    if (points.length < 2 || points[0].z !== 0 || Number(coordinate(points.at(-1).z)) >= 0) {
      throw new Error('Nhập ít nhất hai điểm, bắt đầu ở Z0 và kết thúc ở Z âm.');
    }
    points.forEach((point, index) => {
      const previous = points[index - 1];
      if (!inRange(point.x, 0, diameter) || !inRange(point.z, -length, 0)) {
        throw new Error(`Điểm ${index + 1} nằm ngoài phôi.`);
      }
      if (previous && (point.z > previous.z ||
          (coordinate(point.x) === coordinate(previous.x) && coordinate(point.z) === coordinate(previous.z)))) {
        throw new Error(`Điểm ${index + 1} phải đi theo chiều Z giảm dần hoặc tạo bậc tại cùng Z. Hai điểm liên tiếp cần tách biệt sau khi làm tròn.`);
      }
    });
    const last = points.at(-1);
    if (operation === 'rough' || operation === 'roughLinear') {
      const { stepDepth, allowance } = settings;
      if (!inRange(allowance, 0, diameter / 2)) throw new Error('Lượng dư theo bán kính không hợp lệ.');
      if (points.some((point, index) => index && point.x < points[index - 1].x)) {
        throw new Error('Tiện thô theo lớp chỉ hỗ trợ biên dạng có đường kính tăng dần hoặc giữ nguyên về phía Z âm.');
      }
      const target = points[0].x + 2 * allowance;
      if (target >= diameter) throw new Error('Không có lớp thô trong phôi với lượng dư đã nhập.');
      const count = passCount((diameter - target) / 2, stepDepth);
      if (operation === 'rough') {
        cycle('G71', 'U', stepDepth, 0, 2 * allowance, 0, [`G00 X${coordinate(points[0].x)}`, ...points.map(cut)]);
      } else {
        for (let pass = 1; pass <= count; pass++) {
          const x = Math.max(target, diameter - 2 * stepDepth * pass);
          const limit = x - 2 * allowance;
          const crossing = points.findIndex(point => point.x > limit + 1e-8);
          let z = last.z;
          if (crossing > 0) {
            const end = points[crossing];
            const begin = points[crossing - 1];
            z = begin.z + (end.z - begin.z) * (limit - begin.x) / (end.x - begin.x);
          }
          if (z >= 0) continue;
          lines.push(rapid({ x, z: clearance }), cut({ x, z }) + feedWord,
            rapid({ x: outside, z }), rapid(start));
        }
        if (lines.length === 8) throw new Error('Biên dạng và lượng dư không tạo được lượt tiện thô.');
      }
    } else if (compensation === 'off') {
      lines.push(rapid({ x: points[0].x, z: clearance }), cut(points[0]) + feedWord,
        ...points.slice(1).map(cut), rapid({ x: outside, z: last.z }), rapid(start));
    } else {
      const lead = settings.compLead;
      if (!inRange(lead, 0.001, 100)) throw new Error('Kiểm tra Lead-in / Lead-out.');
      const leadZ = Math.max(clearance, lead);
      const exitX = Math.max(outside, last.x + 2 * lead);
      lines.push(
        '(TOOL NOSE COMPENSATION FROM CNC TOOL OFFSET)',
        rapid({ x: points[0].x, z: leadZ }),
        `${compensation} ${cut(points[0])}${feedWord}`,
        ...points.slice(1).map(cut),
        `G40 ${cut({ x: exitX, z: last.z })}`,
        rapid({ x: exitX, z: leadZ }), rapid(start),
      );
    }
  }
  const series = String(settings.controller ?? '').replace(/[^a-z0-9 .+-]/gi, '').trim().slice(0, 32);
  if (machine === 'pl800gb' || series) lines.splice(3, 0, `(${machine === 'pl800gb' ? 'SMEC PL800GB' : 'FANUC LATHE'}${series ? ' ' + series.toUpperCase() : ''})`);
  return [...lines, ...(coolant === 'flood' ? ['M09 (COOLANT OFF)'] : []), 'M05', 'M30', '%', ''].join('\n');
}

export function resizeTurningEndpoint(points, index, anchor, target, type, { diameter, length }) {
  const current = points[index];
  if (!current || !Number.isFinite(target) || target < 0.001) throw new Error('Nhập kích thước từ 0,001 mm.');
  const dx = current.x - anchor.x;
  const dz = current.z - anchor.z;
  let { x, z } = current;
  if (type === 'diameter') x = target;
  else if (type === 'axial') z = anchor.z + (Math.sign(dz) || -1) * target;
  else if (type === 'radial') x = anchor.x + (Math.sign(dx) || 1) * target * 2;
  else {
    const span = Math.hypot(dx / 2, dz);
    if (!span) throw new Error('Hai điểm đo đang trùng nhau.');
    x = anchor.x + dx * target / span;
    z = anchor.z + dz * target / span;
  }
  x = Number(x.toFixed(5));
  z = Number(z.toFixed(5));
  const previous = points[index - 1];
  const next = points[index + 1];
  if (x < 0 || x > diameter || z < -length || z > (previous?.z ?? 0) ||
      (!index && z !== 0) || (next && z < next.z) ||
      [previous, next].some(point => point?.x === x && point.z === z)) {
    throw new Error('Kích thước này làm điểm ra ngoài phôi, rời Z0 hoặc đảo thứ tự biên dạng.');
  }
  return { ...current, x, z };
}

function ncWords(raw) {
  return new Map([...raw.replace(/\([^)]*\)/g, '').matchAll(/([A-Z])([+-]?\d+(?:\.\d+)?)/g)]
    .map(([, address, number]) => [address, Number(number)]));
}

function roughingMoves(g, stock, start, contour, depth, retract, allowanceX, allowanceZ, push) {
  const longitudinal = g === 71;
  const remaining = longitudinal ? stock.x - contour[0].x - allowanceX : stock.z - contour.at(-1).z - allowanceZ;
  const step = longitudinal ? depth * 2 : depth;
  const count = Math.ceil(remaining / step - 1e-7);
  if (count < 1 || count > 301) throw new Error('Không mô phỏng được chu trình: số lượt cắt ngoài giới hạn.');
  let cuttingPasses = 0;
  for (let pass = 1; pass <= count; pass++) {
    if (longitudinal) {
      const x = Math.max(contour[0].x + allowanceX, stock.x - pass * step);
      const limit = x - allowanceX;
      const crossing = contour.findIndex(point => point.x > limit + 1e-7);
      let z = contour.at(-1).z + allowanceZ;
      if (crossing > 0) {
        const a = contour[crossing - 1];
        const b = contour[crossing];
        z = a.z + (b.z - a.z) * (limit - a.x) / (b.x - a.x) + allowanceZ;
      }
      if (z >= stock.z) continue;
      cuttingPasses++;
      push({ x, z: start.z }, 'rapid');
      push({ x, z }, 'feed');
      push({ x: Math.min(start.x, x + retract * 2), z: Math.min(start.z, z + retract) }, 'rapid');
      push({ x: Math.min(start.x, x + retract * 2), z: start.z }, 'rapid');
      push(start, 'rapid');
    } else {
      const z = Math.max(contour.at(-1).z + allowanceZ, stock.z - pass * step);
      const x = contour.at(-1).x + allowanceX;
      push({ x: start.x, z }, 'rapid');
      push({ x, z }, 'feed');
      push({ x: Math.min(start.x, x + retract * 2), z: Math.min(start.z, z + retract) }, 'rapid');
      push({ x: start.x, z: Math.min(start.z, z + retract) }, 'rapid');
      push(start, 'rapid');
    }
  }
  if (longitudinal && !cuttingPasses) throw new Error('Không có lượt tiện dọc trong phôi theo biên dạng G71 này.');
}

function peckingMoves(g, start, target, peck, retract, push) {
  const axial = g === 74;
  const axis = axial ? 'z' : 'x';
  const step = peck * (axial ? 1 : 2);
  const relief = retract * (axial ? 1 : 2);
  const count = Math.ceil((start[axis] - target[axis]) / step - 1e-7);
  if (!Number.isFinite(count) || count < 1 || count > 301 || relief <= 0 || relief >= step) {
    throw new Error('Không mô phỏng được bước cắt P/Q hoặc Retract R.');
  }
  for (let pass = 1; pass <= count; pass++) {
    const value = Math.max(target[axis], start[axis] - pass * step);
    push({ ...target, [axis]: value }, 'feed');
    if (pass < count) push({ ...target, [axis]: value + relief }, 'rapid');
  }
  push(start, 'rapid');
}

export function readTurningMoves(program) {
  let scale = 1;
  let mode;
  let position;
  let stock;
  let cycleSetup;
  let pqIncrement;
  let peckSetup;
  const moves = [];
  const lines = program.split('\n');
  const blocks = lines.map(ncWords);
  const numbered = new Map(blocks.flatMap((words, index) => words.has('N') ? [[words.get('N'), index]] : []));
  const at = (words, from) => ({
    x: words.has('X') ? words.get('X') * scale : from?.x,
    z: words.has('Z') ? words.get('Z') * scale : from?.z,
  });
  const push = (to, mode, index) => {
    if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) return;
    if (position) moves.push({ from: position, to, mode, line: index + 1 });
    position = to;
  };
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const words = blocks[index];
    const g = words.get('G');
    if (g === 20 || g === 21) scale = g === 20 ? 25.4 : 1;
    const stockWords = /^\(PREVIEW STOCK X([\d.]+) Z([\d.]+)\)$/.exec(raw);
    if (stockWords) stock = { x: Number(stockWords[1]) * scale, z: Number(stockWords[2]) * scale };
    const pqWords = /^\(PREVIEW PQ INCREMENT ([\d.]+)\)$/.exec(raw);
    if (pqWords) pqIncrement = Number(pqWords[1]) * scale;
    if (g === 74 || g === 75) {
      const axial = g === 74;
      const pulse = words.get(axial ? 'Q' : 'P');
      if (pulse === undefined) {
        peckSetup = { g, retract: words.get('R') * scale };
      } else {
        if (!position || peckSetup?.g !== g) throw new Error('Thiếu khối Retract R của G74/G75.');
        peckingMoves(g, position, at(words, position), pulse * pqIncrement, peckSetup.retract,
          (to, motion) => push(to, motion, index));
      }
      continue;
    }
    if (g === 4) {
      if (position) push(position, 'event', index);
      continue;
    }
    if ((g === 71 || g === 72) && !words.has('P')) {
      cycleSetup = { g, depth: words.get(g === 71 ? 'U' : 'W') * scale, retract: words.get('R') * scale };
      continue;
    }
    if (g === 70 || g === 71 || g === 72) {
      const first = numbered.get(words.get('P'));
      const last = numbered.get(words.get('Q'));
      const start = position;
      if (!start || first === undefined || last === undefined || last < first) throw new Error('Không đọc được khối P/Q của chu trình.');
      let point = start;
      const contour = blocks.slice(first, last + 1).map((block, offset) => {
        point = at(block, point);
        return { ...point, line: first + offset, mode: block.get('G') === 0 ? 'rapid' : 'feed' };
      });
      if (g === 70) {
        for (const { x, z, line, mode } of contour) push({ x, z }, mode, line);
        // Return to the cycle origin in two display legs; the controller determines its actual return.
        push({ x: start.x, z: position.z }, 'rapid', index);
        push(start, 'rapid', index);
      } else {
        if (!stock || cycleSetup?.g !== g) throw new Error('Thiếu tham số chu trình G71/G72.');
        roughingMoves(g, stock, start, contour, cycleSetup.depth, cycleSetup.retract,
          words.get('U') * scale, words.get('W') * scale, (to, motion) => push(to, motion, index));
        index = last;
      }
      continue;
    }
    if (g === 0) mode = 'rapid';
    if (g === 1) mode = 'feed';
    if (g === 32) mode = 'thread';
    if (position && /\((?:GRIND HEAD|COOLANT) (?:ON|OFF)\)/.test(raw)) push(position, 'event', index);
    if (mode && (words.has('X') || words.has('Z'))) push(at(words, position), mode, index);
  }
  return moves;
}

export function initTurningPreview() {
  const form = document.querySelector('#turningForm');
  const canvas = document.querySelector('#turningPlot');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#turningStatus');
  const code = document.querySelector('#turningCode');
  const slider = document.querySelector('#turningStep');
  const stepLabel = document.querySelector('#turningStepLabel');
  const play = document.querySelector('#turningPlay');
  const download = document.querySelector('#turningDownload');
  const fields = form.elements;
  const stockLength = fields.namedItem("length");
  const byId = id => document.getElementById(id);
  const workbench = canvas.closest('.turning-workbench');
  const tools = [...workbench.querySelectorAll('[data-sketch-tool]')];
  const sketchStatus = byId('turningSketchStatus');
  const removePoint = byId('turningDelete');
  const insertPoint = byId('turningInsertPoint');
  const objectSnap = byId('turningObjectSnap');
  let activeTool = 'line';
  let selectedPoint;
  let selectedEdge;
  let edgeStyles = [];
  let nextStroke = 0;
  const annotations = [];
  const dimensionValue = (a, b, type) => {
    const dz = Math.abs(b.z - a.z);
    const dr = Math.abs(b.x - a.x) / 2;
    return type === 'axial' ? dz : type === 'aligned' ? Math.hypot(dz, dr) : dr * (type === 'diameter' ? 2 : 1);
  };
  let dimensionPoints = [];
  let activeDimension;
  const dimensionEditor = byId('turningDimensionEditor');
  const dimensionInput = byId('turningDimensionValue');
  const dimensionHelp = byId('turningDimensionHelp');
  const color = byId('turningStrokeColor');
  const dimensionType = byId('turningDimensionType');
  const logicalWidth = canvas.width;
  const logicalHeight = canvas.height;
  let snapMarker;
  let imageFlipped = false;
  const coordinateLabel = byId('turningCoordinate');
  const currentBlock = byId('turningCurrentBlock');
  const codeView = byId('turningCodeView');
  let codeLines = [];
  let activeCodeRow;

  function setCode(program) {
    code.value = program;
    codeLines = program ? program.trimEnd().split('\n') : [];
    activeCodeRow = undefined;
    codeView.replaceChildren(...codeLines.map((line, index) => {
      const row = document.createElement('div');
      row.className = 'turning-code-line';
      const number = document.createElement('span');
      number.setAttribute('aria-hidden', 'true');
      number.textContent = String(index + 1);
      const block = document.createElement('code');
      block.textContent = line;
      row.append(number, block);
      return row;
    }));
  }

  function showCodeLine(line) {
    currentBlock.textContent = line ? codeLines[line - 1] : '—';
    const row = line ? codeView.children[line - 1] : undefined;
    if (row === activeCodeRow) return;
    activeCodeRow?.removeAttribute('aria-current');
    activeCodeRow = row;
    if (!row) return;
    row.setAttribute('aria-current', 'step');
    const top = row.offsetTop;
    if (top < codeView.scrollTop || top + row.offsetHeight > codeView.scrollTop + codeView.clientHeight) {
      codeView.scrollTop = Math.max(0, top - codeView.clientHeight / 2);
    }
  }
  const importStatus = byId('turningImportStatus');
  const undo = byId('turningUndo');
  const showProfile = byId('turningShowProfile');
  const showRapid = byId('turningShowRapid');
  const edits = [];
  let referenceImage;
  let imageRevision = 0;
  let meshRevision = 0;
  let arcMiddle;
  let cursor;
  let drag;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let moves = [];
  let timer;
  let plot;

  function dimensions() {
    const valid = value => Number.isFinite(value) && value >= 0.1 && value <= 10000;
    return {
      diameter: valid(fields.diameter.valueAsNumber) ? fields.diameter.valueAsNumber : 60,
      length: valid(stockLength.valueAsNumber) ? stockLength.valueAsNumber : 80,
    };
  }

  function draw() {
    const { diameter, length } = dimensions();
    const left = 44, top = 20, right = logicalWidth - 44, bottom = logicalHeight - 38;
    const pitch = fields.operation.value === 'thread' ? fields.pitch.valueAsNumber : 0;
    const faceStock = fields.operation.value === 'roughFace' ? fields.faceStock.valueAsNumber : 0;
    const stockFront = Number.isFinite(faceStock) && faceStock > 0 && faceStock <= 1000 ? faceStock : 0;
    const compLead = !fields.compLead.disabled ? fields.compLead.valueAsNumber : 0;
    const leadSpace = Number.isFinite(compLead) && compLead <= 100 ? compLead : 0;
    const front = Math.max(clearance + stockFront, leadSpace, Number.isFinite(pitch) && pitch <= 100 ? 2 * pitch : 0);
    const spanZ = length + clearance + front;
    const spanR = diameter / 2 + Math.max(2 * clearance, leadSpace + clearance);
    const fittedScale = Math.min((right - left) / spanZ, (bottom - top) / spanR);
    const scale = fittedScale * zoom;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const zOrigin = centerX + (length + clearance - front) / 2 * scale + panX;
    const baseY = centerY + (bottom - centerY) * zoom + panY;
    plot = { scale, zOrigin, bottom: baseY };
    const at = ({ x, z }) => [zOrigin + z * scale, baseY - x * scale / 2];
    const drawLine = (points, color, dash = []) => {
      if (!points.length) return;
      ctx.beginPath();
      ctx.moveTo(...at(points[0]));
      for (const point of points.slice(1)) ctx.lineTo(...at(point));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.setTransform(canvas.width / logicalWidth, 0, 0, canvas.height / logicalHeight, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - 5, top - 2, right - left + 10, bottom - top + 7);
    ctx.clip();
    const [stockLeft, stockTop] = at({ x: diameter, z: -length });
    ctx.fillStyle = '#1c2936';
    ctx.fillRect(stockLeft, stockTop, (length + stockFront) * scale, baseY - stockTop);
    if (referenceImage) {
      const width = byId('turningImageWidth').valueAsNumber;
      const z = byId('turningImageZ').valueAsNumber;
      const r = byId('turningImageR').valueAsNumber;
      if (width > 0 && Number.isFinite(z) && Number.isFinite(r)) {
        const height = width * referenceImage.height / referenceImage.width;
        const [x, y] = at({ x: 2 * (r + height), z: z - width });
        ctx.globalAlpha = Number(byId('turningImageOpacity').value) / 100;
        if (imageFlipped) {
          ctx.save();
          ctx.translate(x + width * scale, y);
          ctx.scale(-1, 1);
          ctx.drawImage(referenceImage, 0, 0, width * scale, height * scale);
          ctx.restore();
        } else {
          ctx.drawImage(referenceImage, x, y, width * scale, height * scale);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.font = '12px system-ui';
    const magnitude = 10 ** Math.floor(Math.log10(48 / scale));
    const interval = [1, 2, 5, 10].map(v => v * magnitude).find(v => v * scale >= 48);
    const format = n => String(Number(n.toPrecision(6)));
    const ticks = [];
    ctx.fillStyle = '#263644';
    for (let z = Math.ceil((left - zOrigin) / scale / interval) * interval; z < (right - zOrigin) / scale; z += interval) {
      const px = zOrigin + z * scale;
      ctx.fillRect(px, top, 1, bottom - top);
      ticks.push({ x: px - 7, y: bottom + 17, value: format(Math.abs(z) < interval * 1e-6 ? 0 : z) });
    }
    for (let r = Math.ceil((baseY - bottom) / scale / interval) * interval; r < (baseY - top) / scale; r += interval) {
      const py = baseY - r * scale;
      ctx.fillRect(left, py, right - left, 1);
      ticks.push({ x: 3, y: py + 4, value: format(Math.abs(r) < interval * 1e-6 ? 0 : r) });
    }
    ctx.fillStyle = '#637b90';
    ctx.fillRect(left, baseY, right - left, 1);
    ctx.fillRect(zOrigin, top, 1, bottom - top);
    ctx.strokeStyle = '#536a83';
    ctx.strokeRect(stockLeft, stockTop, (length + stockFront) * scale, baseY - stockTop);

    if (showProfile.checked && profileOperations.includes(fields.operation.value)) {
      let points = [];
      try {
        points = readProfile(fields.profile.value);
      } catch {
        // Validation on submit reports incomplete or malformed coordinate rows.
      }
      const visible = point => point.x >= 0 && point.x <= diameter && point.z >= -length && point.z <= 0;
      for (let i = 1; i < points.length; i++) {
        if (points[i].breakBefore || !visible(points[i - 1]) || !visible(points[i])) continue;
        const chosen = selectedEdge !== undefined && (selectedEdge === i ||
          edgeStyles[selectedEdge]?.stroke !== undefined && edgeStyles[selectedEdge].stroke === edgeStyles[i]?.stroke);
        drawLine([points[i - 1], points[i]], chosen ? '#fff2a1' : edgeStyles[i]?.color || '#50efad', chosen ? [7, 3] : []);
      }
      if (points.length && visible(points.at(-1)) && cursor && !['pan', 'select', 'dimension'].includes(activeTool)) {
        const last = points.at(-1);
        let preview = [last, cursor];
        if (arcMiddle) {
          try {
            preview = [last, ...arcPoints(last, arcMiddle, cursor)];
          } catch {
            preview = [last, arcMiddle, cursor];
          }
        }
        drawLine(preview, color.value, [4, 4]);
      }
      ctx.fillStyle = '#50efad';
      for (const [index, point] of points.entries()) {
        if (!visible(point)) continue;
        const [x, y] = at(point);
        ctx.fillStyle = index === selectedPoint ? '#80bfff' : '#50efad';
        const size = index === selectedPoint ? 10 : activeTool === 'select' ? 6 : 4;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    const step = Number(slider.value);
    for (const move of moves.slice(step)) {
      if (move.mode !== 'event' && (showRapid.checked || move.mode !== 'rapid')) drawLine([move.from, move.to], '#526072', [2, 5]);
    }
    moves.slice(0, step).forEach((move, index) => {
      const rapid = move.mode === 'rapid';
      if (move.mode === 'event' || (rapid && !showRapid.checked)) return;
      const active = index === step - 1;
      const color = active ? '#df9aff' : rapid ? '#ffac5b' : move.mode === 'thread' ? '#ff82bb' : '#52aaff';
      drawLine([move.from, move.to], color, rapid ? [6, 4] : []);
      if (active) {
        const [a, b] = at(move.from);
        const [x, y] = at(move.to);
        const length = Math.hypot(x - a, y - b);
        if (length > 16) {
          const dx = (x - a) / length;
          const dy = (y - b) / length;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x - 5 * dx, y - 5 * dy);
          ctx.lineTo(x - 15 * dx + 4 * dy, y - 15 * dy - 4 * dx);
          ctx.lineTo(x - 15 * dx - 4 * dy, y - 15 * dy + 4 * dx);
          ctx.fill();
        }
      }
    });
    if (moves.length) {
      const position = step ? moves[step - 1].to : moves[0].from;
      ctx.fillStyle = '#e5efff';
      ctx.beginPath();
      ctx.arc(...at(position), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const drawDimension = ({ a, b, placement, type }) => {
      const [ax, ay] = at(a);
      const [bx, by] = at(b);
      const [px, py] = at(placement);
      let horizontal = bx - ax;
      let vertical = by - ay;
      if (type === 'axial') vertical = 0;
      if (type === 'radial' || type === 'diameter') horizontal = 0;
      const span = Math.hypot(horizontal, vertical);
      if (!span) return;
      const tx = horizontal / span, ty = vertical / span;
      const offset = (px - ax) * -ty + (py - ay) * tx;
      const first = [ax - ty * offset, ay + tx * offset];
      const last = [first[0] + horizontal, first[1] + vertical];
      ctx.strokeStyle = '#f4d16e';
      ctx.fillStyle = '#f4d16e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [from, to] of [[[ax, ay], first], [[bx, by], last], [first, last]]) {
        ctx.moveTo(...from);
        ctx.lineTo(...to);
      }
      for (const [end, sign] of [[first, 1], [last, -1]]) {
        ctx.moveTo(...end);
        ctx.lineTo(end[0] + sign * tx * 7 + ty * 3, end[1] + sign * ty * 7 - tx * 3);
        ctx.moveTo(...end);
        ctx.lineTo(end[0] + sign * tx * 7 - ty * 3, end[1] + sign * ty * 7 + tx * 3);
      }
      ctx.stroke();
      const value = dimensionValue(a, b, type);
      const label = `${type === 'diameter' ? 'Ø' : ''}${value.toFixed(3)} mm`;
      const x = (first[0] + last[0]) / 2, y = (first[1] + last[1]) / 2;
      const width = ctx.measureText(label).width;
      ctx.fillStyle = '#101720';
      ctx.fillRect(x - width / 2 - 3, y - 10, width + 6, 17);
      ctx.fillStyle = '#f4d16e';
      ctx.fillText(label, x - width / 2, y + 3);
    };
    for (const annotation of annotations) drawDimension(annotation);
    if (dimensionPoints.length === 2 && cursor) {
      drawDimension({ a: dimensionPoints[0], b: dimensionPoints[1], placement: cursor, type: dimensionType.value });
    }
    if (cursor && activeTool !== 'pan') {
      const [x, y] = at(cursor);
      ctx.strokeStyle = snapMarker ? '#65dbff' : '#96a9bd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
      if (snapMarker) ctx.strokeRect(x - 6, y - 6, 12, 12);
    }
    ctx.restore();
    ctx.fillStyle = '#b2c8da';
    for (const tick of ticks) ctx.fillText(tick.value, tick.x, tick.y);
    ctx.fillText('R (mm)', left, top - 6);
    ctx.fillText('Z (mm)', right - 30, bottom + 33);
    showCodeLine(step ? moves[step - 1].line : undefined);
    stepLabel.textContent = step ? `${step} / ${moves.length} · dòng NC ${moves[step - 1].line}` : `0 / ${moves.length}`;
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
    play.textContent = 'Phát mô phỏng';
  }

  function reset() {
    stop();
    moves = [];
    setCode('');
    slider.max = slider.value = 0;
    slider.disabled = play.disabled = download.disabled = true;
    status.textContent = '';
    status.dataset.error = 'false';
    draw();
  }

  function replaceProfile(value, styles = [], keepDimensions = false) {
    edits.push({ profile: fields.profile.value, styles: edgeStyles });
    if (edits.length > 50) edits.shift();
    undo.disabled = false;
    fields.profile.value = value;
    edgeStyles = styles;
    if (!keepDimensions) {
      annotations.length = 0;
      editDimension(undefined);
    }
    setSelection(undefined);
    arcMiddle = undefined;
    reset();
  }

  function updateCompensation() {
    const available = fields.operation.value === 'profile';
    fields.compensation.disabled = !available;
    byId('turningCompensationLabel').hidden = !available;
    const showLead = available && fields.compensation.value !== 'off';
    fields.compLead.disabled = !showLead;
    byId('turningLeadLabel').hidden = !showLead;
    byId('turningCompensationNote').hidden = !showLead;
  }

  function updateOperation() {
    const grinding = fields.machine.value === 'pl800gb';
    const grindingGroup = byId('turningGrindingGroup');
    grindingGroup.hidden = grindingGroup.disabled = !grinding;
    if (!grinding && ['grind', 'grindPlunge'].includes(fields.operation.value)) fields.operation.value = 'profile';
    const operation = fields.operation.value;
    fields.feed.disabled = ['grind', 'grindPlunge'].includes(operation);
    fields.feed.closest('label').hidden = fields.feed.disabled;
    updateCompensation();
    const usesProfile = profileOperations.includes(operation);
    fields.profile.disabled = !usesProfile;
    fields.profile.closest('label').hidden = !usesProfile;
    fields.profile.closest('label').nextElementSibling.hidden = !usesProfile;
    undo.disabled = !usesProfile || !edits.length;
    arcMiddle = cursor = snapMarker = undefined;
    dimensionPoints = [];
    editDimension(undefined);
    setSelection(undefined);
    for (const button of tools) button.disabled = !usesProfile && button.dataset.sketchTool !== 'pan';
    const parameters = byId('turningParameters');
    parameters.hidden = !operationNotes[operation];
    const note = byId('turningOperationNote');
    note.hidden = !operationNotes[operation];
    note.textContent = operationNotes[operation] || '';
    for (const label of parameters.querySelectorAll('[data-operations]')) {
      label.hidden = !label.dataset.operations.split(' ').includes(operation);
      label.querySelector('input, select').disabled = label.hidden;
    }
    reset();
  }

  function setSelection(index, point) {
    selectedPoint = index;
    selectedEdge = undefined;
    removePoint.disabled = true;
    byId('turningPointEditor').hidden = !point;
    if (!point) return;
    byId('turningPointLabel').textContent = `Điểm ${index + 1}`;
    byId('turningPointX').value = point.x;
    byId('turningPointZ').value = point.z;
    const points = readProfile(fields.profile.value);
    insertPoint.disabled = index >= points.length - 1 || points.length >= 200 || points[index + 1]?.breakBefore;
    byId('turningJoinGap').hidden = !points[index]?.breakBefore || !index;
  }

  insertPoint.addEventListener('click', () => {
    if (selectedPoint === undefined || insertPoint.disabled) return;
    const points = readProfile(fields.profile.value);
    const index = selectedPoint + 1;
    const a = points[index - 1];
    const b = points[index];
    const midpoint = { x: Number(((a.x + b.x) / 2).toFixed(5)), z: Number(((a.z + b.z) / 2).toFixed(5)) };
    if ([a, b].some(point => point.x === midpoint.x && point.z === midpoint.z)) {
      sketchStatus.textContent = 'Đoạn này quá ngắn để chèn trung điểm.';
      return;
    }
    points.splice(index, 0, midpoint);
    const styles = edgeStyles.slice();
    styles.splice(index, 0, styles[index]);
    replaceProfile(writeProfile(points), styles);
    setSelection(index, midpoint);
    sketchStatus.textContent = 'Đã chèn trung điểm. Có thể chỉnh tọa độ điểm mới.';
    draw();
  });

  byId('turningJoinGap').addEventListener('click', () => {
    if (!selectedPoint) return;
    const points = readProfile(fields.profile.value);
    points[selectedPoint].breakBefore = false;
    replaceProfile(writeProfile(points), edgeStyles);
    sketchStatus.textContent = 'Đã nối khoảng hở bằng đoạn thẳng.';
  });

  function editSelected() {
    if (selectedPoint === undefined) return;
    const points = readProfile(fields.profile.value);
    const index = selectedPoint;
    const x = Number(byId('turningPointX').valueAsNumber.toFixed(5));
    const z = Number(byId('turningPointZ').valueAsNumber.toFixed(5));
    const { diameter, length } = dimensions();
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || x > diameter ||
        z < -length || (!index && z !== 0) || z > (previous?.z ?? 0) || (next && z < next.z) ||
        [previous, next].some(point => point?.x === x && point.z === z)) {
      sketchStatus.textContent = 'Điểm sửa phải nằm trong phôi, giữ thứ tự Z và không trùng điểm kề.';
      return;
    }
    points[index] = { ...points[index], x, z };
    replaceProfile(writeProfile(points), edgeStyles);
    setSelection(index, points[index]);
    sketchStatus.textContent = 'Đã cập nhật tọa độ điểm.';
    draw();
  }

  function deleteEdge() {
    if (selectedEdge === undefined) return;
    const points = readProfile(fields.profile.value);
    let first = selectedEdge, last = selectedEdge;
    const stroke = edgeStyles[selectedEdge]?.stroke;
    if (stroke !== undefined) {
      while (first > 1 && edgeStyles[first - 1]?.stroke === stroke && !points[first - 1].breakBefore) first--;
      while (last < points.length - 1 && edgeStyles[last + 1]?.stroke === stroke && !points[last + 1].breakBefore) last++;
    }
    points[last].breakBefore = true;
    points.splice(first, last - first);
    const styles = edgeStyles.slice();
    styles.splice(first, last - first);
    replaceProfile(writeProfile(points), styles);
    sketchStatus.textContent = 'Đã xóa nét được chọn. Dùng Hoàn tác hoặc nối lại khoảng hở trước khi tạo NC.';
  }

  form.addEventListener('input', event => {
    if (event.target === fields.profile) {
      arcMiddle = cursor = snapMarker = undefined;
      edgeStyles = [];
      annotations.length = 0;
      editDimension(undefined);
      setSelection(undefined);
    }
    if (event.target !== fields.operation) reset();
  });
  fields.operation.addEventListener('change', updateOperation);
  fields.compensation.addEventListener('change', () => { updateCompensation(); reset(); });
  fields.machine.addEventListener('change', updateOperation);
  for (const field of [fields.grindOn, fields.grindOff, fields.controller]) {
    field.addEventListener('input', () => { fields.grindConfirmed.checked = false; });
  }
  undo.addEventListener('click', () => {
    const previous = edits.pop();
    fields.profile.value = previous.profile;
    edgeStyles = previous.styles;
    annotations.length = 0;
    editDimension(undefined);
    setSelection(undefined);
    undo.disabled = !edits.length;
    arcMiddle = undefined;
    reset();
  });
  for (const control of [showProfile, showRapid]) control.addEventListener('change', draw);
  function selectTool(value) {
    activeTool = value;
    for (const button of tools) {
      button.setAttribute('aria-pressed', String(button.dataset.sketchTool === value));
    }
    arcMiddle = cursor = snapMarker = undefined;
    setSelection(undefined);
    canvas.toggleAttribute('data-pan', value === 'pan');
    canvas.toggleAttribute('data-select', value === 'select');
    dimensionPoints = [];
    editDimension(undefined);
    byId('turningDimensionOptions').hidden = value !== 'dimension';
    sketchStatus.textContent = value === 'select'
      ? 'Chọn trên thân nét để tô màu hoặc xóa. Chọn nút để sửa tọa độ.'
      : value === 'dimension' ? 'Chọn hai điểm đo, sau đó chọn vị trí đặt đường kích thước.'
      : value === 'arc' ? 'Chọn điểm giữa và điểm cuối cho cung nối từ điểm hiện tại.' : '';
    draw();
  }

  for (const button of tools) {
    button.addEventListener('click', () => selectTool(button.dataset.sketchTool));
  }
  removePoint.addEventListener('click', deleteEdge);
  byId('turningApplyPoint').addEventListener('click', editSelected);
  color.addEventListener('input', () => {
    if (selectedEdge !== undefined) {
      const stroke = edgeStyles[selectedEdge]?.stroke;
      const styles = edgeStyles.slice();
      if (stroke !== undefined) {
        styles.forEach((style, index) => {
          if (style?.stroke === stroke) styles[index] = { stroke, color: color.value };
        });
      } else {
        styles[selectedEdge] = { color: color.value };
      }
      edgeStyles = styles;
    }
    draw();
  });
  dimensionType.addEventListener('change', () => { dimensionPoints = []; editDimension(undefined); draw(); });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      arcMiddle = cursor = snapMarker = undefined;
      dimensionPoints = [];
      editDimension(undefined);
      setSelection(undefined);
      sketchStatus.textContent = '';
      draw();
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdge !== undefined) {
      event.preventDefault();
      deleteEdge();
    }
    if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !undo.disabled) {
      event.preventDefault();
      undo.click();
    }
  });
  byId('turningFit').addEventListener('click', () => {
    zoom = 1;
    panX = panY = 0;
    draw();
  });
  for (const [id, factor] of [['turningZoomIn', 1.35], ['turningZoomOut', 1 / 1.35]]) {
    byId(id).addEventListener('click', () => {
      zoom = Math.min(12, Math.max(0.5, zoom * factor));
      draw();
    });
  }
  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * logicalWidth / bounds.width,
      y: (event.clientY - bounds.top) * logicalHeight / bounds.height,
    };
  }

  function sketchPoint(event) {
    const display = canvasPoint(event);
    const raw = {
      z: (display.x - plot.zOrigin) / plot.scale,
      x: (plot.bottom - display.y) * 2 / plot.scale,
    };
    let points;
    try {
      points = readProfile(fields.profile.value);
    } catch {
      return;
    }
    const { diameter, length } = dimensions();
    const tolerance = Math.min(length / 6, 9 * logicalWidth / canvas.getBoundingClientRect().width / plot.scale);
    const selecting = activeTool === 'select';
    const candidate = (objectSnap.checked || selecting) && findSketchSnap(raw, points, tolerance, selecting);
    snapMarker = candidate || undefined;
    if (selecting) return candidate || undefined;
    if (activeTool === 'dimension') {
      if (dimensionPoints.length < 2 && candidate) return candidate;
      snapMarker = undefined;
      return raw;
    }
    const grid = Number(byId('turningSnap').value);
    const rounded = value => Number((grid ? Math.round(value / grid) * grid : value).toFixed(4));
    const z = candidate?.z ?? (Math.abs(raw.z) <= Math.min(length / 8, 4 / plot.scale) ? 0 : rounded(raw.z));
    const x = candidate?.x ?? rounded(raw.x);
    const last = points.at(-1);
    const result = { x: activeTool === 'horizontal' && last ? last.x : x, z: activeTool === 'vertical' && last ? last.z : z };
    if (candidate && (candidate.x !== result.x || candidate.z !== result.z)) snapMarker = undefined;
    if (result.z > 0 || result.z < -length || result.x < 0 || result.x > diameter) return;
    return result;
  }

  canvas.addEventListener('pointerdown', event => {
    if (activeTool !== 'pan') return;
    drag = canvasPoint(event);
    canvas.setPointerCapture(event.pointerId);
    canvas.toggleAttribute('data-dragging', true);
  });
  let pointerPaint = 0;
  canvas.addEventListener('pointermove', event => {
    if (drag) {
      const next = canvasPoint(event);
      panX += next.x - drag.x;
      panY += next.y - drag.y;
      drag = next;
    }
    cursor = fields.profile.disabled ? undefined : sketchPoint(event);
    coordinateLabel.textContent = cursor ? `X ${cursor.x} mm · Z ${cursor.z} mm` + (snapMarker ? ` · ${snapMarker.label}` : '') : 'X — · Z —';
    if (!pointerPaint) pointerPaint = requestAnimationFrame(() => {
      pointerPaint = 0;
      draw();
    });
  });
  const endDrag = () => {
    drag = undefined;
    canvas.removeAttribute('data-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('pointerleave', () => {
    cursor = snapMarker = undefined;
    coordinateLabel.textContent = 'X — · Z —';
    draw();
  });
  function editDimension(annotation) {
    activeDimension = annotation;
    dimensionEditor.hidden = !annotation;
    if (!annotation) return;
    const driven = annotation.b.index !== undefined;
    dimensionInput.value = dimensionValue(annotation.a, annotation.b, annotation.type).toFixed(3);
    dimensionInput.disabled = byId('turningApplyDimension').disabled = !driven;
    dimensionHelp.textContent = driven
      ? 'Điểm thứ hai sẽ thay đổi, điểm chuẩn giữ nguyên. Có thể nhập số trước hoặc sau khi đặt kích thước.'
      : 'Kích thước đo. Bắt điểm thứ hai vào đầu mút để nhập số và chỉnh hình học.';
  }

  byId('turningApplyDimension').addEventListener('click', () => {
    if (activeDimension?.b.index === undefined) return;
    try {
      const points = readProfile(fields.profile.value);
      const { a, b, type, placement } = activeDimension;
      const endpoint = resizeTurningEndpoint(points, b.index, a, dimensionInput.valueAsNumber, type, dimensions());
      points[b.index] = endpoint;
      const edited = { a, b: { ...endpoint, index: b.index }, type, placement };
      replaceProfile(writeProfile(points), edgeStyles);
      dimensionPoints = placement ? [] : [a, edited.b];
      if (placement) annotations.push(edited);
      editDimension(edited);
      sketchStatus.textContent = `Đã cập nhật biên dạng theo ${dimensionValue(a, edited.b, type).toFixed(3)} mm.`;
      draw();
    } catch (error) {
      dimensionHelp.textContent = error.message;
    }
  });
  dimensionInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); byId('turningApplyDimension').click(); }
  });

  canvas.addEventListener('click', event => {
    if (fields.profile.disabled || activeTool === 'pan') return;
    const point = sketchPoint(event);
    if (activeTool === 'select') {
      setSelection(point?.index, point);
      if (!point) {
        const display = canvasPoint(event);
        const raw = { x: (plot.bottom - display.y) * 2 / plot.scale, z: (display.x - plot.zOrigin) / plot.scale };
        try {
          selectedEdge = nearestSketchEdge(raw, readProfile(fields.profile.value), 8 * logicalWidth / canvas.getBoundingClientRect().width / plot.scale);
        } catch (error) {
          sketchStatus.textContent = error.message;
        }
        removePoint.disabled = selectedEdge === undefined;
        if (selectedEdge !== undefined) color.value = edgeStyles[selectedEdge]?.color || '#50efad';
      }
      if (point || selectedEdge !== undefined) showProfile.checked = true;
      draw();
      canvas.focus();
      return;
    }
    if (!point) return;
    if (activeTool === 'dimension') {
      if (dimensionPoints.length < 2) {
        if (dimensionPoints.length && Math.hypot(point.x - dimensionPoints[0].x, point.z - dimensionPoints[0].z) < 0.0001) return;
        if (!dimensionPoints.length && dimensionType.value === 'diameter') dimensionPoints.push({ x: 0, z: point.z });
        dimensionPoints.push(point);
        if (dimensionPoints.length === 2) editDimension({ a: dimensionPoints[0], b: dimensionPoints[1], type: dimensionType.value });
        else editDimension(undefined);
        sketchStatus.textContent = dimensionPoints.length === 2 ? 'Chọn vị trí đặt đường kích thước.' : 'Chọn điểm đo thứ hai.';
      } else {
        const [a, b] = dimensionPoints;
        const type = dimensionType.value;
        const value = dimensionValue(a, b, type);
        if (value < 0.0001) {
          sketchStatus.textContent = 'Hai điểm không tạo khoảng cách theo kiểu đo đã chọn.';
        } else if (annotations.length >= 50) {
          sketchStatus.textContent = 'Đã đạt giới hạn 50 kích thước.';
        } else {
          const annotation = { a, b, placement: point, type };
          annotations.push(annotation);
          editDimension(annotation);
          sketchStatus.textContent = `Đã đặt kích thước ${type === 'diameter' ? 'Ø' : ''}${value.toFixed(3)} mm.`;
        }
        dimensionPoints = [];
      }
      draw();
      return;
    }
    const points = readProfile(fields.profile.value);
    const last = points.at(-1);
    if (!last && point.z !== 0) {
      sketchStatus.textContent = 'Chọn điểm đầu tại trục Z0.';
      return;
    }
    let additions = [point];
    try {
      if (activeTool === 'arc' && last) {
        if (!arcMiddle) {
          arcMiddle = point;
          sketchStatus.textContent = 'Đã đặt điểm giữa cung. Chọn điểm cuối.';
          draw();
          return;
        }
        additions = arcPoints(last, arcMiddle, point);
      }
      const { diameter, length } = dimensions();
      for (let i = 0; i < additions.length; i++) {
        const next = additions[i];
        const previous = additions[i - 1] || last;
        if (next.z > (previous?.z ?? 0) || next.z < -length || next.x < 0 || next.x > diameter) {
          throw new Error('Nét vẽ phải nằm trong phôi và đi về Z âm hoặc giữ nguyên Z.');
        }
        if (previous?.x === next.x && previous.z === next.z) throw new Error('Điểm mới trùng điểm trước.');
      }
      if (points.length + additions.length > 200) throw new Error('Biên dạng vượt quá 200 điểm.');
      showProfile.checked = true;
      sketchStatus.textContent = '';
      const styles = edgeStyles.slice();
      const stroke = nextStroke++;
      additions.forEach((_, i) => { if (points.length + i) styles[points.length + i] = { color: color.value, stroke }; });
      replaceProfile(writeProfile([...points, ...additions]), styles, true);
    } catch (error) {
      arcMiddle = undefined;
      sketchStatus.textContent = error.message;
      draw();
    }
  });

  for (const id of ['turningImageWidth', 'turningImageZ', 'turningImageR', 'turningImageOpacity']) {
    byId(id).addEventListener('input', draw);
  }
  const imagePreview = byId('turningImagePreview');
  const imageInput = byId('turningImage');
  const meshInput = byId('turningMesh');
  const pdfInput = byId('turningPdf');
  const dxfInput = byId('turningDxf');
  const pdfPage = byId('turningPdfPage');
  let pdfDocument;
  let imageCrop;
  let cropStart;
  let cropEnd;
  let previewBounds;
  let pdfTask;
  for (const [button, input] of [['turningOpenImage', imageInput], ['turningOpenMesh', meshInput], ['turningOpenPdf', pdfInput], ['turningOpenDxf', dxfInput]]) {
    byId(button).addEventListener('click', () => {
      byId('turningImportPanel').open = true;
      input.click();
    });
  }

  function loadImportedProfile(points, diameter, length) {
    if (diameter > 10000 || length > 10000) throw new Error('Kích thước chi tiết vượt phạm vi phôi 10000 mm.');
    // Preserve the configured stock when it already covers the new geometry.
    fields.diameter.value = Math.max(dimensions().diameter, diameter);
    stockLength.value = Math.max(dimensions().length, length);
    if (!profileOperations.includes(fields.operation.value)) fields.operation.value = 'profile';
    showProfile.checked = true;
    panX = panY = 0;
    zoom = 1;
    updateOperation();
    replaceProfile(writeProfile(points));
    form.requestSubmit();
  }

  byId('turningTraceImage').addEventListener('click', () => {
    try {
      if (!referenceImage) throw new Error('Chọn ảnh hình chiếu cạnh trước.');
      const raster = document.createElement('canvas');
      const crop = imageCrop || { x: 0, y: 0, width: referenceImage.width, height: referenceImage.height };
      const scale = Math.min(1, 1200 / Math.max(crop.width, crop.height));
      raster.width = Math.max(1, Math.round(crop.width * scale));
      raster.height = Math.max(1, Math.round(crop.height * scale));
      const context = raster.getContext('2d');
      context.drawImage(referenceImage, crop.x, crop.y, crop.width, crop.height, 0, 0, raster.width, raster.height);
      const face = byId('turningImageFace').value;
      const result = profileFromImage(context.getImageData(0, 0, raster.width, raster.height), {
        known: byId('turningImageActual').valueAsNumber,
        measure: byId('turningImageMeasure').value,
        face,
        threshold: Number(byId('turningImageThreshold').value),
      });
      const { bounds, mmPerPixel, diameter, length } = result;
      imageFlipped = face === 'left';
      const sourcePixel = raster.width / crop.width * mmPerPixel;
      const sourceX = crop.x + (imageFlipped ? bounds.first : bounds.last) * crop.width / raster.width;
      const sourceCenter = crop.y + bounds.center * crop.height / raster.height;
      byId('turningImageWidth').value = referenceImage.width * sourcePixel;
      byId('turningImageZ').value = (imageFlipped ? sourceX : referenceImage.width - sourceX) * sourcePixel;
      byId('turningImageR').value = (sourceCenter - referenceImage.height) * sourcePixel;
      loadImportedProfile(result.points, diameter, length);
      importStatus.textContent = `Ước lượng Ø${diameter.toFixed(2)} × ${length.toFixed(2)} mm · ${result.points.length} điểm. Tỷ lệ ảnh ${mmPerPixel.toPrecision(3)} mm/pixel. Hãy đối chiếu kích thước và đường dao trên hình.`;
    } catch (error) {
      importStatus.textContent = error.message;
    }
  });

  function drawImagePreview() {
    const image = referenceImage;
    if (!image) return;
    const ctx = imagePreview.getContext('2d');
    const fit = Math.min(imagePreview.width / image.width, imagePreview.height / image.height);
    const width = image.width * fit, height = image.height * fit;
    const x = (imagePreview.width - width) / 2, y = (imagePreview.height - height) / 2;
    previewBounds = { x, y, fit };
    ctx.clearRect(0, 0, imagePreview.width, imagePreview.height);
    ctx.drawImage(image, x, y, width, height);
    const crop = cropStart && cropEnd ? cropRectangle(cropStart, cropEnd) : imageCrop;
    if (crop) {
      ctx.fillStyle = 'rgba(39, 124, 211, .20)';
      ctx.strokeStyle = '#2277cf';
      ctx.fillRect(x + crop.x * fit, y + crop.y * fit, crop.width * fit, crop.height * fit);
      ctx.strokeRect(x + crop.x * fit, y + crop.y * fit, crop.width * fit, crop.height * fit);
    }
  }

  function cropRectangle(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
  }

  function sourcePoint(event) {
    const rect = imagePreview.getBoundingClientRect();
    const { x, y, fit } = previewBounds;
    const rawX = ((event.clientX - rect.left) * imagePreview.width / rect.width - x) / fit;
    const rawY = ((event.clientY - rect.top) * imagePreview.height / rect.height - y) / fit;
    return { x: Math.min(referenceImage.width, Math.max(0, rawX)), y: Math.min(referenceImage.height, Math.max(0, rawY)) };
  }

  imagePreview.addEventListener('pointerdown', event => {
    if (!referenceImage) return;
    cropStart = cropEnd = sourcePoint(event);
    imagePreview.setPointerCapture(event.pointerId);
  });
  imagePreview.addEventListener('pointermove', event => {
    if (!cropStart) return;
    cropEnd = sourcePoint(event);
    drawImagePreview();
  });
  imagePreview.addEventListener('pointerup', event => {
    if (!cropStart) return;
    const crop = cropRectangle(cropStart, sourcePoint(event));
    cropStart = cropEnd = undefined;
    if (crop.width > 12 && crop.height > 12) imageCrop = crop;
    drawImagePreview();
  });
  imagePreview.addEventListener('lostpointercapture', () => {
    cropStart = cropEnd = undefined;
    drawImagePreview();
  });
  byId('turningResetCrop').addEventListener('click', () => {
    imageCrop = undefined;
    drawImagePreview();
  });

  function showReference(image) {
    referenceImage?.close();
    referenceImage = image;
    imageFlipped = false;
    imageCrop = cropStart = cropEnd = undefined;
    imagePreview.hidden = false;
    byId('turningImageCropControls').hidden = false;
    drawImagePreview();
    byId('turningImageWidth').value = dimensions().length;
    byId('turningImageZ').value = 0;
    byId('turningImageR').value = 0;
    byId('turningImageActual').value = '';
    importStatus.textContent = 'Đã đặt ảnh nền. Nhập kích thước thực để lấy đường bao hoặc vẽ đè theo ảnh.';
    draw();
  }

  async function renderPdfPage(revision) {
    const page = await pdfDocument.getPage(Number(pdfPage.value));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1800 / Math.max(base.width, base.height) });
    const buffer = document.createElement('canvas');
    buffer.width = Math.ceil(viewport.width);
    buffer.height = Math.ceil(viewport.height);
    const context = buffer.getContext('2d');
    await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
    const image = await createImageBitmap(buffer);
    if (revision !== imageRevision) {
      image.close();
      return;
    }
    showReference(image);
    importStatus.textContent = `Đã mở trang ${pdfPage.value}/${pdfDocument.numPages}. Nhập kích thước thực để lấy biên dạng hoặc vẽ đè.`;
  }

  pdfInput.addEventListener('change', async () => {
    const revision = ++imageRevision;
    const file = pdfInput.files[0];
    if (!file) return;
    try {
      if (!/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error('Chọn PDF bản vẽ tối đa 20 MB.');
      const oldTask = pdfTask;
      pdfTask = pdfDocument = undefined;
      byId('turningPdfPageLabel').hidden = true;
      await oldTask?.destroy();
      importStatus.textContent = 'Đang đọc PDF…';
      const renderer = await import('../vendor/pdfjs/pdf.min.js');
      renderer.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
      const data = await file.arrayBuffer();
      if (revision !== imageRevision) return;
      pdfTask = renderer.getDocument({ data, isEvalSupported: false, useSystemFonts: true, enableXfa: false });
      const document = await pdfTask.promise;
      if (revision !== imageRevision) return;
      pdfDocument = document;
      pdfPage.replaceChildren(...Array.from({ length: Math.min(document.numPages, 500) }, (_, index) => new Option(String(index + 1))));
      byId('turningPdfPageLabel').hidden = false;
      imageInput.value = '';
      await renderPdfPage(revision);
    } catch (error) {
      if (revision === imageRevision) importStatus.textContent = error.name === 'PasswordException'
        ? 'PDF có mật khẩu. Hãy mở khóa và lưu bản PDF trước khi nhập.'
        : `Không mở được PDF. ${error.message}`;
    }
  });

  pdfPage.addEventListener('change', async () => {
    const revision = ++imageRevision;
    try {
      await renderPdfPage(revision);
    } catch (error) {
      if (revision === imageRevision) importStatus.textContent = `Không mở được trang PDF. ${error.message}`;
    }
  });

  byId('turningImportDxf').addEventListener('click', async () => {
    const revision = ++meshRevision;
    const file = dxfInput.files[0];
    const original = fields.profile.value;
    try {
      if (!file || !/\.dxf$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Chọn DXF ASCII tối đa 5 MB.');
      const points = profileFromDxf(await file.text(), {
        units: byId('turningDxfUnits').value,
        center: byId('turningDxfCenter').valueAsNumber,
        face: byId('turningImageFace').value,
      });
      if (revision !== meshRevision) return;
      if (fields.profile.value !== original) throw new Error('Biên dạng vừa thay đổi. Bấm nhập DXF lần nữa để thay thế.');
      const diameter = Math.max(0.1, ...points.map(point => point.x));
      const length = Math.max(0.1, -points.at(-1).z);
      loadImportedProfile(points, diameter, length);
      importStatus.textContent = `Đã nhập đường biên DXF Ø${diameter.toFixed(2)} × ${length.toFixed(2)} mm · ${points.length} điểm.`;
    } catch (error) {
      if (revision === meshRevision) importStatus.textContent = error.message;
    }
  });

  imageInput.addEventListener('change', async event => {
    const revision = ++imageRevision;
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
        throw new Error('Chọn ảnh PNG, JPEG hoặc WebP tối đa 12 MB.');
      }
      const image = await createImageBitmap(file);
      if (revision !== imageRevision) {
        image.close();
        return;
      }
      const oldTask = pdfTask;
      pdfTask = pdfDocument = undefined;
      byId('turningPdfPageLabel').hidden = true;
      pdfInput.value = '';
      oldTask?.destroy().catch(() => {});
      showReference(image);
    } catch (error) {
      if (revision === imageRevision) importStatus.textContent = error.message;
    }
  });
  byId('turningRemoveImage').addEventListener('click', () => {
    imageRevision++;
    referenceImage?.close();
    referenceImage = undefined;
    imageInput.value = pdfInput.value = '';
    const oldTask = pdfTask;
    pdfTask = pdfDocument = undefined;
    oldTask?.destroy().catch(() => {});
    byId('turningPdfPageLabel').hidden = true;
    imagePreview.hidden = true;
    byId('turningImageCropControls').hidden = true;
    imageCrop = cropStart = cropEnd = undefined;
    importStatus.textContent = '';
    draw();
  });
  byId('turningImportMesh').addEventListener('click', async () => {
    const revision = ++meshRevision;
    const file = meshInput.files[0];
    const axis = byId('turningMeshAxis').value;
    const original = fields.profile.value;
    try {
      if (!file || !/\.stl$/i.test(file.name) || file.size > 12 * 1024 * 1024) {
        throw new Error('Chọn tệp .stl tối đa 12 MB.');
      }
      const points = profileFromStl(await file.arrayBuffer(), axis);
      if (revision !== meshRevision) return;
      if (fields.profile.value !== original) throw new Error('Biên dạng vừa thay đổi. Bấm nhập STL lần nữa để thay thế.');
      const diameter = Math.max(0.1, ...points.map(point => point.x));
      const length = Math.max(0.1, -points.at(-1).z);
      loadImportedProfile(points, diameter, length);
      importStatus.textContent = `Đã lấy ${points.length} điểm biên dạng theo trục ${axis}. Kích thước Ø${diameter.toFixed(2)} × ${length.toFixed(2)} mm. Hãy đối chiếu trước khi dùng mã thử.`;
    } catch (error) {
      if (revision === meshRevision) importStatus.textContent = error.message;
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    reset();
    try {
      const settings = Object.fromEntries(new FormData(form));
      for (const { name, type } of fields) if (name && type === 'number') settings[name] = Number(settings[name]);
      const program = generateTurningProgram(settings);
      moves = readTurningMoves(program);
      setCode(program);
      slider.max = moves.length;
      slider.value = moves.length;
      slider.disabled = play.disabled = download.disabled = false;
      status.textContent = `Đã tạo mã thử nghiệm và đọc ${moves.length} đoạn đường chạy từ mã NC.`;
      draw();
      const controls = play.closest('.turning-playbar');
      const bounds = controls.getBoundingClientRect();
      if (event.submitter && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
        controls.scrollIntoView({ block: 'center' });
      }
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = error.message;
    }
  });
  slider.addEventListener('input', () => {
    stop();
    draw();
  });
  play.addEventListener('click', () => {
    if (timer) {
      stop();
      return;
    }
    if (+slider.value >= moves.length) slider.value = 0;
    draw();
    play.textContent = 'Tạm dừng';
    timer = setInterval(() => {
      slider.stepUp();
      draw();
      if (+slider.value >= moves.length) stop();
    }, 330);
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([code.value], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fanuc-tien-ban-thu.nc';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  new ResizeObserver(() => {
    const width = canvas.clientWidth;
    if (!width) return;
    const resolution = Math.min(2.5, Math.max(1, width * devicePixelRatio / logicalWidth));
    const target = Math.round(logicalWidth * resolution);
    if (canvas.width !== target) {
      canvas.width = target;
      canvas.height = Math.round(target * logicalHeight / logicalWidth);
      draw();
    }
  }).observe(canvas);
  updateOperation();
}
