// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Game Engine (Play + Research)
// - โหมดธรรมดา: เป้าขนาดตาม diff + adaptive ตามฝีมือ + Goal/Mini สุ่ม
// - โหมดวิจัย: เป้าขนาด fix ตาม diff (ไม่ adaptive) + Goal 2 / Mini 3 fixed ทุกเกม
// - ส่ง hha:stat, quest:update, hha:end, hha:event, hha:session ให้ logger + HUD
// - มี Fever gauge + Shield + FX ตีเป้าแตก + quest celebrate ครบ

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ---------- Modules จาก IIFE (ui-fever.js / particles.js) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt () {}, scorePop () {}, floatScore () {} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  { ensureBar () {}, setFever () {}, setFeverActive () {}, setShield () {} };

// ---------- Utils ----------
function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function randRange (min, max) {
  return min + Math.random() * (max - min);
}
function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = (Math.random() * arr.length) | 0;
  return arr[i];
}
function uid () {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Diff / Difficulty ----------
const BASE_DIFF = {
  easy: {
    spawnInterval: 950,   // ms
    maxActive: 3,
    sizeScale: 1.2,       // ขนาดเป้าใหญ่สุด
    goodRatio: 0.80,
    baseLife: 2100        // อายุเป้า
  },
  normal: {
    spawnInterval: 800,
    maxActive: 4,
    sizeScale: 1.0,
    goodRatio: 0.70,
    baseLife: 1900
  },
  hard: {
    spawnInterval: 650,
    maxActive: 5,
    sizeScale: 0.85,
    goodRatio: 0.60,
    baseLife: 1700
  }
};

// ---------- Food Pools ----------
const GROUPS = [
  { id: 1, label: 'ข้าว-แป้ง',   emojis: ['🍚', '🍞', '🥖', '🍜', '🥐'] },
  { id: 2, label: 'โปรตีน',      emojis: ['🍗', '🥩', '🍤', '🥚', '🫘'] },
  { id: 3, label: 'ผัก',         emojis: ['🥦', '🥕', '🥬', '🍅', '🌽'] },
  { id: 4, label: 'ผลไม้',       emojis: ['🍎', '🍌', '🍊', '🍇', '🍉'] },
  { id: 5, label: 'นม/ผลิตภัณฑ์', emojis: ['🥛', '🧀', '🍨', '🍦'] }
];

const JUNK_POOL = [
  '🍩','🧁','🍫','🍟','🍕','🧋','🥤','🍬'
];

const STAR_POOL   = ['⭐','🌟'];
const SHIELD_POOL = ['🛡️'];

// ---------- Quest Pools ----------
// metric:
//   'plates'          → จานสมดุลเสิร์ฟสำเร็จ
//   'vegFruitTotal'   → ผัก+ผลไม้รวม
//   'group3'          → ผัก
//   'group4'          → ผลไม้
//   'group5'          → นม
//   'comboMax'        → combo สูงสุด

const FIXED_GOALS_RESEARCH = [
  {
    key: 'G1',
    kind: 'goal',
    metric: 'plates',
    target: 3,
    label: 'จัดจานสมดุลให้ครบ 3 จาน'
  },
  {
    key: 'G2',
    kind: 'goal',
    metric: 'vegFruitTotal',
    target: 14,
    label: 'เก็บผัก+ผลไม้รวม 14 ชิ้น'
  }
];

const FIXED_MINIS_RESEARCH = [
  {
    key: 'M1',
    kind: 'mini',
    metric: 'group3',
    target: 8,
    label: 'สะสมหมู่ผัก (หมู่ 3) ให้ครบ 8 ชิ้น'
  },
  {
    key: 'M2',
    kind: 'mini',
    metric: 'group4',
    target: 6,
    label: 'สะสมหมู่ผลไม้ (หมู่ 4) ให้ครบ 6 ชิ้น'
  },
  {
    key: 'M3',
    kind: 'mini',
    metric: 'group5',
    target: 4,
    label: 'สะสมนม/ผลิตภัณฑ์ (หมู่ 5) ให้ครบ 4 ชิ้น'
  }
];

// สำหรับโหมดเล่นธรรมดา: สุ่ม 2 goal + 3 mini จาก pool นี้
const GOAL_POOL_PLAY = [
  {
    key: 'PG1',
    kind: 'goal',
    metric: 'plates',
    target: 3,
    label: 'จัดจานสมดุลให้ครบ 3 จาน'
  },
  {
    key: 'PG2',
    kind: 'goal',
    metric: 'plates',
    target: 4,
    label: 'จัดจานสมดุลให้ครบ 4 จาน'
  },
  {
    key: 'PG3',
    kind: 'goal',
    metric: 'vegFruitTotal',
    target: 16,
    label: 'เก็บผัก+ผลไม้รวม 16 ชิ้น'
  }
];

const MINI_POOL_PLAY = [
  {
    key: 'PM1',
    kind: 'mini',
    metric: 'group3',
    target: 8,
    label: 'สะสมผักอย่างน้อย 8 ชิ้น'
  },
  {
    key: 'PM2',
    kind: 'mini',
    metric: 'group4',
    target: 6,
    label: 'สะสมผลไม้อย่างน้อย 6 ชิ้น'
  },
  {
    key: 'PM3',
    kind: 'mini',
    metric: 'group5',
    target: 4,
    label: 'ส่วนนม/ผลิตภัณฑ์นมอย่างน้อย 4 ชิ้น'
  },
  {
    key: 'PM4',
    kind: 'mini',
    metric: 'comboMax',
    target: 10,
    label: 'ทำคอมโบให้ได้อย่างน้อย 10 ครั้งติดกัน'
  }
];

// ---------- Global state ----------
let RUN_MODE = 'play'; // play | research
let DIFF_KEY = 'normal';

let sessionId = '';
let startTimeMs = 0;
let startTimeIso = '';
let endTimeIso   = '';
let plannedDurationSec = 60;

let running = false;
let ended   = false;

let score   = 0;
let combo   = 0;
let comboMax = 0;
let misses  = 0;

let platesDone = 0;
let curPlateCounts = [0,0,0,0,0];  // ต่อจานปัจจุบัน
let totalCounts    = [0,0,0,0,0];  // รวมทั้งเกม

let junkHits = 0;

let feverValue  = 0;
let feverActive = false;
let shieldCount = 0;

let activeTargets = new Map(); // id → meta
let spawnTimer = null;

let spawnBaseConf = BASE_DIFF.normal;
let spawnIntervalMs = 800;
let spawnSizeScale  = 1.0;
let spawnGoodRatio  = 0.7;
let spawnLifeMs     = 1900;
let maxActiveTargets = 4;

// adaptive (ใช้เฉพาะ play)
let adaptiveEnabled = true;

// quests
let goalsAll = [];
let minisAll = [];
let currentGoal = null;
let currentMini = null;

// summary stats สำหรับ logger
let nSpawnGood = 0;
let nSpawnJunk = 0;
let nSpawnStar = 0;
let nSpawnShield = 0;

let nHitGood = 0;
let nHitJunk = 0;
let nExpireGood = 0;

// ---------- Quest helpers ----------
function shuffleArray (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function buildQuests () {
  if (RUN_MODE === 'research') {
    goalsAll = FIXED_GOALS_RESEARCH.map(q => Object.assign({ prog:0, done:false }, q));
    minisAll = FIXED_MINIS_RESEARCH.map(q => Object.assign({ prog:0, done:false }, q));
  } else {
    const gShuffled = shuffleArray(GOAL_POOL_PLAY);
    const mShuffled = shuffleArray(MINI_POOL_PLAY);
    goalsAll = gShuffled.slice(0, 2).map(q => Object.assign({ prog:0, done:false }, q));
    minisAll = mShuffled.slice(0, 3).map(q => Object.assign({ prog:0, done:false }, q));
  }
  currentGoal = goalsAll[0] || null;
  currentMini = minisAll[0] || null;
  recalcQuestProgress(true);
}

function computeMetric (metric) {
  switch (metric) {
    case 'plates':
      return platesDone;
    case 'vegFruitTotal':
      return (totalCounts[2] || 0) + (totalCounts[3] || 0);
    case 'group3':
      return totalCounts[2] || 0;
    case 'group4':
      return totalCounts[3] || 0;
    case 'group5':
      return totalCounts[4] || 0;
    case 'comboMax':
      return comboMax;
    default:
      return 0;
  }
}

function buildQuestHint (goal, mini) {
  if (!goal && !mini) return '';
  if (goal && goal.metric === 'plates') {
    const left = clamp(goal.target - platesDone, 0, goal.target);
    if (left > 0) return `เหลืออีก ${left} จานสมดุล ✨`;
  }
  if (goal && goal.metric === 'vegFruitTotal') {
    const cur = computeMetric('vegFruitTotal');
    const left = clamp(goal.target - cur, 0, goal.target);
    if (left > 0) return `เก็บผัก+ผลไม้เพิ่มอีก ${left} ชิ้น 🥦🍎`;
  }
  if (mini && mini.metric === 'comboMax') {
    if (comboMax < mini.target) {
      return `ลองไล่คอมโบให้ถึง ${mini.target} ดูนะ 🔥`;
    }
  }
  return '';
}

function recalcQuestProgress (initial = false) {
  const all = goalsAll.concat(minisAll);
  all.forEach(q => {
    const v = computeMetric(q.metric);
    q.prog = clamp(v, 0, q.target);
    if (q.prog >= q.target) q.done = true;
  });

  const prevGoal = currentGoal;
  const prevMini = currentMini;

  currentGoal = goalsAll.find(q => !q.done) || null;
  currentMini = minisAll.find(q => !q.done) || null;

  const hint = buildQuestHint(currentGoal, currentMini);

  // ส่งให้ HUD
  ROOT.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: currentGoal ? {
        key: currentGoal.key,
        label: currentGoal.label,
        prog: currentGoal.prog,
        target: currentGoal.target
      } : null,
      mini: currentMini ? {
        key: currentMini.key,
        label: currentMini.label,
        prog: currentMini.prog,
        target: currentMini.target
      } : null,
      goalsAll: goalsAll.map(q => ({
        key: q.key, label: q.label, prog: q.prog, target: q.target, done: q.done
      })),
      minisAll: minisAll.map(q => ({
        key: q.key, label: q.label, prog: q.prog, target: q.target, done: q.done
      })),
      hint
    }
  }));

  // celebrate ต่อ goal/mini (HUD ฝั่ง plate-vr จะยิง FX เองตาม quest:update)
  if (!initial) {
    const goalsCleared = goalsAll.filter(q => q.done).length;
    const minisCleared = minisAll.filter(q => q.done).length;
    ROOT.dispatchEvent(new CustomEvent('hha:stat', {
      detail: {
        score,
        combo,
        misses,
        platesDone,
        totalCounts: totalCounts.slice(),
        goalsCleared,
        goalsTotal: goalsAll.length,
        miniCleared: minisCleared,
        miniTotal: minisAll.length
      }
    }));
  }
}

