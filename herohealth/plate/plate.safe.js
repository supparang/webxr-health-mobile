// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Game Engine (DOM emoji targets + Quest + Fever + Cloud Logger)
//
// ใช้ร่วมกับ:
//   - plate-vr.html
//   - /herohealth/vr/ui-fever.js   (IIFE → FeverUI global)
//   - /herohealth/vr/particles.js  (IIFE → Particles global)
//   - /herohealth/vr/hha-cloud-logger.js (ฟัง hha:session / hha:event)
//
// Event ที่ยิงออกไป:
//   - 'hha:stat'  { score, combo, misses, platesDone, totalCounts:[g1..g5] }
//   - 'quest:update' { goal, mini, goalsAll, minisAll, hint }
//   - 'hha:end'   { score, platesDone, misses, goalsCleared, goalsTotal, miniCleared, miniTotal, groupCounts, reason }
//   - 'hha:session' สรุปผลสำหรับ Cloud Logger
//
// โหมด:
//   - runMode = 'play'      → diff ตามง่าย/ปกติ/ยาก + Adaptive (spawn/scale ตามฝีมือ)
//   - runMode = 'research'  → diff ตามง่าย/ปกติ/ยาก คงที่ ไม่ Adaptive
//
// Quest:
//   - Goals: 2 อัน  (G1 = จานสมดุล, G2 = ผัก+ผลไม้)
//   - Minis: 3 อัน (M1 = จานที่มี ≥4 หมู่, M2 = เก็บผัก, M3 = ชุดกดของดีต่อเนื่องไม่โดน junk)
//   - research → target fix; play → target สุ่มในช่วงเดียวกัน

'use strict';

// ---------- Root & Global modules ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles: /vr/particles.js (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt () {}, scorePop () {}, floatScore () {}, setShardMode () {} };

// FeverUI: /vr/ui-fever.js (IIFE)
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

// ---------- Helpers ----------
function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

function rand (min, max) {
  return min + Math.random() * (max - min);
}

// ---------- Difficulty config ----------
// ขนาดเป้า + ช่วง spawn + อายุเป้า (ms) ตามระดับ
const DIFF_TABLE = {
  easy: {
    spawnInterval: 1100,
    life: 2100,
    scale: 1.25,
    goodRatio: 0.7   // สัดส่วน good : junk
  },
  normal: {
    spawnInterval: 950,
    life: 1900,
    scale: 1.0,
    goodRatio: 0.6
  },
  hard: {
    spawnInterval: 800,
    life: 1700,
    scale: 0.85,
    goodRatio: 0.5
  }
};

// ---------- Food library ----------
const FOOD_GROUPS = {
  1: ['🍚', '🍞', '🍙', '🥖'],
  2: ['🥩', '🍗', '🍖', '🥚'],
  3: ['🥦', '🥕', '🥒', '🥗'],
  4: ['🍎', '🍌', '🍉', '🍊'],
  5: ['🥛', '🧀', '🍨', '🍦']
};

const FOOD_JUNK = ['🍟', '🍔', '🍕', '🧁', '🍩', '🥤'];

const FOOD_STAR  = ['⭐', '✨'];   // เพิ่มเกจ + shield เล็กน้อย

// ---------- State ----------
let runMode = 'play';          // play | research
let diffKey = 'normal';

let baseConf = DIFF_TABLE.normal;
let currentScale = 1.0;
let currentInterval = 1000;
let targetLifeMs = 2000;

let durationSec = 60;
let startTimeMs = 0;
let endTimeMs = 0;
let ended = false;

let sessionId = '';
let gameVersion = 'PlateVR-2025-12-15';

// Stats หลัก
let score = 0;
let combo = 0;
let comboMax = 0;
let misses = 0;
let platesDone = 0;

// นับหมู่รวมทั้งเกม [1..5]
let totalCounts = [0, 0, 0, 0, 0]; // index0 = หมู่1, index4 = หมู่5

// สถานะจานปัจจุบัน → สำหรับเช็คจานสมดุล
let currPlateGroups = [0, 0, 0, 0, 0];  // ต่อจาน
let currPlateItems = 0;

