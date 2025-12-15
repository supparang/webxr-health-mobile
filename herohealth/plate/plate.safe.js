// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — DOM Target Engine + Quest + Fever + Cloud Logger hooks
// ใช้ร่วมกับ: plate-vr.html, vr/ui-fever.js, vr/particles.js, vr/hha-cloud-logger.js

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

function shuffle (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeSessionId () {
  return 'plate-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

// ---------- External modules (Particles + Fever UI) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  {
    burstAt () {},
    scorePop () {}
  };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

// ---------- Difficulty ----------
const DIFF_TABLE = {
  easy: {
    baseScale: 1.18,
    lifeMs: 2200,
    spawnInterval: 950,
    maxActive: 3
  },
  normal: {
    baseScale: 1.00,
    lifeMs: 1900,
    spawnInterval: 820,
    maxActive: 4
  },
  hard: {
    baseScale: 0.88,
    lifeMs: 1700,
    spawnInterval: 700,
    maxActive: 5
  }
};

// ---------- Food pools ----------
const GOOD_FOODS = [
  // group1: ข้าวแป้ง
  { emoji: '🍚', group: 1 },
  { emoji: '🍞', group: 1 },
  { emoji: '🥖', group: 1 },
  // group2: โปรตีน
  { emoji: '🍗', group: 2 },
  { emoji: '🍖', group: 2 },
  { emoji: '🥚', group: 2 },
  // group3: ผัก
  { emoji: '🥦', group: 3 },
  { emoji: '🥕', group: 3 },
  { emoji: '🥬', group: 3 },
  // group4: ผลไม้
  { emoji: '🍎', group: 4 },
  { emoji: '🍌', group: 4 },
  { emoji: '🍇', group: 4 },
  // group5: นม
  { emoji: '🥛', group: 5 },
  { emoji: '🧀', group: 5 },
  { emoji: '🍦', group: 5 }
];

const JUNK_FOODS = [
  '🍟', '🍔', '🍕', '🍩', '🧋', '🥤', '🍰', '🍫'
];

// ---------- Quest templates ----------
const FIXED_GOALS = [
  {
    id: 'goal-plates-3',
    label: 'เสิร์ฟจานสมดุลให้ได้ 3 จาน',
    kind: 'plates',
    target: 3
  },
  {
    id: 'goal-veg-10',
    label: 'เก็บผัก (หมู่ 3) ให้ได้ 10 ชิ้น',
    kind: 'group3-total',
    target: 10
  }
];

const FIXED_MINIS = [
  {
    id: 'mini-fruit-5',
    label: 'เก็บผลไม้ (หมู่ 4) 5 ชิ้น',
    kind: 'group4-total',
    target: 5
  },
  {
    id: 'mini-milk-3',
    label: 'นม / ผลิตภัณฑ์นม (หมู่ 5) 3 ชิ้น',
    kind: 'group5-total',
    target: 3
  },
  {
    id: 'mini-nojunk-5',
    label: 'โฟกัสของดีติดกัน 5 ชิ้น (ไม่กดของไม่ดีเลย)',
    kind: 'nojunk-streak',
    target: 5
  }
];

// สำหรับโหมดเล่นธรรมดา: สุ่มจาก pool เดิมนี่แหละ
const GOAL_POOL = FIXED_GOALS;
const MINI_POOL = FIXED_MINIS;

// ---------- State ----------
let state = null;

// ---------- Camera yaw (สำคัญ: ตามกล้องก่อน) ----------
function getCameraYawDeg () {
  if (!state) return 0;

  const cam = state.camEl;
  const rig = state.rigEl;

  // 1) ใช้มุมจากกล้องก่อน (attachTouchLook หมุนตัวนี้)
  if (cam && cam.object3D && cam.object3D.rotation) {
    const y = cam.object3D.rotation.y || 0;
    return (y * 180) / Math.PI;
  }

  // 2) fallback ใช้มุมจาก rig ถ้ามี
  if (rig && rig.object3D && rig.object3D.rotation) {
    const y = rig.object3D.rotation.y || 0;
    return (y * 180) / Math.PI;
  }

  return 0;
}

function getTargetScale () {
  if (!state) return 1;
  const diff = DIFF_TABLE[state.difficultyKey] || DIFF_TABLE.normal;
  const base = diff.baseScale || 1;
  const adaptive = state.runMode === 'play' ? state.adaptiveScale : 1;
  return base * adaptive;
}

// ---------- Quests ----------
function cloneQuest (tpl) {
  return {
    id: tpl.id,
    label: tpl.label,
    kind: tpl.kind,
    target: tpl.target,
    prog: 0,
    done: false
  };
}

function setupQuests () {
  if (!state) return;

  const runMode = state.runMode;
  let goalsSrc = GOAL_POOL;
  let minisSrc = MINI_POOL;

  if (runMode === 'research') {
    // วิจัย → ใช้ชุด fix ทุกเกม
    state.goalsAll = FIXED_GOALS.map(cloneQuest);
    state.minisAll = FIXED_MINIS.map(cloneQuest);
  } else {
    // เล่นธรรมดา → สุ่ม goal 2, mini 3
    const gPicked = shuffle(goalsSrc).slice(0, 2).map(cloneQuest);
    const mPicked = shuffle(minisSrc).slice(0, 3).map(cloneQuest);
    state.goalsAll = gPicked;
    state.minisAll = mPicked;
  }

  state.goalsClearedCount = 0;
  state.minisClearedCount = 0;

  updateQuestProgressAndDispatch(true);
}

function computeQuestProg (q) {
  if (!state || !q) return 0;
  switch (q.kind) {
    case 'plates':
      return state.platesDone | 0;
    case 'group1-total':
      return state.totalCounts[0] | 0;
    case 'group2-total':
      return state.totalCounts[1] | 0;
    case 'group3-total':
      return state.totalCounts[2] | 0;
    case 'group4-total':
      return state.totalCounts[3] | 0;
    case 'group5-total':
      return state.totalCounts[4] | 0;
    case 'nojunk-streak':
      return state.noJunkStreak | 0;
    default:
      return 0;
  }
}

function makeQuestHint (goal, mini) {
  if (!goal && !mini) return '';
  if (goal && goal.kind === 'plates') {
    return 'จัดจานให้ครบตาม Goal ก่อน แล้วตามด้วย Mini';
  }
  if (mini && mini.kind === 'nojunk-streak') {
    return 'อย่ากดของไม่ดีเลย จะได้สตรีคยาว ๆ';
  }
  return '';
}

function updateQuestProgressAndDispatch (forceDispatch) {
  if (!state) return;

  let goalsCleared = 0;
  let minisCleared = 0;

  state.goalsAll.forEach((q) => {
    q.prog = computeQuestProg(q);
    q.done = q.prog >= q.target;
    if (q.done) goalsCleared++;
  });

  state.minisAll.forEach((q) => {
    q.prog = computeQuestProg(q);
    q.done = q.prog >= q.target;
    if (q.done) minisCleared++;
  });

  const changed =
    forceDispatch ||
    goalsCleared !== state.goalsClearedCount ||
    minisCleared !== state.minisClearedCount;

  state.goalsClearedCount = goalsCleared;
  state.minisClearedCount = minisCleared;

  if (!changed) return;

  const currentGoal = state.goalsAll.find((q) => !q.done) || null;
  const currentMini = state.minisAll.find((q) => !q.done) || null;

  const allQuestDone =
    state.goalsAll.length > 0 &&
    state.minisAll.length > 0 &&
    goalsCleared >= state.goalsAll.length &&
    minisCleared >= state.minisAll.length;

  const hint = makeQuestHint(currentGoal, currentMini);

  ROOT.dispatchEvent(
    new CustomEvent('quest:update', {
      detail: {
        goal: currentGoal,
        mini: currentMini,
        goalsAll: state.goalsAll,
        minisAll: state.minisAll,
        hint
      }
    })
  );

  if (allQuestDone && state.running) {
    endGame('all-quests');
  }
}

// ---------- Fever ----------
function updateFever (delta) {
  if (!state) return;
  const prev = state.feverValue;
  let v = clamp(prev + delta, 0, 100);
  const wasActive = state.feverActive;
  let nowActive = wasActive;

  if (!wasActive && v >= 100) {
    nowActive = true;
  } else if (wasActive && v <= 20) {
    nowActive = false;
  }

  state.feverValue = v;
  state.feverActive = nowActive;

  try {
    FeverUI.setFever(v / 100);
    FeverUI.setFeverActive(nowActive);
  } catch (e) {
    // ignore
  }

  if (nowActive && !wasActive) {
    ROOT.dispatchEvent(
      new CustomEvent('hha:fever', {
        detail: { state: 'start', value: v }
      })
    );
  } else if (!nowActive && wasActive) {
    ROOT.dispatchEvent(
      new CustomEvent('hha:fever', {
        detail: { state: 'end', value: v }
      })
    );
  }
}

function updateShield (delta) {
  if (!state) return;
  state.shield = clamp((state.shield || 0) + delta, 0, 3);
  try {
    FeverUI.setShield(state.shield);
  } catch (e) {
    // ignore
  }
}

// Adaptive เฉพาะโหมดเล่นธรรมดา
function updateAdaptiveOnHit (isGood) {
  if (!state || state.runMode !== 'play') return;

  if (isGood) {
    state.adaptScore = clamp((state.adaptScore || 0) + 1, -6, 6);
  } else {
    state.adaptScore = clamp((state.adaptScore || 0) - 2, -6, 6);
  }

  const factor = 1 + state.adaptScore * 0.06;
  state.adaptiveScale = clamp(factor, 0.7, 1.3);
}

// ---------- Targets ----------
function createTargetElement () {
  const el = DOC.createElement('div');
  el.className = 'hha-target';
  // ป้องกัน pseudo-element หรือ bg แปลก ๆ
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.zIndex = '360';
  el.style.pointerEvents = 'auto';
  el.style.userSelect = 'none';
  el.style.touchAction = 'manipulation';
  return el;
}

function spawnTarget () {
  if (!state || !DOC) return;
  if (!state.running) return;

  const diff = DIFF_TABLE[state.difficultyKey] || DIFF_TABLE.normal;
  const activeCount = state.targets.filter((t) => t && t.active).length;
  if (activeCount >= diff.maxActive) return;

  const isGood = Math.random() < 0.7; // 70% ของดี 30% ของไม่ดี
  let foodEmoji = '❓';
  let group = 0;

  if (isGood) {
    const f = pickOne(GOOD_FOODS, GOOD_FOODS[0]);
    foodEmoji = f.emoji;
    group = f.group;
  } else {
    foodEmoji = pickOne(JUNK_FOODS, '🍟');
    group = 0;
  }

  const el = createTargetElement();
  el.textContent = foodEmoji;
  if (isGood) {
    el.classList.add('hha-target-good');
  } else {
    el.classList.add('hha-target-bad');
  }

  const angWorld = Math.random() * 360; // มุมในโลก
  const radiusPx = 220 + Math.random() * 80;
  const vOffset = (Math.random() * 2 - 1) * 60; // ขยับขึ้นลงนิดหน่อย

  const now = performance.now();
  const lifeMs = diff.lifeMs;

  const t = {
    id: 't-' + now.toString(36) + '-' + Math.floor(Math.random() * 1e5).toString(36),
    el,
    good: isGood,
    group,
    angWorld,
    radiusPx,
    vOffsetPx: vOffset,
    bornAt: now,
    lifeMs,
    active: true,
    screenX: 0,
    screenY: 0
  };

  el.addEventListener(
    'click',
    (ev) => {
      ev.stopPropagation();
      hitTarget(t);
    },
    false
  );

  DOC.body.appendChild(el);
  state.targets.push(t);
  applyTargetTransform(t);
}

function applyTargetTransform (t) {
  if (!state || !t || !t.active) return;
  const el = t.el;
  if (!el) return;

  const yaw = state.cameraYawDeg || 0;
  const relDeg = t.angWorld - yaw;
  const rad = (relDeg * Math.PI) / 180;

  const cx = ROOT.innerWidth / 2;
  const cy = ROOT.innerHeight / 2;

  const r = t.radiusPx;
  const x = cx + Math.cos(rad) * r;
  const y = cy + Math.sin(rad) * (r * 0.55) + t.vOffsetPx;

  t.screenX = x;
  t.screenY = y;

  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const scale = getTargetScale();
  el.style.transform = 'translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
}

function destroyTarget (t, reason) {
  if (!t || !t.active) return;
  t.active = false;
  if (t.el && t.el.parentNode) {
    t.el.parentNode.removeChild(t.el);
  }
}

function expireTarget (t) {
  if (!state || !t || !t.active) return;
  // ถ้าปล่อยให้หมดเวลา: ถือว่า miss ถ้าเป็นของดี
  if (t.good) {
    registerMiss('expire');
  }
  destroyTarget(t, 'expire');
}

// ---------- Stats & Logging ----------
function pushStat () {
  if (!state) return;
  ROOT.dispatchEvent(
    new CustomEvent('hha:stat', {
      detail: {
        score: state.score,
        combo: state.combo,
        misses: state.misses,
        platesDone: state.platesDone,
        totalCounts: state.totalCounts.slice()
      }
    })
  );
}

function logGameEvent (payload) {
  payload = payload || {};
  ROOT.dispatchEvent(
    new CustomEvent('hha:event', {
      detail: Object.assign(
        {
          sessionId: state ? state.sessionId : '',
          mode: 'BalancedPlateVR',
          difficulty: state ? state.difficultyKey : '',
          runMode: state ? state.runMode : ''
        },
        payload
      )
    })
  );
}

function logSessionSummary (reason) {
  if (!state) return;
  ROOT.dispatchEvent(
    new CustomEvent('hha:session', {
      detail: {
        type: 'end',
        sessionId: state.sessionId,
        mode: 'BalancedPlateVR',
        difficulty: state.difficultyKey,
        durationSecPlayed: Math.round((performance.now() - state.startTimeMs) / 1000),
        scoreFinal: state.score,
        comboMax: state.comboMax,
        misses: state.misses,
        goalsCleared: state.goalsClearedCount,
        goalsTotal: state.goalsAll.length,
        miniCleared: state.minisClearedCount,
        miniTotal: state.minisAll.length,
        nPlateDone: state.platesDone,
        totalCounts: state.totalCounts.slice(),
        reason: reason || 'time-up',
        gameVersion: 'PlateVR-2025-12'
      }
    })
  );
}

// ---------- Core scoring ----------
function registerMiss (why) {
  if (!state || !state.running) return;

  // ถ้ามี shield → ใช้ shield ป้องกัน 1 ครั้ง
  if (state.shield > 0) {
    updateShield(-1);
    // reset สตรีคของดี แต่ไม่เพิ่ม miss
    state.combo = 0;
    state.noJunkStreak = 0;
    updateFever(-5);
    pushStat();
    logGameEvent({
      type: 'blocked',
      difficulty: state.difficultyKey,
      totalScore: state.score,
      combo: state.combo,
      extra: why || ''
    });
    return;
  }

  state.misses += 1;
  state.combo = 0;
  state.noJunkStreak = 0;

  updateFever(-10);
  pushStat();

  ROOT.dispatchEvent(
    new CustomEvent('hha:miss', {
      detail: { reason: why || 'hit-junk' }
    })
  );
}

function checkBalancedPlate () {
  if (!state) return;

  // จานสมดุล = มีอย่างน้อย 1 ชิ้นในทั้ง 5 หมู่
  const c = state.currentPlateCounts;
  if (
    c[0] >= 1 &&
    c[1] >= 1 &&
    c[2] >= 1 &&
    c[3] >= 1 &&
    c[4] >= 1
  ) {
    state.platesDone += 1;
    // ใช้ของชุดนี้ 1 ชิ้นต่อหมู่ แล้วเก็บ remainder สำหรับจานหน้า
    for (let i = 0; i < 5; i++) {
      c[i] = Math.max(0, c[i] - 1);
    }
    // เสิร์ฟจาน → ได้ shield 1 ช่อง
    updateShield(+1);
    updateFever(+12);

    ROOT.dispatchEvent(
      new CustomEvent('hha:coach', {
        detail: {
          text: 'เยี่ยมมาก! จานสมดุลอีก 1 จานแล้ว 🍽️'
        }
      })
    );
  }
}

function hitTarget (t) {
  if (!state || !state.running || !t || !t.active) return;

  const isGood = !!t.good;
  const group = t.group | 0;
  const x = t.screenX || (ROOT.innerWidth / 2);
  const y = t.screenY || (ROOT.innerHeight / 2);

  destroyTarget(t, 'hit');

  let scoreDelta = 0;

  if (isGood) {
    scoreDelta = state.feverActive ? 200 : 100;
    state.score += scoreDelta;
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);
    state.noJunkStreak += 1;

    // นับหมู่
    if (group >= 1 && group <= 5) {
      state.totalCounts[group - 1] += 1;
      state.currentPlateCounts[group - 1] += 1;
      checkBalancedPlate();
    }

    updateFever(+8);
    updateAdaptiveOnHit(true);

    // Effect ตรงตำแหน่งเป้า
    if (Particles && Particles.burstAt) {
      Particles.burstAt(x, y, {
        color: '#22c55e',
        count: 16
      });
    }
    if (Particles && Particles.scorePop) {
      Particles.scorePop(x, y, '+' + scoreDelta, {
        judgment: 'GOOD',
        good: true
      });
    }
  } else {
    // junk
    registerMiss('hit-junk');
    updateAdaptiveOnHit(false);

    if (Particles && Particles.burstAt) {
      Particles.burstAt(x, y, {
        color: '#f97316',
        count: 10
      });
    }
    if (Particles && Particles.scorePop) {
      Particles.scorePop(x, y, 'MISS', {
        judgment: 'JUNK',
        good: false
      });
    }
  }

  pushStat();
  updateQuestProgressAndDispatch(false);

  logGameEvent({
    type: isGood ? 'hit-good' : 'hit-junk',
    emoji: t.el ? t.el.textContent || '' : '',
    itemType: isGood ? 'good' : 'junk',
    group,
    totalScore: state.score,
    combo: state.combo,
    isGood,
    goalProgress: state.goalsClearedCount,
    miniProgress: state.minisClearedCount
  });
}

