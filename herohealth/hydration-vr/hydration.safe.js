// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (Hard fix: mobile black screen / no targets)
//
// ✅ Wait for playfield rect > 0 before boot mode-factory (mobile viewport settle)
// ✅ Force playfield fullscreen (100svh) even if HTML uses absolute
// ✅ Bubble target skin (soap bubble): almost transparent body + strong rainbow rim
// ✅ Device-tilt shimmer (reactive)
// ✅ PERFECT: heavy star burst + particles + blink
// ✅ Storm: strong chroma split (red edge) + wobble + speedlines + target sway faster
// ✅ Zone counting fix: LOW/GREEN/HIGH -> BLUE/GREEN/RED (count uses latest zone)
//
// Depends:
//   /herohealth/vr/mode-factory.js
//   /herohealth/vr/ui-water.js
//   /herohealth/vr/particles.js (IIFE)

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
function addClass(el, c){ try{ el && el.classList.add(c); }catch{} }
function removeClass(el, c){ try{ el && el.classList.remove(c); }catch{} }
function setText(id, txt){ const el=$id(id); if(el) el.textContent=String(txt); }

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

function ensureBaseLock(){
  if (!DOC) return;
  try{
    DOC.documentElement.style.height = '100%';
    DOC.body.style.height = '100%';
    DOC.body.style.margin = '0';
    DOC.body.style.overflow = 'hidden';
    DOC.body.style.background = DOC.body.style.background || '#020617';
  }catch{}
}

function forceFullscreenPlayfield(playfield, wrap){
  if (!playfield) return;
  try{
    if (wrap){
      wrap.style.position = 'fixed';
      wrap.style.inset = '0';
      wrap.style.overflow = 'hidden';
      wrap.style.touchAction = 'none';
    }
    Object.assign(playfield.style, {
      position: 'fixed',     // key fix (override absolute)
      inset: '0',
      width: '100vw',
      height: '100vh',
      minWidth: '100vw',
      minHeight: '100vh',
      zIndex: '10',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      background: 'transparent',
      transform: playfield.style.transform || 'translate3d(0,0,0)'
    });
    // better on mobile
    playfield.style.height = '100svh';
    playfield.style.minHeight = '100svh';
  }catch{}
}

async function waitForPlayfieldReady(playfield, wrap, errBox){
  const minW = 120, minH = 120;
  for (let i=0;i<50;i++){
    forceFullscreenPlayfield(playfield, wrap);
    const r = playfield.getBoundingClientRect();
    if (r.width >= minW && r.height >= minH) return r;

    // mobile address bar settle
    await new Promise(res=>ROOT.setTimeout(res, (i<10?40:60)));
  }
  const r = playfield.getBoundingClientRect();
  if (errBox){
    errBox.classList.add('on');
    errBox.textContent =
      `❌ Playfield size not ready\n`+
      `rect: ${Math.round(r.width)}x${Math.round(r.height)}\n`+
      `Try: hard refresh / check CSS overflow / viewport meta.\n`;
  }
  return r;
}

