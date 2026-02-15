// === /herohealth/vr-brush/ai-brush.js ===
// HHA_AI_BRUSH plugin (Predict + Pattern + Tips) — v1
// Deterministic-ish: uses provided rng() from game when available

(function(){
  'use strict';
  const WIN = window;

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  const AI = {
    state: {
      emaAcc: 0.75,
      emaMiss: 0.10,
      emaSpeed: 0.0,
      lastShotTs: 0,
      streakPerfect: 0,
      phase: 1,
      lastTipTs: 0,
      lastPatternTs: 0,
    },

    updateFromShot({ hit, perfect, ts }){
      const s = AI.state;
      const dt = s.lastShotTs ? Math.max(40, ts - s.lastShotTs) : 220;
      s.lastShotTs = ts;

      const speed = 1000 / dt; // shots/sec proxy
      s.emaSpeed = s.emaSpeed*0.85 + speed*0.15;

      const acc = hit ? 1 : 0;
      s.emaAcc = s.emaAcc*0.92 + acc*0.08;

      const miss = hit ? 0 : 1;
      s.emaMiss = s.emaMiss*0.92 + miss*0.08;

      if(perfect) s.streakPerfect += 1;
      else s.streakPerfect = 0;
    },

    predict({ ctx, st }){
      const s = AI.state;

      const skill = clamp(
        (s.emaAcc*0.65) + (clamp(1 - s.emaMiss,0,1)*0.25) + (clamp(s.emaSpeed/4,0,1)*0.10),
        0, 1
      );

      const prog = clamp((st.clean||0)/100, 0, 1);

      let phase = 1
        + (prog > 0.33 ? 1 : 0)
        + (prog > 0.68 ? 1 : 0)
        + (skill > 0.83 ? 1 : 0);

      phase = clamp(phase, 1, 4);
      s.phase = phase;

      return {
        skill,
        phase,
        // difficulty knobs
        spawnMul: 1 + (phase-1)*0.10 + (skill-0.5)*0.18,
        ttlMul:   1 - (phase-1)*0.06 - (skill-0.5)*0.10,
        bossHpAdd: (phase>=3 ? 1 : 0) + (skill>0.86 ? 1 : 0),

        enableStopWindow: phase>=2,
        enableWeakSpot: phase>=3,
        enablePatterns:  phase>=2
      };
    },

    // Pattern Generator: returns an "event" instruction occasionally
    // The game will translate this into spawns/motions/stop/weakspot.
    getNextPattern({ ctx, st, rng }){
      const s = AI.state;
      const t = Date.now();
      if(t - s.lastPatternTs < 1400) return null; // anti spam
      s.lastPatternTs = t;

      const pred = AI.predict({ ctx, st });
      if(!pred.enablePatterns) return null;

      const R = (typeof rng === 'function') ? rng : Math.random;

      // choose pattern by phase + context
      const phase = pred.phase;
      const boss = !!st.bossActive;
      const combo = st.combo || 0;

      // weights
      let wSpiral = 0.30;  // targets appear around center progressively
      let wSweep  = 0.28;  // left->right sweep
      let wBurst  = 0.22;  // short burst (more spawns quickly)
      let wStop   = pred.enableStopWindow ? 0.20 : 0.00;

      if(boss){ wStop += 0.08; wBurst += 0.06; wSpiral -= 0.06; }
      if(combo >= 10){ wStop += 0.10; wSweep += 0.06; wBurst -= 0.06; }
      if(phase>=4){ wBurst += 0.10; wSweep += 0.06; wSpiral -= 0.08; }

      const sum = wSpiral+wSweep+wBurst+wStop;
      wSpiral/=sum; wSweep/=sum; wBurst/=sum; wStop/=sum;

      const r = R();
      if(r < wSpiral) return { type:'pattern_spiral', ms: 1500, phase };
      if(r < wSpiral+wSweep) return { type:'pattern_sweep', ms: 1400, phase };
      if(r < wSpiral+wSweep+wBurst) return { type:'pattern_burst', ms: 900, phase };
      return { type:'stop_window', ms: (ctx.diff==='hard'? 900:780), phase };
    },

    // Coach tip (rate limited)
    getTip({ ctx, st }){
      const s = AI.state;
      const t = Date.now();
      if(t - s.lastTipTs < 2400) return null;
      s.lastTipTs = t;

      if(s.emaAcc < 0.62) return { emo:'🎯', title:'เล็งก่อนยิง', sub:'ช้าลงนิดแต่ให้โดน', mini:'โฟกัส “เป้ากลางวง”', tag:'TIP', ms:1600 };
      if(st.combo >= 8) return { emo:'🔥', title:'คอมโบติดแล้ว!', sub:'รักษาจังหวะ', mini:'ใกล้หมดเวลา = PERFECT ✨', tag:'HYPE', ms:1400 };
      if(st.bossActive) return { emo:'💎', title:'บอสคราบหนา', sub:'ตีหลายครั้งให้แตก', mini:'รอ Weak Spot ช่วงสั้น ๆ 🎯', tag:'BOSS', ms:1700 };
      return { emo:'🪥', title:'ล่า PERFECT', sub:'ใกล้หมดเวลาแล้วค่อยยิง', mini:'ได้โบนัส + เติม FEVER', tag:'PERF', ms:1600 };
    },

    onEvent(_ev){
      // placeholder for future training / telemetry
      // console.log('[AI_BRUSH]', _ev);
    }
  };

  WIN.HHA_AI_BRUSH = AI;
})();