// === js/engine.js — Shadow Breaker Engine + Flow (UX + Research v2025-11-30) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { recordSession } from './stats-store.js';

// เปลี่ยนเลขเวอร์ชันทุกครั้งที่แก้ logic ใหญ่ ๆ
const BUILD_VERSION = 'sb-2025-11-30-ux-research';

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));

// ---------- CONFIG ----------

const DIFF_CONFIG = {
  easy: {
    label: 'Easy',
    timeSec: 60,
    spawnMs:    [950, 850, 750],
    lifeMs:     [2300, 2100, 1900],
    maxActive:  [3, 4, 5],
    baseSizePx: 120
  },
  normal: {
    label: 'Normal',
    timeSec: 60,
    spawnMs:    [880, 780, 680],
    lifeMs:     [2100, 1900, 1700],
    maxActive:  [4, 5, 6],
    baseSizePx: 105
  },
  hard: {
    label: 'Hard',
    timeSec: 60,
    spawnMs:    [820, 720, 620],
    lifeMs:     [1950, 1750, 1550],
    maxActive:  [5, 6, 7],
    baseSizePx: 92
  }
};

const PHASE_SIZE_FACTOR = {
  1: 1.15,  // phase แรก เป้าใหญ่สุด
  2: 1.00,
  3: 0.85   // phase ท้าย เป้าเล็กสุด
};

const BOSSES = [
  {
    id: 0,
    key: 'bubble',
    name: 'Bubble Glove',
    emoji: '🐣',
    hpMax: 90,
    introTitle: 'มือใหม่สายฟอง',
    introDesc: 'เป้าใหญ่ หน่วงเวลาเล็กน้อย เหมาะสำหรับวอร์มอัพ 🔰',
    hint: 'โฟกัสที่เป้าฟองใหญ่ ๆ แล้วตีให้ทัน'
  },
  {
    id: 1,
    key: 'neon',
    name: 'Neon Knuckle',
    emoji: '🌀',
    hpMax: 110,
    introTitle: 'หมัดไฟนีออน',
    introDesc: 'เป้าเล็กลงและเร็วขึ้น ต้องจับจังหวะให้ดี 💡',
    hint: 'เป้าเร็วขึ้น ลองมองล่วงหน้า 1 เป้าก่อนชก'
  },
  {
    id: 2,
    key: 'guard',
    name: 'Shadow Guard',
    emoji: '🤖',
    hpMax: 130,
    introTitle: 'ผู้พิทักษ์เงา',
    introDesc: 'มีเป้าลวงและบอมบ์ปนมา ฝึกสมาธิและการตัดสินใจ 🧠',
    hint: 'สังเกตสีขอบ/เอฟเฟกต์ เป้าลวงจะดูแปลกกว่าปกติ'
  },
  {
    id: 3,
    key: 'final',
    name: 'Final Burst',
    emoji: '💀',
    hpMax: 150,
    introTitle: 'บอสสุดท้ายสายระเบิด',
    introDesc: 'โหมดโหดสุด เน้นคอมโบต่อเนื่องและความอึด 💪',
    hint: 'ถ้าคอมโบไม่หลุด คะแนนจะพุ่งแรงมาก ระวังบอมบ์!'
  }
];

function hpRatioToPhase(ratio) {
  if (ratio <= 0.33) return 3;
  if (ratio <= 0.66) return 2;
  return 1;
}

// ---------- helper: สถิติ RT ----------

function mean(arr) {
  if (!arr || !arr.length) return null;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function stddev(arr, m) {
  if (!arr || arr.length < 2 || m == null) return null;
  let s2 = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    s2 += d * d;
  }
  // ใช้ population sd ก็พอสำหรับ summary
  return Math.sqrt(s2 / arr.length);
}

// ---------- ENGINE CLASS ----------

class ShadowBreakerEngine {
  constructor(opts = {}) {
    this.wrap  = opts.wrap  || $('#sb-wrap') || document.body;
    this.field = opts.field || $('#target-layer') || this.wrap;

    this.mode    = 'normal';
    this.diffKey = 'normal';
    this.diff    = DIFF_CONFIG.normal;

    this.renderer = new DomRenderer(this.field, {
      onTargetHit: (id, info) => this.handleHit(id, info)
    });

    this.eventLogger   = new EventLogger();
    this.sessionLogger = new SessionLogger();
    this.hooks = opts.hooks || {};

    this.introEl       = $('#bossIntro');
    this.introEmojiEl  = $('#boss-intro-emoji');
    this.introNameEl   = $('#boss-intro-name');
    this.introTitleEl  = $('#boss-intro-title');
    this.introDescEl   = $('#boss-intro-desc');

    this.hud = {
      time:  $('#stat-time'),
      score: $('#stat-score'),
      combo: $('#stat-combo'),
      phase: $('#stat-phase'),
      miss:  $('#stat-miss') || null,

      hpPlayerBar: $('[data-sb-player-hp]'),
      hpBossBar:   $('[data-sb-boss-hp]'),

      feverFill:   $('#fever-fill'),
      feverStatus: $('#fever-status'),
      feedback:    $('#sb-feedback'),

      bossEmoji:   $('#boss-portrait-emoji'),
      bossName:    $('#boss-portrait-name'),
      bossHint:    $('#boss-portrait-hint'),

      shield:      $('#stat-shield') || $('#stat-shield-left') || null
    };

    this._loopBound = (ts) => this._loop(ts);
    this._introTapHandler = (ev) => {
      ev.preventDefault();
      if (this.waitingIntro) {
        this._hideIntroAndResume();
      }
    };

    if (this.introEl) {
      this.introEl.addEventListener('click', this._introTapHandler);
      this.introEl.addEventListener('touchstart', this._introTapHandler, { passive: false });
    }

    this._resetStatic();
  }

