// === /herohealth/vr/ai-predictor.js ===
// AI Predictor (ML-lite) — explainable + safe
// ✅ Online logistic-like predictor (tiny ML) for "risk of miss soon" in play mode
// ✅ No network, no heavy deps, deterministic optional
// ✅ Built-in rate-limited micro-tips
// ✅ Designed so later you can swap to Deep Learning (TF.js) without touching game logic
//
// Usage:
//   import { createPredictor } from '../vr/ai-predictor.js';
//   const P = createPredictor({ enabled:true, seed:'123' });
//   const risk = P.predictRisk({ rtAvg, miss, combo, fever, onScreen, diff });
//   P.observe({ event:'hit_good'|'hit_junk'|'expire_good'|'block_junk'|'pickup_star'|'pickup_shield', rtMs, missDelta });
//   const tip = P.maybeTip({ risk, feats });

'use strict';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const nowMs = ()=> (performance?.now?.() ?? Date.now());

function sigmoid(x){
  // stable-ish sigmoid
  if(x < -20) return 0;
  if(x > 20) return 1;
  return 1 / (1 + Math.exp(-x));
}

export function createPredictor(opts={}){
  const enabled = !!opts.enabled;

  // weights: small feature set (hand-started), then online nudged
  // Features:
  //  x0=1 (bias)
  //  x1=rtAvg/900
  //  x2=miss/10
  //  x3=fever/100
  //  x4=onScreen/10
  //  x5=combo/15 (negative effect)
  const W = {
    b:  -0.25,
    rt:  1.10,
    miss:1.05,
    fever:0.65,
    scr: 0.55,
    combo:-0.70
  };

  let lastTipAt = 0;
  let lastLearnAt = 0;

  // online learning rate (gentle)
  const LR = 0.035;

  function featurize(feats){
    const rtAvg = clamp(Number(feats?.rtAvg)||0, 0, 2500);
    const miss  = clamp(Number(feats?.miss)||0, 0, 999);
    const fever = clamp(Number(feats?.fever)||0, 0, 100);
    const scr   = clamp(Number(feats?.onScreen)||0, 0, 30);
    const combo = clamp(Number(feats?.combo)||0, 0, 99);

    const x = {
      x0: 1,
      x1: rtAvg / 900,
      x2: miss / 10,
      x3: fever / 100,
      x4: scr / 10,
      x5: combo / 15
    };
    return x;
  }

  function score(feats){
    const x = featurize(feats);
    const z =
      W.b +
      W.rt   * x.x1 +
      W.miss * x.x2 +
      W.fever* x.x3 +
      W.scr  * x.x4 +
      W.combo* x.x5;
    return sigmoid(z);
  }

  function learn(feats, y){
    // y: 1 = "bad happened" (miss increased), 0 = ok
    if(!enabled) return;
    const t = nowMs();
    // rate-limit learning to avoid jitter
    if(t - lastLearnAt < 220) return;
    lastLearnAt = t;

    const x = featurize(feats);
    const p = score(feats);
    const err = (p - y);

    // gradient descent
    W.b     -= LR * err * x.x0;
    W.rt    -= LR * err * x.x1;
    W.miss  -= LR * err * x.x2;
    W.fever -= LR * err * x.x3;
    W.scr   -= LR * err * x.x4;
    W.combo -= LR * err * x.x5;

    // clamp weights to keep stable
    W.b     = clamp(W.b,     -2.0,  2.0);
    W.rt    = clamp(W.rt,    -0.3,  2.2);
    W.miss  = clamp(W.miss,  -0.2,  2.4);
    W.fever = clamp(W.fever, -0.2,  2.0);
    W.scr   = clamp(W.scr,   -0.2,  1.6);
    W.combo = clamp(W.combo, -2.0,  0.2);
  }

  // internal snapshot to learn from events
  let lastFeats = null;

  function predictRisk(feats){
    lastFeats = Object.assign({}, feats);
    return enabled ? score(feats) : 0.0;
  }

  function observe(ev){
    if(!enabled) return;
    const missDelta = Number(ev?.missDelta || 0);

    // learn from outcome: miss increased => y=1
    if(lastFeats){
      if(missDelta > 0) learn(lastFeats, 1);
      else learn(lastFeats, 0);
    }
  }

  function maybeTip({ risk, feats }){
    if(!enabled) return null;

    const t = nowMs();
    if(t - lastTipAt < 5200) return null; // rate-limit tips
    if(risk < 0.62) return null;          // only when risk high-ish

    lastTipAt = t;

    const rtAvg = Number(feats?.rtAvg||0);
    const fever = Number(feats?.fever||0);
    const onScreen = Number(feats?.onScreen||0);
    const combo = Number(feats?.combo||0);

    // explainable micro-tips (no BS)
    if(rtAvg > 900) return 'ลอง “เล็งกลางจอ” แล้วค่อยยิง/แตะ จะทันขึ้น 👀';
    if(onScreen >= 7) return 'อย่าไล่ทุกอัน! โฟกัส “ของดี” ที่ใกล้มือก่อน ✅';
    if(fever >= 70) return 'FEVER สูงแล้ว! ช้า ๆ แต่ชัวร์ เลี่ยงของทอด/หวาน 🍟🚫';
    if(combo === 0) return 'ทำคอมโบให้ติดสัก 3–4 ครั้ง คะแนนจะพุ่งเอง ⚡';
    return 'โฟกัสของดี + เลี่ยงของเสีย จะผ่าน GOAL ได้ไวขึ้น ✅';
  }

  return {
    enabled,
    predictRisk,
    observe,
    maybeTip,
    _debugWeights: ()=>Object.assign({}, W) // optional
  };
}