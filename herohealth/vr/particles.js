// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (Unified FX)
// ✅ popText(x,y,text,cls?)
// ✅ burstAt(x,y,kind?)  kind: good|bad|block|star|shield|diamond
// ✅ celebrate(kind?)    kind: end|boss|mini
// ✅ One global layer .hha-fx-layer

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:190',
      'overflow:hidden'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function el(tag, cls){
    const e = doc.createElement(tag);
    if(cls) e.className = cls;
    return e;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const e = el('div', 'hha-pop ' + (cls || ''));
    e.textContent = text;
    e.style.left = Math.round(x) + 'px';
    e.style.top  = Math.round(y) + 'px';
    layer.appendChild(e);
    setTimeout(()=>{ try{ e.remove(); }catch(_){ } }, 760);
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const k = (kind||'good');
    const n = (k==='block') ? 10 : (k==='diamond' ? 18 : 14);
    for(let i=0;i<n;i++){
      const p = el('i', 'hha-burst hha-' + k);
      const ang = Math.random()*Math.PI*2;
      const dist = (k==='diamond') ? (32 + Math.random()*42) : (22 + Math.random()*34);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;
      p.style.left = Math.round(x) + 'px';
      p.style.top  = Math.round(y) + 'px';
      p.style.setProperty('--dx', dx.toFixed(1)+'px');
      p.style.setProperty('--dy', dy.toFixed(1)+'px');
      p.style.setProperty('--rot', (Math.random()*260 - 130).toFixed(1)+'deg');
      p.style.setProperty('--s', (0.85 + Math.random()*0.6).toFixed(2));
      layer.appendChild(p);
      setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 680);
    }
  }

  function celebrate(kind){
    const layer = ensureLayer();
    const k = (kind||'end');
    const n = (k==='boss') ? 26 : (k==='mini' ? 18 : 22);
    const W = doc.documentElement.clientWidth;
    const H = doc.documentElement.clientHeight;
    for(let i=0;i<n;i++){
      const c = el('i', 'hha-confetti hha-c-' + k);
      const x = Math.random()*W;
      const y = -20 - Math.random()*80;
      c.style.left = Math.round(x) + 'px';
      c.style.top  = Math.round(y) + 'px';
      c.style.setProperty('--fall', (H + 200 + Math.random()*220).toFixed(0)+'px');
      c.style.setProperty('--dur', (900 + Math.random()*900).toFixed(0)+'ms');
      c.style.setProperty('--rot', (Math.random()*720 - 360).toFixed(0)+'deg');
      c.style.setProperty('--sx', (Math.random()*180 - 90).toFixed(0)+'px');
      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){ } }, 2200);
    }
  }

  // CSS (no colors hardcoded in JS; CSS handles)
  const st = doc.createElement('style');
  st.textContent = `
    .hha-pop{
      position:absolute;
      transform: translate(-50%,-50%);
      font: 1000 16px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
      color:#fff;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      opacity:.98;
      will-change: transform, opacity;
      animation: hhaPop 640ms ease-out forwards;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(2,6,23,.22);
      border: 1px solid rgba(148,163,184,.14);
    }
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-45%) scale(.86); opacity:.0; }
      14%{ opacity:.98; }
      70%{ transform:translate(-50%,-85%) scale(1.12); opacity:1; }
      100%{ transform:translate(-50%,-110%) scale(1.04); opacity:0; }
    }

    .hha-burst{
      position:absolute;
      width:8px; height:8px;
      transform: translate(-50%,-50%);
      border-radius: 999px;
      opacity:.95;
      will-change: transform, opacity;
      animation: hhaBurst 640ms cubic-bezier(.22,.9,.25,1) forwards;
      background: rgba(34,197,94,.95);
      box-shadow: 0 10px 18px rgba(0,0,0,.25);
    }
    .hha-burst.hha-bad{ background: rgba(239,68,68,.95); }
    .hha-burst.hha-block{ background: rgba(148,163,184,.95); }
    .hha-burst.hha-star{ background: rgba(245,158,11,.95); }
    .hha-burst.hha-shield{ background: rgba(34,211,238,.95); }
    .hha-burst.hha-diamond{ background: rgba(167,139,250,.95); }

    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.65) rotate(0deg); opacity:0; }
      10%{ opacity:1; }
      100%{
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)))
                   scale(var(--s)) rotate(var(--rot));
        opacity:0;
      }
    }

    .hha-confetti{
      position:absolute;
      width:10px; height:14px;
      border-radius: 4px;
      opacity:.92;
      background: rgba(34,197,94,.85);
      transform: translate(-50%,-50%);
      animation: hhaFall var(--dur) ease-in forwards;
      box-shadow: 0 14px 30px rgba(0,0,0,.28);
      will-change: transform, opacity;
    }
    .hha-confetti.hha-c-boss{ background: rgba(239,68,68,.85); }
    .hha-confetti.hha-c-mini{ background: rgba(34,211,238,.85); }

    @keyframes hhaFall{
      0%{ transform: translate(-50%,-50%) rotate(0deg); opacity:0; }
      8%{ opacity:1; }
      100%{
        transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--fall))) rotate(var(--rot));
        opacity:0;
      }
    }
  `;
  doc.head.appendChild(st);

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.GAME_MODULES.Particles || {};
  root.GAME_MODULES.Particles.popText = popText;
  root.GAME_MODULES.Particles.burstAt = burstAt;
  root.GAME_MODULES.Particles.celebrate = celebrate;

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burstAt = burstAt;
  root.Particles.celebrate = celebrate;

})(window);