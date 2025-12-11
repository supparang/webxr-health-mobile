// === /herohealth/vr/mode-factory.js ===
// Generic VR target factory (simple, always-visible spawn)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

/**
 * opts:
 *  - scene: (optional) A-Frame scene element
 *  - diffKey: 'easy' | 'normal' | 'hard'
 *  - diffConfig: { size, rate, life, maxActive }   // optional override
 *  - makeSpec(): { kind, emoji, good }            // optional, random spec
 *  - onHit(info)
 *  - onMiss(info)
 *  - onExpire(info)
 */
export function boot (opts = {}) {
  const A = ROOT.AFRAME;
  if (!A) {
    console.warn('[HHA-Factory] AFRAME not found');
    return { stop () {} };
  }

  const sceneEl = opts.scene || document.querySelector('a-scene');
  if (!sceneEl) {
    console.warn('[HHA-Factory] <a-scene> not found');
    return { stop () {} };
  }

  console.log('[HHA-Factory] boot()', opts);

  // ---- difficulty table (fallback) ----
  const DIFF_DEFAULT = {
    easy:   { size: 1.2, rate: 950,  life: 2600, maxActive: 3 },
    normal: { size: 1.0, rate: 820,  life: 2300, maxActive: 4 },
    hard:   { size: 0.9, rate: 680,  life: 2100, maxActive: 5 }
  };

  const diffKey = String(opts.diffKey || opts.level || 'normal').toLowerCase();
  const baseDiff =
    (opts.diffConfig && opts.diffConfig[diffKey]) ||
    DIFF_DEFAULT[diffKey] ||
    DIFF_DEFAULT.normal;

  const size       = Number(baseDiff.size       ?? 1.0);
  const rateMs     = Number(baseDiff.rate       ?? 900);
  const lifeMs     = Number(baseDiff.life       ?? 2200);
  const maxActive  = Number(baseDiff.maxActive  ?? 4);

  // ---- root entity for all targets ----
  let rootEl = sceneEl.querySelector('#hha-target-root');
  if (!rootEl) {
    rootEl = document.createElement('a-entity');
    rootEl.setAttribute('id', 'hha-target-root');
    sceneEl.appendChild(rootEl);
  }

  const state = {
    active: [],
    running: true,
    timerId: null
  };

  // ---- helper: basic random spec ----
  function defaultMakeSpec () {
    // ให้ประมาณ 70% เป็นเป้าดี 30% เป็น junk
    const r = Math.random();
    if (r < 0.7) {
      return { kind: 'good', emoji: '💧', good: true };
    } else {
      return { kind: 'junk', emoji: '🥤', good: false };
    }
  }

  const makeSpec = typeof opts.makeSpec === 'function'
    ? opts.makeSpec
    : defaultMakeSpec;

  // ---- helper: spawn position (world-space, ชัวร์ว่าอยู่หน้าเด็ก) ----
  function getSpawnPosition () {
    const x = (Math.random() - 0.5) * 2.4;  // -1.2 .. 1.2
    const y = 1.4 + Math.random() * 0.7;    // ~1.4 .. 2.1
    const z = -3;                           // ตรงหน้า
    return { x, y, z };
  }

  // ---- create visual for target ----
  function createTargetEntity (spec) {
    const pos = getSpawnPosition();

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('scale', `${size} ${size} ${size}`);
    el.setAttribute('data-hha-tgt', '1');   // raycaster ใช้เลือกเป้า

    // ถ้ามี emoji ให้ใช้ plane + text
    const emoji = spec.emoji || (spec.good ? '💧' : '🥤');

    // พื้นหลังวงกลม
    const bg = document.createElement('a-circle');
    bg.setAttribute('radius', 0.4);
    bg.setAttribute('color', spec.good ? '#22c55e' : '#f97316');
    bg.setAttribute('opacity', '0.95');
    el.appendChild(bg);

    // emoji text
    const txt = document.createElement('a-text');
    txt.setAttribute('value', emoji);
    txt.setAttribute('align', 'center');
    txt.setAttribute('color', '#ffffff');
    txt.setAttribute('width', 2);
    txt.setAttribute('anchor', 'center');
    txt.setAttribute('position', '0 0 0.02');
    el.appendChild(txt);

    // สนับสนุน raycaster จาก cursor (mouse / gaze)
    el.setAttribute('class', 'hha-target');
    el.setAttribute('geometry', 'primitive: circle; radius: 0.45');
    el.setAttribute('material', 'color: #ffffff; opacity: 0; transparent: true');

    return { el, pos };
  }

  function removeTarget (rec, reason) {
    if (!rec) return;
    const idx = state.active.indexOf(rec);
    if (idx >= 0) state.active.splice(idx, 1);
    if (rec.el && rec.el.parentNode) {
      rec.el.parentNode.removeChild(rec.el);
    }

    if (reason === 'expire' && typeof opts.onExpire === 'function') {
      opts.onExpire({ spec: rec.spec });
    }
    if (reason === 'miss' && typeof opts.onMiss === 'function') {
      opts.onMiss({ spec: rec.spec });
    }
  }

  function spawnOne () {
    if (!state.running) return;
    if (state.active.length >= maxActive) return;

    const spec = makeSpec() || {};
    const { el } = createTargetEntity(spec);

    const rec = {
      el,
      spec,
      bornAt: performance.now()
    };

    // click / fuse hit
    el.addEventListener('click', () => handleHit(rec));
    el.addEventListener('mousedown', () => handleHit(rec)); // กันกรณีบางอุปกรณ์

    rootEl.appendChild(el);
    state.active.push(rec);

    // ตั้ง timeout หมดอายุ
    rec.expireId = ROOT.setTimeout(() => {
      if (!state.running) return;
      removeTarget(rec, 'expire');
    }, lifeMs);
  }

  function handleHit (rec) {
    if (!state.running) return;
    if (!rec) return;

    ROOT.clearTimeout(rec.expireId);
    removeTarget(rec, 'hit');

    if (typeof opts.onHit === 'function') {
      // basic info ให้เกมเอาไปคำนวณต่อ
      opts.onHit({
        spec: rec.spec,
        good: !!rec.spec.good,
        kind: rec.spec.kind || (rec.spec.good ? 'good' : 'junk')
      });
    }
  }

  // ---- เริ่ม loop spawn ----
  state.timerId = ROOT.setInterval(spawnOne, rateMs);

  // spawn ทันที 1 ลูกแรก
  spawnOne();

  return {
    stop (reason = 'manual') {
      if (!state.running) return;
      state.running = false;
      if (state.timerId) {
        ROOT.clearInterval(state.timerId);
        state.timerId = null;
      }
      // ลบเป้าทั้งหมด
      state.active.forEach(rec => {
        ROOT.clearTimeout(rec.expireId);
        if (rec.el && rec.el.parentNode) {
          rec.el.parentNode.removeChild(rec.el);
        }
      });
      state.active.length = 0;

      if (typeof opts.onStop === 'function') {
        opts.onStop({ reason });
      }
      console.log('[HHA-Factory] stop()', reason);
    }
  };
}

export default { boot };