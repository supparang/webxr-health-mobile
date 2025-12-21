// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION
// Root page: /herohealth/hydration-vr.html  (แต่ไฟล์นี้ “กันพลาด” สร้าง element ที่ขาดเองได้)
//
// ✅ mode-factory (DOM targets + crosshair shoot + perfect ring ctx.hitPerfect)
// ✅ คืน FX: burst + score pop + judgement (Particles)
// ✅ เป้าเป็น “ฟองสบู่” ใสเกือบไม่เห็น แต่ขอบสวย + iridescence ชัดขึ้น
// ✅ reactive shimmer + device-tilt shimmer (CSS vars)
// ✅ Storm: sway แรง/เร็วขึ้น + speedlines + chromatic split แรงขึ้น + wobble ต่อเนื่อง
// ✅ Fix zone counting: นับ GREEN/BLUE/RED ถูกต้อง ไม่เอา RED ไปนับ GREEN
// ✅ Drag view: เลื่อนจอแล้วเป้าเลื่อนตาม (host = #hvr-playfield transform)
//
// Dependencies:
// /herohealth/vr/mode-factory.js
// /herohealth/vr/ui-water.js
// /herohealth/vr/particles.js  (IIFE)  — optional but recommended
//
// Notes:
// - ถ้า HTML ไม่มี <canvas id="hvr-postfx"> / #hvr-screen-blink / #hvr-end → ไฟล์นี้จะสร้างให้
// - HUD ids รองรับหลายเวอร์ชัน (ของเก่า/ใหม่)

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
function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
function $id(id){ return DOC ? DOC.getElementById(id) : null; }

function setAnyText(ids, txt){
  for (const id of ids){
    const el = $id(id);
    if (el){ el.textContent = String(txt); return true; }
  }
  return false;
}
function setAnyHTML(ids, html){
  for (const id of ids){
    const el = $id(id);
    if (el){ el.innerHTML = String(html); return true; }
  }
  return false;
}
function addClass(el,c){ try{ el && el.classList.add(c);}catch{} }
function removeClass(el,c){ try{ el && el.classList.remove(c);}catch{} }

function ensureEl(id, tag='div', parent=DOC.body){
  if (!DOC) return null;
  let el = DOC.getElementById(id);
  if (el && el.isConnected) return el;
  el = DOC.createElement(tag);
  el.id = id;
  parent.appendChild(el);
  return el;
}

// ui-water zones: LOW/GREEN/HIGH → in Hydration we show BLUE/GREEN/RED
function zoneLabelFrom(z){
  if (z === 'LOW') return 'BLUE';
  if (z === 'HIGH') return 'RED';
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

function ensurePlayfieldFullScreen(playfield, wrap){
  if (!playfield) return;
  try{
    // wrap
    if (wrap){
      const cs = ROOT.getComputedStyle(wrap);
      if (cs.position === 'static') wrap.style.position = 'fixed';
      wrap.style.inset = wrap.style.inset || '0';
      wrap.style.overflow = wrap.style.overflow || 'hidden';
    }
    // playfield
    Object.assign(playfield.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      minWidth: '100vw',
      minHeight: '100vh',
      zIndex: String(playfield.style.zIndex || 10),
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transform: playfield.style.transform || 'translate3d(0,0,0)'
    });

    const r = playfield.getBoundingClientRect();
    if (r.width < 140 || r.height < 140){
      // force a relayout
      playfield.style.width = '100vw';
      playfield.style.height = '100vh';
    }
  }catch{}
}

