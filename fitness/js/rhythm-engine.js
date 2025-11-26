// === js/rhythm-engine.js — Rhythm Boxer Engine (research-ready, 2025-11-30b) ===
'use strict';

(function () {

  // ===== CONSTANTS =====
  const PRE_SPAWN_SEC = 2.0;
  const HIT_WINDOWS = {
    perfect: 0.06,
    great:   0.11,
    good:    0.18
  };
  const MISS_WINDOW = HIT_WINDOWS.good + 0.05;

  // ===== UTILITIES =====
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const $id   = (id) => document.getElementById(id);

  function makeSessionId() {
    const t = new Date();
    return (
      'RB-' +
      t.getFullYear() +
      String(t.getMonth() + 1).padStart(2, '0') +
      String(t.getDate()).padStart(2, '0') +
      '-' +
      String(t.getHours()).padStart(2, '0') +
      String(t.getMinutes()).padStart(2, '0') +
      String(t.getSeconds()).padStart(2, '0')
    );
  }

  class EventLogger {
    constructor() {
      this.rows = [];
    }
    clear() {
      this.rows = [];
    }
    add(row) {
      this.rows.push(row);
    }
    toCsv() {
      if (!this.rows.length) return '';
      const cols = Object.keys(this.rows[0]);
      const esc = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const lines = [cols.join(',')];
      for (const r of this.rows) {
        lines.push(cols.map((c) => esc(r[c])).join(','));
      }
      return lines.join('\n');
    }
  }

  // ===== TRACKS & CHART =====

  function makeWarmupChart(bpm, durationSec) {
    const notes = [];
    const beat  = 60 / bpm;
    let t = 2.0; // เริ่มหลัง intro 2s
    const laneSeq = [2, 1, 3, 2, 1, 3, 2, 3, 1, 4, 2, 3];
    const maxT = durationSec - 1.5;
    let i = 0;
    while (t <= maxT) {
      const lane = laneSeq[i % laneSeq.length];
      notes.push({ time: t, lane, kind: 'normal' });
      t += beat;
      i++;
    }
    return notes;
  }

  const TRACKS = [
    {
      id: 't1',
      name: 'Warm-up Groove (ง่าย)',
      nameShort: 'Warm-up Groove',
      audio: 'audio/warmup-groove.mp3',
      duration: 32,
      bpm: 100,
      diff: 'easy',
      chart: makeWarmupChart(100, 32)
    },
    {
      id: 't2',
      name: 'Punch Rush (ปกติ)',
      nameShort: 'Punch Rush',
      audio: 'audio/punch-rush.mp3',
      duration: 36,
      bpm: 120,
      diff: 'normal',
      chart: makeWarmupChart(120, 36)
    },
    {
      id: 't3',
      name: 'Ultra Beat Combo (ยาก)',
      nameShort: 'Ultra Beat Combo',
      audio: 'audio/ultra-beat-combo.mp3',
      duration: 40,
      bpm: 132,
      diff: 'hard',
      chart: makeWarmupChart(132, 40)
    },
    {
      id: 'research',
      name: 'Research Track 120 (วิจัย)',
      nameShort: 'Research 120',
      audio: 'audio/research-120.mp3',
      duration: 32,
      bpm: 120,
      diff: 'normal',
      chart: makeWarmupChart(120, 32)
    }
  ];

  function pickTrack(id, mode) {
    if (mode === 'research') {
      const t = TRACKS.find((x) => x.id === 'research');
      if (t) return t;
    }
    return TRACKS.find((x) => x.id === id) || TRACKS[0];
  }

  // ===== ENGINE CLASS =====

  class RhythmBoxerEngine {
    constructor(opts) {
      opts = opts || {};

      this.wrap    = opts.wrap   || $id('rb-wrap')  || document.body;
      this.field   = opts.field  || $id('rb-field') || this.wrap;
      this.lanesEl = opts.lanesEl || $id('rb-lanes');
      this.audio   = opts.audio  || $id('rb-audio');

      this.renderer = opts.renderer || null;
      this.hooks    = opts.hooks    || {};

      this.hud = Object.assign(
        {
          mode: null,
          track: null,
          score: null,
          combo: null,
          acc: null,
          hp: null,
          shield: null,
          time: null,
          feverFill: null,
          feverStatus: null,
          progFill: null,
          progText: null,
          countPerfect: null,
          countGreat: null,
          countGood: null,
          countMiss: null
        },
        opts.hud || {}
      );

      this.events = new EventLogger();
      this.sessionCsv = '';

      this._resetState();
    }

    _resetState() {
      this.mode  = 'normal';
      this.track = TRACKS[0];

      this.sessionId   = null;
      this.participant = '';
      this.group       = '';
      this.note        = '';

      this.running   = false;
      this.ended     = false;
      this.startPerf = 0;
      this.lastPerf  = 0;
      this.songTime  = 0;

      this.chartIndex  = 0;
      this.activeNotes = [];
      this.totalNotes  = 0;

      // gameplay stats
      this.score    = 0;
      this.combo    = 0;
      this.maxCombo = 0;
      this.hp       = 100;
      this.shield   = 0;

      // FEVER
      this.feverGauge = 0;
      this.feverActive = false;
      this.feverCount  = 0;
      this.feverTimeMs = 0;

      // hit stats
      this.hitPerfect = 0;
      this.hitGreat   = 0;
      this.hitGood    = 0;
      this.hitMiss    = 0;

      // timing stats
      this.offsetSum   = 0;
      this.offsetSqSum = 0;
      this.offsetN     = 0;

      this.events.clear();
    }

    start(mode, trackId, participantMeta) {
      this._resetState();

      this.mode = mode === 'research' ? 'research' : 'normal';
      this.track = pickTrack(trackId, this.mode);

      if (this.wrap && this.track.diff) {
        this.wrap.dataset.diff = this.track.diff;
      }

      this.sessionId = makeSessionId();
      participantMeta = participantMeta || {};
      this.participant = (participantMeta.id    || '').trim();
      this.group       = (participantMeta.group || '').trim();
      this.note        = (participantMeta.note  || '').trim();

      this.score    = 0;
      this.combo    = 0;
      this.maxCombo = 0;
      this.hp       = 100;
      this.shield   = 0;
      this.feverGauge = 0;
      this.feverActive = false;
      this.feverTimeMs = 0;
      this.feverCount  = 0;

      this.chartIndex  = 0;
      this.activeNotes = [];
      this.totalNotes  = 0;
      this.songTime    = 0;

      if (this.renderer) {
        this.renderer.setPreSpawn(PRE_SPAWN_SEC);
        this.renderer.setFever(false);
        this.renderer.setFeedback(
          'แตะ lane ให้ตรงเส้นแนวนอนด้านล่างตามจังหวะเพลง 🎵'
        );
      }

      if (this.field) {
        this.field.classList.remove('rb-shake');
      }

      this.events.clear();

      // setup audio
      if (this.audio && this.track.audio) {
        this.audio.src = this.track.audio;
        this.audio.currentTime = 0;
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // autoplay error — จะเริ่มเดินเวลาเองใน loop
          });
        }
      }

      this.running   = true;
      this.ended     = false;
      this.startPerf = performance.now();
      this.lastPerf  = this.startPerf;

      this._updateHUD();
      requestAnimationFrame(this._loop.bind(this));
    }

    stop(reason) {
      if (!this.running || this.ended) return;
      this._finish(reason || 'manual-stop');
    }

    _loop(ts) {
      if (!this.running || this.ended) return;

      const dt = (ts - this.lastPerf) / 1000;
      this.lastPerf = ts;

      if (this.audio && !this.audio.paused) {
        this.songTime = this.audio.currentTime;
      } else {
        this.songTime += dt;
      }

      this._updateTimeline(dt);
      this._updateHUD();

      const dur = this.track.duration || 30;
      if (this.songTime >= dur + 0.2) {
        this._finish('song-end');
        return;
      }

      requestAnimationFrame(this._loop.bind(this));
    }

    _updateTimeline(dt) {
      this._spawnNotes();
      if (this.renderer) {
        this.renderer.updatePositions(this.activeNotes, this.songTime, PRE_SPAWN_SEC);
      }
      this._autoMiss();
      this._updateFever(dt);
    }

    _spawnNotes() {
      const chart = this.track.chart || [];
      const pre   = PRE_SPAWN_SEC;
      const t     = this.songTime;

      while (
        this.chartIndex < chart.length &&
        chart[this.chartIndex].time <= t + pre
      ) {
        const spec = chart[this.chartIndex];
        const laneIdx = clamp(spec.lane | 0, 0, 4);
        const note = {
          id: ++this.totalNotes,
          lane: laneIdx,
          time: spec.time,
          kind: spec.kind || 'normal',
          el: null,
          judged: false,
          removed: false
        };

        if (this.renderer) {
          this.renderer.spawnNote(note);
        }
        this.activeNotes.push(note);

        this._logEvent('spawn', note, {
          song_time_s: this.songTime.toFixed(3),
          target_time_s: note.time.toFixed(3)
        });

        this.chartIndex++;
      }
    }

    _autoMiss() {
      const t = this.songTime;
      for (const n of this.activeNotes) {
        if (n.judged || n.removed) continue;
        if (t > n.time + MISS_WINDOW) {
          this._registerMiss(n, 'timeout');
        }
      }
      this.activeNotes = this.activeNotes.filter((n) => !n.removed);
    }

    handleLaneTap(laneIndex) {
      if (!this.running || this.ended) return;

      const t = this.songTime;
      let best = null;
      let bestAbs = Infinity;

      for (const n of this.activeNotes) {
        if (n.judged || n.removed) continue;
        if (n.lane !== laneIndex) continue;
        const off = t - n.time;
        const abs = Math.abs(off);
        if (abs < bestAbs && abs <= MISS_WINDOW) {
          best = n;
          bestAbs = abs;
        }
      }

      if (!best) {
        if (this.renderer) {
          this.renderer.setFeedback(
            'ลองฟังจังหวะ แล้วแตะให้ใกล้เส้นด้านล่างมากขึ้นนะ 🎧',
            'miss'
          );
        }
        return;
      }

      const offset = t - best.time;
      const absOff = Math.abs(offset);

      let grade = 'good';
      if (absOff <= HIT_WINDOWS.perfect) grade = 'perfect';
      else if (absOff <= HIT_WINDOWS.great) grade = 'great';
      else if (absOff <= HIT_WINDOWS.good) grade = 'good';
      else grade = 'miss';

      if (grade === 'miss') {
        this._registerMiss(best, 'out-of-window', offset);
      } else {
        this._registerHit(best, grade, offset);
      }

      this.activeNotes = this.activeNotes.filter((n) => !n.removed);
      this._updateHUD();
    }

    _registerHit(note, grade, offset) {
      note.judged = true;
      note.removed = true;
      if (this.renderer) {
        this.renderer.removeNote(note.id);
      }

      const comboBefore = this.combo;
      const scoreBefore = this.score;
      const hpBefore    = this.hp;
      const feverBefore = this.feverGauge;

      let base = 0;
      let feverGain = 0;

      if (grade === 'perfect') {
        base = 320;
        feverGain = 10;
        this.hitPerfect++;
      } else if (grade === 'great') {
        base = 220;
        feverGain = 7;
        this.hitGreat++;
      } else {
        base = 140;
        feverGain = 4;
        this.hitGood++;
      }

      if (this.feverActive) {
        base = Math.round(base * 1.35);
      }

      this.combo += 1;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }

      this.score += base;

      this.feverGauge = clamp(this.feverGauge + feverGain, 0, 100);
      if (!this.feverActive && this.feverGauge >= 100) {
        this._enterFever();
      }

      this.offsetSum   += offset;
      this.offsetSqSum += offset * offset;
      this.offsetN     += 1;

      if (this.renderer) {
        const fbType = grade === 'perfect' ? 'perfect' : 'good';
        this.renderer.setFeedback(
          grade === 'perfect'
            ? 'สุดยอด! ตรงจังหวะเป๊ะเลย 🎯'
            : 'ดีมาก! คอมโบยาวขึ้นแล้ว 💪',
          fbType
        );
        this.renderer.playHitPopup(grade, base);
      }

      this._logEvent('hit', note, {
        grade,
        offset_s: +offset.toFixed(4),
        score_delta: base,
        combo_before: comboBefore,
        combo_after: this.combo,
        hp_before: hpBefore,
        hp_after: this.hp,
        fever_before: feverBefore,
        fever_after: this.feverGauge,
        fever_on: this.feverActive ? 1 : 0
      });
    }

    _registerMiss(note, reason, offset) {
      note.judged = true;
      note.removed = true;
      if (this.renderer) {
        this.renderer.removeNote(note.id);
      }

      const comboBefore = this.combo;
      const hpBefore    = this.hp;

      this.combo = 0;
      this.hitMiss++;

      if (this.shield > 0) {
        this.shield -= 1;
        if (this.renderer) {
          this.renderer.setFeedback('ใช้ Shield รับดาเมจไว้แล้ว ✋', 'good');
          this.renderer.playHitPopup('shield', 0);
        }
      } else {
        this.hp = clamp(this.hp - 8, 0, 100);
        if (this.renderer) {
          this.renderer.flashDamage();
          this.renderer.setFeedback(
            'พลาดจังหวะ! ลองฟังให้ชัดขึ้นอีกหน่อยนะ 🎧',
            'miss'
          );
          this.renderer.playHitPopup('miss', 0);
        }
      }

      this._logEvent('miss', note, {
        reason,
        offset_s: offset != null ? +offset.toFixed(4) : '',
        combo_before: comboBefore,
        combo_after: this.combo,
        hp_before: hpBefore,
        hp_after: this.hp,
        shield_after: this.shield
      });

      if (this.hp <= 0) {
        this._finish('hp-zero');
      }
    }

    _updateFever(dt) {
      if (this.feverActive) {
        this.feverTimeMs += dt * 1000;
        this.feverGauge = clamp(this.feverGauge - dt * 30, 0, 100);
        if (this.feverGauge <= 0) {
          this._exitFever();
        }
      } else {
        this.feverGauge = clamp(this.feverGauge - dt * 8, 0, 100);
      }
    }

    _enterFever() {
      this.feverActive = true;
      this.feverCount += 1;
      this.feverGauge = 100;
      if (this.renderer) {
        this.renderer.setFever(true);
        this.renderer.setFeedback('FEVER MODE! คะแนนพุ่งกระจาย ⚡', 'perfect');
      }
    }

    _exitFever() {
      this.feverActive = false;
      this.feverGauge = 0;
      if (this.renderer) {
        this.renderer.setFever(false);
      }
    }

    _updateHUD() {
      const h = this.hud;
      if (!h) return;

      if (h.score)  h.score.textContent  = this.score;
      if (h.combo)  h.combo.textContent  = this.combo;
      if (h.hp)     h.hp.textContent     = this.hp;
      if (h.shield) h.shield.textContent = this.shield;
      if (h.time)   h.time.textContent   = this.songTime.toFixed(1);

      const totalHits = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const okHits    = this.hitPerfect + this.hitGreat + this.hitGood;
      const acc = totalHits ? (okHits / totalHits) * 100 : 0;

      if (h.acc) h.acc.textContent = acc.toFixed(1) + '%';

      if (h.countPerfect) h.countPerfect.textContent = this.hitPerfect;
      if (h.countGreat)   h.countGreat.textContent   = this.hitGreat;
      if (h.countGood)    h.countGood.textContent    = this.hitGood;
      if (h.countMiss)    h.countMiss.textContent    = this.hitMiss;

      const feverRatio = clamp(this.feverGauge, 0, 100) / 100;
      if (h.feverFill) {
        h.feverFill.style.transform = 'scaleX(' + feverRatio + ')';
      }
      if (h.feverStatus) {
        h.feverStatus.textContent = this.feverActive ? 'FEVER!!' : 'Ready';
        h.feverStatus.classList.toggle('on', this.feverActive);
      }

      const dur = this.track.duration || 30;
      const prog = clamp(this.songTime / dur, 0, 1);
      if (h.progFill) {
        h.progFill.style.transform = 'scaleX(' + prog + ')';
      }
      if (h.progText) {
        h.progText.textContent = Math.round(prog * 100) + '%';
      }

      if (h.mode) {
        h.mode.textContent = this.mode === 'research' ? 'Research' : 'Normal';
      }
      if (h.track) {
        h.track.textContent = this.track.nameShort || this.track.name || this.track.id;
      }
    }

    _finish(reason) {
      if (this.ended) return;
      this.ended = true;
      this.running = false;

      if (this.audio) {
        try { this.audio.pause(); } catch (e) {}
      }

      for (const n of this.activeNotes) {
        if (n.el) n.el.remove();
      }
      this.activeNotes = [];

      const durationSec = this.songTime;
      const totalHits   = this.hitPerfect + this.hitGreat + this.hitGood + this.hitMiss;
      const okHits      = this.hitPerfect + this.hitGreat + this.hitGood;
      const acc = totalHits ? (okHits / totalHits) * 100 : 0;

      let mean = null;
      let sd   = null;
      if (this.offsetN > 0) {
        mean = this.offsetSum / this.offsetN;
        const variance = Math.max(0, this.offsetSqSum / this.offsetN - mean * mean);
        sd = Math.sqrt(variance);
      }

      // Rank: SSS, SS, S, A, B, C
      let rank = 'C';
      if (acc >= 95 && this.score >= 9000)      rank = 'SSS';
      else if (acc >= 90 && this.score >= 8000) rank = 'SS';
      else if (acc >= 85 && this.score >= 7000) rank = 'S';
      else if (acc >= 75 && this.score >= 5500) rank = 'A';
      else if (acc >= 65 && this.score >= 4000) rank = 'B';

      let qualityNote = '';
      if (totalHits < 20) {
        qualityNote = 'รอบนี้โน้ตยังไม่เยอะมาก แนะนำให้เล่นซ้ำเพื่อเก็บข้อมูลเพิ่ม 😊';
      } else if (acc < 60) {
        qualityNote = 'ความแม่นยำค่อนข้างต่ำ อาจต้องฝึกเพิ่มก่อนนำไปวิเคราะห์เชิงลึก 🔍';
      }

      const sessionRow = {
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track.id,
        track_name: this.track.name,
        participant: this.participant,
        group: this.group,
        note: this.note,
        final_score: this.score,
        max_combo: this.maxCombo,
        hp_end: this.hp,
        shield_end: this.shield,
        hit_perfect: this.hitPerfect,
        hit_great: this.hitGreat,
        hit_good: this.hitGood,
        hit_miss: this.hitMiss,
        hit_total: totalHits,
        accuracy_pct: +acc.toFixed(1),
        offset_mean_s: mean != null ? +mean.toFixed(4) : '',
        offset_sd_s:   sd   != null ? +sd.toFixed(4)   : '',
        fever_count: this.feverCount,
        fever_time_s: +(this.feverTimeMs / 1000).toFixed(2),
        duration_s: +durationSec.toFixed(3),
        end_reason: reason,
        rank
      };

      const sLogger = new EventLogger();
      sLogger.add(sessionRow);
      this.sessionCsv = sLogger.toCsv();

      const summary = {
        mode: this.mode,
        modeLabel: this.mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ',
        trackId: this.track.id,
        trackName: this.track.name,
        endReason: reason,
        finalScore: this.score,
        maxCombo: this.maxCombo,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        accuracyPct: acc,
        offsetMean: mean,
        offsetStd: sd,
        durationSec,
        participant: this.participant,
        rank,
        qualityNote,
        eventsCsv: this.events.toCsv(),
        sessionCsv: this.sessionCsv
      };

      if (this.hooks && typeof this.hooks.onEnd === 'function') {
        this.hooks.onEnd(summary);
      }
    }

    _logEvent(type, note, extra) {
      extra = extra || {};
      this.events.add({
        session_id: this.sessionId,
        mode: this.mode,
        track_id: this.track ? this.track.id : '',
        lane: note ? note.lane : '',
        note_id: note ? note.id : '',
        kind: note ? note.kind : '',
        event_type: type,
        song_time_s: this.songTime.toFixed(3),
        target_time_s: note && note.time != null ? note.time.toFixed(3) : '',
        ...extra
      });
    }

    getEventsCsv() {
      return this.events.toCsv();
    }
    getSessionCsv() {
      return this.sessionCsv || '';
    }
  }

  // ===== EXPORT TO WINDOW =====
  window.RhythmBoxerEngine = RhythmBoxerEngine;
  window.RB_TRACKS_META = TRACKS.map((t) => ({
    id: t.id,
    name: t.name,
    nameShort: t.nameShort || t.name
  }));
})();
