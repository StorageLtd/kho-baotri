import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../assets/js/fanuc-turning.js', import.meta.url), 'utf8');
const { generateTurningProgram, readTurningMoves } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

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
