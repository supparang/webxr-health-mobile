// fitness/js/balance-hold.js
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const elMenu   = $('#menu');
const elPlay   = $('#play');
const elResult = $('#result');

const elStatus = $('#hold-status');
const elTimer  = $('#timer');
const elRTime  = $('#r-time');

let mode = 'normal';
let state = null;
let logger = null;
let rafId = null;

const MAX_DURATION_MS = 60000;

function show(id){
  [elMenu, elPlay, elResult].forEach(el=>el.classList.add('hidden'));
  (id === 'menu' ? elMenu : id === 'play' ? elPlay : elResult).classList.remove('hidden');
}

function createMeta(){
  const participant = (mode === 'research')
    ? (prompt('Participant ID (เว้นว่างได้):') || '').trim()
    : `BHOLD-${Date.now()}`;
  const phase = (mode === 'research')
    ? (prompt('Phase (เช่น pre-test / post-test):') || '').trim()
    : '';

  return {
    gameId: 'balance-hold',
    playerId: participant || 'anon',
    mode,
    difficulty: 'normal',
    phase,
    filePrefix: 'vrfitness_balance',
  };
}

function startGame(selectedMode){
  mode = selectedMode;
  const meta = createMeta();
  logger = createCSVLogger(meta);

  state = {
    startTime: performance.now(),
    elapsed: 0,
    stopped: false
  };

  if (elStatus) elStatus.textContent = 'ยืนให้นิ่งที่สุด แล้วกดปุ่ม "หยุด" เมื่อรู้สึกเริ่มเสียสมดุล';
  elTimer.textContent = '0.0';
  show('play');

  rafId = requestAnimationFrame(loop);
}

function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const seconds = state.elapsed / 1000;

  const finalState = {
    endedBy,
    score: seconds,  // ใช้เวลาเป็นคะแนนโดยตรง
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    elapsedMs: state.elapsed,
    playerHP: 0,
    bossIndex:'',
    analytics:{
      totalSpawns: 0,
      totalHits: 0,
      normalHits: 0,
      decoyHits: 0,
      expiredMisses: 0,
      accuracy: 0,
      avgReactionNormal: 0,
      avgReactionDecoy: 0
    }
  };

  if (logger) logger.finish(finalState);

  recordSession('balance-hold', {
    mode,
    difficulty: 'normal',
    score: seconds,
    maxCombo: 0,
    missCount: 0,
    totalHits: 0,
    accuracy: 0
  });

  elRTime.textContent = seconds.toFixed(1);
  show('result');
  state = null;
}

function loop(now){
  if (!state) return;
  state.elapsed = now - state.startTime;

  if (state.elapsed >= MAX_DURATION_MS){
    stopGame('timeout');
    return;
  }

  elTimer.textContent = (state.elapsed/1000).toFixed(1);
  rafId = requestAnimationFrame(loop);
}

// wiring
function init(){
  $$('#menu [data-start]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-start') || 'normal';
      startGame(m);
    });
  });

  $('[data-stop]')?.addEventListener('click', ()=>{
    if (state) stopGame('manual');
  });

  $('[data-retry]')?.addEventListener('click', ()=> show('menu'));

  show('menu');
}

window.addEventListener('DOMContentLoaded', init);
