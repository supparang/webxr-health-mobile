// === js/engine.js — Shadow Breaker core logic (no DOM) ===
'use strict';

/**
 * GameEngine
 * - ไม่ยุ่งกับ DOM เลย
 * - สุ่มเป้า, คำนวณคะแนน / HP / FEVER / phase
 * - ส่งข้อมูลออกผ่าน hooks:
 *    onSpawn(target)
 *    onDespawn(target, reason)    // 'timeout' | 'hit' | 'clear'
 *    onHit(ev)                    // ราย event ที่ตีเป้า
 *    onUpdate(state)              // ทุกเฟรม
 *    onEnd(summary)               // จบเกม
 */

export class GameEngine {
  constructor(opts = {}) {
    const {
      difficulty = 'normal',
      hooks = {}
    } = opts;

    this.diffKey = difficulty;
    this.hooks = hooks;

    // ===== Config ตามระดับความยาก =====
    const DIFF = {
      easy: {
        name: 'easy',
        durationMs: 60000,
        spawnIntervalMs: 1200,
        targetLifetimeMs: 2200,
        targetSizePx: 130,
        damageBossPerPerfect: 6,
        damageBossPerGood: 3,
        damagePlayerOnMiss: 4,
        bombDamagePlayer: 8
      },
      normal: {
        name: 'normal',
        durationMs: 60000,
        spawnIntervalMs: 900,
        targetLifetimeMs: 1900,
        targetSizePx: 110,
        damageBossPerPerfect: 7,
        damageBossPerGood: 4,
        damagePlayerOnMiss: 5,
        bombDamagePlayer: 10
      },
      hard: {
        name: 'hard',
        durationMs: 60000,
        spawnIntervalMs: 750,
        targetLifetimeMs: 1600,
        targetSizePx: 96,
        damageBossPerPerfect: 8,
        damageBossPerGood: 5,
        damagePlayerOnMiss: 6,
        bombDamagePlayer: 12
      }
    };

    this.cfg = DIFF[difficulty] || DIFF.normal;

    // ===== state พื้นฐาน =====
    this.running = false;
    this.startTime = 0;
    this.elapsedMs = 0;
    this.lastTick = 0;
    this.rafId = null;

    this.playerHpMax = 100;
    this.bossHpMax = 100;
    this.playerHp = this.playerHpMax;
    this.bossHp = this.bossHpMax;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.badCount = 0;
    this.missCount = 0;
    this.bombHitCount = 0;
    this.totalTargets = 0;
    this.totalHits = 0;

    // FEVER
    this.feverGauge = 0;   // 0–1
    this.feverOn = false;
    this.feverOnSince = 0;
    this.feverCount = 0;
    this.feverTotalTimeMs = 0;

    // Low HP tracking
    this.lowHpThreshold = 0.3;   // <30%
    this.lowHpAccumMs = 0;

    // phase / boss
    this.phase = 1;          // 1–4
    this.bossIndex = 0;      // 0–3
    this.bossesCleared = 0;

    // target management
    this.nextTargetId = 1;
    this.activeTargets = new Map();
    this.nextSpawnAt = 0;

    this.normalRTs = [];
    this.decoyRTs = [];

    this.endReason = null;
  }

  // ===== Public API =====

