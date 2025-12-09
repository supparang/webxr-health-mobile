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

      const choice = randomFoodBalanced(); // {group, emoji, asset}
      const el = document.createElement('a-image');

      if (choice.asset) {
        el.setAttribute('src', choice.asset);
      }

      const size = 0.9 * this.config.scale;
      el.setAttribute('width', size);
      el.setAttribute('height', size);
      el.setAttribute('position', '0 1.6 -2.1');
      el.setAttribute('data-hha-tgt', '1'); // ให้ raycaster ของ GoodJunk ยิงโดน
      el.classList.add('hh-target');

      const targetData =
