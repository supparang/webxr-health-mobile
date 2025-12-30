// === /herohealth/vr/ai-director.js ===
// HHA AI Director (Fun + Learning + Research Fairness)
// - play: adaptive ON (skill/fatigue driven) + procedural quests
// - research: adaptive OFF (deterministic plan from seed)
// Emits: hha:ai (optional)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a+(b-a)*t; }

// EMA helper
function ema(prev, x, k){
  if (!isFinite(prev)) return x;
  return prev + (x - prev) * clamp(k, 0.01, 0.5);
}

// deterministic PRNG (xorshift32)
function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

export function createAIDirector(opts={}){
  const run = String(opts.run || 'play').toLowerCase(); // play/research
  const diff = String(opts.diff || 'normal').toLowerCase();
  const seed = String(opts.seed || Date.now());
  const rng  = makeRng(seed + '|AI');

  const cfg = {
    // fairness: keep success probability in a sweet spot
    targetSuccess: (diff==='hard') ? 0.58 : (diff==='easy' ? 0.72 : 0.65),
    // update rate
    kSkill: 0.10,
    kFatigue: 0.08,
    // coach triggers use these metrics
    fatigueWarn: 0.62
  };

  const S = {
    // smoothed measures
    accE: NaN,         // 0..1
    rtE: NaN,          // ms
    missRateE: NaN,    // 0..1
    streakE: NaN,      // 0..1
    // derived
    skill: 0.0,        // 0..1
    fatigue: 0.0,      // 0..1
    frustration: 0.0,  // 0..1
    // plan outputs
    dMul: 1.0,
    sizeMul: 1.0,
    badMul: 1.0,
    shieldMul: 1.0,
    pattern: 'flow',   // flow/burst/wave/feint
    quest: null,
    planId: 'A0'
  };

  // deterministic research plan (no adaptation)
  function researchPlan(tSec){
    // fixed 20s phases (deterministic)
    const phase = Math.floor(tSec / 20) % 4;
    const list = [
      { dMul:1.00, sizeMul:1.00, badMul:1.00, shieldMul:1.00, pattern:'flow',  planId:'R0' },
      { dMul:0.92, sizeMul:0.95, badMul:1.10, shieldMul:1.00, pattern:'wave',  planId:'R1' },
      { dMul:0.84, sizeMul:0.90, badMul:1.18, shieldMul:0.95, pattern:'burst', planId:'R2' },
      { dMul:0.90, sizeMul:0.92, badMul:1.12, shieldMul:0.98, pattern:'feint', planId:'R3' }
    ];
    return list[phase];
  }

  function computeSkill(){
    // accE higher = better, rtE lower = better, streakE higher = better, missRateE lower = better
    const acc = clamp(S.accE, 0, 1);
    const rtN = clamp(1 - (clamp(S.rtE, 200, 1200) - 200) / 1000, 0, 1); // map 200..1200 -> 1..0
    const streak = clamp(S.streakE, 0, 1);
    const missN = clamp(1 - clamp(S.missRateE, 0, 1), 0, 1);
    // weight
    return clamp(acc*0.48 + rtN*0.22 + streak*0.18 + missN*0.12, 0, 1);
  }

  function computeFatigue(prevRtE, curRtE){
    // fatigue increases if RT is drifting worse + miss rate up
    const rtDrift = clamp((curRtE - prevRtE) / 350, 0, 1); // ~350ms drift -> high
    const miss = clamp(S.missRateE, 0, 1);
    return clamp(rtDrift*0.55 + miss*0.35 + (1-clamp(S.accE,0,1))*0.10, 0, 1);
  }

  function pickPattern(skill, fatigue){
    // fun pacing: better skill -> more burst/feint, fatigue -> more flow
    const r = rng();
    if (fatigue > 0.70) return 'flow';
    if (skill > 0.78){
      return r < 0.45 ? 'feint' : 'burst';
    }
    if (skill > 0.55){
      return r < 0.50 ? 'wave' : 'burst';
    }
    return r < 0.65 ? 'flow' : 'wave';
  }

  function genQuest(skill){
    // procedural mini variations (deterministic per seed + situation)
    const qR = rng();
    const target = (qR < 0.33) ? 'GREEN' : (qR < 0.66 ? 'LOW/HIGH' : 'MIX');
    const noSpam = (qR < 0.55);
    const streakNeed = (skill > 0.70) ? 8 : (skill > 0.50 ? 6 : 4);
    const safeShot = (skill > 0.65);

    return {
      id: 'Q' + Math.floor(qR*9999),
      target,
      streakNeed,
      noSpam,
      safeShot,
      // for UI
      title: 'Daily Challenge',
      line1: target==='GREEN' ? 'คุม GREEN ต่อเนื่อง' : (target==='LOW/HIGH' ? 'คุม LOW/HIGH ตอน Storm' : 'คุมโซนให้ถูกจังหวะ'),
      line2: `ทำ STREAK ≥ ${streakNeed}` + (noSpam ? ' • ห้ามกดรัวมั่ว' : ''),
      line3: safeShot ? 'Tip: รอจังหวะก่อนยิง BAD' : 'Tip: โฟกัสความแม่น'
    };
  }

  function update(input){
    // input: { tSec, accPct, avgRtMs, missRate, streakMax, combo, misses, inStorm }
    const tSec = Number(input.tSec||0);
    const acc = clamp((Number(input.accPct||0)/100), 0, 1);
    const rt = clamp(Number(input.avgRtMs||600), 200, 1500);
    const missRate = clamp(Number(input.missRate||0), 0, 1);
    const streakN = clamp(Number(input.streakMax||0)/10, 0, 1);

    const prevRtE = isFinite(S.rtE) ? S.rtE : rt;

    S.accE = ema(S.accE, acc, cfg.kSkill);
    S.rtE  = ema(S.rtE,  rt,  cfg.kSkill);
    S.missRateE = ema(S.missRateE, missRate, cfg.kSkill);
    S.streakE   = ema(S.streakE, streakN, cfg.kSkill);

    // skill/fatigue
    const newSkill = computeSkill();
    S.skill = ema(S.skill, newSkill, cfg.kSkill);

    const fatNow = computeFatigue(prevRtE, S.rtE);
    S.fatigue = ema(S.fatigue, fatNow, cfg.kFatigue);

    // frustration: misses spike + acc low
    const fr = clamp((S.missRateE*0.55 + (1-S.accE)*0.45), 0, 1);
    S.frustration = ema(S.frustration, fr, 0.10);

    // outputs
    if (run === 'research'){
      const P = researchPlan(tSec);
      S.dMul = P.dMul; S.sizeMul = P.sizeMul;
      S.badMul = P.badMul; S.shieldMul = P.shieldMul;
      S.pattern = P.pattern;
      S.planId = P.planId;
      // quest deterministic (seed only)
      if (!S.quest) S.quest = genQuest(0.55);
      return snapshot();
    }

    // play mode: adaptive ON but “fairness-aware”
    const skill = S.skill;
    const fatigue = S.fatigue;

    // difficulty multiplier: higher skill -> faster; fatigue -> relax
    let d = lerp(1.06, 0.80, skill);         // skill high => 0.80 (harder)
    d *= lerp(1.00, 1.12, fatigue);          // fatigue high => slower (easier)
    d = clamp(d, 0.78, 1.18);

    // size multiplier: skilled -> smaller ; fatigue -> bigger
    let sz = lerp(1.04, 0.84, skill);
    sz *= lerp(1.00, 1.10, fatigue);
    sz = clamp(sz, 0.82, 1.12);

    // bad/shield ratio control (fun + fairness)
    let badMul = lerp(0.92, 1.22, skill);
    badMul *= lerp(1.00, 0.88, fatigue); // tired -> fewer bad
    badMul = clamp(badMul, 0.85, 1.28);

    let shieldMul = lerp(1.10, 0.90, skill);
    shieldMul *= lerp(1.00, 1.18, fatigue); // tired -> more shield
    shieldMul = clamp(shieldMul, 0.85, 1.35);

    S.dMul = d;
    S.sizeMul = sz;
    S.badMul = badMul;
    S.shieldMul = shieldMul;

    S.pattern = pickPattern(skill, fatigue);

    // refresh quest occasionally
    if (!S.quest || (tSec % 25 < 0.20 && Math.random() < 0.02)){
      S.quest = genQuest(skill);
    }

    S.planId = 'P' + (Math.floor(skill*10)) + (fatigue>0.6 ? 'F' : '');
    return snapshot();
  }

  function snapshot(){
    return {
      skill: clamp(S.skill,0,1),
      fatigue: clamp(S.fatigue,0,1),
      frustration: clamp(S.frustration,0,1),
      dMul: S.dMul,
      sizeMul: S.sizeMul,
      badMul: S.badMul,
      shieldMul: S.shieldMul,
      pattern: S.pattern,
      quest: S.quest,
      planId: S.planId
    };
  }

  return { update, snapshot };
}