// === /herohealth/vr/particles.js ===
// HHA Particles V2 — PRODUCTION
// ✅ popText(x,y,text,cls)
// ✅ burst(x,y,{r, n})
// ✅ shockwave(x,y,{r})
// ✅ celebrate()
// Also exposes compat wrappers: scorePop, burstAt

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_V2__) return;
  root.__HHA_PARTICLES_V2__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  // ---------- CSS ----------
  (function inject(){
    const id='hha-particles-v2-style';
    if(doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id=id;
    st.textContent = `
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 16px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 24px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms ease-out forwards;
      }
      .hha-pop.big{ font-size:20px; }
      .hha-pop.perfect{ font-size:22px; letter-spacing:.6px; }
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.90; }
        60%{ transform:translate(-50%,-70%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-92%) scale(1.05); opacity:0; filter: blur(.2px); }
      }

      .hha-dot{
        position:absolute;
        width:8px; height:8px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaDot 520ms ease-out forwards;
        box-shadow: 0 14px 28px rgba(0,0,0,.35);
      }
      @keyframes hhaDot{
        0%{ opacity:.98; transform: translate(-50%,-50%) scale(1); }
        100%{ opacity:0; transform: translate(var(--dx), var(--dy)) scale(.65); }
      }

      .hha-wave{
        position:absolute;
        width: 20px; height: 20px;
        border-radius:999px;
        transform: translate(-50%,-50%) scale(.4);
        border: 2px solid rgba(255,255,255,.72);
        opacity:.55;
        filter: blur(.1px);
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
      }
      @keyframes hhaWave{
        0%{ opacity:.55; transform: translate(-50%,-50%) scale(.35); }
        100%{ opacity:0; transform: translate(-50%,-50%) scale(3.4); }
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- API ----------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls?(' '+cls):'');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function burst(x,y,opts={}){
    const layer = ensureLayer();
    const r = clamp(opts.r ?? 52, 18, 140);
    const n = clamp(opts.n ?? 12, 6, 28);
    const cx = Number(x)|| (innerWidth/2);
    const cy = Number(y)|| (innerHeight/2);

    for(let i=0;i<n;i++){
      const a = (Math.PI*2) * (i/n) + (Math.random()*0.28);
      const dist = r * (0.65 + Math.random()*0.55);
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist;

      const dot = doc.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = cx + 'px';
      dot.style.top  = cy + 'px';
      dot.style.setProperty('--dx', (dx)+'px');
      dot.style.setProperty('--dy', (dy)+'px');
      // no fixed colors: let browser pick default; (we keep white-ish via border/shadow feel)
      dot.style.background = 'rgba(255,255,255,.92)';
      dot.style.width = (6 + Math.random()*6) + 'px';
      dot.style.height= dot.style.width;
      layer.appendChild(dot);

      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 600);
    }
  }

  function shockwave(x,y,opts={}){
    const layer = ensureLayer();
    const cx = Number(x)|| (innerWidth/2);
    const cy = Number(y)|| (innerHeight/2);

    const w = doc.createElement('div');
    w.className = 'hha-wave';
    w.style.left = cx + 'px';
    w.style.top  = cy + 'px';
    layer.appendChild(w);
    setTimeout(()=>{ try{ w.remove(); }catch(_){ } }, 650);

    // add a small burst too
    burst(cx,cy,{ r: clamp(opts.r ?? 64, 22, 160), n: 10 });
  }

  function celebrate(){
    const cx = innerWidth/2;
    const cy = innerHeight*0.32;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        burst(cx + (Math.random()*2-1)*200, cy + (Math.random()*2-1)*120, { r: 26 + Math.random()*56, n: 10 + Math.floor(Math.random()*10) });
        popText(cx + (Math.random()*2-1)*120, cy + (Math.random()*2-1)*70, '✨', 'big');
      }, i*55);
    }
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compat wrappers (for older calls)
  root.Particles.scorePop = (x,y,text)=> popText(x,y,text,'score');
  root.Particles.burstAt  = (x,y,kind)=> burst(x,y,{ r: (kind==='bad'?72:56), n: (kind==='diamond'?18:12) });

})(window);