/* === /herohealth/vr-groups/storm-tunnel.js ===
PACK 47: Storm Tunnel Overlay — PRODUCTION
✅ DOM overlay vignette during storm
✅ Adds brief safe shake on storm_on (FX=3)
*/

(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{ return (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||2); }
    catch{ return 2; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function ensure(){
    let el = DOC.querySelector('.storm-tunnel');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'storm-tunnel';
    DOC.body.appendChild(el);
    return el;
  }

  let shakeT = 0;
  function shake(ms){
    if (!allow(3)) return;
    clearTimeout(shakeT);
    DOC.body.classList.add('storm-shake');
    shakeT = setTimeout(()=>DOC.body.classList.remove('storm-shake'), ms||650);
  }

  ensure();

  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k === 'storm_on'){
      DOC.body.classList.add('storm-on');
      shake(680);
    }
    if (k === 'storm_off'){
      DOC.body.classList.remove('storm-on');
      DOC.body.classList.remove('storm-shake');
    }
  }, {passive:true});

})();