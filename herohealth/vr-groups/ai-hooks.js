// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — v0 (PATCH C)
// ✅ createAIHooks({game, seed, runMode, diff, enabled})
// ✅ research/practice => AI OFF by default (deterministic)
// ✅ play => AI ON by default (can disable via ?ai=0)
// Provides:
//  - director: getTuning(state) -> { spawnMul, lifeMul, biasCorrect, lockPxMul }
//  - coach: getTip(state) -> { text, mood } (rate-limited externally)
//  - pattern: nextStormAt / bossPhase helpers (seeded)

(function(){
  'use strict';
  const WIN = window;

  function u32FromSeed(s){
    s = String(s ?? '');
    if(!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a){
    let t = a >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function makeAI(opt){
    opt = opt || {};
    const game = String(opt.game||'').toLowerCase() || 'unknown';
    const runMode = String(opt.runMode||'play').toLowerCase();
    const diff = String(opt.diff||'normal').toLowerCase();
    const seed = String(opt.seed||'');
    const userEnabled = (opt.enabled != null) ? !!opt.enabled : (String(qs('ai','1')) !== '0');

    // deterministic OFF switches:
    const autoOff = (runMode === 'research' || runMode === 'practice');
    const enabled = userEnabled && !autoOff;

    const rng = mulberry32(u32FromSeed(seed + '::ai::' + game));

    // ---- Director v0 (rule-based but smooth + fair) ----
    // state fields expected:
    //  { accuracyPct, miss, combo, timeLeftSec, timePlannedSec, storm, boss }
    function getTuning(state){
      if(!enabled) return { spawnMul:1, lifeMul:1, biasCorrect:0, lockPxMul:1 };

      const acc = clamp(state && state.accuracyPct, 0, 100);
      const miss = clamp(state && state.miss, 0, 99);
      const combo = clamp(state && state.combo, 0, 99);
      const frac = (state && state.timePlannedSec)
        ? clamp(1 - (clamp(state.timeLeftSec,0,state.timePlannedSec)/state.timePlannedSec), 0, 1)
        : 0.0;

      // baseline per diff
      let baseHard = (diff === 'hard') ? 1.12 : (diff === 'easy' ? 0.92 : 1.0);

      // if player doing very well -> slightly harder
      let hardUp = 1.0;
      if(acc >= 88 && combo >= 6) hardUp *= 1.06;
      if(acc >= 92 && combo >= 10) hardUp *= 1.08;

      // if struggling -> ease a bit (but not too much)
      let ease = 1.0;
      if(acc <= 72) ease *= 0.96;
      if(acc <= 62 || miss >= 8) ease *= 0.93;
      if(miss >= 12) ease *= 0.90;

      // mid-game pressure shaping
      if(frac > 0.35 && frac < 0.70) hardUp *= 1.02;

      const spawnMul = clamp(baseHard * hardUp * (1/ease), 0.82, 1.22);
      const lifeMul  = clamp(ease, 0.86, 1.12);

      // biasCorrect: + makes more correct targets appear (keeps playability)
      // keep in small range so it still challenges.
      let biasCorrect = 0;
      if(acc <= 70) biasCorrect += 0.06;
      if(miss >= 8) biasCorrect += 0.06;
      if(acc >= 90 && combo >= 8) biasCorrect -= 0.04;
      biasCorrect = clamp(biasCorrect, -0.06, 0.14);

      // lockPxMul: for mobile/cVR aim feel
      let lockPxMul = 1.0;
      if(acc <= 68) lockPxMul *= 1.10;
      if(acc >= 90) lockPxMul *= 0.96;
      lockPxMul = clamp(lockPxMul, 0.92, 1.18);

      return { spawnMul, lifeMul, biasCorrect, lockPxMul };
    }

    // ---- Coach v0 (short explainable tips) ----
    function getTip(state){
      if(!enabled) return null;
      const acc = clamp(state && state.accuracyPct, 0, 100);
      const miss = clamp(state && state.miss, 0, 99);
      const combo = clamp(state && state.combo, 0, 99);

      // pick a tip deterministically-ish
      const r = rng();
      if(miss >= 8 && r < 0.5) return { text:'MISS เริ่มสูง—ช้าลงนิด เล็งที่ “ชื่อหมู่” ก่อนยิง 🎯', mood:'neutral' };
      if(acc <= 65 && r < 0.65) return { text:'ลอง “หยุด 0.2 วิ” ก่อนแตะยิง จะถูกขึ้นเยอะ 👀', mood:'neutral' };
      if(combo >= 8 && r < 0.7) return { text:'คอมโบสวยมาก! รักษาจังหวะเดิมไว้ แล้วค่อยเร่ง 🔥', mood:'happy' };
      return { text:'ทริค: ดู “ชื่อหมู่” ก่อน แล้วค่อยยิงที่อีโมจิ ✅', mood:'neutral' };
    }

    // ---- Pattern helper (seeded) ----
    function nextInRange(minSec, maxSec){
      minSec = clamp(minSec, 6, 60);
      maxSec = clamp(maxSec, minSec, 120);
      return Math.round(minSec + rng() * (maxSec - minSec));
    }

    function onEvent(/*name, detail*/){
      // reserved for telemetry-driven learning later
    }

    return {
      enabled,
      getTuning,
      getTip,
      nextInRange,
      onEvent
    };
  }

  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = function(opt){
    try{ return makeAI(opt); }catch(_){ return { enabled:false, getTuning:()=>({spawnMul:1,lifeMul:1,biasCorrect:0,lockPxMul:1}), getTip:()=>null, nextInRange:()=>18, onEvent:()=>{} }; }
  };
})();