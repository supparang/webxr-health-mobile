// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest HUD + Fever + Shield/Star/Diamond)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---------- Fever UI (shared global) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 20;

  // ---------- Difficulty config ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback tuning
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1400,
        maxActive: 3,
        sizeFactor: 1.1,
        lifetime: 2400,
        typeWeights: { good: 60, junk: 20, star: 8, diamond: 4, shield: 8 }
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        maxActive: 5,
        sizeFactor: 0.9,
        lifetime: 1800,
        typeWeights: { good: 45, junk: 30, star: 10, diamond: 7, shield: 8 }
      };
    }
    // normal
    return {
      spawnInterval: 1150,
      maxActive: 4,
      sizeFactor: 1.0,
      lifetime: 2100,
      typeWeights: { good: 55, junk: 22, star: 8, diamond: 5, shield: 10 }
    };
  }

  // ---------- Emoji helper ----------
  const GOOD_EMOJI   = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI   = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];
  const STAR_EMOJI   = ['⭐', '🌟'];
  const DIAMOND_EMOJI= ['💎', '🔷'];
  const SHIELD_EMOJI = ['🛡️'];

  function randFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickType(weights) {
    const w = weights || { good: 1, junk: 1 };
    const entries = Object.entries(w);
    const total = entries.reduce((s, [, val]) => s + (val || 0), 0) || 1;
    let r = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i];
      r -= (val || 0);
      if (r <= 0) return key;
    }
    return 'good';
  }

  function pickEmojiByType(type) {
    switch (type) {
      case 'good':    return randFrom(GOOD_EMOJI);
      case 'junk':    return randFrom(JUNK_EMOJI);
      case 'star':    return randFrom(STAR_EMOJI);
      case 'diamond': return randFrom(DIAMOND_EMOJI);
      case 'shield':  return randFrom(SHIELD_EMOJI);
      default:        return '🍽️';
    }
  }

  // ---------- Random screen pos (กลางจอ, หลบ HUD+โค้ช) ----------
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 120;
    const bottomSafe = 140;

    const left  = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
    return { x, y };
  }

  // ---------- Goal / Mini quest definitions ----------
  const GOAL_DEFS = [
    { id: 'G_SCORE_150', label: 'ทำคะแนนให้ได้อย่างน้อย 150 แต้ม', kind: 'score', target: 150 },
    { id: 'G_SCORE_180', label: 'ทำคะแนนให้ได้อย่างน้อย 180 แต้ม', kind: 'score', target: 180 }
  ];

  const MINI_POOL = [
    { id: 'M_GOOD_10', label: 'เก็บอาหารดีให้ได้อย่างน้อย 10 ชิ้น', kind: 'goodHits', target: 10 },
    { id: 'M_GOOD_12', label: 'เก็บอาหารดีให้ได้อย่างน้อย 12 ชิ้น', kind: 'goodHits', target: 12 },
    { id: 'M_GOOD_15', label: 'เก็บอาหารดีให้ได้อย่างน้อย 15 ชิ้น', kind: 'goodHits', target: 15 }
  ];

  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffled(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = copy[i];
      copy[i] = copy[j];
      copy[j] = t;
    }
    return copy;
  }

  // ---------- Component ----------
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      // DOM layer
      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

      // HUD refs
      this.elScore    = document.getElementById('hud-score');
      this.elTime     = document.getElementById('hud-time-label');
      this.elGoalMain = document.getElementById('hud-goal-main');
      this.elGoalProg = document.getElementById('hud-goal-progress');
      this.elMiniMain = document.getElementById('hud-mini-main');
      this.elMiniProg = document.getElementById('hud-mini-progress');

      // state
      this.running    = false;
      this.elapsed    = 0;
      this.timeLimit  = 60000;
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      // power-up state
      this.shieldCount = 0;

      // goal / mini quest
      this.goalDef         = null;
      this.miniQueue       = [];
      this.currentMiniIdx  = 0;
      this.currentMiniDef  = null;
      this.miniClearedCount= 0;

      // difficulty
      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---- Fever helpers ----
    updateFever: function (delta) {
      this.fever = (this.fever || 0) + delta;
      if (this.fever < 0) this.fever = 0;
      if (this.fever > FEVER_MAX) this.fever = FEVER_MAX;

      FeverUI.setFever(this.fever);

      const active = this.fever >= FEVER_MAX;
      this.feverActive = active;
      FeverUI.setFeverActive(active);
    },

    // ---- Shield helpers ----
    addShield: function (n) {
      this.shieldCount = Math.min(3, (this.shieldCount || 0) + (n || 1));
      FeverUI.setShield(this.shieldCount);
    },

    consumeShieldForMiss: function () {
      if (this.shieldCount > 0) {
        this.shieldCount -= 1;
        FeverUI.setShield(this.shieldCount);
        return true; // กันโทษได้
      }
      return false;
    },

    // ---- Goal / Mini quest HUD ----
    setCurrentMini: function () {
      this.currentMiniDef = this.miniQueue[this.currentMiniIdx] || null;
      if (this.currentMiniDef && this.elMiniMain) {
        this.elMiniMain.textContent = this.currentMiniDef.label;
      }
      this.updateGoalHUD();
    },

    startGame: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();

      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;
      this.shieldCount = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      // Goal สุ่ม 1 จาก 2 ตัวเลือก
      this.goalDef = pickOne(GOAL_DEFS);
      if (this.elGoalMain && this.goalDef) {
        this.elGoalMain.textContent = this.goalDef.label;
      }

      // Mini quest: สุ่มลำดับ 3 ตัว แล้วทำทีละอัน
      this.miniQueue        = shuffled(MINI_POOL);
      this.currentMiniIdx   = 0;
      this.miniClearedCount = 0;
      this.setCurrentMini();

      // Fever reset
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);
    },

    endGame: function () {
      if (!this.running) return;
      this.running = false;
      this.clearTargets();

      const scene = this.scene;
      if (!scene) return;

      const goalText = this.goalDef
        ? `${this.goalDef.label} (${this.score} / ${this.goalDef.target})`
        : `คะแนน ${this.score}`;

      const miniText = this.currentMiniDef
        ? `${this.currentMiniDef.label} (${this.goodHits} / ${this.currentMiniDef.target})`
        : `เก็บอาหารดี ${this.goodHits} ชิ้น`;

      let questsCleared = 0;
      let questsTotal   = 0;

      if (this.goalDef) {
        questsTotal++;
        if (this.score >= this.goalDef.target) questsCleared++;
      }
      if (this.miniQueue && this.miniQueue.length) {
        questsTotal += this.miniQueue.length;
        questsCleared += this.miniClearedCount;
      }

      const detail = {
        score:       this.score,
        goodHits:    this.goodHits,
        missCount:   this.missCount,
        questsCleared,
        questsTotal,
        goal:       goalText,
        miniQuest:  miniText
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);
    },

    tick: function (t, dt) {
      if (!this.running) return;

      dt = dt || 16;
      this.elapsed    += dt;
      this.spawnTimer += dt;

      // time
      const remain = Math.max(0, this.timeLimit - this.elapsed);
      if (this.elTime) {
        this.elTime.textContent = Math.ceil(remain / 1000) + 's';
      }
      if (remain <= 0) {
        this.endGame();
        return;
      }

      // spawn target
      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }

      // check lifetime → miss / remove
      const lifetime = this.diffCfg.lifetime || 2000;
      const now = this.elapsed;
      const still = [];

      for (let i = 0; i < this.targets.length; i++) {
        const tObj = this.targets[i];
        if (!tObj || !tObj.el) continue;
        const age = now - tObj.birth;
        if (age > lifetime) {
          // timeout — ใช้ shield กันได้ 1 ครั้ง
          if (!this.consumeShieldForMiss()) {
            this.missCount += 1;
            this.updateFever(-FEVER_MISS_LOSS);
          }
          if (tObj.el.parentNode) {
            tObj.el.parentNode.removeChild(tObj.el);
          }
        } else {
          still.push(tObj);
        }
      }
      this.targets = still;
    },

    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      const type  = pickType(this.diffCfg.typeWeights);
      const emoji = pickEmojiByType(type);
      const pos   = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (type === 'junk' ? 'fg-junk' : 'fg-good');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        type,
        birth: this.elapsed
      };
      this.targets.push(targetObj);

      const onHit = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.handleHit(targetObj);
      };

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      this.layer.appendChild(el);
    },

    handleHit: function (target) {
      if (!this.running) return;
      const el = target.el;
      if (!el || !el.parentNode) return;

      const type = target.type || 'good';

      switch (type) {
        case 'good':
          this.score    += 10;
          this.goodHits += 1;
          this.updateFever(FEVER_HIT_GAIN);
          break;
        case 'junk':
          if (!this.consumeShieldForMiss()) {
            this.score = Math.max(0, this.score - 8);
            this.missCount += 1;
            this.updateFever(-FEVER_MISS_LOSS);
          }
          break;
        case 'star':
          this.score    += 15;
          this.goodHits += 1;
          this.updateFever(FEVER_HIT_GAIN + 5);
          break;
        case 'diamond':
          this.score    += 20;
          this.goodHits += 1;
          this.updateFever(FEVER_HIT_GAIN + 10);
          break;
        case 'shield':
          this.score    += 5;
          this.goodHits += 1;
          this.addShield(1);
          this.updateFever(FEVER_HIT_GAIN * 0.5);
          break;
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      this.updateGoalHUD();

      // เช็คว่า mini quest สำเร็จแล้วหรือยัง
      this.checkMiniProgress();

      // หายไปพร้อมเอฟเฟกต์
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);
      this.targets = this.targets.filter((t) => t !== target);
    },

    checkMiniProgress: function () {
      const mini = this.currentMiniDef;
      if (!mini) return;

      let done = false;
      if (mini.kind === 'goodHits') {
        if (this.goodHits >= mini.target) done = true;
      }

      if (done) {
        this.miniClearedCount += 1;
        this.currentMiniIdx += 1;
        if (this.currentMiniIdx >= this.miniQueue.length) {
          // ทำครบทุก mini แล้ว → แค่ไม่อัปเดตอะไรต่อ
          this.currentMiniDef = mini;
        } else {
          this.setCurrentMini();
        }
      }

      this.updateGoalHUD();
    },

    clearTargets: function () {
      if (!this.layer) return;
      this.targets.forEach((t) => {
        if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      });
      this.targets = [];
    },

    updateGoalHUD: function () {
      if (this.goalDef && this.elGoalProg) {
        this.elGoalProg.textContent =
          this.score + ' / ' + this.goalDef.target;
      }
      if (this.currentMiniDef && this.elMiniProg) {
        this.elMiniProg.textContent =
          this.goodHits + ' / ' + this.currentMiniDef.target;
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
