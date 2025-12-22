// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY MODE) — SAFE A2+++
// ✅ spawn targets via mode-factory (DOM)
// ✅ water gauge (LOW/GREEN/HIGH) + display map (BLUE/GREEN/RED)
// ✅ fever gauge + shield (global FeverUI from ./vr/ui-fever.js)
// ✅ quest goal + mini quest (hydration.quest.js)
// ✅ VR-feel look: gyro + drag -> #hvr-view translate (world layer)
// ✅ FIX spawn/drag: bounds = #hvr-playfield (stable), spawn into #hvr-view (moving) + compensate offset
// ✅ Bubble skin: near-invisible soap bubble + iridescent rim + reactive shimmer (tilt)
// ✅ FX: Particles.burstAt + Particles.scorePop + PERFECT canvas burst
// ✅ HUD events: hha:score / hha:judge / quest:update / hha:coach / hha:time

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

// --------------------- Globals / helpers ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, min, max){
  v = Number(v) || 0;
  return v < min ? min : (v > max ? max : v);
}
function $id(id){ return DOC ? DOC.getElementById(id) : null; }
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
  { scorePop(){}, burstAt(){}, celebrate(){}, toast(){} };

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

function zoneLabel(raw){ // raw: LOW/GREEN/HIGH
  if (raw === 'LOW') return 'BLUE';
  if (raw === 'HIGH') return 'RED';
  return 'GREEN';
}

// --------------------- Tuning (เด็ก ป.5 แต่ยังท้าทาย) ---------------------
const TUNE = {
  // water balance move
  goodWaterPush:  +6,
  junkWaterPush:  -10,
  waterDriftPerSec: -0.9,

  // scoring
  scoreGood:   18,
  scorePower:  28,
  scoreJunk:  -25,
  scorePerfectBonus: 10,

  // fever
  feverGainGood:  10,
  feverGainPower: 16,
  feverLoseJunk:  20,
  feverAutoDecay: 1.1,

  feverTriggerAt: 100,
  feverDurationSec: 6,

  // shield
  shieldOnFeverStart: 2,
  shieldMax: 6,

  // miss policy
  missOnGoodExpire: true,

  // ===== LOOK / AIM (เหมือน VR จริง) =====
  lookMaxX: 420,
  lookMaxY: 320,
  lookPxPerDegX: 9.2,
  lookPxPerDegY: 7.6,
  lookSmooth: 0.10,

  // ===== excitement =====
  urgencyAtSec: 10,
  urgencyBeepHz: 920,

  stormEverySec: 18,
  stormDurationSec: 5,
  stormIntervalMul: 0.72,

  // ===== auto-center comfort =====
  // ถ้าเป้านอก “comfort radius” เราจะช่วยดันมุมมองนิด ๆ (ไม่สู้มือ)
  assistCooldownMs: 700,
  assistStrength: 0.10,
  comfortRadius: 0.34, // * min(w,h)
};

