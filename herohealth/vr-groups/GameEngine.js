// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Food-group goals + FX + Coach)
// 2025-12-07

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // Fever UI (จาก ui-fever.js แบบ non-module)
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // Particle FX (จาก vr/particles.js ที่ผูก global HHA_PARTICLES)
  const Particles = window.HHA_PARTICLES || null;

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 12;
  const FEVER_MISS_LOSS = 18;
  const TARGET_LIFETIME = 2600; // ms

  // ==== Food groups (หมู่ 1–5) ====
  // ใช้สำหรับนับ quest ว่าจัดหมู่ได้ครบหรือยัง
  const FOOD_GROUPS = [
    {
      id: 1,
      labelShort: 'หมู่ 1 ข้าว-แป้ง',
      labelLong: 'หมู่ 1: ข้าว แป้ง ธัญพืช ให้พลังงานหลักของร่างกาย'
    },
    {
      id: 2,
      labelShort: 'หมู่ 2 เนื้อ-ไข่-ถั่ว',
      labelLong: 'หมู่ 2: เนื้อสัตว์ ไข่ ถั่วเมล็ดแห้ง ช่วยซ่อมแซมส่วนที่สึกหรอ'
    },
    {
      id: 3,
      labelShort: 'หมู่ 3 ผัก',
      labelLong: 'หมู่ 3: ผักใบเขียวและผักสีต่าง ๆ ช่วยให้ระบบขับถ่ายและภูมิคุ้มกันดี'
    },
    {
      id: 4,
      labelShort: 'หมู่ 4 ผลไม้',
      labelLong: 'หมู่ 4: ผลไม้หลากสี มีวิตามินและไฟเบอร์'
    },
    {
      id: 5,
      labelShort: 'หมู่ 5 นม',
      labelLong: 'หมู่ 5: นมและผลิตภัณฑ์จากนม มีแคลเซียมบำรุงกระดูกและฟัน'
    }
  ];

  function groupNameById(id) {
    const g = FOOD_GROUPS.find((x) => x.id === id);
    return g ? g.labelShort : 'หมู่อาหาร';
  }

  // ==== Goal / Mini quest pool (concept จัดหมู่อาหาร) ====
  // เลือกมาเล่นรอบละ 2 goal + 3 mini แบบสุ่มจาก pool นี้
  const GOAL_POOL = [
    { id: 'g1', groups: [1], need: 8,  text: 'เก็บหมู่ 1 (ข้าว-แป้ง) ให้ครบ 8 ชิ้น' },
    { id: 'g2', groups: [2], need: 8,  text: 'เก็บหมู่ 2 (เนื้อ-ไข่-ถั่ว) ให้ครบ 8 ชิ้น' },
    { id: 'g3', groups: [3], need: 8,  text: 'เก็บหมู่ 3 (ผัก) ให้ครบ 8 ชิ้น' },
    { id: 'g4', groups: [4], need: 8,  text: 'เก็บหมู่ 4 (ผลไม้) ให้ครบ 8 ชิ้น' },
    { id: 'g5', groups: [5], need: 6,  text: 'เก็บหมู่ 5 (นม) ให้ครบ 6 ชิ้น' },
    { id: 'g6', groups: [1,3], need: 12, text: 'ผสมหมู่ 1 + 3 ให้ได้รวม 12 ชิ้น' },
    { id: 'g7', groups: [2,4], need: 12, text: 'ผสมหมู่ 2 + 4 ให้ได้รวม 12 ชิ้น' },
    { id: 'g8', groups: [3,4], need: 10, text: 'เน้นผักและผลไม้ (หมู่ 3 + 4) 10 ชิ้น' },
    { id: 'g9', groups: [1,2,3], need: 14, text: 'เก็บจานหลักครบ 3 หมู่ (1+2+3) 14 ชิ้น' },
    { id: 'g10', groups: [2,3,4], need: 14, text: 'หมู่โปรตีน+ผัก+ผลไม้ (2+3+4) 14 ชิ้น' }
  ];

  const MINI_POOL = [
    { id: 'm1', groups: [3], need: 5,  text: 'Mini: ผักสีเขียว (หมู่ 3) 5 ชิ้น' },
    { id: 'm2', groups: [4], need: 5,  text: 'Mini: ผลไม้ 5 สี (หมู่ 4) 5 ชิ้น' },
    { id: 'm3', groups: [1], need: 4,  text: 'Mini: ข้าว-แป้งพอดีมือ (หมู่ 1) 4 ชิ้น' },
    { id: 'm4', groups: [2], need: 4,  text: 'Mini: โปรตีนดี (หมู่ 2) 4 ชิ้น' },
    { id: 'm5', groups: [5], need: 3,  text: 'Mini: ดื่มนม (หมู่ 5) 3 กล่อง/แก้ว' },
    { id: 'm6', groups: [3,4], need: 6, text: 'Mini: ผัก + ผลไม้ รวม 6 ชิ้น' },
    { id: 'm7', groups: [1,2], need: 6, text: 'Mini: ข้าว + โปรตีน 6 ชิ้น' },
    { id: 'm8', groups: [2,5], need: 5, text: 'Mini: โปรตีน + นม รวม 5 ชิ้น' },
    { id: 'm9', groups: [1,4], need: 6, text: 'Mini: ข้าว + ผลไม้ 6 ชิ้น' },
    { id: 'm10', groups: [1,2,3], need: 8, text: 'Mini: เมนูหลัก 3 หมู่ (1+2+3) 8 ชิ้น' },
    { id: 'm11', groups: [2,3,4], need: 8, text: 'Mini: โปรตีน+ผัก+ผลไม้ 8 ชิ้น' },
    { id: 'm12', groups: [3,5], need: 5, text: 'Mini: ผัก + นม 5 ชิ้น' },
    { id: 'm13', groups: [4,5], need: 5, text: 'Mini: ผลไม้ + นม 5 ชิ้น' },
    { id: 'm14', groups: [1,5], need: 4, text: 'Mini: ข้าว + นม 4 ชิ้น' },
    { id: 'm15', groups: [1,2,4], need: 8, text: 'Mini: ข้าว+โปรตีน+ผลไม้ 8 ชิ้น' }
  ];

  function pickRandomSubset(pool, count) {
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.slice(0, count);
  }

  // ==== Emoji helper (รองรับ emoji-image.js ถ้ามี) ====

  const FALLBACK_EMOJI = {
    1: ['🍚','🍞','🥖','🥐'],
    2: ['🍗','🥩','🍳','🥜'],
    3: ['🥦','🥕','🥬','🫛'],
    4: ['🍎','🍌','🍇','🍉'],
    5: ['🥛','🧀','🍨','🍦'],
    junk: ['🍩','🍟','🍕','🥤','🍰','🍫']
  };

  function pickFoodEmoji(groupId, healthy) {
    // ถ้ามีโมดูล emojiImage ที่รองรับหมู่อาหาร
    if (ns.emojiImage && typeof ns.emojiImage.pickGroup === 'function') {
      return ns.emojiImage.pickGroup(groupId, healthy);
    }
    if (!healthy) {
      const arrJ = FALLBACK_EMOJI.junk;
      return arrJ[Math.floor(Math.random() * arrJ.length)];
    }
    const arr = FALLBACK_EMOJI[groupId] || FALLBACK_EMOJI[1];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==== Random screen position (เลี่ยง HUD บน + โค้ชล่าง) ====

  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe = 120;   // HUD บน
    const bottomSafe = 140; // โค้ชด้านล่าง

    const left = w * 0.18;
    const right = w * 0.82;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ==== Difficulty ====
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    if (diffKey === 'easy') {
      return {
        spawnInterval: 1200,
        maxActive: 4,
        sizeFactor: 1.15
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 800,
        maxActive: 6,
        sizeFactor: 0.95
      };
    }
    // normal
    return {
      spawnInterval: 1000,
      maxActive: 5,
      sizeFactor: 1.0
    };
  }

  // ==== Component main ====
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      // Layer เป้า
      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

      // HUD
      this.elScore      = document.getElementById('hud-score');
      this.elDiff       = document.getElementById('hud-diff-label');
      this.elTime       = document.getElementById('hud-time-label');
      this.elMiss       = document.getElementById('hud-miss'); // ถ้ายังไม่ได้ใส่ใน HTML ก็จะเงียบ ๆ ไปเฉย ๆ

      this.elGoalMain   = document.getElementById('hud-goal-main');
      this.elGoalProg   = document.getElementById('hud-goal-progress');
      this.elMiniMain   = document.getElementById('hud-mini-main');
      this.elMiniProg   = document.getElementById('hud-mini-progress');

      // Coach
      this.elCoachBubble = document.getElementById('coach-bubble');
      this.elCoachText   = document.getElementById('coach-text');
      this._coachFxTimer = null;

      // Summary (end-toast รับ event จาก HTML)
      // → แค่ emit 'fg-game-over' จากนี่

      // State พื้นฐาน
      this.running    = false;
      this.elapsed    = 0;
      this.timeLimit  = 60000;
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.missCount  = 0;
      this.goodHits   = 0;

      this.groupHits  = { 1:0, 2:0, 3:0, 4:0, 5:0 };

      // Goal / mini queue
      this.goalQueue  = [];
      this.miniQueue  = [];
      this.goalIndex  = 0;
      this.miniIndex  = 0;
      this.goalsCleared = 0;
      this.miniCleared  = 0;

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      // รอ event จาก HTML
      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ===== Helper: Coach =====
    coachSay: function (text) {
      if (!this.elCoachBubble || !this.elCoachText) return;
      if (!text) return;
      this.elCoachText.textContent = text;
      this.elCoachBubble.classList.add('show');
      setTimeout(() => {
        this.elCoachBubble && this.elCoachBubble.classList.remove('show');
      }, 2500);
    },

    reactCoach: function (judgment) {
      const bubble = this.elCoachBubble;
      if (!bubble) return;
      const avatar = bubble.querySelector('.coach-avatar');
      if (!avatar) return;

      bubble.classList.add('show');

      bubble.classList.remove('coach-good', 'coach-bad', 'coach-hype');
      avatar.classList.remove(
        'coach-avatar-good',
        'coach-avatar-bad',
        'coach-avatar-hype'
      );

      let bubbleClass = '';
      let avatarClass = '';

      switch (judgment) {
        case 'PERFECT':
          bubbleClass = 'coach-hype';
          avatarClass = 'coach-avatar-hype';
          break;
        case 'GOOD':
          bubbleClass = 'coach-good';
          avatarClass = 'coach-avatar-good';
          break;
        case 'MISS':
        case 'LATE':
          bubbleClass = 'coach-bad';
          avatarClass = 'coach-avatar-bad';
          break;
        default:
          break;
      }

      if (bubbleClass) bubble.classList.add(bubbleClass);
      if (avatarClass) avatar.classList.add(avatarClass);

      clearTimeout(this._coachFxTimer);
      this._coachFxTimer = setTimeout(() => {
        bubble.classList.remove('coach-good', 'coach-bad', 'coach-hype');
        avatar.classList.remove(
          'coach-avatar-good',
          'coach-avatar-bad',
          'coach-avatar-hype'
        );
      }, 500);
    },

    // ===== Helper: quest =====
    resetQuests: function () {
      this.groupHits = { 1:0, 2:0, 3:0, 4:0, 5:0 };

      this.goalQueue  = pickRandomSubset(GOAL_POOL, 2);
      this.miniQueue  = pickRandomSubset(MINI_POOL, 3);
      this.goalIndex  = 0;
      this.miniIndex  = 0;
      this.goalsCleared = 0;
      this.miniCleared  = 0;

      // reset flag
      this.goalQueue.forEach((g) => { g._done = false; });
      this.miniQueue.forEach((m) => { m._done = false; });

      this.updateQuestHUD();
    },

    currentGoal: function () {
      if (this.goalIndex < this.goalQueue.length) {
        return this.goalQueue[this.goalIndex];
      }
      return null;
    },

    currentMini: function () {
      if (this.miniIndex < this.miniQueue.length) {
        return this.miniQueue[this.miniIndex];
      }
      return null;
    },

    sumGroupHits: function (groups) {
      let sum = 0;
      for (let i = 0; i < groups.length; i++) {
        const id = groups[i];
        sum += this.groupHits[id] || 0;
      }
      return sum;
    },

    updateQuestHUD: function () {
      const g = this.currentGoal();
      const m = this.currentMini();

      if (g && this.elGoalMain && this.elGoalProg) {
        const cur = Math.min(this.sumGroupHits(g.groups), g.need);
        this.elGoalMain.textContent = g.text;
        this.elGoalProg.textContent =
          '(' + cur + ' / ' + g.need + ')  เป้าหมาย ' +
          (this.goalIndex + 1) + '/' + this.goalQueue.length;
      } else if (this.elGoalMain && this.elGoalProg) {
        this.elGoalMain.textContent = 'Goal ทั้งหมดสำเร็จแล้ว';
        this.elGoalProg.textContent =
          '(' + this.goalsCleared + ' / ' + this.goalQueue.length + ')';
      }

      if (m && this.elMiniMain && this.elMiniProg) {
        const curM = Math.min(this.sumGroupHits(m.groups), m.need);
        this.elMiniMain.textContent = m.text;
        this.elMiniProg.textContent =
          '(' + curM + ' / ' + m.need + ')  Mini ' +
          (this.miniIndex + 1) + '/' + this.miniQueue.length;
      } else if (this.elMiniMain && this.elMiniProg) {
        this.elMiniMain.textContent = 'Mini quest ทั้งหมดสำเร็จแล้ว';
        this.elMiniProg.textContent =
          '(' + this.miniCleared + ' / ' + this.miniQueue.length + ')';
      }
    },

    checkQuestProgress: function () {
      let g = this.currentGoal();
      if (g && !g._done) {
        const cur = this.sumGroupHits(g.groups);
        if (cur >= g.need) {
          g._done = true;
          this.goalsCleared++;
          this.goalIndex++;
          const desc = groupNameById(g.groups[0]);
          this.coachSay('เยี่ยม! ' + desc + ' ครบตามเป้าแล้ว 🎉');
        }
      }

      let m = this.currentMini();
      if (m && !m._done) {
        const curM = this.sumGroupHits(m.groups);
        if (curM >= m.need) {
          m._done = true;
          this.miniCleared++;
          this.miniIndex++;
          const descM = groupNameById(m.groups[0]);
          this.coachSay('Mini quest ผ่านแล้ว: ' + descM + ' ✅');
        }
      }

      this.updateQuestHUD();
    },

    // ===== Fever =====
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
      this.feverActive = active;
    },

    // ===== Lifecycle =====
    startGame: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();

      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.missCount  = 0;
      this.goodHits   = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';
      if (this.elMiss)  this.elMiss.textContent  = '0';

      if (this.elDiff)  this.elDiff.textContent  = this.diffKey.toUpperCase();

      // reset quest
      this.resetQuests();

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      this.coachSay('จัดหมู่อาหารให้ครบตามภารกิจกันนะ! 🥦🍎🍚');

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
        goalsCleared: this.goalsCleared,
        goalsTotal: this.goalQueue.length,
        miniCleared: this.miniCleared,
        miniTotal: this.miniQueue.length,
        groupHits: this.groupHits
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);

      this.coachSay('เก่งมาก! มาดูสรุปภารกิจหมู่อาหารกัน 👀');
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

    // ===== Targets =====
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      // เลือกหมู่อาหาร 1–5
      const groupId = 1 + Math.floor(Math.random() * 5);

      // สุขภาพดี ~ 70% (เพื่อให้เด็กเน้นเลือกของดี)
      const healthy = Math.random() < 0.7;

      const emoji = pickFoodEmoji(groupId, healthy);
      const pos   = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (healthy ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        groupId,
        healthy,
        alive: true
      };
      this.targets.push(targetObj);

      const onHit = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (!targetObj.alive) return;
        targetObj.alive = false;

        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        this.handleHit(targetObj, x, y);
      };

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      // หมดเวลา = LATE (สำหรับเป้าดี)
      setTimeout(() => {
        if (!targetObj.alive) return;
        targetObj.alive = false;
        this.handleExpire(targetObj);
      }, TARGET_LIFETIME);

      this.layer.appendChild(el);
    },

    // Hit = GOOD / PERFECT / MISS
    handleHit: function (target, x, y) {
      if (!this.running) return;
      const el = target.el;
      if (!el || !el.parentNode) return;

      this.targets = this.targets.filter((t) => t !== target);

      let delta   = 0;
      let label   = 'GOOD';

      if (target.healthy) {
        // นับเป็น hit ที่ถูกต้อง + นับหมู่อาหาร
        this.groupHits[target.groupId] =
          (this.groupHits[target.groupId] || 0) + 1;

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
        delta = -8;
        label = 'MISS';
        this.score = Math.max(0, this.score + delta);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      if (this.elMiss)  this.elMiss.textContent  = String(this.missCount);

      // FX: คะแนนเด้ง + แตกกระจาย
      if (Particles && typeof Particles.scorePop === 'function') {
        const txt =
          label + ' ' + (delta > 0 ? '+' + delta : delta.toString());
        Particles.scorePop(x, y, txt, { good: delta > 0 });
      }
      if (Particles && typeof Particles.burstAt === 'function') {
        Particles.burstAt(x, y, {
          color: delta > 0 ? '#22c55e' : '#f97373',
          count: delta > 0 ? 16 : 10,
          radius: 64
        });
      }

      // Coach react
      this.reactCoach(label);

      // เป้าแตกหายไป
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      // เช็ค quest
      if (target.healthy) {
        this.checkQuestProgress();
      }
    },

    // เป้าหมดเวลา = LATE (เฉพาะเป้าดี)
    handleExpire: function (target) {
      const el = target.el;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      if (target.healthy) {
        this.missCount += 1;
        if (this.elMiss) this.elMiss.textContent = String(this.missCount);

        const penalty = 5;
        this.score = Math.max(0, this.score - penalty);
        if (this.elScore) this.elScore.textContent = String(this.score);

        this.updateFever(-FEVER_MISS_LOSS * 0.5);

        if (Particles && typeof Particles.scorePop === 'function') {
          Particles.scorePop(x, y, 'LATE -' + penalty, { good: false });
        }
        if (Particles && typeof Particles.burstAt === 'function') {
          Particles.burstAt(x, y, {
            color: '#f97373',
            count: 10,
            radius: 50
          });
        }

        this.reactCoach('LATE');
      }

      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }

      this.targets = this.targets.filter((t) => t !== target);
    },

    clearTargets: function () {
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
