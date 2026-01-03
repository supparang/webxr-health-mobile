/* === /herohealth/vr-groups/storm-wind.js ===
PACK 37: Storm Wind Overlay — PRODUCTION
✅ Wind streaks + vignette when groups-storm
✅ FXPerf gate: only FX>=3
✅ pointer-events:none, safe for cVR
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
    let el = DOC.querySelector('.stormWind');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'stormWind';
    // 18 streaks
    let html = `<div class="stormVignette"></div>`;
    for (let i=0;i<18;i++){
      html += `<span class="windLine" style="--i:${i}"></span>`;
    }
    el.innerHTML = html;
    DOC.body.appendChild(el);
    return el;
  }

  function setOn(on){
    if (!allow(3)) return;
    ensure();
    DOC.body.classList.toggle('fx-wind-on', !!on);
  }

  // hook storm class (from groups.safe.js already adds body.groups-storm)
  const obs = new MutationObserver(()=>{
    const on = DOC.body.classList.contains('groups-storm');
    setOn(on);
  });
  obs.observe(DOC.body, { attributes:true, attributeFilter:['class'] });

  // init
  setOn(DOC.body.classList.contains('groups-storm'));

})(typeof window!=='undefined'?window:globalThis);