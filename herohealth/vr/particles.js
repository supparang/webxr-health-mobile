// === /herohealth/vr/particles.js ===
// HHA Particles — SAFE+ (popText + burst + shockwave + confetti)
// No external deps. Lightweight DOM-based FX.

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
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- CSS ----------
  (function injectCss(){
    const st = doc.createElement('style');
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.9); opacity:.95; }
        70%{ transform:translate(-50%,-75%) scale(1.2); opacity:1; }
        100%{ transform:translate(-50%,-95%) scale(1.05); opacity:0; }
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.55) rotate(0deg); opacity:.0; }
        15%{ opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.35) rotate(18deg); opacity:0; }
      }
      @keyframes hhaShock{
        0%{ transform:translate(-50%,-50%) scale(.25); opacity:.0; }
        10%{ opacity:.9; }
        100%{ transform:translate(-50%,-50%) scale(1.9); opacity:0; }
      }
      @keyframes hhaConf{
        0%{ transform:translate3d(0,0,0) rotate(0deg); opacity:1; }
        100%{ transform:translate3d(var(--dx), var(--dy), 0) rotate(var(--dr)); opacity:0; }
      }
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-fx-pop.big{ font-size:22px; }
      .hha-fx-pop.perfect{ font-size:22px; letter-spacing:.3px; }
      .hha-fx-burst{
        position:absolute;
        width: 26px; height: 26px;
        border-radius: 999px;
        transform: translate(-50%,-50%);
        opacity: 0;
        animation: hhaBurst 520ms ease-out forwards;
        will-change: transform, opacity;
        border: 2px solid rgba(255,255,255,.72);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        mix-blend-mode: screen;
      }
      .hha-fx-burst.good{ background: radial-gradient(circle at 40% 40%, rgba(34,197,94,.85), rgba(34,197,94,.02) 65%); }
      .hha-fx-burst.bad{ background: radial-gradient(circle at 40% 40%, rgba(239,68,68,.85), rgba(239,68,68,.02) 65%); }
      .hha-fx-burst.star{ background: radial-gradient(circle at 40% 40%, rgba(250,204,21,.85), rgba(250,204,21,.02) 65%); }
      .hha-fx-burst.shield{ background: radial-gradient(circle at 40% 40%, rgba(56,189,248,.85), rgba(56,189,248,.02) 65%); }
      .hha-fx-burst.diamond{ background: radial-gradient(circle at 40% 40%, rgba(167,139,250,.9), rgba(167,139,250,.02) 65%); }
      .hha-fx-shock{
        position:absolute;
        width: 34px; height: 34px;
        border-radius: 999px;
        transform: translate(-50%,-50%);
        opacity: 0;
        animation: hhaShock 520ms ease-out forwards;
        will-change: transform, opacity;
        border: 2px solid rgba(255,255,255,.55);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        mix-blend-mode: screen;
      }
      .hha-fx-conf{
        position:absolute;
        width: 10px; height: 10px;
        border-radius: 3px;
        opacity: 1;
        will-change: transform, opacity;
        animation: hhaConf 900ms ease-out forwards;
        box-shadow: 0 8px 22px rgba(0,0,0,.35);
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- FX primitives ----------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls ? (' ' + cls) : '');
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function burst(x,y,{kind='good', r=26}={}){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = `hha-fx-burst ${kind}`;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.width = `${r}px`;
    el.style.height= `${r}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function shockwave(x,y,{r=42}={}){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-shock';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.width = `${r}px`;
    el.style.height= `${r}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function confetti({n=20, x=innerWidth/2, y=innerHeight*0.25}={}){
    const layer = ensureLayer();
    const colors = [
      'rgba(34,197,94,.95)','rgba(56,189,248,.95)','rgba(167,139,250,.95)',
      'rgba(250,204,21,.95)','rgba(239,68,68,.95)','rgba(251,146,60,.95)'
    ];
    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-fx-conf';
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      el.style.background = colors[(Math.random()*colors.length)|0];
      const dx = (Math.random()*2-1) * (110 + Math.random()*160);
      const dy = (80 + Math.random()*220);
      const dr = (Math.random()*2-1) * 240 + 'deg';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--dr', dr);
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 980);
    }
  }

  // ---------- API ----------
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.confetti = confetti;

})(window);