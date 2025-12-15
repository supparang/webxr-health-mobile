// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — Game Engine (จัดเต็ม 1–5 ฟีเจอร์สนุก + วิจัยพร้อมใช้)
//
// - DOM เป้า emoji (.hha-target) แบบ GoodJunk-style
// - โหมด play → เป้า adaptive ตามฝีมือ + goal / mini สุ่ม
// - โหมด research → เป้าคงที่ตาม diff + goal 2 / mini 3 fix
// - Plate streak, Rush wave, Perfect Plate, Special Orders, Shield + Fever
//
// ต้องใช้ร่วมกับ:
//   - plate-vr.html (ที่เรียก bootPlate({ difficulty, duration }))
//   - vr/ui-fever.js  (FeverUI global หรือ GAME_MODULES.FeverUI)
//   - vr/particles.js (Particles global หรือ GAME_MODULES.Particles)
//   - vr/hha-cloud-logger.js (ฟัง hha:session / hha:event / hha:stat / hha:end)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ---------- Fever & Particles ----------
const FeverUI = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
                ROOT.FeverUI ||
                {
                  ensureFeverBar () {},
                  setFever (v) {},
                  setFeverActive (on) {},
                  setShield (n) {}
                };

const Particles = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
                  ROOT.Particles ||
                  {
                    burstAt () {},
                    scorePop () {},
                    hitFx () {}
                  };

// ---------- Helpers ----------
function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function randInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickOne (arr, fallback = null) {
  if (!Array.isArray(arr) || !arr.length) return fallback;
  return arr[Math.floor(Math.random() * arr.length)];
}
function nowIso () {
  return new Date().toISOString();
}

// ---------- Difficulty base (size + interval + life) ----------
const DIFF_BASE = {
  easy:   { size: 86, interval: 1100, life: 1900 },
  normal: { size: 72, interval: 900,  life: 1700 },
  hard:   { size: 62, interval: 780,  life: 1550 }
};

// ---------- Food pools ----------
const GROUP_EMOJI = {
  1: ['🍚','🍙','🍞','🥖','🥯'],
  2: ['🍗','🥩','🍳','🥚','🥓'],
  3: ['🥦','🥕','🥬','🫛','🥒'],
  4: ['🍎','🍌','🍊','🍇','🍉'],
  5: ['🥛','🧀','🍦','🥣']
};

const JUNK_EMOJI  = ['🍩','🍟','🍕','🍰','🥤','🍫'];
const SHIELD_EMOJI = ['🛡️'];
const GOLD_EMOJI   = ['🍎','🥕','🍇','🍓'].map(e => e + '✨'); // special score/fever

// ---------- Game state (active instance) ----------
let ACTIVE = null;

