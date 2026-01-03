// === /herohealth/vr-groups/effects-pack.js ===
// PACK 16: Ultra FX Pack — PRODUCTION
// ✅ Body FX classes: fx-hit/good/bad/block/perfect/combo/storm/boss/end/miss
// ✅ Shockwave DOM layer + optional Particles integration
// ✅ Works in cVR (shoot) via detail.x/detail.y fallback to center
// ✅ Mini urgent + boss heartbeat + subtle screen kick (safe)

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;
  if (!DOC) return;

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

  function getXY(detail, fallbackEvent){
    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;

    // ✅ preferred explicit x/y (cVR shoot)
    if (detail && typeof detail.x === 'number' && typeof detail.y === 'number'){
      return { x: detail.x, y: detail.y };
    }

    // pointer event
    const ev = (detail && detail.ev) ? detail.ev : fallbackEvent;
    if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number'){
      return { x: ev.clientX, y: ev.clientY };
    }

    return { x: cx, y: cy };
  }

  // ---------- optional Particles.js ----------
  function P(){
    return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
  }
  function popText(x,y,text,cls=''){
    try{
      const p = P();
      if (p && typeof p.popText==='function') p.popText(x,y,text,cls);
    }catch(_){}
  }
  function burst(x,y,n=18){
    try{
      const p = P();
      if (p && typeof p.burst==='function') p.burst(x,y,n);
    }catch(_){}
  }
  function celebrate(){
    try{
      const p = P();
      if (p && typeof p.celebrate==='function') p.celebrate();
    }catch(_){}
  }

  function vib(pattern){
    try{ if (navigator.vibrate) navigator.vibrate(pattern); }catch(_){}
  }

  // ---------- hooks ----------
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    const {x,y} = getXY(d, ev);

    if (k==='good'){
      addCls('fx-hit', 140);
      addCls('fx-good', 220);
      shockwave(x,y,'green');
      popText(x,y, String(d.text||'+'), 'fxTextGood');
      burst(x,y, 16);
      vib(12);
      return;
    }

    if (k==='bad'){
      addCls('fx-hit', 160);
      addCls('fx-bad', 260);
      shockwave(x,y,'red');
      burst(x,y, 10);
      vib([20,40,20]);
      return;
    }

    if (k==='block'){
      addCls('fx-hit', 120);
      addCls('fx-block', 240);
      shockwave(x,y,'cyan');
      popText(x,y,'BLOCK','fxTextBlock');
      burst(x,y, 14);
      vib([12,20,12]);
      return;
    }

    if (k==='perfect'){
      addCls('fx-perfect', 520);
      shockwave(x,y,'violet');
      popText(x,y,'PERFECT','fxTextPerfect');
      burst(x,y, 22);
      vib([18,28,18]);
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

    if (k==='streak' || k==='combo'){
      addCls('fx-combo', 420);
      celebrate();
      return;
    }

    if (k==='miss'){
      addCls('fx-miss', 180);
      vib(10);
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
      popText(WIN.innerWidth*0.5, WIN.innerHeight*0.55, 'SWITCH!', 'fxTextPerfect');
      burst(WIN.innerWidth*0.5, WIN.innerHeight*0.55, 18);
    }
  }, {passive:true});

  // end celebration
  WIN.addEventListener('hha:end', ()=>{
    addCls('fx-end', 900);
    celebrate();
    vib([20,60,20]);
  }, {passive:true});

})();