  start() {
    if (this.running) return;
    this.running = true;

    const now = performance.now();
    this.startTime = now;
    this.lastTick = now;
    this.elapsedMs = 0;
    this.nextSpawnAt = now + 600; // หน่วงเล็กน้อยก่อนเป้าแรก

    this._loop = this._loop.bind(this);
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop(reason = 'manual') {
    if (!this.running) return;
    this.running = false;
    this.endReason = reason;

    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // ปิด FEVER ถ้ายังติดอยู่
    const now = performance.now();
    if (this.feverOn) {
      this.feverTotalTimeMs += now - this.feverOnSince;
      this.feverOn = false;
    }

    // clear เป้าทั้งหมด
    for (const t of this.activeTargets.values()) {
      this._emitDespawn(t, 'clear');
    }
    this.activeTargets.clear();

    const summary = this._buildSummary();
    this.hooks.onEnd && this.hooks.onEnd(summary);
  }

  /**
   * ให้ DomRenderer เรียกเมื่อผู้เล่นตีโดนเป้า
   * @param {number} targetId
   * @param {{x:number,y:number}|null} screenPos
   */
  handleHit(targetId, screenPos = null) {
    if (!this.running) return;
    const target = this.activeTargets.get(targetId);
    if (!target) return;

    const now = performance.now();
    const ageMs = now - target.spawnAt;

    // คำนวณเกรดจาก reaction time
    const PERFECT = 350;
    const GOOD = 750;
    let grade = 'bad';
    if (ageMs <= PERFECT) grade = 'perfect';
    else if (ageMs <= GOOD) grade = 'good';

    let scoreDelta = 0;
    let comboBefore = this.combo;
    let comboAfter;
    let playerHpBefore = this.playerHp;
    let bossHpBefore = this.bossHp;

    // combo & score
    if (grade === 'perfect' || grade === 'good') {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const base = grade === 'perfect' ? 100 : 60;
      const feverMul = this.feverOn ? 1.5 : 1;
      scoreDelta = Math.round(base * feverMul * (1 + this.combo * 0.02));
      this.score += scoreDelta;
      this.totalHits += 1;

      if (target.isDecoy) {
        // เป้าลวง: ไม่นับเป็น normal RT
        this.decoyRTs.push(ageMs);
      } else {
        this.normalRTs.push(ageMs);
      }

      if (grade === 'perfect') this.perfectCount++;
      else this.goodCount++;
    } else {
      // bad → นับเป็น miss แบบ timing ไม่ดี
      this.combo = 0;
      this.badCount++;
      this.missCount++;
      this.playerHp = Math.max(0, this.playerHp - this.cfg.damagePlayerOnMiss);
    }

    // boss damage
    if (!target.isDecoy) {
      if (grade === 'perfect') {
        this.bossHp = Math.max(0, this.bossHp - this.cfg.damageBossPerPerfect);
      } else if (grade === 'good') {
        this.bossHp = Math.max(0, this.bossHp - this.cfg.damageBossPerGood);
      }
    }

    // bomb
    if (target.isBomb) {
      this.bombHitCount++;
      this.playerHp = Math.max(0, this.playerHp - this.cfg.bombDamagePlayer);
    }

    // FEVER gauge
    const feverBefore = this.feverGauge;
    if (grade === 'perfect') this.feverGauge = Math.min(1, this.feverGauge + 0.12);
    else if (grade === 'good') this.feverGauge = Math.min(1, this.feverGauge + 0.07);
    else this.feverGauge = Math.max(0, this.feverGauge - 0.18);

    if (!this.feverOn && this.feverGauge >= 1) {
      this.feverOn = true;
      this.feverGauge = 1;
      this.feverOnSince = now;
      this.feverCount++;
    }

    comboAfter = this.combo;
    const playerHpAfter = this.playerHp;
    const bossHpAfter = this.bossHp;
    const feverAfter = this.feverGauge;

    // remove target
    this.activeTargets.delete(targetId);
    this._emitDespawn(target, 'hit');

    const ev = {
      kind: 'hit',
      target,
      grade,
      ageMs,
      scoreDelta,
      scoreTotal: this.score,
      comboBefore,
      comboAfter,
      playerHpBefore,
      playerHpAfter,
      bossHpBefore,
      bossHpAfter,
      feverBefore,
      feverAfter,
      feverOn: this.feverOn,
      screenPos
    };
    this.hooks.onHit && this.hooks.onHit(ev);
  }

  // ===== Internal loop =====

  _loop(now) {
    if (!this.running) return;

    const dt = now - this.lastTick;
    this.lastTick = now;
    this.elapsedMs += dt;

    const remainingMs = Math.max(0, this.cfg.durationMs - this.elapsedMs);

    // FEVER time tracking
    if (this.feverOn) {
      // fever จะไม่หมดเวลาเองในเวอร์ชันนี้ แค่เกจค่อย ๆ ลด
      this.feverGauge = Math.max(0, this.feverGauge - dt / 8000); // ค่อย ๆ ลด 8 วิ หมดหนึ่งหลอด
      if (this.feverGauge <= 0.01) {
        this.feverOn = false;
        this.feverGauge = 0;
        this.feverTotalTimeMs += now - this.feverOnSince;
      }
    }

    // low HP time
    const hpFrac = this.playerHp / this.playerHpMax;
    if (hpFrac <= this.lowHpThreshold) {
      this.lowHpAccumMs += dt;
    }

    // phase progression (ตาม HP ของบอส)
    const bossFrac = this.bossHp / this.bossHpMax;
    let newPhase = this.phase;
    if (bossFrac <= 0.25) newPhase = 4;
    else if (bossFrac <= 0.5) newPhase = 3;
    else if (bossFrac <= 0.75) newPhase = 2;
    else newPhase = 1;

    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.hooks.onPhaseChange && this.hooks.onPhaseChange(this.phase);
    }

    // spawn เป้า
    if (now >= this.nextSpawnAt) {
      this._spawnTarget(now);
    }

    // timeout / age
    for (const t of Array.from(this.activeTargets.values())) {
      const age = now - t.spawnAt;
      if (age >= this.cfg.targetLifetimeMs) {
        this._handleTimeout(t, now);
      }
    }

    // emit HUD state
    const state = this._buildState(remainingMs);
    this.hooks.onUpdate && this.hooks.onUpdate(state);

    // check end
    if (remainingMs <= 0) {
      this.stop('timeup');
      return;
    }
    if (this.playerHp <= 0) {
      this.stop('player_dead');
      return;
    }
    if (this.bossHp <= 0) {
      this.bossesCleared = 1; // เวอร์ชันนี้มีบอสเดียวก่อน
      this.stop('boss_defeated');
      return;
    }

    this.rafId = requestAnimationFrame(this._loop);
  }

