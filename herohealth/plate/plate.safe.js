// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — DOM Emoji Targets + Quest + FEVER + Cloud Logger
// ใช้ร่วมกับ: ui-fever.js, particles.js, hha-cloud-logger.js, plate-vr.html

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document || null;

// ---------- Helpers ----------
function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

function centerOfEl (el) {
  if (!el || !el.getBoundingClientRect) {
    return { x: (ROOT.innerWidth || 800) / 2, y: (ROOT.innerHeight || 600) / 2 };
  }
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function nowMs () {
  return (ROOT.performance && ROOT.performance.now)
    ? ROOT.performance.now()
    : Date.now();
}

function makeSessionId () {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e8).toString(36);
  return 'plate-' + t + '-' + r;
}

// ---------- External modules (global IIFE) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  {
    burstAt () {},
    scorePop () {},
    setShardMode () {}
  };

const FeverUI = {
  ensure: ROOT.ensureFeverBar ? ROOT.ensureFeverBar.bind(ROOT) : function () {},
  setFever: ROOT.setFever ? ROOT.setFever.bind(ROOT) : function () {},
  setActive: ROOT.setFeverActive ? ROOT.setFeverActive.bind(ROOT) : function () {},
  setShield: ROOT.setShield ? ROOT.setShield.bind(ROOT) : function () {}
};

// ---------- Difficulty ----------
const BASE_DIFF = {
  easy:   { spawnInterval: 1100, life: 1900, scale: 1.15, maxActive: 3 },
  normal: { spawnInterval: 900,  life: 1700, scale: 1.00, maxActive: 4 },
  hard:   { spawnInterval: 750,  life: 1500, scale: 0.88, maxActive: 5 }
};

// ---------- Emoji pools ----------
const GOOD_GROUP_EMOJI = {
  1: ['🍚', '🍞', '🥖', '🥐'],
  2: ['🍗', '🥩', '🍳', '🫘'],
  3: ['🥦', '🥕', '🥬', '🧅'],
  4: ['🍎', '🍌', '🍊', '🍇'],
  5: ['🥛', '🧀', '🍦']
};

const JUNK_EMOJI = ['🍩', '🍟', '🧁', '🍰', '🥤', '🍕'];

// ---------- Quest pools ----------
const GOAL_POOL = [
  {
    key: 'plate2',
    label: 'ทำจานสมดุลให้ครบ 2 จาน',
    type: 'goal',
    target: 2
  },
  {
    key: 'plate3',
    label: 'ทำจานสมดุลให้ครบ 3 จาน',
    type: 'goal',
    target: 3
  },
  {
    key: 'veg10',
    label: 'เก็บผัก+ผลไม้ 10 ชิ้น',
    type: 'goal',
    target: 10
  }
];

const MINI_POOL = [
  {
    key: 'combo8',
    label: 'ทำคอมโบต่อเนื่องให้ถึง 8',
    type: 'mini',
    target: 8
  },
  {
    key: 'grain10',
    label: 'เก็บหมู่ข้าว-แป้ง 10 ชิ้น',
    type: 'mini',
    target: 10
  },
  {
    key: 'protein8',
    label: 'เก็บหมู่โปรตีน 8 ชิ้น',
    type: 'mini',
    target: 8
  },
  {
    key: 'milk5',
    label: 'เก็บหมู่นม 5 ชิ้น',
    type: 'mini',
    target: 5
  }
];

function cloneQuest (q) {
  return {
    key: q.key,
    label: q.label,
    type: q.type,
    target: q.target | 0,
    prog: 0,
    done: false
  };
}

function pickRandomSubset (pool, n) {
  const arr = pool.slice();
  const out = [];
  while (arr.length && out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    out.push(arr.splice(i, 1)[0]);
  }
  return out;
}

// ---------- State ----------
let state = null;
let activeTargets = [];
let rafId = null;
let stopTimerId = null;

// ---------- DOM target helpers ----------
function applyTargetTransform (el) {
  if (!el) return;
  const vw = ROOT.innerWidth || 800;
  const vh = ROOT.innerHeight || 600;
  const cx = vw * 0.5;
  const cy = vh * 0.5;

  const angleDeg = parseFloat(el.dataset.angle || '0') || 0;
  const rotDeg   = parseFloat(el.dataset.rot   || '0') || 0;
  const totalDeg = angleDeg + rotDeg;
  const rad      = totalDeg * Math.PI / 180;

  const radius   = parseFloat(el.dataset.radius || '180') || 180;
  const x        = cx + Math.cos(rad) * radius;
  const y        = cy + Math.sin(rad) * radius * 0.65;

  const scale = parseFloat(el.dataset.scale || '1') || 1;

  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ')';
}

