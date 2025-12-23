// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE) — FULL (PATCH B++)
// ✅ Compact HUD (auto-hide) + ไม่บังเป้า
// ✅ Spawn กระจายทั้งสนาม (แก้กองกลาง)
// ✅ กันตกขอบ (clamp + pad) ใช้กับ mode-factory PATCH EDGE-FIX
// ✅ Gyro นุ่มขึ้น/ไม่ไวเกิน (เอียงนิดเดียวไม่หนี)
// ✅ จบเกมไม่จอดำ: มี End Summary overlay เสมอ

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
function qs(name, fallback=null){
  try{
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }catch{ return fallback; }
}

// FX layer (particles.js IIFE)
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
  junkWaterPush:  -10,
  waterDriftPerSec: -0.9,

  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 10,

  feverGainGood:  10,
  feverGainPower: 16,
  feverLoseJunk:  20,
  feverAutoDecay: 1.1,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  shieldOnFeverStart: 2,
  shieldMax: 6,

  missOnGoodExpire: true,

  // ✅ Gyro/drag feel (นุ่มลง + ไม่ไว)
  lookMaxX: 240,
  lookMaxY: 170,
  lookPxPerDegX: 5.2,
  lookPxPerDegY: 4.4,
  lookSmooth: 0.08,       // smoothing แรงขึ้น

  // ✅ จำกัดการกระชากต่อเฟรม (กัน “วิ่งหนี”)
  lookStepClamp: 26,

  urgencyAtSec: 10,
  urgencyBeepHz: 920,

  stormEverySec: 18,
  stormDurationSec: 5,
  stormIntervalMul: 0.72
};

