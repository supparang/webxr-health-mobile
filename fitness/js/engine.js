// === js/engine.js — Shadow Breaker Engine (Boss Intro + Phases + FX 2025-11-28) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const BUILD_VERSION = 'sb-2025-11-28';

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));

// ---------- CONFIG ----------

// ความยาก: ปรับ spawn, lifetime, ขนาดเป้า (จะมี scale เพิ่มตาม phase อีกที)
const DIFF_CONFIG = {
  easy: {
    label: 'Easy',
    timeSec: 60,
    spawnIntervalMs: [1000, 900, 800],
    lifetimeMs:      [2400, 2200, 2000],
    sizePx:          [150, 135, 120],   // phase 1–3
    maxActive:       [3, 4, 5]
  },
  normal: {
    label: 'Normal',
    timeSec: 60,
    spawnIntervalMs: [900, 800, 700],
    lifetimeMs:      [2200, 2000, 1800],
    sizePx:          [130, 115, 100],
    maxActive:       [4, 5, 6]
  },
  hard: {
    label: 'Hard',
    timeSec: 60,
    spawnIntervalMs: [800, 700, 600],
    lifetimeMs:      [2000, 1800, 1600],
    sizePx:          [115, 100, 90],
    maxActive:       [5, 6, 7]
  }
};

// บอส 4 ตัว (ต่อเนื่อง) แต่ละตัวมี 3 phase ตาม HP ratio
const BOSSES = [
  {
    id: 0,
    name: 'Bubble Glove',
    emoji: '🐣',
    introTitle: 'บอสมือใหม่สายฟอง',
    introDesc: 'เป้าใหญ่เด้งช้า วอร์มอัพก่อนให้เข้าจังหวะ',
    hintPlay: 'โฟกัสที่เป้าฟองแล้วตีให้ทัน',
    reward: '🎁 ได้สายคาดหัวฟองสบู่'
  },
  {
    id: 1,
    name: 'Neon Knuckle',
    emoji: '⚡',
    introTitle: 'หมัดนีออนสายสปีด',
    introDesc: 'เป้าเริ่มเล็กลง เร็วขึ้น ต้องไวกว่าเดิม!',
    hintPlay: 'ดูจังหวะและระวังบอมบ์สีแปลก',
    reward: '🎁 ได้ถุงมือไฟฟ้านีออน'
  },
  {
    id: 2,
    name: 'Shadow Guard',
    emoji: '🛡️',
    introTitle: 'ผู้พิทักษ์เงา',
    introDesc: 'มีเป้าลวงกับระเบิดแทรกมาเรื่อย ๆ',
    hintPlay: 'อย่าเผลอตีเป้าลวงบ่อยเกินไป',
    reward: '🎁 ได้โล่ห์เงาแห่งความทนทาน'
  },
  {
    id: 3,
    name: 'Final Burst',
    emoji: '💥',
    introTitle: 'ราชาบอสระเบิดพลัง',
    introDesc: 'โหมดยากสุด คอมโบยาว ๆ ไปให้สุด!',
    hintPlay: 'รักษาคอมโบแล้วปล่อยพลัง FEVER ให้เต็ม',
    reward: '🏆 ปราบบอสครบทุกตัว!'
  }
];

// ---------- ENGINE ----------

