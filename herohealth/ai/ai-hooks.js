// === /herohealth/ai/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (OFF by default)
// ✅ Difficulty Director (predict -> adjust)
// ✅ Coach micro-tips (explainable, rate-limited)
// ✅ Pattern Generator (storm/boss/waves) deterministic by seed
// Usage:
//   const AI = window.HHA?.createAIHooks?.({game:'hydration', seed, mode:'play', enabled:false});
//   AI.getDifficulty(state) -> {spawnMul, ttlMul, sizeMul, pBadAdd, driftMul, lockPx}
//   AI.getTip(state, recentEvents) -> {msg, reason}
//   AI.getPattern(seed, phase) -> {waveId, params}

(function(){
  'use strict';
  const WIN = window;
  WIN.HHA = WIN.HHA || {};

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const clamp01 = (v)=>clamp(v,0,1);

  function makeRNG(seed){
    let x = (Number(seed)||Date.now())>>>0;
    return ()=> (x = (1664525*x + 1013904223)>>>0) / 4294967296;
  }

  // very light predictor (heuristic now; ML/DL can replace later)
  function predictSkill(state){
    const acc = clamp01((state.accuracyPct||0)/100);
    const rt = clamp01(1 - clamp((state.rtMedianMs||900),200,1200)/1200);
    const combo = clamp01((state.comboMax||0)/18);
    const stability = clamp01(1 - clamp((state.missBurst||0),0,6)/6);
    return clamp01(acc*0.45 + rt*0.25 + combo*0.15 + stability*0.15);
  }

  function defaultDirector(state){
    const s = predictSkill(state);
    // fair, bounded
    const spawnMul = 0.90 + s*0.35;      // 0.90..1.25
    const ttlMul   = 1.05 - s*0.18;      // 1.05..0.87
    const sizeMul  = 1.06 - s*0.12;      // 1.06..0.94
    const driftMul = 1.00 + (1-s)*0.35;  // help weaker recover
    const pBadAdd  = (s>0.75)? 0.04 : (s<0.35)? -0.05 : 0.0;
    const lockPx   = (state.view==='mobile'||state.view==='cvr') ? (s<0.35? 34 : s>0.75? 24 : 28) : 28;

    return { spawnMul, ttlMul, sizeMul, driftMul, pBadAdd, lockPx };
  }

  function defaultCoach(state){
    // explainable micro-tips
    const z = state.zone;
    const phase = state.phase;
    if(phase==='STORM' && (state.stormHit||0) < (state.stormNeed||0)*0.5) return {msg:'STORM: เลือกยิง 💧 ที่ใกล้กลางจอก่อน จะติดง่ายขึ้น', reason:'storm_low_progress'};
    if(phase==='BOSS' && (state.combo||0)===0) return {msg:'BOSS: หยุดครึ่งจังหวะก่อนยิง จะกันพลาดได้', reason:'boss_combo_drop'};
    if(z!=='GREEN' && (state.offGreenMs||0)>1400) return {msg:'หลุด GREEN แล้ว: ยิง 💧 1–2 ครั้งติดกันเพื่อดึงกลับเร็ว', reason:'offgreen_long'};
    if((state.missBurst||0)>=3) return {msg:'พลาดรัว: ลดการยิงรัว เล็งนิ่งแล้วค่อยยิง', reason:'miss_burst'};
    return null;
  }

  function defaultPattern(seed, phase){
    const rng = makeRNG(seed ^ (phase==='BOSS'?0xB055:0x5702));
    const wave = (rng()*3)|0;
    if(phase==='STORM'){
      return { waveId:['storm_spread','storm_center','storm_snake'][wave], params:{bias:rng()} };
    }
    if(phase==='BOSS'){
      return { waveId:['boss_breath','boss_pressure','boss_mix'][wave], params:{bias:rng()} };
    }
    return { waveId:'main', params:{} };
  }

  WIN.HHA.createAIHooks = function createAIHooks(opts){
    const cfg = Object.assign({
      enabled:false,
      game:'unknown',
      seed: Date.now(),
      mode:'play', // play/research
      rateLimitMs: 2600,
    }, opts||{});

    let lastTipMs = 0;

    return {
      enabled: !!cfg.enabled,
      getDifficulty(state){
        if(!cfg.enabled) return {spawnMul:1, ttlMul:1, sizeMul:1, driftMul:1, pBadAdd:0, lockPx:28};
        return defaultDirector(state||{});
      },
      getTip(state, recentEvents){
        if(!cfg.enabled) return null;
        const t = performance?.now ? performance.now() : Date.now();
        if(t - lastTipMs < cfg.rateLimitMs) return null;
        const tip = defaultCoach(state||{});
        if(tip){ lastTipMs = t; return tip; }
        return null;
      },
      getPattern(seed, phase){
        return defaultPattern(Number(seed)||cfg.seed, String(phase||'MAIN').toUpperCase());
      },
      onEvent(_ev){ /* reserved for ML logging */ }
    };
  };
})();