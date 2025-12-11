// === /herohealth/vr/mode-factory.js ===
// Generic VR target factory (Hydration / etc.)
// สปอนเป้าแบบ pop (โผล่แล้วหายเอง) ใช้ได้กับ PC / Mobile / VR

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

/**
 * boot(opts)
 *  opts:
 *    difficulty: 'easy' | 'normal' | 'hard'
 *    duration: sec (ไม่จำเป็น)
 *    modeKey: 'hydration' ฯลฯ (ไม่บังคับ)
 *
 *    pools: {
 *      good: ['💧', '🥛', ...],
 *      bad:  ['🥤', '🧋', ...]
 *    }
 *    goodRate: 0.6         // โอกาสเป้าน้ำดี
 *    powerups: ['⭐','💎','🛡️','🔥']
 *    powerRate: 0.1        // โอกาสเป้า power-up
 *    powerEvery: 7         // ทุก ๆ n ลูก ให้มี power-up อย่างน้อย 1 ครั้ง
 *
 *    spawnStyle: 'pop'     // ตอนนี้รองรับแบบเดียว
 *
 *    judge(ch, ctx)        // เรียกตอนตีโดนเป้า
 *    onExpire({ ch, isGood }) // เรียกตอนเป้าหายเอง
 */
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

  // ----- Difficulty config (ง่าย / ปกติ / ยาก) -----
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

  // รากเก็บเป้า
  let rootEl = sceneEl.querySelector('#hha-target-root');
  if (!rootEl) {
    rootEl = document.createElement('a-entity');
    rootEl.setAttribute('id', 'hha-target-root');
    sceneEl.appendChild(rootEl);
  }

  // ---------------- Random helpers ----------------
  function randItem (arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickChar () {
    // บังคับให้มี power-up ทุก ๆ powerEvery ลูก
    if (powerPool.length && powerEvery > 0 && state.spawned > 0 &&
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
    } else {
      const ch = randItem(badPool);
      return { ch, isGood: false, isPower: false };
    }
  }

  // ---------------- Position helper ----------------
  function spawnPos () {
    // สุ่มหน้าเด็กแถว ๆ กลางจอ
    const x = (Math.random() - 0.5) * 2.6;   // -1.3 .. 1.3
    const y = 1.4 + Math.random() * 0.7;     // 1.4 .. 2.1
    const z = -3.2;                          // หน้า camera
    return { x, y, z };
  }

  // ---------------- Create target entity ----------------
  function createTarget (info) {
    const pos = spawnPos();
    const size = conf.size;

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('scale', `${size} ${size} ${size}`);
    el.setAttribute('data-hha-tgt', '1');   // ให้ raycaster เลือกได้
    el.setAttribute('class', 'hha-target');

    // พื้นหลังวงกลม
    const bg = document.createElement('a-circle');
    bg.setAttribute('radius', 0.45);
    bg.setAttribute('color', info.isGood ? '#22c55e' : '#f97316');
    bg.setAttribute('opacity', '0.95');
    el.appendChild(bg);

    // emoji text
    const txt = document.createElement('a-text');
    txt.setAttribute('value', info.ch);
    txt.setAttribute('align', 'center');
    txt.setAttribute('anchor', 'center');
    txt.setAttribute('width', 2);
    txt.setAttribute('color', '#ffffff');
    txt.setAttribute('position', '0 0 0.02');
    el.appendChild(txt);

    // hit-area ใส่ geometry circle โปร่งใสไว้รับ click
    el.setAttribute(
      'geometry',
      'primitive: circle; radius: 0.50'
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

  function ctxFromEvent (ev) {
    const oe = ev && ev.detail && ev.detail.originalEvent;
    if (oe && typeof oe.clientX === 'number' && typeof oe.clientY === 'number') {
      return { clientX: oe.clientX, clientY: oe.clientY };
    }
    // fallback กลางจอ
    const cx = (ROOT.innerWidth || 0) / 2;
    const cy = (ROOT.innerHeight || 0) / 2;
    return { clientX: cx, clientY: cy };
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

    // click (mouse / touch) – ใช้กับ cursor rayOrigin: mouse
    el.addEventListener('click', (ev) => {
      const ctx = ctxFromEvent(ev);
      handleHit(rec, ctx);
    });

    // กันบาง device ใช้ mousedown แทน
    el.addEventListener('mousedown', (ev) => {
      const ctx = ctxFromEvent(ev);
      handleHit(rec, ctx);
    });

    rootEl.appendChild(el);
    state.active.push(rec);

    // ตั้งเวลาให้เป้าหายเอง
    if (spawnStyle === 'pop') {
      rec.expireId = ROOT.setTimeout(() => {
        if (!state.running || rec.hit) return;
        removeTarget(rec, 'expire');
      }, conf.lifeMs);
    }
  }

  // เริ่ม loop spawn
  state.timerId = ROOT.setInterval(spawnOne, conf.rateMs);
  // spawn ลูกแรกทันที
  spawnOne();

  console.log('[HHA-Factory] booted', {
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
      // ลบเป้าทั้งหมด
      state.active.forEach((rec) => {
        try {
          removeTarget(rec, 'stop');
        } catch {}
      });
      state.active.length = 0;

      console.log('[HHA-Factory] stop()', reason);
    }
  };
}

export default { boot };