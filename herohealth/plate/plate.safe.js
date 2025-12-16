// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Production-ready core (A-Frame 1.5.0)
// FIX: targetRoot is inside camera => spawn in camera-local coordinates (HUD space)
// + Use plane hitbox + a-text emoji to guarantee visibility on mobile.
// Emits hha:event + hha:session + hha:stat for /vr/hha-cloud-logger.js

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

// billboard component (ไม่พึ่ง aframe-look-at)
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
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.78, lifeMs: 1850, junkRate: 0.12 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.66, lifeMs: 1650, junkRate: 0.18 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.56, lifeMs: 1450, junkRate: 0.24 }
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

// ---------- Scene refs ----------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

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

let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

let goalTotal = 2;
let goalCleared = 0;

let miniTotal = 3;
let miniCleared = 0;
let miniDeadlineMs = 0;
const MINI_WINDOW_MS = 15000;

let spawnTimer = null;
let activeTargets = new Map(); // id -> { el, spawnMs, groupId, type, emoji, expireTimer }

const t0 = performance.now();
const sessionStartIso = new Date().toISOString();

// ---------- Utils ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function nowIso() { return new Date().toISOString(); }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }
function isAdaptiveOn() { return MODE === 'play'; }

// ---------- Adaptive ----------
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
  return clamp(ms, 240, 2200);
}
function currentMaxActive() {
  const v = DCFG.maxActive + clamp(adaptiveMaxActive, aMaxMin, aMaxMax);
  return clamp(v, 2, 10);
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
  emit('hha:event', Object.assign({
    sessionId,
    type: payload.type || '',
    mode: 'PlateVR',
    difficulty: DIFF,
    runMode: MODE,
    timeFromStartMs: fromStartMs(),
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),
    totalScore: score,
    combo
  }, payload));
}

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
    difficulty: DIFF,
    runMode: MODE,

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

// ---------- HUD / UI ----------
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
  if (goalEl) goalEl.innerHTML =
    `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${goalCleared}/${goalTotal})`;

  const msLeft = Math.max(0, miniDeadlineMs - performance.now());
  const sLeft = Math.ceil(msLeft / 1000);
  const miniEl = $('hudMiniLine');
  if (miniEl) miniEl.textContent =
    `Mini: Plate Rush ${miniCleared}/${miniTotal} — ทำ Perfect ภายใน ${Math.max(0, sLeft)}s`;
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
  setText('rGTotal', totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5]);
  setText('rGrade', calcGrade());
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
}
function endFever() {
  feverActive = false;
  feverUntilMs = 0;
  fever = 0;
  emitGameEvent({ type: 'fever_off' });
}

// ---------- Plate logic ----------
function resetPlate() {
  plateHave = { 1:false,2:false,3:false,4:false,5:false };
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
}
function completePerfectPlate() {
  perfectPlates += 1;
  emitGameEvent({ type: 'plate_perfect', judgment: 'PERFECT', extra: JSON.stringify({ perfectPlates }) });

  if (miniCleared < miniTotal && performance.now() <= miniDeadlineMs) {
    miniCleared += 1;
    emitGameEvent({ type: 'mini_clear', judgment: 'OK', extra: `PlateRush ${miniCleared}/${miniTotal}` });
    if (miniCleared < miniTotal) miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  } else {
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  }

  resetPlate();
  emitStat('perfect');
}

// ---------- Pick item ----------
function pickItem() {
  if (Math.random() < DCFG.junkRate) {
    return { groupId: 0, key: 'junk', type: 'junk', emoji: pick(POOL.junk.emojis) };
  }
  const missing = GROUP_KEYS.filter(k => !plateHave[POOL[k].id]);
  const key = (missing.length && Math.random() < 0.72) ? pick(missing) : pick(GROUP_KEYS);
  const g = POOL[key];
  return { groupId: g.id, key, type: 'good', emoji: pick(g.emojis) };
}

// ---------- Spawn coord fix ----------
function isRootInCamera() {
  if (!cam || !targetRoot) return false;
  return cam.contains(targetRoot); // ✅ key fix
}

let targetSeq = 0;

