// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Fixed 5 slots + Plate graphic + Slot glow/lock + Perfect celebration + Research events
// - Targets appear in 5 fixed slots (no flying)
// - Each group has a dedicated slot; junk appears random slot
// - Slot fills/glows when collected; locked slots won't spawn duplicates
// - PERFECT triggers confetti + sound + big banner
// - Emits hha:event with slotId + plateIndex (GoodJunk-style tracking)
// - Emits hha:session + (play only) hha:stat for adaptive telemetry

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

// ---------- A-Frame guards ----------
const A = window.AFRAME;
if (!A) console.error('[PlateVR] AFRAME not found');

// billboard component (no external deps)
if (A && !A.components.billboard) {
  A.registerComponent('billboard', {
    schema: { target: { type: 'selector' } },
    tick: function () {
      const t = this.data.target;
      if (!t || !window.THREE) return;
      this.el.object3D.lookAt(t.object3D.getWorldPosition(new THREE.Vector3()));
    }
  });
}

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 3, scale: 0.70, lifeMs: 1850, junkRate: 0.12 },
  normal: { spawnInterval: 820, maxActive: 4, scale: 0.62, lifeMs: 1650, junkRate: 0.18 },
  hard:   { spawnInterval: 690, maxActive: 5, scale: 0.56, lifeMs: 1450, junkRate: 0.24 }
};
const DCFG = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

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

// ---------- Plate fixed slots (ข้อ 3) ----------
const PLATE_SLOTS = [
  { slot: 1, groupId: 1, x:  0.00, y:  0.22 },
  { slot: 2, groupId: 2, x: -0.46, y:  0.10 },
  { slot: 3, groupId: 3, x: -0.46, y: -0.16 },
  { slot: 4, groupId: 4, x:  0.46, y:  0.10 },
  { slot: 5, groupId: 5, x:  0.46, y: -0.16 }
];
const PLATE_Z = 0.01; // inside HUD targetRoot

function slotForGroup(groupId){
  return PLATE_SLOTS[groupId - 1];
}
function randSlot(){
  return PLATE_SLOTS[(Math.random() * PLATE_SLOTS.length) | 0];
}

// ---------- Game state ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');
const cursor = document.getElementById('cursor');

const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

let started = false;
let ended = false;

let tLeft = TIME;
let timerTick = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;           // 0..100
let feverActive = false;
let feverUntilMs = 0;

let perfectPlates = 0;

// ✅ plateIndex (ข้อ 4) — นับ “จานที่กำลังทำอยู่”
let plateIndex = 1;

// per-plate flags
let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let plateTotalHits = 0;

// totals
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

let goalTotal = 2;
let goalCleared = 0;

// Mini quest
let miniTotal = 3;
let miniCleared = 0;
let miniDeadlineMs = 0;
const MINI_WINDOW_MS = 15000;

// spawn control
let spawnTimer = null;            // setTimeout loop
let activeTargets = new Map();    // id -> { el, spawnMs, groupId, type, emoji, slotId, expireTimer }

// time origin
const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function nowIso() { return new Date().toISOString(); }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; }

// ---------- Adaptive (PLAY only) ----------
let adaptiveScale = 1.0;
let adaptiveSpawn = 1.0;
let adaptiveMaxActive = 0;

let aScaleMin = 0.78, aScaleMax = 1.24;
let aSpawnMin = 0.75, aSpawnMax = 1.30;
let aMaxMin = -1, aMaxMax = +2;

function initAdaptiveForDiff() {
  if (!isAdaptiveOn()) {
    adaptiveScale = 1.0; adaptiveSpawn = 1.0; adaptiveMaxActive = 0;
    return;
  }
  if (DIFF === 'easy') {
    aScaleMin = 0.85; aScaleMax = 1.30;
    aSpawnMin = 0.80; aSpawnMax = 1.35;
    aMaxMin = 0; aMaxMax = 2;
  } else if (DIFF === 'hard') {
    aScaleMin = 0.70; aScaleMax = 1.18;
    aSpawnMin = 0.72; aSpawnMax = 1.25;
    aMaxMin = -1; aMaxMax = 1;
  } else {
    aScaleMin = 0.78; aScaleMax = 1.24;
    aSpawnMin = 0.75; aSpawnMax = 1.30;
    aMaxMin = -1; aMaxMax = 2;
  }
  adaptiveScale = 1.0;
  adaptiveSpawn = 1.0;
  adaptiveMaxActive = 0;
}

