// === /herohealth/vr/mode-factory.js ===
// Generic emoji target engine สำหรับโหมด VR แบบ 2D overlay
// ใช้กับ Hydration / Balanced Plate (และโหมดอื่นที่ต้องการ)
// - spawn เป้า emoji ตาม config จาก HHA_DIFF_TABLE
// - ส่ง event hha:time (sec นับถอยหลัง)
// - เรียก judge(ch, ctx) เมื่อโดนเป้า
// - เรียก onExpire(ev) เมื่อเป้าหายเอง

'use strict';

import { HHA_DIFF_TABLE } from './hha-diff-table.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- style พื้นฐานสำหรับเป้า ----------
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;

  const css = ROOT.document.createElement('style');
  css.id = 'hha-mode-factory-style';
  css.textContent = `
    .hha-target-layer{
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:450; /* ใต้ HUD/Quest แต่เหนือฉาก VR */
    }
    .hha-tgt{
      position:absolute;
      transform:translate(-50%,-50%);
      font-size:42px;
      filter:drop-shadow(0 6px 10px rgba(15,23,42,0.9));
      cursor:pointer;
      pointer-events:auto;
      user-select:none;
      touch-action:manipulation;
      transition:transform .18s ease-out, opacity .18s ease-out;
    }
    .hha-tgt-good{
      text-shadow:0 0 10px rgba(34,197,94,.5);
    }
    .hha-tgt-bad{
      text-shadow:0 0 10px rgba(248,113,113,.5);
    }
    .hha-tgt-power{
      text-shadow:0 0 12px rgba(251,191,36,.8);
    }
    .hha-tgt-leave{
      opacity:0;
      transform:translate(-50%,-80%);
    }

    .hha-countdown-layer{
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      z-index:800;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
    }
    .hha-countdown-bubble{
      padding:18px 26px;
      border-radius:999px;
      background:rgba(15,23,42,0.92);
      border:1px solid rgba(148,163,184,0.6);
      box-shadow:0 18px 40px rgba(15,23,42,0.95);
      font-size:34px;
      font-weight:700;
      color:#e5e7eb;
      min-width:120px;
      text-align:center;
      transform:scale(1);
      opacity:1;
      transition:transform .18s ease-out, opacity .18s ease-out;
    }
    .hha-countdown-bubble.fade{
      transform:scale(.8);
      opacity:0;
    }
  `;
  ROOT.document.head.appendChild(css);
}

// ---------- เลือก engine config จาก HHA_DIFF_TABLE ----------
function pickEngineConfig(modeKey, diffKey) {
  const table = HHA_DIFF_TABLE[modeKey] || {};
  const row =
    table[diffKey] ||
    table.normal ||
    Object.values(table)[0] || {};   // fallback แถวแรกถ้าไม่เจอ
  return row.engine || {};
}

