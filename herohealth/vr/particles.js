// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA FX (Shared for ALL games)
// ✅ Layer: .hha-fx-layer (z-index:90, pointer-events:none)
// ✅ API:
//    Particles.scorePop(x,y,text,cls?)
//    Particles.burstAt(x,y,kind='good')
//    Particles.missX(x,y)
//    Particles.celebrate(kind='end')
//    Particles.vignette(on=true, level=1)
// Notes:
// - Works without canvas. Pure DOM + CSS keyframes.
// - Safe clamp positions; auto-create styles once.

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);

  function vw(){ return doc.documentElement.clientWidth || 360; }
  function vh(){ return doc.documentElement.clientHeight || 640; }

  function clampXY(x,y){
    const W = vw(), H = vh();
    const cx = clamp(Number(x)||W/2, 12, W-12);
    const cy = clamp(Number(y)||H/2, 12, H-12);
    return {x:cx,y:cy};
  }

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureVignette(){
    let v = doc.querySelector('.hha-fx-vignette');
    if(v) return v;
    v = doc.createElement('div');
    v.className = 'hha-fx-vignette';
    v.style.cssText = `
      position:fixed; inset:0; z-index:88; pointer-events:none;
      opacity:0; transition: opacity 180ms ease;
    `;
    doc.body.appendChild(v);
    return v;
  }

  function el(tag, cls){
    const e = doc.createElement(tag);
    if(cls) e.className = cls;
    return e;
  }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const p = clampXY(x,y);

    const node = el('div', 'hha-pop ' + (cls||''));
    node.textContent = String(text ?? '');
    node.style.left = p.x + 'px';
    node.style.top  = p.y + 'px';

    layer.appendChild(node);
    setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, 900);
  }

  function scorePop(x,y,text,cls){
    // cls: 'good'|'bad'|'star'|'shield'|'diamond'|'block'|'warn'
    popText(x,y,text,'hha-score ' + (cls||''));
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const p = clampXY(x,y);

    const wrap = el('div','hha-burst ' + (kind||'good'));
    wrap.style.left = p.x + 'px';
    wrap.style.top  = p.y + 'px';

    // ring
    const ring = el('div','hha-ring');
    wrap.appendChild(ring);

    // sparks
    const n = (kind==='bad') ? 14 : (kind==='diamond') ? 18 : 12;
    for(let i=0;i<n;i++){
      const s = el('i','hha-spark');
      const a = (Math.PI*2) * (i/n) + rnd(-0.10,0.10);
      const dist = (kind==='diamond') ? rnd(46,86) : rnd(34,72);
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist;
      s.style.setProperty('--dx', dx.toFixed(1) + 'px');
      s.style.setProperty('--dy', dy.toFixed(1) + 'px');
      s.style.setProperty('--d',  (rnd(420, 760)|0) + 'ms');
      s.style.setProperty('--r',  (rnd(-55, 55)|0) + 'deg');
      wrap.appendChild(s);
    }

    layer.appendChild(wrap);
    setTimeout(()=>{ try{ wrap.remove(); }catch(_){ } }, 900);
  }

  function missX(x,y){
    const layer = ensureLayer();
    const p = clampXY(x,y);

    const node = el('div','hha-missx');
    node.style.left = p.x + 'px';
    node.style.top  = p.y + 'px';
    node.innerHTML = '<span>✕</span>';

    layer.appendChild(node);
    setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, 650);
  }

  function celebrate(kind='end'){
    const layer = ensureLayer();
    const W = vw(), H = vh();

    // confetti burst around top center
    const cx = W/2;
    const cy = Math.min(140, H*0.22);

    const wrap = el('div','hha-celebrate ' + kind);
    wrap.style.left = cx + 'px';
    wrap.style.top  = cy + 'px';

    const pieces = (kind==='end') ? 38 : (kind==='mini') ? 28 : 32;
    for(let i=0;i<pieces;i++){
      const c = el('i','hha-confetti');
      const a = rnd(-Math.PI*0.95, Math.PI*0.05); // mostly upward fan
      const dist = rnd(90, 220);
      const dx = Math.cos(a)*dist;
      const dy = Math.sin(a)*dist;
      c.style.setProperty('--dx', dx.toFixed(1)+'px');
      c.style.setProperty('--dy', dy.toFixed(1)+'px');
      c.style.setProperty('--d',  (rnd(820, 1400)|0)+'ms');
      c.style.setProperty('--s',  rnd(0.7, 1.25).toFixed(2));
      c.style.setProperty('--rot',(rnd(-160,160)|0)+'deg');
      wrap.appendChild(c);
    }

    layer.appendChild(wrap);
    setTimeout(()=>{ try{ wrap.remove(); }catch(_){ } }, 1600);
  }

  function vignette(on=true, level=1){
    const v = ensureVignette();
    const lv = clamp(Number(level)||1, 1, 3);
    v.dataset.level = String(lv);
    v.style.opacity = on ? (lv===1?'.20':lv===2?'.32':'.42') : '0';
  }

  // inject styles once
  const st = doc.createElement('style');
  st.textContent = `
    .hha-pop{
      position:absolute;
      transform: translate(-50%,-50%) scale(.96);
      opacity:.98;
      font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
      letter-spacing:.2px;
      text-shadow: 0 10px 28px rgba(0,0,0,.55);
      will-change: transform, opacity;
      animation: hhaPop 720ms ease-out forwards;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(2,6,23,.28);
      border: 1px solid rgba(148,163,184,.14);
      backdrop-filter: blur(10px);
    }
    .hha-score.good{ border-color: rgba(34,197,94,.25); }
    .hha-score.bad{ border-color: rgba(239,68,68,.25); }
    .hha-score.star{ border-color: rgba(245,158,11,.25); }
    .hha-score.shield{ border-color: rgba(34,211,238,.25); }
    .hha-score.diamond{ border-color: rgba(167,139,250,.25); }
    .hha-score.block{ border-color: rgba(148,163,184,.25); }
    .hha-score.warn{ border-color: rgba(245,158,11,.25); }

    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.0; }
      18%{ transform:translate(-50%,-56%) scale(1.05); opacity:1; }
      72%{ transform:translate(-50%,-76%) scale(1.10); opacity:1; }
      100%{ transform:translate(-50%,-94%) scale(1.03); opacity:0; }
    }

    .hha-burst{
      position:absolute;
      transform: translate(-50%,-50%);
      width:1px; height:1px;
      animation: hhaBurstFade 820ms ease-out forwards;
      will-change: transform, opacity;
    }
    @keyframes hhaBurstFade{
      0%{ opacity:1; }
      100%{ opacity:0; }
    }
    .hha-burst .hha-ring{
      position:absolute;
      left:-6px; top:-6px;
      width:12px; height:12px;
      border-radius:999px;
      border: 2px solid rgba(34,197,94,.55);
      box-shadow: 0 0 0 10px rgba(34,197,94,.10);
      animation: hhaRing 520ms ease-out forwards;
    }
    .hha-burst.bad .hha-ring{ border-color: rgba(239,68,68,.55); box-shadow:0 0 0 10px rgba(239,68,68,.10); }
    .hha-burst.star .hha-ring{ border-color: rgba(245,158,11,.55); box-shadow:0 0 0 10px rgba(245,158,11,.10); }
    .hha-burst.shield .hha-ring{ border-color: rgba(34,211,238,.55); box-shadow:0 0 0 10px rgba(34,211,238,.10); }
    .hha-burst.diamond .hha-ring{ border-color: rgba(167,139,250,.55); box-shadow:0 0 0 12px rgba(167,139,250,.10); }
    .hha-burst.block .hha-ring{ border-color: rgba(148,163,184,.55); box-shadow:0 0 0 10px rgba(148,163,184,.10); }

    @keyframes hhaRing{
      0%{ transform:scale(.6); opacity:.0; }
      20%{ transform:scale(1.0); opacity:1; }
      100%{ transform:scale(4.2); opacity:0; }
    }

    .hha-burst .hha-spark{
      position:absolute;
      left:0; top:0;
      width: 6px; height: 6px;
      border-radius: 3px;
      background: rgba(34,197,94,.92);
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
      transform: translate(0,0) rotate(0deg);
      animation: hhaSpark var(--d,600ms) ease-out forwards;
      will-change: transform, opacity;
      opacity: .98;
    }
    .hha-burst.bad .hha-spark{ background: rgba(239,68,68,.92); }
    .hha-burst.star .hha-spark{ background: rgba(245,158,11,.92); }
    .hha-burst.shield .hha-spark{ background: rgba(34,211,238,.92); }
    .hha-burst.diamond .hha-spark{ background: rgba(167,139,250,.92); }
    .hha-burst.block .hha-spark{ background: rgba(148,163,184,.92); }

    @keyframes hhaSpark{
      0%{ transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
      70%{ transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(1); opacity:1; }
      100%{ transform: translate(calc(var(--dx)*1.06), calc(var(--dy)*1.06)) rotate(var(--r)) scale(.55); opacity:0; }
    }

    .hha-missx{
      position:absolute;
      transform: translate(-50%,-50%) scale(.9);
      opacity: 1;
      font: 1400 44px/1 system-ui;
      text-shadow: 0 16px 44px rgba(0,0,0,.55);
      animation: hhaMissX 560ms ease-out forwards;
      will-change: transform, opacity;
    }
    @keyframes hhaMissX{
      0%{ transform:translate(-50%,-50%) scale(.8); opacity:0; }
      20%{ transform:translate(-50%,-50%) scale(1.15); opacity:1; }
      100%{ transform:translate(-50%,-76%) scale(1.0); opacity:0; }
    }

    .hha-celebrate{
      position:absolute;
      transform: translate(-50%,-50%);
      width:1px; height:1px;
      pointer-events:none;
    }
    .hha-confetti{
      position:absolute;
      left:0; top:0;
      width: 10px; height: 6px;
      border-radius: 2px;
      background: rgba(34,197,94,.92);
      transform: translate(0,0) rotate(0deg) scale(1);
      opacity: .98;
      animation: hhaConfetti var(--d,1000ms) cubic-bezier(.18,.8,.22,1) forwards;
    }
    .hha-celebrate.end .hha-confetti{ background: rgba(34,211,238,.92); }
    .hha-celebrate.mini .hha-confetti{ background: rgba(245,158,11,.92); }
    .hha-celebrate.perfect .hha-confetti{ background: rgba(34,197,94,.92); }
    .hha-celebrate.boss .hha-confetti{ background: rgba(239,68,68,.92); }

    @keyframes hhaConfetti{
      0%{ transform: translate(0,0) rotate(0deg) scale(var(--s,1)); opacity:0; }
      12%{ opacity:1; }
      70%{ transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(var(--s,1)); opacity:1; }
      100%{ transform: translate(calc(var(--dx)*1.06), calc(var(--dy)*1.10)) rotate(calc(var(--rot)*1.2)) scale(calc(var(--s,1)*.85)); opacity:0; }
    }

    .hha-fx-vignette{
      background:
        radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.35) 100%);
      mix-blend-mode: multiply;
    }
    .hha-fx-vignette[data-level="2"]{
      background:
        radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,.45) 100%);
    }
    .hha-fx-vignette[data-level="3"]{
      background:
        radial-gradient(circle at center, rgba(0,0,0,0) 38%, rgba(0,0,0,.55) 100%);
    }

    @media (prefers-reduced-motion: reduce){
      .hha-pop,.hha-burst,.hha-spark,.hha-missx,.hha-confetti{ animation:none!important; transition:none!important; }
    }
  `;
  doc.head.appendChild(st);

  // public API
  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.scorePop  = scorePop;
  root.Particles.burstAt   = burstAt;
  root.Particles.missX     = missX;
  root.Particles.celebrate = celebrate;
  root.Particles.vignette  = vignette;

  // also as module registry if you use GAME_MODULES
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);