// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// ✅ A+B+C PACK: Arcade + Skill + Panic/Survival
// ✅ Auto-hide HUD (เหลือส่วนจำเป็น) + Peek
// ✅ Gyro limit (เอียงนิดเดียวไม่หนี) + calibration (double tap)
// ✅ Drag threshold (ลาก=look ไม่ใช่ tap) [ส่งให้ mode-factory]
// ✅ Endscreen fallback (กันจอดำ)
// ✅ debug=1 รองรับ
// ✅ GREEN Risk/Reward + Combo milestones + Final Rush + Boss + Freeze/Magnet + Panic overlay
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

  // look
  lookMaxX:360,
  lookMaxY:270,
  lookPxPerDegX:6.6,
  lookPxPerDegY:5.2,
  lookSmooth:0.10,

  // speed limit per frame (กัน “วิ่งหนี”)
  lookMaxStepX: 7.2,
  lookMaxStepY: 6.0,

  // gyro stability
  gyroDeadGamma: 1.8,
  gyroDeadBeta:  2.3,
  gyroBiasBeta:  18,

  urgencyAtSec:10,
  urgencyBeepHz:920,

  stormEverySec:18,
  stormDurationSec:5,
  stormIntervalMul:0.72,

  // Final Rush
  rushAtSec: 8,
  rushSpawnMul: 0.62,
  rushScoreMul: 1.5,

  // HUD auto-hide
  hudHideAfterSec: 2.2,
  hudPeekMs: 1600,

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
        .hud.hud-hidden{ opacity:0; transform:translate3d(0,-14px,0); }
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
    touch, peek, setCompact,
    destroy(){
      try{ ROOT.removeEventListener('pointerdown', onPointerDown); }catch{}
      try{ if (hideTimer) clearTimeout(hideTimer); }catch{}
      hideTimer=null;
    }
  };
}

