// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Fever + Particles + Judge FX)
// ใช้ร่วมกับ mode-factory.js + ui-fever.js + vr/particles.js

'use strict';

import { boot as factoryBoot } from '../mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles: /vr/particles.js (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  null;

// Fever UI: /vr/ui-fever.js (IIFE)
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

// -----------------------
// กลุ่มอาหาร (หมู่ละ ~7 อย่าง)
// -----------------------
const GRAIN = [
  '🍚','🍙','🍘','🍞','🥖','🥨','🥯'
];
const PROTEIN = [
  '🍗','🍖','🥩','🍳','🫘','🥚','🐟'
];
const VEG = [
  '🥦','🥕','🥬','🥒','🌽','🧅','🍅'
];
const FRUIT = [
  '🍎','🍌','🍇','🍓','🍊','🍍','🍑'
];
const MILK = [
  '🥛','🧀','🍨','🍦','🥞','🧈','🧋'
];

// รวมของดีทั้งหมด ไว้ให้ mode-factory ใช้สุ่ม
const GOOD_ALL = [
  ...GRAIN,
  ...PROTEIN,
  ...VEG,
  ...FRUIT,
  ...MILK
];

// ของขยะ
const JUNK = [
  '🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'
];

// power-ups
const STAR_EMOJI    = '⭐';
const DIAMOND_EMOJI = '💎';
const SHIELD_EMOJI  = '🛡️';

// -----------------------
// สถานะเกมภายใน
// -----------------------
let engineHandle = null;
let running = false;

const state = {
  diff: 'normal',
  score: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,
  hitsGood: 0,
  hitsJunk: 0,
  feverPct: 0,
  feverOn: false,
  shield: 0,

  // Quest summary (ให้ HUD ใช้)
  goalsAll: [],
  minisAll: [],
  // mark ว่าฉลองใหญ่ไปแล้วหรือยัง
  grandShown: false
};

// -----------------------
// Fever helpers
// -----------------------
function ensureFever() {
  if (!FeverUI) return;
  try {
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setShield(0);
    FeverUI.setFeverActive(false);
  } catch (err) {
    console.warn('[GroupsVR] ensureFever error:', err);
  }
}

function setFeverPct(pct) {
  let v = Number(pct);
  if (!Number.isFinite(v)) v = 0;
  v = Math.max(0, Math.min(100, v));
  state.feverPct = v;
  if (FeverUI && typeof FeverUI.setFever === 'function') {
    FeverUI.setFever(v);
  }
}

function addFever(delta) {
  setFeverPct(state.feverPct + delta);
  const wasOn = state.feverOn;
  const nowOn = state.feverPct >= 100;

  if (!wasOn && nowOn) {
    state.feverOn = true;
    if (FeverUI && FeverUI.setFeverActive) {
      FeverUI.setFeverActive(true);
    }
    window.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'start' }
    }));
  }

  // ถ้าตกลงมาต่ำกว่า 40% ค่อยปิดไฟ
  if (wasOn && state.feverPct < 40) {
    state.feverOn = false;
    if (FeverUI && FeverUI.setFeverActive) {
      FeverUI.setFeverActive(false);
    }
    window.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'end' }
    }));
  }
}

function setShieldCount(n) {
  let v = Number(n);
  if (!Number.isFinite(v)) v = 0;
  v = Math.max(0, Math.min(9, v));
  state.shield = v;
  if (FeverUI && typeof FeverUI.setShield === 'function') {
    FeverUI.setShield(v);
  }
}

// -----------------------
// Quest system แบบง่าย
// Goal = 2, Mini = 3
// -----------------------
function buildQuests() {
  const goals = [
    {
      id: 'g-all-groups',
      label: 'เก็บอาหารดีจากทั้ง 5 หมู่ให้ครบ',
      target: 20,
      prog: 0,
      done: false
    },
    {
      id: 'g-avoid-junk',
      label: 'เลี่ยงของขยะให้ได้มากที่สุด',
      target: 5, // ถ้าเก็บ junk น้อยกว่า 5 ถือว่าผ่าน
      prog: 0,
      done: false,
      isAvoid: true
    }
  ];

  const minis = [
    {
      id: 'm-grain',
      label: 'เก็บข้าว/แป้งอย่างน้อย 7 ชิ้น',
      target: 7,
      prog: 0,
      done: false,
      group: 'grain'
    },
    {
      id: 'm-protein',
      label: 'เก็บโปรตีนอย่างน้อย 7 ชิ้น',
      target: 7,
      prog: 0,
      done: false,
      group: 'protein'
    },
    {
      id: 'm-veg-fruit',
      label: 'เก็บผัก+ผลไม้รวมอย่างน้อย 10 ชิ้น',
      target: 10,
      prog: 0,
      done: false,
      group: 'veg-fruit'
    }
  ];

  state.goalsAll = goals;
  state.minisAll = minis;
  state.grandShown = false;

  emitQuestUpdate('เริ่มภารกิจ: เก็บอาหารดีให้ครบ 5 หมู่!');
}

