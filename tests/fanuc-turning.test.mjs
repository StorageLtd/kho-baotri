import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sketchSource = await readFile(new URL('../assets/js/fanuc-sketch.js', import.meta.url), 'utf8');
const sketchUrl = asModule(sketchSource);
const source = await readFile(new URL('../assets/js/fanuc-turning.js', import.meta.url), 'utf8');
const { generateTurningProgram, readTurningMoves } = await import(asModule(source.replace(/\.\/fanuc-sketch\.js\?v=\d+/, sketchUrl)));
const { arcPoints, profileFromStl } = await import(sketchUrl);

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
