// === js/rhythm-engine.js — Rhythm Boxer Engine (Research + CSV) ===
(function () {
  'use strict';

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🥊', '💥', '🎯', '💥', '🥊'];

  // หน้าต่างการให้คะแนนตาม offset (วินาที)
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };

  // เวลาโน้ตใช้ตกลงมาถึงเส้นตี (วินาที)
  const PRE_SPAWN_SEC = 2.6;// longer note travel time

  // ===== TRACKS =====
  function makeChart(bpm, dur, seq) {
    const out = [];
    const beat = 60 / bpm;
    let t = 2.0;
    const total = Math.floor((dur - 3) / beat);
    let i = 0;
    while (t < dur - 2 && i < total) {
      out.push({ time: t, lane: seq[i % seq.length], type: 'note' });
      t += beat;
      i++;
    }
    return out;
  }

  const TRACKS = [
    {
      id: 'n1',
      name: 'Warm-up Groove (ง่าย · 100 BPM)',
      nameShort: 'Warm-up Groove',
      audio: './audio/warmup-groove.mp3',
      bpm: 100,
      durationSec: 32,
      diff: 'easy',
      chart: makeChart(100, 32, [2, 1, 3, 2, 1, 3, 2, 3])
    },
    {
      id: 'n2',
      name: 'Focus Combo (ปกติ · 120 BPM)',
      nameShort: 'Focus Combo',
      audio: './audio/focus-combo.mp3',
      bpm: 120,
      durationSec: 32,
      diff: 'normal',
      chart: makeChart(120, 32, [2, 3, 1, 2, 3, 4, 2, 3])
    },
    {
      id: 'n3',
      name: 'Speed Rush (ยาก · 140 BPM)',
      nameShort: 'Speed Rush',
      audio: './audio/speed-rush.mp3',
      bpm: 140,
      durationSec: 32,
      diff: 'hard',
      chart: makeChart(140, 32, [1, 3, 2, 4, 0, 2, 3, 1])
    },
    {
      id: 'r1',
      name: 'Research Track 120 (ทดลอง · 120 BPM)',
      nameShort: 'Research 120',
      audio: './audio/research-120.mp3',
      bpm: 120,
      durationSec: 32,
      diff: 'research',
      chart: makeChart(120, 32, [2, 1, 3, 2, 1, 3, 2, 3])
    }
  ];

  window.RB_TRACKS_META = TRACKS.map((t) => ({
    id: t.id,
    name: t.name,
    nameShort: t.nameShort || t.name,
    bpm: t.bpm,
    diff: t.diff
  }));

  // ===== UTIL =====
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  const std = (arr) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = mean(arr.map((x) => (x - m) * (x - m)));
    return Math.sqrt(v);
  };

  function segmentIndex(songTime, duration) {
    if (!duration || duration <= 0) return 1;
    const r = songTime / duration;
    if (r < 1 / 3) return 1;
    if (r < 2 / 3) return 2;
    return 3;
  }

  function sideOfLane(lane) {
    if (lane === 2) return 'C';
    if (lane === 0 || lane === 1) return 'L';
    return 'R';
  }

  function makeSessionId() {
    const t = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `RB-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}` +
      `-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`
    );
  }

  function detectDeviceType() {
    const ua = (navigator && navigator.userAgent) || '';
    const low = ua.toLowerCase();
    if (low.includes('oculus') || low.includes('quest') || low.includes('vr')) return 'vr';
    if (low.includes('tablet')) return 'tablet';
    if (low.includes('mobi')) return 'mobile';
    return 'pc';
  }

  function detectView(){
    try{
      const v = (new URL(location.href).searchParams.get("view")||"").toLowerCase();
      if(v === "cvr" || v === "cardboard" || v === "vr-cardboard") return "cvr";
      return v || "";
    }catch(_){
      return "";
    }
  }

  // Cardboard/cVR UX: compress 5 lanes -> 3 lanes (L / C / R)
  // Mapping: 0,1 => 1 (L) ; 2 => 2 (C) ; 3,4 => 3 (R)
  function mapLaneForCvr(lane){
    const l = (lane|0);
    if (l <= 1) return 1;
    if (l === 2) return 2;
    return 3;
  }


  // ===== CSV TABLE =====
  class CsvTable {
    constructor() { this.rows = []; }
    clear() { this.rows = []; }
    add(row) { this.rows.push(row); }
    toCsv() {
      const rows = this.rows;
      if (!rows.length) return '';
      const keysSet = new Set();
      for (const r of rows) Object.keys(r).forEach((k) => keysSet.add(k));
      const keys = Array.from(keysSet);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        return (s.includes('"') || s.includes(',') || s.includes('\n')) ? ('"' + s.replace(/"/g,'""') + '"') : s;
      };
      const lines = [];
      lines.push(keys.join(','));
      for (const r of rows) lines.push(keys.map((k) => esc(r[k])).join(','));
      return lines.join('\n');
    }
  }

  function judgeFromOffset(dt, extraWindow) {
    const ex = Number(extraWindow)||0;

    const adt = Math.abs(dt);
    if (adt <= HIT_WINDOWS.perfect + ex) return 'perfect';
    if (adt <= HIT_WINDOWS.great + ex) return 'great';
    if (adt <= HIT_WINDOWS.good + ex) return 'good';
    return 'miss';
  }

  // ===== ENGINE CLASS =====
  class RhythmBoxerEngine {
    constructor(opts) {
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio;
      this.renderer = opts.renderer || null;
      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      this.view = detectView();
      this.useSideHit = (this.view === "cvr");

      this.eventTable = new CsvTable();
      this.sessionTable = new CsvTable();

      // AI predictor (lightweight, deterministic)
      this.ai = (window.RB_AIPredictor) ? new window.RB_AIPredictor({ allowAdapt:false }) : null;
      this.aiLastUpdateAt = 0;
      this.aiMissStreak = 0;

      this._rafId = null;
      this._chartIndex = 0;
      this._bindLanePointer();
    }

    _bindLanePointer() {
      if (!this.lanesEl) return;
      this.lanesEl.addEventListener('pointerdown', (ev) => {
        const laneEl = ev.target.closest('.rb-lane');
        if (!laneEl) return;
        const lane = parseInt(laneEl.dataset.lane || '0', 10);
        this.handleLaneTap(lane);
      });
    }

    start(mode, trackId, meta) {
      if (this._rafId != null) { cancelAnimationFrame(this._rafId); this._rafId = null; }

      this.mode = mode || 'normal';
      // Research mode: show prediction but lock gameplay parameters fixed (no adaptation)
      // Normal mode: allow adaptation only when meta.aiAssist=true (set from ?ai=1)
      const allowAdapt = (this.mode !== 'research') && !!(meta && meta.aiAssist);
      if (this.ai) this.ai.allowAdapt = allowAdapt;

      // Assist knobs (AI Difficulty Director)
      this._assistWiden = 0;                 // seconds added to hit windows
      this._assistDmgMul = 1.0;              // <1 reduces damage
      // --- view / timing config (visual readability) ---
const view = (()=>{
  try{ return (new URL(location.href).searchParams.get('view')||'').toLowerCase(); }catch(_){ return ''; }
})();
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'');
const isCVR = (view === 'cvr' || view === 'cardboard');
// Longer pre-spawn for small screens / Cardboard so notes have time to fall
this._preSpawnSec = (this.mode === 'research')
  ? PRE_SPAWN_SEC
  : (isCVR ? 4.4 : (isMobile ? 3.4 : PRE_SPAWN_SEC));
// Tail length (pure UI) — improves timing visibility
this._noteTailPx = (isCVR ? 220 : (isMobile ? 130 : 110));
try{
  const wrap = (this.wrap || document.querySelector('#rb-wrap'));
  if (wrap) wrap.dataset.view = isCVR ? 'cvr' : (isMobile ? 'mobile' : 'pc');
}catch(_){}
     // note travel time (sec)
      this._assistPreSpawnTarget = PRE_SPAWN_SEC;

      // AI counters
      this.aiTapCount = 0;
      this.aiBlankTaps = 0;
      this.aiMissStreak = 0;
      this.aiLastUpdateAt = 0;
      this.meta = meta || {};
      this.track = TRACKS.find((t) => t.id === trackId) || TRACKS[0];

      this.sessionId = makeSessionId();
      this.deviceType = detectDeviceType();

      this.songTime = 0;
      this.startPerf = performance.now();
      this.running = true;
      this.ended = false;
this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.hp = 100;
      this.hpMin = 100;
      this.hpUnder50Time = 0;
      this.shield = 0;

      this.totalNotes = 0;
      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;

      this.leftHits = 0;
      this.rightHits = 0;

      this.feverGauge = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;
      this.feverEndTime = 0;

      this.lastUpdatePerf = performance.now();

      this.notes = [];
      this.nextNoteId = 1;
      this._chartIndex = 0;

      this.eventTable.clear();

      this._setupAudio();
      this._updateHUD(0);
      this._loop();
    }

    stop(reason) {
      if (this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    // ===== INPUT =====
    handleLaneTap(lane) {
      if (!this.running) return;

      // Cardboard/cVR: map 5 lanes into 3 logical lanes for easier aim
      const tapLane = (this.useSideHit) ? mapLaneForCvr(lane) : lane;

      const nowPerf = performance.now();
      const songTime = (nowPerf - this.startPerf) / 1000;
      this.songTime = songTime;

      // Count taps (for AI fatigue estimation)
      this.aiTapCount++;

      let best = null;
      let bestAbs = Infinity;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (n.lane !== tapLane) continue;

        const dt = songTime - n.time;
        const adt = Math.abs(dt);

        if (adt < bestAbs) {
          bestAbs = adt;
          best = { note: n, dt };
        }
      }

      if (!best) {
        this.aiBlankTaps++;
        this._applyEmptyTapMiss(songTime, tapLane);
        this._aiTick(songTime);
        return;
      }

      const { note, dt } = best;

      // AI assist can widen windows slightly (NORMAL + ?ai=1 only)
      const judgment = judgeFromOffset(dt, this._assistWiden);

      if (judgment === 'miss') {
        this.aiMissStreak++;
        this._applyMiss(note, songTime, dt, true);
      } else {
        this.aiMissStreak = 0;
        this._applyHit(note, songTime, dt, judgment);
      }

      this._aiTick(songTime);
    }

    getEventsCsv() { return this.eventTable.toCsv(); }
    getSessionCsv() { return this.sessionTable.toCsv(); }

    // ===== AUDIO & LOOP =====
    _setupAudio() {
      if (!this.audio) return;

      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = this.track.audio || '';
      this.audio.onended = () => {};

      const p = this.audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* autoplay fail — ignore */ });
      }
    }

    _loop() {
      if (!this.running) return;

      const now = performance.now();
      const dt = (now - this.lastUpdatePerf) / 1000;
      this.lastUpdatePerf = now;

      const songTime = (now - this.startPerf) / 1000;
      this.songTime = songTime;

      const dur = this.track.durationSec || 30;

      this._updateTimeline(songTime, dt);
      this._updateHUD(songTime);

      if (songTime >= dur) {
        this._finish('song-end');
        return;
      }

      this._rafId = requestAnimationFrame(() => this._loop());
    }

    // ===== TIMELINE / NOTES =====
    _updateTimeline(songTime, dt) {
      this._spawnNotes(songTime);
      this._updateNotePositions(songTime);
      this._autoJudgeMiss(songTime);

      if (this.feverActive) {
        this.feverTotalTimeSec += dt;
        if (songTime >= this.feverEndTime) {
          this.feverActive = false;
          this.feverGauge = 0;
        }
      }

      if (this.hp < 50) {
        this.hpUnder50Time += dt;
      }
    }

    _spawnNotes(songTime) {
      const chart = this.track.chart || [];
      const pre = (this._preSpawnSec || PRE_SPAWN_SEC);

      if (this._chartIndex == null) this._chartIndex = 0;

      while (
        this._chartIndex < chart.length &&
        chart[this._chartIndex].time <= songTime + pre
      ) {
        const info = chart[this._chartIndex];
        this._createNote(info);
        this._chartIndex++;
      }
    }

    _createNote(info) {
      if (!this.lanesEl) return;

      // In cVR, lane elements are 0..2 in UI (3 lanes). Engine uses lanes 1..3 mapping.
      const laneIndexRaw = clamp((info.lane | 0), 0, 4);
      const laneIndex = (this.useSideHit) ? mapLaneForCvr(laneIndexRaw) : laneIndexRaw;

      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
      if (!laneEl) return;

      const noteEl = document.createElement('div');
      noteEl.className = 'rb-note';

      // tail for timing visibility
      const tail = document.createElement('div');
      tail.className = 'rb-note-tail';
      tail.style.height = (this._noteTailPx || 110) + 'px';

      const inner = document.createElement('div');
      inner.className = 'rb-note-inner';
      inner.textContent = NOTE_EMOJI_BY_LANE[laneIndexRaw] || '🎵';

      noteEl.appendChild(tail);
      noteEl.appendChild(inner);
      laneEl.appendChild(noteEl);

      const id = this.nextNoteId++;
      const n = {
        id,
        lane: laneIndex,
        laneRaw: laneIndexRaw,
        time: info.time,
        type: info.type || 'note',
        state: 'pending',
        el: noteEl
      };

      this.notes.push(n);
      this.totalNotes++;
    }

    _updateNotePositions(songTime) {
      if (!this.lanesEl) return;

      const rect = this.lanesEl.getBoundingClientRect();
      const h = rect.height || 1;
      const travel = h * 0.86;

      const pre = (this._preSpawnSec || PRE_SPAWN_SEC);

      for (const n of this.notes) {
        if (!n.el || n.state === 'hit' || n.state === 'miss') continue;

        const dt = n.time - songTime;
        const progress = 1 - dt / pre;
        const pClamp = clamp(progress, 0, 1.25);

        // y: from top (negative) into strike line (0 at strike reference)
        const y = (pClamp - 1) * travel;

        n.el.style.transform = `translateY(${y}px)`;
        n.el.style.opacity = (pClamp <= 1.0) ? 1 : clamp(1.25 - pClamp, 0, 1);
      }
    }

    _autoJudgeMiss(songTime) {
      const missWindow = (HIT_WINDOWS.good + this._assistWiden) + 0.06;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (songTime > n.time + missWindow) {
          this.aiMissStreak++;
          this._applyMiss(n, songTime, null, false);
        }
      }

      this.notes = this.notes.filter((n) => n.state === 'pending');
    }