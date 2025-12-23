// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE)
// - spawn targets via mode-factory (DOM)
// - water gauge (GREEN/LOW/HIGH)
// - fever gauge + shield (global FeverUI from ./vr/ui-fever.js)
// - quest goal + mini quest (hydration.quest.js)
// - VR-feel look: gyro + drag -> playfield translate (เหมือน VR)
// - HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time
//
// ✅ PATCH B (PROD):
// - HUD Auto-hide + Compact top bar (ลดบังเป้า) + Pin/Info toggle
// - End Screen built-in (กัน "จอดำ" หลังจบเกม)
// - Tap-anywhere ยิงกลางจอ (shootCrosshair) ถ้าแตะพื้นที่ว่าง
// - Spawn spreadMix + tuning กระจายจริง ไม่กองกลาง
// - boundsHost ใช้ #hvr-wrap (นิ่ง) แยกจาก spawnHost (#hvr-playfield ที่โดน transform)

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
function now(){
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
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

  lookMaxX: 420,
  lookMaxY: 320,
  lookPxPerDegX: 9.2,
  lookPxPerDegY: 7.6,
  lookSmooth: 0.10,

  urgencyAtSec: 10,
  urgencyBeepHz: 920,

  stormEverySec: 18,
  stormDurationSec: 5,
  stormIntervalMul: 0.72,

  // HUD auto-hide
  hudIdleHideMs: 1900,
  hudFlashMs: 900,
  hudMinOpacity: 0.10,

  // tap shoot
  tapMoveDeadPx: 10,
  tapMaxMs: 260
};

