// === js/engine.js — Shadow Breaker x DomRenderer + Research Logger (2025-11-24) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { computeShadowSpawnParams, ShadowBossState } from './shadow-config.js';

const BUILD_VERSION = 'shadowBreaker_sbRoot_v1';

const BOSS_TABLE = [
  {
    id: 0,
    emoji: '🫧',
    name: 'Bubble Glove',
    title: 'หมัดฟองสบู่วอร์มอัป',
    hint: 'เป้าใหญ่ เด้งช้า วอร์มอัปก่อนลุยจริง',
    reward: { heal: 1, score: 80, fever: 0.25 }
  },
  {
    id: 1,
    emoji: '🌀',
    name: 'Vortex Fist',
    title: 'หมัดหมุนพายุ',
    hint: 'เริ่มมีเป้าหลอกปนมา ระวังโชคร้าย 💣',
    reward: { heal: 0, score: 120, fever: 0.3 }
  },
  {
    id: 2,
    emoji: '🛡️',
    name: 'Shadow Guard',
    title: 'ผู้พิทักษ์เงา',
    hint: 'อย่าปล่อยให้เป้าหลุดติดกันหลายลูก',
    reward: { heal: 1, score: 150, fever: 0.35 }
  },
  {
    id: 3,
    emoji: '☠️',
    name: 'Final Burst',
    title: 'บอสใหญ่ไฟนอล',
    hint: 'ช่วงท้ายถี่และเล็ก ต้องโฟกัสสุดๆ!',
    reward: { heal: 0, score: 200, fever: 0.5 }
  }
];

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));

function safePlaySfx(id, intensity = 0.8) {
  if (!window.SFX || !window.SFX.play) return;
  try {
    window.SFX.play(id, {
      group: id,
      intensity,
      minGap: id === 'hit' ? 40 : 200
    });
  } catch {}
}

class ShadowBreakerGame {
  constructor(opts = {}) {
    // host หลัก
    this.root =
      document.getElementById('sb-root') ||
      document.querySelector('.sb-wrap') ||
      document.body;

    // HUD elements (ตาม shadow-breaker.html การ์ดล่าสุด)
    const q = (sel) => this.root.querySelector(sel);
    this.el = {
      barPlayer:  q('[data-sb-player-hp]'),
      txtPlayer:  q('[data-sb-player-hp-text]'),
      barBoss:    q('[data-sb-boss-hp]'),
      txtBoss:    q('[data-sb-boss-hp-text]'),
      timer:      q('[data-sb-timer]'),
      score:      q('[data-sb-score]'),
      combo:      q('[data-sb-combo]'),
      phase:      q('[data-sb-phase]'),
      feverFill:  q('[data-sb-fever]'),
      feverStatus:q('[data-sb-fever-status]'),
      feedback:   document.getElementById('sbFeedback'),

      bossPortrait: document.getElementById('boss-portrait'),
      bossName:     document.getElementById('boss-portrait-name'),
      bossHint:     document.getElementById('boss-portrait-hint'),

      modeNormalBtn:   document.getElementById('modeNormalBtn'),
      modeResearchBtn: document.getElementById('modeResearchBtn'),
      startBtn:        document.getElementById('startBtn'),
      csvBtn:          document.getElementById('csvBtn'),
      researchPanel:   document.getElementById('researchPanel'),
      diffSelect:      document.getElementById('diffSelect'),
      timeSelect:      document.getElementById('timeSelect'),
      participantId:   document.getElementById('participantId'),
      researchNote:    document.getElementById('researchNote')
    };

    // field / stage (ใช้เป็น host ของ DomRenderer)
    this.stage = q('[data-sb-field]') || q('.sb-field') || this.root;
    if (this.stage && getComputedStyle(this.stage).position === 'static') {
      this.stage.style.position = 'relative';
    }

    // overlay บอส intro ตาม HTML ล่าสุด
    this.bossIntro = document.getElementById('bossIntro');

    // Renderer + Logger
    this.renderer      = this.stage ? new DomRenderer(this, this.stage, { sizePx: 100 }) : null;
    this.eventLogger   = new EventLogger();
    this.sessionLogger = new SessionLogger();

    // Telemetry / research meta
    this.sessionId  = this._makeSessionId();
    this.errorLogs  = [];
    this.focusLogs  = [];
    this.researchMeta = { participant: '', group: '', note: '' };

    // สถานะเกม core
    this.mode         = 'normal';    // normal / research
    this.diff         = 'normal';    // easy / normal / hard
    this.durationSec  = 60;
    this.timeLeft     = this.durationSec;
    this.running      = false;
    this.ended        = false;

    this.playerMaxHP  = 5;
    this.playerHP     = this.playerMaxHP;
    this.score        = 0;
    this.combo        = 0;
    this.maxCombo     = 0;

    this.fever        = 0;           // 0..1
    this.feverOn      = false;

    this.bossIndex    = 0;
    this.boss         = new ShadowBossState(this.diff);
    this.bossPhase    = 1;
    this.nearDeath    = false;

    this.targets      = new Map();
    this._nextTargetId= 1;
    this.phaseSpawnCounter = { 1:0, 2:0, 3:0 };

    this.hitCount     = 0;
    this.missCount    = 0;
    this.bombHits     = 0;
    this.perfectCount = 0;
    this.goodCount    = 0;
    this.badCount     = 0;

    this._startTime   = 0;
    this._startWallClock = '';
    this.spawnTimer   = null;
    this.timerTick    = null;

    this._feedbackTimer = null;

    this._setupTelemetry();
    this._wireUI();
    this._resetBossForCurrent(true);
    this._updateHUDAll();

    // sync จาก options / query string (เผื่อเรียกจาก URL)
    const url = new URL(window.location.href);
    const optMode = opts.mode || url.searchParams.get('mode');
    const optDiff = opts.difficulty || url.searchParams.get('diff');
    const optTime = opts.durationSec || url.searchParams.get('time');
    if (optMode) this.mode = (optMode === 'research') ? 'research' : 'normal';
    if (optDiff) this.diff = optDiff;
    if (optTime) {
      const v = parseInt(optTime, 10);
      if (!Number.isNaN(v)) this.durationSec = v;
    }
    this._applyModeUI();
  }

