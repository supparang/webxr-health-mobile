// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — FUN/CHALLENGE/EXCITING (1–6) + Research logger
// A-Frame 1.5.0 | Module script
//
// ✅ Fix: target invisible but MISS counts
//   - use <a-text> with material side:double + explicit opacity
//   - add drift tick so you "เห็นเป้าขยับจริง"
//   - safe guards for scene/targetRoot/cam
//
// 1) Plate Streak (perfect ต่อเนื่อง) + multiplier + celebration
// 2) Balance Meter (สัดส่วนหมู่ 1–5) + “เสียสมดุล” penalty/coach
// 3) Power-ups (🥗 Shield / 🍋 Cleanse / ⭐ Golden Bite)
// 4) Hazards (🌪 Wind / 🕳 BlackHole / 🧊 Freeze) — timed events
// 5) Mini-quests ต่อเนื่อง (เคลียร์แล้วสุ่มอันใหม่เรื่อย ๆ) + สรุปจำนวนที่ผ่าน
// 6) Boss Phase ช่วงท้าย 30s (junk↑ แต่คะแนน good↑ + FX ใหญ่)
//
// Emits (for Google Sheet logger / HUD binder):
//   - hha:event, hha:session, hha:score, hha:time, hha:end, hha:judge, hha:coach, quest:update
//
// URL params:
//   ?diff=easy|normal|hard
//   ?time=60..180
//   ?run=play|research
//
// Requires IDs (plate-vr.html):
//   hudTime,hudScore,hudCombo,hudMiss,hudFever,hudFeverPct,hudMode,hudDiff
//   hudGroupsHave,hudPerfectCount,hudGoalLine,hudMiniLine
//   resultBackdrop + rMode,rGrade,rScore,rMaxCombo,rMiss,rPerfect,rGoals,rMinis,rG1..rG5,rGTotal
//   btnRestart,btnPlayAgain,btnEnterVR
//   #targetRoot, #cam, #cursor
//
'use strict';

const URLX = new URL(location.href);
const DIFF = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
let TIME = parseInt(URLX.searchParams.get('time') || '70', 10);
if (Number.isNaN(TIME) || TIME <= 0) TIME = 70;
TIME = Math.max(20, Math.min(180, TIME));
const MODE = (URLX.searchParams.get('run') || 'play').toLowerCase() === 'research' ? 'research' : 'play';

