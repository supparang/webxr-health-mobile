// === /herohealth/vr/ai-hooks.js ===
// HeroHealth AI Hooks — SAFE (No-crash) — v20260215a
// Provides: window.HHA.createAIHooks(opts)
// Goals:
// - Never crash games if AI is missing or errors
// - Deterministic OFF by default in study/research
// - Play mode can give simple, explainable tips (heuristic) with rate-limit
//
// Supported calls from games:
//   ai.reset()
//   ai.onEvent(type, payload)
//   ai.getTip(features) -> {msg, mood, code, confidence} | null
//   ai.getPrediction(features) -> {y_miss_next3s?, y_grade?, ...} | null
//   ai.getDifficultySignal(features) -> {spawnRateDeltaMs?, wGood?, ...} | null

(function(){
  'use strict';

  const ROOT = window;

  // Ensure namespace
  if(!ROOT.HHA) ROOT.HHA = {};

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // Lightweight rolling buffer
  function ring(n){
    const a = [];
    return {
      push(x){ a.push(x); while(a.length>n) a.shift(); },
      get(){ return a.slice(); },
      last(){ return a.length ? a[a.length-1] : null; },
      clear(){ a.length=0; },
      len(){ return a.length; }
    };
  }

  // Tip throttler
  function makeTipLimiter(minMs){
    let lastAt = 0;
    return {
      ok(){
        const t = now();
        if(t - lastAt >= minMs){ lastAt = t; return true; }
        return false;
      },
      reset(){ lastAt = 0; }
    };
  }

  function safeReturnAI(deterministic){
    return {
      enabled: !deterministic,
      deterministic: !!deterministic,
      onEvent(){},
      getTip(){ return null; },
      getPrediction(){ return null; },
      getDifficultySignal(){ return null; },
      reset(){}
    };
  }

  // ---- Heuristic engine (Explainable & safe) ----
  function createHeuristicAI(opts){
    const game = String(opts?.game || 'unknown');
    const runMode = String(opts?.runMode || 'play').toLowerCase();
    const diff = String(opts?.diff || 'normal').toLowerCase();
    const deterministic = !!opts?.deterministic || (runMode === 'study' || runMode === 'research');

    // In research/study: keep AI "present" but quiet by default
    const tipsEnabled = (!deterministic) && (opts?.tipsEnabled !== false);

    const tipLimiter = makeTipLimiter(2200); // ~1 tip per 2.2s max
    const featBuf = ring(6);                 // last ~6 seconds
    const judgeBuf = ring(16);               // last actions

    // simple state
    let lastGrade = null;
    let lastAcc = null;
    let lastMiss = 0;
    let lastBoss = false;
    let lastStorm = false;

    function reset(){
      featBuf.clear();
      judgeBuf.clear();
      tipLimiter.reset();
      lastGrade = null;
      lastAcc = null;
      lastMiss = 0;
      lastBoss = false;
      lastStorm = false;
    }

    function onEvent(type, payload){
      try{
        const t = String(type||'');
        if(t === 'features_1s'){
          featBuf.push(payload || {});
          lastAcc = Number(payload?.accNowPct ?? payload?.accPct ?? lastAcc);
          lastMiss = Number(payload?.missNow ?? lastMiss);
          lastBoss = !!payload?.bossActive;
          lastStorm = !!payload?.stormActive;
          lastGrade = String(payload?.grade || lastGrade || '');
        }else if(t === 'judge'){
          judgeBuf.push(payload || {});
        }else if(t === 'start'){
          reset();
        }else if(t === 'end'){
          // keep buffers; optional
        }
      }catch{
        // never crash
      }
    }

    // Predict next ~3s miss spike (very rough)
    function getPrediction(features){
      try{
        const f = features || featBuf.last() || {};
        const miss3 = Number(f.missDelta3s ?? 0);
        const dens = Number(f.targetDensityAvg3s ?? f.targetDensity ?? 0);
        const acc = Number(f.accAvg3s ?? f.accNowPct ?? 100);
        const storm = !!f.stormActive;
        const boss = !!f.bossActive;

        // heuristic score 0..1
        let risk = 0;
        risk += clamp(miss3/3, 0, 1) * 0.55;
        risk += clamp(dens, 0, 1) * 0.25;
        risk += clamp((80-acc)/30, 0, 1) * 0.20;
        if(storm || boss) risk = clamp(risk + 0.10, 0, 1);

        // Map to likely miss count next 3s (0..3)
        const y_miss_next3s = Math.round(clamp(risk*3, 0, 3));

        return {
          game,
          y_miss_next3s,
          risk01: Math.round(risk*1000)/1000,
          basis: { miss3, dens: Math.round(dens*1000)/1000, acc, storm, boss }
        };
      }catch{
        return null;
      }
    }

    // Provide gentle difficulty signals (OPTIONAL, game may ignore)
    function getDifficultySignal(features){
      try{
        const f = features || featBuf.last() || {};
        const acc = Number(f.accAvg3s ?? f.accNowPct ?? 100);
        const miss3 = Number(f.missDelta3s ?? 0);
        const storm = !!f.stormActive;
        const boss  = !!f.bossActive;

        // Default: no change
        let spawnRateDeltaMs = 0;

        // If player is crushing it (acc high, no misses) -> slightly harder (faster spawn)
        if(!storm && !boss && acc >= 88 && miss3 === 0) spawnRateDeltaMs = -60;

        // If struggling -> ease a bit
        if(acc <= 70 || miss3 >= 2) spawnRateDeltaMs = +80;

        // Keep within safe bounds; game decides
        spawnRateDeltaMs = clamp(spawnRateDeltaMs, -120, +140);

        return { game, spawnRateDeltaMs, note:'heuristic' };
      }catch{
        return null;
      }
    }

    // Explainable coaching tip
    function getTip(features){
      try{
        if(!tipsEnabled) return null;
        if(!tipLimiter.ok()) return null;

        const f = features || featBuf.last() || {};
        const acc = Number(f.accAvg3s ?? f.accNowPct ?? lastAcc ?? 100);
        const miss3 = Number(f.missDelta3s ?? 0);
        const dens = Number(f.targetDensityAvg3s ?? f.targetDensity ?? 0);
        const storm = !!f.stormActive;
        const boss  = !!f.bossActive;
        const t = Number(f.tPlayedSec ?? 0);

        // very early: only once-ish
        if(t <= 6){
          return { msg:'โฟกัส “GOOD” ก่อน แล้วค่อยเร่งคอมโบ 🔥', mood:'neutral', code:'start_focus', confidence:.65 };
        }

        if(boss){
          // boss: forbid junk often
          if(acc < 82) return { msg:'โหมดบอส: ช้าลงนิด เล็งกลางเป้า แล้วค่อยยิง ✅', mood:'neutral', code:'boss_aim', confidence:.75 };
          return { msg:'บอสมาแล้ว! เล็ง GOOD เท่านั้น ห้ามพลาดขยะ! 👹', mood:'fever', code:'boss_rule', confidence:.82 };
        }

        if(storm){
          if(miss3 >= 1) return { msg:'STORM: ลดการยิงรัว—เลือกยิงเฉพาะที่ “ชัวร์” จะผ่านง่ายขึ้น 🌪️', mood:'neutral', code:'storm_control', confidence:.78 };
          return { msg:'STORM: เร่งสปีดได้ แต่ต้องแม่น! 🔥', mood:'fever', code:'storm_push', confidence:.70 };
        }

        if(acc < 72){
          return { msg:'ความแม่นยำตก! ลอง “หยุดครึ่งวิ” ก่อนยิง จะดีขึ้น 🎯', mood:'sad', code:'acc_low', confidence:.72 };
        }

        if(miss3 >= 2){
          return { msg:'พลาดติด ๆ กัน—แนะนำเล็งเป้าที่ใกล้ crosshair ที่สุดก่อน 👍', mood:'neutral', code:'miss_spike', confidence:.70 };
        }

        if(dens >= 0.72){
          return { msg:'เป้าแน่น! เลือกยิงเป้ากลาง ๆ ก่อน จะคุมจอได้ง่าย 💡', mood:'neutral', code:'dense_field', confidence:.66 };
        }

        if(acc >= 90 && miss3 === 0){
          return { msg:'โหดมาก! ตอนนี้เร่งคอมโบได้เลย 🔥', mood:'happy', code:'great_run', confidence:.72 };
        }

        return null;
      }catch{
        return null;
      }
    }

    return {
      enabled: !deterministic,
      deterministic,
      onEvent,
      getTip,
      getPrediction,
      getDifficultySignal,
      reset
    };
  }

  // ---- Public factory ----
  ROOT.HHA.createAIHooks = function createAIHooks(opts){
    try{
      const runMode = String(opts?.runMode || 'play').toLowerCase();
      const deterministic = !!opts?.deterministic || (runMode === 'study' || runMode === 'research');

      // If deterministic: keep silent by default (still safe to call)
      const ai = createHeuristicAI({ ...(opts||{}), deterministic });

      // Safety wrappers (never throw)
      const wrap = (fn, fallback)=> function(){
        try{ return fn.apply(ai, arguments); }catch{ return fallback; }
      };

      return {
        enabled: ai.enabled,
        deterministic: ai.deterministic,

        onEvent: wrap(ai.onEvent, undefined),
        getTip: wrap(ai.getTip, null),
        getPrediction: wrap(ai.getPrediction, null),
        getDifficultySignal: wrap(ai.getDifficultySignal, null),
        reset: wrap(ai.reset, undefined)
      };
    }catch{
      // absolutely never crash
      const runMode = String(opts?.runMode || 'play').toLowerCase();
      const deterministic = (runMode === 'study' || runMode === 'research');
      return safeReturnAI(deterministic);
    }
  };

  // Optional: expose version
  ROOT.HHA.AI_HOOKS_VERSION = 'v20260215a';

})();