// ---------- Fever ----------
function setFeverValue (v) {
  feverValue = clamp(v, 0, 100);
  FeverUI.setFever(feverValue);
}
function addFever (delta) {
  if (!delta) return;
  setFeverValue(feverValue + delta);
  if (!feverActive && feverValue >= 100) {
    feverActive = true;
    FeverUI.setFeverActive(true);
    ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'start' }}));
  }
}
function decayFeverLoop () {
  if (!running) return;
  if (!feverActive) {
    // ก็ค่อย ๆ ลดลงนิด ๆ
    if (feverValue > 0) setFeverValue(feverValue - 0.3);
  } else {
    setFeverValue(feverValue - 1.2);
    if (feverValue <= 0) {
      feverActive = false;
      FeverUI.setFeverActive(false);
      ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'end' }}));
    }
  }
  ROOT.requestAnimationFrame(decayFeverLoop);
}

// ---------- Stat dispatch ----------
function dispatchStat () {
  const goalsCleared = goalsAll.filter(q => q.done).length;
  const minisCleared = minisAll.filter(q => q.done).length;

  ROOT.dispatchEvent(new CustomEvent('hha:stat', {
    detail: {
      score,
      combo,
      misses,
      platesDone,
      totalCounts: totalCounts.slice(),
      goalsCleared,
      goalsTotal: goalsAll.length,
      miniCleared: minisCleared,
      miniTotal: minisAll.length
    }
  }));
}

