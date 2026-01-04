// === C: /herohealth/vr-groups/effects-pack.js ===
// Ultra FX Pack — PRODUCTION (safe)
// - Body FX classes: fx-hit/fx-good/fx-bad/fx-block/fx-perfect/fx-combo/fx-storm/fx-boss/fx-end/fx-miss
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

  function xyFromDetail(d){
    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
    if (d && typeof d.x === 'number' && typeof d.y === 'number') return {x:d.x, y:d.y};
    if (d && d.ev && typeof d.ev.clientX === 'number') return {x:d.ev.clientX, y:d.ev.clientY};
    return {x:cx, y:cy};
  }

  // ---------- optional Particles.js ----------
  function getParticles(){
    return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
  }
  function hasParticles(){
    const P = getParticles();
    return !!P;
  }
  function popText(x,y,text,cls=''){
    try{
      const P = getParticles();
      if (P && typeof P.popText==='function') P.popText(x,y,text,cls);
    }catch(_){}
  }
  function burst(x,y,n=18){
    try{
      const P = getParticles();
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }
  function celebrate(){
    try{
      const P = getParticles();
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }

  // ---------- inject minimal CSS for shockwaves (so FX always visible) ----------
  (function injectCss(){
    if (DOC.querySelector('#groupsFxPackCss')) return;
    const st = DOC.createElement('style');
    st.id = 'groupsFxPackCss';
    st.textContent = `
      .groups-fx-layer .fx-shock{
        position:absolute;
        width:16px; height:16px;
        border-radius:999px;
        transform: translate(-50%,-50%) scale(0.8);
        opacity:0.85;
        pointer-events:none;
        filter: blur(0.2px);
        animation: fxShock .52s ease-out forwards;
      }
      .fx-shock.fx-green{ box-shadow: 0 0 0 2px rgba(34,197,94,.55), 0 0 34px rgba(34,197,94,.25); }
      .fx-shock.fx-red{ box-shadow: 0 0 0 2px rgba(239,68,68,.58), 0 0 34px rgba(239,68,68,.25); }
      .fx-shock.fx-cyan{ box-shadow: 0 0 0 2px rgba(34,211,238,.58), 0 0 34px rgba(34,211,238,.25); }
      .fx-shock.fx-violet{ box-shadow: 0 0 0 2px rgba(167,139,250,.58), 0 0 34px rgba(167,139,250,.25); }
      @keyframes fxShock{
        0%{ transform: translate(-50%,-50%) scale(0.7); opacity:.85; }
        65%{ transform: translate(-50%,-50%) scale(8.5); opacity:.22; }
        100%{ transform: translate(-50%,-50%) scale(11.0); opacity:0; }
      }

      /* subtle screen kick via filter */
      body.fx-hit .playLayer{ filter: brightness(1.08) contrast(1.05); }
      body.fx-bad .playLayer{ filter: hue-rotate(-8deg) saturate(1.12); }
      body.fx-good .playLayer{ filter: saturate(1.08) brightness(1.06); }

      /* end flash */
      body.fx-end .playLayer{ filter: brightness(1.10) saturate(1.10); }
    `;
    DOC.head.appendChild(st);
  })();

  // ---------- hooks ----------
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    const {x,y} = xyFromDetail(d);

    if (k==='good'){
      addCls('fx-hit', 140);
      addCls('fx-good', 220);
      shockwave(x,y,'green');
      if (hasParticles()){
        popText(x,y,String(d.text||'+'),'');
        burst(x,y,16);
      }
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
      shockwave(x,y,'cyan');
      if (hasParticles()){ popText(x,y,'MISS',''); }
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
    if (k==='storm_on'){
      DOC.body.classList.add('groups-storm-on');
      setTimeout(()=>DOC.body.classList.remove('groups-storm-on'), 1200);
    }
    if (k==='boss_spawn'){
      DOC.body.classList.add('groups-boss-on');
      setTimeout(()=>DOC.body.classList.remove('groups-boss-on'), 1600);
    }
    if (k==='perfect_switch'){
      addCls('fx-perfect', 520);
    }
  }, {passive:true});

  // end celebration
  WIN.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) || {};
    if (String(d.runMode||'') === 'practice') return; // don't flash end for practice
    addCls('fx-end', 900);
    try{ if (hasParticles()) celebrate(); }catch{}
  }, {passive:true});

})();