  // ---------------------------------------------------------------------
  // Telemetry / research
  // ---------------------------------------------------------------------
  _makeSessionId() {
    const t  = new Date();
    const y  = t.getFullYear();
    const m  = String(t.getMonth() + 1).padStart(2, '0');
    const d  = String(t.getDate()).padStart(2, '0');
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    return `SB-${y}${m}${d}-${hh}${mm}${ss}`;
  }

  _setupTelemetry() {
    window.addEventListener('error', (ev) => {
      this.errorLogs.push({
        ts: new Date().toISOString(),
        msg: String(ev.message || ''),
        src: String(ev.filename || ''),
        line: ev.lineno || 0,
        col : ev.colno || 0
      });
    });

    window.addEventListener('unhandledrejection', (ev) => {
      this.errorLogs.push({
        ts: new Date().toISOString(),
        msg: 'unhandledrejection',
        reason: String(ev.reason || '')
      });
    });

    window.addEventListener('focus', () => {
      this.focusLogs.push({ ts: new Date().toISOString(), type: 'focus' });
    });
    window.addEventListener('blur', () => {
      this.focusLogs.push({ ts: new Date().toISOString(), type: 'blur' });
    });
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------
  _wireUI() {
    const el = this.el;

    // mode buttons
    el.modeNormalBtn?.addEventListener('click', () => {
      this.mode = 'normal';
      this._applyModeUI();
    });
    el.modeResearchBtn?.addEventListener('click', () => {
      this.mode = 'research';
      this._applyModeUI();
    });

    // diff / time
    el.diffSelect?.addEventListener('change', () => {
      this.diff = el.diffSelect.value || 'normal';
      if (this.root) this.root.dataset.diff = this.diff;
      this._resetBossForCurrent(true);
      this._updateHUDAll();
    });
    el.timeSelect?.addEventListener('change', () => {
      const v = parseInt(el.timeSelect.value || '60', 10);
      this.durationSec = Number.isNaN(v) ? 60 : v;
      this.timeLeft = this.durationSec;
      this._updateTimerHUD();
    });

    // start
    el.startBtn?.addEventListener('click', () => {
      if (el.diffSelect) this.diff = el.diffSelect.value || 'normal';
      if (el.timeSelect) {
        const v = parseInt(el.timeSelect.value || '60', 10);
        this.durationSec = Number.isNaN(v) ? 60 : v;
      }
      if (el.participantId) {
        this.researchMeta.participant = el.participantId.value.trim() || '';
      }
      if (el.researchNote) {
        this.researchMeta.note = el.researchNote.value.trim() || '';
      }
      if (this.root) this.root.dataset.diff = this.diff;
      this.startGame();
    });

    // CSV download (ใช้ไฟล์ logger ทั้ง event+session)
    el.csvBtn?.addEventListener('click', () => {
      if (this.mode !== 'research') {
        window.alert('โหมด Research เท่านั้นที่จะดาวน์โหลด CSV ได้ค่ะ');
        return;
      }
      this._downloadEventCsv();
      this._downloadSessionCsv();
    });

    // ป้องกัน spacebar scroll ระหว่างเล่น
    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.key === ' ') ev.preventDefault();
    });
  }

  _applyModeUI() {
    const el = this.el;
    const isResearch = (this.mode === 'research');

    if (el.modeNormalBtn) {
      el.modeNormalBtn.classList.toggle('primary', !isResearch);
      el.modeNormalBtn.classList.toggle('ghost', isResearch);
    }
    if (el.modeResearchBtn) {
      el.modeResearchBtn.classList.toggle('primary', isResearch);
      el.modeResearchBtn.classList.toggle('ghost', !isResearch);
    }
    if (el.researchPanel) {
      el.researchPanel.classList.toggle('hidden', !isResearch);
    }
    if (el.csvBtn) {
      el.csvBtn.classList.toggle('hidden', !isResearch);
    }
  }

  // ---------------------------------------------------------------------
  // HUD update
  // ---------------------------------------------------------------------
  _pad(n) { return n < 10 ? '0' + n : '' + n; }

  _updateHUDAll() {
    this._updateTimerHUD();
    this._updateScoreHUD();
    this._updateComboHUD();
    this._updatePlayerHPHUD();
    this._updateBossHPHUD();
    this._updatePhaseHUD();
    this._updateFeverHUD();
    this._updateBossPortrait();
  }

  _updateTimerHUD() {
    if (!this.el.timer) return;
    const sec = Math.max(0, Math.floor(this.timeLeft));
    this.el.timer.textContent = `00:${this._pad(sec)}`;
  }
  _updateScoreHUD() {
    if (this.el.score) this.el.score.textContent = String(this.score);
  }
  _updateComboHUD() {
    if (this.el.combo) this.el.combo.textContent = String(this.combo);
  }
  _updatePhaseHUD() {
    if (this.el.phase) this.el.phase.textContent = String(this.bossPhase);
    if (this.root) this.root.dataset.phase = String(this.bossPhase);
  }
  _updatePlayerHPHUD() {
    const ratio = this.playerMaxHP > 0 ? this.playerHP / this.playerMaxHP : 0;
    if (this.el.barPlayer) {
      this.el.barPlayer.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
      this.el.barPlayer.classList.toggle('low', ratio <= 0.4);
    }
    if (this.el.txtPlayer) {
      this.el.txtPlayer.textContent = `${this.playerHP}/${this.playerMaxHP}`;
    }
  }
  _updateBossHPHUD() {
    const ratio = this.boss.maxHP > 0 ? this.boss.hp / this.boss.maxHP : 0;
    if (this.el.barBoss) {
      this.el.barBoss.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
      this.el.barBoss.classList.toggle('low', ratio <= 0.4);
    }
    if (this.el.txtBoss) {
      this.el.txtBoss.textContent = `${this.boss.hp}/${this.boss.maxHP}`;
    }
  }
  _updateFeverHUD() {
    const v = clamp(this.fever, 0, 1);
    if (this.el.feverFill) {
      this.el.feverFill.style.transform = `scaleX(${v})`;
    }
    if (this.el.feverStatus) {
      if (this.fever >= 1) {
        this.feverOn = true;
        this.el.feverStatus.textContent = 'FEVER!!';
        this.el.feverStatus.classList.add('on');
      } else if (this.fever > 0) {
        this.feverOn = false;
        this.el.feverStatus.textContent = 'Charge';
        this.el.feverStatus.classList.remove('on');
      } else {
        this.feverOn = false;
        this.el.feverStatus.textContent = 'Ready';
        this.el.feverStatus.classList.remove('on');
      }
    }
  }
  _updateNearDeathVisual() {
    if (!this.el.bossPortrait) return;
    this.el.bossPortrait.classList.toggle('sb-shake', !!this.nearDeath);
  }
  _updateBossPortrait() {
    const def = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    if (this.el.bossPortrait) this.el.bossPortrait.textContent = def.emoji || '🥊';
    if (this.el.bossName) this.el.bossName.textContent = def.name || 'Boss';
    if (this.el.bossHint) this.el.bossHint.textContent = def.hint || '';
    if (this.root) this.root.dataset.boss = String(this.bossIndex);
  }

  _setFeedback(kind) {
    const fb = this.el.feedback;
    if (!fb) return;
    let text = '';
    switch (kind) {
      case 'perfect': text = 'ตรงเป๊ะ! ⭐'; break;
      case 'good':    text = 'ดีมาก! รักษาจังหวะไว้ 👊'; break;
      case 'miss':    text = 'พลาดเป้า ลองใหม่ 😅'; break;
      case 'bomb':    text = 'โดนระเบิด! -HP ⚠️'; break;
      case 'heal':    text = 'ชนะบอส ฟื้น HP + โบนัส 🎉'; break;
      default:
        text = 'ตีเป้าให้ทันก่อนหายไป แล้วดูว่าคอมโบจะยาวแค่ไหน!';
    }
    fb.textContent = text;

    if (this._feedbackTimer) {
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    if (kind && kind !== 'heal') {
      this._feedbackTimer = setTimeout(() => {
        this._setFeedback('');
      }, 1400);
    }
  }

  // ---------------------------------------------------------------------
  // Boss intro
  // ---------------------------------------------------------------------
  _showBossIntro() {
    if (!this.bossIntro) return;
    const def = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    const eEmoji = this.bossIntro.querySelector('.boss-intro-emoji');
    const eName  = this.bossIntro.querySelector('.boss-intro-name');
    const eTitle = this.bossIntro.querySelector('.boss-intro-title');
    const eDesc  = this.bossIntro.querySelector('.boss-intro-desc');
    const eHint  = this.bossIntro.querySelector('.boss-intro-hint');

    if (eEmoji) eEmoji.textContent = def.emoji || '🥊';
    if (eName)  eName.textContent  = def.name || 'Boss';
    if (eTitle) eTitle.textContent = def.title || '';
    if (eDesc)  eDesc.textContent  = 'บอสจะส่งเป้าออกมารัว ๆ ให้คุณตีให้ทันทุกลูก!';
    if (eHint)  eHint.textContent  = def.hint || '';

    this.bossIntro.classList.remove('hidden');
    safePlaySfx('boss', 1.0);

    setTimeout(() => {
      this.bossIntro?.classList.add('hidden');
    }, 1200);
  }

  // ---------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------
  _clearAllTargets() {
    if (this.renderer) this.renderer.clear();
    this.targets.clear();
  }

  startGame() {
    if (this.running) return;

    // reset state รอบใหม่ (ยกเว้น mode/diff/duration ที่อ่านจาก UI ไปแล้ว)
    this.playerMaxHP = 5;
    this.playerHP    = this.playerMaxHP;
    this.score       = 0;
    this.combo       = 0;
    this.maxCombo    = 0;
    this.fever       = 0;
    this.feverOn     = false;

    this.bossIndex   = 0;
    this.boss        = new ShadowBossState(this.diff);
    this.bossPhase   = 1;
    this.nearDeath   = false;

    this.timeLeft    = this.durationSec;
    this.hitCount    = 0;
    this.missCount   = 0;
    this.bombHits    = 0;
    this.perfectCount= 0;
    this.goodCount   = 0;
    this.badCount    = 0;

    this.targets.clear();
    this._nextTargetId = 1;
    this.phaseSpawnCounter = { 1:0, 2:0, 3:0 };

    this.eventLogger.logs.length = 0;
    this.sessionLogger.clear();

    this.running    = true;
    this.ended      = false;
    this._startTime = performance.now();
    this._startWallClock = new Date().toISOString();

    if (this.root) {
      this.root.dataset.diff  = this.diff;
      this.root.dataset.boss  = String(this.bossIndex);
      this.root.dataset.phase = '1';
    }

    this._updateHUDAll();
    this._showBossIntro();
    this._startTimer();
    this._spawnLoop();
    this._setFeedback('');
  }

  _startTimer() {
    if (this.timerTick) clearInterval(this.timerTick);
    this.timerTick = setInterval(() => {
      if (!this.running) return;
      this.timeLeft -= 1;
      this._updateTimerHUD();
      if (this.timeLeft <= 0) {
        this.stopGame('หมดเวลา');
      }
    }, 1000);
  }

  stopGame(reason = 'หมดเวลา') {
    if (!this.running && this.ended) return;
    this.running = false;
    this.ended   = true;

    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
    if (this.timerTick) {
      clearInterval(this.timerTick);
      this.timerTick = null;
    }

    // ล้างเป้า
    this.targets.forEach((t) => {
      if (t.lifeTimer) clearTimeout(t.lifeTimer);
    });
    this._clearAllTargets();

    // สรุป session
    const totalShots = this.hitCount + this.missCount;
    const accuracy   = totalShots > 0 ? (this.hitCount / totalShots) * 100 : 0;

    const nowPerf = performance.now();
    const durSec  = this._startTime ? (nowPerf - this._startTime) / 1000 : 0;

    const summary = {
      session_id   : this.sessionId,
      build_version: BUILD_VERSION,

      mode        : this.mode,
      difficulty  : this.diff,
      training_phase: 'main',
      run_index   : 1,

      start_ts    : this._startWallClock || '',
      end_ts      : new Date().toISOString(),
      duration_s  : durSec.toFixed(3),
      end_reason  : reason,

      final_score : this.score,
      grade       : '',    // ยังไม่คำนวณเกรดละเอียด
      total_targets: this.hitCount + this.missCount + this.bombHits,
      total_hits  : this.hitCount,
      total_miss  : this.missCount,
      total_bombs_hit: this.bombHits,
      accuracy_pct: accuracy.toFixed(1),
      max_combo   : this.maxCombo,
      perfect_count: this.perfectCount,
      good_count   : this.goodCount,
      bad_count    : this.badCount,

      avg_rt_normal_ms: '',
      std_rt_normal_ms: '',
      avg_rt_decoy_ms : '',
      std_rt_decoy_ms : '',

      fever_count      : 0,
      fever_total_time_s: '0',
      low_hp_time_s    : '0',
      bosses_cleared   : this.bossIndex + (this.boss.hp <= 0 ? 1 : 0),
      menu_to_play_ms  : '',

      participant: this.researchMeta.participant || '',
      group      : this.researchMeta.group || '',
      note       : this.researchMeta.note || '',

      env_ua        : navigator.userAgent || '',
      env_viewport_w: window.innerWidth || 0,
      env_viewport_h: window.innerHeight || 0,
      env_input_mode: (('ontouchstart' in window) || (navigator.maxTouchPoints > 0))
        ? 'touch'
        : 'mouse',
      error_count: this.errorLogs.length,
      focus_events: this.focusLogs.length
    };

    this.sessionLogger.add(summary);

    // HUD feedback สั้น ๆ
    this._setFeedback('');
    if (this.el.feedback) {
      this.el.feedback.textContent = reason;
    }

    // alert สรุป
    const msg = [
      reason,
      `SCORE: ${this.score}`,
      `MAX COMBO: ${this.maxCombo}`,
      `BOSS ที่ถึง: ${this.bossIndex + 1} / ${BOSS_TABLE.length}`,
      `BOSS HP สุดท้าย: ${this.boss.hp}/${this.boss.maxHP}`,
      '',
      `(Build: ${BUILD_VERSION})`
    ].join('\n');
    window.alert(msg);
  }

  // ---------------------------------------------------------------------
  // Spawn & target handling (ใช้ DomRenderer + shadow-config)
  // ---------------------------------------------------------------------
  _spawnLoop() {
    if (!this.running) return;

    const bossRatio = this.boss.maxHP > 0 ? this.boss.hp / this.boss.maxHP : 1;
    const params = computeShadowSpawnParams(this.diff, bossRatio);

    this.bossPhase = params.phase;
    this.nearDeath = params.nearDeath;
    this._updatePhaseHUD();
    this._updateNearDeathVisual();

    // ปรับขนาดเป้าตาม diff + phase (ใช้ค่าเฉลี่ย [min,max])
    if (this.renderer && params.sizePx) {
      const avgSize = (params.sizePx[0] + params.sizePx[1]) / 2;
      this.renderer.sizePx = avgSize;
    }

    if (this.targets.size < (params.maxActive || 3)) {
      this._spawnOneTarget(params);
    }

    this.spawnTimer = setTimeout(
      () => this._spawnLoop(),
      params.spawnInterval || 900
    );
  }

  _spawnOneTarget(params) {
    if (!this.renderer || !this.stage) return;

    const id = this._nextTargetId++;
    const phase = params.phase || 1;
    this.phaseSpawnCounter[phase] = (this.phaseSpawnCounter[phase] || 0) + 1;

    // เลือกชนิดเป้า: main / fake / bonus
    const typeKey = _pickWeighted(params.weights || { main: 1 });
    const isDecoy = (typeKey === 'fake');
    const isBonus = (typeKey === 'bonus');

    // boss-face พิเศษเมื่อใกล้ตาย
    const bossFace = this.nearDeath && Math.random() < 0.25;

    const bossDef = BOSS_TABLE[this.bossIndex] || BOSS_TABLE[0];
    const emoji = bossFace
      ? (bossDef.emoji || '😈')
      : (isDecoy ? '💣' : '🥊');

    const now = performance.now();
    const t = {
      id,
      emoji,
      decoy   : isDecoy,
      bossFace: bossFace,
      createdAt: now,
      lifetime : params.lifetime || 1400,
      hit      : false,
      phase_at_spawn   : phase,
      phase_spawn_index: this.phaseSpawnCounter[phase],
      spawn_interval_ms: params.spawnInterval || 900,
      size_px : this.renderer.sizePx,
      x_norm  : null,
      y_norm  : null,
      zone_lr : '',
      zone_ud : '',
      _el     : null,
      _onPtr  : null
    };

    this.targets.set(id, t);

    // DomRenderer จะ set t._el, t.lastPos, x_norm, y_norm, zone_lr, zone_ud
    this.renderer.spawnTarget(t);

    // miss timeout
    t.lifeTimer = setTimeout(() => {
      if (!t.hit) this._handleMiss(t);
    }, t.lifetime + 60);
  }

  // DomRenderer จะเรียกเมื่อคลิกเป้า
  registerTouch(x, y, targetId) {
    if (!this.running) return;
    const t = this.targets.get(targetId);
    if (!t || t.hit) return;

    const now = performance.now();
    const ageMs = now - t.createdAt;
    const life  = t.lifetime;

    let grade = 'bad';
    if (ageMs <= life * 0.33) grade = 'perfect';
    else if (ageMs <= life * 0.66) grade = 'good';

    if (t.decoy) this._handleDecoyHit(t, ageMs);
    else this._handleHit(t, grade, ageMs);
  }

  _computeNormPos(t) {
    if (!t || !t.lastPos || !this.renderer || !this.renderer.host) return;
    const w = this.renderer.host.clientWidth  || 1;
    const h = this.renderer.host.clientHeight || 1;
    const x = t.lastPos.x;
    const y = t.lastPos.y;

    t.x_norm = clamp(x / w, 0, 1);
    t.y_norm = clamp(y / h, 0, 1);

    let lr = 'C';
    if (t.x_norm < 0.33) lr = 'L';
    else if (t.x_norm > 0.66) lr = 'R';

    let ud = 'M';
    if (t.y_norm < 0.33) ud = 'U';
    else if (t.y_norm > 0.66) ud = 'D';

    t.zone_lr = lr;
    t.zone_ud = ud;
  }

  _handleHit(t, grade, ageMs) {
    if (!this.targets.has(t.id) || t.hit) return;
    t.hit = true;
    this.targets.delete(t.id);
    if (t.lifeTimer) {
      clearTimeout(t.lifeTimer);
      t.lifeTimer = null;
    }

    this._computeNormPos(t);

    // คำนวณคะแนน + ดาเมจบอส
    let baseScore = 0;
    if (grade === 'perfect') baseScore = 120;
    else if (grade === 'good') baseScore = 80;
    else {
      baseScore = 40;
      this.badCount++;
    }

    let dmg = (grade === 'perfect') ? 8 : (grade === 'good' ? 5 : 3);

    if (t.bossFace) {
      baseScore = Math.round(baseScore * 1.6);
      dmg       = Math.round(dmg * 1.8);
    }
    if (this.feverOn) {
      baseScore = Math.round(baseScore * 1.5);
      dmg       = Math.round(dmg * 1.5);
    }

    const comboBefore = this.combo;
    const hpBefore    = this.playerHP;
    const feverBefore = this.fever;

    this.score += baseScore;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (grade === 'perfect') this.perfectCount++;
    if (grade === 'good')    this.goodCount++;
    this.hitCount++;

    // FEVER เพิ่มตาม grade
    const feverGain = (grade === 'perfect') ? 0.08 : 0.05;
    this.fever = clamp(this.fever + feverGain, 0, 1);

    // ดาเมจบอส (ใช้ ShadowBossState)
    const info = this.boss.hit(dmg);
    this.bossPhase = info.phase;
    this.nearDeath = info.nearDeath;

    this._updateBossHPHUD();
    this._updatePhaseHUD();
    this._updateNearDeathVisual();
    this._updateScoreHUD();
    this._updateComboHUD();
    this._updateFeverHUD();

    // FX จาก DomRenderer + particle
    if (this.renderer) {
      this.renderer.spawnHitEffect(t, {
        grade,
        score: baseScore,
        fever: this.feverOn,
        bossFace: t.bossFace
      });
    }
    this._setFeedback(grade === 'perfect' ? 'perfect' : 'good');
    safePlaySfx('hit', grade === 'perfect' ? 1.0 : 0.7);

    // log event
    const log = this._baseEventFields(t, {
      event_type : 'hit',
      ts         : (performance.now() - this._startTime) / 1000,
      grade,
      age_ms     : ageMs,
      fever_on   : this.feverOn ? 1 : 0,
      score_delta: baseScore,
      score_total: this.score,
      combo_before: comboBefore,
      combo_after : this.combo,
      player_hp_before: hpBefore,
      player_hp_after : this.playerHP,
      fever_before    : feverBefore,
      fever_after     : this.fever
    });
    this.eventLogger.add(log);

    if (this.boss.hp <= 0) {
      this._onBossDefeated();
    }
  }

  _handleDecoyHit(t, ageMs) {
    if (!this.targets.has(t.id) || t.hit) return;
    t.hit = true;
    this.targets.delete(t.id);
    if (t.lifeTimer) {
      clearTimeout(t.lifeTimer);
      t.lifeTimer = null;
    }

    this._computeNormPos(t);

    const comboBefore = this.combo;
    const hpBefore    = this.playerHP;
    const feverBefore = this.fever;

    this.score = Math.max(0, this.score - 60);
    this.combo = 0;
    this.playerHP = clamp(this.playerHP - 1, 0, this.playerMaxHP);
    this.bombHits++;

    // FEVER ลดเมื่อโดน decoy
    this.fever = clamp(this.fever - 0.12, 0, 1);

    this._updateScoreHUD();
    this._updateComboHUD();
    this._updatePlayerHPHUD();
    this._updateFeverHUD();

    if (this.renderer) {
      this.renderer.spawnHitEffect(t, {
        decoy: true,
        grade: 'bad',
        score: -60
      });
    }
    this._setFeedback('bomb');
    safePlaySfx('hit', 0.5);

    const log = this._baseEventFields(t, {
      event_type : 'bomb',
      ts         : (performance.now() - this._startTime) / 1000,
      grade      : 'bomb',
      age_ms     : ageMs,
      fever_on   : this.feverOn ? 1 : 0,
      score_delta: -60,
      score_total: this.score,
      combo_before: comboBefore,
      combo_after : this.combo,
      player_hp_before: hpBefore,
      player_hp_after : this.playerHP,
      fever_before    : feverBefore,
      fever_after     : this.fever
    });
    this.eventLogger.add(log);

    if (this.playerHP <= 0) {
      this.stopGame('HP ผู้เล่นหมด');
    }
  }

  _handleMiss(t) {
    if (!this.targets.has(t.id) || t.hit) return;
    t.hit = true;
    this.targets.delete(t.id);

    this._computeNormPos(t);

    const comboBefore = this.combo;
    const hpBefore    = this.playerHP;
    const feverBefore = this.fever;

    this.missCount++;
    this.combo = 0;
    this.playerHP = clamp(this.playerHP - 1, 0, this.playerMaxHP);
    this.fever = clamp(this.fever - 0.08, 0, 1);

    this._updateComboHUD();
    this._updatePlayerHPHUD();
    this._updateFeverHUD();

    if (this.renderer) {
      this.renderer.spawnHitEffect(t, {
        miss: true,
        score: 0
      });
    }
    this._setFeedback('miss');
    safePlaySfx('hit', 0.4);

    const log = this._baseEventFields(t, {
      event_type : 'miss',
      ts         : (performance.now() - this._startTime) / 1000,
      grade      : 'miss',
      age_ms     : null,
      fever_on   : this.feverOn ? 1 : 0,
      score_delta: 0,
      score_total: this.score,
      combo_before: comboBefore,
      combo_after : this.combo,
      player_hp_before: hpBefore,
      player_hp_after : this.playerHP,
      fever_before    : feverBefore,
      fever_after     : this.fever
    });
    this.eventLogger.add(log);

    if (this.playerHP <= 0) {
      this.stopGame('HP ผู้เล่นหมด');
    }
  }

  // ---------------------------------------------------------------------
  // Boss control
  // ---------------------------------------------------------------------
  _onBossDefeated() {
    // รางวัลจากบอส
    const def = BOSS_TABLE[this.bossIndex];
    if (def && def.reward) {
      const r = def.reward;
      this.playerHP = clamp(this.playerHP + (r.heal || 0), 0, this.playerMaxHP);
      this.score    += r.score || 0;
      this.fever    = clamp(this.fever + (r.fever || 0), 0, 1);
      this._updatePlayerHPHUD();
      this._updateScoreHUD();
      this._updateFeverHUD();
      this._setFeedback('heal');
    }

    if (this.bossIndex < BOSS_TABLE.length - 1) {
      this.bossIndex += 1;
      this._resetBossForCurrent(true);
      this._showBossIntro();
      if (this.el.feedback) {
        this.el.feedback.textContent =
          'เยี่ยม! บอสต่อไปจะเร็วขึ้นอีก ลองดูว่าจะไปได้ไกลแค่ไหน 💥';
      }
    } else {
      this.stopGame('พิชิตทุกบอสแล้ว!');
    }
  }

  _resetBossForCurrent(updateHUD = true) {
    this.boss = new ShadowBossState(this.diff);
    this.bossPhase = 1;
    this.nearDeath = false;
    if (updateHUD) {
      this._updateBossHPHUD();
      this._updatePhaseHUD();
      this._updateNearDeathVisual();
      this._updateBossPortrait();
    }
  }

  // ---------------------------------------------------------------------
  // Logging helpers
  // ---------------------------------------------------------------------
  _baseEventFields(t, extra) {
    return {
      participant: this.researchMeta.participant || '',
      group      : this.researchMeta.group || '',
      note       : this.researchMeta.note || '',

      session_id   : this.sessionId,
      build_version: BUILD_VERSION,
      mode         : this.mode,
      difficulty   : this.diff,
      training_phase: 'main',
      run_index    : 1,

      target_id : t ? t.id : '',
      boss_id   : this.bossIndex + 1,
      boss_phase: this.bossPhase,

      is_decoy   : t && t.decoy ? 1 : 0,
      is_bossface: t && t.bossFace ? 1 : 0,
      decoy      : t && t.decoy ? 1 : 0,     // compat columns
      bossFace   : t && t.bossFace ? 1 : 0,

      target_size_px   : t ? t.size_px : '',
      spawn_interval_ms: t ? t.spawn_interval_ms : '',
      phase_at_spawn   : t ? t.phase_at_spawn : '',
      phase_spawn_index: t ? t.phase_spawn_index : '',
      x_norm : t ? t.x_norm : '',
      y_norm : t ? t.y_norm : '',
      zone_lr: t ? t.zone_lr : '',
      zone_ud: t ? t.zone_ud : '',

      ...extra
    };
  }

  _downloadEventCsv() {
    if (!this.eventLogger.logs.length) {
      window.alert('ยังไม่มี Event logs สำหรับดาวน์โหลด');
      return;
    }
    const csv  = this.eventLogger.toCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const pid  = (this.researchMeta.participant || 'Pxxx').replace(/[^a-z0-9_-]/gi,'');
    a.href = url;
    a.download = `shadow-breaker-events-${pid || 'Pxxx'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _downloadSessionCsv() {
    if (!this.sessionLogger.sessions.length) {
      window.alert('ยังไม่มี Session summary สำหรับดาวน์โหลด');
      return;
    }
    const csv  = this.sessionLogger.toCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `shadow-breaker-sessions-${this.sessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// helper สำหรับน้ำหนักสุ่ม
function _pickWeighted(weights) {
  const entries = Object.entries(weights || {});
  const sum = entries.reduce((s, [, w]) => s + (w || 0), 0) || 1;
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= (w || 0);
    if (r <= 0) return k;
  }
  return entries[0]?.[0] || 'main';
}

// bootstrap จาก shadow-breaker.js
export function initShadowBreaker() {
  const game = new ShadowBreakerGame();
  window.__shadowBreaker = game;
  return game;
}