// ---------- Adaptive difficulty (เฉพาะ play) ----------
function getElapsedSec () {
  if (!startTimeMs) return 0;
  return (performance.now() - startTimeMs) / 1000;
}

function applyAdaptive () {
  if (!adaptiveEnabled) return;
  const elapsed = getElapsedSec();
  const total   = plannedDurationSec || 60;
  const t = clamp(elapsed / total, 0, 1);

  // base
  let interval = spawnBaseConf.spawnInterval;
  let goodRatio = spawnBaseConf.goodRatio;
  let sizeScale = spawnBaseConf.sizeScale;

  // phase: warmup (0–0.2), main (0.2–0.75), clutch (0.75–1)
  if (t < 0.2) {
    interval *= 1.08; // ช่วงวอร์มอัปช้าหน่อย
    goodRatio += 0.05;
  } else if (t > 0.75) {
    interval *= 0.9;  // ท้ายเกมเร่งความถี่
    // ถ้า grade ดูเหมือนต่ำ (ประมาณจากคะแนน)
    if (score < 400) {
      goodRatio += 0.05;
    }
  }

  // ปรับตาม performance
  if (comboMax >= 12 && misses <= 2) {
    interval *= 0.9;
    sizeScale *= 0.93;
  } else if (misses >= 8) {
    interval *= 1.1;
    sizeScale *= 1.05;
    goodRatio += 0.05;
  }

  // clamp
  interval = clamp(interval, spawnBaseConf.spawnInterval * 0.7, spawnBaseConf.spawnInterval * 1.3);
  sizeScale = clamp(sizeScale, spawnBaseConf.sizeScale * 0.8, spawnBaseConf.sizeScale * 1.25);
  goodRatio = clamp(goodRatio, 0.45, 0.9);

  spawnIntervalMs = interval;
  spawnSizeScale  = sizeScale;
  spawnGoodRatio  = goodRatio;
}