function currentSpawnIntervalMs() {
  const ms = Math.round(DCFG.spawnInterval * clamp(adaptiveSpawn, aSpawnMin, aSpawnMax));
  return clamp(ms, 260, 2200);
}
function currentMaxActive() {
  const v = DCFG.maxActive + clamp(adaptiveMaxActive, aMaxMin, aMaxMax);
  return clamp(v, 2, 8);
}

function bumpAdaptive(onGood) {
  if (!isAdaptiveOn()) return;

  if (onGood) {
    adaptiveScale = clamp(adaptiveScale - 0.025, aScaleMin, aScaleMax);
    adaptiveSpawn = clamp(adaptiveSpawn - 0.020, aSpawnMin, aSpawnMax);
    if (combo > 8 && adaptiveMaxActive < aMaxMax) adaptiveMaxActive += 1;
  } else {
    adaptiveScale = clamp(adaptiveScale + 0.040, aScaleMin, aScaleMax);
    adaptiveSpawn = clamp(adaptiveSpawn + 0.030, aSpawnMin, aSpawnMax);
    if (miss % 3 === 0 && adaptiveMaxActive > aMaxMin) adaptiveMaxActive -= 1;
  }

  emitStat('adapt');
}

// ---------- Logger emitters ----------
function emit(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function emitGameEvent(payload) {
  // ✅ ข้อ 4: ส่ง slotId + plateIndex ให้เหมือน GoodJunk-style event enrichment
  emit('hha:event', Object.assign({
    sessionId,
    type: payload.type || '',
    mode: 'PlateVR',
    runMode: MODE,
    difficulty: DIFF,
    timeFromStartMs: fromStartMs(),
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),
    totalScore: score,
    combo,
    plateIndex
  }, payload));
}

// play-only stat telemetry
let statTimer = null;
function emitStat(reason) {
  if (!isAdaptiveOn()) return;
  emit('hha:stat', {
    sessionId,
    runMode: 'play',
    mode: 'PlateVR',
    difficulty: DIFF,
    timeFromStartMs: fromStartMs(),
    adaptiveScale: Number(adaptiveScale.toFixed(3)),
    adaptiveSpawn: Number(adaptiveSpawn.toFixed(3)),
    adaptiveMaxActive: Number(adaptiveMaxActive),
    spawnIntervalMs: currentSpawnIntervalMs(),
    maxActive: currentMaxActive(),
    score,
    combo,
    misses: miss,
    plateIndex,
    reason: reason || 'tick'
  });
}
function startStatTicker() {
  if (!isAdaptiveOn()) return;
  if (statTimer) clearInterval(statTimer);
  statTimer = setInterval(() => emitStat('tick'), 1500);
  emitStat('start');
}
function stopStatTicker() {
  if (statTimer) clearInterval(statTimer);
  statTimer = null;
}

function emitSessionEnd(reason) {
  const gTotal = totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5];

  emit('hha:session', {
    sessionId,
    mode: 'PlateVR',
    runMode: MODE,
    difficulty: DIFF,

    durationSecPlayed: TIME - tLeft,
    scoreFinal: score,
    comboMax: maxCombo,
    misses: miss,

    goalsCleared: goalCleared,
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: miniTotal,

    nHitGood: gTotal,
    reason: reason || '',

    extra: JSON.stringify({
      totalsByGroup,
      plateCounts,
      perfectPlates,
      plateIndexEnd: plateIndex,
      miniCleared,
      adaptive: isAdaptiveOn()
        ? { adaptiveScale, adaptiveSpawn, adaptiveMaxActive, spawnIntervalMs: currentSpawnIntervalMs(), maxActive: currentMaxActive() }
        : { locked: true }
    }),

    startTimeIso: sessionStartIso,
    endTimeIso: nowIso(),
    gameVersion: 'PlateVR-2025-12-16c'
  });
}

// ---------- HUD ----------
function diffLabel(d) { return d === 'easy' ? 'Easy' : (d === 'hard' ? 'Hard' : 'Normal'); }
function modeLabel(m) { return (m === 'research') ? 'Research' : 'Play'; }

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
  const goalEl = $('hudGoalLine');
  if (goalEl) goalEl.innerHTML = `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${goalCleared}/${goalTotal})`;

  const msLeft = Math.max(0, miniDeadlineMs - performance.now());
  const sLeft = Math.ceil(msLeft / 1000);
  const miniEl = $('hudMiniLine');
  if (miniEl) miniEl.textContent = `Mini: Plate Rush ${miniCleared}/${miniTotal} — ทำ Perfect ภายใน ${Math.max(0, sLeft)}s`;
}

