// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — DOM Emoji Targets + Quest + FEVER + Logger
// - ตัด FX สี่เหลี่ยมจาก Particles เดิม (ทำให้ burstAt/scorePop เป็น no-op)
// - ใช้ FX วงกลมแตก + ข้อความเด้ง (ไม่ใช่สี่เหลี่ยม)
// - เป้า DOM emoji หมุนตามมุมมอง (อ่าน yaw จาก #rig / #plate-camera)
// - โหมด play: diff ตาม easy/normal/hard + adaptive ขนาดเป้า/ความถี่
// - โหมด research: diff คงที่ ไม่ adaptive
// - Goal 2 + Mini quest 3
//   - play mode: สุ่ม goal/mini
//   - research mode: ชุด fix เหมือนกันทุกเกม
// - ยิง hha:stat, quest:update, hha:event, hha:session, hha:end ให้ HUD + Cloud Logger

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document || null;

// ---------- ปิด FX สี่เหลี่ยมจาก Particles เดิม ----------
(function disableOldParticles () {
  try {
    if (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) {
      ROOT.GAME_MODULES.Particles.burstAt  = function () {};
      ROOT.GAME_MODULES.Particles.scorePop = function () {};
    }
    if (ROOT.Particles) {
      ROOT.Particles.burstAt  = function () {};
      ROOT.Particles.scorePop = function () {};
    }
  } catch (_) {}
})();

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

// ---------- FX ใหม่ (ไม่ใช้สี่เหลี่ยม) ----------
function spawnCircleBurst (x, y, isGood) {
  if (!DOC) return;
  const n = isGood ? 14 : 10;
  for (let i = 0; i < n; i++) {
    const el = DOC.createElement('div');
    const size = 6 + Math.random() * 6;
    const ang  = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    const dx   = Math.cos(ang) * dist;
    const dy   = Math.sin(ang) * dist;

    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '700';
    el.style.opacity = '0.95';
    el.style.transform = 'translate(-50%, -50%) translate(0px,0px)';
    el.style.background = isGood
      ? 'radial-gradient(circle at 30% 30%, rgba(187,247,208,1), rgba(34,197,94,0.1))'
      : 'radial-gradient(circle at 30% 30%, rgba(254,202,202,1), rgba(248,113,113,0.1))';
    el.style.boxShadow = isGood
      ? '0 0 10px rgba(34,197,94,0.9)'
      : '0 0 10px rgba(248,113,113,0.9)';
    el.style.transition = 'transform 0.38s ease-out, opacity 0.38s ease-out';

    DOC.body.appendChild(el);

    setTimeout(() => {
      el.style.transform =
        'translate(-50%, -50%) translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      el.style.opacity = '0';
    }, 16);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 420);
  }
}

function spawnScorePop (x, y, text, isGood) {
  if (!DOC) return;
  const el = DOC.createElement('div');
  el.textContent = text;

  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.transform = 'translate(-50%, -50%) translateY(0px)';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '701';
  el.style.fontSize = '20px';
  el.style.fontWeight = '700';
  el.style.fontFamily =
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  el.style.color = isGood ? '#bbf7d0' : '#fecaca';
  el.style.textShadow =
    '0 0 8px rgba(15,23,42,1), 0 0 18px rgba(15,23,42,0.95)';
  el.style.opacity = '0.98';
  el.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';

  DOC.body.appendChild(el);

  setTimeout(() => {
    el.style.transform = 'translate(-50%, -50%) translateY(-40px)';
    el.style.opacity = '0';
  }, 16);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 520);
}

// ---------- Difficulty ----------
const BASE_DIFF = {
  easy:   { spawnInterval: 1100, life: 1900, scale: 1.15, maxActive: 3 },
  normal: { spawnInterval: 900,  life: 1700, scale: 1.00, maxActive: 4 },
  hard:   { spawnInterval: 750,  life: 1500, scale: 0.88, maxActive: 5 }
};

// ---------- Emoji ----------
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
  { key: 'plate2', label: 'ทำจานสมดุลให้ครบ 2 จาน', type: 'goal', target: 2 },
  { key: 'plate3', label: 'ทำจานสมดุลให้ครบ 3 จาน', type: 'goal', target: 3 },
  { key: 'veg10',  label: 'เก็บผัก+ผลไม้ 10 ชิ้น',  type: 'goal', target: 10 }
];

