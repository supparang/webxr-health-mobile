// =========================================================
// /herohealth/vr/mode-factory.js
// Generic DOM Target Spawner (HHA Standard) — MODULE (PRODUCTION)
// ✅ Exports: boot()
// ✅ Also attaches: window.HHA_ModeFactory.boot (for debugging)
// ✅ Fix: Cannot access 'controller' before initialization
// ✅ Supports click/tap + crosshair shooting (hha:shoot) with lockPx
// =========================================================

'use strict';

const WIN = window;
const DOC = document;

function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

function seededRng(seed) {
  let t = (Number(seed) || Date.now()) >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now() { return performance?.now?.() ?? Date.now(); }

function getRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect?.();
  if (!r) return null;
  if (r.width <= 2 || r.height <= 2) return null;
  return r;
}

function hitTestTargetAtPoint(x, y) {
  const el = DOC.elementFromPoint(x, y);
  if (!el) return null;
  const t = el.closest?.('.plateTarget, .hha-target, [data-hha-target="1"]');
  return t || null;
}

function makeEl(kind, sizePx) {
  const el = DOC.createElement('div');
  el.className = 'plateTarget'; // plate ใช้คลาสนี้อยู่แล้ว
  el.dataset.kind = kind;

  // ขนาด
  el.style.position = 'fixed';
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.style.left = `0px`;
  el.style.top = `0px`;
  el.style.transform = `translate(-9999px,-9999px)`; // ซ่อนก่อน
  el.style.zIndex = '11';

  return el;
}

export function boot(opts = {}) {
  const mount = opts.mount;
  if (!mount) throw new Error('mode-factory: mount missing');

  const rng = opts.rng || seededRng(opts.seed || Date.now());
  const spawnEveryMs = clamp(opts.spawnEveryMs ?? opts.spawnRate ?? 850, 120, 5000);
  const sizeRange = Array.isArray(opts.sizeRange) ? opts.sizeRange : [44, 68];

  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds
    : [{ kind: 'good', weight: 0.7 }, { kind: 'junk', weight: 0.3 }];

  const onHit = typeof opts.onHit === 'function' ? opts.onHit : () => {};
  const onExpire = typeof opts.onExpire === 'function' ? opts.onExpire : () => {};
  const makeTargetData = typeof opts.makeTargetData === 'function' ? opts.makeTargetData : () => ({});

  let running = true;
  let tickId = null;

  const live = new Map(); // el -> target
  const controller = {
    stop() {
      running = false;
      if (tickId) clearInterval(tickId);
      tickId = null;

      // remove listeners
      try { mount.removeEventListener('pointerdown', onPointerDown, true); } catch {}
      try { WIN.removeEventListener('hha:shoot', onShoot, true); } catch {}

      // cleanup elements
      live.forEach((t) => { try { t.el.remove(); } catch {} });
      live.clear();
    },
    getLiveCount() { return live.size; }
  };

  function pickKind() {
    let sum = 0;
    for (const k of kinds) sum += (Number(k.weight) || 0);
    const r = rng() * (sum || 1);
    let acc = 0;
    for (const k of kinds) {
      acc += (Number(k.weight) || 0);
      if (r <= acc) return String(k.kind || 'good');
    }
    return String(kinds[0]?.kind || 'good');
  }

  function randSize() {
    const a = Number(sizeRange[0] || 44);
    const b = Number(sizeRange[1] || 68);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return Math.round(lo + (hi - lo) * rng());
  }

  function placeInside(el, sizePx) {
    const r = getRect(mount);
    if (!r) return false;

    // padding กันชนขอบ
    const pad = Math.max(10, Math.round(sizePx * 0.25));
    const x0 = r.left + pad;
    const y0 = r.top + pad;
    const x1 = r.right - pad - sizePx;
    const y1 = r.bottom - pad - sizePx;

    if (x1 <= x0 || y1 <= y0) return false;

    const x = Math.round(x0 + (x1 - x0) * rng());
    const y = Math.round(y0 + (y1 - y0) * rng());

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = `translateZ(0)`;
    return true;
  }

  function spawnOne() {
    if (!running) return;

    const r = getRect(mount);
    if (!r) return; // ยังวัดพื้นที่ไม่ได้ → รอก่อน

    const kind = pickKind();
    const sizePx = randSize();
    const el = makeEl(kind, sizePx);

    // icon/emoji (เรียบ ๆ ก่อน)
    el.textContent =
      kind === 'good' ? '🍽️' :
      kind === 'shield' ? '🛡️' :
      '🍩';

    // extra data
    const extra = makeTargetData(kind, rng) || {};
    if (extra && extra.groupIndex != null) el.dataset.groupIndex = String(extra.groupIndex);

    mount.appendChild(el);

    // place
    if (!placeInside(el, sizePx)) {
      el.remove();
      return;
    }

    const t = {
      kind,
      el,
      bornAt: now(),
      ttlMs: clamp(opts.ttlMs ?? 1800, 400, 8000),
      sizePx,
      ...extra
    };
    live.set(el, t);

    // expire
    setTimeout(() => {
      if (!running) return;
      if (!live.has(el)) return;
      live.delete(el);
      try { el.remove(); } catch {}
      onExpire(t);
    }, t.ttlMs);
  }

  function hitTarget(el) {
    const t = live.get(el);
    if (!t) return;
    live.delete(el);
    try { el.remove(); } catch {}
    onHit(t);
  }

  function onPointerDown(ev) {
    if (!running) return;
    const el = ev.target?.closest?.('.plateTarget, .hha-target, [data-hha-target="1"]');
    if (el && live.has(el)) {
      ev.preventDefault?.();
      hitTarget(el);
    }
  }

  function onShoot(ev) {
    if (!running) return;
    const d = ev.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if (!isFinite(x) || !isFinite(y)) return;

    // ยิง: elementFromPoint
    const el = hitTestTargetAtPoint(x, y);
    if (el && live.has(el)) hitTarget(el);
  }

  // listeners
  mount.addEventListener('pointerdown', onPointerDown, true);
  WIN.addEventListener('hha:shoot', onShoot, true);

  // main loop
  tickId = setInterval(() => {
    if (!running) return;
    spawnOne();
  }, spawnEveryMs);

  // initial burst
  setTimeout(spawnOne, 120);
  setTimeout(spawnOne, 260);

  // expose for debug (optional)
  WIN.HHA_ModeFactory = WIN.HHA_ModeFactory || {};
  WIN.HHA_ModeFactory.boot = boot;

  return controller;
}