function calcGrade() {
  const dur = Math.max(1, TIME);
  const sps = score / dur;
  const penalty = miss * 6 + Math.max(0, 8 - maxCombo) * 2;
  const perfBonus = perfectPlates * 40 + miniCleared * 25;
  const v = (sps * 100) + perfBonus - penalty;

  if (v >= 260) return 'SSS';
  if (v >= 220) return 'SS';
  if (v >= 185) return 'S';
  if (v >= 150) return 'A';
  if (v >= 115) return 'B';
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
  setText('rMinis', `${miniCleared}/${miniTotal}`);

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

// ---------- Look-controls ----------
function ensureTouchLookControls() {
  if (!cam) return;
  try { cam.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true'); } catch (_) {}
}

// ---------- Fever ----------
function addFever(delta) {
  if (feverActive) return;
  fever = clamp(fever + delta, 0, 100);
  if (fever >= 100) {
    fever = 100;
    startFever();
  }
}
function startFever() {
  feverActive = true;
  feverUntilMs = performance.now() + 8000;
  emitGameEvent({ type: 'fever_on' });
}
function endFever() {
  feverActive = false;
  feverUntilMs = 0;
  fever = 0;
  emitGameEvent({ type: 'fever_off' });
}

// ---------- 3D Plate UI (ข้อ 1) + Slot glow/lock (ข้อ 2) ----------
const slotUI = new Map(); // slotId -> { ring, glow, label }
let plateDisk = null;

function makeEntity(tag, attrs = {}) {
  const el = document.createElement(tag);
  Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
  return el;
}

function ensurePlateVisual() {
  if (!targetRoot) return;

  // Plate disk (พื้นจาน)
  if (!plateDisk) {
    plateDisk = makeEntity('a-circle', {
      radius: 0.78,
      position: `0 0 ${PLATE_Z - 0.02}`,
      rotation: `-90 0 0`,
      material: 'color:#0b1220; opacity:0.28; shader:flat; side:double'
    });
    targetRoot.appendChild(plateDisk);

    // เส้น cross เบา ๆ ให้รู้สึกเป็นจาน
    const line1 = makeEntity('a-plane', {
      width: 1.35, height: 0.02,
      position: `0 0 ${PLATE_Z - 0.015}`,
      material: 'color:#94a3b8; opacity:0.18; shader:flat; side:double'
    });
    const line2 = makeEntity('a-plane', {
      width: 0.02, height: 1.05,
      position: `0 0 ${PLATE_Z - 0.015}`,
      material: 'color:#94a3b8; opacity:0.12; shader:flat; side:double'
    });
    targetRoot.appendChild(line1);
    targetRoot.appendChild(line2);
  }

  // Slots UI
  if (slotUI.size === 0) {
    for (const s of PLATE_SLOTS) {
      const ring = makeEntity('a-ring', {
        radiusInner: 0.10,
        radiusOuter: 0.12,
        position: `${s.x} ${s.y} ${PLATE_Z}`,
        material: 'color:#94a3b8; opacity:0.35; shader:flat; side:double'
      });

      // glow ring (ซ้อน)
      const glow = makeEntity('a-ring', {
        radiusInner: 0.105,
        radiusOuter: 0.145,
        position: `${s.x} ${s.y} ${PLATE_Z - 0.001}`,
        material: 'color:#22c55e; opacity:0.00; shader:flat; side:double'
      });

      // slot number hint (เล็กมาก)
      const label = makeEntity('a-entity', {});
      label.setAttribute('text', {
        value: String(s.slot),
        align: 'center',
        color: '#9ca3af',
        width: 2.4
      });
      label.setAttribute('position', `${s.x} ${s.y - 0.17} ${PLATE_Z}`);

      targetRoot.appendChild(ring);
      targetRoot.appendChild(glow);
      targetRoot.appendChild(label);

      slotUI.set(s.slot, { ring, glow, label });
    }
  }
}

function setSlotFilled(groupId, filled) {
  const slot = slotForGroup(groupId);
  if (!slot) return;
  const ui = slotUI.get(slot.slot);
  if (!ui) return;

  // filled -> ring muted + glow ON
  try {
    ui.ring.setAttribute('material', filled
      ? 'color:#94a3b8; opacity:0.12; shader:flat; side:double'
      : 'color:#94a3b8; opacity:0.35; shader:flat; side:double'
    );
    ui.glow.setAttribute('material', filled
      ? 'color:#22c55e; opacity:0.55; shader:flat; side:double'
      : 'color:#22c55e; opacity:0.00; shader:flat; side:double'
    );
  } catch (_) {}
}

// ---------- DOM celebration FX (ข้อ 3) ----------
let fxLayer = null;
function ensureFxLayer() {
  if (fxLayer) return fxLayer;
  fxLayer = document.createElement('div');
  fxLayer.className = 'plate-fx-layer';
  Object.assign(fxLayer.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 80
  });
  document.body.appendChild(fxLayer);
  return fxLayer;
}

function playSfx(id){
  const a = document.getElementById(id);
  if (!a) return;
  try { a.currentTime = 0; a.play(); } catch (_) {}
}

function banner(text){
  const layer = ensureFxLayer();
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    top: '18%',
    transform: 'translate(-50%, -50%)',
    fontWeight: '900',
    fontSize: '26px',
    letterSpacing: '0.8px',
    color: '#e5e7eb',
    padding: '10px 16px',
    borderRadius: '999px',
    border: '1px solid rgba(34,197,94,.45)',
    background: 'rgba(2,6,23,.55)',
    boxShadow: '0 18px 50px rgba(0,0,0,.45)'
  });
  layer.appendChild(el);
  setTimeout(() => { try { el.remove(); } catch(_){} }, 900);
}

