// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// ✅ ULTIMATE PACK: A+B+C + Tap-anywhere shoot crosshair + Anti-stuck spawn support
// ✅ Auto-hide HUD + Peek
// ✅ Gyro stable (เอียงนิดเดียวไม่หนี) + double-tap reset view
// ✅ Drag threshold (ลาก=look ไม่ใช่ tap) + ยิงกลางจอเมื่อเป็น “tap”
// ✅ Endscreen fallback (กันจอดำ) + debug=1
// ✅ GREEN Risk/Reward + Combo milestones + Final Rush (tick/flash) + Boss 3-hit
// ✅ Freeze 🧊 / Magnet ⭐ / Shield 🛡️ / Time ⏱️ / Trick 🍭
// ✅ Fix: postfx canvas ไม่บังเป้า

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
  // water
  goodWaterPush:+6,
  junkWaterPush:-10,
  waterDriftPerSec:-0.9,

  // score
  scoreGood:18,
  scorePower:28,
  scoreJunk:-25,
  scorePerfectBonus:10,

  // zone risk/reward
  zoneScoreMulGreen: 1.20,
  zoneScoreMulOff:   0.80,
  zoneFeverMulGreen: 1.20,
  zoneFeverMulOff:   0.85,

  // fever
  feverGainGood:10,
  feverGainPower:16,
  feverLoseJunk:20,
  feverAutoDecay:1.1,

  feverTriggerAt:100,
  feverDurationSec:6,

  shieldOnFeverStart:2,
  shieldMax:6,

  missOnGoodExpire:true,

  // look (drag+gyro) — ลดความไวลงให้ “ไม่วิ่งหนี”
  lookMaxX:340,
  lookMaxY:250,
  lookPxPerDegX:6.2,
  lookPxPerDegY:4.9,
  lookSmooth:0.10,

  lookMaxStepX: 6.8,
  lookMaxStepY: 5.6,

  gyroDeadGamma: 1.9,
  gyroDeadBeta:  2.4,
  gyroBiasBeta:  18,

  // input (tap vs drag)
  dragThresholdPx: 12,       // ถ้าขยับเกินนี้ = drag (ไม่ยิง)
  tapMaxMs: 260,             // tap สั้น ๆ เท่านั้น
  tapCooldownMs: 38,         // กันยิงถี่เกิน

  urgencyAtSec:10,
  urgencyBeepHz:920,

  stormEverySec:18,
  stormDurationSec:5,
  stormIntervalMul:0.72,

  // Final Rush
  rushAtSec: 8,
  rushSpawnMul: 0.62,
  rushScoreMul: 1.5,
  rushTickHz: 1020,

  // combo milestones
  comboMilestones: [5, 10, 15],
  comboRewardTimeAt10: 2,
  comboRewardShieldAt15: 1,

  // power durations
  freezeSec: 2,
  magnetSec: 2,

  // boss
  bossEverySpawns: 11,
  bossHp: 3,
  bossEmoji: '💧',

  // haptics
  vibeOnJunkMs: 35,
  vibeOnPerfectMs: 18,
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
  if (!hud) return { touch(){}, peek(){}, setCompact(){}, destroy(){} };

  function setCompact(){
    hud.classList.add('hud-compact');
    if (!document.getElementById('hud-compact-style')){
      const s=document.createElement('style');
      s.id='hud-compact-style';
      s.textContent=`
        .hud{ transition: transform .18s ease, opacity .18s ease; }
        .hud.hud-hidden{ opacity:0; transform:translate3d(0,-14px,0); pointer-events:none; }
        .hud.hud-compact .card{ padding:10px 12px 10px !important; min-width:200px !important; }
        .hud.hud-compact .title{ font-size:18px !important; }
        .hud.hud-compact #hha-water-card .muted:last-child{ display:none; }
      `;
      document.head.appendChild(s);
    }
  }

  let hideTimer=null;
  function scheduleHide(){
    try{ if (hideTimer) clearTimeout(hideTimer); }catch{}
    hideTimer = setTimeout(()=>{ hud.classList.add('hud-hidden'); }, 2200);
  }
  function touch(){
    hud.classList.remove('hud-hidden');
    scheduleHide();
  }
  function peek(){
    hud.classList.remove('hud-hidden');
    scheduleHide();
    setTimeout(()=>{ hud.classList.add('hud-hidden'); }, 1600);
  }

  const onPointerDown = ()=> touch();
  ROOT.addEventListener('pointerdown', onPointerDown, { passive:true });

  setCompact();
  scheduleHide();

  return {
    touch, peek, setCompact,
    destroy(){
      try{ ROOT.removeEventListener('pointerdown', onPointerDown); }catch{}
      try{ if (hideTimer) clearTimeout(hideTimer); }catch{}
      hideTimer=null;
    }
  };
}

