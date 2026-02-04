// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION-ish (DOM)
// ✅ Notes fall to hitline (physics by time)
// ✅ Perfect/Great/Good/Miss judgment by timing window
// ✅ CSV: events + sessions
// ✅ FEVER + HP
// ✅ AI snapshot (prediction only; assist gated by RB_AI)
// ✅ Calibration offset (ms) from localStorage: RB_CAL_OFFSET_MS
'use strict';

(function(){
  // ----- helpers -----
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const mean = (arr)=> arr.reduce((s,x)=>s+x,0) / (arr.length||1);
  const std = (arr)=>{
    const m = mean(arr);
    const v = mean(arr.map(x=>(x-m)*(x-m)));
    return Math.sqrt(v);
  };

  function csvEscape(v){
    if(v==null) return '';
    const s = String(v);
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function toCsv(rows){
    if(!rows || !rows.length) return '';
    const keys = Object.keys(rows[0]);
    const head = keys.map(csvEscape).join(',');
    const body = rows.map(r=> keys.map(k=>csvEscape(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  class Table{
    constructor(){ this.rows=[]; }
    add(r){ this.rows.push(r); }
    csv(){ return toCsv(this.rows); }
    clear(){ this.rows.length=0; }
  }

  // ----- Track presets (no audio files required; can plug later) -----
  const TRACKS = {
    n1: { id:'n1', name:'Warm-up Groove', bpm:100, diff:'easy',   durationSec:45 },
    n2: { id:'n2', name:'Focus Combo',    bpm:120, diff:'normal', durationSec:50 },
    n3: { id:'n3', name:'Speed Rush',     bpm:140, diff:'hard',   durationSec:55 },
    r1: { id:'r1', name:'Research Track 120', bpm:120, diff:'normal', durationSec:60 }
  };

  // ----- constants -----
  const HITLINE_PX_FROM_BOTTOM = 72; // must match CSS vibe (not required but aligned)
  const NOTE_START_PAD_TOP = -40;    // start slightly above lane
  const FALL_TIME_SEC = 1.15;        // how long note takes to travel (tune to feel)
  const SPAWN_AHEAD_SEC = 1.55;      // spawn ahead so it visually falls before hit
  const BLANK_TAP_PENALTY = 1;       // small penalty to avoid spam

  const WINDOW = {
    perfect: 0.055,  // seconds
    great:   0.090,
    good:    0.125
  };

  function readCalOffsetMs(){
    try{
      const v = localStorage.getItem('RB_CAL_OFFSET_MS');
      const n = Number(v);
      if(Number.isFinite(n)) return clamp(n, -180, 180);
    }catch(_){}
    return 0;
  }

  class RhythmBoxerEngine{
    constructor(opts){
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio || null; // optional
      this.renderer = opts.renderer || null;
      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      this.sessionTable = new Table();
      this.eventTable = new Table();

      this._rafId = null;

      this.resetAll();
      this._bindLaneInput();
    }

    resetAll(){
      this.running = false;
      this.ended = false;

      this.mode = 'normal';
      this.track = TRACKS.n1;
      this.meta = {};

      this.sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      this.songStartMs = 0;
      this.songTime = 0;

      // game stats
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.totalNotes = 0;

      // timing offsets
      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits = 0;

      // side (for future)
      this.leftHits = 0;
      this.rightHits = 0;

      // hp / fever
      this.hp = 100;
      this.hpMin = 100;
      this.hpUnder50Time = 0;
      this._hpUnder50Start = null;

      this.fever = 0; // 0..1
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this._feverEnterTime = null;
      this.timeToFirstFeverSec = null;

      // AI
      this.aiState = null;
      this._lastAiUpdateMs = 0;

      // calibration
      this.calOffsetMs = readCalOffsetMs();

      // notes
      this.notes = []; // {id,lane,tHit,spawned,el,judged,hit}
      this._noteId = 0;

      // device type (best effort)
      this.deviceType = this._detectDeviceType();
    }

    setCalibrationOffsetMs(ms){
      this.calOffsetMs = clamp(ms, -180, 180);
    }

    _detectDeviceType(){
      try{
        const sp = new URL(location.href).searchParams;
        const view = (sp.get('view')||'').toLowerCase();
        if(view === 'cvr') return 'cvr';
      }catch(_){}
      // fallback
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      return isTouch ? 'mobile' : 'pc';
    }

    _bindLaneInput(){
      if(!this.lanesEl) return;
      // pointerdown on each lane
      this.lanesEl.addEventListener('pointerdown', (e)=>{
        const laneEl = e.target && e.target.closest ? e.target.closest('.rb-lane') : null;
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if(!Number.isFinite(lane)) return;
        this.handleLaneTap(lane);
      }, {passive:true});
    }

    start(mode, trackId, meta){
      this.resetAll();

      this.mode = (mode === 'research') ? 'research' : 'normal';
      this.track = TRACKS[trackId] || TRACKS.n1;
      this.meta = meta || {};

      // update calibration from storage every run (in case user recalibrates)
      this.calOffsetMs = readCalOffsetMs();

      // build note chart
      this._buildChart();

      this.running = true;
      this.ended = false;
      this.songStartMs = nowMs();
      this.songTime = 0;

      // optional audio (if later you add tracks)
      if(this.audio){
        try{
          this.audio.pause();
          this.audio.currentTime = 0;
          this.audio.play().catch(()=>{});
        }catch(_){}
      }

      this._tick();
    }

    stop(reason){
      if(!this.running || this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    // build schedule of hit times (simple pattern; replace with chart later)
    _buildChart(){
      const bpm = this.track.bpm || 120;
      const beat = 60 / bpm;
      const dur = this.track.durationSec || 50;

      // density depends on difficulty
      let every = 1; // beats per note
      if(this.track.diff === 'easy') every = 1.5;
      else if(this.track.diff === 'hard') every = 0.75;

      const lanes = 5; // current design
      let t = 2.0;     // start after 2s warmup
      let lane = 2;    // start center-ish

      while(t < dur - 0.5){
        // lane wiggle pattern
        const r = Math.random();
        if(r < 0.33) lane = clamp(lane + 1, 0, lanes-1);
        else if(r < 0.66) lane = clamp(lane - 1, 0, lanes-1);

        this.notes.push({
          id: ++this._noteId,
          lane,
          tHit: t,
          spawned:false,
          el:null,
          judged:false,
          hit:false
        });

        this.totalNotes++;
        t += beat * every;

        // occasional doubles on hard
        if(this.track.diff === 'hard' && Math.random() < 0.18 && t < dur - 0.6){
          const lane2 = clamp(lane + (Math.random()<0.5?-1:1), 0, lanes-1);
          this.notes.push({
            id: ++this._noteId,
            lane: lane2,
            tHit: t,
            spawned:false,
            el:null,
            judged:false,
            hit:false
          });
          this.totalNotes++;
        }
      }
    }

    // create DOM element for note, inside lane
    _spawnNote(n){
      const laneEl = this.lanesEl && this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
      if(!laneEl) return;

      const el = document.createElement('div');
      el.className = `rb-note lane-${n.lane}`;
      el.dataset.noteId = String(n.id);
      el.style.top = NOTE_START_PAD_TOP + 'px';

      laneEl.appendChild(el);
      n.el = el;
      n.spawned = true;
    }

    // update note position based on time
    _updateNote(n, tNow){
      if(!n.spawned || !n.el) return;

      const laneEl = n.el.parentElement;
      if(!laneEl) return;

      const laneH = laneEl.clientHeight || 300;
      const hitY = laneH - HITLINE_PX_FROM_BOTTOM;

      // note should reach hitY at tHit
      // we spawn at (tHit - SPAWN_AHEAD), and fall over FALL_TIME, but also keep stable if spawnAhead differs
      const tSpawn = n.tHit - SPAWN_AHEAD_SEC;
      const dt = (tNow - tSpawn); // seconds since spawn moment
      const p = clamp(dt / FALL_TIME_SEC, 0, 1.15); // allow slight overshoot

      const y = NOTE_START_PAD_TOP + p * (hitY - NOTE_START_PAD_TOP);
      n.el.style.top = y + 'px';

      // auto-judge miss after passing hit window
      if(!n.judged){
        const tRel = tNow - n.tHit;
        if(tRel > WINDOW.good){
          // missed
          this._applyMiss(n, 'timeout');
        }
      }

      // remove if far past bottom
      if(p > 1.12){
        try{ n.el.remove(); }catch(_){}
        n.el = null;
      }
    }

    handleLaneTap(lane){
      if(!this.running || this.ended) return;

      const tNow = this.songTime;
      // find nearest unjudged note on this lane within good window
      let best = null;
      let bestAbs = 999;

      for(const n of this.notes){
        if(n.lane !== lane) continue;
        if(n.judged) continue;
        const d = tNow - n.tHit;
        const ad = Math.abs(d);
        if(ad < bestAbs){
          bestAbs = ad;
          best = n;
        }
      }

      if(best && bestAbs <= WINDOW.good){
        this._applyHit(best, tNow - best.tHit);
      }else{
        // blank tap
        this.score = Math.max(0, this.score - BLANK_TAP_PENALTY);
        this.combo = 0;
        this._emitEvent('blank_tap', { lane });
        if(this.renderer && this.renderer.showMissFx){
          this.renderer.showMissFx({ lane });
        }
      }

      this._syncHud();
    }

    _judge(offsetSec){
      const a = Math.abs(offsetSec);
      if(a <= WINDOW.perfect) return 'perfect';
      if(a <= WINDOW.great)   return 'great';
      return 'good';
    }

    _applyHit(n, offsetSecRaw){
      if(n.judged) return;
      n.judged = true;
      n.hit = true;

      // apply calibration: positive ms means user taps late? we offset timing to align judgement
      const calSec = (Number(this.calOffsetMs)||0) / 1000;
      const offsetSec = offsetSecRaw - calSec;

      const j = this._judge(offsetSec);

      // score delta
      let delta = 5;
      if(j === 'perfect') delta = 10;
      else if(j === 'great') delta = 7;

      // fever gain
      const feverGain = (j === 'perfect') ? 0.045 : (j === 'great') ? 0.032 : 0.022;
      this.fever = clamp(this.fever + feverGain, 0, 1);

      // combo
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // apply
      this.score += delta;

      if(j === 'perfect') this.hitPerfect++;
      else if(j === 'great') this.hitGreat++;
      else this.hitGood++;

      // offset stats
      this.offsets.push(offsetSec);
      this.offsetsAbs.push(Math.abs(offsetSec));
      if(offsetSec < 0) this.earlyHits++; else this.lateHits++;

      // remove note
      if(n.el){
        try{ n.el.remove(); }catch(_){}
        n.el = null;
      }

      // renderer
      if(this.renderer && this.renderer.showHitFx){
        this.renderer.showHitFx({ lane:n.lane, judgment:j, scoreDelta:delta });
      }

      this._emitEvent('hit', {
        lane:n.lane,
        judgment:j,
        offset_s: offsetSec,
        cal_ms: this.calOffsetMs
      });

      // fever activation
      if(!this.feverActive && this.fever >= 1){
        this.feverActive = true;
        this.feverEntryCount++;
        this._feverEnterTime = this.songTime;
        if(this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = this.songTime;
      }
    }

    _applyMiss(n, kind){
      if(n.judged) return;
      n.judged = true;
      n.hit = false;

      this.hitMiss++;
      this.combo = 0;

      // hp loss
      const dmg = (this.track.diff === 'hard') ? 9 : (this.track.diff === 'easy') ? 6 : 7;
      this.hp = clamp(this.hp - dmg, 0, 100);
      this.hpMin = Math.min(this.hpMin, this.hp);

      // fever decay on miss
      this.fever = clamp(this.fever - 0.06, 0, 1);
      if(this.feverActive && this.fever < 0.25){
        this.feverActive = false;
        if(this._feverEnterTime != null){
          this.feverTotalTimeSec += (this.songTime - this._feverEnterTime);
          this._feverEnterTime = null;
        }
      }

      // hp under 50 time tracking
      if(this.hp < 50 && this._hpUnder50Start == null){
        this._hpUnder50Start = this.songTime;
      }else if(this.hp >= 50 && this._hpUnder50Start != null){
        this.hpUnder50Time += (this.songTime - this._hpUnder50Start);
        this._hpUnder50Start = null;
      }

      if(n.el){
        try{ n.el.remove(); }catch(_){}
        n.el = null;
      }

      if(this.renderer && this.renderer.showMissFx){
        this.renderer.showMissFx({ lane:n.lane });
      }

      this._emitEvent('miss', { lane:n.lane, kind });
      if(this.hp <= 0){
        this._finish('hp-zero');
      }
    }

    _emitEvent(type, payload){
      const row = Object.assign({
        session_id: this.sessionId,
        t_s: this.songTime,
        type
      }, payload || {});
      this.eventTable.add(row);
    }

    _syncHud(){
      const h = this.hud || {};
      if(h.score) h.score.textContent = String(this.score|0);
      if(h.combo) h.combo.textContent = String(this.combo|0);

      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const acc = judged ? ((judged - this.hitMiss) / Math.max(1,this.totalNotes)) * 100 : 0;

      if(h.acc) h.acc.textContent = acc.toFixed(1) + '%';
      if(h.hp) h.hp.textContent = String(this.hp|0);
      if(h.time) h.time.textContent = this.songTime.toFixed(1);

      if(h.countPerfect) h.countPerfect.textContent = String(this.hitPerfect|0);
      if(h.countGreat)   h.countGreat.textContent   = String(this.hitGreat|0);
      if(h.countGood)    h.countGood.textContent    = String(this.hitGood|0);
      if(h.countMiss)    h.countMiss.textContent    = String(this.hitMiss|0);

      if(h.feverFill){
        h.feverFill.style.width = (this.fever*100).toFixed(1) + '%';
      }
      if(h.feverStatus){
        h.feverStatus.textContent = this.feverActive ? 'ACTIVE' : (this.fever>=1?'READY':'BUILD');
      }

      const dur = this.track.durationSec || 50;
      const prog = dur>0 ? clamp(this.songTime/dur,0,1) : 0;
      if(h.progFill) h.progFill.style.width = (prog*100).toFixed(1)+'%';
      if(h.progText) h.progText.textContent = Math.round(prog*100)+'%';

      // AI update throttled
      const t = nowMs();
      if(t - this._lastAiUpdateMs > 220){
        this._lastAiUpdateMs = t;
        this._updateAI(acc);
      }
    }

    _updateAI(accPct){
      if(!window.RB_AI || typeof window.RB_AI.predict !== 'function') return;

      const snap = {
        accPct,
        hitPerfect:this.hitPerfect,
        hitGreat:this.hitGreat,
        hitGood:this.hitGood,
        hitMiss:this.hitMiss,
        combo:this.combo,
        offsetAbsMean: this.offsetsAbs.length ? mean(this.offsetsAbs) : 0,
        hp:this.hp,
        songTime:this.songTime,
        durationSec:this.track.durationSec || 0
      };

      this.aiState = window.RB_AI.predict(snap);

      // UI hook (optional)
      // rhythm-boxer.js has handleAIUpdate() prepared; we just update HUD here if present
      const h = this.hud || {};
      if(h.aiFatigue) h.aiFatigue.textContent = Math.round((this.aiState.fatigueRisk||0)*100)+'%';
      if(h.aiSkill)   h.aiSkill.textContent   = Math.round((this.aiState.skillScore||0)*100)+'%';
      if(h.aiSuggest) h.aiSuggest.textContent = (this.aiState.suggestedDifficulty||'normal');
      if(h.aiTip){
        h.aiTip.textContent = this.aiState.tip || '';
        h.aiTip.classList.toggle('hidden', !this.aiState.tip);
      }
    }

    _tick(){
      if(!this.running || this.ended) return;

      const t = (nowMs() - this.songStartMs) / 1000;
      this.songTime = Math.max(0, t);

      // spawn notes
      for(const n of this.notes){
        if(!n.spawned && (this.songTime >= (n.tHit - SPAWN_AHEAD_SEC))){
          this._spawnNote(n);
        }
      }
      // update notes
      for(const n of this.notes){
        this._updateNote(n, this.songTime);
      }

      // fever time tracking
      if(this.feverActive && this._feverEnterTime != null){
        // accumulate at end only (avoid double count)
      }

      this._syncHud();

      // end by duration
      const dur = this.track.durationSec || 50;
      if(this.songTime >= dur){
        this._finish('time-up');
        return;
      }

      this._rafId = requestAnimationFrame(()=>this._tick());
    }

    _finish(endReason) {
      this.running = false;
      this.ended = true;

      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      if (this.audio) {
        try{ this.audio.pause(); }catch(_){}
      }

      // close fever interval
      if(this.feverActive && this._feverEnterTime != null){
        this.feverTotalTimeSec += (this.songTime - this._feverEnterTime);
        this._feverEnterTime = null;
      }

      // close hp under 50 interval
      if(this._hpUnder50Start != null){
        this.hpUnder50Time += (this.songTime - this._hpUnder50Start);
        this._hpUnder50Start = null;
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
        time_to_first_fever_s:
          this.timeToFirstFeverSec != null ? this.timeToFirstFeverSec : '',

        hp_start: 100,
        hp_end: this.hp,
        hp_min: this.hpMin,
        hp_under50_time_s: this.hpUnder50Time,

        end_reason: endReason,
        duration_sec: dur,
        device_type: this.deviceType,

        // Calibration used
        cal_offset_ms: this.calOffsetMs,

        // AI snapshot at end (prediction only; assist might be off)
        ai_fatigue_risk: this.aiState ? (this.aiState.fatigueRisk ?? '') : '',
        ai_skill_score:  this.aiState ? (this.aiState.skillScore  ?? '') : '',
        ai_suggest:      this.aiState ? (this.aiState.suggestedDifficulty ?? '') : '',
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
        qualityNote: trialValid
          ? ''
          : 'รอบนี้คุณภาพข้อมูลอาจไม่เพียงพอ (hit น้อยหรือ miss เยอะ)'
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        this.hooks.onEnd(summary);
      }
    }

    getEventsCsv(){ return this.eventTable.csv(); }
    getSessionCsv(){ return this.sessionTable.csv(); }
  }

  // ===== expose =====
  window.RhythmBoxerEngine = RhythmBoxerEngine;
})();