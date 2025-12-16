// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
// ✅ PATCH: ยิง event 'hha:celebrate' เมื่อจบแต่ละภารกิจ + จบครบทั้งหมด
//
// event detail ตัวอย่าง:
// { kind:'goal'|'mini'|'all', id:'mini-no-junk', label:'เลี่ยงน้ำหวาน', diff:'normal', cfg:{...}, stats:{...} }

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function normDiff (d) {
  d = String(d || 'normal').toLowerCase();
  if (d !== 'easy' && d !== 'hard') return 'normal';
  return d;
}

// ทำ array view ที่แนบ _all ไว้ด้วย ให้ hydration.safe.js ใช้
function makeView (all) {
  const remain = all.filter(item => !item._done && !item.done);
  remain._all = all;
  return remain;
}

// ✅ helper ยิง event ฉลอง
function fireCelebrate(detail) {
  try {
    ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail }));
  } catch (_) {}
}

export function createHydrationQuest (diffKey = 'normal') {
  const diff = normDiff(diffKey);

  // ---------- เกณฑ์ภารกิจตามระดับความยาก ----------
  const cfg = {
    goalGreenTick: (diff === 'easy') ? 18 : (diff === 'hard' ? 32 : 25),
    goalBadZoneLimit: (diff === 'easy') ? 16 : (diff === 'hard' ? 10 : 12),
    miniComboBest: (diff === 'easy') ? 5 : (diff === 'hard' ? 10 : 7),
    miniGoodHits: (diff === 'easy') ? 20 : (diff === 'hard' ? 30 : 24),
    miniNoJunkSec: (diff === 'easy') ? 10 : (diff === 'hard' ? 18 : 14)
  };

  // ---------- Stats ภายในเด็ค ----------
  const stats = {
    zone: 'GREEN',
    greenTick: 0,
    timeSec: 0,

    goodHits: 0,
    junkHits: 0,
    secSinceJunk: 0,

    comboNow: 0,
    comboBest: 0,
    score: 0
  };

  // ---------- Goals (2 อันต่อเกม) ----------
  const goals = [
    { id: 'goal-green-time',  label: 'โซนน้ำสีเขียว', text: 'รักษาน้ำในร่างกายให้โซนสีเขียวสะสมตามที่กำหนด', _done: false },
    { id: 'goal-stable-zone', label: 'โซนไม่เหวี่ยง', text: 'พยายามไม่ให้น้ำในร่างกายเหวี่ยงไปโซนแย่บ่อยเกินไป', _done: false }
  ];

  // ---------- Mini Quests (3 อันต่อเกม) ----------
  const minis = [
    { id: 'mini-combo',     label: 'สายคอมโบ',     text: 'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์ของระดับนี้', _done: false },
    { id: 'mini-good-hits', label: 'เก็บน้ำดีรัว ๆ', text: 'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน', _done: false },
    { id: 'mini-no-junk',   label: 'เลี่ยงน้ำหวาน', text: 'มีช่วงที่ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด', _done: false }
  ];

  // ✅ กันยิงซ้ำ
  const fired = {
    goals: new Set(),
    minis: new Set(),
    all: false
  };

  function celebrateIfNeeded(kind, item) {
    if (!item || !item._done) return;

    if (kind === 'goal') {
      if (fired.goals.has(item.id)) return;
      fired.goals.add(item.id);

      fireCelebrate({
        kind: 'goal',
        id: item.id,
        label: item.label,
        diff,
        cfg,
        stats: { ...stats }
      });
      return;
    }

    if (kind === 'mini') {
      if (fired.minis.has(item.id)) return;
      fired.minis.add(item.id);

      fireCelebrate({
        kind: 'mini',
        id: item.id,
        label: item.label,
        diff,
        cfg,
        stats: { ...stats }
      });
      return;
    }
  }

  function celebrateAllIfNeeded() {
    if (fired.all) return;
    const allGoalsDone = goals.every(g => !!g._done);
    const allMinisDone = minis.every(m => !!m._done);
    if (allGoalsDone && allMinisDone) {
      fired.all = true;
      fireCelebrate({
        kind: 'all',
        id: 'all-complete',
        label: 'เคลียร์ครบทุกภารกิจ!',
        diff,
        cfg,
        stats: { ...stats }
      });
    }
  }

  // ---------- Evaluate Goals / Mini ทุกครั้งที่ stats เปลี่ยน ----------
  function evalGoals () {
    // Goal 1
    if (!goals[0]._done && stats.greenTick >= cfg.goalGreenTick) {
      goals[0]._done = true;
      celebrateIfNeeded('goal', goals[0]);
    }

    // Goal 2
    if (!goals[1]._done) {
      const badZoneSec = clamp(stats.timeSec - stats.greenTick, 0, 9999);
      if (badZoneSec <= cfg.goalBadZoneLimit && stats.timeSec >= cfg.goalGreenTick) {
        goals[1]._done = true;
        celebrateIfNeeded('goal', goals[1]);
      }
    }

    celebrateAllIfNeeded();
  }

  function evalMinis () {
    // M1
    if (!minis[0]._done && stats.comboBest >= cfg.miniComboBest) {
      minis[0]._done = true;
      celebrateIfNeeded('mini', minis[0]);
    }

    // M2
    if (!minis[1]._done && stats.goodHits >= cfg.miniGoodHits) {
      minis[1]._done = true;
      celebrateIfNeeded('mini', minis[1]);
    }

    // M3
    if (!minis[2]._done && stats.secSinceJunk >= cfg.miniNoJunkSec) {
      minis[2]._done = true;
      celebrateIfNeeded('mini', minis[2]);
    }

    celebrateAllIfNeeded();
  }

  function evalAll () {
    evalGoals();
    evalMinis();
  }

  // ---------- API ที่ hydration.safe.js เรียก ----------
  function updateScore (score) {
    stats.score = Number(score) || 0;
  }

  function updateCombo (combo) {
    const c = combo | 0;
    stats.comboNow = c;
    if (c > stats.comboBest) stats.comboBest = c;
    evalMinis();
  }

  function onGood () {
    stats.goodHits += 1;
    evalMinis();
  }

  function onJunk () {
    stats.junkHits += 1;
    stats.secSinceJunk = 0;
    evalAll();
  }

  // เรียกทุกวินาทีจาก hydration.safe.js (หลังจาก greenTick / zone ถูกอัปเดตแล้ว)
  function second () {
    stats.timeSec += 1;
    stats.secSinceJunk += 1;
    evalAll();
  }

  function nextGoal () {}
  function nextMini () {}

  function getProgress (kind) {
    if (kind === 'goals') return makeView(goals);
    if (kind === 'mini')  return makeView(minis);
    return [];
  }

  // ---------- Debug helper ----------
  try {
    ROOT.HHA_HYDRATION_QUEST_DEBUG = { cfg, stats, goals, minis };
  } catch {}

  return {
    stats,
    goals,
    minis,
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    nextGoal,
    nextMini
  };
}

export default { createHydrationQuest };