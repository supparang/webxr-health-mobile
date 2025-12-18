// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Full Engine (ES Module) [FINAL PATCH]
// ✅ Emoji targets (CanvasTexture)
// ✅ Click/Touch works 100% (manual THREE.Raycaster fallback)
// ✅ FX: burst only at target + score pop + cartoon judgement near target
// ✅ MISS: left-right ricochet + screen shake; PERFECT: star confetti + "ting"
// ✅ Mini quest Plate Rush (HARD): "ครบ 5 ภายใน 8 วิ" + "ห้ามโดนขยะระหว่างทำ"
// ✅ Plate Rush near timeout: blink + tick-tick + soft border shake
//
// Works with your plate-vr.html (no extra HTML required)

'use strict';

// ---------- Root ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const A = ROOT.AFRAME;
const THREE = ROOT.THREE;

// ---------- URL defaults ----------
const URLX = new URL(location.href);
let DIFF = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
let TIME = parseInt(URLX.searchParams.get('time') || '70', 10);
if (Number.isNaN(TIME) || TIME <= 0) TIME = 70;
TIME = Math.max(20, Math.min(180, TIME));
let MODE = (URLX.searchParams.get('run') || 'play').toLowerCase() === 'research' ? 'research' : 'play';

// expose for debug
ROOT.DIFF = DIFF;
ROOT.TIME = TIME;
ROOT.MODE = MODE;

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
function setText(id, v) { const el = $(id); if (el) el.textContent = String(v); }
function clamp(v, a, b) { v = Number(v) || 0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

// ---------- Particles (from /vr/particles.js) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  {
    scorePop(x, y, value, opts) {
      // super simple fallback
      const el = document.createElement('div');
      el.textContent = String(value || '');
      Object.assign(el.style, {
        position: 'fixed',
        left: (x || 200) + 'px',
        top: (y || 200) + 'px',
        transform: 'translate(-50%,-50%)',
        fontSize: '22px',
        fontWeight: '900',
        color: '#fff',
        textShadow: '0 8px 22px rgba(0,0,0,.75)',
        zIndex: 99999,
        pointerEvents: 'none',
        opacity: '1',
        transition: 'transform .45s ease, opacity .45s ease'
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-95%) scale(1.05)'; el.style.opacity = '0'; });
      setTimeout(() => { try { el.remove(); } catch {} }, 520);
    },
    burstAt() {}
  };

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.88, lifeMs: 2200, junkRate: 0.12, powerRate: 0.10, hazRate: 0.08 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.78, lifeMs: 1950, junkRate: 0.18, powerRate: 0.10, hazRate: 0.10 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.70, lifeMs: 1750, junkRate: 0.24, powerRate: 0.11, hazRate: 0.12 }
};

// ---------- Pools ----------
const POOL = {
  g1: { id: 1, type: 'good', emojis: ['🥚','🥛','🐟','🍗','🫘'] },
  g2: { id: 2, type: 'good', emojis: ['🍚','🍞','🍜','🥔','🌽'] },
  g3: { id: 3, type: 'good', emojis: ['🥦','🥬','🥕','🍅','🥒'] },
  g4: { id: 4, type: 'good', emojis: ['🍎','🍌','🍇','🍊','🍉'] },
  g5: { id: 5, type: 'good', emojis: ['🥑','🫒','🥜','🧈','🍯'] },
  junk:{ id: 0, type: 'junk', emojis: ['🍟','🍔','🍩','🧋','🍭','🥤'] }
};
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

const POWER = {
  shield: { key:'shield', emoji:'🥗', durMs: 5200 },
  cleanse:{ key:'cleanse',emoji:'🍋', durMs: 0 },
  golden: { key:'golden', emoji:'⭐',  durMs: 0 }
};

const HAZ = {
  wind:     { key:'wind',     emoji:'🌪️', durMs: 3800 },
  blackhole:{ key:'blackhole',emoji:'🕳️', durMs: 4200 },
  freeze:   { key:'freeze',   emoji:'🧊', durMs: 3600 }
};

// ---------- Session ----------
const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function emit(type, detail) { ROOT.dispatchEvent(new CustomEvent(type, { detail })); }

// ---------- Game state ----------
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

let miniCleared = 0;
let miniCurrent = null;
let miniHistory = 0;

let bossOn = false;
let bossHP = 0;

let balancePct = 100;
let shieldOn = false;
let shieldUntil = 0;

let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };

