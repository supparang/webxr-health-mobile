// === /fitness/js/rhythm-engine.js ===
// SAFE STUB — older builds used an engine module
// FULL v20260302-RHYTHM-ENGINE-STUB
'use strict';

(function(){
  const W = window;

  // Minimal engine interface — no-op schedule generator
  function buildSchedule(opts){
    // Return empty schedule (real schedule is inside rhythm-boxer.js MVP)
    return { bpm: opts?.bpm || 120, notes: [] };
  }

  W.RhythmEngine = W.RhythmEngine || {
    buildSchedule
  };

  console.log('[rhythm-engine] stub loaded');
})();