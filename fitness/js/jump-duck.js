// === fitness/js/jump-duck.js — Jump-Duck main (2025-11-19) ===
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession }   from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- Views ---------- */

const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if (name==='menu'    && viewMenu)    viewMenu.classList.remove('hidden');
  if (name==='research'&& viewResearch)viewResearch.classList.remove('hidden');
  if (name==='play'    && viewPlay)    viewPlay.classList.remove('hidden');
  if (name==='result'  && viewResult)  viewResult.classList.remove('hidden');
}

/* ---------- HUD refs ---------- */

const hudMode      = $('#hud-mode');
const hudDiff      = $('#hud-diff');
const hudDuration  = $('#hud-duration');
const hudScore     = $('#hud-score');
const hudCombo     = $('#hud-combo');
const hudMiss      = $('#hud-miss');
const hudStability = $('#hud-stability');
const hudTime      = $('#hud-time');

const judgeLabel   = $('#jd-judge');
const playArea     = $('#playArea');
const canvas       = /** @type {HTMLCanvasElement|null} */ ($('#jd-canvas'));

/* Result refs */
const resMode      = $('#res-mode');
const resDiff      = $('#res-diff');
const resScore     = $('#res-score');
const resMaxCombo  = $('#res-maxcombo');
const resMiss      = $('#res-miss');
const resStability = $('#res-stability');
const resTotal     = $('#res-total');
const resAcc       = $('#res-acc');

/* Research form refs */
const inpResearchId    = $('#researchId');
const inpResearchGroup = $('#researchGroup');
const inpResearchPhase = $('#researchPhase');

/* ---------- Config ---------- */

const DIFF_CONFIG = {
  easy: {
    key: 'easy',
    durationMs: 60000,
    spawnIntervalMs: 1100,
    obstacleSpeed: 220,      // px/s
    damage: 10,
    reward: 8
  },
  normal: {
    key: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 820,
    obstacleSpeed: 260,
    damage: 14,
    reward: 10
  },
  hard: {
    key: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 650,
    obstacleSpeed: 310,
    damage: 18,
    reward: 12
  }
};
function pickConfig(k){
  return DIFF_CONFIG[k] || DIFF_CONFIG.normal;
}

/* ---------- Game State ---------- */

let gameMode = 'play'; // 'play' | 'research'
let diffKey  = 'normal';

let logger   = null;
let sessionMeta = null;

let ctx = null;
let running = false;
let lastTs  = 0;

const player = {
  x: 80,
  y: 0,          // set after canvas sizing
  radius: 20,
  jumpY: -70,
  duckY: 30
};

let state = null;

/**
 * state structure:
 * {
 *   elapsedMs, durationMs,
 *   score, combo, maxCombo, miss,
 *   stability,
 *   totalObstacles, totalHits,
 *   obstacles:[],
 *   nextSpawnAt,
 *   action: 'none'|'jump'|'duck',
 *   actionUntil,
 *   stabilityAccum, stabilitySamples
 * }
 */

function resetState(cfg){
  const dur = cfg.durationMs;
  state = {
    elapsedMs: 0,
    durationMs: dur,
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    stability: 100,
    totalObstacles: 0,
    totalHits: 0,
    obstacles: [],
    nextSpawnAt: 500, // เริ่ม spawn หลัง 0.5s
    action: 'none',
    actionUntil: 0,
    stabilityAccum: 0,
    stabilitySamples: 0
  };
  lastTs = 0;
}

/* ---------- Obstacles ---------- */

function makeObstacle(kind,cfg){
  // kind: 'low' | 'high'
  const w = 34;
  const h = (kind==='low') ? 32 : 56;
  const canvasWidth  = canvas?.width  || 400;
  const canvasHeight = canvas?.height || 560;

  const groundY      = canvasHeight*0.62;
  const headLevel    = canvasHeight*0.38;

  let y;
  if (kind==='low') y = groundY;
  else              y = headLevel;

  const speed = cfg.obstacleSpeed; // px/s

  return {
    kind,
    x: canvasWidth + w,
    y,
    w,
    h,
    speed,
    judged:false,
    hit:false,
    result:null
  };
}

