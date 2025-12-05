// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Minimal A-Frame Engine (targets visible + HUD events)

'use strict';

const A = window.AFRAME;
if (!A) {
  console.error('[GoodJunkVR] AFRAME not found');
}

// ---------- Config ----------
const GOOD_EMOJI = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅'];
const JUNK_EMOJI = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬'];

const DIFF_TABLE = {
  easy:   { spawnInterval: 1300, fallSpeed: 0.75 },
  normal: { spawnInterval: 950,  fallSpeed: 1.05 },
  hard:   { spawnInterval: 750,  fallSpeed: 1.35 }
};

// ---------- State ----------
let rootEl = null;
let running = false;
let currentDiff = 'normal';

let spawnTimer = null;
let moveTimer  = null;
let lastMoveAt = 0;

let nextId = 1;
let targets = []; // {id, el, isGood, createdAt, lifetime, x,y,z}

// stats
let score = 0;
let combo = 0;
let maxCombo = 0;
let misses = 0;
let goodHits = 0;

// simple quest target
const GOAL_TARGET_GOOD   = 30;
const MINI_TARGET_COMBO  = 10;

// ---------- helpers ----------
function randRange(min, max) { return min + Math.random() * (max - min); }

function emit(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); }
  catch (e) { console.warn('[GoodJunkVR] emit error', name, e); }
}

function ensureRootEntity() {
  return new Promise((resolve) => {
    if (rootEl && rootEl.isConnected) return resolve(rootEl);
    const scene = document.querySelector('a-scene');
    if (!scene) return resolve(null);

    const attach = () => {
      let root = scene.querySelector('#target-root');
      if (!root) {
        root = document.createElement('a-entity');
        root.id = 'target-root';
        scene.appendChild(root);
      }
      rootEl = root;
      resolve(rootEl);
    };

    if (scene.hasLoaded) attach();
    else scene.addEventListener('loaded', attach, { once: true });
  });
}

function resetStats() {
  score = 0;
  combo = 0;
  maxCombo = 0;
  misses = 0;
  goodHits = 0;

  emit('hha:score', { score, combo, misses });
  updateQuestHUD();
}

function updateQuestHUD(hint) {
  const goal = {
    label: `เก็บอาหารดีให้ได้อย่างน้อย ${GOAL_TARGET_GOOD} ชิ้น`,
    prog: goodHits,
    target: GOAL_TARGET_GOOD
  };
  const mini = {
    label: `ทำคอมโบต่อเนื่องให้ได้อย่างน้อย ${MINI_TARGET_COMBO}`,
    prog: maxCombo,
    target: MINI_TARGET_COMBO
  };
  emit('hha:quest', { goal, mini, hint: hint || '' });
}

function removeTarget(t) {
  if (!t) return;
  if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  targets = targets.filter(x => x.id !== t.id);
}

// ---------- spawn / move ----------
function spawnOne() {
  if (!running || !rootEl) return;

  const isGood = Math.random() < 0.65;
  const emoji = isGood
    ? GOOD_EMOJI[Math.floor(Math.random() * GOOD_EMOJI.length)]
    : JUNK_EMOJI[Math.floor(Math.random() * JUNK_EMOJI.length)];

  const x = randRange(-1.8, 1.8);
  const y = randRange(1.3, 2.3);
  const z = -3.0;

  const base = document.createElement('a-entity');
  base.setAttribute('position', `${x} ${y} ${z}`);

  // 🔹 ให้ base ก็เป็น target
  base.setAttribute('data-hha-tgt', '');
  base.classList.add('hha-target');

  // วงกลมพื้นหลัง (จาน)
  const plate = document.createElement('a-entity');
  plate.setAttribute('geometry', 'primitive: circle; radius: 0.35; segments: 32');
  plate.setAttribute(
    'material',
    `color: ${isGood ? '#22c55e' : '#f97316'}; emissive: ${isGood ? '#22c55e' : '#f97316'}; emissiveIntensity: 0.35; side: double`
  );
  plate.setAttribute('rotation', '-90 0 0');
  plate.setAttribute('data-hha-tgt', '');
  plate.classList.add('hha-target');
  base.appendChild(plate);

  // emoji text
  const label = document.createElement('a-entity');
  label.setAttribute(
    'text',
    `value: ${emoji}; align: center; width: 2.4; color: #ffffff; side: double`
  );
  label.setAttribute('position', '0 0 0.02');
  label.setAttribute('rotation', '-90 0 0');
  label.setAttribute('data-hha-tgt', '');
  label.classList.add('hha-target');
  base.appendChild(label);

  const target = {
    id: nextId++,
    el: base,
    isGood,
    createdAt: performance.now(),
    lifetime: 2600,
    x, y, z
  };

  // 🔹 ผูก click ให้ทุกชั้น เผื่อ ray โดน child
  const onClick = () => handleHit(target);
  base.addEventListener('click', onClick);
  plate.addEventListener('click', onClick);
  label.addEventListener('click', onClick);

  rootEl.appendChild(base);
  targets.push(target);
}

