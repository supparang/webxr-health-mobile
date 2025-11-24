// === fitness/js/engine.js (Shadow Breaker Engine — 2025-11-24 MULTI-BOSS) ===
'use strict';

import { computeShadowSpawnParams, ShadowBossState } from './shadow-config.js';

/** ตารางบอส 4 ตัวในหนึ่งเกม (index 0–3) */
const BOSS_TABLE = [
  {
    emoji: '🫧',
    name: 'Bubble Glove',
    hint: 'เล็งเป้าหลักให้ทัน อย่าตีฟองหลอก'
  },
  {
    emoji: '🌀',
    name: 'Vortex Fist',
    hint: 'ระวังลูกล่อที่หมุน ๆ สีคล้ายกัน'
  },
  {
    emoji: '🛡️',
    name: 'Shadow Guard',
    hint: 'รักษาคอมโบให้ยาวที่สุด ห้ามพลาดบ่อย'
  },
  {
    emoji: '☠️',
    name: 'Doom Skull',
    hint: 'ช่วงท้ายจะรัวมาก เตรียมแขนให้พร้อมสุด ๆ'
  }
];

/**
 * initShadowBreaker()
 * - bootstrap หลัก เรียกจาก shadow-breaker.js
 * - อ่าน query string: diff=easy|normal|hard, time=60, next=program.html
 */
export function initShadowBreaker(options = {}) {
  const url = new URL(window.location.href);

  const diffKey = (options.difficulty ||
    url.searchParams.get('diff') ||
    'easy').toLowerCase();

  const durSec = parseInt(
    options.durationSec || url.searchParams.get('time') || '60',
    10
  ) || 60;

  const nextUrl = options.nextUrl || url.searchParams.get('next') || '';

  // ใช้ host จาก options.host ก่อน (เชื่อมกับ shadow-breaker.html → #shadowWrap)
  const host =
    options.host ||
    document.querySelector('#shadow-root') ||
    document.querySelector('#sb-root') ||
    document.querySelector('#sb-game') ||
    document.body;

  const game = new ShadowBreakerGame({
    host,
    difficulty: diffKey,
    durationSec: durSec,
    nextUrl
  });

  game.start();
  return game;
}

// ---------------------------------------------------------------------------
// Utility ฟังก์ชันเล็ก ๆ
// ---------------------------------------------------------------------------
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickWeighted(weights) {
  // weights: {main:number, fake:number, bonus:number}
  const entries = Object.entries(weights);
  const sum = entries.reduce((s, [, w]) => s + (w || 0), 0) || 1;
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= (w || 0);
    if (r <= 0) return k;
  }
  return entries[0]?.[0] || 'main';
}

// ---------------------------------------------------------------------------
// ShadowBreakerGame — core engine
// ---------------------------------------------------------------------------
class ShadowBreakerGame {
  constructor(opts) {
    this.host = opts.host || document.body;
    this.difficulty = opts.difficulty || 'easy';
    this.durationSec = opts.durationSec || 60;
    this.nextUrl = opts.nextUrl || '';

    // ภาพรวมสถานะเกม
    this.running = false;
    this.timeLeft = this.durationSec;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;

    // MULTI-BOSS: ลำดับบอสในหนึ่งเกม (0–3)
    this.bossOrder = [0, 1, 2, 3];
    this.currentBossIdx = 0;           // index ใน bossOrder
    this.bossIndex = this.bossOrder[0];

    this.boss = new ShadowBossState(this.difficulty);
    this.bossPhase = 1;
    this.nearDeath = false;
    this.spawnedBossFace = false;      // ให้ spawn bossface แค่ 1 ครั้งต่อบอส

    this.activeTargets = [];
    this.spawnTimer = null;
    this.timerTick = null;

    // hook เผื่อใช้ต่อยอดงานใหญ่ 2/3
    this.onBeforeSpawnTarget = null;
    this.onBossHit = null;

    // DOM elements
    this.elRoot = null;
    this.elStage = null;
    this.elHUD = {};
    this._bindDOMFromLayout();         // ใช้ layout จาก shadow-breaker.html
  }

