// === /herohealth/vr/ai-director.js ===
// AI Difficulty Director — hints only (engine decides to apply)
// ✅ smooth / fair adjustments
// ✅ deterministic-friendly (no randomness)
// ✅ uses metrics from ai-hooks

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a + (b-a)*t; }

export function attachAIDifficultyDirector(AI, opts={}){
  if(!AI) return ()=>{};
  const isResearch = AI.isResearch?.() ?? false;

  // engine should apply only if AI enabled and not research
  const canRun = () => (AI.enabled?.() && !isResearch);

  // smooth state (no randomness)
  let cur = { spawnRateMul:1, sizeMul:1, speedMul:1 };

  // target bands (tunable)
  const targetAcc = opts.targetAcc ?? 0.78;     // want players around 75–85%
  const targetRt  = opts.targetRt  ?? 750;      // ms
  const maxStep   = opts.maxStep   ?? 0.08;     // per evaluation (smooth)
  const evalEvery = opts.evalEvery ?? 1500;     // ms

  let lastEval = 0;

  function evalNow(m){
    if(!canRun()) return;

    // metrics snapshot
    const acc = clamp(m.accuracy ?? 1, 0, 1);
    const rt  = clamp((m.rtAvg ?? 0) || targetRt, 150, 2500);
    const fr  = clamp(m.frustration ?? 0, 0, 1);
    const ft  = clamp(m.fatigue ?? 0, 0, 1);
    const missBurst = clamp(m.missBurst ?? 0, 0, 10);

    // "pressure" signal: too easy -> raise; too hard -> lower
    // - if acc high and rt low => increase difficulty
    // - if acc low or frustration high => decrease
    const accErr = (acc - targetAcc);                 // + => too easy
    const rtErr  = (targetRt - rt) / targetRt;        // + => faster than target (too easy)
    const hardSignal = (0.65*accErr + 0.35*rtErr);     // + => increase difficulty

    // soften when frustration/fatigue/miss bursts
    const soften = clamp(0.55*fr + 0.35*ft + 0.10*clamp(missBurst/6,0,1), 0, 1);

    // desired multipliers
    // spawnRate: main lever
    let wantSpawn = clamp(1 + 0.55*hardSignal, 0.70, 1.55);
    // size: inverse lever (harder -> smaller)
    let wantSize  = clamp(1 - 0.35*hardSignal, 0.78, 1.18);
    // speed: moderate lever
    let wantSpeed = clamp(1 + 0.25*hardSignal, 0.85, 1.25);

    // apply soften (if struggling, ease back)
    if(soften > 0){
      wantSpawn = lerp(wantSpawn, 0.90, soften);
      wantSize  = lerp(wantSize,  1.08, soften);
      wantSpeed = lerp(wantSpeed, 0.92, soften);
    }

    // smooth update (maxStep)
    const stepToward = (curVal, wantVal) => {
      const delta = clamp(wantVal - curVal, -maxStep, maxStep);
      return curVal + delta;
    };

    cur.spawnRateMul = stepToward(cur.spawnRateMul, wantSpawn);
    cur.sizeMul      = stepToward(cur.sizeMul,      wantSize);
    cur.speedMul     = stepToward(cur.speedMul,     wantSpeed);

    // optional pattern hint (simple, deterministic)
    // - if acc very high -> suggest harder patterns
    // - if struggling -> simpler patterns
    let pattern = null;
    if(acc > 0.90 && rt < 650 && fr < 0.35) pattern = 'wave';
    else if(acc > 0.85 && fr < 0.45) pattern = 'ring';
    else if(acc < 0.65 || fr > 0.65) pattern = 'grid9';
    else pattern = null;

    AI.setDiffHint({
      spawnRateMul: cur.spawnRateMul,
      sizeMul: cur.sizeMul,
      speedMul: cur.speedMul,
      pattern
    });
  }

  // hook: evaluate on tick (or schedule)
  const offTick = AI.on('event:tick', ({metrics})=>{
    const t = (typeof performance!=='undefined'? performance.now(): Date.now());
    if(t - lastEval < evalEvery) return;
    lastEval = t;
    evalNow(metrics);
  });

  // also evaluate after miss/hit to react quicker but still smooth
  const offMiss = AI.on('event:miss', ({metrics})=> evalNow(metrics));
  const offHit  = AI.on('event:hit',  ({metrics})=> evalNow(metrics));

  // expose cleanup
  return ()=>{ offTick?.(); offMiss?.(); offHit?.(); };
}