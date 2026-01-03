/* === /herohealth/vr-groups/slowmo-micro.js ===
PACK 44: Slow-mo Micro — PRODUCTION
✅ Visual slowmo only (CSS class), does NOT affect time/game logic
✅ Triggers on boss down / perfect / SSS moment
✅ FXPerf gate = 3 only
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

  let tmr = 0;
  function pulse(ms){
    if (!allow(3)) return;
    clearTimeout(tmr);
    DOC.body.classList.add('fx-slowmo');
    tmr = setTimeout(()=>DOC.body.classList.remove('fx-slowmo'), ms||260);
  }

  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k === 'boss_down') pulse(280);
  }, {passive:true});

  root.addEventListener('hha:judge', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k === 'perfect') pulse(240);
  }, {passive:true});

  // works with PACK42 end moment
  root.addEventListener('hha:end', (ev)=>{
    const g = String((ev.detail||{}).grade||'').toUpperCase();
    if (g==='SSS') pulse(420);
  }, {passive:true});

})();