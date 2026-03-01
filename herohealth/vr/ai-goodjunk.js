// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI (prediction-only). If window.HHA_GJ_MODEL exists => uses ML.
// Otherwise uses heuristic baseline.
'use strict';

function clamp(v,a,b){ v=+v||0; return v<a?a:(v>b?b:v); }

function sigmoid(x){ x = +x || 0; if(x < -30) return 0; if(x > 30) return 1; return 1/(1+Math.exp(-x)); }

function featurize(state){
  // state = from onTick(dt, snapshot)
  const tLeft = +state.tLeft || 0;
  const planned = +state.plannedSec || 80;
  const timePressure = planned>0 ? clamp(1 - (tLeft/planned), 0, 1) : 0;

  const miss = +state.miss || 0;
  const missG = +state.missGoodExpired || 0;
  const missJ = +state.missJunkHit || 0;
  const combo = +state.combo || 0;
  const fever = clamp(+state.fever || 0, 0, 100) / 100;
  const shield = clamp(+state.shield || 0, 0, 9) / 9;

  const acc = clamp((+state.accPct || 0)/100, 0, 1);
  const targetsN = clamp((+state.targetsN || 0)/18, 0, 1);

  const storm = state.stormOn ? 1 : 0;
  const rage = state.rageOn ? 1 : 0;
  const boss = state.bossActive ? 1 : 0;
  const bossPhase = clamp((+state.bossPhase || 0), 0, 2) / 2;

  // Fixed-length vector
  return [
    1,                 // bias
    timePressure,
    miss/20,
    missG/20,
    missJ/20,
    clamp(combo/12,0,1),
    fever,
    shield,
    acc,
    targetsN,
    storm,
    rage,
    boss,
    bossPhase
  ];
}

function heuristicPredict(vec){
  // vec indices: [bias,tp,miss,missG,missJ,combo,fever,shield,acc,targets,storm,rage,boss,bossPhase]
  const tp = vec[1], miss = vec[2], missG = vec[3], missJ = vec[4], combo = vec[5], fever = vec[6], shield = vec[7], acc = vec[8], storm = vec[10], boss = vec[12];
  // simple risk score
  let x = 0;
  x += 2.2*tp;
  x += 2.0*storm;
  x += 1.5*boss;
  x += 2.4*missJ;
  x += 1.6*missG;
  x += -1.3*combo;
  x += -1.1*fever;
  x += -1.0*shield;
  x += -1.2*acc;
  return sigmoid(x);
}

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  let lastPred = { hazardRisk: 0.20, next5: ['focus GOOD', 'avoid JUNK', 'get SHIELD'] };
  let lastVec = null;

  const api = {
    onSpawn(kind, info){ /* optional */ },
    onHit(kind, info){ /* optional */ },
    onExpire(kind, info){ /* optional */ },

    onTick(dt, snapshot){
      try{
        const vec = featurize(snapshot || {});
        lastVec = vec;

        const model = (typeof window !== 'undefined') ? window.HHA_GJ_MODEL : null;
        let risk = 0.2;

        if(model && typeof model.predictProba === 'function'){
          risk = clamp(model.predictProba(vec), 0, 1);
        }else{
          risk = heuristicPredict(vec);
        }

        let hint = 'focus GOOD + keep combo';
        if(risk >= 0.70) hint = 'HIGH RISK: get 🛡️ + slow down';
        else if(risk >= 0.55) hint = 'watch JUNK + take safe shots';
        else if(risk <= 0.30) hint = 'push combo + grab ⭐';

        lastPred = { hazardRisk: +risk.toFixed(3), next5: [hint] };
        return lastPred;
      }catch(e){
        return lastPred;
      }
    },

    onEnd(summary){
      return {
        model: (window.HHA_GJ_MODEL ? 'ML' : 'heuristic'),
        lastPred,
        lastVec
      };
    },

    getPrediction(){ return lastPred; }
  };

  return api;
}
