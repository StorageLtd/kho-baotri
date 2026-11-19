import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sketchSource = await readFile(new URL('../assets/js/fanuc-sketch.js', import.meta.url), 'utf8');
const sketchUrl = asModule(sketchSource);
const source = await readFile(new URL('../assets/js/fanuc-turning.js', import.meta.url), 'utf8');
const { generateTurningProgram, readTurningMoves } = await import(asModule(source.replace(/\.\/fanuc-sketch\.js\?v=\d+/, sketchUrl)));
const { arcPoints, profileFromStl, profileFromImage, findSketchSnap, nearestSketchEdge, profileFromDxf } = await import(sketchUrl);

const setup = {
  operation: 'profile', units: 'mm', diameter: 60, length: 80,
  tool: 2, offset: 7, rpm: 600, feed: 0.254, profile: '40 0\n40 -20\n50 -30\n50 -60',
};

test('G20 converts coordinates and feed while preserving the simulated path in mm', () => {
  const metric = generateTurningProgram(setup);
  const imperial = generateTurningProgram({ ...setup, units: 'inch' });
  assert.match(metric, /G21\nG54\nT0207\nG97 S600 M03/);
  assert.match(metric, /G01 X40\.000 Z0\.000 F0\.2540/);
  assert.match(imperial, /G20\n/);
  assert.match(imperial, /G01 X1\.57480 Z0\.00000 F0\.010000/);
  const metricMoves = readTurningMoves(metric);
  const imperialMoves = readTurningMoves(imperial);
  assert.equal(metricMoves.length, 7);
  assert.equal(imperialMoves.length, metricMoves.length);
  for (const [index, move] of imperialMoves.entries()) {
    const expected = metricMoves[index];
    assert.equal(move.mode, expected.mode);
    assert.ok(Math.abs(move.to.x - expected.to.x) < 0.00013);
    assert.ok(Math.abs(move.to.z - expected.to.z) < 0.00013);
    assert.match(imperial.split('\n')[move.line - 1], /^G0[01]/);
  }
});

test('facing ignores profile text and feeds across Z0', () => {
  const code = generateTurningProgram({ ...setup, operation: 'face', profile: 'invalid' });
  assert.match(code, /PREVIEW ONLY - UNVERIFIED ON MACHINE/);
  const moves = readTurningMoves(code);
  assert.deepEqual(moves.map(({ mode }) => mode), ['rapid', 'feed', 'rapid', 'rapid']);
  assert.deepEqual(moves[1].from, { x: 66, z: 0 });
  assert.deepEqual(moves[1].to, { x: 0, z: 0 });
});

test('rejects malformed, out-of-stock, reversed and collapsed profiles', () => {
  for (const profile of ['40,0\n40 -20', '40 0\n61 -20', '40 0\n40 -81', '40 0\n40 -20\n42 -10', '40 0\n40 -0.00001\n40 -1']) {
    assert.throws(() => generateTurningProgram({ ...setup, profile }));
  }
  assert.throws(() => generateTurningProgram({ ...setup, tool: 0 }));
  assert.throws(() => generateTurningProgram({ ...setup, feed: Infinity }));
});

test('roughing limits each layer to the target profile plus radial allowance', () => {
  const moves = readTurningMoves(generateTurningProgram({ ...setup, operation: 'rough', stepDepth: 4, allowance: 1 }));
  const cuts = moves.filter(move => move.mode === 'feed');
  assert.deepEqual(cuts.map(move => move.to), [{ x: 52, z: -60 }, { x: 44, z: -22 }, { x: 42, z: -20 }]);
  assert.ok(cuts.every(move => move.from.z === 3 && move.from.x === move.to.x));
  assert.throws(() => generateTurningProgram({ ...setup, operation: 'rough', stepDepth: 2, allowance: 1, profile: '50 0\n40 -10' }), /tăng dần/);
});