// main boot
export function boot (opts = {}) {
  // ปิด instance เก่าถ้ามี
  if (ACTIVE && ACTIVE.cleanup) {
    ACTIVE.cleanup();
  }

  const diffKey = String(opts.difficulty || 'normal').toLowerCase();
  const duration = Number(opts.duration || 60) || 60;
  const runMode = (ROOT.HHA_RUNMODE === 'research' || opts.runMode === 'research')
    ? 'research'
    : 'play';

  const diffBase = DIFF_BASE[diffKey] || DIFF_BASE.normal;

  const state = {
    running: true,
    ended: false,

    runMode,
    diffKey,
    duration,

    // difficulty live values (play → adaptive, research → fix)
    targetSize: diffBase.size,
    spawnInterval: diffBase.interval,
    targetLife: diffBase.life,

    // adaptive score
    totalShots: 0,
    totalHits: 0,
    totalMissLike: 0, // miss + expire + hit junk
    adaptStepCounter: 0,

    // score
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    platesDone: 0,

    // groups (ทั้งเกม)
    groupTotals: [0,0,0,0,0], // index 0-4 = group 1-5
    junkTotal: 0,

    // plate-level
    currentPlate: {
      counts: [0,0,0,0,0],
      junk: 0,
      totalItems: 0,
      plateIndex: 1,
      perfectFlags: {
        noJunk: true,
        allFive: false
      }
    },

    // streak / rush / special
    plateStreak: 0,
    rushActive: false,
    rushAnnounced: false,
    rushThresholdSec: 15,

    // fever / shield
    fever: 0,
    feverMax: 100,
    feverActive: false,
    shield: 0,

    // quest system
    quest: null,

    // special plate orders
    specialOrderPlan: [],   // per plate index
    specialOrderActive: null,
    specialOrderCleared: 0,

    // DOM
    targetLayer: null,
    spawnTimer: null,
    lifeTimers: new Map(),

    // session id
    sessionId: 'plate-' + Math.random().toString(36).slice(2),

    // debug
    startedAt: nowIso()
  };

  // ---------- DOM layer ----------
  let layer = DOC.querySelector('#plate-target-layer');
  if (!layer) {
    // ถ้าไม่มี layer ให้สร้าง div ติดเต็มจออยู่ใต้ HUD
    layer = DOC.createElement('div');
    layer.id = 'plate-target-layer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '360'; // ใต้ HUD (650) แต่เหนือพื้น
    DOC.body.appendChild(layer);
  }
  state.targetLayer = layer;

  // ---------- Quest set ----------
  state.quest = buildQuestSet(runMode, diffKey);
  emitQuestUpdate(state);

  // ---------- Special order plan ----------
  state.specialOrderPlan = buildSpecialOrderPlan(runMode, duration);

  // ---------- Fever & Shield init ----------
  safeCall(() => FeverUI.ensureFeverBar && FeverUI.ensureFeverBar());
  safeCall(() => FeverUI.setFever && FeverUI.setFever(0));
  safeCall(() => FeverUI.setFeverActive && FeverUI.setFeverActive(false));
  safeCall(() => FeverUI.setShield && FeverUI.setShield(0));

  // ---------- bind global time listener (Rush & time-up) ----------
  bindGlobalTimeHook();

  ACTIVE = state;

  // ---------- start spawn loop ----------
  scheduleNextSpawn(state, 400); // ดีเลย์นิดหนึ่งหลัง 3-2-1-Go

  // ---------- initial coach ----------
  dispatchCoach('จัดจานให้ครบ 5 หมู่ เลี่ยงของทอด ของหวาน แล้วเสิร์ฟให้ได้หลายจานที่สุดนะ 🍽️');

  // ---------- log session start ----------
  dispatchSessionEvent('start', state, {});

  // cleanup function
  state.cleanup = function cleanup () {
    state.running = false;
    state.ended = true;
    if (state.spawnTimer) {
      clearTimeout(state.spawnTimer);
      state.spawnTimer = null;
    }
    state.lifeTimers.forEach(t => clearTimeout(t));
    state.lifeTimers.clear();
    clearTargets(state);
  };
}

// ---------- Global time hook (Rush + end) ----------
let TIME_HOOK_BOUND = false;
function bindGlobalTimeHook () {
  if (TIME_HOOK_BOUND) return;
  TIME_HOOK_BOUND = true;

  ROOT.addEventListener('hha:time', (e) => {
    const st = ACTIVE;
    if (!st || !st.running || st.ended) return;
    const d = e.detail || {};
    const sec = (d.sec | 0);

    if (sec <= st.rushThresholdSec && !st.rushActive) {
      st.rushActive = true;
      if (!st.rushAnnounced) {
        st.rushAnnounced = true;
        dispatchCoach('PLATE RUSH!! ช่วงท้ายเกม เร่งจัดจานดี ๆ ให้ไวเลย ⏱️🔥');
        // effect HUD
        Particles.scorePop(
          window.innerWidth / 2,
          window.innerHeight * 0.18,
          'PLATE RUSH!!',
          { judgment: 'Bonus score +50% เมื่อเสิร์ฟจาน', good: true }
        );
      }
    }

    if (sec <= 0 && !st.ended) {
      // ให้ engine เป็นคนจบเกมด้วย summary
      stopGame(st, 'time-up');
    }
  });
}

