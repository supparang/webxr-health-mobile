// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji target + Fever + Quest + FX + Cloud Logger hooks)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ===== Fever UI (global non-module) =====
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || {
    ensureFeverBar(){},
    setFever(){},
    setFeverActive(){},
    setShield(){}
  };

// ===== DOM FX (score / judgment / burst) =====
let fxStyleInjected = false;

function ensureFxStyle() {
  if (fxStyleInjected || !ROOT.document) return;
  fxStyleInjected = true;
  const css = ROOT.document.createElement('style');
  css.id = 'fg-hit-style';
  css.textContent = `
    .fg-hit-frag{
      position:fixed;
      width:6px;
      height:6px;
      border-radius:999px;
      background:rgba(250,250,250,0.9);
      box-shadow:0 0 10px rgba(34,197,94,0.9);
      opacity:0;
      transform:translate3d(0,0,0) scale(0.4);
      transition:transform .35s ease-out, opacity .35s ease-out;
      pointer-events:none;
      z-index:900;
    }
    .fg-hit-score{
      position:fixed;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      font-size:20px;
      font-weight:800;
      color:#bbf7d0;
      text-shadow:0 0 18px rgba(22,163,74,0.95);
      pointer-events:none;
      z-index:901;
      opacity:0;
      transform:translate3d(-50%,-40%,0);
      transition:transform .4s ease-out, opacity .4s ease-out;
    }
    .fg-hit-judge{
      position:fixed;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      font-size:16px;
      font-weight:700;
      color:#fee2e2;
      text-shadow:0 0 14px rgba(248,113,113,0.95);
      pointer-events:none;
      z-index:901;
      opacity:0;
      transform:translate3d(-50%,0,0);
      transition:transform .35s ease-out, opacity .35s ease-out;
    }
    .fg-hit-judge.good{
      color:#bfdbfe;
      text-shadow:0 0 14px rgba(59,130,246,0.95);
    }
    .fg-hit-judge.perfect{
      color:#fde68a;
      text-shadow:0 0 18px rgba(234,179,8,0.95);
    }
    .fg-hit-judge.late{
      color:#fed7aa;
      text-shadow:0 0 14px rgba(249,115,22,0.9);
    }
    .fg-hit-judge.miss{
      color:#fecaca;
      text-shadow:0 0 14px rgba(248,113,113,0.95);
    }
  `;
  ROOT.document.head.appendChild(css);
}

function spawnHitFx(judgment, scoreDelta) {
  if (!ROOT.document) return;
  ensureFxStyle();
  const doc = ROOT.document;
  const cx = ROOT.innerWidth / 2;
  const cy = ROOT.innerHeight / 2;

  // fragments
  const n = 12;
  for (let i = 0; i < n; i++) {
    const el = doc.createElement('div');
    el.className = 'fg-hit-frag';
    const ang = (i / n) * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const tx = cx + Math.cos(ang) * dist;
    const ty = cy + Math.sin(ang) * dist;

    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
    doc.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform =
        `translate3d(${tx - cx}px, ${ty - cy}px, 0) scale(1)`;
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform += ' scale(0.6)';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, 220);
  }

  // score text
  const scoreEl = doc.createElement('div');
  scoreEl.className = 'fg-hit-score';
  scoreEl.textContent = (scoreDelta >= 0 ? '+' : '') + Math.round(scoreDelta);
  scoreEl.style.left = cx + 'px';
  scoreEl.style.top  = (cy - 24) + 'px';
  doc.body.appendChild(scoreEl);

  requestAnimationFrame(() => {
    scoreEl.style.opacity = '1';
    scoreEl.style.transform = 'translate3d(-50%,-80%,0)';
  });
  setTimeout(() => {
    scoreEl.style.opacity = '0';
    scoreEl.style.transform = 'translate3d(-50%,-120%,0)';
    setTimeout(() => {
      if (scoreEl.parentNode) scoreEl.parentNode.removeChild(scoreEl);
    }, 220);
  }, 420);

  // judgment text (Good / Perfect)
  if (judgment) {
    const jEl = doc.createElement('div');
    jEl.className = 'fg-hit-judge';
    const lower = judgment.toLowerCase();
    if (lower === 'good') jEl.classList.add('good');
    else if (lower === 'perfect') jEl.classList.add('perfect');
    else if (lower === 'late') jEl.classList.add('late');
    else if (lower === 'miss') jEl.classList.add('miss');

    jEl.textContent = judgment;
    jEl.style.left = cx + 'px';
    jEl.style.top  = (cy + 10) + 'px';
    doc.body.appendChild(jEl);

    requestAnimationFrame(() => {
      jEl.style.opacity = '1';
      jEl.style.transform = 'translate3d(-50%,10px,0)';
    });
    setTimeout(() => {
      jEl.style.opacity = '0';
      jEl.style.transform = 'translate3d(-50%,-10px,0)';
      setTimeout(() => {
        if (jEl.parentNode) jEl.parentNode.removeChild(jEl);
      }, 220);
    }, 360);
  }
}

