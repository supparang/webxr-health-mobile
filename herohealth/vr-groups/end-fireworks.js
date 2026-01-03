/* === /herohealth/vr-groups/end-fireworks.js ===
PACK 45: End Fireworks + Highlights — PRODUCTION
✅ Adds highlight chips into end panel
✅ Uses Particles celebrate if available (FX=3)
✅ Safe if panel ids not found
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

  function hasParticles(){
    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
    return !!P;
  }
  function celebrate(){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }
  function popText(x,y,text){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.popText==='function') P.popText(x,y,text,'');
    }catch(_){}
  }

  function ensureHiWrap(panel){
    let w = panel.querySelector('.hiWrap');
    if (w) return w;
    w = DOC.createElement('div');
    w.className = 'hiWrap';
    w.innerHTML = `
      <div class="hiTitle">✨ Highlights</div>
      <div class="hiRow"></div>
    `;
    panel.insertBefore(w, panel.querySelector('.row') || null);
    return w;
  }

  function chip(row, icon, label){
    const c = DOC.createElement('div');
    c.className = 'hiChip';
    c.innerHTML = `<span class="hiI">${icon}</span><span class="hiT">${label}</span>`;
    row.appendChild(c);
  }

  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail||{};
    const panel = DOC.querySelector('#endOverlay .panel') || DOC.querySelector('.overlay .panel');
    if (!panel) return;

    const wrap = ensureHiWrap(panel);
    const row = wrap.querySelector('.hiRow');
    if (!row) return;
    row.innerHTML = '';

    const comboMax = Number(d.comboMax||0);
    const acc = Number(d.accuracyGoodPct||0);
    const bosses = Number(d.bossDownCount||0);

    chip(row, '🔥', `Best Combo: ${comboMax}`);
    chip(row, '🎯', `Accuracy: ${acc}%`);
    chip(row, '👊', `Boss Down: ${bosses}`);

    // fireworks
    if (allow(3) && hasParticles()){
      celebrate();
      popText(innerWidth*0.5, innerHeight*0.26, 'GG!');
    } else if (allow(2) && hasParticles()){
      popText(innerWidth*0.5, innerHeight*0.26, 'GG!');
    }

    DOC.body.classList.add('fx-endparty');
    setTimeout(()=>DOC.body.classList.remove('fx-endparty'), 1200);

  }, {passive:true});

})();