function confettiBurst(){
  const layer = ensureFxLayer();
  const emojis = ['🥦','🍎','🥕','🍚','🥛','✨','💚','⭐'];
  for (let i=0;i<26;i++){
    const p = document.createElement('div');
    p.textContent = emojis[(Math.random()*emojis.length)|0];
    const x = Math.random()*100;
    const y = 55 + Math.random()*35;
    const s = 16 + Math.random()*14;
    const dx = (Math.random()*2-1)*18;
    const dy = - (18 + Math.random()*26);

    Object.assign(p.style, {
      position:'absolute',
      left: x + '%',
      top: y + '%',
      fontSize: s + 'px',
      transform:'translate(-50%,-50%)',
      opacity:'1',
      willChange:'transform,opacity'
    });

    layer.appendChild(p);

    requestAnimationFrame(() => {
      p.style.transition = 'transform 900ms ease-out, opacity 900ms ease-out';
      p.style.transform = `translate(calc(-50% + ${dx}vw), calc(-50% + ${dy}vh)) rotate(${(Math.random()*260-130)|0}deg)`;
      p.style.opacity = '0';
    });

    setTimeout(() => { try { p.remove(); } catch(_){} }, 950);
  }
}

// ---------- Plate logic ----------
function resetPlate() {
  plateHave = { 1:false,2:false,3:false,4:false,5:false };
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  plateTotalHits = 0;

  // reset slot visuals
  for (let g=1; g<=5; g++) setSlotFilled(g, false);

  miniDeadlineMs = performance.now() + MINI_WINDOW_MS;

  emitGameEvent({ type:'plate_start', judgment:'OK', plateIndex });
}

function completePerfectPlate() {
  perfectPlates += 1;

  // ✅ celebration (ข้อ 3)
  playSfx('sfx-perfect');
  banner('🎉 PERFECT PLATE!');
  confettiBurst();

  emitGameEvent({
    type: 'plate_perfect',
    judgment: 'PERFECT',
    perfectPlates,
    extra: JSON.stringify({ perfectPlates, plateIndex })
  });

  if (miniCleared < miniTotal && performance.now() <= miniDeadlineMs) {
    miniCleared += 1;
    emitGameEvent({ type: 'mini_clear', judgment: 'OK', miniCleared, extra: `PlateRush ${miniCleared}/${miniTotal}` });
    if (miniCleared < miniTotal) miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  } else {
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  }

  // ไปจานถัดไป
  plateIndex += 1;
  resetPlate();
  emitStat('perfect');
}

