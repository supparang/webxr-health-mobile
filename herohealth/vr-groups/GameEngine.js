// vr-goodjunk/GameEngine.js
(function (ns) {
  'use strict';

  function FoodGroupsGame(sceneEl) {
    this.sceneEl = sceneEl;
    this.state = 'idle';
    this.diff = 'easy';
    this.cfg = ns.foodGroupsDifficultyFoodGroupsGame
      ? ns.foodGroupsDifficulty.get('easy')
      : { spawnInterval: 1200, speed: 1, duration: 60000 };

    this.score = 0;
    this._targets = [];
    this._spawnTimer = null;
    this._gameTimer = null;
    this._timeInterval = null;
    this._startTime = 0;

    if (ns.foodGroupsFx && ns.foodGroupsFx.init) {
      ns.foodGroupsFx.init(sceneEl);
    }

    const self = this;
    this.questManager = ns.FoodGroupsQuestManager
      ? new ns.FoodGroupsQuestManager(function (quest, progress, justFinished, finishedQuest) {
          if (ns.foodGroupsCoach && ns.foodGroupsCoach.sayQuest) {
            ns.foodGroupsCoach.sayQuest(quest || finishedQuest || null, progress || 0);
          } else if (ns.foodGroupsUI && ns.foodGroupsUI.setQuest) {
            if (quest) {
              ns.foodGroupsUI.setQuest(
                `หมู่ ${quest.groupId} ให้ครบ ${quest.targetCount} ชิ้น (${progress}/${quest.targetCount})`
              );
            } else {
              ns.foodGroupsUI.setQuest('เคลียร์ภารกิจครบแล้ว 🎉');
            }
          }
        })
      : null;
  }

  FoodGroupsGame.prototype.clearTimers = function () {
    if (this._spawnTimer) { clearTimeout(this._spawnTimer); this._spawnTimer = null; }
    if (this._gameTimer) { clearTimeout(this._gameTimer); this._gameTimer = null; }
    if (this._timeInterval) { clearInterval(this._timeInterval); this._timeInterval = null; }
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

  // ✅ โชว์ HUD + reset ข้อความ
  if (ns.foodGroupsUI) {
    ns.foodGroupsUI.init && ns.foodGroupsUI.init();
    ns.foodGroupsUI.show();
    ns.foodGroupsUI.reset();
  }

  // ✅ reset ภารกิจ + ให้โค้ชบอก mission แรก
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
    self.endGame();
  }, duration);

  this.scheduleNextSpawn();
};

  FoodGroupsGame.prototype.endGame = function () {
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

    this.sceneEl.emit('fg-game-over', {
      score: this.score,
      diff: this.diff,
      questsCleared: questsCleared
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

  // ถ้าเป้าบนจอเยอะแล้ว ยังไม่ต้องออกเพิ่ม
  if (this._targets.length >= maxActive) {
    return;
  }

  const group = ns.foodGroupsEmoji.pickRandomGroup();
  const el = document.createElement('a-entity');

  // กระจายทั่วจอ — โซนด้านหน้า
  // x: ซ้าย-ขวา, y: สูง-ต่ำ, z: ระยะห่าง
  const x = -1.6 + Math.random() * 3.2;   // ประมาณ -1.6 ถึง 1.6
  const y = 1.0 + Math.random() * 1.4;    // 1.0 ถึง 2.4 (ระดับหัว/อก)
  const z = -3.2 + Math.random() * 0.8;   // ห่างประมาณ -3 ถึง -2.4

  // วงกลมพื้นหลังของเป้า
  el.setAttribute('geometry', 'primitive: circle; radius: 0.36; segments: 48');
  el.setAttribute(
    'material',
    `color: ${group.color}; shader: flat; opacity: 0.95; transparent: true`
  );
  el.setAttribute('position', `${x} ${y} ${z}`);
  el.setAttribute('data-hha-tgt', '1');
  el.setAttribute('data-group-id', String(group.id));

  // emoji น่ารัก ๆ ใช้เป็นรูป PNG วางด้านหน้า
  if (group.img) {
    const sprite = document.createElement('a-image');
    sprite.setAttribute('src', group.img);
    sprite.setAttribute('width', '0.65');
    sprite.setAttribute('height', '0.65');
    sprite.setAttribute('position', '0 0 0.02');
    el.appendChild(sprite);
  }

  // effect ปรากฏนิดหน่อย (scale เข้า)
  el.setAttribute('animation__pop',
    'property: scale; from: 0.001 0.001 0.001; to: 1 1 1; dur: 180; easing: easeOutQuad');

  const self = this;

  // ยิงโดน
  el.addEventListener('click', function () {
    self.onHitTarget(el);
  });

  // ตั้ง timer ให้เป้าหายไปเอง (miss) ถ้าไม่ได้ยิงทัน
  const lifetime = cfg.targetLifetime || 2200;
  el._hha_timeout = setTimeout(function () {
    if (el.__destroyed) return;
    el.__destroyed = true;
    self.onMissTarget(el);
  }, lifetime);

  this.sceneEl.appendChild(el);
  this._targets.push(el);
};


  FoodGroupsGame.prototype.safeRemoveTarget = function (el) {
    const idx = this._targets.indexOf(el);
    if (idx !== -1) this._targets.splice(idx, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  FoodGroupsGame.prototype.onHitTarget = function (el) {
    if (this.state !== 'playing' || !el || el.__destroyed) return;
    el.__destroyed = true;

    const groupId = parseInt(
      el.getAttribute('data-group-id') || el.dataset.groupId || '0',
      10
    ) || 0;

    let bonus = 0;
    if (this.questManager) {
      const res = this.questManager.notifyHit(groupId);
      if (res && res.bonus) bonus += res.bonus;
    }

    const gained = 10 + bonus;
    this.score += gained;
    if (ns.foodGroupsUI) ns.foodGroupsUI.setScore(this.score);

    if (ns.foodGroupsFx && typeof ns.foodGroupsFx.burst === 'function'
      && el.object3D && window.THREE) {
      const wp = new THREE.Vector3();
      el.object3D.getWorldPosition(wp);
      ns.foodGroupsFx.burst(wp);
    }

    this.safeRemoveTarget(el);
  };

  FoodGroupsGame.prototype.onMissTarget = function (el) {
    if (this.state === 'playing') {
      this.score = Math.max(0, this.score - 3);
      if (ns.foodGroupsUI) ns.foodGroupsUI.setScore(this.score);
    }
    this.safeRemoveTarget(el);
  };

  // ----- A-Frame component -----
AFRAME.registerComponent('food-groups-game', {
  init: function () {
    console.log('[food-groups-game] init');  // ⭐ ใส่ log test ได้เหมือนกัน

    this.game = new ns.FoodGroupsGame(this.el.sceneEl);

    const self = this;
    this.el.sceneEl.addEventListener('fg-start', function (e) {
      const diff = (e.detail && e.detail.diff) || 'normal';
      console.log('[food-groups-game] receive fg-start, diff =', diff); // ⭐ log
      self.game.start({ diff });
    });

    this.el.sceneEl.addEventListener('fg-stop', function () {
      self.game.endGame();
    });
  }
});

  ns.FoodGroupsGame = FoodGroupsGame;
})(window.GAME_MODULES);
