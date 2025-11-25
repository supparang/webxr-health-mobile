// === js/engine.js — Shadow Breaker Engine + UI (2025-11-28) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-28';

// ----------------- Small helpers -----------------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// ----------------- Config -----------------
const DIFF_CONFIG = {
  easy: {
    label: 'Easy',
    timeSec: 60,
    baseSpawnMs: 1050,
    baseLifeMs: 2200,
    baseSizePx: 180,
  },
  normal: {
    label: 'Normal',
    timeSec: 60,
    baseSpawnMs: 900,
    baseLifeMs: 2000,
    baseSizePx: 150,
  },
  hard: {
    label: 'Hard',
    timeSec: 60,
    baseSpawnMs: 760,
    baseLifeMs: 1800,
    baseSizePx: 130,
  }
};

const BOSSES = [
  {
    id: 0,
    name: 'Bubble Glove',
    emoji: '🐣',
    title: 'โฟกัสเป้าฟองใหญ่ ๆ ให้ทัน',
    reward: 'Bubble Starter Badge'
  },
  {
    id: 1,
    name: 'Neon Knuckle',
    emoji: '⚡',
    title: 'เป้าเล็กลง เร็วขึ้นอีกขั้น',
    reward: 'Neon Combo Badge'
  },
  {
    id: 2,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'มีเป้าลวงและบอมบ์ แทรกมาบ่อยขึ้น',
    reward: 'Shadow Guard Breaker'
  },
  {
    id: 3,
    name: 'Final Burst',
    emoji: '💥',
    title: 'โหมดโหดสุด ระเบิดคอมโบให้สุด!',
    reward: 'Final Burst Legend'
  }
];

function createSessionId() {
  return 'SB-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
}

// ----------------- Engine class -----------------
class ShadowBreakerEngine {
  constructor(opts) {
    this.mode          = opts.mode || 'normal';
    this.diffKey       = opts.diffKey || 'normal';
    this.diffConf      = DIFF_CONFIG[this.diffKey] || DIFF_CONFIG.normal;
    this.durationSec   = opts.durationSec || this.diffConf.timeSec;
    this.timeLimitMs   = this.durationSec * 1000;
    this.wrap          = opts.wrap || document.body;
    this.renderer      = opts.renderer;
    this.eventLogger   = opts.eventLogger;
    this.sessionLogger = opts.sessionLogger;
    this.hooks         = opts.hooks || {};

    this.participant   = opts.participant || '';
    this.group         = opts.group || '';
    this.note          = opts.note || '';
    this.runIndex      = opts.runIndex || 1;
    this.menuToPlayMs  = opts.menuToPlayMs || 0;

    this.sessionId     = createSessionId();

    // state
    this.started   = false;
    this.ended     = false;
    this.startPerf = 0;
    this.lastTick  = 0;
    this.elapsedMs = 0;
    this.remainingMs = this.timeLimitMs;

    this.playerHpMax = 100;
    this.playerHp    = this.playerHpMax;

    this.currentBossIndex = 0;
    this.bossHpMax        = 100;
    this.bossHp           = this.bossHpMax;
    this.bossPhase        = 1; // 1..3
    this.nearDeath        = false;

    this.targets      = new Map();
    this.spawnSeq     = 0;
    this.nextSpawnAt  = 0;

    this.shouldSpawnBossFace = false;
    this.bossFaceActive      = false;

    this.score       = 0;
    this.combo       = 0;
    this.maxCombo    = 0;
    this.missCount   = 0;
    this.totalHits   = 0;
    this.totalTargets = 0;
    this.totalBombHits = 0;
    this.bossesCleared = 0;

    this.feverGauge   = 0;  // 0..100
    this.feverOn      = false;
    this.feverCount   = 0;
    this.feverTimeMs  = 0;
    this._lastFeverTs = 0;

    this.lowHpTimeMs = 0;
    this._lastHpTs   = 0;

    this.rtNormal = { n: 0, sum: 0, sumSq: 0 };
    this.rtDecoy  = { n: 0, sum: 0, sumSq: 0 };

    if (this.renderer) {
      this.renderer.setEngine?.(this);
    }
  }

