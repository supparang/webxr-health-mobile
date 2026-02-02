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

      // AI prediction bridge (classic script)
      // Expects global: window.RB_AI (from ai-predictor.js)
      this.ai = (window.RB_AI) ? window.RB_AI : null;
      this.aiAssistEnabled = false; // computed per-run from meta + mode
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
      this.aiAssistEnabled = allowAdapt;

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
  : (isCVR ? 3.8 : (isMobile ? 3.3 : PRE_SPAWN_SEC));
// Tail length (pure UI) — improves timing visibility
this._noteTailPx = (isCVR ? 140 : (isMobile ? 110 : 90));
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
      this.aiMissStreak = 0;
      this.aiLastUpdateAt = 0;

      this._setupAudio();
      this._updateHUD(0);
      this._loop();
    }

    stop(reason) {
      if (this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    handleLaneTap(laneOrSide){
      if (!this.running) return;
      this.aiTapCount = (this.aiTapCount||0) + 1;

      const nowPerf = performance.now();
      const songTime = (nowPerf - this.startPerf) / 1000;
      this.songTime = songTime;
// ---- CVR: tap by "side" mapping (L/C/R) ----
      // laneOrSide: number (0..4) in normal; in cvr we still receive lanes 0..4 from DOM, but visuals now 3 lanes.
      let lane = (laneOrSide|0);

      // If CVR 3-lane UI is used, some builds pass lane=0/1/2 for L/C/R.
      // Support both:
      const view = (()=>{
        try{ return (new URL(location.href).searchParams.get('view')||'').toLowerCase(); }catch(_){ return ''; }
      })();
      const isCVR = (view === 'cvr' || view === 'cardboard');

      if (isCVR) {
        // if lane comes as 0/1/2 => treat as L/C/R directly
        if (lane === 0) lane = 1;         // L
        else if (lane === 1) lane = 2;    // C
        else if (lane === 2) lane = 3;    // R
        else lane = mapLaneForCvr(lane);  // 0..4 -> 1..3
      }

      const dtMax = HIT_WINDOWS.good + (this._assistWiden||0);

      // Find closest hittable note in that lane within window
      let best = null;
      let bestAbs = 1e9;

      for (const n of this.notes) {
        if (n.hit || n.missed) continue;
        if (n.lane !== lane) continue;
        const dt = (songTime - n.hitTime);
        const adt = Math.abs(dt);
        if (adt <= dtMax && adt < bestAbs) {
          best = n;
          bestAbs = adt;
        }
      }

      if (!best) {
        // blank tap penalty: tiny score down + record
        this.aiBlankTaps = (this.aiBlankTaps||0) + 1;
        this._applyBlankTapPenalty(songTime, lane);
        this._maybeUpdateAI(songTime);
        return;
      }

      // Hit that note
      const dt = (songTime - best.hitTime);
      const judge = judgeFromOffset(dt, this._assistWiden||0);

      if (judge === 'miss') {
        // treat as miss hit (late/early too far) but we still mark it consumed to avoid double hit spam
        best.hit = true;
        this._applyMiss(songTime, lane, dt, 'late_or_early');
      } else {
        best.hit = true;
        this._applyHit(songTime, lane, dt, judge);
      }

      this._maybeUpdateAI(songTime);
    }

    _applyBlankTapPenalty(songTime, lane) {
      // anti-spam: small score down and optional tiny HP tick
      const penalty = 10;
      this.score = Math.max(0, this.score - penalty);

      // slight combo break
      if (this.combo > 0) this.combo = 0;

      this._logEvent({
        t: songTime.toFixed(3),
        type: 'blank_tap',
        lane,
        side: sideOfLane(lane),
        penalty
      });

      if (this.renderer && this.renderer.showMissFx) {
        this.renderer.showMissFx({ lane });
      }
      this._updateHUD(songTime);
    }

    _applyHit(songTime, lane, dt, judge) {
      // scoring
      let add = 0;
      if (judge === 'perfect') add = 200;
      else if (judge === 'great') add = 130;
      else add = 90;

      // combo bonus
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      add += Math.min(200, this.combo * 2);

      // fever
      const feverAdd = (judge === 'perfect') ? 12 : (judge === 'great') ? 9 : 6;
      this._addFever(feverAdd, songTime);

      // apply score
      this.score += add;

      // stats
      this.totalNotes += 1;
      if (judge === 'perfect') this.hitPerfect += 1;
      else if (judge === 'great') this.hitGreat += 1;
      else this.hitGood += 1;

      // timing stats
      this.offsets.push(dt);
      this.offsetsAbs.push(Math.abs(dt));
      if (dt < 0) this.earlyHits += 1;
      else this.lateHits += 1;

      const side = sideOfLane(lane);
      if (side === 'L') this.leftHits += 1;
      else if (side === 'R') this.rightHits += 1;

      this.aiMissStreak = 0;

      this._logEvent({
        t: songTime.toFixed(3),
        type: 'hit',
        lane,
        side,
        noteTime: bestTimeHint(this.track, songTime, lane),
        dt: dt.toFixed(4),
        judge,
        combo: this.combo,
        scoreDelta: add,
        score: this.score,
        hp: this.hp,
        shield: this.shield,
        fever: this.feverGauge.toFixed(1),
        seg: segmentIndex(songTime, this.track.durationSec),
        mode: this.mode,
        track: this.track.id
      });

      if (this.renderer && this.renderer.showHitFx) {
        this.renderer.showHitFx({ lane, judgment: judge, scoreDelta: add });
      }

      // sfx
      this._playSfxByJudge(judge);

      this._updateHUD(songTime);
    }

    _applyMiss(songTime, lane, dt, reason) {
      // miss breaks combo
      this.combo = 0;

      // damage
      let dmg = 8;
      if (this.track.diff === 'hard') dmg = 12;
      if (this.track.diff === 'easy') dmg = 7;

      // fever active reduces damage slightly
      if (this.feverActive) dmg = Math.max(3, dmg - 3);

      // AI assist can reduce damage in normal when enabled
      dmg = dmg * (this._assistDmgMul || 1.0);

      if (this.shield > 0) {
        this.shield -= 1;
        dmg = 0;
      }

      if (dmg > 0) {
        this.hp = Math.max(0, this.hp - dmg);
        this.hpMin = Math.min(this.hpMin, this.hp);
      }

      this.totalNotes += 1;
      this.hitMiss += 1;

      this.aiMissStreak = (this.aiMissStreak || 0) + 1;

      const side = sideOfLane(lane);
      this._logEvent({
        t: songTime.toFixed(3),
        type: 'miss',
        lane,
        side,
        dt: (Number.isFinite(dt) ? dt.toFixed(4) : ''),
        reason: reason || '',
        dmg: dmg ? dmg.toFixed(1) : 0,
        hp: this.hp,
        shield: this.shield,
        fever: this.feverGauge.toFixed(1),
        seg: segmentIndex(songTime, this.track.durationSec),
        mode: this.mode,
        track: this.track.id
      });

      if (this.renderer && this.renderer.showMissFx) {
        this.renderer.showMissFx({ lane });
      }

      this._playSfx('miss');

      // check game over
      if (this.hp <= 0) {
        this._finish('hp-zero');
        return;
      }

      this._updateHUD(songTime);
    }

    _addFever(amount, songTime) {
      this.feverGauge = clamp(this.feverGauge + amount, 0, 100);

      if (!this.feverActive && this.feverGauge >= 100) {
        this.feverActive = true;
        this.feverGauge = 100;
        this.feverEntryCount += 1;
        if (this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = songTime;
        this.feverEndTime = songTime + 6.0;

        this._logEvent({
          t: songTime.toFixed(3),
          type: 'fever_on',
          seg: segmentIndex(songTime, this.track.durationSec),
          hp: this.hp,
          score: this.score,
          combo: this.combo
        });

        this._playSfx('fever');
      }
    }

    _updateFever(songTime, dt) {
      if (this.feverActive) {
        this.feverTotalTimeSec += dt;
        if (songTime >= this.feverEndTime) {
          this.feverActive = false;
          this.feverGauge = 0;

          this._logEvent({
            t: songTime.toFixed(3),
            type: 'fever_off',
            seg: segmentIndex(songTime, this.track.durationSec),
            hp: this.hp,
            score: this.score,
            combo: this.combo
          });
        }
      } else {
        // decay (slow)
        this.feverGauge = clamp(this.feverGauge - dt * 2.2, 0, 100);
      }
    }

    _maybeUpdateAI(songTime){
      if (!this.ai) return;

      // update ~every 0.35s to reduce flicker
      if ((songTime - (this.aiLastUpdateAt||0)) < 0.35) return;
      this.aiLastUpdateAt = songTime;

      // build snapshot
      const judged = (this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss);
      const accPct = judged > 0 ? ( (this.hitPerfect*1.0 + this.hitGreat*0.75 + this.hitGood*0.5) / judged ) * 100 : 0;
      const offAbsMean = this.offsetsAbs.length ? mean(this.offsetsAbs) : null;

      const snap = {
        accPct,
        hp: this.hp,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        combo: this.combo,
        offsetAbsMean: offAbsMean,
        songTime,
        durationSec: this.track.durationSec
      };

      const ai = this.ai.predict ? this.ai.predict(snap) : null;
      if (!ai) return;

      // update HUD AI labels (if UI hook exists)
      try{
        if (this.hud && this.hud.aiFatigue) this.hud.aiFatigue.textContent = Math.round((ai.fatigueRisk||0)*100) + '%';
        if (this.hud && this.hud.aiSkill)   this.hud.aiSkill.textContent   = Math.round((ai.skillScore||0)*100) + '%';
        if (this.hud && this.hud.aiSuggest) this.hud.aiSuggest.textContent = ai.suggestedDifficulty || 'normal';
        if (this.hud && this.hud.aiTip){
          this.hud.aiTip.textContent = ai.tip || '';
          this.hud.aiTip.classList.toggle('hidden', !ai.tip);
        }
      }catch(_){}

      // Research lock: DO NOT modify gameplay in research mode
      if (!this.aiAssistEnabled) return;

      // Normal AI Assist: small, gentle adjustments (no sudden jumps)
      // - widen hit window a bit if fatigue high / miss streak
      // - reduce dmg if fatigue very high
      // - never change chart content
      const fatigue = Number(ai.fatigueRisk)||0;
      const skill = Number(ai.skillScore)||0;
      const missStreak = this.aiMissStreak || 0;

      let widen = 0;
      if (fatigue > 0.70 || missStreak >= 5) widen = 0.045;
      else if (fatigue > 0.55 || missStreak >= 3) widen = 0.028;
      else widen = 0.012;

      // if skill high, do not widen too much
      if (skill > 0.80) widen = Math.min(widen, 0.015);

      // smooth
      this._assistWiden = this._assistWiden * 0.72 + widen * 0.28;

      let dmgMul = 1.0;
      if (fatigue > 0.80) dmgMul = 0.75;
      else if (fatigue > 0.65) dmgMul = 0.88;
      if (skill > 0.85) dmgMul = Math.min(1.0, dmgMul + 0.08);

      this._assistDmgMul = this._assistDmgMul * 0.75 + dmgMul * 0.25;

      // log ai update (sparse)
      this._logEvent({
        t: songTime.toFixed(3),
        type: 'ai_update',
        fatigue: (fatigue*100).toFixed(1),
        skill: (skill*100).toFixed(1),
        suggest: ai.suggestedDifficulty || '',
        widen: this._assistWiden.toFixed(4),
        dmgMul: this._assistDmgMul.toFixed(3),
        seg: segmentIndex(songTime, this.track.durationSec)
      });
    }

    _setupAudio() {
      if (!this.audio) return;
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (_) {}

      this.audio.src = this.track.audio;
      this.audio.loop = false;
      this.audio.preload = 'auto';

      // start on first interaction or immediately if allowed
      const p = this.audio.play();
      if (p && p.catch) p.catch(() => { /* autoplay blocked: ok */ });
    }

    _playSfxByJudge(judge){
      if (judge === 'perfect') this._playSfx('perfect');
      else if (judge === 'great') this._playSfx('hit');
      else this._playSfx('hit');
    }

    _playSfx(key){
      // optional: sfx directory - if you have window.RB_SFX or audio pool you can connect here
      // This build keeps it noop by default.
      // If you want: load tiny audio objects from ./sfx/.. and play here.
      // (We keep safe for GitHub Pages.)
      try{
        if (window.RB_SFX && window.RB_SFX.play) window.RB_SFX.play(key);
      }catch(_){}
    }

    _loop() {
      if (!this.running || this.ended) return;

      const now = performance.now();
      const dt = (now - this.lastUpdatePerf) / 1000;
      this.lastUpdatePerf = now;

      // song time from performance clock for stable timeline
      const songTime = (now - this.startPerf) / 1000;
      this.songTime = songTime;

      // fever update
      this._updateFever(songTime, dt);

      // spawn notes
      this._spawnNotes(songTime);

      // move notes & detect timeouts
      this._updateNotes(songTime);

      // hp under 50 time
      if (this.hp < 50) this.hpUnder50Time += dt;

      // end by duration
      if (songTime >= this.track.durationSec) {
        this._finish('timeup');
        return;
      }

      this._updateHUD(songTime);

      this._rafId = requestAnimationFrame(() => this._loop());
    }

    _spawnNotes(songTime) {
      const chart = this.track.chart || [];
      const pre = (this._preSpawnSec != null) ? this._preSpawnSec : PRE_SPAWN_SEC;

      while (this._chartIndex < chart.length) {
        const ev = chart[this._chartIndex];
        if (ev.time - pre > songTime) break;

        let lane = ev.lane | 0;

        // CVR compress chart 5->3 for UX
        const view = (()=>{
          try{ return (new URL(location.href).searchParams.get('view')||'').toLowerCase(); }catch(_){ return ''; }
        })();
        const isCVR = (view === 'cvr' || view === 'cardboard');
        if (isCVR) lane = mapLaneForCvr(lane);

        const note = {
          id: this.nextNoteId++,
          lane,
          spawnTime: songTime,
          hitTime: ev.time,
          hit: false,
          missed: false,
          el: null
        };

        this._mountNote(note);
        this.notes.push(note);
        this._chartIndex++;
      }
    }

    _mountNote(note) {
      if (!this.lanesEl) return;
      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${note.lane}"]`);
      if (!laneEl) return;

      const el = document.createElement('div');
      el.className = 'rb-note';
      el.dataset.noteId = String(note.id);
      el.textContent = NOTE_EMOJI_BY_LANE[(note.lane|0) % NOTE_EMOJI_BY_LANE.length] || '●';

      // add tail length for readability
      try{
        el.style.setProperty('--tail', (this._noteTailPx||90) + 'px');
      }catch(_){}

      laneEl.appendChild(el);
      note.el = el;
    }

    _updateNotes(songTime) {
      const pre = (this._preSpawnSec != null) ? this._preSpawnSec : PRE_SPAWN_SEC;

      for (const n of this.notes) {
        if (n.hit || n.missed) continue;

        const laneEl = this.lanesEl && this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if (!laneEl) continue;

        // progress from spawn to hit time
        const t0 = n.hitTime - pre;
        const t1 = n.hitTime;
        const p = clamp((songTime - t0) / (t1 - t0), 0, 1);

        // translate Y by progress: 0 (top) -> 1 (hit line near bottom)
        if (n.el) {
          n.el.style.setProperty('--p', p.toFixed(4));
        }

        // miss if passed window
        const late = songTime - n.hitTime;
        const missWin = HIT_WINDOWS.good + (this._assistWiden||0) + 0.05;
        if (late > missWin) {
          n.missed = true;
          if (n.el) n.el.classList.add('is-missed');
          this._applyMiss(songTime, n.lane, late, 'timeout');
          if (n.el) {
            setTimeout(() => { try{ n.el.remove(); }catch(_){ } }, 120);
          }
        }
      }

      // cleanup old notes
      if (this.notes.length > 120) {
        this.notes = this.notes.filter((n) => !(n.hit || n.missed) || (songTime - n.hitTime) < 2.0);
      }
    }

    _updateHUD(songTime) {
      const hud = this.hud || {};
      const judged = (this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss);
      const accPct = judged > 0 ? ((this.hitPerfect*1.0 + this.hitGreat*0.75 + this.hitGood*0.5) / judged) * 100 : 0;

      if (hud.score) hud.score.textContent = String(Math.round(this.score));
      if (hud.combo) hud.combo.textContent = String(this.combo);
      if (hud.acc) hud.acc.textContent = accPct.toFixed(1) + '%';
      if (hud.hp) hud.hp.textContent = String(Math.round(this.hp));
      if (hud.shield) hud.shield.textContent = String(this.shield);
      if (hud.time) hud.time.textContent = songTime.toFixed(1);

      if (hud.countPerfect) hud.countPerfect.textContent = String(this.hitPerfect);
      if (hud.countGreat) hud.countGreat.textContent = String(this.hitGreat);
      if (hud.countGood) hud.countGood.textContent = String(this.hitGood);
      if (hud.countMiss) hud.countMiss.textContent = String(this.hitMiss);

      if (hud.feverFill) hud.feverFill.style.width = clamp(this.feverGauge, 0, 100).toFixed(1) + '%';
      if (hud.feverStatus) hud.feverStatus.textContent = this.feverActive ? 'ACTIVE' : 'READY';

      const prog = clamp(songTime / (this.track.durationSec || 1) * 100, 0, 100);
      if (hud.progFill) hud.progFill.style.width = prog.toFixed(1) + '%';
      if (hud.progText) hud.progText.textContent = Math.round(prog) + '%';
    }

    _finish(reason) {
      if (this.ended) return;
      this.running = false;
      this.ended = true;

      try { if (this.audio) this.audio.pause(); } catch (_) {}
      try { if (this._rafId != null) cancelAnimationFrame(this._rafId); } catch (_) {}
      this._rafId = null;

      const endPerf = performance.now();
      const durationSec = (endPerf - this.startPerf) / 1000;

      const judged = (this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss);
      const accPct = judged > 0 ? ((this.hitPerfect*1.0 + this.hitGreat*0.75 + this.hitGood*0.5) / judged) * 100 : 0;

      const offsetMean = this.offsets.length ? mean(this.offsets) : null;
      const offsetStd = this.offsets.length ? std(this.offsets) : null;
      const offsetAbsMean = this.offsetsAbs.length ? mean(this.offsetsAbs) : null;

      // simple rank
      let rank = 'C';
      if (accPct >= 90 && this.maxCombo >= 12) rank = 'S';
      else if (accPct >= 80) rank = 'A';
      else if (accPct >= 65) rank = 'B';

      const qualityNote = this._qualityNote(durationSec, judged, offsetAbsMean, accPct);

      const summary = {
        sessionId: this.sessionId,
        mode: this.mode,
        modeLabel: (this.mode === 'research') ? 'Research' : 'Normal',
        trackId: this.track.id,
        trackName: this.track.nameShort || this.track.name,
        endReason: reason || 'end',
        finalScore: Math.round(this.score),
        maxCombo: this.maxCombo,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        accuracyPct: accPct,
        durationSec: durationSec,
        rank,
        offsetMean,
        offsetStd,
        offsetAbsMean,
        participant: (this.meta && this.meta.id) ? this.meta.id : '',
        qualityNote
      };

      // session CSV row
      this.sessionTable.add({
        sessionId: this.sessionId,
        ts: new Date().toISOString(),
        participant: (this.meta && this.meta.id) ? this.meta.id : '',
        group: (this.meta && this.meta.group) ? this.meta.group : '',
        note: (this.meta && this.meta.note) ? this.meta.note : '',
        mode: this.mode,
        trackId: this.track.id,
        bpm: this.track.bpm,
        diff: this.track.diff,
        device: this.deviceType,
        view: detectView(),
        durationSec: durationSec.toFixed(3),
        endReason: reason || '',
        score: Math.round(this.score),
        accPct: accPct.toFixed(2),
        maxCombo: this.maxCombo,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        hpMin: Math.round(this.hpMin),
        hpUnder50Sec: this.hpUnder50Time.toFixed(3),
        feverEntries: this.feverEntryCount,
        feverTotalSec: this.feverTotalTimeSec.toFixed(3),
        tFirstFeverSec: (this.timeToFirstFeverSec == null ? '' : this.timeToFirstFeverSec.toFixed(3)),
        offsetMean: (offsetMean == null ? '' : offsetMean.toFixed(6)),
        offsetStd: (offsetStd == null ? '' : offsetStd.toFixed(6)),
        offsetAbsMean: (offsetAbsMean == null ? '' : offsetAbsMean.toFixed(6)),
        earlyHits: this.earlyHits,
        lateHits: this.lateHits,
        leftHits: this.leftHits,
        rightHits: this.rightHits,
        aiAssist: this.aiAssistEnabled ? 1 : 0,
        aiBlankTaps: this.aiBlankTaps || 0,
        aiTapCount: this.aiTapCount || 0,
        qualityNote: qualityNote || ''
      });

      if (this.hooks && this.hooks.onEnd) {
        try { this.hooks.onEnd(summary); } catch (_) {}
      }
    }

    _qualityNote(durationSec, judged, offsetAbsMean, accPct){
      // Simple data quality warning for research usage
      if (this.mode !== 'research') return '';
      if (durationSec < (this.track.durationSec * 0.85)) return 'หยุดก่อนจบเพลง—ข้อมูลอาจไม่ครบ';
      if (judged < 15) return 'จำนวนการกดน้อยมาก—ข้อมูล timing อาจไม่น่าเชื่อถือ';
      if (offsetAbsMean != null && offsetAbsMean > 0.22) return 'ค่า timing offset สูงมาก—อาจกดไม่ทัน/ไม่เข้าใจเส้นตี';
      if (accPct < 35) return 'ความแม่นยำต่ำมาก—แนะนำให้ฝึก Normal ก่อนเก็บวิจัย';
      return '';
    }

    _logEvent(row){
      // attach session id
      row.sessionId = this.sessionId;
      row.participant = (this.meta && this.meta.id) ? this.meta.id : '';
      row.group = (this.meta && this.meta.group) ? this.meta.group : '';
      row.note = (this.meta && this.meta.note) ? this.meta.note : '';
      row.device = this.deviceType;
      row.view = detectView();
      this.eventTable.add(row);
    }

    getEventsCsv(){ return this.eventTable.toCsv(); }
    getSessionCsv(){ return this.sessionTable.toCsv(); }
  }

  function bestTimeHint(track, songTime, lane){
    // (optional) could return nearest chart note time for debugging; keep blank to reduce noise
    return '';
  }

  window.RhythmBoxerEngine = RhythmBoxerEngine;

})();