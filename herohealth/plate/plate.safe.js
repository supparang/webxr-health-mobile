// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR (A-Frame) — Production-ready mini loop + Cloud Logger
// - เป้ายึดกับกล้อง (หมุน/เลื่อนจอแล้วเป้าเลื่อนตาม)
// - นับหมู่ 1–5 ต่อรอบ + แสดงในสรุป
// - Goal: PERFECT >= 2
// - Mini: Plate Rush 3 ด่าน (ทำ PERFECT ให้ทัน 15s ต่อด่าน)
// - ส่ง session + events ไป Google Sheet ผ่าน hha-cloud-logger.js

'use strict';

// ---------- URL params ----------
const url = new URL(window.location.href);
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();
const RUN  = (url.searchParams.get('run')  || sessionStorage.getItem('HHA_RUN_MODE') || 'play').toLowerCase();

let timeParam = parseInt(url.searchParams.get('time') || '70', 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 70;
if (timeParam < 20) timeParam = 20;
if (timeParam > 180) timeParam = 180;
const GAME_DURATION = timeParam;

// ---------- Logger endpoint (จาก Hub เป็นหลัก) ----------
const DEFAULT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

const LOG_ENDPOINT = sessionStorage.getItem('HHA_LOG_ENDPOINT') || DEFAULT_ENDPOINT;

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);

// HUD
const hud = {
  time:  $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss:  $('hudMiss'),
  feverFill: $('hudFever'),
  feverPct:  $('hudFeverPct'),
  mode:  $('hudMode'),
  diff:  $('hudDiff'),

  goalLine: $('hudGoalLine'),
  miniLine: $('hudMiniLine'),

  groupsHave: $('hudGroupsHave'),
  perfectCount: $('hudPerfectCount')
};

// Result modal
const result = {
  backdrop: $('resultBackdrop'),
  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  g1: $('rG1'),
  g2: $('rG2'),
  g3: $('rG3'),
  g4: $('rG4'),
  g5: $('rG5'),
  gT: $('rGTotal'),

  btnPlayAgain: $('btnPlayAgain')
};

const btnEnterVR = $('btnEnterVR');
const btnRestart = $('btnRestart');

// A-Frame entities
const scene = document.querySelector('a-scene');
const cam   = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnMs: 900,  maxActive: 4, junkRate: 0.12, scale: 1.05 },
  normal: { spawnMs: 750,  maxActive: 5, junkRate: 0.18, scale: 1.00 },
  hard:   { spawnMs: 620,  maxActive: 6, junkRate: 0.26, scale: 0.92 }
};
const DCFG = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- Session state ----------
const sessionId = 'PLATE-' + Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);

let tLeft = GAME_DURATION;
let ticker = null;
let spawner = null;
let startedAt = null;

let score = 0;
let combo = 0;
let comboMax = 0;
let misses = 0;

let fever = 0;              // 0..100
let feverActive = false;

let perfectPlates = 0;

// counts by group (ตลอดรอบ)
const groupCount = { 1:0, 2:0, 3:0, 4:0, 5:0 };

// current plate tracking
let plateHave = new Set();      // 1..5
let plateHadJunk = false;       // ถ้าโดน junk ระหว่างจานนี้ -> ไม่ perfect
let plateStartMs = 0;

// Goal / mini
const GOAL_TOTAL = 2; // perfect >= 2
let goalsCleared = 0;

const MINI_TOTAL = 3;
let miniCleared = 0;
let miniIndex = 1;
const MINI_WINDOW_MS = 15000;
let miniStartMs = 0;

// Spawn stats
let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nHitGood = 0;
let nHitJunk = 0;

// ---------- Logger wiring ----------
function initLoggerIfAny() {
  if (typeof window !== 'undefined' && typeof window.initCloudLogger === 'function') {
    window.initCloudLogger({
      endpoint: LOG_ENDPOINT,
      projectTag: 'HeroHealth-PlateVR',
      mode: 'PlateVR',
      runMode: RUN,
      diff: DIFF,
      durationSec: GAME_DURATION,
      debug: true
    });
  }
}