// --------------------- UI helpers (inject compact HUD style) ---------------------
function ensureHydrationUI(){
  const doc = ROOT.document;
  if (!doc) return;

  // Compact HUD style (ไม่แก้ HTML)
  if (!doc.getElementById('hvr-hydration-ui-style')) {
    const s = doc.createElement('style');
    s.id = 'hvr-hydration-ui-style';
    s.textContent = `
      /* ============ HUD AUTO-HIDE / COMPACT BAR (Hydration) ============ */
      body.hvr-hud-hidden .hud{
        opacity:${TUNE.hudMinOpacity};
        transform: translate3d(0,-8px,0);
        transition: opacity .18s ease-out, transform .18s ease-out;
      }
      body.hvr-hud-shown .hud{
        opacity:1;
        transform: translate3d(0,0,0);
        transition: opacity .12s ease-out, transform .12s ease-out;
      }
      /* ให้ HUD เป็นแถบเดียวแบบ compact (ซ่อน card ใหญ่) */
      body.hvr-hud-compact .hud{
        left:10px !important; right:10px !important; top:10px !important;
        gap:10px !important;
        flex-wrap:nowrap !important;
        align-items:center !important;
      }
      body.hvr-hud-compact .hud .card{
        padding:10px 12px !important;
        min-width:auto !important;
        max-width:none !important;
        flex:0 0 auto !important;
        border-radius:18px !important;
      }
      /* ซ่อนการ์ดใหญ่ เหลือเฉพาะ “จำเป็น” */
      body.hvr-hud-compact .hud .card:nth-child(1){ display:none !important; } /* Quest big */
      body.hvr-hud-compact .hud .card:nth-child(2){ display:none !important; } /* Water big */
      body.hvr-hud-compact .hud .card:nth-child(3){ display:none !important; } /* Progress big */
      body.hvr-hud-compact .hud .card:nth-child(4){ display:none !important; } /* Miss big */

      /* เราสร้าง compact bar เอง */
      #hvr-compactbar{
        position:fixed;
        left:10px; right:10px; top:10px;
        z-index:88;
        pointer-events:auto;
        display:flex;
        gap:10px;
        align-items:center;
        justify-content:space-between;
      }
      #hvr-compactbar .bar{
        flex:1 1 auto;
        display:flex;
        gap:10px;
        align-items:center;
        padding:10px 12px;
        border-radius:999px;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.20);
        box-shadow:0 18px 46px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
      }
      #hvr-compactbar .chip{
        display:flex;
        gap:8px;
        align-items:center;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        font-weight:900;
        font-size:12px;
        white-space:nowrap;
      }
      #hvr-compactbar .chip b{ font-size:13px; }
      #hvr-compactbar .btn{
        width:42px; height:42px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.55);
        color:#e5e7eb;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:900;
        box-shadow:0 18px 46px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
      }
      #hvr-compactbar .btn:active{ transform: scale(.98); }

      /* Info drawer */
      #hvr-info{
        position:fixed;
        right:12px;
        bottom:86px;
        z-index:95;
        width:min(420px, calc(100vw - 24px));
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.22);
        border-radius:18px;
        box-shadow:0 22px 70px rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
        padding:12px 12px 10px;
        display:none;
        pointer-events:auto;
      }
      #hvr-info.on{ display:block; }
      #hvr-info .t{ font-weight:900; font-size:14px; margin-bottom:6px; }
      #hvr-info .m{ color:#94a3b8; font-size:12px; line-height:1.35; }
      #hvr-info .row{ display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
      #hvr-info .pill{
        padding:6px 10px; border-radius:999px;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        font-weight:900; font-size:12px;
      }

      /* Crosshair */
      #hvr-crosshair{
        display:flex;
        align-items:center;
        justify-content:center;
      }
      #hvr-crosshair .c{
        width:44px; height:44px;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.22);
        box-shadow:0 0 0 6px rgba(34,197,94,.08);
        position:relative;
      }
      #hvr-crosshair .c:before, #hvr-crosshair .c:after{
        content:'';
        position:absolute;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        background:rgba(255,255,255,.45);
      }
      #hvr-crosshair .c:before{ width:18px; height:2px; }
      #hvr-crosshair .c:after{ width:2px; height:18px; }

      /* End screen */
      #hvr-end .panel{
        width:min(520px, 96vw);
        border-radius:22px;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(148,163,184,.22);
        box-shadow:0 24px 80px rgba(0,0,0,.65);
        padding:16px 16px 14px;
      }
      #hvr-end .h{
        font-size:22px; font-weight:1000;
        margin:2px 0 10px;
      }
      #hvr-end .grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }
      #hvr-end .card{
        border-radius:18px;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        padding:10px 12px;
      }
      #hvr-end .k{ color:#94a3b8; font-size:12px; }
      #hvr-end .v{ font-weight:1000; font-size:18px; margin-top:4px; }
      #hvr-end .btnrow{ display:flex; gap:10px; margin-top:12px; }
      #hvr-end button{
        flex:1;
        border-radius:16px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.55);
        color:#e5e7eb;
        padding:10px 12px;
        font-weight:1000;
      }
      #hvr-end button:active{ transform:scale(.99); }
    `;
    doc.head.appendChild(s);
  }

  // Create compact bar (if missing)
  if (!doc.getElementById('hvr-compactbar')) {
    const bar = doc.createElement('div');
    bar.id = 'hvr-compactbar';
    bar.innerHTML = `
      <div class="bar" role="group" aria-label="Hydration Compact HUD">
        <div class="chip" title="Zone"><span>💧</span><b id="hvr-z">GREEN</b></div>
        <div class="chip" title="Score"><span>🏁</span><b id="hvr-s">0</b><span style="opacity:.7">pts</span></div>
        <div class="chip" title="Combo"><span>⚡</span><b id="hvr-c">0</b></div>
        <div class="chip" title="Miss"><span>✖</span><b id="hvr-m">0</b></div>
        <div class="chip" title="Time"><span>⏳</span><b id="hvr-t">0:00</b></div>
      </div>
      <button class="btn" id="hvr-pin" title="Pin HUD">📌</button>
      <button class="btn" id="hvr-info-btn" title="Info">i</button>
    `;
    doc.body.appendChild(bar);
  }

  if (!doc.getElementById('hvr-info')) {
    const d = doc.createElement('div');
    d.id = 'hvr-info';
    d.innerHTML = `
      <div class="t">Hydration — Info</div>
      <div class="m">
        แตะเป้าเพื่อยิง • แตะพื้นที่ว่างเพื่อยิงกลางจอ (crosshair) • ลากจอเพื่อเปลี่ยนมุมมอง • Storm = เป้ามาไวขึ้น
      </div>
      <div class="row">
        <span class="pill">Goal: <b id="hvr-g2">0</b>/2</span>
        <span class="pill">Mini: <b id="hvr-mi3">0</b>/3</span>
        <span class="pill">Grade: <b id="hvr-gr">C</b></span>
      </div>
    `;
    doc.body.appendChild(d);
  }

  // Crosshair content (if empty)
  const ch = $id('hvr-crosshair');
  if (ch && !ch.__hvrInited) {
    ch.__hvrInited = true;
    ch.innerHTML = `<div class="c"></div>`;
  }

  // default compact + show
  doc.body.classList.add('hvr-hud-compact', 'hvr-hud-shown');
}

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureHydrationUI();
  ensureWaterGauge();

  const doc = ROOT.document;
  const body = doc && doc.body;

  const playfield = $id('hvr-playfield') || null;
  const wrap      = $id('hvr-wrap') || doc?.body || null;
  if (!playfield) {
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  playfield.style.willChange = 'transform';
  playfield.style.transform = 'translate3d(0,0,0)';

  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') {
    FeverUI.ensureFeverBar();
    if (typeof FeverUI.setFever === 'function') FeverUI.setFever(0);
    if (typeof FeverUI.setFeverActive === 'function') FeverUI.setFeverActive(false);
    if (typeof FeverUI.setShield === 'function') FeverUI.setShield(0);
  } else {
    console.warn('[HydrationVR] FeverUI not ready. Check ui-fever.js loaded before module.');
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

  // expose stop for hub/debug
  ROOT.HHA_ACTIVE_INST = {
    stop(){ try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{} }
  };

  // --------------------- HUD auto-hide ---------------------
  let hudPinned = false;
  let lastHudActivity = now();
  let hudFlashUntil = 0;

  function showHud(ms = TUNE.hudFlashMs){
    lastHudActivity = now();
    hudFlashUntil = Math.max(hudFlashUntil, lastHudActivity + clamp(ms, 120, 4000));
    if (body) {
      body.classList.remove('hvr-hud-hidden');
      body.classList.add('hvr-hud-shown');
    }
  }
  function hideHud(){
    if (!body) return;
    body.classList.remove('hvr-hud-shown');
    body.classList.add('hvr-hud-hidden');
  }
  function tickHud(){
    if (hudPinned) { showHud(999999); return; }
    const t = now();
    if (t < hudFlashUntil) { showHud(120); return; }
    if (t - lastHudActivity > TUNE.hudIdleHideMs) hideHud();
  }

  // compact bar bindings
  const zEl = $id('hvr-z');
  const sEl = $id('hvr-s');
  const cEl = $id('hvr-c');
  const mEl = $id('hvr-m');
  const tEl = $id('hvr-t');
  const gEl = $id('hvr-g2');
  const miEl = $id('hvr-mi3');
  const grEl = $id('hvr-gr');

  const pinBtn = $id('hvr-pin');
  const infoBtn = $id('hvr-info-btn');
  const infoBox = $id('hvr-info');

  if (pinBtn && !pinBtn.__hvrBind){
    pinBtn.__hvrBind = true;
    pinBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hudPinned = !hudPinned;
      pinBtn.textContent = hudPinned ? '📌' : '📌';
      try{ Particles.toast && Particles.toast(hudPinned ? 'HUD pinned 📌' : 'HUD auto-hide', 'good'); }catch{}
      showHud(1500);
    }, { passive:false });
  }

  if (infoBtn && !infoBtn.__hvrBind){
    infoBtn.__hvrBind = true;
    infoBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if (!infoBox) return;
      infoBox.classList.toggle('on');
      showHud(2000);
    }, { passive:false });
  }

  function fmtTime(sec){
    sec = Math.max(0, sec|0);
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function updateCompactBar(){
    if (zEl) zEl.textContent = String(state.zone || 'GREEN');
    if (sEl) sEl.textContent = String(state.score|0);
    if (cEl) cEl.textContent = String(state.comboBest|0);
    if (mEl) mEl.textContent = String(state.miss|0);
    if (tEl) tEl.textContent = fmtTime(state.timeLeft);

    // quest summary in info drawer
    const goalsDone = (Q.goals || []).filter(g => g._done || g.done).length;
    const minisDone = (Q.minis || []).filter(m => m._done || m.done).length;
    if (gEl) gEl.textContent = String(goalsDone|0);
    if (miEl) miEl.textContent = String(minisDone|0);

    // grade
    if (grEl) grEl.textContent = String($id('hha-grade-badge')?.textContent || 'C');
  }

  // --------------------- Core HUD update ---------------------
  function updateWaterHud(){
    const out = setWaterGauge(state.waterPct);
    state.zone = out.zone;
    const ztxt = $id('hha-water-zone-text');
    if (ztxt) ztxt.textContent = state.zone;

    updateCompactBar();
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

    updateCompactBar();
  }

  function updateQuestHud(){
    const goalsView = Q.getProgress('goals');
    const minisView = Q.getProgress('mini');

    const allGoals = Q.goals || [];
    const allMinis = Q.minis || [];
    const goalsDone = allGoals.filter(g => g._done || g.done).length;
    const minisDone = allMinis.filter(m => m._done || m.done).length;

    // NOTE: HTML ของคุณใช้ #hha-goal-count/#hha-mini-count (ไม่ใช่ done/total)
    const gc = $id('hha-goal-count'); if (gc) gc.textContent = String(goalsDone);
    const mc = $id('hha-mini-count'); if (mc) mc.textContent = String(minisDone);

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

    showHud(1300);
  }

  function feverEnd(){
    state.feverActive = false;
    state.feverLeft = 0;
    state.fever = clamp(state.fever * 0.35, 0, 100);
    feverRender();
    dispatch('hha:fever', { state:'end', value: state.fever, active:false, shield: state.shield });
    dispatch('hha:coach', { text:'เยี่ยม! FEVER จบแล้ว กลับไปรักษา GREEN ต่อ 💧', mood:'neutral' });

    showHud(1100);
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

  // --------------------- Screen blink helper ---------------------
  const blink = $id('hvr-screen-blink');
  function flash(type){
    if (!blink) return;
    blink.className = '';
    blink.id = 'hvr-screen-blink';
    blink.classList.add('on');
    if (type) blink.classList.add(type);
    ROOT.setTimeout(()=>{ try{ blink.classList.remove('on'); }catch{} }, 120);
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
        try{ Particles.toast && Particles.toast('BLOCK 🛡️', 'good'); }catch{}
        flash('good');
        showHud(900);
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
      flash(perfect ? 'perfect' : 'good');
    } else {
      state.waterPct = clamp(state.waterPct + TUNE.junkWaterPush, 0, 100);
      feverLose(TUNE.feverLoseJunk);
      Q.onJunk();
      flash('bad');
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
    showHud(900);
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
      showHud(700);
    }
  }

  // --------------------- LOOK controls ---------------------
  let hasOrient = false;
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
    showHud(500);
  }
  function onPointerMove(ev){
    if (!dragOn) return;
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    state.lookTX = clamp(state.lookTX + dx * 1.25, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy * 1.05, -TUNE.lookMaxY, TUNE.lookMaxY);
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

  function onDeviceOrientation(e){
    const g = Number(e.gamma);
    const b = Number(e.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;
    hasOrient = true;

    const DEAD_G = 1.2;
    const DEAD_B = 1.6;

    let gg = Math.abs(g) < DEAD_G ? 0 : g;
    let bb = Math.abs(b) < DEAD_B ? 0 : b;

    const BIAS_B = 18;

    const tx = gg * TUNE.lookPxPerDegX;
    const ty = (bb - BIAS_B) * TUNE.lookPxPerDegY;

    state.lookTX = clamp(tx, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(ty, -TUNE.lookMaxY, TUNE.lookMaxY);
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

  // --------------------- Audio beep ---------------------
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

  // --------------------- End screen (no black) ---------------------
  const endEl = $id('hvr-end');
  function renderEnd(payload){
    if (!endEl) return;
    const grade = String($id('hha-grade-badge')?.textContent || 'C');
    const zone  = String(payload.zone || state.zone || 'GREEN');
    const water = Number(payload.water ?? state.waterPct) || 0;

    endEl.innerHTML = `
      <div class="panel">
        <div class="h">🏁 จบเกม Hydration</div>
        <div class="grid">
          <div class="card"><div class="k">Score</div><div class="v">${payload.score|0} pts</div></div>
          <div class="card"><div class="k">Grade</div><div class="v">${grade}</div></div>
          <div class="card"><div class="k">Miss</div><div class="v">${payload.miss|0}</div></div>
          <div class="card"><div class="k">Combo Max</div><div class="v">${payload.comboBest|0}</div></div>
          <div class="card"><div class="k">Zone</div><div class="v">${zone}</div></div>
          <div class="card"><div class="k">Water</div><div class="v">${Math.round(water)}%</div></div>
        </div>
        <div class="btnrow">
          <button id="hvr-retry">🔁 เล่นอีกครั้ง</button>
          <button id="hvr-exit">🏠 กลับ Hub</button>
        </div>
      </div>
    `;
    endEl.classList.add('on');

    const retry = $id('hvr-retry');
    const exit  = $id('hvr-exit');
    if (retry) retry.onclick = () => { try{ location.reload(); }catch{} };
    if (exit)  exit.onclick  = () => {
      try{
        // ปรับ path ตามของจริงถ้าต้องการ
        location.href = '../hub.html';
      }catch{}
    };
  }

  // --------------------- Clock tick ---------------------
  let timer = null;
  let rafId = null;
  let hudTimer = null;

  function secondTick(){
    if (state.stopped) return;

    state.timeLeft = Math.max(0, state.timeLeft - 1);
    dispatch('hha:time', { sec: state.timeLeft });

    // drift water
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

    // storm
    if (state.stormLeft > 0) state.stormLeft -= 1;
    if (state.timeLeft > 0 && (state.timeLeft % TUNE.stormEverySec) === 0) {
      state.stormLeft = TUNE.stormDurationSec;
      dispatch('hha:coach', { text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy' });
      try{ Particles.toast && Particles.toast('STORM WAVE!', 'warn'); }catch{}
      showHud(1600);
    }

    // urgency
    if (state.timeLeft > 0 && state.timeLeft <= TUNE.urgencyAtSec) {
      beep(TUNE.urgencyBeepHz, 0.04);
      if (state.timeLeft === TUNE.urgencyAtSec) {
        dispatch('hha:coach', { text:'⏳ ใกล้หมดเวลา! รักษา GREEN + ยิงน้ำดีให้ไว!', mood:'sad' });
      }
    }

    updateQuestHud();
    updateCompactBar();

    if (state.timeLeft <= 0) stop();
  }

  function rafLoop(){
    if (state.stopped) return;
    applyLookTransform();
    rafId = ROOT.requestAnimationFrame(rafLoop);
  }

  // --------------------- Tap-anywhere shoot (blank area) ---------------------
  let spawner = null;

  let tapDownTs = 0;
  let tapDownX = 0;
  let tapDownY = 0;
  let tapMoved = false;

  function onBlankPointerDown(ev){
    tapDownTs = now();
    tapDownX = ev.clientX || 0;
    tapDownY = ev.clientY || 0;
    tapMoved = false;
  }
  function onBlankPointerMove(ev){
    const x = ev.clientX || 0, y = ev.clientY || 0;
    const dx = x - tapDownX, dy = y - tapDownY;
    if (Math.hypot(dx,dy) > TUNE.tapMoveDeadPx) tapMoved = true;
  }
  function onBlankPointerUp(ev){
    const dt = now() - tapDownTs;

    // ถ้าลากมุมมอง (tapMoved=true) ไม่ยิง
    if (tapMoved) return;

    // ถ้าแตะนานเกิน = ไม่นับเป็น tap shoot
    if (dt > TUNE.tapMaxMs) return;

    // ถ้าแตะไปโดนปุ่ม/แถบ/compactbar ไม่ยิง
    const t = ev.target;
    if (t && (t.closest && (t.closest('#hvr-compactbar') || t.closest('#hvr-info') || t.closest('.hud')))) return;

    // ยิงกลางจอ
    try{
      if (spawner && typeof spawner.shootCrosshair === 'function') {
        const ok = spawner.shootCrosshair();
        if (ok) showHud(500);
      }
    }catch{}
  }

  // --------------------- Start spawner ---------------------
  // ✅ boundsHost = ชั้น viewport ที่ "นิ่ง" (ไม่โดน translate)
  const boundsEl = wrap || document.body;

  spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    spawnHost: '#hvr-playfield',
    boundsHost: boundsEl,

    // ✅ Storm เร่ง spawn “จริง”
    spawnIntervalMul: () => (state.stormLeft > 0 ? TUNE.stormIntervalMul : 1),

    // ✅ กันทับ HUD / compactbar
    excludeSelectors: [
      '.hud',
      '#hvr-compactbar',
      '#hvr-info',
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

    // ✅ กระจายจริง (ไม่กองกลาง) แต่ยังเจอง่าย
    spawnAroundCrosshair: true,
    spreadMix: (difficulty === 'hard') ? 0.55 : 0.45, // ยิ่งสูงยิ่งกระจายทั่วสนาม
    spawnRadiusX: (difficulty === 'hard') ? 0.52 : 0.46,
    spawnRadiusY: (difficulty === 'hard') ? 0.48 : 0.42,
    minSeparation: 0.90,
    maxSpawnTries: 22,

    judge: (ch, ctx) => {
      // powerups
      if (ctx.isPower && ch === '🛡️'){
        state.shield = clamp(state.shield + 1, 0, TUNE.shieldMax);
        feverRender();
        dispatch('hha:judge', { label:'SHIELD+' });
        updateScoreHud('SHIELD+');
        try{ Particles.toast && Particles.toast('+1 SHIELD 🛡️', 'good'); }catch{}
        showHud(900);
      }
      if (ctx.isPower && ch === '⏱️'){
        state.timeLeft = clamp(state.timeLeft + 3, 0, 180);
        dispatch('hha:time', { sec: state.timeLeft });
        dispatch('hha:judge', { label:'TIME+' });
        try{ Particles.toast && Particles.toast('+3s ⏱️', 'good'); }catch{}
        showHud(900);
      }

      // storm bonus
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

  // init HUD
  updateWaterHud();
  if (Q && Q.stats){
    Q.stats.zone = zoneFrom(state.waterPct);
    Q.stats.greenTick = 0;
  }
  updateQuestHud();
  updateScoreHud();
  feverRender();
  showHud(1500);

  // bind look drag
  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  // bind blank-tap shoot on wrapper (ไม่ชน target เพราะ target จะ stopPropagation เอง)
  (wrap || playfield).addEventListener('pointerdown', onBlankPointerDown, { passive:true });
  (wrap || playfield).addEventListener('pointermove', onBlankPointerMove, { passive:true });
  (wrap || playfield).addEventListener('pointerup', onBlankPointerUp, { passive:true });

  // gyro auto if allowed
  if (await tryEnableGyro()) {
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
    hasOrient = true;
  }

  // ask gyro permission once on first pointerdown
  const onceAsk = async () => {
    ROOT.removeEventListener('pointerdown', onceAsk);
    await requestGyroPermission();
  };
  ROOT.addEventListener('pointerdown', onceAsk, { passive:true });

  // timers
  timer = ROOT.setInterval(secondTick, 1000);
  rafId = ROOT.requestAnimationFrame(rafLoop);
  hudTimer = ROOT.setInterval(tickHud, 160);

  // stop hooks
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

    try{ if (hudTimer) ROOT.clearInterval(hudTimer); }catch{}
    hudTimer = null;

    try{ spawner && spawner.stop && spawner.stop(); }catch{}
    try{ ROOT.removeEventListener('hha:stop', onStop); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}

    try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation, true); }catch{}
    try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch{}
    try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch{}
    try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch{}

    try{
      (wrap || playfield).removeEventListener('pointerdown', onBlankPointerDown);
      (wrap || playfield).removeEventListener('pointermove', onBlankPointerMove);
      (wrap || playfield).removeEventListener('pointerup', onBlankPointerUp);
    }catch{}

    const payload = {
      score: state.score|0,
      miss: state.miss|0,
      comboBest: state.comboBest|0,
      water: Math.round(state.waterPct),
      zone: state.zone,
      greenTick: (Q && Q.stats) ? (Q.stats.greenTick|0) : (state.greenTick|0)
    };

    dispatch('hha:end', payload);

    // ✅ กันจอดำ: render end overlay เอง
    renderEnd(payload);

    dispatch('hha:coach', { text:'🏁 จบเกม! ดูผลคะแนนและเควสได้เลย', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}

    showHud(999999);
  }

  return { stop };
}

export default { boot };