// === /herohealth/hydration-vr/hydration.quest.js ===
// Hydration Quest Deck — 2 Goal + 3 Mini

'use strict';

import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';

// helper แปลง diff
function normalizeHydrationDiff (raw) {
  const t = String(raw || 'normal').toLowerCase();
  if (t === 'easy' || t === 'normal' || t === 'hard') return t;
  return 'normal';
}

// map stats → state ที่ใช้ใน check/prog ของ quest
function mapHydrationState (stats) {
  const s = stats || {};
  const tick = Number(s.tick || 0);
  const greenTick = Number(s.greenTick || 0);

  return {
    score: Number(s.score || 0),
    combo: Number(s.combo || 0),
    comboMax: Number(s.comboMax || 0),
    good: Number(s.goodCount || 0),
    goodCount: Number(s.goodCount || 0),
    miss: Number(s.junkMiss || 0),
    junkMiss: Number(s.junkMiss || 0),
    timeSec: tick,
    tick,
    greenTick,
    greenRatio: tick > 0 ? greenTick / tick : 0,
    zone: s.zone || 'GREEN'
  };
}

function isMissQuest (item) {
  const id = String(item.id || '').toLowerCase();
  const label = String(item.label || '');
  if (id.includes('nomiss') || id.includes('miss')) return true;
  if (label.includes('พลาด')) return true;
  return false;
}

export function createHydrationQuest (diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  // ดึงภารกิจ แล้วตัดให้เหลือ 2/3 ตามดีไซน์
  const goals = hydrationGoalsFor(diff)
    .slice(0, 2)
    .map(q => ({
      ...q,
      _done: false,
      _value: 0,
      _isMiss: isMissQuest(q)
    }));

  const minis = hydrationMinisFor(diff)
    .slice(0, 3)
    .map(q => ({
      ...q,
      _done: false,
      _value: 0,
      _isMiss: isMissQuest(q)
    }));

  const stats = {
    score: 0,
    combo: 0,
    comboMax: 0,
    goodCount: 0,
    junkMiss: 0,
    tick: 0,
    greenTick: 0,
    zone: 'GREEN'
  };

  function refreshProgress () {
    const s = mapHydrationState(stats);

    function updateItem (q) {
      try {
        const done = typeof q.check === 'function' ? !!q.check(s) : false;
        const val  = typeof q.prog === 'function' ? q.prog(s) : 0;
        q._done   = done;
        q._value  = val;
      } catch {
        q._done  = false;
        q._value = 0;
      }
    }

    goals.forEach(updateItem);
    minis.forEach(updateItem);
  }

  function updateScore (v) {
    stats.score = Number(v) || 0;
    refreshProgress();
  }

  function updateCombo (v) {
    const c = Number(v) || 0;
    stats.combo = c;
    if (c > stats.comboMax) stats.comboMax = c;
    refreshProgress();
  }

  function onGood () {
    stats.goodCount += 1;
    refreshProgress();
  }

  function onJunk () {
    stats.junkMiss += 1;
    refreshProgress();
  }

  function second () {
    stats.tick += 1;
    refreshProgress();
  }

  function makeView (arr) {
    return arr.map(q => ({
      id: q.id,
      label: q.label,
      target: q.target,
      prog: q._value,
      done: !!q._done,
      isMiss: !!q._isMiss
    }));
  }

  function getProgress (kind) {
    if (kind === 'goals') return makeView(goals);
    if (kind === 'mini')  return makeView(minis);
    return [
      ...makeView(goals),
      ...makeView(minis)
    ];
  }

  refreshProgress();

  return {
    stats,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress
  };
}

export default { createHydrationQuest };