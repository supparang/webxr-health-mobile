// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (ROOT html: /herohealth/hydration-vr.html)
//
// ✅ ใช้ mode-factory (DOM target spawner + crosshair shoot + perfect ring)
// ✅ คืน FX: score pop + judgment + burst (Particles)
// ✅ Drag view: เลื่อนจอแล้วเป้าเลื่อนตาม (host transform)
// ✅ PERFECT: ดาวแตกหนัก ๆ + chroma flash + burst
// ✅ Storm: sway แรง/เร็ว + speedlines + wobble + chroma split ต่อเนื่อง
// ✅ Fix zone counting: ใช้ zone จาก ui-water (LOW/GREEN/HIGH) แล้ว map เป็น BLUE/GREEN/RED
// ✅ A2+++ HOTFIX: Mobile HUD ไม่กินทั้งจอ (ทำเป็นแถบเลื่อนแนวนอน) → เป้าไม่หาย/ไม่ “จอดำ”
// ✅ Bubble skin: ใสเกือบไม่เห็น + ขอบรุ้ง thin-film iridescence + reactive shimmer + device-tilt shimmer

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
  // ui-water: LOW / GREEN / HIGH
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

function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    /* =======================
       PLAYFIELD + PARALLAX
    ======================= */
    #hvr-playfield{
      --view-x: 0px;
      --view-y: 0px;
      --tilt-x: 0;
      --tilt-y: 0;
    }
    .hvr-parallax{
      position:absolute;
      inset:-12%;
      pointer-events:none;
      transform: translate3d(calc(var(--view-x) * var(--px, 0.2)), calc(var(--view-y) * var(--py, 0.2)), 0);
      will-change: transform;
      opacity: var(--op, 0.35);
      filter: blur(var(--blur, 0px));
    }
    .hvr-parallax.l1{
      --px: 0.18; --py: 0.14; --op:0.26; --blur:0px;
      background:
        radial-gradient(900px 600px at 20% 15%, rgba(96,165,250,.18), transparent 60%),
        radial-gradient(800px 620px at 80% 20%, rgba(34,197,94,.16), transparent 60%),
        radial-gradient(900px 700px at 50% 70%, rgba(59,130,246,.10), transparent 65%);
      mix-blend-mode: screen;
    }
    .hvr-parallax.l2{
      --px: 0.42; --py: 0.34; --op:0.20; --blur:0.2px;
      background:
        repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,.08) 0 2px, transparent 2px 26px),
        repeating-linear-gradient(45deg, rgba(59,130,246,.06) 0 1px, transparent 1px 18px);
      mix-blend-mode: overlay;
      transform: translate3d(calc(var(--view-x) * var(--px, 0.42)), calc(var(--view-y) * var(--py, 0.34)), 0) rotate(0.0001deg);
    }

    /* =======================
       A2+++ HUD HOTFIX (mobile)
       ทำ HUD เป็นแถบเลื่อนแนวนอน ไม่กินทั้งจอ
    ======================= */
    .hud{
      display:flex;
      flex-wrap:nowrap;
      gap:12px;
      overflow-x:auto;
      overflow-y:hidden;
      -webkit-overflow-scrolling:touch;
      padding-bottom:6px;
      pointer-events:none;
    }
    .hud::-webkit-scrollbar{ height:0; }
    .hud .card,
    .hud .card.small{
      pointer-events:auto;
      flex:0 0 min(86vw, 360px);
      min-width: min(86vw, 360px);
      max-width: min(86vw, 360px);
    }
    @media (min-width: 1100px){
      .hud{ flex-wrap:wrap; overflow:visible; }
      .hud .card{ flex:1 1 260px; min-width:260px; max-width:420px; }
      .hud .card.small{ flex:1 1 220px; min-width:220px; max-width:340px; }
    }

    /* =======================
       POSTFX: chroma + wobble
    ======================= */
    #hvr-wrap.hvr-chroma{
      filter:
        drop-shadow(var(--chromaR, 4.2px) 0 rgba(255, 40, 90, 0.72))
        drop-shadow(var(--chromaB, -2.8px) 0 rgba(0, 205, 255, 0.34))
        drop-shadow(0 0 calc(var(--chromaGlow, 10px)) rgba(120, 255, 220, 0.08));
    }

    #hvr-wrap.hvr-wobble{
      animation: hvrWobble 0.78s ease-in-out infinite;
    }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(0.9px,-0.6px,0) rotate(0.05deg); }
      50%{ transform: translate3d(-1.0px,0.8px,0) rotate(-0.05deg); }
      75%{ transform: translate3d(0.6px,0.9px,0) rotate(0.03deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* Storm speedlines overlay */
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
          rgba(255,80,120,.14) 16px 18px,
          rgba(0,190,255,.11) 18px 20px,
          rgba(255,255,255,.00) 20px 42px
        );
      filter: blur(0.7px) saturate(1.14) contrast(1.10);
      animation: hvrLines 0.26s linear infinite;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-14px, -12px, 0); }
      100%{ transform: translate3d(32px, 28px, 0); }
    }
    .hvr-speedlines.on{ opacity: var(--linesOp, 0.34); }

    /* perfect pulse (short) */
    #hvr-wrap.hvr-perfect-pulse{
      animation: hvrPerfectPulse 170ms ease-out 1;
    }
    @keyframes hvrPerfectPulse{
      0%{ filter: saturate(1) contrast(1); }
      45%{ filter: saturate(1.32) contrast(1.18); }
      100%{ filter: saturate(1) contrast(1); }
    }

    /* =======================
       Bubble Skin (targets)
       ใสเกือบไม่เห็น + ขอบสวย + รุ้งชัดขึ้น
    ======================= */
    .hvr-target.hvr-bubble{
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 999px;
    }
    .hvr-bubble-body{
      position:absolute; inset:0;
      border-radius:999px;
      pointer-events:none;
      opacity: var(--bOp, 0.18);
      background:
        radial-gradient(circle at calc(34% + var(--tilt-x,0)*8%) calc(28% + var(--tilt-y,0)*8%),
          rgba(255,255,255,.70), rgba(255,255,255,.16) 22%, rgba(255,255,255,0) 46%),
        radial-gradient(circle at 60% 72%,
          rgba(120,255,220,.08), rgba(255,120,220,.06) 45%, rgba(0,0,0,0) 70%),
        radial-gradient(circle at 50% 50%,
          rgba(255,255,255,.06), rgba(255,255,255,0) 60%);
      filter: blur(0.0px) saturate(1.05);
    }
    .hvr-bubble-rim{
      position:absolute; inset:-1px;
      border-radius:999px;
      pointer-events:none;
      opacity: var(--rimOp, 0.78);
      background:
        conic-gradient(from calc(90deg + var(--tilt-x,0)*18deg),
          rgba(255,80,170,.00),
          rgba(255,80,170,.75),
          rgba(255,200,80,.65),
          rgba(120,255,160,.70),
          rgba(60,200,255,.78),
          rgba(120,110,255,.70),
          rgba(255,80,170,.75),
          rgba(255,80,170,.00)
        );
      -webkit-mask: radial-gradient(circle, transparent 56%, #000 66%, #000 100%);
      mask: radial-gradient(circle, transparent 56%, #000 66%, #000 100%);
      filter: blur(0.2px) saturate(1.25) contrast(1.08);
      mix-blend-mode: screen;
    }
    .hvr-bubble-edge{
      position:absolute; inset:0;
      border-radius:999px;
      pointer-events:none;
      opacity: 0.55;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.12),
        inset 0 -10px 18px rgba(15,23,42,.16),
        0 12px 26px rgba(2,6,23,.55);
    }
    .hvr-bubble-shimmer{
      position:absolute; inset:-18%;
      border-radius:999px;
      pointer-events:none;
      opacity: var(--shimOp, 0.32);
      background:
        linear-gradient(120deg,
          rgba(255,255,255,0) 0%,
          rgba(255,255,255,.20) 18%,
          rgba(120,255,220,.14) 32%,
          rgba(255,120,220,.12) 44%,
          rgba(255,255,255,0) 62%);
      transform: translate3d(calc(var(--tilt-x,0)*14px), calc(var(--tilt-y,0)*14px), 0) rotate(18deg);
      filter: blur(0.6px);
      mix-blend-mode: screen;
      animation: hvrShimmer 1.25s ease-in-out infinite;
    }
    @keyframes hvrShimmer{
      0%{ transform: translate3d(calc(var(--tilt-x,0)*14px - 8px), calc(var(--tilt-y,0)*14px - 6px), 0) rotate(18deg); opacity:0.16; }
      50%{ transform: translate3d(calc(var(--tilt-x,0)*14px + 10px), calc(var(--tilt-y,0)*14px + 8px), 0) rotate(18deg); opacity:0.36; }
      100%{ transform: translate3d(calc(var(--tilt-x,0)*14px - 8px), calc(var(--tilt-y,0)*14px - 6px), 0) rotate(18deg); opacity:0.16; }
    }

    /* ตอน Storm ให้รุ้งเด้ง + shimmer แรงขึ้น */
    .hvr-storm-on .hvr-bubble-rim{
      opacity: 0.92;
      filter: blur(0.1px) saturate(1.45) contrast(1.14);
      animation: hvrIriShift 0.58s linear infinite;
    }
    @keyframes hvrIriShift{
      0%{ filter: blur(0.1px) saturate(1.45) contrast(1.14) hue-rotate(0deg); }
      100%{ filter: blur(0.1px) saturate(1.45) contrast(1.14) hue-rotate(50deg); }
    }
    .hvr-storm-on .hvr-bubble-shimmer{ opacity: 0.44; }

    /* ปรับ icon ให้เหมือน "ลอยในฟอง" */
    .hvr-target.hvr-bubble .hvr-wiggle span{
      filter: drop-shadow(0 5px 8px rgba(2,6,23,.75)) !important;
    }

    /* bad target โทนร้อนชัด (ยังเล่นง่าย) */
    .hvr-target.hvr-bad{
      box-shadow:
        0 18px 34px rgba(2,6,23,.72),
        0 0 0 2px rgba(255,120,80,.58),
        0 0 26px rgba(255,120,80,.52) !important;
      background:
        radial-gradient(circle at 30% 25%, rgba(255,200,120,.95), rgba(251,146,60,.92) 36%, rgba(234,88,12,.85)) !important;
    }
  `;
  DOC.head.appendChild(s);
}

function ensurePostFXCanvas(){
  const c = $id('hvr-postfx');
  if (!c) return null;
  const ctx = c.getContext('2d');

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
  const n = Math.floor(18 + 18*strength);
  const r0 = 6 + 10*strength;
  const r1 = 40 + 70*strength;
  ctx.save();
  ctx.translate(x,y);
  ctx.globalCompositeOperation = 'screen';

  for (let i=0;i<n;i++){
    const a = (i/n) * Math.PI*2 + (t*0.002);
    const rr = r0 + (r1-r0) * (0.25 + 0.75*Math.random());
    const w = 1 + 2*strength;

    ctx.strokeStyle = `rgba(255, 60, 110, ${0.12 + 0.12*strength})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    ctx.stroke();

    const a2 = a + 0.18;
    ctx.strokeStyle = `rgba(0, 190, 255, ${0.09 + 0.12*strength})`;
    ctx.lineWidth = w*0.85;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a2)*r0, Math.sin(a2)*r0);
    ctx.lineTo(Math.cos(a2)*rr*0.92, Math.sin(a2)*rr*0.92);
    ctx.stroke();
  }

  for (let k=0;k<18;k++){
    const a = Math.random()*Math.PI*2;
    const rr = 10 + Math.random()* (72*strength);
    ctx.fillStyle = `rgba(255,255,255,${0.14 + 0.22*Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.2 + 2.4*Math.random(), 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  const blink = $id('hvr-screen-blink');

  // Build parallax layers
  if (playfield && !playfield.querySelector('.hvr-parallax')){
    const l1 = DOC.createElement('div'); l1.className = 'hvr-parallax l1';
    const l2 = DOC.createElement('div'); l2.className = 'hvr-parallax l2';
    playfield.appendChild(l1);
    playfield.appendChild(l2);
  }

  // speedlines overlay
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  const post = ensurePostFXCanvas();

  // difficulty
  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  // pools
  const GOOD  = ['💧','🧊','🥤','🫧'];       // น้ำ/น้ำแข็ง/ขวด/ฟอง
  const BAD   = ['🍟','🍩','🍕','🍔','🥓']; // junk
  const POWER = ['⭐','⚡','✨'];

  // state
  const s = {
    running: true,
    startedAt: now(),

    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    water: 50,
    zone: 'GREEN',      // LOW/GREEN/HIGH (from ui-water)
    zoneLabel: 'GREEN', // BLUE/GREEN/RED

    greenTick: 0,
    timeLeft: duration,

    viewX: 0,
    viewY: 0,

    // storm
    stormOn: false,
    stormUntil: 0,
    stormStrength: 0, // 0..1.25

    // tilt shimmer
    tiltX: 0,
    tiltY: 0,

    // postfx hits
    sparks: [] // {x,y,t0,str}
  };

  function hud(){
    setText('hha-score-main', s.score|0);
    setText('hha-combo-max', s.comboMax|0);
    setText('hha-miss', s.miss|0);

    // grade
    const g = gradeFrom(s.score);
    const badge = $id('hha-grade-badge');
    if (badge) badge.textContent = g;

    const fill = $id('hha-grade-progress-fill');
    const t = $id('hha-grade-progress-text');
    const pct = clamp((s.score / 1500) * 100, 0, 100); // S ~ 1500
    if (fill) fill.style.width = pct.toFixed(0) + '%';
    if (t) t.textContent = `Progress to S: ${pct.toFixed(0)}%`;

    const qg = $id('hha-quest-goal');
    const qm = $id('hha-quest-mini');
    if (qg) qg.textContent = `Goal: อยู่ GREEN ให้นานที่สุด (ตอนนี้ ${s.greenTick}s)`;
    if (qm) qm.textContent = `Mini: Perfect/Combo ลุ้น Storm Wave!`;
  }

  function applyView(){
    if (!playfield) return;
    playfield.style.setProperty('--view-x', s.viewX + 'px');
    playfield.style.setProperty('--view-y', s.viewY + 'px');
    playfield.style.transform = `translate3d(${s.viewX}px, ${s.viewY}px, 0)`;
  }

  // ✅ drag view + tap shoot (short tap)
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
        s.viewX = clamp(vx0 + dx, -180, 180);
        s.viewY = clamp(vy0 + dy, -140, 140);
        applyView();
      }
    };
    const onUp = (e)=>{
      if (!down) return;
      down = false;
      try{ playfield.releasePointerCapture(pid); }catch{}
      pid = null;

      // short tap => shoot from crosshair
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

  function blinkOn(kind, ms=110){
    if (!blink) return;
    blink.className = '';
    blink.classList.add('on');
    if (kind) blink.classList.add(kind);
    ROOT.setTimeout(()=>{ blink.className=''; }, ms);
  }

  function perfectFX(x,y){
    try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
    try{ Particles.scorePop(x,y,'PERFECT! +','gold'); }catch{}
    blinkOn('perfect', 130);

    if (wrap){
      addClass(wrap,'hvr-perfect-pulse');
      ROOT.setTimeout(()=>removeClass(wrap,'hvr-perfect-pulse'), 220);
    }
    if (post && post.ctx){
      s.sparks.push({ x, y, t0: now(), str: 1.25 });
    }
  }

  function goodFX(x,y, txt='+', kind='good'){
    try{ Particles.burstAt(x,y,kind==='good'?'GOOD':'POWER'); }catch{}
    try{ Particles.scorePop(x,y,txt,kind); }catch{}
    blinkOn('good', 90);
  }

  function badFX(x,y, txt='MISS', kind='bad'){
    try{ Particles.burstAt(x,y,'BAD'); }catch{}
    try{ Particles.scorePop(x,y,txt,'bad'); }catch{}
    blinkOn('bad', 110);
  }

  // Storm controls
  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (wrap){
      if (s.stormOn){
        addClass(wrap,'hvr-chroma');
        addClass(wrap,'hvr-wobble');

        // stronger chroma split per strength
        const sr = 4.2 + 2.8*s.stormStrength;
        const sb = -(2.8 + 2.2*s.stormStrength);
        wrap.style.setProperty('--chromaR', sr.toFixed(2) + 'px');
        wrap.style.setProperty('--chromaB', sb.toFixed(2) + 'px');
        wrap.style.setProperty('--chromaGlow', (10 + 12*s.stormStrength).toFixed(1) + 'px');
        wrap.style.setProperty('--linesOp', (0.28 + 0.14*s.stormStrength).toFixed(2));
      }else{
        removeClass(wrap,'hvr-chroma');
        removeClass(wrap,'hvr-wobble');
        wrap.style.removeProperty('--chromaR');
        wrap.style.removeProperty('--chromaB');
        wrap.style.removeProperty('--chromaGlow');
        wrap.style.removeProperty('--linesOp');
      }
    }
    if (speedLines){
      if (s.stormOn) addClass(speedLines,'on');
      else removeClass(speedLines,'on');
    }
    // ให้ bubble ได้ buff ตอน storm
    if (playfield){
      if (s.stormOn) addClass(playfield,'hvr-storm-on');
      else removeClass(playfield,'hvr-storm-on');
    }
  }

  function maybeStormTick(){
    const t = now();
    if (s.stormOn && t > s.stormUntil){
      setStorm(false, 0);
    }
  }

  // device tilt → update CSS vars for shimmer
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
      if (dt > 520) continue;
      out.push(sp);

      const k = 1 - (dt/520);
      ctx.globalAlpha = 0.58 * k;
      drawStarBurst(ctx, sp.x, sp.y, t, sp.str * (0.75 + 0.55*k));
    }
    s.sparks = out;

    ctx.globalAlpha = 1;
    fxRaf = ROOT.requestAnimationFrame(fxLoop);
  }
  fxRaf = ROOT.requestAnimationFrame(fxLoop);

  // main water update
  function updateWater(delta){
    s.water = clamp(s.water + delta, 0, 100);
    const z = zoneFrom(s.water);     // LOW/GREEN/HIGH
    s.zone = z;
    s.zoneLabel = zoneLabelFrom(z); // BLUE/GREEN/RED

    setWaterGauge(s.water);

    const st = $id('hha-water-status');
    if (st) st.textContent = `${s.zoneLabel} ${Math.round(s.water)}%`;
    const zt = $id('hha-water-zone-text');
    if (zt) zt.textContent = (s.zoneLabel === 'GREEN') ? 'ZONE GREEN' : s.zoneLabel;

    return s.zoneLabel;
  }

  // init
  updateWater(0);
  hud();
  applyView();

  // mode-factory spawn speed mul: storm => faster
  function spawnMul(){
    if (!s.stormOn) return 1.0;
    return clamp(0.70 - 0.22*s.stormStrength, 0.42, 0.75);
  }

  // ===== Bubble decorateTarget (thin-film iridescence) =====
  function decorateTarget(el, parts, data){
    const { wiggle } = parts || {};
    if (!wiggle || !el) return;

    const itemType = String(data?.itemType || '');
    const isBad = (itemType === 'bad');
    const isPower = (itemType === 'power');
    const isFakeGood = (itemType === 'fakeGood');

    // bad = โทนร้อนชัดเพื่อเล่นง่าย
    if (isBad){
      el.classList.add('hvr-bad');
      try{ wiggle.style.pointerEvents = 'none'; }catch{}
      return;
    }

    // bubble for good/power/fakeGood
    el.classList.add('hvr-bubble');

    // ทำให้ icon อยู่ “ในฟอง” และขอบสวย
    try{
      el.style.borderRadius = '999px';
      el.style.overflow = 'visible';
    }catch{}

    const body = DOC.createElement('div');
    body.className = 'hvr-bubble-body';

    const rim = DOC.createElement('div');
    rim.className = 'hvr-bubble-rim';

    const edge = DOC.createElement('div');
    edge.className = 'hvr-bubble-edge';

    const shim = DOC.createElement('div');
    shim.className = 'hvr-bubble-shimmer';

    // โปร่งใส “เกือบไม่เห็น” แต่ขอบสวย
    // power = ขอบเด้งกว่า / fakeGood = รุ้งเด้งแบบหลอกตา
    const rimOp = isPower ? 0.95 : (isFakeGood ? 0.88 : 0.78);
    const bOp   = isPower ? 0.24 : (isFakeGood ? 0.20 : 0.18);
    const shOp  = isPower ? 0.42 : (isFakeGood ? 0.38 : 0.32);

    body.style.setProperty('--bOp', bOp.toFixed(2));
    rim.style.setProperty('--rimOp', rimOp.toFixed(2));
    shim.style.setProperty('--shimOp', shOp.toFixed(2));

    // power เพิ่ม “halo” บาง ๆ
    if (isPower){
      edge.style.boxShadow =
        'inset 0 0 0 1px rgba(255,255,255,.16), inset 0 -10px 18px rgba(15,23,42,.12), 0 0 26px rgba(255,220,120,.26), 0 12px 26px rgba(2,6,23,.55)';
    }

    // ใส่ layer ไว้ “ใต้” ring/inner
    try{
      wiggle.insertBefore(edge, wiggle.firstChild);
      wiggle.insertBefore(body, wiggle.firstChild);
      wiggle.insertBefore(rim,  wiggle.firstChild);
      wiggle.insertBefore(shim, wiggle.firstChild);
    }catch{}
  }

  // judge callback from mode-factory
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
      badFX(x,y,'MISS','bad');

      if (!s.stormOn && Math.random() < 0.18){
        s.stormUntil = now() + 5200;
        setStorm(true, 0.95);
      }

      hud();
      return { scoreDelta: -45, good:false };
    }

    // fakeGood acts like bad when not perfect
    if (isFakeGood && !perfect){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      badFX(x,y,'TRICK!','bad');
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

      s.stormUntil = now() + 6800;
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

    if (s.combo > 0 && (s.combo % 8 === 0)){
      s.score += 80;
      goodFX(x,y,`STREAK +80`,'good');

      if (!s.stormOn && Math.random() < 0.32){
        s.stormUntil = now() + 6200;
        setStorm(true, 1.00);
      }
    } else {
      goodFX(x,y,'+55','good');
    }

    hud();
    return { scoreDelta: +55, good:true };
  }

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
    spawnHost: '#hvr-playfield',
    boundsHost: '#hvr-playfield', // ชัดเจน (กัน host เพี้ยน)
    pools: { good: GOOD, bad: BAD, trick: ['💧','🫧'] },
    goodRate: diff === 'hard' ? 0.58 : (diff === 'normal' ? 0.62 : 0.68),
    powerups: POWER,
    powerRate: diff === 'hard' ? 0.12 : 0.10,
    powerEvery: 7,
    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff === 'hard' ? 0.12 : 0.08,
    spawnIntervalMul: spawnMul,
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

    updateWater(-1.4);

    if (s.zone === 'GREEN') s.greenTick += 1;

    maybeStormTick();

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
            <button id="hvr-end-retry" class="btn primary" style="pointer-events:auto;">🔁 เล่นอีกครั้ง</button>
            <button id="hvr-end-hub" class="btn" style="pointer-events:auto;">🏠 กลับ Hub</button>
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

  hud();

  return {
    stop(){ endGame(); },
    shoot(){ try{ inst && inst.shootCrosshair && inst.shootCrosshair(); }catch{} }
  };
}

export default { boot };