function foodGroupOf(ch) {
  if (GRAIN.includes(ch))   return 'grain';
  if (PROTEIN.includes(ch)) return 'protein';
  if (VEG.includes(ch))     return 'veg';
  if (FRUIT.includes(ch))   return 'fruit';
  if (MILK.includes(ch))    return 'milk';
  return null;
}

function emitQuestUpdate(hintText) {
  const goalCurrent = state.goalsAll.find(g => !g.done) || null;
  const miniCurrent = state.minisAll.find(m => !m.done) || null;

  const detail = {
    goal: goalCurrent && {
      label: goalCurrent.label,
      prog: goalCurrent.prog,
      target: goalCurrent.target
    },
    mini: miniCurrent && {
      label: miniCurrent.label,
      prog: miniCurrent.prog,
      target: miniCurrent.target
    },
    hint: hintText || '',
    goalsAll: state.goalsAll.slice(),
    minisAll: state.minisAll.slice()
  };

  window.dispatchEvent(new CustomEvent('quest:update', { detail }));
}

function maybeQuestToast(type, item) {
  if (!item || item._toastShown) return;
  item._toastShown = true;

  window.dispatchEvent(new CustomEvent('hha:quest-clear', {
    detail: {
      type,
      label: item.label || ''
    }
  }));
}

function checkQuestsOnGoodHit(ch) {
  const grp = foodGroupOf(ch);
  const isFruitOrVeg = grp === 'veg' || grp === 'fruit';

  // goal 1: นับทุกอาหารดี
  const gAll = state.goalsAll.find(g => g.id === 'g-all-groups');
  if (gAll && !gAll.done) {
    gAll.prog += 1;
    if (gAll.prog >= gAll.target) {
      gAll.done = true;
      maybeQuestToast('goal', gAll);
    }
  }

  // goal 2: เลี่ยง junk — อัปเดตตอน end แทน (ดู hitsJunk)

  // minis
  const mGrain = state.minisAll.find(m => m.id === 'm-grain');
  if (mGrain && !mGrain.done && grp === 'grain') {
    mGrain.prog += 1;
    if (mGrain.prog >= mGrain.target) {
      mGrain.done = true;
      maybeQuestToast('mini', mGrain);
    }
  }

  const mProtein = state.minisAll.find(m => m.id === 'm-protein');
  if (mProtein && !mProtein.done && grp === 'protein') {
    mProtein.prog += 1;
    if (mProtein.prog >= mProtein.target) {
      mProtein.done = true;
      maybeQuestToast('mini', mProtein);
    }
  }

  const mVegFruit = state.minisAll.find(m => m.id === 'm-veg-fruit');
  if (mVegFruit && !mVegFruit.done && (grp === 'veg' || grp === 'fruit')) {
    mVegFruit.prog += 1;
    if (mVegFruit.prog >= mVegFruit.target) {
      mVegFruit.done = true;
      maybeQuestToast('mini', mVegFruit);
    }
  }

  emitQuestUpdate();
  checkGrandClear();
}

function checkGrandClear() {
  const allGoalDone = state.goalsAll.length > 0 && state.goalsAll.every(g => g.done);
  const allMiniDone = state.minisAll.length > 0 && state.minisAll.every(m => m.done);
  if (allGoalDone && allMiniDone && !state.grandShown) {
    state.grandShown = true;
    window.dispatchEvent(new CustomEvent('hha:grand-clear'));
  }
}

// -----------------------
// HUD events
// -----------------------
function emitScoreAndCombo() {
  window.dispatchEvent(new CustomEvent('hha:score', {
    detail: {
      score: state.score,
      combo: state.combo,
      misses: state.misses
    }
  }));
}

function emitMiss() {
  window.dispatchEvent(new CustomEvent('hha:miss', {
    detail: {}
  }));
}

function emitJudge(label) {
  window.dispatchEvent(new CustomEvent('hha:judge', {
    detail: { label }
  }));
}

