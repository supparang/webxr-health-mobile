// === fitness/js/engine.js — Shadow Breaker Engine (งานใหญ่ 1) ===
'use strict';

/* ---------------------------------------------------------
   CONFIG: ความยาก + บอส + phase + near-death
--------------------------------------------------------- */

const SHADOW_DIFF_TABLE = {
  easy: {
    label: 'โหมดง่าย',
    target: {
      spawnIntervalMs: [950, 850, 750],
      lifetimeMs:      [2400, 2200, 2000],
      maxActive:       [3, 4, 5],
      sizePx:          [80, 110]
    },
    boss: {
      maxHP: 40,
      phaseThresholds: [0.7, 0.35],
      nearDeathPct: 0.25,
      nearDeathBoost: {
        spawnIntervalFactor: 0.8,
        maxActiveBonus: 1
      }
    },
    weights: { main: 78, fake: 10, bonus: 12 },
    bossIndex: 0
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
    bossIndex: 1
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
      nearDeathPct: 0.3,
      nearDeathBoost: {
        spawnIntervalFactor: 0.65,
        maxActiveBonus: 2
      }
    },
    weights: { main: 64, fake: 24, bonus: 12 },
    bossIndex: 2
  }
};

const BOSS_TABLE = [
  {
    emoji: '🫧',
    name: 'Bubble Glove',
    title: 'หมัดฟองอากาศ',
    hint: 'เล็งเป้าหลักให้ทัน อย่าตีฟองหลอก'
  },
  {
    emoji: '🌀',
    name: 'Neon Knuckle',
    title: 'หมัดนีออนสายฟ้า',
    hint: 'ระวังเป้าหลอกสีใกล้เคียง'
  },
  {
    emoji: '🛡️',
    name: 'Shadow Guard',
    title: 'ยามเงามืด',
    hint: 'อย่าให้คอมโบหลุดบ่อยเกินไป'
  },
  {
    emoji: '☠️',
    name: 'Final Burst',
    title: 'ระเบิดเงาสุดท้าย',
    hint: 'ช่วงใกล้ตายจะรัวมาก เตรียมแขนให้พร้อม!'
  }
];

