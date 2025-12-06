// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest + FeverUI)
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
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 15;

  // ---------- Quest pools ----------
  // kind: 'score' | 'goodHits'
  const GOAL_POOL = [
    {
      id: 'G_SCORE_150',
      label: 'ทำคะแนนให้ได้อย่างน้อย 150 แต้ม',
      kind: 'score',
      easy: 120, normal: 150, hard: 180
    },
    {
      id: 'G_SCORE_200',
      label: 'ทำคะแนนให้ได้อย่างน้อย 200 แต้ม',
      kind: 'score',
      easy: 150, normal: 200, hard: 240
    },
    {
      id: 'G_SCORE_260',
      label: 'ทำคะแนนให้ได้อย่างน้อย 260 แต้ม',
      kind: 'score',
      easy: 180, normal: 260, hard: 320
    },
    {
      id: 'G_GOOD_12',
      label: 'เก็บอาหารดีให้ได้อย่างน้อย 12 ชิ้น',
      kind: 'goodHits',
      easy: 8, normal: 12, hard: 16
    },
    {
      id: 'G_GOOD_16',
      label: 'เก็บอาหารดีให้ได้อย่างน้อย 16 ชิ้น',
      kind: 'goodHits',
      easy: 10, normal: 16, hard: 20
    },
    {
      id: 'G_GOOD_20',
      label: 'เก็บอาหารดีให้ได้อย่างน้อย 20 ชิ้น',
      kind: 'goodHits',
      easy: 12, normal: 20, hard: 24
    },
    {
      id: 'G_MIX_1',
      label: 'ทำคะแนนและอาหารดีให้ถึงเป้า (คะแนน 160+, อาหารดี ≥ 14 ชิ้น)',
      kind: 'mixed1',
      easy:  { score: 120, good: 10 },
      normal:{ score: 160, good: 14 },
      hard:  { score: 210, good: 18 }
    },
    {
      id: 'G_MIX_2',
      label: 'เล่นจบโดยเก็บอาหารดีเยอะและไม่โดนขยะมาก',
      kind: 'mixed2',
      easy:  { score: 130, good: 10 },
      normal:{ score: 170, good: 14 },
      hard:  { score: 220, good: 18 }
    },
    {
      id: 'G_SCORE_100',
      label: 'อุ่นเครื่องให้ได้อย่างน้อย 100 แต้ม',
      kind: 'score',
      easy: 80, normal: 100, hard: 130
    },
    {
      id: 'G_GOOD_10',
      label: 'เริ่มต้นด้วยอาหารดี 10 ชิ้น',
      kind: 'goodHits',
      easy: 7, normal: 10, hard: 14
    }
  ];

  const MINI_POOL = [
    { id: 'M_SCORE_60',  label: 'ทำคะแนนย่อยให้ถึง 60 แต้ม',  kind: 'score',     easy: 40, normal: 60,  hard: 80  },
    { id: 'M_SCORE_90',  label: 'ทำคะแนนย่อยให้ถึง 90 แต้ม',  kind: 'score',     easy: 60, normal: 90,  hard: 120 },
    { id: 'M_SCORE_120', label: 'ทำคะแนนย่อยให้ถึง 120 แต้ม', kind: 'score',     easy: 80, normal: 120, hard: 150 },
    { id: 'M_GOOD_6',    label: 'เก็บอาหารดีอย่างน้อย 6 ชิ้น', kind: 'goodHits', easy: 4,  normal: 6,   hard: 8   },
    { id: 'M_GOOD_8',    label: 'เก็บอาหารดีอย่างน้อย 8 ชิ้น', kind: 'goodHits', easy: 5,  normal: 8,   hard: 10  },
    { id: 'M_GOOD_10',   label: 'เก็บอาหารดีอย่างน้อย 10 ชิ้น',kind: 'goodHits', easy: 6,  normal: 10,  hard: 12  },
    { id: 'M_GOOD_4',    label: 'เริ่มจากเก็บอาหารดี 4 ชิ้นให้ได้ก่อน',kind: 'goodHits', easy: 3, normal: 4, hard: 5 },
    { id: 'M_SCORE_40',  label: 'เก็บคะแนนแรกให้ถึง 40 แต้ม', kind: 'score', easy: 30, normal: 40, hard: 60 },
    { id: 'M_SCORE_80',  label: 'เก็บคะแนนเพิ่มให้ถึง 80 แต้ม',kind: 'score', easy: 50, normal: 80, hard: 100 },
    { id: 'M_GOOD_12',   label: 'ลองเก็บอาหารดี 12 ชิ้นดู',   kind: 'goodHits', easy: 8, normal: 12, hard: 14 },
    { id: 'M_SCORE_30',  label: 'วอร์มอัพ 30 แต้มแรก',         kind: 'score', easy: 20, normal: 30, hard: 45 },
    { id: 'M_GOOD_5',    label: 'อย่าให้พลาด เก็บอาหารดี 5 ชิ้น',kind: 'goodHits', easy: 3, normal: 5, hard: 7 },
    { id: 'M_SCORE_50',  label: 'ทำคะแนนเก็บเพิ่มอีกให้ถึง 50 แต้ม',kind: 'score', easy: 35, normal: 50, hard: 70 },
    { id: 'M_GOOD_7',    label: 'เก็บอาหารดี 7 ชิ้นให้ได้',    kind: 'goodHits', easy: 4, normal: 7, hard: 9 },
    { id: 'M_GOOD_9',    label: 'ท้าทาย! อาหารดี 9 ชิ้น',      kind: 'goodHits', easy: 6, normal: 9, hard: 11 }
  ];

  // ---------- Difficulty helper ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1400,
        maxActive: 3,
        sizeFactor: 1.15,
        lifeTime: 2600
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        maxActive: 5,
        sizeFactor: 0.9,
        lifeTime: 2200
      };
    }
    // normal
    return {
      spawnInterval: 1200,
      maxActive: 4,
      sizeFactor: 1.0,
      lifeTime: 2400
    };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function getQuestTarget(q, diffKey) {
    diffKey = diffKey || 'normal';
    const v = q[diffKey];
    if (typeof v === 'number') return v;
    if (typeof q.normal === 'number') return q.normal;
    return v || 0;
  }

  // ---------- Emoji helper ----------
  const GOOD_EMOJI_FALLBACK = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI_FALLBACK = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function chooseEmoji(kind) {
    // ถ้ามี emojiImage จริง ใช้เลย
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      const ch = ns.emojiImage.pick(kind);
      const info = (typeof ns.emojiImage.getInfo === 'function')
        ? ns.emojiImage.getInfo(ch) || {}
        : {};
      return {
        emoji: ch,
        isGood: info.isGood != null ? !!info.isGood : (kind !== 'junk'),
        itemType: info.type || (kind === 'shield' ? 'shield' :
                                kind === 'star' ? 'star' :
                                kind === 'diamond' ? 'diamond' : 'food'),
        group: info.group || null
      };
    }

    // fallback
    if (kind === 'junk') {
      const ch = JUNK_EMOJI_FALLBACK[Math.floor(Math.random() * JUNK_EMOJI_FALLBACK.length)];
      return { emoji: ch, isGood: false, itemType: 'food', group: 'junk' };
    }
    // star / diamond / shield fallback เป็น emoji ตรงตัว
    if (kind === 'star')    return { emoji: '⭐', isGood: true, itemType: 'star',    group: 'power' };
    if (kind === 'diamond') return { emoji: '💎', isGood: true, itemType: 'diamond', group: 'power' };
    if (kind === 'shield')  return { emoji: '🛡️', isGood: true, itemType: 'shield',  group: 'power' };

    const ch = GOOD_EMOJI_FALLBACK[Math.floor(Math.random() * GOOD_EMOJI_FALLBACK.length)];
    return { emoji: ch, isGood: true, itemType: 'food', group: 'good' };
  }

  // ---------- Random position (กลางจอ, หลบ HUD + โค้ช) ----------
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 120;  // HUD บน
    const bottomSafe = 150;  // Coach + Fever ล่าง

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
      this.running     = false;
      this.elapsed     = 0;
      this.timeLimit   = 60000; // ms
      this.spawnTimer  = 0;
      this.targets     = [];
      this.score       = 0;
      this.goodHits    = 0;
      this.junkHits    = 0;
      this.missCount   = 0;

      // Fever + shield
      this.fever       = 0;
      this.feverActive = false;
      this.shield      = 0;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      // quests
      this.diffKey       = 'normal';
      this.diffCfg       = getDiffConfig(this.diffKey);
      this.goalQueue     = [];
      this.miniQueue     = [];
      this.goalIndex     = 0;
      this.miniIndex     = 0;
      this.goalsCleared  = 0;
      this.miniCleared   = 0;
      this.goalLimit     = 2;
      this.miniLimit     = 3;

      // รอ event จาก HTML
      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---------- helper ----------
    getMetric: function (kind) {
      switch (kind) {
        case 'score':    return this.score;
        case 'goodHits': return this.goodHits;
        default:
          return 0;
      }
    },

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

    setupQuests: function () {
      const diff = this.diffKey || 'normal';

      // สุ่ม goal 2 จาก 10
      const gList = shuffle(GOAL_POOL).slice(0, this.goalLimit);
      this.goalQueue = gList.map((q) => {
        let target;
        if (q.kind === 'mixed1' || q.kind === 'mixed2') {
          const obj = q[diff] || q.normal;
          target = obj || { score: 0, good: 0 };
        } else {
          target = getQuestTarget(q, diff);
        }
        return {
          def: q,
          target: target,
          done: false
        };
      });

      // สุ่ม mini 3 จาก 15
      const mList = shuffle(MINI_POOL).slice(0, this.miniLimit);
      this.miniQueue = mList.map((q) => ({
        def: q,
        target: getQuestTarget(q, diff),
        done: false
      }));

      this.goalIndex    = 0;
      this.miniIndex    = 0;
      this.goalsCleared = 0;
      this.miniCleared  = 0;

      this.updateQuestHUD();
    },

    evaluateQuestList: function (list, type) {
      if (!list || !list.length) return;

      const idxKey     = type === 'goal' ? 'goalIndex' : 'miniIndex';
      const clearedKey = type === 'goal' ? 'goalsCleared' : 'miniCleared';

      let idx = this[idxKey] || 0;

      while (idx < list.length) {
        const q = list[idx];
        if (q.done) {
          idx++;
          continue;
        }

        const def = q.def;
        let ok = false;

        if (def.kind === 'score') {
          ok = this.score >= q.target;
        } else if (def.kind === 'goodHits') {
          ok = this.goodHits >= q.target;
        } else if (def.kind === 'mixed1' || def.kind === 'mixed2') {
          const t = q.target || {};
          ok = (this.score >= (t.score || 0)) &&
               (this.goodHits >= (t.good || 0));
        }

        if (ok) {
          q.done = true;
          this[clearedKey] = (this[clearedKey] || 0) + 1;
          idx++;
          // loop ต่อเผื่อค่าปัจจุบันเกินเป้าของหลายภารกิจ
          continue;
        }
        break; // ภารกิจนี้ยังไม่จบ → เป็นตัว active
      }

      this[idxKey] = Math.min(idx, list.length);
    },

    updateQuestHUD: function () {
      // Goal
      if (this.elGoalMain && this.elGoalProg) {
        let text = '-';
        let prog = '-';

        if (this.goalQueue.length) {
          if (this.goalIndex >= this.goalQueue.length) {
            text = 'ทำครบทุกเป้าหมายหลักแล้ว';
            prog = this.goalsCleared + ' / ' + this.goalQueue.length;
          } else {
            const q = this.goalQueue[this.goalIndex];
            const def = q.def;
            text = def.label;

            let cur = 0;
            if (def.kind === 'score')      cur = this.score;
            else if (def.kind === 'goodHits') cur = this.goodHits;
            else if (def.kind === 'mixed1' || def.kind === 'mixed2') {
              const t = q.target || {};
              prog = `คะแนน ${this.score}/${t.score || 0}, อาหารดี ${this.goodHits}/${t.good || 0}`;
            }

            if (def.kind !== 'mixed1' && def.kind !== 'mixed2') {
              prog = cur + ' / ' + q.target;
            }

            if (q.done) prog += ' ✓';
          }
        }

        this.elGoalMain.textContent = text;
        this.elGoalProg.textContent = prog;
      }

      // Mini quest
      if (this.elMiniMain && this.elMiniProg) {
        let text = '-';
        let prog = '-';

        if (this.miniQueue.length) {
          if (this.miniIndex >= this.miniQueue.length) {
            text = 'ทำครบมินิภารกิจแล้ว';
            prog = this.miniCleared + ' / ' + this.miniQueue.length;
          } else {
            const q = this.miniQueue[this.miniIndex];
            const def = q.def;
            text = def.label;

            let cur = 0;
            if (def.kind === 'score')      cur = this.score;
            else if (def.kind === 'goodHits') cur = this.goodHits;

            prog = cur + ' / ' + q.target;
            if (q.done) prog += ' ✓';
          }
        }

        this.elMiniMain.textContent = text;
        this.elMiniProg.textContent = prog;
      }
    },

    // ---------- Game control ----------
    startGame: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();

      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.junkHits   = 0;
      this.missCount  = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      // Fever + shield reset
      this.fever       = 0;
      this.feverActive = false;
      this.shield      = 0;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      // quests
      this.setupQuests();
      this.updateQuestHUD();

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
        questsCleared: this.goalsCleared + this.miniCleared,
        questsTotal: (this.goalQueue.length || 0) + (this.miniQueue.length || 0),
        goal: this.goalQueue.length
          ? `สำเร็จเป้าหมายหลัก ${this.goalsCleared} / ${this.goalQueue.length} ภารกิจ`
          : '-',
        miniQuest: this.miniQueue.length
          ? `สำเร็จมินิภารกิจ ${this.miniCleared} / ${this.miniQueue.length} ภารกิจ`
          : '-'
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

      // อัปเดตอายุเป้า / ลบเป้าที่หมดเวลา
      this.updateTargets(dt);

      // spawn เป้าใหม่
      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }
    },

    updateTargets: function (dt) {
      if (!this.targets.length) return;
      const life = this.diffCfg.lifeTime || 2400;

      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        t.age += dt;

        if (t.age >= life) {
          // เป้าหมดเวลา → ลบออก และนับ miss เล็กน้อย
          if (t.el && t.el.parentNode) {
            t.el.parentNode.removeChild(t.el);
          }
          this.targets.splice(i, 1);

          // ถ้าเป็นอาหารดี พลาดจะถือว่า miss เล็กน้อย / ลด fever เล็กน้อย
          if (t.itemType === 'food' && t.isGood) {
            this.missCount += 1;
            this.updateFever(-FEVER_MISS_LOSS * 0.5);
          }
        }
      }
    },

    // ---------- Spawn / Hit ----------
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      // สุ่มชนิดไอเท็ม
      const r = Math.random();
      let kind = 'good';
      if (r < 0.55) {
        kind = 'good';
      } else if (r < 0.80) {
        kind = 'junk';
      } else if (r < 0.88) {
        kind = 'star';
      } else if (r < 0.94) {
        kind = 'diamond';
      } else {
        kind = 'shield';
      }

      const info = chooseEmoji(kind);
      const pos  = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (info.isGood ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', info.emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      // scale ตามระดับความยาก
      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        isGood: info.isGood,
        itemType: info.itemType || (kind === 'shield' ? 'shield' : (kind === 'star' ? 'star' : (kind === 'diamond' ? 'diamond' : 'food'))),
        group: info.group || null,
        age: 0
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

      const type = target.itemType || 'food';

      if (type === 'food') {
        if (target.isGood) {
          this.score    += 10;
          this.goodHits += 1;
          this.updateFever(FEVER_HIT_GAIN);
        } else {
          // ถ้ามี shield ให้กันความเสียหาย
          if (this.shield > 0) {
            this.shield -= 1;
            FeverUI.setShield(this.shield);
          } else {
            this.score = Math.max(0, this.score - 8);
            this.junkHits += 1;
            this.missCount += 1;
            this.updateFever(-FEVER_MISS_LOSS);
          }
        }
      } else if (type === 'star') {
        this.score += 20;
        this.updateFever(25);
      } else if (type === 'diamond') {
        this.score += 30;
        this.updateFever(35);
      } else if (type === 'shield') {
        this.shield = Math.min(3, (this.shield || 0) + 1);
        FeverUI.setShield(this.shield);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);

      // อัปเดต quest
      this.evaluateQuestList(this.goalQueue, 'goal');
      this.evaluateQuestList(this.miniQueue, 'mini');
      this.updateQuestHUD();

      // เอฟเฟกต์หายไป
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      this.targets = this.targets.filter((t) => t !== target);
    },

    // ---------- Cleanup ----------
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
