// === /herohealth/vr-groups/time-warp.js ===
// PACK 61: Hit Time-Warp (play-only)
// Trigger: streak hits within window -> slow motion + FX
// Safe: no effect in research

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function addCls(c, ms){
    try{ DOC.body.classList.add(c); setTimeout(()=>DOC.body.classList.remove(c), ms||240); }catch(_){}
  }

  function hasParticles(){
    const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
    return !!P;
  }
  function burst(x,y,n){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.burst && P.burst(x,y,n||26);
    }catch(_){}
  }
  function popText(x,y,text,cls){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      P && P.popText && P.popText(x,y,text,cls||'');
    }catch(_){}
  }

  // Warp controller: modifies engine tick speed
  const Warp = {
    on:false,
    until:0,
    factor:0.55,      // 0.55x speed (slow)
    durMs:650,        // short, punchy
    lastHitAt:0,
    streak:0,
    winMs:680,        // hits must be within this window
    need:3            // 3 hits -> warp
  };

  function xyFrom(ev){
    const cx = (WIN.innerWidth||360)/2, cy = (WIN.innerHeight||640)/2;
    try{
      if (ev && typeof ev.clientX==='number') return {x:ev.clientX,y:ev.clientY};
      const d = ev && ev.detail ? ev.detail : null;
      if (d && d.ev && typeof d.ev.clientX==='number') return {x:d.ev.clientX,y:d.ev.clientY};
    }catch(_){}
    return {x:cx,y:cy};
  }

  // Expose a tiny hook to engine
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.TimeWarp = {
    isActive: ()=> Warp.on && (performance.now?performance.now():Date.now()) < Warp.until,
    factor: ()=> Warp.factor,
    // Engine calls this to scale dt (play only)
    scaleDt: (dt, runMode)=>{
      if (String(runMode||'play') !== 'play') return dt;
      const t = (performance.now?performance.now():Date.now());
      if (Warp.on && t < Warp.until) return dt * Warp.factor;
      if (Warp.on && t >= Warp.until){ Warp.on=false; DOC.body.classList.remove('fx-warp'); }
      return dt;
    }
  };

  function triggerWarp(atXY){
    const t = (performance.now?performance.now():Date.now());
    Warp.on = true;
    Warp.until = t + Warp.durMs;

    addCls('fx-warp', Warp.durMs + 120);
    addCls('fx-perfect', 520);

    const x = atXY.x, y = atXY.y;
    if (hasParticles()){
      popText(x,y,'TIME WARP','fx-warp');
      burst(x,y,34);
    }
    try{ navigator.vibrate && navigator.vibrate([18,22,18,36,18]); }catch(_){}
  }

  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();

    // only count "good" + "boss down" moments
    if (k !== 'good' && k !== 'boss') return;

    // If kind=boss but it's just tick hurt, still allow but weaker:
    // (optional) treat as hit
    const t = (performance.now?performance.now():Date.now());

    if (t - Warp.lastHitAt <= Warp.winMs) Warp.streak += 1;
    else Warp.streak = 1;

    Warp.lastHitAt = t;

    if (Warp.streak >= Warp.need){
      Warp.streak = 0;
      triggerWarp(xyFrom(ev));
    }
  }, {passive:true});

})();