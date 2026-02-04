// === /herohealth/vr/particles.js ===
// HHA Particles / FX Core — PRODUCTION (DOM-based, zero deps)
// ✅ Creates .hha-fx-layer (z-index 260; pointer-events none)
// ✅ Exposes: window.HHA_FX.burst(x,y,kind), popText(x,y,text), ping(x,y)
// ✅ Also exposes: window.Particles (alias) + window.GAME_MODULES.Particles (compat)
// ✅ Smart position source:
//    - remembers last pointerdown on .gj-target (hit location)
//    - remembers last hha:shoot x/y (crosshair shot point)
// ✅ Auto-wires: hha:judge -> spawn FX at last known point
// ✅ Safe: never throws if DOM missing

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_PARTICLES__) return;
  WIN.__HHA_PARTICLES__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(!layer){
      layer = DOC.createElement('div');
      layer.className = 'hha-fx-layer';
      DOC.body.appendChild(layer);
    }
    // defensive styling (in case CSS loads late)
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '260';
    return layer;
  }

  function mk(tag, cls){
    const el = DOC.createElement(tag);
    if(cls) el.className = cls;
    return el;
  }

  function setPos(el, x, y){
    el.style.position = 'absolute';
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    el.style.transform = 'translate(-50%, -50%)';
  }

  function rand(min,max){ return min + Math.random()*(max-min); }

  // ---------------------------
  // FX primitives (DOM particles)
  // ---------------------------

  function burst(x, y, kind='good'){
    const layer = ensureLayer();

    // Burst ring
    const ring = mk('div', 'fx-ring');
    setPos(ring, x, y);
    ring.style.width = '14px';
    ring.style.height = '14px';
    ring.style.borderRadius = '999px';
    ring.style.border = '2px solid rgba(255,255,255,.55)';
    ring.style.opacity = '0.95';
    ring.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,.35))';
    ring.style.animation = 'hhaRing 240ms ease-out forwards';

    // Color hint by kind
    if(kind === 'bad' || kind === 'junk'){
      ring.style.border = '2px solid rgba(239,68,68,.75)';
    } else if(kind === 'miss'){
      ring.style.border = '2px solid rgba(251,191,36,.75)';
    } else if(kind === 'perfect' || kind === 'star' || kind === 'shield'){
      ring.style.border = '2px solid rgba(56,189,248,.80)';
    } else {
      ring.style.border = '2px solid rgba(34,197,94,.80)';
    }

    layer.appendChild(ring);

    // Particles
    const n = (kind === 'perfect') ? 14 : 10;
    for(let i=0;i<n;i++){
      const p = mk('div', 'fx-dot');
      setPos(p, x, y);

      const s = rand(5, 9);
      p.style.width = s + 'px';
      p.style.height = s + 'px';
      p.style.borderRadius = '999px';
      p.style.opacity = '0.95';
      p.style.filter = 'drop-shadow(0 10px 18px rgba(0,0,0,.35))';

      if(kind === 'bad' || kind === 'junk') p.style.background = 'rgba(239,68,68,.92)';
      else if(kind === 'miss') p.style.background = 'rgba(251,191,36,.92)';
      else if(kind === 'perfect' || kind === 'star' || kind === 'shield') p.style.background = 'rgba(56,189,248,.92)';
      else p.style.background = 'rgba(34,197,94,.92)';

      const dx = rand(-1,1) * rand(26, 54);
      const dy = rand(-1,1) * rand(22, 48);

      p.style.animation = `hhaDot 280ms ease-out forwards`;
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');

      layer.appendChild(p);

      setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 420);
    }

    setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, 420);
  }

  function popText(x, y, text){
    const layer = ensureLayer();
    const t = mk('div', 'fx-text');
    setPos(t, x, y);
    t.textContent = String(text || '');
    t.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif';
    t.style.fontWeight = '1000';
    t.style.fontSize = '14px';
    t.style.padding = '6px 10px';
    t.style.borderRadius = '999px';
    t.style.background = 'rgba(2,6,23,.55)';
    t.style.border = '1px solid rgba(148,163,184,.22)';
    t.style.color = 'rgba(229,231,235,.92)';
    t.style.backdropFilter = 'blur(8px)';
    t.style.animation = 'hhaText 520ms ease-out forwards';
    layer.appendChild(t);
    setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 650);
  }

  function ping(x,y){
    const layer = ensureLayer();
    const d = mk('div','fx-ping');
    setPos(d,x,y);
    d.style.width = '10px';
    d.style.height = '10px';
    d.style.borderRadius = '999px';
    d.style.background = 'rgba(255,255,255,.75)';
    d.style.animation = 'hhaPing 180ms ease-out forwards';
    layer.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 240);
  }

  // ---------------------------
  // Auto wiring: remember last hit/shoot point
  // ---------------------------
  const LAST = {
    x: null, y: null,
    t: 0,
    source: ''
  };

  function remember(x, y, source){
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    LAST.x = x; LAST.y = y;
    LAST.t = nowMs();
    LAST.source = source || '';
  }

  // 1) When user taps/clicks a target (pointerdown), remember exact point
  DOC.addEventListener('pointerdown', (e)=>{
    const el = e.target;
    if(!el) return;
    // Only remember for GoodJunk targets (class gj-target)
    if(el.classList && el.classList.contains('gj-target')){
      remember(e.clientX, e.clientY, 'target');
    }
  }, { capture:true, passive:true });

  // 2) When user shoots (crosshair), remember shoot point (if provided)
  WIN.addEventListener('hha:shoot', (e)=>{
    const x = Number(e?.detail?.x);
    const y = Number(e?.detail?.y);
    if(Number.isFinite(x) && Number.isFinite(y)){
      remember(x, y, 'shoot');
    }else{
      // fallback: center
      const r = DOC.documentElement.getBoundingClientRect();
      remember(r.left + r.width/2, r.top + r.height/2, 'shoot-center');
    }
  }, { passive:true });

  // 3) When engine judges (hit/miss), render FX at last remembered point
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const type = String(d.type || '').toLowerCase(); // good/bad/miss/perfect
    const label = d.label || '';

    // Use last point if recent enough; else center
    const tAge = nowMs() - (LAST.t || 0);
    let x = LAST.x, y = LAST.y;
    if(!Number.isFinite(x) || !Number.isFinite(y) || tAge > 900){
      const r = DOC.documentElement.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top + r.height/2;
    }

    // Burst + tiny label
    burst(x, y, type);
    if(label) popText(x, y - 28, label);
  }, { passive:true });

  // ---------------------------
  // Install keyframes (only once)
  // ---------------------------
  function installCss(){
    if(DOC.getElementById('hha-fx-css')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-fx-css';
    st.textContent = `
      @keyframes hhaRing{
        from{ transform:translate(-50%,-50%) scale(.85); opacity:.95; }
        to  { transform:translate(-50%,-50%) scale(3.2); opacity:0; }
      }
      @keyframes hhaDot{
        from{ transform:translate(-50%,-50%) scale(1); opacity:.95; }
        to  { transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.65); opacity:0; }
      }
      @keyframes hhaText{
        from{ transform:translate(-50%,-50%) translateY(0); opacity:0; }
        20% { opacity:1; }
        to  { transform:translate(-50%,-50%) translateY(-26px); opacity:0; }
      }
      @keyframes hhaPing{
        from{ transform:translate(-50%,-50%) scale(.9); opacity:.85; }
        to  { transform:translate(-50%,-50%) scale(1.6); opacity:0; }
      }
    `;
    DOC.head.appendChild(st);
  }

  installCss();
  ensureLayer();

  // Public API
  const API = Object.freeze({ burst, popText, ping });

  // Expose (compat with your boot waitForFxCore)
  WIN.HHA_FX = API;
  WIN.Particles = API;
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.Particles = API;
})();