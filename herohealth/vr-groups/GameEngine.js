// vr-groups/GameEngine.js
(function (ns) {
  'use strict';

  // ---- logger ง่าย ๆ เก็บลง array ใน window ----
  function logEvent(type, detail) {
    try {
      const arr = (window.HHA_FOODGROUPS_LOG = window.HHA_FOODGROUPS_LOG || []);
      arr.push(Object.assign({ ts: Date.now(), type: type }, detail));
    } catch (e) {
      // เงียบไป ไม่ให้เกมพัง
    }
  }

  function FoodGroupsGame(sceneEl) {
    this.sceneEl = sceneEl;
    this.state = 'idle';
    this.diff = 'normal';
    this.cfg = ns.foodGroupsDifficulty
      ? ns.foodGroupsDifficulty.get('normal')
      : { spawnInterval: 1200, targetLifetime: 2200, maxActive: 5, duration: 60000 };

    this.score = 0;
    this._targets = [];
    this._spawnTimer = null;
    this._gameTimer = null;
    this._timeInterval = null;
    this._startTime = 0;

    this.groupStats = {};
    this.resetGroupStats();

    if (ns.foodGroupsFx && ns.foodGroupsFx.init) {
      ns.foodGroupsFx.init(sceneEl);
    }
    if (ns.foodGroupsUI && ns.foodGroupsUI.attachScene) {
      ns.foodGroupsUI.attachScene(sceneEl);
    }

    const self = this;
    this.questManager = ns.FoodGroupsQuestManager
      ? new ns.FoodGroupsQuestManager(function (quest, progress, justFinished, finishedQuest) {
          if (ns.foodGroupsCoach && ns.foodGroupsCoach.onQuestChange) {
            ns.foodGroupsCoach.onQuestChange({
              current: quest,
              progress: progress || 0,
              justFinished: !!justFinished,
              finished: finishedQuest || null
            });
          } else if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayQuest) {
            ns.foodGroupsCoach.sayQuest(quest, progress || 0);
          }
        })
      : null;
  }

  FoodGroupsGame.prototype.resetGroupStats = function () {
    this.groupStats = {};
    if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all) {
      ns.foodGroupsEmoji.all.forEach(g => {
        this.groupStats[g.id] = {
          id: g.id,
          label: g.label,
          emoji: g.emoji,
          spawns: 0,
          hits: 0
        };
      });
    }
  };

  FoodGroupsGame.prototype.clearTimers = function () {
    if (this._spawnTimer) {
      clearTimeout(this._spawnTimer);
      this._spawnTimer = null;
    }
    if (this._gameTimer) {
      clearTimeout(this._gameTimer);
      this._gameTimer = null;
    }
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
  };

  FoodGroupsGame.prototype.removeAllTargets = function () {
    this._targets.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    this._targets.length = 0;
  };

  FoodGroupsGame.prototype.start = function (opts) {
    opts = opts || {};
    this.diff = opts.diff || 'normal';
    if (ns.foodGroupsDifficulty) {
      this.cfg = ns.foodGroupsDifficulty.get(this.diff);
    }

    this.state = 'playing';
    this.score = 0;
    this.clearTimers();
    this.removeAllTargets();
    this.resetGroupStats();

    if (ns.foodGroupsUI) {
      ns.foodGroupsUI.init && ns.foodGroupsUI.init();
      ns.foodGroupsUI.show();
      ns.foodGroupsUI.reset();
      if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all && ns.foodGroupsUI.setLegend) {
        ns.foodGroupsUI.setLegend(ns.foodGroupsEmoji.all);
      }
    }

    if (this.questManager) {
      this.questManager.reset();
    }
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayStart) {
      ns.foodGroupsCoach.sayStart();
    }

    const duration = this.cfg.duration || 60000;
    const startTime = performance.now();
    this._startTime = startTime;

    const self = this;
    this._timeInterval = setInterval(function () {
      const elapsed = performance.now() - startTime;
      const remain = Math.max(0, duration - elapsed);
      if (ns.foodGroupsUI && ns.foodGroupsUI.setTime) {
        ns.foodGroupsUI.setTime(Math.ceil(remain / 1000));
      }
    }, 250);

    this._gameTimer = setTimeout(function () {
      self.endGame('timeout');
    }, duration);

    logEvent('start', { diff: this.diff });

    this.scheduleNextSpawn();
  };

  FoodGroupsGame.prototype.endGame = function (reason) {
    if (this.state !== 'playing') return;

    this.state = 'ended';
    this.clearTimers();
    this.removeAllTargets();

    if (ns.foodGroupsUI) ns.foodGroupsUI.hide();
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayFinish) {
      ns.foodGroupsCoach.sayFinish();
    }

    const questsCleared = this.questManager && this.questManager.getClearedCount
      ? this.questManager.getClearedCount()
      : 0;

    logEvent('end', {
      diff: this.diff,
      score: this.score,
      questsCleared: questsCleared,
      reason: reason || 'end'
    });

    this.sceneEl.emit('fg-game-over', {
      score: this.score,
      diff: this.diff,
      questsCleared: questsCleared,
      groupStats: this.groupStats
    });
  };

  FoodGroupsGame.prototype.scheduleNextSpawn = function () {
    if (this.state !== 'playing') return;
    const self = this;
    const interval = this.cfg.spawnInterval || 1200;

    this._spawnTimer = setTimeout(function () {
      self.spawnTarget();
      self.scheduleNextSpawn();
    }, interval);
  };

  FoodGroupsGame.prototype.spawnTarget = function () {
    if (this.state !== 'playing' || !ns.foodGroupsEmoji) return;

    const cfg = this.cfg || {};
    const maxActive = cfg.maxActive || 5;

    if (this._targets.length >= maxActive) {
      return;
    }

    const group = ns.foodGroupsEmoji.pickRandomGroup();
    const currentQuest = this.questManager && this.questManager.getCurrent
      ? this.questManager.getCurrent()
      : null;
    const isQuestTarget = currentQuest && currentQuest.groupId === group.id;

    const el = document.createElement('a-entity');

    const x = -1.6 + Math.random() * 3.2;
    const y = 1.0 + Math.random() * 1.4;
    const z = -3.0 + Math.random() * 0.8;

    el.setAttribute('geometry', 'primitive: circle; radius: 0.36; segments: 48');
    el.setAttribute(
      'material',
      `color: ${group.color}; shader: flat; opacity: 0.95; transparent: true`
    );
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-group-id', String(group.id));
    el.setAttribute('data-quest-target', isQuestTarget ? '1' : '0');

    if (group.img) {
      const sprite = document.createElement('a-image');
      sprite.setAttribute('src', group.img);
      sprite.setAttribute('width', '0.65');
      sprite.setAttribute('height', '0.65');
      sprite.setAttribute('position', '0 0 0.02');
      el.appendChild(sprite);
    }

    if (isQuestTarget) {
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '0.39');
      ring.setAttribute('radius-outer', '0.48');
      ring.setAttribute('color', '#facc15');
      ring.setAttribute('position', '0 0 0.01');
      el.appendChild(ring);
    }

    el.setAttribute(
      'animation__pop',
      'property: scale; from: 0.001 0.001 0.001; to: 1 1 1; dur: 180; easing: easeOutQuad'
    );

    const spawnTime = performance.now();
    el.__spawnTime = spawnTime;

    if (this.groupStats[group.id]) {
      this.groupStats[group.id].spawns++;
    }

    const self = this;

    el.addEventListener('click', function () {
      self.onHitTarget(el);
    });

    const lifetime = cfg.targetLifetime || 2200;
    el._hha_timeout = setTimeout(function () {
      if (el.__destroyed) return;
      el.__destroyed = true;
      self.onMissTarget(el);
    }, lifetime);

    this.sceneEl.appendChild(el);
    this._targets.push(el);

    logEvent('spawn', {
      groupId: group.id,
      isQuestTarget: !!isQuestTarget,
      pos: { x: x, y: y, z: z }
    });
  };

  FoodGroupsGame.prototype.safeRemoveTarget = function (el) {
    const idx = this._targets.indexOf(el);
    if (idx !== -1) this._targets.splice(idx, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  FoodGroupsGame.prototype.onHitTarget = function (el) {
    if (this.state !== 'playing' || !el || el.__destroyed) return;
    el.__destroyed = true;

    if (el._hha_timeout) {
      clearTimeout(el._hha_timeout);
      el._hha_timeout = null;
    }

    const groupId = parseInt(
      el.getAttribute('data-group-id') || (el.dataset && el.dataset.groupId) || '0',
      10
    ) || 0;
    const isQuestTarget = el.getAttribute('data-quest-target') === '1';

    const now = performance.now();
    const rt = el.__spawnTime ? (now - el.__spawnTime) : null;

    let bonus = 0;
    if (this.questManager) {
      const res = this.questManager.notifyHit(groupId);
      if (res && res.bonus) bonus += res.bonus;
    }

    const gained = 10 + bonus;
    this.score += gained;

    if (this.groupStats[groupId]) {
      this.groupStats[groupId].hits++;
    }

    if (ns.foodGroupsUI) {
      ns.foodGroupsUI.setScore(this.score);
      ns.foodGroupsUI.flashJudgment({
        scoreDelta: gained,
        isMiss: false,
        isQuestTarget: isQuestTarget
      });
    }

    if (ns.foodGroupsFx && typeof ns.foodGroupsFx.burst === 'function'
      && el.object3D && window.THREE) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      ns.foodGroupsFx.burst(wp);
    }

    logEvent('hit', {
      groupId: groupId,
      isQuestTarget: !!isQuestTarget,
      scoreDelta: gained,
      rtMs: rt
    });

    this.safeRemoveTarget(el);
  };

  FoodGroupsGame.prototype.onMissTarget = function (el) {
    if (this.state === 'playing') {
      this.score = Math.max(0, this.score - 3);
      if (ns.foodGroupsUI) {
        ns.foodGroupsUI.setScore(this.score);
        ns.foodGroupsUI.flashJudgment({
          isMiss: true,
          scoreDelta: 0,
          isQuestTarget: false,
          text: 'MISS'
        });
      }
    }

    const groupId = parseInt(
      el.getAttribute('data-group-id') || (el.dataset && el.dataset.groupId) || '0',
      10
    ) || 0;
    const now = performance.now();
    const rt = el.__spawnTime ? (now - el.__spawnTime) : null;

    logEvent('miss', {
      groupId: groupId,
      rtMs: rt
    });

    this.safeRemoveTarget(el);
  };

  // ----- ลงทะเบียน A-Frame component -----
  AFRAME.registerComponent('food-groups-game', {
    init: function () {
      this.game = new FoodGroupsGame(this.el.sceneEl);
      const self = this;

      this.el.sceneEl.addEventListener('fg-start', function (e) {
        const diff = (e.detail && e.detail.diff) || 'normal';
        self.game.start({ diff: diff });
      });

      this.el.sceneEl.addEventListener('fg-stop', function (e) {
        const reason = e.detail && e.detail.reason || 'stop';
        self.game.endGame(reason);
      });
    }
  });

  ns.FoodGroupsGame = FoodGroupsGame;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
