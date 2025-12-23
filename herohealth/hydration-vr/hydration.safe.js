// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
//
// ✅ FIX PACK (Layout + Spread + Gyro + EndScreen)
// - HUD card ใหญ่ซ่อน (กันบังเป้า) → ใช้ MiniHUD แถบบน + ปุ่ม i เปิดแผงดูรายละเอียด
// - Spawn กระจายทั่วสนามจริง (spawnAroundCrosshair:false → FULL-SPREAD ตาม mode-factory PATCH A)
// - Gyro ไม่วิ่งหนี: baseline + smoothing + sensitivity ลดลง + recenter ได้
// - End game ไม่จอดำ: render end screen ลง #hvr-end

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

  // ---- LOOK (ลดความไว + ทำ baseline) ----
  lookMaxX: 320,
  lookMaxY: 240,

  // px/deg (ลดลงให้ “เอียงนิดเดียวไม่พุ่ง”)
  lookPxPerDegX: 5.2,
  lookPxPerDegY: 4.6,

  // smoothing ของ applyLookTransform (ยิ่งต่ำยิ่งนิ่ง)
  lookSmooth: 0.085,

  // gyro blend (0..1) ยิ่งต่ำยิ่งนิ่ง
  gyroBlend: 0.16,

  // deadzone กันสั่น
  gyroDeadGamma: 2.2,
  gyroDeadBeta:  2.8,

  // bias beta กันเงย/ก้ม baseline เพิ่มเติม
  gyroBetaBias: 16,

  urgencyAtSec: 10,
  urgencyBeepHz: 920,

  stormEverySec: 18,
  stormDurationSec: 5,
  stormIntervalMul: 0.72
};

