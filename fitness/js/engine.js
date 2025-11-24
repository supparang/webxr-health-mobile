// === fitness/js/engine.js — Shadow Breaker Engine (Multi-Boss, Research-Ready) ===
'use strict';

/* ---------------------------------------------------------
   CONFIG: ความยาก + บอส + phase + near-death
--------------------------------------------------------- */

const SHADOW_DIFF_TABLE = {
  easy: {
    label: 'โหมดง่าย',
    target: {
      spawnIntervalMs: [950, 850, 750],   // phase 1–3
      lifetimeMs:      [2400, 2200, 2000],
      maxActive:       [3, 4, 5],
      sizePx:          [80, 110]          // min, max
    },
    boss: {
      maxHP: 40,
      phaseThresholds: [0.7, 0.35],       // เปลี่ยนเฟสที่ 70% และ 35%
      nearDeathPct: 0.25,
      nearDeathBoost: {
        spawnIntervalFactor: 0.8,         // เร็วขึ้นเมื่อใกล้ตาย
        maxActiveBonus: 1
      }
    },
    weights: { main: 78, fake: 10, bonus: 12 },
    defaultBossOrder: [0, 1, 2, 3]
  },
  normal: {
    label: 'โหมดปกติ',
    target: {
      spawnIntervalMs: [850, 750, 650],
      lifetimeMs:      [2200, 2000, 1900],
      maxActive:       [4, 5, 6],
      sizePx:          [72, 100]
    },
    boss: {
      maxHP: 60,
      phaseThresholds: [0.75, 0.4],
      nearDeathPct: 0.25,
      nearDeathBoost: {
        spawnIntervalFactor: 0.7,
        maxActiveBonus: 1
      }
    },
    weights: { main: 70, fake: 18, bonus: 12 },
    defaultBossOrder: [0, 1, 2, 3]
  },
  hard: {
    label: 'โหมดยาก',
    target: {
      spawnIntervalMs: [780, 680, 580],
      lifetimeMs:      [2000, 1850, 1700],
      maxActive:       [5, 6, 7],
      sizePx:          [64, 92]
    },
    boss: {
      maxHP: 80,
      phaseThresholds: [0.8, 0.45],
      nearDeathPct: 0.30,
      nearDeathBoost: {
        spawnIntervalFactor: 0.65,
        maxActiveBonus: 2
      }
    },
    weights: { main: 64, fake: 24, bonus: 12 },
    defaultBossOrder: [0, 1, 2, 3]
  }
};

/**
 * Boss ทั้ง 4 ตัวในหนึ่งเกม
 * index: 0–3 ใช้ร่วมกับ data-boss ใน .sb-wrap และ CSS ปุ่ม/พื้นหลัง
 */
const BOSS_TABLE = [
  {
    emoji: '🫧',
    name: 'Bubble Glove',
    title: 'หมัดฟองอากาศ',
    hint: 'เล็งเป้าหลักให้ทัน อย่าตีฟองหลอก',
  },
  {
    emoji: '🌀',
    name: 'Vortex Fist',
    title: 'หมัดวังวนหมุนติ้ว',
    hint: 'ระวังลูกล่อที่หมุน ๆ สีคล้ายกัน',
  },
  {
    emoji: '🛡️',
    name: 'Shadow Guard',
    title: 'ยามเงามืด',
    hint: 'รักษาคอมโบให้ยาวที่สุด ห้ามพลาดบ่อย',
  },
  {
    emoji: '☠️',
    name: 'Doom Skull',
    title: 'กะโหลกมหาภัย',
    hint: 'ช่วงท้ายจะรัวมาก เตรียมแขนให้พร้อมสุด ๆ',
  }
];

/**
 * คำนวณพารามิเตอร์ spawn ตาม:
 * - diffKey: easy / normal / hard
 * - bossHpRatio: HP เหลือ (%) ของบอสตัวปัจจุบัน
 * - bossStageIndex: ลำดับบอสในเกม (0 = ตัวแรก, …, 3 = ตัวสุดท้าย)
 */
