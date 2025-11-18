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

// difficulty → base BPM + judgement windows
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

let mode = 'normal';  // 'normal' or 'research'
let state = null;
let logger = null;
let rafId = null;
let sessionMeta = null;

// simple SFX hooks (ผู้ใช้เตรียมไฟล์เองถ้าต้องการ)
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

// ---------- helpers ----------

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

// ---------- judge label ----------

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

// ---------- FEVER / background ----------

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

// ---------- session meta ----------

function buildSessionMeta(diffKey, tempoMode){
  const diffCfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const baseBpm = diffCfg.bpm;

  let participant = '';
  let phase = '';
  if (mode === 'research'){
    participant = (prompt('Participant ID (เว้นว่างได้):') || '').trim();
    phase       = (prompt('Phase (เช่น pre-test / post-test):') || '').trim();
  } else {
    participant = `RBOX-${Date.now()}`;
  }

  return {
    gameId: 'rhythm-boxer',
    playerId: participant || 'anon',
    mode,
    difficulty: diffKey,
    phase,
    tempoMode,
    baseBpm,
    filePrefix: 'vrfitness_rhythm'
  };
}

// ---------- game flow ----------

function startGame(selectedMode){
  mode = selectedMode;
  const diffKey   = $('#difficulty')?.value || 'normal';
  const tempoMode = $('#tempoMode')?.value || 'fixed';
  sessionMeta = buildSessionMeta(diffKey, tempoMode);
  logger = createCSVLogger(sessionMeta);

  const diffCfg   = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  const baseBpm   = diffCfg.bpm;
  const baseIBI   = 60000 / baseBpm;

  state = {
    diffKey,
    tempoMode,
    baseBpm,
    baseIBI,
    startTime: performance.now(),
    elapsed: 0,
    nextBeatAt: performance.now() + 600,
    lastBeatTime: null,

    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,

    beats: [],      // {id,pad,beatTime,hit,hitTime,rt,quality,spatialHit}
    nextBeatId: 1,

    feverCharge: 0,
    feverActive: false,
    feverUntil: 0,

    // spatial
    spatialCorrect: 0,
    spatialWrong: 0,    // wrong pad but in window
    spatialEmptyTaps: 0,// pad taps whereไม่มี beatใน window

    // input log สำหรับวิเคราะห์เพิ่มเติมภายหลัง
    lastPadTapAt: null
  };

  if (elMode)  elMode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
  if (elDiff)  elDiff.textContent  = diffKey;
  if (elTempo) elTempo.textContent = String(baseBpm);

  elScore.textContent = '0';
  elCombo.textContent = '0';
  elMiss.textContent  = '0';
  elTime.textContent  = (GAME_DURATION_MS/1000).toFixed(1);

  // reset pads
  $$('#padGrid .pad').forEach(p=>{
    p.classList.remove('pad-active','pad-hit');
  });

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

  // save to dashboard
  recordSession('rhythm-boxer', {
    mode,
    difficulty: state.diffKey,
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: analytics.totalHits ?? 0,
    accuracy: acc,
    avgReactionMs: analytics.avgReactionNormal || analytics.rtMean || 0,
    rtStdMs: analytics.rtStd || 0,
    tempoDriftMs: analytics.tempoDriftMs || 0,
    fatigueIndex: analytics.fatigueIndex || 0,
    spatialAccuracy: analytics.spatialAccuracy || 0
  });

  fillResultView(endedBy, analytics);
  state = null;
  showView('result');
}

// ---------- main loop ----------