// ---------- Quest builder ----------
function buildQuestSet (runMode, diffKey) {
  const goals = [];
  const minis = [];

  if (runMode === 'research') {
    // ---- FIXED GOALS 2 (ทุกเกม) ----
    goals.push({
      id: 'g-plates-A',
      label: 'เสิร์ฟจานสมดุลเกรด A ขึ้นไปอย่างน้อย 2 จาน',
      prog: 0,
      target: 2,
      done: false,
      kind: 'plate-grade-A'
    });
    goals.push({
      id: 'g-perfect',
      label: 'ทำ PERFECT PLATE (ครบ 5 หมู่ ไม่มี junk) อย่างน้อย 1 จาน',
      prog: 0,
      target: 1,
      done: false,
      kind: 'perfect-plate'
    });

    // ---- FIXED MINI 3 ----
    minis.push({
      id: 'm-veg-fruit',
      label: 'สะสมผัก + ผลไม้รวมกันให้ได้ 12 ชิ้น',
      prog: 0,
      target: 12,
      done: false,
      kind: 'veg-fruit-total'
    });
    minis.push({
      id: 'm-miss-limit',
      label: 'MISS ได้ไม่เกิน 5 ครั้ง',
      prog: 0,
      target: 5,
      done: false,
      kind: 'miss-limit'
    });
    minis.push({
      id: 'm-order',
      label: 'ทำ Special Order จากโค้ชสำเร็จ 1 ครั้ง',
      prog: 0,
      target: 1,
      done: false,
      kind: 'special-order'
    });
  } else {
    // ---- PLAY MODE: random goals & minis ----
    const goalPool = [
      {
        id: 'g-plates-3',
        label: 'เสิร์ฟจานสมดุลอย่างน้อย 3 จานในเกมนี้',
        target: 3,
        kind: 'plates-total'
      },
      {
        id: 'g-plates-A',
        label: 'เสิร์ฟจานเกรด A ขึ้นไปให้ได้ 2 จาน',
        target: 2,
        kind: 'plate-grade-A'
      },
      {
        id: 'g-perfect',
        label: 'ทำ PERFECT PLATE ให้ได้อย่างน้อย 1 จาน',
        target: 1,
        kind: 'perfect-plate'
      },
      {
        id: 'g-streak',
        label: 'ทำ Plate Streak (จานดีต่อเนื่อง) อย่างน้อย 3 จาน',
        target: 3,
        kind: 'plate-streak'
      }
    ];

    const miniPool = [
      {
        id: 'm-veg-fruit',
        label: 'สะสมผัก + ผลไม้รวมกันให้ได้ 10 ชิ้น',
        target: 10,
        kind: 'veg-fruit-total'
      },
      {
        id: 'm-miss-limit',
        label: 'MISS ได้ไม่เกิน 6 ครั้ง',
        target: 6,
        kind: 'miss-limit'
      },
      {
        id: 'm-gold',
        label: 'เก็บผลไม้/ผักพิเศษ (ทอง) อย่างน้อย 1 ชิ้น',
        target: 1,
        kind: 'gold-items'
      },
      {
        id: 'm-order',
        label: 'ทำ Special Order จากโค้ชสำเร็จ 1 ครั้ง',
        target: 1,
        kind: 'special-order'
      },
      {
        id: 'm-rush-plates',
        label: 'ช่วง Plate Rush เสิร์ฟจานให้ได้ 2 จาน',
        target: 2,
        kind: 'rush-plates'
      }
    ];

    // random 2 goals, 3 mini
    const gCopy = goalPool.slice();
    while (goals.length < 2 && gCopy.length) {
      const g = gCopy.splice(randInt(0, gCopy.length - 1), 1)[0];
      goals.push({
        id: g.id,
        label: g.label,
        prog: 0,
        target: g.target,
        done: false,
        kind: g.kind
      });
    }

    const mCopy = miniPool.slice();
    while (minis.length < 3 && mCopy.length) {
      const m = mCopy.splice(randInt(0, mCopy.length - 1), 1)[0];
      minis.push({
        id: m.id,
        label: m.label,
        prog: 0,
        target: m.target,
        done: false,
        kind: m.kind
      });
    }
  }

  return {
    goalsAll: goals,
    minisAll: minis
  };
}

// ---------- Special Order plan ----------
function buildSpecialOrderPlan (runMode, durationSec) {
  // ให้มีโอกาส 1–3 orders ทั้งเกม ขึ้นกับระยะเวลา
  const maxOrders = durationSec >= 80 ? 3 : (durationSec >= 60 ? 2 : 1);
  const orders = [];

  const pool = [
    { id: 'order-no-fried', plateIndex: 2, type: 'no-fried' },
    { id: 'order-vegfruit', plateIndex: 3, type: 'veg-fruit-3' },
    { id: 'order-milk',     plateIndex: 4, type: 'need-milk' }
  ];

  if (runMode === 'research') {
    // fix ลำดับ
    return pool.slice(0, maxOrders);
  }

  // play → random plate index 2–5
  const usedIndexes = new Set();
  const finalPlan = [];
  const poolTypes = ['no-fried','veg-fruit-3','need-milk'];

  for (let i = 0; i < maxOrders; i++) {
    let idx = randInt(2, 5);
    let guard = 0;
    while (usedIndexes.has(idx) && guard < 10) {
      idx = randInt(2, 5);
      guard++;
    }
    usedIndexes.add(idx);
    const t = poolTypes[i] || pickOne(poolTypes);
    finalPlan.push({
      id: `order-${t}-${idx}`,
      plateIndex: idx,
      type: t
    });
  }
  return finalPlan;
}

// ---------- HUD + events ----------
function emitStat (st) {
  const detail = {
    score: st.score,
    combo: st.combo,
    misses: st.misses,
    platesDone: st.platesDone,
    totalCounts: st.groupTotals.slice()
  };
  ROOT.dispatchEvent(new CustomEvent('hha:stat', { detail }));
}

