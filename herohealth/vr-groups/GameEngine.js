// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — DOM targets + Goal / Mini quest + Fever + FX
// ใช้ร่วมกับ groups-vr.html (Boot script เรียก GameEngine.start/stop())

'use strict';

import '../vr/particles.js';   // ให้แน่ใจว่า HHA_PARTICLES ถูกผูก global แล้ว
import '../vr/ui-fever.js';   // FeverUI global

// ----------------- Helper global -----------------
const Particles =
  (window.HHA_PARTICLES) ||
  (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
  { scorePop () {}, burstAt () {} };

const FeverUI =
  (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
  window.FeverUI ||
  { ensureFeverBar () {}, setFever () {}, setFeverActive () {}, setShield () {} };

// safe customEvent
function emit (name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// ------------- Difficulty & Quest config -------------
const DIFF_TABLE = {
  easy: {
    spawnInterval: 1100,
    targetLifetime: 2800,
    maxActive: 3,
    sizeFactor: 1.18,
    goalScore: 260,
    miniGood: 24,
    labelGoal: 'จำแนกอาหารดีจากหมู่ที่กำหนดให้ได้ตามเป้า',
    labelMini: 'เก็บอาหารดีให้ครบจำนวน เลี่ยงของขยะให้ได้มากที่สุด',
    hint: 'โฟกัสอาหารดีจากทุกหมู่ก่อน แล้วค่อยเลี่ยงของขยะ'
  },
  normal: {
    spawnInterval: 900,
    targetLifetime: 2500,
    maxActive: 4,
    sizeFactor: 1.0,
    goalScore: 320,
    miniGood: 28,
    labelGoal: 'จัดหมู่อาหารดีให้ครบทุกหมู่ตามเป้าคะแนน',
    labelMini: 'เก็บอาหารดีต่อเนื่องให้ได้มากที่สุด',
    hint: 'พยายามยิงคอมโบยาว ๆ ด้วยอาหารดีหลาย ๆ ชิ้นติดกัน'
  },
  hard: {
    spawnInterval: 750,
    targetLifetime: 2300,
    maxActive: 5,
    sizeFactor: 0.92,
    goalScore: 380,
    miniGood: 32,
    labelGoal: 'จัดหมู่อาหารดีให้ครบทุกหมู่ในเวลาจำกัด',
    labelMini: 'รักษาคอมโบสูง ๆ โดยไม่พลาดของขยะ',
    hint: 'ใช้ FEVER เก็บอาหารดีรวดเดียวให้ได้มากที่สุด'
  }
};

const GOOD_EMOJI = ['🍚', '🍞', '🍎', '🥦', '🥕', '🍌', '🥛', '🍇', '🥚'];
const JUNK_EMOJI = ['🍩', '🍕', '🍟', '🥤', '🍰', '🍫', '🍭', '🧃'];

function pickEmoji (isGood) {
  // ถ้ามี emoji-image ของโครงการก็ใช้แทน
  if (window.emojiImage && typeof window.emojiImage.pick === 'function') {
    return window.emojiImage.pick(isGood ? 'good' : 'junk');
  }
  const src = isGood ? GOOD_EMOJI : JUNK_EMOJI;
  return src[Math.floor(Math.random() * src.length)];
}

// ให้เป้าเกิดในโซนที่ไม่ทับ HUD บน / โค้ชล่าง
function randomScreenPos () {
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;

  const topSafe = 130;
  const bottomSafe = 170;

  const left = w * 0.14;
  const right = w * 0.86;

  const x = left + Math.random() * (right - left);
  const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
  return { x, y };
}

// ----------------- Engine state -----------------
let running = false;
let diffKey = 'normal';
let diffCfg = DIFF_TABLE.normal;

let layer = null;
let targets = [];
let lastTs = 0;
let elapsed = 0;
let spawnTimer = 0;

// score / quest
let score = 0;
let combo = 0;
let comboMax = 0;
let misses = 0;
let goodHits = 0;

let goalTargetScore = 0;
let miniTargetGood = 0;
let goalLabel = '';
let miniLabel = '';
let questHint = '';

let goalDone = false;
let miniDone = false;

// fever
const FEVER_MAX = 100;
const FEVER_HIT_GAIN = 10;
const FEVER_MISS_LOSS = 25;
let fever = 0;
let feverActive = false;

// ----------------- DOM helpers -----------------
function ensureLayer () {
  if (layer && layer.isConnected) return layer;
  layer = document.getElementById('fg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fg-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function clearTargets () {
  targets.forEach(t => {
    if (t && t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  });
  targets = [];
}

// ----------------- Fever -----------------
function updateFever (delta) {
  fever = (fever || 0) + delta;
  if (fever < 0) fever = 0;
  if (fever > FEVER_MAX) fever = FEVER_MAX;

  FeverUI.ensureFeverBar();
  FeverUI.setFever(fever);

  const nowActive = fever >= FEVER_MAX;
  if (nowActive && !feverActive) {
    feverActive = true;
    FeverUI.setFeverActive(true);
    emit('hha:fever', { state: 'start' });
  } else if (!nowActive && feverActive && fever <= FEVER_MAX * 0.4) {
    feverActive = false;
    FeverUI.setFeverActive(false);
    emit('hha:fever', { state: 'end' });
  }
}

// ----------------- Quest / HUD event -----------------
function emitScore () {
  emit('hha:score', { score, combo, misses });
}

function emitJudge (label) {
  emit('hha:judge', { label });
}

function emitQuestUpdate () {
  const goal = {
    label: goalLabel,
    prog: score,
    target: goalTargetScore,
    done: goalDone
  };
  const mini = {
    label: miniLabel,
    prog: goodHits,
    target: miniTargetGood,
    done: miniDone
  };
  emit('quest:update', { goal, mini, hint: questHint });
}

// ----------------- Target spawn / life -----------------
function spawnTarget () {
  const host = ensureLayer();
  if (!host) return;
  if (targets.length >= diffCfg.maxActive) return;

  const isGood = Math.random() < 0.65; // 65% อาหารดี
  const emoji = pickEmoji(isGood);
  const pos = randomScreenPos();
  const lifeMs = diffCfg.targetLifetime || 2500;

  const el = document.createElement('div');
  el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
  el.setAttribute('data-emoji', emoji);
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  const baseScale = diffCfg.sizeFactor || 1.0;
  el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

  const target = {
    el,
    isGood,
    spawnAt: elapsed,
    lifeMs,
    consumed: false
  };
  targets.push(target);

  const onHit = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    handleHit(target);
  };

  el.addEventListener('click', onHit);
  el.addEventListener('pointerdown', onHit);

  host.appendChild(el);
}

function handleTimeout (target) {
  if (!running || !target || target.consumed) return;

  target.consumed = true;
  misses += 1;
  combo = 0;
  updateFever(-FEVER_MISS_LOSS);
  emit('hha:miss', { reason: 'timeout', isGood: target.isGood });
  emitScore();

  // FX
  try {
    const el = target.el;
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      Particles.scorePop(x, y, 'MISS 0', { good: false });
      Particles.burstAt(x, y, { color: '#f97316', count: 10, radius: 50 });
    }
  } catch (_) {}

  if (target.el && target.el.parentNode) {
    target.el.classList.add('hit');
    setTimeout(() => {
      if (target.el && target.el.parentNode) target.el.parentNode.removeChild(target.el);
    }, 120);
  }

  targets = targets.filter(t => t !== target);
  emitJudge('');
}

// ----------------- Hit logic -----------------
function handleHit (target) {
  if (!running || !target || target.consumed) return;

  const el = target.el;
  if (!el || !el.parentNode) return;

  target.consumed = true;

  const life = target.lifeMs || diffCfg.targetLifetime || 2500;
  const age = Math.max(0, elapsed - target.spawnAt);
  const ratio = Math.min(1, age / life);

  let judgment = 'MISS';
  let delta = 0;

  if (target.isGood) {
    if (ratio <= 0.35) {
      judgment = 'PERFECT';
      delta = 20;
    } else if (ratio <= 0.8) {
      judgment = 'GOOD';
      delta = 12;
    } else {
      judgment = 'LATE';
      delta = 6;
    }

    goodHits += 1;
    combo += 1;
    comboMax = Math.max(comboMax, combo);
    updateFever(FEVER_HIT_GAIN + (judgment === 'PERFECT' ? 5 : 0));
  } else {
    // ตีโดนขยะ = MISS
    judgment = 'MISS';
    delta = -10;
    misses += 1;
    combo = 0;
    updateFever(-FEVER_MISS_LOSS);
    emit('hha:miss', { reason: 'hit-junk', isGood: false });
  }

  score = Math.max(0, score + delta);

  // Quest progress + check done
  goalDone = score >= goalTargetScore;
  miniDone = goodHits >= miniTargetGood;
  emitQuestUpdate();

  // HUD
  emitScore();
  emitJudge(`${judgment} ${delta > 0 ? '+' + delta : delta}`);

  // FX
  try {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const label = `${judgment} ${delta > 0 ? '+' + delta : delta}`;
    Particles.scorePop(x, y, label, { good: delta > 0 });
    Particles.burstAt(x, y, {
      color: delta > 0 ? '#22c55e' : '#f97316',
      count: delta > 0 ? 16 : 12,
      radius: 60
    });
  } catch (_) {}

  // remove DOM
  el.classList.add('hit');
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 140);

  targets = targets.filter(t => t !== target);

  // ถ้าเคลียร์ทั้ง Goal + Mini ให้จบเกมเลย (boot script จะมองจาก hha:end ด้วย)
  if (goalDone && miniDone) {
    stop('quest-complete');
  }
}

// ----------------- Main loop -----------------
function loop (ts) {
  if (!running) return;

  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;
  elapsed += dt;
  spawnTimer += dt;

  // spawn
  if (spawnTimer >= diffCfg.spawnInterval) {
    spawnTimer = 0;
    spawnTarget();
  }

  // timeout check
  const lifeMs = diffCfg.targetLifetime || 2500;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (!t || t.consumed) continue;
    if (elapsed - t.spawnAt >= (t.lifeMs || lifeMs)) {
      handleTimeout(t);
    }
  }

  requestAnimationFrame(loop);
}

// ----------------- Public API -----------------
function start (diff = 'normal') {
  diffKey = String(diff || 'normal').toLowerCase();
  diffCfg = DIFF_TABLE[diffKey] || DIFF_TABLE.normal;

  ensureLayer();
  clearTargets();

  running = true;
  lastTs = 0;
  elapsed = 0;
  spawnTimer = 0;

  score = 0;
  combo = 0;
  comboMax = 0;
  misses = 0;
  goodHits = 0;

  goalTargetScore = diffCfg.goalScore;
  miniTargetGood = diffCfg.miniGood;
  goalLabel = diffCfg.labelGoal;
  miniLabel = diffCfg.labelMini;
  questHint = diffCfg.hint;
  goalDone = false;
  miniDone = false;

  fever = 0;
  feverActive = false;
  FeverUI.ensureFeverBar();
  FeverUI.setFever(0);
  FeverUI.setFeverActive(false);
  FeverUI.setShield(0);

  emitScore();
  emitQuestUpdate();
  emitJudge('');

  requestAnimationFrame(loop);
}

function stop (reason = 'stop') {
  if (!running) return;
  running = false;
  clearTargets();

  emit('hha:end', {
    mode: 'FoodGroupsVR',
    diff: diffKey,
    scoreFinal: score,
    score,
    comboMax,
    misses,
    goalsCleared: goalDone ? 1 : 0,
    goalsTotal: 1,
    miniCleared: miniDone ? 1 : 0,
    miniTotal: 1,
    reason
  });
}

// export object ให้ groups-vr.html import { GameEngine } ใช้ได้
export const GameEngine = { start, stop };

// เผื่ออยากเรียกจาก global ด้วย
window.GAME_MODULES = window.GAME_MODULES || {};
window.GAME_MODULES.FoodGroupsVR = { GameEngine };