function spawnObstacle(cfg){
  if (!state) return;
  const r = Math.random();
  const kind = (r<0.5) ? 'low' : 'high';
  const ob = makeObstacle(kind,cfg);
  state.obstacles.push(ob);

  if (logger){
    logger.logSpawn({
      id: Date.now(),
      type: kind,
      bossIndex: '',
      playerHP: state.stability,
      extra: { kind }
    });
  }
}

/* ---------- Input: actions ---------- */

let currentView = 'menu';

function triggerAction(kind){
  if (!state || currentView!=='play') return;
  const now = performance.now();
  state.action = kind; // 'jump' or 'duck'
  state.actionUntil = now + 420; // 0.42s ท่ามีผล
}

/* keyboard */

function handleKey(e){
  if (currentView!=='play') return;
  if (e.repeat) return;

  if (e.code==='ArrowUp' || e.code==='Space'){
    e.preventDefault();
    triggerAction('jump');
  }else if (e.code==='ArrowDown'){
    e.preventDefault();
    triggerAction('duck');
  }
}

/* pointer swipe (mobile / mouse) */

let swipeStartY = null;

function handlePointerDown(ev){
  if (currentView!=='play') return;
  swipeStartY = ev.clientY;
}
function handlePointerUp(ev){
  if (currentView!=='play') return;
  if (swipeStartY==null) return;
  const dy = ev.clientY - swipeStartY;
  const threshold = 20;
  if (dy < -threshold){
    triggerAction('jump');
  }else if (dy > threshold){
    triggerAction('duck');
  }
  swipeStartY = null;
}

/* ---------- Judge label ---------- */

let judgeTimer = null;
function showJudge(text,kind){
  if (!judgeLabel) return;
  judgeLabel.textContent = text;
  judgeLabel.className = 'jd-judge show';
  if (kind) judgeLabel.classList.add('jd-judge-'+kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> judgeLabel && judgeLabel.classList.remove('show'), 380);
}

/* ---------- HUD update ---------- */

function updateHUD(){
  if (!state) return;
  if (hudMode)      hudMode.textContent = (gameMode==='research')?'Research':'Play';
  if (hudDiff)      hudDiff.textContent = diffKey;
  if (hudDuration)  hudDuration.textContent = (state.durationMs/1000|0)+'s';
  if (hudScore)     hudScore.textContent = state.score;
  if (hudCombo)     hudCombo.textContent = state.combo;
  if (hudMiss)      hudMiss.textContent  = state.miss;
  if (hudStability) hudStability.textContent = state.stability.toFixed(0)+'%';

  const remain = Math.max(0,state.durationMs - state.elapsedMs);
  if (hudTime) hudTime.textContent = (remain/1000).toFixed(1);
}

/* ---------- Render ---------- */

function resizeCanvas(){
  if (!canvas) return;
  const rect = playArea?.getBoundingClientRect();
  const w = (rect?.width || 360);
  const h = (rect?.height|| 560);
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = w*dpr;
  canvas.height = h*dpr;
  canvas.style.width  = w+'px';
  canvas.style.height = h+'px';
  ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr,0,0,dpr,0,0);

  // update player base position
  player.y = h*0.6;
  player.radius = 18;
}