let spawnTimer = null;
let activeTargets = new Map();
let targetSeq = 0;

let currentSpawnInterval = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;

// ---------- Rush mini hard state ----------
let rushActive = false;
let rushTimerLeft = 0;
let rushNoJunk = true;

// ===============================
// Plate Rush Warning FX (pulse + tick + soft border shake)
// ===============================
let __rushWarnEl = null;
let __rushWarnOn = false;
let __rushTickCtx = null;
let __rushTickOsc = null;
let __rushTickGain = null;

function ensureRushWarnEl(){
  if (__rushWarnEl) return __rushWarnEl;

  const el = document.createElement('div');
  el.id = 'hha-rush-warn';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: 680,
    opacity: '0',
    transition: 'opacity .12s ease-out',
  });

  const border = document.createElement('div');
  border.className = 'hha-rush-border';
  Object.assign(border.style, {
    position: 'absolute',
    inset: '0',
    borderRadius: '22px',
    margin: '10px',
    border: '2px solid rgba(251,191,36,0.0)',
    boxShadow: '0 0 0 rgba(0,0,0,0)'
  });
  el.appendChild(border);

  if (!document.getElementById('hha-rush-warn-style')) {
    const st = document.createElement('style');
    st.id = 'hha-rush-warn-style';
    st.textContent = `
      @keyframes hhaRushPulse { 0%{opacity:.10} 50%{opacity:.45} 100%{opacity:.10} }
      @keyframes hhaRushShake { 0%{transform:translate(0,0)} 25%{transform:translate(-2px,0)} 50%{transform:translate(2px,0)} 75%{transform:translate(0,1px)} 100%{transform:translate(0,0)} }
      #hha-rush-warn.on { opacity: 1; }
      #hha-rush-warn.on .hha-rush-border{
        animation: hhaRushPulse .28s ease-in-out infinite, hhaRushShake .38s ease-in-out infinite;
        border-color: rgba(251,191,36,.65);
        box-shadow: 0 0 18px rgba(251,191,36,.22), 0 0 55px rgba(249,115,22,.16), inset 0 0 34px rgba(251,191,36,.10);
      }
      @media (prefers-reduced-motion: reduce){
        #hha-rush-warn.on .hha-rush-border{ animation: hhaRushPulse .5s ease-in-out infinite; }
      }
    `;
    document.head.appendChild(st);
  }

  document.body.appendChild(el);
  __rushWarnEl = el;
  return el;
}

function rushTickBeep(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!__rushTickCtx) {
      __rushTickCtx = new AudioCtx();
      __rushTickGain = __rushTickCtx.createGain();
      __rushTickGain.gain.value = 0.0;
      __rushTickGain.connect(__rushTickCtx.destination);

      __rushTickOsc = __rushTickCtx.createOscillator();
      __rushTickOsc.type = 'square';
      __rushTickOsc.frequency.value = 880;
      __rushTickOsc.connect(__rushTickGain);
      __rushTickOsc.start();
    }

    if (__rushTickCtx.state === 'suspended') __rushTickCtx.resume();

    const t = __rushTickCtx.currentTime;
    __rushTickGain.gain.cancelScheduledValues(t);
    __rushTickGain.gain.setValueAtTime(0.0, t);
    __rushTickGain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    __rushTickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  }catch(_){}
}

function startRushWarning(){
  if (__rushWarnOn) return;
  __rushWarnOn = true;
  const el = ensureRushWarnEl();
  el.classList.add('on');
}
function stopRushWarning(){
  if (!__rushWarnOn) return;
  __rushWarnOn = false;
  if (__rushWarnEl) __rushWarnEl.classList.remove('on');
}

// ===============================
// Screen shake / ricochet for MISS (LINE-sticker vibe)
// ===============================
let __shakeStyleAdded = false;
function ensureShakeStyle(){
  if (__shakeStyleAdded) return;
  __shakeStyleAdded = true;
  const st = document.createElement('style');
  st.textContent = `
    @keyframes hhaMissShake {
      0%{transform:translate(0,0)}
      15%{transform:translate(-10px, 0)}
      30%{transform:translate(10px, 0)}
      45%{transform:translate(-8px, 2px)}
      60%{transform:translate(8px, -2px)}
      75%{transform:translate(-5px, 1px)}
      100%{transform:translate(0,0)}
    }
    body.hha-miss-shake{ animation: hhaMissShake .28s ease-in-out 1; }
  `;
  document.head.appendChild(st);
}
function doMissShake(){
  ensureShakeStyle();
  document.body.classList.remove('hha-miss-shake');
  // force reflow
  void document.body.offsetWidth;
  document.body.classList.add('hha-miss-shake');
  setTimeout(()=>document.body.classList.remove('hha-miss-shake'), 320);
}

