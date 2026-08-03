import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const store = new Map();
const context = {
  console,
  URL,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  JSON,
  localStorage: {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  },
  window: {},
  document: {
    createElement() { return {}; },
    head: { appendChild() {} }
  }
};
context.window = context;
vm.createContext(context);
for (const file of ['config.js', 'word-bank.js', 'authority-client.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
}

const api = context.EW_AUTHORITY;
const bank = context.EW_WORD_BANK;
assert.equal(api.FLOW.length, 8);
assert.equal(bank.questionsForZone('word_match', 10).length, 10);
assert.equal(bank.assessment('A').length, 10);
assert.equal(bank.assessment('B').length, 10);
assert.equal(bank.finalBoss(20).length, 20);

const playerId = 'EW-QA-001';
const lookup = await api.profileLookup(playerId, 'QA Player');
assert.equal(lookup.ok, true);
let resumed = await api.resume(playerId, 'QA Player');
assert.deepEqual([...resumed.progress.unlocked], ['pre_challenge']);

await assert.rejects(
  api.submitGame({ playerId, nickname:'QA Player', stageId:'word_match', score:10, total:10, answers:[] }),
  /STAGE_LOCKED/
);

let receipt = await api.submitAssessment({
  playerId, nickname:'QA Player', assessmentType:'pre', formId:'A', score:5, total:10, answers:[]
});
assert.equal(receipt.ok, true);
assert.equal(receipt.authority.progress.unlocked.includes('word_match'), true);

receipt = await api.submitGame({
  playerId, nickname:'QA Player', stageId:'word_match', score:6, total:10, answers:[]
});
assert.equal(receipt.passed, false);
assert.equal(receipt.authority.progress.unlocked.includes('category_forest'), false);

receipt = await api.submitGame({
  playerId, nickname:'QA Player', stageId:'word_match', score:7, total:10, answers:[]
});
assert.equal(receipt.passed, true);
assert.equal(receipt.authority.progress.unlocked.includes('category_forest'), true);

console.log('English Week authority contract: PASS');