// --------------------- Mini HUD (auto-hide) ---------------------
function ensureMiniHUD(){
  if ($id('hha-mini-hud')) return;

  const sId = 'hha-mini-hud-style';
  if (!$id(sId)) {
    const st = document.createElement('style');
    st.id = sId;
    st.textContent = `
      #hha-mini-hud{
        position:fixed;
        left:10px; right:10px; top:10px;
        z-index:120;
        pointer-events:none;
        display:flex;
        gap:10px;
        align-items:center;
        justify-content:space-between;
        padding:10px 12px;
        border-radius:999px;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 18px 50px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
        transform: translate3d(0,0,0);
        opacity:.92;
        transition: opacity .22s ease, transform .22s ease;
      }
      #hha-mini-hud.hha-hide{
        opacity:0;
        transform: translate3d(0,-10px,0);
      }
      #hha-mini-hud .grp{ display:flex; gap:10px; align-items:center; }
      #hha-mini-hud .pill{
        display:flex; gap:8px; align-items:center;
        padding:7px 10px;
        border-radius:999px;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        font-weight:900;
        letter-spacing:.02em;
        font-size:13px;
        white-space:nowrap;
      }
      #hha-mini-hud .mut{ opacity:.82; font-weight:800; }
      #hha-mini-hud .val{ font-variant-numeric: tabular-nums; }
      #hha-mini-hud .dot{ opacity:.35; }
      #hha-mini-hud button{
        pointer-events:auto;
        background:rgba(2,6,23,.45);
        border:1px solid rgba(148,163,184,.18);
        color:inherit;
        border-radius:999px;
        padding:7px 10px;
        font-weight:900;
        cursor:pointer;
      }
      #hha-mini-panel{
        position:fixed;
        left:10px; right:10px; top:62px;
        z-index:119;
        pointer-events:none;
        display:none;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        border-radius:18px;
        padding:12px 12px;
        backdrop-filter: blur(10px);
        box-shadow:0 18px 50px rgba(0,0,0,.45);
      }
      #hha-mini-panel.on{ display:block; }
      #hha-mini-panel .t{ font-weight:1000; font-size:14px; margin-bottom:6px; }
      #hha-mini-panel .m{ opacity:.85; font-size:12px; line-height:1.35; }
    `;
    document.head.appendChild(st);
  }

  const hud = document.createElement('div');
  hud.id = 'hha-mini-hud';
  hud.innerHTML = `
    <div class="grp">
      <div class="pill"><span class="val" id="m-zone">GREEN</span></div>
      <div class="pill"><span class="mut">🏁</span><span class="val" id="m-score">0</span><span class="mut">pts</span></div>
      <div class="pill"><span class="mut">⚡</span><span class="val" id="m-combo">0</span></div>
      <div class="pill"><span class="mut">✖</span><span class="val" id="m-miss">0</span></div>
    </div>
    <div class="grp">
      <div class="pill"><span class="mut">⏳</span><span class="val" id="m-time">0:00</span></div>
      <button type="button" id="m-info" aria-label="info">i</button>
      <button type="button" id="m-pin" aria-label="pin">📌</button>
    </div>
  `;
  document.body.appendChild(hud);

  const panel = document.createElement('div');
  panel.id = 'hha-mini-panel';
  panel.innerHTML = `
    <div class="t">Quest</div>
    <div class="m" id="m-goal">Goal: —</div>
    <div class="m" id="m-mini">Mini: —</div>
  `;
  document.body.appendChild(panel);

  // ถ้ามี HUD ใหญ่เดิม → ซ่อนไปเลย (ไม่ให้บังเป้า)
  const bigHud = document.querySelector('.hud');
  if (bigHud) {
    bigHud.style.display = 'none';
  }

  // crosshair ถ้ายังว่าง ให้แสดงแบบเบา ๆ
  const cross = $id('hvr-crosshair');
  if (cross && !cross.__hhaStyled) {
    cross.__hhaStyled = 1;
    cross.innerHTML = `
      <div style="
        width:44px;height:44px;border-radius:999px;
        border:2px solid rgba(255,255,255,.22);
        box-shadow:0 0 0 3px rgba(34,197,94,.10), 0 0 18px rgba(34,197,94,.12);
        position:relative;
      ">
        <div style="
          position:absolute;left:50%;top:50%;
          width:10px;height:10px;border-radius:999px;
          transform:translate(-50%,-50%);
          background:rgba(255,255,255,.18);
        "></div>
      </div>
    `;
  }

  // auto-hide behavior
  let pinned = false;
  let lastWake = 0;
  const HIDE_MS = 1200;

  function wake(){
    lastWake = performance.now();
    hud.classList.remove('hha-hide');
  }
  function tick(){
    if (pinned) return ROOT.requestAnimationFrame(tick);
    const now = performance.now();
    if (now - lastWake > HIDE_MS) hud.classList.add('hha-hide');
    ROOT.requestAnimationFrame(tick);
  }
  wake();
  ROOT.requestAnimationFrame(tick);

  // info/pin buttons
  const btnInfo = $id('m-info');
  const btnPin  = $id('m-pin');
  if (btnInfo) {
    btnInfo.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      panel.classList.toggle('on');
      wake();
    }, { passive:false });
  }
  if (btnPin) {
    btnPin.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      pinned = !pinned;
      btnPin.textContent = pinned ? '📌' : '📍';
      if (!pinned) wake();
    }, { passive:false });
  }

  // wake on interaction
  ROOT.addEventListener('pointerdown', wake, { passive:true });
  ROOT.addEventListener('pointermove', wake, { passive:true });
}

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureWaterGauge();

  const playfield = $id('hvr-playfield') || null;
  if (!playfield) {
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  // ✅ ใช้ HUD เล็กเสมอ (ลดเกะกะ/ไม่บังเป้า)
  ensureMiniHUD();

  playfield.style.willChange = 'transform';
  playfield.style.transform = 'translate3d(0,0,0)';

  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    if (typeof FeverUI.setFever === 'function') FeverUI.setFever(0);
    if (typeof FeverUI.setFeverActive === 'function') FeverUI.setFeverActive(false);
    if (typeof FeverUI.setShield === 'function') FeverUI.setShield(0);
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
    shield: 0,

    lookTX: 0,
    lookTY: 0,
    lookVX: 0,
    lookVY: 0,

    stormLeft: 0,

    stopped: false
  };

  const Q = createHydrationQuest(difficulty);

  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  function fmtTime(sec){
    sec = Math.max(0, sec|0);
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function updateMiniHUD(){
    const z = $id('m-zone');  if (z) z.textContent = state.zone;
    const sc = $id('m-score'); if (sc) sc.textContent = String(state.score|0);
    const cb = $id('m-combo'); if (cb) cb.textContent = String(state.comboBest|0);
    const ms = $id('m-miss');  if (ms) ms.textContent = String(state.miss|0);
    const tm = $id('m-time');  if (tm) tm.textContent = fmtTime(state.timeLeft);

    const mg = $id('m-goal');
    const mm = $id('m-mini');
    if (mg) mg.textContent = ($id('hha-quest-goal')?.textContent) || 'Goal: —';
    if (mm) mm.textContent = ($id('hha-quest-mini')?.textContent) || 'Mini: —';
  }

  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
    updateMiniHUD();
  }

  function calcProgressToS(){
    const goalsDone = (Q.goals || []).filter(g => g._done || g.done).length;
    const minisDone = (Q.minis || []).filter(m => m._done || m.done).length;
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

    // (รองรับถ้าเกมอื่นมี progress UI)
    const fill = $id('hha-grade-progress-fill');
    const txt  = $id('hha-grade-progress-text');
    if (fill) fill.style.width = progPct + '%';
    if (txt)  txt.textContent = `Progress to S (30%): ${progPct}%`;

    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';

    const gb = $id('hha-grade-badge');
    if (gb) gb.textContent = grade;

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

    updateMiniHUD();
  }

  function updateQuestHud(){
    const goalsView = Q.getProgress('goals');
    const minisView = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    const curGoalId = (goalsView && goalsView[0]) ? goalsView[0].id : (allGoals[0]?.id || '');
    const curMiniId = (minisView && minisView[0]) ? minisView[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoalId) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMiniId) : null;

    // ถ้าไม่มี element ใน HTML ก็ไม่เป็นไร (เรามี mini panel ของเรา)
    const goalEl = $id('hha-quest-goal');
    const miniEl = $id('hha-quest-mini');
    if (goalEl) goalEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : `Goal: ทำภารกิจให้ครบ`;
    if (miniEl) miniEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : `Mini: ทำมินิเควส`;

    dispatch('quest:update', {
      goalDone: goalsDone,
      goalTotal: allGoals.length || 2,
      miniDone: minisDone,
      miniTotal: allMinis.length || 3,
      goalText: goalEl ? goalEl.textContent : (gInfo?.text || ''),
      miniText: miniEl ? miniEl.textContent : (mInfo?.text || '')
    });

    updateScoreHud();
    updateMiniHUD();
  }

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

  function isPerfectHit(isGoodOrPower){
    if (!isGoodOrPower) return false;
    if (state.zone !== 'GREEN') return false;
    return (state.combo >= 5) || state.feverActive;
  }

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

    const perfect = isPerfectHit(isGood || isPower);
    if (perfect) {
      scoreDelta += TUNE.scorePerfectBonus * mult;
      label = 'PERFECT';
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
    if (state.stopped) return;
    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;
      state.waterPct = clamp(state.waterPct - 3, 0, 100);
      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');
    }
  }

  // --------------------- LOOK controls ---------------------
  let dragOn = false;
  let lastX = 0, lastY = 0;

  // ✅ ลด “หนี” ด้วย step clamp
  function stepClamp(next, cur, maxStep){
    const d = next - cur;
    if (Math.abs(d) <= maxStep) return next;
    return cur + Math.sign(d) * maxStep;
  }

  function applyLookTransform(){
    // smooth target -> velocity
    state.lookVX += (state.lookTX - state.lookVX) * TUNE.lookSmooth;
    state.lookVY += (state.lookTY - state.lookVY) * TUNE.lookSmooth;

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
    const dx = clamp(x - lastX, -28, 28);
    const dy = clamp(y - lastY, -24, 24);
    lastX = x; lastY = y;

    const nx = clamp(state.lookTX + dx * 1.10, -TUNE.lookMaxX, TUNE.lookMaxX);
    const ny = clamp(state.lookTY + dy * 0.95, -TUNE.lookMaxY, TUNE.lookMaxY);
    state.lookTX = stepClamp(nx, state.lookTX, TUNE.lookStepClamp);
    state.lookTY = stepClamp(ny, state.lookTY, TUNE.lookStepClamp);
  }
  function onPointerUp(){ dragOn = false; }

  async function tryEnableGyro(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D) return false;
      if (typeof D.requestPermission === 'function') return false;
      return true;
    }catch{ return false; }
  }

  // ✅ Gyro low-pass + deadzone (เอียงนิดเดียวไม่กระโดด)
  function onDeviceOrientation(e){
    const g = Number(e.gamma);
    const b = Number(e.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    const DEAD_G = 2.3;
    const DEAD_B = 2.8;

    let gg = Math.abs(g) < DEAD_G ? 0 : g;
    let bb = Math.abs(b) < DEAD_B ? 0 : b;

    // bias ให้ “กึ่งกลาง” คงที่
    const BIAS_B = 18;

    const tx = clamp(gg * TUNE.lookPxPerDegX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const ty = clamp((bb - BIAS_B) * TUNE.lookPxPerDegY, -TUNE.lookMaxY, TUNE.lookMaxY);

    // low-pass to target (นุ่ม)
    state.lookTX = stepClamp(state.lookTX * 0.88 + tx * 0.12, state.lookTX, TUNE.lookStepClamp);
    state.lookTY = stepClamp(state.lookTY * 0.88 + ty * 0.12, state.lookTY, TUNE.lookStepClamp);
  }

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

  // --------------------- Clock tick ---------------------
  let timer = null;
  let rafId = null;

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

    state.waterPct = clamp(state.waterPct + TUNE.waterDriftPerSec, 0, 100);
    updateWaterHud();

    const z = zoneFrom(state.waterPct);
    state.zone = z;

    if (z === 'GREEN'){
      state.greenTick += 1;
      if (Q && Q.stats){
        Q.stats.zone = 'GREEN';
        Q.stats.greenTick = (Q.stats.greenTick|0) + 1;
      }
    } else {
      if (Q && Q.stats) Q.stats.zone = z;
    }

    Q.second();

    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else { state.fever = 100; feverRender(); }
    } else {
      state.fever = clamp(state.fever - TUNE.feverAutoDecay, 0, 100);
      feverRender();
    }

    if (state.stormLeft > 0) state.stormLeft -= 1;
    if (state.timeLeft > 0 && (state.timeLeft % TUNE.stormEverySec) === 0) {
      state.stormLeft = TUNE.stormDurationSec;
      dispatch('hha:coach', { text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy' });
      try{ Particles.toast && Particles.toast('STORM WAVE!', 'warn'); }catch{}
    }

    if (state.timeLeft > 0 && state.timeLeft <= TUNE.urgencyAtSec) {
      beep(TUNE.urgencyBeepHz, 0.04);
      if (state.timeLeft === TUNE.urgencyAtSec) {
        dispatch('hha:coach', { text:'⏳ ใกล้หมดเวลา! รักษา GREEN + ยิงน้ำดีให้ไว!', mood:'sad' });
      }
    }

    updateQuestHud();

    if (state.timeLeft <= 0) stop();
  }

  function rafLoop(){
    if (state.stopped) return;
    applyLookTransform();
    rafId = ROOT.requestAnimationFrame(rafLoop);
  }

  // --------------------- Start spawner ---------------------
  let spawner = null;

  // ✅ boundsHost = ชั้น viewport ไม่โดน translate (ถ้ามี)
  const boundsEl = $id('hvr-bounds') || $id('hvr-stage') || document.body;

  // ✅ กระจายทั้งสนาม (แก้ “อยู่บริเวณเดียวกัน”)
  const spread = String(qs('spread','1')) !== '0';

  spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    spawnHost: '#hvr-playfield',
    boundsHost: boundsEl,

    // ✅ Storm เร่ง spawn “จริง”
    spawnIntervalMul: () => (state.stormLeft > 0 ? TUNE.stormIntervalMul : 1),

    // ✅ ตัด HUD ออก (เราใช้ mini HUD)
    excludeSelectors: [
      '.hud',
      '#hha-mini-hud',
      '#hha-mini-panel',
      '#hvr-crosshair',
      '#hvr-end'
    ],

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔']
    },

    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    // ✅ กระจายจริง (ใช้ uniform)
    spawnAroundCrosshair: spread ? false : true,
    spawnRadiusX: spread ? 0.92 : 0.42,
    spawnRadiusY: spread ? 0.86 : 0.38,
    minSeparation: spread ? 0.82 : 0.95,
    maxSpawnTries: 22,

    judge: (ch, ctx) => {
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

      if (state.stormLeft > 0 && (ctx.isGood || ctx.isPower)) {
        state.fever = clamp(state.fever + 2, 0, 100);
      }

      return judge(ch, ctx);
    },

    onExpire: (info) => {
      if (state.stormLeft > 0 && info && info.isGood && !info.isPower) {
        state.waterPct = clamp(state.waterPct - 2, 0, 100);
      }
      onExpire(info);
    }
  });

  updateWaterHud();
  if (Q && Q.stats){
    Q.stats.zone = zoneFrom(state.waterPct);
    Q.stats.greenTick = 0;
  }
  updateQuestHud();
  updateScoreHud();
  feverRender();
  updateMiniHUD();

  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  if (await tryEnableGyro()) {
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  const onceAsk = async () => {
    ROOT.removeEventListener('pointerdown', onceAsk);
    await requestGyroPermission();
  };
  ROOT.addEventListener('pointerdown', onceAsk, { passive:true });

  timer = ROOT.setInterval(secondTick, 1000);
  rafId = ROOT.requestAnimationFrame(rafLoop);

  const onStop = () => stop();
  ROOT.addEventListener('hha:stop', onStop);

  const onTime = (e)=>{
    const sec = Number(e?.detail?.sec);
    if (Number.isFinite(sec) && sec <= 0) stop();
  };
  ROOT.addEventListener('hha:time', onTime, { passive:true });

  // --------------------- End summary (กันจอดำ) ---------------------
  function showEndOverlay(payload){
    let end = $id('hvr-end');
    if (!end) {
      end = document.createElement('div');
      end.id = 'hvr-end';
      document.body.appendChild(end);
    }

    // ensure style if HTML ไม่ได้มี
    if (!end.__hhaStyled) {
      end.__hhaStyled = 1;
      Object.assign(end.style, {
        position:'fixed', inset:'0', zIndex:'200',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'18px',
        background:'rgba(2,6,23,.68)',
        backdropFilter:'blur(10px)'
      });
    }

    const grade = ($id('hha-grade-badge')?.textContent) || 'C';
    const greenTick = payload.greenTick|0;
    const html = `
      <div style="
        width:min(520px,92vw);
        border-radius:22px;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 22px 70px rgba(0,0,0,.55);
        padding:16px 16px;
        color:#e5e7eb;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="font-weight:1000;font-size:18px;">🏁 จบเกม Hydration</div>
          <div style="padding:6px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.55);font-weight:1000;">
            Grade ${grade}
          </div>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="padding:10px 12px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.45);">
            <div style="opacity:.85;font-size:12px;">Score</div>
            <div style="font-size:26px;font-weight:1000;">${payload.score|0} pts</div>
          </div>
          <div style="padding:10px 12px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.45);">
            <div style="opacity:.85;font-size:12px;">Combo Best</div>
            <div style="font-size:26px;font-weight:1000;">${payload.comboBest|0}</div>
          </div>
          <div style="padding:10px 12px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.45);">
            <div style="opacity:.85;font-size:12px;">Miss</div>
            <div style="font-size:26px;font-weight:1000;">${payload.miss|0}</div>
          </div>
          <div style="padding:10px 12px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.45);">
            <div style="opacity:.85;font-size:12px;">GREEN time</div>
            <div style="font-size:26px;font-weight:1000;">${greenTick}s</div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button id="hvr-retry" style="
            pointer-events:auto;
            border-radius:999px;padding:10px 12px;
            background:rgba(34,197,94,.18);
            border:1px solid rgba(34,197,94,.35);
            color:#e5e7eb;font-weight:1000;cursor:pointer;
          ">เล่นอีกครั้ง</button>
          <button id="hvr-close" style="
            pointer-events:auto;
            border-radius:999px;padding:10px 12px;
            background:rgba(148,163,184,.10);
            border:1px solid rgba(148,163,184,.22);
            color:#e5e7eb;font-weight:1000;cursor:pointer;
          ">ปิด</button>
        </div>
      </div>
    `;
    end.innerHTML = html;
    end.classList.add('on');
    end.style.display = 'flex';

    const retry = $id('hvr-retry');
    const close = $id('hvr-close');
    if (retry) retry.onclick = () => { try{ location.reload(); }catch{} };
    if (close) close.onclick = () => { try{ end.style.display='none'; }catch{} };
  }

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

    const payload = {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: (Q && Q.stats) ? (Q.stats.greenTick|0) : (state.greenTick|0)
    };

    dispatch('hha:end', payload);
    dispatch('hha:coach', { text:'🏁 จบเกม! ดูผลคะแนนได้เลย', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}

    // ✅ กันจอดำ: สร้าง overlay สรุปเสมอ
    showEndOverlay(payload);
  }

  return { stop };
}

export default { boot };