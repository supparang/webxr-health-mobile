// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine
// • emoji badge targets
// • fixed spawn slots (ไม่ให้เป้าซ้อนกัน)
// • simple goal / mini quest fields (ส่งไปตอนจบเกม)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const USE_FEVER_UI = false;
  const FEVER_MAX = 100;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ===== emoji → texture (canvas) cache =====
  const emojiTexCache = {};

  function makeEmojiTexture(emojiChar) {
    emojiChar = emojiChar || '🍎';
    if (emojiTexCache[emojiChar]) return emojiTexCache[emojiChar];

    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // เงาด้านหลัง
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.beginPath();
    ctx.arc(size / 2 + 6, size / 2 + 6, size / 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(emojiChar, size / 2, size / 2);

    const url = canvas.toDataURL('image/png');
    emojiTexCache[emojiChar] = url;
    return url;
  }

  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();
    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }
    // fallback
    return {
      spawnInterval: 1200,
      fallSpeed: 0.0,
      scale: 0.9,
      maxActive: 3,
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

  // ===== fixed spawn slots (กันเป้าซ้อนกัน) =====
  // เลย์เอาต์แบบ 5 ตำแหน่ง
  const SPAWN_SLOTS = [
    { x: -0.9, y: 1.6, z: -2.3 },
    { x: 0.0, y: 1.7, z: -2.2 },
    { x: 0.9, y: 1.6, z: -2.3 },
    { x: -0.45, y: 2.1, z: -2.2 },
    { x: 0.45, y: 2.1, z: -2.2 }
  ];

  function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  function findSlotIndexForPos(pos) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < SPAWN_SLOTS.length; i++) {
      const d = distanceSq(pos, SPAWN_SLOTS[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // คืนตำแหน่งจาก slot ที่ยังไม่ถูกใช้ (1 เป้าต่อ 1 slot)
  function pickFreeSlot(activeTargets) {
    const used = new Set();
    for (let i = 0; i < activeTargets.length; i++) {
      const t = activeTargets[i];
      if (!t || !t.getAttribute) continue;
      const p = t.getAttribute('position') || { x: 0, y: 0, z: 0 };
      const idx = findSlotIndexForPos(p);
      used.add(idx);
    }

    const free = [];
    for (let i = 0; i < SPAWN_SLOTS.length; i++) {
      if (!used.has(i)) free.push(i);
    }

    if (free.length === 0) {
      // ถ้าเต็มทุก slot ก็สุ่มที่หนึ่ง (อาจจะเริ่มชนเล็กน้อย แต่น้อยมาก)
      return SPAWN_SLOTS[Math.floor(Math.random() * SPAWN_SLOTS.length)];
    }
    const pick = free[Math.floor(Math.random() * free.length)];
    return SPAWN_SLOTS[pick];
  }

  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      console.log('[GroupsVR] component init');

      this.running = false;
      this.targets = [];
      this.elapsed = 0;
      this.durationMs = 60000;
      this.diffKey = 'normal';
      this.cfg = pickDifficulty(this.diffKey);

      this.spawnClock = 0;
      this.score = 0;

      this.fever = 0;
      this.feverActive = false;

      this.sessionId = createSessionId();
      this.events = [];

      // HUD
      this._hudScore = document.getElementById('hud-score');
      this._hudTime = document.getElementById('hud-time-label');

      // Goal / mini quest (ไว้ส่งตอนจบเกม + แสดง HUD)
      this.goalText = '';
      this.miniText = '';

      if (USE_FEVER_UI && ns.FeverUI && ns.FeverUI.ensureFeverBar) {
        ns.FeverUI.ensureFeverBar();
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      const scene = this.el.sceneEl;
      const self = this;

      scene.addEventListener('fg-start', function (e) {
        const diff = (e && e.detail && e.detail.diff) || 'normal';
        self.start(diff);
      });

      scene.addEventListener('fg-stop', function () {
        self.finish('stop');
      });

      this._lastLogSec = -1;
    },

    start: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.cfg = pickDifficulty(this.diffKey);

      this.running = true;
      this.elapsed = 0;
      this.spawnClock = 0;
      this.targets.length = 0;
      this.score = 0;
      this.fever = 0;
      this.feverActive = false;
      this.events.length = 0;
      this.sessionId = createSessionId();

      if (this._hudScore) this._hudScore.textContent = '0';
      if (this._hudTime) {
        const sec = (this.durationMs / 1000) | 0;
        this._hudTime.textContent = sec + 's';
      }

      // ตั้งค่า goal / mini quest ง่าย ๆ จากระดับความยาก
      let goal, mini;
      switch (this.diffKey) {
        case 'easy':
          goal = 'คะแนน 80+';
          mini = 'เก็บอาหารดี 8 ชิ้น';
          break;
        case 'hard':
          goal = 'คะแนน 220+';
          mini = 'เก็บอาหารดี 18 ชิ้น';
          break;
        case 'normal':
        default:
          goal = 'คะแนน 150+';
          mini = 'เก็บอาหารดี 12 ชิ้น';
          break;
      }
      this.goalText = goal;
      this.miniText = mini;

      const elGoal = document.getElementById('hud-goal-text');
      const elMini = document.getElementById('hud-mini-text');
      if (elGoal) elGoal.textContent = goal;
      if (elMini) elMini.textContent = mini;

      if (USE_FEVER_UI && ns.FeverUI) {
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      console.log('[GroupsVR] start diff=', this.diffKey, 'cfg=', this.cfg);
    },

    tick: function (time, dt) {
      if (!this.running) return;
      if (!dt || dt <= 0) dt = 16;

      this.elapsed += dt;
      this.spawnClock += dt;

      if (this.elapsed >= this.durationMs) {
        this.finish('timeout');
        return;
      }

      const cfg = this.cfg || {};
      const interval = cfg.spawnInterval || 1200;
      const maxActive = cfg.maxActive || 3;

      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        if (this.targets.length < maxActive) {
          this.spawnTarget();
        }
      }

      this.updateTargets(dt);

      if (this._hudTime) {
        const remainMs = Math.max(0, this.durationMs - this.elapsed);
        const remainSec = (remainMs / 1000) | 0;
        this._hudTime.textContent = remainSec + 's';
      }

      const sec = (this.elapsed / 1000) | 0;
      if (sec !== this._lastLogSec) {
        this._lastLogSec = sec;
        console.log('[GroupsVR] tick sec=', sec, 'targets=', this.targets.length);
      }
    },

    // ===== spawnTarget: ใช้ slot ไม่ให้ซ้อนกัน =====
    spawnTarget: function () {
      const emojiMod = ns.foodGroupsEmoji;
      let item = null;
      if (emojiMod && typeof emojiMod.pickRandom === 'function') {
        item = emojiMod.pickRandom();
      }
      if (!item) {
        item = { emoji: '🍎', group: 3, isGood: true, name: 'ผลไม้' };
      }

      const el = document.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');

      const pos = pickFreeSlot(this.targets);
      el.setAttribute('position', pos);

      const scale = this.cfg.scale || 0.9;
      const isGood = !!item.isGood;

      // พื้นวงกลม
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.40 * scale
      });
      el.setAttribute('material', {
        shader: 'flat',
        color: isGood ? '#16a34a' : '#f97316',
        opacity: 1.0,
        side: 'double'
      });

      // ขอบ
      const border = document.createElement('a-entity');
      border.setAttribute('geometry', {
        primitive: 'ring',
        radiusInner: 0.40 * scale,
        radiusOuter: 0.46 * scale
      });
      border.setAttribute('material', {
        shader: 'flat',
        color: '#020617',
        side: 'double'
      });
      border.setAttribute('position', { x: 0, y: 0, z: 0.005 });
      el.appendChild(border);

      // emoji ตรงกลาง
      const emojiChar = item.emoji || (isGood ? '✅' : '✖️');
      const texUrl = makeEmojiTexture(emojiChar);
      if (texUrl) {
        const img = document.createElement('a-image');
        img.setAttribute('src', texUrl);
        img.setAttribute('width', 0.64 * scale);
        img.setAttribute('height', 0.64 * scale);
        img.setAttribute('position', { x: 0, y: 0, z: 0.02 });
        el.appendChild(img);
      }

      const groupId = item && item.group != null ? item.group : 0;
      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good', isGood ? '1' : '0');

      el._life = 15000;
      el._age = 0;
      el._spawnTime = performance.now();
      el._metaItem = item || {};

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);

      console.log('[GroupsVR] spawnTarget', item, 'total=', this.targets.length);
    },

    updateTargets: function (dt) {
      if (!this.targets || this.targets.length === 0) return;
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        if (!t) continue;
        t._age = (t._age || 0) + dt;
        if (t._life && t._age >= t._life) {
          this.onMiss(t);
        }
      }
    },

    removeTarget: function (el) {
      const idx = this.targets.indexOf(el);
      if (idx !== -1) this.targets.splice(idx, 1);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },

    onHit: function (el) {
      const isGood = el.getAttribute('data-good') === '1';
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item = el._metaItem || {};
      const emoji = item.emoji || '';

      const now = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      let delta = isGood ? 10 : -5;
      this.score = Math.max(0, this.score + delta);
      if (this._hudScore) this._hudScore.textContent = String(this.score);

      this.updateFeverOnHit(isGood);

      this.logEvent({
        type: 'hit',
        groupId,
        emoji,
        isGood: !!isGood,
        hitOrMiss: 'hit',
        rtMs,
        scoreDelta: delta,
        pos: this.copyWorldPos(el)
      });

      this.removeTarget(el);
    },

    onMiss: function (el) {
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item = el._metaItem || {};
      const emoji = item.emoji || '';

      const now = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      this.updateFeverOnMiss();

      this.logEvent({
        type: 'miss',
        groupId,
        emoji,
        isGood: false,
        hitOrMiss: 'miss',
        rtMs,
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

    updateFeverOnHit: function (isGood) {
      // ตอนนี้ยังไม่โชว์ Fever UI — แค่เก็บค่าคร่าว ๆ
      let f = this.fever || 0;
      f += isGood ? 8 : -12;
      this.fever = clamp(f, 0, FEVER_MAX);
    },

    updateFeverOnMiss: function () {
      let f = this.fever || 0;
      f -= 5;
      this.fever = clamp(f, 0, FEVER_MAX);
    },

    logEvent: function (ev) {
      this.events.push(ev);
    },

    finish: function (reason) {
      if (!this.running) return;
      this.running = false;

      for (let i = 0; i < this.targets.length; i++) {
        const el = this.targets[i];
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      this.targets.length = 0;

      if (this._hudTime) this._hudTime.textContent = '0s';

      const scene = this.el.sceneEl;

      if (ns.foodGroupsCloudLogger && typeof ns.foodGroupsCloudLogger.send === 'function') {
        const rawSession = {
          sessionId: this.sessionId,
          score: this.score,
          difficulty: this.diffKey,
          durationMs: this.elapsed,
          goal: this.goalText,
          miniQuest: this.miniText
        };
        ns.foodGroupsCloudLogger.send(rawSession, this.events);
      }

      scene.emit('fg-game-over', {
        score: this.score,
        diff: this.diffKey,
        reason: reason || 'finish',
        goal: this.goalText,
        miniQuest: this.miniText
      });

      console.log('[GroupsVR] finish', reason, 'score=', this.score);
    }
  });
})(window.GAME_MODULES || (window.GAME_MODULES = {}));