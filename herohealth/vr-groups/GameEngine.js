// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Stable Target Engine (PLAYABLE VERSION)

(function (root) {
  'use strict';

  const ns = root.GroupsVR = root.GroupsVR || {};

  const DIFF_TABLE = {
    easy: {
      spawnInterval: 1800,
      lifeTime: [3600, 4600],
      maxActive: 2,
      scale: 1.2
    },
    normal: {
      spawnInterval: 1300,
      lifeTime: [2600, 3200],
      maxActive: 3,
      scale: 1.0
    },
    hard: {
      spawnInterval: 900,
      lifeTime: [1800, 2200],
      maxActive: 4,
      scale: 0.9
    }
  };

  let layerEl = null;
  let active = [];
  let timerSpawn = null;
  let running = false;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function createTarget({ emoji, good }) {
    if (!layerEl) return;

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.dataset.emoji = emoji;

    const x = rand(15, 85);
    const y = rand(20, 65);
    el.style.left = x + '%';
    el.style.top = y + '%';

    layerEl.appendChild(el);
    active.push(el);

    let alive = true;
    const life = el._life;

    // === CLICK ===
    el.addEventListener('click', () => {
      if (!alive) return;
      alive = false;
      el.classList.add('hit');
      root.dispatchEvent(new CustomEvent('groups:hit', {
        detail: { emoji, good }
      }));
      setTimeout(() => el.remove(), 150);
    });

    // === EXPIRE ===
    setTimeout(() => {
      if (!alive) return;
      alive = false;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, life);
  }

  function spawnLoop(diff) {
    const cfg = DIFF_TABLE[diff];
    if (!cfg) return;

    timerSpawn = setInterval(() => {
      if (!running) return;
      if (active.length >= cfg.maxActive) return;

      const good = Math.random() > 0.35;
      const emoji = good
        ? ['🍗','🥩','🥦','🍎','🍚'][Math.floor(Math.random()*5)]
        : ['🧋','🍟','🍰'][Math.floor(Math.random()*3)];

      const el = document.createElement('div');
      el._life = rand(cfg.lifeTime[0], cfg.lifeTime[1]);

      createTarget({ emoji, good });
    }, cfg.spawnInterval);
  }

  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
    },

    start(diff = 'normal') {
      if (running) return;
      running = true;
      active = [];
      spawnLoop(diff);
    },

    stop() {
      running = false;
      clearInterval(timerSpawn);
      active.forEach(el => el.remove());
      active = [];
    }
  };

})(window);