function emitQuestUpdate (st) {
  if (!st.quest) return;
  const goalsAll = st.quest.goalsAll || [];
  const minisAll = st.quest.minisAll || [];

  const goal = goalsAll.find(q => !q.done) || goalsAll[goalsAll.length - 1] || null;
  const mini = minisAll.find(q => !q.done) || minisAll[minisAll.length - 1] || null;

  ROOT.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal,
      mini,
      goalsAll,
      minisAll,
      hint: buildQuestHint(goal, mini)
    }
  }));
}

function buildQuestHint (goal, mini) {
  if (goal && goal.kind === 'plate-streak') {
    return 'พยายามทำจานดี ๆ ต่อเนื่อง อย่าให้มี junk หลุดเข้าไป';
  }
  if (mini && mini.kind === 'veg-fruit-total') {
    return 'เล็งเก็บผัก + ผลไม้ให้เยอะเป็นพิเศษในจานแต่ละจาน';
  }
  if (mini && mini.kind === 'miss-limit') {
    return 'อย่าตีมั่ว เลือกตีเฉพาะของที่ดีต่อสุขภาพ';
  }
  if (mini && mini.kind === 'gold-items') {
    return 'ระวังผลไม้/ผักเรืองแสง ถ้าเห็นรีบเก็บเลย!';
  }
  if (goal && goal.kind === 'perfect-plate') {
    return 'ลองจัดจานให้ครบ 5 หมู่แบบไม่มี junk เลยสักจาน';
  }
  return '';
}

function dispatchCoach (text) {
  if (!text) return;
  ROOT.dispatchEvent(new CustomEvent('hha:coach', {
    detail: { text }
  }));
}

// session/event สำหรับ Cloud Logger
function dispatchSessionEvent (type, st, extra) {
  const detail = Object.assign({
    type: type,
    mode: 'BalancedPlateVR',
    difficulty: st.diffKey,
    sessionId: st.sessionId,
    durationSecPlayed: st.duration || '',
    scoreFinal: st.score,
    comboMax: st.comboMax,
    misses: st.misses,
    platesDone: st.platesDone,
    goalsCleared: countDone(st.quest && st.quest.goalsAll),
    goalsTotal: (st.quest && st.quest.goalsAll ? st.quest.goalsAll.length : 0),
    miniCleared: countDone(st.quest && st.quest.minisAll),
    miniTotal: (st.quest && st.quest.minisAll ? st.quest.minisAll.length : 0),
    groupCounts: st.groupTotals.slice(),
    junkTotal: st.junkTotal,
    startTimeIso: st.startedAt,
    endTimeIso: nowIso()
  }, extra || {});

  ROOT.dispatchEvent(new CustomEvent('hha:session', { detail }));
}

function countDone (arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.filter(x => x && x.done).length;
}

function dispatchGameEvent (st, data) {
  const detail = Object.assign({
    mode: 'BalancedPlateVR',
    difficulty: st.diffKey,
    sessionId: st.sessionId
  }, data || {});
  ROOT.dispatchEvent(new CustomEvent('hha:event', { detail }));
}

// ---------- Target spawn / lifetime ----------
function scheduleNextSpawn (st, delayOverride) {
  if (!st.running || st.ended) return;
  const d = clamp(delayOverride != null ? delayOverride : st.spawnInterval, 350, 2000);
  st.spawnTimer = setTimeout(() => {
    st.spawnTimer = null;
    spawnTarget(st);
    scheduleNextSpawn(st);
  }, d);
}

function clearTargets (st) {
  if (!st.targetLayer) return;
  st.lifeTimers.forEach(t => clearTimeout(t));
  st.lifeTimers.clear();
  st.targetLayer.innerHTML = '';
}

// สุ่มชนิดของเป้า
function pickTargetType (st) {
  // base: good vs junk 80/20
  const r = Math.random();
  if (r < 0.75) return 'good';
  if (r < 0.9)  return 'junk';

  // 10% เป็น shield / gold
  const r2 = Math.random();
  if (r2 < 0.5) return 'shield';
  return 'gold';
}

