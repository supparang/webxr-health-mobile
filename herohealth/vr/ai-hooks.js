// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks (SAFE STUB) — Director + Coach + Pattern (seed-friendly)
// Exposes: window.HHA.createAIHooks({game, runMode, diff, seed})

'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // tiny seeded rng for pattern IDs (deterministic only when asked)
  function seededRng(seed){
    let t = (Number(seed)||1) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function createAIHooks({ game='unknown', runMode='play', diff='normal', seed=0 }={}){
    const mode = String(runMode||'play').toLowerCase();
    const adaptiveAllowed = (mode === 'play');          // research/study => OFF
    const rng = (mode === 'research' || mode === 'study') ? seededRng(seed||1) : Math.random;

    // state for prediction/coach
    const S = {
      t0: now(),
      lastTipAt: 0,
      tipCooldownMs: 3500, // rate-limit
      skill: 0.5,          // 0..1 (heuristic)
      pressure: 0.5,       // 0..1
      lastAcc: 1,
      lastComboMax: 0,
      lastMiss: 0,
      patternId: 1,
      // feature log buffer (for future ML/DL)
      feats: []
    };

    function logFeature(type, payload){
      // keep small ring buffer
      try{
        S.feats.push({ t: Math.round(now()-S.t0), type, ...payload });
        if(S.feats.length > 1200) S.feats.splice(0, 300);
      }catch{}
    }

    function predictDifficultySignal({ accuracy=1, comboMax=0, miss=0, timeLeft=0 }={}){
      // heuristic: skill rises with accuracy & combo; falls with miss spikes
      const acc = clamp(accuracy, 0, 1);
      const combo = clamp(comboMax/18, 0, 1);
      const missRate = clamp(miss/20, 0, 1);

      S.skill = clamp(0.60*acc + 0.40*combo - 0.35*missRate, 0.05, 0.98);

      // pressure: late time + higher skill -> can increase pacing
      const late = clamp(1 - (timeLeft/90), 0, 1);
      S.pressure = clamp(0.35 + 0.55*late + 0.25*S.skill, 0, 1);

      S.lastAcc = acc;
      S.lastComboMax = comboMax|0;
      S.lastMiss = miss|0;

      logFeature('predict', { acc, comboMax, miss, timeLeft, skill:S.skill, pressure:S.pressure });

      return { skill:S.skill, pressure:S.pressure };
    }

    function getDifficulty({ accuracy=1, comboMax=0, miss=0, timeLeft=0 }={}){
      // returns spawnRate adjust hint (ms delta)
      if(!adaptiveAllowed) return { enabled:false };

      const p = predictDifficultySignal({ accuracy, comboMax, miss, timeLeft });

      // translate into pacing delta
      // higher pressure+skill => faster (negative delta)
      const delta = Math.round(clamp((0.5 - (0.55*p.skill + 0.45*p.pressure)) * 260, -180, 180));

      return {
        enabled:true,
        spawnRateDeltaMs: delta, // game can apply to spawnRate
        skill: p.skill,
        pressure: p.pressure
      };
    }

    function getTip({ kind='generic', accuracy=1, combo=0, miss=0 }={}){
      const t = now();
      if(t - S.lastTipAt < S.tipCooldownMs) return null;
      S.lastTipAt = t;

      const acc = clamp(accuracy,0,1);

      let msg = 'คุมจังหวะดี ๆ แล้วจะได้คอมโบยาวขึ้น!';
      let explain = 'general';

      if(kind === 'junk'){
        msg = 'ของหวาน/ทอดหลอกเยอะขึ้นแล้วนะ—เล็งก่อนยิง!';
        explain = 'avoid_junk';
      }else if(acc < 0.72){
        msg = 'ลอง “หยุด 0.3 วิ” ก่อนยิง จะคุมความแม่นได้มากขึ้น';
        explain = 'low_accuracy';
      }else if(combo >= 10){
        msg = 'สุดยอด! รักษาคอมโบไว้—พลาดนิดเดียวคอมโบแตกนะ';
        explain = 'high_combo';
      }else if(miss >= 6){
        msg = 'พลาดติด ๆ กัน—โหมดนี้ให้โฟกัสเป้าดีเท่านั้นก่อน';
        explain = 'miss_spike';
      }

      logFeature('tip', { kind, acc, combo, miss, explain });

      return { msg, explain };
    }

    function nextPattern({ phase='spawn' }={}){
      // deterministic patterns only for research/study if you want
      // here: always returns an id, but your game can ignore when research
      S.patternId = 1 + Math.floor(rng()*7);
      logFeature('pattern', { phase, id:S.patternId });
      return { id:S.patternId };
    }

    function onEvent(name, detail){
      // unify event sink for future ML/DL
      logFeature('event', { name:String(name||''), d: detail ? 1 : 0 });
    }

    return { getDifficulty, getTip, nextPattern, onEvent, _debug:()=>({ ...S }) };
  }

  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = WIN.HHA.createAIHooks || createAIHooks;
})();
