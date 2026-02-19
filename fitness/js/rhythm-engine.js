// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION (cVR/PC/Mobile) + AI Prediction + Mixed Boss + CSV + Cloud Logger (?log=)
// ✅ Notes fall to hit line (visual sync, hit line anchored at bottom via CSS var)
// ✅ 5-lane default (works with 3-lane too if HTML/CSS reduce lanes)
// ✅ Calibration offset (Cal: ms) + UI buttons call adjustCalMs()
// ✅ Research/Test lock: prediction shown but NO adaptive changes
// ✅ Normal assist: enable with ?ai=1 (prediction + mixed boss tuning)
// ✅ Events CSV + Sessions CSV
// ✅ r1: authored beatmap (not random) for research repeatability
// ✅ Cloud Logger: POST to Apps Script Web App via ?log=... (sessions+events snapshots)
// PACK v20260219a

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b, v));
  const clamp01 = (v)=>clamp(v,0,1);

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

  function lerp(a,b,t){ return a + (b-a)*t; }

  // ---- query helpers ----
  function qs(name, def=''){
    try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
  }

  async function postJson(url, obj){
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' }, // Apps Script friendly
        body: JSON.stringify(obj)
      });
      return !!res.ok;
    }catch(_){
      return false;
    }
  }

  // ---- deterministic RNG ----
  function makeRng(seedStr){
    let s = 2166136261 >>> 0;
    for(let i=0;i<seedStr.length;i++){
      s ^= seedStr.charCodeAt(i);
      s = Math.imul(s, 16777619) >>> 0;
    }
    function u32(){
      s ^= (s << 13); s >>>= 0;
      s ^= (s >>> 17); s >>>= 0;
      s ^= (s << 5);  s >>>= 0;
      return s >>> 0;
    }
    return {
      next(){ return u32() / 4294967296; },
      pick(arr){ return arr[Math.floor((u32()/4294967296)*arr.length)]; }
    };
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
    n1: { id:'n1', name:'Warm-up Groove', bpm:100, diff:'easy',   durationSec: 60, audio: './audio/warmup-groove.mp3' },
    n2: { id:'n2', name:'Focus Combo',    bpm:120, diff:'normal', durationSec: 60, audio: './audio/focus-combo.mp3' },
    n3: { id:'n3', name:'Speed Rush',     bpm:140, diff:'hard',   durationSec: 60, audio: './audio/speed-rush.mp3' },
    r1: { id:'r1', name:'Research Track 120', bpm:120, diff:'normal', durationSec: 60, audio: './audio/research-120.mp3' }
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

    let t = 2.0; // lead-in

    function barPattern(pattern){
      for(const it of pattern){
        const off = it[0];
        const lanes = it[1];
        for(const ln of lanes) push(t + off, ln);
      }
      t += 4*beat;
    }

    // SECTION A (8 bars)
    const A1 = [[0*beat,[2]],[1*beat,[1]],[2*beat,[3]],[3*beat,[2]]];
    const A2 = [[0*beat,[0]],[1*beat,[2]],[2*beat,[4]],[3*beat,[2]]];
    for(let i=0;i<4;i++) barPattern(A1);
    for(let i=0;i<4;i++) barPattern(A2);

    // SECTION B (8 bars)
    const B1 = [[0*beat,[1]],[0*beat+e,[3]],[1*beat,[2]],[2*beat,[0]],[2*beat+e,[4]],[3*beat,[2]]];
    const B2 = [[0*beat,[2]],[1*beat,[1,3]],[2*beat,[0,4]],[3*beat,[2]]];
    for(let i=0;i<4;i++) barPattern(B1);
    for(let i=0;i<4;i++) barPattern(B2);

    // SECTION C (6 bars)
    const C1 = [[0*beat,[0]],[0*beat+e,[1]],[1*beat,[2]],[1*beat+e,[3]],[2*beat,[4]],[3*beat,[2]]];
    for(let i=0;i<6;i++) barPattern(C1);

    // SECTION D (4 bars)
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
      this.calOffsetSec = 0; // + => hits judged later

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

      // offsets analytics (sec)
      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;
      this.leftHits = 0;
      this.rightHits = 0;

      // fever
      this.fever = 0; // 0..1
      this.feverEntryCount = 0;
      this.feverActive = false;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;

      // AI (prediction)
      this.aiState = null;
      this._aiNext = 0;
      this._aiTipNext = 0;
      this._coachNext = 0;

      // ai flags from URL
      this.aiAssistOn = String(qs('ai','0')).trim() === '1';
      this.aiLocked = false; // computed per mode/engine

      // notes
      this.laneCount = 5;
      this.notes = [];
      this.noteIdx = 0;
      this.live = [];
      this.noteSpeedSec = 2.20; // lead time (visual fall time)
      this.noteBaseLen = 160;   // px

      // Mixed Boss tuning state
      this.judgeMul = 1.0;
      this.judgeMulTarget = 1.0;
      this.noteSpeedBase = this.noteSpeedSec;
      this.noteSpeedTarget = this.noteSpeedSec;

      this.boss = {
        on:false,
        rng:null,
        startSec:0,
        endSec:0,
        plan: [],
        planIdx: 0,
        cur: null,
        teleDone: false,
        baseNoteSpeed: this.noteSpeedSec,
        baseJudgeMul:  1.0,
        noteSpeedTarget: this.noteSpeedSec,
        judgeMulTarget: 1.0
      };

      // Cloud Logger
      this.logUrl = String(qs('log','') || '').trim();
      this._logQueue = [];
      this._logNextFlush = 0;
      this._logNextSnap = 0;

      // CSV tables (append new cols at end to keep backward-friendly)
      this.sessionId = '';
      this.eventsTable = new CsvTable([
        'session_id','mode','track_id','bpm','difficulty',
        'participant_id','group','note',
        't_s','lane','side',
        'event','judgment','offset_s','score_delta',
        'combo','hp','fever','cal_offset_ms',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        'boss_type','boss_intensity','judge_mul',
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
        'end_reason','duration_sec','device_type',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        'boss_mix_on','boss_plan_json',
        'trial_valid','rank','created_at_iso'
      ]);

      this._bindLaneInput();
      this._detectDeviceType();
    }

    // ✅ calibration APIs
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

      this.fever = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;

      this.aiState = null;
      this._aiNext = 0;
      this._aiTipNext = 0;
      this._coachNext = 0;

      // notes
      this.notes = buildPattern(this.track, this.laneCount);
      this.totalNotes = this.notes.length;
      this.noteIdx = 0;
      this.live.length = 0;

      this._clearNotesDom();

      this.sessionId = this._makeSessionId();
      this.eventsTable.clear();
      this.sessionTable.clear();

      // baselines / tuning reset
      this.noteSpeedBase = this.noteSpeedSec;
      this.noteSpeedTarget = this.noteSpeedSec;
      this.judgeMul = 1.0;
      this.judgeMulTarget = 1.0;

      // AI lock policy
      // - research mode always locked for adaptive changes
      // - normal mode: locked only if external RB_AI says locked (optional)
      this.aiLocked = (this.mode !== 'normal');

      // Mixed Boss plan (deterministic)
      const dur = this.track.durationSec || 60;
      this.boss.on = true; // ✅ ทุกโหมดมีบอส (โชว์ tele + label ได้)
      this.boss.startSec = Math.max(0, dur - 18.0);
      this.boss.endSec   = dur;
      this.boss.teleDone = false;

      const seedKey = `${this.sessionId}|${this.track.id}|${this.laneCount}`;
      this.boss.rng = makeRng(seedKey);
      this.boss.plan = this._buildBossPlan(this.boss.startSec, this.boss.endSec, this.boss.rng);
      this.boss.planIdx = 0;
      this.boss.cur = null;

      // cloud logger queues reset
      this._logQueue.length = 0;
      this._logNextFlush = 0;
      this._logNextSnap = 0;

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

      if(this.hooks && typeof this.hooks.onStart==='function'){
        this.hooks.onStart({ sessionId:this.sessionId, mode:this.mode, track:this.track });
      }
    }

    stop(reason){
      if(!this.running || this.ended) return;
      this._finish(reason || 'manual-stop');
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
      el.dataset.t = String(note.t);
      el.dataset.lane = String(note.lane);

      const diff = this.track.diff || 'normal';
      const base = this.noteBaseLen;
      const mul = (diff==='easy') ? 0.95 : (diff==='hard') ? 1.25 : 1.10;
      const lenPx = Math.round(base * mul);
      el.style.setProperty('--rb-note-len', lenPx + 'px');

      const ico = DOC.createElement('div');
      ico.className = 'rb-note-ico';
      ico.textContent = '🎵';
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

      this._spawnAhead();
      this._updateNotePositions();
      this._resolveTimeoutMiss();

      this._updateAI();
      this._updateBoss();

      this._maybeLogSnapshot();
      this._maybeFlushRemote();

      this._updateHud();
      this._updateBars();
      this._updateCalibrationHud();

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

    _spawnAhead(){
      const lead = this.noteSpeedSec;
      while(this.noteIdx < this.notes.length){
        const n = this.notes[this.noteIdx];
        if(n.t - this.songTime > lead) break;
        this._spawnNote(n);
        this.live.push(n);
        this.noteIdx++;
      }
    }

    _updateNotePositions(){
      const lead = this.noteSpeedSec;
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
          this._applyMiss(n.lane, 'timeout');
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

      const mul = (this.judgeMul && Number.isFinite(this.judgeMul)) ? this.judgeMul : 1.0;
      const wPerfect = 0.045 * mul;
      const wGreat   = 0.080 * mul;
      const wGood    = 0.120 * mul;

      if(best && bestAbs <= wGood){
        const dt = best.dt;
        let judgment = 'good';
        let scoreDelta = 50;

        if(Math.abs(dt) <= wPerfect){ judgment='perfect'; scoreDelta=150; }
        else if(Math.abs(dt) <= wGreat){ judgment='great'; scoreDelta=100; }

        this._applyHit(lane, judgment, dt, scoreDelta);
        this._despawnNote(best.note);
        this.live = this.live.filter(x=>x && !x.done);
      }else{
        this._applyBlankMiss(lane);
      }
    }

    _applyHit(lane, judgment, offsetSec, scoreDelta){
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
      this.score += scoreDelta;

      const add = (judgment==='perfect') ? 0.090 : (judgment==='great') ? 0.060 : 0.035;
      this.fever = clamp01(this.fever + add);

      if(!this.feverActive && this.fever >= 1){
        this.feverActive = true;
        this.feverEntryCount++;
        if(this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = this.songTime;
      }

      if(this.renderer && typeof this.renderer.showHitFx==='function'){
        this.renderer.showHitFx({ lane, judgment, scoreDelta });
      }

      this._logEvent({ event:'hit', lane, judgment, offset_s: offsetSec, score_delta: scoreDelta });
    }

    _applyMiss(lane, kind){
      this.hitMiss++;
      this.combo = 0;

      const dmg = (kind==='timeout') ? 10 : 8;
      this.hp = Math.max(0, this.hp - dmg);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this.fever = clamp01(this.fever - 0.10);
      if(this.feverActive && this.fever < 0.60) this.feverActive = false;

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

      const dmg = 5;
      this.hp = Math.max(0, this.hp - dmg);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this.fever = clamp01(this.fever - 0.06);
      if(this.feverActive && this.fever < 0.60) this.feverActive = false;

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

    _logEvent(e){
      // external AI module can override lock/assist states
      const extLocked = (WIN.RB_AI && WIN.RB_AI.isLocked && WIN.RB_AI.isLocked()) ? 1 : 0;
      const extAssist = (WIN.RB_AI && WIN.RB_AI.isAssistEnabled && WIN.RB_AI.isAssistEnabled()) ? 1 : 0;

      // engine truth
      const aiLocked = (this.mode !== 'normal') ? 1 : (extLocked ? 1 : 0);
      const aiAssist = (this.aiAssistOn || extAssist) ? 1 : 0;

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
        lane: e.lane,
        side: (this.laneCount===3)
          ? (e.lane===1 ? 'C' : (e.lane===0?'L':'R'))
          : (e.lane<2 ? 'L' : (e.lane===2?'C':'R')),

        event: e.event,
        judgment: e.judgment || '',
        offset_s: (e.offset_s===''? '' : (Number.isFinite(e.offset_s)? e.offset_s.toFixed(4): '')),
        score_delta: e.score_delta,

        combo: this.combo,
        hp: this.hp,
        fever: this.fever.toFixed(3),
        cal_offset_ms: Math.round(this.calOffsetSec*1000),

        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: aiLocked,
        ai_assist_on: aiAssist,

        boss_type: (this.boss && this.boss.cur) ? this.boss.cur.type : '',
        boss_intensity: (this.boss && this.boss.cur) ? this.boss.cur.intensity : '',
        judge_mul: (this.judgeMul && Number.isFinite(this.judgeMul)) ? +this.judgeMul.toFixed(3) : 1.0,

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
        const acc = judged ? (hit / (this.totalNotes||1)) * 100 : 0;
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
    }

    _updateCalibrationHud(){
      const el = DOC.querySelector('#rb-hud-cal');
      if(el){
        el.textContent = `${Math.round(this.calOffsetSec*1000)}ms`;
      }
    }

    _emitCoach(kind, title, msg){
      // rate limit: max 1 per 1.2s
      const t = this.songTime || 0;
      if(t < (this._coachNext||0)) return;
      this._coachNext = t + 1.2;

      // reuse aiTip HUD (simple + safe)
      if(this.hud && this.hud.aiTip){
        this.hud.aiTip.textContent = `${title} — ${msg}`;
        this.hud.aiTip.classList.toggle('hidden', false);
      }
    }

    _updateAI(){
      const t = this.songTime;
      if(t < this._aiNext) return;
      this._aiNext = t + 0.40;

      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hit = judged - this.hitMiss;
      const accPct = judged ? (hit / (this.totalNotes||1)) * 100 : 0;

      const snap = {
        accPct,
        hitMiss: this.hitMiss,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        combo: this.combo,
        offsetAbsMean: this.offsetsAbs.length ? mean(this.offsetsAbs) : null,
        hp: this.hp,
        songTime: this.songTime,
        durationSec: this.track.durationSec || 60
      };

      if(WIN.RB_AI && typeof WIN.RB_AI.predict === 'function'){
        this.aiState = WIN.RB_AI.predict(snap);
      }else{
        // baseline heuristic prediction
        const fatigueRisk = clamp01((this.hitMiss/Math.max(1, judged)) * 2.2);
        const skillScore  = clamp01((accPct/100) * 0.9 + clamp01(this.maxCombo/60)*0.1);
        const tip =
          (this.hitMiss>=6) ? 'ชะลอมือ: มองเส้น hit แล้วกดค่อย ๆ ให้ตรงจังหวะ' :
          (accPct<70) ? 'ลอง “คุมคอมโบ” ก่อนความเร็ว: เน้น Great/Perfect' :
          '';
        this.aiState = { fatigueRisk, skillScore, suggestedDifficulty:'normal', tip };
      }

      // lock policy
      const extLocked = (WIN.RB_AI && WIN.RB_AI.isLocked && WIN.RB_AI.isLocked()) ? true : false;
      const extAssist = (WIN.RB_AI && WIN.RB_AI.isAssistEnabled && WIN.RB_AI.isAssistEnabled()) ? true : false;
      this.aiLocked = (this.mode !== 'normal') ? true : extLocked;
      this.aiAssistOn = this.aiAssistOn || extAssist;

      if(this.aiState){
        if(t >= this._aiTipNext){
          this._aiTipNext = t + 2.5;
        }else{
          if(!this.aiState.tip) this.aiState.tip = '';
        }
      }
      // IMPORTANT: no adaptive changes here (research lock)
    }

    // ===== Mixed Boss (deterministic) =====
    _buildBossPlan(tStart, tEnd, rng){
      const plan = [];
      let t = tStart;
      while(t < tEnd){
        const seg = 2.0 + rng.next()*1.5; // 2.0..3.5
        const t0 = t;
        const t1 = Math.min(tEnd, t + seg);

        const r = rng.next();
        let type = 'burst';
        if(r < 0.20) type = 'fake';
        else if(r < 0.42) type = 'breath';
        else type = 'burst';

        const intensity = (type==='burst')
          ? (0.55 + rng.next()*0.45)
          : (type==='breath')
            ? (0.25 + rng.next()*0.25)
            : (0.30 + rng.next()*0.40);

        plan.push({ t0, t1, type, intensity: +intensity.toFixed(3) });
        t = t1;
      }
      return plan;
    }

    _updateBoss(){
      const t = this.songTime;
      if(!this.boss.on) return;

      // telegraph 1s before boss start (ทุกโหมดได้)
      if(!this.boss.teleDone && t >= (this.boss.startSec - 1.0) && t < (this.boss.startSec + 0.2)){
        this.boss.teleDone = true;
        this._emitCoach('tele', '👑 MIXED BOSS APPROACH', 'ท้ายเพลงจะมี Burst/พัก/หลอกจังหวะ — ตั้งสติและคุมคอมโบ');
      }

      if(t < this.boss.startSec || t > this.boss.endSec){
        // recover to baseline smoothly
        this.noteSpeedTarget = this.noteSpeedBase;
        this.judgeMulTarget  = 1.0;
        this.noteSpeedSec = lerp(this.noteSpeedSec, this.noteSpeedTarget, 0.06);
        this.judgeMul     = lerp(this.judgeMul,     this.judgeMulTarget,  0.08);
        return;
      }

      // pick current segment
      while(this.boss.planIdx < this.boss.plan.length && t > this.boss.plan[this.boss.planIdx].t1){
        this.boss.planIdx++;
      }
      const seg = this.boss.plan[Math.min(this.boss.planIdx, this.boss.plan.length-1)];
      this.boss.cur = seg;

      // segment telegraph (ไม่ถี่)
      if(seg && seg.type === 'fake' && (t - seg.t0) < 0.15){
        this._emitCoach('tele', '⚡ FAKE SHIFT', 'หลอกจังหวะ! อย่ารีบกดตามสายตา ให้ฟังจังหวะ/ดูเส้น hit');
      }else if(seg && seg.type === 'burst' && (t - seg.t0) < 0.15){
        this._emitCoach('tele', '🔥 BURST', 'ช่วงนี้เร่ง! โฟกัสคอมโบ + กดให้ตรงเส้น');
      }

      // ✅ Test/Research มี “บอส” (โชว์ได้) แต่ LOCK การปรับจริง
      if(this.mode !== 'normal') return;
      if(!this.aiAssistOn || this.aiLocked) return;

      const k = seg ? seg.intensity : 0.6;

      if(seg.type === 'burst'){
        this.noteSpeedTarget = clamp(this.noteSpeedBase - (0.10 + 0.18*k), this.noteSpeedBase - 0.30, this.noteSpeedBase + 0.35);
        this.judgeMulTarget  = clamp(1.0 - (0.06 + 0.12*k), 0.86, 1.05);
      }else if(seg.type === 'breath'){
        this.noteSpeedTarget = clamp(this.noteSpeedBase + (0.04 + 0.10*k), this.noteSpeedBase - 0.30, this.noteSpeedBase + 0.35);
        this.judgeMulTarget  = clamp(1.0 + (0.04 + 0.10*k), 0.86, 1.20);
      }else{ // fake
        const flip = (k > 0.5) ? -1 : 1;
        this.noteSpeedTarget = clamp(this.noteSpeedBase + flip*(0.04 + 0.06*k), this.noteSpeedBase - 0.30, this.noteSpeedBase + 0.35);
        this.judgeMulTarget  = clamp(1.0 + flip*(0.03 + 0.06*k), 0.86, 1.20);
      }

      this.noteSpeedSec = lerp(this.noteSpeedSec, this.noteSpeedTarget, 0.08);
      this.judgeMul     = lerp(this.judgeMul,     this.judgeMulTarget,  0.10);
    }

    // ===== ML/DL-ready feature snapshot + Cloud Logger =====
    _makeFeatureSnapshot(){
      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hit = judged - this.hitMiss;
      const accPct = judged ? (hit / (this.totalNotes||1)) * 100 : 0;

      const dur = this.track.durationSec || 60;
      const prog = dur>0 ? clamp01(this.songTime / dur) : 0;

      const mAbs = this.offsetsAbs.length ? mean(this.offsetsAbs) : null;

      return {
        type: 'event',
        _table: 'events',

        timestampIso: new Date().toISOString(),
        projectTag: 'HeroHealth-Fitness',
        runMode: this.mode,
        sessionId: this.sessionId,

        eventType: 'feature_snapshot',
        gameMode: 'rhythm-boxer',
        diff: this.track.diff,
        timeFromStartMs: Math.round(this.songTime*1000),

        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo,
        hp: this.hp,
        feverValue: +this.fever.toFixed(3),
        progress: +prog.toFixed(3),

        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        accPct: +accPct.toFixed(2),

        offsetAbsMeanS: (mAbs==null? '' : +mAbs.toFixed(4)),
        calOffsetMs: Math.round(this.calOffsetSec*1000),

        bossType: (this.boss && this.boss.cur) ? this.boss.cur.type : '',
        bossIntensity: (this.boss && this.boss.cur) ? this.boss.cur.intensity : '',
        judgeMul: +((this.judgeMul && Number.isFinite(this.judgeMul)) ? this.judgeMul.toFixed(3) : '1.000'),

        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: this.aiLocked ? 1 : 0,
        ai_assist_on: this.aiAssistOn ? 1 : 0,

        participant_id: this.meta.id || '',
        group: this.meta.group || '',
        note: this.meta.note || ''
      };
    }

    _maybeLogSnapshot(){
      if(!this.running || this.ended) return;
      if(this.songTime < this._logNextSnap) return;
      this._logNextSnap = (this._logNextSnap || 0) + 0.50;

      const snap = this._makeFeatureSnapshot();

      // local CSV marker (optional)
      this._logEvent({
        event:'feature_snapshot',
        lane:'',
        judgment:'',
        offset_s:'',
        score_delta:''
      });

      if(this.logUrl){
        this._logQueue.push(snap);
      }
    }

    async _maybeFlushRemote(){
      if(!this.logUrl) return;
      if(this.songTime < this._logNextFlush) return;
      this._logNextFlush = (this._logNextFlush || 0) + 2.0;

      if(!this._logQueue.length) return;

      const batch = this._logQueue.splice(0, 10);
      for(const ev of batch){
        await postJson(this.logUrl, ev);
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

        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,

        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
        ai_locked: this.aiLocked ? 1 : 0,
        ai_assist_on: this.aiAssistOn ? 1 : 0,

        boss_mix_on: this.boss.on ? 1 : 0,
        boss_plan_json: (this.boss && this.boss.plan) ? JSON.stringify(this.boss.plan) : '',

        trial_valid: trialValid,
        rank,
        created_at_iso: new Date().toISOString()
      };

      this.sessionTable.add(sessionRow);

      // send session summary to remote sessions sheet
      if(this.logUrl){
        const payload = Object.assign({}, sessionRow, {
          _table: 'sessions',
          type: 'session',
          timestampIso: new Date().toISOString(),
          projectTag: 'HeroHealth-Fitness',
          runMode: this.mode,
          gameMode: 'rhythm-boxer',
          diff: this.track.diff
        });
        // fire & forget
        postJson(this.logUrl, payload);
      }

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

    // ---- public CSV ----
    getEventsCsv(){ return this.eventsTable.toCsv(); }
    getSessionCsv(){ return this.sessionTable.toCsv(); }
  }

  WIN.RhythmBoxerEngine = RhythmBoxerEngine;
})();