function spawnTarget (st) {
  if (!st.targetLayer) return;

  const tType = pickTargetType(st);

  let emoji = '🍽️';
  let groupIndex = null; // 0-4 for group 1-5
  let isGood = false;
  let isJunk = false;
  let isShield = false;
  let isGold = false;

  if (tType === 'good') {
    const g = randInt(1, 5);
    groupIndex = g - 1;
    emoji = pickOne(GROUP_EMOJI[g]) || '🍽️';
    isGood = true;
  } else if (tType === 'junk') {
    emoji = pickOne(JUNK_EMOJI) || '🍔';
    isJunk = true;
  } else if (tType === 'shield') {
    emoji = pickOne(SHIELD_EMOJI) || '🛡️';
    isShield = true;
  } else if (tType === 'gold') {
    emoji = pickOne(GOLD_EMOJI) || '🍎✨';
    isGood = true;
    isGold = true;
    // ให้เป็นกลุ่มผักหรือผลไม้
    const g = pickOne([3,4]) || 3;
    groupIndex = g - 1;
  }

  const el = DOC.createElement('button');
  el.className = 'hha-target';
  el.type = 'button';
  el.textContent = emoji;
  el.style.pointerEvents = 'auto';
  el.style.border = 'none';
  el.style.background = 'transparent';
  el.style.padding = '0';
  el.style.outline = 'none';

  const baseSize = st.targetSize;
  el.style.width  = baseSize + 'px';
  el.style.height = baseSize + 'px';
  el.style.fontSize = Math.round(baseSize * 0.62) + 'px';

  // random screen pos (ปลอด HUD)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const marginTop = vh * 0.15;
  const marginBottom = vh * 0.18;

  const x = randInt(Math.round(vw * 0.15), Math.round(vw * 0.85));
  const y = randInt(Math.round(marginTop), Math.round(vh - marginBottom));

  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  if (isGood || isGold || isShield) {
    el.classList.add('hha-target-good');
  }
  if (isJunk) {
    el.classList.add('hha-target-bad');
  }

  el.dataset.type = tType;
  if (groupIndex != null) {
    el.dataset.group = String(groupIndex);
  }

  const id = 't-' + Math.random().toString(36).slice(2);
  el.dataset.tid = id;

  st.targetLayer.appendChild(el);

  // life timer
  const lifeMs = st.targetLife;
  const lifeTimer = setTimeout(() => {
    st.lifeTimers.delete(id);
    if (!el.isConnected) return;
    // expired → นับเป็น miss-like (เฉพาะ good/gold)
    if (st.running && !st.ended && (isGood || isGold)) {
      handleExpire(st, { el, tType, groupIndex, isGood, isGold });
    }
    safeRemove(el);
  }, lifeMs);

  st.lifeTimers.set(id, lifeTimer);

  el.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!st.running || st.ended) return;

    const lt = st.lifeTimers.get(id);
    if (lt) {
      clearTimeout(lt);
      st.lifeTimers.delete(id);
    }
    safeRemove(el);

    handleHit(st, {
      tType,
      groupIndex,
      isGood,
      isJunk,
      isShield,
      isGold,
      screenX: x,
      screenY: y
    });
  }, { passive: false });
}

function safeRemove (el) {
  if (!el) return;
  if (el.remove) el.remove();
  else if (el.parentNode) el.parentNode.removeChild(el);
}

// ---------- Hit / Expire ----------
function handleExpire (st, info) {
  // นับเป็น miss-like
  st.totalShots++;
  st.totalMissLike++;
  st.combo = 0;
  st.misses++;

  emitStat(st);
  updateMissQuest(st);
  updateAdaptive(st);

  dispatchGameEvent(st, {
    type: 'target-expire',
    itemType: info.tType,
    lane: '',
    rtMs: '',
    isGood: info.isGood || info.isGold || false,
    judgment: 'EXPIRE',
    totalScore: st.score,
    combo: st.combo
  });
}

