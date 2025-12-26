// === /herohealth/vr/hha-boss-laser.js ===
// Boss LASER overlay (X-LASER + SWEEP) — NO ENGINE CHANGES
// - listens: hha:time {sec}, hha:adaptive {level}, hha:stop
// - emits:   hha:bossAtk {name:'laser'}, hha:tick {kind:'laser-warn'|'laser-fire', intensity}
// - adaptive: adaptLevel สูง -> ถี่ขึ้น + หนาขึ้น + X-laser โผล่มากขึ้น

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, Number(v)||0));

  // --------------------------------
  // Inject CSS
  // --------------------------------
  function ensureStyle(){
    if (doc.getElementById('hha-boss-laser-style')) return;
    const s = doc.createElement('style');
    s.id = 'hha-boss-laser-style';
    s.textContent = `
#hhaBossLaser{
  position:fixed; inset:0;
  pointer-events:none;
  z-index:44; /* above targets(z=35), under HUD(80), under PACKD(70) */
  opacity:0;
  transition: opacity .10s ease;
}
#hhaBossLaser.on{ opacity:1; }
.hhaLaserBeam{
  position:absolute;
  left:50%; top:50%;
  transform: translate(-50%,-50%) rotate(var(--ang, 0deg));
  width: 220vmax;
  height: var(--th, 10px);
  border-radius: 999px;
  background: linear-gradient(90deg,
    rgba(255,80,96,0) 0%,
    rgba(255,80,96,.28) 22%,
    rgba(255,220,240,.85) 50%,
    rgba(255,80,96,.28) 78%,
    rgba(255,80,96,0) 100%);
  box-shadow:
    0 0 14px rgba(255,80,96,.32),
    0 0 34px rgba(255,80,96,.22),
    0 0 70px rgba(255,80,96,.12);
  filter: blur(.25px);
  opacity: var(--op, .0);
  will-change: transform, opacity;
}
.hhaLaserBeam.warn{
  background: linear-gradient(90deg,
    rgba(255,80,96,0) 0%,
    rgba(255,80,96,.12) 28%,
    rgba(255,220,240,.45) 50%,
    rgba(255,80,96,.12) 72%,
    rgba(255,80,96,0) 100%);
  box-shadow:
    0 0 10px rgba(255,80,96,.18),
    0 0 22px rgba(255,80,96,.12);
  filter: blur(.2px);
}
.hhaLaserBeam.sweep{
  animation: hhaLaserSweep var(--dur, 900ms) ease-in-out both;
}
@keyframes hhaLaserSweep{
  0%   { transform: translate(-50%,-50%) rotate(var(--ang,0deg)) translateY(var(--from, -22vmin)); }
  100% { transform: translate(-50%,-50%) rotate(var(--ang,0deg)) translateY(var(--to, 22vmin)); }
}
@media (prefers-reduced-motion: reduce){
  .hhaLaserBeam.sweep{ animation:none !important; }
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

  // --------------------------------
  // State
  // --------------------------------
  let secLeft = null;
  let running = false;
  let adaptLevel = 0;

  let nextAtkAt = 0;
  let phase = 'idle'; // 'warn'|'fire'
  let phaseEndsAt = 0;

  // current beams (DOM)
  let beams = [];

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
  }

  function clearBeams(){
    for (const b of beams) { try{ b.remove(); }catch{} }
    beams = [];
  }

  function setOn(on){
    if (on) layer.classList.add('on');
    else layer.classList.remove('on');
  }

  function makeBeam({ angDeg=0, thickness=10, opacity=1, warn=false, sweep=false, dur=900, from=-22, to=22 }){
    const b = doc.createElement('div');
    b.className = 'hhaLaserBeam' + (warn ? ' warn' : '') + (sweep ? ' sweep' : '');
    b.style.setProperty('--ang', angDeg.toFixed(2) + 'deg');
    b.style.setProperty('--th', thickness.toFixed(1) + 'px');
    b.style.setProperty('--op', String(opacity));
    if (sweep){
      b.style.setProperty('--dur', Math.round(dur) + 'ms');
      b.style.setProperty('--from', String(from) + 'vmin');
      b.style.setProperty('--to', String(to) + 'vmin');
    }
    layer.appendChild(b);
    beams.push(b);
    return b;
  }

  // --------------------------------
  // Attack pattern decision
  // --------------------------------
  function pickPattern(){
    // adaptLevel สูง -> X-laser บ่อยขึ้น
    const lvl = clamp(adaptLevel, -1, 3);

    // bias: lvl>=2 -> X เป็นหลัก, lvl 0-1 -> สลับ
    const r = Math.random();
    if (lvl >= 2) return (r < 0.70 ? 'x' : 'sweep');
    if (lvl >= 1) return (r < 0.45 ? 'x' : 'sweep');
    return (r < 0.25 ? 'x' : 'sweep');
  }

  function intensityFromContext(){
    // ยิ่งใกล้หมดเวลา ยิ่งแรง + adaptLevel เพิ่ม
    const t = (secLeft == null) ? 0.3 : clamp((30 - secLeft) / 30, 0, 1); // 0..1 ช่วงท้าย
    const lvl = clamp(adaptLevel, -1, 3);
    return clamp(0.55 + 0.18*lvl + 0.35*t, 0.35, 1.6);
  }

  function scheduleNext(){
    // ถี่ขึ้นตาม adaptLevel + ช่วงท้ายเกม
    const lvl = clamp(adaptLevel, -1, 3);
    const tail = (secLeft == null) ? 0 : clamp((20 - secLeft)/20, 0, 1);
    const base = 11.0 - (lvl * 1.6) - (tail * 3.0);
    const jitter = (Math.random()*1.6 - 0.8);
    const sec = clamp(base + jitter, 4.8, 14.0);
    nextAtkAt = now() + sec*1000;
  }

  // --------------------------------
  // Attack execution
  // --------------------------------
  let curPattern = 'sweep';
  let curAng = 0;

  function startWarn(){
    curPattern = pickPattern();
    const I = intensityFromContext();

    clearBeams();
    setOn(true);

    // angle pick: ไม่ให้ใกล้แนวนอน/แนวตั้งเกินไปเสมอ เพื่อดูโหด
    curAng = (Math.random()*140 - 70);
    if (Math.abs(curAng) < 12) curAng += (curAng < 0 ? -12 : 12);

    const thick = clamp(8 + 8*I, 8, 26);
    const op = clamp(0.55 + 0.20*I, 0.45, 0.95);

    // warn beams
    if (curPattern === 'x'){
      makeBeam({ angDeg: curAng, thickness: thick, opacity: op, warn:true });
      makeBeam({ angDeg: curAng + 90, thickness: thick, opacity: op, warn:true });
    } else {
      makeBeam({ angDeg: curAng, thickness: thick, opacity: op, warn:true });
    }

    emit('hha:bossAtk', { name:'laser' });
    emit('hha:tick', { kind:'laser-warn', intensity: I });

    phase = 'warn';
    phaseEndsAt = now() + 700; // warn 0.7s
  }

  function startFire(){
    const I = intensityFromContext();

    // เปลี่ยนเป็น “ยิงจริง”
    clearBeams();

    const thick = clamp(12 + 10*I, 10, 34);
    const op = clamp(0.80 + 0.20*I, 0.75, 1.0);

    if (curPattern === 'x'){
      // X-LASER: 2 เส้นตัดกัน + กระพริบเบาๆ
      makeBeam({ angDeg: curAng, thickness: thick, opacity: op, warn:false });
      makeBeam({ angDeg: curAng + 90, thickness: thick, opacity: op, warn:false });
      // ยิงค้างสั้นๆ
      phaseEndsAt = now() + 520;
    } else {
      // SWEEP: ไล่กวาดขึ้น/ลง (สุ่มทิศ)
      const dur = clamp(760 - 120*clamp(adaptLevel, -1, 3) - 140*clamp((20-secLeft)/20,0,1), 420, 920);
      const dir = (Math.random()<0.5) ? -1 : 1;
      makeBeam({
        angDeg: curAng,
        thickness: thick,
        opacity: op,
        warn:false,
        sweep:true,
        dur,
        from: dir * -24,
        to: dir * 24
      });
      phaseEndsAt = now() + dur;
    }

    emit('hha:tick', { kind:'laser-fire', intensity: I });

    phase = 'fire';
  }

  function endAtk(){
    clearBeams();
    setOn(false);
    phase = 'idle';
    phaseEndsAt = 0;
    scheduleNext();
  }

  // --------------------------------
  // Main loop
  // --------------------------------
  let raf = 0;
  function loop(){
    if (!running) return;

    const t = now();

    // ถ้ายังไม่ถึงเวลา หรือเกมจบแล้ว
    if (secLeft != null && secLeft <= 0){
      running = false;
      clearBeams();
      setOn(false);
      return;
    }

    if (phase === 'idle'){
      if (!nextAtkAt) scheduleNext();
      if (t >= nextAtkAt) startWarn();
    } else if (phase === 'warn'){
      // ระหว่าง warn เราส่ง tick เพิ่มอีกนิดให้ “ติ๊กๆ” ดูมีแรงกดดัน
      if (t + 150 >= phaseEndsAt) {
        startFire();
      } else {
        // ส่ง tick ซ้ำเป็นจังหวะ (เบาๆ) — ไม่ถี่เกิน
        // (ปลอดภัย: ส่งแค่ 1 ครั้งกลางทาง)
        if (t >= (phaseEndsAt - 420) && t <= (phaseEndsAt - 360)){
          emit('hha:tick', { kind:'laser-warn', intensity: intensityFromContext()*0.9 });
        }
      }
    } else if (phase === 'fire'){
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
    running = false;
    try{ if (raf) root.cancelAnimationFrame(raf); }catch{}
    raf = 0;
    clearBeams();
    setOn(false);
    nextAtkAt = 0;
    phase = 'idle';
  }

  // --------------------------------
  // Event bindings
  // --------------------------------
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

  // Expose for debug
  root.HHABossLaser = {
    start, stop,
    setLevel(lvl){ adaptLevel = clamp(lvl, -1, 3); },
  };

})(typeof window !== 'undefined' ? window : globalThis);