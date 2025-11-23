// === /fitness/js/rhythm-engine.js — Rhythm Boxer Research Build (2025-11-25) ===
'use strict';

/* ----------------------------------------------------------------------------
   CONFIG
---------------------------------------------------------------------------- */

const NOTE_EMOJI_BY_LANE = ['🎵','🎶','🎵','🎶','🎼'];

const TRACKS = {
  t1: {
    id: 't1',
    name: 'Warm-up Groove',
    bpm: 100,
    duration: 38,
    audio: 'audio/t1.mp3',
    chart: []
  },
  t2: {
    id: 't2',
    name: 'Punch Rush',
    bpm: 118,
    duration: 41,
    audio: 'audio/t2.mp3',
    chart: []
  },
  t3: {
    id: 't3',
    name: 'Ultra Beat Combo',
    bpm: 135,
    duration: 50,
    audio: 'audio/t3.mp3',
    chart: []
  },
  research: {
    id: 'research',
    name: 'Research Track (120 BPM)',
    bpm: 120,
    duration: 40,
    audio: 'audio/research.mp3',
    chart: []
  }
};

/* Timing windows (ms) */
const HIT_WINDOW = {
  perfect: 60,
  great: 110,
  good: 155
};

/* Difficulty scaling */
function getNoteSpeed(diff) {
  if (diff === 'easy') return 3.3;
  if (diff === 'hard') return 2.35;
  return 2.8;
}

/* ----------------------------------------------------------------------------
   DOM SHORTCUTS
---------------------------------------------------------------------------- */
const $ = (s) => document.querySelector(s);

/* ----------------------------------------------------------------------------
   GAME CLASS
---------------------------------------------------------------------------- */

class RhythmBoxerGame {
  constructor() {
    this.wrap = $('#rb-wrap');
    this.viewMenu = $('#rb-view-menu');
    this.viewPlay = $('#rb-view-play');
    this.viewResult = $('#rb-view-result');

    this.field = $('#rb-field');
    this.lanes = $('#rb-lanes');
    this.audio = $('#rb-audio');

    this.btnStart = $('#rb-btn-start');
    this.btnStop = $('#rb-btn-stop');
    this.btnBackMenu = $('#rb-btn-back-menu');
    this.btnAgain = $('#rb-btn-again');
    this.btnDlEvents = $('#rb-btn-dl-events');
    this.btnDlSessions = $('#rb-btn-dl-sessions');

    this.hud = {
      mode: $('#rb-hud-mode'),
      track: $('#rb-hud-track'),
      score: $('#rb-hud-score'),
      combo: $('#rb-hud-combo'),
      acc: $('#rb-hud-acc'),
      hp: $('#rb-hud-hp'),
      shield: $('#rb-hud-shield'),
      time: $('#rb-hud-time'),
      perfect: $('#rb-hud-perfect'),
      great: $('#rb-hud-great'),
      good: $('#rb-hud-good'),
      miss: $('#rb-hud-miss')
    };

    this.feverFill = $('#rb-fever-fill');
    this.feverStatus = $('#rb-fever-status');
    this.progressFill = $('#rb-progress-fill');
    this.progressText = $('#rb-progress-text');

    this.feedback = $('#rb-feedback');
    this.flash = $('#rb-flash');

    this.result = {
      mode: $('#rb-res-mode'),
      track: $('#rb-res-track'),
      end: $('#rb-res-endreason'),
      score: $('#rb-res-score'),
      maxcombo: $('#rb-res-maxcombo'),
      detailHit: $('#rb-res-detail-hit'),
      acc: $('#rb-res-acc'),
      offsetAvg: $('#rb-res-offset-avg'),
      offsetStd: $('#rb-res-offset-std'),
      duration: $('#rb-res-duration'),
      participant: $('#rb-res-participant'),
      rank: $('#rb-res-rank')
    };

    this.setupUI();
    this.reset();
  }

