// === Shadow Breaker Engine (fitness/js/engine.js) ===
'use strict';

import { DomRenderer } from './dom-renderer.js';

/* ---------- util ---------- */

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

/* ---------- Boss & difficulty config ---------- */

const BOSSES = [
  {
    id: 1,
    key: 'bubble',
    emoji: '🐣',
    name: 'Bubble Glove',
    title: 'บอสมือใหม่สายฟอง',
    desc: 'บอสอุ่นเครื่อง เป้าใหญ่ เด้งช้า เหมาะสำหรับวอร์มอัพ 🔰',
    hintLowHp: 'HP ใกล้หมดแล้ว! ตีให้สุด!'
  },
  {
    id: 2,
    key: 'neon',
    emoji: '👾',
    name: 'Neon Shadow',
    title: 'เป้าริทึมไฟฟ้า',
    desc: 'เป้าเริ่มเล็กลง ตกเร็วขึ้น ต้องตั้งจังหวะให้ดี ⚡',
    hintLowHp: 'พลาดเป้าไปหลายทีแล้ว รัวจังหวะกลับมา!'
  },
  {
    id: 3,
    key: 'storm',
    emoji: '🌪️',
    name: 'Storm Fist',
    title: 'บอสลมพายุ',
    desc: 'เป้าลวงเยอะ ต้องแยกสีให้ทัน 👀',
    hintLowHp: 'อีกนิดเดียวเอง รักษา combo ให้ได้!'
  },
  {
    id: 4,
    key: 'nova',
    emoji: '🌟',
    name: 'Nova King',
    title: 'ราชาดาวตก',
    desc: 'บอสสุดท้าย เป้าเล็ก+เร็ว สะสม FEVER ให้เต็ม!',
    hintLowHp: 'เข้า FEVER แล้วซัดให้ยับไปเลย 💥'
  }
];

const DIFF = {
  easy: {
    label: 'ง่าย',
    spawnInterval: 900,
    targetLifetime: 1500,
    mainSize: 1.1,
    decoyRate: 0.15,
    missHp: 4,
    bossHp: [60, 80, 90, 110]
  },
  normal: {
    label: 'ปกติ',
    spawnInterval: 750,
    targetLifetime: 1300,
    mainSize: 1.0,
    decoyRate: 0.25,
    missHp: 6,
    bossHp: [80, 100, 115, 130]
  },
  hard: {
    label: 'ยาก',
    spawnInterval: 620,
    targetLifetime: 1100,
    mainSize: 0.85,
    decoyRate: 0.33,
    missHp: 8,
    bossHp: [90, 120, 140, 160]
  }
};

/* ---------- SFX helper ---------- */

let SFX = {};

function initSFX() {
  SFX.hit   = document.getElementById('sfx-hit');
  SFX.miss  = document.getElementById('sfx-miss');
  SFX.boss  = document.getElementById('sfx-boss');
  SFX.fever = document.getElementById('sfx-fever');
  SFX.clear = document.getElementById('sfx-clear');
  SFX.hp    = document.getElementById('sfx-hp');
  SFX.combo = document.getElementById('sfx-combo');
}

function playSfx(name) {
  const a = SFX[name];
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play();
  } catch (e) {
    // in case autoplay is blocked → เงียบไว้
  }
}

/* ---------- Core engine ---------- */

let NEXT_ID = 1;

class ShadowEngine {
  constructor(options) {
    const opts = options || {};

    this.mode = opts.mode || 'normal';  // 'normal' | 'research'
    this.diffKey = opts.diffKey || 'normal';
    this.config = DIFF[this.diffKey] || DIFF.normal;
    this.duration = opts.duration || 70; // seconds

    this.hooks = {
      onState: opts.onState || null,
      onEnd: opts.onEnd || null,
      onBossIntro: opts.onBossIntro || null
    };

    this.host = opts.host || null;
    this.renderer = this.host ? new DomRenderer(this, this.host, {
      sizePx: 96
    }) : null;

    this.resetState();
  }

