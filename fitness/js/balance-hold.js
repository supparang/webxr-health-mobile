// /fitness/js/balance-hold.js
// DOM-based Balance Platform + Obstacle Avoidance
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---- DOM refs ---- */
const viewMenu     = $('#view-menu');
const viewResearch = $('#view-research');
const viewPlay     = $('#view-play');
const viewResult   = $('#view-result');

const elDiffSel    = $('#difficulty');
const elDurSel     = $('#sessionDuration');

const hudMode      = $('#hud-mode');
const hudDiff      = $('#hud-diff');
const hudDur       = $('#hud-dur');
const hudStab      = $('#hud-stability');
const hudObs       = $('#hud-obstacles');
const hudTime      = $('#hud-time');

const playArea      = $('#playArea');
const platformWrap  = $('#platform-wrap');
const platformEl    = $('#platform');
const indicatorEl   = $('#indicator');
const obstacleLayer = $('#obstacle-layer');
const coachLabel    = $('#coachLabel');
const coachBubble   = $('#coachBubble');

/* result fields */
const resMode      = $('#res-mode');
const resDiff      = $('#res-diff');
const resDur       = $('#res-dur');
const resEnd       = $('#res-end');
const resStab      = $('#res-stability');
const resMeanTilt  = $('#res-meanTilt');
const resRmsTilt   = $('#res-rmsTilt');
const resAvoid     = $('#res-avoid');
const resHit       = $('#res-hit');
const resAvoidRate = $('#res-avoidRate');
const resFatigue   = $('#res-fatigue');
const resSamples   = $('#res-samples');

/* ---- Config ---- */
const GAME_DIFF = {
  easy: {
    safeHalf: 0.35,
    disturbMinMs: 1400,
    disturbMaxMs: 2600,
    disturbStrength: 0.18,
    passiveDrift: 0.01
  },
  normal: {
    safeHalf: 0.25,
    disturbMinMs: 1200,
    disturbMaxMs: 2200,
    disturbStrength: 0.23,
    passiveDrift: 0.02
  },
  hard: {
    safeHalf: 0.18,
    disturbMinMs: 900,
    disturbMaxMs: 1800,
    disturbStrength: 0.30,
    passiveDrift: 0.03
  }
};

function pickDiff(key){ return GAME_DIFF[key] || GAME_DIFF.normal; }

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'ครบเวลาที่กำหนด / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}
const fmtPercent = (v)=>(v==null||Number.isNaN(v))?'-':(v*100).toFixed(1)+'%';
const fmtFloat   = (v,d=2)=>(v==null||Number.isNaN(v))?'-':v.toFixed(d);

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function randomBetween(a,b){ return a + Math.random()*(b-a); }

/* ---- State ---- */
let gameMode    = 'play'; // 'play' | 'research'
let state       = null;
let rafId       = null;
let logger      = null;
let sessionMeta = null;

const COACH_LINES = {
  welcome: 'พร้อมทรงตัวแล้วนะ ✨ เลื่อนไปซ้าย–ขวาเบา ๆ เพื่อรักษาจุดให้อยู่โซนปลอดภัย / Gently balance left–right to stay in the safe zone.',
  good:    'ดีมาก! เวลาที่อยู่ในโซนปลอดภัยเพิ่มขึ้นเรื่อย ๆ / Great, your stability time is increasing.',
  drift:   'เอียงไปด้านใดด้านหนึ่งบ่อย ลองดันกลับมาตรงกลางช้า ๆ / You drift to one side, gently bring it back to center.',
  obstacleAvoid: 'หลบแรงรบกวนได้สวยมาก! / Nice dodge!',
  obstacleHit:   'โดนแรงรบกวนบ่อย ลองโฟกัสช่วงที่ไอคอนขึ้นมากขึ้น / Watch for the shock icons and prepare to counter.'
};
let lastCoachAt = 0;
let lastCoachSnapshot = null;
const COACH_COOLDOWN_MS = 5000;

/* ---- Views ---- */
function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu')     viewMenu && viewMenu.classList.remove('hidden');
  if (name==='research') viewResearch && viewResearch.classList.remove('hidden');
  if (name==='play')     viewPlay && viewPlay.classList.remove('hidden');
  if (name==='result')   viewResult && viewResult.classList.remove('hidden');
}

