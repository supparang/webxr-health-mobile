// fitness/js/rhythm-boxer.js
'use strict';

import { createCSVLogger } from './logger-csv.js';
import { recordSession } from './stats-store.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const elMenu   = $('#menu');
const elPlay   = $('#play');
const elResult = $('#result');

const elTrack = $('#beat-track');
const elScore = $('#score');
const elRScore = $('#r-score');

let mode = 'normal';
let state = null;
let logger = null;
let rafId = null;

const CONFIG = {
  durationMs: 60000,
  beatIntervalMs: 650,   // จังหวะต่อ beat
  earlyWindowMs: 180,    // perfect window
  lateWindowMs: 260,     // good window
};

function show(id){
  [elMenu, elPlay, elResult].forEach(el => el.classList.add('hidden'));
  (id === 'menu' ? elMenu : id === 'play' ? elPlay : elResult).classList.remove('hidden');
}

function createSessionMeta(){
  const participant = (mode === 'research')
    ? (prompt('Participant ID (เว้นว่างได้):') || '').trim()
    : `RBOX-${Date.now()}`;

  const phase = (mode === 'research')
    ? (prompt('Phase (เช่น pre-test / post-test):') || '').trim()
    : '';

  return {
    gameId: 'rhythm-boxer',
    playerId: participant || 'anon',
    mode,
    difficulty: 'normal',
    phase,
    filePrefix: 'vrfitness_rhythm',
  };
}

function startGame(selectedMode){
  mode = selectedMode;
  const meta = createSessionMeta();
  logger = createCSVLogger(meta);

  state = {
    startTime: 0,
    elapsed: 0,
    nextBeatAt: 0,
    notes: [],   // {id, beatTime, createdAt, hit:false, el}
    lastId: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    missCount: 0,
    totalBeats: 0,
    totalHits: 0,
    sumReactionMs: 0,
  };

  if (elTrack) elTrack.innerHTML = '';
  elScore.textContent = '0';
  show('play');

  const now = performance.now();
  state.startTime = now;
  state.nextBeatAt = now + 600; // เวลานำเข้า beat แรก
  loop(now);
}

function stopGame(endedBy){
  if (!state) return;
  if (rafId != null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const dur = state.elapsed;
  const accuracy = state.totalBeats
    ? state.totalHits / state.totalBeats
    : 0;
  const avgRT = state.totalHits
    ? state.sumReactionMs / state.totalHits
    : 0;

  const finalState = {
    endedBy,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    elapsedMs: dur,
    playerHP: 0,
    bossIndex: '',
    analytics: {
      totalSpawns: state.totalBeats,
      totalHits: state.totalHits,
      normalHits: state.totalHits,
      decoyHits: 0,
      expiredMisses: state.missCount,
      accuracy,
      avgReactionNormal: avgRT,
      avgReactionDecoy: 0
    }
  };

  if (logger) logger.finish(finalState);

  // บันทึกลง Dashboard
  recordSession('rhythm-boxer', {
    mode,
    difficulty: 'normal',
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: state.totalHits,
    accuracy,
    avgReactionMs: avgRT
  });

  elRScore.textContent = String(state.score);
  show('result');
  state = null;
}

function loop(now){
  if (!state) return;
  state.elapsed = now - state.startTime;

  if (state.elapsed >= CONFIG.durationMs){
    stopGame('timeout');
    return;
  }

  // spawn beat note
  if (now >= state.nextBeatAt){
    spawnNote(state.nextBeatAt);
    state.nextBeatAt += CONFIG.beatIntervalMs;
  }

  // check expire (ถ้าเลย beat + window แล้วยังไม่โดนกด)
  const expireAfter = CONFIG.lateWindowMs + 160;
  const toRemove = [];
  for (const note of state.notes){
    if (!note.hit && now >= note.beatTime + expireAfter){
      state.missCount++;
      state.combo = 0;
      toRemove.push(note);
      if (logger) {
        logger.logExpire({
          id: note.id,
          type: 'note',
          t: now,
          playerHP: '',
          bossIndex: '',
          bossHP: '',
          bossPhase: '',
          result: 'miss'
        });
      }
      if (note.el && note.el.parentElement){
        note.el.style.opacity = '0.25';
        setTimeout(()=>note.el && note.el.remove(), 150);
      }
    }
  }
  if (toRemove.length){
    state.notes = state.notes.filter(n => !toRemove.includes(n));
  }

  rafId = requestAnimationFrame(loop);
}

function spawnNote(beatTime){
  const id = state.lastId++;
  state.totalBeats++;

  const el = document.createElement('div');
  el.className = 'rb-note';
  el.textContent = '🥊';
  el.style.position = 'absolute';
  el.style.left = '50%';
  el.style.top = (30 + Math.random()*40) + '%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.fontSize = '32px';
  el.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))';
  el.style.transition = 'transform .08s ease-out';

  const note = { id, beatTime, createdAt: performance.now(), hit:false, el };
  state.notes.push(note);

  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    handleHit(note);
  }, { passive:false });

  elTrack.appendChild(el);

  if (logger){
    logger.logSpawn({
      id,
      type:'note',
      x:50,
      y:0,
      t:beatTime,
      bossIndex:'',
      bossHP:'',
      bossPhase:''
    });
  }
}

function handleHit(note){
  if (!state || note.hit) return;
  note.hit = true;
  const now = performance.now();
  const dt = Math.abs(now - note.beatTime);
  const life = dt; // ใช้เป็น reaction

  let quality = 'bad';
  let deltaScore = 0;

  if (dt <= CONFIG.earlyWindowMs){
    quality = 'perfect';
    deltaScore = 15;
    state.combo++;
  } else if (dt <= CONFIG.lateWindowMs){
    quality = 'good';
    deltaScore = 8;
    state.combo++;
  } else {
    quality = 'late';
    deltaScore = 3;
    state.combo = 0;
  }

  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  state.score += deltaScore;
  state.totalHits++;
  state.sumReactionMs += life;
  elScore.textContent = String(state.score);

  // effect เล็ก ๆ
  if (note.el){
    note.el.style.transform = 'translate(-50%, -60%) scale(1.1)';
    note.el.style.opacity = '0';
    setTimeout(()=>note.el && note.el.remove(), 120);
  }

  if (logger){
    logger.logHit({
      id: note.id,
      type:'note',
      result: quality,
      score: state.score,
      combo: state.combo,
      missCount: state.missCount,
      playerHP:'',
      t: now,
      reactionMs: life,
      bossIndex:'',
      bossHP:'',
      bossPhase:'',
      feverActive:false,
      extra:{ quality }
    });
  }

  state.notes = state.notes.filter(n => n !== note);
}

// ---- wiring ----

function init(){
  $$('#menu [data-start]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-start') || 'normal';
      startGame(m);
    });
  });

  $('[data-stop]')?.addEventListener('click', ()=>{
    stopGame('manual');
  });

  $('[data-retry]')?.addEventListener('click', ()=>{
    show('menu');
  });

  show('menu');
}

window.addEventListener('DOMContentLoaded', init);