// ===============================
// Simple SFX (ting for PERFECT)
// ===============================
let __sfxCtx = null;
function sfxTing(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!__sfxCtx) __sfxCtx = new AudioCtx();
    if (__sfxCtx.state === 'suspended') __sfxCtx.resume();

    const t = __sfxCtx.currentTime;
    const o = __sfxCtx.createOscillator();
    const g = __sfxCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.10);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(__sfxCtx.destination);
    o.start(t);
    o.stop(t + 0.20);
  }catch(_){}
}

// ===============================
// FX at target (burst + score + cartoon judge near hit)
// ===============================
function getSceneCamera() {
  return (scene && scene.camera) ? scene.camera : null;
}

function screenPosPxFromEntity(el){
  try{
    const cam3 = getSceneCamera();
    if (!cam3 || !el || !el.object3D || !THREE) return null;

    const v = new THREE.Vector3();
    el.object3D.getWorldPosition(v);
    v.project(cam3);

    if (v.z > 1) return null; // behind camera
    const x = (v.x + 1) / 2;
    const y = (1 - (v.y + 1) / 2);

    return {
      x: Math.round(x * window.innerWidth),
      y: Math.round(y * window.innerHeight)
    };
  }catch(_){
    return null;
  }
}

function fxBurstAtEntity(el, label){
  const p = screenPosPxFromEntity(el);
  if (!p) return;
  const L = String(label || '').toUpperCase();
  const goodish = (L === 'PERFECT' || L === 'GOOD' || L === 'BLOCK' || L.includes('CLEAR') || L.includes('BOSS'));
  const color = (L === 'PERFECT') ? '#facc15'
              : (L === 'GOOD') ? '#22c55e'
              : (L === 'MISS') ? '#f97316'
              : (L === 'BLOCK') ? '#60a5fa'
              : '#38bdf8';

  // burst only at target
  Particles.burstAt(p.x, p.y, { color, good: goodish, count: goodish ? 34 : 18 });
}

function fxScoreJudgeAtEntity(el, ptsText, judgeText, goodFlag){
  const p = screenPosPxFromEntity(el);
  if (!p) return;

  // score pop slightly to the right-top
  if (ptsText !== null && ptsText !== undefined && ptsText !== '') {
    Particles.scorePop(p.x + 34, p.y - 14, ptsText, { judgment: '', good: !!goodFlag });
  }
  // judge sticker slightly to the left-top
  if (judgeText) {
    Particles.scorePop(p.x - 42, p.y - 18, '', { judgment: judgeText, good: !!goodFlag });
  }
}

function fxPerfectSticker(el){
  const p = screenPosPxFromEntity(el);
  if (!p) return;

  // big star confetti (3 bursts)
  Particles.burstAt(p.x, p.y, { color:'#facc15', good:true, count: 42 });
  setTimeout(()=>Particles.burstAt(p.x, p.y, { color:'#22c55e', good:true, count: 34 }), 120);
  setTimeout(()=>Particles.burstAt(p.x, p.y, { color:'#38bdf8', good:true, count: 34 }), 240);

  // sticker judge
  Particles.scorePop(p.x - 46, p.y - 20, '', { judgment:'PERFECT!!', good:true });

  // ting!
  sfxTing();
}

// ---------- Emitters (logs + HUD bridge) ----------
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
function emitCoach(text, mood) { emit('hha:coach', { sessionId, mode:'PlateVR', text: String(text||''), mood: mood || 'neutral', timeFromStartMs: fromStartMs() }); }
function emitJudge(label) { emit('hha:judge', { sessionId, mode:'PlateVR', label: String(label||''), timeFromStartMs: fromStartMs() }); }
function emitScore() {
  emit('hha:score', {
    sessionId, mode:'PlateVR',
    score, combo, comboMax: maxCombo, misses: miss,
    feverPct: Math.round(clamp(fever,0,100)),
    timeLeft: tLeft,
    perfectPlates, perfectStreak,
    balancePct: Math.round(balancePct),
    shieldOn: shieldOn ? 1 : 0,
    bossOn: bossOn ? 1 : 0,
    groupsHave: Object.values(plateHave).filter(Boolean).length
  });
}
function emitTime() { emit('hha:time', { sessionId, mode:'PlateVR', sec: tLeft, timeFromStartMs: fromStartMs() }); }

