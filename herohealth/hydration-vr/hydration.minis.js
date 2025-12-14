// === /herohealth/hydration-vr/hydration.minis.js ===
// Mini quest สำหรับ Hydration Quest VR
// ใช้ state จาก mapHydrationState เช่นเดียวกับ goals

function clampProg (value, target) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  if (!isFinite(v) || !isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(v, t));
}

// ---------- EASY (10 minis) ----------
const MINIS_EASY = [
  {
    id: 'mini-easy-good-10',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 10 แก้ว 💧',
    target: 10,
    check: s => s.goodCount >= 10,
    prog: s => clampProg(s.goodCount, 10)
  },
  {
    id: 'mini-easy-good-18',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 18 แก้ว 💧',
    target: 18,
    check: s => s.goodCount >= 18,
    prog: s => clampProg(s.goodCount, 18)
  },
  {
    id: 'mini-easy-combo-10',
    label: 'ทำคอมโบต่อเนื่อง 10 ครั้ง 🔗',
    target: 10,
    check: s => s.comboMax >= 10,
    prog: s => clampProg(s.comboMax, 10)
  },
  {
    id: 'mini-easy-green-time-20',
    label: 'อยู่ในโซน GREEN รวม 20 วินาที 💚',
    target: 20,
    check: s => s.greenTick >= 20,
    prog: s => clampProg(s.greenTick, 20)
  },
  {
    id: 'mini-easy-green-ratio-40',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 40% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 20 && s.greenRatio >= 0.4,
    prog: s => (s.timeSec >= 20 && s.greenRatio >= 0.4 ? 1 : 0)
  },
  {
    id: 'mini-easy-nomiss-15s',
    label: 'เล่น 15 วินาทีแรกโดยไม่พลาดเลย 🚫',
    target: 1,
    check: s => s.timeSec >= 15 && s.junkMiss === 0,
    prog: s => (s.timeSec >= 15 && s.junkMiss === 0 ? 1 : 0)
  },
  {
    id: 'mini-easy-score-2000',
    label: 'ทำคะแนนให้ถึง 2,000 คะแนน ⭐',
    target: 2000,
    check: s => s.score >= 2000,
    prog: s => clampProg(s.score, 2000)
  },
  {
    id: 'mini-easy-miss-max-2',
    label: 'พลาดได้ไม่เกิน 2 ครั้ง ตลอดเกม 🚫',
    target: 2,
    check: s => s.timeSec >= 40 && s.junkMiss <= 2,
    prog: s => (s.timeSec < 40
      ? clampProg(s.timeSec, 40)
      : clampProg(Math.max(0, 2 - s.junkMiss), 2))
  },
  {
    id: 'mini-easy-green-end',
    label: 'จบเกมในโซน GREEN 💚',
    target: 1,
    check: s => s.timeSec >= 30 && s.zone === 'GREEN',
    prog: s => (s.timeSec >= 30 && s.zone === 'GREEN' ? 1 : 0)
  },
  {
    id: 'mini-easy-play-45s',
    label: 'เล่นจนครบอย่างน้อย 45 วินาที ⏱️',
    target: 1,
    check: s => s.timeSec >= 45,
    prog: s => (s.timeSec >= 45 ? 1 : 0)
  }
];

// ---------- NORMAL (10 minis) ----------
const MINIS_NORMAL = [
  {
    id: 'mini-normal-good-20',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 20 แก้ว 💧',
    target: 20,
    check: s => s.goodCount >= 20,
    prog: s => clampProg(s.goodCount, 20)
  },
  {
    id: 'mini-normal-good-30',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 30 แก้ว 💧',
    target: 30,
    check: s => s.goodCount >= 30,
    prog: s => clampProg(s.goodCount, 30)
  },
  {
    id: 'mini-normal-combo-18',
    label: 'ทำคอมโบต่อเนื่อง 18 ครั้ง 🔗',
    target: 18,
    check: s => s.comboMax >= 18,
    prog: s => clampProg(s.comboMax, 18)
  },
  {
    id: 'mini-normal-green-time-35',
    label: 'อยู่ในโซน GREEN รวม 35 วินาที 💚',
    target: 35,
    check: s => s.greenTick >= 35,
    prog: s => clampProg(s.greenTick, 35)
  },
  {
    id: 'mini-normal-green-ratio-55',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 55% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 30 && s.greenRatio >= 0.55,
    prog: s => (s.timeSec >= 30 && s.greenRatio >= 0.55 ? 1 : 0)
  },
  {
    id: 'mini-normal-nomiss-25s',
    label: 'เล่น 25 วินาทีแรกโดยไม่พลาดเลย 🚫',
    target: 1,
    check: s => s.timeSec >= 25 && s.junkMiss === 0,
    prog: s => (s.timeSec >= 25 && s.junkMiss === 0 ? 1 : 0)
  },
  {
    id: 'mini-normal-score-4000',
    label: 'ทำคะแนนให้ถึง 4,000 คะแนน ⭐',
    target: 4000,
    check: s => s.score >= 4000,
    prog: s => clampProg(s.score, 4000)
  },
  {
    id: 'mini-normal-miss-max-1',
    label: 'พลาดได้ไม่เกิน 1 ครั้ง ตลอดเกม 🚫',
    target: 1,
    check: s => s.timeSec >= 50 && s.junkMiss <= 1,
    prog: s => (s.timeSec < 50
      ? clampProg(s.timeSec, 50)
      : clampProg(Math.max(0, 1 - s.junkMiss), 1))
  },
  {
    id: 'mini-normal-green-end-safe',
    label: 'จบเกมในโซน GREEN และพลาดไม่เกิน 1 ครั้ง 💚',
    target: 1,
    check: s => s.timeSec >= 40 && s.zone === 'GREEN' && s.junkMiss <= 1,
    prog: s => (s.timeSec >= 40 && s.zone === 'GREEN' && s.junkMiss <= 1 ? 1 : 0)
  },
  {
    id: 'mini-normal-play-60s',
    label: 'เล่นจนครบอย่างน้อย 60 วินาที ⏱️',
    target: 1,
    check: s => s.timeSec >= 60,
    prog: s => (s.timeSec >= 60 ? 1 : 0)
  }
];