// expose
window.DIFF = DIFF;
window.TIME = TIME;
window.MODE = MODE;

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
function setText(id, v) { const el = $(id); if (el) el.textContent = String(v); }
function setBarPct(id, pct) { const el = $(id); if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`; }
function safeHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

// ---------- A-Frame guards ----------
const A = window.AFRAME;
if (!A) console.error('[PlateVR] AFRAME not found');

const THREE = (A && A.THREE) ? A.THREE : window.THREE;

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.86, lifeMs: 2100, junkRate: 0.12 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.76, lifeMs: 1900, junkRate: 0.18 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.68, lifeMs: 1700, junkRate: 0.24 }
};
const DCFG0 = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- Food pools ----------
const POOL = {
  g1: { id: 1, label: 'หมู่ 1', type: 'good', emojis: ['🥚','🥛','🐟','🍗','🫘'] },
  g2: { id: 2, label: 'หมู่ 2', type: 'good', emojis: ['🍚','🍞','🍜','🥔','🌽'] },
  g3: { id: 3, label: 'หมู่ 3', type: 'good', emojis: ['🥦','🥬','🥕','🍅','🥒'] },
  g4: { id: 4, label: 'หมู่ 4', type: 'good', emojis: ['🍎','🍌','🍇','🍊','🍉'] },
  g5: { id: 5, label: 'หมู่ 5', type: 'good', emojis: ['🥑','🫒','🥜','🧈','🍯'] },
  junk:{ id: 0, label: 'junk',  type: 'junk', emojis: ['🍟','🍔','🍩','🧋','🍭','🥤'] }
};
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

// ---------- Power-ups (3) ----------
const POWER = {
  shield: { key:'shield', emoji:'🥗', label:'SALAD SHIELD', durMs: 5200 },
  cleanse:{ key:'cleanse',emoji:'🍋', label:'CLEANSE', durMs: 0 },
  golden: { key:'golden', emoji:'⭐',  label:'GOLDEN BITE', durMs: 0 }
};

// ---------- Hazards (3) ----------
const HAZ = {
  wind:     { key:'wind',     emoji:'🌪️', label:'WIND GUST',    durMs: 3800 },
  blackhole:{ key:'blackhole',emoji:'🕳️', label:'BLACK HOLE',   durMs: 4200 },
  freeze:   { key:'freeze',   emoji:'🧊', label:'FREEZE RISK',   durMs: 3600 }
};

// ---------- Game state ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');
const cursor = document.getElementById('cursor');

const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

let started = false;
let ended = false;

let tLeft = TIME;
let timerTick = null;

// score/combo/miss
let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

// fever
let fever = 0;           // 0..100
let feverActive = false;
let feverUntilMs = 0;

// plates
let perfectPlates = 0;
let perfectStreak = 0;
let bestStreak = 0;

// per-plate flags
let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let plateTotalHits = 0;

// totals
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

// goal
let goalTotal = 2;
let goalCleared = 0;

// mini (continuous)
let miniTotal = 9999;     // “ต่อเนื่อง”
let miniCleared = 0;
let miniCurrent = null;   // { key, label, target, windowMs, startMs, deadlineMs, kind }
let miniHistory = 0;
const MINI_DEFAULT_WINDOW = 15000;

// Boss phase
let bossOn = false;

// Balance meter
let balancePct = 100;        // 0..100
let unbalanced = false;      // state flag

// power state
let shieldOn = false;
let shieldUntil = 0;
let freezeRisk = false;      // hazard: freeze active -> wrong hit penalty

// hazard state
let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };
let nextHazAtMs = 0;

// spawn control
let spawnTimer = null;
let activeTargets = new Map(); // id -> data
let targetSeq = 0;

// drift tick
let driftRAF = null;
let lastDriftT = 0;

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function nowIso() { return new Date().toISOString(); }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; } // research lock
function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }

function emitGameEvent(payload) {
  emit('hha:event', Object.assign({
    sessionId,
    type: payload.type || '',
    mode: 'PlateVR',
    difficulty: DIFF,
    runMode: MODE,
    timeFromStartMs: fromStartMs(),
    timeLeftSec: tLeft,
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),
    totalScore: score,
    combo,
    misses: miss,
    bossOn: bossOn ? 1 : 0,
    shieldOn: shieldOn ? 1 : 0,
    balancePct: Math.round(balancePct),
    perfectPlates,
    perfectStreak
  }, payload));
}

function emitCoach(text, mood) {
  emit('hha:coach', { sessionId, mode:'PlateVR', text: String(text||''), mood: mood || 'neutral', timeFromStartMs: fromStartMs() });
}

function emitJudge(label) {
  emit('hha:judge', { sessionId, mode:'PlateVR', label: String(label||''), timeFromStartMs: fromStartMs() });
}

function emitScore() {
  emit('hha:score', {
    sessionId,
    mode:'PlateVR',
    score,
    combo,
    comboMax: maxCombo,
    misses: miss,
    fever: Math.round(fever),
    feverOn: feverActive ? 1 : 0,
    timeLeft: tLeft,
    perfectPlates,
    perfectStreak,
    balancePct: Math.round(balancePct),
    shieldOn: shieldOn ? 1 : 0,
    bossOn: bossOn ? 1 : 0
  });
}

function emitTime() {
  emit('hha:time', { sessionId, mode:'PlateVR', sec: tLeft, timeFromStartMs: fromStartMs() });
}

function emitQuestUpdate() {
  // goal: perfect >= goalTotal
  goalCleared = Math.min(goalTotal, perfectPlates);

  // Mini: current
  const m = miniCurrent;
  let mProg = 0, mTgt = 0, mLabel = '';
  let hint = '';

  if (m) {
    mLabel = m.label || '';
    mTgt = m.target || 0;

    // compute progress by kind
    if (m.kind === 'perfect_in_window') mProg = (m._done ? 1 : 0);
    else if (m.kind === 'no_miss_window') mProg = Math.max(0, Math.round((m.deadlineMs - performance.now()) / 1000));
    else if (m.kind === 'hit_group_in_window') mProg = m._count || 0;
    else if (m.kind === 'order_sequence') mProg = m._step || 0;
    else mProg = m._count || 0;

    const sLeft = Math.max(0, Math.ceil((m.deadlineMs - performance.now())/1000));
    hint = `เหลือ ${sLeft}s • ผ่านแล้ว ${miniCleared} ภารกิจ`;
  }

  emit('quest:update', {
    sessionId,
    mode:'PlateVR',
    goal: {
      label: `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${goalTotal} จาน`,
      prog: goalCleared,
      target: goalTotal,
      done: goalCleared >= goalTotal
    },
    mini: m ? {
      label: mLabel,
      prog: (m.kind === 'no_miss_window') ? (mProg) : mProg,
      target: (m.kind === 'no_miss_window') ? Math.ceil(m.windowMs/1000) : mTgt,
      done: !!m._done
    } : null,
    hint
  });
}

// ---------- Difficulty + Adaptive ----------
let adaptiveScale = 1.0;
let adaptiveSpawn = 1.0;
let adaptiveMaxActive = 0;

let aScaleMin = 0.82, aScaleMax = 1.25;
let aSpawnMin = 0.75, aSpawnMax = 1.35;
let aMaxMin = -1, aMaxMax = +2;

function initAdaptiveForDiff() {
  if (!isAdaptiveOn()) { adaptiveScale=1; adaptiveSpawn=1; adaptiveMaxActive=0; return; }
  if (DIFF === 'easy') { aScaleMin=0.90; aScaleMax=1.35; aSpawnMin=0.80; aSpawnMax=1.40; aMaxMin=0; aMaxMax=2; }
  else if (DIFF === 'hard') { aScaleMin=0.75; aScaleMax=1.18; aSpawnMin=0.72; aSpawnMax=1.25; aMaxMin=-1; aMaxMax=1; }
  else { aScaleMin=0.82; aScaleMax=1.25; aSpawnMin=0.75; aSpawnMax=1.35; aMaxMin=-1; aMaxMax=2; }
  adaptiveScale=1; adaptiveSpawn=1; adaptiveMaxActive=0;
}

function currentSpawnIntervalMs() {
  // Boss: faster spawns
  const bossMult = bossOn ? 0.72 : 1.0;
  const ms = Math.round(DCFG0.spawnInterval * bossMult * clamp(adaptiveSpawn, aSpawnMin, aSpawnMax));
  return clamp(ms, 240, 2500);
}
function currentMaxActive() {
  const bossAdd = bossOn ? 1 : 0;
  const v = DCFG0.maxActive + bossAdd + clamp(adaptiveMaxActive, aMaxMin, aMaxMax);
  return clamp(v, 2, 12);
}
function currentScaleBase() {
  const hazShrink = haz.blackhole ? 0.80 : 1.0;
  const s = DCFG0.scale * hazShrink * (isAdaptiveOn() ? adaptiveScale : 1.0);
  return clamp(s, 0.34, 2.2);
}

function bumpAdaptive(onGood) {
  if (!isAdaptiveOn()) return;
  if (onGood) {
    adaptiveScale = clamp(adaptiveScale - 0.020, aScaleMin, aScaleMax);
    adaptiveSpawn = clamp(adaptiveSpawn - 0.018, aSpawnMin, aSpawnMax);
    if (combo > 8 && adaptiveMaxActive < aMaxMax) adaptiveMaxActive += 1;
  } else {
    adaptiveScale = clamp(adaptiveScale + 0.040, aScaleMin, aScaleMax);
    adaptiveSpawn = clamp(adaptiveSpawn + 0.028, aSpawnMin, aSpawnMax);
    if (miss % 3 === 0 && adaptiveMaxActive > aMaxMin) adaptiveMaxActive -= 1;
  }
}

// ---------- HUD/UI ----------
function diffLabel(d) { return (d==='easy')?'Easy':(d==='hard')?'Hard':'Normal'; }
function modeLabel(m) { return (m==='research')?'Research':'Play'; }

function updateHUD() {
  setText('hudTime', tLeft);
  setText('hudScore', score);
  setText('hudCombo', combo);
  setText('hudMiss', miss);

  const pct = Math.round(fever);
  setBarPct('hudFever', pct);
  setText('hudFeverPct', `${pct}%`);

  setText('hudMode', modeLabel(MODE));
  setText('hudDiff', diffLabel(DIFF));

  const haveCount = Object.values(plateHave).filter(Boolean).length;
  setText('hudGroupsHave', `${haveCount}/5`);
  setText('hudPerfectCount', perfectPlates);

  goalCleared = Math.min(goalTotal, perfectPlates);

  const streakTxt = (perfectStreak >= 2) ? ` • STREAK x${perfectStreak}` : '';
  const balTxt = ` • BAL ${Math.round(balancePct)}%${unbalanced ? ' ⚠' : ''}`;
  const goalLine = `ทำ <b>PERFECT PLATE</b> ≥ ${goalTotal} จาน (ตอนนี้ ${goalCleared}/${goalTotal})${streakTxt}${balTxt}`;
  safeHTML('hudGoalLine', goalLine);

  if (miniCurrent) {
    const sLeft = Math.max(0, Math.ceil((miniCurrent.deadlineMs - performance.now())/1000));
    setText('hudMiniLine', `Mini: ${miniCurrent.label} • เหลือ ${sLeft}s • ผ่านแล้ว ${miniCleared}`);
  } else {
    setText('hudMiniLine', `Mini: กำลังเตรียมภารกิจ...`);
  }

  emitScore();
  emitQuestUpdate();
}

function calcGrade() {
  // แนวเดียวกับ GoodJunk: ยิ่งทำครบภารกิจ + streak + สมดุลดี => เกรดสูง
  const dur = Math.max(1, TIME);
  const sps = score / dur;

  const questBonus = (goalCleared >= goalTotal ? 80 : goalCleared * 25) + (miniCleared * 18);
  const streakBonus = bestStreak * 20;
  const balanceBonus = Math.round(balancePct) * 0.6;

  const penalty = miss * 7 + Math.max(0, 10 - maxCombo) * 2 + (unbalanced ? 18 : 0);

  const v = (sps * 100) + questBonus + streakBonus + balanceBonus - penalty;

  if (v >= 320) return 'SSS';
  if (v >= 270) return 'SS';
  if (v >= 220) return 'S';
  if (v >= 175) return 'A';
  if (v >= 130) return 'B';
  return 'C';
}

function showResult() {
  const bd = $('resultBackdrop');
  if (bd) bd.style.display = 'flex';

  setText('rMode', modeLabel(MODE));
  setText('rScore', score);
  setText('rMaxCombo', maxCombo);
  setText('rMiss', miss);
  setText('rPerfect', perfectPlates);
  setText('rGoals', `${goalCleared}/${goalTotal}`);
  // ✅ mini = จำนวนที่ผ่านจริง
  setText('rMinis', `${miniCleared}`);

  setText('rG1', totalsByGroup[1]);
  setText('rG2', totalsByGroup[2]);
  setText('rG3', totalsByGroup[3]);
  setText('rG4', totalsByGroup[4]);
  setText('rG5', totalsByGroup[5]);

  const gTotal = totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5];
  setText('rGTotal', gTotal);

  setText('rGrade', calcGrade());
}

function hideResult() {
  const bd = $('resultBackdrop');
  if (bd) bd.style.display = 'none';
}

// ---------- Touch look ----------
function ensureTouchLookControls() {
  if (!cam) return;
  try { cam.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true'); } catch (_) {}
  try { cam.setAttribute('wasd-controls-enabled', 'false'); } catch (_) {}
}

// ---------- Fever ----------
function addFever(delta) {
  if (feverActive) return;
  fever = clamp(fever + delta, 0, 100);
  if (fever >= 100) { fever = 100; startFever(); }
}
function startFever() {
  feverActive = true;
  feverUntilMs = performance.now() + 8000;
  emitGameEvent({ type: 'fever_on' });
  emitCoach('FEVER ON! คะแนน x2 + เป้าเพิ่ม! 🔥', 'fever');
  emitJudge('FEVER!');
}
function endFever() {
  feverActive = false;
  feverUntilMs = 0;
  fever = 0;
  emitGameEvent({ type: 'fever_off' });
  emitCoach('Fever จบแล้ว สู้ต่อ! 💪', 'neutral');
}

// ---------- Balance meter ----------
function recomputeBalance() {
  const a = plateCounts[1], b = plateCounts[2], c = plateCounts[3], d = plateCounts[4], e = plateCounts[5];
  const total = Math.max(1, a+b+c+d+e);

  // เป้าหมาย: ผัก/ผลไม้ (3,4) เด่น, หมู่2/5 ไม่เกิน
  const p2 = b/total;
  const p5 = e/total;
  const p34 = (c+d)/total;

  let pct = 100;
  pct -= clamp((p2 - 0.35) * 220, 0, 35);   // หมู่2 เยอะไป
  pct -= clamp((p5 - 0.20) * 260, 0, 35);   // หมู่5 เยอะไป
  pct += clamp((p34 - 0.35) * 120, -10, 20);// ผักผลไม้ช่วย

  pct = clamp(pct, 0, 100);
  balancePct = pct;

  const was = unbalanced;
  unbalanced = (pct < 55);

  if (!was && unbalanced) {
    emitCoach('สมดุลเริ่มเสียแล้ว! รีบเติมผัก/ผลไม้ (หมู่3–4) 🔄🥦🍎', 'sad');
    emitJudge('UNBALANCED!');
    emitGameEvent({ type:'balance_bad', extra:`pct=${Math.round(pct)}` });
  }
  if (was && !unbalanced) {
    emitCoach('กลับมาสมดุลแล้ว เก่งมาก! ✅', 'happy');
    emitJudge('BALANCED!');
    emitGameEvent({ type:'balance_good', extra:`pct=${Math.round(pct)}` });
  }
}

// ---------- Plate logic ----------
function resetPlate() {
  plateHave = { 1:false,2:false,3:false,4:false,5:false };
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  plateTotalHits = 0;
  balancePct = 100;
  unbalanced = false;
  recomputeBalance();
}

function completePerfectPlate() {
  perfectPlates += 1;

  // 1) STREAK
  perfectStreak += 1;
  bestStreak = Math.max(bestStreak, perfectStreak);

  emitGameEvent({
    type: 'plate_perfect',
    judgment: 'PERFECT',
    extra: JSON.stringify({ perfectPlates, perfectStreak })
  });

  emitJudge(perfectStreak >= 2 ? `PERFECT x${perfectStreak}!` : 'PERFECT!');
  emitCoach(perfectStreak >= 3
    ? `โหดมาก! PERFECT STREAK x${perfectStreak} 🔥`
    : `ดีมาก! ได้ PERFECT PLATE แล้ว ✅`, 'happy');

  // 5) MINI (continuous) — clear when mini says so (perfect-based minis check here)
  if (miniCurrent && miniCurrent.kind === 'perfect_in_window') {
    if (performance.now() <= miniCurrent.deadlineMs) {
      miniCurrent._done = true;
      miniCleared += 1;
      miniHistory += 1;
      emitGameEvent({ type:'mini_clear', judgment:'OK', extra:`${miniCleared}` });
      emitCoach(`Mini เคลียร์แล้ว! (+1) รวมผ่าน ${miniCleared} ภารกิจ 🎉`, 'happy');
      emitJudge('MINI CLEAR!');
      nextMini();
    } else {
      // fail handled by tickMini
    }
  }

  resetPlate();
  updateHUD();
}

// ---------- Power-ups ----------
function giveShield() {
  shieldOn = true;
  shieldUntil = performance.now() + POWER.shield.durMs;
  emitGameEvent({ type:'power_on', power:'shield', extra:`durMs=${POWER.shield.durMs}` });
  emitCoach('ได้ 🥗 SALAD SHIELD! ขยะไม่ทำให้ MISS ชั่วคราว 🛡️', 'happy');
  emitJudge('SHIELD!');
}
function giveCleanse() {
  unbalanced = false;
  balancePct = Math.max(balancePct, 75);
  emitGameEvent({ type:'power_use', power:'cleanse' });
  emitCoach('🍋 CLEANSE! ล้าง “เสียสมดุล” แล้ว ✅', 'happy');
  emitJudge('CLEANSE!');
}
function giveGoldenBite() {
  // นับเป็น “2 หมู่” โดยเติมหมู่ที่ยังขาดก่อน
  const missing = [1,2,3,4,5].filter(g => !plateHave[g]);
  const picks = [];
  if (missing.length >= 2) {
    picks.push(missing[0], missing[1]);
  } else if (missing.length === 1) {
    picks.push(missing[0]);
    picks.push(pick([1,2,3,4,5]));
  } else {
    picks.push(pick([1,2,3,4,5]), pick([1,2,3,4,5]));
  }

  for (const g of picks) {
    plateCounts[g] = (plateCounts[g]||0) + 1;
    if (!plateHave[g]) plateHave[g] = true;
    totalsByGroup[g] = (totalsByGroup[g]||0) + 1;
  }
  recomputeBalance();

  emitGameEvent({ type:'power_use', power:'golden', extra:`addGroups=${picks.join(',')}` });
  emitCoach('⭐ GOLDEN BITE! เติมหมู่ให้เร็วขึ้น x2 ⚡', 'happy');
  emitJudge('GOLDEN!');
}

// ---------- Hazards ----------
function setHazard(key, on) {
  haz[key] = !!on;
  if (key === 'freeze') freezeRisk = !!on;

  emitGameEvent({ type: on ? 'hazard_on' : 'hazard_off', hazard:key });
  emitCoach(on
    ? `ระวัง! ${HAZ[key].emoji} ${HAZ[key].label} เริ่มแล้ว!`
    : `${HAZ[key].label} จบแล้ว สู้ต่อ!`, on ? 'sad' : 'neutral');
  emitJudge(on ? HAZ[key].label : '');
}

function triggerRandomHazard() {
  if (ended || !started) return;

  // research mode: ลดความวุ่นวาย
  const allow = (MODE === 'play') || (Math.random() < 0.25);

  if (!allow) return;

  const key = pick(['wind','blackhole','freeze']);
  const dur = HAZ[key].durMs;

  hazUntil[key] = performance.now() + dur;
  setHazard(key, true);

  // auto off
  setTimeout(() => {
    if (ended) return;
    if (performance.now() >= hazUntil[key]) setHazard(key, false);
  }, dur + 50);
}

// ---------- Mini quests (continuous) ----------
function makeMiniDef() {
  // เลือกชนิดภารกิจแบบเร้าใจ
  const defs = [
    // ทำ PERFECT ภายในเวลา
    { kind:'perfect_in_window', label:'ทำ PERFECT ให้ได้ภายใน 15 วิ', target:1, windowMs:15000 },

    // เก็บหมู่ X ในเวลา
    { kind:'hit_group_in_window', label:'ภายใน 12 วิ เก็บหมู่ 3 ให้ได้ 2 ครั้ง', target:2, windowMs:12000, groupId:3 },
    { kind:'hit_group_in_window', label:'ภายใน 12 วิ เก็บหมู่ 4 ให้ได้ 2 ครั้ง', target:2, windowMs:12000, groupId:4 },

    // ห้ามพลาดช่วงสั้น (นับเป็น “อยู่รอดให้ครบวินาที”)
    { kind:'no_miss_window', label:'ห้าม MISS 10 วิ (เอาตัวรอด!)', target:10, windowMs:10000 },

    // ลำดับ (sequence)
    { kind:'order_sequence', label:'เก็บตามลำดับ 1 → 3 → 4', target:3, windowMs:16000, seq:[1,3,4] }
  ];

  // Boss ช่วงท้าย: ทำภารกิจยากขึ้นนิด
  if (bossOn) defs.push(
    { kind:'hit_group_in_window', label:'BOSS: ภายใน 10 วิ เก็บหมู่ 3 ให้ได้ 3', target:3, windowMs:10000, groupId:3 }
  );

  return pick(defs);
}

function nextMini() {
  const def = makeMiniDef();
  const startMs = performance.now();
  miniCurrent = {
    key: def.kind + '-' + Math.random().toString(36).slice(2,6),
    kind: def.kind,
    label: def.label,
    target: def.target || 0,
    windowMs: def.windowMs || MINI_DEFAULT_WINDOW,
    startMs,
    deadlineMs: startMs + (def.windowMs || MINI_DEFAULT_WINDOW),

    // progress fields
    _done: false,
    _count: 0,
    _missAtStart: miss,
    _step: 0,
    _seq: Array.isArray(def.seq) ? def.seq.slice() : null,
    _needGroup: def.groupId || 0
  };

  emitGameEvent({ type:'mini_next', extra: JSON.stringify({ kind:miniCurrent.kind, label:miniCurrent.label }) });
  emitCoach(`Mini ใหม่! ${miniCurrent.label} 🎯`, 'neutral');
  emitQuestUpdate();
}

function tickMini() {
  if (!miniCurrent || ended) return;

  // time out => fail
  if (performance.now() > miniCurrent.deadlineMs) {
    if (!miniCurrent._done) {
      emitGameEvent({ type:'mini_fail', extra: miniCurrent.label });
      emitCoach(`Mini พลาดแล้ว 😅 เดี๋ยวสุ่มอันใหม่ให้!`, 'sad');
      emitJudge('MINI FAIL');
    }
    nextMini();
    return;
  }

  // no_miss_window: ถ้ามี miss เพิ่มหลังเริ่ม => fail ทันที
  if (miniCurrent.kind === 'no_miss_window') {
    if (miss > miniCurrent._missAtStart) {
      emitGameEvent({ type:'mini_fail', extra:'missed' });
      emitCoach('โอ๊ะ! มี MISS ระหว่างภารกิจ เอาใหม่! 😄', 'sad');
      emitJudge('MINI FAIL');
      nextMini();
      return;
    }
    // ถ้าอยู่รอดจนใกล้หมดเวลา ถือว่า “กำลังทำสำเร็จ” (done ตอนหมด window)
    const sLeft = Math.ceil((miniCurrent.deadlineMs - performance.now())/1000);
    if (sLeft <= 0 && !miniCurrent._done) {
      miniCurrent._done = true;
      miniCleared += 1;
      miniHistory += 1;
      emitGameEvent({ type:'mini_clear', judgment:'OK', extra:`${miniCleared}` });
      emitCoach(`โหดมาก! รอดครบเวลา ✅ รวมผ่าน ${miniCleared} ภารกิจ`, 'happy');
      emitJudge('MINI CLEAR!');
      nextMini();
    }
  }

  // order_sequence: done when step==target
  if (miniCurrent.kind === 'order_sequence') {
    if (miniCurrent._step >= miniCurrent.target && !miniCurrent._done) {
      miniCurrent._done = true;
      miniCleared += 1;
      miniHistory += 1;
      emitGameEvent({ type:'mini_clear', judgment:'OK', extra:`${miniCleared}` });
      emitCoach(`จำลำดับได้เก่งมาก! ✅ รวมผ่าน ${miniCleared}`, 'happy');
      emitJudge('MINI CLEAR!');
      nextMini();
    }
  }

  // hit_group_in_window: done when count >= target
  if (miniCurrent.kind === 'hit_group_in_window') {
    if (miniCurrent._count >= miniCurrent.target && !miniCurrent._done) {
      miniCurrent._done = true;
      miniCleared += 1;
      miniHistory += 1;
      emitGameEvent({ type:'mini_clear', judgment:'OK', extra:`${miniCleared}` });
      emitCoach(`สุดยอด! ทำตามโจทย์ทันเวลา ✅ รวมผ่าน ${miniCleared}`, 'happy');
      emitJudge('MINI CLEAR!');
      nextMini();
    }
  }

  emitQuestUpdate();
}

// ---------- Spawn item picker ----------
function bossJunkRate() {
  // Boss = junk เพิ่ม แต่ยังเล่นได้
  return clamp(DCFG0.junkRate + (bossOn ? 0.10 : 0), 0.06, 0.45);
}

function pickItem() {
  // Power-up spawn chance (play mode เด่นกว่า)
  const pPower = (MODE === 'play') ? 0.10 : 0.05; // 10% powerup
  if (Math.random() < pPower) {
    const k = pick(['shield','cleanse','golden']);
    return { kind:'power', powerKey:k, groupId:-1, type:'power', emoji: POWER[k].emoji };
  }

  // Junk or good
  if (Math.random() < bossJunkRate()) {
    const emoji = pick(POOL.junk.emojis);
    return { kind:'food', groupId:0, key:'junk', type:'junk', emoji };
  }

  const missing = GROUP_KEYS.filter(k => !plateHave[POOL[k].id]);
  const key = (missing.length && Math.random() < 0.72) ? pick(missing) : pick(GROUP_KEYS);
  const g = POOL[key];
  const emoji = pick(g.emojis);
  return { kind:'food', groupId:g.id, key, type:'good', emoji };
}

// ---------- Target creation (FIX visibility) ----------
function createTargetEntity(item, id) {
  const el = document.createElement('a-text');

  el.setAttribute('id', id);
  el.classList.add('plateTarget');

  // ✅ Make sure raycaster sees it:
  // (a-text has geometry in A-Frame; adding class is enough for raycaster objects:.plateTarget)
  el.setAttribute('value', item.emoji);
  el.setAttribute('align', 'center');
  el.setAttribute('baseline', 'center');
  el.setAttribute('width', '3.8');
  el.setAttribute('color', '#ffffff');

  // ✅ ensure visible both sides
  el.setAttribute('material', 'shader:flat; side:double; transparent:true; opacity:1');

  // pop
  const s = currentScaleBase();
  el.setAttribute('scale', `${s} ${s} ${s}`);
  el.setAttribute('animation__pop', `property:scale; from:0.01 0.01 0.01; to:${s} ${s} ${s}; dur:120; easing:easeOutBack`);

  // click + cursor fuse works as click event too
  el.addEventListener('click', () => onHitTarget(id, 'CLICK'));

  return el;
}

function spawnTarget() {
  if (ended || !started) return;
  if (!targetRoot || !cam) return;
  if (activeTargets.size >= currentMaxActive()) return;

  const item = pickItem();
  const id = `t${++targetSeq}`;

  // Spawn position (relative to targetRoot, which is attached to camera)
  // keep within view cone
  const x = rnd(-1.05, 1.05);
  const y = rnd(-0.10, 0.95);     // around camera center
  const z = rnd(-0.40, -1.10);    // in front of camera (targetRoot is already -2.2)

  const el = createTargetEntity(item, id);
  el.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);

  // store drift velocity (hazard wind makes it stronger)
  const baseV = 0.18;
  const vx = rnd(-baseV, baseV) * (haz.wind ? 1.8 : 1.0);
  const vy = rnd(-baseV*0.6, baseV*0.6) * (haz.wind ? 1.5 : 1.0);

  const spawnMs = performance.now();

  // append
  targetRoot.appendChild(el);

  // expire
  const expireTimer = setTimeout(() => {
    if (activeTargets.has(id)) {
      removeTarget(id);
      onTargetExpired(item);
    }
  }, DCFG0.lifeMs);

  activeTargets.set(id, {
    el,
    spawnMs,
    groupId: item.groupId,
    type: item.type,
    emoji: item.emoji,
    kind: item.kind,
    powerKey: item.powerKey || '',
    vx, vy,
    expireTimer
  });

  emitGameEvent({
    type: 'spawn',
    targetId: id,
    emoji: item.emoji,
    itemType: item.type,
    kind: item.kind,
    power: item.powerKey || '',
    isGood: item.type === 'good' || item.type === 'power'
  });
}

function removeTarget(id) {
  const t = activeTargets.get(id);
  if (!t) return;
  activeTargets.delete(id);
  try { clearTimeout(t.expireTimer); } catch (_) {}
  try { t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el); } catch (_) {}
}

// ---------- Drift loop (เห็นเป้าบิน/ลื่น) ----------
function driftLoop(ts) {
  if (ended || !started) return;

  if (!lastDriftT) lastDriftT = ts;
  const dt = Math.min(0.05, (ts - lastDriftT) / 1000);
  lastDriftT = ts;

  const boundX = 1.18;
  const boundY = 1.00;

  for (const [id, t] of activeTargets.entries()) {
    const el = t.el;
    if (!el) continue;

    const p = el.getAttribute('position');
    if (!p) continue;

    let x = Number(p.x) || 0;
    let y = Number(p.y) || 0;

    // wind makes faster
    const mult = haz.wind ? 1.7 : 1.0;
    x += (t.vx * mult) * dt;
    y += (t.vy * mult) * dt;

    // bounce in bounds
    if (x > boundX) { x = boundX; t.vx *= -1; }
    if (x < -boundX){ x = -boundX; t.vx *= -1; }
    if (y > boundY) { y = boundY; t.vy *= -1; }
    if (y < -boundY){ y = -boundY; t.vy *= -1; }

    el.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${p.z.toFixed(3)}`);
  }

  driftRAF = requestAnimationFrame(driftLoop);
}
function startDrift() {
  if (driftRAF) cancelAnimationFrame(driftRAF);
  driftRAF = requestAnimationFrame(driftLoop);
}
function stopDrift() {
  if (driftRAF) cancelAnimationFrame(driftRAF);
  driftRAF = null;
  lastDriftT = 0;
}

