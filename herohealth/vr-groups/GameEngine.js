// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Emoji Target + Fever + Mini Quest + Logger)
// เวอร์ชันอัปเดต: หมู่ละ 7 emoji + สุ่มบาลานซ์ทุกหมู่ + coach อิงหมู่สารอาหาร

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

  // ข้อมูลหมู่สารอาหาร
  const FOOD_GROUP_INFO = {
    1: { name: 'หมู่ที่ 1 ธัญพืชและแป้ง', short: 'ธัญพืช/แป้ง' },
    2: { name: 'หมู่ที่ 2 เนื้อ/ถั่ว/ไข่', short: 'โปรตีน' },
    3: { name: 'หมู่ที่ 3 ผัก',          short: 'ผัก' },
    4: { name: 'หมู่ที่ 4 ผลไม้',        short: 'ผลไม้' },
    5: { name: 'หมู่ที่ 5 นมและผลิตภัณฑ์', short: 'นม/ผลิตภัณฑ์นม' }
  };

  // emoji + mapping หมู่อาหาร (หมู่ละ 7 อย่าง)
  const FOOD_EMOJIS = [
    // ===== หมู่ที่ 1 ธัญพืช / แป้ง =====
    { emoji: '🍚', group: 1 }, // ข้าวสวย
    { emoji: '🍙', group: 1 }, // ข้าวปั้น
    { emoji: '🍞', group: 1 }, // ขนมปัง
    { emoji: '🥖', group: 1 }, // ขนมปังฝรั่งเศส
    { emoji: '🥐', group: 1 }, // ครัวซองต์
    { emoji: '🍜', group: 1 }, // ก๋วยเตี๋ยว
    { emoji: '🍝', group: 1 }, // พาสต้า

    // ===== หมู่ที่ 2 โปรตีน (เนื้อ/ถั่ว/ไข่) =====
    { emoji: '🍗', group: 2 }, // น่องไก่
    { emoji: '🥩', group: 2 }, // สเต็ก
    { emoji: '🍖', group: 2 }, // ซี่โครง
    { emoji: '🥚', group: 2 }, // ไข่
    { emoji: '🫘', group: 2 }, // ถั่วเมล็ดแห้ง
    { emoji: '🥜', group: 2 }, // ถั่วลิสง
    { emoji: '🍤', group: 2 }, // กุ้ง

    // ===== หมู่ที่ 3 ผัก =====
    { emoji: '🥦', group: 3 }, // บร็อกโคลี
    { emoji: '🥕', group: 3 }, // แครอท
    { emoji: '🥬', group: 3 }, // ผักใบเขียว
    { emoji: '🌽', group: 3 }, // ข้าวโพด
    { emoji: '🍅', group: 3 }, // มะเขือเทศ
    { emoji: '🧅', group: 3 }, // หัวหอม
    { emoji: '🫛', group: 3 }, // ถั่วฝัก

    // ===== หมู่ที่ 4 ผลไม้ =====
    { emoji: '🍎', group: 4 }, // แอปเปิล
    { emoji: '🍌', group: 4 }, // กล้วย
    { emoji: '🍇', group: 4 }, // องุ่น
    { emoji: '🍉', group: 4 }, // แตงโม
    { emoji: '🍓', group: 4 }, // สตรอว์เบอร์รี
    { emoji: '🍊', group: 4 }, // ส้ม
    { emoji: '🍍', group: 4 }, // สับปะรด

    // ===== หมู่ที่ 5 นมและผลิตภัณฑ์นม =====
    { emoji: '🥛', group: 5 }, // นม
    { emoji: '🧀', group: 5 }, // ชีส
    { emoji: '🧈', group: 5 }, // เนย
    { emoji: '🍦', group: 5 }, // ไอศกรีมโคน
    { emoji: '🍨', group: 5 }, // ไอศกรีมถ้วย
    { emoji: '🥞', group: 5 }, // แพนเค้ก (มีนม/ไข่)
    { emoji: '🧇', group: 5 }  // วาฟเฟิล (มีนม/ไข่)
  ];

  // แยก emoji ตามหมู่ เพื่อสุ่มบาลานซ์ทุกหมู่
  const EMOJI_BY_GROUP = {
    1: FOOD_EMOJIS.filter(f => f.group === 1),
    2: FOOD_EMOJIS.filter(f => f.group === 2),
    3: FOOD_EMOJIS.filter(f => f.group === 3),
    4: FOOD_EMOJIS.filter(f => f.group === 4),
    5: FOOD_EMOJIS.filter(f => f.group === 5)
  };

  // mini quest (ต่อเนื่อง) — เน้นเก็บแต่ละหมู่
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
    // fallback
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

  // สุ่มอาหารแบบบาลานซ์หมู่: เลือกหมู่ก่อน แล้วสุ่ม emoji ในหมู่นั้น
  function randomFoodBalanced () {
    const groupId = 1 + Math.floor(Math.random() * 5); // 1..5 เท่ากันทุกหมู่
    const list = EMOJI_BY_GROUP[groupId] || FOOD_EMOJIS;
    const choice = list[Math.floor(Math.random() * list.length)];
    return choice;
  }

  // -------------- System: groups-vr-engine --------------
  A.registerSystem('groups-vr-engine', {
    init: function () {
      this.diffKey = parseUrlDiff();
      this.config = pickDifficulty(this.diffKey);

      this.sceneEl = this.sceneEl || document.querySelector('a-scene');
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
      this.updateHud(); // initial
      this.setCoachText('วันนี้เราจะมาล่าหมู่สารอาหาร 5 หมู่กันนะ! ดูให้ทันว่าเป็นอาหารหมู่ไหน แล้วตีให้ทันก่อนหายไป 💪');

      console.log('[GroupsVR] System init', this.config);
    },

    // ---------- Binding HUD & FX ----------
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
        root: document.getElementById('groupsvr-finish'),
        main: document.getElementById('groupsvr-finish-main'),
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

    // ---------- Tick loop ----------
    tick: function (time, dt) {
      if (this.gameOver) return;
      if (!dt) dt = 16;

      // อัปเดตเวลา
      this.timerMs -= dt;
      if (this.timerMs <= 0) {
        this.timerMs = 0;
        this.updateHud();
        this.endGame();
        return;
      }

      // spawn เป้า
      if ((time - this.lastSpawnAt) > this.config.spawnInterval &&
          this.targets.length < this.config.maxActive) {
        this.spawnTarget(time);
        this.lastSpawnAt = time;
      }

      // เคลียร์เป้าที่หมดอายุ
      this.pruneTargets(time);

      // HUD
      this.updateHud();
    },

    // ---------- Target handling ----------
    spawnTarget: function (now) {
      const scene = this.sceneEl;
      if (!scene) return;

      const choice = randomFoodBalanced(); // ใช้สุ่มแบบบาลานซ์หมู่

      const el = document.createElement('a-entity');
      el.setAttribute('text', {
        value: choice.emoji,
        align: 'center',
        width: 4 * this.config.scale,
        color: '#ffffff'
      });
      el.setAttribute('position', '0 1.6 -2.1');
      el.setAttribute('scale', `${this.config.scale} ${this.config.scale} ${this.config.scale}`);
      el.classList.add('hh-target');

      const targetData = {
        el,
        createdAt: now,
        expireAt: now + this.config.lifetime,
        foodGroup: choice.group,
        emoji: choice.emoji
      };

      el.dataset.groupsTargetId = String(Math.random());

      // ใช้ arrow fn เพื่อเก็บ this ของ system
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

      // สถิติ
      this.stats.hits += 1;
      this.stats.score += 10;
      if (!this.stats.byGroup[target.foodGroup]) {
        this.stats.byGroup[target.foodGroup] = 0;
      }
      this.stats.byGroup[target.foodGroup] += 1;

      // fever
      this.fever = clamp(this.fever + this.config.feverGainHit, 0, FEVER_MAX);

      // Mini Quest
      this.updateQuestProgress(target.foodGroup);

      // FX + Logger
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
            // ครบทุก quest แล้ว
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

      // เพิ่มคะแนนพิเศษ
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

    // ---------- Logger hook (เชื่อม Cloud Logger ถ้ามี) ----------
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
