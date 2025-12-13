// === /herohealth/hydration-vr/hydration.minis.js ===
// Mini quest 3 ภารกิจ

'use strict';

function cfgFor (diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return { goodMini: 12, scoreMini: 2500 };
  }
  if (d === 'hard') {
    return { goodMini: 22, scoreMini: 5500 };
  }
  // normal
  return { goodMini: 16, scoreMini: 4000 };
}

export function hydrationMinisFor (diff) {
  const cfg = cfgFor(diff);

  return [
    {
      id: `mini_good_${diff}`,
      label: `มินิ: เก็บน้ำดีให้ได้ ${cfg.goodMini} แก้ว 💧`,
      target: cfg.goodMini,
      check: (s) => s.good >= cfg.goodMini,
      prog:  (s) => Math.min(s.good, cfg.goodMini)
    },
    {
      id: `mini_score_${diff}`,
      label: `มินิ: ทำคะแนนให้ถึง ${cfg.scoreMini} แต้ม 📊`,
      target: cfg.scoreMini,
      check: (s) => s.score >= cfg.scoreMini,
      prog:  (s) => Math.min(s.score, cfg.scoreMini)
    },
    {
      id: `mini_greenratio_${diff}`,
      label: 'มินิ: ให้เวลา GREEN ≥ 50% ของเวลาที่เล่นทั้งหมด 💚',
      target: 50,
      // นับตอนท้าย ๆ เกม: ต้องเล่นเกิน 10 วินาที และ GREEN ≥ 50%
      check: (s) => s.timeSec >= 10 && s.greenRatio >= 0.5,
      prog:  (s) => Math.round((s.greenRatio || 0) * 100)
    }
  ];
}

export default { hydrationMinisFor };