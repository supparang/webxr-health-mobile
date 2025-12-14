// === /herohealth/hydration-vr/hydration.goals.js ===
// Goal หลักสำหรับ Hydration Quest VR (เวอร์ชัน Play-friendly สำหรับเด็ก)
// ใช้ร่วมกับ hydration.quest.js (ผ่าน hydrationGoalsFor(diff))
// ใช้ state จาก mapHydrationState:
//   score, comboMax, goodCount, junkMiss, timeSec, tick,
//   greenTick, greenRatio, zone

function clampProg(value, target) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  if (!isFinite(v) || !isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(v, t));
}

// ---------- EASY (10 goals) ----------
// สมมติเล่น ~80s เด็กทั่วไปควรทำได้อย่างน้อย 1–2 goal ต่อเกมแบบไม่เครียด
const GOALS_EASY = [
  {
    id: 'easy-good-12',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 12 แก้ว 💧',
    target: 12,
    check: s => s.goodCount >= 12,
    prog: s => clampProg(s.goodCount, 12)
  },
  {
    id: 'easy-good-20',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 20 แก้ว 💧',
    target: 20,
    check: s => s.goodCount >= 20,
    prog: s => clampProg(s.goodCount, 20)
  },
  {
    id: 'easy-green-time-20',
    label: 'รักษาโซนสีเขียวให้ได้อย่างน้อย 20 วินาที 💚',
    target: 20,
    check: s => s.greenTick >= 20,
    prog: s => clampProg(s.greenTick, 20)
  },
  {
    id: 'easy-green-time-35',
    label: 'รักษาโซนสีเขียวรวม 35 วินาที 💚',
    target: 35,
    check: s => s.greenTick >= 35,
    prog: s => clampProg(s.greenTick, 35)
  },
  {
    id: 'easy-combo-8',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 8 ครั้ง 🔗',
    target: 8,
    check: s => s.comboMax >= 8,
    prog: s => clampProg(s.comboMax, 8)
  },
  {
    id: 'easy-score-2000',
    label: 'ทำคะแนนรวมให้ถึง 2,000 คะแนน ⭐',
    target: 2000,
    check: s => s.score >= 2000,
    prog: s => clampProg(s.score, 2000)
  },
  {
    id: 'easy-score-3000',
    label: 'ทำคะแนนรวมให้ถึง 3,000 คะแนน ⭐',
    target: 3000,
    check: s => s.score >= 3000,
    prog: s => clampProg(s.score, 3000)
  },
  {
    id: 'easy-miss-max-6',
    label: 'พลาดได้ไม่เกิน 6 ครั้ง ตลอดเกม 🚫',
    target: 6,
    // ต้องเล่นอย่างน้อย 30 วินาทีด้วย เพื่อกันเคสเพิ่งเริ่มแล้วผ่านเลย
    check: s => s.timeSec >= 30 && s.junkMiss <= 6,
    // ช่วงแรกให้ progress ตามเวลาเล่น พอถึง 30s ค่อยนับตาม miss
    prog: s => (s.timeSec < 30
      ? clampProg(s.timeSec, 30)
      : clampProg(Math.max(0, 6 - s.junkMiss), 6))
  },
  {
    id: 'easy-miss-max-3',
    label: 'พลาดได้ไม่เกิน 3 ครั้ง ตลอดเกม 🚫',
    target: 3,
    check: s => s.timeSec >= 30 && s.junkMiss <= 3,
    prog: s => (s.timeSec < 30
      ? clampProg(s.timeSec, 30)
      : clampProg(Math.max(0, 3 - s.junkMiss), 3))
  },
  {
    id: 'easy-green-ratio-40',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 40% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 20 && s.greenRatio >= 0.4,
    prog: s => (s.timeSec >= 20 && s.greenRatio >= 0.4 ? 1 : 0)
  }
];

