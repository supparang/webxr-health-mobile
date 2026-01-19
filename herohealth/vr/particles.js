// === /herohealth/vr/particles.js ===
// HHA Particles — PACK-FAIR (S)
// ✅ FX layer: score pop + burst + ring pulse + celebrate
// ✅ API: window.Particles + window.GAME_MODULES.Particles
//    - popText(x,y,text,cls?,opts?)
//    - burstAt(x,y,kind?,opts?)
//    - ringPulse(x,y,kind?,opts?)
//    - celebrate(kind?,opts?)
// ✅ No external deps, safe on mobile
// ✅ z-index compatible with HUD: .hha-fx-layer is below HUD

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // Avoid double load
  if (root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const now = () => (root.performance && root.performance.now) ? root.performance.now() : Date.now();

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:95',
      'overflow:hidden'
    ].join(';');

    DOC.body.appendChild(layer);
    return layer;
  }

  function makeDiv(cssText){
    const el = DOC.createElement('div');
    el.style.cssText = cssText || '';
    return el;
  }

  function removeLater(el, ms){
    if (!el) return;
    const t = Math.max(40, Number(ms) || 420);
    setTimeout(() => { try{ el.remove(); }catch(_){ } }, t);
  }

  function colorByKind(kind){
    // Use simple semantic colors, do not depend on theme variables
    switch(String(kind||'').toLowerCase()){
      case 'good': return 'rgba(34,197,94,0.95)';
      case 'bad': return 'rgba(239,68,68,0.95)';
      case 'warn': return 'rgba(245,158,11,0.95)';
      case 'star': return 'rgba(245,158,11,0.95)';
      case 'shield': return 'rgba(34,211,238,0.95)';
      case 'violet': return 'rgba(167,139,250,0.95)';
      case 'diamond': return 'rgba(167,139,250,0.95)';
      default: return 'rgba(229,231,235,0.95)';
    }
  }

  function popText(x, y, text, cls, opts){
    const layer = ensureLayer();
    const X = clamp(Number(x)||0, 0, innerWidth);
    const Y = clamp(Number(y)||0, 0, innerHeight);

    const size = clamp(Number(opts && opts.size) || 18, 12, 34);
    const lift = clamp(Number(opts && opts.lift) || 46, 18, 90);

    const col = (cls === 'bad') ? colorByKind('bad')
             : (cls === 'warn') ? colorByKind('warn')
             : (cls === 'good') ? colorByKind('good')
             : (cls === 'cyan') ? colorByKind('shield')
             : (cls === 'violet') ? colorByKind('violet')
             : colorByKind('default');

    const el = makeDiv([
      'position:absolute',
      `left:${X}px`,
      `top:${Y}px`,
      'transform:translate(-50%,-50%)',
      `font:900 ${size}px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif`,
      `color:${col}`,
      'text-shadow:0 10px 28px rgba(0,0,0,.55)',
      'letter-spacing:.2px',
      'will-change:transform,opacity',
      'opacity:0'
    ].join(';'));

    el.textContent = String(text||'');

    layer.appendChild(el);

    // Animate
    const t0 = now();
    const dur = clamp(Number(opts && opts.ms) || 520, 220, 1200);

    function frame(){
      const t = now();
      const p = clamp((t - t0) / dur, 0, 1);
      // ease out
      const e = 1 - Math.pow(1 - p, 3);

      const yy = Y - e * lift;
      const sc = 0.94 + 0.10 * (1 - Math.pow(1 - p, 2));
      const op = (p < 0.12) ? (p/0.12) : (p > 0.85 ? (1 - (p-0.85)/0.15) : 1);

      el.style.top = `${yy}px`;
      el.style.opacity = String(op);
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;

      if (p < 1) {
        root.requestAnimationFrame(frame);
      } else {
        removeLater(el, 0);
      }
    }
    root.requestAnimationFrame(frame);
  }

  function ringPulse(x, y, kind, opts){
    const layer = ensureLayer();
    const X = clamp(Number(x)||0, 0, innerWidth);
    const Y = clamp(Number(y)||0, 0, innerHeight);

    const size = clamp(Number(opts && opts.size) || 160, 80, 360);
    const ms = clamp(Number(opts && opts.ms) || 520, 220, 1200);
    const col = colorByKind(kind);

    const el = makeDiv([
      'position:absolute',
      `left:${X}px`,
      `top:${Y}px`,
      'transform:translate(-50%,-50%) scale(.78)',
      `width:${size}px`,
      `height:${size}px`,
      'border-radius:999px',
      `border:3px solid ${col}`,
      'box-shadow:0 0 0 10px rgba(255,255,255,.06)',
      'opacity:0.0',
      'will-change:transform,opacity'
    ].join(';'));

    layer.appendChild(el);

    const t0 = now();
    function frame(){
      const t = now();
      const p = clamp((t - t0) / ms, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);

      const sc = 0.78 + e * 0.58;
      const op = (p < 0.10) ? (p/0.10) : (p > 0.65 ? (1 - (p-0.65)/0.35) : 1);

      el.style.transform = `translate(-50%,-50%) scale(${sc})`;
      el.style.opacity = String(op);

      if (p < 1) root.requestAnimationFrame(frame);
      else removeLater(el, 0);
    }
    root.requestAnimationFrame(frame);
  }

  function burstAt(x, y, kind, opts){
    const layer = ensureLayer();
    const X = clamp(Number(x)||0, 0, innerWidth);
    const Y = clamp(Number(y)||0, 0, innerHeight);

    const n = clamp(Number(opts && opts.count) || 10, 6, 22);
    const ms = clamp(Number(opts && opts.ms) || 560, 260, 1200);
    const spread = clamp(Number(opts && opts.spread) || 90, 40, 180);

    const col = colorByKind(kind);

    // Make particles
    for(let i=0;i<n;i++){
      const a = (Math.PI*2) * (i / n) + (Math.random()*0.28);
      const r = spread * (0.55 + Math.random()*0.55);
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;

      const s = 6 + Math.random()*8;
      const el = makeDiv([
        'position:absolute',
        `left:${X}px`,
        `top:${Y}px`,
        'transform:translate(-50%,-50%)',
        `width:${s}px`,
        `height:${s}px`,
        'border-radius:999px',
        `background:${col}`,
        'box-shadow:0 10px 24px rgba(0,0,0,.35)',
        'opacity:0.0',
        'will-change:transform,opacity'
      ].join(';'));

      layer.appendChild(el);

      const t0 = now() + (Math.random()*40);
      function frame(){
        const t = now();
        const p = clamp((t - t0) / ms, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);

        const xx = X + dx * e;
        const yy = Y + dy * e - 20 * e; // slight lift
        const sc = 0.9 + 0.4 * (1 - Math.pow(1 - p, 2));
        const op = (p < 0.10) ? (p/0.10) : (p > 0.72 ? (1 - (p-0.72)/0.28) : 1);

        el.style.left = `${xx}px`;
        el.style.top  = `${yy}px`;
        el.style.opacity = String(op);
        el.style.transform = `translate(-50%,-50%) scale(${sc})`;

        if (p < 1) root.requestAnimationFrame(frame);
        else removeLater(el, 0);
      }
      root.requestAnimationFrame(frame);
    }
  }

  function celebrate(kind, opts){
    // A light "confetti" shower from top area (pack-fair: not too heavy)
    const layer = ensureLayer();
    const ms = clamp(Number(opts && opts.ms) || 900, 450, 1800);
    const count = clamp(Number(opts && opts.count) || 16, 8, 32);

    const t0 = now();
    const startY = innerHeight * 0.18;

    for(let i=0;i<count;i++){
      const x = Math.random() * innerWidth;
      const y = startY + (Math.random()*40);
      const col = colorByKind(kind || (Math.random()<0.4?'good':Math.random()<0.7?'star':'violet'));
      const w = 6 + Math.random()*10;
      const h = 10 + Math.random()*18;

      const el = makeDiv([
        'position:absolute',
        `left:${x}px`,
        `top:${y}px`,
        'transform:translate(-50%,-50%)',
        `width:${w}px`,
        `height:${h}px`,
        'border-radius:6px',
        `background:${col}`,
        'opacity:0.0',
        'will-change:transform,opacity'
      ].join(';'));

      layer.appendChild(el);

      const dx = (Math.random()*2 - 1) * 160;
      const dy = 380 + Math.random()*380;
      const spin = (Math.random()*2 - 1) * 540;

      function frame(){
        const t = now();
        const p = clamp((t - t0) / ms, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);

        const xx = x + dx * e;
        const yy = y + dy * e;
        const op = (p < 0.10) ? (p/0.10) : (p > 0.85 ? (1 - (p-0.85)/0.15) : 1);

        el.style.opacity = String(op);
        el.style.left = `${xx}px`;
        el.style.top  = `${yy}px`;
        el.style.transform = `translate(-50%,-50%) rotate(${spin*e}deg)`;

        if (p < 1) root.requestAnimationFrame(frame);
        else removeLater(el, 0);
      }
      root.requestAnimationFrame(frame);
    }

    // Optional center label
    if(opts && opts.label){
      popText(innerWidth/2, innerHeight*0.30, String(opts.label), 'good', { size: 24, ms: 700 });
    }
  }

  const API = { popText, burstAt, ringPulse, celebrate };

  // Export
  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(window);