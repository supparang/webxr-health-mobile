// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji target + score/combo/miss + quest event basic)

'use strict';

const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found, GameEngine will not run');
}

// ---------- Config ----------
const FEVER_MAX = 100;
const TARGET_LIFETIME = 2500;   // ms ก่อนนับว่า MISS
const SPAWN_INTERVAL_NORMAL = 1000; // ms ระหว่าง spawn
const MAX_ACTIVE = 6;

// กลุ่มอาหารพื้นฐานสำหรับ quest ง่าย ๆ
const FOODS = [
  { emoji: '🍚', group: 'grain',  good: true },
  { emoji: '🍞', group: 'grain',  good: true },
  { emoji: '🥦', group: 'veg',    good: true },
  { emoji: '🥕', group: 'veg',    good: true },
  { emoji: '🍎', group: 'fruit',  good: true },
  { emoji: '🍌', group: 'fruit',  good: true },
  { emoji: '🍗', group: 'protein',good: true },
  { emoji: '🥚', group: 'protein',good: true },
  { emoji: '🥛', group: 'dairy',  good: true },
  { emoji: '🧀', group: 'dairy',  good: true },
  // ของหวาน / ของทอด ไว้เป็น distractor
  { emoji: '🍩', group: 'junk',   good: false },
  { emoji: '🍰', group: 'junk',   good: false },
  { emoji: '🍟', group: 'junk',   good: false },
  { emoji: '🥤', group: 'junk',   good: false }
];

// ---------- State ----------
let sceneEl = null;
let rootEl  = null;

let running = false;
let spawnTimer = null;

let score = 0;
let combo = 0;
let comboMax = 0;
let misses = 0;
let fever = 0;

// quest นับง่าย ๆ : goal = เลือกอาหารดีให้ครบ X ชิ้น, mini = ผัก Y ชิ้น
let goodCount = 0;
let vegCount  = 0;
const GOAL_TARGET = 15;
const MINI_TARGET = 5;

// ---------- Helper ----------
function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// สุ่มตำแหน่งเป้าในครึ่งล่างจอ (ใกล้ผู้เล่น)
function randomTargetPosition() {
  const x = -2 + Math.random() * 4;            // -2 .. 2
  const y = 0.8 + Math.random() * 1.2;         // 0.8 .. 2.0
  const z = -3.2;
  return { x, y, z };
}

// ---------- Target root ----------
function ensureRoot() {
  if (rootEl && rootEl.parentEl) return rootEl;
  if (!sceneEl) sceneEl = document.querySelector('a-scene');
  if (!sceneEl) return null;

  let r = sceneEl.querySelector('#fg-target-root');
  if (!r) {
    r = document.createElement('a-entity');
    r.setAttribute('id', 'fg-target-root');
    sceneEl.appendChild(r);
  }
  rootEl = r;
  return r;
}

function removeTarget(el) {
  if (!el || !el.parentEl) return;
  el.parentEl.removeChild(el);
}

// ---------- Quest / Grade helper ----------
function updateQuestProgress() {
  const goal = {
    label: 'เลือกอาหารให้ครบทั้ง 5 หมู่',
    prog:  goodCount,
    target: GOAL_TARGET
  };

  const mini = {
    label: 'ผัก 5 ครั้ง',
    prog:  vegCount,
    target: MINI_TARGET
  };

  dispatch('quest:update', {
    goal,
    mini,
    goalsAll: [
      { label: goal.label, done: goal.prog >= goal.target }
    ],
    minisAll: [
      { label: mini.label, done: mini.prog >= mini.target }
    ],
    hint: 'โฟกัสอาหารดีจากทุกหมู่ เลี่ยงของหวาน/ของทอด'
  });

  if (goal.prog === GOAL_TARGET) {
    dispatch('quest:celebrate', {
      kind: 'goal',
      index: 1,
      total: 1
    });
  }

  if (mini.prog === MINI_TARGET) {
    dispatch('quest:celebrate', {
      kind: 'mini',
      index: 1,
      total: 1
    });
  }

  if (goal.prog >= GOAL_TARGET && mini.prog >= MINI_TARGET) {
    dispatch('quest:all-complete', {
      goalsTotal: 1,
      minisTotal: 1
    });
  }
}

