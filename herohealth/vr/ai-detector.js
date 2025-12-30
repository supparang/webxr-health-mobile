// === /herohealth/vr/ai-director.js ===
// HHA AI Director — safe difficulty shaping (PLAY only, deterministic if given rng)
// Output modifiers are bounded; never changes research locks.
//
// update(ctx) -> { spawnRateMul, sizeMul, pBadAdd, pShieldAdd }

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAIDirector(opts={}){
  const rng = opts.rng || Math.random;
  const diff = String(opts.diff || 'normal').toLowerCase();

  // bounds (safe)
  const B = {
    spawnRateMulMin: 0.86,
    spawnRateMulMax: 1.18,
    sizeMulMin: 0.88,
    sizeMulMax: 1.12,
    pBadAddMin: -0.06,
    pBadAddMax:  0.08,
    pShieldAddMin: -0.02,
    pShieldAddMax:  0.06
  };

  // memory / smoothing
  let mSkill=0.5, mFrus=0.3, mFat=0.3;
  let lastOut = { spawnRateMul:1, sizeMul:1, pBadAdd:0, pShieldAdd:0 };

  function smooth(prev, next, a){ return prev*(1-a) + next*a; }

  function update(ctx){
    // ctx: { skill(0..1), frustration(0..1), fatigue(0..1), inStorm, inEndWindow, misses, combo }
    const skill = clamp(ctx.skill,0,1);
    const frus  = clamp(ctx.frustration,0,1);
    const fat   = clamp(ctx.fatigue,0,1);

    // smooth to avoid jitter
    mSkill = smooth(mSkill, skill, 0.12);
    mFrus  = smooth(mFrus,  frus,  0.10);
    mFat   = smooth(mFat,   fat,   0.08);

    // base by diff
    let baseSpawn = diff==='hard'? 1.06 : diff==='easy'? 0.96 : 1.00;
    let baseSize  = diff==='hard'? 0.96 : diff==='easy'? 1.04 : 1.00;

    // shaping logic:
    // - ถ้า skill สูง + frus ต่ำ -> เร่งสปีด/ลดขนาดนิด
    // - ถ้า frus สูง หรือ fat สูง -> ผ่อน (ช้าลง/ใหญ่ขึ้น/เพิ่ม shield)
    const pressure = clamp(mFrus*0.65 + mFat*0.35, 0, 1);
    const mastery  = clamp(mSkill*(1-pressure), 0, 1);

    // spawn rate
    let spawnRateMul = baseSpawn * (1 + (mastery-0.5)*0.28) * (1 - (pressure-0.35)*0.20);
    // size
    let sizeMul = baseSize * (1 - (mastery-0.5)*0.16) * (1 + (pressure-0.35)*0.18);

    // tweak probabilities
    let pBadAdd = (mastery-0.5)*0.06 - (pressure-0.35)*0.05;
    let pShieldAdd = (pressure-0.35)*0.06 - (mastery-0.5)*0.02;

    // small randomness to feel alive but bounded (still deterministic if rng seeded)
    const j = (rng()*2-1);
    spawnRateMul *= (1 + j*0.015);
    sizeMul      *= (1 - j*0.012);

    // clamp
    spawnRateMul = clamp(spawnRateMul, B.spawnRateMulMin, B.spawnRateMulMax);
    sizeMul      = clamp(sizeMul,      B.sizeMulMin,      B.sizeMulMax);
    pBadAdd      = clamp(pBadAdd,      B.pBadAddMin,      B.pBadAddMax);
    pShieldAdd   = clamp(pShieldAdd,   B.pShieldAddMin,   B.pShieldAddMax);

    lastOut = { spawnRateMul, sizeMul, pBadAdd, pShieldAdd };
    return lastOut;
  }

  function getLast(){ return lastOut; }

  return { update, getLast };
}