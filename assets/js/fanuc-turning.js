import { arcPoints, profileFromStl } from "./fanuc-sketch.js?v=2";

const clearance = 3;
const profileOperations = ['profile', 'rough'];
const operationNotes = {
  rough: 'Tiện theo lớp G00/G01. Biên dạng phải có đường kính tăng dần hoặc giữ nguyên khi đi về phía mâm cặp.',
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
    const values = row.trim().split(/\s+/);
    if (values.length !== 2 || values.some(value => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))) {
      throw new Error(`Dòng ${index + 1} cần hai số X và Z, dùng dấu chấm cho phần thập phân.`);
    }
    return { x: Number(values[0]), z: Number(values[1]) };
  });
}

export function generateTurningProgram(settings) {
  const { operation, units, diameter, length, tool, offset, rpm, feed, profile } = settings;
  const scale = unitsToMm[units];
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (!inRange(diameter, 0.1, 10000) || !inRange(length, 0.1, 10000)) {
    throw new Error('Kích thước phôi phải trong khoảng 0.1–10000 mm.');
  }
  if (![tool, offset, rpm].every(Number.isInteger) || !inRange(tool, 1, 99) ||
      !inRange(offset, 1, 99) || !inRange(rpm, 1, 99999) || !inRange(feed, 0.001, 100)) {
    throw new Error('Kiểm tra số dao, số offset, tốc độ trục chính và lượng chạy dao.');
  }
  if (!scale || ![...profileOperations, 'face', 'groove', 'part', 'drill', 'thread'].includes(operation)) throw new Error('Chọn đơn vị và nguyên công hợp lệ.');
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
    `G18 G40 G80 G99 G${units === 'inch' ? '20' : '21'}`,
    'G54', `T${String(tool).padStart(2, '0')}${String(offset).padStart(2, '0')}`,
    `G97 S${rpm} M03`, rapid(start),
  ];
  const feedWord = ` F${(feed / scale).toFixed(units === 'inch' ? 6 : 4)}`;
  const passCount = (distance, step) => {
    if (!inRange(step, 0.001, 10000)) throw new Error('Bước cắt phải lớn hơn hoặc bằng 0,001 mm.');
    const count = Math.ceil(distance / step - 1e-9);
    if (count > 300) throw new Error('Thông số tạo hơn 300 lượt cắt. Hãy tăng bước cắt.');
    return count;
  };
  if (operation === 'thread') {
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
    if (operation === 'rough') {
      const { stepDepth, allowance } = settings;
      if (!inRange(allowance, 0, diameter / 2)) throw new Error('Lượng dư theo bán kính không hợp lệ.');
      if (points.some((point, index) => index && point.x < points[index - 1].x)) {
        throw new Error('Tiện thô theo lớp chỉ hỗ trợ biên dạng có đường kính tăng dần hoặc giữ nguyên về phía Z âm.');
      }
      const target = points[0].x + 2 * allowance;
      if (target >= diameter) throw new Error('Không có lớp thô trong phôi với lượng dư đã nhập.');
      const count = passCount((diameter - target) / 2, stepDepth);
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
    } else {
      lines.push(rapid({ x: points[0].x, z: clearance }), cut(points[0]) + feedWord,
        ...points.slice(1).map(cut), rapid({ x: outside, z: last.z }), rapid(start));
    }
  }
  return [...lines, 'M05', 'M30', '%', ''].join('\n');
}