function spawnTarget () {
  if (!DOC || !state) return;
  const diffConf = state.diffConf;

  const isGood = Math.random() < 0.7;
  let emoji = '❓';
  let group = 0;

  if (isGood) {
    const groupKey = pickOne([1, 2, 3, 4, 5], 3);
    const arr = GOOD_GROUP_EMOJI[groupKey] || ['🥗'];
    emoji = pickOne(arr, '🥗');
    group = groupKey;
  } else {
    emoji = pickOne(JUNK_EMOJI, '🍩');
  }

  const el = DOC.createElement('div');
  el.className = 'hha-target ' + (isGood ? 'hha-target-good' : 'hha-target-bad');
  el.textContent = emoji;
  el.dataset.good   = isGood ? '1' : '0';
  el.dataset.group  = String(group);
  el.dataset.scale  = String(diffConf.scale);
  el.dataset.rot    = '0';

  const baseAngle = Math.random() * 360;
  const radius    = 170 + Math.random() * 40;
  el.dataset.angle  = String(baseAngle);
  el.dataset.radius = String(radius);

  applyTargetTransform(el);

  // click / tap
  el.addEventListener('click', function (ev) {
    ev.stopPropagation();
    handleHit(el);
  });

  DOC.body.appendChild(el);

  const t = {
    id: 't' + Math.random().toString(36).slice(2),
    el,
    isGood,
    group,
    bornAt: nowMs(),
    life: diffConf.life,
    removed: false
  };
  activeTargets.push(t);
}

function removeTargetNow (t) {
  if (!t || t.removed) return;
  t.removed = true;
  const idx = activeTargets.indexOf(t);
  if (idx >= 0) activeTargets.splice(idx, 1);
  if (t.el && t.el.parentNode) {
    t.el.parentNode.removeChild(t.el);
  }
}

// ---------- Fever & shield ----------
function emitFeverEvent (stateStr) {
  ROOT.dispatchEvent(new CustomEvent('hha:fever', {
    detail: {
      state: stateStr,
      mode: 'BalancedPlateVR'
    }
  }));
}

function applyFeverDelta (delta) {
  if (!state) return;
  const prevVal    = state.feverValue;
  const prevActive = state.feverActive;

  const nextVal = clamp(prevVal + delta, 0, 100);
  state.feverValue  = nextVal;
  FeverUI.setFever(nextVal);

  const active = nextVal >= 60;
  state.feverActive = active;
  FeverUI.setActive(active);

  if (active && !prevActive) {
    emitFeverEvent('start');
  } else if (!active && prevActive) {
    emitFeverEvent('end');
  }
}

function setShieldCount (n) {
  if (!state) return;
  state.shieldCount = clamp(n, 0, 9);
  FeverUI.setShield(state.shieldCount);
}

// ---------- Quest ----------
function initQuests (runMode) {
  let goalsAll;
  let minisAll;

  if (runMode === 'research') {
    // Fixed set สำหรับวิจัย
    goalsAll = [
      cloneQuest(GOAL_POOL.find(q => q.key === 'plate2')),
      cloneQuest(GOAL_POOL.find(q => q.key === 'veg10'))
    ].filter(Boolean);

    minisAll = [
      cloneQuest(MINI_POOL.find(q => q.key === 'combo8')),
      cloneQuest(MINI_POOL.find(q => q.key === 'grain10')),
      cloneQuest(MINI_POOL.find(q => q.key === 'protein8'))
    ].filter(Boolean);
  } else {
    // Play mode → สุ่ม 2 goal + 3 mini
    const gTmp = pickRandomSubset(GOAL_POOL, 2).map(cloneQuest);
    const mTmp = pickRandomSubset(MINI_POOL, 3).map(cloneQuest);
    goalsAll = gTmp;
    minisAll = mTmp;
  }

  return { goalsAll, minisAll };
}

