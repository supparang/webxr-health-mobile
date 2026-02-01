// === /fitness/js/rhythm-engine.js — Rhythm Boxer Engine (Research + CSV + AI hooks) ===
// Classic Script (NO export) — safe for <script src="...">
(function () {
  'use strict';

  const WIN = window;
  const DOC = document;

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

  // base windows (seconds)
  const BASE_HIT_WINDOWS = {
    perfect: 0.06,
    great: 0.12,
    good: 0.2
  };

  // เวลาโน้ตใช้ตกลงมาถึงเส้นตี (วินาที)
  const PRE_SPAWN_SEC = 2.0;

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

  // meta ให้ UI ใช้เติมชื่อเพลง / HUD ได้
  WIN.RB_TRACKS_META = TRACKS.map((t) => ({
    id: t.id,
    name: t.name,
    nameShort: t.nameShort || t.name,
    bpm: t.bpm,
    diff: t.diff
  }));

  // ===== UTIL =====
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function clamp01(v) {
    v = Number(v) || 0;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = mean(arr.map((x) => (x - m) * (x - m)));
    return Math.sqrt(v);
  }
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
    if (low.includes('vr') || low.includes('oculus')) return 'vr';
    if (low.includes('tablet')) return 'tablet';
    if (low.includes('mobi')) return 'mobile';
    return 'pc';
  }

  // ===== CSV TABLE =====
  class CsvTable {
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
      const rows = this.rows;
      if (!rows.length) return '';
      const keysSet = new Set();
      for (const r of rows) {
        Object.keys(r).forEach((k) => keysSet.add(k));
      }
      const keys = Array.from(keysSet);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const lines = [];
      lines.push(keys.join(','));
      for (const r of rows) {
        lines.push(keys.map((k) => esc(r[k])).join(','));
      }
      return lines.join('\n');
    }
  }

  // ===== ENGINE =====
  class RhythmBoxerEngine {
    constructor(opts) {
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio;
      this.renderer = opts.renderer || null;
      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      this.eventTable = new CsvTable();
      this.sessionTable = new CsvTable();

      this._rafId = null;
      this._chartIndex = 0;

      // AI state
      this._ai = {
        lastEmitPerf: 0,
        last: null,
        locked: false,
        assistEnabled: false,
        assistWinScale: 1.0,
        assistDmgDelta: 0
      };

      // hit windows (mutable if assist enabled; research lock => keep base)
      this._hitWindows = {
        perfect: BASE_HIT_WINDOWS.perfect,
        great: BASE_HIT_WINDOWS.great,
        good: BASE_HIT_WINDOWS.good
      };

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

    // ===== PUBLIC API =====
    start(mode, trackId, meta) {
      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      this.mode = mode || 'normal';
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

      // reset hit windows (always base at start)
      this._hitWindows.perfect = BASE_HIT_WINDOWS.perfect;
      this._hitWindows.great = BASE_HIT_WINDOWS.great;
      this._hitWindows.good = BASE_HIT_WINDOWS.good;

      // AI mode/lock/assist
      const A = WIN.RB_AI || null;
      const locked = (A && typeof A.isLocked === 'function') ? !!A.isLocked() : (this.mode === 'research');
      const assistEnabled = (A && typeof A.isAssistEnabled === 'function') ? !!A.isAssistEnabled() : false;

      this._ai.locked = locked;
      this._ai.assistEnabled = (!locked) && assistEnabled;
      this._ai.assistWinScale = 1.0;
      this._ai.assistDmgDelta = 0;
      this._ai.lastEmitPerf = 0;
      this._ai.last = null;

      this._setupAudio();
      this._updateHUD(0);
      this._emitAIIfNeeded(true); // initial
      this._loop();
    }

    stop(reason) {
      if (this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    handleLaneTap(lane) {
      if (!this.running) return;

      const nowPerf = performance.now();
      const songTime = (nowPerf - this.startPerf) / 1000;
      this.songTime = songTime;

      let best = null;
      let bestAbs = Infinity;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (n.lane !== lane) continue;
        const dt = songTime - n.time;
        const adt = Math.abs(dt);
        if (adt < bestAbs) {
          bestAbs = adt;
          best = { note: n, dt };
        }
      }

      if (!best) {
        this._applyEmptyTapMiss(songTime, lane);
        return;
      }

      const { note, dt } = best;
      const judgment = this._judgeFromOffset(dt);

      if (judgment === 'miss') {
        this._applyMiss(note, songTime, dt, true);
      } else {
        this._applyHit(note, songTime, dt, judgment);
      }
    }

    getEventsCsv() {
      return this.eventTable.toCsv();
    }

    getSessionCsv() {
      return this.sessionTable.toCsv();
    }

    // ===== INTERNAL: AUDIO & LOOP =====
    _setupAudio() {
      if (!this.audio) return;

      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = this.track.audio || '';
      this.audio.onended = () => {};

      const p = this.audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          /* autoplay fail — เงียบก็ได้ */
        });
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
      this._emitAIIfNeeded(false);

      if (songTime >= dur) {
        this._finish('song-end');
        return;
      }

      this._rafId = requestAnimationFrame(() => this._loop());
    }

    // ===== INTERNAL: JUDGE =====
    _judgeFromOffset(dt) {
      const adt = Math.abs(dt);
      if (adt <= this._hitWindows.perfect) return 'perfect';
      if (adt <= this._hitWindows.great) return 'great';
      if (adt <= this._hitWindows.good) return 'good';
      return 'miss';
    }

    // ===== INTERNAL: TIMELINE / NOTES =====
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
      const pre = PRE_SPAWN_SEC;

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

      const laneIndex = clamp(info.lane | 0, 0, 4);
      const laneEl = this.lanesEl.querySelector(
        `.rb-lane[data-lane="${laneIndex}"]`
      );
      if (!laneEl) return;

      const noteEl = DOC.createElement('div');
      noteEl.className = 'rb-note';
      const inner = DOC.createElement('div');
      inner.className = 'rb-note-inner';
      inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
      noteEl.appendChild(inner);

      laneEl.appendChild(noteEl);

      const id = this.nextNoteId++;
      const n = {
        id,
        lane: laneIndex,
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
      const travel = h * 0.85;
      const pre = PRE_SPAWN_SEC;

      for (const n of this.notes) {
        if (!n.el || n.state === 'hit' || n.state === 'miss') continue;

        const dt = n.time - songTime;
        const progress = 1 - dt / pre;
        const pClamp = clamp(progress, 0, 1.2);

        const y = (pClamp - 1) * travel;
        n.el.style.transform = `translateY(${y}px)`;
        n.el.style.opacity = pClamp <= 1.0 ? 1 : clamp(1.2 - pClamp, 0, 1);
      }
    }

    _autoJudgeMiss(songTime) {
      const missWindow = this._hitWindows.good + 0.05;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (songTime > n.time + missWindow) {
          this._applyMiss(n, songTime, null, false);
        }
      }

      this.notes = this.notes.filter((n) => n.state === 'pending');
    }

    // ===== INTERNAL: HIT / MISS =====
    _applyHit(note, songTime, dt, judgment) {
      note.state = 'hit';
      if (note.el) {
        note.el.remove();
        note.el = null;
      }

      const side = sideOfLane(note.lane);
      const abs = Math.abs(dt);

      this.offsets.push(dt);
      this.offsetsAbs.push(abs);
      if (dt < 0) this.earlyHits++;
      else this.lateHits++;

      if (side === 'L') this.leftHits++;
      else if (side === 'R') this.rightHits++;

      if (judgment === 'perfect') this.hitPerfect++;
      else if (judgment === 'great') this.hitGreat++;
      else if (judgment === 'good') this.hitGood++;

      let baseScore =
        judgment === 'perfect' ? 300 : judgment === 'great' ? 200 : 100;
      if (this.feverActive) {
        baseScore = Math.round(baseScore * 1.5);
      }

      this.score += baseScore;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      if (judgment === 'perfect') {
        this.hp = clamp(this.hp + 1, 0, 100);
      }
      this.hpMin = Math.min(this.hpMin, this.hp);

      const feverGain =
        judgment === 'perfect' ? 7 : judgment === 'great' ? 5 : 3;
      this._addFeverGauge(feverGain, songTime);

      if (this.renderer && typeof this.renderer.showHitFx === 'function') {
        this.renderer.showHitFx({
          lane: note.lane,
          judgment,
          songTime,
          scoreDelta: baseScore,
          scoreTotal: this.score
        });
      }

      this._logEventRow({
        event_type: 'hit',
        song_time_s: songTime.toFixed(3),
        lane: note.lane,
        side,
        judgment,
        raw_offset_s: dt.toFixed(3),
        abs_offset_s: abs.toFixed(3),
        is_hit: 1,
        is_fever: this.feverActive ? 1 : 0,
        combo_after: this.combo,
        score_delta: baseScore,
        score_total: this.score,
        hp_after: this.hp,
        shield_after: this.shield,
        seg_index: segmentIndex(songTime, this.track.durationSec)
      });
    }

    _applyMiss(note, songTime, dtOrNull, byTap) {
      note.state = 'miss';
      if (note.el) {
        note.el.remove();
        note.el = null;
      }

      this.hitMiss++;
      this.combo = 0;

      // base damage; allow assist to soften ONLY if enabled and NOT locked
      const baseDmg = 5;
      const dmg = clamp(baseDmg + (this._ai.assistEnabled ? this._ai.assistDmgDelta : 0), 2, 8);

      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._addFeverGauge(-8, songTime);

      if (this.renderer && typeof this.renderer.showMissFx === 'function') {
        this.renderer.showMissFx({
          lane: note.lane,
          songTime
        });
      }

      const dt = dtOrNull;
      this._logEventRow({
        event_type: 'miss',
        song_time_s: songTime.toFixed(3),
        lane: note.lane,
        side: sideOfLane(note.lane),
        judgment: 'miss',
        raw_offset_s: dt == null ? '' : dt.toFixed(3),
        abs_offset_s: dt == null ? '' : Math.abs(dt).toFixed(3),
        is_hit: 0,
        is_fever: this.feverActive ? 1 : 0,
        combo_after: this.combo,
        score_delta: 0,
        score_total: this.score,
        hp_after: this.hp,
        shield_after: this.shield,
        seg_index: segmentIndex(songTime, this.track.durationSec),
        miss_by_tap: byTap ? 1 : 0
      });
    }

    _applyEmptyTapMiss(songTime, lane) {
      this.combo = 0;

      const baseDmg = 2;
      const dmg = clamp(baseDmg + (this._ai.assistEnabled ? Math.min(0, this._ai.assistDmgDelta) : 0), 1, 4);

      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._addFeverGauge(-5, songTime);

      this._logEventRow({
        event_type: 'blank-tap',
        song_time_s: songTime.toFixed(3),
        lane,
        side: sideOfLane(lane),
        judgment: 'miss',
        is_hit: 0,
        is_fever: this.feverActive ? 1 : 0,
        combo_after: this.combo,
        score_delta: 0,
        score_total: this.score,
        hp_after: this.hp,
        shield_after: this.shield,
        seg_index: segmentIndex(songTime, this.track.durationSec)
      });
    }

    // ===== FEVER =====
    _addFeverGauge(delta, songTime) {
      this.feverGauge = clamp(this.feverGauge + delta, 0, 100);

      if (!this.feverActive && this.feverGauge >= 100) {
        this.feverActive = true;
        this.feverGauge = 100;
        this.feverEntryCount++;

        if (this.timeToFirstFeverSec == null) {
          this.timeToFirstFeverSec = songTime;
        }

        this.feverEndTime = songTime + 5.0;
      }
    }

    // ===== HUD =====
    _updateHUD(songTime) {
      const h = this.hud;
      if (h.score) h.score.textContent = this.score;
      if (h.combo) h.combo.textContent = this.combo;
      if (h.hp) h.hp.textContent = this.hp;
      if (h.shield) h.shield.textContent = this.shield;
      if (h.time) h.time.textContent = songTime.toFixed(1);

      const totalJudged =
        this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const totalNotes = this.totalNotes || 1;
      const acc = totalJudged
        ? ((totalJudged - this.hitMiss) / totalNotes) * 100
        : 0;
      if (h.acc) h.acc.textContent = acc.toFixed(1) + '%';

      if (h.countPerfect) h.countPerfect.textContent = this.hitPerfect;
      if (h.countGreat) h.countGreat.textContent = this.hitGreat;
      if (h.countGood) h.countGood.textContent = this.hitGood;
      if (h.countMiss) h.countMiss.textContent = this.hitMiss;

      if (h.feverFill) {
        const scale = this.feverGauge / 100;
        h.feverFill.style.transform = `scaleX(${scale})`;
      }
      if (h.feverStatus) {
        if (this.feverActive) {
          h.feverStatus.textContent = 'FEVER!!';
          h.feverStatus.classList.add('on');
        } else {
          h.feverStatus.textContent = 'READY';
          h.feverStatus.classList.remove('on');
        }
      }

      if (h.progFill || h.progText) {
        const dur = this.track.durationSec || 1;
        const prog = clamp(songTime / dur, 0, 1);
        if (h.progFill) h.progFill.style.transform = `scaleX(${prog})`;
        if (h.progText) h.progText.textContent = Math.round(prog * 100) + '%';
      }
    }

    // ===== AI EMIT (prediction shown always, assist only when enabled & not locked) =====
    _emitAIIfNeeded(force) {
      const A = WIN.RB_AI;
      if (!A || typeof A.predict !== 'function') return;

      const now = performance.now();
      if (!force && (now - (this._ai.lastEmitPerf || 0)) < 450) return; // throttle ~0.45s
      this._ai.lastEmitPerf = now;

      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const judged = totalHits + this.hitMiss;
      const accPct = this.totalNotes ? ((this.totalNotes - this.hitMiss) / this.totalNotes) * 100 : 0;
      const offsetAbsMean = this.offsetsAbs.length ? mean(this.offsetsAbs) : null;

      const snapshot = {
        accPct,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        combo: this.combo,
        maxCombo: this.maxCombo,
        hp: this.hp,
        songTime: this.songTime,
        durationSec: this.track.durationSec || 0,
        offsetAbsMean,
        judged
      };

      const ai = A.predict(snapshot) || null;
      if (!ai) return;

      this._ai.last = ai;

      // apply assist ONLY if enabled and not locked
      if (this._ai.assistEnabled) {
        // widen/tighten windows softly based on suggestion
        let scale = 1.0;
        let dmgDelta = 0;
        const sug = (ai.suggestedDifficulty || 'normal').toLowerCase();

        if (sug === 'easy') { scale = 1.12; dmgDelta = -1; }
        else if (sug === 'hard') { scale = 0.92; dmgDelta = +1; }
        else { scale = 1.0; dmgDelta = 0; }

        this._ai.assistWinScale = scale;
        this._ai.assistDmgDelta = dmgDelta;

        this._hitWindows.perfect = BASE_HIT_WINDOWS.perfect * scale;
        this._hitWindows.great   = BASE_HIT_WINDOWS.great   * scale;
        this._hitWindows.good    = BASE_HIT_WINDOWS.good    * scale;
      } else {
        // locked / disabled: keep base windows always
        this._hitWindows.perfect = BASE_HIT_WINDOWS.perfect;
        this._hitWindows.great   = BASE_HIT_WINDOWS.great;
        this._hitWindows.good    = BASE_HIT_WINDOWS.good;
      }

      // notify UI
      if (this.hooks && typeof this.hooks.onAI === 'function') {
        // add lock/assist flags for HUD display if needed
        const out = Object.assign({}, ai, {
          locked: !!this._ai.locked,
          assistEnabled: !!this._ai.assistEnabled
        });
        this.hooks.onAI(out);
      }
    }

    // ===== CSV LOGGING =====
    _logEventRow(extra) {
      const base = {
        session_id: this.sessionId,
        participant_id: this.meta.id || this.meta.participant_id || '',
        group: this.meta.group || '',
        note: this.meta.note || '',
        mode: this.mode,
        track_id: this.track.id,
        track_name: this.track.name,
        bpm: this.track.bpm,
        difficulty: this.track.diff,
        device_type: this.deviceType,
        created_at_iso: new Date().toISOString()
      };
      this.eventTable.add(Object.assign(base, extra));
    }

    _finish(endReason) {
      this.running = false;
      this.ended = true;
      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this.audio) this.audio.pause();

      const dur = Math.min(
        this.songTime,
        this.track.durationSec || this.songTime
      );

      const totalNotes = this.totalNotes || 1;
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const acc = totalJudged
        ? ((totalJudged - this.hitMiss) / totalNotes) * 100
        : 0;

      const mOffset = this.offsets.length ? mean(this.offsets) : 0;
      const sOffset = this.offsets.length ? std(this.offsets) : 0;
      const mAbs = this.offsetsAbs.length ? mean(this.offsetsAbs) : 0;

      const earlyPct = totalHits ? (this.earlyHits / totalHits) * 100 : 0;
      const latePct = totalHits ? (this.lateHits / totalHits) * 100 : 0;

      const leftHitPct = totalHits ? (this.leftHits / totalHits) * 100 : 0;
      const rightHitPct = totalHits ? (this.rightHits / totalHits) * 100 : 0;

      const feverTimePct = dur > 0 ? (this.feverTotalTimeSec / dur) * 100 : 0;

      const rank =
        acc >= 95 ? 'SSS'
        : acc >= 90 ? 'SS'
        : acc >= 85 ? 'S'
        : acc >= 75 ? 'A'
        : acc >= 65 ? 'B'
        : 'C';

      const trialValid = totalJudged >= 10 && acc >= 40 ? 1 : 0;

      const sessionRow = {
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track.id,
        track_name: this.track.name,
        bpm: this.track.bpm,
        difficulty: this.track.diff,
        participant_id: this.meta.id || this.meta.participant_id || '',
        group: this.meta.group || '',
        note: this.meta.note || '',
        score_final: this.score,
        max_combo: this.maxCombo,
        hit_perfect: this.hitPerfect,
        hit_great: this.hitGreat,
        hit_good: this.hitGood,
        hit_miss: this.hitMiss,
        total_notes: this.totalNotes,
        acc_pct: acc,
        offset_mean_s: mOffset,
        offset_std_s: sOffset,
        offset_abs_mean_s: mAbs,
        offset_early_pct: earlyPct,
        offset_late_pct: latePct,
        left_hit_pct: leftHitPct,
        right_hit_pct: rightHitPct,
        fever_entry_count: this.feverEntryCount,
        fever_total_time_s: this.feverTotalTimeSec,
        fever_time_pct: feverTimePct,
        time_to_first_fever_s:
          this.timeToFirstFeverSec != null ? this.timeToFirstFeverSec : '',
        hp_start: 100,
        hp_end: this.hp,
        hp_min: this.hpMin,
        hp_under50_time_s: this.hpUnder50Time,
        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,
        trial_valid: trialValid,
        rank,
        created_at_iso: new Date().toISOString()
      };

      this.sessionTable.add(sessionRow);

      const summary = {
        modeLabel: this.mode === 'research' ? 'Research' : 'Normal',
        trackName: this.track.name,
        endReason,
        finalScore: this.score,
        maxCombo: this.maxCombo,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        accuracyPct: acc,
        offsetMean: mOffset,
        offsetStd: sOffset,
        durationSec: dur,
        participant: this.meta.id || this.meta.participant_id || '',
        rank,
        qualityNote: trialValid
          ? ''
          : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        this.hooks.onEnd(summary);
      }
    }
  }

  WIN.RhythmBoxerEngine = RhythmBoxerEngine;
})();