function emitEnd(reason) {
  // อัปเดตเป้าหมายเลี่ยง junk
  const gAvoid = state.goalsAll.find(g => g.id === 'g-avoid-junk');
  if (gAvoid) {
    gAvoid.prog = state.hitsJunk;
    if (!gAvoid.done && state.hitsJunk <= gAvoid.target) {
      gAvoid.done = true;
      maybeQuestToast('goal', gAvoid);
    }
  }

  const goalsTotal   = state.goalsAll.length;
  const goalsCleared = state.goalsAll.filter(g => g.done).length;
  const miniTotal    = state.minisAll.length;
  const miniCleared  = state.minisAll.filter(m => m.done).length;

  // คำนวณเกรดอีกที (ให้ HUD ใช้ฟังก์ชันเดียวกันอยู่แล้ว)
  const allQuest = (goalsTotal > 0 && goalsCleared === goalsTotal) &&
                   (miniTotal > 0 && miniCleared === miniTotal);

  let grade = 'C';
  if (allQuest && state.score >= 1200 && state.maxCombo >= 15 && state.misses <= 1) grade = 'SSS';
  else if (allQuest && state.score >= 900 && state.maxCombo >= 10 && state.misses <= 3) grade = 'SS';
  else if (state.score >= 700) grade = 'S';
  else if (state.score >= 500) grade = 'A';
  else if (state.score >= 300) grade = 'B';

  window.dispatchEvent(new CustomEvent('hha:end', {
    detail: {
      reason,
      scoreFinal: state.score,
      comboMax: state.maxCombo,
      misses: state.misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal
    }
  }));

  // sync fever ปิดตอนจบ
  if (FeverUI) {
    try {
      FeverUI.setFeverActive(false);
      FeverUI.setFever(0);
    } catch {}
  }
}

// -----------------------
// Effect: เป้าแตก + คะแนนเด้ง + Judge ที่เป้า
// ใช้ตำแหน่ง cursor บนจอ (ctx.clientX/Y)
// -----------------------
function playHitFx(ctx, scoreDelta, judgeLabel) {
  const x = (ctx && ctx.clientX) || (window.innerWidth / 2);
  const y = (ctx && ctx.clientY) || (window.innerHeight / 2);

  if (!Particles) return;

  // ถ้า lib มี showHitFx ให้ใช้ก่อน
  if (typeof Particles.showHitFx === 'function') {
    Particles.showHitFx({
      x, y,
      scoreDelta,
      judgment: judgeLabel || ''
    });
    return;
  }

  // รองรับรูปแบบ burstAt + floatScore
  if (typeof Particles.burstAt === 'function') {
    try {
      Particles.burstAt(x, y, { judgment: judgeLabel || '' });
    } catch (err) {
      console.warn('[GroupsVR] Particles.burstAt error:', err);
    }
  }
  if (typeof Particles.floatScore === 'function') {
    try {
      Particles.floatScore(x, y, scoreDelta, { judgment: judgeLabel || '' });
    } catch (err) {
      console.warn('[GroupsVR] Particles.floatScore error:', err);
    }
  }
}

// -----------------------
// core hit / expire logic
// -----------------------
function handleGoodHit(ch, ctx) {
  state.hitsGood += 1;

  // simple timing-based judge:
  // combo >= 10 = Perfect, combo >=3 = Good, else = Hit
  let judge = 'Hit';
  let delta = 50;

  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  if (state.combo >= 10) {
    judge = 'Perfect';
    delta = 80;
  } else if (state.combo >= 3) {
    judge = 'Good';
    delta = 60;
  }

  // เพิ่ม fever
  addFever(judge === 'Perfect' ? 8 : 5);

  state.score += delta;

  // เคลียร์ quest
  checkQuestsOnGoodHit(ch);

  // ===== ลำดับ: 1) judge text → 2) FX เป้าแตก+คะแนนเด้ง → 3) HUD score/combo =====
  emitJudge(judge);
  playHitFx(ctx, delta, judge);
  emitScoreAndCombo();
}

function handleJunkHit(ctx) {
  state.hitsJunk += 1;

  let judge = 'Miss';
  let delta = -20;

  if (state.shield > 0) {
    // ถ้ามี shield: ไม่หักคะแนน แต่ลด shield แทน
    setShieldCount(state.shield - 1);
    judge = 'Shield';
    delta = 0;
  } else {
    state.misses += 1;
    state.combo = 0;
    addFever(-15);
  }

  if (delta !== 0) {
    state.score += delta;
  }

  emitJudge(judge);
  if (delta !== 0) {
    playHitFx(ctx, delta, judge);
  } else {
    // ไม่มีคะแนนแต่ให้มีเอฟเฟกต์เบา ๆ
    playHitFx(ctx, 0, judge);
  }
  emitMiss();
  emitScoreAndCombo();
}

