/* === /herohealth/vr-groups/boss-phase2-fx.js ===
PACK 38: Boss Phase2 FX — PRODUCTION
✅ Rage glow + shake pulse on boss_phase2
✅ Bonus popup on boss_down_phase2
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

  function hasParticles(){
    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
    return !!P;
  }
  function pop(x,y,text){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.popText==='function') P.popText(x,y,text,'');
    }catch(_){}
  }
  function celebrate(){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }

  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='boss_phase2' && allow(2)){
      DOC.body.classList.add('fx-boss2');
      setTimeout(()=>DOC.body.classList.remove('fx-boss2'), 980);
      try{ navigator.vibrate && navigator.vibrate([20,60,20]); }catch(_){}
    }
    if (k==='boss_down_phase2' && allow(2)){
      if (hasParticles()){
        pop(innerWidth*0.5, innerHeight*0.38, 'DANGER +120');
        celebrate();
      }
    }
  }, {passive:true});

})(typeof window!=='undefined'?window:globalThis);