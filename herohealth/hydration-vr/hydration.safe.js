// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION (Self-contained spawner)
//
// ✅ เป้าขึ้นแน่นอน (ไม่พึ่ง mode-factory)
// ✅ เป้าเป็น “ฟองสบู่จริง” ใสเกือบไม่เห็น + ขอบรุ้ง iridescence ชัด + shimmer ตาม device-tilt
// ✅ bubble 2 ชั้น + perfect ring
// ✅ PERFECT: ดาวแตกหนัก ๆ + canvas starburst + chroma pulse + score/judge + shard mix
// ✅ Storm Wave: ส่ายแรง/เร็วขึ้น + speedlines + wobble ต่อเนื่อง + chroma split “ขอบแดงแรงขึ้น”
// ✅ Drag view: เลื่อนจอแล้วเป้าเลื่อนตาม (host transform) + tap = ยิงกลางจอ (crosshair)
// ✅ Fix zone counting: ใช้ zoneFrom (LOW/GREEN/HIGH) map เป็น BLUE/GREEN/RED
//
// Requires:
// - /herohealth/vr/ui-water.js  (module)
// - /herohealth/vr/particles.js (IIFE)  -> window.Particles or window.GAME_MODULES.Particles
//
// HTML should have:
// - #hvr-wrap, #hvr-playfield, #hvr-postfx, #hvr-screen-blink, #hvr-crosshair (recommended)

'use strict';

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
function setText(id, txt){ const el=$id(id); if (el) el.textContent = String(txt); }
function addClass(el,c){ try{ el && el.classList.add(c);}catch{} }
function removeClass(el,c){ try{ el && el.classList.remove(c);}catch{} }

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

// --- tiny synth (no external files) ---
function makeSfx(){
  let ac = null;
  function ctx(){
    if (!ac){
      const A = ROOT.AudioContext || ROOT.webkitAudioContext;
      if (!A) return null;
      ac = new A();
    }
    return ac;
  }
  function beep(freq=880, dur=0.06, type='triangle', gain=0.04){
    const c = ctx(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.01);
  }
  function tick(){
    beep(1200, 0.03, 'square', 0.018);
  }
  function hitGood(){
    beep(740, 0.05, 'triangle', 0.035);
  }
  function hitBad(){
    beep(220, 0.08, 'sawtooth', 0.030);
  }
  function hitPerfect(){
    beep(1200, 0.05, 'triangle', 0.045);
    ROOT.setTimeout(()=>beep(1800, 0.06, 'triangle', 0.035), 30);
  }
  return { tick, hitGood, hitBad, hitPerfect };
}

