// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM)
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - VR-feel look: gyro + drag -> playfield translate (เหมือน VR)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time

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

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// --------------------- Tuning (เด็ก ป.5 แต่ยังท้าทาย) ---------------------
const TUNE = {
  // water balance move
  goodWaterPush:  +6,
  junkWaterPush:  -10,
  waterDriftPerSec: -0.9, // กันค้าง GREEN ฟรี

  // scoring
  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 10,   // bonus เมื่อเข้าเงื่อนไข “Perfect”

  // fever
  feverGainGood:  10,
  feverGainPower: 16,
  feverLoseJunk:  20,
  feverAutoDecay: 1.1,

  // fever trigger
  feverTriggerAt: 100,
  feverDurationSec: 6,

  // shield
  shieldOnFeverStart: 2,
  shieldMax: 6,

  // miss policy (concept):
  // - ปล่อย "น้ำดี" หลุด = miss (เพิ่มความท้าทาย)
  // - ปล่อย "น้ำหวาน" หลุด = ไม่ miss
  missOnGoodExpire: true,

  // ===== LOOK / AIM (เหมือน VR จริง) =====
  lookMaxX: 420,
  lookMaxY: 320,
  lookPxPerDegX: 9.2,
  lookPxPerDegY: 7.6,
  lookSmooth: 0.10,

  // ===== excitement =====
  // urgency (10 วินาทีสุดท้าย)
  urgencyAtSec: 10,
  urgencyBeepHz: 920,

  // storm wave: ช่วงสั้น ๆ ที่ spawn ถี่ขึ้น
  stormEverySec: 18,     // ทุก ๆ 18 วิ
  stormDurationSec: 5,   // นาน 5 วิ
  stormIntervalMul: 0.72 // spawn ถี่ขึ้น
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  // --- bind HUD widgets ---
  ensureWaterGauge();

  // --- host / playfield ---
  const playfield = $id('hvr-playfield') || null;
  if (!playfield) {
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  // ทำให้ playfield พร้อม transform
  playfield.style.willChange = 'transform';
  playfield.style.transform = 'translate3d(0,0,0)';

  // --- FeverUI init (กันไม่เจอ ensureFeverBar) ---
  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    if (typeof FeverUI.setFever === 'function') FeverUI.setFever(0);
    if (typeof FeverUI.setFeverActive === 'function') FeverUI.setFeverActive(false);
    if (typeof FeverUI.setShield === 'function') FeverUI.setShield(0);
  } else {
    console.warn('[HydrationVR] FeverUI not ready. Check: <script src="./vr/ui-fever.js"></script> before module.');
  }

  // --- runtime state ---
  const state = {
    diff: difficulty,
    timeLeft: duration,

    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    waterPct: 50,
    zone: 'GREEN',

    // quest-visible
    greenTick: 0,

    // fever
    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    // look (VR-feel)
    lookTX: 0,
    lookTY: 0,
    lookVX: 0,
    lookVY: 0,

    // storm
    stormLeft: 0,

    stopped: false
  };

  // --- Quest deck ---
  const Q = createHydrationQuest(difficulty);

  // expose instance
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // --------------------- HUD update helpers ---------------------
  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function calcProgressToS(){
    const goalsDone = (Q.goals || []).filter(g => g._done || g.done).length;
    const minisDone = (Q.minis || []).filter(m => m._done || m.done).length;

    // “S 30%” = แถบความคืบหน้าตาม score + เควส (ไม่หลุด concept)
    const prog = clamp(
      (state.score / 1200) * 0.70 +
      (goalsDone / 2) * 0.20 +
      (minisDone / 3) * 0.10,
      0, 1
    );
    return { prog, goalsDone, minisDone };
  }

  function updateScoreHud(label){
    const { prog, goalsDone, minisDone } = calcProgressToS();
    const progPct = Math.round(prog * 100);

    // progress bar
    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt)  txt.textContent = `Progress to S (30%): ${progPct}%`;

    // grade
    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';

    const gb = $id('hha-grade-badge');
    if (gb) gb.textContent = grade;

    // basic hud
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
      goalsDone,
      minisDone,
      label: label || ''
    });
  }

  function updateQuestHud(){
    const goalsView = Q.getProgress('goals');
    const minisView = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    const gd = $id('hha-goal-done');  if (gd) gd.textContent = String(goalsDone);
    const gt = $id('hha-goal-total'); if (gt) gt.textContent = String(allGoals.length || 2);
    const md = $id('hha-mini-done');  if (md) md.textContent = String(minisDone);
    const mt = $id('hha-mini-total'); if (mt) mt.textContent = String(allMinis.length || 3);

    const curGoalId = (goalsView && goalsView[0]) ? goalsView[0].id : (allGoals[0]?.id || '');
    const curMiniId = (minisView && minisView[0]) ? minisView[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoalId) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMiniId) : null;

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

  // --------------------- Fever logic ---------------------
  function feverRender(){
    const F = getFeverUI();
    if (!F) return;
    if (typeof F.setFever === 'function') F.setFever(state.fever);
    if (typeof F.setFeverActive === 'function') F.setFeverActive(state.feverActive);
    if (typeof F.setShield === 'function') F.setShield(state.shield);
  }

  function feverStart(){
    state.feverActive = true;
    state.feverLeft = TUNE.feverDurationSec;
    state.fever = TUNE.feverTriggerAt;

    // give shield
    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);

    feverRender();
    dispatch('hha:fever', { state:'start', value: state.fever, active:true, shield: state.shield });

    dispatch('hha:coach', { text:'🔥 FEVER! ยิงให้ไว คะแนนคูณ x2 + ได้เกราะ 🛡️', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('fever'); }catch{}
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever * 0.35, 0, 100);
    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });
    dispatch('hha:coach', { text:'เยี่ยม! FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral' });
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

  // --------------------- “Perfect” rule (สนุกขึ้นไม่ทิ้ง concept) ---------------------
  function isPerfectHit(isGoodOrPower){
    // Perfect ถ้า (อยู่ GREEN) และ (คอมโบ>=5 หรือกำลัง FEVER) และเป็น good/power
    if (!isGoodOrPower) return false;
    if (state.zone !== 'GREEN') return false;
    return (state.combo >= 5) || state.feverActive;
  }

  // --------------------- Judge (hit logic) ---------------------
  function judge(ch, ctx){
    const isGood = !!ctx.isGood;
    const isPower = !!ctx.isPower;

    let scoreDelta = 0;
    let label = 'GOOD';

    const mult = state.feverActive ? 2 : 1;

    if (isPower){
      scoreDelta = TUNE.scorePower * mult;
      label = 'POWER';
    } else if (isGood){
      scoreDelta = TUNE.scoreGood * mult;
      label = 'GOOD';
    } else {
      // junk hit: shield block?
      if (state.shield > 0){
        state.shield -= 1;
        scoreDelta = 0;
        label = 'BLOCK';
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta, label, good:false, blocked:true };
      }
      scoreDelta = TUNE.scoreJunk;
      label = 'JUNK';
    }

    // combo rules
    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.miss += 1;
    }

    // “Perfect” bonus (ให้เด็กว้าว)
    const perfect = isPerfectHit(isGood || isPower);
    if (perfect) {
      scoreDelta += TUNE.scorePerfectBonus * mult;
      label = 'PERFECT';
    }

    // score
    state.score = Math.max(0, (state.score + scoreDelta) | 0);

    // water move + quest hooks
    if (isPower || isGood){
      state.waterPct = clamp(state.waterPct + TUNE.goodWaterPush, 0, 100);
      feverAdd(isPower ? TUNE.feverGainPower : TUNE.feverGainGood);
      Q.onGood();
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.junkWaterPush, 0, 100);
      feverLose(TUNE.feverLoseJunk);
      Q.onJunk();
    }

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
    if (state.stopped) return;

    // ปล่อย "น้ำดี" หลุด = miss (ถ้าตั้ง)
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;

      // น้ำดีหลุด = น้ำลดนิด
      state.waterPct = clamp(state.waterPct - 3, 0, 100);

      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
    }
    // ปล่อย junk หลุด = ถือว่าดี ไม่ miss
  }

  // --------------------- LOOK controls (gyro + drag) ---------------------
  let hasOrient = false;
  let dragOn = false;
  let lastX = 0, lastY = 0;

  function applyLookTransform(){
    // smooth/inertia
    state.lookVX += (state.lookTX - state.lookVX) * TUNE.lookSmooth;
    state.lookVY += (state.lookTY - state.lookVY) * TUNE.lookSmooth;

    // “เหมือน VR” = หันขวา -> โลกเลื่อนไปซ้าย (สวนมือ)
    const x = clamp(-state.lookVX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const y = clamp(-state.lookVY, -TUNE.lookMaxY, TUNE.lookMaxY);

    playfield.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function onPointerDown(ev){
    dragOn = true;
    lastX = ev.clientX || 0;
    lastY = ev.clientY || 0;
  }
  function onPointerMove(ev){
    if (!dragOn) return;
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    // VR-feel drag (หนักแน่น)
    state.lookTX = clamp(state.lookTX + dx * 1.25, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy * 1.05, -TUNE.lookMaxY, TUNE.lookMaxY);
  }
  function onPointerUp(){
    dragOn = false;
  }

  // iOS ต้องขอ permission
  async function tryEnableGyro(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D) return false;

      if (typeof D.requestPermission === 'function') {
        // ต้องมาจาก gesture แต่เราเรียกใน boot แล้วจะมีบางเครื่องไม่ให้
        // ให้คุณกด/แตะจอก่อนก็ได้ (เรา bind เพิ่มด้านล่าง)
        return false;
      }
      return true;
    }catch{
      return false;
    }
  }

  function onDeviceOrientation(e){
    const g = Number(e.gamma);
    const b = Number(e.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;
    hasOrient = true;

    // deadzone กันสั่น
    const DEAD_G = 1.2;
    const DEAD_B = 1.6;

    let gg = Math.abs(g) < DEAD_G ? 0 : g;
    let bb = Math.abs(b) < DEAD_B ? 0 : b;

    // bias ให้ “เงยเล็กน้อย” เป็นกลาง
    const BIAS_B = 18;

    const tx = gg * TUNE.lookPxPerDegX;
    const ty = (bb - BIAS_B) * TUNE.lookPxPerDegY;

    state.lookTX = clamp(tx, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(ty, -TUNE.lookMaxY, TUNE.lookMaxY);
  }

  // request gyro permission on first user gesture (iOS)
  async function requestGyroPermission(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D || typeof D.requestPermission !== 'function') return;

      const res = await D.requestPermission();
      if (res === 'granted') {
        ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
        dispatch('hha:coach', { text:'✅ เปิด Gyro แล้ว! หมุนมือถือ = หันมุมมองเหมือน VR 🕶️', mood:'happy' });
      } else {
        dispatch('hha:coach', { text:'ℹ️ Gyro ไม่ได้รับอนุญาต ใช้ลากจอแทนได้เลย 👍', mood:'neutral' });
      }
    }catch{
      dispatch('hha:coach', { text:'ℹ️ ใช้ลากจอแทนได้เลย (Gyro ไม่พร้อม)', mood:'neutral' });
    }
  }

  // --------------------- Clock tick (สำคัญต่อ GREEN tick) ---------------------
  let timer = null;
  let rafId = null;

  // small beep for urgency (no external file)
  let audioCtx = null;
  function beep(freq, dur){
    try{
      audioCtx = audioCtx || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq || 880;
      g.gain.value = 0.04;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (dur || 0.05));
    }catch{}
  }

  function secondTick(){
    if (state.stopped) return;

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // water drift
    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    // ✅ FIX: GREEN tick ต้องนับ “จริง” ทุกวินาที
    const z = zoneFrom(state.waterPct);
    state.zone = z;

    if (z === 'GREEN'){
      state.greenTick += 1;
      // ✅ FIX: sync เข้า quest.stats.greenTick (เดิมไม่ถูกอัปเดต)
      if (Q && Q.stats){
        Q.stats.zone = 'GREEN';
        Q.stats.greenTick = (Q.stats.greenTick|0) + 1;
      }
    } else {
      if (Q && Q.stats) Q.stats.zone = z;
    }

    // quest second tick
    Q.second();

    // fever tick / decay
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

    // storm wave timer
    if (state.stormLeft > 0) state.stormLeft -= 1;
    if (state.timeLeft > 0 && (state.timeLeft % TUNE.stormEverySec) === 0) {
      state.stormLeft = TUNE.stormDurationSec;
      dispatch('hha:coach', { text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy' });
      try{ Particles.toast && Particles.toast('STORM WAVE!', 'warn'); }catch{}
    }

    // urgency (10 วิสุดท้าย) — beep + coach
    if (state.timeLeft > 0 && state.timeLeft <= TUNE.urgencyAtSec) {
      beep(TUNE.urgencyBeepHz, 0.04);
      if (state.timeLeft === TUNE.urgencyAtSec) {
        dispatch('hha:coach', { text:'⏳ ใกล้หมดเวลา! รักษา GREEN + ยิงน้ำดีให้ไว!', mood:'sad' });
      }
    }

    // update quest hud (goal/minis ต้องขยับ)
    updateQuestHud();

    // stop when time up
    if (state.timeLeft <= 0) stop();
  }

  // RAF loop for look transform
  function rafLoop(){
    if (state.stopped) return;
    applyLookTransform();
    rafId = ROOT.requestAnimationFrame(rafLoop);
  }

  // --------------------- Start spawner ---------------------
  let spawner = null;

  spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ spawn ลง playfield (ไม่ต้อง scroll)
    spawnHost: '#hvr-playfield',

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },

    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    // ✅ ปรับ spawn interval ช่วง storm wave
    // (hack แบบปลอดภัย: เราไม่แก้ mode-factory แต่ใช้ onExpire/score ทำให้ท้าทาย + storm wave จาก tick)
    judge: (ch, ctx) => {
      // power types:
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
        try{ Particles.toast && Particles.toast('+1 SHIELD 🛡️', 'good'); }catch{}
      }
      if (ctx.isPower && ch === '⏱️'){
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
        try{ Particles.toast && Particles.toast('+3s ⏱️', 'good'); }catch{}
      }

      // storm wave = ทำให้ “Perfect bonus” ง่ายขึ้นนิดเพื่อเร้าใจ
      if (state.stormLeft > 0 && (ctx.isGood || ctx.isPower)) {
        state.fever = clamp(state.fever + 2, 0, 100);
      }

      return judge(ch, ctx);
    },

    onExpire: (info) => {
      // storm wave: ตอน storm ปล่อย good หลุด = โดนลงโทษมากขึ้น (เร้าใจ)
      if (state.stormLeft > 0 && info && info.isGood && !info.isPower) {
        state.waterPct = clamp(state.waterPct - 2, 0, 100);
      }
      onExpire(info);
    }
  });

  // init hud
  updateWaterHud();
  // ✅ initial sync quest zone/green
  if (Q && Q.stats){
    Q.stats.zone = zoneFrom(state.waterPct);
    Q.stats.greenTick = 0;
  }
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // look controls binding
  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  // gyro (if available)
  if (await tryEnableGyro()) {
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  // iOS permission: bind once on first tap anywhere
  const onceAsk = async () => {
    ROOT.removeEventListener('pointerdown', onceAsk);
    await requestGyroPermission();
  };
  ROOT.addEventListener('pointerdown', onceAsk, { passive:true });

  // start loops
  timer = ROOT.setInterval(secondTick, 1000);
  rafId = ROOT.requestAnimationFrame(rafLoop);

  // stop cleanup
  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  // ถ้าหมดเวลาใน mode-factory จะ stop เองอยู่แล้ว แต่กันไว้
  const onTime = (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  };
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  function stop(){
    if (state.stopped) return;
    state.stopped = true;

    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ if (rafId != null) ROOT.cancelAnimationFrame(rafId); }catch{}
    rafId = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}

    try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation, true); }catch{}
    try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch{}
    try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch{}
    try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch{}

    dispatch('hha:end', {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: (Q && Q.stats) ? (Q.stats.greenTick|0) : (state.greenTick|0)
    });

    dispatch('hha:coach', { text:'🏁 จบเกม! ดูผลคะแนนและเควสได้เลย', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}
  }

  return { stop };
}

export default { boot };
