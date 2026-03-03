// === /fitness/js/dom-renderer-rhythm.js ===
// SAFE STUB — older builds used a renderer module
// FULL v20260302-DOM-RENDERER-RHYTHM-STUB
'use strict';

(function(){
  const W = window;

  // Minimal renderer interface — no-op
  function createNote(){ return null; }
  function updateNote(){ /* no-op */ }
  function removeNote(){ /* no-op */ }

  W.RhythmDOM = W.RhythmDOM || {
    createNote,
    updateNote,
    removeNote
  };

  console.log('[dom-renderer-rhythm] stub loaded');
})();