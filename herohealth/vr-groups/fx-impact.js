/* === /herohealth/vr-groups/fx-impact.js ===
PACK 23: Impact Numbers + Grade Banner — PRODUCTION
✅ Floating numbers on judge (good/bad/boss/perfect/miss)
✅ Grade banner on rank change
Respects: GroupsVR.FXPerf (PACK21)
Optional: uses Particles.popText if available; else DOM float
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
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function centerXY(){ return { x:(root.innerWidth||0)*0.5, y:(root.innerHeight||0)*0.55 }; }

  function ensureLayer(){
    let layer = DOC.querySelector('.groups-impact-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'groups-impact-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden;';
    DOC.body.appendChild(layer);
    return layer;
  }

  function hasParticles(){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      return !!(P && typeof P.popText==='function');
    }catch{ return false; }
  }

  function popText(x,y,text,cls){
    if (!allow(1)) return;
    x = clamp(x, 12, (root.innerWidth||360)-12);
    y = clamp(y, 12, (root.innerHeight||640)-12);

    // prefer Particles popText at level 3
    if (hasParticles() && fxLevel()>=3){
      try{
        const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
        P.popText(x,y,text,cls||'');
        return;
      }catch(_){}
    }

    // DOM fallback
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'fx-float ' + (cls||'');
    el.textContent = String(text||'');
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 720);
  }

  // grade banner
  function ensureBanner(){
    let b = DOC.querySelector('.groups-grade-banner');
    if (b) return b;
    b = DOC.createElement('div');
    b.className = 'groups-grade-banner';
    b.innerHTML = `<div class="gb-inner"><div class="gb-title">RANK</div><div class="gb-grade" id="gbGrade">C</div></div>`;
    DOC.body.appendChild(b);
    return b;
  }

  let lastGrade = null;
  let lastBannerAt = 0;
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function showBanner(grade){
    const L = fxLevel();
    if (L<=1) return; // banner only >=2
    const t = now();
    if (t - lastBannerAt < 600) return;
    lastBannerAt = t;

    const b = ensureBanner();
    const gEl = b.querySelector('#gbGrade');
    if (gEl) gEl.textContent = String(grade||'C');

    b.classList.remove('show');
    // force reflow
    void b.offsetWidth;
    b.classList.add('show');

    setTimeout(()=>{ try{ b.classList.remove('show'); }catch{} }, 820);
  }

  // judge -> impact numbers
  root.addEventListener('hha:judge', (ev)=>{
    if (!allow(1)) return;
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    const txt  = String(d.text||'');
    const x = (typeof d.x==='number') ? d.x : centerXY().x;
    const y = (typeof d.y==='number') ? d.y : centerXY().y;

    if (kind==='good'){
      popText(x,y, txt || '+', 'fx-good');
      return;
    }
    if (kind==='bad'){
      popText(x,y, txt || 'BAD', 'fx-bad');
      return;
    }
    if (kind==='boss'){
      popText(x,y, txt || 'BOSS', 'fx-boss');
      return;
    }
    if (kind==='perfect'){
      popText(x,y, txt || 'PERFECT', 'fx-perfect');
      return;
    }
    if (kind==='miss'){
      popText(x,y, 'MISS', 'fx-miss');
      return;
    }
  }, {passive:true});

  // rank change banner
  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    const grade = String(d.grade||'C');
    if (grade !== lastGrade){
      lastGrade = grade;
      // show only if improved or final (we can’t know improved reliably, but banner is short)
      showBanner(grade);
    }
  }, {passive:true});

  // end -> show banner once more if allowed
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    const grade = String(d.grade||'C');
    if (allow(2)) showBanner(grade);
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);