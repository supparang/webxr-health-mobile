// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (A2+++)
// ✅ Bubble soap look: ใสเกือบไม่เห็น + ขอบรุ้งชัด
// ✅ Spawn: A2+++ (center-easy + ring8 order + anti-repeat)
// ✅ HUD responsive (fix right overflow)
// ✅ Drag view + tap-to-shoot crosshair
// ✅ PERFECT FX + Storm FX

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, celebrateQuestFX(){}, celebrateAllQuestsFX(){} };

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

function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-style';
  s.textContent = `
    /* ===== HUD fix (ไม่ตกขอบ) ===== */
    .hud{ flex-wrap:wrap; align-items:stretch; }
    .hud .card{ flex: 1 1 240px; max-width: 420px; min-width: 220px; }
    .hud .card.small{ flex: 1 1 220px; max-width: 340px; min-width: 200px; }
    @media (max-width: 980px){
      .hud{ gap:10px; left:12px; right:12px; top:12px; }
      .hud .card, .hud .card.small{ max-width:none; }
    }
    @media (max-width: 720px){
      .hud .card, .hud .card.small{ flex: 1 1 48%; min-width: 0; }
    }
    @media (max-width: 520px){
      .hud .card, .hud .card.small{ flex: 1 1 100%; }
    }

    /* ===== Crosshair (เห็นชัดนิด ๆ) ===== */
    #hvr-crosshair{
      position:fixed;
      left:50%; top:52%;
      transform:translate(-50%,-50%);
      z-index:86;
      pointer-events:none;
      width:44px; height:44px;
      opacity:.75;
      mix-blend-mode: screen;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,.45));
    }
    #hvr-crosshair:before{
      content:"";
      position:absolute; inset:0;
      border-radius:999px;
      border: 2px solid rgba(255,255,255,.16);
      box-shadow: 0 0 16px rgba(0,210,255,.10), 0 0 14px rgba(255,70,160,.07);
    }
    #hvr-crosshair:after{
      content:"";
      position:absolute; left:50%; top:50%;
      width:6px; height:6px;
      border-radius:999px;
      transform:translate(-50%,-50%);
      background: rgba(255,255,255,.45);
      box-shadow: 0 0 10px rgba(255,255,255,.22);
    }

    /* ===== drag view ===== */
    #hvr-playfield{ --view-x:0px; --view-y:0px; }
    .hvr-parallax{
      position:absolute; inset:-12%;
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

    /* ===== Storm FX ===== */
    #hvr-wrap.hvr-chroma{
      filter:
        drop-shadow(3.4px 0 rgba(255, 40, 80, 0.70))
        drop-shadow(-2.2px 0 rgba(0, 190, 255, 0.32));
    }
    #hvr-wrap.hvr-wobble{ animation: hvrWobble 0.95s ease-in-out infinite; }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(0.9px,-0.6px,0) rotate(0.04deg); }
      50%{ transform: translate3d(-1.0px,0.8px,0) rotate(-0.04deg); }
      75%{ transform: translate3d(0.6px,0.9px,0) rotate(0.03deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }

    .hvr-speedlines{
      position:fixed; inset:-20%;
      pointer-events:none; z-index:99960;
      opacity:0; mix-blend-mode: screen;
      background:
        repeating-linear-gradient(110deg,
          rgba(255,255,255,.00) 0 18px,
          rgba(255,80,120,.14) 18px 20px,
          rgba(0,190,255,.12) 20px 22px,
          rgba(255,255,255,.00) 22px 44px
        );
      filter: blur(0.6px) saturate(1.10) contrast(1.08);
      animation: hvrLines 0.28s linear infinite;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-10px, -10px, 0); }
      100%{ transform: translate3d(30px, 26px, 0); }
    }
    .hvr-speedlines.on{ opacity:0.34; }

    #hvr-wrap.hvr-perfect-pulse{ animation: hvrPerfectPulse 180ms ease-out 1; }
    @keyframes hvrPerfectPulse{
      0%{ filter: saturate(1) contrast(1); }
      45%{ filter: saturate(1.32) contrast(1.16); }
      100%{ filter: saturate(1) contrast(1); }
    }

    /* ===== Bubble soap targets ===== */
    .hvr-target.bubble{
      background: transparent !important;
      box-shadow: 0 22px 60px rgba(0,0,0,.55);
      backdrop-filter: blur(0.2px);
    }
    .hvr-bubble-edge{
      position:absolute; inset:0;
      border-radius:999px;
      border: 2.8px solid transparent;
      background:
        linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0)) padding-box,
        conic-gradient(
          from 40deg,
          rgba(255, 70, 160, .72),
          rgba(0, 210, 255, .70),
          rgba(0, 255, 170, .55),
          rgba(255, 255, 255, .22),
          rgba(255, 70, 160, .72)
        ) border-box;
      box-shadow:
        0 0 0 1px rgba(255,255,255,.08),
        0 0 26px rgba(0, 210, 255, .18),
        0 0 22px rgba(255, 70, 160, .14);
      opacity: .96;
      pointer-events:none;
    }
    .hvr-bubble-gloss{
      position:absolute; inset:10%;
      border-radius:999px;
      background:
        radial-gradient(circle at 28% 26%, rgba(255,255,255,.28), rgba(255,255,255,0) 55%),
        radial-gradient(circle at 78% 78%, rgba(255,255,255,.10), rgba(255,255,255,0) 60%);
      opacity:.48;
      pointer-events:none;
      mix-blend-mode: screen;
    }
    .hvr-bubble-tint{
      position:absolute; inset:18%;
      border-radius:999px;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.08), rgba(255,255,255,0) 55%);
      opacity:.18;
      pointer-events:none;
    }
  `;
  DOC.head.appendChild(s);
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  ensureHydrationStyle();
  ensureWaterGauge();

  const wrap = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  const blink = $id('hvr-screen-blink');

  // crosshair node (ถ้า html ยังไม่มี)
  if (!$id('hvr-crosshair')) {
    const c = DOC.createElement('div');
    c.id = 'hvr-crosshair';
    DOC.body.appendChild(c);
  }

  if (playfield && !playfield.querySelector('.hvr-parallax')){
    const l1 = DOC.createElement('div'); l1.className = 'hvr-parallax l1';
    const l2 = DOC.createElement('div'); l2.className = 'hvr-parallax l2';
    playfield.appendChild(l1);
    playfield.appendChild(l2);
  }

  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);

  const GOOD = ['💧','🧊','🫧','🥛','🥤'];
  const BAD  = ['🍟','🍩','🍕','🧋'];
  const POWER = ['⭐','⚡','✨'];

  const s = {
    running: true,
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    water: 50,
    zone: 'GREEN',
    zoneLabel: 'GREEN',

    greenTick: 0,
    timeLeft: duration,

    viewX: 0,
    viewY: 0,

    stormOn: false,
    stormUntil: 0,
    stormStrength: 0
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
    if (qm) qm.textContent = `Mini: Perfect/Combo ลุ้น Storm Wave!`;
  }

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

  function setStorm(on, strength=1){
    s.stormOn = !!on;
    s.stormStrength = clamp(strength, 0, 1.25);

    if (wrap){
      if (s.stormOn){
        addClass(wrap,'hvr-chroma');
        addClass(wrap,'hvr-wobble');
      }else{
        removeClass(wrap,'hvr-chroma');
        removeClass(wrap,'hvr-wobble');
      }
    }
    if (speedLines){
      if (s.stormOn) addClass(speedLines,'on');
      else removeClass(speedLines,'on');
    }
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
    if (zt) zt.textContent = s.zoneLabel;

    return { pct: s.water, zone: z };
  }

  updateWater(0);
  hud();
  applyView();

  function spawnMul(){
    if (!s.stormOn) return 1.0;
    return clamp(0.70 - 0.22*s.stormStrength, 0.42, 0.75);
  }

  // Bubble Decorator
  function decorateBubbleTarget(el, parts, data){
    try{
      el.classList.add('bubble');
      el.style.background = 'transparent';
      el.style.boxShadow = '0 26px 76px rgba(0,0,0,.60)';

      const { wiggle, inner, icon, ring } = parts || {};
      if (ring) ring.style.opacity = '0';

      if (inner){
        inner.style.background = 'transparent';
        inner.style.boxShadow = 'none';
      }

      let edge = wiggle && wiggle.querySelector('.hvr-bubble-edge');
      if (!edge && wiggle){
        edge = DOC.createElement('div');
        edge.className = 'hvr-bubble-edge';
        wiggle.insertBefore(edge, wiggle.firstChild);
      }
      let gloss = wiggle && wiggle.querySelector('.hvr-bubble-gloss');
      if (!gloss && wiggle){
        gloss = DOC.createElement('div');
        gloss.className = 'hvr-bubble-gloss';
        wiggle.appendChild(gloss);
      }
      let tint = wiggle && wiggle.querySelector('.hvr-bubble-tint');
      if (!tint && wiggle){
        tint = DOC.createElement('div');
        tint.className = 'hvr-bubble-tint';
        wiggle.appendChild(tint);
      }

      const type = String(data?.itemType||'good');
      if (type === 'power'){
        if (edge) edge.style.boxShadow = '0 0 0 1px rgba(255,255,255,.10), 0 0 30px rgba(250,204,21,.28), 0 0 24px rgba(0,210,255,.16)';
        if (tint) tint.style.background = 'radial-gradient(circle at 35% 30%, rgba(250,204,21,.12), rgba(255,255,255,0) 55%)';
      } else if (type === 'bad'){
        if (edge) edge.style.boxShadow = '0 0 0 1px rgba(255,255,255,.08), 0 0 24px rgba(255,120,60,.18), 0 0 18px rgba(255,70,160,.10)';
        if (tint) tint.style.background = 'radial-gradient(circle at 35% 30%, rgba(255,120,60,.08), rgba(255,255,255,0) 55%)';
      } else if (type === 'fakeGood'){
        if (edge) edge.style.boxShadow = '0 0 0 1px rgba(255,255,255,.08), 0 0 24px rgba(167,139,250,.18), 0 0 18px rgba(0,210,255,.10)';
        if (tint) tint.style.background = 'radial-gradient(circle at 35% 30%, rgba(167,139,250,.08), rgba(255,255,255,0) 55%)';
      } else {
        if (tint) tint.style.background = 'radial-gradient(circle at 35% 30%, rgba(0,210,255,.07), rgba(255,255,255,0) 55%)';
      }

      if (icon){
        icon.style.filter = 'drop-shadow(0 10px 16px rgba(0,0,0,.42))';
      }
    }catch{}
  }

  function judge(ch, ctx){
    const x = ctx?.clientX || (ROOT.innerWidth/2);
    const y = ctx?.clientY || (ROOT.innerHeight/2);

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
      try{ Particles.burstAt(x,y,'PERFECT'); }catch{}
      try{ Particles.scorePop(x,y,'PERFECT! +','gold'); }catch{}
      blinkOn('perfect', 130);
      if (wrap){
        addClass(wrap,'hvr-perfect-pulse');
        ROOT.setTimeout(()=>removeClass(wrap,'hvr-perfect-pulse'), 220);
      }
    }

    if (isBad){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 45);
      updateWater(-10);
      try{ Particles.burstAt(x,y,'BAD'); }catch{}
      try{ Particles.scorePop(x,y,'MISS','bad'); }catch{}
      blinkOn('bad', 110);

      if (!s.stormOn && Math.random() < 0.18){
        s.stormUntil = now() + 5200;
        setStorm(true, 0.85);
      }

      hud();
      return { scoreDelta: -45, good:false };
    }

    if (isFakeGood && !perfect){
      s.miss += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 30);
      updateWater(-7);
      try{ Particles.burstAt(x,y,'BAD'); }catch{}
      try{ Particles.scorePop(x,y,'TRICK!','bad'); }catch{}
      blinkOn('bad', 110);
      hud();
      return { scoreDelta: -30, good:false };
    }

    if (isPower){
      s.score += 95;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      updateWater(+9);
      try{ Particles.burstAt(x,y,'POWER'); }catch{}
      try{ Particles.scorePop(x,y,'POWER +95','power'); }catch{}
      blinkOn('good', 90);

      s.stormUntil = now() + 6800;
      setStorm(true, 1.05);

      hud();
      return { scoreDelta: +95, good:true };
    }

    s.score += 55;
    s.combo += 1;
    s.comboMax = Math.max(s.comboMax, s.combo);

    if (s.zone === 'LOW') updateWater(+8);
    else if (s.zone === 'HIGH') updateWater(+3);
    else updateWater(+5);

    if (s.combo > 0 && (s.combo % 8 === 0)){
      s.score += 80;
      try{ Particles.burstAt(x,y,'GOOD'); }catch{}
      try{ Particles.scorePop(x,y,'STREAK +80','good'); }catch{}
      blinkOn('good', 90);

      if (!s.stormOn && Math.random() < 0.32){
        s.stormUntil = now() + 6200;
        setStorm(true, 0.95);
      }
    } else {
      try{ Particles.burstAt(x,y,'GOOD'); }catch{}
      try{ Particles.scorePop(x,y,'+55','good'); }catch{}
      blinkOn('good', 90);
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

  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration,

    spawnHost: '#hvr-playfield',
    boundsHost: '#hvr-wrap',

    spawnBias: 'A2+++',
    spawnPattern: 'ring8',     // ✅ “ล็อก order” แบบวง 8 ทิศ (กระจายแต่ยังใกล้กลาง)
    antiRepeat: true,
    antiRepeatN: 4,

    pools: { good: GOOD, bad: BAD, trick: ['💧','🫧'] },
    goodRate: diff === 'hard' ? 0.58 : (diff === 'normal' ? 0.62 : 0.68),

    powerups: POWER,
    powerRate: diff === 'hard' ? 0.12 : 0.10,
    powerEvery: 7,

    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff === 'hard' ? 0.12 : 0.08,
    spawnIntervalMul: spawnMul,

    excludeSelectors: ['.hud', '#hvr-crosshair', '#hvr-end', '#hvr-screen-blink'],

    decorateTarget: decorateBubbleTarget,
    judge,
    onExpire
  });

  // Drag + tap shoot
  function bindViewDragAndShoot(){
    if (!playfield) return null;

    let down=false, moved=false, sx=0, sy=0, vx0=0, vy0=0, pid=null;
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
    const onUp = ()=>{
      if (!down) return;
      down = false;
      try{ playfield.releasePointerCapture(pid); }catch{}
      pid = null;

      // tap = ยิงกลางจอ
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

  const unbindDrag = bindViewDragAndShoot();

  function onTime(ev){
    const sec = ev?.detail?.sec;
    if (typeof sec !== 'number') return;
    s.timeLeft = sec;

    updateWater(-1.4);
    if (s.zone === 'GREEN') s.greenTick += 1;

    if (s.stormOn && now() > s.stormUntil) setStorm(false, 0);

    if (s.zone === 'HIGH') s.score = Math.max(0, s.score - 3);

    hud();

    if (sec <= 0){
      endGame();
    }
  }
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function endGame(){
    if (!s.running) return;
    s.running = false;

    try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
    try{ inst && inst.stop && inst.stop(); }catch{}

    if (unbindDrag) try{ unbindDrag(); }catch{}
    ROOT.removeEventListener('hha:time', onTime);

    setStorm(false, 0);

    const end = $id('hvr-end');
    if (end){
      end.className = 'on';
      const g = gradeFrom(s.score);
      end.innerHTML = `
        <div style="width:min(760px,100%); background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.24); border-radius:24px; padding:14px; box-shadow:0 22px 70px rgba(0,0,0,.60);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <h2 style="margin:0; font-size:18px; font-weight:1000;">🏁 สรุปผลการเล่น</h2>
            <div style="font-weight:1000; letter-spacing:.08em;">Grade ${g}</div>
          </div>
          <div style="margin-top:10px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px; font-weight:900;">Score</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.score|0}</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px; font-weight:900;">ComboMax / Miss</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.comboMax|0} • ${s.miss|0}</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px; font-weight:900;">GREEN time</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${s.greenTick|0}s</div>
            </div>
            <div style="background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px;">
              <div style="color:rgba(148,163,184,.9); font-size:12px; font-weight:900;">Water end</div>
              <div style="font-size:22px; font-weight:1000; margin-top:4px;">${Math.round(s.water)}% (${s.zoneLabel})</div>
            </div>
          </div>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button id="hvr-end-retry" style="appearance:none;border:1px solid rgba(34,197,94,.30);background:rgba(34,197,94,.14);color:#e5e7eb;padding:10px 12px;border-radius:14px;font-weight:900;cursor:pointer;">🔁 เล่นอีกครั้ง</button>
            <button id="hvr-end-hub" style="appearance:none;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.65);color:#e5e7eb;padding:10px 12px;border-radius:14px;font-weight:900;cursor:pointer;">🏠 กลับ Hub</button>
          </div>
        </div>
      `;
      const retry = $id('hvr-end-retry');
      const hub = $id('hvr-end-hub');
      if (retry) retry.onclick = ()=>location.reload();
      if (hub) hub.onclick = ()=>location.href = './hub.html';
    }
  }

  hud();
  return { stop(){ endGame(); } };
}

export default { boot };