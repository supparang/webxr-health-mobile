// === /herohealth/vr-groups/effects-pack-17.js ===
// PACK 17: Aim-sparkle (cVR), Boss weak warn, End rank reveal
// Optional: particles.js

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function hasParticles(){
    const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
    return !!P;
  }
  function burst(x,y,n=16){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }
  function popText(x,y,t,cls=''){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.popText==='function') P.popText(x,y,t,cls);
    }catch(_){}
  }

  function addCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||260);
    }catch(_){}
  }

  // --- determine view ---
  function isCVR(){
    const cls = DOC.body.className || '';
    if (cls.includes('view-cvr')) return true;
    try{
      const v = new URL(location.href).searchParams.get('view') || '';
      return String(v).toLowerCase().includes('cvr');
    }catch{ return false; }
  }

  // --- center position ---
  function centerXY(){
    return { x: WIN.innerWidth/2, y: WIN.innerHeight/2 };
  }

  // --- Aim sparkle on successful hit in cVR (judge good/boss) ---
  WIN.addEventListener('hha:judge', (ev)=>{
    if (!isCVR()) return;

    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    if (k !== 'good' && k !== 'boss') return;

    const {x,y} = centerXY();

    addCls('fx-aim', 260);

    // particles burst at crosshair (looks like sparkle)
    if (hasParticles()){
      burst(x,y, (k==='boss') ? 26 : 18);
      popText(x,y, (k==='boss') ? 'HIT!' : '+', '');
    }

    try{ navigator.vibrate && navigator.vibrate(k==='boss' ? 18 : 10); }catch{}
  }, {passive:true});

  // --- Boss weak warning (engine adds fg-boss-weak class on target) ---
  // We listen for judge boss and check if any boss has weak class.
  let warned = false;
  WIN.addEventListener('hha:judge', ()=>{
    try{
      const weak = DOC.querySelector('.fg-boss.fg-boss-weak');
      if (weak && !warned){
        warned = true;
        addCls('fx-boss-weak', 900);
        if (hasParticles()){
          const r = weak.getBoundingClientRect();
          burst(r.left + r.width/2, r.top + r.height/2, 22);
          popText(r.left + r.width/2, r.top + r.height/2, 'ALMOST!', '');
        }
        setTimeout(()=>{ warned = false; }, 650);
      }
    }catch(_){}
  }, {passive:true});

  // --- End rank reveal animation ---
  WIN.addEventListener('hha:end', ()=>{
    addCls('fx-rank-reveal', 1200);
  }, {passive:true});

})();