// === /herohealth/vr/ai-director.js ===
// HHA AI Difficulty Director — Universal (seeded, fair, smooth)
// ✅ deterministic (cfg.seed) -> reproducible for research
// ✅ outputs: sizeMul, spawnMul, badMul, shieldMul, assistMul, pressureNeedAdj
// ✅ smoothing: avoids sudden spikes (EMA + step clamp)
// ✅ "fairness": when misses spike, it helps a bit; when skill rises, it tightens gently

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0)/4294967296;
  };
}

export function createAIDifficultyDirector(cfg = {}){
  const seed = String(cfg.seed || 'hha-seed');
  const rng = cfg.rng || makeRng(seed);

  const mode = String(cfg.mode || 'play');     // play / research
  const diff = String(cfg.diff || 'normal');   // easy/normal/hard

  // baseline targets (normalized)
  const targets = {
    acc: diff==='easy'?0.72 : diff==='hard'?0.82 : 0.78,
    missRate: diff==='easy'?0.28 : diff==='hard'?0.16 : 0.22, // per second-ish normalized by caller
    combo: diff==='easy'?0.30 : diff==='hard'?0.45 : 0.38
  };

  const st = {
    // smoothed signals 0..1
    skill: 0.45,
    fatigue: 0.00,
    frustration: 0.10,

    // smoothed difficulty 0..1
    d: diff==='easy'?0.35 : diff==='hard'?0.60 : 0.48
  };

  function stepTo(cur, next, maxStep){
    const d = next - cur;
    if (Math.abs(d) <= maxStep) return next;
    return cur + Math.sign(d)*maxStep;
  }

  function updateSignals(obs){
    // obs: { accuracy, missRate, comboNorm, fatigue, frustration }
    const a = clamp(obs.accuracy, 0, 1);
    const m = clamp(obs.missRate, 0, 1);
    const c = clamp(obs.comboNorm, 0, 1);

    // estimate skill from performance
    const perf = clamp(a*0.62 + (1-m)*0.22 + c*0.16, 0, 1);

    // EMA smoothing
    const k = 0.08; // slow change
    st.skill = clamp(st.skill*(1-k) + perf*k, 0, 1);

    // external fatigue/frustration may be provided
    if (typeof obs.fatigue === 'number'){
      st.fatigue = clamp(st.fatigue*0.9 + clamp(obs.fatigue,0,1)*0.1, 0, 1);
    }
    if (typeof obs.frustration === 'number'){
      st.frustration = clamp(st.frustration*0.85 + clamp(obs.frustration,0,1)*0.15, 0, 1);
    }
  }

  function computeDesiredDifficulty(){
    // error terms
    // if accuracy > target -> can be harder
    // if missRate > target -> ease
    const eAcc  = (st.skill - targets.acc);          // >0 => harder
    const eFrus = (st.frustration - 0.55);           // >0 => ease
    const eFat  = (st.fatigue - 0.65);               // >0 => ease

    // base desired around diff
    const base =
      diff==='easy'?0.35 :
      diff==='hard'?0.62 :
      0.48;

    // weighted combine
    let desired = base + eAcc*0.55 - eFrus*0.35 - eFat*0.25;

    // small deterministic dither for "alive feel" (but stable)
    const jitter = (rng()*2-1) * (mode==='research'?0.0:0.012);
    desired = clamp(desired + jitter, 0, 1);
    return desired;
  }

  function computeOutputs(){
    // smooth difficulty changes: max step per update tick
    const desired = computeDesiredDifficulty();
    const maxStep = mode==='research' ? 0.010 : 0.018;
    st.d = clamp(stepTo(st.d, desired, maxStep), 0, 1);

    // map difficulty -> gameplay knobs
    // higher d => smaller size, faster spawns, more bad, less shield, less assist
    const d = st.d;

    const sizeMul   = clamp(1.10 - 0.35*d, 0.72, 1.12);
    const spawnMul  = clamp(1.18 - 0.55*d, 0.72, 1.20);
    const badMul    = clamp(0.85 + 0.75*d, 0.80, 1.75);
    const shieldMul = clamp(1.10 - 0.65*d, 0.55, 1.10);
    const assistMul = clamp(1.25 - 0.85*d, 0.55, 1.30);

    // pressure need: higher d => need stronger pressure
    const pressureNeedAdj = clamp(-0.08 + 0.16*d, -0.06, 0.18);

    return {
      d,
      sizeMul,
      spawnMul,
      badMul,
      shieldMul,
      assistMul,
      pressureNeedAdj,
      explain: {
        skill: st.skill,
        fatigue: st.fatigue,
        frustration: st.frustration
      }
    };
  }

  return {
    update(obs){
      updateSignals(obs || {});
      return computeOutputs();
    }
  };
}