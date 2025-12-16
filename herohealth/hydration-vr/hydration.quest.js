// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest Deck สำหรับ Hydration Quest VR
// ใช้ร่วมกับ: hydration.safe.js (GOAL_TARGET = 2, MINI_TARGET = 3)
//
// ดีไซน์ภารกิจ:
//   Goals (2 เป้าต่อเกม)
//     G1: รักษาโซนน้ำให้อยู่ "เขียว" สะสมครบตามเกณฑ์ (greenTick)
//     G2: เล่นทั้งเกมโดย "โซนแย่" (LOW / HIGH RED) สะสมน้อยกว่าเกณฑ์
//
//   Mini Quests (3 ภารกิจย่อยต่อเกม)
//     M1: ทำคอมโบให้ถึงตามเกณฑ์ (comboBest)
//     M2: เก็บน้ำดี (onGood) ให้ครบตามกำหนด
//     M3: มีช่วง "ไม่โดนน้ำหวาน" ต่อเนื่องตามเวลา (secSinceJunk)
//
//  ทั้งหมดจะถูกนับผ่านฟังก์ชัน: updateScore / updateCombo / onGood / onJunk / second
//  และให้ hydration.safe.js อ่านด้วย getProgress('goals'|'mini')

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

export function createHydrationQuest (diffKey = 'normal') {
  const diff = normDiff(diffKey);

  // ---------- เกณฑ์ภารกิจตามระดับความยาก ----------
  const cfg = {
    // Goal 1: ต้องอยู่โซนเขียวสะสมกี่วินาที
    goalGreenTick: (diff === 'easy')
      ? 18
      : (diff === 'hard' ? 32 : 25),

    // Goal 2: เวลาที่ "อยู่นอกโซนดี" ได้สูงสุด
    goalBadZoneLimit: (diff === 'easy')
      ? 16
      : (diff === 'hard' ? 10 : 12),

    // Mini 1: คอมโบสูงสุด
    miniComboBest: (diff === 'easy')
      ? 5
      : (diff === 'hard' ? 10 : 7),

    // Mini 2: จำนวน hit น้ำดีทั้งหมด
    miniGoodHits: (diff === 'easy')
      ? 20
      : (diff === 'hard' ? 30 : 24),

    // Mini 3: ช่วงวินาทีที่ไม่โดนน้ำหวานต่อเนื่อง
    miniNoJunkSec: (diff === 'easy')
      ? 10
      : (diff === 'hard' ? 18 : 14)
  };

  // ---------- Stats ภายในเด็ค ----------
  const stats = {
    zone: 'GREEN',      // hydration.safe.js จะ sync ให้ทุกวินาที
    greenTick: 0,       // hydration.safe.js จะเป็นตัว +1 เมื่อ zone GREEN
    timeSec: 0,

    goodHits: 0,        // น้ำดี (รวม power-ups)
    junkHits: 0,        // น้ำหวาน / คาเฟอีนที่โดนจริง
    secSinceJunk: 0,    // วินาทีที่ "ไม่โดนน้ำหวาน" ต่อเนื่อง

    comboNow: 0,
    comboBest: 0,
    score: 0
  };

  // ---------- Goals (2 อันต่อเกม) ----------
  const goals = [
    {
      id: 'goal-green-time',
      label: 'โซนน้ำสีเขียว',
      text: 'รักษาน้ำในร่างกายให้โซนสีเขียวสะสมตามที่กำหนด',
      _done: false
    },
    {
      id: 'goal-stable-zone',
      label: 'โซนไม่เหวี่ยง',
      text: 'พยายามไม่ให้น้ำในร่างกายเหวี่ยงไปโซนแย่บ่อยเกินไป',
      _done: false
    }
  ];

  // ---------- Mini Quests (3 อันต่อเกม) ----------
  const minis = [
    {
      id: 'mini-combo',
      label: 'สายคอมโบ',
      text: 'ทำคอมโบสูงสุดให้ถึงตามเกณฑ์ของระดับนี้',
      _done: false
    },
    {
      id: 'mini-good-hits',
      label: 'เก็บน้ำดีรัว ๆ',
      text: 'เก็บน้ำดี (💧 / 🥛 / 🍉 / Power-ups) ให้ครบตามจำนวน',
      _done: false
    },
    {
      id: 'mini-no-junk',
      label: 'เลี่ยงน้ำหวาน',
      text: 'มีช่วงที่ไม่โดนน้ำหวานต่อเนื่องตามเวลาที่กำหนด',
      _done: false
    }
  ];

  // ---------- Evaluate Goals / Mini ทุกครั้งที่ stats เปลี่ยน ----------
  function evalGoals () {
    // Goal 1: อยู่โซน GREEN สะสมตามเกณฑ์
    if (!goals[0]._done && stats.greenTick >= cfg.goalGreenTick) {
      goals[0]._done = true;
    }

    // Goal 2: เวลาที่อยู่นอกโซนดี (LOW / HIGH / โซนอื่น) ต้องไม่เกิน limit
    if (!goals[1]._done) {
      const badZoneSec = clamp(stats.timeSec - stats.greenTick, 0, 9999);
      if (badZoneSec <= cfg.goalBadZoneLimit && stats.timeSec >= cfg.goalGreenTick) {
        // ให้เริ่มเช็คหลังจากเล่นไปสักพัก จะได้ไม่จบไวเกิน
        goals[1]._done = true;
      }
    }
  }

  function evalMinis () {
    // M1: คอมโบสูงสุด
    if (!minis[0]._done && stats.comboBest >= cfg.miniComboBest) {
      minis[0]._done = true;
    }

    // M2: น้ำดีรวม
    if (!minis[1]._done && stats.goodHits >= cfg.miniGoodHits) {
      minis[1]._done = true;
    }

    // M3: ไม่โดนน้ำหวานต่อเนื่อง
    if (!minis[2]._done && stats.secSinceJunk >= cfg.miniNoJunkSec) {
      minis[2]._done = true;
    }
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
    stats.secSinceJunk = 0; // ✅ รีเซ็ตเฉพาะ “โดนจริง”
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

  // ✅ NEW: progress สำหรับ mini “เลี่ยงน้ำหวาน”
  function getMiniNoJunkProgress () {
    return { now: stats.secSinceJunk, target: cfg.miniNoJunkSec };
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
    nextMini,
    getMiniNoJunkProgress // ✅ NEW
  };
}

export default {
  createHydrationQuest
};