function recalcQuestProgress () {
  if (!state) return;

  const s = state;
  const goalsAll = s.goalsAll;
  const minisAll = s.minisAll;

  goalsAll.forEach(q => {
    if (!q) return;
    if (q.key === 'plate2') q.prog = s.platesDone;
    if (q.key === 'plate3') q.prog = s.platesDone;
    if (q.key === 'veg10') q.prog = s.vegFruitCount;
    q.done = q.prog >= q.target;
  });

  minisAll.forEach(q => {
    if (!q) return;
    if (q.key === 'combo8')   q.prog = s.comboMax;
    if (q.key === 'grain10')  q.prog = s.groupCounts[0];
    if (q.key === 'protein8') q.prog = s.groupCounts[1];
    if (q.key === 'milk5')    q.prog = s.groupCounts[4];
    q.done = q.prog >= q.target;
  });

  const goalsCleared = goalsAll.filter(q => q && q.done).length;
  const goalsTotal   = goalsAll.length;
  const minisCleared = minisAll.filter(q => q && q.done).length;
  const minisTotal   = minisAll.length;

  s.goalsCleared = goalsCleared;
  s.goalsTotal   = goalsTotal;
  s.minisCleared = minisCleared;
  s.minisTotal   = minisTotal;

  const nextGoal = goalsAll.find(q => q && !q.done) || null;
  const nextMini = minisAll.find(q => q && !q.done) || null;

  const hint = (nextGoal || nextMini)
    ? 'โฟกัสที่ ' + ((nextGoal && nextGoal.label) || (nextMini && nextMini.label) || '')
    : 'ทำครบทุกภารกิจแล้ว!';

  ROOT.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: nextGoal,
      mini: nextMini,
      goalsAll: goalsAll,
      minisAll: minisAll,
      hint
    }
  }));
}

// ---------- HUD / Stat ----------
function emitStat () {
  if (!state) return;
  ROOT.dispatchEvent(new CustomEvent('hha:stat', {
    detail: {
      mode: 'BalancedPlateVR',
      difficulty: state.difficulty,
      score: state.score,
      combo: state.combo,
      comboMax: state.comboMax,
      misses: state.misses,
      platesDone: state.platesDone,
      totalCounts: state.groupCounts.slice(),
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      questsCleared: state.minisCleared,
      questsTotal: state.minisTotal
    }
  }));
}

// ---------- Logging to Cloud (ผ่าน hha-cloud-logger) ----------
function emitGameEvent (payload) {
  ROOT.dispatchEvent(new CustomEvent('hha:event', {
    detail: Object.assign({
      mode: 'BalancedPlateVR',
      difficulty: state ? state.difficulty : '',
      sessionId: state ? state.sessionId : ''
    }, payload || {})
  }));
}

function emitSessionEnd (reason) {
  if (!state) return;

  const elapsedSec = Math.round((nowMs() - state.startTimeMs) / 1000);

  ROOT.dispatchEvent(new CustomEvent('hha:session', {
    detail: {
      sessionId: state.sessionId,
      mode: 'BalancedPlateVR',
      difficulty: state.difficulty,
      durationSecPlayed: elapsedSec,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.minisCleared,
      miniTotal: state.minisTotal,
      reason
    }
  }));

  ROOT.dispatchEvent(new CustomEvent('hha:end', {
    detail: {
      mode: 'BalancedPlateVR',
      difficulty: state.difficulty,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      platesDone: state.platesDone,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.minisCleared,
      miniTotal: state.minisTotal,
      groupCounts: state.groupCounts.slice(),
      reason,
      startTimeIso: new Date(state.startTimeWall).toISOString(),
      endTimeIso: new Date().toISOString()
    }
  }));
}

// ---------- Coach ----------
function coach (text) {
  if (!text) return;
  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: { text }
  }));
}

// ---------- MISS ----------
function registerMiss (opts) {
  if (!state) return;
  state.misses += 1;
  state.combo = 0;
  emitStat();

  ROOT.dispatchEvent(new CustomEvent('hha:miss', {
    detail: Object.assign({
      mode: 'BalancedPlateVR',
      difficulty: state.difficulty
    }, opts || {})
  }));

  coach('ระวังของไม่ดีเข้าจาน ลองโฟกัสหมู่ผัก ผลไม้ และนมให้มากขึ้นนะ 😌');
}

