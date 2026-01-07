// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA SAFE
// Exposes: window.Particles + window.GAME_MODULES.Particles
// Methods: popText(x,y,text,cls?), scorePop(x,y,text,polarity?), burstAt(x,y,kind), celebrate(opts)
//
// ✅ No deps, no throw, mobile-safe
// ✅ Layer is pointer-events:none, z-index:90
// ✅ Uses inline styles + injected keyframes (so CSS missingก็ยังมีเอฟเฟกต์)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    DOC.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if(DOC.getElementById('hhaFxStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'hhaFxStyle';
    st.textContent = `
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.86); opacity:.0; }
        18%{ opacity:1; }
        70%{ transform:translate(-50%,-82%) scale(1.22); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.05); opacity:0; }
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.7); opacity:0; }
        20%{ opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.55); opacity:0; }
      }
      @keyframes hhaSpark{
        0%{ transform:translate(-50%,-50%) rotate(var(--r)) translateX(0) scale(.8); opacity:0; }
        15%{ opacity:1; }
        100%{ transform:translate(-50%,-50%) rotate(var(--r)) translateX(var(--d)) scale(1.0); opacity:0; }
      }
      @keyframes hhaConfetti{
        0%{ transform:translate3d(var(--x),-12px,0) rotate(0deg); opacity:0; }
        10%{ opacity:1; }
        100%{ transform:translate3d(var(--x), calc(100vh + 40px),0) rotate(540deg); opacity:0; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function clamp(v,min,max){ return v<min?min:(v>max?max:v); }

  function popText(x,y,text,cls){
    ensureStyle();
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.textContent = String(text ?? '');
    const c = String(cls || '');
    const shadow = '0 10px 26px rgba(0,0,0,.55)';

    el.style.cssText = `
      position:absolute;
      left:${Math.round(x)}px; top:${Math.round(y)}px;
      transform: translate(-50%,-50%);
      font: 1000 18px/1 system-ui;
      color:#fff;
      text-shadow:${shadow};
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(2,6,23,.18);
      border: 1px solid rgba(255,255,255,.10);
      opacity:0;
      animation: hhaPop 560ms ease-out forwards;
      will-change: transform, opacity;
    `;

    if(c==='good'){
      el.style.borderColor = 'rgba(34,197,94,.25)';
      el.style.background = 'rgba(34,197,94,.10)';
    } else if(c==='bad'){
      el.style.borderColor = 'rgba(239,68,68,.25)';
      el.style.background = 'rgba(239,68,68,.10)';
    } else if(c==='perfect'){
      el.style.borderColor = 'rgba(34,211,238,.28)';
      el.style.background = 'rgba(34,211,238,.10)';
    }

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 720);
  }

  function scorePop(x,y,text,polarity){
    const cls = (String(polarity||'')==='bad' || String(text||'').trim().startsWith('-')) ? 'bad' : 'good';
    popText(x,y,text,cls);
  }

  function burstAt(x,y,kind){
    ensureStyle();
    const layer = ensureLayer();

    const ring = DOC.createElement('div');
    ring.style.cssText = `
      position:absolute;
      left:${Math.round(x)}px; top:${Math.round(y)}px;
      width:18px; height:18px;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border: 2px solid rgba(255,255,255,.40);
      box-shadow: 0 0 0 10px rgba(255,255,255,.08);
      opacity:0;
      animation: hhaBurst 420ms ease-out forwards;
    `;

    const k = String(kind||'');
    if(k==='bad'){
      ring.style.borderColor = 'rgba(239,68,68,.48)';
      ring.style.boxShadow = '0 0 0 10px rgba(239,68,68,.10)';
    } else if(k==='good'){
      ring.style.borderColor = 'rgba(34,197,94,.46)';
      ring.style.boxShadow = '0 0 0 10px rgba(34,197,94,.10)';
    } else if(k==='block'){
      ring.style.borderColor = 'rgba(56,189,248,.50)';
      ring.style.boxShadow = '0 0 0 10px rgba(56,189,248,.10)';
    } else if(k==='perfect'){
      ring.style.borderColor = 'rgba(34,211,238,.55)';
      ring.style.boxShadow = '0 0 0 10px rgba(34,211,238,.12)';
    } else if(k==='diamond'){
      ring.style.borderColor = 'rgba(167,139,250,.55)';
      ring.style.boxShadow = '0 0 0 10px rgba(167,139,250,.12)';
    }

    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch(_){ } }, 520);

    // sparks
    const n = (k==='perfect' || k==='diamond') ? 9 : 7;
    for(let i=0;i<n;i++){
      const sp = DOC.createElement('div');
      const r = Math.round((360/n) * i + (Math.random()*14));
      const d = Math.round(42 + Math.random()*34);
      sp.style.cssText = `
        position:absolute;
        left:${Math.round(x)}px; top:${Math.round(y)}px;
        width:10px; height:10px;
        transform: translate(-50%,-50%);
        border-radius: 3px;
        background: rgba(255,255,255,.92);
        opacity:0;
        --r:${r}deg;
        --d:${d}px;
        animation: hhaSpark 520ms ease-out forwards;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      `;

      if(k==='bad') sp.style.background = 'rgba(239,68,68,.92)';
      else if(k==='good') sp.style.background = 'rgba(34,197,94,.92)';
      else if(k==='block') sp.style.background = 'rgba(56,189,248,.92)';
      else if(k==='diamond') sp.style.background = 'rgba(167,139,250,.92)';
      else if(k==='perfect') sp.style.background = 'rgba(34,211,238,.92)';

      layer.appendChild(sp);
      setTimeout(()=>{ try{ sp.remove(); }catch(_){ } }, 620);
    }
  }

  function celebrate(opts={}){
    ensureStyle();
    const layer = ensureLayer();
    const kind = String(opts.kind||'end');
    const grade = String(opts.grade||'');

    // quick banner pop
    const W = DOC.documentElement.clientWidth || innerWidth || 360;
    const H = DOC.documentElement.clientHeight || innerHeight || 640;
    const y = H * 0.22;

    if(grade){
      popText(W*0.5, y, `GRADE ${grade}`, 'perfect');
    }else if(kind){
      popText(W*0.5, y, String(kind).toUpperCase(), 'perfect');
    }

    // confetti strips (very lightweight)
    const count = 16;
    for(let i=0;i<count;i++){
      const c = DOC.createElement('div');
      const x = Math.round((W * (i/(count-1))) + (Math.random()*18 - 9));
      const w = Math.round(8 + Math.random()*6);
      const h = Math.round(14 + Math.random()*10);
      c.style.cssText = `
        position:absolute;
        top:0px;
        left:0px;
        width:${w}px;
        height:${h}px;
        border-radius: 4px;
        opacity:0;
        --x:${x}px;
        animation: hhaConfetti ${1200 + Math.random()*420}ms ease-in forwards;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,.25));
      `;
      // random bright-ish color without seaborn nonsense :)
      const palette = ['rgba(34,197,94,.95)','rgba(34,211,238,.95)','rgba(167,139,250,.95)','rgba(250,204,21,.95)','rgba(239,68,68,.95)'];
      c.style.background = palette[Math.floor(Math.random()*palette.length)];
      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){ } }, 1700);
    }
  }

  // export
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.celebrate = celebrate;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);