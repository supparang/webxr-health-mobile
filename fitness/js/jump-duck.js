// === fitness/js/jump-duck.js — Jump-Duck DOM engine (2025-11-19) ===
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession }    from './stats-store.js';

const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ---------- Views ---------- */

const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v.classList.add('jd-hidden'));
  if (name === 'menu')     viewMenu.classList.remove('jd-hidden');
  if (name === 'research') viewResearch.classList.remove('jd-hidden');
  if (name === 'play')     viewPlay.classList.remove('jd-hidden');
  if (name === 'result')   viewResult.classList.remove('jd-hidden');
}

/* ---------- HUD refs ---------- */

const elDiffSel   = $('#difficulty');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudTime   = $('#hud-time');

const playArea    = $('#playArea');
const obsLayer    = $('#obsLayer');
const avatarEl    = $('#avatar');
const judgeLabel  = $('#judgeLabel');

/* result refs */
const resMode     = $('#res-mode');
const resDiff     = $('#res-diff');
const resScore    = $('#res-score');
const resStabEnd  = $('#res-stab-end');
const resStabMin  = $('#res-stab-min');
const resObsTotal = $('#res-obs-total');
const resHits     = $('#res-hits');
const resMiss     = $('#res-miss');
const resAcc      = $('#res-accuracy');
const resRTMean   = $('#res-rt-mean');

/* ---------- Config ---------- */

const DIFF_CONFIG = {
  easy: {
    name: 'easy',
    durationMs: 60000,
    spawnIntervalMs: 1300,
    hitWindowMs: 380,
    obstacleSpeed: 0.70,   // portion of width per second
    stabilityDamageOnMiss: 7,
    stabilityGainOnHit: 0.9,
    scorePerHit: 8
  },
  normal: {
    name: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 1000,
    hitWindowMs: 340,
    obstacleSpeed: 0.85,
    stabilityDamageOnMiss: 9,
    stabilityGainOnHit: 0.8,
    scorePerHit: 10
  },
  hard: {
    name: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 820,
    hitWindowMs: 310,
    obstacleSpeed: 1.05,
    stabilityDamageOnMiss: 12,
    stabilityGainOnHit: 0.7,
    scorePerHit: 12
  }
};

function pickConfig(key){
  return DIFF_CONFIG[key] || DIFF_CONFIG.normal;
}

/* ---------- Game state ---------- */

let gameMode   = 'play';   // 'play' | 'research'
let diffKey    = 'normal';

let state      = null;
let rafId      = null;
let logger     = null;
let sessionMeta= null;
let lastTs     = 0;
let obstacleId = 1;

const NO_LOGGER = {
  logSpawn(){},
  logHit(){},
  logExpire(){},
  finish(){},
};

/* ---------- Helpers ---------- */

function fmtMs(v){
  if (!v || v <= 0) return '-';
  return v.toFixed(0)+' ms';
}
function fmtPercent(v){
  if (v == null || Number.isNaN(v)) return '0.0 %';
  return (v*100).toFixed(1)+' %';
}

let judgeTimer = null;
function showJudge(text, kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text;
  judgeLabel.className = 'jd-judge show';
  if (kind) judgeLabel.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>judgeLabel.classList.remove('show'), 420);
}

function setAvatarPose(pose){
  if (!avatarEl) return;
  avatarEl.classList.remove('jd-avatar-stand','jd-avatar-jump','jd-avatar-duck');
  if (pose === 'jump') avatarEl.classList.add('jd-avatar-jump');
  else if (pose === 'duck') avatarEl.classList.add('jd-avatar-duck');
  else avatarEl.classList.add('jd-avatar-stand');
}

/* ---------- Session meta & logger ---------- */

function buildSessionMeta(){
  const cfg = pickConfig(diffKey);
  let playerId='anon', group='', phase='';

  if (gameMode === 'research'){
    playerId = ($('#resId')?.value || 'anon').trim();
    group    = ($('#resGroup')?.value || '').trim();
    phase    = ($('#resPhase')?.value || '').trim();
  }

  return {
    gameId: 'jump-duck',
    playerId,
    mode: gameMode,
    difficulty: cfg.name,
    group,
    phase,
    filePrefix: 'vrfitness_jumpduck'
  };
}

/* ---------- Game start / stop ---------- */

