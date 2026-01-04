/* === /herohealth/vr-groups/effects-pack.js ===
Ultra FX++ Pack — PRODUCTION
✅ hit/good/bad/block/perfect/combo/storm/boss/end + streak every 5
✅ shockwave DOM + optional Particles
✅ boss lowHP vignette + storm wind overlay
✅ subtle screen kick (safe)
*/
(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

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

  function ensureWind(){
    let el = DOC.querySelector('.fx-wind');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-wind';
    el.style.cssText = 'position:fixed;inset:-20%;pointer-events:none;z-index:135;opacity:0;';
    DOC.body.appendChild(el);
    return el;
  }

  function ensureVignette(){
    let el = DOC.querySelector('.fx-vignette');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-vignette';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:132;opacity:0;';
    DOC.body.appendChild(el);
    return el;
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

  function kick(px=6, ms=120){
    try{
      DOC.body.style.setProperty('--kickX', (Math.random()<0.5?-px:px) + 'px');
      DOC.body.style.setProperty('--kickY', (Math.random()<0.5?-px:px) + 'px');
      addCls('fx-kick', ms);
    }catch(_){}
  }

  function xyFromEvent(ev){
    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
    if (!ev) return {x:cx,y:cy};
    if (typeof ev.clientX === 'number') return {x:ev.clientX, y:ev.clientY};
    return {x:cx,y:cy};
  }

  // Particles (optional)
  function P(){
    return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
  }
  function popText(x,y,text,cls=''){ try{ const p=P(); p&&p.popText&&p.popText(x,y,text,cls); }catch(_){}
  }
  function burst(x,y,n=18){ try{ const p=P(); p&&p.burst&&p.burst(x,y,n); }catch(_){}
  }
  function celebrate(){ try{ const p=P(); p&&p.celebrate&&p.celebrate(); }catch(_){}
  }

  // streak detector
  let lastCombo = 0;
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    const c = Number(d.combo||0);
    if (c > 0 && c % 5 === 0 && c !== lastCombo){
      lastCombo = c;
      addCls('fx-combo', 520);
      celebrate();
      kick(8, 140);
      try{ navigator.vibrate && navigator.vibrate([10,20,10]); }catch{}
    }
  }, {passive:true});

  // judge -> main fx
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    const {x,y} = xyFromEvent(d.ev || ev);

    if (k==='good'){
      addCls('fx-hit', 140);
      addCls('fx-good', 220);
      shockwave(x,y,'green');
      popText(x,y, d.text || '+', '');
      burst(x,y,18);
      kick(5, 110);
      try{ navigator.vibrate && navigator.vibrate(10); }catch{}
      return;
    }

    if (k==='bad'){
      addCls('fx-hit', 160);
      addCls('fx-bad', 280);
      shockwave(x,y,'red');
      burst(x,y,12);
      kick(7, 140);
      try{ navigator.vibrate && navigator.vibrate([16,30,16]); }catch{}
      return;
    }

    if (k==='boss'){
      addCls('fx-boss', 900);
      shockwave(x,y,'violet');
      burst(x,y,16);
      kick(9, 160);
      try{ navigator.vibrate && navigator.vibrate([18,30,18]); }catch{}
      return;
    }

    if (k==='miss'){
      addCls('fx-miss', 220);
      kick(6, 120);
      return;
    }

    if (k==='perfect'){
      addCls('fx-perfect', 520);
      shockwave(x,y,'violet');
      popText(x,y,'PERFECT','');
      burst(x,y,24);
      celebrate();
      kick(10, 160);
      return;
    }

    if (k==='storm'){
      addCls('fx-storm', 900);
      shockwave(x,y,'cyan');
      return;
    }

    if (k==='streak'){
      addCls('fx-combo', 520);
      celebrate();
      return;
    }
  }, {passive:true});

  // quest urgency -> class already used
  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    DOC.body.classList.toggle('groups-mini-urgent', left>0 && left<=3);
  }, {passive:true});

  // storm/boss progress
  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();

    if (k==='storm_on'){
      DOC.body.classList.add('groups-storm-on');
      ensureWind().style.opacity = '1';
      addCls('fx-storm', 900);
      setTimeout(()=>{ DOC.body.classList.remove('groups-storm-on'); ensureWind().style.opacity='0'; }, 1200);
    }

    if (k==='boss_spawn'){
      DOC.body.classList.add('groups-boss-on');
      addCls('fx-boss', 1000);
      setTimeout(()=>DOC.body.classList.remove('groups-boss-on'), 1400);
    }

    if (k==='perfect_switch'){
      addCls('fx-perfect', 520);
      celebrate();
    }

    // OPTIONAL: if engine later emits boss_lowhp
    if (k==='boss_lowhp'){
      ensureVignette().style.opacity = '1';
      DOC.body.classList.add('fx-boss-low');
      setTimeout(()=>{ DOC.body.classList.remove('fx-boss-low'); ensureVignette().style.opacity='0'; }, 900);
    }
  }, {passive:true});

  // end
  WIN.addEventListener('hha:end', ()=>{
    addCls('fx-end', 900);
    celebrate();
  }, {passive:true});

})();