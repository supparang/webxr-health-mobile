// === fitness/js/rhythm-engine.js — Rhythm Boxer (Production + Research, 2025-12-01) ===
'use strict';

(function () {
  // ====== CONFIG ======
  const LANES = [0, 1, 2, 3, 4];            // L2, L1, C, R1, R2
  const ZONE_BY_LANE = ['L2', 'L1', 'C', 'R1', 'R2']; // <-- ใช้ใน Event CSV (ข้อ 3)
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

  const HIT_WINDOWS = {
    perfect: 0.06,
    great: 0.12,
    good: 0.20
  };

  const PRE_SPAWN_SEC = 2.0;

  // FEVER config
  const FEVER_GAIN_PER_HIT = 10;    // เพิ่มง่ายขึ้น
  const FEVER_DECAY_PER_SEC = 5;
  const FEVER_THRESHOLD = 100;
  const FEVER_DURATION_SEC = 6;

  // HP / Shield
  const MAX_HP = 100;
  const MISS_HP_PENALTY = 6;

  // ====== TRACKS (ตัวอย่าง 4 เพลง) ======
  const TRACKS = [
    {
      id: 't1',
      name: 'Warm-up Groove (ง่าย)',
      audio: 'audio/warmup-groove.mp3',
      duration: 32,
      bpm: 100,
      diff: 'easy',
      chart: makeBasicChart(100, 32, 'easy')
    },
    {
      id: 't2',
      name: 'Punch Rush (ปกติ)',
      audio: 'audio/punch-rush.mp3',
      duration: 40,
      bpm: 120,
      diff: 'normal',
      chart: makeBasicChart(120, 40, 'normal')
    },
    {
      id: 't3',
      name: 'Ultra Beat Combo (ยาก)',
      audio: 'audio/ultra-beat.mp3',
      duration: 48,
      bpm: 135,
      diff: 'hard',
      chart: makeBasicChart(135, 48, 'hard')
    },
    {
      id: 'research',
      name: 'Research Track 120 (วิจัย)',
      audio: 'audio/research-120.mp3',
      duration: 36,
      bpm: 120,
      diff: 'normal',
      chart: makeResearchChart(120, 36)
    }
  ];

  // ====== UTIL ======
  const $id = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function nowIso() {
    return new Date().toISOString();
  }

  function makeSessionId() {
    const t = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `RB-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(
      t.getHours()
    )}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  }

  // ====== SIMPLE CSV LOGGER ======
  class CsvLogger {
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
      const lines = [cols.join(',')];
      for (const r of this.rows) {
        lines.push(cols.map((c) => esc(r[c])).join(','));
      }
      return lines.join('\n');
    }
  }

  function downloadCsv(filename, csvText) {
    if (!csvText) {
      alert('ยังไม่มีข้อมูลให้ดาวน์โหลด');
      return;
    }
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // ====== CHART GENERATORS ======
  function makeBasicChart(bpm, dur, diff) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const baseSeq = diff === 'easy'
      ? [2, 2, 2, 2, 1, 3, 2, 2]
      : diff === 'normal'
      ? [2, 3, 1, 3, 2, 4, 0, 2]
      : [2, 0, 4, 1, 3, 2, 4, 0];

    const totalBeat = Math.floor((dur - 3) / beat);
    for (let i = 0; i < totalBeat; i++) {
      const lane = baseSeq[i % baseSeq.length];
      out.push({ time: t, lane, type: 'note' });
      if (diff !== 'easy' && i % 8 === 6) {
        // แทรก double-note บางจังหวะ
        out.push({ time: t + beat * 0.5, lane: (lane + 4) % 5, type: 'note' });
      }
      t += beat;
    }

    // เพิ่ม hp / shield สำหรับจบเพลง
    out.push({ time: t + beat * 0.5, lane: 0, type: 'hp' });
    out.push({ time: t + beat * 1.5, lane: 4, type: 'shield' });

    return out;
  }

  function makeResearchChart(bpm, dur) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const seq = [2, 1, 3, 2, 4, 2, 0, 2];
    const total = Math.floor((dur - 3) / beat);
    for (let i = 0; i < total; i++) {
      out.push({ time: t, lane: seq[i % seq.length], type: 'note' });
      t += beat;
    }
    // research เน้น pattern ตรง ๆ
    return out;
  }

  function findTrackById(id) {
    return TRACKS.find((t) => t.id === id) || TRACKS[0];
  }

  // ====== STATE ======
  const state = {
    sessionId: null,
    mode: 'normal',
    currentTrackId: 't1',
    currentTrack: null,

    started: false,
    running: false,
    startPerf: 0,
    lastPerf: 0,
    songTime: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    hp: MAX_HP,
    shield: 0,
    feverGauge: 0,
    feverActive: false,
    feverRemaining: 0,
    totalNotes: 0,
    countPerfect: 0,
    countGreat: 0,
    countGood: 0,
    countMiss: 0,

    notes: [],
    chartIndex: 0,

    // research meta
    participantId: '',
    group: '',
    note: '',

    // FEVER / time
    feverTotalTime: 0,
    feverTriggers: 0,

    // logs
    events: new CsvLogger(),
    sessions: new CsvLogger()
  };

  // DOM refs
  let elWrap,
    viewMenu,
    viewPlay,
    viewResult,
    audioEl,
    lanesEl,
    fieldEl,
    hitLineEl,
    flashEl,
    feedbackEl;

  // HUD
  let hudMode,
    hudTrack,
    hudScore,
    hudCombo,
    hudAcc,
    hudHp,
    hudShield,
    hudTime,
    hudFeverStatus,
    feverFillEl,
    progressFillEl,
    progressTextEl,
    hudPerfect,
    hudGreat,
    hudGood,
    hudMiss;

  // Result refs
  let resMode,
    resTrack,
    resEndReason,
    resScore,
    resMaxCombo,
    resDetailHit,
    resAcc,
    resOffsetAvg,
    resOffsetStd,
    resDuration,
    resParticipant,
    resRank,
    resQualityNote;

  // helper for view switch
  function showView(menu, play, result) {
    if (viewMenu) viewMenu.classList.toggle('hidden', !menu);
    if (viewPlay) viewPlay.classList.toggle('hidden', !play);
    if (viewResult) viewResult.classList.toggle('hidden', !result);
  }

  // ====== INIT ======
  function init() {
    elWrap = $id('rb-wrap');
    viewMenu = $id('rb-view-menu');
    viewPlay = $id('rb-view-play');
    viewResult = $id('rb-view-result');
    audioEl = $id('rb-audio');
    lanesEl = $id('rb-lanes');
    fieldEl = $id('rb-field');
    hitLineEl = document.querySelector('.rb-hit-line');
    flashEl = $id('rb-flash');
    feedbackEl = $id('rb-feedback');

    // HUD
    hudMode = $id('rb-hud-mode');
    hudTrack = $id('rb-hud-track');
    hudScore = $id('rb-hud-score');
    hudCombo = $id('rb-hud-combo');
    hudAcc = $id('rb-hud-acc');
    hudHp = $id('rb-hud-hp');
    hudShield = $id('rb-hud-shield');
    hudTime = $id('rb-hud-time');
    hudFeverStatus = $id('rb-fever-status');
    feverFillEl = $id('rb-fever-fill');
    progressFillEl = $id('rb-progress-fill');
    progressTextEl = $id('rb-progress-text');
    hudPerfect = $id('rb-hud-perfect');
    hudGreat = $id('rb-hud-great');
    hudGood = $id('rb-hud-good');
    hudMiss = $id('rb-hud-miss');

    // Result
    resMode = $id('rb-res-mode');
    resTrack = $id('rb-res-track');
    resEndReason = $id('rb-res-endreason');
    resScore = $id('rb-res-score');
    resMaxCombo = $id('rb-res-maxcombo');
    resDetailHit = $id('rb-res-detail-hit');
    resAcc = $id('rb-res-acc');
    resOffsetAvg = $id('rb-res-offset-avg');
    resOffsetStd = $id('rb-res-offset-std');
    resDuration = $id('rb-res-duration');
    resParticipant = $id('rb-res-participant');
    resRank = $id('rb-res-rank');
    resQualityNote = $id('rb-res-quality-note');

    // Buttons
    const btnStart = $id('rb-btn-start');
    const btnStop = $id('rb-btn-stop');
    const btnBackMenu = $id('rb-btn-back-menu');
    const btnAgain = $id('rb-btn-again');
    const btnDlEvents = $id('rb-btn-dl-events');
    const btnDlSessions = $id('rb-btn-dl-sessions');

    if (btnStart) btnStart.addEventListener('click', onStartFromMenu);
    if (btnStop) btnStop.addEventListener('click', () => endSession('force_stop'));
    if (btnBackMenu) btnBackMenu.addEventListener('click', () => showView(true, false, false));
    if (btnAgain) btnAgain.addEventListener('click', replaySameTrack);

    if (btnDlEvents) {
      btnDlEvents.addEventListener('click', () => {
        downloadCsv('rb-events.csv', state.events.toCsv());
      });
    }
    if (btnDlSessions) {
      btnDlSessions.addEventListener('click', () => {
        downloadCsv('rb-sessions.csv', state.sessions.toCsv());
      });
    }

    // lane tap
    if (lanesEl) {
      lanesEl.addEventListener('pointerdown', onLaneTap);
    }

    // mode change => show/hide research fields
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    modeRadios.forEach((r) => {
      r.addEventListener('change', onModeChange);
    });

    const trackSelect = $id('rb-track');
    if (trackSelect) {
      trackSelect.addEventListener('change', () => {
        const val = trackSelect.value || 't1';
        state.currentTrackId = val;
      });
    }

    showView(true, false, false);
  }

  // ====== MENU HANDLERS ======
  function onModeChange() {
    const mode = getSelectedMode();
    const researchFields = $id('rb-research-fields');
    const trackSelect = $id('rb-track');

    if (mode === 'research') {
      if (researchFields) researchFields.classList.remove('hidden');
      if (trackSelect) {
        trackSelect.value = 'research';
      }
    } else {
      if (researchFields) researchFields.classList.add('hidden');
    }
  }

  function getSelectedMode() {
    const radios = document.querySelectorAll('input[name="mode"]');
    for (const r of radios) {
      if (r.checked) return r.value === 'research' ? 'research' : 'normal';
    }
    return 'normal';
  }

  function onStartFromMenu() {
    state.mode = getSelectedMode();

    const trackSelect = $id('rb-track');
    let trackId = 't1';
    if (state.mode === 'research') {
      trackId = 'research';
      if (trackSelect) trackSelect.value = 'research';
    } else {
      if (trackSelect) trackId = trackSelect.value || 't1';
    }

    state.currentTrackId = trackId;
    state.currentTrack = findTrackById(trackId);

    // ====== ข้อ 1: set data-diff ให้ #rb-wrap ตามความยากของ track ======
    if (elWrap && state.currentTrack && state.currentTrack.diff) {
      elWrap.dataset.diff = state.currentTrack.diff; // easy / normal / hard
    } else if (elWrap) {
      delete elWrap.dataset.diff;
    }

    // เก็บ meta วิจัย
    if (state.mode === 'research') {
      state.participantId = ($id('rb-participant')?.value || '').trim();
      state.group = ($id('rb-group')?.value || '').trim();
      state.note = ($id('rb-note')?.value || '').trim();
    } else {
      state.participantId = '';
      state.group = '';
      state.note = '';
    }

    beginSession();
  }

  function replaySameTrack() {
    if (!state.currentTrackId) state.currentTrackId = 't1';
    state.mode = getSelectedMode();
    beginSession();
  }

  // ====== SESSION CONTROL ======
  function beginSession() {
    const track = findTrackById(state.currentTrackId);
    state.currentTrack = track;

    state.sessionId = makeSessionId();
    state.started = false;
    state.running = false;
    state.startPerf = 0;
    state.lastPerf = 0;
    state.songTime = 0;

    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hp = MAX_HP;
    state.shield = 0;
    state.feverGauge = 0;
    state.feverActive = false;
    state.feverRemaining = 0;
    state.feverTotalTime = 0;
    state.feverTriggers = 0;
    state.totalNotes = 0;
    state.countPerfect = 0;
    state.countGreat = 0;
    state.countGood = 0;
    state.countMiss = 0;

    state.notes = [];
    state.chartIndex = 0;
    state.events.clear();

    clearField();
    updateHUD();
    updateBars();

    // audio
    if (audioEl && track.audio) {
      audioEl.src = track.audio;
      audioEl.currentTime = 0;
    }

    if (hudMode) hudMode.textContent = state.mode === 'research' ? 'Research' : 'Normal';
    if (hudTrack) hudTrack.textContent = track.name || '-';

    showFeedback('แตะ lane ใดก็ได้เพื่อเริ่มเพลง 🎵');
    showView(false, true, false);
  }

  function clearField() {
    if (!lanesEl) return;
    lanesEl.querySelectorAll('.rb-note').forEach((n) => n.remove());
  }

  function beginPlaybackAndLoop() {
    if (state.started) return;
    state.started = true;
    state.running = true;
    state.startPerf = performance.now();
    state.lastPerf = state.startPerf;
    state.songTime = 0;

    // play audio
    if (audioEl && audioEl.src) {
      const p = audioEl.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // ignore autoplay error
        });
      }
    }

    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = (now - state.lastPerf) / 1000;
    state.lastPerf = now;
    state.songTime = (now - state.startPerf) / 1000;

    const track = state.currentTrack || findTrackById(state.currentTrackId);
    const duration = track.duration || 30;

    updateTimeline(state.songTime, dt, track);
    updateHUD();
    updateBars();

    if (state.songTime >= duration + 0.2) {
      endSession('song_end');
      return;
    }

    requestAnimationFrame(loop);
  }

  function endSession(reason) {
    if (!state.running && !state.started) {
      showView(true, false, false);
      return;
    }

    state.running = false;

    const track = state.currentTrack || findTrackById(state.currentTrackId);
    const duration = Math.min(state.songTime, track.duration || state.songTime);

    // สรุปค่าพื้นฐาน
    const totalHit = state.countPerfect + state.countGreat + state.countGood;
    const totalJudged = totalHit + state.countMiss;
    const acc = totalJudged > 0 ? (totalHit / totalJudged) * 100 : 0;
    const meanOffset = computeMeanOffset();
    const stdOffset = computeStdOffset(meanOffset);

    const rank = calcRank(state.score, acc);

    // เก็บลง Session CSV
    const sessionRow = {
      session_id: state.sessionId,
      ts_start_iso: '',      // optional ปล่อยว่าง หรือจะเพิ่มเวลาเริ่มจริงก็ได้
      ts_end_iso: nowIso(),
      mode: state.mode,
      track_id: track.id,
      track_name: track.name,

      // ====== ข้อ 2: เพิ่ม bpm และ diff ลง Session CSV ======
      track_bpm: track.bpm || '',
      track_diff: track.diff || '',

      duration_s: duration.toFixed(3),
      score_total: state.score,
      rank: rank,
      hit_perfect: state.countPerfect,
      hit_great: state.countGreat,
      hit_good: state.countGood,
      hit_miss: state.countMiss,
      accuracy_pct: acc.toFixed(2),
      max_combo: state.maxCombo,
      fever_triggers: state.feverTriggers,
      fever_time_total_s: state.feverTotalTime.toFixed(3),
      hp_end: state.hp,
      shield_end: state.shield,
      offset_mean_s: isFinite(meanOffset) ? meanOffset.toFixed(4) : '',
      offset_sd_s: isFinite(stdOffset) ? stdOffset.toFixed(4) : '',
      participant_id: state.participantId || '',
      group: state.group || '',
      note: state.note || '',
      end_reason: reason || 'unknown'
    };
    state.sessions.add(sessionRow);

    // อัปเดตหน้าสรุป
    if (resMode) resMode.textContent = state.mode === 'research' ? 'Research' : 'Normal';
    if (resTrack) resTrack.textContent = track.name;
    if (resEndReason) {
      const map = {
        song_end: 'เพลงจบ',
        force_stop: 'หยุดก่อนเวลา',
        hp_zero: 'HP หมด'
      };
      resEndReason.textContent = map[reason] || reason || '-';
    }
    if (resScore) resScore.textContent = state.score;
    if (resMaxCombo) resMaxCombo.textContent = state.maxCombo;
    if (resDetailHit) {
      resDetailHit.textContent = `${state.countPerfect} / ${state.countGreat} / ${state.countGood} / ${state.countMiss}`;
    }
    if (resAcc) resAcc.textContent = `${acc.toFixed(2)} %`;
    if (resOffsetAvg) {
      resOffsetAvg.textContent = isFinite(meanOffset) ? `${meanOffset.toFixed(3)} s` : '-';
    }
    if (resOffsetStd) {
      resOffsetStd.textContent = isFinite(stdOffset) ? `${stdOffset.toFixed(3)} s` : '-';
    }
    if (resDuration) resDuration.textContent = `${duration.toFixed(2)} s`;
    if (resParticipant) resParticipant.textContent = state.participantId || '-';
    if (resRank) resRank.textContent = rank;

    if (resQualityNote) {
      if (totalJudged < 10) {
        resQualityNote.textContent =
          'จำนวนโน้ตที่ถูกตีน้อยกว่า 10 ครั้ง อาจยังไม่เพียงพอสำหรับวิเคราะห์สถิติอย่างมีนัยสำคัญ';
        resQualityNote.classList.remove('hidden');
      } else {
        resQualityNote.textContent = '';
        resQualityNote.classList.add('hidden');
      }
    }

    showView(false, false, true);
  }

  function computeMeanOffset() {
    // ใช้ event log ที่เป็น type = "hit"
    const rows = state.events.rows.filter((r) => r.event_type === 'hit' && r.offset_s != null);
    if (!rows.length) return NaN;
    let sum = 0;
    for (const r of rows) sum += Number(r.offset_s);
    return sum / rows.length;
  }

  function computeStdOffset(mean) {
    const rows = state.events.rows.filter((r) => r.event_type === 'hit' && r.offset_s != null);
    if (!rows.length) return NaN;
    let sumSq = 0;
    for (const r of rows) {
      const d = Number(r.offset_s) - mean;
      sumSq += d * d;
    }
    return Math.sqrt(sumSq / rows.length);
  }

  function calcRank(score, acc) {
    if (acc >= 95 && score >= 50000) return 'SSS';
    if (acc >= 90 && score >= 40000) return 'SS';
    if (acc >= 85 && score >= 30000) return 'S';
    if (acc >= 80) return 'A';
    if (acc >= 70) return 'B';
    if (acc >= 60) return 'C';
    return 'D';
  }

  // ====== TIMELINE / NOTES ======
  function updateTimeline(songTime, dt, track) {
    spawnNotes(songTime, track);
    updateNotePositions(songTime);
    autoJudgeMiss(songTime);
    updateHitLine(songTime, track);
    updateFever(dt);
  }

  function spawnNotes(songTime, track) {
    const chart = track.chart || [];
    const pre = PRE_SPAWN_SEC;
    while (state.chartIndex < chart.length && chart[state.chartIndex].time <= songTime + pre) {
      const info = chart[state.chartIndex];
      createNote(info);
      state.chartIndex++;
    }
  }

  function createNote(info) {
    if (!lanesEl) return;
    const laneIndex = clamp(info.lane | 0, 0, 4);
    const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if (!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';
    inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    noteEl.appendChild(inner);

    laneEl.appendChild(noteEl);

    const note = {
      id: `${state.sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      lane: laneIndex,
      time: info.time,
      type: info.type || 'note',
      el: noteEl,
      judged: false,
      removed: false,
      hitTime: null,
      grade: null
    };

    state.notes.push(note);
    if (note.type === 'note') {
      state.totalNotes++;
    }
  }

  function updateNotePositions(songTime) {
    if (!lanesEl) return;
    const rect = lanesEl.getBoundingClientRect();
    const h = rect.height || 1;
    const pre = PRE_SPAWN_SEC;
    const travel = h * 0.85;

    for (const n of state.notes) {
      if (!n.el || n.removed) continue;
      const dt = n.time - songTime;
      const progress = 1 - dt / pre; // 0 -> 1
      const pClamp = clamp(progress, 0, 1.2);
      const y = (pClamp - 1) * travel;
      n.el.style.transform = `translateX(-50%) translateY(${y}px)`;
      n.el.style.opacity = pClamp <= 1.0 ? 1 : clamp(1.2 - pClamp, 0, 1);
    }
  }

  function autoJudgeMiss(songTime) {
    const missWindow = HIT_WINDOWS.good + 0.05;
    for (const n of state.notes) {
      if (n.judged) continue;
      if (songTime > n.time + missWindow) {
        applyMiss(n, songTime);
      }
    }
    state.notes = state.notes.filter((n) => !n.removed);
  }

  function updateHitLine(songTime, track) {
    if (!hitLineEl || !track.bpm) return;
    const phase = ((songTime * track.bpm) / 60) % 1;
    hitLineEl.style.opacity = phase < 0.15 ? 1 : 0.6;
  }

  // ====== FEVER / BARS ======
  function updateFever(dt) {
    if (state.feverActive) {
      state.feverRemaining -= dt;
      state.feverTotalTime += dt;
      if (state.feverRemaining <= 0) {
        state.feverActive = false;
        state.feverGauge = 0;
      }
    } else {
      // decay gauge
      if (state.feverGauge > 0) {
        state.feverGauge -= FEVER_DECAY_PER_SEC * dt;
        if (state.feverGauge < 0) state.feverGauge = 0;
      }
    }
  }

  function triggerFeverIfReady() {
    if (state.feverActive) return;
    if (state.feverGauge >= FEVER_THRESHOLD) {
      state.feverActive = true;
      state.feverRemaining = FEVER_DURATION_SEC;
      state.feverTriggers++;
      state.feverGauge = FEVER_THRESHOLD;
      if (hudFeverStatus) {
        hudFeverStatus.textContent = 'FEVER!!';
        hudFeverStatus.classList.add('on');
      }
    }
  }

  function updateBars() {
    const track = state.currentTrack || findTrackById(state.currentTrackId);
    const duration = track.duration || 30;
    const progress = clamp(state.songTime / duration, 0, 1);

    if (progressFillEl) {
      progressFillEl.style.transform = `scaleX(${progress.toFixed(3)})`;
    }
    if (progressTextEl) {
      progressTextEl.textContent = `${Math.round(progress * 100)}%`;
    }

    const feverRatio = clamp(state.feverGauge / FEVER_THRESHOLD, 0, 1);
    if (feverFillEl) {
      feverFillEl.style.transform = `scaleX(${feverRatio.toFixed(3)})`;
    }
    if (hudFeverStatus) {
      if (!state.feverActive) {
        hudFeverStatus.textContent = 'Ready';
        hudFeverStatus.classList.remove('on');
      }
    }
  }

  // ====== INPUT / HIT LOGIC ======
  function onLaneTap(ev) {
    const laneEl = ev.target.closest('.rb-lane');
    if (!laneEl) {
      // แตะครั้งแรกที่ field เริ่มเพลงได้เหมือนกัน
      if (!state.started) {
        beginPlaybackAndLoop();
      }
      return;
    }

    const lane = parseInt(laneEl.dataset.lane || '0', 10);

    if (!state.started) {
      beginPlaybackAndLoop();
    }

    if (!state.running) return;

    const songTime = state.songTime;
    const note = findNearestNoteOnLane(lane, songTime);
    if (!note) {
      // กดว่าง อาจถือเป็น miss เล็ก ๆ (optional) — ตอนนี้ยังไม่ลง log
      showFeedback('พลาดจังหวะ 💫', 'miss');
      return;
    }

    judgeHit(note, songTime, ev);
  }

  function findNearestNoteOnLane(lane, songTime) {
    let best = null;
    let bestAbs = Infinity;
    for (const n of state.notes) {
      if (n.lane !== lane || n.judged) continue;
      const offset = songTime - n.time;
      const abs = Math.abs(offset);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = n;
      }
    }
    return best;
  }

  function judgeHit(note, songTime, ev) {
    const offset = songTime - note.time;
    const abs = Math.abs(offset);

    let grade = 'miss';
    if (abs <= HIT_WINDOWS.perfect) grade = 'perfect';
    else if (abs <= HIT_WINDOWS.great) grade = 'great';
    else if (abs <= HIT_WINDOWS.good) grade = 'good';

    if (note.type === 'hp') {
      applyHpGain(note, songTime, ev);
      return;
    }
    if (note.type === 'shield') {
      applyShieldGain(note, songTime, ev);
      return;
    }

    if (grade === 'miss') {
      applyMiss(note, songTime, ev);
    } else {
      applyHit(note, songTime, grade, offset, ev);
    }
  }

  function applyHit(note, songTime, grade, offset, ev) {
    note.judged = true;
    note.removed = true;
    note.hitTime = songTime;
    note.grade = grade;
    if (note.el) note.el.remove();

    let baseScore = 100;
    if (grade === 'perfect') baseScore = 130;
    else if (grade === 'great') baseScore = 110;
    else if (grade === 'good') baseScore = 80;

    let scoreGain = baseScore;
    if (state.feverActive) {
      scoreGain = Math.round(scoreGain * 1.6);
    }

    state.score += scoreGain;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    if (grade === 'perfect') state.countPerfect++;
    else if (grade === 'great') state.countGreat++;
    else if (grade === 'good') state.countGood++;

    // FEVER gauge up
    state.feverGauge += FEVER_GAIN_PER_HIT;
    if (state.feverGauge > FEVER_THRESHOLD) state.feverGauge = FEVER_THRESHOLD;
    triggerFeverIfReady();

    // Effect
    spawnHitFxAtEvent(ev, grade, scoreGain);
    showFeedback(
      grade === 'perfect' ? 'Perfect! 🎯' : grade === 'great' ? 'Great! ✨' : 'Good! 👍',
      grade
    );

    // ====== Event CSV row ======
    const lane = note.lane;
    const zone = ZONE_BY_LANE[lane] || ''; // <-- ข้อ 3: zone แยกตาม lane
    state.events.add({
      session_id: state.sessionId,
      ts_iso: nowIso(),
      event_type: 'hit',
      track_id: state.currentTrack?.id || state.currentTrackId,
      track_name: state.currentTrack?.name || '',
      lane,
      zone,
      song_time_s: songTime.toFixed(4),
      note_time_s: note.time.toFixed(4),
      offset_s: offset.toFixed(4),
      grade,
      score_gain: scoreGain,
      score_total: state.score,
      combo_after: state.combo,
      hp_after: state.hp,
      shield_after: state.shield,
      fever_gauge: state.feverGauge.toFixed(2),
      fever_on: state.feverActive ? 1 : 0
    });
  }

  function applyMiss(note, songTime, ev) {
    note.judged = true;
    note.removed = true;
    if (note.el) note.el.remove();

    state.combo = 0;
    state.countMiss++;
    if (state.shield > 0) {
      state.shield--;
    } else {
      state.hp = clamp(state.hp - MISS_HP_PENALTY, 0, MAX_HP);
    }

    if (fieldEl) {
      fieldEl.classList.add('rb-shake');
      setTimeout(() => fieldEl && fieldEl.classList.remove('rb-shake'), 260);
    }
    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl && flashEl.classList.remove('active'), 160);
    }

    spawnHitFxAtEvent(ev, 'miss', 0);
    showFeedback('พลาดจังหวะ! 🎧', 'miss');

    const lane = note.lane;
    const zone = ZONE_BY_LANE[lane] || '';
    state.events.add({
      session_id: state.sessionId,
      ts_iso: nowIso(),
      event_type: 'miss',
      track_id: state.currentTrack?.id || state.currentTrackId,
      track_name: state.currentTrack?.name || '',
      lane,
      zone,
      song_time_s: songTime.toFixed(4),
      note_time_s: note.time.toFixed(4),
      offset_s: '',
      grade: 'miss',
      score_gain: 0,
      score_total: state.score,
      combo_after: state.combo,
      hp_after: state.hp,
      shield_after: state.shield,
      fever_gauge: state.feverGauge.toFixed(2),
      fever_on: state.feverActive ? 1 : 0
    });

    if (state.hp <= 0) {
      endSession('hp_zero');
    }
  }

  function applyHpGain(note, songTime, ev) {
    note.judged = true;
    note.removed = true;
    if (note.el) note.el.remove();

    const gain = 15;
    state.hp = clamp(state.hp + gain, 0, MAX_HP);
    spawnHitFxAtEvent(ev, 'hp', gain);
    showFeedback('ฟื้น HP ❤️', 'good');

    const lane = note.lane;
    const zone = ZONE_BY_LANE[lane] || '';
    state.events.add({
      session_id: state.sessionId,
      ts_iso: nowIso(),
      event_type: 'hp_up',
      track_id: state.currentTrack?.id || state.currentTrackId,
      track_name: state.currentTrack?.name || '',
      lane,
      zone,
      song_time_s: songTime.toFixed(4),
      note_time_s: note.time.toFixed(4),
      offset_s: '',
      grade: 'hp',
      score_gain: 0,
      score_total: state.score,
      combo_after: state.combo,
      hp_after: state.hp,
      shield_after: state.shield,
      fever_gauge: state.feverGauge.toFixed(2),
      fever_on: state.feverActive ? 1 : 0
    });
  }

  function applyShieldGain(note, songTime, ev) {
    note.judged = true;
    note.removed = true;
    if (note.el) note.el.remove();

    const gain = 1;
    state.shield += gain;
    spawnHitFxAtEvent(ev, 'shield', 0);
    showFeedback('ได้ Shield 🛡️', 'good');

    const lane = note.lane;
    const zone = ZONE_BY_LANE[lane] || '';
    state.events.add({
      session_id: state.sessionId,
      ts_iso: nowIso(),
      event_type: 'shield_gain',
      track_id: state.currentTrack?.id || state.currentTrackId,
      track_name: state.currentTrack?.name || '',
      lane,
      zone,
      song_time_s: songTime.toFixed(4),
      note_time_s: note.time.toFixed(4),
      offset_s: '',
      grade: 'shield',
      score_gain: 0,
      score_total: state.score,
      combo_after: state.combo,
      hp_after: state.hp,
      shield_after: state.shield,
      fever_gauge: state.feverGauge.toFixed(2),
      fever_on: state.feverActive ? 1 : 0
    });
  }

  // ====== FX ======
  function spawnHitFxAtEvent(ev, grade, scoreGain) {
    if (!fieldEl) return;

    let x = null;
    let y = null;

    if (ev && ev.clientX != null && ev.clientY != null) {
      const rect = fieldEl.getBoundingClientRect();
      x = ev.clientX - rect.left;
      y = ev.clientY - rect.top;
    } else if (ev && ev.target && ev.target.getBoundingClientRect) {
      const r = ev.target.getBoundingClientRect();
      const rect = fieldEl.getBoundingClientRect();
      x = r.left + r.width / 2 - rect.left;
      y = r.top + r.height / 2 - rect.top;
    }

    if (x == null || y == null) {
      const rect = fieldEl.getBoundingClientRect();
      x = rect.width / 2;
      y = rect.height / 2;
    }

    // score popup
    const pop = document.createElement('div');
    pop.className = 'rb-score-popup';
    if (grade === 'perfect') pop.classList.add('rb-score-perfect');
    else if (grade === 'great') pop.classList.add('rb-score-great');
    else if (grade === 'good') pop.classList.add('rb-score-good');
    else if (grade === 'miss') pop.classList.add('rb-score-miss');
    else if (grade === 'hp') pop.classList.add('rb-score-good');
    else if (grade === 'shield') pop.classList.add('rb-score-shield');

    let label = '';
    if (grade === 'perfect') label = `PERFECT +${scoreGain}`;
    else if (grade === 'great') label = `GREAT +${scoreGain}`;
    else if (grade === 'good') label = `GOOD +${scoreGain}`;
    else if (grade === 'miss') label = `MISS`;
    else if (grade === 'hp') label = `HP +`;
    else if (grade === 'shield') label = `SHIELD +`;

    pop.textContent = label;
    pop.style.left = x + 'px';
    pop.style.bottom = '75px';
    fieldEl.appendChild(pop);
    setTimeout(() => pop.remove(), 650);

    // particle แบบ Shadow Breaker ถ้ามี Particles ใช้เลย
    if (window.Particles && typeof window.Particles.burstHit === 'function') {
      window.Particles.burstHit(fieldEl, { x, y }, { emoji: '✨', count: 6 });
    }
  }

  function showFeedback(msg, type) {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.classList.remove('perfect', 'good', 'miss', 'bomb');
    if (type) feedbackEl.classList.add(type);
  }

  function updateHUD() {
    const hitCount = state.countPerfect + state.countGreat + state.countGood;
    const totalJudged = hitCount + state.countMiss;
    const acc = totalJudged > 0 ? (hitCount / totalJudged) * 100 : 0;

    if (hudScore) hudScore.textContent = state.score;
    if (hudCombo) hudCombo.textContent = state.combo;
    if (hudHp) hudHp.textContent = state.hp;
    if (hudShield) hudShield.textContent = state.shield;
    if (hudTime) hudTime.textContent = state.songTime.toFixed(1);
    if (hudAcc) hudAcc.textContent = `${acc.toFixed(1)}%`;
    if (hudPerfect) hudPerfect.textContent = state.countPerfect;
    if (hudGreat) hudGreat.textContent = state.countGreat;
    if (hudGood) hudGood.textContent = state.countGood;
    if (hudMiss) hudMiss.textContent = state.countMiss;
  }

  // ====== BOOT ======
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
