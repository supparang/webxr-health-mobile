/* === /herohealth/vr-groups/recoil-kick.js ===
PACK 41: cVR Micro Recoil — PRODUCTION
✅ Applies tiny translate to playLayer only (not whole HUD)
✅ Rate-limited, safe for motion sickness
✅ FXPerf gate >=2
*/

(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};
  const $ = (id)=>DOC.getElementById(id);

  function fxLevel(){
    try{ return (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||2); }
    catch{ return 2; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function layer(){
    return $('playLayer') || DOC.querySelector('.playLayer');
  }

  let last = 0;

  function kick(kind){
    if (!allow(2)) return;
    if (!DOC.body.classList.contains('view-cvr')) return;

    const el = layer();
    if (!el) return;

    const t = performance.now();
    if (t - last < 120) return; // rate limit
    last = t;

    // tiny amplitude; boss slightly stronger
    const amp = (kind==='boss') ? 3.0 : (kind==='bad' ? 2.6 : 2.2);
    const dx = (Math.random()*2-1) * amp;
    const dy = (Math.random()*2-1) * amp;

    el.classList.add('fx-kick');
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    setTimeout(()=>{
      el.style.transform = '';
      el.classList.remove('fx-kick');
    }, 90);
  }

  root.addEventListener('hha:judge', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='good') kick('good');
    else if (k==='bad') kick('bad');
    else if (k==='boss') kick('boss');
  }, {passive:true});

})(typeof window!=='undefined'?window:globalThis);