// === /herohealth/vr/particles.js ===
// Universal Minimal FX — popText + scorePop + burstAt (safe)
// ✅ No dependencies, DOM-only
// ✅ Used by all games consistently

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_V2__) return;
  root.__HHA_PARTICLES_V2__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function makeEl(html, css){
    const el = doc.createElement('div');
    el.innerHTML = html;
    el.style.cssText = css;
    return el;
  }

  function popText(x,y,text, cls=''){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.className = `hha-pop ${cls}`.trim();
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui; color:#fff;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      opacity:.98;
      will-change: transform, opacity, filter;
      animation: hhaPop 520ms ease-out forwards;
      padding:2px 6px; border-radius:10px;
      background: rgba(2,6,23,.10);
      backdrop-filter: blur(2px);
    `;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function scorePop(x,y,text){
    popText(x,y,text,'hha-score');
  }

  function burstAt(x,y, kind='good'){
    const layer = ensureLayer();
    const n = (kind==='bad')? 10 : (kind==='block')? 8 : 12;

    const badge =
      (kind==='good')? '✨' :
      (kind==='bad')?  '💥' :
      (kind==='star')? '⭐' :
      (kind==='shield')?'🛡️' :
      (kind==='diamond')?'💎' :
      '✨';

    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const r = 18 + Math.random()*44;
      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r;

      const el = doc.createElement('div');
      el.textContent = badge;
      el.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font: 900 ${16 + Math.floor(Math.random()*12)}px/1 system-ui;
        opacity:.95;
        will-change: transform, opacity, filter;
        animation: hhaBurst 560ms ease-out forwards;
        --dx:${dx}px; --dy:${dy}px;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
    }
  }

  const st = doc.createElement('style');
  st.textContent = `
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.92; }
      70%{ transform:translate(-50%,-70%) scale(1.2); opacity:1; }
      100%{ transform:translate(-50%,-94%) scale(1.05); opacity:0; }
    }
    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.85); opacity:.95; }
      80%{ transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.1); opacity:.9; }
      100%{ transform:translate(calc(-50% + var(--dx)*1.25), calc(-50% + var(--dy)*1.25)) scale(.9); opacity:0; }
    }
    .hha-pop.hha-score{
      background: rgba(34,197,94,.14);
      border: 1px solid rgba(34,197,94,.22);
    }
  `;
  doc.head.appendChild(st);

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;

  // Compatibility
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;
})(window);