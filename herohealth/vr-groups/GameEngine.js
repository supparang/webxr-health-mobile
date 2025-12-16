// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — NO-FLASH SAFE ENGINE (v2)
// ✅ เป้าไม่แว๊บ: มี minVisible lock + expire หลังเวลาเท่านั้น
// ✅ ตีได้ 100%: รองรับ pointerdown + touchstart + mousedown + click
// ✅ ใช้ได้ทั้งมือถือ/PC (เลเยอร์ DOM)
// API: window.GroupsVR.GameEngine.start(diff, { layerEl?, config? }), stop(), setLayerEl()

(function () {
  'use strict';

  const ns = (window.GroupsVR = window.GroupsVR || {});
  const active = [];

  let layerEl = null;
  let running = false;
  let spawnTimer = null;

  // ===== DEFAULT CONFIG =====
  const CFG = {
    spawnInterval: 1200,
    maxActive: 3,
    minVisible: 2200,
    lifeTime: [4200, 5600],

    emojisGood: ['🍗','🥩','🐟','🍳','🥛','🧀','🥦','🥕','🍎','🍌','🍚'],
    emojisJunk: ['🧋','🍟','🍩','🍔','🍕']
  };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(v, a, b) {
    return v < a ? a : (v > b ? b : v);
  }

  function removeFromActive(t) {
    const i = active.indexOf(t);
    if (i >= 0) active.splice(i, 1);
  }

  function bindHit(el, handler) {
    const on = (ev) => {
      try { ev.preventDefault(); } catch {}
      try { ev.stopPropagation(); } catch {}
      handler(ev);
      return false;
    };

    el.addEventListener('pointerdown', on, { passive: false });
    el.addEventListener('touchstart',  on, { passive: false });
    el.addEventListener('mousedown',   on);
    el.addEventListener('click',       on);
  }

  function destroyTarget(t, isHit) {
    if (!t || !t.alive) return;

    // ❗ห้ามลบก่อนเวลา (ยกเว้น hit)
    if (!isHit && !t.canExpire) return;

    t.alive = false;
    clearTimeout(t.minTimer);
    clearTimeout(t.lifeTimer);

    removeFromActive(t);

    // ทำแอนิเมชันสั้น ๆ แล้วค่อยลบ
    if (t.el) {
      t.el.classList.add('hit');
      setTimeout(() => {
        if (t.el && t.el.parentNode) t.el.remove();
      }, 180);
    }
  }

  function pickEmoji(good) {
    const arr = good ? CFG.emojisGood : CFG.emojisJunk;
    return arr[randInt(0, arr.length - 1)];
  }

  function pickScreenPos() {
    // กันชนขอบจอ + กันทับ HUD ด้านบน/ล่าง (ปรับได้)
    const w = Math.max(320, window.innerWidth || 320);
    const h = Math.max(480, window.innerHeight || 480);

    const marginX = Math.min(160, Math.round(w * 0.16));
    const marginYTop = Math.min(220, Math.round(h * 0.22));  // กันแถบ HUD
    const marginYBot = Math.min(160, Math.round(h * 0.18));  // กันแถบล่าง

    const x = randInt(marginX, w - marginX);
    const y = randInt(marginYTop, h - marginYBot);

    return { x, y };
  }

  function createTarget() {
    if (!running || !layerEl) return;
    if (active.length >= CFG.maxActive) return;

    const good = Math.random() < 0.75;
    const emoji = pickEmoji(good);

    const el = document.createElement('div');
    el.className = 'fg-target ' + (good ? 'fg-good' : 'fg-junk');
    el.setAttribute('data-emoji', emoji);

    const p = pickScreenPos();
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';

    layerEl.appendChild(el);

    const t = {
      el,
      good,
      emoji,
      alive: true,
      canExpire: false,
      bornAt: performance.now(),
      minTimer: null,
      lifeTimer: null
    };

    active.push(t);

    // ===== MIN VISIBLE LOCK =====
    t.minTimer = setTimeout(() => {
      t.canExpire = true;
    }, CFG.minVisible);

    // ===== HARD EXPIRE =====
    const life = randInt(CFG.lifeTime[0], CFG.lifeTime[1]);
    t.lifeTimer = setTimeout(() => {
      // expire ได้เมื่อพ้น minVisible เท่านั้น
      destroyTarget(t, false);
      if (t.canExpire) {
        window.dispatchEvent(new CustomEvent('groups:expire', {
          detail: { emoji: t.emoji, good: t.good }
        }));
      } else {
        // ถ้า lifeTimer มาก่อน minVisible (กันไว้) → รอให้ครบแล้วค่อยลบ
        setTimeout(() => destroyTarget(t, false), Math.max(0, CFG.minVisible - (performance.now() - t.bornAt)));
      }
    }, life);

    // ===== HIT =====
    bindHit(el, () => {
      if (!t.alive) return;
      destroyTarget(t, true);
      window.dispatchEvent(new CustomEvent('groups:hit', {
        detail: { emoji, good }
      }));
    });
  }

  function scheduleNextSpawn() {
    if (!running) return;
    clearTimeout(spawnTimer);

    spawnTimer = setTimeout(() => {
      createTarget();
      scheduleNextSpawn();
    }, CFG.spawnInterval);
  }

  function stopAll() {
    running = false;
    clearTimeout(spawnTimer);
    spawnTimer = null;

    // ลบเป้าทั้งหมดทันที (ถือว่า hit เพื่อผ่าน canExpire)
    active.slice().forEach(t => destroyTarget(t, true));
    active.length = 0;
  }

  function applyDifficulty(diff) {
    diff = String(diff || 'easy').toLowerCase();

    if (diff === 'easy') {
      CFG.spawnInterval = 1200;
      CFG.maxActive = 3;
      CFG.minVisible = 2600;
      CFG.lifeTime = [4800, 6500];
    } else if (diff === 'normal') {
      CFG.spawnInterval = 900;
      CFG.maxActive = 4;
      CFG.minVisible = 2000;
      CFG.lifeTime = [3800, 5200];
    } else { // hard
      CFG.spawnInterval = 750;
      CFG.maxActive = 5;
      CFG.minVisible = 1600;
      CFG.lifeTime = [3200, 4600];
    }
  }

  // ===== PUBLIC API =====
  ns.GameEngine = {
    setLayerEl(el) {
      layerEl = el;
    },

    start(diff = 'easy', opts = {}) {
      layerEl = (opts && opts.layerEl) ? opts.layerEl : layerEl;

      if (!layerEl) {
        console.error('[FoodGroupsVR] layerEl missing');
        return;
      }

      // custom config override
      if (opts && opts.config) {
        Object.assign(CFG, opts.config);
      }

      applyDifficulty(diff);

      running = true;
      scheduleNextSpawn();
      // spawn แรกทันที
      createTarget();
    },

    stop() {
      stopAll();
    }
  };
})();