function computeSpawnParams(diffKey, bossHpRatio, bossStageIndex = 0) {
  const cfg = SHADOW_DIFF_TABLE[diffKey] || SHADOW_DIFF_TABLE.normal;
  const t = cfg.target;
  const b = cfg.boss;

  let phase = 1;
  if (bossHpRatio <= b.phaseThresholds[1]) phase = 3;
  else if (bossHpRatio <= b.phaseThresholds[0]) phase = 2;

  const idx = phase - 1;

  // ยิ่งบอสหลัง ๆ ยิ่งเร็ว/แน่นขึ้น
  const stage = Math.max(0, Math.min(3, bossStageIndex | 0));
  const stageSpeedFactor = [1.0, 0.9, 0.8, 0.7][stage];
  const stageMaxBonus    = [0,   1,   2,   2][stage];

  let spawnInterval = t.spawnIntervalMs[idx];
  let lifetime      = t.lifetimeMs[idx];
  let maxActive     = t.maxActive[idx];

  spawnInterval = Math.round(spawnInterval * stageSpeedFactor);
  maxActive += stageMaxBonus;

  const nearDeath = bossHpRatio <= b.nearDeathPct;
  if (nearDeath) {
    spawnInterval = Math.round(spawnInterval * b.nearDeathBoost.spawnIntervalFactor);
    maxActive += b.nearDeathBoost.maxActiveBonus;
  }

  return {
    phase,
    nearDeath,
    spawnInterval,
    lifetime,
    maxActive,
    sizePx: t.sizePx,
    weights: cfg.weights,
    bossMaxHP: b.maxHP
  };
}

/* ---------------------------------------------------------
   Boss HP state
--------------------------------------------------------- */

class ShadowBossState {
  constructor(diffKey) {
    const cfg = SHADOW_DIFF_TABLE[diffKey] || SHADOW_DIFF_TABLE.normal;
    this.diffKey = diffKey;
    this.maxHP = cfg.boss.maxHP;
    this.hp = this.maxHP;
    this.phase = 1;
    this.nearDeath = false;
  }

  hit(dmg) {
    const prevPhase = this.phase;
    const prevNear = this.nearDeath;

    this.hp = Math.max(0, this.hp - Math.max(1, dmg | 0));
    const ratio = this.maxHP > 0 ? this.hp / this.maxHP : 0;

    const cfg = SHADOW_DIFF_TABLE[this.diffKey] || SHADOW_DIFF_TABLE.normal;
    const b = cfg.boss;

    if (ratio <= b.phaseThresholds[1]) this.phase = 3;
    else if (ratio <= b.phaseThresholds[0]) this.phase = 2;
    else this.phase = 1;

    this.nearDeath = ratio <= b.nearDeathPct;

    return {
      hp: this.hp,
      ratio,
      phase: this.phase,
      phaseChanged: this.phase !== prevPhase,
      nearDeath: this.nearDeath,
      nearDeathChanged: this.nearDeath !== prevNear
    };
  }
}

/* ---------------------------------------------------------
   UTIL
--------------------------------------------------------- */

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const sum = entries.reduce((s, [, w]) => s + (w || 0), 0) || 1;
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= (w || 0);
    if (r <= 0) return k;
  }
  return entries[0]?.[0] || 'main';
}

/* ---------------------------------------------------------
   MAIN ENGINE
--------------------------------------------------------- */

