// === /herohealth/plate/plate-ai-bridge.js ===
// Plate AI Bridge: wires plate.safe.js signals <-> HHA_AI hooks
(function(){
  'use strict';
  const WIN = window;

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  WIN.HHA_PLATE_AI = {
    init({ runMode, diff, seed }){
      const AI = WIN.HHA_AI;
      if(!AI || !AI.init) return;
      AI.init({
        game:'plate',
        runMode,
        diff,
        seed,
        // ✅ default OFF in study; patternEnabled can be true for research logging
        patternEnabled: true,
        tipCooldownMs: 6500
      });
    },

    tip(key, msg, mood, extra){
      const AI = WIN.HHA_AI;
      if(!AI || !AI.tip) return false;
      return AI.tip(key, msg, mood, extra);
    },

    difficulty(signal){
      const AI = WIN.HHA_AI;
      if(!AI || !AI.difficulty) return null;
      return AI.difficulty(signal);
    },

    pattern(mode, ctx){
      const AI = WIN.HHA_AI;
      if(!AI || !AI.pattern) return null;
      return AI.pattern(mode, ctx);
    }
  };

  // relay coach events (optional)
  WIN.addEventListener('hha:ai', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    // you can observe in console if needed:
    // console.log('[PlateAI]', d.type, d);
  }, {passive:true});

})();