// ---------- Panic overlay (bubble / splash) ----------
function ensurePanicLayer(){
  let el = document.getElementById('hvr-panic');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'hvr-panic';
  el.style.position='fixed';
  el.style.inset='0';
  el.style.zIndex='55';           // ต่ำกว่า HUD(80) แต่สูงกว่า playfield(10)
  el.style.pointerEvents='none';
  el.style.opacity='0';
  el.style.transition='opacity .18s ease';
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
  el.style.opacity = String(clamp(0.10 + level*0.06, 0.10, 0.32));
}
function panicOff(){
  const el = ensurePanicLayer();
  el.style.opacity = '0';
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

    // look state
    lookTX:0, lookTY:0,
    lookVX:0, lookVY:0,
    _prevVX:0, _prevVY:0,

    // gyro calibration
    gyroCenterGamma:0,
    gyroCenterBeta: TUNE.gyroBiasBeta,

    stormLeft:0,
    stopped:false,

    // A+B+C state
    rushOn:false,
    freezeLeft:0,
    magnetLeft:0,
    lastMilestone:0,

    // for boss
    spawnCount:0,
  };

  const Q = createHydrationQuest(difficulty);

  // HUD auto-hide
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
    state.feverLeft=TUNE.feverDurationSec;
    state.fever=TUNE.feverTriggerAt;
    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);
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
    if (state.fever >= TUNE.feverTriggerAt) feverStart();
    else feverRender();
  }
  function feverLose(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever - (Number(v)||0),0,100);
    feverRender();
  }

  // ---------- A+B+C helpers ----------
  function zoneMulScore(){
    return (state.zone === 'GREEN') ? TUNE.zoneScoreMulGreen : TUNE.zoneScoreMulOff;
  }
  function zoneMulFever(){
    return (state.zone === 'GREEN') ? TUNE.zoneFeverMulGreen : TUNE.zoneFeverMulOff;
  }
  function rushMulScore(){
    return state.rushOn ? TUNE.rushScoreMul : 1;
  }

  function onComboMilestone(){
    // milestone: 5/10/15
    const m = state.combo;
    if (m <= state.lastMilestone) return;
    if (!TUNE.comboMilestones.includes(m)) return;

    state.lastMilestone = m;
    if (m === 5){
      dispatch('hha:coach',{text:'⚡ COMBO 5! สวยมาก! รักษา GREEN ต่อ!', mood:'happy'});
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
    // aim perfect จาก mode-factory ช่วยให้ “รู้สึกได้จริง”
    if (ctx && ctx.hitPerfect) return true;
    // skill perfect: GREEN + combo/fever
    if (state.zone !== 'GREEN') return false;
    return (state.combo >= 5) || state.feverActive;
  }

  function judgeCore(ch, ctx){
    const isGood=!!ctx.isGood, isPower=!!ctx.isPower;
    const isBoss = !!ctx.isBoss;
    const bossChip = !!ctx.bossChip;

    let scoreDelta=0, label='GOOD';
    const multFever = state.feverActive ? 2 : 1;

    if (isPower){ scoreDelta = TUNE.scorePower; label='POWER'; }
    else if (isGood){ scoreDelta = TUNE.scoreGood; label = isBoss ? 'BOSS' : 'GOOD'; }
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

    // Risk/Reward: zone + rush
    if (isGood || isPower){
      scoreDelta = Math.round(scoreDelta * zoneMulScore() * rushMulScore());
    } else {
      // junk ตอน rush กดดันขึ้นนิด
      scoreDelta = Math.round(scoreDelta * (state.rushOn ? 1.15 : 1));
    }

    // boss chip = แต้มเล็กก่อนแตก
    if (isBoss && bossChip && (isGood || isPower)){
      scoreDelta = Math.round(scoreDelta * 0.65);
    }
    // fever multiplier
    scoreDelta = Math.round(scoreDelta * multFever);

    // combo
    if (isGood || isPower){
      state.combo += 1;
      state.comboBest = Math.max(state.comboBest, state.combo);
      onComboMilestone();
    } else {
      state.combo=0;
      state.miss += 1;
      state.lastMilestone = 0;
    }

    // perfect
    const perfect = isPerfectHit(isGood || isPower, ctx);
    if (perfect){
      scoreDelta += Math.round(TUNE.scorePerfectBonus * multFever * (state.rushOn ? 1.25 : 1));
      label='PERFECT';
      // perfect เติม fever เพิ่ม (skill-based)
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
  let lastX=0,lastY=0;

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
    lastX=ev.clientX||0;
    lastY=ev.clientY||0;
    HUD.touch();
  }
  function onPointerMove(ev){
    if(!dragOn) return;
    const x=ev.clientX||0, y=ev.clientY||0;
    const dx=x-lastX, dy=y-lastY;
    lastX=x; lastY=y;
    state.lookTX = clamp(state.lookTX + dx*1.05, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy*0.90, -TUNE.lookMaxY, TUNE.lookMaxY);
  }
  function onPointerUp(){ dragOn=false; }

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

    // blend (ไม่ snap)
    state.lookTX = clamp(state.lookTX*0.72 + tx*0.28, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY*0.72 + ty*0.28, -TUNE.lookMaxY, TUNE.lookMaxY);
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

  // double-tap to reset view (ง่าย+ไว)
  let lastTap=0;
  function onTapForCalibrate(){
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

    // Final Rush toggles
    state.rushOn = (state.timeLeft > 0 && state.timeLeft <= TUNE.rushAtSec);

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

    // countdown power effects
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
      HUD.touch();
    }

    // panic overlay: storm/rush
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
  let spawner=null;

  spawner = await factoryBoot({
    modeKey:'hydration',
    difficulty,
    duration,

    spawnHost:'#hvr-playfield',
    boundsHost: boundsEl,

    // ✅ FULL-SPREAD + "รู้สึกกระจายจริง"
    spawnAroundCrosshair: ()=> (state.magnetLeft > 0),  // magnet = bias เข้ากลางชั่วคราว
    spawnStrategy: 'grid9',
    spawnRadiusX: ()=> (state.magnetLeft > 0 ? 0.40 : 0.98),
    spawnRadiusY: ()=> (state.magnetLeft > 0 ? 0.38 : 0.98),
    minSeparation: 0.92,
    maxSpawnTries: 22,

    // ส่ง threshold ให้ mode-factory (ป้องกัน tap vs drag ในอนาคต)
    dragThresholdPx: 11,

    // storm / rush / freeze: เร่งจริง + หยุดจริง
    spawnIntervalMul: ()=>{
      if (state.freezeLeft > 0) return 999;                 // freeze = แทบไม่ spawn
      if (state.rushOn) return TUNE.rushSpawnMul;           // final rush
      return (state.stormLeft>0 ? TUNE.stormIntervalMul : 1);
    },

    // exclude: ใช้ hud + end + crosshair (แต่ mode-factory จะ ignore ตอน hud-hidden)
    excludeSelectors: ['.hud', '#hvr-crosshair', '#hvr-end'],

    pools:{
      good:['💧','🥛','🍉','🥥','🍊'],
      bad: ['🥤','🧋','🍟','🍔'],
      trick:['🍭'] // fake good (อ่านเกมได้: glow ม่วงใน mode-factory)
    },

    trickRate: (difficulty==='hard') ? 0.12 : 0.09,

    goodRate: (difficulty==='hard')?0.55:(difficulty==='easy'?0.70:0.62),

    powerups:['⭐','🛡️','⏱️','🧊'],
    powerRate:(difficulty==='hard')?0.11:0.13,
    powerEvery:6,

    // boss config (เร้าใจมาก)
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

      // boss / trick / normal judge
      return judgeCore(ch, ctx);
    },

    onExpire:(info)=>{
      // storm punish small
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

  // ask gyro permission on first touch (optional)
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
      try{ ROOT.removeEventListener('pointerdown', onTapForCalibrate); }catch{}

      showEndScreen(payload || {score:0,miss:0,comboBest:0,water:0,greenTick:0});
    }
  }

  return { stop };
}

export default { boot };