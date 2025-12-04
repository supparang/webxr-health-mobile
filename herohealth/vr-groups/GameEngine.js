// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (with Fever + Cloud Logger + Emoji Targets)
// 2025-12-05

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

  // --------------------------------------------------------------------
  // ชุดข้อมูลอาหารดี / อาหารควรลด (ใช้สุ่มเป้า)
  // --------------------------------------------------------------------
  const GOOD_ITEMS = [
    // หมู่ 1 – ข้าว แป้ง
    { emoji: '🍚', group: 1 },
    { emoji: '🍞', group: 1 },
    { emoji: '🥔', group: 1 },
    { emoji: '🌽', group: 1 },
    { emoji: '🍜', group: 1 },

    // หมู่ 2 – ผัก
    { emoji: '🥬', group: 2 },
    { emoji: '🥦', group: 2 },
    { emoji: '🥕', group: 2 },
    { emoji: '🍅', group: 2 },

    // หมู่ 3 – ผลไม้
    { emoji: '🍉', group: 3 },
    { emoji: '🍓', group: 3 },
    { emoji: '🍌', group: 3 },
    { emoji: '🍊', group: 3 },
    { emoji: '🍇', group: 3 },

    // หมู่ 4 – โปรตีน
    { emoji: '🐟', group: 4 },
    { emoji: '🍗', group: 4 },
    { emoji: '🥚', group: 4 },
    { emoji: '🥜', group: 4 },

    // หมู่ 5 – นม และผลิตภัณฑ์นม
    { emoji: '🥛', group: 5 },
    { emoji: '🧀', group: 5 }
  ];

  const JUNK_ITEMS = [
    { emoji: '🍔', group: 9 },
    { emoji: '🍟', group: 9 },
    { emoji: '🍕', group: 9 },
    { emoji: '🍩', group: 9 },
    { emoji: '🍪', group: 9 },
    { emoji: '🍫', group: 9 },
    { emoji: '🍰', group: 9 },
    { emoji: '🥤', group: 9 },
    { emoji: '🧋', group: 9 }
  ];

  function pickItem(goodRatio) {
    const r = Math.random();
    const useGood = r < goodRatio;               // โอกาสเจออาหารดีตาม diff
    const list = useGood ? GOOD_ITEMS : JUNK_ITEMS;
    const base = list[Math.floor(Math.random() * list.length)];
    return {
      emoji: base.emoji,
      group: base.group,
      isGood: useGood
    };
  }

  // --------------------------------------------------------------------
  // Helper functions
  // --------------------------------------------------------------------
  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();
    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }
    // fallback ถ้า table ไม่เจอ
    return {
      spawnInterval: 1200,
      fallSpeed: 0.011,
      scale: 1.0,
      maxActive: 4,
      goodRatio: 0.75,
      quest: { goalsPick: 2, miniPick: 3 }
    };
  }

  function createSessionId() {
    return (
      'FG-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8)
    );
  }

  // --------------------------------------------------------------------
  // Component หลักของเกม
  // --------------------------------------------------------------------
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      console.log('[GroupsVR] component init');

      this.running    = false;
      this.targets    = [];
      this.elapsed    = 0;
      this.durationMs = 60000;      // 60s
      this.diffKey    = 'normal';
      this.cfg        = pickDifficulty(this.diffKey);

      this.spawnClock = 0;
      this.score      = 0;

      // Fever
      this.fever       = 0;
      this.feverActive = false;

      // Logging
      this.sessionId = createSessionId();
      this.events    = [];

      // Fever bar (ถ้ามีโหลด ui-fever.js เป็น global FeverUI)
      if (ns.FeverUI && ns.FeverUI.ensureFeverBar) {
        ns.FeverUI.ensureFeverBar();
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      const scene = this.el.sceneEl;
      const self  = this;

      // groups-vr.html → scene.emit('fg-start',{diff})
      scene.addEventListener('fg-start', function (e) {
        const diff = (e && e.detail && e.detail.diff) || 'normal';
        self.start(diff);
      });

      scene.addEventListener('fg-stop', function () {
        self.finish('stop');
      });

      this._lastLogSec = -1;
    },

    // ------------- start / tick -------------
    start: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.cfg     = pickDifficulty(this.diffKey);

      this.running    = true;
      this.elapsed    = 0;
      this.spawnClock = 0;
      this.targets.length = 0;
      this.score      = 0;
      this.fever      = 0;
      this.feverActive = false;
      this.events.length = 0;
      this.sessionId = createSessionId();

      const elScore = document.getElementById('hud-score');
      if (elScore) elScore.textContent = '0';

      if (ns.FeverUI) {
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      console.log('[GroupsVR] start diff=', this.diffKey, 'cfg=', this.cfg);
    },

    tick: function (time, dt) {
      if (!this.running) return;
      if (!dt || dt <= 0) dt = 16;

      this.elapsed    += dt;
      this.spawnClock += dt;

      // debug log ทุก ๆ 1 วินาที
      const sec = (this.elapsed / 1000) | 0;
      if (sec !== this._lastLogSec) {
        this._lastLogSec = sec;
        console.log('[GroupsVR] tick sec=', sec, 'targets=', this.targets.length);
      }

      if (this.elapsed >= this.durationMs) {
        this.finish('timeout');
        return;
      }

      const cfg       = this.cfg || {};
      const interval  = cfg.spawnInterval || 1200;
      const maxActive = cfg.maxActive || 4;

      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        if (this.targets.length < maxActive) {
          this.spawnTarget();
        }
      }

      this.updateTargets(dt);
    },

    // ------------- spawn & move -------------
    spawnTarget: function () {
      const cfg  = this.cfg || {};
      const item = pickItem(cfg.goodRatio || 0.75);

      // ใช้ emojiImage แบบ GoodJunk (global จาก vr-groups/emoji-image.js)
      const emojiMod = ns.foodGroupsEmojiImage;
      let el;

      if (emojiMod && typeof emojiMod.emojiImage === 'function') {
        const scale = cfg.scale || 0.8;
        el = emojiMod.emojiImage(item.emoji, scale, 160);
      } else {
        // fallback กล่องสีเขียว — กันกรณี emojiImage ใช้งานไม่ได้
        el = document.createElement('a-entity');
        el.setAttribute(
          'geometry',
          'primitive: box; depth:0.4; height:0.4; width:0.4'
        );
        el.setAttribute(
          'material',
          'color:#22c55e; shader:flat'
        );
      }

      el.setAttribute('data-hha-tgt', '1');

      const x = (Math.random() * 1.8) - 0.9;
      const y = 1.0 + Math.random() * 0.8;
      const z = -2.3;
      el.setAttribute('position', { x, y, z });

      el.setAttribute('data-group', String(item.group));
      el.setAttribute('data-good', item.isGood ? '1' : '0');

      el._metaItem  = item;
      el._life      = 3000;
      el._age       = 0;
      el._spawnTime = performance.now();

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);
    },

    updateTargets: function (dt) {
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        t._age += dt;
        if (t._age >= t._life) {
          this.onMiss(t);
        }
      }
    },

    removeTarget: function (el) {
      const idx = this.targets.indexOf(el);
      if (idx !== -1) this.targets.splice(idx, 1);
      if (el.parentNode) el.parentNode.removeChild(el);
    },

    // ------------- hit / miss -------------
    onHit: function (el) {
      const isGood  = el.getAttribute('data-good') === '1';
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item    = el._metaItem || {};
      const emoji   = item.emoji || '';

      const now   = performance.now();
      const rtMs  = el._spawnTime ? (now - el._spawnTime) : null;

      let delta = isGood ? 10 : -5;
      this.score = Math.max(0, this.score + delta);

      const elScore = document.getElementById('hud-score');
      if (elScore) elScore.textContent = String(this.score);

      this.updateFeverOnHit(isGood);

      this.logEvent({
        type: 'hit',
        groupId: groupId,
        emoji: emoji,
        isGood: !!isGood,
        hitOrMiss: 'hit',
        rtMs: rtMs,
        scoreDelta: delta,
        pos: this.copyWorldPos(el)
      });

      this.removeTarget(el);
    },

    onMiss: function (el) {
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item    = el._metaItem || {};
      const emoji   = item.emoji || '';

      const now   = performance.now();
      const rtMs  = el._spawnTime ? (now - el._spawnTime) : null;

      this.updateFeverOnMiss();

      this.logEvent({
        type: 'miss',
        groupId: groupId,
        emoji: emoji,
        isGood: false,
        hitOrMiss: 'miss',
        rtMs: rtMs,
        scoreDelta: 0,
        pos: this.copyWorldPos(el)
      });

      this.removeTarget(el);
    },

    copyWorldPos: function (el) {
      if (!el || !el.object3D || !window.THREE) return null;
      const v = el.object3D.getWorldPosition(new THREE.Vector3());
      return { x: v.x, y: v.y, z: v.z };
    },

    // ------------- Fever -------------
    updateFeverOnHit: function (isGood) {
      if (!ns.FeverUI) return;

      let f = this.fever || 0;
      if (isGood) f += 8;
      else        f -= 12;

      f = clamp(f, 0, FEVER_MAX);
      this.fever = f;

      if (f >= FEVER_MAX && !this.feverActive) {
        this.feverActive = true;
        ns.FeverUI.setFeverActive(true);
      }
      if (f < 30 && this.feverActive) {
        this.feverActive = false;
        ns.FeverUI.setFeverActive(false);
      }

      ns.FeverUI.setFever(f);
    },

    updateFeverOnMiss: function () {
      if (!ns.FeverUI) return;

      let f = this.fever || 0;
      f -= 5;
      f = clamp(f, 0, FEVER_MAX);
      this.fever = f;

      if (f < 30 && this.feverActive) {
        this.feverActive = false;
        ns.FeverUI.setFeverActive(false);
      }
      ns.FeverUI.setFever(f);
    },

    // ------------- Logging -------------
    logEvent: function (ev) {
      this.events.push(ev);
    },

    // ------------- finish -------------
    finish: function (reason) {
      if (!this.running) return;
      this.running = false;

      for (let i = 0; i < this.targets.length; i++) {
        const el = this.targets[i];
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      this.targets.length = 0;

      const scene = this.el.sceneEl;

      if (ns.foodGroupsCloudLogger && typeof ns.foodGroupsCloudLogger.send === 'function') {
        const rawSession = {
          sessionId: this.sessionId,
          score: this.score,
          difficulty: this.diffKey,
          durationMs: this.elapsed
        };
        ns.foodGroupsCloudLogger.send(rawSession, this.events);
      }

      scene.emit('fg-game-over', {
        score: this.score,
        diff: this.diffKey,
        reason: reason || 'finish'
      });

      console.log('[GroupsVR] finish', reason, 'score=', this.score);
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
