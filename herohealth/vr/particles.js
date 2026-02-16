// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (universal FX layer)
// Safe for all games. No dependencies.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------- layer ----------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.setAttribute('aria-hidden','true');

    // IMPORTANT: fixed at top, separate from game layers (prevents "effect disappear")
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9995',
      'overflow:visible',
      'contain:layout style paint',
      'transform:translateZ(0)',
      'will-change:transform',
    ].join(';');

    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- css ----------
  (function injectCss(){
    const id = 'hha-particles-style';
    if (doc.getElementById(id)) return;

    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-layer *{ box-sizing:border-box; }

      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.65);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 520ms ease-out forwards;
        letter-spacing:.2px;
      }
      .hha-pop.big{ font-size:22px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.55)); }
      .hha-pop.perfect{ font-size:24px; }
      .hha-pop.boss{ font-size:22px; }
      .hha-pop.rage{ font-size:22px; }
      .hha-pop.block{ font-size:18px; }

      @keyframes hhaPop{
        0%   { transform:translate(-50%,-50%) scale(.92); opacity:.92; }
        55%  { transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100% { transform:translate(-50%,-105%) scale(1.06); opacity:0; }
      }

      .hha-dot{
        position:absolute;
        width:8px; height:8px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        opacity:.95;
        filter: drop-shadow(0 10px 14px rgba(0,0,0,.35));
        will-change: transform, opacity;
        animation: hhaDotFly var(--life,520ms) cubic-bezier(.15,.85,.1,1) forwards;
      }
      @keyframes hhaDotFly{
        0%   { transform:translate(-50%,-50%) translate3d(0,0,0) scale(1); opacity:1; }
        75%  { opacity:.95; }
        100% { transform:translate(-50%,-50%) translate3d(var(--dx,0px),var(--dy,0px),0) scale(.88); opacity:0; }
      }

      .hha-ring{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        transform: translate(-50%,-50%) scale(.2);
        opacity:.85;
        border: 2px solid rgba(255,255,255,.85);
        box-shadow: 0 0 0 0 rgba(255,255,255,.18);
        will-change: transform, opacity;
        animation: hhaRing 420ms ease-out forwards;
      }
      @keyframes hhaRing{
        0%   { transform:translate(-50%,-50%) scale(.20); opacity:.65; }
        55%  { opacity:.95; }
        100% { transform:translate(-50%,-50%) scale(var(--rs,6)); opacity:0; }
      }

      .hha-confetti{
        position:absolute;
        width:8px; height:12px;
        border-radius:3px;
        transform: translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaConfetti var(--life,980ms) cubic-bezier(.15,.85,.1,1) forwards;
      }
      @keyframes hhaConfetti{
        0%   { transform:translate(-50%,-50%) translate3d(0,0,0) rotate(0deg); opacity:1; }
        90%  { opacity:.92; }
        100% { transform:translate(-50%,-50%) translate3d(var(--dx,0px),var(--dy,0px),0) rotate(var(--rot,220deg)); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- helpers ----------
  function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
  function rnd(a,b){ return a + Math.random()*(b-a); }
  function now(){ return performance.now(); }

  function mount(el, lifeMs){
    const layer = ensureLayer();
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, Math.max(60, lifeMs|0));
  }

  function makeEl(cls, x, y){
    const el = doc.createElement('div');
    el.className = cls;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    return el;
  }

  // ---------- api ----------
  function popText(x,y,text,cls){
    const el = makeEl('hha-pop' + (cls ? ` ${cls}` : ''), x, y);
    el.textContent = String(text ?? '');
    // if it’s a big number, bump
    const t = String(text ?? '');
    if (t.length >= 6 || t.includes('PERFECT') || t.includes('BOSS') || t.includes('RAGE')) {
      el.classList.add('big');
    }
    mount(el, 620);
  }

  function burst(x,y, opt){
    opt = opt || {};
    const r = clamp(opt.r ?? 46, 16, 140);
    const n = clamp(opt.n ?? Math.round(r/6), 6, 42);
    const lifeMs = clamp(opt.lifeMs ?? 520, 220, 1200);
    const spread = clamp(opt.spread ?? 1.0, 0.4, 1.8);

    for(let i=0;i<n;i++){
      const el = makeEl('hha-dot', x, y);

      const ang = rnd(0, Math.PI*2);
      const dist = rnd(r*0.35, r) * spread;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist + rnd(-r*0.15, r*0.25);

      const size = rnd(6, 11);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      // color: keep it readable across games
      const hue = rnd(0, 360);
      const sat = rnd(65, 92);
      const lit = rnd(58, 70);
      el.style.background = `hsl(${hue} ${sat}% ${lit}%)`;

      el.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      el.style.setProperty('--life', `${lifeMs}ms`);

      mount(el, lifeMs + 120);
    }
  }

  function shockwave(x,y,opt){
    opt = opt || {};
    const r = clamp(opt.r ?? 72, 26, 190);
    const lifeMs = clamp(opt.lifeMs ?? 420, 220, 900);

    const el = makeEl('hha-ring', x, y);
    el.style.setProperty('--rs', String(clamp(r/12, 3.2, 12)));
    el.style.animationDuration = `${lifeMs}ms`;
    mount(el, lifeMs + 120);
  }

  function celebrate(){
    // confetti burst from top center-ish
    const W = doc.documentElement.clientWidth || innerWidth;
    const H = doc.documentElement.clientHeight || innerHeight;

    const cx = W * (0.45 + Math.random()*0.10);
    const cy = H * (0.20 + Math.random()*0.08);

    const n = 36 + Math.floor(Math.random()*18);
    const lifeMs = 980;

    for(let i=0;i<n;i++){
      const el = makeEl('hha-confetti', cx, cy);

      const ang = rnd(-Math.PI*0.95, -Math.PI*0.05);
      const dist = rnd(H*0.25, H*0.65);
      const dx = Math.cos(ang) * dist + rnd(-W*0.08, W*0.08);
      const dy = Math.sin(ang) * dist + rnd(H*0.35, H*0.62); // fall

      el.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      el.style.setProperty('--rot', `${rnd(-540,540).toFixed(0)}deg`);
      el.style.setProperty('--life', `${lifeMs}ms`);

      const w = rnd(6,10), h = rnd(10,16);
      el.style.width = `${w}px`;
      el.style.height= `${h}px`;

      const hue = rnd(0, 360);
      el.style.background = `hsl(${hue} 90% 62%)`;

      mount(el, lifeMs + 120);
    }

    // add an extra shockwave for punch
    shockwave(W/2, H*0.30, { r: 140, lifeMs: 520 });
  }

  // ---------- export ----------
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compatibility helpers (older code may call these)
  root.Particles.scorePop = function(x,y,text){ popText(x,y,text,'score'); };
  root.Particles.burstAt  = function(x,y,kind){
    // kind hint -> tweak radius a bit
    const r = (kind==='bad') ? 70 : (kind==='block') ? 54 : (kind==='star') ? 66 : 58;
    burst(x,y,{ r });
    shockwave(x,y,{ r: r+14, lifeMs: 380 });
  };

  // tiny self-test (dev)
  root.HHA_PARTICLES_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    popText(x,y,'+13','score');
    setTimeout(()=>{ burst(x+70,y-10,{r:64}); }, 120);
    setTimeout(()=>{ shockwave(x-60,y+10,{r:110}); }, 240);
    setTimeout(()=>{ popText(x,y-80,'PERFECT!','perfect'); }, 320);
    setTimeout(()=>{ celebrate(); }, 600);
  };

})(window);