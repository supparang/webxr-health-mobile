// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX core)
// ✅ ensureLayer(): fixed overlay, pointer-events:none
// ✅ popText(x,y,text,cls)
// ✅ burst(x,y,{r,n})
// ✅ shockwave(x,y,{r})
// ✅ burstAt(x,y,kind) : good/bad/block/star/shield/diamond/boss/perfect
// ✅ celebrate(kind)   : win/mini/boss/end/grade
// NOTE: Designed to be safe if called frequently (auto GC/remove)

(function (root) {
  'use strict';
  const WIN = root;
  const DOC = root.document;
  if (!DOC || WIN.__HHA_PARTICLES_ULTRA__) return;
  WIN.__HHA_PARTICLES_ULTRA__ = true;

  const CFG = Object.assign({
    z: 120,                 // overlay z-index (keep under vr-ui buttons ~185)
    maxNodes: 140,          // safety cap
    popLifeMs: 650,
    burstLifeMs: 520,
    waveLifeMs: 520,
    celebrateBursts: 10,
    reduceMotion: false
  }, WIN.HHA_PARTICLES_CFG || {});

  // -------- helpers --------
  function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
  function rnd(){ return Math.random(); }
  function now(){ return performance.now(); }

  function prefersReduce(){
    try{
      if (CFG.reduceMotion) return true;
      return WIN.matchMedia && WIN.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(_){ return false; }
  }

  // -------- layer + css --------
  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${CFG.z};overflow:hidden;`;
    DOC.body.appendChild(layer);
    return layer;
  }

  function pruneLayer(){
    const layer = DOC.querySelector('.hha-fx-layer');
    if(!layer) return;
    const kids = layer.children;
    if(kids.length <= CFG.maxNodes) return;
    const extra = kids.length - CFG.maxNodes;
    for(let i=0;i<extra;i++){
      try{ kids[i].remove(); }catch(_){}
    }
  }

  function injectCss(){
    if (DOC.getElementById('hha-particles-ultra-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-particles-ultra-style';
    st.textContent = `
      .hha-fx-layer { contain: strict; }

      /* text pop */
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        letter-spacing:.2px;
        opacity:.98;
        will-change: transform, opacity, filter;
        text-shadow: 0 10px 26px rgba(0,0,0,.58);
        animation: hhaPopUp 620ms ease-out forwards;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.40);
        backdrop-filter: blur(6px);
      }
      @keyframes hhaPopUp{
        0%   { transform:translate(-50%,-50%) scale(.90); opacity:.10; filter:blur(.4px); }
        18%  { transform:translate(-50%,-60%) scale(1.06); opacity:1; filter:none; }
        70%  { transform:translate(-50%,-86%) scale(1.10); opacity:.92; }
        100% { transform:translate(-50%,-108%) scale(1.00); opacity:0; filter:blur(.8px); }
      }

      /* burst dots */
      .hha-dot{
        position:absolute;
        width: 8px; height: 8px;
        border-radius: 999px;
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaDot 520ms cubic-bezier(.2,.9,.2,1) forwards;
        box-shadow: 0 14px 28px rgba(0,0,0,.25);
      }
      @keyframes hhaDot{
        0%   { transform:translate(-50%,-50%) scale(.85); opacity:.85; }
        60%  { opacity: .95; }
        100% { transform: translate(var(--dx), var(--dy)) scale(.55); opacity:0; }
      }

      /* shockwave ring */
      .hha-wave{
        position:absolute;
        width: 10px; height: 10px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,.62);
        opacity: .0;
        transform: translate(-50%,-50%) scale(.2);
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
        box-shadow: 0 20px 70px rgba(0,0,0,.18);
      }
      @keyframes hhaWave{
        0%   { opacity: .00; transform:translate(-50%,-50%) scale(.20); }
        15%  { opacity: .55; }
        100% { opacity: 0; transform:translate(-50%,-50%) scale(var(--s)); }
      }

      /* theme tints (no hard-coded palette requirement; still uses CSS variables for easy override) */
      .fx-good    { color: var(--fx-good, #eafff3); border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.14); }
      .fx-bad     { color: var(--fx-bad,  #fff1f2); border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.14); }
      .fx-block   { color: var(--fx-block,#ecfeff); border-color: rgba(34,211,238,.35); background: rgba(34,211,238,.12); }
      .fx-star    { color: var(--fx-star, #fffbea); border-color: rgba(245,158,11,.38); background: rgba(245,158,11,.12); }
      .fx-shield  { color: var(--fx-shield,#ecfeff); border-color: rgba(59,130,246,.35); background: rgba(59,130,246,.12); }
      .fx-diamond { color: var(--fx-dia,  #f5f3ff); border-color: rgba(167,139,250,.38); background: rgba(167,139,250,.12); }
      .fx-boss    { color: var(--fx-boss, #fff7ed); border-color: rgba(249,115,22,.40); background: rgba(249,115,22,.12); }
      .fx-perfect { color: var(--fx-perf, #fdf4ff); border-color: rgba(236,72,153,.40); background: rgba(236,72,153,.12); }
      .fx-end     { font-size: 20px; font-weight: 1000; }

      /* reduced motion */
      @media (prefers-reduced-motion: reduce){
        .hha-pop, .hha-dot, .hha-wave{ animation-duration: 1ms !important; }
      }
    `;
    DOC.head.appendChild(st);
  }

  injectCss();

  // -------- public api --------
  function popText(x, y, text, cls){
    if(text == null || text === '') return;
    const layer = ensureLayer();
    pruneLayer();

    const el = DOC.createElement('div');
    el.className = 'hha-pop' + (cls ? (' ' + cls) : '');
    el.textContent = String(text);
    el.style.left = `${Math.round(Number(x)||0)}px`;
    el.style.top  = `${Math.round(Number(y)||0)}px`;

    layer.appendChild(el);
    const life = prefersReduce() ? 40 : CFG.popLifeMs;
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, life);
  }

  function burst(x, y, opts){
    const layer = ensureLayer();
    pruneLayer();

    const r = clamp(opts?.r ?? 48, 18, 140);
    const n = clamp(opts?.n ?? 10, 5, 26);

    const cx = Math.round(Number(x)||0);
    const cy = Math.round(Number(y)||0);

    const reduced = prefersReduce();
    const life = reduced ? 40 : CFG.burstLifeMs;

    for(let i=0;i<n;i++){
      const a = (i / n) * Math.PI * 2 + rnd()*0.35;
      const rr = r * (0.65 + rnd()*0.45);
      const dx = Math.cos(a) * rr;
      const dy = Math.sin(a) * rr;

      const dot = DOC.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = `${cx}px`;
      dot.style.top  = `${cy}px`;
      dot.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      dot.style.setProperty('--dy', `${dy.toFixed(1)}px`);

      // tiny size variance
      const sz = clamp(6 + rnd()*7, 6, 14);
      dot.style.width = `${sz}px`;
      dot.style.height= `${sz}px`;

      // brightness by distance
      dot.style.opacity = String(0.75 + rnd()*0.25);

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, life);
    }
  }

  function shockwave(x, y, opts){
    const layer = ensureLayer();
    pruneLayer();

    const r = clamp(opts?.r ?? 56, 18, 180);
    const cx = Math.round(Number(x)||0);
    const cy = Math.round(Number(y)||0);

    const wave = DOC.createElement('div');
    wave.className = 'hha-wave';
    wave.style.left = `${cx}px`;
    wave.style.top  = `${cy}px`;
    wave.style.setProperty('--s', String((r/10).toFixed(2)));

    layer.appendChild(wave);

    const reduced = prefersReduce();
    const life = reduced ? 40 : CFG.waveLifeMs;
    setTimeout(()=>{ try{ wave.remove(); }catch(_){ } }, life);
  }

  function burstAt(x, y, kind){
    const k = String(kind || 'good').toLowerCase();
    const cls =
      (k==='good') ? 'fx-good' :
      (k==='bad')  ? 'fx-bad' :
      (k==='miss') ? 'fx-bad' :
      (k==='block')? 'fx-block' :
      (k==='star') ? 'fx-star' :
      (k==='shield')? 'fx-shield' :
      (k==='diamond')? 'fx-diamond' :
      (k==='boss') ? 'fx-boss' :
      (k==='perfect') ? 'fx-perfect' :
      '';

    // wave + burst tuning
    if(k==='good'){
      shockwave(x,y,{r:54});
      burst(x,y,{r:52,n:12});
    }else if(k==='bad' || k==='miss'){
      shockwave(x,y,{r:66});
      burst(x,y,{r:62,n:14});
    }else if(k==='block'){
      shockwave(x,y,{r:48});
      burst(x,y,{r:46,n:10});
    }else if(k==='star'){
      shockwave(x,y,{r:58});
      burst(x,y,{r:56,n:12});
    }else if(k==='shield'){
      shockwave(x,y,{r:52});
      burst(x,y,{r:50,n:11});
    }else if(k==='diamond'){
      shockwave(x,y,{r:70});
      burst(x,y,{r:74,n:16});
    }else if(k==='boss'){
      shockwave(x,y,{r:92});
      burst(x,y,{r:96,n:18});
    }else if(k==='perfect'){
      shockwave(x,y,{r:78});
      burst(x,y,{r:82,n:16});
    }else{
      burst(x,y,{r:52,n:12});
    }

    // subtle label for big hits
    if(k==='diamond') popText(x,y,'+BONUS','fx-diamond');
    if(k==='boss') popText(x,y,'BOSS!','fx-boss');
    if(k==='perfect') popText(x,y,'PERFECT!','fx-perfect');

    // NOTE: dot colors are handled by CSS (text only). Dots are neutral by design.
    // If you want colored dots later, we can add per-dot CSS vars.
    return cls;
  }

  function celebrate(kind){
    const cW = DOC.documentElement.clientWidth || 360;
    const cH = DOC.documentElement.clientHeight || 640;
    const cx = cW * 0.5;
    const cy = cH * 0.35;

    const k = String(kind || 'win').toLowerCase();
    const bursts = clamp(
      (k==='boss') ? 14 :
      (k==='mini') ? 10 :
      (k==='end')  ? 12 :
      10,
      6, 18
    );

    const reduced = prefersReduce();
    const gap = reduced ? 5 : 55;

    for(let i=0;i<bursts;i++){
      setTimeout(()=>{
        const x = cx + (rnd()*2-1)*160;
        const y = cy + (rnd()*2-1)*90;
        const r = 26 + rnd()*62;
        burst(x,y,{r, n: 12 + Math.floor(rnd()*8)});
        shockwave(x,y,{r: 44 + rnd()*70});
      }, i * gap);
    }
  }

  // expose
  WIN.Particles = WIN.Particles || {};
  WIN.Particles.popText = popText;
  WIN.Particles.burst = burst;
  WIN.Particles.shockwave = shockwave;
  WIN.Particles.burstAt = burstAt;
  WIN.Particles.celebrate = celebrate;

  // dev probe
  WIN.HHA_PARTICLES_TEST = function(){
    const w = DOC.documentElement.clientWidth||360;
    const h = DOC.documentElement.clientHeight||640;
    const x = w/2, y = h/2;
    popText(x,y,'+25','fx-good');
    burstAt(x,y,'good');
    setTimeout(()=>burstAt(x-90,y+20,'bad'), 160);
    setTimeout(()=>burstAt(x+90,y-10,'block'), 300);
    setTimeout(()=>burstAt(x,y-90,'diamond'), 440);
    setTimeout(()=>celebrate('boss'), 640);
  };

})(window);