  /* --------------------- UI SETUP --------------------- */

  setupUI() {
    this.btnStart.addEventListener('click', () => this.startGame());
    this.btnStop.addEventListener('click', () => this.stopGame('หยุดก่อนเวลา'));
    this.btnBackMenu.addEventListener('click', () => this.showMenu());
    this.btnAgain.addEventListener('click', () => this.startGame(true));
    this.btnDlEvents.addEventListener('click', () => this.downloadEventCsv());
    this.btnDlSessions.addEventListener('click', () => this.downloadSessionCsv());

    document.querySelectorAll('input[name="mode"]').forEach(el => {
      el.addEventListener('change', () => {
        const val = document.querySelector('input[name="mode"]:checked').value;
        $('#rb-research-fields').classList.toggle('hidden', val !== 'research');
      });
    });
  }

  /* --------------------- STATE RESET --------------------- */

  reset() {
    this.mode = 'normal';
    this.track = TRACKS.t1;
    this.diff = 'normal';

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    this.hp = 100;
    this.shield = 0;

    this.perfect = 0;
    this.great = 0;
    this.good = 0;
    this.miss = 0;

    this.fever = 0;
    this.feverOn = false;

    this.notes = [];
    this.noteId = 1;

    this.eventLogs = [];
    this.sessionLogs = [];

    this.startPerf = 0;
    this.playing = false;

    if (this.field) this.field.classList.remove('rb-shake');
  }

  /* --------------------- MENU → PLAY --------------------- */

  startGame(replaySame = false) {
    this.reset();

    const mode = document.querySelector('input[name="mode"]:checked').value;
    this.mode = mode;

    const trackSel = $('#rb-track').value;
    if (mode === 'research') {
      this.track = TRACKS['research'];
    } else {
      this.track = TRACKS[trackSel];
    }

    this.hud.mode.textContent = mode === 'normal' ? 'Normal' : 'Research';
    this.hud.track.textContent = this.track.name;

    if (!replaySame) {
      this.sessionId = 'RB-' + Date.now();
      this.runIndex = 1;
    } else {
      this.runIndex++;
    }

    this.notes = [];
    this.noteId = 1;

    this.audio.src = this.track.audio;

    this.makeChart();

    const offsetFix = () => {
      this.audio.play().then(() => {
        this.startPerf = performance.now();
        this.playing = true;
        this.updateLoop();
      }).catch(() => {
        this.feedback.textContent = '🔇 แตะหน้าจอ 1 ครั้ง เพื่อเริ่มเพลง';
        this.feedback.classList.add('good');
        const h = () => {
          this.audio.play().then(() => {
            document.removeEventListener('pointerdown', h);
            this.startPerf = performance.now();
            this.playing = true;
            this.feedback.textContent = '';
            this.feedback.className = 'rb-feedback';
            this.updateLoop();
          });
        };
        document.addEventListener('pointerdown', h);
      });
    };

    offsetFix();

    this.showView('play');
  }

  /* --------------------- CHART CREATION --------------------- */

  makeChart() {
    const bpm = this.track.bpm;
    const spb = 60_000 / bpm;

    for (let t = 800; t < this.track.duration * 1000; t += spb) {
      const lane = Math.floor(Math.random() * 5);
      const typeRnd = Math.random();

      let type = 'note';
      if (typeRnd < 0.08) type = 'bomb';
      else if (typeRnd < 0.12) type = 'shield';
      else if (typeRnd < 0.16) type = 'heal';

      this.notes.push({
        id: this.noteId++,
        lane,
        hit: false,
        tSpawn: t,
        tHit: t + 1100,
        emoji: type === 'note' ? NOTE_EMOJI_BY_LANE[lane] :
               type === 'bomb' ? '💣' :
               type === 'shield' ? '🛡' : '💙',
        type,
        el: null,
        y: -40
      });
    }
  }

