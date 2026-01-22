// === /herohealth/hygiene-vr/hygiene.missions.js ===
// Hygiene Missions — deterministic friendly
// Exports: pickMission({seed, runMode, diff})

'use strict';

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

const MISS_LIMIT_DEFAULT = 3;

const MISSIONS = [
  {
    id:'C01_first_wash',
    name:'ภารกิจเริ่มต้น: ล้างให้ครบ 1 รอบ',
    story:'วันนี้ก่อนกินข้าว! ทำ 7 ขั้นตอนให้ครบ 1 รอบแบบปลอดภัย',
    rules:{ minLoops:1, maxMiss:MISS_LIMIT_DEFAULT, minStepAcc:0.72 }
  },
  {
    id:'C02_combo_hero',
    name:'ภารกิจคอมโบ: COMBO 12',
    story:'ฮีโร่คอมโบ! ทำให้ได้คอมโบยาว ๆ โดยไม่พลาดขั้น',
    rules:{ minComboMax:12, maxMiss:MISS_LIMIT_DEFAULT, minStepAcc:0.70 }
  },
  {
    id:'C03_no_germs',
    name:'ภารกิจปลอดเชื้อ: ห้ามโดน 🦠 เกิน 1',
    story:'วันนี้เชื้อดุ! ต้องหลบให้ได้',
    rules:{ maxHazHits:1, maxMiss:MISS_LIMIT_DEFAULT, minStepAcc:0.68 }
  },
  {
    id:'C04_two_loops',
    name:'ภารกิจสายแข็ง: ครบ 2 รอบ',
    story:'ฝึกให้ชิน! ทำ 7 ขั้นตอนให้ครบ 2 รอบ',
    rules:{ minLoops:2, maxMiss:MISS_LIMIT_DEFAULT, minStepAcc:0.72 }
  },
  {
    id:'C05_boss_hunter',
    name:'ภารกิจบอส: ชนะ King Germ 1 ครั้ง',
    story:'มีข่าวว่า King Germ จะโผล่! ถ้าชนะได้จะเป็นฮีโร่ชุมชน',
    rules:{ minBossClears:1, maxMiss:MISS_LIMIT_DEFAULT, minStepAcc:0.68 }
  },
];

function tuneByDiff(m, diff){
  const mm = JSON.parse(JSON.stringify(m));
  if(diff==='easy'){
    if(mm.rules.minComboMax) mm.rules.minComboMax = Math.max(8, mm.rules.minComboMax-3);
    if(mm.rules.minLoops) mm.rules.minLoops = Math.max(1, mm.rules.minLoops);
    if(mm.rules.minStepAcc) mm.rules.minStepAcc = Math.max(0.60, mm.rules.minStepAcc-0.05);
  }else if(diff==='hard'){
    if(mm.rules.minComboMax) mm.rules.minComboMax = mm.rules.minComboMax + 3;
    if(mm.rules.minLoops) mm.rules.minLoops = mm.rules.minLoops + 0;
    if(mm.rules.minStepAcc) mm.rules.minStepAcc = Math.min(0.92, mm.rules.minStepAcc+0.05);
    if(typeof mm.rules.maxHazHits === 'number') mm.rules.maxHazHits = Math.max(0, mm.rules.maxHazHits);
  }
  return mm;
}

export function pickMission({ seed, runMode, diff }){
  // deterministic in research/study, playful random in play
  const useSeed = (runMode && runMode!=='play') ? seed : (seed ^ Date.now());
  const rng = makeRNG(useSeed);

  // pick weighted-ish: boss mission rarer in play
  const pool = MISSIONS.slice();
  let idx = Math.floor(rng()*pool.length);

  // make boss mission appear more in study mode
  if(runMode && runMode!=='play'){
    const bossIdx = pool.findIndex(x=>x.id==='C05_boss_hunter');
    if(bossIdx >= 0 && rng() < 0.35) idx = bossIdx;
  }else{
    // in play, reduce boss frequency a bit
    if(pool[idx].id==='C05_boss_hunter' && rng() < 0.55){
      idx = Math.floor(rng()*(pool.length-1));
    }
  }

  return tuneByDiff(pool[idx], (diff||'normal'));
}