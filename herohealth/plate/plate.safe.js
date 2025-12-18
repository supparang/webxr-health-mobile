// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — working full engine (A-Frame targets anchored to #targetRoot)
// - spawn emoji targets (good groups / junk / powerups / hazards)
// - click / gaze fuse works via <a-cursor raycaster="objects:.plateTarget">
// - HUD updates + emit hha:* events + result modal
// - export bootPlateDOM for plate-vr.html
//
// Note: This is ES module (imported by plate-vr.html)

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
function showEl(id, on) { const el = $(id); if (el) el.style.display = on ? '' : 'none'; }

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

let fever = 0;           // 0..100
let feverActive = false; // ON = bonus
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
let bossHP = 0;

let balancePct = 100;
let shieldOn = false;
let shieldUntil = 0;

let haz = { wind:false, blackhole:false, freeze:false };
let hazUntil = { wind:0, blackhole:0, freeze:0 };

let spawnTimer = null;
let activeTargets = new Map();
let targetSeq = 0;

let driftRAF = null;

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function nowIso() { return new Date().toISOString(); }
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

// ---------- HUD direct update (plate-vr.html ids) ----------
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

  // goal + mini lines
  setText('hudGoalLine', `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${perfectPlates}/${goalTotal})`);
  setText('hudMiniLine', miniCurrent ? `Mini: ${miniCurrent.label} • ${miniCurrent.prog}/${miniCurrent.target}` : 'Mini: …');
}

// ---------- Fun & Challenge (1-6 แบบ “เร้าใจ”) ----------
/**
 * 1) Boss Bite: ช่วงท้ายเกมมีบอส ⭐ (ต้องกดหลายครั้ง)
 * 2) Hazards: wind/blackhole/freeze ทำให้ spawn/ตำแหน่ง/เวลาเป้า “กวน”
 * 3) Power-ups: shield/cleanse/golden
 * 4) Plate Balance: ซ้ำหมู่เดิมบ่อย balance ลด (ได้คะแนนน้อยลง)
 * 5) Perfect streak: ทำ perfect ต่อเนื่องได้โบนัส + fever พุ่ง
 * 6) Mini quests แบบวนต่อเนื่อง: เคลียร์แล้วสุ่มอันใหม่ทันทีจนจบเกม
 */

function computeGrade() {
  // โทนเดียวกับที่คุยไว้: เน้น perfect + miss ต่ำ + combo
  const allGoal = perfectPlates >= goalTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
}

// ---------- Emoji texture helper (canvas -> material src) ----------
function makeEmojiTexture(emoji, opts = {}) {
  const size = opts.size || 256;
  const font = opts.font || '180px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0,0,size,size);
  // soft background glow (so it looks “target-like”)
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.44, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(15,23,42,0.65)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.stroke();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
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
  el.classList.add('plateTarget');

  // geometry plane
  el.setAttribute('geometry', 'primitive: plane; width: 0.52; height: 0.52');
  el.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.98');
  el.setAttribute('position', '0 0 0');

  // runtime texture
  const tex = makeEmojiTexture(emoji);
  // attach three.js material once object3D exists
  el.addEventListener('loaded', () => {
    const mesh = el.getObject3D('mesh');
    if (mesh && mesh.material) {
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
    }
  });

  // store meta
  el.dataset.kind = kind;         // 'good' | 'junk' | 'power' | 'haz' | 'boss'
  el.dataset.groupId = String(groupId || 0);
  el.dataset.emoji = String(emoji || '');
  el.dataset.spawnMs = String(fromStartMs());

  // scale
  const s = clamp(scale, 0.45, 1.35);
  el.object3D.scale.set(s, s, s);

  // random pos in front of camera (anchored to targetRoot)
  // x,y range depends on hazard
  const rangeX = haz.wind ? 1.15 : 0.85;
  const rangeY = haz.wind ? 0.85 : 0.65;

  let x = rnd(-rangeX, rangeX);
  let y = rnd(-rangeY, rangeY);

  // blackhole: pull to center
  if (haz.blackhole) {
    x *= 0.35;
    y *= 0.35;
  }

  el.object3D.position.set(x, y, 0);

  // click/gaze fuse: cursor emits click on intersected object
  el.addEventListener('click', () => onHit(el, 'click'));
  el.addEventListener('mouseenter', () => { /* optional */ });

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

  // expire = miss เฉพาะ “good group” (ไม่ใช่ hazard/power) และ “ไม่ใช่ boss”
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
  // adaptive เบา ๆ: ถ้า combo สูง -> spawn เร็วขึ้น / ถ้า miss เยอะ -> ช้าลงนิด
  // (ไม่แตะโหมด research)
  const base = (DIFF_TABLE[DIFF] || DIFF_TABLE.normal).spawnInterval;
  let k = 1.0;
  if (combo >= 8) k *= 0.82;
  if (combo >= 12) k *= 0.75;
  if (miss >= 8) k *= 1.12;
  if (tLeft <= 18) k *= 0.82; // ช่วงท้ายเร่ง
  currentSpawnInterval = clamp(Math.round(base * k), 420, 1600);
}