// ---------- Targets ----------
let targetIdSeq = 1;

function createTargetElement (meta) {
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = 'hha-target ' + (meta.kind === 'good' ? 'hha-target-good' : 'hha-target-bad');
  el.textContent = meta.emoji;
  el.dataset.id   = String(meta.id);
  el.dataset.kind = meta.kind;
  el.dataset.group = meta.groupId != null ? String(meta.groupId) : '';

  // ขนาดตาม diff + adaptive (เฉพาะ play)
  const baseSize = 68;
  const size = baseSize * spawnSizeScale;
  el.style.width  = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = (size * 0.62) + 'px';

  // random position (ให้เน้นช่วงกลางจอ)
  const vw = ROOT.innerWidth || 800;
  const vh = ROOT.innerHeight || 600;
  const x = randRange(0.16, 0.84);
  const y = randRange(0.24, 0.78);

  el.style.position = 'absolute';
  el.style.left = (x * 100) + '%';
  el.style.top  = (y * 100) + '%';
  el.style.transform = 'translate(-50%, -50%)';

  el.addEventListener('click', onTargetClick, { passive: true });

  DOC.body.appendChild(el);
  return el;
}

function removeTarget (id) {
  const meta = activeTargets.get(id);
  if (!meta) return;
  if (meta.lifeTimer) {
    clearTimeout(meta.lifeTimer);
    meta.lifeTimer = null;
  }
  if (meta.el && meta.el.parentNode) {
    meta.el.parentNode.removeChild(meta.el);
  }
  activeTargets.delete(id);
}

