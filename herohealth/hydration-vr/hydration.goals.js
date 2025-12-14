// === /herohealth/hydration-vr/hydration.goals.js ===
// Goal หลักสำหรับ Hydration Quest VR
// ใช้ร่วมกับ hydration.quest.js (ผ่าน hydrationGoalsFor(diff))
// ใช้ state จาก mapHydrationState:
//   score, comboMax, goodCount, junkMiss, timeSec, tick,
//   greenTick, greenRatio, zone

function clampProg (value, target) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  if (!isFinite(v) || !isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(v, t));
}

// ---------- EASY (10 goals) ----------
const GOALS_EASY = [
  {
    id: 'easy-good-15',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 15 แก้ว 💧',
    target: 15,
    check: s => s.goodCount >= 15,
    prog: s => clampProg(s.goodCount, 15)
  },
  {
    id: 'easy-good-25',
    label: 'เก็บน้ำดีอย่างน้อย 25 แก้ว 💧',
    target: 25,
    check: s => s.goodCount >= 25,
    prog: s => clampProg(s.goodCount, 25)
  },
  {
    id: 'easy-green-time-25',
    label: 'รักษาโซนสีเขียวให้ได้อย่างน้อย 25 วินาที 💚',
    target: 25,
    check: s => s.greenTick >= 25,
    prog: s => clampProg(s.greenTick, 25)
  },
  {
    id: 'easy-green-time-40',
    label: 'รักษาโซนสีเขียวรวม 40 วินาที 💚',
    target: 40,
    check: s => s.greenTick >= 40,
    prog: s => clampProg(s.greenTick, 40)
  },
  {
    id: 'easy-combo-15',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 15 ครั้ง 🔗',
    target: 15,
    check: s => s.comboMax >= 15,
    prog: s => clampProg(s.comboMax, 15)
  },
  {
    id: 'easy-score-2500',
    label: 'ทำคะแนนรวมให้ถึง 2,500 คะแนน ⭐',
    target: 2500,
    check: s => s.score >= 2500,
    prog: s => clampProg(s.score, 2500)
  },
  {
    id: 'easy-score-3500',
    label: 'ทำคะแนนรวมให้ถึง 3,500 คะแนน ⭐',
    target: 3500,
    check: s => s.score >= 3500,
    prog: s => clampProg(s.score, 3500)
  },
  {
    id: 'easy-miss-max-3',
    label: 'พลาดได้ไม่เกิน 3 ครั้ง ตลอดเกม 🚫',
    target: 3,
    // ต้องเล่นอย่างน้อย 40 วินาทีด้วย ไม่งั้นจะผ่านตั้งแต่เริ่มเกม
    check: s => s.timeSec >= 40 && s.junkMiss <= 3,
    prog: s => (s.timeSec < 40
      ? clampProg(s.timeSec, 40)   // ช่วงแรกให้ progress ตามเวลา
      : clampProg(Math.max(0, 3 - s.junkMiss), 3))
  },
  {
    id: 'easy-miss-max-1',
    label: 'พลาดได้ไม่เกิน 1 ครั้ง ตลอดเกม 🚫',
    target: 1,
    check: s => s.timeSec >= 40 && s.junkMiss <= 1,
    prog: s => (s.timeSec < 40
      ? clampProg(s.timeSec, 40)
      : clampProg(Math.max(0, 1 - s.junkMiss), 1))
  },
  {
    id: 'easy-green-ratio-50',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 30 && s.greenRatio >= 0.5,
    prog: s => (s.timeSec >= 30 && s.greenRatio >= 0.5 ? 1 : 0)
  }
];

