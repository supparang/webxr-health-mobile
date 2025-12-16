// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Production-ready core (A-Frame 1.5.0)
// - Spawn emoji targets (5 food groups + junk)
// - Plate mechanic: collect groups 1–5 within a plate to earn PERFECT PLATE
// - Goal: PERFECT >= 2
// - Mini quest: Plate Rush (3) — make a PERFECT within 15s
// - Fever mode (100% -> 8s boost)
// - HUD + Result modal update
// - Emits hha:event + hha:session for /vr/hha-cloud-logger.js
//
// URL params:
//   ?diff=easy|normal|hard
//   ?time=60..180
//   ?run=play|research
//
// Works with plate-vr.html you posted (IDs must exist):
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

// expose (เผื่อ HTML อยากใช้)
window.DIFF = DIFF;
window.TIME = TIME;
window.MODE = MODE;

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
function setText(id, v) { const el = $(id); if (el) el.textContent = String(v); }
function setBarPct(id, pct) { const el = $(id); if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`; }

// ---------- A-Frame guards ----------
const A = window.AFRAME;
if (!A) {
  console.error('[PlateVR] AFRAME not found');
}

// billboard component (ไม่พึ่ง aframe-look-at)
if (A && !A.components.billboard) {
  A.registerComponent('billboard', {
    schema: { target: { type: 'selector' } },
    tick: function () {
      const t = this.data.target;
      if (!t) return;
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

// ---------- Food pools (ครบ 5 หมู่ + junk) ----------
const POOL = {
  g1: { id: 1, label: 'หมู่ 1', type: 'good', emojis: ['🥚','🥛','🐟','🍗','🫘'] },  // โปรตีน/นม
  g2: { id: 2, label: 'หมู่ 2', type: 'good', emojis: ['🍚','🍞','🍜','🥔','🌽'] },  // ข้าว-แป้ง
  g3: { id: 3, label: 'หมู่ 3', type: 'good', emojis: ['🥦','🥬','🥕','🍅','🥒'] },  // ผัก
  g4: { id: 4, label: 'หมู่ 4', type: 'good', emojis: ['🍎','🍌','🍇','🍊','🍉'] },  // ผลไม้
  g5: { id: 5, label: 'หมู่ 5', type: 'good', emojis: ['🥑','🫒','🥜','🧈','🍯'] },  // ไขมัน/น้ำมัน
  junk: { id: 0, label: 'junk', type: 'junk', emojis: ['🍟','🍔','🍩','🧋','🍭','🥤'] }
};
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

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

// per-plate group hit flags
let plateHave = { 1:false,2:false,3:false,4:false,5:false };
let plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
let plateTotalHits = 0;

// totals (for result summary)
let totalsByGroup = { 1:0,2:0,3:0,4:0,5:0 };

let goalTotal = 2;
let goalCleared = 0;

// Mini quest: Plate Rush (3)
let miniTotal = 3;
let miniCleared = 0;
let miniIndex = 1;
let miniDeadlineMs = 0;
const MINI_WINDOW_MS = 15000;

// spawn control
let spawnInt = null;
let activeTargets = new Map(); // id -> { el, spawnMs, groupId, type, emoji, expireTimer }

// time origin
const t0 = performance.now();

// ---------- Logger emitters ----------
function emit(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function nowIso() { return new Date().toISOString(); }
function fromStartMs() { return Math.max(0, Math.round(performance.now() - t0)); }

function emitGameEvent(payload) {
  // normalize
  emit('hha:event', Object.assign({
    sessionId,
    type: payload.type || '',
    mode: 'PlateVR',
    difficulty: DIFF,
    timeFromStartMs: fromStartMs(),
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: Math.round(fever),
    totalScore: score,
    combo
  }, payload));
}

function emitSessionEnd(reason) {
  const groupsHaveCount = Object.values(plateHave).filter(Boolean).length;
  const gTotal = totalsByGroup[1]+totalsByGroup[2]+totalsByGroup[3]+totalsByGroup[4]+totalsByGroup[5];

  emit('hha:session', {
    sessionId,
    mode: 'PlateVR',
    difficulty: DIFF,

    durationSecPlayed: TIME - tLeft,
    scoreFinal: score,
    comboMax: maxCombo,
    misses: miss,

    // goal/mini
    goalsCleared: goalCleared,
    goalsTotal: goalTotal,
    miniCleared: miniCleared,
    miniTotal: miniTotal,

    // "spawn/hit" summary fields (reuse Good/Junk fields to keep sheet columns stable)
    nTargetGoodSpawned: '', // (optional) you can fill later
    nTargetJunkSpawned: '',
    nHitGood: gTotal,
    nHitJunk: '',

    // Plate-specific extras packed into "reason" or extra
    reason: reason || '',

    // For your result modal: per-group totals (kept local; you can also put into reason/extra if needed)
    extra: JSON.stringify({
      totalsByGroup,
      plateCounts,
      groupsHaveCount,
      perfectPlates,
      miniIndex,
      miniCleared
    }),

    startTimeIso: sessionStartIso,
    endTimeIso: nowIso(),
    gameVersion: 'PlateVR-2025-12-16a'
  });
}

// ---------- HUD / UI ----------
const sessionStartIso = nowIso();

function diffLabel(d) {
  if (d === 'easy') return 'Easy';
  if (d === 'hard') return 'Hard';
  return 'Normal';
}
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
  const goalLine = `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${goalTotal} จาน (ตอนนี้ ${goalCleared}/${goalTotal})`;
  const goalEl = $('hudGoalLine');
  if (goalEl) goalEl.innerHTML = goalLine;

  // mini line
  const msLeft = Math.max(0, miniDeadlineMs - performance.now());
  const sLeft = Math.ceil(msLeft / 1000);
  const miniEl = $('hudMiniLine');
  if (miniEl) {
    miniEl.textContent =
      `Mini: Plate Rush ${miniCleared}/${miniTotal} — ทำ Perfect ภายใน ${Math.max(0, sLeft)}s`;
  }
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

// Grade heuristic (ปรับได้)
function calcGrade() {
  // score per sec + penalties
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

// ---------- Camera swipe fix (กันบางมือถือหมุนไม่ติด) ----------
function ensureTouchLookControls() {
  // A-Frame look-controls มี touchEnabled แล้วใน HTML แต่บางทีต้อง force
  if (!cam) return;
  try {
    cam.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true');
  } catch (_) {}
}

// ---------- Fever ----------
function clamp(v, a, b) { v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function addFever(delta) {
  if (feverActive) return; // ระหว่าง fever ไม่สะสม (ปรับได้)
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

// ---------- Plate logic ----------
function resetPlate() {
  plateHave = { 1:false,2:false,3:false,4:false,5:false };
  plateCounts = { 1:0,2:0,3:0,4:0,5:0 };
  plateTotalHits = 0;

  // reset mini window on new plate attempt (for Plate Rush)
  miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
}

function completePerfectPlate() {
  perfectPlates += 1;

  emitGameEvent({
    type: 'plate_perfect',
    judgment: 'PERFECT',
    extra: JSON.stringify({ perfectPlates })
  });

  // mini quest success (if within window)
  if (miniCleared < miniTotal && performance.now() <= miniDeadlineMs) {
    miniCleared += 1;
    emitGameEvent({ type: 'mini_clear', judgment: 'OK', extra: `PlateRush ${miniCleared}/${miniTotal}` });

    // advance / finish
    if (miniCleared < miniTotal) {
      miniIndex = miniCleared + 1;
      miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
    }
  } else {
    // even if late, restart window for next attempt
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  }

  resetPlate();
}

// ---------- Spawn helpers ----------
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function pickItem() {
  // junk chance
  if (Math.random() < DCFG.junkRate) {
    const emoji = pick(POOL.junk.emojis);
    return { groupId: 0, key: 'junk', type: 'junk', emoji };
  }
  // choose a group we still "need" more often (adaptive)
  const missing = GROUP_KEYS.filter(k => !plateHave[POOL[k].id]);
  const key = (missing.length && Math.random() < 0.72) ? pick(missing) : pick(GROUP_KEYS);
  const g = POOL[key];
  const emoji = pick(g.emojis);
  return { groupId: g.id, key, type: 'good', emoji };
}

let targetSeq = 0;

function spawnTarget() {
  if (ended || !started) return;
  if (!targetRoot || !cam) return;
  if (activeTargets.size >= DCFG.maxActive) return;

  const item = pickItem();
  const id = `t${++targetSeq}`;

  // spawn in front-ish of camera with slight spread
  // (so when "เลื่อนจอ" / look around, targets move naturally in view)
  const x = rnd(-1.15, 1.15);
  const y = rnd(1.05, 2.25);
  const z = rnd(-3.3, -2.3);

  const el = document.createElement('a-entity');
  el.setAttribute('id', id);
  el.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
  el.setAttribute('scale', `${DCFG.scale} ${DCFG.scale} ${DCFG.scale}`);

  // IMPORTANT for cursor raycaster
  el.classList.add('plateTarget');

  // emoji text
  el.setAttribute('text', {
    value: item.emoji,
    align: 'center',
    color: '#ffffff',
    width: 4.0,
    baseline: 'center'
  });

  // billboard
  el.setAttribute('billboard', 'target:#cam');

  // subtle "pop" animation
  el.setAttribute('animation__pop', `property:scale; from:0.01 0.01 0.01; to:${DCFG.scale} ${DCFG.scale} ${DCFG.scale}; dur:120; easing:easeOutBack`);

  // click/fuse hit
  const spawnMs = performance.now();
  el.addEventListener('click', () => onHitTarget(id, 'CLICK'));

  // append
  targetRoot.appendChild(el);

  // expire
  const expireTimer = setTimeout(() => {
    // if still active -> miss
    if (activeTargets.has(id)) {
      removeTarget(id);
      onTargetExpired(item);
    }
  }, DCFG.lifeMs);

  activeTargets.set(id, {
    el, spawnMs,
    groupId: item.groupId,
    type: item.type,
    emoji: item.emoji,
    expireTimer
  });

  emitGameEvent({
    type: 'spawn',
    targetId: id,
    emoji: item.emoji,
    itemType: item.type,
    isGood: item.type === 'good'
  });
}

function removeTarget(id) {
  const t = activeTargets.get(id);
  if (!t) return;
  activeTargets.delete(id);
  try { clearTimeout(t.expireTimer); } catch (_) {}
  try { t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el); } catch (_) {}
}

// ---------- Scoring rules ----------
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
    // junk hit = miss + combo break
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

    updateHUD();
    return;
  }

  // good hit
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  addScore(12);
  addFever(11);

  // group count
  plateTotalHits += 1;
  totalsByGroup[t.groupId] = (totalsByGroup[t.groupId] || 0) + 1;

  // per-plate
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

  // check plate complete
  const haveCount = Object.values(plateHave).filter(Boolean).length;
  if (haveCount >= 5) {
    completePerfectPlate();
  }

  updateHUD();
}

function onTargetExpired(item) {
  if (ended) return;

  // expire good = miss (เหมือนเกมอื่น ๆ)
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

  updateHUD();
}

// ---------- Mini quest ticking ----------
function tickMini() {
  if (ended) return;
  if (miniCleared >= miniTotal) return;

  if (performance.now() > miniDeadlineMs) {
    // fail window -> restart same mini index
    emitGameEvent({ type: 'mini_fail', judgment: 'FAIL', extra: `PlateRush ${miniCleared}/${miniTotal}` });
    miniDeadlineMs = performance.now() + MINI_WINDOW_MS;
  }
}

// ---------- Main timer ----------
function startTimer() {
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(() => {
    if (!started || ended) return;

    // fever timeout
    if (feverActive && performance.now() >= feverUntilMs) {
      endFever();
    }

    tickMini();

    // time countdown
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

function startSpawning() {
  if (spawnInt) clearInterval(spawnInt);
  spawnInt = setInterval(() => {
    // during fever spawn faster (optional)
    if (feverActive) {
      spawnTarget();
      if (Math.random() < 0.45) spawnTarget();
    } else {
      spawnTarget();
    }
  }, DCFG.spawnInterval);
}

function stopSpawning() {
  if (spawnInt) clearInterval(spawnInt);
  spawnInt = null;
}

// ---------- Start / End ----------
function startGame() {
  if (started) return;
  started = true;
  ended = false;

  resetPlate();
  miniDeadlineMs = performance.now() + MINI_WINDOW_MS;

  // init HUD base
  updateHUD();

  emitGameEvent({ type: 'start', judgment: 'OK', extra: `run=${MODE}` });

  startTimer();
  startSpawning();
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

  // fever off
  if (feverActive) endFever();

  clearAllTargets();

  emitGameEvent({ type: 'end', judgment: 'OK', extra: reason || '' });
  emitSessionEnd(reason || 'end');

  showResult();
}

// ---------- Buttons ----------
function bindUI() {
  const btnRestart = $('btnRestart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => location.reload());
  }

  const btnPlayAgain = $('btnPlayAgain');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => location.reload());
  }

  const btnEnterVR = $('btnEnterVR');
  if (btnEnterVR && scene) {
    btnEnterVR.addEventListener('click', async () => {
      try {
        await scene.enterVR();
      } catch (e) {
        console.warn('[PlateVR] enterVR failed', e);
      }
    });
  }

  // hide result when clicking backdrop (optional)
  const bd = $('resultBackdrop');
  if (bd) {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) hideResult();
    });
  }
}

// ---------- Cloud logger init (optional) ----------
function initLoggerIfAvailable() {
  // You already import logger in HTML; here we just call it safely if present
  const init = window.initCloudLogger;
  if (typeof init !== 'function') return;

  // endpoint should be set by HTML (recommended) OR sessionStorage
  // If you prefer hardcode: set sessionStorage.HHA_LOG_ENDPOINT from hub
  const endpoint =
    (window.HHA_LOG_ENDPOINT) ||
    (sessionStorage && sessionStorage.getItem('HHA_LOG_ENDPOINT')) ||
    ''; // allow empty (logger will skip)

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

  // set labels
  setText('hudMode', modeLabel(MODE));
  setText('hudDiff', diffLabel(DIFF));
  setText('hudTime', tLeft);

  // attempt logger init (safe)
  initLoggerIfAvailable();

  // if logger is loaded after, retry a few times
  let tries = 0;
  const retry = setInterval(() => {
    if (typeof window.initCloudLogger === 'function') {
      initLoggerIfAvailable();
      clearInterval(retry);
    }
    tries += 1;
    if (tries > 12) clearInterval(retry);
  }, 250);

  // start game after scene ready
  if (scene) {
    if (scene.hasLoaded) startGame();
    else scene.addEventListener('loaded', startGame);
  } else {
    // fallback
    setTimeout(startGame, 350);
  }
}

window.addEventListener('DOMContentLoaded', boot);
