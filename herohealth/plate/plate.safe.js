// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — FULL EXTREME v9.1 (ES Module)
// ✅ Emoji targets (CanvasTexture) + คลิก/จิ้ม/VR gaze ได้
// ✅ FX “สติ๊กเกอร์ LINE”: คำตัดสินหัวโต + คะแนนเด้งข้างเป้า
// ✅ MISS: แฉลบซ้ายขวา + สั่นทั้งจอ (แรง) + เสียง
// ✅ PERFECT: confetti ดาว + เสียงติ๊ง
// ✅ 1–8 Challenge Pack
// ✅ PATCH v9: เป้าเลื่อนตามจอแบบ Hydration + clamp safe zone + ไม่ทับ HUD บน/ล่าง/ซ้าย/ขวา
// ✅ PATCH v9.1 (A–E): Rush fair w/ Shield, noMiss3s fixed, HUD rect cache, HUD click-through, Pause/Resume on visibilitychange + freeze target timers

'use strict';

// ---------- URL params ----------
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
function setBarPct(id, pct) {
  const el = $(id);
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = `${p}%`;
}
function ensureFxLayer() {
  let layer = document.querySelector('.plate-fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'plate-fx-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 99999,
      overflow: 'hidden'
    });
    document.body.appendChild(layer);
  }
  return layer;
}
function ensureEdgeOverlay() {
  let el = document.getElementById('plate-edge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'plate-edge';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 99998,
      borderRadius: '0',
      border: '0px solid rgba(255,255,255,0)',
      boxShadow: 'inset 0 0 0 rgba(0,0,0,0)',
      opacity: '0',
      transition: 'opacity .14s ease',
      willChange: 'opacity, box-shadow, border'
    });
    document.body.appendChild(el);
  }
  return el;
}

// ---------- A-Frame guards ----------
const A = window.AFRAME;
if (!A) console.error('[PlateVR] AFRAME not found');

// ---------- FX module fallback ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {} };

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.90, lifeMs: 2350, junkRate: 0.12, powerRate: 0.11, hazRate: 0.08 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.80, lifeMs: 2050, junkRate: 0.18, powerRate: 0.11, hazRate: 0.10 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.72, lifeMs: 1850, junkRate: 0.24, powerRate: 0.12, hazRate: 0.12 }
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

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

// =======================
// SAFE ZONE + HUD CLAMP (PATCH v9)
// =======================
const SAFE = {
  rx: 1.08,
  ry: 0.62,
  padNX: 0.06,
  padNY: 0.08,
  hudPadPx: 16
};
function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function getNoFlyRatios(){ return { topR: 0.18, bottomR: 0.20 }; }

function getHudExclusionRects() {
  const W = Math.max(1, window.innerWidth || 1);
  const H = Math.max(1, window.innerHeight || 1);

  const sels = [
    '.hud-top', '.hud-bottom',
    '.hud-left', '.hud-right',
    '.quest-panel', '.mini-panel',
    '#hud', '#hudTop', '#hudBottom',
    '#hudLeft', '#hudRight',
    '#questPanel', '#miniPanel'
  ].join(',');

  const els = Array.from(document.querySelectorAll(sels));
  const pad = SAFE.hudPadPx;

  const rects = [];
  for (const el of els) {
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (!r || r.width < 30 || r.height < 20) continue;

    const x0 = clamp01((r.left   - pad) / W);
    const x1 = clamp01((r.right  + pad) / W);
    const y0 = clamp01((r.top    - pad) / H);
    const y1 = clamp01((r.bottom + pad) / H);

    rects.push({ x0, x1, y0, y1 });
  }
  return rects;
}

// ✅ PATCH C: cache rects ลดหน่วงบนมือถือ
let __hudRectCache = { at: 0, rects: [] };
function getHudExclusionRectsFast() {
  const now = performance.now();
  if (now - __hudRectCache.at < 250) return __hudRectCache.rects;
  __hudRectCache.at = now;
  __hudRectCache.rects = getHudExclusionRects();
  return __hudRectCache.rects;
}

function inAnyRect(nx, ny, rects){
  for (const a of rects){
    if (nx >= a.x0 && nx <= a.x1 && ny >= a.y0 && ny <= a.y1) return true;
  }
  return false;
}

// ✅ ติด targetRoot กับกล้อง → หมุนจอแล้วเป้าเลื่อนตาม
function attachTargetRootToCamera() {
  if (!cam || !targetRoot) return;
  try{
    if (targetRoot.parentElement !== cam) cam.appendChild(targetRoot);
    targetRoot.setAttribute('position', '0 0 -1.35');
    targetRoot.setAttribute('rotation', '0 0 0');
  }catch(_){}
}

// ✅ สุ่มตำแหน่งแบบปลอดภัย + ไม่ทับ HUD
function pickSafeXY() {
  const nf = getNoFlyRatios();
  const hudRects = getHudExclusionRectsFast(); // ✅ PATCH C

  let minNX = SAFE.padNX;
  let maxNX = 1 - SAFE.padNX;

  let minNY = Math.max(nf.topR, SAFE.padNY);
  let maxNY = 1 - Math.max(nf.bottomR, SAFE.padNY);

  if (maxNX - minNX < 0.15) { minNX = 0.15; maxNX = 0.85; }
  if (maxNY - minNY < 0.15) { minNY = 0.20; maxNY = 0.80; }

  const MAX_TRY = 40;
  for (let i = 0; i < MAX_TRY; i++) {
    const nx = rnd(minNX, maxNX);
    const ny = rnd(minNY, maxNY);
    if (inAnyRect(nx, ny, hudRects)) continue;

    let x = (nx - 0.5) * 2 * SAFE.rx;
    let y = (0.5 - ny) * 2 * SAFE.ry;

    if (haz.blackhole) { x *= 0.40; y *= 0.40; }
    if (haz.wind) { x *= 1.08; y *= 1.08; }

    x = clamp(x, -SAFE.rx, SAFE.rx);
    y = clamp(y, -SAFE.ry, SAFE.ry);

    return { x, y };
  }

  const fallbackNY = (minNY + maxNY) * 0.5;
  return { x: 0, y: clamp((0.5 - fallbackNY) * 2 * SAFE.ry, -SAFE.ry, SAFE.ry) };
}

// ---------- Session ----------
const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

let started = false;
let ended = false;

// ✅ PATCH E: pause/resume
let paused = false;
let pauseReason = '';

// ---------- Game state ----------
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

// (1) streak + (2) perfect chain
let goodStreak = 0;
let lastGoodGroup = 0;
let perfectChain = 0;
let lastMissAtMs = -99999;

// (8) last 10 sec hero mode
let hero10On = false;
let hero10Clean = true;

// (3) boss phase + golden zone
let bossPhaseOn = false;
let bossOn = false;
let bossHP = 0;
let goldenZoneUntilMs = 0;

// (6) golden risk (junk surge)
let junkSurgeUntilMs = 0;

// (4) mini quests
let miniCleared = 0;
let miniCurrent = null;
let miniHistory = 0;

