const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'sentence-city-v4.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'sentence-city-ar-v4.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'sentence-city-ar-v4.js'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'sentence-city-ar-v4-activation.js'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'game-test-hub.html'), 'utf8');

function position(source, token) {
  const value = source.indexOf(token);
  assert.ok(value >= 0, `${token} missing`);
  return value;
}

assert.ok(position(html, 'sentence-city-v3.js') < position(html, 'sentence-city-ar-v4-activation.js'), 'V3 engine must load before AR activation bridge');
assert.ok(position(html, 'sentence-city-ar-v4-activation.js') < position(html, 'sentence-city-ar-v4.js'), 'AR activation bridge must load before hand controller');
assert.match(html, /AR Hand Detect V4/);
assert.match(hub, /sentence-city-v4\.html\?v=20260806-scar4/);
assert.match(hub, /TEST AR V4/);

assert.match(js, /SPECIAL_INDEXES\s*=\s*Object\.freeze\(\[2, 5, 8\]\)/);
assert.match(js, /vision_bundle\.mjs/);
assert.match(js, /hand_landmarker\.task/);
assert.match(js, /getUserMedia/);
assert.match(js, /facingMode:\s*\{ ideal: "user" \}/);
assert.match(js, /delegate:\s*"GPU"/);
assert.match(js, /delegate:\s*"CPU"/);
assert.match(js, /distance\(indexTip, thumbTip\)/);
assert.match(js, /gap < 0\.052/);
assert.match(js, /Use Touch Instead/);
assert.match(js, /fallbackToTouch/);
assert.match(js, /\.word-chip:not\(\.used\),\.sentence-slot,#checkBtn,#hintBtn,#speakTask/);
assert.match(js, /ar_pinch_action/);
assert.match(js, /ar_touch_fallback/);
assert.match(js, /firstHandLatencyMs/);
assert.match(js, /targetMissCount/);
assert.match(js, /pagehide/);
assert.match(js, /getTracks/);

assert.match(activation, /event\.isTrusted/);
assert.match(activation, /state\.selected/);
assert.match(activation, /type:\s*"depot"/);
assert.match(activation, /target\.dataset\.token/);
assert.match(activation, /SENTENCE_CITY_AR_ACTIVATION/);

assert.match(css, /#sentenceArPointer/);
assert.match(css, /\.ew-ar-focus/);
assert.match(css, /\.sentence-ar-panel/);
assert.match(css, /transform:scaleX\(-1\)/);
assert.match(css, /\.sentence-ar-panel\.fallback/);

console.log('Sentence City AR Hand Detect V4 contract: PASS');