function handleHit (st, info) {
  st.totalShots++;
  const { tType, groupIndex, isGood, isJunk, isShield, isGold, screenX, screenY } = info;

  let scoreDelta = 0;
  let goodHit = false;

  // base judgment label
  let judgment = 'HIT';

  if (isShield) {
    st.shield = clamp(st.shield + 1, 0, 3);
    safeCall(() => FeverUI.setShield && FeverUI.setShield(st.shield));
    scoreDelta = 80;
    judgment = 'SHIELD +1';
    Particles.scorePop(screenX, screenY, '+SHIELD', { judgment, good: true });
  } else if (isGood || isGold) {
    goodHit = true;
    st.combo++;
    st.comboMax = Math.max(st.comboMax, st.combo);
    scoreDelta = isGold ? 200 : 120;
    if (st.feverActive) {
      scoreDelta = Math.round(scoreDelta * 1.4);
    }
    judgment = isGold ? 'GOLD!' : (st.combo >= 10 ? 'EXCELLENT' : (st.combo >= 5 ? 'GOOD' : 'HIT'));
    Particles.burstAt(screenX, screenY, { color: '#22c55e', count: 12 });
    Particles.scorePop(screenX, screenY, '+' + scoreDelta, { judgment, good: true });

    // plate-level update
    if (groupIndex != null) {
      st.currentPlate.counts[groupIndex] += 1;
      st.groupTotals[groupIndex] += 1;
    }
    st.currentPlate.totalItems += 1;
    if (isGold) {
      // นับเป็นผัก/ผลไม้พิเศษ
      st.currentPlate.hasGold = true;
      bumpMiniProgress(st, 'gold-items', 1);
      addFever(st, 20);
    } else {
      addFever(st, 10);
    }
  } else if (isJunk) {
    // ถ้ามี shield → ใช้ shield แทน miss
    if (st.shield > 0) {
      st.shield -= 1;
      safeCall(() => FeverUI.setShield && FeverUI.setShield(st.shield));
      judgment = 'BLOCKED';
      Particles.scorePop(screenX, screenY, 'BLOCK', { judgment, good: false });
    } else {
      st.combo = 0;
      st.misses++;
      scoreDelta = -120;
      st.totalMissLike++;
      st.junkTotal++;
      st.currentPlate.junk += 1;
      st.currentPlate.totalItems += 1;
      st.currentPlate.perfectFlags.noJunk = false;
      Particles.burstAt(screenX, screenY, { color: '#f97316', count: 10 });
      Particles.scorePop(screenX, screenY, String(scoreDelta), { judgment: 'JUNK', good: false });
      updateMissQuest(st);
    }
    addFever(st, -12);
  }

  if (goodHit) {
    st.totalHits++;
  }

  st.score = Math.max(0, st.score + scoreDelta);

  // Quest: veg+fruit
  if (groupIndex === 2 || groupIndex === 3) { // group 3,4 index (2,3)
    bumpMiniProgress(st, 'veg-fruit-total', 1);
  }

  // Plate serve condition: เมื่อเก็บของครบ ~6–7 ชิ้น/จาน
  if (st.currentPlate.totalItems >= 6) {
    servePlate(st);
  }

  // Rush plates mini quest
  if (st.rushActive && st.justServedPlateInRush) {
    bumpMiniProgress(st, 'rush-plates', 1);
    st.justServedPlateInRush = false;
  }

  emitStat(st);
  updateAdaptive(st);

  // FEVER event
  ROOT.dispatchEvent(new CustomEvent('hha:score', {
    detail: {
      score: st.score,
      combo: st.combo,
      misses: st.misses
    }
  }));

  dispatchGameEvent(st, {
    type: 'hit',
    itemType: tType,
    emoji: '', // could log emoji ifต้องการ
    lane: '',
    isGood: goodHit,
    judgment,
    totalScore: st.score,
    combo: st.combo
  });
}

// ---------- Fever ----------
function addFever (st, delta) {
  st.fever = clamp(st.fever + delta, 0, st.feverMax);
  const ratio = st.fever / st.feverMax;
  safeCall(() => FeverUI.setFever && FeverUI.setFever(st.fever));

  const wasActive = st.feverActive;
  const nowActive = ratio >= 0.7;
  st.feverActive = nowActive;

  if (!wasActive && nowActive) {
    safeCall(() => FeverUI.setFeverActive && FeverUI.setFeverActive(true));
    ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'start' } }));
  } else if (wasActive && !nowActive) {
    safeCall(() => FeverUI.setFeverActive && FeverUI.setFeverActive(false));
    ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { state: 'end' } }));
  }
}

// ---------- Adaptive difficulty (play mode เท่านั้น) ----------
function updateAdaptive (st) {
  if (st.runMode === 'research') return;
  st.adaptStepCounter++;
  if (st.adaptStepCounter < 8) return;
  st.adaptStepCounter = 0;

  const pHit = (st.totalHits > 0 && st.totalShots > 0)
    ? (st.totalHits / st.totalShots)
    : 0.5;

  const base = DIFF_BASE[st.diffKey] || DIFF_BASE.normal;

  if (pHit >= 0.85) {
    // เก่ง → เร่งให้โหดขึ้น (เร็วขึ้น เล็กลง)
    st.spawnInterval = clamp(st.spawnInterval - 80, base.interval - 200, base.interval + 80);
    st.targetSize = clamp(st.targetSize - 4, base.size - 16, base.size);
  } else if (pHit <= 0.6) {
    // ยังค่อนข้างยาก → ผ่อน
    st.spawnInterval = clamp(st.spawnInterval + 80, base.interval - 80, base.interval + 220);
    st.targetSize = clamp(st.targetSize + 4, base.size, base.size + 18);
  } else {
    // กลาง ๆ → ดึงกลับใกล้ base
    st.spawnInterval += (base.interval - st.spawnInterval) * 0.2;
    st.targetSize += (base.size - st.targetSize) * 0.2;
  }
}