// (4) Plate Rush timer FX
let rushDeadlineMs = 0;
let rushNoJunkOK = true;
let rushTicked = {3:false,2:false,1:false};
let edgePulseOn = false;

// ---------- hazards/powers ----------
let balancePct = 100;
let shieldOn = false;
let shieldUntil = 0;

let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };

let spawnTimer = null;
let activeTargets = new Map();
let targetSeq = 0;

let currentSpawnInterval = DCFG0.spawnInterval;

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; }
function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }

// ---------- WebAudio tiny SFX ----------
let __ac = null;
function ac() {
  if (__ac) return __ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  __ac = new Ctx();
  return __ac;
}
function beep(freq=880, dur=0.06, type='sine', gain=0.08) {
  const ctx = ac();
  if (!ctx) return;
  try{
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  }catch(_){}
}
function sfxTick(){ beep(1200, 0.04, 'square', 0.06); }
function sfxDing(){ beep(1320, 0.08, 'sine', 0.10); setTimeout(()=>beep(1760,0.08,'sine',0.09), 60); }
function sfxMiss(){ beep(220, 0.10, 'sawtooth', 0.10); setTimeout(()=>beep(160,0.10,'sawtooth',0.09), 80); }

// ---------- Screen Shake ----------
function ensureShakeStyle() {
  if (document.getElementById('__plate_shake_css__')) return;
  const st = document.createElement('style');
  st.id = '__plate_shake_css__';
  st.textContent = `
    .plate-shake{ animation: plateShake .28s linear both; }
    @keyframes plateShake{
      0%{ transform:translate3d(0,0,0) rotate(0deg); }
      10%{ transform:translate3d(-10px, 0, 0) rotate(-0.8deg); }
      20%{ transform:translate3d(10px, 0, 0) rotate(0.8deg); }
      30%{ transform:translate3d(-12px, 2px, 0) rotate(-0.9deg); }
      40%{ transform:translate3d(12px, -2px, 0) rotate(0.9deg); }
      50%{ transform:translate3d(-8px, 1px, 0) rotate(-0.6deg); }
      60%{ transform:translate3d(8px, -1px, 0) rotate(0.6deg); }
      70%{ transform:translate3d(-6px, 0, 0) rotate(-0.4deg); }
      80%{ transform:translate3d(6px, 0, 0) rotate(0.4deg); }
      90%{ transform:translate3d(-3px, 0, 0) rotate(-0.2deg); }
      100%{ transform:translate3d(0,0,0) rotate(0deg); }
    }
    .plate-edge-pulse{ animation: plateEdgePulse .16s linear infinite alternate; }
    @keyframes plateEdgePulse{ from{ opacity: .30; } to{ opacity: .82; } }
  `;
  document.head.appendChild(st);
}
function screenShake() {
  ensureShakeStyle();
  document.body.classList.remove('plate-shake');
  void document.body.offsetWidth;
  document.body.classList.add('plate-shake');
  setTimeout(()=>document.body.classList.remove('plate-shake'), 320);
}

// ---------- Sticker FX ----------
function stickerAt(px, py, text, opts = {}) {
  const layer = ensureFxLayer();
  const el = document.createElement('div');
  el.textContent = text;

  const tone = String(opts.tone || 'good');
  const big = !!opts.big;
  const dx = (opts.dx ?? 0);
  const dy = (opts.dy ?? 0);

  const baseBg =
    tone === 'bad' ? 'rgba(127,29,29,0.92)'
    : tone === 'gold' ? 'rgba(120,53,15,0.92)'
    : tone === 'boss' ? 'rgba(30,58,138,0.92)'
    : 'rgba(15,23,42,0.92)';

  const baseBorder =
    tone === 'bad' ? 'rgba(251,113,133,0.75)'
    : tone === 'gold' ? 'rgba(250,204,21,0.85)'
    : tone === 'boss' ? 'rgba(56,189,248,0.85)'
    : 'rgba(34,197,94,0.65)';

  Object.assign(el.style, {
    position: 'absolute',
    left: (px + dx) + 'px',
    top:  (py + dy) + 'px',
    transform: 'translate(-50%,-50%) scale(0.72)',
    opacity: '0',
    padding: big ? '10px 16px' : '7px 12px',
    borderRadius: '999px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif',
    fontWeight: '900',
    letterSpacing: '.03em',
    color: '#ffffff',
    background: baseBg,
    border: '3px solid ' + baseBorder,
    boxShadow: '0 20px 45px rgba(0,0,0,0.55)',
    textShadow: '0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.75)',
    whiteSpace: 'nowrap',
    willChange: 'transform,opacity,filter',
    filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.35))'
  });

  layer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.08)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-70%) scale(0.92)';
  }, opts.life ?? 520);
  setTimeout(() => { try{ el.remove(); }catch(_){} }, (opts.life ?? 520) + 220);
}

function starConfetti(px, py, n = 16) {
  const layer = ensureFxLayer();
  for (let i=0;i<n;i++){
    const s = document.createElement('div');
    s.textContent = '⭐';
    const size = 16 + Math.random()*18;
    Object.assign(s.style, {
      position:'absolute',
      left: px+'px',
      top: py+'px',
      transform:'translate(-50%,-50%) scale(0.9)',
      fontSize: size+'px',
      opacity:'1',
      pointerEvents:'none',
      willChange:'transform,opacity',
      filter:'drop-shadow(0 10px 16px rgba(0,0,0,0.35))'
    });
    layer.appendChild(s);

    const ang = Math.random()*Math.PI*2;
    const dist = 80 + Math.random()*70;
    const dx = Math.cos(ang)*dist;
    const dy = Math.sin(ang)*dist - (20 + Math.random()*50);

    requestAnimationFrame(()=>{
      s.style.transition = 'transform .58s ease-out, opacity .58s ease-out';
      s.style.transform = `translate(${dx}px,${dy}px) scale(${0.9+Math.random()*0.5}) rotate(${(Math.random()*240-120)|0}deg)`;
      s.style.opacity = '0';
    });
    setTimeout(()=>{ try{ s.remove(); }catch(_){} }, 620);
  }
}

function getSceneCamera() { return scene && scene.camera ? scene.camera : null; }
function screenPxFromEntity(el) {
  try{
    const cam3 = getSceneCamera();
    if (!cam3 || !el || !el.object3D) return null;
    const v = new THREE.Vector3();
    el.object3D.getWorldPosition(v);
    v.project(cam3);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2;
    const y = (1 - (v.y + 1) / 2);
    return { x: x * window.innerWidth, y: y * window.innerHeight };
  }catch(_){ return null; }
}

