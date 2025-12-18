// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Full Engine (Emoji targets via <a-assets>)
// FIX 2025-12-18c:
// - ✅ Robust pointer hit: click/touch on canvas → read raycaster intersection → call onHit()
// - ✅ Simple in-file FX layer (score pop + burst)
// - keep export bootPlateDOM

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
function setBarPct(id, pct) {
  const el = $(id);
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = `${p}%`;
}

// ---------- A-Frame guards ----------
const A = window.AFRAME;
if (!A) console.error('[PlateVR] AFRAME not found');

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.88, lifeMs: 2200, junkRate: 0.12, powerRate: 0.10, hazRate: 0.08 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.78, lifeMs: 1950, junkRate: 0.18, powerRate: 0.10, hazRate: 0.10 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.70, lifeMs: 1750, junkRate: 0.24, powerRate: 0.11, hazRate: 0.12 }
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
  cleanse:{ key:'cleanse',emoji:'🍋', label:'CLEANSE',      durMs: 0 },
  golden: { key:'golden', emoji:'⭐',  label:'GOLDEN BITE',  durMs: 0 }
};

// ---------- Hazards ----------
const HAZ = {
  wind:     { key:'wind',     emoji:'🌪️', label:'WIND GUST',  durMs: 3800 },
  blackhole:{ key:'blackhole',emoji:'🕳️', label:'BLACK HOLE', durMs: 4200 },
  freeze:   { key:'freeze',   emoji:'🧊', label:'FREEZE RISK', durMs: 3600 }
};

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');
const cursorEl = document.getElementById('cursor'); // <a-cursor id="cursor">

// ---------- Session ----------
const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

let started = false;
let ended = false;

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

let currentSpawnInterval = DCFG0.spawnInterval;

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; }
function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }

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

// ---------- HUD direct update ----------
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

  setText('hudGoalLine', `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${perfectPlates}/${goalTotal})`);
  setText('hudMiniLine', miniCurrent ? `Mini: ${miniCurrent.label} • ${miniCurrent.prog}/${miniCurrent.target}` : 'Mini: …');
}

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

// =========================================================
// ✅ FX layer (ให้รู้สึกว่าตีโดนจริง)
// =========================================================
function ensureFXLayer() {
  let layer = document.querySelector('.plate-fx-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'plate-fx-layer';
  Object.assign(layer.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'9999'
  });
  document.body.appendChild(layer);
  return layer;
}
function fxPop(text, xPct = 50, yPct = 50, big = false) {
  const layer = ensureFXLayer();
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position:'absolute',
    left:`${xPct}%`,
    top:`${yPct}%`,
    transform:'translate(-50%,-50%)',
    fontSize: big ? '42px' : '28px',
    fontWeight:'800',
    textShadow:'0 8px 22px rgba(0,0,0,0.55)',
    opacity:'0',
    willChange:'transform,opacity'
  });
  layer.appendChild(el);

  // animate
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 90ms ease, transform 520ms ease';
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-55%) scale(1.0)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-85%) scale(0.95)';
      setTimeout(() => { try { el.remove(); } catch(_){} }, 260);
    }, 260);
  });
}
function fxBurst(emoji = '✨', xPct = 50, yPct = 50) {
  const layer = ensureFXLayer();
  for (let i=0;i<10;i++) {
    const s = document.createElement('div');
    s.textContent = emoji;
    Object.assign(s.style, {
      position:'absolute',
      left:`${xPct}%`,
      top:`${yPct}%`,
      transform:'translate(-50%,-50%)',
      fontSize:'22px',
      opacity:'1',
      willChange:'transform,opacity'
    });
    layer.appendChild(s);
    const dx = rnd(-120,120);
    const dy = rnd(-140,70);
    requestAnimationFrame(() => {
      s.style.transition = 'transform 520ms ease, opacity 520ms ease';
      s.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      s.style.opacity = '0';
      setTimeout(() => { try { s.remove(); } catch(_){} }, 560);
    });
  }
}

