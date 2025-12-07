// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM Targets + Food-Group Quests + Fever/Particles)
// 2025-12-07

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // -------- Fever UI (shared) --------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // -------- Particles (optional) --------
  // ใช้เมื่อมี window.HHA_PARTICLES จาก /herohealth/vr/particles.js
  const Particles = window.HHA_PARTICLES || null;

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 12;
  const FEVER_MISS_LOSS = 18;

  // ---------- Utils ----------
  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // ตำแหน่งสุ่มกลางจอ หลบ HUD + โค้ช
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe = 140;    // HUD บน
    const bottomSafe = 160; // โค้ชด้านล่าง

    const left = w * 0.12;
    const right = w * 0.88;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ---------- Difficulty ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ถ้ามีตาราง difficulty แยกไฟล์ ให้ใช้ก่อน
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
        sizeFactor: 1.12,
        lifeTime: 3000,
        baseGood: 10,
        baseScore: 130
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        maxActive: 5,
        sizeFactor: 0.96,
        lifeTime: 2600,
        baseGood: 14,
        baseScore: 190
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0,
      lifeTime: 2800,
      baseGood: 12,
      baseScore: 160
    };
  }

  // ---------- Emoji helper ----------
  const GOOD_EMOJI = ['🥦', '🥕', '🍎', '🍌', '🍇', '🍚', '🍳', '🥛', '🥬'];
  const JUNK_EMOJI = ['🍰', '🍩', '🍟', '🍕', '🥤', '🍭', '🍪'];

  function pickEmoji(isGood) {
    // ถ้ามีโมดูล emoji-image ให้มันเลือก
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Food-group combos & quest text ----------
  const FOOD_GROUP_LABEL = {
    1: 'หมู่ 1 ข้าว-แป้งและธัญพืช',
    2: 'หมู่ 2 ผัก',
    3: 'หมู่ 3 ผลไม้',
    4: 'หมู่ 4 เนื้อสัตว์และโปรตีน',
    5: 'หมู่ 5 นมและผลิตภัณฑ์นม'
  };

  function comboToText(combo) {
    // [1,2,3] -> "หมู่ 1 ... + หมู่ 2 ... + หมู่ 3 ..."
    return combo
      .map((id) => FOOD_GROUP_LABEL[id] || ('หมู่ ' + id))
      .join(' + ');
  }

  function getCombosForDiff(diffKey) {
    const key = String(diffKey || 'normal').toLowerCase();

    if (key === 'easy') {
      // จัดครบ 2 หมู่
      return [
        [1, 2],
        [1, 3],
        [1, 4],
        [2, 3],
        [4, 5],
        [1, 5]
      ];
    }

    if (key === 'hard') {
      // 4–5 หมู่
      return [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [1, 2, 3, 4, 5]
      ];
    }

    // normal → 3 หมู่
    return [
      [1, 2, 3],
      [2, 3, 4],
      [1, 4, 5],
      [2, 4, 5]
    ];
  }

  // Goal = 2 ภารกิจจาก pool ที่อิงชุดหมู่อาหาร
  function buildGoals(cfg, diffKey) {
    const baseGood = cfg.baseGood || 12;
    const combos = getCombosForDiff(diffKey);
    const shuffled = shuffle(combos).slice(0, 2); // 2/ (ประมาณ 10) สำหรับรอบนี้

    return shuffled.map((combo, idx) => {
      const label = comboToText(combo);
      const target = baseGood + idx * 3; // ภารกิจที่ 2 โหดขึ้นเล็กน้อย

      return {
        kind: 'goal',
        type: 'good',  // ใช้ goodHits เป็น progress
        target,
        combo,
        text:
          'จัดเมนูให้ครบ ' +
          combo.length +
          ' หมู่อาหาร (' +
          label +
          ') โดยเลือกอาหารดีให้ได้อย่างน้อย ' +
          target +
          ' ชิ้น',
        done: false
      };
    });
  }

  // Mini quest = 3 ภารกิจจาก pool 15 (conceptual) — ผูกกับคะแนน + หมู่
  function buildMiniQuests(cfg, diffKey) {
    const baseScore = cfg.baseScore || 160;
    const combos = getCombosForDiff(diffKey);
    const combo = combos[Math.floor(Math.random() * combos.length)];
    const label = comboToText(combo);

    const pool = [
      {
        kind: 'mini',
        type: 'score',
        target: Math.round(baseScore * 0.6),
        text:
          'เริ่มจัดจานให้ครบหมู่ ' +
          label +
          ' ทำคะแนนจากอาหารดีให้ถึง ' +
          Math.round(baseScore * 0.6) +
          ' คะแนน',
        done: false
      },
      {
        kind: 'mini',
        type: 'score',
        target: Math.round(baseScore * 0.8),
        text:
          'พยายามรักษาสมดุล ' +
          label +
          ' แล้วทำคะแนนให้ถึง ' +
          Math.round(baseScore * 0.8) +
          ' คะแนน',
        done: false
      },
      {
        kind: 'mini',
        type: 'good',
        target: cfg.baseGood || 12,
        text:
          'ลองเลือกอาหารดีจากหมู่ ' +
          label +
          ' ให้ได้ครบ ' +
          (cfg.baseGood || 12) +
          ' ชิ้น',
        done: false
      },
      {
        kind: 'mini',
        type: 'good',
        target: (cfg.baseGood || 12) + 4,
        text:
          'เก็บอาหารดีจากหมู่ ' +
          label +
          ' ให้ได้อย่างน้อย ' +
          ((cfg.baseGood || 12) + 4) +
          ' ชิ้น',
        done: false
      },
      {
        kind: 'mini',
        type: 'score',
        target: baseScore + 20,
        text:
          'ลองจัดจานอาหารให้ครบหมู่แล้วทำคะแนนรวมให้ถึง ' +
          (baseScore + 20) +
          ' คะแนน',
        done: false
      }
      // นับรวม ~5 จาก pool ที่อาจขยายเป็น 15 ได้ภายหลัง
    ];

    return shuffle(pool).slice(0, 3); // 3/15
  }

  // ---------- Main component ----------
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

      // HUD elements
      this.elScore      = document.getElementById('hud-score');
      this.elTime       = document.getElementById('hud-time-label');
      this.elDiff       = document.getElementById('hud-diff-label');
      this.elGoalMain   = document.getElementById('hud-goal-main');
      this.elGoalProg   = document.getElementById('hud-goal-progress');
      this.elMiniMain   = document.getElementById('hud-mini-main');
      this.elMiniProg   = document.getElementById('hud-mini-progress');
      this.elCoachBubble= document.getElementById('coach-bubble');
      this.elCoachText  = document.getElementById('coach-text');
      this.elEndToast   = document.getElementById('end-toast');
      this.elEndScore   = document.getElementById('end-score');
      this.elEndQuest   = document.getElementById('end-quest');
      this.elEndGoalTxt = document.getElementById('end-goal-text');
      this.elEndMiniTxt = document.getElementById('end-mini-text');
      this.elMiss       = document.getElementById('hud-miss'); // ต้องมีใน layout แบบ GoodJunk

      // State
      this.running     = false;
      this.elapsed     = 0;
      this.timeLimit   = 60000; // 60s
      this.spawnTimer  = 0;
      this.targets     = [];
      this.score       = 0;
      this.goodHits    = 0;
      this.missCount   = 0;

      this.fever       = 0;
      this.feverActive = false;

      this.diffKey     = 'normal';
      this.diffCfg     = getDiffConfig(this.diffKey);

      this.goals       = [];
      this.miniQuests  = [];
      this.goalIndex   = 0;
      this.miniIndex   = 0;

      // Fever UI initial
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      // Listen start event from HTML
      scene.addEventListener('fg-start', (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      });

      console.log('[GroupsVR] Game component initialized');
    },

    // ----- Fever helper -----
    updateFever: function (delta) {
      this.fever = clamp((this.fever || 0) + delta, 0, FEVER_MAX);
      FeverUI.setFever(this.fever);

      const active = this.fever >= FEVER_MAX;
      FeverUI.setFeverActive(active);
      this.feverActive = active;
    },

    // ----- Coach helper -----
    coachSay: function (text) {
      if (!this.elCoachBubble || !this.elCoachText) return;
      this.elCoachText.textContent = text;
      this.elCoachBubble.classList.add('show');
      // ไม่ต้องซ่อนเร็วเกินไป
      setTimeout(() => {
        this.elCoachBubble.classList.remove('show');
      }, 2500);
    },

    // ----- Start / End -----
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

      this.goals      = buildGoals(this.diffCfg, this.diffKey);
      this.miniQuests = buildMiniQuests(this.diffCfg, this.diffKey);
      this.goalIndex  = 0;
      this.miniIndex  = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';
      if (this.elDiff)  this.elDiff.textContent  = this.diffKey.toUpperCase();
      if (this.elMiss)  this.elMiss.textContent  = '0';

      // Fever reset
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      this.updateQuestHUD();
      this.coachSay('เลือกอาหารดีจากหลาย ๆ หมู่ให้ครบตามเป้าหมายนะ!');

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);
    },

    endGame: function () {
      if (!this.running) return;
      this.running = false;

      this.clearTargets();

      const totalQuests =
        (this.goals ? this.goals.length : 0) +
        (this.miniQuests ? this.miniQuests.length : 0);
      let cleared = 0;
      (this.goals || []).forEach((g) => { if (g.done) cleared++; });
      (this.miniQuests || []).forEach((m) => { if (m.done) cleared++; });

      const scene = this.scene;
      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared: cleared,
        questsTotal: totalQuests,
        goal: this.describeQuestArray(this.goals),
        miniQuest: this.describeQuestArray(this.miniQuests)
      };

      if (scene) {
        scene.emit('fg-game-over', detail);
      }

      // HUD summary (กรณี HTML สร้าง end-toast ไว้)
      if (this.elEndScore) this.elEndScore.textContent = String(this.score);
      if (this.elEndQuest) {
        this.elEndQuest.textContent = cleared + ' / ' + totalQuests;
      }
      if (this.elEndGoalTxt) {
        this.elEndGoalTxt.textContent =
          this.describeQuestArray(this.goals) || '-';
      }
      if (this.elEndMiniTxt) {
        this.elEndMiniTxt.textContent =
          this.describeQuestArray(this.miniQuests) || '-';
      }
      if (this.elEndToast) {
        this.elEndToast.classList.add('show');
      }

      console.log('[GroupsVR] game over', detail);
    },

    describeQuestArray: function (arr) {
      if (!arr || !arr.length) return '';
      return arr
        .map((q, idx) => {
          const tag = q.kind === 'mini' ? 'Mini ' : 'Goal ';
          const status = q.done ? '✓' : '…';
          return tag + (idx + 1) + ' ' + status + ' — ' + q.text;
        })
        .join(' | ');
    },

    // ----- Tick -----
    tick: function (time, dt) {
      if (!this.running) return;

      dt = dt || 16;
      this.elapsed    += dt;
      this.spawnTimer += dt;

      // นับเวลา
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

      // เช็กเป้าหมดอายุ (นับ Miss)
      const life = this.diffCfg.lifeTime || 2800;
      const now = performance.now();
      const leftover = [];
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (!t) continue;
        if (now - t.spawnAt > life) {
          this.handleExpire(t);
        } else {
          leftover.push(t);
        }
      }
      this.targets = leftover;
    },

    // ----- Spawn / Remove targets -----
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      // concept: ส่วนใหญ่เป็นอาหารดี แต่มี junk แซมเล็กน้อย
      const isGood = Math.random() < 0.7;
      const emoji  = pickEmoji(isGood);
      const pos    = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform =
        'translate(-50%, -50%) scale(' + baseScale.toFixed(2) + ')';

      const targetObj = {
        el,
        isGood,
        spawnAt: performance.now()
      };
      this.targets.push(targetObj);

      const self = this;
      function onHit(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const x = ev.clientX || pos.x;
        const y = ev.clientY || pos.y;
        self.handleHit(targetObj, x, y);
      }

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      this.layer.appendChild(el);
    },

    clearTargets: function () {
      if (!this.layer) return;
      this.targets.forEach((t) => {
        if (t && t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
      });
      this.targets = [];
    },

    // ----- Hit / Miss -----
    handleHit: function (target, x, y) {
      if (!this.running) return;
      const el = target.el;
      if (!el || !el.parentNode) return;

      // ลบออกจาก list ก่อน
      this.targets = this.targets.filter((t) => t !== target);

      let delta = 0;
      let label = 'GOOD';

      if (target.isGood) {
        if (this.feverActive) {
          delta = 15;
          label = 'PERFECT';
        } else {
          delta = 10;
          label = 'GOOD';
        }
        this.score    += delta;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);
      } else {
        // โดน Junk → หักคะแนน + นับ Miss
        delta = -8;
        label = 'MISS';
        this.score = Math.max(0, this.score + delta);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      if (this.elMiss)  this.elMiss.textContent  = String(this.missCount);

      // FX เด้งคะแนน + แตกกระจาย
      if (Particles && Particles.scorePop) {
        const txt = (label === 'MISS' ? 'MISS ' : label + ' ')
          + (delta > 0 ? '+' + delta : delta);
        Particles.scorePop(x, y, txt, { good: delta > 0 });
      }
      if (Particles && Particles.burstAt) {
        Particles.burstAt(x, y, {
          color: delta > 0 ? '#22c55e' : '#f97373',
          count: delta > 0 ? 14 : 10,
          radius: 60
        });
      }

      // เอฟเฟกต์หายไป
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      // อัปเดตภารกิจ
      this.updateQuestProgress();
    },

    handleExpire: function (target) {
      // หมดเวลา → นับ Miss เฉพาะถ้าเป็นอาหารดีหรือยังไม่โดนเลย
      if (!target || !target.el) return;
      const rect = target.el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      if (target.isGood) {
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS * 0.5);
        if (this.elMiss) this.elMiss.textContent = String(this.missCount);

        if (Particles && Particles.scorePop) {
          Particles.scorePop(x, y, 'MISS', { good: false });
        }
      }

      if (target.el.parentNode) {
        target.el.parentNode.removeChild(target.el);
      }
    },

    // ----- Quest progression -----
    updateQuestProgress: function () {
      // Goal (ใช้ goodHits/score ตาม type)
      const g = this.goals[this.goalIndex];
      if (g && !g.done) {
        const val = g.type === 'score' ? this.score : this.goodHits;
        if (val >= g.target) {
          g.done = true;
          this.goalIndex++;
          this.coachSay('Goal ' + this.goalIndex + ' สำเร็จแล้ว! 🎯');
        }
      }

      // Mini quest
      const m = this.miniQuests[this.miniIndex];
      if (m && !m.done) {
        const val2 = m.type === 'score' ? this.score : this.goodHits;
        if (val2 >= m.target) {
          m.done = true;
          this.miniIndex++;
          this.coachSay('Mini quest สำเร็จอีก 1 ภารกิจแล้ว! ✨');
        }
      }

      this.updateQuestHUD();
    },

    updateQuestHUD: function () {
      const g = this.goals[this.goalIndex] || null;
      const m = this.miniQuests[this.miniIndex] || null;

      // Goal text + progress
      if (this.elGoalMain) {
        this.elGoalMain.textContent =
          g ? g.text : 'ภารกิจหลักครบแล้ว เยี่ยมมาก!';
      }
      if (this.elGoalProg) {
        if (g) {
          const val = g.type === 'score' ? this.score : this.goodHits;
          const prog = clamp(val, 0, g.target);
          this.elGoalProg.textContent = '(' + prog + ' / ' + g.target + ')';
        } else {
          this.elGoalProg.textContent = '(✔ / ✔)';
        }
      }

      // Mini quest text + progress
      if (this.elMiniMain) {
        this.elMiniMain.textContent =
          m ? m.text : 'Mini quest ครบแล้ว ลองทำคะแนนรวมให้สูงขึ้นได้เลย!';
      }
      if (this.elMiniProg) {
        if (m) {
          const val2 = m.type === 'score' ? this.score : this.goodHits;
          const prog2 = clamp(val2, 0, m.target);
          this.elMiniProg.textContent = '(' + prog2 + ' / ' + m.target + ')';
        } else {
          this.elMiniProg.textContent = '(✔ / ✔)';
        }
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
