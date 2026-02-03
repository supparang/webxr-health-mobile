// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION (patched: cVR note travel + longer pre-spawn + hitline-aligned notes)
// ✅ Notes reach the hit line (y=0 aligns with hitline)
// ✅ cVR/cardboard: longer fall time + longer travel distance
// ✅ Keeps AI prediction logging (prediction-only if research lock)

'use strict';

(function(){
  const WIN = window;

  // ----- tiny utils -----
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const clamp01 = (v)=>clamp(v,0,1);
  const nowMs = ()=> (WIN.performance && performance.now) ? performance.now() : Date.now();

  function mean(arr){
    if(!arr || !arr.length) return 0;
    let s=0; for(const x of arr) s += x;
    return s/arr.length;
  }
  function std(arr){
    if(!arr || arr.length<2) return 0;
    const m = mean(arr);
    let s=0; for(const x of arr){ const d=x-m; s += d*d; }
    return Math.sqrt(s/(arr.length-1));
  }

  // CSV helper
  function toCsvRow(obj, headers){
    const esc = (v)=>{
      const s = (v==null) ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    return headers.map(h=>esc(obj[h])).join(',');
  }
  class CsvTable{
    constructor(headers){
      this.headers = headers.slice();
      this.rows = [];
    }
    add(rowObj){
      this.rows.push(rowObj || {});
    }
    toCsv(){
      const lines = [];
      lines.push(this.headers.join(','));
      for(const r of this.rows){
        lines.push(toCsvRow(r, this.headers));
      }
      return lines.join('\n');
    }
  }

  // ---- AI predictor wiring ----
  // We support either:
  // - window.RB_AI.predict(snapshot)  (your current ai-predictor.js)
  // - window.RbAIPredictor class (older builds)
  function predictAI(snapshot){
    try{
      if (WIN.RB_AI && typeof WIN.RB_AI.predict === 'function'){
        return WIN.RB_AI.predict(snapshot || {});
      }
      if (typeof WIN.RbAIPredictor === 'function'){
        const p = new WIN.RbAIPredictor();
        return p.predict(snapshot || {});
      }
    }catch(_){}
    return null;
  }

  // ----- Engine -----
  const PRE_SPAWN_SEC = 3.4; // base (desktop normal)
  const HIT_WINDOW_S = { perfect:0.055, great:0.090, good:0.120 }; // seconds
  const HP_START = 100;

  class RhythmBoxerEngine{
    constructor(opts){
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio;
      this.renderer = opts.renderer;
      this.hud = opts.hud;
      this.hooks = opts.hooks || {};

      this.running = false;
      this.ended = false;
      this._rafId = null;

      this._ms0 = 0;
      this._lastTs = 0;

      this.sessionId = '';
      this.mode = 'normal';
      this.diff = 'normal';
      this.deviceType = 'desktop';

      this.track = null;
      this.meta = {};

      // state
      this.songTime = 0;
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.totalNotes = 0;

      this.hp = HP_START;
      this.hpMin = HP_START;
      this.hpUnder50Time = 0;

      this.fever = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;
      this._feverEnterAt = null;

      // timing offsets
      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits  = 0;
      this.leftHits  = 0;
      this.rightHits = 0;

      // AI snapshot
      this.aiState = null;
      this._aiLastUpdateMs = 0;
      this._aiCooldownMs = 220;

      // notes
      this.notes = [];      // {t, lane, side, id, el, state}
      this._noteIdx = 0;

      // render cache
      this._laneRects = null;

      // CSV tables
      this.eventsTable = new CsvTable([
        'session_id','t_s','lane','side','judge','offset_s','combo','score','hp','fever','device','mode','track_id'
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

      // bind input
      this._onLaneTap = this._onLaneTap.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    start(mode, trackId, meta){
      this.stop('restart');

      this.mode = (mode === 'research') ? 'research' : 'normal';
      this.meta = meta || {};
      this.sessionId = `rb_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;

      // detect difficulty from wrapper data
      try{
        const d = (this.wrap && this.wrap.dataset && this.wrap.dataset.diff) ? this.wrap.dataset.diff : 'normal';
        this.diff = (d==='easy'||d==='hard'||d==='normal') ? d : 'normal';
      }catch(_){ this.diff = 'normal'; }

      // deviceType
      const ua = (navigator.userAgent||'').toLowerCase();
      const isMobileUA = /android|iphone|ipad|ipod/.test(ua);
      this.deviceType = isMobileUA ? 'mobile' : 'desktop';

      // track
      this.track = this._makeTrack(trackId);

      // per-mode fall timing & tail (UI)
      // in research: keep PRE_SPAWN_SEC deterministic baseline
      // in normal: cVR/mobile needs longer for readability
      const view = (new URL(location.href).searchParams.get('view')||'').toLowerCase();
      const isCVR = (view === 'cvr' || view === 'cardboard');
      const isMobile = (this.deviceType === 'mobile');

      // Longer pre-spawn for small screens / Cardboard so notes have time to fall
      this._preSpawnSec = (this.mode === 'research')
        ? PRE_SPAWN_SEC
        // Cardboard/cVR: slowest (needs more reaction time)
        : (isCVR ? 5.4 : (isMobile ? 3.9 : PRE_SPAWN_SEC));

      // Tail length (pure UI) — improves timing visibility
      this._noteTailPx = (isCVR ? 280 : (isMobile ? 150 : 110));

      // reset state
      this.running = true;
      this.ended = false;
      this.songTime = 0;
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;

      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;

      this.totalNotes = 0;

      this.hp = HP_START;
      this.hpMin = HP_START;
      this.hpUnder50Time = 0;

      this.fever = 0;
      this.feverActive = false;
      this.feverEntryCount = 0;
      this.feverTotalTimeSec = 0;
      this.timeToFirstFeverSec = null;
      this._feverEnterAt = null;

      this.offsets = [];
      this.offsetsAbs = [];
      this.earlyHits = 0;
      this.lateHits  = 0;
      this.leftHits  = 0;
      this.rightHits = 0;

      this.aiState = null;
      this._aiLastUpdateMs = 0;

      this.notes = [];
      this._noteIdx = 0;

      // build notes
      this._buildNotes();

      // input
      this._attachInput();

      // audio
      if (this.audio){
        this.audio.currentTime = 0;
        this.audio.src = this.track.url;
        this.audio.playbackRate = 1;
        this.audio.loop = false;

        const p = this.audio.play();
        if (p && typeof p.catch === 'function') p.catch(()=>{});
      }

      // timing start
      this._ms0 = nowMs();
      this._lastTs = this._ms0;

      // start loop
      this._loop();
    }

    stop(reason){
      if (!this.running && !this.ended) return;
      if (this.running){
        this._finish(reason || 'stop');
      }
    }

    getEventsCsv(){
      return this.eventsTable.toCsv();
    }
    getSessionCsv(){
      return this.sessionTable.toCsv();
    }

    // ----- tracks -----
    _makeTrack(id){
      // NOTE: your html uses these ids:
      // n1 warmup-groove.mp3, n2 focus-combo.mp3, n3 speed-rush.mp3, r1 research-120.mp3
      const base = './audio/';
      const t = {
        id: id,
        name: id,
        bpm: 120,
        diff: this.diff,
        durationSec: 60,
        url: base + 'research-120.mp3',
        // pattern defined by beat grid
        beats: []
      };

      if (id === 'n1'){
        t.name = 'Warm-up Groove';
        t.bpm = 100;
        t.durationSec = 35;
        t.url = base + 'warmup-groove.mp3';
      }else if (id === 'n2'){
        t.name = 'Focus Combo';
        t.bpm = 120;
        t.durationSec = 40;
        t.url = base + 'focus-combo.mp3';
      }else if (id === 'n3'){
        t.name = 'Speed Rush';
        t.bpm = 140;
        t.durationSec = 45;
        t.url = base + 'speed-rush.mp3';
      }else if (id === 'r1'){
        t.name = 'Research Track 120';
        t.bpm = 120;
        t.durationSec = 60;
        t.url = base + 'research-120.mp3';
      }

      return t;
    }

    _buildNotes(){
      // 5-lane base pattern; cVR view may render as 3 lanes in DOM (L,C,R) via html/css
      // We'll map lanes by DOM count later in renderer.
      const bpm = this.track.bpm || 120;
      const beatSec = 60 / bpm;

      // Simple deterministic rhythm: every beat, with occasional syncopation based on diff
      const dur = this.track.durationSec || 40;

      const density = (this.diff === 'hard') ? 1.25 : (this.diff === 'easy' ? 0.75 : 1.0);

      let t = 1.0;
      let i = 0;
      while (t < dur - 0.5){
        const lane = (i % 5);
        const side = (lane <= 1) ? 'L' : (lane >= 3 ? 'R' : 'C');

        // add one note
        this.notes.push({
          id: 'n' + (i+1),
          t,
          lane,
          side,
          state: 'pending',
          el: null
        });

        // sometimes add extra note
        if (this.diff === 'hard' && (i % 4 === 1)){
          const lane2 = (lane + 2) % 5;
          const side2 = (lane2 <= 1) ? 'L' : (lane2 >= 3 ? 'R' : 'C');
          this.notes.push({
            id: 'n' + (i+1) + 'b',
            t: t + beatSec*0.5,
            lane: lane2,
            side: side2,
            state: 'pending',
            el: null
          });
        }

        t += beatSec / density;
        i++;
      }

      this.notes.sort((a,b)=>a.t-b.t);
      this.totalNotes = this.notes.length;
    }

    _attachInput(){
      if (!this.lanesEl) return;
      this.lanesEl.addEventListener('pointerdown', this._onLaneTap, { passive:true });
      WIN.addEventListener('resize', this._onResize, { passive:true });
    }
    _detachInput(){
      if (!this.lanesEl) return;
      this.lanesEl.removeEventListener('pointerdown', this._onLaneTap);
      WIN.removeEventListener('resize', this._onResize);
    }
    _onResize(){
      this._laneRects = null;
    }

    _onLaneTap(ev){
      if (!this.running) return;
      const x = ev.clientX, y = ev.clientY;
      const laneIdx = this._pickLaneFromPoint(x,y);
      if (laneIdx == null) return;
      this._judgeTap(laneIdx);
    }

    _pickLaneFromPoint(x,y){
      if (!this.lanesEl) return null;
      if (!this._laneRects){
        const lanes = Array.from(this.lanesEl.querySelectorAll('.rb-lane'));
        this._laneRects = lanes.map(el=>el.getBoundingClientRect());
      }
      let best = null;
      for (let i=0;i<this._laneRects.length;i++){
        const r = this._laneRects[i];
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
          best = i;
          break;
        }
      }
      if (best != null) return best;
      // fallback: nearest x
      let minD = 1e9, idx = null;
      for (let i=0;i<this._laneRects.length;i++){
        const r = this._laneRects[i];
        const cx = (r.left+r.right)/2;
        const d = Math.abs(cx - x);
        if (d < minD){ minD = d; idx = i; }
      }
      return idx;
    }

    _judgeTap(laneIdx){
      // find nearest pending note in that lane within window
      const t = this.songTime;
      let best = null;
      let bestDt = 1e9;

      for (const n of this.notes){
        if (n.state !== 'live') continue;
        if (n.lane !== laneIdx) continue;
        const dt = t - n.t; // positive = late
        const adt = Math.abs(dt);
        if (adt < bestDt){
          bestDt = adt;
          best = { n, dt, adt };
        }
      }

      if (!best){
        // blank tap penalty (small)
        this._addEvent('blank', laneIdx, '', '', 0);
        this.score = Math.max(0, this.score - 10);
        this.combo = 0;
        this._updateHud();
        return;
      }

      const dt = best.dt;
      const adt = best.adt;
      let judge = 'miss';
      if (adt <= HIT_WINDOW_S.perfect) judge = 'perfect';
      else if (adt <= HIT_WINDOW_S.great) judge = 'great';
      else if (adt <= HIT_WINDOW_S.good) judge = 'good';
      else judge = 'miss';

      // consume note
      best.n.state = (judge === 'miss') ? 'missed' : 'hit';
      if (best.n.el){
        best.n.el.classList.remove('is-live');
        best.n.el.classList.add(judge === 'miss' ? 'is-miss' : 'is-hit');
      }

      // stats
      if (judge === 'perfect'){ this.hitPerfect++; this.score += 120; this.combo++; }
      else if (judge === 'great'){ this.hitGreat++; this.score += 80; this.combo++; }
      else if (judge === 'good'){ this.hitGood++; this.score += 50; this.combo++; }
      else { this.hitMiss++; this.score = Math.max(0, this.score - 20); this.combo = 0; }

      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // offsets
      if (judge !== 'miss'){
        this.offsets.push(dt);
        this.offsetsAbs.push(adt);
        if (dt < 0) this.earlyHits++; else this.lateHits++;
        if (best.n.side === 'L') this.leftHits++;
        if (best.n.side === 'R') this.rightHits++;
      }

      // hp/fever
      if (judge === 'miss'){
        this.hp = clamp(this.hp - 6, 0, 100);
      }else{
        // gain fever
        const gain = (judge==='perfect') ? 0.08 : (judge==='great' ? 0.05 : 0.03);
        this.fever = clamp01(this.fever + gain);
      }
      this.hpMin = Math.min(this.hpMin, this.hp);

      // fever activation
      if (!this.feverActive && this.fever >= 1){
        this.feverActive = true;
        this.feverEntryCount++;
        this._feverEnterAt = this.songTime;
        if (this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = this.songTime;
      }
      if (this.feverActive){
        // fever drains slowly
        this.fever = clamp01(this.fever - 0.015);
        if (this.fever <= 0.02){
          this.feverActive = false;
          if (this._feverEnterAt != null){
            this.feverTotalTimeSec += Math.max(0, this.songTime - this._feverEnterAt);
            this._feverEnterAt = null;
          }
        }
      }

      // log
      this._addEvent(judge, laneIdx, best.n.side, dt, this.combo);

      // fx
      if (this.renderer && typeof this.renderer.onJudge === 'function'){
        this.renderer.onJudge(judge, laneIdx);
      }

      this._updateHud();
    }

    _addEvent(judge, laneIdx, side, offsetS, combo){
      const row = {
        session_id: this.sessionId,
        t_s: this.songTime.toFixed(3),
        lane: laneIdx,
        side: side || '',
        judge: judge,
        offset_s: (offsetS==null) ? '' : Number(offsetS).toFixed(4),
        combo: combo || 0,
        score: this.score,
        hp: this.hp,
        fever: this.fever.toFixed(3),
        device: this.deviceType,
        mode: this.mode,
        track_id: this.track ? this.track.id : ''
      };
      this.eventsTable.add(row);
    }

    _updateHud(){
      const hud = this.hud || {};
      if (hud.score) hud.score.textContent = String(this.score);
      if (hud.combo) hud.combo.textContent = String(this.combo);
      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const judged = totalHits + this.hitMiss;
      const accPct = judged ? (totalHits / (this.totalNotes||1))*100 : 0;
      if (hud.acc) hud.acc.textContent = accPct.toFixed(1) + '%';
      if (hud.hp) hud.hp.textContent = String(Math.round(this.hp));
      if (hud.time) hud.time.textContent = this.songTime.toFixed(1);

      if (hud.countPerfect) hud.countPerfect.textContent = String(this.hitPerfect);
      if (hud.countGreat) hud.countGreat.textContent = String(this.hitGreat);
      if (hud.countGood) hud.countGood.textContent = String(this.hitGood);
      if (hud.countMiss) hud.countMiss.textContent = String(this.hitMiss);

      if (hud.feverFill) hud.feverFill.style.width = Math.round(this.fever*100) + '%';
      if (hud.feverStatus) hud.feverStatus.textContent = this.feverActive ? 'ON' : 'READY';

      const prog = this.track && this.track.durationSec ? clamp01(this.songTime / this.track.durationSec) : 0;
      if (hud.progFill) hud.progFill.style.width = Math.round(prog*100) + '%';
      if (hud.progText) hud.progText.textContent = Math.round(prog*100) + '%';
    }

    _updateAI(){
      const t = nowMs();
      if (t - this._aiLastUpdateMs < this._aiCooldownMs) return;
      this._aiLastUpdateMs = t;

      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood;
      const judged = totalHits + this.hitMiss;
      const accPct = judged ? (totalHits / (this.totalNotes||1))*100 : 0;
      const offAbs = this.offsetsAbs.length ? mean(this.offsetsAbs) : 0;

      const snapshot = {
        accPct,
        hitMiss: this.hitMiss,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        combo: this.combo,
        offsetAbsMean: offAbs,
        hp: this.hp,
        songTime: this.songTime,
        durationSec: this.track ? this.track.durationSec : 0
      };

      const ai = predictAI(snapshot);
      if (ai){
        this.aiState = ai;
        // update HUD if present
        try{
          if (this.hud && typeof this.hud === 'object'){
            if (this.hud.aiFatigue) this.hud.aiFatigue.textContent = Math.round((ai.fatigueRisk||0)*100) + '%';
            if (this.hud.aiSkill)   this.hud.aiSkill.textContent   = Math.round((ai.skillScore||0)*100) + '%';
            if (this.hud.aiSuggest) this.hud.aiSuggest.textContent = (ai.suggestedDifficulty||'normal');
            if (this.hud.aiTip){
              this.hud.aiTip.textContent = ai.tip || '';
              this.hud.aiTip.classList.toggle('hidden', !ai.tip);
            }
          }
        }catch(_){}
      }
    }

    _loop(){
      if (!this.running) return;

      const ts = nowMs();
      const dt = Math.max(0.001, (ts - this._lastTs)/1000);
      this._lastTs = ts;

      // advance song time from audio if available
      if (this.audio && Number.isFinite(this.audio.currentTime)){
        this.songTime = this.audio.currentTime;
      }else{
        this.songTime += dt;
      }

      // hp under 50 time
      if (this.hp < 50) this.hpUnder50Time += dt;

      // fever time accumulate if active
      if (this.feverActive) this.feverTotalTimeSec += dt;

      // spawn/advance notes
      this._updateNotes();

      // AI update (prediction)
      this._updateAI();

      // hud time/prog etc
      this._updateHud();

      // end
      const dur = this.track ? this.track.durationSec : 0;
      if (dur > 0 && this.songTime >= dur){
        this._finish('song-end');
        return;
      }
      if (this.hp <= 0){
        this._finish('hp-zero');
        return;
      }

      this._rafId = requestAnimationFrame(()=>this._loop());
    }

    _updateNotes(){
      const t = this.songTime;
      const pre = this._preSpawnSec || PRE_SPAWN_SEC;

      // activate notes into live window
      for (const n of this.notes){
        if (n.state === 'pending' && (n.t - t) <= pre){
          n.state = 'live';
          // create el
          if (!n.el && this.renderer && typeof this.renderer.makeNoteEl === 'function'){
            n.el = this.renderer.makeNoteEl(n.lane, { tailPx: this._noteTailPx });
            if (n.el){
              n.el.dataset.noteId = n.id;
            }
          }
        }
      }

      // render live notes positions
      this._renderNotes();

      // miss notes past window
      for (const n of this.notes){
        if (n.state !== 'live') continue;
        const late = t - n.t;
        if (late > HIT_WINDOW_S.good){
          n.state = 'missed';
          this.hitMiss++;
          this.score = Math.max(0, this.score - 20);
          this.combo = 0;
          this.hp = clamp(this.hp - 6, 0, 100);
          this.hpMin = Math.min(this.hpMin, this.hp);

          if (n.el){
            n.el.classList.remove('is-live');
            n.el.classList.add('is-miss');
          }
          this._addEvent('miss', n.lane, n.side, late, this.combo);

          if (this.renderer && typeof this.renderer.onJudge === 'function'){
            this.renderer.onJudge('miss', n.lane);
          }
        }
      }
    }

    _renderNotes(){
      if (!this.renderer || typeof this.renderer.setNotePos !== 'function') return;

      const pre = this._preSpawnSec || PRE_SPAWN_SEC;

      // lane area rect
      const rect = this.lanesEl.getBoundingClientRect();
      const h = rect.height || 1;

      // Travel distance controls how early a note becomes visible.
      // Cardboard/cVR needs a longer "fall" path (more reaction time).
      let travel = h * 0.85;
      if (this.deviceType === 'cvr' || this.deviceType === 'cardboard'){
        travel = Math.max(travel, h - 70);
      } else if (this.deviceType === 'mobile'){
        travel = Math.max(travel, h - 110);
      }

      for (const n of this.notes){
        if (n.state !== 'live' || !n.el) continue;
        // progress: 0..1 (0 at spawn, 1 at hit line)
        const p = clamp01((pre - (n.t - this.songTime)) / pre);
        const y = (p - 1) * travel; // -travel .. 0
        this.renderer.setNotePos(n.el, y);
        n.el.classList.add('is-live');
      }
    }

    _finish(endReason){
      this.running = false;
      this.ended = true;

      if (this._rafId != null){
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }

      if (this.audio){
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

      this._detachInput();

      if (this.hooks && typeof this.hooks.onEnd === 'function'){
        this.hooks.onEnd(summary);
      }
    }
  }

  // ===== expose =====
  window.RhythmBoxerEngine = RhythmBoxerEngine;
})();