function fxOnHit(el, kind, judgeText, pts) {
  const p = screenPxFromEntity(el);
  if (!p) return;

  try {
    Particles.burstAt(p.x, p.y, {
      color: (kind==='junk'?'#fb7185':kind==='boss'?'#38bdf8':kind==='power'?'#facc15':'#22c55e'),
      good: kind!=='junk',
      count: (kind==='perfect'?38:26)
    });
  } catch(_){}

  if (typeof pts === 'number') {
    const tone = (pts < 0 || kind==='junk') ? 'bad' : (kind==='boss' ? 'boss' : (kind==='power' ? 'gold' : 'good'));
    stickerAt(p.x, p.y, (pts>=0?`+${pts}`:`${pts}`), { tone, dx: 42, dy: -10, life: 520, big: false });
  }

  if (judgeText) {
    const tone = (judgeText.includes('MISS') || judgeText.includes('BAD')) ? 'bad'
      : (judgeText.includes('BOSS') ? 'boss'
      : (judgeText.includes('GOLD') || judgeText.includes('FEVER') ? 'gold' : 'good'));
    stickerAt(p.x, p.y, judgeText, { tone, dx: -56, dy: -12, life: 560, big: true });
  }

  if (judgeText && judgeText.includes('PERFECT')) {
    starConfetti(p.x, p.y, 22);
    sfxDing();
  }
}

// ---------- Emitters ----------
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
    bossPhaseOn: bossPhaseOn ? 1 : 0,
    shieldOn: shieldOn ? 1 : 0,
    balancePct: Math.round(balancePct),
    perfectPlates,
    perfectStreak,
    goodStreak,
    paused: paused ? 1 : 0
  }, payload));
}
function emitCoach(text, mood) {
  emit('hha:coach', { sessionId, mode:'PlateVR', text: String(text||''), mood: mood || 'neutral', timeFromStartMs: fromStartMs() });
}
function emitJudge(label) {
  emit('hha:judge', { sessionId, mode:'PlateVR', label: String(label||''), timeFromStartMs: fromStartMs() });
}
function computeGradeNow() {
  const allGoal = perfectPlates >= goalTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
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
    bossOn: bossOn ? 1 : 0,
    bossPhaseOn: bossPhaseOn ? 1 : 0,
    goodStreak,
    gradeNow: computeGradeNow(),
    paused: paused ? 1 : 0
  });
}
function emitTime() { emit('hha:time', { sessionId, mode:'PlateVR', sec: tLeft, timeFromStartMs: fromStartMs() }); }

// ---------- HUD (สำรอง) ----------
function hudUpdateAll() {
  setText('hudTime', tLeft);
  setText('hudScore', score);
  setText('hudCombo', combo);
  setText('hudMiss', miss);

  const pct = Math.round(clamp(fever, 0, 100));
  setBarPct('hudFever', pct);
  setText('hudFeverPct', pct + '%');

  const have = Object.values(plateHave).filter(Boolean).length;
  setText('hudGroupsHave', `${have}/5`);
  setText('hudPerfectCount', perfectPlates);

  setText('hudGoalLine', `ทำ PERFECT PLATE อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${perfectPlates}/${goalTotal})`);
  setText('hudMiniLine', miniCurrent ? `Mini: ${miniCurrent.label} • ${miniCurrent.prog}/${miniCurrent.target}` : 'Mini: …');
}

