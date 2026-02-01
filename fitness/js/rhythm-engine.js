// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — DOM + Audio
// ✅ FX: DOM renderer hooks
// ✅ Research logging: events.csv + sessions.csv
// ✅ AI: prediction + coach tip (research locked, normal optional)
// ✅ PATCH: add _updateAI() alias to _aiTick() to prevent crash

'use strict';

(function () {

  const WIN = window;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const clamp01 = (v) => clamp(v, 0, 1);

  function nowMs() {
    try { return performance.now(); } catch (_) { return Date.now(); }
  }

  function fmtPct(v) {
    return (Number(v) || 0).toFixed(1) + '%';
  }

  function safeText(el, text) {
    if (!el) return;
    el.textContent = String(text ?? '');
  }

  function readQueryMode() {
    try {
      const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
      if (m === 'research') return 'research';
      return 'normal';
    } catch (_) {
      return 'normal';
    }
  }

  function readQueryFlag(key) {
    try {
      const v = new URL(location.href).searchParams.get(key);
      return v === '1' || v === 'true' || v === 'yes';
    } catch (_) {
      return false;
    }
  }

  // ---- Track presets ----
  const TRACKS = {
    n1: { name: 'Warm-up Groove', bpm: 100, audio: './audio/warmup-groove.mp3', durationSec: 70, lanes: 5 },
    n2: { name: 'Focus Combo',    bpm: 120, audio: './audio/focus-combo.mp3',   durationSec: 75, lanes: 5 },
    n3: { name: 'Speed Rush',     bpm: 140, audio: './audio/speed-rush.mp3',    durationSec: 80, lanes: 5 },
    r1: { name: 'Research 120',   bpm: 120, audio: './audio/research-120.mp3',  durationSec: 90, lanes: 5 }
  };

  // ---- Timing windows (sec) ----
  const JUDGE = {
    perfect: 0.055,
    great:   0.085,
    good:    0.120,
    miss:    0.160
  };

  // ---- Scoring ----
  const SCORE = {
    perfect: 100,
    great:   70,
    good:    40,
    miss:    -25,
    blankTapPenalty: -8
  };

  // ---- HP / FEVER ----
  const HP = {
    max: 100,
    miss: -12,
    blankTap: -3,
    perfect: +0,
    great: +0,
    good: +0
  };

  const FEVER = {
    max: 100,
    perfect: +6,
    great:   +4,
    good:    +2,
    miss:    -8,
    blankTap:-4,
    decayPerSec: 2.2,
    readyAt: 75
  };

  // ---- Notes pattern for each track (very simple demo) ----
  function genPattern(trackId, bpm, durationSec) {
    // Create simple beat grid: 1 note per beat, random-ish lane with mild symmetry
    const beats = Math.floor(durationSec * (bpm / 60));
    const notes = [];
    let lane = 2;
    for (let i = 0; i < beats; i++) {
      const t = i * (60 / bpm);
      // wobble lane
      const r = Math.random();
      if (r < 0.25) lane = clamp(lane - 1, 0, 4);
      else if (r > 0.75) lane = clamp(lane + 1, 0, 4);
      notes.push({ t, lane, id: `${trackId}_${i}` });
    }
    return notes;
  }

  class RhythmBoxerEngine {
    constructor(opts = {}) {
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio;
      this.renderer = opts.renderer;

      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      // mode + meta
      this.mode = 'normal';
      this.trackId = 'n1';
      this.meta = { id: '', group: '', note: '', aiAssistEnabled: false };

      // state
      this.isRunning = false;
      this.startedAtMs = 0;
      this.lastTickMs = 0;

      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.hp = HP.max;
      this.shield = 0;

      this.fever = 0;
      this.feverReady = false;

      // offsets
      this.offsetSamples = []; // signed (sec)
      this.offsetAbsSamples = []; // abs (sec)

      // events logging
      this.events = [];
      this.session = null;

      // AI predictor
      this.ai = null;
      this.lastAI = null;

      // notes
      this.notes = [];
      this.noteIndex = 0;
      this.liveNotes = new Map(); // id -> el
      this.noteEls = [];

      // bindings
      this._onLaneTap = this._onLaneTap.bind(this);
      this._loop = this._loop.bind(this);

      // init lanes clicks
      this._bindLaneEvents();

      // init AI (if module present)
      this._initAI();
    }

    _initAI() {
      // Research lock: never adapt game
      const modeQ = readQueryMode(); // 'research'|'normal'
      const assistEnabled = (modeQ !== 'research') && readQueryFlag('ai');

      // Prefer RB_AIPredictor class if present (from ai-predictor.js pack)
      if (WIN.RB_AIPredictor) {
        this.ai = new WIN.RB_AIPredictor({
          locked: (modeQ === 'research'),
          allowAdapt: assistEnabled
        });
        return;
      }

      // Fallback: if user uses RB_AI API style
      if (WIN.RB_AI && typeof WIN.RB_AI.predict === 'function') {
        const api = WIN.RB_AI;
        this.ai = {
          locked: api.isLocked ? api.isLocked() : (modeQ === 'research'),
          allowAdapt: api.isAssistEnabled ? api.isAssistEnabled() : assistEnabled,
          update: (snapshot) => {
            const out = api.predict(snapshot || {});
            out.locked = (api.isLocked ? api.isLocked() : (modeQ === 'research'));
            out.allowAdapt = (api.isAssistEnabled ? api.isAssistEnabled() : assistEnabled);
            return out;
          }
        };
      }
    }

    _bindLaneEvents() {
      if (!this.lanesEl) return;
      this.lanesEl.addEventListener('click', (e) => {
        const laneEl = e.target && e.target.closest ? e.target.closest('.rb-lane') : null;
        if (!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if (!Number.isFinite(lane)) return;
        this._onLaneTap(lane, 'tap');
      }, { passive: true });
    }

    start(mode, trackId, meta = {}) {
      const tcfg = TRACKS[trackId] || TRACKS.n1;

      this.mode = (mode === 'research') ? 'research' : 'normal';
      this.trackId = trackId in TRACKS ? trackId : 'n1';

      this.meta = Object.assign({ id: '', group: '', note: '', aiAssistEnabled: false }, meta || {});
      // override allowAdapt from meta.aiAssistEnabled (UI)
      if (this.ai) {
        // lock when research always
        this.ai.locked = (this.mode === 'research');
        if (this.mode === 'research') this.ai.allowAdapt = false;
        else this.ai.allowAdapt = !!this.meta.aiAssistEnabled;
      }

      this._resetRun();
      this._prepareSession(tcfg);

      // notes pattern (deterministic? for research we can seed later)
      this.notes = genPattern(this.trackId, tcfg.bpm, tcfg.durationSec);
      this.noteIndex = 0;

      // audio
      if (this.audio) {
        try {
          this.audio.pause();
          this.audio.currentTime = 0;
          this.audio.src = tcfg.audio;
          this.audio.loop = false;
          this.audio.preload = 'auto';
        } catch (_) {}
      }

      this.isRunning = true;
      this.startedAtMs = nowMs();
      this.lastTickMs = this.startedAtMs;

      this._updateHud(0, tcfg.durationSec);

      // start audio (best effort)
      const tryPlay = () => {
        try {
          const p = this.audio && this.audio.play ? this.audio.play() : null;
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
      };
      tryPlay();

      requestAnimationFrame(this._loop);
    }

    stop(reason) {
      if (!this.isRunning) return;
      this._endRun(reason || 'manual-stop');
    }

    _resetRun() {
      // clear live notes
      for (const el of this.liveNotes.values()) { try { el.remove(); } catch (_) {} }
      this.liveNotes.clear();
      this.noteEls = [];

      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.hp = HP.max;
      this.shield = 0;

      this.fever = 0;
      this.feverReady = false;

      this.offsetSamples = [];
      this.offsetAbsSamples = [];

      this.events = [];
      this.session = null;

      this.lastAI = null;

      safeText(this.hud.score, 0);
      safeText(this.hud.combo, 0);
      safeText(this.hud.acc, '0.0%');
      safeText(this.hud.hp, HP.max);
      safeText(this.hud.shield, 0);
      safeText(this.hud.time, '0.0');
      safeText(this.hud.countPerfect, 0);
      safeText(this.hud.countGreat, 0);
      safeText(this.hud.countGood, 0);
      safeText(this.hud.countMiss, 0);

      if (this.hud.feverFill) this.hud.feverFill.style.width = '0%';
      safeText(this.hud.feverStatus, 'READY');

      if (this.hud.progFill) this.hud.progFill.style.width = '0%';
      safeText(this.hud.progText, '0%');

      // AI HUD
      if (this.hud.aiTip) {
        this.hud.aiTip.textContent = '';
        this.hud.aiTip.classList.add('hidden');
      }
    }

    _prepareSession(trackCfg) {
      this.session = {
        tsStart: new Date().toISOString(),
        mode: this.mode,
        trackId: this.trackId,
        trackName: trackCfg.name,
        bpm: trackCfg.bpm,
        durationSec: trackCfg.durationSec,
        participant: (this.meta.id || ''),
        group: (this.meta.group || ''),
        note: (this.meta.note || ''),
        aiAssist: (this.mode === 'research') ? 0 : (this.meta.aiAssistEnabled ? 1 : 0),
        endReason: '',
        finalScore: 0,
        maxCombo: 0,
        hitPerfect: 0,
        hitGreat: 0,
        hitGood: 0,
        hitMiss: 0,
        accuracyPct: 0,
        offsetMean: null,
        offsetStd: null,
        offsetAbsMean: null,
        hpUnder50Sec: 0
      };
      this.hpUnder50Time = 0;
    }

    _loop() {
      if (!this.isRunning) return;

      const tcfg = TRACKS[this.trackId] || TRACKS.n1;

      const now = nowMs();
      const dtMs = Math.max(0, now - this.lastTickMs);
      this.lastTickMs = now;

      // prefer audio clock if available
      let songTime = 0;
      try {
        songTime = this.audio ? (this.audio.currentTime || 0) : 0;
      } catch (_) { songTime = 0; }

      // fallback to wall clock if audio fails
      if (!Number.isFinite(songTime) || songTime <= 0.0001) {
        songTime = (now - this.startedAtMs) / 1000;
      }

      const dt = dtMs / 1000;

      // update timeline
      this._updateTimeline(songTime, dt);

      // end by duration
      if (songTime >= tcfg.durationSec) {
        this._endRun('timeup');
        return;
      }

      requestAnimationFrame(this._loop);
    }

    _updateTimeline(songTime, dt) {
      this._spawnNotes(songTime);
      this._updateNotePositions(songTime);
      this._autoJudgeMiss(songTime);

      // AI tick (prediction + coach tip). Safe if AI module is absent.
      this._updateAI(songTime);

      // fever decay
      this.fever = Math.max(0, this.fever - FEVER.decayPerSec * dt);
      this.feverReady = (this.fever >= FEVER.readyAt);

      // HUD
      this._updateHud(songTime, (TRACKS[this.trackId] || TRACKS.n1).durationSec);

      // hp under 50 tracking
      if (this.hp < 50) this.hpUnder50Time += dt;
    }

    // Backward-compatible alias: older builds called _updateAI(), newer logic is in _aiTick().
    _updateAI(songTime) {
      try {
        if (!this.ai) return;
        if (typeof this._aiTick === 'function') this._aiTick(songTime);
      } catch (_) {}
    }

    _spawnNotes(songTime) {
      // spawn ahead window
      const ahead = 1.3; // seconds before hit line
      while (this.noteIndex < this.notes.length) {
        const n = this.notes[this.noteIndex];
        if (n.t > songTime + ahead) break;

        const el = document.createElement('div');
        el.className = 'rb-note';
        el.setAttribute('data-lane', String(n.lane));
        el.setAttribute('data-id', n.id);

        // attach into lane
        const laneEl = this.lanesEl && this.lanesEl.querySelector
          ? this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`)
          : null;

        if (laneEl) laneEl.appendChild(el);
        else this.field && this.field.appendChild(el);

        this.liveNotes.set(n.id, el);
        this.noteEls.push(el);

        this.noteIndex++;
      }
    }

    _updateNotePositions(songTime) {
      // visual: translate note vertically based on time to hit line
      const speed = 420; // px/sec-ish mapping
      const hitLineY = -42; // relative to bottom of lane (CSS aligns it)
      for (const el of this.noteEls) {
        if (!el || !el.isConnected) continue;
        const id = el.getAttribute('data-id');
        const note = this._findNoteById(id);
        if (!note) continue;
        const dt = note.t - songTime; // sec until hit
        const y = hitLineY - dt * speed;
        el.style.setProperty('--y', y.toFixed(2) + 'px');
      }
    }

    _findNoteById(id) {
      if (!id) return null;
      // notes are small, linear scan ok
      for (let i = 0; i < this.notes.length; i++) {
        if (this.notes[i].id === id) return this.notes[i];
      }
      return null;
    }

    _autoJudgeMiss(songTime) {
      // if note passed beyond miss window, count miss and remove
      const missAfter = JUDGE.miss;
      for (const [id, el] of Array.from(this.liveNotes.entries())) {
        const note = this._findNoteById(id);
        if (!note) continue;
        if (songTime - note.t > missAfter) {
          this._applyJudgment(note.lane, 'miss', (songTime - note.t), { auto: true });
          try { el.remove(); } catch (_) {}
          this.liveNotes.delete(id);
        }
      }
    }

    _onLaneTap(lane, source) {
      if (!this.isRunning) return;

      const songTime = (() => {
        try {
          const t = this.audio ? (this.audio.currentTime || 0) : 0;
          if (Number.isFinite(t) && t > 0.0001) return t;
        } catch (_) {}
        return (nowMs() - this.startedAtMs) / 1000;
      })();

      // find nearest note in that lane within miss window
      let best = null;
      let bestAbs = Infinity;

      for (const [id, el] of this.liveNotes.entries()) {
        const note = this._findNoteById(id);
        if (!note || note.lane !== lane) continue;
        const off = songTime - note.t; // + late, - early
        const abs = Math.abs(off);
        if (abs < bestAbs) {
          bestAbs = abs;
          best = { note, el, off };
        }
      }

      if (!best) {
        // blank tap penalty
        this._logEvent({
          t: songTime,
          type: 'tap',
          lane,
          judgment: 'blank',
          offset: null,
          scoreDelta: SCORE.blankTapPenalty,
          hpDelta: HP.blankTap,
          feverDelta: FEVER.blankTap,
          source
        });

        this.score += SCORE.blankTapPenalty;
        this.hp = clamp(this.hp + HP.blankTap, 0, HP.max);
        this.fever = clamp(this.fever + FEVER.blankTap, 0, FEVER.max);
        this.combo = 0;
        this.hitMiss += 1;

        if (this.renderer && this.renderer.showMissFx) {
          this.renderer.showMissFx({ lane });
        }
        return;
      }

      const abs = bestAbs;
      const off = best.off;

      let judgment = 'miss';
      if (abs <= JUDGE.perfect) judgment = 'perfect';
      else if (abs <= JUDGE.great) judgment = 'great';
      else if (abs <= JUDGE.good) judgment = 'good';
      else if (abs <= JUDGE.miss) judgment = 'miss';

      this._applyJudgment(lane, judgment, off, { auto: false, source });

      // remove note element
      try { best.el.remove(); } catch (_) {}
      this.liveNotes.delete(best.note.id);
    }

    _applyJudgment(lane, judgment, offsetSec, meta = {}) {
      const isAuto = !!meta.auto;
      const source = meta.source || (isAuto ? 'auto' : 'tap');

      let scoreDelta = 0;
      let hpDelta = 0;
      let feverDelta = 0;

      if (judgment === 'perfect') {
        scoreDelta = SCORE.perfect;
        hpDelta = HP.perfect;
        feverDelta = FEVER.perfect;
        this.combo += 1;
        this.hitPerfect += 1;
      } else if (judgment === 'great') {
        scoreDelta = SCORE.great;
        hpDelta = HP.great;
        feverDelta = FEVER.great;
        this.combo += 1;
        this.hitGreat += 1;
      } else if (judgment === 'good') {
        scoreDelta = SCORE.good;
        hpDelta = HP.good;
        feverDelta = FEVER.good;
        this.combo += 1;
        this.hitGood += 1;
      } else { // miss
        scoreDelta = SCORE.miss;
        // shield can block miss damage (and avoid miss count?) — here: block HP only, still counts miss
        const blocked = (this.shield > 0);
        hpDelta = blocked ? 0 : HP.miss;
        if (blocked) this.shield = Math.max(0, this.shield - 1);
        feverDelta = FEVER.miss;
        this.combo = 0;
        this.hitMiss += 1;
      }

      this.maxCombo = Math.max(this.maxCombo, this.combo);

      this.score += scoreDelta;
      this.hp = clamp(this.hp + hpDelta, 0, HP.max);
      this.fever = clamp(this.fever + feverDelta, 0, FEVER.max);

      // offsets stats (only for non-auto + non-miss?)
      if (Number.isFinite(offsetSec) && judgment !== 'miss') {
        this.offsetSamples.push(offsetSec);
        this.offsetAbsSamples.push(Math.abs(offsetSec));
      }

      // log event
      this._logEvent({
        t: this._getSongTimeSafe(),
        type: 'hit',
        lane,
        judgment,
        offset: (Number.isFinite(offsetSec) ? offsetSec : null),
        scoreDelta,
        hpDelta,
        feverDelta,
        source
      });

      // renderer FX
      if (this.renderer) {
        if (judgment === 'miss') {
          this.renderer.showMissFx && this.renderer.showMissFx({ lane });
        } else {
          this.renderer.showHitFx && this.renderer.showHitFx({
            lane, judgment, scoreDelta
          });
        }
      }

      // death
      if (this.hp <= 0) {
        this._endRun('hp0');
      }
    }

    _getSongTimeSafe() {
      try {
        const t = this.audio ? (this.audio.currentTime || 0) : 0;
        if (Number.isFinite(t) && t > 0.0001) return t;
      } catch (_) {}
      return (nowMs() - this.startedAtMs) / 1000;
    }

    _updateHud(songTime, durationSec) {
      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hits = this.hitPerfect + this.hitGreat + this.hitGood;
      const acc = judged > 0 ? (hits / judged) * 100 : 0;

      safeText(this.hud.score, this.score);
      safeText(this.hud.combo, this.combo);
      safeText(this.hud.acc, fmtPct(acc));
      safeText(this.hud.hp, Math.round(this.hp));
      safeText(this.hud.shield, this.shield);
      safeText(this.hud.time, songTime.toFixed(1));

      safeText(this.hud.countPerfect, this.hitPerfect);
      safeText(this.hud.countGreat, this.hitGreat);
      safeText(this.hud.countGood, this.hitGood);
      safeText(this.hud.countMiss, this.hitMiss);

      // FEVER
      if (this.hud.feverFill) this.hud.feverFill.style.width = clamp(this.fever, 0, 100).toFixed(0) + '%';
      safeText(this.hud.feverStatus, this.feverReady ? 'READY' : 'BUILD');

      // PROG
      const prog = clamp01(durationSec > 0 ? (songTime / durationSec) : 0);
      if (this.hud.progFill) this.hud.progFill.style.width = (prog * 100).toFixed(1) + '%';
      safeText(this.hud.progText, (prog * 100).toFixed(0) + '%');
    }

    _aiTick(songTime) {
      if (!this.ai || !this.hud) return;
      // throttle
      if (!this._aiNextAt || songTime >= this._aiNextAt) {
        this._aiNextAt = songTime + 0.8;

        const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
        const hits = this.hitPerfect + this.hitGreat + this.hitGood;
        const accPct = judged > 0 ? (hits / judged) * 100 : 0;

        const meanAbs = (arr) => {
          if (!arr || !arr.length) return null;
          let s = 0;
          for (const x of arr) s += Math.abs(Number(x) || 0);
          return s / arr.length;
        };

        const snapshot = {
          accPct,
          hitMiss: this.hitMiss,
          hitPerfect: this.hitPerfect,
          hitGreat: this.hitGreat,
          hitGood: this.hitGood,
          combo: this.combo,
          offsetAbsMean: meanAbs(this.offsetAbsSamples),
          hp: this.hp,
          songTime,
          durationSec: (TRACKS[this.trackId] || TRACKS.n1).durationSec
        };

        let aiOut = null;
        try {
          aiOut = this.ai.update ? this.ai.update(snapshot) : null;
        } catch (_) {
          aiOut = null;
        }
        if (!aiOut) return;

        this.lastAI = aiOut;

        // Update HUD via hook
        if (this.hooks && typeof this.hooks.onAIUpdate === 'function') {
          try { this.hooks.onAIUpdate(aiOut); } catch (_) {}
        }

        // OPTIONAL adapt (Normal only + allowAdapt)
        if (this.ai.allowAdapt && !this.ai.locked) {
          // (demo) if suggest easy and HP is low, grant small shield once
          if (aiOut.suggestedDifficulty === 'easy' && this.hp < 40 && this.shield < 1) {
            this.shield = 1;
          }
        }
      }
    }

    _logEvent(e) {
      const row = Object.assign({
        ts: new Date().toISOString(),
        mode: this.mode,
        trackId: this.trackId,
        participant: (this.meta.id || ''),
        group: (this.meta.group || ''),
      }, e || {});
      this.events.push(row);
    }

    _endRun(reason) {
      if (!this.isRunning) return;
      this._endRunInternal(reason || 'end');
    }

    _endRunInternal(reason) {
      this.isRunning = false;

      try {
        if (this.audio) {
          this.audio.pause();
        }
      } catch (_) {}

      // compute summary
      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hits = this.hitPerfect + this.hitGreat + this.hitGood;
      const acc = judged > 0 ? (hits / judged) : 0;

      const mean = (arr) => {
        if (!arr || !arr.length) return null;
        let s = 0;
        for (const x of arr) s += Number(x) || 0;
        return s / arr.length;
      };
      const std = (arr) => {
        if (!arr || arr.length < 2) return null;
        const m = mean(arr);
        let s = 0;
        for (const x of arr) {
          const d = (Number(x) || 0) - m;
          s += d * d;
        }
        return Math.sqrt(s / (arr.length - 1));
      };

      const offsetMean = mean(this.offsetSamples);
      const offsetStd = std(this.offsetSamples);
      const offsetAbsMean = mean(this.offsetAbsSamples);

      const durationSec = (TRACKS[this.trackId] || TRACKS.n1).durationSec;
      const songTime = this._getSongTimeSafe();
      const durationPlayed = Math.min(durationSec, Math.max(0, songTime));

      // rank
      let rank = 'C';
      if (acc >= 0.92) rank = 'S';
      else if (acc >= 0.85) rank = 'A';
      else if (acc >= 0.75) rank = 'B';
      else if (acc >= 0.60) rank = 'C';
      else rank = 'D';

      let qualityNote = '';
      if (this.mode === 'research') {
        // quick quality hints
        if (this.hitMiss > (this.hitPerfect + this.hitGreat + this.hitGood)) {
          qualityNote = 'Quality: Miss เยอะมาก — แนะนำให้ฝึก 1 รอบก่อนเก็บข้อมูลจริง';
        } else if (offsetAbsMean != null && offsetAbsMean > 0.10) {
          qualityNote = 'Quality: Timing แกว่ง — ลองช้าลง/โฟกัสเส้นตี';
        }
      }

      const summary = {
        modeLabel: (this.mode === 'research') ? 'Research' : 'Normal',
        trackName: (TRACKS[this.trackId] || TRACKS.n1).name,
        endReason: reason,
        finalScore: this.score,
        maxCombo: this.maxCombo,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        accuracyPct: acc * 100,
        durationSec: durationPlayed,
        rank,
        offsetMean,
        offsetStd,
        participant: (this.meta.id || ''),
        qualityNote
      };

      // session row
      if (this.session) {
        this.session.tsEnd = new Date().toISOString();
        this.session.endReason = reason;
        this.session.finalScore = this.score;
        this.session.maxCombo = this.maxCombo;
        this.session.hitPerfect = this.hitPerfect;
        this.session.hitGreat = this.hitGreat;
        this.session.hitGood = this.hitGood;
        this.session.hitMiss = this.hitMiss;
        this.session.accuracyPct = acc * 100;
        this.session.offsetMean = offsetMean;
        this.session.offsetStd = offsetStd;
        this.session.offsetAbsMean = offsetAbsMean;
        this.session.hpUnder50Sec = this.hpUnder50Time;
      }

      // hook end
      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        try { this.hooks.onEnd(summary); } catch (_) {}
      }
    }

    // ---- CSV exports ----
    getEventsCsv() {
      const rows = this.events || [];
      const cols = [
        'ts','mode','trackId','participant','group',
        't','type','lane','judgment','offset','scoreDelta','hpDelta','feverDelta','source'
      ];
      const esc = (v) => {
        const s = (v == null) ? '' : String(v);
        if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
        return s;
      };
      const out = [cols.join(',')];
      for (const r of rows) {
        out.push(cols.map(c => esc(r[c])).join(','));
      }
      return out.join('\n');
    }

    getSessionCsv() {
      const s = this.session;
      if (!s) return '';
      const cols = [
        'tsStart','tsEnd','mode','trackId','trackName','bpm','durationSec',
        'participant','group','note','aiAssist',
        'endReason','finalScore','maxCombo',
        'hitPerfect','hitGreat','hitGood','hitMiss',
        'accuracyPct','offsetMean','offsetStd','offsetAbsMean','hpUnder50Sec'
      ];
      const esc = (v) => {
        const ss = (v == null) ? '' : String(v);
        if (/[,"\n]/.test(ss)) return '"' + ss.replace(/"/g,'""') + '"';
        return ss;
      };
      return cols.join(',') + '\n' + cols.map(c => esc(s[c])).join(',');
    }
  }

  WIN.RhythmBoxerEngine = RhythmBoxerEngine;

})();