// ---------- Target spawn / remove ----------
function spawnOne() {
  if (!running) return;
  const root = ensureRoot();
  if (!root) return;

  const active = root.querySelectorAll('[data-hha-tgt]').length;
  if (active >= MAX_ACTIVE) return;

  const food = FOODS[Math.floor(Math.random() * FOODS.length)];
  const pos  = randomTargetPosition();

  const el = document.createElement('a-entity');
  el.setAttribute('data-hha-tgt', '1');
  el.setAttribute('geometry', 'primitive: circle; radius: 0.45');
  el.setAttribute('material', 'shader: flat; color: #22c55e; opacity: 0.97; side: double');
  el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  el.setAttribute('rotation', '0 0 0');

  // ---------- ใส่ EMOJI ตรงกลางเป้า ----------
  // NOTE: ต้องเป็น string ไม่ใช่ object ไม่งั้น A-Frame จะได้ "[object Object]"
  el.setAttribute(
    'text',
    `value: ${food.emoji}; align: center; color: #111827; width: 4; zOffset: 0.01;`
  );

  // สีแบ่งตาม good / junk
  if (!food.good) {
    el.setAttribute('material', 'shader: flat; color: #f97316; opacity: 0.97; side: double');
  }

  el.dataset.group = food.group;
  el.dataset.good  = food.good ? '1' : '0';

  let resolved = false;

  function hit(ev) {
    if (!running || resolved) return;
    resolved = true;

    const isGood = el.dataset.good === '1';
    const isVegFood = el.dataset.group === 'veg';

    if (isGood) {
      combo += 1;
      if (combo > comboMax) comboMax = combo;

      score += 50;
      if (combo >= 5)  score += 10;
      if (combo >= 10) score += 20;

      goodCount += 1;
      if (isVegFood) vegCount += 1;

      fever = clamp(fever + 8, 0, FEVER_MAX);

      const label = combo >= 10 ? 'PERFECT'
                  : combo >= 5  ? 'GREAT'
                  : 'GOOD';

      dispatch('hha:score', {
        score,
        combo,
        comboMax,
        misses,
        fever,
        label
      });
      dispatch('hha:judge', { label });

      updateQuestProgress();

    } else {
      // กดของไม่ดี นับเป็น MISS
      combo = 0;
      misses += 1;
      fever = clamp(fever - 10, 0, FEVER_MAX);

      dispatch('hha:score', {
        score,
        combo,
        comboMax,
        misses,
        fever,
        label: 'MISS'
      });
      dispatch('hha:miss', {});
      dispatch('hha:judge', { label: 'MISS' });
    }

    // effect เป้าแตก / คะแนนเด้ง ถ้ามี HHAFX (particles.js)
    try {
      if (window.HHAFX && typeof window.HHAFX.burstAt === 'function') {
        window.HHAFX.burstAt(ev);
      }
      if (window.HHAFX && typeof window.HHAFX.floatScore === 'function') {
        const bonus = isGood
          ? (combo >= 10 ? '+80' : combo >= 5 ? '+60' : '+50')
          : '-';
        window.HHAFX.floatScore(ev, bonus, isGood ? 'good' : 'bad');
      }
    } catch (err) {
      // ไม่เป็นไร ปล่อยผ่าน
    }

    removeTarget(el);
  }

  function miss() {
    if (!running || resolved) return;
    resolved = true;

    combo = 0;
    misses += 1;
    fever = clamp(fever - 5, 0, FEVER_MAX);

    dispatch('hha:score', {
      score,
      combo,
      comboMax,
      misses,
      fever,
      label: 'MISS'
    });
    dispatch('hha:miss', {});
    dispatch('hha:judge', { label: 'MISS' });

    removeTarget(el);
  }

  // รองรับทั้ง click จาก mouse และ VR controller
  el.addEventListener('click', hit);
  el.addEventListener('mousedown', hit);

  root.appendChild(el);
  setTimeout(miss, TARGET_LIFETIME);
}

// ---------- Public API ----------
function start(diff = 'normal') {
  if (!A) return;
  if (running) stop('restart');

  sceneEl = document.querySelector('a-scene');
  if (!sceneEl) {
    console.error('[GroupsVR] a-scene not found');
    return;
  }

  running = true;
  score = 0;
  combo = 0;
  comboMax = 0;
  misses = 0;
  fever = 0;
  goodCount = 0;
  vegCount  = 0;

  dispatch('hha:score', { score, combo, comboMax, misses, fever, label: '' });
  dispatch('hha:judge', { label: '' });
  updateQuestProgress();

  // โค้ชตอนเริ่ม
  dispatch('hha:coach', {
    text: 'เลือกอาหารจากทุกหมู่ให้สมดุล อย่าลืมผัก ผลไม้ และนมด้วยนะ 🥦🍎🥛'
  });

  const root = ensureRoot();
  if (root) {
    root.querySelectorAll('[data-hha-tgt]').forEach(el => el.parentEl && el.parentEl.removeChild(el));
  }

  const interval = SPAWN_INTERVAL_NORMAL; // ตอนนี้ยังไม่แยก diff
  spawnTimer = setInterval(spawnOne, interval);
}

function stop(reason = 'manual') {
  running = false;
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = null;
  }

  const root = ensureRoot();
  if (root) {
    root.querySelectorAll('[data-hha-tgt]').forEach(el => el.parentEl && el.parentEl.removeChild(el));
  }

  dispatch('hha:end', {
    reason,
    scoreFinal: score,
    comboMax,
    misses,
    goalsCleared: (goodCount >= GOAL_TARGET) ? 1 : 0,
    goalsTotal: 1,
    miniCleared: (vegCount >= MINI_TARGET) ? 1 : 0,
    miniTotal: 1
  });
}

// ---------- Export ----------
export const GameEngine = {
  start,
  stop
};

window.HeroHealthGroupsVR = window.HeroHealthGroupsVR || {};
window.HeroHealthGroupsVR.GameEngine = GameEngine;