function loop(now){
  if (!state) return;

  const diffCfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  state.elapsed = now - state.startTime;

  // time
  const remaining = Math.max(0, GAME_DURATION_MS - state.elapsed);
  elTime.textContent = (remaining/1000).toFixed(1);
  if (state.elapsed >= GAME_DURATION_MS){
    stopGame('timeout');
    return;
  }

  // FEVER decay
  const dtSec = 16/1000;
  if (!state.feverActive){
    state.feverCharge = Math.max(0, state.feverCharge - 5 * dtSec); // decay ~5/s
  }else if (now >= state.feverUntil){
    state.feverActive = false;
  }
  updateFeverVisual();

  // spawn beats
  while (now >= state.nextBeatAt){
    spawnBeat(state.nextBeatAt);
    const interval = computeNextInterval();
    state.nextBeatAt += interval;
  }

  // miss check
  const missWindow = diffCfg.lateMs + 160;
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

      // log miss event
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

  rafId = requestAnimationFrame(loop);
}

// compute next interval based on tempoMode
function computeNextInterval(){
  const base = state.baseIBI;
  const tMode = state.tempoMode;
  const n = state.beats.length;

  if (tMode === 'fixed') return base;

  if (tMode === 'ramp'){
    // เพิ่ม BPM ทีละหน่อย: ลด IBI ทีละ ~3% ทุก 8 beat
    const step = Math.floor(n / 8);
    const factor = Math.max(0.6, 1 - step * 0.03);
    return base * factor;
  }

  if (tMode === 'random'){
    const r = 0.8 + Math.random()*0.4; // 0.8–1.2
    return base * r;
  }

  return base;
}

// ---------- beats & input ----------

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

  // visual highlight
  const pad = padGrid?.querySelector(`.pad[data-pad="${padIndex}"]`);
  if (pad){
    pad.classList.add('pad-active');
    setTimeout(()=> pad.classList.remove('pad-active'), 220);
  }

  // log spawn
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

