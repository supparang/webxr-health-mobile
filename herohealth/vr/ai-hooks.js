// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (default OFF in study/research)
// - Centralized hooks for:
//   (1) Difficulty Director (signals only unless enabled)
//   (2) Explainable Coach micro-tips (rate-limited)
//   (3) Pattern Generator plan (seeded, deterministic)
// - Emits: hha:ai (game, type, ...payload)
// - Usage: const AI = createAIHooks({ game:'plate', enabled: !isStudy, seed, tipCooldownMs:6500 })

(function(){
  'use strict';
  const ROOT = window;

  function nowMs(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function createAIHooks(cfg){
    cfg = cfg || {};
    const game = String(cfg.game || 'game');
    const seed = Number(cfg.seed || 0) || 0;

    const AI = {
      game,
      seed,
      enabled: !!cfg.enabled,
      lastTipMs: 0,
      tipCooldownMs: clamp(cfg.tipCooldownMs ?? 6500, 1200, 30000),

      emit(type, data){
        emit('hha:ai', { game, type, seed, ...(data||{}) });
      },

      // micro tips: call with a key and a message
      shouldTip(){
        const t = nowMs();
        return (t - AI.lastTipMs) >= AI.tipCooldownMs;
      },

      tip(key, msg, mood){
        if(!AI.enabled) return false;
        const t = nowMs();
        if(t - AI.lastTipMs < AI.tipCooldownMs) return false;
        AI.lastTipMs = t;
        AI.emit('coach-tip', { key, msg, mood: mood||'neutral' });
        return true;
      },

      // difficulty signal: just a telemetry hook unless you enable director later
      difficultySignal(payload){
        AI.emit('difficulty-signal', payload || {});
      },

      // pattern plan: deterministic plan declaration
      patternPlan(payload){
        AI.emit('pattern', payload || {});
      }
    };

    return AI;
  }

  ROOT.HHA_AI_HOOKS = { createAIHooks };
})();