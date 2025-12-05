// === /herohealth/vr/mode-factory.js ===
// Engine กลางสำหรับโหมด emoji (Hydration / โหมดอื่น ๆ)
// - สร้างเป้า emoji กระจายบนจอ
// - จัดการเวลาเล่น / event hha:time
// - รองรับ judge() ภายนอก + onExpire()
// ใช้ได้ทั้ง PC / Mobile / VR (คลิก/แตะที่จอเพื่อยิง)

'use strict';

/**
 * cfg:
 *  difficulty: 'easy' | 'normal' | 'hard'
 *  duration:   seconds
 *  modeKey:    string (ใช้แท็ก session ถ้าจำเป็น)
 *  pools:      { good: [...chars], bad: [...chars] }
 *  goodRate:   0..1   // สัดส่วน good
 *  powerups:   [...chars]
 *  powerRate:  0..1   // โอกาสเป็น powerup
 *  powerEvery: n      // ทุก ๆ n ตัวบังคับสุ่ม power 1 ครั้ง
 *  spawnStyle: 'pop'  // (ตอนนี้รองรับแบบโผล่แล้วหายเอง)
 *  judge(ch, ctx):    fn
 *  onExpire(ev):      fn({ char, isGood, isPower })
 */

// ----- random position แบบ responsive (กันเป้าไปทับ HUD + ขอบล่าง) -----
function randomScreenPos() {
  const w = window.innerWidth  || 1280;
  const h = window.innerHeight || 720;

  // HUD ด้านบน (เช่น Water balance)
  const hud = document.querySelector('.hha-water');
  let hudH = 120; // fallback กรณีหา element ไม่เจอ
  if (hud) {
    const rect = hud.getBoundingClientRect();
    hudH = rect.height + 16;
  }

  const bottomSafe = 140; // กันปุ่มล่าง / bar มือถือ

  const topRaw    = hudH;
  const bottomRaw = h - bottomSafe;

  // safety เผื่อจอเตี้ย
  const top    = Math.min(topRaw, h * 0.55);
  const bottom = Math.max(bottomRaw, h * 0.45);

  // จำกัดให้อยู่โซนกลาง ๆ แนวตั้ง
  const midY  = (top + bottom) / 2;
  const spanY = Math.min(bottom - top, h * 0.45);
  const yMin  = midY - spanY / 2;
  const yMax  = midY + spanY / 2;

  // ซ้าย/ขวา เว้น margin 10%
  const left  = w * 0.10;
  const right = w * 0.90;

  const x = left + Math.random() * (right - left);
  const y = yMin + Math.random() * (yMax - yMin);

  return { x, y };
}

// difficulty → พารามิเตอร์พื้นฐาน
function difficultyPreset(diff = 'normal') {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      spawnInterval: 1100,
      lifeTime: 2300,
      maxActive: 4
    };
  }
  if (d === 'hard') {
    return {
      spawnInterval: 750,
      lifeTime: 1900,
      maxActive: 6
    };
  }
  // normal
  return {
    spawnInterval: 900,
    lifeTime: 2100,
    maxActive: 5
  };
}

