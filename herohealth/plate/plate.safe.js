// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION)
// ✅ Full-screen “big target” (fit by camera FOV) + face-camera
// ✅ Sweet-spot (Perfect) that MOVES -> skill-based aim even when target is huge
// ✅ Fever mode (boost) + Shield (blocks 1 miss) + Combo grading SSS/SS/S/A/B/C
// ✅ Mini quests: Plate Rush / No Junk Zone / Combo Sprint / Perfect Streak / Rainbow Plate
// ✅ Near-time warning FX: tick + HUD pulse + micro shake
// ✅ Cloud logger: NO import. Dispatch events -> hha-cloud-logger.js (IIFE) listens
//
// HTML requirements (you already have):
// - ./vr/particles.js (IIFE) optional
// - ./vr/hha-compat-input.js (IIFE) optional
// - ./vr/hha-cloud-logger.js (IIFE) optional
// - A-Frame 1.5.0
//
// Scene requirements (your plate-vr.html already matches):
// - #cam, #rig, #worldTargets, cursor raycaster objects:.plateTarget
//
// Query params:
// ?diff=easy|normal|hard
// ?time=60..120
// ?mode=play|research
// ?debug=1

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const URLX = new URL(location.href);
const DEBUG = (URLX.searchParams.get('debug') === '1');

const THREE = ROOT.THREE;
const A = ROOT.AFRAME;

if (!A || !THREE) {
  console.error('[PlateVR] AFRAME/THREE not found');
  throw new Error('AFRAME/THREE missing');
}

// ---------- Optional global modules ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, celebrate() {} };

const Cloud =
  ROOT.HHACloudLogger || null; // IIFE exposes {init, flushNow, endpoint}

// ---------- DOM refs (HUD) ----------
const $ = (sel) => document.querySelector(sel);

const hudTime = $('#hudTime');
const hudScore = $('#hudScore');
const hudCombo = $('#hudCombo');
const hudMiss = $('#hudMiss');
const hudFever = $('#hudFever');
const hudFeverPct = $('#hudFeverPct');
const hudGrade = $('#hudGrade');
const hudMode = $('#hudMode');
const hudDiff = $('#hudDiff');
const hudGroupsHave = $('#hudGroupsHave');
const hudPerfectCount = $('#hudPerfectCount');
const hudPaused = $('#hudPaused');

const hudGoalLine = $('#hudGoalLine');
const hudMiniLine = $('#hudMiniLine');
const hudMiniHint = $('#hudMiniHint');

const btnEnterVR = $('#btnEnterVR');
const btnPause = $('#btnPause');
const btnRestart = $('#btnRestart');
const btnPlayAgain = $('#btnPlayAgain');

const resultBackdrop = $('#resultBackdrop');
const rMode = $('#rMode');
const rGrade = $('#rGrade');
const rScore = $('#rScore');
const rMaxCombo = $('#rMaxCombo');
const rMiss = $('#rMiss');
const rPerfect = $('#rPerfect');
const rGoals = $('#rGoals');
const rMinis = $('#rMinis');
const rG1 = $('#rG1');
const rG2 = $('#rG2');
const rG3 = $('#rG3');
const rG4 = $('#rG4');
const rG5 = $('#rG5');
const rGTotal = $('#rGTotal');

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const rig = $('#rig');
const cam = $('#cam');
const worldTargets = $('#worldTargets');

if (!scene || !rig || !cam || !worldTargets) {
  console.error('[PlateVR] missing scene entities (#rig/#cam/#worldTargets)');
  throw new Error('Scene entities missing');
}

// ---------- A-Frame components ----------
if (!A.components['hha-face-camera']) {
  A.registerComponent('hha-face-camera', {
    tick: function () {
      const sc = this.el.sceneEl;
      const c = sc && sc.camera;
      if (!c) return;
      const v = new THREE.Vector3();
      this.el.object3D.lookAt(c.getWorldPosition(v));
    }
  });
}

if (!A.components['hha-wobble']) {
  A.registerComponent('hha-wobble', {
    schema: {
      amp: { type: 'number', default: 0.08 },
      spd: { type: 'number', default: 1.6 }
    },
    init: function () {
      this.t0 = performance.now() * 0.001;
    },
    tick: function (t) {
      const time = (t * 0.001) - this.t0;
      const a = this.data.amp;
      const s = this.data.spd;
      const x = Math.sin(time * s * 1.13) * a;
      const y = Math.cos(time * s * 0.97) * a * 0.7;
      this.el.object3D.position.x = x;
      this.el.object3D.position.y = 1.6 + y; // keep centered near camera height
    }
  });
}

if (!A.components['hha-pulse']) {
  A.registerComponent('hha-pulse', {
    schema: {
      base: { type: 'number', default: 1.0 },
      amp: { type: 'number', default: 0.06 },
      spd: { type: 'number', default: 2.2 }
    },
    init: function () { this.t0 = performance.now() * 0.001; },
    tick: function (t) {
      const time = (t * 0.001) - this.t0;
      const k = this.data.base + Math.sin(time * this.data.spd) * this.data.amp;
      this.el.object3D.scale.set(k, k, k);
    }
  });
}