function handleHit(target) {
  if (!running) return;
  if (!targets.find(t => t.id === target.id)) return; // ถูกลบไปแล้ว

  const wasGood = target.isGood;
  removeTarget(target);

  if (wasGood) {
    goodHits += 1;
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;
    const delta = 20 + combo * 2;
    score += delta;
    emit('hha:score', { score, combo, misses });
    updateQuestHUD();
  } else {
    combo = 0;
    misses += 1;
    score = Math.max(0, score - 12);
    emit('hha:miss', { misses });
    emit('hha:score', { score, combo, misses });
    updateQuestHUD('ระวังอาหารขยะ! เลือกผัก ผลไม้ นมให้มากขึ้น');
  }
}

function expireAsMiss(target) {
  removeTarget(target);
  combo = 0;
  misses += 1;
  emit('hha:miss', { misses });
  emit('hha:score', { score, combo, misses });
  updateQuestHUD();
}

function startMoveLoop() {
  if (moveTimer) return;
  lastMoveAt = performance.now();
  const speed = DIFF_TABLE[currentDiff]?.fallSpeed || DIFF_TABLE.normal.fallSpeed;

  moveTimer = setInterval(() => {
    if (!running) return;
    const now = performance.now();
    const dt = now - lastMoveAt;
    lastMoveAt = now;

    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      t.y -= (dt / 1000) * speed;
      if (t.el) t.el.setAttribute('position', `${t.x} ${t.y} ${t.z}`);
      if (now - t.createdAt > t.lifetime) {
        expireAsMiss(t);
      }
    }
  }, 16);
}

// ---------- API ----------
function start(diff = 'normal', durationSec = 60) {
  currentDiff = String(diff || 'normal').toLowerCase();
  if (!DIFF_TABLE[currentDiff]) currentDiff = 'normal';

  running = true;
  resetStats();

  ensureRootEntity().then((root) => {
    if (!root) {
      console.error('[GoodJunkVR] no a-scene / target-root');
      return;
    }
    rootEl = root;

    targets.forEach(t => removeTarget(t));
    targets = [];

    const cfg = DIFF_TABLE[currentDiff] || DIFF_TABLE.normal;
    const interval = cfg.spawnInterval;

    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(() => { if (running) spawnOne(); }, interval);

    startMoveLoop();
    updateQuestHUD('เลือกอาหารดี หลีกเลี่ยงอาหารขยะให้ได้มากที่สุด');
  });
}

function tickTime(sec) {
  if (!running) return;
  if (sec === 20) updateQuestHUD('เหลือ 20 วินาที ลองเก็บคอมโบให้ได้สูงสุด!');
  if (sec === 10) updateQuestHUD('โค้งสุดท้าย 10 วินาทีสุดท้าย ลุยเลย!');
}

function stop() {
  if (!running) return;
  running = false;

  if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
  if (moveTimer)  { clearInterval(moveTimer);  moveTimer  = null; }

  targets.forEach(t => removeTarget(t));
  targets = [];

  emit('hha:end', {
    mode: 'Good vs Junk VR',
    difficulty: currentDiff,
    score,
    scoreFinal: score,
    comboMax: maxCombo,
    misses,
    duration: null,
    goalsCleared: (goodHits >= GOAL_TARGET_GOOD ? 1 : 0),
    goalsTotal: 1,
    miniCleared: (maxCombo >= MINI_TARGET_COMBO ? 1 : 0),
    miniTotal: 1
  });
}

// ---------- export ----------
export const GameEngine = { start, tickTime, stop };
export default { GameEngine };
