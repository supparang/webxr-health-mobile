/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks (DISABLED BY DEFAULT)
- Difficulty Director (fair adaptive)
- Coach micro-tips (explainable, rate-limited)
- Pattern Generator (seeded)
Rules:
✅ default OFF
✅ research mode must be OFF
Enable only when ?ai=1 AND runMode=play
Expose: window.GroupsVR.AIHooks.attach({runMode, seed})
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const DOC = root.document;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function on(name, fn){ root.addEventListener(name, fn, {passive:true}); }

  const AI = {
    enabled:false,
    runMode:'play',
    seed:'',

    attach(opts){
      opts = opts || {};
      AI.runMode = String(opts.runMode||'play');
      AI.seed = String(opts.seed||'');

      // hard lock: research => disabled
      if (AI.runMode === 'research'){ AI.enabled=false; return; }

      // enable only when explicitly requested
      AI.enabled = (String(qs('ai','0')) === '1');
      if (!AI.enabled) return;

      // --- Hook points (currently no-op) ---
      // Listen game signals to feed models later
      on('hha:score', (ev)=>{
        // ev.detail => score/combo/miss
      });
      on('groups:progress', (ev)=>{
        // ev.detail => spawn/hit/boss/storm/perfect_switch etc.
      });
      on('quest:update', (ev)=>{
        // ev.detail => goal/mini progress
      });

      // NOTE: real AI logic will be inserted later (remembered already)
      // AI Difficulty Director: adjust parameters smoothly (play only), keep deterministic option if needed
      // AI Coach: explainable tips, rate-limit
      // AI Pattern Generator: spawn/pattern/storm/boss seeded
    }
  };

  NS.AIHooks = AI;

})(typeof window !== 'undefined' ? window : globalThis);