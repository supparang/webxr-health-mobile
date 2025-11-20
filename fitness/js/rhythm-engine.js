// === fitness/js/rhythm-engine.js
// Simple 3-lane rhythm engine + Bloom bar + keyboard / tap control
'use strict';

/**
 * options:
 *  - mode, difficulty, trackLabel
 *  - onFinish(summary)
 */
export function initRhythmEngine(options = {}) {
  const engine = new RhythmEngine(options);
  engine.start();        // ให้เริ่มเล่นทันทีเมื่อถูกเรียกจาก rhythm-boxer.js
  return engine;
}

class RhythmEngine {
  constructor(opts = {}) {
    // ----- DOM refs -----
    this.noteLayer   = document.getElementById('note-layer');
    this.playArea    = document.getElementById('play-area');

    this.elMode      = document.getElementById('stat-mode');
    this.elDiff      = document.getElementById('stat-diff');
    this.elTrack     = document.getElementById('stat-track');
    this.elTime      = document.getElementById('stat-time');
    this.elTimeSmall = document.getElementById('stat-time-small');

    this.elScore     = document.getElementById('stat-score');
    this.elCombo     = document.getElementById('stat-combo');
    this.elPerfect   = document.getElementById('stat-perfect');
    this.elMiss      = document.getElementById('stat-miss');

    this.elBloomFill   = document.getElementById('bloom-fill');
    this.elBloomStatus = document.getElementById('bloom-status');
    this.elCoachText   = document.getElementById('coach-text');

    this.audioWarmup = document.getElementById('bgm-warmup');
    this.audioDance  = document.getElementById('bgm-dance');
    this.audioCool   = document.getElementById('bgm-cool');

    // ถ้า DOM บางตัวไม่มี ก็ไม่เป็นไร (กัน error)
    const safe = (el, v = '') => { if (el) el.textContent = v; };

    // ----- config จากเมนู -----
    this.mode        = opts.mode        || 'ปกติ';
    this.difficulty  = opts.difficulty  || 'easy';
    this.trackKey    = opts.trackKey    || 'track1';
    this.trackLabel  = opts.trackLabel  || 'Track 1 — Warm-up Mix (เวอร์ชันวอร์มอัพ)';
    this.onFinish    = typeof opts.onFinish === 'function' ? opts.onFinish : () => {};

    safe(this.elMode,  this.mode);
    safe(this.elDiff,  diffLabel(this.difficulty));
    safe(this.elTrack, this.trackLabel);

    // ----- internal state -----
    this.started     = false;
    this.ended       = false;
    this.startTime   = 0;
    this.lastTime    = 0;

    this.score   = 0;
    this.combo   = 0;
    this.maxCombo = 0;
    this.perfect = 0;
    this.miss    = 0;
    this.totalHits = 0;

    // Bloom 0..1
    this.bloom = 0.2;

    // active notes
    this.notes = [];
    this.nextIndex = 0;

    // pattern + timing
    this.pattern   = buildPattern(this.trackKey, this.difficulty);
    this.lookAhead = 1.0;       // วินาทีก่อนถึงเวลา note ที่เริ่ม spawn
    this.fallTime  = 1.2;       // เวลาให้โน้ตตกจากบนสุดถึงเส้นเป้า
    this.totalDuration = this.pattern.length
      ? this.pattern[this.pattern.length - 1].time + 4
      : 30;

    // input binding
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick   = this.handleClick.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    if (this.playArea) {
      this.playArea.addEventListener('pointerdown', this.handleClick);
    }

    safe(this.elBloomStatus, 'WARM UP');
    this.updateBloomBar();
    this.updateHud(0);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.startTime = performance.now();
    this.lastTime  = this.startTime;

    // เล่นเพลง warm-up ก่อน (track นี้เรายิงเฉพาะ warm-up)
    if (this.audioWarmup) {
      this.audioWarmup.currentTime = 0;
      this.audioWarmup.play().catch(() => {});
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  loop(now) {
    if (!this.started || this.ended) return;

    const elapsed = (now - this.startTime) / 1000; // sec
    this.updateGame(elapsed);

    if (!this.ended) {
      requestAnimationFrame(this.loop.bind(this));
    }
  }

  updateGame(t) {
    // timer
    this.updateHud(t);

    // spawn notes ล่วงหน้า
    while (this.nextIndex < this.pattern.length &&
           this.pattern[this.nextIndex].time <= t + this.lookAhead) {
      const data = this.pattern[this.nextIndex++];
      this.spawnNote(data);
    }

    // move notes
    const areaRect = this.playArea ? this.playArea.getBoundingClientRect() : null;
    const height   = areaRect ? areaRect.height : 400;

    const judgeY   = height - 80; // เส้นเป้าอยู่ใกล้ด้านล่าง

    this.notes.forEach(note => {
      if (note.hit || note.missed) return;

      const dt = t - note.time;
      const yNorm = 1 - (note.time - t + this.fallTime) / this.fallTime; // 0..1
      const y = clamp(yNorm, 0, 1) * judgeY;

      note.y = y;
      if (note.el) {
        note.el.style.transform =
          `translate(${laneToX(note.lane, areaRect ? areaRect.width : 600)}px, ${y}px)`;
      }

      // ถ้าตกผ่านเส้นเป้าไปมากแล้ว → miss
      if (dt > 0.25 && !note.hit && !note.missed) {
        this.registerMiss(note);
      }
    });

    // ลบ note ที่พ้นจอไปแล้ว
    this.notes = this.notes.filter(n => !n.remove);

    // จบเพลงตามเวลา
    if (t >= this.totalDuration && !this.ended) {
      this.finish('timeup');
    }
  }

  updateHud(t) {
    const show = v => v != null ? v.toString() : '-';

    if (this.elTime)      this.elTime.textContent      = t.toFixed(1);
    if (this.elTimeSmall) this.elTimeSmall.textContent = t.toFixed(1);
    if (this.elScore)     this.elScore.textContent     = show(this.score);
    if (this.elCombo)     this.elCombo.textContent     = show(this.combo);
    if (this.elPerfect)   this.elPerfect.textContent   = show(this.perfect);
    if (this.elMiss)      this.elMiss.textContent      = show(this.miss);
  }

  spawnNote(data) {
    if (!this.noteLayer) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';
    noteEl.dataset.lane = String(data.lane);

    // สุ่มสีเล็กน้อยตาม lane
    noteEl.classList.add(`rb-note-lane-${data.lane}`);

    this.noteLayer.appendChild(noteEl);

    const note = {
      id:      'n' + Date.now() + '_' + Math.random().toString(16).slice(2),
      time:    data.time,
      lane:    data.lane,
      el:      noteEl,
      hit:     false,
      missed:  false,
      remove:  false,
      y:       0
    };

    this.notes.push(note);
  }

  // ----- input -----

  handleKeyDown(ev) {
    if (this.ended) return;

    let lane = null;
    switch (ev.code) {
      case 'KeyW':
      case 'ArrowUp':
        lane = 0; break;     // top
      case 'KeyS':
      case 'Space':
        lane = 1; break;     // middle
      case 'KeyX':
      case 'ArrowDown':
        lane = 2; break;     // bottom
      default:
        return;
    }
    ev.preventDefault();
    this.tryHit(lane);
  }

  handleClick(ev) {
    if (this.ended) return;
    if (!this.playArea) return;

    const rect = this.playArea.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const laneWidth = rect.width / 3;
    const lane = clamp(Math.floor(x / laneWidth), 0, 2);
    this.tryHit(lane);
  }

  tryHit(lane) {
    if (!this.started) return;
    const now = (performance.now() - this.startTime) / 1000;

    // หา note ที่ยังไม่โดนและอยู่ lane เดียวกัน ใกล้เวลา now ที่สุด
    let best = null;
    let bestDt = 999;

    this.notes.forEach(note => {
      if (note.hit || note.missed || note.lane !== lane) return;
      const dt = Math.abs(now - note.time);
      if (dt < bestDt) {
        bestDt = dt;
        best = note;
      }
    });

    // ถ้าไกลเกิน 0.3s ถือว่า whiff (ไม่โดนอะไรเลย)
    if (!best || bestDt > 0.3) {
      this.registerWhiff();
      return;
    }

    // grading
    let grade = 'bad';
    let scoreDelta = 50;
    let bloomDelta = 0.03;

    if (bestDt <= 0.07) {
      grade = 'perfect';
      scoreDelta = 150;
      bloomDelta = 0.08;
      this.perfect++;
    } else if (bestDt <= 0.16) {
      grade = 'good';
      scoreDelta = 100;
      bloomDelta = 0.05;
    } else {
      grade = 'bad';
      scoreDelta = 40;
      bloomDelta = 0.02;
    }

    best.hit = true;
    best.remove = true;
    if (best.el && best.el.parentNode) {
      best.el.classList.add('rb-note-hit');
      setTimeout(() => {
        if (best.el && best.el.parentNode) best.el.parentNode.removeChild(best.el);
      }, 120);
    }

    this.score += scoreDelta;
    this.combo += 1;
    this.totalHits += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    this.bloom = clamp(this.bloom + bloomDelta, 0, 1);
    this.updateBloomBar();

    playSfx('perfect'); // ให้ไปแมปใน rhythm-boxer.html ด้วย id perfect.mp3/combination ก็ได้
    this.updateHud(now);

    if (this.elCoachText && grade === 'perfect') {
      this.elCoachText.textContent = 'เยี่ยม! ตรงเป๊ะเลย ✨';
    } else if (this.elCoachText && grade === 'good') {
      this.elCoachText.textContent = 'จังหวะดีมาก รักษาไว้! 🎵';
    }
  }

  registerMiss(note) {
    note.missed = true;
    note.remove = true;
    if (note.el && note.el.parentNode) {
      note.el.classList.add('rb-note-miss');
      setTimeout(() => {
        if (note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
      }, 120);
    }

    this.miss += 1;
    this.combo = 0;
    this.bloom = clamp(this.bloom - 0.06, 0, 1);
    this.updateBloomBar();
  }

  registerWhiff() {
    // กดผิดจังหวะ / ไม่มีโน้ตใกล้ ๆ
    this.combo = 0;
    this.bloom = clamp(this.bloom - 0.03, 0, 1);
    this.updateBloomBar();
    if (this.elCoachText) {
      this.elCoachText.textContent = 'ลองฟังจังหวะให้ชัด แล้วกดตอนเข้าเส้นนะ 🎧';
    }
  }

  updateBloomBar() {
    if (this.elBloomFill) {
      this.elBloomFill.style.width = (this.bloom * 100).toFixed(1) + '%';
    }
    if (!this.elBloomStatus) return;

    if (this.bloom < 0.3) {
      this.elBloomStatus.textContent = 'WARM UP';
    } else if (this.bloom < 0.7) {
      this.elBloomStatus.textContent = 'GROOVE';
    } else {
      this.elBloomStatus.textContent = 'FEVER MODE';
    }
  }

  finish(reason) {
    if (this.ended) return;
    this.ended = true;

    // หยุดเพลง
    [this.audioWarmup, this.audioDance, this.audioCool].forEach(a => {
      if (a && !a.paused) {
        a.pause();
      }
    });

    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.playArea) {
      this.playArea.removeEventListener('pointerdown', this.handleClick);
    }

    const totalTime = (performance.now() - this.startTime) / 1000;

    const summary = {
      reason,
      score: this.score,
      comboMax: this.maxCombo,
      perfect: this.perfect,
      miss: this.miss,
      totalHits: this.totalHits,
      totalTime: totalTime.toFixed(2),
      bloomFinal: this.bloom
    };

    try { this.onFinish(summary); } catch (e) { console.error(e); }
  }
}

// ---------- helpers ----------

function diffLabel(diff) {
  switch (diff) {
    case 'easy':   return 'ง่าย — โน้ตน้อย / ช่องกว้าง';
    case 'hard':   return 'ยาก — โน้ตถี่ / เร็ว';
    default:       return 'ปกติ — มาตรฐาน';
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// แปลง lane (0,1,2) → ตำแหน่ง x (px) ภายใน playArea
function laneToX(lane, width) {
  const w = width || 600;
  const laneWidth = w / 3;
  // ให้โน้ตอยู่กลาง lane
  return laneWidth * lane + laneWidth / 2 - 24; // 24 ~ radius
}

/**
 * สร้าง pattern ง่าย ๆ:
 * - track1: warm-up → ตีทุก 0.8s / 1.0s สลับ lane
 */
function buildPattern(trackKey, diff) {
  const list = [];

  let interval = 0.9;
  if (diff === 'easy') interval = 1.0;
  else if (diff === 'hard') interval = 0.7;

  const totalBeats = 40; // ให้เล่นยาวประมาณ 40 beat
  let t = 1.0; // เริ่มหลังจากเริ่มเพลง 1 วิ
  let lane = 1;

  for (let i = 0; i < totalBeats; i++) {
    // ลำดับ lane 1-0-2-1-2-0 วนไป
    if (i % 6 === 0) lane = 1;
    else if (i % 6 === 1) lane = 0;
    else if (i % 6 === 2) lane = 2;
    else if (i % 6 === 3) lane = 1;
    else if (i % 6 === 4) lane = 2;
    else lane = 0;

    list.push({ time: t, lane });
    t += interval;
  }

  return list;
}

// dummy – ตอนนี้เราใช้ audio id แทน ถ้าจะให้ตรงสามารถ map id เพิ่มได้
function playSfx(/*kind*/) {
  // สามารถไปผูก <audio id="sfx-perfect"> ฯลฯ เพิ่มถ้าต้องการ
}