function pickOne(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// random ตำแหน่งบนจอ (เว้น HUD ด้านบน + coach ด้านล่าง)
function randomScreenPos() {
  const w = ROOT.innerWidth  || 1280;
  const h = ROOT.innerHeight || 720;

  const topSafe    = 120;  // water gauge + HUD
  const bottomSafe = 140;  // coach / fever

  const left  = w * 0.15;
  const right = w * 0.85;

  const x = left + Math.random() * (right - left);
  const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
  return { x, y };
}

// ---------- เครืองยนต์หลัก ----------
export async function boot(opts = {}) {
  ensureStyle();

  const modeKey = String(opts.modeKey || 'goodjunk').toLowerCase();
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();

  // --- config จาก HHA_DIFF_TABLE ---
  const engCfg = pickEngineConfig(modeKey, diffKey);

  const SPAWN_INTERVAL = engCfg.SPAWN_INTERVAL ?? 1000;
  const ITEM_LIFETIME  = engCfg.ITEM_LIFETIME  ?? 2200;
  const MAX_ACTIVE     = engCfg.MAX_ACTIVE     ?? 4;
  const SIZE_FACTOR    = engCfg.SIZE_FACTOR    ?? 1.0;

  const GOOD_RATIO     = engCfg.GOOD_RATIO     ?? (opts.goodRate ?? 0.65);
  const POWER_RATIO    = engCfg.POWER_RATIO    ?? (opts.powerRate ?? 0.10);

  // --- pools / options จาก safe.js ---
  const pools      = opts.pools || {};
  const goodPool   = pools.good || [];
  const badPool    = pools.bad  || [];
  const powerups   = opts.powerups || [];
  const powerEvery = opts.powerEvery || 7;

  const judge    = typeof opts.judge === 'function'    ? opts.judge    : null;
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : null;

  // duration วินาที (นับถอยหลัง)
  let duration = Number(opts.duration || 60);
  if (!Number.isFinite(duration) || duration <= 0) duration = 60;
  if (duration < 10) duration = 10;
  if (duration > 300) duration = 300;

  // --- สร้าง layer สำหรับเป้า ---
  let layer = ROOT.document.querySelector('.hha-target-layer');
  if (!layer) {
    layer = ROOT.document.createElement('div');
    layer.className = 'hha-target-layer';
    ROOT.document.body.appendChild(layer);
  }

  // --- countdown 3-2-1-GO ---
  let countdownWrap = null;
  let countdownBubble = null;
  function showCountdown(text) {
    if (!countdownWrap) {
      countdownWrap = ROOT.document.createElement('div');
      countdownWrap.className = 'hha-countdown-layer';
      countdownBubble = ROOT.document.createElement('div');
      countdownBubble.className = 'hha-countdown-bubble';
      countdownWrap.appendChild(countdownBubble);
      ROOT.document.body.appendChild(countdownWrap);
    }
    countdownBubble.textContent = text;
    countdownBubble.classList.remove('fade');
    requestAnimationFrame(() => countdownBubble.classList.add('fade'));
  }
  function hideCountdown() {
    if (countdownWrap) {
      countdownWrap.remove();
      countdownWrap = null;
      countdownBubble = null;
    }
  }

  // ---------- state spawn ----------
  let running      = false;
  let spawnTimerId = null;
  let timeTimerId  = null;
  let secLeft      = Math.round(duration);
  let totalSpawn   = 0;

  const targets = new Set();

  function removeTarget(tgtObj) {
    if (!tgtObj) return;
    targets.delete(tgtObj);
    if (tgtObj.el && tgtObj.el.parentNode) {
      tgtObj.el.parentNode.removeChild(tgtObj.el);
    }
  }

  function spawnTarget() {
    if (!running) return;
    if (!goodPool.length && !badPool.length && !powerups.length) return;
    if (targets.size >= MAX_ACTIVE) return;

    totalSpawn++;

    let isPower = false;
    let ch      = null;
    let kind    = 'good';
    let isGood  = true;

    const shouldPower =
      powerups.length &&
      (
        (powerEvery > 0 && totalSpawn % powerEvery === 0) ||
        Math.random() < POWER_RATIO
      );

    if (shouldPower) {
      isPower = true;
      ch      = pickOne(powerups);
      kind    = 'power';
      isGood  = true;
    } else {
      const useGood = Math.random() < GOOD_RATIO;
      if (useGood && goodPool.length) {
        ch     = pickOne(goodPool);
        kind   = 'good';
        isGood = true;
      } else if (badPool.length) {
        ch     = pickOne(badPool);
        kind   = 'bad';
        isGood = false;
      } else if (goodPool.length) {
        ch     = pickOne(goodPool);
        kind   = 'good';
        isGood = true;
      }
    }

    if (!ch) return;

    const pos = randomScreenPos();
    const el  = ROOT.document.createElement('div');
    el.className = 'hha-tgt';
    if (kind === 'good')  el.classList.add('hha-tgt-good');
    if (kind === 'bad')   el.classList.add('hha-tgt-bad');
    if (kind === 'power') el.classList.add('hha-tgt-power');

    const baseSize = 42;
    const scale = SIZE_FACTOR || 1.0;
    el.style.fontSize = (baseSize * scale) + 'px';

    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
    el.textContent = ch;

    const spawnAt = performance.now();
    const tgtObj = { el, ch, isGood, isPower, kind, spawnAt };
    targets.add(tgtObj);

    function handleHit(ev) {
      if (!running) return;
      ev.stopPropagation();
      ev.preventDefault();

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;

      const now = performance.now();
      const rt  = now - spawnAt;

      removeTarget(tgtObj);

      if (typeof judge === 'function') {
        try {
          judge(ch, {
            clientX: ev.clientX,
            clientY: ev.clientY,
            cx,
            cy,
            rtMs: rt,
            kind,
            isGood,
            isPower
          });
        } catch (e) {
          console.warn('[mode-factory] judge error', e);
        }
      }
    }

    el.addEventListener('click', handleHit);
    el.addEventListener('pointerdown', handleHit);
    layer.appendChild(el);

    // expire
    setTimeout(() => {
      if (!running) return;
      if (!targets.has(tgtObj)) return;
      el.classList.add('hha-tgt-leave');
      setTimeout(() => {
        removeTarget(tgtObj);
        if (typeof onExpire === 'function') {
          try {
            onExpire({ ch, isGood, isPower, kind });
          } catch (e) {
            console.warn('[mode-factory] onExpire error', e);
          }
        }
      }, 180);
    }, ITEM_LIFETIME);
  }

  // ---------- hha:time ----------
  function emitTime(sec) {
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:time', {
        detail: { sec }
      }));
    } catch {}
  }

  function startTimers() {
    running = true;
    emitTime(secLeft);

    spawnTimerId = ROOT.setInterval(spawnTarget, SPAWN_INTERVAL);

    timeTimerId = ROOT.setInterval(() => {
      if (!running) return;
      secLeft -= 1;
      if (secLeft < 0) secLeft = 0;
      emitTime(secLeft);
      if (secLeft <= 0) {
        stop();
      }
    }, 1000);
  }

  function startWithCountdown() {
    let step = 3;
    showCountdown('3');
    const id = ROOT.setInterval(() => {
      step -= 1;
      if      (step === 2) showCountdown('2');
      else if (step === 1) showCountdown('1');
      else if (step === 0) showCountdown('GO!');
      else {
        ROOT.clearInterval(id);
        hideCountdown();
        startTimers();
      }
    }, 700);
  }

  function stop() {
    if (!running) return;
    running = false;

    if (spawnTimerId) {
      ROOT.clearInterval(spawnTimerId);
      spawnTimerId = null;
    }
    if (timeTimerId) {
      ROOT.clearInterval(timeTimerId);
      timeTimerId = null;
    }
    targets.forEach(t => removeTarget(t));
    targets.clear();
  }

  // เริ่ม engine ด้วย countdown
  startWithCountdown();

  return { stop };
}

export default { boot };
