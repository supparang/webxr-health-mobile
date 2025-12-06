// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest HUD + shared FeverUI)
// 2025-12-06 (size by difficulty)

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

  // ขนาดเป้าตามระดับ (ตัวคูณของ .fg-target)
  // อยากเล็ก/ใหญ่กว่านี้ ปรับเลขตรงนี้ได้เลย
  const SIZE_BY_DIFF = {
    easy:   0.90, // ง่าย: ใหญ่สุด
    normal: 0.78, // ปกติ
    hard:   0.66  // ยาก: เล็กสุด
  };

  // ---- Difficulty helper ----
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ดึงจาก difficulty.js ถ้ามี
    if (
      ns.foodGroupsDifficulty &&
      typeof ns.foodGroupsDifficulty.get === 'function'
    ) {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback ถ้าไม่มีไฟล์ difficulty.js
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.0
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 800,
        maxActive: 5,
        sizeFactor: 1.0
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0
    };
  }

  // ---- Emoji helper ----
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function pickEmoji(isGood) {
    // ใช้โมดูล emoji-image ถ้ามี
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

    const topSafe = 140;    // HUD บน + กล่อง goal
    const bottomSafe = 160; // โค้ชด้านล่าง

    const left = w * 0.12;
    const right = w * 0.88;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // -----------------------------
  //   Component main
  // -----------------------------
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

      // goal / mini quest ค่า default (จะสุ่มใหม่ตอน startGame)
      this.goalScore     = 150;
      this.goalGoodHits  = 12;
      this.goalText      = 'ทำคะแนนให้ได้อย่างน้อย 150 แต้ม';
      this.miniText      = 'เก็บอาหารดีให้ครบ 12 ชิ้น';

      this.diffKey  = 'normal';
      this.diffCfg  = getDiffConfig(this.diffKey);
      this.sizeFactor = SIZE_BY_DIFF[this.diffKey] || 0.78;

      // Fever state + UI
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

    // สุ่ม goal+mini quest ตามระดับ
    pickQuests: function () {
      // ง่าย–ปกติ–ยาก: ตั้งช่วงสุ่มต่างกัน
      if (this.diffKey === 'easy') {
        this.goalScore    = 120 + Math.floor(Math.random() * 40); // 120–159
        this.goalGoodHits = 8 + Math.floor(Math.random() * 3);    // 8–10
      } else if (this.diffKey === 'hard') {
        this.goalScore    = 220 + Math.floor(Math.random() * 60); // 220–279
        this.goalGoodHits = 15 + Math.floor(Math.random() * 5);   // 15–19
      } else { // normal
        this.goalScore    = 160 + Math.floor(Math.random() * 60); // 160–219
        this.goalGoodHits = 10 + Math.floor(Math.random() * 5);   // 10–14
      }

      this.goalText = `ทำคะแนนให้ได้อย่างน้อย ${this.goalScore} แต้ม`;
      this.miniText = `ลองเก็บอาหารดี ${this.goalGoodHits} ชิ้นดู`;
    },

    updateGoalHUD: function () {
      if (this.elGoalMain) {
        this.elGoalMain.textContent = this.goalText;
      }
      if (this.elMiniMain) {
        this.elMiniMain.textContent = this.miniText;
      }
      if (this.elGoalProg) {
        this.elGoalProg.textContent =
          `${this.score} / ${this.goalScore}`;
      }
      if (this.elMiniProg) {
        this.elMiniProg.textContent =
          `${this.goodHits} / ${this.goalGoodHits}`;
      }
    },

    startGame: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);
      this.sizeFactor = SIZE_BY_DIFF[this.diffKey] || 0.78;

      this.clearTargets();

      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      // สุ่มภารกิจใหม่ทุกเกม
      this.pickQuests();
      this.updateGoalHUD();

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg, 'sizeFactor=', this.sizeFactor);
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

      // ★ ขนาดเป้าตามระดับความยาก
      const baseScale =
        (this.diffCfg.sizeFactor || 1.0) *
        (this.sizeFactor || 0.78);
      el.style.transform =
        'translate(-50%, -50%) scale(' + baseScale.toFixed(2) + ')';

      const targetObj = {
        el,
        isGood
      };
      this.targets.push(targetObj);

      const onHit = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.handleHit(targetObj, ev);
      };

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      this.layer.appendChild(el);
    },

    handleHit: function (target, ev) {
      if (!this.running) return;
      const el = target.el;
      if (!el || !el.parentNode) return;

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // คะแนน: good +10, junk -8
      if (target.isGood) {
        this.score    += 10;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);

        // FX คะแนน + แตกกระจาย (Particles ใช้ร่วม GoodJunk)
        if (window.HHA_Particles && window.HHA_Particles.scorePop) {
          window.HHA_Particles.scorePop(x, y, '+10', { good: true });
        }
        if (window.HHA_Particles && window.HHA_Particles.burstAt) {
          window.HHA_Particles.burstAt(x, y, { color: '#22c55e', count: 12, radius: 60 });
        }
      } else {
        this.score = Math.max(0, this.score - 8);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);

        if (window.HHA_Particles && window.HHA_Particles.scorePop) {
          window.HHA_Particles.scorePop(x, y, '-8', { good: false });
        }
        if (window.HHA_Particles && window.HHA_Particles.burstAt) {
          window.HHA_Particles.burstAt(x, y, { color: '#f97316', count: 10, radius: 50 });
        }
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

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));