// ---------- Utils ----------
function clamp(v, a, b) {
  v = Number(v) || 0;
  return Math.max(a, Math.min(b, v));
}
function rint(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid(prefix='id') { return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
function nowIso() { return new Date().toISOString(); }

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function logSession(payload) { dispatch('hha:log_session', payload); }
function logEvent(payload) { dispatch('hha:log_event', payload); }
function logProfile(payload) { dispatch('hha:log_profile', payload); }

// ---------- Audio (simple beeps) ----------
let audioCtx = null;
function beep(freq = 880, dur = 0.06, gain = 0.035) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

// ---------- Difficulty ----------
function parseDiff() {
  const d = String(URLX.searchParams.get('diff') || 'normal').toLowerCase();
  return (d === 'easy' || d === 'hard') ? d : 'normal';
}
function parseMode() {
  const m = String(URLX.searchParams.get('mode') || 'play').toLowerCase();
  return (m === 'research') ? 'research' : 'play';
}
function parseTime() {
  const t = Number(URLX.searchParams.get('time') || 70);
  return clamp(t, 40, 140) | 0;
}

const diff = parseDiff();
const mode = parseMode();
const TOTAL_TIME = parseTime();

const DIFF = {
  easy: {
    spawnMs: 980,
    junkRatio: 0.18,
    wobbleAmp: 0.06,
    wobbleSpd: 1.25,
    dist: 2.05,
    fill: 0.96,
    sweetBase: 0.30,   // radius in UV (bigger = easier Perfect)
    sweetMove: 0.12,
    feverGainGood: 12,
    feverLossMiss: 18
  },
  normal: {
    spawnMs: 860,
    junkRatio: 0.24,
    wobbleAmp: 0.075,
    wobbleSpd: 1.55,
    dist: 2.15,
    fill: 0.94,
    sweetBase: 0.26,
    sweetMove: 0.18,
    feverGainGood: 11,
    feverLossMiss: 20
  },
  hard: {
    spawnMs: 760,
    junkRatio: 0.30,
    wobbleAmp: 0.09,
    wobbleSpd: 1.85,
    dist: 2.25,
    fill: 0.90,
    sweetBase: 0.22,
    sweetMove: 0.24,
    feverGainGood: 10,
    feverLossMiss: 22
  }
}[diff];

hudMode.textContent = (mode === 'research') ? 'Research' : 'Play';
hudDiff.textContent = diff[0].toUpperCase() + diff.slice(1);

// ---------- Camera-fit “big target” ----------
function fitPlaneToCamera(planeEl, camEl, dist = 2.2, fill = 0.92) {
  const camObj = camEl && camEl.getObject3D && camEl.getObject3D('camera');
  if (!camObj) return;

  const fovRad = (Number(camObj.fov) || 60) * Math.PI / 180;
  const aspect = Number(camObj.aspect) || (window.innerWidth / Math.max(1, window.innerHeight));

  const h = 2 * dist * Math.tan(fovRad / 2) * fill;
  const w = h * aspect;

  planeEl.setAttribute('geometry', `primitive:plane; width:${w.toFixed(3)}; height:${h.toFixed(3)}`);
}

// ---------- Balanced plate data ----------
const FOOD_GROUPS = [
  { id: 1, name: 'โปรตีน', emoji: '🥚', score: 120 },
  { id: 2, name: 'ข้าวแป้ง', emoji: '🍚', score: 110 },
  { id: 3, name: 'ผัก', emoji: '🥦', score: 130 },
  { id: 4, name: 'ผลไม้', emoji: '🍎', score: 125 },
  { id: 5, name: 'ไขมันดี', emoji: '🥑', score: 115 }
];

const JUNK = [
  { name: 'น้ำอัดลม', emoji: '🥤', score: -140 },
  { name: 'ขนมหวาน', emoji: '🍩', score: -160 },
  { name: 'เฟรนช์ฟรายส์', emoji: '🍟', score: -150 },
  { name: 'ไก่ทอด', emoji: '🍗', score: -145 }
];

const GOLD = [
  { name: 'โกลด์ผัก', emoji: '🥦✨', bonus: 220 },
  { name: 'โกลด์ผลไม้', emoji: '🍎✨', bonus: 220 },
  { name: 'โกลด์โปรตีน', emoji: '🥚✨', bonus: 220 }
];

// ---------- Game state ----------
const S = {
  started: false,
  ended: false,
  paused: false,

  t0: 0,
  timeLeft: TOTAL_TIME,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  fever: 0,                 // 0..100
  feverActiveUntil: 0,      // ms timestamp
  shield: 0,                // blocks 1 miss

  perfect: 0,
  plateMask: 0,             // bitmask for groups collected in current plate
  platesCleared: 0,         // number of balanced plates completed

  // quests
  goals: [],
  goalIndex: 0,
  goalsCleared: 0,

  minis: [],
  miniIndex: 0,
  minisCleared: 0,
  activeMini: null,
  miniTimer: 0,

  // spawn
  spawnTimer: 0,
  activeTarget: null,

  // adaptive (play mode only)
  hitCount: 0,
  totalShots: 0,
  streakGood: 0,
  lastHitAt: 0,

  // session/logging
  sessionId: uid('plate'),
  userAgent: navigator.userAgent || '',
  runMode: mode,
  diff
};

function inFever() {
  return performance.now() < S.feverActiveUntil;
}

function setFeverUI() {
  const pct = clamp(S.fever, 0, 100);
  hudFever.style.width = `${pct}%`;
  hudFeverPct.textContent = `${pct|0}%`;
}

function computeGrade() {
  // simple but punchy: reward score+combo+perfect, punish miss
  const score = S.score;
  const combo = S.comboMax;
  const perf = S.perfect;
  const miss = S.miss;

  const v = (score * 0.0012) + (combo * 0.9) + (perf * 0.7) - (miss * 1.4);

  if (v >= 120) return 'SSS';
  if (v >= 90) return 'SS';
  if (v >= 68) return 'S';
  if (v >= 45) return 'A';
  if (v >= 25) return 'B';
  return 'C';
}

function syncHUD() {
  hudTime.textContent = `${Math.max(0, S.timeLeft|0)}`;
  hudScore.textContent = `${S.score|0}`;
  hudCombo.textContent = `${S.combo|0}`;
  hudMiss.textContent = `${S.miss|0}`;
  hudGroupsHave.textContent = `${countBits(S.plateMask)}/5`;
  hudPerfectCount.textContent = `${S.perfect|0}`;
  hudGrade.textContent = computeGrade();

  hudPaused.style.display = S.paused ? '' : 'none';
  setFeverUI();

  // Quest lines
  const g = S.goals[S.goalIndex];
  if (g) {
    const v = g.eval();
    hudGoalLine.textContent = `Goal ${S.goalIndex+1}/${S.goals.length}: ${g.label} (${v}/${g.target})`;
  } else {
    hudGoalLine.textContent = '…';
  }

  const m = S.activeMini;
  if (m) {
    hudMiniLine.textContent = `MINI: ${m.label}`;
    hudMiniHint.textContent = m.hint || '';
  } else {
    hudMiniLine.textContent = '…';
    hudMiniHint.textContent = '…';
  }
}

function countBits(mask) {
  let c = 0;
  for (let i = 0; i < 5; i++) if (mask & (1<<i)) c++;
  return c;
}

function resetPlate() { S.plateMask = 0; }

// ---------- Quests (GoodJunk style: 2 goals + chain minis) ----------
function makeGoals() {
  // 2 goals per run, tuned by diff
  const tgtPlate = (diff === 'easy') ? 2 : (diff === 'normal' ? 2 : 3);
  const tgtScore = (diff === 'easy') ? 1200 : (diff === 'normal' ? 1800 : 2400);
  const tgtPerfect = (diff === 'easy') ? 4 : (diff === 'normal' ? 6 : 8);

  const pool = [
    {
      id: 'g_plate',
      label: `เคลียร์ “จานสมดุล” ให้ได้ ${tgtPlate} ใบ 🍽️`,
      target: tgtPlate,
      eval: () => (S.platesCleared|0),
      pass: (v, t) => v >= t
    },
    {
      id: 'g_score',
      label: `ทำคะแนนให้ได้ ${tgtScore} ⭐`,
      target: tgtScore,
      eval: () => (S.score|0),
      pass: (v, t) => v >= t
    },
    {
      id: 'g_perfect',
      label: `Perfect ให้ได้ ${tgtPerfect} ครั้ง 🌟`,
      target: tgtPerfect,
      eval: () => (S.perfect|0),
      pass: (v, t) => v >= t
    }
  ];

  // choose 2 distinct
  const g1 = choice(pool);
  let g2 = choice(pool);
  while (g2.id === g1.id) g2 = choice(pool);

  return [g1, g2];
}

function makeMinis() {
  // chain minis (we run 3–5 minis depending on time)
  const chainCount = (TOTAL_TIME >= 90) ? 5 : (TOTAL_TIME >= 70 ? 4 : 3);

  const minisPool = [
    {
      id: 'm_rush',
      label: 'Plate Rush (8s)',
      hint: 'ทำจานให้ครบ 5 หมู่ใน 8 วินาที • ห้ามโดนขยะระหว่างทำ ✅',
      start: () => { S.miniTimer = 8; S._miniNoJunk = true; S._miniStartMiss = S.miss; resetPlate(); },
      tick: (dt) => {},
      progress: () => `${countBits(S.plateMask)}/5 • ${S.miniTimer.toFixed(1)}s`,
      pass: () => (countBits(S.plateMask) >= 5) && (S.miss === S._miniStartMiss),
      fail: () => (S.miss > S._miniStartMiss) || (S.miniTimer <= 0)
    },
    {
      id: 'm_nojunk',
      label: 'No-Junk Zone (10s)',
      hint: 'รอด 10 วินาที ห้ามโดนขยะเลย!',
      start: () => { S.miniTimer = 10; S._miniStartMiss = S.miss; },
      tick: (dt) => {},
      progress: () => `${Math.max(0, S.miniTimer).toFixed(1)}s`,
      pass: () => (S.miniTimer <= 0) && (S.miss === S._miniStartMiss),
      fail: () => (S.miss > S._miniStartMiss)
    },
    {
      id: 'm_combo',
      label: 'Combo Sprint',
      hint: 'ทำคอมโบให้ถึง 12 ภายในเวลา 14 วินาที!',
      start: () => { S.miniTimer = 14; S._miniComboStart = S.comboMax; },
      tick: (dt) => {},
      progress: () => `${S.combo}/${12} • ${S.miniTimer.toFixed(1)}s`,
      pass: () => (S.combo >= 12),
      fail: () => (S.miniTimer <= 0)
    },
    {
      id: 'm_perfect',
      label: 'Perfect Streak',
      hint: 'ทำ Perfect ติดต่อกัน 5 ครั้ง (พลาดตัดใหม่)!',
      start: () => { S.miniTimer = 18; S._miniPerfectStreak = 0; },
      tick: (dt) => {},
      progress: () => `${S._miniPerfectStreak||0}/5 • ${S.miniTimer.toFixed(1)}s`,
      pass: () => (S._miniPerfectStreak >= 5),
      fail: () => (S.miniTimer <= 0)
    },
    {
      id: 'm_rainbow',
      label: 'Rainbow Plate (12s)',
      hint: 'เก็บครบ 5 หมู่ให้ไวที่สุดใน 12 วินาที!',
      start: () => { S.miniTimer = 12; resetPlate(); },
      tick: (dt) => {},
      progress: () => `${countBits(S.plateMask)}/5 • ${S.miniTimer.toFixed(1)}s`,
      pass: () => (countBits(S.plateMask) >= 5),
      fail: () => (S.miniTimer <= 0)
    }
  ];

  const out = [];
  while (out.length < chainCount) {
    const m = choice(minisPool);
    // allow repeats but avoid immediate duplicates
    if (!out.length || out[out.length - 1].id !== m.id) out.push(m);
  }
  return out;
}

// ---------- Target (full-screen + sweet spot) ----------
function clearActiveTarget() {
  if (S.activeTarget && S.activeTarget.parentNode) {
    S.activeTarget.parentNode.removeChild(S.activeTarget);
  }
  S.activeTarget = null;
}

function makeSweetSpotChild(parent, sweet) {
  // Sweet spot ring shown on target (subtle)
  const ring = document.createElement('a-ring');
  ring.setAttribute('radius-inner', 0.13);
  ring.setAttribute('radius-outer', 0.17);
  ring.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.22; transparent:true; side:double');
  ring.setAttribute('position', `${sweet.x} ${sweet.y} 0.01`);
  ring.setAttribute('hha-pulse', 'base:1; amp:0.08; spd:2.6');
  parent.appendChild(ring);

  const dot = document.createElement('a-circle');
  dot.setAttribute('radius', 0.03);
  dot.setAttribute('material', 'shader:flat; color:#ffffff; opacity:0.28; transparent:true; side:double');
  dot.setAttribute('position', `${sweet.x} ${sweet.y} 0.011`);
  parent.appendChild(dot);

  return { ring, dot };
}

function makeEmojiChild(parent, emoji) {
  const t = document.createElement('a-entity');
  t.setAttribute('text', `value:${emoji}; align:center; baseline:center; color:#ffffff; width:6; wrapCount:2`);
  t.setAttribute('position', '0 0 0.012');
  t.setAttribute('hha-pulse', 'base:1; amp:0.05; spd:2.0');
  parent.appendChild(t);
  return t;
}

function pickTargetKind() {
  // FUN: occasional gold + traps
  const feverOn = inFever();
  const roll = Math.random();

  // during fever: more GOOD, fewer junk (feel power)
  const junkR = feverOn ? (DIFF.junkRatio * 0.65) : DIFF.junkRatio;

  if (roll < 0.10) return { kind: 'gold', data: choice(GOLD) };
  if (roll < 0.10 + junkR) return { kind: 'junk', data: choice(JUNK) };

  // regular food group
  return { kind: 'good', data: choice(FOOD_GROUPS) };
}

function spawnTarget() {
  clearActiveTarget();

  const tk = pickTargetKind();

  const el = document.createElement('a-entity');
  el.classList.add('plateTarget');
  el.setAttribute('hha-face-camera', '');
  el.setAttribute('material', 'shader:flat; color:#1f2937; transparent:true; opacity:0.18; side:double');

  // position in front camera, centered
  const dist = DIFF.dist;
  el.setAttribute('position', `0 1.6 -${dist}`);

  // gentle wobble (motion -> VR feel)
  el.setAttribute('hha-wobble', `amp:${DIFF.wobbleAmp}; spd:${DIFF.wobbleSpd}`);

  // Fit geometry to camera FOV => BIG FULLSCREEN target
  fitPlaneToCamera(el, cam, dist, DIFF.fill);

  // Sweet spot in local plane coords
  // We map UV [0..1] => local plane units [-w/2..w/2], [-h/2..h/2]
  const camObj = cam.getObject3D('camera');
  const w = Number(el.getAttribute('geometry')?.width) || 2.0;
  const h = Number(el.getAttribute('geometry')?.height) || 1.2;

  const sweet = {
    // center offset (moves)
    u: clamp(0.5 + (Math.random()*2-1) * DIFF.sweetMove, 0.18, 0.82),
    v: clamp(0.5 + (Math.random()*2-1) * DIFF.sweetMove, 0.18, 0.82),
    r: DIFF.sweetBase, // in UV radius
    // local position (x,y)
    x: 0,
    y: 0
  };
  sweet.x = (sweet.u - 0.5) * w;
  sweet.y = (sweet.v - 0.5) * h;

  // children: emoji + sweet ring
  const emoji = (tk.kind === 'good') ? tk.data.emoji
             : (tk.kind === 'junk') ? tk.data.emoji
             : tk.data.emoji;

  makeEmojiChild(el, emoji);
  const sweetChild = makeSweetSpotChild(el, sweet);

  // store meta
  el.dataset.kind = tk.kind;
  el.dataset.groupId = (tk.kind === 'good') ? String(tk.data.id) : '';
  el.dataset.name = tk.data.name || '';
  el._tk = tk;
  el._sweet = sweet;
  el._wh = { w, h };
  el._sweetChild = sweetChild;

  // click handler
  el.addEventListener('click', (e) => onHitTarget(el, e));

  worldTargets.appendChild(el);
  S.activeTarget = el;
}

function uvFromIntersection(intersection) {
  // A-Frame gives intersection.uv sometimes; if missing, fallback center.
  if (intersection && intersection.uv) {
    return { u: intersection.uv.x, v: intersection.uv.y };
  }
  return { u: 0.5, v: 0.5 };
}

function distUV(u1, v1, u2, v2) {
  const du = u1 - u2;
  const dv = v1 - v2;
  return Math.sqrt(du*du + dv*dv);
}

function hitFX(kind, isPerfect) {
  // strong feedback like GoodJunk
  if (isPerfect) {
    Particles.scorePop('🌟 PERFECT!', 'GOLD');
    beep(1046, 0.05, 0.04);
    beep(1318, 0.06, 0.03);
  } else if (kind === 'good' || kind === 'gold') {
    Particles.scorePop('✅ GOOD!', kind === 'gold' ? 'GOLD' : 'GOOD');
    beep(880, 0.045, 0.03);
  } else {
    Particles.scorePop('💥 MISS!', 'BAD');
    beep(220, 0.07, 0.05);
  }
}

function tinyShake(power = 0.6, ms = 120) {
  // micro rig shake (won't fight look-controls too hard)
  try {
    const o = rig.object3D;
    const ry0 = o.rotation.y;
    const rx0 = o.rotation.x;
    const t0 = performance.now();
    const k = power * 0.012;

    const timer = setInterval(() => {
      const t = performance.now() - t0;
      if (t >= ms) {
        clearInterval(timer);
        o.rotation.x = rx0;
        o.rotation.y = ry0;
        return;
      }
      o.rotation.x = rx0 + (Math.random()*2-1) * k;
      o.rotation.y = ry0 + (Math.random()*2-1) * k;
    }, 16);
  } catch (_) {}
}

// ---------- Core gameplay ----------
function startGameIfNeeded() {
  if (S.started) return;
  S.started = true;
  S.t0 = performance.now();
  S.spawnTimer = 0;
  S.timeLeft = TOTAL_TIME;

  // quests
  S.goals = makeGoals();
  S.goalIndex = 0;
  S.goalsCleared = 0;

  S.minis = makeMinis();
  S.miniIndex = 0;
  S.minisCleared = 0;
  S.activeMini = S.minis[0] || null;
  if (S.activeMini) S.activeMini.start();

  // initial spawn
  spawnTarget();
  syncHUD();

  // log session start
  logSession({
    type: 'session_start',
    timestampIso: nowIso(),
    sessionId: S.sessionId,
    game: 'PlateVR',
    mode: S.runMode,
    diff: S.diff,
    time: TOTAL_TIME,
    ua: S.userAgent
  });

  if (DEBUG) console.log('[PlateVR] start', { sessionId: S.sessionId, diff, mode, TOTAL_TIME });
}

function addScore(delta) {
  S.score = (S.score + delta) | 0;
  if (S.score < 0) S.score = 0;
}

function addFever(delta) {
  S.fever = clamp(S.fever + delta, 0, 100);
  if (S.fever >= 100 && !inFever()) {
    // Trigger FEVER: power moment
    S.fever = 100;
    S.feverActiveUntil = performance.now() + 6500; // 6.5s
    S.shield = 1; // give a shield on fever trigger (feels awesome)
    Particles.scorePop('🔥 FEVER MODE!', 'GOLD');
    Particles.celebrate && Particles.celebrate('FEVER');
    beep(660, 0.08, 0.04);
    beep(990, 0.08, 0.035);

    logEvent({
      type: 'fever_start',
      timestampIso: nowIso(),
      sessionId: S.sessionId,
      t: TOTAL_TIME - S.timeLeft
    });
  }
}

function applyGood(groupId, baseScore, isPerfect, kind) {
  S.totalShots++;
  S.hitCount++;
  S.streakGood++;
  S.lastHitAt = performance.now();

  // combo
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  // fever gain
  addFever(DIFF.feverGainGood + (isPerfect ? 4 : 0));

  // score
  let mult = 1;
  if (inFever()) mult *= 2.0;
  mult *= (1 + clamp(S.combo, 0, 30) * 0.03); // combo scales
  if (isPerfect) mult *= 1.35;

  let gain = Math.round(baseScore * mult);

  if (kind === 'gold') gain += 240;
  addScore(gain);

  if (isPerfect) {
    S.perfect++;
    if (S.activeMini && S.activeMini.id === 'm_perfect') {
      S._miniPerfectStreak = (S._miniPerfectStreak || 0) + 1;
    }
  } else {
    // break perfect streak mini
    if (S.activeMini && S.activeMini.id === 'm_perfect') {
      S._miniPerfectStreak = 0;
    }
  }

  // plate progress
  if (groupId) {
    const bit = (1 << (Number(groupId) - 1));
    S.plateMask |= bit;

    if (countBits(S.plateMask) >= 5) {
      S.platesCleared++;
      resetPlate();
      Particles.celebrate && Particles.celebrate('PLATE');
      Particles.scorePop('🍽️ PLATE CLEARED!', 'GOOD');
      beep(523, 0.07, 0.03);
      beep(784, 0.08, 0.03);

      logEvent({
        type: 'plate_cleared',
        timestampIso: nowIso(),
        sessionId: S.sessionId,
        platesCleared: S.platesCleared,
        t: TOTAL_TIME - S.timeLeft
      });
    }
  }

  hitFX(kind, isPerfect);
}

function applyMiss(reason = 'junk') {
  S.totalShots++;
  S.streakGood = 0;

  // shield blocks 1 miss (feels fair)
  if (S.shield > 0) {
    S.shield = 0;
    Particles.scorePop('🛡️ SHIELD BLOCK!', 'GOLD');
    beep(392, 0.06, 0.03);
    beep(494, 0.06, 0.03);
    tinyShake(0.35, 90);
    return;
  }

  S.miss++;
  S.combo = 0;

  // fever penalty
  addFever(-DIFF.feverLossMiss);

  // score penalty (but not too harsh)
  addScore(-120);

  hitFX('junk', false);
  tinyShake(0.7, 140);

  logEvent({
    type: 'miss',
    timestampIso: nowIso(),
    sessionId: S.sessionId,
    reason,
    t: TOTAL_TIME - S.timeLeft
  });
}

function onHitTarget(el, e) {
  if (S.ended || S.paused) return;
  startGameIfNeeded();

  // Determine perfect by raycast uv vs sweet spot
  const inter = e && e.detail && e.detail.intersection;
  const { u, v } = uvFromIntersection(inter);

  const sweet = el._sweet || { u: 0.5, v: 0.5, r: 0.25 };
  const d = distUV(u, v, sweet.u, sweet.v);

  const isPerfect = (d <= sweet.r);

  const tk = el._tk || { kind: el.dataset.kind || 'good', data: {} };
  const kind = tk.kind;

  // remove target quickly (arcade)
  clearActiveTarget();

  if (kind === 'junk') {
    applyMiss('junk_hit');
  } else if (kind === 'gold') {
    applyGood('', 130, isPerfect, 'gold');
  } else {
    const gid = el.dataset.groupId || String(tk.data.id || '');
    const baseScore = tk.data.score || 120;
    applyGood(gid, baseScore, isPerfect, 'good');
  }

  // quest checks
  checkGoalProgress();
  checkMiniProgress(true);

  // spawn next quickly (snappy)
  S.spawnTimer = 0;

  // adaptive: in play mode only, tune spawn speed based on performance
  if (mode === 'play') adaptiveTuning();

  syncHUD();
}

// ---------- Adaptive tuning (Play mode only) ----------
let adaptiveSpawnMs = DIFF.spawnMs;

function adaptiveTuning() {
  const shots = Math.max(1, S.totalShots);
  const hitRate = S.hitCount / shots;

  // If player is strong -> faster spawns + smaller sweet spot (but keep fair)
  // If struggling -> ease slightly
  let ms = DIFF.spawnMs;

  if (hitRate > 0.82 && S.comboMax >= 10) ms *= 0.82;
  else if (hitRate > 0.74) ms *= 0.90;
  else if (hitRate < 0.55) ms *= 1.10;

  // fever adds intensity (but not unfair)
  if (inFever()) ms *= 0.88;

  adaptiveSpawnMs = clamp(ms, 520, 1200);
}

// ---------- Goals & minis progress ----------
function checkGoalProgress() {
  const g = S.goals[S.goalIndex];
  if (!g) return;

  const v = g.eval();
  if (g.pass(v, g.target)) {
    S.goalsCleared++;
    Particles.celebrate && Particles.celebrate('GOAL');
    Particles.scorePop('🎯 GOAL CLEAR!', 'GOOD');
    beep(659, 0.06, 0.04);
    beep(988, 0.08, 0.03);

    logEvent({
      type: 'goal_clear',
      timestampIso: nowIso(),
      sessionId: S.sessionId,
      goalId: g.id,
      goalLabel: g.label,
      value: v,
      t: TOTAL_TIME - S.timeLeft
    });

    S.goalIndex++;

    // Small reward: a bit of fever + shield occasionally
    addFever(18);
    if (Math.random() < 0.45) S.shield = 1;
  }
}

function startNextMini() {
  S.miniIndex++;
  if (S.miniIndex >= S.minis.length) {
    S.activeMini = null;
    return;
  }
  S.activeMini = S.minis[S.miniIndex];
  if (S.activeMini && S.activeMini.start) S.activeMini.start();
}

function checkMiniProgress(justHit = false) {
  const m = S.activeMini;
  if (!m) return;

  if (m.pass && m.pass()) {
    S.minisCleared++;
    Particles.celebrate && Particles.celebrate('MINI');
    Particles.scorePop('🧩 MINI CLEAR!', 'GOOD');
    beep(784, 0.07, 0.035);
    beep(1046, 0.07, 0.03);

    logEvent({
      type: 'mini_clear',
      timestampIso: nowIso(),
      sessionId: S.sessionId,
      miniId: m.id,
      miniLabel: m.label,
      t: TOTAL_TIME - S.timeLeft
    });

    // reward
    addScore(220);
    addFever(14);
    if (Math.random() < 0.35) S.shield = 1;

    startNextMini();
    return;
  }

  if (m.fail && m.fail()) {
    // fail feels tense but not game-over
    Particles.scorePop('❌ MINI FAIL!', 'BAD');
    beep(196, 0.07, 0.05);
    addScore(-120);
    addFever(-16);

    logEvent({
      type: 'mini_fail',
      timestampIso: nowIso(),
      sessionId: S.sessionId,
      miniId: m.id,
      miniLabel: m.label,
      t: TOTAL_TIME - S.timeLeft
    });

    // Immediately roll next mini to keep flow exciting
    startNextMini();
  }
}

// ---------- Near-time warning FX ----------
let lastTickSec = -1;
function nearTimeFX() {
  // global time warning
  if (S.timeLeft <= 10) {
    const sec = Math.ceil(S.timeLeft);
    if (sec !== lastTickSec) {
      lastTickSec = sec;
      beep(520, 0.03, 0.03);
      tinyShake(0.30, 60);
    }
    // pulse hud
    const top = document.getElementById('hudTop');
    if (top) top.style.filter = 'drop-shadow(0 0 18px rgba(250,204,21,.28))';
  } else {
    const top = document.getElementById('hudTop');
    if (top) top.style.filter = '';
  }

  // mini warning: last 2.2s
  if (S.activeMini && S.miniTimer <= 2.2 && S.miniTimer > 0) {
    beep(780, 0.02, 0.02);
    tinyShake(0.22, 45);
    const left = document.getElementById('hudLeft');
    if (left) left.style.filter = 'drop-shadow(0 0 16px rgba(255,255,255,.16))';
  } else {
    const left = document.getElementById('hudLeft');
    if (left) left.style.filter = '';
  }
}

// ---------- Loop ----------
function update(dt) {
  if (!S.started || S.ended || S.paused) return;

  // timer
  S.timeLeft -= dt;
  if (S.timeLeft <= 0) {
    S.timeLeft = 0;
    endGame();
    return;
  }

  // mini timer
  if (S.activeMini && typeof S.miniTimer === 'number') {
    S.miniTimer -= dt;
  }

  // spawn pacing
  const spawnMs = (mode === 'research') ? DIFF.spawnMs : adaptiveSpawnMs;
  const spawnSec = spawnMs / 1000;
  S.spawnTimer += dt;

  if (!S.activeTarget && S.spawnTimer >= spawnSec) {
    S.spawnTimer = 0;
    spawnTarget();
  }

  // fever decay while active ends -> drop to 60 then decay
  if (!inFever() && S.fever > 0) {
    S.fever -= dt * 5.5; // slow decay
    if (S.fever < 0) S.fever = 0;
  }

  // mini progress checks (time-based)
  checkMiniProgress(false);

  // UI warnings
  nearTimeFX();

  syncHUD();
}

let raf = 0;
let lastT = 0;

function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!S.started) return;

  if (!lastT) lastT = t;
  const dt = clamp((t - lastT) / 1000, 0, 0.05);
  lastT = t;

  update(dt);
}