  getBossMeta() {
    const meta = BOSSES[this.currentBossIndex] || BOSSES[0];
    return {
      index: this.currentBossIndex,
      id: meta.id,
      meta,
      hp: this.bossHp,
      hpMax: this.bossHpMax,
      phase: this.bossPhase
    };
  }

  // ---------- lifecycle ----------
  start() {
    if (this.started || this.ended) return;
    this.started   = true;
    this.startPerf = performance.now();
    this.lastTick  = this.startPerf;
    this.remainingMs = this.timeLimitMs;
    this.nextSpawnAt = this.startPerf + 400;
    this._lastFeverTs = this.startPerf;
    this._lastHpTs    = this.startPerf;

    this._updateBossPhase();
    this._updateBossHUD();
    this._updateHUD();

    const loop = (ts) => {
      if (this.ended) return;
      this._tick(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(reason = 'manual-stop') {
    if (this.ended) return;
    this._finish(reason);
  }

  _tick(ts) {
    const dt = ts - this.lastTick;
    this.lastTick = ts;

    this.elapsedMs   = ts - this.startPerf;
    this.remainingMs = Math.max(0, this.timeLimitMs - this.elapsedMs);

    if (this.playerHp <= this.playerHpMax * 0.3) {
      this.lowHpTimeMs += dt;
    }

    // FEVER timer
    if (this.feverOn) {
      this.feverTimeMs += dt;
      this._drainFever(dt);
    } else {
      this._decayFever(dt);
    }

    if (ts >= this.nextSpawnAt) {
      this._spawnTarget(ts);
    }

    this._checkTimeouts(ts);
    this._updateHUD();

    if (this.remainingMs <= 0) {
      this._finish('time-up');
    }
  }

  _finish(reason) {
    if (this.ended) return;
    this.ended = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);

    // clear targets in DOM
    for (const id of this.targets.keys()) {
      this.renderer?.removeTarget(id, 'end');
    }
    this.targets.clear();

    const durationSec = this.elapsedMs / 1000;
    const accuracy = this.totalTargets
      ? (this.totalHits / this.totalTargets) * 100
      : 0;

    const rtStats = (obj) => {
      if (!obj.n) return { avg: '', std: '' };
      const mean = obj.sum / obj.n;
      const variance = Math.max(0, obj.sumSq / obj.n - mean * mean);
      return { avg: mean, std: Math.sqrt(variance) };
    };
    const rtN = rtStats(this.rtNormal);
    const rtD = rtStats(this.rtDecoy);

    const grade = this._calcGrade(accuracy, this.score);

    const summary = {
      session_id: this.sessionId,
      build_version: BUILD_VERSION,
      mode: this.mode,
      difficulty: this.diffKey,
      training_phase: 'boss-multi',
      run_index: this.runIndex,
      start_ts: new Date(performance.timeOrigin + this.startPerf).toISOString(),
      end_ts: new Date().toISOString(),
      duration_s: +durationSec.toFixed(2),
      end_reason: reason,
      final_score: this.score,
      grade,
      total_targets: this.totalTargets,
      total_hits: this.totalHits,
      total_miss: this.missCount,
      total_bombs_hit: this.totalBombHits,
      accuracy_pct: +accuracy.toFixed(1),
      max_combo: this.maxCombo,
      perfect_count: this.perfectCount || 0,
      good_count: this.goodCount || 0,
      bad_count: this.badCount || 0,
      avg_rt_normal_ms: rtN.avg ? +rtN.avg.toFixed(1) : '',
      std_rt_normal_ms: rtN.std ? +rtN.std.toFixed(1) : '',
      avg_rt_decoy_ms: rtD.avg ? +rtD.avg.toFixed(1) : '',
      std_rt_decoy_ms: rtD.std ? +rtD.std.toFixed(1) : '',
      fever_count: this.feverCount,
      fever_total_time_s: +(this.feverTimeMs / 1000).toFixed(2),
      low_hp_time_s: +(this.lowHpTimeMs / 1000).toFixed(2),
      bosses_cleared: this.bossesCleared,
      menu_to_play_ms: Math.round(this.menuToPlayMs),
      participant: this.participant,
      group: this.group,
      note: this.note,
      env_ua: navigator.userAgent || '',
      env_viewport_w: window.innerWidth,
      env_viewport_h: window.innerHeight,
      env_input_mode: ('ontouchstart' in window) ? 'touch' : 'mouse',
      error_count: 0,
      focus_events: 0
    };

    this.sessionLogger?.add(summary);

    if (this.hooks.onEnd) {
      this.hooks.onEnd(summary);
    }
  }

  _calcGrade(accuracy, score) {
    if (accuracy >= 90 && score >= 3500) return 'S';
    if (accuracy >= 80 && score >= 2500) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    return 'D';
  }

  // ---------- spawn / timing ----------
  _computePhaseFromHp() {
    const ratio = this.bossHpMax > 0 ? this.bossHp / this.bossHpMax : 0;
    let phase = 1;
    if (ratio <= 0.33) phase = 3;
    else if (ratio <= 0.66) phase = 2;
    this.bossPhase = phase;
    const nearDeath = ratio <= 0.22;
    const phaseChanged = (this.prevPhase || 1) !== phase;
    const nearDeathChanged = this.nearDeath !== nearDeath;
    this.prevPhase = phase;
    this.nearDeath = nearDeath;
    return { ratio, phase, phaseChanged, nearDeath, nearDeathChanged };
  }

  _updateBossPhase() {
    const info = this._computePhaseFromHp();
    if (info.phaseChanged && this.hooks.onPhaseChange) {
      this.hooks.onPhaseChange(this.currentBossIndex, this.bossPhase, info);
    }
    if (info.nearDeathChanged && info.nearDeath && this.hooks.onNearDeath) {
      this.hooks.onNearDeath(this.currentBossIndex, this.bossPhase, info);
      this.shouldSpawnBossFace = true;
    }
    this._updateWrapData();
  }

  _spawnTarget(now) {
    const diff = this.diffConf;
    const bossMeta = BOSSES[this.currentBossIndex] || BOSSES[0];

    // ensure bossPhase & nearDeath up-to-date
    const phaseInfo = this._computePhaseFromHp();

    // base spawn / lifetime from difficulty
    let spawnInterval = diff.baseSpawnMs;
    let lifeMs        = diff.baseLifeMs;

    // harder boss index → faster
    const bossFactor = 1 - this.currentBossIndex * 0.06;
    spawnInterval *= bossFactor;
    lifeMs        *= (1 - this.currentBossIndex * 0.03);

    // phase affects speed & lifetime
    const phaseIdx = this.bossPhase - 1;
    const phaseSpawnFactor = [1.0, 0.86, 0.78][phaseIdx] || 1.0;
    const phaseLifeFactor  = [1.05, 1.0, 0.92][phaseIdx] || 1.0;
    spawnInterval *= phaseSpawnFactor;
    lifeMs        *= phaseLifeFactor;

    // near death → spawn faster
    if (phaseInfo.nearDeath) {
      spawnInterval *= 0.72;
    }

    // target size
    let sizePx = diff.baseSizePx;
    const phaseSizeFactor = [1.1, 0.96, 0.84][phaseIdx] || 1.0;
    sizePx *= phaseSizeFactor;
    sizePx *= (1 - this.currentBossIndex * 0.04);
    const jitter = 1 + (Math.random() * 0.22 - 0.11);
    sizePx = Math.round(sizePx * jitter);

    // decide type
    let type = 'normal';
    const r = Math.random();
    if (this.shouldSpawnBossFace && !this.bossFaceActive) {
      type = 'bossface';
      this.shouldSpawnBossFace = false;
      this.bossFaceActive = true;
    } else {
      if (r > 0.93) type = 'bomb';
      else if (r > 0.86) type = 'heal';
      else if (r > 0.78) type = 'shield';
      else if (r > 0.68 && this.currentBossIndex >= 1) type = 'decoy';
    }

    const id = ++this.spawnSeq;

    const zoneLR = ['L', 'C', 'R'][Math.floor(Math.random() * 3)];
    const zoneUD = ['U', 'M', 'D'][Math.floor(Math.random() * 3)];

    const t = {
      id,
      bossId: bossMeta.id,
      bossIndex: this.currentBossIndex,
      bossPhase: this.bossPhase,
      isDecoy: type === 'decoy',
      isBomb: type === 'bomb',
      isHeal: type === 'heal',
      isShield: type === 'shield',
      isBossFace: type === 'bossface',
      type,
      spawnTime: now,
      lifeMs,
      expireTime: now + lifeMs,
      sizePx,
      diffKey: this.diffKey,
      phase: this.bossPhase,
      x_norm: Math.random(),
      y_norm: Math.random(),
      zone_lr: zoneLR,
      zone_ud: zoneUD,
      emoji: type === 'bossface' ? bossMeta.emoji : undefined,
      spawn_interval_ms: spawnInterval,
      phaseSpawnIndex: id,
    };

    this.targets.set(id, t);
    this.totalTargets++;

    this.renderer?.spawnTarget(t);

    this.nextSpawnAt = now + spawnInterval;
  }

  _checkTimeouts(now) {
    const expired = [];
    for (const [id, t] of this.targets) {
      if (now >= t.expireTime) {
        expired.push([id, t]);
      }
    }
    for (const [id, t] of expired) {
      // miss FX must use target before removeTarget
      this.renderer?.playHitFx?.(id, {
        grade: 'miss',
        scoreDelta: 0,
        fxEmoji: '💨'
      });
      this.renderer?.removeTarget(id, 'timeout');
      this.targets.delete(id);
      this._registerMiss(t);
    }
  }

  // ---------- handle hits ----------
  handleHit(id, pos) {
    const t = this.targets.get(id);
    if (!t || this.ended) return;

    const now = performance.now();
    this.targets.delete(id);

    const age = now - t.spawnTime;
    const ratio = clamp(age / t.lifeMs, 0, 1);

    let grade = 'good';
    if (t.isBomb) grade = 'bomb';
    else if (t.isDecoy) grade = 'decoy';
    else if (t.isBossFace) grade = 'bossface';
    else if (ratio <= 0.35) grade = 'perfect';
    else if (ratio >= 0.9) grade = 'bad';

    let scoreDelta = 0;
    let fxEmoji = '✨';

    const comboBefore = this.combo;
    const hpBefore = this.playerHp;
    const feverBefore = this.feverGauge;

    if (grade === 'perfect' || grade === 'bossface') {
      scoreDelta = grade === 'bossface' ? 260 : 120;
      this.score += scoreDelta;
      this.combo++;
      this.totalHits++;
      this.perfectCount = (this.perfectCount || 0) + 1;
      this._gainFever(10);
      fxEmoji = '💥';
      this._damageBoss(grade === 'bossface' ? 12 : 3);
    } else if (grade === 'good') {
      scoreDelta = 80;
      this.score += scoreDelta;
      this.combo++;
      this.totalHits++;
      this.goodCount = (this.goodCount || 0) + 1;
      this._gainFever(6);
      fxEmoji = '⭐';
      this._damageBoss(2);
    } else if (grade === 'bad') {
      scoreDelta = 40;
      this.score += scoreDelta;
      this.combo = 0;
      this.totalHits++;
      this.badCount = (this.badCount || 0) + 1;
      this._gainFever(3);
      fxEmoji = '💫';
      this._damageBoss(1);
    } else if (grade === 'bomb') {
      this.combo = 0;
      this.totalBombHits++;
      this._hitByBomb();
      fxEmoji = '💣';
    } else if (grade === 'decoy') {
      this.combo = 0;
      fxEmoji = '🎯';
    }

    if (t.isBossFace) {
      this.bossFaceActive = false;
    }

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    if (this.feverOn && scoreDelta > 0) {
      this.score += Math.round(scoreDelta * 0.3);
    }

    if (!t.isDecoy && !t.isBomb) {
      this._accRT(this.rtNormal, age);
    } else if (t.isDecoy) {
      this._accRT(this.rtDecoy, age);
    }

    // FX: use target position before DOM removal
    this.renderer?.playHitFx?.(t.id, {
      grade: grade === 'decoy' ? 'miss' : grade,
      scoreDelta,
      fxEmoji
    });
    this.renderer?.removeTarget?.(t.id, 'hit');

    const row = {
      session_id: this.sessionId,
      run_index: this.runIndex,
      mode: this.mode,
      difficulty: this.diffKey,
      participant: this.participant,
      group: this.group,
      note: this.note,
      boss_id: t.bossId,
      boss_index: t.bossIndex,
      boss_phase: t.bossPhase,
      is_decoy: t.isDecoy ? 1 : 0,
      is_bomb: t.isBomb ? 1 : 0,
      is_bossface: t.isBossFace ? 1 : 0,
      target_id: t.id,
      event_type: 'hit',
      grade,
      age_ms: Math.round(age),
      fever_on: this.feverOn ? 1 : 0,
      score_delta: scoreDelta,
      score_total: this.score,
      combo_before: comboBefore,
      combo_after: this.combo,
      player_hp_before: hpBefore,
      player_hp_after: this.playerHp,
      fever_before: Math.round(feverBefore),
      fever_after: Math.round(this.feverGauge),
      target_size_px: t.sizePx,
      spawn_interval_ms: t.spawn_interval_ms,
      phase_at_spawn: t.phase,
      phase_spawn_index: t.phaseSpawnIndex,
      x_norm: t.x_norm,
      y_norm: t.y_norm,
      zone_lr: t.zone_lr,
      zone_ud: t.zone_ud
    };
    this.eventLogger?.add(row);

    const fb = $('#sb-feedback');
    if (fb) {
      let msg = '';
      if (grade === 'perfect' || grade === 'bossface') msg = 'สุดยอด! PERFECT 🎯';
      else if (grade === 'good') msg = 'ดีมาก! ลุยต่อเลย 💪';
      else if (grade === 'bad') msg = 'ช้าไปนิด ลองตีให้เร็วกว่านี้ 😅';
      else if (grade === 'bomb') msg = 'โดนบอมบ์! ระวังเป้าดำ ๆ 🔥';
      else if (grade === 'decoy') msg = 'เป้าลวง! อ่านสถานการณ์ให้ดี 👀';
      fb.textContent = msg;
      fb.className = 'sb-feedback ' + grade;
    }

    this._updateBossPhase();
    this._updateHUD();

    if (this.bossHp <= 0) {
      this._onBossDefeated();
    }
  }

  _registerMiss(t) {
    this.missCount++;
    this.combo = 0;
    if (!t.isBomb && !t.isDecoy && !t.isBossFace) {
      this.playerHp = clamp(this.playerHp - 4, 0, this.playerHpMax);
    }

    const fb = $('#sb-feedback');
    if (fb) {
      fb.textContent = 'พลาดจังหวะ! ลองรอให้ใกล้กลางจอก่อนค่อยตี 😅';
      fb.className = 'sb-feedback miss';
    }

    const row = {
      session_id: this.sessionId,
      run_index: this.runIndex,
      mode: this.mode,
      difficulty: this.diffKey,
      participant: this.participant,
      group: this.group,
      note: this.note,
      boss_id: t.bossId,
      boss_index: t.bossIndex,
      boss_phase: t.bossPhase,
      is_decoy: t.isDecoy ? 1 : 0,
      is_bomb: t.isBomb ? 1 : 0,
      is_bossface: t.isBossFace ? 1 : 0,
      target_id: t.id,
      event_type: 'miss',
      grade: 'miss',
      age_ms: t.lifeMs,
      fever_on: this.feverOn ? 1 : 0,
      score_delta: 0,
      score_total: this.score,
      combo_before: 0,
      combo_after: 0,
      player_hp_before: this.playerHp,
      player_hp_after: this.playerHp,
      fever_before: Math.round(this.feverGauge),
      fever_after: Math.round(this.feverGauge),
      target_size_px: t.sizePx,
      spawn_interval_ms: t.spawn_interval_ms,
      phase_at_spawn: t.phase,
      phase_spawn_index: t.phaseSpawnIndex,
      x_norm: t.x_norm,
      y_norm: t.y_norm,
      zone_lr: t.zone_lr,
      zone_ud: t.zone_ud
    };
    this.eventLogger?.add(row);

    if (this.playerHp <= 0) {
      this._finish('player-down');
    }
  }

  _hitByBomb() {
    const dmg = 18;
    this.playerHp = clamp(this.playerHp - dmg, 0, this.playerHpMax);
    if (this.playerHp <= 0) {
      this._finish('bomb-ko');
    }
  }

  _damageBoss(amount) {
    this.bossHp = clamp(this.bossHp - amount, 0, this.bossHpMax);
    this._updateBossPhase();
  }

  _onBossDefeated() {
    const bossMeta = BOSSES[this.currentBossIndex] || BOSSES[0];
    this.bossesCleared++;

    if (this.hooks.onBossClear) {
      this.hooks.onBossClear(this.currentBossIndex, bossMeta);
    }

    if (this.currentBossIndex < BOSSES.length - 1) {
      this.currentBossIndex++;
      this.bossHpMax = 100 + this.currentBossIndex * 20;
      this.bossHp    = this.bossHpMax;
      this.bossPhase = 1;
      this.nearDeath = false;
      this.shouldSpawnBossFace = false;
      this.bossFaceActive = false;
      this._updateBossPhase();
      this._updateBossHUD();

      if (this.hooks.onBossChange) {
        this.hooks.onBossChange(this.currentBossIndex, BOSSES[this.currentBossIndex]);
      }
    } else {
      this._finish('all-boss-cleared');
    }
  }

  _gainFever(amount) {
    this.feverGauge = clamp(this.feverGauge + amount, 0, 100);
    if (!this.feverOn && this.feverGauge >= 100) {
      this.feverOn = true;
      this.feverCount++;
      this.feverGauge = 100;
      if (this.hooks.onFever) this.hooks.onFever(true);
    }
  }

  _drainFever(dt) {
    const drain = dt * 0.03;
    this.feverGauge = clamp(this.feverGauge - drain, 0, 100);
    if (this.feverGauge <= 0) {
      this.feverOn = false;
      if (this.hooks.onFever) this.hooks.onFever(false);
    }
  }

  _decayFever(dt) {
    const decay = dt * 0.01;
    this.feverGauge = clamp(this.feverGauge - decay, 0, 100);
  }

  _accRT(store, rtMs) {
    store.n++;
    store.sum += rtMs;
    store.sumSq += rtMs * rtMs;
  }

  // ---------- HUD ----------
  _updateWrapData() {
    const wrap = this.wrap;
    if (!wrap) return;
    wrap.dataset.diff  = this.diffKey;
    wrap.dataset.boss  = String(this.currentBossIndex);
    wrap.dataset.phase = String(this.bossPhase);
  }

  _updateHUD() {
    const timeSec = this.remainingMs / 1000;
    const tEl = $('#stat-time');
    if (tEl) tEl.textContent = timeSec.toFixed(1);

    const sEl = $('#stat-score');
    if (sEl) sEl.textContent = this.score;

    const cEl = $('#stat-combo');
    if (cEl) cEl.textContent = this.combo;

    const pEl = $('#stat-phase');
    if (pEl) pEl.textContent = this.bossPhase;

    // HP bars
    const pBar = $('[data-sb-player-hp]');
    const bBar = $('[data-sb-boss-hp]');
    if (pBar) {
      const ratio = this.playerHp / this.playerHpMax;
      pBar.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
    }
    if (bBar) {
      const ratio = this.bossHp / this.bossHpMax;
      bBar.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
    }

    // FEVER
    const fFill = $('#fever-fill');
    if (fFill) {
      const frac = clamp(this.feverGauge / 100, 0, 1);
      fFill.style.transform = `scaleX(${frac})`;
    }
    const fStatus = $('#fever-status');
    if (fStatus) {
      if (this.feverOn) {
        fStatus.textContent = 'FEVER!!';
        fStatus.classList.add('on');
      } else {
        fStatus.textContent = 'Ready';
        fStatus.classList.remove('on');
      }
    }

    this._updateWrapData();
  }

  _updateBossHUD() {
    const bossMeta = BOSSES[this.currentBossIndex] || BOSSES[0];
    const nameEl  = $('#boss-portrait-name');
    const hintEl  = $('#boss-portrait-hint');
    const emojiEl = $('#boss-portrait-emoji');
    if (nameEl)  nameEl.textContent  = bossMeta.name;
    if (hintEl)  hintEl.textContent  = bossMeta.title;
    if (emojiEl) emojiEl.textContent = bossMeta.emoji;
  }
}

// ----------------- Boss intro + reward helpers -----------------
function showBossIntroOverlay(bossIndex, bossMeta, cb) {
  const intro = $('#bossIntro');
  if (!intro) {
    cb?.();
    return;
  }
  const emo  = $('#boss-intro-emoji');
  const name = $('#boss-intro-name');
  const title= $('#boss-intro-title');
  const desc = $('#boss-intro-desc');

  if (emo)  emo.textContent  = bossMeta.emoji;
  if (name) name.textContent = bossMeta.name;
  if (title)title.textContent= `BOSS ${bossIndex+1} — ${bossMeta.name}`;
  if (desc) desc.textContent = bossMeta.title;

  intro.classList.remove('hidden');

  const handler = () => {
    intro.classList.add('hidden');
    intro.removeEventListener('click', handler);
    intro.removeEventListener('pointerdown', handler);
    cb && cb();
  };

  intro.addEventListener('click', handler);
  intro.addEventListener('pointerdown', handler);
}

function showBossRewardToast(bossMeta) {
  const wrap = $('#sb-wrap') || document.body;
  let toast = document.getElementById('sb-reward-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sb-reward-toast';
    toast.className = 'sb-reward-toast';
    wrap.appendChild(toast);
  }
  toast.textContent = `🏅 ปลดล็อกรางวัล: ${bossMeta.reward || bossMeta.name}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ----------------- CSV helper -----------------
function downloadCsv(text, filename) {
  if (!text) {
    alert('ยังไม่มีข้อมูล CSV จากรอบล่าสุด');
    return;
  }
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------- initShadowBreaker (UI binding) -----------------
export function initShadowBreaker() {
  const wrap = $('#sb-wrap') || document.body;
  const targetLayer = $('#target-layer') || wrap;

  let currentEngine = null;

  const renderer = new DomRenderer(targetLayer, {
    onTargetHit: (id, pos) => {
      if (currentEngine) currentEngine.handleHit(id, pos);
    }
  });

  let lastEventLogger = null;
  let lastSessionLogger = null;

  function showView(name) {
    const views = ['#view-menu', '#view-research-form', '#view-play', '#view-result'];
    views.forEach(sel => {
      const el = $(sel);
      if (!el) return;
      if (sel === name || (name.startsWith('#') && sel === name)) {
        el.classList.remove('hidden');
      } else if (name === 'menu' && sel === '#view-menu') {
        el.classList.remove('hidden');
      } else if (name === 'play' && sel === '#view-play') {
        el.classList.remove('hidden');
      } else if (name === 'result' && sel === '#view-result') {
        el.classList.remove('hidden');
      } else if (name === 'research' && sel === '#view-research-form') {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  function handleEnd(summary) {
    // fill result table
    const setText = (sel, v) => {
      const el = $(sel);
      if (el) el.textContent = v;
    };

    setText('#res-mode', summary.mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ');
    setText('#res-diff', summary.difficulty);
    setText('#res-endreason', summary.end_reason);
    setText('#res-score', summary.final_score);
    setText('#res-grade', summary.grade);
    setText('#res-maxcombo', summary.max_combo);
    setText('#res-miss', summary.total_miss);
    setText('#res-accuracy', summary.accuracy_pct + '%');
    setText('#res-totalhits', summary.total_hits);
    setText('#res-rt-normal',
      summary.avg_rt_normal_ms !== '' ? summary.avg_rt_normal_ms + ' ms' : '-');
    setText('#res-rt-decoy',
      summary.avg_rt_decoy_ms !== '' ? summary.avg_rt_decoy_ms + ' ms' : '-');
    setText('#res-participant', summary.participant || '-');

    setText('#res-fever-time', (summary.fever_total_time_s || 0) + ' s');
    setText('#res-bosses', summary.bosses_cleared || 0);
    setText('#res-lowhp-time', (summary.low_hp_time_s || 0) + ' s');
    if (typeof summary.menu_to_play_ms === 'number') {
      setText('#res-menu-latency', (summary.menu_to_play_ms / 1000).toFixed(2) + ' s');
    }

    showView('result');
  }

  function startGame(mode) {
    const diffSel = $('#difficulty');
    const durSel  = $('#duration');
    const diffKey = diffSel ? (diffSel.value || 'normal') : 'normal';
    const durationSec = durSel ? parseInt(durSel.value, 10) || 60 : 60;

    const participant = mode === 'research'
      ? ($('#research-id')?.value || '').trim()
      : '';
    const group = mode === 'research'
      ? ($('#research-group')?.value || '').trim()
      : '';
    const note = mode === 'research'
      ? ($('#research-note')?.value || '').trim()
      : '';

    const now = performance.now();
    const menuTs = window.__SB_MENU_OPEN || now;
    const menuToPlayMs = now - menuTs;

    const eventLogger = new EventLogger();
    const sessionLogger = new SessionLogger();

    let runIndex = 1;
    if (wrap.dataset.runIndex) {
      runIndex = Number(wrap.dataset.runIndex) + 1;
    }
    wrap.dataset.runIndex = String(runIndex);

    currentEngine = new ShadowBreakerEngine({
      mode,
      diffKey,
      durationSec,
      wrap,
      renderer,
      eventLogger,
      sessionLogger,
      participant,
      group,
      note,
      runIndex,
      menuToPlayMs,
      hooks: {
        onEnd: handleEnd,
        onBossChange: (bossIndex, bossMeta) => {
          // intro boss ถัดไป (ไม่หยุดเวลา)
          showBossIntroOverlay(bossIndex, bossMeta, null);
        },
        onBossClear: (bossIndex, bossMeta) => {
          showBossRewardToast(bossMeta);
        },
        onPhaseChange: (bossIndex, phase, info) => {
          if (info.phaseChanged) {
            const fw = $('#sb-wrap');
            if (fw) {
              fw.classList.add('sb-phase-change');
              setTimeout(() => fw.classList.remove('sb-phase-change'), 350);
            }
          }
        },
        onNearDeath: () => {
          const fw = $('#sb-wrap');
          if (fw) {
            fw.classList.add('sb-near-death');
            setTimeout(() => fw.classList.remove('sb-near-death'), 600);
          }
        },
        onFever: (on) => {
          const fw = $('#sb-wrap');
          if (fw) fw.classList.toggle('sb-fever-on', !!on);
        }
      }
    });

    lastEventLogger = eventLogger;
    lastSessionLogger = sessionLogger;

    showView('play');

    // Boss intro แรก → start engine หลังแตะ
    const bossInfo = currentEngine.getBossMeta();
    showBossIntroOverlay(bossInfo.index, bossInfo.meta, () => {
      currentEngine.start();
    });
  }

  // ----- buttons -----
  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');
  const btnResearchBegin = $('[data-action="research-begin-play"]');
  const btnStopEarly     = $('[data-action="stop-early"]');
  const btnPlayAgain     = $('[data-action="play-again"]');
  const btnCsvEvents     = $('[data-action="download-csv-events"]');
  const btnCsvSession    = $('[data-action="download-csv-session"]');
  const btnBackMenus     = $$('[data-action="back-to-menu"]');

  btnStartNormal?.addEventListener('click', () => {
    startGame('normal');
  });

  btnStartResearch?.addEventListener('click', () => {
    showView('research');
  });

  btnResearchBegin?.addEventListener('click', () => {
    startGame('research');
  });

  btnStopEarly?.addEventListener('click', () => {
    currentEngine?.stop('manual-stop');
  });

  btnPlayAgain?.addEventListener('click', () => {
    currentEngine = null;
    window.__SB_MENU_OPEN = performance.now();
    showView('menu');
  });

  btnBackMenus.forEach(btn => {
    btn.addEventListener('click', () => {
      currentEngine = null;
      window.__SB_MENU_OPEN = performance.now();
      showView('menu');
    });
  });

  btnCsvEvents?.addEventListener('click', () => {
    const csv = lastEventLogger?.toCsv();
    downloadCsv(csv || '', 'shadow-breaker-events.csv');
  });

  btnCsvSession?.addEventListener('click', () => {
    const csv = lastSessionLogger?.toCsv();
    downloadCsv(csv || '', 'shadow-breaker-sessions.csv');
  });

  window.__SB_MENU_OPEN = performance.now();
  showView('menu');
  console.log('[ShadowBreaker] init complete');
}