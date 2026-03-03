// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (Prediction-only) — PRODUCTION
// PATCH v20260303-AI-PRED-RSAFE
// ✅ onSpawn/onHit/onExpire/onTick/onEnd/getPrediction
// ✅ hazardRisk 0..1 + next5 watchout
// ✅ ML/DL hook stub (optional) — default OFF

'use strict';

function clamp(v,a,b){ v=+v; if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

export function createGoodJunkAI(opts){
  opts = opts || {};
  const seed = String(opts.seed || '');
  const pid  = String(opts.pid  || 'anon');
  const diff = String(opts.diff || 'normal');
  const view = String(opts.view || 'mobile');

  // rolling stats
  let tSec = 0;
  let spawnGood=0, spawnJunk=0, spawnBonus=0, spawnShield=0, spawnBoss=0;
  let hitGood=0, hitJunk=0, hitBonus=0, hitShield=0, hitBoss=0;
  let expireGood=0, expireJunk=0;

  // last events for hints
  const lastKinds = [];

  // optional ML/DL hook (OFF by default)
  // plug: window.__HHA_AI_PREDICT__(features) => { hazardRisk, next5 }
  const useExternal = (typeof window !== 'undefined') && (typeof window.__HHA_AI_PREDICT__ === 'function');

  function pushKind(k){
    lastKinds.unshift(String(k||''));
    if(lastKinds.length>10) lastKinds.length=10;
  }

  function buildFeatures(extra){
    extra = extra || {};
    const totalSpawn = Math.max(1, spawnGood+spawnJunk+spawnBonus+spawnShield+spawnBoss);
    const junkRate = spawnJunk / totalSpawn;

    const missGoodExpired = +extra.missGoodExpired || 0;
    const missJunkHit = +extra.missJunkHit || 0;
    const shots = +extra.shots || 0;
    const hits  = +extra.hits  || 0;

    const acc = shots>0 ? hits/shots : 1;

    return {
      seed, pid, diff, view,
      tSec,
      spawnGood, spawnJunk, spawnBonus, spawnShield, spawnBoss,
      hitGood, hitJunk, hitBonus, hitShield, hitBoss,
      expireGood, expireJunk,
      junkRate,
      missGoodExpired, missJunkHit,
      acc,
      shield: +extra.shield || 0,
      fever: +extra.fever || 0,
      combo: +extra.combo || 0,
      lastKinds: lastKinds.slice(0,5)
    };
  }

  function heuristicPredict(features){
    // risk: combines junk density + recent mistakes
    const junkRate = clamp(features.junkRate, 0, 1);
    const missPressure = clamp((features.missJunkHit*0.10) + (features.missGoodExpired*0.06), 0, 1.2);
    const lowAcc = clamp(0.9 - features.acc, 0, 0.9);

    let hazardRisk = clamp((junkRate*0.55) + (missPressure*0.35) + (lowAcc*0.25), 0, 1);

    // next hint
    const next5 = [];
    if(hazardRisk >= 0.70) next5.push('เลี่ยงของเสียก่อน (🍔🍟🍬)');
    if(features.shield <= 0 && hazardRisk >= 0.55) next5.push('หาโล่ 🛡️ ไว้กันพลาด');
    if(features.missGoodExpired >= 2) next5.push('รีบเก็บของดี อย่าปล่อยหาย');
    if(features.combo < 3 && hazardRisk < 0.55) next5.push('ทำคอมโบ จะได้คะแนนพุ่ง');
    if(next5.length===0) next5.push('จังหวะดีมาก รักษาโฟกัส');

    return { hazardRisk, next5 };
  }

  let lastPred = { hazardRisk: 0, next5: ['—'] };

  return {
    onSpawn(kind){
      kind = String(kind||'');
      pushKind(kind);
      if(kind==='good') spawnGood++;
      else if(kind==='junk') spawnJunk++;
      else if(kind==='bonus') spawnBonus++;
      else if(kind==='shield') spawnShield++;
      else if(kind==='boss') spawnBoss++;
    },
    onHit(kind, meta){
      kind = String(kind||'');
      pushKind(kind);
      // if blocked junk, still count hit but not mistake (game already handles)
      if(kind==='good') hitGood++;
      else if(kind==='junk') hitJunk++;
      else if(kind==='bonus') hitBonus++;
      else if(kind==='shield') hitShield++;
      else if(kind==='boss') hitBoss++;
    },
    onExpire(kind){
      kind = String(kind||'');
      if(kind==='good') expireGood++;
      else if(kind==='junk') expireJunk++;
    },
    onTick(dt, extra){
      tSec += (+dt||0);
      const f = buildFeatures(extra);

      try{
        if(useExternal){
          const out = window.__HHA_AI_PREDICT__(f);
          if(out && typeof out === 'object'){
            lastPred = {
              hazardRisk: clamp(out.hazardRisk, 0, 1),
              next5: Array.isArray(out.next5) ? out.next5.slice(0,5) : ['—']
            };
            return lastPred;
          }
        }
      }catch(e){ /* ignore */ }

      lastPred = heuristicPredict(f);
      return lastPred;
    },
    onEnd(summary){
      // attach explainable features snapshot (lightweight)
      const f = buildFeatures({
        missGoodExpired: summary?.missGoodExpired||0,
        missJunkHit: summary?.missJunkHit||0,
        shots: summary?.shots||0,
        hits: summary?.hits||0,
        shield: summary?.shieldEnd||0,
        fever: 0,
        combo: 0
      });
      return { pred: lastPred, features: f };
    },
    getPrediction(){ return lastPred; }
  };
}