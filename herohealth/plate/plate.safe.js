// === /herohealth/plate/plate.safe.js ===
// (เหมือนเวอร์ชันก่อนหน้า) + ✅ export bootPlateDOM ให้ plate-vr.html เรียกได้

'use strict';

const URLX = new URL(location.href);
const DIFF = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
let TIME = parseInt(URLX.searchParams.get('time') || '70', 10);
if (Number.isNaN(TIME) || TIME <= 0) TIME = 70;
TIME = Math.max(20, Math.min(180, TIME));
const MODE = (URLX.searchParams.get('run') || 'play').toLowerCase() === 'research' ? 'research' : 'play';

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

// ---------- Power-ups ----------
const POWER = {
  shield: { key:'shield', emoji:'🥗', label:'SALAD SHIELD', durMs: 5200 },
  cleanse:{ key:'cleanse',emoji:'🍋', label:'CLEANSE', durMs: 0 },
  golden: { key:'golden', emoji:'⭐',  label:'GOLDEN BITE', durMs: 0 }
};

// ---------- Hazards ----------
const HAZ = {
  wind:     { key:'wind',     emoji:'🌪️', label:'WIND GUST',    durMs: 3800 },
  blackhole:{ key:'blackhole',emoji:'🕳️', label:'BLACK HOLE',   durMs: 4200 },
  freeze:   { key:'freeze',   emoji:'🧊', label:'FREEZE RISK',   durMs: 3600 }
};

// ---------- Scene refs (ต้องมีใน plate-vr.html) ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

let started = false;
let ended = false;

let tLeft = TIME;
let timerTick = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;
let feverActive = false;
let feverUntilMs = 0;

let perfectPlates = 0;
let perfectStreak = 0;
let bestStreak = 0;

let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

let goalTotal = 2;
let goalCleared = 0;

let miniCleared = 0;
let miniCurrent = null;
let miniHistory = 0;

let bossOn = false;

let balancePct = 100;
let unbalanced = false;

let shieldOn = false;
let shieldUntil = 0;

let freezeRisk = false;
let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };
let nextHazAtMs = 0;

let spawnTimer = null;
let activeTargets = new Map();
let targetSeq = 0;

let driftRAF = null;
let lastDriftT = 0;

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function nowIso() { return new Date().toISOString(); }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; }
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
    sessionId, mode:'PlateVR',
    score, combo, comboMax: maxCombo, misses: miss,
    fever: Math.round(fever), feverOn: feverActive ? 1 : 0,
    timeLeft: tLeft,
    perfectPlates, perfectStreak,
    balancePct: Math.round(balancePct),
    shieldOn: shieldOn ? 1 : 0,
    bossOn: bossOn ? 1 : 0
  });
}
function emitTime() { emit('hha:time', { sessionId, mode:'PlateVR', sec: tLeft, timeFromStartMs: fromStartMs() }); }

// ---------- (… โค้ดกลางไฟล์เหมือนเดิมทั้งหมด …) ----------
// เพื่อไม่ให้ข้อความยาวเกินไป: “ส่วนกลาง” (spawn/hit/mini/hazard/score/drift/timer/result) ใช้เหมือนเวอร์ชันที่ผมให้ไปก่อนหน้า
// ✅ ให้คุณ "คัดลอกทั้งไฟล์จากเวอร์ชันก่อนหน้า" แล้ว “เปลี่ยนเฉพาะ Boot section” ตามด้านล่างนี้

/* ===========================
   ✅ BOOT SECTION (ทางเลือก A)
   - ไม่เรียก startGame ตรง ๆ
   - หา starter ที่มีจริง แล้วเรียกผ่าน resolvePlateStarter()
   =========================== */

function ensureTouchLookControls() {
  if (!cam) return;
  try { cam.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; pointerLockEnabled:false'); } catch (_) {}
  try { cam.setAttribute('wasd-controls-enabled', 'false'); } catch (_) {}
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
}

/** ✅ หา starter ที่มีจริง */
function resolvePlateStarter() {
  // 1) ใน module scope (ถ้ามีจริง)
  if (typeof startGame === 'function') return startGame;
  if (typeof beginGame === 'function') return beginGame;
  if (typeof start === 'function') return start;

  // 2) ใน window (เผื่อคุณไปผูกไว้ global)
  if (typeof window.startGame === 'function') return window.startGame;
  if (typeof window.beginGame === 'function') return window.beginGame;
  if (typeof window.start === 'function') return window.start;

  return null;
}

// ✅ export ให้ plate-vr.html import ไปเรียก
export function bootPlateDOM() {
  if (window.__PLATE_DOM_BOOTED__) return;
  window.__PLATE_DOM_BOOTED__ = true;

  ensureTouchLookControls();
  bindUI();

  setText('hudMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('hudDiff', (DIFF === 'easy') ? 'Easy' : (DIFF === 'hard') ? 'Hard' : 'Normal');
  setText('hudTime', tLeft);

  // ✅ เช็ค element สำคัญ
  if (!cam) console.warn('[PlateVR] #cam not found. Check plate-vr.html');
  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    emitCoach?.('หา targetRoot ไม่เจอ! ตรวจ ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad');
    return;
  }

  const starter = resolvePlateStarter();
  if (!starter) {
    console.error('[PlateVR] No start function found (startGame/start/beginGame).');
    emitCoach?.('ยังไม่มีฟังก์ชันเริ่มเกมใน plate.safe.js (startGame/beginGame/start) ⚠️', 'sad');
    return;
  }

  // ✅ start เมื่อ scene พร้อม
  if (scene) {
    if (scene.hasLoaded) starter();
    else scene.addEventListener('loaded', () => starter(), { once: true });
  } else {
    setTimeout(() => starter(), 250);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended) endGame?.('tab_hidden');
  });
}

// ✅ เผื่อ html ไม่เรียกเอง ก็ auto boot
window.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});
