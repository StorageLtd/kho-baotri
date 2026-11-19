import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sketchSource = await readFile(new URL('../assets/js/fanuc-sketch.js', import.meta.url), 'utf8');
const sketchUrl = asModule(sketchSource);
const source = await readFile(new URL('../assets/js/fanuc-turning.js', import.meta.url), 'utf8');
const { generateTurningProgram, generateTurningSequence, readTurningMoves, resizeTurningEndpoint, sketchEndpointAtLength } = await import(asModule(source.replace(/\.\/fanuc-sketch\.js\?v=\d+/, sketchUrl)));
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
  const moves = readTurningMoves(generateTurningProgram({ ...setup, operation: 'roughLinear', stepDepth: 4, allowance: 1 }));
  const cuts = moves.filter(move => move.mode === 'feed');
  assert.deepEqual(cuts.map(move => move.to), [{ x: 52, z: -60 }, { x: 44, z: -22 }, { x: 42, z: -20 }]);
  assert.ok(cuts.every(move => move.from.z === 3 && move.from.x === move.to.x));
  assert.throws(() => generateTurningProgram({ ...setup, operation: 'roughLinear', stepDepth: 2, allowance: 1, profile: '50 0\n40 -10' }), /tăng dần/);
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

test('G71 two-block Type I generates P/Q contour and simulates the cycle block', () => {
  const code = generateTurningProgram({ ...setup, operation: 'rough', stepDepth: 4, allowance: 1, cycleRetract: 0.5, finishCycle: true });
  assert.match(code, /G71 U4\.000 R0\.500\nG71 P100 Q140 U2\.000 W0\.000 F0\.2540\nN100 G00 X40\.000/);
  assert.match(code, /N140 G01 X50\.000 Z-60\.000 F0\.2540\nG70 P100 Q140/);
  const cycleLine = code.split('\n').findIndex(line => line.startsWith('G71 P')) + 1;
  const cuts = readTurningMoves(code).filter(move => move.mode === 'feed' && move.line === cycleLine);
  assert.equal(cuts.length, 3);
  assert.equal(cuts[0].to.x, 52);
  assert.ok(Math.abs(cuts[1].to.z + 22) < 1e-8);
  assert.equal(cuts[2].to.x, 42);
  assert.ok(readTurningMoves(code).some(move => move.mode === 'feed' && move.to.x === 50 && move.to.z === -60));
});

test('G72 faces planar stock from positive Z and converts depth and allowance for G20', () => {
  const code = generateTurningProgram({
    ...setup, units: 'inch', operation: 'roughFace', faceStock: 5.08, faceStep: 2.54, faceAllowance: 0.254, cycleRetract: 0.254,
  });
  assert.match(code, /G72 W0\.10000 R0\.01000\nG72 P100 Q110 U0\.00000 W0\.01000/);
  assert.match(code, /N100 G00 Z0\.00000\nN110 G01 X0\.00000/);
  const cuts = readTurningMoves(code).filter(move => move.mode === 'feed');
  assert.deepEqual(cuts.map(move => [move.to.x, +move.to.z.toFixed(3)]), [[0, 2.54], [0, 0.254]]);
});

test('PL800GB requires confirmed distinct auxiliary M codes and simulates head events', () => {
  const params = {
    ...setup, machine: 'pl800gb', controller: '0i-TF Plus', operation: 'grind',
    grindDiameter: 59.8, grindStart: -2, grindEnd: -30, stepDepth: 0.06, grindFeed: 35,
    grindOn: 'm151', grindOff: '152', grindConfirmed: true,
  };
  assert.throws(() => generateTurningProgram({ ...params, grindConfirmed: false }), /xác nhận/);
  assert.throws(() => generateTurningProgram({ ...params, grindOff: 'M151' }), /khác nhau/);
  assert.throws(() => generateTurningProgram({ ...params, machine: 'fanuc' }), /PL800GB/);
  const code = generateTurningProgram(params);
  assert.match(code, /SMEC PL800GB 0I-TF PLUS/);
  assert.match(code, /G98 G21/);
  assert.match(code, /M151 \(GRIND HEAD ON\)[\s\S]*G01 X59\.800 Z-30\.000[\s\S]*M152 \(GRIND HEAD OFF\)/);
  const events = readTurningMoves(code).filter(move => move.mode === 'event');
  assert.deepEqual(events.map(event => code.split('\n')[event.line - 1]), ['M151 (GRIND HEAD ON)', 'M152 (GRIND HEAD OFF)']);
});

