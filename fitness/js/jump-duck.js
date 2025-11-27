// === fitness/js/jump-duck.js — DOM-based Jump-Duck engine (2025-12-01) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- DOM refs ---------- */

const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

/* Result */
const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

/* ---------- Config ---------- */

const JD_DIFFS = {
  easy: {
    name:'easy',
    speedUnitsPerSec: 38,     // ความเร็วการเคลื่อนที่ของสิ่งกีดขวาง (หน่วย/วินาที)
    spawnIntervalMs: 1300,
    hitWindowMs: 260,
    stabilityDamageOnMiss: 10,
    stabilityGainOnHit: 3,
    scorePerHit: 12
  },
  normal: {
    name:'normal',
    speedUnitsPerSec: 48,
    spawnIntervalMs: 1000,
    hitWindowMs: 220,
    stabilityDamageOnMiss: 13,
    stabilityGainOnHit: 3,
    scorePerHit: 14
  },
  hard: {
    name:'hard',
    speedUnitsPerSec: 62,
    spawnIntervalMs: 800,
    hitWindowMs: 200,
    stabilityDamageOnMiss: 16,
    stabilityGainOnHit: 4,
    scorePerHit: 16
  }
};

// พิกัด hit zone (หน่วยเป็นเปอร์เซ็นต์ของความกว้างเส้นทาง)
const SPAWN_X   = 100; // เริ่มที่ขวาสุด
const CENTER_X  = 24;  // ใกล้ตัวผู้เล่น
const MISS_X    = 4;   // ผ่านตัวไปถือว่าชน

/* ---------- State ---------- */

let running   = false;
let state     = null;
let lastFrame = null;
let rafId     = null;

let judgeTimer = null;

/* input state */
let lastAction = null; // { type:'jump'|'duck', time:number }

/* ---------- Helper: view switching ---------- */

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

/* ---------- HUD & Judge ---------- */

function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{
    elJudge.classList.remove('show');
  }, 420);
}

function fmtMs(ms){
  if (!ms || ms<=0) return '-';
  return ms.toFixed(0)+' ms';
}

/* ---------- Game init / start / stop ---------- */

function startGame(){
  const diffKey   = (elDiff?.value) || 'normal';
  const diffCfg   = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durSecStr = (elDuration?.value) || '60';
  const durationMs= parseInt(durSecStr,10)*1000 || 60000;

  const now = performance.now();

  state = {
    mode:'play',
    diffKey,
    cfg:diffCfg,

    durationMs,
    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    obstacles: [],
    nextSpawnAt: now + 600,
    obstaclesSpawned: 0,
    hits: 0,
    miss: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,

    hitRTs: []
  };

  running   = true;
  lastFrame = now;

  // Reset UI
  if (elHudMode) elHudMode.textContent = 'Play';
  if (elHudDiff) elHudDiff.textContent = diffKey;
  if (elHudDur)  elHudDur.textContent  = (durationMs/1000|0)+'s';
  if (elHudStab) elHudStab.textContent = '100%';
  if (elHudObs)  elHudObs.textContent  = '0 / 0';
  if (elHudScore)elHudScore.textContent= '0';
  if (elHudCombo)elHudCombo.textContent= '0';
  if (elHudTime) elHudTime.textContent = (durationMs/1000).toFixed(1);

  if (elObsHost) elObsHost.innerHTML = '';
  if (elAvatar)  elAvatar.classList.remove('jump','duck');
  if (elPlayArea) elPlayArea.classList.remove('shake');

  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  if (!state) return;

  // สร้างสรุป
  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const misses   = state.miss || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length
    ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length
    : 0;

  fillResultView(acc, rtMean, totalObs);

  showView('result');
}

/* ---------- Result view ---------- */

function fillResultView(acc, rtMean, totalObs){
  const durSec = (state && state.durationMs ? state.durationMs : 60000)/1000;

  if (resMode)         resMode.textContent         = 'Play';
  if (resDiff)         resDiff.textContent         = state?.diffKey || 'normal';
  if (resDuration)     resDuration.textContent     = durSec.toFixed(0)+'s';
  if (resTotalObs)     resTotalObs.textContent     = String(totalObs);
  if (resHits)         resHits.textContent         = String(state?.hits||0);
  if (resMiss)         resMiss.textContent         = String(state?.miss||0);
  if (resAcc)          resAcc.textContent          = (acc*100).toFixed(1)+' %';
  if (resRTMean)       resRTMean.textContent       = fmtMs(rtMean);
  if (resStabilityMin) resStabilityMin.textContent = (state?.minStability||0).toFixed(1)+' %';
  if (resScore)        resScore.textContent        = String(Math.round(state?.score||0));

  // คำนวณ rank S / A / B / C / D
  if (resRank){
    let rank = 'C';
    const stab = state?.minStability ?? 0;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40) rank='D';
    resRank.textContent = rank;
  }
}

/* ---------- Loop & obstacle logic ---------- */

