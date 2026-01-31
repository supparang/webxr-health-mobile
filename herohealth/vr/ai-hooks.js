// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE PRODUCTION (CLASSIC SCRIPT)
// ✅ Always provides: getDifficulty(), getTip(), onEvent()
// ✅ Disabled by default for non-play modes (research/practice)
// ✅ Deterministic-friendly: uses provided rng if any
// ✅ Compat: window.GroupsVR.AIHooks.attach(...) if GroupsVR exists
// Notes: This is NOT "real ML" - it's a safe adaptive director + explainable tips.

(function(){
  'use strict';

  const WIN = window;
  if (!WIN) return;

  // Namespace
  WIN.HHA = WIN.HHA || {};

  const clamp = (v, a, b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  // ---------- Factory ----------
  function createAIHooks(opts = {}){
    const game = String(opts.game || 'HHA').slice(0, 40);
    const mode = String(opts.mode || 'play').toLowerCase();
    const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

    // OFF by design for research/practice unless explicitly forced
    const enabled = (mode === 'play') && (opts.enabled !== false);

    const S = {
      enabled,
      game,
      mode,

      // EMA stats
      emaAcc: 0.72,
      emaMist: 0.10,
      emaSpeed: 0.50,
      lastEventAt: 0,

      // counters
      hitGood: 0,
      hitJunk: 0,
      miss: 0,

      // tips
      lastTipAt: 0,
      tipCooldownMs: 6500,
      lastTipKey: ''
    };

    function onEvent(type, payload = {}){
      if(!S.enabled) return;

      const t = Number(payload.t ?? nowMs());
      if(t < S.lastEventAt) S.lastEventAt = t;
      S.lastEventAt = t;

      if(type === 'hitGood'){
        S.hitGood++;
        S.emaAcc   = S.emaAcc*0.90   + 0.10*(1.0);
        S.emaMist  = S.emaMist*0.92  + 0.08*(0.0);
        S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.70);
      }else if(type === 'hitJunk'){
        S.hitJunk++;
        S.emaAcc   = S.emaAcc*0.90   + 0.10*(0.0);
        S.emaMist  = S.emaMist*0.92  + 0.08*(1.0);
        S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.55);
      }else if(type === 'miss'){
        S.miss++;
        S.emaAcc   = S.emaAcc*0.92   + 0.08*(0.0);
        S.emaMist  = S.emaMist*0.90  + 0.10*(1.0);
        S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.40);
      }else if(type === 'shoot'){
        S.emaSpeed = S.emaSpeed*0.92 + 0.08*(0.85);
      }
    }

    function getDifficulty(playedSec, base){
      const b = Object.assign({}, base || {});
      if(!S.enabled) return b;

      const t = clamp(playedSec, 0, 9999);

      const mist = clamp(S.emaMist, 0, 1);
      const acc  = clamp(S.emaAcc,  0, 1);
      const spd  = clamp(S.emaSpeed,0, 1);

      let k = 0;
      k += (acc  - 0.72) * 0.90;
      k -= (mist - 0.12) * 1.10;
      k += (spd  - 0.55) * 0.35;

      const wob = (rng() - 0.5) * 0.06;
      k = clamp(k + wob, -0.35, 0.35);

      const spawnMin = 520;
      const spawnMax = 1100;

      const spawnMs = clamp((b.spawnMs || 900) * (1 - k*0.22), spawnMin, spawnMax);

      let pJunk   = clamp((b.pJunk   ?? 0.26) + k*0.07, 0.18, 0.55);
      let pGood   = clamp((b.pGood   ?? 0.70) - k*0.07, 0.35, 0.78);
      let pStar   = clamp((b.pStar   ?? 0.02) + (-k)*0.01, 0.01, 0.06);
      let pShield = clamp((b.pShield ?? 0.02) + (-k)*0.02, 0.01, 0.10);

      if(t > 10){
        const r = clamp((t-10)/60, 0, 1);
        pJunk = clamp(pJunk + r*0.03, 0.18, 0.60);
        pGood = clamp(pGood - r*0.03, 0.30, 0.78);
      }

      return { spawnMs, pGood, pJunk, pStar, pShield };
    }

    function getTip(){
      if(!S.enabled) return null;

      const t = nowMs();
      if(t - S.lastTipAt < S.tipCooldownMs) return null;

      const mist = clamp(S.emaMist, 0, 1);
      const acc  = clamp(S.emaAcc,  0, 1);

      let key = '';
      let msg = '';

      if(mist > 0.22){
        key = 'mist';
        msg = 'โฟกัส “ของดี” ก่อนนะ 👀 ถ้าเห็นของเสียใกล้จุดเล็งให้ชะลอ 0.5 วิแล้วค่อยยิง';
      }else if(acc > 0.86){
        key = 'acc';
        msg = 'เก่งมาก! ต่อไปลองคุมคอมโบให้ยาวขึ้น 🔥 อย่ารีบยิงถ้ายังไม่ชัวร์ว่าเป็นของดี';
      }else{
        key = 'flow';
        msg = 'เคล็ดลับ: เล็งกลางจอแล้วค่อยยิง 🎯 ถ้าพลาดบ่อยให้ใช้ SHIELD ช่วยกัน MISS';
      }

      if(key === S.lastTipKey && (t - S.lastTipAt < S.tipCooldownMs*1.6)) return null;

      S.lastTipAt = t;
      S.lastTipKey = key;
      return { msg, tag: `${game} AI` };
    }

    return { enabled: S.enabled, onEvent, getDifficulty, getTip };
  }

  // ---------- safe wrapper ----------
  function makeSafe(ai){
    ai = ai || { enabled:false };
    if (typeof ai.onEvent !== 'function') ai.onEvent = ()=>{};
    if (typeof ai.getDifficulty !== 'function') ai.getDifficulty = (_sec, base)=>Object.assign({}, base||{});
    if (typeof ai.getTip !== 'function') ai.getTip = ()=>null;
    return ai;
  }

  // Export to window
  WIN.HHA.createAIHooks = createAIHooks;
  WIN.HHA.AIHooks = WIN.HHA.AIHooks || {};
  WIN.HHA.AIHooks.create = (opts)=> makeSafe(createAIHooks(opts||{}));
  WIN.HHA.AIHooks.stub   = ()=> makeSafe(null);

  // ---------- Compat: GroupsVR.AIHooks.attach ----------
  try{
    WIN.GroupsVR = WIN.GroupsVR || {};
    WIN.GroupsVR.AIHooks = WIN.GroupsVR.AIHooks || {};

    WIN.GroupsVR.AIHooks.attach = function attach(cfg = {}){
      const runMode = String(cfg.runMode || cfg.mode || 'play').toLowerCase();
      const game    = String(cfg.game || 'GroupsVR');
      const enabled = !!cfg.enabled && (runMode === 'play');
      const rng = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

      const ai = makeSafe(createAIHooks({ game, mode: runMode, rng, enabled }));
      WIN.GroupsVR.AIHooks._ai = ai;
      return ai;
    };

    WIN.GroupsVR.AIHooks.onEvent = (t,p)=> (WIN.GroupsVR.AIHooks._ai || makeSafe(null)).onEvent(t,p);
    WIN.GroupsVR.AIHooks.getDifficulty = (s,b)=> (WIN.GroupsVR.AIHooks._ai || makeSafe(null)).getDifficulty(s,b);
    WIN.GroupsVR.AIHooks.getTip = (s)=> (WIN.GroupsVR.AIHooks._ai || makeSafe(null)).getTip(s);
  }catch(_){}

})();