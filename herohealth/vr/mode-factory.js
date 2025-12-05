// === /herohealth/vr/mode-factory.js ===
// Generic emoji target engine สำหรับ GoodJunk / Hydration / Groups (PC / Mobile / VR)

'use strict';

// ----- พื้นที่ปลอดภัยให้เป้าโผล่แบบ responsive -----
// ใช้สัดส่วนของขนาดหน้าจอ เพื่อให้เป้าไม่ไปชน HUD ด้านบน / Fever bar ด้านล่าง
const SAFE_REGION = {
  topRatio:    0.22,  // 22% จากด้านบน (เว้นแถบ Water / Score / Title)
  bottomRatio: 0.82,  // 82% จากด้านล่าง (เว้น Fever bar / ปุ่ม)
  sideRatio:   0.08   // 8% จากซ้าย-ขวา (ไม่ชิดขอบเกินไป)
};

const DEFAULTS = {
  duration:      60,
  baseInterval:  900,   // ms
  itemLifetime:  2200,  // ms
  maxActive:     4,
  goodRate:      0.6,
  powerRate:     0.08,
  powerEvery:    7,
  spawnStyle:    'pop'
};

function $(sel) {
  return document.querySelector(sel);
}
function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

// ----- random position แบบ responsive -----
function randomScreenPos() {
  const w = window.innerWidth  || 1280;
  const h = window.innerHeight || 720;

  const top    = h * SAFE_REGION.topRatio;
  const bottom = h * SAFE_REGION.bottomRatio;
  const left   = w * SAFE_REGION.sideRatio;
  const right  = w * (1 - SAFE_REGION.sideRatio);

  const x = left + Math.random() * (right - left);
  const y = top  + Math.random() * (bottom - top);

  return { x, y };
}

// สุ่มจาก array
function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[(Math.random() * arr.length) | 0];
}

// นับ active target ใน layer
function countActive(layer) {
  return layer.querySelectorAll('.hha-target').length;
}

// สร้าง layer กลางจอไว้ใส่เป้า
function ensureLayer() {
  let layer = $('.hha-target-layer');
  if (!layer) {
    layer = createEl('div', 'hha-target-layer');
    document.body.appendChild(layer);
  }
  return layer;
}

// เคลียร์ target ทั้งหมด
function clearLayer(layer) {
  if (!layer) return;
  layer.querySelectorAll('.hha-target').forEach(el => el.remove());
}