// ---------- Scoring rules ----------
function scoreMultFromStreak() {
  // 1) streak multiplier
  if (perfectStreak >= 4) return 2.0;
  if (perfectStreak === 3) return 1.5;
  if (perfectStreak === 2) return 1.2;
  return 1.0;
}

function addScore(base) {
  const feverMult = feverActive ? 2 : 1;
  const cMult = Math.min(4, 1 + combo * 0.06);
  const streakMult = scoreMultFromStreak();
  const balMult = unbalanced ? 0.85 : 1.0; // 2) penalty when unbalanced
  const bossMult = bossOn ? 1.15 : 1.0;    // 6) boss bonus

  score += Math.round(base * feverMult * cMult * streakMult * balMult * bossMult);
}

// ---------- Hit / Expire ----------
function onHitTarget(id, why) {
  if (ended) return;
  const t = activeTargets.get(id);
  if (!t) return;

  const rt = Math.max(0, Math.round(performance.now() - t.spawnMs));
  removeTarget(id);

  // Power-ups
  if (t.type === 'power') {
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    addScore(16);
    addFever(10);

    emitGameEvent({
      type: 'hit_power',
      targetId: id,
      emoji: t.emoji,
      itemType: 'power',
      power: t.powerKey,
      rtMs: rt,
      judgment: 'POWER',
      isGood: true,
      extra: why
    });

    if (t.powerKey === 'shield') giveShield();
    else if (t.powerKey === 'cleanse') giveCleanse();
    else if (t.powerKey === 'golden') giveGoldenBite();

    bumpAdaptive(true);
    updateHUD();
    return;
  }

  // Junk hit
  if (t.type === 'junk') {
    // 3) Shield blocks junk -> NOT count as Miss
    if (shieldOn && performance.now() <= shieldUntil) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      addScore(8);
      addFever(6);

      emitGameEvent({
        type: 'hit',
        targetId: id,
        emoji: t.emoji,
        itemType: 'junk',
        rtMs: rt,
        judgment: 'BLOCK',
        isGood: false,
        extra: 'shield_block'
      });

      emitJudge('BLOCK!');
      emitCoach('โล่กันไว้! ขยะไม่ทำให้ MISS 🛡️', 'happy');
      bumpAdaptive(true);
      updateHUD();
      return;
    }

    // Freeze risk: wrong hit penalty stronger
    miss += freezeRisk ? 2 : 1;
    combo = 0;
    addFever(-18);

    emitGameEvent({
      type: 'hit',
      targetId: id,
      emoji: t.emoji,
      itemType: 'junk',
      rtMs: rt,
      judgment: freezeRisk ? 'BADx2' : 'BAD',
      isGood: false,
      extra: why
    });

    emitJudge('BAD!');
    emitCoach(freezeRisk ? 'FREEZE อยู่! กดยิงพลาด เจ็บหนัก x2 😵‍💫' : 'โดนของขยะแล้วนะ ระวัง! 😅', 'sad');

    // 1) streak break
    perfectStreak = 0;

    bumpAdaptive(false);
    updateHUD();
    return;
  }

  // Good hit
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  addScore(12);
  addFever(11);

  plateTotalHits += 1;
  totalsByGroup[t.groupId] = (totalsByGroup[t.groupId] || 0) + 1;

  plateCounts[t.groupId] = (plateCounts[t.groupId] || 0) + 1;
  if (!plateHave[t.groupId]) plateHave[t.groupId] = true;

  // mini progress hooks
  if (miniCurrent) {
    if (miniCurrent.kind === 'hit_group_in_window' && miniCurrent._needGroup === t.groupId) {
      miniCurrent._count = (miniCurrent._count || 0) + 1;
    }
    if (miniCurrent.kind === 'order_sequence' && miniCurrent._seq) {
      const need = miniCurrent._seq[miniCurrent._step] || null;
      if (need === t.groupId) {
        miniCurrent._step = (miniCurrent._step || 0) + 1;
      } else {
        // wrong order => reset step (ท้าทาย!)
        miniCurrent._step = 0;
      }
    }
  }

  recomputeBalance();

  emitGameEvent({
    type: 'hit',
    targetId: id,
    emoji: t.emoji,
    itemType: `g${t.groupId}`,
    rtMs: rt,
    judgment: unbalanced ? 'GOOD*' : 'GOOD',
    isGood: true,
    extra: why
  });

  // 2) unbalanced => ลดความยาวคอมโบแบบนิด ๆ ให้รู้สึกกดดัน
  if (unbalanced && combo > 0 && (combo % 6 === 0)) {
    emitCoach('ยังเสียสมดุลอยู่ เติมผัก/ผลไม้เร็ว! 🥦🍎', 'sad');
  }

  emitJudge('GOOD!');

  bumpAdaptive(true);

  const haveCount = Object.values(plateHave).filter(Boolean).length;
  if (haveCount >= 5) completePerfectPlate();

  // 5) mini tick check
  tickMini();

  updateHUD();
}

