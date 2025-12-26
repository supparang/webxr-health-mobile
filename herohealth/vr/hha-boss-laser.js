// === /herohealth/vr/hha-boss-laser.js ===
// Boss LASER overlay V4 — NO ENGINE CHANGES
// + Safe Gap Marker (shows safest spot), now visible in WARN + moves in FIRE
// + Fake Gap (decoy) for adaptLevel >= 3 (short + fair reveal)
// + Charge + Fire sounds (WebAudio, auto unlock)
// patterns: X / SWEEP / DOUBLE SWEEP
// emits:
//  - hha:bossAtk {name:'laser'}
//  - hha:tick {kind:'laser-warn'|'laser-fire', intensity}
//  - hha:bossHit {type:'laser', pattern, intensity}
//  - hha:fx {type:'kick', intensity, ms} (extra punch on hit)

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

/* --- SAFE GAP (real) --- */
#hhaBossLaserGap{
  position:absolute;
  left: 50%;
  top: 52%;
  transform: translate(-50%,-50%);
  width: 26px;
  height: 26px;
  border-radius: 999px;
  opacity: 0;
  transition: opacity .10s ease, transform .08s ease;
  background: radial-gradient(circle at 30% 25%,
    rgba(80,230,255,.92),
    rgba(80,230,255,.20) 55%,
    rgba(80,230,255,0) 75%);
  box-shadow:
    0 0 0 2px rgba(80,230,255,.55),
    0 0 22px rgba(80,230,255,.32),
    0 0 46px rgba(80,230,255,.16);
  mix-blend-mode: screen;
}
#hhaBossLaserGap.on{ opacity: 1; }
#hhaBossLaserGap::after{
  content:'SAFE';
  position:absolute;
  left:50%;
  top: 120%;
  transform: translateX(-50%);
  font: 950 10px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
  letter-spacing: .3px;
  color: rgba(200,250,255,.95);
  text-shadow: 0 8px 22px rgba(0,0,0,.55);
  opacity: .95;
}

/* --- FAKE GAP (decoy) --- */
#hhaBossLaserDecoy{
  position:absolute;
  left: 50%;
  top: 52%;
  transform: translate(-50%,-50%);
  width: 24px;
  height: 24px;
  border-radius: 999px;
  opacity: 0;
  transition: opacity .10s ease, transform .08s ease;
  background: radial-gradient(circle at 30% 25%,
    rgba(167,139,250,.92),
    rgba(167,139,250,.20) 55%,
    rgba(167,139,250,0) 75%);
  box-shadow:
    0 0 0 2px rgba(167,139,250,.55),
    0 0 22px rgba(167,139,250,.28),
    0 0 46px rgba(167,139,250,.14);
  mix-blend-mode: screen;
}
#hhaBossLaserDecoy.on{ opacity: 1; }
#hhaBossLaserDecoy::after{
  content:'SAFE?';
  position:absolute;
  left:50%;
  top: 120%;
  transform: translateX(-50%);
  font: 950 10px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
  letter-spacing: .3px;
  color: rgba(235,225,255,.95);
  text-shadow: 0 8px 22px rgba(0,0,0,.55);
  opacity: .95;
}