let currentSpawnInterval = DCFG0.spawnInterval;

// ---------- Plate logic ----------
function resetPlate() {
  plateHave = { 1:false,2:false,3:false,4:false,5:false };
}

function plateHaveCount() {
  return Object.values(plateHave).filter(Boolean).length;
}

function registerGroupHit(groupId) {
  if (groupId >= 1 && groupId <= 5) {
    plateHave[groupId] = true;
    plateCounts[groupId] += 1;
    totalsByGroup[groupId] += 1;
  }
}

function checkPerfectPlate() {
  const have = plateHaveCount();
  if (have >= 5) {
    perfectPlates += 1;
    perfectStreak += 1;
    bestStreak = Math.max(bestStreak, perfectStreak);

    // bonus score + fever boost
    const bonus = 220 + Math.min(180, perfectStreak * 40);
    score += bonus;
    emitJudge('PERFECT!');
    emitCoach(`PERFECT PLATE! +${bonus} 🌟`, 'happy');
    emitGameEvent({ type:'perfect_plate', perfectPlates, perfectStreak, bonus });

    // fever push
    fever = clamp(fever + 28, 0, 100);
    if (fever >= 100) activateFever(5200);

    // reset for next plate
    resetPlate();

    // goal update
    goalCleared = Math.min(goalTotal, perfectPlates);

    // mini progression hook
    if (miniCurrent && miniCurrent.key === 'perfect') {
      miniCurrent.prog += 1;
      if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
    }
  }
}

