// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX, safe)
// Provides: window.Particles.{ popText, burst, shockwave, celebrate }

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
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function addStyleOnce(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.90); opacity:.95; filter: blur(.0px); }
        65%{ transform:translate(-50%,-85%) scale(1.18); opacity:1; filter: blur(.0px); }
        100%{ transform:translate(-50%,-115%) scale(1.06); opacity:0; filter: blur(.3px); }
      }
      @keyframes hhaBurst{
        0%{ transform: translate(-50%,-50%) scale(.6); opacity:.0; }
        12%{ opacity:1; }
        100%{ transform: translate(-50%,-50%) scale(1.28); opacity:0; }
      }
      @keyframes hhaShock{
        0%{ transform: translate(-50%,-50%) scale(.25); opacity:.0; }
        12%{ opacity:.9; }
        100%{ transform: translate(-50%,-50%) scale(2.15); opacity:0; }
      }
      .hha-fx-text{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms ease-out forwards;
      }
      .hha-fx-text.big{ font-size: 22px; font-weight: 1000; }
      .hha-fx-text.perfect{ font-size: 20px; letter-spacing:.4px; }
      .hha-fx-ring{
        position:absolute;
        width: 16px; height: 16px;
        border-radius: 999px;
        border: 3px solid rgba(255,255,255,.95);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        pointer-events:none;
      }
      .hha-fx-ring.burst{ animation: hhaBurst 420ms ease-out forwards; }
      .hha-fx-ring.shock{ animation: hhaShock 520ms ease-out forwards; border-width: 2px; opacity:.95; }
    `;
    doc.head.appendChild(st);
  }

  function popText(x,y,text,cls){
    addStyleOnce();
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-text' + (cls ? (' ' + cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function ring(x,y,r,mode){
    addStyleOnce();
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-ring ' + (mode||'burst');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    const rr = Math.max(18, Number(r)||48);
    el.style.width = rr + 'px';
    el.style.height= rr + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 800);
  }

  function burst(x,y,opt={}){
    ring(x,y,opt.r ?? 48,'burst');
  }

  function shockwave(x,y,opt={}){
    ring(x,y,opt.r ?? 62,'shock');
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.28;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        const x = cx + (Math.random()*2-1)*220;
        const y = cy + (Math.random()*2-1)*130;
        shockwave(x,y,{r: 44 + Math.random()*60});
        popText(x,y, Math.random()<.5?'✨':'🎉', 'big');
      }, i*55);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;
})(window);