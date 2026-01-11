// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (shared FX core for all games)
// ✅ Lightweight DOM FX (no canvas) — safe for mobile
// ✅ Works even if game CSS is broken (self-contained styles)
// ✅ API:
//    Particles.popText(x,y,text,cls?)
//    Particles.burst(x,y,{r,n,lifeMs})
//    Particles.shockwave(x,y,{r,lifeMs})
//    Particles.celebrate()
//    Particles.scorePop(x,y,text)         (compat)
//    Particles.burstAt(x,y,kind)          (compat)

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_PARTICLES_PRO__) return;
  root.__HHA_PARTICLES_PRO__ = true;

  // ---------------- layer + css ----------------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index: 9997;
      overflow:hidden;
      contain: layout paint;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function injectCss(){
    if(doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms cubic-bezier(.2,.9,.2,1) forwards;
      }
      .hha-pop.big{ font-size:22px; }
      .hha-pop.perfect{ letter-spacing:.5px; filter: drop-shadow(0 0 10px rgba(255,255,255,.28)); }
      .hha-pop.bad{ filter: drop-shadow(0 0 10px rgba(255,110,110,.18)); }
      .hha-pop.good{ filter: drop-shadow(0 0 10px rgba(110,255,170,.18)); }

      @keyframes hhaPop{
        0%   { transform:translate(-50%,-50%) scale(.88); opacity:.0; }
        12%  { opacity:.98; }
        70%  { transform:translate(-50%,-82%) scale(1.18); opacity:1; }
        100% { transform:translate(-50%,-104%) scale(1.05); opacity:0; }
      }

      .hha-bit{
        position:absolute;
        width: 8px; height: 8px;
        border-radius: 999px;
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaBit 520ms ease-out forwards;
      }
      @keyframes hhaBit{
        0%   { transform:translate3d(var(--x0), var(--y0), 0) scale(1); opacity:.0; }
        10%  { opacity:.95; }
        100% { transform:translate3d(var(--x1), var(--y1), 0) scale(.6); opacity:0; }
      }

      .hha-wave{
        position:absolute;
        border-radius:999px;
        border: 3px solid rgba(255,255,255,.22);
        width: 10px; height: 10px;
        transform: translate(-50%,-50%) scale(.2);
        opacity:.0;
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
      }
      @keyframes hhaWave{
        0%   { opacity:.0; transform: translate(-50%,-50%) scale(.12); }
        12%  { opacity:.55; }
        100% { opacity:0; transform: translate(-50%,-50%) scale(1.15); }
      }
    `;
    doc.head.appendChild(st);
  }

  injectCss();

  function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
  function rnd(a,b){ return a + Math.random()*(b-a); }
  function safeXY(x,y){
    const W = doc.documentElement.clientWidth || innerWidth || 1;
    const H = doc.documentElement.clientHeight || innerHeight || 1;
    return {
      x: clamp(x, 0, W),
      y: clamp(y, 0, H),
      W,H
    };
  }

  // ---------------- FX primitives ----------------
  function popText(x,y,text,cls='score'){
    try{
      const layer = ensureLayer();
      const p = safeXY(x,y);

      const el = doc.createElement('div');
      el.className = `hha-pop ${cls||''}`.trim();
      el.textContent = String(text ?? '');

      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';

      // size heuristics
      const t = String(text||'');
      if(t.length <= 3 || t.includes('PERFECT')) el.classList.add('big');

      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 720);
    }catch(_){}
  }

  function burst(x,y, opts={}){
    try{
      const layer = ensureLayer();
      const p = safeXY(x,y);

      const r = clamp(opts.r ?? 56, 18, 160);
      const n = clamp(opts.n ?? Math.round(r/4), 8, 46);
      const lifeMs = clamp(opts.lifeMs ?? 520, 220, 1200);

      for(let i=0;i<n;i++){
        const a = (Math.PI*2) * (i/n) + rnd(-0.15,0.15);
        const dist = rnd(r*0.55, r*1.15);
        const dx = Math.cos(a)*dist;
        const dy = Math.sin(a)*dist;

        const bit = doc.createElement('div');
        bit.className = 'hha-bit';
        bit.style.left = p.x + 'px';
        bit.style.top  = p.y + 'px';

        // motion
        bit.style.setProperty('--x0', '0px');
        bit.style.setProperty('--y0', '0px');
        bit.style.setProperty('--x1', `${dx}px`);
        bit.style.setProperty('--y1', `${dy}px`);

        // color without hardcoding palettes: vary opacity + subtle white/gray
        // (keeps "no color system" requirement; still visible)
        const alpha = rnd(0.55, 0.95);
        bit.style.background = `rgba(255,255,255,${alpha})`;

        bit.style.animationDuration = `${lifeMs}ms`;
        layer.appendChild(bit);

        setTimeout(()=>{ try{ bit.remove(); }catch(_){ } }, lifeMs + 80);
      }
    }catch(_){}
  }

  function shockwave(x,y, opts={}){
    try{
      const layer = ensureLayer();
      const p = safeXY(x,y);

      const r = clamp(opts.r ?? 72, 24, 220);
      const lifeMs = clamp(opts.lifeMs ?? 520, 220, 1400);

      const wave = doc.createElement('div');
      wave.className = 'hha-wave';
      wave.style.left = p.x + 'px';
      wave.style.top  = p.y + 'px';
      wave.style.width = (r*2) + 'px';
      wave.style.height= (r*2) + 'px';
      wave.style.animationDuration = `${lifeMs}ms`;

      layer.appendChild(wave);
      setTimeout(()=>{ try{ wave.remove(); }catch(_){ } }, lifeMs + 80);
    }catch(_){}
  }

  function celebrate(){
    // multiple bursts around upper-middle (kid-friendly fireworks)
    const W = doc.documentElement.clientWidth || innerWidth || 1;
    const H = doc.documentElement.clientHeight || innerHeight || 1;
    const cx = W/2, cy = H*0.35;

    for(let i=0;i<10;i++){
      setTimeout(()=>{
        const x = cx + rnd(-W*0.22, W*0.22);
        const y = cy + rnd(-H*0.10, H*0.12);
        shockwave(x,y,{r: rnd(50, 92), lifeMs: rnd(420, 720)});
        burst(x,y,{r: rnd(26, 74), n: Math.round(rnd(14, 32)), lifeMs: rnd(420, 820)});
      }, i*55);
    }
    // big center pop
    setTimeout(()=>popText(cx, cy-20, '🎉', 'perfect'), 80);
  }

  // ---------------- compatibility helpers ----------------
  function scorePop(x,y,text){
    popText(x,y,text,'score');
  }

  function burstAt(x,y,kind='good'){
    const k = String(kind||'').toLowerCase();
    if(k.includes('bad') || k.includes('junk')){
      shockwave(x,y,{r:78, lifeMs:560});
      burst(x,y,{r:64, n:26, lifeMs:580});
      popText(x,y,'-','bad');
      return;
    }
    if(k.includes('block') || k.includes('shield')){
      burst(x,y,{r:46, n:16, lifeMs:460});
      popText(x,y,'BLOCK','good');
      return;
    }
    if(k.includes('star')){
      shockwave(x,y,{r:64, lifeMs:540});
      burst(x,y,{r:58, n:22, lifeMs:600});
      popText(x,y,'⭐','perfect');
      return;
    }
    if(k.includes('diamond')){
      shockwave(x,y,{r:90, lifeMs:700});
      burst(x,y,{r:82, n:34, lifeMs:820});
      popText(x,y,'💎','perfect');
      return;
    }
    // default good
    shockwave(x,y,{r:64, lifeMs:520});
    burst(x,y,{r:56, n:22, lifeMs:520});
    popText(x,y,'+','good');
  }

  // ---------------- expose ----------------
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compat
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt  = burstAt;

  // also mirror under GAME_MODULES for older code paths
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);