function onTargetExpired(item) {
  if (ended) return;

  miss += 1;
  combo = 0;
  addFever(-10);

  // 1) streak break
  perfectStreak = 0;

  emitGameEvent({
    type: 'expire',
    emoji: item.emoji,
    itemType: item.type === 'junk' ? 'junk' : `g${item.groupId}`,
    judgment: 'MISS',
    isGood: item.type !== 'junk'
  });

  emitJudge('MISS');
  emitCoach('เป้าหลุด! โฟกัสให้มากขึ้นนะ 🎯', 'sad');

  bumpAdaptive(false);

  // mini: no_miss_window fails handled in tickMini (it checks miss change)
  tickMini();

  updateHUD();
}

// ---------- Main timer ----------
function tickBossPhase() {
  // 6) boss on last 30 seconds
  if (!bossOn && tLeft <= 30) {
    bossOn = true;
    emitGameEvent({ type:'boss_on' });
    emitCoach('BOSS PHASE! 30 วิสุดท้าย ขยะเพิ่ม แต่คะแนนดีพุ่ง! 💥', 'fever');
    emitJudge('BOSS!');
    // hazard schedule gets tighter
    nextHazAtMs = performance.now() + 1200;
  }
}

function tickShield() {
  if (shieldOn && performance.now() > shieldUntil) {
    shieldOn = false;
    shieldUntil = 0;
    emitGameEvent({ type:'power_off', power:'shield' });
    emitCoach('โล่หมดเวลาแล้ว ระวังขยะนะ 🥲', 'neutral');
  }
}

