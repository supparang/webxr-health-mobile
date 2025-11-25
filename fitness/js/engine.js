// === js/engine.js — Shadow Breaker Engine (2025-11-27c) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-27c';

// ---------- Utilities ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function downloadCSV(filename, csv) {
  if (!csv) {
    alert('ยังไม่มีข้อมูล CSV');
    return;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Config ----------

const DIFF_CONFIG = {
  easy: {
    key: 'easy',
    label: 'Easy',
    timeSec: 60,
    spawnIntervalMs: 1100,
    targetLifetimeMs: 2200,
    baseSizePx: 180
  },
  normal: {
    key: 'normal',
    label: 'Normal',
    timeSec: 60,
    spawnIntervalMs: 900,
    targetLifetimeMs: 2000,
    baseSizePx: 150
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    timeSec: 60,
    spawnIntervalMs: 750,
    targetLifetimeMs: 1700,
    baseSizePx: 130
  }
};

// 4 บอส
const BOSSES = [
  {
    id: 0,
    name: 'Bubble Glove',
    emoji: '🐣',
    title: 'โฟกัสที่เป้าฟองแล้วตีให้ทัน',
    hp: 100,
    spawnMultiplier: 1.0
  },
  {
    id: 1,
    name: 'Neon Knuckle',
    emoji: '⚡',
    title: 'เป้าเริ่มเล็กขึ้นและเร็วขึ้น',
    hp: 120,
    spawnMultiplier: 0.9
  },
  {
    id: 2,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'มีเป้าลวงและบอมบ์แทรกบ่อยขึ้น',
    hp: 140,
    spawnMultiplier: 0.8
  },
  {
    id: 3,
    name: 'Final Burst',
    emoji: '💥',
    title: 'โหมดโหดสุด คอมโบยาว ๆ ไปเลย',
    hp: 160,
    spawnMultiplier: 0.7
  }
];

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Core Engine Class ----------

class ShadowBreakerEngine {
  constructor(opts) {
    this.mode = opts.mode || 'normal';
    this.diffKey = opts.diffKey || 'normal';
    this.diffConf = DIFF_CONFIG[this.diffKey] || DIFF_CONFIG.normal;

    const customTimeSec = this._readTimeOverride(this.diffConf.timeSec);
    this.timeLimitMs = customTimeSec * 1000;

    this.renderer = opts.renderer;
    this.eventLogger = opts.eventLogger;
    this.sessionLogger = opts.sessionLogger;
    this.hooks = opts.hooks || {};
    this.wrap = opts.wrap;

    this.participant = opts.participant || '';
    this.group = opts.group || '';
    this.note = opts.note || '';
    this.runIndex = opts.runIndex || 1;
    this.menuToPlayMs = opts.menuToPlayMs || 0;

    this.sessionId = `SB_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

    this.resetState();

    if (this.renderer) {
      // renderer จะเรียกกลับมาเวลาเป้าถูกคลิก
      this.renderer.onTargetHit = (id, pos) => this.handleHit(id, pos);
    }
  }

  resetState() {
    this.started = false;
    this.ended = false;
    this.startPerf = 0;
    this.lastTick = 0;
    this.elapsedMs = 0;
    this.remainingMs = this.timeLimitMs;

    this.bossIndex = 0;
    this.boss = BOSSES[this.bossIndex];
    this.bossHP = this.boss.hp;
    this.playerHP = 100;
    this.shield = 0;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missCount = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.badCount = 0;
    this.totalTargets = 0;
    this.totalHits = 0;
    this.totalBombHits = 0;
    this.bossesCleared = 0;

    this.feverGauge = 0;
    this.feverOn = false;
    this.feverCount = 0;
    this.feverTimeMs = 0;
    this._feverLastTs = 0;

    this.lowHpTimeMs = 0;

    this.nextSpawnAt = 0;
    this.spawnSeq = 0;
    this.targets = new Map();

    this.rtNormal = { n: 0, sum: 0, sumSq: 0 };
    this.rtDecoy  = { n: 0, sum: 0, sumSq: 0 };

    this.errorCount = 0;
    this.focusEvents = 0;
  }

  _readTimeOverride(defaultSec) {
    const ids = ['#sb-time', '#sb-duration', '#time-limit', '#duration'];
    for (const id of ids) {
      const el = $(id);
      if (!el) continue;
      const v = parseInt(el.value, 10);
      if (!Number.isNaN(v) && v > 0) return v;
    }
    return defaultSec;
  }

  // ---------- life cycle ----------

  start() {
    if (this.started) return;
    this.started = true;

    this.startPerf = performance.now();
    this.lastTick = this.startPerf;
    this.nextSpawnAt = this.startPerf + 400;
    this._feverLastTs = this.startPerf;

    this._updateHUD();
    this._updateBossHUD();

    const loop = (ts) => {
      if (this.ended) return;
      this._tick(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(reason = 'manual') {
    if (this.ended) return;
    this._finish(reason);
  }

  _tick(ts) {
    const dt = ts - this.lastTick;
    this.lastTick = ts;

    this.elapsedMs = ts - this.startPerf;
    this.remainingMs = Math.max(0, this.timeLimitMs - this.elapsedMs);

    if (this.playerHP <= 30) {
      this.lowHpTimeMs += dt;
    }

    if (this.feverOn) {
      this.feverTimeMs += ts - this._feverLastTs;
    }
    this._feverLastTs = ts;

    this._updateFever(dt);

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

    for (const id of this.targets.keys()) {
      this.renderer?.removeTarget(id, 'end');
    }
    this.targets.clear();

    const durationS = this.elapsedMs / 1000;
    const accuracy = this.totalTargets
      ? (this.totalHits / this.totalTargets) * 100
      : 0;

    const avgStd = (obj) => {
      if (!obj.n) return { avg: '', std: '' };
      const mean = obj.sum / obj.n;
      const v = Math.max(0, obj.sumSq / obj.n - mean * mean);
      return { avg: mean, std: Math.sqrt(v) };
    };
    const rtN = avgStd(this.rtNormal);
    const rtD = avgStd(this.rtDecoy);

    const grade = this._calcGrade(accuracy, this.score);

    const sessionRow = {
      session_id: this.sessionId,
      build_version: BUILD_VERSION,
      mode: this.mode,
      difficulty: this.diffKey,
      training_phase: `boss-${this.bossIndex + 1}`,
      run_index: this.runIndex,
      start_ts: new Date(performance.timeOrigin + this.startPerf).toISOString(),
      end_ts: new Date().toISOString(),
      duration_s: +durationS.toFixed(3),
      end_reason: reason,
      final_score: this.score,
      grade,
      total_targets: this.totalTargets,
      total_hits: this.totalHits,
      total_miss: this.missCount,
      total_bombs_hit: this.totalBombHits,
      accuracy_pct: +accuracy.toFixed(1),
      max_combo: this.maxCombo,
      perfect_count: this.perfectCount,
      good_count: this.goodCount,
      bad_count: this.badCount,
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
      env_ua: navigator.userAgent,
      env_viewport_w: window.innerWidth,
      env_viewport_h: window.innerHeight,
      env_input_mode: ('ontouchstart' in window) ? 'touch' : 'mouse',
      error_count: this.errorCount,
      focus_events: this.focusEvents
    };

    this.sessionLogger?.add(sessionRow);

    if (this.hooks.onEnd) {
      this.hooks.onEnd({
        ...sessionRow,
        reason,
        accuracy,
        score: this.score,
        combo: this.combo,
        missCount: this.missCount,
        bossIndex: this.bossIndex,
        boss: this.boss
      });
    }
  }

  _calcGrade(accuracy, score) {
    if (accuracy >= 90 && score >= 3000) return 'S';
    if (accuracy >= 80) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    return 'D';
  }

  // ---------- spawn / timeout ----------

  _spawnTarget(now) {
    const diff = this.diffConf;
    const boss = this.boss;

    // ประเภทเป้า
    const r = Math.random();
    let type = 'normal';
    if (r > 0.92) type = 'bomb';
    else if (r > 0.86) type = 'heal';
    else if (r > 0.78) type = 'shield';
    else if (r > 0.68 && this.bossIndex >= 1) type = 'decoy';

    // ขนาดเป้าตามระดับความยาก + jitter
    const sizeJitter = (Math.random() * 0.22 - 0.11);
    let sizePx = diff.baseSizePx * (1 + sizeJitter);
    if (this.diffKey === 'hard') sizePx *= 0.9;
    if (type === 'bomb' || type === 'decoy') sizePx *= 0.9;

    const lifeMs = diff.targetLifetimeMs;

    // แบ่งสนามเป็น grid 3×3 เพื่อให้วิ่งทั่วจอ
    const zoneLR = randChoice(['L', 'C', 'R']);
    const zoneUD = randChoice(['U', 'M', 'D']);

    const id = ++this.spawnSeq;
    const t = {
      id,
      boss_id: boss.id,
      boss_phase: this._currentPhase(), // 1–3 จาก HP boss ปัจจุบัน
      type,
      isDecoy: type === 'decoy',
      isBomb: type === 'bomb',
      isHeal: type === 'heal',
      isShield: type === 'shield',
      isBossFace: false,
      spawnTime: now,
      lifeMs,
      expireTime: now + lifeMs,
      sizePx: Math.round(sizePx),
      spawn_interval_ms: diff.spawnIntervalMs * boss.spawnMultiplier,
      phaseAtSpawn: this._currentPhase(),
      phaseSpawnIndex: id,
      x_norm: null,
      y_norm: null,
      zone_lr: zoneLR,
      zone_ud: zoneUD,
      diffKey: this.diffKey
    };

    this.targets.set(id, t);
    this.totalTargets++;

    this.renderer?.spawnTarget(t);

    let interval = diff.spawnIntervalMs * boss.spawnMultiplier;
    if (this.feverOn) interval *= 0.7;
    if (this.diffKey === 'hard') interval *= 0.9;
    // ใกล้ตาย → spawn เร็วขึ้น
    if (this._isNearDeath()) interval *= 0.75;

    this.nextSpawnAt = now + interval;
  }

  _checkTimeouts(now) {
    const toRemove = [];
    for (const [id, t] of this.targets) {
      if (now >= t.expireTime) {
        toRemove.push(id);
        this._registerMiss(t);
      }
    }
    for (const id of toRemove) {
      this.renderer?.removeTarget(id, 'timeout');
      this.targets.delete(id);
    }
  }

  // ---------- hit / scoring ----------

  handleHit(id, pos) {
    const t = this.targets.get(id);
    if (!t || this.ended) return;

    const now = performance.now();
    this.targets.delete(id);
    this.renderer?.removeTarget(id, 'hit');

    const age = now - t.spawnTime;
    const life = t.lifeMs;
    const ratio = clamp(age / life, 0, 1);

    let grade = 'good';
    if (t.isBomb) grade = 'bomb';
    else if (t.isDecoy) grade = 'decoy';
    else if (ratio <= 0.35) grade = 'perfect';
    else if (ratio >= 0.9) grade = 'bad';

    let scoreDelta = 0;
    let fxEmoji = '✨';

    const comboBefore = this.combo;
    const hpBefore = this.playerHP;
    const feverBefore = this.feverGauge;

    if (grade === 'perfect') {
      scoreDelta = 120;
      this.score += scoreDelta;
      this.combo++;
      this.perfectCount++;
      this.totalHits++;
      this._gainFever(9);
      fxEmoji = '💥';
      this._damageBoss(3);
    } else if (grade === 'good') {
      scoreDelta = 80;
      this.score += scoreDelta;
      this.combo++;
      this.goodCount++;
      this.totalHits++;
      this._gainFever(6);
      fxEmoji = '⭐';
      this._damageBoss(2);
    } else if (grade === 'bad') {
      scoreDelta = 40;
      this.score += scoreDelta;
      this.combo = 0;
      this.badCount++;
      this.totalHits++;
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

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    if (this.feverOn && scoreDelta > 0) {
      this.score += Math.round(scoreDelta * 0.3);
    }

    if (!t.isDecoy && !t.isBomb) {
      this._accRT(this.rtNormal, age);
    } else if (t.isDecoy) {
      this._accRT(this.rtDecoy, age);
    }

    this.renderer?.playHitFx(t.id, {
      grade: grade === 'decoy' ? 'miss' : grade,
      scoreDelta,
      fxEmoji
    });

    const row = {
      session_id: this.sessionId,
      target_id: t.id,
      boss_id: t.boss_id,
      boss_phase: t.boss_phase,
      is_decoy: t.isDecoy ? 1 : 0,
      is_bossface: t.isBossFace ? 1 : 0,
      grade,
      age_ms: Math.round(age),
      fever_on: this.feverOn ? 1 : 0,
      score_delta: scoreDelta,
      combo_before: comboBefore,
      combo_after: this.combo,
      player_hp_before: hpBefore,
      player_hp_after: this.playerHP,
      fever_before: Math.round(feverBefore),
      fever_after: Math.round(this.feverGauge),
      target_size_px: t.sizePx,
      spawn_interval_ms: t.spawn_interval_ms,
      phase_at_spawn: t.phaseAtSpawn,
      phase_spawn_index: t.phaseSpawnIndex,
      x_norm: t.x_norm ?? '',
      y_norm: t.y_norm ?? '',
      zone_lr: t.zone_lr,
      zone_ud: t.zone_ud
    };
    this.eventLogger?.add(row);

    this._updateHUD();
    this._updateBossHUD();

    if (this.bossHP <= 0) {
      this._nextBoss();
    }
  }

  _registerMiss(t) {
    this.missCount++;
    this.combo = 0;

    if (!t.isBomb && !t.isDecoy) {
      this.playerHP = clamp(this.playerHP - 4, 0, 100);
    }

    const age = t.lifeMs;

    const row = {
      session_id: this.sessionId,
      target_id: t.id,
      boss_id: t.boss_id,
      boss_phase: t.boss_phase,
      is_decoy: t.isDecoy ? 1 : 0,
      is_bossface: t.isBossFace ? 1 : 0,
      grade: 'miss',
      age_ms: Math.round(age),
      fever_on: this.feverOn ? 1 : 0,
      score_delta: 0,
      combo_before: 0,
      combo_after: 0,
      player_hp_before: this.playerHP,
      player_hp_after: this.playerHP,
      fever_before: Math.round(this.feverGauge),
      fever_after: Math.round(this.feverGauge),
      target_size_px: t.sizePx,
      spawn_interval_ms: t.spawn_interval_ms,
      phase_at_spawn: t.phaseAtSpawn,
      phase_spawn_index: t.phaseSpawnIndex,
      x_norm: t.x_norm ?? '',
      y_norm: t.y_norm ?? '',
      zone_lr: t.zone_lr,
      zone_ud: t.zone_ud
    };
    this.eventLogger?.add(row);

    this._updateHUD();
    this._updateBossHUD();

    if (this.playerHP <= 0) {
      this._finish('player-down');
    }
  }

  _hitByBomb() {
    let dmg = 18;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      this.playerHP = clamp(this.playerHP - dmg, 0, 100);
    }
    if (this.playerHP <= 0) {
      this._finish('bomb-ko');
    }
  }

  _damageBoss(amount) {
    this.bossHP = clamp(this.bossHP - amount, 0, this.boss.hp);
  }

  _gainFever(amount) {
    this.feverGauge = clamp(this.feverGauge + amount, 0, 100);
    if (!this.feverOn && this.feverGauge >= 100) {
      this.feverOn = true;
      this.feverCount++;
    }
  }

  _updateFever(dt) {
    if (this.feverOn) {
      const drain = dt * 0.02;
      this.feverGauge = clamp(this.feverGauge - drain, 0, 100);
      if (this.feverGauge <= 0) this.feverOn = false;
    } else {
      const decay = dt * 0.005;
      this.feverGauge = clamp(this.feverGauge - decay, 0, 100);
    }
  }

  _nextBoss() {
    this.bossesCleared++;
    if (this.bossIndex < BOSSES.length - 1) {
      this.bossIndex++;
      this.boss = BOSSES[this.bossIndex];
      this.bossHP = this.boss.hp;
      this._updateBossHUD();
    } else {
      this._finish('all-boss-cleared');
    }
  }

  _currentPhase() {
    const ratio = this.boss.hp ? this.bossHP / this.boss.hp : 0;
    if (ratio > 0.66) return 1;
    if (ratio > 0.33) return 2;
    return 3;
  }

  _isNearDeath() {
    const ratio = this.boss.hp ? this.bossHP / this.boss.hp : 0;
    return ratio <= 0.25;
  }

  _accRT(store, rtMs) {
    store.n++;
    store.sum += rtMs;
    store.sumSq += rtMs * rtMs;
  }

  // ---------- HUD ----------

  _updateHUD() {
    const tSec = this.remainingMs / 1000;
    const hudTime = $('#stat-time');
    if (hudTime) hudTime.textContent = tSec.toFixed(1).padStart(4, '0');

    const hudScore = $('#stat-score');
    if (hudScore) hudScore.textContent = this.score;

    const hudCombo = $('#stat-combo');
    if (hudCombo) hudCombo.textContent = this.combo;

    const hudPhase = $('#stat-phase');
    if (hudPhase) hudPhase.textContent = this._currentPhase();

    // fever bar
    const feverFill = $('#fever-fill');
    if (feverFill) {
      const v = clamp(this.feverGauge, 0, 100) / 100;
      feverFill.style.transform = `scaleX(${v})`;
    }
    const feverStatus = $('#fever-status');
    if (feverStatus) {
      feverStatus.textContent = this.feverOn ? 'FEVER!!' : 'Ready';
      feverStatus.classList.toggle('on', this.feverOn);
    }

    // HP bars
    const playerBar = $('[data-sb-player-hp]');
    const bossBar   = $('[data-sb-boss-hp]');
    if (playerBar) {
      playerBar.style.transform = `scaleX(${clamp(this.playerHP,0,100)/100})`;
    }
    if (bossBar) {
      const ratio = this.boss.hp ? this.bossHP / this.boss.hp : 0;
      bossBar.style.transform = `scaleX(${clamp(ratio,0,1)})`;
    }
  }

  _updateBossHUD() {
    const nameEl  = $('#boss-portrait-name');
    const hintEl  = $('#boss-portrait-hint');
    const emojiEl = $('#boss-portrait-emoji');

    if (nameEl)  nameEl.textContent  = this.boss.name;
    if (hintEl)  hintEl.textContent  = this.boss.title;
    if (emojiEl) emojiEl.textContent = this.boss.emoji;

    const ratio = this.boss.hp ? this.bossHP / this.boss.hp : 0;
    const phase = this._currentPhase();

    // เปลี่ยนพื้นหลังตาม phase
    const bgEl = $('#sb-bg');
    if (bgEl) {
      bgEl.classList.remove('bg-phase1', 'bg-phase2', 'bg-phase3');
      bgEl.classList.add(
        phase === 1 ? 'bg-phase1' :
        phase === 2 ? 'bg-phase2' : 'bg-phase3'
      );
    }

    // data-* สำหรับ CSS
    if (this.wrap) {
      this.wrap.dataset.phase = String(phase);
      this.wrap.dataset.boss = String(this.boss.id);
      this.wrap.dataset.diff = this.diffKey;
    }

    const phaseLabel = $('#boss-phase-label');
    if (phaseLabel) {
      phaseLabel.textContent = `PHASE ${phase}`;
    }

    // สั่นตอนใกล้ตาย
    const bossPortrait = $('#boss-portrait');
    if (bossPortrait) {
      if (ratio <= 0.35) bossPortrait.classList.add('sb-shake');
      else bossPortrait.classList.remove('sb-shake');
    }
  }
}

// ---------- init + wiring with HTML ----------

export function initShadowBreaker() {
  const wrap = $('#sb-wrap') || document.body;
  const viewMenu     = $('#view-menu');
  const viewPlay     = $('#view-play');
  const viewResult   = $('#view-result');
  const viewResearch = $('#view-research-form');
  const targetLayer  = $('#target-layer') || wrap;

  const renderer = new DomRenderer(targetLayer || wrap, {});

  let currentEngine = null;
  let lastEvents = null;
  let lastSessions = null;

  function switchView(which) {
    const all = [viewMenu, viewPlay, viewResult, viewResearch];
    all.forEach(el => el && el.classList.add('hidden'));

    if (which === 'menu'   && viewMenu)   viewMenu.classList.remove('hidden');
    if (which === 'play'   && viewPlay)   viewPlay.classList.remove('hidden');
    if (which === 'result' && viewResult) viewResult.classList.remove('hidden');
    if (which === 'research' && viewResearch) viewResearch.classList.remove('hidden');
  }

  function handleEnd(state) {
    const setText = (id, val) => {
      const el = $(id);
      if (el) el.textContent = val;
    };

    setText('#res-mode', state.mode === 'research' ? 'Research' : 'Normal');
    setText('#res-diff', state.difficulty);
    setText('#res-endreason', state.end_reason);
    setText('#res-score', state.final_score);
    setText('#res-grade', state.grade);
    setText('#res-maxcombo', state.max_combo);
    setText('#res-miss', state.total_miss);
    setText('#res-accuracy', `${state.accuracy_pct}%`);
    setText('#res-totalhits', state.total_hits);
    setText('#res-rt-normal', state.avg_rt_normal_ms || '-');
    setText('#res-rt-decoy', state.avg_rt_decoy_ms || '-');
    setText('#res-participant', state.participant || '-');

    setText('#res-fever-time', (state.fever_total_time_s ?? 0).toFixed
      ? state.fever_total_time_s.toFixed(2) + ' s'
      : state.fever_total_time_s + ' s');

    setText('#res-bosses', state.bosses_cleared ?? 0);

    setText('#res-lowhp-time', (state.low_hp_time_s ?? 0).toFixed
      ? state.low_hp_time_s.toFixed(2) + ' s'
      : state.low_hp_time_s + ' s');

    if (typeof state.menu_to_play_ms === 'number') {
      setText('#res-menu-latency', (state.menu_to_play_ms / 1000).toFixed(2) + ' s');
    }

    switchView('result');
  }

  function startGame(mode) {
    const diffKey = ($('#difficulty')?.value) || 'normal';

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
    const menuToPlayMs = now - (window.__SB_MENU_OPEN_TS || now);

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
      renderer,
      eventLogger,
      sessionLogger,
      wrap,
      participant,
      group,
      note,
      runIndex,
      menuToPlayMs,
      hooks: { onEnd: handleEnd }
    });

    lastEvents = eventLogger;
    lastSessions = sessionLogger;

    // เคลียร์เป้าเก่าบนจอ
    if (targetLayer) targetLayer.innerHTML = '';

    switchView('play');
    currentEngine.start();
  }

  // ----- buttons wiring -----
  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');
  const btnResearchBegin = $('[data-action="research-begin-play"]');
  const btnStopEarly     = $('[data-action="stop-early"]');
  const btnPlayAgain     = $('[data-action="play-again"]');
  const btnDLSession     = $('[data-action="download-csv-session"]');
  const btnDLEvents      = $('[data-action="download-csv-events"]');
  const btnBackToMenus   = $$('[data-action="back-to-menu"]');

  btnStartNormal?.addEventListener('click', () => startGame('normal'));

  btnStartResearch?.addEventListener('click', () => {
    switchView('research');
  });

  btnResearchBegin?.addEventListener('click', () => {
    startGame('research');
  });

  btnStopEarly?.addEventListener('click', () => {
    currentEngine?.stop('manual-stop');
  });

  btnPlayAgain?.addEventListener('click', () => {
    const lastMode = currentEngine?.mode || 'normal';
    startGame(lastMode);
  });

  btnBackToMenus.forEach(b => {
    b.addEventListener('click', () => {
      currentEngine = null;
      switchView('menu');
      window.__SB_MENU_OPEN_TS = performance.now();
    });
  });

  btnDLSession?.addEventListener('click', () => {
    const csv = lastSessions?.toCsv();
    downloadCSV('shadow-breaker-session.csv', csv);
  });

  btnDLEvents?.addEventListener('click', () => {
    const csv = lastEvents?.toCsv();
    downloadCSV('shadow-breaker-events.csv', csv);
  });

  window.__SB_MENU_OPEN_TS = performance.now();
  switchView('menu');
}
