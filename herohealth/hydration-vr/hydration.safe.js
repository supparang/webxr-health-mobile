// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM) into #hvr-world
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (via global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - LOOK: drag-to-look + gyro-to-look (permission button)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, min, max){
  v = Number(v) || 0;
  return v < min ? min : (v > max ? max : v);
}
function $id(id){ return document.getElementById(id); }
function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){}, };

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// --------------------- Tuning ---------------------
const TUNE = {
  goodWaterPush:  +6,
  junkWaterPush:  -9,
  waterDriftPerSec: -0.8,

  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,

  feverGainGood:  9,
  feverGainPower: 14,
  feverLoseJunk:  18,
  feverAutoDecay: 1.2,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  shieldOnFeverStart: 2,
  shieldMax: 6,

  missOnGoodExpire: true,

  // look tuning (px)
  lookMaxX: 280,
  lookMaxY: 220,
  lookPxPerDegX: 6.0,
  lookPxPerDegY: 5.0
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureWaterGauge();

  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    FeverUI.setFever(0);
    FeverUI.setFeverActive(false);
    FeverUI.setShield(0);
  } else {
    console.warn('[HydrationVR] FeverUI not found or missing functions. Check: ./vr/ui-fever.js loaded before module.');
  }

  const state = {
    diff: difficulty,
    timeLeft: duration,
    score: 0,
    combo: 0,
    comboBest: 0,
    miss: 0,

    waterPct: 50,
    zone: 'GREEN',
    greenTick: 0,

    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0
  };

  const Q = createHydrationQuest(difficulty);

  const playfield = $id('hvr-playfield') || null;

  // ---------- ensure world container ----------
  function ensureWorld(){
    if (!playfield) return null;
    let w = $id('hvr-world');
    if (!w){
      w = document.createElement('div');
      w.id = 'hvr-world';
      playfield.appendChild(w);
    }
    return w;
  }
  const world = ensureWorld();

  // ---------- LOOK controller (drag + gyro) ----------
  const look = {
    enabled: true,
    dragYaw: 0,
    dragPitch: 0,
    gyroYaw: 0,
    gyroPitch: 0,
    gyroOn: false,
    _down: false,
    _x: 0,
    _y: 0,
    _baseYaw: 0,
    _basePitch: 0,
    _handler: null
  };

  function applyLook(){
    if (!world) return;

    // รวม drag + gyro
    const yaw = clamp(look.dragYaw + (look.gyroOn ? look.gyroYaw : 0), -45, 45);
    const pitch = clamp(look.dragPitch + (look.gyroOn ? look.gyroPitch : 0), -35, 35);

    const tx = clamp(-yaw * TUNE.lookPxPerDegX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const ty = clamp(pitch * TUNE.lookPxPerDegY, -TUNE.lookMaxY, TUNE.lookMaxY);

    world.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
  }

  function bindDragLook(){
    if (!playfield) return;

    // drag บน playfield ทั้งแผง
    playfield.addEventListener('pointerdown', (e)=>{
      // ถ้าโดนเป้าโดยตรง ให้เป้าไปเลย (ไม่เริ่ม look)
      const t = e.target && e.target.closest ? e.target.closest('.hvr-target') : null;
      if (t) return;

      look._down = true;
      look._x = e.clientX || 0;
      look._y = e.clientY || 0;
      look._baseYaw = look.dragYaw;
      look._basePitch = look.dragPitch;

      try{ playfield.setPointerCapture && playfield.setPointerCapture(e.pointerId); }catch{}
    }, { passive:true });

    playfield.addEventListener('pointermove', (e)=>{
      if (!look._down) return;

      const cx = e.clientX || 0;
      const cy = e.clientY || 0;
      const dx = cx - look._x;
      const dy = cy - look._y;

      // ปรับให้เหมือนหันกล้อง: ลากขวา = มองขวา (yaw+)
      look.dragYaw = clamp(look._baseYaw + dx * 0.06, -45, 45);
      look.dragPitch = clamp(look._basePitch + dy * 0.06, -35, 35);

      applyLook();
    }, { passive:true });

    function end(){
      look._down = false;
    }
    playfield.addEventListener('pointerup', end, { passive:true });
    playfield.addEventListener('pointercancel', end, { passive:true });

    // กัน resize / rotate
    ROOT.addEventListener('resize', ()=>applyLook(), { passive:true });
  }

  async function enableGyro(){
    // บางเครื่องต้องขอ permission (iOS/บาง Android)
    try{
      if (typeof DeviceOrientationEvent === 'undefined') return false;

      // iOS permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function'){
        const res = await DeviceOrientationEvent.requestPermission();
        if (String(res).toLowerCase() !== 'granted') return false;
      }

      // bind handler
      if (look._handler) return true;

      let lastA = null;
      let lastB = null;

      look._handler = (ev)=>{
        // alpha: 0-360 (yaw around z), beta: -180..180 (front-back), gamma: -90..90 (left-right)
        const a = Number(ev.alpha);
        const b = Number(ev.beta);
        const g = Number(ev.gamma);

        if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(g)) return;

        // ใช้ gamma เป็น yaw (หมุนซ้ายขวา), beta เป็น pitch (เงยก้ม)
        // normalize smooth
        if (lastA == null){ lastA = g; lastB = b; }

        // simple smoothing
        const sg = (g * 0.25) + (lastA * 0.75);
        const sb = (b * 0.25) + (lastB * 0.75);
        lastA = sg; lastB = sb;

        look.gyroYaw = clamp(sg * 0.55, -30, 30);
        look.gyroPitch = clamp(sb * 0.18, -25, 25);

        look.gyroOn = true;
        applyLook();
      };

      ROOT.addEventListener('deviceorientation', look._handler, true);

      dispatch('hha:coach', { text:'🧭 เปิด Gyro แล้ว! หมุนเครื่องเพื่อเล็งได้เลย (ลากจอยังใช้ได้) 🎯', mood:'happy' });
      return true;
    }catch(err){
      console.warn('[HydrationVR] enableGyro error', err);
      return false;
    }
  }

  bindDragLook();
  applyLook();

  // expose instance
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} },
    enableGyro
  };

  // --------------------- HUD helpers ---------------------
  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;

    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;
  }

  function updateScoreHud(label){
    const goalsDone = Number($id('hha-goal-done')?.textContent || 0) || 0;
    const miniDone  = Number($id('hha-mini-done')?.textContent || 0) || 0;

    const prog = clamp((state.score / 1200) * 0.7 + (goalsDone/2) * 0.2 + (miniDone/3) * 0.1, 0, 1);
    const progPct = Math.round(prog * 100);

    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt) txt.textContent = `Progress to S (30%): ${progPct}%`;

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

  // --------------------- Fever logic ---------------------
  function feverRender(){
    const F = getFeverUI();
    if (!F) return;
    try{ F.setFever && F.setFever(state.fever); }catch{}
    try{ F.setFeverActive && F.setFeverActive(state.feverActive); }catch{}
    try{ F.setShield && F.setShield(state.shield); }catch{}
  }

  function feverStart(){
    state.feverActive = true;
    state.feverLeft = TUNE.feverDurationSec;
    state.fever = TUNE.feverTriggerAt;

    state.shield = clamp(state.shield + TUNE.shieldOnFeverStart, 0, TUNE.shieldMax);

    feverRender();
    dispatch('hha:fever', { state:'start', value: state.fever, active:true, shield: state.shield });

    dispatch('hha:coach', { text:'🔥 FEVER! แตะให้ไว คะแนนคูณ! +ได้เกราะด้วย 🛡️', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('fever'); }catch{}
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever * 0.35, 0, 100);
    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });
    dispatch('hha:coach', { text:'ดีมาก! FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral' });
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

  // --------------------- Judge ---------------------
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
      if (state.shield > 0){
        state.shield -= 1;
        label = 'BLOCK';
        dispatch('hha:judge', { label:'BLOCK' });
        feverRender();
        updateScoreHud('BLOCK');
        return { scoreDelta:0, label, good:false, blocked:true };
      }
      scoreDelta = TUNE.scoreJunk;
      label = 'JUNK';
    }

    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.miss += 1;
    }

    state.score = Math.max(0, (state.score + scoreDelta) | 0);

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

    try{
      Particles.burstAt && Particles.burstAt(ctx.clientX || 0, ctx.clientY || 0, label);
      Particles.scorePop && Particles.scorePop(ctx.clientX || 0, ctx.clientY || 0, scoreDelta, label);
    }catch{}

    dispatch('hha:judge', { label });
    updateQuestHud();
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  function onExpire(info){
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
    }
  }

  // --------------------- Clock tick ---------------------
  let timer = null;

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    const z = zoneFrom(state.waterPct);
    if (z === 'GREEN') state.greenTick += 1;

    Q.second();

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

    // ✅ spawn เข้า world ที่ขยับตาม look
    spawnHost: '#hvr-world',

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    judge: (ch, ctx) => {
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
      }
      if (ctx.isPower && ch === '⏱️'){
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
      }
      return judge(ch, ctx);
    },

    onExpire
  });

  updateWaterHud();
  updateQuestHud();
  updateScoreHud();
  feverRender();
  timer = ROOT.setInterval(secondTick, 1000);

  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  function stop(){
    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}

    // unbind gyro
    try{
      if (look._handler){
        ROOT.removeEventListener('deviceorientation', look._handler, true);
        look._handler = null;
      }
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

  ROOT.addEventListener('hha:time', (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  }, { passive:true });

  return { stop, enableGyro };
}

export default { boot };