// ---------- NORMAL (10 goals) ----------
const GOALS_NORMAL = [
  {
    id: 'normal-good-30',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 30 แก้ว 💧',
    target: 30,
    check: s => s.goodCount >= 30,
    prog: s => clampProg(s.goodCount, 30)
  },
  {
    id: 'normal-good-40',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 40 แก้ว 💧',
    target: 40,
    check: s => s.goodCount >= 40,
    prog: s => clampProg(s.goodCount, 40)
  },
  {
    id: 'normal-green-time-50',
    label: 'รักษาโซนสีเขียวรวม 50 วินาที 💚',
    target: 50,
    check: s => s.greenTick >= 50,
    prog: s => clampProg(s.greenTick, 50)
  },
  {
    id: 'normal-green-time-70',
    label: 'รักษาโซนสีเขียวรวม 70 วินาที 💚',
    target: 70,
    check: s => s.greenTick >= 70,
    prog: s => clampProg(s.greenTick, 70)
  },
  {
    id: 'normal-combo-25',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 25 ครั้ง 🔗',
    target: 25,
    check: s => s.comboMax >= 25,
    prog: s => clampProg(s.comboMax, 25)
  },
  {
    id: 'normal-score-4500',
    label: 'ทำคะแนนรวมให้ถึง 4,500 คะแนน ⭐',
    target: 4500,
    check: s => s.score >= 4500,
    prog: s => clampProg(s.score, 4500)
  },
  {
    id: 'normal-score-6000',
    label: 'ทำคะแนนรวมให้ถึง 6,000 คะแนน ⭐',
    target: 6000,
    check: s => s.score >= 6000,
    prog: s => clampProg(s.score, 6000)
  },
  {
    id: 'normal-miss-max-2',
    label: 'พลาดได้ไม่เกิน 2 ครั้ง ตลอดเกม 🚫',
    target: 2,
    check: s => s.timeSec >= 50 && s.junkMiss <= 2,
    prog: s => (s.timeSec < 50
      ? clampProg(s.timeSec, 50)
      : clampProg(Math.max(0, 2 - s.junkMiss), 2))
  },
  {
    id: 'normal-green-ratio-60',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 60% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 35 && s.greenRatio >= 0.6,
    prog: s => (s.timeSec >= 35 && s.greenRatio >= 0.6 ? 1 : 0)
  },
  {
    id: 'normal-green-end',
    label: 'จบเกมในโซน GREEN 💚',
    target: 1,
    check: s => s.timeSec >= 40 && s.zone === 'GREEN',
    prog: s => (s.timeSec >= 40 && s.zone === 'GREEN' ? 1 : 0)
  }
];

// ---------- HARD (10 goals) ----------
const GOALS_HARD = [
  {
    id: 'hard-good-45',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 45 แก้ว 💧',
    target: 45,
    check: s => s.goodCount >= 45,
    prog: s => clampProg(s.goodCount, 45)
  },
  {
    id: 'hard-good-55',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 55 แก้ว 💧',
    target: 55,
    check: s => s.goodCount >= 55,
    prog: s => clampProg(s.goodCount, 55)
  },
  {
    id: 'hard-green-time-80',
    label: 'รักษาโซนสีเขียวรวม 80 วินาที 💚',
    target: 80,
    check: s => s.greenTick >= 80,
    prog: s => clampProg(s.greenTick, 80)
  },
  {
    id: 'hard-green-time-100',
    label: 'รักษาโซนสีเขียวรวม 100 วินาที 💚',
    target: 100,
    check: s => s.greenTick >= 100,
    prog: s => clampProg(s.greenTick, 100)
  },
  {
    id: 'hard-combo-35',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 35 ครั้ง 🔗',
    target: 35,
    check: s => s.comboMax >= 35,
    prog: s => clampProg(s.comboMax, 35)
  },
  {
    id: 'hard-score-8000',
    label: 'ทำคะแนนรวมให้ถึง 8,000 คะแนน ⭐',
    target: 8000,
    check: s => s.score >= 8000,
    prog: s => clampProg(s.score, 8000)
  },
  {
    id: 'hard-score-10000',
    label: 'ทำคะแนนรวมให้ถึง 10,000 คะแนน ⭐',
    target: 10000,
    check: s => s.score >= 10000,
    prog: s => clampProg(s.score, 10000)
  },
  {
    id: 'hard-miss-max-1',
    label: 'พลาดได้ไม่เกิน 1 ครั้ง ตลอดเกม 🚫',
    target: 1,
    check: s => s.timeSec >= 60 && s.junkMiss <= 1,
    prog: s => (s.timeSec < 60
      ? clampProg(s.timeSec, 60)
      : clampProg(Math.max(0, 1 - s.junkMiss), 1))
  },
  {
    id: 'hard-green-ratio-70',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 70% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 45 && s.greenRatio >= 0.7,
    prog: s => (s.timeSec >= 45 && s.greenRatio >= 0.7 ? 1 : 0)
  },
  {
    id: 'hard-green-end-perfect',
    label: 'จบเกมโซน GREEN และพลาดไม่เกิน 1 ครั้ง 💚',
    target: 1,
    check: s => s.timeSec >= 50 && s.zone === 'GREEN' && s.junkMiss <= 1,
    prog: s => (s.timeSec >= 50 && s.zone === 'GREEN' && s.junkMiss <= 1 ? 1 : 0)
  }
];

// ---------- API ----------
export function hydrationGoalsFor (diff = 'normal') {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') return GOALS_EASY.slice();
  if (d === 'hard') return GOALS_HARD.slice();
  return GOALS_NORMAL.slice();
}

export default { hydrationGoalsFor };
