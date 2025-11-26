// === js/rhythm-engine.js — Rhythm Boxer Engine (Research-ready, FX, 2025-11-30) ===
(function () {
  'use strict';

  // ====== CONFIG ======
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

  // hit window (วินาที)
  const HIT_WINDOWS = {
    perfect: 0.06,
    great:   0.12,
    good:    0.20
  };

  // เวลาเริ่ม spawn ก่อนถึงเส้นตี (วินาที)
  const PRE_SPAWN_SEC = 2.0;

  // FEVER
  const FEVER_GAIN = { perfect: 18, great: 12, good: 8 };
  const FEVER_DECAY_PER_SEC = 9;
  const FEVER_DURATION_SEC  = 5.0;
  const FEVER_THRESHOLD     = 100;

  // ====== TRACKS / CHARTS ======
  const TRACKS = [
    {
      id: 't1',
      name: 'Warm-up Groove (ง่าย)',
      audio: 'audio/warmup-groove.mp3',
      duration: 32,
      bpm: 100,
      diff: 'easy',
      chartBuilder: () => makeSimpleChart(100, 32, [2, 1, 3, 2, 1, 3, 2, 3])
    },
    {
      id: 't2',
      name: 'Punch Rush (ปกติ)',
      audio: 'audio/punch-rush.mp3',
      duration: 40,
      bpm: 120,
      diff: 'normal',
      chartBuilder: () => makeSimpleChart(120, 40, [1, 2, 3, 4, 3, 2, 1, 0])
    },
    {
      id: 't3',
      name: 'Ultra Beat Combo (ยาก)',
      audio: 'audio/ultra-combo.mp3',
      duration: 48,
      bpm: 135,
      diff: 'hard',
      chartBuilder: () => makeDenseChart(135, 48)
    },
    {
      id: 'research',
      name: 'Research Track 120 (วิจัย)',
      audio: 'audio/research-120.mp3',
      duration: 60,
      bpm: 120,
      diff: 'normal',
      chartBuilder: () => makeResearchChart(120, 60)
    }
  ];

  function getTrackById(id) {
    return TRACKS.find(t => t.id === id) || TRACKS[0];
  }

  // สร้าง pattern ง่าย ๆ ตาม bpm / duration
  function makeSimpleChart(bpm, dur, laneSeq) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const total = Math.floor((dur - 2.5) / beat);
    for (let i = 0; i < total; i++) {
      const lane = laneSeq[i % laneSeq.length];
      out.push({ time: t, lane, kind: 'note' });
      t += beat;
    }
    // แถม HP/Shield ตอนท้าย
    out.push({ time: Math.min(dur - 4, t + beat * 0.5), lane: 0, kind: 'hp' });
    out.push({ time: Math.min(dur - 3, t + beat * 1.5), lane: 4, kind: 'shield' });
    return out;
  }

  // pattern หนาแน่นขึ้น
  function makeDenseChart(bpm, dur) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const total = Math.floor((dur - 3) / (beat * 0.5)); // 8th notes
    for (let i = 0; i < total; i++) {
      const lane = LANES[(i * 2 + (i % 3)) % LANES.length];
      out.push({ time: t, lane, kind: 'note' });
      if (i % 16 === 8) {
        out.push({ time: t + beat * 0.25, lane: (lane + 1) % LANES.length, kind: 'note' });
      }
      t += beat * 0.5;
    }
    out.push({ time: dur - 8, lane: 1, kind: 'hp' });
    out.push({ time: dur - 6, lane: 3, kind: 'shield' });
    return out;
  }

  // track วิจัย: pattern เรียบ ๆ
  function makeResearchChart(bpm, dur) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const total = Math.floor((dur - 4) / beat);
    for (let i = 0; i < total; i++) {
      const lane = LANES[i % LANES.length];
      out.push({ time: t, lane, kind: 'note' });
      t += beat;
    }
    return out;
  }

  // ====== UTIL ======
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function $(id) { return document.getElementById(id); }

  function makeSessionId() {
    const t = new Date();
    return `RB-${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}` +
           `-${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`;
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = arr.reduce((s, v2) => s + Math.pow(v2 - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(v);
  }

  class SimpleLogger {
    constructor() { this.rows = []; }
    clear() { this.rows = []; }
    add(r) { this.rows.push(r); }
    toCsv() {
      if (!this.rows.length) return '';
      const cols = Object.keys(this.rows[0]);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const lines = [cols.join(',')];
      for (const r of this.rows) {
        lines.push(cols.map(c => esc(r[c])).join(','));
      }
      return lines.join('\n');
    }
  }

  // ====== DOM & STATE ======
  const dom = {};
  const state = {
    mode: 'normal',
    currentTrackId: 't1',
    currentTrack: null,
    chart: [],
    sessionId: '',
    participant: '',
    group: '',
    noteLabel: '',

    running: false,
    started: false,
    ended: false,

    startPerf: 0,
    lastPerf: 0,
    songTime: 0,
    audioStartedAt: 0,

    notes: [],
    nextNoteIndex: 0,
    noteSeq: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    hp: 100,
    shield: 0,
    feverGauge: 0,
    feverOn: false,
    feverTime: 0,
    feverCount: 0,

    countPerfect: 0,
    countGreat: 0,
    countGood: 0,
    countMiss: 0,
    totalJudgeable: 0,

    offsets: [], // sec (signed)
    endReason: '',
    loopId: null
  };

  const logs = {
    events: new SimpleLogger(),
    sessions: new SimpleLogger()
  };

  // ====== INIT ======
  function init() {
    // views
    dom.viewMenu   = $('rb-view-menu');
    dom.viewPlay   = $('rb-view-play');
    dom.viewResult = $('rb-view-result');

    // menu
    dom.trackSel   = $('rb-track');
    dom.modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));
    dom.btnStart   = $('rb-btn-start');

    dom.researchFieldsWrap = $('rb-research-fields');
    dom.inParticipant = $('rb-participant');
    dom.inGroup       = $('rb-group');
    dom.inNote        = $('rb-note');

    // HUD play
    dom.hudMode   = $('rb-hud-mode');
    dom.hudTrack  = $('rb-hud-track');
    dom.hudScore  = $('rb-hud-score');
    dom.hudCombo  = $('rb-hud-combo');
    dom.hudAcc    = $('rb-hud-acc');
    dom.hudHp     = $('rb-hud-hp');
    dom.hudShield = $('rb-hud-shield');
    dom.hudTime   = $('rb-hud-time');

    dom.hudPerfect = $('rb-hud-perfect');
    dom.hudGreat   = $('rb-hud-great');
    dom.hudGood    = $('rb-hud-good');
    dom.hudMiss    = $('rb-hud-miss');

    dom.feverFill   = $('rb-fever-fill');
    dom.feverStatus = $('rb-fever-status');
    dom.progressFill = $('rb-progress-fill');
    dom.progressText = $('rb-progress-text');

    dom.field   = $('rb-field');
    dom.lanes   = $('rb-lanes');
    dom.hitLine = document.querySelector('.rb-hit-line');
    dom.feedback = $('rb-feedback');
    dom.flash    = $('rb-flash');

    dom.btnStop      = $('rb-btn-stop');
    dom.btnBackMenu  = $('rb-btn-back-menu');
    dom.btnAgain     = $('rb-btn-again');
    dom.btnDlEvents  = $('rb-btn-dl-events');
    dom.btnDlSessions= $('rb-btn-dl-sessions');

    dom.audio = $('rb-audio');

    // result
    dom.resMode      = $('rb-res-mode');
    dom.resTrack     = $('rb-res-track');
    dom.resEndReason = $('rb-res-endreason');
    dom.resScore     = $('rb-res-score');
    dom.resMaxCombo  = $('rb-res-maxcombo');
    dom.resDetailHit = $('rb-res-detail-hit');
    dom.resAcc       = $('rb-res-acc');
    dom.resOffsetAvg = $('rb-res-offset-avg');
    dom.resOffsetStd = $('rb-res-offset-std');
    dom.resDuration  = $('rb-res-duration');
    dom.resParticipant = $('rb-res-participant');
    dom.resRank      = $('rb-res-rank');
    dom.resQuality   = $('rb-res-quality-note');

    bindMenuUI();
    bindPlayUI();
    bindResultUI();

    showView('menu');
    updateResearchVisibility();
  }

  // ====== VIEW SWITCH ======
  function showView(which) {
    if (dom.viewMenu)   dom.viewMenu.classList.add('hidden');
    if (dom.viewPlay)   dom.viewPlay.classList.add('hidden');
    if (dom.viewResult) dom.viewResult.classList.add('hidden');

    if (which === 'menu'   && dom.viewMenu)   dom.viewMenu.classList.remove('hidden');
    if (which === 'play'   && dom.viewPlay)   dom.viewPlay.classList.remove('hidden');
    if (which === 'result' && dom.viewResult) dom.viewResult.classList.remove('hidden');
  }

  // ====== MENU BINDINGS ======
  function bindMenuUI() {
    if (dom.btnStart) {
      dom.btnStart.addEventListener('click', () => {
        const mode = getModeFromUI();
        const trackId = getTrackIdFromUI(mode);
        const meta = collectResearchMeta(mode);
        startSession(mode, trackId, meta);
      });
    }

    dom.modeRadios.forEach(r => {
      r.addEventListener('change', updateResearchVisibility);
    });

    if (dom.trackSel) {
      dom.trackSel.addEventListener('change', () => {
        // ถ้าเลือก research track โดยตรง ให้ติ๊กโหมดวิจัย
        if (dom.trackSel.value === 'research') {
          const researchRadio = dom.modeRadios.find(r => r.value === 'research');
          if (researchRadio) researchRadio.checked = true;
        }
        updateResearchVisibility();
      });
    }
  }

  function getModeFromUI() {
    const checked = dom.modeRadios.find(r => r.checked);
    return checked ? checked.value : 'normal';
  }

  function getTrackIdFromUI(mode) {
    if (!dom.trackSel) return 't1';
    if (mode === 'research') {
      return 'research';
    }
    return dom.trackSel.value || 't1';
  }

  function collectResearchMeta(mode) {
    if (mode !== 'research') return { participant: '', group: '', note: '' };
    return {
      participant: dom.inParticipant ? dom.inParticipant.value.trim() : '',
      group:       dom.inGroup ? dom.inGroup.value.trim() : '',
      note:        dom.inNote ? dom.inNote.value.trim() : ''
    };
  }

  function updateResearchVisibility() {
    const mode = getModeFromUI();
    if (!dom.researchFieldsWrap) return;
    if (mode === 'research') dom.researchFieldsWrap.classList.remove('hidden');
    else dom.researchFieldsWrap.classList.add('hidden');
  }

  // ====== PLAY UI BINDINGS ======
  function bindPlayUI() {
    if (dom.lanes) {
      dom.lanes.addEventListener('pointerdown', onLanePointerDown);
      dom.lanes.addEventListener('click', onLanePointerDown);
    }
    if (dom.btnStop) {
      dom.btnStop.addEventListener('click', () => {
        if (state.running) {
          finishSession('manual-stop');
        }
      });
    }
  }

  function bindResultUI() {
    if (dom.btnBackMenu) {
      dom.btnBackMenu.addEventListener('click', () => {
        showView('menu');
      });
    }
    if (dom.btnAgain) {
      dom.btnAgain.addEventListener('click', () => {
        const meta = collectResearchMeta(state.mode);
        startSession(state.mode, state.currentTrackId, meta);
      });
    }
    if (dom.btnDlEvents) {
      dom.btnDlEvents.addEventListener('click', () => {
        const csv = logs.events.toCsv();
        if (!csv) {
          alert('ยังไม่มีข้อมูล Event CSV ลองเล่นให้จบสักรอบก่อนค่ะ');
          return;
        }
        downloadCsv('rhythm-boxer-events.csv', csv);
      });
    }
    if (dom.btnDlSessions) {
      dom.btnDlSessions.addEventListener('click', () => {
        const csv = logs.sessions.toCsv();
        if (!csv) {
          alert('ยังไม่มีข้อมูล Session CSV');
          return;
        }
        downloadCsv('rhythm-boxer-sessions.csv', csv);
      });
    }
  }

  function downloadCsv(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ====== SESSION START ======
  function resetState() {
    state.running = false;
    state.started = false;
    state.ended   = false;
    state.songTime = 0;
    state.startPerf = 0;
    state.lastPerf = 0;

    state.notes = [];
    state.nextNoteIndex = 0;
    state.noteSeq = 0;

    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hp = 100;
    state.shield = 0;

    state.feverGauge = 0;
    state.feverOn = false;
    state.feverTime = 0;
    state.feverCount = 0;

    state.countPerfect = 0;
    state.countGreat = 0;
    state.countGood = 0;
    state.countMiss = 0;
    state.totalJudgeable = 0;

    state.offsets = [];
    state.endReason = '';

    logs.events.clear();
    state.sessionId = makeSessionId();

    if (dom.field) {
      dom.field.classList.remove('rb-shake');
      // ลบ note เก่าทั้งหมด
      const oldNotes = dom.field.querySelectorAll('.rb-note');
      oldNotes.forEach(el => el.remove());
    }
  }

  function startSession(mode, trackId, researchMeta) {
    resetState();

    state.mode = mode || 'normal';
    state.currentTrackId = trackId || 't1';
    state.currentTrack   = getTrackById(state.currentTrackId);

    // สร้าง chart ใหม่
    state.chart = (state.currentTrack.chartBuilder && state.currentTrack.chartBuilder()) || [];
    state.chart.sort((a, b) => a.time - b.time);
    state.nextNoteIndex = 0;

    state.totalJudgeable = state.chart.filter(n => n.kind === 'note').length;

    // audio
    if (dom.audio && state.currentTrack.audio) {
      dom.audio.src = state.currentTrack.audio;
      dom.audio.load();
    }

    // meta
    state.participant = researchMeta && researchMeta.participant || '';
    state.group       = researchMeta && researchMeta.group || '';
    state.noteLabel   = researchMeta && researchMeta.note || '';

    // HUD
    if (dom.hudMode) {
      dom.hudMode.textContent = state.mode === 'research' ? 'Research' : 'Normal';
    }
    if (dom.hudTrack) {
      dom.hudTrack.textContent = state.currentTrack.name;
    }

    updateHUD(true);

    showView('play');
    showFeedback('แตะ lane ใดก็ได้เพื่อเริ่มเพลง 🎵');

    state.running = false;
    state.started = false;
    state.ended   = false;

    if (dom.field) {
      dom.field.classList.remove('rb-shake');
    }
  }

  // ====== MAIN LOOP ======
  function beginPlaybackAndLoop() {
    if (state.started) return;
    state.started = true;
    state.running = true;
    state.startPerf = performance.now();
    state.lastPerf  = state.startPerf;
    state.songTime  = 0;

    if (dom.audio) {
      const p = dom.audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {/* autoplay ปล่อยผ่าน */});
      }
    }

    state.loopId = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!state.running) return;

    const dt = (now - state.lastPerf) / 1000;
    state.lastPerf = now;
    state.songTime += dt;

    updateTimeline(dt);
    updateHUD();

    const dur = state.currentTrack.duration || 30;
    if (state.songTime >= dur + 0.3 || state.hp <= 0) {
      const reason = state.hp <= 0 ? 'hp-zero' : 'song-end';
      finishSession(reason);
      return;
    }

    state.loopId = requestAnimationFrame(loop);
  }

  function updateTimeline(dt) {
    const songTime = state.songTime;

    // spawn notes
    const pre = PRE_SPAWN_SEC;
    const chart = state.chart;
    while (
      state.nextNoteIndex < chart.length &&
      chart[state.nextNoteIndex].time <= songTime + pre
    ) {
      spawnNote(chart[state.nextNoteIndex]);
      state.nextNoteIndex++;
    }

    // update positions
    updateNotePositions(songTime);

    // auto-miss
    autoJudgeMiss(songTime);

    // FEVER decay
    if (state.feverOn) {
      state.feverTime += dt;
      state.feverGauge = clamp(state.feverGauge - FEVER_DECAY_PER_SEC * dt * 1.4, 0, 120);
      if (state.feverGauge <= 0) {
        state.feverOn = false;
      }
    } else {
      state.feverGauge = clamp(state.feverGauge - FEVER_DECAY_PER_SEC * dt * 0.5, 0, 120);
    }

    // timing guide effect
    if (dom.hitLine && state.currentTrack.bpm) {
      const phase = (songTime * state.currentTrack.bpm / 60) % 1;
      dom.hitLine.style.opacity = phase < 0.12 ? 1 : 0.65;
    }
  }

  // ====== NOTES ======
  function spawnNote(info) {
    if (!dom.lanes) return;

    const laneIndex = clamp((info.lane | 0), 0, LANES.length - 1);
    const laneEl = dom.lanes.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if (!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';
    noteEl.dataset.kind = info.kind || 'note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';

    if (info.kind === 'hp') {
      inner.textContent = '💚';
    } else if (info.kind === 'shield') {
      inner.textContent = '🛡️';
    } else {
      inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    }

    noteEl.appendChild(inner);
    laneEl.appendChild(noteEl);

    // ให้โน้ตโผล่จากด้านบน (สูงกว่ากรอบ) ลงมาเส้นตี
    const laneRect = laneEl.getBoundingClientRect();
    const travel = laneRect.height * 0.9; // ระยะวิ่ง
    noteEl.style.bottom = '40px';
    noteEl.style.transform = `translate(-50%, ${-travel}px)`;

    const id = ++state.noteSeq;
    const noteObj = {
      id,
      lane: laneIndex,
      time: info.time,
      kind: info.kind || 'note',
      el: noteEl,
      judged: false,
      removed: false,
      hit: false
    };

    state.notes.push(noteObj);

    // log spawn
    logs.events.add({
      session_id: state.sessionId,
      event_type: 'spawn',
      note_id: id,
      lane: laneIndex,
      kind: noteObj.kind,
      time_s: +noteObj.time.toFixed(3),
      ts: new Date().toISOString()
    });
  }

  function updateNotePositions(songTime) {
    if (!dom.lanes) return;
    const laneRect = dom.lanes.getBoundingClientRect();
    const travel = laneRect.height * 0.9;
    const pre = PRE_SPAWN_SEC;

    for (const n of state.notes) {
      if (!n.el || n.removed) continue;
      const dt = n.time - songTime; // เหลือก่อนถึงเวลา ideal
      const progress = 1 - (dt / pre); // 0 → 1
      const pClamp = clamp(progress, 0, 1.25);
      const y = (pClamp - 1) * travel; // -travel → 0

      n.el.style.transform = `translate(-50%, ${y}px)`;
      n.el.style.opacity = pClamp <= 0 ? 0 : 1;
    }
  }

  function autoJudgeMiss(songTime) {
    const missWindow = HIT_WINDOWS.good + 0.08;
    for (const n of state.notes) {
      if (n.judged) continue;
      if (songTime > n.time + missWindow) {
        applyMiss(n);
      }
    }
    state.notes = state.notes.filter(n => !n.removed);
  }

  // ====== INPUT ======
  function onLanePointerDown(ev) {
    const laneEl = ev.target.closest('.rb-lane');
    if (!laneEl || !dom.lanes) {
      if (!state.started) beginPlaybackAndLoop();
      return;
    }

    const laneIndex = parseInt(laneEl.dataset.lane || '0', 10);

    if (!state.started) {
      beginPlaybackAndLoop();
    }

    judgeTapOnLane(laneIndex, ev);
  }

  function judgeTapOnLane(laneIndex, ev) {
    const songTime = state.songTime;
    let bestNote = null;
    let bestAbsOffset = Infinity;

    for (const n of state.notes) {
      if (n.judged || n.lane !== laneIndex) continue;
      const offset = songTime - n.time;
      const abs = Math.abs(offset);
      if (abs < bestAbsOffset) {
        bestAbsOffset = abs;
        bestNote = n;
      }
    }

    if (!bestNote) {
      // กดพลาด lane – ถือเป็น miss เบา ๆ
      shakeFieldSoft();
      return;
    }

    const offset = songTime - bestNote.time;
    const abs = Math.abs(offset);

    let grade = 'miss';
    if (abs <= HIT_WINDOWS.perfect) grade = 'perfect';
    else if (abs <= HIT_WINDOWS.great) grade = 'great';
    else if (abs <= HIT_WINDOWS.good) grade = 'good';

    if (grade === 'miss') {
      applyMiss(bestNote, offset, ev);
    } else {
      applyHit(bestNote, grade, offset, ev);
    }
  }

  // ====== HIT / MISS ======
  function applyHit(note, grade, offsetSec, ev) {
    note.judged = true;
    note.hit = true;

    let baseScore = 0;
    if (note.kind === 'hp') {
      baseScore = 80;
    } else if (note.kind === 'shield') {
      baseScore = 60;
    } else {
      baseScore =
        grade === 'perfect' ? 120 :
        grade === 'great'   ? 80  :
        50;
    }

    // fever bonus
    let scoreGain = baseScore;
    if (state.feverOn && note.kind === 'note') {
      scoreGain = Math.round(baseScore * 1.5);
    }

    state.score += scoreGain;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    // HP / shield effect
    if (note.kind === 'hp') {
      state.hp = clamp(state.hp + 15, 0, 100);
    } else if (note.kind === 'shield') {
      state.shield = clamp(state.shield + 1, 0, 9);
    }

    // FEVER gauge
    if (note.kind === 'note') {
      const add = FEVER_GAIN[grade] || 5;
      state.feverGauge = clamp(state.feverGauge + add, 0, 140);
      if (!state.feverOn && state.feverGauge >= FEVER_THRESHOLD) {
        state.feverOn = true;
        state.feverGauge = 120; // เติมเกินเล็กน้อย
        state.feverTime = 0;
        state.feverCount += 1;
        showFeedback('FEVER MODE! ชกติด ๆ ให้คอมโบพุ่งเลย ⚡', 'perfect');
        shakeFieldHard();
      }
    }

    // hit stats
    if (note.kind === 'note') {
      state.totalJudgeable = state.totalJudgeable || 0;
      state.offsets.push(offsetSec);
      if (grade === 'perfect') state.countPerfect += 1;
      else if (grade === 'great') state.countGreat += 1;
      else if (grade === 'good') state.countGood += 1;
    }

    // effect / popup
    showHitFX(note, grade, scoreGain, ev);

    // log hit
    logs.events.add({
      session_id: state.sessionId,
      event_type: 'hit',
      note_id: note.id,
      lane: note.lane,
      kind: note.kind,
      grade,
      offset_s: +offsetSec.toFixed(4),
      time_song_s: +state.songTime.toFixed(3),
      combo_after: state.combo,
      score_gain: scoreGain,
      score_total: state.score,
      fever_on: state.feverOn ? 1 : 0,
      fever_gauge: +state.feverGauge.toFixed(1),
      hp_after: state.hp,
      shield_after: state.shield,
      ts: new Date().toISOString()
    });

    // remove note
    if (note.el) {
      note.el.remove();
    }
    note.removed = true;

    // feedback text
    if (note.kind === 'hp') {
      showFeedback('เติม HP แล้ว ลุยต่อ! 💚', 'good');
    } else if (note.kind === 'shield') {
      showFeedback('ได้ Shield เพิ่ม! ใช้กัน miss ได้ 1 ครั้ง 🛡️', 'good');
    } else if (grade === 'perfect') {
      showFeedback('Perfect! จังหวะเป๊ะมาก 🎯', 'perfect');
    } else if (grade === 'great') {
      showFeedback('Great! จังหวะดีมาก 👍', 'good');
    } else {
      showFeedback('Good! ลองให้เป๊ะขึ้นอีกนิดนะ 😄', 'good');
    }
  }

  function applyMiss(note, offsetSec, ev) {
    note.judged = true;
    note.hit = false;

    // ใช้ shield กัน miss ได้
    let usedShield = false;
    if (state.shield > 0 && note.kind === 'note') {
      state.shield -= 1;
      usedShield = true;
    } else {
      state.combo = 0;
      state.hp = clamp(state.hp - 6, 0, 100);
      state.feverGauge = clamp(state.feverGauge - 12, 0, 120);
      state.feverOn = false;
    }

    if (note.kind === 'note') {
      state.countMiss += 1;
      if (!usedShield && offsetSec != null) {
        state.offsets.push(offsetSec);
      }
    }

    showMissFX(note, usedShield, ev);

    logs.events.add({
      session_id: state.sessionId,
      event_type: 'miss',
      note_id: note.id,
      lane: note.lane,
      kind: note.kind,
      used_shield: usedShield ? 1 : 0,
      offset_s: offsetSec != null ? +offsetSec.toFixed(4) : '',
      time_song_s: +state.songTime.toFixed(3),
      combo_after: state.combo,
      score_total: state.score,
      fever_on: state.feverOn ? 1 : 0,
      fever_gauge: +state.feverGauge.toFixed(1),
      hp_after: state.hp,
      shield_after: state.shield,
      ts: new Date().toISOString()
    });

    if (note.el) {
      note.el.remove();
    }
    note.removed = true;

    if (usedShield) {
      showFeedback('พลาดไป แต่ Shield ช่วยกันไว้แล้ว 🛡️', 'good');
    } else {
      showFeedback('พลาดจังหวะ ลองโฟกัสที่ beat ถัดไปนะ 🎧', 'miss');
      flashDamage();
      shakeFieldSoft();
    }
  }

  // ====== FX ======
  function showHitFX(note, grade, scoreGain, ev) {
    if (!dom.field) return;
    if (!note || !note.el) return;

    const hostRect = dom.field.getBoundingClientRect();
    const r = note.el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - hostRect.left;
    const cy = r.top + r.height / 2 - hostRect.top;

    // score popup
    const pop = document.createElement('div');
    pop.className = 'rb-score-popup';

    if (grade === 'perfect') pop.classList.add('rb-score-perfect');
    else if (grade === 'great') pop.classList.add('rb-score-great');
    else if (grade === 'good') pop.classList.add('rb-score-good');
    else if (grade === 'miss') pop.classList.add('rb-score-miss');

    let label = '';
    if (grade === 'perfect') label = `PERFECT +${scoreGain}`;
    else if (grade === 'great') label = `GREAT +${scoreGain}`;
    else if (grade === 'good') label = `GOOD +${scoreGain}`;
    else label = `+${scoreGain}`;

    pop.textContent = label;
    pop.style.left = cx + 'px';
    pop.style.top  = cy + 'px';
    pop.style.bottom = 'auto';
    pop.style.transform = 'translate(-50%, -50%)';

    dom.field.appendChild(pop);
    // animation controlled by CSS keyframes rb-score-pop
    setTimeout(() => {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 650);

    // particles ใช้ emoji ต่างตาม grade
    const emoji =
      grade === 'perfect' ? '💥' :
      grade === 'great'   ? '✨' :
      grade === 'good'    ? '⭐' : '🎵';

    if (window.RbParticles && typeof window.RbParticles.burstHit === 'function') {
      window.RbParticles.burstHit(dom.field, { x: cx, y: cy }, {
        emoji,
        count: grade === 'perfect' ? 12 : 8
      });
    }
  }

  function showMissFX(note, usedShield, ev) {
    if (!dom.field || !note || !note.el) return;
    const hostRect = dom.field.getBoundingClientRect();
    const r = note.el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - hostRect.left;
    const cy = r.top + r.height / 2 - hostRect.top;

    const pop = document.createElement('div');
    pop.className = 'rb-score-popup rb-score-miss';
    pop.style.left = cx + 'px';
    pop.style.top  = cy + 'px';
    pop.style.bottom = 'auto';
    pop.style.transform = 'translate(-50%, -50%)';
    pop.textContent = usedShield ? 'SHIELD' : 'MISS';
    dom.field.appendChild(pop);
    setTimeout(() => pop.remove(), 650);

    if (!usedShield && window.RbParticles && window.RbParticles.burstHit) {
      window.RbParticles.burstHit(dom.field, { x: cx, y: cy }, {
        emoji: '💣',
        count: 10
      });
    }
  }

  function shakeFieldSoft() {
    if (!dom.field) return;
    dom.field.classList.add('rb-shake');
    setTimeout(() => dom.field && dom.field.classList.remove('rb-shake'), 260);
  }
  function shakeFieldHard() {
    if (!dom.field) return;
    dom.field.classList.add('rb-shake');
    setTimeout(() => dom.field && dom.field.classList.remove('rb-shake'), 420);
  }

  function flashDamage() {
    if (!dom.flash) return;
    dom.flash.classList.add('active');
    setTimeout(() => dom.flash && dom.flash.classList.remove('active'), 120);
  }

  function showFeedback(text, tone) {
    if (!dom.feedback) return;
    dom.feedback.textContent = text;
    dom.feedback.className = 'rb-feedback';
    if (tone === 'perfect') dom.feedback.classList.add('perfect');
    else if (tone === 'good') dom.feedback.classList.add('good');
    else if (tone === 'miss') dom.feedback.classList.add('miss');
    else if (tone === 'bomb') dom.feedback.classList.add('bomb');
  }

  // ====== HUD / RESULT ======
  function updateHUD(resetStats) {
    const hits = state.countPerfect + state.countGreat + state.countGood;
    const total = hits + state.countMiss;
    const acc = total ? (hits / total) * 100 : 0;

    if (dom.hudScore) dom.hudScore.textContent = state.score;
    if (dom.hudCombo) dom.hudCombo.textContent = state.combo;
    if (dom.hudHp) dom.hudHp.textContent = state.hp;
    if (dom.hudShield) dom.hudShield.textContent = state.shield;
    if (dom.hudTime) dom.hudTime.textContent = state.songTime.toFixed(1);
    if (dom.hudAcc) dom.hudAcc.textContent = acc.toFixed(1) + '%';

    if (dom.hudPerfect) dom.hudPerfect.textContent = state.countPerfect;
    if (dom.hudGreat)   dom.hudGreat.textContent   = state.countGreat;
    if (dom.hudGood)    dom.hudGood.textContent    = state.countGood;
    if (dom.hudMiss)    dom.hudMiss.textContent    = state.countMiss;

    const dur = state.currentTrack ? state.currentTrack.duration : 30;
    const prog = clamp(state.songTime / dur, 0, 1);
    if (dom.progressFill) {
      dom.progressFill.style.transform = `scaleX(${prog})`;
    }
    if (dom.progressText) {
      dom.progressText.textContent = Math.round(prog * 100) + '%';
    }

    const fg = clamp(state.feverGauge, 0, 120) / 100;
    if (dom.feverFill) {
      dom.feverFill.style.transform = `scaleX(${fg})`;
    }
    if (dom.feverStatus) {
      dom.feverStatus.textContent = state.feverOn ? 'FEVER' : 'Ready';
      dom.feverStatus.classList.toggle('on', state.feverOn);
    }
  }

  function finishSession(reason) {
    if (state.ended) return;
    state.ended = true;
    state.running = false;
    state.endReason = reason || 'unknown';

    if (state.loopId != null) {
      cancelAnimationFrame(state.loopId);
      state.loopId = null;
    }

    if (dom.audio) {
      dom.audio.pause();
      dom.audio.currentTime = 0;
    }

    // ลบ note ทั้งหมด
    for (const n of state.notes) {
      if (n.el) n.el.remove();
      n.removed = true;
    }
    state.notes = [];

    const hits = state.countPerfect + state.countGreat + state.countGood;
    const total = hits + state.countMiss;
    const acc = total ? (hits / total) * 100 : 0;
    const duration = state.songTime;

    const m = mean(state.offsets);
    const s = std(state.offsets);

    const rank =
      acc >= 95 && state.score >= 8000 ? 'SSS' :
      acc >= 90 && state.score >= 6500 ? 'SS'  :
      acc >= 85 && state.score >= 5000 ? 'S'   :
      acc >= 75 ? 'A' :
      acc >= 60 ? 'B' :
      acc >= 45 ? 'C' : 'D';

    // session log row
    logs.sessions.add({
      session_id: state.sessionId,
      mode: state.mode,
      track_id: state.currentTrackId,
      track_name: state.currentTrack ? state.currentTrack.name : '',
      end_reason: state.endReason,
      duration_s: +duration.toFixed(3),
      score: state.score,
      rank,
      acc_pct: +acc.toFixed(1),
      perfect: state.countPerfect,
      great: state.countGreat,
      good: state.countGood,
      miss: state.countMiss,
      max_combo: state.maxCombo,
      fever_count: state.feverCount,
      fever_time_s: +state.feverTime.toFixed(2),
      hp_final: state.hp,
      shield_final: state.shield,
      offset_mean_s: +m.toFixed(4),
      offset_sd_s: +s.toFixed(4),
      participant: state.participant || '',
      group: state.group || '',
      note_label: state.noteLabel || '',
      ts_end: new Date().toISOString()
    });

    // update result view
    if (dom.resMode) dom.resMode.textContent = state.mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ';
    if (dom.resTrack) dom.resTrack.textContent = state.currentTrack ? state.currentTrack.name : '-';
    if (dom.resEndReason) {
      const map = {
        'song-end': 'เพลงจบ',
        'hp-zero': 'พลังชีวิตหมด',
        'manual-stop': 'หยุดก่อนเวลา'
      };
      dom.resEndReason.textContent = map[state.endReason] || state.endReason;
    }
    if (dom.resScore) dom.resScore.textContent = state.score;
    if (dom.resMaxCombo) dom.resMaxCombo.textContent = state.maxCombo;
    if (dom.resDetailHit) {
      dom.resDetailHit.textContent =
        `${state.countPerfect} / ${state.countGreat} / ${state.countGood} / ${state.countMiss}`;
    }
    if (dom.resAcc) dom.resAcc.textContent = acc.toFixed(1) + ' %';
    if (dom.resOffsetAvg) {
      dom.resOffsetAvg.textContent = state.offsets.length ? m.toFixed(3) + ' s' : '-';
    }
    if (dom.resOffsetStd) {
      dom.resOffsetStd.textContent = state.offsets.length ? s.toFixed(3) + ' s' : '-';
    }
    if (dom.resDuration) dom.resDuration.textContent = duration.toFixed(1) + ' s';
    if (dom.resParticipant) dom.resParticipant.textContent = state.participant || '-';
    if (dom.resRank) dom.resRank.textContent = rank;

    if (dom.resQuality) {
      dom.resQuality.classList.add('hidden');
      if (acc >= 90 && state.maxCombo >= 30) {
        dom.resQuality.textContent = 'ข้อมูลคุณภาพสูงมาก เหมาะสำหรับใช้เป็น baseline ในงานวิจัย ✅';
        dom.resQuality.classList.remove('hidden');
      } else if (acc < 60 || state.hp < 20) {
        dom.resQuality.textContent = 'รอบนี้อาจใช้ซ้อมมากกว่าทดสอบจริง (Accuracy ต่ำ/HP ใกล้หมด) 📝';
        dom.resQuality.classList.remove('hidden');
      }
    }

    showView('result');
  }

  // ====== BOOT ======
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
