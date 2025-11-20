// === fitness/js/rhythm-boxer.js ===
'use strict';

import { RhythmEngine } from './rhythm-engine.js';

window.addEventListener('DOMContentLoaded', () => {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const views = {
    menu:   $('#view-menu'),
    play:   $('#view-play'),
    result: $('#view-result')
  };

  function showView(name){
    Object.keys(views).forEach(k => {
      views[k].classList.toggle('hidden', k !== name);
    });
  }

  // controls
  const selMode  = $('#rb-mode');
  const selDiff  = $('#rb-diff');
  const selTrack = $('#rb-track');

  const btnStart   = $('#btn-start-rhythm');
  const btnStop    = $('#rb-btn-stop');
  const btnRetry   = $('#rb-btn-retry');
  const btnBackRes = $('#rb-btn-back-menu');

  // HUD
  const statMode    = $('#rb-stat-mode');
  const statDiff    = $('#rb-stat-diff');
  const statTrack   = $('#rb-stat-track');
  const statTime    = $('#rb-stat-time');
  const statScore   = $('#rb-stat-score');
  const statCombo   = $('#rb-stat-combo');
  const statPerfect = $('#rb-stat-perfect');
  const statMiss    = $('#rb-stat-miss');

  const popupJudge  = $('#rb-judge-popup');
  const coachText   = $('#rb-coach-text');

  // Result
  const resMode     = $('#rb-res-mode');
  const resDiff     = $('#rb-res-diff');
  const resTrack    = $('#rb-res-track');
  const resScore    = $('#rb-res-score');
  const resMaxcombo = $('#rb-res-maxcombo');
  const resPerfect  = $('#rb-res-perfect');
  const resMiss     = $('#rb-res-miss');
  const resAcc      = $('#rb-res-acc');
  const resRt       = $('#rb-res-rt');

  // lanes (DOM notes)
  const laneContainers = {
    0: document.querySelector('.rb-lane[data-lane="0"] .rb-lane-notes'),
    1: document.querySelector('.rb-lane[data-lane="1"] .rb-lane-notes'),
    2: document.querySelector('.rb-lane[data-lane="2"] .rb-lane-notes')
  };

  // === SFX & MUSIC ===
  const sfx = {
    start: $('#rb-sfx-start'),
    hit:   $('#rb-sfx-hit'),
    miss:  $('#rb-sfx-miss')
  };
  const musicEls = {
    track1: $('#rb-music-track1'),
    track2: $('#rb-music-track2'),
    track3: $('#rb-music-track3')
  };

  function playSfx(el){
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch(e){}
  }

  function stopAllMusic(){
    Object.values(musicEls).forEach(m => {
      if (!m) return;
      try {
        m.pause();
        m.currentTime = 0;
      } catch(e){}
    });
  }

  function startMusicForTrack(track){
    stopAllMusic();
    const m = musicEls[track] || musicEls.track1;
    if (!m) return;
    try {
      m.currentTime = 0;
      m.play().catch(() => {});
    } catch(e){}
  }

  let engine = null;
  let currentConfig = null;
  const noteElements = new Map(); // id -> element

  const TRAVEL_SEC = 1.2;  // sync กับ CSS rb-fall

  function clearNotes() {
    noteElements.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    noteElements.clear();
  }

  function buildNoteDOMs(notes) {
    clearNotes();
    if (!notes) return;

    for (const n of notes) {
      const host = laneContainers[n.lane];
      if (!host) continue;
      const el = document.createElement('div');
      el.className = 'rb-note lane-' + n.lane;
      el.textContent = '●';

      const delaySec = Math.max(0, n.timeSec - TRAVEL_SEC);
      el.style.animationDuration = TRAVEL_SEC + 's';
      el.style.animationDelay = delaySec + 's';

      el.dataset.id = String(n.id);
      host.appendChild(el);
      noteElements.set(n.id, el);
    }
  }

  function updateHUD(state){
    if (!state) return;
    const diffLabel = state.diff === 'easy' ? 'ง่าย' :
      (state.diff === 'hard' ? 'ยาก' : 'ปกติ');

    statMode.textContent  = state.mode === 'research' ? 'วิจัย' : 'ปกติ';
    statDiff.textContent  = diffLabel;
    statTrack.textContent = trackLabel(state.track);

    statTime.textContent    = state.timeSec.toFixed(1);
    statScore.textContent   = state.score;
    statCombo.textContent   = state.combo;
    statPerfect.textContent = state.perfect;
    statMiss.textContent    = state.miss;

    // coach hint เล็ก ๆ
    if (state.timeSec < 10){
      coachText.textContent = 'เริ่ม warm-up ก่อน ฟังจังหวะให้ชัด ๆ 🎧';
    } else if (state.combo >= 10){
      coachText.textContent = 'เยี่ยม! combo ยาวแล้ว รักษาจังหวะให้ดี 💪';
    } else if (state.miss >= 5){
      coachText.textContent = 'ลองโฟกัสที่เส้น hit line แล้วกดให้ตรงกว่านี้นะ ✨';
    } else if (state.timeSec > 40){
      coachText.textContent = 'ใกล้ cool-down แล้ว ลองเร่ง Perfect ช่วงท้ายดู 😄';
    }
  }

  function trackLabel(key){
    if (key === 'track2') return 'Track 2 — Cardio Beat';
    if (key === 'track3') return 'Track 3 — Hero Combo';
    return 'Track 1 — Warm-up Mix';
  }

  function showJudgePopup(grade){
    popupJudge.classList.remove(
      'rb-judge-perfect',
      'rb-judge-good',
      'rb-judge-miss',
      'show'
    );
    if (grade === 'perfect'){
      popupJudge.textContent = 'PERFECT';
      popupJudge.classList.add('rb-judge-perfect');
    } else if (grade === 'good'){
      popupJudge.textContent = 'GOOD';
      popupJudge.classList.add('rb-judge-good');
    } else {
      popupJudge.textContent = 'MISS';
      popupJudge.classList.add('rb-judge-miss');
    }
    // trigger animation
    void popupJudge.offsetWidth; // force reflow
    popupJudge.classList.add('show');
  }

  function startGameFromMenu(){
    const mode  = selMode.value  || 'normal';
    const diff  = selDiff.value  || 'normal';
    const track = selTrack.value || 'track1';

    // สร้าง engine ใหม่
    engine = new RhythmEngine({
      mode,
      diff,
      track,
      durationSec: 70,
      onState: updateHUD,
      onEnd(result){
        stopAllMusic();
        engine = null;
        showResult(result);
      },
      onJudge(note, judge){
        const el = noteElements.get(note.id);
        if (el){
          el.style.opacity = '0.1';
          el.style.filter = judge.grade === 'miss' ? 'grayscale(1)' : 'none';
        }
        // SFX hit / miss
        if (judge.grade === 'miss'){
          playSfx(sfx.miss);
        } else {
          playSfx(sfx.hit);
        }
        showJudgePopup(judge.grade);
      }
    });

    currentConfig = { mode, diff, track };

    // สร้าง note DOM จาก engine.notes
    buildNoteDOMs(engine.notes);

    showView('play');

    // เล่น SFX start + เพลง track
    playSfx(sfx.start);
    startMusicForTrack(track);

    engine.start();
  }

  function showResult(result){
    showView('result');

    const diffLabel = result.diff === 'easy' ? 'ง่าย' :
      (result.diff === 'hard' ? 'ยาก' : 'ปกติ');

    resMode.textContent     = result.mode === 'research' ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
    resDiff.textContent     = diffLabel;
    resTrack.textContent    = trackLabel(result.track);
    resScore.textContent    = result.score;
    resMaxcombo.textContent = result.comboMax;
    resPerfect.textContent  = result.perfect;
    resMiss.textContent     = result.miss;
    resAcc.textContent      = result.accuracy.toFixed(1) + ' %';
    resRt.textContent       = result.avgRtMs ? result.avgRtMs.toFixed(0) + ' ms' : '-';

    clearNotes();
  }

  function stopGameByUser(){
    if (engine){
      engine.stop('user_stop');
      engine = null;
    }
    stopAllMusic();
  }

  // -------- keyboard control (PC) --------
  window.addEventListener('keydown', (ev) => {
    if (!engine) return;
    let lane = null;
    if (ev.code === 'KeyW' || ev.code === 'ArrowUp'){
      lane = 0;
    } else if (ev.code === 'Space'){
      lane = 1;
      ev.preventDefault();
    } else if (ev.code === 'KeyS' || ev.code === 'ArrowDown'){
      lane = 2;
    }
    if (lane != null){
      engine.hitLane(lane);
    }
  });

  // -------- touch zones (mobile) --------
  $$('.rb-touch-zone').forEach(z => {
    z.addEventListener('pointerdown', () => {
      if (!engine) return;
      const lane = parseInt(z.dataset.lane, 10);
      if (!isNaN(lane)){
        engine.hitLane(lane);
      }
    });
  });

  // -------- buttons --------
  btnStart.addEventListener('click', () => {
    startGameFromMenu();
  });

  btnStop.addEventListener('click', () => {
    stopGameByUser();
  });

  btnRetry.addEventListener('click', () => {
    // กลับไปเมนู พร้อมตั้งค่าตามรอบล่าสุด
    if (currentConfig){
      const {mode,diff,track} = currentConfig;
      selMode.value  = mode;
      selDiff.value  = diff;
      selTrack.value = track;
    }
    showView('menu');
  });

  btnBackRes.addEventListener('click', () => {
    showView('menu');
  });

  // initial
  showView('menu');
});
