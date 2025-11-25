// === fitness/js/rhythm-engine.js — Rhythm Boxer (Research-ready, 2025-11-28) ===
'use strict';

(function(){

  // ===== CONFIG =====

  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

  const HIT_WINDOWS = {
    perfect: 0.06,
    great:   0.12,
    good:    0.20
  };

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
    },
    {
      id: 't2',
      name: 'Punch Rush (ปกติ)',
      audio: 'audio/punch-rush.mp3',
      duration: 36,
      bpm: 120,
      diff: 'normal',
      chart: makePunchRushChart(120, 36)
    },
    {
      id: 't3',
      name: 'Ultra Beat Combo (ยาก)',
      audio: 'audio/ultra-beat.mp3',
      duration: 40,
      bpm: 135,
      diff: 'hard',
      chart: makeUltraBeatChart(135, 40)
    },
    {
      id: 'research',
      name: 'Research Track 120 (วิจัย)',
      audio: 'audio/research-120.mp3',
      duration: 40,
      bpm: 120,
      diff: 'normal',
      chart: makeResearchChart(120, 40)
    }
  ];

  // ===== UTILITIES =====

  function clamp(v, a, b) {
    return v < a ? a : (v > b ? b : v);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function makeSessionId() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    return `RB-${y}${m}${d}-${hh}${mm}${ss}`;
  }

  class EventLogger {
    constructor() {
      this.rows = [];
    }
    clear() {
      this.rows = [];
    }
    add(row) {
      this.rows.push(row);
    }
    toCsv() {
      if (!this.rows.length) return '';
      const cols = Object.keys(this.rows[0]);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const lines = [];
      lines.push(cols.join(','));
      for (const r of this.rows) {
        lines.push(cols.map(c => esc(r[c])).join(','));
      }
      return lines.join('\n');
    }
  }

  // ===== Chart generators (ตัวอย่าง pattern ง่าย ๆ) =====

  function makeWarmupChart(bpm, duration) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0; // start after 2s
    const seq = [2, 1, 3, 2, 1, 3, 2, 3]; // C L1 R1 pattern

    const totalBeats = Math.floor((duration - 3) / beat);
    let i = 0;
    while (t < duration - 2 && i < totalBeats) {
      out.push({ time: t, lane: seq[i % seq.length], type: 'note' });
      t += beat;
      i++;
    }

    // a few items
    out.push({ time:  t + beat * 0.5, lane: 0, type: 'hp' });
    out.push({ time:  t + beat * 1.5, lane: 4, type: 'shield' });
    return out;
  }

  function makePunchRushChart(bpm, duration) {
    const out = [];
    const beat = 60 / bpm;
    let t = 1.8;
    const seq = [1,2,3,2,3,4,3,2,1,0,2,4];

    const totalBeats = Math.floor((duration - 3) / beat);
    let i = 0;
    while (t < duration - 2 && i < totalBeats) {
      out.push({ time: t, lane: seq[i % seq.length], type: 'note' });
      if (i % 8 === 4) {
        out.push({ time: t + beat * 0.3, lane: 2, type: 'bomb' });
      }
      t += beat * 0.75; // slightly denser
      i++;
    }
    out.push({ time: t + beat, lane: 0, type: 'hp' });
    out.push({ time: t + beat * 2, lane: 4, type: 'shield' });
    return out;
  }

  function makeUltraBeatChart(bpm, duration) {
    const out = [];
    const beat = 60 / bpm;
    let t = 1.5;
    const lanes = [0,1,2,3,4,3,2,1];

    const totalBeats = Math.floor((duration - 3) / beat);
    let i = 0;
    while (t < duration - 2 && i < totalBeats) {
      out.push({ time: t, lane: lanes[i % lanes.length], type: 'note' });
      if (i % 6 === 0) {
        out.push({ time: t + beat * 0.25, lane: 2, type: 'bomb' });
      }
      if (i % 10 === 3) {
        out.push({ time: t + beat * 0.2, lane: 1, type: 'hp' });
      }
      t += beat * 0.6;
      i++;
    }
    return out;
  }

  function makeResearchChart(bpm, duration) {
    // เน้น pattern คงที่ ใช้เทียบ pre/post
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;

    // block 1: single notes
    for (let i = 0; i < 16; i++) {
      const lane = [1,2,3,2][i % 4];
      out.push({ time: t, lane, type: 'note' });
      t += beat;
    }

    // block 2: double notes (L1+C, C+R1)
    for (let i = 0; i < 8; i++) {
      const pair = (i % 2 === 0) ? [1,2] : [2,3];
      out.push({ time: t, lane: pair[0], type: 'note' });
      out.push({ time: t, lane: pair[1], type: 'note' });
      t += beat * 0.75;
    }

    // block 3: items
    out.push({ time: t + beat * 0.5, lane: 0, type: 'hp' });
    out.push({ time: t + beat * 1.5, lane: 4, type: 'shield' });
    out.push({ time: t + beat * 2.5, lane: 2, type: 'bomb' });

    return out;
  }

  // ===== DOM REFS & STATE =====

  // views
  let viewMenu, viewPlay, viewResult;
  // menu controls
  let trackSelect, researchFields, btnStart, modeRadios;
  let inputParticipant, inputGroup, inputNote;
  // HUD
  let hudMode, hudTrack, hudScore, hudCombo, hudAcc, hudHp, hudShield, hudTime;
  let hudPerfect, hudGreat, hudGood, hudMiss;
  let feverFill, feverStatus, progFill, progText;
  // field
  let fieldEl, lanesEl, hitLineEl, feedbackEl, flashEl;
  // result
  let resMode, resTrack, resEndReason, resScore, resMaxCombo, resHitDetail;
  let resAcc, resOffsetAvg, resOffsetStd, resDuration, resParticipant, resRank, resQualityNote;
  // buttons result
  let btnBackMenu, btnAgain, btnDlEvents, btnDlSessions;

  let audioEl;
  let wrapEl;

  // gameplay state
  let running = false;
  let started = false;
  let startPerf = 0;
  let lastPerf  = 0;
  let currentSongTime = 0;

  let sessionId = makeSessionId();
  let runIndex  = 0;
  let currentTrack = TRACKS[0];
  let chart = [];
  let chartIndex = 0;
  let activeNotes = [];
  let nextNoteId = 1;

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hp = 100;
  let shield = 0;
  let fever = 0;
  let feverActive = false;

  let cntPerfect = 0;
  let cntGreat   = 0;
  let cntGood    = 0;
  let cntMiss    = 0;

  let mode = 'normal';   // 'normal' | 'research'
  let participant = '';
  let group = '';
  let noteMeta = '';

  let eventLogger = new EventLogger();
  const sessionRows = [];

  let guideBeatPhase = 0;

  // ===== INIT =====

  function init() {
    wrapEl       = $('rb-wrap');
    viewMenu     = $('rb-view-menu');
    viewPlay     = $('rb-view-play');
    viewResult   = $('rb-view-result');

    trackSelect     = $('rb-track');
    researchFields  = $('rb-research-fields');
    btnStart        = $('rb-btn-start');
    modeRadios      = document.querySelectorAll('input[name="mode"]');

    inputParticipant = $('rb-participant');
    inputGroup       = $('rb-group');
    inputNote        = $('rb-note');

    hudMode   = $('rb-hud-mode');
    hudTrack  = $('rb-hud-track');
    hudScore  = $('rb-hud-score');
    hudCombo  = $('rb-hud-combo');
    hudAcc    = $('rb-hud-acc');
    hudHp     = $('rb-hud-hp');
    hudShield = $('rb-hud-shield');
    hudTime   = $('rb-hud-time');

    feverFill   = $('rb-fever-fill');
    feverStatus = $('rb-fever-status');
    progFill    = $('rb-progress-fill');
    progText    = $('rb-progress-text');

    hudPerfect  = $('rb-hud-perfect');
    hudGreat    = $('rb-hud-great');
    hudGood     = $('rb-hud-good');
    hudMiss     = $('rb-hud-miss');

    fieldEl    = $('rb-field');
    lanesEl    = $('rb-lanes');
    hitLineEl  = document.querySelector('.rb-hit-line');
    feedbackEl = $('rb-feedback');
    flashEl    = $('rb-flash');

    resMode        = $('rb-res-mode');
    resTrack       = $('rb-res-track');
    resEndReason   = $('rb-res-endreason');
    resScore       = $('rb-res-score');
    resMaxCombo    = $('rb-res-maxcombo');
    resHitDetail   = $('rb-res-detail-hit');
    resAcc         = $('rb-res-acc');
    resOffsetAvg   = $('rb-res-offset-avg');
    resOffsetStd   = $('rb-res-offset-std');
    resDuration    = $('rb-res-duration');
    resParticipant = $('rb-res-participant');
    resRank        = $('rb-res-rank');
    resQualityNote = $('rb-res-quality-note');

    btnBackMenu   = $('rb-btn-back-menu');
    btnAgain      = $('rb-btn-again');
    btnDlEvents   = $('rb-btn-dl-events');
    btnDlSessions = $('rb-btn-dl-sessions');

    audioEl = $('rb-audio');

    // bind menu events
    if (trackSelect) {
      trackSelect.addEventListener('change', onChangeTrack);
    }

    if (modeRadios) {
      modeRadios.forEach(r => r.addEventListener('change', onModeChange));
    }

    if (btnStart) {
      btnStart.addEventListener('click', startFromMenu);
    }

    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => {
        showView('menu');
      });
    }

    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        // เล่นเพลงเดิม โหมดเดิม ผู้เข้าร่วมเดิม
        resetState();
        updateHUD();
        showView('play');
        showTapHint();
      });
    }

    if (btnDlEvents) {
      btnDlEvents.addEventListener('click', downloadEventsCsv);
    }

    if (btnDlSessions) {
      btnDlSessions.addEventListener('click', downloadSessionsCsv);
    }

    if (lanesEl) {
      lanesEl.addEventListener('pointerdown', onLaneTap);
    }
    if (fieldEl) {
      fieldEl.addEventListener('pointerdown', handleFirstTap);
    }

    const btnStop = $('rb-btn-stop');
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        if (running || started) {
          finishRun('manual-stop');
        }
      });
    }

    // default track
    if (trackSelect) {
      // ให้ value ตรงกับ TRACKS
      if (!TRACKS.find(t => t.id === trackSelect.value)) {
        trackSelect.value = TRACKS[0].id;
      }
      onChangeTrack();
    } else {
      applyTrack(TRACKS[0]);
    }

    resetState();
    updateHUD();
    showView('menu');
  }

  // ===== VIEW CONTROL =====

  function showView(which) {
    if (viewMenu)   viewMenu.classList.add('hidden');
    if (viewPlay)   viewPlay.classList.add('hidden');
    if (viewResult) viewResult.classList.add('hidden');

    if (which === 'menu' && viewMenu)   viewMenu.classList.remove('hidden');
    if (which === 'play' && viewPlay)   viewPlay.classList.remove('hidden');
    if (which === 'result' && viewResult) viewResult.classList.remove('hidden');
  }

  function onModeChange() {
    const checked = document.querySelector('input[name="mode"]:checked');
    mode = (checked && checked.value === 'research') ? 'research' : 'normal';

    if (researchFields) {
      if (mode === 'research') researchFields.classList.remove('hidden');
      else researchFields.classList.add('hidden');
    }
  }

  function onChangeTrack() {
    const id = trackSelect ? trackSelect.value : TRACKS[0].id;
    const t = TRACKS.find(x => x.id === id) || TRACKS[0];
    applyTrack(t);
    resetState();
    updateHUD();
  }

  function applyTrack(track) {
    currentTrack = track;
    chart = track.chart || [];
    chartIndex = 0;

    if (hudTrack) hudTrack.textContent = track.name || '-';

    if (audioEl) {
      audioEl.src = track.audio;
      audioEl.load();
    }

    if (wrapEl) {
      wrapEl.dataset.diff = track.diff || 'easy';
    }
  }

  // ===== GAME FLOW =====

  function startFromMenu() {
    onModeChange(); // อัปเดต mode ให้ตรงปุ่ม radio ล่าสุด

    if (mode === 'research') {
      participant = (inputParticipant && inputParticipant.value.trim()) || '-';
      group       = (inputGroup && inputGroup.value.trim()) || '-';
      noteMeta    = (inputNote && inputNote.value.trim()) || '';
    } else {
      participant = '';
      group = '';
      noteMeta = '';
    }

    resetState();
    updateHUD();

    if (hudMode) {
      hudMode.textContent = (mode === 'research') ? 'Research' : 'Normal';
    }
    if (hudTrack) {
      hudTrack.textContent = currentTrack.name || '-';
    }

    showView('play');
    showTapHint();
  }

  function resetState() {
    running = false;
    started = false;
    startPerf = 0;
    lastPerf  = 0;
    currentSongTime = 0;
    chartIndex = 0;
    activeNotes = [];
    nextNoteId = 1;

    score = 0;
    combo = 0;
    maxCombo = 0;
    hp = 100;
    shield = 0;
    fever = 0;
    feverActive = false;

    cntPerfect = 0;
    cntGreat   = 0;
    cntGood    = 0;
    cntMiss    = 0;

    guideBeatPhase = 0;

    runIndex += 1;

    eventLogger.clear();

    if (lanesEl) {
      const notes = lanesEl.querySelectorAll('.rb-note');
      notes.forEach(n => n.remove());
    }

    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.currentTime = 0;
      } catch (e) {}
    }

    if (flashEl) {
      flashEl.classList.remove('on');
    }
  }

  function showTapHint() {
    if (feedbackEl) {
      feedbackEl.textContent = 'แตะ lane ใดก็ได้เพื่อเริ่มเพลง 🎵';
    }
  }

  function handleFirstTap() {
    if (started) return;
    started = true;
    running = true;
    startPerf = performance.now();
    lastPerf  = startPerf;
    currentSongTime = 0;

    if (feedbackEl) {
      feedbackEl.textContent = 'เริ่มแล้ว! ชกตามจังหวะเพลง 🎶';
    }

    if (audioEl) {
      const p = audioEl.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          console.log('[Rhythm] Audio autoplay blocked, run silent.');
        });
      }
    }

    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!running) return;

    const dt = (now - lastPerf) / 1000;
    const t  = (now - startPerf) / 1000;
    lastPerf = now;
    currentSongTime = t;

    const dur = currentTrack.duration || 30;
    const clampedTime = clamp(t, 0, dur);

    updateTimeline(clampedTime, dt);
    updateHUD();

    if (clampedTime >= dur) {
      running = false;
      finishRun('track-end');
      return;
    }

    requestAnimationFrame(loop);
  }

  function updateTimeline(songTime, dt) {
    spawnNotes(songTime);
    updateNotePositions(songTime);
    autoJudgeMiss(songTime);

    guideBeatPhase += dt * (currentTrack.bpm || 100) / 60;
    const phase = guideBeatPhase % 1;
    if (hitLineEl) {
      hitLineEl.style.opacity = (phase < 0.15) ? 1.0 : 0.6;
    }
  }

  function spawnNotes(songTime) {
    if (!chart || !chart.length) return;

    const pre = PRE_SPAWN_SEC;
    const len = chart.length;

    while (chartIndex < len && chart[chartIndex].time <= songTime + pre) {
      const info = chart[chartIndex];
      createNote(info);
      chartIndex++;
    }
  }

  function createNote(info) {
    if (!lanesEl) return;
    const laneIndex = clamp(info.lane | 0, 0, LANES.length - 1);

    const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if (!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';
    noteEl.dataset.lane = String(laneIndex);
    noteEl.dataset.time = String(info.time);
    noteEl.dataset.type = info.type || 'note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';
    inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    noteEl.appendChild(inner);

    laneEl.appendChild(noteEl);

    const id = nextNoteId++;

    const noteObj = {
      id,
      lane: laneIndex,
      time: info.time,
      type: info.type || 'note',
      el: noteEl,
      judged: false,
      hit: false,
      removed: false
    };

    activeNotes.push(noteObj);
  }

  function updateNotePositions(songTime) {
    if (!lanesEl) return;
    const rect = lanesEl.getBoundingClientRect();
    const h = rect.height || 1;
    const pre = PRE_SPAWN_SEC;
    const travel = h * 0.8;

    for (const n of activeNotes) {
      if (!n.el || n.removed) continue;
      const dt = n.time - songTime;
      const progress = 1 - (dt / pre);
      const pClamp = clamp(progress, 0, 1.2);
      const y = pClamp * travel;

      n.el.style.transform = `translateY(${y}px)`;
      n.el.style.opacity   = (pClamp <= 1.0) ? 1 : clamp(1.2 - pClamp, 0, 1);
    }
  }

  function autoJudgeMiss(songTime) {
    const missWindow = HIT_WINDOWS.good + 0.05;

    for (const n of activeNotes) {
      if (n.judged) continue;
      if (songTime > n.time + missWindow) {
        if (n.type !== 'note') {
          n.judged = true;
          n.removed = true;
          if (n.el) n.el.remove();
          continue;
        }
        applyJudgement(n, 'miss', songTime);
      }
    }

    activeNotes = activeNotes.filter(n => !n.removed);
  }

  // ===== HIT HANDLING =====

  function onLaneTap(ev) {
    if (!running || !started) {
      // แตะเพื่อเริ่มเพลงกรณีแตะ lane ครั้งแรก
      handleFirstTap();
      return;
    }

    const laneEl = ev.target.closest('.rb-lane');
    if (!laneEl) return;

    const laneIndex = parseInt(laneEl.dataset.lane || '0', 10);

    let best = null;
    let bestDiff = Infinity;

    for (const n of activeNotes) {
      if (n.judged) continue;
      if (n.lane !== laneIndex) continue;
      const diff = Math.abs(n.time - currentSongTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = n;
      }
    }

    if (!best) return;

    const isItem = (best.type === 'hp' || best.type === 'shield' || best.type === 'bomb');
    const windowGood = isItem ? HIT_WINDOWS.good * 1.5 : HIT_WINDOWS.good;

    if (bestDiff > windowGood) {
      if (!isItem) {
        applyJudgement(best, 'miss', currentSongTime);
      }
      return;
    }

    let grade = 'good';
    if (bestDiff <= HIT_WINDOWS.perfect) grade = 'perfect';
    else if (bestDiff <= HIT_WINDOWS.great) grade = 'great';

    applyJudgement(best, grade, currentSongTime);
  }

  function flashDamage() {
    if (!flashEl) return;
    flashEl.classList.add('on');
    setTimeout(() => flashEl.classList.remove('on'), 120);
  }

  function applyJudgement(note, grade, songTime) {
    if (note.judged) return;
    note.judged = true;

    const isBomb   = note.type === 'bomb';
    const isHp     = note.type === 'hp';
    const isShield = note.type === 'shield';

    let eventType = 'hit';
    let deltaScore = 0;

    const scoreBefore  = score;
    const comboBefore  = combo;
    const hpBefore     = hp;
    const shieldBefore = shield;
    const feverBefore  = fever;

    if (isBomb) {
      eventType = 'hit-bomb';
      combo = 0;
      score = Math.max(0, score - 100);
      hp = clamp(hp - 20, 0, 100);
      cntMiss++;
      flashDamage();
      showFeedback('โดนระเบิด! ระวังจังหวะให้มากขึ้น 💣', 'miss');
    } else if (isHp) {
      eventType = 'hit-hp';
      combo++;
      deltaScore = 80;
      score += deltaScore;
      hp = clamp(hp + 15, 0, 100);
      cntGood++;
      showFeedback('เติมพลัง HP ❤️', 'good');
    } else if (isShield) {
      eventType = 'hit-shield';
      combo++;
      deltaScore = 80;
      score += deltaScore;
      shield = clamp(shield + 10, 0, 100);
      cntGood++;
      showFeedback('ได้เกราะป้องกันเพิ่ม 🛡️', 'good');
    } else if (grade === 'miss') {
      eventType = 'miss';
      combo = 0;
      hp = clamp(hp - 8, 0, 100);
      cntMiss++;
      flashDamage();
      showFeedback('พลาดจังหวะ! ลองฟังจังหวะให้ชัดขึ้น 🎧', 'miss');
    } else {
      combo++;
      if (grade === 'perfect') {
        deltaScore = 150;
        cntPerfect++;
        fever = clamp(fever + 7, 0, 100);
        showFeedback('PERFECT! 🎯', 'perfect');
      } else if (grade === 'great') {
        deltaScore = 110;
        cntGreat++;
        fever = clamp(fever + 5, 0, 100);
        showFeedback('Great! จังหวะดีมาก 💪', 'good');
      } else {
        deltaScore = 70;
        cntGood++;
        fever = clamp(fever + 3, 0, 100);
        showFeedback('Good! รักษาคอมโบไว้เลย ✨', 'good');
      }
      score += deltaScore;
    }

    maxCombo = Math.max(maxCombo, combo);

    if (!feverActive && fever >= 100) {
      feverActive = true;
      fever = 100;
      if (feverStatus) {
        feverStatus.textContent = 'FEVER!!';
        feverStatus.classList.add('on');
      }
    }

    if (note.el) {
      note.el.classList.add('rb-note-hit');
      setTimeout(() => {
        if (note.el) note.el.remove();
      }, 220);
    }
    note.removed = true;

    const totalJudged = cntPerfect + cntGreat + cntGood + cntMiss;
    const hitCount = cntPerfect + cntGreat + cntGood;
    const accPct = totalJudged ? (hitCount / totalJudged) * 100 : 0;

    const offsetMs = (songTime - note.time) * 1000;

    eventLogger.add({
      session_id : sessionId,
      run_index  : runIndex,
      mode       : mode,
      track_id   : currentTrack.id || '',
      track_name : currentTrack.name || '',
      participant: participant,
      group      : group,
      note_meta  : noteMeta,

      note_id    : note.id,
      lane       : note.lane,
      event_type : eventType,
      grade      : grade,

      offset_ms   : +offsetMs.toFixed(1),
      song_time_s : +songTime.toFixed(3),
      accuracy_pct: +accPct.toFixed(1),

      score_delta : score - scoreBefore,
      score_total : score,
      combo_before: comboBefore,
      combo_after : combo,
      hp_before   : hpBefore,
      hp_after    : hp,
      shield_before: shieldBefore,
      shield_after : shield,
      fever_before : feverBefore,
      fever_after  : fever
    });

    updateHUD();
  }

  function showFeedback(msg, type) {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = 'rb-feedback';
    if (type === 'perfect') feedbackEl.classList.add('rb-fb-perfect');
    else if (type === 'good') feedbackEl.classList.add('rb-fb-good');
    else if (type === 'miss') feedbackEl.classList.add('rb-fb-miss');
  }

  // ===== HUD / SUMMARY =====

  function updateHUD() {
    if (hudScore)  hudScore.textContent = String(score);
    if (hudCombo)  hudCombo.textContent = String(combo);

    const totalJudged = cntPerfect + cntGreat + cntGood + cntMiss;
    const hitCount = cntPerfect + cntGreat + cntGood;
    const accPct = totalJudged ? (hitCount / totalJudged) * 100 : 0;

    if (hudAcc)   hudAcc.textContent = accPct.toFixed(1) + '%';
    if (hudHp)    hudHp.textContent = String(hp);
    if (hudShield)hudShield.textContent = String(shield);

    if (hudPerfect) hudPerfect.textContent = String(cntPerfect);
    if (hudGreat)   hudGreat.textContent   = String(cntGreat);
    if (hudGood)    hudGood.textContent    = String(cntGood);
    if (hudMiss)    hudMiss.textContent    = String(cntMiss);

    if (hudTime) hudTime.textContent = currentSongTime.toFixed(1);

    const dur = currentTrack.duration || 30;
    const prog = clamp(currentSongTime / dur, 0, 1);
    if (progFill)  progFill.style.transform = `scaleX(${prog})`;
    if (progText)  progText.textContent = Math.round(prog * 100) + '%';

    const feverRatio = clamp(fever / 100, 0, 1);
    if (feverFill)  feverFill.style.transform = `scaleX(${feverRatio})`;
    if (feverStatus) {
      if (feverActive) {
        feverStatus.textContent = 'FEVER!!';
        feverStatus.classList.add('on');
      } else {
        feverStatus.classList.remove('on');
        feverStatus.textContent = feverRatio >= 1 ? 'READY' : 'FEVER';
      }
    }
  }

  function finishRun(reason) {
    if (!started && !running) return;

    running = false;
    started = false;

    if (audioEl) {
      try {
        audioEl.pause();
      } catch (e) {}
    }

    const duration = currentSongTime;
    const totalJudged = cntPerfect + cntGreat + cntGood + cntMiss;
    const hitCount = cntPerfect + cntGreat + cntGood;
    const accPct = totalJudged ? (hitCount / totalJudged) * 100 : 0;

    // offset stats
    const { meanOffset, sdOffset } = computeOffsetStats();

    if (resMode)        resMode.textContent = (mode === 'research') ? 'โหมดวิจัย' : 'โหมดปกติ';
    if (resTrack)       resTrack.textContent = currentTrack.name || '-';
    if (resEndReason)   resEndReason.textContent = reason || '-';
    if (resScore)       resScore.textContent = String(score);
    if (resMaxCombo)    resMaxCombo.textContent = String(maxCombo);
    if (resHitDetail)   resHitDetail.textContent =
      `${cntPerfect} / ${cntGreat} / ${cntGood} / ${cntMiss}`;
    if (resAcc)         resAcc.textContent = accPct.toFixed(1) + ' %';
    if (resOffsetAvg)   resOffsetAvg.textContent =
      Number.isFinite(meanOffset) ? meanOffset.toFixed(1) + ' ms' : '-';
    if (resOffsetStd)   resOffsetStd.textContent =
      Number.isFinite(sdOffset) ? sdOffset.toFixed(1) + ' ms' : '-';
    if (resDuration)    resDuration.textContent = duration.toFixed(1) + ' s';
    if (resParticipant) resParticipant.textContent = participant || '-';

    if (resRank) {
      let rank = '-';
      if (accPct >= 95 && maxCombo >= 50) rank = 'S';
      else if (accPct >= 90) rank = 'A';
      else if (accPct >= 80) rank = 'B';
      else if (accPct >= 70) rank = 'C';
      else rank = 'D';
      resRank.textContent = rank;
    }

    if (resQualityNote) {
      resQualityNote.classList.remove('hidden');
      if (accPct >= 90 && Math.abs(meanOffset) < 40) {
        resQualityNote.textContent =
          'คุณภาพข้อมูลดีมาก เหมาะสำหรับใช้วิเคราะห์เชิงลึก (RT + SEM) ✅';
      } else {
        resQualityNote.textContent =
          'คุณภาพข้อมูลปานกลาง แนะนำให้เก็บซ้ำอย่างน้อย 2 รอบเพื่อความเสถียรของ RT 📊';
      }
    }

    // push session row
    sessionRows.push({
      session_id : sessionId,
      run_index  : runIndex,
      mode       : mode,
      track_id   : currentTrack.id,
      track_name : currentTrack.name,
      participant: participant,
      group      : group,
      note_meta  : noteMeta,
      score      : score,
      max_combo  : maxCombo,
      acc_pct    : +accPct.toFixed(1),
      cnt_perfect: cntPerfect,
      cnt_great  : cntGreat,
      cnt_good   : cntGood,
      cnt_miss   : cntMiss,
      duration_s : +duration.toFixed(3),
      end_reason : reason,
      offset_mean_ms: Number.isFinite(meanOffset) ? +meanOffset.toFixed(1) : '',
      offset_sd_ms  : Number.isFinite(sdOffset) ? +sdOffset.toFixed(1) : '',
      ts_end: new Date().toISOString()
    });

    showView('result');
  }

  function computeOffsetStats() {
    const hits = eventLogger.rows.filter(
      r => r.event_type === 'hit' && r.grade !== 'miss'
    );
    if (!hits.length) {
      return { meanOffset: NaN, sdOffset: NaN };
    }
    const offsets = hits.map(r => Number(r.offset_ms) || 0);
    const n = offsets.length;
    const mean = offsets.reduce((a, b) => a + b, 0) / n;
    const varSum = offsets.reduce((s, v) => s + Math.pow(v - mean, 2), 0);
    const sd = Math.sqrt(varSum / n);
    return { meanOffset: mean, sdOffset: sd };
  }

  // ===== CSV EXPORT =====

  function downloadTextAsCsv(filename, text) {
    if (!text) {
      alert('ยังไม่มีข้อมูล CSV ให้บันทึก');
      return;
    }
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadEventsCsv() {
    const csv = eventLogger.toCsv();
    const pid = (participant || 'Pxxx').replace(/[^a-z0-9_-]/gi, '');
    downloadTextAsCsv(`rhythm-boxer-events-${pid || 'Pxxx'}.csv`, csv);
  }

  function downloadSessionsCsv() {
    if (!sessionRows.length) {
      alert('ยังไม่มีข้อมูล Session สำหรับบันทึก');
      return;
    }
    const cols = Object.keys(sessionRows[0]);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(cols.join(','));
    for (const r of sessionRows) {
      lines.push(cols.map(c => esc(r[c])).join(','));
    }
    const csv = lines.join('\n');
    downloadTextAsCsv('rhythm-boxer-sessions.csv', csv);
  }

  // ===== AUTO INIT =====

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // debug hook
  window.__RB_DEBUG = {
    getState: () => ({
      running,
      started,
      currentSongTime,
      score,
      combo,
      hp,
      shield,
      fever,
      activeNotes: activeNotes.map(n => ({
        id: n.id,
        lane: n.lane,
        time: n.time,
        type: n.type,
        judged: n.judged
      }))
    })
  };

})();