// ---------- Grade ----------
function computeGrade() {
  const allGoal = perfectPlates >= goalTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
}

// ---------- Emoji texture ----------
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

// ---------- Spawn / Targets ----------
function makeTargetEntity({ kind, groupId = 0, emoji, scale = 1.0 }) {
  if (!scene || !targetRoot) return null;

  const el = document.createElement('a-entity');
  const id = `pt-${++targetSeq}`;
  el.setAttribute('id', id);
  el.classList.add('plateTarget');
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

  const rangeX = haz.wind ? 1.15 : 0.90;
  const rangeY = haz.wind ? 0.85 : 0.70;

  let x = rnd(-rangeX, rangeX);
  let y = rnd(-rangeY, rangeY);
  if (haz.blackhole) { x *= 0.35; y *= 0.35; }

  const j = rnd(-0.12, 0.12);
  el.setAttribute('position', `${x + j} ${y - j} 0`);

  el.addEventListener('click', () => onHit(el, 'click'));
  return el;
}

function removeTarget(el, reason = 'remove') {
  if (!el) return;
  const id = el.getAttribute('id');
  if (id && activeTargets.has(id)) activeTargets.delete(id);
  try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
  emitGameEvent({ type:'target_remove', reason, targetId: id || '', kind: el.dataset.kind || '' });
}

function expireTarget(el) {
  if (!el) return;
  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  if (kind === 'good') {
    miss += 1;
    combo = 0;
    fever = clamp(fever - 10, 0, 100);
    emitJudge('MISS');
    doMissShake();
    emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
    emitGameEvent({ type:'miss_expire', groupId });
  }

  removeTarget(el, 'expire');
  knowAdaptive();
  emitScore();
}

function isAdaptiveOn() { return MODE === 'play'; }
function knowAdaptive() {
  if (!isAdaptiveOn()) return;
  const base = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;
  let k = 1.0;
  if (combo >= 8) k *= 0.82;
  if (combo >= 12) k *= 0.75;
  if (miss >= 8) k *= 1.12;
  if (tLeft <= 18) k *= 0.82;
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
  const balMult = 0.70 + (bal / 100) * 0.40; // 0.70..1.10
  mult *= balMult;

  if (DIFF === 'hard') mult *= 0.96;
  if (DIFF === 'easy') mult *= 1.04;

  return Math.round(base * mult);
}