function emitSession(reason='completed') {
  const now = Date.now();
  const startIso = startedAt ? new Date(startedAt).toISOString() : '';
  const endIso = new Date().toISOString();

  const totalGroups = groupCount[1] + groupCount[2] + groupCount[3] + groupCount[4] + groupCount[5];

  window.dispatchEvent(new CustomEvent('hha:session', {
    detail: {
      sessionId,
      mode: 'PlateVR',
      difficulty: DIFF,
      durationSecPlayed: startedAt ? Math.round((now - startedAt)/1000) : '',
      scoreFinal: score,
      comboMax,
      misses,

      goalsCleared,
      goalsTotal: GOAL_TOTAL,
      miniCleared,
      miniTotal: MINI_TOTAL,

      nTargetGoodSpawned,
      nTargetJunkSpawned,
      nHitGood,
      nHitJunk,

      // (ช่อง star/diamond/shield ไม่ใช้ -> ปล่อยว่างได้)
      nTargetStarSpawned: '',
      nTargetDiamondSpawned: '',
      nTargetShieldSpawned: '',

      accuracyGoodPct: '',
      junkErrorPct: '',
      avgRtGoodMs: '',
      medianRtGoodMs: '',
      fastHitRatePct: '',

      gameVersion: 'PlateVR-2025-12-16',
      reason,
      startTimeIso: startIso,
      endTimeIso: endIso,

      // ใส่ extra summary ให้ดูง่าย (จะไปอยู่ field "extra" ถ้าคุณอยาก)
      extra: JSON.stringify({
        perfectPlates,
        groupCount,
        totalGroups
      })
    }
  }));
}

function emitEvent(type, detail = {}) {
  const msFromStart = startedAt ? (Date.now() - startedAt) : '';
  window.dispatchEvent(new CustomEvent('hha:event', {
    detail: Object.assign({
      sessionId,
      type,
      mode: 'PlateVR',
      difficulty: DIFF,
      timeFromStartMs: msFromStart
    }, detail)
  }));
}

// ---------- UI helpers ----------
function setText(el, v) { if (el) el.textContent = String(v); }
function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function updateHUD() {
  setText(hud.time, tLeft);
  setText(hud.score, score);
  setText(hud.combo, combo);
  setText(hud.miss, misses);
  setText(hud.mode, RUN === 'research' ? 'Research' : 'Play');
  setText(hud.diff, DIFF.charAt(0).toUpperCase() + DIFF.slice(1));

  const f = clamp(fever, 0, 100);
  if (hud.feverFill) hud.feverFill.style.width = f + '%';
  setText(hud.feverPct, Math.round(f) + '%');

  setText(hud.groupsHave, `${plateHave.size}/5`);
  setText(hud.perfectCount, perfectPlates);

  goalsCleared = (perfectPlates >= GOAL_TOTAL) ? GOAL_TOTAL : perfectPlates;
  setText(hud.goalLine, `ทำ ` + (perfectPlates >= GOAL_TOTAL ? '✅ ' : '') + `PERFECT PLATE ให้ได้อย่างน้อย ${GOAL_TOTAL} จาน (ตอนนี้ ${perfectPlates}/${GOAL_TOTAL})`);

  const remainMini = Math.max(0, MINI_TOTAL - miniCleared);
  const miniStatus = (miniIndex <= MINI_TOTAL)
    ? `Mini: Plate Rush ${miniIndex}/${MINI_TOTAL} — ทำ Perfect ภายใน 15s`
    : `Mini: จบแล้ว ✅ (${MINI_TOTAL}/${MINI_TOTAL})`;
  setText(hud.miniLine, miniStatus + (remainMini === 0 ? '' : ''));
}

// ---------- Grade ----------
function gradeFrom(score, misses) {
  // ง่าย ๆ แบบใช้จริง: เน้น miss ต่ำ + score สูง
  const s = Number(score)||0;
  const m = Number(misses)||0;

  if (m <= 1 && s >= 4500) return 'SSS';
  if (m <= 2 && s >= 3800) return 'SS';
  if (m <= 3 && s >= 3200) return 'S';
  if (m <= 5 && s >= 2600) return 'A';
  if (m <= 7 && s >= 2000) return 'B';
  return 'C';
}

// ---------- Target spawn ----------
const FOOD_POOL = {
  1: ['🍗','🥚','🐟','🥜','🍖'],     // โปรตีน
  2: ['🍚','🍞','🥔','🍝','🥯'],     // คาร์บ/แป้ง
  3: ['🥦','🥬','🥒','🥕','🌽'],     // ผัก
  4: ['🍎','🍌','🍊','🍇','🍉'],     // ผลไม้
  5: ['🥛','🧀','🍶','🧈','🍼']      // นม/ไขมันดี
};

const JUNK_POOL = ['🍟','🍩','🍭','🧁','🥤','🍕'];