test('editing a dimension moves the snapped endpoint and enforces stock and point order', () => {
  const contour = [{ x: 40, z: 0 }, { x: 40, z: -20 }, { x: 50, z: -30 }];
  assert.deepEqual(resizeTurningEndpoint(contour, 1, contour[0], 25, 'axial', setup), { x: 40, z: -25 });
  assert.deepEqual(resizeTurningEndpoint(contour, 1, { x: 0, z: -20 }, 48, 'diameter', setup), { x: 48, z: -20 });
  assert.deepEqual(resizeTurningEndpoint(contour, 1, { x: 20, z: -20 }, 13, 'radial', setup), { x: 46, z: -20 });
  assert.throws(() => resizeTurningEndpoint(contour, 1, contour[0], 31, 'axial', setup), /đảo thứ tự/);
  assert.throws(() => resizeTurningEndpoint(contour, 1, contour[0], 70, 'diameter', setup), /ngoài phôi/);
});

test('G74 and G75 post the correct integer P/Q words and replay their pecks', () => {
  const common = { ...setup, peckIncrement: 'standard', cycleRetract: 0.5 };
  const drill = generateTurningProgram({ ...common, operation: 'drillCycle', drillDepth: 10, peck: 4 });
  assert.match(drill, /G74 R0\.500\nG74 Z-10\.000 Q4000/);
  assert.deepEqual(readTurningMoves(drill).filter(move => move.mode === 'feed').map(move => [move.to.x, move.to.z]),
    [[0, -1], [0, -5], [0, -9], [0, -10]]);
  const groove = generateTurningProgram({ ...common, operation: 'grooveCycle', cutZ: -25, rootDiameter: 48, stepDepth: 2 });
  assert.match(groove, /G75 R0\.500\nG75 X48\.000 P2000/);
  assert.equal(readTurningMoves(groove).filter(move => move.mode === 'feed').at(-1).to.x, 48);
  assert.throws(() => generateTurningProgram({ ...common, operation: 'drillCycle', drillDepth: 10, peck: 1.2345 }), /P\/Q Input Increment/);
  const inch = generateTurningProgram({ ...common, operation: 'drillCycle', units: 'inch', drillDepth: 10, peck: 2.54 });
  assert.match(inch, /G74 Z-0\.39370 Q1000/);
});

test('tool nose compensation uses CNC offset, linear entry and cancellation and floods only when selected', () => {
  const code = generateTurningProgram({ ...setup, controller: '0i-TF Plus', coolant: 'flood', compensation: 'G42', compLead: 3 });
  assert.match(code, /FANUC LATHE 0I-TF PLUS/);
  assert.match(code, /M8 \(COOLANT ON\)[\s\S]*G42 G01 X40\.000 Z0\.000[\s\S]*G40 G01 X66\.000 Z-60\.000[\s\S]*M9 \(COOLANT OFF\)\nM05/);
  const moves = readTurningMoves(code);
  assert.equal(moves.filter(move => move.mode === 'event').length, 2);
  assert.equal(moves.find(move => code.split('\n')[move.line - 1].startsWith('G42')).mode, 'feed');
  assert.throws(() => generateTurningProgram({ ...setup, operation: 'face', compensation: 'G41' }), /Profile Finishing/);
});

test('plunge grinding holds Z and records G04 spark-out as an event, not an X move', () => {
  const code = generateTurningProgram({
    ...setup, machine: 'pl800gb', operation: 'grindPlunge', grindDiameter: 59.8,
    grindStart: -25, stepDepth: 0.1, grindFeed: 30, grindOn: '151', grindOff: '152',
    grindConfirmed: true, grindDwell: 2.5, coolant: 'flood',
  });
  assert.match(code, /G01 X59\.800 Z-25\.000 F30\.000000\nG04 X2\.500 \(SPARK-OUT DWELL\)/);
  const dwell = readTurningMoves(code).find(move => code.split('\n')[move.line - 1].startsWith('G04'));
  assert.equal(dwell.mode, 'event');
  assert.deepEqual(dwell.to, { x: 59.8, z: -25 });
});

test('typed line length uses radius and Z, including constrained axes', () => {
  const start = { x: 40, z: -20 };
  assert.deepEqual(sketchEndpointAtLength(start, undefined, 12.5, 'line'), { x: 40, z: -32.5 });
  assert.deepEqual(sketchEndpointAtLength(start, { x: 46, z: -24 }, 10, 'line'), { x: 52, z: -28 });
  assert.deepEqual(sketchEndpointAtLength(start, { x: 34, z: -40 }, 2.5, 'vertical'), { x: 35, z: -20 });
  assert.deepEqual(sketchEndpointAtLength(start, { x: 50, z: -40 }, 2.5, 'horizontal'), { x: 40, z: -22.5 });
});