  // -----------------------------------------------------------------------
  // DOM & HUD — ใช้ layout จาก shadow-breaker.html (sb-wrap)
  // -----------------------------------------------------------------------
  _bindDOMFromLayout() {
    // root = .sb-wrap (#shadowWrap) ถ้ามี
    const root =
      this.host.closest('.sb-wrap') ||
      this.host.querySelector?.('.sb-wrap') ||
      this.host;

    this.elRoot = root;

    // เวทีเกม: data-sb-field / .sb-field / ถ้าไม่มี ใช้ root
    this.elStage =
      root.querySelector('[data-sb-field]') ||
      root.querySelector('.sb-field') ||
      root;

    const q = (sel) => root.querySelector(sel);

    // ผูก HUD ตาม data-attribute ใน shadow-breaker.html
    this.elHUD.barPlayer      = q('[data-sb-player-hp]');
    this.elHUD.playerHPText   = q('[data-sb-player-hp-text]');
    this.elHUD.barBoss        = q('[data-sb-boss-hp]');
    this.elHUD.bossHPText     = q('[data-sb-boss-hp-text]');
    this.elHUD.timerVal       = q('[data-sb-timer]');
    this.elHUD.scoreVal       = q('[data-sb-score]');
    this.elHUD.comboVal       = q('[data-sb-combo]');
    this.elHUD.phaseVal       = q('[data-sb-phase]');
    // ถ้ามี FEVER/HUD อื่นในอนาคต ค่อยผูกเพิ่ม

    this._updateHUDAll();
  }

  _pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  _updateHUDAll() {
    this._updateTimerHUD();
    this._updateScoreHUD();
    this._updateComboHUD();
    this._updatePlayerHPHUD();
    this._updateBossHPHUD();
    this._updatePhaseHUD();
  }

  _updateTimerHUD() {
    if (!this.elHUD.timerVal) return;
    const sec = Math.max(0, Math.floor(this.timeLeft));
    this.elHUD.timerVal.textContent = `00:${this._pad(sec)}`;
  }

  _updateScoreHUD() {
    if (this.elHUD.scoreVal) {
      this.elHUD.scoreVal.textContent = this.score.toString();
    }
  }

  _updateComboHUD() {
    if (this.elHUD.comboVal) {
      this.elHUD.comboVal.textContent = this.combo.toString();
    }
  }

  _updatePhaseHUD() {
    if (this.elHUD.phaseVal) {
      this.elHUD.phaseVal.textContent = String(this.bossPhase);
    }
  }

