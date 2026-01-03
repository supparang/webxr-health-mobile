/* === /herohealth/vr-groups/near-miss.js ===
PACK 32: Near-miss whoosh + streak line — PRODUCTION
✅ When hha:shoot happens, check closest target distance to crosshair
✅ If close but not hit => emit fx:nearmiss + visual streak
✅ Uses targets positions from GroupsVR.GameEngine.targets (safe read)
Respects FXPerf (>=2) and view-cvr only by default
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function isCVR(){
    return (DOC.body.className||'').includes('view-cvr');
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  function ensureLayer(){
    let el = DOC.querySelector('.fx-nearmiss-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-nearmiss-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:86;overflow:hidden;';
    DOC.body.appendChild(el);
    return el;
  }

  function streak(x1,y1,x2,y2){
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'fx-streak';
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.max(22, Math.sqrt(dx*dx + dy*dy));
    const ang = Math.atan2(dy, dx) * 180/Math.PI;

    el.style.left = x1 + 'px';
    el.style.top  = y1 + 'px';
    el.style.width = len + 'px';
    el.style.transform = `translate(0,-50%) rotate(${ang}deg)`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 380);
  }

  function whoosh(){
    // lightweight: use WebAudio module if exists, else vibrate tiny
    try{
      const A = NS.Audio;
      if (A && A.tick) { A.tick(); return; } // reuse short tick if no whoosh asset
    }catch(_){}
    try{ navigator.vibrate && navigator.vibrate(10); }catch(_){}
  }

  const CX = ()=> (root.innerWidth||360) * 0.5;
  const CY = ()=> (root.innerHeight||640) * 0.5;

  let lastAt = 0;

  root.addEventListener('hha:shoot', ()=>{
    if (!allow(2)) return;
    if (!isCVR()) return;

    const t = NOW();
    if (t - lastAt < 120) return;
    lastAt = t;

    const E = NS.GameEngine;
    const list = (E && Array.isArray(E.targets)) ? E.targets : [];
    if (!list.length) return;

    const cx = CX(), cy = CY();
    let best = null;
    let bestD = 1e9;

    for (let i=0;i<list.length;i++){
      const tg = list[i];
      if (!tg || !isFinite(tg.x) || !isFinite(tg.y)) continue;
      const dx = tg.x - cx, dy = tg.y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD){ bestD = d; best = tg; }
    }

    // If it was a true hit, engine would remove target soon and fx:hit will happen.
    // We treat "near-miss" if within (r + margin) but outside r (approx).
    const r = best ? (Number(best.r)||48) : 48;
    const margin = 18;               // near-miss band width
    if (!best) return;

    if (bestD > r && bestD <= (r + margin)){
      emit('fx:nearmiss', { t, d:bestD, r, kind: best.kind||'target' });
      streak(cx, cy, best.x, best.y);
      whoosh();
      try{ DOC.body.classList.add('fx-nearmiss'); setTimeout(()=>DOC.body.classList.remove('fx-nearmiss'), 180); }catch(_){}
    }
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);