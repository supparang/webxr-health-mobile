// === /herohealth/vr/hha-packd-fx.js ===
// Packed Screen FX (global) — PRODUCTION
// ✅ listens: hha:tick { kind, intensity }
// ✅ PATCH B2: laser-warn / laser-fire (red vignette + shake + beep)
// ✅ safe: reduced-motion, no external assets

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // -------------------------
  // style + layer
  // -------------------------
  function ensureStyle () {
    if (doc.getElementById('hha-packd-fx-style')) return;
    const s = doc.createElement('style');
    s.id = 'hha-packd-fx-style';
    s.textContent = `
      .hha-fx-packd{
        position:fixed;
        inset:0;
        z-index:9997;
        pointer-events:none;
        overflow:hidden;
      }
      .hha-fx-packd .vignette{
        position:absolute;
        inset:-2px;
        opacity:0;
        border-radius:22px;
        box-shadow:
          inset 0 0 0 2px rgba(255,255,255,0.04),
          inset 0 0 120px rgba(0,0,0,0.65);
        filter: saturate(1.05);
        will-change: opacity, transform, filter;
      }
      .hha-fx-packd .vignette.red{
        box-shadow:
          inset 0 0 0 2px rgba(255,80,96,0.18),
          inset 0 0 90px rgba(255,80,96,0.16),
          inset 0 0 160px rgba(0,0,0,0.66);
      }
      .hha-fx-packd .flash{
        position:absolute;
        inset:0;
        opacity:0;
        background: radial-gradient(circle at 50% 52%,
          rgba(255,80,96,0.22),
          rgba(255,80,96,0.10) 40%,
          rgba(0,0,0,0) 68%);
        mix-blend-mode: screen;
        will-change: opacity;
      }
      .hha-fx-packd .scan{
        position:absolute;
        left:-30%;
        top:0;
        width:160%;
        height:100%;
        opacity:0;
        background:
          linear-gradient( to bottom,
            rgba(255,80,96,0) 0%,
            rgba(255,80,96,0.08) 45%,
            rgba(255,80,96,0.16) 50%,
            rgba(255,80,96,0.08) 55%,
            rgba(255,80,96,0) 100%);
        transform: translateY(-22%);
        will-change: transform, opacity;
      }

      /* shake classes on body for whole UI */
      @keyframes hhaShakeSoft {
        0%{ transform:translate3d(0,0,0); }
        25%{ transform:translate3d(1px,0,0); }
        50%{ transform:translate3d(-1px,1px,0); }
        75%{ transform:translate3d(0,-1px,0); }
        100%{ transform:translate3d(0,0,0); }
      }
      @keyframes hhaShakeHard {
        0%{ transform:translate3d(0,0,0) rotate(0deg); }
        20%{ transform:translate3d(2px,1px,0) rotate(0.12deg); }
        40%{ transform:translate3d(-2px,2px,0) rotate(-0.12deg); }
        60%{ transform:translate3d(2px,-2px,0) rotate(0.10deg); }
        80%{ transform:translate3d(-2px,1px,0) rotate(-0.10deg); }
        100%{ transform:translate3d(0,0,0) rotate(0deg); }
      }

      body.hha-shake-soft{
        animation: hhaShakeSoft .22s ease-in-out 1;
      }
      body.hha-shake-hard{
        animation: hhaShakeHard .18s ease-in-out 1;
      }

      @media (prefers-reduced-motion: reduce){
        body.hha-shake-soft,
        body.hha-shake-hard{ animation:none !important; }
        .hha-fx-packd .scan{ display:none !important; }
      }
    `;
    doc.head.appendChild(s);
  }

  function ensureLayer () {
    ensureStyle();
    let layer = doc.getElementById('hha-packd-fx');
    if (layer && layer.isConnected) return layer;

    layer = doc.createElement('div');
    layer.id = 'hha-packd-fx';
    layer.className = 'hha-fx-packd';
    layer.innerHTML = `
      <div class="vignette red"></div>
      <div class="flash"></div>
      <div class="scan"></div>
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  const layer = ensureLayer();
  const elV = layer.querySelector('.vignette.red');
  const elF = layer.querySelector('.flash');
  const elS = layer.querySelector('.scan');

  // -------------------------
  // tiny audio (no files)
  // -------------------------
  let ac = null;
  function getAC(){
    try{
      if (ac && ac.state !== 'closed') return ac;
      ac = new (root.AudioContext || root.webkitAudioContext)();
      return ac;
    }catch{ return null; }
  }
  function beep(freq, durMs, gain){
    const ctx = getAC();
    if (!ctx) return;
    try{
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = Math.max(0.0001, gain || 0.02);
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (durMs/1000));
      o.start(now);
      o.stop(now + (durMs/1000) + 0.02);
    }catch{}
  }

  // -------------------------
  // helpers
  // -------------------------
  let tV = 0, tF = 0, tS = 0, tBody = 0;

  function clearTimers(){
    try{ if (tV) clearTimeout(tV); }catch{}
    try{ if (tF) clearTimeout(tF); }catch{}
    try{ if (tS) clearTimeout(tS); }catch{}
    try{ if (tBody) clearTimeout(tBody); }catch{}
    tV = tF = tS = tBody = 0;
  }

  function pulseVignette(opacity, ms){
    if (!elV) return;
    elV.style.opacity = String(opacity);
    try{ if (tV) clearTimeout(tV); }catch{}
    tV = setTimeout(()=>{ elV.style.opacity = '0'; }, Math.max(40, ms|0));
  }

  function flash(opacity, ms){
    if (!elF) return;
    elF.style.opacity = String(opacity);
    try{ if (tF) clearTimeout(tF); }catch{}
    tF = setTimeout(()=>{ elF.style.opacity = '0'; }, Math.max(40, ms|0));
  }

  function scanline(opacity, ms){
    if (!elS) return;
    elS.style.opacity = String(opacity);
    elS.style.transform = 'translateY(-22%)';
    // animate down
    requestAnimationFrame(()=>{
      elS.style.transition = `transform ${Math.max(80, ms|0)}ms linear, opacity 120ms ease`;
      elS.style.transform = 'translateY(22%)';
    });
    try{ if (tS) clearTimeout(tS); }catch{}
    tS = setTimeout(()=>{
      elS.style.transition = '';
      elS.style.opacity = '0';
    }, Math.max(120, ms|0));
  }

  function shakeBody(kind){
    const b = doc.body;
    if (!b) return;
    // restart animation
    b.classList.remove('hha-shake-soft','hha-shake-hard');
    void b.offsetWidth;
    b.classList.add(kind === 'hard' ? 'hha-shake-hard' : 'hha-shake-soft');
    try{ if (tBody) clearTimeout(tBody); }catch{}
    tBody = setTimeout(()=> b.classList.remove('hha-shake-soft','hha-shake-hard'), 420);
  }

  // -------------------------
  // public API: tick(kind,intensity)
  // -------------------------
  function tick(kind, intensity){
    const k = String(kind || '').toLowerCase();
    const I = Math.max(0.1, Math.min(1.8, Number(intensity || 1)));

    // laser warn: “ติ๊กๆ” + vignette แดงเบาๆ + สั่นเบา
    if (k === 'laser-warn'){
      pulseVignette(0.22 + 0.22*I, 220);
      scanline(0.18 + 0.18*I, 260);
      shakeBody('soft');
      // tick sound
      beep(980, 40, 0.012 + 0.010*I);
      return;
    }

    // laser fire: แรงขึ้น + flash + สั่นแรง + beep หนักกว่า
    if (k === 'laser-fire'){
      pulseVignette(0.40 + 0.28*I, 260);
      flash(0.22 + 0.22*I, 160);
      scanline(0.26 + 0.22*I, 220);
      shakeBody('hard');
      beep(740, 70, 0.018 + 0.014*I);
      // สะกิดซ้ำอีกทีแบบ “บึ้ม”
      setTimeout(()=> beep(520, 60, 0.014 + 0.012*I), 60);
      return;
    }

    // fallback (generic tick)
    pulseVignette(0.16, 180);
  }

  // expose
  root.HHAPackdFX = root.HHAPackdFX || {};
  root.HHAPackdFX.tick = tick;
  root.HHAPackdFX.clear = clearTimers;

  // listen events
  root.addEventListener('hha:tick', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    tick(d.kind, d.intensity);
  });

})(typeof window !== 'undefined' ? window : globalThis);