  resetState() {
    this.timeLeft = this.duration;
    this.score = 0;
    this.hp = 100;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfect = 0;
    this.miss = 0;
    this.totalHits = 0;
    this.fever = 0;

    this.bossIndex = 0; // 0..3
    this.bossHp = this.config.bossHp.slice(0);
    this.currentBossHp = this.bossHp[0];

    this.targets = []; // active targets
    this.timers = { tick: null, spawn: null };
    this.running = false;

    this.rtNormal = [];
    this.rtDecoy = [];
  }

  getBoss() {
    return BOSSES[this.bossIndex];
  }

  /* ----- game loop ----- */

  start() {
    this.resetState();
    this.running = true;

    // intro boss แรก
    this._fireBossIntro(true);

    this._emitState();

    // timer นับถอยหลัง
    this.timers.tick = setInterval(() => {
      if (!this.running) return;
      this.timeLeft -= 0.1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.stop('timeout');
      }
      this._emitState();
    }, 100);

    // timer spawn เป้า
    this.timers.spawn = setInterval(() => {
      if (!this.running) return;
      this._spawnTarget();
    }, this.config.spawnInterval);
  }

  stop(reason) {
    if (!this.running) return;
    this.running = false;

    clearInterval(this.timers.tick);
    clearInterval(this.timers.spawn);
    this.timers.tick = null;
    this.timers.spawn = null;

    // เคลียร์เป้าบนจอ
    if (this.renderer) {
      this.renderer.clear();
    }
    this.targets.length = 0;

    if (this.hooks.onEnd) {
      this.hooks.onEnd(reason || 'stopped', this._buildResult());
    }
  }

  _emitState() {
    if (!this.hooks.onState) return;
    this.hooks.onState({
      mode: this.mode,
      diffKey: this.diffKey,
      timeLeft: this.timeLeft,
      score: this.score,
      hp: this.hp,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfect: this.perfect,
      miss: this.miss,
      totalHits: this.totalHits,
      fever: this.fever,
      bossIndex: this.bossIndex,
      bossHp: this.currentBossHp,
      bossHpMax: this.bossHp[this.bossIndex]
    });
  }

  /* ----- target spawn / life ----- */

  _spawnTarget() {
    if (!this.renderer) return;
    if (!this.running) return;

    const id = NEXT_ID++;
    const boss = this.getBoss();

    const isDecoy = Math.random() < this.config.decoyRate;
    const now = performance.now ? performance.now() : Date.now();

    const t = {
      id: id,
      bossId: boss.id,
      createdAt: now,
      decoy: isDecoy,
      emoji: isDecoy ? '⚡' : '⭐',
      scale: this.config.mainSize
    };

    this.targets.push(t);
    this.renderer.spawnTarget(t);

    // หมดอายุถ้าไม่โดนตี
    const life = this.config.targetLifetime;
    setTimeout(() => {
      if (!this.running) return;
      this._expireTarget(id);
    }, life);
  }

  _findTarget(id) {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.targets[i].id === id) return this.targets[i];
    }
    return null;
  }

  _removeTarget(id) {
    for (let i = 0; i < this.targets.length; i++) {
      if (this.targets[i].id === id) {
        const t = this.targets[i];
        this.targets.splice(i, 1);
        if (this.renderer) this.renderer.removeTarget(t);
        return t;
      }
    }
    return null;
  }

  _expireTarget(id) {
    const t = this._findTarget(id);
    if (!t) return;

    // เป้าจริงพลาด → นับ miss
    if (!t.decoy) {
      this.miss++;
      this.combo = 0;
      this.hp = clamp(this.hp - this.config.missHp, 0, 100);
      this.fever = Math.max(0, this.fever - 8);

      if (this.renderer) {
        this.renderer.spawnHitEffect(t, { miss: true, score: 0 });
      }
      playSfx('miss');
      playSfx('hp');
      if (this.hp <= 0) {
        this._removeTarget(id);
        this._emitState();
        this.stop('hp_zero');
        return;
      }
    }

    this._removeTarget(id);
    this._emitState();
  }

  /* ----- player input จาก DomRenderer ----- */

  registerTouch(x, y, targetId) {
    if (!this.running) return;

    // หา target จาก id
    const t = targetId != null ? this._findTarget(targetId) : null;
    if (!t) {
      // แตะช้าไป → นับเป็น miss เบา ๆ
      return;
    }

    const now = performance.now ? performance.now() : Date.now();
    const rt = now - t.createdAt;

    this._removeTarget(t.id);

    // decoy
    if (t.decoy) {
      this.miss++;
      this.combo = 0;
      this.hp = clamp(this.hp - this.config.missHp, 0, 100);
      this.fever = Math.max(0, this.fever - 10);
      this.rtDecoy.push(rt);

      if (this.renderer) {
        this.renderer.spawnHitEffect(t, {
          decoy: true,
          grade: 'bad',
          score: -20
        });
      }
      playSfx('miss');
      playSfx('hp');

      if (this.hp <= 0) {
        this._emitState();
        this.stop('hp_zero');
        return;
      }
      this._emitState();
      return;
    }

    // เป้าจริง
    this.totalHits++;

    let grade = 'good';
    if (rt <= 150) grade = 'perfect';
    else if (rt >= 350) grade = 'bad';

    if (grade === 'perfect') this.perfect++;
    this.rtNormal.push(rt);

    let scoreDelta = 0;
    let feverDelta = 0;

    if (grade === 'perfect') {
      scoreDelta = 40;
      feverDelta = 8;
      this.combo++;
    } else if (grade === 'good') {
      scoreDelta = 22;
      feverDelta = 5;
      this.combo++;
    } else {
      scoreDelta = 8;
      feverDelta = 2;
      this.combo = 0;
    }

    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const beforeFever = this.fever;
    this.score += scoreDelta;
    this.fever = clamp(this.fever + feverDelta, 0, 100);

    if (!t.decoy && this.combo > 0 && this.combo % 10 === 0) {
      playSfx('combo');
    }

    if (beforeFever < 90 && this.fever >= 90) {
      playSfx('fever');
    }

    if (this.renderer) {
      this.renderer.spawnHitEffect(t, {
        grade: grade,
        score: scoreDelta,
        fever: this.fever >= 90
      });
    }
    playSfx('hit');

    // ดาเมจกับบอส
    const dmgBase = grade === 'perfect' ? 8 : (grade === 'good' ? 5 : 2);
    const feverMul = this.fever >= 90 ? 1.8 : 1.0;
    const dmg = Math.round(dmgBase * feverMul);

    this.currentBossHp = clamp(this.currentBossHp - dmg, 0, this.bossHp[this.bossIndex]);

    if (this.currentBossHp <= 0) {
      this._onBossDown();
    }

    this._emitState();
  }

  _onBossDown() {
    this.bossIndex++;
    if (this.bossIndex >= BOSSES.length) {
      // เคลียร์ทุกบอส
      playSfx('clear');
      this.stop('boss_cleared');
      return;
    }
    // ไปบอสถัดไป
    this.currentBossHp = this.bossHp[this.bossIndex];
    this.fever = 0;
    this.combo = 0;

    this._fireBossIntro(false);
    this._emitState();
  }

  _fireBossIntro(isFirst) {
    // แสดง intro overlay ผ่าน UI
    if (this.hooks.onBossIntro) {
      this.hooks.onBossIntro(this.getBoss(), !!isFirst);
    }
    playSfx('boss');
  }

  /* ----- result summary ----- */

  _buildResult() {
    const totalShots = this.totalHits + this.miss;
    const acc = totalShots > 0 ? (this.totalHits * 100) / totalShots : 0;

    const avg = list => {
      if (!list || list.length === 0) return null;
      let sum = 0;
      for (let i = 0; i < list.length; i++) sum += list[i];
      return sum / list.length;
    };

    return {
      mode: this.mode,
      diffKey: this.diffKey,
      score: this.score,
      comboMax: this.maxCombo,
      miss: this.miss,
      totalHits: this.totalHits,
      accuracy: acc,
      rtNormal: avg(this.rtNormal),
      rtDecoy: avg(this.rtDecoy)
    };
  }
}

