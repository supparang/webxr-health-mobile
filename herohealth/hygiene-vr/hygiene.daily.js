// === /herohealth/hygiene-vr/hygiene.daily.js ===
// Daily Challenge generator (deterministic by local date)
// Exports: getDailyChallenge({ dateKey, seed, diff })

'use strict';

function makeRNG(seed){
  let x = (Number(seed)||1) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

function getLocalDateKey(){
  try{
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }catch{
    return '1970-01-01';
  }
}

function hashStrToSeed(s){
  s = String(s||'');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function getDailyChallenge({ dateKey=null, seed=0, diff='normal' } = {}){
  const dk = dateKey || getLocalDateKey();
  const baseSeed = (hashStrToSeed(dk) ^ (Number(seed)||0)) >>> 0;
  const rng = makeRNG(baseSeed);

  // 3 types (rotate by day seed)
  const types = [
    {
      id:'daily_clean',
      name:'🧼 Clean Run',
      desc:'ผ่านให้ได้โดย “โดนเชื้อ 0”',
      rules:{ maxHazHits:0, minLoops:1 }
    },
    {
      id:'daily_combo',
      name:'🔥 Combo Hero',
      desc:'ทำ COMBO ให้ถึง 25 อย่างน้อย 1 ครั้ง',
      rules:{ minComboMax:25 }
    },
    {
      id:'daily_boss',
      name:'👑 Boss Hunter',
      desc:'ชนะบอสอย่างน้อย 1 รอบ',
      rules:{ minBossClears:1 }
    }
  ];

  // Pick deterministic
  const pick = types[Math.floor(rng()*types.length)];

  // Slight tuning by difficulty (optional)
  if(diff==='easy' && pick.rules.minComboMax) pick.rules.minComboMax = 20;
  if(diff==='hard' && pick.rules.minComboMax) pick.rules.minComboMax = 28;

  return {
    dateKey: dk,
    seed: baseSeed,
    ...pick
  };
}