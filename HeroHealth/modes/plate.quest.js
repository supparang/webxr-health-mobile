// === /HeroHealth/modes/plate.quest.js (Full, 5 หมู่ + โควตา) ===
import { MissionDeck } from '../vr/mission.js';

// โควต้าต่อชุด (รวม target = sum)
const QUOTA = {
  easy:   [3,2,2,2,1],
  normal: [4,3,3,3,2],
  hard:   [5,4,4,4,3]
};

function buildPlateGoals(diff){
  const need = QUOTA[diff] || QUOTA.normal; // [G1..G5]
  const total = need.reduce((a,b)=>a+b,0);
  return [
    {id:'g_quota', label:`จัดจานครบโควตา 5 หมู่ (รวม ${total})`, target:total,
      check:s=>{
        const c=(s.gCounts||[0,0,0,0,0]); return c.every((v,i)=>v>=need[i]);
      },
      prog:s=>{
        const c=(s.gCounts||[0,0,0,0,0]); return c.reduce((sum,v,i)=>sum+Math.min(v,need[i]),0);
      }},
    {id:'g_score', label:'คะแนนรวม 1400+', target:1400, check:s=>(s.score|0)>=1400, prog:s=>Math.min(1400,(s.score|0))},
    {id:'g_combo', label:'คอมโบ ≥ 12', target:12, check:s=>(s.comboMax|0)>=12, prog:s=>Math.min(12,(s.comboMax|0))},
    {id:'g_nomiss',label:'พลาด ≤ 6', target:6, check:s=>(s.junkMiss|0)<=6, prog:s=>Math.max(0,6-(s.junkMiss|0))},
    {id:'g_time',  label:'อยู่รอด 40s', target:40, check:s=>(s.tick|0)>=40, prog:s=>Math.min(40,(s.tick|0))},
    {id:'g_good24',label:'เก็บของดี 24', target:24, check:s=>(s.goodCount|0)>=24, prog:s=>Math.min(24,(s.goodCount|0))},
    {id:'g_combo14',label:'คอมโบ ≥ 14', target:14, check:s=>(s.comboMax|0)>=14, prog:s=>Math.min(14,(s.comboMax|0))},
    {id:'g_score1800',label:'คะแนน 1800+', target:1800, check:s=>(s.score|0)>=1800, prog:s=>Math.min(1800,(s.score|0))},
    {id:'g_good30',label:'เก็บของดี 30', target:30, check:s=>(s.goodCount|0)>=30, prog:s=>Math.min(30,(s.goodCount|0))},
    {id:'g_nomiss4',label:'พลาด ≤ 4', target:4, check:s=>(s.junkMiss|0)<=4, prog:s=>Math.max(0,4-(s.junkMiss|0))},
  ];
}

function buildPlateMinis(diff){
  const need = QUOTA[diff] || QUOTA.normal;
  const partial = Math.ceil(need.reduce((a,b)=>a+b,0)*0.6);
  return [
    {id:'m_partial',label:`โควตาย่อยครบรวม ${partial}`, target:partial,
      check:s=>{
        const c=(s.gCounts||[0,0,0,0,0]); const sum=c.reduce((p,v,i)=>p+Math.min(v,need[i]),0); return sum>=partial;
      },
      prog:s=>{
        const c=(s.gCounts||[0,0,0,0,0]); return c.reduce((p,v,i)=>p+Math.min(v,need[i]),0);
      }},
    {id:'m_combo10',label:'คอมโบ ≥ 10', target:10, check:s=>(s.comboMax|0)>=10, prog:s=>Math.min(10,(s.comboMax|0))},
    {id:'m_score900',label:'คะแนน 900+', target:900, check:s=>(s.score|0)>=900, prog:s=>Math.min(900,(s.score|0))},
    {id:'m_nomiss6',label:'พลาด ≤ 6', target:6, check:s=>(s.junkMiss|0)<=6, prog:s=>Math.max(0,6-(s.junkMiss|0))},
    {id:'m_good14',label:'เก็บของดี 14', target:14, check:s=>(s.goodCount|0)>=14, prog:s=>Math.min(14,(s.goodCount|0))},
    {id:'m_time20',label:'อยู่รอด 20s', target:20, check:s=>(s.tick|0)>=20, prog:s=>Math.min(20,(s.tick|0))},
    {id:'m_combo12',label:'คอมโบ ≥ 12', target:12, check:s=>(s.comboMax|0)>=12, prog:s=>Math.min(12,(s.comboMax|0))},
    {id:'m_score1200',label:'คะแนน 1200+', target:1200, check:s=>(s.score|0)>=1200, prog:s=>Math.min(1200,(s.score|0))},
    {id:'m_good18',label:'เก็บของดี 18', target:18, check:s=>(s.goodCount|0)>=18, prog:s=>Math.min(18,(s.goodCount|0))},
    {id:'m_time30',label:'อยู่รอด 30s', target:30, check:s=>(s.tick|0)>=30, prog:s=>Math.min(30,(s.tick|0))},
    // อีก 5 เควสต์เสริม (รวม 15)
    {id:'m_combo14',label:'คอมโบ ≥ 14', target:14, check:s=>(s.comboMax|0)>=14, prog:s=>Math.min(14,(s.comboMax|0))},
    {id:'m_score1500',label:'คะแนน 1500+', target:1500, check:s=>(s.score|0)>=1500, prog:s=>Math.min(1500,(s.score|0))},
    {id:'m_nomiss4',label:'พลาด ≤ 4', target:4, check:s=>(s.junkMiss|0)<=4, prog:s=>Math.max(0,4-(s.junkMiss|0))},
    {id:'m_good22',label:'เก็บของดี 22', target:22, check:s=>(s.goodCount|0)>=22, prog:s=>Math.min(22,(s.goodCount|0))},
    {id:'m_time25',label:'อยู่รอด 25s', target:25, check:s=>(s.tick|0)>=25, prog:s=>Math.min(25,(s.tick|0))},
  ];
}

export function createPlateQuest(diff='normal'){
  return new MissionDeck({ goalPool: buildPlateGoals(diff), miniPool: buildPlateMinis(diff) });
}
export default { createPlateQuest, QUOTA };