function updateBalance(kind, groupId) {
  // ซ้ำหมู่เดิมบ่อย balance ลด / ตี junk ลดหนัก
  if (kind === 'junk') {
    balancePct = clamp(balancePct - 18, 0, 100);
    return;
  }
  if (groupId >= 1 && groupId <= 5) {
    // ถ้าเพิ่งตีหมู่เดิมซ้ำ ๆ
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

  // fever bonus
  let mult = 1.0;
  if (feverActive) mult += 0.35;

  // balance scaling (ถ้า balance ต่ำ ได้คะแนนน้อยลง)
  const bal = clamp(balancePct, 0, 100);
  const balMult = 0.70 + (bal / 100) * 0.40; // 0.70..1.10
  mult *= balMult;

  // hard a bit harsher
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
}

function updateFeverTick() {
  // passive decay
  if (!feverActive) {
    fever = clamp(fever - 0.9, 0, 100);
  } else {
    // keep high but decay little
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

// ---------- Mini quests (วนต่อเนื่อง) ----------
const MINI_POOL = [
  { key:'rush',    label:'Plate Rush: เก็บหมู่ให้ครบ 5 ภายในเร็ว ๆ', target: 1 },
  { key:'perfect', label:'Perfect Chain: ทำ PERFECT เพิ่มอีก',        target: 1 },
  { key:'clean',   label:'Clean Plate: ห้ามโดนขยะ 10 วินาที',        target: 10 },
  { key:'combo',   label:'Combo Build: ทำคอมโบให้ถึง 8',            target: 8 }
];

let cleanTimer = 0;

function startNextMiniQuest() {
  const pickable = MINI_POOL.filter(m => true);
  const def = pick(pickable);

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

  // ต่อเนื่องทันที
  setTimeout(() => {
    if (!ended) startNextMiniQuest();
  }, 500);

  hudUpdateAll();
}

function updateMiniTick() {
  if (!miniCurrent || miniCurrent.done) return;

  if (miniCurrent.key === 'rush') {
    // prog = จำนวน perfect ที่ได้ “จากรอบนี้” -> ใช้ plateHaveCount 5 เป็นเงื่อนไข “จบ”
    const have = plateHaveCount();
    miniCurrent.prog = (have >= 5) ? 1 : 0;
    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }

  if (miniCurrent.key === 'combo') {
    miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    if (miniCurrent.prog >= miniCurrent.target) clearMiniQuest();
  }

  if (miniCurrent.key === 'clean') {
    // นับถอยหลังโดยไม่โดน junk (miss จาก junk) — reset เมื่อโดน junk
    // cleanTimer จะลดทุกวินาทีใน tick1s()
    miniCurrent.prog = clamp((miniCurrent.target - cleanTimer), 0, miniCurrent.target);
    if (cleanTimer <= 0) clearMiniQuest();
  }

  // perfect: prog ถูกเพิ่มใน checkPerfectPlate()
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
  if (tLeft > Math.min(26, Math.floor(TIME * 0.35))) return; // ช่วงท้ายเท่านั้น
  // โอกาสเริ่มบอส
  if (Math.random() < 0.16) {
    bossOn = true;
    bossHP = 3 + (DIFF === 'hard' ? 2 : 1);
    emitCoach(`บอสมาถึง! กด ⭐ ให้ครบ ${bossHP} ครั้ง!`, 'sad');
    emitGameEvent({ type:'boss_on', hp: bossHP });
    // spawn boss ทันที
    spawnOne({ forceBoss: true });
  }
}

// ---------- Spawn ----------
function pickSpawnKind() {
  // hazards/powerups ช่วงท้ายเพิ่มความเดือด
  const endBoost = (tLeft <= 18) ? 0.05 : 0.0;

  const r = Math.random();

  // boss forced handled elsewhere
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

  // freeze hazard: slow spawn and increase life (more “กดให้ทัน”)
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

  // attach to targetRoot (anchored to camera)
  targetRoot.appendChild(el);

  const id = el.getAttribute('id');
  activeTargets.set(id, {
    id,
    el,
    kind: el.dataset.kind,
    groupId: parseInt(el.dataset.groupId || '0', 10) || 0,
    spawnAt: performance.now(),
    expireAt: performance.now() + lifeMs,
    lifeMs
  });

  emitGameEvent({ type:'spawn', kind: el.dataset.kind, groupId: meta.groupId || 0, targetId: id });

  // auto expire
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
    // adaptive update each tick
    knowAdaptive();
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnLoopStart();
    }
  }, currentSpawnInterval);
}

