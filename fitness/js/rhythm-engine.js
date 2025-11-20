// === fitness/js/rhythm-engine.js ===
// Logic หลักของ Rhythm Boxer (3 lane: บน/กลาง/ล่าง)
'use strict';

export class RhythmEngine {
  /**
   * opts = {
   *   mode: 'normal' | 'research',
   *   diff: 'easy'|'normal'|'hard',
   *   track: 'track1'|'track2'|'track3',
   *   durationSec: number,
   *   onState(state),
   *   onEnd(result),
   *   onJudge(note, judge) // {grade, deltaMs}
   * }
   */
  constructor(opts = {}) {
    this.mode = opts.mode || 'normal';
    this.diff = opts.diff || 'normal';
    this.track = opts.track || 'track1';
    this.durationSec = opts.durationSec || 60;

    this.onState = opts.onState || null;
    this.onEnd   = opts.onEnd || null;
    this.onJudge = opts.onJudge || null;

    this.lanes = 3;
    this.travelSec = 1.2;       // เวลาเดินทางของโน้ตจากบนลงถึงเส้น
    this.hitWindowPerfect = 0.10;
    this.hitWindowGood    = 0.22;
    this.hitWindowMiss    = 0.35;

    this.notes = this._buildPattern();
    this.startMs = null;
    this.running = false;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfect = 0;
    this.miss = 0;
    this.totalHits = 0;
    this.timeSec = 0;
    this.rtSamples = [];

    this._missTimers = [];
  }

  /* ---------- สร้าง pattern: warm-up → dance → cool-down ---------- */