  /* --------------------- NOTE CREATION --------------------- */

  createNote(n) {
    const laneEl = this.lanes.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
    if (!laneEl) return;

    const el = document.createElement('div');
    el.className = 'rb-note';
    el.textContent = n.emoji;
    laneEl.appendChild(el);
    n.el = el;
    requestAnimationFrame(() => el.classList.add('rb-note-spawned'));

    el.addEventListener('pointerdown', () => this.handleHit(n));
  }

  /* --------------------- HIT / MISS LOGIC --------------------- */

  handleHit(n) {
    if (n.hit || !this.playing) return;
    n.hit = true;

    const now = performance.now();
    const songTime = now - this.startPerf;
    const offset = songTime - n.tHit;

    let grade = 'miss';
    const ao = Math.abs(offset);
    if (ao <= HIT_WINDOW.perfect) grade = 'perfect';
    else if (ao <= HIT_WINDOW.great) grade = 'great';
    else if (ao <= HIT_WINDOW.good) grade = 'good';

    let delta = 0;

    if (n.type === 'bomb') {
      if (this.shield > 0) {
        delta = 0;
        this.shield--;
        this.popupScore(n, 'shield', '+0');
        this.feedbackShow('shield');
      } else {
        delta = -80;
        this.hp = Math.max(0, this.hp - 12);
        this.flashDamage();
        this.shake();
        this.popupScore(n, 'bomb', '-80');
        this.feedbackShow('bomb');
      }
    }
    else if (n.type === 'shield') {
      this.shield++;
      delta = 0;
      this.popupScore(n, 'shield', '+Shield');
      this.feedbackShow('shield');
    }
    else if (n.type === 'heal') {
      this.hp = Math.min(100, this.hp + 12);
      delta = 0;
      this.popupScore(n, 'good', '+HP');
      this.feedbackShow('good');
    }
    else {
      if (grade === 'perfect') {
        delta = 150; this.perfect++;
      } else if (grade === 'great') {
        delta = 100; this.great++;
      } else if (grade === 'good') {
        delta = 60; this.good++;
      } else {
        delta = 0; this.miss++;
      }

      if (grade === 'miss') {
        this.combo = 0;
      } else {
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
      }

      this.popupScore(n, grade, delta);
      this.feedbackShow(grade);
    }

    this.score += delta;

    if (n.el) n.el.remove();

    this.logEvent(n, {
      event: grade === 'miss' ? 'miss' : 'hit',
      grade,
      offset,
      songTime,
      delta
    });

    if (this.hp <= 0) {
      this.stopGame('HP หมด');
    }
  }

  /* --------------------- FEEDBACK / VFX --------------------- */

  popupScore(n, kind, text) {
    const laneEl = this.lanes.querySelector(`.rb-lane[data-lane="${n.lane}"]`);
    if (!laneEl) return;

    const el = document.createElement('div');
    el.className =
      'rb-score-popup ' +
      (kind === 'perfect' ? 'rb-score-perfect' :
       kind === 'great' ? 'rb-score-great' :
       kind === 'good' ? 'rb-score-good' :
       kind === 'bomb' ? 'rb-score-bomb' :
       kind === 'shield' ? 'rb-score-shield' :
       'rb-score-miss');

    el.textContent = text;
    laneEl.appendChild(el);

    setTimeout(() => el.remove(), 620);
  }

  feedbackShow(grade) {
    this.feedback.className = 'rb-feedback ' + grade;
    if (grade === 'perfect') this.feedback.textContent = 'Perfect! ⭐';
    else if (grade === 'great') this.feedback.textContent = 'Great!';
    else if (grade === 'good') this.feedback.textContent = 'Good!';
    else if (grade === 'bomb') this.feedback.textContent = 'โดนระเบิด! 💥';
    else if (grade === 'shield') this.feedback.textContent = 'Shield +1 🛡';
    else this.feedback.textContent = 'Miss 😢';

    setTimeout(() => {
      this.feedback.className = 'rb-feedback';
      this.feedback.textContent = '';
    }, 900);
  }

