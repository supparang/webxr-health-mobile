/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks — PACK 15 (OFF by default)
✅ attach({ runMode, seed, enabled })
✅ Never runs in research unless explicitly allowed (we keep disabled)
✅ Placeholders:
  - Difficulty Director (adaptive fairness)
  - AI Coach micro-tips
  - Pattern Generator
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const AI = NS.AIHooks = NS.AIHooks || {};

  AI._attached = false;
  AI._enabled = false;
  AI._ctx = null;

  function safeOn(ev, fn){
    try{ root.addEventListener(ev, fn, { passive:true }); }catch(_){}
  }

  AI.attach = function(cfg){
    cfg = cfg || {};
    const runMode = String(cfg.runMode||'play').toLowerCase();
    const enabled = !!cfg.enabled;

    // ✅ hard gate
    if (runMode === 'research' || runMode === 'practice') {
      AI._enabled = false;
      return;
    }
    AI._enabled = enabled;
    AI._ctx = { seed: String(cfg.seed||''), runMode };

    if (AI._attached) return;
    AI._attached = true;

    // hooks you can expand later
    safeOn('hha:score', (e)=>{
      if(!AI._enabled) return;
      // TODO: difficulty director input stream
    });

    safeOn('groups:progress', (e)=>{
      if(!AI._enabled) return;
      // TODO: pattern generator triggers (storm/boss pacing)
    });

    safeOn('groups:dl', (e)=>{
      if(!AI._enabled) return;
      // Already produced by engine (DL-lite). Here is the place to log/analyze further if needed.
    });
  };

})(typeof window!=='undefined' ? window : globalThis);