// ---------- NORMAL (10 goals) ----------
// ยังเด็กอยู่ แต่ให้รู้สึกท้าทายขึ้นเล็กน้อย
const GOALS_NORMAL = [
  {
    id: 'normal-good-25',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 25 แก้ว 💧',
    target: 25,
    check: s => s.goodCount >= 25,
    prog: s => clampProg(s.goodCount, 25)
  },
  {
    id: 'normal-good-35',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 35 แก้ว 💧',
    target: 35,
    check: s => s.goodCount >= 35,
    prog: s => clampProg(s.goodCount, 35)
  },
  {
    id: 'normal-green-time-40',
    label: 'รักษาโซนสีเขียวรวม 40 วินาที 💚',
    target: 40,
    check: s => s.greenTick >= 40,
    prog: s => clampProg(s.greenTick, 40)
  },
  {
    id: 'normal-green-time-60',
    label: 'รักษาโซนสีเขียวรวม 60 วินาที 💚',
    target: 60,
    check: s => s.greenTick >= 60,
    prog: s => clampProg(s.greenTick, 60)
  },
  {
    id: 'normal-combo-18',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 18 ครั้ง 🔗',
    target: 18,
    check: s => s.comboMax >= 18,
    prog: s => clampProg(s.comboMax, 18)
  },
  {
    id: 'normal-score-4000',
    label: 'ทำคะแนนรวมให้ถึง 4,000 คะแนน ⭐',
    target: 4000,
    check: s => s.score >= 4000,
    prog: s => clampProg(s.score, 4000)
  },
  {
    id: 'normal-score-5500',
    label: 'ทำคะแนนรวมให้ถึง 5,500 คะแนน ⭐',
    target: 5500,
    check: s => s.score >= 5500,
    prog: s => clampProg(s.score, 5500)
  },
  {
    id: 'normal-miss-max-4',
    label: 'พลาดได้ไม่เกิน 4 ครั้ง ตลอดเกม 🚫',
    target: 4,
    check: s => s.timeSec >= 45 && s.junkMiss <= 4,
    prog: s => (s.timeSec < 45
      ? clampProg(s.timeSec, 45)
      : clampProg(Math.max(0, 4 - s.junkMiss), 4))
  },
  {
    id: 'normal-green-ratio-55',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 55% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 30 && s.greenRatio >= 0.55,
    prog: s => (s.timeSec >= 30 && s.greenRatio >= 0.55 ? 1 : 0)
  },
  {
    id: 'normal-green-end',
    label: 'จบเกมในโซน GREEN 💚',
    target: 1,
    check: s => s.timeSec >= 35 && s.zone === 'GREEN',
    prog: s => (s.timeSec >= 35 && s.zone === 'GREEN' ? 1 : 0)
  }
];

// ---------- HARD (10 goals) ----------
// ใช้สำหรับเด็กเก่ง / โหมดท้าทาย แต่ยังไม่สุดโหดแบบวิจัย
const GOALS_HARD = [
  {
    id: 'hard-good-40',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 40 แก้ว 💧',
    target: 40,
    check: s => s.goodCount >= 40,
    prog: s => clampProg(s.goodCount, 40)
  },
  {
    id: 'hard-good-50',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 50 แก้ว 💧',
    target: 50,
    check: s => s.goodCount >= 50,
    prog: s => clampProg(s.goodCount, 50)
  },
  {
    id: 'hard-green-time-70',
    label: 'รักษาโซนสีเขียวรวม 70 วินาที 💚',
    target: 70,
    check: s => s.greenTick >= 70,
    prog: s => clampProg(s.greenTick, 70)
  },
  {
    id: 'hard-green-time-90',
    label: 'รักษาโซนสีเขียวรวม 90 วินาที 💚',
    target: 90,
    check: s => s.greenTick >= 90,
    prog: s => clampProg(s.greenTick, 90)
  },
  {
    id: 'hard-combo-30',
    label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย 30 ครั้ง 🔗',
    target: 30,
    check: s => s.comboMax >= 30,
    prog: s => clampProg(s.comboMax, 30)
  },
  {
    id: 'hard-score-7000',
    label: 'ทำคะแนนรวมให้ถึง 7,000 คะแนน ⭐',
    target: 7000,
    check: s => s.score >= 7000,
    prog: s => clampProg(s.score, 7000)
  },
  {
    id: 'hard-score-9000',
    label: 'ทำคะแนนรวมให้ถึง 9,000 คะแนน ⭐',
    target: 9000,
    check: s => s.score >= 9000,
    prog: s => clampProg(s.score, 9000)
  },
  {
    id: 'hard-miss-max-2',
    label: 'พลาดได้ไม่เกิน 2 ครั้ง ตลอดเกม 🚫',
    target: 2,
    check: s => s.timeSec >= 50 && s.junkMiss <= 2,
    prog: s => (s.timeSec < 50
      ? clampProg(s.timeSec, 50)
      : clampProg(Math.max(0, 2 - s.junkMiss), 2))
  },
  {
    id: 'hard-green-ratio-65',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 65% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 40 && s.greenRatio >= 0.65,
    prog: s => (s.timeSec >= 40 && s.greenRatio >= 0.65 ? 1 : 0)
  },
  {
    id: 'hard-green-end-perfect',
    label: 'จบเกมโซน GREEN และพลาดไม่เกิน 2 ครั้ง 💚',
    target: 1,
    check: s => s.timeSec >= 45 && s.zone === 'GREEN' && s.junkMiss <= 2,
    prog: s => (s.timeSec >= 45 && s.zone === 'GREEN' && s.junkMiss <= 2 ? 1 : 0)
  }
];

// ---------- API ----------
export function hydrationGoalsFor(diff = 'normal') {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') return GOALS_EASY.slice();
  if (d === 'hard') return GOALS_HARD.slice();
  return GOALS_NORMAL.slice();
}

export default { hydrationGoalsFor };
