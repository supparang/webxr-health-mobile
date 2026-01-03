/* === /herohealth/vr-groups/combo-ladder.js ===
PACK 42: Combo Ladder + SSS Moment — PRODUCTION
✅ Reads hha:score (combo) + hha:rank (grade)
✅ Emits hha:judge kind=streak/perfect to drive effects-pack
✅ Uses Particles popText/celebrate if available and FX level allows
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

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

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

  const marks = [
    { c:6,  label:'NICE!' },
    { c:10, label:'HOT!' },
    { c:14, label:'INSANE!' },
    { c:18, label:'GODLIKE!' }
  ];

  let lastCombo = 0;
  let fired = {};

  function onCombo(combo){
    combo = Number(combo)||0;
    if (combo < lastCombo) { fired = {}; } // reset when combo breaks
    lastCombo = combo;

    for (const m of marks){
      if (combo >= m.c && !fired[m.c]){
        fired[m.c] = true;

        // drive existing effects-pack
        emit('hha:judge', { kind:'streak', text:m.label });

        if (allow(2) && hasParticles()){
          pop(innerWidth*0.5, innerHeight*0.42, m.label);
          if (allow(3) && m.c >= 14) celebrate();
        }
      }
    }
  }

  // listen score
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    onCombo(d.combo);
  }, {passive:true});

  // SSS moment on end: if grade S/SS/SSS
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    const g = String(d.grade||'').toUpperCase();
    if (!allow(2)) return;

    if (g === 'S' || g === 'SS' || g === 'SSS'){
      emit('hha:judge', { kind:'perfect', text:`${g} MOMENT` });
      if (hasParticles()){
        pop(innerWidth*0.5, innerHeight*0.32, `${g} MOMENT`);
        if (allow(3)) celebrate();
      }
      DOC.body.classList.add('fx-sss');
      setTimeout(()=>DOC.body.classList.remove('fx-sss'), 1100);
    }
  }, {passive:true});

})();