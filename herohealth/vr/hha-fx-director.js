// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (universal, safe)
// ✅ Adds body classes for global FX:
//    - fx-storm (timeLeft <= 30s)
//    - fx-boss  (misses >= 4)
//    - fx-rage  (misses >= 5)
// ✅ Adds micro FX pulse/shake classes (short-lived):
//    - gj-junk-hit, gj-good-expire, gj-miss-shot, gj-mini-clear
// ✅ Works with existing CSS in each game (e.g., goodjunk-vr.css)
// ✅ Safe: no dependencies, no overrides, ignores errors
//
// Recommended: load AFTER particles.js, BEFORE boot.js

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const BODY = DOC.body || DOC.documentElement;

  // ---------------------------
  // Config (tunable)
  // ---------------------------
  const CFG = Object.assign({
    stormSec: 30,     // timeLeft <= 30 => fx-storm
    bossMiss: 4,      // miss >= 4 => fx-boss
    rageMiss: 5,      // miss >= 5 => fx-rage
    microMs: 220,     // micro effect life
  }, root.HHA_FX_CONFIG || {});

  // ---------------------------
  // State
  // ---------------------------
  const S = {
    timeLeft: null,     // seconds
    misses: 0,
    runMode: null,
    diff: null,
    game: null,
    ended: false,
  };

  // ---------------------------
  // Helpers
  // ---------------------------
  function clamp(n, a, b){
    n = Number(n);
    if(!isFinite(n)) n = 0;
    return n < a ? a : (n > b ? b : n);
  }

  function add(cls){
    try{ BODY.classList.add(cls); }catch(_){}
  }
  function remove(cls){
    try{ BODY.classList.remove(cls); }catch(_){}
  }
  function has(cls){
    try{ return BODY.classList.contains(cls); }catch(_){ return false; }
  }

  function micro(cls, ms){
    ms = Math.max(60, Number(ms)||CFG.microMs);
    try{
      BODY.classList.add(cls);
      setTimeout(()=>{ try{ BODY.classList.remove(cls); }catch(_){ } }, ms);
    }catch(_){}
  }

  function applyGlobal(){
    if(S.ended){
      remove('fx-storm'); remove('fx-boss'); remove('fx-rage');
      return;
    }

    // storm
    if(S.timeLeft != null && isFinite(S.timeLeft) && S.timeLeft <= CFG.stormSec) add('fx-storm');
    else remove('fx-storm');

    // boss / rage by misses
    if(S.misses >= CFG.bossMiss) add('fx-boss'); else remove('fx-boss');
    if(S.misses >= CFG.rageMiss) add('fx-rage'); else remove('fx-rage');
  }

  function readFromJudge(detail){
    // Flexible mapping: allow different games to send slightly different fields
    try{
      // Common patterns:
      // detail: { kind:'junk'|'good'|'miss'|'expire'|'block', deltaMiss:+1, misses: N, blocked:true }
      const k = (detail && (detail.kind || detail.type || detail.result)) || '';
      const deltaMiss = Number(detail?.deltaMiss ?? detail?.missDelta ?? 0) || 0;

      if(Number.isFinite(detail?.misses)) S.misses = Math.max(0, Number(detail.misses)||0);
      else if(deltaMiss) S.misses = Math.max(0, S.misses + deltaMiss);

      // micro FX semantics for GoodJunk
      if(k === 'junk' || k === 'bad'){
        if(detail?.blocked) micro('gj-mini-clear', 160); // blocked junk feels "good"
        else micro('gj-junk-hit', 180);
      }else if(k === 'expire' || k === 'miss_expire'){
        micro('gj-good-expire', 160);
      }else if(k === 'miss' || k === 'shot_miss'){
        micro('gj-miss-shot', 140);
      }else if(k === 'mini_clear' || k === 'mini'){
        micro('gj-mini-clear', 220);
      }
    }catch(_){}
  }

  // ---------------------------
  // Event listeners (universal)
  // ---------------------------
  function onTime(ev){
    try{
      const d = ev?.detail || ev || {};
      // allow: { timeLeftSec } or { left } or { tLeft } or { remain }
      const tl =
        d.timeLeftSec ?? d.timeLeft ?? d.left ?? d.tLeft ?? d.remain ?? d.remaining ?? null;

      if(tl == null) return;

      const v = clamp(tl, 0, 999999);
      S.timeLeft = v;
      applyGlobal();
    }catch(_){}
  }

  function onScore(ev){
    try{
      const d = ev?.detail || ev || {};
      // allow: { misses } or { miss } or { missCount }
      const m = d.misses ?? d.miss ?? d.missCount ?? null;
      if(m != null && isFinite(Number(m))){
        S.misses = Math.max(0, Number(m)||0);
        applyGlobal();
      }
    }catch(_){}
  }

  function onQuest(ev){
    // If mini cleared, give a tiny celebration pulse
    try{
      const d = ev?.detail || {};
      const mini = d.mini || null;
      if(mini && mini.done) micro('gj-mini-clear', 240);
    }catch(_){}
  }

  function onJudge(ev){
    try{
      const d = ev?.detail || {};
      readFromJudge(d);
      applyGlobal();
    }catch(_){}
  }

  function onStart(ev){
    try{
      const d = ev?.detail || {};
      S.ended = false;
      S.runMode = d.runMode || d.run || S.runMode;
      S.diff = d.diff || S.diff;
      S.game = d.game || d.gameMode || S.game;

      // reset (but keep if caller already sets)
      if(d.resetFx !== false){
        remove('fx-storm'); remove('fx-boss'); remove('fx-rage');
        remove('gj-junk-hit'); remove('gj-good-expire'); remove('gj-miss-shot'); remove('gj-mini-clear');
      }

      // optional: accept initial misses/timeLeft
      if(d.misses != null) S.misses = Math.max(0, Number(d.misses)||0);
      if(d.timeLeftSec != null) S.timeLeft = Math.max(0, Number(d.timeLeftSec)||0);

      applyGlobal();
    }catch(_){}
  }

  function onEnd(ev){
    try{
      S.ended = true;
      applyGlobal();
      // leave micro classes to self-clear; remove globals now
      remove('fx-storm'); remove('fx-boss'); remove('fx-rage');
    }catch(_){}
  }

  // Listen on window + document (some modules dispatch on either)
  const OPT = { passive:true };

  root.addEventListener('hha:start', onStart, OPT);
  DOC.addEventListener('hha:start', onStart, OPT);

  root.addEventListener('hha:time', onTime, OPT);
  DOC.addEventListener('hha:time', onTime, OPT);

  root.addEventListener('hha:score', onScore, OPT);
  DOC.addEventListener('hha:score', onScore, OPT);

  root.addEventListener('quest:update', onQuest, OPT);
  DOC.addEventListener('quest:update', onQuest, OPT);

  root.addEventListener('hha:judge', onJudge, OPT);
  DOC.addEventListener('hha:judge', onJudge, OPT);

  root.addEventListener('hha:end', onEnd, OPT);
  DOC.addEventListener('hha:end', onEnd, OPT);

  // Safety: if page hides, drop global FX (avoid stuck state)
  DOC.addEventListener('visibilitychange', ()=>{
    try{
      if(DOC.visibilityState === 'hidden'){
        remove('fx-storm'); remove('fx-boss'); remove('fx-rage');
      }
    }catch(_){}
  }, OPT);

  // Expose tiny debug helper (optional)
  root.HHA_FX = {
    setMisses(n){ S.misses = Math.max(0, Number(n)||0); applyGlobal(); },
    setTimeLeft(n){ S.timeLeft = Math.max(0, Number(n)||0); applyGlobal(); },
    poke(){ applyGlobal(); }
  };

})(window);