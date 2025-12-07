// === /herohealth/hydration-vr/hydration.minis.js ===
// Hydration Mini Quests (15 ต่อ diff: easy / normal / hard)
// ใช้คู่กับ hydration.quest.js → hydrationMinisFor(diff)
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

function safeNum(v) {
  v = Number(v);
  return Number.isFinite(v) ? v : 0;
}

const HYDRATION_MINIS = {
  easy: [
    // ---- 1. ยิงน้ำดี / คอมโบ / คะแนน แบบง่าย ๆ ----
    {
      id: 'mini_easy_good_12',
      label: 'มินิ: เก็บน้ำดีให้ได้ 12 แก้ว 💧',
      target: 12,
      check: (s) => safeNum(s.good) >= 12,
      prog:  (s) => Math.min(safeNum(s.good), 12)
    },
    {
      id: 'mini_easy_good_18',
      label: 'มินิ: เก็บน้ำดีให้ได้ 18 แก้ว 💧💧',
      target: 18,
      check: (s) => safeNum(s.good) >= 18,
      prog:  (s) => Math.min(safeNum(s.good), 18)
    },
    {
      id: 'mini_easy_score_250',
      label: 'มินิ: ทำคะแนนให้ถึง 250 แต้ม 🧮',
      target: 250,
      check: (s) => safeNum(s.score) >= 250,
      prog:  (s) => Math.min(safeNum(s.score), 250)
    },
    {
      id: 'mini_easy_comboMax_4',
      label: 'มินิ: ทำคอมโบสูงสุดให้ถึง x4 ครั้งเดียวก็ได้ 🔗',
      target: 4,
      check: (s) => safeNum(s.comboMax) >= 4,
      prog:  (s) => Math.min(safeNum(s.comboMax), 4)
    },

    // ---- 2. เวลารวม / GREEN zone ----
    {
      id: 'mini_easy_play_25s',
      label: 'มินิ: เล่นต่อเนื่องให้ครบ 25 วิ ⏱️',
      target: 25,
      check: (s) => safeNum(s.tick) >= 25,
      prog:  (s) => Math.min(safeNum(s.tick), 25)
    },
    {
      id: 'mini_easy_green_15s',
      label: 'มินิ: อยู่โซนน้ำสมดุล (GREEN) สะสม 15 วิ 🌈',
      target: 15,
      check: (s) => safeNum(s.green) >= 15,
      prog:  (s) => Math.min(safeNum(s.green), 15)
    },
    {
      id: 'mini_easy_green_ratio_50',
      label: 'มินิ: ให้เวลา GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
      target: 50,
      check: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t < 20) return false;
        const pct = (g * 100) / t;
        return pct >= 50;
      },
      prog: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t <= 0) return 0;
        const pct = (g * 100) / t;
        return Math.min(pct, 50);
      }
    },

    // ---- 3. สัดส่วน good / miss ----
    {
      id: 'mini_easy_good_more_than_miss_3x',
      label: 'มินิ: ยิงน้ำดีมากกว่าน้ำหวานอย่างน้อย 3 เท่า 💧≫🧋',
      target: 3,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 9) return false;
        const ratio = good / (miss + 1);
        return ratio >= 3;
      },
      prog: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const ratio = good / (miss + 1);
        return Math.min(ratio, 3);
      }
    },
    {
      id: 'mini_easy_good_20_low_miss',
      label: 'มินิ: เก็บน้ำดี 20 แก้ว แต่ MISS ไม่เกิน 3 ครั้ง 🎯',
      target: 20,
      check: (s) => safeNum(s.good) >= 20 && safeNum(s.miss) <= 3,
      prog:  (s) => Math.min(safeNum(s.good), 20)
    },

    // ---- 4. MINI แบบ MISS / NOMISS (ให้ไปท้ายสุดโดย system) ----
    {
      id: 'mini_easy_nomiss_10s',
      label: 'มินิ: ช่วง 10 วิ แรก พยายามไม่พลาดเลย (nomiss) ✅',
      target: 0,
      check: (s) => safeNum(s.tick) >= 10 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)
    },
    {
      id: 'mini_easy_miss_max_3',
      label: 'มินิ: จบเกมโดยพลาดไม่เกิน 3 ครั้ง 🧋❌',
      target: 3,
      check: (s) => safeNum(s.tick) >= 30 && safeNum(s.miss) <= 3,
      prog:  (s) => Math.min(safeNum(s.miss), 3)
    },
    {
      id: 'mini_easy_miss_under_40pct',
      label: 'มินิ: ให้ MISS ไม่เกิน 40% ของจำนวนยิงทั้งหมด 📊',
      target: 40,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 8) return false;
        const missPct = (miss * 100) / total;
        return missPct <= 40;
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
      id: 'mini_easy_miss_gap_15s',
      label: 'มินิ: มีช่วงเวลาเล่นต่อเนื่องแบบไม่พลาด 15 วิ 😌',
      target: 15,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 20) return false;
        return miss <= 1;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (miss === 0) return Math.min(tick, 15);
        if (miss === 1) return Math.min(tick - 8, 15);
        return 0;
      }
    },
    {
      id: 'mini_easy_miss_not_last10s',
      label: 'มินิ: 10 วิ สุดท้ายห้ามพลาดเลย (no miss ช่วงท้าย) 🧊',
      target: 0,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 25) return false;
        // ประเมินหยาบ ๆ: ถ้า miss <= 1 และ tick ค่อนข้างเยอะ → ผ่าน
        return miss <= 1;
      },
      prog:  (s) => safeNum(s.miss)
    }
  ],

  normal: [
    // ---- 1. good / combo / score ----
    {
      id: 'mini_normal_good_20',
      label: 'มินิ: เก็บน้ำดีให้ได้ 20 แก้ว 💧',
      target: 20,
      check: (s) => safeNum(s.good) >= 20,
      prog:  (s) => Math.min(safeNum(s.good), 20)
    },
    {
      id: 'mini_normal_good_28',
      label: 'มินิ: เก็บน้ำดีให้ได้ 28 แก้ว 💧💧',
      target: 28,
      check: (s) => safeNum(s.good) >= 28,
      prog:  (s) => Math.min(safeNum(s.good), 28)
    },
    {
      id: 'mini_normal_score_450',
      label: 'มินิ: ทำคะแนนให้ถึง 450 แต้ม 🧮',
      target: 450,
      check: (s) => safeNum(s.score) >= 450,
      prog:  (s) => Math.min(safeNum(s.score), 450)
    },
    {
      id: 'mini_normal_comboMax_6',
      label: 'มินิ: ทำคอมโบสูงสุดให้ถึง x6 หนึ่งครั้ง 🔗',
      target: 6,
      check: (s) => safeNum(s.comboMax) >= 6,
      prog:  (s) => Math.min(safeNum(s.comboMax), 6)
    },

    // ---- 2. เวลา / GREEN ----
    {
      id: 'mini_normal_play_40s',
      label: 'มินิ: เล่นให้ครบ 40 วิ โดยไม่ท้อถอย ⏱️',
      target: 40,
      check: (s) => safeNum(s.tick) >= 40,
      prog:  (s) => Math.min(safeNum(s.tick), 40)
    },
    {
      id: 'mini_normal_green_25s',
      label: 'มินิ: อยู่โซน GREEN สะสมให้ได้ 25 วิ 🌈',
      target: 25,
      check: (s) => safeNum(s.green) >= 25,
      prog:  (s) => Math.min(safeNum(s.green), 25)
    },
    {
      id: 'mini_normal_green_ratio_60',
      label: 'มินิ: ให้ GREEN ≥ 60% ของเวลารวม 💚',
      target: 60,
      check: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t < 30) return false;
        const pct = (g * 100) / t;
        return pct >= 60;
      },
      prog: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t <= 0) return 0;
        const pct = (g * 100) / t;
        return Math.min(pct, 60);
      }
    },

    // ---- 3. good / miss สัดส่วน ----
    {
      id: 'mini_normal_good_more_than_miss_4x',
      label: 'มินิ: ยิงน้ำดีมากกว่าน้ำหวานอย่างน้อย 4 เท่า 💧≫🧋',
      target: 4,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 15) return false;
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
    {
      id: 'mini_normal_good_30_low_miss',
      label: 'มินิ: เก็บน้ำดี 30 แก้ว แต่ MISS ไม่เกิน 4 ครั้ง 🎯',
      target: 30,
      check: (s) => safeNum(s.good) >= 30 && safeNum(s.miss) <= 4,
      prog:  (s) => Math.min(safeNum(s.good), 30)
    },

    // ---- 4. MISS / NOMISS ----
    {
      id: 'mini_normal_nomiss_15s',
      label: 'มินิ: 15 วิ แรก พยายามไม่พลาดเลย (nomiss) ✅',
      target: 0,
      check: (s) => safeNum(s.tick) >= 15 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)
    },
    {
      id: 'mini_normal_miss_max_4',
      label: 'มินิ: จบเกมโดยพลาดไม่เกิน 4 ครั้ง 🧋❌',
      target: 4,
      check: (s) => safeNum(s.tick) >= 50 && safeNum(s.miss) <= 4,
      prog:  (s) => Math.min(safeNum(s.miss), 4)
    },
    {
      id: 'mini_normal_miss_under_30pct',
      label: 'มินิ: ให้ MISS ไม่เกิน 30% ของจำนวนยิงทั้งหมด 📊',
      target: 30,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 15) return false;
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
    },
    {
      id: 'mini_normal_miss_gap_20s',
      label: 'มินิ: มีช่วงเล่นต่อเนื่องไม่พลาด 20 วิ 😌',
      target: 20,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 35) return false;
        return miss <= 2;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (miss === 0) return Math.min(tick, 20);
        if (miss === 1) return Math.min(tick - 8, 20);
        if (miss === 2) return Math.min(tick - 12, 20);
        return 0;
      }
    },
    {
      id: 'mini_normal_miss_not_last8s',
      label: 'มินิ: 8 วิ สุดท้ายพยายามไม่พลาดเลย (no miss ท้ายเกม) 🧊',
      target: 0,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 40) return false;
        return miss <= 2;
      },
      prog:  (s) => safeNum(s.miss)
    }
  ],

  hard: [
    // ---- 1. good / combo / score ----
    {
      id: 'mini_hard_good_30',
      label: 'มินิ: เก็บน้ำดีให้ได้ 30 แก้ว 💧🔥',
      target: 30,
      check: (s) => safeNum(s.good) >= 30,
      prog:  (s) => Math.min(safeNum(s.good), 30)
    },
    {
      id: 'mini_hard_good_40',
      label: 'มินิ: เก็บน้ำดีให้ได้ 40 แก้ว 💧💧🔥',
      target: 40,
      check: (s) => safeNum(s.good) >= 40,
      prog:  (s) => Math.min(safeNum(s.good), 40)
    },
    {
      id: 'mini_hard_score_650',
      label: 'มินิ: ทำคะแนนให้ถึง 650 แต้ม 🧮🔥',
      target: 650,
      check: (s) => safeNum(s.score) >= 650,
      prog:  (s) => Math.min(safeNum(s.score), 650)
    },
    {
      id: 'mini_hard_comboMax_8',
      label: 'มินิ: ทำคอมโบสูงสุดให้ถึง x8 หนึ่งครั้ง 🔗🔥',
      target: 8,
      check: (s) => safeNum(s.comboMax) >= 8,
      prog:  (s) => Math.min(safeNum(s.comboMax), 8)
    },

    // ---- 2. เวลา / GREEN ----
    {
      id: 'mini_hard_play_55s',
      label: 'มินิ: เล่นให้ครบ 55 วิ แบบใจสู้สุด ๆ ⏱️',
      target: 55,
      check: (s) => safeNum(s.tick) >= 55,
      prog:  (s) => Math.min(safeNum(s.tick), 55)
    },
    {
      id: 'mini_hard_green_35s',
      label: 'มินิ: อยู่โซน GREEN สะสมให้ได้ 35 วิ 🌈🔥',
      target: 35,
      check: (s) => safeNum(s.green) >= 35,
      prog:  (s) => Math.min(safeNum(s.green), 35)
    },
    {
      id: 'mini_hard_green_ratio_70',
      label: 'มินิ: ให้ GREEN ≥ 70% ของเวลารวม 💚🔥',
      target: 70,
      check: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t < 45) return false;
        const pct = (g * 100) / t;
        return pct >= 70;
      },
      prog: (s) => {
        const t = safeNum(s.tick);
        const g = safeNum(s.green);
        if (t <= 0) return 0;
        const pct = (g * 100) / t;
        return Math.min(pct, 70);
      }
    },

    // ---- 3. good / miss สัดส่วน ----
    {
      id: 'mini_hard_good_more_than_miss_5x',
      label: 'มินิ: ยิงน้ำดีอย่างน้อย 5 เท่าของน้ำหวาน 💧≫🧋🔥',
      target: 5,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        if (good < 20) return false;
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
    {
      id: 'mini_hard_good_35_low_miss',
      label: 'มินิ: เก็บน้ำดี 35 แก้ว แต่ MISS ไม่เกิน 4 ครั้ง 🎯🔥',
      target: 35,
      check: (s) => safeNum(s.good) >= 35 && safeNum(s.miss) <= 4,
      prog:  (s) => Math.min(safeNum(s.good), 35)
    },

    // ---- 4. MISS / NOMISS ----
    {
      id: 'mini_hard_nomiss_18s',
      label: 'มินิ: 18 วิ แรก ไม่พลาดเลย (nomiss โหด ๆ) ✅🔥',
      target: 0,
      check: (s) => safeNum(s.tick) >= 18 && safeNum(s.miss) === 0,
      prog:  (s) => safeNum(s.miss)
    },
    {
      id: 'mini_hard_miss_max_4',
      label: 'มินิ: จบเกมโดยพลาดไม่เกิน 4 ครั้ง 🧋❌🔥',
      target: 4,
      check: (s) => safeNum(s.tick) >= 60 && safeNum(s.miss) <= 4,
      prog:  (s) => Math.min(safeNum(s.miss), 4)
    },
    {
      id: 'mini_hard_miss_under_25pct',
      label: 'มินิ: ให้ MISS ไม่เกิน 25% ของจำนวนยิงทั้งหมด 📊🔥',
      target: 25,
      check: (s) => {
        const good = safeNum(s.good);
        const miss = safeNum(s.miss);
        const total = good + miss;
        if (total < 20) return false;
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
      id: 'mini_hard_miss_gap_25s',
      label: 'มินิ: มีช่วงเล่นต่อเนื่องไม่พลาด 25 วิ เต็ม ๆ 😌🔥',
      target: 25,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 50) return false;
        return miss <= 3;
      },
      prog:  (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (miss === 0) return Math.min(tick, 25);
        if (miss === 1) return Math.min(tick - 10, 25);
        if (miss === 2) return Math.min(tick - 14, 25);
        if (miss === 3) return Math.min(tick - 18, 25);
        return 0;
      }
    },
    {
      id: 'mini_hard_miss_not_last10s',
      label: 'มินิ: 10 วิ สุดท้ายห้ามพลาดเลย (no miss ท้ายเกมโหมดโหด) 🧊🔥',
      target: 0,
      check: (s) => {
        const tick = safeNum(s.tick);
        const miss = safeNum(s.miss);
        if (tick < 55) return false;
        return miss <= 3;
      },
      prog:  (s) => safeNum(s.miss)
    }
  ]
};

export function hydrationMinisFor(diffRaw = 'normal') {
  const d = String(diffRaw || 'normal').toLowerCase();
  const key = (d === 'easy' || d === 'hard') ? d : 'normal';
  const pool = HYDRATION_MINIS[key] || HYDRATION_MINIS.normal;
  return pool.map(m => ({ ...m }));
}

export default { hydrationMinisFor };