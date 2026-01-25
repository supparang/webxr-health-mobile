// === /herohealth/vr-goodjunk/ai-hooks.js ===
// AI Hooks — GoodJunkVR (OFF by default in research/practice)
// ✅ Collects features for ML/DL dataset
// ✅ Optional online predictor slot (not enabled by default)
// ✅ Exposes: createAIHooks({enabled, mode, seed})
//
// Event in:
// - hooks.onSpawn({kind, groupId, ttlMs, x, y, safeW, safeH})
// - hooks.onHit({kind, groupId, rtMs, fever, shield, combo, miss})
// - hooks.onTick({tLeft, fever, shield, combo, missRecent, rtEwma})
//
// Event out (optional):
// - hooks.suggest({tempoMs, pJunk, pGood, pStar, pShield})  // for future ML policy

'use strict';

export function createAIHooks(cfg = {}){
  const enabled = !!cfg.enabled;
  const mode = String(cfg.mode || 'play'); // play|research|practice
  const seed = String(cfg.seed || '');
  const S = {
    enabled,
    mode,
    seed,
    // dataset buffers (small; logger should flush)
    n: 0,
    last: null,
    // simple stats
    lastSuggest: null
  };

  // helper: safe emit to cloud logger
  function logAI(type, payload){
    try{
      const L = window.HHACloudLogger;
      if(!L) return;
      if(typeof L.log === 'function') L.log({ type, ...payload });
      else window.dispatchEvent(new CustomEvent('hha:log', { detail:{ type, ...payload } }));
    }catch(_){}
  }

  function frameBase(){
    return {
      ai: true,
      aiMode: S.mode,
      aiSeed: S.seed,
      ts: Date.now()
    };
  }

  function onSpawn(p){
    if(!S.enabled) return;
    S.n++;
    S.last = { ...p };
    logAI('ai:spawn', { ...frameBase(), ...p, n:S.n });
  }

  function onHit(p){
    if(!S.enabled) return;
    logAI('ai:hit', { ...frameBase(), ...p });
  }

  function onTick(p){
    if(!S.enabled) return;
    // ลดความถี่ log tick เพื่อไม่หนัก: 1/6 วินาที
    const now = performance.now ? performance.now() : Date.now();
    if(!S._lastTickLog) S._lastTickLog = 0;
    if(now - S._lastTickLog < 165) return;
    S._lastTickLog = now;

    logAI('ai:tick', { ...frameBase(), ...p });
  }

  // placeholder predictor (ยังไม่เปิดใช้)
  function suggest(/*state*/){
    // future: call TFJS model here -> return {tempoMs, pGood,...}
    return S.lastSuggest;
  }

  return Object.freeze({ enabled:S.enabled, mode:S.mode, seed:S.seed, onSpawn, onHit, onTick, suggest });
}