/* ---- Coach ---- */
function showCoach(key){
  if (!coachBubble) return;
  const now = performance.now();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  const msg = COACH_LINES[key];
  if (!msg) return;
  lastCoachAt = now;
  coachBubble.textContent = msg;
  coachBubble.classList.remove('hidden');
  setTimeout(()=>{
    if (coachBubble) coachBubble.classList.add('hidden');
  }, 4200);
}

function updateCoach(){
  if (!state) return;
  const snap = {
    stabTime: state.stableSamples,
    totalSamples: state.totalSamples,
    hitObstacles: state.obstaclesHit,
    avoidObstacles: state.obstaclesAvoided,
    meanTilt: Math.abs(state.meanTilt || 0)
  };

  if (!lastCoachSnapshot){
    showCoach('welcome');
    lastCoachSnapshot = snap;
    return;
  }
  const prev = lastCoachSnapshot;

  // stability improved
  if (snap.totalSamples > 20){
    const prevStab = prev.totalSamples ? (prev.stabTime/prev.totalSamples) : 0;
    const currStab = snap.totalSamples ? (snap.stabTime/snap.totalSamples) : 0;
    if (currStab - prevStab > 0.12) showCoach('good');
  }

  // drift high
  if (snap.meanTilt > 0.5 && prev.meanTilt <= 0.5){
    showCoach('drift');
  }

  // obstacle events
  if (snap.avoidObstacles > prev.avoidObstacles){
    showCoach('obstacleAvoid');
  }else if (snap.hitObstacles > prev.hitObstacles){
    showCoach('obstacleHit');
  }

  lastCoachSnapshot = snap;
}

/* ---- CSV Logger ---- */
function createCSVLogger(meta){
  const rows = [];
  const header = [
    'timestamp','event',
    'playerId','group','phase','mode',
    'difficulty','durationSec',
    'tilt','targetTilt','inSafe',
    'obstacleId','obstacleResult'
  ];
  rows.push(header);

  function push(ev, extra){
    const t = Date.now();
    const e = extra || {};
    rows.push([
      t, ev,
      meta.playerId||'', meta.group||'', meta.phase||'', meta.mode||'',
      meta.difficulty||'', meta.durationSec||'',
      e.tilt ?? '', e.targetTilt ?? '', e.inSafe ?? '',
      e.obstacleId ?? '', e.obstacleResult ?? ''
    ]);
  }

  return {
    logSample(info){ push('sample', info); },
    logObstacle(info){ push('obstacle', info); },
    finish(summary){
      push('summary',{
        tilt: summary.meanTilt,
        targetTilt:'',
        inSafe: summary.stabilityRatio,
        obstacleId:'',
        obstacleResult:`avoid=${summary.obstaclesAvoided},hit=${summary.obstaclesHit}`
      });

      // auto download CSV in research mode
      if (meta.mode === 'research'){
        const csv = rows.map(r=>r.map(v=>{
          const s = String(v ?? '');
          if (s.includes('"') || s.includes(',') || s.includes('\n')){
            return '"' + s.replace(/"/g,'""') + '"';
          }
          return s;
        }).join(',')).join('\r\n');

        const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vrfitness_balance-${meta.difficulty}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{
          try{ document.body.removeChild(a); }catch(e){}
          URL.revokeObjectURL(url);
        }, 120);
      }
    }
  };
}

/* ---- dashboard hook ---- */
const globalStats =
  (window.VRFitnessStats && window.VRFitnessStats.recordSession)
  ? window.VRFitnessStats
  : (window.__VRFIT_STATS || null);