// ---------- Emoji texture helper ----------
function makeEmojiTexture(emoji, opts = {}) {
  const size = opts.size || 256;
  const font = opts.font || '180px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0,0,size,size);

  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.44, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(15,23,42,0.70)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(148,163,184,0.38)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(size/2 - 16, size/2 - 16, size*0.16, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(emoji), size/2, size/2 + 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeTargetEntity({ kind, groupId = 0, emoji, scale = 1.0 }) {
  if (!scene || !targetRoot) return null;

  const el = document.createElement('a-entity');
  const id = `pt-${++targetSeq}`;
  el.setAttribute('id', id);
  el.setAttribute('class', 'plateTarget');

  el.setAttribute('geometry', 'primitive: plane; width: 0.52; height: 0.52');
  el.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.98; side: double');

  el.dataset.kind = kind;
  el.dataset.groupId = String(groupId || 0);
  el.dataset.emoji = String(emoji || '');
  el.dataset.spawnMs = String(fromStartMs());

  const s = clamp(scale, 0.45, 1.35);
  el.addEventListener('loaded', () => {
    try {
      el.object3D.scale.set(s, s, s);
      const mesh = el.getObject3D('mesh');
      if (mesh && mesh.material) {
        mesh.material.map = makeEmojiTexture(emoji);
        mesh.material.needsUpdate = true;
      }
    } catch (_) {}
  });

  // ✅ SAFE spawn: ไม่ทับ HUD + clamp safe zone + ตามจอ
  const pos = pickSafeXY();
  el.setAttribute('position', `${pos.x} ${pos.y} 0`);

  el.addEventListener('click', () => onHit(el, 'click'));
  return el;
}

function clearExpireTimerById(id) {
  const rec = activeTargets.get(id);
  if (!rec) return;
  if (rec.expireTimer) {
    try { clearTimeout(rec.expireTimer); } catch(_){}
    rec.expireTimer = null;
  }
}

function removeTarget(el, reason = 'remove') {
  if (!el) return;
  const id = el.getAttribute('id');
  if (id && activeTargets.has(id)) {
    clearExpireTimerById(id);
    activeTargets.delete(id);
  }
  try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
  emitGameEvent({ type:'target_remove', reason, targetId: id || '', kind: el.dataset.kind || '' });
}

function expireTarget(el) {
  if (!el || ended || paused) return;

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  if (kind === 'good') {
    miss += 1;
    combo = 0;
    goodStreak = 0;
    perfectStreak = 0;
    fever = clamp(fever - 10, 0, 100);
    emitJudge('MISS');
    lastMissAtMs = performance.now();
    markMissForTwist(); // ✅ PATCH B
    hero10Clean = false;
    emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
    emitGameEvent({ type:'miss_expire', groupId });
  }

  removeTarget(el, 'expire');
  knowAdaptive();
  hudUpdateAll();
  emitScore();
}

// ---------- Adaptive ----------
function knowAdaptive() {
  if (!isAdaptiveOn()) return;
  const base = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;
  let k = 1.0;

  if (combo >= 8) k *= 0.82;
  if (combo >= 12) k *= 0.75;
  if (miss >= 8) k *= 1.10;

  if (tLeft <= 18) k *= 0.82;
  if (bossPhaseOn) k *= 0.86;
  if (hero10On) k *= 0.80;

  currentSpawnInterval = clamp(Math.round(base * k), 420, 1600);
}

// ---------- Plate logic ----------
function resetPlate() { plateHave = { 1:false,2:false,3:false,4:false,5:false }; }
function plateHaveCount() { return Object.values(plateHave).filter(Boolean).length; }

function registerGroupHit(groupId) {
  if (groupId >= 1 && groupId <= 5) {
    plateHave[groupId] = true;
    plateCounts[groupId] += 1;
    totalsByGroup[groupId] += 1;
  }
}

function streakBonusCheck() {
  const now = goodStreak;
  let bonus = 0;
  let label = '';
  if (now === 5)  { bonus = 120; label = '🔥 STREAK x5'; }
  if (now === 10) { bonus = 220; label = '⚡ STREAK x10'; }
  if (now === 15) { bonus = 360; label = '💥 STREAK x15'; }
  if (bonus > 0) {
    score += bonus;
    emitCoach(`สตรีค ${now}! +${bonus} 🧨`, 'happy');
    stickerAt(window.innerWidth*0.5, window.innerHeight*0.36, `${label} +${bonus}`, { tone:'gold', big:true, life: 760 });
    emitGameEvent({ type:'streak_bonus', streak: now, bonus });
  }
}

function checkPerfectPlate() {
  const have = plateHaveCount();
  if (have >= 5) {
    perfectPlates += 1;
    perfectStreak += 1;
    bestStreak = Math.max(bestStreak, perfectStreak);

    perfectChain += 1;

    let bonus = 220 + Math.min(180, perfectStreak * 40);
    let chainBonus = 0;
    if (perfectChain >= 2) chainBonus = 180 + (perfectChain-1)*60;
    score += bonus + chainBonus;

    emitJudge('PERFECT!');
    emitCoach(`PERFECT PLATE! +${bonus}${chainBonus?` (+${chainBonus} CHAIN!)`:''} 🌟`, 'happy');
    emitGameEvent({ type:'perfect_plate', perfectPlates, perfectStreak, perfectChain, bonus, chainBonus });

    fever = clamp(fever + 28, 0, 100);
    if (fever >= 100) activateFever(5200);

    resetPlate();

    if (miniCurrent && !miniCurrent.done && miniCurrent.key.startsWith('perfect')) {
      miniCurrent.prog += 1;
      if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
    }
  }
}

function updateBalance(kind, groupId) {
  if (kind === 'junk') { balancePct = clamp(balancePct - 18, 0, 100); return; }
  if (groupId >= 1 && groupId <= 5) {
    const c = plateCounts[groupId] || 0;
    if (c >= 3) balancePct = clamp(balancePct - 6, 0, 100);
    else balancePct = clamp(balancePct + 2, 0, 100);
  }
}

function scoreForHit(kind, groupId) {
  let base = 0;
  if (kind === 'good') base = 85;
  if (kind === 'junk') base = -50;
  if (kind === 'power') base = 120;
  if (kind === 'haz') base = 90;
  if (kind === 'boss') base = 140;

  let mult = 1.0;
  if (feverActive) mult += 0.35;

  const bal = clamp(balancePct, 0, 100);
  const balMult = 0.70 + (bal / 100) * 0.40;
  mult *= balMult;

  if (goodStreak >= 10) mult *= 1.06;
  else if (goodStreak >= 5) mult *= 1.03;

  if (DIFF === 'hard') mult *= 0.96;
  if (DIFF === 'easy') mult *= 1.04;

  if (performance.now() < goldenZoneUntilMs) mult *= 1.18;

  return Math.round(base * mult);
}

// ---------- Fever ----------
function activateFever(ms = 5200) {
  feverActive = true;
  feverUntilMs = performance.now() + ms;
  emit('hha:fever', { sessionId, mode:'PlateVR', on: 1, value: 100, timeFromStartMs: fromStartMs() });
  emitCoach('FEVER ON! คะแนนคูณแรงขึ้น 🔥', 'fever');
  emitGameEvent({ type:'fever_on', durMs: ms });
}
function updateFeverTick() {
  if (!feverActive) {
    fever = clamp(fever - 0.9, 0, 100);
  } else {
    fever = clamp(fever - 0.25, 0, 100);
    if (performance.now() >= feverUntilMs) {
      feverActive = false;
      emit('hha:fever', { sessionId, mode:'PlateVR', on: 0, value: Math.round(fever), timeFromStartMs: fromStartMs() });
      emitCoach('FEVER หมดแล้ว สู้ต่อได้เลย ✨', 'neutral');
      emitGameEvent({ type:'fever_off' });
    }
  }
}

// ---------- Shield ----------
function enableShield(ms = POWER.shield.durMs) {
  shieldOn = true;
  shieldUntil = performance.now() + ms;
  emitCoach(`ได้โล่! กันขยะ ${Math.round(ms/1000)} วิ 🥗`, 'happy');
  emitGameEvent({ type:'shield_on', durMs: ms });
}
function updateShieldTick() {
  if (!shieldOn) return;
  if (performance.now() >= shieldUntil) {
    shieldOn = false;
    emitCoach('โล่หมดแล้ว ระวังขยะนะ 😌', 'neutral');
    emitGameEvent({ type:'shield_off' });
  }
}

// ---------- Hazards ----------
function enableHaz(key, ms) {
  haz[key] = true;
  hazUntil[key] = performance.now() + ms;
  emitCoach(`${HAZ[key].label}! ระวัง!`, 'sad');
  emitGameEvent({ type:'haz_on', haz: key, durMs: ms });
}
function updateHazTick() {
  for (const k of Object.keys(haz)) {
    if (haz[k] && performance.now() >= hazUntil[k]) {
      haz[k] = false;
      emitGameEvent({ type:'haz_off', haz: k });
      emitCoach('กลับสู่สภาพปกติแล้ว ✅', 'neutral');
    }
  }
}

// ---------- Mini quests ----------
const TWIST_POOL = [
  { key:'noRepeat', label:'ห้ามเก็บหมู่เดิมซ้ำติดกัน!', check: (st)=> st.twNoRepeatOk },
  { key:'needVeg2', label:'ต้องมี “ผัก 🥦” อย่างน้อย 2 ครั้ง!', check: (st)=> (st.twVegHits>=2) },
  { key:'noMiss3s', label:'ห้ามพลาดภายใน 3 วิแรก!', check: (st)=> st.twNoMissFirst3s }
];

const MINI_POOL = [
  { key:'rush8',    label:'Plate Rush: ครบ 5 หมู่ ภายใน 8 วิ!', target: 1, twistAllowed: true },
  { key:'perfect1', label:'Perfect Chain: ทำ PERFECT เพิ่มอีก',  target: 1, twistAllowed: true },
  { key:'clean10',  label:'Clean Plate: ห้ามโดนขยะ 10 วิ',       target: 10, twistAllowed: false },
  { key:'combo8',   label:'Combo Build: ทำคอมโบให้ถึง 8',        target: 8, twistAllowed: true }
];

let cleanTimer = 0;
let tw = { twNoRepeatOk:true, twVegHits:0, twNoMissFirst3s:true, twStartMs:0 };

// ✅ PATCH B: mark miss immediately for twist noMiss3s
function markMissForTwist() {
  if (miniCurrent?.twistKey !== 'noMiss3s') return;
  const dt = performance.now() - (tw.twStartMs || 0);
  if (dt <= 3000) tw.twNoMissFirst3s = false;
}

function emitQuestUpdate() {
  emit('quest:update', {
    goal: { label:`Perfect Plate ${perfectPlates}/${goalTotal}`, prog: perfectPlates, target: goalTotal },
    mini: miniCurrent
      ? { label: miniCurrent.label, prog: miniCurrent.prog, target: miniCurrent.target }
      : { label: 'Mini: …', prog: 0, target: 1 },
    hint: miniCurrent?.hint || ''
  });
}

function startNextMiniQuest() {
  const def = pick(MINI_POOL);
  miniHistory += 1;

  const useTwist = def.twistAllowed && Math.random() < 0.75;
  const twist = useTwist ? pick(TWIST_POOL) : null;

  tw = { twNoRepeatOk:true, twVegHits:0, twNoMissFirst3s:true, twStartMs: performance.now() };

  miniCurrent = {
    key: def.key,
    label: def.label,
    target: def.target,
    prog: 0,
    startedAt: performance.now(),
    done: false,
    twistKey: twist ? twist.key : '',
    twistLabel: twist ? twist.label : '',
    hint: twist ? `Twist: ${twist.label}` : ''
  };

  if (miniCurrent.key === 'clean10') cleanTimer = def.target;

  if (miniCurrent.key === 'rush8') {
    rushDeadlineMs = performance.now() + 8000;
    rushNoJunkOK = true;
    rushTicked = {3:false,2:false,1:false};
    edgePulseOn = false;
  }

  emitGameEvent({ type:'mini_start', miniKey: miniCurrent.key, miniHistory, twist: miniCurrent.twistKey });
  emitCoach(`Mini Quest เริ่ม! ${miniCurrent.label} 🎯`, 'happy');
  if (miniCurrent.hint) emitCoach(miniCurrent.hint, 'neutral');

  emitQuestUpdate();
  hudUpdateAll();
}

function clearMiniQuest() {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  miniCleared += 1;

  emitGameEvent({ type:'mini_clear', miniKey: miniCurrent.key, miniCleared });
  emitCoach('Mini Quest CLEAR! ✅ ต่อไปมาเลย!', 'happy');
  emitJudge('MISSION CLEAR!');

  const bonus = 180 + (miniCleared*10);
  score += bonus;
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.40, `✅ MINI CLEAR +${bonus}`, { tone:'gold', big:true, life: 820 });
  try { Particles.burstAt(window.innerWidth*0.5, window.innerHeight*0.42, { color:'#38bdf8', good:true, count: 34 }); } catch(_){}

  setTimeout(() => { if (!ended && !paused) startNextMiniQuest(); }, 520);

  emitQuestUpdate();
  hudUpdateAll();
  emitScore();
}

function failMiniQuest(reason='fail') {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  emitGameEvent({ type:'mini_fail', miniKey: miniCurrent.key, reason });
  emitCoach(`Mini Quest พลาด! ลองอันใหม่เลย 💪`, 'sad');
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.42, `😵 FAIL`, { tone:'bad', big:true, life: 620 });
  setTimeout(() => { if (!ended && !paused) startNextMiniQuest(); }, 620);
  emitQuestUpdate();
}

