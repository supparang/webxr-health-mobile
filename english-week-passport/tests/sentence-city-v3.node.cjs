const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sentence-city-v3.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'sentence-city-v3.css'), 'utf8');
const source = fs.readFileSync(path.join(root, 'sentence-city-v3.js'), 'utf8');

new Function(source);
assert.match(html, /Sentence City • Skyline Builder V3/);
assert.match(html, /passport-rotation-v2\.js/);
assert.match(source, /SENTENCE-CITY-SKYLINE-V3/);
assert.match(source, /City Repair Crew/i);
assert.match(source, /CITY RUSH/);
assert.match(source, /wordSetId/);
assert.match(source, /firstTryCorrect/);
assert.match(source, /autoSpeechCount/);
assert.match(css, /\.sentence-slot/);
assert.match(css, /\.drag-ghost/);
assert.match(css, /\.building\.lit/);

const bankMatch = source.match(/const BANK = Object\.freeze\((\[[\s\S]*?\])\);\n\n  const KIND_QUOTA/);
assert.ok(bankMatch, 'Sentence City bank not found');
const bank = Function(`return (${bankMatch[1]})`)();
assert.equal(bank.length, 24);
assert.equal(new Set(bank.map(item => item.id)).size, 24);

const kinds = bank.reduce((acc, item) => {
  acc[item.kind] = (acc[item.kind] || 0) + 1;
  return acc;
}, {});
assert.deepEqual(kinds, {
  'Fill the Gap': 8,
  'Word Order': 8,
  Repair: 4,
  Context: 4
});

const levels = bank.reduce((acc, item) => {
  acc[item.level] = (acc[item.level] || 0) + 1;
  return acc;
}, {});
assert.deepEqual(levels, { A2: 6, 'A2+': 6, B1: 6, 'B1+': 6 });

bank.forEach(item => {
  assert.ok(item.tokens.length >= item.answer.length);
  assert.ok(item.answer.length >= 1);
  assert.ok(item.hint.length >= 10);
});

console.log('Sentence City Skyline Builder V3 contract: PASS', { kinds, levels });