// ---------- Plate evaluation / serve ----------
function servePlate (st) {
  const plate = st.currentPlate;
  const counts = plate.counts;
  const groupsFilled = counts.filter(c => c > 0).length;
  const junk = plate.junk;
  const total = plate.totalItems;

  let grade = 'C';

  if (groupsFilled >= 5 && junk === 0) {
    grade = 'SSS';
    plate.perfectFlags.allFive = true;
  } else if (groupsFilled >= 5 && junk <= 1) {
    grade = 'SS';
  } else if (groupsFilled >= 4 && junk <= 1) {
    grade = 'S';
  } else if (groupsFilled >= 4 && junk <= 2) {
    grade = 'A';
  } else if (groupsFilled >= 3 && junk <= 2) {
    grade = 'B';
  }

  // plate score bonus
  let plateScore = groupsFilled * 40 - junk * 50;
  if (plateScore < 40) plateScore = 40;

  // Rush bonus
  if (st.rushActive) {
    plateScore = Math.round(plateScore * 1.5);
    st.justServedPlateInRush = true;
  }

  // Perfect plate bonus
  let isPerfect = false;
  if (groupsFilled >= 5 && junk === 0) {
    plateScore += 250;
    isPerfect = true;
  }

  // Plate streak: นับเฉพาะจานเกรด A ขึ้นไป และ junk <=1
  if (grade === 'A' || grade === 'S' || grade === 'SS' || grade === 'SSS') {
    if (junk <= 1) {
      st.plateStreak++;
    } else {
      st.plateStreak = 0;
    }
  } else {
    st.plateStreak = 0;
  }

  // Plate streak → เติม fever หน่อย
  if (st.plateStreak >= 2) {
    addFever(st, 10);
  }
  if (st.plateStreak >= 3) {
    addFever(st, 20);
  }

  st.score += plateScore;
  st.platesDone++;

  // Quest progress
  bumpGoalProgress(st, 'plates-total', 1);
  if (grade === 'A' || grade === 'S' || grade === 'SS' || grade === 'SSS') {
    bumpGoalProgress(st, 'plate-grade-A', 1);
  }
  if (isPerfect) {
    bumpGoalProgress(st, 'perfect-plate', 1);
  }
  bumpGoalProgress(st, 'plate-streak', st.plateStreak);

  // Special order check
  let orderSuccess = false;
  if (st.specialOrderActive) {
    orderSuccess = checkSpecialOrderSuccess(st.specialOrderActive, plate);
    if (orderSuccess) {
      st.specialOrderCleared++;
      bumpMiniProgress(st, 'special-order', 1);
      dispatchCoach('เยี่ยมมาก! ทำออเดอร์พิเศษของโค้ชสำเร็จแล้ว 🎯');
      Particles.scorePop(
        window.innerWidth / 2,
        window.innerHeight * 0.22,
        'SPECIAL ORDER CLEAR!',
        { judgment: 'Bonus!', good: true }
      );
      // โบนัสเล็กน้อย
      st.score += 150;
      addFever(st, 15);
    } else {
      dispatchCoach('ออเดอร์พิเศษจานนี้ยังไม่ตรงตามที่โค้ชสั่ง ลองในจานถัดไปนะ 😊');
    }
    st.specialOrderActive = null;
  }

  // update HUD stat & quest
  emitStat(st);
  emitQuestUpdate(st);

  // coach feedback plate
  let coachText = '';
  if (isPerfect) {
    coachText = 'PERFECT PLATE! ครบ 5 หมู่ไม่มี junk เลย สุดยอดมาก 🥇🍽️';
  } else if (grade === 'S' || grade === 'SS' || grade === 'SSS') {
    coachText = 'จานนี้สมดุลดีมาก แทบจะสมบูรณ์แบบแล้ว ลองเลี่ยง junk เพิ่มอีกนิด!';
  } else if (grade === 'A') {
    coachText = 'จานเกรด A แล้ว! ถ้าลด junk ได้อีกหน่อยอาจกลายเป็นจานระดับ S เลยนะ 💪';
  } else {
    coachText = 'จานนี้พอใช้ได้ แต่ลองเพิ่มผัก/ผลไม้ให้มากขึ้น และลดของทอดดูนะ 😌';
  }
  dispatchCoach(coachText);

  // particles celebrate plate
  Particles.burstAt(
    window.innerWidth / 2,
    window.innerHeight * 0.3,
    { color: '#22c55e', count: 18 }
  );
  Particles.scorePop(
    window.innerWidth / 2,
    window.innerHeight * 0.3,
    `PLATE ${st.platesDone} • ${grade}`,
    { judgment: 'SCORE +' + plateScore, good: true }
  );

  // แจ้ง plate streak ถ้าสูง
  if (st.plateStreak >= 2) {
    Particles.scorePop(
      window.innerWidth / 2,
      window.innerHeight * 0.18,
      `STREAK x${st.plateStreak}!`,
      { judgment: 'Plate Streak', good: true }
    );
  }

  // เตรียม plate ใหม่
  const nextIndex = st.currentPlate.plateIndex + 1;
  st.currentPlate = {
    counts: [0,0,0,0,0],
    junk: 0,
    totalItems: 0,
    plateIndex: nextIndex,
    perfectFlags: { noJunk: true, allFive: false },
    hasGold: false
  };

  // check special order สำหรับจานถัดไป
  const nextOrder = st.specialOrderPlan.find(o => o.plateIndex === nextIndex);
  if (nextOrder) {
    st.specialOrderActive = nextOrder;
    announceSpecialOrder(nextOrder);
  }
}

