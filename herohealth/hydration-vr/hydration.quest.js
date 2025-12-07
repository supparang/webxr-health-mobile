// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest system for Hydration VR
// - goal 2 — mini 3
// - Easy/Normal/Hard pools
// - Miss-type quests come LAST
// - Sorted from easy → hard
// - Compatible with hydration.safe.js (deck API)
//
// 2025-12-07 Fully Updated

import { hydrationGoalsFor } from './hydration.goals.js';
import { hydrationMinisFor } from './hydration.minis.js';
import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

/* ---------------------------------------------------
 * Identify MISS-type quests
 * --------------------------------------------------- */
function isMissQuest(item) {
  const id = String(item.id || '').toLowerCase();
  const label = String(item.label || '').toLowerCase();
  return (
    id.includes('miss') ||
    id.includes('nomiss') ||
    label.includes('พลาด') ||
    label.includes('miss')
  );
}

/* ---------------------------------------------------
 * Decorate quest for sorting: easy→hard
 * --------------------------------------------------- */
function decorateQuest(item) {
  const q = { ...item };
  q._isMiss = isMissQuest(item);

  const t = Number(item.target || 0);

  if (q._isMiss) {
    // MISS quest → higher target = easier
    q._difficultyScore = isNaN(t) ? 0 : t;
  } else {
    // normal quest → lower target = easier
    q._difficultyScore = isNaN(t) ? 0 : -t;
  }

  q._done = false;
  q._value = 0;

  return q;
}

/* ---------------------------------------------------
 * Split into nonMiss / miss buckets + sort
 * --------------------------------------------------- */
function splitAndSort(pool) {
  const decorated = pool.map(decorateQuest);

  const nonMiss = decorated
    .filter(q => !q._isMiss)
    .sort((a, b) => a._difficultyScore - b._difficultyScore);

  const miss = decorated
    .filter(q => q._isMiss)
    .sort((a, b) => a._difficultyScore - b._difficultyScore);

  return { nonMiss, miss };
}

/* ---------------------------------------------------
 * Pick 1 item from array
 * --------------------------------------------------- */
function take(arr) {
  if (!arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  const out = arr[idx];
  arr.splice(idx, 1);
  return out;
}

/* ---------------------------------------------------
 * createHydrationQuest(diff)
 * --------------------------------------------------- */
export function createHydrationQuest(diffRaw = 'normal') {
  const diff = normalizeHydrationDiff(diffRaw);

  // 1) load pools
  const goalPool = hydrationGoalsFor(diff);
  const miniPool = hydrationMinisFor(diff);

  // 2) split + sort
  const goalBuckets = splitAndSort(goalPool);
  const miniBuckets = splitAndSort(miniPool);

  // backup pools for continuous play
  let goalsNonMiss = [...goalBuckets.nonMiss];
  let goalsMiss    = [...goalBuckets.miss];

  let minisNonMiss = [...miniBuckets.nonMiss];
  let minisMiss    = [...miniBuckets.miss];

  // active quests
  let activeGoals = [];
  let activeMinis = [];

  // runtime stats
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

  /* ---------------------------------------------------
   * Update quest progress
   * --------------------------------------------------- */
  function refresh() {
    const S = mapHydrationState(stats);

    function update(q) {
      try {
        q._done = typeof q.check === 'function' ? !!q.check(S) : false;
        q._value = typeof q.prog === 'function' ? q.prog(S) : 0;
      } catch {
        q._done = false;
        q._value = 0;
      }
    }

    activeGoals.forEach(update);
    activeMinis.forEach(update);
  }

  function view(arr) {
    return arr.map(q => ({
      id: q.id,
      label: q.label,
      target: q.target,
      prog: q._value,
      done: q._done,
      isMiss: q._isMiss
    }));
  }

  /* ---------------------------------------------------
   * Update functions (safe.js calls)
   * --------------------------------------------------- */
  function updateScore(v) {
    stats.score = Number(v) || 0;
    refresh();
  }

  function updateCombo(v) {
    const c = Number(v) || 0;
    stats.combo = c;
    if (c > stats.comboMax) stats.comboMax = c;
    refresh();
  }

  function onGood() {
    stats.goodCount++;
    refresh();
  }

  function onJunk() {
    stats.junkMiss++;
    refresh();
  }

  function second() {
    stats.tick++;
    refresh();
  }

  /* ---------------------------------------------------
   * getProgress(kind)
   * --------------------------------------------------- */
  function getProgress(kind) {
    if (kind === 'goals') return view(activeGoals);
    if (kind === 'mini')  return view(activeMinis);
    return [...view(activeGoals), ...view(activeMinis)];
  }

  /* ---------------------------------------------------
   * drawGoals(2)
   * - always pick from nonMiss first
   * - when empty → pick from miss bucket
   * --------------------------------------------------- */
  function drawGoals(n = 2) {
    activeGoals = [];

    for (let i = 0; i < n; i++) {
      let pool = goalsNonMiss.length ? goalsNonMiss : goalsMiss;
      if (!pool.length) break;
      const q = take(pool);
      if (q) {
        q._done = false;
        q._value = 0;
        activeGoals.push(q);
      }
    }

    // refill when empty
    if (!goalsNonMiss.length && !goalsMiss.length) {
      goalsNonMiss = [...goalBuckets.nonMiss];
      goalsMiss    = [...goalBuckets.miss];
    }

    refresh();
  }

  /* ---------------------------------------------------
   * draw3() → select 3 mini quests
   * --------------------------------------------------- */
  function draw3() {
    activeMinis = [];

    for (let i = 0; i < 3; i++) {
      let pool = minisNonMiss.length ? minisNonMiss : minisMiss;
      if (!pool.length) break;
      const q = take(pool);
      if (q) {
        q._done = false;
        q._value = 0;
        activeMinis.push(q);
      }
    }

    // refill
    if (!minisNonMiss.length && !minisMiss.length) {
      minisNonMiss = [...miniBuckets.nonMiss];
      minisMiss    = [...miniBuckets.miss];
    }

    refresh();
  }

  // initial draw
  drawGoals(2);
  draw3();

  return {
    stats,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    drawGoals,
    draw3
  };
}

export default { createHydrationQuest };