@media (prefers-reduced-motion: reduce){
  .hhaLaserBeam{ filter:none !important; }
  #hhaBossLaserGap, #hhaBossLaserDecoy{ transition:none !important; }
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

    const gap = doc.createElement('div');
    gap.id = 'hhaBossLaserGap';

    const decoy = doc.createElement('div');
    decoy.id = 'hhaBossLaserDecoy';

    el.appendChild(gap);
    el.appendChild(decoy);
    doc.body.appendChild(el);
    return el;
  }

  const layer = ensureLayer();
  const gapEl = doc.getElementById('hhaBossLaserGap');
  const decoyEl = doc.getElementById('hhaBossLaserDecoy');

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
    return { x: (root.innerWidth||1)*0.5, y: (root.innerHeight||1)*0.52 };
  }

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
  // WebAudio (charge/fire)
  // -------------------------------
  let AC = null, audioUnlocked = false;
  function ensureAudio(){
    if (AC) return AC;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    AC = new Ctx();
    return AC;
  }
  function unlockAudio(){
    if (audioUnlocked) return;
    const ac = ensureAudio();
    if (!ac) { audioUnlocked = true; return; }
    if (ac.state === 'suspended') ac.resume().catch(()=>{});
    try{
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.0001;
      o.frequency.value = 220;
      o.connect(g); g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.02);
    }catch(_){}
    audioUnlocked = true;
  }
  const unlockOnce = ()=>{ unlockAudio(); root.removeEventListener('pointerdown', unlockOnce); root.removeEventListener('touchstart', unlockOnce); };
  root.addEventListener('pointerdown', unlockOnce, { passive:true });
  root.addEventListener('touchstart', unlockOnce, { passive:true });

  function beep(freq=880, durMs=50, vol=0.06, type='sine'){
    const ac = ensureAudio();
    if (!ac) return;
    try{
      const t0 = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(clamp(vol,0.001,0.2), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
      o.connect(g); g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + (durMs/1000) + 0.02);
    }catch(_){}
  }

  function chargeSound(intensity=1){
    const k = clamp(intensity, 0.4, 2.0);
    const f1 = 420 + 80*k;
    const f2 = 520 + 110*k;
    const f3 = 640 + 140*k;
    beep(f1, 70, 0.045 + 0.01*k, 'triangle');
    setTimeout(()=>beep(f2, 70, 0.050 + 0.01*k, 'triangle'), 90);
    setTimeout(()=>beep(f3, 85, 0.055 + 0.015*k, 'triangle'), 180);
  }
  function fireSound(intensity=1){
    const k = clamp(intensity, 0.4, 2.2);
    beep(980 + 120*k, 90, 0.070 + 0.02*k, 'sawtooth');
    setTimeout(()=>beep(720 + 80*k, 70, 0.055 + 0.01*k, 'sine'), 80);
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
  // Safe gap + decoy logic
  // -------------------------------
  function setGap(on){ if (!gapEl) return; if (on) gapEl.classList.add('on'); else gapEl.classList.remove('on'); }
  function setDecoy(on){ if (!decoyEl) return; if (on) decoyEl.classList.add('on'); else decoyEl.classList.remove('on'); }

  function placeMarker(el, x, y){
    if (!el) return;
    el.style.left = x.toFixed(0) + 'px';
    el.style.top  = y.toFixed(0) + 'px';
    el.style.transform = 'translate(-50%,-50%) scale(1.0)';
    setTimeout(()=>{ try{ el.style.transform='translate(-50%,-50%) scale(1.06)'; }catch{} }, 30);
    setTimeout(()=>{ try{ el.style.transform='translate(-50%,-50%) scale(1.0)'; }catch{} }, 140);
  }

  function scorePoint(px, py){
    // score = min clearance from any beam body (bigger is safer)
    let best = 1e9;
    for (const b of beams){
      const th = Math.max(1, b.th);
      const theta = (b.angDeg * Math.PI) / 180;
      const d = distToBeam(px, py, theta, b.off);
      const clearance = d - (th * 0.5);
      best = Math.min(best, clearance);
    }
    return best;
  }

  function pickCandidates(){
    const w = Math.max(1, root.innerWidth || 1);
    const h = Math.max(1, root.innerHeight|| 1);
    const padX = w * 0.10;
    const padY = h * 0.14;

    const xs = [padX, w*0.33, w*0.50, w*0.67, w-padX];
    const ys = [padY, h*0.30, h*0.52, h*0.70, h-padY];

    const pts = [];
    for (let yi=0; yi<ys.length; yi++){
      for (let xi=0; xi<xs.length; xi++){
        pts.push({ x: xs[xi], y: ys[yi] });
      }
    }
    return pts;
  }

  function findBestSafePoint(){
    const pts = pickCandidates();
    const ch = getCrosshairXY();
    const minToCh = 80;

    let bestP = null, bestS = -1e9;
    for (const p of pts){
      const dx = p.x - ch.x, dy = p.y - ch.y;
      const dd = Math.sqrt(dx*dx + dy*dy);
      if (dd < minToCh) continue;
      const s = scorePoint(p.x, p.y);
      if (s > bestS) { bestS = s; bestP = p; }
    }
    if (!bestP){
      for (const p of pts){
        const s = scorePoint(p.x, p.y);
        if (s > bestS) { bestS = s; bestP = p; }
      }
    }
    return { p: bestP, s: bestS, ch };
  }

  function findDecoyPoint(best){
    // Decoy: "ดูน่าเชื่อ" แต่ไม่ดีที่สุด
    // เลือก point ที่ safety ต่ำกว่าของจริง แต่ไม่ติดเลเซอร์ทันที (clearance > -2)
    const pts = pickCandidates();
    const targetS = best.s - 18; // ต่ำกว่าจริงพอให้พลาด
    let pick = null, pickS = -1e9;

    for (const p of pts){
      const s = scorePoint(p.x, p.y);
      if (s <= -6) continue;              // อย่าเอาจุดที่โดนแน่ ๆ
      if (s >= best.s - 6) continue;      // อย่าใกล้ของจริงเกิน
      const closeness = -Math.abs(s - targetS);
      if (closeness > pickS){ pickS = closeness; pick = p; }
    }

    // fallback: เอาจุดที่แย่ที่สุดแต่ยัง "ไม่โดนทันที"
    if (!pick){
      let worst = null, worstS = 1e9;
      for (const p of pts){
        const s = scorePoint(p.x, p.y);
        if (s <= -6) continue;
        if (s < worstS){ worstS = s; worst = p; }
      }
      pick = worst;
    }
    return pick;
  }

  function updateGapMarkers(ts){
    if (beams.length === 0) { setGap(false); setDecoy(false); return; }

    const best = findBestSafePoint();
    const chS = scorePoint(best.ch.x, best.ch.y);

    // show real marker only if better than current by margin
    const showReal = !!(best.p && best.s > chS + 12);

    // decoy rules: only in FIRE, only when adaptLevel>=3, only if chosen for this attack
    if (phase === 'fire' && decoyActive && showReal && best.p){
      // show decoy first, then reveal real (fair)
      const tInto = (ts - fireStartedAt);
      const revealAt = decoyRevealMs; // when real becomes visible
      const hideDecoyAt = decoyHideMs;

      // decoy marker moves too (so "น่าเชื่อ")
      const decoyP = decoyPoint || findDecoyPoint(best);
      decoyPoint = decoyP || decoyPoint;

      if (tInto < hideDecoyAt && decoyPoint){
        setDecoy(true);
        placeMarker(decoyEl, decoyPoint.x, decoyPoint.y);
      } else {
        setDecoy(false);
      }

      if (tInto >= revealAt){
        setGap(true);
        placeMarker(gapEl, best.p.x, best.p.y);
      } else {
        // still hide real before reveal
        setGap(false);
      }
      return;
    }

    // normal: show real in WARN+FIRE (no decoy)
    setDecoy(false);
    if (showReal && best.p){
      setGap(true);
      placeMarker(gapEl, best.p.x, best.p.y);
    } else {
      setGap(false);
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

  // decoy per-attack
  let decoyActive = false;
  let decoyPoint = null;
  let fireStartedAt = 0;
  let decoyRevealMs = 220; // show real after this
  let decoyHideMs = 520;   // hide decoy by this (still fair)

  // hit cooldown
  let lastHitAt = 0;

  function intensityFromContext(){
    const t = (secLeft == null) ? 0.3 : clamp((30 - secLeft) / 30, 0, 1);
    const lvl = clamp(adaptLevel, -1, 3);
    return clamp(0.55 + 0.18*lvl + 0.35*t, 0.35, 1.8);
  }

  function scheduleNext(){
    const lvl = clamp(adaptLevel, -1, 3);
    const tail = (secLeft == null) ? 0 : clamp((20 - secLeft)/20, 0, 1);
    const base = 10.6 - (lvl * 1.55) - (tail * 3.2);
    const jitter = (Math.random()*1.6 - 0.8);
    const sec = clamp(base + jitter, 4.4, 13.8);
    nextAtkAt = now() + sec*1000;
  }

  function pickPattern(){
    const lvl = clamp(adaptLevel, -1, 3);
    const r = Math.random();
    if (lvl >= 3){
      if (r < 0.40) return 'doubleSweep';
      if (r < 0.72) return 'x';
      return 'sweep';
    }
    if (lvl >= 2) return (r < 0.70 ? 'x' : 'sweep');
    if (lvl >= 1) return (r < 0.48 ? 'x' : 'sweep');
    return (r < 0.28 ? 'x' : 'sweep');
  }

  function pickAngle(){
    let a = (Math.random()*140 - 70);
    if (Math.abs(a) < 12) a += (a < 0 ? -12 : 12);
    return a;
  }

  function decideDecoy(){
    // only for adaptLevel >=3, only sometimes, and always fair reveal
    if (adaptLevel < 3) return false;
    // later in game => more likely
    const tail = (secLeft == null) ? 0.3 : clamp((20 - secLeft)/20, 0, 1);
    const p = clamp(0.28 + 0.22*tail, 0.22, 0.55);
    return (Math.random() < p);
  }

  function startWarn(){
    pattern = pickPattern();
    intensity = intensityFromContext();

    clearBeams();
    setGap(false);
    setDecoy(false);
    decoyPoint = null;

    setOn(true);

    ang = pickAngle();

    const thick = clamp(8 + 7.5*intensity, 8, 24);
    const op = clamp(0.55 + 0.18*intensity, 0.45, 0.92);

    if (pattern === 'x'){
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:0 });
      makeBeam({ angDeg: ang + 90, thickness: thick, opacity: op, warn:true, off:0 });
    } else if (pattern === 'doubleSweep'){
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:-24 });
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off: 24 });
    } else {
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:true, off:0 });
    }

    // show SAFE marker already in WARN (help player plan)
    updateGapMarkers(now());

    emit('hha:bossAtk', { name:'laser' });
    emit('hha:tick', { kind:'laser-warn', intensity });

    // sound: charge
    chargeSound(intensity);

    // warn duration: ยิ่งท้ายเกม/ยิ่งแรง ยิ่งสั้น
    const warnMs = clamp(820 - 140*clamp(adaptLevel, -1, 3) - 120*clamp(intensity-0.8,0,1), 520, 860);

    phase = 'warn';
    phaseEndsAt = now() + warnMs;

    try{ if (PostFXCanvas && PostFXCanvas.setStorm) PostFXCanvas.setStorm(true); }catch{}
  }

  function startFire(ts){
    clearBeams();

    const thick = clamp(12 + 10*intensity, 10, 36);
    const op = clamp(0.82 + 0.18*intensity, 0.74, 1.0);

    // per-attack decoy decision (only in FIRE)
    decoyActive = decideDecoy();
    decoyPoint = null;

    // tune decoy timings by intensity (stronger => shorter fake window)
    const k = clamp(intensity, 0.4, 2.0);
    decoyRevealMs = clamp(240 - 40*(k-0.9), 140, 240); // real appears sooner when intense
    decoyHideMs   = clamp(560 - 70*(k-0.9), 320, 560); // decoy gone soon

    fireStartedAt = ts || now();

    // sound: fire
    fireSound(intensity);

    if (pattern === 'x'){
      makeBeam({ angDeg: ang, thickness: thick, opacity: op, warn:false, off:0 });
      makeBeam({ angDeg: ang + 90, thickness: thick, opacity: op, warn:false, off:0 });
      phaseEndsAt = now() + clamp(520 - 40*clamp(adaptLevel,0,3), 420, 560);
    } else if (pattern === 'doubleSweep'){
      const lvl = clamp(adaptLevel, -1, 3);
      const dur = clamp(820 - 120*lvl - 160*clamp((20-(secLeft||20))/20,0,1), 420, 900);

      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off: -28,
        sweep: { t0: fireStartedAt, dur, from: -30, to: 30 }
      });
      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off:  28,
        sweep: { t0: fireStartedAt, dur, from:  30, to: -30 }
      });

      phaseEndsAt = now() + dur;
    } else {
      const lvl = clamp(adaptLevel, -1, 3);
      const dur = clamp(780 - 120*lvl - 160*clamp((20-(secLeft||20))/20,0,1), 420, 920);
      const dir = (Math.random()<0.5) ? -1 : 1;

      makeBeam({
        angDeg: ang, thickness: thick, opacity: op, warn:false,
        off: dir * -24,
        sweep: { t0: fireStartedAt, dur, from: dir * -28, to: dir * 28 }
      });

      phaseEndsAt = now() + dur;
    }

    emit('hha:tick', { kind:'laser-fire', intensity });

    phase = 'fire';

    // markers immediately
    updateGapMarkers(fireStartedAt);
  }

  function endAtk(){
    clearBeams();
    setGap(false);
    setDecoy(false);
    setOn(false);
    phase = 'idle';
    phaseEndsAt = 0;
    scheduleNext();
    try{ if (PostFXCanvas && PostFXCanvas.setStorm) PostFXCanvas.setStorm(false); }catch{}
  }

  function stopAll(){
    running = false;
    clearBeams();
    setGap(false);
    setDecoy(false);
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

    for (const b of beams){
      const theta = (b.angDeg * Math.PI) / 180;
      const d = distToBeam(p.x, p.y, theta, b.off);

      const thr = (b.th * 0.5) * 0.88;
      if (d <= thr){
        if (ts - lastHitAt > 520){
          lastHitAt = ts;
          emit('hha:bossHit', { type:'laser', pattern, intensity });
          emit('hha:fx', { type:'kick', intensity: 1.0 + 0.4*clamp(intensity,0,2), ms: 180 });
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
  let lastGapTs = 0;

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
      // update marker in warn too (a bit slower)
      if (!lastGapTs || (ts - lastGapTs) > 120){
        lastGapTs = ts;
        updateGapMarkers(ts || now());
      }

      // extra tick near fire
      if (t >= (phaseEndsAt - 360) && t <= (phaseEndsAt - 300)){
        emit('hha:tick', { kind:'laser-warn', intensity: intensity*0.92 });
      }
      if (t + 140 >= phaseEndsAt){
        startFire(ts || now());
      }
    } else if (phase === 'fire'){
      updateBeams(ts || now());
      checkHit(ts || now());

      // marker updates ~12fps (moves with sweep)
      if (!lastGapTs || (ts - lastGapTs) > 80){
        lastGapTs = ts;
        updateGapMarkers(ts || now());
      }

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

  // debug
  root.HHABossLaser = {
    start, stop,
    setLevel(lvl){ adaptLevel = clamp(lvl, -1, 3); },
    forceDecoy(on){ decoyActive = !!on; }
  };

})(typeof window !== 'undefined' ? window : globalThis);