// === fitness/js/rhythm-engine.js — Rhythm Boxer (popup + shard FX, 2025-11-30) ===
'use strict';

(function(){

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4];                // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };
  const PRE_SPAWN_SEC = 2.0;

  const TRACKS = [
    {
      id: 't1',
      name: 'Warm-up Groove (ง่าย)',
      audio: 'audio/warmup-groove.mp3',
      duration: 32,
      bpm: 100,
      diff: 'easy',
      chart: makeWarmupChart(100, 32)
    }
  ];

  // ===== UTIL =====
  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
  function $(id){ return document.getElementById(id); }

  // ===== CHART GEN =====
  function makeWarmupChart(bpm, dur){
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;

    const seq = [2,1,3,2,1,3,2,3];  // เน้น lane กลางซ้าย/ขวา
    const total = Math.floor((dur - 3) / beat);

    let i = 0;
    while (t < dur - 2 && i < total){
      out.push({ time: t, lane: seq[i % seq.length], type: 'note' });
      t += beat;
      i++;
    }

    // ตัวอย่างโน้ต HP / Shield ตอนท้าย (ยังไม่ใช้เต็มที่ตอนนี้)
    out.push({ time: t + beat * 0.5, lane: 0, type: 'hp' });
    out.push({ time: t + beat * 1.5, lane: 4, type: 'shield' });

    return out;
  }

  // ===== STATE =====
  let lanesEl, elField, hitLineEl, feedbackEl, flashEl;
  let hudScore, hudCombo, hudAcc, hudHp, hudShield, hudTime;

  let score = 0;
  let combo = 0;
  let hp = 100;
  let shield = 0;
  let fever = 0;
  let feverActive = false;

  let started = false;
  let running = false;
  let startPerf = 0;
  let lastPerf = 0;
  let currentSongTime = 0;

  let activeNotes = [];
  let chartIndex = 0;
  let currentTrack = TRACKS[0];

  // ===== INIT =====
  function init(){
    lanesEl    = $('rb-lanes');
    elField    = $('rb-field');
    hitLineEl  = document.querySelector('.rb-hit-line');
    feedbackEl = $('rb-feedback');
    flashEl    = $('rb-flash');

    hudScore   = $('rb-hud-score');
    hudCombo   = $('rb-hud-combo');
    hudAcc     = $('rb-hud-acc');   // ยังไม่คำนวณละเอียด
    hudHp      = $('rb-hud-hp');
    hudShield  = $('rb-hud-shield');
    hudTime    = $('rb-hud-time');

    const btnStart = $('rb-btn-start');
    if (btnStart) btnStart.addEventListener('click', startGame);

    if (lanesEl){
      lanesEl.addEventListener('pointerdown', onLaneTap);
    }
  }

  // ===== GAME FLOW =====
  function startGame(){
    started = false;
    running = false;

    score = 0;
    combo = 0;
    hp    = 100;
    shield = 0;
    fever  = 0;
    feverActive = false;

    activeNotes = [];
    chartIndex  = 0;

    // reset HUD
    updateHUD();
    setAcc(0);

    // show play view
    const viewMenu  = $('rb-view-menu');
    const viewPlay  = $('rb-view-play');
    const viewRes   = $('rb-view-result');

    if (viewMenu) viewMenu.classList.add('hidden');
    if (viewRes)  viewRes.classList.add('hidden');
    if (viewPlay) viewPlay.classList.remove('hidden');

    showFeedback('แตะ lane เพื่อเริ่มเพลง 🎵');

    // เตรียม track (ตอนนี้เลือก t1 ตายตัว)
    currentTrack = TRACKS[0];
  }

  function handleFirstTap(){
    if (started) return;
    started = true;
    running = true;
    startPerf = performance.now();
    lastPerf  = startPerf;
    currentSongTime = 0;

    requestAnimationFrame(loop);
  }

  function loop(now){
    if (!running) return;

    const dt = (now - lastPerf) / 1000;
    const t  = (now - startPerf) / 1000;
    lastPerf = now;
    currentSongTime = t;

    const dur = currentTrack.duration || 30;

    updateTimeline(t, dt);
    updateHUD();

    if (t >= dur){
      running = false;
      showFeedback('เพลงจบแล้ว! ✅', null);
      // TODO: ไปหน้า RESULT + สรุป
      return;
    }

    requestAnimationFrame(loop);
  }

  // ===== TIMELINE =====
  function updateTimeline(songTime, dt){
    spawnNotes(songTime);
    updateNotePositions(songTime);
    autoJudgeMiss(songTime);

    // effect เส้นตี
    if (hitLineEl){
      const phase = (songTime * (currentTrack.bpm || 100) / 60) % 1;
      hitLineEl.style.opacity = phase < 0.15 ? 1 : 0.6;
    }
  }

  function spawnNotes(songTime){
    const chart = currentTrack.chart;
    const pre   = PRE_SPAWN_SEC;

    while (chartIndex < chart.length && chart[chartIndex].time <= songTime + pre){
      createNote(chart[chartIndex]);
      chartIndex++;
    }
  }

  function createNote(info){
    const laneIndex = clamp(info.lane | 0, 0, 4);
    if (!lanesEl) return;

    const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if (!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';
    inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    noteEl.appendChild(inner);

    laneEl.appendChild(noteEl);

    // ปรับ opacity ให้ค่อย ๆ เข้ามา
    requestAnimationFrame(() => {
      noteEl.classList.add('rb-note-spawned');
    });

    activeNotes.push({
      lane: laneIndex,
      time: info.time,
      type: info.type || 'note',
      el: noteEl,
      judged: false,
      removed: false
    });
  }

  // ให้โน้ตตกจากด้านบน → เส้นตี
  function updateNotePositions(songTime){
    if (!lanesEl) return;
    const rect = lanesEl.getBoundingClientRect();
    const h = rect.height || 1;
    const pre = PRE_SPAWN_SEC;
    const travel = h * 0.85;

    for (const n of activeNotes){
      if (!n.el || n.removed) continue;
      const dt = n.time - songTime;
      const progress = 1 - (dt / pre);      // 0 → ยังไม่โผล่, 1 → ถึงเส้นตี
      const pClamp   = clamp(progress, 0, 1.2);
      const y = (pClamp - 1) * travel;      // เริ่มที่ด้านบน ค่อย ๆ ลงมา

      n.el.style.transform = `translateX(-50%) translateY(${y}px)`;
      n.el.style.opacity   = (pClamp <= 1.0) ? 1 : clamp(1.2 - pClamp, 0, 1);
    }
  }

  function autoJudgeMiss(songTime){
    const missWindow = HIT_WINDOWS.good + 0.05;
    for (const n of activeNotes){
      if (n.judged) continue;
      if (songTime > n.time + missWindow){
        applyMiss(n);
      }
    }
    activeNotes = activeNotes.filter(n => !n.removed);
  }

  // ===== INPUT =====
  function onLaneTap(ev){
    if (!running){
      handleFirstTap();
      return;
    }
    const laneEl = ev.target.closest('.rb-lane');
    if (!laneEl) return;

    const lane = parseInt(laneEl.dataset.lane || '0', 10);
    const near = activeNotes.find(n => !n.judged && n.lane === lane);
    if (near){
      applyHit(near);
    } else {
      // tap ว่าง ๆ อาจถือเป็น miss เบา ๆ ได้ภายหลัง
    }
  }

  // ===== JUDGE & FX =====
  function applyHit(n){
    n.judged = true;
    n.removed = true;
    if (n.el) n.el.remove();

    const baseScore = 100;
    const grade = 'perfect'; // ตอนนี้ยังไม่แยก perfect/great/good ตาม timing
    score += baseScore;
    combo++;

    updateHUD();
    showFeedback('Perfect! 🎯', 'perfect');
    spawnScorePopup(n, grade, baseScore);
  }

  function applyMiss(n){
    n.judged = true;
    n.removed = true;
    if (n.el) n.el.remove();

    combo = 0;
    hp = clamp(hp - 5, 0, 100);
    updateHUD();

    showFeedback('พลาดจังหวะ! 🎧', 'miss');
    spawnScorePopup(n, 'miss', 0);

    // shake field + flash เบา ๆ
    if (elField){
      elField.classList.add('rb-shake');
      setTimeout(() => elField.classList.remove('rb-shake'), 300);
    }
    if (flashEl){
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 120);
    }
  }

  function spawnHitParticlesAt(x, y, grade){
    if (!elField) return;
    const count  = grade === 'perfect' ? 12 : grade === 'great' ? 9 : 7;
    const emoji  = grade === 'miss' ? '💥' : '✨';
    const spread = grade === 'perfect' ? 32 : 26;

    for (let i = 0; i < count; i++){
      const shard = document.createElement('div');
      shard.className = 'rb-hit-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist  = spread + Math.random() * 18;

      shard.style.left = x + 'px';
      shard.style.top  = y + 'px';
      shard.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
      shard.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
      shard.textContent = emoji;

      elField.appendChild(shard);
      setTimeout(() => shard.remove(), 550);
    }
  }

  function spawnScorePopup(note, grade, scoreDelta){
    if (!elField || !note || !note.el) return;

    const noteRect  = note.el.getBoundingClientRect();
    const fieldRect = elField.getBoundingClientRect();

    const x = noteRect.left + noteRect.width  / 2 - fieldRect.left;
    const y = noteRect.top  + noteRect.height / 2 - fieldRect.top - 4;

    const pop = document.createElement('div');
    pop.className = 'rb-score-popup';

    let label = '';
    if (grade === 'perfect'){
      pop.classList.add('rb-score-perfect');
      label = `PERFECT +${scoreDelta}`;
    } else if (grade === 'great'){
      pop.classList.add('rb-score-great');
      label = `GREAT +${scoreDelta}`;
    } else if (grade === 'good'){
      pop.classList.add('rb-score-good');
      label = `GOOD +${scoreDelta}`;
    } else if (grade === 'miss'){
      pop.classList.add('rb-score-miss');
      label = 'MISS';
    } else {
      label = `+${scoreDelta}`;
    }

    pop.textContent = label;
    pop.style.left  = x + 'px';
    pop.style.top   = y + 'px';

    elField.appendChild(pop);
    setTimeout(() => pop.remove(), 600);

    // เศษเป้าแตกกระจายรอบ ๆ จุดเดียวกัน
    spawnHitParticlesAt(x, y, grade);
  }

  // ===== HUD / FEEDBACK =====
  function updateHUD(){
    if (hudScore)  hudScore.textContent = score;
    if (hudCombo)  hudCombo.textContent = combo;
    if (hudHp)     hudHp.textContent    = hp;
    if (hudShield) hudShield.textContent = shield;
    if (hudTime)   hudTime.textContent  = currentSongTime.toFixed(1);
    // ยังไม่ได้อัปเดต Accuracy / FEVER / Progress detail ในเวอร์ชันย่อ
  }

  function setAcc(pct){
    if (!hudAcc) return;
    hudAcc.textContent = pct.toFixed(1) + '%';
  }

  function showFeedback(msg, grade){
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.remove('perfect','good','miss','bomb');
    if (grade){
      feedbackEl.classList.add(grade);
    }
  }

  // ===== BOOT =====
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
