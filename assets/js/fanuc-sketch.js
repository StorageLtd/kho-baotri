const fullCircle = Math.PI * 2;
const round = value => Math.round(value * 10000) / 10000 || 0;

export function arcPoints(start, middle, end) {
  const bx = (middle.x - start.x) / 2;
  const by = middle.z - start.z;
  const cx = (end.x - start.x) / 2;
  const cy = end.z - start.z;
  const determinant = 2 * (bx * cy - by * cx);
  if (Math.abs(determinant) < 1e-8) throw new Error('Ba điểm tạo cung phải khác nhau và không thẳng hàng.');

  const u = ((bx * bx + by * by) * cy - (cx * cx + cy * cy) * by) / determinant;
  const v = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / determinant;
  const radius = Math.hypot(u, v);
  const angle = (x, y) => Math.atan2(y - v, x - u);
  const first = angle(0, 0);
  const positive = value => (value + fullCircle) % fullCircle;
  const middleAngle = positive(angle(bx, by) - first);
  const endAngle = positive(angle(cx, cy) - first);
  const sweep = middleAngle < endAngle ? endAngle : endAngle - fullCircle;
  const chordAngle = Math.min(Math.PI / 12, 2 * Math.acos(Math.max(-1, 1 - 0.02 / radius)));
  const steps = Math.ceil(Math.abs(sweep) / chordAngle);
  if (steps > 120) throw new Error('Cung quá dài cho dung sai 0,02 mm. Hãy chia thành các cung ngắn hơn.');
  const points = Array.from({ length: steps }, (_, i) => {
    const t = first + sweep * (i + 1) / steps;
    return { x: round(start.x + 2 * (u + radius * Math.cos(t))), z: round(start.z + v + radius * Math.sin(t)) };
  });
  points[points.length - 1] = end;
  return points;
}

function stlVertices(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength >= 84) {
    const count = view.getUint32(80, true);
    if (84 + count * 50 === view.byteLength) {
      return Array.from({ length: count * 3 }, (_, i) => {
        const offset = 96 + Math.floor(i / 3) * 50 + i % 3 * 12;
        return [0, 4, 8].map(k => view.getFloat32(offset + k, true));
      });
    }
  }
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
  const vertex = new RegExp(`^\\s*vertex\\s+(${number})\\s+(${number})\\s+(${number})\\s*$`, 'gim');
  const stl = new TextDecoder().decode(buffer);
  if (!/^\s*solid\b/i.test(stl) || !/\bendsolid\b/i.test(stl)) throw new Error('Tệp STL không hợp lệ.');
  return [...stl.matchAll(vertex)].map(match => match.slice(1).map(Number));
}