function checkPerfectPlate(hitElForFx) {
  const have = plateHaveCount();
  if (have >= 5) {
    perfectPlates += 1;
    perfectStreak += 1;
    bestStreak = Math.max(bestStreak, perfectStreak);

    const bonus = 220 + Math.min(180, perfectStreak * 40);
    score += bonus;

    emitJudge('PERFECT!');
    emitCoach(`PERFECT PLATE! +${bonus} 🌟`, 'happy');
    emitGameEvent({ type:'perfect_plate', perfectPlates, perfectStreak, bonus });

    fever = clamp(fever + 28, 0, 100);

    // PERFECT sticker FX + ting + confetti
    if (hitElForFx) fxPerfectSticker(hitElForFx);

    resetPlate();

    // Plate Rush mini: clear immediately when plate complete and no junk happened
    if (miniCurrent && miniCurrent.key === 'rush') {
      // already satisfied by >=5; handled in updateMiniTick too
    }

    if (miniCurrent && miniCurrent.key === 'perfect') {
      miniCurrent.prog += 1;
      if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
    }
  }
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
  emitCoach(`${key.toUpperCase()}! ระวัง!`, 'sad');
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
const MINI_POOL = [
  // Plate Rush (HARD): 5 groups within 8s AND no junk during rush
  { key:'rush',    label:'Plate Rush: ครบ 5 ภายใน 8 วิ (ห้ามโดนขยะ)', target: 8 },
  { key:'perfect', label:'Perfect Chain: ทำ PERFECT เพิ่มอีก',         target: 1 },
  { key:'clean',   label:'Clean Plate: ห้ามโดนขยะ 10 วินาที',          target: 10 },
  { key:'combo',   label:'Combo Build: ทำคอมโบให้ถึง 8',               target: 8 }
];

let cleanTimer = 0;

function emitQuestUpdate() {
  emit('quest:update', {
    goal: { label:`Perfect Plate ${perfectPlates}/${goalTotal}`, prog: perfectPlates, target: goalTotal },
    mini: miniCurrent
      ? { label: miniCurrent.label, prog: miniCurrent.prog, target: miniCurrent.target }
      : { label: 'Mini: …', prog: 0, target: 1 },
    hint: (miniCurrent && miniCurrent.key === 'rush' && rushActive)
      ? `เหลือ ${rushTimerLeft}s • ห้ามโดนขยะ!`
      : ''
  });
}

function startNextMiniQuest() {
  const def = pick(MINI_POOL);
  miniHistory += 1;

  miniCurrent = {
    key: def.key,
    label: def.label,
    target: def.target,
    prog: 0,
    startedAt: performance.now(),
    done: false
  };

  if (miniCurrent.key === 'clean') {
    cleanTimer = def.target;
  }

  if (miniCurrent.key === 'rush') {
    rushActive = true;
    rushTimerLeft = def.target; // 8
    rushNoJunk = true;
    resetPlate();
  } else {
    rushActive = false;
    stopRushWarning();
  }

  emitGameEvent({ type:'mini_start', miniKey: miniCurrent.key, miniHistory });
  emitCoach(`Mini Quest เริ่ม! ${miniCurrent.label} 🎯`, 'happy');

  emitQuestUpdate();
  emitScore();
}

function clearMiniQuest() {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  miniCleared += 1;

  // stop rush FX if it was rush
  if (miniCurrent.key === 'rush') {
    rushActive = false;
    stopRushWarning();
  }

  emitGameEvent({ type:'mini_clear', miniKey: miniCurrent.key, miniCleared });
  emitCoach('Mini Quest CLEAR! ✅ ต่อไปมาเลย!', 'happy');
  emitJudge('MISSION CLEAR!');
  Particles.scorePop(window.innerWidth/2, window.innerHeight*0.40, '✅ MINI CLEAR +150', { judgment:'MINI', good:true });
  score += 150;

  setTimeout(() => { if (!ended) startNextMiniQuest(); }, 520);

  emitQuestUpdate();
  emitScore();
}

function updateMiniTick() {
  if (!miniCurrent || miniCurrent.done) return;

  if (miniCurrent.key === 'rush') {
    miniCurrent.prog = plateHaveCount();
    // success condition: completed 5 within time and no junk touched during rush
    if (rushActive && rushTimerLeft > 0 && miniCurrent.prog >= 5 && rushNoJunk) {
      clearMiniQuest();
      return;
    }
  }

  if (miniCurrent.key === 'perfect') {
    // progress increased on perfect plate
  }

  if (miniCurrent.key === 'combo') {
    miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }

  if (miniCurrent.key === 'clean') {
    miniCurrent.prog = clamp((miniCurrent.target - cleanTimer), 0, miniCurrent.target);
    if (cleanTimer <= 0) clearMiniQuest();
  }

  emitQuestUpdate();
}

// ---------- Boss ----------
function maybeStartBoss() {
  if (bossOn) return;
  if (tLeft > Math.min(26, Math.floor(TIME * 0.35))) return;
  if (Math.random() < 0.16) {
    bossOn = true;
    bossHP = 3 + (DIFF === 'hard' ? 2 : 1);
    emitCoach(`บอสมาถึง! กด ⭐ ให้ครบ ${bossHP} ครั้ง!`, 'sad');
    emitGameEvent({ type:'boss_on', hp: bossHP });
    spawnOne({ forceBoss: true });
  }
}

// ---------- Spawn ----------
function pickSpawnKind() {
  const DCFG0 = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;
  const endBoost = (tLeft <= 18) ? 0.05 : 0.0;
  const r = Math.random();

  const hazRate = DCFG0.hazRate + endBoost;
  const powRate = DCFG0.powerRate;

  if (r < hazRate) return 'haz';
  if (r < hazRate + powRate) return 'power';
  if (r < hazRate + powRate + DCFG0.junkRate) return 'junk';
  return 'good';
}

function spawnOne(opts = {}) {
  const DCFG0 = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;
  if (!targetRoot) return;
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
    meta = { kind:'haz', groupId: 0, emoji: h.emoji, scale: scl * 0.95 };
  } else if (kind === 'boss') {
    meta = { kind:'boss', groupId: 0, emoji: '⭐', scale: scl * 1.05 };
  }

  const el = makeTargetEntity(meta);
  if (!el) return;

  targetRoot.appendChild(el);

  const id = el.getAttribute('id');
  activeTargets.set(id, {
    id, el,
    kind: el.dataset.kind,
    groupId: parseInt(el.dataset.groupId || '0', 10) || 0,
    spawnAt: performance.now(),
    expireAt: performance.now() + lifeMs,
    lifeMs
  });

  emitGameEvent({ type:'spawn', kind: el.dataset.kind, groupId: meta.groupId || 0, targetId: id });

  setTimeout(() => {
    if (ended) return;
    const rec = activeTargets.get(id);
    if (!rec) return;
    expireTarget(rec.el);
  }, lifeMs);
}

