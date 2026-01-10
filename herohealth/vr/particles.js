// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared across all games)
// ✅ One global FX layer (.hha-fx-layer)
// ✅ Text pop (supports cls)
// ✅ Burst confetti dots
// ✅ Ring shockwave
// ✅ Screen sparkle + celebrate
// ✅ Safe: no dependencies, auto clamps, auto remove nodes
//
// Usage:
//   Particles.popText(x,y,'+10','fx-good')
//   Particles.burst(x,y,{n:14, life:520})
//   Particles.shockwave(x,y,{r:140, life:420})
//   Particles.celebrate({n:30})
//
// Notes:
// - Works great with hha-fx-director body classes.
// - For mobile, pass x/y from pointer event clientX/clientY.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand  = (a,b) => a + Math.random()*(b-a);
  const now   = () => (root.performance && performance.now) ? performance.now() : Date.now();

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:190',  // above playfield, under topbar (200)
      'overflow:hidden',
      'contain:layout paint style'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if (doc.getElementById('hhaParticlesStyle')) return;

    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      .hha-fx-layer{ }
      .hha-fx-text{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        filter: drop-shadow(0 14px 30px rgba(0,0,0,.40));
        animation: hhaPopText 560ms cubic-bezier(.2,.9,.2,1) forwards;
      }
      .hha-fx-text.fx-good{ color:#eafff3; text-shadow: 0 10px 26px rgba(34,197,94,.18), 0 10px 26px rgba(0,0,0,.55); }
      .hha-fx-text.fx-bad{  color:#ffecec; text-shadow: 0 10px 26px rgba(239,68,68,.18), 0 10px 26px rgba(0,0,0,.55); }
      .hha-fx-text.fx-warn{ color:#fff7d6; text-shadow: 0 10px 26px rgba(245,158,11,.18), 0 10px 26px rgba(0,0,0,.55); }
      .hha-fx-text.fx-violet{ color:#f4edff; text-shadow: 0 10px 26px rgba(167,139,250,.18), 0 10px 26px rgba(0,0,0,.55); }

      @keyframes hhaPopText{
        0%{ transform:translate(-50%,-50%) scale(.90); opacity:.20; filter: blur(.25px); }
        55%{ transform:translate(-50%,-78%) scale(1.22); opacity:1; filter:none; }
        100%{ transform:translate(-50%,-104%) scale(1.06); opacity:0; filter: blur(.12px); }
      }

      .hha-fx-dot{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        background: rgba(255,255,255,.92);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        opacity: .98;
        filter: drop-shadow(0 10px 22px rgba(0,0,0,.40));
      }

      .hha-fx-ring{
        position:absolute;
        transform: translate(-50%,-50%);
        width: 10px; height: 10px;
        border-radius:999px;
        border: 3px solid rgba(255,255,255,.40);
        box-shadow: 0 0 30px rgba(255,255,255,.10), inset 0 0 26px rgba(255,255,255,.08);
        will-change: transform, opacity, width, height;
        opacity: .95;
        pointer-events:none;
      }

      .hha-fx-spark{
        position:absolute;
        width: 6px; height: 6px;
        border-radius: 3px;
        background: rgba(255,255,255,.92);
        transform: translate(-50%,-50%) rotate(0deg);
        opacity:.9;
        filter: drop-shadow(0 10px 22px rgba(0,0,0,.35));
        will-change: transform, opacity;
      }
    `;
    doc.head.appendChild(st);
  }

  function add(el){
    ensureStyle();
    const layer = ensureLayer();
    layer.appendChild(el);
    return el;
  }

  function safeRemove(el){
    try{ el && el.remove && el.remove(); }catch(_){}
  }

  function popText(x, y, text, cls=''){
    try{
      x = clamp(Number(x)||0, 0, root.innerWidth||9999);
      y = clamp(Number(y)||0, 0, root.innerHeight||9999);

      const el = doc.createElement('div');
      el.className = 'hha-fx-text' + (cls ? (' ' + cls) : '');
      el.textContent = String(text ?? '');
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      add(el);
      setTimeout(()=>safeRemove(el), 700);
      return el;
    }catch(_){ return null; }
  }

  function burst(x,y, opt={}){
    try{
      x = clamp(Number(x)||0, 0, root.innerWidth||9999);
      y = clamp(Number(y)||0, 0, root.innerHeight||9999);

      const n = clamp(Number(opt.n)||16, 6, 44);
      const life = clamp(Number(opt.life)||540, 220, 1400);
      const spread = clamp(Number(opt.spread)||140, 70, 260);
      const sizeMin = clamp(Number(opt.sizeMin)||7, 3, 14);
      const sizeMax = clamp(Number(opt.sizeMax)||12, sizeMin, 22);
      const grav = clamp(Number(opt.grav)||0.86, 0.15, 2.2);
      const drift = clamp(Number(opt.drift)||0.55, 0.05, 1.4);

      const t0 = now();
      const dots = [];

      for(let i=0;i<n;i++){
        const dot = doc.createElement('div');
        dot.className = 'hha-fx-dot';
        const s = rand(sizeMin,sizeMax);
        dot.style.width = s + 'px';
        dot.style.height = s + 'px';
        dot.style.left = x + 'px';
        dot.style.top  = y + 'px';

        // random pastel-ish white + slight tint via box-shadow
        const hue = rand(0, 360);
        dot.style.background = `hsla(${hue}, 85%, 70%, .92)`;
        dot.style.boxShadow = `0 0 0 2px hsla(${hue}, 90%, 60%, .12), 0 10px 22px rgba(0,0,0,.35)`;

        add(dot);

        const a = rand(0, Math.PI*2);
        const v = rand(spread*0.42, spread);
        const vx = Math.cos(a) * v * drift;
        const vy = Math.sin(a) * v - rand(40, 120);
        const rot = rand(-220, 220);

        dots.push({ el: dot, vx, vy, rot, s });
      }

      function tick(){
        const t = now() - t0;
        const p = clamp(t / life, 0, 1);

        for(const d of dots){
          const dx = d.vx * (t/1000);
          const dy = (d.vy * (t/1000)) + (grav * 980 * (t/1000)*(t/1000) * 0.15);
          const o  = 1 - p;

          d.el.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${d.rot * (t/1000)}deg)`;
          d.el.style.opacity = String(clamp(o, 0, 1));
        }

        if(p < 1) root.requestAnimationFrame(tick);
        else dots.forEach(d=>safeRemove(d.el));
      }

      root.requestAnimationFrame(tick);
    }catch(_){}
  }

  function shockwave(x,y,opt={}){
    try{
      x = clamp(Number(x)||0, 0, root.innerWidth||9999);
      y = clamp(Number(y)||0, 0, root.innerHeight||9999);

      const r = clamp(Number(opt.r)||160, 80, 520);
      const life = clamp(Number(opt.life)||420, 200, 1200);
      const thick = clamp(Number(opt.thick)||3, 1, 8);
      const alpha = clamp(Number(opt.alpha)||0.42, 0.10, 0.90);

      const ring = doc.createElement('div');
      ring.className = 'hha-fx-ring';
      ring.style.left = x + 'px';
      ring.style.top  = y + 'px';
      ring.style.borderWidth = thick + 'px';
      ring.style.borderColor = `rgba(255,255,255,${alpha})`;

      add(ring);

      const t0 = now();
      function tick(){
        const t = now() - t0;
        const p = clamp(t / life, 0, 1);

        const rr = 10 + (r * p);
        ring.style.width = rr + 'px';
        ring.style.height = rr + 'px';
        ring.style.opacity = String(1 - p);
        ring.style.transform = `translate(-50%,-50%) scale(${0.92 + p*0.22})`;

        if(p < 1) root.requestAnimationFrame(tick);
        else safeRemove(ring);
      }
      root.requestAnimationFrame(tick);
    }catch(_){}
  }

  function sparkle(x,y,opt={}){
    try{
      x = clamp(Number(x)||0, 0, root.innerWidth||9999);
      y = clamp(Number(y)||0, 0, root.innerHeight||9999);

      const n = clamp(Number(opt.n)||14, 6, 40);
      const life = clamp(Number(opt.life)||520, 220, 1200);
      const spread = clamp(Number(opt.spread)||170, 80, 320);
      const t0 = now();

      const sp = [];
      for(let i=0;i<n;i++){
        const el = doc.createElement('div');
        el.className = 'hha-fx-spark';
        const s = rand(5, 9);
        el.style.width = s + 'px';
        el.style.height = s + 'px';
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        const hue = rand(0,360);
        el.style.background = `hsla(${hue}, 88%, 80%, .92)`;
        add(el);

        const a = rand(0, Math.PI*2);
        const v = rand(spread*0.35, spread);
        const vx = Math.cos(a) * v;
        const vy = Math.sin(a) * v;
        const rot = rand(-280, 280);
        sp.push({el,vx,vy,rot});
      }

      function tick(){
        const t = now() - t0;
        const p = clamp(t / life, 0, 1);
        const ease = (1 - Math.pow(1-p, 3)); // easeOutCubic
        for(const s of sp){
          const dx = s.vx * (ease) * 0.85;
          const dy = s.vy * (ease) * 0.85;
          s.el.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${s.rot*ease}deg) scale(${1 - p*0.25})`;
          s.el.style.opacity = String(1 - p);
        }
        if(p < 1) root.requestAnimationFrame(tick);
        else sp.forEach(s=>safeRemove(s.el));
      }
      root.requestAnimationFrame(tick);
    }catch(_){}
  }

  function celebrate(opt={}){
    try{
      const w = root.innerWidth || 800;
      const h = root.innerHeight || 600;

      const n = clamp(Number(opt.n)||26, 10, 60);
      const y = clamp(Number(opt.y)||Math.round(h*0.32), 40, h-40);

      // center shockwave + sparkles + burst
      shockwave(w*0.5, y, { r: clamp(Number(opt.r)||220, 120, 520), life: 520, alpha: 0.35, thick: 3 });
      sparkle(w*0.5, y, { n: Math.round(n*0.65), spread: 260, life: 720 });
      burst(w*0.5, y, { n, spread: 220, life: 820, grav: 0.92, drift: 0.62 });

      // left & right small pops
      popText(w*0.35, y + 20, '✨', 'fx-violet');
      popText(w*0.65, y + 20, '✨', 'fx-violet');
    }catch(_){}
  }

  // Public API
  root.Particles = root.Particles || {};
  root.Particles.ensureLayer = ensureLayer;
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.sparkle = sparkle;
  root.Particles.celebrate = celebrate;

})(window);