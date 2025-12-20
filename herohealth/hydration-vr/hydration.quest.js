// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
// ใช้ร่วมกับ: hydration.safe.js (GOAL_TARGET = 2, MINI_TARGET = 3)
//
// ✅ FIX 2025-12-20:
// - เพิ่ม setZone(zone)
// - second(zone) นับ greenTick จากโซนจริง
// - รองรับโซน: GREEN / LOW / HIGH (case-safe)
// - คง API เดิมทั้งหมด + getGoalProgressInfo/getMiniProgressInfo

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

function normZone (z) {
  const Z = String(z || '').toUpperCase();
  if (Z === 'GREEN' || Z === 'LOW' || Z === 'HIGH') return Z;
  return 'GREEN';
}

function makeView (all) {
  const remain = all.filter(item => !item._done && !item.done);
  remain._all = all;
  return remain;
}

export function createHydrationQuest (diffKey = 'normal') {
  const diff = normDiff(diffKey);

  // ---------- เกณฑ์ภารกิจตามระดับความยาก ----------
  const cfg = {
    goalGreenTick: (diff === 'easy') ? 18 : (diff === 'hard' ? 32 : 25),
    goalBadZoneLimit: (diff === 'easy') ? 16 : (diff === 'hard' ? 10 : 12),

    miniComboBest: (diff === 'easy') ? 5 : (diff === 'hard' ? 10 : 7),
    miniGoodHits:  (diff === 'easy') ? 20 : (diff === 'hard' ? 30 : 24),
    miniNoJunkSec: (diff === 'easy') ? 10 : (diff === 'hard' ? 18 : 14)
  };

  // ---------- Stats ----------
  const stats = {
    zone: 'GREEN',
    greenTick: 0,     // ✅ จะนับจาก zone จริง
    timeSec: 0,

    goodHits: 0,
    junkHits: 0,
    secSinceJunk: 0,

    comboNow: 0,
    comboBest: 0,
    score: 0
  };

  // ---------- Goals ----------
  const goals = [
    {
      id: 'goal-green-time',
      label: 'โซนน้ำสีเขียว',
      text: 'รักษาน้ำในร่างกายให้อยู่โซนสีเขียวสะสมตามที่กำหนด',
      target: cfg.goalGreenTick,
      prog: 0,
      _done: false
    },
    {
      id: 'goal-stable-zone',
      label: 'โซนไม่เหวี่ยง',
      text: 'อยู่โซนแย่ (LOW/HIGH) ให้น้อยกว่าเกณฑ์ (ยิ่งน้อยยิ่งดี)',
      target: cfg.goalBadZoneLimit,
      prog: 0, // badZoneSec
      _done: false
    }
  ];

  // ---------- Minis ----------
  const minis = [
    {
      id: 'mini-combo',
      label: 'สายคอมโบ',
      text: 'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์ของระดับนี้',
      target: cfg.miniComboBest,
      prog: 0,
      _done: false
    },
    {
      id: 'mini-good-hits',
      label: 'เก็บน้ำดีรัว ๆ',
      text: 'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน',
      target: cfg.miniGoodHits,
      prog: 0,
      _done: false
    },
    {
      id: 'mini-no-junk',
      label: 'เลี่ยงน้ำหวาน',
      text: 'ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด',
      target: cfg.miniNoJunkSec,
      prog: 0,
      _done: false
    }
  ];

  function badZoneSec () {
    // ✅ เวลาที่ไม่ได้อยู่ GREEN (รวม LOW/HIGH)
    return clamp(stats.timeSec - stats.greenTick, 0, 9999);
  }

  function syncProgFields () {
    goals[0].prog = clamp(stats.greenTick, 0, goals[0].target);
    goals[1].prog = badZoneSec(); // ค่าเสีย (ต้อง <= target)

    minis[0].prog = clamp(stats.comboBest, 0, minis[0].target);
    minis[1].prog = clamp(stats.goodHits, 0, minis[1].target);
    minis[2].prog = clamp(stats.secSinceJunk, 0, minis[2].target);
  }

  function evalGoals () {
    syncProgFields();

    // Goal 1: greenTick ถึงเกณฑ์
    if (!goals[0]._done && stats.greenTick >= cfg.goalGreenTick) {
      goals[0]._done = true;
    }

    // Goal 2: badZoneSec <= limit และมีเวลาเล่นพอ (กันผ่านแบบ “ยังไม่เล่นครบ”)
    if (!goals[1]._done) {
      const bz = badZoneSec();
      if (bz <= cfg.goalBadZoneLimit && stats.timeSec >= cfg.goalGreenTick) {
        goals[1]._done = true;
      }
    }
  }

  function evalMinis () {
    syncProgFields();

    if (!minis[0]._done && stats.comboBest >= cfg.miniComboBest) minis[0]._done = true;
    if (!minis[1]._done && stats.goodHits >= cfg.miniGoodHits)   minis[1]._done = true;
    if (!minis[2]._done && stats.secSinceJunk >= cfg.miniNoJunkSec) minis[2]._done = true;
  }

  function evalAll () { evalGoals(); evalMinis(); }

  // ---------- API ----------
  function setZone (zone) {
    stats.zone = normZone(zone);
    evalGoals();
  }

  function updateScore (score) {
    stats.score = Number(score) || 0;
    evalAll();
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

  // ✅ FIX: second(zone) นับ greenTick จากโซนจริง
  function second (zoneMaybe) {
    if (zoneMaybe != null) stats.zone = normZone(zoneMaybe);

    stats.timeSec += 1;
    stats.secSinceJunk += 1;

    if (String(stats.zone).toUpperCase() === 'GREEN') {
      stats.greenTick += 1;
    }

    evalAll();
  }

  function nextGoal () {}
  function nextMini () {}

  function getProgress (kind) {
    if (kind === 'goals') return makeView(goals);
    if (kind === 'mini')  return makeView(minis);
    return [];
  }

  function getGoalProgressInfo(id) {
    syncProgFields();
    if (id === 'goal-green-time') {
      return { now: stats.greenTick, target: cfg.goalGreenTick, text: `${stats.greenTick}/${cfg.goalGreenTick} วินาที (โซน GREEN)` };
    }
    if (id === 'goal-stable-zone') {
      const bz = badZoneSec();
      return { now: bz, target: cfg.goalBadZoneLimit, text: `${bz}/${cfg.goalBadZoneLimit} วินาที (โซนแย่ ต้อง ≤ เกณฑ์)` };
    }
    return { now: 0, target: 0, text: '' };
  }

  function getMiniProgressInfo(id) {
    syncProgFields();
    if (id === 'mini-combo') {
      return { now: stats.comboBest, target: cfg.miniComboBest, text: `${stats.comboBest}/${cfg.miniComboBest} คอมโบสูงสุด` };
    }
    if (id === 'mini-good-hits') {
      return { now: stats.goodHits, target: cfg.miniGoodHits, text: `${stats.goodHits}/${cfg.miniGoodHits} น้ำดีที่เก็บ` };
    }
    if (id === 'mini-no-junk') {
      return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec, text: `${stats.secSinceJunk}/${cfg.miniNoJunkSec} วินาทีไม่โดนน้ำหวาน` };
    }
    return { now: 0, target: 0, text: '' };
  }

  function getMiniNoJunkProgress() {
    return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec };
  }

  // Debug helper
  try {
    ROOT.HHA_HYDRATION_QUEST_DEBUG = { cfg, stats, goals, minis };
  } catch {}

  return {
    cfg,
    stats,
    goals,
    minis,
    setZone,        // ✅ NEW
    updateScore,
    updateCombo,
    onGood,
    onJunk,
    second,
    getProgress,
    nextGoal,
    nextMini,
    getGoalProgressInfo,
    getMiniProgressInfo,
    getMiniNoJunkProgress
  };
}

export default { createHydrationQuest };
