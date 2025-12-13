// === /herohealth/hydration-vr/hydration.goals.js ===
// Goal หลัก 2 ภารกิจ

'use strict';

function cfgFor (diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return { goodMain: 30, greenMain: 25 };
  }
  if (d === 'hard') {
    return { goodMain: 50, greenMain: 45 };
  }
  // normal
  return { goodMain: 40, greenMain: 35 };
}

export function hydrationGoalsFor (diff) {
  const cfg = cfgFor(diff);

  return [
    {
      id: `goal_good_${diff}`,
      label: `เก็บน้ำดีให้ได้อย่างน้อย ${cfg.goodMain} แก้ว 💧`,
      target: cfg.goodMain,
      check: (s) => s.good >= cfg.goodMain,
      prog:  (s) => Math.min(s.good, cfg.goodMain)
    },
    {
      id: `goal_green_${diff}`,
      label: `รักษาโซนสมดุล (GREEN) รวม ${cfg.greenMain} วินาที ⏱️`,
      target: cfg.greenMain,
      check: (s) => s.greenTick >= cfg.greenMain,
      prog:  (s) => Math.min(s.greenTick, cfg.greenMain)
    }
  ];
}

export default { hydrationGoalsFor };