// Quest
let goalsAll = [];
let minisAll = [];

// mini quest ภายใน
let streakGoodNoJunk = 0;   // สำหรับ M3: good ต่อเนื่องไม่โดน junk
let vegFruitCount = 0;      // สำหรับ G2/M2

// Fever / Shield
let fever = 0;              // 0..100
let feverActive = false;
let feverTimerId = null;
let shieldCount = 0;

// Spawn
let spawnTimerId = null;
let targetIdCounter = 0;
const activeTargets = new Map(); // id → { el, type, group, createdAt }

// ---------- Quest: reset + random/fix ----------
function resetQuests () {
  goalsAll = [];
  minisAll = [];

  if (runMode === 'research') {
    // ───── โหมดวิจัย: FIX เป๊ะทุกเกม ─────
    const g1Target = 3;   // จานสมดุล 3 จาน
    const g2Target = 15;  // ผัก+ผลไม้ 15 ชิ้น

    const m1Target = 1;   // จานที่มี ≥4 หมู่ อย่างน้อย 1 จาน
    const m2Target = 8;   // ผักหมู่ 3 อย่างน้อย 8 ชิ้น
    const m3Target = 1;   // ชุดกดของดีต่อเนื่อง >=10 ครั้ง โดยไม่โดน junk 1 ครั้ง

    goalsAll.push({
      id: 'G1',
      label: `จัดจานสมดุลให้ได้ ${g1Target} จาน`,
      target: g1Target,
      prog: 0,
      done: false
    });
    goalsAll.push({
      id: 'G2',
      label: `เก็บผัก+ผลไม้ให้ได้ ${g2Target} ชิ้น`,
      target: g2Target,
      prog: 0,
      done: false
    });

    minisAll.push({
      id: 'M1',
      label: 'ทำจานที่มีอย่างน้อย 4 หมู่ ให้ครบ 1 จาน',
      target: m1Target,
      prog: 0,
      done: false
    });
    minisAll.push({
      id: 'M2',
      label: `เก็บผักหมู่ 3 ให้ได้ ${m2Target} ชิ้น`,
      target: m2Target,
      prog: 0,
      done: false
    });
    minisAll.push({
      id: 'M3',
      label: 'กดของดีต่อเนื่องโดยไม่โดนของขยะ',
      target: m3Target,
      prog: 0,
      done: false
    });
  } else {
    // ───── โหมดธรรมดา (play): target สุ่มในช่วงเดิม ─────
    const g1Target = 2 + Math.floor(Math.random() * 3);   // 2–4 จาน
    const g2Target = 10 + Math.floor(Math.random() * 9);  // 10–18 ชิ้น

    const m1Target = 1;                                   // จาน ≥4 หมู่ 1 จาน
    const m2Target = 5 + Math.floor(Math.random() * 6);   // 5–10 ผัก
    const m3Target = 1;                                   // ชุด good ต่อเนื่อง >=10 ไม่โดน junk 1 ครั้ง

    goalsAll.push({
      id: 'G1',
      label: `จัดจานสมดุลให้ได้ ${g1Target} จาน`,
      target: g1Target,
      prog: 0,
      done: false
    });
    goalsAll.push({
      id: 'G2',
      label: `เก็บผัก+ผลไม้ให้ได้ ${g2Target} ชิ้น`,
      target: g2Target,
      prog: 0,
      done: false
    });

    minisAll.push({
      id: 'M1',
      label: 'ทำจานที่มีอย่างน้อย 4 หมู่ ให้ครบ 1 จาน',
      target: m1Target,
      prog: 0,
      done: false
    });
    minisAll.push({
      id: 'M2',
      label: `เก็บผักหมู่ 3 ให้ได้ ${m2Target} ชิ้น`,
      target: m2Target,
      prog: 0,
      done: false
    });
    minisAll.push({
      id: 'M3',
      label: 'กดของดีต่อเนื่องโดยไม่โดนของขยะ',
      target: m3Target,
      prog: 0,
      done: false
    });
  }
}

