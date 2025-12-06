// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal/Mini quest + Fever + Shield)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---------- Fever UI (shared) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 8;
  const FEVER_MISS_LOSS = 18;

  // ---------- Goal / Mini quest pools ----------
  // 10 goals (ใช้คะแนน)
  const GOAL_POOL = [
    { id: 'G_SCORE_60',  label: 'ทำคะแนนให้ได้อย่างน้อย 60 แต้ม',  targetScore: 60  },
    { id: 'G_SCORE_80',  label: 'ทำคะแนนให้ได้อย่างน้อย 80 แต้ม',  targetScore: 80  },
    { id: 'G_SCORE_100', label: 'ทำคะแนนให้ได้อย่างน้อย 100 แต้ม', targetScore: 100 },
    { id: 'G_SCORE_120', label: 'ทำคะแนนให้ได้อย่างน้อย 120 แต้ม', targetScore: 120 },
    { id: 'G_SCORE_140', label: 'ทำคะแนนให้ได้อย่างน้อย 140 แต้ม', targetScore: 140 },
    { id: 'G_SCORE_150', label: 'ทำคะแนนให้ได้อย่างน้อย 150 แต้ม', targetScore: 150 },
    { id: 'G_SCORE_170', label: 'ทำคะแนนให้ได้อย่างน้อย 170 แต้ม', targetScore: 170 },
    { id: 'G_SCORE_180', label: 'ทำคะแนนให้ได้อย่างน้อย 180 แต้ม', targetScore: 180 },
    { id: 'G_SCORE_200', label: 'ทำคะแนนให้ได้อย่างน้อย 200 แต้ม', targetScore: 200 },
    { id: 'G_SCORE_220', label: 'ทำคะแนนให้ได้อย่างน้อย 220 แต้ม', targetScore: 220 }
  ];

  // 15 mini quests (ใช้จำนวนอาหารดี)
  const MINI_POOL = [
    { id: 'M_GOOD_6',  label: 'เก็บอาหารดีให้ได้อย่างน้อย 6 ชิ้น',  targetGood: 6  },
    { id: 'M_GOOD_8',  label: 'เก็บอาหารดีให้ได้อย่างน้อย 8 ชิ้น',  targetGood: 8  },
    { id: 'M_GOOD_10', label: 'เก็บอาหารดีให้ได้อย่างน้อย 10 ชิ้น', targetGood: 10 },
    { id: 'M_GOOD_12', label: 'เก็บอาหารดีให้ได้อย่างน้อย 12 ชิ้น', targetGood: 12 },
    { id: 'M_GOOD_14', label: 'เก็บอาหารดีให้ได้อย่างน้อย 14 ชิ้น', targetGood: 14 },
    { id: 'M_GOOD_15', label: 'เก็บอาหารดีให้ได้อย่างน้อย 15 ชิ้น', targetGood: 15 },
    { id: 'M_GOOD_FAST',label: 'ลองเก็บอาหารดีต่อเนื่องโดยไม่พลาด 5 ชิ้น', targetGood: 15 }, // ใช้ goodHits รวมง่าย ๆ
    { id: 'M_GOOD_BAL', label: 'ลองเลือกอาหารดีสลับกันไปหลาย ๆ แบบ', targetGood: 10 },
    { id: 'M_GOOD_START',label: 'ช่วงต้นเกมเก็บอาหารดีให้ถึง 8 ชิ้น', targetGood: 8 },
    { id: 'M_GOOD_END', label: 'ช่วงท้ายเกมเก็บอาหารดีเพิ่มอีก 6 ชิ้น', targetGood: 6 },
    { id: 'M_GOOD_18', label: 'เก็บอาหารดีให้ได้อย่างน้อย 18 ชิ้น', targetGood: 18 },
    { id: 'M_GOOD_20', label: 'เก็บอาหารดีให้ได้อย่างน้อย 20 ชิ้น', targetGood: 20 },
    { id: 'M_GOOD_STREAK',label: 'พยายามเก็บอาหารดีต่อเนื่องให้ได้เยอะ ๆ', targetGood: 16 },
    { id: 'M_GOOD_SMALL', label: 'โฟกัสอาหารดีชิ้นเล็ก ๆ รอบตัว', targetGood: 10 },
    { id: 'M_GOOD_FREE',  label: 'เล่นให้สนุกแล้วลองเก็บอาหารดีให้ถึง 12 ชิ้น', targetGood: 12 }
  ];

  function pickRandomSubset(pool, n) {
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.slice(0, Math.min(n, arr.length));
  }

  // ---------- Difficulty helper ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.15
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 800,
        maxActive: 5,
        sizeFactor: 0.9
      };
    }
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0
    };
  }

  // ---------- Emoji helper ----------
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function pickFoodEmoji(isGood) {
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- random type (good/junk/star/diamond/shield) ----------
  const TYPE_WEIGHTS = {
    good:    60,
    junk:    20,
    star:     7,
    diamond: 7,
    shield:   6
  };

  function pickType() {
    const r = Math.random() * 100;
    let acc = 0;
    for (const k in TYPE_WEIGHTS) {
      acc += TYPE_WEIGHTS[k];
      if (r <= acc) return k;
    }
    return 'good';
  }

  // ---------- Random position (กลางจอ, หลบ HUD + โค้ช) ----------
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 120;  // HUD บน + goal panel
    const bottomSafe = 140;  // โค้ชด้านล่าง

    const left  = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ---------- Component main ----------
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
      this.shield     = 0;

      // goal / mini quest
      this.activeGoals   = [];
      this.activeMini    = [];
      this.goalIndex     = 0;
      this.miniIndex     = 0;
      this.goalsCleared  = 0;
      this.miniCleared   = 0;

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever state
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

    // ---------- Fever update ----------
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

    // ---------- Start / End ----------
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
      this.shield     = 0;

      // สุ่ม goal 2 อัน / mini quest 3 อัน
      this.activeGoals  = pickRandomSubset(GOAL_POOL, 2);
      this.activeMini   = pickRandomSubset(MINI_POOL, 3);
      this.goalIndex    = 0;
      this.miniIndex    = 0;
      this.goalsCleared = 0;
      this.miniCleared  = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      this.updateGoalHUD();

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(this.shield);

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);
    },

    endGame: function () {
      if (!this.running) return;
      this.running = false;

      this.clearTargets();

      const scene = this.scene;
      if (!scene) return;

      const totalQuests =
        (this.activeGoals ? this.activeGoals.length : 0) +
        (this.activeMini  ? this.activeMini.length  : 0);
      const cleared = this.goalsCleared + this.miniCleared;

      const goalText = (this.activeGoals || [])
        .map(g => g.label).join(' | ');
      const miniText = (this.activeMini || [])
        .map(m => m.label).join(' | ');

      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared: cleared,
        questsTotal: totalQuests,
        goal: goalText,
        miniQuest: miniText
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);
    },

    // ---------- Tick ----------
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

    // ---------- Spawn target ----------
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      const kind   = pickType(); // good/junk/star/diamond/shield
      const pos    = randomScreenPos();
      let   isGoodFood = false;
      let   emoji = '🍎';

      if (kind === 'good') {
        isGoodFood = true;
        emoji = pickFoodEmoji(true);
      } else if (kind === 'junk') {
        isGoodFood = false;
        emoji = pickFoodEmoji(false);
      } else if (kind === 'star') {
        isGoodFood = true;
        emoji = '⭐';
      } else if (kind === 'diamond') {
        isGoodFood = true;
        emoji = '💎';
      } else if (kind === 'shield') {
        isGoodFood = false;
        emoji = '🛡️';
      }

      const el = document.createElement('div');
      const baseClass =
        (kind === 'junk') ? 'fg-target fg-junk' : 'fg-target fg-good';
      el.className = baseClass;
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform =
        'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        kind,
        isGoodFood
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

    // ---------- On hit ----------
    handleHit: function (target) {
      if (!this.running) return;
      const el = target.el;
      if (!el || !el.parentNode) return;

      const kind = target.kind;

      if (kind === 'good') {
        this.score    += 10;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);
      } else if (kind === 'junk') {
        this.score = Math.max(0, this.score - 8);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
      } else if (kind === 'star') {
        this.score    += 20;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN * 1.5);
      } else if (kind === 'diamond') {
        this.score    += 15;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN * 1.2);
        // จะให้บวกเวลาเพิ่มทีหลังก็ใส่ตรงนี้ได้
      } else if (kind === 'shield') {
        this.shield = (this.shield || 0) + 1;
        FeverUI.setShield(this.shield);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);

      // เอาเป้าออกด้วยเอฟเฟกต์เล็ก ๆ
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      this.targets = this.targets.filter((t) => t !== target);

      // อัปเดต quest progress หลังจากเปลี่ยนคะแนน/ goodHits
      this.updateQuests();
    },

    // ---------- Quest handling ----------
    updateQuests: function () {
      // Goal (ใช้คะแนน)
      const g = this.activeGoals[this.goalIndex];
      if (g && this.score >= g.targetScore) {
        this.goalsCleared++;
        this.goalIndex++;
      }

      // Mini quest (ใช้ goodHits)
      const m = this.activeMini[this.miniIndex];
      if (m && this.goodHits >= m.targetGood) {
        this.miniCleared++;
        this.miniIndex++;
      }

      this.updateGoalHUD();
    },

    updateGoalHUD: function () {
      const g = this.activeGoals[this.goalIndex] || null;
      const m = this.activeMini[this.miniIndex] || null;

      if (this.elGoalMain) {
        this.elGoalMain.textContent = g
          ? g.label
          : 'ครบทุก Goal แล้ว';
      }
      if (this.elGoalProg) {
        if (g) {
          this.elGoalProg.textContent =
            this.score + ' / ' + g.targetScore;
        } else {
          const totalG = this.activeGoals ? this.activeGoals.length : 0;
          this.elGoalProg.textContent =
            this.goalsCleared + ' / ' + totalG;
        }
      }

      if (this.elMiniMain) {
        this.elMiniMain.textContent = m
          ? m.label
          : 'ครบทุก Mini quest แล้ว';
      }
      if (this.elMiniProg) {
        if (m) {
          this.elMiniProg.textContent =
            this.goodHits + ' / ' + m.targetGood;
        } else {
          const totalM = this.activeMini ? this.activeMini.length : 0;
          this.elMiniProg.textContent =
            this.miniCleared + ' / ' + totalM;
        }
      }
    },

    // ---------- Clear / remove ----------
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
