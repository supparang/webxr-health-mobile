'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// --- Root / modules ---
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function $(id){ return DOC ? DOC.getElementById(id) : null; }

function setTxt(id, t){
  const el = $(id);
  if (el) el.textContent = String(t);
}
function addClass(el, c){ try{ el && el.classList.add(c); }catch{} }
function rmClass(el, c){ try{ el && el.classList.remove(c); }catch{} }

function blink(type){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add('on');
  if (type) el.classList.add(type);
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 120);
}

// ----------------------
// ✅ Local heavy PERFECT starburst (DOM) — กันกรณี particles.js ไม่ครอบคลุม
// ----------------------
function ensureFxLayer(){
  if (!DOC) return null;
  let layer = DOC.querySelector('.hvr-local-fx');
  if (layer && layer.isConnected) return layer;
  layer = DOC.createElement('div');
  layer.className = 'hvr-local-fx';
  Object.assign(layer.style,{
    position:'fixed',
    inset:'0',
    pointerEvents:'none',
    zIndex:'99990' // สูงกว่า postfx/hud
  });
  DOC.body.appendChild(layer);

  const st = DOC.createElement('style');
  st.textContent = `
    .hvr-spark{
      position:absolute;
      left:0; top:0;
      transform:translate(-50%,-50%);
      will-change:transform,opacity,filter;
      font-weight:900;
      text-shadow:0 10px 30px rgba(0,0,0,.55);
      filter: drop-shadow(0 8px 14px rgba(0,0,0,.55));
    }
    @keyframes hvrSpark{
      0%{ opacity:0; transform:translate(-50%,-50%) scale(.4) rotate(0deg); }
      10%{ opacity:1; }
      100%{ opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(var(--sc)) rotate(var(--rot)); }
    }
  `;
  DOC.head.appendChild(st);
  return layer;
}

function perfectStarBurst(x,y, storm=false){
  const layer = ensureFxLayer();
  if (!layer) return;

  const n = storm ? 22 : 16;
  const base = storm ? 460 : 380;

  for (let i=0;i<n;i++){
    const s = DOC.createElement('div');
    s.className='hvr-spark';
    const pick = (i%5===0) ? '💥' : (i%3===0 ? '✨' : '⭐');
    s.textContent = pick;
    const ang = Math.random()*Math.PI*2;
    const r = base*(0.35 + Math.random()*0.75);
    const dx = Math.cos(ang)*r;
    const dy = Math.sin(ang)*r*(0.75 + Math.random()*0.55);
    const sc = 0.9 + Math.random()*1.35;
    const rot = (-40 + Math.random()*80) + 'deg';

    const fs = (pick==='💥' ? (36+Math.random()*14) : (22+Math.random()*18));
    s.style.fontSize = fs+'px';
    s.style.left = x+'px';
    s.style.top  = y+'px';
    s.style.setProperty('--dx', dx.toFixed(1)+'px');
    s.style.setProperty('--dy', dy.toFixed(1)+'px');
    s.style.setProperty('--sc', sc.toFixed(2));
    s.style.setProperty('--rot', rot);
    s.style.animation = `hvrSpark ${storm?680:560}ms cubic-bezier(.16,.84,.2,1) forwards`;

    layer.appendChild(s);
    ROOT.setTimeout(()=>{ try{s.remove();}catch{} }, storm?740:620);
  }
}

// ----------------------
// ✅ Simple audio (beep/tick)
// ----------------------
const AudioSys = (() => {
  let ac=null;
  function ensure(){
    try{
      if (ac) return ac;
      const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      return ac;
    }catch{ return null; }
  }
  function beep(freq=880, dur=0.06, gain=0.06){
    const A = ensure(); if (!A) return;
    try{
      const o = A.createOscillator();
      const g = A.createGain();
      o.type='sine';
      o.frequency.value=freq;
      g.gain.value=gain;
      o.connect(g); g.connect(A.destination);
      o.start();
      o.stop(A.currentTime + dur);
    }catch{}
  }
  return { beep };
})();

