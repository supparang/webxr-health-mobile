// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// ✅ listens: hha:judge, hha:celebrate
// ✅ adds body pulses: gj-mini-clear, gj-junk-hit, gj-boss-bonk, etc
// ✅ optional: route judge labels to Particles.popText

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const P = ()=> (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;

  function pulseBody(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms||180);
    }catch(_){}
  }

  function popCenter(text, cls){
    const p = P();
    if(!p || typeof p.popText!=='function') return;
    const x = DOC.documentElement.clientWidth/2;
    const y = DOC.documentElement.clientHeight*0.22;
    p.popText(x,y,text,cls||'hha-judge');
  }

  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev?.detail || {};
    const label = String(d.label||'').trim();
    if(!label) return;

    // map -> body pulses
    if(label.includes('MINI')) pulseBody('gj-mini-clear', 220);
    if(label.includes('OOPS') || label.includes('MISS')) pulseBody('gj-junk-hit', 220);
    if(label.includes('BOSS')) pulseBody('gj-boss-on', 240);
    if(label.includes('PHASE')) pulseBody('gj-phase', 260);
    if(label.includes('RAGE')) pulseBody('gj-rage-pulse', 260);

    // pop
    popCenter(label, 'hha-judge');
  }, { passive:true });

  WIN.addEventListener('hha:celebrate', (ev)=>{
    const kind = ev?.detail?.kind || 'end';
    const p = P();
    try{ p?.celebrate?.(kind); }catch(_){}
    if(kind==='boss') pulseBody('gj-boss-down', 420);
    if(kind==='mini') pulseBody('gj-mini-clear', 220);
  }, { passive:true });

})();