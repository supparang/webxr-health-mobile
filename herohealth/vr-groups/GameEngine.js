// vr-groups/GameEngine.js
(function (ns) {
  'use strict';

  const GAME_VERSION = 'GroupsVR_v1.0';

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

  // ---------- in-memory log ----------
  function logEvent(type, detail) {
    try {
      const arr = (window.HHA_FOODGROUPS_LOG = window.HHA_FOODGROUPS_LOG || []);
      arr.push(Object.assign({ ts: Date.now(), type }, detail));
    } catch (e) {
      // เงียบ ๆ ถ้า log พัง
    }
  }

  // ---------- main game ----------
  function FoodGroupsGame(sceneEl) {
    this.sceneEl = sceneEl;
    this.state   = 'idle';
    this.diff    = 'normal';

    this.cfg = ns.foodGroupsDifficulty
      ? ns.foodGroupsDifficulty.get('normal')
      : {
          spawnInterval: 1200,
          targetLifetime: 2200,
          maxActive: 5,
          duration: 60000,
          targetRadius: 0.5
        };

    this.score          = 0;
    this._targets       = [];
    this._spawnTimer    = null;
    this._gameTimer     = null;
    this._timeInterval  = null;
    this._startPerfTime = 0;
    this._startWallTime = 0;

    this.deviceType = detectDeviceType();
    this.session    = ns.foodGroupsSession || {};
    this.groupStats = {};
    this.resetGroupStats();

    // FX + UI
    if (ns.foodGroupsFx && ns.foodGroupsFx.init) {
      ns.foodGroupsFx.init(sceneEl);
    }
    if (ns.foodGroupsUI && ns.foodGroupsUI.attachScene) {
      ns.foodGroupsUI.attachScene(sceneEl);
    }

    const self = this;

    // Quest manager + HUD/Coach
    this.questManager = ns.FoodGroupsQuestManager
      ? new ns.FoodGroupsQuestManager(function (quest, progress, justFinished, finishedQuest) {
          const status =
            self.questManager && self.questManager.getStatus
              ? self.questManager.getStatus()
              : null;

          // โค้ช (bubble ล่าง)
          if (ns.foodGroupsCoach && ns.foodGroupsCoach.onQuestChange) {
            ns.foodGroupsCoach.onQuestChange({
              current: quest,
              progress: progress || 0,
              justFinished: !!justFinished,
              finished: finishedQuest || null,
              status
            });
          } else if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayQuest) {
            ns.foodGroupsCoach.sayQuest(quest, progress || 0);
          }

          // HUD ด้านบน (goal + progress)
          if (ns.foodGroupsQuestHUD && ns.foodGroupsQuestHUD.update) {
            ns.foodGroupsQuestHUD.update(status, quest, !!justFinished);
          }

          if (justFinished && finishedQuest && ns.foodGroupsAudio) {
            ns.foodGroupsAudio.playQuest();
          }
        })
      : null;
  }

  // ---------- helpers ----------
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

  // ---------- start / end ----------
  FoodGroupsGame.prototype.start = function (opts) {
    opts = opts || {};
    this.diff = opts.diff || 'normal';
    if (ns.foodGroupsDifficulty) {
      this.cfg = ns.foodGroupsDifficulty.get(this.diff);
    }

    // reset log
    window.HHA_FOODGROUPS_LOG = [];

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

    if (ns.foodGroupsQuestHUD && ns.foodGroupsQuestHUD.reset) {
      ns.foodGroupsQuestHUD.reset();
    }

    if (this.questManager) {
      this.questManager.reset();
    }
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayStart) {
      ns.foodGroupsCoach.sayStart();
    }

    const duration  = this.cfg.duration || 60000;
    const startPerf = performance.now();
    this._startPerfTime = startPerf;
    this._startWallTime = Date.now();

    const self = this;
    this._timeInterval = setInterval(function () {
      const elapsed = performance.now() - startPerf;
      const remain  = Math.max(0, duration - elapsed);
      if (ns.foodGroupsUI && ns.foodGroupsUI.setTime) {
        ns.foodGroupsUI.setTime(Math.ceil(remain / 1000));
      }
    }, 250);

    this._gameTimer = setTimeout(function () {
      self.endGame('timeout');
    }, duration);

    logEvent('start', {
      diff: this.diff,
      deviceType: this.deviceType,
      sessionId:   this.session.sessionId   || null,
      playerName:  this.session.playerName  || null,
      playerClass: this.session.playerClass || null
    });

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

    const questsCleared =
      this.questManager && this.questManager.getClearedCount
        ? this.questManager.getClearedCount()
        : 0;

    const endTime    = Date.now();
    const durationMs = endTime - (this._startWallTime || endTime);
    const status =
      this.questManager && this.questManager.getStatus
        ? this.questManager.getStatus()
        : { total: null };

    logEvent('end', {
      diff: this.diff,
      score: this.score,
      questsCleared: questsCleared,
      reason: reason || 'end'
    });

    // สรุป session สำหรับส่งขึ้น Cloud
    const sessionSummary = {
      mode: 'groups-vr',
      version: GAME_VERSION,
      diff: this.diff,
      deviceType: this.deviceType,
      score: this.score,
      questsCleared: questsCleared,
      questsTotal: status.total != null ? status.total : null,
      startedAt: this._startWallTime || null,
      endedAt: endTime,
      durationMs: durationMs,
      sessionId:   this.session.sessionId   || null,
      playerName:  this.session.playerName  || null,
      playerClass: this.session.playerClass || null,
      groupStats: this.groupStats
    };

    const events = (window.HHA_FOODGROUPS_LOG || []).slice();

    if (ns.foodGroupsCloudLogger && ns.foodGroupsCloudLogger.send) {
      ns.foodGroupsCloudLogger.send(sessionSummary, events);
    }

    this.sceneEl.emit('fg-game-over', {
      score: this.score,
      diff: this.diff,
      questsCleared: questsCleared,
      groupStats: this.groupStats
    });

    if (ns.foodGroupsQuestHUD && ns.foodGroupsQuestHUD.finish) {
      ns.foodGroupsQuestHUD.finish(status);
    }
  };

  // ---------- spawn loop ----------
  FoodGroupsGame.prototype.scheduleNextSpawn = function () {
    if (this.state !== 'playing') return;
    const self     = this;
    const interval = this.cfg.spawnInterval || 1200;

    this._spawnTimer = setTimeout(function () {
      self.spawnTarget();
      self.scheduleNextSpawn();
    }, interval);
  };

  // ---------- spawn target (emoji เป้าสวย ๆ) ----------
  FoodGroupsGame.prototype.spawnTarget = function () {
    if (this.state !== 'playing') return;

    const cfg       = this.cfg || {};
    const maxActive = cfg.maxActive || 5;

    if (this._targets.length >= maxActive) {
      return;
    }

    // เลือก group + emoji อย่างปลอดภัย
    let group = null;
    if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.pickRandomGroup) {
      group = ns.foodGroupsEmoji.pickRandomGroup();
    }
    if (!group) {
      console.warn('[GroupsGame] emoji module not ready, use fallback target');
      group = {
        id: 0,
        label: 'target',
        emoji: '🎯',
        color: '#22c55e',
        img: null
      };
    }

    const currentQuest =
      this.questManager && this.questManager.getCurrent
        ? this.questManager.getCurrent()
        : null;
    const isQuestTarget = currentQuest && currentQuest.groupId === group.id;

    const el = document.createElement('a-entity');

    // กระจายตำแหน่งกลางจอ
    const x = -1.2 + Math.random() * 2.4;
    const y = 0.9  + Math.random() * 1.0;
    const z = -2.8 + Math.random() * 0.6;

    const radius = cfg.targetRadius || 0.5;
    el.setAttribute('geometry', `primitive: circle; radius: ${radius}; segments: 64`);
    el.setAttribute(
      'material',
      `color: ${group.color || '#22c55e'}; shader: flat; opacity: 0.95; transparent: true`
    );
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-group-id', String(group.id));
    el.setAttribute('data-quest-target', isQuestTarget ? '1' : '0');
    el.setAttribute('data-emoji', group.emoji || '');
    el.setAttribute('data-is-good', '1'); // ตอนนี้ถือว่าทั้งหมดเป็นอาหารดี

    // แปะ emoji เป็นรูปภาพบนเป้า (เหมือน GoodJunk)
    if (group.img) {
      const sprite = document.createElement('a-image');
      sprite.setAttribute('src', group.img);
      sprite.setAttribute('width',  (radius * 2 * 1.1).toString());
      sprite.setAttribute('height', (radius * 2 * 1.1).toString());
      sprite.setAttribute('position', '0 0 0.03');
      el.appendChild(sprite);
    } else if (group.emoji) {
      // fallback ใช้ a-text ถ้าไม่มีรูป
      const label = document.createElement('a-text');
      label.setAttribute('value', group.emoji);
      label.setAttribute('align', 'center');
      label.setAttribute('anchor', 'center');
      label.setAttribute('color', '#ffffff');
      label.setAttribute('width', '2.5');
      label.setAttribute('position', '0 0 0.03');
      el.appendChild(label);
    }

    // วงแหวน highlight ถ้าเป็นเป้าภารกิจ
    if (isQuestTarget) {
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', (radius + 0.05).toString());
      ring.setAttribute('radius-outer', (radius + 0.13).toString());
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
      emoji:   group.emoji || '',
      isQuestTarget: !!isQuestTarget,
      pos: { x, y, z }
    });
  };

  // ---------- helpers for hit / miss ----------
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

    const groupId =
      parseInt(
        el.getAttribute('data-group-id') ||
          (el.dataset && el.dataset.groupId) ||
          '0',
        10
      ) || 0;
    const isQuestTarget = el.getAttribute('data-quest-target') === '1';
    const emoji   = el.getAttribute('data-emoji') || '';
    const isGood  = el.getAttribute('data-is-good') !== '0';

    const now = performance.now();
    const rt  = el.__spawnTime ? now - el.__spawnTime : null;

    let bonus = 0;
    if (this.questManager) {
      const res = this.questManager.notifyHit(groupId);
      if (res && res.bonus) bonus += res.bonus;
    }

    const gained = 10 + bonus;
    this.score  += gained;

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

    let worldPos = null;
    if (el.object3D && window.THREE) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      worldPos = { x: wp.x, y: wp.y, z: wp.z };
    }

    if (
      ns.foodGroupsFx &&
      typeof ns.foodGroupsFx.burst === 'function' &&
      el.object3D &&
      window.THREE
    ) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      ns.foodGroupsFx.burst(wp);
    }

    if (ns.foodGroupsAudio) {
      ns.foodGroupsAudio.playHit();
    }

    logEvent('hit', {
      groupId,
      emoji,
      isGood,
      isQuestTarget: !!isQuestTarget,
      scoreDelta: gained,
      rtMs: rt,
      pos: worldPos,
      judgment: bonus > 0 ? 'quest' : 'normal'
    });

    this.safeRemoveTarget(el);
  };

  FoodGroupsGame.prototype.onMissTarget = function (el) {
    if (this.state === 'playing') {
      if (this.diff === 'easy') {
        if (ns.foodGroupsUI) {
          ns.foodGroupsUI.setScore(this.score);
          ns.foodGroupsUI.flashJudgment({
            isMiss: true,
            scoreDelta: 0,
            isQuestTarget: false,
            text: 'ลองใหม่อีกที 😊'
          });
        }
      } else {
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

      if (ns.foodGroupsAudio) {
        ns.foodGroupsAudio.playMiss();
      }
    }

    const groupId =
      parseInt(
        el.getAttribute('data-group-id') ||
          (el.dataset && el.dataset.groupId) ||
          '0',
        10
      ) || 0;
    const emoji  = el.getAttribute('data-emoji') || '';
    const isGood = el.getAttribute('data-is-good') !== '0';

    const now = performance.now();
    const rt  = el.__spawnTime ? now - el.__spawnTime : null;

    let worldPos = null;
    if (el.object3D && window.THREE) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      worldPos = { x: wp.x, y: wp.y, z: wp.z };
    }

    logEvent('miss', {
      groupId,
      emoji,
      isGood,
      rtMs: rt,
      pos: worldPos
    });

    this.safeRemoveTarget(el);
  };

  // ---------- A-Frame component ----------
  AFRAME.registerComponent('food-groups-game', {
    init: function () {
      this.game = new ns.FoodGroupsGame(this.el.sceneEl);
      const self = this;

      this.el.sceneEl.addEventListener('fg-start', function (e) {
        const diff = (e.detail && e.detail.diff) || 'normal';
        self.game.start({ diff });
      });

      this.el.sceneEl.addEventListener('fg-stop', function (e) {
        const reason = (e.detail && e.detail.reason) || 'stop';
        self.game.endGame(reason);
      });
    }
  });

  ns.FoodGroupsGame = FoodGroupsGame;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));