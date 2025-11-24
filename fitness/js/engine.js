// === fitness/js/engine.js (Shadow Breaker Engine — 2025-11-24) ===
'use strict';

import { computeShadowSpawnParams, ShadowBossState } from './shadow-config.js';

/**
 * initShadowBreaker()
 * - bootstrap หลัก เรียกจาก shadow-breaker.js
 * - อ่าน query string: diff=easy|normal|hard, time=60, next=program.html
 */
export function initShadowBreaker(options = {}) {
  const url = new URL(window.location.href);

  const diffKey = options.difficulty ||
    url.searchParams.get('diff') ||
    'easy';

  const durSec = parseInt(
    options.durationSec || url.searchParams.get('time') || '60',
    10
  ) || 60;

  const nextUrl = options.nextUrl || url.searchParams.get('next') || '';

  // หา host ถ้ามี id ตามนี้ก่อน ถ้าไม่มีก็ใช้ body
  const host =
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

    this.boss = new ShadowBossState(this.difficulty);
    this.bossPhase = 1;
    this.nearDeath = false;

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
    this._createDOM();
  }

  // -----------------------------------------------------------------------
  // DOM & HUD
  // -----------------------------------------------------------------------
  _createDOM() {
    // ถ้า host มี data-shadow-ready ให้ถือว่าเขา set layout เองแล้ว
    if (this.host.dataset && this.host.dataset.shadowReady === '1') {
      this.elRoot = this.host;
      this.elStage = this.host.querySelector('.sb-stage') || this.host;
    } else {
      // สร้าง wrapper ใหม่
      this.elRoot = document.createElement('div');
      this.elRoot.className = 'sb-root';
      this.host.appendChild(this.elRoot);

      // HUD ด้านบน
      const hud = document.createElement('div');
      hud.className = 'sb-hud';
      hud.innerHTML = `
        <div class="sb-hud-row sb-hud-row-top">
          <div class="sb-hp-wrap">
            <span class="sb-label">PLAYER</span>
            <div class="sb-hp-bar">
              <div class="sb-hp-fill" style="width:100%"></div>
            </div>
          </div>
          <div class="sb-timer-wrap">
            <span class="sb-label">TIME</span>
            <span class="sb-timer-val">00:${this._pad(this.timeLeft)}</span>
          </div>
          <div class="sb-boss-wrap">
            <span class="sb-label">BOSS</span>
            <div class="sb-hp-bar sb-boss-bar">
              <div class="sb-hp-fill sb-boss-fill" style="width:100%"></div>
            </div>
          </div>
        </div>
        <div class="sb-hud-row sb-hud-row-bottom">
          <div class="sb-score-wrap">
            <span class="sb-label">SCORE</span>
            <span class="sb-score-val">0</span>
          </div>
          <div class="sb-combo-wrap">
            <span class="sb-label">COMBO</span>
            <span class="sb-combo-val">0</span>
          </div>
          <div class="sb-phase-wrap">
            <span class="sb-label">PHASE</span>
            <span class="sb-phase-val">1</span>
          </div>
        </div>
      `;
      this.elRoot.appendChild(hud);

      // Stage กลางจอ
      const stage = document.createElement('div');
      stage.className = 'sb-stage';
      this.elRoot.appendChild(stage);

      this.elStage = stage;
      this.elHUD.barPlayer = hud.querySelector('.sb-hp-fill');
      this.elHUD.barBoss = hud.querySelector('.sb-boss-fill');
      this.elHUD.timerVal = hud.querySelector('.sb-timer-val');
      this.elHUD.scoreVal = hud.querySelector('.sb-score-val');
      this.elHUD.comboVal = hud.querySelector('.sb-combo-val');
      this.elHUD.phaseVal = hud.querySelector('.sb-phase-val');
    }

    // เผื่อกรณี host มี HUD ของตัวเองอยู่แล้ว
    this.elHUD.barPlayer = this.elHUD.barPlayer ||
      this.host.querySelector('.sb-hp-fill');
    this.elHUD.barBoss = this.elHUD.barBoss ||
      this.host.querySelector('.sb-boss-fill');
    this.elHUD.timerVal = this.elHUD.timerVal ||
      this.host.querySelector('.sb-timer-val');
    this.elHUD.scoreVal = this.elHUD.scoreVal ||
      this.host.querySelector('.sb-score-val');
    this.elHUD.comboVal = this.elHUD.comboVal ||
      this.host.querySelector('.sb-combo-val');
    this.elHUD.phaseVal = this.elHUD.phaseVal ||
      this.host.querySelector('.sb-phase-val');

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
    if (!this.elHUD.barPlayer) return;
    const ratio = this.playerMaxHP > 0 ? (this.playerHP / this.playerMaxHP) : 0;
    this.elHUD.barPlayer.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.elHUD.barPlayer.classList.toggle('low', ratio <= 0.4);
  }

  _updateBossHPHUD() {
    if (!this.elHUD.barBoss) return;
    const ratio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    this.elHUD.barBoss.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.elHUD.barBoss.classList.toggle('low', ratio <= 0.4);
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
    const params = computeShadowSpawnParams(this.difficulty, bossRatio);

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
    const stage = this.elStage || this.host;
    if (!stage) return;

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
    const rect = stage.getBoundingClientRect();
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
      if (el.parentNode === stage) stage.removeChild(el);
    };

    // ตั้งเวลาให้เป้าหายเองถ้าไม่โดนตี
    target.lifeTimer = setTimeout(() => {
      if (!target.hit) {
        this._handleTargetMiss(target);
      }
    }, params.lifetime);

    stage.appendChild(el);
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

    // เผื่ออยากให้เป้ามี effect ตอนโดน ตรงนี้ใส่ class ได้
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
    if (target.type === 'main') {
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

    if (info.hp <= 0) {
      this.endGame('bossDown');
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

    // Summary popup แบบง่าย (คุณจะไปทำ UI สวย ๆ ต่อภายหลังได้)
    const titleMap = {
      timeup: 'หมดเวลา',
      bossDown: 'ชนะบอส!',
      playerDead: 'พลังชีวิตหมด'
    };
    const title = titleMap[reason] || 'จบเกม';

    const msg = [
      `${title}`,
      `SCORE: ${this.score}`,
      `MAX COMBO: ${this.maxCombo}`,
      `BOSS HP: ${this.boss.hp}/${this.boss.maxHP}`
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
