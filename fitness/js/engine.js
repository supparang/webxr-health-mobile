// === fitness/js/engine.js (Shadow Breaker Engine — 2025-11-24) ===
'use strict';

import { computeShadowSpawnParams, ShadowBossState } from './shadow-config.js';

/**
 * ตารางข้อมูลบอส 4 ตัว + รางวัลเมื่อเคลียร์
 */
const BOSS_TABLE = [
  {
    id: 0,
    emoji: '🫧',
    name: 'Bubble Glove',
    title: 'หมัดฟองสบู่วอร์มอัป',
    hint: 'โฟกัสตีเป้าฟองสีอ่อน ๆ ให้ชินจังหวะก่อน',
    reward: {
      heal: 1,
      score: 50,
      fever: 0.25,
      text: 'เคลียร์ Bubble Glove! +1 HP และโบนัส 50 คะแนน 🎉'
    }
  },
  {
    id: 1,
    emoji: '🌀',
    name: 'Vortex Fist',
    title: 'หมัดหมุนพายุ',
    hint: 'ระวังเป้าหมุนเร็วและลูกล่อสีใกล้เคียง',
    reward: {
      heal: 0,
      score: 80,
      fever: 0.3,
      text: 'เคลียร์ Vortex Fist! ได้โบนัส 80 คะแนน และเกจ FEVER เพิ่มขึ้น ✨'
    }
  },
  {
    id: 2,
    emoji: '🛡️',
    name: 'Shadow Guard',
    title: 'โล่เงาป้องกัน',
    hint: 'บางเป้าต้องตีซ้ำ อย่าปล่อยให้หลุดหลายลูกติดกัน',
    reward: {
      heal: 1,
      score: 100,
      fever: 0.35,
      text: 'เคลียร์ Shadow Guard! ฟื้น HP +1 และโบนัส 100 คะแนน 💪'
    }
  },
  {
    id: 3,
    emoji: '☠️',
    name: 'Final Burst',
    title: 'บอสใหญ่ไฟนอล',
    hint: 'จังหวะถี่ขึ้น เป้าเล็กลง ต้องโฟกัสให้สุด!',
    reward: {
      heal: 0,
      score: 150,
      fever: 0.5,
      text: 'พิชิต Final Burst! จบเซสชันอย่างสวยงาม 🎆'
    }
  }
];

/**
 * initShadowBreaker()
 * - bootstrap หลัก เรียกจาก shadow-breaker.js
 * - อ่าน query string: mode=normal|research, diff=easy|normal|hard, time=60
 * - ไม่ auto start เกม แต่ผูกกับปุ่ม "เริ่มเล่นเลย"
 */
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
    document.getElementById('shadowWrap') ||
    document.querySelector('.sb-wrap') ||
    document.body;

  const game = new ShadowBreakerGame({
    host,
    mode: modeKey,
    difficulty: diffKey,
    durationSec: durSec,
    nextUrl
  });

  // debug เผื่อจำเป็น
  window.__shadowGame = game;
  return game;
}