function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    /* 2-layer parallax */
    #hvr-playfield{ --view-x:0px; --view-y:0px; --tilt-x:0; --tilt-y:0; }
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
      --px:.18; --py:.14; --op:.28; --blur:0px;
      background:
        radial-gradient(1000px 700px at 18% 20%, rgba(96,165,250,.18), transparent 60%),
        radial-gradient(900px 700px at 82% 26%, rgba(34,197,94,.14), transparent 62%),
        radial-gradient(1100px 900px at 50% 92%, rgba(99,102,241,.10), transparent 70%);
      mix-blend-mode: screen;
    }
    .hvr-parallax.l2{
      --px:.42; --py:.34; --op:.22; --blur:.3px;
      background:
        repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,.07) 0 2px, transparent 2px 26px),
        repeating-linear-gradient(45deg, rgba(59,130,246,.07) 0 1px, transparent 1px 18px);
      mix-blend-mode: overlay;
      transform: translate3d(calc(var(--view-x) * var(--px, .42)), calc(var(--view-y) * var(--py, .34)), 0) rotate(0.0001deg);
    }

    /* Storm chroma/wobble (แดงแรงขึ้น) */
    #hvr-wrap.hvr-chroma{
      filter:
        drop-shadow(4.2px 0 rgba(255, 40, 80, 0.70))
        drop-shadow(-2.4px 0 rgba(0, 190, 255, 0.25))
        saturate(1.03);
    }
    #hvr-wrap.hvr-wobble{
      animation: hvrWobble 0.92s ease-in-out infinite;
    }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(0.9px,-0.7px,0) rotate(0.05deg); }
      50%{ transform: translate3d(-1.1px,0.9px,0) rotate(-0.05deg); }
      75%{ transform: translate3d(0.7px,1.0px,0) rotate(0.04deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    /* Speedlines overlay (storm) */
    .hvr-speedlines{
      position:fixed;
      inset:-20%;
      pointer-events:none;
      z-index:99960;
      opacity:0;
      mix-blend-mode: screen;
      background:
        repeating-linear-gradient(112deg,
          rgba(255,255,255,0) 0 14px,
          rgba(255,80,120,.14) 14px 16px,
          rgba(0,190,255,.10) 16px 18px,
          rgba(255,255,255,0) 18px 40px
        );
      filter: blur(.6px) saturate(1.10) contrast(1.08);
      animation: hvrLines .26s linear infinite;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-18px,-14px,0); }
      100%{ transform: translate3d(34px,26px,0); }
    }
    .hvr-speedlines.on{ opacity:.36; }

    /* perfect pulse */
    #hvr-wrap.hvr-perfect-pulse{
      animation: hvrPerfectPulse 180ms ease-out 1;
    }
    @keyframes hvrPerfectPulse{
      0%{ filter: saturate(1) contrast(1); }
      45%{ filter: saturate(1.28) contrast(1.14); }
      100%{ filter: saturate(1) contrast(1); }
    }

    /* ===== Bubble target (ฟองสบู่ใส + ขอบรุ้ง) ===== */
    .hvr-target{
      position:absolute;
      width:84px;
      height:84px;
      border-radius:999px;
      transform: translate3d(0,0,0);
      will-change: transform, filter;
      pointer-events:auto;
      user-select:none;
      -webkit-user-select:none;
      -webkit-tap-highlight-color: transparent;
      background: rgba(255,255,255,.02); /* ใสเกือบไม่เห็น */
      box-shadow:
        0 10px 26px rgba(0,0,0,.28),
        0 0 0 1px rgba(255,255,255,.06) inset;
      overflow:hidden;
    }

    /* bubble layer 1: thin-film rim (rainbow) */
    .hvr-target::before{
      content:"";
      position:absolute;
      inset:-10%;
      border-radius:999px;
      background:
        radial-gradient(circle at 30% 28%, rgba(255,255,255,.26), rgba(255,255,255,0) 36%),
        conic-gradient(from calc(200deg + (var(--tilt-x) * 26deg)),
          rgba(255, 60, 120, .38),
          rgba(255, 180, 80, .30),
          rgba(120, 255, 180, .28),
          rgba(70, 190, 255, .34),
          rgba(170, 120, 255, .36),
          rgba(255, 60, 120, .38)
        );
      filter: blur(.2px) saturate(1.18);
      mix-blend-mode: screen;
      opacity: .86;
      transform: rotate(calc(var(--iri-r, 0deg) + (var(--tilt-y) * 8deg)));
    }

    /* bubble layer 2: inner glass + reactive shimmer */
    .hvr-target::after{
      content:"";
      position:absolute;
      inset:10%;
      border-radius:999px;
      background:
        radial-gradient(circle at calc(50% + (var(--tilt-x) * 18%)) calc(38% + (var(--tilt-y) * 10%)),
          rgba(255,255,255,.18),
          rgba(255,255,255,0) 55%),
        radial-gradient(circle at 65% 72%,
          rgba(70,190,255,.10),
          rgba(255,60,120,.08),
          rgba(255,255,255,0) 62%);
      opacity:.95;
      mix-blend-mode: screen;
      filter: blur(.2px) saturate(1.12);
      transform: translate3d(calc(var(--shim-x, 0px)), calc(var(--shim-y, 0px)), 0);
    }

    .hvr-target .emoji{
      position:absolute;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:32px;
      filter: drop-shadow(0 10px 16px rgba(0,0,0,.26));
      transform: translate3d(0,0,0);
    }

    /* perfect ring (always animating per target life) */
    .hvr-target .ring{
      position:absolute;
      left:50%;
      top:50%;
      width:110%;
      height:110%;
      border-radius:999px;
      transform: translate(-50%,-50%) scale(1.12);
      border: 2px solid rgba(255,255,255,.32);
      box-shadow:
        0 0 0 1px rgba(255,40,80,.18) inset,
        0 0 18px rgba(255,255,255,.16);
      opacity:.70;
      mix-blend-mode: screen;
      pointer-events:none;
    }

    .hvr-target.bad{ filter: saturate(0.92) brightness(0.96); }
    .hvr-target.power{ filter: saturate(1.18) brightness(1.06); }

    /* burst shards (DOM) */
    .hvr-shard{
      position:fixed;
      width:10px;height:10px;
      border-radius:4px;
      pointer-events:none;
      z-index:99970;
      mix-blend-mode: screen;
      opacity:.9;
      transform: translate3d(0,0,0);
      filter: blur(.15px) saturate(1.1);
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
  const n = Math.floor(22 + 22*strength);
  const r0 = 6 + 10*strength;
  const r1 = 46 + 86*strength;

  ctx.save();
  ctx.translate(x,y);
  ctx.globalCompositeOperation = 'screen';

  for (let i=0;i<n;i++){
    const a = (i/n) * Math.PI*2 + (t*0.002);
    const rr = r0 + (r1-r0) * (0.35 + 0.65*Math.random());
    const w = 1.2 + 2.4*strength;

    ctx.strokeStyle = `rgba(255, 60, 110, ${0.14 + 0.12*strength})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    ctx.stroke();

    const a2 = a + 0.16;
    ctx.strokeStyle = `rgba(0, 190, 255, ${0.10 + 0.12*strength})`;
    ctx.lineWidth = w*0.86;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a2)*r0, Math.sin(a2)*r0);
    ctx.lineTo(Math.cos(a2)*rr*0.92, Math.sin(a2)*rr*0.92);
    ctx.stroke();
  }

  for (let k=0;k<18;k++){
    const a = Math.random()*Math.PI*2;
    const rr = 12 + Math.random()* (80*strength);
    ctx.fillStyle = `rgba(255,255,255,${0.14 + 0.22*Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.4 + 2.6*Math.random(), 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function spawnShards(x,y, count=10){
  const body = DOC.body;
  for (let i=0;i<count;i++){
    const d = DOC.createElement('div');
    d.className = 'hvr-shard';
    const hue = (i*28 + Math.random()*18) % 360;
    d.style.background = `linear-gradient(135deg,
      hsla(${hue}, 95%, 70%, .75),
      hsla(${(hue+60)%360}, 95%, 65%, .45)
    )`;
    d.style.left = (x-5) + 'px';
    d.style.top  = (y-5) + 'px';

    const ang = Math.random()*Math.PI*2;
    const sp  = 140 + Math.random()*260;
    const dx  = Math.cos(ang)*sp;
    const dy  = Math.sin(ang)*sp;
    const rot = (Math.random()*220 - 110);
    body.appendChild(d);

    d.animate([
      { transform:`translate3d(0,0,0) rotate(0deg) scale(1)`, opacity:0.95 },
      { transform:`translate3d(${dx}px,${dy}px,0) rotate(${rot}deg) scale(0.55)`, opacity:0 }
    ], { duration: 520 + Math.random()*240, easing:'cubic-bezier(.18,.9,.22,1)' });

    ROOT.setTimeout(()=>{ try{ d.remove(); }catch{} }, 900);
  }
}

function blinkOn(kind, ms=110){
  const blink = $id('hvr-screen-blink');
  if (!blink) return;
  blink.className = '';
  blink.classList.add('on');
  if (kind) blink.classList.add(kind);
  ROOT.setTimeout(()=>{ blink.className=''; }, ms);
}

function computeSafeSpawnRect(playfield){
  // กันทับ HUD: ใช้ rect ของ .hud .card ทั้งหมด
  const w = ROOT.innerWidth || 1;
  const h = ROOT.innerHeight || 1;

  // base safe margin
  const pad = 18;

  // collect forbidden rects
  const bad = [];
  const cards = DOC.querySelectorAll('.hud .card');
  cards.forEach(el=>{
    const r = el.getBoundingClientRect();
    bad.push({ l:r.left, t:r.top, r:r.right, b:r.bottom });
  });

  // also avoid very top band (status area)
  bad.push({ l:0, t:0, r:w, b:110 });

  function ok(x,y, size){
    const l=x, t=y, rr=x+size, bb=y+size;
    if (l < pad || t < pad || rr > w-pad || bb > h-pad) return false;
    for (const b of bad){
      const inter = !(rr < b.l || l > b.r || bb < b.t || t > b.b);
      if (inter) return false;
    }
    return true;
  }

  return {
    pick(size){
      for (let k=0;k<28;k++){
        const x = pad + Math.random()*(w - pad*2 - size);
        const y = pad + Math.random()*(h - pad*2 - size);
        if (ok(x,y,size)) return { x, y };
      }
      // fallback: center-ish
      return { x: (w-size)/2, y: (h-size)/2 + 80 };
    }
  };
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  const crosshair = $id('hvr-crosshair');

  if (!playfield) throw new Error('ไม่พบ #hvr-playfield ใน hydration-vr.html');

  // parallax layers
  if (!playfield.querySelector('.hvr-parallax')){
    const l1 = DOC.createElement('div'); l1.className='hvr-parallax l1';
    const l2 = DOC.createElement('div'); l2.className='hvr-parallax l2';
    playfield.appendChild(l1);
    playfield.appendChild(l2);
  }

  // speedlines
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  const post = ensurePostFXCanvas();
  const SFX = makeSfx();

  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  const DIFF = {
    easy:   { size:86, max:4, life:1700, spawn:1050, good:0.70, power:0.10, trick:0.08 },
    normal: { size:76, max:5, life:1550, spawn:920,  good:0.64, power:0.10, trick:0.10 },
    hard:   { size:68, max:6, life:1320, spawn:760,  good:0.58, power:0.12, trick:0.12 }
  }[diff] || { size:76, max:5, life:1550, spawn:920, good:0.64, power:0.10, trick:0.10 };

  // pools
  const GOOD  = ['💧','🧊','🥤','🫧'];
  const BAD   = ['🍟','🍩','🍕','🍔'];
  const POWER = ['⭐','✨','⚡'];
  const TRICK = ['🫧','🥤']; // หลอก

  const s = {
    running:true,
    startedAt: now(),
    score:0, combo:0, comboMax:0, miss:0,
    water:50,
    zone:'GREEN',
    zoneLabel:'GREEN',
    greenTick:0,
    timeLeft: duration,

    viewX:0, viewY:0,
    stormOn:false,
    stormUntil:0,
    stormStrength:0,
    tiltX:0, tiltY:0,

    sparks:[],
    targets: new Map(), // id -> obj
    nextId: 1,
    spawnTimer: 0,

    // drag
    dragOff: null,
    tiltOff: null,

    // safe picker (recompute on resize occasionally)
    safe: computeSafeSpawnRect(playfield),
    lastSafeRecalc: 0
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
    if (qg) qg.textContent = `Goal: ⏳ อยู่ GREEN ≥ 16s (ตอนนี้ ${s.greenTick}s)`;
    if (qm) qm.textContent = `Mini: ✅ Combo ≥ 8 • ✅ Perfect ≥ 4 • ✅ NoJunk`;
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

    // force HUD text BLUE/GREEN/RED
    const st = $id('hha-water-status');
    if (st) st.textContent = `${s.zoneLabel} ${Math.round(s.water)}%`;
    const zt = $id('hha-water-zone-text');
    if (zt) zt.textContent = (s.zoneLabel === 'GREEN') ? 'ZONE GREEN' : `ZONE ${s.zoneLabel}`;

    return { pct:s.water, zone:z };
  }

  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (wrap){
      if (s.stormOn){ addClass(wrap,'hvr-chroma'); addClass(wrap,'hvr-wobble'); }
      else { removeClass(wrap,'hvr-chroma'); removeClass(wrap,'hvr-wobble'); }
    }
    if (speedLines){
      if (s.stormOn) addClass(speedLines,'on');
      else removeClass(speedLines,'on');
    }
  }

  function maybeStormTick(){
    const t = now();
    if (s.stormOn && t > s.stormUntil) setStorm(false, 0);
  }

  function perfectFX(x,y){
    try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
    try{ Particles.scorePop(x,y,'PERFECT! +120','gold'); }catch{}
    blinkOn('perfect', 140);
    SFX.hitPerfect();

    if (wrap){
      addClass(wrap,'hvr-perfect-pulse');
      ROOT.setTimeout(()=>removeClass(wrap,'hvr-perfect-pulse'), 220);
    }

    if (post && post.ctx){
      s.sparks.push({ x, y, t0: now(), str: 1.25 });
    }
    spawnShards(x,y, 14);
  }

  function goodFX(x,y, txt='+55', kind='good'){
    try{ Particles.burstAt(x,y, kind==='power'?'POWER':'GOOD'); }catch{}
    try{ Particles.scorePop(x,y, txt, kind); }catch{}
    blinkOn('good', 95);
    SFX.hitGood();
    spawnShards(x,y, kind==='power' ? 12 : 8);
  }

  function badFX(x,y, txt='MISS'){
    try{ Particles.burstAt(x,y,'BAD'); }catch{}
    try{ Particles.scorePop(x,y, txt,'bad'); }catch{}
    blinkOn('bad', 120);
    SFX.hitBad();
    spawnShards(x,y, 8);
  }

  // device tilt -> shimmer
  function bindTilt(){
    const onOri = (e)=>{
      // gamma: left/right, beta: front/back
      const gx = clamp((e.gamma||0)/30, -1, 1);
      const gy = clamp((e.beta||0)/40, -1, 1);
      s.tiltX = gx; s.tiltY = gy;
      playfield.style.setProperty('--tilt-x', gx.toFixed(3));
      playfield.style.setProperty('--tilt-y', gy.toFixed(3));
    };
    ROOT.addEventListener('deviceorientation', onOri, { passive:true });
    return ()=>ROOT.removeEventListener('deviceorientation', onOri);
  }

  // drag view + tap shoot(center)
  function bindViewDragAndShoot(){
    let down=false, moved=false, sx=0, sy=0, vx0=0, vy0=0, pid=null;
    const TH=6;

    function shootCenter(){
      const cx = (ROOT.innerWidth||1)/2;
      const cy = (ROOT.innerHeight||1)/2;
      let el = DOC.elementFromPoint(cx,cy);
      // climb to target
      while (el && el !== DOC.body && !el.classList?.contains('hvr-target')) el = el.parentNode;
      if (el && el.classList?.contains('hvr-target')){
        const id = Number(el.dataset.id||0);
        if (id && s.targets.has(id)) hitTarget(id, { clientX:cx, clientY:cy, by:'crosshair' });
      }
    }

    const onDown=(e)=>{
      if (!s.running) return;
      down=true; moved=false;
      pid=e.pointerId;
      try{ playfield.setPointerCapture(pid); }catch{}
      sx=e.clientX; sy=e.clientY;
      vx0=s.viewX; vy0=s.viewY;
    };
    const onMove=(e)=>{
      if (!down || !s.running) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if (!moved && (Math.abs(dx)+Math.abs(dy) > TH)) moved=true;
      if (moved){
        s.viewX = clamp(vx0 + dx, -180, 180);
        s.viewY = clamp(vy0 + dy, -140, 140);
        applyView();
      }
    };
    const onUp=()=>{
      if (!down) return;
      down=false;
      try{ playfield.releasePointerCapture(pid); }catch{}
      pid=null;
      if (!moved) shootCenter();
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

  // postFX loop
  let fxRaf=null;
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

  // ---------- targets ----------
  function pickType(){
    const r = Math.random();
    if (r < DIFF.power) return 'power';
    if (r < DIFF.power + (1-DIFF.power)*DIFF.good) return 'good';
    const r2 = Math.random();
    if (r2 < DIFF.trick) return 'trick';
    return 'bad';
  }

  function pickEmoji(type){
    if (type === 'power') return POWER[(Math.random()*POWER.length)|0];
    if (type === 'bad') return BAD[(Math.random()*BAD.length)|0];
    if (type === 'trick') return TRICK[(Math.random()*TRICK.length)|0];
    return GOOD[(Math.random()*GOOD.length)|0];
  }

  function makeTarget(){
    const id = s.nextId++;
    const type = pickType();
    const emoji = pickEmoji(type);

    // resize safe rect occasionally
    const t = now();
    if (t - s.lastSafeRecalc > 900){
      s.safe = computeSafeSpawnRect(playfield);
      s.lastSafeRecalc = t;
    }

    const size = DIFF.size * (type==='power' ? 1.05 : 1.0);
    const p = s.safe.pick(size);

    const el = DOC.createElement('div');
    el.className = 'hvr-target' + (type==='bad' ? ' bad' : (type==='power' ? ' power' : ''));
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = String(id);

    // ring + emoji
    const ring = DOC.createElement('div');
    ring.className = 'ring';
    const em = DOC.createElement('div');
    em.className = 'emoji';
    em.textContent = emoji;

    el.appendChild(ring);
    el.appendChild(em);

    // reactive shimmer vars
    el.style.setProperty('--iri-r', (Math.random()*180 - 90).toFixed(2) + 'deg');

    // click direct
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hitTarget(id, e);
    }, { passive:false });

    playfield.appendChild(el);

    const life = DIFF.life * (type==='bad' ? 1.05 : 1.0) * (type==='power' ? 0.92 : 1.0);
    const t0 = now();
    const swayA = (type==='bad' ? 10 : 12) * (1 + Math.random()*0.6);
    const swayB = (type==='bad' ? 8 : 10) * (1 + Math.random()*0.6);
    const spd  = 1.0 + Math.random()*0.8;
    const ph   = Math.random()*Math.PI*2;

    s.targets.set(id, { id, type, emoji, el, ring, t0, life, swayA, swayB, spd, ph, baseX:p.x, baseY:p.y });
  }

  function removeTarget(id){
    const o = s.targets.get(id);
    if (!o) return;
    s.targets.delete(id);
    try{ o.el.remove(); }catch{}
  }

  function hitTarget(id, ev){
    const o = s.targets.get(id);
    if (!o || !s.running) return;

    const t = now();
    const prog = clamp((t - o.t0) / o.life, 0, 1);

    // perfect window (กลาง ๆ)
    const perfect = (prog > 0.40 && prog < 0.60);

    // hit point (screen)
    const r = o.el.getBoundingClientRect();
    const x = (ev?.clientX ?? (r.left + r.width/2));
    const y = (ev?.clientY ?? (r.top + r.height/2));

    // remove
    removeTarget(id);

    // scoring rules (คล้ายของเดิม)
    if (o.type === 'bad'){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 45);
      updateWater(-10);
      badFX(x,y,'MISS');

      // panic storm chance
      if (!s.stormOn && Math.random() < 0.22){
        s.stormUntil = now() + 5600;
        setStorm(true, 0.95);
      }

      hud();
      return;
    }

    // trick acts like bad if not perfect
    if (o.type === 'trick' && !perfect){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      badFX(x,y,'TRICK!');
      hud();
      return;
    }

    // perfect bonus (even for good/power/trick)
    if (perfect){
      s.score += 120;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+4);
      perfectFX(x,y);
    }

    if (o.type === 'power'){
      s.score += 95;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+9);
      goodFX(x,y,'POWER +95','power');

      // power => storm sure
      s.stormUntil = now() + 7200;
      setStorm(true, 1.10);

      hud();
      return;
    }

    // good hit
    s.score += 55;
    s.combo += 1;
    s.comboMax = Math.max(s.comboMax, s.combo);

    if (s.zone === 'LOW') updateWater(+8);
    else if (s.zone === 'HIGH') updateWater(+3);
    else updateWater(+5);

    if (s.combo > 0 && (s.combo % 8 === 0)){
      s.score += 80;
      goodFX(x,y,'STREAK +80','good');

      if (!s.stormOn && Math.random() < 0.34){
        s.stormUntil = now() + 6500;
        setStorm(true, 1.00);
      }
    }else{
      goodFX(x,y,'+55','good');
    }

    hud();
  }

  // animate/update targets (float/sway + ring)
  function tickTargets(){
    const t = now();

    // auto-spawn logic
    const stormMul = s.stormOn ? clamp(0.72 - 0.22*s.stormStrength, 0.42, 0.78) : 1.0;
    const spawnEvery = DIFF.spawn * stormMul;

    if (t - s.spawnTimer > spawnEvery){
      s.spawnTimer = t;
      if (s.targets.size < DIFF.max){
        makeTarget();
      }
    }

    // per-target movement
    for (const o of s.targets.values()){
      const dt = (t - o.t0);
      const prog = clamp(dt / o.life, 0, 1);

      // expire
      if (prog >= 1){
        // letting good slip => soften combo (no miss)
        if (o.type === 'good' || o.type === 'power'){
          s.combo = Math.max(0, s.combo - 1);
        }
        removeTarget(o.id);
        continue;
      }

      // sway stronger in storm
      const stormBoost = s.stormOn ? (1.55 + 0.65*s.stormStrength) : 1.0;

      const sx = Math.sin(o.ph + (dt*0.0026*o.spd)) * o.swayA * stormBoost;
      const sy = Math.cos(o.ph + (dt*0.0022*o.spd)) * o.swayB * stormBoost;

      // subtle float upward/down
      const fy = Math.sin(o.ph*0.7 + (dt*0.0015)) * 6;

      o.el.style.transform = `translate3d(${sx}px, ${sy + fy}px, 0)`;

      // reactive shimmer move (tiny)
      o.el.style.setProperty('--shim-x', (sx*0.05).toFixed(2) + 'px');
      o.el.style.setProperty('--shim-y', (sy*0.05).toFixed(2) + 'px');

      // perfect ring shrink
      const ringScale = 1.12 - prog*0.42;           // 1.12 -> 0.70
      const ringOp = 0.72 - prog*0.25;
      o.ring.style.transform = `translate(-50%,-50%) scale(${ringScale.toFixed(3)})`;
      o.ring.style.opacity = ringOp.toFixed(3);

      // make rim rainbow clearer near perfect window
      if (prog > 0.36 && prog < 0.64){
        o.el.style.filter = 'saturate(1.10) brightness(1.04)';
      }else{
        o.el.style.filter = (o.type==='power') ? 'saturate(1.18) brightness(1.06)' : '';
      }
    }

    // storm lifecycle
    maybeStormTick();

    ROOT.requestAnimationFrame(tickTargets);
  }

  // time tick (1s) -> drive water & green count
  let secLeft = duration;
  let lastSecAt = now();
  function timeLoop(){
    if (!s.running) return;
    const t = now();
    if (t - lastSecAt >= 1000){
      lastSecAt += 1000;
      secLeft -= 1;
      s.timeLeft = secLeft;

      // natural drain
      updateWater(-1.4);

      // count green time
      if (s.zone === 'GREEN') s.greenTick += 1;

      // red penalty drip
      if (s.zone === 'HIGH'){
        s.score = Math.max(0, s.score - 3);
      }

      // emit hha:time (เผื่อส่วนอื่น)
      try{
        ROOT.dispatchEvent(new CustomEvent('hha:time', { detail:{ sec: secLeft } }));
      }catch{}

      // last 6 sec tick sound (เบา ๆ)
      if (secLeft <= 6 && secLeft > 0) SFX.tick();

      hud();

      if (secLeft <= 0){
        endGame();
        return;
      }
    }
    ROOT.requestAnimationFrame(timeLoop);
  }

  // end overlay
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
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-weight:900; font-size:12px;">Score</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.score|0}</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-weight:900; font-size:12px;">Combo / Miss</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.comboMax|0} • ${s.miss|0}</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-weight:900; font-size:12px;">GREEN time</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.greenTick|0}s</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-weight:900; font-size:12px;">Water end</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${Math.round(s.water)}% (${s.zoneLabel})</div>
            </div>
          </div>

          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button id="hvr-end-retry" style="pointer-events:auto; border-radius:999px; border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.14); color:#eafff1; padding:10px 14px; font-weight:1000;">🔁 เล่นอีกครั้ง</button>
            <button id="hvr-end-hub" style="pointer-events:auto; border-radius:999px; border:1px solid rgba(148,163,184,.25); background:rgba(2,6,23,.55); color:#e5e7eb; padding:10px 14px; font-weight:1000;">🏠 กลับ Hub</button>
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

    // stop loops
    try{ ROOT.cancelAnimationFrame(fxRaf); }catch{}
    fxRaf = null;

    // clear targets
    for (const id of Array.from(s.targets.keys())) removeTarget(id);

    // remove listeners
    if (s.dragOff) try{ s.dragOff(); }catch{}
    if (s.tiltOff) try{ s.tiltOff(); }catch{}
    s.dragOff = null; s.tiltOff = null;

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

  // init
  updateWater(0);
  hud();
  applyView();

  // start bindings
  s.dragOff = bindViewDragAndShoot();
  s.tiltOff = bindTilt();

  // start storm occasionally when combo grows (fun)
  function stormAutoFromCombo(){
    if (!s.running) return;
    if (!s.stormOn && s.comboMax >= 8 && Math.random() < 0.05){
      s.stormUntil = now() + 5200;
      setStorm(true, 0.90);
    }
    ROOT.setTimeout(stormAutoFromCombo, 900);
  }
  stormAutoFromCombo();

  // run loops
  tickTargets();
  timeLoop();

  // public API
  return {
    stop(){ endGame(); }
  };
}

export default { boot };