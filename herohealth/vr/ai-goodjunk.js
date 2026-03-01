// === /herohealth/vr/ai-goodjunk.js ===
// GoodJunk AI — Prediction only (NO adaptive difficulty)
// Uses /vr/goodjunk-model.js if present
// FULL v20260301-AI-PREDICT-ONLY
'use strict';

import { predictProba, MODEL_META } from './goodjunk-model.js';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

export function createGoodJunkAI(cfg){
  cfg = cfg || {};
  const seed = String(cfg.seed||'0');
  const pid  = String(cfg.pid||'anon');
  const diff = String(cfg.diff||'normal');
  const view = String(cfg.view||'mobile');

  const state = {
    lastPred: { hazardRisk: 0.0, miss3s: 0.0, ts: 0 },
    stats: {
      spawns: { good:0, junk:0, bonus:0, shield:0, boss:0 },
      hits:   { good:0, junk:0, bonus:0, shield:0, boss:0 },
      expires:{ good:0, junk:0, bonus:0, shield:0, boss:0 }
    }
  };

  function safeNum(x, d=0){
    x = Number(x);
    return Number.isFinite(x) ? x : d;
  }

  function buildFeatureVector(s){
    // Must match MODEL_META.featureOrder
    // {miss, accPct, combo, fever, shield, missGoodExpired, missJunkHit, medianRtGoodMs, dMiss, accRecent}
    const miss = safeNum(s.missTotal ?? s.miss ?? 0, 0);
    const dMiss = safeNum(s.dMiss ?? 0, 0);

    const accPct = safeNum(s.accPct ?? 0, 0);
    const accRecent = (s.accRecent==null) ? null : clamp(s.accRecent, 0, 1);

    const combo = safeNum(s.combo ?? 0, 0);
    const feverPct = safeNum(s.fever ?? s.feverPct ?? 0, 0);
    const shield = safeNum(s.shield ?? 0, 0);

    const missGoodExpired = safeNum(s.missGoodExpired ?? 0, 0);
    const missJunkHit = safeNum(s.missJunkHit ?? 0, 0);

    const medianRtGoodMs = safeNum(s.medianRtGoodMs ?? 0, 0);

    // Replace null accRecent with neutral 0.5
    const ar = (accRecent==null) ? 0.5 : accRecent;

    return [
      miss,
      dMiss,
      accPct,
      ar,
      combo,
      feverPct,
      shield,
      missGoodExpired,
      missJunkHit,
      medianRtGoodMs
    ];
  }

  function heuristic(s){
    // lightweight heuristic if model fails
    const missGoodExpired = safeNum(s.missGoodExpired ?? 0, 0);
    const missJunkHit = safeNum(s.missJunkHit ?? 0, 0);
    const combo = safeNum(s.combo ?? 0, 0);
    const shield = safeNum(s.shield ?? 0, 0);
    const fever = safeNum(s.fever ?? 0, 0);

    let risk = 0.12;
    risk += Math.min(0.40, missGoodExpired * 0.03);
    risk += Math.min(0.55, missJunkHit * 0.05);
    risk += (combo >= 5 ? -0.06 : 0.0);
    risk += (shield > 0 ? -0.04 : 0.04);
    risk += (fever >= 80 ? -0.03 : 0.0);

    risk = clamp(risk, 0.02, 0.95);
    const miss3s = clamp(risk * 0.55, 0.01, 0.90);
    return { hazardRisk: risk, miss3s };
  }

  function makeWatchout(pred){
    // next5[0] = the hint shown in HUD in goodjunk.safe.js
    // keep it short, explainable
    const r = pred?.hazardRisk ?? 0;
    const m = pred?.miss3s ?? 0;
    if(r >= 0.75) return ['ระวัง! ของเสียจะโผล่ถี่', 'โฟกัสของดีก่อน', 'อย่ายิงมั่ว', 'เลี่ยง 🍔🍟', 'รักษาโล่'];
    if(r >= 0.55) return ['ตั้งสติ ลดพลาด', 'เน้น GOOD ใกล้กลาง', 'อย่าเสี่ยงโซนขอบ', 'เก็บโล่ถ้าเห็น', 'เลี่ยงของเสีย'];
    if(m >= 0.35) return ['มีโอกาสพลาด 3 วิ', 'ช้าคือ MISS', 'ยิงให้ชัวร์', 'คุมคอมโบ', 'อย่าตามของเสีย'];
    return ['จังหวะดี ไปต่อ!', 'คุมคอมโบ', 'เล็งกลาง', 'เก็บโบนัสได้', 'คุมเวลา'];
  }

  function predict(s){
    const x = buildFeatureVector(s);
    let pred = null;

    // try model
    try{
      const p = predictProba(x);
      pred = {
        hazardRisk: clamp(p.hazardRisk, 0, 1),
        miss3s: clamp(p.miss3s, 0, 1)
      };
    }catch(e){
      pred = heuristic(s);
    }

    const next5 = makeWatchout(pred);
    return { ...pred, next5 };
  }

  return {
    onSpawn(kind /*, meta*/){
      try{
        if(state.stats.spawns[kind] != null) state.stats.spawns[kind]++;
      }catch(e){}
      return null;
    },
    onHit(kind, meta){
      try{
        if(state.stats.hits[kind] != null) state.stats.hits[kind]++;
      }catch(e){}
      return null;
    },
    onExpire(kind /*, meta*/){
      try{
        if(state.stats.expires[kind] != null) state.stats.expires[kind]++;
      }catch(e){}
      return null;
    },
    onTick(dt, s){
      // s is passed from goodjunk.safe.js
      // we compute prediction, but do NOT change game difficulty
      const pred = predict(s || {});
      state.lastPred = { hazardRisk: pred.hazardRisk, miss3s: pred.miss3s, ts: nowMs(), next5: pred.next5 };
      return { hazardRisk: pred.hazardRisk, miss3s: pred.miss3s, next5: pred.next5 };
    },
    getPrediction(){
      return state.lastPred;
    },
    onEnd(summary){
      // attach explainable end info (still prediction-only)
      return {
        aiVersion: 'v20260301-predict-only',
        model: MODEL_META?.version || 'unknown',
        seed, pid, diff, view,
        stats: state.stats,
        lastPred: state.lastPred,
        note: 'prediction-only (no adaptive)'
      };
    }
  };
}
