// === rhythm-engine.js — Rhythm Boxer 5-lane (Pro + Research) ===
'use strict';

class RBEventLogger {
  constructor(){
    this.logs = [];
  }
  add(log){
    this.logs.push(log);
  }
  toCsv(){
    if(!this.logs.length) return '';
    const keys = Object.keys(this.logs[0]);
    const esc = v => {
      if(v==null) return '';
      const s = String(v);
      if(s.includes(',') || s.includes('\n') || s.includes('"')){
        return '"'+s.replace(/"/g,'""')+'"';
      }
      return s;
    };
    const rows = [keys.join(',')];
    for(const row of this.logs){
      rows.push(keys.map(k => esc(row[k])).join(','));
    }
    return rows.join('\n');
  }
}

class RBSessionLogger {
  constructor(){
    this.sessions = [];
  }
  add(s){
    this.sessions.push(s);
  }
  toCsv(){
    if(!this.sessions.length) return '';
    const keys = Object.keys(this.sessions[0]);
    const esc = v => {
      if(v==null) return '';
      const s = String(v);
      if(s.includes(',') || s.includes('\n') || s.includes('"')){
        return '"'+s.replace(/"/g,'""')+'"';
      }
      return s;
    };
    const rows = [keys.join(',')];
    for(const row of this.sessions){
      rows.push(keys.map(k => esc(row[k])).join(','));
    }
    return rows.join('\n');
  }
}

// Songs config (4 tracks)
const SONGS = [
  { id:'t1', name:'Warm-up Groove', bpm:98,  difficulty:'easy',      isResearch:false },
  { id:'t2', name:'Punch Rush',     bpm:128, difficulty:'normal',    isResearch:false },
  { id:'t3', name:'Ultra Beat Combo', bpm:145, difficulty:'hard',    isResearch:false },
  { id:'research', name:'Research Track 120', bpm:120, difficulty:'moderate', isResearch:true }
];

const LANES = [0,1,2,3,4]; // L2, L1, C, R1, R2
const TRAVEL_MS = 2000;    // เวลาเดินทางจากด้านบนลงถึงเส้นตี
const HIT_WINDOWS = { perfect:80, great:145, good:190 }; // ms (moderate)

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

function findSong(id){
  return SONGS.find(s => s.id === id) || SONGS[0];
}

class RhythmBoxerGame{
  constructor(){
    // Views
    this.viewMenu   = document.getElementById('rb-view-menu');
    this.viewPlay   = document.getElementById('rb-view-play');
    this.viewResult = document.getElementById('rb-view-result');

    this.wrap       = document.getElementById('rb-wrap');

    // Research fields
    this.researchFields = document.getElementById('rb-research-fields');
    this.inputParticipant = document.getElementById('rb-participant');
    this.inputGroup       = document.getElementById('rb-group');
    this.inputNote        = document.getElementById('rb-note');

    // Menu controls
    this.trackSelect  = document.getElementById('rb-track');
    this.btnStart     = document.getElementById('rb-btn-start');

    // Play HUD
    this.hudMode    = document.getElementById('rb-hud-mode');
    this.hudTrack   = document.getElementById('rb-hud-track');
    this.hudTime    = document.getElementById('rb-hud-time');
    this.hudScore   = document.getElementById('rb-hud-score');
    this.hudCombo   = document.getElementById('rb-hud-combo');
    this.hudAcc     = document.getElementById('rb-hud-acc');
    this.hudPerfect = document.getElementById('rb-hud-perfect');
    this.hudGreat   = document.getElementById('rb-hud-great');
    this.hudGood    = document.getElementById('rb-hud-good');
    this.hudMiss    = document.getElementById('rb-hud-miss');

    this.feverFill   = document.getElementById('rb-fever-fill');
    this.feverStatus = document.getElementById('rb-fever-status');

    this.btnStop   = document.getElementById('rb-btn-stop');

    // Field & lanes
    this.lanesHost = document.getElementById('rb-lanes');
    this.feedbackEl= document.getElementById('rb-feedback');

    // Result labels
    this.resMode        = document.getElementById('rb-res-mode');
    this.resTrack       = document.getElementById('rb-res-track');
    this.resReason      = document.getElementById('rb-res-reason');
    this.resScore       = document.getElementById('rb-res-score');
    this.resMaxCombo    = document.getElementById('rb-res-maxcombo');
    this.resTotalNotes  = document.getElementById('rb-res-totalnotes');
    this.resDetailHit   = document.getElementById('rb-res-detail-hit');
    this.resAcc         = document.getElementById('rb-res-acc');
    this.resOffsetAvg   = document.getElementById('rb-res-offset-avg');
    this.resOffsetStd   = document.getElementById('rb-res-offset-std');
    this.resDuration    = document.getElementById('rb-res-duration');
    this.resParticipant = document.getElementById('rb-res-participant');

    this.btnAgain      = document.getElementById('rb-btn-again');
    this.btnBackMenu   = document.getElementById('rb-btn-back-menu');
    this.btnDlEvents   = document.getElementById('rb-btn-dl-events');
    this.btnDlSessions = document.getElementById('rb-btn-dl-sessions');

    // Audio
    this.audio = document.getElementById('rb-audio');

    // Loggers
    this.eventLogger   = new RBEventLogger();
    this.sessionLogger = new RBSessionLogger();

    // State
    this.mode   = 'normal';
    this.song   = findSong('t1');
    this.notes  = [];
    this.running = false;
    this.ended   = false;
    this.startPerf = 0;
    this._rafHandle= 0;
    this._feedbackTimer = null;
    this.sessionId = this.makeSessionId();
    this.runIndex  = 0;

    this.stats = {
      score:0,
      combo:0,
      maxCombo:0,
      perfect:0,
      great:0,
      good:0,
      miss:0,
      hitCount:0,
      totalNotes:0,
      fever:0,
      feverOn:false,
      feverUsed:0
    };

    this.offsetStats = {
      sum:0,
      sumSq:0,
      count:0
    };

    this.researchMeta = { participant:'', group:'', note:'' };

    this.sessionSummaries = [];

    this.wireUI();
    this.applyUrlPreset();
    this.showMenu();
  }