function pickEmoji(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function activeTargets() {
  return targetRoot ? targetRoot.querySelectorAll('.plateTarget') : [];
}

function spawnTarget() {
  if (!targetRoot) return;
  if (activeTargets().length >= DCFG.maxActive) return;

  // เลือก group: ถ้ายังไม่ครบ 5 ให้ bias ไปที่กลุ่มที่ขาด
  let group = 1 + Math.floor(Math.random()*5);
  const missing = [1,2,3,4,5].filter(g => !plateHave.has(g));
  if (missing.length && Math.random() < 0.72) {
    group = missing[Math.floor(Math.random()*missing.length)];
  }

  const isJunk = (Math.random() < DCFG.junkRate);
  const emoji = isJunk ? pickEmoji(JUNK_POOL) : pickEmoji(FOOD_POOL[group]);

  const el = document.createElement('a-entity');
  el.classList.add('plateTarget');

  // random position ในกรอบหน้ากล้อง (เพราะ targetRoot ผูกกับกล้องแล้ว)
  const x = (Math.random()*1.2 - 0.6);
  const y = (Math.random()*0.7 - 0.35);
  const z = (Math.random()*-0.2); // เล็กน้อยให้มีมิติ
  el.setAttribute('position', `${x} ${y} ${z}`);

  const s = (0.35 * DCFG.scale) + (Math.random()*0.10);
  el.setAttribute('scale', `${s} ${s} ${s}`);

  // ตัวพื้น (hitbox) ใส ๆ
  el.setAttribute('geometry', 'primitive: plane; height: 0.55; width: 0.55');
  el.setAttribute('material', 'color:#ffffff; opacity:0.06; shader:flat; transparent:true');
  el.setAttribute('look-at', '#cam'); // ให้หันเข้ากล้อง

  // แสดง emoji
  const text = document.createElement('a-text');
  text.setAttribute('value', emoji);
  text.setAttribute('align', 'center');
  text.setAttribute('width', 2.8);
  text.setAttribute('color', '#ffffff');
  text.setAttribute('position', '0 0 0.01');
  text.setAttribute('baseline', 'center');
  el.appendChild(text);

  // metadata
  const targetId = 'T' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  el.dataset.targetId = targetId;
  el.dataset.group = String(group);
  el.dataset.isJunk = isJunk ? '1' : '0';
  el.dataset.emoji = emoji;
  el.dataset.spawnAt = String(Date.now());

  // auto expire (ไม่กด = miss เล็ก ๆ)
  const ttl = (DIFF === 'hard') ? 1100 : (DIFF === 'easy' ? 1700 : 1400);
  el.__ttlTimer = setTimeout(() => {
    if (!el.parentNode) return;
    // expire = นับเป็น miss เฉพาะเป้าดี (junk ปล่อยผ่านไม่ลงโทษ)
    if (el.dataset.isJunk !== '1') {
      misses += 1;
      combo = 0;
      fever = Math.max(0, fever - 9);
      emitEvent('expire', {
        targetId,
        emoji,
        itemType: 'good',
        isGood: true,
        judgment: 'MISS',
        rtMs: '',
        totalScore: score,
        combo
      });
    }
    el.parentNode.removeChild(el);
    updateHUD();
  }, ttl);

  // click/fuse hit
  el.addEventListener('click', () => onHit(el));
  el.addEventListener('fusing', () => {
    // optional: สามารถทำ reticle progress ได้ต่อ (เอาไว้รอบถัดไป)
  });

  targetRoot.appendChild(el);

  if (isJunk) nTargetJunkSpawned += 1;
  else nTargetGoodSpawned += 1;

  emitEvent('spawn', {
    targetId,
    emoji,
    itemType: isJunk ? 'junk' : 'good',
    isGood: !isJunk
  });
}

function onHit(el) {
  if (!el || !el.parentNode) return;

  const now = Date.now();
  const targetId = el.dataset.targetId || '';
  const emoji = el.dataset.emoji || '';
  const group = parseInt(el.dataset.group || '0', 10);
  const isJunk = (el.dataset.isJunk === '1');
  const spawnAt = parseInt(el.dataset.spawnAt || '0', 10);
  const rtMs = spawnAt ? (now - spawnAt) : '';

  clearTimeout(el.__ttlTimer);

  if (isJunk) {
    // กด junk = โทษ
    misses += 1;
    combo = 0;
    fever = Math.max(0, fever - 15);
    plateHadJunk = true;
    nHitJunk += 1;

    emitEvent('hit', {
      targetId, emoji, itemType:'junk',
      isGood:false,
      judgment:'MISS',
      rtMs,
      totalScore: score,
      combo
    });
  } else {
    // กดของดี
    combo += 1;
    comboMax = Math.max(comboMax, combo);

    const add = 120 + Math.min(220, combo * 8);
    score += add;

    fever = clamp(fever + 6, 0, 100);
    feverActive = (fever >= 100);

    if (group >= 1 && group <= 5) {
      groupCount[group] += 1;
      plateHave.add(group);
    }
    nHitGood += 1;

    emitEvent('hit', {
      targetId, emoji, itemType:'good',
      isGood:true,
      judgment:'GOOD',
      lane:'',
      rtMs,
      totalScore: score,
      combo,
      extra: JSON.stringify({ group })
    });

    // plate complete?
    if (plateHave.size >= 5) {
      finishPlate();
    }
  }

  el.parentNode.removeChild(el);
  updateHUD();
}

function startNewPlate() {
  plateHave = new Set();
  plateHadJunk = false;
  plateStartMs = Date.now();
  updateHUD();
}

function finishPlate() {
  const now = Date.now();
  const plateMs = plateStartMs ? (now - plateStartMs) : 999999;

  const isPerfect = (!plateHadJunk && plateHave.size >= 5);
  if (isPerfect) {
    perfectPlates += 1;

    // mini quest: ภายใน 15s นับผ่าน
    if (miniIndex <= MINI_TOTAL) {
      const inWindow = (now - miniStartMs) <= MINI_WINDOW_MS;
      if (inWindow) {
        miniCleared += 1;
      }
      miniIndex += 1;
      miniStartMs = now; // เริ่มด่านถัดไป
    }

    emitEvent('plate', {
      eventType: 'plate',
      judgment: 'PERFECT',
      totalScore: score,
      combo,
      extra: JSON.stringify({ plateMs })
    });
  } else {
    emitEvent('plate', {
      eventType: 'plate',
      judgment: 'CLEAR',
      totalScore: score,
      combo,
      extra: JSON.stringify({ plateMs, hadJunk: plateHadJunk })
    });
  }

  // reset for next plate
  startNewPlate();
}

// ---------- Game loop ----------
function startGame() {
  initLoggerIfAny();

  startedAt = Date.now();
  miniStartMs = startedAt;
  startNewPlate();

  hud.mode.textContent = (RUN === 'research') ? 'Research' : 'Play';
  hud.diff.textContent = DIFF.charAt(0).toUpperCase() + DIFF.slice(1);

  // start countdown
  tLeft = GAME_DURATION;
  updateHUD();

  ticker = setInterval(() => {
    tLeft -= 1;
    if (tLeft <= 0) {
      tLeft = 0;
      updateHUD();
      endGame('completed');
      return;
    }
    updateHUD();
  }, 1000);

  spawner = setInterval(() => spawnTarget(), DCFG.spawnMs);

  emitEvent('start', { totalScore: 0, combo: 0, extra: JSON.stringify({ duration: GAME_DURATION }) });
}

function stopGameTimers() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  if (spawner) { clearInterval(spawner); spawner = null; }
}

