// === js/engine.js — Shadow Breaker core (2025-11-22b) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function safePlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

function setText(el, txt) {
  if (el) el.textContent = txt;
}

/* ---------------- CONFIG ---------------- */

const GAME_DURATION = 60;

const DIFF_CONFIG = {
  easy: {
    spawnInterval: 950,
    targetLifetime: 1400,
    decoyRate: 0.14,
    baseBossHp: 80,
    playerDamageOnMiss: 4,
    feverGain: { perfect: 8, good: 5, bad: 3 },
    feverLossMiss: 10,
    sizePx: 120
  },
  normal: {
    spawnInterval: 800,
    targetLifetime: 1200,
    decoyRate: 0.22,
    baseBossHp: 110,
    playerDamageOnMiss: 6,
    feverGain: { perfect: 7, good: 4, bad: 2 },
    feverLossMiss: 12,
    sizePx: 100
  },
  hard: {
    spawnInterval: 650,
    targetLifetime: 1050,
    decoyRate: 0.28,
    baseBossHp: 140,
    playerDamageOnMiss: 8,
    feverGain: { perfect: 6, good: 3, bad: 2 },
    feverLossMiss: 14,
    sizePx: 86
  }
};

const BOSSES = [
  {
    id: 1,
    name: 'Bubble Glove',
    emoji: '🐣',
    title: 'บอสมือใหม่สายฟอง',
    desc: 'เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัพ 🔰'
  },
  {
    id: 2,
    name: 'Neon Knuckle',
    emoji: '🌀',
    title: 'หมัดนีออนสายสปีด',
    desc: 'เป้าเร็วขึ้น มีเป้าลวงคอยกวนสมาธิ 💫'
  },
  {
    id: 3,
    name: 'Shadow Guard',
    emoji: '🛡️',
    title: 'ผู้พิทักษ์เงา',
    desc: 'ต้องตีต่อเนื่อง ไม่งั้น HP ไม่ลดเท่าที่ควร 🛡️'
  },
  {
    id: 4,
    name: 'Final Burst',
    emoji: '💀',
    title: 'บอสสุดท้ายสายระเบิด',
    desc: 'ช่วงท้ายจะ spawn เป้าเร็วมาก เน้นโหมด FEVER ⚡'
  }
];

/* ---------------- GAME CLASS ---------------- */

class ShadowBreakerGame {
  constructor() {
    this.viewMenu   = $('#view-menu');
    this.viewForm   = $('#view-research-form');
    this.viewPlay   = $('#view-play');
    this.viewResult = $('#view-result');

    this.statMode    = $('#stat-mode');
    this.statDiff    = $('#stat-diff');
    this.statScore   = $('#stat-score');
    this.statHp      = $('#stat-hp');
    this.statCombo   = $('#stat-combo');
    this.statPerfect = $('#stat-perfect');
    this.statMiss    = $('#stat-miss');
    this.statTime    = $('#stat-time');

    this.feverFill   = $('#fever-fill');
    this.feverStatus = $('#fever-status');

    this.bossName          = $('#boss-name');
    this.bossFill          = $('#boss-fill');
    this.bossHpVal         = $('#hp-boss-val');
    this.bossPortraitEmoji = $('#boss-portrait-emoji');
    this.bossPortraitName  = $('#boss-portrait-name');
    this.bossPortraitHint  = $('#boss-portrait-hint');
    this.bossPortraitBox   = $('#boss-portrait');
    this.wrap              = $('#sb-wrap');

    this.bossIntro      = $('#boss-intro');
    this.bossIntroEmoji = $('#boss-intro-emoji');
    this.bossIntroName  = $('#boss-intro-name');
    this.bossIntroTitle = $('#boss-intro-title');
    this.bossIntroDesc  = $('#boss-intro-desc');

    this.resMode        = $('#res-mode');
    this.resDiff        = $('#res-diff');
    this.resEndReason   = $('#res-endreason');
    this.resScore       = $('#res-score');
    this.resMaxCombo    = $('#res-maxcombo');
    this.resMiss        = $('#res-miss');
    this.resAccuracy    = $('#res-accuracy');
    this.resTotalHits   = $('#res-totalhits');
    this.resRtNormal    = $('#res-rt-normal');
    this.resRtDecoy     = $('#res-rt-decoy');
    this.resParticipant = $('#res-participant');

    this.targetLayer = $('#target-layer');
    this.renderer = this.targetLayer
      ? new DomRenderer(this, this.targetLayer, { sizePx: 100 })
      : null;

    this.resetState();
    this.wireUI();
  }

