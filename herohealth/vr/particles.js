// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (NEW API)
// Provides:
//   window.Particles and window.GAME_MODULES.Particles
//   burst(x,y,{r,count})
//   shockwave(x,y,{r})
//   popText(x,y,text,cls)
//   toast(text,cls)
//   celebrate({intensity})
//
// Notes:
// - All DOM-only, no canvas needed
// - Safe defaults; respects prefers-reduced-motion

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  if (root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles)) return;

  const GAME_MODULES = root.GAME_MODULES = root.GAME_MODULES || {};

  function prefersReduce(){
    try { return !!root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  }

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:9996;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);

    // styles once
    if(!doc.getElementById('hha-particles-style')){
      const st = doc.createElement('style');
      st.id = 'hha-particles-style';
      st.textContent = `
        .hha-pop{
          position:absolute;
          transform: translate(-50%,-50%);
          font: 1000 18px/1 system-ui;
          color:#fff;
          text-shadow: 0 10px 26px rgba(0,0,0,.42);
          opacity:0;
          will-change: transform, opacity;
          animation: hhaPop 520ms ease forwards;
        }
        .hha-pop.big{ font-size: 26px; font-weight:1200; }
        .hha-pop.combo{ font-size: 22px; font-weight:1200; }
        .hha-pop.hot{ font-size: 24px; font-weight:1200; }
        .hha-pop.rage{ font-size: 26px; font-weight:1200; }
        .hha-pop.perfect{ font-size: 24px; font-weight:1200; letter-spacing:.4px; }

        @keyframes hhaPop{
          0%   { opacity:0; transform: translate(-50%,-50%) scale(.92); }
          15%  { opacity:1; transform: translate(-50%,-56%) scale(1.02); }
          70%  { opacity:1; transform: translate(-50%,-86%) scale(1.02); }
          100% { opacity:0; transform: translate(-50%,-110%) scale(.98); }
        }

        .hha-burst-dot{
          position:absolute;
          width:10px; height:10px;
          border-radius:999px;
          transform: translate(-50%,-50%);
          opacity:0.95;
          will-change: transform, opacity;
          animation: hhaDot 520ms ease-out forwards;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,.35));
        }
        @keyframes hhaDot{
          0%   { opacity:0.95; transform: translate(-50%,-50%) scale(.9); }
          85%  { opacity:0.9; }
          100% { opacity:0; }
        }

        .hha-shock{
          position:absolute;
          border-radius:999px;
          transform: translate(-50%,-50%);
          border: 2px solid rgba(255,255,255,.28);
          box-shadow: 0 0 0 2px rgba(255,255,255,.08), 0 18px 44px rgba(0,0,0,.25);
          opacity:0.9;
          animation: hhaShock 520ms ease-out forwards;
        }
        @keyframes hhaShock{
          0%   { opacity:0.9; transform: translate(-50%,-50%) scale(.35); }
          80%  { opacity:0.55; }
          100% { opacity:0; transform: translate(-50%,-50%) scale(1.0); }
        }

        .hha-toast{
          position:fixed;
          left:50%; top:18%;
          transform: translate(-50%,-50%);
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.72);
          color:#e5e7eb;
          font: 1000 13px/1.2 system-ui;
          opacity:0;
          z-index:9997;
          pointer-events:none;
          backdrop-filter: blur(8px);
          box-shadow: 0 16px 44px rgba(0,0,0,.38);
          animation: hhaToast 900ms ease forwards;
        }
        @keyframes hhaToast{
          0% { opacity:0; transform: translate(-50%,-60%) scale(.98); }
          12%{ opacity:1; transform: translate(-50%,-50%) scale(1.0); }
          80%{ opacity:1; }
          100%{ opacity:0; transform: translate(-50%,-44%) scale(.99); }
        }

        @media (prefers-reduced-motion: reduce){
          .hha-pop,.hha-burst-dot,.hha-shock,.hha-toast{ animation-duration: 1ms !important; }
        }
      `;
      doc.head.appendChild(st);
    }

    return layer;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function rand(min,max){ return min + (max-min)*Math.random(); }

  function burst(x,y, opts={}){
    if (prefersReduce()) return;
    const layer = ensureLayer();
    const r = clamp(opts.r ?? 54, 18, 140);
    const count = clamp(opts.count ?? 10, 4, 22);

    for(let i=0;i<count;i++){
      const d = doc.createElement('div');
      d.className = 'hha-burst-dot';
      const ang = rand(0, Math.PI*2);
      const dist = rand(r*0.45, r);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      d.style.left = `${x}px`;
      d.style.top  = `${y}px`;

      // random warm/cool, leave default if you want
      const hue = (Math.random() < 0.5) ? rand(140, 190) : rand(20, 60);
      d.style.background = `hsl(${hue} 90% 60%)`;

      const s = rand(0.75, 1.35);
      d.style.width = `${Math.round(9*s)}px`;
      d.style.height= `${Math.round(9*s)}px`;

      // animate using transform translate
      d.animate([
        { transform: `translate(-50%,-50%) scale(.9)` , opacity: 0.95 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.0)`, opacity: 0.85 },
        { transform: `translate(calc(-50% + ${dx*1.12}px), calc(-50% + ${dy*1.12}px)) scale(.95)`, opacity: 0.0 },
      ], { duration: 520, easing:'cubic-bezier(.2,.9,.2,1)', fill:'forwards' });

      layer.appendChild(d);
      setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 560);
    }
  }

  function shockwave(x,y, opts={}){
    if (prefersReduce()) return;
    const layer = ensureLayer();
    const r = clamp(opts.r ?? 60, 20, 180);

    const s = doc.createElement('div');
    s.className = 'hha-shock';
    s.style.left = `${x}px`;
    s.style.top  = `${y}px`;
    s.style.width  = `${r*2}px`;
    s.style.height = `${r*2}px`;

    layer.appendChild(s);
    setTimeout(()=>{ try{ s.remove(); }catch(_){} }, 560);
  }

  function popText(x,y,text,cls='score'){
    if (prefersReduce()) return;
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = `hha-pop ${cls||''}`.trim();
    el.textContent = String(text ?? '');
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 560);
  }

  let toastTimer = 0;
  function toast(text, cls='toast'){
    if (prefersReduce()) return;
    const now = Date.now();
    if (now - toastTimer < 260) return;
    toastTimer = now;

    const el = doc.createElement('div');
    el.className = `hha-toast ${cls||''}`.trim();
    el.textContent = String(text ?? '');
    doc.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 980);
  }

  function celebrate(payload={}){
    if (prefersReduce()) return;
    const intensity = clamp(payload.intensity ?? 1.0, 0.6, 3.0);
    const n = Math.round(8 * intensity);

    for(let i=0;i<n;i++){
      setTimeout(()=>{
        burst(
          innerWidth/2 + (Math.random()*2-1)*180,
          innerHeight*0.35 + (Math.random()*2-1)*95,
          { r: 26 + Math.random()*44, count: 8 + Math.round(Math.random()*10) }
        );
      }, i*45);
    }
  }

  const API = { burst, shockwave, popText, toast, celebrate };

  root.Particles = API;
  GAME_MODULES.Particles = API;

})(window);
