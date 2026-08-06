const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sentence-city-v4.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'sentence-city-ar-v4.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'sentence-city-ar-v4.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'sentence-city-ar-v4-test-loader.js'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'sentence-city-ar-v4-activation.js'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'sentence-city-ar-only-guard.js'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'game-test-hub.html'), 'utf8');

function position(source, token) {
  const value = source.indexOf(token);
  assert.ok(value >= 0, `${token} missing`);
  return value;
}

assert.ok(position(html, 'sentence-city-v3.js') < position(html, 'sentence-city-ar-v4-activation.js'));
assert.ok(position(html, 'sentence-city-ar-v4-activation.js') < position(html, 'sentence-city-ar-v4-test-loader.js'));
assert.ok(position(html, 'sentence-city-ar-v4-test-loader.js') < position(html, 'sentence-city-ar-only-guard.js'));
assert.match(html, /AR-only • 10 Missions/);
assert.match(hub, /sentence-city-v4\.html\?v=20260806-scar4/);

assert.match(js, /vision_bundle\.mjs/);
assert.match(js, /hand_landmarker\.task/);
assert.match(js, /getUserMedia/);
assert.match(js, /facingMode:\s*\{ ideal: "user" \}/);
assert.match(js, /delegate:\s*"GPU"/);
assert.match(js, /delegate:\s*"CPU"/);
assert.match(js, /distance\(indexTip, thumbTip\)/);
assert.match(js, /gap < 0\.052/);
assert.match(js, /ar_pinch_action/);
assert.match(js, /firstHandLatencyMs/);
assert.match(js, /targetMissCount/);
assert.match(js, /pagehide/);
assert.match(js, /getTracks/);

assert.match(loader, /Object\.freeze\(\[0, 1, 2, 3, 4, 5, 6, 7, 8, 9\]\)/);
assert.match(loader, /10 AR Hand Missions/);
assert.match(loader, /AR-only mode/);
assert.match(loader, /Retry AR Hand Mode/);
assert.match(loader, /AR_ONLY_TOUCH_BUTTON_PATCH_FAILED/);

assert.match(activation, /event\.isTrusted/);
assert.match(activation, /state\.selected/);
assert.match(activation, /type:\s*"depot"/);
assert.match(activation, /target\.dataset\.token/);

assert.match(guard, /BLOCKED_SELECTOR/);
assert.match(guard, /event\.isTrusted/);
assert.match(guard, /stopImmediatePropagation/);
assert.match(guard, /โหมด AR-only/);
assert.doesNotMatch(html, /Use Touch Instead/);

assert.match(css, /#sentenceArPointer/);
assert.match(css, /\.ew-ar-focus/);
assert.match(css, /\.sentence-ar-panel/);
assert.match(css, /transform:scaleX\(-1\)/);

console.log('Sentence City AR-only V4.1 contract: PASS');