// ---------- Hit handling ----------
function onHit(el, via = 'click') {
  if (!el || ended) return;

  // prevent double hit
  if (el.dataset.hit === '1') return;
  el.dataset.hit = '1';

  const kind = el.dataset.kind || '';
  const groupId = parseInt(el.dataset.groupId || '0', 10) || 0;

  const id = el.getAttribute('id');
  const rec = activeTargets.get(id);

  // remove now
  removeTarget(el, 'hit');

  if (!started) return;

  // hazard effects
  if (kind === 'haz') {
    // random hazard activate
    const hk = pick(Object.keys(HAZ));
    enableHaz(hk, HAZ[hk].durMs);
    combo = Math.max(0, combo - 1); // กด hazard = เสียจังหวะนิด
    score += scoreForHit('haz', 0);
    emitJudge('RISK!');
    emitGameEvent({ type:'haz_hit', haz: hk });
    hudUpdateAll();
    emitScore();
    return;
  }

  // powerups
  if (kind === 'power') {
    // decide which power by emoji
    const em = el.dataset.emoji || '';
    if (em === POWER.shield.emoji) {
      enableShield(POWER.shield.durMs);
      score += scoreForHit('power', 0);
      fever = clamp(fever + 10, 0, 100);
      emitJudge('SHIELD!');
      emitGameEvent({ type:'power_shield' });
    } else if (em === POWER.cleanse.emoji) {
      // cleanse: clear all junk targets currently active + restore balance a bit
      for (const [tid, tr] of Array.from(activeTargets.entries())) {
        if (tr && tr.el && tr.el.dataset.kind === 'junk') removeTarget(tr.el, 'cleanse');
      }
      balancePct = clamp(balancePct + 22, 0, 100);
      score += 240;
      emitJudge('CLEANSE!');
      emitCoach('ล้างจานแล้ว! ขยะหายไป 💨', 'happy');
      emitGameEvent({ type:'power_cleanse' });
    } else if (em === POWER.golden.emoji) {
      // golden: big score + fever push
      score += 320;
      fever = clamp(fever + 22, 0, 100);
      if (fever >= 100) activateFever(5200);
      emitJudge('GOLD!');
      emitCoach('Golden Bite! คะแนนพุ่ง ⭐', 'happy');
      emitGameEvent({ type:'power_golden' });
    } else {
      score += scoreForHit('power', 0);
      emitJudge('POWER!');
    }

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);

    updateMiniTick();
    hudUpdateAll();
    emitScore();
    return;
  }

  // boss
  if (kind === 'boss') {
    bossHP -= 1;
    score += scoreForHit('boss', 0);
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 12, 0, 100);

    emitJudge('BOSS HIT!');
    emitGameEvent({ type:'boss_hit', hpLeft: bossHP });

    if (bossHP <= 0) {
      bossOn = false;
      const bonus = 420 + (DIFF === 'hard' ? 140 : 60);
      score += bonus;
      emitCoach(`โค่นบอสแล้ว! +${bonus} 🏆`, 'happy');
      emitJudge('BOSS CLEAR!');
      emitGameEvent({ type:'boss_clear', bonus });
    } else {
      // spawn next boss star quickly
      setTimeout(() => { if (!ended && bossOn) spawnOne({ forceBoss: true }); }, 260);
    }

    updateMiniTick();
    hudUpdateAll();
    emitScore();
    return;
  }

  // junk / good
  if (kind === 'junk') {
    // shield blocks miss
    if (shieldOn) {
      score += 30;
      fever = clamp(fever + 4, 0, 100);
      emitJudge('BLOCK!');
      emitCoach('โล่กันขยะไว้ได้! 🥗', 'happy');
      emitGameEvent({ type:'junk_blocked' });
      // combo continues
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
    } else {
      miss += 1;
      combo = 0;
      perfectStreak = 0; // ตัด streak
      balancePct = clamp(balancePct - 18, 0, 100);
      fever = clamp(fever - 12, 0, 100);
      emitJudge('MISS');
      emit('hha:miss', { sessionId, mode:'PlateVR', misses: miss, timeFromStartMs: fromStartMs() });
      emitCoach('โดนขยะแล้ว! เลี่ยงให้ได้ 😵', 'sad');
      emitGameEvent({ type:'junk_hit_miss' });

      // clean mini reset
      if (miniCurrent && miniCurrent.key === 'clean') {
        cleanTimer = miniCurrent.target; // reset
      }
    }
  } else if (kind === 'good') {
    // good hit
    const pts = scoreForHit('good', groupId);
    score += pts;
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    fever = clamp(fever + 7, 0, 100);

    registerGroupHit(groupId);
    updateBalance('good', groupId);

    emitJudge(pts >= 110 ? 'PERFECT' : 'GOOD');
    emitGameEvent({ type:'good_hit', groupId, points: pts });

    // mini hooks
    if (miniCurrent && miniCurrent.key === 'rush') {
      // handled in updateMiniTick by haveCount
    }
    if (miniCurrent && miniCurrent.key === 'combo') {
      miniCurrent.prog = Math.max(miniCurrent.prog, combo);
    }

    // check perfect plate
    checkPerfectPlate();

    // fever activation
    if (fever >= 100) activateFever(5200);
  }

  // after any hit
  updateMiniTick();
  hudUpdateAll();
  emitScore();
  emitGameEvent({ type:'hit', kind, groupId, via });

  // fun: difficulty tighten when combo high
  knowAdaptive();
}