const MINI_POOL = [
  { key: 'combo8',   label: 'ทำคอมโบต่อเนื่องให้ถึง 8',      type: 'mini', target: 8 },
  { key: 'grain10',  label: 'เก็บหมู่ข้าว-แป้ง 10 ชิ้น',     type: 'mini', target: 10 },
  { key: 'protein8', label: 'เก็บหมู่โปรตีน 8 ชิ้น',         type: 'mini', target: 8 },
  { key: 'milk5',    label: 'เก็บหมู่นม 5 ชิ้น',             type: 'mini', target: 5 }
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

// ---------- Global state ----------
let state = null;
let activeTargets = [];
let rafId = null;
let stopTimerId = null;

// ---------- อ่าน yaw จาก #rig (ถ้าไม่มีค่อยใช้ #plate-camera) ----------
function getCameraYawDeg () {
  if (!state) return 0;
  const rig = state.rigEl;
  const cam = state.camEl;
  const target = (rig && rig.object3D) ? rig : cam;

  if (!target || !target.object3D) return 0;
  const rot = target.object3D.rotation;
  const y = rot && typeof rot.y === 'number' ? rot.y : 0;
  return y * 180 / Math.PI;
}

// ---------- วางเป้าให้หมุนตามมุมมอง ----------
function applyTargetTransform (el) {
  if (!el) return;
  const vw = ROOT.innerWidth || 800;
  const vh = ROOT.innerHeight || 600;
  const cx = vw * 0.5;
  const cy = vh * 0.5;

  const worldAngle = parseFloat(el.dataset.worldAngle || '0') || 0;
  const yawDeg = state ? (state.cameraYawDeg || 0) : 0;

  // กล้องหันขวา (yaw เพิ่ม) → ของในโลกควรเลื่อนไปทางซ้าย ⇒ ใช้ worldAngle - yaw
  const screenAngleDeg = worldAngle - yawDeg;
  const rad = screenAngleDeg * Math.PI / 180;

  const radius = parseFloat(el.dataset.radius || '180') || 180;
  const x = cx + Math.cos(rad) * radius;
  const y = cy + Math.sin(rad) * radius * 0.65;
  const scale = parseFloat(el.dataset.scale || '1') || 1;

  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ')';
}

// ---------- สร้าง / ลบเป้า ----------
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
  el.dataset.scale  = String(state.currScale || diffConf.scale);

  const baseAngle = Math.random() * 360;
  const radius    = 170 + Math.random() * 40;
  el.dataset.worldAngle = String(baseAngle);
  el.dataset.radius     = String(radius);

  applyTargetTransform(el);

  el.addEventListener('click', (ev) => {
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

// ---------- FEVER + Shield ----------
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
  ROOT.setFever && ROOT.setFever(nextVal);

  const active = nextVal >= 60;
  state.feverActive = active;
  ROOT.setFeverActive && ROOT.setFeverActive(active);

  if (active && !prevActive) {
    emitFeverEvent('start');
  } else if (!active && prevActive) {
    emitFeverEvent('end');
  }
}

function setShieldCount (n) {
  if (!state) return;
  state.shieldCount = clamp(n, 0, 9);
  ROOT.setShield && ROOT.setShield(state.shieldCount);
}

// ---------- Quest ----------
function initQuests (runMode) {
  let goalsAll;
  let minisAll;

  if (runMode === 'research') {
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
    goalsAll = pickRandomSubset(GOAL_POOL, 2).map(cloneQuest);
    minisAll = pickRandomSubset(MINI_POOL, 3).map(cloneQuest);
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
    if (q.key === 'veg10')  q.prog = s.vegFruitCount;
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
      goalsAll,
      minisAll,
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

// ---------- Logging ----------
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

  // FX ใหม่ (วงกลม + ข้อความ) — ไม่มีสี่เหลี่ยม
  spawnCircleBurst(center.x, center.y, isGood);
  spawnScorePop(center.x, center.y, isGood ? '+ HIT' : 'MISS', isGood);

  const baseScale = parseFloat(t.el.dataset.scale || '1') || 1;
  t.el.dataset.scale = String(baseScale * (isGood ? 1.3 : 1.15));
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

    if (group >= 1 && group <= 5) {
      state.groupCounts[group - 1] += 1;
      if (group === 3 || group === 4) {
        state.vegFruitCount += 1;
      }
      state.currentPlateCounts[group - 1] += 1;
    }

    applyFeverDelta(+8);
  } else {
    state.junkHits += 1;

    if (state.shieldCount > 0 && state.runMode === 'play') {
      setShieldCount(state.shieldCount - 1);
      coach('ใช้โล่กันไว้แล้ว ครั้งหน้าพยายามเลี่ยงของขยะนะ 🛡️');
    } else {
      registerMiss({ eventType: 'hit-junk' });
    }
    applyFeverDelta(-18);
  }

  // Balanced plate
  const donePlate = state.currentPlateCounts.every(n => n > 0);
  if (donePlate) {
    state.platesDone += 1;
    state.currentPlateCounts = [0, 0, 0, 0, 0];

    const vw = ROOT.innerWidth || 800;
    const vh = ROOT.innerHeight || 600;
    const cx = vw * 0.5;
    const cy = vh * 0.6;

    spawnCircleBurst(cx, cy, true);
    spawnScorePop(cx, cy, 'BALANCED PLATE!', true);

    coach('เยี่ยมมาก! จานนี้ครบ 5 หมู่แล้ว 🍽️');
  }

  // quest + HUD
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
    isGood
  });
}