function twistOkNow() {
  if (!miniCurrent || miniCurrent.done) return true;
  const tk = miniCurrent.twistKey;
  if (!tk) return true;
  if (tk === 'noRepeat') return !!tw.twNoRepeatOk;
  if (tk === 'needVeg2') return (tw.twVegHits >= 2);
  if (tk === 'noMiss3s') return !!tw.twNoMissFirst3s;
  return true;
}

function updateMiniTick() {
  if (!miniCurrent || miniCurrent.done || paused) return;

  if (miniCurrent.key === 'rush8') {
    const have = plateHaveCount();
    const leftMs = Math.max(0, rushDeadlineMs - performance.now());
    const leftS = Math.ceil(leftMs/1000);

    if (leftS <= 3 && leftS >= 1) {
      if (!rushTicked[leftS]) {
        rushTicked[leftS] = true;
        sfxTick();
      }
      const edge = ensureEdgeOverlay();
      ensureShakeStyle();
      edge.style.opacity = '1';
      edge.style.border = '3px solid rgba(250,204,21,0.78)';
      edge.style.boxShadow = 'inset 0 0 0 999px rgba(250,204,21,0.06), inset 0 0 34px rgba(250,204,21,0.22)';
      if (!edgePulseOn) { edgePulseOn = true; edge.classList.add('plate-edge-pulse'); }
      document.body.classList.remove('plate-shake');
      void document.body.offsetWidth;
      document.body.classList.add('plate-shake');
      setTimeout(()=>document.body.classList.remove('plate-shake'), 180);
    } else {
      const edge = ensureEdgeOverlay();
      edge.style.opacity = '0';
      edge.classList.remove('plate-edge-pulse');
      edgePulseOn = false;
    }

    miniCurrent.prog = (have >= 5 && rushNoJunkOK && twistOkNow()) ? 1 : 0;

    if (performance.now() >= rushDeadlineMs) {
      if (miniCurrent.prog >= 1) clearMiniQuest();
      else failMiniQuest('rush_timeout');
      return;
    }

    miniCurrent.hint =
      `เหลือ ${leftS}s • ตอนนี้ ${have}/5` +
      (rushNoJunkOK ? '' : ' • ❌ โดนขยะแล้ว!') +
      (miniCurrent.twistLabel ? ` • Twist: ${miniCurrent.twistLabel}` : '');

    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }

  if (miniCurrent.key === 'combo8') {
    miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    if (miniCurrent.prog >= miniCurrent.target && twistOkNow()) clearMiniQuest();
  }

  if (miniCurrent.key === 'clean10') {
    miniCurrent.prog = clamp((miniCurrent.target - cleanTimer), 0, miniCurrent.target);
    if (cleanTimer <= 0) clearMiniQuest();
  }

  if (miniCurrent.key === 'perfect1') {
    if (miniCurrent.prog >= miniCurrent.target && twistOkNow()) clearMiniQuest();
  }

  emitQuestUpdate();
  hudUpdateAll();
}

// ---------- Boss Phase ----------
function maybeStartBossPhase() {
  if (bossPhaseOn) return;
  if (tLeft > 20) return;
  bossPhaseOn = true;
  emitCoach('⚔️ BOSS PHASE! ท้ายเกมมาแล้ว! ระวังขยะ + บอส ⭐', 'sad');
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.26, '⚔️ BOSS PHASE!', { tone:'boss', big:true, life: 980 });
  emitGameEvent({ type:'boss_phase_on' });
  setTimeout(()=>{ if (!ended && !paused) spawnOne({ forceBoss:true }); }, 240);
}
function startGoldenZone(ms=3000) {
  goldenZoneUntilMs = performance.now() + ms;
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.30, '✨ GOLD ZONE x1.18', { tone:'gold', big:true, life: 820 });
  emitGameEvent({ type:'gold_zone_on', ms });
}

// ---------- Spawn ----------
function pickSpawnKind() {
  const endBoost = (tLeft <= 18) ? 0.05 : 0.0;
  const r = Math.random();
  const hazRate = (DCFG0.hazRate + endBoost) + (bossPhaseOn ? 0.02 : 0);
  const powRate = DCFG0.powerRate + (bossPhaseOn ? 0.01 : 0);
  const junkExtra = (performance.now() < junkSurgeUntilMs) ? 0.12 : 0.0;
  const junkRate = clamp(DCFG0.junkRate + (bossPhaseOn ? 0.07 : 0) + junkExtra, 0.05, 0.60);
  if (r < hazRate) return 'haz';
  if (r < hazRate + powRate) return 'power';
  if (r < hazRate + powRate + junkRate) return 'junk';
  return 'good';
}