function spawnMissFx(kind) {
  if (!ROOT.document) return;
  ensureFxStyle();
  const doc = ROOT.document;
  const cx = ROOT.innerWidth / 2;
  const cy = ROOT.innerHeight / 2;
  const jEl = doc.createElement('div');
  jEl.className = 'fg-hit-judge miss';
  const label = kind === 'late' ? 'Late' : 'Miss';
  jEl.textContent = label;
  jEl.style.left = cx + 'px';
  jEl.style.top  = cy + 'px';
  doc.body.appendChild(jEl);

  requestAnimationFrame(() => {
    jEl.style.opacity = '1';
    jEl.style.transform = 'translate3d(-50%,10px,0)';
  });
  setTimeout(() => {
    jEl.style.opacity = '0';
    jEl.style.transform = 'translate3d(-50%,-10px,0)';
    setTimeout(() => {
      if (jEl.parentNode) jEl.parentNode.removeChild(jEl);
    }, 220);
  }, 380);
}

// ===== Food pools =====
const GRAIN   = ['🍚','🍙','🍞','🥖','🥨','🥐','🍝'];
const PROTEIN = ['🍗','🍖','🥩','🥚','🫘','🧀','🐟'];
const VEG     = ['🥦','🥕','🥬','🧄','🧅','🌽','🍅'];
const FRUIT   = ['🍎','🍌','🍇','🍓','🍊','🍍','🥝'];
const MILK    = ['🥛','🧃','🍨','🍦','🍮','🧈','🧋'];

const GOOD = [...GRAIN, ...PROTEIN, ...VEG, ...FRUIT, ...MILK];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

const POWER_STAR    = '⭐';
const POWER_DIAMOND = '💎';
const POWER_SHIELD  = '🛡️';
const POWERUPS = [POWER_STAR, POWER_DIAMOND, POWER_SHIELD];

function isGoodChar(ch) {
  return GOOD.includes(ch) || POWERUPS.includes(ch);
}
function isJunkChar(ch) {
  return JUNK.includes(ch);
}
function groupOf(ch) {
  if (GRAIN.includes(ch))   return 'grain';
  if (PROTEIN.includes(ch)) return 'protein';
  if (VEG.includes(ch))     return 'veg';
  if (FRUIT.includes(ch))   return 'fruit';
  if (MILK.includes(ch))    return 'milk';
  return null;
}

// ===== Quest model =====
function createQuests() {
  const goals = [
    {
      id: 'all-groups',
      type: 'goal',
      label: 'กินอาหารครบ 5 หมู่',
      target: 5,
      prog: 0,
      done: false,
      hint: 'ลองเก็บอาหารจากทุกหมู่ให้ได้อย่างน้อยหมู่ละ 1 ชิ้น'
    },
    {
      id: 'many-good',
      type: 'goal',
      label: 'สะสมอาหารดีอย่างน้อย 35 ชิ้น',
      target: 35,
      prog: 0,
      done: false,
      hint: 'เก็บอาหารดีไปเรื่อย ๆ ให้ครบตามเป้า'
    }
  ];

  const minis = [
    {
      id: 'veg-quest',
      type: 'mini',
      label: 'เก็บผักให้ได้ 7 ชิ้น',
      target: 7,
      prog: 0,
      done: false
    },
    {
      id: 'fruit-quest',
      type: 'mini',
      label: 'เก็บผลไม้ให้ได้ 7 ชิ้น',
      target: 7,
      prog: 0,
      done: false
    },
    {
      id: 'milk-quest',
      type: 'mini',
      label: 'เก็บนม/ผลิตภัณฑ์นมให้ได้ 7 ชิ้น',
      target: 7,
      prog: 0,
      done: false
    }
  ];

  return { goals, minis };
}