// --------------------- Mini HUD (ไม่บังเป้า) ---------------------
function ensureMiniHud(){
  if (!document || document.getElementById('hha-mini-hud')) return;

  const style = document.createElement('style');
  style.id = 'hha-mini-hud-style';
  style.textContent = `
    #hha-mini-hud{
      position:fixed;
      left:10px; right:10px; top:10px;
      z-index:120;
      pointer-events:none;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }
    #hha-mini-hud .bar{
      pointer-events:none;
      flex:1;
      display:flex;
      gap:8px;
      align-items:center;
      justify-content:flex-start;
      flex-wrap:nowrap;
      overflow:hidden;
      background:rgba(2,6,23,.60);
      border:1px solid rgba(148,163,184,.18);
      border-radius:999px;
      padding:8px 10px;
      backdrop-filter: blur(10px);
      box-shadow:0 18px 50px rgba(0,0,0,.45);
    }
    #hha-mini-hud .chip{
      display:flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(2,6,23,.55);
      border:1px solid rgba(148,163,184,.16);
      white-space:nowrap;
      font-weight:900;
      font-size:12px;
      color:#e5e7eb;
      pointer-events:none;
    }
    #hha-mini-hud .chip b{ font-weight:900; }
    #hha-mini-hud .actions{
      display:flex; gap:10px;
      pointer-events:auto;
    }
    #hha-mini-hud button{
      width:46px; height:46px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.60);
      color:#e5e7eb;
      font-weight:900;
      font-size:18px;
      box-shadow:0 18px 50px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
      pointer-events:auto;
    }
    #hha-mini-panel{
      position:fixed;
      inset:0;
      z-index:140;
      display:none;
      align-items:center;
      justify-content:center;
      padding:16px;
      background:rgba(2,6,23,.55);
      backdrop-filter: blur(10px);
    }
    #hha-mini-panel.on{ display:flex; }
    #hha-mini-panel .card{
      width:min(560px, 92vw);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.78);
      box-shadow:0 22px 70px rgba(0,0,0,.55);
      padding:16px 16px 14px;
      color:#e5e7eb;
    }
    #hha-mini-panel .title{
      font-size:20px;
      font-weight:1000;
      margin:2px 0 8px;
    }
    #hha-mini-panel .muted{ color:#94a3b8; font-size:12px; }
    #hha-mini-panel .row{ display:flex; justify-content:space-between; gap:10px; align-items:center; }
    #hha-mini-panel .pill{
      border:1px solid rgba(148,163,184,.22);
      background:rgba(2,6,23,.55);
      border-radius:999px;
      padding:6px 10px;
      font-weight:900;
      font-size:12px;
      white-space:nowrap;
    }
    #hha-mini-panel .grid{
      margin-top:10px;
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
    }
    #hha-mini-panel .box{
      border:1px solid rgba(148,163,184,.14);
      background:rgba(15,23,42,.35);
      border-radius:16px;
      padding:10px;
    }
    #hha-mini-panel .btns{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:12px;
    }
    #hha-mini-panel .btn{
      border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.55);
      color:#e5e7eb;
      padding:10px 12px;
      font-weight:900;
    }
  `;
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.id = 'hha-mini-hud';
  hud.setAttribute('data-hha-exclude','1'); // กัน spawn มาทับแถบบน

  hud.innerHTML = `
    <div class="bar" data-hha-exclude="1">
      <div class="chip" id="m-zone">💧 <b>GREEN</b></div>
      <div class="chip" id="m-score">🏁 <b>0</b> pts</div>
      <div class="chip" id="m-combo">⚡ <b>0</b></div>
      <div class="chip" id="m-miss">✖ <b>0</b></div>
      <div class="chip" id="m-time">⏳ <b>0:00</b></div>
    </div>
    <div class="actions" data-hha-exclude="1">
      <button id="m-info" aria-label="info">i</button>
      <button id="m-center" aria-label="center">+</button>
    </div>
  `;
  document.body.appendChild(hud);

  const panel = document.createElement('div');
  panel.id = 'hha-mini-panel';
  panel.setAttribute('data-hha-exclude','1');
  panel.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div class="muted">Quest</div>
          <div class="title">Hydration</div>
        </div>
        <div class="pill">Grade <span id="p-grade">C</span></div>
      </div>

      <div class="muted" style="margin-top:6px;">
        <div id="p-goal">Goal: —</div>
        <div id="p-mini">Mini: —</div>
      </div>

      <div class="grid">
        <div class="box">
          <div class="muted">Water</div>
          <div style="font-size:18px;font-weight:1000;margin-top:4px;">
            <span id="p-zone">GREEN</span> • <span id="p-water">50</span>%
          </div>
          <div class="muted">รักษาให้อยู่ GREEN ให้นานที่สุด 💧</div>
        </div>
        <div class="box">
          <div class="muted">Stats</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            <span class="pill">Score <b id="p-score">0</b></span>
            <span class="pill">ComboMax <b id="p-combo">0</b></span>
            <span class="pill">Miss <b id="p-miss">0</b></span>
            <span class="pill">GreenSec <b id="p-green">0</b></span>
          </div>
        </div>
      </div>

      <div class="btns">
        <button class="btn" id="p-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const btnInfo = document.getElementById('m-info');
  const btnCenter = document.getElementById('m-center');
  const btnClose = document.getElementById('p-close');

  const togglePanel = (on)=>{
    const p = document.getElementById('hha-mini-panel');
    if (!p) return;
    if (on == null) on = !p.classList.contains('on');
    p.classList.toggle('on', !!on);
  };

  btnInfo && btnInfo.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); togglePanel(true); }, { passive:false });
  btnClose && btnClose.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); togglePanel(false); }, { passive:false });

  // btnCenter: ให้ safe.js ผูก handler อีกชั้น (recenter gyro)
  btnCenter && btnCenter.addEventListener('contextmenu', (e)=>{ e.preventDefault(); }, { passive:false });
}

function hideBigHudCards(){
  // ถ้ามี HUD แบบการ์ด (จาก html เก่า) ให้ซ่อน เพื่อไม่บังสนาม
  try{
    const big = document.querySelector('.hud');
    if (big) big.style.display = 'none';
  }catch{}
}