// ---------- HARD (10 minis) ----------
const MINIS_HARD = [
  {
    id: 'mini-hard-good-35',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 35 แก้ว 💧',
    target: 35,
    check: s => s.goodCount >= 35,
    prog: s => clampProg(s.goodCount, 35)
  },
  {
    id: 'mini-hard-good-45',
    label: 'เก็บน้ำดีให้ได้อย่างน้อย 45 แก้ว 💧',
    target: 45,
    check: s => s.goodCount >= 45,
    prog: s => clampProg(s.goodCount, 45)
  },
  {
    id: 'mini-hard-combo-25',
    label: 'ทำคอมโบต่อเนื่อง 25 ครั้ง 🔗',
    target: 25,
    check: s => s.comboMax >= 25,
    prog: s => clampProg(s.comboMax, 25)
  },
  {
    id: 'mini-hard-green-time-60',
    label: 'อยู่ในโซน GREEN รวม 60 วินาที 💚',
    target: 60,
    check: s => s.greenTick >= 60,
    prog: s => clampProg(s.greenTick, 60)
  },
  {
    id: 'mini-hard-green-ratio-70',
    label: 'ให้เวลาอยู่ในโซน GREEN ≥ 70% ของเวลาที่เล่นทั้งหมด 💚',
    target: 1,
    check: s => s.timeSec >= 40 && s.greenRatio >= 0.7,
    prog: s => (s.timeSec >= 40 && s.greenRatio >= 0.7 ? 1 : 0)
  },
  {
    id: 'mini-hard-nomiss-30s',
    label: 'เล่น 30 วินาทีแรกโดยไม่พลาดเลย 🚫',
    target: 1,
    check: s => s.timeSec >= 30 && s.junkMiss === 0,
    prog: s => (s.timeSec >= 30 && s.junkMiss === 0 ? 1 : 0)
  },
  {
    id: 'mini-hard-score-7000',
    label: 'ทำคะแนนให้ถึง 7,000 คะแนน ⭐',
    target: 7000,
    check: s => s.score >= 7000,
    prog: s => clampProg(s.score, 7000)
  },
  {
    id: 'mini-hard-miss-max-0',
    label: 'ห้ามพลาดเลยตลอดเกม (MISS = 0) 🚫',
    target: 1,
    check: s => s.timeSec >= 50 && s.junkMiss === 0,
    prog: s => (s.timeSec >= 50 && s.junkMiss === 0 ? 1 : 0)
  },
  {
    id: 'mini-hard-green-end-perfect',
    label: 'จบเกมโซน GREEN และไม่พลาดเลย 💚',
    target: 1,
    check: s => s.timeSec >= 50 && s.zone === 'GREEN' && s.junkMiss === 0,
    prog: s => (s.timeSec >= 50 && s.zone === 'GREEN' && s.junkMiss === 0 ? 1 : 0)
  },
  {
    id: 'mini-hard-play-75s',
    label: 'เล่นจนครบอย่างน้อย 75 วินาที ⏱️',
    target: 1,
    check: s => s.timeSec >= 75,
    prog: s => (s.timeSec >= 75 ? 1 : 0)
  }
];

// ---------- API ----------
export function hydrationMinisFor (diff = 'normal') {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') return MINIS_EASY.slice();
  if (d === 'hard') return MINIS_HARD.slice();
  return MINIS_NORMAL.slice();
}

export default { hydrationMinisFor };