function spawnLoopStart() {
  knowAdaptive();
  if (spawnTimer) clearInterval(spawnTimer);

  const loop = () => {
    if (ended) return;
    maybeStartBoss();
    spawnOne();

    knowAdaptive();
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(loop, currentSpawnInterval);
  };

  spawnTimer = setInterval(loop, currentSpawnInterval);
}

// ---------- Hit ----------
function onHit(el, via = 'click') {
  if (!el || ended) return;
  if (el.dataset.hit === '1') return;
  el.dataset.hit = '1';

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  // FX burst at target (one place only)
  fxBurstAtEntity(el, kind === 'good' ? 'GOOD' : kind === 'junk' ? 'MISS' : 'HIT');

  removeTarget(el, 'hit');
  if (!started) return;

  // hazards
  if (kind === 'haz') {
    const hk = pick(Object.keys(HAZ));
    enableHaz(hk, HAZ[hk].durMs);
    combo = Math.max(0, combo - 1);
    const pts = scoreForHit('haz', 0);
    score += pts;
    emitJudge('RISK!');
    fxScoreJudgeAtEntity(el, `+${pts}`, 'RISK!', true);
    emitGameEvent({ type:'haz_hit', haz: hk });
    updateMiniTick(); emitScore();
    return;
  }

  // power
  if (kind === 'power') {
    const em = el.dataset.emoji || '';
    if (em === POWER.shield.emoji) {
      enableShield(POWER.shield.durMs);
      const pts = scoreForHit('power', 0);
      score += pts;
      fever = clamp(fever + 10, 0, 100);
      emitJudge('SHIELD!');
      fxScoreJudgeAtEntity(el, `+${pts}`, 'SHIELD!', true);
      emitGameEvent({ type:'power_shield' });
    } else if (em === POWER.cleanse.emoji) {
      for (const [, tr] of Array.from(activeTargets.entries())) {
        if (tr && tr.el && tr.el.dataset.kind === 'junk') removeTarget(tr.el, 'cleanse');
      }
      balancePct = clamp(balancePct + 22, 0, 100);
      score += 240;
      emitJudge('CLEANSE!');
      fxScoreJudgeAtEntity(el, '+240', 'CLEANSE!', true);
      emitCoach('ล้างจานแล้ว! ขยะหายไป 💨', 'happy');
      emitGameEvent({ type:'power_cleanse' });
    } else if (em === POWER.golden.emoji) {
      score += 320;
      fever = clamp(fever + 22, 0, 100);
      if (fever >= 100) activateFever(5200);
      emitJudge('GOLD!');
      fxScoreJudgeAtEntity(el, '+320', 'GOLD!', true);
      emitCoach('Golden Bite! คะแนนพุ่ง ⭐', 'happy');
      emitGameEvent({ type:'power_golden' });
    } else {
      const pts = scoreForHit('power', 0);
      score += pts;
      emitJudge('POWER!');
      fxScoreJudgeAtEntity(el, `+${pts}`, 'POWER!', true);
    }

    combo += 1; maxCombo = Math.max(maxCombo, combo);
    updateMiniTick(); emitScore();
    return;
  }

  // boss
  if (kind === 'boss') {
    bossHP -= 1;
    const pts = scoreForHit('boss', 0);
    score += pts;
    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 12, 0, 100);

    emitJudge('BOSS HIT!');
    fxScoreJudgeAtEntity(el, `+${pts}`, 'BOSS!', true);
    emitGameEvent({ type:'boss_hit', hpLeft: bossHP });

    if (bossHP <= 0) {
      bossOn = false;
      const bonus = 420 + (DIFF === 'hard' ? 140 : 60);
      score += bonus;
      emitCoach(`โค่นบอสแล้ว! +${bonus} 🏆`, 'happy');
      emitJudge('BOSS CLEAR!');
      Particles.scorePop(window.innerWidth/2, window.innerHeight*0.40, `🏆 +${bonus}`, { judgment:'BOSS CLEAR!', good:true });
      emitGameEvent({ type:'boss_clear', bonus });
    } else {
      setTimeout(() => { if (!ended && bossOn) spawnOne({ forceBoss: true }); }, 260);
    }

    updateMiniTick(); emitScore();
    return;
  }

  // junk / good
  if (kind === 'junk') {
    // Plate Rush harder: fail if junk touched during rush
    if (miniCurrent && miniCurrent.key === 'rush' && rushActive) {
      stopRushWarning();
      rushNoJunk = false;
      emitJudge('FAILED!');
      doMissShake();
      Particles.scorePop(window.innerWidth/2, window.innerHeight*0.44, '❌ FAILED', { judgment:'RUSH FAIL', good:false });

      resetPlate();
      rushTimerLeft = miniCurrent.target; // 8
      rushNoJunk = true;
      miniCurrent.prog = 0;
      emitQuestUpdate();
    }

    if (shieldOn) {
      score += 30;
      fever = clamp(fever + 4, 0, 100);
      emitJudge('BLOCK!');
      fxScoreJudgeAtEntity(el, '+30', 'BLOCK!', true);
      emitCoach('โล่กันขยะไว้ได้! 🥗', 'happy');
      emitGameEvent({ type:'junk_blocked' });
      combo += 1; maxCombo = Math.max(maxCombo, combo);
    } else {
      miss += 1;
      combo = 0;
      perfectStreak = 0;
      balancePct = clamp(balancePct - 18, 0, 100);
      fever = clamp(fever - 12, 0, 100);

      emitJudge('MISS');
      doMissShake();
      fxScoreJudgeAtEntity(el, '💥', 'MISS!!', false);
      emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
      emitCoach('โดนขยะแล้ว! เลี่ยงให้ได้ 😵', 'sad');
      emitGameEvent({ type:'junk_hit_miss' });

      if (miniCurrent && miniCurrent.key === 'clean') cleanTimer = miniCurrent.target;
    }
  }

  if (kind === 'good') {
    const pts = scoreForHit('good', groupId);
    score += pts;
    combo += 1; maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 7, 0, 100);

    registerGroupHit(groupId);
    updateBalance('good', groupId);

    const judge = (pts >= 110) ? 'PERFECT' : 'GOOD';
    emitJudge(judge);
    fxScoreJudgeAtEntity(el, `+${pts}`, judge + '!', true);
    emitGameEvent({ type:'good_hit', groupId, points: pts });

    if (fever >= 100) activateFever(5200);

    // check plate completion (pass el for FX)
    checkPerfectPlate(el);
  }

  updateMiniTick();
  emitScore();
  emitGameEvent({ type:'hit', kind, groupId, via });

  knowAdaptive();
}

