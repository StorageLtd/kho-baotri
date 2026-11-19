const fullCircle = Math.PI * 2;
const round = value => Math.round(value * 10000) / 10000;

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
