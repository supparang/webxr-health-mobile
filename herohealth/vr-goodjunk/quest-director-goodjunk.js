// === /herohealth/vr-goodjunk/quest-director-goodjunk.js ===
// ใช้ GOODJUNK_GOALS + GOODJUNK_MINIS เพื่อจัดลำดับ Goal / Mini quest
// แล้วยิง quest:update ให้ HUD goodjunk-vr.html

'use strict';

import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

// helper ยิง event ไปให้ HUD
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

// เลือก goal ที่เป็น missMax ไปไว้ท้าย ๆ เสมอ
function buildOrderedGoals(diffKey = 'normal') {
  const early = [];
  const late  = [];
  for (const g of GOODJUNK_GOALS) {
    const tgt = g[diffKey] ?? g.normal ?? g.easy;
    const entry = { ...g, target: tgt };
    if (g.kind === 'missMax') late.push(entry);
    else early.push(entry);
  }
  return [...early, ...late];
}

function buildOrderedMinis(diffKey = 'normal') {
  return GOODJUNK_MINIS.map(m => ({
    ...m,
    target: m[diffKey] ?? m.normal ?? m.easy
  }));
}

// -------------- ตัวสร้าง Director -----------------
export function makeQuestDirector(opts = {}) {
  const diffKey = String(opts.diff || 'normal').toLowerCase();

  const goals = buildOrderedGoals(diffKey);
  const minis = buildOrderedMinis(diffKey);

  let curGoalIdx = 0;
  let curMiniIdx = 0;

  const state = {
    // counters สด ๆ จากเกม
    score: 0,
    goodHits: 0,
    misses: 0,
    comboMax: 0,

    goals,
    minis,
    goalsCleared: 0,
    miniCleared: 0
  };

  function currentGoal() {
    return goals[curGoalIdx] || null;
  }
  function currentMini() {
    return minis[curMiniIdx] || null;
  }

  function evaluateGoal(g) {
    if (!g) return false;
    switch (g.kind) {
      case 'score':    return state.score    >= g.target;
      case 'goodHits': return state.goodHits >= g.target;
      case 'combo':    return state.comboMax >= g.target;
      case 'missMax':  return state.misses   <= g.target;
      default:         return false;
    }
  }

  function evaluateMini(m) {
    if (!m) return false;
    switch (m.kind) {
      case 'score':    return state.score    >= m.target;
      case 'goodHits': return state.goodHits >= m.target;
      case 'combo':    return state.comboMax >= m.target;
      case 'missMax':  return state.misses   <= m.target;
      default:         return false;
    }
  }

  function pushHUD() {
    const g = currentGoal();
    const m = currentMini();

    let goalDetail = null;
    if (g) {
      let prog = 0;
      if (g.kind === 'score') prog = state.score;
      else if (g.kind === 'goodHits') prog = state.goodHits;
      else if (g.kind === 'combo') prog = state.comboMax;
      else if (g.kind === 'missMax') {
        // missMax → ยิ่งน้อยยิ่งดี, แสดงเป็น “ใช้ไปกี่สิทธิ”
        prog = Math.max(0, g.target - state.misses);
      }

      goalDetail = {
        id: g.id,
        label: g.label,
        kind: g.kind,
        prog,
        target: g.target,
        done: evaluateGoal(g),
        index: curGoalIdx,
        total: goals.length
      };
    }

    let miniDetail = null;
    if (m) {
      let progM = 0;
      if (m.kind === 'score') progM = state.score;
      else if (m.kind === 'goodHits') progM = state.goodHits;
      else if (m.kind === 'combo') progM = state.comboMax;
      else if (m.kind === 'missMax') {
        progM = Math.max(0, m.target - state.misses);
      }

      miniDetail = {
        id: m.id,
        label: m.label,
        kind: m.kind,
        prog: progM,
        target: m.target,
        done: evaluateMini(m),
        index: curMiniIdx,
        total: minis.length
      };
    } else {
      miniDetail = {
        id: null,
        label: 'Mini quest ครบทุกภารกิจแล้ว 🎉',
        kind: 'done',
        prog: 1,
        target: 1,
        done: true,
        index: minis.length,
        total: minis.length
      };
    }

    const detailForHud = {
      goal: goalDetail && {
        label: goalDetail.label,
        prog: goalDetail.prog,
        target: goalDetail.target,
        done: goalDetail.done
      },
      mini: miniDetail && {
        label: miniDetail.label,
        prog: miniDetail.prog,
        target: miniDetail.target,
        done: miniDetail.done
      },
      hint: 'เล็งของดี 🥦 🍎 🥛 ให้เร็ว ๆ และพยายามไม่โดนของขยะ 🌭🍩 จะได้คอมโบยาว ๆ นะ!',
      goalsCleared: state.goalsCleared,
      goalsTotal: goals.length,
      miniCleared: state.miniCleared,
      miniTotal: minis.length
    };

    emit('quest:update', detailForHud);
  }

  function checkProgress() {
    // เลื่อน goal
    while (curGoalIdx < goals.length && evaluateGoal(currentGoal())) {
      curGoalIdx++;
      state.goalsCleared++;
    }

    // เลื่อน mini
    while (curMiniIdx < minis.length && evaluateMini(currentMini())) {
      curMiniIdx++;
      state.miniCleared++;
    }

    pushHUD();
  }

  // object ที่ GameEngine จะเรียกใช้
  return {
    reset() {
      state.score = 0;
      state.goodHits = 0;
      state.misses = 0;
      state.comboMax = 0;
      state.goalsCleared = 0;
      state.miniCleared = 0;
      curGoalIdx = 0;
      curMiniIdx = 0;
      pushHUD();
    },

    // เรียกทุกครั้งที่ score/good/miss/combo เปลี่ยน
    update(stats = {}) {
      if (typeof stats.score === 'number') state.score = stats.score;
      if (typeof stats.goodHits === 'number') state.goodHits = stats.goodHits;
      if (typeof stats.misses === 'number') state.misses = stats.misses;
      if (typeof stats.comboMax === 'number') {
        state.comboMax = Math.max(state.comboMax, stats.comboMax);
      }
      checkProgress();
    },

    getSummary() {
      return {
        goalsCleared: state.goalsCleared,
        goalsTotal: goals.length,
        miniCleared: state.miniCleared,
        miniTotal: minis.length
      };
    }
  };
}

export default { makeQuestDirector };
