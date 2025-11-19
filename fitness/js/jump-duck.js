// fitness/js/jump-duck.js
// Jump & Duck — DOM engine + Research-ready summary logger (no CSV yet)
'use strict';

/* ---------- DOM helpers ---------- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- Views ---------- */
const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>v && v.classList.add('hidden'));
  if(name==='menu'    && viewMenu)     viewMenu.classList.remove('hidden');
  if(name==='research'&& viewResearch) viewResearch.classList.remove('hidden');
  if(name==='play'    && viewPlay)     viewPlay.classList.remove('hidden');
  if(name==='result'  && viewResult)   viewResult.classList.remove('hidden');
}

/* ---------- HUD / play DOM ---------- */
const elHudMode      = $('#hud-mode');
const elHudDiff      = $('#hud-diff');
const elHudTime      = $('#hud-time');
const elHudStability = $('#hud-stability');
const elHudObstacles = $('#hud-obstacles');

const playArea = $('#playArea');
const laneTrack= $('#lane-track');
const avatar   = $('#avatar');

const btnJump  = $('#btn-jump');
const btnDuck  = $('#btn-duck');

/* ---------- Result DOM ---------- */
const elResMode      = $('#res-mode');
const elResDiff      = $('#res-diff');
const elResEnd       = $('#res-end');
const elResScore     = $('#res-score');
const elResStability = $('#res-stability');
const elResHits      = $('#res-hits');
const elResMiss      = $('#res-miss');
const elResAvoidRate = $('#res-avoidRate');
const elResRTMean    = $('#res-rtmean');

/* ---------- Coach bubble ---------- */
const coachBubble = $('#coachBubble');
const comboCall   = $('#comboCall');

/* ---------- Difficulty config ---------- */
const GAME_DURATION_MS = 60000;

const DIFF_CONFIG = {
  easy: {
    key:'easy',
    spawnIntervalMs: 2200,
    stabilityDecayPerSec: 2.0,
    stabilityGainOnHit:  3.0,
    stabilityPenaltyMiss:6.0,
    rtWindowMs: 550
  },
  normal: {
    key:'normal',
    spawnIntervalMs: 1600,
    stabilityDecayPerSec: 3.0,
    stabilityGainOnHit:  3.5,
    stabilityPenaltyMiss:7.0,
    rtWindowMs: 450
  },
  hard: {
    key:'hard',
    spawnIntervalMs: 1200,
    stabilityDecayPerSec: 4.0,
    stabilityGainOnHit:  4.0,
    stabilityPenaltyMiss:8.0,
    rtWindowMs: 380
  }
};

/* ---------- Global stats gateway (ใช้ตัวเดียวกับ Rhythm Boxer) ---------- */
const globalStats =
  (window.VRFitnessStats && window.VRFitnessStats.recordSession)
  ? window.VRFitnessStats
  : (window.__VRFIT_STATS || null);

