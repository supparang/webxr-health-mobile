// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE) — PRODUCTION READY
// ✅ FIX: FEVER/SHIELD ทำงาน, GREEN tick นับจริง, Quest แสดง, เป้าขยับตามหมุน/ลาก (เหมือน GoodJunk)
// ✅ ADD: สนุกท้าทายเร้าใจ 1–8 (multiplier / green lock / danger pulse / rush wave / perfect / trap pressure / UX feedback)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

// --------------------- Globals / helpers ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, min, max){
  v = Number(v) || 0;
  return v < min ? min : (v > max ? max : v);
}
function $id(id){ return document.getElementById(id); }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

// FX layer (particles.js IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, };

function fxToast(text){
  try{ if (Particles && typeof Particles.toast === 'function') Particles.toast(text); }catch{}
}
function fxCelebrate(tag){
  try{ if (Particles && typeof Particles.celebrate === 'function') Particles.celebrate(tag); }catch{}
}

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// --------------------- Tuning (เด็ก ป.5) ---------------------
const TUNE = {
  // water balance move
  goodWaterPush:  +6,
  junkWaterPush:  -9,
  waterDriftPerSec: -0.8,

  // scoring
  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,

  // fever
  feverGainGood:  9,
  feverGainPower: 14,
  feverLoseJunk:  18,
  feverAutoDecay: 1.2,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  // shield
  shieldOnFeverStart: 2,
  shieldMax: 6,

  // miss policy
  // - ปล่อยน้ำดีหลุด = miss (ให้ท้าทาย)
  // - ปล่อย junk หลุด = ไม่ miss
  missOnGoodExpire: true,

  // ===== LOOK / AIM (เหมือน GoodJunk) =====
  // ขยับ playfield ตามหมุน/ลาก (px)
  lookMaxX: 280,
  lookMaxY: 220,
  // scale แปลงองศา -> px (ประมาณนี้เล่นแล้ว “พอดี”)
  lookPxPerDegX: 6.0,
  lookPxPerDegY: 5.0,
  lookSmooth: 0.16,

  // ===== excitement / challenge 1–8 =====
  streakStep: 6,                // hit ดีต่อเนื่องครบกี่ครั้ง → multiplier +1
  multMax: 4,                   // x1..x4 (และคูณกับ FEVER ได้)
  perfectWindowMs: 240,         // ยิงไวหลัง spawn = PERFECT
  perfectBonus: 10,
  perfectFever: 6,

  greenLockEverySec: 5,         // อยู่ GREEN ต่อเนื่องครบทุก 5 วิ
  greenLockScore: 35,
  greenLockFever: 4,

  dangerAfterSec: 3,            // LOW/HIGH ติดกันเกินกี่วิ → panic
  dangerExtraDrift: -2.0,       // drain เพิ่มตอน panic
  dangerCoachEvery: 2,          // ถี่แค่ไหนเตือนโค้ช

  rushEverySec: 18,             // wave ทุก 18 วิ
  rushDurationSec: 5,
  rushScoreBonus: 12,           // โบนัสต่อ hit ใน wave
  rushFeverBonus: 2,            // โบนัส fever ต่อ hit ใน wave

  trapAtCombo: 10,              // combo สูง → “pressure” (junk โดนหนักขึ้น)
  trapJunkScoreMul: 1.35,
  trapJunkWaterMul: 1.25,
  trapJunkFeverMul: 1.35
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  // --- bind HUD widgets ---
  ensureWaterGauge();

  // --- fever init ---
  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    if (typeof FeverUI.setFever === 'function') FeverUI.setFever(0);
    if (typeof FeverUI.setFeverActive === 'function') FeverUI.setFeverActive(false);
    if (typeof FeverUI.setShield === 'function') FeverUI.setShield(0);
  } else {
    console.warn('[HydrationVR] FeverUI not found/missing. Ensure ./vr/ui-fever.js loaded BEFORE this module.');
  }

  // --- runtime state ---
  const state = {
    diff: difficulty,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    // water gauge
    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,

    // fever
    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    // excitement
    mult: 1,
    streak: 0,
    badZoneStreak: 0,
    rushLeft: 0,

    // look
    lookX: 0,
    lookY: 0,
    lookTX: 0,
    lookTY: 0,

    // perf
    lastDangerCoachAt: 0
  };

  // --- Quest deck ---
  const Q = createHydrationQuest(difficulty);

  // --- host / playfield ---
  const playfield = $id('hvr-playfield') || null;
  if (!playfield) console.warn('[HydrationVR] #hvr-playfield not found');

  // expose instance (debug)
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // --------------------- HUD update helpers ---------------------
  function feverRender(){
    const F = getFeverUI();
    if (!F) return;
    try{
      if (typeof F.setFever === 'function') F.setFever(state.fever);
      if (typeof F.setFeverActive === 'function') F.setFeverActive(state.feverActive);
      if (typeof F.setShield === 'function') F.setShield(state.shield);
    }catch{}
  }

  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;

    // ✅ sync เข้า quest deck ให้ goal GREEN ทำงานจริง
    try{
      if (Q && Q.stats){
        Q.stats.zone = state.zone;
      }
    }catch{}

    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function computeProgressToS(){
    // ProgressToS (0..100): score + quest progress
    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const miniDone  = Number($id('hha-mini-done')?.textContent || 0) || 0;

    const prog = clamp(
      (state.score / 1200) * 0.70 +
      (goalsDone / 2)      * 0.20 +
      (miniDone  / 3)      * 0.10,
      0, 1
    );
    return Math.round(prog * 100);
  }

  function updateScoreHud(label){
    const progPct = computeProgressToS();

    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt)  txt.textContent  = `Progress to S (30%): ${progPct}%`;

    // grade mapping
    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';

    const gb = $id('hha-grade-badge');
    if (gb) gb.textContent = grade;

    const sc = $id('hha-score-main'); if (sc) sc.textContent = String(state.score|0);
    const cb = $id('hha-combo-max');  if (cb) cb.textContent = String(state.comboBest|0);
    const ms = $id('hha-miss');       if (ms) ms.textContent = String(state.miss|0);

    dispatch('hha:score', {
      score: state.score|0,
      combo: state.combo|0,
      comboBest: state.comboBest|0,
      miss: state.miss|0,
      zone: state.zone,
      water: Math.round(state.waterPct),
      fever: Math.round(state.fever),
      feverActive: !!state.feverActive,
      shield: state.shield|0,
      mult: state.mult|0,
      rush: state.rushLeft|0,
      label: label || ''
    });
  }

  function updateQuestHud(){
    const goals = Q.getProgress('goals');
    const minis = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    const gd = $id('hha-goal-done'); if (gd) gd.textContent = String(goalsDone);
    const gt = $id('hha-goal-total'); if (gt) gt.textContent = String(allGoals.length || 2);
    const md = $id('hha-mini-done'); if (md) md.textContent = String(minisDone);
    const mt = $id('hha-mini-total'); if (mt) mt.textContent = String(allMinis.length || 3);

    const curGoal = (goals && goals[0]) ? goals[0].id : (allGoals[0]?.id || '');
    const curMini = (minis && minis[0]) ? minis[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoal) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMini) : null;

    const goalEl = $id('hha-quest-goal');
    const miniEl = $id('hha-quest-mini');

    if (goalEl) goalEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : `Goal: ทำภารกิจให้ครบ`;
    if (miniEl) miniEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : `Mini: ทำมินิเควส`;

    dispatch('quest:update', {
      goalDone: goalsDone,
      goalTotal: allGoals.length || 2,
      miniDone: minisDone,
      miniTotal: allMinis.length || 3,
      goalText: goalEl ? goalEl.textContent : '',
      miniText: miniEl ? miniEl.textContent : ''
    });

    updateScoreHud();
  }

  // --------------------- FEVER logic ---------------------
  function feverStart(){
    state.feverActive = true;
    state.feverLeft   = TUNE.feverDurationSec;
    state.fever       = TUNE.feverTriggerAt;

    // give shield
    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);

    feverRender();
    dispatch('hha:fever', { state:'start', value: state.fever, active:true, shield: state.shield });

    dispatch('hha:coach', { text:'🔥 FEVER! ยิงให้ไว คะแนนคูณ! + ได้เกราะ 🛡️', mood:'happy' });
    fxToast('🔥 FEVER!');
    fxCelebrate('fever');
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever * 0.35, 0, 100);

    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });

    dispatch('hha:coach', { text:'ดีมาก! FEVER จบแล้ว กลับไปคุม GREEN ต่อ 💧', mood:'neutral' });
  }

  function feverAdd(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever + (Number(v)||0), 0, 100);
    if (state.fever >= TUNE.feverTriggerAt) feverStart();
    else feverRender();
  }

  function feverLose(v){
    if (state.feverActive) return;
    state.fever = clamp(state.fever - (Number(v)||0), 0, 100);
    feverRender();
  }

  // --------------------- LOOK (หมุน/ลากแล้ว playfield เลื่อนตาม) ---------------------
  let hasOrient = false;
  let dragOn = false;
  let dragLastX = 0, dragLastY = 0;

  function applyLook(){
    if (!playfield) return;

    // smooth
    state.lookX += (state.lookTX - state.lookX) * TUNE.lookSmooth;
    state.lookY += (state.lookTY - state.lookY) * TUNE.lookSmooth;

    const x = clamp(state.lookX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const y = clamp(state.lookY, -TUNE.lookMaxY, TUNE.lookMaxY);

    playfield.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;

    if (!stopped) ROOT.requestAnimationFrame(applyLook);
  }

  function onDeviceOrientation(e){
    // gamma: left-right, beta: front-back
    const g = Number(e.gamma); // -90..90
    const b = Number(e.beta);  // -180..180
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;
    hasOrient = true;

    // แปลงองศา -> px (คุมให้ไม่เวียนหัว)
    const tx = clamp(g * TUNE.lookPxPerDegX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const ty = clamp((b - 20) * TUNE.lookPxPerDegY, -TUNE.lookMaxY, TUNE.lookMaxY);
    state.lookTX = tx;
    state.lookTY = ty;
  }

  function onPointerDown(ev){
    dragOn = true;
    dragLastX = ev.clientX || 0;
    dragLastY = ev.clientY || 0;
  }
  function onPointerMove(ev){
    if (!dragOn) return;
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    const dx = x - dragLastX;
    const dy = y - dragLastY;
    dragLastX = x;
    dragLastY = y;

    // drag → offset (กลับทิศเล็กน้อยให้เหมือนมอง)
    state.lookTX = clamp(state.lookTX + dx * 0.9, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy * 0.9, -TUNE.lookMaxY, TUNE.lookMaxY);
  }
  function onPointerUp(){
    dragOn = false;
  }

  // --------------------- Judge (hit logic) ---------------------
  function judge(ch, ctx){
    const isGood  = !!ctx.isGood;
    const isPower = !!ctx.isPower;

    // PERFECT: ยิงไวหลัง spawn (ต้องให้ mode-factory ใส่ dataset.bornAt หรือ ctx.bornAt)
    let isPerfect = false;
    try{
      const bornAt = Number(ctx?.bornAt || ctx?.targetEl?.dataset?.bornAt || 0);
      if (bornAt && (Date.now() - bornAt) <= TUNE.perfectWindowMs) isPerfect = true;
    }catch{}

    // multiplier: streak + fever
    const feverMult = state.feverActive ? 2 : 1;
    const totalMult = clamp(state.mult * feverMult, 1, TUNE.multMax * 2);

    let scoreDelta = 0;
    let label = 'GOOD';

    if (isPower){
      scoreDelta = TUNE.scorePower * totalMult;
      label = 'POWER';
    } else if (isGood){
      scoreDelta = TUNE.scoreGood * totalMult;
      label = 'GOOD';
    } else {
      // junk hit: shield block?
      if (state.shield > 0){
        state.shield -= 1;
        label = 'BLOCK';
        fxToast('🛡️ BLOCK!');
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta: 0, label, good:false, blocked:true };
      }

      // trap pressure (combo สูง → โดนหนักขึ้น)
      const trapMul = (state.combo >= TUNE.trapAtCombo) ? TUNE.trapJunkScoreMul : 1;
      scoreDelta = Math.round(TUNE.scoreJunk * trapMul);
      label = 'JUNK';
    }

    // Rush bonus + Perfect bonus
    if (state.rushLeft > 0 && (isGood || isPower)){
      scoreDelta += TUNE.rushScoreBonus;
      feverAdd(TUNE.rushFeverBonus);
      label = (label === 'POWER') ? 'RUSHPOWER' : 'RUSH';
    }
    if (isPerfect && (isGood || isPower)){
      scoreDelta += TUNE.perfectBonus;
      feverAdd(TUNE.perfectFever);
      label = (label === 'POWER') ? 'PERFECT+' : 'PERFECT';
      fxToast('✨ PERFECT!');
    }

    // combo / streak / mult
    if (isGood || isPower){
      state.combo += 1;
      state.streak += 1;

      const nextMult = 1 + Math.floor(state.streak / TUNE.streakStep);
      state.mult = clamp(nextMult, 1, TUNE.multMax);

      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.streak = 0;
      state.mult = 1;
      state.miss += 1;
    }

    // score
    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    // water + fever + quest counters
    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush, 0, 100);
      feverAdd(isPower ? TUNE.feverGainPower : TUNE.feverGainGood);
      Q.onGood();
    } else {
      // trap pressure water/fever
      const waterMul = (state.comboBest >= TUNE.trapAtCombo) ? TUNE.trapJunkWaterMul : 1;
      const feverMul = (state.comboBest >= TUNE.trapAtCombo) ? TUNE.trapJunkFeverMul : 1;

      state.waterPct = clamp(state.waterPct + (TUNE.junkWaterPush * waterMul), 0, 100);
      feverLose(TUNE.feverLoseJunk * feverMul);
      Q.onJunk();
    }

    // quest stats
    Q.updateScore(state.score);
    Q.updateCombo(state.combo);

    updateWaterHud();

    // FX
    try{
      Particles.burstAt && Particles.burstAt(ctx.clientX || 0, ctx.clientY || 0, label);
      Particles.scorePop && Particles.scorePop(ctx.clientX || 0, ctx.clientY || 0, scoreDelta, label);
    }catch{}

    dispatch('hha:judge', { label });

    updateQuestHud();
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  // --------------------- Expire (ของหลุด) ---------------------
  function onExpire(info){
    // info: { ch,isGood,isPower }
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.streak = 0;
      state.mult = 1;

      // น้ำดีหลุด = น้ำลดนิดหน่อย (ยังคุม concept)
      state.waterPct = clamp(state.waterPct - 3, 0, 100);

      fxToast('MISS!');
      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
      updateQuestHud();
    }
    // ปล่อย junk หลุด = ถือว่าดี ไม่ miss
  }

  // --------------------- Clock tick (GREEN tick / danger / rush) ---------------------
  let timer = null;
  let stopped = false;

  function maybeRushWave(){
    const tSpent = (duration - state.timeLeft);
    if (tSpent > 0 && (tSpent % TUNE.rushEverySec) === 0){
      state.rushLeft = TUNE.rushDurationSec;
      dispatch('hha:coach', { text:'🌊 RUSH WAVE! ยิงให้ไวแต่คุม GREEN ด้วยนะ!', mood:'happy' });
      fxToast('🌊 RUSH!');
      fxCelebrate('rush');
    }
  }

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // wave
    if (state.rushLeft > 0) state.rushLeft -= 1;
    maybeRushWave();

    // drift base
    let drift = TUNE.waterDriftPerSec;

    // zone BEFORE drift (เพื่อดู streak โซนแย่)
    const zBefore = zoneFrom(state.waterPct);

    if (zBefore === 'GREEN'){
      state.badZoneStreak = 0;
    } else {
      state.badZoneStreak += 1;

      if (state.badZoneStreak >= TUNE.dangerAfterSec){
        drift += TUNE.dangerExtraDrift;

        // coach ไม่ถี่เกิน
        const now = Date.now();
        if ((now - state.lastDangerCoachAt) >= (TUNE.dangerCoachEvery * 1000)){
          state.lastDangerCoachAt = now;
          dispatch('hha:coach', { text:'⚠️ อันตราย! รีบกลับ GREEN เดี๋ยวนี้!', mood:'sad' });
          fxToast('⚠️ DANGER');
        }
      }
    }

    // apply drift + update
    state.waterPct = clamp(state.waterPct + drift, 0, 100);
    updateWaterHud();

    // ✅ GREEN tick (นับจริง) + sync เข้า quest stats
    const z = zoneFrom(state.waterPct);
    if (z === 'GREEN'){
      state.greenTick += 1;
      try{ if (Q && Q.stats) Q.stats.greenTick += 1; }catch{}

      // GREEN LOCK โบนัสทุก 5 วิ
      if (state.greenTick > 0 && (state.greenTick % TUNE.greenLockEverySec) === 0){
        state.score = (state.score + TUNE.greenLockScore) | 0;
        feverAdd(TUNE.greenLockFever);
        fxToast(`✅ GREEN +${TUNE.greenLockScore}`);
        dispatch('hha:coach', { text:'ดีมาก! คุม GREEN ได้ต่อเนื่อง 💧', mood:'happy' });
        updateScoreHud('GREENLOCK');
      }
    }

    // quest internal tick (timeSec/secSinceJunk)
    Q.second();

    // fever tick/decay
    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else {
        state.fever = 100;
        feverRender();
      }
    } else {
      state.fever = clamp(state.fever - TUNE.feverAutoDecay, 0, 100);
      feverRender();
    }

    updateQuestHud();
  }

  // --------------------- Start spawner ---------------------
  const spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ ไม่ต้อง scroll — spawn บน playfield (เลื่อนตาม look transform)
    spawnHost: playfield ? '#hvr-playfield' : null,

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },

    // concept: ยากขึ้นตาม diff
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    judge: (ch, ctx) => {
      // เติมข้อมูลเพื่อ PERFECT ถ้า mode-factory ส่ง targetEl มา (บางเวอร์ชัน)
      try{
        if (ctx && ctx.targetEl && ctx.targetEl.dataset && !ctx.targetEl.dataset.bornAt){
          ctx.targetEl.dataset.bornAt = String(Date.now());
        }
      }catch{}

      // power types:
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        fxToast('🛡️ +1');
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
      }
      if (ctx.isPower && ch === '⏱️'){
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        fxToast('⏱️ +3s');
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
      }
      if (ctx.isPower && ch === '⭐'){
        fxToast('⭐ BONUS!');
      }

      return judge(ch, ctx);
    },

    onExpire
  });

  // init HUD
  updateWaterHud();
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // start timer
  timer = ROOT.setInterval(secondTick, 1000);

  // look loop
  ROOT.requestAnimationFrame(applyLook);

  // bind sensors/drag
  // NOTE: iOS ต้องขอ permission ที่หน้าเกม (ถ้าไม่ได้ก็ลากแทนได้)
  try{ ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true }); }catch{}
  try{
    ROOT.addEventListener('pointerdown', onPointerDown, { passive:true });
    ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
    ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
    ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });
  }catch{}

  // stop cleanup
  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  // ถ้าหมดเวลาใน mode-factory จะยิง hha:time(0) แล้ว stop() เองอยู่แล้ว แต่กันซ้ำไว้:
  const onTime0 = (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  };
  ROOT.addEventListener('hha:time', onTime0, { passive:true });

  function stop(){
    if (stopped) return;
    stopped = true;

    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTime0); }catch{}

    try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation); }catch{}
    try{
      ROOT.removeEventListener('pointerdown', onPointerDown);
      ROOT.removeEventListener('pointermove', onPointerMove);
      ROOT.removeEventListener('pointerup', onPointerUp);
      ROOT.removeEventListener('pointercancel', onPointerUp);
    }catch{}

    dispatch('hha:end', {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: state.greenTick|0
    });
  }

  return { stop };
}

export default { boot };