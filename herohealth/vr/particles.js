// === /herohealth/vr/particles.js ===
// HHA Particles — V2 (PRODUCTION)
// ✅ popText / burst / shockwave / celebrate
// ✅ safe: works even if called many times
// ✅ no dependencies

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_PARTICLES_V2__) return;
  root.__HHA_PARTICLES_V2__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  const st = doc.createElement('style');
  st.textContent = `
    .hha-pop{
      position:absolute; transform:translate(-50%,-50%);
      font: 1000 18px/1 system-ui; color:#fff;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      opacity:.98; will-change: transform, opacity;
      animation: hhaPop 520ms ease-out forwards;
    }
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; }
      65%{ transform:translate(-50%,-72%) scale(1.18); opacity:1; }
      100%{ transform:translate(-50%,-92%) scale(1.06); opacity:0; }
    }

    .hha-burst{
      position:absolute; left:0; top:0;
      width:10px; height:10px; border-radius:999px;
      transform: translate(-50%,-50%) scale(1);
      opacity:.95;
      filter: drop-shadow(0 12px 26px rgba(0,0,0,.35));
      animation: hhaBurst 520ms ease-out forwards;
    }
    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.6); opacity:.0; }
      15%{ opacity:.95; }
      100%{ transform:translate(-50%,-50%) scale(3.8); opacity:0; }
    }

    .hha-wave{
      position:absolute; left:0; top:0;
      width:18px; height:18px; border-radius:999px;
      transform: translate(-50%,-50%) scale(1);
      border: 2px solid rgba(255,255,255,.55);
      opacity:.92;
      animation: hhaWave 620ms ease-out forwards;
    }
    @keyframes hhaWave{
      0%{ transform:translate(-50%,-50%) scale(.4); opacity:.0; }
      10%{ opacity:.92; }
      100%{ transform:translate(-50%,-50%) scale(6.4); opacity:0; }
    }
  `;
  doc.head.appendChild(st);

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? (' '+cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function burst(x,y,opt){
    const layer = ensureLayer();
    const r = Math.max(8, Number(opt?.r || 26));
    const el = doc.createElement('div');
    el.className = 'hha-burst';
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    el.style.width = (r*1.1) + 'px';
    el.style.height = (r*1.1) + 'px';
    // no fixed colors: use opacity + white ring feel
    el.style.background = 'rgba(255,255,255,.16)';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const r = Math.max(10, Number(opt?.r || 56));
    const el = doc.createElement('div');
    el.className = 'hha-wave';
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    el.style.width = (r*1.0) + 'px';
    el.style.height = (r*1.0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.35;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        burst(cx + (Math.random()*2-1)*220, cy + (Math.random()*2-1)*140, { r: 18 + Math.random()*38 });
        shockwave(cx + (Math.random()*2-1)*180, cy + (Math.random()*2-1)*120, { r: 36 + Math.random()*46 });
      }, i*48);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compat namespace
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;
})(window);