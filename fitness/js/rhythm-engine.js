// === /fitness/js/rhythm-engine.js ===
// Rhythm Boxer Engine — PRODUCTION (cVR/PC/Mobile) + Boss (A+B+C) + AI Prediction (locked in research) + CSV
// ✅ Notes fall to hit line (visual sync, hit line anchored at bottom via CSS var)
// ✅ 5-lane default (works with 3-lane too if HTML/CSS reduce lanes)
// ✅ Calibration offset (Cal: ms) + UI buttons call adjustCalMs()
// ✅ Research lock: prediction shown but no adaptive changes
// ✅ Normal assist: enable with ?ai=1 (prediction only for now)
// ✅ Events CSV + Sessions CSV
// ✅ r1: authored beatmap (not random) for research repeatability
// ✅ NEW: Boss system: onBossBeat() + rb:bossbeat listener + HP/Shield/Reverse/Fake/ComboLock
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
  // ✅ BEATMAP จริง: r1 (120 BPM) แบบกำหนดแพทเทิร์น (ไม่สุ่ม)
  function buildPattern(track, laneCount){
    const id = (track && track.id) ? track.id : 'n1';

    // authored for 5-lane for research
    if(id === 'r1' && laneCount === 5){
      return buildBeatmapR1_120(track.durationSec || 60);
    }

    // fallback: deterministic-ish random for other tracks / 3-lane
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

    // SECTION A (8 bars) — warm focus
    const A1 = [
      [0*beat, [2]],
      [1*beat, [1]],
      [2*beat, [3]],
      [3*beat, [2]],
    ];
    const A2 = [
      [0*beat, [0]],
      [1*beat, [2]],
      [2*beat, [4]],
      [3*beat, [2]],
    ];
    for(let i=0;i<4;i++) barPattern(A1);
    for(let i=0;i<4;i++) barPattern(A2);

    // SECTION B (8 bars) — syncopation + doubles
    const B1 = [
      [0*beat, [1]],
      [0*beat+e, [3]],
      [1*beat, [2]],
      [2*beat, [0]],
      [2*beat+e, [4]],
      [3*beat, [2]],
    ];
    const B2 = [
      [0*beat, [2]],
      [1*beat, [1,3]],
      [2*beat, [0,4]],
      [3*beat, [2]],
    ];
    for(let i=0;i<4;i++) barPattern(B1);
    for(let i=0;i<4;i++) barPattern(B2);

    // SECTION C (6 bars) — combo builder
    const C1 = [
      [0*beat, [0]],
      [0*beat+e, [1]],
      [1*beat, [2]],
      [1*beat+e, [3]],
      [2*beat, [4]],
      [3*beat, [2]],
    ];
    for(let i=0;i<6;i++) barPattern(C1);

    // SECTION D (4 bars) — burst
    const D1 = [
      [0*beat, [1]],
      [0*beat+e, [3]],
      [1*beat, [0]],
      [1*beat+e, [4]],
      [2*beat, [2]],
      [3*beat, [1,3]],
    ];
    for(let i=0;i<4;i++) barPattern(D1);

    // Fill until end
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
      this._calHold = 0;

      // gameplay state
      this.songTime = 0;
      this._t0 = 0;
      this._lastTs = 0;
      this._rafId = null;

      // player hp
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

      // ai
      this.aiState = null;
      this._aiNext = 0;
      this._aiTipNext = 0;

      // notes
      this.laneCount = 5;
      this.notes = [];
      this.noteIdx = 0;
      this.live = [];
      this.noteSpeedSec = 2.20; // lead time (visual fall time)
      this.noteBaseLen = 160;   // px

      // ==========================
      // ✅ BOSS STATE (A+B+C)
      // ==========================
      this.bossEnabled = true;
      this.boss = {
        active: false,
        startedAtS: 0,
        preset: '',
        skill: '',
        hp: 100,
        hpMax: 100,
        // shield
        shieldNeed: 0,
        shieldStreak: 0,
        // effects
        reverseOn: false,
        comboLockOn: false,
        fakeOn: false,
        // fairness
        fakeUsed: false,
        // stats
        beatsTotal: 0,
        beatsDone: 0,
        hitsOnBoss: 0,
        missesOnBoss: 0,
        dmgDone: 0,
        // pacing
        burstAggro: 0, // 0..1 affects extra spawns
        lastBeatAtS: 0
      };

      // CSV tables
      this.sessionId = '';
      this.eventsTable = new CsvTable([
        'session_id','mode','track_id','bpm','difficulty',
        'participant_id','group','note',
        't_s','lane','side',
        'event','judgment','offset_s','score_delta',
        'combo','hp','fever','cal_offset_ms',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        // boss extras
        'boss_active','boss_preset','boss_skill','boss_hp','boss_shield_streak','boss_shield_need','boss_reverse','boss_combo_lock','boss_fake',
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
        // boss summary
        'boss_beats_total','boss_hits','boss_misses','boss_dmg_done','boss_end_state',
        'end_reason','duration_sec','device_type',
        'ai_fatigue_risk','ai_skill_score','ai_suggest','ai_locked','ai_assist_on',
        'trial_valid','rank','created_at_iso'
      ]);

      this._bindLaneInput();
      this._detectDeviceType();

      // ✅ fallback listener: if UI glue doesn’t call onBossBeat directly
      WIN.addEventListener('rb:bossbeat', (ev)=>{
        if(!ev || !ev.detail) return;
        this.onBossBeat(ev.detail);
      });
    }

    // ✅ optional API for UI glue
    setBossEnabled(on){
      this.bossEnabled = !!on;
    }

    // ✅ NEW: calibration APIs
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

      // ✅ IMPORTANT: pointerdown on .rb-lane itself
      this.lanesEl.addEventListener('pointerdown', (ev)=>{
        const laneEl = ev.target && ev.target.closest ? ev.target.closest('.rb-lane') : null;
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if(!Number.isFinite(lane)) return;
        this.hitLane(lane, 'tap');
      }, {passive:true});

      // keyboard support
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

      // notes
      this.notes = buildPattern(this.track, this.laneCount);
      this.totalNotes = this.notes.length;
      this.noteIdx = 0;
      this.live.length = 0;

      // boss reset
      this._bossReset();

      this._clearNotesDom();

      this.sessionId = this._makeSessionId();
      this.eventsTable.clear();
      this.sessionTable.clear();

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

    _bossReset(){
      this.boss.active = false;
      this.boss.startedAtS = 0;
      this.boss.preset = '';
      this.boss.skill = '';
      this.boss.hpMax = 100;
      this.boss.hp = 100;
      this.boss.shieldNeed = 0;
      this.boss.shieldStreak = 0;
      this.boss.reverseOn = false;
      this.boss.comboLockOn = false;
      this.boss.fakeOn = false;
      this.boss.fakeUsed = false;
      this.boss.beatsTotal = 0;
      this.boss.beatsDone = 0;
      this.boss.hitsOnBoss = 0;
      this.boss.missesOnBoss = 0;
      this.boss.dmgDone = 0;
      this.boss.burstAggro = 0;
      this.boss.lastBeatAtS = 0;
    }

    // ==================================================
    // ✅ Boss entrypoint (called by UI glue / event)
    // payload: {symbol:'A'|'B', i, total, meta:{preset,skill,reverseOn,shieldNeed,hp,...}}
    // ==================================================
    onBossBeat(payload){
      if(!this.running || this.ended) return;
      if(!this.bossEnabled) return;
      if(!payload) return;

      const meta = payload.meta || {};
      const symbol = payload.symbol || 'A';

      // begin boss if not active (first beat)
      if(!this.boss.active){
        this.boss.active = true;
        this.boss.startedAtS = this.songTime;
        this.boss.preset = String(meta.preset || meta.presetName || 'burst');
        this.boss.skill  = String(meta.skill  || 'burst');
        // HP scaling: research/test มีบอสแต่ "นิ่มกว่า"
        const baseHp = Number(meta.hp ?? 100);
        const diff = this.track.diff || 'normal';
        let hpMax = baseHp;

        if(this.mode === 'research'){
          hpMax = Math.round(baseHp * 0.85);     // research นิ่มลง
        } else if(diff === 'hard'){
          hpMax = Math.round(baseHp * 1.10);
        } else if(diff === 'easy'){
          hpMax = Math.round(baseHp * 0.92);
        }
        hpMax = clamp(hpMax, 60, 150);

        this.boss.hpMax = hpMax;
        this.boss.hp = Math.min(hpMax, hpMax);

        this.boss.shieldNeed = clamp(Number(meta.shieldNeed || 0), 0, 6);
        this.boss.shieldStreak = clamp(Number(meta.shieldStreak || 0), 0, 99);

        this.boss.reverseOn = !!meta.reverseOn || (this.boss.skill === 'reverse');
        this.boss.comboLockOn = (this.boss.skill === 'combo_lock');
        this.boss.fakeOn = (this.boss.skill === 'fake_callout');

        this.boss.beatsTotal = Number(payload.total || 0) || 0;
        this.boss.beatsDone = 0;
        this.boss.burstAggro = (this.boss.preset === 'burst') ? 1 : (this.boss.preset === 'syncop' ? 0.7 : 0.6);

        this._logBossState('boss_start');
      }

      // update counters
      this.boss.beatsDone = Math.max(this.boss.beatsDone, Number(payload.i || 0) + 1);
      this.boss.lastBeatAtS = this.songTime;

      // schedule boss note spawn
      const lane = this._bossSymbolToLane(symbol, payload.i || 0);

      // fairness: fake_callout -> หลอกแค่ 1 ครั้งต่อ burst และไม่ทำให้ impossible
      let finalLane = lane;
      if(this.boss.fakeOn && !this.boss.fakeUsed){
        // chance gate: hard สูงขึ้น, research ต่ำลง
        const diff = this.track.diff || 'normal';
        const p = (this.mode === 'research') ? 0.10 : (diff === 'hard' ? 0.28 : diff === 'easy' ? 0.14 : 0.20);
        if(Math.random() < p){
          this.boss.fakeUsed = true;
          finalLane = this._neighborLane(lane);
        }
      }

      // spawn note close to "beat time" (we use songTime + small lead so it can still fall visually)
      this._spawnBossNote(finalLane);

      // optional: shield indicator could be reflected in HUD via hud.shield (you already set shield text "0")
      if(this.hud && this.hud.shield){
        const need = this.boss.shieldNeed || 0;
        const got = this.boss.shieldStreak || 0;
        this.hud.shield.textContent = need ? `${got}/${need}` : '0';
      }

      // end boss if hp depleted
      if(this.boss.hp <= 0){
        this._bossEnd('boss_hp_zero');
      }
    }

    _bossSymbolToLane(symbol, i){
      // A/B map -> left/right lanes (center kept for fairness)
      const lc = this.laneCount || 5;
      const mid = (lc===3) ? 1 : 2;

      // base mapping
      let lane = mid;

      if(lc === 3){
        lane = (symbol === 'A') ? 0 : 2;
      }else{
        // 5-lane: A -> L1 (1) / B -> R1 (3) with slight variation by beat index
        const aLanes = [1,0]; // L1 then L2
        const bLanes = [3,4]; // R1 then R2
        if(symbol === 'A') lane = aLanes[(i||0)%aLanes.length];
        else lane = bLanes[(i||0)%bLanes.length];
      }

      // reverse effect
      if(this.boss.reverseOn){
        lane = (lc - 1) - lane;
      }

      return clamp(lane, 0, lc-1);
    }

    _neighborLane(lane){
      const lc = this.laneCount || 5;
      if(lc <= 1) return 0;
      const dir = (Math.random() < 0.5) ? -1 : 1;
      let ln = lane + dir;
      if(ln < 0) ln = lane + 1;
      if(ln >= lc) ln = lane - 1;
      return clamp(ln, 0, lc-1);
    }

    _spawnBossNote(lane){
      // spawn a note that is guaranteed to be seen soon: t = songTime + small lead so it "starts falling" now
      const lead = this.noteSpeedSec;
      const t = this.songTime + Math.min(0.18, lead*0.08);

      const note = { t: +t.toFixed(3), lane, kind:'tap', _boss: 1 };
      // add into notes stream + live immediately
      // keep notes sorted loosely: just push and spawn now
      this._spawnNote(note);
      this.live.push(note);

      // also log
      this._logEvent({ event:'boss_spawn', lane, judgment:'', offset_s:'', score_delta: 0 });
    }

    _bossDealDamageFromHit(judgment){
      if(!this.boss.active) return 0;

      // shield rule: ต้อง hit ต่อเนื่องให้ครบ before damage
      if(this.boss.shieldNeed > 0){
        if(judgment === 'perfect' || judgment === 'great' || judgment === 'good'){
          this.boss.shieldStreak++;
          if(this.boss.shieldStreak < this.boss.shieldNeed){
            return 0; // ยังไม่ผ่านโล่
          }
          // ผ่านโล่: consume streak and allow damage
          this.boss.shieldStreak = 0;
        }else{
          this.boss.shieldStreak = 0;
          return 0;
        }
      }

      // damage by judgment + diff
      const diff = this.track.diff || 'normal';
      let dmg = (judgment==='perfect') ? 10 : (judgment==='great') ? 7 : 5;
      if(diff === 'hard') dmg = Math.round(dmg * 1.1);
      if(diff === 'easy') dmg = Math.round(dmg * 0.9);
      if(this.mode === 'research') dmg = Math.round(dmg * 0.9);

      // combo_lock reduces damage slightly (fair)
      if(this.boss.comboLockOn) dmg = Math.max(1, Math.round(dmg * 0.85));

      this.boss.hp = Math.max(0, this.boss.hp - dmg);
      this.boss.dmgDone += dmg;
      return dmg;
    }

    _bossEnd(reason){
      if(!this.boss.active) return;
      this._logBossState('boss_end', reason || 'boss_end');
      this.boss.active = false;
      // clear effects after burst
      this.boss.reverseOn = false;
      this.boss.comboLockOn = false;
      this.boss.fakeOn = false;
      this.boss.fakeUsed = false;
      this.boss.shieldNeed = 0;
      this.boss.shieldStreak = 0;
      // keep hp (0) for summary; UI HUD can hide on its own
    }

    _logBossState(eventName, reason){
      this._logEvent({
        event: eventName || 'boss_state',
        lane: '',
        judgment: reason || '',
        offset_s: '',
        score_delta: 0
      });
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
      if(note._boss) el.dataset.boss = '1';

      // NOTE LENGTH
      const diff = this.track.diff || 'normal';
      const base = this.noteBaseLen;
      const mul = (diff==='easy') ? 0.95 : (diff==='hard') ? 1.25 : 1.10;
      const lenPx = Math.round(base * mul);
      el.style.setProperty('--rb-note-len', lenPx + 'px');

      // icon: music note (boss note uses ⚔️)
      const ico = DOC.createElement('div');
      ico.className = 'rb-note-ico';
      ico.textContent = note._boss ? '⚔️' : '🎵';
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

      // ✅ boss burst aggro: occasionally inject extra notes (only normal; research conservative)
      if(this.bossEnabled && this.boss.active){
        const baseP = (this.mode === 'research') ? 0.02 : 0.04;
        const p = baseP + (this.boss.burstAggro||0)*0.03;
        if(Math.random() < p){
          const lane = Math.floor(Math.random() * (this.laneCount||5));
          this._spawnBossNote(lane);
        }
      }
    }

    _updateNotePositions(){
      // Notes anchored at hit line (CSS bottom var); transform Y moves above/below that anchor.
      const lead = this.noteSpeedSec;
      if(!this.lanesEl) return;

      for(const n of this.live){
        if(!n.spawned || !n.el) continue;

        const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if(!laneEl) continue;

        const rect = laneEl.getBoundingClientRect();
        const laneH = rect.height || 420;

        const noteLen = parseFloat(getComputedStyle(n.el).getPropertyValue('--rb-note-len')) || this.noteBaseLen;

        // travel so it starts above view and reaches hit line at t
        const travel = laneH + noteLen * 0.45;

        const p = (this.songTime - (n.t - lead)) / lead;
        const pClamp = clamp01(p);

        // y: negative => above hit line; 0 => on hit line at time n.t
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

      const wPerfect = 0.045;
      const wGreat   = 0.080;
      const wGood    = 0.120;

      if(best && bestAbs <= wGood){
        const dt = best.dt;
        let judgment = 'good';
        let scoreDelta = 50;

        if(Math.abs(dt) <= wPerfect){ judgment='perfect'; scoreDelta=150; }
        else if(Math.abs(dt) <= wGreat){ judgment='great'; scoreDelta=100; }

        this._applyHit(lane, judgment, dt, scoreDelta, best.note && best.note._boss);
        this._despawnNote(best.note);
        this.live = this.live.filter(x=>x && !x.done);
      }else{
        this._applyBlankMiss(lane);
      }
    }

    _applyHit(lane, judgment, offsetSec, scoreDelta, isBossNote){
      if(judgment==='perfect') this.hitPerfect++;
      else if(judgment==='great') this.hitGreat++;
      else this.hitGood++;

      this.offsets.push(offsetSec);
      this.offsetsAbs.push(Math.abs(offsetSec));
      if(offsetSec < 0) this.earlyHits++; else if(offsetSec > 0) this.lateHits++;

      const mid = (this.laneCount===3) ? 1 : 2;
      if(lane < mid) this.leftHits++;
      else if(lane > mid) this.rightHits++;

      // combo lock effect (boss)
      if(this.boss.active && this.boss.comboLockOn){
        this.combo = Math.min(this.combo + 1, 12);
      }else{
        this.combo++;
      }
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += scoreDelta;

      const add = (judgment==='perfect') ? 0.090 : (judgment==='great') ? 0.060 : 0.035;
      this.fever = clamp01(this.fever + add);

      if(!this.feverActive && this.fever >= 1){
        this.feverActive = true;
        this.feverEntryCount++;
        if(this.timeToFirstFeverSec == null) this.timeToFirstFeverSec = this.songTime;
      }

      // ✅ boss damage on boss note hit (or allow damage while boss active to feel rewarding)
      if(this.bossEnabled && this.boss.active){
        const dmg = this._bossDealDamageFromHit(judgment);
        this.boss.hitsOnBoss++;
        if(dmg > 0){
          // small score bonus for boss damage
          const bonus = Math.round(dmg * 4);
          this.score += bonus;
          if(this.renderer && typeof this.renderer.showHitFx==='function'){
            this.renderer.showHitFx({ lane, judgment:'boss', scoreDelta: bonus });
          }
          this._logEvent({ event:'boss_damage', lane, judgment, offset_s: offsetSec, score_delta: bonus });
        }
        if(this.boss.hp <= 0) this._bossEnd('boss_hp_zero');
      }

      if(this.renderer && typeof this.renderer.showHitFx==='function'){
        this.renderer.showHitFx({ lane, judgment, scoreDelta });
      }

      this._logEvent({ event: isBossNote ? 'boss_hit' : 'hit', lane, judgment, offset_s: offsetSec, score_delta: scoreDelta });
    }

    _applyMiss(lane, kind){
      this.hitMiss++;
      this.combo = 0;

      const dmg = (kind==='timeout') ? 10 : 8;
      this.hp = Math.max(0, this.hp - dmg);
      this.hpMin = Math.min(this.hpMin, this.hp);

      this.fever = clamp01(this.fever - 0.10);
      if(this.feverActive && this.fever < 0.60) this.feverActive = false;

      // boss miss stats (only when boss active)
      if(this.bossEnabled && this.boss.active){
        this.boss.missesOnBoss++;
        this.boss.shieldStreak = 0; // shield reset on miss
      }

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

      if(this.bossEnabled && this.boss.active){
        this.boss.missesOnBoss++;
        this.boss.shieldStreak = 0;
      }

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

        t_s: (typeof this.songTime==='number') ? this.songTime.toFixed(3) : '',
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

        // boss extras
        boss_active: this.boss && this.boss.active ? 1 : 0,
        boss_preset: this.boss ? (this.boss.preset || '') : '',
        boss_skill:  this.boss ? (this.boss.skill || '') : '',
        boss_hp:     this.boss ? (this.boss.hp ?? '') : '',
        boss_shield_streak: this.boss ? (this.boss.shieldStreak ?? '') : '',
        boss_shield_need:   this.boss ? (this.boss.shieldNeed ?? '') : '',
        boss_reverse: this.boss ? (this.boss.reverseOn ? 1 : 0) : 0,
        boss_combo_lock: this.boss ? (this.boss.comboLockOn ? 1 : 0) : 0,
        boss_fake: this.boss ? (this.boss.fakeOn ? 1 : 0) : 0,

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
      if(hud.time) hud.time.textContent = this.songTime.toFixed(1);

      if(hud.countPerfect) hud.countPerfect.textContent = String(this.hitPerfect);
      if(hud.countGreat)   hud.countGreat.textContent   = String(this.hitGreat);
      if(hud.countGood)    hud.countGood.textContent    = String(this.hitGood);
      if(hud.countMiss)    hud.countMiss.textContent    = String(this.hitMiss);

      // boss shield text
      if(hud.shield){
        const need = this.boss && this.boss.active ? (this.boss.shieldNeed||0) : 0;
        if(need){
          hud.shield.textContent = `${this.boss.shieldStreak||0}/${need}`;
        }else{
          hud.shield.textContent = '0';
        }
      }

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

    _updateAI(){
      const t = this.songTime;
      if(t < this._aiNext) return;
      this._aiNext = t + 0.40;

      const judged = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const hit = judged - this.hitMiss;
      const accPct = judged ? (hit / this.totalNotes) * 100 : 0;

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
        durationSec: this.track.durationSec || 60,
        bossActive: this.boss && this.boss.active ? 1 : 0
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

      // IMPORTANT: no adaptive changes here (research lock)
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

      const bossEndState = (this.boss && this.boss.active)
        ? (this.boss.hp <= 0 ? 'cleared' : 'active_end')
        : (this.boss && this.boss.hp <= 0 ? 'cleared' : 'none');

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

        // boss summary
        boss_beats_total: this.boss ? (this.boss.beatsTotal || '') : '',
        boss_hits: this.boss ? (this.boss.hitsOnBoss || 0) : 0,
        boss_misses: this.boss ? (this.boss.missesOnBoss || 0) : 0,
        boss_dmg_done: this.boss ? (this.boss.dmgDone || 0) : 0,
        boss_end_state: bossEndState,

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
        boss: {
          active: this.boss && this.boss.active ? 1 : 0,
          hp: this.boss ? this.boss.hp : 0,
          hpMax: this.boss ? this.boss.hpMax : 0,
          hits: this.boss ? this.boss.hitsOnBoss : 0,
          misses: this.boss ? this.boss.missesOnBoss : 0,
          dmg: this.boss ? this.boss.dmgDone : 0,
          preset: this.boss ? this.boss.preset : '',
          skill: this.boss ? this.boss.skill : ''
        },
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