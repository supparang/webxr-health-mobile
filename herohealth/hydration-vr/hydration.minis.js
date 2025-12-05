// === /herohealth/hydration-vr/hydration.minis.js ===
// Mini quests ของโหมด Hydration

import { mapHydrationState as G, normalizeHydrationDiff } from './hydration.state.js';

export function hydrationMinisFor(diff) {
  const D = normalizeHydrationDiff(diff);

  const table = {
    easy:   { score:  500, combo:  8, good: 12, miss: 8 },
    normal: { score:  900, combo: 10, good: 18, miss: 6 },
    hard:   { score: 1400, combo: 12, good: 24, miss: 4 }
  };
  const K = table[D] || table.normal;

  return [
    {
      id: 'm_score',
      label: `คะแนน ${K.score}+`,
      target: K.score,
      check: s => G(s).score >= K.score,
      prog : s => Math.min(K.score, G(s).score)
    },

    {
      id: 'm_combo',
      label: `คอมโบ ≥ ${K.combo}`,
      target: K.combo,
      check: s => G(s).comboMax >= K.combo,
      prog : s => Math.min(K.combo, G(s).comboMax)
    },

    {
      id: 'm_good',
      label: `เก็บไฮเดรต ${K.good}`,
      target: K.good,
      check: s => G(s).good >= K.good,
      prog : s => Math.min(K.good, G(s).good)
    },

    {
      id: 'm_nomiss',
      label: `พลาดไม่เกิน ${K.miss}`,
      target: K.miss,
      check: s => G(s).miss <= K.miss,
      prog : s => Math.max(0, K.miss - G(s).miss)
    },

    // ✅ ใช้ greenTick สำหรับเวลา GREEN
    {
      id: 'm_green12',
      label: 'อยู่ GREEN 12s',
      target: 12,
      check: s => G(s).green >= 12,
      prog : s => Math.min(12, G(s).green)
    },

    {
      id: 'm_time15',
      label: 'อยู่รอด 15s',
      target: 15,
      check: s => G(s).tick >= 15,
      prog : s => Math.min(15, G(s).tick)
    },

    {
      id: 'm_combo12',
      label: 'คอมโบ ≥ 12',
      target: 12,
      check: s => G(s).comboMax >= 12,
      prog : s => Math.min(12, G(s).comboMax)
    },

    {
      id: 'm_score1100',
      label: 'คะแนน 1100+',
      target: 1100,
      check: s => G(s).score >= 1100,
      prog : s => Math.min(1100, G(s).score)
    },

    {
      id: 'm_good16',
      label: 'เก็บไฮเดรต 16',
      target: 16,
      check: s => G(s).good >= 16,
      prog : s => Math.min(16, G(s).good)
    },

    {
      id: 'm_nomiss4',
      label: 'พลาด ≤ 4',
      target: 4,
      check: s => G(s).miss <= 4,
      prog : s => Math.max(0, 4 - G(s).miss)
    },

    {
      id: 'm_green8',
      label: 'อยู่ GREEN 8s',
      target: 8,
      check: s => G(s).green >= 8,
      prog : s => Math.min(8, G(s).green)
    },

    {
      id: 'm_score800',
      label: 'คะแนน 800+',
      target: 800,
      check: s => G(s).score >= 800,
      prog : s => Math.min(800, G(s).score)
    },

    {
      id: 'm_good10',
      label: 'เก็บไฮเดรต 10',
      target: 10,
      check: s => G(s).good >= 10,
      prog : s => Math.min(10, G(s).good)
    },

    {
      id: 'm_combo10',
      label: 'คอมโบ ≥ 10',
      target: 10,
      check: s => G(s).comboMax >= 10,
      prog : s => Math.min(10, G(s).comboMax)
    },

    {
      id: 'm_time25',
      label: 'อยู่รอด 25s',
      target: 25,
      check: s => G(s).tick >= 25,
      prog : s => Math.min(25, G(s).tick)
    }
  ];
}

export default hydrationMinisFor;