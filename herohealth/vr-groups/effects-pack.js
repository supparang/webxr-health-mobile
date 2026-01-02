// === /herohealth/vr-groups/effects-pack.js ===
// Pack16: Ultra FX Pack — PRODUCTION
// - Body FX classes: hit/good/bad/block/perfect/combo/storm/boss/end
// - Shockwave DOM + (optional) Particles.js integration
// - Mini urgent + boss heartbeat + screen kick (subtle, safe)
// Requires: ../vr/particles.js (optional)

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  // ---------- helpers ----------
  function addCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }

  function ensureFxLayer(){
    let layer = DOC.querySelector('.groups-fx-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'groups-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:140;overflow:hidden;';
    DOC.body.appendChild(layer);
    return layer;
  }

  function shockwave(x,y, kind='cyan'){
    const layer = ensureFxLayer();
    const el = DOC.createElement('div');
    el.className = 'fx-shock fx-' + kind;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 520);
  }

  function xyFromEvent(ev){
    // pointer event -> center fallback
    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
    if (!ev) return {x:cx,y:cy};
    if (typeof ev.clientX === 'number') return {x:ev.clientX, y:ev.clientY};
    return {x:cx,y:cy};
  }

  // ---------- optional Particles.js ----------
  function hasParticles(){
    const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
    return !!P;
  }
  function popText(x,y,text,cls=''){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.popText==='function') P.popText(x,y,text,cls);
    }catch(_){}
  }
  function burst(x,y,n=18){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }
  function celebrate(){
    try{
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles);
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }

  // ---------- hooks ----------
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    const {x,y} = xyFromEvent(d.ev || ev);

    if (k==='good'){
      addCls('fx-hit', 140);
      addCls('fx-good', 220);
      shockwave(x,y,'green');
      if (hasParticles()){ popText(x,y,'+',''); burst(x,y,16); }
      try{ navigator.vibrate && navigator.vibrate(12); }catch{}
      return;
    }

    if (k==='bad'){
      addCls('fx-hit', 160);
      addCls('fx-bad', 260);
      shockwave(x,y,'red');
      if (hasParticles()){ burst(x,y,10); }
      try{ navigator.vibrate && navigator.vibrate([20,40,20]); }catch{}
      return;
    }

    if (k==='block'){
      addCls('fx-hit', 120);
      addCls('fx-block', 240);
      shockwave(x,y,'cyan');
      if (hasParticles()){ popText(x,y,'BLOCK',''); burst(x,y,14); }
      try{ navigator.vibrate && navigator.vibrate([12,20,12]); }catch{}
      return;
    }

    if (k==='perfect'){
      addCls('fx-perfect', 520);
      shockwave(x,y,'violet');
      if (hasParticles()){ popText(x,y,'PERFECT',''); burst(x,y,22); }
      try{ navigator.vibrate && navigator.vibrate([18,28,18]); }catch{}
      return;
    }

    if (k==='storm'){
      addCls('fx-storm', 900);
      return;
    }

    if (k==='boss'){
      addCls('fx-boss', 900);
      return;
    }

    if (k==='streak'){
      addCls('fx-combo', 420);
      if (hasParticles()){ celebrate(); }
      return;
    }

    if (k==='miss'){
      addCls('fx-miss', 180);
      return;
    }
  }, {passive:true});

  // urgent flags from quest:update
  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    DOC.body.classList.toggle('groups-mini-urgent', left>0 && left<=3);
  }, {passive:true});

  // groups progress
  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='storm_on'){ DOC.body.classList.add('groups-storm-on'); setTimeout(()=>DOC.body.classList.remove('groups-storm-on'), 1200); }
    if (k==='boss_spawn'){ DOC.body.classList.add('groups-boss-on'); setTimeout(()=>DOC.body.classList.remove('groups-boss-on'), 1600); }
    if (k==='perfect_switch'){ addCls('fx-perfect', 520); }
  }, {passive:true});

  // end celebration
  WIN.addEventListener('hha:end', ()=>{
    addCls('fx-end', 900);
    try{ if (hasParticles()) celebrate(); }catch{}
  }, {passive:true});

})();