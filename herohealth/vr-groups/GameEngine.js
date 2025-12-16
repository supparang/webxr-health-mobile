// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — NO-FLASH SAFE ENGINE
// เป้าไม่แว๊บ, ไม่หายเอง, ลบได้แค่ hit หรือ expire หลังเวลาเท่านั้น

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const active = [];

  let layerEl = null;
  let running = false;
  let spawnTimer = null;

  // ===== DEFAULT CONFIG =====
  let CFG = {
    spawnInterval: 1400,
    maxActive: 3,
    minVisible: 2200,
    lifeTime: [3200, 4200],
    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🥦','🥕','🍎'],
    emojisJunk: ['🧋','🍟','🍩']
  };

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;

    // ❗ ห้ามลบก่อนเวลา (ยกเว้น hit)
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    t.el.classList.add('hit');
    setTimeout(() => {
      if (t.el && t.el.parentNode) t.el.remove();
    }, 200);
  }

  function createTarget() {
    if (!running) return;
    if (active.length >= CFG.maxActive) return;

    const good = Math.random() < 0.75;
    const emoji = good
      ? CFG.emojisGood[rand(0, CFG.emojisGood.length - 1)]
      : CFG.emojisJunk[rand(0, CFG.emojisJunk.length - 1)];

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.dataset.emoji = emoji;

    el.style.left = rand(20, 80) + '%';
    el.style.top  = rand(25, 65) + '%';

    layerEl.appendChild(el);

    const t = {
      el,
      good,
      alive: true,
      canExpire: false,
      minTimer: null,
      lifeTimer: null
    };

    active.push(t);

    // ===== MIN VISIBLE LOCK =====
    t.minTimer = setTimeout(() => {
      t.canExpire = true;
    }, CFG.minVisible);

    // ===== HARD EXPIRE =====
    const life = rand(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      destroyTarget(t, false);
    }, life);

    // ===== HIT =====
    el.addEventListener('click', () => {
      destroyTarget(t, true);
      window.dispatchEvent(new CustomEvent('groups:hit', {
        detail: { emoji, good }
      }));
    });
  }

  function spawnLoop() {
    spawnTimer = setInterval(() => {
      createTarget();
    }, CFG.spawnInterval);
  }

  function stopAll() {
    running = false;
    clearInterval(spawnTimer);
    spawnTimer = null;

    active.slice().forEach(t => {
      destroyTarget(t, true);
    });
    active.length = 0;
  }

  // ===== PUBLIC API =====
  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
    },

    start(diff = 'easy') {
      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      // ===== DIFFICULTY =====
      if (diff === 'easy') {
        CFG.spawnInterval = 1400;
        CFG.maxActive = 3;
        CFG.minVisible = 2200;
        CFG.lifeTime = [3200, 4200];
      } else if (diff === 'normal') {
        CFG.spawnInterval = 1000;
        CFG.maxActive = 4;
        CFG.minVisible = 1400;
        CFG.lifeTime = [2400, 3400];
      } else {
        CFG.spawnInterval = 750;
        CFG.maxActive = 5;
        CFG.minVisible = 900;
        CFG.lifeTime = [1800, 2600];
      }

      running = true;
      spawnLoop();
    },

    stop() {
      stopAll();
    }
  };
})();
