// === /herohealth/vr-goodjunk/particles.js ===
// Simple FX Layer — LOCAL COPY
// Provides window.Particles { popText, burstAt }

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:190;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform:translate(-50%,-50%);
      font: 1000 14px/1 system-ui;
      color: rgba(255,255,255,.92);
      text-shadow: 0 10px 22px rgba(0,0,0,.45);
      padding: 8px 10px;
      border-radius: 999px;
      background: rgba(2,6,23,.55);
      border: 1px solid rgba(148,163,184,.18);
      opacity:0;
      animation: hhaPop 520ms ease-out forwards;
    `;
    if(cls==='big'){
      el.style.fontSize = '18px';
      el.style.fontWeight = '1300';
    }
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 800);
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const n = (kind==='bad') ? 10 : 12;
    for(let i=0;i<n;i++){
      const p = doc.createElement('div');
      const a = Math.random()*Math.PI*2;
      const r = 10 + Math.random()*26;
      p.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        width:8px; height:8px; border-radius:999px;
        background:${kind==='bad' ? 'rgba(239,68,68,.85)' : 'rgba(34,197,94,.85)'};
        transform:translate(-50%,-50%);
        opacity:.0;
        animation: hhaBurst 520ms ease-out forwards;
        --dx:${Math.cos(a)*r}px;
        --dy:${Math.sin(a)*r}px;
      `;
      layer.appendChild(p);
      setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 800);
    }
  }

  const styleId = 'hha-fx-style';
  if(!doc.getElementById(styleId)){
    const st = doc.createElement('style');
    st.id = styleId;
    st.textContent = `
      @keyframes hhaPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.92); }
        20%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%,-80%) scale(1); }
      }
      @keyframes hhaBurst{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.9); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.6); }
      }
    `;
    doc.head.appendChild(st);
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burstAt = burstAt;
})(window);