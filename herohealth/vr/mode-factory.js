// === /herohealth/vr/mode-factory.js ===
// Generic DOM target spawner สำหรับ Hydration / Plate ฯลฯ
// ใช้ emoji เป้าแบบป๊อปอัพ (โผล่แล้วหายเอง) รองรับ PC / Mobile / VR-Cardboard

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document || null;

if (!DOC) {
  console.warn('[HHA-Factory] document not found – running in non-DOM env');
}

/**
 * สร้างเลเยอร์สำหรับเป้า (ทับบนฉากเกม)
 */
function ensureLayer () {
  if (!DOC) return null;
  let layer = DOC.querySelector('.hha-target-layer');
  if (!layer) {
    layer = DOC.createElement('div');
    layer.className = 'hha-target-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '500',          // อยู่ใต้ HUD ด้านบน (ซึ่งใช้ zIndex สูงกว่า)
      overflow: 'hidden'
    });
    DOC.body.appendChild(layer);
  }
  return layer;
}

// ===========================
//   boot(opts)
// ===========================
export async function boot (opts = {}) {
  const layer = ensureLayer();
  if (!layer) {
    return { stop () {} };
  }

  // ----- Difficulty -----
  const diffRaw = String(opts.difficulty || opts.diffKey || 'normal').toLowerCase();
  const DIFF = {
    easy:   { size: 1.3, lifeMs: 2600, rateMs: 1100, maxActive: 3 },
    normal: { size: 1.1, lifeMs: 2300, rateMs: 950,  maxActive: 4 },
    hard:   { size: 0.95, lifeMs: 2100, rateMs: 820,  maxActive: 5 }
  };
  const conf = DIFF[diffRaw] || DIFF.normal;

  // ----- Emoji pool -----
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
    const e = ev || {};
    if (e.clientX != null && e.clientY != null) {
      return { clientX: e.clientX, clientY: e.clientY };
    }
    const oe = e.detail && e.detail.originalEvent;
    if (oe && oe.clientX != null && oe.clientY != null) {
      return { clientX: oe.clientX, clientY: oe.clientY };
    }
    // fallback = กลางจอ
    const cx = (ROOT.innerWidth || 0) / 2;
    const cy = (ROOT.innerHeight || 0) / 2;
    return { clientX: cx, clientY: cy };
  }

  function handleHit (rec, ev) {
    if (!state.running || !rec || rec.hit) return;
    rec.hit = true;
    const ctx = ctxFromEvent(ev);
    removeTarget(rec, 'hit');

    if (typeof opts.judge === 'function') {
      try {
        opts.judge(rec.ch, ctx);
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

    const vw = ROOT.innerWidth || 360;
    const vh = ROOT.innerHeight || 640;

    // ตำแหน่งรอบ ๆ กลางจอส่วนล่าง (ไม่ไปทับ HUD บน/ล่าง)
    const cx = vw / 2;
    const cy = vh * 0.58;
    const dx = (Math.random() - 0.5) * (vw * 0.45);
    const dy = (Math.random() - 0.5) * (vh * 0.20);

    const x = cx + dx;
    const y = cy + dy;

    const size = conf.size;

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'hha-target';
    el.textContent = pick.ch;

    const base = 80;  // เส้นผ่านศูนย์กลางพื้นฐาน
    const dpx = base * size;

    Object.assign(el.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -50%)',
      width: dpx + 'px',
      height: dpx + 'px',
      borderRadius: '999px',
      border: 'none',
      padding: '0',
      fontSize: (44 * size) + 'px',
      lineHeight: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 0 18px rgba(0,0,0,0.45)',
      background: pick.isGood
        ? 'radial-gradient(circle at 30% 30%, #bbf7d0, #22c55e)'
        : 'radial-gradient(circle at 30% 30%, #fed7aa, #f97316)',
      color: '#ffffff',
      pointerEvents: 'auto',
      cursor: 'pointer',
      outline: 'none',
      // กันไม่ให้ไปทับ HUD ล่างมากเกิน
      maxWidth: '24vw',
      maxHeight: '24vw'
    });

    // กด = โดนเป้า
    el.addEventListener('click', (ev) => handleHit(rec, ev));
    // รองรับ mousedown เผื่ออุปกรณ์ VR ส่ง event แบบนี้
    el.addEventListener('mousedown', (ev) => handleHit(rec, ev));

    layer.appendChild(el);

    const rec = {
      el,
      ch: pick.ch,
      isGood: pick.isGood,
      isPower: pick.isPower,
      hit: false,
      expireId: null
    };

    if (spawnStyle === 'pop') {
      rec.expireId = ROOT.setTimeout(() => {
        if (!state.running || rec.hit) return;
        removeTarget(rec, 'expire');
      }, conf.lifeMs);
    }

    state.active.push(rec);
  }

  // เริ่ม loop spawn
  state.timerId = ROOT.setInterval(spawnOne, conf.rateMs);
  spawnOne();

  console.log('[HHA-Factory] DOM spawner booted', {
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