function tickHazards() {
  // auto off by until check (safety)
  for (const k of ['wind','blackhole','freeze']) {
    if (haz[k] && performance.now() >= hazUntil[k]) setHazard(k, false);
  }

  // schedule next hazard
  if (!nextHazAtMs) {
    // first hazard: after 6–10s
    nextHazAtMs = performance.now() + rnd(6000, 10000);
  } else if (performance.now() >= nextHazAtMs) {
    triggerRandomHazard();
    // next: 8–14s (boss tighter: 5–9s)
    nextHazAtMs = performance.now() + (bossOn ? rnd(5000, 9000) : rnd(8000, 14000));
  }
}

function startTimer() {
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(() => {
    if (!started || ended) return;

    if (feverActive && performance.now() >= feverUntilMs) endFever();

    tickBossPhase();
    tickShield();
    tickHazards();
    tickMini();

    tLeft -= 1;
    if (tLeft <= 0) {
      tLeft = 0;
      emitTime();
      updateHUD();
      endGame('time_up');
      return;
    }

    emitTime();
    updateHUD();
  }, 1000);
}

// ---------- Spawning ----------
function scheduleNextSpawn() {
  if (ended || !started) return;

  const ms = isAdaptiveOn() ? currentSpawnIntervalMs() : DCFG0.spawnInterval;
  spawnTimer = setTimeout(() => {
    if (!started || ended) return;

    // fever = more targets
    const n = feverActive ? (Math.random() < 0.45 ? 2 : 1) : 1;

    for (let i = 0; i < n; i++) spawnTarget();

    scheduleNextSpawn();
  }, ms);
}

