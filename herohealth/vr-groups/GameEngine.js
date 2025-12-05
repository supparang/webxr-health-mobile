// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (Emoji + Colored Circle + Cloud Logger)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

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
    // fallback
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

  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      console.log('[GroupsVR] component init');

      this.running    = false;
      this.targets    = [];
      this.elapsed    = 0;
      this.durationMs = 60000; // 60s
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

      // HUD refs
      this._hudScore = document.getElementById('hud-score');
      this._hudTime  = document.getElementById('hud-time-label');

      // Fever bar (มีหรือไม่มีก็ได้)
      if (ns.FeverUI && ns.FeverUI.ensureFeverBar) {
        ns.FeverUI.ensureFeverBar();
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      const scene = this.el.sceneEl;
      const self  = this;

      scene.addEventListener('fg-start', function (e) {
        const diff = (e && e.detail && e.detail.diff) || 'normal';
        self.start(diff);
      });

      scene.addEventListener('fg-stop', function () {
        self.finish('stop');
      });

      this._lastLogSec = -1;
    },

    // ---------------- start / tick ----------------
    start: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.cfg     = pickDifficulty(this.diffKey);

      this.running        = true;
      this.elapsed        = 0;
      this.spawnClock     = 0;
      this.targets.length = 0;
      this.score          = 0;
      this.fever          = 0;
      this.feverActive    = false;
      this.events.length  = 0;
      this.sessionId      = createSessionId();

      if (this._hudScore) this._hudScore.textContent = '0';
      if (this._hudTime)  {
        const sec = (this.durationMs / 1000) | 0;
        this._hudTime.textContent = sec + 's';
      }

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

      // หมดเวลาเมื่อครบ duration
      if (this.elapsed >= this.durationMs) {
        this.finish('timeout');
        return;
      }

      const cfg       = this.cfg || {};
      const interval  = cfg.spawnInterval || 1200;
      const maxActive = cfg.maxActive || 4;

      // spawn เป้าใหม่ตาม interval
      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        if (this.targets.length < maxActive) {
          this.spawnTarget();
        }
      }

      // อัปเดตตำแหน่งเป้า / อายุเป้า
      this.updateTargets(dt);

      // อัปเดตเวลาใน HUD (นับถอยหลัง)
      if (this._hudTime) {
        const remainMs  = Math.max(0, this.durationMs - this.elapsed);
        const remainSec = (remainMs / 1000) | 0;
        this._hudTime.textContent = remainSec + 's';
      }

      // log ทุก ๆ 1 วินาที หลังจาก spawn+update แล้ว
      const sec = (this.elapsed / 1000) | 0;
      if (sec !== this._lastLogSec) {
        this._lastLogSec = sec;
        console.log('[GroupsVR] tick sec=', sec, 'targets=', this.targets.length);
      }
    },

    // ---------------- spawn & move (emoji + circle) ----------------
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

      // ตำแหน่งเป้า (สุ่มซ้าย-ขวา + สูงหน่อย)
      const x = (Math.random() * 1.8) - 0.9;
      const y = 1.5 + Math.random() * 0.8;
      const z = -2.4;
      el.setAttribute('position', { x, y, z });

      const scale  = this.cfg.scale || 1.0;
      const isGood = item.isGood ? true : false;

      // วงกลมสีเป็นตัวเป้า (ให้เห็นแน่นอน)
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.35 * scale
      });
      el.setAttribute('material', {
        color: isGood ? '#22c55e' : '#f97316',
        opacity: 0.96,
        side: 'double'
      });

      // CHILD: emoji หรืออักษร
      const emojiChar = item.emoji || (isGood ? 'G' : 'J');
      const txt = document.createElement('a-entity');
      txt.setAttribute('text', {
        value: emojiChar,
        align: 'center',
        color: '#ffffff',
        width: 1.4 * scale,
        baseline: 'center',
        shader: 'msdf'
      });
      txt.setAttribute('position', { x: 0, y: 0, z: 0.01 });
      el.appendChild(txt);

      const groupId = item && item.group != null ? item.group : 0;

      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good',  isGood ? '1' : '0');

      // อายุของเป้า + เวลา spawn
      el._life      = 5000; // อายุสูงสุด ~5s
      el._age       = 0;
      el._spawnTime = performance.now();
      el._metaItem  = item || {};

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);

      console.log('[GroupsVR] spawnTarget()', item, 'total=', this.targets.length);
    },

    updateTargets: function (dt) {
      const fallSpeed = (this.cfg && this.cfg.fallSpeed) || 0.011;
      const step = fallSpeed * (dt / 16.7); // ปรับตามเฟรมเรต

      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];

        t._age += dt;

        // ขยับเป้าลงด้านล่าง
        const pos = t.getAttribute('position') || { x: 0, y: 0, z: 0 };
        pos.y -= step;
        t.setAttribute('position', pos);

        const outOfBounds = pos.y <= 0.1;
        const expired     = t._age >= t._life;

        if (outOfBounds || expired) {
          this.onMiss(t);
        }
      }
    },

    removeTarget: function (el) {
      const idx = this.targets.indexOf(el);
      if (idx !== -1) this.targets.splice(idx, 1);
      if (el.parentNode) el.parentNode.removeChild(el);
    },

    // ---------------- hit / miss ----------------
    onHit: function (el) {
      const isGood  = el.getAttribute('data-good') === '1';
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item    = el._metaItem || {};
      const emoji   = item.emoji || '';

      const now  = performance.now();
      const rtMs = el._spawnTime ? (now - el._spawnTime) : null;

      let delta = isGood ? 10 : -5;
      this.score = Math.max(0, this.score + delta);

      if (this._hudScore) this._hudScore.textContent = String(this.score);

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

      const now  = performance.now();
      const rtMs = el._spawnTime ? (now - el._spawnTime) : null;

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

    // ---------------- Fever ----------------
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

    // ---------------- Logging ----------------
    logEvent: function (ev) {
      this.events.push(ev);
    },

    // ---------------- finish ----------------
    finish: function (reason) {
      if (!this.running) return;
      this.running = false;

      for (let i = 0; i < this.targets.length; i++) {
        const el = this.targets[i];
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      this.targets.length = 0;

      if (this._hudTime) {
        this._hudTime.textContent = '0s';
      }

      const scene = this.el.sceneEl;

      if (ns.foodGroupsCloudLogger && typeof ns.foodGroupsCloudLogger.send === 'function') {
        const rawSession = {
          sessionId:  this.sessionId,
          score:      this.score,
          difficulty: this.diffKey,
          durationMs: this.elapsed
        };
        ns.foodGroupsCloudLogger.send(rawSession, this.events);
      }

      scene.emit('fg-game-over', {
        score:  this.score,
        diff:   this.diffKey,
        reason: reason || 'finish'
      });

      console.log('[GroupsVR] finish', reason, 'score=', this.score);
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
