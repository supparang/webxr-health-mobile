// === fitness/js/engine.js — Shadow Breaker DOM Engine (2025-11-19) ===
'use strict';

/**
 * ใช้คู่กับ main-shadow.js:
 *
 *   import { GameEngine } from './engine.js';
 *
 *   const engine = new GameEngine({
 *     config,        // จาก pickConfig(diffKey)
 *     hooks: { onUpdate(state), onEnd(state) },
 *     renderer,      // DomRenderer instance
 *     logger,        // createCSVLogger(sessionMeta)
 *     mode           // 'normal' | 'research'
 *   });
 *
 * renderer ต้องมีฟังก์ชัน:
 *   renderer.clear()
 *   renderer.spawnTarget(target)
 *   renderer.markHit(target, quality)
 *   renderer.markMiss(target)
 */

const LATENCY_COMPENSATION_MS = 25; // เผื่อดีเลย์ touch บนมือถือ

// หน้าต่าง PERFECT / GOOD / LATE (ปรับให้ง่ายขึ้น)
const JUDGE_WINDOWS = {
  easy:   { perfect: 120, good: 180, late: 250 },
  normal: { perfect:  80, good: 140, late: 220 },
  hard:   { perfect:  60, good: 120, late: 200 }
};

function inferDiffKey(config) {
  if (!config) return 'normal';
  if (config.diffKey) return config.diffKey;
  if (config.key) return config.key;
  const name = (config.name || '').toLowerCase();
  if (name.includes('easy'))   return 'easy';
  if (name.includes('hard'))   return 'hard';
  if (name.includes('normal')) return 'normal';
  return 'normal';
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class GameEngine {
  constructor(opts) {
    this.config   = opts.config || {};
    this.hooks    = opts.hooks  || {};
    this.renderer = opts.renderer || null;
    this.logger   = opts.logger   || null;
    this.mode     = opts.mode     || 'normal';

    this._state = null;
    this._rafId = null;
    this._running = false;

    const diffKey = inferDiffKey(this.config);
    this.diffKey = diffKey;
    this.judgeWin = JUDGE_WINDOWS[diffKey] || JUDGE_WINDOWS.normal;

    // fallback config ถ้า config.js ยังไม่ระบุ
    this.durationMs   = this.config.durationMs  || 60000;
    this.playerMaxHP  = this.config.playerMaxHP || 100;

    this.spawnMinMs   = this.config.spawnMinMs  || 450;
    this.spawnMaxMs   = this.config.spawnMaxMs  || 950;

    this.decoyChance  = this.config.decoyChance != null ? this.config.decoyChance : 0.18;
    this.healChance   = this.config.healChance  != null ? this.config.healChance  : 0.10;

    this.feverGainPerfect = this.config.feverGainPerfect || 7;
    this.feverGainGood    = this.config.feverGainGood    || 4;
    this.feverGainLate    = this.config.feverGainLate    || 2;
    this.feverLossMiss    = this.config.feverLossMiss    || 6;
    this.feverDecayPerSec = this.config.feverDecayPerSec || 5;
    this.feverDurationMs  = this.config.feverDurationMs  || 5000;

    this.bossList = (this.config.bossList && this.config.bossList.length)
      ? this.config.bossList
      : [
          { name: 'Bubble Glove', emoji: '💎', hp: 200 },
          { name: 'Flare Punch',  emoji: '🔥', hp: 260 },
          { name: 'Storm Fist',   emoji: '⚡', hp: 300 },
          { name: 'Night Guard',  emoji: '🌙', hp: 340 }
        ];
  }

  // ---------- public API ----------

  start() {
    this.stop(); // reset ของเก่า
    const now = performance.now();

    this._state = {
      startedAt: now,
      now,
      elapsedMs: 0,
      remainingMs: this.durationMs,

      score: 0,
      combo: 0,
      maxCombo: 0,
      missCount: 0,
      perfectHits: 0,

      playerHP: this.playerMaxHP,

      feverCharge: 0,
      feverActive: false,
      feverUntil: 0,

      bossIndex: 0,
      bossCount: this.bossList.length,
      bossName: this.bossList[0].name,
      bossEmoji: this.bossList[0].emoji,
      bossHP: this.bossList[0].hp,
      bossMaxHP: this.bossList[0].hp,

      targets: [],
      nextTargetId: 1,
      nextSpawnAt: now + 800,

      // analytics
      totalSpawns: 0,
      totalHits: 0,
      normalHits: 0,
      decoyHits: 0,
      expiredMisses: 0,
      rtNormalList: [],
      rtDecoyList: []
    };

    if (this.renderer && this.renderer.clear) {
      this.renderer.clear();
    }

    this._running = true;
    this._loop(now);
  }

  // reason: 'timeout' | 'boss-cleared' | 'player-dead' | 'manual' | 'back-to-menu'
  stop(reason = 'manual') {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (!this._running || !this._state) return;

    this._running = false;
    this._finish(reason);
  }

  /**
   * เรียกจาก DomRenderer ตอนผู้เล่นแตะเป้า
   * hitInfo: { id, type, screenX, screenY, createdAt }
   */
  handleHit(hitInfo) {
    const st = this._state;
    if (!this._running || !st) return;

    const now = performance.now();
    const target = st.targets.find(t => t.id === hitInfo.id && !t.resolved);
    if (!target) return;

    const dtRaw = now - target.spawnAt;
    const dt = dtRaw - LATENCY_COMPENSATION_MS; // ชดเชยดีเลย์มือถือ
    const absDt = Math.abs(dt);

    const judgeWin = this.judgeWin;
    let quality = 'late';
    if (absDt <= judgeWin.perfect)      quality = 'perfect';
    else if (absDt <= judgeWin.good)    quality = 'good';
    else if (absDt <= judgeWin.late)    quality = 'late';
    else                                quality = 'miss';

    let scoreGain = 0;
    let dmgToBoss = 0;
    let hpChange  = 0;

    if (quality === 'perfect') {
      scoreGain = target.type === 'decoy' ? 0 : 15;
      dmgToBoss = target.type === 'decoy' ? 0 : 10;
      st.perfectHits++;
      st.feverCharge += this.feverGainPerfect;
    } else if (quality === 'good') {
      scoreGain = target.type === 'decoy' ? 0 : 9;
      dmgToBoss = target.type === 'decoy' ? 0 : 6;
      st.feverCharge += this.feverGainGood;
    } else if (quality === 'late') {
      scoreGain = target.type === 'decoy' ? 0 : 4;
      dmgToBoss = target.type === 'decoy' ? 0 : 3;
      st.feverCharge += this.feverGainLate;
    } else { // miss
      st.missCount++;
      st.combo = 0;
      st.feverCharge = Math.max(0, st.feverCharge - this.feverLossMiss);
      hpChange = -4;
    }

    if (target.type === 'heal' && quality !== 'miss') {
      hpChange += 6; // เป้าฟื้น HP
    }

    if (target.type === 'decoy' && quality !== 'miss') {
      hpChange -= 3;   // ตีโดนหลอก → หัก HP เล็กน้อย
      st.decoyHits++;
    } else if (quality !== 'miss') {
      st.normalHits++;
    }

    if (quality === 'perfect' || quality === 'good' || quality === 'late') {
      st.combo++;
      if (st.combo > st.maxCombo) st.maxCombo = st.combo;
    } else {
      st.combo = 0;
    }

    if (!st.feverActive && st.feverCharge >= 100) {
      st.feverActive = true;
      st.feverUntil = now + this.feverDurationMs;
    }

    if (st.feverActive && dmgToBoss > 0) {
      scoreGain *= 2;
      dmgToBoss *= 1.8;
    }

    st.score += scoreGain;
    if (hpChange !== 0) {
      st.playerHP = Math.max(0, Math.min(this.playerMaxHP, st.playerHP + hpChange));
    }

    if (dmgToBoss > 0) {
      st.bossHP = Math.max(0, st.bossHP - dmgToBoss);
      if (st.bossHP <= 0) {
        this._nextBoss();
      }
    }

    st.totalHits++;
    target.resolved = true;
    target.hit = true;
    target.hitAt = now;
    target.quality = quality;

    if (target.type === 'decoy') st.rtDecoyList.push(absDt);
    else                         st.rtNormalList.push(absDt);

    if (this.logger && this.logger.logHit) {
      this.logger.logHit({
        id: target.id,
        type: target.type,
        result: quality,
        reactionMs: absDt,
        score: st.score,
        combo: st.combo,
        missCount: st.missCount,
        playerHP: st.playerHP,
        bossIndex: st.bossIndex,
        bossHP: st.bossHP,
        bossPhase: 'play',
        feverActive: st.feverActive,
        extra: {
          spawnAt: target.spawnAt,
          hitAt: now
        }
      });
    }

    if (this.renderer && this.renderer.markHit) {
      this.renderer.markHit(target, quality);
    }

    this._emitUpdate();
  }

  // ---------- main loop ----------

  _loop(now) {
    if (!this._running || !this._state) return;
    this._rafId = requestAnimationFrame(ts => this._loop(ts));

    const st = this._state;
    st.now = now;
    st.elapsedMs = now - st.startedAt;
    st.remainingMs = Math.max(0, this.durationMs - st.elapsedMs);

    // FEVER decay
    const dtSec = 16 / 1000;
    if (!st.feverActive) {
      st.feverCharge = Math.max(
        0,
        st.feverCharge - this.feverDecayPerSec * dtSec
      );
    } else if (now >= st.feverUntil) {
      st.feverActive = false;
    }

    // spawn targets
    while (now >= st.nextSpawnAt) {
      this._spawnTarget(st.nextSpawnAt);
      const nextGap = rand(this.spawnMinMs, this.spawnMaxMs);
      st.nextSpawnAt += nextGap;
    }

    // expire targets
    const lifetime = this.judgeWin.late + 260;
    for (const t of st.targets) {
      if (!t.resolved && now - t.spawnAt > lifetime) {
        t.resolved = true;
        t.expired = true;
        st.missCount++;
        st.combo = 0;
        st.expiredMisses++;

        st.feverCharge = Math.max(0, st.feverCharge - this.feverLossMiss);
        st.playerHP = Math.max(0, st.playerHP - 4);

        if (this.logger && this.logger.logExpire) {
          this.logger.logExpire({
            id: t.id,
            type: t.type,
            result: 'timeout',
            playerHP: st.playerHP,
            bossIndex: st.bossIndex,
            bossHP: st.bossHP,
            feverActive: st.feverActive
          });
        }
        if (this.renderer && this.renderer.markMiss) {
          this.renderer.markMiss(t);
        }
      }
    }

    // check end game
    if (st.remainingMs <= 0) {
      this.stop('timeout');
      return;
    }
    if (st.playerHP <= 0) {
      this.stop('player-dead');
      return;
    }
    if (st.bossIndex >= this.bossList.length) {
      this.stop('boss-cleared');
      return;
    }

    this._emitUpdate();
  }

  _spawnTarget(spawnAt) {
    const st = this._state;
    if (!st) return;

    // จำกัดให้เกิดในกรอบกลาง ๆ  กันหลุดนอก gameplay
    const nx = rand(0.15, 0.85);
    const ny = rand(0.18, 0.82);

    let type = 'main';
    const r = Math.random();
    if (r < this.decoyChance) type = 'decoy';
    else if (r > 1 - this.healChance) type = 'heal';

    const target = {
      id: st.nextTargetId++,
      type,
      nx,
      ny,
      spawnAt,
      resolved: false,
      hit: false,
      expired: false
    };

    st.targets.push(target);
    st.totalSpawns++;

    if (this.logger && this.logger.logSpawn) {
      this.logger.logSpawn({
        id: target.id,
        type: target.type,
        bossIndex: st.bossIndex,
        bossHP: st.bossHP,
        feverActive: st.feverActive,
        extra: { nx, ny }
      });
    }

    if (this.renderer && this.renderer.spawnTarget) {
      this.renderer.spawnTarget(target);
    }
  }

  _nextBoss() {
    const st = this._state;
    if (!st) return;
    st.bossIndex++;
    if (st.bossIndex >= this.bossList.length) {
      // ชนะครบทั้งหมด → ให้ loop ด้านบนตรวจแล้ว stop เป็น boss-cleared
      return;
    }
    const b = this.bossList[st.bossIndex];
    st.bossName  = b.name;
    st.bossEmoji = b.emoji;
    st.bossHP    = b.hp;
    st.bossMaxHP = b.hp;
  }

  _emitUpdate() {
    if (!this.hooks || !this.hooks.onUpdate || !this._state) return;
    const st = this._state;
    this.hooks.onUpdate({
      score: st.score,
      combo: st.combo,
      maxCombo: st.maxCombo,
      missCount: st.missCount,
      perfectHits: st.perfectHits,
      playerHP: st.playerHP,
      remainingMs: st.remainingMs,
      feverCharge: st.feverCharge,
      feverActive: st.feverActive,
      bossIndex: st.bossIndex,
      bossCount: st.bossCount,
      bossName: st.bossName,
      bossEmoji: st.bossEmoji,
      bossHP: st.bossHP,
      bossMaxHP: st.bossMaxHP
    });
  }

  _finish(endedBy) {
    const st = this._state;
    if (!st) return;

    const a = this._buildAnalytics(st);

    const finalState = {
      score: st.score,
      combo: st.combo,
      maxCombo: st.maxCombo,
      missCount: st.missCount,
      playerHP: st.playerHP,
      bossIndex: st.bossIndex,
      elapsedMs: st.elapsedMs,
      endedBy,
      analytics: a
    };

    if (this.logger && this.logger.finish) {
      this.logger.finish(finalState);
    }

    if (this.hooks && this.hooks.onEnd) {
      this.hooks.onEnd(finalState);
    }

    this._state = null;
  }

  _buildAnalytics(st) {
    const mean = arr => arr.length
      ? arr.reduce((s,v)=>s+v,0)/arr.length : 0;
    const std  = arr => {
      if (arr.length < 2) return 0;
      const m = mean(arr);
      const v = arr.reduce((s,v)=>s+(v-m)*(v-m),0)/(arr.length-1);
      return Math.sqrt(v);
    };

    const rtNMean = mean(st.rtNormalList);
    const rtNStd  = std(st.rtNormalList);
    const rtDMean = mean(st.rtDecoyList);

    const accuracy = st.totalSpawns
      ? st.totalHits / st.totalSpawns
      : 0;

    return {
      totalSpawns: st.totalSpawns,
      totalHits:   st.totalHits,
      normalHits:  st.normalHits,
      decoyHits:   st.decoyHits,
      expiredMisses: st.expiredMisses,
      accuracy,
      avgReactionNormal: rtNMean,
      avgReactionDecoy:  rtDMean,
      rtNormalStd:       rtNStd
    };
  }
}