  shake() {
    this.field.classList.add('rb-shake');
    setTimeout(() => this.field.classList.remove('rb-shake'), 420);
  }

  flashDamage() {
    this.flash.classList.add('active');
    setTimeout(() => this.flash.classList.remove('active'), 140);
  }

  /* --------------------- UPDATE LOOP --------------------- */

  updateLoop = () => {
    if (!this.playing) return;

    const now = performance.now();
    const songTime = now - this.startPerf;

    this.hud.hp.textContent = this.hp;
    this.hud.shield.textContent = this.shield;

    for (const n of this.notes) {
      if (n.hit) continue;

      const d = n.tHit - songTime;
      const speed = getNoteSpeed(this.diff);
      n.y = 320 - d / speed;

      if (!n.el && songTime >= n.tSpawn - 1600) {
        this.createNote(n);
      }
      if (n.el) {
        n.el.style.transform =
          `translateX(-50%) translateY(${n.y}px)`;
      }

      if (n.y > 260 && !n.hit) {
        n.hit = true;

        let offset = songTime - n.tHit;
        this.miss++;
        this.combo = 0;

        if (n.el) n.el.remove();

        this.logEvent(n, {
          event: 'miss',
          grade: 'miss',
          offset,
          songTime,
          delta: 0
        });

        if (n.type === 'bomb') {
          if (this.shield > 0) {
            this.shield--;
            this.feedbackShow('shield');
          } else {
            this.hp = Math.max(0, this.hp - 10);
            this.flashDamage();
            this.shake();
            this.feedbackShow('bomb');
          }
        } else if (n.type === 'shield') {
          // do nothing on miss
        } else if (n.type === 'heal') {
          // nothing
        } else {
          this.feedbackShow('miss');
        }

        if (this.hp <= 0) {
          this.stopGame('HP หมด');
          return;
        }
      }
    }

    const pct = Math.min(100, (songTime / (this.track.duration * 1000)) * 100);
    this.progressFill.style.transform = `scaleX(${pct / 100})`;
    this.progressText.textContent = `${pct.toFixed(0)}%`;

    this.hud.score.textContent = this.score;
    this.hud.combo.textContent = this.combo;

    const totalHit = this.perfect + this.great + this.good + this.miss;
    const acc = totalHit ? ((this.perfect*100 + this.great*80 + this.good*60) / (totalHit*100)) * 100 : 0;
    this.hud.acc.textContent = acc.toFixed(1) + '%';

    this.hud.perfect.textContent = this.perfect;
    this.hud.great.textContent = this.great;
    this.hud.good.textContent = this.good;
    this.hud.miss.textContent = this.miss;

    if (songTime >= this.track.duration * 1000) {
      this.stopGame('เพลงจบ');
      return;
    }

    requestAnimationFrame(this.updateLoop);
  };

  /* --------------------- STOP GAME --------------------- */