// ---------- End game ----------
function endGame() {
  if (S.ended) return;
  S.ended = true;

  clearActiveTarget();

  // Final log
  logSession({
    type: 'session_end',
    timestampIso: nowIso(),
    sessionId: S.sessionId,
    game: 'PlateVR',
    mode: S.runMode,
    diff: S.diff,
    timeTotal: TOTAL_TIME,
    timePlayed: TOTAL_TIME - S.timeLeft,
    score: S.score,
    comboMax: S.comboMax,
    miss: S.miss,
    perfect: S.perfect,
    goalsCleared: S.goalsCleared,
    goalsTotal: (S.goals || []).length,
    minisCleared: S.minisCleared,
    minisTotal: (S.minis || []).length,
    grade: computeGrade()
  });

  if (Cloud && Cloud.flushNow) {
    try { Cloud.flushNow(true); } catch (_) {}
  }

  // Show modal
  resultBackdrop.style.display = 'flex';
  rMode.textContent = hudMode.textContent;
  rGrade.textContent = computeGrade();
  rScore.textContent = `${S.score|0}`;
  rMaxCombo.textContent = `${S.comboMax|0}`;
  rMiss.textContent = `${S.miss|0}`;
  rPerfect.textContent = `${S.perfect|0}`;

  rGoals.textContent = `${S.goalsCleared}/${(S.goals||[]).length}`;
  rMinis.textContent = `${S.minisCleared}/${(S.minis||[]).length}`;

  // goal breakdown (simple values)
  const gvals = (S.goals||[]).map(g => g.eval());
  rG1.textContent = `${gvals[0] ?? 0}`;
  rG2.textContent = `${gvals[1] ?? 0}`;
  rG3.textContent = `plates:${S.platesCleared}`;
  rG4.textContent = `comboMax:${S.comboMax}`;
  rG5.textContent = `fever:${(S.fever|0)}%`;
  rGTotal.textContent = `${S.score|0}`;
}