export async function boot(cfg = {}) {
  const {
    difficulty = 'normal',
    duration   = 60,
    modeKey    = 'generic',
    pools      = {},
    goodRate   = 0.6,
    powerups   = [],
    powerRate  = 0.1,
    powerEvery = 7,
    spawnStyle = 'pop',
    judge,
    onExpire
  } = cfg;

  if (typeof judge !== 'function') {
    console.warn('[mode-factory] cfg.judge ไม่ใช่ฟังก์ชัน – engine จะไม่ตัดสินคะแนน');
  }

  const preset = difficultyPreset(difficulty);

  const goodPool = Array.isArray(pools.good) ? pools.good.slice() : [];
  const badPool  = Array.isArray(pools.bad)  ? pools.bad.slice()  : [];
  const powPool  = Array.isArray(powerups)   ? powerups.slice()   : [];

  const activeTargets = new Set();
  let spawnTimer = null;
  let lifeTimers  = new Map();

  let secLeft = Number(duration) || 60;
  if (secLeft < 20)  secLeft = 20;
  if (secLeft > 180) secLeft = 180;

  let running = true;
  let shootHandler = null;
  let timeTimer    = null;
  let spawnCount   = 0;

  // ----- helper สุ่ม emoji -----
  function pick(array, fallback = '❔') {
    if (!array || array.length === 0) return fallback;
    const i = Math.floor(Math.random() * array.length);
    return array[i];
  }

  function decideChar() {
    // บังคับ power ทุก ๆ powerEvery ตัว ถ้ามี
    if (powPool.length && powerEvery > 0 && spawnCount > 0 && spawnCount % powerEvery === 0) {
      const ch = pick(powPool);
      return { ch, isGood: false, isPower: true };
    }

    // ปกติ
    const r = Math.random();
    if (powPool.length && r < powerRate) {
      const ch = pick(powPool);
      return { ch, isGood: false, isPower: true };
    }

    const r2 = Math.random();
    if (r2 < goodRate && goodPool.length) {
      const ch = pick(goodPool);
      return { ch, isGood: true, isPower: false };
    }
    const ch = pick(badPool.length ? badPool : goodPool);
    return { ch, isGood: badPool.length ? false : true, isPower: false };
  }

  // ----- สร้าง DOM เป้า -----
  function spawnOne() {
    if (!running) return;
    if (activeTargets.size >= preset.maxActive) return;

    const { ch, isGood, isPower } = decideChar();
    const { x, y } = randomScreenPos();

    const el = document.createElement('div');
    el.className = 'hha-target';
    el.textContent = ch;
    el.style.position = 'fixed';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none'; // ยิงด้วยคลิกที่ไหนก็ได้

    el.dataset.char   = ch;
    el.dataset.good   = String(!!isGood);
    el.dataset.power  = String(!!isPower);
    el.dataset.mode   = modeKey;

    if (isPower) {
      el.classList.add('hha-target-power');
    } else if (isGood) {
      el.classList.add('hha-target-good');
    } else {
      el.classList.add('hha-target-bad');
    }

    document.body.appendChild(el);
    activeTargets.add(el);

    // ตั้งเวลา expire
    const lifeId = window.setTimeout(() => {
      lifeTimers.delete(el);
      if (!activeTargets.has(el)) return;
      activeTargets.delete(el);
      if (el.parentNode) el.parentNode.removeChild(el);

      if (typeof onExpire === 'function') {
        onExpire({
          char: ch,
          isGood,
          isPower
        });
      }
    }, preset.lifeTime);
    lifeTimers.set(el, lifeId);

    spawnCount++;
  }

  // ----- ยิงเป้า: คลิก/แตะที่จอ → หาเป้าใกล้สุด -----
  function handleShoot(ev) {
    if (!running) return;

    let cx, cy;
    if (ev.touches && ev.touches.length) {
      cx = ev.touches[0].clientX;
      cy = ev.touches[0].clientY;
    } else {
      cx = ev.clientX;
      cy = ev.clientY;
    }

    if (typeof cx !== 'number' || typeof cy !== 'number') {
      cx = window.innerWidth / 2;
      cy = window.innerHeight / 2;
    }

    // หาเป้าใกล้ที่สุดใน radius
    let best = null;
    let bestDist = Infinity;
    const hitRadius = 70; // px

    activeTargets.forEach(el => {
      const rect = el.getBoundingClientRect();
      const tx = rect.left + rect.width / 2;
      const ty = rect.top  + rect.height / 2;
      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    });

    if (!best) return; // ยังไม่ถือว่า miss ให้ logic ภายนอกจัดการเอง

    const ch      = best.dataset.char || best.textContent || '❔';
    const isGood  = best.dataset.good === 'true';
    const isPower = best.dataset.power === 'true';

    // ตัด life timer + ลบ DOM
    const lifeId = lifeTimers.get(best);
    if (lifeId) {
      window.clearTimeout(lifeId);
      lifeTimers.delete(best);
    }
    activeTargets.delete(best);
    if (best.parentNode) best.parentNode.removeChild(best);

    if (typeof judge === 'function') {
      judge(ch, {
        clientX: cx,
        clientY: cy,
        isGood,
        isPower,
        modeKey
      });
    }
  }

  // ----- จัดการเวลา hha:time -----
  function startClock() {
    // ส่งค่าเริ่มต้น
    window.dispatchEvent(new CustomEvent('hha:time', {
      detail: { sec: secLeft }
    }));

    timeTimer = window.setInterval(() => {
      if (!running) return;
      secLeft -= 1;
      if (secLeft < 0) secLeft = 0;

      window.dispatchEvent(new CustomEvent('hha:time', {
        detail: { sec: secLeft }
      }));

      if (secLeft <= 0) {
        stop();
      }
    }, 1000);
  }

  function startSpawner() {
    spawnOne(); // spawn ทันที
    spawnTimer = window.setInterval(() => {
      if (!running) return;
      spawnOne();
    }, preset.spawnInterval);
  }

  function stop() {
    if (!running) return;
    running = false;

    if (spawnTimer) {
      window.clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if (timeTimer) {
      window.clearInterval(timeTimer);
      timeTimer = null;
    }

    // ลบเป้าทั้งหมด
    lifeTimers.forEach(id => window.clearTimeout(id));
    lifeTimers.clear();
    activeTargets.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    activeTargets.clear();

    if (shootHandler) {
      window.removeEventListener('pointerdown', shootHandler, { passive: false });
      window.removeEventListener('touchstart', shootHandler, { passive: false });
      shootHandler = null;
    }
  }

  function destroy() {
    stop();
  }

  // ----- start engine -----
  shootHandler = (ev) => {
    ev.preventDefault();
    handleShoot(ev);
  };
  window.addEventListener('pointerdown', shootHandler, { passive: false });
  window.addEventListener('touchstart', shootHandler, { passive: false });

  startClock();
  startSpawner();

  return {
    stop,
    destroy,
    get running() {
      return running;
    }
  };
}

// default export เผื่อที่อื่นเคย import แบบ default
export default { boot };