  resetState() {
    this.mode   = 'normal';
    this.diff   = 'normal';
    this.config = DIFF_CONFIG.normal;

    this.running   = false;
    this.ended     = false;
    this.timeLeft  = GAME_DURATION;
    this._loopHandle = null;
    this._spawnTimer = null;
    this._startTime  = 0;

    this.playerHp = 100;
    this.score    = 0;
    this.combo    = 0;
    this.maxCombo = 0;
    this.perfect  = 0;
    this.miss     = 0;

    this.totalTargets = 0;
    this.hitCount     = 0;

    this.targets = new Map();
    this._nextTargetId = 1;

    this.fever     = 0;
    this.feverOn   = false;
    this._feverTimeout = null;

    this.bossIndex   = 0;
    this.currentBoss = BOSSES[0];
    this.bossHpMax   = this.hpForBoss(0);
    this.bossHp      = this.bossHpMax;

    this.researchMeta = { participant:'', group:'', note:'' };
    this.hitLogs      = [];
  }

  hpForBoss(idx) {
    const base = this.config.baseBossHp;
    return Math.round(base * (1 + idx * 0.15));
  }

  wireUI() {
    if (this.viewMenu) {
      const btnResearch = this.viewMenu.querySelector('[data-action="start-research"]');
      const btnNormal   = this.viewMenu.querySelector('[data-action="start-normal"]');

      btnResearch && btnResearch.addEventListener('click', () => {
        this.showView('research-form');
      });
      btnNormal && btnNormal.addEventListener('click', () => {
        this.mode = 'normal';
        this.startFromMenu();
      });
    }

    if (this.viewForm) {
      const btnBack   = this.viewForm.querySelector('[data-action="back-to-menu"]');
      const btnBegin  = this.viewForm.querySelector('[data-action="research-begin-play"]');

      btnBack && btnBack.addEventListener('click', () => this.showView('menu'));

      btnBegin && btnBegin.addEventListener('click', () => {
        const id    = $('#research-id')?.value.trim() || '';
        const group = $('#research-group')?.value.trim() || '';
        const note  = $('#research-note')?.value.trim() || '';
        this.mode = 'research';
        this.researchMeta = {
          participant: id   || '-',
          group:       group|| '-',
          note:        note || '-'
        };
        this.startFromMenu();
      });
    }

    if (this.viewPlay) {
      const btnStop = this.viewPlay.querySelector('[data-action="stop-early"]');
      btnStop && btnStop.addEventListener('click', () => this.stopGame('หยุดก่อนเวลา'));
    }

    if (this.viewResult) {
      const btnBack  = this.viewResult.querySelector('[data-action="back-to-menu"]');
      const btnAgain = this.viewResult.querySelector('[data-action="play-again"]');
      const btnCsv   = this.viewResult.querySelector('[data-action="download-csv"]');

      btnBack  && btnBack.addEventListener('click', () => this.showView('menu'));
      btnAgain && btnAgain.addEventListener('click', () => this.startFromMenu(true));
      btnCsv   && btnCsv.addEventListener('click', () => this.downloadCsv());
    }

    if (this.bossIntro) {
      this.bossIntro.addEventListener('pointerdown', () => this.hideBossIntro());
    }

    window.addEventListener('keydown', (ev) => {
      if (!this.running) return;
      if (ev.key === ' ') ev.preventDefault();
    });
  }

  showView(name) {
    const hide = (el) => el && el.classList.add('hidden');
    const show = (el) => el && el.classList.remove('hidden');

    hide(this.viewMenu);
    hide(this.viewForm);
    hide(this.viewPlay);
    hide(this.viewResult);
    this.bossIntro && hide(this.bossIntro);

    if (name === 'menu') show(this.viewMenu);
    else if (name === 'research-form') show(this.viewForm);
    else if (name === 'play') show(this.viewPlay);
    else if (name === 'result') show(this.viewResult);
  }