// ---------- Quest helper ----------
function findQuest (id) {
  if (!id) return null;
  if (id.startsWith('G')) return goalsAll.find(q => q.id === id) || null;
  if (id.startsWith('M')) return minisAll.find(q => q.id === id) || null;
  return null;
}

function incQuest (id, amount) {
  const q = findQuest(id);
  if (!q || q.done) return;
  q.prog += (amount || 1);
  if (q.prog >= q.target) {
    q.prog = q.target;
    q.done = true;
  }
}

function emitQuestUpdate (hintText) {
  const goal =
    goalsAll.find(q => !q.done) ||
    goalsAll[goalsAll.length - 1] ||
    null;

  const mini =
    minisAll.find(q => !q.done) ||
    minisAll[minisAll.length - 1] ||
    null;

  const detail = {
    goal,
    mini,
    goalsAll: goalsAll.slice(),
    minisAll: minisAll.slice(),
    hint: hintText || ''
  };

  window.dispatchEvent(new CustomEvent('quest:update', { detail }));
}

// ---------- Fever / Shield ----------
function updateFeverUI () {
  const ratio = clamp(fever, 0, 100) / 100;
  if (FeverUI.setFever) {
    FeverUI.setFever(ratio);
  }
  if (FeverUI.setShield) {
    FeverUI.setShield(shieldCount | 0);
  }
}

function enterFever () {
  if (feverActive) return;
  feverActive = true;
  if (FeverUI.setFeverActive) FeverUI.setFeverActive(true);

  window.dispatchEvent(new CustomEvent('hha:fever', {
    detail: { state: 'start', mode: 'BalancedPlateVR' }
  }));

  if (feverTimerId) clearTimeout(feverTimerId);
  feverTimerId = setTimeout(() => {
    feverActive = false;
    fever = 40; // ลดลงมาระดับหนึ่ง
    if (FeverUI.setFeverActive) FeverUI.setFeverActive(false);
    updateFeverUI();
    window.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'end', mode: 'BalancedPlateVR' }
    }));
  }, 8000);
}

function gainFever (amount) {
  fever = clamp(fever + amount, 0, 100);
  if (!feverActive && fever >= 100) {
    enterFever();
  } else {
    updateFeverUI();
  }
}

function loseFever (amount) {
  fever = clamp(fever - amount, 0, 100);
  updateFeverUI();
}

// ---------- Difficulty Adaptive (เฉพาะ play mode) ----------
function applyAdaptiveTuning () {
  // research → ใช้ค่าคงที่ตาม diff เท่านั้น
  if (runMode === 'research') {
    currentInterval = baseConf.spawnInterval;
    currentScale = baseConf.scale;
    targetLifeMs = baseConf.life;
    return;
  }

  // เทียบตาม comboMax และ misses
  const comboFactor = clamp(comboMax, 0, 20) / 20; // 0..1
  const missFactor = clamp(misses, 0, 10) / 10;    // 0..1

  // เปลี่ยน interval: combo สูง → เร็วขึ้น, Miss เยอะ → ช้าลง
  let interval = baseConf.spawnInterval *
    (1 - 0.35 * comboFactor + 0.3 * missFactor);
  interval = clamp(interval,
    baseConf.spawnInterval * 0.7,
    baseConf.spawnInterval * 1.4);

  // เปลี่ยน scale: combo สูง → เล็กลง, Miss เยอะ → ใหญ่ขึ้น
  let scale = baseConf.scale *
    (1 - 0.28 * comboFactor + 0.25 * missFactor);
  scale = clamp(scale,
    baseConf.scale * 0.7,
    baseConf.scale * 1.3);

  currentInterval = interval;
  currentScale = scale;
  targetLifeMs = baseConf.life;
}

// ---------- Stat & Event ----------
function emitStat () {
  const detail = {
    mode: 'BalancedPlateVR',
    score,
    combo,
    misses,
    platesDone,
    totalCounts: totalCounts.slice()
  };

  window.dispatchEvent(new CustomEvent('hha:stat', { detail }));
}