function onTargetClick (ev) {
  if (!running) return;
  const el = ev.currentTarget || ev.target;
  const id = parseInt(el.dataset.id || '0', 10) || 0;
  const meta = activeTargets.get(id);
  if (!meta || meta.hit) return;

  meta.hit = true;
  removeTarget(id);

  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  const now = performance.now();
  const rtMs = now - meta.spawnTimeMs;

  if (meta.kind === 'good' || meta.kind === 'special-good') {
    handleGoodHit(meta, cx, cy, rtMs);
  } else if (meta.kind === 'junk') {
    handleJunkHit(meta, cx, cy, rtMs);
  } else if (meta.kind === 'star') {
    handleStarHit(meta, cx, cy, rtMs);
  } else if (meta.kind === 'shield') {
    handleShieldHit(meta, cx, cy, rtMs);
  }
}

function handleGoodHit (meta, cx, cy, rtMs) {
  nHitGood++;
  combo += 1;
  if (combo > comboMax) comboMax = combo;

  let gain = feverActive ? 40 : 30;
  if (meta.groupId === 3 || meta.groupId === 4) {
    gain += 5; // ผัก/ผลไม้ให้คะแนนดี
  }

  score += gain;

  // update plate counts
  if (meta.groupId != null && meta.groupId >= 1 && meta.groupId <= 5) {
    const idx = meta.groupId - 1;
    curPlateCounts[idx]  = (curPlateCounts[idx] || 0) + 1;
    totalCounts[idx]     = (totalCounts[idx] || 0) + 1;
  }

  // FX
  if (Particles.burstAt) {
    Particles.burstAt(cx, cy, {
      color: meta.groupId >= 3 ? '#22c55e' : '#38bdf8',
      count: feverActive ? 20 : 12
    });
  }
  if (Particles.scorePop) {
    const label = (combo >= 12)
      ? 'PERFECT!'
      : (combo >= 6 ? 'GREAT!' : 'GOOD!');
    Particles.scorePop(cx, cy, '+' + gain, {
      judgment: label,
      good: true
    });
  }

  // Fever gain
  addFever(feverActive ? 6 : 9);

  // check plate completed (ครบ 5 หมู่ในจานปัจจุบัน)
  const plateDoneNow = curPlateCounts.every(c => c > 0);
  if (plateDoneNow) {
    platesDone += 1;
    curPlateCounts = [0,0,0,0,0];

    // celebrate plate
    if (Particles.burstAt) {
      Particles.burstAt(cx, cy * 0.7, {
        color: '#facc15',
        count: 24
      });
    }
    if (Particles.scorePop) {
      Particles.scorePop(cx, cy * 0.7, 'BALANCED PLATE!', {
        judgment: 'จานสมดุล +' + 60,
        good: true
      });
    }
    score += 60;

    ROOT.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text: 'เยี่ยมมาก! ได้จานสมดุลเพิ่มอีก 1 จานแล้ว 🍽️' }
    }));
  }

  // adaptive (play only)
  applyAdaptive();

  // quest progress + stat
  recalcQuestProgress();
  dispatchStat();

  // log event
  logGameEvent({
    type: 'hit-good',
    itemType: 'good',
    groupId: meta.groupId,
    emoji: meta.emoji,
    rtMs,
    totalScore: score,
    combo
  });
}