  _spawnTarget(now) {
    const id = this.nextTargetId++;
    const size = this._sizeForPhase();
    const xNorm = 0.16 + Math.random() * 0.68; // ไม่ชิดขอบเกินไป
    const yNorm = 0.22 + Math.random() * 0.56;

    const zoneLR = xNorm < 0.5 ? 'L' : 'R';
    const zoneUD = yNorm < 0.5 ? 'U' : 'D';

    // type: เป้าปกติ / bomb / decoy
    let r = Math.random();
    let isBomb = false;
    let isDecoy = false;
    if (r < 0.1) {
      isBomb = true;
    } else if (r < 0.2) {
      isDecoy = true;
    }

    const target = {
      id,
      bossId: this.bossIndex,
      bossPhase: this.phase,
      isBomb,
      isDecoy,
      isBossFace: false,
      spawnAt: now,
      sizePx: size,
      xNorm,
      yNorm,
      zoneLR,
      zoneUD,
      spawnIntervalMs: this.cfg.spawnIntervalMs,
      phaseSpawnIndex: 0 // สามารถใช้เพิ่มทีหลัง (นับลำดับเป้าใน phase)
    };

    this.activeTargets.set(id, target);
    this.totalTargets++;

    // นัด spawn ถัดไป (เพิ่มความเร็วเมื่อ phase สูงขึ้น / HP ต่ำ)
    const phaseFactor = 1 - (this.phase - 1) * 0.12;  // phase สูง → เร็วขึ้น
    const hpFactor = 0.7 + (this.bossHp / this.bossHpMax) * 0.3; // HP น้อย → เร็วขึ้น
    const nextInt = this.cfg.spawnIntervalMs * phaseFactor * hpFactor;
    this.nextSpawnAt = now + nextInt;

    this.hooks.onSpawn && this.hooks.onSpawn(target);
  }