// =========================================================
// ✅ Emoji as Asset (แก้สี่เหลี่ยมให้เป็น emoji จริง)
// =========================================================
function ensureAssetsRoot() {
  if (!scene) return null;
  let assets = scene.querySelector('a-assets');
  if (!assets) {
    assets = document.createElement('a-assets');
    assets.setAttribute('timeout', '10000');
    scene.appendChild(assets);
  }
  return assets;
}
function makeEmojiDataUrl(emoji, opts = {}) {
  const size = opts.size || 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15,23,42,0.70)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.stroke();

  ctx.font = (opts.font || '180px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(emoji), size / 2, size / 2 + 8);

  return canvas.toDataURL('image/png');
}
function createEmojiAsset(assetId, emoji) {
  const assets = ensureAssetsRoot();
  if (!assets) return null;

  let img = document.getElementById(assetId);
  if (!img) {
    img = document.createElement('img');
    img.setAttribute('id', assetId);
    img.setAttribute('crossorigin', 'anonymous');
    assets.appendChild(img);
  }
  img.src = makeEmojiDataUrl(emoji);
  return img;
}

// ---------- Targets ----------
function makeTargetEntity({ kind, groupId = 0, emoji, scale = 1.0, extraKey = '' }) {
  if (!scene || !targetRoot) return null;

  const el = document.createElement('a-entity');
  const id = `pt-${++targetSeq}`;
  el.setAttribute('id', id);
  el.classList.add('plateTarget'); // สำคัญต่อ raycaster selector

  el.dataset.kind = kind;
  el.dataset.groupId = String(groupId || 0);
  el.dataset.emoji = String(emoji || '');
  el.dataset.extraKey = String(extraKey || '');
  el.dataset.spawnMs = String(fromStartMs());

  const assetId = `emojiTex-${id}`;
  createEmojiAsset(assetId, emoji);

  el.setAttribute('geometry', 'primitive: plane; width: 0.58; height: 0.58');
  el.setAttribute('material', {
    shader: 'flat',
    transparent: true,
    opacity: 0.98,
    side: 'double',
    src: `#${assetId}`
  });

  const s = clamp(scale, 0.45, 1.35);
  el.setAttribute('scale', `${s} ${s} ${s}`);

  // ✅ กระจายตำแหน่ง (อย่าให้กองกลาง)
  const rangeX = haz.wind ? 1.35 : 1.05;
  const rangeY = haz.wind ? 1.00 : 0.80;

  let x = rnd(-rangeX, rangeX);
  let y = rnd(-rangeY, rangeY);

  // กันเกิดใกล้ศูนย์เกินไป (ทำให้ดูเหมือนขึ้นกลางที่เดียว)
  if (Math.abs(x) < 0.18) x += (x >= 0 ? 0.22 : -0.22);
  if (Math.abs(y) < 0.14) y += (y >= 0 ? 0.18 : -0.18);

  if (haz.blackhole) { x *= 0.32; y *= 0.32; }

  el.setAttribute('position', `${x} ${y} 0`);

  // float animation
  const fx = haz.wind ? 0.18 : 0.11;
  const fy = haz.wind ? 0.12 : 0.09;
  const toX = x + rnd(-fx, fx);
  const toY = y + rnd(-fy, fy);
  const dur = haz.freeze ? 1200 : 860;
  el.setAttribute('animation__float',
    `property: position; dir: alternate; dur: ${dur}; easing: easeInOutSine; loop: true; to: ${toX} ${toY} 0`
  );

  // event (ปกติ)
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
    emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
    emitGameEvent({ type:'miss_expire', groupId });
  }

  removeTarget(el, 'expire');
  knowAdaptive();
  hudUpdateAll();
  emitScore();
}