function startGame(){
  const cfg = pickConfig(diffKey);
  sessionMeta = buildSessionMeta();

  state = {
    cfg,
    mode: gameMode,
    diffKey,
    durationMs: cfg.durationMs,
    remainingMs: cfg.durationMs,
    stability: 100,
    minStability: 100,
    score: 0,
    hits: 0,
    miss: 0,
    obstaclesSpawned: 0,
    obstaclesResolved: 0,
    obstacles: [],
    nextSpawnAt: 0,
    avatar: {
      pose: 'stand',
      lastActionAt: 0
    },
    hitRTs: [],
    endedBy: null
  };

  // logger ใช้เฉพาะโหมดวิจัย
  logger = (gameMode === 'research')
    ? createCSVLogger(sessionMeta)
    : NO_LOGGER;

  // HUD initial
  if (elHudMode) elHudMode.textContent =
    (gameMode === 'research') ? 'Research' : 'Play';
  if (elHudDiff) elHudDiff.textContent = diffKey;
  if (elHudDur)  elHudDur.textContent  = (cfg.durationMs/1000)+'s';
  if (elHudTime) elHudTime.textContent = (cfg.durationMs/1000).toFixed(1)+'s';
  if (elHudStab) elHudStab.textContent = '100%';
  if (elHudObs)  elHudObs.textContent  = '0 / 0';

  setAvatarPose('stand');
  if (obsLayer) obsLayer.innerHTML = '';
  if (judgeLabel) judgeLabel.classList.remove('show');

  lastTs = 0;
  obstacleId = 1;

  showView('play');
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function endGame(reason){
  if (!state || state.endedBy) return;
  state.endedBy = reason || 'manual';

  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }

  const totalObs = state.obstaclesSpawned;
  const hits     = state.hits;
  const miss     = state.miss;
  const acc      = totalObs ? hits/totalObs : 0;

  // analytics summary
  const rtList = state.hitRTs;
  let rtMean = 0;
  if (rtList.length){
    rtMean = rtList.reduce((a,b)=>a+b,0)/rtList.length;
  }

  const finalPayload = {
    endedBy: state.endedBy,
    score: state.score,
    combo: 0,
    missCount: state.miss,
    playerHP: state.stability,
    bossIndex: '',
    elapsedMs: state.durationMs - state.remainingMs,
    analytics: {
      totalSpawns: totalObs,
      totalHits: hits,
      expiredMisses: miss,
      accuracy: acc,
      avgReactionNormal: rtMean,
      avgReactionDecoy: 0
    }
  };

  // CSV only research mode
  logger.finish(finalPayload);

  // dashboard (ใช้รูปแบบเดียวกับเกมอื่น)
  recordSession('jump-duck', {
    mode: gameMode,
    difficulty: diffKey,
    score: state.score,
    missCount: state.miss,
    totalHits: state.hits,
    accuracy: acc,
    stabilityEnd: state.stability,
    stabilityMin: state.minStability
  });

  fillResultView(acc, rtMean, totalObs);
  showView('result');
}

function fillResultView(acc, rtMean, totalObs){
  if (!state) return;
  const modeLabel =
    gameMode === 'research' ? 'Research' : 'Play';

  if (resMode)     resMode.textContent     = modeLabel;
  if (resDiff)     resDiff.textContent     = diffKey;
  if (resScore)    resScore.textContent    = String(state.score);
  if (resStabEnd)  resStabEnd.textContent  = state.stability.toFixed(1)+' %';
  if (resStabMin)  resStabMin.textContent  = state.minStability.toFixed(1)+' %';
  if (resObsTotal) resObsTotal.textContent = String(totalObs);
  if (resHits)     resHits.textContent     = String(state.hits);
  if (resMiss)     resMiss.textContent     = String(state.miss);
  if (resAcc)      resAcc.textContent      = fmtPercent(acc);
  if (resRTMean)   resRTMean.textContent   = fmtMs(rtMean);
}

/* ---------- Game loop ---------- */

function spawnObstacle(now){
  if (!state || !obsLayer) return;
  const cfg = state.cfg;
  const type = Math.random() < 0.5 ? 'low' : 'high';

  const el = document.createElement('div');
  el.className = 'jd-obstacle '+type;
  obsLayer.appendChild(el);

  const obs = {
    id: obstacleId++,
    type,
    x: 1.1,             // 1.0 = ขอบขวา
    speed: cfg.obstacleSpeed * (0.9 + Math.random()*0.3),
    element: el,
    resolved: false,
    hit: false,
    miss: false,
    createdAt: now,
    triggered: false
  };
  state.obstacles.push(obs);
  state.obstaclesSpawned++;

  logger.logSpawn({
    id: obs.id,
    type: type,
    t: Date.now(),
    playerHP: state.stability
  });
}

