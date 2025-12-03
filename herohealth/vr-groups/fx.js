// === /herohealth/vr-groups/GameEngine.js ===
// FULL VERSION with FX event dispatch added
// 2025-12-05

(function (ns) {
  'use strict';

  // ---------- Utility ----------
  function worldToScreen(wp) {
    try {
      const renderer = window.GAME_MODULES && GAME_MODULES.renderer;
      const camera = window.GAME_MODULES && GAME_MODULES.camera;
      if (!renderer || !camera || !wp) return null;

      const vec = wp.clone();
      vec.project(camera);

      const canvas = renderer.domElement;
      return {
        x: (vec.x * 0.5 + 0.5) * canvas.clientWidth,
        y: (-vec.y * 0.5 + 0.5) * canvas.clientHeight
      };
    } catch (e) { return null; }
  }

  // ---------- detect device ----------
  function detectDeviceType() {
    try {
      if (window.AFRAME && AFRAME.utils && AFRAME.utils.device) {
        const d = AFRAME.utils.device;
        if (d.isMobileVR && d.isMobileVR()) return 'mobile-vr';
        if (d.isMobile && d.isMobile())   return 'mobile';
        return 'desktop';
      }
    } catch (e) {}
    const ua = navigator.userAgent || '';
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // ---------- scoring ----------
  function baseScoreForDiff(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy': return 8;
      case 'hard': return 12;
      case 'normal':
      default:     return 10;
    }
  }

  function missPenaltyForDiff(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy': return 0;
      case 'hard': return 5;
      case 'normal':
      default:     return 3;
    }
  }

  function classifyJudgment(rt) {
    if (rt == null) return 'normal';
    if (rt < 350) return 'perfect';
    if (rt < 800) return 'good';
    if (rt < 1300) return 'late';
    return 'slow';
  }

  // -------------------------------------------------------
  //  LOG EVENT
  // -------------------------------------------------------
  function logEvent(type, detail) {
    try {
      const arr = (window.HHA_FOODGROUPS_LOG = window.HHA_FOODGROUPS_LOG || []);
      detail = detail || {};
      const payload = Object.assign({ ts: Date.now(), type }, detail);

      arr.push(payload);
    } catch (e) {}
  }

  // -------------------------------------------------------
  //  MAIN GAME CLASS
  // -------------------------------------------------------
  function FoodGroupsGame(sceneEl) {
    this.sceneEl = sceneEl;
    this.state = 'idle';
    this.diff = 'normal';

    this.cfg = ns.foodGroupsDifficulty
      ? ns.foodGroupsDifficulty.get('normal')
      : {
          spawnInterval: 1200,
          targetLifetime: 2200,
          maxActive: 5,
          duration: 60000,
          targetRadius: 0.5
        };

    this.score = 0;
    this._targets = [];
    this.session = ns.foodGroupsSession || {};
    this.deviceType = detectDeviceType();

    this.groupStats = {};
    this.resetGroupStats();

    // attach FX
    if (ns.foodGroupsFx && ns.foodGroupsFx.init) {
      ns.foodGroupsFx.init();
    }

    if (ns.foodGroupsUI && ns.foodGroupsUI.attachScene) {
      ns.foodGroupsUI.attachScene(sceneEl);
    }

    // quest manager
    this.questManager = ns.FoodGroupsQuestManager
      ? new ns.FoodGroupsQuestManager((quest, progress, justFinished, finishedQuest) => {
          if (justFinished) {
            window.dispatchEvent(new Event('fg-mission-clear'));
          }
        })
      : null;
  }

  // ---------- stats ----------
  FoodGroupsGame.prototype.resetGroupStats = function () {
    this.groupStats = {};
    if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all) {
      ns.foodGroupsEmoji.all.forEach(g => {
        this.groupStats[g.id] = {
          id: g.id,
          label: g.label,
          emoji: g.emoji,
          isGood: g.isGood,
          spawns: 0,
          hits: 0,
          goodHits: 0,
          badHits: 0
        };
      });
    }
  };

  // ---------- clear ----------
  FoodGroupsGame.prototype.clearTimers = function () {
    if (this._spawnTimer) clearTimeout(this._spawnTimer);
    if (this._gameTimer) clearTimeout(this._gameTimer);
    if (this._timeInterval) clearInterval(this._timeInterval);
  };

  FoodGroupsGame.prototype.removeAllTargets = function () {
    this._targets.forEach(el => el?.parentNode?.removeChild(el));
    this._targets.length = 0;
  };

  // -------------------------------------------------------
  // START GAME
  // -------------------------------------------------------
  FoodGroupsGame.prototype.start = function (opts) {
    opts = opts || {};

    this.diff = opts.diff || 'normal';
    if (ns.foodGroupsDifficulty) {
      this.cfg = ns.foodGroupsDifficulty.get(this.diff);
    }

    this.state = 'playing';
    this.score = 0;
    this.groupStats = {};

    this.clearTimers();
    this.removeAllTargets();
    this.resetGroupStats();

    if (ns.foodGroupsUI) {
      ns.foodGroupsUI.reset();
      ns.foodGroupsUI.setLegend(ns.foodGroupsEmoji.all);
      ns.foodGroupsUI.setScore(0);
    }

    this._startWallTime = Date.now();
    const duration = this.cfg.duration;

    // countdown
    this._timeInterval = setInterval(() => {
      const past = Date.now() - this._startWallTime;
      const remain = Math.ceil((duration - past) / 1000);
      if (remain >= 0)
        window.dispatchEvent(new CustomEvent('hha:time', { detail: { sec: remain } }));
    }, 250);

    this._gameTimer = setTimeout(() => {
      this.endGame('timeout');
    }, duration);

    this.scheduleNextSpawn();
  };

  // -------------------------------------------------------
  // END GAME
  // -------------------------------------------------------
  FoodGroupsGame.prototype.endGame = function (reason) {
    if (this.state !== 'playing') return;

    this.state = 'ended';
    this.clearTimers();
    this.removeAllTargets();

    const questsCleared =
      this.questManager?.getClearedCount
        ? this.questManager.getClearedCount()
        : 0;

    const sessionSummary = {
      mode: 'groups-vr',
      diff: this.diff,
      score: this.score,
      questsCleared,
      groupStats: this.groupStats
    };

    const events = window.HHA_FOODGROUPS_LOG || [];

    if (ns.foodGroupsCloudLogger && ns.foodGroupsCloudLogger.send) {
      ns.foodGroupsCloudLogger.send(sessionSummary, events);
    }

    this.sceneEl.emit('fg-game-over', sessionSummary);
  };

  // -------------------------------------------------------
  // SPAWN TARGET
  // -------------------------------------------------------
  FoodGroupsGame.prototype.scheduleNextSpawn = function () {
    if (this.state !== 'playing') return;

    this._spawnTimer = setTimeout(() => {
      this.spawnTarget();
      this.scheduleNextSpawn();
    }, this.cfg.spawnInterval);
  };

  FoodGroupsGame.prototype.spawnTarget = function () {
    if (this.state !== 'playing') return;

    if (this._targets.length >= this.cfg.maxActive) return;

    let group = ns.foodGroupsEmoji.pickRandomGroup();
    if (!group) group = { id: 0, emoji: '🎯', color: '#22c55e', isGood: true };

    const el = document.createElement('a-entity');

    const x = -1.2 + Math.random() * 2.4;
    const y = 0.9 + Math.random() * 1.0;
    const z = -2.8 + Math.random() * 0.6;

    const radius = this.cfg.targetRadius;

    el.setAttribute('geometry', `primitive: circle; radius: ${radius};`);
    el.setAttribute('material', `color:${group.color}; shader: flat; opacity:0.95`);
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('data-hha-tgt', 1);
    el.setAttribute('data-group-id', group.id);
    el.setAttribute('data-emoji', group.emoji);
    el.setAttribute('data-is-good', group.isGood ? '1' : '0');

    // emoji label
    const label = document.createElement('a-text');
    label.setAttribute('value', group.emoji);
    label.setAttribute('align', 'center');
    label.setAttribute('width', '2.5');
    label.setAttribute('position', '0 0 0.03');
    el.appendChild(label);

    el.__spawnTime = performance.now();

    this.sceneEl.appendChild(el);
    this._targets.push(el);

    el.addEventListener('click', () => this.onHitTarget(el));
  };

  // -------------------------------------------------------
  // HIT
  // -------------------------------------------------------
  FoodGroupsGame.prototype.onHitTarget = function (el) {
    if (this.state !== 'playing' || !el || el.__destroyed) return;
    el.__destroyed = true;

    const spawnTime = el.__spawnTime;
    const now = performance.now();
    const rt = spawnTime ? now - spawnTime : null;

    const id = parseInt(el.getAttribute('data-group-id'));
    const emoji = el.getAttribute('data-emoji');
    const isGood = el.getAttribute('data-is-good') !== '0';

    const base = baseScoreForDiff(this.diff);
    let gained = isGood ? base : -missPenaltyForDiff(this.diff);

    this.score = Math.max(0, this.score + gained);

    if (ns.foodGroupsUI) ns.foodGroupsUI.setScore(this.score);

    // convert world → screen
    let screenXY = null;
    if (window.THREE && el.object3D) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      screenXY = worldToScreen(wp);
    }

    // -------------- DISPATCH HIT EVENT TO FX --------------
    if (screenXY) {
      window.dispatchEvent(
        new CustomEvent('fg-hit', {
          detail: { x: screenXY.x, y: screenXY.y, emoji }
        })
      );
    }

    logEvent('hit', { groupId: id, emoji, rtMs: rt, scoreDelta: gained });

    this.safeRemoveTarget(el);
  };

  // -------------------------------------------------------
  // MISS
  // -------------------------------------------------------
  FoodGroupsGame.prototype.onMissTarget = function (el) {
    if (!el || el.__destroyed) return;
    el.__destroyed = true;

    const id = parseInt(el.getAttribute('data-group-id'));
    const emoji = el.getAttribute('data-emoji');

    const penalty = missPenaltyForDiff(this.diff);
    this.score = Math.max(0, this.score - penalty);

    if (ns.foodGroupsUI) ns.foodGroupsUI.setScore(this.score);

    // convert world → screen
    let screenXY = null;
    if (window.THREE && el.object3D) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      screenXY = worldToScreen(wp);
    }

    // -------------- DISPATCH MISS EVENT TO FX --------------
    if (screenXY) {
      window.dispatchEvent(
        new CustomEvent('fg-miss', {
          detail: { x: screenXY.x, y: screenXY.y }
        })
      );
    }

    logEvent('miss', { groupId: id, emoji });

    this.safeRemoveTarget(el);
  };

  // -------------------------------------------------------
  // SAFE REMOVE
  // -------------------------------------------------------
  FoodGroupsGame.prototype.safeRemoveTarget = function (el) {
    const idx = this._targets.indexOf(el);
    if (idx !== -1) this._targets.splice(idx, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  // -------------------------------------------------------
  // REGISTER COMPONENT
  // -------------------------------------------------------
  AFRAME.registerComponent('food-groups-game', {
    init: function () {
      ns.FoodGroupsGameInstance = new ns.FoodGroupsGame(this.el.sceneEl);
      this.el.sceneEl.addEventListener('fg-start', (e) => {
        ns.FoodGroupsGameInstance.start({ diff: e.detail.diff });
      });
    }
  });

  ns.FoodGroupsGame = FoodGroupsGame;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));