function stopSpawning() {
  if (spawnTimer) clearTimeout(spawnTimer);
  spawnTimer = null;
}

// ---------- Clear targets ----------
function clearAllTargets() {
  for (const id of Array.from(activeTargets.keys())) removeTarget(id);
  activeTargets.clear();
}

// ---------- Cloud session end ----------
function emitSessionEnd(reason) {
  const gTotal = totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5];

  emit('hha:session', {
    sessionId,
    mode: 'PlateVR',
    difficulty: DIFF,
    runMode: MODE,

    durationSecPlayed: TIME - tLeft,
    scoreFinal: score,
    comboMax: maxCombo,
    misses: miss,

    goalsCleared: goalCleared,
    goalsTotal: goalTotal,

    miniCleared: miniCleared,
    miniTotal: miniHistory,     // ✅ “ทำผ่านทั้งหมดกี่อัน”
    miniShown: miniHistory,

    nHitGood: gTotal,
    nHitJunk: '',

    reason: reason || '',

    extra: JSON.stringify({
      totalsByGroup,
      perfectPlates,
      bestStreak,
      balancePct: Math.round(balancePct),
      bossOn,
      miniCleared
    }),

    startTimeIso: sessionStartIso,
    endTimeIso: nowIso(),
    gameVersion: 'PlateVR-2025-12-17a'
  });

  emit('hha:end', {
    sessionId,
    mode: 'PlateVR',
    difficulty: DIFF,
    runMode: MODE,
    score,
    comboMax: maxCombo,
    misses: miss,
    goalsCleared: goalCleared,
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: miniHistory,
    perfectPlates,
    bestStreak,
    balancePct: Math.round(balancePct)
  });
}

