// === /herohealth/hygiene-vr/hygiene.missions.js ===
// Simple mission picker (deterministic by seed)
// Exports: pickMission({ seed, runMode, diff })

'use strict';

function makeRNG(seed){
  let x = (Number(seed)||1) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

const MISSIONS = [
  { id:'m_loops2', name:'🏁 Marathon', story:'ครบ 2 รอบ 7 ขั้น', rules:{ minLoops:2 } },
  { id:'m_acc85',  name:'🎯 Precision', story:'ความแม่นยำ ≥ 85%', rules:{ minStepAcc:0.85 } },
  { id:'m_combo20',name:'🔥 Combo 20', story:'ทำ ComboMax ≥ 20', rules:{ minComboMax:20 } },
  { id:'m_safe2',  name:'🛡 Safe Hands', story:'โดนเชื้อไม่เกิน 2', rules:{ maxHazHits:2 } },
  { id:'m_boss1',  name:'👑 Boss Clear', story:'ชนะบอส 1 ครั้ง', rules:{ minBossClears:1 } },
];

export function pickMission({ seed=0, runMode='play', diff='normal' } = {}){
  const rng = makeRNG((Number(seed)||0) ^ 0xA53C91);
  // research/study: ยังคง deterministic เหมือนเดิม
  const pool = MISSIONS.slice();

  // ปรับตาม diff เล็กน้อย
  if(diff==='easy'){
    pool.forEach(m=>{
      if(m.rules.minComboMax) m.rules = { ...m.rules, minComboMax: Math.max(15, m.rules.minComboMax-3) };
      if(m.rules.minStepAcc)  m.rules = { ...m.rules, minStepAcc: Math.max(0.78, m.rules.minStepAcc-0.03) };
    });
  }
  if(diff==='hard'){
    pool.forEach(m=>{
      if(m.rules.minComboMax) m.rules = { ...m.rules, minComboMax: m.rules.minComboMax+3 };
      if(m.rules.minStepAcc)  m.rules = { ...m.rules, minStepAcc: Math.min(0.92, m.rules.minStepAcc+0.02) };
    });
  }

  return pool[Math.floor(rng()*pool.length)];
}