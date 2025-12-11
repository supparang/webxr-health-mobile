// === /herohealth/vr/mode-factory.js ===
// Generic VR target spawner (Hydration / อื่น ๆ)
// แบบ pop-up (โผล่แล้วหายเอง) ใช้กับ PC / Mobile / VR

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// ---------- emoji → texture (canvas) cache ----------
const EMOJI_CACHE = new Map();

function makeEmojiDataURL (ch) {
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    '200px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ch, size / 2, size / 2 + 8);

  return canvas.toDataURL('image/png');
}

function getEmojiTex (ch) {
  if (!EMOJI_CACHE.has(ch)) {
    EMOJI_CACHE.set(ch, makeEmojiDataURL(ch));
  }
  return EMOJI_CACHE.get(ch);
}

// ======================================================
//  boot(opts)
// ======================================================
export function boot (opts = {}) {
  const A = ROOT.AFRAME;
  if (!A) {
    console.warn('[HHA-Factory] AFRAME not found');
    return { stop () {} };
  }

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) {
    console.warn('[HHA-Factory] <a-scene> not found');
    return { stop () {} };
  }

  // ----- หา camera / rig แล้วผูกเป้าไว้กับ rig -----
  const camEl =
    sceneEl.querySelector('[camera]') ||
    sceneEl.querySelector('a-camera');

  const rootParent = (camEl && camEl.parentEl) ? camEl.parentEl : sceneEl;

  let rootEl = rootParent.querySelector('#hha-target-root');
  if (!rootEl) {
    rootEl = document.createElement('a-entity');
    rootEl.setAttribute('id', 'hha-target-root');
    // วาง root ห่างจากกล้องไปข้างหน้า ~3 เมตร
    if (!rootEl.getAttribute('position')) {
      rootEl.setAttribute('position', '0 0 -3');
    }
    rootParent.appendChild(rootEl);
  }

  // ----- Difficulty config -----
  const diffRaw = String(opts.difficulty || opts.diffKey || 'normal').toLowerCase();
  const DIFF = {
    easy:   { size: 1.25, lifeMs: 2600, rateMs: 1100, maxActive: 3 },
    normal: { size: 1.0,  lifeMs: 2200, rateMs: 950,  maxActive: 4 },
    hard:   { size: 0.85, lifeMs: 2000, rateMs: 820,  maxActive: 5 }
  };
  const conf = DIFF[diffRaw] || DIFF.normal;

  const goodPool = (opts.pools && opts.pools.good && opts.pools.good.length)
    ? opts.pools.good.slice()
    : ['💧'];

  const badPool = (opts.pools && opts.pools.bad && opts.pools.bad.length)
    ? opts.pools.bad.slice()
    : ['🥤'];

  const powerPool = (opts.powerups && opts.powerups.length)
    ? opts.powerups.slice()
    : [];

  const goodRate   = Number.isFinite(opts.goodRate)   ? opts.goodRate   : 0.65;
  const powerRate  = Number.isFinite(opts.powerRate)  ? opts.powerRate  : 0.10;
  const powerEvery = Number.isFinite(opts.powerEvery) ? opts.powerEvery : 7;

  const spawnStyle = (opts.spawnStyle || 'pop').toLowerCase();

  const state = {
    running: true,
    timerId: null,
    spawned: 0,
    active: []
  };

  // ---------- helpers ----------
  function randItem (arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickChar () {
    // บังคับให้มี power-up ทุก ๆ n ลูก
    if (powerPool.length && powerEvery > 0 &&
        state.spawned > 0 &&
        state.spawned % powerEvery === powerEvery - 1) {
      const ch = randItem(powerPool);
      return { ch, isGood: true, isPower: true };
    }

    const r = Math.random();
    if (powerPool.length && r < powerRate) {
      const ch = randItem(powerPool);
      return { ch, isGood: true, isPower: true };
    }

    if (Math.random() < goodRate) {
      const ch = randItem(goodPool);
      return { ch, isGood: true, isPower: false };
    }
    const ch = randItem(badPool);
    return { ch, isGood: false, isPower: false };
  }

  // ตำแหน่งใน local space ของ root (ซึ่งอยู่หน้าเด็กแล้ว)
  function spawnPos () {
    const x = (Math.random() - 0.5) * 2.4;   // ซ้าย–ขวา
    const y = -0.3 + Math.random() * 1.1;    // -0.3 .. 0.8 (กลางจอ)
    const z = 0;                             // บนระนาบเดียวกับ root
    return { x, y, z };
  }

  function createTarget (info) {
    const pos = spawnPos();
    const size = conf.size;

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('scale', `${size} ${size} ${size}`);
    el.setAttribute('class', 'hha-target');
    el.setAttribute('data-hha-tgt', '1');

    // พื้นหลังวงกลมสีเขียว/ส้ม
    const bg = document.createElement('a-circle');
    bg.setAttribute('radius', 0.45);
    bg.setAttribute('color', info.isGood ? '#22c55e' : '#f97316');
    bg.setAttribute('opacity', '0.95');
    el.appendChild(bg);

    // emoji เป็น texture บน plane
    const icon = document.createElement('a-plane');
    icon.setAttribute('width', '0.7');
    icon.setAttribute('height', '0.7');
    icon.setAttribute('position', '0 0 0.02');
    icon.setAttribute('transparent', 'true');

    const tex = getEmojiTex(info.ch);
    if (tex) {
      icon.setAttribute(
        'material',
        `shader: flat; src: ${tex}; transparent: true; alphaTest: 0.01`
      );
    } else {
      icon.setAttribute(
        'material',
        'shader: flat; color: #ffffff; transparent: true; opacity: 0.0'
      );
    }
    el.appendChild(icon);

    // hit area โปร่งใสครอบ emoji
    el.setAttribute(
      'geometry',
      'primitive: circle; radius: 0.55'
    );
    el.setAttribute(
      'material',
      'color: #ffffff; opacity: 0.0; transparent: true'
    );

    return { el, pos };
  }

  function removeTarget (rec, reason) {
    if (!rec) return;
    const idx = state.active.indexOf(rec);
    if (idx >= 0) state.active.splice(idx, 1);

    if (rec.expireId) {
      ROOT.clearTimeout(rec.expireId);
      rec.expireId = null;
    }
    if (rec.el && rec.el.parentNode) {
      rec.el.parentNode.removeChild(rec.el);
    }

    if (reason === 'expire' && typeof opts.onExpire === 'function') {
      try {
        opts.onExpire({
          ch: rec.ch,
          isGood: rec.isGood === true,
          isPower: rec.isPower === true
        });
      } catch (err) {
        console.warn('[HHA-Factory] onExpire error', err);
      }
    }
  }

  function ctxFromEvent (ev) {
    const oe = ev && ev.detail && ev.detail.originalEvent;
    if (oe && typeof oe.clientX === 'number' && typeof oe.clientY === 'number') {
      return { clientX: oe.clientX, clientY: oe.clientY };
    }
    const cx = (ROOT.innerWidth || 0) / 2;
    const cy = (ROOT.innerHeight || 0) / 2;
    return { clientX: cx, clientY: cy };
  }

  function handleHit (rec, ctx) {
    if (!state.running || !rec || rec.hit) return;
    rec.hit = true;
    removeTarget(rec, 'hit');

    if (typeof opts.judge === 'function') {
      try {
        opts.judge(rec.ch, ctx || {});
      } catch (err) {
        console.warn('[HHA-Factory] judge error', err);
      }
    }
  }

  function spawnOne () {
    if (!state.running) return;
    if (state.active.length >= conf.maxActive) return;

    const pick = pickChar();
    if (!pick || !pick.ch) return;

    state.spawned += 1;

    const { el } = createTarget(pick);
    const rec = {
      el,
      ch: pick.ch,
      isGood: pick.isGood,
      isPower: pick.isPower,
      bornAt: performance.now(),
      hit: false,
      expireId: null
    };

    el.addEventListener('click', (ev) => {
      const ctx = ctxFromEvent(ev);
      handleHit(rec, ctx);
    });

    el.addEventListener('mousedown', (ev) => {
      const ctx = ctxFromEvent(ev);
      handleHit(rec, ctx);
    });

    rootEl.appendChild(el);
    state.active.push(rec);

    if (spawnStyle === 'pop') {
      rec.expireId = ROOT.setTimeout(() => {
        if (!state.running || rec.hit) return;
        removeTarget(rec, 'expire');
      }, conf.lifeMs);
    }
  }

  // เริ่ม loop
  state.timerId = ROOT.setInterval(spawnOne, conf.rateMs);
  spawnOne();

  console.log('[HHA-Factory] booted (hydration)', {
    diff: diffRaw,
    size: conf.size,
    lifeMs: conf.lifeMs,
    rateMs: conf.rateMs
  });

  return {
    stop (reason = 'manual') {
      if (!state.running) return;
      state.running = false;

      if (state.timerId) {
        ROOT.clearInterval(state.timerId);
        state.timerId = null;
      }

      state.active.forEach((rec) => {
        try { removeTarget(rec, 'stop'); } catch {}
      });
      state.active.length = 0;

      console.log('[HHA-Factory] stop()', reason);
    }
  };
}

export default { boot };