// fitness/js/jump-duck.js
// Jump & Duck — self-contained engine + dashboard summary
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- DOM refs ---------- */

const viewMenu    = $('#view-menu');
const viewResearch= $('#view-research');
const viewPlay    = $('#view-play');
const viewResult  = $('#view-result');

const hudMode     = $('#hud-mode');
const hudDiff     = $('#hud-diff');
const hudTime     = $('#hud-time');
const hudStab     = $('#hud-stability');
const hudObs      = $('#hud-obstacles');

const playArea    = $('#playArea');
const laneTrack   = $('#lane-track');
const avatar      = $('#avatar');

const btnJump     = $('#btn-jump');
const btnDuck     = $('#btn-duck');

const resMode      = $('#res-mode');
const resDiff      = $('#res-diff');
const resEnd       = $('#res-end');
const resScore     = $('#res-score');
const resStability = $('#res-stability');
const resHits      = $('#res-hits');
const resMiss      = $('#res-miss');
const resAvoidRate = $('#res-avoidRate');
const resRTMean    = $('#res-rtmean');
const resultNote   = $('#view-result .note');

const coachBubble  = $('#coachBubble');
const comboCall    = $('#comboCall');

/* ---------- View helper ---------- */

function showView(name){
  [viewMenu,viewResearch,viewPlay,viewResult].forEach(v=>{
    if (!v) return;
    if (v.id === 'view-'+name) v.classList.remove('hidden');
    else v.classList.add('hidden');
  });
}

/* ---------- Config ---------- */

const DIFF_CONFIG = {
  easy:   { durationMs:60000, spawnIntervalMs:2200, hitGain:4,  missLoss:8  },
  normal: { durationMs:60000, spawnIntervalMs:1700, hitGain:3,  missLoss:10 },
  hard:   { durationMs:60000, spawnIntervalMs:1300, hitGain:2,  missLoss:14 }
};

const OBST_TRAVEL_MS = 1600;      // เวลาที่สิ่งกีดขวางวิ่งจากไกล → ชน
const HIT_WINDOW_MS  = 320;       // ยอมให้เร็ว/ช้าจากจุดชนเท่านี้ถือว่าถูกจังหวะ

/* ---------- Dashboard hook ---------- */

const StatsObj =
  (window.VRFitnessStats && typeof window.VRFitnessStats.recordSession === 'function')
    ? window.VRFitnessStats
    : (window.__VRFIT_STATS || null);