function recordSessionToDashboard(gameId, summary){
  if(globalStats && typeof globalStats.recordSession === 'function'){
    try{ globalStats.recordSession(gameId, summary); }catch(e){}
  }else{
    // local fallback
    try{
      const key = 'vrfit_sessions_'+gameId;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({...summary, ts:Date.now()});
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
}

/* ---------- Game state ---------- */

let mode = 'play';           // 'play' | 'research'
let diffKey = 'normal';
let cfg = DIFF_CONFIG.normal;

let state = null;
let rafId = null;

/**
 * state schema:
 * {
 *   startTime, elapsed,
 *   stability, obstaclesTotal, hits, misses,
 *   lastObstacleTime,
 *   activeObstacle: { id, type:'jump'|'duck', spawnTime, resolved:boolean, rtMs:null },
 *   rtList:[number]
 * }
 */

function resetState(){
  const now = performance.now();
  state = {
    startTime: now,
    elapsed: 0,
    stability: 100,
    obstaclesTotal: 0,
    hits: 0,
    misses: 0,
    lastObstacleTime: now,
    nextSpawnAt: now + 800,
    activeObstacle: null,
    rtList: []
  };
}

/* ---------- Coach helpers ---------- */

let lastCoachAt = 0;
function showCoach(message){
  if(!coachBubble) return;
  const now = performance.now();
  if(now - lastCoachAt < 4000) return;
  lastCoachAt = now;
  coachBubble.textContent = message;
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 3200);
}

function showCombo(text){
  if(!comboCall) return;
  comboCall.textContent = text;
  comboCall.classList.add('show');
  setTimeout(()=> comboCall && comboCall.classList.remove('show'), 600);
}

/* ---------- Obstacle visual ---------- */

function clearObstacles(){
  if(!laneTrack) return;
  laneTrack.innerHTML = '';
}

function spawnObstacle(){
  if(!laneTrack || !state) return;
  const type = Math.random() < 0.5 ? 'jump' : 'duck';
  const now = performance.now();

  const ob = {
    id: state.obstaclesTotal + 1,
    type,
    spawnTime: now,
    resolved: false,
    rtMs: null
  };
  state.activeObstacle = ob;
  state.obstaclesTotal++;

  // DOM
  const el = document.createElement('div');
  el.className = 'obstacle obstacle-' + type;
  el.dataset.id = String(ob.id);
  el.textContent = type === 'jump' ? '⬆' : '⬇';
  laneTrack.appendChild(el);

  // coach hint
  if(ob.id === 1){
    showCoach('ดูไอคอน ⬆ / ⬇ แล้วลองกระโดดหรือก้มให้ตรงจังหวะนะครับ');
  }
}

/* เมื่อกดแล้วให้เล่นท่าทาง avatar + เช็คว่าโดนหรือไม่ */
function handleAction(kind){
  if(!state) return;

  // ท่าทาง avatar
  if(avatar){
    avatar.classList.remove('pose-jump','pose-duck');
    if(kind==='jump') avatar.classList.add('pose-jump');
    else if(kind==='duck') avatar.classList.add('pose-duck');
    setTimeout(()=>{
      avatar && avatar.classList.remove('pose-jump','pose-duck');
    }, 260);
  }

  const now = performance.now();
  const ob = state.activeObstacle;
  if(!ob || ob.resolved) return;

  const dt = now - ob.spawnTime; // นับจากตอนที่ไอคอนขึ้น
  const abs = Math.abs(dt);
  const within = abs <= cfg.rtWindowMs;

  if(within && kind===ob.type){
    // hit
    ob.resolved = true;
    ob.rtMs = abs;
    state.hits++;
    state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
    state.rtList.push(abs);
    showCombo('✅ HIT');
    showCoach('ดีมาก! รักษาจังหวะไว้ สมดุลจะค่อย ๆ ดีขึ้น');
    // ลบ obstacle ออกจาก DOM
    removeActiveObstacleDOM(ob.id, true);
  }else if(within && kind!==ob.type){
    // wrong direction
    ob.resolved = true;
    state.misses++;
    state.stability = Math.max(0, state.stability - cfg.stabilityPenaltyMiss);
    showCombo('❌ ผิดท่า');
    showCoach('ลองสังเกตให้ดีว่าเป็นสัญลักษณ์กระโดดหรือก้มนะครับ');
    removeActiveObstacleDOM(ob.id, false);
  }else{
    // กดเร็ว/ช้าเกินไป ยังไม่ถือว่าตัดสิน ให้กดใหม่ได้
  }
}

function removeActiveObstacleDOM(id, success){
  if(!laneTrack) return;
  const el = laneTrack.querySelector('[data-id="'+id+'"]');
  if(el){
    el.classList.add(success ? 'hit' : 'miss');
    setTimeout(()=> el.remove(), 260);
  }
}

/* ---------- Game loop ---------- */

function loop(now){
  if(!state) return;
  state.elapsed = now - state.startTime;

  const remain = Math.max(0, GAME_DURATION_MS - state.elapsed);
  if(elHudTime) elHudTime.textContent = (remain/1000).toFixed(1);

  // stability decay (พื้นฐาน)
  const dtSec = 16 / 1000;
  state.stability = Math.max(0, state.stability - cfg.stabilityDecayPerSec * dtSec);
  if(elHudStability){
    elHudStability.textContent = state.stability.toFixed(1)+' %';
  }

  if(elHudObstacles){
    elHudObstacles.textContent = String(state.obstaclesTotal);
  }

  // spawn obstacles
  if(now >= state.nextSpawnAt){
    spawnObstacle();
    state.nextSpawnAt = now + cfg.spawnIntervalMs;
  }

  // หากเวลาหมด
  if(state.elapsed >= GAME_DURATION_MS){
    endGame('timeout');
    return;
  }

  rafId = requestAnimationFrame(loop);
}

/* ---------- Start / end ---------- */

function updateHUDStatic(){
  if(elHudMode) elHudMode.textContent = (mode==='research' ? 'research' : 'play');
  if(elHudDiff) elHudDiff.textContent = diffKey;
  if(elHudTime) elHudTime.textContent = (GAME_DURATION_MS/1000).toFixed(1);
  if(elHudStability) elHudStability.textContent = '100.0 %';
  if(elHudObstacles) elHudObstacles.textContent = '0';
}

function startGame(chosenMode){
  mode = chosenMode || 'play';
  diffKey = ($('#difficulty')?.value) || 'normal';
  cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  resetState();
  clearObstacles();
  updateHUDStatic();
  showView('play');

  if(rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function computeRTMean(){
  if(!state || !state.rtList.length) return 0;
  const sum = state.rtList.reduce((a,b)=>a+b,0);
  return sum / state.rtList.length;
}

function endGame(reason){
  if(!state) return;
  if(rafId!=null) cancelAnimationFrame(rafId);

  const hits = state.hits;
  const misses = state.misses;
  const total = hits + misses;
  const stabilityFinal = state.stability;
  const rtMean = computeRTMean();

  const avoidRate = total ? hits/total : 0;
  const score = Math.max(0, stabilityFinal) + hits*2; // สูตรคะแนนง่าย ๆ

  // เติมผลใน Result view
  if(elResMode)      elResMode.textContent      = (mode==='research'?'research':'play');
  if(elResDiff)      elResDiff.textContent      = diffKey;
  if(elResEnd)       elResEnd.textContent       = (reason==='timeout'?'เล่นครบเวลา / Timeout':reason||'-');
  if(elResScore)     elResScore.textContent     = score.toFixed(1);
  if(elResStability) elResStability.textContent = stabilityFinal.toFixed(1)+' %';
  if(elResHits)      elResHits.textContent      = String(hits);
  if(elResMiss)      elResMiss.textContent      = String(misses);
  if(elResAvoidRate) elResAvoidRate.textContent = (avoidRate*100).toFixed(1)+' %';
  if(elResRTMean)    elResRTMean.textContent    = rtMean ? rtMean.toFixed(0)+' ms' : '-';

  // ส่งเข้า Dashboard summary (อันที่ขึ้นการ์ด Jump-Duck)
  recordSessionToDashboard('jump-duck',{
    gameId:'jump-duck',
    mode,
    difficulty: diffKey,
    score,
    maxCombo: 0,          // เกมนี้ไม่มี combo จริง ๆ ใช้ 0 ไว้ก่อน
    missCount: misses,
    totalHits: hits,
    accuracy: avoidRate,
    stabilityFinal
  });

  state = null;
  clearObstacles();
  showView('result');
}

/* ---------- Init & wiring ---------- */

function init(){
  // menu buttons
  $('[data-action="start-play"]')?.addEventListener('click',()=>{
    mode = 'play';
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click',()=>{
    showView('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click',()=> showView('menu'));
  });

  // research start
  $('[data-action="start-research"]')?.addEventListener('click',()=>{
    // ตอนนี้ยังไม่ใช้ ID โดยตรง แต่อาจเก็บภายหลัง (v2)
    mode = 'research';
    startGame('research');
  });

  // actions
  if(btnJump){
    btnJump.addEventListener('click',ev=>{
      ev.preventDefault();
      handleAction('jump');
    });
  }
  if(btnDuck){
    btnDuck.addEventListener('click',ev=>{
      ev.preventDefault();
      handleAction('duck');
    });
  }

  // keyboard ช่วยเทส (PC)
  window.addEventListener('keydown',ev=>{
    if(ev.code==='ArrowUp' || ev.code==='Space'){
      handleAction('jump');
    }else if(ev.code==='ArrowDown'){
      handleAction('duck');
    }
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);