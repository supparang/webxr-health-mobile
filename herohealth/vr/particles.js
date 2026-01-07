// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA SAFE (shared across all games)
// ✅ Layer: .hha-fx-layer z-index:90
// ✅ popText(x,y,text,cls?)
// ✅ burst(x,y,{r?}) + burstAt(x,y,kind)
// ✅ shockwave(x,y,{r?})
// ✅ celebrate()
// ✅ aliases: scorePop(), burstAt(), burst(), shockwave()
// Safe for Mobile/PC/VR

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
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  // ---- inject CSS once ----
  (function injectCss(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-pop{ position:absolute; transform:translate(-50%,-50%); will-change:transform,opacity,filter; opacity:.98; }
      .hha-pop.score{ font: 900 18px/1 system-ui; text-shadow: 0 10px 26px rgba(0,0,0,.55); }
      .hha-pop.big{ font: 1100 22px/1 system-ui; text-shadow: 0 12px 28px rgba(0,0,0,.62); }
      .hha-pop.perfect{ font: 1200 22px/1 system-ui; letter-spacing:.5px; }
      @keyframes hhaPopUp{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; filter:blur(.0px); }
        55%{ transform:translate(-50%,-78%) scale(1.12); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.04); opacity:0; filter:blur(.2px); }
      }

      .hha-burst{
        position:absolute; left:0; top:0; width:10px; height:10px;
        transform: translate(-50%,-50%);
        border-radius:999px;
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaBurst 520ms ease-out forwards;
        box-shadow: 0 14px 28px rgba(0,0,0,.35);
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.40); opacity:.90; }
        70%{ transform:translate(-50%,-50%) scale(1.10); opacity:.70; }
        100%{ transform:translate(-50%,-50%) scale(1.70); opacity:0; }
      }

      .hha-shock{
        position:absolute; left:0; top:0;
        width:10px; height:10px;
        transform: translate(-50%,-50%);
        border-radius:999px;
        border: 2px solid rgba(255,255,255,.55);
        opacity:.70;
        will-change: transform, opacity;
        animation: hhaShock 560ms ease-out forwards;
        filter: drop-shadow(0 10px 25px rgba(0,0,0,.35));
      }
      @keyframes hhaShock{
        0%{ transform:translate(-50%,-50%) scale(.40); opacity:.62; }
        70%{ transform:translate(-50%,-50%) scale(1.40); opacity:.38; }
        100%{ transform:translate(-50%,-50%) scale(2.10); opacity:0; }
      }

      .hha-firework{
        position:absolute;
        width:8px; height:8px; border-radius:999px;
        transform: translate(-50%,-50%);
        opacity:.92;
        animation: hhaFire 760ms ease-out forwards;
        will-change: transform, opacity;
      }
      @keyframes hhaFire{
        0%{ opacity:.95; transform: translate(-50%,-50%) scale(.9); }
        70%{ opacity:.85; transform: translate(var(--dx), var(--dy)) scale(1.15); }
        100%{ opacity:0; transform: translate(calc(var(--dx) * 1.25), calc(var(--dy) * 1.25)) scale(.85); }
      }
    `;
    doc.head.appendChild(st);
  })();

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop ' + (cls || 'score');
    el.textContent = String(text ?? '');
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    el.style.animation = 'hhaPopUp 520ms ease-out forwards';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 650);
  }

  function burst(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 44, 18, 140);
    const el = doc.createElement('div');
    el.className = 'hha-burst';
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    el.style.width = el.style.height = (r*0.65) + 'px';
    el.style.background = 'rgba(255,255,255,.22)';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 680);
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-burst';
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';

    const k = String(kind||'good');
    // ใช้สีแบบ “ไม่ hardcode แบรนด์” แต่ให้ความต่างชัด
    el.style.background =
      (k==='good')    ? 'rgba(34,197,94,.22)' :
      (k==='bad')     ? 'rgba(239,68,68,.20)' :
      (k==='block')   ? 'rgba(56,189,248,.18)' :
      (k==='shield')  ? 'rgba(56,189,248,.18)' :
      (k==='star')    ? 'rgba(245,158,11,.18)' :
      (k==='diamond') ? 'rgba(167,139,250,.18)' :
      'rgba(255,255,255,.18)';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 680);
  }

  function shockwave(x,y,opt){
    const layer = ensureLayer();
    const r = clamp(opt?.r ?? 60, 24, 170);
    const el = doc.createElement('div');
    el.className = 'hha-shock';
    el.style.left = (Number(x)||0) + 'px';
    el.style.top  = (Number(y)||0) + 'px';
    el.style.width = el.style.height = (r*0.60) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 720);
  }

  function celebrate(){
    const layer = ensureLayer();
    const cx = innerWidth/2, cy = innerHeight*0.35;
    const n = 16;
    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-firework';
      el.style.left = cx + 'px';
      el.style.top  = cy + 'px';
      const ang = (Math.PI*2) * (i/n);
      const dist = 90 + Math.random()*160;
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist + (Math.random()*40);
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.background = 'rgba(255,255,255,.85)';
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 900);
    }
  }

  // expose API
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // aliases (เผื่อ engine เก่าเรียก)
  root.Particles.scorePop = (x,y,text)=> popText(x,y,text,'score');
})(window);