// === /herohealth/hydration-vr/hydration.goals.js ===
// นิยาม "Goal" หลักของ Hydration ตามระดับความยาก

'use strict';

function cfgFor (diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      goodMain: 30,   // เก็บน้ำดีขั้นต่ำ
      greenMain: 25   // อยู่โซน GREEN สะสม (วินาที)
    };
  }
  if (d === 'hard') {
    return {
      goodMain: 50,
      greenMain: 45
    };
  }
  // normal
  return {
    goodMain: 40,
    greenMain: 35
  };
}

/**
 * hydrationGoalsFor(diff)
 * คืน array ของ goal ที่ใช้กับ createHydrationQuest
 * ใช้ state จาก mapHydrationState(stats)
 */
export function hydrationGoalsFor (diff) {
  const cfg = cfgFor(diff);

  return [
    {
      id: `goal_good_${diff}`,
      label: `เก็บน้ำดีให้ได้อย่างน้อย ${cfg.goodMain} แก้ว 💧`,
      target: cfg.goodMain,
      // s.good = จำนวน hit เป้าดีทั้งหมด
      check: (s) => s.good >= cfg.goodMain,
      prog:  (s) => Math.min(s.good, cfg.goodMain)
    },
    {
      id: `goal_green_${diff}`,
      label: `รักษาโซนน้ำสมดุล (GREEN) รวม ${cfg.greenMain} วินาที ⏱️`,
      target: cfg.greenMain,
      // s.greenTick = เวลาโซน GREEN สะสม (วินาที)
      check: (s) => s.greenTick >= cfg.greenMain,
      prog:  (s) => Math.min(s.greenTick, cfg.greenMain)
    }
  ];
}

export default { hydrationGoalsFor };