function fmtTime(sec){
  sec = Math.max(0, sec|0);
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureWaterGauge();
  ensureMiniHud();
  hideBigHudCards();

  const playfield = $id('hvr-playfield') || null;
  if (!playfield) {
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  playfield.style.willChange = 'transform';
  playfield.style.transform = 'translate3d(0,0,0)';

  // Fever UI (optional)
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

    // look target/velocity
    lookTX: 0,
    lookTY: 0,
    lookVX: 0,
    lookVY: 0,

    // gyro baseline
    gyroOn: false,
    gyroZeroG: null,
    gyroZeroB: null,

    stormLeft: 0,
    stopped: false
  };

  const Q = createHydrationQuest(difficulty);

  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // --------------------- HUD updates ---------------------
  function updateMiniHud(){
    const z = document.getElementById('m-zone');
    const sc = document.getElementById('m-score');
    const cb = document.getElementById('m-combo');
    const ms = document.getElementById('m-miss');
    const tm = document.getElementById('m-time');

    if (z) z.innerHTML  = `💧 <b>${state.zone}</b>`;
    if (sc) sc.innerHTML = `🏁 <b>${state.score|0}</b> pts`;
    if (cb) cb.innerHTML = `⚡ <b>${state.comboBest|0}</b>`;
    if (ms) ms.innerHTML = `✖ <b>${state.miss|0}</b>`;
    if (tm) tm.innerHTML = `⏳ <b>${fmtTime(state.timeLeft)}</b>`;
  }

  function updatePanel(){
    const goalsDone = (Q.goals || []).filter(g => g._done || g.done).length;
    const minisDone = (Q.minis || []).filter(m => m._done || m.done).length;

    const fill = $id('p-grade'); if (fill) fill.textContent = ($id('hha-grade-badge')?.textContent || 'C');

    const gEl = $id('p-goal'); if (gEl) gEl.textContent = $id('hha-quest-goal')?.textContent || 'Goal: —';
    const mEl = $id('p-mini'); if (mEl) mEl.textContent = $id('hha-quest-mini')?.textContent || 'Mini: —';

    const pz = $id('p-zone'); if (pz) pz.textContent = state.zone;
    const pw = $id('p-water'); if (pw) pw.textContent = String(Math.round(state.waterPct));
    const ps = $id('p-score'); if (ps) ps.textContent = String(state.score|0);
    const pc = $id('p-combo'); if (pc) pc.textContent = String(state.comboBest|0);
    const pm = $id('p-miss'); if (pm) pm.textContent = String(state.miss|0);
    const pg = $id('p-green'); if (pg) pg.textContent = String((Q && Q.stats) ? (Q.stats.greenTick|0) : (state.greenTick|0));

    // ให้ panel สื่อว่าทำไปกี่เควสแล้ว (optional)
    // ไม่ยัดเพิ่มให้รกหน้าจอ
    void goalsDone; void minisDone;
  }

  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
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

    // grade calc
    let grade = 'C';
    if (progPct >= 95) grade = 'SSS';
    else if (progPct >= 85) grade = 'SS';
    else if (progPct >= 70) grade = 'S';
    else if (progPct >= 50) grade = 'A';
    else if (progPct >= 30) grade = 'B';

    // (เผื่อ html เก่ายังมี badge)
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
      grade,
      label: label || ''
    });

    updateMiniHud();
    updatePanel();
  }

  function updateQuestHud(){
    const goalsView = Q.getProgress('goals');
    const minisView = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];

    const curGoalId = (goalsView && goalsView[0]) ? goalsView[0].id : (allGoals[0]?.id || '');
    const curMiniId = (minisView && minisView[0]) ? minisView[0].id : (allMinis[0]?.id || '');

    const gInfo = Q.getGoalProgressInfo ? Q.getGoalProgressInfo(curGoalId) : null;
    const mInfo = Q.getMiniProgressInfo ? Q.getMiniProgressInfo(curMiniId) : null;

    // (เผื่อ html เดิมยังใช้)
    const goalEl = $id('hha-quest-goal');
    const miniEl = $id('hha-quest-mini');
    if (goalEl) goalEl.textContent = gInfo?.text ? `Goal: ${gInfo.text}` : `Goal: ทำภารกิจให้ครบ`;
    if (miniEl) miniEl.textContent = mInfo?.text ? `Mini: ${mInfo.text}` : `Mini: ทำมินิเควส`;

    dispatch('quest:update', {
      goalText: goalEl ? goalEl.textContent : (gInfo?.text || ''),
      miniText: miniEl ? miniEl.textContent : (mInfo?.text || '')
    });

    updateScoreHud();
  }

  // --------------------- Fever ---------------------
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

  function applyLookTransform(){
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
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    // drag คุมแบบนิ่ม ๆ
    state.lookTX = clamp(state.lookTX + dx * 1.05, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy * 0.95, -TUNE.lookMaxY, TUNE.lookMaxY);
  }
  function onPointerUp(){ dragOn = false; }

  async function tryEnableGyro(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D) return false;
      if (typeof D.requestPermission === 'function') return false; // iOS ต้องขอเอง
      return true;
    }catch{ return false; }
  }

  function gyroRecenter(){
    state.gyroZeroG = null;
    state.gyroZeroB = null;
    dispatch('hha:coach', { text:'🎯 Re-center มุมมองแล้ว', mood:'neutral' });
    try{ Particles.toast && Particles.toast('CENTER ✅', 'good'); }catch{}
  }

  function onDeviceOrientation(e){
    const gRaw = Number(e.gamma);
    const bRaw = Number(e.beta);
    if (!Number.isFinite(gRaw) || !Number.isFinite(bRaw)) return;

    // baseline ครั้งแรก
    if (state.gyroZeroG == null) state.gyroZeroG = gRaw;
    if (state.gyroZeroB == null) state.gyroZeroB = bRaw;

    const g = gRaw - state.gyroZeroG;
    const b = bRaw - state.gyroZeroB;

    const DEAD_G = TUNE.gyroDeadGamma;
    const DEAD_B = TUNE.gyroDeadBeta;

    let gg = Math.abs(g) < DEAD_G ? 0 : g;
    let bb = Math.abs(b) < DEAD_B ? 0 : b;

    const tx = gg * TUNE.lookPxPerDegX;
    const ty = (bb - TUNE.gyroBetaBias) * TUNE.lookPxPerDegY;

    // blend เข้ากับ lookTX/TY เดิมให้ “ไม่พุ่ง”
    const blend = clamp(TUNE.gyroBlend, 0.05, 0.45);
    state.lookTX = clamp(state.lookTX*(1-blend) + tx*blend, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY*(1-blend) + ty*blend, -TUNE.lookMaxY, TUNE.lookMaxY);

    state.gyroOn = true;
  }

  async function requestGyroPermission(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D || typeof D.requestPermission !== 'function') return;

      const res = await D.requestPermission();
      if (res === 'granted') {
        ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
        dispatch('hha:coach', { text:'✅ เปิด Gyro แล้ว! (เอียงเบา ๆ) 🕶️', mood:'happy' });
      } else {
        dispatch('hha:coach', { text:'ℹ️ Gyro ไม่ได้รับอนุญาต ใช้ลากจอแทนได้เลย 👍', mood:'neutral' });
      }
    }catch{
      dispatch('hha:coach', { text:'ℹ️ ใช้ลากจอแทนได้เลย (Gyro ไม่พร้อม)', mood:'neutral' });
    }
  }

  // ผูกปุ่ม center
  try{
    const btnCenter = document.getElementById('m-center');
    if (btnCenter){
      let holdT = null;
      btnCenter.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        holdT = setTimeout(()=>{ gyroRecenter(); }, 220);
      }, { passive:false });
      btnCenter.addEventListener('pointerup', ()=>{ if (holdT) clearTimeout(holdT); holdT=null; }, { passive:true });
      btnCenter.addEventListener('pointercancel', ()=>{ if (holdT) clearTimeout(holdT); holdT=null; }, { passive:true });
      btnCenter.addEventListener('click', (e)=>{ e.preventDefault(); gyroRecenter(); }, { passive:false });
    }
  }catch{}

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

  // --------------------- End screen ---------------------
  function ensureEndHost(){
    let end = $id('hvr-end');
    if (end) return end;
    end = document.createElement('div');
    end.id = 'hvr-end';
    document.body.appendChild(end);
    return end;
  }

  function showEndScreen(payload){
    const end = ensureEndHost();
    if (!end) return;

    end.classList.add('on');
    end.style.display = 'flex';
    end.style.alignItems = 'center';
    end.style.justifyContent = 'center';
    end.style.padding = '18px';
    end.style.background = 'rgba(2,6,23,.58)';
    end.style.backdropFilter = 'blur(10px)';
    end.style.zIndex = '200';

    const grade = ($id('hha-grade-badge')?.textContent || 'C');
    const gsec = payload.greenTick|0;

    end.innerHTML = `
      <div style="
        width:min(560px,92vw);
        background:rgba(2,6,23,.80);
        border:1px solid rgba(148,163,184,.18);
        border-radius:22px;
        box-shadow:0 26px 80px rgba(0,0,0,.60);
        padding:16px 16px 14px;
        color:#e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <div style="color:#94a3b8;font-size:12px;">Result</div>
            <div style="font-size:22px;font-weight:1000;margin-top:2px;">🏁 Hydration Complete</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);border-radius:999px;padding:6px 10px;font-weight:1000;">
            Grade ${grade}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
          <div style="border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.35);border-radius:16px;padding:10px;">
            <div style="color:#94a3b8;font-size:12px;">Score</div>
            <div style="font-size:20px;font-weight:1000;margin-top:4px;">${payload.score|0} pts</div>
            <div style="color:#94a3b8;font-size:12px;">ComboMax ${payload.comboBest|0}</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.35);border-radius:16px;padding:10px;">
            <div style="color:#94a3b8;font-size:12px;">Water</div>
            <div style="font-size:20px;font-weight:1000;margin-top:4px;">${payload.zone} • ${payload.water|0}%</div>
            <div style="color:#94a3b8;font-size:12px;">GREEN ${gsec}s</div>
          </div>
        </div>

        <div style="margin-top:10px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.25);border-radius:16px;padding:10px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="color:#94a3b8;font-size:12px;">Miss</div>
            <div style="font-size:18px;font-weight:1000;">✖ ${payload.miss|0}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
          <button id="hvr-restart" style="
            border-radius:14px;border:1px solid rgba(148,163,184,.18);
            background:rgba(34,197,94,.16);color:#e5e7eb;
            padding:10px 12px;font-weight:1000;">Restart</button>
          <button id="hvr-close" style="
            border-radius:14px;border:1px solid rgba(148,163,184,.18);
            background:rgba(2,6,23,.55);color:#e5e7eb;
            padding:10px 12px;font-weight:1000;">Close</button>
        </div>
      </div>
    `;

    const restart = document.getElementById('hvr-restart');
    const close = document.getElementById('hvr-close');

    restart && restart.addEventListener('click', (e)=>{
      e.preventDefault();
      try{ location.reload(); }catch{}
    }, { passive:false });

    close && close.addEventListener('click', (e)=>{
      e.preventDefault();
      // ปิด overlay เฉย ๆ (ถ้าอยากกลับ hub ให้เปลี่ยนเป็น location.href='../hub.html')
      end.classList.remove('on');
      end.style.display = 'none';
    }, { passive:false });
  }

  // --------------------- Start spawner ---------------------
  let spawner = null;

  // ✅ boundsHost = ชั้น viewport ไม่โดน translate (ถ้ามี)
  const boundsEl = $id('hvr-bounds') || $id('hvr-stage') || document.body;

  spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    spawnHost: '#hvr-playfield',
    boundsHost: boundsEl,

    // ✅ Storm เร่ง spawn “จริง”
    spawnIntervalMul: () => (state.stormLeft > 0 ? TUNE.stormIntervalMul : 1),

    // ✅ กันทับ UI ที่เล็ก ๆ เท่าที่จำเป็น
    excludeSelectors: [
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

    // ✅ IMPORTANT: กระจายทั่วจอจริง (FULL-SPREAD)
    spawnAroundCrosshair: false,

    // ค่านี้จะมีผลเมื่อ spawnAroundCrosshair:true เท่านั้น (เก็บไว้เผื่อสลับโหมด)
    spawnRadiusX: 0.78,
    spawnRadiusY: 0.74,

    minSeparation: 1.05,
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

  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  if (await tryEnableGyro()) {
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  // iOS: ขอ permission ครั้งแรกที่ผู้ใช้แตะจอ
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

    // ✅ แก้ “จบแล้วจอดำ”
    showEndScreen(payload);

    dispatch('hha:coach', { text:'🏁 จบเกม! แตะ Restart เพื่อเล่นใหม่ได้เลย', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}
  }

  return { stop };
}

export default { boot };