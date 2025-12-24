// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY/RESEARCH)
// ✅ Play: target size ADAPTIVE (skill-based) + difficulty baseline
// ✅ Research: target size FIXED by difficulty only (no adaptive)
// ✅ spawn spread fix via mode-factory randomRing + best-candidate fallback
// ✅ Auto-hide HUD + Peek
// ✅ Gyro limit + calibration
// ✅ Endscreen fallback (กันจอดำ)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function $id(id){ return document.getElementById(id); }
function dispatch(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, };

function getFeverUI(){ return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null; }

const url = (()=>{ try{return new URL(ROOT.location.href);}catch{return null;} })();
const DEBUG = !!(url && url.searchParams.get('debug')==='1');

const TUNE = {
  goodWaterPush:+6,
  junkWaterPush:-10,
  waterDriftPerSec:-0.9,

  scoreGood:18,
  scorePower:28,
  scoreJunk:-25,
  scorePerfectBonus:10,

  feverGainGood:10,
  feverGainPower:16,
  feverLoseJunk:20,
  feverAutoDecay:1.1,

  feverTriggerAt:100,
  feverDurationSec:6,

  shieldOnFeverStart:2,
  shieldMax:6,

  missOnGoodExpire:true,

  lookMaxX:380,
  lookMaxY:290,
  lookPxPerDegX:8.2,
  lookPxPerDegY:6.8,
  lookSmooth:0.10,

  lookMaxStepX: 9.5,
  lookMaxStepY: 7.5,

  gyroDeadGamma: 1.6,
  gyroDeadBeta:  2.0,
  gyroBiasBeta:  18,

  urgencyAtSec:10,
  urgencyBeepHz:920,

  stormEverySec:18,
  stormDurationSec:5,
  stormIntervalMul:0.72,

  hudHideAfterSec: 2.2,
  hudPeekMs: 1600,

  // ---- Target size baseline per difficulty ----
  sizeBaseByDiff: { easy: 1.10, normal: 1.00, hard: 0.90 },

  // ---- Play adaptive (skill) ----
  adaptMin: 0.78,
  adaptMax: 1.22,
  adaptStepDown: 0.035,
  adaptStepUp:   0.045,
  adaptEveryHits: 8,
  adaptWindow: 16,
};

function ensureEndHost(){
  let end = $id('hvr-end');
  if (end) return end;
  end = document.createElement('div');
  end.id='hvr-end';
  end.style.position='fixed';
  end.style.inset='0';
  end.style.zIndex='90';
  end.style.display='none';
  end.style.alignItems='center';
  end.style.justifyContent='center';
  end.style.padding='18px';
  end.style.background='rgba(2,6,23,.55)';
  end.style.backdropFilter='blur(10px)';
  document.body.appendChild(end);
  return end;
}

function ensureHudAutoHide(){
  const hud = document.querySelector('.hud');
  if (!hud) return { touch(){}, peek(){}, destroy(){} };

  function setCompact(){
    hud.classList.add('hud-compact');
    if (!document.getElementById('hud-compact-style')){
      const s=document.createElement('style');
      s.id='hud-compact-style';
      s.textContent=`
        .hud{ transition: transform .18s ease, opacity .18s ease; }
        .hud.hud-hidden{ opacity:0; transform:translate3d(0,-14px,0); }
        .hud.hud-compact .card{ padding:10px 12px 10px !important; }
      `;
      document.head.appendChild(s);
    }
  }

  let hideTimer=null;
  function scheduleHide(){
    try{ if (hideTimer) clearTimeout(hideTimer); }catch{}
    hideTimer = setTimeout(()=>{ hud.classList.add('hud-hidden'); }, TUNE.hudHideAfterSec*1000);
  }
  function touch(){
    hud.classList.remove('hud-hidden');
    scheduleHide();
  }
  function peek(){
    hud.classList.remove('hud-hidden');
    scheduleHide();
    setTimeout(()=>{ hud.classList.add('hud-hidden'); }, TUNE.hudPeekMs);
  }

  const onPointerDown = ()=> touch();
  ROOT.addEventListener('pointerdown', onPointerDown, { passive:true });

  setCompact();
  scheduleHide();

  return {
    touch, peek,
    destroy(){
      try{ ROOT.removeEventListener('pointerdown', onPointerDown); }catch{}
      try{ if (hideTimer) clearTimeout(hideTimer); }catch{}
      hideTimer=null;
    }
  };
}

