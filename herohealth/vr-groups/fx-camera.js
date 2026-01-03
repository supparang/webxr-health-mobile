/* === /herohealth/vr-groups/fx-camera.js ===
PACK 24: Screen Kick + Micro Shake + Boss Heartbeat — PRODUCTION
✅ micro shake (safe) on judge kinds
✅ boss heartbeat/vignette when boss exists or boss events
✅ respects FXPerf level (body[data-fx-level])
✅ respects prefers-reduced-motion
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function reducedMotion(){
    try{ return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch{ return false; }
  }

  function pulseCls(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms||180);
    }catch(_){}
  }

  // --- Boss presence watcher (DOM) ---
  function hasBoss(){
    try{ return !!DOC.querySelector('.fg-target.fg-boss'); }catch{ return false; }
  }

  let bossHold = 0;
  function setBossOn(ms){
    clearTimeout(bossHold);
    DOC.body.classList.add('fx-boss-live');
    bossHold = setTimeout(()=> DOC.body.classList.remove('fx-boss-live'), ms||1400);
  }

  // Observe playLayer for boss appear/disappear
  const playLayer = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  const mo = new MutationObserver(()=>{
    if (!allow(2) || reducedMotion()) return;
    if (hasBoss()) setBossOn(1200);
  });
  try{ mo.observe(playLayer, { childList:true, subtree:true }); }catch{}

  // --- Hooks ---
  root.addEventListener('hha:judge', (ev)=>{
    if (!allow(2) || reducedMotion()) return;
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();

    if (k==='good'){
      pulseCls('fx-kick-good', 140);
      return;
    }
    if (k==='bad'){
      pulseCls('fx-kick-bad', 200);
      return;
    }
    if (k==='boss'){
      setBossOn(1400);
      pulseCls('fx-kick-boss', 220);
      return;
    }
    if (k==='perfect'){
      pulseCls('fx-kick-perfect', 220);
      return;
    }
    if (k==='miss'){
      pulseCls('fx-kick-miss', 160);
      return;
    }
  }, {passive:true});

  root.addEventListener('groups:progress', (ev)=>{
    if (!allow(2) || reducedMotion()) return;
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='storm_on'){
      pulseCls('fx-storm-kick', 420);
    }
    if (k==='boss_spawn'){
      setBossOn(1600);
      pulseCls('fx-kick-boss', 240);
    }
  }, {passive:true});

  root.addEventListener('hha:end', ()=>{
    if (!allow(2) || reducedMotion()) return;
    pulseCls('fx-end-kick', 520);
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);