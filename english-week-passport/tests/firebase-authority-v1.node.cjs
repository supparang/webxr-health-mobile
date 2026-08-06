const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');
const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(root, 'firebase-authority-bridge.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const categoryHtml = fs.readFileSync(path.join(root, 'category-forest-v5.html'), 'utf8');
const categorySummary = fs.readFileSync(path.join(root, 'category-forest-v5-part4.js'), 'utf8');
const functionSource = fs.readFileSync(path.join(repo, 'english', 'functions', 'english-week-authority.js'), 'utf8');
const functionPackage = JSON.parse(fs.readFileSync(path.join(repo, 'english', 'functions', 'package.json'), 'utf8'));
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(repo, 'english', 'firebase.json'), 'utf8'));

const configContext = { window: {} };
vm.runInNewContext(configSource, configContext);
const cfg = configContext.window.EW_CONFIG;
assert.equal(cfg.authorityMode, 'firebase-first');
assert.equal(cfg.firebaseProjectId, 'english-d4bfa');
assert.match(cfg.firebaseAuthorityUrl, /englishWeekAuthority$/);

function scriptOrder(html, names) {
  const positions = names.map(name => html.indexOf(name));
  positions.forEach((position, index) => assert.ok(position >= 0, `${names[index]} missing`));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `${names[index - 1]} must load before ${names[index]}`);
  }
}

scriptOrder(indexHtml, [
  'authority-client.js',
  'firebase-authority-bridge.js',
  'passport-rotation-v2.js',
  'app-core-loader-v2.js'
]);
scriptOrder(categoryHtml, [
  'authority-client.js',
  'firebase-authority-bridge.js',
  'passport-rotation-v2.js',
  'category-forest-v5.js'
]);

assert.match(categorySummary, /response\.mode === 'firebase'/);
assert.match(categorySummary, /บันทึกชั่วคราวบนเครื่องแล้ว/);
assert.match(categorySummary, /Retry Firebase Save/);
assert.match(functionSource, /validateCategoryEvidence/);
assert.match(functionSource, /ASSIGNMENT_ROTATION_MISMATCH/);
assert.match(functionSource, /ewp_game_results/);
assert.match(functionSource, /englishWeekAuthority/);
assert.equal(functionPackage.main, 'main.js');
assert.equal(firebaseConfig.functions.source, 'functions');

async function runBridgeContract() {
  let fetchMode = 'firebase';
  const events = [];
  const legacy = {
    endpointReady: () => false,
    profileLookup: async playerId => ({ ok: true, profile: { playerId } }),
    resume: async playerId => ({ ok: true, profile: { playerId }, progress: { unlocked: ['pre_challenge'] } }),
    submitAssessment: async payload => ({ ok: true, receiptId: 'LOCAL-A', payload }),
    submitGame: async payload => ({ ok: true, receiptId: 'LOCAL-G', passed: true, accuracy: 90, payload }),
    leaderboard: async () => ({ ok: true, rows: [] })
  };
  const context = {
    window: {
      EW_CONFIG: cfg,
      EW_AUTHORITY: legacy,
      dispatchEvent: event => events.push(event)
    },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => {
      if (fetchMode === 'error') throw new Error('NETWORK_DOWN');
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, mode: 'firebase', profile: { playerId: '990001' } })
      };
    },
    console
  };
  vm.runInNewContext(bridgeSource, context);
  const api = context.window.EW_AUTHORITY;
  assert.equal(api.endpointReady(), true);
  const remote = await api.profileLookup('990001', 'QA');
  assert.equal(remote.mode, 'firebase');
  fetchMode = 'error';
  const fallback = await api.submitGame({ playerId: '990001', stageId: 'category_forest' });
  assert.equal(fallback.mode, 'demo-fallback');
  assert.equal(fallback.receiptId, 'LOCAL-G');
  assert.match(fallback.firebaseError, /NETWORK_DOWN/);
  assert.ok(events.some(event => event.type === 'ew-authority-status'));
}

runBridgeContract()
  .then(() => console.log('English Week Firebase authority contract: PASS'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
