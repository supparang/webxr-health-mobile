// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM)
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (via global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time
//
// ✅ PATCH: Gyro/Drag "look" (parallax panning) — เป้าเลื่อนตามหมุน/ลากจอ (ไม่เกี่ยว scroll)

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

  // miss policy (concept)
  missOnGoodExpire: true,

  // ✅ look / parallax
  lookEnabled: true,
  worldScale: 2.2,          // world ใหญ่กว่าจอ (2.0–2.6 แนะนำ)
  lookStrengthPx: 260,      // ระยะเลื่อนสูงสุด (px)
  lookSmooth: 0.14,         // 0.10–0.22
  dragSensitivity: 0.85,    // ลากนิ้วเร็ว/ช้า
  gyroSensitivity: 0.75     // gyro แรง/เบา
};

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  // --- bind HUD widgets ---
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
    shield: 0
  };

  // --- Quest deck ---
  const Q = createHydrationQuest(difficulty);

  // --- host / playfield ---
  const playfield = $id('hvr-playfield') || null;

  // expose instance (เผื่อ debug)
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // ==========================================================
  //  ✅ Gyro/Drag LOOK (parallax) — ไม่เกี่ยว scroll
  //  แนวคิด: playfield = viewport, world = ใหญ่กว่า viewport
  //  แล้ว translate world ตาม gyro/drag → เป้าเลื่อนตามมุมมอง
  // ==========================================================
  let look = null;

  function ensurePlayfieldWorld(){
    if (!playfield) return null;

    // playfield ทำหน้าที่เป็น viewport (เต็มพื้นที่เกม)
    playfield.style.position = playfield.style.position || 'relative';
    playfield.style.overflow = 'hidden';
    playfield.style.minHeight = playfield.style.minHeight || '60vh';
    playfield.style.height = playfield.style.height || '60vh';

    // world (ใหญ่กว่า playfield)
    let world = $id('hvr-world');
    if (!world) {
      world = document.createElement('div');
      world.id = 'hvr-world';
      world.setAttribute('data-hvr-world', '1');
      playfield.appendChild(world);
    }

    const s = TUNE.worldScale;
    Object.assign(world.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: (s * 100) + '%',
      height: (s * 100) + '%',
      transform: 'translate(-50%,-50%)',
      willChange: 'transform',
      pointerEvents: 'none' // เป้าเองจะ pointer-events:auto (มาจาก mode-factory)
    });

    // ให้ target รับคลิกได้
    // (mode-factory สร้าง .hvr-target pointer-events:auto อยู่แล้ว)
    return world;
  }

  function setupLookPan(worldEl){
    if (!worldEl || !TUNE.lookEnabled) return null;

    // state ของ look
    const L = {
      enabled: true,
      yaw: 0, pitch: 0,           // input raw (normalized -1..1)
      yawT: 0, pitchT: 0,         // target
      yawS: 0, pitchS: 0,         // smoothed
      dragging: false,
      lastX: 0, lastY: 0,
      raf: 0,
      gyroOk: false,
      baseAlpha: null,
      baseBeta: null
    };

    function apply(){
      const maxPx = TUNE.lookStrengthPx;
      const tx = clamp(L.yawS, -1, 1) * maxPx;
      const ty = clamp(L.pitchS, -1, 1) * maxPx;

      // translate แบบ center-based
      worldEl.style.transform =
        `translate(-50%,-50%) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    }

    function tick(){
      if (!L.enabled) return;
      const k = clamp(TUNE.lookSmooth, 0.05, 0.35);

      // smooth towards target
      L.yawS   = L.yawS   + (L.yawT   - L.yawS)   * k;
      L.pitchS = L.pitchS + (L.pitchT - L.pitchS) * k;

      apply();
      L.raf = ROOT.requestAnimationFrame(tick);
    }

    // ---- Drag to look (แตะ/ลากที่ฉากว่าง ๆ) ----
    function onDown(e){
      // ไม่แย่งคลิกเป้า/ปุ่ม
      if (e && e.target && e.target.closest && e.target.closest('.hvr-target,a,button,.hha-btn-vr')) return;

      L.dragging = true;
      L.lastX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      L.lastY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    }
    function onMove(e){
      if (!L.dragging) return;

      const x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      const y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
      const dx = (x - L.lastX);
      const dy = (y - L.lastY);
      L.lastX = x; L.lastY = y;

      const w = ROOT.innerWidth  || 360;
      const h = ROOT.innerHeight || 640;

      // dx/dy → target yaw/pitch
      const sx = (dx / w) * 2 * TUNE.dragSensitivity;
      const sy = (dy / h) * 2 * TUNE.dragSensitivity;

      L.yawT   = clamp(L.yawT   + sx, -1, 1);
      L.pitchT = clamp(L.pitchT + sy, -1, 1);
    }
    function onUp(){
      L.dragging = false;
    }

    // ---- Gyro to look (deviceorientation) ----
    function onOrient(ev){
      // iOS ต้องขอ permission ในคลิกแรก (ถ้าคุณอยากเพิ่มทีหลังค่อยว่ากัน)
      const a = Number(ev.alpha); // 0..360
      const b = Number(ev.beta);  // -180..180
      const g = Number(ev.gamma); // -90..90

      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(g)) return;

      if (L.baseAlpha == null) { L.baseAlpha = a; L.baseBeta = b; }
      L.gyroOk = true;

      // yaw จาก gamma (เอียงซ้ายขวา), pitch จาก beta (ก้มเงย)
      // normalize เป็น -1..1 โดยคร่าว ๆ
      const yawN   = clamp((g / 35) * TUNE.gyroSensitivity, -1, 1);
      const pitchN = clamp((b / 45) * TUNE.gyroSensitivity, -1, 1);

      // รวมกับ drag (drag จะเป็นการ “เลื่อนเป้าหมาย” เพิ่ม)
      // gyro จะคุม “แรงหลัก”
      L.yawT   = clamp(yawN + (L.yawT * 0.35), -1, 1);
      L.pitchT = clamp(pitchN + (L.pitchT * 0.35), -1, 1);
    }

    // bind
    playfield.addEventListener('pointerdown', onDown, { passive:true });
    playfield.addEventListener('pointermove', onMove, { passive:true });
    playfield.addEventListener('pointerup', onUp, { passive:true });
    playfield.addEventListener('pointercancel', onUp, { passive:true });
    playfield.addEventListener('mouseleave', onUp, { passive:true });

    // touch fallback
    playfield.addEventListener('touchstart', onDown, { passive:true });
    playfield.addEventListener('touchmove', onMove, { passive:true });
    playfield.addEventListener('touchend', onUp, { passive:true });

    ROOT.addEventListener('deviceorientation', onOrient, { passive:true });

    // start loop
    L.raf = ROOT.requestAnimationFrame(tick);

    return {
      stop(){
        L.enabled = false;
        try{ if (L.raf) ROOT.cancelAnimationFrame(L.raf); }catch{}
        playfield.removeEventListener('pointerdown', onDown);
        playfield.removeEventListener('pointermove', onMove);
        playfield.removeEventListener('pointerup', onUp);
        playfield.removeEventListener('pointercancel', onUp);
        playfield.removeEventListener('mouseleave', onUp);

        playfield.removeEventListener('touchstart', onDown);
        playfield.removeEventListener('touchmove', onMove);
        playfield.removeEventListener('touchend', onUp);

        ROOT.removeEventListener('deviceorientation', onOrient);
      }
    };
  }

  // สร้าง world + look
  const world = ensurePlayfieldWorld();
  look = setupLookPan(world);

  // --------------------- HUD update helpers ---------------------
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
    if (typeof F.setFever === 'function') F.setFever(state.fever);
    if (typeof F.setFeverActive === 'function') F.setFeverActive(state.feverActive);
    if (typeof F.setShield === 'function') F.setShield(state.shield);
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

  // --------------------- Expire (ของหลุด) ---------------------
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

  // --------------------- Clock tick (GREEN tick ต้อง sync เข้า quest) ---------------------
  let timer = null;

  function secondTick(){
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // water drift
    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    // ✅ GREEN tick counting + sync เข้า quest
    const z = zoneFrom(state.waterPct);
    state.zone = z;

    if (Q && Q.stats) Q.stats.zone = z;
    if (z === 'GREEN'){
      state.greenTick += 1;
      if (Q && Q.stats) Q.stats.greenTick = (Q.stats.greenTick | 0) + 1;
    }

    // ให้ quest เดินเวลา (timeSec/secSinceJunk)
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

    updateQuestHud();
  }

  // --------------------- Start spawner ---------------------
  const spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ spawn ลง world ที่เลื่อนตาม gyro/drag
    spawnHost: world ? '#hvr-world' : (playfield ? '#hvr-playfield' : null),

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },
    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    judge: (ch, ctx) => {
      // power types:
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

  // init HUD
  updateWaterHud();
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // start timer
  timer = ROOT.setInterval(secondTick, 1000);

  // stop cleanup
  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  function stop(){
    try{ if (timer) ROOT.clearInterval(timer); }catch{}
    timer = null;

    try{ look && look.stop && look.stop(); }catch{}
    look = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}

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

  return { stop };
}

export default { boot };