  _resetStatic() {
    this.sessionCounter = 0;
    this.menuOpenedAt = performance.now();
  }

  // random seed เพื่อ reproducible pattern
  _rand() {
    // LCG ง่าย ๆ
    this._rngState = (this._rngState * 1664525 + 1013904223) >>> 0;
    return this._rngState / 4294967296;
  }

  // log event → CSV
  _logEvent(extra = {}) {
    if (!this.eventLogger) return;
    this.eventLogger.add({
      participant: this.participant,
      group: this.group,
      note: this.note,
      session_id: this.sessionId,
      run_index: this.runIndex,
      mode: this.mode,
      diff: this.diffKey,
      diff_label: this.diff?.label || this.diffKey,
      boss_id: this.currentBoss?.id,
      boss_index: this.bossIndex,
      boss_phase: this.bossPhase,
      ts: new Date().toISOString(),
      ...extra
    });
  }

  // ---------- START ----------

  start(mode, diffKey, timeSec, participantMeta = {}) {
    this.mode    = mode || 'normal';
    this.diffKey = DIFF_CONFIG[diffKey] ? diffKey : 'normal';
    this.diff    = DIFF_CONFIG[this.diffKey];

    this.timeLimitMs = (timeSec || this.diff.timeSec) * 1000;

    this.sessionCounter += 1;
    this.sessionId = `SB-${Date.now()}-${this.sessionCounter}`;
    this.runIndex  = this.sessionCounter;

    this.participant = participantMeta.id    || (this.mode === 'research' ? '' : `NORMAL-${this.runIndex}`);
    this.group       = participantMeta.group || '';
    this.note        = participantMeta.note  || '';

    // random seed สำหรับรอบนี้
    this.rngSeed  = Math.floor(Math.random() * 1_000_000_000);
    this._rngState = this.rngSeed || 1;

    this.playerHpMax = 100;
    this.playerHp    = this.playerHpMax;

    this.bossIndex   = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax   = this.currentBoss.hpMax;
    this.bossHp      = this.bossHpMax;
    this.bossPhase   = 1;
    this.bossesCleared = 0;

    this.score     = 0;
    this.combo     = 0;
    this.maxCombo  = 0;
    this.missCount = 0;

    this.totalTargets   = 0;
    this.totalHits      = 0;
    this.totalBombHits  = 0;

    // FEVER / HP time
    this.feverGauge     = 0;
    this.feverOn        = false;
    this.feverCount     = 0;
    this.feverTimeMs    = 0;
    this.lowHpTimeMs    = 0;

    // RT arrays สำหรับวิจัย
    this.rtNormal = [];  // วินาที
    this.rtDecoy  = [];

    // zone hit counter
    this.zoneHitLeft   = 0;
    this.zoneHitCenter = 0;
    this.zoneHitRight  = 0;
    this.zoneHitTotal  = 0;

    // shield counter
    this.shieldCollected = 0;

    this.targets   = new Map();
    this.spawnSeq  = 0;

    this.elapsedMs   = 0;
    this.remainingMs = this.timeLimitMs;

    this.startedAt   = null;
    this.lastTs      = null;
    this.nextSpawnAt = null;
    this.paused      = true;
    this.ended       = false;
    this.loopRunning = false;

    this.waitingIntro  = true;
    this.bossFaceAlive = false;

    this.eventLogger.clear();
    this.sessionLogger.clear();

    if (this.field) this.field.innerHTML = '';

    this._updateBossHUD();
    this._updateHUD();
    this._updateWrapTheme();

    // reset ข้อความโค้ชให้กำลังใจตอนเริ่ม
    if (this.hud.feedback) {
      this.hud.feedback.textContent =
        'ตีเป้าให้ทัน ลองดูว่าคอมโบจะยาวได้กี่ครั้ง 🔥';
      this.hud.feedback.className = 'sb-feedback';
    }

    this._showBossIntro(this.currentBoss, true);

    if (!this.loopRunning) {
      this.loopRunning = true;
      this.rafId = requestAnimationFrame(this._loopBound);
    }
  }

  markMenuOpened() {
    this.menuOpenedAt = performance.now();
  }

  _hideIntroAndResume() {
    this.waitingIntro = false;
    this.paused = false;
    if (this.introEl) this.introEl.classList.add('hidden');

    const now = performance.now();
    if (!this.startedAt) {
      this.startedAt = now;
      this.lastTs    = now;
      this.nextSpawnAt = now + 400;
      this.elapsedMs   = 0;
      this.remainingMs = this.timeLimitMs;
      this.menuToPlayMs = now - this.menuOpenedAt;
    } else {
      this.lastTs = now;
    }
  }