export async function boot(opts = {}){
  const difficulty = String(opts.difficulty || (url?.searchParams.get('diff')||'easy') || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? (parseInt(url?.searchParams.get('time')||'90',10)||90), 20, 180);

  const runMode = String(opts.runMode || (url?.searchParams.get('run')||url?.searchParams.get('mode')||'play')).toLowerCase();
  const seed    = String(opts.seed || (url?.searchParams.get('seed')||'')).trim();

  ensureWaterGauge();

  const playfield = $id('hvr-playfield');
  if (!playfield){
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  let boundsEl = $id('hvr-bounds') || $id('hvr-stage');
  if (!boundsEl){
    boundsEl = document.createElement('div');
    boundsEl.id='hvr-bounds';
    boundsEl.style.position='fixed';
    boundsEl.style.inset='0';
    boundsEl.style.pointerEvents='none';
    document.body.appendChild(boundsEl);
  }

  playfield.style.willChange='transform';
  playfield.style.transform='translate3d(0,0,0)';

  const FeverUI = getFeverUI();
  if (FeverUI?.ensureFeverBar) {
    FeverUI.ensureFeverBar();
    FeverUI.setFever?.(0);
    FeverUI.setFeverActive?.(false);
    FeverUI.setShield?.(0);
  }

  // ---------- Target size controller ----------
  const baseScale = (TUNE.sizeBaseByDiff[difficulty] ?? 1.0);

  // ✅ Corrected: play = adaptive, research = fixed
  const adaptiveEnabled = (runMode === 'play');

  const adapt = {
    factor: 1.0,
    buf: [],
    hits: 0
  };

  function recordOutcome(isSuccess){
    if (!adaptiveEnabled) return;
    adapt.hits++;
    adapt.buf.push(isSuccess ? 1 : 0);
    while (adapt.buf.length > TUNE.adaptWindow) adapt.buf.shift();

    if ((adapt.hits % TUNE.adaptEveryHits) !== 0) return;

    const sum = adapt.buf.reduce((a,b)=>a+b,0);
    const rate = adapt.buf.length ? (sum / adapt.buf.length) : 0.5;

    // เก่งขึ้น → เป้าเล็กลง / พลาดเยอะ → เป้าใหญ่ขึ้น
    if (rate >= 0.82){
      adapt.factor = clamp(adapt.factor - TUNE.adaptStepDown, TUNE.adaptMin, TUNE.adaptMax);
      dispatch('hha:coach',{ text:`🎯 Play Adaptive: เก่งมาก! ลดขนาดเป้าลงนิดนึง (${Math.round(adapt.factor*100)}%)`, mood:'happy' });
    } else if (rate <= 0.58){
      adapt.factor = clamp(adapt.factor + TUNE.adaptStepUp, TUNE.adaptMin, TUNE.adaptMax);
      dispatch('hha:coach',{ text:`🛟 Play Adaptive: เพิ่มขนาดเป้าให้พอดีมือ (${Math.round(adapt.factor*100)}%)`, mood:'neutral' });
    }
  }

  function currentTargetScale(){
    return baseScale * (adaptiveEnabled ? adapt.factor : 1.0);
  }

  const state = {
    diff:difficulty,
    mode:runMode,
    seed,
    timeLeft:duration,
    score:0, combo:0, comboBest:0, miss:0,
    waterPct:50, zone:'GREEN', greenTick:0,

    fever:0, feverActive:false, feverLeft:0, shield:0,

    lookTX:0, lookTY:0,
    lookVX:0, lookVY:0,

    gyroCenterGamma:0,
    gyroCenterBeta: 18,

    stormLeft:0,
    stopped:false
  };

  const Q = createHydrationQuest(difficulty);
  const HUD = ensureHudAutoHide();

  ROOT.HHA_ACTIVE_INST = { stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} } };

  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function calcProgress(){
    const goalsDone = (Q.goals||[]).filter(g=>g._done||g.done).length;
    const minisDone = (Q.minis||[]).filter(m=>m._done||m.done).length;
    const prog = clamp((state.score/1200)*0.70 + (goalsDone/2)*0.20 + (minisDone/3)*0.10, 0, 1);
    return { prog, goalsDone, minisDone };
  }

  function updateScoreHud(label){
    const { prog } = calcProgress();
    const progPct = Math.round(prog*100);

    $id('hha-grade-progress-fill') && ($id('hha-grade-progress-fill').style.width = progPct+'%');
    $id('hha-grade-progress-text') && ($id('hha-grade-progress-text').textContent = `Progress to S (30%): ${progPct}%`);

    let grade='C';
    if (progPct>=95) grade='SSS';
    else if (progPct>=85) grade='SS';
    else if (progPct>=70) grade='S';
    else if (progPct>=50) grade='A';
    else if (progPct>=30) grade='B';
    $id('hha-grade-badge') && ($id('hha-grade-badge').textContent = grade);

    $id('hha-score-main') && ($id('hha-score-main').textContent = String(state.score|0));
    $id('hha-combo-max')  && ($id('hha-combo-max').textContent  = String(state.comboBest|0));
    $id('hha-miss')       && ($id('hha-miss').textContent       = String(state.miss|0));

    dispatch('hha:score',{
      score:state.score|0, combo:state.combo|0, comboBest:state.comboBest|0, miss:state.miss|0,
      zone:state.zone, water:Math.round(state.waterPct),
      fever:Math.round(state.fever), feverActive:!!state.feverActive, shield:state.shield|0,
      label:label||''
    });
  }

  function updateQuestHud(){
    const goalsDone = (Q.goals||[]).filter(g=>g._done||g.done).length;
    const minisDone = (Q.minis||[]).filter(m=>m._done||m.done).length;

    $id('hha-goal-count') && ($id('hha-goal-count').textContent = String(goalsDone));
    $id('hha-mini-count') && ($id('hha-mini-count').textContent = String(minisDone));

    $id('hha-quest-goal') && ($id('hha-quest-goal').textContent = Q.getGoalText ? `Goal: ${Q.getGoalText()}` : ($id('hha-quest-goal').textContent||'Goal: —'));
    $id('hha-quest-mini') && ($id('hha-quest-mini').textContent = Q.getMiniText ? `Mini: ${Q.getMiniText()}` : ($id('hha-quest-mini').textContent||'Mini: —'));

    dispatch('quest:update',{
      goalDone:goalsDone, goalTotal:(Q.goals||[]).length||2,
      miniDone:minisDone, miniTotal:(Q.minis||[]).length||3,
      goalText:$id('hha-quest-goal')?.textContent||'',
      miniText:$id('hha-quest-mini')?.textContent||'',
      mode: runMode
    });

    updateScoreHud();
    HUD.touch();
  }

  function feverRender(){
    const F=getFeverUI(); if(!F) return;
    F.setFever?.(state.fever);
    F.setFeverActive?.(state.feverActive);
    F.setShield?.(state.shield);
  }
  function feverStart(){
    state.feverActive=true;
    state.feverLeft=TUNE.feverDurationSec;
    state.fever=100;
    state.shield = clamp(state.shield + 2, 0, 6);
    feverRender();
    dispatch('hha:fever',{state:'start',value:state.fever,active:true,shield:state.shield});
    dispatch('hha:coach',{text:'🔥 FEVER! ยิงให้ไว คะแนนคูณ x2 + ได้เกราะ 🛡️', mood:'happy'});
    try{ Particles.celebrate?.('fever'); }catch{}
  }
  function feverEnd(){
    state.feverActive=false;
    state.feverLeft=0;
    state.fever = clamp(state.fever*0.35,0,100);
    feverRender();
    dispatch('hha:fever',{state:'end',value:state.fever,active:false,shield:state.shield});
    dispatch('hha:coach',{text:'FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral'});
  }
  function feverAdd(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever + (Number(v)||0),0,100);
    if (state.fever >= 100) feverStart();
    else feverRender();
  }
  function feverLose(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever - (Number(v)||0),0,100);
    feverRender();
  }

  function isPerfectHit(isGoodOrPower){
    if (!isGoodOrPower) return false;
    if (state.zone !== 'GREEN') return false;
    return (state.combo >= 5) || state.feverActive;
  }

  function judgeCore(ch, ctx){
    const isGood=!!ctx.isGood, isPower=!!ctx.isPower;
    let scoreDelta=0, label='GOOD';
    const mult = state.feverActive ? 2 : 1;

    if (isPower){ scoreDelta = 28*mult; label='POWER'; }
    else if (isGood){ scoreDelta = 18*mult; label='GOOD'; }
    else {
      if (state.shield>0){
        state.shield -= 1;
        feverRender();
        dispatch('hha:judge',{label:'BLOCK'});
        updateScoreHud('BLOCK');
        recordOutcome(true);
        return { scoreDelta:0, label:'BLOCK', good:false, blocked:true };
      }
      scoreDelta = -25;
      label='JUNK';
    }

    if (isGood || isPower){
      state.combo += 1;
      state.comboBest = Math.max(state.comboBest, state.combo);
    } else {
      state.combo=0;
      state.miss += 1;
    }

    const perfect = isPerfectHit(isGood || isPower);
    if (perfect){
      scoreDelta += 10*mult;
      label='PERFECT';
    }

    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + 6,0,100);
      feverAdd(isPower ? 16 : 10);
      Q.onGood();
      recordOutcome(true);
    } else {
      state.waterPct = clamp(state.waterPct - 10,0,100);
      feverLose(20);
      Q.onJunk();
      recordOutcome(false);
    }

    Q.updateScore(state.score);
    Q.updateCombo(state.combo);

    updateWaterHud();
    try{
      Particles.burstAt?.(ctx.clientX||0, ctx.clientY||0, label);
      Particles.scorePop?.(ctx.clientX||0, ctx.clientY||0, scoreDelta, label);
    }catch{}

    dispatch('hha:judge',{label});
    updateQuestHud();
    return { scoreDelta, label, good:(isGood||isPower) };
  }

  function onExpire(info){
    if (state.stopped) return;

    if (info?.isGood && !info?.isPower && true){
      state.miss += 1;
      state.combo = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge',{label:'MISS'});
      updateWaterHud();
      updateScoreHud('MISS');
      HUD.touch();
      recordOutcome(false);
    }
  }

  // --------------------- LOOK (drag) + gyro ---------------------
  let dragOn=false;
  let lastX=0,lastY=0;

  function applyLookTransform(){
    state.lookVX += (state.lookTX - state.lookVX) * 0.10;
    state.lookVY += (state.lookTY - state.lookVY) * 0.10;

    const dx = clamp(state.lookVX - (state._prevVX||0), -9.5, 9.5);
    const dy = clamp(state.lookVY - (state._prevVY||0), -7.5, 7.5);
    state._prevVX = (state._prevVX||0) + dx;
    state._prevVY = (state._prevVY||0) + dy;

    const x = clamp(-state._prevVX, -380, 380);
    const y = clamp(-state._prevVY, -290, 290);
    playfield.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function onPointerDown(ev){ dragOn=true; lastX=ev.clientX||0; lastY=ev.clientY||0; HUD.touch(); }
  function onPointerMove(ev){
    if(!dragOn) return;
    const x=ev.clientX||0, y=ev.clientY||0;
    const dx=x-lastX, dy=y-lastY;
    lastX=x; lastY=y;
    state.lookTX = clamp(state.lookTX + dx*1.15, -380, 380);
    state.lookTY = clamp(state.lookTY + dy*0.98, -290, 290);
  }
  function onPointerUp(){ dragOn=false; }

  function onDeviceOrientation(e){
    const gRaw = Number(e.gamma);
    const bRaw = Number(e.beta);
    if(!Number.isFinite(gRaw) || !Number.isFinite(bRaw)) return;

    let g = gRaw - (state.gyroCenterGamma||0);
    let b = bRaw - (state.gyroCenterBeta||18);

    if (Math.abs(g) < 1.6) g=0;
    if (Math.abs(b) < 2.0) b=0;

    const tx = g * 8.2;
    const ty = (b) * 6.8;

    state.lookTX = clamp(state.lookTX*0.65 + tx*0.35, -380, 380);
    state.lookTY = clamp(state.lookTY*0.65 + ty*0.35, -290, 290);
  }

  async function requestGyroPermission(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D || typeof D.requestPermission !== 'function') return;
      const res = await D.requestPermission();
      if (res==='granted'){
        ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
        dispatch('hha:coach',{text:'✅ เปิด Gyro แล้ว! หมุนมือถือ = หันมุมมองเหมือน VR 🕶️', mood:'happy'});
      } else {
        dispatch('hha:coach',{text:'ℹ️ Gyro ไม่ได้อนุญาต ใช้ลากจอแทนได้เลย 👍', mood:'neutral'});
      }
    }catch{
      dispatch('hha:coach',{text:'ℹ️ ใช้ลากจอแทนได้เลย (Gyro ไม่พร้อม)', mood:'neutral'});
    }
  }

  let lastTap=0;
  function onTapForCalibrate(){
    const now=Date.now();
    if (now-lastTap < 350){
      state.gyroCenterGamma = 0;
      state.gyroCenterBeta  = 18;
      state.lookTX = 0; state.lookTY = 0;
      dispatch('hha:coach',{text:'🎯 รีเซ็ตมุมมองแล้ว!', mood:'happy'});
      HUD.peek();
    }
    lastTap=now;
  }

  // --------------------- Time / storm / urgency ---------------------
  let timer=null;
  let rafId=null;
  let audioCtx=null;

  function beep(freq,dur){
    try{
      audioCtx = audioCtx || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
      const o=audioCtx.createOscillator();
      const g=audioCtx.createGain();
      o.type='sine'; o.frequency.value=freq||880;
      g.gain.value=0.04;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur||0.05));
    }catch{}
  }

  function secondTick(){
    if (state.stopped) return;

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time',{sec:state.timeLeft});

    state.waterPct = clamp(state.waterPct - 0.9,0,100);
    updateWaterHud();
    state.zone = zoneFrom(state.waterPct);

    if (state.zone==='GREEN'){
      state.greenTick += 1;
      if (Q?.stats){
        Q.stats.zone='GREEN';
        Q.stats.greenTick=(Q.stats.greenTick|0)+1;
      }
    } else if (Q?.stats){
      Q.stats.zone=state.zone;
    }

    Q.second();

    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft<=0) feverEnd();
      else { state.fever=100; feverRender(); }
    } else {
      state.fever = clamp(state.fever - 1.1,0,100);
      feverRender();
    }

    if (state.stormLeft>0) state.stormLeft -= 1;
    if (state.timeLeft>0 && (state.timeLeft % 18)===0){
      state.stormLeft = 5;
      dispatch('hha:coach',{text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy'});
      try{ Particles.toast?.('STORM WAVE!','warn'); }catch{}
      HUD.touch();
    }

    if (state.timeLeft>0 && state.timeLeft<=10){
      beep(920,0.04);
      if (state.timeLeft===10){
        dispatch('hha:coach',{text:'⏳ ใกล้หมดเวลา! รักษา GREEN + ยิงน้ำดีให้ไว!', mood:'sad'});
      }
    }

    updateQuestHud();

    if (state.timeLeft<=0) stop();
  }

  function rafLoop(){
    if (state.stopped) return;
    applyLookTransform();
    rafId = ROOT.requestAnimationFrame(rafLoop);
  }

  // --------------------- Spawner (mode-factory) ---------------------
  let spawner=null;

  spawner = await factoryBoot({
    modeKey:'hydration',

    // ✅ research มักอยาก reproducible: ถ้าไม่ใส่ seed ให้ default
    // ✅ play: ไม่บังคับ seed (แต่ถ้าใส่มาก็ใช้)
    seed: (runMode === 'research' ? (seed || 'research-default') : (seed || '')),

    spawnHost:'#hvr-playfield',
    boundsHost: boundsEl,

    spawnStrategy: 'randomRing',
    ringMin: 0.18,
    ringMax: 0.96,

    minSeparation: 0.88,
    maxSpawnTries: 18,
    dragThresholdPx: 11,

    spawnIntervalMul: ()=> (state.stormLeft>0 ? 0.72 : 1),

    // ✅ scale hook — play adaptive / research fixed
    getTargetScale: ()=> currentTargetScale(),

    baseSizePx: 118,
    spawnEverySec: 0.92,
    spawnJitterSec: 0.24,
    extraSpawnChance: 0.16,
    lifeMsBase: 1180,
    lifeMsJitter: 420,

    excludeSelectors: ['.hud', '#hvr-crosshair', '#hvr-end'],

    pools:{
      good:['💧','🥛','🍉','🥥','🍊'],
      bad: ['🥤','🧋','🍟','🍔']
    },
    goodRate: (difficulty==='hard')?0.55:(difficulty==='easy'?0.70:0.62),

    powerups:['⭐','🛡️','⏱️'],
    powerRate:(difficulty==='hard')?0.10:0.12,
    powerEvery:6,

    judge:(ch, ctx)=>{
      if (ctx.isPower && ch==='🛡️'){
        state.shield = clamp(state.shield+1,0,6);
        feverRender();
        dispatch('hha:judge',{label:'SHIELD+'});
        updateScoreHud('SHIELD+');
        try{ Particles.toast?.('+1 SHIELD 🛡️','good'); }catch{}
      }
      if (ctx.isPower && ch==='⏱️'){
        state.timeLeft = clamp(state.timeLeft+3,0,180);
        dispatch('hha:time',{sec:state.timeLeft});
        dispatch('hha:judge',{label:'TIME+'});
        try{ Particles.toast?.('+3s ⏱️','good'); }catch{}
      }
      if (state.stormLeft>0 && (ctx.isGood||ctx.isPower)){
        state.fever = clamp(state.fever+2,0,100);
      }
      return judgeCore(ch, ctx);
    },

    onExpire:(info)=>{
      if (state.stormLeft>0 && info?.isGood && !info?.isPower){
        state.waterPct = clamp(state.waterPct-2,0,100);
      }
      onExpire(info);
    }
  });

  // init HUD
  updateWaterHud();
  if (Q?.stats){ Q.stats.zone = zoneFrom(state.waterPct); Q.stats.greenTick=0; }
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // input listeners
  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });
  ROOT.addEventListener('pointerdown', onTapForCalibrate, { passive:true });

  // gyro: if available without permission
  try{
    const D = ROOT.DeviceOrientationEvent;
    if (D && typeof D.requestPermission !== 'function'){
      ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
  }catch{}

  // ask gyro permission on first touch
  const onceAsk = async ()=>{
    ROOT.removeEventListener('pointerdown', onceAsk);
    await requestGyroPermission();
  };
  ROOT.addEventListener('pointerdown', onceAsk, { passive:true });

  timer = ROOT.setInterval(secondTick, 1000);
  rafId = ROOT.requestAnimationFrame(rafLoop);

  const onStop = ()=> stop();
  ROOT.addEventListener('hha:stop', onStop);

  const onTime = (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec<=0) stop();
  };
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function showEndScreen(payload){
    const end = ensureEndHost();
    end.classList.add('on');
    end.style.display='flex';
    end.innerHTML = `
      <div style="max-width:520px;width:100%;background:rgba(2,6,23,.72);border:1px solid rgba(148,163,184,.22);
        border-radius:22px; padding:18px 16px; box-shadow:0 24px 70px rgba(0,0,0,.6);">
        <div style="font-weight:900;font-size:22px;margin-bottom:10px;">🏁 Hydration — Summary</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <span style="padding:6px 10px;border:1px solid rgba(148,163,184,.22);border-radius:999px;">Score <b>${payload.score}</b></span>
          <span style="padding:6px 10px;border:1px solid rgba(148,163,184,.22);border-radius:999px;">Miss <b>${payload.miss}</b></span>
          <span style="padding:6px 10px;border:1px solid rgba(148,163,184,.22);border-radius:999px;">ComboMax <b>${payload.comboBest}</b></span>
          <span style="padding:6px 10px;border:1px solid rgba(148,163,184,.22);border-radius:999px;">Water <b>${payload.water}%</b></span>
          <span style="padding:6px 10px;border:1px solid rgba(148,163,184,.22);border-radius:999px;">GREEN time <b>${payload.greenTick}s</b></span>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
          <button id="hvr-restart" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.25);
            background:rgba(34,197,94,.18);color:#e5e7eb;font-weight:900;">Restart</button>
          <button id="hvr-close" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.25);
            background:rgba(2,6,23,.55);color:#e5e7eb;font-weight:900;">Close</button>
        </div>
        ${DEBUG ? `<div style="margin-top:10px;color:#94a3b8;font-size:12px;">debug=1 enabled • mode=${runMode} • scale=${(currentTargetScale()).toFixed(2)}</div>`:''}
      </div>
    `;
    document.getElementById('hvr-restart')?.addEventListener('click', ()=> location.reload(), { passive:true });
    document.getElementById('hvr-close')?.addEventListener('click', ()=>{ end.classList.remove('on'); end.style.display='none'; }, { passive:true });
  }

  function stop(){
    if (state.stopped) return;
    state.stopped=true;

    let payload=null;

    try{
      payload = {
        score: state.score|0,
        miss: state.miss|0,
        comboBest: state.comboBest|0,
        water: Math.round(state.waterPct),
        zone: state.zone,
        greenTick: (Q?.stats?.greenTick|0) || (state.greenTick|0)
      };

      dispatch('hha:end', payload);
      dispatch('hha:coach', { text:'🏁 จบเกม! ดูผลคะแนนและเควสได้เลย', mood:'happy' });
      try{ Particles.celebrate?.('end'); }catch{}
    } finally {
      try{ if (timer) ROOT.clearInterval(timer); }catch{} timer=null;
      try{ if (rafId!=null) ROOT.cancelAnimationFrame(rafId); }catch{} rafId=null;
      try{ spawner?.stop?.(); }catch{}
      try{ HUD.destroy(); }catch{}

      try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation, true); }catch{}
      try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch{}
      try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch{}
      try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch{}
      try{ ROOT.removeEventListener('pointerdown', onTapForCalibrate); }catch{}

      showEndScreen(payload || {score:0,miss:0,comboBest:0,water:0,greenTick:0});
    }
  }

  // initial coach hint
  dispatch('hha:coach', {
    text: adaptiveEnabled
      ? '🎮 Play Adaptive: เป้าจะปรับใหญ่/เล็กตามฝีมือของคุณ'
      : '🧪 Research Fixed: เป้าคงที่ตามระดับ easy/normal/hard',
    mood:'neutral'
  });

  return { stop };
}

export default { boot };