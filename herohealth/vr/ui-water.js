// === /herohealth/vr/ui-water.js ===
// Water UI (IIFE) — ensure() + set(pct, zone)
// ids: hha-water-fill, hha-water-zone, hha-water-pct

(function(root){
  'use strict';
  const doc = root.document;

  function $(id){ return doc ? doc.getElementById(id) : null; }
  function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }

  function zoneFrom(pct){
    pct = Number(pct)||0;
    if (pct < 35) return 'LOW';
    if (pct > 70) return 'HIGH';
    return 'BALANCED';
  }

  function ensure(){
    // nothing to build here (HTML already has)
  }

  function set(pct, zone){
    pct = clamp(pct, 0, 100);
    zone = zone || zoneFrom(pct);

    const fill = $('hha-water-fill');
    const zEl  = $('hha-water-zone');
    const pEl  = $('hha-water-pct');

    if (fill) fill.style.width = pct + '%';
    if (pEl) pEl.textContent = `${pct}%`;

    if (zEl){
      let label = '💧 BALANCED';
      if (zone === 'LOW') label = '⚠️ LOW';
      if (zone === 'HIGH') label = '🌊 HIGH';
      zEl.textContent = label;
    }
  }

  root.WaterUI = { ensure, set, zoneFrom };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.WaterUI = root.WaterUI;
})(typeof window !== 'undefined' ? window : globalThis);