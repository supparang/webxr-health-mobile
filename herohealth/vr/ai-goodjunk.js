// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI Prediction — SAFE (NO adaptive difficulty)
// PATCH v20260304-AI-PRED
// Outputs: { hazardRisk: 0..1, next5: [string...] }

'use strict';

function clamp01(x){
  x = Number(x);
  if(!Number.isFinite(x)) x = 0;
  return x < 0 ? 0 : (x > 1 ? 1 : x);
}

function ema(prev, x, a){
  if(!Number.isFinite(prev)) return x;
  return prev + a*(x - prev);
}

export function createGoodJunkAI(opts = {}){
  const seed = String(opts.seed ?? '');
  const pid  = String(opts.pid ?? '');
  const diff = String(opts.diff ?? 'normal');
  const view = String(opts.view ?? 'mobile');

  // internal state (prediction only)
  let t = 0;
  let eMiss = 0;
  let eJunk = 0;
  let eExpire = 0;
  let eAcc = 1;
  let ePace = 0;

  // recent events
  let spawnN = 0;
  let hitN = 0;
  let expireN = 0;

  let lastPred = { hazardRisk: 0, next5: ['—'] };

  function resetWindow(){
    spawnN = 0; hitN = 0; expireN = 0;
  }

  function hintPack(risk, ctx){
    const hints = [];
    const shield = Number(ctx?.shield||0);
    const fever  = Number(ctx?.fever||0);
    const combo  = Number(ctx?.combo||0);
    const acc    = Number(ctx?.acc||100);

    if(risk > 0.70){
      hints.push('ชะลอ 0.5 วิ แล้วโฟกัส “ของดี”');
      hints.push('เห็น 🍔🍟 ให้ปล่อยผ่านก่อน');
      if(shield <= 0) hints.push('หา 🛡️ ไว้กันพลาด');
      if(combo <= 1) hints.push('คอมโบเล็กๆ ก่อน แล้วค่อยเร่ง');
    }else if(risk > 0.45){
      hints.push('เล็งให้นิ่งขึ้น แล้วค่อยยิง');
      if(acc < 75) hints.push('ยิงเมื่อ “ล็อกเป้า” จริงๆ (อย่ายิงลม)');
      if(shield <= 0) hints.push('เก็บ 🛡️ เผื่อช่วง storm/boss');
      if(fever > 70) hints.push('ใกล้ FEVER แล้ว—คุมไม่ให้พลาด');
    }else{
      hints.push('ดีมาก! รักษาจังหวะนี้');
      if(combo >= 4) hints.push('คอมโบมาแล้ว—อย่าหลงไปโดน junk');
      hints.push('เก็บ ⭐/💎 เพื่อเร่งคะแนน');
    }

    // unique + cap 5
    const out = [];
    for(const h of hints){
      if(!out.includes(h)) out.push(h);
      if(out.length>=5) break;
    }
    return out.length ? out : ['—'];
  }

  return {
    onSpawn(kind){
      spawnN++;
    },
    onHit(kind, meta){
      hitN++;
      // block counts as "good outcome" for risk
      if(kind === 'junk' && meta?.blocked) return;
      if(kind === 'junk') eJunk = ema(eJunk, 1, 0.18);
      else eJunk = ema(eJunk, 0, 0.12);
    },
    onExpire(kind){
      expireN++;
      if(kind === 'good') eExpire = ema(eExpire, 1, 0.20);
      else eExpire = ema(eExpire, 0, 0.12);
    },
    onTick(dt, ctx){
      dt = Number(dt) || 0.016;
      t += dt;

      // pace & acc (from ctx shots/hits)
      const shots = Number(ctx?.shots||0);
      const hits  = Number(ctx?.hits||0);
      const acc = (shots>0) ? (hits/shots) : 1;

      eAcc = ema(eAcc, acc, 0.10);
      ePace = ema(ePace, clamp01(shots/120), 0.05); // normalize

      // every ~1s recompute
      if(t >= 1.0){
        const miss = (Number(ctx?.missGoodExpired||0) + Number(ctx?.missJunkHit||0));
        eMiss = ema(eMiss, clamp01(miss/12), 0.10);

        // density estimate
        const density = clamp01(spawnN/18); // per sec-ish
        const expireRate = clamp01(expireN/8);
        const junkTrend = clamp01(eJunk);
        const lowShield = (Number(ctx?.shield||0) <= 0) ? 0.12 : 0;

        // diff/view tweak (prediction only)
        const diffBoost = diff==='hard' ? 0.06 : (diff==='easy' ? -0.04 : 0);
        const viewBoost = (view==='cvr' || view==='vr') ? 0.05 : 0;

        // hazard risk (0..1)
        let risk =
          0.28*clamp01(1 - eAcc) +
          0.24*eMiss +
          0.20*expireRate +
          0.18*density +
          0.10*junkTrend +
          lowShield +
          diffBoost + viewBoost;

        risk = clamp01(risk);

        lastPred = {
          hazardRisk: risk,
          next5: hintPack(risk, {
            shield: Number(ctx?.shield||0),
            fever: Number(ctx?.fever||0),
            combo: Number(ctx?.combo||0),
            acc: Math.round(eAcc*100)
          })
        };

        // reset 1s window
        t = 0;
        resetWindow();
      }

      return lastPred;
    },
    onEnd(summary){
      // attach explainable factors (for research log)
      try{
        return {
          model: 'GoodJunkAI-PRED-v20260304',
          seed, pid, diff, view,
          signals: {
            eAcc: Number(eAcc.toFixed(3)),
            eMiss: Number(eMiss.toFixed(3)),
            eExpire: Number(eExpire.toFixed(3)),
            eJunk: Number(eJunk.toFixed(3)),
            ePace: Number(ePace.toFixed(3))
          },
          note: 'Prediction only (no adaptive difficulty)'
        };
      }catch(e){
        return null;
      }
    },
    getPrediction(){
      return lastPred;
    }
  };
}