function scheduleExpireFor(id) {
  const rec = activeTargets.get(id);
  if (!rec) return;
  clearExpireTimerById(id);

  const left = Math.max(0, rec.expireAt - performance.now());
  rec.expireTimer = setTimeout(() => {
    if (ended || paused) return;
    const r = activeTargets.get(id);
    if (!r) return;
    expireTarget(r.el);
  }, left);
}

function spawnOne(opts = {}) {
  if (!targetRoot || ended || paused) return;
  if (activeTargets.size >= DCFG0.maxActive) return;

  const kind = opts.forceBoss ? 'boss' : pickSpawnKind();
  const scl = DCFG0.scale * (haz.freeze ? 0.92 : 1.0);
  const lifeMs = DCFG0.lifeMs + (haz.freeze ? 350 : 0);

  let meta = null;

  if (kind === 'good') {
    const key = pick(GROUP_KEYS);
    const g = POOL[key];
    meta = { kind:'good', groupId: g.id, emoji: pick(g.emojis), scale: scl };
  } else if (kind === 'junk') {
    meta = { kind:'junk', groupId: 0, emoji: pick(POOL.junk.emojis), scale: scl * 0.98 };
  } else if (kind === 'power') {
    const pk = pick(Object.keys(POWER));
    const p = POWER[pk];
    meta = { kind:'power', groupId: 0, emoji: p.emoji, scale: scl * 0.95 };
  } else if (kind === 'haz') {
    const hk = pick(Object.keys(HAZ));
    const h = HAZ[hk];
    meta = { kind:'haz', groupId: 0, emoji: h.emoji, scale: scl * 0.95, hazKey: hk };
  } else if (kind === 'boss') {
    meta = { kind:'boss', groupId: 0, emoji: '⭐', scale: scl * 1.05 };
  }

  const el = makeTargetEntity(meta);
  if (!el) return;

  if (kind === 'haz' && meta.hazKey) el.dataset.hazKey = meta.hazKey;

  targetRoot.appendChild(el);

  const id = el.getAttribute('id');
  activeTargets.set(id, {
    id, el,
    kind: el.dataset.kind,
    groupId: parseInt(el.dataset.groupId || '0', 10) || 0,
    spawnAt: performance.now(),
    expireAt: performance.now() + lifeMs,
    lifeMs,
    expireTimer: null,
    _pauseLeft: 0
  });

  emitGameEvent({ type:'spawn', kind: el.dataset.kind, groupId: meta.groupId || 0, targetId: id });

  scheduleExpireFor(id);
}

function spawnLoopStart() {
  if (ended || paused) return;
  knowAdaptive();
  if (spawnTimer) clearInterval(spawnTimer);

  const loop = () => {
    if (ended || paused) return;
    maybeStartBossPhase();
    spawnOne();
    knowAdaptive();
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(loop, currentSpawnInterval);
  };

  spawnTimer = setInterval(loop, currentSpawnInterval);
}

// ---------- Hit logic ----------
function applyTwistOnGood(groupId) {
  if (miniCurrent?.twistKey === 'noRepeat') {
    if (lastGoodGroup && groupId === lastGoodGroup) tw.twNoRepeatOk = false;
  }
  if (miniCurrent?.twistKey === 'needVeg2') {
    if (groupId === 3) tw.twVegHits += 1;
  }
  lastGoodGroup = groupId;
}

function onHit(el, via = 'click') {
  if (!el || ended || paused) return;
  if (el.dataset.hit === '1') return;
  el.dataset.hit = '1';

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  const preFx = (judge, pts) => {
    try { fxOnHit(el, kind, judge, pts); } catch(_){}
  };

  removeTarget(el, 'hit');
  if (!started) return;

  if (kind === 'haz') {
    const hk = el.dataset.hazKey || pick(Object.keys(HAZ));
    enableHaz(hk, HAZ[hk].durMs);

    combo = Math.max(0, combo - 1);
    const pts = scoreForHit('haz', 0);
    score += pts;

    emitJudge('RISK!');
    preFx('RISK!', pts);
    emitGameEvent({ type:'haz_hit', haz: hk, points: pts });

    hudUpdateAll(); emitScore();
    return;
  }

  if (kind === 'power') {
    const em = el.dataset.emoji || '';
    let pts = scoreForHit('power', 0);

    if (em === POWER.shield.emoji) {
      enableShield(POWER.shield.durMs);
      score += pts;
      fever = clamp(fever + 10, 0, 100);
      emitJudge('SHIELD!');
      preFx('SHIELD!', pts);
      emitGameEvent({ type:'power_shield', points: pts });
    } else if (em === POWER.cleanse.emoji) {
      for (const [tid, tr] of Array.from(activeTargets.entries())) {
        if (tr && tr.el && tr.el.dataset.kind === 'junk') removeTarget(tr.el, 'cleanse');
      }
      balancePct = clamp(balancePct + 22, 0, 100);
      score += 240;
      combo = 0;
      goodStreak = 0;
      emitJudge('CLEANSE!');
      preFx('CLEANSE!', 240);
      emitCoach('ล้างจานแล้ว! ขยะหายไป 💨 (คอมโบรีเซ็ต)', 'happy');
      emitGameEvent({ type:'power_cleanse', points: 240 });
    } else if (em === POWER.golden.emoji) {
      score += 320;
      fever = clamp(fever + 22, 0, 100);
      junkSurgeUntilMs = performance.now() + 3000;
      startGoldenZone(2600);

      if (fever >= 100) activateFever(5200);
      emitJudge('GOLD!');
      preFx('GOLD!', 320);
      emitCoach('Golden Bite! คะแนนพุ่ง ⭐ (ระวัง! ขยะเพิ่ม 3 วิ)', 'happy');
      emitGameEvent({ type:'power_golden', points: 320, junkSurgeMs: 3000 });
    } else {
      score += pts;
      emitJudge('POWER!');
      preFx('POWER!', pts);
    }

    combo += 1; maxCombo = Math.max(maxCombo, combo);

    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  if (kind === 'boss') {
    if (!bossOn) {
      bossOn = true;
      bossHP = 3 + (DIFF === 'hard' ? 2 : 1);
      emitCoach(`บอสมาถึง! กด ⭐ ให้ครบ ${bossHP} ครั้ง!`, 'sad');
      emitGameEvent({ type:'boss_on', hp: bossHP });
    }

    bossHP -= 1;
    const pts = scoreForHit('boss', 0);
    score += pts;

    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 12, 0, 100);

    emitJudge('BOSS HIT!');
    preFx('BOSS HIT!', pts);
    emitGameEvent({ type:'boss_hit', hpLeft: bossHP, points: pts });

    if (bossHP <= 0) {
      bossOn = false;
      const bonus = 420 + (DIFF === 'hard' ? 140 : 60);
      score += bonus;
      startGoldenZone(3000);
      emitCoach(`โค่นบอสแล้ว! +${bonus} 🏆`, 'happy');
      emitJudge('BOSS CLEAR!');
      stickerAt(window.innerWidth*0.5, window.innerHeight*0.34, `🏆 BOSS CLEAR +${bonus}`, { tone:'boss', big:true, life: 980 });
      try { Particles.burstAt(window.innerWidth*0.5, window.innerHeight*0.42, { color:'#38bdf8', good:true, count: 40 }); } catch(_){}
      sfxDing();
      emitGameEvent({ type:'boss_clear', bonus });
    } else {
      setTimeout(() => { if (!ended && !paused) spawnOne({ forceBoss: true }); }, 240);
    }

    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  // ✅ PATCH A: Rush fair w/ Shield (โดนขยะจริงเท่านั้นที่ทำให้ rushNoJunkOK = false)
  if (kind === 'junk') {

    if (shieldOn) {
      // ✅ Shield block = ไม่นับว่า “โดนขยะ” → Rush ยังผ่านเงื่อนไข “ห้ามโดนขยะ” ได้
      const pts = 30;
      score += pts;
      fever = clamp(fever + 4, 0, 100);
      emitJudge('BLOCK!');
      preFx('BLOCK!', pts);
      emitCoach('โล่กันขยะไว้ได้! 🥗', 'happy');
      emitGameEvent({ type:'junk_blocked', points: pts });
      combo += 1; maxCombo = Math.max(maxCombo, combo);

    } else {
      // โดนจริง → Rush fail condition
      if (miniCurrent && !miniCurrent.done && miniCurrent.key === 'rush8') rushNoJunkOK = false;

      miss += 1;
      combo = 0;
      goodStreak = 0;
      perfectStreak = 0;
      perfectChain = 0;
      balancePct = clamp(balancePct - 18, 0, 100);
      fever = clamp(fever - 12, 0, 100);
      emitJudge('MISS');
      preFx('MISS!', -0);
      lastMissAtMs = performance.now();
      markMissForTwist(); // ✅ PATCH B
      hero10Clean = false;

      screenShake();
      sfxMiss();

      emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
      emitCoach('โดนขยะแล้ว! เลี่ยงให้ได้ 😵', 'sad');
      emitGameEvent({ type:'junk_hit_miss' });

      if (miniCurrent && !miniCurrent.done && miniCurrent.key === 'clean10') cleanTimer = miniCurrent.target;
    }

  } else if (kind === 'good') {
    const pts = scoreForHit('good', groupId);
    score += pts;
    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 7, 0, 100);

    goodStreak += 1;

    applyTwistOnGood(groupId);

    registerGroupHit(groupId);
    updateBalance('good', groupId);

    const judge = (pts >= 110) ? 'PERFECT' : 'GOOD';
    emitJudge(judge);
    preFx(judge, pts);
    emitGameEvent({ type:'good_hit', groupId, points: pts });

    streakBonusCheck();
    checkPerfectPlate();

    if (fever >= 100) activateFever(5200);
  }

  updateMiniTick();
  hudUpdateAll();
  emitScore();
  emitGameEvent({ type:'hit', kind, groupId, via });

  knowAdaptive();
}