  startFromMenu(useSameDiff = false) {
    if (!useSameDiff) {
      const sel = $('#difficulty');
      this.diff = (sel && sel.value) || 'normal';
    }
    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;

    this.resetState();
    this.config = DIFF_CONFIG[this.diff] || DIFF_CONFIG.normal;

    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    if (this.renderer) this.renderer.sizePx = this.config.sizePx;

    setText(this.statMode, this.mode === 'research' ? 'Research' : 'Normal');
    setText(this.statDiff, this.diff);

    this.updateHUD();
    this.updateBossHUD();
    this.updateFeverHUD();

    this.showView('play');

    this.showBossIntro(this.currentBoss, {
      first: true,
      onDone: () => this.beginGameLoop()
    });
  }

  beginGameLoop() {
    if (this.running) return;
    this.running = true;
    this.ended   = false;
    this.timeLeft = GAME_DURATION;
    this._startTime = performance.now();

    this.targets.clear();
    if (this.renderer) this.renderer.clear();

    if (this._spawnTimer) clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(() => this.spawnTarget(), this.config.spawnInterval);

    const loop = (t) => {
      if (!this.running) return;
      const elapsed = (t - this._startTime) / 1000;
      this.timeLeft = clamp(GAME_DURATION - elapsed, 0, GAME_DURATION);
      this.statTime && (this.statTime.textContent = this.timeLeft.toFixed(1));
      if (this.timeLeft <= 0) {
        this.stopGame('หมดเวลา');
        return;
      }
      this._loopHandle = requestAnimationFrame(loop);
    };
    this._loopHandle = requestAnimationFrame(loop);
  }

  stopGame(reason) {
    if (!this.running && this.ended) return;
    this.running = false;
    this.ended   = true;

    this._spawnTimer && clearInterval(this._spawnTimer);
    this._spawnTimer = null;
    this._loopHandle && cancelAnimationFrame(this._loopHandle);
    this._loopHandle = null;
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout = null;

    this.targets.clear();
    if (this.renderer) this.renderer.clear();

    const totalShots = this.hitCount + this.miss;
    const accuracy   = totalShots > 0 ? (this.hitCount / totalShots) * 100 : 0;

    setText(this.resMode,      this.mode === 'research' ? 'วิจัย' : 'ปกติ');
    setText(this.resDiff,      this.diff);
    setText(this.resEndReason, reason || '-');
    setText(this.resScore,     String(this.score));
    setText(this.resMaxCombo,  String(this.maxCombo));
    setText(this.resMiss,      String(this.miss));
    setText(this.resAccuracy,  accuracy.toFixed(1) + ' %');
    setText(this.resTotalHits, String(this.hitCount));
    setText(this.resRtNormal,  '-');
    setText(this.resRtDecoy,   '-');
    setText(this.resParticipant, this.researchMeta.participant || '-');

    this.showView('result');
  }

  /* -------- BOSS -------- */

  updateBossHUD() {
    const boss = this.currentBoss;
    if (!boss) return;

    this.wrap && (this.wrap.dataset.boss = String(this.bossIndex));
    const ratio = clamp(this.bossHp / this.bossHpMax, 0, 1);

    setText(this.bossName, `Boss ${boss.id}/4 — ${boss.name}`);
    this.bossHpVal && (this.bossHpVal.textContent = Math.round(ratio * 100) + '%');
    this.bossFill && (this.bossFill.style.transform = `scaleX(${ratio})`);

    setText(this.bossPortraitEmoji, boss.emoji);
    setText(this.bossPortraitName, boss.name);
    setText(this.bossPortraitHint, `HP เหลือประมาณ ${Math.round(ratio * 100)}%`);

    if (this.bossPortraitBox) {
      if (ratio <= 0.25) this.bossPortraitBox.classList.add('sb-shake');
      else this.bossPortraitBox.classList.remove('sb-shake');
    }
  }

  showBossIntro(boss, opts = {}) {
    if (!boss || !this.bossIntro) return;
    setText(this.bossIntroEmoji, boss.emoji);
    setText(this.bossIntroName,  boss.name);
    setText(this.bossIntroTitle, boss.title);
    setText(this.bossIntroDesc,  boss.desc);
    this.bossIntro.classList.remove('hidden');
    this._introActive = true;
    this._introOnDone = opts.onDone || null;
    safePlay('sfx-boss');
  }

