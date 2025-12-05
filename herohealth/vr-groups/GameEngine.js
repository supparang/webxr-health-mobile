// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji badge + spaced targets + Cloud logger)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // สำหรับฉาก Food Groups ตอนนี้ยังไม่ต้องใช้ Fever bar บน HUD
  const USE_FEVER_UI = false;
  const FEVER_MAX = 100;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // === emoji → texture (canvas) cache ===
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // วาดเงาจานกลม ๆ ด้านหลัง
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.beginPath();
    ctx.arc(size / 2 + 6, size / 2 + 6, size / 2.6, 0, Math.PI * 2);
    ctx.fill();

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
      scale: 1.0,
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
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  // === ตัวช่วยสุ่มตำแหน่ง + กันเป้าชนกัน ===
  function randomSpawnPos() {
    // พื้นที่เล่น: กึ่งกลางจอขึ้นมาหน่อย ไม่ทับ HUD ด้านล่าง
    const x = Math.random() * 1.8 - 0.9; // -0.9..+0.9
    const y = 1.3 + Math.random() * 0.8; // 1.3..2.1
    const z = -2.2 + (Math.random() * 0.4 - 0.2); // -2.4..-2.0
    return { x, y, z };
  }

  function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  // หา position ที่ไม่เข้าใกล้เป้าที่มีอยู่เกินไป
  function findClearPos(activeTargets, minDist) {
    const minSq = minDist * minDist;
    for (let attempt = 0; attempt < 10; attempt++) {
      const pos = randomSpawnPos();
      let ok = true;
      for (let i = 0; i < activeTargets.length; i++) {
        const t = activeTargets[i];
        if (!t || !t.getAttribute) continue;
        const p = t.getAttribute('position') || { x: 0, y: 0, z: 0 };
        if (distanceSq(pos, p) < minSq) {
          ok = false;
          break;
        }
      }
      if (ok) return pos;
    }
    // ถ้าพยายาม 10 ครั้งแล้วยังชน ก็ยอมใช้ครั้งสุดท้าย
    return randomSpawnPos();
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

      // Fever (ตอนนี้ไม่มี UI แต่เก็บค่าไว้เผื่อใช้วิเคราะห์)
      this.fever = 0;
      this.feverActive = false;

      // Logging
      this.sessionId = createSessionId();
      this.events = [];

      // HUD elements
      this._hudScore = document.getElementById('hud-score');
      this._hudTime = document.getElementById('hud-time-label');

      // Fever bar (ปิดในฉากนี้)
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

      // สร้างเป้าใหม่ (กระจาย + ไม่ชนกัน)
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

    // ===== spawnTarget: emoji badge + กันเป้าซ้อน =====
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

      const pos = findClearPos(this.targets, 0.9); // กันชนรัศมีประมาณ 0.9 m
      el.setAttribute('position', pos);

      const scale = this.cfg.scale || 1.0;
      const isGood = !!item.isGood;

      // พื้นวงกลม
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.42 * scale
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
        radiusInner: 0.42 * scale,
        radiusOuter: 0.48 * scale
      });
      border.setAttribute('material', {
        shader: 'flat',
        color: '#0f172a',
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
        img.setAttribute('width', 0.65 * scale);
        img.setAttribute('height', 0.65 * scale);
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

      console.log('[GroupsVR] spawnTarget(EMOJI BADGE)', item, 'total=', this.targets.length);
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

    // === Fever (ไม่มี UI แต่เก็บค่าไว้) ===
    updateFeverOnHit: function (isGood) {
      if (!USE_FEVER_UI || !ns.FeverUI) {
        // แค่เก็บค่าไว้เผื่อวิเคราะห์
        let f = this.fever || 0;
        f += isGood ? 8 : -12;
        this.fever = clamp(f, 0, FEVER_MAX);
        return;
      }
      // (กรณีอนาคตเปิด USE_FEVER_UI กลับมา)
    },

    updateFeverOnMiss: function () {
      if (!USE_FEVER_UI || !ns.FeverUI) {
        let f = this.fever || 0;
        f -= 5;
        this.fever = clamp(f, 0, FEVER_MAX);
        return;
      }
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