function handleJunkHit (meta, cx, cy, rtMs) {
  junkHits++;
  misses += 1;
  combo = 0;

  score -= 10;
  if (score < 0) score = 0;

  if (Particles.burstAt) {
    Particles.burstAt(cx, cy, {
      color: '#f97316',
      count: 16
    });
  }
  if (Particles.scorePop) {
    Particles.scorePop(cx, cy, '-10', {
      judgment: 'JUNK!',
      good: false
    });
  }

  ROOT.dispatchEvent(new CustomEvent('hha:miss', {
    detail: { reason: 'hit-junk' }
  }));

  applyAdaptive();
  recalcQuestProgress();
  dispatchStat();

  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: {
      text: 'ของหวาน/ของทอดมาแทรกแล้ว ลองเลี่ยงให้ได้ในจานถัดไปนะ ⚠️'
    }
  }));

  logGameEvent({
    type: 'hit-junk',
    itemType: 'junk',
    emoji: meta.emoji,
    rtMs,
    totalScore: score,
    combo
  });
}

function handleStarHit (meta, cx, cy, rtMs) {
  // treat as good super bonus
  nHitGood++;
  combo += 1;
  if (combo > comboMax) comboMax = combo;

  const gain = 80;
  score += gain;

  if (Particles.burstAt) {
    Particles.burstAt(cx, cy, { color: '#facc15', count: 28 });
  }
  if (Particles.scorePop) {
    Particles.scorePop(cx, cy, '+'+gain, {
      judgment: 'BONUS STAR!',
      good: true
    });
  }

  addFever(20);
  applyAdaptive();
  recalcQuestProgress();
  dispatchStat();

  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: { text: 'เก็บดาวโบนัสได้แล้ว! คะแนนพุ่งเลย ⭐' }
  }));

  logGameEvent({
    type: 'hit-star',
    itemType: 'star',
    emoji: meta.emoji,
    rtMs,
    totalScore: score,
    combo
  });
}

function handleShieldHit (meta, cx, cy, rtMs) {
  if (shieldCount < 3) {
    shieldCount += 1;
    FeverUI.setShield(shieldCount);
  }

  if (Particles.burstAt) {
    Particles.burstAt(cx, cy, { color: '#38bdf8', count: 18 });
  }
  if (Particles.scorePop) {
    Particles.scorePop(cx, cy, 'SHIELD', {
      judgment: 'GUARD READY',
      good: true
    });
  }

  dispatchStat();

  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: { text: 'ได้โล่เพิ่มแล้ว! ถ้าเผลอกด junk โล่จะช่วยกันไว้ 🛡️' }
  }));

  logGameEvent({
    type: 'hit-shield',
    itemType: 'shield',
    emoji: meta.emoji,
    rtMs,
    totalScore: score,
    combo
  });
}

function expireTarget (id) {
  const meta = activeTargets.get(id);
  if (!meta || meta.hit) {
    removeTarget(id);
    return;
  }
  removeTarget(id);

  if (meta.kind === 'good' || meta.kind === 'special-good' || meta.kind === 'star') {
    nExpireGood++;
    misses += 1;
    combo = 0;

    ROOT.dispatchEvent(new CustomEvent('hha:miss', {
      detail: { reason: 'expire-good' }
    }));

    applyAdaptive();
    recalcQuestProgress();
    dispatchStat();

    logGameEvent({
      type: 'expire-good',
      itemType: meta.kind,
      emoji: meta.emoji,
      totalScore: score,
      combo
    });
  } else {
    // junk expire → ไม่ถือว่าพลาด (ถือว่าหลบได้)
    logGameEvent({
      type: 'expire-junk',
      itemType: 'junk',
      emoji: meta.emoji,
      totalScore: score,
      combo
    });
  }
}

// ---------- Spawn scheduler ----------
function pickSpawnType () {
  // special ระหว่างเกม
  const elapsed = getElapsedSec();
  const total = plannedDurationSec || 60;
  const t = clamp(elapsed / total, 0, 1);

  // star/shield chance
  const starChance   = (RUN_MODE === 'research') ? 0.05 : 0.07;
  const shieldChance = (RUN_MODE === 'research') ? 0.04 : 0.06;

  const r = Math.random();
  if (r < starChance) return 'star';
  if (r < starChance + shieldChance) return 'shield';

  // phase-based wave
  let goodRatio = spawnGoodRatio;
  if (t > 0.15 && t < 0.32) {
    // Veggie storm
    goodRatio = 0.96;
  } else if (t > 0.45 && t < 0.6) {
    // Junk alert
    goodRatio = 0.45;
  }

  return (Math.random() < goodRatio) ? 'good' : 'junk';
}