// ---------------------------------------------------------------------------
// Utility ฟังก์ชันเล็ก ๆ
// ---------------------------------------------------------------------------
function randBetween(min, max) {
  return min + Math.random() * (max - min);
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
// ShadowBreakerGame — core engine
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

    this.bossIndex = 0;          // 0..3
    this.boss = new ShadowBossState(this.difficulty);
    this.bossPhase = 1;
    this.nearDeath = false;

    // FEVER gauge 0..1
    this.fever = 0;
    this.feverOn = false;

    this.activeTargets = [];
    this.spawnTimer = null;
    this.timerTick = null;

    // hook เผื่อใช้ต่อยอดงานวิจัย
    this.onBeforeSpawnTarget = null;
    this.onBossHit = null;

    // research meta
    this.participantId = '';
    this.researchNote = '';

    this.elHUD = {};
    this.elStage = null;
    this.elIntro = null;

    this._bindDOMFromLayout();
    this._resetBossForCurrent(false); // เตรียมบอสตัวแรก (ยังไม่เริ่ม spawn)
    this._updateHUDAll();
  }

  // -----------------------------------------------------------------------
  // DOM & HUD binding
  // -----------------------------------------------------------------------
  _bindDOMFromLayout() {
    const root = this.elRoot;
    const q = (sel) => root.querySelector(sel);

    // data-* ไว้ใช้กับ CSS
    root.dataset.diff = this.difficulty;
    root.dataset.phase = '1';
    root.dataset.boss = String(this.bossIndex);

    // HUD
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
    this.elHUD.bossPortrait = q('#boss-portrait');
    this.elHUD.bossName     = q('#boss-portrait-name');
    this.elHUD.bossHint     = q('#boss-portrait-hint');

    // field
    this.elStage = q('[data-sb-field]') || q('.sb-field') || root;

    // intro overlay
    this.elIntro = document.getElementById('bossIntro');

    // Menu / controls
    this.elModeNormal   = document.getElementById('modeNormalBtn');
    this.elModeResearch = document.getElementById('modeResearchBtn');
    this.elStartBtn     = document.getElementById('startBtn');
    this.elCsvBtn       = document.getElementById('csvBtn');
    this.elResearchPanel= document.getElementById('researchPanel');
    this.elDiffSelect   = document.getElementById('diffSelect');
    this.elTimeSelect   = document.getElementById('timeSelect');
    this.elPartId       = document.getElementById('participantId');
    this.elNote         = document.getElementById('researchNote');

    this._bindModeUI();
    this._attachUIEvents();
  }

  _bindModeUI() {
    // ตั้ง state เริ่มต้นของโหมดเล่น
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
    // ปุ่มโหมด
    this.elModeNormal?.addEventListener('click', () => {
      this._setMode('normal');
    });
    this.elModeResearch?.addEventListener('click', () => {
      this._setMode('research');
    });

    // selector difficulty / time
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

    // ปุ่ม start
    this.elStartBtn?.addEventListener('click', () => {
      // อ่านค่าอัปเดตจากหน้า UI ก่อน
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

    // CSV button (ยังไม่ทำจริง แค่ alert ไว้ก่อน)
    this.elCsvBtn?.addEventListener('click', () => {
      window.alert('ฟีเจอร์ดาวน์โหลด CSV จะถูกเปิดใช้ในงานใหญ่ 3 (Research Session Logger) ค่ะ');
    });
  }

  // -----------------------------------------------------------------------
  // HUD helpers
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
      this.elHUD.barPlayer.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.elHUD.barPlayer.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.playerHPText) {
      this.elHUD.playerHPText.textContent =
        `${this.playerHP}/${this.playerMaxHP}`;
    }
  }

  _updateBossHPHUD() {
    const ratio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    if (this.elHUD.barBoss) {
      this.elHUD.barBoss.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      this.elHUD.barBoss.classList.toggle('low', ratio <= 0.4);
    }
    if (this.elHUD.bossHPText) {
      this.elHUD.bossHPText.textContent =
        `${this.boss.hp}/${this.boss.maxHP}`;
    }
  }

  _updateFeverHUD() {
    if (this.elHUD.feverFill) {
      const v = Math.max(0, Math.min(1, this.fever));
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
    if (eDesc)  eDesc.textContent  = 'บอสจะส่งเป้าออกมารัว ๆ ให้คุณตีให้ทันทุกลูก!';
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

    // reset boss ตัวแรก
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

  _spawnLoop() {
    if (!this.running) return;

    if (typeof this.onBeforeSpawnTarget === 'function') {
      this.onBeforeSpawnTarget();
    }

    const bossRatio = this.boss.maxHP > 0 ? (this.boss.hp / this.boss.maxHP) : 0;
    const params = computeShadowSpawnParams(this.difficulty, bossRatio);

    this.bossPhase = params.phase;
    this.nearDeath = params.nearDeath;
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

    // ----- คำนวณขนาดเป้าตาม diff + phase -----
    let [baseMin, baseMax] = params.sizePx || [72, 110];

    const diff  = this.difficulty || 'normal';
    const phase = this.bossPhase  || 1;

    const diffFactorMap = {
      easy:   1.35,
      normal: 1.10,
      hard:   0.90
    };
    const phaseFactorMap = {
      1: 1.10,
      2: 1.00,
      3: 0.85
    };

    const diffFactor  = diffFactorMap[diff]   ?? 1.0;
    const phaseFactor = phaseFactorMap[phase] ?? 1.0;
    const factor      = diffFactor * phaseFactor;

    let minSize = baseMin * factor;
    let maxSize = baseMax * factor;

    const MIN_SIZE = 72;
    if (minSize < MIN_SIZE)      minSize = MIN_SIZE;
    if (maxSize < MIN_SIZE + 20) maxSize = MIN_SIZE + 20;

    const size = randBetween(minSize, maxSize);

    // ---------- สร้าง DOM เป้า ----------
    const el = document.createElement('div');
    el.className = `sb-target sb-target-${targetType}`;

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    if (targetType === 'main') {
      inner.textContent = '🥊';
    } else if (targetType === 'fake') {
      inner.textContent = '💣';
    } else {
      inner.textContent = '⭐';
    }
    el.appendChild(inner);

    // ตำแหน่งแบบสุ่มใน stage (เว้นขอบ)
    const pad = 12;
    const rect = stage.getBoundingClientRect();
    const w = rect.width || 320;
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
    }, params.lifetime || 1600);

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
      // main / bonus
      let scoreGain = 10;
      if (target.type === 'bonus') scoreGain = 20;

      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      const bonus = Math.floor(this.combo / 5) * 2;
      this.score += scoreGain + bonus;

      this._updateScoreHUD();
      this._updateComboHUD();

      // เพิ่มเกจ FEVER ตามชนิดเป้า
      this._addFever(target.type === 'bonus' ? 0.08 : 0.04);

      const dmg = target.type === 'bonus' ? 2 : 1;
      this._applyBossDamage(dmg);

      if (this.elHUD.feedback) {
        if (this.combo >= 10) {
          this.elHUD.feedback.textContent = `สุดยอด! คอมโบต่อเนื่อง ${this.combo} ครั้ง 🎉`;
        } else {
          this.elHUD.feedback.textContent = 'ดีมาก! รักษาจังหวะไว้ให้ได้ 👊';
        }
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

    if (target.type === 'main') {
      this.combo = 0;
      this._updateComboHUD();
      if (this.elHUD.feedback) {
        this.elHUD.feedback.textContent = 'เป้าหลุดไป 1 ลูก ลองโฟกัสใหม่อีกครั้งนะ 🔁';
      }
    }

    if (target.cleanup) target.cleanup();
  }

  _removeTarget(target) {
    const idx = this.activeTargets.indexOf(target);
    if (idx >= 0) this.activeTargets.splice(idx, 1);
  }

  _addFever(delta) {
    this.fever = Math.max(0, Math.min(1, this.fever + delta));
    this._updateFeverHUD();
  }

  _applyBossDamage(dmg) {
    if (typeof this.onBossHit === 'function') {
      this.onBossHit(dmg);
      return;
    }

    const info = this.boss.hit(dmg); // { hp, maxHP, phase, nearDeath }
    this.bossPhase = info.phase;
    this.nearDeath = info.nearDeath;

    this._updateBossHPHUD();
    this._updatePhaseHUD();
    this._updateNearDeathVisual();

    if (info.hp <= 0) {
      this._handleBossDown();
    }
  }

  _handleBossDown() {
    // รางวัลจากบอสตัวปัจจุบัน
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
      this._addFever(r.fever);
    }
    if (this.elHUD.feedback && r.text) {
      this.elHUD.feedback.textContent = r.text;
    }
  }

  _resetBossForCurrent(resetHPBar) {
    this.boss = new ShadowBossState(this.difficulty);
    this.bossPhase = 1;
    this.nearDeath = false;
    this.spawnedBossFace = false;

    if (resetHPBar !== false) {
      this._updateBossHPHUD();
    }
    this._updatePhaseHUD();
    this._updateNearDeathVisual();
    this._updateBossPortrait();
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
      `บอสที่ถึง: ${this.bossIndex + 1} / ${BOSS_TABLE.length}`,
      `BOSS HP สุดท้าย: ${this.boss.hp}/${this.boss.maxHP}`
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
