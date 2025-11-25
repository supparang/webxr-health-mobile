// === fitness/js/engine.js — Shadow Breaker Engine (2025-11-25 final) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-25-final';

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

// 4 บอส / phase
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
    title: 'เป้าเริ่มเล็กขึ้น เร็วขึ้น',
    hp: 120,
    spawnMultiplier: 0.9
  },
  {
    id: 2,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'มีเป้าลวงกับบอมบ์ แทรกมาบ่อยขึ้น',
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

// random helper
function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Core Engine Class ----------

class ShadowBreakerEngine {
  constructor(opts) {
    this.mode = opts.mode || 'normal'; // 'normal' | 'research'
    this.diffKey = opts.diffKey || 'normal';
    this.diffConf = DIFF_CONFIG[this.diffKey] || DIFF_CONFIG.normal;

    // เวลาเล่น: ถ้าในเมนูมี select ให้ จะ override ได้
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

    // ---- game state ----
    this.resetState();

    // bind renderer hit callback
    if (this.renderer) {
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

    this.phaseIndex = 0; // 0..3
    this.boss = BOSSES[this.phaseIndex];
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

    this.feverGauge = 0;  // 0–100
    this.feverOn = false;
    this.feverCount = 0;
    this.feverTimeMs = 0;
    this._feverLastTs = 0;

    this.lowHpTimeMs = 0;
    this._lastHpTs = 0;

    this.nextSpawnAt = 0;
    this.spawnSeq = 0;
    this.targets = new Map(); // id -> target

    // สำหรับ RT stats
    this.rtNormal = { n: 0, sum: 0, sumSq: 0 };
    this.rtDecoy = { n: 0, sum: 0, sumSq: 0 };

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
    this.nextSpawnAt = this.startPerf + 400; // delay นิดหน่อยก่อนเป้าแรก
    this._feverLastTs = this.startPerf;
    this._lastHpTs = this.startPerf;

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

    // low HP time
    if (this.playerHP <= 30) {
      this.lowHpTimeMs += dt;
    }

    // fever time
    if (this.feverOn) {
      this.feverTimeMs += ts - this._feverLastTs;
    }
    this._feverLastTs = ts;

    // FEVER decay / check
    this._updateFever(dt);

    // spawn
    if (ts >= this.nextSpawnAt) {
      this._spawnTarget(ts);
    }

    // check expire
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

    // เคลียร์เป้าทั้งหมด
    for (const id of this.targets.keys()) {
      this.renderer?.removeTarget(id, 'end');
    }
    this.targets.clear();

    // เตรียม session row
    const durationS = this.elapsedMs / 1000;
    const accuracy = this.totalTargets
      ? (this.totalHits / this.totalTargets) * 100
      : 0;

    const avgStd = (obj) => {
      if (!obj.n) return { avg: '', std: '' };
      const mean = obj.sum / obj.n;
      const varr = Math.max(0, obj.sumSq / obj.n - mean * mean);
      return { avg: mean, std: Math.sqrt(varr) };
    };
    const rtN = avgStd(this.rtNormal);
    const rtD = avgStd(this.rtDecoy);

    const grade = this._calcGrade(accuracy, this.score);

    const sessionRow = {
      session_id: this.sessionId,
      build_version: BUILD_VERSION,
      mode: this.mode,
      difficulty: this.diffKey,
      training_phase: `phase-${this.phaseIndex + 1}`,
      run_index: this.runIndex,
      start_ts: new Date(performance.timeOrigin + this.startPerf).toISOString(),
      end_ts: new Date().toISOString(),
      duration_s: +(durationS.toFixed(3)),
      end_reason: reason,
      final_score: this.score,
      grade,
      total_targets: this.totalTargets,
      total_hits: this.totalHits,
      total_miss: this.missCount,
      total_bombs_hit: this.totalBombHits,
      accuracy_pct: +(accuracy.toFixed(1)),
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
      env_input_mode: 'touch',
      error_count: this.errorCount,
      focus_events: this.focusEvents
    };

    this.sessionLogger?.add(sessionRow);

    if (this.hooks.onEnd) {
      this.hooks.onEnd({
        reason,
        grade,
        accuracy,
        ...sessionRow,
        score: this.score,
        combo: this.combo,
        missCount: this.missCount,
        phaseIndex: this.phaseIndex,
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

    // type weights
    const r = Math.random();
    let type = 'normal';
    if (r > 0.92) type = 'bomb';
    else if (r > 0.86) type = 'heal';
    else if (r > 0.78) type = 'shield';
    else if (r > 0.68 && this.phaseIndex >= 1) type = 'decoy';

    const sizeJitter = (Math.random() * 0.22 - 0.11); // ±11%
    let sizePx = diff.baseSizePx * (1 + sizeJitter);

    if (this.diffKey === 'hard') sizePx *= 0.9;
    if (type === 'bomb' || type === 'decoy') sizePx *= 0.9;

    const lifeMs = diff.targetLifetimeMs;

    const zoneLR = randChoice(['L', 'C', 'R']);
    const zoneUD = randChoice(['U', 'M', 'D']);

    const id = ++this.spawnSeq;
    const t = {
      id,
      boss_id: boss.id,
      boss_phase: this.phaseIndex + 1,
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
      phaseAtSpawn: this.phaseIndex + 1,
      phaseSpawnIndex: id, // simple
      x_norm: null,
      y_norm: null,
      zone_lr: zoneLR,
      zone_ud: zoneUD
    };

    this.targets.set(id, t);
    this.totalTargets++;

    this.renderer?.spawnTarget(t);

    // schedule next spawn
    const baseInterval = diff.spawnIntervalMs * boss.spawnMultiplier;
    let interval = baseInterval;

    if (this.feverOn) interval *= 0.7;
    if (this.diffKey === 'hard') interval *= 0.9;

    this.nextSpawnAt = now + interval;
  }

  _checkTimeouts(now) {
    const toRemove = [];
    for (const [id, t] of this.targets) {
      if (now >= t.expireTime) {
        toRemove.push(id);
        this._registerMiss(t, now);
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

    // FEVER extra
    if (this.feverOn && scoreDelta > 0) {
      this.score += Math.round(scoreDelta * 0.3);
    }

    // RT stats
    if (!t.isDecoy && !t.isBomb) {
      this._accRT(this.rtNormal, age);
    } else if (t.isDecoy) {
      this._accRT(this.rtDecoy, age);
    }

    // FEVER / FX — ใช้ตำแหน่งเป้าก่อนลบ DOM
    this.renderer?.playHitFx(t.id, {
      grade: grade === 'decoy' ? 'miss' : grade,
      scoreDelta,
      fxEmoji
    });

    // ลบจาก DOM + map ฝั่ง renderer
    this.renderer?.removeTarget(id, 'hit');

    // ลบจาก map ฝั่ง engine
    this.targets.delete(id);

    // event log row
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

    // phase clear?
    if (this.bossHP <= 0) {
      this._nextPhase();
    }
  }

  _registerMiss(t, now) {
    this.missCount++;
    this.combo = 0;

    // player HP down เล็กน้อยเมื่อ miss เป้า normal
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
    if (this.bossHP <= 0) {
      this.bossHP = 0;
    }
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
      // drain แบบช้า ๆ
      const drain = dt * 0.02; // 50 ms ต่อ 1 หน่วย ≈ 5 วินาที
      this.feverGauge = clamp(this.feverGauge - drain, 0, 100);
      if (this.feverGauge <= 0) {
        this.feverOn = false;
      }
    } else {
      // ค่อย ๆ ลดลงนิดหน่อยเวลาไม่ได้คอมโบ
      const decay = dt * 0.005;
      this.feverGauge = clamp(this.feverGauge - decay, 0, 100);
    }
  }

  _nextPhase() {
    this.bossesCleared++;
    if (this.phaseIndex < BOSSES.length - 1) {
      this.phaseIndex++;
      this.boss = BOSSES[this.phaseIndex];
      this.bossHP = this.boss.hp;
      this._updateBossHUD();
    } else {
      this._finish('all-boss-cleared');
    }
  }

  _accRT(store, rtMs) {
    store.n++;
    store.sum += rtMs;
    store.sumSq += rtMs * rtMs;
  }

  // ---------- HUD ----------

  _updateHUD() {
    const tSec = this.remainingMs / 1000;
    const timeTxt = tSec.toFixed(1);

    const hudTime = $('#stat-time') || $('#hud-time');
    if (hudTime) {
      hudTime.textContent = timeTxt;
    }

    const hudScore = $('#stat-score') || $('#hud-score');
    if (hudScore) hudScore.textContent = this.score;

    const hudCombo = $('#stat-combo') || $('#hud-combo');
    if (hudCombo) hudCombo.textContent = this.combo;

    const hudPhase = $('#stat-phase') || $('#hud-phase');
    if (hudPhase) hudPhase.textContent = this.phaseIndex + 1;

    // FEVER bar (ใช้ scaleX ตาม CSS)
    const feverFill = $('#fever-fill') || $('#fever-bar');
    if (feverFill) {
      const v = clamp(this.feverGauge, 0, 100) / 100;
      feverFill.style.transform = `scaleX(${v})`;
    }

    const feverStatus = $('#fever-status');
    if (feverStatus) {
      feverStatus.textContent = this.feverOn ? 'FEVER!!' : 'Ready';
      feverStatus.classList.toggle('on', this.feverOn);
    }

    // HP bars (ใช้ transform scaleX)
    const hpPlayerFill = $('#player-fill') || $('[data-sb-player-hp]');
    if (hpPlayerFill) {
      const v = clamp(this.playerHP, 0, 100) / 100;
      hpPlayerFill.style.transform = `scaleX(${v})`;
    }

    const hpBossFill = $('#boss-fill') || $('[data-sb-boss-hp]');
    if (hpBossFill) {
      const pct = this.boss.hp ? this.bossHP / this.boss.hp : 0;
      hpBossFill.style.transform = `scaleX(${clamp(pct, 0, 1)})`;
    }
  }

  _updateBossHUD() {
    const bossNameEl = $('#boss-portrait-name') || $('#boss-name');
    const bossDescEl = $('#boss-portrait-hint') || $('#boss-desc');
    const bossEmojiEl = $('#boss-portrait-emoji') || $('#boss-emoji');

    if (bossNameEl) bossNameEl.textContent = this.boss.name;
    if (bossDescEl) bossDescEl.textContent = this.boss.title;
    if (bossEmojiEl) bossEmojiEl.textContent = this.boss.emoji;
  }
}

// ---------- init + wiring with HTML ----------

export function initShadowBreaker() {
  const wrap = $('#sb-wrap') || document.body;
  const viewMenu     = $('#view-menu');
  const viewPlay     = $('#view-play');
  const viewResult   = '#view-result';          // ใช้ string + helper
  const viewResearch = $('#view-research-form');

  const targetLayer = $('#target-layer');
  const renderer = new DomRenderer(targetLayer || wrap, {});

  let currentEngine = null;
  let lastEvents = null;
  let lastSessions = null;

  function getViewResultEl() {
    return typeof viewResult === 'string' ? $(viewResult) : viewResult;
  }

  function showView(el) {
    const all = [viewMenu, viewPlay, getViewResultEl(), viewResearch];
    all.forEach(sec => {
      if (!sec) return;
      sec.classList.add('hidden');
      sec.classList.remove('fade-in');
    });
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('fade-in');
    }
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
      hooks: {
        onEnd: handleEnd
      }
    });

    // เก็บอ้างอิงกลับใน renderer เผื่อใช้ทีหลัง
    renderer.game = currentEngine;

    lastEvents = eventLogger;
    lastSessions = sessionLogger;

    showView(viewPlay);
    currentEngine.start();
  }

  function handleEnd(state) {
    const resView = getViewResultEl();
    if (resView) {
      const set = (sel, val) => {
        const el = typeof sel === 'string' ? $(sel) : sel;
        if (el) el.textContent = val;
      };
      set('#res-mode', state.mode === 'research' ? 'Research' : 'Normal');
      set('#res-diff', state.difficulty);
      set('#res-endreason', state.end_reason);
      set('#res-score', state.final_score);
      set('#res-grade', state.grade);
      set('#res-maxcombo', state.max_combo);
      set('#res-miss', state.total_miss);
      set('#res-accuracy',
        `${state.accuracy_pct.toFixed ? state.accuracy_pct.toFixed(1) : state.accuracy_pct}%`
      );
      set('#res-totalhits', state.total_hits);
      set('#res-rt-normal', state.avg_rt_normal_ms || '-');
      set('#res-rt-decoy', state.avg_rt_decoy_ms || '-');
      set('#res-participant', state.participant || '-');

      set('#res-fever-time', `${state.fever_total_time_s ?? 0}s`);
      set('#res-bosses', state.bosses_cleared ?? 0);
      set('#res-lowhp-time', `${state.low_hp_time_s ?? 0}s`);
      set('#res-menu-latency', `${state.menu_to_play_ms ?? 0} ms`);
    }
    showView(resView);
  }

  // ----- buttons wiring -----

  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');
  const btnResearchBegin = $('[data-action="research-begin-play"]');
  const btnStopEarly     = $('[data-action="stop-early"]');
  const btnBackToMenu    = $$('[data-action="back-to-menu"]');
  const btnPlayAgain     = $('[data-action="play-again"]');
  const btnDLSession     = $('[data-action="download-csv-session"]');
  const btnDLEvents      = $('[data-action="download-csv-events"]');

  if (btnStartNormal) {
    btnStartNormal.addEventListener('click', () => {
      startGame('normal');
    });
  }

  if (btnStartResearch && viewResearch) {
    btnStartResearch.addEventListener('click', () => {
      showView(viewResearch);
    });
  }

  if (btnResearchBegin) {
    btnResearchBegin.addEventListener('click', () => {
      startGame('research');
    });
  }

  if (btnStopEarly) {
    btnStopEarly.addEventListener('click', () => {
      currentEngine?.stop('manual-stop');
    });
  }

  if (btnBackToMenu && btnBackToMenu.length) {
    btnBackToMenu.forEach(b =>
      b.addEventListener('click', () => {
        currentEngine = null;
        showView(viewMenu);
      })
    );
  }

  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      const lastMode = currentEngine?.mode || 'normal';
      startGame(lastMode);
    });
  }

  if (btnDLSession) {
    btnDLSession.addEventListener('click', () => {
      const csv = lastSessions?.toCsv();
      downloadCSV('shadow-breaker-session.csv', csv);
    });
  }

  if (btnDLEvents) {
    btnDLEvents.addEventListener('click', () => {
      const csv = lastEvents?.toCsv();
      downloadCSV('shadow-breaker-events.csv', csv);
    });
  }

  // ---------- initial view ----------

  window.__SB_MENU_OPEN_TS = performance.now();
  if (viewMenu) showView(viewMenu);
}