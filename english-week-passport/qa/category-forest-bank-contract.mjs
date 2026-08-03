import assert from 'node:assert/strict';

const categories = ['Travel', 'Technology', 'Environment', 'Health'];
const items = [
  ['passport','Travel'],['keyboard','Technology'],['recycle','Environment'],['exercise','Health'],
  ['boarding pass','Travel'],['password','Technology'],['pollution','Environment'],['hydration','Health'],
  ['destination','Travel'],['smartphone','Technology'],['wildlife','Environment'],['medicine','Health']
];

assert.equal(items.length, 12);
for (const [word, answer] of items) {
  assert.ok(word.length > 0);
  assert.ok(categories.includes(answer), `${word} must use a canonical portal`);
}
for (const category of categories) {
  assert.equal(items.filter(([, answer]) => answer === category).length, 3, `${category} must have three items`);
}
assert.equal(new Set(categories).size, 4);
console.log('Category Forest strict bank contract: PASS');