function handlePowerupHit(ch, ctx) {
  let judge = 'Bonus';
  let delta = 0;

  if (ch === STAR_EMOJI) {
    judge = 'Star!';
    delta = 80;
    state.score += delta;
    addFever(12);
  } else if (ch === DIAMOND_EMOJI) {
    judge = 'Diamond!';
    delta = 100;
    state.score += delta;
    addFever(18);
  } else if (ch === SHIELD_EMOJI) {
    judge = 'Shield+1';
    setShieldCount(state.shield + 1);
  }

  emitJudge(judge);
  playHitFx(ctx, delta, judge);
  emitScoreAndCombo();
}

function handleExpire(ev) {
  // ถ้าเป็นของดีแต่หมดเวลา → Late
  if (ev && ev.isGood) {
    state.misses += 1;
    state.combo = 0;
    addFever(-10);

    emitJudge('Late');
    emitMiss();
    emitScoreAndCombo();
  }
}

// -----------------------
// GameEngine main
// -----------------------
async function start(diffKey = 'normal') {
  if (running && engineHandle && typeof engineHandle.stop === 'function') {
    try {
      engineHandle.stop('restart');
    } catch {}
  }

  running = true;
  state.diff       = String(diffKey || 'normal').toLowerCase();
  state.score      = 0;
  state.combo      = 0;
  state.maxCombo   = 0;
  state.misses     = 0;
  state.hitsGood   = 0;
  state.hitsJunk   = 0;
  state.feverPct   = 0;
  state.feverOn    = false;
  state.shield     = 0;

  ensureFever();
  setFeverPct(0);
  setShieldCount(0);
  buildQuests();

  // อ่าน HHA_DIFF_TABLE ถ้ามี เพื่อกำหนด duration
  let durationSec = 60;
  try {
    const table = ROOT.HHA_DIFF_TABLE;
    if (table && table.groups && table.groups[state.diff] && table.groups[state.diff].engine) {
      const eng = table.groups[state.diff].engine;
      const d   = Number(eng.DURATION_SEC);
      if (Number.isFinite(d) && d > 0) durationSec = d;
    }
  } catch (err) {
    console.warn('[GroupsVR] cannot read HHA_DIFF_TABLE:', err);
  }

  // config ให้ mode-factory
  const cfg = {
    modeKey: 'groups',
    difficulty: state.diff,
    duration: durationSec,
    pools: {
      good: GOOD_ALL,
      bad: JUNK
    },
    goodRate: 0.78,
    powerups: [STAR_EMOJI, DIAMOND_EMOJI, SHIELD_EMOJI],
    powerRate: 0.15,
    powerEvery: 7,

    // เรียกเมื่อคลิกโดนเป้า
    judge: (ch, ctx) => {
      if (!running) return;
      const isPower = (ch === STAR_EMOJI || ch === DIAMOND_EMOJI || ch === SHIELD_EMOJI);
      const isGood  = !isPower && GOOD_ALL.includes(ch);
      const isJunk  = !isPower && JUNK.includes(ch);

      if (isPower) {
        handlePowerupHit(ch, ctx);
      } else if (isGood) {
        handleGoodHit(ch, ctx);
      } else if (isJunk) {
        handleJunkHit(ctx);
      } else {
        // ไม่รู้ประเภท → ถือว่า Miss เบา ๆ
        handleJunkHit(ctx);
      }
    },

    // เรียกเมื่อเป้าหมดเวลา
    onExpire: (ev) => {
      if (!running) return;
      handleExpire(ev || {});
    }
  };

  try {
    engineHandle = await factoryBoot(cfg);
  } catch (err) {
    console.error('[GroupsVR] factoryBoot error:', err);
    running = false;
    throw err;
  }
}

function stop(reason = 'manual') {
  if (!running) return;
  running = false;

  if (engineHandle && typeof engineHandle.stop === 'function') {
    try {
      engineHandle.stop(reason);
    } catch (err) {
      console.warn('[GroupsVR] engineHandle.stop error:', err);
    }
  }
  engineHandle = null;

  emitEnd(reason);
}

// export ให้ groups-vr.html ใช้
export const GameEngine = {
  start,
  stop
};

export default GameEngine;