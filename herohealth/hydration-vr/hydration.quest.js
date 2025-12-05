// === /herohealth/hydration-vr/hydration.goals.js ===
// เป้าหมายหลัก (Goals) ของโหมด Hydration

import { mapHydrationState as G, normalizeHydrationDiff } from './hydration.state.js';

export function hydrationGoalsFor(diff) {
  const D = normalizeHydrationDiff(diff);

  const table = {
    easy:   { score:  700, combo:  8, miss: 8, green: 18 },
    normal: { score: 1200, combo: 12, miss: 6, green: 28 },
    hard:   { score: 1800, combo: 16, miss: 4, green: 36 }
  };
  const K = table[D] || table.normal;

  return [
    {
      id: 'g_green',
      label: `อยู่ในโซนสมดุล (GREEN) รวม ${K.green}s`,
      target: K.green,
      check: s => G(s).green >= K.green,
      prog : s => Math.min(K.green, G(s).green)
    },
    {
      id: 'g_score',
      label: `คะแนนรวม ${K.score}+`,
      target: K.score,
      check: s => G(s).score >= K.score,
      prog : s => Math.min(K.score, G(s).score)
    },
    {
      id: 'g_combo',
      label: `คอมโบ ≥ ${K.combo}`,
      target: K.combo,
      check: s => G(s).comboMax >= K.combo,
      prog : s => Math.min(K.combo, G(s).comboMax)
    },
    {
      id: 'g_nomiss',
      label: `พลาดไม่เกิน ${K.miss}`,
      target: K.miss,
      check: s => G(s).miss <= K.miss,
      prog : s => Math.max(0, K.miss - G(s).miss)
    },
    {
      id: 'g_good24',
      label: 'เก็บไฮเดรต 24',
      target: 24,
      check: s => G(s).good >= 24,
      prog : s => Math.min(24, G(s).good)
    },
    {
      id: 'g_score1600',
      label: 'คะแนน 1600+',
      target: 1600,
      check: s => G(s).score >= 1600,
      prog : s => Math.min(1600, G(s).score)
    },
    {
      id: 'g_combo14',
      label: 'คอมโบ ≥ 14',
      target: 14,
      check: s => G(s).comboMax >= 14,
      prog : s => Math.min(14, G(s).comboMax)
    },
    {
      id: 'g_good18',
      label: 'เก็บไฮเดรต 18',
      target: 18,
      check: s => G(s).good >= 18,
      prog : s => Math.min(18, G(s).good)
    },
    {
      id: 'g_nomiss6',
      label: 'พลาด ≤ 6',
      target: 6,
      check: s => G(s).miss <= 6,
      prog : s => Math.max(0, 6 - G(s).miss)
    },
    {
      id: 'g_time30',
      label: 'อยู่รอด 30s',
      target: 30,
      check: s => G(s).tick >= 30,
      prog : s => Math.min(30, G(s).tick)
    }
  ];
}

export default hydrationGoalsFor;