  _showBossIntro(boss, isFirst = false) {
    if (!this.introEl) return;

    this.waitingIntro = true;
    this.paused = true;

    this.introEmojiEl && (this.introEmojiEl.textContent = boss.emoji);
    this.introNameEl  && (this.introNameEl.textContent  = boss.name);
    if (this.introTitleEl) {
      this.introTitleEl.textContent = isFirst
        ? 'เริ่มต่อสู้กับบอสตัวแรก!'
        : 'บอสตัวถัดไปกำลังมา!';
    }
    if (this.introDescEl) {
      this.introDescEl.textContent = boss.introDesc;
    }

    this.introEl.classList.remove('hidden');

    if (window.SFX && typeof window.SFX.play === 'function') {
      window.SFX.play('boss', { group: 'boss', baseVolume: 0.9, intensity: 1.0, minGap: 500 });
    }
  }

  // ---------- MAIN LOOP ----------

  _loop(ts) {
    if (!this.loopRunning) return;

    if (this.ended) {
      this.loopRunning = false;
      return;
    }

    if (this.paused || this.waitingIntro) {
      this.lastTs = ts;
      this.rafId = requestAnimationFrame(this._loopBound);
      return;
    }

    if (!this.lastTs) {
      this.lastTs = ts;
    }

    const dt = ts - this.lastTs;
    this.lastTs = ts;

    this.elapsedMs   += dt;
    this.remainingMs = Math.max(0, this.timeLimitMs - this.elapsedMs);

    if (this.feverOn) {
      this.feverTimeMs += dt;
      this.feverGauge = clamp(this.feverGauge - dt * 0.03, 0, 100);
      if (this.feverGauge <= 0) {
        this.feverOn = false;
      }
    } else {
      this.feverGauge = clamp(this.feverGauge - dt * 0.01, 0, 100);
    }

    if (this.playerHp <= 30) {
      this.lowHpTimeMs += dt;
    }

    if (!this.nextSpawnAt) {
      this.nextSpawnAt = ts + 400;
    }
    if (ts >= this.nextSpawnAt) {
      this._spawnTarget(ts);
    }

    if (this.remainingMs <= 0) {
      this._finish('time-up');
      return;
    }

    this._checkTimeouts(ts);

    if (this.playerHp <= 0) {
      this._finish('player-down');
      return;
    }

    this._updateHUD();
    this.rafId = requestAnimationFrame(this._loopBound);
  }

  // ---------- SPAWN / MISS ----------

