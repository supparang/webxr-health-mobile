const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'category-forest-v5.html'), 'utf8');
const parts = [1, 2, 3, 4].map(number =>
  fs.readFileSync(path.join(root, `category-forest-v5-part${number}.js`), 'utf8')
);
const source = parts.join('\n');

assert.match(html, /Seeded Production V5/);
assert.match(html, /passport-rotation-v2\.js/);
assert.match(html, /authority-client\.js/);
assert.match(html, /category-forest-v5\.js/);
assert.match(source, /CATEGORY-FOREST-SEEDED-PRODUCTION-V5/);
assert.match(source, /wordSetId/);
assert.match(source, /submitGame/);
new Function(source);

const bankText = source.match(/const BANK=(\{[\s\S]*?\});\nconst TH=/)?.[1];
const rotationText = source.match(/const ROTATION_CATEGORIES=(\{[\s\S]*?\});\n/)?.[1];
assert.ok(bankText && rotationText, 'seeded bank contracts missing');
const BANK = Function(`return (${bankText})`)();
const ROTATION_CATEGORIES = Function(`return (${rotationText})`)();

assert.equal(Object.keys(BANK).length, 6);
assert.equal(Object.values(BANK).flat().length, 48);
Object.values(BANK).forEach(items => {
  assert.equal(items.length, 8);
  ['A2', 'A2+', 'B1', 'B1+'].forEach(level => {
    assert.equal(items.filter(item => item.level === level).length, 2);
  });
});

const VERSION = '2026-08-05-CATEGORY-FOREST-SEEDED-PRODUCTION-V5';
const STAGE_ID = 'category_forest';
const ROTATION_VERSION = '2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT';
const APP_ID = 'ENGLISH-WEEK-PASSPORT-2026';

function hash32(value) {
  const input = String(value ?? '').trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function mix32(value) {
  let x = Number(value) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}
function mulberry32(seed) {
  let state = Number(seed) >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function assignmentFor(playerId) {
  const passportHash = mix32(hash32(`${APP_ID}|${playerId}|passport|${ROTATION_VERSION}`));
  const reversedId = Array.from(playerId).reverse().join('');
  const assessmentHash = mix32(hash32(`assessment|${reversedId}|${ROTATION_VERSION}|${APP_ID}`));
  return {
    passportRotation: ['P1', 'P2', 'P3', 'P4'][passportHash % 4],
    assessmentRotation: ['R1', 'R2'][(assessmentHash >>> 16) % 2],
    randomSeed: mix32(hash32(`${ROTATION_VERSION}|seed|${playerId}|${APP_ID}`)),
  };
}
function missionFor(playerId) {
  const assignment = assignmentFor(playerId);
  const seedFor = suffix => mix32(hash32(
    `${assignment.randomSeed}|${assignment.passportRotation}|${STAGE_ID}|${suffix}|${VERSION}`
  ));
  const order = (values, suffix) => {
    const output = [...values];
    const random = mulberry32(seedFor(suffix));
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  };
  const stageSeed = seedFor('word-set');
  const categories = [...ROTATION_CATEGORIES[assignment.passportRotation]];
  const levels = ['A2', 'A2+', 'B1', 'B1+'];
  const dominant = stageSeed % 3;
  const others = [0, 1, 2].filter(index => index !== dominant);
  const omitA = (stageSeed >>> 3) % 4;
  let omitB = (omitA + 1 + ((stageSeed >>> 7) % 3)) % 4;
  if (omitB === omitA) omitB = (omitA + 1) % 4;
  const omitted = { [others[0]]: levels[omitA], [others[1]]: levels[omitB] };
  const selected = [];
  categories.forEach((category, index) => {
    levels.filter(level => index === dominant || level !== omitted[index]).forEach(level => {
      const pool = BANK[category].filter(item => item.level === level);
      selected.push({ ...order(pool, `${assignment.passportRotation}:${category}:${level}:choice`)[0], category });
    });
  });
  return {
    ...assignment,
    categories,
    items: order(selected, `${assignment.passportRotation}:item-order`),
  };
}

const rotations = { P1: 0, P2: 0, P3: 0, P4: 0 };
const uniqueSets = new Set();
for (let number = 1; number <= 200; number += 1) {
  const playerId = `EW${String(number).padStart(4, '0')}`;
  const mission = missionFor(playerId);
  const repeated = missionFor(playerId);
  rotations[mission.passportRotation] += 1;
  assert.deepEqual(mission.items.map(item => item.id), repeated.items.map(item => item.id));
  assert.equal(mission.items.length, 10);
  assert.equal(new Set(mission.items.map(item => item.id)).size, 10);
  assert.equal(new Set(mission.items.map(item => item.category)).size, 3);
  const levelCounts = ['A2', 'A2+', 'B1', 'B1+'].map(level =>
    mission.items.filter(item => item.level === level).length
  );
  assert.ok(Math.max(...levelCounts) - Math.min(...levelCounts) <= 1, `unbalanced CEFR for ${playerId}`);
  uniqueSets.add(`${mission.passportRotation}:${mission.items.map(item => item.id).join(',')}`);
}
assert.ok(uniqueSets.size >= 180, `expected broad set diversity, got ${uniqueSets.size}`);
Object.values(rotations).forEach(count => assert.ok(count >= 25 && count <= 75));
console.log('Category Forest V5 seeded contract: PASS', { rotations, uniqueSets: uniqueSets.size });
