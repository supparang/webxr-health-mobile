// === /herohealth/vr/particles.js ===
// HHA Particles — Minimal FX layer (SAFE, PRODUCTION)
// Provides: popText, burst, shockwave, celebrate
// Aliases: scorePop, burstAt (for backward-compat)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------------- layer ----------------
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
  function rand(a,b){ return a + (b-a)*Math.random(); }

  // ---------------- CSS ----------------
  const st = doc.createElement('style');
  st.textContent = `
    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.95; }
      70%{ transform:translate(-50%,-70%) scale(1.2); opacity:1; }
      100%{ transform:translate(-50%,-92%) scale(1.05); opacity:0; }
    }
    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.4) rotate(0deg); opacity:0; }
      15%{ opacity:1; }
      100%{ transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.05) rotate(var(--rot)); opacity:0; }
    }
    @keyframes hhaShock{
      0%{ transform:translate(-50%,-50%) scale(.25); opacity:.0; }
      10%{ opacity:.55; }
      100%{ transform:translate(-50%,-50%) scale(var(--s)); opacity:0; }
    }
    @keyframes hhaFlash{
      0%{ opacity:0; }
      20%{ opacity: var(--a, .18); }
      100%{ opacity:0; }
    }
    .hha-flash{
      position:fixed; inset:0; pointer-events:none; z-index:92;
      background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.14), rgba(0,0,0,0) 58%);
      opacity:0;
      animation: hhaFlash 260ms ease-out forwards;
    }
  `;
  doc.head.appendChild(st);

  // ---------------- primitives ----------------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = String(text ?? '');
    el.className = 'hha-pop ' + (cls ? String(cls) : '');
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui; color:#fff;
      text-shadow: 0 8px 22px rgba(0,0,0,.55);
      opacity:.98;
      will-change: transform, opacity;
      animation: hhaPop 520ms ease-out forwards;
    `;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 620);
  }

  function burst(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 56, 22, 140);
    const n = clamp(opts?.n ?? Math.round(r/9), 6, 18);

    // emoji-ish particles (safe, no external assets)
    const glyphs = (opts?.glyphs && Array.isArray(opts.glyphs) && opts.glyphs.length)
      ? opts.glyphs
      : ['✦','✧','•','◆','◦','✺'];

    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.textContent = glyphs[(Math.random()*glyphs.length)|0];

      const dx = rand(-r, r);
      const dy = rand(-r, r);
      const rot = `${rand(-120,120).toFixed(1)}deg`;
      const size = clamp(rand(10, 22), 10, 26);

      el.style.cssText = `
        position:absolute; left:${x}px; top:${y}px;
        transform: translate(-50%,-50%);
        font: 900 ${size}px/1 system-ui;
        color: rgba(255,255,255,.92);
        text-shadow: 0 10px 26px rgba(0,0,0,.45);
        opacity:0;
        will-change: transform, opacity;
        --dx:${dx.toFixed(1)}px;
        --dy:${dy.toFixed(1)}px;
        --rot:${rot};
        animation: hhaBurst 520ms ease-out forwards;
      `;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 620);
    }
  }

  function shockwave(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 66, 32, 220);
    const el = doc.createElement('div');
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      width:${r}px; height:${r}px;
      border-radius:999px;
      border: 2px solid rgba(255,255,255,.35);
      box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 12px 30px rgba(0,0,0,.28);
      transform: translate(-50%,-50%) scale(.25);
      opacity:0;
      --s:${(r/22).toFixed(2)};
      animation: hhaShock 520ms ease-out forwards;
      pointer-events:none;
    `;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 640);
  }

  function flash(a){
    const el = doc.createElement('div');
    el.className = 'hha-flash';
    el.style.setProperty('--a', String(clamp(a ?? .18, 0.06, 0.40)));
    doc.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 340);
  }

  function celebrate(){
    // safe global celebration
    flash(.18);
    const cx = innerWidth/2, cy = innerHeight*0.35;
    for(let i=0;i<9;i++){
      setTimeout(()=>{
        burst(cx + rand(-180,180), cy + rand(-90,90), { r: rand(30,70), n: rand(8,14)|0 });
      }, i*45);
    }
  }

  // ---------------- exports + aliases ----------------
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // compat aliases for older callers
  root.Particles.scorePop = function(x,y,text){ popText(x,y,text,'score'); };
  root.Particles.burstAt  = function(x,y,kind){
    const r = (kind==='bad') ? 68 : (kind==='diamond') ? 78 : 56;
    burst(x,y,{ r });
    if (kind==='bad') flash(.22);
  };

})(window);