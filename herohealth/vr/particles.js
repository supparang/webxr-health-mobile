// === /herohealth/vr/particles.js ===
// HHA Particles — PACK-FAIR (Universal)
// ✅ Safe: pointer-events none, never blocks gameplay
// ✅ Rate limited (anti-spam) + auto GC
// ✅ FX layer z-index above game, below critical overlays if needed
// ✅ API:
//    - popText(x,y,text,cls?,opts?)
//    - burstAt(x,y,kind?,opts?)
//    - ringPulse(x,y,kind?,opts?)
//    - celebrate(kind?,opts?)
// Exposes: window.Particles and window.GAME_MODULES.Particles

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------------- basic utils ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const rnd = (a,b)=> a + (b-a) * Math.random();
  const now = ()=> performance.now();

  function px(n){ return Math.round(Number(n)||0) + 'px'; }

  // ---------------- layer ----------------
  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:90',               // 👈 ถ้าเกมใดมี overlay สูงกว่า ก็ปรับที่เกมนั้นได้
      'overflow:hidden'
    ].join(';');

    DOC.body.appendChild(layer);
    injectCSS();
    return layer;
  }

  // ---------------- style ----------------
  let __cssInjected = false;
  function injectCSS(){
    if(__cssInjected) return;
    __cssInjected = true;

    const st = DOC.createElement('style');
    st.textContent = `
      .hha-fx-item{
        position:absolute;
        left:0; top:0;
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        user-select:none;
        pointer-events:none;
        font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      /* ---- pop text ---- */
      .hha-pop{
        font-weight: 1000;
        font-size: 16px;
        line-height: 1;
        color: #fff;
        text-shadow: 0 2px 0 rgba(0,0,0,.35);
        opacity: 0;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-pop.good{ color:#eafff3; }
      .hha-pop.bad { color:#ffe4e6; }
      .hha-pop.warn{ color:#fff7ed; }
      .hha-pop.cyan{ color:#ecfeff; }
      .hha-pop.violet{ color:#f5f3ff; }

      @keyframes hhaPop{
        0%   { opacity:0; transform: translate(-50%,-50%) scale(.92); }
        12%  { opacity:1; }
        55%  { opacity:1; transform: translate(-50%,-75%) scale(1.06); }
        100% { opacity:0; transform: translate(-50%,-95%) scale(1.02); }
      }

      /* ---- burst dots ---- */
      .hha-dot{
        width: 8px; height: 8px;
        border-radius: 999px;
        opacity: 0;
        animation: hhaDot 520ms ease-out forwards;
      }
      @keyframes hhaDot{
        0%   { opacity:0; transform: translate(-50%,-50%) scale(.8); }
        10%  { opacity:1; }
        100% { opacity:0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.35); }
      }

      /* ---- ring pulse ---- */
      .hha-ring{
        width: 120px; height:120px;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,.75);
        opacity: 0;
        animation: hhaRing 520ms ease-out forwards;
      }
      @keyframes hhaRing{
        0%   { opacity:0; transform: translate(-50%,-50%) scale(.65); }
        12%  { opacity:1; }
        100% { opacity:0; transform: translate(-50%,-50%) scale(1.15); }
      }

      /* ---- celebrate confetti (fair) ---- */
      .hha-conf{
        width: 10px; height: 14px;
        border-radius: 4px;
        opacity: 0;
        animation: hhaConf 900ms linear forwards;
      }
      @keyframes hhaConf{
        0%   { opacity:0; transform: translate(-50%,-50%) rotate(0deg); }
        10%  { opacity:1; }
        100% { opacity:0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(420deg); }
      }
    `;
    DOC.head.appendChild(st);
  }

  // ---------------- rate limiting ----------------
  // กัน spam: pop/burst/ring ต่อเนื่องมากเกินไป
  const RL = {
    pop:  { t:0, minGap: 40 },   // ms
    burst:{ t:0, minGap: 55 },
    ring: { t:0, minGap: 80 },
    conf: { t:0, minGap: 450 },
  };
  function okRate(key){
    const r = RL[key];
    const t = now();
    if(t - r.t < r.minGap) return false;
    r.t = t;
    return true;
  }

  // ---------------- kind palette (no hard colors, but safe defaults) ----------------
  function kindClass(kind){
    kind = String(kind||'').toLowerCase();
    if(kind==='bad' || kind==='junk') return 'bad';
    if(kind==='warn' || kind==='star') return 'warn';
    if(kind==='cyan' || kind==='shield') return 'cyan';
    if(kind==='violet' || kind==='diamond') return 'violet';
    return 'good';
  }

  // ---------------- FX impl ----------------
  function popText(x,y,text,cls=null,opts=null){
    if(!okRate('pop')) return;
    const layer = ensureLayer();

    const el = DOC.createElement('div');
    el.className = `hha-fx-item hha-pop ${kindClass(cls||'good')}`;
    el.textContent = String(text ?? '');

    const size = opts && opts.size ? Number(opts.size) : null;
    if(size) el.style.fontSize = px(size);

    el.style.left = px(x);
    el.style.top  = px(y);

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 700);
  }

  function burstAt(x,y,kind='good',opts=null){
    if(!okRate('burst')) return;
    const layer = ensureLayer();

    const count = clamp((opts && opts.count) ? Number(opts.count) : 10, 6, 14);
    const spread = clamp((opts && opts.spread) ? Number(opts.spread) : 54, 38, 78);

    for(let i=0;i<count;i++){
      const dot = DOC.createElement('div');
      dot.className = 'hha-fx-item hha-dot';
      dot.style.left = px(x);
      dot.style.top  = px(y);

      // fair sizing
      const s = rnd(6, 10);
      dot.style.width = px(s);
      dot.style.height = px(s);

      // direction
      const a = rnd(0, Math.PI*2);
      const r = rnd(spread*0.45, spread);
      dot.style.setProperty('--dx', px(Math.cos(a)*r));
      dot.style.setProperty('--dy', px(Math.sin(a)*r));

      // tone by kind (use opacity only; avoid heavy colors)
      const tone = kindClass(kind);
      if(tone==='bad') dot.style.background = 'rgba(248,113,113,.85)';
      else if(tone==='warn') dot.style.background = 'rgba(251,191,36,.85)';
      else if(tone==='cyan') dot.style.background = 'rgba(34,211,238,.85)';
      else if(tone==='violet') dot.style.background = 'rgba(167,139,250,.85)';
      else dot.style.background = 'rgba(34,197,94,.85)';

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){} }, 700);
    }
  }

  function ringPulse(x,y,kind='good',opts=null){
    if(!okRate('ring')) return;
    const layer = ensureLayer();

    const ring = DOC.createElement('div');
    ring.className = 'hha-fx-item hha-ring';

    const size = clamp((opts && opts.size) ? Number(opts.size) : 140, 90, 320);
    ring.style.width = px(size);
    ring.style.height = px(size);

    const tone = kindClass(kind);
    if(tone==='bad') ring.style.borderColor = 'rgba(248,113,113,.75)';
    else if(tone==='warn') ring.style.borderColor = 'rgba(251,191,36,.78)';
    else if(tone==='cyan') ring.style.borderColor = 'rgba(34,211,238,.78)';
    else if(tone==='violet') ring.style.borderColor = 'rgba(167,139,250,.78)';
    else ring.style.borderColor = 'rgba(34,197,94,.78)';

    ring.style.left = px(x);
    ring.style.top  = px(y);

    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, 700);
  }

  function celebrate(kind='win', opts=null){
    if(!okRate('conf')) return;
    const layer = ensureLayer();

    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    const count = clamp((opts && opts.count) ? Number(opts.count) : 16, 10, 26);

    for(let i=0;i<count;i++){
      const c = DOC.createElement('div');
      c.className = 'hha-fx-item hha-conf';

      // spawn near top
      const x = rnd(W*0.22, W*0.78);
      const y = rnd(H*0.18, H*0.30);
      c.style.left = px(x);
      c.style.top  = px(y);

      const a = rnd(Math.PI*0.65, Math.PI*1.35);
      const r = rnd(220, 420);
      c.style.setProperty('--dx', px(Math.cos(a)*r));
      c.style.setProperty('--dy', px(Math.sin(a)*r + rnd(180, 320)));

      // small palette (still fair)
      const t = (i % 5);
      if(t===0) c.style.background = 'rgba(34,197,94,.9)';
      else if(t===1) c.style.background = 'rgba(34,211,238,.9)';
      else if(t===2) c.style.background = 'rgba(251,191,36,.9)';
      else if(t===3) c.style.background = 'rgba(167,139,250,.9)';
      else c.style.background = 'rgba(248,113,113,.9)';

      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){} }, 1100);
    }
  }

  // legacy alias (บางเกมเรียก)
  function scorePop(x,y,text){ popText(x,y,text,'good'); }

  // export
  const API = { popText, burstAt, ringPulse, celebrate, scorePop };

  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(window);