function updateObstacles(dt, now){
  if (!state) return;
  const collisionX = 0.20;
  const missX      = -0.05;

  const cfg = state.cfg;
  const hitWindowMs = cfg.hitWindowMs;

  const avatar = state.avatar;

  const remain = [];

  for (const obs of state.obstacles){
    obs.x -= obs.speed * dt;

    if (obs.element){
      obs.element.style.left = (obs.x*100)+'%';
    }

    // ถึงโซนชนและยังไม่ตัดสิน
    if (!obs.resolved && obs.x <= collisionX){
      const dtAction = (now - avatar.lastActionAt);
      const matchPose =
        (obs.type === 'low'  && avatar.pose === 'jump') ||
        (obs.type === 'high' && avatar.pose === 'duck');

      if (matchPose && dtAction >= 0 && dtAction <= hitWindowMs){
        // HIT
        obs.resolved = true;
        obs.hit = true;
        state.hits++;
        const mult = state.stability > 80 ? 1.2 : 1.0;
        state.score += cfg.scorePerHit * mult;
        state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
        state.minStability = Math.min(state.minStability, state.stability);
        if (obs.element){
          obs.element.classList.add('hit');
        }
        const rt = dtAction;
        state.hitRTs.push(rt);

        logger.logHit({
          id: obs.id,
          type: obs.type,
          result: 'hit',
          reactionMs: rt,
          score: state.score,
          combo: 0,
          missCount: state.miss,
          playerHP: state.stability,
          bossIndex: '',
          bossPhase: 'run'
        });

        showJudge('GOOD', 'good');
      } else if (obs.x <= missX){
        // MISS จากการไม่กดหรือกดผิดจังหวะ
        obs.resolved = true;
        obs.miss = true;
        state.miss++;
        state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
        state.minStability = Math.min(state.minStability, state.stability);
        if (obs.element){
          obs.element.classList.add('miss');
        }

        logger.logExpire({
          id: obs.id,
          type: obs.type,
          result: 'miss',
          playerHP: state.stability,
          bossIndex: '',
          bossPhase: 'run'
        });

        showJudge('MISS', 'miss');
      }
    }

    if (obs.x > missX){
      remain.push(obs);
    }else if (obs.element && obs.element.parentNode){
      obs.element.parentNode.removeChild(obs.element);
    }
  }

  state.obstacles = remain;
}

function loop(ts){
  if (!state) return;
  if (!lastTs) lastTs = ts;
  const dtMs = ts - lastTs;
  const dt   = dtMs / 1000;
  lastTs = ts;

  // time
  state.remainingMs = Math.max(0, state.remainingMs - dtMs);
  const remainSec = state.remainingMs / 1000;
  if (elHudTime) elHudTime.textContent = remainSec.toFixed(1)+'s';

  if (state.remainingMs <= 0){
    endGame('timeout');
    return;
  }

  // avatar pose decay
  if (state.avatar.pose !== 'stand' &&
      (performance.now() - state.avatar.lastActionAt) > 650){
    state.avatar.pose = 'stand';
    setAvatarPose('stand');
  }

  // spawn obstacles
  if (state.nextSpawnAt === 0){
    state.nextSpawnAt = ts + state.cfg.spawnIntervalMs;
  }
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);
    const base = state.cfg.spawnIntervalMs;
    const jitter = 0.8 + Math.random()*0.4;
    state.nextSpawnAt += base * jitter;
  }

  // update obstacles
  updateObstacles(dt, performance.now());

  // HUD dynamic
  if (elHudStab) elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs){
    const total = state.obstaclesSpawned;
    const hits  = state.hits;
    elHudObs.textContent = `${hits} / ${total}`;
  }

  rafId = requestAnimationFrame(loop);
}

/* ---------- Input ---------- */

function handleAction(action){
  if (!state) return;
  const now = performance.now();
  state.avatar.lastActionAt = now;

  if (action === 'jump'){
    state.avatar.pose = 'jump';
    setAvatarPose('jump');
  }else if (action === 'duck'){
    state.avatar.pose = 'duck';
    setAvatarPose('duck');
  }
}

function initInput(){
  // Buttons
  $$('[data-act="jump"]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.preventDefault();
      handleAction('jump');
    });
  });
  $$('[data-act="duck"]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.preventDefault();
      handleAction('duck');
    });
  });

  // Keyboard
  window.addEventListener('keydown', e=>{
    const code = e.code;
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW'){
      handleAction('jump');
    }else if (code === 'ArrowDown' || code === 'KeyS'){
      handleAction('duck');
    }
  });
}

/* ---------- Init UI events ---------- */

function initMenu(){
  $('[data-action="start-play"]')?.addEventListener('click', ()=>{
    gameMode = 'play';
    diffKey  = elDiffSel?.value || 'normal';
    showView('play');
    startGame();
  });

  $('[data-action="goto-research"]')?.addEventListener('click', ()=>{
    gameMode = 'research';
    showView('research');
  });

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      showView('menu');
    });
  });

  $('[data-action="start-research"]')?.addEventListener('click', ()=>{
    gameMode = 'research';
    diffKey  = elDiffSel?.value || 'normal';
    startGame();
  });

  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (state) endGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click', ()=>{
    // ใช้ diff เดิม + mode เดิม
    startGame();
  });

  showView('menu');
}

/* ---------- Boot ---------- */

window.addEventListener('DOMContentLoaded', ()=>{
  initMenu();
  initInput();
});