export function profileFromStl(buffer, axis = 'Z') {
  if (buffer.byteLength > 12 * 1024 * 1024) throw new Error('STL vượt quá 12 MB.');
  const vertices = stlVertices(buffer);
  if (vertices.length < 12 || vertices.length % 3 || vertices.some(point => point.some(n => !Number.isFinite(n)))) {
    throw new Error('STL không có tập tam giác hợp lệ.');
  }
  const axial = 'XYZ'.indexOf(axis);
  if (axial < 0) throw new Error('Chọn trục X, Y hoặc Z.');
  const [u, v] = [0, 1, 2].filter(index => index !== axial);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of vertices) {
    point.forEach((coordinate, axis) => {
      min[axis] = Math.min(min[axis], coordinate);
      max[axis] = Math.max(max[axis], coordinate);
    });
  }
  const centerU = (min[u] + max[u]) / 2;
  const centerV = (min[v] + max[v]) / 2;
  const layers = new Map();
  const samples = vertices.map(point => {
    const z = round(point[axial] - max[axial]);
    const x = point[u] - centerU;
    const y = point[v] - centerV;
    if (!layers.has(z)) layers.set(z, { z, rings: [] });
    const layer = layers.get(z);
    const radius = Math.hypot(x, y);
    let ring = layer.rings.find(entry => Math.abs(entry.radius - radius) <= Math.max(0.005, radius * 0.001));
    if (!ring) {
      if (layer.rings.length >= 3) throw new Error('STL không phù hợp với lưới chi tiết tròn xoay theo vòng.');
      ring = { z, radius, angles: new Set() };
      layer.rings.push(ring);
    }
    ring.angles.add(Math.round(10000 * Math.atan2(y, x)) / 10000);
    return ring;
  });
  const sorted = [...layers.values()].sort((a, b) => b.z - a.z);
  if (sorted.length < 2 || sorted.length > 200) throw new Error('STL cần từ 2 đến 200 cao độ dọc trục.');
  const bands = new Map();
  const unsupported = () => new Error('STL cần các vòng tròn đồng tâm liên tiếp. Mô hình rỗng, có rãnh dọc hoặc lưới không theo vòng cần dựng lại biên dạng.');
  for (const { rings } of sorted) {
    for (const ring of rings) {
      if (ring.radius <= 0.005) continue;
      const angles = [...ring.angles].sort((a, b) => a - b);
      if (angles.length < 8 || angles.some((angle, i) => (angles[i + 1] ?? angles[0] + fullCircle) - angle > Math.PI / 2)) throw unsupported();
    }
  }
  for (let i = 0; i < samples.length; i += 3) {
    const facet = samples.slice(i, i + 3).sort((a, b) => b.z - a.z);
    const top = facet[0];
    const bottom = facet[2];
    if (top.z === bottom.z) continue;
    if (facet[1] !== top && facet[1] !== bottom) throw unsupported();
    const band = bands.get(top.z);
    if (band && (band.top !== top || band.bottom !== bottom)) throw unsupported();
    bands.set(top.z, { top, bottom });
  }
  const profile = [];
  const append = ring => {
    const point = { x: round(2 * ring.radius), z: ring.z };
    const last = profile.at(-1);
    if (!last || point.x !== last.x || point.z !== last.z) profile.push(point);
  };
  for (let i = 0; i < sorted.length - 1; i++) {
    const band = bands.get(sorted[i].z);
    if (!band || band.bottom.z !== sorted[i + 1].z) throw unsupported();
    append(band.top);
    append(band.bottom);
  }
  if (profile.length > 200) throw new Error('Biên dạng STL vượt quá 200 điểm.');
  return profile;
}

function largestSilhouette({ data, width, height }, threshold) {
  const corners = [0, width - 1, (height - 1) * width, width * height - 1].map(i => i * 4);
  const transparent = corners.every(i => data[i + 3] < 32);
  const background = [0, 1, 2].map(channel => {
    const values = corners.map(i => data[i + channel]).sort((a, b) => a - b);
    return (values[1] + values[2]) / 2;
  });
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const k = i * 4;
    const contrast = transparent ? data[k + 3] : Math.max(
      Math.abs(data[k] - background[0]), Math.abs(data[k + 1] - background[1]),
      Math.abs(data[k + 2] - background[2]),
    ) * data[k + 3] / 255;
    mask[i] = Number(contrast >= threshold);
  }
  const queue = new Int32Array(mask.length);
  let largest = new Int32Array();
  const enqueue = (index, tail) => {
    if (mask[index] !== 1) return tail;
    mask[index] = 0;
    queue[tail] = index;
    return tail + 1;
  };
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    let tail = enqueue(i, 0);
    for (let head = 0; head < tail; head++) {
      const index = queue[head];
      if (index % width) tail = enqueue(index - 1, tail);
      if (index % width < width - 1) tail = enqueue(index + 1, tail);
      if (index >= width) tail = enqueue(index - width, tail);
      if (index < (height - 1) * width) tail = enqueue(index + width, tail);
    }
    if (tail > largest.length) largest = queue.slice(0, tail);
  }
  return largest;
}

function simplifySilhouette(points, tolerance) {
  const keep = new Set([0, points.length - 1]);
  const spans = [[0, points.length - 1]];
  while (spans.length) {
    const [first, last] = spans.pop();
    const a = points[first];
    const b = points[last];
    const dz = b.z - a.z;
    const dr = (b.x - a.x) / 2;
    const span = Math.hypot(dz, dr);
    let farthest = tolerance;
    let split;
    for (let i = first + 1; i < last; i++) {
      const distance = Math.abs(dz * (points[i].x - a.x) / 2 - dr * (points[i].z - a.z)) / span;
      if (distance > farthest) {
        farthest = distance;
        split = i;
      }
    }
    if (split !== undefined) {
      keep.add(split);
      spans.push([first, split], [split, last]);
    }
  }
  return points.filter((_, index) => keep.has(index));
}

