// === /fitness/js/rhythm-engine.js — Rhythm Boxer Engine (Research + CSV) ===
(function () {
  'use strict';

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🥊', '💥', '🎯', '💥', '🥊'];

  // หน้าต่างการให้คะแนนตาม offset (วินาที)
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };

  // เวลาโน้ตใช้ตกลงมาถึงเส้นตี (วินาที)
  const PRESPAWN = 1.65;

  // เวลาแสดงโน้ตก่อนเวลาตี (วินาที) (กันหล่นไม่ถึงเส้น)
  const SCHEDULE_LOOKAHEAD = 2.2;

  // ระยะ tolerance สำหรับ “ตีได้” (วินาที) = good window + กันคลาดเพิ่มเล็กน้อย
  const HIT_TOL = 0.24;

  // แถบ FEVER
  const FEVER_BUILD_PERFECT = 0.16;
  const FEVER_BUILD_GREAT = 0.12;
  const FEVER_BUILD_GOOD = 0.08;
  const FEVER_DECAY_PER_MISS = 0.10;
  const FEVER_ACTIVE_SEC = 3.0;

  // HP
  const HP_START = 100;
  const HP_LOSS_MISS = 5;
  const HP_LOSS_BLANK = 1;

  // Shield
  const SHIELD_GAIN_PERFECT = 0.10;
  const SHIELD_GAIN_GREAT = 0.07;
  const SHIELD_GAIN_GOOD = 0.04;
  const SHIELD_MAX = 3;

  // score
  const SCORE_PERFECT = 120;
  const SCORE_GREAT = 80;
  const SCORE_GOOD = 40;
  const SCORE_MISS = 0;
  const SCORE_BLANK = -10;

  // combo bonus
  const COMBO_BONUS_STEP = 12; // every 12 combo => small bonus
  const COMBO_BONUS = 25;

  // note render sizing
  const NOTE_W_MIN = 56;
  const NOTE_W_MAX = 100;

  // ===== Utils =====
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

  function nowMs() {
    try {
      return performance.now();
    } catch (_) {
      return Date.now();
    }
  }

  function mean(arr) {
    if (!arr || !arr.length) return 0;
    let s = 0;
    for (const x of arr) s += x;
    return s / arr.length;
  }

  function std(arr) {
    if (!arr || arr.length < 2) return 0;
    const m = mean(arr);
    let v = 0;
    for (const x of arr) v += (x - m) * (x - m);
    return Math.sqrt(v / (arr.length - 1));
  }

  function toCsv(rows, header) {
    if (!rows || !rows.length) {
      return (header && header.length)
        ? header.join(',') + '\n'
        : '';
    }
    const keys = header && header.length ? header : Object.keys(rows[0]);
    const esc = (s) => {
      const t = String(s ?? '');
      if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
      return t;
    };
    const out = [];
    out.push(keys.map(esc).join(','));
    for (const r of rows) {
      out.push(keys.map(k => esc(r[k])).join(','));
    }
    return out.join('\n') + '\n';
  }

  function genId() {
    const r = () => Math.random().toString(16).slice(2);
    return `${Date.now()}-${r()}-${r()}`;
  }

  function detectDeviceType() {
    // rough labels for research
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
    const isVR = !!(navigator.xr);
    if (isVR && isMobile) return 'mobile-xr';
    if (isVR) return 'desktop-xr';
    if (isMobile) return 'mobile';
    return 'desktop';
  }

  // ===== Data Tables =====
  class SimpleTable {
    constructor(header) {
      this.header = header || [];
      this.rows = [];
    }
    add(row) {
      this.rows.push(Object.assign({}, row));
    }
    csv() {
      return toCsv(this.rows, this.header);
    }
    clear() {
      this.rows.length = 0;
    }
  }

  // ===== Track Library =====
  // schedule is "beats" relative to song start, each note has { t, lane, kind }
  // NOTE: In this pack we use simple canned patterns with BPM-based spacing.
  function buildTrack(id) {
    // normal tracks: n1 100bpm easy, n2 120bpm normal, n3 140bpm hard
    // research: r1 fixed 120
    const lib = {
      n1: { id: 'n1', name: 'Warm-up Groove', bpm: 100, diff: 'easy', durationSec: 42 },
      n2: { id: 'n2', name: 'Focus Combo', bpm: 120, diff: 'normal', durationSec: 48 },
      n3: { id: 'n3', name: 'Speed Rush', bpm: 140, diff: 'hard', durationSec: 52 },
      r1: { id: 'r1', name: 'Research 120', bpm: 120, diff: 'normal', durationSec: 60 }
    };
    const t = lib[id] || lib.n1;

    // pattern generator (deterministic in research if seed provided)
    const bpm = t.bpm;
    const beatSec = 60 / bpm;

    // base density by difficulty
    const density =
      (t.diff === 'easy') ? 0.62 :
      (t.diff === 'hard') ? 0.90 : 0.78;

    // for research, keep consistent density
    const steps = Math.floor(t.durationSec / beatSec);
    const notes = [];

    // simple seeded rng (for research determinism)
    let seed = 1234567;
    function rnd() {
      // xorshift32
      seed ^= seed << 13; seed |= 0;
      seed ^= seed >>> 17; seed |= 0;
      seed ^= seed << 5; seed |= 0;
      // => 0..1
      return ((seed >>> 0) % 1000000) / 1000000;
    }

    // allow external seed via query for research runs
    try {
      const sp = new URL(location.href).searchParams;
      const ss = sp.get('seed');
      if (ss) {
        const n = parseInt(ss, 10);
        if (Number.isFinite(n)) seed = (n | 0) || seed;
      }
    } catch (_) { }

    // lane weight: prefer center for easy, spread for hard
    const laneWeights =
      (t.diff === 'easy') ? [0.10, 0.20, 0.40, 0.20, 0.10] :
      (t.diff === 'hard') ? [0.22, 0.22, 0.12, 0.22, 0.22] :
      [0.18, 0.22, 0.20, 0.22, 0.18];

    function pickLane() {
      const r = rnd();
      let acc = 0;
      for (let i = 0; i < laneWeights.length; i++) {
        acc += laneWeights[i];
        if (r <= acc) return i;
      }
      return 2;
    }

    // schedule
    // place notes every beat, but skip by density
    for (let i = 0; i < steps; i++) {
      const tSec = i * beatSec;

      // 3-phase structure: warm-up, main, cool-down
      const phase = i / steps;
      let p = density;
      if (phase < 0.18) p *= 0.75;
      else if (phase > 0.82) p *= 0.72;

      // slightly increased density in hard mid section
      if (t.diff === 'hard' && phase > 0.35 && phase < 0.72) p *= 1.08;

      if (rnd() <= p) {
        notes.push({
          t: tSec,
          lane: pickLane(),
          kind: 'tap'
        });
      }
    }

    // ensure at least a few notes
    if (notes.length < 20) {
      for (let i = 0; i < 20; i++) notes.push({ t: i * beatSec * 1.2, lane: (i % 5), kind: 'tap' });
    }

    return Object.assign({}, t, { notes });
  }

  // ===== DOM Note =====
  function createNoteEl(lane, sizePx) {
    const el = document.createElement('div');
    el.className = 'rb-note';
    el.dataset.lane = String(lane);
    const em = NOTE_EMOJI_BY_LANE[lane] || '🥊';
    el.textContent = em;

    // style: width/height set by css var
    el.style.setProperty('--noteSize', sizePx + 'px');
    return el;
  }

  function getLaneElByIndex(lanesEl, lane) {
    if (!lanesEl) return null;
    return lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
  }

  // ===== Engine =====
  class RhythmBoxerEngine {
    constructor(opts) {
      opts = opts || {};
      this.wrap = opts.wrap || document.body;
      this.field = opts.field || null;
      this.lanesEl = opts.lanesEl || null;
      this.audio = opts.audio || null;
      this.renderer = opts.renderer || null;
      this.hud = opts.hud || null;
      this.hooks = opts.hooks || {};
      this.deviceType = detectDeviceType();

      this._rafId = null;
      this.running = false;
      this.ended = false;

      this._bindLaneInput();

      // tables
      this.eventsTable = new SimpleTable([
        'session_id', 'mode', 'track_id', 't_song', 't_real', 'lane', 'action',
        'judgment', 'offset_s', 'score_delta', 'combo', 'hp', 'fever', 'shield',
        'ai_fatigue_risk', 'ai_skill_score', 'ai_suggest', 'ai_locked', 'ai_assist_on'
      ]);
      this.sessionTable = new SimpleTable([
        'session_id', 'mode', 'track_id', 'track_name', 'bpm', 'difficulty',
        'participant_id', 'group', 'note',
        'score_final', 'max_combo',
        'hit_perfect', 'hit_great', 'hit_good', 'hit_miss',
        'total_notes', 'acc_pct',
        'offset_mean_s', 'offset_std_s', 'offset_abs_mean_s',
        'offset_early_pct', 'offset_late_pct',
        'left_hit_pct', 'right_hit_pct',
        'fever_entry_count', 'fever_total_time_s', 'fever_time_pct', 'time_to_first_fever_s',
        'hp_start', 'hp_end', 'hp_min', 'hp_under50_time_s',
        'end_reason', 'duration_sec', 'device_type',
        'ai_fatigue_risk', 'ai_skill_score', 'ai_suggest', 'ai_locked', 'ai_assist_on',
        'trial_valid', 'rank', 'created_at_iso'
      ]);

      // AI state
      this.aiState = null;
      this._lastAIMs = 0;
      this._aiTipCooldownMs = 1100;
    }

    // ===== public =====
    start(mode, trackId, meta) {
      this.mode = (mode === 'research') ? 'research' : 'normal';
      this.meta = meta || {};

      this.track = buildTrack(trackId);
      this.songTime = 0;

      // internal
      this.sessionId = genId();
      this.running = true;
      this.ended = false;

      // stats
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.totalNotes = this.track.notes.length;

      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;
      this.leftHits = 0;
      this.rightHits = 0;

      this.hp = HP_START;
      this.hpMin = this.hp;
      this.hpUnder50Time = 0;

      this.shield = 0;

      // FEVER
      this.fever = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;
      this._feverLeft = 0;

      // timeline ptr
      this._nextNoteIdx = 0;

      // clear DOM notes
      this._clearNotes();

      // set HUD
      this._updateHUD(true);

      // start audio
      this._loadAndPlayTrackAudio(trackId);

      // start raf loop
      this._t0 = nowMs();
      this._lastMs = this._t0;

      this._loop();
    }

    stop(reason) {
      if (!this.running || this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    getEventsCsv() {
      return this.eventsTable.csv();
    }
    getSessionCsv() {
      return this.sessionTable.csv();
    }

    // ===== audio =====
    _loadAndPlayTrackAudio(trackId) {
      if (!this.audio) return;
      let src = '';
      // NOTE: this pack expects audio under /fitness/audio/
      if (trackId === 'n1') src = './audio/warmup-groove.mp3';
      else if (trackId === 'n2') src = './audio/focus-combo.mp3';
      else if (trackId === 'n3') src = './audio/speed-rush.mp3';
      else if (trackId === 'r1') src = './audio/research-120.mp3';
      else src = './audio/warmup-groove.mp3';

      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = src;
        this.audio.load();
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => { });
      } catch (_) { }
    }

    // ===== input =====
    _bindLaneInput() {
      // delegate pointerdown on lane
      document.addEventListener('pointerdown', (e) => {
        const laneEl = e.target && e.target.closest ? e.target.closest('.rb-lane') : null;
        if (!laneEl) return;
        const lane = parseInt(laneEl.getAttribute('data-lane') || '2', 10);
        this._onHitAttempt(lane, 'tap');
      }, { passive: true });

      // allow mouse click for desktop
      document.addEventListener('mousedown', (e) => {
        const laneEl = e.target && e.target.closest ? e.target.closest('.rb-lane') : null;
        if (!laneEl) return;
        const lane = parseInt(laneEl.getAttribute('data-lane') || '2', 10);
        this._onHitAttempt(lane, 'click');
      }, { passive: true });

      // keyboard mapping for testing (A S D J K)
      document.addEventListener('keydown', (e) => {
        if (!this.running || this.ended) return;
        const k = (e.key || '').toLowerCase();
        const map = { a: 0, s: 1, d: 2, j: 3, k: 4 };
        if (map[k] == null) return;
        this._onHitAttempt(map[k], 'key');
      });
    }

    // ===== loop =====
    _loop() {
      if (!this.running || this.ended) return;

      const t = nowMs();
      const dt = (t - this._lastMs) / 1000;
      this._lastMs = t;

      // sync songTime with audio if possible
      let songTime = this.songTime + dt;
      if (this.audio && Number.isFinite(this.audio.currentTime)) {
        // prefer audio clock
        songTime = this.audio.currentTime;
      }
      this.songTime = songTime;

      // schedule notes ahead
      this._scheduleNotes();

      // update note positions
      this._updateTimeline(dt);

      // fever timing
      this._updateFever(dt);

      // hp time under 50
      if (this.hp < 50) this.hpUnder50Time += dt;

      // end check
      const dur = this.track.durationSec || 0;
      if (dur > 0 && this.songTime >= dur) {
        // allow last window
        if (this._allNotesResolved()) this._finish('time-up');
      }
      if (this.hp <= 0) {
        this._finish('hp-zero');
      }

      // AI update
      this._updateAI();

      // HUD
      this._updateHUD(false);

      this._rafId = requestAnimationFrame(() => this._loop());
    }

    _scheduleNotes() {
      const notes = this.track.notes || [];
      while (this._nextNoteIdx < notes.length) {
        const n = notes[this._nextNoteIdx];
        // spawn when note.t - PRESPAWN is within lookahead
        if (n.t - PRESPAWN <= this.songTime + SCHEDULE_LOOKAHEAD) {
          this._spawnNote(n);
          this._nextNoteIdx++;
        } else break;
      }
    }

    _spawnNote(note) {
      const lane = note.lane;
      const laneEl = getLaneElByIndex(this.lanesEl, lane);
      if (!laneEl) return;

      // size by difficulty (bigger for easy)
      const diff = (this.track.diff || 'normal');
      const base =
        (diff === 'easy') ? 92 :
        (diff === 'hard') ? 64 : 76;
      const sizePx = clamp(base + (Math.random() * 10 - 5), NOTE_W_MIN, NOTE_W_MAX);

      const el = createNoteEl(lane, sizePx);
      el.dataset.t = String(note.t);
      el.dataset.state = 'live'; // live | hit | miss

      // Store timing for interpolation
      el.__rb = {
        tHit: note.t,            // song time where it should reach hit line
        tSpawn: note.t - PRESPAWN,
        lane,
        hit: false,
        miss: false
      };

      laneEl.appendChild(el);
    }

    _updateTimeline(dt) {
      const live = this.lanesEl ? this.lanesEl.querySelectorAll('.rb-note') : [];
      for (const el of live) {
        const st = el.__rb;
        if (!st || st.hit || st.miss) continue;

        const tNow = this.songTime;
        const p = (tNow - st.tSpawn) / (PRESPAWN);
        // position from top (0) to bottom (1) at hit line
        // clamp
        const pr = clamp(p, -0.25, 1.35);

        // Use CSS var --p to animate along lane
        el.style.setProperty('--p', pr);

        // miss if passed hit window far enough
        if (tNow > st.tHit + HIT_TOL) {
          st.miss = true;
          el.dataset.state = 'miss';
          el.classList.add('is-miss');
          // remove after short
          setTimeout(() => { try { el.remove(); } catch (_) { } }, 200);
          this._applyMiss(st.lane, 'timeout');
        }
      }
    }

    _allNotesResolved() {
      if (!this.lanesEl) return true;
      const live = this.lanesEl.querySelectorAll('.rb-note');
      for (const el of live) {
        const st = el.__rb;
        if (!st) continue;
        if (!st.hit && !st.miss) return false;
      }
      return true;
    }

    // ===== hit logic =====
    _onHitAttempt(lane, source) {
      if (!this.running || this.ended) return;

      const laneEl = getLaneElByIndex(this.lanesEl, lane);
      if (!laneEl) return;

      // find closest live note in this lane by abs offset
      const notes = Array.from(laneEl.querySelectorAll('.rb-note'));
      let best = null;
      let bestAbs = Infinity;
      for (const el of notes) {
        const st = el.__rb;
        if (!st || st.hit || st.miss) continue;
        const off = this.songTime - st.tHit; // + late, - early
        const a = Math.abs(off);
        if (a < bestAbs) {
          bestAbs = a;
          best = { el, st, off };
        }
      }

      if (!best || bestAbs > HIT_TOL) {
        // blank hit => small penalty (anti-spam)
        this._applyBlank(lane, source);
        return;
      }

      // judgment by window
      const off = best.off;
      const abs = Math.abs(off);

      let judgment = 'miss';
      if (abs <= HIT_WINDOWS.perfect) judgment = 'perfect';
      else if (abs <= HIT_WINDOWS.great) judgment = 'great';
      else if (abs <= HIT_WINDOWS.good) judgment = 'good';
      else judgment = 'miss';

      // apply
      if (judgment === 'miss') {
        // treat as miss
        best.st.miss = true;
        best.el.dataset.state = 'miss';
        best.el.classList.add('is-miss');
        setTimeout(() => { try { best.el.remove(); } catch (_) { } }, 140);
        this._applyMiss(lane, source, off);
      } else {
        best.st.hit = true;
        best.el.dataset.state = 'hit';
        best.el.classList.add('is-hit');
        setTimeout(() => { try { best.el.remove(); } catch (_) { } }, 160);
        this._applyHit(lane, judgment, source, off);
      }
    }

    _applyBlank(lane, source) {
      // small score penalty, combo break
      this.combo = 0;

      const delta = SCORE_BLANK;
      this.score = Math.max(0, this.score + delta);

      this.hp = clamp(this.hp - HP_LOSS_BLANK, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._logEvent({
        lane, action: 'blank', judgment: 'blank', offset: '', scoreDelta: delta, source
      });

      if (this.renderer && this.renderer.showMissFx) {
        this.renderer.showMissFx({ lane });
      }
    }

    _applyMiss(lane, source, offset) {
      this.hitMiss += 1;
      this.combo = 0;

      // Shield blocks one miss if available
      if (this.shield > 0) {
        this.shield -= 1;
        // no hp loss
      } else {
        this.hp = clamp(this.hp - HP_LOSS_MISS, 0, 100);
        this.hpMin = Math.min(this.hpMin, this.hp);
      }

      // FEVER decay
      this.fever = clamp(this.fever - FEVER_DECAY_PER_MISS, 0, 1);

      const delta = SCORE_MISS;
      // score no gain
      this._logEvent({
        lane, action: 'hit', judgment: 'miss',
        offset: (Number.isFinite(offset) ? offset : ''),
        scoreDelta: delta, source
      });

      if (this.renderer && this.renderer.showMissFx) {
        this.renderer.showMissFx({ lane });
      }
    }

    _applyHit(lane, judgment, source, offset) {
      // counts
      if (judgment === 'perfect') this.hitPerfect += 1;
      else if (judgment === 'great') this.hitGreat += 1;
      else if (judgment === 'good') this.hitGood += 1;

      // offset stats
      if (Number.isFinite(offset)) {
        this.offsets.push(offset);
        this.offsetsAbs.push(Math.abs(offset));
        if (offset < 0) this.earlyHits += 1;
        else this.lateHits += 1;

        // left/right by lane index
        if (lane <= 1) this.leftHits += 1;
        if (lane >= 3) this.rightHits += 1;
      }

      // combo
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // score
      let base = SCORE_GOOD;
      if (judgment === 'perfect') base = SCORE_PERFECT;
      else if (judgment === 'great') base = SCORE_GREAT;

      // small combo bonus
      let bonus = 0;
      if (this.combo > 0 && this.combo % COMBO_BONUS_STEP === 0) bonus = COMBO_BONUS;

      // fever multiplier
      const mult = this.feverActive ? 1.35 : 1.0;

      const delta = Math.round((base + bonus) * mult);
      this.score = Math.max(0, this.score + delta);

      // FEVER build
      if (judgment === 'perfect') this.fever = clamp(this.fever + FEVER_BUILD_PERFECT, 0, 1);
      else if (judgment === 'great') this.fever = clamp(this.fever + FEVER_BUILD_GREAT, 0, 1);
      else if (judgment === 'good') this.fever = clamp(this.fever + FEVER_BUILD_GOOD, 0, 1);

      // Shield gain
      let sGain = 0;
      if (judgment === 'perfect') sGain = SHIELD_GAIN_PERFECT;
      else if (judgment === 'great') sGain = SHIELD_GAIN_GREAT;
      else sGain = SHIELD_GAIN_GOOD;

      // convert fractional gain to discrete with accumulator
      this._shieldAcc = (this._shieldAcc || 0) + sGain;
      while (this._shieldAcc >= 1 && this.shield < SHIELD_MAX) {
        this.shield += 1;
        this._shieldAcc -= 1;
      }
      this.shield = clamp(this.shield, 0, SHIELD_MAX);

      // FEVER activate
      if (!this.feverActive && this.fever >= 1) {
        this._enterFever();
      }

      // log + fx
      this._logEvent({
        lane, action: 'hit', judgment,
        offset: (Number.isFinite(offset) ? offset : ''),
        scoreDelta: delta, source
      });

      if (this.renderer && this.renderer.showHitFx) {
        this.renderer.showHitFx({ lane, judgment, scoreDelta: delta });
      }
    }

    _enterFever() {
      this.feverActive = true;
      this._feverLeft = FEVER_ACTIVE_SEC;
      this.feverEntryCount += 1;

      if (this.timeToFirstFeverSec == null) {
        this.timeToFirstFeverSec = this.songTime;
      }
    }

    _updateFever(dt) {
      if (this.feverActive) {
        this._feverLeft -= dt;
        this.feverTotalTimeSec += dt;
        if (this._feverLeft <= 0) {
          this.feverActive = false;
          this._feverLeft = 0;
          this.fever = 0; // reset
        }
      }
    }

    // ===== AI =====
    _updateAI() {
      if (!window.RB_AI || typeof window.RB_AI.predict !== 'function') return;

      const t = nowMs();
      if (t - this._lastAIMs < 160) return; // ~6Hz
      this._lastAIMs = t;

      // snapshot
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const accPct = totalJudged ? ((totalJudged - this.hitMiss) / Math.max(1, this.totalNotes)) * 100 : 0;

      const snap = {
        accPct,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        combo: this.combo,
        hp: this.hp,
        offsetAbsMean: this.offsetsAbs.length ? mean(this.offsetsAbs) : 0.09,
        songTime: this.songTime,
        durationSec: this.track.durationSec || 0
      };

      const ai = window.RB_AI.predict(snap);
      this.aiState = ai;

      // UI glue callback
      if (this.hooks && typeof this.hooks.onAI === 'function') {
        this.hooks.onAI(ai);
      }

      // IMPORTANT: research lock — never adjust gameplay
      // in normal mode: allow adjustments only if ?ai=1 (RB_AI.isAssistEnabled)
      const assistOn = window.RB_AI.isAssistEnabled && window.RB_AI.isAssistEnabled();
      if (!assistOn) return;

      // In this pack we do NOT auto-adjust spawn/difficulty (only provide suggestion)
      // Future: could modify tolerance/windows or add shield assist, but OFF by default
    }

    // ===== HUD =====
    _updateHUD(force) {
      if (!this.hud) return;

      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const accPct = totalJudged ? ((totalJudged - this.hitMiss) / Math.max(1, this.totalNotes)) * 100 : 0;

      if (this.hud.score) this.hud.score.textContent = String(this.score);
      if (this.hud.combo) this.hud.combo.textContent = String(this.combo);
      if (this.hud.acc) this.hud.acc.textContent = (accPct || 0).toFixed(1) + '%';
      if (this.hud.hp) this.hud.hp.textContent = String(Math.round(this.hp));
      if (this.hud.shield) this.hud.shield.textContent = String(Math.round(this.shield));
      if (this.hud.time) this.hud.time.textContent = (this.songTime || 0).toFixed(1);

      if (this.hud.countPerfect) this.hud.countPerfect.textContent = String(this.hitPerfect);
      if (this.hud.countGreat) this.hud.countGreat.textContent = String(this.hitGreat);
      if (this.hud.countGood) this.hud.countGood.textContent = String(this.hitGood);
      if (this.hud.countMiss) this.hud.countMiss.textContent = String(this.hitMiss);

      if (this.hud.feverFill) this.hud.feverFill.style.width = (this.feverActive ? 1 : this.fever) * 100 + '%';
      if (this.hud.feverStatus) {
        this.hud.feverStatus.textContent = this.feverActive ? 'ACTIVE' : (this.fever >= 1 ? 'READY' : 'BUILD');
      }

      const dur = this.track.durationSec || 0;
      const prog = dur > 0 ? clamp(this.songTime / dur, 0, 1) : 0;
      if (this.hud.progFill) this.hud.progFill.style.width = (prog * 100) + '%';
      if (this.hud.progText) this.hud.progText.textContent = Math.round(prog * 100) + '%';
    }

    // ===== logging =====
    _logEvent({ lane, action, judgment, offset, scoreDelta, source }) {
      const aiLocked = (window.RB_AI && window.RB_AI.isLocked && window.RB_AI.isLocked()) ? 1 : 0;
      const aiAssist = (window.RB_AI && window.RB_AI.isAssistEnabled && window.RB_AI.isAssistEnabled()) ? 1 : 0;

      this.eventsTable.add({
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track.id,
        t_song: this.songTime,
        t_real: new Date().toISOString(),
        lane,
        action,
        judgment,
        offset_s: offset,
        score_delta: scoreDelta,
        combo: this.combo,
        hp: this.hp,
        fever: this.feverActive ? 1 : this.fever,
        shield: this.shield,
        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score: this.aiState ? (this.aiState.skillScore ?? '') : '',
        ai_suggest: this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: aiLocked,
        ai_assist_on: aiAssist
      });
    }

    // ===== end =====
    _finish(endReason) {
      this.running = false;
      this.ended = true;

      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      if (this.audio) {
        this.audio.pause();
      }

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
        acc >= 95 ? 'SSS' :
          acc >= 90 ? 'SS' :
            acc >= 85 ? 'S' :
              acc >= 75 ? 'A' :
                acc >= 65 ? 'B' : 'C';

      // quality gate for research
      const trialValid = totalJudged >= 10 && acc >= 40 ? 1 : 0;

      // ---- session row ----
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

        // AI snapshot at end (prediction only; assist might be off)
        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score: this.aiState ? (this.aiState.skillScore ?? '') : '',
        ai_suggest: this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: (window.RB_AI && window.RB_AI.isLocked && window.RB_AI.isLocked()) ? 1 : 0,
        ai_assist_on: (window.RB_AI && window.RB_AI.isAssistEnabled && window.RB_AI.isAssistEnabled()) ? 1 : 0,

        trial_valid: trialValid,
        rank,
        created_at_iso: new Date().toISOString()
      };

      this.sessionTable.add(sessionRow);

      // ---- summary for UI ----
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
        aiFatigue: (this.aiState && this.aiState.fatigueRisk) ? this.aiState.fatigueRisk : 0,
        aiSkill: (this.aiState && this.aiState.skillScore) ? this.aiState.skillScore : 0,
        aiSuggest: (this.aiState && this.aiState.suggestedDifficulty) ? this.aiState.suggestedDifficulty : 'normal',
        aiTip: (this.aiState && this.aiState.tip) ? this.aiState.tip : '',
        qualityNote: trialValid ? '' : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') this.hooks.onEnd(summary);
    }

    _clearNotes() {
      if (!this.lanesEl) return;
      const notes = this.lanesEl.querySelectorAll('.rb-note');
      for (const el of notes) {
        try { el.remove(); } catch (_) { }
      }
    }
  }

  window.RhythmBoxerEngine = RhythmBoxerEngine;
})()