  hideBossIntro() {
    if (!this._introActive || !this.bossIntro) return;
    this._introActive = false;
    this.bossIntro.classList.add('hidden');
    if (this._introOnDone) {
      const fn = this._introOnDone;
      this._introOnDone = null;
      fn();
    }
  }

  advanceBoss() {
    this.bossIndex++;
    // เคลียร์บอส → เติม HP ผู้เล่นเล็กน้อย
    this.playerHp = clamp(this.playerHp + 20, 0, 100);

    if (this.bossIndex >= BOSSES.length) {
      this.updateHUD();
      this.stopGame('เคลียร์บอสครบทั้ง 4 ตัว!');
      return;
    }
    this.currentBoss = BOSSES[this.bossIndex];
    this.bossHpMax   = this.hpForBoss(this.bossIndex);
    this.bossHp      = this.bossHpMax;

    this.updateHUD();
    this.updateBossHUD();
    this.showBossIntro(this.currentBoss, { onDone: () => {} });
  }

  /* -------- FEVER -------- */

  updateFeverHUD() {
    const ratio = clamp(this.fever / 100, 0, 1);
    this.feverFill && (this.feverFill.style.transform = `scaleX(${ratio})`);

    if (!this.feverStatus) return;
    if (this.feverOn) {
      this.feverStatus.textContent = 'FEVER!!';
      this.feverStatus.classList.add('on');
    } else {
      this.feverStatus.classList.remove('on');
      this.feverStatus.textContent = ratio >= 1 ? 'READY' : 'FEVER';
    }
  }

  addFever(kind) {
    if (this.feverOn) return;
    const gain = this.config.feverGain[kind] || 3;
    this.fever = clamp(this.fever + gain, 0, 100);
    this.updateFeverHUD();
    if (this.fever >= 100) this.triggerFever();
  }

  loseFeverOnMiss() {
    if (this.feverOn) return;
    this.fever = clamp(this.fever - this.config.feverLossMiss, 0, 100);
    this.updateFeverHUD();
  }

  triggerFever() {
    if (this.feverOn) return;
    this.feverOn = true;
    safePlay('sfx-fever');
    this.updateFeverHUD();
    this._feverTimeout && clearTimeout(this._feverTimeout);
    this._feverTimeout = setTimeout(() => {
      this.feverOn = false;
      this.fever = 40;
      this.updateFeverHUD();
    }, 7000);
  }

  /* -------- TARGETS -------- */

  spawnTarget() {
    if (!this.running) return;

    if (!this.renderer || !this.renderer.host) {
      this.targetLayer = document.querySelector('#target-layer');
      if (this.targetLayer) {
        this.renderer = new DomRenderer(this, this.targetLayer, {
          sizePx: this.config.sizePx || 100
        });
      } else {
        console.warn('ShadowBreaker: #target-layer not found');
        return;
      }
    }

    const id = this._nextTargetId++;
    const decoy = Math.random() < this.config.decoyRate;
    const now   = performance.now();

    let emoji;
    if (!decoy && Math.random() < 0.18) {
      emoji = this.currentBoss?.emoji || '🥊';
    } else {
      emoji = decoy ? '💣' : '🥊';
    }

    const t = {
      id,
      emoji,
      decoy,
      createdAt: now,
      lifetime: this.config.targetLifetime,
      hit: false,
      _el: null,
      _onPtr: null,
      lastPos: null
    };

    this.targets.set(id, t);
    this.totalTargets++;

    this.renderer.spawnTarget(t);

    setTimeout(() => {
      const cur = this.targets.get(id);
      if (!cur || cur.hit) return;
      this.handleMiss(cur);
    }, this.config.targetLifetime + 80);
  }

  registerTouch(x, y, targetId) {
    if (!this.running) return;
    if (targetId == null) return;
    const t = this.targets.get(targetId);
    if (!t || t.hit) return;

    const now  = performance.now();
    const age  = now - t.createdAt;
    const life = this.config.targetLifetime;

    let grade = 'bad';
    if (age <= life * 0.33) grade = 'perfect';
    else if (age <= life * 0.66) grade = 'good';

    if (t.decoy) this.handleDecoyHit(t);
    else this.handleHit(t, grade, age);
  }