function spawnOne () {
  if (!running) return;
  if (activeTargets.size >= maxActiveTargets) {
    scheduleNextSpawn();
    return;
  }

  const kind = pickSpawnType();
  let meta = {
    id: targetIdSeq++,
    kind,
    groupId: null,
    emoji: '🍽️',
    spawnTimeMs: performance.now(),
    lifeMs: spawnLifeMs,
    hit: false,
    lifeTimer: null,
    el: null
  };

  if (kind === 'good') {
    const g = pickOne(GROUPS, GROUPS[0]);
    meta.groupId = g.id;
    meta.emoji   = pickOne(g.emojis, '🍚');
    nSpawnGood++;
  } else if (kind === 'junk') {
    meta.groupId = null;
    meta.emoji   = pickOne(JUNK_POOL, '🍩');
    nSpawnJunk++;
  } else if (kind === 'star') {
    meta.groupId = null;
    meta.emoji   = pickOne(STAR_POOL, '⭐');
    nSpawnStar++;
  } else if (kind === 'shield') {
    meta.groupId = null;
    meta.emoji   = pickOne(SHIELD_POOL, '🛡️');
    nSpawnShield++;
  }

  const el = createTargetElement(meta);
  meta.el = el;

  meta.lifeTimer = ROOT.setTimeout(() => expireTarget(meta.id), meta.lifeMs);
  activeTargets.set(meta.id, meta);

  scheduleNextSpawn();
}

function scheduleNextSpawn () {
  if (!running || ended) return;

  // randomize interval
  let interval = spawnIntervalMs * randRange(0.85, 1.15);

  // ช่วงท้ายเกมเล็ก ๆ ถ้า grade ต่ำให้ spawn ง่ายขึ้น (good เยอะขึ้น)
  const elapsed = getElapsedSec();
  if (elapsed > plannedDurationSec * 0.8 && score < 350) {
    interval *= 1.05;
  }

  spawnTimer = ROOT.setTimeout(spawnOne, interval);
}

// ---------- Logger ----------
function logGameEvent (payload) {
  const detail = Object.assign({}, payload, {
    sessionId,
    mode: 'BalancedPlateVR',
    difficulty: DIFF_KEY
  });
  ROOT.dispatchEvent(new CustomEvent('hha:event', { detail }));
}

// ---------- Game start / end ----------
function endGame (reason) {
  if (ended) return;
  ended = true;
  running = false;

  if (spawnTimer) {
    ROOT.clearTimeout(spawnTimer);
    spawnTimer = null;
  }
  // ลบเป้าทั้งหมด
  activeTargets.forEach((m, id) => removeTarget(id));
  activeTargets.clear();

  endTimeIso = new Date().toISOString();

  const goalsCleared = goalsAll.filter(q => q.done).length;
  const goalsTotal   = goalsAll.length;
  const minisCleared = minisAll.filter(q => q.done).length;
  const minisTotal   = minisAll.length;

  const payloadEnd = {
    sessionId,
    mode: 'BalancedPlateVR',
    difficulty: DIFF_KEY,
    scoreFinal: score,
    comboMax,
    misses,
    platesDone,
    goalsCleared,
    goalsTotal,
    miniCleared: minisCleared,
    miniTotal:   minisTotal,
    groupCounts: totalCounts.slice(),
    nTargetGoodSpawned: nSpawnGood,
    nTargetJunkSpawned: nSpawnJunk,
    nTargetStarSpawned: nSpawnStar,
    nTargetShieldSpawned: nSpawnShield,
    nHitGood,
    nHitJunk,
    nExpireGood,
    startTimeIso,
    endTimeIso,
    reason
  };

  // ให้ HUD สรุป + big celebrate
  ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: payloadEnd }));

  // ให้ logger เขียน session sheet
  ROOT.dispatchEvent(new CustomEvent('hha:session', {
    detail: Object.assign({}, payloadEnd, {
      durationSecPlayed: Math.round(getElapsedSec())
    })
  }));
}