function endGame(reason='completed') {
  stopGameTimers();

  // เคลียร์ targets
  activeTargets().forEach(el => {
    try { clearTimeout(el.__ttlTimer); } catch (_) {}
    try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
  });

  // อัปเดตผลลัพธ์
  const gTotal = groupCount[1]+groupCount[2]+groupCount[3]+groupCount[4]+groupCount[5];

  result.rMode.textContent = (RUN === 'research') ? 'Research' : 'Play';
  result.rScore.textContent = String(score);
  result.rMaxCombo.textContent = String(comboMax);
  result.rMiss.textContent = String(misses);
  result.rPerfect.textContent = String(perfectPlates);

  result.rGoals.textContent = `${Math.min(GOAL_TOTAL, perfectPlates)}/${GOAL_TOTAL}`;
  result.rMinis.textContent = `${miniCleared}/${MINI_TOTAL}`;

  result.g1.textContent = String(groupCount[1]);
  result.g2.textContent = String(groupCount[2]);
  result.g3.textContent = String(groupCount[3]);
  result.g4.textContent = String(groupCount[4]);
  result.g5.textContent = String(groupCount[5]);
  result.gT.textContent = String(gTotal);

  result.rGrade.textContent = gradeFrom(score, misses);

  // show modal
  if (result.backdrop) result.backdrop.style.display = 'flex';

  // ส่ง session log
  emitSession(reason);
}

// ---------- Buttons ----------
btnEnterVR?.addEventListener('click', () => {
  try { scene?.enterVR(); } catch (_) {}
});

btnRestart?.addEventListener('click', () => {
  window.location.reload();
});

result.btnPlayAgain?.addEventListener('click', () => {
  window.location.reload();
});

// ---------- Start ----------
window.addEventListener('DOMContentLoaded', () => {
  // ป้องกัน null
  if (!scene || !cam || !targetRoot) {
    console.error('[PlateVR] missing scene/cam/targetRoot');
    return;
  }

  // เติมค่า HUD เบื้องต้น
  setText(hud.time, GAME_DURATION);
  setText(hud.mode, RUN === 'research' ? 'Research' : 'Play');
  setText(hud.diff, DIFF.charAt(0).toUpperCase() + DIFF.slice(1));

  startGame();
});