  handleHit(t, grade, ageMs) {
    t.hit = true;
    this.targets.delete(t.id);

    let baseScore = 0;
    if (grade === 'perfect') baseScore = 120;
    else if (grade === 'good') baseScore = 80;
    else baseScore = 40;

    let dmg = grade === 'perfect' ? 8 : grade === 'good' ? 5 : 3;
    if (this.feverOn) {
      baseScore = Math.round(baseScore * 1.5);
      dmg       = Math.round(dmg * 1.8);
    }

    this.score += baseScore;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (grade === 'perfect') this.perfect++;
    this.hitCount++;

    this.addFever(grade === 'perfect' ? 'perfect' : 'good');

    this.bossHp = clamp(this.bossHp - dmg, 0, this.bossHpMax);
    this.updateBossHUD();

    this.renderer && this.renderer.spawnHitEffect(t, {
      grade,
      score: baseScore,
      fever: this.feverOn
    });
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts: (performance.now() - this._startTime) / 1000,
      id: t.id,
      decoy: false,
      grade,
      ageMs
    });

    if (this.bossHp <= 0) this.advanceBoss();
    this.updateHUD();
  }

  handleDecoyHit(t) {
    t.hit = true;
    this.targets.delete(t.id);

    // หักคะแนน + HP แต่ "ไม่" นับเป็น Miss
    this.score    = Math.max(0, this.score - 60);
    this.combo    = 0;
    this.playerHp = clamp(this.playerHp - 10, 0, 100);
    this.loseFeverOnMiss();

    this.renderer && this.renderer.spawnHitEffect(t, {
      decoy: true,
      grade: 'bad',
      score: -60
    });
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts: (performance.now() - this._startTime) / 1000,
      id: t.id,
      decoy: true,
      grade: 'bad'
    });

    if (this.playerHp <= 0) {
      this.updateHUD();
      this.stopGame('HP ผู้เล่นหมด');
      return;
    }
    this.updateHUD();
  }

  handleMiss(t) {
    if (!this.targets.has(t.id) || t.hit) return;
    this.targets.delete(t.id);

    this.miss++;
    this.combo = 0;
    this.playerHp = clamp(this.playerHp - this.config.playerDamageOnMiss, 0, 100);
    this.loseFeverOnMiss();

    this.renderer && this.renderer.spawnHitEffect(t, { miss: true, score: 0 });
    safePlay('sfx-hit');

    this.hitLogs.push({
      ts: (performance.now() - this._startTime) / 1000,
      id: t.id,
      decoy: t.decoy,
      grade: 'miss'
    });

    if (this.playerHp <= 0) {
      this.updateHUD();
      this.stopGame('HP ผู้เล่นหมด');
      return;
    }
    this.updateHUD();
  }

  updateHUD() {
    setText(this.statScore,   String(this.score));
    setText(this.statHp,      String(this.playerHp));
    setText(this.statCombo,   String(this.combo));
    setText(this.statPerfect, String(this.perfect));
    setText(this.statMiss,    String(this.miss));
  }

  /* -------- CSV โหมดวิจัย -------- */

  downloadCsv() {
    if (this.mode !== 'research') {
      alert('การดาวน์โหลด CSV ใช้ในโหมดวิจัยเท่านั้น');
      return;
    }
    if (!this.hitLogs.length) {
      alert('ยังไม่มีข้อมูลรอบเล่นสำหรับบันทึก');
      return;
    }
    const header = [
      'participant','group','note',
      'timestamp_s','target_id','is_decoy','grade','age_ms'
    ];
    const rows = [header.join(',')];

    for (const log of this.hitLogs) {
      rows.push([
        JSON.stringify(this.researchMeta.participant || ''),
        JSON.stringify(this.researchMeta.group || ''),
        JSON.stringify(this.researchMeta.note || ''),
        log.ts.toFixed(3),
        log.id,
        log.decoy ? 1 : 0,
        log.grade,
        log.ageMs != null ? log.ageMs.toFixed(1) : ''
      ].join(','));
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const pid  = (this.researchMeta.participant || 'Pxxx').replace(/[^a-z0-9_-]/gi, '');
    a.href = url;
    a.download = `shadow-breaker-${pid}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/* ---------------- PUBLIC INIT ---------------- */

export function initShadowBreaker() {
  try {
    const game = new ShadowBreakerGame();
    window.__shadowBreaker = game;
  } catch (e) {
    console.error('ShadowBreaker init error', e);
  }
}