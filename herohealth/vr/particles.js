// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA (shared FX core)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const MAX_SPARKS = 42;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function addEl(html){
    const layer = ensureLayer();
    const wrap = doc.createElement('div');
    wrap.innerHTML = html;
    const el = wrap.firstElementChild;
    layer.appendChild(el);
    return el;
  }

  function scorePop(x,y,text,cls=''){
    x = clamp(x, 0, doc.documentElement.clientWidth);
    y = clamp(y, 0, doc.documentElement.clientHeight);
    const el = addEl(`
      <div class="hha-pop ${cls}" style="left:${x}px;top:${y}px;">
        ${String(text||'')}
      </div>
    `);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 820);
  }

  function burstAt(x,y,kind='good'){
    x = clamp(x, 0, doc.documentElement.clientWidth);
    y = clamp(y, 0, doc.documentElement.clientHeight);

    const el = addEl(`<div class="hha-burst hha-burst-${kind}" style="left:${x}px;top:${y}px;"></div>`);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 560);

    const n = (kind==='boss' || kind==='rage') ? 18 : 12;
    for(let i=0;i<n;i++){
      const a = (Math.PI * 2) * (i/n);
      const d = (kind==='rage') ? 120 : (kind==='boss') ? 95 : 78;
      const dx = Math.cos(a) * (d * (0.55 + Math.random()*0.55));
      const dy = Math.sin(a) * (d * (0.55 + Math.random()*0.55));
      const s = addEl(`<div class="hha-spark hha-spark-${kind}" style="left:${x}px;top:${y}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;"></div>`);
      setTimeout(()=>{ try{ s.remove(); }catch(_){ } }, 560);
    }
  }

  function ringPulse(kind='storm'){
    const w = doc.documentElement.clientWidth;
    const h = doc.documentElement.clientHeight;
    const x = Math.floor(w/2), y = Math.floor(h/2);
    const el = addEl(`<div class="hha-ring hha-ring-${kind}" style="left:${x}px;top:${y}px;"></div>`);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 760);
  }

  function shake(intensity=8, ms=260){
    intensity = clamp(intensity, 0, 30);
    ms = clamp(ms, 80, 900);
    try{
      doc.body.style.setProperty('--hha-shake', intensity.toFixed(0) + 'px');
      doc.body.classList.add('hha-shake');
      setTimeout(()=>{ doc.body.classList.remove('hha-shake'); }, ms);
    }catch(_){}
  }

  function confetti(kind='end'){
    const layer = ensureLayer();
    const w = doc.documentElement.clientWidth;
    const n = clamp(kind==='end'? 26 : 16, 8, MAX_SPARKS);

    for(let i=0;i<n;i++){
      const x = Math.floor(Math.random() * w);
      const dx = (Math.random()*2-1) * 140;
      const rot = Math.floor(Math.random()*240-120);
      const t = addEl(`<div class="hha-confetti hha-confetti-${kind}" style="left:${x}px;top:-10px;--dx:${dx.toFixed(1)}px;--rot:${rot}deg;"></div>`);
      setTimeout(()=>{ try{ t.remove(); }catch(_){ } }, 1550);
    }
  }

  function celebrate(kind='mini'){
    if(kind==='mini'){ ringPulse('mini'); shake(6, 220); confetti('mini'); return; }
    if(kind==='boss'){ ringPulse('boss'); shake(10, 280); confetti('boss'); return; }
    if(kind==='rage'){ ringPulse('rage'); shake(14, 340); confetti('rage'); return; }
    ringPulse('end'); shake(8, 280); confetti('end');
  }

  const st = doc.createElement('style');
  st.textContent = `
    .hha-pop{
      position:absolute; transform: translate(-50%,-50%);
      font: 1000 18px/1 system-ui;
      color:#fff; opacity:.98;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      will-change: transform, opacity, filter;
      animation: hhaPop 760ms cubic-bezier(.16,.84,.16,1) forwards;
      padding: 4px 10px; border-radius: 999px;
      background: rgba(2,6,23,.18);
      border: 1px solid rgba(148,163,184,.16);
      backdrop-filter: blur(6px);
    }
    .hha-pop.good{ background: rgba(34,197,94,.14); border-color: rgba(34,197,94,.28); }
    .hha-pop.bad{ background: rgba(239,68,68,.14); border-color: rgba(239,68,68,.28); }
    .hha-pop.block{ background: rgba(34,211,238,.12); border-color: rgba(34,211,238,.26); }
    .hha-pop.star{ background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.26); }
    .hha-pop.diamond{ background: rgba(167,139,250,.14); border-color: rgba(167,139,250,.28); }

    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.86; filter: blur(.2px); }
      55%{ transform:translate(-50%,-80%) scale(1.22); opacity:1; filter: blur(0px); }
      100%{ transform:translate(-50%,-115%) scale(1.05); opacity:0; filter: blur(.4px); }
    }

    .hha-burst{
      position:absolute; width: 18px; height: 18px;
      transform: translate(-50%,-50%);
      border-radius: 999px; opacity: .95;
      animation: hhaBurst 560ms ease-out forwards;
      will-change: transform, opacity, box-shadow;
      background: rgba(255,255,255,.22);
    }
    .hha-burst-good{ background: rgba(34,197,94,.22); }
    .hha-burst-bad{ background: rgba(239,68,68,.22); }
    .hha-burst-star{ background: rgba(245,158,11,.22); }
    .hha-burst-shield{ background: rgba(34,211,238,.18); }
    .hha-burst-diamond{ background: rgba(167,139,250,.22); }
    .hha-burst-boss{ background: rgba(245,158,11,.20); }
    .hha-burst-rage{ background: rgba(239,68,68,.22); }

    @keyframes hhaBurst{
      0%{ transform:translate(-50%,-50%) scale(.8); opacity:.9; }
      70%{ transform:translate(-50%,-50%) scale(2.2); opacity:.8; }
      100%{ transform:translate(-50%,-50%) scale(2.6); opacity:0; }
    }

    .hha-spark{
      position:absolute; width: 6px; height: 6px;
      border-radius: 999px;
      transform: translate(-50%,-50%);
      opacity:.95;
      will-change: transform, opacity;
      animation: hhaSpark 560ms ease-out forwards;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      background: rgba(255,255,255,.85);
    }
    .hha-spark-good{ background: rgba(34,197,94,.92); }
    .hha-spark-bad{ background: rgba(239,68,68,.92); }
    .hha-spark-block{ background: rgba(34,211,238,.92); }
    .hha-spark-star{ background: rgba(245,158,11,.92); }
    .hha-spark-shield{ background: rgba(34,211,238,.92); }
    .hha-spark-diamond{ background: rgba(167,139,250,.92); }
    .hha-spark-boss{ background: rgba(245,158,11,.92); }
    .hha-spark-rage{ background: rgba(239,68,68,.92); }

    @keyframes hhaSpark{
      0%{ transform:translate(-50%,-50%) translate(0,0) scale(.9); opacity:.95; }
      60%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(1.05); opacity:.85; }
      100%{ transform:translate(-50%,-50%) translate(calc(var(--dx)*1.15), calc(var(--dy)*1.15)) scale(.6); opacity:0; }
    }

    .hha-ring{
      position:absolute; width: 24px; height:24px;
      border-radius: 999px;
      transform: translate(-50%,-50%);
      border: 2px solid rgba(255,255,255,.30);
      opacity:.9;
      animation: hhaRing 760ms ease-out forwards;
      will-change: transform, opacity;
      filter: drop-shadow(0 18px 45px rgba(0,0,0,.45));
    }
    .hha-ring-mini{ border-color: rgba(34,197,94,.38); }
    .hha-ring-storm{ border-color: rgba(34,211,238,.40); }
    .hha-ring-boss{ border-color: rgba(245,158,11,.42); }
    .hha-ring-rage{ border-color: rgba(239,68,68,.44); }
    .hha-ring-end{ border-color: rgba(167,139,250,.42); }

    @keyframes hhaRing{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.55; }
      40%{ opacity:.95; }
      100%{ transform:translate(-50%,-50%) scale(18); opacity:0; }
    }

    .hha-confetti{
      position:absolute; width: 10px; height: 14px;
      border-radius: 4px; opacity:.95;
      will-change: transform, opacity;
      transform: translate(-50%,-50%);
      animation: hhaConfetti 1500ms cubic-bezier(.12,.86,.18,1) forwards;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      background: rgba(255,255,255,.85);
    }
    .hha-confetti-mini{ background: rgba(34,197,94,.92); }
    .hha-confetti-boss{ background: rgba(245,158,11,.92); }
    .hha-confetti-rage{ background: rgba(239,68,68,.92); }
    .hha-confetti-end{ background: rgba(167,139,250,.92); }

    @keyframes hhaConfetti{
      0%{ transform:translate(-50%,-50%) translate(0,0) rotate(0deg); opacity:.95; }
      70%{ opacity:.92; }
      100%{ transform:translate(-50%,-50%) translate(var(--dx), 980px) rotate(var(--rot)); opacity:0; }
    }

    body.hha-shake{ animation: hhaShake 110ms linear infinite; }
    @keyframes hhaShake{
      0%{ transform: translate(0,0); }
      20%{ transform: translate(calc(var(--hha-shake)*.6), calc(var(--hha-shake)*-.35)); }
      40%{ transform: translate(calc(var(--hha-shake)*-.55), calc(var(--hha-shake)*.4)); }
      60%{ transform: translate(calc(var(--hha-shake)*.45), calc(var(--hha-shake)*.25)); }
      80%{ transform: translate(calc(var(--hha-shake)*-.35), calc(var(--hha-shake)*-.25)); }
      100%{ transform: translate(0,0); }
    }
  `;
  doc.head.appendChild(st);

  root.Particles = root.Particles || {};
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.shake = shake;
  root.Particles.ringPulse = ringPulse;
  root.Particles.celebrate = celebrate;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);