// ---------- Panic overlay ----------
function ensurePanicLayer(){
  let el = document.getElementById('hvr-panic');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'hvr-panic';
  el.style.position='fixed';
  el.style.inset='0';
  el.style.zIndex='55';
  el.style.pointerEvents='none';
  el.style.opacity='0';
  el.style.transition='opacity .14s ease';
  el.style.background = `
    radial-gradient(900px 700px at 20% 30%, rgba(56,189,248,.14), transparent 55%),
    radial-gradient(800px 650px at 80% 25%, rgba(167,139,250,.12), transparent 60%),
    radial-gradient(1200px 900px at 50% 90%, rgba(34,197,94,.08), transparent 70%)
  `;
  el.style.mixBlendMode = 'screen';
  document.body.appendChild(el);
  return el;
}
function panicOn(level=1){
  const el = ensurePanicLayer();
  el.style.opacity = String(clamp(0.10 + level*0.07, 0.10, 0.34));
}
function panicOff(){
  const el = ensurePanicLayer();
  el.style.opacity = '0';
}

// ---------- Edge flash + mild shake ----------
function ensureEdgeFX(){
  let el = document.getElementById('hvr-edgefx');
  if (el) return el;
  el = document.createElement('div');
  el.id='hvr-edgefx';
  el.style.position='fixed';
  el.style.inset='0';
  el.style.zIndex='58';
  el.style.pointerEvents='none';
  el.style.opacity='0';
  el.style.transition='opacity .08s ease';
  el.style.boxShadow='inset 0 0 0 3px rgba(255,255,255,0.0)';
  document.body.appendChild(el);

  if (!document.getElementById('hvr-edgefx-style')){
    const s=document.createElement('style');
    s.id='hvr-edgefx-style';
    s.textContent=`
      .hvr-shake-soft{ animation: hvrShakeSoft .14s ease-in-out 1; }
      @keyframes hvrShakeSoft{
        0%{ transform: translate3d(0,0,0); }
        25%{ transform: translate3d(-2px,0,0); }
        50%{ transform: translate3d(2px,0,0); }
        75%{ transform: translate3d(-1px,0,0); }
        100%{ transform: translate3d(0,0,0); }
      }
    `;
    document.head.appendChild(s);
  }
  return el;
}
function edgeFlash(kind='rush'){
  const el = ensureEdgeFX();
  if (kind==='rush'){
    el.style.boxShadow='inset 0 0 0 3px rgba(250,204,21,0.26), inset 0 0 24px rgba(250,204,21,0.12)';
  } else if (kind==='storm'){
    el.style.boxShadow='inset 0 0 0 3px rgba(56,189,248,0.24), inset 0 0 26px rgba(56,189,248,0.10)';
  } else if (kind==='junk'){
    el.style.boxShadow='inset 0 0 0 3px rgba(248,113,113,0.22), inset 0 0 26px rgba(248,113,113,0.10)';
  } else {
    el.style.boxShadow='inset 0 0 0 3px rgba(255,255,255,0.16), inset 0 0 22px rgba(255,255,255,0.06)';
  }
  el.style.opacity='1';
  setTimeout(()=>{ el.style.opacity='0'; }, 90);
}
function shakeSoft(){
  try{
    document.body.classList.remove('hvr-shake-soft');
    void document.body.offsetWidth;
    document.body.classList.add('hvr-shake-soft');
  }catch{}
}