// ---------- Special Order ----------
function announceSpecialOrder (order) {
  if (!order) return;
  let text = '';
  if (order.type === 'no-fried') {
    text = 'ออเดอร์พิเศษ! จานต่อไปห้ามมีของทอดเลยนะ 🍟❌';
  } else if (order.type === 'veg-fruit-3') {
    text = 'ออเดอร์พิเศษ! จานต่อไปต้องมีผัก + ผลไม้อย่างน้อยรวม 3 ชิ้น 🥦🍎';
  } else if (order.type === 'need-milk') {
    text = 'ออเดอร์พิเศษ! จานต่อไปต้องมีนมหรือโยเกิร์ตอย่างน้อย 1 ชิ้น 🥛';
  }
  dispatchCoach(text);
}

function checkSpecialOrderSuccess (order, plate) {
  const counts = plate.counts || [0,0,0,0,0];
  if (order.type === 'no-fried') {
    // ไม่มี junk เลย
    return plate.junk === 0;
  }
  if (order.type === 'veg-fruit-3') {
    const veg = counts[2] || 0;
    const fruit = counts[3] || 0;
    return (veg + fruit) >= 3;
  }
  if (order.type === 'need-milk') {
    const milk = counts[4] || 0;
    return milk >= 1;
  }
  return false;
}

// ---------- Quest progress helpers ----------
function bumpGoalProgress (st, kind, delta) {
  if (!st.quest || !Array.isArray(st.quest.goalsAll)) return;
  st.quest.goalsAll.forEach(q => {
    if (!q || q.done || q.kind !== kind) return;
    q.prog = (q.prog || 0) + (delta || 0);
    if (q.prog >= q.target) {
      q.prog = q.target;
      q.done = true;
    }
  });
}

function bumpMiniProgress (st, kind, delta) {
  if (!st.quest || !Array.isArray(st.quest.minisAll)) return;
  st.quest.minisAll.forEach(q => {
    if (!q || q.done || q.kind !== kind) return;
    q.prog = (q.prog || 0) + (delta || 0);
    if (q.prog >= q.target) {
      q.prog = q.target;
      q.done = true;
    }
  });
}

function updateMissQuest (st) {
  // miss-limit → ใช้ prog = misses (max target)
  if (!st.quest) return;
  (st.quest.minisAll || []).forEach(q => {
    if (!q || q.kind !== 'miss-limit') return;
    q.prog = st.misses;
    if (q.prog <= q.target) {
      // ยังไม่ fail ถือว่าทำได้
      // (ไม่ mark done อัตโนมัติ ปล่อยให้จบเกมแล้วดูจากค่า)
    } else {
      // ถ้าเกิน target ถือว่าทำไม่สำเร็จ (ไม่ต้องทำอะไรเพิ่ม แค่ค่าเลย)
    }
  });
  emitQuestUpdate(st);
}

// ---------- Stop game + summary ----------
function stopGame (st, reason) {
  if (!st || st.ended) return;
  st.running = false;
  st.ended = true;

  if (st.spawnTimer) {
    clearTimeout(st.spawnTimer);
    st.spawnTimer = null;
  }
  st.lifeTimers.forEach(t => clearTimeout(t));
  st.lifeTimers.clear();

  clearTargets(st);

  const goalsAll = (st.quest && st.quest.goalsAll) || [];
  const minisAll = (st.quest && st.quest.minisAll) || [];
  const goalsCleared = countDone(goalsAll);
  const goalsTotal   = goalsAll.length;
  const miniCleared  = countDone(minisAll);
  const miniTotal    = minisAll.length;

  // dispatch end summary → HUD + Logger ใช้
  ROOT.dispatchEvent(new CustomEvent('hha:end', {
    detail: {
      mode: 'BalancedPlateVR',
      difficulty: st.diffKey,
      sessionId: st.sessionId,
      reason: reason || 'manual',

      scoreFinal: st.score,
      comboMax: st.comboMax,
      misses: st.misses,
      platesDone: st.platesDone,

      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      groupCounts: st.groupTotals.slice(),

      // ให้ใช้ร่วมกับ GoodJunk HUD computeGrade ได้
      goalsTotalForGrade: goalsTotal,
      miniTotalForGrade: miniTotal
    }
  }));

  dispatchSessionEvent('end', st, { reason });
}

// ---------- Utility ----------
function safeCall (fn) {
  try { fn && fn(); } catch (_) {}
}