function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    /* ===== Parallax (2 layers) ===== */
    #hvr-playfield{
      --view-x: 0px;
      --view-y: 0px;
      --tilt-x: 0;
      --tilt-y: 0;
    }
    .hvr-parallax{
      position:absolute;
      inset:-14%;
      pointer-events:none;
      transform: translate3d(calc(var(--view-x) * var(--px, 0.2)), calc(var(--view-y) * var(--py, 0.2)), 0);
      will-change: transform;
      opacity: var(--op, 0.32);
      filter: blur(var(--blur, 0px)) saturate(1.05) contrast(1.05);
    }
    .hvr-parallax.l1{
      --px: 0.16; --py: 0.12; --op:0.28; --blur:0px;
      background:
        radial-gradient(920px 640px at 20% 18%, rgba(96,165,250,.20), transparent 60%),
        radial-gradient(840px 660px at 80% 20%, rgba(34,197,94,.18), transparent 60%),
        radial-gradient(980px 760px at 50% 78%, rgba(59,130,246,.10), transparent 66%);
      mix-blend-mode: screen;
    }
    .hvr-parallax.l2{
      --px: 0.44; --py: 0.36; --op:0.18; --blur:0.25px;
      background:
        repeating-radial-gradient(circle at 32% 42%, rgba(255,255,255,.085) 0 2px, transparent 2px 28px),
        repeating-linear-gradient(45deg, rgba(59,130,246,.060) 0 1px, transparent 1px 20px);
      mix-blend-mode: overlay;
      transform: translate3d(calc(var(--view-x) * var(--px, 0.44)), calc(var(--view-y) * var(--py, 0.36)), 0) rotate(0.0001deg);
    }

    /* ===== Storm postFX ===== */
    #hvr-wrap.hvr-chroma-strong{
      filter:
        drop-shadow(4.6px 0 rgba(255, 40, 80, 0.72))
        drop-shadow(-2.8px 0 rgba(0, 205, 255, 0.34))
        drop-shadow(0 0 10px rgba(255, 255, 255, 0.06));
    }

    #hvr-wrap.hvr-wobble{
      animation: hvrWobble 0.95s ease-in-out infinite;
      will-change: transform, filter;
    }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      20%{ transform: translate3d(0.9px,-0.6px,0) rotate(0.05deg); }
      50%{ transform: translate3d(-1.0px,0.8px,0) rotate(-0.05deg); }
      80%{ transform: translate3d(0.7px,0.9px,0) rotate(0.03deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* Speedlines overlay */
    .hvr-speedlines{
      position:fixed;
      inset:-22%;
      pointer-events:none;
      z-index:99960;
      opacity:0;
      mix-blend-mode: screen;
      background:
        repeating-linear-gradient(110deg,
          rgba(255,255,255,.00) 0 14px,
          rgba(255,80,120,.14) 14px 16px,
          rgba(0,205,255,.10) 16px 18px,
          rgba(255,255,255,.00) 18px 40px
        );
      filter: blur(0.65px) saturate(1.12) contrast(1.10);
      animation: hvrLines 0.28s linear infinite;
      transform: translate3d(0,0,0);
      will-change: transform, opacity;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-12px, -12px, 0); }
      100%{ transform: translate3d(32px, 26px, 0); }
    }
    .hvr-speedlines.on{ opacity:0.34; }

    /* Screen blink helper */
    #hvr-screen-blink{
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:99980;
      opacity:0;
      transition:opacity 90ms ease;
      mix-blend-mode:screen;
    }
    #hvr-screen-blink.on{ opacity:1; }
    #hvr-screen-blink.good{ background:rgba(34,197,94,.22); }
    #hvr-screen-blink.bad{ background:rgba(239,68,68,.22); }
    #hvr-screen-blink.perfect{ background:rgba(255,255,255,.20); }

    /* ===== Bubble target skin (override mode-factory) ===== */
    .hvr-target{
      border-radius: 999px !important;
      background: transparent !important;
      box-shadow: none !important;
      overflow: visible !important;
      isolation:isolate;
      will-change: transform;
    }

    /* bubble body */
    .hvr-target .hvr-bubble{
      position:absolute;
      inset:0;
      border-radius:999px;
      background:
        radial-gradient(circle at 30% 25%,
          rgba(255,255,255,.08),
          rgba(255,255,255,.02) 34%,
          rgba(255,255,255,.01) 55%,
          rgba(255,255,255,.00) 68%),
        radial-gradient(circle at 50% 60%,
          rgba(120,180,255,.04),
          rgba(255,255,255,.00) 62%);
      backdrop-filter: blur(0.6px);
      -webkit-backdrop-filter: blur(0.6px);
      opacity:0.92;
      pointer-events:none;
    }

    /* Iridescent thin-film rim (stronger but still subtle) */
    .hvr-target .hvr-film{
      position:absolute;
      inset:-2px;
      border-radius:999px;
      background:
        conic-gradient(from calc(120deg + (var(--tilt-x) * 18deg) + (var(--tilt-y) * 10deg)),
          rgba(255,60,120,.00),
          rgba(255,60,120,.35),
          rgba(0,205,255,.35),
          rgba(140,255,160,.28),
          rgba(255,230,120,.30),
          rgba(170,120,255,.30),
          rgba(255,60,120,.33),
          rgba(255,60,120,.00)
        );
      filter: blur(0.35px) saturate(1.22) contrast(1.10);
      opacity:0.55;
      mix-blend-mode: screen;
      pointer-events:none;
      mask:
        radial-gradient(circle at center, transparent 66%, #000 70%),
        radial-gradient(circle at center, #000 0 100%);
      -webkit-mask:
        radial-gradient(circle at center, transparent 66%, #000 70%),
        radial-gradient(circle at center, #000 0 100%);
    }

    /* Thin bright rim (edge beauty) */
    .hvr-target .hvr-rim{
      position:absolute;
      inset:0;
      border-radius:999px;
      box-shadow:
        0 0 0 1px rgba(255,255,255,.13),
        0 0 18px rgba(255,255,255,.08),
        0 0 26px rgba(0,205,255,.10),
        0 0 26px rgba(255,60,120,.10);
      opacity:0.65;
      pointer-events:none;
    }

    /* reactive shimmer (moves with tilt + storm) */
    .hvr-target .hvr-shimmer{
      position:absolute;
      inset:-8%;
      border-radius:999px;
      background:
        radial-gradient(140px 90px at calc(50% + (var(--tilt-x) * 30%)) calc(40% + (var(--tilt-y) * 22%)),
          rgba(255,255,255,.16),
          rgba(255,255,255,.02) 55%,
          rgba(255,255,255,.00) 70%);
      mix-blend-mode: screen;
      opacity:0.42;
      filter: blur(0.2px);
      pointer-events:none;
      transform: translate3d(0,0,0);
      animation: hvrShimmer 1.35s ease-in-out infinite;
    }
    @keyframes hvrShimmer{
      0%{ transform: translate3d(-1px,-1px,0) rotate(-0.05deg); opacity:.34; }
      50%{ transform: translate3d(1px,1px,0) rotate(0.05deg); opacity:.50; }
      100%{ transform: translate3d(-1px,-1px,0) rotate(-0.05deg); opacity:.34; }
    }

    /* emoji/icon inside bubble */
    .hvr-target .hvr-icon{
      position:absolute;
      left:50%;
      top:50%;
      transform: translate(-50%,-50%);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.55));
      opacity:0.88;
      pointer-events:none;
      user-select:none;
      -webkit-user-select:none;
    }

    /* perfect ring highlight (strong) */
    .hvr-target .hvr-perfect-ring{
      position:absolute;
      left:50%;
      top:50%;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border:2px solid rgba(255,255,255,.40);
      box-shadow:
        0 0 10px rgba(255,255,255,.18),
        0 0 18px rgba(255,60,120,.16),
        0 0 18px rgba(0,205,255,.12);
      pointer-events:none;
      opacity:.75;
    }

    /* float/sway movement */
    .hvr-target.hvr-float{
      animation: hvrFloat 1.65s ease-in-out infinite;
    }
    @keyframes hvrFloat{
      0%{ transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(0deg); }
      35%{ transform: translate(-50%,-50%) scale(1) translate3d(1.6px,-1.2px,0) rotate(0.10deg); }
      70%{ transform: translate(-50%,-50%) scale(1) translate3d(-1.4px,1.8px,0) rotate(-0.10deg); }
      100%{ transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(0deg); }
    }
    /* storm makes sway faster/stronger */
    .hvr-storm-on .hvr-target.hvr-float{
      animation: hvrFloatStorm 0.85s ease-in-out infinite;
    }
    @keyframes hvrFloatStorm{
      0%{ transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate(-50%,-50%) scale(1) translate3d(3.0px,-2.3px,0) rotate(0.22deg); }
      50%{ transform: translate(-50%,-50%) scale(1) translate3d(-3.2px,2.6px,0) rotate(-0.22deg); }
      75%{ transform: translate(-50%,-50%) scale(1) translate3d(2.4px,3.0px,0) rotate(0.16deg); }
      100%{ transform: translate(-50%,-50%) scale(1) translate3d(0,0,0) rotate(0deg); }
    }

    /* make bad targets a bit more visible but still bubble-like */
    .hvr-target[data-item-type="bad"] .hvr-film{ opacity:.62; }
    .hvr-target[data-item-type="bad"] .hvr-rim{
      box-shadow:
        0 0 0 1px rgba(255,255,255,.10),
        0 0 18px rgba(239,68,68,.16),
        0 0 26px rgba(255,60,120,.14),
        0 0 22px rgba(0,205,255,.08);
    }
    .hvr-target[data-item-type="power"] .hvr-film{ opacity:.70; }
    .hvr-target[data-item-type="power"] .hvr-rim{
      box-shadow:
        0 0 0 1px rgba(255,255,255,.14),
        0 0 20px rgba(250,204,21,.20),
        0 0 28px rgba(255,60,120,.14),
        0 0 24px rgba(0,205,255,.12);
    }
    .hvr-target[data-item-type="fakeGood"] .hvr-film{ opacity:.66; }
  `;
  DOC.head.appendChild(s);
}

function ensurePostFXCanvas(){
  if (!DOC) return null;
  let c = $id('hvr-postfx');
  if (!c){
    c = DOC.createElement('canvas');
    c.id = 'hvr-postfx';
    DOC.body.appendChild(c);
  }
  const ctx = c.getContext('2d');

  function resize(){
    const dpr = Math.max(1, Math.min(2, ROOT.devicePixelRatio || 1));
    c.width  = Math.floor((ROOT.innerWidth||1) * dpr);
    c.height = Math.floor((ROOT.innerHeight||1) * dpr);
    c.style.position = 'fixed';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '60';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  ROOT.addEventListener('resize', resize, { passive:true });

  return { c, ctx, resize };
}

function drawStarBurst(ctx, x, y, t, strength=1){
  const n = Math.floor(22 + 22*strength);
  const r0 = 6 + 12*strength;
  const r1 = 44 + 84*strength;

  ctx.save();
  ctx.translate(x,y);
  ctx.globalCompositeOperation = 'screen';

  for (let i=0;i<n;i++){
    const a = (i/n) * Math.PI*2 + (t*0.002);
    const rr = r0 + (r1-r0) * (0.25 + 0.75*Math.random());
    const w = 1.2 + 2.6*strength;

    ctx.strokeStyle = `rgba(255, 60, 120, ${0.12 + 0.12*strength})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    ctx.stroke();

    const a2 = a + 0.18;
    ctx.strokeStyle = `rgba(0, 205, 255, ${0.10 + 0.11*strength})`;
    ctx.lineWidth = w*0.82;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a2)*r0, Math.sin(a2)*r0);
    ctx.lineTo(Math.cos(a2)*rr*0.92, Math.sin(a2)*rr*0.92);
    ctx.stroke();
  }

  for (let k=0;k<22;k++){
    const a = Math.random()*Math.PI*2;
    const rr = 10 + Math.random()*(78*strength);
    ctx.fillStyle = `rgba(255,255,255,${0.14 + 0.22*Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.2 + 2.6*Math.random(), 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function ensureAudio(){
  const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
  if (!AC) return null;
  if (ensureAudio._ac && ensureAudio._ac.state !== 'closed') return ensureAudio._ac;
  try{
    const ac = new AC();
    ensureAudio._ac = ac;
    return ac;
  }catch{
    return null;
  }
}
function blip(freq=880, dur=0.08, gain=0.06){
  const ac = ensureAudio();
  if (!ac) return;
  try{
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;

    o.connect(g);
    g.connect(ac.destination);

    const t0 = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }catch{}
}

// Mutation observer: convert mode-factory target → bubble skin
function mountBubbleSkin(host){
  if (!DOC || !host) return ()=>{};
  const apply = (el)=>{
    if (!el || !el.isConnected) return;
    if (el.__hvrBubbleApplied) return;
    el.__hvrBubbleApplied = true;

    // build bubble layers
    const bubble = DOC.createElement('div');
    bubble.className = 'hvr-bubble';

    const film = DOC.createElement('div');
    film.className = 'hvr-film';

    const rim = DOC.createElement('div');
    rim.className = 'hvr-rim';

    const shimmer = DOC.createElement('div');
    shimmer.className = 'hvr-shimmer';

    // icon: try find inner span (mode-factory makes span icon)
    let iconSpan = null;
    try{
      iconSpan = el.querySelector('span');
    }catch{}
    if (iconSpan){
      iconSpan.classList.add('hvr-icon');
      // make it a bit smaller/softer (bubble vibe)
      try{
        iconSpan.style.opacity = '0.92';
        iconSpan.style.transform = 'translate(-50%,-50%) scale(0.98)';
      }catch{}
    }

    // perfect ring: keep mode-factory ring but also add our ring sized by element
    const pr = DOC.createElement('div');
    pr.className = 'hvr-perfect-ring';
    // size will be updated by resize loop
    pr.style.width = '36%';
    pr.style.height = '36%';

    // insert layers (order matters)
    el.appendChild(bubble);
    el.appendChild(film);
    el.appendChild(rim);
    el.appendChild(shimmer);
    el.appendChild(pr);

    // movement
    addClass(el, 'hvr-float');

    // reduce default inner backgrounds from mode-factory (if exists)
    try{
      const inner = el.querySelector('div');
      if (inner){
        inner.style.background = 'transparent';
        inner.style.boxShadow = 'none';
      }
      // also remove any ring that mode-factory appended (it’s fine if exists)
    }catch{}
  };

  // apply existing
  try{
    host.querySelectorAll('.hvr-target').forEach(apply);
  }catch{}

  const mo = new MutationObserver((muts)=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        if (!n || n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains('hvr-target')) apply(n);
        else{
          try{ n.querySelectorAll && n.querySelectorAll('.hvr-target').forEach(apply); }catch{}
        }
      }
    }
  });
  try{ mo.observe(host, { childList:true, subtree:true }); }catch{}

  return ()=>{ try{ mo.disconnect(); }catch{} };
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap = $id('hvr-wrap') || DOC.body;
  const playfield = $id('hvr-playfield') || ensureEl('hvr-playfield', 'div', wrap);
  ensurePlayfieldFullScreen(playfield, wrap);

  // Create missing helpers if page doesn’t have them
  const blink = $id('hvr-screen-blink') || ensureEl('hvr-screen-blink', 'div', DOC.body);
  const endBox = $id('hvr-end') || ensureEl('hvr-end', 'div', DOC.body);

  // Parallax layers (under targets)
  if (playfield && !playfield.querySelector('.hvr-parallax')){
    const l1 = DOC.createElement('div'); l1.className = 'hvr-parallax l1';
    const l2 = DOC.createElement('div'); l2.className = 'hvr-parallax l2';
    playfield.appendChild(l1);
    playfield.appendChild(l2);
  }

  // Speedlines overlay
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  // PostFX
  const post = ensurePostFXCanvas();

  // Bubble skin on targets created by mode-factory
  const unmountBubble = mountBubbleSkin(playfield);

  // Difficulty / duration
  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  // Pools (icon inside bubble)
  const GOOD  = ['💧','🧊','🫧','🥤'];      // water/ice/bubble/bottle
  const BAD   = ['🍟','🍩','🍕','🧋'];      // junk
  const POWER = ['✨','⭐','⚡'];           // power

  // Goal tuning (match your HUD screenshot)
  const GOAL_GREEN_TARGET = (diff==='hard'? 22 : diff==='normal'? 18 : 16);     // seconds in GREEN
  const GOAL_BAD_LIMIT    = (diff==='hard'? 18 : diff==='normal'? 26 : 32);     // BLUE+RED seconds <= limit

  // Mini tuning
  const MINI_COMBO_REQ    = (diff==='hard'? 10 : 8);
  const MINI_PERF_REQ     = (diff==='hard'? 6 : 4);
  const MINI_NOJUNK_REQ   = 0; // junk hits must be 0 to pass (shown realtime)

  const s = {
    running: true,
    timeLeft: duration,

    // score
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    // water
    water: 50,
    zone: 'GREEN',        // LOW/GREEN/HIGH
    zoneLabel: 'GREEN',   // BLUE/GREEN/RED
    greenTick: 0,
    badTick: 0,           // BLUE+RED seconds
    lastZone: 'GREEN',

    // achievements
    perfectHits: 0,
    junkHits: 0,

    goalsDone: 0,
    minisDone: 0,
    goal1Passed: false,
    goal2Passed: false,
    miniComboPassed: false,
    miniPerfectPassed: false,
    miniNoJunkPassed: false,

    // view
    viewX: 0,
    viewY: 0,

    // storm
    stormOn: false,
    stormUntil: 0,
    stormStrength: 0,

    // tilt vars
    tiltX: 0,
    tiltY: 0,

    // postfx sparks
    sparks: [] // {x,y,t0,str}
  };

  function applyView(){
    if (!playfield) return;
    playfield.style.setProperty('--view-x', s.viewX + 'px');
    playfield.style.setProperty('--view-y', s.viewY + 'px');
    playfield.style.transform = `translate3d(${s.viewX}px, ${s.viewY}px, 0)`;
  }

  function blinkOn(kind, ms=110){
    if (!blink) return;
    blink.className = '';
    blink.classList.add('on');
    if (kind) blink.classList.add(kind);
    ROOT.setTimeout(()=>{ blink.className=''; }, ms);
  }

  function hud(){
    // score/combo/miss
    setAnyText(['hha-score-main','end-score'], s.score|0);
    setAnyText(['hha-combo-max','end-combo-max'], s.comboMax|0);
    setAnyText(['hha-miss','end-miss'], s.miss|0);

    // grade badge + progress
    const g = gradeFrom(s.score);
    setAnyText(['hha-grade-badge','end-grade'], g);

    const pct = clamp((s.score / 1500) * 100, 0, 100);
    const fill = $id('hha-grade-progress-fill');
    if (fill) fill.style.width = pct.toFixed(0) + '%';
    setAnyText(['hha-grade-progress-text'], `Progress to S: ${pct.toFixed(0)}%`);

    // goals/minis counts (support old+new ids)
    const goalsDone = (s.goal1Passed?1:0) + (s.goal2Passed?1:0);
    const minisDone = (s.miniComboPassed?1:0) + (s.miniPerfectPassed?1:0) + (s.miniNoJunkPassed?1:0);

    // new ids
    setAnyText(['hha-goal-count'], goalsDone);
    setAnyText(['hha-mini-count'], minisDone);

    // old ids
    setAnyText(['hha-goal-done'], goalsDone);
    setAnyText(['hha-goal-total'], 2);
    setAnyText(['hha-mini-done'], minisDone);
    setAnyText(['hha-mini-total'], 3);

    // quest lines (match your HUD style)
    const goalLine =
      `Goal: ⏳ อยู่ GREEN ≥ ${GOAL_GREEN_TARGET}s (ตอนนี้ ${s.greenTick}/${GOAL_GREEN_TARGET})` +
      ` • ⛔ อยู่ BLUE/RED รวมไม่เกิน ${GOAL_BAD_LIMIT}s (bad ${s.badTick}/${GOAL_BAD_LIMIT})`;

    const miniLine =
      `Mini: ✅ Combo ${s.comboMax}/${MINI_COMBO_REQ}` +
      ` • ✅ Perfect ${s.perfectHits}/${MINI_PERF_REQ}` +
      ` • ✅ NoJunk ${s.junkHits}/${MINI_NOJUNK_REQ}`;

    setAnyText(['hha-quest-goal'], goalLine);
    setAnyText(['hha-quest-mini'], miniLine);
  }

  function updateWater(delta){
    s.water = clamp(s.water + delta, 0, 100);
    const z = zoneFrom(s.water);       // LOW/GREEN/HIGH
    const label = zoneLabelFrom(z);    // BLUE/GREEN/RED

    s.zone = z;
    s.zoneLabel = label;

    // bind ui-water HUD
    try{ setWaterGauge(s.water); }catch{}

    // force label text in HUD (BLUE/GREEN/RED)
    setAnyText(['hha-water-zone-text'], `ZONE ${label}`);
    setAnyText(['hha-water-status'], `${label} ${Math.round(s.water)}%`);

    return { pct: s.water, zone: z, label };
  }

  // Storm toggles
  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (wrap){
      if (s.stormOn){
        addClass(wrap,'hvr-chroma-strong');
        addClass(wrap,'hvr-wobble');
      }else{
        removeClass(wrap,'hvr-chroma-strong');
        removeClass(wrap,'hvr-wobble');
      }
    }
    if (speedLines){
      if (s.stormOn) addClass(speedLines,'on');
      else removeClass(speedLines,'on');
    }
  }
  function maybeStormTick(){
    const t = now();
    if (s.stormOn && t > s.stormUntil){
      setStorm(false, 0);
    }
  }

  // device tilt shimmer vars
  function bindTilt(){
    const onOri = (e)=>{
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

  // Drag view + tap shoot (tap = shootCrosshair)
  function bindViewDragAndShoot(inst){
    if (!playfield) return ()=>{};
    let down=false, moved=false, sx=0, sy=0, vx0=0, vy0=0, pid=null;
    const TH=6;

    const onDown=(e)=>{
      if (!s.running) return;
      down=true; moved=false;
      pid=e.pointerId;
      try{ playfield.setPointerCapture(pid);}catch{}
      sx=e.clientX; sy=e.clientY;
      vx0=s.viewX; vy0=s.viewY;
    };
    const onMove=(e)=>{
      if (!down || !s.running) return;
      const dx=e.clientX-sx;
      const dy=e.clientY-sy;
      if (!moved && (Math.abs(dx)+Math.abs(dy) > TH)) moved=true;

      if (moved){
        // clamp view
        s.viewX = clamp(vx0 + dx, -180, 180);
        s.viewY = clamp(vy0 + dy, -140, 140);
        applyView();
      }
    };
    const onUp=()=>{
      if (!down) return;
      down=false;
      try{ playfield.releasePointerCapture(pid);}catch{}
      pid=null;

      // short tap => shoot
      if (!moved && inst && typeof inst.shootCrosshair === 'function'){
        inst.shootCrosshair();
      }
    };

    playfield.addEventListener('pointerdown', onDown, { passive:true });
    playfield.addEventListener('pointermove', onMove, { passive:true });
    playfield.addEventListener('pointerup', onUp, { passive:true });
    playfield.addEventListener('pointercancel', onUp, { passive:true });

    return ()=>{
      playfield.removeEventListener('pointerdown', onDown);
      playfield.removeEventListener('pointermove', onMove);
      playfield.removeEventListener('pointerup', onUp);
      playfield.removeEventListener('pointercancel', onUp);
    };
  }

  // PostFX loop
  let fxRaf = null;
  function fxLoop(){
    if (!post || !post.ctx) return;
    const ctx = post.ctx;
    const t = now();

    ctx.clearRect(0,0,ROOT.innerWidth||1,ROOT.innerHeight||1);

    // draw spark bursts
    const out = [];
    for (const sp of s.sparks){
      const dt = t - sp.t0;
      if (dt > 560) continue;
      out.push(sp);
      const k = 1 - (dt/560);
      ctx.globalAlpha = 0.60 * k;
      drawStarBurst(ctx, sp.x, sp.y, t, sp.str * (0.80 + 0.60*k));
    }
    s.sparks = out;

    ctx.globalAlpha = 1;
    fxRaf = ROOT.requestAnimationFrame(fxLoop);
  }
  fxRaf = ROOT.requestAnimationFrame(fxLoop);

  // FX helpers
  function perfectFX(x,y){
    try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
    try{ Particles.scorePop(x,y,'PERFECT! +120','gold'); }catch{}
    blinkOn('perfect', 130);

    // heavy post burst
    if (post && post.ctx) s.sparks.push({ x, y, t0: now(), str: 1.35 });

    // sound
    blip(1040, 0.07, 0.06);
    blip(1560, 0.05, 0.045);
  }
  function goodFX(x,y, txt='+55', kind='good'){
    try{ Particles.burstAt(x,y, kind==='power'?'POWER':'GOOD'); }catch{}
    try{ Particles.scorePop(x,y, txt, kind); }catch{}
    blinkOn('good', 90);
    blip(740, 0.05, 0.028);
  }
  function badFX(x,y, txt='MISS'){
    try{ Particles.burstAt(x,y,'BAD'); }catch{}
    try{ Particles.scorePop(x,y, txt,'bad'); }catch{}
    blinkOn('bad', 120);
    blip(220, 0.08, 0.05);
  }

  // init water/HUD/view
  updateWater(0);
  applyView();
  hud();

  // spawn multiplier for storm wave (faster spawns)
  function spawnMul(){
    if (!s.stormOn) return 1.0;
    // stronger storm => more frequent
    return clamp(0.72 - 0.26*s.stormStrength, 0.42, 0.78);
  }

  // judge callback from mode-factory
  function judge(ch, ctx){
    const x =
      (ctx && ctx.clientX) ||
      (ctx && ctx.targetRect && (ctx.targetRect.left + (ctx.targetRect.width||0)/2)) ||
      (ROOT.innerWidth/2);

    const y =
      (ctx && ctx.clientY) ||
      (ctx && ctx.targetRect && (ctx.targetRect.top + (ctx.targetRect.height||0)/2)) ||
      (ROOT.innerHeight/2);

    const itemType = String(ctx?.itemType || '');
    const isBad = (itemType === 'bad');
    const isPower = (itemType === 'power');
    const isFakeGood = (itemType === 'fakeGood');
    const perfect = !!ctx?.hitPerfect;

    // PERFECT ring bonus (apply first)
    if (perfect){
      s.perfectHits += 1;
      s.score += 120;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.comboMax, s.combo);
      updateWater(+4);
      perfectFX(x,y);
    }

    // bad hit
    if (isBad){
      s.junkHits += 1;
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

      checkPasses();
      hud();
      return { scoreDelta: -45, good:false };
    }

    // trick target acts like bad if not perfect
    if (isFakeGood && !perfect){
      s.junkHits += 1;
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      badFX(x,y,'TRICK!');

      checkPasses();
      hud();
      return { scoreDelta: -30, good:false };
    }

    // powerup
    if (isPower){
      s.score += 95;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+9);
      goodFX(x,y,'POWER +95','power');

      // power -> storm wave guaranteed
      s.stormUntil = now() + 6800;
      setStorm(true, 1.05);

      checkPasses();
      hud();
      return { scoreDelta: +95, good:true };
    }

    // normal good hit
    s.score += 55;
    s.combo += 1;
    s.comboMax = Math.max(s.comboMax, s.combo);

    // water gain depends on zone (helps recover from BLUE/RED)
    if (s.zone === 'LOW') updateWater(+8);
    else if (s.zone === 'HIGH') updateWater(+3);
    else updateWater(+5);

    // streak bonus
    if (s.combo > 0 && (s.combo % 8 === 0)){
      s.score += 80;
      goodFX(x,y,'STREAK +80','good');
      if (!s.stormOn && Math.random() < 0.30){
        s.stormUntil = now() + 6200;
        setStorm(true, 0.95);
      }
    } else {
      goodFX(x,y,'+55','good');
    }

    checkPasses();
    hud();
    return { scoreDelta:+55, good:true };
  }

  // expire callback: let missed GOOD reduce combo a bit (not miss)
  function onExpire(info){
    const type = String(info?.itemType || '');
    if (type === 'good' || type === 'power'){
      s.combo = Math.max(0, s.combo - 1);
    }
    hud();
  }

  // Pass checks (goals/minis)
  function checkPasses(){
    // mini passes (realtime)
    if (!s.miniComboPassed && s.comboMax >= MINI_COMBO_REQ) s.miniComboPassed = true;
    if (!s.miniPerfectPassed && s.perfectHits >= MINI_PERF_REQ) s.miniPerfectPassed = true;
    if (!s.miniNoJunkPassed && s.junkHits <= MINI_NOJUNK_REQ) s.miniNoJunkPassed = true;

    // goals: goal1 green time, goal2 bad time limit (only becomes pass/fail near end but we show status)
    if (!s.goal1Passed && s.greenTick >= GOAL_GREEN_TARGET) s.goal1Passed = true;
    if (!s.goal2Passed && s.badTick <= GOAL_BAD_LIMIT && s.timeLeft <= 0) s.goal2Passed = true;
  }

  // boot mode-factory
  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration,
    spawnHost: '#hvr-playfield',
    pools: { good: GOOD, bad: BAD, trick: ['💧','🫧'] },
    goodRate: diff==='hard' ? 0.58 : (diff==='normal' ? 0.62 : 0.68),
    powerups: POWER,
    powerRate: diff==='hard' ? 0.12 : 0.10,
    powerEvery: 7,
    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff==='hard' ? 0.12 : 0.08,
    spawnIntervalMul: spawnMul,
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end', '#hvr-screen-blink'],
    judge,
    onExpire
  });

  // bind controls
  const unbindDrag = bindViewDragAndShoot(inst);
  const unbindTilt = bindTilt();

  // ✅ zone tick accounting (FIXED)
  function onTime(ev){
    const sec = ev?.detail?.sec;
    if (typeof sec !== 'number') return;
    s.timeLeft = sec;

    // natural drain
    const st = updateWater(-1.4);

    // ✅ Count ticks based on “current zone” returned from updateWater (not stale)
    const z = st.zone; // LOW/GREEN/HIGH
    if (z === 'GREEN') s.greenTick += 1;
    else s.badTick += 1;

    // storm lifecycle
    maybeStormTick();

    // small penalty while in RED(HIGH) to push player back
    if (z === 'HIGH'){
      s.score = Math.max(0, s.score - 3);
    }

    // realtime pass checks (goal2 checks at end)
    if (!s.goal1Passed && s.greenTick >= GOAL_GREEN_TARGET) s.goal1Passed = true;

    // mini3 no-junk updates realtime
    s.miniNoJunkPassed = (s.junkHits <= MINI_NOJUNK_REQ);

    hud();

    if (sec <= 0){
      endGame();
    }
  }
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function buildEndOverlay(){
    // Determine goal2 pass at end
    s.goal2Passed = (s.badTick <= GOAL_BAD_LIMIT);

    const goalsDone = (s.goal1Passed?1:0) + (s.goal2Passed?1:0);
    const minisDone = (s.miniComboPassed?1:0) + (s.miniPerfectPassed?1:0) + (s.miniNoJunkPassed?1:0);

    const g = gradeFrom(s.score);
    const html = `
      <div style="width:min(820px,100%); display:grid; grid-template-columns:1fr; gap:10px;">
        <div style="background:rgba(15,23,42,.74); border:1px solid rgba(148,163,184,.24); border-radius:24px; padding:14px; box-shadow:0 22px 70px rgba(0,0,0,.60);">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <h2 style="margin:0; font-size:18px; font-weight:1000;">🏁 สรุปผลการเล่น</h2>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:rgba(148,163,184,.9); font-weight:900;">Grade</span>
              <span style="font-weight:1000; letter-spacing:.08em;">${g}</span>
            </div>
          </div>

          <div style="margin-top:10px; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px;">
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.22); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px;">Score</div>
              <div style="font-size:20px; font-weight:1000; margin-top:4px;">${s.score|0}</div>
              <div style="margin-top:6px; color:rgba(148,163,184,.85); font-size:12px;">รวมโบนัส PERFECT/STREAK/STORM</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.22); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px;">Combo / Miss</div>
              <div style="font-size:20px; font-weight:1000; margin-top:4px;">${s.comboMax|0} • ${s.miss|0}</div>
              <div style="margin-top:6px; color:rgba(148,163,184,.85); font-size:12px;">คอมโบสูงสุด • miss (junk/trick)</div>
            </div>

            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.22); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px;">Goals</div>
              <div style="font-size:16px; font-weight:1000; margin-top:4px;">${goalsDone}/2</div>
              <div style="margin-top:8px; color:rgba(148,163,184,.9); font-size:12px; line-height:1.35;">
                ⏳ GREEN ${s.greenTick|0}/${GOAL_GREEN_TARGET}s ${s.goal1Passed?'✅':'❌'}<br>
                ⛔ BLUE/RED bad ${s.badTick|0}/${GOAL_BAD_LIMIT}s ${s.goal2Passed?'✅':'❌'}
              </div>
            </div>

            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.22); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px;">Minis</div>
              <div style="font-size:16px; font-weight:1000; margin-top:4px;">${minisDone}/3</div>
              <div style="margin-top:8px; color:rgba(148,163,184,.9); font-size:12px; line-height:1.35;">
                🔥 Combo ${s.comboMax|0}/${MINI_COMBO_REQ} ${s.miniComboPassed?'✅':'❌'}<br>
                🎯 Perfect ${s.perfectHits|0}/${MINI_PERF_REQ} ${s.miniPerfectPassed?'✅':'❌'}<br>
                🛡️ NoJunk ${s.junkHits|0}/${MINI_NOJUNK_REQ} ${s.miniNoJunkPassed?'✅':'❌'}
              </div>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button id="hvr-end-retry" style="pointer-events:auto; border:1px solid rgba(34,197,94,.45); background:rgba(34,197,94,.14); color:#e5e7eb; border-radius:14px; padding:10px 12px; font-weight:900; cursor:pointer;">🔁 เล่นอีกครั้ง</button>
            <button id="hvr-end-hub" style="pointer-events:auto; border:1px solid rgba(148,163,184,.28); background:rgba(2,6,23,.55); color:#e5e7eb; border-radius:14px; padding:10px 12px; font-weight:900; cursor:pointer;">🏠 กลับ Hub</button>
          </div>
        </div>
      </div>
    `;
    endBox.classList.add('on');
    endBox.innerHTML = html;

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

    ROOT.removeEventListener('hha:time', onTime);

    if (unbindDrag) try{ unbindDrag(); }catch{}
    if (unbindTilt) try{ unbindTilt(); }catch{}
    if (unmountBubble) try{ unmountBubble(); }catch{}

    if (fxRaf) try{ ROOT.cancelAnimationFrame(fxRaf); }catch{}
    fxRaf = null;

    setStorm(false, 0);

    try{ Particles.celebrate('END'); }catch{}

    buildEndOverlay();

    // also emit end event for your outer HUD listeners (if any)
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
          badTick: s.badTick|0,
          goalsDone: ((s.goal1Passed?1:0) + (s.goal2Passed?1:0)),
          goalsTotal: 2,
          minisDone: ((s.miniComboPassed?1:0) + (s.miniPerfectPassed?1:0) + (s.miniNoJunkPassed?1:0)),
          minisTotal: 3,
          progPct: clamp((s.score/1500)*100,0,100)|0
        }
      }));
    }catch{}
  }

  // Start: gentle storm chance to keep it exciting after a bit
  ROOT.setTimeout(()=>{
    if (!s.running) return;
    if (!s.stormOn && Math.random() < 0.22){
      s.stormUntil = now() + 5200;
      setStorm(true, 0.80);
    }
  }, 9000);

  // Keep storm “feel” synced with mode-factory host class
  // mode-factory already toggles .hvr-storm-on on host; we also toggle stronger global FX here.
  // When stormOn => add class to host for target sway + visuals
  (function stormClassLoop(){
    if (!s.running) return;
    try{
      if (s.stormOn) playfield.classList.add('hvr-storm-on');
      else playfield.classList.remove('hvr-storm-on');
    }catch{}
    ROOT.setTimeout(stormClassLoop, 180);
  })();

  hud();

  return {
    stop(){ endGame(); },
    shoot(){ try{ inst && inst.shootCrosshair && inst.shootCrosshair(); }catch{} }
  };
}

export default { boot };