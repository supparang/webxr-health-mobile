// === rhythm-engine.js — Rhythm Boxer 5-lane (2025-11-24 Research+FEVER) ===
'use strict';

/* ---------- CSV loggers ---------- */
class RBEventLogger {
  constructor(){ this.logs = []; }
  add(row){ this.logs.push(row); }
  toCsv(){
    if(!this.logs.length) return '';
    const cols = Object.keys(this.logs[0]);
    const esc = v => {
      if(v == null) return '';
      const s = String(v);
      if(s.includes(',') || s.includes('"') || s.includes('\n')){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    };
    const lines = [cols.join(',')];
    for(const row of this.logs){
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }
}

class RBSessionLogger {
  constructor(){ this.sessions = []; }
  add(row){ this.sessions.push(row); }
  toCsv(){
    if(!this.sessions.length) return '';
    const cols = Object.keys(this.sessions[0]);
    const esc = v => {
      if(v == null) return '';
      const s = String(v);
      if(s.includes(',') || s.includes('"') || s.includes('\n')){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    };
    const lines = [cols.join(',')];
    for(const row of this.sessions){
      lines.push(cols.map(c => esc(row[c])).join(','));
    }
    return lines.join('\n');
  }
}

/* ---------- Config ---------- */

// Songs config (4 tracks)
const SONGS = [
  { id:'t1',        name:'Warm-up Groove',        bpm:98,  difficulty:'easy',     isResearch:false },
  { id:'t2',        name:'Punch Rush',            bpm:128, difficulty:'normal',   isResearch:false },
  { id:'t3',        name:'Ultra Beat Combo',      bpm:145, difficulty:'hard',     isResearch:false },
  { id:'research',  name:'Research Track 120',    bpm:120, difficulty:'moderate', isResearch:true  }
];

const LANES      = [0,1,2,3,4];   // L2, L1, C, R1, R2
const TRAVEL_MS  = 2000;          // เวลาเดินทางจากด้านบนถึงเส้นตี
const HIT_WINDOWS = {             // hit window (moderate)
  perfect: 80,
  great:   145,
  good:    190
};

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

function findSong(id){
  return SONGS.find(s => s.id === id) || SONGS[0];
}

/* ---------- Main Game Class ---------- */

class RhythmBoxerGame{
  constructor(){
    // Root wrap
    this.wrap = document.getElementById('rb-wrap');

    // Views
    this.viewMenu   = document.getElementById('rb-view-menu');
    this.viewPlay   = document.getElementById('rb-view-play');
    this.viewResult = document.getElementById('rb-view-result');

    // Research fields
    this.researchFields   = document.getElementById('rb-research-fields');
    this.inputParticipant = document.getElementById('rb-participant');
    this.inputGroup       = document.getElementById('rb-group');
    this.inputNote        = document.getElementById('rb-note');

    // Menu controls
    this.trackSelect  = document.getElementById('rb-track');
    this.btnStart     = document.getElementById('rb-btn-start');
    this.btnBackHub   = document.getElementById('rb-btn-back-hub');

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

    // FEVER HUD
    this.feverFill   = document.querySelector('.rb-fever-fill');
    this.feverStatus = document.getElementById('rb-fever-status');

    // Progress
    this.progressFill = document.getElementById('rb-progress-fill');
    this.progressText = document.getElementById('rb-progress-text');

    // Field & lanes
    this.lanesHost = document.getElementById('rb-lanes');
    this.feedbackEl= document.getElementById('rb-feedback');

    // Buttons play view
    this.btnStop = document.getElementById('rb-btn-stop');

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
    this.resRank        = document.getElementById('rb-res-rank');
    this.resQualityNote = document.getElementById('rb-res-quality-note');

    this.btnAgain      = document.getElementById('rb-btn-again');
    this.btnBackMenu   = document.getElementById('rb-btn-back-menu');
    this.btnDlEvents   = document.getElementById('rb-btn-dl-events');
    this.btnDlSessions = document.getElementById('rb-btn-dl-sessions');

    // Research overlay (ใช้ซ้ำจากเวอร์ชันก่อนถ้ามี)
    this.overlay    = document.getElementById('rb-overlay-research');
    this.overlayMsg = document.getElementById('rb-overlay-message');
    this.overlayBtn = document.getElementById('rb-overlay-continue');

    // Audio
    this.audio      = document.getElementById('rb-audio');
    this.audioGuard = document.getElementById('rb-audio-guard');
    this.audioGuardBtn = document.getElementById('rb-audio-guard-btn');

    // Loggers
    this.eventLogger   = new RBEventLogger();
    this.sessionLogger = new RBSessionLogger();

    // State
    this.mode     = 'normal';       // normal | research
    this.song     = findSong('t1');
    this.notes    = [];
    this.running  = false;
    this.ended    = false;
    this.startPerf= 0;
    this._rafHandle = 0;
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

    this.offsetStats = { sum:0, sumSq:0, count:0 };

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
        radios.forEach(r => { r.checked = (r.value === 'research'); });
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
    if(this.btnStart){
      this.btnStart.addEventListener('click', () => {
        this.startFromMenu();
      });
    }

    // back hub (link ไป hub.html)
    if(this.btnBackHub){
      this.btnBackHub.addEventListener('click', () => {
        window.location.href = './hub.html';
      });
    }

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
    if(this.btnStop){
      this.btnStop.addEventListener('click', () => {
        if(this.mode === 'research' && this.running){
          this.showResearchOverlay('โหมดวิจัยต้องเล่นจนเพลงจบเพื่อเก็บข้อมูลให้ครบค่ะ');
          return;
        }
        this.stopGame('หยุดก่อนเวลา');
      });
    }

    // result buttons
    if(this.btnAgain){
      this.btnAgain.addEventListener('click', () => {
        this.startFromMenu(true);
      });
    }
    if(this.btnBackMenu){
      this.btnBackMenu.addEventListener('click', () => {
        if(this.mode === 'research' && this.running){
          this.showResearchOverlay('กำลังเก็บข้อมูลวิจัยอยู่ กรุณาเล่นจนจบเพลงก่อนค่ะ');
          return;
        }
        this.showMenu();
      });
    }

    // CSV buttons
    if(this.btnDlEvents){
      this.btnDlEvents.addEventListener('click', () => this.downloadEventsCsv());
    }
    if(this.btnDlSessions){
      this.btnDlSessions.addEventListener('click', () => this.downloadSessionsCsv());
    }

    // overlay button
    if(this.overlayBtn){
      this.overlayBtn.addEventListener('click', () => this.hideResearchOverlay());
    }

    // audio guard button
    if(this.audioGuardBtn){
      this.audioGuardBtn.addEventListener('click', () => {
        this.hideAudioGuard();
        if(this.audio){
          try{
            const p = this.audio.play();
            if(p && typeof p.catch === 'function'){
              p.catch(()=>{});
            }
          }catch(e){}
        }
      });
    }
  }

  showResearchOverlay(msg){
    if(!this.overlay){
      alert(msg);
      return;
    }
    if(this.overlayMsg) this.overlayMsg.textContent = msg;
    this.overlay.classList.remove('hidden');
  }

  hideResearchOverlay(){
    if(this.overlay){
      this.overlay.classList.add('hidden');
    }
  }

  showAudioGuard(){
    if(this.audioGuard){
      this.audioGuard.classList.remove('hidden');
    }
  }
  hideAudioGuard(){
    if(this.audioGuard){
      this.audioGuard.classList.add('hidden');
    }
  }

  updateModeFromUI(){
    const radios = document.querySelectorAll('input[name="mode"]');
    let mode = 'normal';
    radios.forEach(r => { if(r.checked) mode = r.value; });
    this.mode = mode;
    if(this.researchFields){
      if(mode === 'research') this.researchFields.classList.remove('hidden');
      else this.researchFields.classList.add('hidden');
    }
  }

  showMenu(){
    if(this.viewMenu)   this.viewMenu.classList.remove('hidden');
    if(this.viewPlay)   this.viewPlay.classList.add('hidden');
    if(this.viewResult) this.viewResult.classList.add('hidden');
  }

  showPlay(){
    if(this.viewMenu)   this.viewMenu.classList.add('hidden');
    if(this.viewPlay)   this.viewPlay.classList.remove('hidden');
    if(this.viewResult) this.viewResult.classList.add('hidden');
  }

  showResult(){
    if(this.viewMenu)   this.viewMenu.classList.add('hidden');
    if(this.viewPlay)   this.viewPlay.classList.add('hidden');
    if(this.viewResult) this.viewResult.classList.remove('hidden');
  }

  setFeedback(kind, text){
    if(!this.feedbackEl) return;
    if(this._feedbackTimer){
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    this.feedbackEl.className = '';
    this.feedbackEl.id = 'rb-feedback';

    if(kind === 'good') this.feedbackEl.classList.add('good');
    else if(kind === 'miss') this.feedbackEl.classList.add('miss');
    else if(kind === 'warn') this.feedbackEl.classList.add('warn');

    this.feedbackEl.textContent = text || 'ยังไม่มีโน้ตตรงจังหวะเส้น ลองรอให้ใกล้เส้นก่อนค่อยตี 🎯';

    if(kind){
      this._feedbackTimer = setTimeout(() => {
        this.setFeedback('', 'โฟกัสที่เส้นล่าง แล้วตีตามจังหวะเพลง 🎵');
      }, 1500);
    }
  }

  startFromMenu(reuseTrack=false){
    this.updateModeFromUI();
    if(!reuseTrack){
      const id = this.trackSelect ? this.trackSelect.value : 't1';
      this.song = findSong(id);
    }

    // difficulty → ใช้กำหนดขนาดโน้ตผ่าน data-level
    const level = this.song.difficulty || 'normal';
    if(this.wrap){
      this.wrap.dataset.level = level;
    }

    // research meta
    if(this.mode === 'research'){
      this.researchMeta = {
        participant: (this.inputParticipant && this.inputParticipant.value || '-').trim(),
        group      : (this.inputGroup && this.inputGroup.value || '-').trim(),
        note       : (this.inputNote && this.inputNote.value || '-').trim()
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
    if(this.hudMode)  this.hudMode.textContent  = (this.mode === 'research') ? 'Research' : 'Normal';
    if(this.hudTrack) this.hudTrack.textContent = this.song.name;
    if(this.hudTime)  this.hudTime.textContent  = '0.0';
    this.updateHudStats();
    this.updateFeverHud();
    this.updateProgress();

    this.setFeedback('', 'โฟกัสที่เส้นล่าง แล้วตีตามจังหวะเพลง 🎵');

    // audio source
    if(this.audio){
      let src = '';
      if(this.song.id === 't1') src = 'audio/rb_t1.mp3';
      else if(this.song.id === 't2') src = 'audio/rb_t2.mp3';
      else if(this.song.id === 't3') src = 'audio/rb_t3.mp3';
      else if(this.song.id === 'research') src = 'audio/rb_research.mp3';
      if(src) this.audio.src = src;
      else this.audio.removeAttribute('src');
    }

    this.hideAudioGuard();
  }

  buildChartForSong(song){
    const notes = [];
    const bpm = song.bpm || 120;
    const beatMs = 60000 / bpm;
    const patternLenBeats = 64; // 16 bars of 4/4
    const lanes = LANES;

    let timeMs = 1500; // offset ก่อนเริ่มโน้ตแรก

    if(song.id === 't1'){
      // ง่าย: เดิน 0.75 beat, loop lanes
      for(let i=0;i<patternLenBeats;i++){
        const lane = lanes[i % lanes.length];
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        timeMs += beatMs * 0.75;
      }
    }else if(song.id === 't2'){
      // ปานกลาง: สลับกลาง+ซ้ายขวา, มีคู่บ้าง
      for(let i=0;i<patternLenBeats;i++){
        const lane = (i % 4 === 0) ? 2 : (i % 2 === 0 ? 1 : 3);
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        if(i % 8 === 4){
          notes.push({ id:1000+i, lane: (lane===1?3:1), hitTime: timeMs, type:'hit' });
        }
        timeMs += beatMs * 0.6;
      }
    }else if(song.id === 't3'){
      // ยาก: 0.45 beat + chord ถี่ขึ้น
      for(let i=0;i<patternLenBeats*1.2;i++){
        const lane = lanes[i % lanes.length];
        notes.push({ id:i+1, lane, hitTime: timeMs, type:'hit' });
        if(i % 6 === 2){
          notes.push({ id:2000+i, lane: (lane+2)%lanes.length, hitTime: timeMs+beatMs*0.15, type:'hit' });
        }
        timeMs += beatMs * 0.45;
      }
    }else if(song.id === 'research'){
      // Research track: pattern 4-beat ซ้ำแบบเดิมทุกครั้ง
      const phrase = [
        { lane:2, offsetBeats:0   },
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
        timeMs += beatMs * 4;
      }
    }

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

    // play audio (ถ้า autoplay ถูกบล็อก → แสดง guard)
    if(this.audio && this.audio.src){
      try{
        this.audio.currentTime = 0;
        const p = this.audio.play();
        if(p && typeof p.catch === 'function'){
          p.catch(() => {
            this.showAudioGuard();
          });
        }
      }catch(e){
        this.showAudioGuard();
      }
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
    if(this.hudTime){
      this.hudTime.textContent = (songTimeMs/1000).toFixed(1);
    }
  }

  updateNotes(songTimeMs){
    if(!this.lanesHost) return;
    const fieldHeight = this.lanesHost.clientHeight || 1;
    const hitLineOffsetPx = fieldHeight * 0.18; // ระยะจากล่างถึงเส้นตี

    for(const n of this.notes){
      if(n.resolved) continue;

      // spawn
      if(!n.spawned && songTimeMs >= n.spawnTime){
        const laneEl = this.lanesHost.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
        if(!laneEl) continue;
        const el = document.createElement('div');
        el.className = 'rb-note rb-note-type-hit';
        // ชุด emoji แบบมี character แต่ละเลน
        const NOTE_EMOJI_BY_LANE = ['🎵','🎶','🎵','🎶','🎼'];
        el.textContent = NOTE_EMOJI_BY_LANE[n.lane] || '🎵';
        laneEl.appendChild(el);
        n.el = el;
        n.spawned = true;
        el.style.bottom = fieldHeight + 'px';
        requestAnimationFrame(()=>{ el.classList.add('rb-note-spawned'); });
      }

      if(!n.spawned || !n.el) continue;

      const dtFromSpawn = songTimeMs - n.spawnTime;
      const progress = clamp(dtFromSpawn / TRAVEL_MS, 0, 1.2);
      const y = hitLineOffsetPx + (fieldHeight - hitLineOffsetPx*1.8) * (1-progress);
      n.el.style.bottom = y+'px';

      // miss check
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
      this.setFeedback('warn','ยังไม่มีโน้ตตรงจังหวะเส้น ลองรอให้ใกล้เส้นก่อนค่อยตี 🎯');
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
      note.el.classList.add('rb-note-hit');
      setTimeout(()=>{ if(note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el); }, 220);
    }

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

    this.addFever(grade);

    // offset stats
    this.offsetStats.sum   += offsetMs;
    this.offsetStats.sumSq += offsetMs*offsetMs;
    this.offsetStats.count += 1;

    this.spawnScorePopup(note.lane, grade, delta);

    this.setFeedback(
      'good',
      grade === 'perfect' ? 'PERFECT! ⭐' :
      grade === 'great'   ? 'จังหวะดีมาก! 😀' :
                            'ดีเลย! รักษาจังหวะต่อไป ✨'
    );

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
      note.el.classList.add('rb-note-miss');
      setTimeout(()=>{ if(note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el); }, 250);
    }

    this.stats.combo = 0;
    this.stats.miss += 1;
    this.loseFeverOnMiss();

    this.setFeedback('miss','พลาดจังหวะ! ลองโฟกัสที่เส้นล่างแล้วตีให้ตรงนะ 😅');

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

    this.spawnScorePopup(note.lane,'miss',0);
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

  loseFeverOnMiss(){
    if(this.stats.feverOn) return;
    this.stats.fever = clamp(this.stats.fever - 12, 0, 100);
    this.updateFeverHud();
  }

  triggerFever(){
    if(this.stats.feverOn) return;
    this.stats.feverOn = true;
    this.stats.feverUsed += 1;
    this.stats.fever = 100;
    this.updateFeverHud();
    this.setFeedback('good','FEVER TIME!! 🔥');
    // ไม่ใช้ overlay เต็มจออีกแล้ว

    setTimeout(()=>{
      this.stats.feverOn = false;
      this.stats.fever = 40;
      this.updateFeverHud();
    }, 7000);
  }

  updateFeverHud(){
    const ratio = clamp(this.stats.fever / 100, 0, 1);
    if(this.feverFill){
      this.feverFill.style.transform = `scaleX(${ratio})`;
    }
    if(this.feverStatus){
      if(this.stats.feverOn){
        this.feverStatus.textContent = 'ON';
        this.feverStatus.classList.add('on');
      }else{
        this.feverStatus.classList.remove('on');
        this.feverStatus.textContent = (ratio >= 1) ? 'READY' : 'FEVER';
      }
    }
  }

  computeAccuracy(){
    const totalHit = this.stats.hitCount;
    const totalAll = this.stats.totalNotes;
    if(!totalAll) return 0;
    return (totalHit / totalAll) * 100;
  }

  computeGrade(acc){
    const a = acc || 0;
    const miss = this.stats.miss || 0;
    const total = this.stats.totalNotes || 0;
    const perfectRate = total ? this.stats.perfect / total : 0;

    let grade = 'C';
    if(a >= 96 && miss <= 3 && perfectRate >= 0.45) grade = 'SSS';
    else if(a >= 92 && miss <= 6) grade = 'SS';
    else if(a >= 88) grade = 'S';
    else if(a >= 80) grade = 'A';
    else if(a >= 65) grade = 'B';
    return grade;
  }

  updateProgress(){
    if(!this.progressFill || !this.progressText) return;
    const total = this.stats.totalNotes || 0;
    if(!total){
      this.progressFill.style.width = '0%';
      this.progressText.textContent = '0%';
      return;
    }
    const done = this.stats.hitCount + this.stats.miss;
    const pct  = clamp((done/total)*100,0,100);
    this.progressFill.style.width = pct.toFixed(1) + '%';
    this.progressText.textContent = pct.toFixed(0) + '%';
  }

  updateHudStats(){
    if(this.hudScore)   this.hudScore.textContent   = this.stats.score;
    if(this.hudCombo)   this.hudCombo.textContent   = this.stats.combo;
    if(this.hudPerfect) this.hudPerfect.textContent = this.stats.perfect;
    if(this.hudGreat)   this.hudGreat.textContent   = this.stats.great;
    if(this.hudGood)    this.hudGood.textContent    = this.stats.good;
    if(this.hudMiss)    this.hudMiss.textContent    = this.stats.miss;
    const acc = this.computeAccuracy();
    if(this.hudAcc) this.hudAcc.textContent = acc.toFixed(1) + '%';

    this.updateProgress();
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

    const now = performance.now();
    const durationSec = (this.startPerf ? (now - this.startPerf)/1000 : 0);
    const acc = this.computeAccuracy();

    let offsetAvg = 0, offsetStd = 0;
    if(this.offsetStats.count > 0){
      offsetAvg = this.offsetStats.sum / this.offsetStats.count;
      const meanSq = this.offsetStats.sumSq / this.offsetStats.count;
      offsetStd = Math.sqrt(Math.max(0, meanSq - offsetAvg*offsetAvg));
    }

    const grade = this.computeGrade(acc);

    // quality check (เฉพาะ research)
    let qualityNote = '';
    let qualityOk = 1;
    if(this.mode === 'research' && this.offsetStats.count > 0){
      const absAvg = Math.abs(offsetAvg);
      if(absAvg > 120){
        qualityOk = 0;
        qualityNote =
          `⚠ ค่าเฉลี่ย offset = ${absAvg.toFixed(1)} ms > 120 ms ` +
          `ควรให้ผู้เข้าร่วมเล่นซ้ำเพื่อคุณภาพข้อมูลที่ดีขึ้น`;
      }
    }

    const endReason = reason || 'จบเพลง';

    // เติม result view
    if(this.resMode)   this.resMode.textContent   = (this.mode === 'research') ? 'วิจัย' : 'ปกติ';
    if(this.resTrack)  this.resTrack.textContent  = this.song.name;
    if(this.resReason) this.resReason.textContent = qualityOk ? endReason : (endReason + ' (ต้องเล่นซ้ำ)');
    if(this.resScore)  this.resScore.textContent  = String(this.stats.score);
    if(this.resMaxCombo)   this.resMaxCombo.textContent   = String(this.stats.maxCombo);
    if(this.resTotalNotes) this.resTotalNotes.textContent = String(this.stats.totalNotes);
    if(this.resDetailHit){
      this.resDetailHit.textContent =
        `${this.stats.perfect} / ${this.stats.great} / ${this.stats.good} / ${this.stats.miss}`;
    }
    if(this.resAcc)        this.resAcc.textContent        = acc.toFixed(1) + ' %';
    if(this.resOffsetAvg)  this.resOffsetAvg.textContent  = this.offsetStats.count ? offsetAvg.toFixed(1)+' ms' : '-';
    if(this.resOffsetStd)  this.resOffsetStd.textContent  = this.offsetStats.count ? offsetStd.toFixed(1)+' ms' : '-';
    if(this.resDuration)   this.resDuration.textContent   = durationSec.toFixed(1) + ' s';
    if(this.resParticipant)this.resParticipant.textContent= this.researchMeta.participant || '-';
    if(this.resRank)       this.resRank.textContent       = grade;

    if(this.resQualityNote){
      if(qualityNote){
        this.resQualityNote.textContent = qualityNote;
        this.resQualityNote.classList.remove('hidden');
      }else{
        this.resQualityNote.textContent = '';
        this.resQualityNote.classList.add('hidden');
      }
    }

    // session summary สำหรับ CSV
    const summary = {
      session_id: this.sessionId + '-' + String(this.sessionSummaries.length+1).padStart(2,'0'),
      build_version: 'RhythmBoxer_5lane_rank_fever_v1',
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
      offset_avg_abs_ms: this.offsetStats.count ? Math.abs(offsetAvg).toFixed(2) : '',
      fever_used: this.stats.feverUsed,
      duration_s: durationSec.toFixed(3),
      end_reason: endReason,
      grade_rank: grade,
      quality_ok: qualityOk
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

/* ---------- init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const game = new RhythmBoxerGame();
  window.__rhythmBoxer = game;
});