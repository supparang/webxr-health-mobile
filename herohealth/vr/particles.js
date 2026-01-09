// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (safe, standalone)
// ✅ ensures .hha-fx-layer (z=9997)
// ✅ popText / scorePop / burst / shockwave / celebrate
// ✅ no dependency on game CSS

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
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // --- CSS once ---
  const st = doc.createElement('style');
  st.textContent = `
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.92; }
      60%{ transform:translate(-50%,-78%) scale(1.2); opacity:1; }
      100%{ transform:translate(-50%,-98%) scale(1.05); opacity:0; }
    }
    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.6) rotate(0deg); opacity:.95; }
      80%{ transform:translate(-50%,-50%) scale(1.25) rotate(18deg); opacity:.85; }
      100%{ transform:translate(-50%,-50%) scale(1.45) rotate(26deg); opacity:0; }
    }
    @keyframes hhaShock{
      0%{ transform:translate(-50%,-50%) scale(.25); opacity:.85; }
      70%{ transform:translate(-50%,-50%) scale(1.15); opacity:.55; }
      100%{ transform:translate(-50%,-50%) scale(1.45); opacity:0; }
    }
    .hha-pop{
      position:absolute; transform:translate(-50%,-50%);
      font: 1000 18px/1 system-ui; color:#fff;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      will-change: transform, opacity;
      animation: hhaPop 520ms ease-out forwards;
      white-space:nowrap;
      pointer-events:none;
    }
    .hha-pop.big{ font-size:22px; }
    .hha-pop.perfect{ font-size:22px; letter-spacing:.5px; }
    .hha-burst{
      position:absolute; transform:translate(-50%,-50%);
      width: 18px; height:18px; border-radius:999px;
      border: 2px solid rgba(255,255,255,.85);
      box-shadow: 0 0 0 6px rgba(255,255,255,.14);
      animation: hhaBurst 520ms ease-out forwards;
      pointer-events:none;
    }
    .hha-burst.bad{ border-color: rgba(255,255,255,.9); box-shadow: 0 0 0 8px rgba(255,255,255,.18); }
    .hha-burst.star{ border-width: 2px; box-shadow: 0 0 0 10px rgba(255,255,255,.16); }
    .hha-shock{
      position:absolute; transform:translate(-50%,-50%);
      width: 90px; height:90px; border-radius:999px;
      border: 2px solid rgba(255,255,255,.35);
      box-shadow: 0 0 0 2px rgba(255,255,255,.12) inset;
      animation: hhaShock 380ms ease-out forwards;
      pointer-events:none;
    }
  `;
  doc.head.appendChild(st);

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? ` ${cls}` : '');
    el.textContent = String(text ?? '');
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function scorePop(x,y,text){
    const t = String(text ?? '');
    const cls = (t.includes('PERFECT') ? 'perfect big' : (t.startsWith('+') && t.length>=3 ? 'big' : ''));
    popText(x,y,t,cls);
  }

  function burst(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 28, 10, 120);
    const kind = (opt?.kind || '').toString().toLowerCase();
    const el = doc.createElement('div');
    el.className = 'hha-burst' + (kind ? ` ${kind}` : '');
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${Math.round(r)}px`;
    el.style.height= `${Math.round(r)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 86, 40, 220);
    const el = doc.createElement('div');
    el.className = 'hha-shock';
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
    el.style.width = `${Math.round(r)}px`;
    el.style.height= `${Math.round(r)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
  }

  function celebrate(){
    const W = innerWidth, H = innerHeight;
    for(let i=0;i<10;i++){
      const x = W*0.5 + (Math.random()*2-1)*220;
      const y = H*0.32 + (Math.random()*2-1)*120;
      setTimeout(()=>{
        burst(x,y,{ r: 18 + Math.random()*52, kind:'star' });
        if(Math.random()<0.6) shockwave(x,y,{ r: 70 + Math.random()*90 });
      }, i*45);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burst = function(x,y,opt){ burst(x,y,opt||{}); };
  root.Particles.shockwave = function(x,y,opt){ shockwave(x,y,opt||{}); };
  root.Particles.celebrate = celebrate;

})(window);