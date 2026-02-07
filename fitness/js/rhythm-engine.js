// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION (cVR/PC/Mobile) + AI Prediction (locked in research) + CSV
// ✅ PATCH A: Note travel anchored to CSS hitline-bottom (real hit line position)
// ✅ PATCH B: Mobile-friendly lead time (noteSpeedSec) + miss grace at beginning
// ✅ Notes fall to hit line (visual sync)
// ✅ Research lock: prediction shown but no adaptive changes
// ✅ Normal assist: enable with ?ai=1
// ✅ Events CSV + Sessions CSV

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
    add(row){ this.rows.push(Object.assign({}, row)); }
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
    n2: { id:'n2', name:'Focus Combo',     bpm:120, diff:'normal', durationSec: 60, audio: './audio/focus-combo.mp3' },
    n3: { id:'n3', name:'Speed Rush',      bpm:140, diff:'hard',   durationSec: 60, audio: './audio/speed-rush.mp3' },
    r1: { id:'r1', name:'Research Track 120', bpm:120, diff:'normal', durationSec: 60, audio: './audio/research-120.mp3' }
  };

  // ---- Note patterns (placeholder timeline; replace with authored beat map later) ----
  function buildPattern(track, laneCount){
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

    // ✅ PATCH: start later so player sees notes + HUD settles (reduces early auto-miss feeling)
    const startT = 3.2;

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

  function cssNum(el, prop, fallback){
    try{
      const v = getComputedStyle(el).getPropertyValue(prop);
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    }catch(_){
      return fallback;
    }
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

      // offsets analytics (sec)
      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;
      this.leftHits = 0;
      this.rightHits = 0;

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

      // notes
      this.laneCount = 5;
      this.notes = [];
      this.noteIdx = 0;
      this.live = [];

      // ✅ PATCH: mobile-friendly lead time (more time to see & hit)
      this.noteSpeedSec = 2.80;

      this.noteBaseLen = 160;

      // ✅ PATCH: early grace period for timeout-miss (sec)
      this.missGraceSec = 2.0;

      // CSV tables
      this.sessionId = '';
      this.eventsTable = new CsvTable([
        'session_id','mode','track_id','bpm','difficulty',
        'participant_id','group','note',
        't_s','lane','side',
        'event','judgment','offset_s','score_delta',
        'combo','hp','fever','cal_offset_ms',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
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
        'trial_valid','rank','created_at_iso'
      ]);

      this._bindLaneInput();
      this._detectDeviceType();
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

      // pointerdown per lane
      this.lanesEl.addEventListener('pointerdown', (ev)=>{
        const laneEl = ev.target && ev.target.closest ? ev.target.closest('.rb-lane') : null;
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if(!Number.isFinite(lane)) return;
        this.hitLane(lane, 'tap');
      }, {passive:true});

      // keyboard
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

      // ✅ PATCH: adjust lead time a bit by device
      this.noteSpeedSec = (this.deviceType === 'mobile') ? 3.05 : 2.70;

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

      this.notes = buildPattern(this.track, this.laneCount);
      this.totalNotes = this.notes.length;
      this.noteIdx = 0;
      this.live.length = 0;

      this._clearNotesDom();

      this.sessionId = this._makeSessionId();
      this.eventsTable.clear();

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
      ico.textContent = '🥊';
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
      this._updateHud();
      this._updateBars();

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
      // ✅ PATCH A: anchor travel to REAL hit line using CSS --rb-hitline-bottom
      // Note element itself already anchored at hitline (bottom: calc(hitline-bottom + thickness/2))
      // We only need translateY so that it starts above and reaches 0 at hit time.

      const lead = this.noteSpeedSec;
      if(!this.lanesEl) return;

      for(const n of this.live){
        if(!n.spawned || !n.el) continue;

        const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if(!laneEl) continue;

        const rect = laneEl.getBoundingClientRect();
        const laneH = rect.height || 520;

        const hitlineBottom = cssNum(laneEl, '--rb-hitline-bottom', 72);
        const hitlineY = laneH - hitlineBottom; // from top to hitline

        // start above top: add extra so note head begins off-screen then enters smoothly
        const extraStart = Math.max(120, hitlineY * 0.20);
        const travel = hitlineY + extraStart;

        const p = (this.songTime - (n.t - lead)) / lead; // 0..1
        const pClamp = clamp01(p);

        const y = (pClamp - 1) * travel; // -travel .. 0
        n.el.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;

        // fade in slightly at the start to avoid pop
        n.el.style.opacity = (pClamp < 0.03) ? '0' : '1';
      }
    }

    _resolveTimeoutMiss(){
      // if note passed beyond miss window => MISS
      const missLate = 0.22;

      const keep = [];
      for(const n of this.live){
        if(n.done) continue;

        const dt = (this.songTime - n.t) - this.calOffsetSec;

        // ✅ PATCH B: grace period near game start (avoid “miss ไหล” ตอนยังตั้งตัว)
        if(this.songTime < this.missGraceSec){
          keep.push(n);
          continue;
        }

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

      const wPerfect = 0.045;
      const wGreat   = 0.080;
      const wGood    = 0.120;

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

      this._logEvent({
        event: 'hit',
        lane,
        judgment,
        offset_s: offsetSec,
        score_delta: scoreDelta
      });
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
      const aiLocked = (WIN.RB_AI && WIN.RB_AI.isLocked && WIN.RB_AI.isLocked()) ? 1 : 0;
      const aiAssist = (WIN.RB_AI && WIN.RB_AI.isAssistEnabled && WIN.RB_AI.isAssistEnabled()) ? 1 : 0;

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
        this.aiState = { fatigueRisk:0, skillScore:0.5, suggestedDifficulty:'normal', tip:'' };
      }

      if(this.aiState){
        if(t >= this._aiTipNext){
          this._aiTipNext = t + 2.5;
        }else{
          if(!this.aiState.tip) this.aiState.tip = '';
        }
      }
      // research lock: no adaptive changes
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
        time_to_first_fever_s: (this.timeToFirstFeverSec != null ? this.timeToFirstFeverSec : ''),

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
        ai_locked: (WIN.RB_AI && WIN.RB_AI.isLocked && WIN.RB_AI.isLocked()) ? 1 : 0,
        ai_assist_on: (WIN.RB_AI && WIN.RB_AI.isAssistEnabled && WIN.RB_AI.isAssistEnabled()) ? 1 : 0,

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

    getEventsCsv(){ return this.eventsTable.toCsv(); }
    getSessionCsv(){ return this.sessionTable.toCsv(); }
  }

  WIN.RhythmBoxerEngine = RhythmBoxerEngine;
})();