class ShadowBreakerEngine {
  constructor(opts) {
    this.mode = opts.mode || 'normal';          // normal / research
    this.diffKey = opts.diffKey || 'normal';
    this.diff = DIFF_CONFIG[this.diffKey] || DIFF_CONFIG.normal;

    // เวลารอบจาก select ถ้ามี
    const durSel = $('#duration');
    const customSec = durSel ? parseInt(durSel.value, 10) : NaN;
    this.timeLimitMs = (!Number.isNaN(customSec) && customSec > 0
      ? customSec
      : this.diff.timeSec) * 1000;

    this.renderer = opts.renderer;
    this.eventLogger = opts.eventLogger;
    this.sessionLogger = opts.sessionLogger;
    this.wrap = opts.wrap || document.body;
    this.participant = opts.participant || '';
    this.group = opts.group || '';
    this.note = opts.note || '';
    this.runIndex = opts.runIndex || 1;
    this.menuToPlayMs = opts.menuToPlayMs || 0;
    this.onEnd = opts.onEnd || (() => {});

    this.sessionId = `SB-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    // state หลัก
    this.started = false;
    this.ended = false;
    this.paused = false;

    this.elapsedMs = 0;
    this.remainingMs = this.timeLimitMs;

    this.bossIndex = 0;              // 0–3
    this.boss = BOSSES[this.bossIndex];
    this.bossHpMax = 100;
    this.bossHp = this.bossHpMax;

    this.playerHpMax = 100;
    this.playerHp = this.playerHpMax;

    this.bossPhase = 1;              // 1–3
    this.nearDeath = false;
    this.bossFaceSpawned = false;    // spawn หน้า boss ให้ตีตอนใกล้ตาย

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missCount = 0;
    this.totalTargets = 0;
    this.totalHits = 0;
    this.totalBombHits = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.badCount = 0;
    this.bossesCleared = 0;

    this.feverGauge = 0;
    this.feverOn = false;
    this.feverCount = 0;
    this.feverTimeMs = 0;
    this.lowHpTimeMs = 0;

    this.targets = new Map();
    this.nextSpawnAt = 0;
    this.targetSeq = 0;

    this.rtNormal = { n: 0, sum: 0, sumSq: 0 };
    this.rtDecoy  = { n: 0, sum: 0, sumSq: 0 };

    // time ref
    this.startTsPerf = 0;
    this.lastTick = 0;

    // wire renderer
    if (this.renderer) {
      this.renderer.onTargetHit = (id, posInfo) => this.handleHit(id, posInfo);
    }

    // initial HUD
    this._updateBossHUD();
    this._updateHUD();
  }

  // ---------- PUBLIC ----------

  showIntroAndStart() {
    this._showBossIntro(true);
  }

  stop(reason = 'manual-stop') {
    if (this.ended) return;
    this._finish(reason);
  }

  // ---------- LOOP ----------

  _internalStart() {
    if (this.started) return;
    this.started = true;
    this.startTsPerf = performance.now();
    this.lastTick = this.startTsPerf;
    this.nextSpawnAt = this.startTsPerf + 600;
    this._loop(this.startTsPerf);
  }

  _loop(ts) {
    if (this.ended) return;

    if (this.paused) {
      // freeze เวลา / spawn ขณะโชว์ intro
      this.lastTick = ts;
      requestAnimationFrame((t) => this._loop(t));
      return;
    }

    const dt = ts - this.lastTick;
    this.lastTick = ts;

    this.elapsedMs += dt;
    this.remainingMs = Math.max(0, this.timeLimitMs - this.elapsedMs);

    // FEVER เวลา
    if (this.feverOn) {
      this.feverTimeMs += dt;
      this.feverGauge = clamp(this.feverGauge - dt * 0.02, 0, 100);
      if (this.feverGauge <= 0) this.feverOn = false;
    } else {
      // decay เล็กน้อย
      this.feverGauge = clamp(this.feverGauge - dt * 0.004, 0, 100);
    }

    // HP ต่ำ
    if (this.playerHp <= 30) {
      this.lowHpTimeMs += dt;
    }

    // spawn เป้า
    if (ts >= this.nextSpawnAt) {
      this._spawnTarget(ts);
    }

    // timeout เป้า
    this._checkTimeouts(ts);

    // เช็คหมดเวลา
    if (this.remainingMs <= 0) {
      this._finish('time-up');
      return;
    }

    this._updateHUD();
    requestAnimationFrame((t) => this._loop(t));
  }

  _spawnTarget(now) {
    const phaseIdx = this.bossPhase - 1;
    const conf = this.diff;

    const baseInterval = conf.spawnIntervalMs[phaseIdx];
    const lifeMs       = conf.lifetimeMs[phaseIdx];
    const baseSize     = conf.sizePx[phaseIdx];

    // ถ้า near-death แล้วยังไม่ spawn หน้า boss → spawn พิเศษ
    if (this.nearDeath && !this.bossFaceSpawned) {
      this._spawnBossFaceTarget(now, baseSize * 1.8, lifeMs + 500);
      this.bossFaceSpawned = true;
    }

    // limit active ตาม phase
    let active = 0;
    for (const t of this.targets.values()) {
      if (!t.isBossFace) active++;
    }
    const maxActive = conf.maxActive[phaseIdx];
    if (active >= maxActive) {
      this.nextSpawnAt = now + 80;
      return;
    }

    const id = ++this.targetSeq;

    const zoneLR = ['L', 'C', 'R'][Math.floor(Math.random() * 3)];
    const zoneUD = ['U', 'M', 'D'][Math.floor(Math.random() * 3)];

    const rType = Math.random();
    let type = 'normal';
    if (rType > 0.94) type = 'bomb';
    else if (rType > 0.86) type = 'heal';
    else if (rType > 0.78) type = 'shield';
    else if (rType > 0.68 && this.bossIndex >= 1) type = 'decoy';

    const sizeJitter = (Math.random() * 0.20 - 0.10);
    let sizePx = baseSize * (1 + sizeJitter);
    if (type === 'bomb' || type === 'decoy') sizePx *= 0.9;

    const t = {
      id,
      bossId: this.boss.id,
      bossPhase: this.bossPhase,
      isDecoy: type === 'decoy',
      isBomb: type === 'bomb',
      isHeal: type === 'heal',
      isShield: type === 'shield',
      isBossFace: false,

      spawnTime: now,
      lifeMs,
      expireTime: now + lifeMs,
      sizePx: Math.round(sizePx),
      spawnIntervalMs: baseInterval,
      phaseAtSpawn: this.bossPhase,
      phaseSpawnIndex: id,
      xNorm: null,
      yNorm: null,
      zoneLR,
      zoneUD,
      diffKey: this.diffKey
    };

    this.targets.set(id, t);
    this.totalTargets++;

    this.renderer && this.renderer.spawnTarget(t);

    let interval = baseInterval;
    if (this.feverOn) interval *= 0.7;
    if (this.diffKey === 'hard') interval *= 0.9;
    if (this.nearDeath) interval *= 0.8;

    this.nextSpawnAt = now + interval;
  }

  _spawnBossFaceTarget(now, sizePx, lifeMs) {
    const id = ++this.targetSeq;
    const zoneLR = 'C';
    const zoneUD = 'M';

    const t = {
      id,
      bossId: this.boss.id,
      bossPhase: this.bossPhase,
      isDecoy: false,
      isBomb: false,
      isHeal: false,
      isShield: false,
      isBossFace: true,

      spawnTime: now,
      lifeMs,
      expireTime: now + lifeMs,
      sizePx: Math.round(sizePx),
      spawnIntervalMs: this.diff.spawnIntervalMs[this.bossPhase - 1],
      phaseAtSpawn: this.bossPhase,
      phaseSpawnIndex: id,
      xNorm: 0.5,
      yNorm: 0.5,
      zoneLR,
      zoneUD,
      diffKey: this.diffKey,
      emoji: this.boss.emoji
    };

    this.targets.set(id, t);
    this.totalTargets++;
    this.renderer && this.renderer.spawnTarget(t);
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
      this.renderer && this.renderer.removeTarget(id, 'timeout');
      this.targets.delete(id);
    }
  }

  // ---------- HIT / SCORE ----------

  handleHit(id, posInfo) {
    if (this.ended) return;

    const t = this.targets.get(id);
    if (!t) return;

    const now = performance.now();
    this.targets.delete(id);  // ไม่ลบใน renderer จนกว่าจะเล่น FX เสร็จ

    const age = now - t.spawnTime;
    const ratio = clamp(age / t.lifeMs, 0, 1);

    let grade = 'good';

    if (t.isBomb) grade = 'bomb';
    else if (t.isDecoy) grade = 'decoy';
    else if (t.isBossFace) grade = 'perfect';
    else if (ratio <= 0.35) grade = 'perfect';
    else if (ratio >= 0.9) grade = 'bad';

    const comboBefore = this.combo;
    const hpBefore = this.playerHp;
    const feverBefore = this.feverGauge;

    let scoreDelta = 0;
    let bossDmg = 0;
    let fxEmoji = '✨';

    if (grade === 'perfect') {
      scoreDelta = t.isBossFace ? 400 : 130;
      bossDmg = t.isBossFace ? 999 : 3;
      this.score += scoreDelta;
      this.combo++;
      this.perfectCount++;
      this.totalHits++;
      this._gainFever(9);
      fxEmoji = '💥';
    } else if (grade === 'good') {
      scoreDelta = 90;
      bossDmg = 2;
      this.score += scoreDelta;
      this.combo++;
      this.goodCount++;
      this.totalHits++;
      this._gainFever(6);
      fxEmoji = '⭐';
    } else if (grade === 'bad') {
      scoreDelta = 40;
      bossDmg = 1;
      this.score += scoreDelta;
      this.combo = 0;
      this.badCount++;
      this.totalHits++;
      this._gainFever(3);
      fxEmoji = '💫';
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

    if (this.feverOn && scoreDelta > 0 && !t.isBossFace) {
      this.score += Math.round(scoreDelta * 0.3);
    }

    // สะสม RT
    if (!t.isDecoy && !t.isBomb) {
      this._accRT(this.rtNormal, age);
    } else if (t.isDecoy) {
      this._accRT(this.rtDecoy, age);
    }

    // เล่น FX ก่อนลบเป้า → เอฟเฟ็กต์ตรงเป้าแน่นอน
    this.renderer && this.renderer.playHitFx(t.id, {
      grade: grade === 'decoy' ? 'miss' : grade,
      scoreDelta,
      fxEmoji
    });
    this.renderer && this.renderer.removeTarget(t.id, 'hit');

    // ดาเมจบอส (ถ้ามี)
    if (bossDmg > 0) {
      this._damageBoss(bossDmg);
    }

    // coach text
    const fb = $('#sb-feedback');
    if (fb) {
      let msg = '';
      if (grade === 'perfect') msg = 'สุดยอด! PERFECT 🎯';
      else if (grade === 'good') msg = 'ดีมาก! จังหวะกำลังสวย 💪';
      else if (grade === 'bad') msg = 'ช้าไปนิด ลองกะจังหวะให้พอดี 😅';
      else if (grade === 'bomb') msg = 'โดนบอมบ์แล้ว! ระวังเป้าสีแปลก ๆ 💣';
      else if (grade === 'decoy') msg = 'อันนั้นเป้าลวง ลองสังเกตดี ๆ 👀';
      else msg = 'MISS! ลองใหม่อีกรอบนะ';
      fb.textContent = msg;
    }

    // log event
    if (this.eventLogger) {
      this.eventLogger.add({
        session_id: this.sessionId,
        run_index: this.runIndex,
        mode: this.mode,
        difficulty: this.diffKey,
        participant: this.participant,
        group: this.group,
        note: this.note,

        target_id: t.id,
        boss_id: t.bossId,
        boss_phase: t.bossPhase,
        is_decoy: t.isDecoy ? 1 : 0,
        is_bomb: t.isBomb ? 1 : 0,
        is_bossface: t.isBossFace ? 1 : 0,

        grade,
        age_ms: Math.round(age),
        fever_on: this.feverOn ? 1 : 0,
        score_delta: scoreDelta,
        score_total: this.score,
        combo_before: comboBefore,
        combo_after: this.combo,
        player_hp_before: hpBefore,
        player_hp_after: this.playerHp,
        boss_hp_before: this.bossHp,
        boss_hp_after: this.bossHp,
        fever_before: Math.round(feverBefore),
        fever_after: Math.round(this.feverGauge),

        target_size_px: t.sizePx,
        spawn_interval_ms: t.spawnIntervalMs,
        phase_at_spawn: t.phaseAtSpawn,
        phase_spawn_index: t.phaseSpawnIndex,
        x_norm: t.xNorm ?? '',
        y_norm: t.yNorm ?? '',
        zone_lr: t.zoneLR,
        zone_ud: t.zoneUD
      });
    }

    this._updateHUD();

    // เช็คบอสตายหลังตี
    if (this.bossHp <= 0 && !this.ended) {
      this._onBossDefeated();
    }
  }

  _registerMiss(t) {
    if (this.ended) return;

    this.missCount++;
    this.combo = 0;

    if (!t.isBomb && !t.isDecoy && !t.isBossFace) {
      this.playerHp = clamp(this.playerHp - 4, 0, this.playerHpMax);
    }

    const fb = $('#sb-feedback');
    if (fb) fb.textContent = 'พลาดจังหวะ! ลองโฟกัสให้ดีขึ้นนะ';

    if (this.eventLogger) {
      this.eventLogger.add({
        session_id: this.sessionId,
        run_index: this.runIndex,
        mode: this.mode,
        difficulty: this.diffKey,
        participant: this.participant,
        group: this.group,
        note: this.note,

        target_id: t.id,
        boss_id: t.bossId,
        boss_phase: t.bossPhase,
        is_decoy: t.isDecoy ? 1 : 0,
        is_bomb: t.isBomb ? 1 : 0,
        is_bossface: t.isBossFace ? 1 : 0,

        grade: 'miss',
        age_ms: t.lifeMs,
        fever_on: this.feverOn ? 1 : 0,
        score_delta: 0,
        score_total: this.score,
        combo_before: 0,
        combo_after: 0,
        player_hp_before: this.playerHp,
        player_hp_after: this.playerHp,
        boss_hp_before: this.bossHp,
        boss_hp_after: this.bossHp,
        fever_before: Math.round(this.feverGauge),
        fever_after: Math.round(this.feverGauge),

        target_size_px: t.sizePx,
        spawn_interval_ms: t.spawnIntervalMs,
        phase_at_spawn: t.phaseAtSpawn,
        phase_spawn_index: t.phaseSpawnIndex,
        x_norm: t.xNorm ?? '',
        y_norm: t.yNorm ?? '',
        zone_lr: t.zoneLR,
        zone_ud: t.zoneUD
      });
    }

    if (this.playerHp <= 0 && !this.ended) {
      this._finish('player-down');
    }
  }

  _hitByBomb() {
    this.playerHp = clamp(this.playerHp - 18, 0, this.playerHpMax);
    if (this.playerHp <= 0 && !this.ended) {
      this._finish('bomb-ko');
    }
  }

  _gainFever(amount) {
    this.feverGauge = clamp(this.feverGauge + amount, 0, 100);
    if (!this.feverOn && this.feverGauge >= 100) {
      this.feverOn = true;
      this.feverCount++;
      if (window.SFX && window.SFX.play) {
        window.SFX.play('fever', { group: 'fever', baseVolume: 0.9, intensity: 1.0 });
      }
    }
  }

  _damageBoss(dmg) {
    const prevRatio = this.bossHp / this.bossHpMax;
    this.bossHp = clamp(this.bossHp - dmg, 0, this.bossHpMax);
    const ratio = this.bossHp / this.bossHpMax;

    // phase 1–3 ตาม HP
    const oldPhase = this.bossPhase;
    if (ratio <= 0.33) this.bossPhase = 3;
    else if (ratio <= 0.66) this.bossPhase = 2;
    else this.bossPhase = 1;

    // near death
    const oldNear = this.nearDeath;
    this.nearDeath = ratio <= 0.22;

    // shake ตอน HP ต่ำ
    if (ratio <= 0.25 && prevRatio > 0.25) {
      const wrap = $('#sb-wrap');
      if (wrap) {
        wrap.classList.add('sb-shake');
        setTimeout(() => wrap.classList.remove('sb-shake'), 350);
      }
    }

    // phase change → ปรับพื้นหลัง
    if (this.bossPhase !== oldPhase || this.nearDeath !== oldNear) {
      this._updateBossHUD();
    }
  }

  _accRT(store, rtMs) {
    store.n++;
    store.sum += rtMs;
    store.sumSq += rtMs * rtMs;
  }

  _onBossDefeated() {
    this.bossesCleared++;
    this.bossFaceSpawned = false;

    // reward text
    const fb = $('#sb-feedback');
    if (fb) {
      fb.textContent = BOSSES[this.bossIndex].reward || 'เคลียร์บอสเรียบร้อย!';
    }

    if (window.SFX && window.SFX.play) {
      window.SFX.play('boss', { group: 'boss', baseVolume: 1.0, intensity: 1.0 });
    }

    // ถ้ายังมีบอสถัดไป → ไปตัวถัดไป + intro
    if (this.bossIndex < BOSSES.length - 1) {
      this.bossIndex++;
      this.boss = BOSSES[this.bossIndex];
      this.bossHpMax = 100;
      this.bossHp = this.bossHpMax;
      this.bossPhase = 1;
      this.nearDeath = false;
      this.bossFaceSpawned = false;

      // เคลียร์เป้าเดิมทั้งหมด
      for (const id of this.targets.keys()) {
        this.renderer && this.renderer.removeTarget(id, 'end');
      }
      this.targets.clear();

      this._updateBossHUD();
      this._showBossIntro(false);
    } else {
      // จบทุกบอส
      this._finish('all-boss-cleared');
    }
  }

  // ---------- END / SUMMARY ----------

  _finish(reason) {
    if (this.ended) return;
    this.ended = true;

    // ลบเป้าออกจากจอ
    for (const id of this.targets.keys()) {
      this.renderer && this.renderer.removeTarget(id, 'end');
    }
    this.targets.clear();

    const durationS = this.elapsedMs / 1000;
    const accuracy = this.totalTargets
      ? (this.totalHits / this.totalTargets) * 100
      : 0;

    const avgStd = (obj) => {
      if (!obj || !obj.n) return { avg: null, std: null };
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
      training_phase: `boss_${this.bossIndex + 1}`,
      run_index: this.runIndex,

      start_ts: new Date(performance.timeOrigin + this.startTsPerf).toISOString(),
      end_ts: new Date().toISOString(),
      duration_s: Number(durationS.toFixed(2)),
      end_reason: reason,

      final_score: this.score,
      grade,
      total_targets: this.totalTargets,
      total_hits: this.totalHits,
      total_miss: this.missCount,
      total_bombs_hit: this.totalBombHits,

      accuracy_pct: Number(accuracy.toFixed(1)),
      max_combo: this.maxCombo,
      perfect_count: this.perfectCount,
      good_count: this.goodCount,
      bad_count: this.badCount,

      avg_rt_normal_ms: rtN.avg != null ? Number(rtN.avg.toFixed(1)) : '',
      std_rt_normal_ms: rtN.std != null ? Number(rtN.std.toFixed(1)) : '',
      avg_rt_decoy_ms: rtD.avg != null ? Number(rtD.avg.toFixed(1)) : '',
      std_rt_decoy_ms: rtD.std != null ? Number(rtD.std.toFixed(1)) : '',

      fever_count: this.feverCount,
      fever_total_time_s: Number((this.feverTimeMs / 1000).toFixed(2)),
      low_hp_time_s: Number((this.lowHpTimeMs / 1000).toFixed(2)),
      bosses_cleared: this.bossesCleared,
      menu_to_play_ms: Math.round(this.menuToPlayMs),

      participant: this.participant,
      group: this.group,
      note: this.note,

      env_ua: navigator.userAgent,
      env_viewport_w: window.innerWidth,
      env_viewport_h: window.innerHeight,
      env_input_mode: ('ontouchstart' in window) ? 'touch' : 'mouse',

      error_count: 0,
      focus_events: 0
    };

    if (this.sessionLogger) {
      this.sessionLogger.add(sessionRow);
    }

    this.onEnd(sessionRow);
  }

  _calcGrade(accuracy, score) {
    if (accuracy >= 90 && score >= 3500) return 'S';
    if (accuracy >= 80 && score >= 2500) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    return 'D';
  }

  // ---------- HUD & UI ----------

  _updateHUD() {
    const tSec = this.remainingMs / 1000;
    const timeEl = $('#stat-time');
    if (timeEl) timeEl.textContent = tSec.toFixed(1);

    const scoreEl = $('#stat-score');
    if (scoreEl) scoreEl.textContent = this.score;

    const comboEl = $('#stat-combo');
    if (comboEl) comboEl.textContent = this.combo;

    const phaseEl = $('#stat-phase');
    if (phaseEl) phaseEl.textContent = this.bossIndex + 1;

    // HP bars
    const pBar = $('[data-sb-player-hp]');
    const bBar = $('[data-sb-boss-hp]');
    if (pBar) pBar.style.transform =
      `scaleX(${clamp(this.playerHp / this.playerHpMax, 0, 1)})`;
    if (bBar) bBar.style.transform =
      `scaleX(${clamp(this.bossHp / this.bossHpMax, 0, 1)})`;

    // FEVER bar
    const fv = clamp(this.feverGauge, 0, 100) / 100;
    const feverFill = $('#fever-fill');
    if (feverFill) feverFill.style.transform = `scaleX(${fv})`;

    const feverStatus = $('#fever-status');
    if (feverStatus) {
      feverStatus.textContent = this.feverOn ? 'FEVER!!' : 'Ready';
      feverStatus.classList.toggle('on', this.feverOn);
    }
  }

  _updateBossHUD() {
    const nameEl  = $('#boss-portrait-name');
    const hintEl  = $('#boss-portrait-hint');
    const emojiEl = $('#boss-portrait-emoji');

    if (nameEl)  nameEl.textContent  = this.boss.name;
    if (hintEl)  hintEl.textContent  = this.boss.hintPlay;
    if (emojiEl) emojiEl.textContent = this.boss.emoji;

    // data บน wrap → ใช้ใน CSS background/scale
    if (this.wrap) {
      this.wrap.dataset.boss = String(this.bossIndex);
      this.wrap.dataset.phase = String(this.bossPhase);
      this.wrap.dataset.diff = this.diffKey;
    }
  }

  _showBossIntro(isFirstBoss) {
    const intro = $('#bossIntro');
    if (!intro) {
      this._internalStart();
      return;
    }

    const eEmoji = $('#boss-intro-emoji');
    const eName  = $('#boss-intro-name');
    const eTitle = $('#boss-intro-title');
    const eDesc  = $('#boss-intro-desc');

    if (eEmoji) eEmoji.textContent = this.boss.emoji;
    if (eName)  eName.textContent  = this.boss.name;
    if (eTitle) eTitle.textContent = this.boss.introTitle;
    if (eDesc)  eDesc.textContent  = this.boss.introDesc;

    intro.classList.remove('hidden');

    this.paused = true;

    const handler = () => {
      intro.classList.add('hidden');
      intro.removeEventListener('click', handler);
      intro.removeEventListener('pointerdown', handler);
      this.paused = false;

      if (!this.started) {
        this._internalStart();
      }
    };

    intro.addEventListener('click', handler);
    intro.addEventListener('pointerdown', handler);

    if (window.SFX && window.SFX.play) {
      window.SFX.play('boss', { group: 'boss', baseVolume: 0.9, intensity: 1.0 });
    }
  }
}

// ---------- BOOTSTRAP + UI BIND ----------

export function initShadowBreaker() {
  const wrap = $('#sb-wrap') || document.body;
  const targetLayer = $('#target-layer') || wrap;
  const renderer = new DomRenderer(targetLayer, {});

  let engine = null;
  let eventLogger = null;
  let sessionLogger = null;

  let lastCsvEvents = '';
  let lastCsvSession = '';

  const viewMenu     = $('#view-menu');
  const viewPlay     = $('#view-play');
  const viewResult   = $('#view-result');
  const viewResearch = $('#view-research-form');

  function showView(which) {
    [viewMenu, viewPlay, viewResult, viewResearch].forEach((v) => {
      if (v) v.classList.add('hidden');
    });
    if (which === 'menu' && viewMenu) viewMenu.classList.remove('hidden');
    if (which === 'play' && viewPlay) viewPlay.classList.remove('hidden');
    if (which === 'result' && viewResult) viewResult.classList.remove('hidden');
    if (which === 'research' && viewResearch) viewResearch.classList.remove('hidden');
  }

  function fillResultPanel(state) {
    const setText = (id, val) => {
      const el = $(id);
      if (el) el.textContent = val;
    };

    setText('#res-mode', state.mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ');
    setText('#res-diff', state.difficulty || '-');
    setText('#res-endreason', state.end_reason || state.endReason || '-');
    setText('#res-score', state.final_score ?? state.score ?? 0);
    setText('#res-maxcombo', state.max_combo ?? 0);
    setText('#res-miss', state.total_miss ?? 0);
    setText('#res-accuracy', (state.accuracy_pct != null ? state.accuracy_pct : 0) + '%');
    setText('#res-totalhits', state.total_hits ?? 0);

    const rtN = state.avg_rt_normal_ms;
    const rtD = state.avg_rt_decoy_ms;
    setText('#res-rt-normal', rtN != null && rtN !== '' ? rtN + ' ms' : '-');
    setText('#res-rt-decoy', rtD != null && rtD !== '' ? rtD + ' ms' : '-');

    setText('#res-grade', state.grade || '-');

    const feverTime = state.fever_total_time_s != null ? state.fever_total_time_s : 0;
    const lowHpTime = state.low_hp_time_s != null ? state.low_hp_time_s : 0;
    setText('#res-fever-time', feverTime.toFixed ? feverTime.toFixed(2) + ' s' : feverTime + ' s');
    setText('#res-lowhp-time', lowHpTime.toFixed ? lowHpTime.toFixed(2) + ' s' : lowHpTime + ' s');

    const bosses = state.bosses_cleared != null ? state.bosses_cleared : 0;
    setText('#res-bosses', bosses);

    if (typeof state.menu_to_play_ms === 'number') {
      setText('#res-menu-latency', (state.menu_to_play_ms / 1000).toFixed(2) + ' s');
    } else {
      setText('#res-menu-latency', '-');
    }

    setText('#res-participant', state.participant || '-');
  }

  function startSession(mode) {
    const diffSel = $('#difficulty');
    const diffKey = diffSel ? (diffSel.value || 'normal') : 'normal';

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
    const menuOpenedAt = window.__SB_MENU_OPEN_TS || now;
    const menuToPlayMs = now - menuOpenedAt;

    eventLogger = new EventLogger();
    sessionLogger = new SessionLogger();

    const prevRun = parseInt(wrap.dataset.runIndex || '0', 10) || 0;
    const runIndex = prevRun + 1;
    wrap.dataset.runIndex = String(runIndex);

    engine = new ShadowBreakerEngine({
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
      onEnd: (summary) => {
        lastCsvEvents = eventLogger.toCsv();
        lastCsvSession = sessionLogger.toCsv();
        fillResultPanel(summary);
        showView('result');
      }
    });

    window.__SB_LAST_ENGINE = engine;

    showView('play');
    engine.showIntroAndStart();
  }

  // ---------- BUTTONS ----------

  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');
  const btnResearchBegin = $('[data-action="research-begin-play"]');
  const btnStopEarly     = $('[data-action="stop-early"]');
  const btnPlayAgain     = $('[data-action="play-again"]');
  const btnCsvEvents     = $('[data-action="download-csv-events"]');
  const btnCsvSession    = $('[data-action="download-csv-session"]');
  const btnBackMenus     = $$('[data-action="back-to-menu"]');

  if (btnStartNormal) {
    btnStartNormal.addEventListener('click', () => {
      startSession('normal');
    });
  }

  if (btnStartResearch) {
    btnStartResearch.addEventListener('click', () => {
      showView('research');
    });
  }

  if (btnResearchBegin) {
    btnResearchBegin.addEventListener('click', () => {
      startSession('research');
    });
  }

  if (btnStopEarly) {
    btnStopEarly.addEventListener('click', () => {
      if (engine) engine.stop('manual-stop');
    });
  }

  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      const lastMode = engine?.mode || 'normal';
      startSession(lastMode);
    });
  }

  btnBackMenus.forEach((b) => {
    b.addEventListener('click', () => {
      engine = null;
      showView('menu');
      window.__SB_MENU_OPEN_TS = performance.now();
    });
  });

  if (btnCsvEvents) {
    btnCsvEvents.addEventListener('click', () => {
      if (!lastCsvEvents) {
        alert('ยังไม่มีข้อมูล Event CSV ลองเล่นเกมให้จบก่อนค่ะ');
        return;
      }
      _downloadCsv('shadow-breaker-events.csv', lastCsvEvents);
    });
  }

  if (btnCsvSession) {
    btnCsvSession.addEventListener('click', () => {
      if (!lastCsvSession) {
        alert('ยังไม่มีข้อมูล Session CSV ลองเล่นเกมให้จบก่อนค่ะ');
        return;
      }
      _downloadCsv('shadow-breaker-sessions.csv', lastCsvSession);
    });
  }

  function _downloadCsv(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.__SB_MENU_OPEN_TS = performance.now();
  showView('menu');
}