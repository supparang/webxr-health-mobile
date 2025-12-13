// === /herohealth/hydration-vr/hydration.minis.js ===
// นิยาม "Mini quest" สำหรับ Hydration (ใช้กับ hydration.quest.js)
//
// ใช้ state จาก mapHydrationState(stats):
//   - s.good       = จำนวนเป้าดี
//   - s.score      = คะแนนรวม
//   - s.timeSec    = เวลาเล่นสะสม (วินาที)
//   - s.greenRatio = สัดส่วนเวลาใน GREEN (0–1)
//   - s.miss       = จำนวน miss ทั้งหมด

'use strict';

function cfgFor (diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      goodMini: 12,
      scoreMini: 2500
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
 * คืน array mini quest หลัก 3 ภารกิจ
 */
export function hydrationMinisFor (diff) {
  const cfg = cfgFor(diff);

  return [
    // 1) เก็บน้ำดี X แก้ว
    {
      id: `mini_good_${diff}`,
      label: `มินิ: เก็บน้ำดีให้ได้ ${cfg.goodMini} แก้ว 💧`,
      target: cfg.goodMini,
      check: (s) => s.good >= cfg.goodMini,
      prog:  (s) => Math.min(s.good, cfg.goodMini)
    },

    // 2) ทำคะแนนถึงเกณฑ์
    {
      id: `mini_score_${diff}`,
      label: `มินิ: ทำคะแนนให้ถึง ${cfg.scoreMini} แต้ม 📊`,
      target: cfg.scoreMini,
      check: (s) => s.score >= cfg.scoreMini,
      prog:  (s) => Math.min(s.score, cfg.scoreMini)
    },

    // 3) GREEN ≥ 50% ของเวลาทั้งหมด
    //    ถ้าจะให้ "นับตอนท้ายเกม" จริง ๆ safe.js จะเป็นคนจบเกมให้เอง
    //    ที่นี่แค่ mark ว่าผ่านเมื่อเงื่อนไขถึง (หลังเล่นไปอย่างน้อย 10 วิ)
    {
      id: `mini_greenratio_${diff}`,
      label: 'มินิ: ให้เวลา GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
      target: 50, // เปอร์เซ็นต์
      check: (s) => s.timeSec >= 10 && s.greenRatio >= 0.5,
      prog:  (s) => Math.round((s.greenRatio || 0) * 100)
    },

    // 4) (อันนี้เป็น miss quest ไว้ให้ระบบจัดลำดับความยากใช้ ถ้าอยากเพิ่ม pool ต่อ)
    {
      id: `mini_nomiss_${diff}`,
      label: 'มินิ: พลาดไม่เกิน 2 ครั้ง',
      target: 2,
      check: (s) => s.miss <= 2,
      // ความคืบหน้าให้กลับด้าน: miss น้อย = ดี
      prog:  (s) => Math.max(0, 2 - Math.min(s.miss, 2))
    }
  ];
}

export default { hydrationMinisFor };