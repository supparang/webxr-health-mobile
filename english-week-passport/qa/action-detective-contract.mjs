import assert from 'node:assert/strict';

const PASS_MARK = 70;
const TOTAL = 9;
const accuracy = score => Math.round((score / TOTAL) * 100);
const passed = score => accuracy(score) >= PASS_MARK;

assert.equal(accuracy(9), 100);
assert.equal(accuracy(7), 78);
assert.equal(accuracy(6), 67);
assert.equal(passed(7), true, '7 of 9 must pass the 70 percent policy');
assert.equal(passed(6), false, '6 of 9 must not pass');

const rounds = {
  body: ['body01','body02','body03'],
  ar: ['ar01','ar02','ar03'],
  hand: ['hand01','hand02','hand03']
};
const allIds = Object.values(rounds).flat();
assert.equal(allIds.length, TOTAL);
assert.equal(new Set(allIds).size, TOTAL, 'all mission item IDs must be unique');

const supportedModes = new Set([
  'body-pose','touch-body-fallback',
  'ar-dwell','ar-tap','touch-ar-fallback',
  'hand-pinch','hand-touch-assist','touch-hand-fallback'
]);
assert.equal(supportedModes.size, 8);
assert.ok([...supportedModes].every(Boolean));

const fallbackModes = [...supportedModes].filter(mode => mode.includes('fallback') || mode.includes('assist') || mode === 'ar-tap');
assert.deepEqual(fallbackModes.sort(), ['ar-tap','hand-touch-assist','touch-ar-fallback','touch-body-fallback','touch-hand-fallback'].sort());

console.log('Action Detective Lab contract: PASS');