export async function boot(opts = {}){
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureWaterGauge();

  const playfield = $id('hvr-playfield');
  if (!playfield){
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  // ✅ FIX: postfx canvas อย่าบังเป้า
  const postfx = $id('hvr-postfx');
  if (postfx){
    postfx.style.zIndex = '6';
    postfx.style.opacity = '0.55';
    postfx.style.pointerEvents = 'none';
  }

  // bounds layer (not transformed)
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

  const state = {
    diff:difficulty,
    timeLeft:duration,
    score:0, combo:0, comboBest:0, miss:0,
    waterPct:50, zone:'GREEN', greenTick:0,

    fever:0, feverActive:false, feverLeft:0, shield:0,

    lookTX:0, lookTY:0,
    lookVX:0, lookVY:0,
    _prevVX:0, _prevVY:0,

    gyroCenterGamma:0,
    gyroCenterBeta: TUNE.gyroBiasBeta,

    stormLeft:0,
    stopped:false,

    rushOn:false,
    freezeLeft:0,
    magnetLeft:0,
    lastMilestone:0,

    lastTapFireAt:0,
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

    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct+'%';
    if (txt)  txt.textContent = `Progress to S (30%): ${progPct}%`;

    let grade='C';
    if (progPct>=95) grade='SSS';
    else if (progPct>=85) grade='SS';
    else if (progPct>=70) grade='S';
    else if (progPct>=50) grade='A';
    else if (progPct>=30) grade='B';
    const gb=$id('hha-grade-badge'); if (gb) gb.textContent = grade;

    const sc=$id('hha-score-main'); if (sc) sc.textContent = String(state.score|0);
    const cb=$id('hha-combo-max');  if (cb) cb.textContent = String(state.comboBest|0);
    const ms=$id('hha-miss');       if (ms) ms.textContent = String(state.miss|0);

    dispatch('hha:score',{
      score:state.score|0, combo:state.combo|0, comboBest:state.comboBest|0, miss:state.miss|0,
      zone:state.zone, water:Math.round(state.waterPct),
      fever:Math.round(state.fever), feverActive:!!state.feverActive, shield:state.shield|0,
      label:label||''
    });
  }

  function updateQuestHud(){
    const goalsView = Q.getProgress('goals');
    const minisView = Q.getProgress('mini');
    const allGoals=Q.goals||[], allMinis=Q.minis||[];
    const goalsDone = allGoals.filter(g=>g._done||g.done).length;
    const minisDone = allMinis.filter(m=>m._done||m.done).length;

    const gc=$id('hha-goal-count'); if (gc) gc.textContent = String(goalsDone);
    const mc=$id('hha-mini-count'); if (mc) mc.textContent = String(minisDone);

    const curGoalId = (goalsView?.[0]?.id) || (allGoals[0]?.id||'');
    const curMiniId = (minisView?.[0]?.id) || (allMinis[0]?.id||'');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoalId) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMiniId) : null;

    const gEl=$id('hha-quest-goal');
    const mEl=$id('hha-quest-mini');
    if (gEl) gEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : 'Goal: ทำภารกิจให้ครบ';
    if (mEl) mEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : 'Mini: ทำมินิเควส';

    dispatch('quest:update',{
      goalDone:goalsDone, goalTotal:allGoals.length||2,
      miniDone:minisDone, miniTotal:allMinis.length||3,
      goalText:gEl?.textContent||'',
      miniText:mEl?.textContent||''
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
    state.feverLeft=6;
    state.fever=100;
    state.shield = clamp(state.shield + 2, 0, TUNE.shieldMax);
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

  function zoneMulScore(){ return (state.zone === 'GREEN') ? TUNE.zoneScoreMulGreen : TUNE.zoneScoreMulOff; }
  function zoneMulFever(){ return (state.zone === 'GREEN') ? TUNE.zoneFeverMulGreen : TUNE.zoneFeverMulOff; }
  function rushMulScore(){ return state.rushOn ? TUNE.rushScoreMul : 1; }

  function onComboMilestone(){
    const m = state.combo;
    if (m <= state.lastMilestone) return;
    if (!TUNE.comboMilestones.includes(m)) return;
    state.lastMilestone = m;

    if (m === 5){
      dispatch('hha:coach',{text:'⚡ COMBO 5! โคตรดี! รักษา GREEN ต่อ!', mood:'happy'});
      try{ Particles.toast?.('COMBO x5!','good'); }catch{}
    }
    if (m === 10){
      state.timeLeft = clamp(state.timeLeft + TUNE.comboRewardTimeAt10, 0, 180);
      dispatch('hha:time',{sec:state.timeLeft});
      dispatch('hha:coach',{text:`🔥 COMBO 10! +${TUNE.comboRewardTimeAt10}s ⏱️`, mood:'happy'});
      try{ Particles.toast?.(`+${TUNE.comboRewardTimeAt10}s ⏱️`,'good'); }catch{}
    }
    if (m === 15){
      state.shield = clamp(state.shield + TUNE.comboRewardShieldAt15, 0, TUNE.shieldMax);
      feverRender();
      dispatch('hha:coach',{text:`👑 COMBO 15! +${TUNE.comboRewardShieldAt15} SHIELD 🛡️`, mood:'happy'});
      try{ Particles.toast?.(`+${TUNE.comboRewardShieldAt15} SHIELD 🛡️`,'good'); }catch{}
    }
    HUD.peek();
  }

  function isPerfectHit(isGoodOrPower, ctx){
    if (!isGoodOrPower) return false;
    if (ctx && ctx.hitPerfect) return true;     // perfect ring จาก mode-factory
    if (state.zone !== 'GREEN') return false;
    return (state.combo >= 5) || state.feverActive;
  }

  function vibrate(ms){
    try{ if (ROOT.navigator?.vibrate) ROOT.navigator.vibrate(ms|0); }catch{}
  }

  function judgeCore(ch, ctx){
    const isGood=!!ctx.isGood, isPower=!!ctx.isPower;
    const multFever = state.feverActive ? 2 : 1;

    let scoreDelta=0, label='GOOD';

    if (isPower){ scoreDelta = TUNE.scorePower; label='POWER'; }
    else if (isGood){ scoreDelta = TUNE.scoreGood; label = ctx.isBoss ? 'BOSS' : 'GOOD'; }
    else {
      if (state.shield>0){
        state.shield -= 1;
        feverRender();
        dispatch('hha:judge',{label:'BLOCK'});
        updateScoreHud('BLOCK');
        HUD.touch();
        return { scoreDelta:0, label:'BLOCK', good:false, blocked:true };
      }
      scoreDelta = TUNE.scoreJunk;
      label='JUNK';
    }

    // zone + rush
    if (isGood || isPower) scoreDelta = Math.round(scoreDelta * zoneMulScore() * rushMulScore());
    else scoreDelta = Math.round(scoreDelta * (state.rushOn ? 1.15 : 1));

    // fever
    scoreDelta = Math.round(scoreDelta * multFever);

    // combo/miss
    if (isGood || isPower){
      state.combo += 1;
      state.comboBest = Math.max(state.comboBest, state.combo);
      onComboMilestone();
    } else {
      state.combo=0;
      state.lastMilestone = 0;
      state.miss += 1;
      edgeFlash('junk'); shakeSoft(); vibrate(TUNE.vibeOnJunkMs);
    }

    // perfect
    const perfect = isPerfectHit(isGood || isPower, ctx);
    if (perfect){
      scoreDelta += Math.round(TUNE.scorePerfectBonus * multFever * (state.rushOn ? 1.25 : 1));
      label='PERFECT';
      vibrate(TUNE.vibeOnPerfectMs);
      if (!state.feverActive) state.fever = clamp(state.fever + 4, 0, 100);
    }

    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    // water + fever
    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush,0,100);
      const feverGain = (isPower ? TUNE.feverGainPower : TUNE.feverGainGood) * zoneMulFever();
      feverAdd(feverGain);
      Q.onGood();
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.junkWaterPush,0,100);
      feverLose(TUNE.feverLoseJunk);
      Q.onJunk();
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
    if (info?.isGood && !info?.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.lastMilestone = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge',{label:'MISS'});
      updateWaterHud();
      updateScoreHud('MISS');
      HUD.touch();
    }
  }

  // --------------------- LOOK (drag) + gyro ---------------------
  let dragOn=false;
  let downX=0, downY=0, lastX=0, lastY=0;
  let downTs=0;
  let movedPx=0;

  function applyLookTransform(){
    state.lookVX += (state.lookTX - state.lookVX) * TUNE.lookSmooth;
    state.lookVY += (state.lookTY - state.lookVY) * TUNE.lookSmooth;

    const dx = clamp(state.lookVX - (state._prevVX||0), -TUNE.lookMaxStepX, TUNE.lookMaxStepX);
    const dy = clamp(state.lookVY - (state._prevVY||0), -TUNE.lookMaxStepY, TUNE.lookMaxStepY);
    state._prevVX = (state._prevVX||0) + dx;
    state._prevVY = (state._prevVY||0) + dy;

    const x = clamp(-state._prevVX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const y = clamp(-state._prevVY, -TUNE.lookMaxY, TUNE.lookMaxY);
    playfield.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function onPointerDown(ev){
    dragOn=true;
    downX = lastX = ev.clientX||0;
    downY = lastY = ev.clientY||0;
    downTs = Date.now();
    movedPx = 0;
    HUD.touch();
  }
  function onPointerMove(ev){
    if(!dragOn) return;
    const x=ev.clientX||0, y=ev.clientY||0;
    const dx=x-lastX, dy=y-lastY;
    lastX=x; lastY=y;

    movedPx += Math.abs(dx) + Math.abs(dy);

    state.lookTX = clamp(state.lookTX + dx*1.05, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy*0.90, -TUNE.lookMaxY, TUNE.lookMaxY);
  }

  let spawner=null;

  function tryTapFire(){
    if (!spawner?.shootCrosshair) return false;
    const now = Date.now();
    if (now - state.lastTapFireAt < TUNE.tapCooldownMs) return false;
    state.lastTapFireAt = now;

    const ok = spawner.shootCrosshair();
    if (ok){
      try{ Particles.burstAt?.(downX, downY, 'HIT'); }catch{}
    }
    return ok;
  }

  function onPointerUp(){
    const dt = Date.now() - downTs;
    const moved = movedPx;

    dragOn=false;

    // ✅ Tap-anywhere ยิงกลางจอ (ถ้าไม่ลาก)
    if (dt <= TUNE.tapMaxMs && moved <= TUNE.dragThresholdPx){
      tryTapFire();
    }
  }

  function onDeviceOrientation(e){
    const gRaw = Number(e.gamma);
    const bRaw = Number(e.beta);
    if(!Number.isFinite(gRaw) || !Number.isFinite(bRaw)) return;

    let g = gRaw - (state.gyroCenterGamma||0);
    let b = bRaw - (state.gyroCenterBeta||TUNE.gyroBiasBeta);

    if (Math.abs(g) < TUNE.gyroDeadGamma) g=0;
    if (Math.abs(b) < TUNE.gyroDeadBeta)  b=0;

    const tx = g * TUNE.lookPxPerDegX;
    const ty = (b) * TUNE.lookPxPerDegY;

    state.lookTX = clamp(state.lookTX*0.74 + tx*0.26, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY*0.74 + ty*0.26, -TUNE.lookMaxY, TUNE.lookMaxY);
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

  // double-tap reset view
  let lastTap=0;
  function onTapForReset(){
    const now=Date.now();
    if (now-lastTap < 350){
      state.gyroCenterGamma = 0;
      state.gyroCenterBeta  = TUNE.gyroBiasBeta;
      state.lookTX = 0; state.lookTY = 0;
      state._prevVX = 0; state._prevVY = 0;
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
      o.type='sine';
      o.frequency.value=freq||880;
      g.gain.value=0.04;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (dur||0.05));
    }catch{}
  }

  function secondTick(){
    if (state.stopped) return;

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time',{sec:state.timeLeft});

    state.rushOn = (state.timeLeft > 0 && state.timeLeft <= TUNE.rushAtSec);

    // rush tick/flash
    if (state.rushOn){
      beep(TUNE.rushTickHz, 0.03);
      edgeFlash('rush');
    }

    // water drift
    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec,0,100);
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

    if (state.freezeLeft > 0) state.freezeLeft -= 1;
    if (state.magnetLeft > 0) state.magnetLeft -= 1;

    Q.second();

    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft<=0) feverEnd();
      else { state.fever=100; feverRender(); }
    } else {
      state.fever = clamp(state.fever - TUNE.feverAutoDecay,0,100);
      feverRender();
    }

    // storm
    if (state.stormLeft>0) state.stormLeft -= 1;
    if (state.timeLeft>0 && (state.timeLeft % TUNE.stormEverySec)===0){
      state.stormLeft = TUNE.stormDurationSec;
      dispatch('hha:coach',{text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy'});
      try{ Particles.toast?.('STORM WAVE!','warn'); }catch{}
      edgeFlash('storm');
      HUD.touch();
    }

    // panic overlay
    if (state.stormLeft > 0) panicOn(2);
    else if (state.rushOn)   panicOn(1);
    else panicOff();

    // urgency beeps
    if (state.timeLeft>0 && state.timeLeft<=TUNE.urgencyAtSec){
      beep(TUNE.urgencyBeepHz,0.04);
      if (state.timeLeft===TUNE.urgencyAtSec){
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

  // --------------------- Spawner ---------------------
  spawner = await factoryBoot({
    modeKey:'hydration',
    difficulty,
    duration,

    spawnHost:'#hvr-playfield',
    boundsHost: boundsEl,

    spawnAroundCrosshair: ()=> (state.magnetLeft > 0),
    spawnStrategy: 'grid9',
    spawnRadiusX: ()=> (state.magnetLeft > 0 ? 0.42 : 0.98),
    spawnRadiusY: ()=> (state.magnetLeft > 0 ? 0.38 : 0.98),
    minSeparation: 0.92,
    maxSpawnTries: 22,

    // ส่งไปให้ mode-factory (พร้อมใช้)
    dragThresholdPx: TUNE.dragThresholdPx,

    spawnIntervalMul: ()=>{
      if (state.freezeLeft > 0) return 999;
      if (state.rushOn) return TUNE.rushSpawnMul;
      return (state.stormLeft>0 ? TUNE.stormIntervalMul : 1);
    },

    excludeSelectors: ['.hud', '#hvr-crosshair', '#hvr-end'],

    pools:{
      good:['💧','🥛','🍉','🥥','🍊'],
      bad: ['🥤','🧋','🍟','🍔'],
      trick:['🍭']
    },

    trickRate: (difficulty==='hard') ? 0.12 : 0.09,
    goodRate: (difficulty==='hard')?0.55:(difficulty==='easy'?0.70:0.62),

    powerups:['⭐','🛡️','⏱️','🧊'],
    powerRate:(difficulty==='hard')?0.11:0.13,
    powerEvery:6,

    boss: {
      enabled: true,
      every: TUNE.bossEverySpawns,
      hp: TUNE.bossHp,
      emoji: TUNE.bossEmoji
    },

    judge:(ch, ctx)=>{
      // powers
      if (ctx.isPower && ch==='🛡️'){
        state.shield = clamp(state.shield+1,0,TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge',{label:'SHIELD+'});
        updateScoreHud('SHIELD+');
        try{ Particles.toast?.('+1 SHIELD 🛡️','good'); }catch{}
        HUD.peek();
      }
      if (ctx.isPower && ch==='⏱️'){
        state.timeLeft = clamp(state.timeLeft+3,0,180);
        dispatch('hha:time',{sec:state.timeLeft});
        dispatch('hha:judge',{label:'TIME+'});
        try{ Particles.toast?.('+3s ⏱️','good'); }catch{}
        HUD.peek();
      }
      if (ctx.isPower && ch==='🧊'){
        state.freezeLeft = TUNE.freezeSec;
        dispatch('hha:coach',{text:`🧊 FREEZE ${TUNE.freezeSec}s! หยุด spawn ชั่วคราว!`, mood:'happy'});
        try{ Particles.toast?.(`FREEZE ${TUNE.freezeSec}s 🧊`,'good'); }catch{}
        HUD.peek();
      }
      if (ctx.isPower && ch==='⭐'){
        state.magnetLeft = TUNE.magnetSec;
        dispatch('hha:coach',{text:`⭐ MAGNET ${TUNE.magnetSec}s! เป้าจะเข้ากลางยิงง่ายขึ้น!`, mood:'happy'});
        try{ Particles.toast?.(`MAGNET ${TUNE.magnetSec}s ⭐`,'good'); }catch{}
        HUD.peek();
      }

      // storm bonus fever small
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

  // input listeners (tap-anywhere fire)
  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });
  ROOT.addEventListener('pointerdown', onTapForReset, { passive:true });

  // gyro
  try{
    const D = ROOT.DeviceOrientationEvent;
    if (D && typeof D.requestPermission !== 'function'){
      ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
  }catch{}

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
        ${DEBUG ? `<div style="margin-top:10px;color:#94a3b8;font-size:12px;">debug=1 enabled</div>`:''}
      </div>
    `;
    const btnR = document.getElementById('hvr-restart');
    const btnC = document.getElementById('hvr-close');
    btnR && btnR.addEventListener('click', ()=>{ location.reload(); }, { passive:true });
    btnC && btnC.addEventListener('click', ()=>{ end.classList.remove('on'); end.style.display='none'; }, { passive:true });
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
      try{ panicOff(); }catch{}

      try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation, true); }catch{}
      try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch{}
      try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch{}
      try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch{}
      try{ ROOT.removeEventListener('pointerdown', onTapForReset); }catch{}

      showEndScreen(payload || {score:0,miss:0,comboBest:0,water:0,greenTick:0});
    }
  }

  return { stop };
}

export default { boot };