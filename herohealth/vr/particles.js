// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (ULTRA, shared by all games)

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
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:9997;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  (function injectCss(){
    const id = 'hha-particles-style';
    if(doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-pop{
        position:absolute; transform:translate(-50%,-50%);
        font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 540ms ease-out forwards;
        user-select:none;
        letter-spacing:.2px;
      }
      .hha-pop.big{ font-size:22px; }
      .hha-pop.perfect{ filter: drop-shadow(0 0 12px rgba(34,197,94,.25)); }
      .hha-pop.score{ opacity:.95; }
      .hha-pop.bad{ filter: drop-shadow(0 0 12px rgba(249,115,115,.22)); }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.85; }
        55%{ transform:translate(-50%,-86%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-106%) scale(1.06); opacity:0; }
      }

      .hha-dot{
        position:absolute; width:8px; height:8px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaDot 520ms ease-out forwards;
        box-shadow: 0 10px 22px rgba(0,0,0,.35);
      }
      @keyframes hhaDot{
        0%{ transform:translate(-50%,-50%) scale(1); opacity:.95; }
        100%{ transform:translate(var(--dx), var(--dy)) scale(.65); opacity:0; }
      }

      .hha-wave{
        position:absolute;
        width: 12px; height: 12px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        border: 2px solid rgba(255,255,255,.78);
        opacity:.92;
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
        pointer-events:none;
      }
      @keyframes hhaWave{
        0%{ transform:translate(-50%,-50%) scale(.2); opacity:.9; }
        100%{ transform:translate(-50%,-50%) scale(var(--s)); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  })();

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function rnd(a,b){ return a + (b-a)*Math.random(); }

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

  function burst(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 42, 16, 140);
    const n = clamp(opts?.n ?? 12, 6, 28);
    for(let i=0;i<n;i++){
      const a = (i/n) * Math.PI*2 + rnd(-0.12,0.12);
      const dist = rnd(r*0.65, r*1.25);
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist;
      const dot = doc.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = `${Math.round(x)}px`;
      dot.style.top  = `${Math.round(y)}px`;
      dot.style.setProperty('--dx', `${Math.round(dx)}px`);
      dot.style.setProperty('--dy', `${Math.round(dy)}px`);
      dot.style.background = `rgba(255,255,255,${rnd(0.55,0.95)})`;
      dot.style.width = `${Math.round(rnd(5,9))}px`;
      dot.style.height = dot.style.width;
      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, 620);
    }
  }

  function shockwave(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 56, 18, 160);
    const wave = doc.createElement('div');
    wave.className = 'hha-wave';
    wave.style.left = `${Math.round(x)}px`;
    wave.style.top  = `${Math.round(y)}px`;
    wave.style.setProperty('--s', String((r/12).toFixed(2)));
    layer.appendChild(wave);
    setTimeout(()=>{ try{ wave.remove(); }catch(_){ } }, 650);
  }

  function celebrate(){
    const W = doc.documentElement.clientWidth || innerWidth;
    const H = doc.documentElement.clientHeight || innerHeight;
    const cx = W/2, cy = H*0.32;
    for(let i=0;i<9;i++){
      setTimeout(()=>{
        burst(cx + rnd(-180,180), cy + rnd(-90,90), { r: rnd(26,56), n: 14 });
        if(i%2===0) shockwave(cx + rnd(-100,100), cy + rnd(-50,50), { r: rnd(40,78) });
      }, i*55);
    }
  }

  function scorePop(x,y,text){ popText(x,y,text,'score'); }
  function burstAt(x,y,kind){
    if(kind==='bad') { shockwave(x,y,{r:64}); burst(x,y,{r:58,n:14}); return; }
    if(kind==='block'){ burst(x,y,{r:44,n:12}); return; }
    if(kind==='star'){ burst(x,y,{r:52,n:16}); shockwave(x,y,{r:58}); return; }
    if(kind==='shield'){ burst(x,y,{r:46,n:14}); return; }
    if(kind==='diamond'){ shockwave(x,y,{r:78}); burst(x,y,{r:66,n:18}); return; }
    shockwave(x,y,{r:56}); burst(x,y,{r:48,n:14});
  }

  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.burst     = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;
  root.Particles.scorePop  = scorePop;
  root.Particles.burstAt   = burstAt;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);