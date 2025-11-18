// fitness/js/rhythm-boxer.js
'use strict';

import { SFX } from './sfx.js';
import { spawnHitParticle } from './particle.js';
import { createCSVLogger } from './logger-csv.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* -------- Views & DOM refs -------- */
const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewCalib   = $('#view-calib');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

const elDiffSel   = $('#difficulty');
const elTempoSel  = $('#tempoMode');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudBpm    = $('#hud-bpm');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudMiss   = $('#hud-miss');
const elHudTime   = $('#hud-time');

const playArea    = $('#playArea');
const padWrap     = $('#padWrap');
const judgeLabel  = $('#judgeLabel');
const feverFill   = $('#feverFill');

const coachBubble = $('#coachBubble');
const comboCallEl = $('#comboCall');

/* Result */
const resMode      = $('#res-mode');
const resDiff      = $('#res-diff');
const resTempo     = $('#res-tempo');
const resBpm       = $('#res-bpm');
const resEnd       = $('#res-end');
const resScore     = $('#res-score');
const resMaxCombo  = $('#res-maxcombo');
const resHits      = $('#res-hits');
const resMiss      = $('#res-miss');
const resAcc       = $('#res-acc');
const resPerf      = $('#res-perfect');
const resGood      = $('#res-good');
const resLate      = $('#res-late');
const resRTMean    = $('#res-rtmean');
const resRTSD      = $('#res-rtsd');
const resIBI       = $('#res-ibi');
const resDrift     = $('#res-drift');
const resFatigue   = $('#res-fatigue');
const resSpatial   = $('#res-spatial');
const resSpatialOK = $('#res-spatial-ok');
const resSpatialBad= $('#res-spatial-bad');

/* -------- Config -------- */
const GAME_DURATION_MS = 60000;
const CALIB_DURATION_MS= 30000;

const DIFF_CONFIG = {
  easy:   { bpm:100, perfectMs:180, goodMs:260, lateMs:340 },
  normal: { bpm:130, perfectMs:150, goodMs:230, lateMs:300 },
  hard:   { bpm:160, perfectMs:130, goodMs:200, lateMs:260 }
};

