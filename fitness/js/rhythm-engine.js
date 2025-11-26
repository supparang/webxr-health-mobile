// === fitness/js/rhythm-engine.js — Rhythm Boxer (FEVER + Result + FX, 2025-12-01) ===
'use strict';

(function(){

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4];               // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵','🎶','🎵','🎶','🎼'];

  // หน้าต่างเวลา (วินาที) สำหรับ Perfect / Great / Good
  const HIT_WINDOWS = {
    perfect: 0.06,
    great  : 0.12,
    good   : 0.20
  };
  const MISS_EXTRA = 0.05;                     // + เผื่อเวลา auto miss

  const PRE_SPAWN_SEC = 2.0;                   // โน้ตออกมาก่อนถึงเส้นตี

  // คะแนนต่อ hit (ถ้าอยู่ใน FEVER จะคูณเพิ่มด้านล่าง)
  const SCORE_PER_HIT = {
    perfect: 300,
    great  : 220,
    good   : 150
  };

  // FEVER
  const FEVER_GAIN = { perfect: 14, great: 10, good: 7 };
  const FEVER_DECAY_IDLE = 10;                 // /sec ตอนยังไม่เข้า FEVER
  const FEVER_DECAY_ACTIVE = 25;               // /sec ตอนกำลัง FEVER
  const FEVER_THRESHOLD = 70;
  const FEVER_MAX = 100;

  // TRACKS (ตอนนี้มี track เดียว แต่รองรับเพิ่ม)
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
  const clamp = (v, a, b)=> v < a ? a : (v > b ? b : v);
  const $      = (id)=> document.getElementById(id);

  function mean(arr){
    if(!arr.length) return 0;
    return arr.reduce((s,v)=>s+v,0)/arr.length;
  }
  function std(arr){
    if(arr.length < 2) return 0;
    const m = mean(arr);
    const v = arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(arr.length-1);
    return Math.sqrt(v);
  }

  // ===== CHART GEN ตัวอย่าง =====
  function makeWarmupChart(bpm, dur){
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;

    const seq = [2,1,3,2,1,3,2,3];            // pattern 8 beat
    const total = Math.floor((dur-3)/beat);
    let i = 0;

    while(t < dur-2 && i < total){
      out.push({ time:t, lane:seq[i % seq.length], type:'note' });
      t += beat;
      i++;
    }

    // sample HP / shield (ยังไม่ได้ใช้ mechanic พิเศษ)
    out.push({ time:t+beat*0.5,  lane:0, type:'hp' });
    out.push({ time:t+beat*1.5, lane:4, type:'shield' });

    return out;
  }

  // ===== DOM refs =====
  let wrapEl, lanesEl, elField, hitLineEl, feedbackEl, flashEl;
  let hudMode, hudTrack, hudScore, hudCombo, hudAcc, hudHp, hudShield, hudTime;
  let hudPerfect, hudGreat, hudGood, hudMiss;
  let feverFill, feverStatus, progFill, progText;

  let viewMenu, viewPlay, viewResult;
  let btnStop, btnAgain, btnBackMenu;

  // ===== STATE =====
  let score=0, combo=0, maxCombo=0;
  let hp=100, shield=0;
  let fever=0, feverActive=false, feverTimeTotal=0;
  let started=false, running=false;
  let startPerf=0, lastPerf=0, currentSongTime=0;
  let currentMode='normal';
  let currentTrack = TRACKS[0];

  let activeNotes=[];
  let chartIndex=0;

  // สถิติวิจัย
  let hitPerfect=0, hitGreat=0, hitGood=0, hitMiss=0;
  let offsets=[];                              // off จากเป้าปกติ (วินาที)

  // ===== INIT =====
  function init(){
    wrapEl      = $('rb-wrap');
    lanesEl     = $('rb-lanes');
    elField     = $('rb-field');
    hitLineEl   = document.querySelector('.rb-hit-line');
    feedbackEl  = $('rb-feedback');
    flashEl     = $('rb-flash');

    hudMode   = $('rb-hud-mode');
    hudTrack  = $('rb-hud-track');
    hudScore  = $('rb-hud-score');
    hudCombo  = $('rb-hud-combo');
    hudAcc    = $('rb-hud-acc');
    hudHp     = $('rb-hud-hp');
    hudShield = $('rb-hud-shield');
    hudTime   = $('rb-hud-time');

    hudPerfect = $('rb-hud-perfect');
    hudGreat   = $('rb-hud-great');
    hudGood    = $('rb-hud-good');
    hudMiss    = $('rb-hud-miss');

    feverFill   = $('rb-fever-fill');
    feverStatus = $('rb-fever-status');
    progFill    = $('rb-progress-fill');
    progText    = $('rb-progress-text');

    viewMenu   = $('rb-view-menu');
    viewPlay   = $('rb-view-play');
    viewResult = $('rb-view-result');

    btnStop      = $('rb-btn-stop');
    btnAgain     = $('rb-btn-again');
    btnBackMenu  = $('rb-btn-back-menu');

    const btnStart = $('rb-btn-start');
    if(btnStart)  btnStart.addEventListener('click', startGameFromMenu);
    if(btnStop)   btnStop.addEventListener('click', ()=> endGame('manual-stop'));
    if(btnAgain)  btnAgain.addEventListener('click', ()=> restartSameTrack());
    if(btnBackMenu) btnBackMenu.addEventListener('click', ()=> gotoMenu());

    if(lanesEl){
      lanesEl.addEventListener('pointerdown', onLaneTap);
    }

    resetHUD();
  }

  // ===== GAME START / RESTART =====
  function getTrackConfigFromMenu(){
    const modeRadio = document.querySelector('input[name="mode"]:checked');
    currentMode = (modeRadio && modeRadio.value === 'research') ? 'research' : 'normal';

    const select = $('rb-track');
    const chosen = select ? select.value : 't1';
    const found = TRACKS.find(t=>t.id===chosen) || TRACKS[0];
    currentTrack = found;

    if(wrapEl){
      wrapEl.setAttribute('data-diff', found.diff || 'normal');
    }
  }

  function startGameFromMenu(){
    getTrackConfigFromMenu();
    internalStartGame();
  }

  function restartSameTrack(){
    // เริ่มใหม่ด้วย mode/track เดิม
    internalStartGame();
  }

  function internalStartGame(){
    // reset core state
    score = 0; combo = 0; maxCombo = 0;
    hp = 100; shield = 0;
    fever = 0; feverActive = false; feverTimeTotal = 0;
    started = false; running = false;
    currentSongTime = 0;
    activeNotes = [];
    chartIndex  = 0;

    hitPerfect=hitGreat=hitGood=hitMiss=0;
    offsets = [];

    resetHUD();
    updateHUD(0);

    // switch view
    if(viewMenu)   viewMenu.classList.add('hidden');
    if(viewResult) viewResult.classList.add('hidden');
    if(viewPlay)   viewPlay.classList.remove('hidden');

    if(hudMode)  hudMode.textContent  = currentMode === 'research' ? 'Research' : 'Normal';
    if(hudTrack) hudTrack.textContent = currentTrack.name || 'Track';

    showFeedback('แตะ lane เพื่อเริ่มเพลง 🎵');

    // ตั้ง progress bar เริ่ม 0
    updateProgressBar(0);
    updateFeverBar();
  }

  // ===== MAIN LOOP =====
  function handleFirstTap(){
    if(started) return;
    started = true;
    running = true;
    startPerf = performance.now();
    lastPerf  = startPerf;
    currentSongTime = 0;

    requestAnimationFrame(loop);
  }

  function loop(now){
    if(!running) return;

    const dt = (now - lastPerf) / 1000;
    const t  = (now - startPerf) / 1000;
    lastPerf = now;
    currentSongTime = t;

    const dur = currentTrack.duration || 30;

    updateTimeline(t, dt, dur);
    updateHUD(dt);

    if(t >= dur){
      endGame('song-end');
      return;
    }

    requestAnimationFrame(loop);
  }

  function updateTimeline(songTime, dt, dur){
    spawnNotes(songTime);
    updateNotePositions(songTime);
    autoJudgeMiss(songTime);

    // เส้นตี
    if(hitLineEl){
      const phase = (songTime * (currentTrack.bpm || 100) / 60) % 1;
      hitLineEl.style.opacity = phase < 0.15 ? 1 : 0.6;
    }

    // FEVER + Progress
    updateFever(dt);
    updateProgressBar(songTime / dur);
  }

  // ===== NOTE MANAGEMENT =====
  function spawnNotes(songTime){
    const chart = currentTrack.chart;
    const pre   = PRE_SPAWN_SEC;

    while(chartIndex < chart.length && chart[chartIndex].time <= songTime + pre){
      createNote(chart[chartIndex]);
      chartIndex++;
    }
  }

  function createNote(info){
    const laneIndex = clamp(info.lane|0, 0, 4);
    if(!lanesEl) return;

    const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if(!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';
    inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    noteEl.appendChild(inner);

    laneEl.appendChild(noteEl);

    requestAnimationFrame(()=> noteEl.classList.add('rb-note-spawned'));

    activeNotes.push({
      lane: laneIndex,
      time: info.time,
      type: info.type || 'note',
      el:   noteEl,
      judged:false,
      removed:false
    });
  }

  function updateNotePositions(songTime){
    if(!lanesEl) return;
    const rect = lanesEl.getBoundingClientRect();
    const h    = rect.height || 1;
    const pre  = PRE_SPAWN_SEC;
    const travel = h * 0.85;

    for(const n of activeNotes){
      if(!n.el || n.removed) continue;
      const dt = n.time - songTime;
      const progress = 1 - (dt / pre);              // 0 → ยังไม่มา, 1 → ถึงเส้นตี
      const pClamp   = clamp(progress,0,1.2);
      const y = (pClamp - 1) * travel;

      n.el.style.transform = `translateX(-50%) translateY(${y}px)`;
      n.el.style.opacity   = (pClamp <= 1.0) ? 1 : clamp(1.2 - pClamp,0,1);
    }
  }

  function autoJudgeMiss(songTime){
    const missWindow = HIT_WINDOWS.good + MISS_EXTRA;
    for(const n of activeNotes){
      if(n.judged) continue;
      if(songTime > n.time + missWindow){
        applyMiss(n, 'late');
      }
    }
    activeNotes = activeNotes.filter(n => !n.removed);
  }

  // ===== INPUT / JUDGING =====
  function onLaneTap(ev){
    if(!running){
      handleFirstTap();
      return;
    }
    const laneEl = ev.target.closest('.rb-lane');
    if(!laneEl) return;

    const lane = parseInt(laneEl.dataset.lane || '0',10);

    const nowT = currentSongTime;
    let best=null, bestAbs=Infinity, bestOffset=0;

    for(const n of activeNotes){
      if(n.judged || n.lane !== lane) continue;
      const off = nowT - n.time;
      const abs = Math.abs(off);
      if(abs <= HIT_WINDOWS.good + 0.02 && abs < bestAbs){
        best = n; bestAbs = abs; bestOffset = off;
      }
    }

    if(!best){
      // แตะว่าง ๆ ไม่ตัด HP แต่เตือนเบา ๆ ได้ถ้าต้องการ
      return;
    }

    let grade;
    if(bestAbs <= HIT_WINDOWS.perfect)      grade = 'perfect';
    else if(bestAbs <= HIT_WINDOWS.great)   grade = 'great';
    else                                    grade = 'good';

    applyHit(best, grade, bestOffset);
  }

  function applyHit(n, grade, offset){
    n.judged  = true;
    n.removed = true;
    if(n.el) n.el.remove();

    const feverBoost = feverActive ? 1.3 : 1.0;
    const base = SCORE_PER_HIT[grade] || 100;
    const delta = Math.round(base * feverBoost);

    score += delta;
    combo++;
    if(combo > maxCombo) maxCombo = combo;

    // สถิติ
    if(grade === 'perfect') hitPerfect++;
    else if(grade === 'great') hitGreat++;
    else if(grade === 'good') hitGood++;
    offsets.push(offset);

    gainFever(FEVER_GAIN[grade] || 0);

    updateHUD(0);
    setAccuracy();

    showFeedback(grade === 'perfect' ? 'Perfect! 🎯' :
                 grade === 'great'   ? 'Great! 🔥' :
                 'Good! 🎵', 'perfect');

    spawnScorePopup(n, grade, delta);
  }

  function applyMiss(n, reason){
    n.judged  = true;
    n.removed = true;
    if(n.el) n.el.remove();

    combo = 0;
    hp = clamp(hp - 8, 0, 100);
    hitMiss++;

    updateHUD(0);
    setAccuracy();

    showFeedback('พลาดจังหวะ! 🎧', 'miss');
    spawnScorePopup(n, 'miss', 0);

    if(elField){
      elField.classList.add('rb-shake');
      setTimeout(()=> elField.classList.remove('rb-shake'), 300);
    }
    if(flashEl){
      flashEl.classList.add('active');
      setTimeout(()=> flashEl.classList.remove('active'), 120);
    }

    if(hp <= 0){
      endGame('hp-zero');
    }
  }

  // ===== FEVER / PROGRESS =====
  function gainFever(amount){
    if(amount <= 0) return;
    fever = clamp(fever + amount, 0, FEVER_MAX);
    if(!feverActive && fever >= FEVER_THRESHOLD){
      feverActive = true;
      if(feverStatus){
        feverStatus.textContent = 'FEVER!!';
        feverStatus.classList.add('on');
      }
    }
    updateFeverBar();
  }

  function updateFever(dt){
    if(feverActive){
      fever -= FEVER_DECAY_ACTIVE * dt;
      feverTimeTotal += dt;
      if(fever <= 0){
        fever = 0;
        feverActive = false;
        if(feverStatus){
          feverStatus.textContent = 'Ready';
          feverStatus.classList.remove('on');
        }
      }
    }else{
      fever -= FEVER_DECAY_IDLE * dt;
      if(fever < 0) fever = 0;
      if(feverStatus && fever < FEVER_THRESHOLD*0.6){
        feverStatus.textContent = 'Ready';
        feverStatus.classList.remove('on');
      }
    }
    updateFeverBar();
  }

  function updateFeverBar(){
    if(!feverFill) return;
    const r = FEVER_MAX ? (fever/FEVER_MAX) : 0;
    feverFill.style.transform = `scaleX(${clamp(r,0,1)})`;
  }

  function updateProgressBar(norm){
    const r = clamp(norm,0,1);
    if(progFill) progFill.style.transform = `scaleX(${r})`;
    if(progText) progText.textContent = Math.round(r*100) + '%';
  }

  // ===== HUD / FEEDBACK =====
  function resetHUD(){
    if(hudScore)  hudScore.textContent = '0';
    if(hudCombo)  hudCombo.textContent = '0';
    if(hudAcc)    hudAcc.textContent   = '0.0%';
    if(hudHp)     hudHp.textContent    = '100';
    if(hudShield) hudShield.textContent= '0';
    if(hudTime)   hudTime.textContent  = '0.0';

    if(hudPerfect) hudPerfect.textContent = '0';
    if(hudGreat)   hudGreat.textContent   = '0';
    if(hudGood)    hudGood.textContent    = '0';
    if(hudMiss)    hudMiss.textContent    = '0';

    if(feverStatus){
      feverStatus.textContent = 'FEVER';
      feverStatus.classList.remove('on');
    }
    updateFeverBar();
    updateProgressBar(0);
  }

  function updateHUD(/*dt*/){
    if(hudScore)  hudScore.textContent  = String(score);
    if(hudCombo)  hudCombo.textContent  = String(combo);
    if(hudHp)     hudHp.textContent     = String(hp);
    if(hudShield) hudShield.textContent = String(shield);
    if(hudTime)   hudTime.textContent   = currentSongTime.toFixed(1);

    if(hudPerfect) hudPerfect.textContent = String(hitPerfect);
    if(hudGreat)   hudGreat.textContent   = String(hitGreat);
    if(hudGood)    hudGood.textContent    = String(hitGood);
    if(hudMiss)    hudMiss.textContent    = String(hitMiss);
  }

  function setAccuracy(){
    const hits = hitPerfect + hitGreat + hitGood;
    const total = hits + hitMiss;
    const acc = total > 0 ? (hits / total) * 100 : 0;
    if(hudAcc) hudAcc.textContent = acc.toFixed(1) + '%';
    return acc;
  }

  function showFeedback(msg, grade){
    if(!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.remove('perfect','good','miss','bomb');
    if(grade) feedbackEl.classList.add(grade);
  }

  // ===== FX: popup + particles =====
  function spawnHitParticlesAt(x, y, grade){
    if(!elField) return;
    const count  = grade === 'perfect' ? 12 : grade === 'great' ? 9 : 7;
    const emoji  = grade === 'miss' ? '💥' : '✨';
    const spread = grade === 'perfect' ? 32 : 26;

    for(let i=0;i<count;i++){
      const shard = document.createElement('div');
      shard.className = 'rb-hit-particle';
      const angle = Math.random()*Math.PI*2;
      const dist  = spread + Math.random()*18;

      shard.style.left = x + 'px';
      shard.style.top  = y + 'px';
      shard.style.setProperty('--dx', (Math.cos(angle)*dist)+'px');
      shard.style.setProperty('--dy', (Math.sin(angle)*dist)+'px');
      shard.textContent = emoji;

      elField.appendChild(shard);
      setTimeout(()=> shard.remove(), 550);
    }
  }

  function spawnScorePopup(note, grade, scoreDelta){
    if(!elField || !note || !note.el) return;

    const noteRect  = note.el.getBoundingClientRect();
    const fieldRect = elField.getBoundingClientRect();

    const x = noteRect.left + noteRect.width/2  - fieldRect.left;
    const y = noteRect.top  + noteRect.height/2 - fieldRect.top - 4;

    const pop = document.createElement('div');
    pop.className = 'rb-score-popup';

    let label = '';
    if(grade === 'perfect'){
      pop.classList.add('rb-score-perfect');
      label = `PERFECT +${scoreDelta}`;
    }else if(grade === 'great'){
      pop.classList.add('rb-score-great');
      label = `GREAT +${scoreDelta}`;
    }else if(grade === 'good'){
      pop.classList.add('rb-score-good');
      label = `GOOD +${scoreDelta}`;
    }else if(grade === 'miss'){
      pop.classList.add('rb-score-miss');
      label = 'MISS';
    }else{
      label = `+${scoreDelta}`;
    }

    pop.textContent = label;
    pop.style.left  = x + 'px';
    pop.style.top   = y + 'px';

    elField.appendChild(pop);
    setTimeout(()=> pop.remove(), 600);

    spawnHitParticlesAt(x, y, grade);
  }

  // ===== END GAME / RESULT =====
  function endGame(reason){
    if(!started) return;
    running = false;

    // คำนวณ Accuracy / Offset
    const acc = setAccuracy();
    const mOffset = mean(offsets);
    const sOffset = std(offsets);

    // เติมข้อมูลหน้า RESULT
    if(viewPlay)   viewPlay.classList.add('hidden');
    if(viewResult) viewResult.classList.remove('hidden');

    const resMode   = $('rb-res-mode');
    const resTrack  = $('rb-res-track');
    const resReason = $('rb-res-endreason');
    const resScore  = $('rb-res-score');
    const resMaxC   = $('rb-res-maxcombo');
    const resHit    = $('rb-res-detail-hit');
    const resAcc    = $('rb-res-acc');
    const resOffM   = $('rb-res-offset-avg');
    const resOffS   = $('rb-res-offset-std');
    const resDur    = $('rb-res-duration');
    const resPart   = $('rb-res-participant');
    const resRank   = $('rb-res-rank');

    if(resMode)  resMode.textContent  = currentMode === 'research' ? 'Research' : 'Normal';
    if(resTrack) resTrack.textContent = currentTrack.name || 'Track';

    let reasonText = '-';
    if(reason === 'song-end')   reasonText = 'เพลงจบ';
    else if(reason === 'hp-zero')   reasonText = 'HP หมด';
    else if(reason === 'manual-stop') reasonText = 'หยุดก่อนเวลา';
    if(resReason) resReason.textContent = reasonText;

    if(resScore)  resScore.textContent  = String(score);
    if(resMaxC)   resMaxC.textContent   = String(maxCombo);
    if(resHit)    resHit.textContent    =
      `${hitPerfect} / ${hitGreat} / ${hitGood} / ${hitMiss}`;
    if(resAcc)    resAcc.textContent    = acc.toFixed(1) + ' %';
    if(resOffM)   resOffM.textContent   = offsets.length ? mOffset.toFixed(3) : '-';
    if(resOffS)   resOffS.textContent   = offsets.length ? sOffset.toFixed(3) : '-';
    if(resDur)    resDur.textContent    = currentSongTime.toFixed(1) + ' s';

    if(resPart)   resPart.textContent   = '-';   // ไว้เชื่อมฟอร์มวิจัยทีหลัง

    // grade rank
    let rank = '-';
    if(acc >= 95 && hitPerfect > 0)      rank = 'SSS';
    else if(acc >= 90)                   rank = 'SS';
    else if(acc >= 80)                   rank = 'S';
    else if(acc >= 70)                   rank = 'A';
    else if(acc >= 60)                   rank = 'B';
    else                                 rank = 'C';
    if(resRank)  resRank.textContent = rank;
  }

  function gotoMenu(){
    if(viewResult) viewResult.classList.add('hidden');
    if(viewPlay)   viewPlay.classList.add('hidden');
    if(viewMenu)   viewMenu.classList.remove('hidden');
  }

  // ===== BOOT =====
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();