// --------------------- Styles (bubble + shimmer + speedlines) ---------------------
function ensureHydrationStyle(){
  if (!DOC || DOC.getElementById('hvr-hydration-safe-style')) return;
  const s = DOC.createElement('style');
  s.id = 'hvr-hydration-safe-style';
  s.textContent = `
    /* World layer (moves) */
    #hvr-view{
      position:absolute;
      inset:0;
      transform: translate3d(0,0,0);
      will-change: transform;
      touch-action:none;
      user-select:none;
      -webkit-user-select:none;
    }

    /* Bubble target skin */
    .hvr-target.hvr-bubble{
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 999px;
    }
    .hvr-target.hvr-bubble .hvr-wiggle{
      border-radius: 999px;
      pointer-events:none; /* click goes to parent el */
    }
    /* outer glass */
    .hvr-bubble-shell{
      position:absolute;
      inset:-2px;
      border-radius:999px;
      background:
        radial-gradient(120% 120% at 30% 25%, rgba(255,255,255,.22), rgba(255,255,255,0) 45%),
        radial-gradient(120% 120% at 70% 80%, rgba(96,165,250,.12), rgba(255,255,255,0) 55%),
        radial-gradient(120% 120% at 50% 50%, rgba(255,255,255,.06), rgba(255,255,255,0) 62%);
      filter: blur(.2px);
      opacity: .22; /* ใสเกือบไม่เห็น */
      mix-blend-mode: screen;
      pointer-events:none;
    }

    /* iridescent rim (thin-film) */
    .hvr-bubble-rim{
      position:absolute;
      inset:-3px;
      border-radius:999px;
      background:
        conic-gradient(
          from calc(180deg + (var(--tilt-x,0) * 18deg)),
          rgba(255, 80,140,.00),
          rgba(255, 80,140,.40),
          rgba( 80,210,255,.40),
          rgba(120,255,170,.38),
          rgba(255,240,120,.34),
          rgba(180,120,255,.36),
          rgba(255, 80,140,.40),
          rgba(255, 80,140,.00)
        );
      -webkit-mask:
        radial-gradient(circle at 50% 50%, transparent 62%, #000 66%, #000 100%);
      mask:
        radial-gradient(circle at 50% 50%, transparent 62%, #000 66%, #000 100%);
      opacity:.70; /* สีรุ้งชัดขึ้น */
      filter: blur(.15px) saturate(1.25) contrast(1.06);
      mix-blend-mode: screen;
      pointer-events:none;
    }

    /* reactive shimmer film */
    .hvr-bubble-film{
      position:absolute;
      inset:6%;
      border-radius:999px;
      background:
        radial-gradient(120% 120% at calc(50% + (var(--tilt-x,0) * 18%)) calc(40% + (var(--tilt-y,0) * 18%)),
          rgba(255,255,255,.10), rgba(255,255,255,0) 55%),
        radial-gradient(120% 120% at calc(40% - (var(--tilt-x,0) * 14%)) calc(55% - (var(--tilt-y,0) * 14%)),
          rgba(80,210,255,.09), rgba(255,255,255,0) 58%);
      opacity:.34;
      filter: blur(.25px);
      mix-blend-mode: screen;
      pointer-events:none;
    }

    /* Make emoji float inside bubble */
    .hvr-target.hvr-bubble .hvr-emoji{
      transform: translateZ(0);
      filter: drop-shadow(0 3px 6px rgba(2,6,23,.9));
      opacity: .92;
    }

    /* storm overlay speedlines */
    .hvr-speedlines{
      position:fixed;
      inset:-20%;
      z-index:60;
      pointer-events:none;
      opacity:0;
      mix-blend-mode: screen;
      background:
        repeating-linear-gradient(110deg,
          rgba(255,255,255,.00) 0 18px,
          rgba(255,80,140,.11) 18px 20px,
          rgba(80,210,255,.09) 20px 22px,
          rgba(255,255,255,.00) 22px 44px
        );
      filter: blur(.65px) saturate(1.10) contrast(1.05);
      animation: hvrLines 0.32s linear infinite;
    }
    @keyframes hvrLines{
      0%{ transform: translate3d(-10px, -10px, 0); }
      100%{ transform: translate3d(26px, 22px, 0); }
    }
    .hvr-speedlines.on{ opacity:.30; }

    /* stronger chromatic split (wrap filter) — toggle class on #hvr-wrap */
    #hvr-wrap.hvr-chroma-strong{
      filter:
        drop-shadow(3.8px 0 rgba(255, 40, 90, 0.62))
        drop-shadow(-2.4px 0 rgba(0, 195, 255, 0.28));
    }

    /* wobble */
    #hvr-wrap.hvr-wobble{
      animation: hvrWobble 1.00s ease-in-out infinite;
    }
    @keyframes hvrWobble{
      0%{ transform: translate3d(0,0,0) rotate(0deg); }
      25%{ transform: translate3d(0.7px,-0.5px,0) rotate(0.04deg); }
      50%{ transform: translate3d(-0.8px,0.6px,0) rotate(-0.04deg); }
      75%{ transform: translate3d(0.5px,0.7px,0) rotate(0.03deg); }
      100%{ transform: translate3d(0,0,0) rotate(0deg); }
    }
  `;
  DOC.head.appendChild(s);
}

