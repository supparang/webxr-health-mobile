// === /herohealth/vr/mode-factory.js ===
// Generic VR target spawner (Hydration / Plate ฯลฯ)
// เป้าแบบ pop-up (โผล่แล้วหายเอง) ใช้กับ PC / Mobile / VR

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

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

  // ----- ใช้ parent ของ camera เป็น root ของเป้า -----
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
    easy:   { size: 2.2, lifeMs: 2600, rateMs: 1100, maxActive: 3 },
    normal: { size: 1.8, lifeMs: 2200, rateMs: 950,  maxActive: 4 },
    hard:   { size: 1.4, lifeMs: 2000, rateMs: 820,  maxActive: 5 }
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
    const y = -0.2 + Math.random() * 1.0;    // กลางจอ
    const z = 0;                             // ระนาบเดียวกับ root
    return { x, y, z };
  }

  function createTarget (info) {
    const pos = spawnPos();
    const size = conf.size;

    const el = document.createElement('a-entity');
    el.setAttribute('class', 'hha-target clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('scale', `${size} ${size} ${size}`);

    // พื้นหลังวงกลม (ใหญ่และเห็นชัด)
    const bg = document.createElement('a-circle');
    bg.setAttribute('radius', 0.35);
    bg.setAttribute('color', info.isGood ? '#22c55e' : '#f97316');
    bg.setAttribute('opacity', '0.95');
    bg.setAttribute('side', 'double');
    el.appendChild(bg);

    // emoji ตรงกลาง ใช้ a-text
    const txt = document.createElement('a-text');
    txt.setAttribute('value', info.ch);
    txt.setAttribute('color', '#ffffff');
    txt.setAttribute('align', 'center');
    txt.setAttribute('anchor', 'center');
    txt.setAttribute('baseline', 'center');
    txt.setAttribute('width', '1.4');
    txt.setAttribute('position', '0 0 0.02');
    el.appendChild(txt);

    // hit area = วงกลมพื้นหลังนี่แหละ (raycaster ยิงใส่)
    el.setAttribute('geometry', 'primitive: circle; radius: 0.35');
    el.setAttribute('material', 'color: #ffffff; opacity: 0.0; transparent: true');

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

    // รองรับทั้ง click บน cursor (raycaster) และ mouse/touch
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

      state.active.forEach((rec) => {
        try { removeTarget(rec, 'stop'); } catch {}
      });
      state.active.length = 0;

      console.log('[HHA-Factory] stop()', reason);
    }
  };
}

export default { boot };