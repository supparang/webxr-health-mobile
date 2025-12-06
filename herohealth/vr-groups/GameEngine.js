// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest + FeverUI + Coach + FX)
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

  // ---------- Coach / FX style ----------
  function ensureFxStyle() {
    if (document.getElementById('fg-fx-style')) return;
    const st = document.createElement('style');
    st.id = 'fg-fx-style';
    st.textContent = `
      .fg-fx {
        position:fixed;
        z-index:90;
        pointer-events:none;
        transform:translate(-50%, -50%);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
        font-size:18px;
        font-weight:700;
        text-shadow:0 0 12px rgba(15,23,42,.9);
        opacity:0;
        animation:fg-fx-pop .55s ease-out forwards;
      }
      .fg-fx--good { color:#bbf7d0; }
      .fg-fx--bad  { color:#fecaca; }
      .fg-fx--power{ color:#facc15; }
      @keyframes fg-fx-pop{
        0%   { transform:translate(-50%, -50%) scale(.8); opacity:0; }
        20%  { transform:translate(-50%, -60%) scale(1.05); opacity:1; }
        100% { transform:translate(-50%, -90%) scale(.9); opacity:0; }
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- Quest pools ----------
  // 10 แบบ → สุ่มมาใช้ 2/10
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
      label: 'คะแนน 160+ และอาหารดี ≥ 14 ชิ้น',
      kind: 'mixed1',
      easy:  { score: 120, good: 10 },
      normal:{ score: 160, good: 14 },
      hard:  { score: 210, good: 18 }
    },
    {
      id: 'G_MIX_2',
      label: 'เก็บคะแนนและอาหารดีถึงเป้าตามระดับ',
      kind: 'mixed2',
      easy:  { score: 130, good: 10 },
      normal:{ score: 170, good: 14 },
      hard:  { score: 220, good: 18 }
    },
    {
      id: 'G_SCORE_100',
      label: 'อุ่นเครื่องอย่างน้อย 100 แต้ม',
      kind: 'score',
      easy: 80, normal: 100, hard: 130
    },
    {
      id: 'G_GOOD_10',
      label: 'เริ่มจากอาหารดี 10 ชิ้น',
      kind: 'goodHits',
      easy: 7, normal: 10, hard: 14
    }
  ];

  // 15 แบบ → สุ่มมาใช้ 3/15
  const MINI_POOL = [
    { id: 'M_SCORE_60',  label: 'ทำคะแนนย่อยให้ถึง 60 แต้ม',   kind: 'score',     easy: 40, normal: 60,  hard: 80  },
    { id: 'M_SCORE_90',  label: 'ทำคะแนนย่อยให้ถึง 90 แต้ม',   kind: 'score',     easy: 60, normal: 90,  hard: 120 },
    { id: 'M_SCORE_120', label: 'ทำคะแนนย่อยให้ถึง 120 แต้ม',  kind: 'score',     easy: 80, normal: 120, hard: 150 },
    { id: 'M_GOOD_6',    label: 'เก็บอาหารดีอย่างน้อย 6 ชิ้น', kind: 'goodHits', easy: 4,  normal: 6,   hard: 8   },
    { id: 'M_GOOD_8',    label: 'เก็บอาหารดีอย่างน้อย 8 ชิ้น', kind: 'goodHits', easy: 5,  normal: 8,   hard: 10  },
    { id: 'M_GOOD_10',   label: 'เก็บอาหารดีอย่างน้อย 10 ชิ้น',kind: 'goodHits', easy: 6,  normal: 10,  hard: 12  },
    { id: 'M_GOOD_4',    label: 'เริ่มจากอาหารดี 4 ชิ้นให้ได้ก่อน',kind: 'goodHits', easy: 3, normal: 4, hard: 5 },
    { id: 'M_SCORE_40',  label: 'เก็บคะแนนแรกให้ถึง 40 แต้ม', kind: 'score', easy: 30, normal: 40, hard: 60 },
    { id: 'M_SCORE_80',  label: 'เก็บคะแนนเพิ่มให้ถึง 80 แต้ม',kind: 'score', easy: 50, normal: 80, hard: 100 },
    { id: 'M_GOOD_12',   label: 'ลองเก็บอาหารดี 12 ชิ้นดู',   kind: 'goodHits', easy: 8,  normal: 12,  hard: 14 },
    { id: 'M_SCORE_30',  label: 'วอร์มอัพ 30 แต้มแรก',         kind: 'score', easy: 20, normal: 30, hard: 45 },
    { id: 'M_GOOD_5',    label: 'อย่าให้พลาด เก็บอาหารดี 5 ชิ้น',kind: 'goodHits', easy: 3, normal: 5, hard: 7 },
    { id: 'M_SCORE_50',  label: 'ทำคะแนนเก็บเพิ่มให้ถึง 50 แต้ม',kind: 'score', easy: 35, normal: 50, hard: 70 },
    { id: 'M_GOOD_7',    label: 'เก็บอาหารดี 7 ชิ้นให้ได้',    kind: 'goodHits', easy: 4, normal: 7, hard: 9 },
    { id: 'M_GOOD_9',    label: 'ท้าทาย! อาหารดี 9 ชิ้น',      kind: 'goodHits', easy: 6, normal: 9, hard: 11 }
  ];

  // ---------- Utils ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    if (diffKey === 'easy') {
      return { spawnInterval: 1400, maxActive: 3, sizeFactor: 1.15, lifeTime: 2600 };
    }
    if (diffKey === 'hard') {
      return { spawnInterval: 900, maxActive: 5, sizeFactor: 0.9, lifeTime: 2200 };
    }
    return { spawnInterval: 1200, maxActive: 4, sizeFactor: 1.0, lifeTime: 2400 };
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

    if (kind === 'junk') {
      const ch = JUNK_EMOJI_FALLBACK[Math.floor(Math.random() * JUNK_EMOJI_FALLBACK.length)];
      return { emoji: ch, isGood: false, itemType: 'food', group: 'junk' };
    }
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

    const topSafe    = 120;
    const bottomSafe = 150;

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

      ensureFxStyle();

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

      // coach
      this.elCoachBubble = document.getElementById('coach-bubble');
      this.elCoachText   = document.getElementById('coach-text');
      this.lastCoachAt   = 0;

      // state
      this.running     = false;
      this.elapsed     = 0;
      this.timeLimit   = 60000;
      this.spawnTimer  = 0;
      this.targets     = [];
      this.score       = 0;
      this.goodHits    = 0;
      this.junkHits    = 0;
      this.missCount   = 0;

      this.goodStreak  = 0;
      this.badStreak   = 0;

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
      this.goalLimit     = 2;  // 2/10
      this.miniLimit     = 3;  // 3/15

      // event จาก HTML
      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---------- Coach helper ----------
    coachSay: function (text, minGapMs) {
      minGapMs = minGapMs || 1200;
      const now = performance.now ? performance.now() : Date.now();
      if (now - this.lastCoachAt < minGapMs) return;
      this.lastCoachAt = now;

      if (!this.elCoachText || !this.elCoachBubble) return;
      this.elCoachText.textContent = text;
      this.elCoachBubble.classList.add('show');
    },

    updateFever: function (delta) {
      this.fever = (this.fever || 0) + delta;
      if (this.fever < 0) this.fever = 0;
      if (this.fever > FEVER_MAX) this.fever = FEVER_MAX;

      if (FeverUI && typeof FeverUI.setFever === 'function') {
        FeverUI.setFever(this.fever);
      }

      const active = this.fever >= FEVER_MAX;
      if (active && !this.feverActive) {
        this.coachSay('FEVER! ตีให้สุดเลย! 🔥', 500);
      }
      this.feverActive = active;

      if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
        FeverUI.setFeverActive(active);
      }
    },

    // ---------- Quest helper ----------
    setupQuests: function () {
      const diff = this.diffKey || 'normal';

      const gList = shuffle(GOAL_POOL).slice(0, this.goalLimit);
      this.goalQueue = gList.map((q) => {
        let target;
        if (q.kind === 'mixed1' || q.kind === 'mixed2') {
          const obj = q[diff] || q.normal;
          target = obj || { score: 0, good: 0 };
        } else {
          target = getQuestTarget(q, diff);
        }
        return { def: q, target, done: false };
      });

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
      const prevCleared = this[clearedKey] || 0;

      while (idx < list.length) {
        const q   = list[idx];
        const def = q.def;
        if (q.done) {
          idx++;
          continue;
        }

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
          continue;
        }
        break;
      }

      if (this[clearedKey] > prevCleared) {
        // coach report: Goal 1/2, Mini 2/3
        const gTotal = this.goalQueue.length || 0;
        const mTotal = this.miniQueue.length || 0;
        const msg = `Goal ${this.goalsCleared}/${gTotal}, Mini ${this.miniCleared}/${mTotal} ผ่านแล้ว เยี่ยมมาก! ✅`;
        this.coachSay(msg, 800);
      }

      this[idxKey] = Math.min(idx, list.length);
    },

    updateQuestHUD: function () {
      if (this.elGoalMain && this.elGoalProg) {
        let text = '-';
        let prog = '-';

        if (this.goalQueue.length) {
          if (this.goalIndex >= this.goalQueue.length) {
            text = 'ทำครบทุกเป้าหมายหลักแล้ว';
            prog = this.goalsCleared + ' / ' + this.goalQueue.length;
          } else {
            const q   = this.goalQueue[this.goalIndex];
            const def = q.def;
            text = def.label;

            if (def.kind === 'mixed1' || def.kind === 'mixed2') {
              const t = q.target || {};
              prog = `คะแนน ${this.score}/${t.score || 0}, ดี ${this.goodHits}/${t.good || 0}`;
              if (q.done) prog += ' ✓';
            } else {
              const cur = (def.kind === 'score') ? this.score : this.goodHits;
              prog = cur + ' / ' + q.target + (q.done ? ' ✓' : '');
            }
          }
        }

        this.elGoalMain.textContent = text;
        this.elGoalProg.textContent = prog;
      }

      if (this.elMiniMain && this.elMiniProg) {
        let text = '-';
        let prog = '-';

        if (this.miniQueue.length) {
          if (this.miniIndex >= this.miniQueue.length) {
            text = 'ทำครบมินิภารกิจแล้ว';
            prog = this.miniCleared + ' / ' + this.miniQueue.length;
          } else {
            const q   = this.miniQueue[this.miniIndex];
            const def = q.def;
            text = def.label;

            const cur = (def.kind === 'score') ? this.score : this.goodHits;
            prog = cur + ' / ' + q.target + (q.done ? ' ✓' : '');
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
      this.goodStreak = 0;
      this.badStreak  = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      this.fever       = 0;
      this.feverActive = false;
      this.shield      = 0;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      this.setupQuests();
      this.updateQuestHUD();

      this.coachSay('เกมเริ่มแล้ว! เลือกอาหารดี ๆ ให้ทันเวลานะ 🥦', 0);

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
      this.coachSay('ยอดมาก! มาดูสรุปผลกันเลย 🎉', 0);

      console.log('[GroupsVR] game over', detail);
    },

    // ---------- Tick ----------
    tick: function (t, dt) {
      if (!this.running) return;

      dt = dt || 16;

      this.elapsed    += dt;
      this.spawnTimer += dt;

      const remain = Math.max(0, this.timeLimit - this.elapsed);
      if (this.elTime) {
        this.elTime.textContent = Math.ceil(remain / 1000) + 's';
      }
      if (remain <= 0) {
        this.endGame();
        return;
      }

      this.updateTargets(dt);

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
          if (t.el && t.el.parentNode) {
            t.el.parentNode.removeChild(t.el);
          }
          this.targets.splice(i, 1);

          if (t.itemType === 'food' && t.isGood) {
            this.missCount += 1;
            this.badStreak += 1;
            this.goodStreak = 0;
            this.updateFever(-FEVER_MISS_LOSS * 0.5);

            if (this.badStreak >= 3) {
              this.coachSay('ลองโฟกัสที่อาหารดีให้มากขึ้นนะ 🍎', 1200);
            }
          }
        }
      }
    },

    // ---------- FX ----------
    spawnFxText: function (x, y, text, kind) {
      const el = document.createElement('div');
      el.className = 'fg-fx ' + (kind || '');
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      document.body.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 600);
    },

    // ---------- Spawn / Hit ----------
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

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

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        isGood: info.isGood,
        itemType: info.itemType || (
          kind === 'shield'  ? 'shield'  :
          kind === 'star'    ? 'star'    :
          kind === 'diamond' ? 'diamond' : 'food'
        ),
        group: info.group || null,
        age: 0,
        x: pos.x,
        y: pos.y
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
      const x = target.x;
      const y = target.y;

      let fxText = '';
      let fxKind = 'fg-fx--good';

      if (type === 'food') {
        if (target.isGood) {
          this.score    += 10;
          this.goodHits += 1;
          this.goodStreak += 1;
          this.badStreak = 0;
          this.updateFever(FEVER_HIT_GAIN);

          fxText = 'GOOD +10';
          fxKind = 'fg-fx--good';

          if (this.goodStreak === 3) {
            this.coachSay('สุดยอด! เลือกอาหารดีติดกันเลย 👏', 1000);
          }
        } else {
          if (this.shield > 0) {
            this.shield -= 1;
            FeverUI.setShield(this.shield);
            fxText = 'GUARD';
            fxKind = 'fg-fx--power';
            this.coachSay('เกราะกันไว้ทันพอดีเลย 🛡️', 1200);
          } else {
            this.score = Math.max(0, this.score - 8);
            this.junkHits += 1;
            this.missCount += 1;
            this.badStreak += 1;
            this.goodStreak = 0;
            this.updateFever(-FEVER_MISS_LOSS);

            fxText = 'MISS -8';
            fxKind = 'fg-fx--bad';

            if (this.badStreak >= 2) {
              this.coachSay('ระวังขยะหน่อยนะ ลองเล็งให้ดีขึ้น 🧠', 1200);
            }
          }
        }
      } else if (type === 'star') {
        this.score += 20;
        this.updateFever(25);
        fxText = 'PERFECT ⭐ +20';
        fxKind = 'fg-fx--power';
        this.coachSay('ดาวพิเศษ! คะแนนพุ่งเลย ⭐', 1200);
      } else if (type === 'diamond') {
        this.score += 30;
        this.updateFever(35);
        fxText = 'PERFECT 💎 +30';
        fxKind = 'fg-fx--power';
        this.coachSay('เพชรพลังงาน! เก็บได้เยี่ยม 💎', 1200);
      } else if (type === 'shield') {
        this.shield = Math.min(3, (this.shield || 0) + 1);
        FeverUI.setShield(this.shield);
        fxText = 'Shield +1';
        fxKind = 'fg-fx--power';
      }

      if (this.elScore) this.elScore.textContent = String(this.score);

      this.evaluateQuestList(this.goalQueue, 'goal');
      this.evaluateQuestList(this.miniQueue, 'mini');
      this.updateQuestHUD();

      if (fxText) {
        this.spawnFxText(x, y, fxText, fxKind);
      }

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