// --------------------- Canvas post burst (small) ---------------------
function ensurePostCanvas(){
  const c = $id('hvr-postfx');
  if (!c) return null;
  const ctx = c.getContext('2d');

  function resize(){
    const dpr = Math.max(1, Math.min(2, ROOT.devicePixelRatio || 1));
    c.width  = Math.floor((ROOT.innerWidth||1) * dpr);
    c.height = Math.floor((ROOT.innerHeight||1) * dpr);
    c.style.width = '100%';
    c.style.height = '100%';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  ROOT.addEventListener('resize', resize, { passive:true });
  return { c, ctx, resize };
}

function drawPerfectBurst(ctx, x, y, t, strength=1){
  const n = Math.floor(14 + 18*strength);
  const r0 = 6 + 10*strength;
  const r1 = 38 + 72*strength;

  ctx.save();
  ctx.translate(x,y);
  ctx.globalCompositeOperation = 'screen';

  for (let i=0;i<n;i++){
    const a = (i/n) * Math.PI*2 + (t*0.002);
    const rr = r0 + (r1-r0) * (0.35 + 0.65*Math.random());
    const w = 1 + 1.7*strength;

    ctx.strokeStyle = `rgba(255, 70, 140, ${0.10 + 0.10*strength})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r0, Math.sin(a)*r0);
    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
    ctx.stroke();

    const a2 = a + 0.20;
    ctx.strokeStyle = `rgba(80, 210, 255, ${0.08 + 0.10*strength})`;
    ctx.lineWidth = w*0.85;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a2)*r0, Math.sin(a2)*r0);
    ctx.lineTo(Math.cos(a2)*rr*0.92, Math.sin(a2)*rr*0.92);
    ctx.stroke();
  }

  // sparkle
  for (let k=0;k<14;k++){
    const a = Math.random()*Math.PI*2;
    const rr = 10 + Math.random()*(62*strength);
    ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.18*Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.2 + 2.2*Math.random(), 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

// --------------------- Main boot ---------------------
export async function boot(opts = {}) {
  if (!DOC) return { stop(){} };

  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  ensureHydrationStyle();
  ensureWaterGauge();

  // --- host / playfield ---
  const wrap = $id('hvr-wrap');
  const playfield = $id('hvr-playfield');
  if (!playfield) {
    console.error('[HydrationVR] #hvr-playfield not found');
    return { stop(){} };
  }

  // create world layer (moving) if missing
  let view = $id('hvr-view');
  if (!view) {
    view = DOC.createElement('div');
    view.id = 'hvr-view';
    playfield.appendChild(view);
  }

  // speedlines overlay
  let speedLines = DOC.querySelector('.hvr-speedlines');
  if (!speedLines){
    speedLines = DOC.createElement('div');
    speedLines.className = 'hvr-speedlines';
    DOC.body.appendChild(speedLines);
  }

  // post canvas
  const post = ensurePostCanvas();
  const sparks = []; // {x,y,t0,str}

  // --- FeverUI init ---
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
    zoneRaw: 'GREEN',   // LOW/GREEN/HIGH
    zoneLabel: 'GREEN', // BLUE/GREEN/RED

    greenTick: 0,

    fever: 0,
    feverActive: false,
    feverLeft: 0,
    shield: 0,

    // look (world translate)
    lookTX: 0,
    lookTY: 0,
    lookVX: 0,
    lookVY: 0,
    viewX: 0,
    viewY: 0,

    lastUserAt: 0,

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
    state.zoneRaw = out.zone;         // LOW/GREEN/HIGH
    state.zoneLabel = zoneLabel(out.zone);

    const ztxt = $id('hha-water-zone-text');
    const st   = $id('hha-water-status');
    if (ztxt) ztxt.textContent = state.zoneLabel;
    if (st) st.textContent = `${state.zoneLabel} ${Math.round(state.waterPct)}%`;

    dispatch('hha:water', { pct: Math.round(state.waterPct), zoneRaw: state.zoneRaw, zone: state.zoneLabel });
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
      zone: state.zoneLabel,
      zoneRaw: state.zoneRaw,
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

    // ✅ ให้ตรงกับ hydration-vr.html ที่ใช้ hha-goal-count / hha-mini-count
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

  // --------------------- Fever logic ---------------------
  function feverRender(){
    const F = getFeverUI();
    if (!F) return;
    if (typeof F.setFever === 'function') F.setFever(state.fever);
    if (typeof F.setFeverActive === 'function') F.setFeverActive(state.feverActive);
    if (typeof F.setShield === 'function') F.setShield(state.shield);
  }

  function stormOnUI(on){
    if (!wrap) return;
    try{
      if (on){
        wrap.classList.add('hvr-chroma-strong');
        wrap.classList.add('hvr-wobble');
        speedLines && speedLines.classList.add('on');
      }else{
        wrap.classList.remove('hvr-chroma-strong');
        wrap.classList.remove('hvr-wobble');
        speedLines && speedLines.classList.remove('on');
      }
    }catch{}
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

  // --------------------- “Perfect” rule ---------------------
  function isPerfectHit(isGoodOrPower, hitPerfectFlag){
    // Perfect = อยู่ GREEN + (คอมโบ>=5 หรือ FEVER) + good/power
    // ถ้ามี hitPerfectFlag (perfect ring) ให้เป็นโบนัสเพิ่มความมันส์
    if (!isGoodOrPower) return false;
    if (state.zoneRaw !== 'GREEN') return false;
    return ((state.combo >= 5) || state.feverActive) || !!hitPerfectFlag;
  }

  // --------------------- Post canvas loop ---------------------
  let fxRaf = null;
  function fxLoop(){
    if (!post || !post.ctx) return;
    const ctx = post.ctx;
    const t = now();

    ctx.clearRect(0,0,ROOT.innerWidth||1,ROOT.innerHeight||1);

    const keep = [];
    for (const sp of sparks){
      const dt = t - sp.t0;
      if (dt > 520) continue;
      keep.push(sp);
      const k = 1 - (dt/520);
      ctx.globalAlpha = 0.55 * k;
      drawPerfectBurst(ctx, sp.x, sp.y, t, sp.str * (0.75 + 0.55*k));
    }
    sparks.length = 0;
    keep.forEach(v=>sparks.push(v));
    ctx.globalAlpha = 1;

    fxRaf = ROOT.requestAnimationFrame(fxLoop);
  }

  // --------------------- Judge (hit logic) ---------------------
  function judge(ch, ctx){
    const isGood = !!ctx.isGood;
    const isPower = !!ctx.isPower;
    const hitPerfect = !!ctx.hitPerfect;

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

    // combo
    if (isGood || isPower){
      state.combo += 1;
      if (state.combo > state.comboBest) state.comboBest = state.combo;
    } else {
      state.combo = 0;
      state.miss += 1;
    }

    // Perfect bonus
    const perfect = isPerfectHit((isGood || isPower), hitPerfect);
    if (perfect) {
      scoreDelta += TUNE.scorePerfectBonus * mult;
      label = 'PERFECT';
      // add canvas burst
      const x = Number(ctx.clientX || ctx.cx || 0) || (ROOT.innerWidth/2);
      const y = Number(ctx.clientY || ctx.cy || 0) || (ROOT.innerHeight/2);
      sparks.push({ x, y, t0: now(), str: 1.18 });
    }

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

    // FX (คืนให้ครบ)
    try{
      Particles.burstAt && Particles.burstAt(Number(ctx.clientX||0), Number(ctx.clientY||0), label);
      Particles.scorePop && Particles.scorePop(Number(ctx.clientX||0), Number(ctx.clientY||0), scoreDelta, label);
    }catch{}

    dispatch('hha:judge', { label });

    updateQuestHud();
    return { scoreDelta, label, good: (isGood || isPower) };
  }

  // --------------------- Expire (ของหลุด) ---------------------
  function onExpire(info){
    if (state.stopped) return;

    if (info && info.isGood && !info.isPower && TUNE.missOnGoodExpire){
      state.miss += 1;
      state.combo = 0;

      state.waterPct = clamp(state.waterPct - 3, 0, 100);

      dispatch('hha:judge', { label:'MISS' });
      updateWaterHud();
      updateScoreHud('MISS');

      try{
        Particles.scorePop && Particles.scorePop(ROOT.innerWidth*0.50, ROOT.innerHeight*0.52, 'MISS', 'bad');
      }catch{}
    }
  }

  // --------------------- LOOK controls (gyro + drag) ---------------------
  let dragOn = false;
  let lastX = 0, lastY = 0;
  let hasOrient = false;

  function markUser(){
    state.lastUserAt = now();
  }

  function applyLookTransform(){
    // smooth
    state.lookVX += (state.lookTX - state.lookVX) * TUNE.lookSmooth;
    state.lookVY += (state.lookTY - state.lookVY) * TUNE.lookSmooth;

    // world shift
    const x = clamp(-state.lookVX, -TUNE.lookMaxX, TUNE.lookMaxX);
    const y = clamp(-state.lookVY, -TUNE.lookMaxY, TUNE.lookMaxY);

    state.viewX = x;
    state.viewY = y;

    // apply to world layer
    view.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    // update shimmer vars
    view.style.setProperty('--tilt-x', (clamp(state.lookVX / TUNE.lookMaxX, -1, 1)).toFixed(3));
    view.style.setProperty('--tilt-y', (clamp(state.lookVY / TUNE.lookMaxY, -1, 1)).toFixed(3));
  }

  function onPointerDown(ev){
    dragOn = true;
    markUser();
    lastX = ev.clientX || 0;
    lastY = ev.clientY || 0;
  }
  function onPointerMove(ev){
    if (!dragOn) return;
    markUser();
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    state.lookTX = clamp(state.lookTX + dx * 1.20, -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + dy * 1.02, -TUNE.lookMaxY, TUNE.lookMaxY);
  }
  function onPointerUp(){
    if (!dragOn) return;
    dragOn = false;
    markUser();
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

    // gyro ไม่ควรกระชากเกินไป ถ้าผู้เล่นเพิ่งลาก
    const recent = (now() - state.lastUserAt) < 220;
    if (!recent){
      state.lookTX = clamp(tx, -TUNE.lookMaxX, TUNE.lookMaxX);
      state.lookTY = clamp(ty, -TUNE.lookMaxY, TUNE.lookMaxY);
    }
  }

  async function requestGyroPermission(){
    try{
      const D = ROOT.DeviceOrientationEvent;
      if (!D) return;
      if (typeof D.requestPermission !== 'function'){
        ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
        dispatch('hha:coach', { text:'✅ Gyro พร้อม! หมุนมือถือ = หันมุมมองเหมือน VR 🕶️', mood:'happy' });
        return;
      }
      const res = await D.requestPermission();
      if (res === 'granted') {
        ROOT.addEventListener('deviceorientation', onDeviceOrientation, true);
        dispatch('hha:coach', { text:'✅ เปิด Gyro แล้ว! หมุนมือถือได้เลย 🕶️', mood:'happy' });
      } else {
        dispatch('hha:coach', { text:'ℹ️ Gyro ไม่ได้รับอนุญาต ใช้ลากจอแทนได้เลย 👍', mood:'neutral' });
      }
    }catch{
      dispatch('hha:coach', { text:'ℹ️ ใช้ลากจอแทนได้เลย (Gyro ไม่พร้อม)', mood:'neutral' });
    }
  }

  // --------------------- Assist (หาง่ายขึ้นแบบไม่โกง) ---------------------
  let lastAssistAt = 0;

  function maybeAssistToNearestTarget(){
    const t = now();
    if (dragOn) return;
    if (t - state.lastUserAt < TUNE.assistCooldownMs) return;
    if (t - lastAssistAt < 140) return; // throttle

    lastAssistAt = t;

    const w = ROOT.innerWidth || 1;
    const h = ROOT.innerHeight || 1;
    const cx = w * 0.50;
    const cy = h * 0.52;

    const els = view.querySelectorAll('.hvr-target');
    if (!els || !els.length) return;

    let best = null;
    let bestD = 1e9;

    for (const el of els){
      let r = null;
      try{ r = el.getBoundingClientRect(); }catch{}
      if (!r) continue;
      const ex = r.left + r.width/2;
      const ey = r.top + r.height/2;
      const dx = ex - cx;
      const dy = ey - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD){
        bestD = d;
        best = { dx, dy, d };
      }
    }
    if (!best) return;

    const comfort = Math.min(w,h) * TUNE.comfortRadius;
    if (best.d <= comfort) return;

    // nudge view slightly toward the target (world moves opposite)
    const nx = best.dx / Math.max(1, best.d);
    const ny = best.dy / Math.max(1, best.d);

    state.lookTX = clamp(state.lookTX + nx * (comfort * TUNE.assistStrength), -TUNE.lookMaxX, TUNE.lookMaxX);
    state.lookTY = clamp(state.lookTY + ny * (comfort * TUNE.assistStrength), -TUNE.lookMaxY, TUNE.lookMaxY);
  }

  // --------------------- Clock tick ---------------------
  let timer = null;
  let rafId = null;

  // tiny beep
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

    // ✅ GREEN counting (จริง)
    const z = zoneFrom(state.waterPct);
    state.zoneRaw = z;
    state.zoneLabel = zoneLabel(z);

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

    // fever tick / decay
    if (state.feverActive){
      state.feverLeft -= 1;
      if (state.feverLeft <= 0) feverEnd();
      else { state.fever = 100; feverRender(); }
    } else {
      state.fever = clamp(state.fever - TUNE.feverAutoDecay, 0, 100);
      feverRender();
    }

    // storm wave
    if (state.stormLeft > 0) state.stormLeft -= 1;

    if (state.timeLeft > 0 && (state.timeLeft % TUNE.stormEverySec) === 0) {
      state.stormLeft = TUNE.stormDurationSec;
      stormOnUI(true);
      dispatch('hha:coach', { text:'🌪️ STORM WAVE! เป้าจะมาเร็วขึ้น! ตั้งสติ รักษา GREEN!', mood:'happy' });
      try{ Particles.toast && Particles.toast('STORM WAVE!', 'warn'); }catch{}
    }
    if (state.stormLeft <= 0) {
      stormOnUI(false);
    }

    // urgency
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
    maybeAssistToNearestTarget();
    rafId = ROOT.requestAnimationFrame(rafLoop);
  }

  // --------------------- Spawn / decorate (bubble) ---------------------
  function decorateBubble(el, parts, data){
    // bubble class
    try{ el.classList.add('hvr-bubble'); }catch{}
    try{ parts.icon && (parts.icon.className = (parts.icon.className||'') + ' hvr-emoji'); }catch{}

    // soften perfect ring (we keep it but subtle)
    try{
      if (parts.ring){
        parts.ring.style.border = '2px solid rgba(255,255,255,0.18)';
        parts.ring.style.boxShadow = '0 0 18px rgba(255,255,255,0.10)';
        parts.ring.style.opacity = '0.75';
      }
    }catch{}

    // add bubble layers into inner (so click not blocked)
    try{
      const shell = DOC.createElement('div');
      shell.className = 'hvr-bubble-shell';

      const rim = DOC.createElement('div');
      rim.className = 'hvr-bubble-rim';

      const film = DOC.createElement('div');
      film.className = 'hvr-bubble-film';

      // put behind emoji (inner is the “face”)
      // inner already has background; make it transparent glassy
      if (parts.inner){
        parts.inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.06), rgba(255,255,255,0) 62%)';
        parts.inner.style.boxShadow = 'inset 0 2px 10px rgba(2,6,23,.55)';
      }

      // attach to wiggle (visual layer)
      parts.wiggle && parts.wiggle.appendChild(shell);
      parts.wiggle && parts.wiggle.appendChild(rim);
      parts.wiggle && parts.wiggle.appendChild(film);

      // junk should look “heavier” but still bubble-ish
      if (data && data.itemType === 'bad'){
        rim.style.opacity = '0.55';
        film.style.opacity = '0.26';
        shell.style.opacity = '0.18';
      }
      if (data && data.itemType === 'power'){
        rim.style.opacity = '0.85';
        film.style.opacity = '0.38';
      }
    }catch{}

    // ✅ critical: spawn compensation (keep targets within screen when view is panned)
    // mode-factory sets left/top based on boundsHost; but we spawn into moving #hvr-view.
    // So we subtract current view translate to place it in-screen now.
    try{
      const left = parseFloat(el.style.left || '0') || 0;
      const top  = parseFloat(el.style.top  || '0') || 0;
      el.style.left = (left - state.viewX) + 'px';
      el.style.top  = (top  - state.viewY) + 'px';
    }catch{}
  }

  // spawn mul for storm
  function spawnMul(){
    return (state.stormLeft > 0) ? TUNE.stormIntervalMul : 1.0;
  }

  // boot mode-factory
  let spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ bounds stable, spawn into moving world layer
    boundsHost: '#hvr-playfield',
    spawnHost:  '#hvr-view',

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊'],
      bad:  ['🥤','🧋','🍟','🍔'],
      trick: [] // ไม่ใช้หลอกในชุดนี้ (กันสับสน)
    },

    goodRate: (difficulty === 'hard') ? 0.55 : (difficulty === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (difficulty === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    spawnIntervalMul: spawnMul,

    // ✅ กันทับ HUD
    excludeSelectors: ['.hud', '#hvr-end', '#hvr-screen-blink'],

    decorateTarget: decorateBubble,

    judge: (ch, ctx) => {
      // power types
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

      // storm: เติม fever เล็กน้อยให้เดือดขึ้น
      if (state.stormLeft > 0 && (ctx.isGood || ctx.isPower)) {
        state.fever = clamp(state.fever + 2, 0, 100);
      }

      return judge(ch, ctx);
    },

    onExpire: (info) => {
      // storm: good หลุด = โดนลดน้ำเพิ่มนิด
      if (state.stormLeft > 0 && info && info.isGood && !info.isPower) {
        state.waterPct = clamp(state.waterPct - 2, 0, 100);
      }
      onExpire(info);
    }
  });

  // init hud
  updateWaterHud();
  if (Q && Q.stats){
    Q.stats.zone = zoneFrom(state.waterPct);
    Q.stats.greenTick = 0;
  }
  updateQuestHud();
  updateScoreHud();
  feverRender();

  // bind drag (on playfield only)
  playfield.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  // gyro permission on first gesture
  const onceAsk = async () => {
    ROOT.removeEventListener('pointerdown', onceAsk);
    await requestGyroPermission();
  };
  ROOT.addEventListener('pointerdown', onceAsk, { passive:true });

  // postfx loop
  if (post && post.ctx){
    fxRaf = ROOT.requestAnimationFrame(fxLoop);
  }

  // start loops
  timer = ROOT.setInterval(secondTick, 1000);
  rafId = ROOT.requestAnimationFrame(rafLoop);

  // stop cleanup hooks
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

    try{ if (fxRaf) ROOT.cancelAnimationFrame(fxRaf); }catch{}
    fxRaf = null;

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
      zone: state.zoneLabel,
      zoneRaw: state.zoneRaw,
      greenTick: (Q && Q.stats) ? (Q.stats.greenTick|0) : (state.greenTick|0)
    });

    dispatch('hha:coach', { text:'🏁 จบเกม! ดูผลคะแนนและเควสได้เลย', mood:'happy' });
    try{ Particles.celebrate && Particles.celebrate('end'); }catch{}
    stormOnUI(false);
  }

  return { stop };
}

export default { boot };