// ----- ตัว main boot -----
// config:
//   difficulty: 'easy'|'normal'|'hard'
//   duration:   sec
//   modeKey:    string (เช่น 'goodjunk-vr', 'hydration-vr')
//   pools:      { good:[], bad:[] }
//   goodRate:   0..1
//   powerups:   []
//   powerRate:  0..1
//   powerEvery: n
//   spawnStyle: 'pop' | ...
//   judge(ch, ctx) → { good:boolean, scoreDelta:number }
//   onExpire(ev)   → ใช้เมื่อตัวเป้าหมดเวลา
export async function boot(cfg = {}) {
  const modeKey    = cfg.modeKey || 'generic-mode';
  const duration   = Number(cfg.duration || DEFAULTS.duration);
  const pools      = cfg.pools || {};
  const poolGood   = pools.good || [];
  const poolBad    = pools.bad  || [];
  const goodRate   = (typeof cfg.goodRate === 'number') ? cfg.goodRate : DEFAULTS.goodRate;
  const powerups   = cfg.powerups || [];
  const powerRate  = (typeof cfg.powerRate === 'number') ? cfg.powerRate : DEFAULTS.powerRate;
  const powerEvery = cfg.powerEvery || DEFAULTS.powerEvery;
  const spawnStyle = cfg.spawnStyle || DEFAULTS.spawnStyle;

  const judgeFn    = typeof cfg.judge === 'function'
    ? cfg.judge
    : () => ({ good: false, scoreDelta: 0 });

  const onExpire   = typeof cfg.onExpire === 'function'
    ? cfg.onExpire
    : null;

  // difficulty → ปรับ interval / maxActive
  let baseInterval = DEFAULTS.baseInterval;
  let maxActive    = DEFAULTS.maxActive;
  let lifeTime     = DEFAULTS.itemLifetime;

  const diff = String(cfg.difficulty || 'normal').toLowerCase();
  if (diff === 'easy') {
    baseInterval = 1100;
    maxActive    = 4;
    lifeTime     = 2600;
  } else if (diff === 'hard') {
    baseInterval = 750;
    maxActive    = 5;
    lifeTime     = 2000;
  }

  const layer = ensureLayer();

  // ----- ตัวนับเวลา -----
  let timeLeft   = duration;
  let tickTimer  = null;
  let spawnTimer = null;
  let running    = true;
  let spawnCount = 0;

  function dispatchTime() {
    window.dispatchEvent(new CustomEvent('hha:time', {
      detail: { mode: modeKey, sec: timeLeft }
    }));
  }

  function startClock() {
    dispatchTime();
    tickTimer = window.setInterval(() => {
      if (!running) return;
      timeLeft -= 1;
      if (timeLeft < 0) timeLeft = 0;
      dispatchTime();
      if (timeLeft <= 0) {
        stopAll();
      }
    }, 1000);
  }

  // ----- สร้าง target ตัวหนึ่ง -----
  function createTarget() {
    if (!running) return;
    if (countActive(layer) >= maxActive) return;

    const isPowerPhase = powerups && powerups.length && (spawnCount > 0) && (spawnCount % powerEvery === 0);
    let ch;
    let isGood = true;
    let isPower = false;

    const r = Math.random();
    if (isPowerPhase && r < powerRate) {
      ch = pick(powerups);
      isGood = true;
      isPower = true;
    } else if (Math.random() < goodRate) {
      ch = pick(poolGood);
      isGood = true;
    } else {
      ch = pick(poolBad);
      isGood = false;
    }
    if (!ch) return;

    const el = createEl('button', 'hha-target');
    el.type = 'button';
    el.textContent = ch;
    el.dataset.ch = ch;
    el.dataset.good = isGood ? '1' : '0';
    if (isPower) el.dataset.power = '1';

    // ----- ตำแหน่ง: ใช้ randomScreenPos แบบ responsive -----
    const pos = randomScreenPos();
    el.style.left = `${pos.x}px`;
    el.style.top  = `${pos.y}px`;

    // สำหรับ animate ด้วย CSS (ถ้ามี)
    if (spawnStyle === 'pop') {
      el.classList.add('hha-target-pop');
    }

    const bornAt = performance.now();
    let expired = false;

    function cleanup() {
      if (!expired) {
        expired = true;
        el.remove();
      }
    }

    // หมดเวลา → expire
    const ttl = window.setTimeout(() => {
      if (expired) return;
      expired = true;
      el.classList.add('hha-target-expire');
      if (onExpire) {
        try {
          onExpire({
            ch,
            isGood,
            isPower,
            bornAt,
            life: lifeTime,
            mode: modeKey
          });
        } catch (e) {
          console.warn('[mode-factory] onExpire error', e);
        }
      }
      window.setTimeout(() => el.remove(), 220);
    }, lifeTime);

    // ยิง / แตะเป้า
    const onHit = (ev) => {
      if (!running || expired) return;
      expired = true;
      window.clearTimeout(ttl);

      const ctx = {
        clientX: ev.clientX,
        clientY: ev.clientY,
        cx: ev.clientX,
        cy: ev.clientY,
        ch,
        isGood,
        isPower,
        mode: modeKey
      };

      let result = {};
      try {
        result = judgeFn(ch, ctx) || {};
      } catch (e) {
        console.warn('[mode-factory] judge error', e);
      }

      el.classList.add(result.good ? 'hha-hit-good' : 'hha-hit-bad');
      window.setTimeout(() => el.remove(), 160);
      ev.preventDefault();
      ev.stopPropagation();
    };

    el.addEventListener('pointerdown', onHit, { passive: false });

    layer.appendChild(el);
    spawnCount += 1;
  }

  function startSpawnLoop() {
    spawnTimer = window.setInterval(() => {
      if (!running) return;
      createTarget();
    }, baseInterval);
  }

  function stopAll() {
    if (!running) return;
    running = false;
    if (tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
    if (spawnTimer) {
      window.clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  function destroy() {
    stopAll();
    clearLayer(layer);
  }

  // ----- เริ่มทำงาน -----
  startClock();
  startSpawnLoop();

  return {
    stop: stopAll,
    destroy,
    get mode() { return modeKey; },
    get running() { return running; },
    get timeLeft() { return timeLeft; }
  };
}

export default { boot };