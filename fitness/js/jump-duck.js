// fitness/js/jump-duck.js
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const elMenu   = $('#menu');
const elPlay   = $('#play');
const elResult = $('#result');
const elArena  = $('#arena');

const elScore  = $('#score');
const elRScore = $('#r-score');

let mode = 'normal';
let state = null;
let logger = null;
let rafId = null;

const CFG = {
  durationMs: 60000,
  spawnIntervalMs: 800,
};

function show(id){
  [elMenu, elPlay, elResult].forEach(el => el.classList.add('hidden'));
  (id === 'menu' ? elMenu : id === 'play' ? elPlay : elResult).classList.remove('hidden');
}

function createMeta(){
  const participant = (mode === 'research')
    ? (prompt('Participant ID (เว้นว่างได้):') || '').trim()
    : `JDUCK-${Date.now()}`;
  const phase = (mode === 'research')
    ? (prompt('Phase (เช่น pre-test / post-test):') || '').trim()
    : '';

  return {
    gameId: 'jump-duck',
    playerId: participant || 'anon',
    mode,
    difficulty: 'normal',
    phase,
    filePrefix: 'vrfitness_jumpduck',
  };
}

function startGame(selectedMode){
  mode = selectedMode;
  const meta = createMeta();
  logger = createCSVLogger(meta);

  state = {
    startTime: performance.now(),
    elapsed: 0,
    lastSpawnAt: 0,
    nextId: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    obstacles: [], // {id, kind:'high'|'low', createdAt, expiresAt, el}
    totalSpawns: 0,
    totalSuccess: 0,
  };

  elArena.innerHTML = '';
  elScore.textContent = '0';
  show('play');
  rafId = requestAnimationFrame(loop);
}

function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const accuracy = state.totalSpawns
    ? state.totalSuccess / state.totalSpawns
    : 0;

  const finalState = {
    endedBy,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    elapsedMs: state.elapsed,
    playerHP: 0,
    bossIndex: '',
    analytics: {
      totalSpawns: state.totalSpawns,
      totalHits: state.totalSuccess,
      normalHits: state.totalSuccess,
      decoyHits: 0,
      expiredMisses: state.missCount,
      accuracy,
      avgReactionNormal: 0,
      avgReactionDecoy: 0
    }
  };

  if (logger) logger.finish(finalState);

  recordSession('jump-duck', {
    mode,
    difficulty: 'normal',
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: state.totalSuccess,
    accuracy
  });

  elRScore.textContent = String(state.score);
  show('result');
  state = null;
}

function loop(now){
  if (!state) return;
  state.elapsed = now - state.startTime;

  if (state.elapsed >= CFG.durationMs){
    stopGame('timeout');
    return;
  }

  if (now - state.lastSpawnAt >= CFG.spawnIntervalMs){
    spawnObstacle(now);
    state.lastSpawnAt = now;
  }

  // expire
  const toRemove = [];
  for (const ob of state.obstacles){
    if (now >= ob.expiresAt && !ob.resolved){
      ob.resolved = true;
      state.missCount++;
      state.combo = 0;
      toRemove.push(ob);

      if (logger){
        logger.logExpire({
          id: ob.id,
          type: ob.kind,
          t: now,
          playerHP:'',
          bossIndex:'',
          bossHP:'',
          bossPhase:'',
          result:'hit-obstacle'
        });
      }

      if (ob.el){
        ob.el.style.opacity = '0.2';
        ob.el.style.transform += ' scale(0.8)';
        setTimeout(()=>ob.el && ob.el.remove(), 160);
      }
    }
  }
  if (toRemove.length){
    state.obstacles = state.obstacles.filter(o => !toRemove.includes(o));
  }

  rafId = requestAnimationFrame(loop);
}

function spawnObstacle(now){
  const id = state.nextId++;
  const kind = Math.random() < 0.5 ? 'low' : 'high'; // low = กระโดด, high = ก้ม
  const el = document.createElement('div');
  el.className = 'obstacle';
  el.style.left = (10 + Math.random()*80) + '%';
  el.style.top  = kind === 'low' ? '65%' : '35%';

  const icon = document.createElement('div');
  icon.textContent = kind === 'low' ? '🟥' : '🟦';
  icon.style.position = 'absolute';
  icon.style.inset = '0';
  icon.style.display = 'flex';
  icon.style.alignItems = 'center';
  icon.style.justifyContent = 'center';
  icon.style.fontSize = '20px';
  el.appendChild(icon);

  const ob = {
    id,
    kind,
    createdAt: now,
    expiresAt: now + 1100,
    el,
    resolved: false
  };
  state.obstacles.push(ob);
  elArena.appendChild(el);

  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    handleObstacleHit(ob);
  }, { passive:false });

  if (logger){
    logger.logSpawn({
      id,
      type: kind,
      x: 0,
      y: 0,
      t: now,
      bossIndex:'',
      bossHP:'',
      bossPhase:''
    });
  }

  state.totalSpawns++;
}

function handleObstacleHit(ob){
  if (!state || ob.resolved) return;
  ob.resolved = true;

  // ในเวอร์ชันนี้การ "กดทันเวลา" แปลว่าหลบสำเร็จ
  state.score += 10;
  state.combo++;
  state.totalSuccess++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  elScore.textContent = String(state.score);

  const now = performance.now();

  if (logger){
    logger.logHit({
      id: ob.id,
      type: ob.kind,
      result:'success',
      score: state.score,
      combo: state.combo,
      missCount: state.missCount,
      playerHP:'',
      t: now,
      reactionMs: now - ob.createdAt,
      bossIndex:'',
      bossHP:'',
      bossPhase:'',
      feverActive:false,
      extra:{ action:'avoid' }
    });
  }

  if (ob.el){
    ob.el.style.transform += ' scale(1.2)';
    ob.el.style.opacity = '0';
    setTimeout(()=>ob.el && ob.el.remove(), 150);
  }

  state.obstacles = state.obstacles.filter(o => o !== ob);
}

// wiring
function init(){
  $$('#menu [data-start]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-start') || 'normal';
      startGame(m);
    });
  });

  $('[data-stop]')?.addEventListener('click', ()=> stopGame('manual'));
  $('[data-retry]')?.addEventListener('click', ()=> show('menu'));

  show('menu');
}

window.addEventListener('DOMContentLoaded', init);