  stopGame(reason) {
    if (!this.playing) return;
    this.playing = false;

    this.audio.pause();

    const now = performance.now();
    const duration = (now - this.startPerf) / 1000;

    const totalHit = this.perfect + this.great + this.good + this.miss;
    const acc = totalHit ? ((this.perfect*100 + this.great*80 + this.good*60) / (totalHit*100)) * 100 : 0;

    const offsets = this.eventLogs.filter(e => e.grade !== 'miss').map(e => e.offset_ms);
    const avg = offsets.length ? offsets.reduce((a,b)=>a+b,0) / offsets.length : 0;
    const sd = offsets.length > 1
      ? Math.sqrt(offsets.reduce((a,b)=>a+b*b,0)/offsets.length - avg*avg)
      : 0;

    const rank = this.computeRank(acc, this.score);

    this.result.mode.textContent = this.mode;
    this.result.track.textContent = this.track.name;
    this.result.end.textContent = reason;
    this.result.score.textContent = this.score;
    this.result.maxcombo.textContent = this.maxCombo;
    this.result.detailHit.textContent =
      `${this.perfect} / ${this.great} / ${this.good} / ${this.miss}`;
    this.result.acc.textContent = acc.toFixed(1)+'%';
    this.result.offsetAvg.textContent = avg.toFixed(1)+' ms';
    this.result.offsetStd.textContent = sd.toFixed(1)+' ms';
    this.result.duration.textContent = duration.toFixed(1)+' s';
    this.result.participant.textContent =
      (this.mode === 'research' ? $('#rb-participant').value : '-');
    this.result.rank.textContent = rank;

    this.sessionLogs.push({
      session_id: this.sessionId,
      run_index: this.runIndex,
      mode: this.mode,
      track_id: this.track.id,
      track_name: this.track.name,
      score: this.score,
      max_combo: this.maxCombo,
      perfect: this.perfect,
      great: this.great,
      good: this.good,
      miss: this.miss,
      accuracy: acc.toFixed(2),
      offset_avg: avg.toFixed(2),
      offset_sd: sd.toFixed(2),
      duration_s: duration.toFixed(3),
      participant: (this.mode === 'research' ? $('#rb-participant').value : ''),
      group: (this.mode === 'research' ? $('#rb-group').value : '')
    });

    this.showView('result');
  }

  /* --------------------- RANK --------------------- */

  computeRank(acc, score) {
    if (acc >= 95 && score >= 8000) return 'SSS';
    if (acc >= 92 && score >= 7000) return 'SS';
    if (acc >= 88 && score >= 6000) return 'S';
    if (acc >= 80 && score >= 4800) return 'A';
    if (acc >= 70 && score >= 3500) return 'B';
    return 'C';
  }

  /* --------------------- LOGGING --------------------- */

  logEvent(n, obj) {
    this.eventLogs.push({
      session_id: this.sessionId,
      run_index: this.runIndex,
      mode: this.mode,
      track_id: this.track.id,
      track_name: this.track.name,
      participant: (this.mode === 'research' ? $('#rb-participant').value : ''),
      group: (this.mode === 'research' ? $('#rb-group').value : ''),
      note_id: n.id,
      lane: n.lane,
      event_type: obj.event,
      grade: obj.grade,
      offset_ms: obj.offset,
      song_time_s: obj.songTime / 1000,
      accuracy_pct: this.hud.acc.textContent.replace('%',''),
      score_delta: obj.delta,
      score_total: this.score,
      combo: this.combo
    });
  }

  toCsv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = v=>{
      if (v==null) return '';
      const s=String(v);
      if (s.includes(',')||s.includes('"')||s.includes('\n'))
        return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const lines=[ cols.join(',') ];
    for (const r of rows){
      lines.push(cols.map(c=>esc(r[c])).join(','));
    }
    return lines.join('\n');
  }

  downloadEventCsv() {
    const csv = this.toCsv(this.eventLogs);
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download = `rhythm-events-${this.sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadSessionCsv() {
    const csv = this.toCsv(this.sessionLogs);
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download = `rhythm-session-${this.sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* --------------------- VIEW SWITCH --------------------- */

  showView(v){
    this.viewMenu.classList.add('hidden');
    this.viewPlay.classList.add('hidden');
    this.viewResult.classList.add('hidden');

    if (v==='menu') this.viewMenu.classList.remove('hidden');
    else if (v==='play') this.viewPlay.classList.remove('hidden');
    else if (v==='result') this.viewResult.classList.remove('hidden');
  }

  showMenu(){
    this.showView('menu');
  }
}

/* ----------------------------------------------------------------------------
   BOOT
---------------------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded',()=>{
  window.__rb = new RhythmBoxerGame();
});