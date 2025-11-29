// === /HeroHealth/modes/plate.quest.js (Diff-based goals + minis, P.5 Friendly) ===
import { MissionDeck } from '../vr/mission.js';

// โควต้าต่อชุด (รวม target = sum)
export const QUOTA = {
  easy:   [3,2,2,2,1],
  normal: [4,3,3,3,2],
  hard:   [5,4,4,4,3]
};

// ตารางค่าตามระดับความยากสำหรับ Goal หลัก
const GOAL_TABLE = {
  easy: {
    score1:   900,   // เป้าคะแนนหลักชุดแรก
    score2:  1300,   // เป้าคะแนนสูง
    combo1:     8,
    combo2:    10,
    miss1:      8,
    miss2:      6,
    timeMain:  30,
    good1:     18,
    good2:     24
  },
  normal: {
    score1:  1400,
    score2:  1800,
    combo1:    12,
    combo2:    14,
    miss1:      6,
    miss2:      4,
    timeMain:  40,
    good1:     24,
    good2:     30
  },
  hard: {
    score1:  1800,
    score2:  2200,
    combo1:    14,
    combo2:    16,
    miss1:      4,
    miss2:      3,
    timeMain:  45,
    good1:     28,
    good2:     34
  }
};

// ตารางค่าตามระดับความยากสำหรับ Mini quest
const MINI_TABLE = {
  easy: {
    partialRatio: 0.5,  // ต้องเก็บตามโควตารวมประมาณ 50%
    score1:       700,
    score2:      1000,
    score3:      1300,
    combo1:         8,
    combo2:        10,
    miss1:          8,
    miss2:          6,
    time1:         18,
    time2:         25,
    good1:        12,
    good2:        18
  },
  normal: {
    partialRatio: 0.6,
    score1:       900,
    score2:      1200,
    score3:      1500,
    combo1:        10,
    combo2:        12,
    miss1:          6,
    miss2:          4,
    time1:         20,
    time2:         30,
    good1:        14,
    good2:        22
  },
  hard: {
    partialRatio: 0.7,
    score1:      1100,
    score2:      1500,
    score3:      1900,
    combo1:        12,
    combo2:        14,
    miss1:          4,
    miss2:          3,
    time1:         22,
    time2:         35,
    good1:        18,
    good2:        26
  }
};

function buildPlateGoals(diff){
  const need  = QUOTA[diff] || QUOTA.normal; // [G1..G5]
  const total = need.reduce((a,b)=>a+b,0);

  const K = GOAL_TABLE[diff] || GOAL_TABLE.normal;

  return [
    {
      id:'g_quota',
      label:`จัดจานครบ 5 หมู่ (${total} ชิ้น) 🍽️`,
      target: total,
      check:s=>{
        const c = (s.gCounts || [0,0,0,0,0]);
        return c.every((v,i)=> v >= need[i]);
      },
      prog:s=>{
        const c = (s.gCounts || [0,0,0,0,0]);
        return c.reduce((sum,v,i)=> sum + Math.min(v, need[i]), 0);
      }
    },

    {
      id:'g_score',
      label:`คะแนนรวม ${K.score1}+ แต้ม`,
      target: K.score1,
      check:s=>(s.score|0) >= K.score1,
      prog:s=>Math.min(K.score1, (s.score|0))
    },

    {
      id:'g_combo',
      label:`คอมโบต่อเนื่อง ≥ ${K.combo1}`,
      target: K.combo1,
      check:s=>(s.comboMax|0) >= K.combo1,
      prog:s=>Math.min(K.combo1, (s.comboMax|0))
    },

    {
      id:'g_nomiss',
      label:`พลาด/หลุดเป้าไม่เกิน ${K.miss1} ครั้ง`,
      target: K.miss1,
      check:s=>(s.junkMiss|0) <= K.miss1,
      prog:s=>Math.max(0, K.miss1 - (s.junkMiss|0))
    },

    {
      id:'g_time',
      label:`อยู่รอด ${K.timeMain}s ⏱️`,
      target: K.timeMain,
      check:s=>(s.tick|0) >= K.timeMain,
      prog:s=>Math.min(K.timeMain, (s.tick|0))
    },

    {
      id:'g_good24',
      label:`เก็บของดี ${K.good1} ชิ้น ✅`,
      target: K.good1,
      check:s=>(s.goodCount|0) >= K.good1,
      prog:s=>Math.min(K.good1, (s.goodCount|0))
    },

    {
      id:'g_combo14',
      label:`คอมโบต่อเนื่อง ≥ ${K.combo2}`,
      target: K.combo2,
      check:s=>(s.comboMax|0) >= K.combo2,
      prog:s=>Math.min(K.combo2, (s.comboMax|0))
    },

    {
      id:'g_score1800',
      label:`คะแนนรวม ${K.score2}+ แต้ม`,
      target: K.score2,
      check:s=>(s.score|0) >= K.score2,
      prog:s=>Math.min(K.score2, (s.score|0))
    },

    {
      id:'g_good30',
      label:`เก็บของดี ${K.good2} ชิ้น ✅`,
      target: K.good2,
      check:s=>(s.goodCount|0) >= K.good2,
      prog:s=>Math.min(K.good2, (s.goodCount|0))
    },

    {
      id:'g_nomiss4',
      label:`พลาด/หลุดเป้าไม่เกิน ${K.miss2} ครั้ง`,
      target: K.miss2,
      check:s=>(s.junkMiss|0) <= K.miss2,
      prog:s=>Math.max(0, K.miss2 - (s.junkMiss|0))
    },
  ];
}

