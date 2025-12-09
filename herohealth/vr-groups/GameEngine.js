// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Emoji Sprite + Fever + Mini Quest + Logger)
// ใช้เป็น A-Frame Component: groups-vr-engine

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

  const FOOD_GROUP_INFO = {
    1: { name: 'หมู่ที่ 1 ธัญพืชและแป้ง',   short: 'ธัญพืช/แป้ง' },
    2: { name: 'หมู่ที่ 2 เนื้อ/ถั่ว/ไข่',   short: 'โปรตีน' },
    3: { name: 'หมู่ที่ 3 ผัก',             short: 'ผัก' },
    4: { name: 'หมู่ที่ 4 ผลไม้',           short: 'ผลไม้' },
    5: { name: 'หมู่ที่ 5 นมและผลิตภัณฑ์', short: 'นม/ผลิตภัณฑ์นม' }
  };

  // sprite mapping (emoji + asset id) — หมู่ละ 7 อย่าง
  const FG_SPRITES = [
    // หมู่ 1
    { group: 1, emoji: '🍚', asset: '#fg-g1-1' },
    { group: 1, emoji: '🍙', asset: '#fg-g1-2' },
    { group: 1, emoji: '🍞', asset: '#fg-g1-3' },
    { group: 1, emoji: '🥖', asset: '#fg-g1-4' },
    { group: 1, emoji: '🥐', asset: '#fg-g1-5' },
    { group: 1, emoji: '🍜', asset: '#fg-g1-6' },
    { group: 1, emoji: '🍝', asset: '#fg-g1-7' },

    // หมู่ 2
    { group: 2, emoji: '🍗', asset: '#fg-g2-1' },
    { group: 2, emoji: '🍖', asset: '#fg-g2-2' },
    { group: 2, emoji: '🍣', asset: '#fg-g2-3' },
    { group: 2, emoji: '🍤', asset: '#fg-g2-4' },
    { group: 2, emoji: '🍳', asset: '#fg-g2-5' },
    { group: 2, emoji: '🥚', asset: '#fg-g2-6' },
    { group: 2, emoji: '🍔', asset: '#fg-g2-7' },

    // หมู่ 3
    { group: 3, emoji: '🥦', asset: '#fg-g3-1' },
    { group: 3, emoji: '🥕', asset: '#fg-g3-2' },
    { group: 3, emoji: '🌽', asset: '#fg-g3-3' },
    { group: 3, emoji: '🍅', asset: '#fg-g3-4' },
    { group: 3, emoji: '🍆', asset: '#fg-g3-5' },
    { group: 3, emoji: '🥒', asset: '#fg-g3-6' },
    { group: 3, emoji: '🥬', asset: '#fg-g3-7' },

    // หมู่ 4
    { group: 4, emoji: '🍎', asset: '#fg-g4-1' },
    { group: 4, emoji: '🍌', asset: '#fg-g4-2' },
    { group: 4, emoji: '🍇', asset: '#fg-g4-3' },
    { group: 4, emoji: '🍉', asset: '#fg-g4-4' },
    { group: 4, emoji: '🍓', asset: '#fg-g4-5' },
    { group: 4, emoji: '🍊', asset: '#fg-g4-6' },
    { group: 4, emoji: '🍍', asset: '#fg-g4-7' },

    // หมู่ 5
    { group: 5, emoji: '🥛', asset: '#fg-g5-1' },
    { group: 5, emoji: '🧀', asset: '#fg-g5-2' },
    { group: 5, emoji: '🍦', asset: '#fg-g5-3' },
    { group: 5, emoji: '🍨', asset: '#fg-g5-4' },
    { group: 5, emoji: '🥞', asset: '#fg-g5-5' },
    { group: 5, emoji: '🧇', asset: '#fg-g5-6' },
    { group: 5, emoji: '🍮', asset: '#fg-g5-7' }
  ];

  const SPRITES_BY_GROUP = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  FG_SPRITES.forEach(s => {
    if (!SPRITES_BY_GROUP[s.group]) SPRITES_BY_GROUP[s.group] = [];
    SPRITES_BY_GROUP[s.group].push(s);
  });

  const QUEST_QUEUE = [
    { key: 'veg5',     label: 'ตีผักให้ได้ 5 ชิ้น',          group: 3 },
    { key: 'fruit5',   label: 'ตีผลไม้ให้ได้ 5 ชิ้น',        group: 4 },
    { key: 'grain5',   label: 'ตีธัญพืชให้ได้ 5 ชิ้น',       group: 1 },
    { key: 'protein5', label: 'ตีอาหารโปรตีนให้ได้ 5 ชิ้น', group: 2 },
    { key: 'milk3',    label: 'ตีอาหารหมู่นมให้ได้ 3 ชิ้น', group: 5 }
  ];

  function clamp (v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function pickDifficulty (diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();
    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }
    return {
      spawnInterval: 1200,
      lifetime: 2300,
      maxActive: 4,
      scale: 1.0,
      feverGainHit: 7,
      feverLossMiss: 15,
      questTarget: 5
    };
  }

  function parseUrlInt (key, defVal, minVal, maxVal) {
    try {
      const url = new URL(window.location.href);
      let t = parseInt(url.searchParams.get(key), 10);
      if (isNaN(t)) t = defVal;
      if (typeof minVal === 'number' && t < minVal) t = minVal;
      if (typeof maxVal === 'number' && t > maxVal) t = maxVal;
      return t;
    } catch (e) {
      return defVal;
    }
  }

  function parseUrlDiff () {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get('diff') || 'normal').toLowerCase();
    } catch (e) {
      return 'normal';
    }
  }

  // สุ่มอาหารแบบบาลานซ์หมู่
  function randomFoodBalanced () {
    const groupId = 1 + Math.floor(Math.random() * 5);
    const arr = SPRITES_BY_GROUP[groupId] || FG_SPRITES;
    const choice = arr[Math.floor(Math.random() * arr.length)] ||
      FG_SPRITES[0];
    return choice;
  }

  A.registerComponent('groups-vr-engine', {
    schema: {},

    init: function () {
      this.diffKey = parseUrlDiff();
      this.config = pickDifficulty(this.diffKey);
      this.sceneEl = this.el.sceneEl || document.querySelector('a-scene');

      this.targets = [];
      this.activeQuestIndex = 0;
      this.questProgress = 0;
      this.completedQuests = 0;

      this.stats = {
        score: 0,
        hits: 0,
        misses: 0,
        byGroup: { 1:0, 2:0, 3:0, 4:0, 5:0 }
      };
      this.fever = 0;
      this.timerMs = parseUrlInt('time', 70, 20, 180) * 1000;

      this.lastSpawnAt = 0;
      this.gameOver = false;

      this.hud = this.bindHud();
      this.overlay = this.bindOverlay();
      this.fx = this.bindFx();

      this.startSessionLog();
      this.updateHud();
      this.setCoachText('วันนี้เราจะมาล่าหมู่สารอาหาร 5 หมู่กันนะ! ดูให้ทันว่าเป็นหมู่ไหน แล้วตีให้ทันก่อนหายไป 💪');

      console.log('[GroupsVR] Component init', this.config);
    },

    // ---------- HUD / Overlay / FX ----------
    bindHud: function () {
      return {
        time:   document.querySelector('[data-groupsvr-time]'),
        score:  document.querySelector('[data-groupsvr-score]'),
        fever:  document.querySelector('[data-groupsvr-fever]'),
        quest:  document.querySelector('[data-groupsvr-quest]'),
        questBar: document.querySelector('[data-groupsvr-quest-bar]'),
        coachText: document.getElementById('groupsvr-coach')
      };
    },

    bindOverlay: function () {
      return {
        root:  document.getElementById('groupsvr-finish'),
        main:  document.getElementById('groupsvr-finish-main'),
        score: document.getElementById('groupsvr-fin-score'),
        hits:  document.getElementById('groupsvr-fin-hits'),
        miss:  document.getElementById('groupsvr-fin-miss'),
        groups:document.getElementById('groupsvr-fin-groups'),
        quests:document.getElementById('groupsvr-fin-quests')
      };
    },

    bindFx: function () {
      return {
        root: document.getElementById('groupsvr-fx')
      };
    },

    setCoachText: function (msg) {
      if (this.hud.coachText) {
        this.hud.coachText.textContent = msg;
      }
    },

    updateHud: function () {
      if (this.hud.time) {
        this.hud.time.textContent = Math.ceil(this.timerMs / 1000) + 's';
      }
      if (this.hud.score) {
        this.hud.score.textContent = this.stats.score;
      }
      if (this.hud.fever) {
        const pct = Math.round((this.fever / FEVER_MAX) * 100);
        this.hud.fever.style.width = pct + '%';
      }
      if (this.hud.quest) {
        const q = QUEST_QUEUE[this.activeQuestIndex];
        if (q) {
          this.hud.quest.textContent =
            `Mini Quest ${this.activeQuestIndex + 1}/${QUEST_QUEUE.length}: ` +
            `${q.label} (${this.questProgress}/${this.config.questTarget})`;
        } else {
          this.hud.quest.textContent = 'Mini Quest: ครบทุกภารกิจแล้ว! 🎉';
        }
      }
      if (this.hud.questBar) {
        const ratio = clamp(this.questProgress / this.config.questTarget, 0, 1);
        this.hud.questBar.style.width = (ratio * 100) + '%';
      }
    },

    // ---------- Tick ----------
    tick: function (time, dt) {
      if (this.gameOver) return;
      if (!dt) dt = 16;

      this.timerMs -= dt;
      if (this.timerMs <= 0) {
        this.timerMs = 0;
        this.updateHud();
        this.endGame();
        return;
      }

      if ((time - this.lastSpawnAt) > this.config.spawnInterval &&
          this.targets.length < this.config.maxActive) {
        this.spawnTarget(time);
        this.lastSpawnAt = time;
      }

      this.pruneTargets(time);
      this.updateHud();
    },

    // ---------- เป้า ----------
spawnTarget: function (now) {
  const scene = this.sceneEl;
  if (!scene) return;

  // สุ่มหมู่และ emoji (หมู่ละ 7 แบบ)
  const groupId = 1 + Math.floor(Math.random() * 5);
  const idx = 1 + Math.floor(Math.random() * 7);
  const assetId = `#fg-g${groupId}-${idx}`;

  const el = document.createElement('a-image');
  el.setAttribute('src', assetId);
  el.setAttribute('width', 1.2 * this.config.scale);
  el.setAttribute('height', 1.2 * this.config.scale);
  el.setAttribute('position', `0 1.6 -2.0`);
  el.setAttribute('data-hha-tgt', '1'); // สำคัญ: ให้ raycaster ยิงโดน
  el.classList.add('hh-target');

  const targetData = {
    el,
    createdAt: now,
    expireAt: now + this.config.lifetime,
    group: groupId,
    asset: assetId
  };

  el.addEventListener('click', () => {
    this.handleHit(targetData);
  });

  scene.appendChild(el);
  this.targets.push(targetData);
},


    handleHit: function (target) {
      if (this.gameOver) return;

      const idx = this.targets.indexOf(target);
      if (idx === -1) return;

      if (target.el && target.el.parentNode) {
        target.el.parentNode.removeChild(target.el);
      }
      this.targets.splice(idx, 1);

      this.stats.hits += 1;
      this.stats.score += 10;
      if (!this.stats.byGroup[target.foodGroup]) {
        this.stats.byGroup[target.foodGroup] = 0;
      }
      this.stats.byGroup[target.foodGroup] += 1;

      this.fever = clamp(this.fever + this.config.feverGainHit, 0, FEVER_MAX);

      this.updateQuestProgress(target.foodGroup);

      this.spawnScoreFx('+10', 'good');

      const gInfo = FOOD_GROUP_INFO[target.foodGroup] || {};
      this.logEvent('hit', {
        emoji: target.emoji,
        groupId: target.foodGroup,
        groupName: gInfo.name || null
      });
    },

    handleMiss: function (target) {
      if (this.gameOver) return;

      this.stats.misses += 1;
      this.fever = clamp(this.fever - this.config.feverLossMiss, 0, FEVER_MAX);

      this.spawnScoreFx('MISS', 'miss');

      const gInfo = FOOD_GROUP_INFO[target.foodGroup] || {};
      this.logEvent('miss', {
        emoji: target.emoji,
        groupId: target.foodGroup,
        groupName: gInfo.name || null
      });
    },

    pruneTargets: function (now) {
      const remain = [];
      for (const t of this.targets) {
        if (now > t.expireAt) {
          if (t.el && t.el.parentNode) {
            t.el.parentNode.removeChild(t.el);
          }
          this.handleMiss(t);
        } else {
          remain.push(t);
        }
      }
      this.targets = remain;
    },

    // ---------- Mini Quest ----------
    updateQuestProgress: function (foodGroup) {
      const q = QUEST_QUEUE[this.activeQuestIndex];
      if (!q) return;

      if (q.group === foodGroup) {
        this.questProgress += 1;

        const gInfo = FOOD_GROUP_INFO[q.group];
        if (gInfo) {
          this.setCoachText(`เยี่ยม! ตอนนี้กำลังเก็บ ${gInfo.name} อยู่ (${this.questProgress}/${this.config.questTarget})`);
        }

        if (this.questProgress >= this.config.questTarget) {
          this.completedQuests += 1;
          this.showQuestComplete(q);
          this.activeQuestIndex += 1;
          this.questProgress = 0;

          if (this.activeQuestIndex >= QUEST_QUEUE.length) {
            this.activeQuestIndex = QUEST_QUEUE.length - 1;
            this.setCoachText('สุดยอด! ทำ Mini Quest ครบทุกหมู่แล้ว 🎉 ตอนนี้ตีต่อเพื่อเก็บคะแนนรวมได้เลย!');
          } else {
            const nextQ = QUEST_QUEUE[this.activeQuestIndex];
            const ngInfo = FOOD_GROUP_INFO[nextQ.group];
            if (ngInfo) {
              this.setCoachText(`เยี่ยม! ต่อไปคือ ${ngInfo.name} — ${nextQ.label}`);
            } else {
              this.setCoachText(`เยี่ยม! ต่อไป: ${nextQ.label}`);
            }
          }
        }
      }
    },

    showQuestComplete: function (q) {
      this.spawnScoreFx('QUEST ✓', 'quest');
      this.logEvent('quest-complete', { questKey: q.key });
      this.stats.score += 30;
    },

    // ---------- FX ----------
    spawnScoreFx: function (text, kind) {
      if (!this.fx.root) return;
      const el = document.createElement('div');
      el.className = 'fx-score ' + (kind || 'good');
      el.textContent = text;
      this.fx.root.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 600);
    },

    // ---------- Game finish ----------
    endGame: function () {
      if (this.gameOver) return;
      this.gameOver = true;

      this.updateHud();
      this.endSessionLog();
      this.showFinishOverlay();

      console.log('[GroupsVR] Game over', this.stats);
    },

    showFinishOverlay: function () {
      const ov = this.overlay;
      if (!ov.root) return;

      if (ov.score) ov.score.textContent = this.stats.score;
      if (ov.hits)  ov.hits.textContent  = this.stats.hits;
      if (ov.miss)  ov.miss.textContent  = this.stats.misses;

      if (ov.groups) {
        const parts = [];
        for (let g = 1; g <= 5; g++) {
          const n = this.stats.byGroup[g] || 0;
          const info = FOOD_GROUP_INFO[g];
          const label = info ? info.short : `หมู่ ${g}`;
          parts.push(`${label}: ${n}`);
        }
        ov.groups.textContent = parts.join(' | ');
      }

      if (ov.quests) {
        ov.quests.textContent = this.completedQuests + ' เควส';
      }

      if (ov.main) {
        ov.main.textContent = 'เล่นจบแล้ว! ตีอาหารได้ ' +
          this.stats.hits + ' ชิ้น (' + this.stats.score + ' คะแนน)';
      }

      ov.root.classList.add('active');
    },

    // ---------- Logger ----------
    startSessionLog: function () {
      if (!ns.hhaSessionLogger) return;
      this.sessionId = ns.hhaSessionLogger.start({
        mode: 'groups',
        diff: this.diffKey,
        durationSec: this.timerMs / 1000
      });
    },

    logEvent: function (type, payload) {
      if (!ns.hhaEventLogger) return;
      ns.hhaEventLogger.push({
        t: Date.now(),
        mode: 'groups',
        type: type,
        sessionId: this.sessionId || null,
        payload: payload || {}
      });
    },

    endSessionLog: function () {
      if (!ns.hhaSessionLogger) return;
      ns.hhaSessionLogger.end(this.sessionId, {
        stats: this.stats,
        feverMax: FEVER_MAX,
        completedQuests: this.completedQuests
      });
    }
  });

})(window.HeroHealth = window.HeroHealth || {});