// ---------- Tick (1s) ----------
function tick1s() {
  if (ended) return;

  tLeft -= 1;
  if (tLeft < 0) tLeft = 0;

  // Plate Rush (HARD) timer + warning
  if (miniCurrent && miniCurrent.key === 'rush' && rushActive && !miniCurrent.done) {
    rushTimerLeft = Math.max(0, rushTimerLeft - 1);
    miniCurrent.prog = plateHaveCount();

    if (rushTimerLeft > 0 && rushTimerLeft <= 3) {
      startRushWarning();
      rushTickBeep();
      emitJudge('HURRY!');
    } else {
      stopRushWarning();
    }

    if (rushTimerLeft <= 0) {
      stopRushWarning();
      emitJudge('TOO SLOW!');
      emitCoach('ช้าไปนิด! รีเซ็ต Plate Rush ใหม่ 🔁', 'sad');

      resetPlate();
      rushTimerLeft = miniCurrent.target; // 8
      rushNoJunk = true;
      miniCurrent.prog = 0;

      emitQuestUpdate();
    }
  } else {
    stopRushWarning();
  }

  // Clean mini countdown
  if (miniCurrent && miniCurrent.key === 'clean' && !miniCurrent.done) {
    cleanTimer = Math.max(0, cleanTimer - 1);
    if (cleanTimer <= 0) {
      miniCurrent.prog = miniCurrent.target;
      clearMiniQuest();
    }
  }

  updateFeverTick();
  updateShieldTick();
  updateHazTick();

  emitTime();
  updateMiniTick();
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

// ---------- End ----------
function clearAllTargets() {
  for (const [, rec] of Array.from(activeTargets.entries())) {
    if (rec && rec.el) {
      try { rec.el.parentNode && rec.el.parentNode.removeChild(rec.el); } catch {}
    }
  }
  activeTargets.clear();
}

function startGame() {
  if (started || ended) return;
  started = true;

  emitGameEvent({ type:'session_start', sessionStartIso: new Date().toISOString(), durationSec: TIME });
  emitCoach(
    MODE === 'research'
      ? 'โหมดวิจัย: เล่นตามธรรมชาติ เก็บอาหารครบหมู่ให้มากที่สุด 📊'
      : (DIFF === 'hard'
        ? 'HARD! ระวังขยะ + เจอบอสช่วงท้ายด้วย 😈'
        : 'เป้าหมาย: ทำ PERFECT PLATE ให้ได้! พร้อมลุย 🍽️'),
    'neutral'
  );

  tLeft = TIME;
  score = 0; combo = 0; maxCombo = 0; miss = 0;
  fever = 0; feverActive = false; feverUntilMs = 0;
  perfectPlates = 0; perfectStreak = 0; bestStreak = 0;
  balancePct = 100;
  resetPlate();
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };
  shieldOn = false; shieldUntil = 0;
  haz = { wind:false, blackhole:false, freeze:false };
  bossOn = false; bossHP = 0;

  miniCleared = 0; miniHistory = 0; miniCurrent = null;
  cleanTimer = 0;
  rushActive = false; rushTimerLeft = 0; rushNoJunk = true;
  stopRushWarning();

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
  stopRushWarning();
  clearAllTargets();

  emitGameEvent({ type:'session_end', reason, score, miss, maxCombo, perfectPlates, grade: computeGrade() });

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
    timeFromStartMs: fromStartMs()
  });

  emitCoach('จบเกมแล้ว! ดูสรุปผลได้เลย 🎉', 'happy');
}