function buildPlateMinis(diff){
  const needArr = QUOTA[diff] || QUOTA.normal;
  const K = MINI_TABLE[diff] || MINI_TABLE.normal;

  const totalNeed = needArr.reduce((a,b)=>a+b,0);
  const partial   = Math.ceil(totalNeed * K.partialRatio);

  return [
    {
      id:'m_partial',
      label:`โควตาย่อยครบรวม ${partial} ชิ้น ✨`,
      target: partial,
      check:s=>{
        const c = (s.gCounts || [0,0,0,0,0]);
        const sum = c.reduce((p,v,i)=> p + Math.min(v, needArr[i]), 0);
        return sum >= partial;
      },
      prog:s=>{
        const c = (s.gCounts || [0,0,0,0,0]);
        return c.reduce((p,v,i)=> p + Math.min(v, needArr[i]), 0);
      }
    },

    {
      id:'m_combo10',
      label:`คอมโบต่อเนื่อง ≥ ${K.combo1}`,
      target: K.combo1,
      check:s=>(s.comboMax|0) >= K.combo1,
      prog:s=>Math.min(K.combo1, (s.comboMax|0))
    },

    {
      id:'m_score900',
      label:`คะแนนรวม ${K.score1}+ แต้ม`,
      target: K.score1,
      check:s=>(s.score|0) >= K.score1,
      prog:s=>Math.min(K.score1, (s.score|0))
    },

    {
      id:'m_nomiss6',
      label:`พลาด/หลุดเป้าไม่เกิน ${K.miss1} ครั้ง`,
      target: K.miss1,
      check:s=>(s.junkMiss|0) <= K.miss1,
      prog:s=>Math.max(0, K.miss1 - (s.junkMiss|0))
    },

    {
      id:'m_good14',
      label:`เก็บของดี ${K.good1} ชิ้น ✅`,
      target: K.good1,
      check:s=>(s.goodCount|0) >= K.good1,
      prog:s=>Math.min(K.good1, (s.goodCount|0))
    },

    {
      id:'m_time20',
      label:`อยู่รอด ${K.time1}s`,
      target: K.time1,
      check:s=>(s.tick|0) >= K.time1,
      prog:s=>Math.min(K.time1, (s.tick|0))
    },

    {
      id:'m_combo12',
      label:`คอมโบต่อเนื่อง ≥ ${K.combo2}`,
      target: K.combo2,
      check:s=>(s.comboMax|0) >= K.combo2,
      prog:s=>Math.min(K.combo2, (s.comboMax|0))
    },

    {
      id:'m_score1200',
      label:`คะแนนรวม ${K.score2}+ แต้ม`,
      target: K.score2,
      check:s=>(s.score|0) >= K.score2,
      prog:s=>Math.min(K.score2, (s.score|0))
    },

    {
      id:'m_good18',
      label:`เก็บของดี ${K.good2} ชิ้น ✅`,
      target: K.good2,
      check:s=>(s.goodCount|0) >= K.good2,
      prog:s=>Math.min(K.good2, (s.goodCount|0))
    },

    {
      id:'m_time30',
      label:`อยู่รอด ${K.time2}s`,
      target: K.time2,
      check:s=>(s.tick|0) >= K.time2,
      prog:s=>Math.min(K.time2, (s.tick|0))
    },

    // อีก 5 เควสต์เสริม (รวม 15)
    {
      id:'m_combo14',
      label:`คอมโบต่อเนื่อง ≥ ${K.combo2}`,
      target: K.combo2,
      check:s=>(s.comboMax|0) >= K.combo2,
      prog:s=>Math.min(K.combo2, (s.comboMax|0))
    },

    {
      id:'m_score1500',
      label:`คะแนนรวม ${K.score3}+ แต้ม`,
      target: K.score3,
      check:s=>(s.score|0) >= K.score3,
      prog:s=>Math.min(K.score3, (s.score|0))
    },

    {
      id:'m_nomiss4',
      label:`พลาด/หลุดเป้าไม่เกิน ${K.miss2} ครั้ง`,
      target: K.miss2,
      check:s=>(s.junkMiss|0) <= K.miss2,
      prog:s=>Math.max(0, K.miss2 - (s.junkMiss|0))
    },

    {
      id:'m_good22',
      label:`เก็บของดี ${K.good2} ชิ้น ✅`,
      target: K.good2,
      check:s=>(s.goodCount|0) >= K.good2,
      prog:s=>Math.min(K.good2, (s.goodCount|0))
    },

    {
      id:'m_time25',
      label:`อยู่รอด ${Math.round((K.time1 + K.time2)/2)}s`,
      target: Math.round((K.time1 + K.time2)/2),
      check:s=>(s.tick|0) >= Math.round((K.time1 + K.time2)/2),
      prog:s=>Math.min(Math.round((K.time1 + K.time2)/2), (s.tick|0))
    },
  ];
}

export function createPlateQuest(diff='normal'){
  return new MissionDeck({
    goalPool: buildPlateGoals(diff),
    miniPool: buildPlateMinis(diff)
  });
}

export default { createPlateQuest, QUOTA };