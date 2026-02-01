// === /herohealth/vr/particles.js ===
// Particles FX Layer — ULTRA (SAFE, shared across all games)
// ✅ ensureLayer(): fixed FX layer on top
// ✅ popText(x,y,text,cls?)
// ✅ burst(x,y,opts?)
// ✅ sparkle(x,y,opts?)
// ✅ shockwave(x,y,opts?)
// ✅ celebrate(opts?)  // confetti-ish
// Notes:
// - No deps, never throws.
// - Respects prefers-reduced-motion.
// - Uses lightweight DOM + CSS animations.
// - Designed to work with hha-fx-director.js (body pulse + calls into Particles).

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();

  function prefersReduceMotion(){
    try{
      return !!root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(_){
      return false;
    }
  }

  function ensureLayer(){
    try{
      let layer = DOC.querySelector('.hha-fx-layer');
      if (layer) return layer;

      layer = DOC.createElement('div');
      layer.className = 'hha-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:190;overflow:hidden;' +
        'contain:layout style paint;';

      DOC.body.appendChild(layer);
      return layer;
    }catch(_){
      return null;
    }
  }

  function safeAppend(el){
    try{
      const layer = ensureLayer();
      if (!layer) return null;
      layer.appendChild(el);
      return el;
    }catch(_){
      return null;
    }
  }

  function removeLater(el, ms){
    try{
      root.setTimeout(()=>{ try{ el && el.remove && el.remove(); }catch(_){ } }, ms);
    }catch(_){}
  }

  // --- CSS ---
  (function injectCSS(){
    try{
      const st = DOC.createElement('style');
      st.textContent = `
        .hha-fx-layer{ isolation:isolate; }
        .hha-fx-text{
          position:absolute;
          transform:translate(-50%,-50%);
          font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
          letter-spacing:.2px;
          color:#fff;
          text-shadow: 0 10px 26px rgba(0,0,0,.55);
          opacity:.98;
          will-change: transform, opacity, filter;
          filter: saturate(1.05);
          animation: hhaPop 520ms cubic-bezier(.2,.9,.2,1) forwards;
        }

        .hha-fx-dot{
          position:absolute;
          width:10px;height:10px;
          border-radius:999px;
          transform:translate(-50%,-50%);
          opacity:.98;
          will-change: transform, opacity;
        }

        .hha-fx-spark{
          position:absolute;
          width:6px;height:6px;
          border-radius:999px;
          transform:translate(-50%,-50%);
          opacity:.98;
          will-change: transform, opacity;
        }

        .hha-fx-ring{
          position:absolute;
          width:32px;height:32px;
          border-radius:999px;
          border:2px solid rgba(255,255,255,.55);
          transform:translate(-50%,-50%) scale(.55);
          opacity:.0;
          will-change: transform, opacity;
          animation: hhaRing 520ms ease-out forwards;
          mix-blend-mode: screen;
        }

        .hha-fx-conf{
          position:absolute;
          width:9px;height:14px;
          border-radius:3px;
          transform:translate(-50%,-50%);
          opacity:.98;
          will-change: transform, opacity;
        }

        @keyframes hhaPop{
          0%{ transform:translate(-50%,-50%) scale(.90); opacity:.00; filter:blur(1px); }
          35%{ transform:translate(-50%,-70%) scale(1.18); opacity:1; filter:blur(0); }
          100%{ transform:translate(-50%,-94%) scale(1.05); opacity:0; }
        }

        @keyframes hhaDot{
          0%{ transform:translate(-50%,-50%) translate(0,0) scale(1); opacity:1; }
          100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.55); opacity:0; }
        }

        @keyframes hhaSpark{
          0%{ transform:translate(-50%,-50%) translate(0,0) scale(1); opacity:1; }
          100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.30); opacity:0; }
        }

        @keyframes hhaRing{
          0%{ transform:translate(-50%,-50%) scale(.55); opacity:.00; }
          20%{ opacity:.75; }
          100%{ transform:translate(-50%,-50%) scale(1.8); opacity:0; }
        }

        @keyframes hhaConf{
          0%{ transform:translate(-50%,-50%) translate(0,0) rotate(0deg); opacity:1; }
          100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity:0; }
        }

        /* optional semantic helpers (CSS can also live in game CSS) */
        .fx-good{ color: rgba(234,255,243,.98); }
        .fx-bad{ color: rgba(255,240,240,.98); }
        .fx-warn{ color: rgba(255,250,235,.98); }
        .fx-violet{ color: rgba(245,240,255,.98); }
      `;
      DOC.head.appendChild(st);
    }catch(_){}
  })();

  // --- API ---
  function popText(x, y, text, cls){
    try{
      const layer = ensureLayer();
      if(!layer) return;

      const el = DOC.createElement('div');
      el.className = 'hha-fx-text' + (cls ? (' ' + String(cls)) : '');
      el.textContent = String(text == null ? '' : text);

      const X = clamp(x, -2000, 200000);
      const Y = clamp(y, -2000, 200000);

      el.style.left = X + 'px';
      el.style.top  = Y + 'px';

      safeAppend(el);
      removeLater(el, prefersReduceMotion() ? 120 : 650);
    }catch(_){}
  }

  function shockwave(x, y, opts){
    try{
      if(prefersReduceMotion()) return;
      const layer = ensureLayer();
      if(!layer) return;

      opts = opts || {};
      const size = clamp(opts.size || 36, 18, 160);
      const color = String(opts.color || 'rgba(255,255,255,.55)');
      const dur = clamp(opts.dur || 520, 180, 1200);

      const ring = DOC.createElement('div');
      ring.className = 'hha-fx-ring' + (opts.cls ? (' ' + String(opts.cls)) : '');
      ring.style.left = clamp(x, -2000, 200000) + 'px';
      ring.style.top  = clamp(y, -2000, 200000) + 'px';
      ring.style.width = size + 'px';
      ring.style.height= size + 'px';
      ring.style.borderColor = color;
      ring.style.animationDuration = dur + 'ms';

      safeAppend(ring);
      removeLater(ring, dur + 120);
    }catch(_){}
  }

  function burst(x, y, opts){
    try{
      const layer = ensureLayer();
      if(!layer) return;

      opts = opts || {};
      const n = clamp(opts.n || 10, 4, 28);
      const spread = clamp(opts.spread || 90, 30, 220);
      const dur = clamp(opts.dur || 520, 180, 1200);
      const baseSize = clamp(opts.size || 10, 6, 22);
      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
        'rgba(34,197,94,.95)',  // green
        'rgba(34,211,238,.92)', // cyan
        'rgba(167,139,250,.92)',// violet
        'rgba(245,158,11,.92)', // amber
        'rgba(255,255,255,.92)'
      ];

      // optional ring
      if(opts.ring !== false && !prefersReduceMotion()){
        shockwave(x, y, { size: clamp(opts.ringSize || 34, 18, 120), color:'rgba(255,255,255,.45)', dur: clamp(dur, 220, 900), cls: opts.cls });
      }

      for(let i=0;i<n;i++){
        const dot = DOC.createElement('div');
        dot.className = 'hha-fx-dot' + (opts.cls ? (' ' + String(opts.cls)) : '');
        dot.style.left = clamp(x, -2000, 200000) + 'px';
        dot.style.top  = clamp(y, -2000, 200000) + 'px';

        const ang = (Math.PI * 2) * (i / n) + rnd(-0.12, 0.12);
        const dist = rnd(spread*0.45, spread);
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;

        dot.style.setProperty('--dx', dx.toFixed(1) + 'px');
        dot.style.setProperty('--dy', dy.toFixed(1) + 'px');

        const s = rnd(baseSize*0.75, baseSize*1.25);
        dot.style.width = s.toFixed(1) + 'px';
        dot.style.height= s.toFixed(1) + 'px';

        dot.style.background = String(colors[Math.floor(Math.random()*colors.length)]);

        if(prefersReduceMotion()){
          dot.style.opacity = '0';
          safeAppend(dot);
          removeLater(dot, 60);
        }else{
          dot.style.animation = `hhaDot ${dur}ms ease-out forwards`;
          safeAppend(dot);
          removeLater(dot, dur + 120);
        }
      }
    }catch(_){}
  }

  function sparkle(x, y, opts){
    try{
      const layer = ensureLayer();
      if(!layer) return;

      opts = opts || {};
      const n = clamp(opts.n || 12, 5, 36);
      const spread = clamp(opts.spread || 110, 40, 260);
      const dur = clamp(opts.dur || 620, 220, 1400);
      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
        'rgba(255,255,255,.96)',
        'rgba(245,158,11,.92)',
        'rgba(34,211,238,.92)'
      ];

      if(prefersReduceMotion()){
        // fallback: just a tiny popText sparkle
        popText(x, y, '✨', opts.cls || 'fx-warn');
        return;
      }

      for(let i=0;i<n;i++){
        const sp = DOC.createElement('div');
        sp.className = 'hha-fx-spark' + (opts.cls ? (' ' + String(opts.cls)) : '');
        sp.style.left = clamp(x, -2000, 200000) + 'px';
        sp.style.top  = clamp(y, -2000, 200000) + 'px';

        const ang = rnd(0, Math.PI*2);
        const dist = rnd(spread*0.35, spread);
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;

        sp.style.setProperty('--dx', dx.toFixed(1) + 'px');
        sp.style.setProperty('--dy', dy.toFixed(1) + 'px');

        const s = rnd(4.2, 7.0);
        sp.style.width = s.toFixed(1) + 'px';
        sp.style.height= s.toFixed(1) + 'px';

        sp.style.background = String(colors[Math.floor(Math.random()*colors.length)]);
        sp.style.boxShadow = '0 0 18px rgba(255,255,255,.18)';

        sp.style.animation = `hhaSpark ${dur}ms ease-out forwards`;
        safeAppend(sp);
        removeLater(sp, dur + 120);
      }
    }catch(_){}
  }

  function celebrate(opts){
    try{
      const layer = ensureLayer();
      if(!layer) return;

      opts = opts || {};
      const W = root.innerWidth || 1000;
      const H = root.innerHeight || 800;

      const n = clamp(opts.n || 26, 10, 80);
      const dur = clamp(opts.dur || 900, 380, 2000);
      const spreadX = clamp(opts.spreadX || (W * 0.55), 160, 1200);
      const dropY = clamp(opts.dropY || (H * 0.70), 180, 1200);
      const y0 = clamp(opts.y || (H * 0.18), 0, H);
      const x0 = clamp(opts.x || (W * 0.50), 0, W);

      const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : [
        'rgba(34,197,94,.92)',
        'rgba(245,158,11,.92)',
        'rgba(34,211,238,.92)',
        'rgba(167,139,250,.92)',
        'rgba(255,255,255,.92)',
        'rgba(239,68,68,.92)'
      ];

      if(prefersReduceMotion()){
        popText(x0, y0, '🎉', opts.cls || 'fx-warn');
        return;
      }

      for(let i=0;i<n;i++){
        const cf = DOC.createElement('div');
        cf.className = 'hha-fx-conf' + (opts.cls ? (' ' + String(opts.cls)) : '');
        cf.style.left = x0 + 'px';
        cf.style.top  = y0 + 'px';

        const dx = rnd(-spreadX, spreadX);
        const dy = rnd(dropY*0.70, dropY);
        const rot = rnd(-540, 540) + 'deg';

        cf.style.setProperty('--dx', dx.toFixed(1) + 'px');
        cf.style.setProperty('--dy', dy.toFixed(1) + 'px');
        cf.style.setProperty('--rot', rot);

        cf.style.background = String(colors[Math.floor(Math.random()*colors.length)]);
        cf.style.opacity = String(rnd(0.75, 0.98));

        const w = rnd(7, 11);
        const h = rnd(10, 16);
        cf.style.width = w.toFixed(1) + 'px';
        cf.style.height= h.toFixed(1) + 'px';

        cf.style.animation = `hhaConf ${dur}ms cubic-bezier(.18,.9,.18,1) forwards`;
        safeAppend(cf);
        removeLater(cf, dur + 140);
      }
    }catch(_){}
  }

  // Expose
  root.Particles = root.Particles || {};
  root.Particles.ensureLayer = ensureLayer;
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.sparkle = sparkle;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // tiny sanity ping (optional)
  try{ root.Particles.__ts = now(); }catch(_){}
})(window);