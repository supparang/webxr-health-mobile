// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine + Quest + Cloud Logger + Research Stats
// 2025-12-05

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

  // ---------- scoring helpers ----------
  function baseScoreForDiff(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy':   return 8;
      case 'hard':   return 12;
      case 'normal':
      default:       return 10;
    }
  }

  function missPenaltyForDiff(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy':   return 0;
      case 'hard':   return 5;
      case 'normal':
      default:       return 3;
    }
  }

  function classifyJudgment(rtMs) {
    if (rtMs == null) return 'normal';
    if (rtMs < 350)   return 'perfect';
    if (rtMs < 800)   return 'good';
    if (rtMs < 1300)  return 'late';
    return 'slow';
  }

  // ---------- in-memory log ----------
  function logEvent(type, detail) {
    try {
      const arr = (window.HHA_FOODGROUPS_LOG = window.HHA_FOODGROUPS_LOG || []);
      const payload = Object.assign({ ts: Date.now(), type }, detail);
      // ผูก diff ปัจจุบันเข้าไปใน log ด้วย
      if (ns && ns.FoodGroupsGame && ns.FoodGroupsGame.currentDiff && !payload.diff) {
        payload.diff = ns.FoodGroupsGame.currentDiff;
      }
      arr.push(payload);
    } catch (e) {
      // เงียบถ้า log พัง
    }
  }

  // ---------- meta กลุ่มอาหาร (ใช้เก็บ stats ต่อหมู่) ----------
  const GROUP_META = {
    1: { id: 1, label: 'หมู่ 1 ข้าว-แป้ง',          emoji: '🍚', isGood: true },
    2: { id: 2, label: 'หมู่ 2 ผัก',                emoji: '🥬', isGood: true },
    3: { id: 3, label: 'หมู่ 3 ผลไม้',              emoji: '🍉', isGood: true },
    4: { id: 4, label: 'หมู่ 4 เนื้อสัตว์/โปรตีน',  emoji: '🍗', isGood: true },
    5: { id: 5, label: 'หมู่ 5 นม',                 emoji: '🥛', isGood: true },
    9: { id: 9, label: 'อาหารควรลด',                emoji: '🍟', isGood: false }
  };

  // ---------- main game ----------
  function FoodGroupsGame(sceneEl) {
    this.sceneEl = sceneEl;
    this.state   = 'idle';
    this.diff    = 'normal';

    this.cfg = ns.foodGroupsDifficulty
      ? ns.foodGroupsDifficulty.get('normal')
      : {
          spawnInterval: 1200,
          fallSpeed: 0.012,
          targetRadius: 0.5,
          maxActive: 5,
          duration: 60000
        };

    this.score          = 0;
    this._targets       = [];
    this._spawnTimer    = null;
    this._gameTimer     = null;
    this._timeInterval  = null;
    this._startWallTime = 0;

    this.deviceType = detectDeviceType();
    this.session    = ns.foodGroupsSession || {};
    this.groupStats = {};
    this.resetGroupStats();

    // ค่า diff ปัจจุบันสำหรับ logEvent
    FoodGroupsGame.currentDiff = this.diff;

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

          // HUD ด้านบน (goal + mini progress)
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
    Object.keys(GROUP_META).forEach(key => {
      const m = GROUP_META[key];
      this.groupStats[m.id] = {
        id: m.id,
        label: m.label,
        emoji: m.emoji,
        isGood: !!m.isGood,
        spawns: 0,
        hits: 0,
        goodHits: 0,
        badHits: 0
      };
    });
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
    this._targets.forEach(t => {
      if (t && t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
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

    FoodGroupsGame.currentDiff = this.diff;

    // แจ้งโค้ชเรื่องระดับความยาก
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.setDifficulty) {
      ns.foodGroupsCoach.setDifficulty(this.diff);
    }

    // reset log
    window.HHA_FOODGROUPS_LOG = [];

    this.state = 'playing';
    this.score = 0;
    this.clearTimers();
    this.removeAllTargets();
    this.resetGroupStats();

    // UI
    if (ns.foodGroupsUI) {
      ns.foodGroupsUI.init && ns.foodGroupsUI.init();
      ns.foodGroupsUI.show && ns.foodGroupsUI.show();
      ns.foodGroupsUI.reset && ns.foodGroupsUI.reset();
      if (ns.foodGroupsEmoji && ns.foodGroupsEmoji.all && ns.foodGroupsUI.setLegend) {
        ns.foodGroupsUI.setLegend(ns.foodGroupsEmoji.all);
      }
    }

    if (ns.foodGroupsQuestHUD && ns.foodGroupsQuestHUD.reset) {
      ns.foodGroupsQuestHUD.reset();
    }

    if (this.questManager && this.questManager.reset) {
      this.questManager.reset(this.diff);
    }

    if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayStart) {
      ns.foodGroupsCoach.sayStart();
    }

    const duration = this.cfg.duration || 60000;
    this._startWallTime = Date.now();
    const startWall = this._startWallTime;

    const self = this;
    this._timeInterval = setInterval(function () {
      const now    = Date.now();
      const remain = Math.max(0, duration - (now - startWall));
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

    if (ns.foodGroupsUI && ns.foodGroupsUI.hide) ns.foodGroupsUI.hide();

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

    // ให้โค้ชสรุปตอนจบ (รู้ diff + ภารกิจ)
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayFinish) {
      ns.foodGroupsCoach.sayFinish({
        score: this.score,
        diff: this.diff,
        questsCleared: questsCleared,
        questsTotal: status.total != null ? status.total : null
      });
    }

    logEvent('end', {
      diff: this.diff,
      score: this.score,
      questsCleared: questsCleared,
      reason: reason || 'end'
    });

    // รวมสถิติกลุ่มสำหรับ sessionSummary
    const statsArr = Object.values(this.groupStats || {});
    const totalSpawns   = statsArr.reduce((s, g) => s + (g.spawns   || 0), 0);
    const totalHits     = statsArr.reduce((s, g) => s + (g.hits     || 0), 0);
    const totalGoodHits = statsArr.reduce((s, g) => s + (g.goodHits || 0), 0);
    const totalBadHits  = statsArr.reduce((s, g) => s + (g.badHits  || 0), 0);

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
      groupStats: this.groupStats,
      totalSpawns,
      totalHits,
      totalGoodHits,
      totalBadHits
    };

    const events = (window.HHA_FOODGROUPS_LOG || []).slice();

    if (ns.foodGroupsCloudLogger && ns.foodGroupsCloudLogger.send) {
      ns.foodGroupsCloudLogger.send(sessionSummary, events);
    }

    this.sceneEl.emit('fg-game-over', {
      score: this.score,
      diff: this.diff,
      questsCleared: questsCleared,
      questsTotal: status.total != null ? status.total : null,
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
    const interval = this.cfg.spawnInterval || this.cfg.SPAWN_INTERVAL || 1200;

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

    // limit active
    if (this._targets.length >= maxActive) return;

    // เลือก emoji จาก emoji-image.js
    let item = null;
    if (ns.foodGroupsEmoji && typeof ns.foodGroupsEmoji.pickRandom === 'function') {
      item = ns.foodGroupsEmoji.pickRandom();
    }
    if (!item) {
      console.warn('[GroupsVR] emoji module not ready, fallback 🎯');
      item = { emoji: '🎯', group: 0, isGood: true, url: null };
    }

    const groupId = item.group || 0;
    const isGood  = !!item.isGood;

    // ข้อมูล quest ปัจจุบัน
    const currentQuest =
      this.questManager && this.questManager.getCurrent
        ? this.questManager.getCurrent()
        : null;
    const isQuestTarget = currentQuest && currentQuest.groupId === groupId;

    const el = document.createElement('a-entity');

    // สุ่มตำแหน่งบริเวณกลาง ๆ จอ
    const x = -1.2 + Math.random() * 2.4;
    const y = 1.4  + Math.random() * 0.4;
    const z = -2.6 + Math.random() * 0.4;

    const radius = cfg.targetRadius || 0.5;
    el.setAttribute('geometry', `primitive: circle; radius: ${radius}; segments: 64`);
    el.setAttribute(
      'material',
      `color: ${isGood ? '#22c55e' : '#f97316'}; shader: flat; opacity: 0.9; transparent: true`
    );
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('data-hha-tgt', '1');
    el.setAttribute('data-group-id', String(groupId));
    el.setAttribute('data-quest-target', isQuestTarget ? '1' : '0');
    el.setAttribute('data-emoji', item.emoji || '');
    el.setAttribute('data-is-good', isGood ? '1' : '0');

    // แปะ emoji เป็นรูปภาพบนเป้า (ใช้ texture url จาก emoji-image.js)
    if (item.url) {
      const sprite = document.createElement('a-image');
      sprite.setAttribute('src', item.url);
      sprite.setAttribute('width',  (radius * 2 * 1.1).toString());
      sprite.setAttribute('height', (radius * 2 * 1.1).toString());
      sprite.setAttribute('position', '0 0 0.03');
      el.appendChild(sprite);
    } else if (item.emoji) {
      const label = document.createElement('a-text');
      label.setAttribute('value', item.emoji);
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

    // เก็บเวลาที่ spawn เพื่อคำนวณ RT
    const spawnTime = performance.now();
    el.__spawnTime  = spawnTime;

    // สำหรับให้ตกลง (ตาม fallSpeed)
    const fallSpeed = cfg.fallSpeed || 0;
    const info = {
      el,
      groupId,
      isGood,
      fallSpeed,
      ttl: cfg.targetLifetime || 2200
    };

    if (this.groupStats[groupId]) {
      this.groupStats[groupId].spawns++;
    }

    const self = this;

    el.addEventListener('click', function () {
      self.onHitTarget(info);
    });

    // timeout ถ้ายังไม่ได้ยิง
    const lifetime = cfg.targetLifetime || 2200;
    el._hha_timeout = setTimeout(function () {
      if (el.__destroyed) return;
      el.__destroyed = true;
      self.onMissTarget(info);
    }, lifetime);

    this.sceneEl.appendChild(el);
    this._targets.push(info);

    logEvent('spawn', {
      groupId,
      emoji:   item.emoji || '',
      isGood,
      isQuestTarget: !!isQuestTarget,
      pos: { x, y, z }
    });
  };

  // อัปเดตการเคลื่อนที่ของเป้า (ตกลงเล็กน้อย)
  FoodGroupsGame.prototype.updateTargets = function (dt) {
    if (!this._targets || !this._targets.length) return;
    const deltaSec = dt / 1000;

    for (let i = this._targets.length - 1; i >= 0; i--) {
      const t  = this._targets[i];
      const el = t.el;
      if (!el || !el.object3D) continue;

      // move down
      if (t.fallSpeed) {
        const p = el.object3D.position;
        p.y -= t.fallSpeed * deltaSec;
      }
    }
  };

  // ---------- helpers for hit / miss ----------
  FoodGroupsGame.prototype.safeRemoveTarget = function (info) {
    const el = info.el;
    const idx = this._targets.indexOf(info);
    if (idx !== -1) this._targets.splice(idx, 1);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  FoodGroupsGame.prototype.onHitTarget = function (info) {
    const el = info.el;
    if (this.state !== 'playing' || !el || el.__destroyed) return;
    el.__destroyed = true;

    if (el._hha_timeout) {
      clearTimeout(el._hha_timeout);
      el._hha_timeout = null;
    }

    const groupId = info.groupId || 0;
    const isGood  = info.isGood;
    const isQuestTarget = el.getAttribute('data-quest-target') === '1';
    const emoji   = el.getAttribute('data-emoji') || '';

    const now = performance.now();
    const rt  = el.__spawnTime ? now - el.__spawnTime : null;

    const baseScore = baseScoreForDiff(this.diff);
    let bonus = 0;

    if (this.questManager && this.questManager.notifyHit) {
      const res = this.questManager.notifyHit(groupId);
      if (res && res.bonus) bonus += res.bonus;
    }
    if (isQuestTarget) bonus += 5;

    let gained = baseScore + bonus;

    // ถ้าเป็นอาหารควรลด → หักคะแนนเบา ๆ
    if (!isGood) {
      const penalty = Math.max(1, Math.round(missPenaltyForDiff(this.diff) / 2));
      gained = -penalty;
    }

    this.score = Math.max(0, this.score + gained);

    const gs = this.groupStats[groupId];
    if (gs) {
      gs.hits++;
      if (isGood) gs.goodHits++;
      else        gs.badHits++;
    }

    const judgment = classifyJudgment(rt);

    if (ns.foodGroupsUI) {
      ns.foodGroupsUI.setScore && ns.foodGroupsUI.setScore(this.score);
      ns.foodGroupsUI.flashJudgment && ns.foodGroupsUI.flashJudgment({
        scoreDelta: gained,
        isMiss: false,
        isQuestTarget: isQuestTarget,
        judgment,
        isGood
      });
    }

    // ให้โค้ชรีแอคเวลายิงโดน
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.onHit) {
      ns.foodGroupsCoach.onHit({
        groupId,
        emoji,
        isGood,
        isQuestTarget,
        scoreDelta: gained,
        rtMs: rt,
        judgment
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

    if (ns.foodGroupsAudio && ns.foodGroupsAudio.playHit) {
      ns.foodGroupsAudio.playHit();
    }

    logEvent('hit', {
      groupId,
      emoji,
      isGood,
      isQuestTarget: !!isQuestTarget,
      baseScore,
      bonus,
      scoreDelta: gained,
      rtMs: rt,
      pos: worldPos,
      judgment
    });

    this.safeRemoveTarget(info);
  };

  FoodGroupsGame.prototype.onMissTarget = function (info) {
    const el = info.el;
    const penalty = missPenaltyForDiff(this.diff);

    if (this.state === 'playing') {
      if (this.diff === 'easy') {
        if (ns.foodGroupsUI) {
          ns.foodGroupsUI.setScore && ns.foodGroupsUI.setScore(this.score);
          ns.foodGroupsUI.flashJudgment && ns.foodGroupsUI.flashJudgment({
            isMiss: true,
            scoreDelta: 0,
            isQuestTarget: false,
            text: 'ลองใหม่อีกที 😊'
          });
        }
      } else {
        this.score = Math.max(0, this.score - penalty);
        if (ns.foodGroupsUI) {
          ns.foodGroupsUI.setScore && ns.foodGroupsUI.setScore(this.score);
          ns.foodGroupsUI.flashJudgment && ns.foodGroupsUI.flashJudgment({
            isMiss: true,
            scoreDelta: -penalty,
            isQuestTarget: false,
            text: 'MISS'
          });
        }
      }

      if (ns.foodGroupsAudio && ns.foodGroupsAudio.playMiss) {
        ns.foodGroupsAudio.playMiss();
      }
    }

    const groupId = info.groupId || 0;
    const emoji   = el.getAttribute('data-emoji') || '';
    const isGood  = info.isGood;

    const now = performance.now();
    const rt  = el.__spawnTime ? now - el.__spawnTime : null;

    const isQuestTarget = el.getAttribute('data-quest-target') === '1';

    // ให้โค้ชรู้ว่าพลาด
    if (ns.foodGroupsCoach && ns.foodGroupsCoach.onMiss) {
      ns.foodGroupsCoach.onMiss({
        groupId,
        emoji,
        isGood,
        rtMs: rt
      });
    }

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
      isQuestTarget,
      rtMs: rt,
      pos: worldPos
    });

    this.safeRemoveTarget(info);
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
    },
    tick: function (time, dt) {
      if (this.game && this.game.state === 'playing') {
        this.game.updateTargets(dt);
      }
    }
  });

  ns.FoodGroupsGame = FoodGroupsGame;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));