class ShadowBreakerGame {
  constructor(opts) {
    this.host = opts.host || document.querySelector('.sb-wrap') || document.body;
    this.diffKey = opts.difficulty || 'normal';
    this.durationSec = opts.durationSec || 60;

    const diffCfg = SHADOW_DIFF_TABLE[this.diffKey] || SHADOW_DIFF_TABLE.normal;

    // ลำดับบอสในเกมนี้ (0–3)
    this.bossOrder = opts.bossOrder || diffCfg.defaultBossOrder.slice();
    this.currentBossIdx = 0;                      // index สดของลำดับบอส
    this.bossIndex = this.bossOrder[0] || 0;      // index ใน BOSS_TABLE

    this.lastSpawnParams = null;

    // เกมเพลย์พื้นฐาน
    this.running = false;
    this.timeLeft = this.durationSec;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;

    this.boss = new ShadowBossState(this.diffKey);

    // timers
    this.spawnTimer = null;
    this.timerTick = null;
    this.activeTargets = [];

    // DOM refs
    this.elRoot = null;
    this.elField = null;
    this.elGuide = null;
    this.elHUD = {};
    this.elBossPortrait = null;
    this.elBossName = null;
    this.elBossHint = null;
    this.elBossIntro = null;
    this.elBossIntroEmoji = null;
    this.elBossIntroName = null;
    this.elBossIntroTitle = null;
    this.elBossIntroDesc = null;
    this.elBossIntroHint = null;

    this._bindDOM();
    this._setupBossUIForIndex(this.bossIndex);
    this._updateHUDAll();
  }

  /* ---------- DOM binding & setup ---------- */

  _bindDOM() {
    const root = this.host.closest('.sb-wrap') || this.host;
    this.elRoot = root;

    // dataset เริ่มต้น
    if (root) {
      root.dataset.diff = this.diffKey;
      root.dataset.phase = '1';
      root.dataset.boss = String(this.bossIndex);
    }

    // field
    this.elField =
      root.querySelector('[data-sb-field]') ||
      root.querySelector('.sb-field') ||
      root;

    this.elGuide = this.elField.querySelector('.sb-field-guide');

    const q = (sel) => root.querySelector(sel);

    // HUD
    this.elHUD.playerBar     = q('[data-sb-player-hp]');
    this.elHUD.playerHPText  = q('[data-sb-player-hp-text]');
    this.elHUD.bossBar       = q('[data-sb-boss-hp]');
    this.elHUD.bossHPText    = q('[data-sb-boss-hp-text]');
    this.elHUD.timer         = q('[data-sb-timer]');
    this.elHUD.score         = q('[data-sb-score]');
    this.elHUD.combo         = q('[data-sb-combo]');
    this.elHUD.phase         = q('[data-sb-phase]');
    this.elHUD.feverFill     = q('[data-sb-fever]');
    this.elHUD.feverStatus   = q('[data-sb-fever-status]');
    this.elHUD.feedback      = document.getElementById('sbFeedback');

    // boss portrait
    this.elBossPortrait = document.getElementById('boss-portrait');
    this.elBossName     = document.getElementById('boss-portrait-name');
    this.elBossHint     = document.getElementById('boss-portrait-hint');

    // boss intro overlay
    this.elBossIntro = document.getElementById('bossIntro');
    if (this.elBossIntro) {
      this.elBossIntroEmoji = this.elBossIntro.querySelector('.boss-intro-emoji');
      this.elBossIntroName  = this.elBossIntro.querySelector('.boss-intro-name');
      this.elBossIntroTitle = this.elBossIntro.querySelector('.boss-intro-title');
      this.elBossIntroDesc  = this.elBossIntro.querySelector('.boss-intro-desc');
      this.elBossIntroHint  = this.elBossIntro.querySelector('.boss-intro-hint');
    }
  }

  _setupBossUIForIndex(bossIndex) {
    const root = this.elRoot || this.host;
    const boss = BOSS_TABLE[bossIndex] || BOSS_TABLE[0];

    this.bossIndex = bossIndex;

    if (root) {
      root.dataset.boss = String(bossIndex);
    }

    // portrait มุมขวา
    if (this.elBossPortrait) this.elBossPortrait.textContent = boss.emoji;
    if (this.elBossName)     this.elBossName.textContent     = boss.name;
    if (this.elBossHint)     this.elBossHint.textContent     = boss.hint;

    // boss intro overlay
    if (this.elBossIntroEmoji) this.elBossIntroEmoji.textContent = boss.emoji;
    if (this.elBossIntroName)  this.elBossIntroName.textContent  = boss.name;
    if (this.elBossIntroTitle) this.elBossIntroTitle.textContent = boss.title;
    if (this.elBossIntroDesc) {
      this.elBossIntroDesc.textContent =
        'เตรียมแขนให้พร้อม ตีเป้าให้ทันก่อนมันหายไป!';
    }
    if (this.elBossIntroHint)  this.elBossIntroHint.textContent  = boss.hint;
  }

