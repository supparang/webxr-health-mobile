// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA FX Layer (shared for ALL games)
// ✅ Provides: window.Particles + window.GAME_MODULES.Particles
// ✅ FX: popText, burstAt, ringPulse, shockwave, screenFlash, celebrate
// ✅ Safe: inject style once, layer ensure once, robust DOM guards
// ✅ No external deps, low overhead, z-index isolated

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  // -------------------- helpers --------------------
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const now = () => (root.performance ? root.performance.now() : Date.now());

  function px(n){ return `${Math.round(Number(n)||0)}px`; }
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:190',          // below vr-ui buttons (usually 200+), above HUD (100-180)
      'overflow:hidden',
      'contain:layout paint style',
      'mix-blend-mode:normal'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if (doc.getElementById('hhaFxStyle')) return;
    const st = doc.createElement('style');
    st.id = 'hhaFxStyle';
    st.textContent = `
      .hha-fx-layer{ -webkit-font-smoothing:antialiased; }
      .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 30px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 520ms ease-out forwards;
        user-select:none;
        white-space:nowrap;
      }
      .hha-fx-pop.small{ font-size:14px; opacity:.95; }
      .hha-fx-pop.big{ font-size:22px; letter-spacing:.5px; }
      .hha-fx-pop.good{ filter: drop-shadow(0 0 12px rgba(34,197,94,.35)); }
      .hha-fx-pop.bad{  filter: drop-shadow(0 0 14px rgba(239,68,68,.40)); }
      .hha-fx-pop.warn{ filter: drop-shadow(0 0 14px rgba(245,158,11,.38)); }
      .hha-fx-pop.cyan{ filter: drop-shadow(0 0 14px rgba(34,211,238,.35)); }
      .hha-fx-pop.violet{ filter: drop-shadow(0 0 14px rgba(167,139,250,.36)); }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.90; filter: blur(.2px); }
        55%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; filter: blur(0); }
        100%{ transform:translate(-50%,-102%) scale(1.06); opacity:0; filter: blur(.6px); }
      }

      .hha-fx-dot{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        transform:translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaDot 520ms ease-out forwards;
      }
      @keyframes hhaDot{
        0%{ opacity:.95; transform:translate(-50%,-50%) scale(.9); }
        100%{ opacity:0; transform:translate(var(--dx), var(--dy)) scale(.3); }
      }

      .hha-fx-ring{
        position:absolute;
        border-radius:999px;
        transform:translate(-50%,-50%) scale(.75);
        opacity:.92;
        border: 2px solid rgba(255,255,255,.7);
        box-shadow: 0 0 0 2px rgba(255,255,255,.06) inset;
        will-change: transform, opacity;
        animation: hhaRing 520ms ease-out forwards;
      }
      .hha-fx-ring.good{ border-color: rgba(34,197,94,.92); box-shadow: 0 0 22px rgba(34,197,94,.22); }
      .hha-fx-ring.bad{ border-color: rgba(239,68,68,.92); box-shadow: 0 0 22px rgba(239,68,68,.22); }
      .hha-fx-ring.warn{ border-color: rgba(245,158,11,.92); box-shadow: 0 0 22px rgba(245,158,11,.22); }
      .hha-fx-ring.cyan{ border-color: rgba(34,211,238,.92); box-shadow: 0 0 22px rgba(34,211,238,.22); }
      .hha-fx-ring.violet{ border-color: rgba(167,139,250,.92); box-shadow: 0 0 22px rgba(167,139,250,.22); }
      @keyframes hhaRing{
        0%{ opacity:.95; transform:translate(-50%,-50%) scale(.72); }
        70%{ opacity:.65; transform:translate(-50%,-50%) scale(1.18); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.35); }
      }

      .hha-fx-shock{
        position:absolute;
        border-radius:999px;
        transform:translate(-50%,-50%) scale(.25);
        opacity:.95;
        border: 3px solid rgba(255,255,255,.75);
        filter: blur(.2px);
        will-change: transform, opacity;
        animation: hhaShock 620ms cubic-bezier(.16,.84,.2,1) forwards;
      }
      @keyframes hhaShock{
        0%{ opacity:.95; transform:translate(-50%,-50%) scale(.22); }
        60%{ opacity:.55; transform:translate(-50%,-50%) scale(1.05); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.35); }
      }

      .hha-fx-flash{
        position:fixed;
        inset:0;
        opacity:0;
        will-change: opacity;
        animation: hhaFlash 240ms ease-out forwards;
        pointer-events:none;
      }
      @keyframes hhaFlash{
        0%{ opacity:0; }
        40%{ opacity:var(--a); }
        100%{ opacity:0; }
      }

      .hha-fx-celebrate{
        position:absolute;
        width:10px; height:10px;
        border-radius:4px;
        transform:translate(-50%,-50%) rotate(var(--rot));
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaConfetti 980ms cubic-bezier(.12,.82,.25,1) forwards;
      }
      @keyframes hhaConfetti{
        0%{ opacity:.95; transform:translate(-50%,-50%) rotate(var(--rot)) scale(1); }
        100%{ opacity:0; transform:translate(var(--dx), var(--dy)) rotate(calc(var(--rot) + 220deg)) scale(.9); }
      }
    `;
    doc.head.appendChild(st);
  }

  function addEl(el, ttlMs){
    ensureStyle();
    const layer = ensureLayer();
    layer.appendChild(el);
    const ttl = clamp(Number(ttlMs)||600, 80, 8000);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ttl);
    return el;
  }

  // -------------------- public FX --------------------
  function popText(x, y, text, cls=null, opts=null){
    try{
      const el = doc.createElement('div');
      el.className = 'hha-fx-pop' +
        (cls ? ` ${cls}` : '') +
        ((opts && opts.size >= 22) ? ' big' : (opts && opts.size <= 14) ? ' small' : '');
      el.textContent = String(text ?? '');
      el.style.left = px(x);
      el.style.top  = px(y);
      if(opts && opts.size) el.style.fontSize = px(opts.size);
      addEl(el, 700);
      return el;
    }catch(_){ return null; }
  }

  function burstAt(x, y, kind='good', opts=null){
    try{
      const n = clamp((opts && opts.count) ? opts.count : 12, 4, 28);
      for(let i=0;i<n;i++){
        const el = doc.createElement('div');
        el.className = 'hha-fx-dot';
        el.style.left = px(x);
        el.style.top  = px(y);

        // color by kind (no hardcoded palette in CSS; we set inline for reliability)
        let c = 'rgba(255,255,255,.95)';
        if(kind==='good') c = 'rgba(34,197,94,.95)';
        else if(kind==='bad') c = 'rgba(239,68,68,.95)';
        else if(kind==='warn') c = 'rgba(245,158,11,.95)';
        else if(kind==='cyan' || kind==='shield') c = 'rgba(34,211,238,.95)';
        else if(kind==='violet' || kind==='diamond') c = 'rgba(167,139,250,.95)';
        else if(kind==='star') c = 'rgba(255,221,99,.95)';

        const s = clamp((opts && opts.size) ? opts.size : rnd(7, 14), 5, 18);
        el.style.width = px(s);
        el.style.height = px(s);
        el.style.background = c;

        const dx = rnd(-110, 110);
        const dy = rnd(-140, 60);
        el.style.setProperty('--dx', px(x + dx));
        el.style.setProperty('--dy', px(y + dy));
        addEl(el, 650);
      }
    }catch(_){}
  }

  function ringPulse(x, y, kind='good', opts=null){
    try{
      const size = clamp((opts && opts.size) ? opts.size : 160, 80, 420);
      const el = doc.createElement('div');
      el.className = `hha-fx-ring ${kind||''}`.trim();
      el.style.left = px(x);
      el.style.top  = px(y);
      el.style.width = px(size);
      el.style.height = px(size);
      if(opts && opts.borderPx) el.style.borderWidth = px(opts.borderPx);
      addEl(el, 700);
      return el;
    }catch(_){ return null; }
  }

  function shockwave(x, y, kind='warn', opts=null){
    try{
      const size = clamp((opts && opts.size) ? opts.size : 360, 180, 820);
      const el = doc.createElement('div');
      el.className = 'hha-fx-shock';
      el.style.left = px(x);
      el.style.top  = px(y);
      el.style.width = px(size);
      el.style.height = px(size);

      // tint (inline)
      let c = 'rgba(255,255,255,.75)';
      if(kind==='good') c = 'rgba(34,197,94,.82)';
      else if(kind==='bad') c = 'rgba(239,68,68,.82)';
      else if(kind==='warn') c = 'rgba(245,158,11,.82)';
      else if(kind==='cyan' || kind==='shield') c = 'rgba(34,211,238,.82)';
      else if(kind==='violet') c = 'rgba(167,139,250,.82)';
      el.style.borderColor = c;

      addEl(el, 900);
      return el;
    }catch(_){ return null; }
  }

  function screenFlash(kind='warn', opts=null){
    try{
      const el = doc.createElement('div');
      el.className = 'hha-fx-flash';

      let bg = 'rgba(255,255,255,.10)';
      if(kind==='good') bg = 'rgba(34,197,94,.16)';
      else if(kind==='bad') bg = 'rgba(239,68,68,.18)';
      else if(kind==='warn') bg = 'rgba(245,158,11,.18)';
      else if(kind==='cyan') bg = 'rgba(34,211,238,.16)';
      else if(kind==='violet') bg = 'rgba(167,139,250,.16)';

      const a = clamp((opts && opts.alpha) ? opts.alpha : 0.22, 0.06, 0.45);
      el.style.background = bg;
      el.style.setProperty('--a', String(a));

      // flash goes to body not layer (covers all)
      doc.body.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 420);
      return el;
    }catch(_){ return null; }
  }

  function celebrate(kind='win', opts=null){
    try{
      const layer = ensureLayer();
      ensureStyle();

      const W = doc.documentElement.clientWidth || 800;
      const H = doc.documentElement.clientHeight || 600;
      const count = clamp((opts && opts.count) ? opts.count : (kind==='win'? 46 : 24), 12, 90);

      // palette by kind
      const pal = (()=>{
        if(kind==='boss') return [
          'rgba(167,139,250,.95)','rgba(34,211,238,.95)','rgba(245,158,11,.95)','rgba(255,255,255,.92)'
        ];
        if(kind==='mini') return [
          'rgba(34,197,94,.95)','rgba(255,221,99,.95)','rgba(34,211,238,.95)','rgba(255,255,255,.92)'
        ];
        if(kind==='fail') return [
          'rgba(239,68,68,.92)','rgba(245,158,11,.85)','rgba(255,255,255,.85)'
        ];
        return [
          'rgba(34,197,94,.95)','rgba(167,139,250,.92)','rgba(34,211,238,.92)','rgba(245,158,11,.92)','rgba(255,255,255,.90)'
        ];
      })();

      const t0 = now();
      for(let i=0;i<count;i++){
        const el = doc.createElement('div');
        el.className = 'hha-fx-celebrate';
        const x = rnd(W*0.15, W*0.85);
        const y = rnd(H*0.10, H*0.25);
        el.style.left = px(x);
        el.style.top  = px(y);
        el.style.background = pal[irnd(0, pal.length-1)];

        const rot = `${irnd(-40, 40)}deg`;
        el.style.setProperty('--rot', rot);

        const dx = x + rnd(-260, 260);
        const dy = y + rnd(220, 520);
        el.style.setProperty('--dx', px(dx));
        el.style.setProperty('--dy', px(dy));

        const s = rnd(0.9, 1.6);
        el.style.width = px(8*s);
        el.style.height = px(12*s);

        // stagger a little
        const delay = rnd(0, 180);
        el.style.animationDelay = `${delay}ms`;

        layer.appendChild(el);
        setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 1400 + delay);
      }

      // small flash for feedback
      if(kind==='win' || kind==='boss') screenFlash('good', { alpha: 0.14 });
      else if(kind==='fail') screenFlash('bad', { alpha: 0.14 });

      return { t0, count };
    }catch(_){ return null; }
  }

  // -------------------- expose --------------------
  const API = {
    ensureLayer,
    popText,
    burstAt,
    ringPulse,
    shockwave,
    screenFlash,
    celebrate,
  };

  root.Particles = root.Particles || {};
  Object.assign(root.Particles, API);

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.GAME_MODULES.Particles || {};
  Object.assign(root.GAME_MODULES.Particles, API);

})(window);