function render(){
  if (!ctx || !canvas || !state) return;
  const w = canvas.width /(window.devicePixelRatio||1);
  const h = canvas.height/(window.devicePixelRatio||1);

  ctx.clearRect(0,0,w,h);

  // ground line
  ctx.strokeStyle = 'rgba(148,163,184,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0,h*0.68);
  ctx.lineTo(w,h*0.68);
  ctx.stroke();

  // player
  const now = performance.now();
  let py = player.y;
  if (state.action==='jump' && now<=state.actionUntil){
    py = player.y + player.jumpY;
  }else if (state.action==='duck' && now<=state.actionUntil){
    py = player.y + player.duckY;
  }

  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(player.x,py,player.radius,0,Math.PI*2);
  ctx.fill();

  // player outline
  ctx.strokeStyle = '#022c22';
  ctx.lineWidth = 2;
  ctx.stroke();

  // obstacles
  for (const ob of state.obstacles){
    if (ob.kind==='low'){
      ctx.fillStyle = '#f97316';
    }else{
      ctx.fillStyle = '#38bdf8';
    }
    const ox = ob.x;
    const oy = ob.y;
    const oh = ob.h;
    ctx.beginPath();
    ctx.roundRect(ox- ob.w/2, oy-oh, ob.w, oh, 6);
    ctx.fill();
  }

  // hint line (impact zone)
  const impactX = player.x + 12;
  ctx.setLineDash([4,4]);
  ctx.strokeStyle = 'rgba(148,163,184,0.45)';
  ctx.beginPath();
  ctx.moveTo(impactX, h*0.18);
  ctx.lineTo(impactX, h*0.78);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- Game loop ---------- */

function update(dtMs,cfg){
  if (!state) return;

  state.elapsedMs += dtMs;
  // decay action
  const now = performance.now();
  if (state.action!=='none' && now>state.actionUntil){
    state.action = 'none';
  }

  // spawn
  if (state.elapsedMs >= state.nextSpawnAt){
    spawnObstacle(cfg);
    // เพิ่ม spacing แบบสุ่มเล็กน้อย
    const jitter = (Math.random()*0.3+0.9);
    state.nextSpawnAt += cfg.spawnIntervalMs * jitter;
  }

  const dtSec = dtMs / 1000;
  const impactX = player.x + 12;

  // update obstacles
  for (const ob of state.obstacles){
    ob.x -= ob.speed * dtSec;

    if (!ob.judged && ob.x <= impactX){
      ob.judged = true;
      state.totalObstacles++;

      const required = (ob.kind==='low') ? 'jump' : 'duck';
      const now2 = performance.now();
      const inWindow = (state.action===required && now2 <= state.actionUntil);

      if (inWindow){
        // HIT
        state.totalHits++;
        state.combo++;
        if (state.combo>state.maxCombo) state.maxCombo = state.combo;
        state.score += cfg.reward;
        showJudge(required==='jump'?'JUMP!':'DUCK!','good');
        if (playArea){
          playArea.classList.add('hit');
          setTimeout(()=> playArea && playArea.classList.remove('hit'),140);
        }
        ob.hit = true;
        ob.result = 'hit';

        if (logger){
          logger.logHit({
            id: Date.now(),
            type: ob.kind,
            result: 'hit',
            reactionMs: '',
            score: state.score,
            combo: state.combo,
            missCount: state.miss,
            playerHP: state.stability,
            bossIndex: '',
            bossHP: '',
            extra: { required, action: state.action }
          });
        }
      }else{
        // MISS
        state.combo = 0;
        state.miss++;
        state.stability = Math.max(0, state.stability - cfg.damage);
        ob.hit = false;
        ob.result = 'miss';
        showJudge('MISS','miss');
        if (logger){
          logger.logExpire({
            id: Date.now(),
            type: ob.kind,
            result: 'miss',
            playerHP: state.stability
          });
        }
      }
    }
  }

  // remove off-screen
  state.obstacles = state.obstacles.filter(ob => ob.x + ob.w > -40);

  // stability average
  state.stabilityAccum += state.stability;
  state.stabilitySamples++;

  updateHUD();
  render();
}

function stopGame(endedBy){
  running = false;

  const duration = state?.durationMs || 60000;
  const elapsed  = state?.elapsedMs || 0;
  const total    = state?.totalObstacles || 0;
  const hits     = state?.totalHits || 0;
  const acc      = total ? hits/total : 0;
  const stabAvg  = (state && state.stabilitySamples>0)
    ? state.stabilityAccum/state.stabilitySamples
    : 0;

  // finish logger (เฉพาะโหมดวิจัย)
  if (logger && state){
    logger.finish({
      endedBy,
      score: state.score,
      combo: state.combo,
      missCount: state.miss,
      playerHP: state.stability,
      bossIndex: '',
      elapsedMs: state.elapsedMs,
      analytics: {
        totalSpawns: total,
        totalHits: hits,
        accuracy: acc
      }
    });
  }

  // dashboard summary
  if (state){
    recordSession('jump-duck',{
      mode: gameMode,
      difficulty: diffKey,
      score: state.score,
      maxCombo: state.maxCombo,
      missCount: state.miss,
      totalObstacles: total,
      totalHits: hits,
      accuracy: acc,
      avgStability: stabAvg,
      elapsedMs: elapsed,
      durationMs: duration,
      endedBy
    });
  }

  fillResult(endedBy,acc,stabAvg);
  showView('result');
  currentView = 'result';
}

function fillResult(endedBy,accuracy,stabAvg){
  if (!state) return;

  const modeLabel = (gameMode==='research') ? 'Research' : 'Play';

  if (resMode)      resMode.textContent      = modeLabel;
  if (resDiff)      resDiff.textContent      = diffKey;
  if (resScore)     resScore.textContent     = state.score;
  if (resMaxCombo)  resMaxCombo.textContent  = state.maxCombo;
  if (resMiss)      resMiss.textContent      = state.miss;
  if (resStability) resStability.textContent = stabAvg ? stabAvg.toFixed(1)+' %' : '-';
  if (resTotal)     resTotal.textContent     = state.totalObstacles;
  if (resAcc)       resAcc.textContent       = (accuracy*100).toFixed(1)+' %';
}

/* ---------- Start game ---------- */

function startGame(kind){
  gameMode = (kind==='research') ? 'research' : 'play';
  diffKey  = $('#difficulty')?.value || 'normal';
  const cfg = pickConfig(diffKey);

  // session meta สำหรับ logger (ใช้เฉพาะโหมดวิจัย)
  const playerId = (gameMode==='research'
    ? (inpResearchId?.value.trim() || 'anon')
    : `NORMAL-${Date.now()}`);

  const group    = (gameMode==='research'
    ? (inpResearchGroup?.value.trim() || '')
    : '');

  const phase    = (gameMode==='research'
    ? (inpResearchPhase?.value.trim() || '')
    : '');

  sessionMeta = {
    gameId: 'jump-duck',
    playerId,
    mode: gameMode,
    difficulty: diffKey,
    phase,
    filePrefix: 'vrfitness_jumpduck'
  };

  logger = (gameMode==='research')
    ? createCSVLogger(sessionMeta)
    : null;

  resetState(cfg);
  resizeCanvas();
  updateHUD();
  render();

  showView('play');
  currentView = 'play';

  if (judgeLabel) judgeLabel.classList.remove('show');

  running = true;
  lastTs  = 0;
  requestAnimationFrame(function loop(ts){
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    const cfgNow = pickConfig(diffKey);
    update(dt,cfgNow);

    if (!state) { running = false; return; }

    if (state.elapsedMs >= state.durationMs){
      stopGame('timeout');
      return;
    }
    if (state.stability <= 0){
      stopGame('player-dead');
      return;
    }

    requestAnimationFrame(loop);
  });
}

/* ---------- Init & wiring ---------- */

function init(){
  // views
  showView('menu');
  currentView = 'menu';

  // buttons
  $('[data-action="start-normal"]')?.addEventListener('click',()=>{
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
    currentView = 'research';
  });
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    startGame('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      running = false;
      showView('menu');
      currentView = 'menu';
    });
  });
  $('[data-action="stop"]')?.addEventListener('click',()=>{
    if (running) stopGame('manual');
  });
  $('[data-action="play-again"]')?.addEventListener('click',()=>{
    // เริ่มใหม่ใช้ diff เดิม / mode เดิม
    startGame(gameMode==='research'?'research':'play');
  });

  // resize
  window.addEventListener('resize',()=>{
    resizeCanvas();
    render();
  });
  resizeCanvas();

  // input
  window.addEventListener('keydown',handleKey);
  playArea?.addEventListener('pointerdown',handlePointerDown);
  playArea?.addEventListener('pointerup',handlePointerUp);
}

window.addEventListener('DOMContentLoaded', init);