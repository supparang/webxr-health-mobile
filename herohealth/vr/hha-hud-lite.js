// === /herohealth/vr/hha-hud-lite.js ===
// Minimal HUD binder for HydrationVR (fallback)
(function(root){
  'use strict';
  const D = root.document; if(!D) return;

  const $ = (id)=>D.getElementById(id);

  const elScore = $('stat-score');
  const elCombo = $('stat-combo');
  const elMiss  = $('stat-miss');
  const elTime  = $('stat-time');
  const elGrade = $('stat-grade');
  const elStorm = $('storm-left');
  const elShield= $('shield-count');

  const q1 = $('quest-line1');
  const q2 = $('quest-line2');
  const q3 = $('quest-line3');
  const q4 = $('quest-line4');

  function set(el,v){ if(el) el.textContent = String(v); }

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    set(elTime,  d.leftSec ?? '—');
    set(elScore, d.score ?? 0);
    set(elCombo, d.combo ?? 0);
    set(elMiss,  d.misses ?? 0);
    set(elGrade, d.grade ?? 'C');
    set(elStorm, d.stormActive ? (d.stormLeftSec|0) : 0);
    set(elShield,d.shield ?? 0);
  }, { passive:true });

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    set(q1, d.goalLine1 ?? '—');
    set(q2, d.goalLine2 ?? '—');
    set(q3, d.miniLine  ?? '—');
    if (q4 && d.stateLine) q4.textContent = String(d.stateLine);
  }, { passive:true });

})(window);