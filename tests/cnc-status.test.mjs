import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../assets/js/cnc-status.js', import.meta.url), 'utf8');
const { cncDisplayState, cncIsFresh, cncMeasurement, setCncClockOffset, cncServerNow } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-28T08:30:00Z');
const live = { source: 'focas', connected: true, lastSeen: now, rawStatus: { run: 3, alarm: 0, emergency: 0 } };
test('actual stopped machine is idle; RUN/HOLD and flags use measured raw status', () => {
  for (const [run, expected] of [[0,'idle'],[1,'idle'],[2,'hold'],[3,'running'],[4,'idle'],[99,'unknown']]) {
    assert.equal(cncDisplayState({ ...live, rawStatus: { ...live.rawStatus, run } }, now).status, expected);
  }
  assert.equal(cncDisplayState({ ...live, rawStatus: { ...live.rawStatus, alarm: 1 } }, now).status, 'alarm');
  assert.equal(cncDisplayState({ ...live, rawStatus: { ...live.rawStatus, emergency: 1 } }, now).status, 'alarm');
  assert.equal(cncDisplayState({ ...live, rawStatus: null }, now).status, 'unknown');
});
test('stale/missing/invalid/future timestamps and explicit disconnection never display RUN', () => {
  for (const lastSeen of [now-30001, null, 'invalid', now+6000]) {
    assert.equal(cncIsFresh({ ...live, lastSeen }, now), false);
    assert.equal(cncDisplayState({ ...live, lastSeen }, now).status, 'offline');
  }
  assert.equal(cncIsFresh({ ...live, lastSeen: now-30000 }, now), true);
  assert.equal(cncDisplayState({ ...live, connected: false }, now).status, 'offline');
});
test('legacy and pending records are never represented as verified live data', () => {
  for (const source of [undefined, 'pending', 'demo']) assert.equal(cncIsFresh({ ...live, source }, now), false);
  assert.equal(cncDisplayState({ ...live, source: undefined }, now).status, 'offline');
  assert.match(cncDisplayState({ ...live, source: 'demo' }, now).label, /MÔ PHỎNG/);
});
test('missing measurements remain unavailable rather than invented zero values', () => {
  assert.equal(cncMeasurement(0),'0');
  for (const value of [null, undefined, NaN, Infinity, '1200', '<img>']) assert.equal(cncMeasurement(value),'—');
});

test('clock calibration does not mistake a fresh server heartbeat for a stale one', () => {
 const offset=-11*60000;
 setCncClockOffset(offset);
 const fresh={...live,lastSeen:Date.now()+offset};
 assert.equal(cncIsFresh(fresh),true);
 assert.equal(cncDisplayState(fresh).status,'running');
 assert.equal(cncDisplayState({...fresh,lastSeen:fresh.lastSeen-31000}).status,'offline');
 assert.ok(Math.abs(cncServerNow()-Date.now()-offset)<10);
 setCncClockOffset(0);
});