// ---------- Controls ----------
function togglePause() {
  if (!S.started) startGameIfNeeded();
  if (S.ended) return;

  S.paused = !S.paused;
  if (S.paused) {
    Particles.scorePop('⏸️ PAUSED', 'INFO');
  } else {
    Particles.scorePop('▶️ GO!', 'GOOD');
  }
  syncHUD();
}

function restart() {
  location.reload();
}

// Enter VR button
btnEnterVR && btnEnterVR.addEventListener('click', async () => {
  try {
    startGameIfNeeded();
    if (scene && scene.enterVR) await scene.enterVR();
  } catch (e) {
    console.warn('[PlateVR] enterVR failed', e);
  }
});

// Pause button
btnPause && btnPause.addEventListener('click', () => togglePause());

// Restart button
btnRestart && btnRestart.addEventListener('click', () => restart());

// Play again
btnPlayAgain && btnPlayAgain.addEventListener('click', () => restart());

// Tap-anywhere: start game (and/or “shoot” by clicking target)
// We only start game on first pointerdown to satisfy mobile audio unlock too
window.addEventListener('pointerdown', () => {
  if (!S.started) startGameIfNeeded();
}, { passive: true });

// Esc close modal (optional)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && resultBackdrop && resultBackdrop.style.display === 'flex') {
    resultBackdrop.style.display = 'none';
  }
});

// ---------- Init ----------
(function init() {
  // Make sure logger endpoint persists (IIFE already auto-init, but safe)
  if (Cloud && Cloud.endpoint) {
    if (DEBUG) console.log('[PlateVR] logger endpoint:', Cloud.endpoint);
  }

  // Pre-warm UI
  S.timeLeft = TOTAL_TIME;
  S.goals = makeGoals();
  S.minis = makeMinis();
  S.activeMini = S.minis[0] || null;
  if (S.activeMini) S.activeMini.start();

  syncHUD();

  // Start loop
  requestAnimationFrame((t) => {
    S.started = false;   // wait for first input (pointerdown/click)
    lastT = t;
    raf = requestAnimationFrame(loop);
  });

  if (DEBUG) console.log('[PlateVR] ready', { diff, mode, TOTAL_TIME });
})();