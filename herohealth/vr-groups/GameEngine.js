// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (VR emoji targets + Fever + Quest + Cloud logger hook)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// emoji แต่ละหมู่
const pools = {
  good: ['🍚','🍞','🥦','🥕','🍅','🍎','🍌','🥛','🍗','🐟'],
  bad:  ['🍩','🍟','🍫','🥤','🍬','🍕','🧂']
};

// power-ups เหมือน GoodJunk / Hydration
const powerups = ['⭐','💎','🛡️','🔥'];

let state = {};
resetState();

// ------ helper ------
function resetState () {
  state = {
    running: false,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    fever: 0,
    feverActive: false,
    goodHit: 0,
    goodHitNoMiss: 0,
    goalsCleared: 0,
    goalsTotal: 1,
    miniCleared: 0,
    miniTotal: 1,
    spawner: null
  };
}

function emit (name, detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

function getFeverUI () {
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

function setFeverVal (v) {
  const FeverUI = getFeverUI();
  state.fever = Math.max(0, Math.min(100, Number(v) || 0));
  if (FeverUI && FeverUI.setFever) {
    FeverUI.setFever(state.fever);
  }
  const active = state.fever >= 100;
  if (active !== state.feverActive) {
    state.feverActive = active;
    if (FeverUI && FeverUI.setFeverActive) FeverUI.setFeverActive(active);
    emit('hha:fever', { state: active ? 'start' : 'end' });
  }
}

function addScore (base, label) {
  let delta = base;
  if (state.feverActive) delta = Math.round(delta * 1.5);

  state.score += delta;
  state.combo++;
  if (state.combo > state.comboMax) state.comboMax = state.combo;

  setFeverVal(state.fever + 8);

  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    misses: state.misses
  });
  emit('hha:judge', { label: label || '' });
}

function registerMiss (reason) {
  state.misses++;
  state.combo = 0;
  state.goodHitNoMiss = 0;
  setFeverVal(state.fever - 10);

  emit('hha:score', {
    score: state.score,
    combo: state.combo,
    misses: state.misses
  });
  emit('hha:miss', { reason });
  emit('hha:judge', { label: 'Miss' });
}

// ---- Quest / Progress ----
function computeQuests () {
  const goalsAll = [
    {
      label: 'เก็บอาหารให้ครบ 25 ชิ้น',
      prog: state.goodHit,
      target: 25,
      done: state.goodHit >= 25
    }
  ];
  const minisAll = [
    {
      label: 'คลิกผัก/ผลไม้ไม่พลาดอย่างน้อย 6 ชิ้น',
      prog: state.goodHitNoMiss,
      target: 6,
      done: state.goodHitNoMiss >= 6
    }
  ];

  state.goalsTotal   = goalsAll.length;
  state.goalsCleared = goalsAll.filter(g => g.done).length;
  state.miniTotal    = minisAll.length;
  state.miniCleared  = minisAll.filter(m => m.done).length;

  return { goalsAll, minisAll };
}

function pushQuestUpdate () {
  const { goalsAll, minisAll } = computeQuests();
  const goal = goalsAll[0] || null;
  const mini = minisAll[0] || null;

  emit('quest:update', {
    goal,
    mini,
    goalsAll,
    minisAll,
    hint: 'ลองให้ครบทั้ง 5 หมู่ในแต่ละภารกิจนะ 🍚🥦🍎🥛🍗'
  });
}

function maybeQuestCelebrate () {
  const { goalsAll, minisAll } = computeQuests();
  const goal = goalsAll[0];
  const mini = minisAll[0];

  if (goal && goal.done && state.goalsCleared === 1 && state.goodHit === goal.target) {
    emit('quest:celebrate', { kind: 'goal', index: 1, total: 1 });
  }
  if (mini && mini.done && state.miniCleared === 1 && state.goodHitNoMiss === mini.target) {
    emit('quest:celebrate', { kind: 'mini', index: 1, total: 1 });
  }

  if (state.goalsCleared === state.goalsTotal &&
      state.miniCleared === state.miniTotal) {
    emit('quest:all-complete', {
      goalsTotal: state.goalsTotal,
      minisTotal: state.miniTotal
    });
    stop('quest-complete');
  }
}

// ---- judge จาก emoji ที่ถูกคลิก ----
function judgeEmoji (ch /*, ctx */) {
  if (!state.running) return;

  if (pools.good.includes(ch)) {
    state.goodHit++;
    state.goodHitNoMiss++;
    addScore(150, 'Perfect');
  } else if (pools.bad.includes(ch)) {
    registerMiss('bad');
  } else if (ch === '⭐') {
    addScore(200, 'Bonus');
  } else if (ch === '💎') {
    addScore(250, 'Diamond');
  } else if (ch === '🛡️') {
    setFeverVal(state.fever + 20);
    emit('hha:judge', { label: 'Shield' });
  } else if (ch === '🔥') {
    setFeverVal(100);
    emit('hha:judge', { label: 'Fever!' });
  } else {
    addScore(100, 'Good');
  }

  pushQuestUpdate();
  maybeQuestCelebrate();
}

// หมดเวลา/หมดอายุของเป้า
function handleExpire (ev) {
  if (!state.running) return;
  if (ev && ev.isGood) {
    registerMiss('expire');
    pushQuestUpdate();
  }
}

// ---- start / stop ----
async function start (diff = 'normal') {
  if (state.running) stop('restart');
  resetState();
  state.running = true;

  const FeverUI = getFeverUI();
  if (FeverUI && FeverUI.ensureFeverBar) {
    FeverUI.ensureFeverBar();
  }
  setFeverVal(0);

  emit('hha:score', { score: 0, combo: 0, misses: 0 });
  emit('hha:coach', {
    text: 'เลือกอาหารจากทุกหมู่ให้สมดุล อย่าลืมผัก ผลไม้ และนมด้วยนะ 🥦🍎🥛'
  });

  pushQuestUpdate();

  // ใช้ mode-factory สร้าง emoji เป้า VR
  state.spawner = await factoryBoot({
    modeKey: 'groups',
    difficulty: diff,
    duration: 9999,          // เวลาเกมคุมจาก HTML (hha:time)
    pools,
    goodRate: 0.7,
    powerups,
    powerRate: 0.15,
    powerEvery: 7,
    judge: judgeEmoji,
    onExpire: handleExpire
  });
}

function stop (reason = 'manual') {
  if (!state.running) return;
  state.running = false;

  if (state.spawner && state.spawner.stop) {
    try { state.spawner.stop(reason); } catch {}
  }
  state.spawner = null;

  const FeverUI = getFeverUI();
  if (FeverUI && FeverUI.setFeverActive) {
    FeverUI.setFeverActive(false);
  }

  // สรุปผลส่งให้ HUD / Summary
  const { goalsAll, minisAll } = computeQuests();

  emit('hha:end', {
    reason,
    scoreFinal: state.score,
    comboMax: state.comboMax,
    misses: state.misses,
    goalsCleared: goalsAll.filter(g => g.done).length,
    goalsTotal: goalsAll.length,
    miniCleared: minisAll.filter(m => m.done).length,
    miniTotal: minisAll.length
  });
}

export const GameEngine = { start, stop };
export default GameEngine;