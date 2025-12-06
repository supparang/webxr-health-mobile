// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest HUD + shared FeverUI)
// 2025-12-06

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
    if (
      ns.foodGroupsDifficulty &&
      typeof ns.foodGroupsDifficulty.get === 'function'
    ) {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.15,
        itemLifetime: 2600
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 800,
        maxActive: 5,
        sizeFactor: 0.9,
        itemLifetime: 2100
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0,
      itemLifetime: 2300
    };
  }

  // ---- Emoji helper ----
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function pickEmoji(isGood) {
    // ถ้ามีโมดูล emoji-image ให้มันเลือก
    if (
      ns.emojiImage &&
      typeof ns.emojiImage.pick === 'function'
    ) {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Random position (กลางจอ, หลบ HUD + โค้ช) ----
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe = 120;     // HUD บน
    const bottomSafe = 140;  // โค้ชด้านล่าง

    const left = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
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
      this.elScore    = document.getElementById('hud-score');
      this.elTime     = document.getElementById('hud-time-label');
      this.elGoalProg = document.getElementById('hud-goal-progress');
      this.elMiniProg = document.getElementById('hud-mini-progress');
      this.elGoalMain = document.getElementById('hud-goal-main');
      this.elMiniMain = document.getElementById('hud-mini-main');

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
      this.goalScore     = 150;
      this.goalGoodHits  = 12;

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

      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared: 0,
        questsTotal: 2,
        goal: `คะแนน ${this.goalScore}+ (${this.score} / ${this.goalScore})`,
        miniQuest: `เก็บอาหารดี ${this.goalGoodHits} ชิ้น (${this.goodHits} / ${this.goalGoodHits})`
      };

      if (this.score     >= this.goalScore)    detail.questsCleared++;
      if (this.goodHits  >= this.goalGoodHits) detail.questsCleared++;

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

      // อายุของเป้า (miss auto)
      const targets = this.targets;
      for (let i = targets.length - 1; i >= 0; i--) {
        const tObj = targets[i];
        tObj.life -= dt;
        if (tObj.life <= 0) {
          // หมดเวลา: ถือว่าพลาด
          if (tObj.isGood) {
            this.missCount += 1;
            this.updateFever(-FEVER_MISS_LOSS * 0.5);
          }
          if (tObj.el && tObj.el.parentNode) {
            tObj.el.parentNode.removeChild(tObj.el);
          }
          targets.splice(i, 1);
        }
      }

      // spawn เป้า
      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }
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
        life: this.diffCfg.itemLifetime || 2300   // อายุของเป้า (ms)
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
      // ข้อความเป้าหมาย
      if (this.elGoalMain) {
        this.elGoalMain.textContent = 'คะแนน ' + this.goalScore + '+';
      }
      if (this.elMiniMain) {
        this.elMiniMain.textContent = 'เก็บอาหารดี ' + this.goalGoodHits + ' ชิ้น';
      }

      // progress (ไม่ให้เกิน)
      if (this.elGoalProg) {
        const s = Math.min(this.score, this.goalScore);
        this.elGoalProg.textContent = s + ' / ' + this.goalScore;
      }
      if (this.elMiniProg) {
        const g = Math.min(this.goodHits, this.goalGoodHits);
        this.elMiniProg.textContent = g + ' / ' + this.goalGoodHits;
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
