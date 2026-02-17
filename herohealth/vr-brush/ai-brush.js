// === /herohealth/vr-brush/ai-brush.js ===
// BrushVR AI — Prediction + Coach (Seeded/Fair/Explainable) v20260217a
// Provides: window.HHA.createAIHooks({seed, diff, mode})
// Hooks:
//  - tick({score, miss, combo, accuracy, clean, tLeft})
//  - onEvent({type, ...})
//  - getDifficulty() -> { spawnMul, ttlMul, perfectMul, bossMul, intensity }
//  - getTip() -> { type, sub, mini }
// Emits to UI: window.dispatchEvent('brush:ai', {detail:{type,...}}) (optional by caller)

(function(){
  'use strict';
  const WIN = window;

  if(!WIN.HHA) WIN.HHA = {};

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function emitAI(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail: Object.assign({type}, detail||{}) })); }catch{}
  }

  WIN.HHA.createAIHooks = function createAIHooks(cfg){
    const seed = cfg?.seed ?? Date.now();
    const mode = String(cfg?.mode || 'play'); // play/research
    const baseDiff = String(cfg?.diff || 'normal');

    const rng = seededRng(seed);

    const st = {
      lastTipAt: 0,
      tipCooldownMs: 2600,
      emaAcc: 0.78,
      emaMissRate: 0.10,
      emaPace: 0.55,
      intensity: 0.20,
      fairnessCap: 0.45, // ไม่โหดเกิน
      last: { miss:0, score:0, clean:0, tLeft:999, combo:0, shots:0, hits:0 }
    };

    function updateEMA(prev, x, a){ return prev*(1-a) + x*a; }

    function diffBase(){
      if(baseDiff==='easy') return {spawnMul:0.92, ttlMul:1.10, perfectMul:1.15, bossMul:0.90};
      if(baseDiff==='hard') return {spawnMul:1.10, ttlMul:0.92, perfectMul:0.92, bossMul:1.12};
      return {spawnMul:1.00, ttlMul:1.00, perfectMul:1.00, bossMul:1.00};
    }

    const BASE = diffBase();

    function tick(snap){
      // snap: {accuracy, miss, score, combo, clean, tLeft, shots, hits}
      const acc = clamp(Number(snap?.accuracy ?? 0.78), 0, 1);
      const miss = Number(snap?.miss ?? 0);
      const pace = clamp(Number(snap?.pace ?? 0.55), 0, 1); // (optional)
      const clean = clamp(Number(snap?.clean ?? 0), 0, 100);
      const tLeft = Number(snap?.tLeft ?? 999);

      const dMiss = Math.max(0, miss - st.last.miss);
      const missRateNow = clamp(dMiss / 6, 0, 1); // normalized per few seconds

      st.emaAcc = updateEMA(st.emaAcc, acc, 0.10);
      st.emaMissRate = updateEMA(st.emaMissRate, missRateNow, 0.14);
      st.emaPace = updateEMA(st.emaPace, pace, 0.08);

      // intensity aims: higher when player stable, lower when miss spikes
      const stability = clamp(st.emaAcc * (1 - st.emaMissRate), 0, 1);
      const want = 0.18 + stability*0.55 + (clean/100)*0.15;

      // fairness: if miss spikes, reduce
      const penalty = st.emaMissRate*0.55;
      st.intensity = clamp(updateEMA(st.intensity, want - penalty, 0.10), 0.05, st.fairnessCap);

      // timing tips (rare)
      if(mode==='play'){
        if(tLeft <= 10 && st.last.tLeft > 10){
          emitAI('time_10s', { sub:'อีก 10 วิ!', mini:'เร่งแบบแม่น ๆ รักษาคอมโบ' });
        }
      }

      st.last.miss = miss;
      st.last.clean = clean;
      st.last.tLeft = tLeft;
    }

    function getDifficulty(){
      // convert intensity -> multipliers
      const I = st.intensity; // 0..0.45
      const spawnMul = clamp(BASE.spawnMul * (1 + I*0.55), 0.85, 1.28);
      const ttlMul   = clamp(BASE.ttlMul   * (1 - I*0.22), 0.78, 1.15);
      const bossMul  = clamp(BASE.bossMul  * (1 + I*0.30), 0.88, 1.25);
      const perfectMul = clamp(BASE.perfectMul * (1 - I*0.10), 0.85, 1.25);

      return { spawnMul, ttlMul, bossMul, perfectMul, intensity: I };
    }

    function maybeTip(){
      const t = Date.now();
      if(t - st.lastTipAt < st.tipCooldownMs) return null;
      st.lastTipAt = t;

      const roll = rng();
      if(st.emaMissRate > 0.25) return { type:'coach', sub:'ช้าแต่แม่น', mini:'เล็งให้ชัดก่อนแตะ/ยิง' };
      if(st.emaAcc < 0.60) return { type:'coach', sub:'อย่ารัว', mini:'กดทีละจังหวะ จะได้คอมโบ' };
      if(roll < 0.30) return { type:'coach', sub:'Perfect ล่าโบนัส', mini:'ใกล้หมดเวลาแล้วค่อยแตะ = Perfect!' };
      if(roll < 0.58) return { type:'coach', sub:'คุมคอมโบ', mini:'พลาดทีเดียวคอมโบหาย—โฟกัส!' };
      return null;
    }

    function onEvent(ev){
      const type = String(ev?.type || '').toLowerCase();

      // hazard/boss events -> forward to HUD
      if(type==='boss_start') emitAI('boss_start', {});
      if(type==='boss_phase') emitAI('boss_phase', { phase: ev.phase, hp: ev.hp, hpMax: ev.hpMax });
      if(type==='laser_warn') emitAI('laser_warn', {});
      if(type==='laser_on') emitAI('laser_on', {});
      if(type==='shock_on') emitAI('shock_on', {});
      if(type==='shock_pulse') emitAI('shock_pulse', { idx: ev.idx });
      if(type==='finisher_on') emitAI('finisher_on', { need: ev.need });

      // occasional coach tip
      if(type==='miss' || type==='whiff' || type==='timeout'){
        const tip = maybeTip();
        if(tip) emitAI('coach', tip);
      }
    }

    function getTip(){
      return maybeTip();
    }

    return { tick, onEvent, getDifficulty, getTip };
  };

})();