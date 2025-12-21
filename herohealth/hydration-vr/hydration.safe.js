// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION
//
// ✅ Bubble “ฟองสบู่จริง”: ใสเกือบไม่เห็น แต่ขอบสวย + thin-film iridescence ชัดขึ้น
// ✅ Reactive shimmer + device-tilt shimmer
// ✅ Targets “ลอย/ส่าย” (wiggle) และ Storm ทำให้ส่ายแรง/เร็วขึ้น + speedlines หนักขึ้น
// ✅ PERFECT: ring bonus + ดาวแตกหนัก ๆ + chroma flash + sound sparkle
// ✅ คืน FX: score pop + judgment + burst (Particles)
// ✅ Drag view: เลื่อนจอแล้วเป้าเลื่อนตาม (เลื่อน #hvr-spawnlayer) + clamp safe zone ไม่ทับ HUD
// ✅ Fix zone counting: ui-water LOW/GREEN/HIGH → map BLUE/GREEN/RED

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (typeof performance!=='undefined' && performance.now)?performance.now():Date.now(); }
function $id(id){ return DOC ? DOC.getElementById(id) : null; }

function setText(id, txt){
  const el = $id(id);
  if (el) el.textContent = String(txt);
}
function addClass(el, c){ try{ el && el.classList.add(c); }catch{} }
function removeClass(el, c){ try{ el && el.classList.remove(c); }catch{} }

function zoneLabelFrom(zone){
  if (zone === 'LOW') return 'BLUE';
  if (zone === 'HIGH') return 'RED';
  return 'GREEN';
}

function gradeFrom(score){
  if (score >= 2600) return 'SSS';
  if (score >= 2000) return 'SS';
  if (score >= 1500) return 'S';
  if (score >= 1100) return 'A';
  if (score >= 700)  return 'B';
  return 'C';
}