// ---------- Controls ----------
function ensureTouchLookControls() {
  if (!cam) return;
  try { cam.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; pointerLockEnabled:false'); } catch {}
  try { cam.setAttribute('wasd-controls-enabled', 'false'); } catch {}
}

function bindUI() {
  // (optional) if your old html had these ids
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
  if (!scene || !THREE) return;
  if (ROOT.__PLATE_POINTER_BOUND__) return;
  ROOT.__PLATE_POINTER_BOUND__ = true;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function doRaycastFromEvent(ev) {
    if (ended) return;
    if (!scene.camera) return;

    const canvas = scene.canvas;
    if (!canvas) return;

    const t = ev.target;
    if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;

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

  ROOT.addEventListener('click', doRaycastFromEvent, { passive: true });
  ROOT.addEventListener('touchstart', doRaycastFromEvent, { passive: true });

  console.log('[PlateVR] manual raycast pointer bound ✅');
}

// ---------- Boot ----------
function applyBootOptions(opts){
  opts = opts || {};
  if (opts.diff) DIFF = String(opts.diff).toLowerCase();
  if (opts.runMode) MODE = (String(opts.runMode).toLowerCase() === 'research') ? 'research' : 'play';
  if (typeof opts.durationSec === 'number') TIME = Math.max(20, Math.min(180, opts.durationSec|0));

  // sync globals
  ROOT.DIFF = DIFF; ROOT.TIME = TIME; ROOT.MODE = MODE;
  tLeft = TIME;
}

export function bootPlateDOM(opts = {}) {
  if (ROOT.__PLATE_DOM_BOOTED__) return;
  ROOT.__PLATE_DOM_BOOTED__ = true;

  if (!A || !THREE) {
    console.error('[PlateVR] AFRAME/THREE missing');
    return;
  }

  applyBootOptions(opts);

  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    try { emitCoach('หา targetRoot ไม่เจอ! ตรวจ ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad'); } catch {}
    return;
  }

  ensureTouchLookControls();
  bindUI();

  const bindAfterLoaded = () => bindPointerFallback();
  if (scene && scene.hasLoaded) bindAfterLoaded();
  else if (scene) scene.addEventListener('loaded', bindAfterLoaded, { once: true });

  if (scene && scene.hasLoaded) startGame();
  else if (scene) scene.addEventListener('loaded', () => startGame(), { once:true });
  else setTimeout(() => startGame(), 250);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended) endGame('tab_hidden');
  });
}

// auto boot (safe)
ROOT.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});