// ---------- Tick loops ----------
function tick1s() {
  if (ended) return;

  tLeft -= 1;
  if (tLeft < 0) tLeft = 0;

  // clean mini countdown
  if (miniCurrent && miniCurrent.key === 'clean' && !miniCurrent.done) {
    cleanTimer = Math.max(0, cleanTimer - 1);
    if (cleanTimer <= 0) {
      miniCurrent.prog = miniCurrent.target;
      clearMiniQuest();
    }
  }

  // passive fever/shield/haz updates
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
  // ids from your plate-vr.html
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
}

function computeGrade() {
  const allGoal = perfectPlates >= goalTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
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

  // reset state
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

  hudUpdateAll();
  emitTime();
  emitScore();

  // start mini quest chain
  startNextMiniQuest();

  // start loops
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

  // close modal by replay button already handled
}

function resolvePlateStarter() {
  // in module scope
  if (typeof startGame === 'function') return startGame;
  if (typeof beginGame === 'function') return beginGame;
  if (typeof start === 'function') return start;

  // global fallback
  if (typeof window.startGame === 'function') return window.startGame;
  if (typeof window.beginGame === 'function') return window.beginGame;
  if (typeof window.start === 'function') return window.start;

  return null;
}

// ✅ export ให้ plate-vr.html import ไปเรียก
export function bootPlateDOM() {
  if (window.__PLATE_DOM_BOOTED__) return;
  window.__PLATE_DOM_BOOTED__ = true;

  // basic DOM checks
  if (!scene) console.warn('[PlateVR] a-scene not found yet (will wait loaded)');
  if (!cam) console.warn('[PlateVR] #cam not found. Check plate-vr.html');
  if (!targetRoot) {
    console.error('[PlateVR] #targetRoot not found. Check plate-vr.html');
    emitCoach('หา targetRoot ไม่เจอ! ตรวจ ID ใน plate-vr.html ก่อนนะ ⚠️', 'sad');
    return;
  }

  ensureTouchLookControls();
  bindUI();

  // HUD init
  setText('hudMode', (MODE === 'research') ? 'Research' : 'Play');
  setText('hudDiff', (DIFF === 'easy') ? 'Easy' : (DIFF === 'hard') ? 'Hard' : 'Normal');
  setText('hudTime', tLeft);
  hudUpdateAll();

  const starter = resolvePlateStarter();
  if (!starter) {
    console.error('[PlateVR] No start function found (startGame/start/beginGame).');
    emitCoach('ยังไม่มีฟังก์ชันเริ่มเกมใน plate.safe.js (startGame/beginGame/start) ⚠️', 'sad');
    return;
  }

  // start when scene ready
  if (scene && scene.hasLoaded) starter();
  else if (scene) scene.addEventListener('loaded', () => starter(), { once:true });
  else setTimeout(() => starter(), 250);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !ended) endGame('tab_hidden');
  });
}

// auto boot as safety
window.addEventListener('DOMContentLoaded', () => {
  bootPlateDOM();
});