// ---------- Tick ----------
function handleHero10() {
  if (hero10On) return;
  if (tLeft > 10) return;
  hero10On = true;
  hero10Clean = true;
  emitCoach('🔥 10 วิสุดท้าย! โหมดฮีโร่! ห้ามพลาดนะ!', 'happy');
  stickerAt(window.innerWidth*0.5, window.innerHeight*0.22, '🔥 HERO MODE 10s', { tone:'gold', big:true, life: 980 });
  sfxDing();
  emitGameEvent({ type:'hero10_on' });
}
function tick1s() {
  if (ended || paused) return;

  tLeft -= 1;
  if (tLeft < 0) tLeft = 0;

  if (miniCurrent && miniCurrent.key === 'clean10' && !miniCurrent.done) {
    cleanTimer = Math.max(0, cleanTimer - 1);
    if (cleanTimer <= 0) {
      miniCurrent.prog = miniCurrent.target;
      clearMiniQuest();
    }
  }

  handleHero10();
  if (hero10On && miss > 0 && performance.now() - lastMissAtMs < 1200) hero10Clean = false;

  updateFeverTick();
  updateShieldTick();
  updateHazTick();
  maybeStartBossPhase();

  emitTime();
  hudUpdateAll();
  emitScore();

  if (tLeft <= 0) endGame('time_up');
}
function startTimers() {
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(tick1s, 1000);
}
function stopTimers() {
  if (timerTick) clearInterval(timerTick);
  timerTick = null;
}

// ✅ PATCH E: pause/resume with freezing target timers
function pauseGame(reason='pause') {
  if (ended || paused) return;
  paused = true;
  pauseReason = reason;

  stopTimers();
  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = null;

  // freeze target expire timers
  for (const [id, rec] of activeTargets.entries()) {
    if (!rec) continue;
    rec._pauseLeft = Math.max(0, rec.expireAt - performance.now());
    if (rec.expireTimer) {
      try { clearTimeout(rec.expireTimer); } catch(_){}
      rec.expireTimer = null;
    }
  }

  emitCoach('⏸️ พักเกมชั่วคราว (กลับมาแล้วเล่นต่อได้)', 'neutral');
  emitGameEvent({ type:'pause', reason });
  emitScore();
}
function resumeGame() {
  if (ended || !paused) return;
  paused = false;

  // resume target expire timers
  for (const [id, rec] of activeTargets.entries()) {
    if (!rec) continue;
    const left = Number(rec._pauseLeft) || 0;
    rec.expireAt = performance.now() + left;
    rec._pauseLeft = 0;
    scheduleExpireFor(id);
  }

  startTimers();
  spawnLoopStart();

  emitCoach('▶️ เล่นต่อได้เลย!', 'happy');
  emitGameEvent({ type:'resume', reason: pauseReason || '' });
  pauseReason = '';
  emitScore();
}

// ---------- Result modal (optional) ----------
function computeGradeFinal() { return computeGradeNow(); }
function showResultModal(reason) {
  setText('rMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('rGrade', computeGradeFinal());
  setText('rScore', score);
  setText('rMaxCombo', maxCombo);
  setText('rMiss', miss);
  setText('rPerfect', perfectPlates);

  setText('rGoals', `${Math.min(perfectPlates, goalTotal)}/${goalTotal}`);
  setText('rMinis', `${miniCleared}/${Math.max(miniHistory, miniCleared) || 0}`);

  setText('rG1', totalsByGroup[1] || 0);
  setText('rG2', totalsByGroup[2] || 0);
  setText('rG3', totalsByGroup[3] || 0);
  setText('rG4', totalsByGroup[4] || 0);
  setText('rG5', totalsByGroup[5] || 0);
  setText('rGTotal', (totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5]) || 0);

  const backdrop = $('resultBackdrop');
  if (backdrop) backdrop.style.display = 'flex';
}

function clearAllTargets() {
  for (const [id, rec] of Array.from(activeTargets.entries())) {
    if (rec && rec.expireTimer) {
      try { clearTimeout(rec.expireTimer); } catch(_){}
      rec.expireTimer = null;
    }
    if (rec && rec.el) {
      try { rec.el.parentNode && rec.el.parentNode.removeChild(rec.el); } catch (_) {}
    }
  }
  activeTargets.clear();
}