  _updatePlayerHPHUD() {
    const ratio = this.playerMaxHP > 0 ? (this.playerHP / this.playerMaxHP) : 0;
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.elHUD.barPlayer) {
      // layout ใหม่ใช้ transform: scaleX
      this.elHUD.barPlayer.style.transform = `scaleX(${clamped})`;
      this.elHUD.barPlayer.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.playerHPText) {
      this.elHUD.playerHPText.textContent =
        `${this.playerHP}/${this.playerMaxHP}`;
    }
  }

  _updateBossHPHUD() {
    const ratio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.elHUD.barBoss) {
      this.elHUD.barBoss.style.transform = `scaleX(${clamped})`;
      this.elHUD.barBoss.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.bossHPText) {
      this.elHUD.bossHPText.textContent = `${this.boss.hp}/${this.boss.maxHP}`;
    }
  }

  // -----------------------------------------------------------------------
  // Multi-boss helpers
  // -----------------------------------------------------------------------
  _resetBossForCurrent() {
    this.boss = new ShadowBossState(this.difficulty);
    this.bossPhase = 1;
    this.nearDeath = false;
    this.spawnedBossFace = false;
    this._updateBossHPHUD();
    this._updatePhaseHUD();
  }

  _onBossDown() {
    // ยังมีบอสตัวถัดไปในลำดับ
    if (this.currentBossIdx < this.bossOrder.length - 1) {
      this.currentBossIdx += 1;
      this.bossIndex = this.bossOrder[this.currentBossIdx] || 0;
      this._resetBossForCurrent();
      // (ถ้าอยากผูก portrait / hint เพิ่มในอนาคต จะใช้ BOSS_TABLE[this.bossIndex])
    } else {
      // เคลียร์ครบ 4 ตัว
      this.endGame('bossDownAll');
    }
  }

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;

    this.timeLeft = this.durationSec;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.playerHP = this.playerMaxHP;

    // เริ่มจากบอส 1 เสมอ
    this.currentBossIdx = 0;
    this.bossIndex = this.bossOrder[0] || 0;
    this._resetBossForCurrent();

    this._updateHUDAll();
    this._startTimer();
    this._spawnLoop();
  }

  _startTimer() {
    if (this.timerTick) clearInterval(this.timerTick);
    this.timerTick = setInterval(() => {
      if (!this.running) return;
      this.timeLeft -= 1;
      this._updateTimerHUD();
      if (this.timeLeft <= 0) {
        this.endGame('timeup');
      }
    }, 1000);
  }

  _spawnLoop() {
    if (!this.running) return;

    // hook ภายนอก (เช่น เพื่อให้ logger ทำงาน / HUD effect)
    if (typeof this.onBeforeSpawnTarget === 'function') {
      this.onBeforeSpawnTarget();
    }

    const bossRatio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    let params = computeShadowSpawnParams(this.difficulty, bossRatio);

    // เพิ่มความยากตามลำดับบอส (stage 0–3)
    const stage = this.currentBossIdx;
    const stageSpeedFactor = [1.0, 0.9, 0.8, 0.7][stage] || 1.0;
    const stageMaxBonus    = [0,   1,   2,   2][stage] || 0;

    params = {
      ...params,
      spawnInterval: Math.round(params.spawnInterval * stageSpeedFactor),
      maxActive: params.maxActive + stageMaxBonus
    };

    this.bossPhase = params.phase;
    this.nearDeath = params.nearDeath;
    this._updatePhaseHUD();

    // จำกัดจำนวนเป้า active
    if (this.activeTargets.length < params.maxActive) {
      this._spawnOneTarget(params);
    }

    // ตั้ง spawn รอบต่อไป
    this.spawnTimer = setTimeout(() => this._spawnLoop(), params.spawnInterval);
  }

  _spawnOneTarget(params) {
    const stageEl = this.elStage || this.host;
    if (!stageEl) return;

    const targetType = pickWeighted(params.weights); // main / fake / bonus
    const [minSize, maxSize] = params.sizePx;
    const size = randBetween(minSize, maxSize);

    const el = document.createElement('div');
    el.className = `sb-target sb-target-${targetType}`;

    // emoji / สัญลักษณ์เบื้องต้น (ไว้ให้ CSS ตกแต่งต่อ)
    if (targetType === 'main') {
      el.textContent = '🎯';
    } else if (targetType === 'fake') {
      el.textContent = '💣';
    } else {
      el.textContent = '⭐';
    }

    // ตำแหน่งแบบสุ่มใน stage (เว้นขอบ)
    const pad = 12; // px
    const rect = stageEl.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 320;

    const maxX = Math.max(0, w - size - pad);
    const maxY = Math.max(0, h - size - pad);

    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // meta object
    const target = {
      el,
      type: targetType,
      lifeTimer: null,
      hit: false
    };

    // event: pointerdown (รองรับ mouse + touch)
    const onHit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._handleTargetHit(target);
    };

    el.addEventListener('pointerdown', onHit, { passive: false });

    target.cleanup = () => {
      el.removeEventListener('pointerdown', onHit);
      if (el.parentNode === stageEl) stageEl.removeChild(el);
    };

    // ตั้งเวลาให้เป้าหายเองถ้าไม่โดนตี
    target.lifeTimer = setTimeout(() => {
      if (!target.hit) {
        this._handleTargetMiss(target);
      }
    }, params.lifetime);

    stageEl.appendChild(el);
    this.activeTargets.push(target);
  }

  /** เป้าหน้าบอสตอนใกล้ตาย */
  _spawnBossFaceTarget(params) {
    const stageEl = this.elStage || this.host;
    if (!stageEl) return;

    const rect = stageEl.getBoundingClientRect();
    const baseSize = params.sizePx ? params.sizePx[1] : 96;
    const size = baseSize * 1.1;

    const pad = 24;
    const maxX = Math.max(0, rect.width  - size - pad);
    const maxY = Math.max(0, rect.height - size - pad);

    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    const el = document.createElement('div');
    el.className = 'sb-target sb-target-bossface';
    el.dataset.type = 'bossface';

    const boss = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    el.textContent = boss.emoji || '☠️';

    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    const target = {
      el,
      type: 'bossface',
      lifeTimer: null,
      hit: false
    };

    const onHit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._handleTargetHit(target);
    };

    el.addEventListener('pointerdown', onHit, { passive: false });

    target.cleanup = () => {
      el.removeEventListener('pointerdown', onHit);
      if (el.parentNode === stageEl) stageEl.removeChild(el);
    };

    // อยู่ไม่นานมาก
    const life = (params.lifetime || 2000) * 0.7;
    target.lifeTimer = setTimeout(() => {
      if (!target.hit) this._handleTargetMiss(target);
    }, life);

    stageEl.appendChild(el);
    this.activeTargets.push(target);
  }

  _handleTargetHit(target) {
    if (!this.running) return;
    if (target.hit) return;
    target.hit = true;

    // ลบออกจาก active list
    this._removeTarget(target);

    if (target.lifeTimer) {
      clearTimeout(target.lifeTimer);
      target.lifeTimer = null;
    }

    // ตีโดน
    if (target.type === 'fake') {
      // ตีโดนเป้าหลอก → ตัด HP ผู้เล่น
      this.playerHP = Math.max(0, this.playerHP - 1);
      this.combo = 0;
      this._updatePlayerHPHUD();
      this._updateComboHUD();
      if (this.playerHP <= 0) {
        this.endGame('playerDead');
        return;
      }
    } else if (target.type === 'bossface') {
      // ตีหน้า Boss — ดาเมจแรง + คะแนนเยอะ
      const scoreGain = 30;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      this.score += scoreGain;
      this._updateScoreHUD();
      this._updateComboHUD();

      const dmg = 3;
      this._applyBossDamage(dmg);
    } else {
      // main / bonus
      let scoreGain = 10;
      if (target.type === 'bonus') scoreGain = 20;

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // เพิ่มคะแนนตาม combo เล็กน้อย
      const bonus = Math.floor(this.combo / 5) * 2;
      this.score += scoreGain + bonus;

      this._updateScoreHUD();
      this._updateComboHUD();

      // ดาเมจบอสเมื่อโดน main/bonus
      const dmg = target.type === 'bonus' ? 2 : 1;
      this._applyBossDamage(dmg);
    }

    // effect visual (ให้ CSS ไปจัดการต่อจาก class sb-hit ถ้ามี)
    target.el.classList.add('sb-hit');
    setTimeout(() => {
      if (target.cleanup) target.cleanup();
    }, 120);
  }

  _handleTargetMiss(target) {
    if (!this.running) return;
    if (target.hit) return;

    this._removeTarget(target);
    if (target.lifeTimer) {
      clearTimeout(target.lifeTimer);
      target.lifeTimer = null;
    }

    // เป้าหลักหายไปโดยไม่ตี → combo หลุด
    if (target.type === 'main' || target.type === 'bossface') {
      this.combo = 0;
      this._updateComboHUD();
    }

    if (target.cleanup) target.cleanup();
  }

  _removeTarget(target) {
    const idx = this.activeTargets.indexOf(target);
    if (idx >= 0) this.activeTargets.splice(idx, 1);
  }

  _applyBossDamage(dmg) {
    if (typeof this.onBossHit === 'function') {
      // ถ้าภายนอกอยากจัดการเอง
      this.onBossHit(dmg);
      return;
    }

    const info = this.boss.hit(dmg);
    this.bossPhase = info.phase;
    this.nearDeath = info.nearDeath;
    this._updateBossHPHUD();
    this._updatePhaseHUD();

    // ใกล้ตาย → spawn เป้าหน้าบอส 1 ครั้งต่อบอส
    const ratio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    if (!this.spawnedBossFace && ratio <= 0.25) {
      const params = computeShadowSpawnParams(this.difficulty, ratio);
      this._spawnBossFaceTarget(params);
      this.spawnedBossFace = true;
    }

    if (info.hp <= 0) {
      this._onBossDown();
    }
  }

  // -----------------------------------------------------------------------
  // จบเกม
  // -----------------------------------------------------------------------
  endGame(reason = 'timeup') {
    if (!this.running) return;
    this.running = false;

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
    if (this.timerTick) {
      clearInterval(this.timerTick);
      this.timerTick = null;
    }

    // ล้างเป้าทั้งหมด
    this.activeTargets.forEach(t => {
      if (t.lifeTimer) clearTimeout(t.lifeTimer);
      if (t.cleanup) t.cleanup();
    });
    this.activeTargets.length = 0;

    const titleMap = {
      timeup:      'หมดเวลา',
      bossDown:    'ชนะบอส!',
      bossDownAll: 'ชนะบอสครบ 4 ตัว! 🎉',
      playerDead:  'พลังชีวิตหมด'
    };
    const title = titleMap[reason] || 'จบเกม';

    const msg = [
      `${title}`,
      `SCORE: ${this.score}`,
      `MAX COMBO: ${this.maxCombo}`,
      `BOSS ที่เล่นถึง: ${this.currentBossIdx + 1}/${this.bossOrder.length}`,
      `BOSS HP สุดท้าย: ${this.boss.hp}/${this.boss.maxHP}`
    ].join('\n');

    // ถ้ามี overlay ใน HTML ของคุณเอง ให้ใช้ต่อแทน alert ตรงนี้ได้
    window.alert(msg);

    // ถ้ามี nextUrl ให้ redirect ต่อ
    if (this.nextUrl) {
      window.location.href = this.nextUrl;
    }
  }
}

export { ShadowBreakerGame };
