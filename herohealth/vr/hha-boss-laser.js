// === /herohealth/vr/hha-boss-laser.js ===
// Boss LASER overlay (X-LASER + SWEEP + DOUBLE SWEEP) — NO ENGINE CHANGES
// - listens: hha:time {sec}, hha:adaptive {level}, hha:stop
// - emits:   hha:bossAtk {name:'laser'},
//            hha:tick {kind:'laser-warn'|'laser-fire', intensity},
//            hha:bossHit {type:'laser', pattern, intensity}   ✅ (โดนเลเซอร์)
// - adaptive: adaptLevel สูง -> ถี่ขึ้น + หนาขึ้น + โผล่ X/DoubleSweep มากขึ้น

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)||0));

  // optional PostFXCanvas
  const PostFXCanvas = root.PostFXCanvas || null;

  // -------------------------------
  // Inject CSS
  // -------------------------------
  function ensureStyle(){
    if (doc.getElementById('hha-boss-laser-style')) return;
    const s = doc.createElement('style');
    s.id = 'hha-boss-laser-style';
    s.textContent = `
#hhaBossLaser{
  position:fixed; inset:0;
  pointer-events:none;
  z-index:44; /* above targets(z=35), under PostFX(46)/PackD(70)/HUD(80) */
  opacity:0;
  transition: opacity .10s ease;
}
#hhaBossLaser.on{ opacity:1; }

.hhaLaserBeam{
  position:absolute;
  left:50%; top:50%;
  transform: translate(-50%,-50%) rotate(var(--ang, 0deg)) translateY(var(--off, 0px));
  width: 220vmax;
  height: var(--th, 10px);
  border-radius: 999px;
  background: linear-gradient(90deg,
    rgba(255,80,96,0) 0%,
    rgba(255,80,96,.30) 22%,
    rgba(255,220,240,.92) 50%,
    rgba(255,80,96,.30) 78%,
    rgba(255,80,96,0) 100%);
  box-shadow:
    0 0 14px rgba(255,80,96,.34),
    0 0 34px rgba(255,80,96,.22),
    0 0 70px rgba(255,80,96,.12);
  filter: blur(.25px);
  opacity: var(--op, .0);
  will-change: transform, opacity;
}

.hhaLaserBeam.warn{
  background: linear-gradient(90deg,
    rgba(255,80,96,0) 0%,
    rgba(255,80,96,.14) 28%,
    rgba(255,220,240,.55) 50%,
    rgba(255,80,96,.14) 72%,
    rgba(255,80,96,0) 100%);
  box-shadow:
    0 0 10px rgba(255,80,96,.18),
    0 0 22px rgba(255,80,96,.12);
  filter: blur(.2px);
}
@media (prefers-reduced-motion: reduce){
  .hhaLaserBeam{ filter:none !important; }
}
`;
    doc.head.appendChild(s);
  }

  function ensureLayer(){
    ensureStyle();
    let el = doc.getElementById('hhaBossLaser');
    if (el && el.isConnected) return el;
    el = doc.createElement('div');
    el.id = 'hhaBossLaser';
    doc.body.appendChild(el);
    return el;
  }

  const layer = ensureLayer();

  // -------------------------------
  // Helpers
  // -------------------------------
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
  }

  function setOn(on){
    if (on) layer.classList.add('on');
    else layer.classList.remove('on');
  }

  function clearBeams(){
    for (const b of beams) { try{ b.el.remove(); }catch{} }
    beams.length = 0;
  }

  function easeInOut(p){
    p = clamp(p,0,1);
    return p < 0.5 ? (2*p*p) : (1 - Math.pow(-2*p+2,2)/2);
  }

  function getCrosshairXY(){
    const ch = doc.getElementById('hvr-crosshair');
    if (ch){
      const r = ch.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0){
        return { x: r.left + r.width/2, y: r.top + r.height/2 };
      }
    }
    // fallback: viewport center-ish
    return { x: (root.innerWidth||1)*0.5, y: (root.innerHeight||1)*0.52 };
  }

  // distance from point to beam line:
  // line normal n = (-sinθ, cosθ), equation n·(p-center) = offPx
  function distToBeam(px, py, thetaRad, offPx){
    const cx = (root.innerWidth||1) * 0.5;
    const cy = (root.innerHeight||1) * 0.5;
    const nx = -Math.sin(thetaRad);
    const ny =  Math.cos(thetaRad);
    const dx = px - cx;
    const dy = py - cy;
    return Math.abs(nx*dx + ny*dy - offPx);
  }

  // -------------------------------
  // Beam object (JS-driven sweep)
  // -------------------------------
  const beams = []; // {el, angDeg, th, op, warn, off, sweep:{t0,dur,from,to}}
  function makeBeam({ angDeg=0, thickness=10, opacity=1, warn=false, off=0, sweep=null }){
    const el = doc.createElement('div');
    el.className = 'hhaLaserBeam' + (warn ? ' warn' : '');
    el.style.setProperty('--ang', angDeg.toFixed(2) + 'deg');
    el.style.setProperty('--th', thickness.toFixed(1) + 'px');
    el.style.setProperty('--op', String(opacity));
    el.style.setProperty('--off', off.toFixed(2) + 'px');
    layer.appendChild(el);

    const b = { el, angDeg, th: thickness, op: opacity, warn, off, sweep };
    beams.push(b);
    return b;
  }

  function updateBeams(ts){
    // update sweep offsets if any
    for (const b of beams){
      if (b.sweep){
        const p = clamp((ts - b.sweep.t0) / b.sweep.dur, 0, 1);
        const e = easeInOut(p);
        b.off = b.sweep.from + (b.sweep.to - b.sweep.from) * e;
        b.el.style.setProperty('--off', b.off.toFixed(2) + 'px');
      }
    }
  }

  // -------------------------------
  // State
  // -------------------------------
  let secLeft = null;
  let running = false;
  let adaptLevel = 0;

  let nextAtkAt = 0;
  let phase = 'idle'; // 'warn'|'fire'
  let phaseEndsAt = 0;

  let pattern = 'sweep';
  let ang = 0;
  let intensity = 1.0;

  // hit cooldown
  let lastHitAt = 0;

  function intensityFromContext(){
    const t = (secLeft == null) ? 0.3 : clamp((30 - secLeft) / 30, 0, 1);
    const lvl = clamp(adaptLevel, -1, 3);
    return clamp(0.55 + 0.18*lvl + 0.35*t, 0.35, 1.7);
  }

  function scheduleNext(){
    const lvl = clamp(adaptLevel, -1, 3);
    const tail = (secLeft == null) ? 0 : clamp((20 - secLeft)/20, 0, 1);
    const base = 11.0 - (lvl * 1.6) - (tail * 3.0);
    const jitter = (Math.random()*1.6 - 0.8);
    const sec = clamp(base + jitter, 4.6, 14.0);
    nextAtkAt = now() + sec*1000;
  }

  function pickPattern(){
    const lvl = clamp(adaptLevel, -1, 3);
    const r = Math.random();

    // lvl 3: โผล่ doubleSweep เพิ่ม
    if (lvl >= 3){
      if (r < 0.38) return 'doubleSweep';
      if (r < 0.70) return 'x';
      return 'sweep';
    }
    if (lvl >= 2) return (r < 0.70 ? 'x' : 'sweep');
    if (lvl >= 1) return (r < 0.45 ? 'x' : 'sweep');
    return (r < 0.25 ? 'x' : 'sweep');
  }

  function pickAngle(){
    let a = (Math.random()*140 - 70);
    if (Math.abs(a) < 12) a += (a < 0 ? -12 : 12);
    return a;
  }

  function startWarn(){
    pattern = pickPattern();
    intensity = intensityFromContext();

    clearBeams();
    setOn(true);

    ang = pickAngle();

    const thick = clamp(8 + 8*intensity, 8, 26);
    const op = clamp(0.55 + 0.20*intensity, 0.45, 0.95);

    if (pattern === 'x'){
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:0 });
      makeBeam({ angDeg: ang + 90, thickness: thick, opacity: op, warn:true, off:0 });
    } else if (pattern === 'doubleSweep'){
      // warn: 2 เส้นบาง ๆ ขนานกันเพื่อบอกว่ามา “ประกบ”
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:-24 });
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off: 24 });
    } else {
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:0 });
    }

    emit('hha:bossAtk', { name:'laser' });
    emit('hha:tick', { kind:'laser-warn', intensity });

    // warn duration: ยิ่งแรงยิ่งสั้น (กดดัน)
    const warnMs = clamp(820 - 140*clamp(adaptLevel, -1, 3) - 110*clamp(intensity-0.8,0,1), 520, 860);

    phase = 'warn';
    phaseEndsAt = now() + warnMs;

    // ถ้ามี PostFXCanvas ให้เข้มขึ้นนิด
    try{ if (PostFXCanvas && PostFXCanvas.setStorm) PostFXCanvas.setStorm(true); }catch{}
  }

  function startFire(ts){
    clearBeams();

    const thick = clamp(12 + 10*intensity, 10, 36);
    const op = clamp(0.82 + 0.20*intensity, 0.75, 1.0);

    if (pattern === 'x'){
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:false, off:0 });
      makeBeam({ angDeg: ang + 90, thickness: thick, opacity: op, warn:false, off:0 });
      phaseEndsAt = now() + 560;
    } else if (pattern === 'doubleSweep'){
      // DOUBLE SWEEP: 2 เส้นกวาด “สวนกัน” ให้เหมือนกำลังบีบพื้นที่
      const lvl = clamp(adaptLevel, -1, 3);
      const dur = clamp(820 - 120*lvl - 140*clamp((20-(secLeft||20))/20,0,1), 420, 900);

      // เส้นที่ 1: จากบนลงล่าง
      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off: -28,
        sweep: { t0: ts, dur, from: -30, to: 30 }
      });

      // เส้นที่ 2: จากล่างขึ้นบน (สวน)
      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off:  28,
        sweep: { t0: ts, dur, from:  30, to: -30 }
      });

      phaseEndsAt = now() + dur;
    } else {
      // SWEEP: 1 เส้นกวาด
      const lvl = clamp(adaptLevel, -1, 3);
      const dur = clamp(780 - 120*lvl - 140*clamp((20-(secLeft||20))/20,0,1), 420, 920);
      const dir = (Math.random()<0.5) ? -1 : 1;

      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off: dir * -24,
        sweep: { t0: ts, dur, from: dir * -28, to: dir * 28 }
      });

      phaseEndsAt = now() + dur;
    }

    emit('hha:tick', { kind:'laser-fire', intensity });

    phase = 'fire';
  }

  function endAtk(){
    clearBeams();
    setOn(false);
    phase = 'idle';
    phaseEndsAt = 0;
    scheduleNext();

    try{ if (PostFXCanvas && PostFXCanvas.setStorm) PostFXCanvas.setStorm(false); }catch{}
  }

  function stopAll(){
    running = false;
    clearBeams();
    setOn(false);
    nextAtkAt = 0;
    phase = 'idle';
    phaseEndsAt = 0;
    try{ if (PostFXCanvas && PostFXCanvas.setStorm) PostFXCanvas.setStorm(false); }catch{}
  }

  // -------------------------------
  // Hit check (during FIRE)
  // -------------------------------
  function checkHit(ts){
    if (phase !== 'fire') return;
    const p = getCrosshairXY();

    // beam center is viewport center (50%,50%)
    for (const b of beams){
      const theta = (b.angDeg * Math.PI) / 180;
      const d = distToBeam(p.x, p.y, theta, b.off);

      // threshold: slightly under half-thickness
      const thr = (b.th * 0.5) * 0.88;

      if (d <= thr){
        if (ts - lastHitAt > 520){
          lastHitAt = ts;
          emit('hha:bossHit', { type:'laser', pattern, intensity });
          // extra punch for FX layer
          emit('hha:fx', { type:'kick', intensity: 1.0 + 0.4*clamp(intensity,0,2), ms: 180 });
          // optional flash
          try{ if (PostFXCanvas && PostFXCanvas.flash) PostFXCanvas.flash('bad'); }catch{}
        }
        break;
      }
    }
  }

  // -------------------------------
  // Main loop
  // -------------------------------
  let raf = 0;
  function loop(ts){
    if (!running) return;

    if (secLeft != null && secLeft <= 0){
      stopAll();
      return;
    }

    const t = now();

    if (phase === 'idle'){
      if (!nextAtkAt) scheduleNext();
      if (t >= nextAtkAt) startWarn();
    } else if (phase === 'warn'){
      if (t + 140 >= phaseEndsAt){
        startFire(ts || now());
      } else {
        // warn tick เพิ่ม 1 ทีให้ “ติ๊กๆ”
        if (t >= (phaseEndsAt - 420) && t <= (phaseEndsAt - 360)){
          emit('hha:tick', { kind:'laser-warn', intensity: intensity*0.92 });
        }
      }
    } else if (phase === 'fire'){
      updateBeams(ts || now());
      checkHit(ts || now());
      if (t >= phaseEndsAt) endAtk();
    }

    raf = root.requestAnimationFrame(loop);
  }

  function start(){
    if (running) return;
    running = true;
    scheduleNext();
    raf = root.requestAnimationFrame(loop);
  }

  function stop(){
    try{ if (raf) root.cancelAnimationFrame(raf); }catch{}
    raf = 0;
    stopAll();
  }

  // -------------------------------
  // Event bindings
  // -------------------------------
  root.addEventListener('hha:time', (ev)=>{
    const s = Number(ev?.detail?.sec);
    if (!Number.isFinite(s)) return;
    secLeft = s;
    if (!running && s > 0) start();
  }, { passive:true });

  root.addEventListener('hha:adaptive', (ev)=>{
    const lvl = Number(ev?.detail?.level);
    if (!Number.isFinite(lvl)) return;
    adaptLevel = clamp(lvl, -1, 3);
  }, { passive:true });

  root.addEventListener('hha:stop', ()=> stop(), { passive:true });

  // Expose debug
  root.HHABossLaser = { start, stop, setLevel(lvl){ adaptLevel = clamp(lvl, -1, 3); } };

})(typeof window !== 'undefined' ? window : globalThis);