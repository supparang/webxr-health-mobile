// === js/engine.js — Shadow Breaker core (2025-11-24 SB-CardLayout v2) ===
'use strict';

/**
 * ตารางบอส 4 ตัว + คำใบ้ + รางวัลพื้นฐาน
 * (ตรงกับดีไซน์: บอส 1 '🫧', บอส 2 '🌀', บอส 3 '🛡️', บอส 4 '☠️')
 */
const BOSS_TABLE = [
  {
    id: 0,
    emoji: '🫧',
    name: 'Bubble Glove',
    title: 'หมัดฟองสบู่วอร์มอัป',
    hint: 'เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัปมือก่อนลุยจริง',
    reward: {
      heal: 1,
      score: 80,
      fever: 0.25,
      text: 'เคลียร์ Bubble Glove! +1 HP และ +80 คะแนน 🎉'
    }
  },
  {
    id: 1,
    emoji: '🌀',
    name: 'Vortex Fist',
    title: 'หมัดหมุนพายุ',
    hint: 'จังหวะเร็วขึ้น มีเป้าหลอกปนมาบ้างเป็นระยะ',
    reward: {
      heal: 0,
      score: 120,
      fever: 0.3,
      text: 'เคลียร์ Vortex Fist! +120 คะแนน เกจ FEVER เพิ่มขึ้น ✨'
    }
  },
  {
    id: 2,
    emoji: '🛡️',
    name: 'Shadow Guard',
    title: 'ผู้พิทักษ์เงา',
    hint: 'อย่าปล่อยให้เป้าหลุดหลายลูกติดกัน ไม่งั้นบอสจะยืดเกม',
    reward: {
      heal: 1,
      score: 150,
      fever: 0.35,
      text: 'เคลียร์ Shadow Guard! +1 HP และ +150 คะแนน 💪'
    }
  },
  {
    id: 3,
    emoji: '☠️',
    name: 'Final Burst',
    title: 'บอสใหญ่ไฟนอล',
    hint: 'ช่วงท้ายเป้าจะถี่และเล็กลง ต้องโฟกัสให้สุด!',
    reward: {
      heal: 0,
      score: 200,
      fever: 0.5,
      text: 'พิชิต Final Burst! ปิดจ็อบอย่างสวยงาม 🎆'
    }
  }
];

const BUILD_VERSION = 'shadowBreaker_card_v2';

// ---------------------------------------------------------------------------
// ฟังก์ชัน bootstrap ที่ shadow-breaker.js จะเรียก
// ---------------------------------------------------------------------------
export function initShadowBreaker(options = {}) {
  const url = new URL(window.location.href);

  const modeKey =
    options.mode ||
    url.searchParams.get('mode') ||
    'normal';

  const diffKey =
    options.difficulty ||
    url.searchParams.get('diff') ||
    'normal';

  const durSec = parseInt(
    options.durationSec || url.searchParams.get('time') || '60',
    10
  ) || 60;

  const nextUrl = options.nextUrl || url.searchParams.get('next') || '';

  const host =
    document.getElementById('sb-root') ||
    document.querySelector('.sb-wrap') ||
    document.body;

  const game = new ShadowBreakerGame({
    host,
    mode: modeKey,
    difficulty: diffKey,
    durationSec: durSec,
    nextUrl
  });

  window.__shadowBreaker = game;
  return game;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

function pickWeighted(weights) {
  const entries = Object.entries(weights || {});
  const sum = entries.reduce((s, [, w]) => s + (w || 0), 0) || 1;
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= (w || 0);
    if (r <= 0) return k;
  }
  return entries[0]?.[0] || 'main';
}

