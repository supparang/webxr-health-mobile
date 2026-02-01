// === /herohealth/vr/particles.js ===
// HHA Particles / FX Core — PRODUCTION (SAFE)
// ✅ One global FX layer (.hha-fx-layer) with robust z-index
// ✅ Effects: popText, popEmoji, burst, confetti, ring, flash
// ✅ Safe: never throws; no dependencies
// ✅ Export: window.Particles (back-compat) + window.HHA_FX (preferred)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_PARTICLES_PROD__) return;
  root.__HHA_PARTICLES_PROD__ = true;

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();

  function safeAppend(parent, el){
    try{ parent.appendChild(el); }catch(_){}
  }
  function safeRemove(el){
    try{ el.remove(); }catch(_){}
  }

  // ---------- style injection (once) ----------
  function ensureStyle() {
    if (DOC.getElementById('hha-fx-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-fx-layer{
        position:fixed; inset:0;
        pointer-events:none;
        z-index:170; /* CSS can override with !important */
        overflow:hidden;
        contain: layout paint;
      }
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-fx-emoji{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 30px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        filter: drop-shadow(0 12px 22px rgba(0,0,0,.45));
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaEmoji 640ms cubic-bezier(.2,.9,.2,1) forwards;
      }
      .hha-fx-dot{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
      }
      .hha-fx-ring{
        position:absolute;
        width:20px; height:20px;
        border-radius:999px;
        border: 3px solid rgba(255,255,255,.55);
        box-shadow: 0 0 0 10px rgba(34,197,94,.12);
        transform: translate(-50%,-50%) scale(.6);
        opacity:.0;
        will-change: transform, opacity;
        animation: hhaRing 520ms ease-out forwards;
      }
      .hha-fx-flash{
        position:absolute;
        width:26px; height:26px;
        border-radius:999px;
        background: radial-gradient(circle at 40% 40%, rgba(255,255,255,.9), rgba(255,255,255,0));
        transform: translate(-50%,-50%) scale(.8);
        opacity:.0;
        animation: hhaFlash 220ms ease-out forwards;
        will-change: transform, opacity;
      }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.90; }
        70%{ transform:translate(-50%,-76%) scale(1.15); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.05); opacity:0; }
      }
      @keyframes hhaEmoji{
        0%{ transform:translate(-50%,-50%) scale(.75) rotate(-6deg); opacity:.0; }
        25%{ opacity:1; }
        70%{ transform:translate(-50%,-110%) scale(1.15) rotate(6deg); opacity:1; }
        100%{ transform:translate(-50%,-150%) scale(1.02) rotate(8deg); opacity:0; }
      }
      @keyframes hhaRing{
        0%{ transform:translate(-50%,-50%) scale(.65); opacity:.0; }
        15%{ opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(2.25); opacity:0; }
      }
      @keyframes hhaFlash{
        0%{ transform:translate(-50%,-50%) scale(.8); opacity:.0; }
        45%{ opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.45); opacity:0; }
      }

      /* Reduce motion */
      @media (prefers-reduced-motion: reduce){
        .hha-fx-pop,.hha-fx-emoji,.hha-fx-ring,.hha-fx-flash{ animation-duration: 1ms !important; }
      }
    `;
    safeAppend(DOC.head || DOC.documentElement, st);
  }

  // ---------- layer ----------
  function ensureLayer() {
    ensureStyle();

    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';

    // keep it robust even if CSS missing
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:170;overflow:hidden;';

    safeAppend(DOC.body || DOC.documentElement, layer);
    return layer;
  }

  // ---------- coordinate helpers ----------
  function toXY(x, y){
    // Allow:
    // - numbers (px)
    // - event objects {clientX,clientY}
    // - element (center)
    try{
      if (typeof x === 'object' && x){
        if ('clientX' in x && 'clientY' in x) return { x: x.clientX, y: x.clientY };
        if (x.getBoundingClientRect){
          const r = x.getBoundingClientRect();
          return { x: r.left + r.width/2, y: r.top + r.height/2 };
        }
      }
    }catch(_){}
    return { x: Number(x)||0, y: Number(y)||0 };
  }

  // ---------- FX primitives ----------
  function popText(x, y, text, opt){
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);
      const el = DOC.createElement('div');
      el.className = 'hha-fx-pop';
      el.textContent = String(text ?? '');
      const size = clamp(opt?.size ?? 18, 12, 46);
      const alpha = clamp(opt?.alpha ?? 0.98, 0.05, 1);
      const hue = opt?.hue; // optional
      el.style.fontSize = size + 'px';
      el.style.opacity = String(alpha);
      if (typeof hue === 'number'){
        el.style.filter = `hue-rotate(${hue}deg)`;
      }
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      safeAppend(layer, el);
      setTimeout(()=>safeRemove(el), 700);
    }catch(_){}
  }

  function popEmoji(x, y, emoji, opt){
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);
      const el = DOC.createElement('div');
      el.className = 'hha-fx-emoji';
      el.textContent = String(emoji ?? '✨');
      const size = clamp(opt?.size ?? 30, 16, 72);
      const alpha = clamp(opt?.alpha ?? 0.98, 0.05, 1);
      el.style.fontSize = size + 'px';
      el.style.opacity = String(alpha);
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      safeAppend(layer, el);
      setTimeout(()=>safeRemove(el), 900);
    }catch(_){}
  }

  function flash(x, y, opt){
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);
      const el = DOC.createElement('div');
      el.className = 'hha-fx-flash';
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      const size = clamp(opt?.size ?? 26, 12, 80);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      safeAppend(layer, el);
      setTimeout(()=>safeRemove(el), 320);
    }catch(_){}
  }

  function ring(x, y, opt){
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);
      const el = DOC.createElement('div');
      el.className = 'hha-fx-ring';
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      const size = clamp(opt?.size ?? 22, 14, 120);
      el.style.width  = size + 'px';
      el.style.height = size + 'px';
      // optional color tint by hue rotate
      if (typeof opt?.hue === 'number'){
        el.style.filter = `hue-rotate(${opt.hue}deg)`;
      }
      safeAppend(layer, el);
      setTimeout(()=>safeRemove(el), 760);
    }catch(_){}
  }

  function burst(x, y, opt){
    // small burst of dots with simple physics via RAF
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);

      const count = clamp(opt?.count ?? 10, 4, 30);
      const speed = clamp(opt?.speed ?? 520, 120, 1200); // px/s
      const life  = clamp(opt?.lifeMs ?? 520, 200, 1400);
      const size  = clamp(opt?.size ?? 10, 6, 22);
      const hueBase = (typeof opt?.hue === 'number') ? opt.hue : null;

      const items = [];
      for(let i=0;i<count;i++){
        const el = DOC.createElement('div');
        el.className = 'hha-fx-dot';
        el.style.left = p.x + 'px';
        el.style.top  = p.y + 'px';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.background = 'rgba(255,255,255,.9)';
        if (hueBase != null){
          el.style.filter = `hue-rotate(${(hueBase + rnd(-30,30))|0}deg)`;
        }
        safeAppend(layer, el);

        const ang = rnd(0, Math.PI*2);
        const sp  = speed * rnd(0.55, 1.05);
        const vx = Math.cos(ang)*sp;
        const vy = Math.sin(ang)*sp;

        items.push({
          el,
          x: p.x, y: p.y,
          vx, vy,
          g: rnd(680, 1100),  // gravity px/s^2
          drag: rnd(0.86, 0.94)
        });
      }

      const t0 = now();
      let last = t0;

      function step(t){
        const tt = t || now();
        const dt = Math.min(0.04, (tt - last) / 1000);
        last = tt;

        const age = tt - t0;
        const k = clamp(1 - age / life, 0, 1);

        for (let it of items){
          it.vx *= it.drag;
          it.vy = it.vy*it.drag + it.g*dt;

          it.x += it.vx*dt;
          it.y += it.vy*dt;

          try{
            it.el.style.left = it.x + 'px';
            it.el.style.top  = it.y + 'px';
            it.el.style.opacity = String(0.1 + 0.85*k);
            it.el.style.transform = `translate(-50%,-50%) scale(${0.7 + 0.6*k})`;
          }catch(_){}
        }

        if (age < life){
          root.requestAnimationFrame(step);
        }else{
          for (let it of items) safeRemove(it.el);
        }
      }

      root.requestAnimationFrame(step);
    }catch(_){}
  }

  function confetti(x, y, opt){
    // confetti strips
    try{
      const layer = ensureLayer();
      const p = toXY(x,y);

      const count = clamp(opt?.count ?? 14, 6, 36);
      const life  = clamp(opt?.lifeMs ?? 900, 350, 1800);
      const spread= clamp(opt?.spread ?? 220, 80, 420);
      const hueBase = (typeof opt?.hue === 'number') ? opt.hue : rnd(0, 360);

      const pieces = [];
      for(let i=0;i<count;i++){
        const el = DOC.createElement('div');
        el.className = 'hha-fx-dot';
        const w = rnd(6, 12);
        const h = rnd(10, 18);
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.borderRadius = '6px';
        el.style.left = p.x + 'px';
        el.style.top  = p.y + 'px';
        el.style.background = 'rgba(255,255,255,.92)';
        el.style.filter = `hue-rotate(${(hueBase + rnd(-70, 70))|0}deg)`;
        safeAppend(layer, el);

        const ang = rnd(-Math.PI*0.95, -Math.PI*0.05);
        const dist = rnd(spread*0.25, spread);
        const vx = Math.cos(ang) * rnd(260, 520);
        const vy = Math.sin(ang) * rnd(260, 520);

        pieces.push({
          el,
          x: p.x, y: p.y,
          vx, vy,
          g: rnd(900, 1400),
          rot: rnd(0, 360),
          rotV: rnd(-620, 620),
          drag: rnd(0.86, 0.93),
          drift: rnd(-40, 40),
          dist
        });
      }

      const t0 = now();
      let last = t0;

      function step(t){
        const tt = t || now();
        const dt = Math.min(0.04, (tt - last) / 1000);
        last = tt;

        const age = tt - t0;
        const k = clamp(1 - age / life, 0, 1);

        for (let it of pieces){
          it.vx *= it.drag;
          it.vy = it.vy*it.drag + it.g*dt;

          it.x += it.vx*dt + it.drift*dt;
          it.y += it.vy*dt;

          it.rot += it.rotV*dt;

          try{
            it.el.style.left = it.x + 'px';
            it.el.style.top  = it.y + 'px';
            it.el.style.opacity = String(0.15 + 0.85*k);
            it.el.style.transform = `translate(-50%,-50%) rotate(${it.rot}deg) scale(${0.85 + 0.45*k})`;
          }catch(_){}
        }

        if (age < life){
          root.requestAnimationFrame(step);
        }else{
          for (let it of pieces) safeRemove(it.el);
        }
      }

      root.requestAnimationFrame(step);
    }catch(_){}
  }

  // ---------- public API ----------
  const API = {
    ensureLayer,
    popText,
    popEmoji,
    burst,
    confetti,
    ring,
    flash
  };

  // Back-compat + preferred alias
  root.Particles = root.Particles || {};
  for (const k in API) root.Particles[k] = API[k];

  root.HHA_FX = root.HHA_FX || {};
  for (const k in API) root.HHA_FX[k] = API[k];

})(window);