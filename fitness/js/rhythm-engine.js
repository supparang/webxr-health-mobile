// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION (cVR/PC/Mobile) + Boss + AI Prediction/Director + ML Feature Hooks + CSV
// ✅ Notes fall to hit line
// ✅ 5-lane default (works with 3-lane)
// ✅ Calibration offset (Cal: ms)
// ✅ Research lock: prediction shown but NO adaptive changes (deterministic fairness)
// ✅ Normal assist/director: enable with ?ai=1 (prediction + controlled adaptive pressure)
// ✅ Boss phases (3 phases + HP + pressure windows) in both Normal/Research
// ✅ Events CSV + Sessions CSV + FeatureRows CSV (for ML/DL offline training)
// ✅ r1 authored beatmap (research repeatability)
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b, v));
  const clamp01 = (v)=>clamp(v,0,1);
  const qsp = new URL(location.href).searchParams;

  function nowS(){ return performance.now()/1000; }

  function mean(arr){
    if(!arr || !arr.length) return 0;
    let s=0; for(const x of arr) s+=x;
    return s/arr.length;
  }
  function std(arr){
    if(!arr || arr.length<2) return 0;
    const m=mean(arr);
    let s=0; for(const x of arr) s+=(x-m)*(x-m);
    return Math.sqrt(s/(arr.length-1));
  }
  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const n = a.length;
    if(n%2) return a[(n-1)>>1];
    return (a[n/2-1] + a[n/2]) / 2;
  }

  // ---- CSV helpers ----
  function toCsvRow(obj, cols){
    return cols.map(k=>{
      let v = (obj && obj[k] != null) ? obj[k] : '';
      if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
      v = String(v);
      if(/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g,'""') + '"';
      return v;
    }).join(',');
  }

  class CsvTable{
    constructor(columns){
      this.columns = columns.slice(0);
      this.rows = [];
    }
    add(row){
      this.rows.push(Object.assign({}, row));
    }
    toCsv(){
      const head = this.columns.join(',');
      const body = this.rows.map(r=>toCsvRow(r, this.columns)).join('\n');
      return head + (body ? '\n' + body : '');
    }
    clear(){ this.rows.length = 0; }
  }

  // ---- Track config ----
  const TRACKS = {
    n1: { id:'n1', name:'Warm-up Groove',       bpm:100, diff:'easy',   durationSec: 60, audio: './audio/warmup-groove.mp3' },
    n2: { id:'n2', name:'Focus Combo',          bpm:120, diff:'normal', durationSec: 60, audio: './audio/focus-combo.mp3' },
    n3: { id:'n3', name:'Speed Rush',           bpm:140, diff:'hard',   durationSec: 60, audio: './audio/speed-rush.mp3' },
    r1: { id:'r1', name:'Research Track 120',   bpm:120, diff:'normal', durationSec: 60, audio: './audio/research-120.mp3' }
  };

  // ---- Note patterns ----
  function buildPattern(track, laneCount){
    const id = (track && track.id) ? track.id : 'n1';

    if(id === 'r1' && laneCount === 5){
      return buildBeatmapR1_120(track.durationSec || 60);
    }
    return buildPatternFallback(track, laneCount);
  }

  function buildPatternFallback(track, laneCount){
    const seedStr = (track && track.id) ? track.id : 'n1';
    let seed = 0;
    for(let i=0;i<seedStr.length;i++) seed = (seed*31 + seedStr.charCodeAt(i)) >>> 0;
    function rnd(){
      seed = (seed*1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const bpm = track.bpm || 120;
    const beat = 60 / bpm;
    const dur = track.durationSec || 60;

    const notes = [];
    const diff = track.diff || 'normal';
    const base = (diff==='easy') ? 0.55 : (diff==='hard') ? 0.95 : 0.75;

    const startT = 2.0;
    for(let t=startT; t<dur-1.0; t+=beat){
      if(rnd() > base) continue;
      let lane = Math.floor(rnd() * laneCount);
      const isDouble = (diff!=='easy') && (rnd()<0.10);
      notes.push({ t: +t.toFixed(3), lane, kind:'tap' });
      if(isDouble){
        const lane2 = (lane + 1 + Math.floor(rnd()*(laneCount-1))) % laneCount;
        notes.push({ t: +t.toFixed(3), lane: lane2, kind:'tap' });
      }
    }

    notes.sort((a,b)=>(a.t-b.t) || (a.lane-b.lane));
    return notes;
  }

  // ✅ Beatmap จริงสำหรับ Research Track 120 (r1)
  // lane: 0..4 = L2 L1 C R1 R2
  function buildBeatmapR1_120(dur){
    const bpm = 120;
    const beat = 60 / bpm;    // 0.5s
    const e = beat/2;         // 0.25s (8th)
    const notes = [];
    const push = (t, lane) => notes.push({ t: +t.toFixed(3), lane, kind:'tap' });

    let t = 2.0;
    function barPattern(pattern){
      for(const it of pattern){
        const off = it[0];
        const lanes = it[1];
        for(const ln of lanes) push(t + off, ln);
      }
      t += 4*beat;
    }

    const A1 = [[0*beat,[2]],[1*beat,[1]],[2*beat,[3]],[3*beat,[2]]];
    const A2 = [[0*beat,[0]],[1*beat,[2]],[2*beat,[4]],[3*beat,[2]]];
    for(let i=0;i<4;i++) barPattern(A1);
    for(let i=0;i<4;i++) barPattern(A2);

    const B1 = [[0*beat,[1]],[0*beat+e,[3]],[1*beat,[2]],[2*beat,[0]],[2*beat+e,[4]],[3*beat,[2]]];
    const B2 = [[0*beat,[2]],[1*beat,[1,3]],[2*beat,[0,4]],[3*beat,[2]]];
    for(let i=0;i<4;i++) barPattern(B1);
    for(let i=0;i<4;i++) barPattern(B2);

    const C1 = [[0*beat,[0]],[0*beat+e,[1]],[1*beat,[2]],[1*beat+e,[3]],[2*beat,[4]],[3*beat,[2]]];
    for(let i=0;i<6;i++) barPattern(C1);

    const D1 = [[0*beat,[1]],[0*beat+e,[3]],[1*beat,[0]],[1*beat+e,[4]],[2*beat,[2]],[3*beat,[1,3]]];
    for(let i=0;i<4;i++) barPattern(D1);

    while(t < dur - 1.0){
      push(t + 0*beat, 2);
      push(t + 1*beat, 1);
      push(t + 2*beat, 2);
      push(t + 3*beat, 3);
      t += 4*beat;
    }

    const out = notes.filter(n => n.t >= 0 && n.t <= dur - 0.05);
    out.sort((a,b)=>(a.t-b.t) || (a.lane-b.lane));
    return out;
  }

  // ---- AI helper fallback (prediction only) ----
  const RB_AI_FALLBACK = {
    isLocked(){ return false; },
    isAssistEnabled(){ return qsp.get('ai') === '1'; },
    predict(snap){
      // simple heuristic predictor (explainable)
      const acc01 = clamp01((snap.accPct || 0)/100);
      const missPressure = clamp01((snap.hitMiss || 0) / 20);
      const hpRisk = clamp01((100 - (snap.hp || 100)) / 100);
      const offsetRisk = snap.offsetAbsMean ? clamp01((snap.offsetAbsMean - 0.035) / 0.10) : 0.2;

      const fatigueRisk = clamp01(0.20*missPressure + 0.45*hpRisk + 0.35*offsetRisk);
      const skillScore  = clamp01(0.55*acc01 + 0.25*(1-offsetRisk) + 0.20*clamp01((snap.combo||0)/40));

      let suggestedDifficulty = 'normal';
      if (skillScore > 0.82 && fatigueRisk < 0.35) suggestedDifficulty = 'hard';
      else if (skillScore < 0.45 || fatigueRisk > 0.70) suggestedDifficulty = 'easy';

      let tip = '';
      if (offsetRisk > 0.55) tip = 'โฟกัสจังหวะเส้น hit line';
      else if (fatigueRisk > 0.65) tip = 'ลดแรงกด เน้นแม่นก่อนเร็ว';
      else if (skillScore > 0.80) tip = 'ดีมาก! เตรียมรับแพทเทิร์นหนา';

      return { fatigueRisk, skillScore, suggestedDifficulty, tip };
    }
  };

  class RhythmBoxerEngine{
    constructor(opts = {}){
      this.wrap = opts.wrap || DOC.body;
      this.field = opts.field || null;
      this.lanesEl = opts.lanesEl || null;
      this.audio = opts.audio || null;
      this.renderer = opts.renderer || null;
      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      this.running = false;
      this.ended = false;

      this.mode = 'normal';
      this.track = TRACKS.n1;
      this.meta = {};

      // timing/calibration
      this.calOffsetSec = 0;

      // gameplay state
      this.songTime = 0;
      this._t0 = 0;
      this._lastTs = 0;
      this._rafId = null;

      this.hp = 100;
      this.hpMin = 100;
      this.hpUnder50Time = 0;

      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;
      this.totalNotes = 0;

      // offsets analytics
      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;
      this.leftHits = 0;
      this.rightHits = 0;

      // rolling window (for AI director / boss)
      this.recentJudgments = []; // {t, hit, miss, absOffset}
      this.windowSec = 8;

      // fever
      this.fever = 0;
      this.feverEntryCount = 0;
      this.feverActive = false;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;

      // ai
      this.aiState = null;
      this._aiNext = 0;
      this._aiTipNext = 0;
      this.aiDirectorEnabled = false;
      this.aiDirectorLocked = false;
      this.aiPressure = 0;           // 0..1 visual/game pressure scalar
      this.aiSpawnBias = 1.0;        // affects bonus pressure injection
      this.aiNoteSpeedMul = 1.0;     // affects visual fall speed (normal mode only)
      this.aiDirectorLogTick = 0;

      // boss system
      this.boss = null;              // runtime state
      this.bossEnabled = true;
      this.bossHpMax = 0;
      this.bossHp = 0;
      this.bossPhase = 0;            // 0 none, 1..3
      this.bossPhaseChangedAt = 0;
      this.bossMixMode = (qsp.get('boss') || 'mixed').toLowerCase(); // mixed | classic
      this._lastBossUiPhase = 0;
      this._tempoShiftUntil = 0;

      // notes
      this.laneCount = 5;
      this.notes = [];
      this.noteIdx = 0;
      this.live = [];
      this.noteSpeedSec = 2.20;
      this.noteBaseLen = 160;

      // pressure injections (boss/director synthetic adds)
      this.injectQueue = [];         // scheduled synthetic notes: {t,lane,kind:'tap',_inj:1}
      this._injCooldownUntil = 0;
      this._lastInjectedLane = -1;

      // CSV
      this.sessionId = '';
      this.eventsTable = new CsvTable([
        'session_id','mode','track_id','bpm','difficulty',
        'participant_id','group','note',
        't_s','lane','side',
        'event','judgment','offset_s','score_delta',
        'combo','hp','fever','cal_offset_ms',
        'boss_phase','boss_hp','boss_hp_max','boss_active','boss_tag',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        'ai_pressure','ai_note_speed_mul','ai_spawn_bias',
        'created_at_iso'
      ]);

      this.sessionTable = new CsvTable([
        'session_id','mode','track_id','track_name','bpm','difficulty',
        'participant_id','group','note',
        'score_final','max_combo',
        'hit_perfect','hit_great','hit_good','hit_miss',
        'total_notes','acc_pct',
        'offset_mean_s','offset_std_s','offset_abs_mean_s','offset_early_pct','offset_late_pct',
        'left_hit_pct','right_hit_pct',
        'fever_entry_count','fever_total_time_s','fever_time_pct','time_to_first_fever_s',
        'hp_start','hp_end','hp_min','hp_under50_time_s',
        'boss_enabled','boss_defeated','boss_phase_max','boss_hp_damage_dealt','boss_pressure_events',
        'end_reason','duration_sec','device_type',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        'ai_pressure_mean','ai_note_speed_mul_mean','ai_spawn_bias_mean',
        'trial_valid','rank','created_at_iso'
      ]);

      // ML/DL feature rows (snapshot every ~400ms + special moments)
      this.featureTable = new CsvTable([
        'session_id','t_s','mode','track_id','difficulty',
        'phase_label','boss_phase','boss_hp_norm','boss_active',
        'acc_pct_live','combo','hp','fever','fever_active',
        'recent_hit_rate','recent_miss_rate','recent_offset_abs_mean',
        'hit_perfect','hit_great','hit_good','hit_miss',
        'note_density_2s','live_notes','next_note_gap_s',
        'cal_offset_ms','device_type',
        'ai_fatigue_risk','ai_skill_score','ai_suggest',
        'ai_locked','ai_assist_on',
        'ai_pressure','ai_note_speed_mul','ai_spawn_bias',
        'label_end_rank','label_trial_valid','label_end_reason',
        'created_at_iso'
      ]);

      // accumulators for session means
      this._aiPressureSamples = [];
      this._aiNoteSpeedSamples = [];
      this._aiSpawnBiasSamples = [];
      this._bossPressureEvents = 0;
      this._bossHpDamageDealt = 0;
      this._bossPhaseMax = 0;
      this._bossDefeated = 0;

      this._bindLaneInput();
      this._detectDeviceType();
    }

    // ---- public calibration APIs ----
    adjustCalMs(deltaMs){
      const v = (Number(deltaMs)||0) / 1000;
      this.calOffsetSec = Math.max(-0.250, Math.min(0.250, this.calOffsetSec + v));
    }
    setCalMs(ms){
      const v = (Number(ms)||0) / 1000;
      this.calOffsetSec = Math.max(-0.250, Math.min(0.250, v));
    }

    _detectDeviceType(){
      try{
        const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints>0);
        this.deviceType = touch ? 'mobile' : 'pc';
      }catch(_){
        this.deviceType = 'unknown';
      }
    }

    _bindLaneInput(){
      if(!this.lanesEl) return;

      this.lanesEl.addEventListener('pointerdown', (ev)=>{
        const laneEl = ev.target && ev.target.closest ? ev.target.closest('.rb-lane') : null;
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if(!Number.isFinite(lane)) return;
        this.hitLane(lane, 'tap');
      }, {passive:true});

      DOC.addEventListener('keydown', (ev)=>{
        if(!this.running) return;
        const k = (ev.key||'').toLowerCase();
        const map5 = { 'a':0, 's':1, 'd':2, 'j':3, 'k':4 };
        const map3 = { 'a':0, 's':1, 'd':2 };
        const map = (this.laneCount===3) ? map3 : map5;
        if(map[k] != null) this.hitLane(map[k], 'key');
      });
    }

    _makeSessionId(){
      const t = Date.now().toString(36);
      const r = Math.random().toString(36).slice(2,7);
      return `RB-${t}-${r}`;
    }

    _aiApi(){
      return (WIN.RB_AI && typeof WIN.RB_AI.predict === 'function') ? WIN.RB_AI : RB_AI_FALLBACK;
    }

    start(mode, trackId, meta = {}){
      this.mode = (mode === 'research') ? 'research' : 'normal';
      this.meta = meta || {};
      this.track = TRACKS[trackId] || TRACKS.n1;

      this.laneCount = (this.lanesEl && this.lanesEl.querySelectorAll('.rb-lane').length) || 5;

      this.running = true;
      this.ended = false;

      this.songTime = 0;
      this._t0 = nowS();
      this._lastTs = this._t0;

      this.hp = 100;
      this.hpMin = 100;
      this.hpUnder50Time = 0;

      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.offsets.length = 0;
      this.offsetsAbs.length = 0;
      this.earlyHits = 0;
      this.lateHits = 0;
      this.leftHits = 0;
      this.rightHits = 0;
      this.recentJudgments.length = 0;

      this.fever = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;

      this.aiState = null;
      this._aiNext = 0;
      this._aiTipNext = 0;
      this.aiPressure = 0;
      this.aiSpawnBias = 1.0;
      this.aiNoteSpeedMul = 1.0;
      this.aiDirectorEnabled = (qsp.get('ai') === '1');
      this.aiDirectorLocked = (this.mode === 'research'); // research = no adaptation
      this.aiDirectorLogTick = 0;
      this._aiPressureSamples.length = 0;
      this._aiNoteSpeedSamples.length = 0;
      this._aiSpawnBiasSamples.length = 0;

      // notes
      this.notes = buildPattern(this.track, this.laneCount);
      this.totalNotes = this.notes.length;
      this.noteIdx = 0;
      this.live.length = 0;
      this.injectQueue.length = 0;
      this._injCooldownUntil = 0;
      this._lastInjectedLane = -1;

      this._clearNotesDom();

      // boss runtime init (enabled for all modes)
      this._initBoss();

      this.sessionId = this._makeSessionId();
      this.eventsTable.clear();
      this.sessionTable.clear();
      this.featureTable.clear();

      if(this.audio){
        this.audio.src = this.track.audio;
        this.audio.currentTime = 0;
        this.audio.loop = false;
        const p = this.audio.play();
        if(p && typeof p.catch==='function') p.catch(()=>{});
      }

      this._rafId = requestAnimationFrame(()=>this._loop());

      this._updateHud();
      this._updateBars();
      this._updateCalibrationHud();
      this._updateBossHud(true);

      this._logFeatureSnapshot('start');

      if(this.hooks && typeof this.hooks.onStart==='function'){
        this.hooks.onStart({ sessionId:this.sessionId, mode:this.mode, track:this.track });
      }
    }

    stop(reason){
      if(!this.running || this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    _initBoss(){
      const dur = this.track.durationSec || 60;
      const baseHp = (this.track.diff === 'easy') ? 1200 : (this.track.diff === 'hard' ? 1900 : 1500);
      this.bossEnabled = true;
      this.bossHpMax = baseHp;
      this.bossHp = baseHp;
      this.bossPhase = 1;
      this.bossPhaseChangedAt = 0;
      this._lastBossUiPhase = 0;
      this._tempoShiftUntil = 0;
      this._bossPressureEvents = 0;
      this._bossHpDamageDealt = 0;
      this._bossPhaseMax = 1;
      this._bossDefeated = 0;

      // fixed phase boundaries by time (fair in research), plus HP effects
      this.boss = {
        active: true,
        startsAt: 4.0,
        endsAt: dur - 0.3,
        p2AtSec: Math.max(16, dur*0.33),
        p3AtSec: Math.max(34, dur*0.66),
        tag: 'Mixed Boss',
        lastPressureAt: -999,
        pressureEverySec: 3.6,
        pressureIntensity: 1.0
      };
    }

    _clearNotesDom(){
      if(!this.lanesEl) return;
      this.lanesEl.querySelectorAll('.rb-note').forEach(el=>el.remove());
    }

    _spawnNote(note){
      if(!this.lanesEl) return;
      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${note.lane}"]`);
      if(!laneEl) return;

      const el = DOC.createElement('div');
      el.className = 'rb-note';
      if (note._inj) el.classList.add('rb-note--inj');
      el.dataset.t = String(note.t);
      el.dataset.lane = String(note.lane);

      const diff = this.track.diff || 'normal';
      const base = this.noteBaseLen;
      const mul = (diff==='easy') ? 0.95 : (diff==='hard') ? 1.25 : 1.10;
      const lenPx = Math.round(base * mul);
      el.style.setProperty('--rb-note-len', lenPx + 'px');

      const ico = DOC.createElement('div');
      ico.className = 'rb-note-ico';
      ico.textContent = note._inj ? '⚠️' : '🎵';
      el.appendChild(ico);

      laneEl.appendChild(el);
      note.el = el;
      note.spawned = true;
    }

    _despawnNote(note){
      if(note && note.el){
        note.el.remove();
        note.el = null;
      }
      note.spawned = false;
      note.done = true;
    }

    _loop(){
      if(!this.running || this.ended) return;

      const t = nowS();
      const dt = Math.max(0, t - this._lastTs);
      this._lastTs = t;

      if(this.audio && Number.isFinite(this.audio.currentTime)){
        this.songTime = this.audio.currentTime;
      }else{
        this.songTime = t - this._t0;
      }

      if(this.feverActive) this.feverTotalTimeSec += dt;
      if(this.hp < 50) this.hpUnder50Time += dt;

      this._updateBossState(dt);
      this._spawnAhead();
      this._updateNotePositions();
      this._resolveTimeoutMiss();

      this._updateAI();
      this._applyAIDirector(dt);     // adaptive only if allowed
      this._sampleSessionAIState();
      this._maybeLogFeatureSnapshot();

      this._updateHud();
      this._updateBars();
      this._updateCalibrationHud();
      this._updateBossHud();

      if(this.hp <= 0){
        this._finish('hp-zero');
        return;
      }
      const dur = this.track.durationSec || 60;
      if(this.songTime >= dur){
        this._finish('song-end');
        return;
      }

      this._rafId = requestAnimationFrame(()=>this._loop());
    }

    _effectiveNoteSpeedSec(){
      // smaller = faster travel visually (harder)
      const m = clamp(this.aiNoteSpeedMul || 1, 0.88, 1.18);
      return clamp(this.noteSpeedSec / m, 1.55, 2.45);
    }

    _spawnAhead(){
      const lead = this._effectiveNoteSpeedSec();

      // base chart notes
      while(this.noteIdx < this.notes.length){
        const n = this.notes[this.noteIdx];
        if(n.t - this.songTime > lead) break;
        this._spawnNote(n);
        this.live.push(n);
        this.noteIdx++;
      }

      // injected pressure notes (boss/AI)
      this.injectQueue.sort((a,b)=>a.t-b.t);
      while(this.injectQueue.length && (this.injectQueue[0].t - this.songTime) <= lead){
        const n = this.injectQueue.shift();
        // guard near overlap
        if (this._hasNearNote(n.lane, n.t, 0.11)) continue;
        this._spawnNote(n);
        this.live.push(n);
      }
    }

    _hasNearNote(lane, t, tolSec){
      for (const n of this.live){
        if (n.done) continue;
        if (n.lane !== lane) continue;
        if (Math.abs((n.t||0)-t) <= tolSec) return true;
      }
      // also upcoming authored notes
      for (let i=this.noteIdx; i<Math.min(this.noteIdx+10, this.notes.length); i++){
        const n = this.notes[i];
        if (n.lane === lane && Math.abs((n.t||0)-t) <= tolSec) return true;
      }
      return false;
    }

    _updateNotePositions(){
      const lead = this._effectiveNoteSpeedSec();
      if(!this.lanesEl) return;

      for(const n of this.live){
        if(!n.spawned || !n.el) continue;
        const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if(!laneEl) continue;

        const rect = laneEl.getBoundingClientRect();
        const laneH = rect.height || 420;
        const noteLen = parseFloat(getComputedStyle(n.el).getPropertyValue('--rb-note-len')) || this.noteBaseLen;
        const travel = laneH + noteLen * 0.45;

        const p = (this.songTime - (n.t - lead)) / lead;
        const pClamp = clamp01(p);
        const y = (pClamp - 1) * travel;

        n.el.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
        n.el.style.opacity = (pClamp < 0.02) ? '0' : '1';
      }
    }

    _resolveTimeoutMiss(){
      const missLate = 0.18;
      const keep = [];
      for(const n of this.live){
        if(n.done) continue;
        const dt = (this.songTime - n.t) - this.calOffsetSec;
        if(dt > missLate){
          this._applyMiss(n.lane, 'timeout', n);
          this._despawnNote(n);
          continue;
        }
        keep.push(n);
      }
      this.live = keep;
    }

    hitLane(lane, source){
      if(!this.running || this.ended) return;

      let best = null;
      let bestAbs = 999;

      for(const n of this.live){
        if(n.done) continue;
        if(n.lane !== lane) continue;
        const dt = (this.songTime - n.t) - this.calOffsetSec;
        const a = Math.abs(dt);
        if(a < bestAbs){
          bestAbs = a;
          best = { note:n, dt };
        }
      }

      const wPerfect = 0.045;
      const wGreat   = 0.080;
      const wGood    = 0.120;

      if(best && bestAbs <= wGood){
        const dt = best.dt;
        let judgment = 'good';
        let scoreDelta = 50;
        if(Math.abs(dt) <= wPerfect){ judgment='perfect'; scoreDelta=150; }
        else if(Math.abs(dt) <= wGreat){ judgment='great'; scoreDelta=100; }

        this._applyHit(lane, judgment, dt, scoreDelta, best.note);
        this._despawnNote(best.note);
        this.live = this.live.filter(x=>x && !x.done);
      }else{
        this._applyBlankMiss(lane);
      }
    }

    _pushRecent(hit, miss, absOffset){
      this.recentJudgments.push({ t:this.songTime, hit:hit?1:0, miss:miss?1:0, absOffset:Number.isFinite(absOffset)?absOffset:null });
      const cutoff = this.songTime - this.windowSec;
      while(this.recentJudgments.length && this.recentJudgments[0].t < cutoff){
        this.recentJudgments.shift();
      }
    }

    _recentStats(){
      const arr = this.recentJudgments;
      if(!arr.length) return { hitRate:0, missRate:0, absOffsetMean:0 };
      let hit=0, miss=0, c=0, s=0;
      for(const r of arr){
        hit += r.hit||0;
        miss += r.miss||0;
        if(Number.isFinite(r.absOffset)){ s += r.absOffset; c++; }
      }
      const n = arr.length;
      return {
        hitRate: n ? hit/n : 0,
        missRate: n ? miss/n : 0,
        absOffsetMean: c ? s/c : 0
      };
    }

    _damageBossFromJudgment(judgment, note){
      if(!this.boss || !this.boss.active || this.songTime < this.boss.startsAt) return;

      // base damage by judgment
      let dmg = 0;
      if (judgment === 'perfect') dmg = 10;
      else if (judgment === 'great') dmg = 7;
      else if (judgment === 'good') dmg = 4;

      // combo bonus
      if (this.combo >= 10) dmg += 1;
      if (this.combo >= 25) dmg += 1;
      if (this.combo >= 40) dmg += 1;

      // fever bonus
      if (this.feverActive) dmg = Math.round(dmg * 1.35);

      // boss phase armor / weakness
      if (this.bossPhase === 1) dmg = Math.round(dmg * 1.00);
      else if (this.bossPhase === 2) dmg = Math.round(dmg * 0.95);
      else if (this.bossPhase === 3) dmg = Math.round(dmg * 1.10);

      // injected pressure notes worth slightly more if hit
      if (note && note._inj) dmg += 1;

      dmg = Math.max(1, dmg);
      this.bossHp = Math.max(0, this.bossHp - dmg);
      this._bossHpDamageDealt += dmg;

      if (this.bossHp <= 0 && !this._bossDefeated){
        this._bossDefeated = 1;
        this.boss.active = false;
        this._logEvent({ event:'boss_defeated', lane:'', judgment:'', offset_s:'', score_delta:+2500 });
        this.score += 2500;
      }
    }

    _applyHit(lane, judgment, offsetSec, scoreDelta, noteObj){
      if(judgment==='perfect') this.hitPerfect++;
      else if(judgment==='great') this.hitGreat++;
      else this.hitGood++;

      this.offsets.push(offsetSec);
      this.offsetsAbs.push(Math.abs(offsetSec));
      if(offsetSec < 0) this.earlyHits++; else if(offsetSec > 0) this.lateHits++;

      const mid = (this.laneCount===3) ? 1 : 2;
      if(lane < mid) this.leftHits++;
      else if(lane > mid) this.rightHits++;

      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // score multiplier by boss phase (makes it exciting)
      let phaseMult = 1;
      if (this.bossPhase === 2) phaseMult = 1.10;
      else if (this.bossPhase === 3) phaseMult = 1.20;
      if (this.feverActive) phaseMult += 0.20;

      const appliedScore = Math.round(scoreDelta * phaseMult);
      this.score += appliedScore;

      const add = (judgment==='perfect') ? 0.090 : (judgment==='great') ? 0.060 : 0.035;
      this.fever = clamp01(this.fever + add);

      if(!this.feverActive && this.fever >= 1){
        this.feverActive = true;
        this.feverEntryCount++;
        if(this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = this.songTime;
        this._logEvent({ event:'fever_enter', lane, judgment:'', offset_s:'', score_delta:0 });
      }

      this._damageBossFromJudgment(judgment, noteObj);

      this._pushRecent(true, false, Math.abs(offsetSec));

      if(this.renderer && typeof this.renderer.showHitFx==='function'){
        this.renderer.showHitFx({ lane, judgment, scoreDelta: appliedScore });
      }

      this._logEvent({ event:'hit', lane, judgment, offset_s: offsetSec, score_delta: appliedScore });
    }

    _applyMiss(lane, kind, noteObj){
      this.hitMiss++;
      this.combo = 0;

      let dmg = (kind==='timeout') ? 10 : 8;
      // phase 3 pressure hurts a bit more
      if (this.bossPhase === 3) dmg += 2;
      this.hp = Math.max(0, this.hp - dmg);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this.fever = clamp01(this.fever - 0.10);
      if(this.feverActive && this.fever < 0.60){
        this.feverActive = false;
        this._logEvent({ event:'fever_exit', lane, judgment:'', offset_s:'', score_delta:0 });
      }

      // boss punishes on injected note misses
      if (noteObj && noteObj._inj && this.boss && this.boss.active){
        this.bossHp = Math.min(this.bossHpMax, this.bossHp + 6); // tiny regen if miss pressure cue
      }

      this._pushRecent(false, true, null);

      if(this.renderer && typeof this.renderer.showMissFx==='function'){
        this.renderer.showMissFx({ lane });
      }

      this._logEvent({
        event: kind==='timeout' ? 'timeout_miss' : 'miss',
        lane,
        judgment: 'miss',
        offset_s: '',
        score_delta: -dmg
      });
    }

    _applyBlankMiss(lane){
      this.hitMiss++;
      this.combo = 0;

      let dmg = 5;
      if (this.bossPhase === 3) dmg += 1;
      this.hp = Math.max(0, this.hp - dmg);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this.fever = clamp01(this.fever - 0.06);
      if(this.feverActive && this.fever < 0.60){
        this.feverActive = false;
        this._logEvent({ event:'fever_exit', lane, judgment:'', offset_s:'', score_delta:0 });
      }

      this._pushRecent(false, true, null);

      if(this.renderer && typeof this.renderer.showMissFx==='function'){
        this.renderer.showMissFx({ lane });
      }

      this._logEvent({
        event: 'blank_tap',
        lane,
        judgment: 'miss',
        offset_s: '',
        score_delta: -dmg
      });
    }

    _bossPhaseByTime(t){
      if (!this.boss) return 0;
      if (t < this.boss.startsAt) return 0;
      if (t < this.boss.p2AtSec) return 1;
      if (t < this.boss.p3AtSec) return 2;
      return 3;
    }

    _updateBossState(dt){
      if (!this.bossEnabled || !this.boss) return;

      const activeWindow = (this.songTime >= this.boss.startsAt) && (this.songTime <= this.boss.endsAt);
      if (!activeWindow) return;

      // Phase by time (fair/research-safe), can still end early if defeated
      const phase = this._bossPhaseByTime(this.songTime);
      if (phase !== this.bossPhase){
        this.bossPhase = phase;
        this.bossPhaseChangedAt = this.songTime;
        this._bossPhaseMax = Math.max(this._bossPhaseMax, this.bossPhase);
        if (phase > 0){
          this._logEvent({ event:'boss_phase', lane:'', judgment:'', offset_s:'', score_delta:0 });
          this._setTelegraph(`PHASE ${phase}`);
        }
      }

      if (!this.boss.active || this._bossDefeated) return;

      // boss pressure schedule
      const rec = this._recentStats();
      let interval = 3.6;
      if (this.bossPhase === 2) interval = 2.9;
      if (this.bossPhase === 3) interval = 2.2;

      // if player is doing very well, pressure slightly faster
      if (rec.hitRate > 0.75 && rec.absOffsetMean < 0.070) interval -= 0.25;
      interval = clamp(interval, 1.7, 4.2);

      const canPressure = (this.songTime - this.boss.lastPressureAt) >= interval;
      if (canPressure && this.songTime >= this._injCooldownUntil){
        this.boss.lastPressureAt = this.songTime;
        this._bossPressureEvents++;
        this._injectBossPressurePattern();
      }

      // phase 2/3 tempo shift telegraph (visual-only; in research no adaptive beyond predefined schedule)
      const localT = this.songTime - this.bossPhaseChangedAt;
      if ((this.bossPhase === 2 || this.bossPhase === 3) && localT > 1.6 && localT < 2.2){
        this._tempoShiftUntil = Math.max(this._tempoShiftUntil, this.songTime + 0.7);
      }
    }

    _injectBossPressurePattern(){
      if (!this.boss || !this.boss.active) return;
      const t0 = this.songTime + 1.10; // telegraphed future injection
      const phase = this.bossPhase || 1;
      const lanes = this.laneCount;

      const center = (lanes===3) ? 1 : 2;
      const pickSideLane = () => {
        let cands = [];
        for(let i=0;i<lanes;i++) if(i!==center) cands.push(i);
        // avoid same lane repetition when possible
        cands = cands.filter(x => x !== this._lastInjectedLane).concat(cands);
        const idx = Math.floor(Math.random()*Math.max(1,cands.length));
        const lane = cands[idx % cands.length];
        this._lastInjectedLane = lane;
        return lane;
      };

      const q = [];
      if (phase === 1){
        // simple call-response (single)
        q.push({ t:t0, lane: pickSideLane(), kind:'tap', _inj:1 });
      }else if (phase === 2){
        // double burst
        q.push({ t:t0,      lane: pickSideLane(), kind:'tap', _inj:1 });
        q.push({ t:t0+0.28, lane: center,         kind:'tap', _inj:1 });
      }else{
        // mixed burst (hardest)
        q.push({ t:t0,      lane: pickSideLane(), kind:'tap', _inj:1 });
        q.push({ t:t0+0.22, lane: center,         kind:'tap', _inj:1 });
        q.push({ t:t0+0.44, lane: pickSideLane(), kind:'tap', _inj:1 });
        // occasional simultaneous pair
        if (Math.random() < 0.45 && lanes >= 5){
          q.push({ t:t0+0.66, lane:1, kind:'tap', _inj:1 });
          q.push({ t:t0+0.66, lane:3, kind:'tap', _inj:1 });
        }
      }

      for(const n of q) this.injectQueue.push(n);
      this._injCooldownUntil = this.songTime + (phase===3 ? 1.2 : 1.6);

      this._logEvent({ event:'boss_pressure', lane:'', judgment:'', offset_s:'', score_delta:0 });
      this._setTelegraph(phase===3 ? 'BOSS BURST!' : 'BOSS PRESSURE!');
    }

    _setTelegraph(text){
      if (this.hooks && typeof this.hooks.onTelegraph === 'function'){
        this.hooks.onTelegraph(text);
      }
      const el = DOC.querySelector('#rb-feedback');
      if (el && text){
        el.textContent = text;
        el.classList.add('show');
        setTimeout(()=>{ try{ el.classList.remove('show'); }catch(_){} }, 650);
      }
    }

    _logEvent(e){
      const AI = this._aiApi();
      const aiLocked = (AI.isLocked && AI.isLocked()) ? 1 : 0;
      const aiAssist = (AI.isAssistEnabled && AI.isAssistEnabled()) ? 1 : 0;

      const laneVal = (e.lane==='' || e.lane==null) ? '' : e.lane;

      const row = {
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track.id,
        bpm: this.track.bpm,
        difficulty: this.track.diff,

        participant_id: this.meta.id || this.meta.participant_id || '',
        group: this.meta.group || '',
        note: this.meta.note || '',

        t_s: this.songTime.toFixed(3),
        lane: laneVal,
        side: (laneVal==='') ? '' : (
          (this.laneCount===3)
            ? (laneVal===1 ? 'C' : (laneVal===0?'L':'R'))
            : (laneVal<2 ? 'L' : (laneVal===2?'C':'R'))
        ),

        event: e.event,
        judgment: e.judgment || '',
        offset_s: (e.offset_s===''? '' : (Number.isFinite(e.offset_s)? e.offset_s.toFixed(4): '')),
        score_delta: e.score_delta,

        combo: this.combo,
        hp: this.hp,
        fever: this.fever.toFixed(3),
        cal_offset_ms: Math.round(this.calOffsetSec*1000),

        boss_phase: this.bossPhase || 0,
        boss_hp: this.boss ? Math.round(this.bossHp) : '',
        boss_hp_max: this.boss ? this.bossHpMax : '',
        boss_active: (this.boss && this.boss.active) ? 1 : 0,
        boss_tag: (this.boss && this.boss.tag) ? this.boss.tag : '',

        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: aiLocked,
        ai_assist_on: aiAssist,
        ai_pressure: this.aiPressure,
        ai_note_speed_mul: this.aiNoteSpeedMul,
        ai_spawn_bias: this.aiSpawnBias,

        created_at_iso: new Date().toISOString()
      };

      this.eventsTable.add(row);
    }

    _updateHud(){
      const hud = this.hud || {};
      if(hud.score) hud.score.textContent = String(this.score);
      if(hud.combo) hud.combo.textContent = String(this.combo);

      if(hud.acc){
        const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
        const hit = judged - this.hitMiss;
        const acc = judged ? (hit / this.totalNotes) * 100 : 0;
        hud.acc.textContent = acc.toFixed(1) + '%';
      }

      if(hud.hp) hud.hp.textContent = String(Math.round(this.hp));
      if(hud.shield) hud.shield.textContent = '0';
      if(hud.time) hud.time.textContent = this.songTime.toFixed(1);

      if(hud.countPerfect) hud.countPerfect.textContent = String(this.hitPerfect);
      if(hud.countGreat)   hud.countGreat.textContent   = String(this.hitGreat);
      if(hud.countGood)    hud.countGood.textContent    = String(this.hitGood);
      if(hud.countMiss)    hud.countMiss.textContent    = String(this.hitMiss);

      if(this.aiState){
        if(hud.aiFatigue) hud.aiFatigue.textContent = Math.round((this.aiState.fatigueRisk||0)*100) + '%';
        if(hud.aiSkill)   hud.aiSkill.textContent   = Math.round((this.aiState.skillScore||0)*100) + '%';
        if(hud.aiSuggest) hud.aiSuggest.textContent = (this.aiState.suggestedDifficulty||'normal');
        if(hud.aiTip){
          hud.aiTip.textContent = this.aiState.tip || '';
          hud.aiTip.classList.toggle('hidden', !this.aiState.tip);
        }
      }
    }

    _updateBars(){
      const hud = this.hud || {};
      if(hud.feverFill) hud.feverFill.style.width = Math.round(this.fever*100) + '%';
      if(hud.feverStatus){
        if(this.feverActive) hud.feverStatus.textContent = 'FEVER!';
        else if(this.fever >= 0.85) hud.feverStatus.textContent = 'BUILD';
        else hud.feverStatus.textContent = 'READY';
      }
      if(hud.progFill || hud.progText){
        const dur = this.track.durationSec || 60;
        const p = dur>0 ? clamp01(this.songTime / dur) : 0;
        if(hud.progFill) hud.progFill.style.width = Math.round(p*100) + '%';
        if(hud.progText) hud.progText.textContent = Math.round(p*100) + '%';
      }

      // optional visual hint during tempo shift
      if (this.wrap){
        const on = this.songTime < this._tempoShiftUntil;
        this.wrap.classList.toggle('rb-tempo-shift', !!on);
      }
    }

    _updateBossHud(force){
      const hud = this.hud || {};
      const active = !!(this.boss && this.boss.active && this.songTime >= (this.boss.startsAt||0));

      if(hud.bossWrap) hud.bossWrap.classList.toggle('hidden', !active);
      if(hud.bossPhase) hud.bossPhase.textContent = String(this.bossPhase || 0);
      if(hud.bossTag) hud.bossTag.textContent = active ? (this.boss.tag || 'Boss') : '—';
      if(hud.bossStatus){
        if(!active) hud.bossStatus.textContent = '—';
        else if(this._bossDefeated) hud.bossStatus.textContent = 'DEFEATED';
        else hud.bossStatus.textContent = `Phase ${this.bossPhase}`;
      }
      if(hud.bossFill && this.boss){
        const p = this.bossHpMax>0 ? clamp01(this.bossHp / this.bossHpMax) : 0;
        hud.bossFill.style.width = Math.round(p*100) + '%';
      }

      if ((force || this._lastBossUiPhase !== this.bossPhase) && active){
        this._lastBossUiPhase = this.bossPhase;
        if (this.hooks && typeof this.hooks.onBossPhaseChange === 'function'){
          this.hooks.onBossPhaseChange({ phase:this.bossPhase, hp:this.bossHp, hpMax:this.bossHpMax });
        }
      }
    }

    _updateCalibrationHud(){
      const el = DOC.querySelector('#rb-hud-cal');
      if(el){
        el.textContent = `${Math.round(this.calOffsetSec*1000)}ms`;
      }
    }

    _updateAI(){
      const t = this.songTime;
      if(t < this._aiNext) return;
      this._aiNext = t + 0.40;

      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hit = judged - this.hitMiss;
      const accPct = judged ? (hit / this.totalNotes) * 100 : 0;

      const rec = this._recentStats();
      const snap = {
        accPct,
        hitMiss: this.hitMiss,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        combo: this.combo,
        offsetAbsMean: this.offsetsAbs.length ? mean(this.offsetsAbs) : null,
        recentHitRate: rec.hitRate,
        recentMissRate: rec.missRate,
        recentOffsetAbsMean: rec.absOffsetMean,
        hp: this.hp,
        songTime: this.songTime,
        durationSec: this.track.durationSec || 60
      };

      const AI = this._aiApi();
      this.aiState = AI.predict(snap) || { fatigueRisk:0, skillScore:0.5, suggestedDifficulty:'normal', tip:'' };

      if(this.aiState){
        if(t >= this._aiTipNext){
          this._aiTipNext = t + 2.5;
        }else{
          if(!this.aiState.tip) this.aiState.tip = '';
        }
      }

      // no adaptation here; adaptation is centralized in _applyAIDirector()
    }

    _applyAIDirector(dt){
      // Director applies only in normal mode and if ai=1 and NOT research lock
      const AI = this._aiApi();
      const aiAssistOn = !!(AI.isAssistEnabled && AI.isAssistEnabled());
      const adaptiveAllowed = aiAssistOn && !this.aiDirectorLocked && this.mode !== 'research';

      if(!this.aiState){
        this.aiPressure = 0;
        this.aiSpawnBias = 1.0;
        this.aiNoteSpeedMul = 1.0;
        return;
      }

      // derive a "pressure" scalar (0 easier .. 1 harder)
      const fatigue = clamp01(this.aiState.fatigueRisk || 0);
      const skill = clamp01(this.aiState.skillScore || 0);
      const rec = this._recentStats();

      // if high skill and low fatigue => increase pressure, else ease off
      let pressureTarget = clamp01(0.55*skill + 0.25*(1-fatigue) + 0.20*rec.hitRate);
      // convert to "challenge pressure" centered
      pressureTarget = clamp01((pressureTarget - 0.45) / 0.45);

      if(!adaptiveAllowed){
        // Prediction-only mode (research or ai disabled)
        this.aiPressure = pressureTarget;
        this.aiSpawnBias = 1.0;
        this.aiNoteSpeedMul = 1.0;
        return;
      }

      // smooth changes
      const lerp = (a,b,k)=>a + (b-a)*k;
      this.aiPressure = lerp(this.aiPressure, pressureTarget, Math.min(1, dt*1.6));

      // map pressure -> parameters (gentle, non-chaotic)
      this.aiNoteSpeedMul = lerp(this.aiNoteSpeedMul, 0.96 + this.aiPressure*0.16, Math.min(1, dt*1.8)); // 0.96..1.12
      this.aiSpawnBias    = lerp(this.aiSpawnBias,    0.95 + this.aiPressure*0.22, Math.min(1, dt*1.8)); // 0.95..1.17

      // Optional pressure injection (extra note) when player strong
      if (this.songTime > 8 && this.songTime > this._injCooldownUntil){
        const strong = (skill > 0.78 && fatigue < 0.45 && rec.hitRate > 0.60 && rec.absOffsetMean < 0.085);
        if (strong){
          const p = 0.08 + 0.16*this.aiPressure; // chance per update tick (0.4s)
          if (Math.random() < p){
            this._injectDirectorPressureNote();
          }
        }
      }

      // rate-limited explainable director logs
      if (this.songTime >= this.aiDirectorLogTick){
        this.aiDirectorLogTick = this.songTime + 4.0;
        this._logEvent({ event:'ai_director_tick', lane:'', judgment:'', offset_s:'', score_delta:0 });
      }
    }

    _injectDirectorPressureNote(){
      const t = this.songTime + 1.0 + Math.random()*0.35;
      const lane = this._pickPressureLane();
      const n = { t:+t.toFixed(3), lane, kind:'tap', _inj:1 };
      if (this._hasNearNote(n.lane, n.t, 0.12)) return;
      this.injectQueue.push(n);
      this._injCooldownUntil = this.songTime + 2.2;
      this._bossPressureEvents++; // count as pressure event for summary (same bucket)
      this._logEvent({ event:'ai_pressure_note', lane:'', judgment:'', offset_s:'', score_delta:0 });
      if (this.aiPressure > 0.65) this._setTelegraph('AI PRESSURE!');
    }

    _pickPressureLane(){
      const lanes = this.laneCount;
      const center = (lanes===3)?1:2;
      // Prefer opposite side of recent dominant hand-side usage to rebalance
      const totalSide = this.leftHits + this.rightHits;
      if (lanes >= 5 && totalSide > 8){
        const leftBias = this.leftHits / Math.max(1,totalSide);
        if (leftBias > 0.62) return 3 + Math.floor(Math.random()*2); // right side
        if (leftBias < 0.38) return Math.floor(Math.random()*2);     // left side
      }
      let lane = Math.floor(Math.random()*lanes);
      if (Math.random() < 0.30) lane = center;
      return lane;
    }

    _sampleSessionAIState(){
      this._aiPressureSamples.push(this.aiPressure || 0);
      this._aiNoteSpeedSamples.push(this.aiNoteSpeedMul || 1);
      this._aiSpawnBiasSamples.push(this.aiSpawnBias || 1);
    }

    _noteDensity2s(){
      const t0 = this.songTime;
      const t1 = t0 + 2.0;
      let count = 0;

      for (let i=this.noteIdx; i<this.notes.length; i++){
        const n = this.notes[i];
        if (n.t > t1) break;
        if (n.t >= t0) count++;
      }
      for (const n of this.injectQueue){
        if (n.t >= t0 && n.t <= t1) count++;
      }
      return count;
    }

    _nextNoteGap(){
      let nextT = Infinity;
      if (this.noteIdx < this.notes.length) nextT = Math.min(nextT, this.notes[this.noteIdx].t);
      if (this.injectQueue.length){
        for (const n of this.injectQueue) if (n.t < nextT) nextT = n.t;
      }
      if (!Number.isFinite(nextT)) return '';
      return +(Math.max(0, nextT - this.songTime)).toFixed(3);
    }

    _phaseLabel(){
      if (!this.boss || this.songTime < (this.boss.startsAt||0)) return 'pre-boss';
      if (this._bossDefeated) return 'post-boss-defeated';
      return `boss-p${this.bossPhase||1}`;
    }

    _logFeatureSnapshot(reason){
      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const totalJudged = judged;
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const accPctLive = totalJudged ? ((totalHits) / Math.max(1, this.totalNotes)) * 100 : 0;
      const rec = this._recentStats();
      const AI = this._aiApi();

      this.featureTable.add({
        session_id: this.sessionId,
        t_s: +this.songTime.toFixed(3),
        mode: this.mode,
        track_id: this.track.id,
        difficulty: this.track.diff,

        phase_label: this._phaseLabel(),
        boss_phase: this.bossPhase || 0,
        boss_hp_norm: this.boss ? +(this.bossHpMax>0 ? (this.bossHp/this.bossHpMax).toFixed(4) : 0) : '',
        boss_active: (this.boss && this.boss.active) ? 1 : 0,

        acc_pct_live: +accPctLive.toFixed(3),
        combo: this.combo,
        hp: +this.hp.toFixed(2),
        fever: +this.fever.toFixed(4),
        fever_active: this.feverActive ? 1 : 0,

        recent_hit_rate: +rec.hitRate.toFixed(4),
        recent_miss_rate: +rec.missRate.toFixed(4),
        recent_offset_abs_mean: +rec.absOffsetMean.toFixed(5),

        hit_perfect: this.hitPerfect,
        hit_great: this.hitGreat,
        hit_good: this.hitGood,
        hit_miss: this.hitMiss,

        note_density_2s: this._noteDensity2s(),
        live_notes: this.live.filter(n=>!n.done).length,
        next_note_gap_s: this._nextNoteGap(),

        cal_offset_ms: Math.round(this.calOffsetSec*1000),
        device_type: this.deviceType,

        ai_fatigue_risk: this.aiState ? +(Number(this.aiState.fatigueRisk||0).toFixed(4)) : '',
        ai_skill_score: this.aiState ? +(Number(this.aiState.skillScore||0).toFixed(4)) : '',
        ai_suggest: this.aiState ? (this.aiState.suggestedDifficulty||'') : '',

        ai_locked: (AI.isLocked && AI.isLocked()) ? 1 : 0,
        ai_assist_on: (AI.isAssistEnabled && AI.isAssistEnabled()) ? 1 : 0,

        ai_pressure: +(Number(this.aiPressure||0).toFixed(4)),
        ai_note_speed_mul: +(Number(this.aiNoteSpeedMul||1).toFixed(4)),
        ai_spawn_bias: +(Number(this.aiSpawnBias||1).toFixed(4)),

        label_end_rank: '',        // backfilled at end if needed (kept blank for online logging simplicity)
        label_trial_valid: '',
        label_end_reason: reason || '',

        created_at_iso: new Date().toISOString()
      });
    }

    _maybeLogFeatureSnapshot(){
      if (!this._nextFeatureTs) this._nextFeatureTs = 0;
      if (this.songTime >= this._nextFeatureTs){
        this._nextFeatureTs = this.songTime + 0.40; // ~2.5 Hz
        this._logFeatureSnapshot('tick');
      }
    }

    _finish(endReason) {
      this.running = false;
      this.ended = true;

      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this.audio) this.audio.pause();

      this._logFeatureSnapshot('end');

      const dur = Math.min(this.songTime, this.track.durationSec || this.songTime);
      const totalNotes = this.totalNotes || 1;
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const totalJudged = totalHits + this.hitMiss;

      const acc = totalJudged ? ((totalJudged - this.hitMiss) / totalNotes) * 100 : 0;

      const mOffset = this.offsets.length ? mean(this.offsets) : 0;
      const sOffset = this.offsets.length ? std(this.offsets) : 0;
      const mAbs = this.offsetsAbs.length ? mean(this.offsetsAbs) : 0;

      const earlyPct = totalHits ? (this.earlyHits / totalHits) * 100 : 0;
      const latePct  = totalHits ? (this.lateHits  / totalHits) * 100 : 0;
      const leftHitPct  = totalHits ? (this.leftHits  / totalHits) * 100 : 0;
      const rightHitPct = totalHits ? (this.rightHits / totalHits) * 100 : 0;

      const feverTimePct = dur > 0 ? (this.feverTotalTimeSec / dur) * 100 : 0;

      const rank =
        acc >= 95 ? 'SSS' :
        acc >= 90 ? 'SS'  :
        acc >= 85 ? 'S'   :
        acc >= 75 ? 'A'   :
        acc >= 65 ? 'B'   : 'C';

      const trialValid = totalJudged >= 10 && acc >= 40 ? 1 : 0;

      const AI = this._aiApi();
      const aiLocked = (AI.isLocked && AI.isLocked()) ? 1 : 0;
      const aiAssistOn = (AI.isAssistEnabled && AI.isAssistEnabled()) ? 1 : 0;

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
        hit_great:   this.hitGreat,
        hit_good:    this.hitGood,
        hit_miss:    this.hitMiss,

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
        time_to_first_fever_s: this.timeToFirstFeverSec != null ? this.timeToFirstFeverSec : '',

        hp_start: 100,
        hp_end: this.hp,
        hp_min: this.hpMin,
        hp_under50_time_s: this.hpUnder50Time,

        boss_enabled: this.bossEnabled ? 1 : 0,
        boss_defeated: this._bossDefeated ? 1 : 0,
        boss_phase_max: this._bossPhaseMax || 0,
        boss_hp_damage_dealt: this._bossHpDamageDealt || 0,
        boss_pressure_events: this._bossPressureEvents || 0,

        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,

        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: aiLocked,
        ai_assist_on: aiAssistOn,
        ai_pressure_mean: this._aiPressureSamples.length ? mean(this._aiPressureSamples) : 0,
        ai_note_speed_mul_mean: this._aiNoteSpeedSamples.length ? mean(this._aiNoteSpeedSamples) : 1,
        ai_spawn_bias_mean: this._aiSpawnBiasSamples.length ? mean(this._aiSpawnBiasSamples) : 1,

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
        bossEnabled: this.bossEnabled ? 1 : 0,
        bossDefeated: this._bossDefeated ? 1 : 0,
        bossPhaseMax: this._bossPhaseMax || 0,
        bossDamage: this._bossHpDamageDealt || 0,
        bossPressureEvents: this._bossPressureEvents || 0,
        aiLocked,
        aiAssistOn,
        aiPressureMean: this._aiPressureSamples.length ? mean(this._aiPressureSamples) : 0,
        aiNoteSpeedMulMean: this._aiNoteSpeedSamples.length ? mean(this._aiNoteSpeedSamples) : 1,
        aiSpawnBiasMean: this._aiSpawnBiasSamples.length ? mean(this._aiSpawnBiasSamples) : 1,
        qualityNote: trialValid ? '' : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        this.hooks.onEnd(summary);
      }
    }

    // ---- public CSV ----
    getEventsCsv(){ return this.eventsTable.toCsv(); }
    getSessionCsv(){ return this.sessionTable.toCsv(); }
    getFeatureCsv(){ return this.featureTable.toCsv(); } // ✅ NEW for ML/DL training data export
  }

  WIN.RhythmBoxerEngine = RhythmBoxerEngine;
})();