  _pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  _updateHUDAll() {
    this._updateTimerHUD();
    this._updateScoreHUD();
    this._updateComboHUD();
    this._updatePlayerHPHUD();
    this._updateBossHPHUD(1);
    this._updatePhaseHUD(1);
  }

  _updateTimerHUD() {
    if (!this.elHUD.timer) return;
    const sec = Math.max(0, Math.floor(this.timeLeft));
    this.elHUD.timer.textContent = `00:${this._pad(sec)}`;
  }

  _updateScoreHUD() {
    if (this.elHUD.score) this.elHUD.score.textContent = String(this.score);
  }

  _updateComboHUD() {
    if (this.elHUD.combo) this.elHUD.combo.textContent = String(this.combo);
  }

  _updatePhaseHUD(phase) {
    if (this.elHUD.phase) this.elHUD.phase.textContent = String(phase);
    if (this.elRoot) this.elRoot.dataset.phase = String(phase);
  }

  _updatePlayerHPHUD() {
    const ratio = this.playerMaxHP > 0 ? this.playerHP / this.playerMaxHP : 0;
    const clamped = Math.max(0, Math.min(1, ratio));

    if (this.elHUD.playerBar) {
      this.elHUD.playerBar.style.transform = `scaleX(${clamped})`;
      this.elHUD.playerBar.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.playerHPText) {
      this.elHUD.playerHPText.textContent = `${this.playerHP}/${this.playerMaxHP}`;
    }
  }

  _updateBossHPHUD(ratio) {
    const r = (typeof ratio === 'number')
      ? ratio
      : (this.boss.maxHP > 0 ? this.boss.hp / this.boss.maxHP : 0);

    const clamped = Math.max(0, Math.min(1, r));

    if (this.elHUD.bossBar) {
      this.elHUD.bossBar.style.transform = `scaleX(${clamped})`;
      this.elHUD.bossBar.classList.toggle('low', r <= 0.4);
    }
    if (this.elHUD.bossHPText) {
      this.elHUD.bossHPText.textContent = `${this.boss.hp}/${this.boss.maxHP}`;
    }

    // near-death shake
    if (this.elBossPortrait) {
      this.elBossPortrait.classList.toggle('sb-shake', r <= 0.25);
    }
  }

  /* ---------- Boss state per stage ---------- */

  _createBossStateForCurrent() {
    const diffKey = this.diffKey || 'normal';
    const bossIndex = this.bossOrder[this.currentBossIdx] || 0;

    this.bossIndex = bossIndex;
    this.boss = new ShadowBossState(diffKey); // ใช้ HP ตาม diff เดิม

    this._setupBossUIForIndex(bossIndex);
    this._updateBossHPHUD(1);
    this._updatePhaseHUD(1);
  }