// ---------- Target management ----------
function removeTarget (id, withDom = true) {
  const obj = activeTargets.get(id);
  if (!obj) return;
  if (withDom && obj.el && obj.el.parentNode) {
    obj.el.parentNode.removeChild(obj.el);
  }
  activeTargets.delete(id);
}

function clearAllTargets () {
  for (const id of activeTargets.keys()) {
    removeTarget(id, true);
  }
}

// สร้าง DOM เป้า
function createTarget () {
  const id = 't' + (++targetIdCounter);

  // ตัดสินว่า spawn good / junk / star
  let kind = 'good';
  let group = 1;
  let emoji = '🍚';

  const r = Math.random();

  // โอกาส star เล็กน้อย
  if (r < 0.06) {
    kind = 'star';
    emoji = pickOne(FOOD_STAR, '⭐');
    group = 0;
  } else {
    const isGood = (Math.random() < baseConf.goodRatio);
    if (!isGood) {
      kind = 'junk';
      emoji = pickOne(FOOD_JUNK, '🍩');
      group = 0;
    } else {
      kind = 'good';
      const gIndex = 1 + Math.floor(Math.random() * 5); // 1..5
      group = gIndex;
      emoji = pickOne(FOOD_GROUPS[gIndex], '🍚');
    }
  }

  const el = document.createElement('div');
  el.className = 'hha-target ' + (kind === 'junk' ? 'hha-target-bad' : 'hha-target-good');
  el.textContent = emoji;
  el.dataset.id = id;
  el.dataset.kind = kind;
  el.dataset.group = String(group);

  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  const margin = 70;

  const x = rand(margin, vw - margin);
  const y = rand(vh * 0.18, vh * 0.78);

  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const scale = currentScale || 1.0;
  el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;

  // listener: click เท่านั้น ไม่ยุ่ง touchmove (ให้ touch-look จัดการหมุนจอ)
  el.addEventListener('click', (ev) => {
    if (ended) return;
    handleHit(id, ev);
  });

  document.body.appendChild(el);

  const obj = {
    id,
    el,
    kind,
    group,
    createdAt: performance.now()
  };
  activeTargets.set(id, obj);

  // ตั้ง timer ลบตาม life
  setTimeout(() => {
    if (!activeTargets.has(id)) return;
    // หมดอายุ → นับเป็น miss ถ้าเป็น good
    if (obj.kind === 'good') {
      registerMiss('expire-good', obj);
    }
    removeTarget(id, true);
  }, targetLifeMs);
}

function scheduleNextSpawn () {
  if (ended) return;
  const now = performance.now();
  if (now >= endTimeMs) {
    endGame('time-up');
    return;
  }

  applyAdaptiveTuning();

  const delay = currentInterval;
  spawnTimerId = setTimeout(() => {
    if (ended) return;
    createTarget();
    scheduleNextSpawn();
  }, delay);
}

// ---------- Hit / Miss Logic ----------
function registerMiss (reason, targetObj) {
  // ถ้ามี shield → ใช้ shield ก่อน ไม่ถือว่าพลาด
  if (shieldCount > 0 && reason === 'hit-junk') {
    shieldCount -= 1;
    updateFeverUI();
    // ปล่อย effect เล็กน้อย
    const rect = targetObj && targetObj.el
      ? targetObj.el.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    Particles.burstAt(cx, cy, {
      color: '#38bdf8',
      count: 14
    });
    Particles.scorePop(cx, cy, 'GUARD!', { judgment: 'Shield', good: true });

    return;
  }

  misses += 1;
  combo = 0;
  streakGoodNoJunk = 0;
  loseFever(10);

  emitStat();

  // coach / effect
  const rect = targetObj && targetObj.el
    ? targetObj.el.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  Particles.burstAt(cx, cy, { color: '#f97316', count: 14 });
  Particles.scorePop(cx, cy, 'MISS', { judgment: 'MISS', good: false });

  window.dispatchEvent(new CustomEvent('hha:miss', {
    detail: { reason, mode: 'BalancedPlateVR' }
  }));
}