// ---------- Main loop ----------
function tick () {
  if (!state || !state.running) return;

  state.cameraYawDeg = getCameraYawDeg();

  const now = performance.now();
  const diff = DIFF_TABLE[state.difficultyKey] || DIFF_TABLE.normal;

  // อัปเดตเป้า + check timeout
  for (let i = 0; i < state.targets.length; i++) {
    const t = state.targets[i];
    if (!t || !t.active) continue;

    if (now - t.bornAt > diff.lifeMs) {
      expireTarget(t);
      continue;
    }
    applyTargetTransform(t);
  }

  // ถ้าใช้ internal timer (backup กรณีไม่มี hha:time) → จบเกมตาม duration
  if (state.durationSec > 0 && state.internalEndTimeMs > 0) {
    if (now >= state.internalEndTimeMs && state.running) {
      endGame('time-up');
      return;
    }
  }

  state.rafId = ROOT.requestAnimationFrame(tick);
}

// ---------- End game ----------
function endGame (reason) {
  if (!state || !state.running) return;
  state.running = false;

  if (state.spawnTimerId) {
    ROOT.clearInterval(state.spawnTimerId);
    state.spawnTimerId = null;
  }
  if (state.rafId) {
    ROOT.cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  // เคลียร์เป้า
  state.targets.forEach((t) => {
    if (t && t.active) destroyTarget(t, 'end');
  });

  updateQuestProgressAndDispatch(true);
  pushStat();

  const allQuest =
    state.goalsAll.length > 0 &&
    state.minisAll.length > 0 &&
    state.goalsClearedCount >= state.goalsAll.length &&
    state.minisClearedCount >= state.minisAll.length;

  const detail = {
    scoreFinal: state.score,
    comboMax: state.comboMax,
    misses: state.misses,
    goalsCleared: state.goalsClearedCount,
    goalsTotal: state.goalsAll.length,
    miniCleared: state.minisClearedCount,
    miniTotal: state.minisAll.length,
    platesDone: state.platesDone,
    groupCounts: state.totalCounts.slice(),
    allCleared: allQuest,
    mode: 'BalancedPlateVR',
    difficulty: state.difficultyKey,
    durationSec: state.durationSec,
    sessionId: state.sessionId,
    reason: reason || 'time-up'
  };

  // log สำหรับ Google Sheet
  logSessionSummary(reason || 'time-up');

  // ส่งให้ HUD สรุปผล
  ROOT.dispatchEvent(
    new CustomEvent('hha:end', {
      detail
    })
  );
}

// ---------- Public boot ----------
export function boot (opts = {}) {
  if (!DOC) return;

  // ถ้ามี state เดิมกำลังรันอยู่ → ปิดก่อน
  if (state && state.running) {
    try {
      endGame('restart');
    } catch (e) {
      // ignore
    }
  }

  const diffKey = String(opts.difficulty || opts.diff || 'normal').toLowerCase();
  const runModeParam = String(ROOT.HHA_RUNMODE || 'play').toLowerCase();
  const runMode = runModeParam === 'research' ? 'research' : 'play';
  const duration = Number(opts.duration || opts.durationSec || 60) || 60;

  const rigEl = DOC.querySelector('#rig');
  const camEl = DOC.querySelector('#plate-camera');

  state = {
    rigEl,
    camEl,
    running: true,
    difficultyKey: DIFF_TABLE[diffKey] ? diffKey : 'normal',
    runMode,
    sessionId: makeSessionId(),
    startTimeMs: performance.now(),
    durationSec: duration,
    internalEndTimeMs: performance.now() + duration * 1000,

    targets: [],
    rafId: null,
    spawnTimerId: null,

    cameraYawDeg: 0,

    // stats
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    platesDone: 0,
    totalCounts: [0, 0, 0, 0, 0],
    currentPlateCounts: [0, 0, 0, 0, 0],
    noJunkStreak: 0,

    // quest
    goalsAll: [],
    minisAll: [],
    goalsClearedCount: 0,
    minisClearedCount: 0,

    // fever/shield/adapt
    feverValue: 0,
    feverActive: false,
    shield: 0,
    adaptiveScale: 1,
    adaptScore: 0
  };

  try {
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setFeverActive(false);
    FeverUI.setShield(0);
  } catch (e) {
    // ignore
  }

  // session start log
  ROOT.dispatchEvent(
    new CustomEvent('hha:session', {
      detail: {
        type: 'start',
        sessionId: state.sessionId,
        mode: 'BalancedPlateVR',
        difficulty: state.difficultyKey,
        durationSec: state.durationSec,
        runMode: state.runMode,
        gameVersion: 'PlateVR-2025-12'
      }
    })
  );

  // quests
  setupQuests();

  // spawn loop
  const diff = DIFF_TABLE[state.difficultyKey] || DIFF_TABLE.normal;
  state.spawnTimerId = ROOT.setInterval(() => {
    if (!state || !state.running) return;
    spawnTarget();
  }, diff.spawnInterval);

  // listen hha:time เพื่อจบเกมตอน 0 วิ
  ROOT.addEventListener(
    'hha:time',
    (e) => {
      if (!state || !state.running) return;
      const d = e.detail || {};
      const sec = d.sec | 0;
      if (sec <= 0) {
        endGame('time-up');
      }
    },
    { once: false }
  );

  // จบเกมเมื่อ tab หาย
  ROOT.document.addEventListener('visibilitychange', () => {
    if (ROOT.document.hidden && state && state.running) {
      endGame('tab-hidden');
    }
  });

  // เริ่ม loop
  state.rafId = ROOT.requestAnimationFrame(tick);

  // push stat เริ่มเกม
  pushStat();

  // coach แรกเริ่ม
  ROOT.dispatchEvent(
    new CustomEvent('hha:coach', {
      detail: {
        text: 'จัดจานให้ครบ 5 หมู่ เลี่ยงของทอด น้ำหวาน ของหวาน แล้วเสิร์ฟให้ได้หลายจานที่สุดนะ 🍽️'
      }
    })
  );
}