test('grooving and parting plunge at fixed Z and peck drilling retracts between cuts', () => {
  const settings = { ...setup, cutZ: -25, rootDiameter: 48, stepDepth: 2, drillDepth: 10, peck: 4 };
  const movesFor = operation => readTurningMoves(generateTurningProgram({ ...settings, operation }));
  const feedsFor = operation => movesFor(operation).filter(move => move.mode === 'feed').map(move => move.to);
  assert.deepEqual(feedsFor('groove'), [56, 52, 48].map(x => ({ x, z: -25 })));
  assert.deepEqual(feedsFor('part').at(-1), { x: 0, z: -25 });
  assert.deepEqual(feedsFor('drill'), [-4, -8, -10].map(z => ({ x: 0, z })));
  const drill = movesFor('drill');
  for (const [i, move] of drill.entries()) {
    if (move.mode === 'feed') assert.deepEqual(drill[i + 1].to, { x: 0, z: 3 });
  }
});

test('a sketch arc uses physical radius and preserves the exact end point', () => {
  const start = { x: 10, z: 0 };
  const middle = { x: 20, z: -5 };
  const end = { x: 10, z: -10 };
  const points = arcPoints(start, middle, end);
  assert.deepEqual(points.at(-1), end);
  assert.ok(points.every(point => Math.abs(Math.hypot((point.x - 10) / 2, point.z + 5) - 5) < 0.0001));
  assert.throws(() => arcPoints(start, { x: 10, z: -5 }, end), /thẳng hàng/);
});

function turnedMesh(axis = 'Z') {
  const ring = (radius, z, i) => {
    const angle = i * Math.PI / 8;
    const x = 2 + radius * Math.cos(angle);
    const y = 3 + radius * Math.sin(angle);
    return axis === 'X' ? [z, x, y] : [x, y, z];
  };
  const vertices = [];
  for (const [topR, topZ, bottomR, bottomZ] of [[10, 20, 10, 10], [15, 10, 15, 0]]) {
    for (let i = 0; i < 16; i++) {
      const a = ring(topR, topZ, i), b = ring(topR, topZ, i + 1);
      const c = ring(bottomR, bottomZ, i), d = ring(bottomR, bottomZ, i + 1);
      vertices.push(a, b, c, b, c, d);
    }
  }
  return vertices;
}

test('STL import reads text and binary, aligns the selected axis and preserves a shoulder', () => {
  const vertices = turnedMesh('X');
  const binary = new DataView(new ArrayBuffer(84 + vertices.length / 3 * 50));
  binary.setUint32(80, vertices.length / 3, true);
  vertices.forEach((vertex, i) => vertex.forEach((n, axis) => binary.setFloat32(96 + Math.floor(i / 3) * 50 + i % 3 * 12 + axis * 4, n, true)));
  const ascii = new TextEncoder().encode('solid turned\n' + turnedMesh().map((vertex, i) => {
    const begin = i % 3 === 0 ? 'facet normal 0 0 0\nouter loop\n' : '';
    const end = i % 3 === 2 ? '\nendloop\nendfacet' : '';
    return begin + 'vertex ' + vertex.join(' ') + end;
  }).join('\n') + '\nendsolid turned');
  const expected = [{ x: 20, z: 0 }, { x: 20, z: -10 }, { x: 30, z: -10 }, { x: 30, z: -20 }];
  assert.deepEqual(profileFromStl(binary.buffer, 'X'), expected);
  assert.deepEqual(profileFromStl(ascii.buffer), expected);
  assert.throws(() => profileFromStl(binary.buffer, 'Z'), Error);
});

test('straight threading emits and simulates G32 with pitch converted to inches', () => {
  const code = generateTurningProgram({ ...setup, operation: 'thread', units: 'inch', threadEndZ: -20, pitch: 2.54, stepDepth: 0.5, rootDiameter: 58 });
  assert.match(code, /G32 X2\.32283 Z-0\.78740 F0\.100000/);
  const passes = readTurningMoves(code).filter(move => move.mode === 'thread');
  assert.equal(passes.length, 2);
  assert.ok(Math.abs(passes[0].from.z - 5.08) < 0.0002);
  assert.ok(Math.abs(passes[1].to.x - 58) < 0.0002);
});

function drawing(asymmetric = false) {
  const width = 160;
  const height = 90;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let x = 20; x <= 140; x++) {
    const radius = x <= 80 ? 20 : 10;
    const center = asymmetric && x > 80 ? 53 : 45;
    for (let y = center - radius; y <= center + radius; y++) {
      if (!asymmetric && x !== 20 && x !== 140 && y !== center - radius && y !== center + radius && x !== 80) continue;
      const i = (y * width + x) * 4;
      data.fill(0, i, i + 3);
    }
  }
  return { width, height, data };
}