// ---------------------------------------------------------------------------
// ShadowBreakerGame — core engine ที่ผูกกับ layout ใน shadow-breaker.html
// ---------------------------------------------------------------------------
class ShadowBreakerGame {
  constructor(opts) {
    this.host = opts.host || document.body;
    this.elRoot = this.host;

    this.mode = (opts.mode === 'research') ? 'research' : 'normal';
    this.difficulty = opts.difficulty || 'normal';
    this.durationSec = opts.durationSec || 60;
    this.timeLeft = this.durationSec;
    this.nextUrl = opts.nextUrl || '';

    // สถานะเกมหลัก
    this.running = false;
    this.startedOnce = false;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;

    this.bossIndex = 0;  // 0..3
    this.bossPhase = 1;  // 1..3
    this.nearDeath = false;

    // FEVER 0..1
    this.fever = 0;
    this.feverOn = false;

    this.activeTargets = [];
    this.spawnTimer = null;
    this.timerTick = null;

    // research meta
    this.participantId = '';
    this.researchNote = '';

    this.elHUD = {};
    this.elStage = null;
    this.elIntro = null;

    this._bindDOMFromLayout();
    this._resetBossForCurrent(false);
    this._updateHUDAll();
  }

  // -----------------------------------------------------------------------
  // DOM & HUD binding
  // -----------------------------------------------------------------------
  _bindDOMFromLayout() {
    const root = this.elRoot;
    const q = (sel) => root.querySelector(sel);

    root.dataset.diff = this.difficulty;
    root.dataset.phase = '1';
    root.dataset.boss = String(this.bossIndex);

    // HUD elements
    this.elHUD.barPlayer    = q('[data-sb-player-hp]');
    this.elHUD.playerHPText = q('[data-sb-player-hp-text]');
    this.elHUD.barBoss      = q('[data-sb-boss-hp]');
    this.elHUD.bossHPText   = q('[data-sb-boss-hp-text]');
    this.elHUD.timerVal     = q('[data-sb-timer]');
    this.elHUD.scoreVal     = q('[data-sb-score]');
    this.elHUD.comboVal     = q('[data-sb-combo]');
    this.elHUD.phaseVal     = q('[data-sb-phase]');
    this.elHUD.feverFill    = q('[data-sb-fever]');
    this.elHUD.feverStatus  = q('[data-sb-fever-status]');
    this.elHUD.feedback     = document.getElementById('sbFeedback');

    // boss portrait
    this.elHUD.bossPortrait = document.getElementById('boss-portrait');
    this.elHUD.bossName     = document.getElementById('boss-portrait-name');
    this.elHUD.bossHint     = document.getElementById('boss-portrait-hint');

    // field
    this.elStage = q('[data-sb-field]') || q('.sb-field') || root;

    // intro overlay
    this.elIntro = document.getElementById('bossIntro');

    // menu / controls
    this.elModeNormal    = document.getElementById('modeNormalBtn');
    this.elModeResearch  = document.getElementById('modeResearchBtn');
    this.elStartBtn      = document.getElementById('startBtn');
    this.elCsvBtn        = document.getElementById('csvBtn');
    this.elResearchPanel = document.getElementById('researchPanel');
    this.elDiffSelect    = document.getElementById('diffSelect');
    this.elTimeSelect    = document.getElementById('timeSelect');
    this.elPartId        = document.getElementById('participantId');
    this.elNote          = document.getElementById('researchNote');

    this._bindModeUI();
    this._attachUIEvents();
  }

  _bindModeUI() {
    const isResearch = (this.mode === 'research');

    if (this.elModeNormal) {
      this.elModeNormal.classList.toggle('primary', !isResearch);
      this.elModeNormal.classList.toggle('ghost', isResearch);
    }
    if (this.elModeResearch) {
      this.elModeResearch.classList.toggle('primary', isResearch);
      this.elModeResearch.classList.toggle('ghost', !isResearch);
    }
    if (this.elResearchPanel) {
      this.elResearchPanel.classList.toggle('hidden', !isResearch);
    }
    if (this.elCsvBtn) {
      this.elCsvBtn.classList.toggle('hidden', !isResearch);
    }
  }

  _setMode(mode) {
    this.mode = (mode === 'research') ? 'research' : 'normal';
    this._bindModeUI();
  }

