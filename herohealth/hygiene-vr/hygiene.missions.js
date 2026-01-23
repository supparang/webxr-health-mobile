// === /herohealth/hygiene-vr/hygiene.missions.js ===
// Mission pool (kid-friendly, survival-ish) — PACK H
// Pick deterministic by seed (so research = fair)

function rngFromSeed(seed){
  let x = (Number(seed)||123456) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

const POOL = [
  {
    id:'M1',
    name:'Clean Streak',
    story:'ทำคอมโบให้ยาว! ล้างมือให้ถูกต่อเนื่อง',
    rules:{ minComboMax: 18 }
  },
  {
    id:'M2',
    name:'No Germ Touch',
    story:'อย่าโดนเชื้อเลย! ระวัง 🦠',
    rules:{ maxHazHits: 1 } // done when time ends (engine uses timeLeft<=0)
  },
  {
    id:'M3',
    name:'Loop Runner',
    story:'ทำครบ 7 ขั้นตอนให้ได้หลายรอบ',
    rules:{ minLoops: 2 }
  },
  {
    id:'M4',
    name:'Boss Hunter',
    story:'ชนะ King Germ 👑 ให้ได้อย่างน้อย 1 ครั้ง',
    rules:{ minBossClears: 1 }
  },
  {
    id:'M5',
    name:'Accuracy Star',
    story:'ความแม่นยำขั้นตอนต้องสูง!',
    rules:{ minStepAcc: 0.82 }
  }
];

export function pickMission({ seed, runMode, diff }){
  const r = rngFromSeed(seed);
  // research: เลือกแบบคงที่มากขึ้น (ไม่แกว่ง)
  const idx = Math.floor(r() * POOL.length);
  return POOL[idx];
}