// ======================================================
//  boot()
// ======================================================
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 30, 180);

  // --- UI bind ---
  ensureWaterGauge();

  // --- playfield & parallax ---
  const wrap = $('hvr-wrap');
  const pf   = $('hvr-playfield');
  const p1   = $('hvr-parallax-1');
  const p2   = $('hvr-parallax-2');

  let viewX = 0, viewY = 0;           // camera pan (drag)
  let velX = 0, velY = 0;
  const VIEW_MAX_X = 140;
  const VIEW_MAX_Y = 120;

  function applyParallax(){
    if (pf) pf.style.transform = `translate3d(${viewX}px, ${viewY}px, 0)`;
    if (p1) p1.style.transform = `translate3d(${(-viewX*0.35)}px, ${(-viewY*0.28)}px, 0)`;
    if (p2) p2.style.transform = `translate3d(${(-viewX*0.18)}px, ${(-viewY*0.14)}px, 0)`;
  }
  applyParallax();

  // drag to look
  let dragging=false, lx=0, ly=0;
  function onDown(e){
    dragging=true;
    lx = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    ly = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  }
  function onMove(e){
    if (!dragging) return;
    const x = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const y = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const dx = x - lx;
    const dy = y - ly;
    lx = x; ly = y;
    velX += dx*0.55;
    velY += dy*0.55;
  }
  function onUp(){ dragging=false; }

  if (pf){
    pf.addEventListener('pointerdown', onDown, {passive:true});
    pf.addEventListener('pointermove', onMove, {passive:true});
    ROOT.addEventListener('pointerup', onUp, {passive:true});
    pf.addEventListener('touchstart', onDown, {passive:true});
    pf.addEventListener('touchmove', onMove, {passive:true});
    ROOT.addEventListener('touchend', onUp, {passive:true});
  }

  // view inertial loop
  let stopped=false;
  let rafView=0;
  function loopView(){
    if (stopped) return;
    // friction
    velX *= 0.86;
    velY *= 0.86;
    viewX = clamp(viewX + velX*0.08, -VIEW_MAX_X, VIEW_MAX_X);
    viewY = clamp(viewY + velY*0.08, -VIEW_MAX_Y, VIEW_MAX_Y);
    applyParallax();
    rafView = ROOT.requestAnimationFrame(loopView);
  }
  rafView = ROOT.requestAnimationFrame(loopView);

  // ----------------------
  // Game state
  // ----------------------
  let score=0, miss=0, combo=0, comboMax=0, perfectHits=0;
  let water=50;
  let zone = zoneFrom(water);

  let greenSec=0, lowSec=0, highSec=0;   // ✅ FIX: นับโซนตามจริง
  let goalsDone=0, goalsTotal=2;
  let minisDone=0, minisTotal=3;

  // goal targets by difficulty
  const goalGreenTarget = (difficulty==='hard') ? 42 : (difficulty==='normal' ? 36 : 30); // seconds
  const badZoneLimit    = (difficulty==='hard') ? 14 : (difficulty==='normal' ? 18 : 22); // sec allowed (LOW/HIGH)
  const miniComboTarget = (difficulty==='hard') ? 12 : (difficulty==='normal' ? 10 : 8);
  const miniPerfectTarget = (difficulty==='hard') ? 8 : (difficulty==='normal' ? 6 : 4);

  // mini chain progress
  const miniDefs = [
    { id:'m1', label:`Combo ≥ ${miniComboTarget} 🔥`, pass:()=> comboMax>=miniComboTarget },
    { id:'m2', label:`PERFECT ≥ ${miniPerfectTarget} ✨`, pass:()=> perfectHits>=miniPerfectTarget },
    { id:'m3', label:`No JUNK 10s 🛡️`, pass:()=> safeNoJunkSec>=10 }
  ];
  let miniIdx=0;

  // safe counter for mini
  let safeNoJunkSec=0;

  // storm wave
  let stormOn=false;
  let stormUntil=0;
  let nextStormAt = now() + (difficulty==='hard'? 9000 : 11500);

  function setStorm(on){
    stormOn = !!on;
    if (stormOn){
      addClass(DOC.body,'hvr-stormwave');
    }else{
      rmClass(DOC.body,'hvr-stormwave');
    }
  }

  // grade (simple mapping)
  function gradeFromScore(s){
    if (s >= 1500) return 'SSS';
    if (s >= 1100) return 'SS';
    if (s >= 850)  return 'S';
    if (s >= 600)  return 'A';
    if (s >= 380)  return 'B';
    return 'C';
  }
  function gradePct(s){
    // 0..100 progress to S (850)
    const tgt = 850;
    return clamp((s/tgt)*100, 0, 100);
  }

  function updateHud(){
    setTxt('hha-score-main', score|0);
    setTxt('hha-miss', miss|0);
    setTxt('hha-combo-max', comboMax|0);

    const g = gradeFromScore(score);
    setTxt('hha-grade-badge', g);
    const pct = gradePct(score);
    const fill = $('hha-grade-progress-fill');
    if (fill) fill.style.width = pct.toFixed(1)+'%';
    setTxt('hha-grade-progress-text', `Progress to S (850): ${pct.toFixed(0)}%`);

    setTxt('hha-goal-done', goalsDone);
    setTxt('hha-goal-total', goalsTotal);
    setTxt('hha-mini-done', minisDone);
    setTxt('hha-mini-total', minisTotal);

    const goalLine = `Goal: GREEN ≥ ${greenSec}s / ${goalGreenTarget}s • BadZone ${lowSec+highSec}s ≤ ${badZoneLimit}s`;
    setTxt('hha-quest-goal', goalLine);

    const md = miniDefs[miniIdx] || miniDefs[miniDefs.length-1];
    setTxt('hha-quest-mini', `Mini: ${md ? md.label : '—'}`);
  }

  function setWater(v){
    water = clamp(v,0,100);
    const out = setWaterGauge(water);
    zone = out.zone || zoneFrom(water);
    return zone;
  }
  setWater(water);
  updateHud();

  // ✅ scoring + effects
  function doHit(ch, ctx){
    const isPower = !!ctx.isPower;
    const itemType = ctx.itemType || (ctx.isGood ? 'good' : 'bad');
    const perfect = !!ctx.hitPerfect;

    // convert hit point
    const x = ctx.clientX || (ctx.targetRect ? (ctx.targetRect.left+ctx.targetRect.width/2) : (ROOT.innerWidth/2));
    const y = ctx.clientY || (ctx.targetRect ? (ctx.targetRect.top+ctx.targetRect.height/2) : (ROOT.innerHeight/2));

    if (itemType === 'bad'){
      miss++;
      combo = 0;
      safeNoJunkSec = 0;

      // water penalty (harder when storm)
      const p = stormOn ? 10 : 8;
      setWater(water - p);

      // effects
      blink('bad');
      AudioSys.beep(220, 0.06, 0.08);
      Particles.scorePop && Particles.scorePop(x,y,'MISS','BAD');
      Particles.burstAt && Particles.burstAt(x,y,{ type:'junk', strong:true });

      // score
      score = Math.max(0, score - (stormOn?18:14));
      updateHud();
      return { scoreDelta:-1, good:false };
    }

    // good / power / fakeGood
    const fake = (itemType === 'fakeGood');
    if (fake){
      // trap: looks good but drains a bit + breaks combo
      miss++;
      combo = 0;
      safeNoJunkSec = 0;
      setWater(water - 6);
      blink('bad');
      AudioSys.beep(260, 0.05, 0.07);
      Particles.scorePop && Particles.scorePop(x,y,'TRAP','BAD');
      Particles.burstAt && Particles.burstAt(x,y,{ type:'trap', strong:true });
      score = Math.max(0, score - 10);
      updateHud();
      return { scoreDelta:-1, good:false };
    }

    // GOOD / POWER
    combo++;
    comboMax = Math.max(comboMax, combo);
    safeNoJunkSec = Math.min(999, safeNoJunkSec + 1);

    // water gain
    const wGain = isPower ? 8 : (perfect ? 5 : 3);
    setWater(water + wGain);

    // base score
    let add = isPower ? 40 : 12;
    if (perfect){ add += 18; perfectHits++; }
    // streak bonus (green zone)
    if (zone === 'GREEN') add += Math.min(12, Math.floor(combo/4)*2);
    if (stormOn) add += 4;

    score += add;

    // effects
    blink(isPower ? 'block' : 'good');
    AudioSys.beep(perfect ? 1320 : 880, perfect ? 0.07 : 0.055, perfect ? 0.085 : 0.06);

    // particles mix
    Particles.burstAt && Particles.burstAt(x,y,{ type: (perfect?'perfect':'good'), strong:!!perfect, itemType });
    Particles.scorePop && Particles.scorePop(x,y, perfect ? `+${add} PERFECT` : `+${add}`, perfect?'PERFECT':'GOOD');

    // heavy perfect stars (extra)
    if (perfect){
      perfectStarBurst(x,y, stormOn);
    }

    updateHud();
    return { scoreDelta:add, good:true };
  }

  // ----------------------
  // Time tick / goal check
  // ----------------------
  let secLeft = duration;
  let lastTs = now();
  function onTimeTick(s){
    // from mode-factory (sec)
    secLeft = s|0;

    // ✅ count zone strictly
    if (zone === 'GREEN') greenSec++;
    else if (zone === 'LOW') lowSec++;
    else if (zone === 'HIGH') highSec++;

    // safe counter
    safeNoJunkSec++;

    // Goal pass check
    const badSum = lowSec + highSec;

    let g1 = (greenSec >= goalGreenTarget);
    let g2 = (badSum <= badZoneLimit);

    // we treat 2 goals as: reach green target + keep bad under limit (at end)
    // progress: goal1 can be done midgame; goal2 decided at end (but show as progress)
    let done = 0;
    if (g1) done++;
    // goal2 "so far ok" counts as done only at end, but show as soft until end
    // keep goalsDone = done at end; update overlay text every sec
    goalsDone = done;

    // mini check
    const cur = miniDefs[miniIdx];
    if (cur && cur.pass()){
      minisDone = Math.max(minisDone, miniIdx+1);
      miniIdx = Math.min(miniIdx+1, miniDefs.length-1);
      try{ ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ kind:'mini', id:cur.id } })); }catch{}
      Particles.celebrate && Particles.celebrate('mini');
    }

    updateHud();

    // storm schedule
    const t = now();
    if (!stormOn && t >= nextStormAt){
      setStorm(true);
      stormUntil = t + (difficulty==='hard'? 9000 : 7500);
    }
    if (stormOn && t >= stormUntil){
      setStorm(false);
      nextStormAt = t + (difficulty==='hard'? 10500 : 12500);
    }

    // end
    if (secLeft <= 0){
      endGame();
    }
  }

  // bind time event
  const onTimeEv = (e)=> {
    const sec = e?.detail?.sec;
    if (typeof sec === 'number') onTimeTick(sec);
  };
  ROOT.addEventListener('hha:time', onTimeEv, {passive:true});

  // ----------------------
  // Mode-factory spawn
  // ----------------------
  const pools = {
    good: ['💧','🫧','💦','🥛','🧃'],
    bad:  ['🥤','🍟','🍩','🧋','🍔'],
    trick:['💧','🫧','💦'] // fakeGood แกล้ง
  };

  const inst = await factoryBoot({
    modeKey:'hydration',
    difficulty,
    duration,
    spawnHost: '#hvr-playfield',
    pools,
    goodRate: (difficulty==='hard') ? 0.58 : (difficulty==='normal'?0.62:0.66),
    powerups:['⭐','🛡️'],
    powerRate: (difficulty==='hard') ? 0.12 : 0.10,
    powerEvery: 7,
    trickRate: (difficulty==='hard') ? 0.11 : 0.085,

    // ✅ safe zone: กันทับ HUD + overlays
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end'],

    // ✅ storm: spawn ถี่ขึ้นจริง
    spawnIntervalMul: ()=> stormOn ? 0.58 : 1.0,

    // ✅ tilt shimmer
    tiltShimmer: true,
    tiltIntensity: 1.15,
    tiltSmoothing: 0.90,

    // ✅ judge callback
    judge: (ch, ctx)=> doHit(ch, ctx),

    // expire: ถ้าของดีหมดอายุ—ลดคอมโบนิดเดียว
    onExpire: ({isGood, itemType})=>{
      if (stopped) return;
      if (itemType==='bad') return; // junk expire ไม่ลงโทษ
      // miss soft: ทำให้คอมโบตก
      combo = Math.max(0, combo-1);
      updateHud();
    }
  });

  // ----------------------
  // End game
  // ----------------------
  function endGame(){
    if (stopped) return;
    stopped = true;

    // stop spawner
    try{ inst && inst.stop && inst.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTimeEv); }catch{}

    // final goal2 decide
    const badSum = lowSec + highSec;
    const g1 = (greenSec >= goalGreenTarget);
    const g2 = (badSum <= badZoneLimit);
    goalsDone = (g1?1:0) + (g2?1:0);

    const grade = gradeFromScore(score);

    // dispatch end
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', { detail:{
        score, miss, comboBest: comboMax,
        grade,
        water, zone,
        greenSec, lowSec, highSec,
        goalsDone, goalsTotal,
        minisDone, minisTotal,
        perfectHits
      }}));
    }catch{}
  }

  // expose stop (manual)
  function stop(){
    if (stopped) return;
    stopped = true;
    try{ inst && inst.stop && inst.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTimeEv); }catch{}
    try{ if (rafView) ROOT.cancelAnimationFrame(rafView); }catch{}
    try{
      if (pf){
        pf.removeEventListener('pointerdown', onDown);
        pf.removeEventListener('pointermove', onMove);
        pf.removeEventListener('touchstart', onDown);
        pf.removeEventListener('touchmove', onMove);
      }
      ROOT.removeEventListener('pointerup', onUp);
      ROOT.removeEventListener('touchend', onUp);
    }catch{}
  }

  return { stop };
}

export default { boot };