// ===== Engine state =====
let engineHandle = null;
let running = false;
let ended = false;
let timeListenerBound = false;

const state = {
  diff: 'normal',
  durationSec: 60,
  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,
  feverPct: 0,
  feverActive: false,
  shield: 0,
  goodHits: 0,
  junkHits: 0,
  groupHits: {
    grain: 0,
    protein: 0,
    veg: 0,
    fruit: 0,
    milk: 0
  },
  quests: createQuests(),
  allQuestDoneAnnounced: false
};

function resetState(diffKey, durationSec) {
  state.diff = diffKey;
  state.durationSec = durationSec;
  state.score = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.misses = 0;
  state.feverPct = 0;
  state.feverActive = false;
  state.shield = 0;
  state.goodHits = 0;
  state.junkHits = 0;
  state.groupHits = { grain:0, protein:0, veg:0, fruit:0, milk:0 };
  state.quests = createQuests();
  state.allQuestDoneAnnounced = false;

  try {
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setFeverActive(false);
    FeverUI.setShield(0);
  } catch {}
}

function broadcastScore() {
  ROOT.dispatchEvent(new CustomEvent('hha:score', {
    detail: {
      score: state.score,
      combo: state.combo,
      misses: state.misses
    }
  }));
}

function broadcastMiss() {
  ROOT.dispatchEvent(new CustomEvent('hha:miss', {
    detail: {
      score: state.score,
      combo: state.combo,
      misses: state.misses
    }
  }));
}

function broadcastJudge(label) {
  ROOT.dispatchEvent(new CustomEvent('hha:judge', {
    detail: { label }
  }));
}

function changeFever(delta) {
  try {
    FeverUI.ensureFeverBar();
  } catch {}
  let v = (state.feverPct || 0) + delta;
  if (!Number.isFinite(v)) v = 0;
  if (v < 0) v = 0;
  if (v > 100) v = 100;

  if (!state.feverActive && v >= 100) {
    state.feverActive = true;
    try {
      FeverUI.setFeverActive(true);
    } catch {}
    ROOT.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'start' }
    }));
  } else if (state.feverActive && v <= 5) {
    state.feverActive = false;
    try {
      FeverUI.setFeverActive(false);
    } catch {}
    ROOT.dispatchEvent(new CustomEvent('hha:fever', {
      detail: { state: 'end' }
    }));
  }

  state.feverPct = v;
  try {
    FeverUI.setFever(v);
  } catch {}
}

function updateQuestsOnHit(ch) {
  const g = groupOf(ch);
  if (g) {
    state.groupHits[g] = (state.groupHits[g] || 0) + 1;
  }
  state.goodHits += 1;

  const { goals, minis } = state.quests;

  const goalAllGroups = goals.find(q => q.id === 'all-groups');
  if (goalAllGroups) {
    let groupsDone = 0;
    for (const key of ['grain','protein','veg','fruit','milk']) {
      if ((state.groupHits[key] || 0) > 0) groupsDone++;
    }
    goalAllGroups.prog = groupsDone;
    if (!goalAllGroups.done && goalAllGroups.prog >= goalAllGroups.target) {
      goalAllGroups.done = true;
      ROOT.dispatchEvent(new CustomEvent('hha:quest-clear', {
        detail: {
          type: 'goal',
          label: goalAllGroups.label,
          short: 'กินครบทั้ง 5 หมู่แล้ว'
        }
      }));
    }
  }

  const goalManyGood = goals.find(q => q.id === 'many-good');
  if (goalManyGood) {
    goalManyGood.prog = state.goodHits;
    if (!goalManyGood.done && goalManyGood.prog >= goalManyGood.target) {
      goalManyGood.done = true;
      ROOT.dispatchEvent(new CustomEvent('hha:quest-clear', {
        detail: {
          type: 'goal',
          label: goalManyGood.label,
          short: 'สะสมอาหารดีได้ตามเป้าแล้ว'
        }
      }));
    }
  }

  const vegQ = minis.find(q => q.id === 'veg-quest');
  if (vegQ) {
    vegQ.prog = state.groupHits.veg || 0;
    if (!vegQ.done && vegQ.prog >= vegQ.target) {
      vegQ.done = true;
      ROOT.dispatchEvent(new CustomEvent('hha:quest-clear', {
        detail: {
          type: 'mini',
          label: vegQ.label,
          short: 'เก็บผักได้ครบแล้ว'
        }
      }));
    }
  }

  const fruitQ = minis.find(q => q.id === 'fruit-quest');
  if (fruitQ) {
    fruitQ.prog = state.groupHits.fruit || 0;
    if (!fruitQ.done && fruitQ.prog >= fruitQ.target) {
      fruitQ.done = true;
      ROOT.dispatchEvent(new CustomEvent('hha:quest-clear', {
        detail: {
          type: 'mini',
          label: fruitQ.label,
          short: 'เก็บผลไม้ได้ครบแล้ว'
        }
      }));
    }
  }

  const milkQ = minis.find(q => q.id === 'milk-quest');
  if (milkQ) {
    milkQ.prog = state.groupHits.milk || 0;
    if (!milkQ.done && milkQ.prog >= milkQ.target) {
      milkQ.done = true;
      ROOT.dispatchEvent(new CustomEvent('hha:quest-clear', {
        detail: {
          type: 'mini',
          label: milkQ.label,
          short: 'เก็บนมได้ครบแล้ว'
        }
      }));
    }
  }

  broadcastQuestState();
  checkGrandClear();
}