function recordSessionToDashboard(gameId, summary){
  if (StatsObj && typeof StatsObj.recordSession === 'function'){
    try { StatsObj.recordSession(gameId, summary); } catch(e){}
  } else {
    // fallback เก็บใน localStorage
    try{
      const key = 'vrfit_sessions_'+gameId;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...summary, ts:Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
}

/* ---------- Game state ---------- */

let game = null;

function makeInitialState(mode,diffKey){
  const cfg = DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
  return {
    running:false,
    mode,             // 'play' | 'research'
    diffKey,
    config:cfg,

    startTime:0,
    elapsedMs:0,
    lastFrame:0,

    lastSpawnAt:0,
    obstacles:[],     // {id,type,el,spawnAt,hitAt,expectedHit,resolved,judged}
    nextId:1,

    stability:100,
    score:0,
    combo:0,
    maxCombo:0,
    hitCount:0,
    missCount:0,
    obstaclesSpawned:0,

    rtSamples:[],     // reaction time ของ hit
  };
}

/* ---------- UI small helpers ---------- */

function setAvatarPose(pose){
  if (!avatar) return;
  avatar.classList.remove('pose-stand','pose-jump','pose-duck');
  avatar.classList.add('pose-'+pose);
  if (pose!=='stand'){
    setTimeout(()=> avatar && avatar.classList.add('pose-stand'), 260);
  }
}

function showCoach(msg){
  if (!coachBubble) return;
  coachBubble.textContent = msg;
  coachBubble.classList.remove('hidden');
  setTimeout(()=> coachBubble && coachBubble.classList.add('hidden'), 2600);
}

function showCombo(text){
  if (!comboCall) return;
  comboCall.textContent = text;
  comboCall.classList.add('show');
  setTimeout(()=> comboCall && comboCall.classList.remove('show'), 600);
}

/* ---------- Obstacle handling ---------- */

function spawnObstacle(){
  if (!game || !laneTrack) return;
  const now = performance.now();
  const type = Math.random() < 0.5 ? 'jump' : 'duck';
  const id   = game.nextId++;

  const el = document.createElement('div');
  el.className = 'obstacle obstacle-'+type;
  const icon = document.createElement('div');
  icon.className = 'ob-icon';
  icon.textContent = (type==='jump') ? '⬆️' : '⬇️';
  el.appendChild(icon);
  laneTrack.appendChild(el);

  const ob = {
    id,
    type,           // 'jump' | 'duck'
    el,
    spawnAt: now,
    expectedHit: now + OBST_TRAVEL_MS*0.7,
    resolved:false,
    judged:false
  };
  game.obstacles.push(ob);
  game.obstaclesSpawned++;
}

function updateObstacles(now){
  if (!game || !laneTrack) return;
  const cfg = game.config;

  for (const ob of game.obstacles){
    const t = (now - ob.spawnAt) / OBST_TRAVEL_MS;
    if (ob.el){
      const clamped = Math.max(0,Math.min(1,t));
      const y = clamped*100;
      ob.el.style.transform = `translateY(${y}%)`;
      ob.el.style.opacity   = (clamped>1?0:1);
    }

    if (!ob.resolved && !ob.judged && now >= ob.expectedHit + HIT_WINDOW_MS){
      // ถือว่าพลาด
      applyMiss(ob, false);
    }
  }

  // ลบที่หมดอายุแล้ว
  game.obstacles = game.obstacles.filter(ob=>{
    if (now - ob.spawnAt > OBST_TRAVEL_MS*1.3){
      if (ob.el && ob.el.parentNode) ob.el.parentNode.removeChild(ob.el);
      return false;
    }
    return true;
  });

  // spawn ใหม่
  if (now - game.lastSpawnAt >= cfg.spawnIntervalMs){
    spawnObstacle();
    game.lastSpawnAt = now;
  }
}

/* ---------- Scoring ---------- */

function applyHit(ob, rtMs){
  if (!game) return;
  ob.resolved = true;
  ob.judged   = true;

  game.hitCount++;
  game.combo++;
  if (game.combo>game.maxCombo) game.maxCombo = game.combo;

  // คะแนน + เสถียรภาพ
  const cfg = game.config;
  game.score += 10 * (game.mode==='research'?1:1);
  game.stability = Math.min(100, game.stability + cfg.hitGain);

  game.rtSamples.push(rtMs);

  if (ob.el){
    ob.el.classList.add('hit');
  }
  showCombo('GOOD! 💪');
}

function applyMiss(ob, fromInput){
  if (!game) return;
  ob.judged = true;
  game.combo = 0;
  game.missCount++;

  const cfg = game.config;
  game.stability = Math.max(0, game.stability - cfg.missLoss);

  if (ob.el){
    ob.el.classList.add('miss');
  }
  if (fromInput){
    showCoach('พลาดจังหวะนิดหน่อย ลองจับจังหวะใหม่อีกครั้ง 👍');
  }
}

/* ---------- Input ---------- */

function handleAction(kind){ // 'jump' | 'duck'
  if (!game || !game.running) return;
  const now = performance.now();

  setAvatarPose(kind);

  // หา obstacle ที่เหมาะ (ใกล้ expectedHit ที่สุด)
  let best = null;
  let bestErr = Infinity;
  for (const ob of game.obstacles){
    if (ob.judged) continue;
    const dt = Math.abs(now - ob.expectedHit);
    if (dt < bestErr){
      bestErr = dt;
      best = ob;
    }
  }

  // ไม่มีอะไรให้หลบ → นับเป็น miss เบา ๆ
  if (!best){
    game.missCount++;
    game.stability = Math.max(0, game.stability - 4);
    return;
  }

  const withinWindow = bestErr <= HIT_WINDOW_MS;
  const correctType  = (best.type === kind);

  if (withinWindow && correctType){
    applyHit(best, bestErr);
  }else{
    applyMiss(best, true);
  }
}

/* ---------- HUD & analytics ---------- */

function updateHUD(){
  if (!game) return;
  const cfg = game.config;
  const remain = Math.max(0, cfg.durationMs - game.elapsedMs);

  if (hudMode) hudMode.textContent = (game.mode==='research'?'research':'play');
  if (hudDiff) hudDiff.textContent = game.diffKey;
  if (hudTime) hudTime.textContent = (remain/1000).toFixed(1);
  if (hudStab) hudStab.textContent = game.stability.toFixed(1)+' %';

  const totalObs = game.hitCount + game.missCount;
  if (hudObs){
    hudObs.textContent = `${totalObs} / ${game.obstaclesSpawned}`;
  }
}

function computeAnalytics(){
  if (!game) return {
    accuracy:0, rtMean:0
  };
  const total = game.hitCount + game.missCount;
  const accuracy = total ? game.hitCount/total : 0;

  const list = game.rtSamples;
  const rtMean = list.length
    ? list.reduce((a,b)=>a+b,0)/list.length
    : 0;

  return { accuracy, rtMean };
}

/* ---------- Main loop ---------- */

let rafId = null;

function loop(now){
  if (!game || !game.running) return;

  if (!game.startTime){
    game.startTime = now;
    game.lastSpawnAt = now;
  }
  game.elapsedMs = now - game.startTime;

  // เวลาเกิน → จบเกม
  if (game.elapsedMs >= game.config.durationMs || game.stability<=0){
    endGame(game.stability<=0 ? 'stability-low' : 'timeout');
    return;
  }

  updateObstacles(now);
  updateHUD();

  rafId = requestAnimationFrame(loop);
}

/* ---------- Start / End ---------- */

function startGame(mode){
  const diffKey = $('#difficulty')?.value || 'normal';
  game = makeInitialState(mode,diffKey);

  // clear track
  if (laneTrack){
    laneTrack.innerHTML = '';
  }

  game.running = true;
  updateHUD();
  showView('play');

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function mapEndReason(code){
  switch(code){
    case 'timeout':       return 'เล่นครบเวลา / Timeout';
    case 'stability-low': return 'สมดุลต่ำ / Stability too low';
    default:              return code || '-';
  }
}

function endGame(reason){
  if (!game) return;
  game.running = false;
  if (rafId) cancelAnimationFrame(rafId);

  const a = computeAnalytics();

  // เติม Result view
  const modeLabel = game.mode==='research' ? 'Research' : 'Play';
  if (resMode)      resMode.textContent      = modeLabel;
  if (resDiff)      resDiff.textContent      = game.diffKey;
  if (resEnd)       resEnd.textContent       = mapEndReason(reason);
  if (resScore)     resScore.textContent     = game.score.toFixed(1);
  if (resStability) resStability.textContent = game.stability.toFixed(1)+' %';
  if (resHits)      resHits.textContent      = String(game.hitCount);
  if (resMiss)      resMiss.textContent      = String(game.missCount);

  const total = game.hitCount + game.missCount;
  const acc   = total ? game.hitCount/total : 0;
  if (resAvoidRate) resAvoidRate.textContent = (acc*100).toFixed(1)+' %';
  if (resRTMean)    resRTMean.textContent    = a.rtMean ? a.rtMean.toFixed(0)+' ms' : '-';

  // note โหมดวิจัย (ยังไม่มี CSV จริง ๆ เลยซ่อนไว้ก่อน)
  if (resultNote){
    resultNote.classList.add('hidden');
  }

  // ส่งสรุปเข้า Dashboard
  recordSessionToDashboard('jump-duck', {
    mode: game.mode,
    difficulty: game.diffKey,
    score: game.score,
    maxCombo: game.maxCombo || 0,
    missCount: game.missCount,
    totalHits: game.hitCount,
    accuracy: acc,
    stability: game.stability
  });

  showView('result');
}

/* ---------- Init ---------- */

function init(){
  // menu buttons
  $('[data-action="start-play"]')?.addEventListener('click', ()=>{
    startGame('play');
  });
  $('[data-action="goto-research"]')?.addEventListener('click', ()=>{
    showView('research');
  });
  $('[data-action="start-research"]')?.addEventListener('click', ()=>{
    startGame('research');
  });
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  // controls
  if (btnJump) btnJump.addEventListener('click', ()=> handleAction('jump'));
  if (btnDuck) btnDuck.addEventListener('click', ()=> handleAction('duck'));

  window.addEventListener('keydown', (ev)=>{
    if (ev.repeat) return;
    if (ev.key==='ArrowUp' || ev.key==='w' || ev.key==='W' || ev.key===' '){
      handleAction('jump');
    }else if (ev.key==='ArrowDown' || ev.key==='s' || ev.key==='S'){
      handleAction('duck');
    }
  });

  showView('menu');
}

window.addEventListener('DOMContentLoaded', init);