// ---------- Pick item ----------
function pickItem() {
  if (Math.random() < DCFG.junkRate) {
    const emoji = pick(POOL.junk.emojis);
    return { groupId: 0, key: 'junk', type: 'junk', emoji };
  }
  const missing = GROUP_KEYS.filter(k => !plateHave[POOL[k].id]);
  const key = (missing.length && Math.random() < 0.80) ? pick(missing) : pick(GROUP_KEYS);
  const g = POOL[key];
  const emoji = pick(g.emojis);
  return { groupId: g.id, key, type: 'good', emoji };
}

// ---------- Spawn helpers (fixed slots) ----------
let targetSeq = 0;

function slotIsOccupied(slotId){
  for (const t of activeTargets.values()) {
    if (t.slotId === slotId) return true;
  }
  return false;
}

function spawnTarget() {
  if (ended || !started) return;
  if (!targetRoot || !cam) return;
  if (activeTargets.size >= currentMaxActive()) return;

  const item = pickItem();

  // ✅ fixed slot: good -> dedicated slot, junk -> random slot
  const slot = (item.type === 'good') ? slotForGroup(item.groupId) : randSlot();
  if (!slot) return;

  // ✅ lock: ถ้า slot นี้ filled แล้ว (เฉพาะ good) ไม่ spawn
  if (item.type === 'good' && plateHave[item.groupId]) return;

  // ✅ no overlap in same slot
  if (slotIsOccupied(slot.slot)) return;

  const id = `t${++targetSeq}`;

  const el = document.createElement('a-entity');
  el.setAttribute('id', id);
  el.setAttribute('position', `${slot.x} ${slot.y} ${PLATE_Z}`);

  const s = DCFG.scale * (isAdaptiveOn() ? adaptiveScale : 1.0);
  el.setAttribute('scale', `${s} ${s} ${s}`);

  el.classList.add('plateTarget');

  el.setAttribute('text', {
    value: item.emoji,
    align: 'center',
    color: '#ffffff',
    width: 4.0,
    baseline: 'center'
  });

  el.setAttribute('billboard', 'target:#cam');
  el.setAttribute('animation__pop', `property:scale; from:0.01 0.01 0.01; to:${s} ${s} ${s}; dur:120; easing:easeOutBack`);

  const spawnMs = performance.now();
  el.addEventListener('click', () => onHitTarget(id, 'CLICK'));

  targetRoot.appendChild(el);

  const expireTimer = setTimeout(() => {
    if (activeTargets.has(id)) {
      removeTarget(id);
      onTargetExpired(item, slot.slot);
    }
  }, DCFG.lifeMs);

  activeTargets.set(id, {
    el, spawnMs,
    groupId: item.groupId,
    type: item.type,
    emoji: item.emoji,
    slotId: slot.slot,
    expireTimer
  });

  // ✅ event spawn with slotId + plateIndex (ข้อ 4)
  emitGameEvent({
    type: 'spawn',
    targetId: id,
    emoji: item.emoji,
    itemType: item.type === 'junk' ? 'junk' : `g${item.groupId}`,
    isGood: item.type === 'good',
    slotId: slot.slot
  });
}

function removeTarget(id) {
  const t = activeTargets.get(id);
  if (!t) return;
  activeTargets.delete(id);
  try { clearTimeout(t.expireTimer); } catch (_) {}
  try { t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el); } catch (_) {}
}

// ---------- Scoring ----------
function addScore(base) {
  const mult = feverActive ? 2 : 1;
  const cMult = Math.min(4, 1 + combo * 0.06);
  score += Math.round(base * mult * cMult);
}

function onHitTarget(id, why) {
  if (ended) return;
  const t = activeTargets.get(id);
  if (!t) return;

  const rt = Math.max(0, Math.round(performance.now() - t.spawnMs));
  removeTarget(id);

  if (t.type === 'junk') {
    playSfx('sfx-bad');
    miss += 1;
    combo = 0;
    addFever(-18);

    emitGameEvent({
      type: 'hit',
      targetId: id,
      emoji: t.emoji,
      itemType: 'junk',
      rtMs: rt,
      judgment: 'BAD',
      isGood: false,
      slotId: t.slotId,
      extra: why
    });

    bumpAdaptive(false);
    updateHUD();
    return;
  }

  playSfx('sfx-hit');
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  addScore(12);
  addFever(11);

  plateTotalHits += 1;
  totalsByGroup[t.groupId] = (totalsByGroup[t.groupId] || 0) + 1;

  plateCounts[t.groupId] = (plateCounts[t.groupId] || 0) + 1;
  if (!plateHave[t.groupId]) {
    plateHave[t.groupId] = true;
    // ✅ slot glow/lock (ข้อ 2)
    setSlotFilled(t.groupId, true);
  }

  emitGameEvent({
    type: 'hit',
    targetId: id,
    emoji: t.emoji,
    itemType: `g${t.groupId}`,
    rtMs: rt,
    judgment: 'GOOD',
    isGood: true,
    slotId: t.slotId,
    extra: why
  });

  bumpAdaptive(true);

  const haveCount = Object.values(plateHave).filter(Boolean).length;
  if (haveCount >= 5) completePerfectPlate();

  updateHUD();
}

