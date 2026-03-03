// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Prediction Only (NO adaptive difficulty)
// PATCH v20260303-AI-PREDICT-STUB

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || '');
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // Simple state
  let lastPred = { hazardRisk: 0.15, next5: ['focus good'] };
  let junkHits = 0;
  let goodExpired = 0;
  let shots = 0;
  let hits  = 0;
  let combo = 0;
  let shield = 0;

  function scoreRisk(){
    // heuristic: if accuracy drops + junkHits rises + goodExpired rises => higher risk
    const acc = shots>0 ? (hits/shots) : 1;
    const err = (junkHits*1.2 + goodExpired*0.9);
    const base = 0.10 + (1-acc)*0.55 + clamp(err/20, 0, 0.45);
    const diffBoost = (diff==='hard') ? 0.08 : (diff==='easy' ? -0.04 : 0);
    const vBoost = (view==='cvr' || view==='vr') ? 0.04 : 0;
    return clamp(base + diffBoost + vBoost, 0, 0.99);
  }

  function nextHint(risk){
    if(risk >= 0.70) return ['slow down', 'avoid junk', 'use shield', 'center aim', 'tap earlier'];
    if(risk >= 0.45) return ['watch junk', 'prioritize good', 'keep combo', 'stay centered', 'grab shield'];
    return ['keep combo', 'grab bonus', 'tap fast', 'focus good', 'nice rhythm'];
  }

  return {
    onSpawn(kind, meta){ /* optional hook */ },
    onHit(kind, meta){
      // kind: good/junk/bonus/shield/boss
      shots += 1;
      hits  += 1;
      if(kind === 'junk' && !meta?.blocked) junkHits += 1;
      if(kind === 'good' || kind === 'bonus' || kind === 'boss') combo = clamp(combo+1, 0, 999);
      if(kind === 'shield') shield = clamp(shield+1, 0, 99);
    },
    onExpire(kind){
      if(kind === 'good') goodExpired += 1;
      // shots doesn't change here
      combo = 0;
    },
    onTick(dt, state){
      // allow game to feed accurate counters
      try{
        goodExpired = Number(state?.missGoodExpired ?? goodExpired) || goodExpired;
        junkHits    = Number(state?.missJunkHit ?? junkHits) || junkHits;
        shield      = Number(state?.shield ?? shield) || shield;
        combo       = Number(state?.combo ?? combo) || combo;
        shots       = Number(state?.shots ?? shots) || shots;
        hits        = Number(state?.hits  ?? hits)  || hits;
      }catch(_){}

      const risk = scoreRisk();
      lastPred = { hazardRisk: risk, next5: nextHint(risk) };
      return lastPred;
    },
    onEnd(summary){
      // could return explanation payload
      return {
        model: 'heuristic-v1',
        pid, seed,
        note: 'prediction-only (no difficulty adaptation)',
        finalRisk: lastPred?.hazardRisk ?? null
      };
    },
    getPrediction(){
      return lastPred;
    }
  };
}