// === /HeroHealth/modes/groups.quest.js (Production Ready) ===
import { MissionDeck } from '../vr/mission.js';

function G(s) {
  return {
    score:   s.score   | 0,
    combo:   s.combo   | 0,
    comboMax:s.comboMax| 0,
    good:    s.goodCount | 0,
    miss:    s.junkMiss  | 0,
    tick:    s.tick      | 0
  };
}

function goalsFor(diff) {
  const K = ({
    easy:   { good:16, score: 800, combo: 8, miss: 8, time:30 },
    normal: { good:24, score:1400, combo:12, miss: 6, time:40 },
    hard:   { good:32, score:2000, combo:16, miss: 4, time:50 }
  }[diff]) || { good:20, score:1000, combo:10, miss:6, time:35 };

  return [
    {
      id:'g_good',
      label:`เลือกอาหาร “หมู่เป้าหมาย” ให้ได้ ${K.good} ชิ้น`,
      target:K.good,
      check:s => G(s).good >= K.good,
      prog: s => Math.min(K.good, G(s).good)
    },
    {
      id:'g_score',
      label:`คะแนนรวม ${K.score}+`,
      target:K.score,
      check:s => G(s).score >= K.score,
      prog: s => Math.min(K.score, G(s).score)
    },
    {
      id:'g_combo',
      label:`คอมโบ ≥ ${K.combo}`,
      target:K.combo,
      check:s => G(s).comboMax >= K.combo,
      prog: s => Math.min(K.combo, G(s).comboMax)
    },
    {
      id:'g_nomiss',
      label:`พลาดไม่เกิน ${K.miss} ครั้ง`,
      target:K.miss,
      check:s => G(s).miss <= K.miss,
      prog: s => Math.max(0, K.miss - G(s).miss)
    },
    {
      id:'g_time',
      label:`อยู่รอด ${K.time}s`,
      target:K.time,
      check:s => G(s).tick >= K.time,
      prog: s => Math.min(K.time, G(s).tick)
    },
    {
      id:'g_good18',
      label:'เก็บหมู่เป้าหมาย 18 ชิ้น',
      target:18,
      check:s => G(s).good >= 18,
      prog: s => Math.min(18, G(s).good)
    },
    {
      id:'g_combo14',
      label:'คอมโบ ≥ 14',
      target:14,
      check:s => G(s).comboMax >= 14,
      prog: s => Math.min(14, G(s).comboMax)
    },
    {
      id:'g_score1700',
      label:'คะแนน 1700+',
      target:1700,
      check:s => G(s).score >= 1700,
      prog: s => Math.min(1700, G(s).score)
    },
    {
      id:'g_good28',
      label:'เก็บหมู่เป้าหมาย 28 ชิ้น',
      target:28,
      check:s => G(s).good >= 28,
      prog: s => Math.min(28, G(s).good)
    },
    {
      id:'g_nomiss6',
      label:'พลาด ≤ 6',
      target:6,
      check:s => G(s).miss <= 6,
      prog: s => Math.max(0, 6 - G(s).miss)
    }
  ];
}

function minisFor(diff) {
  const K = ({
    easy:   { good:10, score: 600, combo: 8, miss: 8 },
    normal: { good:16, score:1000, combo:10, miss: 6 },
    hard:   { good:22, score:1500, combo:12, miss: 4 }
  }[diff]) || { good:12, score:800, combo:9, miss:6 };

  return [
    {
      id:'m_good',
      label:`เก็บหมู่เป้าหมาย ${K.good} ชิ้น`,
      target:K.good,
      check:s => G(s).good >= K.good,
      prog: s => Math.min(K.good, G(s).good)
    },
    {
      id:'m_score',
      label:`คะแนน ${K.score}+`,
      target:K.score,
      check:s => G(s).score >= K.score,
      prog: s => Math.min(K.score, G(s).score)
    },
    {
      id:'m_combo',
      label:`คอมโบ ≥ ${K.combo}`,
      target:K.combo,
      check:s => G(s).comboMax >= K.combo,
      prog: s => Math.min(K.combo, G(s).comboMax)
    },
    {
      id:'m_nomiss',
      label:`พลาดไม่เกิน ${K.miss}`,
      target:K.miss,
      check:s => G(s).miss <= K.miss,
      prog: s => Math.max(0, K.miss - G(s).miss)
    },
    {
      id:'m_good12',
      label:'เก็บหมู่เป้าหมาย 12 ชิ้น',
      target:12,
      check:s => G(s).good >= 12,
      prog: s => Math.min(12, G(s).good)
    },
    {
      id:'m_good18',
      label:'เก็บหมู่เป้าหมาย 18 ชิ้น',
      target:18,
      check:s => G(s).good >= 18,
      prog: s => Math.min(18, G(s).good)
    },
    {
      id:'m_score1200',
      label:'คะแนน 1200+',
      target:1200,
      check:s => G(s).score >= 1200,
      prog: s => Math.min(1200, G(s).score)
    },
    {
      id:'m_combo14',
      label:'คอมโบ ≥ 14',
      target:14,
      check:s => G(s).comboMax >= 14,
      prog: s => Math.min(14, G(s).comboMax)
    },
    {
      id:'m_nomiss4',
      label:'พลาด ≤ 4',
      target:4,
      check:s => G(s).miss <= 4,
      prog: s => Math.max(0, 4 - G(s).miss)
    },
    {
      id:'m_time15',
      label:'อยู่รอด 15s',
      target:15,
      check:s => G(s).tick >= 15,
      prog: s => Math.min(15, G(s).tick)
    },
    {
      id:'m_time25',
      label:'อยู่รอด 25s',
      target:25,
      check:s => G(s).tick >= 25,
      prog: s => Math.min(25, G(s).tick)
    },
    {
      id:'m_combo12',
      label:'คอมโบ ≥ 12',
      target:12,
      check:s => G(s).comboMax >= 12,
      prog: s => Math.min(12, G(s).comboMax)
    },
    {
      id:'m_score900',
      label:'คะแนน 900+',
      target:900,
      check:s => G(s).score >= 900,
      prog: s => Math.min(900, G(s).score)
    },
    {
      id:'m_good8',
      label:'เก็บหมู่เป้าหมาย 8 ชิ้น',
      target:8,
      check:s => G(s).good >= 8,
      prog: s => Math.min(8, G(s).good)
    },
    {
      id:'m_combo10',
      label:'คอมโบ ≥ 10',
      target:10,
      check:s => G(s).comboMax >= 10,
      prog: s => Math.min(10, G(s).comboMax)
    }
  ];
}

export function createGroupsQuest(diff = 'normal') {
  const deck = new MissionDeck({
    goalPool: goalsFor(diff),
    miniPool: minisFor(diff)
  });
  return deck;
}
export default { createGroupsQuest };