test('image tracing needs a real dimension and reverses the designated face', () => {
  const image = drawing();
  const settings = { known: 60, measure: 'length', face: 'right', threshold: 40 };
  const profile = profileFromImage(image, settings);
  assert.equal(profile.length, 60);
  assert.equal(profile.diameter, 20);
  assert.deepEqual(profile.points[0], { x: 10, z: 0 });
  assert.deepEqual(profile.points.at(-1), { x: 20, z: -60 });
  const reversed = profileFromImage(image, { ...settings, known: 20, measure: 'diameter', face: 'left' });
  assert.deepEqual(reversed.points[0], { x: 20, z: 0 });
  assert.equal(reversed.length, 60);
  const code = generateTurningProgram({ ...setup, profile: profile.points.map(p => `${p.x} ${p.z}`).join('\n') });
  assert.match(code, /G01 X20\.000 Z-60\.000/);
  assert.throws(() => profileFromImage(image, { ...settings, known: NaN }), /kích thước thực/);
  assert.throws(() => profileFromImage(drawing(true), settings), /đối xứng/);
});

test('object snap finds endpoints and midpoints in the physical radius plane', () => {
  const points = [{ x: 20, z: 0 }, { x: 20, z: -10 }];
  assert.deepEqual(findSketchSnap({ x: 21, z: -0.1 }, points, 0.6, true), { x: 20, z: 0, label: 'Điểm đầu mút', index: 0 });
  assert.equal(findSketchSnap({ x: 20, z: -4.9 }, points, 0.6)?.label, 'Trung điểm');
  assert.equal(findSketchSnap({ x: 20, z: -4.9 }, points, 0.6, true), undefined);
});

test('a removed edge is ignored by picking and blocks NC until the profile is joined', () => {
  const points = [{ x: 40, z: 0 }, { x: 40, z: -20, breakBefore: true }, { x: 50, z: -30 }];
  assert.equal(nearestSketchEdge({ x: 40, z: -10 }, points, 1), undefined);
  assert.equal(nearestSketchEdge({ x: 45, z: -25 }, points, 1), 2);
  assert.throws(() => generateTurningProgram({ ...setup, profile: '40 0\n| 40 -20\n50 -30' }), /khoảng hở/);
});

test('DXF ASCII orders a connected outline and converts model units and center offset', () => {
  const chain = [
    '0','SECTION','2','HEADER','9','$INSUNITS','70','1','0','ENDSEC',
    '0','SECTION','2','ENTITIES',
    '0','LINE','10','0','20','1.5','11','1','21','1.5',
    '0','LINE','10','1','20','1.5','11','2','21','1.4',
    '0','ENDSEC','0','EOF',
  ].join('\n');
  const settings = { units: 'auto', center: 1, face: 'right' };
  assert.deepEqual(profileFromDxf(chain, settings), [{ x: 20.32, z: 0 }, { x: 25.4, z: -25.4 }, { x: 25.4, z: -50.8 }]);
  assert.throws(() => profileFromDxf(chain.replace('11\n1\n21', '11\n0.5\n21'), settings), /liên tục/);
  const polyline = '0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n70\n0\n10\n0\n20\n5\n10\n10\n20\n4\n0\nENDSEC\n0\nEOF';
  assert.deepEqual(profileFromDxf(polyline, { units: 'mm', center: 0, face: 'right' }), [{ x: 8, z: 0 }, { x: 10, z: -10 }]);
});

test('DXF expands a connected arc without losing its endpoints', () => {
  const dxf = '0\nSECTION\n2\nENTITIES\n0\nARC\n10\n10\n20\n10\n40\n10\n50\n180\n51\n270\n0\nENDSEC\n0\nEOF';
  const points = profileFromDxf(dxf, { units: 'mm', center: 0, face: 'right' });
  assert.deepEqual(points[0], { x: 0, z: 0 });
  assert.deepEqual(points.at(-1), { x: 20, z: -10 });
  assert.ok(points.length > 5);
  assert.ok(points.every(point => Math.abs(Math.hypot(point.z, point.x / 2 - 10) - 10) < 0.0001));
});