function handleHit (id, ev) {
  const obj = activeTargets.get(id);
  if (!obj) return;
  const kind = obj.kind;
  const group = obj.group | 0;

  const rect = obj.el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  removeTarget(id, true);

  const now = performance.now();
  const timeFromStartMs = now - startTimeMs;

  if (kind === 'star') {
    // เพิ่ม fever + shield เล็กน้อย
    gainFever(25);
    shieldCount = clamp(shieldCount + 1, 0, 3);
    updateFeverUI();

    Particles.burstAt(cx, cy, { color: '#eab308', count: 18 });
    Particles.scorePop(cx, cy, '+BONUS', { judgment: 'STAR', good: true });

    // log event
    window.dispatchEvent(new CustomEvent('hha:event', {
      detail: {
        type: 'hit-star',
        mode: 'BalancedPlateVR',
        difficulty: diffKey,
        sessionId,
        timeFromStartMs,
        emoji: obj.el.textContent || '⭐',
        itemType: 'star',
        totalScore: score,
        combo
      }
    }));

    return;
  }

  if (kind === 'junk') {
    // hit junk
    score = Math.max(0, score - 15);
    registerMiss('hit-junk', obj);

    Particles.burstAt(cx, cy, { color: '#f97316', count: 16 });
    Particles.scorePop(cx, cy, '-15', { judgment: 'JUNK', good: false });

    window.dispatchEvent(new CustomEvent('hha:event', {
      detail: {
        type: 'hit-junk',
        mode: 'BalancedPlateVR',
        difficulty: diffKey,
        sessionId,
        timeFromStartMs,
        emoji: obj.el.textContent || '',
        itemType: 'junk',
        totalScore: score,
        combo
      }
    }));

    emitStat();
    return;
  }

  // good food (group 1..5)
  let baseScore = 20;
  if (feverActive) baseScore = 35;

  combo += 1;
  if (combo > comboMax) comboMax = combo;

  streakGoodNoJunk += 1;
  gainFever(6);

  score += baseScore;

  if (group >= 1 && group <= 5) {
    totalCounts[group - 1] += 1;
  }

  // veg+fruit (G2) → group 3 & 4
  if (group === 3 || group === 4) {
    vegFruitCount += 1;
    incQuest('G2', 1);
    incQuest('M2', 1);
  }

  // นับบนจานปัจจุบัน
  if (group >= 1 && group <= 5) {
    currPlateGroups[group - 1] += 1;
    currPlateItems += 1;
  }

  const distinctGroupsOnPlate =
    currPlateGroups.filter(x => x > 0).length;

  // ถ้าจานนี้มี ≥4 หมู่ → นับเป็น "จานสมดุล"
  let plateJustCompleted = false;
  if (distinctGroupsOnPlate >= 4) {
    platesDone += 1;
    plateJustCompleted = true;

    // Quest G1 / M1
    incQuest('G1', 1);
    incQuest('M1', 1);

    // reset จานใหม่
    currPlateGroups = [0, 0, 0, 0, 0];
    currPlateItems = 0;

    // effect จานสมดุล
    Particles.burstAt(cx, cy, { color: '#22c55e', count: 24 });
    Particles.scorePop(cx, cy, 'BALANCED!', { judgment: '+PLATE', good: true });
  } else {
    // effect ทั่วไป
    Particles.burstAt(cx, cy, { color: '#4ade80', count: 14 });
    Particles.scorePop(cx, cy, '+' + baseScore, { judgment: 'GOOD', good: true });
  }

  // Mini M3: good streak ไม่โดน junk
  // กำหนดว่า streak >= 10 → นับ 1 ครั้ง
  if (streakGoodNoJunk >= 10) {
    incQuest('M3', 1);
    streakGoodNoJunk = 0; // รีเซ็ตให้ลุ้นรอบใหม่
  }

  emitStat();
  emitQuestUpdate(plateJustCompleted ? 'เยี่ยม! ได้จานสมดุลเพิ่มแล้ว 🎯' : '');

  // log event hit-good
  window.dispatchEvent(new CustomEvent('hha:event', {
    detail: {
      type: 'hit-good',
      mode: 'BalancedPlateVR',
      difficulty: diffKey,
      sessionId,
      timeFromStartMs,
      emoji: obj.el.textContent || '',
      itemType: 'good',
      lane: group,
      totalScore: score,
      combo,
      isGood: true
    }
  }));
}