  _buildPattern() {
    const notes = [];
    let bpm;
    let densityWarm, densityDance, densityCool;
    let duration = this.durationSec;

    if (this.diff === 'easy') {
      bpm = 100;
      densityWarm = 0.4;
      densityDance = 0.6;
      densityCool = 0.4;
    } else if (this.diff === 'hard') {
      bpm = 135;
      densityWarm = 0.7;
      densityDance = 1.0;
      densityCool = 0.7;
    } else {
      // normal
      bpm = 120;
      densityWarm = 0.6;
      densityDance = 0.8;
      densityCool = 0.6;
    }

    const beatSec = 60 / bpm;
    const warmEnd  = duration * 0.25;
    const danceEnd = duration * 0.75;
    const coolEnd  = duration;

    let t = 2.0; // เริ่มไม่ให้เร็วเกินไป

    // seed แบบง่าย: track เปลี่ยน pattern
    let seed = 1;
    if (this.track === 'track2') seed = 17;
    else if (this.track === 'track3') seed = 31;

    function rnd() {
      // LCG เล็ก ๆ
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    while (t < coolEnd - 1.0) {
      let density = densityDance;
      if (t < warmEnd) density = densityWarm;
      else if (t > danceEnd) density = densityCool;

      if (rnd() < density) {
        const lane = this._pickLane(t, rnd);
        notes.push({
          id: notes.length + 1,
          lane,
          timeSec: t,
          judged: false,
          hit: false
        });
      }

      // บางช่วงให้ double hit
      if (t > warmEnd && t < danceEnd && rnd() < density * 0.2) {
        const lane2 = (notes[notes.length - 1]?.lane + 1) % this.lanes;
        notes.push({
          id: notes.length + 1,
          lane: lane2,
          timeSec: t + beatSec * 0.5,
          judged: false,
          hit: false
        });
      }

      t += beatSec;
    }

    return notes;
  }

  _pickLane(t, rnd) {
    // Pattern ต่างกันตาม track
    const r = rnd();
    if (this.track === 'track1') {
      // บน/กลาง เยอะในช่วงต้น แล้วค่อยเพิ่มล่าง
      if (t < this.durationSec * 0.4) {
        return r < 0.5 ? 0 : 1;
      }
      return r < 0.33 ? 0 : (r < 0.66 ? 1 : 2);
    }
    if (this.track === 'track2') {
      // เน้นกลาง + คั่นบนล่าง
      if (r < 0.5) return 1;
      return r < 0.75 ? 0 : 2;
    }
    // track3: สลับ pattern เป็นชุด ๆ
    const segment = Math.floor(t / 4) % 3;
    if (segment === 0) return 0;
    if (segment === 1) return 1;
    return 2;
  }

  /* ---------- ควบคุมเกม ---------- */

  start() {
    this.startMs = performance.now();
    this.running = true;

    // ตั้ง timer auto-miss สำหรับแต่ละโน้ต
    this._missTimers = this.notes.map(n => {
      const delayMs = (n.timeSec + this.hitWindowMiss) * 1000;
      return setTimeout(() => {
        if (!this.running || n.judged) return;
        this._applyJudge(n, 'miss', this.hitWindowMiss * 1000);
      }, delayMs);
    });

    this._tickLoop();
  }

  stop(reason = 'stop') {
    if (!this.running) return;
    this.running = false;
    this._missTimers.forEach(id => clearTimeout(id));
    this._missTimers.length = 0;

    const acc = this._calcAccuracy();
    const avgRt = this._calcAvgRt();

    if (this.onEnd) {
      this.onEnd({
        mode: this.mode,
        diff: this.diff,
        track: this.track,
        score: this.score,
        comboMax: this.maxCombo,
        perfect: this.perfect,
        miss: this.miss,
        totalHits: this.totalHits,
        accuracy: acc,
        avgRtMs: avgRt,
        reason
      });
    }
  }

  _tickLoop() {
    if (!this.running) return;

    const now = performance.now();
    this.timeSec = (now - this.startMs) / 1000;

    if (this.timeSec >= this.durationSec + 1.0) {
      this.stop('finished');
      return;
    }

    if (this.onState) {
      this.onState({
        mode: this.mode,
        diff: this.diff,
        track: this.track,
        timeSec: this.timeSec,
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo,
        perfect: this.perfect,
        miss: this.miss,
        totalHits: this.totalHits
      });
    }

    requestAnimationFrame(() => this._tickLoop());
  }

  /* ---------- การกดชก / hit ---------- */

  hitLane(lane) {
    if (!this.running) return;
    const now = performance.now();
    const tNow = (now - this.startMs) / 1000;

    // หาโน้ตใน lane เดียวกันที่ยังไม่ตัดสิน และอยู่ในช่วง window
    let best = null;
    let bestAbs = Infinity;

    for (const n of this.notes) {
      if (n.judged) continue;
      if (n.lane !== lane) continue;
      const dt = tNow - n.timeSec;
      const abs = Math.abs(dt);
      if (abs <= this.hitWindowMiss && abs < bestAbs) {
        bestAbs = abs;
        best = { note: n, dt };
      }
    }

    if (!best) {
      // กดลอย ๆ — ตอนนี้ยังไม่นับโทษ
      return;
    }

    const note = best.note;
    const dt = best.dt;
    const absMs = Math.abs(dt * 1000);

    let grade;
    if (Math.abs(dt) <= this.hitWindowPerfect) grade = 'perfect';
    else if (Math.abs(dt) <= this.hitWindowGood) grade = 'good';
    else grade = 'miss';

    this._applyJudge(note, grade, absMs);
  }

  _applyJudge(note, grade, deltaMs) {
    if (note.judged) return;
    note.judged = true;

    if (grade === 'miss') {
      this.miss++;
      this.combo = 0;
    } else {
      note.hit = true;
      this.totalHits++;
      if (grade === 'perfect') {
        this.perfect++;
        this.combo++;
        this.score += 40;
      } else if (grade === 'good') {
        this.combo++;
        this.score += 22;
      }

      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.rtSamples.push(deltaMs);
    }

    if (this.onJudge) {
      this.onJudge(note, { grade, deltaMs });
    }

    if (this.onState) {
      this.onState({
        mode: this.mode,
        diff: this.diff,
        track: this.track,
        timeSec: this.timeSec,
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo,
        perfect: this.perfect,
        miss: this.miss,
        totalHits: this.totalHits
      });
    }
  }

  _calcAccuracy() {
    const total = this.totalHits + this.miss;
    if (total === 0) return 0;
    return (this.totalHits / total) * 100;
  }

  _calcAvgRt() {
    if (!this.rtSamples.length) return 0;
    let sum = 0;
    for (const v of this.rtSamples) sum += v;
    return sum / this.rtSamples.length;
  }
}
