const clearance = 3;
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
  if (!scale || !['profile', 'face'].includes(operation)) throw new Error('Chọn đơn vị và nguyên công hợp lệ.');
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
  if (operation === 'face') {
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
    lines.push(rapid({ x: points[0].x, z: clearance }), cut(points[0]) + feedWord,
      ...points.slice(1).map(cut), rapid({ x: outside, z: last.z }), rapid(start));
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
      if (value === 0 || value === 1) mode = value === 0 ? 'rapid' : 'feed';
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
  let moves = [];
  let timer;
  let plot;

  function dimensions() {
    const valid = value => Number.isFinite(value) && value >= 0.1 && value <= 10000;
    return {
      diameter: valid(fields.diameter.valueAsNumber) ? fields.diameter.valueAsNumber : 60,
      length: valid(fields.length.valueAsNumber) ? fields.length.valueAsNumber : 80,
    };
  }

  function draw() {
    const { diameter, length } = dimensions();
    const left = 44, top = 20, right = canvas.width - 44, bottom = canvas.height - 38;
    const spanZ = length + 2 * clearance;
    const spanR = diameter / 2 + 2 * clearance;
    const scale = Math.min((right - left) / spanZ, (bottom - top) / spanR);
    const zOrigin = left + (right - left - spanZ * scale) / 2 + (length + clearance) * scale;
    plot = { scale, zOrigin, bottom };
    const at = ({ x, z }) => [zOrigin + z * scale, bottom - x * scale / 2];
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
    const [stockLeft, stockTop] = at({ x: diameter, z: -length });
    ctx.fillStyle = '#e1e7ef';
    ctx.fillRect(stockLeft, stockTop, length * scale, bottom - stockTop);
    ctx.fillStyle = '#475569';
    ctx.fillRect(left, bottom, right - left, 1);
    ctx.fillRect(zOrigin, top, 1, bottom - top);
    ctx.font = '14px system-ui';
    ctx.fillText('X/2 (mm)', Math.min(zOrigin + 6, right - 64), top + 12);
    ctx.fillText('Z0', zOrigin - 8, bottom + 21);
    ctx.fillText(`−${length}`, stockLeft - 10, bottom + 21);
    ctx.fillText('Z (mm)', right - 27, bottom + 34);

    if (fields.operation.value === 'profile') {
      let points = [];
      try {
        points = readProfile(fields.profile.value).filter(point => point.x >= 0 && point.x <= diameter && point.z >= -length && point.z <= 0);
      } catch {
        // Validation on submit reports incomplete or malformed coordinate rows.
      }
      drawLine(points, '#177044');
      ctx.fillStyle = '#177044';
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(...at(point), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const step = Number(slider.value);
    moves.slice(0, step).forEach(move => {
      const rapid = move.mode === 'rapid';
      drawLine([move.from, move.to], rapid ? '#ac510c' : '#1457bd', rapid ? [6, 4] : []);
    });
    if (moves.length) {
      const position = step ? moves[step - 1].to : moves[0].from;
      ctx.fillStyle = '#14243b';
      ctx.beginPath();
      ctx.arc(...at(position), 4, 0, Math.PI * 2);
      ctx.fill();
    }
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

  form.addEventListener('input', reset);
  fields.operation.addEventListener('change', () => {
    const disabled = fields.operation.value === 'face';
    fields.profile.disabled = document.querySelector('#turningClear').disabled = disabled;
    reset();
  });
  document.querySelector('#turningClear').addEventListener('click', () => {
    fields.profile.value = '';
    reset();
    fields.profile.focus();
  });
  canvas.addEventListener('click', event => {
    if (fields.profile.disabled) return;
    const bounds = canvas.getBoundingClientRect();
    const displayX = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const displayY = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const { diameter, length } = dimensions();
    const z = (displayX - plot.zOrigin) / plot.scale;
    const x = (plot.bottom - displayY) * 2 / plot.scale;
    if (z < -length || z > 4 / plot.scale || x < 0 || x > diameter) return;
    const snappedZ = Math.abs(z) <= 4 / plot.scale ? 0 : Number(z.toFixed(3));
    const row = `${Number(x.toFixed(3))} ${snappedZ}`;
    fields.profile.value = [fields.profile.value.trim(), row].filter(Boolean).join('\n');
    reset();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    reset();
    try {
      const settings = Object.fromEntries(new FormData(form));
      for (const key of ['diameter', 'length', 'tool', 'offset', 'rpm', 'feed']) settings[key] = Number(settings[key]);
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
  draw();
}