test('grinding wheel speed stays separate from workpiece spindle and needs an explicit program format', () => {
  const params = {
    ...setup, machine: 'pl800gb', operation: 'grindPlunge', grindDiameter: 59.8,
    grindStart: -25, stepDepth: 0.1, grindFeed: 30, grindOn: '151', grindOff: '152',
    grindConfirmed: true, grindRpm: 3400,
  };
  const manual = generateTurningProgram({ ...params, grindSpeedMode: 'manual' });
  assert.match(manual, /\(SET GRIND WHEEL TO 3400 RPM ON MACHINE\)/);
  assert.doesNotMatch(manual, /[SPQ]3400/);
  const combined = generateTurningProgram({ ...params, grindSpeedMode: 'program', grindSpeedM: 'M151', grindSpeedAddress: 'P' });
  assert.match(combined, /G97 S600 M03[\s\S]*M151 P3400 \(GRIND HEAD ON\)/);
  assert.equal(combined.match(/M151/g).length, 1);
  const m13 = generateTurningProgram({ ...params, grindOn: 'M13', grindSpeedMode: 'sameBlock', grindSpeedAddress: 'S' });
  assert.match(m13, /M13 S3400 \(GRIND HEAD ON\)/);
  assert.equal(m13.match(/^M13\b/gm).length, 1);
  assert.throws(() => generateTurningProgram({ ...params, grindOn: 'M13', grindSpeedMode: 'sameBlock' }), /Speed Word/);
  const separate = generateTurningProgram({ ...params, grindSpeedMode: 'program', grindSpeedM: 'M153', grindSpeedAddress: 'S' });
  assert.match(separate, /M153 S3400 \(GRIND WHEEL SPEED\)\nM151 \(GRIND HEAD ON\)/);
  assert.equal(readTurningMoves(separate).filter(move => move.mode === 'event').length, 3);
  assert.throws(() => generateTurningProgram({ ...params, grindSpeedMode: 'program', grindSpeedM: 'M152', grindSpeedAddress: 'P' }), /Wheel Speed M-code/);
});

test('combined program uses unique P/Q labels, ordered tool offsets, and one program end', () => {
  const rough = { ...setup, operation: 'rough', tool: 1, offset: 2, stepDepth: 4, allowance: 1, cycleRetract: 0.5, finishCycle: true };
  const face = { ...setup, operation: 'roughFace', tool: 3, offset: 4, faceStock: 3, faceStep: 1, faceAllowance: 0.2, cycleRetract: 0.5 };
  const change = { x: -200, z: -400, confirmed: true };
  const result = generateTurningSequence([rough, face], change);
  assert.equal(result.match(/^O0100$/gm).length, 1);
  assert.equal(result.match(/^M30$/gm).length, 1);
  assert.match(result, /T0102[\s\S]+G71 P100 Q140[\s\S]+G70 P100 Q140[\s\S]+G53 G00 Z-400\.000\nG53 G00 X-200\.000[\s\S]+T0304[\s\S]+G72 P3100 Q3110/);
  const moves = readTurningMoves(result);
  assert.ok(moves.some(move => move.mode === 'feed' && move.to.z === -60));
  assert.ok(moves.some(move => move.mode === 'feed' && move.to.x === 0 && move.to.z === 0.2));
  assert.ok(moves.every(move => move.to.x !== -200 && move.to.z !== -400));
  assert.throws(() => generateTurningSequence([rough, { ...face, units: 'inch' }], change), /Nguyên công 2.*đơn vị/);
  assert.throws(() => generateTurningSequence([rough, face], { ...change, confirmed: false }), /xác nhận/);
});

test('ID grinding opens the bore radially and withdraws below the bore diameter before moving toward Z0', () => {
  const params = { ...setup, machine: 'pl800gb', operation: 'grindId', grindBoreDiameter: 20, grindBoreDepth: 40,
    grindIdRelief: 1, grindStart: -2, grindEnd: -35, grindDiameter: 20.4, stepDepth: 0.1,
    grindFeed: 35, grindOn: '151', grindOff: '152', grindConfirmed: true };
  const code = generateTurningProgram(params);
  assert.match(code, /G00 X18\.000 Z3\.000\nG00 X18\.000 Z-2\.000/);
  assert.match(code, /G01 X20\.400 Z-35\.000\nG00 X18\.000 Z-35\.000\nG00 X18\.000 Z3\.000/);
  assert.throws(() => generateTurningProgram({ ...params, grindEnd: -40 }), /đáy lỗ/);
  assert.throws(() => generateTurningProgram({ ...params, grindDiameter: 19 }), /đường kính/);
  const plunge = readTurningMoves(generateTurningProgram({ ...params, operation: 'grindIdPlunge', grindStart: -22 }));
  assert.ok(plunge.filter(move => move.mode === 'feed').every(move => move.to.z === -22));
});