// ------------------------------------------------------
//  Styles: bubble skin + shimmer + storm wobble + speedlines
// ------------------------------------------------------
function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    /* vars */
    #hvr-wrap{
      --storm: 0;
      --chroma: 0;
      --wob: 0;
    }
    #hvr-playfield{
      --tilt-x: 0;
      --tilt-y: 0;
      --view-x: 0px;
      --view-y: 0px;
    }
    #hvr-spawnlayer{
      transform: translate3d(var(--view-x), var(--view-y), 0);
    }

    /* stronger chromatic split (แดงชัด) */
    #hvr-wrap.hvr-chroma{
      filter:
        drop-shadow(calc(3px + var(--chroma) * 2px) 0 rgba(255, 30, 70, 0.70))
        drop-shadow(calc(-2px - var(--chroma) * 1px) 0 rgba(0, 200, 255, 0.26))
        saturate(calc(1.06 + var(--chroma) * 0.10))
        contrast(calc(1.03 + var(--chroma) * 0.08));
    }

    /* continuous wobble (เบา ๆ แต่รู้สึก) */
    #hvr-wrap.hvr-wobble{
      animation: hvrWobble 1.05s ease-in-out infinite;
    }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(calc(0.7px + var(--wob) * 0.9px), calc(-0.4px - var(--wob) * 0.6px), 0) rotate(calc(0.03deg + var(--wob) * 0.03deg)); }
      50%{ transform: translate3d(calc(-0.8px - var(--wob) * 0.9px), calc(0.6px + var(--wob) * 0.7px), 0) rotate(calc(-0.03deg - var(--wob) * 0.03deg)); }
      75%{ transform: translate3d(calc(0.5px + var(--wob) * 0.7px), calc(0.7px + var(--wob) * 0.7px), 0) rotate(calc(0.02deg + var(--wob) * 0.03deg)); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* storm speedlines overlay (global) */
    .hvr-speedlines{
      position:fixed;
      inset:-20%;
      pointer-events:none;
      z-index:99960;
      opacity:0;
      transform: translate3d(0,0,0);
      mix-blend-mode: screen;
      background:
        repeating-linear-gradient(110deg,
          rgba(255,255,255,.00) 0 16px,
          rgba(255,80,120,.13) 16px 18px,
          rgba(0,190,255,.11) 18px 20px,
          rgba(255,255,255,.00) 20px 40px
        );
      filter: blur(0.55px) saturate(1.12) contrast(1.08);
      animation: hvrLines 0.26s linear infinite;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-12px, -12px, 0); }
      100%{ transform: translate3d(32px, 26px, 0); }
    }
    .hvr-speedlines.on{ opacity:0.16; } /* will be boosted by JS via style */

    /* shimmer pulse (reactive) */
    #hvr-playfield.hvr-shimmer{
      animation: hvrShimmerPulse 260ms ease-out 1;
    }
    @keyframes hvrShimmerPulse{
      0%{ filter: none; }
      55%{ filter: saturate(1.22) contrast(1.10) brightness(1.03); }
      100%{ filter: none; }
    }

    /* perfect pulse */
    #hvr-wrap.hvr-perfect-pulse{
      animation: hvrPerfectPulse 180ms ease-out 1;
    }
    @keyframes hvrPerfectPulse{
      0%{ filter: saturate(1) contrast(1); }
      45%{ filter: saturate(1.30) contrast(1.14) brightness(1.02); }
      100%{ filter: saturate(1) contrast(1); }
    }

    /* ---------- bubble skin ---------- */
    .hvr-target{
      border-radius:999px;
    }

    .hvr-target[data-skin="bubble"]{
      background: transparent !important;
      box-shadow: none !important;
      border: 1px solid rgba(255,255,255,0.10);
      outline: 1px solid rgba(255,255,255,0.04);
      overflow: visible;
      contain: paint;
    }

    /* bubble body (almost invisible) */
    .hvr-target[data-skin="bubble"]::before{
      content:"";
      position:absolute;
      inset:-2px;
      border-radius:999px;
      background:
        radial-gradient(circle at 32% 28%, rgba(255,255,255,0.30), rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.00) 55%),
        radial-gradient(circle at 70% 72%, rgba(120,180,255,0.09), rgba(255,255,255,0.00) 58%);
      opacity: 0.45;
      filter: blur(0.2px);
      pointer-events:none;
    }

    /* thin-film iridescence rim (รุ้งชัด แต่บาง) */
    .hvr-target[data-skin="bubble"]::after{
      content:"";
      position:absolute;
      inset:-6px;
      border-radius:999px;
      background:
        conic-gradient(from 220deg,
          rgba(255,0,80,0.00),
          rgba(255,0,80,0.38),
          rgba(255,190,0,0.34),
          rgba(0,255,140,0.30),
          rgba(0,190,255,0.34),
          rgba(180,80,255,0.34),
          rgba(255,0,80,0.38),
          rgba(255,0,80,0.00)
        );
      opacity: 0.30;
      filter: saturate(1.35) contrast(1.10);
      mix-blend-mode: screen;
      pointer-events:none;
      transform: translate3d(calc(var(--tilt-x) * 8px), calc(var(--tilt-y) * -7px), 0);
      will-change: transform, opacity;
    }

    /* bubble inner ring (perfect hint) – refined */
    .hvr-target[data-skin="bubble"] .hvr-wiggle > .hvr-ring{
      border: 2px solid rgba(255,255,255,0.20) !important;
      box-shadow: 0 0 14px rgba(255,255,255,0.12) !important;
    }

    /* wiggle motion: float/sway (stronger in storm via vars) */
    .hvr-target[data-skin="bubble"] .hvr-wiggle{
      animation:
        hvrFloat calc(2.25s - var(--storm) * 0.55s) ease-in-out infinite,
        hvrSway  calc(1.55s - var(--storm) * 0.40s) ease-in-out infinite;
      transform: translate3d(0,0,0);
    }
    @keyframes hvrFloat{
      0%{ transform: translate3d(0,0,0) scale(1); }
      50%{ transform: translate3d(0, calc(-5px - var(--storm) * 7px), 0) scale(1.01); }
      100%{ transform: translate3d(0,0,0) scale(1); }
    }
    @keyframes hvrSway{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(calc(3px + var(--storm) * 7px), calc(-1px - var(--storm) * 2px), 0) rotate(calc(0.8deg + var(--storm) * 1.3deg)); }
      50%{ transform: translate3d(0,0,0) rotate(0deg); }
      75%{ transform: translate3d(calc(-3px - var(--storm) * 7px), calc(1px + var(--storm) * 2px), 0) rotate(calc(-0.8deg - var(--storm) * 1.3deg)); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* per-target wind lines (only storm) */
    .hvr-target[data-skin="bubble"] .hvr-wind{
      position:absolute;
      inset:-14px;
      border-radius:999px;
      opacity:0;
      pointer-events:none;
      mix-blend-mode: screen;
      background:
        repeating-linear-gradient(125deg,
          rgba(255,255,255,0.00) 0 10px,
          rgba(255,80,120,0.11) 10px 12px,
          rgba(0,190,255,0.10) 12px 14px,
          rgba(255,255,255,0.00) 14px 26px
        );
      filter: blur(0.55px) saturate(1.10);
      animation: hvrWind 0.32s linear infinite;
    }
    @keyframes hvrWind{
      0%{ transform: translate3d(-10px,-10px,0); }
      100%{ transform: translate3d(22px,18px,0); }
    }
    .hvr-storm-on .hvr-target[data-skin="bubble"] .hvr-wind{
      opacity: calc(0.08 + var(--storm) * 0.14);
    }

    /* junk still readable */
    .hvr-target[data-item-type="bad"]{
      filter: saturate(1.05) contrast(1.05);
    }
  `;
  DOC.head.appendChild(s);
}

// ------------------------------------------------------
//  PostFX canvas (stars / shimmer spark)
// ------------------------------------------------------
function ensurePostFXCanvas(){
  const c = $id('hvr-postfx');
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  function resize(){
    const dpr = Math.max(1, Math.min(2, ROOT.devicePixelRatio || 1));
    c.width  = Math.floor((ROOT.innerWidth||1) * dpr);
    c.height = Math.floor((ROOT.innerHeight||1) * dpr);
    c.style.width = '100%';
    c.style.height = '100%';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  ROOT.addEventListener('resize', resize, { passive:true });
  return { c, ctx, resize };
}

function drawStarBurst(ctx, x, y, t, strength=1){
  const n = Math.floor(20 + 22*strength);
  const r0 = 6 + 10*strength;
  const r1 = 46 + 86*strength;

  ctx.save();
  ctx.translate(x,y);
  ctx.globalCompositeOperation = 'screen';

  // rays (two chroma layers)
  for (let i=0;i<n;i++){
    const a = (i/n) * Math.PI*2 + (t*0.002);
    const rr = r0 + (r1-r0) * (0.25 + 0.75*Math.random());
    const w = 1.15 + 2.6*strength;

    ctx.strokeStyle = `rgba(255, 60, 120, ${0.12 + 0.13*strength})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    ctx.stroke();

    const a2 = a + 0.20;
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.10 + 0.12*strength})`;
    ctx.lineWidth = w*0.86;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a2)*r0, Math.sin(a2)*r0);
    ctx.lineTo(Math.cos(a2)*rr*0.94, Math.sin(a2)*rr*0.94);
    ctx.stroke();
  }

  // sparkle dots
  for (let k=0;k<18;k++){
    const a = Math.random()*Math.PI*2;
    const rr = 10 + Math.random()*(74*strength);
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.22*Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.1 + 2.4*Math.random(), 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

// ------------------------------------------------------
//  Tiny audio (sparkle/pop)
// ------------------------------------------------------
let _ac = null;
function ensureAudio(){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    if (!_ac) _ac = new AC();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }catch{ return null; }
}
function playSparkle(str=1){
  const ac = ensureAudio(); if (!ac) return;
  const t0 = ac.currentTime + 0.002;

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12*str, t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+0.18);

  const o1 = ac.createOscillator();
  o1.type = 'triangle';
  o1.frequency.setValueAtTime(880, t0);
  o1.frequency.exponentialRampToValueAtTime(1600, t0+0.08);

  const o2 = ac.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(1320, t0);
  o2.frequency.exponentialRampToValueAtTime(2200, t0+0.06);

  o1.connect(g); o2.connect(g);
  g.connect(ac.destination);

  o1.start(t0); o2.start(t0);
  o1.stop(t0+0.20); o2.stop(t0+0.20);
}
function playPop(str=1){
  const ac = ensureAudio(); if (!ac) return;
  const t0 = ac.currentTime + 0.001;

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.10*str, t0+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+0.08);

  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(260, t0);
  o.frequency.exponentialRampToValueAtTime(90, t0+0.06);

  o.connect(g);
  g.connect(ac.destination);

  o.start(t0);
  o.stop(t0+0.09);
}

// ------------------------------------------------------
//  boot()
// ------------------------------------------------------
export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  const spawnLayer = $id('hvr-spawnlayer');
  const blink = $id('hvr-screen-blink');

  // storm global speedlines overlay
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  const post = ensurePostFXCanvas();

  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  // pools
  const GOOD = ['💧','🧊','🫧'];         // โฟมน้ำ/น้ำแข็ง/ฟอง
  const BAD  = ['🍟','🍩','🍕','🥤'];    // junk
  const POWER = ['⭐','⚡','✨'];

  const s = {
    running: true,
    startedAt: now(),

    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    water: 50,
    zone: 'GREEN',
    zoneLabel: 'GREEN',

    greenTick: 0,
    timeLeft: duration,

    // view offset (applies to spawnLayer)
    viewX: 0,
    viewY: 0,

    stormOn: false,
    stormUntil: 0,
    stormStrength: 0,

    tiltX: 0,
    tiltY: 0,

    sparks: [] // postFX bursts
  };

  function hud(){
    setText('hha-score-main', s.score|0);
    setText('hha-combo-max', s.comboMax|0);
    setText('hha-miss', s.miss|0);

    const g = gradeFrom(s.score);
    const badge = $id('hha-grade-badge');
    if (badge) badge.textContent = g;

    const fill = $id('hha-grade-progress-fill');
    const t = $id('hha-grade-progress-text');
    const pct = clamp((s.score / 1500) * 100, 0, 100);
    if (fill) fill.style.width = pct.toFixed(0) + '%';
    if (t) t.textContent = `Progress to S: ${pct.toFixed(0)}%`;

    const qg = $id('hha-quest-goal');
    const qm = $id('hha-quest-mini');
    if (qg) qg.textContent = `Goal: อยู่ GREEN ให้นานที่สุด (ตอนนี้ ${s.greenTick}s)`;
    if (qm) qm.textContent = `Mini: PERFECT/Combo ลุ้น Storm Wave!`;
  }

  function applyView(){
    if (!playfield) return;
    playfield.style.setProperty('--view-x', s.viewX + 'px');
    playfield.style.setProperty('--view-y', s.viewY + 'px');
  }

  function shimmerPulse(){
    if (!playfield) return;
    addClass(playfield, 'hvr-shimmer');
    ROOT.setTimeout(()=>removeClass(playfield,'hvr-shimmer'), 280);
  }

  function blinkOn(kind, ms=110){
    if (!blink) return;
    blink.className = '';
    blink.classList.add('on');
    if (kind) blink.classList.add(kind);
    ROOT.setTimeout(()=>{ blink.className=''; }, ms);
  }

  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (wrap){
      wrap.style.setProperty('--storm', String(s.stormStrength.toFixed(3)));
      wrap.style.setProperty('--chroma', String((0.65 + s.stormStrength*0.75).toFixed(3)));
      wrap.style.setProperty('--wob', String((0.20 + s.stormStrength*0.55).toFixed(3)));
      if (s.stormOn){
        addClass(wrap,'hvr-chroma');
        addClass(wrap,'hvr-wobble');
      }else{
        removeClass(wrap,'hvr-chroma');
        removeClass(wrap,'hvr-wobble');
      }
    }

    if (speedLines){
      if (s.stormOn){
        addClass(speedLines,'on');
        // heavier with strength
        speedLines.style.opacity = String(clamp(0.18 + s.stormStrength*0.18, 0, 0.40));
        speedLines.style.animationDuration = `${clamp(0.30 - s.stormStrength*0.10, 0.18, 0.32)}s`;
      }else{
        removeClass(speedLines,'on');
        speedLines.style.opacity = '';
        speedLines.style.animationDuration = '';
      }
    }
  }

  function maybeStormTick(){
    const t = now();
    if (s.stormOn && t > s.stormUntil){
      setStorm(false, 0);
    }
  }

  // device tilt shimmer
  function bindTilt(){
    const onOri = (e)=>{
      // gamma: L/R, beta: F/B
      const gx = clamp((e.gamma||0)/30, -1, 1);
      const gy = clamp((e.beta||0)/40, -1, 1);
      s.tiltX = gx; s.tiltY = gy;

      if (playfield){
        playfield.style.setProperty('--tilt-x', gx.toFixed(3));
        playfield.style.setProperty('--tilt-y', gy.toFixed(3));
      }
    };
    ROOT.addEventListener('deviceorientation', onOri, { passive:true });
    return ()=> ROOT.removeEventListener('deviceorientation', onOri);
  }

  // drag view on playfield (but move spawnLayer via CSS vars)
  function bindViewDragAndShoot(inst){
    if (!playfield) return;

    let down = false;
    let moved = false;
    let sx=0, sy=0, vx0=0, vy0=0;
    let pid = null;
    const TH = 6;

    const onDown = (e)=>{
      if (!s.running) return;
      down = true; moved = false;
      pid = e.pointerId;
      try{ playfield.setPointerCapture(pid); }catch{}
      sx = e.clientX; sy = e.clientY;
      vx0 = s.viewX; vy0 = s.viewY;
    };
    const onMove = (e)=>{
      if (!down || !s.running) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!moved && (Math.abs(dx)+Math.abs(dy) > TH)) moved = true;

      if (moved){
        // clamp view
        s.viewX = clamp(vx0 + dx, -180, 180);
        s.viewY = clamp(vy0 + dy, -140, 140);
        applyView();
      }
    };
    const onUp = ()=>{
      if (!down) return;
      down = false;
      try{ playfield.releasePointerCapture(pid); }catch{}
      pid = null;

      // tap => shoot
      if (!moved && inst && typeof inst.shootCrosshair === 'function'){
        inst.shootCrosshair();
      }
    };

    playfield.addEventListener('pointerdown', onDown, { passive:true });
    playfield.addEventListener('pointermove', onMove, { passive:true });
    playfield.addEventListener('pointerup', onUp, { passive:true });
    playfield.addEventListener('pointercancel', onUp, { passive:true });

    return ()=> {
      playfield.removeEventListener('pointerdown', onDown);
      playfield.removeEventListener('pointermove', onMove);
      playfield.removeEventListener('pointerup', onUp);
      playfield.removeEventListener('pointercancel', onUp);
    };
  }

  // PostFX render loop
  let fxRaf = null;
  function fxLoop(){
    if (!post || !post.ctx) return;
    const ctx = post.ctx;
    const t = now();

    ctx.clearRect(0,0,ROOT.innerWidth||1,ROOT.innerHeight||1);

    const out = [];
    for (const sp of s.sparks){
      const dt = t - sp.t0;
      if (dt > 560) continue;
      out.push(sp);

      const k = 1 - (dt/560);
      ctx.globalAlpha = 0.62 * k;
      drawStarBurst(ctx, sp.x, sp.y, t, sp.str * (0.75 + 0.60*k));
    }
    s.sparks = out;

    ctx.globalAlpha = 1;
    fxRaf = ROOT.requestAnimationFrame(fxLoop);
  }
  fxRaf = ROOT.requestAnimationFrame(fxLoop);

  // water update
  function updateWater(delta){
    s.water = clamp(s.water + delta, 0, 100);
    const z = zoneFrom(s.water);     // LOW/GREEN/HIGH
    s.zone = z;
    s.zoneLabel = zoneLabelFrom(z); // BLUE/GREEN/RED

    setWaterGauge(s.water);

    const st = $id('hha-water-status');
    if (st) st.textContent = `${s.zoneLabel} ${Math.round(s.water)}%`;
    const zt = $id('hha-water-zone-text');
    if (zt) zt.textContent = `ZONE ${s.zoneLabel}`;

    return { pct:s.water, zone:s.zone };
  }

  // init
  updateWater(0);
  hud();
  applyView();

  // storm => faster spawn
  function spawnMul(){
    if (!s.stormOn) return 1.0;
    return clamp(0.70 - 0.25*s.stormStrength, 0.40, 0.75);
  }

  // decorate targets to bubble skin + per-target wind lines
  function decorateTarget(el, parts, data){
    if (!el || !parts) return;

    // make ring selectable by CSS
    if (parts.ring) parts.ring.classList.add('hvr-ring');

    // bubble skin for good/power/fakeGood
    const it = String(data.itemType||'');
    const isBad = (it === 'bad');

    if (!isBad){
      el.dataset.skin = 'bubble';

      // make inner “almost invisible” – we keep emoji for readability but lighter
      if (parts.icon){
        parts.icon.style.filter = 'drop-shadow(0 2px 3px rgba(2,6,23,0.55))';
        parts.icon.style.opacity = (it === 'power') ? '0.95' : '0.86';
      }

      // inner background reduced
      if (parts.inner){
        parts.inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08), rgba(2,6,23,0.06) 55%, rgba(2,6,23,0.00) 78%)';
        parts.inner.style.boxShadow = 'inset 0 0 0 rgba(0,0,0,0)';
      }

      // add per-target wind overlay for storm
      const wind = DOC.createElement('div');
      wind.className = 'hvr-wind';
      parts.wiggle && parts.wiggle.appendChild(wind);

      // tiny random variation
      el.style.setProperty('--seed', String(Math.random().toFixed(3)));
    } else {
      // junk: keep default but polish a bit
      el.dataset.skin = '';
      el.style.boxShadow = '0 16px 36px rgba(15,23,42,0.85), 0 0 0 2px rgba(255,80,120,0.32), 0 0 22px rgba(255,80,120,0.18)';
    }
  }

  function perfectFX(x,y){
    // heavy burst
    try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
    try{ Particles.scorePop(x,y,'PERFECT! +','gold'); }catch{}
    blinkOn('perfect', 140);

    // sparkle sound + pop
    playSparkle(1.0);
    playPop(0.65);

    shimmerPulse();

    if (wrap){
      addClass(wrap,'hvr-perfect-pulse');
      ROOT.setTimeout(()=>removeClass(wrap,'hvr-perfect-pulse'), 220);
    }

    if (post && post.ctx){
      // double burst for heavier feel
      s.sparks.push({ x, y, t0: now(), str: 1.35 });
      s.sparks.push({ x: x + (Math.random()*10-5), y: y + (Math.random()*10-5), t0: now()+8, str: 1.05 });
    }
  }

  function goodFX(x,y, txt='+', kind='good'){
    try{ Particles.burstAt(x,y,kind==='good'?'GOOD':'POWER'); }catch{}
    try{ Particles.scorePop(x,y,txt,kind); }catch{}
    blinkOn('good', 90);
    playPop(kind==='power'?0.80:0.55);
    shimmerPulse();
  }

  function badFX(x,y, txt='MISS'){
    try{ Particles.burstAt(x,y,'BAD'); }catch{}
    try{ Particles.scorePop(x,y,txt,'bad'); }catch{}
    blinkOn('bad', 110);
    playPop(0.80);
  }

  // judge callback
  function judge(ch, ctx){
    const x = ctx?.clientX || (ctx?.targetRect?.left + (ctx?.targetRect?.width||0)/2) || (ROOT.innerWidth/2);
    const y = ctx?.clientY || (ctx?.targetRect?.top + (ctx?.targetRect?.height||0)/2) || (ROOT.innerHeight/2);

    const itemType = String(ctx?.itemType || '');
    const isBad = (itemType === 'bad');
    const isPower = (itemType === 'power');
    const isFakeGood = (itemType === 'fakeGood');
    const perfect = !!ctx?.hitPerfect;

    // PERFECT ring bonus
    if (perfect){
      s.score += 120;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+4);
      perfectFX(x,y);
    }

    if (isBad){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 45);
      updateWater(-10);
      badFX(x,y,'MISS');

      // panic storm sometimes
      if (!s.stormOn && Math.random() < 0.18){
        s.stormUntil = now() + 5200;
        setStorm(true, 0.90);
      }

      hud();
      return { scoreDelta: -45, good:false };
    }

    // trick: bad when not perfect
    if (isFakeGood && !perfect){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      badFX(x,y,'TRICK!');
      hud();
      return { scoreDelta: -30, good:false };
    }

    if (isPower){
      s.score += 95;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+9);
      goodFX(x,y,'POWER +95','power');

      // power triggers storm wave
      s.stormUntil = now() + 7200;
      setStorm(true, 1.10);

      hud();
      return { scoreDelta: +95, good:true };
    }

    // normal good
    s.score += 55;
    s.combo += 1;
    s.comboMax = Math.max(s.comboMax, s.combo);

    if (s.zone === 'LOW') updateWater(+8);
    else if (s.zone === 'HIGH') updateWater(+3);
    else updateWater(+5);

    // streak
    if (s.combo > 0 && (s.combo % 8 === 0)){
      s.score += 80;
      goodFX(x,y,'STREAK +80','good');

      if (!s.stormOn && Math.random() < 0.32){
        s.stormUntil = now() + 6400;
        setStorm(true, 1.00);
      }
    } else {
      goodFX(x,y,'+55','good');
    }

    hud();
    return { scoreDelta: +55, good:true };
  }

  // expire callback
  function onExpire(info){
    const itemType = String(info?.itemType||'');
    if (itemType === 'good' || itemType === 'power'){
      s.combo = Math.max(0, s.combo - 1);
    }
    hud();
  }

  // boot mode-factory
  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration,

    // ✅ spawn to moving layer
    spawnHost: '#hvr-spawnlayer',
    // ✅ bounds for safe zone / crosshair (stable)
    boundsHost: '#hvr-playfield',

    pools: { good: GOOD, bad: BAD, trick: ['💧','🫧'] },
    goodRate: diff === 'hard' ? 0.58 : (diff === 'normal' ? 0.62 : 0.68),
    powerups: POWER,
    powerRate: diff === 'hard' ? 0.12 : 0.10,
    powerEvery: 7,

    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff === 'hard' ? 0.12 : 0.08,

    spawnIntervalMul: spawnMul,

    // clamp safe zone against HUD (robust)
    excludeSelectors: ['.hud', '#hvr-end', '#hvr-screen-blink'],

    decorateTarget,
    judge,
    onExpire
  });

  const unbindDrag = bindViewDragAndShoot(inst);
  const unbindTilt = bindTilt();

  function onTime(ev){
    const sec = ev?.detail?.sec;
    if (typeof sec !== 'number') return;
    s.timeLeft = sec;

    // natural drain
    updateWater(-1.4);

    // ✅ zone counting fix
    if (s.zone === 'GREEN') s.greenTick += 1;

    maybeStormTick();

    // RED penalty
    if (s.zone === 'HIGH'){
      s.score = Math.max(0, s.score - 3);
    }

    hud();

    if (sec <= 0){
      endGame();
    }
  }
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function buildEndOverlay(){
    const end = $id('hvr-end');
    if (!end) return;
    end.className = 'on';

    const g = gradeFrom(s.score);
    end.innerHTML = `
      <div style="width:min(760px,100%); display:grid; grid-template-columns:1fr; gap:10px;">
        <div style="background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.24); border-radius:24px; padding:14px; box-shadow:0 22px 70px rgba(0,0,0,.60);">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <h2 style="margin:0; font-size:18px; font-weight:1000;">🏁 สรุปผลการเล่น</h2>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:rgba(148,163,184,.9); font-weight:900;">Grade</span>
              <span style="font-weight:1000; letter-spacing:.08em;">${g}</span>
            </div>
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px;">
            <div class="card" style="pointer-events:auto;">
              <div class="kpi"><div class="label">Score</div><div class="value">${s.score|0}</div></div>
              <div style="margin-top:6px; color:rgba(148,163,184,.9); font-size:12px;">รวมโบนัส PERFECT/STREAK/STORM</div>
            </div>
            <div class="card" style="pointer-events:auto;">
              <div class="kpi"><div class="label">Combo / Miss</div><div class="value">${s.comboMax|0} • ${s.miss|0}</div></div>
              <div style="margin-top:6px; color:rgba(148,163,184,.9); font-size:12px;">คอมโบสูงสุด • miss (junk/trick)</div>
            </div>
            <div class="card" style="pointer-events:auto;">
              <div class="kpi"><div class="label">GREEN time</div><div class="value">${s.greenTick|0}s</div></div>
              <div style="margin-top:6px; color:rgba(148,163,184,.9); font-size:12px;">เวลาที่อยู่ในโซน GREEN</div>
            </div>
            <div class="card" style="pointer-events:auto;">
              <div class="kpi"><div class="label">Water end</div><div class="value">${Math.round(s.water)}% (${s.zoneLabel})</div></div>
              <div style="margin-top:6px; color:rgba(148,163,184,.9); font-size:12px;">โซนสุดท้าย</div>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button id="hvr-end-retry" class="pill" style="pointer-events:auto; padding:10px 12px; border-radius:16px; cursor:pointer;">🔁 เล่นอีกครั้ง</button>
            <button id="hvr-end-hub" class="pill" style="pointer-events:auto; padding:10px 12px; border-radius:16px; cursor:pointer;">🏠 กลับ Hub</button>
          </div>
        </div>
      </div>
    `;

    const retry = $id('hvr-end-retry');
    const hub = $id('hvr-end-hub');
    if (retry) retry.onclick = ()=>location.reload();
    if (hub) hub.onclick = ()=>location.href = './hub.html';
  }

  function endGame(){
    if (!s.running) return;
    s.running = false;

    try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
    try{ inst && inst.stop && inst.stop(); }catch{}

    if (unbindDrag) try{ unbindDrag(); }catch{}
    if (unbindTilt) try{ unbindTilt(); }catch{}

    ROOT.removeEventListener('hha:time', onTime);

    if (fxRaf) try{ ROOT.cancelAnimationFrame(fxRaf); }catch{}
    fxRaf = null;

    setStorm(false, 0);

    try{ Particles.celebrate('END'); }catch{}
    buildEndOverlay();

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          score: s.score|0,
          miss: s.miss|0,
          comboBest: s.comboMax|0,
          grade: gradeFrom(s.score),
          water: Math.round(s.water),
          zone: s.zoneLabel,
          greenTick: s.greenTick|0,
          progPct: clamp((s.score/1500)*100,0,100)|0
        }
      }));
    }catch{}
  }

  // unlock audio by user gesture (first interaction usually handled by gameplay already)
  ensureAudio();

  // initial HUD update
  hud();

  return {
    stop(){ endGame(); },
    shoot(){ try{ inst && inst.shootCrosshair && inst.shootCrosshair(); }catch{} }
  };
}

export default { boot };