// handle pad tap
function handlePadTap(padIndex){
  if (!state) return;
  const now = performance.now();
  state.lastPadTapAt = now;

  // find nearest beat within window
  const diffCfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const maxWindow = diffCfg.lateMs;
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
    // tap นอกหน้าต่างจังหวะ: spatial empty tap
    state.spatialEmptyTaps++;
    showJudge('MISS','miss');
    SFX.miss();
    if (playArea) playArea.classList.add('shake');
    setTimeout(()=> playArea && playArea.classList.remove('shake'), 140);
    return;
  }

  // hit & spatial check
  best.hit = true;
  best.hitTime = now;
  const rt = Math.abs(now - best.beatTime);
  best.rt = rt;
  const spatialHit = (padIndex === best.pad);
  best.spatialHit = spatialHit;

  const isPerfect = rt <= diffCfg.perfectMs;
  const isGood    = !isPerfect && rt <= diffCfg.goodMs;
  const isLate    = !isPerfect && !isGood && rt <= diffCfg.lateMs;

  let quality = 'late';
  let scoreGain = 0;
  if (isPerfect){
    quality = 'perfect';
    scoreGain = 15;
    state.feverCharge += 8;
    showJudge('Perfect','perfect');
    SFX.perfect();
  }else if (isGood){
    quality = 'good';
    scoreGain = 9;
    state.feverCharge += 5;
    showJudge('Good','good');
    SFX.good();
  }else if (isLate){
    quality = 'late';
    scoreGain = 4;
    state.feverCharge += 2;
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

  // spatial
  if (spatialHit){
    state.spatialCorrect++;
  }else{
    state.spatialWrong++;
    showJudge('WRONG PAD','wrong');
  }

  // combo
  if (quality === 'perfect' || quality === 'good' || quality === 'late'){
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  }else{
    state.combo = 0;
  }

  // FEVER active → score คูณ
  if (!state.feverActive && state.feverCharge >= 100){
    state.feverActive = true;
    state.feverUntil  = now + 5000; // 5s
  }
  const multiplier = state.feverActive ? 2 : 1;
  state.score += scoreGain * multiplier;

  elScore.textContent = String(state.score);
  elCombo.textContent = String(state.combo);
  elMiss.textContent  = String(state.missCount);

  updateFeverVisual();

  // log hit
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

// ---------- analytics ----------

function computeAnalytics(){
  const beats = state ? state.beats : [];
  if (!beats || !beats.length){
    return {
      totalSpawns:0,totalHits:0,normalHits:0,decoyHits:0,expiredMisses:0,
      accuracy:0,avgReactionNormal:0,avgReactionDecoy:0
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

  // IBI
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

  // Fatigue index: RT ช่วงท้าย vs ต้น
  let fatigueIndex = 0;
  if (hitBeats.length>=4){
    const n = hitBeats.length;
    const seg = Math.max(1, Math.floor(n*0.25));
    const early = hitBeats.slice(0,seg).map(b=>b.rt);
    const late  = hitBeats.slice(-seg).map(b=>b.rt);
    const meanE = early.reduce((a,b)=>a+b,0)/early.length;
    const meanL = late.reduce((a,b)=>a+b,0)/late.length;
    if (meanE>0){
      fatigueIndex = (meanL - meanE)/meanE; // >0 = ช้าลง (ล้า)
    }
  }

  // Consistency score (จาก SD)
  const normStd = rtStd / (rtMean || 1);
  const consistencyScore = 1 / (1 + normStd); // 0–1 ยิ่งใกล้ 1 ยิ่งคงที่

  // Spatial
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
    ibiErrorMeanAbsMs: ibiErrMeanAbs,
    tempoDriftMs,
    tempoMode: state.tempoMode,
    fatigueIndex,
    consistencyScore,
    spatialAccuracy,
    spatialCorrect,
    spatialWrong,
    spatialEmptyTaps: state.spatialEmptyTaps
  };
}

// ---------- fill result view ----------

function fillResultView(endedBy, analytics){
  if (!sessionMeta) return;

  const acc = analytics.accuracy || 0;

  elResMode.textContent      = (mode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  elResDiff.textContent      = sessionMeta.difficulty || '-';
  elResTempoMode.textContent = sessionMeta.tempoMode || '-';
  elResBpm.textContent       = String(sessionMeta.baseBpm || '-');
  elResEndReason.textContent = mapEndReason(endedBy);

  elResScore.textContent     = String(state ? state.score : 0);
  elResMaxCombo.textContent  = String(state ? state.maxCombo : 0);
  elResMiss.textContent      = String(state ? state.missCount : 0);
  elResTotalHits.textContent = String(analytics.totalHits ?? 0);
  elResAccuracy.textContent  = fmtPercent(acc);

  elResRTMean.textContent    = fmtMs(analytics.rtMean || 0);
  elResRTSD.textContent      = fmtMs(analytics.rtStd || 0);
  elResIBIErr.textContent    = fmtMs(analytics.ibiErrorMeanAbsMs || 0);
  elResTempoDrift.textContent= fmtMs(analytics.tempoDriftMs || 0);
  elResFatigue.textContent   = fmtFloat(analytics.fatigueIndex || 0, 3);

  elResSpatial.textContent       = fmtPercent(analytics.spatialAccuracy || 0);
  elResSpatialOK.textContent     = String(analytics.spatialCorrect ?? 0);
  elResSpatialBad.textContent    = String(analytics.spatialWrong ?? 0);
}

// ---------- init & wiring ----------

function init(){
  // start buttons
  $$('[data-start]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-start') || 'normal';
      startGame(m);
    });
  });

  // stop
  $('[data-stop]')?.addEventListener('click', ()=>{
    if (state) stopGame('manual');
  });

  // retry
  $('[data-retry]')?.addEventListener('click', ()=>{
    showView('menu');
  });

  // download CSV: logger.finish() โหลดให้ตอนจบแล้ว ปุ่มนี้แค่แจ้งเตือน
  $('[data-download]')?.addEventListener('click', ()=>{
    alert('ไฟล์ CSV จะถูกดาวน์โหลดทุกครั้งเมื่อจบรอบเล่นแล้ว');
  });

  // pad taps
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