  _handleTimeout(target, now) {
    if (!this.activeTargets.has(target.id)) return;
    this.activeTargets.delete(target.id);

    // timeout → Miss
    this.combo = 0;
    this.missCount++;
    this.playerHp = Math.max(0, this.playerHp - this.cfg.damagePlayerOnMiss);

    this._emitDespawn(target, 'timeout');

    const ev = {
      kind: 'timeout',
      target,
      grade: 'miss',
      ageMs: now - target.spawnAt,
      scoreDelta: 0,
      scoreTotal: this.score,
      comboBefore: 0,
      comboAfter: this.combo,
      playerHpBefore: this.playerHp,
      playerHpAfter: this.playerHp,
      bossHpBefore: this.bossHp,
      bossHpAfter: this.bossHp,
      feverBefore: this.feverGauge,
      feverAfter: this.feverGauge,
      feverOn: this.feverOn,
      screenPos: null
    };
    this.hooks.onHit && this.hooks.onHit(ev);
  }

  _emitDespawn(target, reason) {
    this.hooks.onDespawn && this.hooks.onDespawn(target, reason);
  }

  _sizeForPhase() {
    const base = this.cfg.targetSizePx;
    if (this.phase === 1) return base + 10;
    if (this.phase === 2) return base;
    if (this.phase === 3) return base - 10;
    return base - 18;
  }

  _buildState(remainingMs) {
    return {
      diffKey: this.diffKey,
      durationMs: this.cfg.durationMs,
      elapsedMs: this.elapsedMs,
      remainingMs,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      goodCount: this.goodCount,
      badCount: this.badCount,
      missCount: this.missCount,
      bombHitCount: this.bombHitCount,
      totalTargets: this.totalTargets,
      totalHits: this.totalHits,
      playerHp: this.playerHp,
      playerHpMax: this.playerHpMax,
      bossHp: this.bossHp,
      bossHpMax: this.bossHpMax,
      feverGauge: this.feverGauge,
      feverOn: this.feverOn,
      feverCount: this.feverCount,
      feverTotalTimeMs: this.feverTotalTimeMs,
      lowHpTimeMs: this.lowHpAccumMs,
      phase: this.phase,
      bossIndex: this.bossIndex,
      bossesCleared: this.bossesCleared
    };
  }

  _buildSummary() {
    const durationMs = this.elapsedMs;
    const accuracy = this.totalTargets > 0
      ? (this.totalHits / this.totalTargets) * 100
      : 0;

    const meanStd = (arr) => {
      if (!arr.length) return { mean: 0, sd: 0 };
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
      return { mean: m, sd: Math.sqrt(v) };
    };

    const rtNorm = meanStd(this.normalRTs);
    const rtDecoy = meanStd(this.decoyRTs);

    // grade session แบบง่าย ๆ
    let grade = 'C';
    if (accuracy >= 85 && this.bossHp <= 0) grade = 'A';
    else if (accuracy >= 70) grade = 'B';

    return {
      diffKey: this.diffKey,
      endReason: this.endReason || 'manual',
      durationMs,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      goodCount: this.goodCount,
      badCount: this.badCount,
      missCount: this.missCount,
      bombHitCount: this.bombHitCount,
      totalTargets: this.totalTargets,
      totalHits: this.totalHits,
      accuracyPct: accuracy,
      playerHp: this.playerHp,
      playerHpMax: this.playerHpMax,
      bossHp: this.bossHp,
      bossHpMax: this.bossHpMax,
      feverCount: this.feverCount,
      feverTotalTimeMs: this.feverTotalTimeMs,
      lowHpTimeMs: this.lowHpAccumMs,
      phase: this.phase,
      bossesCleared: this.bossesCleared,
      avgRtNormalMs: rtNorm.mean,
      stdRtNormalMs: rtNorm.sd,
      avgRtDecoyMs: rtDecoy.mean,
      stdRtDecoyMs: rtDecoy.sd,
      grade
    };
  }
}