// ---------- Start / End ----------
function startGame() {
  if (started) return;
  started = true;
  ended = false;

  initAdaptiveForDiff();
  resetPlate();

  // mini start
  nextMini();

  emitGameEvent({ type: 'start', judgment: 'OK', extra: `run=${MODE}` });
  emitCoach('เริ่มเลย! ทำจานให้ “สมดุล” และล่า PERFECT STREAK! 🍽️✨', 'neutral');

  updateHUD();
  emitTime();

  startDrift();
  startTimer();
  scheduleNextSpawn();
}

function endGame(reason) {
  if (ended) return;
  ended = true;
  started = false;

  stopSpawning();
  if (timerTick) clearInterval(timerTick);
  timerTick = null;

  stopDrift();

  if (feverActive) endFever();

  clearAllTargets();

  emitGameEvent({ type: 'end', judgment: 'OK', extra: reason || '' });

  // finalize miniTotal shown as passed count
  miniHistory = miniCleared;

  emitSessionEnd(reason || 'end');

  showResult();
}

function bindUI() {
  const btnRestart = $('btnRestart');
  if (btnRestart) btnRestart.addEventListener('click', () => location.reload());

  const btnPlayAgain = $('btnPlayAgain');
  if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => location.reload());

  const btnEnterVR = $('btnEnterVR');
  if (btnEnterVR && scene) {
    btnEnterVR.addEventListener('click', async () => {
      try { await scene.enterVR(); } catch (e) { console.warn('[PlateVR] enterVR failed', e); }
    });
  }

  const bd = $('resultBackdrop');
  if (bd) {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) hideResult();
    });
  }
}

