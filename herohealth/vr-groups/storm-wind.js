/* === /herohealth/vr-groups/storm-wind.js ===
PACK 29: Storm Windlines — PRODUCTION
✅ Adds wind overlay layer when storm on
✅ Lightweight CSS animation (no canvas)
✅ Auto start/stop based on body.groups-storm OR fx:storm events
Respects FXPerf (>=2)
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

  function ensureLayer(){
    let el = DOC.querySelector('.storm-wind');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'storm-wind';
    el.innerHTML = `
      <div class="wind-a"></div>
      <div class="wind-b"></div>
      <div class="wind-c"></div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function setOn(on){
    const el = ensureLayer();
    el.classList.toggle('on', !!on);
  }

  // observe body class changes
  const mo = new MutationObserver(()=>{
    if (!allow(2)) return;
    const on = DOC.body.classList.contains('groups-storm');
    setOn(on);
  });
  try{ mo.observe(DOC.body, {attributes:true, attributeFilter:['class']}); }catch{}

  // also allow event trigger
  root.addEventListener('fx:storm', ()=>{
    if (!allow(2)) return;
    setOn(true);
    // auto-off if class not present after some time
    setTimeout(()=>{
      const still = DOC.body.classList.contains('groups-storm');
      if (!still) setOn(false);
    }, 1200);
  }, {passive:true});

  // initial
  if (allow(2)) setOn(DOC.body.classList.contains('groups-storm'));

  NS.StormWind = { setOn };

})(typeof window!=='undefined' ? window : globalThis);