// === /herohealth/vr/ui-fever.js ===
// Fever UI (IIFE) — ensure() + set(fever01) + setShield(bool)
// ids: hha-fever-fill, hha-shield, hha-fever-label

(function(root){
  'use strict';
  const doc = root.document;

  function $(id){ return doc ? doc.getElementById(id) : null; }
  function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }

  let shield = false;

  function ensure(){}

  function set(fever01){
    const pct = clamp(Math.round((Number(fever01)||0)*100), 0, 100);
    const fill = $('hha-fever-fill');
    if (fill) fill.style.width = pct + '%';

    const label = $('hha-fever-label');
    if (label){
      if (pct >= 100) label.textContent = '🔥 FEVER MAX';
      else if (pct >= 60) label.textContent = '🔥 FEVER';
      else label.textContent = '✨ WARM UP';
    }
  }

  function setShield(on){
    shield = !!on;
    const s = $('hha-shield');
    if (s) s.textContent = shield ? '🛡️ ON' : '🛡️ OFF';
  }

  root.FeverUI = { ensure, set, setShield };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = root.FeverUI;
})(typeof window !== 'undefined' ? window : globalThis);