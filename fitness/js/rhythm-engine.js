// === /fitness/js/rhythm-engine.js — Rhythm Boxer Engine (CSV + AI bridge + Research lock) ===
(function () {
  'use strict';

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🥊', '💥', '⭐', '💥', '🥊'];

  // base hit windows (seconds)
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };

  // note travel time (sec)
  const PRE_SPAWN_SEC = 2.0;

  // ===== TRACKS =====
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = mean(arr.map(x => (x - m) * (x - m)));
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
    return `RB-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  }
  function detectDeviceType() {
    const ua = (navigator && navigator.userAgent) || '';
    const low = ua.toLowerCase();
    if (low.includes('oculus') || low.includes('vr')) return 'vr';
    if (low.includes('tablet')) return 'tablet';
    if (low.includes('mobi')) return 'mobile';
    return 'pc';
  }

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

  // ✅ ใช้ไฟล์จริงใน /fitness/sfx ตามที่คุณมีอยู่
  const TRACKS = [
    {
      id: 'n1',
      name: 'Warm-up Groove (ง่าย · 100 BPM)',
      nameShort: 'Warm-up',
      audio: './sfx/warm-up.mp3',
      bpm: 100,
      durationSec: 32,
      diff: 'easy',
      chart: makeChart(100, 32, [2, 1, 3, 2, 1, 3, 2, 3])
    },
    {
      id: 'n2',
      name: 'Focus Combo (ปกติ · 120 BPM)',
      nameShort: 'Combo',
      audio: './sfx/combo.mp3',
      bpm: 120,
      durationSec: 32,
      diff: 'normal',
      chart: makeChart(120, 32, [2, 3, 1, 2, 3, 4, 2, 3])
    },
    {
      id: 'n3',
      name: 'Speed Rush (ยาก · 140 BPM)',
      nameShort: 'Battle',
      audio: './sfx/bgm-battle.mp3',
      bpm: 140,
      durationSec: 32,
      diff: 'hard',
      chart: makeChart(140, 32, [1, 3, 2, 4, 0, 2, 3, 1])
    },
    {
      id: 'r1',
      name: 'Research Track 120 (ทดลอง · 120 BPM)',
      nameShort: 'Research 120',
      audio: './sfx/bgm-menu.mp3',
      bpm: 120,
      durationSec: 32,
      diff: 'normal',
      chart: makeChart(120, 32, [2, 1, 3, 2, 1, 3, 2, 3])
    }
  ];

  // ให้ UI (rhythm-boxer.js) ใช้อ่านชื่อเพลง
  window.RB_TRACKS_META = TRACKS.map(t => ({
    id: t.id, name: t.name, nameShort: t.nameShort || t.name, bpm: t.bpm, diff: t.diff
  }));

  // ===== CSV TABLE =====
  class CsvTable {
    constructor() { this.rows = []; }
    clear() { this.rows = []; }
    add(row) { this.rows.push(row); }
    toCsv() {
      const rows = this.rows;
      if (!rows.length) return '';
      const keysSet = new Set();
      for (const r of rows) Object.keys(r).forEach(k => keysSet.add(k));
      const keys = Array.from(keysSet);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const lines = [];
      lines.push(keys.join(','));
      for (const r of rows) lines.push(keys.map(k => esc(r[k])).join(','));
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

      // AI predictor bridge (classic script: window.RB_AI)
      this.ai = window.RB_AI ? { api: window.RB_AI, allowAdapt: false } : null;
      this.aiState = null;
      this._aiNextAt = 0;

      // Assist knobs (NORMAL + ?ai=1 only)
      this._assistWiden = 0.0;   // widen hit windows
      this._assistDmgMul = 1.0;  // damage multiplier
      this._preSpawnSec = PRE_SPAWN_SEC;

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
      if (this._rafId != null) cancelAnimationFrame(this._rafId);
      this._rafId = null;

      this.mode = mode || 'normal';
      this.meta = meta || {};
      this.track = TRACKS.find(t => t.id === trackId) || TRACKS[0];

      this.sessionId = makeSessionId();
      this.deviceType = detectDeviceType();

      this.songTime = 0;
      this.startPerf = performance.now();
      this.lastUpdatePerf = performance.now();

      this.running = true;
      this.ended = false;

      // stats
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

      // fever
      this.feverGauge = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;
      this.feverEndTime = 0;

      // reset assist
      this._assistWiden = 0.0;
      this._assistDmgMul = 1.0;
      this._preSpawnSec = PRE_SPAWN_SEC;

      // AI: research locked by RB_AI; normal requires ?ai=1
      let allowAdapt = false;
      if (this.ai && this.ai.api && typeof this.ai.api.isAssistEnabled === 'function') {
        allowAdapt = !!this.ai.api.isAssistEnabled();
      }
      if (this.ai) this.ai.allowAdapt = allowAdapt;
      this.aiState = null;
      this._aiNextAt = 0;

      // notes
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

    _setupAudio() {
      if (!this.audio) return;

      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (_) {}

      // ✅ ชี้ไฟล์ที่มีจริง
      this.audio.src = this.track.audio || '';
      this.audio.preload = 'auto';

      try { this.audio.load(); } catch (_) {}

      const p = this.audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay fail ok */ });
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

    _updateTimeline(songTime, dt) {
      this._spawnNotes(songTime);
      this._updateNotePositions(songTime);
      this._autoJudgeMiss(songTime);

      // ✅ FIX: รองรับโค้ดเก่าที่เรียก _updateAI()
      // (บางแพ็คเรียกใน _updateTimeline)
      this._updateAI(songTime);

      if (this.feverActive) {
        this.feverTotalTimeSec += dt;
        if (songTime >= this.feverEndTime) {
          this.feverActive = false;
          this.feverGauge = 0;
        }
      }
      if (this.hp < 50) this.hpUnder50Time += dt;
    }

    // ✅ FIX: alias ให้ไม่พัง (แก้ error ที่คุณเจอ)
    _updateAI(songTime) {
      this._aiTick(songTime);
    }

    _aiTick(songTime) {
      const ai = this.ai;
      if (!ai || !ai.api || typeof ai.api.predict !== 'function') return;

      if (songTime < this._aiNextAt) return;
      this._aiNextAt = songTime + 0.35;

      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const totalNotes = this.totalNotes || 1;
      const accPct = totalJudged ? ((totalJudged - this.hitMiss) / totalNotes) * 100 : 0;
      const offsetAbsMean = (this.offsetsAbs && this.offsetsAbs.length) ? mean(this.offsetsAbs) : null;

      const snap = {
        accPct,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        combo: this.combo,
        maxCombo: this.maxCombo,
        offsetAbsMean,
        hp: this.hp,
        songTime,
        durationSec: this.track.durationSec || 0
      };

      let state = null;
      try { state = ai.api.predict(snap) || null; } catch (_) { state = null; }
      if (!state) return;

      this.aiState = state;

      // HUD
      const h = this.hud || {};
      if (h.aiFatigue) h.aiFatigue.textContent = Math.round((state.fatigueRisk || 0) * 100) + '%';
      if (h.aiSkill)   h.aiSkill.textContent   = Math.round((state.skillScore || 0) * 100) + '%';
      if (h.aiSuggest) h.aiSuggest.textContent = (state.suggestedDifficulty || 'normal');
      if (h.aiTip) {
        h.aiTip.textContent = state.tip || '';
        h.aiTip.classList.toggle('hidden', !state.tip);
      }

      // hook
      if (this.hooks && typeof this.hooks.onAIUpdate === 'function') {
        const locked = (ai.api && typeof ai.api.isLocked === 'function') ? !!ai.api.isLocked() : false;
        this.hooks.onAIUpdate(state, snap, { allowAdapt: !!ai.allowAdapt, locked });
      }

      // Apply assist ONLY when enabled (normal + ?ai=1)
      if (ai.allowAdapt) this._applyAIDirector(state);
    }

    _applyAIDirector(state) {
      const fatigue = clamp(state.fatigueRisk || 0, 0, 1);
      const skill   = clamp(state.skillScore || 0.5, 0, 1);

      this._assistWiden  = clamp(0.05 + fatigue * 0.35 + (1 - skill) * 0.15, 0.0, 0.55);
      this._assistDmgMul = clamp(1.0 - fatigue * 0.35, 0.65, 1.15);
      this._preSpawnSec  = clamp(PRE_SPAWN_SEC + fatigue * 0.35, 1.8, 2.6);
    }

    _spawnNotes(songTime) {
      const chart = this.track.chart || [];
      const pre = this._preSpawnSec || PRE_SPAWN_SEC;

      while (this._chartIndex < chart.length && chart[this._chartIndex].time <= songTime + pre) {
        const info = chart[this._chartIndex];
        this._createNote(info);
        this._chartIndex++;
      }
    }

    _createNote(info) {
      if (!this.lanesEl) return;

      const laneIndex = clamp(info.lane | 0, 0, 4);
      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
      if (!laneEl) return;

      const noteEl = document.createElement('div');
      noteEl.className = 'rb-note';
      const inner = document.createElement('div');
      inner.className = 'rb-note-inner';
      inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🥊';
      noteEl.appendChild(inner);

      laneEl.appendChild(noteEl);

      const n = {
        id: this.nextNoteId++,
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
      const pre = this._preSpawnSec || PRE_SPAWN_SEC;

      for (const n of this.notes) {
        if (!n.el || n.state !== 'pending') continue;

        const dt = n.time - songTime;
        const progress = 1 - dt / pre;
        const p = clamp(progress, 0, 1.2);

        const y = (p - 1) * travel;
        n.el.style.transform = `translateY(${y}px)`;
        n.el.style.opacity = p <= 1.0 ? 1 : clamp(1.2 - p, 0, 1);
      }
    }

    _autoJudgeMiss(songTime) {
      const missWindow = (HIT_WINDOWS.good * (1 + this._assistWiden)) + 0.05;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (songTime > n.time + missWindow) this._applyMiss(n, songTime, null, false);
      }
      this.notes = this.notes.filter(n => n.state === 'pending');
    }

    _judgeFromOffsetAssist(dt) {
      const adt = Math.abs(dt);
      const w = 1 + (this._assistWiden || 0);
      if (adt <= HIT_WINDOWS.perfect * w) return 'perfect';
      if (adt <= HIT_WINDOWS.great * w)   return 'great';
      if (adt <= HIT_WINDOWS.good * w)    return 'good';
      return 'miss';
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
        if (adt < bestAbs) { bestAbs = adt; best = { note: n, dt }; }
      }

      if (!best) { this._applyEmptyTapMiss(songTime, lane); return; }

      const { note, dt } = best;
      const judgment = this._judgeFromOffsetAssist(dt);

      if (judgment === 'miss') this._applyMiss(note, songTime, dt, true);
      else this._applyHit(note, songTime, dt, judgment);
    }

    _addFeverGauge(delta, songTime) {
      this.feverGauge = clamp(this.feverGauge + delta, 0, 100);
      if (!this.feverActive && this.feverGauge >= 100) {
        this.feverActive = true;
        this.feverGauge = 100;
        this.feverEntryCount++;
        if (this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = songTime;
        this.feverEndTime = songTime + 5.0;
      }
    }

    _logEventRow(extra) {
      const base = {
        session_id: this.sessionId,
        participant_id: (this.meta && (this.meta.id || this.meta.participant_id)) || '',
        group: (this.meta && this.meta.group) || '',
        note: (this.meta && this.meta.note) || '',
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

    _applyHit(note, songTime, dt, judgment) {
      note.state = 'hit';
      if (note.el) { note.el.remove(); note.el = null; }

      const side = sideOfLane(note.lane);
      const abs = Math.abs(dt);

      this.offsets.push(dt);
      this.offsetsAbs.push(abs);
      if (dt < 0) this.earlyHits++; else this.lateHits++;
      if (side === 'L') this.leftHits++; else if (side === 'R') this.rightHits++;

      if (judgment === 'perfect') this.hitPerfect++;
      else if (judgment === 'great') this.hitGreat++;
      else if (judgment === 'good') this.hitGood++;

      let baseScore = (judgment === 'perfect') ? 300 : (judgment === 'great') ? 200 : 100;
      if (this.feverActive) baseScore = Math.round(baseScore * 1.5);

      this.score += baseScore;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      if (judgment === 'perfect') this.hp = clamp(this.hp + 1, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      const feverGain = (judgment === 'perfect') ? 7 : (judgment === 'great') ? 5 : 3;
      this._addFeverGauge(feverGain, songTime);

      if (this.renderer && typeof this.renderer.showHitFx === 'function') {
        this.renderer.showHitFx({ lane: note.lane, judgment, scoreDelta: baseScore });
      }

      const ai = this.aiState || {};
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
        seg_index: segmentIndex(songTime, this.track.durationSec),
        ai_fatigue: (ai.fatigueRisk != null) ? ai.fatigueRisk : '',
        ai_skill: (ai.skillScore != null) ? ai.skillScore : '',
        ai_suggest: ai.suggestedDifficulty || '',
        ai_locked: (this.ai && this.ai.api && typeof this.ai.api.isLocked === 'function') ? (this.ai.api.isLocked() ? 1 : 0) : ''
      });
    }

    _applyMiss(note, songTime, dtOrNull, byTap) {
      note.state = 'miss';
      if (note.el) { note.el.remove(); note.el = null; }

      this.hitMiss++;
      this.combo = 0;

      const dmg = Math.round(5 * (this._assistDmgMul || 1.0));
      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._addFeverGauge(-8, songTime);

      if (this.renderer && typeof this.renderer.showMissFx === 'function') {
        this.renderer.showMissFx({ lane: note.lane });
      }

      const dt = dtOrNull;
      const ai = this.aiState || {};
      this._logEventRow({
        event_type: 'miss',
        song_time_s: songTime.toFixed(3),
        lane: note.lane,
        side: sideOfLane(note.lane),
        judgment: 'miss',
        raw_offset_s: (dt == null) ? '' : dt.toFixed(3),
        abs_offset_s: (dt == null) ? '' : Math.abs(dt).toFixed(3),
        is_hit: 0,
        is_fever: this.feverActive ? 1 : 0,
        combo_after: this.combo,
        score_delta: 0,
        score_total: this.score,
        hp_after: this.hp,
        shield_after: this.shield,
        seg_index: segmentIndex(songTime, this.track.durationSec),
        miss_by_tap: byTap ? 1 : 0,
        ai_fatigue: (ai.fatigueRisk != null) ? ai.fatigueRisk : '',
        ai_skill: (ai.skillScore != null) ? ai.skillScore : '',
        ai_suggest: ai.suggestedDifficulty || '',
        ai_locked: (this.ai && this.ai.api && typeof this.ai.api.isLocked === 'function') ? (this.ai.api.isLocked() ? 1 : 0) : ''
      });
    }

    _applyEmptyTapMiss(songTime, lane) {
      this.combo = 0;

      const dmg = Math.round(2 * (this._assistDmgMul || 1.0));
      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._addFeverGauge(-5, songTime);

      const ai = this.aiState || {};
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
        seg_index: segmentIndex(songTime, this.track.durationSec),
        ai_fatigue: (ai.fatigueRisk != null) ? ai.fatigueRisk : '',
        ai_skill: (ai.skillScore != null) ? ai.skillScore : '',
        ai_suggest: ai.suggestedDifficulty || '',
        ai_locked: (this.ai && this.ai.api && typeof this.ai.api.isLocked === 'function') ? (this.ai.api.isLocked() ? 1 : 0) : ''
      });
    }

    _updateHUD(songTime) {
      const h = this.hud || {};
      if (h.score) h.score.textContent = this.score;
      if (h.combo) h.combo.textContent = this.combo;
      if (h.hp) h.hp.textContent = this.hp;
      if (h.shield) h.shield.textContent = this.shield;
      if (h.time) h.time.textContent = songTime.toFixed(1);

      const totalJudged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const totalNotes = this.totalNotes || 1;
      const acc = totalJudged ? ((totalJudged - this.hitMiss) / totalNotes) * 100 : 0;
      if (h.acc) h.acc.textContent = acc.toFixed(1) + '%';

      if (h.countPerfect) h.countPerfect.textContent = this.hitPerfect;
      if (h.countGreat) h.countGreat.textContent = this.hitGreat;
      if (h.countGood) h.countGood.textContent = this.hitGood;
      if (h.countMiss) h.countMiss.textContent = this.hitMiss;

      if (h.feverFill) h.feverFill.style.transform = `scaleX(${(this.feverGauge / 100)})`;
      if (h.feverStatus) {
        if (this.feverActive) { h.feverStatus.textContent = 'FEVER!!'; h.feverStatus.classList.add('on'); }
        else { h.feverStatus.textContent = 'READY'; h.feverStatus.classList.remove('on'); }
      }

      if (h.progFill || h.progText) {
        const dur = this.track.durationSec || 1;
        const prog = clamp(songTime / dur, 0, 1);
        if (h.progFill) h.progFill.style.transform = `scaleX(${prog})`;
        if (h.progText) h.progText.textContent = Math.round(prog * 100) + '%';
      }
    }

    getEventsCsv() { return this.eventTable.toCsv(); }
    getSessionCsv() { return this.sessionTable.toCsv(); }

    _finish(endReason) {
      this.running = false;
      this.ended = true;
      if (this._rafId != null) cancelAnimationFrame(this._rafId);
      this._rafId = null;

      if (this.audio) { try { this.audio.pause(); } catch (_) {} }

      const dur = Math.min(this.songTime, this.track.durationSec || this.songTime);
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const totalNotes = this.totalNotes || 1;
      const acc = totalJudged ? ((totalJudged - this.hitMiss) / totalNotes) * 100 : 0;

      const mOffset = this.offsets.length ? mean(this.offsets) : 0;
      const sOffset = this.offsets.length ? std(this.offsets) : 0;

      const rank =
        acc >= 95 ? 'SSS' :
        acc >= 90 ? 'SS' :
        acc >= 85 ? 'S' :
        acc >= 75 ? 'A' :
        acc >= 65 ? 'B' : 'C';

      const trialValid = (totalJudged >= 10 && acc >= 40) ? 1 : 0;

      const ai = this.aiState || {};
      this.sessionTable.add({
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track.id,
        track_name: this.track.name,
        bpm: this.track.bpm,
        difficulty: this.track.diff,
        participant_id: (this.meta && (this.meta.id || this.meta.participant_id)) || '',
        group: (this.meta && this.meta.group) || '',
        note: (this.meta && this.meta.note) || '',
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
        fever_entry_count: this.feverEntryCount,
        fever_total_time_s: this.feverTotalTimeSec,
        hp_end: this.hp,
        hp_min: this.hpMin,
        hp_under50_time_s: this.hpUnder50Time,
        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,
        trial_valid: trialValid,
        rank,
        ai_fatigue: (ai.fatigueRisk != null) ? ai.fatigueRisk : '',
        ai_skill: (ai.skillScore != null) ? ai.skillScore : '',
        ai_suggest: ai.suggestedDifficulty || '',
        ai_locked: (this.ai && this.ai.api && typeof this.ai.api.isLocked === 'function') ? (this.ai.api.isLocked() ? 1 : 0) : '',
        created_at_iso: new Date().toISOString()
      });

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
        participant: (this.meta && (this.meta.id || this.meta.participant_id)) || '',
        rank,
        qualityNote: trialValid ? '' : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') this.hooks.onEnd(summary);
    }
  }

  window.RhythmBoxerEngine = RhythmBoxerEngine;
})();