// ---------- Logger init ----------
function initLoggerIfAvailable() {
  const init = window.initCloudLogger;
  if (typeof init !== 'function') return;

  const endpoint =
    (window.HHA_LOG_ENDPOINT) ||
    (sessionStorage && sessionStorage.getItem('HHA_LOG_ENDPOINT')) ||
    '';

  try {
    init({
      endpoint,
      projectTag: 'HeroHealth-PlateVR',
      mode: 'PlateVR',
      runMode: MODE,
      diff: DIFF,
      durationSec: TIME,
      debug: true
    });
  } catch (e) {
    console.warn('[PlateVR] initCloudLogger error', e);
  }
}

// ---------- Boot ----------
function boot() {
  ensureTouchLookControls();
  bindUI();

  setText('hudMode', modeLabel(MODE));
  setText('hudDiff', diffLabel(DIFF));
  setText('hudTime', tLeft);

  // init logger
  initLoggerIfAvailable();
  let tries = 0;
  const retry = setInterval(() => {
    if (typeof window.initCloudLogger === 'function') {
      initLoggerIfAvailable();
      clearInterval(retry);
    }
    tries += 1;
    if (tries > 12) clearInterval(retry);
  }, 250);

  // safety: if no targetRoot -> don't start silently
  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    emitCoach('หา targetRoot ไม่เจอ! ตรวจ path/ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad');
    return;
  }

  // start when scene ready
  if (scene) {
    if (scene.hasLoaded) startGame();
    else scene.addEventListener('loaded', startGame);
  } else {
    setTimeout(startGame, 350);
  }

  // stop if tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended) endGame('tab_hidden');
  });
}

window.addEventListener('DOMContentLoaded', boot);