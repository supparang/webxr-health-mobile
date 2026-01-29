// === js/rhythm-engine.js — Rhythm Boxer Engine (Practice + Boss + AI-lite + Shield + CSV) ===
(function () {
  'use strict';

  // ===== CONFIG (BASE) =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

  // หน้าต่างการให้คะแนนตาม offset (วินาที) — BASE (AI จะปรับเฉพาะ Normal)
  const HIT_WINDOWS_BASE = {
    perfect: 0.06,
    great: 0.12,
    good: 0.20
  };

  // เวลาโน้ตใช้ตกลงมาถึงเส้นตี (วินาที) — BASE (AI จะปรับเฉพาะ Normal)
  const PRE_SPAWN_BASE_SEC = 2.0;

  // Practice
  const PRACTICE_SEC = 15.0;

  // Boss phase
  const BOSS_LAST_SEC = 8.0;          // 8s ท้ายเพลง
  const BOSS_SPAWN_AHEAD_SEC = 2.2;   // ให้เห็นล่วงหน้าเพิ่มนิด
  const BOSS_SCORE_MULT = 1.35;       // คูณคะแนนช่วงบอส
  const BOSS_EXTRA_NOTES = 0.65;      // โอกาสเพิ่มโน้ตเสริม

  // Shield
  const SHIELD_MAX = 3;
  const SHIELD_GAIN_EVERY_COMBO = 12; // ทุก ๆ 12 combo ได้โล่ +1 (Normal เท่านั้น)

  // AI-lite
  // assist = 0.85..1.25 → ขยาย/หด hit window และ preSpawn
  const AI_ASSIST_MIN = 0.85;
  const AI_ASSIST_MAX = 1.25;

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
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
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
    if (low.includes('oculus') || low.includes('xr')) return 'vr';
    if (low.includes('tablet')) return 'tablet';
    if (low.includes('mobi')) return 'mobile';
    return 'pc';
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
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const lines = [];
      lines.push(keys.join(','));
      for (const r of rows) lines.push(keys.map((k) => esc(r[k])).join(','));
      return lines.join('\n');
    }
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

      this.eventTable = new CsvTable();
      this.sessionTable = new CsvTable();

      this._rafId = null;
      this._chartIndex = 0;

      this._bindLanePointer();
      this._bindKeyboard();
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

    _bindKeyboard(){
      this._onKeyDown = (e)=>{
        if (!this.running) return;
        const k = (e.key || '').toLowerCase();
        const map = { a:0, s:1, d:2, j:3, k:4, '1':0, '2':1, '3':2, '4':3, '5':4 };
        if (map[k] == null) return;
        e.preventDefault();
        this.handleLaneTap(map[k]);
      };
      window.addEventListener('keydown', this._onKeyDown, { passive:false });
    }

    // ===== PUBLIC API =====
    start(mode, trackId, meta) {
      if (this._rafId != null) { cancelAnimationFrame(this._rafId); this._rafId = null; }

      this.mode = mode || 'normal';
      this.meta = meta || {};
      this.track = TRACKS.find((t) => t.id === trackId) || TRACKS[0];

      this.sessionId = makeSessionId();
      this.deviceType = detectDeviceType();

      // Normal: มี practice + AI-lite
      this.practiceEnabled = (this.mode === 'normal');
      this.isPractice = this.practiceEnabled ? true : false;
      this.practiceLeft = this.practiceEnabled ? PRACTICE_SEC : 0;

      // AI-lite (Normal เท่านั้น)
      this.aiEnabled = (this.mode === 'normal');
      this.aiAssist = 1.0;     // เริ่มกลาง ๆ
      this.aiMissStreak = 0;

      // current dynamic windows & preSpawn
      this.hitWindows = Object.assign({}, HIT_WINDOWS_BASE);
      this.preSpawnSec = PRE_SPAWN_BASE_SEC;

      // boss
      this.bossOn = false;

      // core state
      this.songTime = 0;
      this.startPerf = performance.now();
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
      this._nextShieldAtCombo = SHIELD_GAIN_EVERY_COMBO;

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

      this.lastUpdatePerf = performance.now();

      this.notes = [];
      this.nextNoteId = 1;
      this._chartIndex = 0;

      // clear CSV only for real run (not practice); but we’ll clear now then add rows only if real
      this.eventTable.clear();

      this._setupAudio();
      this._updateHUD(0);
      this._loop();
    }

    stop(reason) {
      if (this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    handleLaneTap(lane) {
      if (!this.running) return;

      const nowPerf = performance.now();
      const elapsed = (nowPerf - this.startPerf) / 1000;

      // songTime สำหรับ practice = นับถอยหลังแยก (เราใช้ elapsed เป็นตัวขับโน้ต)
      this.songTime = elapsed;

      // หาโน้ตที่ใกล้สุดในเลนนี้
      let best = null;
      let bestAbs = Infinity;
      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (n.lane !== lane) continue;
        const dt = elapsed - n.time;
        const adt = Math.abs(dt);
        if (adt < bestAbs) { bestAbs = adt; best = { note: n, dt }; }
      }

      if (!best) {
        this._applyEmptyTapMiss(elapsed, lane);
        return;
      }

      const { note, dt } = best;
      const judgment = this._judgeFromOffset(dt);

      if (judgment === 'miss') this._applyMiss(note, elapsed, dt, true);
      else this._applyHit(note, elapsed, dt, judgment);
    }

    getEventsCsv() { return this.eventTable.toCsv(); }
    getSessionCsv() { return this.sessionTable.toCsv(); }

    // ===== AUDIO =====
    _setupAudio() {
      if (!this.audio) return;
      try{
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = this.track.audio || '';
        // Practice: ไม่จำเป็นต้องเปิดเสียง (ยังช่วยมือถือด้วย)
        if (this.isPractice) return;

        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }catch(_){}
    }

    _startRealRunFromPractice(){
      // รีเซ็ตทุกอย่างสำหรับรอบจริง แต่คง sessionId เดิมได้ไหม? → ควรสร้างใหม่ให้ชัด
      const savedMeta = this.meta;
      const savedMode = this.mode;
      const savedTrackId = this.track.id;

      // stop practice notes
      this._clearAllNotes();

      // เริ่มใหม่แบบรอบจริง (practice off)
      this.mode = savedMode;
      this.meta = savedMeta;
      this.track = TRACKS.find((t)=>t.id===savedTrackId) || TRACKS[0];

      this.sessionId = makeSessionId(); // แยก session ชัดเจน
      this.isPractice = false;
      this.practiceLeft = 0;

      this.aiEnabled = (this.mode === 'normal');
      this.aiAssist = 1.0;
      this.aiMissStreak = 0;

      this.hitWindows = Object.assign({}, HIT_WINDOWS_BASE);
      this.preSpawnSec = PRE_SPAWN_BASE_SEC;

      this.bossOn = false;

      this.songTime = 0;
      this.startPerf = performance.now();
      this.lastUpdatePerf = performance.now();

      // reset stats
      this.score = 0; this.combo = 0; this.maxCombo = 0;
      this.hp = 100; this.hpMin = 100; this.hpUnder50Time = 0;
      this.shield = 0; this._nextShieldAtCombo = SHIELD_GAIN_EVERY_COMBO;

      this.totalNotes = 0;
      this.hitPerfect = 0; this.hitGreat = 0; this.hitGood = 0; this.hitMiss = 0;

      this.offsets = []; this.offsetsAbs = [];
      this.earlyHits = 0; this.lateHits = 0;
      this.leftHits = 0; this.rightHits = 0;

      this.feverGauge = 0; this.feverActive = false;
      this.feverEntryCount = 0; this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null; this.feverEndTime = 0;

      this.notes = [];
      this.nextNoteId = 1;
      this._chartIndex = 0;

      this.eventTable.clear(); // รอบจริงเริ่มเก็บใหม่

      // play audio for real run
      this._setupAudio();

      if (this.renderer && this.renderer.showFeedback){
        this.renderer.showFeedback('START!', 'good');
      }
    }

    // ===== LOOP =====
    _loop() {
      if (!this.running) return;

      const now = performance.now();
      const dt = (now - this.lastUpdatePerf) / 1000;
      this.lastUpdatePerf = now;

      const elapsed = (now - this.startPerf) / 1000;
      this.songTime = elapsed;

      const dur = this.track.durationSec || 30;

      // practice flow (Normal เท่านั้น)
      if (this.isPractice){
        this.practiceLeft = Math.max(0, PRACTICE_SEC - elapsed);
        this._updateTimeline(elapsed, dt, dur);
        this._updateHUDPractice(elapsed);

        if (this.practiceLeft <= 0.001){
          // auto switch to real
          this._startRealRunFromPractice();
        } else {
          this._rafId = requestAnimationFrame(() => this._loop());
        }
        return;
      }

      this._updateTimeline(elapsed, dt, dur);
      this._updateHUD(elapsed, dur);

      if (elapsed >= dur) {
        this._finish('song-end');
        return;
      }

      this._rafId = requestAnimationFrame(() => this._loop());
    }

    // ===== TIMELINE / NOTES =====
    _updateTimeline(songTime, dt, dur) {
      this._updateBossState(songTime, dur);
      this._spawnNotes(songTime, dur);
      this._updateNotePositions(songTime);
      this._autoJudgeMiss(songTime);

      if (this.feverActive) {
        this.feverTotalTimeSec += dt;
        if (songTime >= this.feverEndTime) {
          this.feverActive = false;
          this.feverGauge = 0;
        }
      }

      if (this.hp < 50) this.hpUnder50Time += dt;

      // toggle field fever class
      if (this.field){
        if (this.feverActive) this.field.classList.add('rb-fever-on');
        else this.field.classList.remove('rb-fever-on');
      }

      // AI-lite update (Normal only, real run only)
      if (this.aiEnabled) this._aiTick(songTime, dur);
    }

    _updateBossState(songTime, dur){
      const bossNow = (dur - songTime) <= BOSS_LAST_SEC;
      if (bossNow && !this.bossOn){
        this.bossOn = true;
        if (this.renderer && this.renderer.showFeedback) {
          this.renderer.showFeedback('⚠️ BOSS PHASE!', 'miss');
        }
      } else if (!bossNow && this.bossOn){
        this.bossOn = false;
      }
    }

    _spawnNotes(songTime, dur) {
      const chart = this.track.chart || [];
      const pre = this.bossOn ? Math.max(this.preSpawnSec, BOSS_SPAWN_AHEAD_SEC) : this.preSpawnSec;

      if (this._chartIndex == null) this._chartIndex = 0;

      while (
        this._chartIndex < chart.length &&
        chart[this._chartIndex].time <= songTime + pre
      ) {
        const info = chart[this._chartIndex];
        this._createNote(info, false);

        // Boss: เพิ่มโน้ตเสริม (Normal + Boss เท่านั้น)
        if (!this.isPractice && this.mode === 'normal' && this.bossOn) {
          if (Math.random() < BOSS_EXTRA_NOTES) {
            const alt = this._bossExtraNote(info);
            if (alt) this._createNote(alt, true);
          }
        }

        this._chartIndex++;
      }
    }

    _bossExtraNote(info){
      const lane = clamp((info.lane | 0), 0, 4);
      // สุ่มเลนข้าง ๆ
      const candidates = [];
      if (lane - 1 >= 0) candidates.push(lane - 1);
      if (lane + 1 <= 4) candidates.push(lane + 1);
      if (lane !== 2) candidates.push(2); // center เพิ่มความมันส์
      if (!candidates.length) return null;
      const pick = candidates[(Math.random()*candidates.length)|0];
      return { time: info.time + (Math.random()*0.08 - 0.04), lane: pick, type: 'note', isBossExtra: 1 };
    }

    _createNote(info, isExtra) {
      if (!this.lanesEl) return;

      const laneIndex = clamp(info.lane | 0, 0, 4);
      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
      if (!laneEl) return;

      const noteEl = document.createElement('div');
      // ✅ สำคัญ: ให้โน้ตขึ้น (CSS default opacity:0)
      noteEl.className = 'rb-note rb-note-spawned';

      const inner = document.createElement('div');
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
        el: noteEl,
        isExtra: isExtra ? 1 : 0
      };
      this.notes.push(n);
      this.totalNotes++;
    }

    _updateNotePositions(songTime) {
      if (!this.lanesEl) return;
      const rect = this.lanesEl.getBoundingClientRect();
      const h = rect.height || 1;
      const travel = h * 0.85;

      const pre = this.bossOn ? Math.max(this.preSpawnSec, BOSS_SPAWN_AHEAD_SEC) : this.preSpawnSec;

      for (const n of this.notes) {
        if (!n.el || n.state === 'hit' || n.state === 'miss') continue;

        const dt = n.time - songTime;
        const progress = 1 - dt / pre;
        const pClamp = clamp(progress, 0, 1.2);

        const y = (pClamp - 1) * travel;

        // ✅ สำคัญ: ห้ามทับ translateX(-50%) ของ CSS
        n.el.style.transform = `translate(-50%, ${y}px)`;
        n.el.style.opacity = pClamp <= 1.0 ? 1 : clamp(1.2 - pClamp, 0, 1);
      }
    }

    _autoJudgeMiss(songTime) {
      const missWindow = this.hitWindows.good + 0.05;

      for (const n of this.notes) {
        if (n.state !== 'pending') continue;
        if (songTime > n.time + missWindow) {
          this._applyMiss(n, songTime, null, false);
        }
      }

      this.notes = this.notes.filter((n) => n.state === 'pending');
    }

    _clearAllNotes(){
      for (const n of this.notes){
        if (n.el) { try{ n.el.remove(); }catch(_){ } }
      }
      this.notes = [];
    }

    // ===== JUDGE =====
    _judgeFromOffset(dt) {
      const adt = Math.abs(dt);
      if (adt <= this.hitWindows.perfect) return 'perfect';
      if (adt <= this.hitWindows.great) return 'great';
      if (adt <= this.hitWindows.good) return 'good';
      return 'miss';
    }

    // ===== HIT / MISS =====
    _applyHit(note, songTime, dt, judgment) {
      note.state = 'hit';
      if (note.el) { note.el.remove(); note.el = null; }

      const side = sideOfLane(note.lane);
      const abs = Math.abs(dt);

      // practice: ไม่สะสม offsets/log ให้หนักเกิน แต่ยังให้ feedback/hud ได้
      if (!this.isPractice){
        this.offsets.push(dt);
        this.offsetsAbs.push(abs);
      }

      if (dt < 0) this.earlyHits++; else this.lateHits++;
      if (side === 'L') this.leftHits++; else if (side === 'R') this.rightHits++;

      if (judgment === 'perfect') this.hitPerfect++;
      else if (judgment === 'great') this.hitGreat++;
      else if (judgment === 'good') this.hitGood++;

      // base score
      let baseScore = (judgment === 'perfect') ? 300 : (judgment === 'great') ? 200 : 100;

      // fever boost
      if (this.feverActive) baseScore = Math.round(baseScore * 1.5);

      // boss boost (เฉพาะรอบจริง)
      const isBoss = (!this.isPractice && this.bossOn);
      if (isBoss) baseScore = Math.round(baseScore * BOSS_SCORE_MULT);

      this.score += baseScore;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // shield gain (Normal real run)
      if (!this.isPractice && this.mode === 'normal' && this.combo >= this._nextShieldAtCombo){
        this.shield = clamp(this.shield + 1, 0, SHIELD_MAX);
        this._nextShieldAtCombo += SHIELD_GAIN_EVERY_COMBO;
        if (this.renderer && this.renderer.showFeedback){
          this.renderer.showFeedback(`🛡️ SHIELD +1 (x${this.shield})`, 'good');
        }
      }

      // hp small heal on perfect
      if (judgment === 'perfect') this.hp = clamp(this.hp + 1, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      // fever gauge
      const feverGain = (judgment === 'perfect') ? 7 : (judgment === 'great') ? 5 : 3;
      this._addFeverGauge(feverGain, songTime);

      // AI-lite: success reduces miss streak
      if (this.aiEnabled) this.aiMissStreak = 0;

      if (this.renderer && typeof this.renderer.showHitFx === 'function') {
        this.renderer.showHitFx({
          lane: note.lane,
          judgment,
          songTime,
          scoreDelta: baseScore,
          scoreTotal: this.score,
          isBoss: isBoss ? 1 : 0
        });
      }

      if (!this.isPractice){
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
          is_boss: isBoss ? 1 : 0,
          combo_after: this.combo,
          score_delta: baseScore,
          score_total: this.score,
          hp_after: this.hp,
          shield_after: this.shield,
          seg_index: segmentIndex(songTime, this.track.durationSec),
          note_is_extra: note.isExtra ? 1 : 0,
          ai_assist: this.aiEnabled ? this.aiAssist.toFixed(3) : ''
        });
      }
    }

    _applyMiss(note, songTime, dtOrNull, byTap) {
      note.state = 'miss';
      if (note.el) { note.el.remove(); note.el = null; }

      const isBoss = (!this.isPractice && this.bossOn);

      // shield block (Normal real run) — บล็อก miss ไม่เสีย HP และไม่เพิ่ม hitMiss
      if (!this.isPractice && this.mode === 'normal' && this.shield > 0){
        this.shield = clamp(this.shield - 1, 0, SHIELD_MAX);
        this.combo = 0;

        if (this.renderer && typeof this.renderer.showMissFx === 'function') {
          this.renderer.showMissFx({ lane: note.lane, songTime, isBoss: isBoss ? 1 : 0, blocked: 1 });
        }

        if (!this.isPractice){
          this._logEventRow({
            event_type: 'shield-block',
            song_time_s: songTime.toFixed(3),
            lane: note.lane,
            side: sideOfLane(note.lane),
            judgment: 'blocked',
            raw_offset_s: dtOrNull == null ? '' : dtOrNull.toFixed(3),
            abs_offset_s: dtOrNull == null ? '' : Math.abs(dtOrNull).toFixed(3),
            is_hit: 0,
            is_fever: this.feverActive ? 1 : 0,
            is_boss: isBoss ? 1 : 0,
            combo_after: this.combo,
            score_delta: 0,
            score_total: this.score,
            hp_after: this.hp,
            shield_after: this.shield,
            seg_index: segmentIndex(songTime, this.track.durationSec),
            miss_by_tap: byTap ? 1 : 0,
            ai_assist: this.aiEnabled ? this.aiAssist.toFixed(3) : ''
          });
        }
        // AI-lite: miss streak ยังนับนิด ๆ (เพราะ player พลาดจริง)
        if (this.aiEnabled) this.aiMissStreak = Math.min(6, this.aiMissStreak + 1);
        return;
      }

      // normal miss
      this.hitMiss++;
      this.combo = 0;

      // dmg
      const dmg = isBoss ? 6 : 5;
      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      // fever down
      this._addFeverGauge(-8, songTime);

      // shake
      if (this.field){
        this.field.classList.add('rb-shake');
        setTimeout(()=> this.field && this.field.classList.remove('rb-shake'), 380);
      }

      if (this.renderer && typeof this.renderer.showMissFx === 'function') {
        this.renderer.showMissFx({ lane: note.lane, songTime, isBoss: isBoss ? 1 : 0 });
      }

      const dt = dtOrNull;

      if (!this.isPractice){
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
          is_boss: isBoss ? 1 : 0,
          combo_after: this.combo,
          score_delta: 0,
          score_total: this.score,
          hp_after: this.hp,
          shield_after: this.shield,
          seg_index: segmentIndex(songTime, this.track.durationSec),
          miss_by_tap: byTap ? 1 : 0,
          ai_assist: this.aiEnabled ? this.aiAssist.toFixed(3) : ''
        });
      }

      // AI-lite: increase miss streak
      if (this.aiEnabled) this.aiMissStreak = Math.min(8, this.aiMissStreak + 1);
    }

    _applyEmptyTapMiss(songTime, lane) {
      // ปุ่มว่าง: ถ้าโล่มี ให้บล็อกแบบเบา ๆ (Normal real run)
      if (!this.isPractice && this.mode === 'normal' && this.shield > 0){
        this.shield = clamp(this.shield - 1, 0, SHIELD_MAX);
        this.combo = 0;
        if (this.renderer && this.renderer.showFeedback){
          this.renderer.showFeedback('🛡️ SHIELD (blank)', 'good');
        }
        this._logEventRow({
          event_type: 'blank-tap-blocked',
          song_time_s: songTime.toFixed(3),
          lane,
          side: sideOfLane(lane),
          judgment: 'blocked',
          is_hit: 0,
          is_fever: this.feverActive ? 1 : 0,
          is_boss: this.bossOn ? 1 : 0,
          combo_after: this.combo,
          score_delta: 0,
          score_total: this.score,
          hp_after: this.hp,
          shield_after: this.shield,
          seg_index: segmentIndex(songTime, this.track.durationSec),
          ai_assist: this.aiEnabled ? this.aiAssist.toFixed(3) : ''
        });
        if (this.aiEnabled) this.aiMissStreak = Math.min(6, this.aiMissStreak + 1);
        return;
      }

      this.combo = 0;
      const dmg = 2;
      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this._addFeverGauge(-5, songTime);

      if (!this.isPractice){
        this._logEventRow({
          event_type: 'blank-tap',
          song_time_s: songTime.toFixed(3),
          lane,
          side: sideOfLane(lane),
          judgment: 'miss',
          is_hit: 0,
          is_fever: this.feverActive ? 1 : 0,
          is_boss: this.bossOn ? 1 : 0,
          combo_after: this.combo,
          score_delta: 0,
          score_total: this.score,
          hp_after: this.hp,
          shield_after: this.shield,
          seg_index: segmentIndex(songTime, this.track.durationSec),
          ai_assist: this.aiEnabled ? this.aiAssist.toFixed(3) : ''
        });
      }

      if (this.aiEnabled) this.aiMissStreak = Math.min(8, this.aiMissStreak + 1);
    }

    // ===== FEVER =====
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

    // ===== AI-lite (Normal only) =====
    _aiTick(songTime, dur){
      // ทุก ~0.5s ปรับ assist แบบลื่น ๆ
      if (!this._aiNextPerf) this._aiNextPerf = performance.now() + 500;
      if (performance.now() < this._aiNextPerf) return;
      this._aiNextPerf = performance.now() + 500;

      // วัดความยากจาก: miss streak + hp + acc คร่าว ๆ
      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const acc = judged ? ((judged - this.hitMiss) / Math.max(1, this.totalNotes)) : 1;

      let target = 1.0;

      // ถ้าพลาดติด ๆ / HP ต่ำ → ใจดีขึ้น
      if (this.aiMissStreak >= 3) target += 0.12;
      if (this.hp <= 60) target += 0.08;
      if (acc < 0.70) target += 0.10;

      // ถ้าเก่งมาก → เข้มขึ้นนิด
      if (acc > 0.92 && this.aiMissStreak === 0 && this.combo >= 10) target -= 0.08;

      // Boss: ไม่ผ่อนมากเกินไป แต่ยังช่วยได้เล็กน้อย
      if (this.bossOn) target = clamp(target, 0.92, 1.18);

      target = clamp(target, AI_ASSIST_MIN, AI_ASSIST_MAX);

      // smooth
      this.aiAssist = this.aiAssist + (target - this.aiAssist) * 0.25;

      // apply to windows & preSpawn
      this.hitWindows.perfect = HIT_WINDOWS_BASE.perfect * this.aiAssist;
      this.hitWindows.great   = HIT_WINDOWS_BASE.great   * this.aiAssist;
      this.hitWindows.good    = HIT_WINDOWS_BASE.good    * this.aiAssist;

      // preSpawn: assist มาก → เห็นไวขึ้น
      this.preSpawnSec = clamp(PRE_SPAWN_BASE_SEC * this.aiAssist, 1.65, 2.45);
    }

    // ===== HUD =====
    _updateHUDPractice(songTime){
      const h = this.hud;
      if (h.score) h.score.textContent = this.score;
      if (h.combo) h.combo.textContent = this.combo;
      if (h.hp) h.hp.textContent = this.hp;
      if (h.shield) h.shield.textContent = this.shield;
      if (h.time) h.time.textContent = songTime.toFixed(1);

      if (h.acc) h.acc.textContent = '—';
      if (h.countPerfect) h.countPerfect.textContent = this.hitPerfect;
      if (h.countGreat) h.countGreat.textContent = this.hitGreat;
      if (h.countGood) h.countGood.textContent = this.hitGood;
      if (h.countMiss) h.countMiss.textContent = this.hitMiss;

      if (h.feverFill) h.feverFill.style.transform = `scaleX(${(this.feverGauge/100)})`;
      if (h.feverStatus){
        h.feverStatus.textContent = 'PRACTICE';
        h.feverStatus.classList.add('on');
      }

      if (h.progFill || h.progText){
        const prog = clamp((PRACTICE_SEC - this.practiceLeft)/PRACTICE_SEC, 0, 1);
        if (h.progFill) h.progFill.style.transform = `scaleX(${prog})`;
        if (h.progText) h.progText.textContent = `Practice ${Math.ceil(this.practiceLeft)}s`;
      }

      if (this.renderer && this.renderer.showFeedback){
        // โชว์แค่บางครั้ง ไม่สแปม
        if (!this._practiceHintTick || performance.now() > this._practiceHintTick){
          this._practiceHintTick = performance.now() + 1200;
          this.renderer.showFeedback(`Practice: ${Math.ceil(this.practiceLeft)}s (A S D J K / tap)`, 'good');
        }
      }
    }

    _updateHUD(songTime, dur) {
      const h = this.hud;
      if (h.score) h.score.textContent = this.score;
      if (h.combo) h.combo.textContent = this.combo;
      if (h.hp) h.hp.textContent = this.hp;
      if (h.shield) h.shield.textContent = this.shield;
      if (h.time) h.time.textContent = songTime.toFixed(1);

      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const totalNotes = this.totalNotes || 1;
      const acc = judged ? ((judged - this.hitMiss) / totalNotes) * 100 : 0;
      if (h.acc) h.acc.textContent = acc.toFixed(1) + '%';

      if (h.countPerfect) h.countPerfect.textContent = this.hitPerfect;
      if (h.countGreat) h.countGreat.textContent = this.hitGreat;
      if (h.countGood) h.countGood.textContent = this.hitGood;
      if (h.countMiss) h.countMiss.textContent = this.hitMiss;

      if (h.feverFill) h.feverFill.style.transform = `scaleX(${(this.feverGauge/100)})`;
      if (h.feverStatus) {
        if (this.bossOn){
          h.feverStatus.textContent = this.feverActive ? 'BOSS + FEVER' : 'BOSS';
          h.feverStatus.classList.add('on');
        } else if (this.feverActive) {
          h.feverStatus.textContent = 'FEVER!!';
          h.feverStatus.classList.add('on');
        } else {
          h.feverStatus.textContent = 'READY';
          h.feverStatus.classList.remove('on');
        }
      }

      if (h.progFill || h.progText) {
        const prog = clamp(songTime / (dur || 1), 0, 1);
        if (h.progFill) h.progFill.style.transform = `scaleX(${prog})`;
        if (h.progText){
          const left = Math.max(0, (dur - songTime));
          h.progText.textContent = this.bossOn ? `BOSS ${left.toFixed(0)}s` : (Math.round(prog * 100) + '%');
        }
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

      if (this._rafId != null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
      if (this.audio) { try{ this.audio.pause(); }catch(_){ } }

      // ถ้ายังเป็น practice แล้วกด stop ให้สรุปแบบ practice-stop (ไม่สร้าง session row)
      if (this.isPractice){
        const summaryP = {
          modeLabel: 'Practice',
          trackName: this.track.name,
          endReason,
          finalScore: this.score,
          maxCombo: this.maxCombo,
          hitPerfect: this.hitPerfect,
          hitGreat: this.hitGreat,
          hitGood: this.hitGood,
          hitMiss: this.hitMiss,
          accuracyPct: 0,
          offsetMean: 0,
          offsetStd: 0,
          durationSec: Math.min(this.songTime, PRACTICE_SEC),
          participant: this.meta.id || this.meta.participant_id || '',
          rank: '-',
          qualityNote: 'หยุดระหว่าง Practice (ยังไม่ใช่รอบจริง)'
        };
        if (this.hooks && typeof this.hooks.onEnd === 'function') this.hooks.onEnd(summaryP);
        return;
      }

      const dur = Math.min(this.songTime, this.track.durationSec || this.songTime);

      const totalNotes = this.totalNotes || 1;
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;
      const acc = totalJudged ? ((totalJudged - this.hitMiss) / totalNotes) * 100 : 0;

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
        acc >= 90 ? 'SS'  :
        acc >= 85 ? 'S'   :
        acc >= 75 ? 'A'   :
        acc >= 65 ? 'B'   : 'C';

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
        time_to_first_fever_s: (this.timeToFirstFeverSec != null) ? this.timeToFirstFeverSec : '',
        hp_start: 100,
        hp_end: this.hp,
        hp_min: this.hpMin,
        hp_under50_time_s: this.hpUnder50Time,
        shield_end: this.shield,
        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,
        ai_enabled: this.aiEnabled ? 1 : 0,
        ai_assist_last: this.aiEnabled ? this.aiAssist : '',
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
        qualityNote: trialValid ? '' : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        this.hooks.onEnd(summary);
      }
    }
  }

  window.RhythmBoxerEngine = RhythmBoxerEngine;
})();