  _onBossDown() {
    // ยังมีบอสตัวถัดไป → ไปต่อ
    if (this.currentBossIdx < this.bossOrder.length - 1) {
      this.currentBossIdx += 1;
      this._createBossStateForCurrent();

      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent =
          `เยี่ยมมาก! ผ่านบอสตัวที่ ${this.currentBossIdx} แล้ว 🎉`;
        this.elHUD.feedback.className = 'sb-feedback good';
      }

      // intro บอสตัวใหม่
      if (this.elBossIntro) {
        this.elBossIntro.classList.remove('hidden');
        setTimeout(() => {
          this.elBossIntro.classList.add('hidden');
        }, 1500);
      }
    } else {
      // เคลียร์ครบ 4 ตัว
      this.endGame('bossDownAll');
    }
  }

  /* ---------- main flow ---------- */

  start() {
    if (this.running) return;
    this.running = true;

    this.timeLeft = this.durationSec;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.playerHP = this.playerMaxHP;

    // เริ่มบอสตัวแรกในลำดับ
    this.currentBossIdx = 0;
    this._createBossStateForCurrent();

    this._updateHUDAll();

    // intro แรก
    if (this.elBossIntro) {
      this.elBossIntro.classList.remove('hidden');
      setTimeout(() => {
        this.elBossIntro.classList.add('hidden');
      }, 1500);
    }

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

    const ratio = this.boss.maxHP > 0 ? this.boss.hp / this.boss.maxHP : 0;
    const params = computeSpawnParams(this.diffKey, ratio, this.currentBossIdx);

    this.lastSpawnParams = params;

    this._updatePhaseHUD(params.phase);
    this._updateBossHPHUD(ratio);

    if (this.activeTargets.length < params.maxActive) {
      this._spawnOneTarget(params);
    }

    this.spawnTimer = setTimeout(() => this._spawnLoop(), params.spawnInterval);
  }

  _spawnOneTarget(params) {
    const field = this.elField || this.elRoot;
    const rect = field.getBoundingClientRect();
    const [minSize, maxSize] = params.sizePx;
    const size = randBetween(minSize, maxSize);

    const typeKey = pickWeighted(params.weights); // main / fake / bonus
    const el = document.createElement('div');
    el.className = 'sb-target';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    el.appendChild(inner);

    let emoji = '🎯';
    if (typeKey === 'fake') emoji = '💣';
    else if (typeKey === 'bonus') emoji = '⭐';

    inner.textContent = emoji;

    if (typeKey === 'fake') {
      el.dataset.type = 'fake';
    } else if (typeKey === 'bonus') {
      el.dataset.type = 'bonus';
    } else {
      el.dataset.type = 'main';
    }

    // ตำแหน่งแบบสุ่มใน field
    const pad = 18;
    const maxX = rect.width - size - pad;
    const maxY = rect.height - size - pad;
    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;

    const targetObj = {
      el,
      type: typeKey,
      hit: false,
      lifeTimer: null,
      cleanup: null
    };

    const onHit = (ev) => {
      ev.preventDefault();
      this._handleTargetHit(targetObj, x, y);
    };

    el.addEventListener('pointerdown', onHit, { passive: false });

    targetObj.cleanup = () => {
      el.removeEventListener('pointerdown', onHit);
      if (el.parentNode === field) field.removeChild(el);
    };

    targetObj.lifeTimer = setTimeout(() => {
      if (!targetObj.hit) this._handleTargetMiss(targetObj, x, y);
    }, params.lifetime);

    field.appendChild(el);
    this.activeTargets.push(targetObj);
  }

  _removeTarget(target) {
    const idx = this.activeTargets.indexOf(target);
    if (idx >= 0) this.activeTargets.splice(idx, 1);
    if (target.cleanup) target.cleanup();
  }

  _spawnScoreFx(kind, x, y, text) {
    const field = this.elField || this.elRoot;
    const fx = document.createElement('div');
    fx.className = `sb-fx-score sb-${kind}`;
    fx.textContent = text;
    fx.style.left = `${x}px`;
    fx.style.top  = `${y}px`;
    field.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === field) field.removeChild(fx);
    }, 650);
  }

  _spawnHitParticle(x, y, emoji = '✨') {
    const field = this.elField || this.elRoot;
    const hp = document.createElement('div');
    hp.className = 'hitParticle';
    hp.textContent = emoji;
    hp.style.left = `${x}px`;
    hp.style.top  = `${y}px`;
    field.appendChild(hp);
    setTimeout(() => {
      if (hp.parentNode === field) field.removeChild(hp);
    }, 480);
  }

  _spawnBossFaceTarget(params) {
    const field = this.elField || this.elRoot;
    if (!field) return;

    const rect = field.getBoundingClientRect();
    const size = params.sizePx ? params.sizePx[1] : 96; // ใช้ขนาดใหญ่สุด

    const pad = 24;
    const maxX = rect.width - size - pad;
    const maxY = rect.height - size - pad;
    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.type = 'bossface';
    el.dataset.bossFace = '1';   // ให้ CSS sb-target[data-boss-face="1"] จับไปแต่ง

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    const boss = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    inner.textContent = boss.emoji;        // ใช้หน้า/สัญลักษณ์บอสจริง
    el.appendChild(inner);

    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;

    const targetObj = {
      el,
      type: 'bossface',
      hit: false,
      lifeTimer: null,
      cleanup: null
    };

    const onHit = (ev) => {
      ev.preventDefault();
      this._handleTargetHit(targetObj, x, y);
    };

    el.addEventListener('pointerdown', onHit, { passive: false });

    targetObj.cleanup = () => {
      el.removeEventListener('pointerdown', onHit);
      if (el.parentNode === field) field.removeChild(el);
    };

    // อยู่บนจอสั้นกว่าปกติ
    const life = (params.lifetime || 2000) * 0.7;
    targetObj.lifeTimer = setTimeout(() => {
      if (!targetObj.hit) this._handleTargetMiss(targetObj, x, y);
    }, life);

    field.appendChild(el);
    this.activeTargets.push(targetObj);
  }

  _handleTargetHit(target, x, y) {
    if (!this.running) return;
    if (target.hit) return;
    target.hit = true;

    if (target.lifeTimer) clearTimeout(target.lifeTimer);
    this._removeTarget(target);

    target.el.classList.add('sb-hit');

    if (target.type === 'fake') {
      // โดน bomb
      this.playerHP = Math.max(0, this.playerHP - 1);
      this.combo = 0;
      this._updatePlayerHPHUD();
      this._updateComboHUD();
      this._spawnScoreFx('decoy', x, y, 'BOMB!');
      this._spawnHitParticle(x, y, '💣');

      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent = 'โดนลูกล่อ! HP ลด 1 ❤️';
        this.elHUD.feedback.className = 'sb-feedback bomb';
      }
      if (this.playerHP <= 0) {
        this.endGame('playerDead');
      }
    } else if (target.type === 'bossface') {
      // เป้าหน้าบอส: ดาเมจแรง + คะแนนเยอะ
      const dmg = 3;
      const gain = 30;

      this.score += gain;
      this._updateScoreHUD();

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this._updateComboHUD();

      this._spawnScoreFx('perfect', x, y, `+${gain} BOSS HIT!`);
      this._spawnHitParticle(x, y, '💥');

      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent = 'ตีโดนหน้า Boss! ดาเมจแรงสุด ๆ 💥';
        this.elHUD.feedback.className = 'sb-feedback perfect';
      }

      this._applyBossDamage(dmg);
    } else {
      // main / bonus ปกติ
      let base = 10;
      let emoji = '🎯';

      if (target.type === 'bonus') {
        base = 20;
        emoji = '⭐';
      }

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      const comboBonus = Math.floor(this.combo / 5) * 2;
      const gain = base + comboBonus;

      this.score += gain;
      this._updateScoreHUD();
      this._updateComboHUD();

      const label = this.combo >= 10 ? 'PERFECT!' : 'GOOD';
      const kind  = this.combo >= 10 ? 'perfect' : 'good';

      this._spawnScoreFx(kind, x, y, `+${gain} ${label}`);
      this._spawnHitParticle(x, y, emoji);

      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent =
          this.combo >= 10 ? 'สุดยอด! คอมโบยาวมาก 🎉' : 'ดีมาก! ตีทันเวลา';
        this.elHUD.feedback.className =
          'sb-feedback ' + (this.combo >= 10 ? 'perfect' : 'good');
      }

      const dmg = target.type === 'bonus' ? 2 : 1;
      this._applyBossDamage(dmg);
    }
  }

  _handleTargetMiss(target, x, y) {
    if (!this.running) return;
    if (target.hit) return;

    if (target.lifeTimer) clearTimeout(target.lifeTimer);
    this._removeTarget(target);

    if (target.type === 'main' || target.type === 'bossface') {
      this.combo = 0;
      this._updateComboHUD();
      this._spawnScoreFx('miss', x, y, 'MISS');
      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent = 'พลาดไปนิด ลองเล็งให้เร็วขึ้น!';
        this.elHUD.feedback.className = 'sb-feedback miss';
      }
    }
  }

  _applyBossDamage(dmg) {
    const info = this.boss.hit(dmg);

    this._updateBossHPHUD(info.ratio);
    this._updatePhaseHUD(info.phase);

    // near-death → spawn boss face หนึ่งครั้งต่อบอส
    if (info.nearDeath && info.nearDeathChanged) {
      const params = this.lastSpawnParams ||
        computeSpawnParams(this.diffKey, info.ratio, this.currentBossIdx);
      this._spawnBossFaceTarget(params);
    }

    if (info.nearDeath && this.elHUD.feedback) {
      this.elHUD.feedback.textContent =
        'บอสใกล้แพ้แล้ว! รัวหมัดให้สุดเลย 💥';
      this.elHUD.feedback.className = 'sb-feedback good';
    }

    if (info.hp <= 0) {
      this._onBossDown();
    }
  }

  /* ---------- END GAME ---------- */

  endGame(reason = 'timeup') {
    if (!this.running && reason === 'restart') {
      // เรียกจากด้านนอกเพื่อ reset เฉย ๆ
    }
    if (!this.running && reason !== 'restart') return;

    this.running = false;

    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    if (this.timerTick) clearInterval(this.timerTick);
    this.spawnTimer = null;
    this.timerTick = null;

    // clear targets ทั้งหมด
    this.activeTargets.forEach(t => {
      if (t.lifeTimer) clearTimeout(t.lifeTimer);
      if (t.cleanup) t.cleanup();
    });
    this.activeTargets.length = 0;

    if (reason === 'restart') return;

    const titleMap = {
      timeup:      'หมดเวลา',
      bossDownAll: 'ชนะบอสครบ 4 ตัว! 🎉',
      playerDead:  'พลังชีวิตหมด',
      bossDown:    'ชนะบอส!'
    };
    const title = titleMap[reason] || 'จบเกม';

    const msg =
      `${title}\n\n` +
      `คะแนนรวม: ${this.score}\n` +
      `คอมโบสูงสุด: ${this.maxCombo}\n` +
      `บอสที่เล่นถึง: ${this.currentBossIdx + 1}/${this.bossOrder.length}`;

    window.alert(msg);
  }
}