/* ---------- UI glue: DOM + engine ---------- */

export function initShadowBreaker() {
  const $ = (sel) => document.querySelector(sel);

  const views = {
    menu: $('#view-menu'),
    research: $('#view-research-form'),
    play: $('#view-play'),
    result: $('#view-result')
  };

  function showView(name) {
    views.menu.classList.add('hidden');
    views.research.classList.add('hidden');
    views.play.classList.add('hidden');
    views.result.classList.add('hidden');

    if (views[name]) views[name].classList.remove('hidden');
  }

  // HUD elements
  const el = {
    mode: $('#stat-mode'),
    diff: $('#stat-diff'),
    score: $('#stat-score'),
    hp: $('#stat-hp'),
    combo: $('#stat-combo'),
    perfect: $('#stat-perfect'),
    miss: $('#stat-miss'),
    time: $('#stat-time'),

    feverFill: $('#fever-fill'),
    feverStatus: $('#fever-status'),

    bossName: $('#boss-name'),
    bossFill: $('#boss-fill'),

    portraitEmoji: $('#boss-portrait-emoji'),
    portraitName: $('#boss-portrait-name'),
    portraitHint: $('#boss-portrait-hint'),

    resMode: $('#res-mode'),
    resDiff: $('#res-diff'),
    resReason: $('#res-endreason'),
    resScore: $('#res-score'),
    resMaxCombo: $('#res-maxcombo'),
    resMiss: $('#res-miss'),
    resAcc: $('#res-accuracy'),
    resHits: $('#res-totalhits'),
    resRtNormal: $('#res-rt-normal'),
    resRtDecoy: $('#res-rt-decoy'),
    resParticipant: $('#res-participant'),

    diffSelect: $('#difficulty'),
    targetLayer: $('#target-layer'),

    researchId: $('#research-id'),
    researchGroup: $('#research-group'),
    researchNote: $('#research-note')
  };

  // boss intro overlay
  const bossIntro = {
    wrap: document.getElementById('boss-intro'),
    emoji: document.getElementById('boss-intro-emoji'),
    name: document.getElementById('boss-intro-name'),
    title: document.getElementById('boss-intro-title'),
    desc: document.getElementById('boss-intro-desc')
  };

  let engine = null;
  let lastConfig = null; // ใช้เล่นซ้ำจากหน้าสรุป

  function updateHUD(state) {
    if (!state) return;

    el.mode.textContent = state.mode === 'research' ? 'วิจัย' : 'ปกติ';
    el.diff.textContent = DIFF[state.diffKey] ? DIFF[state.diffKey].label : state.diffKey;

    el.score.textContent = state.score;
    el.hp.textContent = state.hp;
    el.combo.textContent = state.combo;
    el.perfect.textContent = state.perfect;
    el.miss.textContent = state.miss;
    el.time.textContent = state.timeLeft.toFixed(1);

    const feverPercent = clamp(state.fever, 0, 100);
    el.feverFill.style.width = feverPercent + '%';
    el.feverStatus.textContent = feverPercent >= 90 ? 'FEVER ON!' : 'FEVER';

    const boss = BOSSES[state.bossIndex] || BOSSES[BOSSES.length - 1];
    el.bossName.textContent = boss.name + ' (' + (state.bossIndex + 1) + '/' + BOSSES.length + ')';

    const hpMax = state.bossHpMax || 1;
    const hpPct = clamp((state.bossHp * 100) / hpMax, 0, 100);
    el.bossFill.style.width = hpPct + '%';

    el.portraitEmoji.textContent = boss.emoji;
    el.portraitName.textContent = boss.name;
    el.portraitHint.textContent = state.bossHp <= hpMax * 0.25 ? boss.hintLowHp : boss.title;
  }

  function showResult(reason, result) {
    showView('result');

    const diffObj = DIFF[result.diffKey] || DIFF.normal;

    el.resMode.textContent = result.mode === 'research' ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
    el.resDiff.textContent = diffObj.label + ' (' + result.diffKey + ')';
    el.resReason.textContent =
      reason === 'boss_cleared' ? 'ชนะครบทุกบอส' :
      reason === 'hp_zero' ? 'พลังชีวิตหมด' :
      reason === 'timeout' ? 'หมดเวลา' :
      'หยุดก่อนจบเกม';

    el.resScore.textContent = result.score;
    el.resMaxCombo.textContent = result.comboMax;
    el.resMiss.textContent = result.miss;
    el.resHits.textContent = result.totalHits;

    el.resAcc.textContent = result.accuracy != null ? result.accuracy.toFixed(1) + '%' : '-';
    el.resRtNormal.textContent = result.rtNormal != null ? result.rtNormal.toFixed(0) + ' ms' : '-';
    el.resRtDecoy.textContent = result.rtDecoy != null ? result.rtDecoy.toFixed(0) + ' ms' : '-';

    const pid = el.researchId.value || '-';
    el.resParticipant.textContent = pid;

    lastConfig = lastConfig || {};
  }

  function attachIntroSkip() {
    if (!bossIntro.wrap) return;
    bossIntro.wrap.addEventListener('click', () => {
      bossIntro.wrap.classList.add('hidden');
    });
  }

  function showBossIntro(boss, isFirst) {
    if (!bossIntro.wrap) return;
    bossIntro.emoji.textContent = boss.emoji;
    bossIntro.name.textContent = boss.name;
    bossIntro.title.textContent = boss.title;
    bossIntro.desc.textContent = boss.desc;
    bossIntro.wrap.classList.remove('hidden');

    // auto hide after 2.2s ถ้าไม่แตะ
    setTimeout(() => {
      bossIntro.wrap.classList.add('hidden');
    }, isFirst ? 2600 : 2000);
  }

  function startGame(mode, fromResearchForm) {
    if (engine) {
      engine.stop('restart');
      engine = null;
    }

    const diffKey = el.diffSelect.value || 'normal';

    const cfg = {
      mode: mode,
      diffKey: diffKey,
      duration: 70,
      host: el.targetLayer,
      onState: updateHUD,
      onBossIntro: showBossIntro,
      onEnd: (reason, result) => {
        showResult(reason, result);
      }
    };

    lastConfig = cfg;

    engine = new ShadowEngine(cfg);
    engine.start();

    el.mode.textContent = mode === 'research' ? 'วิจัย' : 'ปกติ';
    el.diff.textContent = DIFF[diffKey] ? DIFF[diffKey].label : diffKey;

    showView('play');
  }

  function bindMenu() {
    initSFX();
    attachIntroSkip();

    const btnResearch = views.menu.querySelector('[data-action="start-research"]');
    const btnNormal = views.menu.querySelector('[data-action="start-normal"]');

    btnResearch.addEventListener('click', () => {
      showView('research');
    });
    btnNormal.addEventListener('click', () => {
      startGame('normal', false);
    });

    const btnResearchBegin = views.research.querySelector('[data-action="research-begin-play"]');
    const btnBackToMenuFromResearch = views.research.querySelector('[data-action="back-to-menu"]');

    btnResearchBegin.addEventListener('click', () => {
      startGame('research', true);
    });
    btnBackToMenuFromResearch.addEventListener('click', () => {
      showView('menu');
    });

    const btnStopEarly = views.play.querySelector('[data-action="stop-early"]');
    btnStopEarly.addEventListener('click', () => {
      if (engine) {
        engine.stop('stopped_by_user');
        engine = null;
      }
    });

    const btnPlayAgain = views.result.querySelector('[data-action="play-again"]');
    const btnBackToMenuFromResult = views.result.querySelector('[data-action="back-to-menu"]');

    btnPlayAgain.addEventListener('click', () => {
      if (lastConfig) {
        const mode = lastConfig.mode || 'normal';
        startGame(mode, false);
      } else {
        showView('menu');
      }
    });
    btnBackToMenuFromResult.addEventListener('click', () => {
      showView('menu');
    });
  }

  bindMenu();
  showView('menu');
}
