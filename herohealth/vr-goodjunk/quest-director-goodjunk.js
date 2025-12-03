// === /herohealth/vr-goodjunk/quest-director-goodjunk.js ===
// อ่าน GOODJUNK_GOALS + GOODJUNK_MINIS แล้วแปลงเป็น goal / mini quest
// ยิง event 'quest:update' ให้ HUD goodjunk-vr.html ใช้งาน

'use strict';

import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

// ----- helper -----
function getTargetByDiff(item, diff) {
  const d = (diff || 'normal').toLowerCase();
  if (typeof item[d] === 'number') return item[d];
  if (typeof item.normal === 'number') return item.normal;
  if (typeof item.easy === 'number') return item.easy;
  if (typeof item.hard === 'number') return item.hard;
  return 0;
}

function normalizeList(list, diff) {
  const arr = list.map(g => ({
    id: g.id,
    label: g.label,
    kind: g.kind,
    target: getTargetByDiff(g, diff),
    current: 0,
    done: false
  }));

  // ดัน missMax ไปอยู่ท้ายสุดเสมอ (ทั้ง goal และ mini)
  const miss = arr.filter(g => g.kind === 'missMax');
  const other = arr.filter(g => g.kind !== 'missMax');
  return other.concat(miss);
}

function valueForKind(kind, st) {
  switch (kind) {
    case 'score':    return st.score;
    case 'goodHits': return st.goodHits;
    case 'combo':    return st.comboMax;
    case 'missMax':  return st.misses;   // ใช้จำนวน miss จริง ๆ
    default:         return 0;
  }
}

function isCleared(item, st) {
  if (!item) return false;
  if (item.kind === 'missMax') {
    // ผ่านถ้า “แตะขยะไม่เกิน X ครั้ง” → miss ต้อง ≤ target
    return st.misses <= item.target;
  }
  return valueForKind(item.kind, st) >= item.target;
}

function makeHint(activeGoal, activeMini, st) {
  // ข้อความโค้ชแบบง่าย ๆ ตามสถานการณ์
  if (activeGoal && activeGoal.kind === 'score') {
    return 'โฟกัสเก็บของดีต่อเนื่อง คะแนนจะไหลเองเลย! 💪';
  }
  if (activeGoal && activeGoal.kind === 'goodHits') {
    return 'เล็งผัก ผลไม้ 🥦🍎 และนม 🥛 ให้โดนเป้าเยอะ ๆ เลย!';
  }
  if (activeGoal && activeGoal.kind === 'combo') {
    return 'พยายามไม่พลาด จะได้คอมโบยาว ๆ 🔥';
  }
  if (activeGoal && activeGoal.kind === 'missMax') {
    return 'ระวังของขยะ 🌭🍩 ให้ดี ถ้าไม่พลาดเพิ่มก็ผ่านภารกิจนี้แล้ว!';
  }
  if (st.comboMax >= 10) {
    return 'สุดยอด! คอมโบสูงมาก ลองรักษาจังหวะนี้ไว้ต่อไป ✨';
  }
  return 'เล็งของดีให้เร็ว และหลบของขยะให้ได้มากที่สุดนะ!';
}