function onTargetExpired(item, slotId) {
  if (ended) return;

  miss += 1;
  combo = 0;
  addFever(-10);

  emitGameEvent({
    type: 'expire',
    emoji: item.emoji,
    itemType: item.type === 'junk' ? 'junk' : `g${item.groupId}`,
    judgment: 'MISS',
    isGood: item.type !== 'junk',
    slotId
  });

  bumpAdaptive(false);
  updateHUD();
}

// ---------- Mini quest ticking ----------
function tickMini() {
  if (ended) return;
  if (miniCleared >= miniTotal) return;

  if (performance.now() > miniDeadlineMs) {
    emitGameEvent({ type: 'mini_fail', judgment: 'FAIL', extra: `PlateRush ${miniCleared}/${miniTotal}` });
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
    emitStat('mini_fail');
  }
}

// ---------- Main timer ----------
function startTimer() {
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(() => {
    if (!started || ended) return;

    if (feverActive && performance.now() >= feverUntilMs) endFever();
    tickMini();

    tLeft -= 1;
    if (tLeft <= 0) {
      tLeft = 0;
      updateHUD();
      endGame('time_up');
      return;
    }
    updateHUD();
  }, 1000);
}

// spawn loop (1 spawn only; no double during fever — ลดวุ่น)
function scheduleNextSpawn() {
  if (ended || !started) return;

  const ms = isAdaptiveOn() ? currentSpawnIntervalMs() : DCFG.spawnInterval;
  spawnTimer = setTimeout(() => {
    if (!started || ended) return;
    spawnTarget();
    scheduleNextSpawn();
  }, ms);
}

function stopSpawning() {
  if (spawnTimer) clearTimeout(spawnTimer);
  spawnTimer = null;
}

// ---------- Start / End ----------
function startGame() {
  if (started) return;
  started = true;
  ended = false;

  initAdaptiveForDiff();
  ensurePlateVisual();

  plateIndex = 1;
  resetPlate();
  miniDeadlineMs = performance.now() + MINI_WINDOW_MS;

  updateHUD();
  emitGameEvent({ type: 'start', judgment: 'OK', extra: `run=${MODE}` });

  startStatTicker();
  startTimer();
  scheduleNextSpawn();
}

function clearAllTargets() {
  for (const id of Array.from(activeTargets.keys())) removeTarget(id);
  activeTargets.clear();
}

function endGame(reason) {
  if (ended) return;
  ended = true;
  started = false;

  stopSpawning();
  if (timerTick) clearInterval(timerTick);
  timerTick = null;

  emitStat('end');
  stopStatTicker();

  if (feverActive) endFever();

  clearAllTargets();

  emitGameEvent({ type: 'end', judgment: 'OK', extra: reason || '' });
  emitSessionEnd(reason || 'end');

  showResult();
}

// ---------- Buttons ----------
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
      if (e.target === bd) bd.style.display = 'none';
    });
  }
}

// ---------- Cloud logger init ----------
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

  ensurePlateVisual();
  initLoggerIfAvailable();

  // retry init logger if module loads later
  let tries = 0;
  const retry = setInterval(() => {
    if (typeof window.initCloudLogger === 'function') {
      initLoggerIfAvailable();
      clearInterval(retry);
    }
    tries += 1;
    if (tries > 12) clearInterval(retry);
  }, 250);

  if (scene) {
    if (scene.hasLoaded) startGame();
    else scene.addEventListener('loaded', startGame);
  } else {
    setTimeout(startGame, 350);
  }
}

window.addEventListener('DOMContentLoaded', boot);