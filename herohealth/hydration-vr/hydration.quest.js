// === /herohealth/hydration-vr/hydration.quest.js ===
// Quest สำหรับโหมด Hydration (Goals + Mini quests)
// ใช้ร่วมกับ MissionDeck และ helper จาก hydration.state.js

import { MissionDeck } from '../vr/mission.js';
import { mapHydrationState, normalizeHydrationDiff } from './hydration.state.js';

// ย่อให้สั้น: แปลง state ดิบจาก MissionDeck.stats → ฟอร์แมตที่ใช้ในเงื่อนไข
function G(s) {
  return mapHydrationState(s || {});
}

// ---------------- Goals (เป้าหมายใหญ่) ----------------

function goalsFor(diffRaw) {
  const diff = normalizeHydrationDiff(diffRaw);

  const table = {
    easy:   { score: 700,  combo:  8, miss: 8, green: 18 },
    normal: { score: 1200, combo: 12, miss: 6, green: 28 },
    hard:   { score: 1800, combo: 16, miss: 4, green: 36 }
  };

  const K = table[diff] || table.normal;

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

// ---------------- Mini quests (ภารกิจย่อย) ----------------

function minisFor(diffRaw) {
  const diff = normalizeHydrationDiff(diffRaw);

  const table = {
    easy:   { score:  500, combo:  8, good: 12, miss: 8 },
    normal: { score:  900, combo: 10, good: 18, miss: 6 },
    hard:   { score: 1400, combo: 12, good: 24, miss: 4 }
  };

  const K = table[diff] || table.normal;

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

// --------- Factory สำหรับใช้ใน hydration.safe.js ---------

export function createHydrationQuest(diff = 'normal') {
  return new MissionDeck({
    goalPool: goalsFor(diff),
    miniPool: minisFor(diff)
  });
}

export default { createHydrationQuest };