// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (with Fever + Cloud Logger + Emoji Text)
// 2025-12-05

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
      const emojiMod = ns.foodGroupsEmoji;
      let item = null;

      if (emojiMod && typeof emojiMod.pickRandom === 'function') {
        item = emojiMod.pickRandom(this.cfg.goodRatio);
      }

      console.log('[GroupsVR] spawnTarget()', item);

      const el = document.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');

      const x = (Math.random() * 1.8) - 0.9;
      const y = 1.1 + Math.random() * 0.8;
      const z = -2.3;
      el.setAttribute('position', { x, y, z });

      const scale = this.cfg.scale || 1.0;
      el.setAttribute('scale', scale + ' ' + scale + ' ' + scale);

      if (item && item.emoji) {
        // ใช้ text component แสดง emoji โดยตรง
        el.setAttribute('text', {
          value: item.emoji,
          align: 'center',
          anchor: 'center',
          baseline: 'center',
          width: 2.5,
          color: '#ffffff'
        });
      } else {
        // fallback กล่องสีเขียว — กรณีไม่มีข้อมูล
        el.setAttribute('geometry', 'primitive: box; depth: 0.4; height: 0.4; width: 0.4');
        el.setAttribute('material', 'color: #22c55e; shader: flat');
      }

      const groupId = item && item.group != null ? item.group : 0;
      const isGood  = item && item.isGood ? 1 : 0;

      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good', String(isGood));

      el._life      = 3000;
      el._age       = 0;
      el._spawnTime = performance.now();
      el._metaItem  = item || {};

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