/* ---------------------------------------------------------
   bootstrap
--------------------------------------------------------- */

export function initShadowBreaker(opts = {}) {
  const host =
    opts.host ||
    document.getElementById('shadowWrap') ||
    document.querySelector('.sb-wrap') ||
    document.body;

  const url = new URL(window.location.href);
  const qsDiff = url.searchParams.get('diff');
  const qsTime = url.searchParams.get('time');

  const root = host.closest('.sb-wrap') || host;
  const dataDiff = root.dataset.diff;

  const diffKey =
    opts.difficulty ||
    (qsDiff ? qsDiff.toLowerCase() : null) ||
    (dataDiff ? dataDiff.toLowerCase() : null) ||
    'normal';

  const timeSec =
    Number(opts.durationSec) ||
    Number(qsTime) ||
    60;

  // ถ้าอยาก override ลำดับบอสเอง ก็ส่ง opts.bossOrder = [0,1,2,3]
  const bossOrder = Array.isArray(opts.bossOrder)
    ? opts.bossOrder.slice()
    : (SHADOW_DIFF_TABLE[diffKey]?.defaultBossOrder.slice() || [0,1,2,3]);

  const game = new ShadowBreakerGame({
    host: root,
    difficulty: diffKey,
    durationSec: timeSec,
    bossOrder
  });

  window.__shadowBreaker = game; // เผื่อ debug จาก console
  game.start();
  return game;
}