// ---------- End Game ----------
function endGame (reason) {
  if (ended) return;
  ended = true;

  if (spawnTimerId) {
    clearTimeout(spawnTimerId);
    spawnTimerId = null;
  }

  clearAllTargets();

  const now = performance.now();
  const elapsedSec = (now - startTimeMs) / 1000;

  const goalsCleared = goalsAll.filter(q => q.done).length;
  const goalsTotal = goalsAll.length;
  const miniCleared = minisAll.filter(q => q.done).length;
  const miniTotal = minisAll.length;

  const groupCounts = totalCounts.slice();

  const detailEnd = {
    mode: 'BalancedPlateVR',
    difficulty: diffKey,
    sessionId,
    score,
    scoreFinal: score,
    comboMax,
    misses,
    platesDone,
    goalsCleared,
    goalsTotal,
    miniCleared,
    miniTotal,
    groupCounts,
    reason: reason || 'ended',
    durationSecPlayed: elapsedSec
  };

  // ยิง event ให้ HUD + summary
  window.dispatchEvent(new CustomEvent('hha:end', {
    detail: detailEnd
  }));

  // ยิง session summary ให้ Cloud Logger
  window.dispatchEvent(new CustomEvent('hha:session', {
    detail: {
      sessionId,
      mode: 'BalancedPlateVR',
      difficulty: diffKey,
      durationSecPlayed: elapsedSec,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      nTargetGoodSpawned: null,
      nTargetJunkSpawned: null,
      device: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
      gameVersion,
      reason,
      startTimeIso: new Date(startTimeMs + (new Date().getTimezoneOffset() * -60000)).toISOString(),
      endTimeIso: new Date().toISOString()
    }
  }));
}

// ---------- Public boot ----------
export function boot (opts = {}) {
  // อ่านโหมดจาก window.HHA_RUNMODE หรือ opts.runMode
  runMode =
    (ROOT.HHA_RUNMODE === 'research' || opts.runMode === 'research')
      ? 'research'
      : 'play';

  diffKey = String(opts.difficulty || 'normal').toLowerCase();
  if (!DIFF_TABLE[diffKey]) diffKey = 'normal';

  baseConf = DIFF_TABLE[diffKey];
  currentScale = baseConf.scale;
  currentInterval = baseConf.spawnInterval;
  targetLifeMs = baseConf.life;

  durationSec = Number(opts.duration || 60) || 60;
  if (durationSec < 20) durationSec = 20;
  if (durationSec > 180) durationSec = 180;

  // สร้าง session id
  startTimeMs = performance.now();
  endTimeMs = startTimeMs + durationSec * 1000;
  sessionId = 'PlateVR-' + Math.floor(startTimeMs);

  ended = false;

  // Reset stats
  score = 0;
  combo = 0;
  comboMax = 0;
  misses = 0;
  platesDone = 0;
  totalCounts = [0, 0, 0, 0, 0];
  currPlateGroups = [0, 0, 0, 0, 0];
  currPlateItems = 0;
  streakGoodNoJunk = 0;
  vegFruitCount = 0;

  fever = 0;
  feverActive = false;
  shieldCount = 0;
  if (feverTimerId) {
    clearTimeout(feverTimerId);
    feverTimerId = null;
  }

  clearAllTargets();

  // Fever UI setup
  if (FeverUI.ensureFeverBar) {
    FeverUI.ensureFeverBar();
  }
  updateFeverUI();

  // Quest reset (fixed vs random)
  resetQuests();
  emitQuestUpdate('จัดจานให้ครบ 5 หมู่ เลี่ยงของไม่ดี แล้วลุยเลย!');

  // ยิง stat รอบแรก (ให้ HUD รีเฟรช)
  emitStat();

  // เริ่ม spawn loop
  scheduleNextSpawn();
}