// ---------- Start / End ----------
function startGame() {
  if (started || ended) return;
  started = true;

  ensureShakeStyle();
  ensureFxLayer();
  ensureEdgeOverlay();

  attachTargetRootToCamera(); // ✅ PATCH v9
  window.addEventListener('resize', attachTargetRootToCamera, { passive:true });
  window.addEventListener('orientationchange', attachTargetRootToCamera, { passive:true });

  emitGameEvent({ type:'session_start', sessionStartIso, durationSec: TIME });
  emitCoach(
    MODE === 'research'
      ? 'โหมดวิจัย: เล่นตามธรรมชาติ เก็บอาหารครบหมู่ให้มากที่สุด 📊'
      : (DIFF === 'hard'
        ? 'HARD! ท้ายเกมมี BOSS PHASE ด้วย 😈'
        : 'เป้าหมาย: ทำ PERFECT PLATE ให้ได้! พร้อมลุย 🍽️'),
    'neutral'
  );

  tLeft = TIME;
  score = 0; combo = 0; maxCombo = 0; miss = 0;

  fever = 0; feverActive = false; feverUntilMs = 0;
  perfectPlates = 0; perfectStreak = 0; bestStreak = 0;
  perfectChain = 0;

  goodStreak = 0; lastGoodGroup = 0;
  lastMissAtMs = -99999;

  hero10On = false; hero10Clean = true;

  balancePct = 100;
  resetPlate();
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

  shieldOn = false; shieldUntil = 0;
  haz = { wind:false, blackhole:false, freeze:false };

  bossPhaseOn = false;
  bossOn = false; bossHP = 0;
  goldenZoneUntilMs = 0;
  junkSurgeUntilMs = 0;

  miniCleared = 0; miniHistory = 0; miniCurrent = null;
  cleanTimer = 0;

  paused = false;
  pauseReason = '';

  hudUpdateAll();
  emitTime();
  emitScore();

  startNextMiniQuest();
  startTimers();

  knowAdaptive();
  spawnLoopStart();
}

function endGame(reason = 'ended') {
  if (ended) return;
  ended = true;

  stopTimers();
  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = null;
  clearAllTargets();

  if (hero10On && hero10Clean && MODE !== 'research') {
    const bonus = 260;
    score += bonus;
    stickerAt(window.innerWidth*0.5, window.innerHeight*0.30, `✨ FINISH CLEAN +${bonus}`, { tone:'gold', big:true, life: 980 });
    try { Particles.burstAt(window.innerWidth*0.5, window.innerHeight*0.42, { color:'#facc15', good:true, count: 42 }); } catch(_){}
    sfxDing();
    emitGameEvent({ type:'finish_clean_bonus', bonus });
  }

  emitGameEvent({ type:'session_end', reason, score, miss, maxCombo, perfectPlates, grade: computeGradeFinal() });
  emit('hha:end', {
    sessionId, mode:'PlateVR',
    reason,
    score,
    misses: miss,
    comboMax: maxCombo,
    perfectPlates,
    goalsCleared: Math.min(perfectPlates, goalTotal),
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: Math.max(miniHistory, miniCleared) || 0,
    grade: computeGradeFinal(),
    timeFromStartMs: fromStartMs()
  });

  emitCoach('จบเกมแล้ว! ดูสรุปผลได้เลย 🎉', 'happy');
  showResultModal(reason);
}

// ---------- Boot helpers ----------
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

// ✅ Manual Raycast — “คลิกได้แน่”
function bindPointerFallback() {
  if (!scene) return;
  if (window.__PLATE_POINTER_BOUND__) return;
  window.__PLATE_POINTER_BOUND__ = true;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function doRaycastFromEvent(ev) {
    if (ended || paused) return;
    if (!scene.camera) return;

    const canvas = scene.canvas;
    if (!canvas) return;

    const t = ev.target;
    if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;

    try { ac()?.resume?.(); } catch(_){}

    const rect = canvas.getBoundingClientRect();

    let cx, cy;
    if (ev.touches && ev.touches.length) {
      cx = ev.touches[0].clientX;
      cy = ev.touches[0].clientY;
    } else {
      cx = ev.clientX;
      cy = ev.clientY;
    }

    mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((cy - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(mouse, scene.camera);

    const root3D = targetRoot && targetRoot.object3D;
    if (!root3D) return;

    const intersects = raycaster.intersectObjects(root3D.children, true);
    if (!intersects || !intersects.length) return;

    const hitObj = intersects[0].object;
    const hitEl = hitObj && hitObj.el;
    if (!hitEl) return;

    let cur = hitEl;
    while (cur && cur !== scene && (!cur.classList || !cur.classList.contains('plateTarget'))) {
      cur = cur.parentEl;
    }
    if (!cur || !cur.classList || !cur.classList.contains('plateTarget')) return;

    onHit(cur, 'raycast');
  }

  window.addEventListener('click', doRaycastFromEvent, { passive: true });
  window.addEventListener('touchstart', doRaycastFromEvent, { passive: true });

  console.log('[PlateVR] manual raycast pointer bound ✅');
}

function resolvePlateStarter() {
  if (typeof startGame === 'function') return startGame;
  if (typeof beginGame === 'function') return beginGame;
  if (typeof start === 'function') return start;
  if (typeof window.startGame === 'function') return window.startGame;
  if (typeof window.beginGame === 'function') return window.beginGame;
  if (typeof window.start === 'function') return window.start;
  return null;
}

// ✅ export ให้ plate-vr.html import ไปเรียก
export function bootPlateDOM() {
  if (window.__PLATE_DOM_BOOTED__) return;
  window.__PLATE_DOM_BOOTED__ = true;

  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    try { emitCoach('หา targetRoot ไม่เจอ! ตรวจ ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad'); } catch (_) {}
    return;
  }

  ensureTouchLookControls();
  bindUI();

  setText('hudMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('hudDiff', (DIFF === 'easy') ? 'Easy' : (DIFF === 'hard') ? 'Hard' : 'Normal');
  setText('hudTime', tLeft);
  hudUpdateAll();

  const bindAfterLoaded = () => bindPointerFallback();
  if (scene && scene.hasLoaded) bindAfterLoaded();
  else if (scene) scene.addEventListener('loaded', bindAfterLoaded, { once: true });

  const starter = resolvePlateStarter();
  if (!starter) {
    console.error('[PlateVR] No start function found (startGame/start/beginGame).');
    try { emitCoach('ยังไม่มีฟังก์ชันเริ่มเกม (startGame/beginGame/start) ⚠️', 'sad'); } catch (_) {}
    return;
  }

  if (scene && scene.hasLoaded) starter();
  else if (scene) scene.addEventListener('loaded', () => starter(), { once:true });
  else setTimeout(() => starter(), 250);

  // ✅ PATCH E: visibilitychange = pause/resume (ไม่จบเกม)
  document.addEventListener('visibilitychange', () => {
    if (ended) return;
    if (document.hidden) pauseGame('tab_hidden');
    else resumeGame();
  });
}

// auto boot
window.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});