const CALIB_KEY_PREFIX = 'rb_calib_v1_';
function calibKey(playerId,diffKey){
  return CALIB_KEY_PREFIX + (playerId||'anon') + '_' + (diffKey||'normal');
}
function saveCalibration(playerId,diffKey,data){
  try{ localStorage.setItem(calibKey(playerId,diffKey), JSON.stringify(data)); }catch(e){}
}
function loadCalibration(playerId,diffKey){
  try{
    const raw = localStorage.getItem(calibKey(playerId,diffKey));
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* -------- State -------- */
let gameMode = 'play';  // 'play' | 'research' | 'calibration'
let sessionMeta = null;
let logger = null;
let state = null;
let rafId = null;
let pendingResearch = null;

/* Coach messages (TH+EN ในประโยคเดียว) */
const COACH_LINES = {
  welcome: 'พร้อมลุยจังหวะแล้ว! ตีตามจังหวะให้เป๊ะ ๆ เลย / Ready? Punch on the beat! 🎵',
  combo:   'คอมโบยาวมากเลย รักษาจังหวะไว้ให้ได้ / Great streak, keep the rhythm! 🔥',
  fever:   'เข้าสู่ FEVER แล้ว ตีแรงแต่ยังต้องตรงจังหวะ / FEVER time! Power + precision! ✨',
  miss:    'พลาดไปนิดหน่อย ไม่เป็นไร รอบหน้าค่อย ๆ เล็งใหม่ / Small miss, slow down & refocus 👍',
  spatial: 'ตีผิดเป้าบ่อย ลองโฟกัสตำแหน่งมากขึ้น / Many wrong pads, watch the lanes 👀'
};

let lastCoachAt = 0;
let lastCoachSnapshot = null;
const COACH_COOLDOWN_MS = 4500;

/* -------- Helper functions -------- */
function showView(name){
  [viewMenu,viewResearch,viewCalib,viewPlay,viewResult].forEach(v=>v.classList.add('hidden'));
  if (name==='menu')    viewMenu.classList.remove('hidden');
  if (name==='research')viewResearch.classList.remove('hidden');
  if (name==='calib')   viewCalib.classList.remove('hidden');
  if (name==='play')    viewPlay.classList.remove('hidden');
  if (name==='result')  viewResult.classList.remove('hidden');
}

function mapEndReason(code){
  switch(code){
    case 'timeout': return 'เล่นครบเวลา / Timeout';
    case 'manual':  return 'หยุดเอง / Stopped by player';
    default:        return code || '-';
  }
}
function fmtPercent(val){
  if (val==null || Number.isNaN(val)) return '-';
  return (val*100).toFixed(1)+' %';
}
function fmtMs(val){
  if (!val || val<=0) return '-';
  return val.toFixed(0)+' ms';
}
function fmtFloat(val,d){
  if (val==null || Number.isNaN(val)) return '-';
  return val.toFixed(d ?? 2);
}

/* Judge label */
let judgeTimer = null;
function showJudge(text, kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text;
  judgeLabel.className = 'judge show';
  if (kind) judgeLabel.classList.add('judge-'+kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{
    judgeLabel.classList.remove('show');
  }, 380);
}

/* Combo call overlay */
function showComboCall(text){
  if (!comboCallEl) return;
  comboCallEl.textContent = text;
  comboCallEl.classList.add('show');
  setTimeout(()=> comboCallEl.classList.remove('show'), 600);
}

/* Fever visual */
function updateFeverVisual(){
  if (!state || !feverFill || !playArea) return;
  const charge = Math.max(0, Math.min(100, state.feverCharge));
  feverFill.style.width = charge + '%';
  if (state.feverActive){
    playArea.classList.add('hot');
  }else{
    playArea.classList.remove('hot');
  }
}

/* Coach */
function showCoach(textKey){
  const now = performance.now();
  if (!coachBubble || now - lastCoachAt < COACH_COOLDOWN_MS) return;
  lastCoachAt = now;
  coachBubble.textContent = COACH_LINES[textKey] || '';
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 3800);
}
function updateCoach(){
  if (!state) return;
  const snap = {
    combo: state.combo,
    miss: state.missCount,
    fever: state.feverActive,
    spatialWrong: state.spatialWrong + state.spatialEmptyTaps
  };
  if (!lastCoachSnapshot){
    showCoach('welcome');
    lastCoachSnapshot = snap;
    return;
  }
  const prev = lastCoachSnapshot;
  if (!prev.fever && snap.fever){
    showCoach('fever');
  }else if (snap.combo>=10 && prev.combo<10){
    showCoach('combo');
  }else if (snap.miss>prev.miss){
    showCoach('miss');
  }else if (snap.spatialWrong>=5 && prev.spatialWrong<5){
    showCoach('spatial');
  }
  lastCoachSnapshot = snap;
}

/* -------- Session meta & start -------- */
function buildSessionMeta(diffKey, tempoMode, isCalib){
  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  let playerId = 'anon', group='', phase='';

  if (gameMode==='research' || isCalib){
    if (pendingResearch){
      playerId = pendingResearch.id || 'anon';
      group    = pendingResearch.group || '';
      phase    = pendingResearch.phase || (isCalib ? 'calibration' : '');
    }
  }

  return {
    gameId: 'rhythm-boxer',
    playerId,
    group,
    phase,
    mode: isCalib ? 'calibration' : gameMode,
    difficulty: diffKey,
    tempoMode,
    baseBpm: diffCfg.bpm,
    filePrefix: 'vrfitness_rhythm'
  };
}

function startGame(kind){
  gameMode = (kind==='research' ? 'research' :
              kind==='calibration' ? 'calibration' : 'play');

  const diffKey = (gameMode==='calibration'
    ? ($('#calibDiff')?.value || 'normal')
    : (elDiffSel?.value || 'normal'));

  const tempoMode = elTempoSel?.value || 'fixed';
  const isCalib = (gameMode==='calibration');

  sessionMeta = buildSessionMeta(diffKey, tempoMode, isCalib);

  const baseCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const baseBpm = baseCfg.bpm;
  const baseIBI = 60000 / baseBpm;

  // judgement window: ใช้ calibration ถ้ามี
  const calib = !isCalib ? loadCalibration(sessionMeta.playerId, diffKey) : null;
  const judgeCfg = {
    perfectMs: calib?.perfectMs || baseCfg.perfectMs,
    goodMs:    calib?.goodMs    || baseCfg.goodMs,
    lateMs:    calib?.lateMs    || baseCfg.lateMs
  };

  state = {
    diffKey,
    tempoMode,
    baseBpm,
    baseIBI,
    judge: judgeCfg,

    startTime: performance.now(),
    elapsed: 0,
    nextBeatAt: performance.now()+600,
    lastBeatTime: null,

    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,

    perfectCount: 0,
    goodCount: 0,
    lateCount: 0,

    beats: [],
    nextBeatId: 1,

    feverCharge: 0,
    feverActive: false,
    feverUntil: 0,

    spatialCorrect: 0,
    spatialWrong: 0,
    spatialEmptyTaps: 0
  };

  // HUD
  if (elHudMode){
    elHudMode.textContent =
      gameMode==='research' ? 'Research' :
      gameMode==='calibration' ? 'Calibration' : 'Play';
  }
  if (elHudDiff) elHudDiff.textContent = diffKey;
  if (elHudBpm)  elHudBpm.textContent  = String(baseBpm);
  if (elHudScore) elHudScore.textContent = '0';
  if (elHudCombo) elHudCombo.textContent = '0';
  if (elHudMiss)  elHudMiss.textContent  = '0';
  if (elHudTime)  elHudTime.textContent  =
    ((isCalib?CALIB_DURATION_MS:GAME_DURATION_MS)/1000).toFixed(1);

  // reset
  $$('#padWrap .pad').forEach(p=>p.classList.remove('pad-active','pad-hit'));
  lastCoachSnapshot = null;
  lastCoachAt = 0;
  if (coachBubble) coachBubble.classList.add('hidden');

  logger = createCSVLogger(sessionMeta);

  showView('play');
  updateFeverVisual();

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* -------- Loop -------- */
function getDurationLimit(){
  return gameMode==='calibration' ? CALIB_DURATION_MS : GAME_DURATION_MS;
}

function loop(now){
  if (!state) return;

  state.elapsed = now - state.startTime;
  const limit = getDurationLimit();
  const remaining = Math.max(0, limit - state.elapsed);
  if (elHudTime) elHudTime.textContent = (remaining/1000).toFixed(1);

  if (state.elapsed >= limit){
    stopGame('timeout');
    return;
  }

  // fever decay
  const dtSec = 16/1000;
  if (!state.feverActive){
    state.feverCharge = Math.max(0, state.feverCharge - 5*dtSec);
  }else if (now >= state.feverUntil){
    state.feverActive = false;
  }
  updateFeverVisual();

  // spawn beats
  while(now >= state.nextBeatAt){
    spawnBeat(state.nextBeatAt);
    const interval = computeNextInterval();
    state.nextBeatAt += interval;
  }

  // mark expired as miss
  const judge = state.judge || (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal);
  const missWindow = judge.lateMs + 160;
  for (const beat of state.beats){
    if (!beat.hit && !beat.missed && now >= beat.beatTime + missWindow){
      beat.missed = true;
      state.missCount++;
      state.combo = 0;
      if (elHudMiss) elHudMiss.textContent = String(state.missCount);
      showJudge('MISS','miss');
      SFX.play('miss');
      if (playArea){
        playArea.classList.add('shake');
        setTimeout(()=> playArea.classList.remove('shake'), 140);
      }
      logger?.logExpire({
        id:beat.id,type:'beat',t:now,
        result:'miss'
      });
    }
  }

  updateCoach();
  rafId = requestAnimationFrame(loop);
}

/* Tempo interval */
function computeNextInterval(){
  const base = state.baseIBI;
  const tMode = state.tempoMode;
  const n = state.beats.length;

  if (tMode==='fixed') return base;

  if (tMode==='ramp'){
    const step = Math.floor(n/8);
    const factor = Math.max(0.6, 1 - step*0.03);
    return base*factor;
  }
  if (tMode==='random'){
    const r = 0.8 + Math.random()*0.4;
    return base*r;
  }
  return base;
}

/* Spawn beat */
function spawnBeat(beatTime){
  const padIndex = Math.floor(Math.random()*4);
  const beat = {
    id: state.nextBeatId++,
    pad: padIndex,
    beatTime,
    hit:false,
    missed:false,
    hitTime:null,
    rt:null,
    quality:null,
    spatialHit:false
  };
  state.beats.push(beat);
  state.lastBeatTime = beatTime;

  const pad = padWrap?.querySelector(`.pad[data-pad="${padIndex}"]`);
  if (pad){
    pad.classList.add('pad-active');
    setTimeout(()=> pad.classList.remove('pad-active'), 220);
  }

  logger?.logSpawn({
    id:beat.id,
    type:'beat',
    t:beatTime,
    x:padIndex,y:0
  });
}

/* Handle pad tap */
function handlePadTap(padIndex, ev){
  if (!state) return;
  const now = performance.now();
  const judge = state.judge || (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal);
  const maxWindow = judge.lateMs;

  // particle
  if (padWrap && ev){
    const rect = padWrap.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    spawnHitParticle(padWrap, x, y, '💥');
  }

  // best matching beat
  let best=null, bestDt=Infinity;
  for (const beat of state.beats){
    if (beat.hit || beat.missed) continue;
    const dt = Math.abs(now - beat.beatTime);
    if (dt<=maxWindow && dt<bestDt){
      best = beat;
      bestDt = dt;
    }
  }

  const padEl = padWrap?.querySelector(`.pad[data-pad="${padIndex}"]`);
  if (padEl){
    padEl.classList.add('pad-hit');
    setTimeout(()=> padEl.classList.remove('pad-hit'), 120);
  }

  if (!best){
    state.spatialEmptyTaps++;
    showJudge('MISS','miss');
    SFX.play('miss');
    if (playArea){
      playArea.classList.add('shake');
      setTimeout(()=> playArea.classList.remove('shake'), 140);
    }
    return;
  }

  best.hit = true;
  best.hitTime = now;
  const rt = Math.abs(now - best.beatTime);
  best.rt = rt;
  const spatialHit = (padIndex===best.pad);
  best.spatialHit = spatialHit;

  const isPerfect = rt<=judge.perfectMs;
  const isGood    = !isPerfect && rt<=judge.goodMs;
  const isLate    = !isPerfect && !isGood && rt<=judge.lateMs;

  let quality='late', scoreGain=0;
  if (isPerfect){
    quality='perfect'; scoreGain=15;
    state.perfectCount++;
    state.feverCharge += 8;
    showJudge('PERFECT','perfect');
    SFX.play('perfect');
  }else if (isGood){
    quality='good'; scoreGain=9;
    state.goodCount++;
    state.feverCharge += 5;
    showJudge('GOOD','good');
    SFX.play('good');
  }else if (isLate){
    quality='late'; scoreGain=4;
    state.lateCount++;
    state.feverCharge += 2;
    showJudge('LATE','late');
    SFX.play('late');
  }else{
    quality='miss'; scoreGain=0;
    state.missCount++;
    state.combo=0;
    if (elHudMiss) elHudMiss.textContent = String(state.missCount);
    showJudge('MISS','miss');
    SFX.play('miss');
    if (playArea){
      playArea.classList.add('shake');
      setTimeout(()=> playArea.classList.remove('shake'), 140);
    }
  }
  best.quality = quality;

  if (spatialHit){
    state.spatialCorrect++;
  }else{
    state.spatialWrong++;
    showJudge('WRONG PAD','wrong');
  }

  if (quality==='perfect' || quality==='good' || quality==='late'){
    state.combo++;
    if (state.combo>state.maxCombo) state.maxCombo = state.combo;
  }else{
    state.combo = 0;
  }

  // FEVER
  if (!state.feverActive && state.feverCharge>=100){
    state.feverActive = true;
    state.feverUntil  = now+5000;
    SFX.play('fever');
    showComboCall('FEVER!! 🔥');
  }

  const multiplier = state.feverActive ? 2 : 1;
  state.score += scoreGain*multiplier;

  if (elHudScore) elHudScore.textContent = String(state.score);
  if (elHudCombo) elHudCombo.textContent = String(state.combo);
  if (elHudMiss)  elHudMiss.textContent  = String(state.missCount);

  if (state.combo===5 || state.combo===10 || state.combo===20){
    showComboCall('COMBO x'+state.combo+'! 🔥');
  }

  updateFeverVisual();

  logger?.logHit({
    id:best.id,
    type:'beat',
    result:quality,
    score:state.score,
    combo:state.combo,
    missCount:state.missCount,
    t:now,
    reactionMs:rt,
    extra:{
      padTarget:best.pad,
      padClick:padIndex,
      spatialHit,
      tempoMode:state.tempoMode
    }
  });
}

/* -------- Analytics -------- */
function computeAnalytics(){
  const beats = state ? state.beats : [];
  if (!beats || !beats.length){
    return {
      totalSpawns:0,totalHits:0,accuracy:0,
      rtMean:0,rtStd:0,ibiErrorMeanAbsMs:0,
      tempoDriftMs:0,fatigueIndex:0,
      spatialAccuracy:0,spatialCorrect:0,spatialWrong:0,spatialEmptyTaps:0,
      perfectCount:0,goodCount:0,lateCount:0
    };
  }
  const totalBeats = beats.length;
  const hitBeats = beats.filter(b=>b.hit && b.quality!=='miss');
  const hits = hitBeats.length;
  const misses = beats.filter(b=>b.missed || b.quality==='miss').length;

  const rtList = hitBeats.map(b=>b.rt||0).filter(v=>v>0);
  const rtMean = rtList.length ? rtList.reduce((a,b)=>a+b,0)/rtList.length : 0;
  let rtStd=0;
  if (rtList.length>1){
    const m = rtMean;
    const varSum = rtList.reduce((a,b)=>a+Math.pow(b-m,2),0)/(rtList.length-1);
    rtStd = Math.sqrt(varSum);
  }

  const sorted = [...beats].sort((a,b)=>a.beatTime-b.beatTime);
  const ibis=[];
  for (let i=1;i<sorted.length;i++){
    ibis.push(sorted[i].beatTime - sorted[i-1].beatTime);
  }
  const baseIBI = state.baseIBI;
  let ibiErrMeanAbs = 0;
  if (ibis.length){
    const errs = ibis.map(ibi=>Math.abs(ibi-baseIBI));
    ibiErrMeanAbs = errs.reduce((a,b)=>a+b,0)/errs.length;
  }
  let tempoDriftMs = 0;
  if (sorted.length>1){
    const totalSpan = sorted[sorted.length-1].beatTime - sorted[0].beatTime;
    const expected = baseIBI*(sorted.length-1);
    tempoDriftMs = totalSpan - expected;
  }

  let fatigueIndex = 0;
  if (hitBeats.length>=4){
    const n=hitBeats.length;
    const seg=Math.max(1, Math.floor(n*0.25));
    const early=hitBeats.slice(0,seg).map(b=>b.rt);
    const late=hitBeats.slice(-seg).map(b=>b.rt);
    const meanE = early.reduce((a,b)=>a+b,0)/early.length;
    const meanL = late.reduce((a,b)=>a+b,0)/late.length;
    if (meanE>0) fatigueIndex = (meanL-meanE)/meanE;
  }

  const spatialCorrect = state.spatialCorrect;
  const spatialWrong   = state.spatialWrong + state.spatialEmptyTaps;
  const spatialTotal   = spatialCorrect + spatialWrong;
  const spatialAccuracy = spatialTotal ? spatialCorrect/spatialTotal : 0;

  const accuracy = totalBeats ? hits/totalBeats : 0;

  return {
    totalSpawns:totalBeats,
    totalHits:hits,
    expiredMisses:misses,
    accuracy,
    rtMean,rtStd,
    ibiErrorMeanAbsMs:ibiErrMeanAbs,
    tempoDriftMs,
    fatigueIndex,
    spatialAccuracy,
    spatialCorrect,
    spatialWrong,
    spatialEmptyTaps:state.spatialEmptyTaps,
    perfectCount:state.perfectCount,
    goodCount:state.goodCount,
    lateCount:state.lateCount
  };
}

function saveCalibrationFromAnalytics(analytics){
  if (!sessionMeta) return;
  const rtMean = analytics.rtMean || 0;
  const rtStd  = analytics.rtStd  || 0;
  if (!rtMean || !analytics.totalHits) return;

  let perfectMs = rtMean - 0.5*rtStd;
  let goodMs    = rtMean + 0.5*rtStd;
  let lateMs    = rtMean + 1.0*rtStd;

  perfectMs = Math.max(120, perfectMs);
  if (goodMs<=perfectMs) goodMs = perfectMs+40;
  if (lateMs<=goodMs)    lateMs = goodMs+40;

  const data = {
    perfectMs,goodMs,lateMs,
    rtMean,rtStd,
    n: analytics.totalHits||0,
    ts: Date.now()
  };
  saveCalibration(sessionMeta.playerId, sessionMeta.difficulty, data);
}

/* -------- Stop & Result -------- */
function stopGame(endedBy){
  if (!state) return;
  if (rafId!=null){
    cancelAnimationFrame(rafId);
    rafId=null;
  }
  const analytics = computeAnalytics();

  const summary = {
    mode: sessionMeta?.mode || gameMode,
    difficulty: state.diffKey,
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: analytics.totalHits,
    accuracy: analytics.accuracy,
    avgReactionMs: analytics.rtMean,
    rtStdMs: analytics.rtStd,
    tempoDriftMs: analytics.tempoDriftMs,
    fatigueIndex: analytics.fatigueIndex,
    spatialAccuracy: analytics.spatialAccuracy
  };

  logger?.finish({
    endedBy,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    elapsedMs: state.elapsed,
    analytics
  });

  if (sessionMeta?.mode==='calibration'){
    saveCalibrationFromAnalytics(analytics);
  }

  recordSession('rhythm-boxer', summary);

  fillResultView(endedBy, analytics);
  state = null;
  showView('result');
}

function fillResultView(endedBy, a){
  if (!sessionMeta) return;
  const modeLabel =
    sessionMeta.mode==='research' ? 'Research' :
    sessionMeta.mode==='calibration' ? 'Calibration' :
    'Play';

  resMode.textContent      = modeLabel;
  resDiff.textContent      = sessionMeta.difficulty || '-';
  resTempo.textContent     = sessionMeta.tempoMode || '-';
  resBpm.textContent       = String(sessionMeta.baseBpm || '-');
  resEnd.textContent       = mapEndReason(endedBy);

  resScore.textContent     = String(state ? state.score : 0);
  resMaxCombo.textContent  = String(state ? state.maxCombo : 0);
  resHits.textContent      = String(a.totalHits || 0);
  resMiss.textContent      = String(state ? state.missCount : 0);
  resAcc.textContent       = fmtPercent(a.accuracy || 0);

  resPerf.textContent      = String(a.perfectCount || 0);
  resGood.textContent      = String(a.goodCount || 0);
  resLate.textContent      = String(a.lateCount || 0);

  resRTMean.textContent    = fmtMs(a.rtMean || 0);
  resRTSD.textContent      = fmtMs(a.rtStd  || 0);
  resIBI.textContent       = fmtMs(a.ibiErrorMeanAbsMs || 0);
  resDrift.textContent     = fmtMs(a.tempoDriftMs || 0);
  resFatigue.textContent   = fmtFloat(a.fatigueIndex || 0,3);

  resSpatial.textContent   = fmtPercent(a.spatialAccuracy || 0);
  resSpatialOK.textContent = String(a.spatialCorrect || 0);
  resSpatialBad.textContent= String(a.spatialWrong   || 0);
}

/* -------- Init & Events -------- */
function init(){
  // menu buttons
  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    pendingResearch = null;
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $('[data-action="goto-calib"]')?.addEventListener('click',()=>{
    showView('calib');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  // research start
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    pendingResearch = {
      id:   $('#researchId')?.value.trim()   || '',
      group:$('#researchGroup')?.value.trim()|| '',
      phase:$('#researchPhase')?.value.trim()|| ''
    };
    if (!pendingResearch.id) pendingResearch.id = 'anon';
    startGame('research');
  });

  // calibration start
  $('[data-action="start-calib"]')?.addEventListener('click',()=>{
    const pid = $('#calibId')?.value.trim() || 'anon';
    pendingResearch = { id:pid, group:'', phase:'calibration' };
    startGame('calibration');
  });

  // stop
  $('[data-action="stop"]')?.addEventListener('click',()=>{
    if (state) stopGame('manual');
  });

  // result buttons
  $('[data-action="play-again"]')?.addEventListener('click',()=>{
    showView('menu');
  });

  // pad input
  $$('#padWrap .pad').forEach(pad=>{
    pad.addEventListener('pointerdown', ev=>{
      ev.preventDefault();
      const idx = parseInt(pad.getAttribute('data-pad') || '0',10);
      handlePadTap(idx, ev);
    }, {passive:false});
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);