// ---------- HIT ----------
function handleHit (el) {
  if (!state || !state.running || !el) return;

  const t = activeTargets.find(x => x.el === el);
  if (!t) return;

  const isGood = !!t.isGood;
  const group  = t.group | 0;

  const center = centerOfEl(t.el);
  // FX
  Particles.burstAt(center.x, center.y, {
    color: isGood ? '#22c55e' : '#f97316',
    count: isGood ? 18 : 14
  });
  Particles.scorePop(center.x, center.y, isGood ? '+ HIT' : '- MISS', {
    good: isGood,
    judgment: isGood ? 'GOOD' : 'JUNK'
  });

  // scale pop
  const baseScale = parseFloat(t.el.dataset.scale || '1') || 1;
  const baseRot   = parseFloat(t.el.dataset.rot   || '0') || 0;
  t.el.dataset.scale = String(baseScale * (isGood ? 1.35 : 1.2));
  t.el.dataset.rot   = String(baseRot + (isGood ? 40 : -30));
  applyTargetTransform(t.el);
  t.el.style.opacity = '0';

  setTimeout(() => removeTargetNow(t), 140);

  const timeFromStartMs = nowMs() - state.startTimeMs;

  // score & combo
  if (isGood) {
    state.combo += 1;
    if (state.combo > state.comboMax) state.comboMax = state.combo;
    state.goodHits += 1;

    let base = 50;
    if (group === 3 || group === 4) base = 60;
    if (state.feverActive) base = Math.round(base * 1.4);

    state.score += base;

    // group counts (ทั้งเกม)
    if (group >= 1 && group <= 5) {
      state.groupCounts[group - 1] += 1;
      if (group === 3 || group === 4) {
        state.vegFruitCount += 1;
      }
      // plate-level counts
      state.currentPlateCounts[group - 1] += 1;
    }

    applyFeverDelta(+8);
  } else {
    // junk
    state.junkHits += 1;

    if (state.shieldCount > 0 && state.runMode === 'play') {
      setShieldCount(state.shieldCount - 1);
      coach('ใช้โล่กันไว้แล้ว ครั้งหน้าพยายามเลี่ยงของขยะนะ 🛡️');
    } else {
      registerMiss({ eventType: 'hit-junk' });
    }
    applyFeverDelta(-18);
  }

  // จานสมดุล (ครบ 5 หมู่)
  const donePlate = state.currentPlateCounts.every(n => n > 0);
  if (donePlate) {
    state.platesDone += 1;
    state.currentPlateCounts = [0, 0, 0, 0, 0];

    const vw = ROOT.innerWidth || 800;
    const vh = ROOT.innerHeight || 600;
    const cx = vw * 0.5;
    const cy = vh * 0.6;

    Particles.burstAt(cx, cy, { color: '#22c55e', count: 24 });
    Particles.scorePop(cx, cy, '+ PLATE!', {
      good: true,
      judgment: 'Balanced Plate'
    });

    coach('เยี่ยมมาก! จานนี้ครบ 5 หมู่แล้ว 🍽️');
  }

  // ปรับ quest
  recalcQuestProgress();
  emitStat();

  // log event
  emitGameEvent({
    type: 'hit',
    timeFromStartMs,
    itemType: isGood ? 'good' : 'junk',
    emoji: t.el.textContent || '',
    group,
    totalScore: state.score,
    combo: state.combo,
    isGood: isGood
  });
}

// ---------- Expire target ----------
function expireTarget (t) {
  if (!t || t.removed) return;
  const wasGood = !!t.isGood;

  const center = centerOfEl(t.el);
  Particles.burstAt(center.x, center.y, {
    color: '#0f172a',
    count: 10
  });

  removeTargetNow(t);

  if (wasGood) {
    registerMiss({ eventType: 'expire-good' });
  }

  emitGameEvent({
    type: 'expire',
    itemType: wasGood ? 'good' : 'junk',
    emoji: t.emoji || '',
    totalScore: state.score,
    combo: state.combo
  });
}

// ---------- Adaptive difficulty (เฉพาะโหมด play) ----------
function maybeAdaptiveTuning () {
  if (!state) return;
  if (state.runMode !== 'play') return;

  const s = state;
  const diffConf = s.diffConf;

  const total = Math.max(1, s.goodHits + s.junkHits);
  const acc   = s.goodHits / total;

  let targetScale   = s.currScale;
  let spawnInterval = s.currSpawnInterval;

  if (acc > 0.75 && s.comboMax >= 8) {
    targetScale   = clamp(targetScale * 0.94, 0.70, diffConf.scale);
    spawnInterval = clamp(spawnInterval - 60, 600, diffConf.spawnInterval);
  } else if (acc < 0.5 || s.misses > 10) {
    targetScale   = clamp(targetScale * 1.06, diffConf.scale, 1.30);
    spawnInterval = clamp(spawnInterval + 80, diffConf.spawnInterval, 1300);
  }

  s.currScale = targetScale;
  s.currSpawnInterval = spawnInterval;

  activeTargets.forEach(t => {
    if (!t.el) return;
    t.el.dataset.scale = String(targetScale);
    applyTargetTransform(t.el);
  });
}