  _attachUIEvents() {
    this.elModeNormal?.addEventListener('click', () => {
      this._setMode('normal');
    });
    this.elModeResearch?.addEventListener('click', () => {
      this._setMode('research');
    });

    this.elDiffSelect?.addEventListener('change', () => {
      this.difficulty = this.elDiffSelect.value || 'normal';
      if (this.elRoot) this.elRoot.dataset.diff = this.difficulty;
    });

    this.elTimeSelect?.addEventListener('change', () => {
      const v = parseInt(this.elTimeSelect.value || '60', 10) || 60;
      this.durationSec = v;
      this.timeLeft = v;
      this._updateTimerHUD();
    });

    this.elStartBtn?.addEventListener('click', () => {
      if (this.elDiffSelect) {
        this.difficulty = this.elDiffSelect.value || 'normal';
      }
      if (this.elTimeSelect) {
        const v = parseInt(this.elTimeSelect.value || '60', 10) || 60;
        this.durationSec = v;
      }
      if (this.elPartId) {
        this.participantId = this.elPartId.value.trim();
      }
      if (this.elNote) {
        this.researchNote = this.elNote.value.trim();
      }
      if (this.elRoot) {
        this.elRoot.dataset.diff = this.difficulty;
      }
      this.start();
    });

    this.elCsvBtn?.addEventListener('click', () => {
      window.alert(
        'ฟีเจอร์บันทึก CSV จะใช้ร่วมกับ Session Logger ในงานวิจัยฉบับเต็มนะคะ'
      );
    });
  }

