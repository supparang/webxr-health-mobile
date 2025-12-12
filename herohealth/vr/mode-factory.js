// === /herohealth/vr/mode-factory.js ===
// โรงงานสปอนเป้า DOM สำหรับ Hero Health (GoodJunk / Hydration / Plate ฯลฯ)
// - สร้างเป้า emoji (.hha-target) แบบ position:absolute → เลื่อนจอแล้วเป้าเลื่อนตาม
// - รองรับ good/bad/powerups
// - ผูกกับ judge() + onExpire()
// - คืน ctrl.stop() เพื่อหยุดเกม/หยุดสปอน

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

if (!DOC) {
  console.warn('[mode-factory] document not found');
}

// helper เล็ก ๆ
function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// สุ่มจาก array
function pickOne(arr) {
  if (!arr || !arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

// ---------- DOM Target Manager ----------

function createTargetElement(char, kind) {
  const el = DOC.createElement('div');
  el.className = 'hha-target';
  el.textContent = char || '●';

  // ไม่ใช้ fixed แล้ว → absolute เพื่อให้เลื่อนตาม scroll ได้
  el.style.position = 'absolute';
  el.style.left = '50%';
  el.style.top  = '50%';

  if (kind === 'good') {
    el.classList.add('hha-target-good');
  } else if (kind === 'bad') {
    el.classList.add('hha-target-bad');
  }

  // วางใน body ให้สัมพันธ์กับ scroll ทั้งหน้า
  DOC.body.appendChild(el);
  return el;
}

// วางจุด (x,y) โดยคิด scroll แล้ว
function positionTarget(el, x, y) {
  // x,y = พิกัดใน viewport (0–innerWidth/Height)
  // แต่เราใช้ absolute ผูกกับทั้ง document → บวก scroll เข้าไป
  const sx = ROOT.scrollX || ROOT.pageXOffset || 0;
  const sy = ROOT.scrollY || ROOT.pageYOffset || 0;

  el.style.left = (sx + x) + 'px';
  el.style.top  = (sy + y) + 'px';
}

// สุ่มตำแหน่งในหน้าจอ โดยเผื่อ margin รอบ ๆ
function randomScreenPos() {
  const w = ROOT.innerWidth  || 800;
  const h = ROOT.innerHeight || 600;
  const marginX = 60;
  const marginY = 80;
  const x = marginX + Math.random() * Math.max(40, (w - marginX * 2));
  const y = marginY + Math.random() * Math.max(40, (h - marginY * 2));
  return { x, y };
}

// ลบเป้า
function destroyTarget(el) {
  if (!el) return;
  try {
    el.remove();
  } catch {
    if (el.parentNode) el.parentNode.removeChild(el);
  }
}

// ---------- main boot ----------

export async function boot(config = {}) {
  const pools     = config.pools || {};
  const goodPool  = pools.good || [];
  const badPool   = pools.bad  || [];
  const judge     = typeof config.judge === 'function' ? config.judge : null;
  const onExpire  = typeof config.onExpire === 'function' ? config.onExpire : null;

  const diffKey   = String(config.difficulty || 'normal').toLowerCase();
  let durationSec = Number(config.duration || 60);
  if (!Number.isFinite(durationSec) || durationSec <= 0) durationSec = 60;
  durationSec = clamp(durationSec, 20, 180);

  // rate/ความถี่ spawn พื้นฐาน
  let baseSpawnMs = 900;
  if (diffKey === 'easy')   baseSpawnMs = 1100;
  if (diffKey === 'hard')   baseSpawnMs = 750;

  const goodRate   = (typeof config.goodRate === 'number') ? config.goodRate : 0.65;
  const powerups   = Array.isArray(config.powerups) ? config.powerups : [];
  const powerRate  = (typeof config.powerRate === 'number') ? config.powerRate : 0.12;
  const powerEvery = (typeof config.powerEvery === 'number') ? config.powerEvery : 7;

  let alive = true;
  let spawnTimer = null;
  let liveTargets = new Set();
  let spawnCount  = 0;

  const startTime = Date.now();
  const endTime   = startTime + durationSec * 1000;

  // ---------- สร้าง 1 เป้า ----------
  function spawnOne() {
    if (!alive) return;
    if (Date.now() >= endTime) {
      return; // ปล่อยให้ตัวจับเวลา stop() ด้านนอกจัดการ
    }

    // ตัดสินชนิด good/bad/power
    let ch = null;
    let kind = 'good';

    // powerups แบบทุกๆ powerEvery ลูก มีโอกาส drop
    let isPower = false;
    if (powerups.length && ((spawnCount + 1) % powerEvery === 0)) {
      if (Math.random() < powerRate) {
        ch = pickOne(powerups);
        isPower = true;
      }
    }

    if (!ch) {
      if (Math.random() < goodRate) {
        ch = pickOne(goodPool);
        kind = 'good';
      } else {
        ch = pickOne(badPool);
        kind = 'bad';
      }
    }

    if (!ch) return;

    const { x, y } = randomScreenPos();
    const el = createTargetElement(ch, kind);
    positionTarget(el, x, y);

    const bornAt = Date.now();
    const lifeMs = isPower ? 1400 : 1100; // power อยู่บนจอนานกว่าเล็กน้อย

    const targetObj = {
      el,
      ch,
      kind,
      bornAt,
      lifeMs,
      dead: false
    };
    liveTargets.add(targetObj);

    // คลิก / แตะ
    el.addEventListener('click', (ev) => {
      if (!alive || targetObj.dead) return;
      targetObj.dead = true;
      liveTargets.delete(targetObj);

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2 + (ROOT.scrollX || ROOT.pageXOffset || 0);
      const cy = rect.top  + rect.height / 2 + (ROOT.scrollY || ROOT.pageYOffset || 0);

      let res = null;
      if (judge) {
        try {
          res = judge(ch, {
            clientX: cx,
            clientY: cy,
            cx,
            cy,
            kind
          });
        } catch (err) {
          console.warn('[mode-factory] judge error', err);
        }
      }

      destroyTarget(el);
    });
  }

  // ---------- loop ตรวจหมดอายุ ----------
  function tickExpire() {
    const now = Date.now();
    for (const t of Array.from(liveTargets)) {
      if (t.dead) continue;
      if (now - t.bornAt > t.lifeMs) {
        t.dead = true;
        liveTargets.delete(t);

        if (onExpire) {
          try {
            onExpire({
              char: t.ch,
              isGood: (t.kind === 'good')
            });
          } catch (err) {
            console.warn('[mode-factory] onExpire error', err);
          }
        }

        destroyTarget(t.el);
      }
    }
  }

  // ---------- main spawn loop ----------
  function startSpawnLoop() {
    function loop() {
      if (!alive) return;

      const now = Date.now();
      if (now >= endTime) {
        // หมดเวลาเกม → หยุดสปอน แต่ยังให้ plate.safe ตัดสินเองผ่าน hha:time
        stopSpawnTimer();
        return;
      }

      spawnCount++;
      spawnOne();
      tickExpire();

      // adaptive ความถี่เล็ก ๆ: นานขึ้นถ้าเป้าสะสมเยอะ
      const loadFactor = clamp(liveTargets.size / 7, 0, 1); // 0–1
      const nextMs = baseSpawnMs + loadFactor * 300;

      spawnTimer = ROOT.setTimeout(loop, nextMs);
    }

    spawnTimer = ROOT.setTimeout(loop, baseSpawnMs);
  }

  function stopSpawnTimer() {
    if (spawnTimer != null) {
      ROOT.clearTimeout(spawnTimer);
      spawnTimer = null;
    }
  }

  function cleanupAllTargets() {
    for (const t of Array.from(liveTargets)) {
      destroyTarget(t.el);
    }
    liveTargets.clear();
  }

  // เริ่มทำงาน
  startSpawnLoop();

  const ctrl = {
    stop() {
      alive = false;
      stopSpawnTimer();
      cleanupAllTargets();
    }
  };

  return ctrl;
}

export { boot as factoryBoot };
export default { boot };