export function profileFromImage(image, { known, measure, face, threshold }) {
  if (!Number.isFinite(known) || known < 0.1 || known > 10000) {
    throw new Error('Nhập một kích thước thực trong khoảng 0,1–10000 mm.');
  }
  const { width, height } = image;
  const component = largestSilhouette(image, threshold);
  const top = new Int32Array(width).fill(height);
  const bottom = new Int32Array(width).fill(-1);
  let first = width;
  let last = -1;
  for (const index of component) {
    const x = index % width;
    const y = Math.floor(index / width);
    first = Math.min(first, x);
    last = Math.max(last, x);
    top[x] = Math.min(top[x], y);
    bottom[x] = Math.max(bottom[x], y);
  }
  if (last - first < 16) throw new Error('Không tìm thấy đường bao liền mạch đủ rõ. Hãy thử ảnh nét hơn hoặc đổi ngưỡng.');
  const columns = Array.from({ length: last - first + 1 }, (_, i) => {
    const x = first + i;
    return { x, thickness: bottom[x] - top[x], center: (top[x] + bottom[x]) / 2 };
  });
  const centers = columns.map(column => column.center).sort((a, b) => a - b);
  const center = centers[Math.floor(centers.length / 2)];
  const maxThickness = Math.max(...columns.map(column => column.thickness));
  const symmetryTolerance = Math.max(2, maxThickness * 0.03);
  if (maxThickness < 8 || columns.some(column => column.thickness < 0) ||
      columns.filter(column => Math.abs(column.center - center) > symmetryTolerance).length > Math.max(2, columns.length * 0.02)) {
    throw new Error('Đường bao chưa đối xứng quanh trục ngang. Dùng hình chiếu cạnh, cắt bỏ chữ và đường kích thước hoặc đổi ngưỡng.');
  }
  const mmPerPixel = known / (measure === 'diameter' ? maxThickness : last - first);
  if ((last - first) * mmPerPixel > 10000 || maxThickness * mmPerPixel > 10000) {
    throw new Error('Kích thước suy ra vượt 10000 mm. Kiểm tra thông số chuẩn.');
  }
  if (face === 'right') columns.reverse();
  const z0 = columns[0].x;
  const geometry = columns.map(column => ({
    x: column.thickness * mmPerPixel,
    z: -Math.abs(column.x - z0) * mmPerPixel,
  }));
  const tolerance = Math.max(0.002, mmPerPixel * 1.25);
  const simplified = simplifySilhouette(geometry, tolerance);
  if (simplified.length > 200) throw new Error('Đường bao quá nhiều chi tiết. Dùng hình chiếu sạch hơn hoặc nhập STL.');
  return {
    points: simplified.map(({ x, z }) => ({ x: round(x), z: round(z) })),
    diameter: round(maxThickness * mmPerPixel),
    length: round((last - first) * mmPerPixel),
    mmPerPixel,
    bounds: { first, last, center },
  };
}

export function findSketchSnap(point, points, tolerance, verticesOnly = false) {
  let nearest;
  let best = tolerance;
  const consider = (x, z, label, index) => {
    const distance = Math.hypot((x - point.x) / 2, z - point.z);
    if (distance > best || distance === best && nearest) return;
    best = distance;
    nearest = { x, z, label, index };
  };
  for (const [index, vertex] of points.entries()) consider(vertex.x, vertex.z, 'Điểm đầu mút', index);
  if (verticesOnly) return nearest;
  for (const [index, vertex] of points.entries()) {
    const next = points[index + 1];
    if (next) consider((vertex.x + next.x) / 2, (vertex.z + next.z) / 2, 'Trung điểm');
  }
  consider(0, 0, 'Gốc X0/Z0');
  return nearest;
}
