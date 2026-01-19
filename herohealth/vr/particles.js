// === /herohealth/vr/particles.js ===
// HHA Particles / FX Layer — PRODUCTION (PACK-FAIR)
// ✅ Global FX for ALL games (GoodJunk/Groups/Hydration/Plate)
// ✅ Creates .hha-fx-layer once (pointer-events:none)
// ✅ APIs:
//    - popText(x,y,text,cls?,opts?)
//    - burstAt(x,y,kind?,opts?)
//    - ringPulse(x,y,kind?,opts?)
//    - celebrate(kind?,opts?)
// ✅ Exposes: window.Particles + window.GAME_MODULES.Particles
// ✅ Safe: idempotent, lightweight, no external deps

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const now = ()=> (performance?.now?.() ?? Date.now());

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:90',
      'overflow:hidden'
    ].join(';');
    DOC.body.appendChild(layer);
    return layer;
  }

  function styleEl(el, cssText){
    el.style.cssText += ';' + cssText;
    return el;
  }

  // ---- pop text ----
  function popText(x,y,text,cls=null,opts=null){
    const layer = ensureLayer();
    const o = opts||{};
    const size = clamp(Number(o.size)||18, 12, 44);
    const life = clamp(Number(o.life)||780, 220, 2200);
    const dy = Number(o.dy)||-28;

    const el = DOC.createElement('div');
    el.textContent = String(text ?? '');
    el.className = 'hha-pop ' + (cls ? String(cls) : '');
    styleEl(el, [
      'position:absolute',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      'transform:translate(-50%,-50%)',
      `font:900 ${size}px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif`,
      'letter-spacing:.2px',
      'color:#fff',
      'text-shadow:0 2px 0 rgba(0,0,0,.35), 0 10px 22px rgba(0,0,0,.35)',
      'opacity:0',
      'will-change:transform,opacity',
      'mix-blend-mode:normal'
    ].join(';'));

    // semantic classes (optional)
    if(cls==='good') el.style.color = '#eafff3';
    if(cls==='bad')  el.style.color = '#ffecec';
    if(cls==='warn') el.style.color = '#fff7ed';
    if(cls==='cyan') el.style.color = '#ecfeff';
    if(cls==='violet') el.style.color = '#f5f3ff';

    layer.appendChild(el);

    const t0 = now();
    const xJ = rnd(-8, 8);

    function anim(){
      const t = now() - t0;
      const p = clamp(t / life, 0, 1);

      // ease out
      const e = 1 - Math.pow(1-p, 3);
      const yy = y + dy*e;
      const sc = 1 + 0.10*Math.sin(p*Math.PI);

      el.style.opacity = String(p < 0.15 ? (p/0.15) : (1 - Math.max(0, (p-0.7)/0.3)));
      el.style.transform = `translate(-50%,-50%) translate(${xJ*e}px, ${Math.round(yy-y)}px) scale(${sc})`;

      if(p < 1) requestAnimationFrame(anim);
      else { try{ el.remove(); }catch(_){ } }
    }
    requestAnimationFrame(anim);
  }

  // ---- particle primitive ----
  function makeDot(x,y,kind){
    const el = DOC.createElement('div');
    el.className = 'hha-dot';
    styleEl(el, [
      'position:absolute',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      'width:10px',
      'height:10px',
      'border-radius:999px',
      'opacity:0.95',
      'will-change:transform,opacity',
      'filter: drop-shadow(0 6px 14px rgba(0,0,0,.35))'
    ].join(';'));

    // color by kind (no CSS dependency)
    if(kind==='good')   el.style.background = 'rgba(34,197,94,.95)';
    else if(kind==='bad') el.style.background = 'rgba(239,68,68,.95)';
    else if(kind==='warn') el.style.background = 'rgba(245,158,11,.95)';
    else if(kind==='cyan') el.style.background = 'rgba(34,211,238,.95)';
    else if(kind==='violet') el.style.background = 'rgba(167,139,250,.95)';
    else if(kind==='star') el.style.background = 'rgba(250,204,21,.95)';
    else if(kind==='shield') el.style.background = 'rgba(56,189,248,.95)';
    else if(kind==='diamond') el.style.background = 'rgba(232,121,249,.95)';
    else el.style.background = 'rgba(148,163,184,.95)';

    return el;
  }

  // ---- burst ----
  function burstAt(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const o = opts||{};
    const n = clamp(Number(o.count)||18, 6, 48);
    const life = clamp(Number(o.life)||720, 220, 1600);
    const spread = clamp(Number(o.spread)||92, 40, 180);
    const sizeMin = clamp(Number(o.sizeMin)||6, 3, 16);
    const sizeMax = clamp(Number(o.sizeMax)||12, 6, 26);

    const t0 = now();
    const dots = [];

    for(let i=0;i<n;i++){
      const el = makeDot(x,y,kind);
      const s = rnd(sizeMin, sizeMax);
      el.style.width = `${s}px`;
      el.style.height = `${s}px`;
      layer.appendChild(el);

      const ang = rnd(0, Math.PI*2);
      const dist = rnd(spread*0.35, spread);
      const vx = Math.cos(ang)*dist;
      const vy = Math.sin(ang)*dist;
      const rot = rnd(-220, 220);

      dots.push({ el, vx, vy, rot });
    }

    function anim(){
      const t = now() - t0;
      const p = clamp(t / life, 0, 1);
      const e = 1 - Math.pow(1-p, 2.7);

      for(const d of dots){
        const xx = vxEase(d.vx, e);
        const yy = vyEase(d.vy, e) + (18 * p*p); // gravity feel
        d.el.style.transform = `translate(-50%,-50%) translate(${xx}px,${yy}px) rotate(${d.rot*e}deg)`;
        d.el.style.opacity = String(1 - p);
      }

      if(p < 1) requestAnimationFrame(anim);
      else {
        for(const d of dots){ try{ d.el.remove(); }catch(_){ } }
      }
    }

    function vxEase(v, e){ return v * e; }
    function vyEase(v, e){ return v * e; }

    requestAnimationFrame(anim);
  }

  // ---- ring pulse ----
  function ringPulse(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const o = opts||{};
    const size = clamp(Number(o.size)||160, 80, 520);
    const life = clamp(Number(o.life)||520, 220, 1800);
    const thickness = clamp(Number(o.thickness)||3, 2, 8);

    const el = DOC.createElement('div');
    el.className = 'hha-ring';
    styleEl(el, [
      'position:absolute',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:999px',
      `border:${thickness}px solid rgba(255,255,255,.55)`,
      'transform:translate(-50%,-50%) scale(.65)',
      'opacity:0.0',
      'will-change:transform,opacity'
    ].join(';'));

    // tint
    if(kind==='good') el.style.borderColor = 'rgba(34,197,94,.65)';
    else if(kind==='bad') el.style.borderColor = 'rgba(239,68,68,.65)';
    else if(kind==='warn') el.style.borderColor = 'rgba(245,158,11,.65)';
    else if(kind==='cyan') el.style.borderColor = 'rgba(34,211,238,.65)';
    else if(kind==='violet') el.style.borderColor = 'rgba(167,139,250,.65)';
    else if(kind==='star') el.style.borderColor = 'rgba(250,204,21,.65)';
    else if(kind==='shield') el.style.borderColor = 'rgba(56,189,248,.65)';

    layer.appendChild(el);

    const t0 = now();
    function anim(){
      const t = now() - t0;
      const p = clamp(t / life, 0, 1);
      const e = 1 - Math.pow(1-p, 3);

      const sc = 0.65 + 0.55*e;
      el.style.opacity = String(p < 0.2 ? (p/0.2) : (1 - p));
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;

      if(p < 1) requestAnimationFrame(anim);
      else { try{ el.remove(); }catch(_){ } }
    }
    requestAnimationFrame(anim);
  }

  // ---- celebrate ----
  function celebrate(kind='win', opts=null){
    const o = opts||{};
    const count = clamp(Number(o.count)||24, 10, 80);
    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    // shoot from top region
    const y0 = Math.max(64, H*0.18);
    const x0 = W/2;

    // mix colors
    const palette = (kind==='boss')
      ? ['bad','warn','violet']
      : (kind==='mini')
      ? ['good','cyan','star']
      : ['good','star','cyan','violet'];

    for(let i=0;i<count;i++){
      const k = palette[(Math.random()*palette.length)|0];
      const x = x0 + rnd(-W*0.22, W*0.22);
      const y = y0 + rnd(-20, 40);
      burstAt(x,y,k,{ count: 10, life: rnd(520, 880), spread: rnd(70, 140), sizeMin: 5, sizeMax: 12 });
    }
  }

  // ---- export ----
  const API = { popText, burstAt, ringPulse, celebrate };
  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(window);