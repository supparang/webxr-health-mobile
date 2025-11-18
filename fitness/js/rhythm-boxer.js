// fitness/js/rhythm-boxer.js
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// DOM refs
const viewMenu   = $('#menu');
const viewPlay   = $('#play');
const viewResult = $('#result');

const elMode   = $('#stat-mode');
const elDiff   = $('#stat-diff');
const elTempo  = $('#stat-tempo');
const elScore  = $('#stat-score');
const elCombo  = $('#stat-combo');
const elMiss   = $('#stat-miss');
const elTime   = $('#stat-time');

const playArea   = $('#playArea');
const padGrid    = $('#padGrid');
const judgeLabel = $('#judgeLabel');
const feverFill  = $('#feverFill');
const feverStatus= $('#feverStatus');

// Coach
const coachBubble = $('#coachBubble');
const coachAvatar = $('#coachAvatar');
const coachRole   = $('#coachRole');
const coachText   = $('#coachText');

// Result refs
const elResMode        = $('#res-mode');
const elResDiff        = $('#res-diff');
const elResTempoMode   = $('#res-tempo-mode');
const elResBpm         = $('#res-bpm');
const elResEndReason   = $('#res-endreason');
const elResScore       = $('#res-score');
const elResMaxCombo    = $('#res-maxcombo');
const elResMiss        = $('#res-miss');
const elResTotalHits   = $('#res-totalhits');
const elResPerfect     = $('#res-perfect');
const elResGood        = $('#res-good');
const elResLate        = $('#res-late');
const elResAccuracy    = $('#res-accuracy');
const elResRTMean      = $('#res-rt-mean');
const elResRTSD        = $('#res-rt-sd');
const elResIBIErr      = $('#res-ibi-err');
const elResTempoDrift  = $('#res-tempo-drift');
const elResFatigue     = $('#res-fatigue');
const elResSpatial     = $('#res-spatial');
const elResSpatialOK   = $('#res-spatial-correct');
const elResSpatialBad  = $('#res-spatial-wrong');

// Config
const GAME_DURATION_MS = 60000;

// difficulty → base BPM + default judgement windows
const DIFF_CONFIG = {
  easy: {
    bpm: 100,
    perfectMs: 180,
    goodMs:    260,
    lateMs:    340
  },
  normal: {
    bpm: 130,
    perfectMs: 150,
    goodMs:    230,
    lateMs:    300
  },
  hard: {
    bpm: 160,
    perfectMs: 130,
    goodMs:    200,
    lateMs:    260
  }
};

// Calibration storage
const CALIB_KEY_PREFIX = 'rboxer_calib_v1_';