export function readTurningMoves(program) {
  let scale = 1;
  let mode;
  let position;
  const moves = [];
  for (const [index, raw] of program.split('\n').entries()) {
    const line = raw.replace(/\([^)]*\)/g, '');
    const words = new Map();
    for (const [, address, number] of line.matchAll(/([A-Z])([+-]?\d+(?:\.\d+)?)/g)) {
      const value = Number(number);
      words.set(address, value);
      if (address !== 'G') continue;
      if (value === 20 || value === 21) scale = value === 20 ? 25.4 : 1;
      if (value === 0) mode = 'rapid';
      if (value === 1) mode = 'feed';
      if (value === 32) mode = 'thread';
    }
    if (!mode || (!words.has('X') && !words.has('Z'))) continue;
    const to = {
      x: words.has('X') ? words.get('X') * scale : position?.x,
      z: words.has('Z') ? words.get('Z') * scale : position?.z,
    };
    if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) continue;
    if (position) moves.push({ from: position, to, mode, line: index + 1 });
    position = to;
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
  const tool = byId('turningSketchTool');
  const coordinateLabel = byId('turningCoordinate');
  const currentBlock = byId('turningCurrentBlock');
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
    const left = 44, top = 20, right = canvas.width - 44, bottom = canvas.height - 38;
    const pitch = fields.operation.value === 'thread' ? fields.pitch.valueAsNumber : 0;
    const front = Math.max(clearance, Number.isFinite(pitch) && pitch <= 100 ? 2 * pitch : 0);
    const spanZ = length + clearance + front;
    const spanR = diameter / 2 + 2 * clearance;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - 5, top - 2, right - left + 10, bottom - top + 7);
    ctx.clip();
    const [stockLeft, stockTop] = at({ x: diameter, z: -length });
    ctx.fillStyle = '#e1e7ef';
    ctx.fillRect(stockLeft, stockTop, length * scale, baseY - stockTop);
    if (referenceImage) {
      const width = byId('turningImageWidth').valueAsNumber;
      const z = byId('turningImageZ').valueAsNumber;
      const r = byId('turningImageR').valueAsNumber;
      if (width > 0 && Number.isFinite(z) && Number.isFinite(r)) {
        const height = width * referenceImage.height / referenceImage.width;
        const [x, y] = at({ x: 2 * (r + height), z: z - width });
        ctx.globalAlpha = Number(byId('turningImageOpacity').value) / 100;
        ctx.drawImage(referenceImage, x, y, width * scale, height * scale);
        ctx.globalAlpha = 1;
      }
    }
    ctx.font = '12px system-ui';
    const magnitude = 10 ** Math.floor(Math.log10(48 / scale));
    const interval = [1, 2, 5, 10].map(v => v * magnitude).find(v => v * scale >= 48);
    const format = n => String(Number(n.toPrecision(6)));
    const ticks = [];
    ctx.fillStyle = '#c5d0de';
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
    ctx.fillStyle = '#566a83';
    ctx.fillRect(left, baseY, right - left, 1);
    ctx.fillRect(zOrigin, top, 1, bottom - top);
    ctx.strokeStyle = '#91a2ba';
    ctx.strokeRect(stockLeft, stockTop, length * scale, baseY - stockTop);

    if (showProfile.checked && profileOperations.includes(fields.operation.value)) {
      let points = [];
      try {
        points = readProfile(fields.profile.value).filter(point => point.x >= 0 && point.x <= diameter && point.z >= -length && point.z <= 0);
      } catch {
        // Validation on submit reports incomplete or malformed coordinate rows.
      }
      drawLine(points, '#177044');
      if (points.length && cursor && tool.value !== 'pan') {
        const last = points.at(-1);
        let preview = [last, cursor];
        if (arcMiddle) {
          try {
            preview = [last, ...arcPoints(last, arcMiddle, cursor)];
          } catch {
            preview = [last, arcMiddle, cursor];
          }
        }
        drawLine(preview, '#168457', [4, 4]);
      }
      ctx.fillStyle = '#177044';
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(...at(point), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const step = Number(slider.value);
    for (const move of moves.slice(step)) {
      if (showRapid.checked || move.mode !== 'rapid') drawLine([move.from, move.to], '#c1cbd8', [2, 5]);
    }
    moves.slice(0, step).forEach((move, index) => {
      const rapid = move.mode === 'rapid';
      if (rapid && !showRapid.checked) return;
      const active = index === step - 1;
      const color = active ? '#6833b4' : rapid ? '#ac510c' : move.mode === 'thread' ? '#a52267' : '#1457bd';
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
      ctx.fillStyle = '#14243b';
      ctx.beginPath();
      ctx.arc(...at(position), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#475569';
    for (const tick of ticks) ctx.fillText(tick.value, tick.x, tick.y);
    ctx.fillText('R (mm)', left, top - 6);
    ctx.fillText('Z (mm)', right - 30, bottom + 33);
    currentBlock.textContent = step ? code.value.split('\n')[moves[step - 1].line - 1] : '—';
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
    code.value = '';
    slider.max = slider.value = 0;
    slider.disabled = play.disabled = download.disabled = true;
    status.textContent = '';
    status.dataset.error = 'false';
    draw();
  }

  function showStatus(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function replaceProfile(value) {
    edits.push(fields.profile.value);
    if (edits.length > 50) edits.shift();
    undo.disabled = false;
    fields.profile.value = value;
    arcMiddle = undefined;
    reset();
  }

  function updateOperation() {
    const operation = fields.operation.value;
    const usesProfile = profileOperations.includes(operation);
    fields.profile.disabled = byId('turningClear').disabled = !usesProfile;
    fields.profile.closest('label').hidden = !usesProfile;
    fields.profile.closest('label').nextElementSibling.hidden = !usesProfile;
    undo.disabled = !usesProfile || !edits.length;
    arcMiddle = cursor = undefined;
    const parameters = byId('turningParameters');
    parameters.hidden = !operationNotes[operation];
    const note = byId('turningOperationNote');
    note.hidden = !operationNotes[operation];
    note.textContent = operationNotes[operation] || '';
    for (const label of parameters.querySelectorAll('[data-operations]')) {
      label.hidden = !label.dataset.operations.split(' ').includes(operation);
      label.querySelector('input').disabled = label.hidden;
    }
    reset();
  }

  form.addEventListener('input', event => {
    if (event.target === fields.profile) arcMiddle = undefined;
    if (event.target !== fields.operation) reset();
  });
  fields.operation.addEventListener('change', updateOperation);
  byId('turningClear').addEventListener('click', () => {
    replaceProfile('');
    fields.profile.focus();
  });
  undo.addEventListener('click', () => {
    fields.profile.value = edits.pop();
    undo.disabled = !edits.length;
    arcMiddle = undefined;
    reset();
  });
  for (const control of [showProfile, showRapid]) control.addEventListener('change', draw);
  tool.addEventListener('change', () => {
    arcMiddle = cursor = undefined;
    canvas.toggleAttribute('data-pan', tool.value === 'pan');
    draw();
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
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    };
  }

  function sketchPoint(event) {
    const display = canvasPoint(event);
    const rawZ = (display.x - plot.zOrigin) / plot.scale;
    const rawX = (plot.bottom - display.y) * 2 / plot.scale;
    const { diameter, length } = dimensions();
    const snap = Number(byId('turningSnap').value);
    const rounded = value => Number((snap ? Math.round(value / snap) * snap : value).toFixed(4));
    const z = Math.abs(rawZ) <= Math.min(length / 8, 4 / plot.scale) ? 0 : rounded(rawZ);
    const x = rounded(rawX);
    if (z > 0 || z < -length || x < 0 || x > diameter) return;
    let last;
    try {
      last = readProfile(fields.profile.value).at(-1);
    } catch {
      return;
    }
    return { x: tool.value === 'horizontal' && last ? last.x : x, z: tool.value === 'vertical' && last ? last.z : z };
  }

  canvas.addEventListener('pointerdown', event => {
    if (tool.value !== 'pan') return;
    drag = canvasPoint(event);
    canvas.setPointerCapture(event.pointerId);
    canvas.toggleAttribute('data-dragging', true);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag) {
      const next = canvasPoint(event);
      panX += next.x - drag.x;
      panY += next.y - drag.y;
      drag = next;
    }
    cursor = fields.profile.disabled ? undefined : sketchPoint(event);
    coordinateLabel.textContent = cursor ? `X ${cursor.x} mm · Z ${cursor.z} mm` : 'X — · Z —';
    draw();
  });
  const endDrag = () => {
    drag = undefined;
    canvas.removeAttribute('data-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('pointerleave', () => {
    cursor = undefined;
    coordinateLabel.textContent = 'X — · Z —';
    draw();
  });
  canvas.addEventListener('click', event => {
    if (fields.profile.disabled || tool.value === 'pan') return;
    const point = sketchPoint(event);
    if (!point) return;
    const points = readProfile(fields.profile.value);
    const last = points.at(-1);
    if (!last && point.z !== 0) {
      showStatus('Chọn điểm đầu tại trục Z0.', true);
      return;
    }
    let additions = [point];
    try {
      if (tool.value === 'arc' && last) {
        if (!arcMiddle) {
          arcMiddle = point;
          showStatus('Đã đặt điểm giữa cung. Chọn điểm cuối.');
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
      replaceProfile([...points, ...additions].map(({ x, z }) => `${x} ${z}`).join('\n'));
    } catch (error) {
      arcMiddle = undefined;
      showStatus(error.message, true);
      draw();
    }
  });

  for (const id of ['turningImageWidth', 'turningImageZ', 'turningImageR', 'turningImageOpacity']) {
    byId(id).addEventListener('input', draw);
  }
  byId('turningImage').addEventListener('change', async event => {
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
      referenceImage?.close();
      referenceImage = image;
      byId('turningImageWidth').value = dimensions().length;
      importStatus.textContent = 'Đã đặt ảnh nền. Hiệu chỉnh bề rộng và vị trí trước khi vẽ.';
      draw();
    } catch (error) {
      if (revision === imageRevision) importStatus.textContent = error.message;
    }
  });
  byId('turningRemoveImage').addEventListener('click', () => {
    imageRevision++;
    referenceImage?.close();
    referenceImage = undefined;
    byId('turningImage').value = '';
    importStatus.textContent = '';
    draw();
  });
  byId('turningImportMesh').addEventListener('click', async () => {
    const revision = ++meshRevision;
    const file = byId('turningMesh').files[0];
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
      if (diameter > 10000 || length > 10000) throw new Error('Kích thước STL vượt phạm vi phôi 10000 mm.');
      fields.diameter.value = Math.max(dimensions().diameter, diameter);
      stockLength.value = Math.max(dimensions().length, length);
      if (!profileOperations.includes(fields.operation.value)) fields.operation.value = 'profile';
      showProfile.checked = true;
      updateOperation();
      replaceProfile(points.map(({ x, z }) => `${x} ${z}`).join('\n'));
      importStatus.textContent = `Đã lấy ${points.length} điểm biên dạng theo trục ${axis}. Kiểm tra hình chiếu và kích thước trước khi sinh mã.`;
    } catch (error) {
      if (revision === meshRevision) importStatus.textContent = error.message;
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    reset();
    try {
      const settings = Object.fromEntries(new FormData(form));
      for (const key of ['diameter', 'length', 'tool', 'offset', 'rpm', 'feed', 'stepDepth', 'allowance', 'cutZ', 'rootDiameter', 'drillDepth', 'peck', 'threadEndZ', 'pitch']) settings[key] = Number(settings[key]);
      code.value = generateTurningProgram(settings);
      moves = readTurningMoves(code.value);
      slider.max = moves.length;
      slider.value = moves.length;
      slider.disabled = play.disabled = download.disabled = false;
      status.textContent = `Đã tạo mã thử nghiệm và đọc ${moves.length} đoạn đường chạy từ mã NC.`;
      draw();
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
  updateOperation();
}