function computeSpawnParams(diffKey, bossHpRatio) {
  const cfg = SHADOW_DIFF_TABLE[diffKey] || SHADOW_DIFF_TABLE.normal;
  const t = cfg.target;
  const b = cfg.boss;

  let phase = 1;
  if (bossHpRatio <= b.phaseThresholds[1]) phase = 3;
  else if (bossHpRatio <= b.phaseThresholds[0]) phase = 2;

  const idx = phase - 1;
  let spawnInterval = t.spawnIntervalMs[idx];
  let lifetime = t.lifetimeMs[idx];
  let maxActive = t.maxActive[idx];

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
   ENGINE
--------------------------------------------------------- */

class ShadowBreakerGame {
  constructor(opts) {
    this.host = opts.host || document.querySelector('.sb-wrap') || document.body;
    this.diffKey = opts.difficulty || 'normal';
    this.durationSec = opts.durationSec || 60;

    const diffCfg = SHADOW_DIFF_TABLE[this.diffKey] || SHADOW_DIFF_TABLE.normal;
    this.bossIndex = (typeof opts.bossIndex === 'number')
      ? opts.bossIndex
      : diffCfg.bossIndex;

    this.running = false;
    this.timeLeft = this.durationSec;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;

    this.boss = new ShadowBossState(this.diffKey);
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

    this._bindDOM();
  }

  /* ---------- DOM binding ---------- */
  _bindDOM() {
    const root = this.host.closest('.sb-wrap') || this.host;
    this.elRoot = root;

    // dataset
    root.dataset.diff = this.diffKey;

    // field
    this.elField =
      root.querySelector('[data-sb-field]') ||
      root.querySelector('.sb-field') ||
      root;

    this.elGuide = this.elField.querySelector('.sb-field-guide');

    // HUD
    const q = (sel) => root.querySelector(sel);

    this.elHUD.playerBar = q('[data-sb-player-hp]');
    this.elHUD.playerHPText = q('[data-sb-player-hp-text]');
    this.elHUD.bossBar = q('[data-sb-boss-hp]');
    this.elHUD.bossHPText = q('[data-sb-boss-hp-text]');
    this.elHUD.timer = q('[data-sb-timer]');
    this.elHUD.score = q('[data-sb-score]');
    this.elHUD.combo = q('[data-sb-combo]');
    this.elHUD.phase = q('[data-sb-phase]');
    this.elHUD.feverFill = q('[data-sb-fever]');
    this.elHUD.feverStatus = q('[data-sb-fever-status]');
    this.elHUD.feedback = q('#sbFeedback');

    // boss portrait
    this.elBossPortrait = q('#boss-portrait');
    this.elBossName = q('#boss-portrait-name');
    this.elBossHint = q('#boss-portrait-hint');

    // boss intro overlay
    this.elBossIntro = document.getElementById('bossIntro');
    if (this.elBossIntro) {
      this.elBossIntroEmoji = this.elBossIntro.querySelector('.boss-intro-emoji');
      this.elBossIntroName = this.elBossIntro.querySelector('.boss-intro-name');
      this.elBossIntroTitle = this.elBossIntro.querySelector('.boss-intro-title');
      this.elBossIntroDesc = this.elBossIntro.querySelector('.boss-intro-desc');
      this.elBossIntroHint = this.elBossIntro.querySelector('.boss-intro-hint');
    }

    // ใส่ข้อมูลบอสตาม index
    const boss = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[1];
    root.dataset.boss = String(this.bossIndex);

    if (this.elBossPortrait) {
      this.elBossPortrait.textContent = boss.emoji;
    }
    if (this.elBossName) {
      this.elBossName.textContent = boss.name;
    }
    if (this.elBossHint) {
      this.elBossHint.textContent = boss.hint;
    }

    // boss intro card
    if (this.elBossIntroEmoji) this.elBossIntroEmoji.textContent = boss.emoji;
    if (this.elBossIntroName) this.elBossIntroName.textContent = boss.name;
    if (this.elBossIntroTitle) this.elBossIntroTitle.textContent = boss.title;
    if (this.elBossIntroDesc) this.elBossIntroDesc.textContent =
      'เตรียมแขนให้พร้อม ตีเป้าให้ทันก่อนมันหายไป!';
    if (this.elBossIntroHint) this.elBossIntroHint.textContent = boss.hint;

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
    if (this.elHUD.playerBar) {
      this.elHUD.playerBar.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.elHUD.playerBar.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.playerHPText) {
      this.elHUD.playerHPText.textContent =
        `${this.playerHP}/${this.playerMaxHP}`;
    }
  }

  _updateBossHPHUD(ratio) {
    const r = (typeof ratio === 'number')
      ? ratio
      : (this.boss.maxHP > 0 ? this.boss.hp / this.boss.maxHP : 0);

    if (this.elHUD.bossBar) {
      this.elHUD.bossBar.style.transform = `scaleX(${Math.max(0, Math.min(1, r))})`;
      this.elHUD.bossBar.classList.toggle('low', r <= 0.4);
    }
    if (this.elHUD.bossHPText) {
      this.elHUD.bossHPText.textContent =
        `${this.boss.hp}/${this.boss.maxHP}`;
    }

    // near-death shake
    if (this.elBossPortrait) {
      this.elBossPortrait.classList.toggle('sb-shake', r <= 0.25);
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
    this.boss = new ShadowBossState(this.diffKey);

    this._updateHUDAll();

    // แสดง boss intro สั้น ๆ ถ้ามี
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
    const params = computeSpawnParams(this.diffKey, ratio);

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
      el.dataset.type = 'bad';
    } else if (typeKey === 'bonus') {
      el.dataset.type = 'bonus';
    } else {
      el.dataset.type = 'good';
    }

    const pad = 18;
    const maxX = rect.width - size - pad;
    const maxY = rect.height - size - pad;
    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    const targetObj = {
      el,
      type: typeKey,
      hit: false,
      lifeTimer: null
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
  }

  _spawnScoreFx(kind, x, y, text) {
    const field = this.elField || this.elRoot;
    const fx = document.createElement('div');
    fx.className = `sb-fx-score sb-${kind}`;
    fx.textContent = text;
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
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
    hp.style.top = `${y}px`;
    field.appendChild(hp);
    setTimeout(() => {
      if (hp.parentNode === field) field.removeChild(hp);
    }, 480);
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
    } else {
      // main / bonus
      let base = 10;
      let emoji = '🎯';
      let kind = 'good';
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
      kind = this.combo >= 10 ? 'perfect' : 'good';
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
    if (target.cleanup) target.cleanup();

    if (target.type === 'main') {
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

    if (info.nearDeath && this.elHUD.feedback) {
      this.elHUD.feedback.textContent =
        'บอสใกล้แพ้แล้ว! รัวหมัดให้สุดเลย 💥';
      this.elHUD.feedback.className = 'sb-feedback good';
    }

    if (info.hp <= 0) {
      this.endGame('bossDown');
    }
  }

  /* ---------- END GAME ---------- */

  endGame(reason = 'timeup') {
    if (!this.running) return;
    this.running = false;

    if (this.spawnTimer) clearTimeout(this.spawnTimer);
    if (this.timerTick) clearInterval(this.timerTick);
    this.spawnTimer = null;
    this.timerTick = null;

    // clear targets
    this.activeTargets.forEach(t => {
      if (t.lifeTimer) clearTimeout(t.lifeTimer);
      if (t.cleanup) t.cleanup();
    });
    this.activeTargets.length = 0;

    const titleMap = {
      timeup: 'หมดเวลา',
      bossDown: 'ชนะบอส! 🎉',
      playerDead: 'พลังชีวิตหมด'
    };
    const title = titleMap[reason] || 'จบเกม';

    const msg =
      `${title}\n\n` +
      `คะแนนรวม: ${this.score}\n` +
      `คอมโบสูงสุด: ${this.maxCombo}\n` +
      `HP บอสคงเหลือ: ${this.boss.hp}/${this.boss.maxHP}`;

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

  const bossIndex =
    typeof opts.bossIndex === 'number'
      ? opts.bossIndex
      : (root.dataset.boss ? Number(root.dataset.boss) : undefined);

  const game = new ShadowBreakerGame({
    host: root,
    difficulty: diffKey,
    durationSec: timeSec,
    bossIndex
  });

  window.__shadowBreaker = game; // เผื่อ debug
  game.start();
  return game;
}
