// === /herohealth/hydration-vr/hydration.minis.js ===
// นิยาม "Mini quest" สำหรับ Hydration

'use strict';

function cfgFor (diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      goodMini: 12,     // เก็บน้ำดีขั้นต่ำ (mini)
      scoreMini: 2500   // คะแนนขั้นต่ำ (mini)
    };
  }
  if (d === 'hard') {
    return {
      goodMini: 22,
      scoreMini: 5500
    };
  }
  // normal
  return {
    goodMini: 16,
    scoreMini: 4000
  };
}

/**
 * hydrationMinisFor(diff)
 * ใช้ state จาก mapHydrationState(stats)
 */
export function hydrationMinisFor (diff) {
  const cfg = cfgFor(diff);

  return [
    // 1) เก็บแก้วน้ำดี
    {
      id: `mini_good_${diff}`,
      label: `มินิ: เก็บน้ำดีให้ได้ ${cfg.goodMini} แก้ว 💧`,
      target: cfg.goodMini,
      check: (s) => s.good >= cfg.goodMini,
      prog:  (s) => Math.min(s.good, cfg.goodMini)
    },

    // 2) ทำคะแนนให้ถึง
    {
      id: `mini_score_${diff}`,
      label: `มินิ: ทำคะแนนให้ถึง ${cfg.scoreMini} แต้ม 📊`,
      target: cfg.scoreMini,
      check: (s) => s.score >= cfg.scoreMini,
      prog:  (s) => Math.min(s.score, cfg.scoreMini)
    },

    // 3) เวลา GREEN ≥ 50% ของเวลาเล่นทั้งหมด (เหมาะกับโชว์ตอนท้ายเกม)
    {
      id: `mini_greenratio_${diff}`,
      label: 'มินิ: ให้เวลา GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
      target: 50,
      // ให้เริ่มเช็คหลังเล่นไปอย่างน้อย 10 วินาที จะได้ไม่ติ๊กเร็วเกินไป
      check: (s) => s.timeSec >= 10 && s.greenRatio >= 0.5,
      prog:  (s) => Math.round((s.greenRatio || 0) * 100)
    },

    // 4) ภารกิจแบบ miss (ใช้กับระบบจัดเรียง "ยาก/ง่าย")
    {
      id: `mini_nomiss_${diff}`,
      label: 'มินิ: พลาดไม่เกิน 2 ครั้ง',
      target: 2,
      // ภารกิจแบบ miss: นับว่า "ผ่าน" ถ้า miss <= target
      check: (s) => s.miss <= 2,
      // ความคืบหน้า: ยิ่ง miss น้อย ยิ่งดี → ใช้ย้อนกลับเล็กน้อย
      prog:  (s) => Math.max(0, 2 - Math.min(s.miss, 2))
    }
  ];
}

export default { hydrationMinisFor };