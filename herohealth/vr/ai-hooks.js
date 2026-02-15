// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE STUB (PRODUCTION) — v1.0
// ✅ Never crashes if game calls it
// ✅ Play mode: allow heuristic "prediction" + explainable tips
// ✅ Study/Research: deterministic-friendly (no adaptive by default)
// Exposes:
//   window.HHA.createAIHooks({ game, runMode, diff, seed, deterministic })
//   -> { onEvent(type,payload), getDifficultySignal(ctx), getPrediction(ctx), getTip(ctx), reset() }

'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // small deterministic rng (optional, for research mode if needed)
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createAIHooks(opts){
    opts = opts || {};
    const runMode = String(opts.runMode || 'play').toLowerCase();
    const deterministic = !!opts.deterministic || (runMode === 'study' || runMode === 'research');

    const rng = deterministic ? seededRng(opts.seed || 13579) : Math.random;

    const MEM = {
      lastTipAt: 0,
      tipCooldownMs: 6500,
      lastEventAt: 0,

      // rolling buffers for prediction
      miss1s: 0,
      expire1s: 0,
      junk1s: 0,
      hitGood1s: 0,

      // simple smoothed signals
      emaAcc: 0.85,
      emaRate: 0.0,
      emaMiss: 0.0,

      // last known ctx
      ctx: null,
    };

    function onEvent(type, payload){
      MEM.lastEventAt = Date.now();
      // capture only what we need (do not store huge objects)
      if(type === 'features_1s' && payload){
        MEM.ctx = payload;

        // update EMAs (explainable)
        const acc = clamp(payload.accNowPct, 0, 100) / 100;
        const rate = clamp(payload.spawnRatePerSec, 0, 20);
        const miss = clamp(payload.missDelta1s, 0, 999);

        MEM.emaAcc = MEM.emaAcc * 0.88 + acc * 0.12;
        MEM.emaRate = MEM.emaRate * 0.85 + rate * 0.15;
        MEM.emaMiss = MEM.emaMiss * 0.85 + (miss>0?1:0) * 0.15;
      }

      // judge streams (optional)
      if(type === 'judge' && payload){
        const k = String(payload.kind||'');
        if(k === 'junk') MEM.junk1s++;
        else if(k === 'expire_good') MEM.expire1s++;
        else if(k === 'good') MEM.hitGood1s++;
      }
    }

    function getDifficultySignal(ctx){
      // For future ML: return clean numeric vector-like object
      ctx = ctx || MEM.ctx || {};
      return {
        // normalized
        acc: clamp(ctx.accNowPct,0,100)/100,
        miss: clamp(ctx.missDelta1s,0,50)/50,
        combo: clamp(ctx.comboNow,0,30)/30,
        density: clamp(ctx.targetDensity,0,1),
        imbalance: clamp(ctx.groupImbalance01,0,1),
        storm: ctx.stormActive ? 1 : 0,
        boss: ctx.bossActive ? 1 : 0
      };
    }

    function getPrediction(ctx){
      // SAFE "prediction" placeholder:
      // predicts near-future mistake risk from smoothed signals
      ctx = ctx || MEM.ctx || {};
      const acc = clamp(ctx.accNowPct,0,100);
      const miss = clamp(ctx.missDelta3s,0,99);
      const density = clamp(ctx.targetDensity,0,1);

      let risk = 0.0;
      risk += (acc < 78) ? 0.35 : 0.0;
      risk += (miss >= 2) ? 0.35 : 0.0;
      risk += (density > 0.55) ? 0.20 : 0.0;
      if(ctx.stormActive) risk += 0.12;
      if(ctx.bossActive)  risk += 0.10;

      risk = clamp(risk, 0, 1);

      // explainable reasons
      const reasons = [];
      if(acc < 78) reasons.push('acc_low');
      if(miss >= 2) reasons.push('miss_spike');
      if(density > 0.55) reasons.push('density_high');
      if(ctx.stormActive) reasons.push('storm');
      if(ctx.bossActive) reasons.push('boss');

      return { risk, reasons };
    }

    function getTip(ctx){
      // Rate-limited, explainable coach tips (Play only by default)
      if(deterministic) return null; // keep research clean by default
      ctx = ctx || MEM.ctx || {};
      const t = Date.now();
      if(t - MEM.lastTipAt < MEM.tipCooldownMs) return null;

      const p = getPrediction(ctx);
      if(p.risk < 0.55) return null;

      MEM.lastTipAt = t;

      // convert reasons to a friendly tip
      if(p.reasons.includes('acc_low')){
        return { key:'acc_low', mood:'neutral', msg:'ลองช้าลงนิดนึง “จิ้มให้ชัวร์” ก่อน แล้วค่อยเร่งคอมโบ 💪' };
      }
      if(p.reasons.includes('density_high')){
        return { key:'density_high', mood:'neutral', msg:'ตอนนี้เป้าแน่น—โฟกัส “ของดีที่ใกล้หมดเวลา” ก่อนนะ 👀' };
      }
      if(p.reasons.includes('storm')){
        return { key:'storm', mood:'fever', msg:'STORM มาแล้ว! รักษาจังหวะ ยิงให้แม่น และเลี่ยงขยะ ⚡' };
      }
      if(p.reasons.includes('boss')){
        return { key:'boss', mood:'neutral', msg:'บอสห้ามโดนขยะ! เล็งก่อนยิงทุกครั้ง 🎯' };
      }
      return { key:'risk', mood:'neutral', msg:'เริ่มเสี่ยงพลาด—พักจังหวะครึ่งวิ แล้วกลับมาลุยต่อ!' };
    }

    function reset(){
      MEM.lastTipAt = 0;
      MEM.miss1s = MEM.expire1s = MEM.junk1s = MEM.hitGood1s = 0;
      MEM.emaAcc = 0.85;
      MEM.emaRate = 0.0;
      MEM.emaMiss = 0.0;
      MEM.ctx = null;
    }

    return { onEvent, getDifficultySignal, getPrediction, getTip, reset, deterministic };
  }

  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = createAIHooks;
})();