function calibKey(playerId, diffKey){
  return CALIB_KEY_PREFIX + (playerId || 'anon') + '_' + (diffKey || 'normal');
}
function saveCalibration(playerId, diffKey, data){
  try{
    localStorage.setItem(calibKey(playerId,diffKey), JSON.stringify(data));
  }catch(e){}
}
function loadCalibration(playerId, diffKey){
  try{
    const raw = localStorage.getItem(calibKey(playerId,diffKey));
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

let mode = 'normal';  // 'normal' | 'research' | 'calibration'
let state = null;
let logger = null;
let rafId = null;
let sessionMeta = null;

// simple SFX hooks (optional)
const SFX = (() => {
  function make(path){
    try{
      const a = new Audio(path);
      a.volume = 0.5;
      return a;
    }catch(e){ return null; }
  }
  const tap   = make('./sfx/tap.mp3');
  const good  = make('./sfx/good.mp3');
  const perf  = make('./sfx/perfect.mp3');
  const miss  = make('./sfx/miss.mp3');
  return {
    tap:()=> tap && tap.play().catch(()=>{}),
    good:()=> good && good.play().catch(()=>{}),
    perfect:()=> perf && perf.play().catch(()=>{}),
    miss:()=> miss && miss.play().catch(()=>{})
  };
})();

// Coach system
const COACH_LINES = {
  kids: {
    welcome:    'พร้อมลุยจังหวะแล้ว! ดูแผ่นที่สว่างแล้วตีตามเลย 🎵',
    comboHigh:  'โห คอมโบยาวมาก! อย่าลืมหายใจลึก ๆ ด้วยนะ 💨',
    feverOn:    'FEVER แล้ว! ตีให้มันส์แต่ยังต้องเล็งดี ๆ นะ ✨',
    missSoft:   'พลาดไปนิด ไม่เป็นไร รอบหน้าค่อย ๆ เล็งใหม่ 👍',
    spatialBad: 'ตีผิดแผ่นบ่อย ลองโฟกัสตำแหน่งให้ชัดขึ้นนิดนึง 👀'
  },
  research: {
    welcome:    'โหมดวิจัย: โฟกัสความสม่ำเสมอของจังหวะและการตอบสนองครับ 🧪',
    comboHigh:  'คอมโบต่อเนื่องดีมาก แสดงว่าควบคุมจังหวะได้เสถียรครับ 📈',
    feverOn:    'ช่วง FEVER: สังเกตว่าการตอบสนองเร็วขึ้นแต่ยังแม่นหรือไม่ครับ 💡',
    missSoft:   'มี miss เพิ่มขึ้นเล็กน้อย ลองชะลอให้ตรงจังหวะมากกว่าตีนำครับ 👂',
    spatialBad: 'เกิด spatial error บ่อย แนะนำโฟกัสตำแหน่งเป้ามากกว่าแค่จังหวะครับ 🎯'
  }
};
const COACH_COOLDOWN_MS = 4500;
let lastCoachAt = 0;
let lastCoachSnapshot = null;

// helpers
function showView(which){
  [viewMenu, viewPlay, viewResult].forEach(el => el.classList.add('hidden'));
  if (which === 'menu')   viewMenu.classList.remove('hidden');
  if (which === 'play')   viewPlay.classList.remove('hidden');
  if (which === 'result') viewResult.classList.remove('hidden');
}
function mapEndReason(code){
  switch(code){
    case 'timeout': return 'เล่นครบเวลา';
    case 'manual':  return 'หยุดเองจากผู้เล่น';
    default:        return code || '-';
  }
}
function fmtPercent(val){
  if (val == null || Number.isNaN(val)) return '-';
  return (val * 100).toFixed(1) + ' %';
}
function fmtMs(val){
  if (!val || val <= 0) return '-';
  return val.toFixed(0) + ' ms';
}
function fmtFloat(val, digits){
  if (val == null || Number.isNaN(val)) return '-';
  return val.toFixed(digits ?? 2);
}

// judge label
let judgeTimer = null;
function showJudge(text, kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text.toUpperCase();
  judgeLabel.className = 'judge-label show';
  if (kind) judgeLabel.classList.add('judge-'+kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{
    judgeLabel.classList.remove('show');
  }, 380);
}

// FEVER / background
function updateFeverVisual(){
  if (!state || !feverFill || !feverStatus || !playArea) return;
  const charge = Math.max(0, Math.min(100, state.feverCharge));
  feverFill.style.width = charge + '%';

  if (state.feverActive){
    feverStatus.textContent = 'FEVER!!';
    feverStatus.classList.add('active');
    playArea.classList.add('hot');
  }else if (charge >= 90){
    feverStatus.textContent = 'READY';
    feverStatus.classList.remove('active');
    playArea.classList.add('hot');
  }else{
    feverStatus.textContent = 'FEVER';
    feverStatus.classList.remove('active');
    playArea.classList.remove('hot');
  }
}

// Coach helpers
function coachPersona(){
  return (mode === 'research' || mode === 'calibration') ? 'research' : 'kids';
}
function showCoachLine(key){
  if (!coachBubble || !coachText || !coachAvatar || !coachRole) return;
  const now = performance.now();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  lastCoachAt = now;

  const persona = coachPersona();
  const set = COACH_LINES[persona];
  const text = set[key];
  if (!text) return;

  coachText.textContent = text;
  if (persona === 'research'){
    coachAvatar.textContent = '🧑‍🔬';
    coachRole.textContent   = 'Research Rhythm Coach';
  }else{
    coachAvatar.textContent = '🥊';
    coachRole.textContent   = 'Rhythm Coach';
  }
  coachBubble.classList.add('visible');

  setTimeout(()=> coachBubble && coachBubble.classList.remove('visible'), 3800);
}
function updateCoach(now){
  if (!state) return;
  const snap = {
    combo: state.combo,
    miss: state.missCount,
    fever: state.feverActive,
    elapsed: state.elapsed,
    spatialWrong: state.spatialWrong + state.spatialEmptyTaps
  };
  if (!lastCoachSnapshot){
    showCoachLine('welcome');
    lastCoachSnapshot = snap;
    return;
  }

  const prev = lastCoachSnapshot;

  if (!prev.fever && snap.fever){
    showCoachLine('feverOn');
    lastCoachSnapshot = snap;
    return;
  }

  if (snap.combo >= 10 && prev.combo < 10){
    showCoachLine('comboHigh');
    lastCoachSnapshot = snap;
    return;
  }

  if (snap.miss > prev.miss){
    showCoachLine('missSoft');
    lastCoachSnapshot = snap;
    return;
  }

  if (snap.spatialWrong >= 5 && prev.spatialWrong < 5){
    showCoachLine('spatialBad');
    lastCoachSnapshot = snap;
    return;
  }

  lastCoachSnapshot = snap;
}

// session meta
function buildSessionMeta(diffKey, tempoMode, isCalibration){
  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const baseBpm = diffCfg.bpm;

  let participant = '';
  let phase = '';

  if (isCalibration || mode === 'research'){
    participant = (prompt('Participant ID (เว้นว่างได้):') || '').trim();
    phase       = isCalibration ? 'calibration' : (prompt('Phase (เช่น pre-test / post-test):') || '').trim();
  } else {
    participant = `RBOX-${Date.now()}`;
  }

  const m = isCalibration ? 'calibration' : mode;

  return {
    gameId: 'rhythm-boxer',
    playerId: participant || 'anon',
    mode: m,
    difficulty: diffKey,
    phase,
    tempoMode,
    baseBpm,
    filePrefix: 'vrfitness_rhythm'
  };
}

// game flow
function startGame(startKind){
  const isCalibration = (startKind === 'calib');
  mode = isCalibration ? 'calibration' :
         (startKind === 'research' ? 'research' : 'normal');

  const diffKey   = $('#difficulty')?.value || 'normal';
  const tempoMode = $('#tempoMode')?.value || 'fixed';
  sessionMeta = buildSessionMeta(diffKey, tempoMode, isCalibration);
  logger = createCSVLogger(sessionMeta);

  const baseDiffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const baseBpm   = baseDiffCfg.bpm;
  const baseIBI   = 60000 / baseBpm;

  const calib = loadCalibration(sessionMeta.playerId, diffKey);
  const judgeCfg = {
    perfectMs: baseDiffCfg.perfectMs,
    goodMs:    baseDiffCfg.goodMs,
    lateMs:    baseDiffCfg.lateMs
  };
  if (calib){
    judgeCfg.perfectMs = calib.perfectMs || judgeCfg.perfectMs;
    judgeCfg.goodMs    = calib.goodMs    || judgeCfg.goodMs;
    judgeCfg.lateMs    = calib.lateMs    || judgeCfg.lateMs;
  }

  state = {
    diffKey,
    tempoMode,
    baseBpm,
    baseIBI,
    judge: judgeCfg,

    startTime: performance.now(),
    elapsed: 0,
    nextBeatAt: performance.now() + (isCalibration ? 400 : 600),
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
    spatialEmptyTaps: 0,

    lastPadTapAt: null
  };

  let modeLabel = 'Normal';
  if (mode === 'research') modeLabel = 'Research';
  if (mode === 'calibration') modeLabel = 'Calibration';

  if (elMode)  elMode.textContent  = modeLabel;
  if (elDiff)  elDiff.textContent  = diffKey;
  if (elTempo) elTempo.textContent = String(baseBpm);

  elScore.textContent = '0';
  elCombo.textContent = '0';
  elMiss.textContent  = '0';
  elTime.textContent  = (GAME_DURATION_MS/1000).toFixed(1);

  $$('#padGrid .pad').forEach(p=>{
    p.classList.remove('pad-active','pad-hit');
  });
  if (coachBubble) coachBubble.classList.remove('visible');
  lastCoachSnapshot = null;
  lastCoachAt = 0;

  showView('play');
  updateFeverVisual();
  rafId = requestAnimationFrame(loop);
}

function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const analytics = computeAnalytics();
  const acc = analytics.accuracy || 0;

  const finalState = {
    endedBy,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    elapsedMs: state.elapsed,
    playerHP: 0,
    bossIndex: '',
    analytics
  };

  if (logger) logger.finish(finalState);

  if (sessionMeta && sessionMeta.mode === 'calibration'){
    saveCalibrationFromAnalytics(analytics);
  }

  recordSession('rhythm-boxer', {
    mode: sessionMeta?.mode || mode,
    difficulty: state.diffKey,
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: analytics.totalHits ?? 0,
    accuracy: acc,
    avgReactionMs: analytics.rtMean || 0,
    rtStdMs: analytics.rtStd || 0,
    tempoDriftMs: analytics.tempoDriftMs || 0,
    fatigueIndex: analytics.fatigueIndex || 0,
    spatialAccuracy: analytics.spatialAccuracy || 0
  });

  fillResultView(endedBy, analytics);
  state = null;
  showView('result');
}

// main loop
function loop(now){
  if (!state) return;

  state.elapsed = now - state.startTime;

  const remaining = Math.max(0, GAME_DURATION_MS - state.elapsed);
  elTime.textContent = (remaining/1000).toFixed(1);
  if (state.elapsed >= GAME_DURATION_MS){
    stopGame('timeout');
    return;
  }

  const dtSec = 16/1000;
  if (!state.feverActive){
    state.feverCharge = Math.max(0, state.feverCharge - 5 * dtSec);
  }else if (now >= state.feverUntil){
    state.feverActive = false;
  }
  updateFeverVisual();

  while (now >= state.nextBeatAt){
    spawnBeat(state.nextBeatAt);
    const interval = computeNextInterval();
    state.nextBeatAt += interval;
  }

  const judge = state.judge || (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal);
  const missWindow = judge.lateMs + 160;
  for (const beat of state.beats){
    if (!beat.hit && !beat.missed && now >= beat.beatTime + missWindow){
      beat.missed = true;
      state.missCount++;
      state.combo = 0;
      elMiss.textContent = String(state.missCount);
      showJudge('MISS','miss');
      SFX.miss();
      if (playArea) playArea.classList.add('shake');
      setTimeout(()=> playArea && playArea.classList.remove('shake'), 140);

      if (logger){
        logger.logExpire({
          id: beat.id,
          type: 'beat',
          t: now,
          playerHP:'',
          bossIndex:'',
          bossHP:'',
          bossPhase:'',
          result:'miss'
        });
      }
    }
  }

  updateCoach(now);
  rafId = requestAnimationFrame(loop);
}

// tempo interval
function computeNextInterval(){
  const base = state.baseIBI;
  const tMode = state.tempoMode;
  const n = state.beats.length;

  if (tMode === 'fixed') return base;

  if (tMode === 'ramp'){
    const step = Math.floor(n / 8);
    const factor = Math.max(0.6, 1 - step * 0.03);
    return base * factor;
  }

  if (tMode === 'random'){
    const r = 0.8 + Math.random()*0.4;
    return base * r;
  }

  return base;
}

// beats & input
function spawnBeat(beatTime){
  const padCount = 4;
  const padIndex = Math.floor(Math.random()*padCount);

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

  const pad = padGrid?.querySelector(`.pad[data-pad="${padIndex}"]`);
  if (pad){
    pad.classList.add('pad-active');
    setTimeout(()=> pad.classList.remove('pad-active'), 220);
  }

  if (logger){
    logger.logSpawn({
      id: beat.id,
      type: 'beat',
      t: beatTime,
      x: padIndex,
      y: 0,
      bossIndex:'',
      bossHP:'',
      bossPhase:''
    });
  }
}

function handlePadTap(padIndex){
  if (!state) return;
  const now = performance.now();
  state.lastPadTapAt = now;

  const judge = state.judge || (DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal);
  const maxWindow = judge.lateMs;
  let best = null;
  let bestDt = Infinity;

  for (const beat of state.beats){
    if (beat.hit || beat.missed) continue;
    const dt = Math.abs(now - beat.beatTime);
    if (dt <= maxWindow && dt < bestDt){
      best = beat;
      bestDt = dt;
    }
  }

  const padEl = padGrid?.querySelector(`.pad[data-pad="${padIndex}"]`);
  if (padEl){
    padEl.classList.add('pad-hit');
    setTimeout(()=> padEl.classList.remove('pad-hit'), 120);
  }

  if (!best){
    state.spatialEmptyTaps++;
    showJudge('MISS','miss');
    SFX.miss();
    if (playArea) playArea.classList.add('shake');
    setTimeout(()=> playArea && playArea.classList.remove('shake'), 140);
    return;
  }

  best.hit = true;
  best.hitTime = now;
  const rt = Math.abs(now - best.beatTime);
  best.rt = rt;
  const spatialHit = (padIndex === best.pad);
  best.spatialHit = spatialHit;

  const isPerfect = rt <= judge.perfectMs;
  const isGood    = !isPerfect && rt <= judge.goodMs;
  const isLate    = !isPerfect && !isGood && rt <= judge.lateMs;

  let quality = 'late';
  let scoreGain = 0;

  if (isPerfect){
    quality = 'perfect';
    scoreGain = 15;
    state.feverCharge += 8;
    state.perfectCount++;
    showJudge('Perfect','perfect');
    SFX.perfect();
  }else if (isGood){
    quality = 'good';
    scoreGain = 9;
    state.feverCharge += 5;
    state.goodCount++;
    showJudge('Good','good');
    SFX.good();
  }else if (isLate){
    quality = 'late';
    scoreGain = 4;
    state.feverCharge += 2;
    state.lateCount++;
    showJudge('Late','late');
    SFX.tap();
  }else{
    quality = 'miss';
    scoreGain = 0;
    state.missCount++;
    state.combo = 0;
    elMiss.textContent = String(state.missCount);
    showJudge('MISS','miss');
    SFX.miss();
    if (playArea) playArea.classList.add('shake');
    setTimeout(()=> playArea && playArea.classList.remove('shake'), 140);
  }
  best.quality = quality;

  if (spatialHit){
    state.spatialCorrect++;
  }else{
    state.spatialWrong++;
    showJudge('WRONG PAD','wrong');
  }

  if (quality === 'perfect' || quality === 'good' || quality === 'late'){
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  }else{
    state.combo = 0;
  }

  if (!state.feverActive && state.feverCharge >= 100){
    state.feverActive = true;
    state.feverUntil  = now + 5000;
  }
  const multiplier = state.feverActive ? 2 : 1;
  state.score += scoreGain * multiplier;

  elScore.textContent = String(state.score);
  elCombo.textContent = String(state.combo);
  elMiss.textContent  = String(state.missCount);

  updateFeverVisual();

  if (logger){
    logger.logHit({
      id: best.id,
      type:'beat',
      result:quality,
      score: state.score,
      combo: state.combo,
      missCount: state.missCount,
      playerHP:'',
      t: now,
      reactionMs: rt,
      bossIndex:'',
      bossHP:'',
      bossPhase:'',
      feverActive: state.feverActive,
      extra:{
        padTarget: best.pad,
        padClick: padIndex,
        spatialHit,
        tempoMode: state.tempoMode
      }
    });
  }
}

// analytics
function computeAnalytics(){
  const beats = state ? state.beats : [];
  if (!beats || !beats.length){
    return {
      totalSpawns:0,totalHits:0,normalHits:0,decoyHits:0,expiredMisses:0,
      accuracy:0,avgReactionNormal:0,avgReactionDecoy:0,
      rtMean:0,rtStd:0,rtList:[]
    };
  }

  const totalBeats = beats.length;
  const hitBeats   = beats.filter(b=>b.hit && b.quality !== 'miss');
  const hits       = hitBeats.length;
  const misses     = beats.filter(b=>b.missed || b.quality === 'miss').length;

  const rtList = hitBeats.map(b => b.rt ?? 0).filter(v => v>0);
  const rtMean = rtList.length ? rtList.reduce((a,b)=>a+b,0)/rtList.length : 0;
  let rtStd = 0;
  if (rtList.length>1){
    const m = rtMean;
    const varSum = rtList.reduce((a,b)=>a+Math.pow(b-m,2),0)/ (rtList.length-1);
    rtStd = Math.sqrt(varSum);
  }

  const sorted = [...beats].sort((a,b)=>a.beatTime-b.beatTime);
  const ibis = [];
  for (let i=1;i<sorted.length;i++){
    ibis.push(sorted[i].beatTime - sorted[i-1].beatTime);
  }
  const baseIBI = state.baseIBI;
  let ibiErrMeanAbs = 0;
  if (ibis.length){
    const errs = ibis.map(ibi => Math.abs(ibi - baseIBI));
    ibiErrMeanAbs = errs.reduce((a,b)=>a+b,0)/errs.length;
  }
  let tempoDriftMs = 0;
  if (sorted.length>1){
    const totalSpan = sorted[sorted.length-1].beatTime - sorted[0].beatTime;
    const expectedSpan = baseIBI * (sorted.length-1);
    tempoDriftMs = totalSpan - expectedSpan;
  }

  let fatigueIndex = 0;
  if (hitBeats.length>=4){
    const n = hitBeats.length;
    const seg = Math.max(1, Math.floor(n*0.25));
    const early = hitBeats.slice(0,seg).map(b=>b.rt);
    const late  = hitBeats.slice(-seg).map(b=>b.rt);
    const meanE = early.reduce((a,b)=>a+b,0)/early.length;
    const meanL = late.reduce((a,b)=>a+b,0)/late.length;
    if (meanE>0){
      fatigueIndex = (meanL - meanE)/meanE;
    }
  }

  const normStd = rtStd / (rtMean || 1);
  const consistencyScore = 1 / (1 + normStd);

  const spatialCorrect = state.spatialCorrect;
  const spatialWrong   = state.spatialWrong + state.spatialEmptyTaps;
  const spatialTotal   = spatialCorrect + spatialWrong;
  const spatialAccuracy = spatialTotal ? spatialCorrect/spatialTotal : 0;

  const accuracy = totalBeats ? hits/totalBeats : 0;

  return {
    totalSpawns: totalBeats,
    totalHits: hits,
    normalHits: hits,
    decoyHits: 0,
    expiredMisses: misses,
    accuracy,
    avgReactionNormal: rtMean,
    avgReactionDecoy: 0,

    rtMean,
    rtStd,
    rtList,
    ibiErrorMeanAbsMs: ibiErrMeanAbs,
    tempoDriftMs,
    tempoMode: state.tempoMode,
    fatigueIndex,
    consistencyScore,
    spatialAccuracy,
    spatialCorrect,
    spatialWrong,
    spatialEmptyTaps: state.spatialEmptyTaps,

    perfectCount: state.perfectCount,
    goodCount: state.goodCount,
    lateCount: state.lateCount
  };
}

// calibration save
function saveCalibrationFromAnalytics(analytics){
  if (!sessionMeta) return;
  const rtMean = analytics.rtMean || 0;
  const rtStd  = analytics.rtStd || 0;
  if (!rtMean || !analytics.totalHits) return;

  let perfectMs = rtMean - 0.5*rtStd;
  let goodMs    = rtMean + 0.5*rtStd;
  let lateMs    = rtMean + 1.0*rtStd;

  perfectMs = Math.max(120, perfectMs);
  if (goodMs <= perfectMs) goodMs = perfectMs + 40;
  if (lateMs <= goodMs)    lateMs = goodMs + 40;

  const data = {
    perfectMs,
    goodMs,
    lateMs,
    rtMean,
    rtStd,
    n: analytics.totalHits || 0,
    ts: Date.now()
  };
  saveCalibration(sessionMeta.playerId, sessionMeta.difficulty, data);
}

// fill result
function fillResultView(endedBy, analytics){
  if (!sessionMeta) return;

  const acc = analytics.accuracy || 0;

  const modeLabel =
    sessionMeta.mode === 'research' ? 'โหมดวิจัย' :
    sessionMeta.mode === 'calibration' ? 'โหมด Calibration' :
    'โหมดเล่นปกติ';

  elResMode.textContent      = modeLabel;
  elResDiff.textContent      = sessionMeta.difficulty || '-';
  elResTempoMode.textContent = sessionMeta.tempoMode || '-';
  elResBpm.textContent       = String(sessionMeta.baseBpm || '-');
  elResEndReason.textContent = mapEndReason(endedBy);

  elResScore.textContent     = '0';
  elResMaxCombo.textContent  = '0';
  elResMiss.textContent      = '0';

  elResScore.textContent     = String(state ? state.score : 0);
  elResMaxCombo.textContent  = String(state ? state.maxCombo : 0);
  elResMiss.textContent      = String(state ? state.missCount : 0);
  elResTotalHits.textContent = String(analytics.totalHits ?? 0);
  elResPerfect.textContent   = String(analytics.perfectCount ?? 0);
  elResGood.textContent      = String(analytics.goodCount ?? 0);
  elResLate.textContent      = String(analytics.lateCount ?? 0);
  elResAccuracy.textContent  = fmtPercent(acc);

  elResRTMean.textContent    = fmtMs(analytics.rtMean || 0);
  elResRTSD.textContent      = fmtMs(analytics.rtStd || 0);
  elResIBIErr.textContent    = fmtMs(analytics.ibiErrorMeanAbsMs || 0);
  elResTempoDrift.textContent= fmtMs(analytics.tempoDriftMs || 0);
  elResFatigue.textContent   = fmtFloat(analytics.fatigueIndex || 0, 3);

  elResSpatial.textContent   = fmtPercent(analytics.spatialAccuracy || 0);
  elResSpatialOK.textContent = String(analytics.spatialCorrect ?? 0);
  elResSpatialBad.textContent= String(analytics.spatialWrong ?? 0);
}

// init
function init(){
  $$('[data-start]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const kind = btn.getAttribute('data-start') || 'normal';
      startGame(kind);
    });
  });

  $('[data-stop]')?.addEventListener('click', ()=>{
    if (state) stopGame('manual');
  });

  $('[data-retry]')?.addEventListener('click', ()=>{
    showView('menu');
  });

  $('[data-download]')?.addEventListener('click', ()=>{
    alert('ไฟล์ CSV จะถูกดาวน์โหลดทุกครั้งเมื่อจบรอบเล่นแล้ว');
  });

  $$('#padGrid .pad').forEach(pad=>{
    pad.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      const idx = parseInt(pad.getAttribute('data-pad') || '0',10);
      handlePadTap(idx);
    }, { passive:false });
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);