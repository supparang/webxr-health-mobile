// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (Unified FX Layer)
// ✅ Global FX layer (DOM) z-index:90 pointer-events:none
// ✅ API stable across games:
//    Particles.popText(x,y,text,cls?)
//    Particles.burst(x,y,count?,cls?)
//    Particles.celebrate(durationMs?)
//    Particles.shock(x,y,cls?)
// ✅ Expose: window.Particles + window.GAME_MODULES.Particles
// ✅ No deps, safe for <script defer>

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------- style (inject once) ----------
  (function injectStyle(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-fx-layer{
        position:fixed; inset:0;
        pointer-events:none;
        z-index:90;
        overflow:hidden;
      }
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
        color:#fff;
        text-shadow: 0 10px 30px rgba(0,0,0,.6), 0 2px 0 rgba(0,0,0,.35);
        opacity:0;
        animation: hhaPop 620ms ease-out forwards;
        will-change: transform, opacity, filter;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.45));
        white-space:nowrap;
      }
      @keyframes hhaPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.9); }
        12%{ opacity:1; transform:translate(-50%,-55%) scale(1.08); }
        100%{ opacity:0; transform:translate(-50%,-95%) scale(1.15); }
      }

      .hha-particle{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        opacity:.95;
        transform: translate(-50%,-50%);
        background: rgba(34,211,238,.95);
        box-shadow: 0 16px 40px rgba(0,0,0,.35);
        animation: hhaParticle 620ms ease-out forwards;
        will-change: transform, opacity;
      }
      @keyframes hhaParticle{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.6); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(.35); }
      }

      .hha-shock{
        position:absolute;
        width: 10px; height: 10px;
        border-radius:999px;
        border:2px solid rgba(34,211,238,.55);
        transform: translate(-50%,-50%);
        opacity:.9;
        animation: hhaShock 420ms ease-out forwards;
        filter: blur(.2px);
      }
      @keyframes hhaShock{
        0%{ transform: translate(-50%,-50%) scale(1); opacity:.85; }
        100%{ transform: translate(-50%,-50%) scale(18); opacity:0; }
      }

      body.hha-celebrate{
        animation: hhaCelebrate 650ms ease-in-out infinite;
      }
      @keyframes hhaCelebrate{
        0%,100%{ filter: brightness(1) saturate(1); }
        50%{ filter: brightness(1.10) saturate(1.12); }
      }

      /* Optional class modifiers */
      .fx-good{ color: rgba(34,197,94,.98); }
      .fx-bad{ color: rgba(239,68,68,.98); }
      .fx-warn{ color: rgba(245,158,11,.98); }
      .fx-cyan{ color: rgba(34,211,238,.98); }
      .fx-violet{ color: rgba(168,85,247,.98); }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- layer ----------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- helpers ----------
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const rand = ()=> Math.random(); // particles are visual only; ok to be non-deterministic
  function safeRemove(el, ms){
    setTimeout(()=>{ try{ el && el.remove(); }catch(_){ } }, ms|0);
  }

  // ---------- API ----------
  function popText(x,y,text,cls=''){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? (' '+cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    safeRemove(el, 740);
    return el;
  }

  function burst(x,y,count=14,cls=''){
    const layer = ensureLayer();
    const n = clamp(count, 4, 36)|0;
    const base = 120 + rand()*80;

    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.className = 'hha-particle' + (cls ? (' '+cls) : '');
      p.style.left = (Number(x)||0) + 'px';
      p.style.top  = (Number(y)||0) + 'px';

      const ang = (Math.PI*2) * (i/n) + (rand()*0.35);
      const mag = base * (0.55 + rand()*0.65);
      const dx = Math.cos(ang) * mag;
      const dy = Math.sin(ang) * mag * (0.75 + rand()*0.35);

      p.style.setProperty('--dx', dx.toFixed(1)+'px');
      p.style.setProperty('--dy', dy.toFixed(1)+'px');

      // slight size variance
      const s = 8 + rand()*10;
      p.style.width = s.toFixed(1)+'px';
      p.style.height = s.toFixed(1)+'px';

      layer.appendChild(p);
      safeRemove(p, 760);
    }
  }

  function shock(x,y,cls=''){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-shock' + (cls ? (' '+cls) : '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    safeRemove(el, 520);
    return el;
  }

  let celebrateTimer = null;
  function celebrate(durationMs=1200){
    const ms = clamp(durationMs, 250, 6000);
    try{
      doc.body.classList.add('hha-celebrate');
      clearTimeout(celebrateTimer);
      celebrateTimer = setTimeout(()=> {
        try{ doc.body.classList.remove('hha-celebrate'); }catch(_){}
      }, ms);
    }catch(_){}
  }

  // ---------- expose ----------
  const API = { ensureLayer, popText, burst, shock, celebrate };
  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);