// ----- main factory -----
export function makeQuestDirector(diff = 'normal') {
  const goals = normalizeList(GOODJUNK_GOALS, diff);
  const minis = normalizeList(GOODJUNK_MINIS, diff);

  const state = {
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    goodHits: 0,
    junkHits: 0,

    goalsCleared: 0,
    miniCleared: 0,
    currentGoalIndex: 0,
    currentMiniIndex: 0
  };

  function recomputePrefixCleared(list, st, isMini) {
    let cleared = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const val = valueForKind(item.kind, st);
      item.current = (item.kind === 'missMax')
        ? st.misses
        : val;
      item.done = isCleared(item, st);
      if (item.done) cleared++;
      else break; // sequential: ต้องผ่านอันก่อน ถึงจะขยับไปอันถัดไป
    }
    return cleared;
  }

  function emitUpdate() {
    const gIdx = Math.min(state.currentGoalIndex, goals.length - 1);
    const mIdx = Math.min(state.currentMiniIndex, minis.length - 1);

    const activeGoal = goals[gIdx] || null;
    const activeMini = minis[mIdx] || null;

    let goalPayload = null;
    if (activeGoal) {
      const cur = (activeGoal.kind === 'missMax')
        ? Math.max(0, activeGoal.target - state.misses)  // แสดงเป็น “เหลืออีกกี่ครั้ง”
        : activeGoal.current;
      goalPayload = {
        id: activeGoal.id,
        label: activeGoal.label,
        prog: cur,
        target: activeGoal.target,
        kind: activeGoal.kind,
        index: gIdx,
        total: goals.length,
        done: activeGoal.done
      };
    }

    let miniPayload = null;
    if (activeMini) {
      const cur = (activeMini.kind === 'missMax')
        ? Math.max(0, activeMini.target - state.misses)
        : activeMini.current;
      miniPayload = {
        id: activeMini.id,
        label: activeMini.label,
        prog: cur,
        target: activeMini.target,
        kind: activeMini.kind,
        index: mIdx,
        total: minis.length,
        done: activeMini.done,
        clearedCount: state.miniCleared
      };
    }

    const detail = {
      goal: goalPayload,
      mini: miniPayload,
      hint: makeHint(goalPayload, miniPayload, state)
    };

    if (typeof window !== 'undefined') {
      window.hhaMiniCleared = state.miniCleared;
      window.hhaMiniTotal   = minis.length;
      window.dispatchEvent(new CustomEvent('quest:update', { detail }));
    }
  }

  function recalcAndEmit() {
    state.goalsCleared = recomputePrefixCleared(goals, state, false);
    state.currentGoalIndex = state.goalsCleared;

    state.miniCleared = recomputePrefixCleared(minis, state, true);
    state.currentMiniIndex = state.miniCleared;

    emitUpdate();
  }

  // ----- hook global events -----
  function onScore(ev) {
    const d = ev && ev.detail ? ev.detail : {};
    if (typeof d.score === 'number') state.score = d.score;
    if (typeof d.combo === 'number') {
      state.combo = d.combo;
      if (d.combo > state.comboMax) state.comboMax = d.combo;
    }
    if (typeof d.misses === 'number') state.misses = d.misses;
    recalcAndEmit();
  }

  function onMiss(ev) {
    // backup ถ้า engine ยิง hha:miss แยก
    state.misses += 1;
    recalcAndEmit();
  }

  function onEvent(ev) {
    const d = ev && ev.detail ? ev.detail : {};
    if (d.type === 'hit' && d.isGood) {
      state.goodHits += 1;
    } else if (d.type === 'hit-junk') {
      state.junkHits += 1;
      // ความจริง miss นับจาก engine อยู่แล้ว แต่กันกรณีไม่มี
      if (typeof d.misses !== 'number') state.misses += 1;
    }
    recalcAndEmit();
  }

  function onEnd(ev) {
    // แค่ re-emit สรุปอีกทีตอนจบเกม
    recalcAndEmit();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hha:score', onScore);
    window.addEventListener('hha:miss', onMiss);
    window.addEventListener('hha:event', onEvent);
    window.addEventListener('hha:end', onEnd);
  }

  // ----- object ที่ GameEngine ใช้ -----
  const director = {
    // GameEngine เรียกทุกครั้งที่มีการอัปเดตสถานะ
    update(payload = {}) {
      if (typeof payload.score === 'number')  state.score = payload.score;
      if (typeof payload.combo === 'number') {
        state.combo = payload.combo;
        if (payload.combo > state.comboMax) state.comboMax = payload.combo;
      }
      if (typeof payload.misses === 'number') state.misses = payload.misses;
      if (typeof payload.goodHits === 'number') state.goodHits = payload.goodHits;
      if (typeof payload.junkHits === 'number') state.junkHits = payload.junkHits;
      recalcAndEmit();
    },

    getSummary() {
      return {
        goalsCleared: state.goalsCleared,
        goalsTotal: goals.length,
        miniCleared: state.miniCleared,
        miniTotal: minis.length
      };
    },

    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('hha:score', onScore);
        window.removeEventListener('hha:miss', onMiss);
        window.removeEventListener('hha:event', onEvent);
        window.removeEventListener('hha:end', onEnd);
      }
    }
  };

  // ยิงครั้งแรกตอนเริ่มเกม
  recalcAndEmit();

  return director;
}

// ให้ GameEngine ที่ยังใช้ชื่อเก่าเรียกได้
if (typeof window !== 'undefined') {
  window.makeQuestDirector = makeQuestDirector;
}

export default makeQuestDirector;