  makeSessionId(){
    const d = new Date();
    const pad = n => String(n).padStart(2,'0');
    return `RB-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  applyUrlPreset(){
    try{
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if(mode === 'research'){
        const radios = document.querySelectorAll('input[name="mode"]');
        radios.forEach(r => {
          r.checked = (r.value === 'research');
        });
        this.updateModeFromUI();
      }
    }catch(e){
      console.warn('RhythmBoxer: URL preset failed', e);
    }
  }

  wireUI(){
    // mode radios
    const radios = document.querySelectorAll('input[name="mode"]');
    radios.forEach(r => {
      r.addEventListener('change', () => this.updateModeFromUI());
    });
    this.updateModeFromUI();

    // start button
    this.btnStart.addEventListener('click', () => {
      this.startFromMenu();
    });

    // lane taps
    if(this.lanesHost){
      this.lanesHost.addEventListener('pointerdown', (ev) => {
        const laneEl = ev.target.closest('.rb-lane');
        if(!laneEl) return;
        const idx = Number(laneEl.dataset.lane || '0');
        this.onLaneHit(idx);
      });
    }

    // stop early
    this.btnStop.addEventListener('click', () => {
      this.stopGame('หยุดก่อนเวลา');
    });

    // result buttons
    this.btnAgain.addEventListener('click', () => {
      this.startFromMenu(true);
    });
    this.btnBackMenu.addEventListener('click', () => {
      this.showMenu();
    });

    // CSV buttons
    this.btnDlEvents.addEventListener('click', () => this.downloadEventsCsv());
    this.btnDlSessions.addEventListener('click', () => this.downloadSessionsCsv());
  }

  updateModeFromUI(){
    const radios = document.querySelectorAll('input[name="mode"]');
    let mode = 'normal';
    radios.forEach(r => {
      if(r.checked) mode = r.value;
    });
    this.mode = mode;
    if(mode === 'research'){
      this.researchFields.classList.remove('hidden');
    }else{
      this.researchFields.classList.add('hidden');
    }
  }

  showMenu(){
    this.viewMenu.classList.remove('hidden');
    this.viewPlay.classList.add('hidden');
    this.viewResult.classList.add('hidden');
  }

  showPlay(){
    this.viewMenu.classList.add('hidden');
    this.viewPlay.classList.remove('hidden');
    this.viewResult.classList.add('hidden');
  }

  showResult(){
    this.viewMenu.classList.add('hidden');
    this.viewPlay.classList.add('hidden');
    this.viewResult.classList.remove('hidden');
  }

  setFeedback(kind, text){
    if(!this.feedbackEl) return;
    if(this._feedbackTimer){
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    this.feedbackEl.className = 'rb-feedback';
    if(kind === 'good') this.feedbackEl.classList.add('good');
    else if(kind === 'miss') this.feedbackEl.classList.add('miss');
    else if(kind === 'warn') this.feedbackEl.classList.add('warn');
    this.feedbackEl.textContent = text || 'แตะที่ lane ให้ตรงเส้นล่างตามจังหวะเพลง 🎵';
    if(kind){
      this._feedbackTimer = setTimeout(() => {
        this.setFeedback('', 'แตะที่ lane ให้ตรงเส้นล่างตามจังหวะเพลง 🎵');
      }, 1500);
    }
  }

  startFromMenu(reuseTrack=false){
    this.updateModeFromUI();
    if(!reuseTrack){
      const id = this.trackSelect.value;
      this.song = findSong(id);
    }
    // research meta
    if(this.mode === 'research'){
      this.researchMeta = {
        participant: (this.inputParticipant.value || '-').trim(),
        group      : (this.inputGroup.value || '-').trim(),
        note       : (this.inputNote.value || '-').trim()
      };
    }else{
      this.researchMeta = { participant:'', group:'', note:'' };
    }

    this.runIndex = this.sessionSummaries.length + 1;
    this.prepareRun();
    this.showPlay();
    this.beginLoop();
  }

  prepareRun(){
    // reset stats
    this.stats = {
      score:0,
      combo:0,
      maxCombo:0,
      perfect:0,
      great:0,
      good:0,
      miss:0,
      hitCount:0,
      totalNotes:0,
      fever:0,
      feverOn:false,
      feverUsed:0
    };
    this.offsetStats = { sum:0, sumSq:0, count:0 };
    this.eventLogger = new RBEventLogger();

    // build notes chart
    this.notes = this.buildChartForSong(this.song);
    this.stats.totalNotes = this.notes.length;

    this.running = false;
    this.ended   = false;
    this.startPerf = 0;
    this._rafHandle= 0;

    // clear lanes
    if(this.lanesHost){
      this.lanesHost.querySelectorAll('.rb-note').forEach(el => el.remove());
    }

    // HUD
    this.hudMode.textContent  = (this.mode === 'research') ? 'Research' : 'Normal';
    this.hudTrack.textContent = this.song.name;
    this.hudTime.textContent  = '0.0';
    this.updateHudStats();
    this.updateFeverHud();

    this.setFeedback('', 'แตะที่ lane ให้ตรงเส้นล่างตามจังหวะเพลง 🎵');

    // audio source: อาจารย์กำหนดเองตาม id
    if(this.audio){
      let src = '';
      if(this.song.id === 't1') src = 'audio/rb_t1.mp3';
      else if(this.song.id === 't2') src = 'audio/rb_t2.mp3';
      else if(this.song.id === 't3') src = 'audio/rb_t3.mp3';
      else if(this.song.id === 'research') src = 'audio/rb_research.mp3';
      if(src){
        this.audio.src = src;
      }else{
        this.audio.removeAttribute('src');
      }
    }
  }

  buildChartForSong(song){
    const notes = [];
    const bpm = song.bpm || 120;
    const beatMs = 60000 / bpm;
    const patternLenBeats = 64; // 16 bars of 4/4
    const lanes = LANES;

    let timeMs = 1500; // offset ก่อนเริ่มโน้ตแรก
    if(song.id === 't1'){
      // ง่าย: เดิน 1/2 beat, random 2-3 lanesซ้ำ pattern
      for(let i=0;i<patternLenBeats;i++){
        const lane = lanes[i % lanes.length];
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        timeMs += beatMs * 0.75;
      }
    }else if(song.id === 't2'){
      // ปานกลาง: สลับกลาง + ซ้ายขวา 1/2 beat
      for(let i=0;i<patternLenBeats;i++){
        const lane = (i % 4 === 0) ? 2 : (i % 2 === 0 ? 1 : 3);
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        if(i % 8 === 4){
          // double hit (chord)
          notes.push({ id:1000+i, lane: (lane===1?3:1), hitTime: timeMs, type:'hit' });
        }
        timeMs += beatMs * 0.6;
      }
    }else if(song.id === 't3'){
      // ยาก: 1/3 beat + chord บ่อย
      for(let i=0;i<patternLenBeats*1.2;i++){
        const lane = lanes[i % lanes.length];
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        if(i % 6 === 2){
          notes.push({ id:2000+i, lane: (lane+2)%lanes.length, hitTime: timeMs+beatMs*0.15, type:'hit' });
        }
        timeMs += beatMs * 0.45;
      }
    }else if(song.id === 'research'){
      // Research track: pattern คงที่, 4-beat phrase ซ้ำ
      const phrase = [
        { lane:2, offsetBeats:0 },
        { lane:1, offsetBeats:0.5 },
        { lane:3, offsetBeats:1.0 },
        { lane:0, offsetBeats:1.5 },
        { lane:4, offsetBeats:2.0 },
        { lane:2, offsetBeats:2.5 },
        { lane:1, offsetBeats:3.0 },
        { lane:3, offsetBeats:3.5 }
      ];
      const phraseRepeat = 10;
      let idCounter = 1;
      for(let p=0;p<phraseRepeat;p++){
        for(const n of phrase){
          const ht = timeMs + n.offsetBeats * beatMs;
          notes.push({ id:idCounter++, lane:n.lane, hitTime: ht, type:'hit' });
        }
        timeMs += beatMs * 4; // next phrase
      }
    }
    // enrich notes with spawnTime & DOM ref
    for(const n of notes){
      n.spawnTime = n.hitTime - TRAVEL_MS;
      n.spawned   = false;
      n.resolved  = false;
      n.el        = null;
    }
    return notes;
  }

  beginLoop(){
    this.running = true;
    this.ended   = false;
    this.startPerf = performance.now();

    // play audio
    if(this.audio && this.audio.src){
      try{
        this.audio.currentTime = 0;
        const p = this.audio.play();
        if(p && typeof p.catch === 'function'){
          p.catch(()=>{});
        }
      }catch(e){}
    }

    const loop = (t) => {
      if(!this.running) return;
      const songTime = t - this.startPerf;
      this.updateTimeHud(songTime);
      this.updateNotes(songTime);
      // end condition: หลังโน้ตสุดท้าย + margin
      const last = this.notes.length ? this.notes[this.notes.length-1].hitTime : 0;
      if(songTime > last + TRAVEL_MS + 800){
        this.stopGame('จบเพลง');
        return;
      }
      this._rafHandle = requestAnimationFrame(loop);
    };
    this._rafHandle = requestAnimationFrame(loop);
  }

  updateTimeHud(songTimeMs){
    this.hudTime.textContent = (songTimeMs/1000).toFixed(1);
  }

  updateNotes(songTimeMs){
    if(!this.lanesHost) return;
    const fieldHeight = this.lanesHost.clientHeight || 1;
    const hitLineOffsetPx = fieldHeight - 48; // ตำแหน่งเส้นตีโดยประมาณ

    for(const n of this.notes){
      if(n.resolved) continue;

      // spawn
      if(!n.spawned && songTimeMs >= n.spawnTime){
        const laneEl = this.lanesHost.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if(!laneEl) continue;
        const el = document.createElement('div');
        el.className = 'rb-note rb-note-type-hit';
        el.textContent = '🥊';
        laneEl.appendChild(el);
        n.el = el;
        n.spawned = true;
        // initial position (top)
        el.style.bottom = (fieldHeight)+'px';
        // delay to allow CSS transition if needed
        requestAnimationFrame(()=>{
          el.classList.add('rb-note-spawned');
        });
      }

      if(!n.spawned || !n.el) continue;

      const dtFromSpawn = songTimeMs - n.spawnTime;
      const progress = clamp(dtFromSpawn / TRAVEL_MS, 0, 1.2);
      const y = hitLineOffsetPx * (1-progress);
      n.el.style.bottom = y+'px';

      // miss check (เลย hit windowไปมากแล้ว)
      const dtHit = songTimeMs - n.hitTime;
      if(dtHit > HIT_WINDOWS.good + 120 && !n.resolved){
        this.registerMiss(n, songTimeMs);
      }
    }
  }

  onLaneHit(lane){
    if(!this.running) return;
    const now = performance.now();
    const songTime = now - this.startPerf;

    // หา note ที่ยังไม่ resolved ใน lane เดียวกันที่ใกล้ hitTime ที่สุด
    let best = null;
    let bestAbs = Infinity;
    for(const n of this.notes){
      if(n.lane !== lane) continue;
      if(n.resolved) continue;
      const dt = songTime - n.hitTime;
      const adt = Math.abs(dt);
      if(adt < bestAbs){
        bestAbs = adt;
        best = n;
      }
    }

    if(!best){
      // ไม่มีโน้ตใน lane นั้นใน window → เตือน
      this.setFeedback('warn', 'ยังไม่มีโน้ตตรงจังหวะเส้น ลองรอให้ใกล้เส้นก่อนค่อยตี 🎯');
      return;
    }

    const dt = songTime - best.hitTime;
    const absDt = Math.abs(dt);
    let grade = 'miss';
    if(absDt <= HIT_WINDOWS.perfect) grade = 'perfect';
    else if(absDt <= HIT_WINDOWS.great) grade = 'great';
    else if(absDt <= HIT_WINDOWS.good) grade = 'good';

    if(grade === 'miss'){
      this.registerMiss(best, songTime);
    }else{
      this.registerHit(best, songTime, dt, grade);
    }
  }

  registerHit(note, songTimeMs, offsetMs, grade){
    if(note.resolved) return;
    note.resolved = true;
    if(note.el){
      note.el.classList.remove('rb-note-miss');
      note.el.classList.add('rb-note-hit');
      setTimeout(()=>{ if(note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el); }, 220);
    }

    // score
    let delta = 0;
    if(grade === 'perfect') delta = 300;
    else if(grade === 'great') delta = 200;
    else delta = 100;

    if(this.stats.feverOn){
      delta = Math.round(delta * 1.5);
    }

    this.stats.score += delta;
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.hitCount += 1;
    if(grade === 'perfect') this.stats.perfect++;
    else if(grade === 'great') this.stats.great++;
    else this.stats.good++;

    // fever
    this.addFever(grade);

    // offset stats (เฉพาะโหมดวิจัย หรือเก็บไว้เลยก็ได้)
    this.offsetStats.sum   += offsetMs;
    this.offsetStats.sumSq += offsetMs*offsetMs;
    this.offsetStats.count += 1;

    this.spawnScorePopup(note.lane, grade, delta);

    this.setFeedback('good', grade === 'perfect' ? 'PERFECT! ⭐' :
                              grade === 'great' ? 'จังหวะดีมาก! 😀' :
                              'ดีเลย! รักษาจังหวะต่อไป ✨');

    // log event
    const acc = this.computeAccuracy();
    const log = {
      session_id : this.sessionId,
      run_index  : this.runIndex,
      mode       : this.mode,
      track_id   : this.song.id,
      track_name : this.song.name,
      participant: this.researchMeta.participant || '',
      group      : this.researchMeta.group || '',
      note_id    : note.id,
      lane       : note.lane,
      event_type : 'hit',
      grade      : grade,
      offset_ms  : offsetMs.toFixed(1),
      song_time_s: (songTimeMs/1000).toFixed(3),
      accuracy_pct: acc.toFixed(1),
      score_delta: delta,
      score_total: this.stats.score,
      combo      : this.stats.combo
    };
    this.eventLogger.add(log);

    this.updateHudStats();
  }

  registerMiss(note, songTimeMs){
    if(note.resolved) return;
    note.resolved = true;
    if(note.el){
      note.el.classList.remove('rb-note-hit');
      note.el.classList.add('rb-note-miss');
      setTimeout(()=>{ if(note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el); }, 250);
    }

    this.stats.combo = 0;
    this.stats.miss += 1;

    this.setFeedback('miss', 'พลาดจังหวะ! ลองโฟกัสที่เส้นล่างแล้วตีให้ตรงนะ 😅');

    const acc = this.computeAccuracy();
    const log = {
      session_id : this.sessionId,
      run_index  : this.runIndex,
      mode       : this.mode,
      track_id   : this.song.id,
      track_name : this.song.name,
      participant: this.researchMeta.participant || '',
      group      : this.researchMeta.group || '',
      note_id    : note.id,
      lane       : note.lane,
      event_type : 'miss',
      grade      : 'miss',
      offset_ms  : '',
      song_time_s: (songTimeMs/1000).toFixed(3),
      accuracy_pct: acc.toFixed(1),
      score_delta: 0,
      score_total: this.stats.score,
      combo      : this.stats.combo
    };
    this.eventLogger.add(log);

    this.spawnScorePopup(note.lane, 'miss', 0);
    this.updateHudStats();
  }

  spawnScorePopup(lane, grade, delta){
    if(!this.lanesHost) return;
    const laneEl = this.lanesHost.querySelector(`.rb-lane[data-lane="${lane}"]`);
    if(!laneEl) return;
    const popup = document.createElement('div');
    popup.className = 'rb-score-popup';
    let cls = '';
    let text = '';
    if(grade === 'perfect'){
      cls = 'rb-score-perfect'; text = `+${delta} PERFECT`;
    }else if(grade === 'great'){
      cls = 'rb-score-great'; text = `+${delta} GREAT`;
    }else if(grade === 'good'){
      cls = 'rb-score-good'; text = `+${delta}`;
    }else{
      cls = 'rb-score-miss'; text = 'MISS';
    }
    popup.classList.add(cls);
    popup.textContent = text;
    laneEl.appendChild(popup);
    setTimeout(()=>{ if(popup.parentNode) popup.parentNode.removeChild(popup); }, 600);
  }

  addFever(grade){
    let gain = 0;
    if(grade === 'perfect') gain = 10;
    else if(grade === 'great') gain = 7;
    else if(grade === 'good') gain = 4;

    if(!this.stats.feverOn){
      this.stats.fever = clamp(this.stats.fever + gain, 0, 100);
      if(this.stats.fever >= 100){
        this.triggerFever();
      }else{
        this.updateFeverHud();
      }
    }
  }

  triggerFever(){
    if(this.stats.feverOn) return;
    this.stats.feverOn = true;
    this.stats.feverUsed += 1;
    this.stats.fever = 100;
    this.updateFeverHud();
    this.setFeedback('good', 'FEVER TIME!! 🔥');

    setTimeout(()=>{
      this.stats.feverOn = false;
      this.stats.fever = 40;
      this.updateFeverHud();
    }, 7000);
  }

  updateFeverHud(){
    if(this.feverFill){
      this.feverFill.style.width = this.stats.fever + '%';
    }
    if(this.feverStatus){
      if(this.stats.feverOn){
        this.feverStatus.textContent = 'ON';
        this.feverStatus.classList.add('on');
      }else{
        this.feverStatus.textContent = (this.stats.fever >= 100) ? 'READY' : 'OFF';
        this.feverStatus.classList.remove('on');
      }
    }
  }

  computeAccuracy(){
    const totalHit = this.stats.hitCount;
    const totalAll = this.stats.totalNotes;
    if(!totalAll) return 0;
    return (totalHit / totalAll) * 100;
  }

  updateHudStats(){
    this.hudScore.textContent   = this.stats.score;
    this.hudCombo.textContent   = this.stats.combo;
    this.hudPerfect.textContent = this.stats.perfect;
    this.hudGreat.textContent   = this.stats.great;
    this.hudGood.textContent    = this.stats.good;
    this.hudMiss.textContent    = this.stats.miss;
    const acc = this.computeAccuracy();
    this.hudAcc.textContent = acc.toFixed(1) + '%';
  }

  stopGame(reason){
    if(!this.running && this.ended) return;
    this.running = false;
    this.ended   = true;
    if(this._rafHandle) cancelAnimationFrame(this._rafHandle);
    this._rafHandle = 0;
    if(this.audio){
      try{ this.audio.pause(); }catch(e){}
    }

    // เก็บ summary
    const now = performance.now();
    const durationSec = (this.startPerf ? (now - this.startPerf)/1000 : 0);
    const acc = this.computeAccuracy();

    let offsetAvg = 0, offsetStd = 0;
    if(this.offsetStats.count > 0){
      offsetAvg = this.offsetStats.sum / this.offsetStats.count;
      const meanSq = this.offsetStats.sumSq / this.offsetStats.count;
      offsetStd = Math.sqrt(meanSq - offsetAvg*offsetAvg);
    }

    // เติม result view
    this.resMode.textContent   = (this.mode === 'research') ? 'วิจัย' : 'ปกติ';
    this.resTrack.textContent  = this.song.name;
    this.resReason.textContent = reason || '-';
    this.resScore.textContent  = String(this.stats.score);
    this.resMaxCombo.textContent = String(this.stats.maxCombo);
    this.resTotalNotes.textContent = String(this.stats.totalNotes);
    this.resDetailHit.textContent =
      `${this.stats.perfect} / ${this.stats.great} / ${this.stats.good} / ${this.stats.miss}`;
    this.resAcc.textContent = acc.toFixed(1) + ' %';
    this.resOffsetAvg.textContent = this.offsetStats.count ? offsetAvg.toFixed(1)+' ms' : '-';
    this.resOffsetStd.textContent = this.offsetStats.count ? offsetStd.toFixed(1)+' ms' : '-';
    this.resDuration.textContent = durationSec.toFixed(1) + ' s';
    this.resParticipant.textContent = this.researchMeta.participant || '-';

    // session summary สำหรับ CSV
    const summary = {
      session_id: this.sessionId + '-' + String(this.sessionSummaries.length+1).padStart(2,'0'),
      build_version: 'RhythmBoxer_5lane_BC_v1',
      mode: this.mode,
      track_id: this.song.id,
      track_name: this.song.name,
      run_index: this.runIndex,
      participant: this.researchMeta.participant || '',
      group: this.researchMeta.group || '',
      note_total: this.stats.totalNotes,
      hit_total: this.stats.hitCount,
      miss_total: this.stats.miss,
      perfect_count: this.stats.perfect,
      great_count: this.stats.great,
      good_count: this.stats.good,
      score_final: this.stats.score,
      max_combo: this.stats.maxCombo,
      accuracy_pct: acc.toFixed(1),
      offset_avg_ms: this.offsetStats.count ? offsetAvg.toFixed(2) : '',
      offset_std_ms: this.offsetStats.count ? offsetStd.toFixed(2) : '',
      fever_used: this.stats.feverUsed,
      duration_s: durationSec.toFixed(3),
      end_reason: reason || ''
    };
    this.sessionSummaries.push(summary);
    this.sessionLogger.add(summary);

    this.showResult();
  }

  downloadEventsCsv(){
    if(!this.eventLogger.logs.length){
      alert('ยังไม่มีข้อมูล Event สำหรับบันทึก');
      return;
    }
    const csv = this.eventLogger.toCsv();
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pid = (this.researchMeta.participant || 'Pxxx').replace(/[^a-z0-9_-]/gi,'');
    a.href = url;
    a.download = `rhythm-boxer-events-${pid}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadSessionsCsv(){
    if(!this.sessionLogger.sessions.length){
      alert('ยังไม่มี session summary สำหรับบันทึก');
      return;
    }
    const csv = this.sessionLogger.toCsv();
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhythm-boxer-sessions-${this.sessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// init
window.addEventListener('DOMContentLoaded', () => {
  const game = new RhythmBoxerGame();
  window.__rhythmBoxer = game;
});
