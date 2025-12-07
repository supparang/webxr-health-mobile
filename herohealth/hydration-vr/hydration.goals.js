// === /herohealth/hydration-vr/hydration.goals.js ===
// Hydration Goals (10 ต่อ diff: easy / normal / hard)
// ใช้คู่กับ hydration.quest.js → createHydrationQuest(diff)
//
// state จาก mapHydrationState():
//   {
//     score,    // คะแนนรวม
//     combo,    // คอมโบปัจจุบัน
//     comboMax, // คอมโบสูงสุด
//     good,     // จำนวนครั้งที่ยิง "น้ำดี"
//     miss,     // จำนวนครั้งที่ยิง "น้ำไม่ดี" (junkMiss)
//     tick,     // เวลาเล่นสะสม (วินาที)
//     green     // เวลาโซน GREEN สะสม (วินาที)
//   }

'use strict';

// ---------- helper สำหรับป้องกัน NaN ----------
function safeNum(v) {
  v = Number(v);
  return Number.isFinite(v) ? v : 0;
}

// ---------- ชุด goal แยกตาม diff ----------
const HYDRATION_GOALS = {
  easy: [
    {
      id: 'easy_good_30',
      label: 'เก็บน้ำดีให้ได้อย่างน้อย 30 แก้ว 💧',
      target: 30,
      check: (s) => safeNum(s.good) >= 30,
      prog:  (s) => Math.min(safeNum(s.good), 30)
    },
    {
      id: 'easy_score_400',
      label: 'ทำคะแนนให้ถึง 400 แต้ม 🧮',
      target: 400,
      check: (s) => safeNum(s.score) >= 400,
      prog:  (s) => Math.min(safeNum(s.score), 400)
    },
    {
      id: 'easy_green_25s',
      label: 'รักษาโซนสมดุล (GREEN) รวม 25 วิ ⏱️',
      target: 25,
      check: (s) => safeNum(s.green) >= 25,
      prog:  (s) => Math.min(safeNum(s.green), 25)
    },
    {
      id: 'easy_comboMax_6',
      label: 'ทำคอมโบสูงสุดให้ถึง x6 หนึ่งครั้ง 🔗',
      target: 6,
      check: (s) => safeNum(s.comboMax) >= 6,
      prog:  (s) => Math.min(safeNum(s.comboMax), 6)
    },
    {
      id: 'easy_play_40s',
      label: 'เล่นจนครบอย่างน้อย 40 วิ (ไม่ยอมแพ้ง่าย ๆ) 💪',
      target: 40,
      check: (s) => safeNum(s.tick) >= 40,
      prog:  (s) => Math.min(safeNum(s.tick), 40)
    },
    {
      id: 'easy_ratio_good_per_miss_4',
      label: 'ให้ยิงน้ำดีเยอะกว่าน้ำหวานอย่างน้อย 4 เท่า 🍉>🧋',
      target: 4,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 8) return false; // กันเคสยิงน้อยเกินไป
        const ratio = good / (miss + 1);
        return ratio >= 4;
      },
      prog: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const ratio = good / (miss + 1);
        return Math.min(ratio, 4);
      }
    },

    // ---- MISS-type (จะถูกจัดให้มาใช้ทีหลัง) ----
    {
      id: 'easy_nomiss_15s',
      label: 'เล่น 15 วิ แรกแบบไม่พลาดเลย (nomiss) ✅',
      target: 0, // target = 0 miss
      check: (s) => safeNum(s.tick) >= 15 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)   // ใช้ miss เป็น prog ให้อ่านง่าย ๆ
    },
    {
      id: 'easy_miss_max_2',
      label: 'จบเกมโดยพลาดไม่เกิน 2 ครั้ง เท่านั้น 🧋❌',
      target: 2,
      check: (s) => safeNum(s.tick) >= 40 && safeNum(s.miss) <= 2,
      prog:  (s) => Math.min(safeNum(s.miss), 2)
    },
    {
      id: 'easy_miss_gap_long',
      label: 'เว้นระยะไม่พลาดนานอย่างน้อย 20 วิ ต่อเนื่อง 😌',
      target: 20,
      check: (s) => {
        // ประเมินแบบง่าย ๆ: ถ้าเวลาเล่นรวมมาก และ miss น้อย → ผ่าน
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 30) return false;
        return miss <= 1;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (miss === 0) return Math.min(tick, 20);
        if (miss === 1) return Math.min(tick - 10, 20);
        return 0;
      }
    },
    {
      id: 'easy_miss_under_30pct',
      label: 'ให้ MISS ไม่เกิน 30% ของจำนวนยิงทั้งหมด 🎯',
      target: 30,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 10) return false;
        const missPct = (miss * 100) / total;
        return missPct <= 30;
      },
      prog:  (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total <= 0) return 100;
        const missPct = (miss * 100) / total;
        return Math.min(Math.max(100 - missPct, 0), 100);
      }
    }
  ],

  normal: [
    {
      id: 'normal_good_45',
      label: 'เก็บน้ำดีให้ได้อย่างน้อย 45 แก้ว 💧💧',
      target: 45,
      check: (s) => safeNum(s.good) >= 45,
      prog:  (s) => Math.min(safeNum(s.good), 45)
    },
    {
      id: 'normal_score_700',
      label: 'ทำคะแนนให้ถึง 700 แต้ม 🧮',
      target: 700,
      check: (s) => safeNum(s.score) >= 700,
      prog:  (s) => Math.min(safeNum(s.score), 700)
    },
    {
      id: 'normal_green_40s',
      label: 'รักษาโซน GREEN รวมให้ได้ 40 วิ ⏱️',
      target: 40,
      check: (s) => safeNum(s.green) >= 40,
      prog:  (s) => Math.min(safeNum(s.green), 40)
    },
    {
      id: 'normal_comboMax_8',
      label: 'ทำคอมโบสูงสุดให้ถึง x8 หนึ่งครั้ง 🔗',
      target: 8,
      check: (s) => safeNum(s.comboMax) >= 8,
      prog:  (s) => Math.min(safeNum(s.comboMax), 8)
    },
    {
      id: 'normal_play_60s',
      label: 'เล่นจนครบอย่างน้อย 60 วิ 🕒',
      target: 60,
      check: (s) => safeNum(s.tick) >= 60,
      prog:  (s) => Math.min(safeNum(s.tick), 60)
    },
    {
      id: 'normal_ratio_good_per_miss_5',
      label: 'ยิงน้ำดีเยอะกว่าน้ำหวานอย่างน้อย 5 เท่า 💧≫🧋',
      target: 5,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 15) return false;
        const ratio = good / (miss + 1);
        return ratio >= 5;
      },
      prog: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const ratio = good / (miss + 1);
        return Math.min(ratio, 5);
      }
    },

    // MISS-type
    {
      id: 'normal_nomiss_20s',
      label: 'เล่น 20 วิ แรกแบบไม่พลาดเลย (nomiss) ✅',
      target: 0,
      check: (s) => safeNum(s.tick) >= 20 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)
    },
    {
      id: 'normal_miss_max_3',
      label: 'จบเกมโดยพลาดไม่เกิน 3 ครั้ง เท่านั้น 🧋❌',
      target: 3,
      check: (s) => safeNum(s.tick) >= 60 && safeNum(s.miss) <= 3,
      prog:  (s) => Math.min(safeNum(s.miss), 3)
    },
    {
      id: 'normal_miss_under_25pct',
      label: 'ให้ MISS ไม่เกิน 25% ของจำนวนยิงทั้งหมด 🎯',
      target: 25,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 15) return false;
        const missPct = (miss * 100) / total;
        return missPct <= 25;
      },
      prog:  (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total <= 0) return 100;
        const missPct = (miss * 100) / total;
        return Math.min(Math.max(100 - missPct, 0), 100);
      }
    },
    {
      id: 'normal_green_high_ratio',
      label: 'ให้เวลาที่อยู่ GREEN ≥ 60% ของเวลาทั้งหมด 🌈',
      target: 60,
      check: (s) => {
        const tick = safeNum(s.tick);
        const green = safeNum(s.green);
        if (tick < 40) return false;
        const pct = (green * 100) / tick;
        return pct >= 60;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const green = safeNum(s.green);
        if (tick <= 0) return 0;
        const pct = (green * 100) / tick;
        return Math.min(pct, 60);
      }
    }
  ],

  hard: [
    {
      id: 'hard_good_55',
      label: 'เก็บน้ำดีให้ได้อย่างน้อย 55 แก้ว 💧🔥',
      target: 55,
      check: (s) => safeNum(s.good) >= 55,
      prog:  (s) => Math.min(safeNum(s.good), 55)
    },
    {
      id: 'hard_score_1000',
      label: 'ทำคะแนนให้ถึง 1000 แต้ม 🧮🔥',
      target: 1000,
      check: (s) => safeNum(s.score) >= 1000,
      prog:  (s) => Math.min(safeNum(s.score), 1000)
    },
    {
      id: 'hard_green_55s',
      label: 'รักษาโซน GREEN รวมให้ได้ 55 วิ ⏱️',
      target: 55,
      check: (s) => safeNum(s.green) >= 55,
      prog:  (s) => Math.min(safeNum(s.green), 55)
    },
    {
      id: 'hard_comboMax_10',
      label: 'ทำคอมโบสูงสุดให้ถึง x10 หนึ่งครั้ง 🔗🔥',
      target: 10,
      check: (s) => safeNum(s.comboMax) >= 10,
      prog:  (s) => Math.min(safeNum(s.comboMax), 10)
    },
    {
      id: 'hard_play_75s',
      label: 'เล่นจนครบอย่างน้อย 75 วิ ไม่ถอดใจ 💪',
      target: 75,
      check: (s) => safeNum(s.tick) >= 75,
      prog:  (s) => Math.min(safeNum(s.tick), 75)
    },
    {
      id: 'hard_ratio_good_per_miss_6',
      label: 'ยิงน้ำดีอย่างน้อย 6 เท่าของน้ำหวาน 💧💧💧≫🧋',
      target: 6,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 20) return false;
        const ratio = good / (miss + 1);
        return ratio >= 6;
      },
      prog: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const ratio = good / (miss + 1);
        return Math.min(ratio, 6);
      }
    },

    // MISS-type (ยากขึ้น)
    {
      id: 'hard_nomiss_25s',
      label: 'เล่น 25 วิ แรกแบบไม่พลาดเลย (nomiss) ✅🔥',
      target: 0,
      check: (s) => safeNum(s.tick) >= 25 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)
    },
    {
      id: 'hard_miss_max_3_long',
      label: 'จบเกมโดยพลาดไม่เกิน 3 ครั้ง ภายในเกมยาว ๆ 🧋❌',
      target: 3,
      check: (s) => safeNum(s.tick) >= 75 && safeNum(s.miss) <= 3,
      prog:  (s) => Math.min(safeNum(s.miss), 3)
    },
    {
      id: 'hard_miss_under_20pct',
      label: 'ให้ MISS ไม่เกิน 20% ของจำนวนยิงทั้งหมด 🎯',
      target: 20,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 20) return false;
        const missPct = (miss * 100) / total;
        return missPct <= 20;
      },
      prog:  (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total <= 0) return 100;
        const missPct = (miss * 100) / total;
        return Math.min(Math.max(100 - missPct, 0), 100);
      }
    },
    {
      id: 'hard_green_high_ratio_70',
      label: 'ให้เวลาที่อยู่ GREEN ≥ 70% ของเวลาทั้งหมด 🌈🔥',
      target: 70,
      check: (s) => {
        const tick = safeNum(s.tick);
        const green = safeNum(s.green);
        if (tick < 60) return false;
        const pct = (green * 100) / tick;
        return pct >= 70;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const green = safeNum(s.green);
        if (tick <= 0) return 0;
        const pct = (green * 100) / tick;
        return Math.min(pct, 70);
      }
    }
  ]
};

// ---------- public API ----------
export function hydrationGoalsFor(diffRaw = 'normal') {
  const d = String(diffRaw || 'normal').toLowerCase();
  const key = (d === 'easy' || d === 'hard') ? d : 'normal';
  const pool = HYDRATION_GOALS[key] || HYDRATION_GOALS.normal;

  // คืน clone ใหม่กันการ mutate ข้ามรอบ
  return pool.map(g => ({ ...g }));
}

export default { hydrationGoalsFor };