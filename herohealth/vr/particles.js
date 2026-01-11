// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (simple, universal)
// ✅ window.Particles + window.GAME_MODULES.Particles
// ✅ popText(x,y,text,cls?)  -> floating score text
// ✅ burst(x,y,amount?,cls?) -> burst dots
// ✅ celebrate() -> confetti-like burst from top
//
// Notes:
// - No external assets. Pure DOM.
// - pointer-events: none.
// - Safe to include in any game via <script defer>.
// - Works with your Hydration safe.js popScore() fallback.

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ---- helpers ----
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; z-index:90;
      pointer-events:none;
      overflow:hidden;
      contain: layout paint style;
    `;
    doc.body.appendChild(layer);

    // CSS once
    if (!doc.getElementById('hha-fx-css')){
      const st = doc.createElement('style');
      st.id = 'hha-fx-css';
      st.textContent = `
        .hha-fx-pop{
          position:absolute;
          transform: translate(-50%,-50%);
          font: 900 18px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
          color: rgba(255,255,255,.96);
          text-shadow: 0 8px 22px rgba(0,0,0,.55), 0 2px 0 rgba(0,0,0,.35);
          letter-spacing:.2px;
          opacity:0;
          animation: hhaPop 520ms ease-out forwards;
          will-change: transform, opacity, filter;
        }
        .hha-fx-pop.small{ font-size: 14px; opacity:.95; }
        .hha-fx-pop.big{ font-size: 22px; }

        @keyframes hhaPop{
          0%{ opacity:0; transform:translate(-50%,-50%) scale(.85); filter: blur(.4px); }
          15%{ opacity:1; transform:translate(-50%,-58%) scale(1.08); filter: blur(0); }
          100%{ opacity:0; transform:translate(-50%,-90%) scale(1.02); filter: blur(.2px); }
        }

        .hha-fx-dot{
          position:absolute;
          width:8px; height:8px;
          border-radius:999px;
          opacity:.92;
          background: rgba(255,255,255,.92);
          box-shadow: 0 16px 40px rgba(0,0,0,.35);
          transform: translate(-50%,-50%);
          will-change: transform, opacity;
          animation: hhaDot 520ms ease-out forwards;
        }
        @keyframes hhaDot{
          0%{ opacity:0; transform:translate(-50%,-50%) scale(.8); }
          15%{ opacity:1; }
          100%{ opacity:0; transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px))) scale(.95); }
        }

        .hha-fx-conf{
          position:absolute;
          width:10px; height:6px;
          border-radius: 6px;
          opacity:.92;
          background: rgba(255,255,255,.92);
          transform: translate(-50%,-50%) rotate(var(--rot,0deg));
          will-change: transform, opacity;
          animation: hhaConf 920ms ease-out forwards;
          box-shadow: 0 18px 55px rgba(0,0,0,.35);
        }
        @keyframes hhaConf{
          0%{ opacity:0; transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(.9); }
          10%{ opacity:1; }
          100%{
            opacity:0;
            transform:translate(calc(-50% + var(--dx,0px)), calc(-50% + var(--dy,0px)))
              rotate(calc(var(--rot,0deg) + 220deg)) scale(.92);
          }
        }

        /* optional styling hooks by cls */
        .hha-fx-pop.good { filter: drop-shadow(0 0 14px rgba(34,197,94,.18)); }
        .hha-fx-pop.bad  { filter: drop-shadow(0 0 14px rgba(239,68,68,.18)); }
        .hha-fx-pop.cyan { filter: drop-shadow(0 0 16px rgba(34,211,238,.18)); }
      `;
      doc.head.appendChild(st);
    }

    return layer;
  }

  function add(el){
    const layer = ensureLayer();
    layer.appendChild(el);
    return el;
  }

  function safeXY(x,y){
    const w = Math.max(1, doc.documentElement.clientWidth || 1);
    const h = Math.max(1, doc.documentElement.clientHeight || 1);
    return {
      x: clamp(x, 0, w),
      y: clamp(y, 0, h),
      w, h
    };
  }

  function rand01(){
    return Math.random();
  }

  // ---- API ----
  function popText(x, y, text, cls=''){
    const p = safeXY(x,y);
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop ' + (cls||'');
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.textContent = String(text ?? '');
    add(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
    return el;
  }

  function burst(x, y, amount=10, cls=''){
    const p = safeXY(x,y);
    const n = clamp(amount, 4, 26) | 0;

    for (let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-fx-dot ' + (cls||'');
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';

      const ang = rand01()*Math.PI*2;
      const dist = 26 + rand01()*54;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      el.style.setProperty('--dx', dx.toFixed(1)+'px');
      el.style.setProperty('--dy', dy.toFixed(1)+'px');

      add(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
    }
  }

  function celebrate(intensity=1){
    const layer = ensureLayer();
    const w = Math.max(1, doc.documentElement.clientWidth || 1);
    const h = Math.max(1, doc.documentElement.clientHeight || 1);

    const k = clamp(intensity, 0.6, 2.2);
    const n = clamp(Math.round(26*k), 16, 70);

    const topY = 12 + (parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--sat')) || 0);

    for (let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-fx-conf';

      const x = rand01()*w;
      const y = topY + rand01()*40;

      el.style.left = x.toFixed(1)+'px';
      el.style.top  = y.toFixed(1)+'px';

      const dx = (rand01()*2-1) * (120 + rand01()*240);
      const dy = (160 + rand01()*360);

      el.style.setProperty('--dx', dx.toFixed(1)+'px');
      el.style.setProperty('--dy', dy.toFixed(1)+'px');
      el.style.setProperty('--rot', (rand01()*180).toFixed(1)+'deg');

      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 1400);
    }
  }

  // Backward-friendly aliases
  function pop(x,y,text,cls){ return popText(x,y,text,cls); }

  const API = { popText, pop, burst, celebrate };

  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);