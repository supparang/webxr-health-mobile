// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest HUD + shared FeverUI)
// 2025-12-06 — มี lifetime เป้า + Fever gauge ล่างซ้าย

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---- Fever UI (shared) ----
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

  // ---- Difficulty helper ----
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ถ้ามีตาราง difficulty แยกไฟล์
    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.15,
        lifetime: 2300
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        maxActive: 5,
        sizeFactor: 0.9,
        lifetime: 1700
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0,
      lifetime: 2000
    };
  }

  // ---- Emoji helper ----
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function pickEmoji(isGood) {
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Random position (กลางจอ, หลบ HUD + โค้ช) ----
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 120;   // HUD ด้านบน
    const bottomSafe = 140;   // โค้ชด้านล่าง

    const left  = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ---- Goal / Mini quest pool (เบื้องต้น 1 ชุด) ----
  const GOAL_DEFS = [
    {
      id: 'G_SCORE_180',
      label: 'ทำคะแนนให้ได้อย่างน้อย 180 แต้ม',
      kind: 'score',
      target: 180
    }
  ];

  const MINI_DEFS = [
    {
      id: 'M_GOOD_15',
      label: 'เก็บอาหารดีให้ได้อย่างน้อย 15 ชิ้น',
      kind: 'goodHits',
      target: 15
    }
  ];

  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Component main ----
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      // DOM layer สำหรับเป้า
      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

      // HUD element
      this.elScore     = document.getElementById('hud-score');
      this.elTime      = document.getElementById('hud-time-label');
      this.elGoalMain  = document.getElementById('hud-goal-main');
      this.elGoalProg  = document.getElementById('hud-goal-progress');
      this.elMiniMain  = document.getElementById('hud-mini-main');
      this.elMiniProg  = document.getElementById('hud-mini-progress');

      // state
      this.running    = false;
      this.elapsed    = 0;
      this.timeLimit  = 60000; // ms
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      // goal / mini quest
      this.goalDef    = null;
      this.miniDef    = null;

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever state + UI กลาง
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      // รอ event จาก HTML
      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---- helper อัปเดต Fever ----
    updateFever: function (delta) {
      this.fever = (this.fever || 0) + delta;
      if (this.fever < 0) this.fever = 0;
      if (this.fever > FEVER_MAX) this.fever = FEVER_MAX;

      if (FeverUI && typeof FeverUI.setFever === 'function') {
        FeverUI.setFever(this.fever);
      }

      const active = this.fever >= FEVER_MAX;
      if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
        FeverUI.setFeverActive(active);
      }
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

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      // สุ่ม Goal / Mini quest (ตอนนี้ใช้ 1 ชุดไว้ก่อน แต่โครงรองรับหลายชุดได้)
      this.goalDef = pickOne(GOAL_DEFS);
      this.miniDef = pickOne(MINI_DEFS);

      if (this.elGoalMain && this.goalDef) {
        this.elGoalMain.textContent = this.goalDef.label;
      }
      if (this.elMiniMain && this.miniDef) {
        this.elMiniMain.textContent = this.miniDef.label;
      }

      this.updateGoalHUD();

      // reset fever กลาง
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

      const miniText = this.miniDef
        ? `${this.miniDef.label} (${this.goodHits} / ${this.miniDef.target})`
        : `เก็บอาหารดี ${this.goodHits} ชิ้น`;

      let questsCleared = 0;
      let questsTotal   = 0;

      if (this.goalDef) {
        questsTotal++;
        if (this.score >= this.goalDef.target) questsCleared++;
      }
      if (this.miniDef) {
        questsTotal++;
        if (this.goodHits >= this.miniDef.target) questsCleared++;
      }

      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared,
        questsTotal,
        goal: goalText,
        miniQuest: miniText
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);
    },

    tick: function (t, dt) {
      if (!this.running) return;

      dt = dt || 16;

      this.elapsed    += dt;
      this.spawnTimer += dt;

      // เวลา
      const remain = Math.max(0, this.timeLimit - this.elapsed);
      if (this.elTime) {
        this.elTime.textContent = Math.ceil(remain / 1000) + 's';
      }
      if (remain <= 0) {
        this.endGame();
        return;
      }

      // spawn เป้าใหม่
      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }

      // เช็คอายุเป้า → ถ้าเกิน lifetime ให้หายไปเอง (นับเป็น miss)
      const lifetime = this.diffCfg.lifetime || 2000;
      const now = this.elapsed;

      const stillAlive = [];
      for (let i = 0; i < this.targets.length; i++) {
        const tObj = this.targets[i];
        if (!tObj || !tObj.el) continue;
        const age = now - tObj.birth;
        if (age > lifetime) {
          // timeout → miss
          if (tObj.el && tObj.el.parentNode) {
            tObj.el.parentNode.removeChild(tObj.el);
          }
          this.missCount += 1;
          this.updateFever(-FEVER_MISS_LOSS);
        } else {
          stillAlive.push(tObj);
        }
      }
      this.targets = stillAlive;
    },

    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      const isGood = Math.random() < 0.6;
      const emoji  = pickEmoji(isGood);
      const pos    = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      // scale ตามระดับความยาก
      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        isGood,
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

      // คะแนนง่าย ๆ: good +10, junk -8
      if (target.isGood) {
        this.score    += 10;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);
      } else {
        this.score = Math.max(0, this.score - 8);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      this.updateGoalHUD();

      // เอฟเฟกต์หายไป
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      this.targets = this.targets.filter((t) => t !== target);
    },

    clearTargets: function () {
      if (!this.layer) return;
      this.targets.forEach((t) => {
        if (t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
      });
      this.targets = [];
    },

    updateGoalHUD: function () {
      if (this.elGoalProg && this.goalDef) {
        this.elGoalProg.textContent =
          this.score + ' / ' + this.goalDef.target;
      }
      if (this.elMiniProg && this.miniDef) {
        this.elMiniProg.textContent =
          this.goodHits + ' / ' + this.miniDef.target;
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