  _spawnTarget(now) {
    if (!this.field) return;

    const phaseIdx = this.bossPhase - 1;
    const diff = this.diff;

    const maxActive = diff.maxActive[phaseIdx] || diff.maxActive[1];
    if (this.targets.size >= maxActive) {
      this.nextSpawnAt = now + 120;
      return;
    }

    let r = this._rand();
    let type = 'normal';

    if (!this.bossFaceAlive &&
        (this.bossHp / this.bossHpMax) <= 0.28 &&
        r > 0.65) {
      type = 'bossface';
      this.bossFaceAlive = true;
    } else if (r > 0.94) {
      type = 'bomb';
    } else if (r > 0.86) {
      type = 'heal';
    } else if (r > 0.78) {
      type = 'shield';
    } else if (r > 0.68 && this.bossIndex >= 1) {
      type = 'decoy';
    }

    const id = ++this.spawnSeq;

    const sizeBase = diff.baseSizePx * (PHASE_SIZE_FACTOR[this.bossPhase] || 1.0);
    let sizePx = sizeBase;
    if (type === 'bomb' || type === 'decoy') sizePx *= 0.9;
    if (type === 'bossface') sizePx *= 1.25;

    const lifeMs  = diff.lifeMs[phaseIdx]  || diff.lifeMs[1];
    const spawnMs = diff.spawnMs[phaseIdx] || diff.spawnMs[1];

    const zoneLR = ['L','C','R'][Math.floor(this._rand() * 3)];
    const zoneUD = ['U','M','D'][Math.floor(this._rand() * 3)];

    const target = {
      id,
      bossId: this.currentBoss.id,
      bossIndex: this.bossIndex,
      bossPhase: this.bossPhase,
      diffKey: this.diffKey,
      type,
      isDecoy:    type === 'decoy',
      isBomb:     type === 'bomb',
      isHeal:     type === 'heal',
      isShield:   type === 'shield',
      isBossFace: type === 'bossface',
      sizePx: Math.round(sizePx),
      lifeMs,
      spawnTime: now,
      expireTime: now + lifeMs,
      x_norm: null,
      y_norm: null,
      zone_lr: zoneLR,
      zone_ud: zoneUD,
      phaseAtSpawn: this.bossPhase,
      phaseSpawnIndex: id
    };

    this.targets.set(id, target);
    this.totalTargets += 1;

    this.renderer.setDifficulty?.(this.diffKey);
    this.renderer.spawnTarget(target);

    this._logEvent({
      event_type: 'spawn',
      target_id: id,
      target_type: type,
      life_ms: lifeMs,
      spawn_interval_ms: spawnMs,
      target_size_px: target.sizePx,
      phase_at_spawn: target.phaseAtSpawn,
      phase_spawn_index: target.phaseSpawnIndex,
      zone_lr: zoneLR,
      zone_ud: zoneUD,
      fever_on: this.feverOn ? 1 : 0,
      player_hp: this.playerHp,
      boss_hp: this.bossHp
    });

    let interval = spawnMs;
    if (this.feverOn) interval *= 0.7;
    if (this.diffKey === 'hard') interval *= 0.9;
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
      this.renderer.removeTarget(id, 'timeout');
      this.targets.delete(id);
    }
  }

  _registerMiss(t) {
    // นับ miss เฉพาะเป้าปกติ (ไม่ใช่ decoy / heal / shield / bossface)
    if (!t.isDecoy && !t.isBomb && !t.isBossFace && !t.isHeal && !t.isShield) {
      this.missCount += 1;
      this.combo = 0;
      this.playerHp = clamp(this.playerHp - 4, 0, this.playerHpMax);

      if (this.hud.feedback) {
        this.hud.feedback.textContent = 'พลาดจังหวะ! ลองมองเป้าถัดไปล่วงหน้า 🔍';
        this.hud.feedback.className = 'sb-feedback miss';
      }
    }

    if (t.isBossFace) {
      this.bossFaceAlive = false;
    }

    this._logEvent({
      event_type: 'timeout',
      target_id: t.id,
      target_type: t.type,
      is_decoy: !!t.isDecoy,
      is_bossface: !!t.isBossFace,
      is_bomb: !!t.isBomb,
      grade: 'miss',
      age_ms: t.lifeMs,
      player_hp_after: this.playerHp,
      boss_hp_after: this.bossHp
    });

    this._updateHUD();
  }

  // ---------- HIT ----------

  _recordRtSample(target, rtSec) {
    if (rtSec == null) return;
    if (target.isDecoy) {
      this.rtDecoy.push(rtSec);
    } else if (!target.isBomb && !target.isHeal && !target.isShield && !target.isBossFace) {
      this.rtNormal.push(rtSec);
    }
  }

  _bumpZoneHit(target) {
    if (!target || !target.zone_lr) return;
    if (target.isBomb || target.isHeal || target.isShield) return; // นับเฉพาะเป้าปกติ/decoy/bossface ตามดีไซน์ก็ได้

    this.zoneHitTotal += 1;
    if (target.zone_lr === 'L') this.zoneHitLeft += 1;
    else if (target.zone_lr === 'R') this.zoneHitRight += 1;
    else this.zoneHitCenter += 1;
  }

  handleHit(id, hitInfo) {
    const t = this.targets.get(id);
    if (!t || this.ended) return;

    const now = performance.now();
    const age = now - t.spawnTime;
    const ratio = clamp(age / t.lifeMs, 0, 1);
    const rtSec = age / 1000;

    // เก็บ RT ไว้ใช้คำนวณ mean/sd
    this._recordRtSample(t, rtSec);
    this._bumpZoneHit(t);

    let grade = 'good';
    let scoreDelta = 0;
    let fxEmoji = '✨';

    const comboBefore = this.combo;
    const hpBefore    = this.playerHp;
    const feverBefore = this.feverGauge;

    if (t.isBomb) {
      grade = 'bomb';
      this.combo = 0;
      this.totalBombHits += 1;
      this._hitByBomb();
      scoreDelta = 0;
      fxEmoji = '💣';
    } else if (t.isDecoy) {
      grade = 'miss';
      this.combo = 0;
      scoreDelta = 0;
      fxEmoji = '🎯';
    } else if (t.isHeal) {
      grade = 'heal';
      this.combo += 1;
      scoreDelta = 50;
      this.score += scoreDelta;
      this.playerHp = clamp(this.playerHp + 10, 0, this.playerHpMax);
      fxEmoji = '💚';
      this._gainFever(4);
    } else if (t.isShield) {
      grade = 'shield';
      this.combo += 1;
      scoreDelta = 40;
      this.score += scoreDelta;
      fxEmoji = '🛡️';
      this._gainFever(3);
      this.shieldCollected += 1;
    } else if (t.isBossFace) {
      grade = 'perfect';
      scoreDelta = 220;
      this.score += scoreDelta;
      this.combo += 2;
      fxEmoji = '💥';
      this._gainFever(10);
      this._damageBoss(15);
      this.bossFaceAlive = false;
    } else {
      if (ratio <= 0.35) grade = 'perfect';
      else if (ratio >= 0.9) grade = 'bad';
      else grade = 'good';

      if (grade === 'perfect') {
        scoreDelta = 140;
        this._damageBoss(3);
        fxEmoji = '💥';
        this._gainFever(9);
      } else if (grade === 'good') {
        scoreDelta = 95;
        this._damageBoss(2);
        fxEmoji = '⭐';
        this._gainFever(6);
      } else {
        scoreDelta = 45;
        this._damageBoss(1);
        fxEmoji = '💫';
        this._gainFever(3);
      }

      this.score += scoreDelta;
      this.combo += 1;
      this.totalHits += 1;
    }

    if (this.feverOn && scoreDelta > 0) {
      const bonus = Math.round(scoreDelta * 0.3);
      this.score += bonus;
    }

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    if (this.hud.feedback) {
      let msg = '';
      let cls = 'sb-feedback';
      if (grade === 'perfect') {
        msg = 'สุดยอด! PERFECT 🎯';
        cls += ' perfect';
      } else if (grade === 'good') {
        msg = 'ดีมาก! คอมโบต่อเนื่องไปเลย 💪';
        cls += ' good';
      } else if (grade === 'bad') {
        msg = 'ช้าไปนิด ลองตีให้เร็วกว่านี้หน่อยนะ 😅';
        cls += ' bad';
      } else if (grade === 'bomb') {
        msg = 'ระเบิด! HP ลด ระวังหน่อย 💣';
        cls += ' miss';
      } else if (grade === 'heal') {
        msg = 'เติมพลัง! ❤️‍🩹';
        cls += ' good';
      } else if (grade === 'shield') {
        msg = 'เกราะพร้อม! 🛡️';
        cls += ' good';
      } else {
        msg = 'เป้าลวง! อย่าหลงกลง่าย ๆ 😈';
        cls += ' miss';
      }
      this.hud.feedback.textContent = msg;
      this.hud.feedback.className = cls;
    }

    this.renderer.playHitFx(t.id, {
      grade,
      scoreDelta,
      fxEmoji,
      clientX: hitInfo?.clientX,
      clientY: hitInfo?.clientY
    });

    this.targets.delete(id);
    this.renderer.removeTarget(id, 'hit');

    this._logEvent({
      event_type: 'hit',
      target_id: t.id,
      target_type: t.type,
      grade,
      age_ms: Math.round(age),
      score_delta: scoreDelta,
      combo_before: comboBefore,
      combo_after: this.combo,
      player_hp_before: hpBefore,
      player_hp_after: this.playerHp,
      fever_before: feverBefore,
      fever_after: this.feverGauge,
      fever_on: this.feverOn ? 1 : 0,
      x_norm: t.x_norm,
      y_norm: t.y_norm,
      zone_lr: t.zone_lr,
      zone_ud: t.zone_ud,
      screen_x: hitInfo?.clientX ?? null,
      screen_y: hitInfo?.clientY ?? null,
      rt_s: +rtSec.toFixed(3)
    });

    if (this.playerHp <= 0) {
      this._finish('bomb-ko');
      return;
    }

    this._updateHUD();
    this._updateBossHUD();
  }

  _hitByBomb() {
    this.playerHp = clamp(this.playerHp - 18, 0, this.playerHpMax);
  }

  _gainFever(amount) {
    this.feverGauge = clamp(this.feverGauge + amount, 0, 100);
    if (!this.feverOn && this.feverGauge >= 100) {
      this.feverOn = true;
      this.feverCount += 1;
      if (this.hud.feedback) {
        this.hud.feedback.textContent = 'FEVER MODE! คะแนนพุ่ง ⚡';
        this.hud.feedback.className = 'sb-feedback perfect';
      }
      if (window.SFX?.play) {
        window.SFX.play('fever', { group: 'fever', baseVolume: 1, intensity: 1, minGap: 500 });
      }
    }
  }

  // ---------- BOSS / PHASE ----------

  _damageBoss(amount) {
    this.bossHp = clamp(this.bossHp - amount, 0, this.bossHpMax);

    const ratio = this.bossHpMax > 0 ? this.bossHp / this.bossHpMax : 0;
    const newPhase = hpRatioToPhase(ratio);
    const phaseChanged = newPhase !== this.bossPhase;
    this.bossPhase = newPhase;

    if (phaseChanged) {
      this._updateWrapTheme();
      if (this.wrap) {
        this.wrap.classList.add('sb-wrap-shake');
        setTimeout(() => this.wrap && this.wrap.classList.remove('sb-wrap-shake'), 260);
      }
    }

    if (ratio <= 0.33) {
      $('#boss-portrait')?.classList.add('sb-shake');
    } else {
      $('#boss-portrait')?.classList.remove('sb-shake');
    }

    if (this.bossHp <= 0) {
      this._onBossCleared();
    }
  }

  _onBossCleared() {
    this.bossesCleared += 1;

    const rewardScore = 500;
    this.score += rewardScore;
    if (this.hud.feedback) {
      this.hud.feedback.textContent =
        `🎉 ชนะ ${this.currentBoss.name}! โบนัส +${rewardScore} คะแนน`;
      this.hud.feedback.className = 'sb-feedback perfect';
    }

    if (this.bossIndex < BOSSES.length - 1) {
      this.bossIndex += 1;
      this.currentBoss = BOSSES[this.bossIndex];
      this.bossHpMax = this.currentBoss.hpMax;
      this.bossHp    = this.bossHpMax;
      this.bossPhase = 1;
      this.bossFaceAlive = false;

      for (const [id] of this.targets) {
        this.renderer.removeTarget(id, 'boss-change');
      }
      this.targets.clear();

      this._updateBossHUD();
      this._updateWrapTheme();
      this._showBossIntro(this.currentBoss, false);
    } else {
      this._finish('all-boss-cleared');
    }
  }

  _updateWrapTheme() {
    if (!this.wrap) return;
    this.wrap.dataset.diff  = this.diffKey;
    this.wrap.dataset.boss  = String(this.bossIndex);
    this.wrap.dataset.phase = String(this.bossPhase);
  }

  // ---------- HUD & RESULT ----------

  _updateHUD() {
    if (this.hud.time) {
      const sec = this.remainingMs / 1000;
      this.hud.time.textContent = sec.toFixed(1);
    }
    this.hud.score && (this.hud.score.textContent = this.score);
    this.hud.combo && (this.hud.combo.textContent = this.combo);
    // แสดง boss ลำดับที่กำลังสู้ (1–4)
    this.hud.phase && (this.hud.phase.textContent = this.bossIndex + 1);

    const pRatio = clamp(this.playerHp / this.playerHpMax, 0, 1);
    const bRatio = clamp(this.bossHp   / this.bossHpMax,   0, 1);

    if (this.hud.hpPlayerBar) {
      this.hud.hpPlayerBar.style.width = (pRatio * 100) + '%';
      this.hud.hpPlayerBar.style.display = 'block';
    }
    if (this.hud.hpBossBar) {
      this.hud.hpBossBar.style.width = (bRatio * 100) + '%';
      this.hud.hpBossBar.style.display = 'block';
    }

    const fv = clamp(this.feverGauge, 0, 100) / 100;
    if (this.hud.feverFill) {
      this.hud.feverFill.style.transform = `scaleX(${fv})`;
    }
    if (this.hud.feverStatus) {
      this.hud.feverStatus.textContent = this.feverOn ? 'FEVER!!' : 'Ready';
      this.hud.feverStatus.classList.toggle('on', this.feverOn);
    }

    if (this.hud.miss) {
      this.hud.miss.textContent = String(this.missCount);
    }

    if (this.hud.shield) {
      this.hud.shield.textContent = String(this.shieldCollected);
    }
  }

  _updateBossHUD() {
    if (!this.currentBoss) return;
    this.hud.bossEmoji && (this.hud.bossEmoji.textContent = this.currentBoss.emoji);
    this.hud.bossName  && (this.hud.bossName.textContent  = this.currentBoss.name);
    this.hud.bossHint  && (this.hud.bossHint.textContent  = this.currentBoss.hint);
  }

  _computeGrade(accPct, score) {
    // mapping ใหม่: SSS, SS, S, A, B, C
    if (accPct >= 92 && score >= 4500) return 'SSS';
    if (accPct >= 88 && score >= 4000) return 'SS';
    if (accPct >= 80 && score >= 3200) return 'S';
    if (accPct >= 70) return 'A';
    if (accPct >= 60) return 'B';
    return 'C';
  }

  _finish(reason) {
    if (this.ended) return;
    this.ended = true;
    this.paused = true;

    for (const [id] of this.targets) {
      this.renderer.removeTarget(id, 'end');
    }
    this.targets.clear();

    const durationS = this.elapsedMs / 1000;
    const accPct = this.totalTargets ? (this.totalHits / this.totalTargets) * 100 : 0;

    const grade = this._computeGrade(accPct, this.score);

    // สถิติ RT
    const rtNormMean = mean(this.rtNormal);
    const rtNormSd   = stddev(this.rtNormal, rtNormMean);
    const rtDecoyMean = mean(this.rtDecoy);
    const rtDecoySd   = stddev(this.rtDecoy, rtDecoyMean);

    // zone hit %
    let leftPct = 0, rightPct = 0, centerPct = 0;
    if (this.zoneHitTotal > 0) {
      leftPct   = (this.zoneHitLeft   / this.zoneHitTotal) * 100;
      rightPct  = (this.zoneHitRight  / this.zoneHitTotal) * 100;
      centerPct = (this.zoneHitCenter / this.zoneHitTotal) * 100;
    }

    const sessionRow = {
      session_id: this.sessionId,
      build_version: BUILD_VERSION,
      mode: this.mode,
      difficulty: this.diffKey,
      training_phase: `boss-${this.bossIndex + 1}`,
      run_index: this.runIndex,
      start_ts: this.startedAt
        ? new Date(performance.timeOrigin + this.startedAt).toISOString()
        : new Date().toISOString(),
      end_ts: new Date().toISOString(),
      duration_s: +durationS.toFixed(3),
      end_reason: reason,
      final_score: this.score,
      grade,
      total_targets: this.totalTargets,
      total_hits: this.totalHits,
      total_miss: this.missCount,
      total_bombs_hit: this.totalBombHits,
      accuracy_pct: +accPct.toFixed(1),
      max_combo: this.maxCombo,
      fever_count: this.feverCount,
      fever_total_time_s: +(this.feverTimeMs / 1000).toFixed(2),
      low_hp_time_s: +(this.lowHpTimeMs / 1000).toFixed(2),
      bosses_cleared: this.bossesCleared,
      menu_to_play_ms: this.menuToPlayMs ? Math.round(this.menuToPlayMs) : '',
      participant: this.participant,
      group: this.group,
      note: this.note,
      env_ua: navigator.userAgent || '',
      env_viewport_w: window.innerWidth,
      env_viewport_h: window.innerHeight,
      env_input_mode: ('ontouchstart' in window) ? 'touch' : 'mouse',
      error_count: 0,
      focus_events: 0,

      // เพิ่ม random seed
      rng_seed: this.rngSeed,

      // RT สรุป
      rt_normal_mean_s: rtNormMean != null ? +rtNormMean.toFixed(4) : '',
      rt_normal_sd_s:   rtNormSd   != null ? +rtNormSd.toFixed(4)   : '',
      rt_decoy_mean_s:  rtDecoyMean!= null ? +rtDecoyMean.toFixed(4): '',
      rt_decoy_sd_s:    rtDecoySd  != null ? +rtDecoySd.toFixed(4)  : '',

      // zone hit
      zone_left_hit_count:   this.zoneHitLeft,
      zone_center_hit_count: this.zoneHitCenter,
      zone_right_hit_count:  this.zoneHitRight,
      zone_total_hit_count:  this.zoneHitTotal,
      zone_left_hit_pct:   +leftPct.toFixed(1),
      zone_center_hit_pct: +centerPct.toFixed(1),
      zone_right_hit_pct:  +rightPct.toFixed(1),

      // shield summary
      shield_collected: this.shieldCollected
    };

    this.sessionLogger.add(sessionRow);

    const result = {
      ...sessionRow,
      accuracy: accPct,
      score: this.score,
      missCount: this.missCount,
      bossesCleared: this.bossesCleared,
      eventsCsv: this.eventLogger.toCsv(),
      sessionCsv: this.sessionLogger.toCsv()
    };

    if (this.hooks.onEnd) {
      this.hooks.onEnd(result);
    }

    // บันทึก summary เบื้องต้นลง stats-store (สำหรับ Hub)
    try {
      recordSession('shadow-breaker', {
        score: result.final_score,
        grade: result.grade,
        accuracy: result.accuracy_pct,
        duration_s: result.duration_s,
        bosses_cleared: result.bosses_cleared,
        mode: result.mode,
        difficulty: result.difficulty
      });
    } catch (e) {
      console.warn('recordSession failed', e);
    }
  }
}

