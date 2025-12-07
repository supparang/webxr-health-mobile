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
  const Particles = window.HHA_PARTICLES || null;

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 12;
  const FEVER_MISS_LOSS = 18;

  // ---------- Food-group labels ----------
  const FOOD_GROUP_LABEL = {
    1: 'หมู่ 1 ข้าว-แป้งและธัญพืช',
    2: 'หมู่ 2 ผัก',
    3: 'หมู่ 3 ผลไม้',
    4: 'หมู่ 4 เนื้อสัตว์และโปรตีน',
    5: 'หมู่ 5 นมและผลิตภัณฑ์นม'
  };

  const FOOD_GROUP_SHORT = {
    1: 'หมู่ 1',
    2: 'หมู่ 2',
    3: 'หมู่ 3',
    4: 'หมู่ 4',
    5: 'หมู่ 5'
  };

  function comboToText(combo) {
    // [1,2,3] -> "หมู่ 1 ... + หมู่ 2 ... + หมู่ 3 ..."
    return combo
      .map((id) => FOOD_GROUP_LABEL[id] || ('หมู่ ' + id))
      .join(' + ');
  }

  function comboToShort(combo) {
    // [1,2,3] -> "หมู่ 1+2+3"
    return combo
      .map((id) => FOOD_GROUP_SHORT[id] || ('หมู่ ' + id))
      .join('+');
  }

  // ---------- Legend card: อธิบายหมู่อาหาร 5 หมู่ ----------
  function ensureLegendCard() {
    if (document.getElementById('fg-legend-card')) return;

    if (!document.getElementById('fg-legend-style')) {
      const st = document.createElement('style');
      st.id = 'fg-legend-style';
      st.textContent = `
        .fg-legend-card{
          position:fixed;
          right:10px;
          top:110px;
          z-index:65;
          max-width:260px;
          padding:8px 10px;
          border-radius:14px;
          background:radial-gradient(circle at top,#020617,#020617);
          border:1px solid rgba(148,163,184,0.6);
          box-shadow:0 14px 32px rgba(15,23,42,0.9);
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
          color:#e5e7eb;
          font-size:11px;
        }
        .fg-legend-title{
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:#9ca3af;
          margin-bottom:4px;
        }
        .fg-legend-list{
          list-style:none;
          padding:0;
          margin:0;
        }
        .fg-legend-list li{
          margin:1px 0;
          line-height:1.3;
          color:#cbd5f5;
        }
        .fg-legend-list li strong{
          color:#a5b4fc;
        }
        @media (max-width:640px){
          .fg-legend-card{
            right:8px;
            top:96px;
            max-width:210px;
            font-size:10px;
          }
        }
      `;
      document.head.appendChild(st);
    }

    const card = document.createElement('div');
    card.id = 'fg-legend-card';
    card.className = 'fg-legend-card';
    card.innerHTML = `
      <div class="fg-legend-title">หมู่อาหาร 5 หมู่</div>
      <ul class="fg-legend-list">
        <li><strong>หมู่ 1</strong> ข้าว-แป้งและธัญพืช</li>
        <li><strong>หมู่ 2</strong> ผัก</li>
        <li><strong>หมู่ 3</strong> ผลไม้</li>
        <li><strong>หมู่ 4</strong> เนื้อสัตว์ / โปรตีน</li>
        <li><strong>หมู่ 5</strong> นมและผลิตภัณฑ์นม</li>
      </ul>
    `;
    document.body.appendChild(card);
  }

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

    const topSafe = 140;
    const bottomSafe = 160;

    const left = w * 0.12;
    const right = w * 0.88;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ---------- Difficulty ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (
      ns.foodGroupsDifficulty &&
      typeof ns.foodGroupsDifficulty.get === 'function'
    ) {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

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
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Food-group combos & quest text ----------
  function getCombosForDiff(diffKey) {
    const key = String(diffKey || 'normal').toLowerCase();

    if (key === 'easy') {
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
      return [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [1, 2, 3, 4, 5]
      ];
    }

    return [
      [1, 2, 3],
      [2, 3, 4],
      [1, 4, 5],
      [2, 4, 5]
    ];
  }

  // Goal: 2 ภารกิจสั้น + detail
  function buildGoals(cfg, diffKey) {
    const baseGood = cfg.baseGood || 12;
    const combos = getCombosForDiff(diffKey);
    const shuffled = shuffle(combos).slice(0, 2);

    return shuffled.map((combo, idx) => {
      const label = comboToText(combo);
      const shortLabel = comboToShort(combo);
      const target = baseGood + idx * 3;

      return {
        kind: 'goal',
        type: 'good',
        target,
        combo,
        // ข้อความสั้นบน HUD
        text: 'จัดเมนู ' + shortLabel + ' ให้ได้อาหารดี ≥ ' + target + ' ชิ้น',
        // detail สำหรับโค้ช / หน้าสรุป
        detail:
          'Goal: จัดเมนูให้ครบ ' +
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

  // Mini quest: 3 ภารกิจจาก pool (ใช้คะแนน/จำนวน good)
  function buildMiniQuests(cfg, diffKey) {
    const baseScore = cfg.baseScore || 160;
    const combos = getCombosForDiff(diffKey);
    const combo = combos[Math.floor(Math.random() * combos.length)];
    const label = comboToText(combo);
    const shortLabel = comboToShort(combo);

    const pool = [
      {
        kind: 'mini',
        type: 'score',
        target: Math.round(baseScore * 0.6),
        text:
          'ทำคะแนนรวมจากอาหารดี ≥ ' +
          Math.round(baseScore * 0.6) +
          ' คะแนน',
        detail:
          'Mini: เริ่มจัดจานให้ครบหมู่ ' +
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
          'รักษาคะแนนรวมจากอาหารดี ≥ ' +
          Math.round(baseScore * 0.8) +
          ' คะแนน',
        detail:
          'Mini: พยายามรักษาสมดุล ' +
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
          'เก็บอาหารดีจาก ' +
          shortLabel +
          ' ≥ ' +
          (cfg.baseGood || 12) +
          ' ชิ้น',
        detail:
          'Mini: ลองเลือกอาหารดีจากหมู่ ' +
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
          'เก็บอาหารดีจาก ' +
          shortLabel +
          ' ≥ ' +
          ((cfg.baseGood || 12) + 4) +
          ' ชิ้น',
        detail:
          'Mini: เก็บอาหารดีจากหมู่ ' +
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
          'ทำคะแนนรวมจากทุกหมู่ ≥ ' + (baseScore + 20) + ' คะแนน',
        detail:
          'Mini: ลองจัดจานอาหารให้ครบหมู่แล้วทำคะแนนรวมให้ถึง ' +
          (baseScore + 20) +
          ' คะแนน',
        done: false
      }
    ];

    return shuffle(pool).slice(0, 3);
  }

  // ---------- Main component ----------
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

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
      this.elMiss       = document.getElementById('hud-miss');

      this.running     = false;
      this.elapsed     = 0;
      this.timeLimit   = 60000;
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

      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      ensureLegendCard();

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

      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      ensureLegendCard();
      this.updateQuestHUD();

      this.coachSay('อ่านกล่อง “หมู่อาหาร 5 หมู่” มุมขวาบน แล้วทำตามภารกิจบนการ์ดนะ!');

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

      if (scene) scene.emit('fg-game-over', detail);

      if (this.elEndScore) this.elEndScore.textContent = String(this.score);
      if (this.elEndQuest) this.elEndQuest.textContent = cleared + ' / ' + totalQuests;
      if (this.elEndGoalTxt) this.elEndGoalTxt.textContent =
        this.describeQuestArray(this.goals) || '-';
      if (this.elEndMiniTxt) this.elEndMiniTxt.textContent =
        this.describeQuestArray(this.miniQuests) || '-';
      if (this.elEndToast) this.elEndToast.classList.add('show');

      console.log('[GroupsVR] game over', detail);
    },

    describeQuestArray: function (arr) {
      if (!arr || !arr.length) return '';
      return arr
        .map((q, idx) => {
          const tag = q.kind === 'mini' ? 'Mini ' : 'Goal ';
          const status = q.done ? '✓' : '…';
          const desc = q.detail || q.text || '';
          return tag + (idx + 1) + ' ' + status + ' — ' + desc;
        })
        .join(' | ');
    },

    // ----- Tick -----
    tick: function (time, dt) {
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

      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }

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
        delta = -8;
        label = 'MISS';
        this.score = Math.max(0, this.score + delta);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      if (this.elMiss)  this.elMiss.textContent  = String(this.missCount);

      if (Particles && Particles.scorePop) {
        const txt =
          (label === 'MISS' ? 'MISS ' : label + ' ') +
          (delta > 0 ? '+' + delta : delta);
        Particles.scorePop(x, y, txt, { good: delta > 0 });
      }
      if (Particles && Particles.burstAt) {
        Particles.burstAt(x, y, {
          color: delta > 0 ? '#22c55e' : '#f97373',
          count: delta > 0 ? 14 : 10,
          radius: 60
        });
      }

      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      this.updateQuestProgress();
    },

    handleExpire: function (target) {
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
      const g = this.goals[this.goalIndex];
      if (g && !g.done) {
        const val = g.type === 'score' ? this.score : this.goodHits;
        if (val >= g.target) {
          g.done = true;
          this.goalIndex++;
          const nextG = this.goals[this.goalIndex];
          if (nextG) {
            this.coachSay(nextG.detail || nextG.text);
          } else {
            this.coachSay('ภารกิจ Goal หลักครบแล้ว เก็บ Mini quest ต่อได้เลย ✨');
          }
        }
      }

      const m = this.miniQuests[this.miniIndex];
      if (m && !m.done) {
        const val2 = m.type === 'score' ? this.score : this.goodHits;
        if (val2 >= m.target) {
          m.done = true;
          this.miniIndex++;
          const nextM = this.miniQuests[this.miniIndex];
          if (nextM) {
            this.coachSay(nextM.detail || nextM.text);
          } else {
            this.coachSay('Mini quest ครบแล้ว ลองทำคะแนนรวมให้สูงขึ้นต่อได้เลย!');
          }
        }
      }

      this.updateQuestHUD();
    },

    updateQuestHUD: function () {
      const g = this.goals[this.goalIndex] || null;
      const m = this.miniQuests[this.miniIndex] || null;

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

      if (this.elMiniMain) {
        this.elMiniMain.textContent =
          m ? m.text : 'Mini quest ครบแล้ว ลองทำคะแนนรวมเพิ่มได้เลย!';
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