function loop(ts){
  if (!running || !state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  // เวลา
  state.elapsedMs  = ts - state.startTime;
  state.remainingMs= Math.max(0, state.durationMs - state.elapsedMs);

  if (elHudTime){
    elHudTime.textContent = (state.remainingMs/1000).toFixed(1);
  }

  if (state.elapsedMs >= state.durationMs){
    endGame('timeout');
    return;
  }

  // spawn obstacles
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);
    state.nextSpawnAt += cfg.spawnIntervalMs;
  }

  // move & resolve obstacles
  updateObstacles(dt, ts);

  // update stability HUD
  if (elHudStab) elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs){
    const tot = state.obstaclesSpawned;
    const ok  = state.hits;
    elHudObs.textContent = `${ok} / ${tot}`;
  }
  if (elHudScore) elHudScore.textContent = String(Math.round(state.score));
  if (elHudCombo) elHudCombo.textContent = String(state.combo);

  rafId = requestAnimationFrame(loop);
}

let nextObstacleId = 1;

function spawnObstacle(ts){
  if (!elObsHost || !state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  const isHigh = Math.random() < 0.5; // สลับ high/low
  const type   = isHigh ? 'high' : 'low';

  const el = document.createElement('div');
  // ✅ ให้ตรงกับ jump-duck.css: jd-obstacle--low / jd-obstacle--high
  el.className = 'jd-obstacle ' + (type === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);
  el.textContent = isHigh ? '🟥' : '🧱';

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    hit:false,
    miss:false,
    element: el,
    centerTime: null
  });

  state.obstaclesSpawned++;
}

function updateObstacles(dt, now){
  if (!state) return;
  const cfg = state.cfg || JD_DIFFS.normal;
  const speed = cfg.speedUnitsPerSec;
  const move = speed * (dt/1000);

  const toRemove = [];

  for (const obs of state.obstacles){
    if (obs.resolved && !obs.element){
      toRemove.push(obs);
      continue;
    }

    obs.x -= move;

    // update DOM position (ใช้ left%)
    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    // mark centerTime
    if (!obs.centerTime && obs.x <= CENTER_X){
      obs.centerTime = now;
    }

    // Check HIT window (ใกล้ center)
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const action = lastAction;
      if (action && action.time){
        const dtAction = Math.abs(action.time - now); // ระยะห่างเวลาระหว่างกด กับตำแหน่งกลาง
        const needType = (obs.type === 'high') ? 'duck' : 'jump';
        const matchPose= (action.type === needType);

        if (matchPose && dtAction <= cfg.hitWindowMs){
          // HIT
          obs.resolved = true;
          obs.hit      = true;

          // combo + score
          state.combo = (state.combo || 0) + 1;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;

          const base   = cfg.scorePerHit;
          const stabil = state.stability > 80 ? 1.10 : 1.0;
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15; // x1.0 → x1.9
          const gain   = Math.round(base * stabil * comboM);
          state.score += gain;

          state.hits++;
          state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
          state.minStability = Math.min(state.minStability, state.stability);

          if (obs.element){
            obs.element.classList.add('hit');
            // ลบออกหลัง effect
            setTimeout(()=> obs.element && obs.element.remove(), 260);
            obs.element = null;
          }

          const rt = dtAction;
          state.hitRTs.push(rt);

          if (state.combo >= 8){
            showJudge('COMBO x'+state.combo, 'combo');
          }else{
            showJudge('GOOD', 'ok');
          }
          continue;
        }
      }
    }

    // MISS – ผ่าน zone ตัวผู้เล่นแล้วยังไม่ resolve
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      obs.miss     = true;
      state.miss++;
      state.combo = 0;

      state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      if (obs.element){
        obs.element.classList.add('miss');
        setTimeout(()=> obs.element && obs.element.remove(), 260);
        obs.element = null;
      }

      showJudge('MISS', 'miss');
      if (elPlayArea){
        elPlayArea.classList.add('shake');
        setTimeout(()=> elPlayArea.classList.remove('shake'), 180);
      }
    }

    // remove when far left
    if (obs.x < -20){
      if (obs.element){
        obs.element.remove();
        obs.element = null;
      }
      toRemove.push(obs);
    }
  }

  if (toRemove.length){
    state.obstacles = state.obstacles.filter(o => !toRemove.includes(o));
  }

  // เคลียร์ action หลังจากใช้แล้วนิดหนึ่ง
  if (lastAction && now - lastAction.time > 260){
    lastAction = null;
  }
}

/* ---------- Input (Jump / Duck) ---------- */

function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (!elAvatar) return;
  elAvatar.classList.remove('jump','duck');
  elAvatar.classList.add(type);
  setTimeout(()=>{
    if (!elAvatar) return;
    elAvatar.classList.remove(type);
  }, 180);
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){
    ev.preventDefault();
    triggerAction('jump');
  }else if (ev.code === 'ArrowDown'){
    ev.preventDefault();
    triggerAction('duck');
  }
}

function handlePointerDown(ev){
  if (!running) return;
  if (!elPlayArea) return;

  const rect = elPlayArea.getBoundingClientRect();
  const y = ev.clientY;
  const mid = rect.top + rect.height/2;

  if (y < mid) triggerAction('jump');
  else         triggerAction('duck');
}

/* ---------- Init ---------- */

function initJD(){
  // เริ่มเล่นจากเมนู
  $('[data-action="start"]')?.addEventListener('click', ()=>{
    startGame();
  });

  // หยุดก่อนเวลา
  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (running){
      endGame('manual');
    }
  });

  // result actions
  $('[data-action="play-again"]')?.addEventListener('click', ()=>{
    startGame();
  });

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      showView('menu');
    });
  });

  // input listeners
  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  showView('menu');
}

window.addEventListener('DOMContentLoaded', initJD);