  // -----------------------------------------------------------------------
  // HUD
  // -----------------------------------------------------------------------
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
    this._updateFeverHUD();
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
    if (this.elRoot) {
      this.elRoot.dataset.phase = String(this.bossPhase);
    }
  }

  _updatePlayerHPHUD() {
    const ratio = this.playerMaxHP > 0 ? (this.playerHP / this.playerMaxHP) : 0;
    if (this.elHUD.barPlayer) {
      this.elHUD.barPlayer.style.transform =
        `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.elHUD.barPlayer.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.playerHPText) {
      this.elHUD.playerHPText.textContent =
        `${this.playerHP}/${this.playerMaxHP}`;
    }
  }

  _updateBossHPHUD() {
    const ratio = this.bossMaxHP > 0 ? (this.bossHP / this.bossMaxHP) : 0;
    if (this.elHUD.barBoss) {
      this.elHUD.barBoss.style.transform =
        `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.elHUD.barBoss.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.bossHPText) {
      this.elHUD.bossHPText.textContent =
        `${this.bossHP}/${this.bossMaxHP}`;
    }
  }

  _updateFeverHUD() {
    const v = Math.max(0, Math.min(1, this.fever));
    if (this.elHUD.feverFill) {
      this.elHUD.feverFill.style.transform = `scaleX(${v})`;
    }
    if (this.elHUD.feverStatus) {
      if (this.fever >= 1) {
        this.feverOn = true;
        this.elHUD.feverStatus.textContent = 'FEVER!!';
        this.elHUD.feverStatus.classList.add('on');
      } else if (this.fever > 0) {
        this.feverOn = false;
        this.elHUD.feverStatus.textContent = 'Charge';
        this.elHUD.feverStatus.classList.remove('on');
      } else {
        this.feverOn = false;
        this.elHUD.feverStatus.textContent = 'Ready';
        this.elHUD.feverStatus.classList.remove('on');
      }
    }
  }

  _updateNearDeathVisual() {
    const portrait = this.elHUD.bossPortrait;
    if (portrait) {
      portrait.classList.toggle('sb-shake', !!this.nearDeath);
    }
  }

  _updateBossPortrait() {
    const bossDef = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    if (this.elHUD.bossPortrait) {
      this.elHUD.bossPortrait.textContent = bossDef.emoji || '🥊';
    }
    if (this.elHUD.bossName) {
      this.elHUD.bossName.textContent = bossDef.name || 'Boss';
    }
    if (this.elHUD.bossHint) {
      this.elHUD.bossHint.textContent = bossDef.hint || '';
    }
    if (this.elRoot) {
      this.elRoot.dataset.boss = String(this.bossIndex);
    }
  }

  _showBossIntro() {
    if (!this.elIntro) return;
    const def = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    const eEmoji = this.elIntro.querySelector('.boss-intro-emoji');
    const eName  = this.elIntro.querySelector('.boss-intro-name');
    const eTitle = this.elIntro.querySelector('.boss-intro-title');
    const eDesc  = this.elIntro.querySelector('.boss-intro-desc');
    const eHint  = this.elIntro.querySelector('.boss-intro-hint');

    if (eEmoji) eEmoji.textContent = def.emoji || '🥊';
    if (eName)  eName.textContent  = def.name || 'Boss';
    if (eTitle) eTitle.textContent = def.title || '';
    if (eDesc)  eDesc.textContent  = 'บอสจะส่งเป้าออกมาให้คุณตีให้ทันทุกลูก!';
    if (eHint)  eHint.textContent  = def.hint || '';

    this.elIntro.classList.remove('hidden');
    setTimeout(() => {
      this.elIntro?.classList.add('hidden');
    }, 1300);
  }

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------
  start() {
    if (this.running) return;

    this.startedOnce = true;
    this.running = true;

    this.timeLeft = this.durationSec;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.playerHP = this.playerMaxHP;
    this.fever = 0;
    this.feverOn = false;

    this.bossIndex = 0;
    this._resetBossForCurrent(true);

    this._updateHUDAll();
    this._showBossIntro();
    this._startTimer();
    this._spawnLoop();

    if (this.elHUD.feedback) {
      this.elHUD.feedback.textContent =
        'ตีเป้าให้ทันก่อนหายไป แล้วดูว่าคอมโบจะยาวแค่ไหน!';
    }
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

  _computeSpawnParams() {
    const diff = this.difficulty || 'normal';
    const hpRatio = this.bossMaxHP > 0 ? (this.bossHP / this.bossMaxHP) : 1;

    // phase ตาม HP
    let phase = 1;
    if (hpRatio <= 0.33) phase = 3;
    else if (hpRatio <= 0.66) phase = 2;

    this.bossPhase = phase;
    this.nearDeath = (hpRatio <= 0.25);

    const baseMap = {
      easy:   { spawn: 1100, lifetime: 1700, maxActive: 3, size: [110, 150] },
      normal: { spawn: 850,  lifetime: 1400, maxActive: 4, size: [90, 130] },
      hard:   { spawn: 680,  lifetime: 1200, maxActive: 5, size: [78, 118] }
    };
    const base = baseMap[diff] || baseMap.normal;

    const phaseFactor = { 1: 1.0, 2: 0.9, 3: 0.8 }[phase] || 1.0;

    const spawnInterval = base.spawn * phaseFactor;
    const lifetime = base.lifetime * phaseFactor;

    const weights = {
      main: 70,
      fake: diff === 'easy' ? 10 : (diff === 'normal' ? 18 : 24),
      bonus: phase === 1 ? 10 : (phase === 2 ? 7 : 5),
      boss: this.nearDeath ? 8 : 0
    };

    return {
      phase,
      nearDeath: this.nearDeath,
      maxActive: base.maxActive,
      spawnInterval,
      lifetime,
      sizePx: base.size,
      weights
    };
  }

  _spawnLoop() {
    if (!this.running) return;

    const params = this._computeSpawnParams();
    this._updatePhaseHUD();
    this._updateNearDeathVisual();

    if (this.activeTargets.length < (params.maxActive || 3)) {
      this._spawnOneTarget(params);
    }

    this.spawnTimer = setTimeout(
      () => this._spawnLoop(),
      params.spawnInterval || 900
    );
  }

  _spawnOneTarget(params) {
    const stage = this.elStage || this.host;
    if (!stage) return;

    const targetType = pickWeighted(params.weights || { main: 1 });
    let [baseMin, baseMax] = params.sizePx || [90, 130];

    const diffFactor = {
      easy: 1.15,
      normal: 1.0,
      hard: 0.9
    }[this.difficulty] ?? 1.0;

    const phaseFactor = {
      1: 1.0,
      2: 0.95,
      3: 0.85
    }[this.bossPhase] ?? 1.0;

    const factor = diffFactor * phaseFactor;
    let minSize = baseMin * factor;
    let maxSize = baseMax * factor;

    const MIN_SIZE = 70;
    if (minSize < MIN_SIZE) minSize = MIN_SIZE;
    if (maxSize < MIN_SIZE + 20) maxSize = MIN_SIZE + 20;

    const size = randBetween(minSize, maxSize);

    const el = document.createElement('div');
    el.className = `sb-target sb-target-${targetType}`;

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    if (targetType === 'main') {
      inner.textContent = '🎯';
    } else if (targetType === 'fake') {
      inner.textContent = '💣';
    } else if (targetType === 'boss') {
      inner.textContent = BOSS_TABLE[this.bossIndex]?.emoji || '😈';
    } else {
      inner.textContent = '⭐';
    }
    el.appendChild(inner);

    const pad = 16;
    const rect = stage.getBoundingClientRect();
    const w = rect.width || 480;
    const h = rect.height || 320;

    const maxX = Math.max(0, w - size - pad);
    const maxY = Math.max(0, h - size - pad);

    const x = randBetween(pad, maxX);
    const y = randBetween(pad, maxY);

    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    const target = {
      el,
      type: targetType,
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
      if (el.parentNode === stage) stage.removeChild(el);
    };

    target.lifeTimer = setTimeout(() => {
      if (!target.hit) this._handleTargetMiss(target);
    }, params.lifetime || 1400);

    stage.appendChild(el);
    this.activeTargets.push(target);
  }

  _handleTargetHit(target) {
    if (!this.running) return;
    if (target.hit) return;
    target.hit = true;

    this._removeTarget(target);
    if (target.lifeTimer) {
      clearTimeout(target.lifeTimer);
      target.lifeTimer = null;
    }

    if (target.type === 'fake') {
      // ตีโดนเป้าหลอก → ตัด HP + reset combo
      this.playerHP = Math.max(0, this.playerHP - 1);
      this.combo = 0;
      this._updatePlayerHPHUD();
      this._updateComboHUD();
      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent = 'โอ๊ะ! ตีโดนเป้าหลอก ระวังลูกต่อไปให้ดี 🔺';
      }
      if (this.playerHP <= 0) {
        this.endGame('playerDead');
        return;
      }
    } else {
      // main / bonus / boss
      let baseScore = 10;
      let dmg = 1;

      if (target.type === 'boss') {
        baseScore = 30;
        dmg = 3;
      }

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      const comboBonus = Math.floor(this.combo / 5) * 2;
      this.score += baseScore + comboBonus;

      // เพิ่มเกจ FEVER
      const feverGain =
        target.type === 'boss' ? 0.10 :
        0.05;
      this.fever = Math.max(0, Math.min(1, this.fever + feverGain));

      this._updateScoreHUD();
      this._updateComboHUD();
      this._updateFeverHUD();

      // ดาเมจบอส
      if (this.feverOn) {
        dmg *= 1.5;
      }
      this.bossHP = Math.max(0, this.bossHP - dmg);
      this._updateBossHPHUD();

      if (this.elHUD.feedback) {
        if (this.combo >= 10) {
          this.elHUD.feedback.textContent =
            `สุดยอด! คอมโบต่อเนื่อง ${this.combo} ครั้ง 🎉`;
        } else {
          this.elHUD.feedback.textContent = 'ดีมาก! รักษาจังหวะไว้ให้ได้ 👊';
        }
      }

      if (this.bossHP <= 0) {
        this._handleBossDown();
      }
    }

    target.el.classList.add('sb-hit');
    setTimeout(() => {
      if (target.cleanup) target.cleanup();
    }, 140);
  }

  _handleTargetMiss(target) {
    if (!this.running) return;
    if (target.hit) return;

    this._removeTarget(target);
    if (target.lifeTimer) {
      clearTimeout(target.lifeTimer);
      target.lifeTimer = null;
    }

    if (target.type === 'main' || target.type === 'boss') {
      this.combo = 0;
      this._updateComboHUD();
      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent =
          'เป้าหลุดไป 1 ลูก ลองโฟกัสใหม่อีกครั้งนะ 🔁';
      }
    }

    if (target.cleanup) target.cleanup();
  }

  _removeTarget(target) {
    const idx = this.activeTargets.indexOf(target);
    if (idx >= 0) this.activeTargets.splice(idx, 1);
  }

  // -----------------------------------------------------------------------
  // Boss control
  // -----------------------------------------------------------------------
  _handleBossDown() {
    this._applyBossReward();

    if (this.elRoot) {
      this.elRoot.classList.add('sb-stage-clear');
      setTimeout(() => {
        this.elRoot?.classList.remove('sb-stage-clear');
      }, 600);
    }

    if (this.bossIndex < BOSS_TABLE.length - 1) {
      this.bossIndex += 1;
      this._resetBossForCurrent(true);
      this._showBossIntro();
      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent =
          'เยี่ยม! บอสต่อไปจะเร็วขึ้นอีกนิด ลองดูว่าจะไปได้ไกลแค่ไหน 💥';
      }
    } else {
      this.endGame('allBossCleared');
    }
  }

  _applyBossReward() {
    const def = BOSS_TABLE[this.bossIndex];
    if (!def || !def.reward) return;
    const r = def.reward;

    if (r.heal) {
      this.playerHP = Math.min(this.playerMaxHP, this.playerHP + r.heal);
      this._updatePlayerHPHUD();
    }
    if (r.score) {
      this.score += r.score;
      this._updateScoreHUD();
    }
    if (r.fever) {
      this.fever = Math.max(0, Math.min(1, this.fever + r.fever));
      this._updateFeverHUD();
    }
    if (this.elHUD.feedback && r.text) {
      this.elHUD.feedback.textContent = r.text;
    }
  }

  _resetBossForCurrent(resetHPBar) {
    const diff = this.difficulty || 'normal';
    const baseHP = { easy: 40, normal: 60, hard: 80 }[diff] || 60;
    const factor = 1 + this.bossIndex * 0.25;
    this.bossMaxHP = Math.round(baseHP * factor);
    this.bossHP = this.bossMaxHP;
    this.bossPhase = 1;
    this.nearDeath = false;

    if (resetHPBar !== false) {
      this._updateBossHPHUD();
    }
    this._updatePhaseHUD();
    this._updateNearDeathVisual();
    this._updateBossPortrait();
  }

  // -----------------------------------------------------------------------
  // End game
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

    this.activeTargets.forEach(t => {
      if (t.lifeTimer) clearTimeout(t.lifeTimer);
      if (t.cleanup) t.cleanup();
    });
    this.activeTargets.length = 0;

    const titleMap = {
      timeup: 'หมดเวลา',
      bossDown: 'ชนะบอส!',
      allBossCleared: 'พิชิตทุกบอสแล้ว!',
      playerDead: 'พลังชีวิตหมด'
    };
    const title = titleMap[reason] || 'จบเกม';

    const msg = [
      `${title}`,
      `SCORE: ${this.score}`,
      `MAX COMBO: ${this.maxCombo}`,
      `BOSS ที่ถึง: ${this.bossIndex + 1} / ${BOSS_TABLE.length}`,
      `BOSS HP สุดท้าย: ${this.bossHP}/${this.bossMaxHP}`,
      '',
      `(Build: ${BUILD_VERSION})`
    ].join('\n');

    if (this.elHUD.feedback) {
      this.elHUD.feedback.textContent = title;
    }

    window.alert(msg);

    if (this.nextUrl) {
      window.location.href = this.nextUrl;
    }
  }
}

export { ShadowBreakerGame };