// ---------- Main loop ----------
function tick () {
  if (!state || !state.running) return;
  const now = nowMs();

  // spawn
  if (activeTargets.length < state.diffConf.maxActive && now >= state.nextSpawnAt) {
    spawnTarget();
    const interval = state.runMode === 'play'
      ? state.currSpawnInterval
      : state.diffConf.spawnInterval;
    state.nextSpawnAt = now + interval;
  }

  // life
  const lifeMs = state.diffConf.life;
  activeTargets.slice().forEach(t => {
    if (now - t.bornAt > lifeMs) {
      expireTarget(t);
    }
  });

  // adaptive
  maybeAdaptiveTuning();

  rafId = ROOT.requestAnimationFrame(tick);
}

// ---------- Stop ----------
function stopInternal (reason) {
  if (!state || !state.running) return;
  state.running = false;

  if (rafId) {
    ROOT.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (stopTimerId) {
    clearTimeout(stopTimerId);
    stopTimerId = null;
  }

  activeTargets.slice().forEach(removeTargetNow);
  activeTargets = [];

  emitStat();
  emitSessionEnd(reason || 'end');
}

// ---------- Public boot ----------
export function boot (opts = {}) {
  if (!DOC || !DOC.body) {
    console.error('[PlateVR] document not ready');
    return;
  }

  if (state && state.running) {
    stopInternal('restart');
  }

  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  const runMode = String(ROOT.HHA_RUNMODE || opts.runMode || 'play').toLowerCase() === 'research'
    ? 'research'
    : 'play';

  const diffConf = BASE_DIFF[diffKey] || BASE_DIFF.normal;
  const durationSec = clamp(opts.duration || 60, 20, 180);

  state = {
    running: true,
    runMode,
    difficulty: diffKey,
    diffConf,

    sessionId: makeSessionId(),
    startTimeMs: nowMs(),
    startTimeWall: Date.now(),

    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,

    platesDone: 0,
    currentPlateCounts: [0, 0, 0, 0, 0],
    groupCounts: [0, 0, 0, 0, 0],
    vegFruitCount: 0,

    goodHits: 0,
    junkHits: 0,

    feverValue: 0,
    feverActive: false,
    shieldCount: runMode === 'research' ? 0 : 3,

    goalsAll: [],
    minisAll: [],
    goalsCleared: 0,
    goalsTotal: 0,
    minisCleared: 0,
    minisTotal: 0,

    currScale: diffConf.scale,
    currSpawnInterval: diffConf.spawnInterval,
    nextSpawnAt: nowMs() + 900
  };

  const q = initQuests(runMode);
  state.goalsAll = q.goalsAll;
  state.minisAll = q.minisAll;
  recalcQuestProgress();

  // FEVER UI + Shield
  FeverUI.ensure();
  FeverUI.setFever(0);
  FeverUI.setActive(false);
  setShieldCount(state.shieldCount);

  // ปรับ effect เป็น emoji mode
  if (Particles.setShardMode) {
    Particles.setShardMode('emoji');
  }

  coach('จัดจานให้ครบ 5 หมู่ เลี่ยงของทอด ของหวาน แล้วลองทำให้ได้หลายจานที่สุดนะ 🍽️');

  emitStat();

  // schedule stop ตาม durationSec (สำรองเผื่อ timer ภายนอกไม่หยุด)
  if (stopTimerId) clearTimeout(stopTimerId);
  stopTimerId = setTimeout(() => {
    stopInternal('time-up');
  }, durationSec * 1000 + 300);

  // start loop
  if (rafId) ROOT.cancelAnimationFrame(rafId);
  rafId = ROOT.requestAnimationFrame(tick);
}

// ---------- Resize: ให้เป้าขยับตามจอ ----------
if (ROOT && ROOT.addEventListener) {
  ROOT.addEventListener('resize', () => {
    activeTargets.forEach(t => applyTargetTransform(t.el));
  });
}