function broadcastQuestState() {
  const { goals, minis } = state.quests;
  const nextGoal = goals.find(q => !q.done && q.type === 'goal') || null;
  const nextMini = minis.find(q => !q.done && q.type === 'mini') || null;

  let hint = '';
  if (nextGoal && nextGoal.hint) {
    hint = nextGoal.hint;
  }

  ROOT.dispatchEvent(new CustomEvent('quest:update', {
    detail: {
      goal: nextGoal
        ? { label: nextGoal.label, prog: nextGoal.prog, target: nextGoal.target }
        : null,
      mini: nextMini
        ? { label: nextMini.label, prog: nextMini.prog, target: nextMini.target }
        : null,
      goalsAll: goals.map(q => ({
        id: q.id,
        type: q.type,
        label: q.label,
        target: q.target,
        prog: q.prog,
        done: q.done
      })),
      minisAll: minis.map(q => ({
        id: q.id,
        type: q.type,
        label: q.label,
        target: q.target,
        prog: q.prog,
        done: q.done
      })),
      hint
    }
  }));
}

function checkGrandClear() {
  const { goals, minis } = state.quests;
  const allGoalsDone = goals.every(q => q.done);
  const allMinisDone = minis.every(q => q.done);
  if (allGoalsDone && allMinisDone && !state.allQuestDoneAnnounced) {
    state.allQuestDoneAnnounced = true;
    ROOT.dispatchEvent(new CustomEvent('hha:grand-clear', { detail: {} }));
    finalizeGame('quest-clear');
  }
}

function registerMiss(kind) {
  if (!running || ended) return;
  state.misses += 1;
  state.combo = 0;
  broadcastMiss();
  broadcastScore();
  broadcastJudge(kind === 'late' ? 'Late' : 'Miss');
  spawnMissFx(kind);
  changeFever(-18);
}

function registerHit(ch) {
  if (!running || ended) return;

  // power-ups
  if (ch === POWER_SHIELD) {
    state.shield += 1;
    try {
      FeverUI.setShield(state.shield);
    } catch {}
  }

  if (!isGoodChar(ch) && !isJunkChar(ch)) {
    // ถ้าไม่รู้จัก ให้ถือว่าเป็น good ธรรมดา
  }

  if (isJunkChar(ch)) {
    if (state.shield > 0) {
      state.shield -= 1;
      try {
        FeverUI.setShield(state.shield);
      } catch {}
      broadcastJudge('Shield');
      spawnMissFx('shield');
      return;
    }
    state.junkHits += 1;
    registerMiss('miss');
    return;
  }

  // Good / power
  state.goodHits += 1;

  // combo
  state.combo += 1;
  if (state.combo > state.comboMax) state.comboMax = state.combo;

  // judgment
  let judgment = 'Good';
  if (state.combo >= 8) judgment = 'Perfect';

  let base = 40;
  if (judgment === 'Perfect') base = 60;
  if (ch === POWER_STAR || ch === POWER_DIAMOND) {
    base += 30;
  }

  let scoreDelta = base + Math.max(0, state.combo - 1) * 3;
  if (state.feverActive) {
    scoreDelta *= 1.6;
  }

  state.score += scoreDelta;

  broadcastScore();
  broadcastJudge(judgment);
  spawnHitFx(judgment, scoreDelta);

  changeFever(judgment === 'Perfect' ? 10 : 6);

  updateQuestsOnHit(ch);
}

