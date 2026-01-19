// === /herohealth/vr/particles.js ===
// HHA Particles — PACK-FAIR (Universal FX)
// ✅ Provides: window.Particles + window.GAME_MODULES.Particles
// ✅ Functions used by games:
//    popText(x,y,text,cls,opts)
//    burstAt(x,y,kind,opts)
//    ringPulse(x,y,kind,opts)
//    celebrate(kind,opts)
// ✅ Safe: no dependencies, pointer-events:none, z-index high but below overlays if needed

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const WIN = root;
  if (WIN.__HHA_PARTICLES__) return;
  WIN.__HHA_PARTICLES__ = true;

  const clamp = (v, a, b)=> (v<a?a:(v>b?b:v));
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
      'z-index:190',
      'overflow:hidden'
    ].join(';');
    DOC.body.appendChild(layer);
    return layer;
  }

  function makeEl(tag, cssText){
    const el = DOC.createElement(tag);
    el.style.cssText = cssText || '';
    return el;
  }

  function baseColor(kind){
    // No hard dependence on CSS vars; fallback safe
    // "kind" can be: good, bad, warn, cyan, violet, star, shield, diamond, win
    const map = {
      good:  'rgba(34,197,94,0.95)',
      bad:   'rgba(249,115,115,0.95)',
      warn:  'rgba(245,158,11,0.95)',
      cyan:  'rgba(34,211,238,0.95)',
      violet:'rgba(167,139,250,0.95)',
      star:  'rgba(245,158,11,0.95)',
      shield:'rgba(34,211,238,0.95)',
      diamond:'rgba(167,139,250,0.95)',
      win:   'rgba(229,231,235,0.95)'
    };
    return map[kind] || map.win;
  }

  function popText(x,y,text,cls=null,opts=null){
    const layer = ensureLayer();
    const size = clamp(Number(opts?.size)||18, 12, 40);
    const life = clamp(Number(opts?.lifeMs)||780, 260, 1800);
    const dy = clamp(Number(opts?.risePx)||48, 16, 120);
    const c = baseColor(cls || opts?.kind || 'win');

    const el = makeEl('div', [
      'position:absolute',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      'transform: translate(-50%,-50%)',
      `font: 1000 ${size}px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif`,
      'letter-spacing:0.2px',
      `color:${c}`,
      'text-shadow: 0 2px 0 rgba(0,0,0,.35), 0 14px 28px rgba(0,0,0,.35)',
      'will-change: transform, opacity',
      'opacity: 0',
    ].join(';'));

    el.textContent = String(text ?? '');
    layer.appendChild(el);

    const t0 = now();
    const t1 = t0 + life;

    // animate with rAF (very light)
    function step(){
      const t = now();
      const p = clamp((t - t0) / (t1 - t0), 0, 1);
      const ease = 1 - Math.pow(1 - p, 2); // easeOutQuad
      const yy = -dy * ease;
      const a = (p < 0.15) ? (p/0.15) : (p > 0.85 ? (1 - (p-0.85)/0.15) : 1);
      el.style.opacity = String(clamp(a, 0, 1));
      el.style.transform = `translate(-50%,-50%) translateY(${yy}px) scale(${1 + 0.06*(1-p)})`;
      if (p >= 1){
        try{ el.remove(); }catch(_){}
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function burstAt(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const n = clamp(Number(opts?.count)||14, 6, 30);
    const spread = clamp(Number(opts?.spread)||120, 60, 220);
    const life = clamp(Number(opts?.lifeMs)||520, 220, 1200);
    const size = clamp(Number(opts?.size)||6, 3, 14);
    const c = baseColor(kind);

    const t0 = now();
    const parts = [];

    for(let i=0;i<n;i++){
      const a = (Math.PI * 2) * (i / n) + (Math.random()*0.4);
      const r = spread * (0.35 + Math.random()*0.75);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;
      const dot = makeEl('div', [
        'position:absolute',
        `left:${Math.round(x)}px`,
        `top:${Math.round(y)}px`,
        'width:0',
        'height:0',
        'transform: translate(-50%,-50%)',
        'will-change: transform, opacity'
      ].join(';'));

      const b = makeEl('div', [
        `width:${Math.round(size)}px`,
        `height:${Math.round(size)}px`,
        'border-radius:999px',
        `background:${c}`,
        'box-shadow: 0 10px 24px rgba(0,0,0,.22)'
      ].join(';'));

      dot.appendChild(b);
      layer.appendChild(dot);

      parts.push({ dot, dx, dy, s: (0.9 + Math.random()*0.5) });
    }

    function step(){
      const t = now();
      const p = clamp((t - t0) / life, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const a = 1 - p;

      for(const it of parts){
        const xx = it.dx * ease;
        const yy = it.dy * ease;
        it.dot.style.opacity = String(clamp(a, 0, 1));
        it.dot.style.transform = `translate(-50%,-50%) translate(${xx}px,${yy}px) scale(${it.s*(1-0.2*p)})`;
      }

      if (p >= 1){
        for(const it of parts){
          try{ it.dot.remove(); }catch(_){}
        }
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function ringPulse(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const size = clamp(Number(opts?.size)||160, 80, 420);
    const stroke = clamp(Number(opts?.stroke)||3, 2, 6);
    const life = clamp(Number(opts?.lifeMs)||520, 240, 1200);
    const c = baseColor(kind);

    const ring = makeEl('div', [
      'position:absolute',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      `width:${Math.round(size)}px`,
      `height:${Math.round(size)}px`,
      'transform: translate(-50%,-50%) scale(0.92)',
      'border-radius:999px',
      `border:${stroke}px solid ${c}`,
      'box-shadow: 0 0 0 10px rgba(255,255,255,.03)',
      'opacity: 0.0',
      'will-change: transform, opacity'
    ].join(';'));

    layer.appendChild(ring);

    const t0 = now();
    function step(){
      const t = now();
      const p = clamp((t - t0)/life, 0, 1);
      const ease = 1 - Math.pow(1 - p, 2);
      const sc = 0.92 + 0.18*ease;
      const a = (p < 0.15) ? (p/0.15) : (1 - p);
      ring.style.opacity = String(clamp(a, 0, 1));
      ring.style.transform = `translate(-50%,-50%) scale(${sc})`;
      if(p>=1){
        try{ ring.remove(); }catch(_){}
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function celebrate(kind='win', opts=null){
    const layer = ensureLayer();
    const n = clamp(Number(opts?.count)||18, 8, 40);
    const life = clamp(Number(opts?.lifeMs)||950, 420, 2200);
    const t0 = now();

    const parts = [];
    for(let i=0;i<n;i++){
      const x = Math.random()*innerWidth;
      const y = innerHeight*(0.18 + Math.random()*0.18);
      const dx = (Math.random()*2 - 1) * 160;
      const dy = innerHeight*(0.55 + Math.random()*0.25);
      const size = 10 + Math.random()*16;
      const rot = (Math.random()*2 - 1) * 180;

      const c = baseColor(
        (i%5===0) ? 'violet' :
        (i%5===1) ? 'cyan' :
        (i%5===2) ? 'warn' :
        (i%5===3) ? 'good' : 'win'
      );

      const el = makeEl('div', [
        'position:absolute',
        `left:${Math.round(x)}px`,
        `top:${Math.round(y)}px`,
        `width:${Math.round(size)}px`,
        `height:${Math.round(size)}px`,
        'border-radius:6px',
        `background:${c}`,
        'opacity:0',
        'will-change: transform, opacity',
        'box-shadow: 0 12px 26px rgba(0,0,0,.24)'
      ].join(';'));

      layer.appendChild(el);
      parts.push({ el, x, y, dx, dy, rot, s:(0.9+Math.random()*0.6) });
    }

    function step(){
      const t = now();
      const p = clamp((t - t0)/life, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const a = (p < 0.08) ? (p/0.08) : (1 - p);

      for(const it of parts){
        const xx = it.x + it.dx * ease;
        const yy = it.y + it.dy * ease;
        it.el.style.opacity = String(clamp(a, 0, 1));
        it.el.style.transform = `translate(${xx}px,${yy}px) rotate(${it.rot*ease}deg) scale(${it.s*(1-0.25*p)})`;
      }

      if(p>=1){
        for(const it of parts){ try{ it.el.remove(); }catch(_){} }
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const API = { popText, burstAt, ringPulse, celebrate };

  // expose
  WIN.Particles = API;
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.Particles = API;

})(window);