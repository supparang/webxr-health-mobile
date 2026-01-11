// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (shared FX core)
// ✅ Provides: popText, scorePop, burstAt, shockwave, celebrate
// ✅ No external deps, safe for all games
// ✅ Uses a single fixed .hha-fx-layer (z-index:90) + internal styles

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
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index:90;
      overflow:hidden;
      contain: layout style paint;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------------- styles ----------------
  (function injectStyle(){
    if(doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      @keyframes hhaScorePop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.96; }
        55%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.06); opacity:0; }
      }
      @keyframes hhaBurstRing{
        0%{ transform:translate(-50%,-50%) scale(.65); opacity:.75; }
        70%{ transform:translate(-50%,-50%) scale(1.28); opacity:.26; }
        100%{ transform:translate(-50%,-50%) scale(1.48); opacity:0; }
      }
      @keyframes hhaShock{
        0%{ transform:translate(-50%,-50%) scale(.35); opacity:.75; }
        65%{ transform:translate(-50%,-50%) scale(1.20); opacity:.18; }
        100%{ transform:translate(-50%,-50%) scale(1.38); opacity:0; }
      }
      @keyframes hhaConfetti{
        0%{ transform:translate3d(var(--x), var(--y), 0) rotate(0deg); opacity:1; }
        100%{ transform:translate3d(calc(var(--x) + var(--dx)), calc(var(--y) + var(--dy)), 0) rotate(var(--rot)); opacity:0; }
      }

      .hha-pop{
        position:absolute;
        left: var(--px); top: var(--py);
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        letter-spacing: .2px;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        will-change: transform, opacity;
        animation: hhaScorePop 560ms ease-out forwards;
        padding: 7px 10px;
        border-radius: 14px;
        background: rgba(2,6,23,.32);
        border: 1px solid rgba(148,163,184,.20);
        backdrop-filter: blur(6px);
        white-space:nowrap;
      }
      .hha-pop.big{
        font-size: 22px;
        padding: 9px 12px;
        border-radius: 16px;
      }
      .hha-pop.perfect{
        background: rgba(34,197,94,.20);
        border-color: rgba(34,197,94,.30);
      }
      .hha-pop.bad{
        background: rgba(239,68,68,.18);
        border-color: rgba(239,68,68,.28);
      }
      .hha-pop.warn{
        background: rgba(245,158,11,.18);
        border-color: rgba(245,158,11,.28);
      }

      .hha-ring{
        position:absolute;
        left: var(--px); top: var(--py);
        width: var(--sz); height: var(--sz);
        transform: translate(-50%,-50%);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(34,197,94,.18), transparent 62%);
        border: 1px solid rgba(34,197,94,.25);
        animation: hhaBurstRing 520ms ease-out forwards;
      }
      .hha-ring.bad{
        background: radial-gradient(circle, rgba(239,68,68,.18), transparent 62%);
        border-color: rgba(239,68,68,.25);
      }
      .hha-ring.star{
        background: radial-gradient(circle, rgba(245,158,11,.18), transparent 62%);
        border-color: rgba(245,158,11,.25);
      }
      .hha-ring.shield{
        background: radial-gradient(circle, rgba(59,130,246,.18), transparent 62%);
        border-color: rgba(59,130,246,.25);
      }
      .hha-ring.diamond{
        background: radial-gradient(circle, rgba(168,85,247,.20), transparent 62%);
        border-color: rgba(168,85,247,.25);
      }

      .hha-shock{
        position:absolute;
        left: var(--px); top: var(--py);
        width: var(--sz); height: var(--sz);
        transform: translate(-50%,-50%);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255,255,255,.10), transparent 66%);
        border: 1px solid rgba(255,255,255,.16);
        animation: hhaShock 460ms ease-out forwards;
      }

      .hha-confetti{
        position:absolute;
        width: 10px; height: 10px;
        border-radius: 3px;
        left: 0; top: 0;
        transform: translate3d(var(--x), var(--y), 0);
        opacity: 1;
        animation: hhaConfetti 820ms ease-out forwards;
        box-shadow: 0 10px 24px rgba(0,0,0,.25);
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  function rmLater(el, ms){ setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms); }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? ` ${cls}` : '');
    el.textContent = String(text ?? '');
    el.style.setProperty('--px', `${Math.floor(x)}px`);
    el.style.setProperty('--py', `${Math.floor(y)}px`);
    layer.appendChild(el);
    rmLater(el, 900);
  }

  function scorePop(x,y,text){
    // classify
    const t = String(text ?? '');
    let cls = '';
    if(/^(\+)?\d{2,}/.test(t)) cls = 'big';
    if(/PERFECT/i.test(t)) cls = (cls ? cls+' ' : '') + 'perfect';
    if(/MISS|OOPS|BAD|RAGE|BOSS/i.test(t)) cls = (cls ? cls+' ' : '') + 'bad';
    if(/STORM|WARN/i.test(t)) cls = (cls ? cls+' ' : '') + 'warn';
    popText(x,y,t,cls.trim());
  }

  function burstAt(x,y,kind='good'){
    const layer = ensureLayer();
    const ring = doc.createElement('div');
    ring.className = 'hha-ring ' + (kind || '');
    const sz = (kind==='diamond') ? 110 : (kind==='bad') ? 98 : 90;
    ring.style.setProperty('--px', `${Math.floor(x)}px`);
    ring.style.setProperty('--py', `${Math.floor(y)}px`);
    ring.style.setProperty('--sz', `${sz}px`);
    layer.appendChild(ring);
    rmLater(ring, 750);
  }

  function shockwave(x,y,opts={}){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-shock';
    const sz = clamp(Number(opts.r)||88, 54, 160);
    el.style.setProperty('--px', `${Math.floor(x)}px`);
    el.style.setProperty('--py', `${Math.floor(y)}px`);
    el.style.setProperty('--sz', `${Math.floor(sz)}px`);
    layer.appendChild(el);
    rmLater(el, 650);
  }

  function celebrate(){
    const layer = ensureLayer();
    const W = doc.documentElement.clientWidth || 360;
    const H = doc.documentElement.clientHeight || 640;
    const n = 26;

    for(let i=0;i<n;i++){
      const c = doc.createElement('div');
      c.className = 'hha-confetti';

      const x = Math.floor(W * 0.5 + (Math.random()*2-1)*140);
      const y = Math.floor(H * 0.28 + (Math.random()*2-1)*90);
      const dx = Math.floor((Math.random()*2-1)*220);
      const dy = Math.floor(220 + Math.random()*260);
      const rot = Math.floor((Math.random()*2-1)*560) + 'deg';

      c.style.setProperty('--x', `${x}px`);
      c.style.setProperty('--y', `${y}px`);
      c.style.setProperty('--dx', `${dx}px`);
      c.style.setProperty('--dy', `${dy}px`);
      c.style.setProperty('--rot', rot);

      // random pleasant palette but not hard-coded by theme engine
      // (keep simple: gradient-ish via opacity)
      c.style.background = `rgba(${Math.floor(80+Math.random()*175)},${Math.floor(80+Math.random()*175)},${Math.floor(80+Math.random()*175)},.95)`;

      layer.appendChild(c);
      rmLater(c, 980);
    }
  }

  // ---------------- exports ----------------
  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.scorePop  = scorePop;
  root.Particles.burstAt   = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // backward-compatible alias (some older calls)
  root.Particles.burst = function(x,y,opts){ burstAt(x,y, opts?.kind || 'good'); };
  root.Particles.popText = popText;

})(window);