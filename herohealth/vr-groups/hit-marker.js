/* === /herohealth/vr-groups/hit-marker.js ===
PACK 39: Hit Marker — PRODUCTION
✅ FPS hit marker at crosshair center
✅ reacts to hha:judge kinds: good/bad/boss/perfect/miss
FXPerf gate >=2
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

  function ensure(){
    let el = DOC.querySelector('.hitMarker');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'hitMarker';
    el.innerHTML = `
      <div class="mk mkA"></div>
      <div class="mk mkB"></div>
      <div class="mk mkC"></div>
      <div class="mk mkD"></div>
      <div class="mkRing"></div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  let tmr = 0;
  function flash(cls, ms){
    if (!allow(2)) return;
    ensure();
    DOC.body.classList.remove('mk-good','mk-bad','mk-boss','mk-perfect','mk-miss');
    DOC.body.classList.add(cls);
    DOC.body.classList.add('mk-on');
    clearTimeout(tmr);
    tmr = setTimeout(()=>{
      DOC.body.classList.remove('mk-on');
      DOC.body.classList.remove(cls);
    }, ms||120);
  }

  root.addEventListener('hha:judge', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='good')    return flash('mk-good', 115);
    if (k==='bad')     return flash('mk-bad', 130);
    if (k==='boss')    return flash('mk-boss', 140);
    if (k==='perfect') return flash('mk-perfect', 170);
    if (k==='miss')    return flash('mk-miss', 110);
  }, {passive:true});

})(typeof window!=='undefined'?window:globalThis);