function spawnTarget() {
  if (ended || !started) return;
  if (!targetRoot || !cam) return;
  if (activeTargets.size >= currentMaxActive()) return;

  const item = pickItem();
  const id = `t${++targetSeq}`;

  const rootInCam = isRootInCamera();

  // ✅ ถ้า root อยู่ในกล้อง: ใช้พิกัดแบบ HUD (y ใกล้ 0)
  // ✅ ถ้า root อยู่โลก: ใช้พิกัดแบบ world (y 1..2)
  let x, y, z;
  if (rootInCam) {
    x = rnd(-1.05, 1.05);
    y = rnd(-0.55, 0.55);     // <<< FIX: เดิม 1.05..2.25 ทำให้หลุด FOV
    z = rnd(-0.25, 0.25);     // ใกล้ root เพื่อไม่หลุดฉาก
  } else {
    x = rnd(-1.15, 1.15);
    y = rnd(1.05, 2.25);
    z = rnd(-3.3, -2.3);
  }

  const el = document.createElement('a-entity');
  el.setAttribute('id', id);
  el.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);

  // ✅ adaptive scale
  const s = DCFG.scale * (isAdaptiveOn() ? adaptiveScale : 1.0);
  el.setAttribute('scale', `${s} ${s} ${s}`);

  // ✅ hitbox plane (เห็น + ยิง raycast ชัวร์)
  el.classList.add('plateTarget');
  el.setAttribute('geometry', `primitive:plane; width:0.72; height:0.72`);
  el.setAttribute('material', `
    shader:flat;
    transparent:true;
    opacity:0.16;
    side:double;
    color:${item.type === 'junk' ? '#fb7185' : '#a7f3d0'}
  `);

  // emoji text (เห็นชัวร์)
  const txt = document.createElement('a-entity');
  txt.setAttribute('text', `
    value:${item.emoji};
    align:center;
    color:#ffffff;
    width:3.2;
    baseline:center;
    wrapCount:6;
  `);
  txt.setAttribute('position', `0 0 0.01`);
  el.appendChild(txt);

  // billboard ให้หันเข้าหากล้อง
  el.setAttribute('billboard', 'target:#cam');

  // pop
  el.setAttribute('animation__pop', `property:scale; from:0.01 0.01 0.01; to:${s} ${s} ${s}; dur:140; easing:easeOutBack`);

  const spawnMs = performance.now();
  el.addEventListener('click', () => onHitTarget(id, 'CLICK'));

  targetRoot.appendChild(el);

  const expireTimer = setTimeout(() => {
    if (activeTargets.has(id)) {
      removeTarget(id);
      onTargetExpired(item);
    }
  }, DCFG.lifeMs);

  activeTargets.set(id, { el, spawnMs, groupId: item.groupId, type: item.type, emoji: item.emoji, expireTimer });

  emitGameEvent({
    type: 'spawn',
    targetId: id,
    emoji: item.emoji,
    itemType: item.type === 'junk' ? 'junk' : `g${item.groupId}`,
    isGood: item.type === 'good',
    spawnX: Number(x.toFixed(3)),
    spawnY: Number(y.toFixed(3)),
    spawnZ: Number(z.toFixed(3)),
    rootInCamera: rootInCam ? 1 : 0
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
      extra: why
    });

    bumpAdaptive(false);
    updateHUD();
    return;
  }

  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  addScore(12);
  addFever(11);

  totalsByGroup[t.groupId] = (totalsByGroup[t.groupId] || 0) + 1;
  plateCounts[t.groupId] = (plateCounts[t.groupId] || 0) + 1;
  if (!plateHave[t.groupId]) plateHave[t.groupId] = true;

  emitGameEvent({
    type: 'hit',
    targetId: id,
    emoji: t.emoji,
    itemType: `g${t.groupId}`,
    rtMs: rt,
    judgment: 'GOOD',
    isGood: true,
    extra: why
  });

  bumpAdaptive(true);

  const haveCount = Object.values(plateHave).filter(Boolean).length;
  if (haveCount >= 5) completePerfectPlate();

  updateHUD();
}

function onTargetExpired(item) {
  if (ended) return;

  miss += 1;
  combo = 0;
  addFever(-10);

  emitGameEvent({
    type: 'expire',
    emoji: item.emoji,
    itemType: item.type === 'junk' ? 'junk' : `g${item.groupId}`,
    judgment: 'MISS',
    isGood: item.type !== 'junk'
  });

  bumpAdaptive(false);
  updateHUD();
}

// ---------- Mini ticking ----------
function tickMini() {
  if (ended) return;
  if (miniCleared >= miniTotal) return;

  if (performance.now() > miniDeadlineMs) {
    emitGameEvent({ type: 'mini_fail', judgment: 'FAIL', extra: `PlateRush ${miniCleared}/${miniTotal}` });
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
    emitStat('mini_fail');
  }
}

// ---------- Timer ----------
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

// ---------- Spawn loop ----------
function scheduleNextSpawn() {
  if (ended || !started) return;

  const ms = isAdaptiveOn() ? currentSpawnIntervalMs() : DCFG.spawnInterval;
  spawnTimer = setTimeout(() => {
    if (!started || ended) return;

    if (feverActive) {
      spawnTarget();
      if (Math.random() < 0.45) spawnTarget();
    } else {
      spawnTarget();
    }

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
  bindUI();

  setText('hudMode', modeLabel(MODE));
  setText('hudDiff', diffLabel(DIFF));
  setText('hudTime', tLeft);

  initLoggerIfAvailable();

  // retry init logger (module timing)
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