function recordSessionToDashboard(gameId, summary){
  if (globalStats && typeof globalStats.recordSession === 'function'){
    try{ globalStats.recordSession(gameId, summary); }catch(e){}
  }else{
    try{
      const key = 'vrfit_sessions_'+gameId;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...summary, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
}

/* ---- Session meta ---- */
function buildSessionMeta(diffKey, durationSec){
  let playerId='anon', group='', phase='';
  if (gameMode==='research'){
    const id  = $('#researchId')?.value.trim();
    const grp = $('#researchGroup')?.value.trim();
    const ph  = $('#researchPhase')?.value.trim();
    playerId = id || 'anon';
    group    = grp || '';
    phase    = ph || '';
  }
  return {
    gameId:'balance-hold',
    playerId, group, phase,
    mode: gameMode,
    difficulty: diffKey,
    durationSec,
    filePrefix:'vrfitness_balance'
  };
}

/* ---- Start game ---- */
function startGame(kind){
  gameMode = (kind === 'research' ? 'research' : 'play');

  const diffKey = elDiffSel?.value || 'normal';
  const durSec  = parseInt(elDurSel?.value || '60',10) || 60;
  const cfg     = pickDiff(diffKey);

  sessionMeta = buildSessionMeta(diffKey, durSec);
  logger      = createCSVLogger(sessionMeta);

  // clear old obstacles
  if (obstacleLayer) obstacleLayer.innerHTML = '';

  const now = performance.now();
  state = {
    diffKey,
    cfg,
    durationMs: durSec * 1000,
    startTime: now,
    elapsed: 0,

    angle: 0,       // current simulated balance angle -1..1+
    targetAngle: 0, // player input target -1..1
    lastFrame: now,
    inputActive: false,

    // sampling
    sampleEveryMs: 120,
    nextSampleAt: now + 120,
    totalSamples: 0,
    stableSamples: 0,
    sumTiltAbs: 0,
    sumTiltSq: 0,
    samples: [], // {tNorm, tilt}

    // obstacles
    nextObstacleAt: now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs),
    obstacleSeq: 1,
    obstaclesTotal: 0,
    obstaclesAvoided: 0,
    obstaclesHit: 0,

    fatigueIndex: 0
  };

  lastCoachAt = 0;
  lastCoachSnapshot = null;
  if (coachBubble) coachBubble.classList.add('hidden');

  if (hudMode) hudMode.textContent = (gameMode==='research' ? 'Research' : 'Play');
  if (hudDiff) hudDiff.textContent = diffKey;
  if (hudDur)  hudDur.textContent  = String(durSec);
  if (hudStab) hudStab.textContent = '0%';
  if (hudObs)  hudObs.textContent  = '0 / 0';
  if (hudTime) hudTime.textContent = durSec.toFixed(1);

  if (coachLabel) coachLabel.textContent =
    'จับ/แตะแล้วเลื่อนไปซ้าย–ขวาเพื่อรักษาสมดุล / Drag left–right to balance';

  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  showView('play');
}

/* ---- main loop ---- */
function loop(now){
  if (!state) return;

  const dt = Math.max(0, Math.min(50, now - state.lastFrame)); // clamp dt
  state.lastFrame = now;
  state.elapsed = now - state.startTime;

  const remainMs = Math.max(0, state.durationMs - state.elapsed);
  if (hudTime) hudTime.textContent = (remainMs/1000).toFixed(1);

  if (state.elapsed >= state.durationMs){
    stopGame('timeout');
    return;
  }

  // physics: move angle toward target + passive drift
  const cfg = state.cfg;
  const lerp = 0.11;
  const driftDir = (Math.random()<0.5 ? -1 : 1) * cfg.passiveDrift * (dt/1000);

  // tiny disturbance baseline (feels alive)
  const target = state.targetAngle + driftDir;
  state.angle += (target - state.angle) * lerp;

  state.angle = clamp(state.angle, -1.2, 1.2);
  state.targetAngle = clamp(state.targetAngle, -1, 1);

  updateVisuals();

  // sampling stability
  if (now >= state.nextSampleAt){
    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;
    state.totalSamples++;
    if (inSafe) state.stableSamples++;

    const absTilt = Math.abs(state.angle);
    state.sumTiltAbs += absTilt;
    state.sumTiltSq  += absTilt * absTilt;
    const tNorm = state.elapsed / state.durationMs;
    state.samples.push({ tNorm, tilt: absTilt });

    logger && logger.logSample({
      tilt: state.angle.toFixed(4),
      targetTilt: state.targetAngle.toFixed(4),
      inSafe: inSafe ? 1 : 0
    });

    state.nextSampleAt = now + state.sampleEveryMs;

    const stabRatio = state.totalSamples ? state.stableSamples/state.totalSamples : 0;
    if (hudStab) hudStab.textContent = fmtPercent(stabRatio);

    // keep lightweight live mean for coach drift check
    state.meanTilt = state.totalSamples ? (state.sumTiltAbs / state.totalSamples) : 0;
    updateCoach();
  }

  // obstacles
  if (now >= state.nextObstacleAt){
    spawnObstacle(now);
  }

  rafId = requestAnimationFrame(loop);
}

/* ---- visuals ---- */
function updateVisuals(){
  if (!platformEl || !indicatorEl || !state) return;

  const maxDeg = 16;
  const angleDeg = state.angle * maxDeg;
  platformEl.style.transform = `rotate(${angleDeg}deg)`;

  const wrapRect = platformWrap?.getBoundingClientRect();
  if (wrapRect){
    const halfW = wrapRect.width * 0.34;
    const x = state.angle * halfW;
    indicatorEl.style.transform = `translateX(${x}px) translateY(-18px)`;
  }

  if (hudObs){
    hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
  }
}

/* ---- obstacles ---- */
function spawnObstacle(now){
  if (!state || !obstacleLayer) return;

  const cfg = state.cfg;
  const id = state.obstacleSeq++;
  state.obstaclesTotal++;

  const kind = Math.random() < 0.6 ? 'gust' : 'bomb';
  const emoji = kind === 'gust' ? '💨' : '💣';

  const span = document.createElement('div');
  span.className = 'obstacle';
  span.textContent = emoji;
  span.dataset.id = String(id);
  span.dataset.kind = kind;

  const wrapRect = playArea?.getBoundingClientRect();
  const xNorm = (Math.random()*2 - 1); // -1..1
  const pxX = wrapRect ? (wrapRect.width/2 + xNorm*(wrapRect.width*0.32)) : 0;

  span.style.left = pxX + 'px';
  obstacleLayer.appendChild(span);

  // remove fallback if still present
  const removeTimer = setTimeout(()=>{
    try{ span.remove(); }catch(e){}
  }, 1500);

  // resolve at impact time
  const impactDelay = Math.max(0, 950); // stable timing relative to spawn
  setTimeout(()=>{
    if (!state) return;

    const inSafe = Math.abs(state.angle) <= cfg.safeHalf;

    if (inSafe){
      span.classList.add('avoid');
      state.obstaclesAvoided++;
    }else{
      span.classList.add('hit');
      state.obstaclesHit++;
      // knock further toward same tilt direction (or random if centered)
      const knockDir = (Math.abs(state.angle) < 0.02) ? (Math.random()<0.5 ? -1 : 1) : (state.angle >= 0 ? 1 : -1);
      state.angle += knockDir * cfg.disturbStrength * 0.7;
      state.angle = clamp(state.angle, -1.2, 1.2);
    }

    logger && logger.logObstacle({
      obstacleId: id,
      obstacleResult: inSafe ? 'avoid' : 'hit',
      tilt: state.angle.toFixed(4),
      inSafe: inSafe ? 1 : 0
    });

    if (hudObs){
      hudObs.textContent = `${state.obstaclesAvoided} / ${state.obstaclesTotal}`;
    }

    // let avoid/hit animation show before removing
    clearTimeout(removeTimer);
    setTimeout(()=>{ try{ span.remove(); }catch(e){} }, 360);
  }, impactDelay);

  state.nextObstacleAt = now + randomBetween(cfg.disturbMinMs, cfg.disturbMaxMs);
}

/* ---- Analytics ---- */
function computeAnalytics(){
  if (!state || !state.totalSamples){
    return {
      stabilityRatio:0,
      meanTilt:0,
      rmsTilt:0,
      fatigueIndex:0,
      samples:0
    };
  }

  const n = state.totalSamples;
  const stabilityRatio = state.stableSamples / n;
  const meanTilt = state.sumTiltAbs / n;
  const rmsTilt = Math.sqrt(state.sumTiltSq / n);

  // fatigue: compare first 25% vs last 25%
  let fatigueIndex = 0;
  if (state.samples.length >= 8){
    const arr = state.samples;
    const seg = Math.max(2, Math.floor(arr.length * 0.25));
    const early = arr.slice(0, seg);
    const late  = arr.slice(-seg);
    const mE = early.reduce((a,b)=>a+b.tilt,0) / early.length;
    const mL = late.reduce((a,b)=>a+b.tilt,0) / late.length;
    if (mE > 0) fatigueIndex = (mL - mE) / mE;
  }

  return { stabilityRatio, meanTilt, rmsTilt, fatigueIndex, samples:n };
}

/* ---- Stop & summary ---- */
function stopGame(endedBy){
  if (!state) return;

  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const a = computeAnalytics();
  const liveSamples = state.totalSamples;

  const summary = {
    gameId:'balance-hold',
    mode: sessionMeta?.mode || gameMode,
    difficulty: state.diffKey,
    durationSec: (state.durationMs/1000),
    stabilityRatio: a.stabilityRatio,
    meanTilt: a.meanTilt,
    rmsTilt: a.rmsTilt,
    fatigueIndex: a.fatigueIndex,
    obstaclesAvoided: state.obstaclesAvoided,
    obstaclesHit: state.obstaclesHit,
    samples: liveSamples
  };

  logger && logger.finish(summary);
  recordSessionToDashboard('balance-hold', summary);

  fillResultView(endedBy, summary);

  state = null;
  showView('result');
}

function fillResultView(endedBy, summary){
  const modeLabel = summary.mode === 'research' ? 'Research' : 'Play';

  if (resMode)      resMode.textContent = modeLabel;
  if (resDiff)      resDiff.textContent = summary.difficulty || '-';
  if (resDur)       resDur.textContent  = String(summary.durationSec || '-');
  if (resEnd)       resEnd.textContent  = mapEndReason(endedBy);

  if (resStab)      resStab.textContent     = fmtPercent(summary.stabilityRatio || 0);
  if (resMeanTilt)  resMeanTilt.textContent = fmtFloat(summary.meanTilt || 0, 3);
  if (resRmsTilt)   resRmsTilt.textContent  = fmtFloat(summary.rmsTilt || 0, 3);

  if (resAvoid)     resAvoid.textContent = String(summary.obstaclesAvoided || 0);
  if (resHit)       resHit.textContent   = String(summary.obstaclesHit || 0);

  const totalObs = (summary.obstaclesAvoided||0) + (summary.obstaclesHit||0);
  const avoidRate = totalObs ? (summary.obstaclesAvoided/totalObs) : 0;
  if (resAvoidRate) resAvoidRate.textContent = fmtPercent(avoidRate);

  if (resFatigue)   resFatigue.textContent = fmtFloat(summary.fatigueIndex || 0, 3);
  if (resSamples)   resSamples.textContent = String(summary.samples || 0);
}

/* ---- Input handling ---- */
function attachInput(){
  if (!playArea) return;

  let active = false;

  function updateTargetFromEvent(ev){
    if (!state) return;
    const rect = playArea.getBoundingClientRect();

    let x = ev.clientX;
    if (x == null && ev.touches && ev.touches[0]) x = ev.touches[0].clientX;
    if (x == null) return;

    const relX = (x - rect.left) / rect.width; // 0..1
    const norm = (relX - 0.5) * 2; // -1..1
    state.targetAngle = clamp(norm, -1, 1);
  }

  playArea.addEventListener('pointerdown', ev=>{
    active = true;
    if (state) state.inputActive = true;
    try{ playArea.setPointerCapture(ev.pointerId); }catch(e){}
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointermove', ev=>{
    if (!active) return;
    updateTargetFromEvent(ev);
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointerup', ev=>{
    active = false;
    if (state) state.inputActive = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, { passive:false });

  playArea.addEventListener('pointercancel', ev=>{
    active = false;
    if (state) state.inputActive = false;
    try{ playArea.releasePointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }, { passive:false });

  // Optional: keyboard support for PC
  window.addEventListener('keydown', ev=>{
    if (!state) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A'){
      state.targetAngle = clamp(state.targetAngle - 0.12, -1, 1);
    }else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D'){
      state.targetAngle = clamp(state.targetAngle + 0.12, -1, 1);
    }
  });
}

/* ---- Init ---- */
function init(){
  $('[data-action="start-normal"]')?.addEventListener('click', ()=> startGame('play'));
  $('[data-action="goto-research"]')?.addEventListener('click', ()=> showView('research'));

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  $('[data-action="start-research"]')?.addEventListener('click', ()=> startGame('research'));

  $('[data-action="stop"]')?.addEventListener('click', ()=>{
    if (state) stopGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click', ()=>{
    showView('menu');
  });

  attachInput();
  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);