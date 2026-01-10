// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA SAFE (no deps)
// ✅ popText(x,y,text,cls)
// ✅ burst(x,y,{r})
// ✅ shockwave(x,y,{r})
// ✅ celebrate()

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9990;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // CSS once
  const st = doc.createElement('style');
  st.textContent = `
    .hha-pop{
      position:absolute; transform:translate(-50%,-50%);
      font: 1000 18px/1 system-ui;
      color:#fff; text-shadow:0 10px 26px rgba(0,0,0,.55);
      opacity:.98; will-change: transform, opacity, filter;
      animation: hhaPop 520ms ease-out forwards;
      padding:2px 6px; border-radius:10px;
      background: rgba(2,6,23,.10);
      border:1px solid rgba(148,163,184,.16);
      backdrop-filter: blur(6px);
    }
    .hha-pop.big{ font-size:22px; padding:4px 10px; }
    .hha-pop.perfect{ filter: drop-shadow(0 0 12px rgba(34,197,94,.35)); }
    .hha-pop.score{ }
    .hha-pop.bad{ filter: drop-shadow(0 0 12px rgba(239,68,68,.35)); }

    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; }
      70%{ transform:translate(-50%,-75%) scale(1.18); opacity:1; }
      100%{ transform:translate(-50%,-92%) scale(1.05); opacity:0; }
    }

    .hha-dot{
      position:absolute; width:8px; height:8px; border-radius:999px;
      transform: translate(-50%,-50%);
      opacity:.95;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,.45));
      will-change: transform, opacity;
      animation: hhaDot 520ms ease-out forwards;
    }
    @keyframes hhaDot{
      0%{ transform:translate(-50%,-50%) translate(0,0) scale(.9); opacity:.95; }
      100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.6); opacity:0; }
    }

    .hha-wave{
      position:absolute; width:20px; height:20px; border-radius:999px;
      transform: translate(-50%,-50%);
      border:2px solid rgba(226,232,240,.55);
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
      opacity:.9;
      animation: hhaWave 520ms ease-out forwards;
    }
    @keyframes hhaWave{
      0%{ transform:translate(-50%,-50%) scale(.6); opacity:.85; }
      100%{ transform:translate(-50%,-50%) scale(2.8); opacity:0; }
    }
  `;
  doc.head.appendChild(st);

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? ` ${cls}` : '');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function burst(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 52, 18, 120);
    const n = clamp(Math.round(r/6), 8, 20);
    const X = Number(x)||0, Y = Number(y)||0;

    for(let i=0;i<n;i++){
      const a = (Math.PI*2) * (i/n) + (Math.random()*0.25);
      const d = r * (0.55 + Math.random()*0.65);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;

      const dot = doc.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = X + 'px';
      dot.style.top  = Y + 'px';
      dot.style.setProperty('--dx', dx.toFixed(1)+'px');
      dot.style.setProperty('--dy', dy.toFixed(1)+'px');

      // random light/dark dot
      const light = Math.random() < 0.6;
      dot.style.background = light ? 'rgba(226,232,240,.92)' : 'rgba(148,163,184,.92)';

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 650);
    }
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-wave';
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    const r = clamp(opt?.r ?? 60, 22, 160);
    el.style.width = (r*0.65) + 'px';
    el.style.height= (r*0.65) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.28;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        burst(cx + (Math.random()*2-1)*180, cy + (Math.random()*2-1)*90, { r: 26 + Math.random()*54 });
        shockwave(cx + (Math.random()*2-1)*120, cy + (Math.random()*2-1)*60, { r: 52 + Math.random()*52 });
      }, i*55);
    }
  }

  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

})(window);