function knowAdaptive() {
  if (!isAdaptiveOn()) return;
  const base = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;
  let k = 1.0;
  if (combo >= 8)  k *= 0.82;
  if (combo >= 12) k *= 0.75;
  if (miss >= 8)   k *= 1.12;
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

function checkPerfectPlate() {
  if (plateHaveCount() >= 5) {
    perfectPlates += 1;
    perfectStreak += 1;
    bestStreak = Math.max(bestStreak, perfectStreak);

    const bonus = 220 + Math.min(180, perfectStreak * 40);
    score += bonus;
    emitJudge('PERFECT!');
    emitCoach(`PERFECT PLATE! +${bonus} 🌟`, 'happy');
    emitGameEvent({ type:'perfect_plate', perfectPlates, perfectStreak, bonus });

    fxPop('PERFECT!', 50, 48, true);
    fxBurst('✨', 50, 52);

    fever = clamp(fever + 28, 0, 100);
    if (fever >= 100) activateFever(5200);

    resetPlate();

    if (miniCurrent && miniCurrent.key === 'perfect') {
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

function scoreForHit(kind) {
  let base = 0;
  if (kind === 'good')  base = 85;
  if (kind === 'junk')  base = -50;
  if (kind === 'power') base = 120;
  if (kind === 'haz')   base = 90;
  if (kind === 'boss')  base = 140;

  let mult = 1.0;
  if (feverActive) mult += 0.35;

  const bal = clamp(balancePct, 0, 100);
  const balMult = 0.70 + (bal / 100) * 0.40;
  mult *= balMult;

  if (DIFF === 'hard') mult *= 0.96;
  if (DIFF === 'easy') mult *= 1.04;

  return Math.round(base * mult);
}

// ---------- Fever ----------
function activateFever(ms = 5200) {
  feverActive = true;
  feverUntilMs = performance.now() + ms;
  emit('hha:fever', { sessionId, mode:'PlateVR', on: 1, value: 100, timeFromStartMs: fromStartMs() });
  emitCoach('FEVER ON! คะแนนคูณแรงขึ้น 🔥', 'fever');
  emitGameEvent({ type:'fever_on', durMs: ms });
  fxPop('FEVER!', 50, 58, true);
  fxBurst('🔥', 50, 62);
}
function updateFeverTick() {
  if (!feverActive) fever = clamp(fever - 0.9, 0, 100);
  else {
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
  fxPop('SHIELD!', 50, 58, true);
  fxBurst('🥗', 50, 62);
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
  if (!haz[key]) {
    haz[key] = true;
    emitCoach(`${HAZ[key].label}! ระวัง!`, 'sad');
    emitGameEvent({ type:'haz_on', haz: key, durMs: ms });
    fxPop(HAZ[key].emoji, 50, 54, true);
  }
  hazUntil[key] = performance.now() + ms;
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
  { key:'rush',    label:'Plate Rush: เก็บหมู่ให้ครบ 5 ภายในเร็ว ๆ', target: 1 },
  { key:'perfect', label:'Perfect Chain: ทำ PERFECT เพิ่มอีก',        target: 1 },
  { key:'clean',   label:'Clean Plate: ห้ามโดนขยะ 10 วิ',            target: 10 },
  { key:'combo',   label:'Combo Build: ทำคอมโบให้ถึง 8',             target: 8 }
];
let cleanTimer = 0;

function startNextMiniQuest() {
  const def = pick(MINI_POOL);
  miniHistory += 1;
  miniCurrent = { key: def.key, label: def.label, target: def.target, prog: 0, done: false };
  if (miniCurrent.key === 'clean') cleanTimer = def.target;

  emit('quest:update', {
    goal: { label:`Perfect Plate ${perfectPlates}/${goalTotal}`, prog: perfectPlates, target: goalTotal },
    mini: { label: miniCurrent.label, prog: miniCurrent.prog, target: miniCurrent.target },
    goalsAll: Array.from({length:goalTotal}).map((_,i)=>({done: i < perfectPlates})),
    minisAll: Array.from({length:miniCleared+1}).map((_,i)=>({done: i < miniCleared}))
  });

  emitGameEvent({ type:'mini_start', miniKey: miniCurrent.key, miniHistory });
  emitCoach(`Mini Quest เริ่ม! ${miniCurrent.label} 🎯`, 'happy');
  hudUpdateAll();
}
function clearMiniQuest() {
  if (!miniCurrent || miniCurrent.done) return;
  miniCurrent.done = true;
  miniCleared += 1;

  emitGameEvent({ type:'mini_clear', miniKey: miniCurrent.key, miniCleared });
  emitCoach('Mini Quest CLEAR! ✅ ต่อไปมาเลย!', 'happy');
  emitJudge('MISSION CLEAR!');
  fxPop('MISSION CLEAR!', 50, 45, true);
  fxBurst('🎉', 50, 50);

  setTimeout(() => { if (!ended) startNextMiniQuest(); }, 500);
  hudUpdateAll();
}
function updateMiniTick() {
  if (!miniCurrent || miniCurrent.done) return;

  if (miniCurrent.key === 'rush') {
    miniCurrent.prog = (plateHaveCount() >= 5) ? 1 : 0;
    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }
  if (miniCurrent.key === 'combo') {
    miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }
  if (miniCurrent.key === 'clean') {
    miniCurrent.prog = clamp((miniCurrent.target - cleanTimer), 0, miniCurrent.target);
    if (cleanTimer <= 0) clearMiniQuest();
  }

  emit('quest:update', {
    goal: { label:`Perfect Plate ${perfectPlates}/${goalTotal}`, prog: perfectPlates, target: goalTotal },
    mini: { label: miniCurrent.label, prog: miniCurrent.prog, target: miniCurrent.target },
    goalsAll: Array.from({length:goalTotal}).map((_,i)=>({done: i < perfectPlates})),
    minisAll: Array.from({length:miniCleared+1}).map((_,i)=>({done: i < miniCleared}))
  });

  hudUpdateAll();
}

// ---------- Boss mode ----------
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
  if (!targetRoot) return;
  if (activeTargets.size >= DCFG0.maxActive) return;

  const kind = opts.forceBoss ? 'boss' : pickSpawnKind();
  const scl  = DCFG0.scale * (haz.freeze ? 0.92 : 1.0);
  const lifeMs = DCFG0.lifeMs + (haz.freeze ? 350 : 0);

  let meta = null;

  if (kind === 'good') {
    const key = pick(GROUP_KEYS);
    const g = POOL[key];
    meta = { kind:'good', groupId: g.id, emoji: pick(g.emojis), scale: scl, extraKey: key };
  } else if (kind === 'junk') {
    meta = { kind:'junk', groupId: 0, emoji: pick(POOL.junk.emojis), scale: scl * 0.98, extraKey: 'junk' };
  } else if (kind === 'power') {
    const pk = pick(Object.keys(POWER));
    const p = POWER[pk];
    meta = { kind:'power', groupId: 0, emoji: p.emoji, scale: scl * 0.95, extraKey: pk };
  } else if (kind === 'haz') {
    const hk = pick(Object.keys(HAZ));
    const h = HAZ[hk];
    meta = { kind:'haz', groupId: 0, emoji: h.emoji, scale: scl * 0.95, extraKey: hk };
  } else {
    meta = { kind:'boss', groupId: 0, emoji: '⭐', scale: scl * 1.05, extraKey: 'boss' };
  }

  const el = makeTargetEntity(meta);
  if (!el) return;

  targetRoot.appendChild(el);

  const id = el.getAttribute('id');
  activeTargets.set(id, { id, el, expireAt: performance.now() + lifeMs });

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

  spawnTimer = setInterval(() => {
    if (ended) return;
    maybeStartBoss();
    spawnOne();
    knowAdaptive();

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnLoopStart();
    }
  }, currentSpawnInterval);
}

// =========================================================
// ✅ Robust click/touch hit (สำคัญสุดของบั๊กนี้)
// =========================================================
function getCursorHitEntity() {
  // 1) ใช้ raycaster ของ cursor (ดีที่สุด)
  if (cursorEl && cursorEl.components && cursorEl.components.raycaster) {
    const inter = cursorEl.components.raycaster.intersections;
    if (inter && inter.length) {
      const obj = inter[0].object;
      if (obj && obj.el) return obj.el;
    }
  }

  // 2) fallback: raycaster ของ camera (บางเคส)
  if (cam && cam.components && cam.components.raycaster) {
    const inter = cam.components.raycaster.intersections;
    if (inter && inter.length) {
      const obj = inter[0].object;
      if (obj && obj.el) return obj.el;
    }
  }

  return null;
}

function bindPointerFallback() {
  if (!scene) return;

  const handler = (e) => {
    if (ended) return;

    // ✅ รับเฉพาะคลิก/แตะบน CANVAS (กันกดปุ่ม HUD แล้วไปโดนเป้า)
    const t = e && e.target;
    if (!t || String(t.tagName).toUpperCase() !== 'CANVAS') return;

    const hitEl = getCursorHitEntity();
    if (!hitEl) return;
    if (!hitEl.classList || !hitEl.classList.contains('plateTarget')) return;

    // เรียก onHit ตรง ๆ (ไม่ง้อ event click)
    onHit(hitEl, 'pointer');
  };

  // bind แค่ครั้งเดียว
  if (window.__PLATE_POINTER_BOUND__) return;
  window.__PLATE_POINTER_BOUND__ = true;

  window.addEventListener('click', handler, { passive:true });
  window.addEventListener('touchstart', handler, { passive:true });

  console.log('[PlateVR] pointer fallback bound ✅');
}

// ---------- Hit handling ----------
function onHit(el, via = 'click') {
  if (!el || ended) return;
  if (el.dataset.hit === '1') return;
  el.dataset.hit = '1';

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;
  const extraKey = el.dataset.extraKey || '';
  const emoji = el.dataset.emoji || '✨';

  removeTarget(el, 'hit');
  if (!started) return;

  // show immediate feedback always
  fxBurst(emoji, 50, 55);

  // hazard
  if (kind === 'haz') {
    const hk = extraKey && HAZ[extraKey] ? extraKey : pick(Object.keys(HAZ));
    enableHaz(hk, HAZ[hk].durMs);
    combo = Math.max(0, combo - 1);
    score += scoreForHit('haz');
    emitJudge('RISK!');
    fxPop('RISK!', 50, 45, true);
    hudUpdateAll(); emitScore();
    return;
  }

  // power
  if (kind === 'power') {
    const pk = extraKey && POWER[extraKey] ? extraKey : null;

    if (pk === 'shield') {
      enableShield(POWER.shield.durMs);
      score += scoreForHit('power');
      fever = clamp(fever + 10, 0, 100);
      emitJudge('SHIELD!');
      fxPop('SHIELD!', 50, 45, true);
    } else if (pk === 'cleanse') {
      for (const [tid, tr] of Array.from(activeTargets.entries())) {
        if (tr && tr.el && tr.el.dataset.kind === 'junk') removeTarget(tr.el, 'cleanse');
      }
      balancePct = clamp(balancePct + 22, 0, 100);
      score += 240;
      emitJudge('CLEANSE!');
      fxPop('CLEANSE!', 50, 45, true);
      emitCoach('ล้างจานแล้ว! ขยะหายไป 💨', 'happy');
    } else if (pk === 'golden') {
      score += 320;
      fever = clamp(fever + 22, 0, 100);
      if (fever >= 100) activateFever(5200);
      emitJudge('GOLD!');
      fxPop('GOLD!', 50, 45, true);
      emitCoach('Golden Bite! คะแนนพุ่ง ⭐', 'happy');
    } else {
      score += scoreForHit('power');
      emitJudge('POWER!');
      fxPop('POWER!', 50, 45, true);
    }

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  // boss
  if (kind === 'boss') {
    bossHP -= 1;
    score += scoreForHit('boss');
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 12, 0, 100);

    emitJudge('BOSS HIT!');
    fxPop('BOSS HIT!', 50, 45, true);

    if (bossHP <= 0) {
      bossOn = false;
      const bonus = 420 + (DIFF === 'hard' ? 140 : 60);
      score += bonus;
      emitCoach(`โค่นบอสแล้ว! +${bonus} 🏆`, 'happy');
      emitJudge('BOSS CLEAR!');
      fxPop('BOSS CLEAR!', 50, 42, true);
      fxBurst('🏆', 50, 52);
    } else {
      setTimeout(() => { if (!ended && bossOn) spawnOne({ forceBoss: true }); }, 260);
    }

    updateMiniTick();
    hudUpdateAll(); emitScore();
    return;
  }

  // junk / good
  if (kind === 'junk') {
    if (shieldOn) {
      score += 30;
      fever = clamp(fever + 4, 0, 100);
      emitJudge('BLOCK!');
      fxPop('BLOCK!', 50, 45, true);
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
    } else {
      miss += 1;
      combo = 0;
      perfectStreak = 0;
      balancePct = clamp(balancePct - 18, 0, 100);
      fever = clamp(fever - 12, 0, 100);
      emitJudge('MISS');
      fxPop('MISS', 50, 45, true);
      emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
      emitCoach('โดนขยะแล้ว! เลี่ยงให้ได้ 😵', 'sad');

      if (miniCurrent && miniCurrent.key === 'clean') cleanTimer = miniCurrent.target;
    }
  } else if (kind === 'good') {
    const pts = scoreForHit('good');
    score += pts;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 7, 0, 100);

    registerGroupHit(groupId);
    updateBalance('good', groupId);

    emitJudge(pts >= 110 ? 'PERFECT' : 'GOOD');
    fxPop(pts >= 110 ? 'PERFECT' : 'GOOD', 50, 45, true);

    if (miniCurrent && miniCurrent.key === 'combo') {
      miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    }

    checkPerfectPlate();
    if (fever >= 100) activateFever(5200);
  }

  updateMiniTick();
  hudUpdateAll();
  emitScore();
  emitGameEvent({ type:'hit', kind, groupId, via });

  knowAdaptive();
}

// ---------- Tick loops ----------
function tick1s() {
  if (ended) return;

  tLeft -= 1;
  if (tLeft < 0) tLeft = 0;

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

// ---------- Result modal ----------
function showResultModal(reason) {
  const grade = computeGrade();

  setText('rMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('rGrade', grade);
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

  emitGameEvent({ type:'result_show', reason, grade });
}

// ---------- Start / End ----------
function clearAllTargets() {
  for (const [id, rec] of Array.from(activeTargets.entries())) {
    if (rec && rec.el) {
      try { rec.el.parentNode && rec.el.parentNode.removeChild(rec.el); } catch (_) {}
    }
  }
  activeTargets.clear();
}

function startGame() {
  if (started || ended) return;
  started = true;

  emitGameEvent({ type:'session_start', sessionStartIso, durationSec: TIME });
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
  currentSpawnInterval = DCFG0.spawnInterval;

  hudUpdateAll();
  emitTime();
  emitScore();

  startNextMiniQuest();
  startTimers();
  knowAdaptive();
  spawnLoopStart();

  fxPop('START!', 50, 55, true);
  fxBurst('🍽️', 50, 60);
}

function endGame(reason = 'ended') {
  if (ended) return;
  ended = true;

  stopTimers();
  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = null;
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
    minisCleared: miniCleared,
    minisTotal: Math.max(miniHistory, miniCleared) || 0,
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

  if (!scene) console.warn('[PlateVR] a-scene not found yet (will wait loaded)');
  if (!cam) console.warn('[PlateVR] #cam not found. Check plate-vr.html');
  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    emitCoach('หา targetRoot ไม่เจอ! ตรวจ ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad');
    return;
  }

  ensureAssetsRoot();
  ensureFXLayer();
  ensureTouchLookControls();
  bindUI();

  setText('hudMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('hudDiff', (DIFF === 'easy') ? 'Easy' : (DIFF === 'hard') ? 'Hard' : 'Normal');
  setText('hudTime', tLeft);
  hudUpdateAll();

  // ✅ bind pointer fallback หลัง scene loaded เพื่อให้มี canvas แน่ ๆ
  if (scene && scene.hasLoaded) bindPointerFallback();
  else if (scene) scene.addEventListener('loaded', () => bindPointerFallback(), { once:true });

  const starter = resolvePlateStarter();
  if (!starter) {
    console.error('[PlateVR] No start function found (startGame/start/beginGame).');
    emitCoach('ยังไม่มีฟังก์ชันเริ่มเกมใน plate.safe.js (startGame/beginGame/start) ⚠️', 'sad');
    return;
  }

  if (scene && scene.hasLoaded) starter();
  else if (scene) scene.addEventListener('loaded', () => starter(), { once:true });
  else setTimeout(() => starter(), 250);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended) endGame('tab_hidden');
  });
}

// auto boot
window.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});