// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (PRODUCTION SAFE)
// Provides:
// - Particles.popText(x,y,text,cls?)
// - Particles.burst(x,y,{r?})
// - Particles.shockwave(x,y,{r?})
// - Particles.celebrate()
// Also exposes: window.GAME_MODULES.Particles (compatible)

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  // ---------- layer ----------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- helpers ----------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  function now(){ return performance.now(); }
  function rand(a,b){ return a + (b-a)*Math.random(); }
  function px(n){ return Math.round(n) + 'px'; }

  function el(tag, cssText){
    const e = doc.createElement(tag);
    if(cssText) e.style.cssText = cssText;
    return e;
  }

  // ---------- style ----------
  (function injectStyle(){
    const id = 'hha-particles-ultra-style';
    if(doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.90); opacity:.95; }
        60%{ transform:translate(-50%,-80%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-105%) scale(1.05); opacity:0; }
      }
      @keyframes hhaBurstDot{
        0%{ transform: translate3d(var(--dx), var(--dy), 0) scale(.75); opacity:1; }
        100%{ transform: translate3d(calc(var(--dx) * 1.2), calc(var(--dy) * 1.2), 0) scale(.4); opacity:0; }
      }
      @keyframes hhaShock{
        0%{ transform: translate(-50%,-50%) scale(.25); opacity:.85; }
        55%{ opacity:.55; }
        100%{ transform: translate(-50%,-50%) scale(1.25); opacity:0; }
      }
      @keyframes hhaConfetti{
        0%{ transform: translate3d(var(--dx), var(--dy),0) rotate(var(--rot)) scale(1); opacity:1; }
        100%{ transform: translate3d(calc(var(--dx)*1.4), calc(var(--dy)*1.4 + 220px),0) rotate(calc(var(--rot) + 260deg)) scale(.85); opacity:0; }
      }
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 8px 24px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 520ms ease-out forwards;
        padding: 0 6px;
        border-radius: 10px;
        background: rgba(2,6,23,.10);
        backdrop-filter: blur(2px);
      }
      .hha-pop.big{ font-size: 22px; font-weight: 1200; }
      .hha-pop.perfect{ font-size: 22px; font-weight: 1300; }
      .hha-pop.score{ }
      .hha-pop.bad{ opacity:.95; }
      .hha-dot{
        position:absolute; left:0; top:0;
        width:10px; height:10px; border-radius:999px;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 22px rgba(0,0,0,.35);
        will-change: transform, opacity;
        transform: translate3d(var(--dx), var(--dy), 0);
        animation: hhaBurstDot var(--dur) ease-out forwards;
      }
      .hha-shock{
        position:absolute;
        width: 18px; height: 18px;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,.70);
        box-shadow: 0 0 0 2px rgba(255,255,255,.08), 0 18px 34px rgba(0,0,0,.35);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaShock 520ms ease-out forwards;
      }
      .hha-conf{
        position:absolute;
        width: 10px; height: 14px;
        border-radius: 4px;
        background: rgba(255,255,255,.92);
        box-shadow: 0 12px 28px rgba(0,0,0,.30);
        will-change: transform, opacity;
        transform: translate3d(var(--dx), var(--dy),0) rotate(var(--rot));
        animation: hhaConfetti var(--dur) ease-out forwards;
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- API ----------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const e = el('div');
    e.className = 'hha-pop' + (cls ? ` ${cls}` : '');
    e.textContent = String(text ?? '');
    e.style.left = px(x);
    e.style.top  = px(y);
    layer.appendChild(e);
    setTimeout(()=>{ try{ e.remove(); }catch(_){} }, 700);
  }

  function burst(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(Number(opt?.r ?? 46), 18, 120);
    const n = clamp(Math.round(r/4), 10, 26);
    for(let i=0;i<n;i++){
      const ang = (Math.PI*2) * (i/n) + rand(-0.25,0.25);
      const dist = rand(r*0.55, r*1.15);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;

      const d = el('div');
      d.className = 'hha-dot';
      d.style.left = px(x);
      d.style.top  = px(y);
      d.style.setProperty('--dx', px(dx));
      d.style.setProperty('--dy', px(dy));
      d.style.setProperty('--dur', `${Math.round(rand(260, 520))}ms`);

      // tiny variation
      const s = rand(7, 12);
      d.style.width = px(s);
      d.style.height = px(s);

      layer.appendChild(d);
      setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 700);
    }
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(Number(opt?.r ?? 66), 22, 140);

    const s = el('div');
    s.className = 'hha-shock';
    s.style.left = px(x);
    s.style.top  = px(y);

    // make ring size scale a bit by r
    const base = clamp(Math.round(r*0.18), 14, 28);
    s.style.width  = px(base);
    s.style.height = px(base);

    layer.appendChild(s);
    setTimeout(()=>{ try{ s.remove(); }catch(_){} }, 820);

    // plus a burst for punch
    burst(x,y,{ r: r*0.85 });
  }

  function celebrate(){
    const layer = ensureLayer();
    const cx = innerWidth/2, cy = innerHeight*0.28;
    const n = 28;
    for(let i=0;i<n;i++){
      const c = el('div');
      c.className = 'hha-conf';
      c.style.left = px(cx);
      c.style.top  = px(cy);

      const dx = rand(-220, 220);
      const dy = rand(-110, 90);
      c.style.setProperty('--dx', px(dx));
      c.style.setProperty('--dy', px(dy));
      c.style.setProperty('--rot', `${Math.round(rand(-180,180))}deg`);
      c.style.setProperty('--dur', `${Math.round(rand(520, 920))}ms`);

      // size variety
      c.style.width  = px(rand(8, 12));
      c.style.height = px(rand(10, 16));
      c.style.opacity = String(rand(0.85, 1));

      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){} }, 1100);
    }
  }

  // public
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compat
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);