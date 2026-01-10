// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (global FX layer)
// ✅ ensureLayer() fixed z-index 90
// ✅ popText(x,y,text,cls?) + score/penalty styles
// ✅ burst(x,y,{r, n}) sparkle
// ✅ shockwave(x,y,{r}) ring pulse
// ✅ celebrate() multi-burst fireworks
// Notes: no dependencies. Safe for all games.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:90','overflow:hidden'
    ].join(';') + ';';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- style ----------
  (function injectStyle(){
    const id = 'hha-particles-style';
    if (doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms ease-out forwards;
        user-select:none;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(2,6,23,.18);
        border: 1px solid rgba(148,163,184,.18);
        backdrop-filter: blur(6px);
      }
      .hha-fx-pop.big{
        font-size: 22px;
        padding: 4px 10px;
        border-color: rgba(34,197,94,.22);
        background: rgba(34,197,94,.10);
      }
      .hha-fx-pop.penalty{
        border-color: rgba(239,68,68,.22);
        background: rgba(239,68,68,.10);
      }
      .hha-fx-pop.perfect{
        border-color: rgba(34,211,238,.22);
        background: rgba(34,211,238,.10);
        filter: saturate(1.2);
      }
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.94; }
        55%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.04); opacity:0; }
      }

      .hha-fx-dot{
        position:absolute;
        width: 7px; height: 7px;
        border-radius: 999px;
        background: rgba(255,255,255,.95);
        box-shadow: 0 10px 26px rgba(0,0,0,.35);
        will-change: transform, opacity;
        animation: hhaDot 520ms cubic-bezier(.12,.82,.2,1) forwards;
        opacity: 0.98;
      }
      @keyframes hhaDot{
        0%{ transform: translate3d(var(--x0),var(--y0),0) scale(.9); opacity:.95; }
        80%{ opacity: 1; }
        100%{ transform: translate3d(var(--x1),var(--y1),0) scale(.75); opacity:0; }
      }

      .hha-fx-ring{
        position:absolute;
        width: 12px; height: 12px;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,.78);
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaRing 520ms ease-out forwards;
        opacity: .95;
      }
      @keyframes hhaRing{
        0%{ transform: translate(-50%,-50%) scale(.6); opacity:.95; }
        70%{ opacity:.7; }
        100%{ transform: translate(-50%,-50%) scale(var(--s,6)); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- helpers ----------
  function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
  function rmLater(el, ms){ setTimeout(()=>{ try{ el.remove(); }catch(_){} }, ms||600); }

  // ---------- API ----------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls ? (' ' + String(cls)) : '');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    rmLater(el, 720);
  }

  function burst(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 44, 14, 140);
    const n = clamp(opts?.n ?? Math.round(r/6), 6, 28);
    const baseX = Number(x)||0, baseY = Number(y)||0;

    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-fx-dot';
      const ang = Math.random() * Math.PI * 2;
      const dist = (0.45 + Math.random()*0.75) * r;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const x0 = (Math.random()*6 - 3);
      const y0 = (Math.random()*6 - 3);

      el.style.left = baseX + 'px';
      el.style.top  = baseY + 'px';
      el.style.setProperty('--x0', x0 + 'px');
      el.style.setProperty('--y0', y0 + 'px');
      el.style.setProperty('--x1', (dx) + 'px');
      el.style.setProperty('--y1', (dy) + 'px');

      // tiny color variety without explicit palette dependency
      const hue = Math.floor(Math.random()*360);
      el.style.background = `hsla(${hue}, 90%, 72%, .95)`;

      layer.appendChild(el);
      rmLater(el, 620);
    }
  }

  function shockwave(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 64, 18, 220);
    const el = doc.createElement('div');
    el.className = 'hha-fx-ring';
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    el.style.setProperty('--s', String(clamp(r/12, 2.8, 10)));
    layer.appendChild(el);
    rmLater(el, 620);
    // add subtle burst too
    burst(x,y,{ r: Math.max(18, r*0.6), n: Math.round(Math.max(8, r/10)) });
  }

  function celebrate(){
    const cx = innerWidth/2;
    const cy = innerHeight*0.35;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        const x = cx + (Math.random()*2-1)*220;
        const y = cy + (Math.random()*2-1)*120;
        shockwave(x,y,{ r: 70 + Math.random()*70 });
      }, i*55);
    }
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compatibility aliases (older engine calls)
  root.Particles.burstAt = function(x,y,kind){
    // kind can be 'good'|'bad'|'star' etc — we just vary radius a bit
    const k = String(kind||'good');
    const r = k==='bad' ? 66 : k==='diamond' ? 86 : k==='shield' ? 54 : k==='star' ? 64 : 56;
    burst(x,y,{ r });
  };
  root.Particles.scorePop = function(x,y,text){
    popText(x,y,text,'big');
  };
})(window);