function bindTimeUpListener () {
  // ให้ html ฝั่ง plate-vr เป็นคนสั่ง end จาก timer กลาง
  ROOT.addEventListener('hha:time', function (e) {
    if (!running || ended) return;
    const d = e.detail || {};
    if (typeof d.sec === 'number' && d.sec <= 0) {
      endGame('time-up');
    }
  });
}

// ---------- Public boot ----------
export function boot (opts = {}) {
  if (!DOC) return;

  RUN_MODE = (String(ROOT.HHA_RUNMODE || '').toLowerCase() === 'research')
    ? 'research'
    : 'play';

  DIFF_KEY = String(opts.difficulty || 'normal').toLowerCase();
  if (!BASE_DIFF[DIFF_KEY]) DIFF_KEY = 'normal';
  spawnBaseConf = BASE_DIFF[DIFF_KEY];

  plannedDurationSec = clamp(parseInt(opts.duration,10) || 60, 20, 180);

  adaptiveEnabled = (RUN_MODE === 'play'); // วิจัยไม่ adaptive

  spawnIntervalMs   = spawnBaseConf.spawnInterval;
  spawnSizeScale    = spawnBaseConf.sizeScale;
  spawnGoodRatio    = spawnBaseConf.goodRatio;
  spawnLifeMs       = spawnBaseConf.baseLife;
  maxActiveTargets  = spawnBaseConf.maxActive;

  // reset state
  running  = true;
  ended    = false;
  sessionId = uid();
  startTimeMs  = performance.now();
  startTimeIso = new Date().toISOString();

  score = 0;
  combo = 0;
  comboMax = 0;
  misses = 0;
  platesDone = 0;
  curPlateCounts = [0,0,0,0,0];
  totalCounts    = [0,0,0,0,0];
  junkHits = 0;

  nSpawnGood = nSpawnJunk = nSpawnStar = nSpawnShield = 0;
  nHitGood = nHitJunk = nExpireGood = 0;

  shieldCount = 0;
  FeverUI.ensureBar();
  FeverUI.setShield(0);
  FeverUI.setFeverActive(false);
  setFeverValue(0);
  ROOT.requestAnimationFrame(decayFeverLoop);

  // quests
  buildQuests();

  // แจ้ง logger ว่าเริ่ม session
  ROOT.dispatchEvent(new CustomEvent('hha:session', {
    detail: {
      sessionId,
      mode: 'BalancedPlateVR',
      difficulty: DIFF_KEY,
      durationSec: plannedDurationSec,
      reason: 'start',
      startTimeIso
    }
  }));

  // ผูก time listener ถ้ายังไม่เคย
  if (!ROOT.__PLATE_TIME_BOUND__) {
    ROOT.__PLATE_TIME_BOUND__ = true;
    bindTimeUpListener();
  }

  // กันกรณีปิดแท็บ
  ROOT.addEventListener('visibilitychange', () => {
    if (ROOT.document && ROOT.document.hidden && running && !ended) {
      endGame('tab-hidden');
    }
  }, { once: true });

  // เริ่ม spawn ชุดแรก
  scheduleNextSpawn();

  // coach intro
  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: {
      text: RUN_MODE === 'research'
        ? 'โหมดวิจัย: จัดจานให้ครบหมู่และเล่นให้เต็มเวลาเลยนะ 🍽️'
        : 'เริ่มจัดจานให้สนุกเลย! ลองดูว่ารอบนี้จะได้เกรดอะไร 💪'
    }
  }));

  // init stat เพื่อให้ HUD sync
  dispatchStat();
}