function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    #hvr-playfield{ --view-x:0px; --view-y:0px; --tilt-x:0; --tilt-y:0; }

    /* parallax */
    .hvr-parallax{
      position:absolute; inset:-14%;
      pointer-events:none;
      transform: translate3d(calc(var(--view-x) * var(--px,0.2)), calc(var(--view-y) * var(--py,0.2)), 0);
      will-change: transform;
      opacity: var(--op,0.30);
      filter: blur(var(--blur,0px)) saturate(1.05) contrast(1.05);
    }
    .hvr-parallax.l1{
      --px:0.16; --py:0.12; --op:0.28; --blur:0px;
      background:
        radial-gradient(920px 640px at 20% 18%, rgba(96,165,250,.20), transparent 60%),
        radial-gradient(840px 660px at 80% 20%, rgba(34,197,94,.18), transparent 60%),
        radial-gradient(980px 760px at 50% 78%, rgba(59,130,246,.10), transparent 66%);
      mix-blend-mode: screen;
    }
    .hvr-parallax.l2{
      --px:0.44; --py:0.36; --op:0.18; --blur:0.25px;
      background:
        repeating-radial-gradient(circle at 32% 42%, rgba(255,255,255,.085) 0 2px, transparent 2px 28px),
        repeating-linear-gradient(45deg, rgba(59,130,246,.060) 0 1px, transparent 1px 20px);
      mix-blend-mode: overlay;
    }

    /* strong chroma (red edge) */
    #hvr-wrap.hvr-chroma-strong{
      filter:
        drop-shadow(5.0px 0 rgba(255, 40, 80, 0.78))
        drop-shadow(-3.2px 0 rgba(0, 205, 255, 0.36))
        drop-shadow(0 0 12px rgba(255,255,255,0.06));
    }

    /* wobble */
    #hvr-wrap.hvr-wobble{ animation:hvrWobble 0.95s ease-in-out infinite; will-change:transform,filter; }
    @keyframes hvrWobble{
      0%{transform:translate3d(0,0,0) rotate(0deg)}
      20%{transform:translate3d(.9px,-.6px,0) rotate(.05deg)}
      50%{transform:translate3d(-1.0px,.8px,0) rotate(-.05deg)}
      80%{transform:translate3d(.7px,.9px,0) rotate(.03deg)}
      100%{transform:translate3d(0,0,0) rotate(0deg)}
    }

    /* speedlines */
    .hvr-speedlines{
      position:fixed; inset:-22%;
      pointer-events:none;
      z-index:99960;
      opacity:0;
      mix-blend-mode:screen;
      background:
        repeating-linear-gradient(110deg,
          rgba(255,255,255,0) 0 14px,
          rgba(255,80,120,.14) 14px 16px,
          rgba(0,205,255,.10) 16px 18px,
          rgba(255,255,255,0) 18px 40px
        );
      filter:blur(.65px) saturate(1.12) contrast(1.10);
      animation:hvrLines .28s linear infinite;
      transform:translate3d(0,0,0);
      will-change:transform,opacity;
    }
    @keyframes hvrLines{ 0%{transform:translate3d(-12px,-12px,0)} 100%{transform:translate3d(32px,26px,0)} }
    .hvr-speedlines.on{ opacity:.34; }

    /* ===== Bubble target skin (support many target classes) ===== */
    .hvr-target, .hha-target, .hha-dom-target, .hha-tgt, .target, [data-hha-target]{
      border-radius:999px !important;
      background:transparent !important;
      box-shadow:none !important;
      overflow:visible !important;
      isolation:isolate;
      will-change:transform;
      opacity:1 !important;
      display:block !important;
      pointer-events:auto !important;
      z-index:30 !important;
    }

    .hvr-bubble{
      position:absolute; inset:0;
      border-radius:999px;
      background:
        radial-gradient(circle at 30% 25%,
          rgba(255,255,255,.08),
          rgba(255,255,255,.02) 34%,
          rgba(255,255,255,.01) 55%,
          rgba(255,255,255,0) 70%),
        radial-gradient(circle at 50% 60%,
          rgba(120,180,255,.04),
          rgba(255,255,255,0) 62%);
      backdrop-filter: blur(.6px);
      -webkit-backdrop-filter: blur(.6px);
      opacity:.92;
      pointer-events:none;
    }

    .hvr-film{
      position:absolute; inset:-2px;
      border-radius:999px;
      background:
        conic-gradient(from calc(120deg + (var(--tilt-x) * 18deg) + (var(--tilt-y) * 10deg)),
          rgba(255,60,120,0),
          rgba(255,60,120,.46),
          rgba(0,205,255,.46),
          rgba(140,255,160,.36),
          rgba(255,230,120,.40),
          rgba(170,120,255,.40),
          rgba(255,60,120,.44),
          rgba(255,60,120,0)
        );
      filter: blur(.32px) saturate(1.35) contrast(1.16);
      opacity:.70; /* rainbow rim stronger */
      mix-blend-mode:screen;
      pointer-events:none;
      mask: radial-gradient(circle at center, transparent 66%, #000 70%);
      -webkit-mask: radial-gradient(circle at center, transparent 66%, #000 70%);
    }

    .hvr-rim{
      position:absolute; inset:0;
      border-radius:999px;
      box-shadow:
        0 0 0 1px rgba(255,255,255,.14),
        0 0 18px rgba(255,255,255,.08),
        0 0 28px rgba(0,205,255,.12),
        0 0 28px rgba(255,60,120,.12);
      opacity:.72;
      pointer-events:none;
    }

    .hvr-shimmer{
      position:absolute; inset:-8%;
      border-radius:999px;
      background:
        radial-gradient(140px 90px at calc(50% + (var(--tilt-x) * 30%)) calc(40% + (var(--tilt-y) * 22%)),
          rgba(255,255,255,.18),
          rgba(255,255,255,.02) 55%,
          rgba(255,255,255,0) 72%);
      mix-blend-mode:screen;
      opacity:.46;
      filter: blur(.2px);
      pointer-events:none;
      animation:hvrShimmer 1.35s ease-in-out infinite;
    }
    @keyframes hvrShimmer{
      0%{ transform:translate3d(-1px,-1px,0) rotate(-.05deg); opacity:.36; }
      50%{ transform:translate3d( 1px, 1px,0) rotate( .05deg); opacity:.54; }
      100%{ transform:translate3d(-1px,-1px,0) rotate(-.05deg); opacity:.36; }
    }

    .hvr-icon{
      position:absolute;
      left:50%; top:50%;
      transform: translate(-50%,-50%) scale(.98);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,.55));
      opacity:.90;
      pointer-events:none;
      user-select:none; -webkit-user-select:none;
    }

    .hvr-perfect-ring{
      position:absolute; left:50%; top:50%;
      transform: translate(-50%,-50%);
      border-radius:999px;
      border:2px solid rgba(255,255,255,.40);
      box-shadow:
        0 0 10px rgba(255,255,255,.18),
        0 0 18px rgba(255,60,120,.16),
        0 0 18px rgba(0,205,255,.12);
      opacity:.75;
      width:36%; height:36%;
      pointer-events:none;
    }

    .hvr-float{ animation:hvrFloat 1.65s ease-in-out infinite; }
    @keyframes hvrFloat{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      35%{ transform: translate3d(1.6px,-1.2px,0) rotate(.10deg); }
      70%{ transform: translate3d(-1.4px,1.8px,0) rotate(-.10deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }
    .hvr-storm-on .hvr-float{ animation:hvrFloatStorm .85s ease-in-out infinite; }
    @keyframes hvrFloatStorm{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(3.0px,-2.3px,0) rotate(.22deg); }
      50%{ transform: translate3d(-3.2px,2.6px,0) rotate(-.22deg); }
      75%{ transform: translate3d(2.4px,3.0px,0) rotate(.16deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }
  `;
  DOC.head.appendChild(s);
}

function ensurePostFXCanvas(){
  if (!DOC) return null;
  const c = $id('hvr-postfx');
  if (!c) return null;
  const ctx = c.getContext('2d');

  function resize(){
    const dpr = Math.max(1, Math.min(2, ROOT.devicePixelRatio || 1));
    c.width  = Math.floor((ROOT.innerWidth||1) * dpr);
    c.height = Math.floor((ROOT.innerHeight||1) * dpr);
    Object.assign(c.style, {
      position:'fixed', inset:'0', width:'100%', height:'100%',
      pointerEvents:'none', zIndex:'60'
    });
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

// Apply bubble skin to targets created by mode-factory (supports multiple class names)
function isLikelyTarget(el){
  if (!el || el.nodeType !== 1) return false;
  const c = el.classList;
  if (!c) return false;
  if (c.contains('hvr-target') || c.contains('hha-target') || c.contains('hha-dom-target') || c.contains('hha-tgt')) return true;
  if (c.contains('target')) return true;
  if (el.hasAttribute && el.hasAttribute('data-hha-target')) return true;
  return false;
}

function mountBubbleSkin(host){
  if (!DOC || !host) return ()=>{};
  const apply = (el)=>{
    if (!el || !el.isConnected) return;
    if (el.__hvrBubbleApplied) return;
    el.__hvrBubbleApplied = true;

    // make sure target is visible
    try{
      el.style.opacity = '1';
      el.style.display = 'block';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '30';
    }catch{}

    // icon: find span/img (emoji or image)
    let icon = null;
    try{
      icon = el.querySelector('span, img, .emoji, .icon');
    }catch{}
    if (icon){
      try{
        icon.classList.add('hvr-icon');
        // if it's span emoji, center it
        if (icon.tagName === 'SPAN'){
          icon.style.position = 'absolute';
          icon.style.left = '50%';
          icon.style.top = '50%';
          icon.style.transform = 'translate(-50%,-50%) scale(.98)';
        }
      }catch{}
    }

    // layers
    const bubble = DOC.createElement('div'); bubble.className = 'hvr-bubble';
    const film   = DOC.createElement('div'); film.className   = 'hvr-film';
    const rim    = DOC.createElement('div'); rim.className    = 'hvr-rim';
    const shim   = DOC.createElement('div'); shim.className   = 'hvr-shimmer';
    const pr     = DOC.createElement('div'); pr.className     = 'hvr-perfect-ring';

    el.appendChild(bubble);
    el.appendChild(film);
    el.appendChild(rim);
    el.appendChild(shim);
    el.appendChild(pr);

    addClass(el, 'hvr-float');
  };

  // initial scan
  try{
    host.querySelectorAll('.hvr-target,.hha-target,.hha-dom-target,.hha-tgt,.target,[data-hha-target]').forEach(apply);
  }catch{}

  const mo = new MutationObserver((muts)=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        if (!n || n.nodeType !== 1) continue;
        if (isLikelyTarget(n)) apply(n);
        else{
          try{
            n.querySelectorAll && n.querySelectorAll('.hvr-target,.hha-target,.hha-dom-target,.hha-tgt,.target,[data-hha-target]').forEach(apply);
          }catch{}
        }
      }
    }
  });
  try{ mo.observe(host, { childList:true, subtree:true }); }catch{}
  return ()=>{ try{ mo.disconnect(); }catch{} };
}

function blinkOn(blink, kind, ms=110){
  if (!blink) return;
  blink.className = '';
  blink.classList.add('on');
  if (kind) blink.classList.add(kind);
  ROOT.setTimeout(()=>{ blink.className=''; }, ms);
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureBaseLock();
  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap      = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  const blink     = $id('hvr-screen-blink');
  const errBox    = $id('hvr-error');

  if (!wrap || !playfield){
    if (errBox){
      errBox.classList.add('on');
      errBox.textContent = '❌ Missing #hvr-wrap or #hvr-playfield';
    }
    return { stop(){} };
  }

  // force fullscreen + wait for real rect
  forceFullscreenPlayfield(playfield, wrap);
  await waitForPlayfieldReady(playfield, wrap, errBox);

  // parallax layers
  if (!playfield.querySelector('.hvr-parallax')){
    const l1 = DOC.createElement('div'); l1.className='hvr-parallax l1';
    const l2 = DOC.createElement('div'); l2.className='hvr-parallax l2';
    playfield.appendChild(l1); playfield.appendChild(l2);
  }

  // speedlines
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  const post = ensurePostFXCanvas();
  const unmountBubble = mountBubbleSkin(playfield);

  // difficulty
  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  const GOOD  = ['💧','🧊','🫧','🥤'];
  const BAD   = ['🍟','🍩','🍕','🧋'];
  const POWER = ['⭐','⚡','✨'];

  const s = {
    running:true,
    score:0,
    combo:0,
    comboMax:0,
    miss:0,

    water:50,
    zone:'GREEN',
    zoneLabel:'GREEN',

    greenTick:0,
    badTick:0,
    timeLeft:duration,

    viewX:0, viewY:0,

    stormOn:false,
    stormUntil:0,
    stormStrength:0,

    sparks:[]
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
    if (qg) qg.textContent = `Goal: ⏳ อยู่ GREEN ≥ 16s (ตอนนี้ ${s.greenTick}/16) • ⛔ อยู่ BLUE/RED รวมไม่เกิน 32s (bad ${s.badTick}/32)`;
    if (qm) qm.textContent = `Mini: ✅ Combo Max ${s.comboMax}/8 • ✅ Perfect • ✅ NoJunk`;
  }

  function applyView(){
    playfield.style.setProperty('--view-x', s.viewX + 'px');
    playfield.style.setProperty('--view-y', s.viewY + 'px');
    playfield.style.transform = `translate3d(${s.viewX}px, ${s.viewY}px, 0)`;
  }

  function updateWater(delta){
    s.water = clamp(s.water + delta, 0, 100);
    const z = zoneFrom(s.water);
    s.zone = z;
    s.zoneLabel = zoneLabelFrom(z);

    setWaterGauge(s.water);

    const st = $id('hha-water-status');
    if (st) st.textContent = `${s.zoneLabel} ${Math.round(s.water)}%`;
    const zt = $id('hha-water-zone-text');
    if (zt) zt.textContent = `ZONE ${s.zoneLabel}`;

    return { zone:z, label:s.zoneLabel };
  }

  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (s.stormOn){
      addClass(wrap,'hvr-chroma-strong');
      addClass(wrap,'hvr-wobble');
      addClass(speedLines,'on');
      addClass(playfield,'hvr-storm-on');
    }else{
      removeClass(wrap,'hvr-chroma-strong');
      removeClass(wrap,'hvr-wobble');
      removeClass(speedLines,'on');
      removeClass(playfield,'hvr-storm-on');
    }
  }
  function maybeStormTick(){
    const t = now();
    if (s.stormOn && t > s.stormUntil) setStorm(false, 0);
  }

  // tilt shimmer
  const onOri = (e)=>{
    const gx = clamp((e.gamma||0)/30, -1, 1);
    const gy = clamp((e.beta||0)/40, -1, 1);
    playfield.style.setProperty('--tilt-x', gx.toFixed(3));
    playfield.style.setProperty('--tilt-y', gy.toFixed(3));
  };
  ROOT.addEventListener('deviceorientation', onOri, { passive:true });

  // post fx loop
  let fxRaf = null;
  function fxLoop(){
    if (!post || !post.ctx) return;
    const ctx = post.ctx;
    const t = now();
    ctx.clearRect(0,0,ROOT.innerWidth||1,ROOT.innerHeight||1);

    const out=[];
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

  function spawnMul(){
    if (!s.stormOn) return 1.0;
    return clamp(0.72 - 0.26*s.stormStrength, 0.42, 0.78);
  }

  function perfectFX(x,y){
    try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
    try{ Particles.scorePop(x,y,'PERFECT! +','gold'); }catch{}
    blinkOn(blink,'perfect',130);
    if (post && post.ctx) s.sparks.push({ x, y, t0: now(), str: 1.35 });
  }
  function goodFX(x,y,txt='+55',kind='good'){
    try{ Particles.burstAt(x,y,kind==='power'?'POWER':'GOOD'); }catch{}
    try{ Particles.scorePop(x,y,txt,kind); }catch{}
    blinkOn(blink,'good',90);
  }
  function badFX(x,y,txt='MISS'){
    try{ Particles.burstAt(x,y,'BAD'); }catch{}
    try{ Particles.scorePop(x,y,txt,'bad'); }catch{}
    blinkOn(blink,'bad',120);
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

      if (!s.stormOn && Math.random() < 0.18){
        s.stormUntil = now() + 5200;
        setStorm(true, 0.90);
      }
      hud();
      return { scoreDelta:-45, good:false };
    }

    if (isFakeGood && !perfect){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      badFX(x,y,'TRICK!');
      hud();
      return { scoreDelta:-30, good:false };
    }

    if (isPower){
      s.score += 95;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+9);
      goodFX(x,y,'POWER +95','power');

      s.stormUntil = now() + 6800;
      setStorm(true, 1.05);

      hud();
      return { scoreDelta:+95, good:true };
    }

    // normal good
    s.score += 55;
    s.combo += 1;
    s.comboMax = Math.max(s.comboMax, s.combo);

    if (s.zone === 'LOW') updateWater(+8);
    else if (s.zone === 'HIGH') updateWater(+3);
    else updateWater(+5);

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

    hud();
    return { scoreDelta:+55, good:true };
  }

  function onExpire(info){
    const itemType = String(info?.itemType||'');
    if (itemType === 'good' || itemType === 'power'){
      s.combo = Math.max(0, s.combo - 1);
    }
    hud();
  }

  // init
  updateWater(0);
  hud();
  applyView();

  // boot mode-factory (AFTER playfield rect is ready)
  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration,
    spawnHost: '#hvr-playfield',
    pools: { good: GOOD, bad: BAD, trick: ['💧','🫧'] },
    goodRate: diff === 'hard' ? 0.58 : (diff === 'normal' ? 0.62 : 0.68),
    powerups: POWER,
    powerRate: diff === 'hard' ? 0.12 : 0.10,
    powerEvery: 7,
    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff === 'hard' ? 0.12 : 0.08,
    spawnIntervalMul: spawnMul,
    excludeSelectors: ['.hud', '#hvr-end', '#hvr-screen-blink', '#hvr-postfx', '#hvr-error'],
    judge,
    onExpire
  });

  // drag view + tap shoot
  let down=false, moved=false, sx=0, sy=0, vx0=0, vy0=0, pid=null;
  const TH=6;

  const onDown2=(e)=>{
    if (!s.running) return;
    down=true; moved=false;
    pid=e.pointerId;
    try{ playfield.setPointerCapture(pid); }catch{}
    sx=e.clientX; sy=e.clientY;
    vx0=s.viewX; vy0=s.viewY;
  };
  const onMove2=(e)=>{
    if (!down || !s.running) return;
    const dx=e.clientX-sx;
    const dy=e.clientY-sy;
    if (!moved && (Math.abs(dx)+Math.abs(dy) > TH)) moved=true;
    if (moved){
      s.viewX = clamp(vx0 + dx, -180, 180);
      s.viewY = clamp(vy0 + dy, -140, 140);
      applyView();
    }
  };
  const onUp2=()=>{
    if (!down) return;
    down=false;
    try{ playfield.releasePointerCapture(pid); }catch{}
    pid=null;
    if (!moved && inst && typeof inst.shootCrosshair === 'function'){
      inst.shootCrosshair();
    }
  };

  playfield.addEventListener('pointerdown', onDown2, { passive:true });
  playfield.addEventListener('pointermove', onMove2, { passive:true });
  playfield.addEventListener('pointerup', onUp2, { passive:true });
  playfield.addEventListener('pointercancel', onUp2, { passive:true });

  // time tick
  function onTime(ev){
    const sec = ev?.detail?.sec;
    if (typeof sec !== 'number') return;
    s.timeLeft = sec;

    // drain + get latest zone NOW
    const st = updateWater(-1.4);

    // ✅ count uses latest zone (fix mismatch)
    if (st.zone === 'GREEN') s.greenTick += 1;
    else s.badTick += 1;

    maybeStormTick();

    if (st.zone === 'HIGH'){
      s.score = Math.max(0, s.score - 3);
    }

    hud();
    if (sec <= 0) endGame();
  }
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function endGame(){
    if (!s.running) return;
    s.running = false;

    try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
    try{ inst && inst.stop && inst.stop(); }catch{}

    ROOT.removeEventListener('hha:time', onTime);
    ROOT.removeEventListener('deviceorientation', onOri);

    playfield.removeEventListener('pointerdown', onDown2);
    playfield.removeEventListener('pointermove', onMove2);
    playfield.removeEventListener('pointerup', onUp2);
    playfield.removeEventListener('pointercancel', onUp2);

    if (unmountBubble) try{ unmountBubble(); }catch{}

    if (fxRaf) try{ ROOT.cancelAnimationFrame(fxRaf); }catch{}
    fxRaf = null;

    setStorm(false, 0);
    try{ Particles.celebrate('END'); }catch{}
  }

  return {
    stop(){ endGame(); },
    shoot(){ try{ inst && inst.shootCrosshair && inst.shootCrosshair(); }catch{} }
  };
}

export default { boot };