// ---------- Expire ----------
function expireTarget (t) {
  if (!t || t.removed) return;
  const wasGood = !!t.isGood;

  const center = centerOfEl(t.el);
  spawnCircleBurst(center.x, center.y, false);
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

// ---------- Adaptive (เฉพาะ play mode) ----------
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

  // อัปเดตมุมกล้องจาก #rig / #plate-camera
  state.cameraYawDeg = getCameraYawDeg();

  // spawn
  if (activeTargets.length < state.diffConf.maxActive && now >= state.nextSpawnAt) {
    spawnTarget();
    const interval = state.runMode === 'play'
      ? state.currSpawnInterval
      : state.diffConf.spawnInterval;
    state.nextSpawnAt = now + interval;
  }

  // life + update pos ตาม yaw
  const lifeMs = state.diffConf.life;
  activeTargets.slice().forEach(t => {
    if (now - t.bornAt > lifeMs) {
      expireTarget(t);
    } else {
      applyTargetTransform(t.el);
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
  const runMode =
    String(ROOT.HHA_RUNMODE || opts.runMode || 'play').toLowerCase() === 'research'
      ? 'research'
      : 'play';

  const diffConf = BASE_DIFF[diffKey] || BASE_DIFF.normal;
  const durationSec = clamp(opts.duration || 60, 20, 180);

  const camEl = DOC.querySelector('#plate-camera') || null;
  const rigEl = DOC.querySelector('#rig') || null;

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
    nextSpawnAt: nowMs() + 900,

    camEl,
    rigEl,
    cameraYawDeg: 0
  };

  const q = initQuests(runMode);
  state.goalsAll = q.goalsAll;
  state.minisAll = q.minisAll;
  recalcQuestProgress();

  // FEVER UI + Shield
  ROOT.ensureFeverBar && ROOT.ensureFeverBar();
  ROOT.setFever && ROOT.setFever(0);
  ROOT.setFeverActive && ROOT.setFeverActive(false);
  setShieldCount(state.shieldCount);

  coach('จัดจานให้ครบ 5 หมู่ เลี่ยงของทอด ของหวาน แล้วลองทำให้ได้หลายจานที่สุดนะ 🍽️');

  emitStat();

  // stop by duration (กัน timer ภายนอกพลาด)
  if (stopTimerId) clearTimeout(stopTimerId);
  stopTimerId = setTimeout(() => {
    stopInternal('time-up');
  }, durationSec * 1000 + 300);

  if (rafId) ROOT.cancelAnimationFrame(rafId);
  rafId = ROOT.requestAnimationFrame(tick);
}

// ---------- Reposition on resize ----------
if (ROOT && ROOT.addEventListener) {
  ROOT.addEventListener('resize', () => {
    if (!activeTargets || !activeTargets.length) return;
    if (state) state.cameraYawDeg = getCameraYawDeg();
    activeTargets.forEach(t => applyTargetTransform(t.el));
  });
}