// ===== hha:time listener (จับ timeout จาก mode-factory) =====
function handleTimeEvent(e) {
  const d = (e && e.detail) || {};
  if (!running || ended) return;
  if (typeof d.sec === 'number' && d.sec <= 0 && d.reason) {
    finalizeGame(d.reason || 'timeout');
  }
}

function attachTimeListener() {
  if (timeListenerBound) return;
  timeListenerBound = true;
  ROOT.addEventListener('hha:time', handleTimeEvent);
}
function detachTimeListener() {
  if (!timeListenerBound) return;
  timeListenerBound = false;
  ROOT.removeEventListener('hha:time', handleTimeEvent);
}

// ===== Finalize / end =====
function computeGrade(score, comboMax, misses, quests) {
  const goals = quests.goals || [];
  const minis = quests.minis || [];
  const allGoalsDone = goals.every(q => q.done);
  const allMinisDone = minis.every(q => q.done);
  const allQuest = allGoalsDone && allMinisDone;

  if (allQuest && score >= 1200 && comboMax >= 15 && misses <= 1) return 'SSS';
  if (allQuest && score >= 900  && comboMax >= 10 && misses <= 3) return 'SS';
  if (score >= 700) return 'S';
  if (score >= 500) return 'A';
  if (score >= 300) return 'B';
  return 'C';
}

function finalizeGame(reason) {
  if (ended) return;
  ended = true;
  running = false;

  if (engineHandle && typeof engineHandle.stop === 'function') {
    try {
      engineHandle.stop(reason || 'manual');
    } catch {}
  }
  engineHandle = null;

  detachTimeListener();

  const goals = state.quests.goals || [];
  const minis = state.quests.minis || [];
  const goalsCleared = goals.filter(q => q.done).length;
  const goalsTotal   = goals.length;
  const miniCleared  = minis.filter(q => q.done).length;
  const miniTotal    = minis.length;

  const grade = computeGrade(
    state.score,
    state.comboMax,
    state.misses,
    state.quests
  );

  ROOT.dispatchEvent(new CustomEvent('hha:end', {
    detail: {
      reason: reason || 'manual',
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      grade
    }
  }));
}

// ===== URL helper =====
function getParam(name, fallback) {
  try {
    const url = new URL(ROOT.location.href);
    const v = url.searchParams.get(name);
    return v !== null && v !== '' ? v : fallback;
  } catch {
    return fallback;
  }
}

function pickDurationForDiff(diffKey) {
  let baseDur = 60;
  if (diffKey === 'easy') baseDur = 80;
  else if (diffKey === 'hard') baseDur = 45;

  const timeParam = getParam('time', '');
  if (timeParam) {
    const parsed = parseInt(timeParam, 10);
    if (!Number.isNaN(parsed) && parsed >= 20 && parsed <= 180) {
      return parsed;
    }
  }
  return baseDur;
}

// ===== GameEngine (public) =====
export const GameEngine = {
  async start(diffRaw) {
    let diff = String(diffRaw || getParam('diff','normal') || 'normal')
      .toLowerCase();
    if (diff !== 'easy' && diff !== 'hard') diff = 'normal';

    if (running) {
      this.stop('restart');
    }
    ended = false;
    running = true;

    const durationSec = pickDurationForDiff(diff);
    resetState(diff, durationSec);
    attachTimeListener();

    broadcastScore();
    broadcastQuestState();

    // config สำหรับ mode-factory
    const cfg = {
      modeKey: 'groups',
      difficulty: diff,
      duration: durationSec,
      pools: {
        good: GOOD,
        bad: JUNK
      },
      goodRate: 0.78,
      powerups: POWERUPS,
      powerRate: 0.18,
      powerEvery: 6,
      judge: (ch /*, ctx */) => {
        if (!running || ended) return;
        registerHit(ch);
      },
      onExpire: (ev) => {
        if (!running || ended) return;
        const ch = ev && ev.ch;
        if (isGoodChar(ch)) {
          registerMiss('late');
        }
      }
    };

    try {
      engineHandle = await factoryBoot(cfg);
    } catch (err) {
      console.error('[GroupsVR] mode-factory boot error:', err);
      finalizeGame('boot-error');
    }
  },

  stop(reason = 'manual') {
    finalizeGame(reason);
  }
};

export default GameEngine;