// ---------- BOOTSTRAP ----------

export function initShadowBreaker() {
  const wrap   = $('#sb-wrap') || document.body;
  const field  = $('#target-layer') || wrap;
  const viewMenu     = $('#view-menu');
  const viewPlay     = $('#view-play');
  const viewResult   = $('#view-result');
  const viewResearch = $('#view-research-form');

  let lastMode = 'normal';

  function showView(which) {
    [viewMenu, viewPlay, viewResult, viewResearch].forEach(el => {
      if (!el) return;
      el.classList.add('hidden');
    });
    if (which === 'menu'    && viewMenu)    viewMenu.classList.remove('hidden');
    if (which === 'play'    && viewPlay)    viewPlay.classList.remove('hidden');
    if (which === 'result'  && viewResult)  viewResult.classList.remove('hidden');
    if (which === 'research'&& viewResearch)viewResearch.classList.remove('hidden');
  }

  const engine = new ShadowBreakerEngine({
    wrap,
    field,
    hooks: {
      onEnd: (summary) => {
        const setText = (sel, val) => {
          const el = typeof sel === 'string' ? $(sel) : sel;
          if (el && val != null) el.textContent = String(val);
        };

        setText('#res-mode', summary.mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ');
        setText('#res-diff', summary.difficulty || '-');
        setText('#res-endreason', summary.end_reason || '-');
        setText('#res-score', summary.final_score ?? 0);
        setText('#res-grade', summary.grade || '-');
        setText('#res-maxcombo', summary.max_combo ?? 0);
        setText('#res-miss', summary.total_miss ?? 0);
        setText('#res-accuracy', (summary.accuracy_pct ?? 0) + '%');
        setText('#res-totalhits', summary.total_hits ?? 0);

        // RT mean แสดงบนหน้า result ถ้ามี element
        const rtNorm = summary.rt_normal_mean_s;
        const rtDecoy = summary.rt_decoy_mean_s;
        if ($('#res-rt-normal')) {
          $('#res-rt-normal').textContent =
            (rtNorm != null && rtNorm !== '')
              ? rtNorm.toFixed ? rtNorm.toFixed(3) + ' s' : Number(rtNorm).toFixed(3) + ' s'
              : '-';
        }
        if ($('#res-rt-decoy')) {
          $('#res-rt-decoy').textContent =
            (rtDecoy != null && rtDecoy !== '')
              ? rtDecoy.toFixed ? rtDecoy.toFixed(3) + ' s' : Number(rtDecoy).toFixed(3) + ' s'
              : '-';
        }

        setText('#res-fever-time',
          typeof summary.fever_total_time_s === 'number'
            ? summary.fever_total_time_s.toFixed(2) + ' s'
            : (summary.fever_total_time_s || 0) + ' s');

        setText('#res-bosses', summary.bosses_cleared ?? 0);

        setText('#res-lowhp-time',
          typeof summary.low_hp_time_s === 'number'
            ? summary.low_hp_time_s.toFixed(2) + ' s'
            : (summary.low_hp_time_s || 0) + ' s');

        if (typeof summary.menu_to_play_ms === 'number') {
          setText('#res-menu-latency', (summary.menu_to_play_ms / 1000).toFixed(2) + ' s');
        } else {
          setText('#res-menu-latency', '-');
        }

        setText('#res-participant', summary.participant || '-');

        // Hint ตอนจบเกม (optional UI)
        const endHintEl = $('#res-end-hint');
        if (endHintEl) {
          let hint = '';
          if (summary.end_reason === 'time-up' && summary.bosses_cleared < BOSSES.length) {
            hint = 'หมดเวลา ลองตีให้ต่อเนื่องขึ้นอีกนิด หรือใช้ FEVER ให้คุ้มขึ้นนะ ⚡';
          } else if (summary.end_reason === 'bomb-ko') {
            hint = 'โดนระเบิดเยอะไปหน่อย ลองโฟกัสเลี่ยงเป้าบอมบ์ให้มากขึ้น 💣';
          } else if (summary.end_reason === 'player-down') {
            hint = 'HP หมด ลองเก็บ Heal / Shield ให้มากขึ้นในรอบถัดไป 💚🛡️';
          } else if (summary.end_reason === 'all-boss-cleared') {
            hint = 'สุดยอด! เคลียร์ทุกบอสแล้ว ลองขยับไประดับที่ยากขึ้นได้เลย 🎉';
          } else {
            hint = 'ลองสังเกตรูปแบบเป้า แล้ววางจังหวะตีล่วงหน้า 1 เป้าเสมอ 👀';
          }
          endHintEl.textContent = hint;
        }

        if (viewResult) {
          viewResult.dataset.eventsCsv  = summary.eventsCsv || '';
          viewResult.dataset.sessionCsv = summary.sessionCsv || '';
        }

        showView('result');
      }
    }
  });

  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');
  const btnResearchBegin = $('[data-action="research-begin-play"]');
  const btnStopEarly     = $('[data-action="stop-early"]');
  const btnPlayAgain     = $('[data-action="play-again"]');
  const btnBackToMenuAll = $$('[data-action="back-to-menu"]');
  const btnCsvEvents     = $('[data-action="download-csv-events"]');
  const btnCsvSession    = $('[data-action="download-csv-session"]');

  function getDiffKey() {
    const sel = $('#difficulty');
    return sel ? (sel.value || 'normal') : 'normal';
  }

  function getDurationSec() {
    const sel = $('#duration');
    if (!sel) return 60;
    const v = parseInt(sel.value, 10);
    return Number.isNaN(v) ? 60 : v;
  }

  function collectResearchMeta() {
    const idEl    = $('#research-id');
    const groupEl = $('#research-group');
    const noteEl  = $('#research-note');
    return {
      id:    idEl    ? (idEl.value || '').trim() : '',
      group: groupEl ? (groupEl.value || '').trim() : '',
      note:  noteEl  ? (noteEl.value || '').trim() : ''
    };
  }

  function resetCoachTextOnStart() {
    const fb = $('#sb-feedback');
    if (!fb) return;
    fb.textContent = 'เริ่มแล้ว! ลองตีให้คอมโบไม่หลุดดูสักรอบ 💪';
    fb.className = 'sb-feedback';
  }

  btnStartNormal && btnStartNormal.addEventListener('click', () => {
    lastMode = 'normal';
    const diffKey = getDiffKey();
    const durSec  = getDurationSec();
    engine.start('normal', diffKey, durSec, {});
    resetCoachTextOnStart();
    showView('play');
  });

  btnStartResearch && btnStartResearch.addEventListener('click', () => {
    lastMode = 'research';
    showView('research');
  });

  btnResearchBegin && btnResearchBegin.addEventListener('click', () => {
    const diffKey = getDiffKey();
    const durSec  = getDurationSec();
    const meta    = collectResearchMeta();
    engine.start('research', diffKey, durSec, meta);
    resetCoachTextOnStart();
    showView('play');
  });

  btnStopEarly && btnStopEarly.addEventListener('click', () => {
    engine._finish('manual-stop');
  });

  btnPlayAgain && btnPlayAgain.addEventListener('click', () => {
    const diffKey = getDiffKey();
    const durSec  = getDurationSec();
    const meta = lastMode === 'research' ? collectResearchMeta() : {};
    engine.start(lastMode, diffKey, durSec, meta);
    resetCoachTextOnStart();
    showView('play');
  });

  btnBackToMenuAll.forEach(btn => {
    btn.addEventListener('click', () => {
      engine.markMenuOpened();
      showView('menu');
    });
  });

  function downloadCsv(name, text) {
    if (!text) {
      alert('ยังไม่มีข้อมูล CSV ลองเล่นเกมให้จบก่อนค่ะ');
      return;
    }
    try {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV download failed', err);
      alert('ไม่สามารถดาวน์โหลด CSV ได้ ลองใหม่อีกครั้งหรือตรวจสอบเบราว์เซอร์');
    }
  }

  btnCsvEvents && btnCsvEvents.addEventListener('click', () => {
    if (!viewResult) return;
    const csv = viewResult.dataset.eventsCsv || '';
    downloadCsv('shadow-breaker-events.csv', csv);
  });

  btnCsvSession && btnCsvSession.addEventListener('click', () => {
    if (!viewResult) return;
    const csv = viewResult.dataset.sessionCsv || '';
    downloadCsv('shadow-breaker-sessions.csv', csv);
  });

  showView('menu');
  engine.markMenuOpened();
  console.log('[ShadowBreaker] engine initialized', BUILD_VERSION);
}
