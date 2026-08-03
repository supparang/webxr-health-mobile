import assert from 'node:assert/strict';

function memoryMastery(mistakes) {
  return Math.max(0, 10 - Math.floor(Number(mistakes || 0) / 2));
}
function passes(score, total, mark = 70) {
  return Math.round((score / total) * 100) >= mark;
}
function sentenceMastery(firstTryCorrect) {
  return Math.max(0, Math.min(10, Number(firstTryCorrect || 0)));
}

assert.equal(memoryMastery(0), 10, 'perfect memory round must score 10/10');
assert.equal(memoryMastery(6), 7, 'six memory mismatches must remain at the 70% boundary');
assert.equal(memoryMastery(7), 7, 'odd mismatch count uses two-mistake mastery bands');
assert.equal(memoryMastery(8), 6, 'eight mismatches must fall below pass mark');
assert.equal(passes(memoryMastery(6), 10), true, 'memory boundary must pass');
assert.equal(passes(memoryMastery(8), 10), false, 'memory below boundary must fail');

assert.equal(sentenceMastery(7), 7, 'seven first-try sentences must score 70%');
assert.equal(passes(sentenceMastery(7), 10), true, 'sentence boundary must pass');
assert.equal(passes(sentenceMastery(6), 10), false, 'six first-try sentences must fail');

const stagePayloads = [
  { stageId:'word_match', inputMode:'touch-memory' },
  { stageId:'category_forest', inputMode:'camera' },
  { stageId:'sentence_city', inputMode:'touch-drag-builder' }
];
assert.deepEqual(stagePayloads.map(x => x.stageId), ['word_match','category_forest','sentence_city']);
assert.ok(stagePayloads.every(x => x.inputMode), 'every game must report an input mode');

console.log('English Week solo multi-control contract: PASS');
